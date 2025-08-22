const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const db = require('./database');

class MigrationManager {
  constructor() {
    this.migrationsDir = path.join(__dirname, 'migrations');
    this.migrations = [];
  }

  // Инициализация системы миграций
  async initialize() {
    try {
      // Создаем директорию для миграций если её нет
      await fs.mkdir(this.migrationsDir, { recursive: true });
      
      // Создаем таблицу миграций если её нет
      await db.run(`
        CREATE TABLE IF NOT EXISTS database_migrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          migration_name TEXT UNIQUE NOT NULL,
          applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          checksum TEXT,
          execution_time INTEGER
        )
      `);

      console.log('Migration system initialized');
    } catch (error) {
      console.error('Error initializing migration system:', error);
    }
  }

  // Создание новой миграции
  async createMigration(name, upSQL, downSQL) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      const migrationName = `${timestamp}_${name}.js`;
      const migrationPath = path.join(this.migrationsDir, migrationName);

      const migrationContent = `module.exports = {
  name: '${name}',
  up: \`${upSQL}\`,
  down: \`${downSQL}\`,
  description: '${name}'
};`;

      await fs.writeFile(migrationPath, migrationContent);
      console.log(`Migration created: ${migrationPath}`);
      return migrationPath;
    } catch (error) {
      console.error('Error creating migration:', error);
      throw error;
    }
  }

  // Загрузка всех миграций
  async loadMigrations() {
    try {
      const files = await fs.readdir(this.migrationsDir);
      const migrationFiles = files.filter(file => file.endsWith('.js'));

      this.migrations = [];
      for (const file of migrationFiles) {
        const migrationPath = path.join(this.migrationsDir, file);
        const migration = require(migrationPath);
        migration.fileName = file;
        this.migrations.push(migration);
      }

      // Сортируем миграции по имени файла (которое содержит timestamp)
      this.migrations.sort((a, b) => a.fileName.localeCompare(b.fileName));
      
      return this.migrations;
    } catch (error) {
      console.error('Error loading migrations:', error);
      return [];
    }
  }

  // Получение списка примененных миграций
  async getAppliedMigrations() {
    try {
      const appliedMigrations = await db.all('SELECT * FROM database_migrations ORDER BY applied_at ASC');
      return appliedMigrations;
    } catch (error) {
      console.error('Error getting applied migrations:', error);
      return [];
    }
  }

  // Вычисление контрольной суммы SQL
  calculateChecksum(sql) {
    return crypto.createHash('md5').update(sql).digest('hex');
  }

  // Применение миграции
  async applyMigration(migration) {
    const startTime = Date.now();
    
    try {
      // Проверяем, не была ли миграция уже применена
      const existing = await db.get(
        'SELECT * FROM database_migrations WHERE migration_name = ?',
        migration.name
      );

      if (existing) {
        console.log(`Migration ${migration.name} already applied`);
        return { success: true, skipped: true };
      }

      // Выполняем миграцию
      await db.run(migration.up);

      // Вычисляем контрольную сумму
      const checksum = this.calculateChecksum(migration.up);
      const executionTime = Date.now() - startTime;

      // Записываем информацию о примененной миграции
      await db.run(
        'INSERT INTO database_migrations (migration_name, checksum, execution_time) VALUES (?, ?, ?)',
        migration.name,
        checksum,
        executionTime
      );

      console.log(`Migration ${migration.name} applied successfully (${executionTime}ms)`);
      return { success: true, executionTime };
    } catch (error) {
      console.error(`Error applying migration ${migration.name}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Откат миграции
  async rollbackMigration(migrationName) {
    try {
      // Находим миграцию
      const migration = this.migrations.find(m => m.name === migrationName);
      if (!migration) {
        throw new Error(`Migration ${migrationName} not found`);
      }

      // Проверяем, была ли миграция применена
      const applied = await db.get(
        'SELECT * FROM database_migrations WHERE migration_name = ?',
        migrationName
      );

      if (!applied) {
        throw new Error(`Migration ${migrationName} was not applied`);
      }

      // Выполняем откат
      await db.run(migration.down);

      // Удаляем запись о миграции
      await db.run('DELETE FROM database_migrations WHERE migration_name = ?', migrationName);

      console.log(`Migration ${migrationName} rolled back successfully`);
      return { success: true };
    } catch (error) {
      console.error(`Error rolling back migration ${migrationName}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Применение всех новых миграций
  async migrate() {
    try {
      await this.loadMigrations();
      const appliedMigrations = await this.getAppliedMigrations();
      const appliedNames = appliedMigrations.map(m => m.migration_name);

      const pendingMigrations = this.migrations.filter(m => !appliedNames.includes(m.name));

      if (pendingMigrations.length === 0) {
        console.log('No pending migrations');
        return { success: true, applied: 0 };
      }

      console.log(`Found ${pendingMigrations.length} pending migrations`);

      let appliedCount = 0;
      for (const migration of pendingMigrations) {
        const result = await this.applyMigration(migration);
        if (result.success && !result.skipped) {
          appliedCount++;
        } else if (!result.success) {
          console.error(`Failed to apply migration ${migration.name}`);
          break;
        }
      }

      console.log(`Applied ${appliedCount} migrations`);
      return { success: true, applied: appliedCount };
    } catch (error) {
      console.error('Error running migrations:', error);
      return { success: false, error: error.message };
    }
  }

  // Откат последней миграции
  async rollback() {
    try {
      const appliedMigrations = await this.getAppliedMigrations();
      
      if (appliedMigrations.length === 0) {
        console.log('No migrations to rollback');
        return { success: true, rolledBack: 0 };
      }

      const lastMigration = appliedMigrations[appliedMigrations.length - 1];
      const result = await this.rollbackMigration(lastMigration.migration_name);

      return { success: result.success, rolledBack: result.success ? 1 : 0 };
    } catch (error) {
      console.error('Error rolling back migration:', error);
      return { success: false, error: error.message };
    }
  }

  // Получение статуса миграций
  async getStatus() {
    try {
      await this.loadMigrations();
      const appliedMigrations = await this.getAppliedMigrations();
      const appliedNames = appliedMigrations.map(m => m.migration_name);

      const status = this.migrations.map(migration => ({
        name: migration.name,
        fileName: migration.fileName,
        applied: appliedNames.includes(migration.name),
        appliedAt: appliedMigrations.find(m => m.migration_name === migration.name)?.applied_at
      }));

      return status;
    } catch (error) {
      console.error('Error getting migration status:', error);
      return [];
    }
  }

  // Создание базовых миграций
  async createInitialMigrations() {
    try {
      // Миграция для создания таблиц логирования
      await this.createMigration(
        'create_logging_tables',
        `
        CREATE TABLE IF NOT EXISTS operation_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          operation_type TEXT NOT NULL,
          operation_details TEXT,
          ip_address TEXT,
          user_agent TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          status TEXT DEFAULT 'success',
          error_message TEXT
        );

        CREATE TABLE IF NOT EXISTS user_audit_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          action_type TEXT NOT NULL,
          action_details TEXT,
          old_values TEXT,
          new_values TEXT,
          ip_address TEXT,
          user_agent TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          session_id TEXT
        );

        CREATE TABLE IF NOT EXISTS backup_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          backup_type TEXT NOT NULL,
          file_path TEXT,
          file_size INTEGER,
          status TEXT DEFAULT 'pending',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          completed_at DATETIME,
          error_message TEXT
        );
        `,
        `
        DROP TABLE IF EXISTS operation_logs;
        DROP TABLE IF EXISTS user_audit_logs;
        DROP TABLE IF EXISTS backup_logs;
        `
      );



      console.log('Initial migrations created');
    } catch (error) {
      console.error('Error creating initial migrations:', error);
    }
  }
}

module.exports = new MigrationManager();
