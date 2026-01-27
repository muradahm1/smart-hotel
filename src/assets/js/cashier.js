// RAMZ Cashier System
// Comprehensive cashier functionality with offline support and thermal printing

class CashierSystem {
    constructor() {
        this.currentOrder = null;
        this.selectedPaymentMethod = 'cash';
        this.isOnline = navigator.onLine;
        this.printer = null;
        this.cashierName = null;
        this.currentShift = null;
        this.offlineQueue = [];
        
        this.init();
    }

    async init() {
        console.log('🏪 Initializing RAMZ Cashier System...');
        
        // Initialize offline database
        await this.initOfflineDB();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Check authentication
        await this.checkAuth();
        
        // Initialize printer
        await this.initPrinter();
        
        // Load initial data
        await this.loadDashboardData();
        
        // Setup real-time subscriptions
        this.setupRealTimeSubscriptions();
        
        // Update connection status
        this.updateConnectionStatus();
        
        console.log('✅ Cashier System initialized successfully');
    }

    // ==================== AUTHENTICATION ====================
    async checkAuth() {
        // Skip authentication for now - set default cashier
        this.cashierName = 'Demo Cashier';
        this.startShift();
        console.log('🔓 Authentication disabled - using demo cashier');
    }

    startShift() {
        this.currentShift = {
            cashier: this.cashierName,
            startTime: new Date().toISOString(),
            transactions: 0,
            totalSales: 0
        };
        
        // Store shift data locally
        localStorage.setItem('currentShift', JSON.stringify(this.currentShift));
        
        this.showNotification(`Shift started for ${this.cashierName}`, 'success');
    }

    // ==================== OFFLINE DATABASE ====================
    async initOfflineDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('ramz-cashier-db', 1);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create stores
                if (!db.objectStoreNames.contains('transactions')) {
                    const transactionStore = db.createObjectStore('transactions', { keyPath: 'id' });
                    transactionStore.createIndex('date', 'created_at');
                    transactionStore.createIndex('cashier', 'cashier');
                }
                
                if (!db.objectStoreNames.contains('orders')) {
                    const orderStore = db.createObjectStore('orders', { keyPath: 'id' });
                    orderStore.createIndex('status', 'status');
                }
                
                if (!db.objectStoreNames.contains('offline_queue')) {
                    db.createObjectStore('offline_queue', { keyPath: 'id' });
                }
            };
            
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
            
            request.onerror = () => reject(request.error);
        });
    }

    // ==================== EVENT LISTENERS ====================
    setupEventListeners() {
        // Connection status
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.updateConnectionStatus();
            this.syncOfflineData();
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.updateConnectionStatus();
        });

        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Payment modal
        document.getElementById('closePaymentModal').addEventListener('click', () => {
            this.closePaymentModal();
        });

        // Payment methods
        document.querySelectorAll('.payment-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.selectPaymentMethod(e.currentTarget.dataset.method);
            });
        });

        // Calculator
        document.querySelectorAll('.calc-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.handleCalculatorInput(e.target.dataset.value);
            });
        });

        // Received amount input
        document.getElementById('receivedAmount').addEventListener('input', (e) => {
            this.calculateChange();
        });

        // Process payment
        document.getElementById('processPayment').addEventListener('click', () => {
            this.processPayment();
        });

        // Printer setup
        document.getElementById('printerSetupBtn').addEventListener('click', () => {
            this.showPrinterModal();
        });

        document.getElementById('connectPrinter').addEventListener('click', () => {
            this.connectPrinter();
        });

        document.getElementById('testPrint').addEventListener('click', () => {
            this.testPrint();
        });

        // Sync data
        document.getElementById('syncDataBtn').addEventListener('click', () => {
            this.syncOfflineData();
        });

        // End shift
        document.getElementById('endShiftBtn').addEventListener('click', () => {
            this.endShift();
        });

        // Export transactions
        document.getElementById('exportTransactions').addEventListener('click', () => {
            this.exportTransactions();
        });

        // Logout (disabled)
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.style.display = 'none';
        }
    }

    // ==================== REAL-TIME SUBSCRIPTIONS ====================
    setupRealTimeSubscriptions() {
        if (!this.isOnline) return;

        // Subscribe to order updates
        supabaseClient
            .channel('cashier-orders')
            .on('postgres_changes', 
                { event: '*', schema: 'public', table: 'orders' },
                (payload) => {
                    console.log('Order update:', payload);
                    this.handleOrderUpdate(payload);
                }
            )
            .subscribe();

        console.log('📡 Real-time subscriptions active');
    }

    handleOrderUpdate(payload) {
        const { eventType, new: newOrder, old: oldOrder } = payload;
        
        if (eventType === 'UPDATE') {
            // Check if order became ready
            if (oldOrder.status !== 'ready' && newOrder.status === 'ready') {
                this.showNotification(`Order #${newOrder.id.slice(-6)} is ready for payment!`, 'info');
                this.playNotificationSound();
            }
        }
        
        // Refresh current tab data
        this.refreshCurrentTab();
    }

    // ==================== DATA LOADING ====================
    async loadDashboardData() {
        try {
            await Promise.all([
                this.loadStats(),
                this.loadReadyOrders(),
                this.loadCompletedOrders(),
                this.loadTransactions()
            ]);
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
            if (this.isOnline) {
                this.showNotification('Failed to load data', 'error');
            } else {
                await this.loadOfflineData();
            }
        }
    }

    async loadStats() {
        const today = new Date().toISOString().split('T')[0];
        
        try {
            // Get today's transactions
            const { data: transactions } = await supabaseClient
                .from('transactions')
                .select('amount')
                .eq('cashier', this.cashierName)
                .gte('created_at', today + 'T00:00:00');

            // Get pending orders count
            const { data: pendingOrders } = await supabaseClient
                .from('orders')
                .select('id')
                .eq('status', 'ready');

            const totalSales = transactions?.reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0;
            const transactionCount = transactions?.length || 0;
            const pendingCount = pendingOrders?.length || 0;

            // Update UI
            document.getElementById('totalSales').textContent = this.formatCurrency(totalSales);
            document.getElementById('transactionsToday').textContent = transactionCount;
            document.getElementById('pendingPayments').textContent = pendingCount;
            
            // Update shift data
            if (this.currentShift) {
                this.currentShift.totalSales = totalSales;
                this.currentShift.transactions = transactionCount;
                localStorage.setItem('currentShift', JSON.stringify(this.currentShift));
            }

        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    }

    async loadReadyOrders() {
        try {
            const { data: orders } = await supabaseClient
                .from('orders')
                .select(`
                    *,
                    order_items (
                        *,
                        menu_items (name, price)
                    )
                `)
                .eq('status', 'ready')
                .order('created_at', { ascending: true });

            this.renderOrders(orders || [], 'readyOrdersGrid', 'ready');
            
        } catch (error) {
            console.error('Failed to load ready orders:', error);
        }
    }

    async loadCompletedOrders() {
        try {
            const today = new Date().toISOString().split('T')[0];
            
            const { data: orders } = await supabaseClient
                .from('orders')
                .select(`
                    *,
                    order_items (
                        *,
                        menu_items (name, price)
                    )
                `)
                .eq('status', 'completed')
                .gte('created_at', today + 'T00:00:00')
                .order('updated_at', { ascending: false })
                .limit(20);

            this.renderOrders(orders || [], 'completedOrdersGrid', 'completed');
            
        } catch (error) {
            console.error('Failed to load completed orders:', error);
        }
    }

    async loadTransactions() {
        try {
            const selectedDate = document.getElementById('transactionDate').value || 
                                new Date().toISOString().split('T')[0];
            
            const { data: transactions } = await supabaseClient
                .from('transactions')
                .select(`
                    *,
                    orders (
                        table_number,
                        customer_name
                    )
                `)
                .eq('cashier', this.cashierName)
                .gte('created_at', selectedDate + 'T00:00:00')
                .lt('created_at', selectedDate + 'T23:59:59')
                .order('created_at', { ascending: false });

            this.renderTransactions(transactions || []);
            
        } catch (error) {
            console.error('Failed to load transactions:', error);
        }
    }

    // ==================== RENDERING ====================
    renderOrders(orders, containerId, status) {
        const container = document.getElementById(containerId);
        
        if (orders.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-clipboard-list"></i>
                    <h3>No ${status} orders</h3>
                    <p>All caught up!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = orders.map(order => `
            <div class="order-card ${status}" data-order-id="${order.id}">
                <div class="order-header">
                    <div class="order-info">
                        <h3>Table ${order.table_number}</h3>
                        <div class="order-time">${this.formatTime(order.created_at)}</div>
                        <div class="customer-name">${order.customer_name || 'Walk-in'}</div>
                    </div>
                    <div class="order-status status-${status}">${status.toUpperCase()}</div>
                </div>
                
                <div class="order-items">
                    ${order.order_items.map(item => `
                        <div class="order-item">
                            <div class="item-info">
                                <div class="item-name">${item.menu_items.name}</div>
                            </div>
                            <div class="item-quantity">${item.quantity}</div>
                            <div class="item-price">${this.formatCurrency(item.price * item.quantity)}</div>
                        </div>
                    `).join('')}
                </div>
                
                <div class="order-total">
                    <strong>Total: ${this.formatCurrency(order.total_amount)}</strong>
                </div>
                
                <div class="order-actions">
                    ${status === 'ready' ? `
                        <button class="btn btn-pay" onclick="cashierSystem.openPaymentModal('${order.id}')">
                            <i class="fas fa-credit-card"></i> Process Payment
                        </button>
                    ` : `
                        <button class="btn btn-reprint" onclick="cashierSystem.reprintReceipt('${order.id}')">
                            <i class="fas fa-print"></i> Reprint
                        </button>
                    `}
                </div>
            </div>
        `).join('');
    }

    renderTransactions(transactions) {
        const container = document.getElementById('transactionsGrid');
        
        if (transactions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-receipt"></i>
                    <h3>No transactions</h3>
                    <p>No transactions found for selected date</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="transaction-header">
                <div>Order ID</div>
                <div>Customer</div>
                <div>Method</div>
                <div>Amount</div>
                <div>Time</div>
            </div>
            ${transactions.map(transaction => `
                <div class="transaction-item">
                    <div class="transaction-id">#${transaction.order_id?.slice(-6) || 'N/A'}</div>
                    <div class="transaction-customer">
                        ${transaction.orders?.customer_name || 'Walk-in'}
                        <small>Table ${transaction.orders?.table_number || 'N/A'}</small>
                    </div>
                    <div class="transaction-method">
                        <i class="fas fa-${this.getPaymentIcon(transaction.payment_method)}"></i>
                        ${transaction.payment_method.toUpperCase()}
                    </div>
                    <div class="transaction-amount">${this.formatCurrency(transaction.amount)}</div>
                    <div class="transaction-time">${this.formatTime(transaction.created_at)}</div>
                </div>
            `).join('')}
        `;
    }

    // ==================== PAYMENT PROCESSING ====================
    async openPaymentModal(orderId) {
        try {
            // Get order details
            const { data: order } = await supabaseClient
                .from('orders')
                .select(`
                    *,
                    order_items (
                        *,
                        menu_items (name, price)
                    )
                `)
                .eq('id', orderId)
                .single();

            if (!order) {
                this.showNotification('Order not found', 'error');
                return;
            }

            this.currentOrder = order;
            
            // Populate order summary
            document.getElementById('paymentOrderSummary').innerHTML = `
                <h4>Order #${order.id.slice(-6)}</h4>
                <div class="order-details">
                    <div class="detail-row">
                        <span>Table:</span>
                        <span>${order.table_number}</span>
                    </div>
                    <div class="detail-row">
                        <span>Customer:</span>
                        <span>${order.customer_name || 'Walk-in'}</span>
                    </div>
                </div>
                <div class="order-items-summary">
                    ${order.order_items.map(item => `
                        <div class="summary-item">
                            <span>${item.quantity}x ${item.menu_items.name}</span>
                            <span>${this.formatCurrency(item.price * item.quantity)}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="summary-total">
                    <span>Total:</span>
                    <span>${this.formatCurrency(order.total_amount)}</span>
                </div>
            `;

            // Set payment total
            document.getElementById('paymentTotal').textContent = this.formatCurrency(order.total_amount);
            
            // Reset payment form
            this.resetPaymentForm();
            
            // Show modal
            document.getElementById('paymentModal').style.display = 'flex';
            
        } catch (error) {
            console.error('Failed to open payment modal:', error);
            this.showNotification('Failed to load order details', 'error');
        }
    }

    closePaymentModal() {
        document.getElementById('paymentModal').style.display = 'none';
        this.currentOrder = null;
        this.resetPaymentForm();
    }

    resetPaymentForm() {
        this.selectedPaymentMethod = 'cash';
        document.querySelectorAll('.payment-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector('[data-method="cash"]').classList.add('active');
        
        document.getElementById('receivedAmount').value = '';
        document.getElementById('changeAmount').textContent = '$0.00';
    }

    selectPaymentMethod(method) {
        this.selectedPaymentMethod = method;
        
        document.querySelectorAll('.payment-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-method="${method}"]`).classList.add('active');
        
        // Hide/show calculator based on payment method
        const calculator = document.querySelector('.payment-calculator');
        if (method === 'cash') {
            calculator.style.display = 'block';
        } else {
            calculator.style.display = 'none';
        }
    }

    handleCalculatorInput(value) {
        const receivedInput = document.getElementById('receivedAmount');
        
        if (value === 'clear') {
            receivedInput.value = '';
        } else {
            receivedInput.value += value;
        }
        
        this.calculateChange();
    }

    calculateChange() {
        const total = parseFloat(this.currentOrder?.total_amount || 0);
        const received = parseFloat(document.getElementById('receivedAmount').value || 0);
        const change = received - total;
        
        document.getElementById('changeAmount').textContent = this.formatCurrency(Math.max(0, change));
        
        // Enable/disable process button
        const processBtn = document.getElementById('processPayment');
        if (this.selectedPaymentMethod === 'cash') {
            processBtn.disabled = received < total;
        } else {
            processBtn.disabled = false;
        }
    }

    async processPayment() {
        if (!this.currentOrder) return;
        
        try {
            const total = parseFloat(this.currentOrder.total_amount);
            const received = this.selectedPaymentMethod === 'cash' ? 
                            parseFloat(document.getElementById('receivedAmount').value || 0) : total;
            const change = Math.max(0, received - total);
            
            // Validate payment
            if (this.selectedPaymentMethod === 'cash' && received < total) {
                this.showNotification('Insufficient payment amount', 'error');
                return;
            }

            // Show loading
            this.showLoading(true);
            
            // Create transaction record
            const transaction = {
                id: this.generateId(),
                order_id: this.currentOrder.id,
                payment_method: this.selectedPaymentMethod,
                amount: total,
                change_amount: change,
                cashier: this.cashierName,
                created_at: new Date().toISOString()
            };

            if (this.isOnline) {
                // Online processing
                await this.processOnlinePayment(transaction);
            } else {
                // Offline processing
                await this.processOfflinePayment(transaction);
            }
            
            // Print receipt
            await this.printReceipt(this.currentOrder, transaction);
            
            // Update UI
            await this.loadDashboardData();
            
            // Close modal
            this.closePaymentModal();
            
            this.showNotification('Payment processed successfully!', 'success');
            
        } catch (error) {
            console.error('Payment processing failed:', error);
            this.showNotification('Payment processing failed', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async processOnlinePayment(transaction) {
        // Insert transaction
        const { error: transactionError } = await supabaseClient
            .from('transactions')
            .insert([transaction]);
            
        if (transactionError) throw transactionError;
        
        // Update order status
        const { error: orderError } = await supabaseClient
            .from('orders')
            .update({ 
                status: 'completed',
                updated_at: new Date().toISOString()
            })
            .eq('id', this.currentOrder.id);
            
        if (orderError) throw orderError;
    }

    async processOfflinePayment(transaction) {
        // Store in offline database
        const tx = this.db.transaction(['transactions', 'offline_queue'], 'readwrite');
        
        // Store transaction
        await tx.objectStore('transactions').add(transaction);
        
        // Add to sync queue
        await tx.objectStore('offline_queue').add({
            id: this.generateId(),
            type: 'transaction',
            data: transaction,
            timestamp: Date.now()
        });
        
        // Update order status locally
        const orderUpdate = {
            id: this.currentOrder.id,
            status: 'completed',
            updated_at: new Date().toISOString()
        };
        
        await tx.objectStore('offline_queue').add({
            id: this.generateId(),
            type: 'order_update',
            data: orderUpdate,
            timestamp: Date.now()
        });
        
        await tx.complete;
        
        this.showNotification('Payment processed offline. Will sync when online.', 'info');
    }

    // ==================== THERMAL PRINTING ====================
    async initPrinter() {
        try {
            if ('serial' in navigator) {
                console.log('🖨️ Web Serial API available for thermal printing');
                this.printerSupported = true;
            } else {
                console.log('⚠️ Web Serial API not supported');
                this.printerSupported = false;
            }
        } catch (error) {
            console.error('Printer initialization failed:', error);
        }
    }

    async connectPrinter() {
        if (!this.printerSupported) {
            this.showNotification('Thermal printing not supported in this browser', 'error');
            return;
        }

        try {
            // Request serial port
            const port = await navigator.serial.requestPort();
            await port.open({ baudRate: 9600 });
            
            this.printer = port;
            
            document.getElementById('printerStatus').innerHTML = `
                <i class="fas fa-check-circle"></i> Printer connected successfully
            `;
            document.getElementById('printerStatus').className = 'printer-status connected';
            document.getElementById('testPrint').disabled = false;
            
            this.showNotification('Thermal printer connected!', 'success');
            
        } catch (error) {
            console.error('Printer connection failed:', error);
            document.getElementById('printerStatus').innerHTML = `
                <i class="fas fa-exclamation-circle"></i> Connection failed: ${error.message}
            `;
            document.getElementById('printerStatus').className = 'printer-status error';
        }
    }

    async testPrint() {
        if (!this.printer) {
            this.showNotification('No printer connected', 'error');
            return;
        }

        try {
            const testReceipt = this.generateTestReceipt();
            await this.sendToPrinter(testReceipt);
            this.showNotification('Test receipt printed!', 'success');
        } catch (error) {
            console.error('Test print failed:', error);
            this.showNotification('Test print failed', 'error');
        }
    }

    async printReceipt(order, transaction) {
        if (!this.printer) {
            console.log('No printer connected, showing print preview');
            this.showPrintPreview(order, transaction);
            return;
        }

        try {
            const receipt = this.generateReceipt(order, transaction);
            await this.sendToPrinter(receipt);
            console.log('Receipt printed successfully');
        } catch (error) {
            console.error('Receipt printing failed:', error);
            this.showPrintPreview(order, transaction);
        }
    }

    generateReceipt(order, transaction) {
        const now = new Date();
        const receiptData = [
            // ESC/POS commands for thermal printer
            '\x1B\x40', // Initialize printer
            '\x1B\x61\x01', // Center alignment
            
            // Header
            'RAMZ-HOTEL\n',
            '123 ADAMA\n',
            'Tel: () 123-4567\n',
            '\n',
            
            '\x1B\x61\x00', // Left alignment
            `Date: ${now.toLocaleDateString()}\n`,
            `Time: ${now.toLocaleTimeString()}\n`,
            `Cashier: ${this.cashierName}\n`,
            `Order: #${order.id.slice(-6)}\n`,
            `Table: ${order.table_number}\n`,
            `Customer: ${order.customer_name || 'Walk-in'}\n`,
            '\n',
            
            // Items
            '--------------------------------\n',
            'ITEMS\n',
            '--------------------------------\n',
            
            ...order.order_items.map(item => 
                `${item.quantity}x ${item.menu_items.name}\n` +
                `    ${this.formatCurrency(item.price)} x ${item.quantity} = ${this.formatCurrency(item.price * item.quantity)}\n`
            ),
            
            '--------------------------------\n',
            `SUBTOTAL: ${this.formatCurrency(order.total_amount)}\n`,
            `TOTAL: ${this.formatCurrency(order.total_amount)}\n`,
            '\n',
            
            // Payment info
            `Payment Method: ${transaction.payment_method.toUpperCase()}\n`,
            transaction.payment_method === 'cash' ? 
                `Received: ${this.formatCurrency(parseFloat(document.getElementById('receivedAmount').value || 0))}\n` +
                `Change: ${this.formatCurrency(transaction.change_amount)}\n` : '',
            '\n',
            
            '\x1B\x61\x01', // Center alignment
            'Thank you for dining with us!\n',
            'Visit us again soon!\n',
            '\n\n\n',
            
            '\x1D\x56\x00' // Cut paper
        ];
        
        return receiptData.join('');
    }

    generateTestReceipt() {
        return [
            '\x1B\x40', // Initialize
            '\x1B\x61\x01', // Center
            'RAMZ-HOTEL\n',
            'TEST RECEIPT\n',
            '\n',
            '\x1B\x61\x00', // Left
            `Date: ${new Date().toLocaleDateString()}\n`,
            `Time: ${new Date().toLocaleTimeString()}\n`,
            `Cashier: ${this.cashierName}\n`,
            '\n',
            'Printer test successful!\n',
            '\n\n\n',
            '\x1D\x56\x00' // Cut
        ].join('');
    }

    async sendToPrinter(data) {
        if (!this.printer) throw new Error('No printer connected');
        
        const writer = this.printer.writable.getWriter();
        const encoder = new TextEncoder();
        
        await writer.write(encoder.encode(data));
        writer.releaseLock();
    }

    showPrintPreview(order, transaction) {
        // Create print preview window
        const printWindow = window.open('', '_blank', 'width=400,height=600');
        const receiptHtml = this.generateReceiptHTML(order, transaction);
        
        printWindow.document.write(receiptHtml);
        printWindow.document.close();
        printWindow.print();
    }

    generateReceiptHTML(order, transaction) {
        const now = new Date();
        
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Receipt</title>
                <style>
                    body { font-family: monospace; width: 300px; margin: 0 auto; padding: 20px; }
                    .center { text-align: center; }
                    .line { border-bottom: 1px dashed #000; margin: 10px 0; }
                    .item { display: flex; justify-content: space-between; }
                    .total { font-weight: bold; font-size: 1.2em; }
                </style>
            </head>
            <body>
                <div class="center">
                    <h2>RAMZ-HOTEL</h2>
                    <p>123 ADAMA<br>Tel: () 123-4567</p>
                </div>
                
                <div class="line"></div>
                
                <p>Date: ${now.toLocaleDateString()}</p>
                <p>Time: ${now.toLocaleTimeString()}</p>
                <p>Cashier: ${this.cashierName}</p>
                <p>Order: #${order.id.slice(-6)}</p>
                <p>Table: ${order.table_number}</p>
                <p>Customer: ${order.customer_name || 'Walk-in'}</p>
                
                <div class="line"></div>
                
                <h3>ITEMS</h3>
                ${order.order_items.map(item => `
                    <div class="item">
                        <span>${item.quantity}x ${item.menu_items.name}</span>
                        <span>${this.formatCurrency(item.price * item.quantity)}</span>
                    </div>
                `).join('')}
                
                <div class="line"></div>
                
                <div class="item total">
                    <span>TOTAL:</span>
                    <span>${this.formatCurrency(order.total_amount)}</span>
                </div>
                
                <p>Payment: ${transaction.payment_method.toUpperCase()}</p>
                ${transaction.payment_method === 'cash' ? `
                    <p>Received: ${this.formatCurrency(parseFloat(document.getElementById('receivedAmount')?.value || 0))}</p>
                    <p>Change: ${this.formatCurrency(transaction.change_amount)}</p>
                ` : ''}
                
                <div class="center">
                    <p>Thank you for dining with us!</p>
                    <p>Visit us again soon!</p>
                </div>
            </body>
            </html>
        `;
    }

    async reprintReceipt(orderId) {
        try {
            // Get order and transaction details
            const { data: order } = await supabaseClient
                .from('orders')
                .select(`
                    *,
                    order_items (
                        *,
                        menu_items (name, price)
                    )
                `)
                .eq('id', orderId)
                .single();

            const { data: transaction } = await supabaseClient
                .from('transactions')
                .select('*')
                .eq('order_id', orderId)
                .single();

            if (order && transaction) {
                await this.printReceipt(order, transaction);
                this.showNotification('Receipt reprinted!', 'success');
            } else {
                this.showNotification('Order or transaction not found', 'error');
            }
            
        } catch (error) {
            console.error('Reprint failed:', error);
            this.showNotification('Reprint failed', 'error');
        }
    }

    // ==================== OFFLINE SYNC ====================
    async syncOfflineData() {
        if (!this.isOnline) {
            this.showNotification('Cannot sync while offline', 'error');
            return;
        }

        try {
            this.showLoading(true);
            
            // Get offline queue
            const tx = this.db.transaction(['offline_queue'], 'readonly');
            const store = tx.objectStore('offline_queue');
            const queueItems = await store.getAll();
            
            if (queueItems.length === 0) {
                this.showNotification('No offline data to sync', 'info');
                return;
            }

            let synced = 0;
            
            for (const item of queueItems) {
                try {
                    if (item.type === 'transaction') {
                        await supabaseClient
                            .from('transactions')
                            .insert([item.data]);
                    } else if (item.type === 'order_update') {
                        await supabaseClient
                            .from('orders')
                            .update({ 
                                status: item.data.status,
                                updated_at: item.data.updated_at
                            })
                            .eq('id', item.data.id);
                    }
                    
                    // Remove from queue
                    const deleteTx = this.db.transaction(['offline_queue'], 'readwrite');
                    await deleteTx.objectStore('offline_queue').delete(item.id);
                    
                    synced++;
                    
                } catch (error) {
                    console.error('Failed to sync item:', item, error);
                }
            }
            
            this.showNotification(`Synced ${synced} offline transactions`, 'success');
            await this.loadDashboardData();
            
        } catch (error) {
            console.error('Sync failed:', error);
            this.showNotification('Sync failed', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    // ==================== UTILITY FUNCTIONS ====================
    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        
        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}Tab`).classList.add('active');
        
        // Load tab data
        this.refreshCurrentTab();
    }

    async refreshCurrentTab() {
        const activeTab = document.querySelector('.tab-btn.active').dataset.tab;
        
        switch (activeTab) {
            case 'ready':
                await this.loadReadyOrders();
                break;
            case 'completed':
                await this.loadCompletedOrders();
                break;
            case 'transactions':
                await this.loadTransactions();
                break;
        }
        
        await this.loadStats();
    }

    updateConnectionStatus() {
        const statusElement = document.getElementById('connectionStatus');
        const iconElement = document.getElementById('connectionIcon');
        const textElement = document.getElementById('connectionText');
        
        if (this.isOnline) {
            statusElement.className = 'connection-status online';
            iconElement.className = 'fas fa-wifi';
            textElement.textContent = 'Online';
        } else {
            statusElement.className = 'connection-status offline';
            iconElement.className = 'fas fa-wifi-slash';
            textElement.textContent = 'Offline';
            
            // Show offline banner
            this.showOfflineBanner();
        }
    }

    showOfflineBanner() {
        let banner = document.getElementById('offlineBanner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'offlineBanner';
            banner.className = 'offline-banner';
            banner.innerHTML = `
                <i class="fas fa-wifi-slash"></i>
                Working offline. Data will sync when connection is restored.
            `;
            document.body.appendChild(banner);
        }
        
        banner.classList.add('show');
        
        // Hide when online
        if (this.isOnline) {
            setTimeout(() => {
                banner.classList.remove('show');
            }, 3000);
        }
    }

    showPrinterModal() {
        document.getElementById('printerModal').style.display = 'flex';
    }

    async endShift() {
        if (!confirm('Are you sure you want to end your shift?')) return;
        
        try {
            // Generate shift report
            const shiftReport = await this.generateShiftReport();
            
            // Clear shift data
            localStorage.removeItem('currentShift');
            this.currentShift = null;
            
            // Show report
            this.showShiftReport(shiftReport);
            
        } catch (error) {
            console.error('End shift failed:', error);
            this.showNotification('Failed to end shift', 'error');
        }
    }

    async generateShiftReport() {
        const shift = JSON.parse(localStorage.getItem('currentShift') || '{}');
        const startDate = new Date(shift.startTime);
        const endDate = new Date();
        
        // Get shift transactions
        const { data: transactions } = await supabaseClient
            .from('transactions')
            .select('*')
            .eq('cashier', this.cashierName)
            .gte('created_at', startDate.toISOString())
            .lte('created_at', endDate.toISOString());
        
        const totalSales = transactions?.reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0;
        const cashSales = transactions?.filter(t => t.payment_method === 'cash')
                                    .reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0;
        const cardSales = transactions?.filter(t => t.payment_method === 'card')
                                    .reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0;
        
        return {
            cashier: this.cashierName,
            startTime: startDate,
            endTime: endDate,
            duration: endDate - startDate,
            totalTransactions: transactions?.length || 0,
            totalSales,
            cashSales,
            cardSales,
            transactions: transactions || []
        };
    }

    showShiftReport(report) {
        const reportWindow = window.open('', '_blank', 'width=600,height=800');
        const reportHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Shift Report</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    .header { text-align: center; margin-bottom: 30px; }
                    .summary { background: #f5f5f5; padding: 20px; border-radius: 8px; }
                    .row { display: flex; justify-content: space-between; margin: 10px 0; }
                    .total { font-weight: bold; font-size: 1.2em; border-top: 2px solid #333; padding-top: 10px; }
                    @media print { body { margin: 0; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>RAMZ-HOTEL</h1>
                    <h2>Shift Report</h2>
                </div>
                
                <div class="summary">
                    <div class="row">
                        <span>Cashier:</span>
                        <span>${report.cashier}</span>
                    </div>
                    <div class="row">
                        <span>Start Time:</span>
                        <span>${report.startTime.toLocaleString()}</span>
                    </div>
                    <div class="row">
                        <span>End Time:</span>
                        <span>${report.endTime.toLocaleString()}</span>
                    </div>
                    <div class="row">
                        <span>Duration:</span>
                        <span>${Math.round(report.duration / (1000 * 60 * 60))} hours</span>
                    </div>
                    <div class="row">
                        <span>Total Transactions:</span>
                        <span>${report.totalTransactions}</span>
                    </div>
                    <div class="row">
                        <span>Cash Sales:</span>
                        <span>${this.formatCurrency(report.cashSales)}</span>
                    </div>
                    <div class="row">
                        <span>Card Sales:</span>
                        <span>${this.formatCurrency(report.cardSales)}</span>
                    </div>
                    <div class="row total">
                        <span>Total Sales:</span>
                        <span>${this.formatCurrency(report.totalSales)}</span>
                    </div>
                </div>
                
                <script>
                    window.print();
                </script>
            </body>
            </html>
        `;
        
        reportWindow.document.write(reportHtml);
        reportWindow.document.close();
    }

    async exportTransactions() {
        try {
            const selectedDate = document.getElementById('transactionDate').value || 
                                new Date().toISOString().split('T')[0];
            
            const { data: transactions } = await supabaseClient
                .from('transactions')
                .select(`
                    *,
                    orders (
                        table_number,
                        customer_name
                    )
                `)
                .eq('cashier', this.cashierName)
                .gte('created_at', selectedDate + 'T00:00:00')
                .lt('created_at', selectedDate + 'T23:59:59')
                .order('created_at', { ascending: false });

            if (!transactions || transactions.length === 0) {
                this.showNotification('No transactions to export', 'info');
                return;
            }

            // Generate CSV
            const csv = this.generateCSV(transactions);
            
            // Download file
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `transactions-${selectedDate}.csv`;
            a.click();
            window.URL.revokeObjectURL(url);
            
            this.showNotification('Transactions exported successfully!', 'success');
            
        } catch (error) {
            console.error('Export failed:', error);
            this.showNotification('Export failed', 'error');
        }
    }

    generateCSV(transactions) {
        const headers = ['Date', 'Time', 'Order ID', 'Table', 'Customer', 'Payment Method', 'Amount', 'Change'];
        const rows = transactions.map(t => [
            new Date(t.created_at).toLocaleDateString(),
            new Date(t.created_at).toLocaleTimeString(),
            t.order_id?.slice(-6) || 'N/A',
            t.orders?.table_number || 'N/A',
            t.orders?.customer_name || 'Walk-in',
            t.payment_method,
            t.amount,
            t.change_amount || 0
        ]);
        
        return [headers, ...rows].map(row => row.join(',')).join('\n');
    }

    async logout() {
        if (!confirm('Are you sure you want to logout?')) return;
        
        try {
            await supabaseClient.auth.signOut();
            window.location.href = '/src/pages/login.html';
        } catch (error) {
            console.error('Logout failed:', error);
            this.showNotification('Logout failed', 'error');
        }
    }

    // Helper functions
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount || 0);
    }

    formatTime(timestamp) {
        return new Date(timestamp).toLocaleTimeString();
    }

    getPaymentIcon(method) {
        const icons = {
            cash: 'money-bill-wave',
            card: 'credit-card',
            mobile: 'mobile-alt'
        };
        return icons[method] || 'question';
    }

    generateId() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification-toast ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <p>${message}</p>
        `;
        
        document.getElementById('notificationArea').appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    showLoading(show) {
        let overlay = document.getElementById('loadingOverlay');
        
        if (show) {
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'loadingOverlay';
                overlay.className = 'loading-overlay';
                overlay.innerHTML = '<div class="loading-spinner"></div>';
                document.body.appendChild(overlay);
            }
            overlay.style.display = 'flex';
        } else {
            if (overlay) {
                overlay.style.display = 'none';
            }
        }
    }

    playNotificationSound() {
        // Simple beep sound for notifications
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
    }
}

// Initialize cashier system when page loads
let cashierSystem;

document.addEventListener('DOMContentLoaded', () => {
    // Wait for Supabase to be available
    const initCashier = () => {
        if (window.supabaseClient) {
            cashierSystem = new CashierSystem();
        } else {
            setTimeout(initCashier, 100);
        }
    };
    
    initCashier();
});

// Export for global access
window.cashierSystem = cashierSystem;