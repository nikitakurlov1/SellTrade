const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database file path
const dbPath = path.join(__dirname, 'crypto_data.db');

// Create database connection
const db = new sqlite3.Database(dbPath);

// Initialize database tables
const initializeDatabase = () => {
    return new Promise((resolve, reject) => {
        // Create users table
        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                notes TEXT,
                lastLogin TEXT,
                createdAt TEXT NOT NULL
            )
        `, (err) => {
            if (err) {
                console.error('Error creating users table:', err);
                reject(err);
                return;
            }
        });

        // Create accounts table
        db.run(`
            CREATE TABLE IF NOT EXISTS accounts (
                id TEXT PRIMARY KEY,
                userId TEXT NOT NULL,
                balance TEXT NOT NULL,
                createdAt TEXT NOT NULL,
                FOREIGN KEY (userId) REFERENCES users (id)
            )
        `, (err) => {
            if (err) {
                console.error('Error creating accounts table:', err);
                reject(err);
                return;
            }
        });

        // Create coins table
        db.run(`
            CREATE TABLE IF NOT EXISTS coins (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                symbol TEXT NOT NULL,
                price REAL NOT NULL,
                priceChange REAL,
                marketCap REAL,
                volume REAL,
                category TEXT,
                status TEXT DEFAULT 'active',
                description TEXT,
                createdAt TEXT NOT NULL,
                updatedAt TEXT NOT NULL
            )
        `, (err) => {
            if (err) {
                console.error('Error creating coins table:', err);
                reject(err);
                return;
            }
        });

        // Create price_history table for tracking price changes
        db.run(`
            CREATE TABLE IF NOT EXISTS price_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                coinId TEXT NOT NULL,
                price REAL NOT NULL,
                priceChange REAL,
                marketCap REAL,
                volume REAL,
                timestamp TEXT NOT NULL,
                FOREIGN KEY (coinId) REFERENCES coins (id)
            )
        `, (err) => {
            if (err) {
                console.error('Error creating price_history table:', err);
                reject(err);
                return;
            }
        });

        // Create transactions table for exchange
        db.run(`
            CREATE TABLE IF NOT EXISTS transactions (
                id TEXT PRIMARY KEY,
                userId TEXT NOT NULL,
                type TEXT NOT NULL,
                assetId TEXT,
                amount REAL NOT NULL,
                price REAL NOT NULL,
                usdAmount REAL NOT NULL,
                commission REAL NOT NULL,
                timestamp TEXT NOT NULL,
                status TEXT DEFAULT 'completed',
                FOREIGN KEY (userId) REFERENCES users (id),
                FOREIGN KEY (assetId) REFERENCES coins (id)
            )
        `, (err) => {
            if (err) {
                console.error('Error creating transactions table:', err);
                reject(err);
                return;
            }
        });

        // Create portfolios table for exchange
        db.run(`
            CREATE TABLE IF NOT EXISTS portfolios (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId TEXT NOT NULL,
                assets TEXT NOT NULL,
                totalValue REAL DEFAULT 0,
                totalInvested REAL DEFAULT 0,
                totalProfit REAL DEFAULT 0,
                profitPercent REAL DEFAULT 0,
                updatedAt TEXT NOT NULL,
                FOREIGN KEY (userId) REFERENCES users (id)
            )
        `, (err) => {
            if (err) {
                console.error('Error creating portfolios table:', err);
                reject(err);
                return;
            }
            console.log('Database initialized successfully');
            resolve();
        });
    });
};

// Создание таблиц для логирования и аудита
const createLoggingTables = async () => {
  try {
    // Таблица для логирования операций
    await db.run(`
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
      )
    `);

    // Таблица для аудита действий пользователей
    await db.run(`
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
      )
    `);

    // Таблица для резервных копий
    await db.run(`
      CREATE TABLE IF NOT EXISTS backup_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        backup_type TEXT NOT NULL,
        file_path TEXT,
        file_size INTEGER,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        error_message TEXT
      )
    `);

    // Таблица для миграций базы данных
    await db.run(`
      CREATE TABLE IF NOT EXISTS database_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        migration_name TEXT UNIQUE NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        checksum TEXT,
        execution_time INTEGER
      )
    `);

    console.log('Logging tables created successfully');
  } catch (error) {
    console.error('Error creating logging tables:', error);
  }
};

// Функции для логирования операций
const logOperation = async (userId, operationType, details = {}, ipAddress = null, userAgent = null) => {
  try {
    const stmt = await db.prepare(`
      INSERT INTO operation_logs (user_id, operation_type, operation_details, ip_address, user_agent, timestamp)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    
    await stmt.run(
      userId,
      operationType,
      JSON.stringify(details),
      ipAddress,
      userAgent
    );
    
    await stmt.finalize();
  } catch (error) {
    console.error('Error logging operation:', error);
  }
};

// Функции для аудита действий пользователей
const logUserAction = async (userId, actionType, details = {}, oldValues = null, newValues = null, ipAddress = null, userAgent = null, sessionId = null) => {
  try {
    const stmt = await db.prepare(`
      INSERT INTO user_audit_logs (user_id, action_type, action_details, old_values, new_values, ip_address, user_agent, session_id, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    
    await stmt.run(
      userId,
      actionType,
      JSON.stringify(details),
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
      ipAddress,
      userAgent,
      sessionId
    );
    
    await stmt.finalize();
  } catch (error) {
    console.error('Error logging user action:', error);
  }
};

// Функции для получения логов
const getOperationLogs = async (userId = null, limit = 100, offset = 0) => {
  try {
    let query = `
      SELECT * FROM operation_logs 
      ${userId ? 'WHERE user_id = ?' : ''}
      ORDER BY timestamp DESC 
      LIMIT ? OFFSET ?
    `;
    
    const params = userId ? [userId, limit, offset] : [limit, offset];
    const logs = await db.all(query, ...params);
    return logs;
  } catch (error) {
    console.error('Error getting operation logs:', error);
    return [];
  }
};

const getUserAuditLogs = async (userId = null, limit = 100, offset = 0) => {
  try {
    let query = `
      SELECT * FROM user_audit_logs 
      ${userId ? 'WHERE user_id = ?' : ''}
      ORDER BY timestamp DESC 
      LIMIT ? OFFSET ?
    `;
    
    const params = userId ? [userId, limit, offset] : [limit, offset];
    const logs = await db.all(query, ...params);
    return logs;
  } catch (error) {
    console.error('Error getting user audit logs:', error);
    return [];
  }
};

// User operations
const createUser = (user) => {
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT OR REPLACE INTO users (id, username, email, password, status, notes, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [user.id, user.username, user.email, user.password, user.status || 'pending', user.notes || null, user.createdAt],
            function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            }
        );
    });
};

const getUserByEmail = (email) => {
    return new Promise((resolve, reject) => {
        db.get(
            'SELECT * FROM users WHERE email = ?',
            [email],
            (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            }
        );
    });
};

const getUserByUsername = (username) => {
    return new Promise((resolve, reject) => {
        db.get(
            'SELECT * FROM users WHERE username = ?',
            [username],
            (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            }
        );
    });
};

const getUserById = (id) => {
    return new Promise((resolve, reject) => {
        db.get(
            'SELECT * FROM users WHERE id = ?',
            [id],
            (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            }
        );
    });
};

const getAllUsers = () => {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM users ORDER BY createdAt DESC', (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
};

const updateUser = (id, updates) => {
    return new Promise((resolve, reject) => {
        const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
        const values = Object.values(updates);
        values.push(id);

        db.run(
            `UPDATE users SET ${fields} WHERE id = ?`,
            values,
            function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            }
        );
    });
};

const deleteUser = (id) => {
    return new Promise((resolve, reject) => {
        db.run(
            'DELETE FROM users WHERE id = ?',
            [id],
            function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            }
        );
    });
};

const updateUserLastLogin = (id) => {
    return new Promise((resolve, reject) => {
        db.run(
            'UPDATE users SET lastLogin = ? WHERE id = ?',
            [new Date().toISOString(), id],
            function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            }
        );
    });
};

// Account operations
const createAccount = (account) => {
    return new Promise((resolve, reject) => {
        console.log(`Saving account to database: ${account.id} for user ${account.userId}`);
        console.log(`Account balance: ${JSON.stringify(account.balance)}`);
        
        db.run(
            'INSERT OR REPLACE INTO accounts (id, userId, balance, createdAt) VALUES (?, ?, ?, ?)',
            [account.id, account.userId, JSON.stringify(account.balance), account.createdAt],
            function(err) {
                if (err) {
                    console.error('Error saving account:', err);
                    reject(err);
                } else {
                    console.log(`Account saved successfully: ${account.id}`);
                    resolve(this.lastID);
                }
            }
        );
    });
};

const getAccountByUserId = (userId) => {
    return new Promise((resolve, reject) => {
        db.get(
            'SELECT * FROM accounts WHERE userId = ?',
            [userId],
            (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    if (row) {
                        row.balance = JSON.parse(row.balance);
                    }
                    resolve(row);
                }
            }
        );
    });
};

// Coin operations
const saveCoin = (coin) => {
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT OR REPLACE INTO coins 
            (id, name, symbol, price, priceChange, marketCap, volume, category, status, description, createdAt, updatedAt) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                coin.id, coin.name, coin.symbol, coin.price, coin.priceChange,
                coin.marketCap, coin.volume, coin.category, coin.status,
                coin.description, coin.createdAt, coin.updatedAt
            ],
            function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            }
        );
    });
};

const getAllCoins = () => {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM coins ORDER BY marketCap DESC', (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
};

const getCoinById = (id) => {
    return new Promise((resolve, reject) => {
        db.get(
            'SELECT * FROM coins WHERE id = ?',
            [id],
            (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            }
        );
    });
};

const updateCoin = (id, updates) => {
    return new Promise((resolve, reject) => {
        const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
        const values = Object.values(updates);
        values.push(id);

        db.run(
            `UPDATE coins SET ${fields} WHERE id = ?`,
            values,
            function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            }
        );
    });
};

const deleteCoin = (id) => {
    return new Promise((resolve, reject) => {
        db.run(
            'DELETE FROM coins WHERE id = ?',
            [id],
            function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            }
        );
    });
};

// Price history operations
const savePriceHistory = (coinId, priceData) => {
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO price_history 
            (coinId, price, priceChange, marketCap, volume, timestamp) 
            VALUES (?, ?, ?, ?, ?, ?)`,
            [
                coinId, priceData.price, priceData.priceChange,
                priceData.marketCap, priceData.volume, new Date().toISOString()
            ],
            function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            }
        );
    });
};

const getPriceHistory = (coinId, limit = 100) => {
    return new Promise((resolve, reject) => {
        db.all(
            'SELECT * FROM price_history WHERE coinId = ? ORDER BY timestamp DESC LIMIT ?',
            [coinId, limit],
            (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            }
        );
    });
};

const getPriceHistoryByDateRange = (coinId, startDate, endDate) => {
    return new Promise((resolve, reject) => {
        db.all(
            'SELECT * FROM price_history WHERE coinId = ? AND timestamp BETWEEN ? AND ? ORDER BY timestamp ASC',
            [coinId, startDate, endDate],
            (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            }
        );
    });
};

// Cleanup old price history (keep last 30 days)
const cleanupOldPriceHistory = () => {
    return new Promise((resolve, reject) => {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        
        db.run(
            'DELETE FROM price_history WHERE timestamp < ?',
            [thirtyDaysAgo],
            function(err) {
                if (err) {
                    reject(err);
                } else {
                    console.log(`Cleaned up ${this.changes} old price history records`);
                    resolve(this.changes);
                }
            }
        );
    });
};

// Close database connection
const closeDatabase = () => {
    return new Promise((resolve, reject) => {
        db.close((err) => {
            if (err) {
                reject(err);
            } else {
                console.log('Database connection closed');
                resolve();
            }
        });
    });
};

// ===== EXCHANGE METHODS =====

// Create transaction
const createTransaction = (transaction) => {
    return new Promise((resolve, reject) => {
        console.log(`Saving transaction to database: ${transaction.id} - ${transaction.type} ${transaction.amount} ${transaction.assetId} at $${transaction.price}`);
        
        db.run(
            'INSERT INTO transactions (id, userId, type, assetId, amount, price, usdAmount, commission, timestamp, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                transaction.id,
                transaction.userId,
                transaction.type,
                transaction.assetId,
                transaction.amount,
                transaction.price,
                transaction.usdAmount,
                transaction.commission,
                transaction.timestamp,
                transaction.status
            ],
            function(err) {
                if (err) {
                    console.error('Error saving transaction:', err);
                    reject(err);
                } else {
                    console.log(`Transaction saved successfully: ${transaction.id}`);
                    resolve(this.lastID);
                }
            }
        );
    });
};

// Get user transactions
const getUserTransactions = (userId, limit = 50) => {
    return new Promise((resolve, reject) => {
        db.all(
            'SELECT * FROM transactions WHERE userId = ? ORDER BY timestamp DESC LIMIT ?',
            [userId, limit],
            (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            }
        );
    });
};

// Get user portfolio
const getUserPortfolio = (userId) => {
    return new Promise((resolve, reject) => {
        db.get(
            'SELECT * FROM portfolios WHERE userId = ?',
            [userId],
            (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    if (row) {
                        row.assets = JSON.parse(row.assets);
                    }
                    resolve(row);
                }
            }
        );
    });
};

// Save user portfolio
const saveUserPortfolio = (userId, portfolio) => {
    return new Promise((resolve, reject) => {
        console.log(`Saving portfolio to database: User ${userId}`);
        console.log(`Portfolio data: ${JSON.stringify(portfolio)}`);
        
        db.run(
            'INSERT OR REPLACE INTO portfolios (userId, assets, totalValue, totalInvested, totalProfit, profitPercent, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
                userId,
                JSON.stringify(portfolio.assets),
                portfolio.totalValue,
                portfolio.totalInvested,
                portfolio.totalProfit,
                portfolio.profitPercent,
                new Date().toISOString()
            ],
            function(err) {
                if (err) {
                    console.error('Error saving portfolio:', err);
                    reject(err);
                } else {
                    console.log(`Portfolio saved successfully for user: ${userId}`);
                    resolve(this.lastID);
                }
            }
        );
    });
};

module.exports = {
    initializeDatabase,
    createUser,
    getUserByEmail,
    getUserByUsername,
    getUserById,
    getAllUsers,
    updateUser,
    deleteUser,
    updateUserLastLogin,
    createAccount,
    getAccountByUserId,
    saveCoin,
    getAllCoins,
    getCoinById,
    updateCoin,
    deleteCoin,
    savePriceHistory,
    getPriceHistory,
    getPriceHistoryByDateRange,
    cleanupOldPriceHistory,
    closeDatabase,
    // Exchange methods
    createTransaction,
    getUserTransactions,
    getUserPortfolio,
    saveUserPortfolio,
    createLoggingTables,
    logOperation,
    logUserAction,
    getOperationLogs,
    getUserAuditLogs
};
