// Global variables
let currentUser = null;
let authToken = localStorage.getItem('authToken');

// DOM elements
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const switchFormLinks = document.querySelectorAll('.switch-form');
const loadingOverlay = document.getElementById('loadingOverlay');
const notificationContainer = document.getElementById('notificationContainer');
const logoutBtn = document.getElementById('logoutBtn');

// Form containers
const loginContainer = document.getElementById('login-form');
const registerContainer = document.getElementById('register-form');
const dashboardContainer = document.getElementById('dashboard');

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    setupFormValidation();
    setupPasswordToggles();
    
    // Check if user is already logged in
    if (authToken) {
        checkAuthStatus();
    }
});

function initializeApp() {
    // Show login form by default
    showView('login');
}

function setupEventListeners() {
    // Switch form links
    switchFormLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = link.dataset.target;
            showView(target);
        });
    });

    // Form submissions
    loginForm.addEventListener('submit', handleLogin);
    registerForm.addEventListener('submit', handleRegistration);

    // Logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Real-time validation
    setupRealTimeValidation();
}

function setupFormValidation() {
    // Password strength checker
    const passwordInput = document.getElementById('registerPassword');
    if (passwordInput) {
        passwordInput.addEventListener('input', checkPasswordStrength);
    }

    // Confirm password checker
    const confirmPasswordInput = document.getElementById('confirmPassword');
    if (confirmPasswordInput) {
        confirmPasswordInput.addEventListener('input', checkPasswordMatch);
    }
}

function setupPasswordToggles() {
    const passwordToggles = document.querySelectorAll('.password-toggle');
    passwordToggles.forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            e.preventDefault();
            const input = toggle.parentElement.querySelector('input');
            const icon = toggle.querySelector('i');
            
            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                input.type = 'password';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        });
    });
}

function setupRealTimeValidation() {
    // Username validation
    const usernameInput = document.getElementById('username');
    if (usernameInput) {
        let usernameTimeout;
        usernameInput.addEventListener('input', () => {
            clearTimeout(usernameTimeout);
            usernameTimeout = setTimeout(() => {
                checkUsernameAvailability(usernameInput.value);
            }, 500);
        });
    }

    // Email validation
    const emailInput = document.getElementById('registerEmail');
    if (emailInput) {
        let emailTimeout;
        emailInput.addEventListener('input', () => {
            clearTimeout(emailTimeout);
            emailTimeout = setTimeout(() => {
                checkEmailAvailability(emailInput.value);
            }, 500);
        });
    }
}

// View management
function showView(view) {
    // Hide all containers
    loginContainer.classList.add('hidden');
    registerContainer.classList.add('hidden');
    dashboardContainer.classList.add('hidden');

    // Show selected view
    switch (view) {
        case 'login':
            loginContainer.classList.remove('hidden');
            break;
        case 'register':
            registerContainer.classList.remove('hidden');
            break;
        case 'dashboard':
            dashboardContainer.classList.remove('hidden');
            break;
    }
}

// Authentication functions
async function handleLogin(e) {
    e.preventDefault();
    
    const formData = new FormData(loginForm);
    const data = {
        email: formData.get('email'),
        password: formData.get('password')
    };

    try {
        showLoading(true);
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
            authToken = result.token;
            currentUser = result.user;
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('user', JSON.stringify(currentUser));
            
            showNotification('Успешно!', 'Вход выполнен успешно', 'success');
            
            // Check if it's admin account and redirect to coin management
            if (currentUser.username === 'AdminNKcoin') {
                window.location.href = '/coin.html';
            } else {
                // Check user status for non-admin users
                if (currentUser.status !== 'active') {
                    showAccountStatusMessage(currentUser.status);
                }
                // Redirect to exchange
                window.location.href = '/birja/ro2rpj/index.html';
            }
        } else {
            showNotification('Ошибка!', result.errors.join(', '), 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showNotification('Ошибка!', 'Произошла ошибка при входе', 'error');
    } finally {
        showLoading(false);
    }
}

async function handleRegistration(e) {
    e.preventDefault();
    
    const formData = new FormData(registerForm);
    const data = {
        username: formData.get('username'),
        email: formData.get('email'),
        password: formData.get('password'),
        confirmPassword: formData.get('confirmPassword')
    };

    // Client-side validation
    if (!validateRegistrationData(data)) {
        return;
    }

    try {
        showLoading(true);
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
            authToken = result.token;
            currentUser = result.user;
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('user', JSON.stringify(currentUser));
            
            showNotification('Успешно!', 'Аккаунт создан успешно. Ожидайте подтверждения от администратора.', 'success');
            // Redirect to exchange
            window.location.href = '/birja/ro2rpj/index.html';
        } else {
            showNotification('Ошибка!', result.errors.join(', '), 'error');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showNotification('Ошибка!', 'Произошла ошибка при регистрации', 'error');
    } finally {
        showLoading(false);
    }
}

function handleLogout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    
    showNotification('Информация', 'Вы вышли из аккаунта', 'info');
    showView('login');
}

async function checkAuthStatus() {
    try {
        const response = await fetch('/api/account', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                currentUser = JSON.parse(localStorage.getItem('user'));
                
                // Check user status
                if (currentUser.username !== 'AdminNKcoin' && currentUser.status !== 'active') {
                    showAccountStatusMessage(currentUser.status);
                }
                
                showView('dashboard');
                loadDashboardData();
                return;
            }
        } else if (response.status === 403) {
            const result = await response.json();
            showNotification('Аккаунт не активен', result.errors[0], 'error');
            handleLogout();
            return;
        }
        
        // If auth check fails, clear stored data
        handleLogout();
    } catch (error) {
        console.error('Auth check error:', error);
        handleLogout();
    }
}

function showAccountStatusMessage(status) {
    const statusMessages = {
        'pending': 'Ваш аккаунт находится на рассмотрении. Ожидайте подтверждения от администратора.',
        'rejected': 'Ваш аккаунт был отклонен. Обратитесь к администратору для уточнения деталей.',
        'processing': 'Ваш аккаунт находится в обработке. Ожидайте решения от администратора.'
    };
    
    const message = statusMessages[status] || 'Ваш аккаунт не активен. Обратитесь к администратору.';
    showNotification('Статус аккаунта', message, 'info');
}

// Validation functions
function validateRegistrationData(data) {
    const errors = [];

    if (!data.username || data.username.length < 3) {
        errors.push('Имя пользователя должно содержать минимум 3 символа');
    }

    if (!data.email || !isValidEmail(data.email)) {
        errors.push('Введите корректный email');
    }

    if (!data.password || data.password.length < 6) {
        errors.push('Пароль должен содержать минимум 6 символов');
    }

    if (data.password !== data.confirmPassword) {
        errors.push('Пароли не совпадают');
    }

    if (errors.length > 0) {
        showNotification('Ошибка валидации!', errors.join(', '), 'error');
        return false;
    }

    return true;
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function checkPasswordStrength(e) {
    const password = e.target.value;
    const strengthIndicator = document.getElementById('passwordStrength');
    
    if (!strengthIndicator) return;

    let strength = 0;
    let feedback = '';

    if (password.length >= 6) strength++;
    if (password.match(/[a-z]/)) strength++;
    if (password.match(/[A-Z]/)) strength++;
    if (password.match(/[0-9]/)) strength++;
    if (password.match(/[^a-zA-Z0-9]/)) strength++;

    strengthIndicator.className = 'password-strength';
    
    if (strength < 2) {
        strengthIndicator.classList.add('weak');
        feedback = 'Слабый пароль';
    } else if (strength < 4) {
        strengthIndicator.classList.add('medium');
        feedback = 'Средний пароль';
    } else {
        strengthIndicator.classList.add('strong');
        feedback = 'Сильный пароль';
    }
}

function checkPasswordMatch(e) {
    const confirmPassword = e.target.value;
    const password = document.getElementById('registerPassword').value;
    const input = e.target;
    
    if (confirmPassword && password !== confirmPassword) {
        input.style.borderColor = '#ef4444';
    } else {
        input.style.borderColor = '#e5e7eb';
    }
}

async function checkUsernameAvailability(username) {
    if (!username || username.length < 3) return;

    try {
        const response = await fetch(`/api/check-username/${username}`);
        const result = await response.json();
        
        const indicator = document.getElementById('usernameIndicator');
        if (indicator) {
            indicator.className = 'validation-indicator';
            if (result.available) {
                indicator.classList.add('valid');
                indicator.innerHTML = '<i class="fas fa-check"></i>';
            } else {
                indicator.classList.add('invalid');
                indicator.innerHTML = '<i class="fas fa-times"></i>';
            }
        }
    } catch (error) {
        console.error('Username check error:', error);
    }
}

async function checkEmailAvailability(email) {
    if (!email || !isValidEmail(email)) return;

    try {
        const response = await fetch(`/api/check-email/${email}`);
        const result = await response.json();
        
        const indicator = document.getElementById('emailIndicator');
        if (indicator) {
            indicator.className = 'validation-indicator';
            if (result.available) {
                indicator.classList.add('valid');
                indicator.innerHTML = '<i class="fas fa-check"></i>';
            } else {
                indicator.classList.add('invalid');
                indicator.innerHTML = '<i class="fas fa-times"></i>';
            }
        }
    } catch (error) {
        console.error('Email check error:', error);
    }
}

// Dashboard functions
async function loadDashboardData() {
    try {
        const response = await fetch('/api/account', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                updateDashboard(result.account);
            }
        }
    } catch (error) {
        console.error('Dashboard load error:', error);
    }
}

function updateDashboard(account) {
    // Update user name
    const userNameElement = document.getElementById('userName');
    if (userNameElement && currentUser) {
        userNameElement.textContent = currentUser.username;
    }

    // Show admin features
    const userManagementCard = document.getElementById('userManagementCard');
    if (userManagementCard && currentUser && currentUser.username === 'AdminNKcoin') {
        userManagementCard.style.display = 'block';
    }

    // Update balances
    const usdBalance = document.getElementById('usdBalance');
    const btcBalance = document.getElementById('btcBalance');
    const ethBalance = document.getElementById('ethBalance');

    if (usdBalance) {
        usdBalance.textContent = `$${account.balance.USD.toFixed(2)}`;
    }
    if (btcBalance) {
        btcBalance.textContent = account.balance.BTC.toFixed(8);
    }
    if (ethBalance) {
        ethBalance.textContent = account.balance.ETH.toFixed(8);
    }
}

// Utility functions
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

    // Auto remove after 5 seconds
    setTimeout(() => {
        notification.remove();
    }, 5000);

    // Remove on click
    notification.addEventListener('click', () => {
        notification.remove();
    });
}

// Feature card click handlers
document.addEventListener('click', (e) => {
    if (e.target.closest('.feature-card')) {
        const card = e.target.closest('.feature-card');
        const title = card.querySelector('h4').textContent;
        
        showNotification('Информация', `Функция "${title}" будет доступна в ближайшее время`, 'info');
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + Enter to submit forms
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        const activeForm = document.querySelector('.auth-form:not(.hidden)');
        if (activeForm) {
            activeForm.dispatchEvent(new Event('submit'));
        }
    }
    
    // Escape to close notifications
    if (e.key === 'Escape') {
        const notifications = document.querySelectorAll('.notification');
        notifications.forEach(notification => notification.remove());
    }
});

// Auto-save form data
function setupFormAutoSave() {
    const forms = [loginForm, registerForm];
    
    forms.forEach(form => {
        if (!form) return;
        
        const inputs = form.querySelectorAll('input');
        inputs.forEach(input => {
            input.addEventListener('input', () => {
                const formData = new FormData(form);
                const data = {};
                for (let [key, value] of formData.entries()) {
                    data[key] = value;
                }
                localStorage.setItem(`form_${form.id}`, JSON.stringify(data));
            });
        });
    });
}

// Load saved form data
function loadSavedFormData() {
    const forms = [loginForm, registerForm];
    
    forms.forEach(form => {
        if (!form) return;
        
        const savedData = localStorage.getItem(`form_${form.id}`);
        if (savedData) {
            try {
                const data = JSON.parse(savedData);
                Object.keys(data).forEach(key => {
                    const input = form.querySelector(`[name="${key}"]`);
                    if (input && !input.value) {
                        input.value = data[key];
                    }
                });
            } catch (error) {
                console.error('Error loading saved form data:', error);
            }
        }
    });
}

// Initialize form auto-save
setupFormAutoSave();
loadSavedFormData();
