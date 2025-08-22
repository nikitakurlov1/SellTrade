// Global variables
let currentUser = null;
let authToken = localStorage.getItem('authToken');
let users = [];
let currentPage = 1;
let itemsPerPage = 10;
let filteredUsers = [];

// DOM elements
const addUserBtn = document.getElementById('addUserBtn');
const refreshUsersBtn = document.getElementById('refreshUsersBtn');
const addUserModal = document.getElementById('addUserModal');
const editUserModal = document.getElementById('editUserModal');
const closeModal = document.getElementById('closeModal');
const closeEditModal = document.getElementById('closeEditModal');
const cancelAdd = document.getElementById('cancelAdd');
const cancelEdit = document.getElementById('cancelEdit');
const addUserForm = document.getElementById('addUserForm');
const editUserForm = document.getElementById('editUserForm');
const searchInput = document.getElementById('searchInput');
const statusFilter = document.getElementById('statusFilter');
const sortFilter = document.getElementById('sortFilter');
const usersTableBody = document.getElementById('usersTableBody');
const loadingOverlay = document.getElementById('loadingOverlay');
const notificationContainer = document.getElementById('notificationContainer');
const logoutBtn = document.getElementById('logoutBtn');
const currentUserElement = document.getElementById('currentUser');

// Stats elements
const totalUsersElement = document.getElementById('totalUsers');
const activeUsersElement = document.getElementById('activeUsers');
const pendingUsersElement = document.getElementById('pendingUsers');
const rejectedUsersElement = document.getElementById('rejectedUsers');

// Pagination elements
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const pageNumbersElement = document.getElementById('pageNumbers');

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    setupEventListeners();
    loadUsers();
    
    // Auto-refresh users data every 2 minutes
    setInterval(loadUsers, 2 * 60 * 1000);
});

function checkAuth() {
    if (!authToken) {
        window.location.href = '/';
        return;
    }

    // Get user info from localStorage
    const userData = localStorage.getItem('user');
    if (userData) {
        currentUser = JSON.parse(userData);
        if (currentUserElement) {
            currentUserElement.textContent = currentUser.username;
        }
        
        // Check if user is admin
        if (currentUser.username !== 'AdminNKcoin') {
            showNotification('Ошибка доступа', 'У вас нет прав для доступа к этой странице', 'error');
            window.location.href = '/';
            return;
        }
    }
}

function setupEventListeners() {
    // Modal events
    addUserBtn.addEventListener('click', showAddUserModal);
    closeModal.addEventListener('click', hideAddUserModal);
    closeEditModal.addEventListener('click', hideEditUserModal);
    cancelAdd.addEventListener('click', hideAddUserModal);
    cancelEdit.addEventListener('click', hideEditUserModal);
    
    // Close modal on outside click
    addUserModal.addEventListener('click', (e) => {
        if (e.target === addUserModal) {
            hideAddUserModal();
        }
    });
    
    editUserModal.addEventListener('click', (e) => {
        if (e.target === editUserModal) {
            hideEditUserModal();
        }
    });

    // Form submission
    addUserForm.addEventListener('submit', handleAddUser);
    editUserForm.addEventListener('submit', handleEditUser);

    // Refresh users button
    if (refreshUsersBtn) {
        refreshUsersBtn.addEventListener('click', loadUsers);
    }

    // Search and filters
    searchInput.addEventListener('input', handleSearch);
    statusFilter.addEventListener('change', handleFilters);
    sortFilter.addEventListener('change', handleFilters);

    // Pagination
    prevPageBtn.addEventListener('click', () => changePage(currentPage - 1));
    nextPageBtn.addEventListener('click', () => changePage(currentPage + 1));

    // Logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideAddUserModal();
            hideEditUserModal();
        }
    });
}

// Modal functions
function showAddUserModal() {
    addUserModal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

function hideAddUserModal() {
    addUserModal.classList.remove('show');
    document.body.style.overflow = 'auto';
    addUserForm.reset();
}

function showEditUserModal(user) {
    // Populate form with user data
    document.getElementById('editUserId').value = user.id;
    document.getElementById('editUserUsername').value = user.username;
    document.getElementById('editUserEmail').value = user.email;
    document.getElementById('editUserStatus').value = user.status || 'pending';
    document.getElementById('editUserBalance').value = user.balance?.USD || 0;
    document.getElementById('editUserNotes').value = user.notes || '';
    
    editUserModal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

function hideEditUserModal() {
    editUserModal.classList.remove('show');
    document.body.style.overflow = 'auto';
    editUserForm.reset();
}

// API functions
async function loadUsers() {
    try {
        showLoading(true);
        const response = await fetch('/api/users', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                users = result.users;
                filteredUsers = [...users];
                console.log(`Loaded ${users.length} users from server`);
                updateStats();
                renderUsers();
            }
        } else if (response.status === 401) {
            handleLogout();
        } else if (response.status === 403) {
            showNotification('Ошибка доступа', 'У вас нет прав для просмотра пользователей', 'error');
        }
    } catch (error) {
        console.error('Error loading users:', error);
        showNotification('Ошибка!', 'Не удалось загрузить пользователей', 'error');
    } finally {
        showLoading(false);
    }
}

async function handleAddUser(e) {
    e.preventDefault();
    
    const formData = new FormData(addUserForm);
    const userData = {
        username: formData.get('username'),
        email: formData.get('email'),
        password: formData.get('password'),
        status: formData.get('status'),
        notes: formData.get('notes')
    };

    try {
        showLoading(true);
        const response = await fetch('/api/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(userData)
        });

        const result = await response.json();

        if (result.success) {
            showNotification('Успешно!', 'Пользователь добавлен', 'success');
            hideAddUserModal();
            loadUsers(); // Reload users
        } else {
            showNotification('Ошибка!', result.errors.join(', '), 'error');
        }
    } catch (error) {
        console.error('Error adding user:', error);
        showNotification('Ошибка!', 'Не удалось добавить пользователя', 'error');
    } finally {
        showLoading(false);
    }
}

async function handleEditUser(e) {
    e.preventDefault();
    
    const formData = new FormData(editUserForm);
    const userId = formData.get('id');
    const userData = {
        username: formData.get('username'),
        email: formData.get('email'),
        status: formData.get('status'),
        balance: parseFloat(formData.get('balance')) || 0,
        notes: formData.get('notes')
    };

    try {
        showLoading(true);
        const response = await fetch(`/api/users/${userId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(userData)
        });

        const result = await response.json();

        if (result.success) {
            showNotification('Успешно!', 'Пользователь обновлен', 'success');
            hideEditUserModal();
            loadUsers(); // Reload users
        } else {
            showNotification('Ошибка!', result.errors.join(', '), 'error');
        }
    } catch (error) {
        console.error('Error updating user:', error);
        showNotification('Ошибка!', 'Не удалось обновить пользователя', 'error');
    } finally {
        showLoading(false);
    }
}

async function deleteUser(userId) {
    if (!confirm('Вы уверены, что хотите удалить этого пользователя?')) {
        return;
    }

    try {
        showLoading(true);
        const response = await fetch(`/api/users/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        const result = await response.json();

        if (result.success) {
            showNotification('Успешно!', 'Пользователь удален', 'success');
            loadUsers(); // Reload users
        } else {
            showNotification('Ошибка!', result.errors.join(', '), 'error');
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        showNotification('Ошибка!', 'Не удалось удалить пользователя', 'error');
    } finally {
        showLoading(false);
    }
}

// Search and filter functions
function handleSearch() {
    const searchTerm = searchInput.value.toLowerCase();
    applyFilters(searchTerm);
}

function handleFilters() {
    const searchTerm = searchInput.value.toLowerCase();
    applyFilters(searchTerm);
}

function applyFilters(searchTerm) {
    filteredUsers = users.filter(user => {
        const matchesSearch = user.username.toLowerCase().includes(searchTerm) ||
                             user.email.toLowerCase().includes(searchTerm);
        
        const matchesStatus = !statusFilter.value || user.status === statusFilter.value;
        
        return matchesSearch && matchesStatus;
    });

    // Sort users
    const sortBy = sortFilter.value;
    filteredUsers.sort((a, b) => {
        switch (sortBy) {
            case 'username':
                return a.username.localeCompare(b.username);
            case 'email':
                return a.email.localeCompare(b.email);
            case 'status':
                return a.status.localeCompare(b.status);
            case 'createdAt':
            default:
                return new Date(b.createdAt) - new Date(a.createdAt);
        }
    });

    currentPage = 1;
    renderUsers();
}

// Rendering functions
function renderUsers() {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const usersToShow = filteredUsers.slice(startIndex, endIndex);

    usersTableBody.innerHTML = '';

    if (usersToShow.length === 0) {
        usersTableBody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 2rem; color: #666;">
                    Пользователи не найдены
                </td>
            </tr>
        `;
        return;
    }

    usersToShow.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <input type="checkbox" value="${user.id}">
            </td>
            <td>
                <div class="user-info-row">
                    <div class="user-avatar">${user.username.charAt(0).toUpperCase()}</div>
                    <div class="user-details">
                        <div class="user-name">${user.username}</div>
                        <div class="user-id">ID: ${user.id}</div>
                    </div>
                </div>
            </td>
            <td>${user.email}</td>
            <td>${formatDate(user.createdAt)}</td>
            <td>
                <span class="status-badge ${user.status || 'pending'}">${getStatusText(user.status || 'pending')}</span>
            </td>
            <td>$${formatNumber(user.balance?.USD || 0)}</td>
            <td>${user.lastLogin ? formatDate(user.lastLogin) : 'Никогда'}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-view btn-sm" onclick="viewUser('${user.id}')" title="Просмотр">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-edit btn-sm" onclick="editUser('${user.id}')" title="Редактировать">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-delete btn-sm" onclick="deleteUser('${user.id}')" title="Удалить">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        usersTableBody.appendChild(row);
    });

    updatePagination();
}

function updateStats() {
    const totalUsers = users.length;
    const activeUsers = users.filter(user => user.status === 'active').length;
    const pendingUsers = users.filter(user => user.status === 'pending').length;
    const rejectedUsers = users.filter(user => user.status === 'rejected').length;

    if (totalUsersElement) totalUsersElement.textContent = totalUsers;
    if (activeUsersElement) activeUsersElement.textContent = activeUsers;
    if (pendingUsersElement) pendingUsersElement.textContent = pendingUsers;
    if (rejectedUsersElement) rejectedUsersElement.textContent = rejectedUsers;
}

function updatePagination() {
    const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
    
    // Update buttons
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages;

    // Update page numbers
    pageNumbersElement.innerHTML = '';
    
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
        const pageNumber = document.createElement('span');
        pageNumber.className = `page-number ${i === currentPage ? 'active' : ''}`;
        pageNumber.textContent = i;
        pageNumber.addEventListener('click', () => changePage(i));
        pageNumbersElement.appendChild(pageNumber);
    }
}

function changePage(page) {
    const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
    if (page >= 1 && page <= totalPages) {
        currentPage = page;
        renderUsers();
    }
}

// Utility functions
function formatNumber(num) {
    if (num >= 1e9) {
        return (num / 1e9).toFixed(2) + 'B';
    } else if (num >= 1e6) {
        return (num / 1e6).toFixed(2) + 'M';
    } else if (num >= 1e3) {
        return (num / 1e3).toFixed(2) + 'K';
    } else {
        return num.toFixed(2);
    }
}

function formatDate(dateString) {
    if (!dateString) return 'Неизвестно';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getStatusText(status) {
    const statusMap = {
        'active': 'Активный',
        'pending': 'Ожидающий',
        'rejected': 'Отклоненный',
        'processing': 'В проработке'
    };
    return statusMap[status] || status;
}

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

function handleLogout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    
    showNotification('Информация', 'Вы вышли из аккаунта', 'info');
    window.location.href = '/';
}

// User action functions
function viewUser(userId) {
    const user = users.find(u => u.id === userId);
    if (user) {
        // Show user details in a modal or redirect to user detail page
        showNotification('Информация', `Просмотр пользователя: ${user.username}`, 'info');
    }
}

function editUser(userId) {
    const user = users.find(u => u.id === userId);
    if (user) {
        showEditUserModal(user);
    }
}

// Export functions for global access
window.viewUser = viewUser;
window.editUser = editUser;
window.deleteUser = deleteUser;
