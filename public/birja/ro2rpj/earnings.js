// Логика управления заработком и прибылью
class EarningsManager {
    constructor(balanceManager, portfolioManager) {
        this.balanceManager = balanceManager;
        this.portfolioManager = portfolioManager;
        this.earnings = this.loadEarnings();
        this.updateInterval = null;
        this.startAutoUpdate();
    }

    // Получение общего заработка
    getTotalEarnings() {
        return this.earnings.totalEarnings;
    }

    // Получение заработка за период
    getEarningsByPeriod(period = 'all') {
        const now = Date.now();
        let startTime;

        switch (period) {
            case 'today':
                startTime = new Date().setHours(0, 0, 0, 0);
                break;
            case 'week':
                startTime = now - (7 * 24 * 60 * 60 * 1000);
                break;
            case 'month':
                startTime = now - (30 * 24 * 60 * 60 * 1000);
                break;
            case 'year':
                startTime = now - (365 * 24 * 60 * 60 * 1000);
                break;
            default:
                startTime = 0;
        }

        return this.earnings.history.filter(record => record.timestamp >= startTime);
    }

    // Получение заработка за сегодня
    getTodayEarnings() {
        return this.getEarningsByPeriod('today');
    }

    // Получение заработка за неделю
    getWeekEarnings() {
        return this.getEarningsByPeriod('week');
    }

    // Получение заработка за месяц
    getMonthEarnings() {
        return this.getEarningsByPeriod('month');
    }

    // Получение заработка за год
    getYearEarnings() {
        return this.getEarningsByPeriod('year');
    }

    // Добавление записи о заработке
    addEarningRecord(type, amount, source, details = {}) {
        const record = {
            id: this.generateId(),
            type: type, // 'trade', 'dividend', 'staking', 'referral', 'bonus'
            amount: amount,
            source: source,
            details: details,
            timestamp: Date.now()
        };

        this.earnings.history.unshift(record);
        this.earnings.totalEarnings += amount;
        this.updateEarningsStats();
        this.saveEarnings();

        return record;
    }

    // Получение заработка по типу
    getEarningsByType(type) {
        return this.earnings.history.filter(record => record.type === type);
    }

    // Получение заработка по источнику
    getEarningsBySource(source) {
        return this.earnings.history.filter(record => record.source === source);
    }

    // Получение статистики заработка
    getEarningsStats() {
        const stats = {
            totalEarnings: this.earnings.totalEarnings,
            totalRecords: this.earnings.history.length,
            byType: {},
            bySource: {},
            byDay: {},
            averageEarning: 0,
            maxEarning: 0,
            minEarning: 0
        };

        if (this.earnings.history.length > 0) {
            const amounts = this.earnings.history.map(record => record.amount);
            stats.averageEarning = amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
            stats.maxEarning = Math.max(...amounts);
            stats.minEarning = Math.min(...amounts);
        }

        this.earnings.history.forEach(record => {
            // Подсчет по типам
            if (!stats.byType[record.type]) {
                stats.byType[record.type] = { count: 0, amount: 0 };
            }
            stats.byType[record.type].count++;
            stats.byType[record.type].amount += record.amount;

            // Подсчет по источникам
            if (!stats.bySource[record.source]) {
                stats.bySource[record.source] = { count: 0, amount: 0 };
            }
            stats.bySource[record.source].count++;
            stats.bySource[record.source].amount += record.amount;

            // Подсчет по дням
            const date = new Date(record.timestamp).toDateString();
            if (!stats.byDay[date]) {
                stats.byDay[date] = { count: 0, amount: 0 };
            }
            stats.byDay[date].count++;
            stats.byDay[date].amount += record.amount;
        });

        return stats;
    }

    // Получение топ дней по заработку
    getTopEarningDays(limit = 10) {
        const stats = this.getEarningsStats();
        return Object.entries(stats.byDay)
            .sort(([,a], [,b]) => b.amount - a.amount)
            .slice(0, limit)
            .map(([date, data]) => ({ date, ...data }));
    }

    // Получение топ источников заработка
    getTopEarningSources(limit = 10) {
        const stats = this.getEarningsStats();
        return Object.entries(stats.bySource)
            .sort(([,a], [,b]) => b.amount - a.amount)
            .slice(0, limit)
            .map(([source, data]) => ({ source, ...data }));
    }

    // Получение топ типов заработка
    getTopEarningTypes(limit = 10) {
        const stats = this.getEarningsStats();
        return Object.entries(stats.byType)
            .sort(([,a], [,b]) => b.amount - a.amount)
            .slice(0, limit)
            .map(([type, data]) => ({ type, ...data }));
    }

    // Получение заработка с наибольшей суммой
    getLargestEarnings(limit = 10) {
        return this.earnings.history
            .sort((a, b) => b.amount - a.amount)
            .slice(0, limit);
    }

    // Получение заработка с наименьшей суммой
    getSmallestEarnings(limit = 10) {
        return this.earnings.history
            .sort((a, b) => a.amount - b.amount)
            .slice(0, limit);
    }

    // Получение заработка по диапазону сумм
    getEarningsByAmountRange(minAmount, maxAmount) {
        return this.earnings.history.filter(record => 
            record.amount >= minAmount && record.amount <= maxAmount
        );
    }

    // Получение заработка по дате
    getEarningsByDate(date) {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        return this.earnings.history.filter(record => {
            const recordDate = new Date(record.timestamp);
            return recordDate >= startOfDay && recordDate <= endOfDay;
        });
    }

    // Получение заработка по периоду
    getEarningsByPeriod(startDate, endDate) {
        return this.earnings.history.filter(record => {
            const recordDate = new Date(record.timestamp);
            return recordDate >= startDate && recordDate <= endDate;
        });
    }

    // Получение заработка по активу
    getEarningsByAsset(assetId) {
        return this.earnings.history.filter(record => 
            record.details && record.details.assetId === assetId
        );
    }

    // Получение заработка по пользователю
    getEarningsByUser(userId) {
        return this.earnings.history.filter(record => 
            record.details && record.details.userId === userId
        );
    }

    // Получение заработка по методу
    getEarningsByMethod(method) {
        return this.earnings.history.filter(record => 
            record.details && record.details.method === method
        );
    }

    // Получение заработка по статусу
    getEarningsByStatus(status) {
        return this.earnings.history.filter(record => 
            record.details && record.details.status === status
        );
    }

    // Получение заработка с ошибками
    getFailedEarnings() {
        return this.getEarningsByStatus('failed');
    }

    // Получение заработка с успешными операциями
    getSuccessfulEarnings() {
        return this.getEarningsByStatus('completed');
    }

    // Получение заработка с отмененными операциями
    getCancelledEarnings() {
        return this.getEarningsByStatus('cancelled');
    }

    // Получение заработка с ожидающими операциями
    getPendingEarnings() {
        return this.getEarningsByStatus('pending');
    }

    // Получение заработка с ошибками по типу
    getFailedEarningsByType(type) {
        return this.getFailedEarnings().filter(record => record.type === type);
    }

    // Получение заработка с ошибками по периоду
    getFailedEarningsByPeriod(startDate, endDate) {
        return this.getEarningsByPeriod(startDate, endDate)
            .filter(record => record.details && record.details.status === 'failed');
    }

    // Получение заработка с ошибками за сегодня
    getTodayFailedEarnings() {
        return this.getTodayEarnings().filter(record => 
            record.details && record.details.status === 'failed'
        );
    }

    // Получение заработка с ошибками за неделю
    getWeekFailedEarnings() {
        return this.getWeekEarnings().filter(record => 
            record.details && record.details.status === 'failed'
        );
    }

    // Получение заработка с ошибками за месяц
    getMonthFailedEarnings() {
        return this.getMonthEarnings().filter(record => 
            record.details && record.details.status === 'failed'
        );
    }

    // Получение заработка с ошибками по активу
    getFailedEarningsByAsset(assetId) {
        return this.getEarningsByAsset(assetId)
            .filter(record => record.details && record.details.status === 'failed');
    }

    // Получение заработка с ошибками по методу
    getFailedEarningsByMethod(method) {
        return this.getEarningsByMethod(method)
            .filter(record => record.details && record.details.status === 'failed');
    }

    // Получение заработка с ошибками по диапазону сумм
    getFailedEarningsByAmountRange(minAmount, maxAmount) {
        return this.getEarningsByAmountRange(minAmount, maxAmount)
            .filter(record => record.details && record.details.status === 'failed');
    }

    // Экспорт заработка
    exportEarnings(format = 'json') {
        const data = this.earnings.history.map(record => ({
            id: record.id,
            type: record.type,
            amount: record.amount,
            source: record.source,
            details: record.details,
            timestamp: new Date(record.timestamp).toISOString()
        }));

        if (format === 'csv') {
            return this.convertToCSV(data);
        }

        return JSON.stringify(data, null, 2);
    }

    // Конвертация в CSV
    convertToCSV(data) {
        if (data.length === 0) return '';

        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(','),
            ...data.map(row => 
                headers.map(header => 
                    JSON.stringify(row[header] || '')
                ).join(',')
            )
        ].join('\n');

        return csvContent;
    }

    // Очистка старого заработка
    cleanupOldEarnings(daysToKeep = 90) {
        const cutoffDate = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
        const originalLength = this.earnings.history.length;
        
        this.earnings.history = this.earnings.history.filter(record => record.timestamp > cutoffDate);
        
        this.updateEarningsStats();
        this.saveEarnings();
        
        return originalLength - this.earnings.history.length;
    }

    // Обновление статистики заработка
    updateEarningsStats() {
        this.earnings.totalEarnings = this.earnings.history.reduce((sum, record) => sum + record.amount, 0);
        this.earnings.lastUpdated = Date.now();
    }

    // Генерация ID записи
    generateId() {
        return 'earn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Сохранение заработка
    saveEarnings() {
        localStorage.setItem('userEarnings', JSON.stringify(this.earnings));
    }

    // Загрузка заработка
    loadEarnings() {
        const saved = localStorage.getItem('userEarnings');
        return saved ? JSON.parse(saved) : {
            totalEarnings: 0,
            history: [],
            lastUpdated: Date.now()
        };
    }

    // Очистка всего заработка
    clearEarnings() {
        this.earnings = {
            totalEarnings: 0,
            history: [],
            lastUpdated: Date.now()
        };
        this.saveEarnings();
    }

    // Получение последних записей о заработке
    getRecentEarnings(limit = 10) {
        return this.earnings.history.slice(0, limit);
    }

    // Запуск автоматического обновления
    startAutoUpdate() {
        this.updateInterval = setInterval(() => {
            this.updateEarningsStats();
        }, 60000); // Каждую минуту
    }

    // Остановка автоматического обновления
    stopAutoUpdate() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    // Получение заработка по интервалу
    getEarningsByInterval(interval = '1h') {
        const now = Date.now();
        let startTime;

        switch (interval) {
            case '1h':
                startTime = now - (60 * 60 * 1000);
                break;
            case '6h':
                startTime = now - (6 * 60 * 60 * 1000);
                break;
            case '12h':
                startTime = now - (12 * 60 * 60 * 1000);
                break;
            case '24h':
                startTime = now - (24 * 60 * 60 * 1000);
                break;
            default:
                startTime = now - (60 * 60 * 1000);
        }

        return this.earnings.history.filter(record => record.timestamp >= startTime);
    }

    // Получение статистики по интервалам
    getIntervalStats() {
        const intervals = ['1h', '6h', '12h', '24h'];
        const stats = {};

        intervals.forEach(interval => {
            const earnings = this.getEarningsByInterval(interval);
            stats[interval] = {
                count: earnings.length,
                amount: earnings.reduce((sum, record) => sum + record.amount, 0),
                success: earnings.filter(record => 
                    record.details && record.details.status === 'completed'
                ).length
            };
        });

        return stats;
    }

    // Получение топ активов по заработку
    getTopAssetsByEarnings(limit = 10) {
        const assetEarnings = {};

        this.earnings.history.forEach(record => {
            if (record.details && record.details.assetId) {
                if (!assetEarnings[record.details.assetId]) {
                    assetEarnings[record.details.assetId] = 0;
                }
                assetEarnings[record.details.assetId] += record.amount;
            }
        });

        return Object.entries(assetEarnings)
            .sort(([,a], [,b]) => b - a)
            .slice(0, limit)
            .map(([assetId, amount]) => ({ assetId, amount }));
    }

    // Получение топ методов по заработку
    getTopMethodsByEarnings(limit = 10) {
        const methodEarnings = {};

        this.earnings.history.forEach(record => {
            if (record.details && record.details.method) {
                if (!methodEarnings[record.details.method]) {
                    methodEarnings[record.details.method] = 0;
                }
                methodEarnings[record.details.method] += record.amount;
            }
        });

        return Object.entries(methodEarnings)
            .sort(([,a], [,b]) => b - a)
            .slice(0, limit)
            .map(([method, amount]) => ({ method, amount }));
    }

    // Получение топ пользователей по заработку
    getTopUsersByEarnings(limit = 10) {
        const userEarnings = {};

        this.earnings.history.forEach(record => {
            if (record.details && record.details.userId) {
                if (!userEarnings[record.details.userId]) {
                    userEarnings[record.details.userId] = 0;
                }
                userEarnings[record.details.userId] += record.amount;
            }
        });

        return Object.entries(userEarnings)
            .sort(([,a], [,b]) => b - a)
            .slice(0, limit)
            .map(([userId, amount]) => ({ userId, amount }));
    }
}

// Создание глобального экземпляра
window.earningsManager = new EarningsManager(window.balanceManager, window.portfolioManager);
