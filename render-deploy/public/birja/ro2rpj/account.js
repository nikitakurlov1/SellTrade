// Логика управления аккаунтом пользователя
class AccountManager {
    constructor() {
        this.currentAccount = this.loadAccount();
        this.isAuthenticated = !!this.currentAccount;
    }

    // Создание нового аккаунта
    createAccount(name, email, password) {
        const account = {
            id: this.generateId(),
            name: name,
            email: email,
            password: this.hashPassword(password), // В реальном приложении - хеширование
            balance: 0,
            createdAt: Date.now(),
            lastLogin: Date.now(),
            isNew: true,
            settings: {
                notifications: true,
                twoFactorAuth: false,
                language: 'ru',
                theme: 'dark',
                currency: 'USD'
            },
            portfolio: {
                totalValue: 0,
                totalInvested: 0,
                totalProfit: 0,
                profitPercent: 0,
                assets: {}
            },
            statistics: {
                totalTrades: 0,
                totalVolume: 0,
                averageTrade: 0,
                winRate: 0,
                totalProfit: 0
            }
        };

        this.saveAccount(account);
        this.currentAccount = account;
        this.isAuthenticated = true;
        
        return account;
    }

    // Авторизация пользователя
    login(email, password) {
        const account = this.loadAccount();
        
        if (!account) {
            throw new Error('Аккаунт не найден');
        }

        if (account.email !== email || account.password !== this.hashPassword(password)) {
            throw new Error('Неверный email или пароль');
        }

        account.lastLogin = Date.now();
        this.saveAccount(account);
        this.currentAccount = account;
        this.isAuthenticated = true;

        return account;
    }

    // Выход из аккаунта
    logout() {
        this.currentAccount = null;
        this.isAuthenticated = false;
        localStorage.removeItem('currentUser');
    }

    // Обновление профиля
    updateProfile(updates) {
        if (!this.currentAccount) {
            throw new Error('Пользователь не авторизован');
        }

        Object.assign(this.currentAccount, updates);
        this.saveAccount(this.currentAccount);
    }

    // Обновление настроек
    updateSettings(settings) {
        if (!this.currentAccount) {
            throw new Error('Пользователь не авторизован');
        }

        Object.assign(this.currentAccount.settings, settings);
        this.saveAccount(this.currentAccount);
    }

    // Получение статистики аккаунта
    getAccountStats() {
        if (!this.currentAccount) return null;

        const account = this.currentAccount;
        const daysSinceCreation = Math.floor((Date.now() - account.createdAt) / (1000 * 60 * 60 * 24));
        
        return {
            accountAge: daysSinceCreation,
            totalBalance: account.balance + account.portfolio.totalValue,
            portfolioValue: account.portfolio.totalValue,
            totalProfit: account.portfolio.totalProfit,
            profitPercent: account.portfolio.profitPercent,
            totalTrades: account.statistics.totalTrades,
            winRate: account.statistics.winRate,
            averageTrade: account.statistics.averageTrade
        };
    }

    // Проверка, является ли аккаунт новым
    isNewAccount() {
        return this.currentAccount && this.currentAccount.isNew;
    }

    // Отметить аккаунт как не новый
    markAsNotNew() {
        if (this.currentAccount) {
            this.currentAccount.isNew = false;
            this.saveAccount(this.currentAccount);
        }
    }

    // Генерация ID
    generateId() {
        return 'acc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Простое хеширование пароля (в реальном приложении использовать bcrypt)
    hashPassword(password) {
        return btoa(password); // Base64 кодирование для демо
    }

    // Сохранение аккаунта
    saveAccount(account) {
        localStorage.setItem('currentUser', JSON.stringify(account));
    }

    // Загрузка аккаунта
    loadAccount() {
        const saved = localStorage.getItem('currentUser');
        return saved ? JSON.parse(saved) : null;
    }

    // Получение текущего аккаунта
    getCurrentAccount() {
        return this.currentAccount;
    }

    // Проверка авторизации
    isUserAuthenticated() {
        return this.isAuthenticated && !!this.currentAccount;
    }

    // Обновление баланса
    updateBalance(newBalance) {
        if (!this.currentAccount) return false;
        
        this.currentAccount.balance = newBalance;
        this.saveAccount(this.currentAccount);
        return true;
    }

    // Получение баланса
    getBalance() {
        return this.currentAccount ? this.currentAccount.balance : 0;
    }

    // Добавление средств
    addFunds(amount) {
        if (!this.currentAccount) return false;
        
        this.currentAccount.balance += amount;
        this.saveAccount(this.currentAccount);
        return true;
    }

    // Снятие средств
    withdrawFunds(amount) {
        if (!this.currentAccount || this.currentAccount.balance < amount) {
            return false;
        }
        
        this.currentAccount.balance -= amount;
        this.saveAccount(this.currentAccount);
        return true;
    }

    // Обновление статистики портфеля
    updatePortfolioStats(portfolioData) {
        if (!this.currentAccount) return false;
        
        Object.assign(this.currentAccount.portfolio, portfolioData);
        this.saveAccount(this.currentAccount);
        return true;
    }

    // Обновление торговой статистики
    updateTradeStats(tradeData) {
        if (!this.currentAccount) return false;
        
        const stats = this.currentAccount.statistics;
        stats.totalTrades += 1;
        stats.totalVolume += tradeData.volume || 0;
        stats.averageTrade = stats.totalVolume / stats.totalTrades;
        
        if (tradeData.profit > 0) {
            stats.winRate = ((stats.winRate * (stats.totalTrades - 1)) + 1) / stats.totalTrades;
        } else {
            stats.winRate = (stats.winRate * (stats.totalTrades - 1)) / stats.totalTrades;
        }
        
        stats.totalProfit += tradeData.profit || 0;
        
        this.saveAccount(this.currentAccount);
        return true;
    }

    // Получение истории входов
    getLoginHistory() {
        return this.currentAccount ? [{
            timestamp: this.currentAccount.lastLogin,
            ip: '127.0.0.1', // В реальном приложении получать IP
            device: navigator.userAgent
        }] : [];
    }

    // Изменение пароля
    changePassword(currentPassword, newPassword) {
        if (!this.currentAccount) {
            throw new Error('Пользователь не авторизован');
        }

        if (this.currentAccount.password !== this.hashPassword(currentPassword)) {
            throw new Error('Неверный текущий пароль');
        }

        this.currentAccount.password = this.hashPassword(newPassword);
        this.saveAccount(this.currentAccount);
    }

    // Удаление аккаунта
    deleteAccount(password) {
        if (!this.currentAccount) {
            throw new Error('Пользователь не авторизован');
        }

        if (this.currentAccount.password !== this.hashPassword(password)) {
            throw new Error('Неверный пароль');
        }

        localStorage.removeItem('currentUser');
        localStorage.removeItem('userPortfolio');
        localStorage.removeItem('userTransactions');
        localStorage.removeItem('userAssets');
        
        this.currentAccount = null;
        this.isAuthenticated = false;
    }

    // Экспорт данных аккаунта
    exportAccountData() {
        if (!this.currentAccount) return null;

        return {
            account: this.currentAccount,
            portfolio: JSON.parse(localStorage.getItem('userPortfolio') || '{}'),
            transactions: JSON.parse(localStorage.getItem('userTransactions') || '[]'),
            assets: JSON.parse(localStorage.getItem('userAssets') || '{}'),
            exportDate: new Date().toISOString()
        };
    }

    // Импорт данных аккаунта
    importAccountData(data) {
        try {
            if (data.account) {
                this.saveAccount(data.account);
                this.currentAccount = data.account;
                this.isAuthenticated = true;
            }

            if (data.portfolio) {
                localStorage.setItem('userPortfolio', JSON.stringify(data.portfolio));
            }

            if (data.transactions) {
                localStorage.setItem('userTransactions', JSON.stringify(data.transactions));
            }

            if (data.assets) {
                localStorage.setItem('userAssets', JSON.stringify(data.assets));
            }

            return true;
        } catch (error) {
            console.error('Ошибка импорта данных:', error);
            return false;
        }
    }
}

// Создание глобального экземпляра
window.accountManager = new AccountManager();
