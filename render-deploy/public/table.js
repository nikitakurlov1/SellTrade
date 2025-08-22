class SalaryCalculator {
    constructor() {
        this.tableBody = document.getElementById('tableBody');
        this.rowCounter = 0;
        this.activityLog = [];
        this.teamLeaders = new Map();
        this.brokers = new Map();
        this.analysts = new Map();
        this.managers = new Map();
        this.admins = new Map();
        this.undoStack = [];
        this.redoStack = [];
        this.selectedRows = new Set();
        this.currentPage = 1;
        this.itemsPerPage = 20;
        this.filteredData = [];
        this.sortConfig = { column: 'rowNumber', direction: 'asc' };
        this.charts = {};
        this.currentView = 'dashboard'; // dashboard, table, reports
        
        // Настройки процентов (после комиссии 30%)
        this.settings = {
            teamLeaderPercent: 5,
            brokerDepositPercent: 50,
            brokerDodepPercent: 45,
            brokerTaxPercent: 30,
            analystPercent: 15,
            managerPercent: 10,
            commissionPercent: 30
        };
        
        // Список тим-лидеров (максимум 5)
        this.teamLeadersList = ['Тим-лидер 1', 'Тим-лидер 2', 'Тим-лидер 3', 'Тим-лидер 4', 'Тим-лидер 5'];
        
        this.initEventListeners();
        this.initSidebar();
        this.initHotkeys();
        this.initAutocomplete();
        this.initValidation();
        this.initAutoSave();
        this.loadSettings();
        this.updateDashboard();
    }

    initEventListeners() {
        // Боковая панель
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                this.handleSidebarAction(action);
            });
        });

        // Верхняя панель
        document.getElementById('sidebarToggle').addEventListener('click', () => this.toggleSidebar());
        document.getElementById('helpBtn').addEventListener('click', () => this.showHelpModal());

        // Поиск и фильтры
        document.getElementById('searchInput').addEventListener('input', (e) => this.handleSearch(e.target.value));
        document.getElementById('clearSearchBtn').addEventListener('click', () => this.clearSearch());
        document.getElementById('teamFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('brokerFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('statusFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('dateFilter').addEventListener('change', () => this.applyFilters());

        // Сортировка
        document.getElementById('toggleSortBtn').addEventListener('click', () => this.toggleSortPanel());
        document.getElementById('applySortBtn').addEventListener('click', () => this.applySort());

        // Выбор строк
        document.getElementById('selectAllCheckbox').addEventListener('change', (e) => this.toggleSelectAll(e.target.checked));
        document.getElementById('deleteSelectedBtn').addEventListener('click', () => this.deleteSelected());

        // Пагинация
        document.getElementById('prevPageBtn').addEventListener('click', () => this.previousPage());
        document.getElementById('nextPageBtn').addEventListener('click', () => this.nextPage());

        // Модальные окна
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => this.closeModals());
        });

        // Настройки
        document.getElementById('saveSettingsBtn').addEventListener('click', () => this.saveSettings());
        document.getElementById('resetSettingsBtn').addEventListener('click', () => this.resetSettings());
        document.getElementById('addTeamLeaderBtn').addEventListener('click', () => this.addTeamLeader());

        // Лог
        document.getElementById('clearLogBtn').addEventListener('click', () => this.clearLog());
        document.getElementById('exportLogBtn').addEventListener('click', () => this.exportLog());

        // Undo/Redo
        document.getElementById('undoBtn').addEventListener('click', () => this.undo());
        document.getElementById('redoBtn').addEventListener('click', () => this.redo());
    }

    initSidebar() {
        // Обработчик для мобильного меню
        document.addEventListener('click', (e) => {
            if (e.target.closest('.sidebar') || e.target.closest('#sidebarToggle')) {
                return;
            }
            
            const sidebar = document.querySelector('.sidebar');
            if (sidebar && sidebar.classList.contains('open')) {
                sidebar.classList.remove('open');
            }
        });
    }

    handleSidebarAction(action) {
        switch(action) {
            case 'add-team':
                this.addRow('team');
                break;
            case 'add-broker':
                this.addRow('broker');
                break;
            case 'add-analyst':
                this.addRow('analyst');
                break;
            case 'add-manager':
                this.addRow('manager');
                break;
            case 'calculate-all':
                this.calculateAll();
                break;
            case 'export':
                this.showExportModal();
                break;
            case 'settings':
                this.showSettingsModal();
                break;
            case 'dashboard':
                this.showView('dashboard');
                break;
            case 'reports':
                this.showView('reports');
                break;
            case 'analytics':
                this.showView('reports');
                this.switchToTab('charts');
                break;
        }
    }

    showView(view) {
        this.currentView = view;
        
        // Скрываем все панели
        document.getElementById('dashboardPanel').style.display = 'none';
        document.getElementById('table-section').style.display = 'none';
        document.getElementById('reportsPanel').style.display = 'none';
        
        // Показываем нужную панель
        switch(view) {
            case 'dashboard':
                document.getElementById('dashboardPanel').style.display = 'block';
                this.updateDashboard();
                break;
            case 'table':
                document.getElementById('table-section').style.display = 'block';
                break;
            case 'reports':
                document.getElementById('reportsPanel').style.display = 'block';
                break;
        }
        
        // Обновляем активную кнопку в сайдбаре
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const activeBtn = document.querySelector(`[data-action="${view}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
    }

    switchToTab(tabName) {
        // Переключаем на нужную вкладку в отчётах
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        document.querySelectorAll('.report-panel').forEach(panel => {
            panel.classList.remove('active');
        });
        
        const tabBtn = document.querySelector(`[data-tab="${tabName}"]`);
        const tabPanel = document.getElementById(tabName);
        
        if (tabBtn && tabPanel) {
            tabBtn.classList.add('active');
            tabPanel.classList.add('active');
        }
    }

    toggleSidebar() {
        const sidebar = document.querySelector('.sidebar');
        sidebar.classList.toggle('open');
    }

    updateDashboard() {
        // Обновляем метрики в дашборде
        const rows = this.tableBody.querySelectorAll('tr');
        let totalIncome = 0;
        let totalCommission = 0;
        let activeDeals = 0;
        let completedDeals = 0;
        let todayDeals = 0;
        let todayIncome = 0;
        
        const today = new Date().toDateString();
        
        rows.forEach(row => {
            const deposit = parseFloat(row.querySelector('input[name="deposit"]')?.value) || 0;
            const dodep = parseFloat(row.querySelector('input[name="dodep"]')?.value) || 0;
            const tax1 = parseFloat(row.querySelector('input[name="tax1"]')?.value) || 0;
            const tax2 = parseFloat(row.querySelector('input[name="tax2"]')?.value) || 0;
            const tax3 = parseFloat(row.querySelector('input[name="tax3"]')?.value) || 0;
            const tax4 = parseFloat(row.querySelector('input[name="tax4"]')?.value) || 0;
            const tax5 = parseFloat(row.querySelector('input[name="tax5"]')?.value) || 0;
            const commission = parseFloat(row.querySelector('input[name="commission"]')?.value) || 0;
            const status = row.querySelector('select[name="status"]')?.value || '';
            const rowDate = new Date(row.dataset.date || Date.now()).toDateString();
            
            const rowIncome = deposit + dodep + tax1 + tax2 + tax3 + tax4 + tax5;
            totalIncome += rowIncome;
            totalCommission += commission;
            
            if (status === 'completed') {
                completedDeals++;
            } else if (status !== 'reject') {
                activeDeals++;
            }
            
            if (rowDate === today) {
                todayDeals++;
                todayIncome += rowIncome;
            }
        });
        
        // Обновляем метрики
        document.getElementById('totalIncomeMetric').textContent = totalIncome.toFixed(2) + ' ₽';
        document.getElementById('commissionMetric').textContent = totalCommission.toFixed(2) + ' ₽';
        document.getElementById('activeDeals').textContent = activeDeals;
        document.getElementById('completedDeals').textContent = completedDeals;
        document.getElementById('todayDeals').textContent = todayDeals;
        document.getElementById('todayIncome').textContent = todayIncome.toFixed(2) + ' ₽';
        
        // Обновляем сайдбар
        document.getElementById('sidebarRecords').textContent = rows.length;
        document.getElementById('sidebarIncome').textContent = totalIncome.toFixed(2) + ' ₽';
        
        // Обновляем статистику команды
        this.updateStatistics();
        document.getElementById('teamCount').textContent = this.teamLeaders.size;
        document.getElementById('brokerCount').textContent = this.brokers.size;
    }

    showNotification(message, type = 'info', duration = 5000) {
        const notifications = document.getElementById('notifications');
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        notifications.appendChild(notification);
        
        // Автоматически удаляем уведомление
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, duration);
        
        return notification;
    }

    addRow(type) {
        this.saveState();
        this.rowCounter++;
        const row = document.createElement('tr');
        row.id = `row-${this.rowCounter}`;
        row.dataset.type = type;
        row.dataset.date = new Date().toISOString();

        const cells = [
            this.createCheckboxCell(),
            this.createNumberCell(this.rowCounter),
            this.createSelectCell('teamLeader', this.teamLeadersList, 'Выберите тим-лидера'),
            this.createInputCell('broker', 'text', 'Имя брокера'),
            this.createInputCell('analyst', 'text', 'Имя аналитика'),
            this.createInputCell('manager', 'text', 'Имя менеджера'),
            this.createInputCell('admin1', 'text', 'Имя админ 1'),
            this.createInputCell('admin2', 'text', 'Имя админ 2'),
            this.createInputCell('client', 'text', 'Имя клиента'),
            this.createStatusCell(),
            this.createInputCell('deposit', 'number', '0', 'number-cell'),
            this.createInputCell('dodep', 'number', '0', 'number-cell'),
            this.createTaxesCell(),
            this.createReadonlyCell('teamSalary', '0.00', 'salary-cell team-salary number-cell'),
            this.createReadonlyCell('brokerSalary', '0.00', 'salary-cell broker-salary number-cell'),
            this.createReadonlyCell('analystSalary', '0.00', 'salary-cell analyst-salary number-cell'),
            this.createReadonlyCell('managerSalary', '0.00', 'salary-cell manager-salary number-cell'),
            this.createReadonlyCell('adminSalaries', '0.00', 'salary-cell admin-salary number-cell'),
            this.createReadonlyCell('commission', '0.00', 'commission-cell number-cell'),
            this.createDateCell(),
            this.createActionCell(this.rowCounter)
        ];

        cells.forEach(cell => row.appendChild(cell));
        this.tableBody.appendChild(row);

        this.addCalculationListeners(row);
        this.logActivity(`Добавлена строка №${this.rowCounter} (${type === 'team' ? 'Тим-лидер' : type})`, 'success');
        this.updateSummary();
        this.updateDashboard();
        this.updateFilters();
        
        this.showNotification(`Добавлена новая запись №${this.rowCounter}`, 'success');
    }

    createTaxesCell() {
        const cell = document.createElement('td');
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.gap = '4px';
        
        for (let i = 1; i <= 5; i++) {
            const input = document.createElement('input');
            input.type = 'number';
            input.name = `tax${i}`;
            input.placeholder = '0';
            input.className = 'number-cell';
            input.style.width = '60px';
            input.style.fontSize = '12px';
            container.appendChild(input);
        }
        
        cell.appendChild(container);
        return cell;
    }

    createCheckboxCell() {
        const cell = document.createElement('td');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.addEventListener('change', (e) => this.toggleRowSelection(e.target));
        cell.appendChild(checkbox);
        return cell;
    }

    createDateCell() {
        const cell = document.createElement('td');
        const date = new Date().toLocaleDateString('ru-RU');
        cell.textContent = date;
        cell.className = 'date-cell';
        return cell;
    }

    createNumberCell(value) {
        const cell = document.createElement('td');
        cell.textContent = value;
        cell.className = 'number-cell';
        cell.style.textAlign = 'center';
        cell.style.fontWeight = 'bold';
        return cell;
    }

    createInputCell(name, type, placeholder, className = '') {
        const cell = document.createElement('td');
        const input = document.createElement('input');
        input.type = type;
        input.name = name;
        input.placeholder = placeholder;
        input.className = className;
        if (type === 'number') {
            input.step = '0.01';
            input.min = '0';
        }
        cell.appendChild(input);
        return cell;
    }

    createTextareaCell(name, placeholder) {
        const cell = document.createElement('td');
        const textarea = document.createElement('textarea');
        textarea.name = name;
        textarea.placeholder = placeholder;
        textarea.rows = '2';
        textarea.style.resize = 'vertical';
        cell.appendChild(textarea);
        return cell;
    }

    createReadonlyCell(name, value, className = '') {
        const cell = document.createElement('td');
        const input = document.createElement('input');
        input.type = 'text';
        input.name = name;
        input.value = value;
        input.readOnly = true;
        input.className = className;
        cell.appendChild(input);
        return cell;
    }

    createActionCell(rowId) {
        const cell = document.createElement('td');
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '×';
        deleteBtn.className = 'btn btn-small btn-delete';
        deleteBtn.title = 'Удалить строку';
        deleteBtn.onclick = () => this.deleteRow(rowId);
        
        const calculateBtn = document.createElement('button');
        calculateBtn.textContent = '✓';
        calculateBtn.className = 'btn btn-small btn-edit';
        calculateBtn.title = 'Рассчитать строку';
        calculateBtn.onclick = () => this.calculateRow(rowId);

        cell.className = 'action-buttons';
        cell.appendChild(calculateBtn);
        cell.appendChild(deleteBtn);
        return cell;
    }

    createSelectCell(name, options, placeholder) {
        const cell = document.createElement('td');
        const select = document.createElement('select');
        select.name = name;
        select.className = 'status-select';
        
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = placeholder;
        select.appendChild(defaultOption);
        
        options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option;
            optionElement.textContent = option;
            select.appendChild(optionElement);
        });
        
        cell.appendChild(select);
        return cell;
    }

    createStatusCell() {
        const cell = document.createElement('td');
        const select = document.createElement('select');
        select.name = 'status';
        select.className = 'status-select';
        
        const statuses = [
            { value: 'robot', text: 'Робот' },
            { value: 'reject', text: 'Отказ' },
            { value: 'search', text: 'Поиск' },
            { value: 'completed', text: 'Завершен' }
        ];
        
        statuses.forEach(status => {
            const option = document.createElement('option');
            option.value = status.value;
            option.textContent = status.text;
            select.appendChild(option);
        });
        
        select.addEventListener('change', (e) => {
            this.updateRowStatus(e.target.closest('tr'), e.target.value);
        });
        
        cell.appendChild(select);
        return cell;
    }

    updateRowStatus(row, status) {
        // Убираем все классы статусов
        row.classList.remove('status-robot', 'status-reject', 'status-search', 'status-completed');
        
        // Добавляем новый класс статуса
        if (status) {
            row.classList.add(`status-${status}`);
        }
        
        this.logActivity(`Изменен статус клиента в строке ${row.id} на "${status}"`, 'info');
    }

    addCalculationListeners(row) {
        const inputs = row.querySelectorAll('input[type="number"]');
        inputs.forEach(input => {
            input.addEventListener('input', () => {
                this.calculateRow(row.id);
                this.logActivity(`Обновлены данные в строке ${row.id}`, 'info');
            });
        });

        const textInputs = row.querySelectorAll('input[type="text"], textarea');
        textInputs.forEach(input => {
            input.addEventListener('change', () => {
                this.logActivity(`Обновлено поле "${input.name}" в строке ${row.id}`, 'info');
            });
        });
    }

    calculateRow(rowId) {
        const row = document.getElementById(rowId);
        if (!row) return;

        const deposit = parseFloat(row.querySelector('input[name="deposit"]').value) || 0;
        const dodep = parseFloat(row.querySelector('input[name="dodep"]').value) || 0;
        const tax1 = parseFloat(row.querySelector('input[name="tax1"]').value) || 0;
        const tax2 = parseFloat(row.querySelector('input[name="tax2"]').value) || 0;
        const tax3 = parseFloat(row.querySelector('input[name="tax3"]').value) || 0;
        const tax4 = parseFloat(row.querySelector('input[name="tax4"]').value) || 0;
        const tax5 = parseFloat(row.querySelector('input[name="tax5"]').value) || 0;

        const totalIncome = deposit + dodep + tax1 + tax2 + tax3 + tax4 + tax5;
        const commission = totalIncome * (this.settings.commissionPercent / 100);
        const incomeAfterCommission = totalIncome - commission;

        // Расчет ЗП тим-лидера (5% от дохода после комиссии)
        const teamSalary = incomeAfterCommission * (this.settings.teamLeaderPercent / 100);

        // Расчет ЗП брокера
        const brokerDepositCommission = deposit * (this.settings.brokerDepositPercent / 100);
        const brokerDodepCommission = dodep * (this.settings.brokerDodepPercent / 100);
        const totalTaxes = tax1 + tax2 + tax3 + tax4 + tax5;
        const brokerTaxCommission = totalTaxes * (this.settings.brokerTaxPercent / 100);
        const brokerSalary = brokerDepositCommission + brokerDodepCommission + brokerTaxCommission;

        // Расчет ЗП аналитика (15% от дохода после комиссии)
        const analystSalary = incomeAfterCommission * (this.settings.analystPercent / 100);

        // Расчет ЗП менеджера (10% от дохода после комиссии)
        const managerSalary = incomeAfterCommission * (this.settings.managerPercent / 100);

        // Остальной доход делим между двумя админами
        const remainingIncome = incomeAfterCommission - teamSalary - analystSalary - managerSalary;
        const admin1Salary = remainingIncome / 2;
        const admin2Salary = remainingIncome / 2;

        // Обновляем ячейки с зарплатами
        row.querySelector('input[name="teamSalary"]').value = teamSalary.toFixed(2);
        row.querySelector('input[name="brokerSalary"]').value = brokerSalary.toFixed(2);
        row.querySelector('input[name="analystSalary"]').value = analystSalary.toFixed(2);
        row.querySelector('input[name="managerSalary"]').value = managerSalary.toFixed(2);
        row.querySelector('input[name="adminSalaries"]').value = (admin1Salary + admin2Salary).toFixed(2);
        row.querySelector('input[name="commission"]').value = commission.toFixed(2);

        this.updateStatistics();
        this.updateSummary();
        this.updateDashboard();
    }

    updateStatistics() {
        this.teamLeaders.clear();
        this.brokers.clear();
        this.analysts.clear();
        this.managers.clear();
        this.admins.clear();

        const rows = this.tableBody.querySelectorAll('tr');
        rows.forEach(row => {
            const teamLeader = row.querySelector('select[name="teamLeader"]')?.value || row.querySelector('input[name="teamLeader"]')?.value || '';
            const broker = row.querySelector('input[name="broker"]')?.value || '';
            const analyst = row.querySelector('input[name="analyst"]')?.value || '';
            const manager = row.querySelector('input[name="manager"]')?.value || '';
            const admin1 = row.querySelector('input[name="admin1"]')?.value || '';
            const admin2 = row.querySelector('input[name="admin2"]')?.value || '';

            const teamSalary = parseFloat(row.querySelector('input[name="teamSalary"]')?.value) || 0;
            const brokerSalary = parseFloat(row.querySelector('input[name="brokerSalary"]')?.value) || 0;
            const analystSalary = parseFloat(row.querySelector('input[name="analystSalary"]')?.value) || 0;
            const managerSalary = parseFloat(row.querySelector('input[name="managerSalary"]')?.value) || 0;
            const admin1Salary = parseFloat(row.querySelector('input[name="admin1Salary"]')?.value) || 0;
            const admin2Salary = parseFloat(row.querySelector('input[name="admin2Salary"]')?.value) || 0;

            if (teamLeader) {
                if (!this.teamLeaders.has(teamLeader)) {
                    this.teamLeaders.set(teamLeader, { totalSalary: 0, clients: 0, transactions: 0 });
                }
                const stats = this.teamLeaders.get(teamLeader);
                stats.totalSalary += teamSalary;
                stats.clients += 1;
                stats.transactions += 1;
            }

            if (broker) {
                if (!this.brokers.has(broker)) {
                    this.brokers.set(broker, { totalSalary: 0, clients: 0, transactions: 0 });
                }
                const stats = this.brokers.get(broker);
                stats.totalSalary += brokerSalary;
                stats.clients += 1;
                stats.transactions += 1;
            }

            if (analyst) {
                if (!this.analysts.has(analyst)) {
                    this.analysts.set(analyst, { totalSalary: 0, clients: 0, transactions: 0 });
                }
                const stats = this.analysts.get(analyst);
                stats.totalSalary += analystSalary;
                stats.clients += 1;
                stats.transactions += 1;
            }

            if (manager) {
                if (!this.managers.has(manager)) {
                    this.managers.set(manager, { totalSalary: 0, clients: 0, transactions: 0 });
                }
                const stats = this.managers.get(manager);
                stats.totalSalary += managerSalary;
                stats.clients += 1;
                stats.transactions += 1;
            }

            if (admin1) {
                if (!this.admins.has(admin1)) {
                    this.admins.set(admin1, { totalSalary: 0, clients: 0, transactions: 0 });
                }
                const stats = this.admins.get(admin1);
                stats.totalSalary += admin1Salary;
                stats.clients += 1;
                stats.transactions += 1;
            }

            if (admin2) {
                if (!this.admins.has(admin2)) {
                    this.admins.set(admin2, { totalSalary: 0, clients: 0, transactions: 0 });
                }
                const stats = this.admins.get(admin2);
                stats.totalSalary += admin2Salary;
                stats.clients += 1;
                stats.transactions += 1;
            }
        });
    }

    updateReports() {
        this.updateTeamReport();
        this.updateBrokerReport();
        this.updateActivityLog();
        this.updateCharts();
    }

    updateTeamReport() {
        const content = document.getElementById('teamReportContent');
        if (!content) return;

        if (this.teamLeaders.size === 0) {
            content.innerHTML = '<p>Нет данных о тим-лидерах</p>';
            return;
        }

        let html = '';
        for (const [name, stats] of this.teamLeaders) {
            html += `
                <div class="report-item">
                    <div class="report-name">${name}</div>
                    <div class="report-details">
                        <span>Клиентов: ${stats.clients}</span>
                        <span>Сделок: ${stats.transactions}</span>
                        <span class="report-amount">${stats.totalSalary.toFixed(2)} ₽</span>
                    </div>
                </div>
            `;
        }
        content.innerHTML = html;
    }

    updateBrokerReport() {
        const content = document.getElementById('brokerReportContent');
        if (!content) return;

        if (this.brokers.size === 0) {
            content.innerHTML = '<p>Нет данных о брокерах</p>';
            return;
        }

        let html = '';
        for (const [name, stats] of this.brokers) {
            html += `
                <div class="report-item">
                    <div class="report-name">${name}</div>
                    <div class="report-details">
                        <span>Клиентов: ${stats.clients}</span>
                        <span>Сделок: ${stats.transactions}</span>
                        <span class="report-amount">${stats.totalSalary.toFixed(2)} ₽</span>
                    </div>
                </div>
            `;
        }
        content.innerHTML = html;
    }

    updateActivityLog() {
        const content = document.getElementById('activityLogContent');
        if (!content) return;

        if (this.activityLog.length === 0) {
            content.innerHTML = '<p>Лог активности пуст</p>';
            return;
        }

        let html = '';
        this.activityLog.forEach(entry => {
            html += `
                <div class="log-entry ${entry.type}">
                    <div class="log-time">${entry.timestamp}</div>
                    <div class="log-message">${entry.message}</div>
                </div>
            `;
        });
        content.innerHTML = html;
    }

    calculateAll() {
        const rows = this.tableBody.querySelectorAll('tr');
        rows.forEach(row => {
            this.calculateRow(row.id);
        });
        
        this.showNotification(`Рассчитано ${rows.length} записей`, 'success');
        this.logActivity(`Выполнен расчёт всех записей (${rows.length} шт.)`, 'success');
    }

    updateSummary() {
        let totalTeamSalary = 0;
        let totalBrokerSalary = 0;
        let totalAnalystSalary = 0;
        let totalManagerSalary = 0;
        let totalAdminSalary = 0;
        let totalIncome = 0;
        let totalCommission = 0;
        let totalRecords = 0;

        const rows = this.tableBody.querySelectorAll('tr');
        rows.forEach(row => {
            const teamSalary = parseFloat(row.querySelector('input[name="teamSalary"]')?.value) || 0;
            const brokerSalary = parseFloat(row.querySelector('input[name="brokerSalary"]')?.value) || 0;
            const analystSalary = parseFloat(row.querySelector('input[name="analystSalary"]')?.value) || 0;
            const managerSalary = parseFloat(row.querySelector('input[name="managerSalary"]')?.value) || 0;
            const admin1Salary = parseFloat(row.querySelector('input[name="admin1Salary"]')?.value) || 0;
            const admin2Salary = parseFloat(row.querySelector('input[name="admin2Salary"]')?.value) || 0;
            const commission = parseFloat(row.querySelector('input[name="commission"]')?.value) || 0;
            
            const deposit = parseFloat(row.querySelector('input[name="deposit"]')?.value) || 0;
            const dodep = parseFloat(row.querySelector('input[name="dodep"]')?.value) || 0;
            const tax1 = parseFloat(row.querySelector('input[name="tax1"]')?.value) || 0;
            const tax2 = parseFloat(row.querySelector('input[name="tax2"]')?.value) || 0;
            const tax3 = parseFloat(row.querySelector('input[name="tax3"]')?.value) || 0;
            const tax4 = parseFloat(row.querySelector('input[name="tax4"]')?.value) || 0;
            const tax5 = parseFloat(row.querySelector('input[name="tax5"]')?.value) || 0;

            totalTeamSalary += teamSalary;
            totalBrokerSalary += brokerSalary;
            totalAnalystSalary += analystSalary;
            totalManagerSalary += managerSalary;
            totalAdminSalary += admin1Salary + admin2Salary;
            totalCommission += commission;
            totalIncome += deposit + dodep + tax1 + tax2 + tax3 + tax4 + tax5;
            totalRecords++;
        });

        document.getElementById('totalTeamSalary').textContent = totalTeamSalary.toFixed(2) + ' ₽';
        document.getElementById('totalBrokerSalary').textContent = totalBrokerSalary.toFixed(2) + ' ₽';
        document.getElementById('totalAnalystSalary').textContent = totalAnalystSalary.toFixed(2) + ' ₽';
        document.getElementById('totalManagerSalary').textContent = totalManagerSalary.toFixed(2) + ' ₽';
        document.getElementById('totalAdminSalary').textContent = totalAdminSalary.toFixed(2) + ' ₽';
        document.getElementById('totalIncome').textContent = totalIncome.toFixed(2) + ' ₽';
        document.getElementById('totalCommission').textContent = totalCommission.toFixed(2) + ' ₽';
        document.getElementById('totalRecords').textContent = totalRecords;
    }

    deleteRow(rowId) {
        const row = document.getElementById(rowId);
        if (row) {
            const rowNumber = row.querySelector('td:nth-child(2)').textContent;
            row.remove();
            this.updateStatistics();
            this.updateSummary();
            this.logActivity(`Удалена строка №${rowNumber}`, 'warning');
        }
    }

    clearAll() {
        if (confirm('Вы уверены, что хотите очистить всю таблицу?')) {
            this.tableBody.innerHTML = '';
            this.rowCounter = 0;
            this.teamLeaders.clear();
            this.brokers.clear();
            this.analysts.clear();
            this.managers.clear();
            this.admins.clear();
            this.activityLog = [];
            this.selectedRows.clear();
            this.updateSummary();
            this.updateReports();
            this.logActivity('Таблица полностью очищена', 'error');
        }
    }

    exportData() {
        const data = this.exportDataToJSON();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `salary_calculator_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.logActivity('Данные экспортированы в JSON файл', 'success');
    }

    exportDataToJSON() {
        const data = {
            timestamp: new Date().toISOString(),
            summary: {
                totalTeamSalary: parseFloat(document.getElementById('totalTeamSalary').textContent) || 0,
                totalBrokerSalary: parseFloat(document.getElementById('totalBrokerSalary').textContent) || 0,
                totalAnalystSalary: parseFloat(document.getElementById('totalAnalystSalary').textContent) || 0,
                totalManagerSalary: parseFloat(document.getElementById('totalManagerSalary').textContent) || 0,
                totalAdminSalary: parseFloat(document.getElementById('totalAdminSalary').textContent) || 0,
                totalIncome: parseFloat(document.getElementById('totalIncome').textContent) || 0,
                totalCommission: parseFloat(document.getElementById('totalCommission').textContent) || 0,
                totalRecords: parseInt(document.getElementById('totalRecords').textContent) || 0
            },
            teamLeaders: Object.fromEntries(this.teamLeaders),
            brokers: Object.fromEntries(this.brokers),
            analysts: Object.fromEntries(this.analysts),
            managers: Object.fromEntries(this.managers),
            admins: Object.fromEntries(this.admins),
            rows: [],
            activityLog: this.activityLog
        };

        const rows = this.tableBody.querySelectorAll('tr');
        rows.forEach(row => {
            const rowData = {
                rowNumber: row.querySelector('td:nth-child(2)').textContent,
                type: row.dataset.type,
                teamLeader: row.querySelector('select[name="teamLeader"]')?.value || row.querySelector('input[name="teamLeader"]').value,
                broker: row.querySelector('input[name="broker"]').value,
                analyst: row.querySelector('input[name="analyst"]').value,
                manager: row.querySelector('input[name="manager"]').value,
                admin1: row.querySelector('input[name="admin1"]').value,
                admin2: row.querySelector('input[name="admin2"]').value,
                client: row.querySelector('input[name="client"]').value,
                status: row.querySelector('select[name="status"]')?.value || row.querySelector('input[name="status"]').value,
                deposit: parseFloat(row.querySelector('input[name="deposit"]').value) || 0,
                dodep: parseFloat(row.querySelector('input[name="dodep"]').value) || 0,
                tax1: parseFloat(row.querySelector('input[name="tax1"]').value) || 0,
                tax2: parseFloat(row.querySelector('input[name="tax2"]').value) || 0,
                tax3: parseFloat(row.querySelector('input[name="tax3"]').value) || 0,
                tax4: parseFloat(row.querySelector('input[name="tax4"]').value) || 0,
                tax5: parseFloat(row.querySelector('input[name="tax5"]').value) || 0,
                teamSalary: parseFloat(row.querySelector('input[name="teamSalary"]').value) || 0,
                brokerSalary: parseFloat(row.querySelector('input[name="brokerSalary"]').value) || 0,
                analystSalary: parseFloat(row.querySelector('input[name="analystSalary"]').value) || 0,
                managerSalary: parseFloat(row.querySelector('input[name="managerSalary"]').value) || 0,
                admin1Salary: parseFloat(row.querySelector('input[name="admin1Salary"]').value) || 0,
                admin2Salary: parseFloat(row.querySelector('input[name="admin2Salary"]').value) || 0,
                commission: parseFloat(row.querySelector('input[name="commission"]').value) || 0,
                comment: row.querySelector('textarea[name="comment"]').value,
                date: row.dataset.date
            };
            data.rows.push(rowData);
        });

        return data;
    }

    importData(data) {
        this.clearAll();
        
        if (data.rows) {
            data.rows.forEach(rowData => {
                this.addRow(rowData.type);
                const lastRow = this.tableBody.lastElementChild;
                
                lastRow.querySelector('select[name="teamLeader"]').value = rowData.teamLeader || '';
                lastRow.querySelector('input[name="broker"]').value = rowData.broker || '';
                lastRow.querySelector('input[name="analyst"]').value = rowData.analyst || '';
                lastRow.querySelector('input[name="manager"]').value = rowData.manager || '';
                lastRow.querySelector('input[name="admin1"]').value = rowData.admin1 || '';
                lastRow.querySelector('input[name="admin2"]').value = rowData.admin2 || '';
                lastRow.querySelector('input[name="client"]').value = rowData.client || '';
                lastRow.querySelector('select[name="status"]').value = rowData.status || '';
                lastRow.querySelector('input[name="deposit"]').value = rowData.deposit || 0;
                lastRow.querySelector('input[name="dodep"]').value = rowData.dodep || 0;
                lastRow.querySelector('input[name="tax1"]').value = rowData.tax1 || 0;
                lastRow.querySelector('input[name="tax2"]').value = rowData.tax2 || 0;
                lastRow.querySelector('input[name="tax3"]').value = rowData.tax3 || 0;
                lastRow.querySelector('input[name="tax4"]').value = rowData.tax4 || 0;
                lastRow.querySelector('input[name="tax5"]').value = rowData.tax5 || 0;
                lastRow.querySelector('textarea[name="comment"]').value = rowData.comment || '';
                if (rowData.date) lastRow.dataset.date = rowData.date;
                
                this.calculateRow(lastRow.id);
            });
        }
        
        if (data.activityLog) {
            this.activityLog = data.activityLog;
        }
        
        this.updateStatistics();
        this.updateSummary();
        this.updateReports();
        this.logActivity('Данные импортированы из файла', 'success');
    }

    handleSearch(query) {
        this.currentPage = 1;
        this.applyFilters();
    }

    clearSearch() {
        document.getElementById('searchInput').value = '';
        this.handleSearch('');
    }

    applyFilters() {
        const searchQuery = document.getElementById('searchInput').value.toLowerCase();
        const teamFilter = document.getElementById('teamFilter').value;
        const brokerFilter = document.getElementById('brokerFilter').value;
        const statusFilter = document.getElementById('statusFilter').value;
        const dateFilter = document.getElementById('dateFilter').value;

        const rows = this.tableBody.querySelectorAll('tr');
        let visibleCount = 0;

        rows.forEach(row => {
            let visible = true;

            // Поиск по всем полям
            if (searchQuery) {
                const text = row.textContent.toLowerCase();
                visible = visible && text.includes(searchQuery);
            }

            // Фильтр по тим-лидеру
            if (teamFilter) {
                const teamLeader = row.querySelector('select[name="teamLeader"]')?.value || row.querySelector('input[name="teamLeader"]')?.value;
                visible = visible && teamLeader === teamFilter;
            }

            // Фильтр по брокеру
            if (brokerFilter) {
                const broker = row.querySelector('input[name="broker"]')?.value;
                visible = visible && broker === brokerFilter;
            }

            // Фильтр по статусу
            if (statusFilter) {
                const status = row.querySelector('select[name="status"]')?.value || row.querySelector('input[name="status"]')?.value;
                visible = visible && status === statusFilter;
            }

            // Фильтр по дате
            if (dateFilter) {
                const rowDate = new Date(row.dataset.date);
                const today = new Date();
                
                switch(dateFilter) {
                    case 'today':
                        visible = visible && rowDate.toDateString() === today.toDateString();
                        break;
                    case 'week':
                        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                        visible = visible && rowDate >= weekAgo;
                        break;
                    case 'month':
                        const monthAgo = new Date(today.getFullYear(), today.getMonth(), 1);
                        visible = visible && rowDate >= monthAgo;
                        break;
                }
            }

            row.style.display = visible ? '' : 'none';
            if (visible) visibleCount++;
        });

        document.getElementById('filteredRecords').textContent = visibleCount;
        this.updatePagination();
    }

    updateFilters() {
        const teamLeaders = new Set();
        const brokers = new Set();
        const analysts = new Set();
        const managers = new Set();
        const admins = new Set();

        this.tableBody.querySelectorAll('tr').forEach(row => {
            const teamLeader = row.querySelector('select[name="teamLeader"]')?.value || row.querySelector('input[name="teamLeader"]')?.value;
            const broker = row.querySelector('input[name="broker"]')?.value;
            const analyst = row.querySelector('input[name="analyst"]')?.value;
            const manager = row.querySelector('input[name="manager"]')?.value;
            const admin1 = row.querySelector('input[name="admin1"]')?.value;
            const admin2 = row.querySelector('input[name="admin2"]')?.value;

            if (teamLeader) teamLeaders.add(teamLeader);
            if (broker) brokers.add(broker);
            if (analyst) analysts.add(analyst);
            if (manager) managers.add(manager);
            if (admin1) admins.add(admin1);
            if (admin2) admins.add(admin2);
        });

        this.updateSelectOptions('teamFilter', teamLeaders);
        this.updateSelectOptions('brokerFilter', brokers);
        this.updateSelectOptions('analystFilter', analysts);
        this.updateSelectOptions('managerFilter', managers);
        this.updateSelectOptions('admin1Filter', admins);
        this.updateSelectOptions('admin2Filter', admins);
    }

    updateSelectOptions(selectId, options) {
        const select = document.getElementById(selectId);
        const currentValue = select.value;
        
        select.innerHTML = '<option value="">Все</option>';
        Array.from(options).sort().forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option;
            optionElement.textContent = option;
            select.appendChild(optionElement);
        });
        
        select.value = currentValue;
    }

    toggleSortPanel() {
        const panel = document.getElementById('sortPanel');
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    }

    applySort() {
        const column = document.getElementById('sortColumn').value;
        const direction = document.getElementById('sortDirection').value;
        
        this.sortConfig = { column, direction };
        this.sortTable();
        this.toggleSortPanel();
    }

    sortTable() {
        const rows = Array.from(this.tableBody.querySelectorAll('tr'));
        
        rows.sort((a, b) => {
            let aValue, bValue;
            
            switch(this.sortConfig.column) {
                case 'rowNumber':
                    aValue = parseInt(a.querySelector('td:nth-child(2)').textContent);
                    bValue = parseInt(b.querySelector('td:nth-child(2)').textContent);
                    break;
                case 'teamLeader':
                    aValue = a.querySelector('select[name="teamLeader"]')?.value || a.querySelector('input[name="teamLeader"]')?.value || '';
                    bValue = b.querySelector('select[name="teamLeader"]')?.value || b.querySelector('input[name="teamLeader"]')?.value || '';
                    break;
                case 'broker':
                    aValue = a.querySelector('input[name="broker"]')?.value || '';
                    bValue = b.querySelector('input[name="broker"]')?.value || '';
                    break;
                case 'analyst':
                    aValue = a.querySelector('input[name="analyst"]')?.value || '';
                    bValue = b.querySelector('input[name="analyst"]')?.value || '';
                    break;
                case 'manager':
                    aValue = a.querySelector('input[name="manager"]')?.value || '';
                    bValue = b.querySelector('input[name="manager"]')?.value || '';
                    break;
                case 'admin1':
                    aValue = a.querySelector('input[name="admin1"]')?.value || '';
                    bValue = b.querySelector('input[name="admin1"]')?.value || '';
                    break;
                case 'admin2':
                    aValue = a.querySelector('input[name="admin2"]')?.value || '';
                    bValue = b.querySelector('input[name="admin2"]')?.value || '';
                    break;
                case 'client':
                    aValue = a.querySelector('input[name="client"]')?.value || '';
                    bValue = b.querySelector('input[name="client"]')?.value || '';
                    break;
                case 'status':
                    aValue = a.querySelector('select[name="status"]')?.value || a.querySelector('input[name="status"]')?.value || '';
                    bValue = b.querySelector('select[name="status"]')?.value || b.querySelector('input[name="status"]')?.value || '';
                    break;
                case 'deposit':
                    aValue = parseFloat(a.querySelector('input[name="deposit"]')?.value) || 0;
                    bValue = parseFloat(b.querySelector('input[name="deposit"]')?.value) || 0;
                    break;
                case 'dodep':
                    aValue = parseFloat(a.querySelector('input[name="dodep"]')?.value) || 0;
                    bValue = parseFloat(b.querySelector('input[name="dodep"]')?.value) || 0;
                    break;
                case 'tax1':
                    aValue = parseFloat(a.querySelector('input[name="tax1"]')?.value) || 0;
                    bValue = parseFloat(b.querySelector('input[name="tax1"]')?.value) || 0;
                    break;
                case 'tax2':
                    aValue = parseFloat(a.querySelector('input[name="tax2"]')?.value) || 0;
                    bValue = parseFloat(b.querySelector('input[name="tax2"]')?.value) || 0;
                    break;
                case 'tax3':
                    aValue = parseFloat(a.querySelector('input[name="tax3"]')?.value) || 0;
                    bValue = parseFloat(b.querySelector('input[name="tax3"]')?.value) || 0;
                    break;
                case 'tax4':
                    aValue = parseFloat(a.querySelector('input[name="tax4"]')?.value) || 0;
                    bValue = parseFloat(b.querySelector('input[name="tax4"]')?.value) || 0;
                    break;
                case 'tax5':
                    aValue = parseFloat(a.querySelector('input[name="tax5"]')?.value) || 0;
                    bValue = parseFloat(b.querySelector('input[name="tax5"]')?.value) || 0;
                    break;
                case 'teamSalary':
                    aValue = parseFloat(a.querySelector('input[name="teamSalary"]')?.value) || 0;
                    bValue = parseFloat(b.querySelector('input[name="teamSalary"]')?.value) || 0;
                    break;
                case 'brokerSalary':
                    aValue = parseFloat(a.querySelector('input[name="brokerSalary"]')?.value) || 0;
                    bValue = parseFloat(b.querySelector('input[name="brokerSalary"]')?.value) || 0;
                    break;
                case 'analystSalary':
                    aValue = parseFloat(a.querySelector('input[name="analystSalary"]')?.value) || 0;
                    bValue = parseFloat(b.querySelector('input[name="analystSalary"]')?.value) || 0;
                    break;
                case 'managerSalary':
                    aValue = parseFloat(a.querySelector('input[name="managerSalary"]')?.value) || 0;
                    bValue = parseFloat(b.querySelector('input[name="managerSalary"]')?.value) || 0;
                    break;
                case 'admin1Salary':
                    aValue = parseFloat(a.querySelector('input[name="admin1Salary"]')?.value) || 0;
                    bValue = parseFloat(b.querySelector('input[name="admin1Salary"]')?.value) || 0;
                    break;
                case 'admin2Salary':
                    aValue = parseFloat(a.querySelector('input[name="admin2Salary"]')?.value) || 0;
                    bValue = parseFloat(b.querySelector('input[name="admin2Salary"]')?.value) || 0;
                    break;
                case 'commission':
                    aValue = parseFloat(a.querySelector('input[name="commission"]')?.value) || 0;
                    bValue = parseFloat(b.querySelector('input[name="commission"]')?.value) || 0;
                    break;
                default:
                    return 0;
            }

            if (this.sortConfig.direction === 'asc') {
                return aValue > bValue ? 1 : -1;
            } else {
                return aValue < bValue ? 1 : -1;
            }
        });

        rows.forEach(row => this.tableBody.appendChild(row));
        this.logActivity(`Таблица отсортирована по ${this.sortConfig.column}`, 'info');
    }

    toggleSelectAll(checked) {
        const checkboxes = this.tableBody.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = checked;
            this.toggleRowSelection(checkbox);
        });
    }

    toggleRowSelection(checkbox) {
        const row = checkbox.closest('tr');
        if (checkbox.checked) {
            this.selectedRows.add(row.id);
            row.classList.add('selected');
        } else {
            this.selectedRows.delete(row.id);
            row.classList.remove('selected');
        }
        
        document.getElementById('deleteSelectedBtn').disabled = this.selectedRows.size === 0;
    }

    deleteSelected() {
        if (this.selectedRows.size === 0) return;
        
        if (confirm(`Удалить ${this.selectedRows.size} выбранных строк?`)) {
            this.saveState();
            this.selectedRows.forEach(rowId => {
                this.deleteRow(rowId);
            });
            this.selectedRows.clear();
            document.getElementById('selectAllCheckbox').checked = false;
            document.getElementById('deleteSelectedBtn').disabled = true;
        }
    }

    applyTemplate(template) {
        const templates = {
            small: { deposit: 10000, dodep: 5000, tax1: 1000 },
            medium: { deposit: 50000, dodep: 25000, tax1: 5000 },
            large: { deposit: 100000, dodep: 50000, tax1: 10000 }
        };

        const selectedTemplate = templates[template];
        if (!selectedTemplate) return;

        this.addRow('team');
        const lastRow = this.tableBody.lastElementChild;
        
        Object.entries(selectedTemplate).forEach(([field, value]) => {
            const input = lastRow.querySelector(`input[name="${field}"]`);
            if (input) {
                input.value = value;
            }
        });

        this.calculateRow(lastRow.id);
        this.logActivity(`Применён шаблон: ${template}`, 'info');
    }

    saveState() {
        const state = {
            tableData: this.exportDataToJSON(),
            timestamp: new Date().toISOString()
        };
        
        this.undoStack.push(state);
        this.redoStack = []; // Очищаем redo при новом действии
        
        // Ограничиваем размер стека
        if (this.undoStack.length > 20) {
            this.undoStack.shift();
        }
        
        this.updateUndoRedoButtons();
    }

    undo() {
        if (this.undoStack.length === 0) return;
        
        const currentState = {
            tableData: this.exportDataToJSON(),
            timestamp: new Date().toISOString()
        };
        
        this.redoStack.push(currentState);
        const previousState = this.undoStack.pop();
        
        this.importData(previousState.tableData);
        this.updateUndoRedoButtons();
        this.logActivity('Действие отменено', 'info');
    }

    redo() {
        if (this.redoStack.length === 0) return;
        
        const currentState = {
            tableData: this.exportDataToJSON(),
            timestamp: new Date().toISOString()
        };
        
        this.undoStack.push(currentState);
        const nextState = this.redoStack.pop();
        
        this.importData(nextState.tableData);
        this.updateUndoRedoButtons();
        this.logActivity('Действие повторено', 'info');
    }

    updateUndoRedoButtons() {
        document.getElementById('undoBtn').disabled = this.undoStack.length === 0;
        document.getElementById('redoBtn').disabled = this.redoStack.length === 0;
    }

    showExportModal() {
        document.getElementById('exportModal').style.display = 'flex';
    }

    closeModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
    }

    showHelpModal() {
        document.getElementById('helpModal').style.display = 'flex';
    }

    updatePagination() {
        const visibleRows = Array.from(this.tableBody.querySelectorAll('tr')).filter(row => 
            row.style.display !== 'none'
        );
        
        const totalPages = Math.ceil(visibleRows.length / this.itemsPerPage);
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;

        // Скрываем все строки
        visibleRows.forEach(row => row.style.display = 'none');
        
        // Показываем только строки текущей страницы
        visibleRows.slice(startIndex, endIndex).forEach(row => row.style.display = '');

        // Обновляем элементы пагинации
        document.getElementById('paginationInfo').textContent = 
            `Показано ${startIndex + 1}-${Math.min(endIndex, visibleRows.length)} из ${visibleRows.length} записей`;
        document.getElementById('pageInfo').textContent = `Страница ${this.currentPage} из ${totalPages}`;
        document.getElementById('prevPageBtn').disabled = this.currentPage === 1;
        document.getElementById('nextPageBtn').disabled = this.currentPage === totalPages;
    }

    previousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.updatePagination();
        }
    }

    nextPage() {
        const visibleRows = Array.from(this.tableBody.querySelectorAll('tr')).filter(row => 
            row.style.display !== 'none'
        );
        const totalPages = Math.ceil(visibleRows.length / this.itemsPerPage);
        
        if (this.currentPage < totalPages) {
            this.currentPage++;
            this.updatePagination();
        }
    }

    updateCharts() {
        this.updateSalaryChart();
        this.updatePieChart();
    }

    updateSalaryChart() {
        const ctx = document.getElementById('salaryChart');
        if (!ctx) return;

        if (this.charts.salary) {
            this.charts.salary.destroy();
        }

        const data = this.getChartData();
        
        this.charts.salary = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'ЗП Тим-лидеров',
                    data: data.teamSalaries,
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    tension: 0.1
                }, {
                    label: 'ЗП Брокеров',
                    data: data.brokerSalaries,
                    borderColor: '#e74c3c',
                    backgroundColor: 'rgba(231, 76, 60, 0.1)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Динамика зарплат'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    updatePieChart() {
        const ctx = document.getElementById('pieChart');
        if (!ctx) return;

        if (this.charts.pie) {
            this.charts.pie.destroy();
        }

        const data = this.getPieChartData();
        
        this.charts.pie = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: data.labels,
                datasets: [{
                    data: data.values,
                    backgroundColor: [
                        '#3498db',
                        '#e74c3c',
                        '#f39c12',
                        '#27ae60',
                        '#9b59b6'
                    ]
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Распределение доходов'
                    }
                }
            }
        });
    }

    getChartData() {
        // Группируем данные по месяцам
        const monthlyData = new Map();
        
        this.tableBody.querySelectorAll('tr').forEach(row => {
            const date = new Date(row.dataset.date);
            const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
            const teamSalary = parseFloat(row.querySelector('input[name="teamSalary"]')?.value) || 0;
            const brokerSalary = parseFloat(row.querySelector('input[name="brokerSalary"]')?.value) || 0;
            
            if (!monthlyData.has(monthKey)) {
                monthlyData.set(monthKey, { teamSalary: 0, brokerSalary: 0 });
            }
            
            const data = monthlyData.get(monthKey);
            data.teamSalary += teamSalary;
            data.brokerSalary += brokerSalary;
        });

        const sortedMonths = Array.from(monthlyData.keys()).sort();
        
        return {
            labels: sortedMonths.map(month => {
                const [year, monthNum] = month.split('-');
                return `${monthNum}/${year}`;
            }),
            teamSalaries: sortedMonths.map(month => monthlyData.get(month).teamSalary),
            brokerSalaries: sortedMonths.map(month => monthlyData.get(month).brokerSalary)
        };
    }

    getPieChartData() {
        const totalTeamSalary = parseFloat(document.getElementById('totalTeamSalary').textContent) || 0;
        const totalBrokerSalary = parseFloat(document.getElementById('totalBrokerSalary').textContent) || 0;
        const totalIncome = parseFloat(document.getElementById('totalIncome').textContent) || 0;
        
        return {
            labels: ['ЗП Тим-лидеров', 'ЗП Брокеров', 'Остальной доход'],
            values: [totalTeamSalary, totalBrokerSalary, totalIncome - totalTeamSalary - totalBrokerSalary]
        };
    }

    saveToLocalStorage() {
        try {
            const data = this.exportDataToJSON();
            localStorage.setItem('salaryCalculatorData', JSON.stringify(data));
            this.logActivity('Данные автоматически сохранены', 'info');
        } catch (error) {
            console.error('Ошибка автосохранения:', error);
        }
    }

    logActivity(message, type = 'info') {
        const timestamp = new Date().toLocaleString('ru-RU');
        const logEntry = {
            timestamp,
            message,
            type
        };
        
        this.activityLog.unshift(logEntry);
        
        // Ограничиваем лог 100 записями
        if (this.activityLog.length > 100) {
            this.activityLog = this.activityLog.slice(0, 100);
        }
        
        this.updateActivityLog();
    }

    updateActivityLog() {
        const content = document.getElementById('activityLogContent');
        if (!content) return;

        if (this.activityLog.length === 0) {
            content.innerHTML = '<p>Лог активности пуст</p>';
            return;
        }

        let html = '';
        this.activityLog.forEach(entry => {
            html += `
                <div class="log-entry ${entry.type}">
                    <div class="log-time">${entry.timestamp}</div>
                    <div class="log-message">${entry.message}</div>
                </div>
            `;
        });
        content.innerHTML = html;
    }

    clearLog() {
        if (confirm('Вы уверены, что хотите очистить весь лог активности?')) {
            this.activityLog = [];
            this.updateActivityLog();
            this.logActivity('Лог активности очищен', 'success');
        }
    }

    exportLog() {
        const data = {
            timestamp: new Date().toISOString(),
            activityLog: this.activityLog
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `salary_calculator_activity_log_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.logActivity('Лог активности экспортирован в JSON файл', 'success');
    }

    initTabSystem() {
        const tabBtns = document.querySelectorAll('.tab-btn');
        const reportPanels = document.querySelectorAll('.report-panel');

        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.dataset.tab;
                
                tabBtns.forEach(b => b.classList.remove('active'));
                reportPanels.forEach(p => p.classList.remove('active'));
                
                btn.classList.add('active');
                document.getElementById(targetTab).classList.add('active');
                
                this.updateReports();
            });
        });
    }

    showSettingsModal() {
        this.loadSettingsToModal();
        document.getElementById('settingsModal').style.display = 'flex';
    }

    loadSettingsToModal() {
        Object.keys(this.settings).forEach(key => {
            const input = document.getElementById(key);
            if (input) {
                input.value = this.settings[key];
            }
        });
        this.updateTeamLeadersList();
    }

    saveSettings() {
        Object.keys(this.settings).forEach(key => {
            const input = document.getElementById(key);
            if (input) {
                this.settings[key] = parseFloat(input.value) || 0;
            }
        });
        
        localStorage.setItem('salaryCalculatorSettings', JSON.stringify(this.settings));
        localStorage.setItem('teamLeadersList', JSON.stringify(this.teamLeadersList));
        
        this.calculateAll();
        this.closeModals();
        this.logActivity('Настройки сохранены', 'success');
    }

    resetSettings() {
        this.settings = {
            teamLeaderPercent: 5,
            brokerDepositPercent: 50,
            brokerDodepPercent: 45,
            brokerTaxPercent: 30,
            analystPercent: 15,
            managerPercent: 10,
            commissionPercent: 30
        };
        
        this.teamLeadersList = ['Тим-лидер 1', 'Тим-лидер 2', 'Тим-лидер 3', 'Тим-лидер 4', 'Тим-лидер 5'];
        
        this.loadSettingsToModal();
        this.logActivity('Настройки сброшены', 'warning');
    }

    addTeamLeader() {
        const input = document.getElementById('newTeamLeaderName');
        const name = input.value.trim();
        
        if (name && this.teamLeadersList.length < 5) {
            this.teamLeadersList.push(name);
            input.value = '';
            this.updateTeamLeadersList();
            this.logActivity(`Добавлен тим-лидер: ${name}`, 'success');
        } else if (this.teamLeadersList.length >= 5) {
            alert('Максимальное количество тим-лидеров: 5');
        }
    }

    updateTeamLeadersList() {
        const container = document.getElementById('teamLeadersList');
        container.innerHTML = '';
        
        this.teamLeadersList.forEach((name, index) => {
            const item = document.createElement('div');
            item.className = 'team-leader-item';
            item.innerHTML = `
                <span class="team-leader-name">${name}</span>
                <button class="remove-team-leader" onclick="calculator.removeTeamLeader(${index})">Удалить</button>
            `;
            container.appendChild(item);
        });
    }

    removeTeamLeader(index) {
        if (this.teamLeadersList.length > 1) {
            const removed = this.teamLeadersList.splice(index, 1)[0];
            this.updateTeamLeadersList();
            this.logActivity(`Удален тим-лидер: ${removed}`, 'warning');
        } else {
            alert('Должен быть хотя бы один тим-лидер');
        }
    }

    loadSettings() {
        const savedSettings = localStorage.getItem('salaryCalculatorSettings');
        if (savedSettings) {
            this.settings = { ...this.settings, ...JSON.parse(savedSettings) };
        }
        
        const savedTeamLeaders = localStorage.getItem('teamLeadersList');
        if (savedTeamLeaders) {
            this.teamLeadersList = JSON.parse(savedTeamLeaders);
        }
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    const calculator = new SalaryCalculator();
    window.calculator = calculator;
    
    // Загрузка сохраненных данных
    const savedData = localStorage.getItem('salaryCalculatorData');
    if (savedData) {
        try {
            const data = JSON.parse(savedData);
            if (data.rows && data.rows.length > 0) {
                calculator.importData(data);
            }
        } catch (error) {
            console.error('Ошибка при загрузке данных:', error);
            calculator.logActivity('Ошибка при загрузке сохраненных данных', 'error');
        }
    }
    
    calculator.logActivity('Калькулятор заработной платы запущен', 'success');
    calculator.showNotification('Система готова к работе!', 'success', 3000);
    
    // Закрытие модальных окон по клику вне их
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            calculator.closeModals();
        }
    });
});
