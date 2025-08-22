// Логика управления историей транзакций и операций
class HistoryManager {
    constructor(operationsManager) {
        this.operationsManager = operationsManager;
        this.history = this.loadHistory();
    }

    // Добавление записи в историю
    addHistoryRecord(type, data) {
        const record = {
            id: this.generateId(),
            type: type,
            data: data,
            timestamp: Date.now(),
            status: 'completed'
        };

        this.history.unshift(record);
        this.saveHistory();
        return record;
    }

    // Получение истории
    getHistory(filter = 'all', limit = 50) {
        let filtered = this.history;

        if (filter !== 'all') {
            filtered = this.history.filter(record => record.type === filter);
        }

        return filtered.slice(0, limit);
    }

    // Получение истории по периоду
    getHistoryByPeriod(startDate, endDate) {
        return this.history.filter(record => {
            const recordDate = new Date(record.timestamp);
            return recordDate >= startDate && recordDate <= endDate;
        });
    }

    // Получение истории за сегодня
    getTodayHistory() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        return this.getHistoryByPeriod(today, tomorrow);
    }

    // Получение истории за неделю
    getWeekHistory() {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        
        return this.getHistoryByPeriod(weekAgo, new Date());
    }

    // Получение истории за месяц
    getMonthHistory() {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        
        return this.getHistoryByPeriod(monthAgo, new Date());
    }

    // Получение статистики истории
    getHistoryStats() {
        const stats = {
            total: this.history.length,
            byType: {},
            byDay: {},
            totalVolume: 0,
            averageVolume: 0
        };

        this.history.forEach(record => {
            // Подсчет по типам
            if (!stats.byType[record.type]) {
                stats.byType[record.type] = 0;
            }
            stats.byType[record.type]++;

            // Подсчет по дням
            const date = new Date(record.timestamp).toDateString();
            if (!stats.byDay[date]) {
                stats.byDay[date] = 0;
            }
            stats.byDay[date]++;

            // Подсчет объема
            if (record.data && record.data.amount) {
                stats.totalVolume += record.data.amount;
            }
        });

        stats.averageVolume = stats.total > 0 ? stats.totalVolume / stats.total : 0;

        return stats;
    }

    // Получение топ дней по активности
    getTopActiveDays(limit = 10) {
        const stats = this.getHistoryStats();
        return Object.entries(stats.byDay)
            .sort(([,a], [,b]) => b - a)
            .slice(0, limit)
            .map(([date, count]) => ({ date, count }));
    }

    // Получение истории по активу
    getHistoryByAsset(assetId) {
        return this.history.filter(record => 
            record.data && record.data.assetId === assetId
        );
    }

    // Получение истории по пользователю
    getHistoryByUser(userId) {
        return this.history.filter(record => 
            record.data && record.data.userId === userId
        );
    }

    // Получение истории по методу
    getHistoryByMethod(method) {
        return this.history.filter(record => 
            record.data && record.data.method === method
        );
    }

    // Получение истории по статусу
    getHistoryByStatus(status) {
        return this.history.filter(record => record.status === status);
    }

    // Получение истории с ошибками
    getFailedHistory() {
        return this.getHistoryByStatus('failed');
    }

    // Получение истории с успешными операциями
    getSuccessfulHistory() {
        return this.getHistoryByStatus('completed');
    }

    // Получение истории с отмененными операциями
    getCancelledHistory() {
        return this.getHistoryByStatus('cancelled');
    }

    // Получение истории с ожидающими операциями
    getPendingHistory() {
        return this.getHistoryByStatus('pending');
    }

    // Получение истории с наибольшим объемом
    getLargestHistory(limit = 10) {
        return this.history
            .filter(record => record.data && record.data.amount)
            .sort((a, b) => b.data.amount - a.data.amount)
            .slice(0, limit);
    }

    // Получение истории с наименьшим объемом
    getSmallestHistory(limit = 10) {
        return this.history
            .filter(record => record.data && record.data.amount)
            .sort((a, b) => a.data.amount - b.data.amount)
            .slice(0, limit);
    }

    // Получение истории по диапазону сумм
    getHistoryByAmountRange(minAmount, maxAmount) {
        return this.history.filter(record => {
            if (!record.data || !record.data.amount) return false;
            return record.data.amount >= minAmount && record.data.amount <= maxAmount;
        });
    }

    // Получение истории по диапазону комиссий
    getHistoryByFeeRange(minFee, maxFee) {
        return this.history.filter(record => {
            if (!record.data || !record.data.fee) return false;
            return record.data.fee >= minFee && record.data.fee <= maxFee;
        });
    }

    // Получение истории с ошибками по типу
    getFailedHistoryByType(type) {
        return this.getFailedHistory().filter(record => record.type === type);
    }

    // Получение истории с ошибками по периоду
    getFailedHistoryByPeriod(startDate, endDate) {
        return this.getHistoryByPeriod(startDate, endDate)
            .filter(record => record.status === 'failed');
    }

    // Получение истории с ошибками за сегодня
    getTodayFailedHistory() {
        return this.getTodayHistory().filter(record => record.status === 'failed');
    }

    // Получение истории с ошибками за неделю
    getWeekFailedHistory() {
        return this.getWeekHistory().filter(record => record.status === 'failed');
    }

    // Получение истории с ошибками за месяц
    getMonthFailedHistory() {
        return this.getMonthHistory().filter(record => record.status === 'failed');
    }

    // Получение истории с ошибками по активу
    getFailedHistoryByAsset(assetId) {
        return this.getHistoryByAsset(assetId)
            .filter(record => record.status === 'failed');
    }

    // Получение истории с ошибками по методу
    getFailedHistoryByMethod(method) {
        return this.getHistoryByMethod(method)
            .filter(record => record.status === 'failed');
    }

    // Получение истории с ошибками по диапазону сумм
    getFailedHistoryByAmountRange(minAmount, maxAmount) {
        return this.getHistoryByAmountRange(minAmount, maxAmount)
            .filter(record => record.status === 'failed');
    }

    // Получение истории с ошибками по диапазону комиссий
    getFailedHistoryByFeeRange(minFee, maxFee) {
        return this.getHistoryByFeeRange(minFee, maxFee)
            .filter(record => record.status === 'failed');
    }

    // Экспорт истории
    exportHistory(format = 'json') {
        const data = this.history.map(record => ({
            id: record.id,
            type: record.type,
            status: record.status,
            timestamp: new Date(record.timestamp).toISOString(),
            data: record.data
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

    // Очистка старой истории
    cleanupOldHistory(daysToKeep = 90) {
        const cutoffDate = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
        const originalLength = this.history.length;
        
        this.history = this.history.filter(record => record.timestamp > cutoffDate);
        
        this.saveHistory();
        
        return originalLength - this.history.length;
    }

    // Генерация ID записи
    generateId() {
        return 'hist_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Сохранение истории
    saveHistory() {
        localStorage.setItem('userHistory', JSON.stringify(this.history));
    }

    // Загрузка истории
    loadHistory() {
        const saved = localStorage.getItem('userHistory');
        return saved ? JSON.parse(saved) : [];
    }

    // Очистка всей истории
    clearHistory() {
        this.history = [];
        this.saveHistory();
    }

    // Получение последних записей
    getRecentHistory(limit = 10) {
        return this.history.slice(0, limit);
    }

    // Получение записей по дате
    getHistoryByDate(date) {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        return this.getHistoryByPeriod(startOfDay, endOfDay);
    }

    // Получение записей по времени
    getHistoryByTime(startTime, endTime) {
        return this.history.filter(record => {
            const recordTime = new Date(record.timestamp);
            return recordTime >= startTime && recordTime <= endTime;
        });
    }

    // Получение записей по интервалу
    getHistoryByInterval(interval = '1h') {
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

        return this.getHistoryByTime(new Date(startTime), new Date(now));
    }

    // Получение статистики по интервалам
    getIntervalStats() {
        const intervals = ['1h', '6h', '12h', '24h'];
        const stats = {};

        intervals.forEach(interval => {
            const history = this.getHistoryByInterval(interval);
            stats[interval] = {
                count: history.length,
                volume: history.reduce((sum, record) => sum + (record.data?.amount || 0), 0),
                success: history.filter(record => record.status === 'completed').length
            };
        });

        return stats;
    }

    // Получение топ активов по объему в истории
    getTopAssetsByVolume(limit = 10) {
        const assetVolumes = {};

        this.history.forEach(record => {
            if (record.data && record.data.assetId && record.data.amount) {
                if (!assetVolumes[record.data.assetId]) {
                    assetVolumes[record.data.assetId] = 0;
                }
                assetVolumes[record.data.assetId] += record.data.amount;
            }
        });

        return Object.entries(assetVolumes)
            .sort(([,a], [,b]) => b - a)
            .slice(0, limit)
            .map(([assetId, volume]) => ({ assetId, volume }));
    }

    // Получение топ методов по объему в истории
    getTopMethodsByVolume(limit = 10) {
        const methodVolumes = {};

        this.history.forEach(record => {
            if (record.data && record.data.method && record.data.amount) {
                if (!methodVolumes[record.data.method]) {
                    methodVolumes[record.data.method] = 0;
                }
                methodVolumes[record.data.method] += record.data.amount;
            }
        });

        return Object.entries(methodVolumes)
            .sort(([,a], [,b]) => b - a)
            .slice(0, limit)
            .map(([method, volume]) => ({ method, volume }));
    }

    // Получение топ пользователей по объему в истории
    getTopUsersByVolume(limit = 10) {
        const userVolumes = {};

        this.history.forEach(record => {
            if (record.data && record.data.userId && record.data.amount) {
                if (!userVolumes[record.data.userId]) {
                    userVolumes[record.data.userId] = 0;
                }
                userVolumes[record.data.userId] += record.data.amount;
            }
        });

        return Object.entries(userVolumes)
            .sort(([,a], [,b]) => b - a)
            .slice(0, limit)
            .map(([userId, volume]) => ({ userId, volume }));
    }
}

// Создание глобального экземпляра
window.historyManager = new HistoryManager(window.operationsManager);
