// Логика управления операциями и транзакциями
class OperationsManager {
    constructor(balanceManager) {
        this.balanceManager = balanceManager;
        this.transactions = [];
        this.loadTransactions();
    }

    // Создание новой операции
    createOperation(type, data) {
        const operation = {
            id: this.generateId(),
            type: type,
            data: data,
            timestamp: Date.now(),
            status: 'pending',
            result: null,
            error: null
        };

        try {
            switch (type) {
                case 'buy':
                    operation.result = this.executeBuy(data);
                    break;
                case 'sell':
                    operation.result = this.executeSell(data);
                    break;
                case 'deposit':
                    operation.result = this.executeDeposit(data);
                    break;
                case 'withdraw':
                    operation.result = this.executeWithdraw(data);
                    break;
                default:
                    throw new Error('Неизвестный тип операции');
            }

            operation.status = 'completed';
            this.transactions.unshift(operation);
            this.saveTransactions();

            return operation;
        } catch (error) {
            operation.status = 'failed';
            operation.error = error.message;
            this.transactions.unshift(operation);
            this.saveTransactions();

            throw error;
        }
    }

    // Выполнение покупки
    executeBuy(data) {
        const { assetId, usdAmount } = data;
        return this.balanceManager.buyAsset(assetId, usdAmount);
    }

    // Выполнение продажи
    executeSell(data) {
        const { assetId, cryptoAmount } = data;
        return this.balanceManager.sellAsset(assetId, cryptoAmount);
    }

    // Выполнение пополнения
    executeDeposit(data) {
        const { amount, method } = data;
        return this.balanceManager.deposit(amount, method);
    }

    // Выполнение вывода
    executeWithdraw(data) {
        const { amount, method } = data;
        return this.balanceManager.withdraw(amount, method);
    }

    // Получение истории операций
    getOperationHistory(filter = 'all', limit = 50) {
        let filtered = this.transactions;

        if (filter !== 'all') {
            filtered = this.transactions.filter(op => op.type === filter);
        }

        return filtered.slice(0, limit);
    }

    // Получение статистики операций
    getOperationStats() {
        const stats = {
            total: this.transactions.length,
            completed: 0,
            failed: 0,
            pending: 0,
            byType: {},
            totalVolume: 0,
            averageVolume: 0
        };

        this.transactions.forEach(op => {
            // Подсчет по статусам
            stats[op.status]++;

            // Подсчет по типам
            if (!stats.byType[op.type]) {
                stats.byType[op.type] = 0;
            }
            stats.byType[op.type]++;

            // Подсчет объема
            if (op.result && op.result.totalValue) {
                stats.totalVolume += op.result.totalValue;
            }
        });

        stats.averageVolume = stats.total > 0 ? stats.totalVolume / stats.total : 0;

        return stats;
    }

    // Получение операции по ID
    getOperationById(operationId) {
        return this.transactions.find(op => op.id === operationId);
    }

    // Отмена операции
    cancelOperation(operationId) {
        const operation = this.getOperationById(operationId);
        if (!operation) {
            throw new Error('Операция не найдена');
        }

        if (operation.status !== 'pending') {
            throw new Error('Операцию нельзя отменить');
        }

        operation.status = 'cancelled';
        this.saveTransactions();

        return operation;
    }

    // Повтор операции
    retryOperation(operationId) {
        const operation = this.getOperationById(operationId);
        if (!operation) {
            throw new Error('Операция не найдена');
        }

        if (operation.status !== 'failed') {
            throw new Error('Операцию нельзя повторить');
        }

        return this.createOperation(operation.type, operation.data);
    }

    // Получение операций за период
    getOperationsByPeriod(startDate, endDate) {
        return this.transactions.filter(op => {
            const opDate = new Date(op.timestamp);
            return opDate >= startDate && opDate <= endDate;
        });
    }

    // Получение операций по активу
    getOperationsByAsset(assetId) {
        return this.transactions.filter(op => {
            return op.data && op.data.assetId === assetId;
        });
    }

    // Экспорт операций
    exportOperations(format = 'json') {
        const data = this.transactions.map(op => ({
            id: op.id,
            type: op.type,
            status: op.status,
            timestamp: new Date(op.timestamp).toISOString(),
            data: op.data,
            result: op.result,
            error: op.error
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

    // Очистка старых операций
    cleanupOldOperations(daysToKeep = 90) {
        const cutoffDate = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
        const originalLength = this.transactions.length;
        
        this.transactions = this.transactions.filter(op => op.timestamp > cutoffDate);
        
        this.saveTransactions();
        
        return originalLength - this.transactions.length;
    }

    // Генерация ID операции
    generateId() {
        return 'op_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Сохранение транзакций
    saveTransactions() {
        localStorage.setItem('userOperations', JSON.stringify(this.transactions));
    }

    // Загрузка транзакций
    loadTransactions() {
        const saved = localStorage.getItem('userOperations');
        this.transactions = saved ? JSON.parse(saved) : [];
    }

    // Получение последних операций
    getRecentOperations(limit = 10) {
        return this.transactions.slice(0, limit);
    }

    // Получение операций по статусу
    getOperationsByStatus(status) {
        return this.transactions.filter(op => op.status === status);
    }

    // Получение операций с ошибками
    getFailedOperations() {
        return this.transactions.filter(op => op.status === 'failed');
    }

    // Получение операций в процессе
    getPendingOperations() {
        return this.transactions.filter(op => op.status === 'pending');
    }

    // Получение операций по дате
    getOperationsByDate(date) {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        return this.getOperationsByPeriod(startOfDay, endOfDay);
    }

    // Получение операций за сегодня
    getTodayOperations() {
        return this.getOperationsByDate(new Date());
    }

    // Получение операций за неделю
    getWeekOperations() {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        
        return this.getOperationsByPeriod(weekAgo, new Date());
    }

    // Получение операций за месяц
    getMonthOperations() {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        
        return this.getOperationsByPeriod(monthAgo, new Date());
    }

    // Получение статистики по периодам
    getPeriodStats() {
        const today = this.getTodayOperations();
        const week = this.getWeekOperations();
        const month = this.getMonthOperations();

        return {
            today: {
                count: today.length,
                volume: this.calculateVolume(today),
                success: today.filter(op => op.status === 'completed').length
            },
            week: {
                count: week.length,
                volume: this.calculateVolume(week),
                success: week.filter(op => op.status === 'completed').length
            },
            month: {
                count: month.length,
                volume: this.calculateVolume(month),
                success: month.filter(op => op.status === 'completed').length
            }
        };
    }

    // Расчет объема операций
    calculateVolume(operations) {
        return operations.reduce((total, op) => {
            if (op.result && op.result.totalValue) {
                return total + op.result.totalValue;
            }
            return total;
        }, 0);
    }

    // Получение топ активов по объему операций
    getTopAssetsByVolume(limit = 10) {
        const assetVolumes = {};

        this.transactions.forEach(op => {
            if (op.data && op.data.assetId && op.result && op.result.totalValue) {
                if (!assetVolumes[op.data.assetId]) {
                    assetVolumes[op.data.assetId] = 0;
                }
                assetVolumes[op.data.assetId] += op.result.totalValue;
            }
        });

        return Object.entries(assetVolumes)
            .sort(([,a], [,b]) => b - a)
            .slice(0, limit)
            .map(([assetId, volume]) => ({ assetId, volume }));
    }

    // Получение операций с наибольшим объемом
    getLargestOperations(limit = 10) {
        return this.transactions
            .filter(op => op.result && op.result.totalValue)
            .sort((a, b) => b.result.totalValue - a.result.totalValue)
            .slice(0, limit);
    }

    // Получение операций с наименьшим объемом
    getSmallestOperations(limit = 10) {
        return this.transactions
            .filter(op => op.result && op.result.totalValue)
            .sort((a, b) => a.result.totalValue - b.result.totalValue)
            .slice(0, limit);
    }

    // Получение операций по пользователю
    getOperationsByUser(userId) {
        // В реальном приложении здесь была бы фильтрация по пользователю
        return this.transactions;
    }

    // Получение операций по методу
    getOperationsByMethod(method) {
        return this.transactions.filter(op => 
            op.data && op.data.method === method
        );
    }

    // Получение операций по диапазону сумм
    getOperationsByAmountRange(minAmount, maxAmount) {
        return this.transactions.filter(op => {
            if (!op.result || !op.result.totalValue) return false;
            return op.result.totalValue >= minAmount && op.result.totalValue <= maxAmount;
        });
    }

    // Получение операций по комиссии
    getOperationsByFeeRange(minFee, maxFee) {
        return this.transactions.filter(op => {
            if (!op.result || !op.result.commission) return false;
            return op.result.commission >= minFee && op.result.commission <= maxFee;
        });
    }

    // Получение операций с ошибками по типу
    getFailedOperationsByType(type) {
        return this.transactions.filter(op => 
            op.status === 'failed' && op.type === type
        );
    }

    // Получение операций с ошибками по периоду
    getFailedOperationsByPeriod(startDate, endDate) {
        return this.getOperationsByPeriod(startDate, endDate)
            .filter(op => op.status === 'failed');
    }

    // Получение операций с ошибками за сегодня
    getTodayFailedOperations() {
        return this.getTodayOperations().filter(op => op.status === 'failed');
    }

    // Получение операций с ошибками за неделю
    getWeekFailedOperations() {
        return this.getWeekOperations().filter(op => op.status === 'failed');
    }

    // Получение операций с ошибками за месяц
    getMonthFailedOperations() {
        return this.getMonthOperations().filter(op => op.status === 'failed');
    }

    // Получение операций с ошибками по активу
    getFailedOperationsByAsset(assetId) {
        return this.getOperationsByAsset(assetId)
            .filter(op => op.status === 'failed');
    }

    // Получение операций с ошибками по методу
    getFailedOperationsByMethod(method) {
        return this.getOperationsByMethod(method)
            .filter(op => op.status === 'failed');
    }

    // Получение операций с ошибками по диапазону сумм
    getFailedOperationsByAmountRange(minAmount, maxAmount) {
        return this.getOperationsByAmountRange(minAmount, maxAmount)
            .filter(op => op.status === 'failed');
    }

    // Получение операций с ошибками по комиссии
    getFailedOperationsByFeeRange(minFee, maxFee) {
        return this.getOperationsByFeeRange(minFee, maxFee)
            .filter(op => op.status === 'failed');
    }
}

// Создание глобального экземпляра
window.operationsManager = new OperationsManager(window.balanceManager);
