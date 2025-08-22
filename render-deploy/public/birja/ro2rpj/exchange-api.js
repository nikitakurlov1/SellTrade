// API интеграция биржи с CRM
class ExchangeAPI {
    constructor() {
        this.baseURL = window.location.origin;
        this.token = localStorage.getItem('authToken');
    }

    // Установка токена авторизации
    setToken(token) {
        this.token = token;
        localStorage.setItem('authToken', token);
    }

    // Получение токена
    getToken() {
        return this.token || localStorage.getItem('authToken');
    }

    // Проверка авторизации
    isAuthenticated() {
        return !!this.getToken();
    }

    // Базовый запрос к API
    async makeRequest(endpoint, options = {}) {
        const token = this.getToken();
        if (!token) {
            throw new Error('Токен авторизации не найден');
        }

        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        };

        const response = await fetch(`${this.baseURL}${endpoint}`, {
            ...defaultOptions,
            ...options
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.errors?.[0] || `HTTP ${response.status}: ${response.statusText}`);
        }

        return response.json();
    }

    // Получение всех монет
    async getCoins() {
        try {
            const response = await this.makeRequest('/api/coins');
            return response.coins || [];
        } catch (error) {
            console.error('Ошибка получения монет:', error);
            throw error;
        }
    }

    // Получение конкретной монеты
    async getCoin(coinId) {
        try {
            const response = await this.makeRequest(`/api/coins/${coinId}`);
            return response.coin;
        } catch (error) {
            console.error('Ошибка получения монеты:', error);
            throw error;
        }
    }

    // Получение истории цен монеты
    async getCoinPriceHistory(coinId, limit = 100, startDate = null, endDate = null) {
        try {
            let url = `/api/coins/${coinId}/price-history?limit=${limit}`;
            
            if (startDate && endDate) {
                url += `&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
            }
            
            const response = await this.makeRequest(url);
            return response.priceHistory || [];
        } catch (error) {
            console.error('Ошибка получения истории цен:', error);
            throw error;
        }
    }

    // Получение баланса пользователя
    async getBalance() {
        try {
            const response = await this.makeRequest('/api/exchange/balance');
            return response.balance || { USD: 0, BTC: 0, ETH: 0 };
        } catch (error) {
            console.error('Ошибка получения баланса:', error);
            throw error;
        }
    }

    // Получение портфеля пользователя
    async getPortfolio() {
        try {
            const response = await this.makeRequest('/api/exchange/portfolio');
            return response.portfolio || {
                assets: {},
                totalValue: 0,
                totalInvested: 0,
                totalProfit: 0,
                profitPercent: 0
            };
        } catch (error) {
            console.error('Ошибка получения портфеля:', error);
            throw error;
        }
    }

    // Синхронизация портфеля с балансом
    async syncPortfolio() {
        try {
            const response = await this.makeRequest('/api/exchange/sync-portfolio', {
                method: 'POST'
            });
            return response;
        } catch (error) {
            console.error('Ошибка синхронизации портфеля:', error);
            throw error;
        }
    }

    // Покупка актива
    async buyAsset(assetId, usdAmount) {
        try {
            const response = await this.makeRequest('/api/exchange/buy', {
                method: 'POST',
                body: JSON.stringify({
                    assetId: assetId,
                    usdAmount: usdAmount
                })
            });
            return response;
        } catch (error) {
            console.error('Ошибка покупки актива:', error);
            throw error;
        }
    }

    // Продажа актива
    async sellAsset(assetId, cryptoAmount) {
        try {
            const response = await this.makeRequest('/api/exchange/sell', {
                method: 'POST',
                body: JSON.stringify({
                    assetId: assetId,
                    cryptoAmount: cryptoAmount
                })
            });
            return response;
        } catch (error) {
            console.error('Ошибка продажи актива:', error);
            throw error;
        }
    }

    // Получение транзакций пользователя
    async getTransactions(limit = 50) {
        try {
            const response = await this.makeRequest(`/api/exchange/transactions?limit=${limit}`);
            return response.transactions || [];
        } catch (error) {
            console.error('Ошибка получения транзакций:', error);
            throw error;
        }
    }

    // Обновление баланса (только для админа)
    async updateUserBalance(userId, balance) {
        try {
            const response = await this.makeRequest(`/api/exchange/balance/${userId}`, {
                method: 'PUT',
                body: JSON.stringify({ balance: balance })
            });
            return response;
        } catch (error) {
            console.error('Ошибка обновления баланса:', error);
            throw error;
        }
    }

    // Получение данных пользователя
    async getUserProfile() {
        try {
            const response = await this.makeRequest('/api/users/profile');
            return response.user;
        } catch (error) {
            console.error('Ошибка получения профиля:', error);
            throw error;
        }
    }

    // Тестовый метод для проверки статуса
    async getTestStatus() {
        try {
            const response = await this.makeRequest('/api/test/status');
            return response;
        } catch (error) {
            console.error('Ошибка получения тестового статуса:', error);
            throw error;
        }
    }

    // Обновление профиля пользователя
    async updateProfile(updates) {
        try {
            const response = await this.makeRequest('/api/users/profile', {
                method: 'PUT',
                body: JSON.stringify(updates)
            });
            return response;
        } catch (error) {
            console.error('Ошибка обновления профиля:', error);
            throw error;
        }
    }

    // Выход из системы
    logout() {
        this.token = null;
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
        window.location.href = '/';
    }

    // Проверка статуса соединения
    async checkConnection() {
        try {
            await this.makeRequest('/api/coins');
            return true;
        } catch (error) {
            console.error('Ошибка соединения с сервером:', error);
            return false;
        }
    }

    // Получение статистики
    async getStats() {
        try {
            const [balance, portfolio, transactions] = await Promise.all([
                this.getBalance(),
                this.getPortfolio(),
                this.getTransactions(10)
            ]);

            return {
                balance: balance,
                portfolio: portfolio,
                recentTransactions: transactions,
                totalValue: balance.USD + portfolio.totalValue,
                profitPercent: portfolio.profitPercent
            };
        } catch (error) {
            console.error('Ошибка получения статистики:', error);
            throw error;
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

    // Форматирование процентов
    formatPercent(value) {
        return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
    }

    // Получение иконки для монеты
    getCoinIcon(symbol) {
        const icons = {
            'BTC': 'fab fa-bitcoin',
            'ETH': 'fab fa-ethereum',
            'BNB': 'fas fa-coins',
            'SOL': 'fas fa-bolt',
            'ADA': 'fas fa-coins',
            'XRP': 'fas fa-coins',
            'DOT': 'fas fa-circle',
            'DOGE': 'fas fa-dog',
            'AVAX': 'fas fa-mountain',
            'LINK': 'fas fa-link',
            'MATIC': 'fas fa-polygon',
            'UNI': 'fas fa-exchange-alt',
            'LTC': 'fas fa-coins',
            'XLM': 'fas fa-star',
            'ATOM': 'fas fa-atom',
            'XMR': 'fas fa-user-secret',
            'ALGO': 'fas fa-cogs',
            'VET': 'fas fa-car',
            'FIL': 'fas fa-hdd',
            'ICP': 'fas fa-network-wired'
        };
        return icons[symbol] || 'fas fa-coins';
    }

    // Получение цвета для монеты
    getCoinColor(symbol) {
        const colors = {
            'BTC': '#f7931a',
            'ETH': '#627eea',
            'BNB': '#f3ba2f',
            'SOL': '#9945ff',
            'ADA': '#0033ad',
            'XRP': '#23292f',
            'DOT': '#e6007a',
            'DOGE': '#c2a633',
            'AVAX': '#e84142',
            'LINK': '#2a5ada',
            'MATIC': '#8247e5',
            'UNI': '#ff007a',
            'LTC': '#345d9d',
            'XLM': '#000000',
            'ATOM': '#2e3148',
            'XMR': '#ff6600',
            'ALGO': '#000000',
            'VET': '#15bdff',
            'FIL': '#0090ff',
            'ICP': '#29b6f6'
        };
        return colors[symbol] || '#6c757d';
    }
}

// Создание глобального экземпляра API
window.exchangeAPI = new ExchangeAPI();
