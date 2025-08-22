// Global variables
let authToken = localStorage.getItem('authToken');
let currentUser = JSON.parse(localStorage.getItem('currentUser'));
let currentCoin = null;
let priceChart = null;

// DOM elements
const currentUserElement = document.getElementById('currentUser');
const logoutBtn = document.getElementById('logoutBtn');
const editInfoBtn = document.getElementById('editInfoBtn');
const editInfoModal = document.getElementById('editInfoModal');
const closeEditModal = document.getElementById('closeEditModal');
const cancelEdit = document.getElementById('cancelEdit');
const editInfoForm = document.getElementById('editInfoForm');
const simulationForm = document.getElementById('simulationForm');
const simulationType = document.getElementById('simulationType');
const timeInputGroup = document.getElementById('timeInputGroup');
const dateInputGroup = document.getElementById('dateInputGroup');
const resetSimulation = document.getElementById('resetSimulation');
const stopSimulationBtn = document.getElementById('stopSimulation');
const simulationResults = document.getElementById('simulationResults');
const refreshChartBtn = document.getElementById('refreshChartBtn');
const loadingOverlay = document.getElementById('loadingOverlay');
const notificationContainer = document.getElementById('notificationContainer');

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    setupEventListeners();
    loadCoinData();
    initializeChart();
});

// Check authentication
function checkAuth() {
    if (!authToken || !currentUser) {
        window.location.href = '/';
        return;
    }
    
    currentUserElement.textContent = currentUser.username || currentUser.email;
}

// Setup event listeners
function setupEventListeners() {
    // Logout
    logoutBtn.addEventListener('click', handleLogout);
    
    // Edit info modal
    editInfoBtn.addEventListener('click', () => editInfoModal.classList.add('active'));
    closeEditModal.addEventListener('click', () => editInfoModal.classList.remove('active'));
    cancelEdit.addEventListener('click', () => editInfoModal.classList.remove('active'));
    editInfoForm.addEventListener('submit', handleEditInfo);
    
    // Simulation form
    simulationForm.addEventListener('submit', handleSimulation);
    simulationType.addEventListener('change', handleSimulationTypeChange);
    resetSimulation.addEventListener('click', resetSimulationForm);
    stopSimulationBtn.addEventListener('click', stopSimulation);
    
    // Chart controls
    refreshChartBtn.addEventListener('click', updateChart);
    
    // Close modal on outside click
    editInfoModal.addEventListener('click', (e) => {
        if (e.target === editInfoModal) {
            editInfoModal.classList.remove('active');
        }
    });
}

// Load coin data from URL parameters
async function loadCoinData() {
    console.log('loadCoinData called');
    
    const urlParams = new URLSearchParams(window.location.search);
    const coinId = urlParams.get('id');
    
    console.log('URL params:', { coinId, authToken: authToken ? 'present' : 'missing' });
    
    if (!coinId) {
        showNotification('Ошибка!', 'ID монеты не указан', 'error');
        return;
    }
    
    try {
        showLoading(true);
        console.log('Fetching coin data for:', coinId);
        
        const response = await fetch(`/api/coins/${coinId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        console.log('Coin data response status:', response.status);
        
        const result = await response.json();
        console.log('Coin data result:', result);
        
        if (result.success) {
            currentCoin = result.coin;
            console.log('Current coin set:', currentCoin);
            updateCoinDisplay();
            updateChart();
        } else {
            showNotification('Ошибка!', result.errors.join(', '), 'error');
        }
    } catch (error) {
        console.error('Error loading coin data:', error);
        showNotification('Ошибка!', 'Не удалось загрузить данные монеты', 'error');
    } finally {
        showLoading(false);
    }
}

// Update coin display
function updateCoinDisplay() {
    if (!currentCoin) return;
    
    // Update header
    document.getElementById('coinName').textContent = currentCoin.name;
    document.getElementById('coinSymbol').textContent = currentCoin.symbol;
    document.getElementById('coinCategory').textContent = getCategoryDisplayName(currentCoin.category);
    
    // Update price info
    document.getElementById('currentPrice').textContent = formatPrice(currentCoin.price);
    document.getElementById('marketCap').textContent = formatMarketCap(currentCoin.marketCap);
    document.getElementById('volume24h').textContent = formatVolume(currentCoin.volume);
    
    // Update price change
    const priceChangeElement = document.getElementById('priceChange');
    const change = currentCoin.priceChange || 0;
    priceChangeElement.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
    priceChangeElement.className = `price-change ${change >= 0 ? 'positive' : 'negative'}`;
    
    // Update info section
    document.getElementById('infoName').textContent = currentCoin.name;
    document.getElementById('infoSymbol').textContent = currentCoin.symbol;
    document.getElementById('infoCategory').textContent = getCategoryDisplayName(currentCoin.category);
    document.getElementById('infoStatus').textContent = getStatusDisplayName(currentCoin.status);
    document.getElementById('infoDescription').textContent = currentCoin.description || 'Описание не указано';
    
    // Update edit form
    document.getElementById('editName').value = currentCoin.name;
    document.getElementById('editSymbol').value = currentCoin.symbol;
    document.getElementById('editCategory').value = currentCoin.category;
    document.getElementById('editStatus').value = currentCoin.status;
    document.getElementById('editDescription').value = currentCoin.description || '';
}

// Initialize chart
function initializeChart() {
    const ctx = document.getElementById('priceChart').getContext('2d');
    
    priceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Цена (USD)',
                data: [],
                borderColor: '#00d4aa',
                backgroundColor: 'rgba(0, 212, 170, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            return 'Цена: $' + context.parsed.y.toLocaleString();
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                },
                y: {
                    grid: {
                        color: '#f0f0f0'
                    },
                    ticks: {
                        callback: function(value) {
                            return '$' + value.toLocaleString();
                        }
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });
}

// Update chart with real data from database
async function updateChart() {
    if (!currentCoin) return;
    
    try {
        showLoading(true);
        
        // Get price history from database
        const response = await fetch(`/api/coins/${currentCoin.id}/price-history?limit=100`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            const priceHistory = result.priceHistory;
            
            // Sort by timestamp (oldest first)
            priceHistory.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            
            // Prepare chart data
            const labels = priceHistory.map(item => formatChartLabel(new Date(item.timestamp)));
            const prices = priceHistory.map(item => item.price);
            
            // Update chart
            priceChart.data.labels = labels;
            priceChart.data.datasets[0].data = prices;
            priceChart.update();
            
            console.log(`Chart updated with ${priceHistory.length} data points`);
        } else {
            showNotification('Ошибка!', 'Не удалось загрузить данные графика', 'error');
        }
    } catch (error) {
        console.error('Error updating chart:', error);
        showNotification('Ошибка!', 'Не удалось загрузить данные графика', 'error');
    } finally {
        showLoading(false);
    }
}

// Format chart label
function formatChartLabel(date) {
    return date.toLocaleTimeString('ru-RU', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
}

// Simulation is now handled by backend - no need for frontend simulation overlay



// Handle edit info form submission
async function handleEditInfo(e) {
    e.preventDefault();
    
    const formData = new FormData(editInfoForm);
    const data = {
        name: formData.get('name'),
        symbol: formData.get('symbol'),
        category: formData.get('category'),
        status: formData.get('status'),
        description: formData.get('description')
    };
    
    try {
        showLoading(true);
        const response = await fetch(`/api/coins/${currentCoin.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            currentCoin = { ...currentCoin, ...data };
            updateCoinDisplay();
            editInfoModal.classList.remove('active');
            showNotification('Успешно!', 'Информация о монете обновлена', 'success');
        } else {
            showNotification('Ошибка!', result.errors.join(', '), 'error');
        }
    } catch (error) {
        console.error('Error updating coin info:', error);
        showNotification('Ошибка!', 'Не удалось обновить информацию', 'error');
    } finally {
        showLoading(false);
    }
}

// Handle simulation form submission
async function handleSimulation(e) {
    e.preventDefault();
    
    const formData = new FormData(simulationForm);
    const targetPrice = parseFloat(formData.get('targetPrice'));
    const simulationType = formData.get('simulationType');
    const timeMinutes = formData.get('timeMinutes');
    const targetDate = formData.get('targetDate');
    
    if (!targetPrice || targetPrice <= 0) {
        showNotification('Ошибка!', 'Введите корректную целевую цену', 'error');
        return;
    }
    
    // Check if currentCoin is available
    if (!currentCoin || !currentCoin.id) {
        console.error('currentCoin is not available:', currentCoin);
        showNotification('Ошибка!', 'Данные монеты не загружены', 'error');
        return;
    }
    
    console.log('currentCoin data:', currentCoin);
    
    // Calculate time in minutes
    let durationMinutes;
    if (simulationType === 'time') {
        if (!timeMinutes || timeMinutes <= 0) {
            showNotification('Ошибка!', 'Введите корректное время', 'error');
            return;
        }
        durationMinutes = parseInt(timeMinutes);
    } else {
        if (!targetDate) {
            showNotification('Ошибка!', 'Выберите целевую дату', 'error');
            return;
        }
        const targetDateTime = new Date(targetDate);
        const now = new Date();
        durationMinutes = Math.round((targetDateTime - now) / (1000 * 60));
        
        if (durationMinutes <= 0) {
            showNotification('Ошибка!', 'Целевая дата должна быть в будущем', 'error');
            return;
        }
    }
    
    try {
        showLoading(true);
        
        console.log('Sending simulation request:', {
            coinId: currentCoin.id,
            targetPrice,
            durationMinutes,
            authToken: authToken ? 'present' : 'missing'
        });
        
        // Send simulation request to backend
        const response = await fetch(`/api/coins/${currentCoin.id}/simulation`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                targetPrice: targetPrice,
                timeMinutes: durationMinutes
            })
        });
        
        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers);
        
        const result = await response.json();
        console.log('Response data:', result);
        
        if (result.success) {
            const currentPrice = currentCoin.price;
            const change = ((targetPrice - currentPrice) / currentPrice) * 100;
            
            // Update results
            document.getElementById('resultCurrentPrice').textContent = formatPrice(currentPrice);
            document.getElementById('resultTargetPrice').textContent = formatPrice(targetPrice);
            document.getElementById('resultChange').textContent = `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
            document.getElementById('resultTime').textContent = `${durationMinutes} минут`;
            
            // Show results
            simulationResults.classList.remove('hidden');
            
            // Start monitoring simulation progress
            startSimulationMonitoring();
            
            showNotification('Успешно!', 'Симуляция запущена на сервере', 'success');
        } else {
            console.error('Simulation failed:', result.errors);
            showNotification('Ошибка!', result.errors.join(', '), 'error');
        }
    } catch (error) {
        console.error('Error starting simulation:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack
        });
        showNotification('Ошибка!', 'Не удалось запустить симуляцию: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}



// Handle simulation type change
function handleSimulationTypeChange() {
    const type = simulationType.value;
    
    if (type === 'time') {
        timeInputGroup.classList.remove('hidden');
        dateInputGroup.classList.add('hidden');
    } else {
        timeInputGroup.classList.add('hidden');
        dateInputGroup.classList.remove('hidden');
    }
}

// Start monitoring simulation progress
function startSimulationMonitoring() {
    // Update chart every 30 seconds to show simulation progress
    const monitoringInterval = setInterval(async () => {
        try {
            // Check simulation status
            const response = await fetch(`/api/coins/${currentCoin.id}/simulation`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            
            const result = await response.json();
            
            if (result.success && result.simulation) {
                // Simulation is active, update chart
                updateChart();
            } else {
                // Simulation completed, stop monitoring
                clearInterval(monitoringInterval);
                showNotification('Информация!', 'Симуляция завершена', 'info');
            }
        } catch (error) {
            console.error('Error monitoring simulation:', error);
        }
    }, 30000); // 30 seconds
    
    // Store interval reference for cleanup
    window.simulationMonitoringInterval = monitoringInterval;
}

// Stop simulation
async function stopSimulation() {
    try {
        const response = await fetch(`/api/coins/${currentCoin.id}/simulation/stop`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('Успешно!', 'Симуляция остановлена', 'success');
            resetSimulationForm();
        } else {
            showNotification('Ошибка!', result.errors.join(', '), 'error');
        }
    } catch (error) {
        console.error('Error stopping simulation:', error);
        showNotification('Ошибка!', 'Не удалось остановить симуляцию', 'error');
    }
}

// Reset simulation form
function resetSimulationForm() {
    simulationForm.reset();
    simulationResults.classList.add('hidden');
    
    // Stop monitoring if active
    if (window.simulationMonitoringInterval) {
        clearInterval(window.simulationMonitoringInterval);
        window.simulationMonitoringInterval = null;
    }
    
    // Remove simulation from chart
    if (priceChart.data.datasets.length > 1) {
        priceChart.data.datasets = [priceChart.data.datasets[0]];
        priceChart.update();
    }
}

// Handle logout
function handleLogout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    window.location.href = '/';
}

// Utility functions
function formatPrice(price) {
    if (price >= 1) {
        return '$' + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else {
        return '$' + price.toFixed(6);
    }
}

function formatMarketCap(marketCap) {
    if (marketCap >= 1e12) {
        return '$' + (marketCap / 1e12).toFixed(2) + 'T';
    } else if (marketCap >= 1e9) {
        return '$' + (marketCap / 1e9).toFixed(2) + 'B';
    } else if (marketCap >= 1e6) {
        return '$' + (marketCap / 1e6).toFixed(2) + 'M';
    } else {
        return '$' + marketCap.toLocaleString();
    }
}

function formatVolume(volume) {
    if (volume >= 1e12) {
        return '$' + (volume / 1e12).toFixed(2) + 'T';
    } else if (volume >= 1e9) {
        return '$' + (volume / 1e9).toFixed(2) + 'B';
    } else if (volume >= 1e6) {
        return '$' + (volume / 1e6).toFixed(2) + 'M';
    } else {
        return '$' + volume.toLocaleString();
    }
}

function getCategoryDisplayName(category) {
    const categories = {
        'defi': 'DeFi',
        'gaming': 'Gaming',
        'infrastructure': 'Инфраструктура',
        'meme': 'Meme'
    };
    return categories[category] || category;
}

function getStatusDisplayName(status) {
    const statuses = {
        'active': 'Активная',
        'inactive': 'Неактивная',
        'pending': 'Ожидающая'
    };
    return statuses[status] || status;
}

// Loading and notification functions
function showLoading(show) {
    if (show) {
        loadingOverlay.classList.remove('hidden');
    } else {
        loadingOverlay.classList.add('hidden');
    }
}

function showNotification(title, message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <h4>${title}</h4>
        <p>${message}</p>
    `;
    
    notificationContainer.appendChild(notification);
    
    // Show notification
    setTimeout(() => notification.classList.add('show'), 100);
    
    // Remove notification after 5 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}
