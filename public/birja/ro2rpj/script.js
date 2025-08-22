// Глобальные переменные и конфигурация
const APP_CONFIG = {
    DEFAULT_BALANCE: 0,
    DEFAULT_ASSETS: [],
    COMMISSION_RATE: 0.0025, // 0.25%
    MIN_TRADE_AMOUNT: 1,
    MAX_TRADE_AMOUNT: 1000000,
    PRICE_UPDATE_INTERVAL: 5000,
    BALANCE_UPDATE_INTERVAL: 10000
};

// Структура данных для аккаунта
class Account {
    constructor() {
        this.id = this.generateId();
        this.name = 'Пользователь';
        this.email = 'user@example.com';
        this.balance = APP_CONFIG.DEFAULT_BALANCE;
        this.createdAt = Date.now();
        this.lastLogin = Date.now();
        this.isNew = true;
        this.settings = {
            notifications: true,
            twoFactorAuth: false,
            language: 'ru',
            theme: 'dark'
        };
    }

    generateId() {
        return 'acc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    updateLastLogin() {
        this.lastLogin = Date.now();
        this.save();
    }

    save() {
        localStorage.setItem('currentUser', JSON.stringify(this));
    }

    static load() {
        const saved = localStorage.getItem('currentUser');
        if (saved) {
            const account = Object.assign(new Account(), JSON.parse(saved));
            account.isNew = false;
            return account;
        }
        return new Account();
    }
}

// Структура данных для активов
class Asset {
    constructor(id, name, symbol, icon, color, price = 0) {
        this.id = id;
        this.name = name;
        this.symbol = symbol;
        this.icon = icon;
        this.color = color;
        this.price = price;
        this.change = 0;
        this.changePercent = 0;
        this.volume24h = 0;
        this.marketCap = 0;
        this.high24h = price;
        this.low24h = price;
        this.lastUpdated = Date.now();
    }

    updatePrice(newPrice) {
        const oldPrice = this.price;
        this.price = newPrice;
        this.change = newPrice - oldPrice;
        this.changePercent = oldPrice > 0 ? ((newPrice - oldPrice) / oldPrice) * 100 : 0;
        this.lastUpdated = Date.now();
        
        // Обновляем 24ч максимум/минимум
        if (newPrice > this.high24h) this.high24h = newPrice;
        if (newPrice < this.low24h) this.low24h = newPrice;
    }

    getFormattedPrice() {
        if (this.price >= 1000) {
            return this.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        } else if (this.price >= 1) {
            return this.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 3 });
        } else {
            return this.price.toLocaleString('en-US', { minimumFractionDigits: 5, maximumFractionDigits: 5 });
        }
    }
}

// Структура данных для портфеля
class Portfolio {
    constructor() {
        this.assets = new Map(); // assetId -> { balance, averagePrice, totalInvested }
        this.totalValue = 0;
        this.totalInvested = 0;
        this.totalProfit = 0;
        this.profitPercent = 0;
        this.lastUpdated = Date.now();
    }

    addAsset(assetId, amount, price) {
        if (!this.assets.has(assetId)) {
            this.assets.set(assetId, {
                balance: 0,
                averagePrice: 0,
                totalInvested: 0,
                firstBought: Date.now()
            });
        }

        const asset = this.assets.get(assetId);
        const totalCost = amount * price;
        const newTotalInvested = asset.totalInvested + totalCost;
        const newBalance = asset.balance + amount;

        // Пересчитываем среднюю цену
        asset.averagePrice = newTotalInvested / newBalance;
        asset.balance = newBalance;
        asset.totalInvested = newTotalInvested;

        this.updateTotalValue();
    }

    removeAsset(assetId, amount, price) {
        if (!this.assets.has(assetId)) return false;

        const asset = this.assets.get(assetId);
        if (asset.balance < amount) return false;

        asset.balance -= amount;
        asset.totalInvested = asset.averagePrice * asset.balance;

        if (asset.balance <= 0) {
            this.assets.delete(assetId);
        }

        this.updateTotalValue();
        return true;
    }

    updateTotalValue() {
        this.totalValue = 0;
        this.totalInvested = 0;

        for (const [assetId, asset] of this.assets) {
            const currentAsset = getAssetById(assetId);
            if (currentAsset) {
                const currentValue = asset.balance * currentAsset.price;
                this.totalValue += currentValue;
                this.totalInvested += asset.totalInvested;
            }
        }

        this.totalProfit = this.totalValue - this.totalInvested;
        this.profitPercent = this.totalInvested > 0 ? (this.totalProfit / this.totalInvested) * 100 : 0;
        this.lastUpdated = Date.now();
    }

    getAssetValue(assetId) {
        const asset = this.assets.get(assetId);
        const currentAsset = getAssetById(assetId);
        if (!asset || !currentAsset) return 0;
        return asset.balance * currentAsset.price;
    }

    getAssetProfit(assetId) {
        const asset = this.assets.get(assetId);
        const currentAsset = getAssetById(assetId);
        if (!asset || !currentAsset) return { profit: 0, percent: 0 };

        const currentValue = asset.balance * currentAsset.price;
        const profit = currentValue - asset.totalInvested;
        const percent = asset.totalInvested > 0 ? (profit / asset.totalInvested) * 100 : 0;

        return { profit, percent };
    }

    save() {
        localStorage.setItem('userPortfolio', JSON.stringify(Array.from(this.assets.entries())));
    }

    static load() {
        const saved = localStorage.getItem('userPortfolio');
        const portfolio = new Portfolio();
        if (saved) {
            const assetsArray = JSON.parse(saved);
            portfolio.assets = new Map(assetsArray);
            portfolio.updateTotalValue();
        }
        return portfolio;
    }
}

// Структура данных для транзакций
class Transaction {
    constructor(type, assetId, amount, price, fee = 0) {
        this.id = this.generateId();
        this.type = type; // 'buy', 'sell', 'deposit', 'withdraw'
        this.assetId = assetId;
        this.amount = amount; // количество криптовалюты
        this.price = price; // цена за единицу
        this.fee = fee; // комиссия
        this.totalValue = amount * price; // общая стоимость
        this.timestamp = Date.now();
        this.status = 'completed';
        this.description = this.generateDescription();
    }

    generateId() {
        return 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    generateDescription() {
        const asset = getAssetById(this.assetId);
        const assetName = asset ? asset.name : this.assetId;
        
        switch (this.type) {
            case 'buy': return `Покупка ${assetName}`;
            case 'sell': return `Продажа ${assetName}`;
            case 'deposit': return 'Пополнение баланса';
            case 'withdraw': return 'Вывод средств';
            default: return 'Операция';
        }
    }

    getFormattedAmount() {
        if (this.type === 'deposit' || this.type === 'withdraw') {
            return `$${this.totalValue.toFixed(2)}`;
        } else {
            return `${this.amount.toFixed(8)} ${getAssetById(this.assetId)?.symbol || ''}`;
        }
    }

    getFormattedValue() {
        return `$${this.totalValue.toFixed(2)}`;
    }
}

// Менеджер транзакций
class TransactionManager {
    constructor() {
        this.transactions = [];
        this.load();
    }

    addTransaction(transaction) {
        this.transactions.unshift(transaction);
        this.save();
        this.updateStats();
    }

    getTransactions(filter = 'all', limit = 50) {
        let filtered = this.transactions;
        
        if (filter !== 'all') {
            filtered = this.transactions.filter(tx => tx.type === filter);
        }

        return filtered.slice(0, limit);
    }

    getStats() {
        const totalTransactions = this.transactions.length;
        const totalVolume = this.transactions.reduce((sum, tx) => sum + tx.totalValue, 0);
        const avgTransaction = totalTransactions > 0 ? totalVolume / totalTransactions : 0;

        const typeStats = {};
        this.transactions.forEach(tx => {
            if (!typeStats[tx.type]) typeStats[tx.type] = 0;
            typeStats[tx.type]++;
        });

        return {
            totalTransactions,
            totalVolume,
            avgTransaction,
            typeStats
        };
    }

    updateStats() {
        // Обновляем статистику в реальном времени
        const stats = this.getStats();
        // Здесь можно добавить обновление UI статистики
    }

    save() {
        localStorage.setItem('userTransactions', JSON.stringify(this.transactions));
    }

    load() {
        const saved = localStorage.getItem('userTransactions');
        if (saved) {
            this.transactions = JSON.parse(saved);
        }
    }

    exportTransactions() {
        const data = this.transactions.map(tx => ({
            id: tx.id,
            type: tx.type,
            description: tx.description,
            amount: tx.getFormattedAmount(),
            value: tx.getFormattedValue(),
            date: new Date(tx.timestamp).toLocaleString('ru-RU')
        }));

        return JSON.stringify(data, null, 2);
    }
}

// Менеджер баланса
class BalanceManager {
    constructor(account) {
        this.account = account;
        this.portfolio = Portfolio.load();
    }

    deposit(amount) {
        if (amount <= 0) throw new Error('Сумма должна быть больше 0');
        
        this.account.balance += amount;
        this.account.save();

        const transaction = new Transaction('deposit', null, amount, 1);
        transactionManager.addTransaction(transaction);

        return true;
    }

    withdraw(amount) {
        if (amount <= 0) throw new Error('Сумма должна быть больше 0');
        if (amount > this.account.balance) throw new Error('Недостаточно средств');

        this.account.balance -= amount;
        this.account.save();

        const transaction = new Transaction('withdraw', null, amount, 1);
        transactionManager.addTransaction(transaction);

        return true;
    }

    buyAsset(assetId, usdAmount) {
        const asset = getAssetById(assetId);
        if (!asset) throw new Error('Актив не найден');

        if (usdAmount < APP_CONFIG.MIN_TRADE_AMOUNT) {
            throw new Error(`Минимальная сумма: $${APP_CONFIG.MIN_TRADE_AMOUNT}`);
        }

        if (usdAmount > APP_CONFIG.MAX_TRADE_AMOUNT) {
            throw new Error(`Максимальная сумма: $${APP_CONFIG.MAX_TRADE_AMOUNT}`);
        }

        const fee = usdAmount * APP_CONFIG.COMMISSION_RATE;
        const totalCost = usdAmount + fee;

        if (totalCost > this.account.balance) {
            throw new Error('Недостаточно средств');
        }

        const cryptoAmount = (usdAmount - fee) / asset.price;

        // Выполняем покупку
        this.account.balance -= totalCost;
        this.portfolio.addAsset(assetId, cryptoAmount, asset.price);
        
        this.account.save();
        this.portfolio.save();

        // Создаем транзакцию
        const transaction = new Transaction('buy', assetId, cryptoAmount, asset.price, fee);
        transactionManager.addTransaction(transaction);

        return {
            cryptoAmount,
            fee,
            totalCost
        };
    }

    sellAsset(assetId, cryptoAmount) {
        const asset = getAssetById(assetId);
        if (!asset) throw new Error('Актив не найден');

        const portfolioAsset = this.portfolio.assets.get(assetId);
        if (!portfolioAsset || portfolioAsset.balance < cryptoAmount) {
            throw new Error('Недостаточно активов для продажи');
        }

        const usdValue = cryptoAmount * asset.price;
        const fee = usdValue * APP_CONFIG.COMMISSION_RATE;
        const netUsdValue = usdValue - fee;

        // Выполняем продажу
        this.portfolio.removeAsset(assetId, cryptoAmount, asset.price);
        this.account.balance += netUsdValue;
        
        this.account.save();
        this.portfolio.save();

        // Создаем транзакцию
        const transaction = new Transaction('sell', assetId, cryptoAmount, asset.price, fee);
        transactionManager.addTransaction(transaction);

        return {
            usdValue,
            fee,
            netUsdValue
        };
    }

    getTotalBalance() {
        return this.account.balance + this.portfolio.totalValue;
    }

    getBalanceBreakdown() {
        return {
            cash: this.account.balance,
            portfolio: this.portfolio.totalValue,
            total: this.getTotalBalance()
        };
    }
}

// Менеджер активов (симуляция бэкенда)
class AssetManager {
    constructor() {
        this.assets = new Map();
        this.initializeAssets();
        this.startPriceUpdates();
    }

    initializeAssets() {
        const defaultAssets = [
            new Asset('bitcoin', 'Bitcoin', 'BTC', 'fab fa-bitcoin', '#f7931a', 43250),
            new Asset('ethereum', 'Ethereum', 'ETH', 'fab fa-ethereum', '#627eea', 4842),
            new Asset('solana', 'Solana', 'SOL', 'fas fa-bolt', '#9945ff', 198),
            new Asset('cardano', 'Cardano', 'ADA', 'fas fa-chart-line', '#0033ad', 0.45),
            new Asset('polkadot', 'Polkadot', 'DOT', 'fas fa-dot-circle', '#e6007a', 6.5),
            new Asset('chainlink', 'Chainlink', 'LINK', 'fas fa-link', '#2a5ada', 15.2),
            new Asset('litecoin', 'Litecoin', 'LTC', 'fab fa-litecoin', '#a6a9aa', 122),
            new Asset('bitcoin-cash', 'Bitcoin Cash', 'BCH', 'fab fa-bitcoin', '#0ac18e', 245),
            new Asset('stellar', 'Stellar', 'XLM', 'fas fa-star', '#000000', 0.12),
            new Asset('monero', 'Monero', 'XMR', 'fas fa-coins', '#ff6600', 165)
        ];

        defaultAssets.forEach(asset => {
            this.assets.set(asset.id, asset);
        });
    }

    startPriceUpdates() {
        setInterval(() => {
            this.updateAllPrices();
        }, APP_CONFIG.PRICE_UPDATE_INTERVAL);
    }

    updateAllPrices() {
        for (const asset of this.assets.values()) {
            this.updateAssetPrice(asset.id);
        }
    }

    updateAssetPrice(assetId) {
        const asset = this.assets.get(assetId);
        if (!asset) return;

        // Симуляция изменения цены (в реальном приложении здесь будет API)
        const volatility = 0.02; // 2% волатильность
        const change = (Math.random() - 0.5) * volatility;
        const newPrice = asset.price * (1 + change);
        
        asset.updatePrice(newPrice);
        
        // Обновляем объем торгов
        asset.volume24h = asset.price * (Math.random() * 1000000 + 100000);
        asset.marketCap = asset.price * (Math.random() * 100000000 + 10000000);
    }

    getAsset(assetId) {
        return this.assets.get(assetId);
    }

    getAllAssets() {
        return Array.from(this.assets.values());
    }

    getTopAssets(limit = 10) {
        return this.getAllAssets()
            .sort((a, b) => b.volume24h - a.volume24h)
            .slice(0, limit);
    }

    getAssetsByChange(positive = true) {
        return this.getAllAssets()
            .filter(asset => positive ? asset.changePercent > 0 : asset.changePercent < 0)
            .sort((a, b) => positive ? b.changePercent - a.changePercent : a.changePercent - b.changePercent);
    }
}

// Глобальные экземпляры
let currentAccount = Account.load();
let assetManager = new AssetManager();
let transactionManager = new TransactionManager();
let balanceManager = new BalanceManager(currentAccount);

// Вспомогательные функции
function getAssetById(assetId) {
    return assetManager.getAsset(assetId);
}

function getAllAssets() {
    return assetManager.getAllAssets();
}

function getTopAssets(limit = 10) {
    return assetManager.getTopAssets(limit);
}

function formatCurrency(amount) {
    if (amount >= 1000000) {
        return (amount / 1000000).toFixed(2) + 'M';
    } else if (amount >= 1000) {
        return (amount / 1000).toFixed(2) + 'K';
    } else {
        return amount.toFixed(2);
    }
}

function formatNumber(num, decimals = 2) {
    return num.toLocaleString('en-US', { 
        minimumFractionDigits: decimals, 
        maximumFractionDigits: decimals 
    });
}

// Функции для работы с UI
function updateBalanceDisplay() {
    const balance = balanceManager.getBalanceBreakdown();
    
    // Обновляем отображение баланса на всех страницах
    const balanceElements = document.querySelectorAll('.balance-amount, #totalBalance, #userBalance');
    balanceElements.forEach(element => {
        if (element.id === 'userBalance') {
            element.textContent = `$${formatNumber(balance.cash)}`;
        } else {
            element.textContent = `$${formatNumber(balance.total)}`;
        }
    });

    // Обновляем статистику портфеля
    const portfolioElements = document.querySelectorAll('#portfolioValue, #portfolioProfit');
    portfolioElements.forEach(element => {
        if (element.id === 'portfolioValue') {
            element.textContent = `$${formatNumber(balance.portfolio)}`;
        } else if (element.id === 'portfolioProfit') {
            const profit = balanceManager.portfolio.totalProfit;
            const profitPercent = balanceManager.portfolio.profitPercent;
            element.textContent = `${profit >= 0 ? '+' : ''}$${formatNumber(profit)} (${profitPercent >= 0 ? '+' : ''}${profitPercent.toFixed(2)}%)`;
            element.className = profit >= 0 ? 'positive' : 'negative';
        }
    });
}

function updatePortfolioDisplay() {
    const portfolio = balanceManager.portfolio;
    const container = document.getElementById('portfolioAssets');
    
    if (!container) return;

    if (portfolio.assets.size === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-briefcase"></i>
                <p>Портфель пуст</p>
                <p>Начните с покупки активов</p>
            </div>
        `;
        return;
    }

    const assetsHtml = Array.from(portfolio.assets.entries()).map(([assetId, asset]) => {
        const currentAsset = getAssetById(assetId);
        if (!currentAsset) return '';

        const currentValue = asset.balance * currentAsset.price;
        const profit = currentValue - asset.totalInvested;
        const profitPercent = asset.totalInvested > 0 ? (profit / asset.totalInvested) * 100 : 0;

        return `
            <div class="portfolio-item" onclick="openAssetDetails('${assetId}')">
                <div class="asset-info">
                    <div class="asset-icon" style="background: ${currentAsset.color}">
                        <i class="${currentAsset.icon}"></i>
                    </div>
                    <div class="asset-details">
                        <div class="asset-name">${currentAsset.name}</div>
                        <div class="asset-balance">${asset.balance.toFixed(8)} ${currentAsset.symbol}</div>
                    </div>
                </div>
                <div class="asset-values">
                    <div class="asset-value">$${formatNumber(currentValue)}</div>
                    <div class="asset-profit ${profit >= 0 ? 'positive' : 'negative'}">
                        ${profit >= 0 ? '+' : ''}$${formatNumber(profit)} (${profitPercent >= 0 ? '+' : ''}${profitPercent.toFixed(2)}%)
                    </div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = assetsHtml;
}

function updateTransactionsDisplay() {
    const transactions = transactionManager.getTransactions('all', 10);
    const container = document.getElementById('recentTransactions');
    
    if (!container) return;

    if (transactions.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-history"></i>
                <p>История транзакций пуста</p>
            </div>
        `;
        return;
    }

    const transactionsHtml = transactions.map(tx => {
        const icon = tx.type === 'buy' ? 'fa-arrow-down' : 
                   tx.type === 'sell' ? 'fa-arrow-up' : 
                   tx.type === 'deposit' ? 'fa-plus' : 'fa-minus';
        
        const color = tx.type === 'buy' || tx.type === 'deposit' ? 'positive' : 'negative';
        const amount = tx.type === 'deposit' || tx.type === 'withdraw' ? 
                      `$${formatNumber(tx.totalValue)}` : 
                      `${tx.amount.toFixed(8)} ${getAssetById(tx.assetId)?.symbol || ''}`;

        return `
            <div class="transaction-item">
                <div class="transaction-info">
                    <div class="transaction-icon ${color}">
                        <i class="fas ${icon}"></i>
                    </div>
                    <div class="transaction-details">
                        <div class="transaction-type">${tx.description}</div>
                        <div class="transaction-date">${new Date(tx.timestamp).toLocaleDateString('ru-RU')}</div>
                    </div>
                </div>
                <div class="transaction-amount ${color}">
                    ${tx.type === 'buy' || tx.type === 'withdraw' ? '-' : '+'}${amount}
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = transactionsHtml;
}

// Инициализация приложения
function initializeApp() {
    // Обновляем отображение
    updateBalanceDisplay();
    updatePortfolioDisplay();
    updateTransactionsDisplay();

    // Инициализируем все обработчики кнопок
    initializeAllButtonHandlers();

    // Запускаем периодические обновления
    setInterval(() => {
        updateBalanceDisplay();
        updatePortfolioDisplay();
    }, APP_CONFIG.BALANCE_UPDATE_INTERVAL);
}

// Инициализация всех обработчиков кнопок
function initializeAllButtonHandlers() {
    // Обработчики навигации
    initializeNavigationHandlers();
    
    // Обработчики действий
    initializeActionHandlers();
    
    // Обработчики форм
    initializeFormHandlers();
    
    // Обработчики модальных окон
    initializeModalHandlers();
    
    // Обработчики фильтров
    initializeFilterHandlers();
    
    // Обработчики быстрых действий
    initializeQuickActionHandlers();
}

// Обработчики навигации
function initializeNavigationHandlers() {
    // Нижняя навигация
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const page = this.dataset.page;
            navigateToPage(page);
        });
    });

    // Кнопки назад
    document.querySelectorAll('.back-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            history.back();
        });
    });

    // Кнопки закрытия модальных окон
    document.querySelectorAll('.close-btn, .modal-close').forEach(btn => {
        btn.addEventListener('click', function() {
            const modalId = this.closest('.modal')?.id || 'modal';
            closeModal(modalId);
        });
    });
}

// Обработчики действий
function initializeActionHandlers() {
    // Кнопки покупки
    document.querySelectorAll('.buy-btn, .action-btn.buy').forEach(btn => {
        btn.addEventListener('click', function() {
            const assetId = this.dataset.asset || getCurrentAssetId();
            if (assetId) {
                window.location.href = `buy.html?asset=${assetId}`;
            }
        });
    });

    // Кнопки продажи
    document.querySelectorAll('.sell-btn, .action-btn.sell').forEach(btn => {
        btn.addEventListener('click', function() {
            const assetId = this.dataset.asset || getCurrentAssetId();
            if (assetId) {
                window.location.href = `sell.html?asset=${assetId}`;
            }
        });
    });

    // Кнопки пополнения
    document.querySelectorAll('.deposit-btn, .action-btn.deposit').forEach(btn => {
        btn.addEventListener('click', function() {
            openDepositModal();
        });
    });

    // Кнопки вывода
    document.querySelectorAll('.withdraw-btn, .action-btn.withdraw').forEach(btn => {
        btn.addEventListener('click', function() {
            openWithdrawModal();
        });
    });

    // Кнопки экспорта
    document.querySelectorAll('.export-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const type = this.dataset.type || 'transactions';
            exportData(type);
        });
    });

    // Кнопки настроек
    document.querySelectorAll('.settings-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            window.location.href = 'settings.html';
        });
    });

    // Кнопки профиля
    document.querySelectorAll('.profile-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            openProfileModal();
        });
    });

    // Кнопки уведомлений
    document.querySelectorAll('.notifications-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            openNotificationsModal();
        });
    });

    // Кнопки помощи
    document.querySelectorAll('.help-btn, .help-icon').forEach(btn => {
        btn.addEventListener('click', function() {
            openHelpModal();
        });
    });

    // Кнопки поделиться
    document.querySelectorAll('.share-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            shareContent();
        });
    });

    // Кнопки избранного
    document.querySelectorAll('.favorite-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            toggleFavorite(this);
        });
    });

    // Кнопки обновления
    document.querySelectorAll('.refresh-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            refreshData();
        });
    });
}

// Обработчики форм
function initializeFormHandlers() {
    // Формы покупки
    document.querySelectorAll('#buyForm, .buy-form').forEach(form => {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            executeBuyForm(this);
        });
    });

    // Формы продажи
    document.querySelectorAll('#sellForm, .sell-form').forEach(form => {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            executeSellForm(this);
        });
    });

    // Формы пополнения
    document.querySelectorAll('#depositForm, .deposit-form').forEach(form => {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            executeDepositForm(this);
        });
    });

    // Формы вывода
    document.querySelectorAll('#withdrawForm, .withdraw-form').forEach(form => {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            executeWithdrawForm(this);
        });
    });

    // Формы настроек
    document.querySelectorAll('#settingsForm, .settings-form').forEach(form => {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            executeSettingsForm(this);
        });
    });

    // Формы профиля
    document.querySelectorAll('#profileForm, .profile-form').forEach(form => {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            executeProfileForm(this);
        });
    });
}

// Обработчики модальных окон
function initializeModalHandlers() {
    // Открытие модальных окон
    document.querySelectorAll('[data-modal]').forEach(btn => {
        btn.addEventListener('click', function() {
            const modalId = this.dataset.modal;
            openModal(modalId);
        });
    });

    // Закрытие модальных окон по клику вне области
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeModal(this.id);
            }
        });
    });

    // Закрытие модальных окон по Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const openModal = document.querySelector('.modal[style*="display: flex"]');
            if (openModal) {
                closeModal(openModal.id);
            }
        }
    });
}

// Обработчики фильтров
function initializeFilterHandlers() {
    // Фильтры транзакций
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            const filter = this.dataset.filter;
            applyFilter(filter);
        });
    });

    // Фильтры активов
    document.querySelectorAll('.asset-filter').forEach(filter => {
        filter.addEventListener('change', function() {
            const value = this.value;
            filterAssets(value);
        });
    });

    // Сортировка
    document.querySelectorAll('.sort-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const field = this.dataset.field;
            const direction = this.dataset.direction || 'asc';
            sortData(field, direction);
        });
    });
}

// Обработчики быстрых действий
function initializeQuickActionHandlers() {
    // Быстрые суммы
    document.querySelectorAll('.amount-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const amount = this.dataset.amount || this.textContent.replace(/[^\d.]/g, '');
            setQuickAmount(amount);
        });
    });

    // Быстрые действия
    document.querySelectorAll('.quick-action').forEach(btn => {
        btn.addEventListener('click', function() {
            const action = this.dataset.action;
            executeQuickAction(action);
        });
    });

    // Переключатели
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const target = this.dataset.target;
            toggleElement(target);
        });
    });
}

// Вспомогательные функции для обработчиков
function getCurrentAssetId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('asset');
}

function navigateToPage(page) {
    const pages = {
        'home': 'index.html',
        'coins': 'coins.html',
        'portfolio': 'portfolio.html',
        'transactions': 'transactions.html',
        'settings': 'settings.html'
    };
    
    if (pages[page]) {
        window.location.href = pages[page];
    }
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

function applyFilter(filter) {
    // Обновляем активную вкладку
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.filter === filter) {
            tab.classList.add('active');
        }
    });

    // Применяем фильтр к данным
    if (window.currentPage === 'transactions') {
        displayTransactions(filter);
    } else if (window.currentPage === 'coins') {
        filterAssets(filter);
    }
}

function filterAssets(filter) {
    // Логика фильтрации активов
    console.log('Фильтрация активов:', filter);
}

function sortData(field, direction) {
    // Логика сортировки данных
    console.log('Сортировка по:', field, direction);
}

function setQuickAmount(amount) {
    const amountInput = document.querySelector('#usdAmount, #cryptoAmount, #amount');
    if (amountInput) {
        amountInput.value = amount;
        // Триггерим событие для обновления расчетов
        amountInput.dispatchEvent(new Event('input'));
    }
}

function executeQuickAction(action) {
    switch (action) {
        case 'max':
            setMaxAmount();
            break;
        case 'half':
            setHalfAmount();
            break;
        case 'clear':
            clearForm();
            break;
        default:
            console.log('Быстрое действие:', action);
    }
}

function toggleElement(targetId) {
    const element = document.getElementById(targetId);
    if (element) {
        element.style.display = element.style.display === 'none' ? 'block' : 'none';
    }
}

function toggleFavorite(btn) {
    btn.classList.toggle('active');
    const assetId = btn.dataset.asset;
    // Логика добавления/удаления из избранного
    console.log('Переключение избранного для:', assetId);
}

function refreshData() {
    // Обновляем данные на текущей странице
    if (window.currentPage === 'index') {
        updateBalanceDisplay();
        updatePortfolioDisplay();
        updateTransactionsDisplay();
    } else if (window.currentPage === 'coins') {
        updateAssetPrices();
    }
}

function shareContent() {
    if (navigator.share) {
        navigator.share({
            title: 'KriptoExchange',
            text: 'Проверьте эту криптобиржу!',
            url: window.location.href
        });
    } else {
        // Fallback для браузеров без поддержки Web Share API
        navigator.clipboard.writeText(window.location.href);
        showToast('Ссылка скопирована', 'Ссылка скопирована в буфер обмена', 'success');
    }
}

function exportData(type) {
    let data, filename;
    
    switch (type) {
        case 'transactions':
            data = window.operationsManager.exportOperations('json');
            filename = 'transactions.json';
            break;
        case 'portfolio':
            data = JSON.stringify(window.portfolioManager.exportPortfolio(), null, 2);
            filename = 'portfolio.json';
            break;
        case 'earnings':
            data = window.earningsManager.exportEarnings('json');
            filename = 'earnings.json';
            break;
        default:
            data = '{}';
            filename = 'data.json';
    }

    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    
    showToast('Экспорт завершен', `Данные экспортированы в ${filename}`, 'success');
}

// Функции для модальных окон
function openDepositModal() {
    openModal('depositModal');
}

function openWithdrawModal() {
    openModal('withdrawModal');
}

function openProfileModal() {
    openModal('profileModal');
}

function openNotificationsModal() {
    openModal('notificationsModal');
}

function openHelpModal() {
    openModal('helpModal');
}

// Функции для форм
function executeBuyForm(form) {
    const formData = new FormData(form);
    const amount = formData.get('amount');
    const assetId = getCurrentAssetId();
    
    try {
        const result = window.balanceManager.buyAsset(assetId, parseFloat(amount));
        showToast('Покупка выполнена', `Куплено на сумму $${amount}`, 'success');
        closeModal('buyModal');
        refreshData();
    } catch (error) {
        showToast('Ошибка', error.message, 'error');
    }
}

function executeSellForm(form) {
    const formData = new FormData(form);
    const amount = formData.get('amount');
    const assetId = getCurrentAssetId();
    
    try {
        const result = window.balanceManager.sellAsset(assetId, parseFloat(amount));
        showToast('Продажа выполнена', `Продано на сумму $${result.usdValue}`, 'success');
        closeModal('sellModal');
        refreshData();
    } catch (error) {
        showToast('Ошибка', error.message, 'error');
    }
}

function executeDepositForm(form) {
    const formData = new FormData(form);
    const amount = formData.get('amount');
    const method = formData.get('method');
    
    try {
        const result = window.balanceManager.deposit(parseFloat(amount), method);
        showToast('Пополнение выполнено', `Баланс пополнен на $${amount}`, 'success');
        closeModal('depositModal');
        refreshData();
    } catch (error) {
        showToast('Ошибка', error.message, 'error');
    }
}

function executeWithdrawForm(form) {
    const formData = new FormData(form);
    const amount = formData.get('amount');
    const method = formData.get('method');
    
    try {
        const result = window.balanceManager.withdraw(parseFloat(amount), method);
        showToast('Вывод выполнен', `Выведено $${amount}`, 'success');
        closeModal('withdrawModal');
        refreshData();
    } catch (error) {
        showToast('Ошибка', error.message, 'error');
    }
}

function executeSettingsForm(form) {
    const formData = new FormData(form);
    const settings = Object.fromEntries(formData);
    
    try {
        window.accountManager.updateSettings(settings);
        showToast('Настройки сохранены', 'Настройки успешно обновлены', 'success');
        closeModal('settingsModal');
    } catch (error) {
        showToast('Ошибка', error.message, 'error');
    }
}

function executeProfileForm(form) {
    const formData = new FormData(form);
    const profile = Object.fromEntries(formData);
    
    try {
        window.accountManager.updateProfile(profile);
        showToast('Профиль обновлен', 'Данные профиля успешно обновлены', 'success');
        closeModal('profileModal');
    } catch (error) {
        showToast('Ошибка', error.message, 'error');
    }
}

// Вспомогательные функции
function setMaxAmount() {
    const balance = window.balanceManager.getCurrentBalance();
    setQuickAmount(balance);
}

function setHalfAmount() {
    const balance = window.balanceManager.getCurrentBalance();
    setQuickAmount(balance / 2);
}

function clearForm() {
    document.querySelectorAll('input[type="text"], input[type="number"], input[type="email"]').forEach(input => {
        input.value = '';
    });
}

function displayTransactions(filter) {
    // Логика отображения транзакций с фильтром
    console.log('Отображение транзакций с фильтром:', filter);
}

function updateAssetPrices() {
    // Логика обновления цен активов
    console.log('Обновление цен активов');
}

// Подключение всех модулей
document.addEventListener('DOMContentLoaded', function() {
    // Проверяем, что все модули загружены
    if (window.accountManager && window.balanceManager && window.operationsManager && 
        window.portfolioManager && window.historyManager && window.earningsManager) {
        
        // Создаем демо-аккаунт, если его нет
        if (!window.accountManager.isUserAuthenticated()) {
            const demoAccount = window.accountManager.createAccount(
                'Демо Пользователь',
                'demo@example.com',
                'password123'
            );
            
            // Добавляем начальный баланс
            window.balanceManager.deposit(10000, 'demo');
            
            console.log('Демо-аккаунт создан:', demoAccount);
        }

        // Инициализируем приложение
        initializeApp();
        
        console.log('Все модули успешно загружены');
    } else {
        console.error('Не все модули загружены');
    }
});

// Экспорт для использования в других файлах
window.appManagers = {
    accountManager: window.accountManager,
    balanceManager: window.balanceManager,
    operationsManager: window.operationsManager,
    portfolioManager: window.portfolioManager,
    historyManager: window.historyManager,
    earningsManager: window.earningsManager,
    getAssetById,
    getAllAssets,
    getTopAssets,
    formatCurrency,
    formatNumber,
    updateBalanceDisplay,
    updatePortfolioDisplay,
    updateTransactionsDisplay,
    initializeApp
};