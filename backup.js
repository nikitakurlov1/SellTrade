const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const db = require('./database');

class BackupManager {
  constructor() {
    this.backupDir = path.join(__dirname, 'data', 'backups');
    this.maxBackups = 10; // Максимальное количество резервных копий
  }

  // Создание резервной копии базы данных
  async createDatabaseBackup() {
    try {
      // Создаем директорию для резервных копий если её нет
      await fs.mkdir(this.backupDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `database_backup_${timestamp}.db`;
      const backupPath = path.join(this.backupDir, backupFileName);

      // Копируем базу данных
      await fs.copyFile('./crypto_data.db', backupPath);

      // Получаем размер файла
      const stats = await fs.stat(backupPath);
      const fileSize = stats.size;

      // Логируем создание резервной копии
      await this.logBackup('database', backupPath, fileSize, 'completed');

      console.log(`Database backup created: ${backupPath} (${fileSize} bytes)`);
      return { success: true, path: backupPath, size: fileSize };
    } catch (error) {
      console.error('Error creating database backup:', error);
      await this.logBackup('database', null, 0, 'failed', error.message);
      return { success: false, error: error.message };
    }
  }

  // Создание резервной копии всех данных
  async createFullBackup() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupDirName = `full_backup_${timestamp}`;
      const backupPath = path.join(this.backupDir, backupDirName);

      // Создаем директорию для полной резервной копии
      await fs.mkdir(backupPath, { recursive: true });

      // Копируем базу данных
      await fs.copyFile('./crypto_data.db', path.join(backupPath, 'crypto_data.db'));

      // Копируем конфигурационные файлы
      const configFiles = ['package.json', 'server.js', 'database.js'];
      for (const file of configFiles) {
        try {
          await fs.copyFile(file, path.join(backupPath, file));
        } catch (error) {
          console.warn(`Could not copy ${file}:`, error.message);
        }
      }

      // Создаем архив резервной копии
      const archivePath = `${backupPath}.tar.gz`;
      await execAsync(`tar -czf "${archivePath}" -C "${this.backupDir}" "${backupDirName}"`);
      
      // Удаляем временную директорию
      await fs.rmdir(backupPath, { recursive: true });

      // Получаем размер архива
      const stats = await fs.stat(archivePath);
      const fileSize = stats.size;

      // Логируем создание резервной копии
      await this.logBackup('full', archivePath, fileSize, 'completed');

      console.log(`Full backup created: ${archivePath} (${fileSize} bytes)`);
      return { success: true, path: archivePath, size: fileSize };
    } catch (error) {
      console.error('Error creating full backup:', error);
      await this.logBackup('full', null, 0, 'failed', error.message);
      return { success: false, error: error.message };
    }
  }

  // Восстановление из резервной копии
  async restoreFromBackup(backupPath) {
    try {
      // Проверяем существование файла резервной копии
      await fs.access(backupPath);

      // Создаем резервную копию текущего состояния перед восстановлением
      await this.createDatabaseBackup();

      // Восстанавливаем базу данных
      await fs.copyFile(backupPath, './crypto_data.db');

      console.log(`Database restored from: ${backupPath}`);
      return { success: true };
    } catch (error) {
      console.error('Error restoring from backup:', error);
      return { success: false, error: error.message };
    }
  }

  // Очистка старых резервных копий
  async cleanupOldBackups() {
    try {
      const files = await fs.readdir(this.backupDir);
      const backupFiles = files.filter(file => file.startsWith('database_backup_') || file.startsWith('full_backup_'));

      if (backupFiles.length <= this.maxBackups) {
        return { success: true, deleted: 0 };
      }

      // Сортируем файлы по дате создания
      const fileStats = await Promise.all(
        backupFiles.map(async (file) => {
          const filePath = path.join(this.backupDir, file);
          const stats = await fs.stat(filePath);
          return { file, path: filePath, mtime: stats.mtime };
        })
      );

      // Удаляем самые старые файлы
      const filesToDelete = fileStats
        .sort((a, b) => a.mtime - b.mtime)
        .slice(0, backupFiles.length - this.maxBackups);

      let deletedCount = 0;
      for (const fileInfo of filesToDelete) {
        try {
          await fs.unlink(fileInfo.path);
          deletedCount++;
          console.log(`Deleted old backup: ${fileInfo.file}`);
        } catch (error) {
          console.error(`Error deleting backup ${fileInfo.file}:`, error);
        }
      }

      return { success: true, deleted: deletedCount };
    } catch (error) {
      console.error('Error cleaning up old backups:', error);
      return { success: false, error: error.message };
    }
  }

  // Получение списка резервных копий
  async getBackupList() {
    try {
      const files = await fs.readdir(this.backupDir);
      const backupFiles = files.filter(file => file.startsWith('database_backup_') || file.startsWith('full_backup_'));

      const backupList = await Promise.all(
        backupFiles.map(async (file) => {
          const filePath = path.join(this.backupDir, file);
          const stats = await fs.stat(filePath);
          return {
            name: file,
            path: filePath,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime
          };
        })
      );

      return backupList.sort((a, b) => b.modified - a.modified);
    } catch (error) {
      console.error('Error getting backup list:', error);
      return [];
    }
  }

  // Логирование операций резервного копирования
  async logBackup(backupType, filePath, fileSize, status, errorMessage = null) {
    try {
      const stmt = await db.prepare(`
        INSERT INTO backup_logs (backup_type, file_path, file_size, status, completed_at, error_message)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      await stmt.run(
        backupType,
        filePath,
        fileSize,
        status,
        status === 'completed' ? new Date().toISOString() : null,
        errorMessage
      );
      
      await stmt.finalize();
    } catch (error) {
      console.error('Error logging backup:', error);
    }
  }

  // Автоматическое резервное копирование
  async scheduleBackup() {
    try {
      // Создаем резервную копию базы данных
      await this.createDatabaseBackup();
      
      // Очищаем старые резервные копии
      await this.cleanupOldBackups();
      
      console.log('Scheduled backup completed successfully');
    } catch (error) {
      console.error('Error in scheduled backup:', error);
    }
  }
}

module.exports = new BackupManager();
