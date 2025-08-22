// Логика управления балансом пользователя
class BalanceManager {
    constructor(accountManager) {
        this.accountManager = accountManager;
        this.updateInterval = null;
        this.startAutoUpdate();
    }

    // Получение текущего баланса
    getCurrentBalance() {
        const account = this.accountManager.getCurrentAccount();
        return account ? account.balance : 0;
    }

    // Получение полного баланса (наличные + портфель)
    getTotalBalance() {
        const account = this.accountManager.getCurrentAccount();
        if (!account) return 0;

        const portfolioValue = this.getPortfolioValue();
        return account.balance + portfolioValue;
    }

    // Получение стоимости портфеля
    getPortfolioValue() {
        const portfolio = this.getPortfolio();
        return portfolio.totalValue || 0;
    }

    // Получение портфеля
    getPortfolio() {
        const account = this.accountManager.getCurrentAccount();
        return account ? account.portfolio : { totalValue: 0, totalInvested: 0, totalProfit: 0, profitPercent: 0, assets: {} };
    }

    // Пополнение баланса
    deposit(amount, method = 'card') {
        if (amount <= 0) {
            throw new Error('Сумма должна быть больше 0');
        }

        if (amount > 1000000) {
            throw new Error('Максимальная сумма пополнения: $1,000,000');
        }

        const account = this.accountManager.getCurrentAccount();
        if (!account) {
            throw new Error('Пользователь не авторизован');
        }

        // В реальном приложении здесь была бы интеграция с платежной системой
        account.balance += amount;
        this.accountManager.saveAccount(account);

        // Создаем транзакцию
        this.createTransaction('deposit', null, amount, 1, 0, method);

        return {
            success: true,
            newBalance: account.balance,
            transactionId: Date.now().toString()
        };
    }

    // Вывод средств
    withdraw(amount, method = 'card') {
        if (amount <= 0) {
            throw new Error('Сумма должна быть больше 0');
        }

        const account = this.accountManager.getCurrentAccount();
        if (!account) {
            throw new Error('Пользователь не авторизован');
        }

        if (account.balance < amount) {
            throw new Error('Недостаточно средств на балансе');
        }

        // В реальном приложении здесь была бы интеграция с платежной системой
        account.balance -= amount;
        this.accountManager.saveAccount(account);

        // Создаем транзакцию
        this.createTransaction('withdraw', null, amount, 1, 0, method);

        return {
            success: true,
            newBalance: account.balance,
            transactionId: Date.now().toString()
        };
    }

    // Покупка актива
    buyAsset(assetId, usdAmount) {
        if (usdAmount < 1) {
            throw new Error('Минимальная сумма покупки: $1');
        }

        if (usdAmount > 1000000) {
            throw new Error('Максимальная сумма покупки: $1,000,000');
        }

        const account = this.accountManager.getCurrentAccount();
        if (!account) {
            throw new Error('Пользователь не авторизован');
        }

        // Получаем текущую цену актива
        const asset = this.getAssetPrice(assetId);
        if (!asset) {
            throw new Error('Актив не найден');
        }

        const commission = usdAmount * 0.0025; // 0.25% комиссия
        const totalCost = usdAmount + commission;

        if (account.balance < totalCost) {
            throw new Error('Недостаточно средств на балансе');
        }

        const cryptoAmount = (usdAmount - commission) / asset.price;

        // Списываем средства
        account.balance -= totalCost;
        this.accountManager.saveAccount(account);

        // Добавляем актив в портфель
        this.addAssetToPortfolio(assetId, cryptoAmount, asset.price);

        // Создаем транзакцию
        this.createTransaction('buy', assetId, cryptoAmount, asset.price, commission);

        return {
            success: true,
            cryptoAmount: cryptoAmount,
            commission: commission,
            totalCost: totalCost,
            newBalance: account.balance,
            transactionId: Date.now().toString()
        };
    }

    // Продажа актива
    sellAsset(assetId, cryptoAmount) {
        if (cryptoAmount <= 0) {
            throw new Error('Количество должно быть больше 0');
        }

        const account = this.accountManager.getCurrentAccount();
        if (!account) {
            throw new Error('Пользователь не авторизован');
        }

        // Проверяем наличие актива в портфеле
        const portfolio = this.getPortfolio();
        const assetInPortfolio = portfolio.assets[assetId];
        
        if (!assetInPortfolio || assetInPortfolio.balance < cryptoAmount) {
            throw new Error('Недостаточно активов для продажи');
        }

        // Получаем текущую цену актива
        const asset = this.getAssetPrice(assetId);
        if (!asset) {
            throw new Error('Актив не найден');
        }

        const usdValue = cryptoAmount * asset.price;
        const commission = usdValue * 0.0025; // 0.25% комиссия
        const netUsdValue = usdValue - commission;

        // Удаляем актив из портфеля
        this.removeAssetFromPortfolio(assetId, cryptoAmount, asset.price);

        // Добавляем средства на баланс
        account.balance += netUsdValue;
        this.accountManager.saveAccount(account);

        // Создаем транзакцию
        this.createTransaction('sell', assetId, cryptoAmount, asset.price, commission);

        return {
            success: true,
            usdValue: usdValue,
            commission: commission,
            netUsdValue: netUsdValue,
            newBalance: account.balance,
            transactionId: Date.now().toString()
        };
    }

    // Добавление актива в портфель
    addAssetToPortfolio(assetId, amount, price) {
        const account = this.accountManager.getCurrentAccount();
        if (!account) return false;

        if (!account.portfolio.assets[assetId]) {
            account.portfolio.assets[assetId] = {
                balance: 0,
                averagePrice: 0,
                totalInvested: 0,
                firstBought: Date.now()
            };
        }

        const asset = account.portfolio.assets[assetId];
        const totalCost = amount * price;
        const newTotalInvested = asset.totalInvested + totalCost;
        const newBalance = asset.balance + amount;

        // Пересчитываем среднюю цену
        asset.averagePrice = newTotalInvested / newBalance;
        asset.balance = newBalance;
        asset.totalInvested = newTotalInvested;

        this.updatePortfolioValue();
        this.accountManager.saveAccount(account);
        return true;
    }

    // Удаление актива из портфеля
    removeAssetFromPortfolio(assetId, amount, price) {
        const account = this.accountManager.getCurrentAccount();
        if (!account) return false;

        const asset = account.portfolio.assets[assetId];
        if (!asset || asset.balance < amount) return false;

        asset.balance -= amount;
        asset.totalInvested = asset.averagePrice * asset.balance;

        if (asset.balance <= 0) {
            delete account.portfolio.assets[assetId];
        }

        this.updatePortfolioValue();
        this.accountManager.saveAccount(account);
        return true;
    }

    // Обновление стоимости портфеля
    updatePortfolioValue() {
        const account = this.accountManager.getCurrentAccount();
        if (!account) return;

        let totalValue = 0;
        let totalInvested = 0;

        for (const [assetId, asset] of Object.entries(account.portfolio.assets)) {
            const currentPrice = this.getAssetPrice(assetId);
            if (currentPrice) {
                const currentValue = asset.balance * currentPrice.price;
                totalValue += currentValue;
                totalInvested += asset.totalInvested;
            }
        }

        account.portfolio.totalValue = totalValue;
        account.portfolio.totalInvested = totalInvested;
        account.portfolio.totalProfit = totalValue - totalInvested;
        account.portfolio.profitPercent = totalInvested > 0 ? (account.portfolio.totalProfit / totalInvested) * 100 : 0;

        this.accountManager.saveAccount(account);
    }

    // Получение цены актива (симуляция API)
    getAssetPrice(assetId) {
        // В реальном приложении здесь был бы запрос к API
        const prices = {
            'bitcoin': { price: 43250, change: 2.4 },
            'ethereum': { price: 4842, change: 14.16 },
            'solana': { price: 198, change: 9.80 },
            'cardano': { price: 0.45, change: -1.2 },
            'polkadot': { price: 6.5, change: 3.1 },
            'chainlink': { price: 15.2, change: 5.7 },
            'litecoin': { price: 122, change: 6.59 },
            'bitcoin-cash': { price: 245, change: -0.8 },
            'stellar': { price: 0.12, change: 1.5 },
            'monero': { price: 165, change: 2.3 }
        };

        return prices[assetId] || null;
    }

    // Создание транзакции
    createTransaction(type, assetId, amount, price, fee, method = null) {
        const transaction = {
            id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            type: type,
            assetId: assetId,
            amount: amount,
            price: price,
            fee: fee,
            totalValue: amount * price,
            method: method,
            timestamp: Date.now(),
            status: 'completed'
        };

        // Сохраняем транзакцию
        const transactions = JSON.parse(localStorage.getItem('userTransactions') || '[]');
        transactions.unshift(transaction);
        localStorage.setItem('userTransactions', JSON.stringify(transactions));

        return transaction;
    }

    // Получение истории транзакций
    getTransactionHistory(limit = 50) {
        const transactions = JSON.parse(localStorage.getItem('userTransactions') || '[]');
        return transactions.slice(0, limit);
    }

    // Получение статистики баланса
    getBalanceStats() {
        const account = this.accountManager.getCurrentAccount();
        if (!account) return null;

        const portfolio = this.getPortfolio();
        const totalBalance = this.getTotalBalance();

        return {
            cashBalance: account.balance,
            portfolioValue: portfolio.totalValue,
            totalBalance: totalBalance,
            totalInvested: portfolio.totalInvested,
            totalProfit: portfolio.totalProfit,
            profitPercent: portfolio.profitPercent,
            profitToday: this.calculateDailyProfit(),
            profitWeek: this.calculateWeeklyProfit(),
            profitMonth: this.calculateMonthlyProfit()
        };
    }

    // Расчет дневной прибыли
    calculateDailyProfit() {
        // В реальном приложении здесь был бы расчет на основе исторических данных
        const portfolio = this.getPortfolio();
        return portfolio.totalProfit * 0.01; // Симуляция
    }

    // Расчет недельной прибыли
    calculateWeeklyProfit() {
        const portfolio = this.getPortfolio();
        return portfolio.totalProfit * 0.05; // Симуляция
    }

    // Расчет месячной прибыли
    calculateMonthlyProfit() {
        const portfolio = this.getPortfolio();
        return portfolio.totalProfit * 0.15; // Симуляция
    }

    // Получение доступных методов пополнения
    getDepositMethods() {
        return [
            { id: 'card', name: 'Банковская карта', icon: 'fas fa-credit-card', fee: 0 },
            { id: 'bank', name: 'Банковский перевод', icon: 'fas fa-university', fee: 0 },
            { id: 'crypto', name: 'Криптовалюта', icon: 'fab fa-bitcoin', fee: 0 }
        ];
    }

    // Получение доступных методов вывода
    getWithdrawMethods() {
        return [
            { id: 'card', name: 'Банковская карта', icon: 'fas fa-credit-card', fee: 0.01 },
            { id: 'bank', name: 'Банковский перевод', icon: 'fas fa-university', fee: 0.005 },
            { id: 'crypto', name: 'Криптовалюта', icon: 'fab fa-bitcoin', fee: 0.001 }
        ];
    }

    // Проверка лимитов
    checkLimits(amount, type) {
        const limits = {
            deposit: { min: 1, max: 1000000 },
            withdraw: { min: 10, max: 100000 },
            buy: { min: 1, max: 1000000 },
            sell: { min: 0.00000001, max: 1000000 }
        };

        const limit = limits[type];
        if (!limit) return { valid: true };

        return {
            valid: amount >= limit.min && amount <= limit.max,
            min: limit.min,
            max: limit.max
        };
    }

    // Запуск автоматического обновления
    startAutoUpdate() {
        this.updateInterval = setInterval(() => {
            this.updatePortfolioValue();
        }, 30000); // Обновляем каждые 30 секунд
    }

    // Остановка автоматического обновления
    stopAutoUpdate() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    // Форматирование валюты
    formatCurrency(amount, currency = 'USD') {
        if (currency === 'USD') {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(amount);
        }
        return amount.toFixed(2);
    }

    // Форматирование криптовалюты
    formatCrypto(amount, decimals = 8) {
        return amount.toFixed(decimals);
    }
}

// Создание глобального экземпляра
window.balanceManager = new BalanceManager(window.accountManager);
