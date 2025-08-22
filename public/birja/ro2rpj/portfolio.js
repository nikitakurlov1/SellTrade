// Логика управления портфелем пользователя
class PortfolioManager {
    constructor(balanceManager) {
        this.balanceManager = balanceManager;
        this.portfolio = this.loadPortfolio();
        this.updateInterval = null;
        this.startAutoUpdate();
    }

    // Получение портфеля
    getPortfolio() {
        return this.portfolio;
    }

    // Получение активов в портфеле
    getPortfolioAssets() {
        return Object.entries(this.portfolio.assets).map(([assetId, asset]) => ({
            assetId,
            ...asset,
            currentPrice: this.getAssetCurrentPrice(assetId),
            currentValue: asset.balance * (this.getAssetCurrentPrice(assetId) || 0),
            profit: this.calculateAssetProfit(assetId),
            profitPercent: this.calculateAssetProfitPercent(assetId)
        }));
    }

    // Добавление актива в портфель
    addAsset(assetId, amount, price) {
        if (!this.portfolio.assets[assetId]) {
            this.portfolio.assets[assetId] = {
                balance: 0,
                averagePrice: 0,
                totalInvested: 0,
                firstBought: Date.now(),
                lastUpdated: Date.now()
            };
        }

        const asset = this.portfolio.assets[assetId];
        const totalCost = amount * price;
        const newTotalInvested = asset.totalInvested + totalCost;
        const newBalance = asset.balance + amount;

        asset.averagePrice = newTotalInvested / newBalance;
        asset.balance = newBalance;
        asset.totalInvested = newTotalInvested;
        asset.lastUpdated = Date.now();

        this.updatePortfolioStats();
        this.savePortfolio();
    }

    // Удаление актива из портфеля
    removeAsset(assetId, amount, price) {
        const asset = this.portfolio.assets[assetId];
        if (!asset || asset.balance < amount) {
            throw new Error('Недостаточно активов');
        }

        asset.balance -= amount;
        asset.totalInvested = asset.averagePrice * asset.balance;
        asset.lastUpdated = Date.now();

        if (asset.balance <= 0) {
            delete this.portfolio.assets[assetId];
        }

        this.updatePortfolioStats();
        this.savePortfolio();
    }

    // Обновление статистики портфеля
    updatePortfolioStats() {
        let totalValue = 0;
        let totalInvested = 0;

        for (const [assetId, asset] of Object.entries(this.portfolio.assets)) {
            const currentPrice = this.getAssetCurrentPrice(assetId);
            if (currentPrice) {
                const currentValue = asset.balance * currentPrice;
                totalValue += currentValue;
                totalInvested += asset.totalInvested;
            }
        }

        this.portfolio.totalValue = totalValue;
        this.portfolio.totalInvested = totalInvested;
        this.portfolio.totalProfit = totalValue - totalInvested;
        this.portfolio.profitPercent = totalInvested > 0 ? (this.portfolio.totalProfit / totalInvested) * 100 : 0;
        this.portfolio.lastUpdated = Date.now();
    }

    // Получение текущей цены актива
    getAssetCurrentPrice(assetId) {
        const prices = {
            'bitcoin': 43250,
            'ethereum': 4842,
            'solana': 198,
            'cardano': 0.45,
            'polkadot': 6.5,
            'chainlink': 15.2,
            'litecoin': 122,
            'bitcoin-cash': 245,
            'stellar': 0.12,
            'monero': 165
        };
        return prices[assetId] || 0;
    }

    // Расчет прибыли по активу
    calculateAssetProfit(assetId) {
        const asset = this.portfolio.assets[assetId];
        if (!asset) return 0;

        const currentPrice = this.getAssetCurrentPrice(assetId);
        const currentValue = asset.balance * currentPrice;
        return currentValue - asset.totalInvested;
    }

    // Расчет процента прибыли по активу
    calculateAssetProfitPercent(assetId) {
        const asset = this.portfolio.assets[assetId];
        if (!asset || asset.totalInvested <= 0) return 0;

        const profit = this.calculateAssetProfit(assetId);
        return (profit / asset.totalInvested) * 100;
    }

    // Получение топ активов по прибыли
    getTopProfitableAssets(limit = 5) {
        return this.getPortfolioAssets()
            .filter(asset => asset.profit > 0)
            .sort((a, b) => b.profit - a.profit)
            .slice(0, limit);
    }

    // Получение убыточных активов
    getLosingAssets(limit = 5) {
        return this.getPortfolioAssets()
            .filter(asset => asset.profit < 0)
            .sort((a, b) => a.profit - b.profit)
            .slice(0, limit);
    }

    // Получение активов с наибольшим ростом
    getTopGrowingAssets(limit = 5) {
        return this.getPortfolioAssets()
            .filter(asset => asset.profitPercent > 0)
            .sort((a, b) => b.profitPercent - a.profitPercent)
            .slice(0, limit);
    }

    // Получение активов с наибольшим падением
    getTopFallingAssets(limit = 5) {
        return this.getPortfolioAssets()
            .filter(asset => asset.profitPercent < 0)
            .sort((a, b) => a.profitPercent - b.profitPercent)
            .slice(0, limit);
    }

    // Получение распределения портфеля
    getPortfolioDistribution() {
        const assets = this.getPortfolioAssets();
        const totalValue = this.portfolio.totalValue;

        return assets.map(asset => ({
            assetId: asset.assetId,
            name: this.getAssetName(asset.assetId),
            symbol: this.getAssetSymbol(asset.assetId),
            value: asset.currentValue,
            percentage: totalValue > 0 ? (asset.currentValue / totalValue) * 100 : 0,
            balance: asset.balance
        })).sort((a, b) => b.value - a.value);
    }

    // Получение статистики портфеля
    getPortfolioStats() {
        const assets = this.getPortfolioAssets();
        const totalAssets = assets.length;
        const profitableAssets = assets.filter(asset => asset.profit > 0).length;
        const losingAssets = assets.filter(asset => asset.profit < 0).length;

        return {
            totalAssets,
            profitableAssets,
            losingAssets,
            winRate: totalAssets > 0 ? (profitableAssets / totalAssets) * 100 : 0,
            totalValue: this.portfolio.totalValue,
            totalInvested: this.portfolio.totalInvested,
            totalProfit: this.portfolio.totalProfit,
            profitPercent: this.portfolio.profitPercent,
            averageProfit: totalAssets > 0 ? this.portfolio.totalProfit / totalAssets : 0
        };
    }

    // Получение истории портфеля
    getPortfolioHistory(days = 30) {
        // В реальном приложении здесь была бы история изменений
        const history = [];
        const now = Date.now();
        const dayMs = 24 * 60 * 60 * 1000;

        for (let i = days; i >= 0; i--) {
            const date = new Date(now - i * dayMs);
            const value = this.portfolio.totalValue * (1 + (Math.random() - 0.5) * 0.1);
            
            history.push({
                date: date.toISOString().split('T')[0],
                value: value,
                change: i > 0 ? value - history[history.length - 1]?.value : 0
            });
        }

        return history;
    }

    // Получение имени актива
    getAssetName(assetId) {
        const names = {
            'bitcoin': 'Bitcoin',
            'ethereum': 'Ethereum',
            'solana': 'Solana',
            'cardano': 'Cardano',
            'polkadot': 'Polkadot',
            'chainlink': 'Chainlink',
            'litecoin': 'Litecoin',
            'bitcoin-cash': 'Bitcoin Cash',
            'stellar': 'Stellar',
            'monero': 'Monero'
        };
        return names[assetId] || assetId;
    }

    // Получение символа актива
    getAssetSymbol(assetId) {
        const symbols = {
            'bitcoin': 'BTC',
            'ethereum': 'ETH',
            'solana': 'SOL',
            'cardano': 'ADA',
            'polkadot': 'DOT',
            'chainlink': 'LINK',
            'litecoin': 'LTC',
            'bitcoin-cash': 'BCH',
            'stellar': 'XLM',
            'monero': 'XMR'
        };
        return symbols[assetId] || assetId.toUpperCase();
    }

    // Запуск автоматического обновления
    startAutoUpdate() {
        this.updateInterval = setInterval(() => {
            this.updatePortfolioStats();
        }, 30000); // Каждые 30 секунд
    }

    // Остановка автоматического обновления
    stopAutoUpdate() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    // Сохранение портфеля
    savePortfolio() {
        localStorage.setItem('userPortfolio', JSON.stringify(this.portfolio));
    }

    // Загрузка портфеля
    loadPortfolio() {
        const saved = localStorage.getItem('userPortfolio');
        return saved ? JSON.parse(saved) : {
            totalValue: 0,
            totalInvested: 0,
            totalProfit: 0,
            profitPercent: 0,
            assets: {},
            lastUpdated: Date.now()
        };
    }

    // Очистка портфеля
    clearPortfolio() {
        this.portfolio = {
            totalValue: 0,
            totalInvested: 0,
            totalProfit: 0,
            profitPercent: 0,
            assets: {},
            lastUpdated: Date.now()
        };
        this.savePortfolio();
    }

    // Экспорт портфеля
    exportPortfolio() {
        return {
            portfolio: this.portfolio,
            assets: this.getPortfolioAssets(),
            distribution: this.getPortfolioDistribution(),
            stats: this.getPortfolioStats(),
            exportDate: new Date().toISOString()
        };
    }
}

// Создание глобального экземпляра
window.portfolioManager = new PortfolioManager(window.balanceManager);
