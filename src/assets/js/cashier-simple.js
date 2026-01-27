// Simple RAMZ Cashier System
// Keyboard-friendly, minimal interface

class SimpleCashier {
    constructor() {
        this.currentOrder = null;
        this.selectedPaymentMethod = 'cash';
        this.lastTransaction = null;
        this.printer = null;
        
        this.init();
    }

    async init() {
        console.log('🏪 Simple Cashier System Starting...');
        
        this.setupKeyboardShortcuts();
        this.setupEventListeners();
        await this.loadOrders();
        
        // Focus search box
        document.getElementById('orderSearch').focus();
        
        console.log('✅ Simple Cashier Ready');
    }

    // ==================== KEYBOARD SHORTCUTS ====================
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Prevent shortcuts when typing in inputs
            if (e.target.tagName === 'INPUT') {
                if (e.key === 'Enter' && e.target.id === 'orderSearch') {
                    this.searchOrder();
                    return;
                }
                if (e.key === 'Enter' && e.target.id === 'receivedInput') {
                    this.processPayment();
                    return;
                }
                if (e.key === 'Escape') {
                    e.target.blur();
                    this.closeModal();
                    return;
                }
                return;
            }

            switch(e.key) {
                case 'F1':
                    e.preventDefault();
                    this.printLast();
                    break;
                case 'F2':
                    e.preventDefault();
                    this.setupPrinter();
                    break;
                case 'F5':
                    e.preventDefault();
                    this.refreshOrders();
                    break;
                case 'Enter':
                    if (this.currentOrder) {
                        this.processPayment();
                    }
                    break;
                case 'Escape':
                    this.closeModal();
                    break;
                case '1':
                case '2':
                case '3':
                    if (!this.currentOrder) {
                        this.selectPaymentMethod(['cash', 'card', 'mobile'][parseInt(e.key) - 1]);
                    }
                    break;
                case '/':
                    e.preventDefault();
                    document.getElementById('orderSearch').focus();
                    break;
            }
        });
    }

    // ==================== EVENT LISTENERS ====================
    setupEventListeners() {
        // Search
        document.getElementById('searchBtn').addEventListener('click', () => this.searchOrder());
        
        // Payment modal
        document.querySelectorAll('.payment-btn-simple').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.selectPaymentMethod(e.target.dataset.method);
            });
        });
        
        // Payment actions
        document.getElementById('payBtn').addEventListener('click', () => this.processPayment());
        document.getElementById('cancelBtn').addEventListener('click', () => this.closeModal());
        
        // Amount input
        document.getElementById('receivedInput').addEventListener('input', () => this.calculateChange());
        
        // Quick actions
        document.getElementById('printLastBtn').addEventListener('click', () => this.printLast());
        document.getElementById('refreshBtn').addEventListener('click', () => this.refreshOrders());
        document.getElementById('printerBtn').addEventListener('click', () => this.setupPrinter());
        
        // Modal click outside to close
        document.getElementById('paymentModal').addEventListener('click', (e) => {
            if (e.target.id === 'paymentModal') {
                this.closeModal();
            }
        });
    }

    // ==================== DATA LOADING ====================
    async loadOrders() {
        try {
            // Load ready orders
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

            this.renderOrders(orders || []);
            this.updateStats();
            
        } catch (error) {
            console.error('Failed to load orders:', error);
            this.showNotification('Failed to load orders', 'error');
        }
    }

    renderOrders(orders) {
        const container = document.getElementById('ordersGrid');
        
        if (orders.length === 0) {
            container.innerHTML = `
                <div class=\"empty-state\">
                    <h3>No Ready Orders</h3>
                    <p>All orders processed!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = orders.map(order => `
            <div class=\"order-card-simple ready\" onclick=\"simpleCashier.openPayment('${order.id}')\">
                <div class=\"order-header-simple\">
                    <h3>Table ${order.table_number}</h3>
                    <div class=\"order-total-simple\">${this.formatCurrency(order.total_amount)}</div>
                </div>
                <div class=\"order-items-simple\">
                    ${order.order_items.slice(0, 3).map(item => `
                        <div class=\"order-item-simple\">
                            <span class=\"item-name-simple\">${item.menu_items.name}</span>
                            <span class=\"item-qty-price\">${item.quantity}x ${this.formatCurrency(item.price)}</span>
                        </div>
                    `).join('')}
                    ${order.order_items.length > 3 ? `<div class=\"order-item-simple\">... and ${order.order_items.length - 3} more items</div>` : ''}
                </div>
                <div style=\"margin-top: 10px; color: var(--text-secondary); font-size: 0.9rem;\">
                    ${order.customer_name || 'Walk-in'} • ${this.formatTime(order.created_at)}
                </div>
            </div>
        `).join('');
    }

    async updateStats() {
        try {
            const today = new Date().toISOString().split('T')[0];
            
            // Get today's transactions
            const { data: transactions } = await supabaseClient
                .from('transactions')
                .select('amount')
                .gte('created_at', today + 'T00:00:00');

            // Get ready orders count
            const { data: readyOrders } = await supabaseClient
                .from('orders')
                .select('id')
                .eq('status', 'ready');

            const totalSales = transactions?.reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0;
            const orderCount = transactions?.length || 0;
            const readyCount = readyOrders?.length || 0;

            document.getElementById('todaySales').textContent = this.formatCurrency(totalSales);
            document.getElementById('todayOrders').textContent = orderCount;
            document.getElementById('readyCount').textContent = readyCount;
            
        } catch (error) {
            console.error('Failed to update stats:', error);
        }
    }

    // ==================== SEARCH ====================
    async searchOrder() {
        const searchTerm = document.getElementById('orderSearch').value.trim();
        if (!searchTerm) return;

        try {
            let query = supabaseClient
                .from('orders')
                .select(`
                    *,
                    order_items (
                        *,
                        menu_items (name, price)
                    )
                `)
                .eq('status', 'ready');

            // Search by table number or order ID
            if (!isNaN(searchTerm)) {
                query = query.eq('table_number', parseInt(searchTerm));
            } else {
                query = query.ilike('id', `%${searchTerm}%`);
            }

            const { data: orders } = await query;
            
            if (orders && orders.length > 0) {
                this.renderOrders(orders);
                if (orders.length === 1) {
                    // Auto-open payment for single result
                    setTimeout(() => this.openPayment(orders[0].id), 500);
                }
            } else {
                this.showNotification('No orders found', 'info');
                this.loadOrders(); // Reset to all orders
            }
            
        } catch (error) {
            console.error('Search failed:', error);
            this.showNotification('Search failed', 'error');
        }
    }

    // ==================== PAYMENT PROCESSING ====================
    async openPayment(orderId) {
        try {
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
            
            // Show order info
            document.getElementById('orderInfo').innerHTML = `
                <h4>Table ${order.table_number} - ${order.customer_name || 'Walk-in'}</h4>
                <div style=\"margin: 10px 0;\">
                    ${order.order_items.map(item => 
                        `${item.quantity}x ${item.menu_items.name} - ${this.formatCurrency(item.price * item.quantity)}`
                    ).join('<br>')}
                </div>
            `;
            
            document.getElementById('totalAmount').textContent = this.formatCurrency(order.total_amount);
            document.getElementById('receivedInput').value = '';
            document.getElementById('changeDisplay').textContent = '$0.00';
            
            // Show modal
            document.getElementById('paymentModal').style.display = 'flex';
            
            // Focus amount input
            setTimeout(() => {
                document.getElementById('receivedInput').focus();
                document.getElementById('receivedInput').select();
            }, 100);
            
        } catch (error) {
            console.error('Failed to open payment:', error);
            this.showNotification('Failed to load order', 'error');
        }
    }

    selectPaymentMethod(method) {
        this.selectedPaymentMethod = method;
        
        document.querySelectorAll('.payment-btn-simple').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-method=\"${method}\"]`).classList.add('active');
        
        // Auto-fill amount for non-cash payments
        if (method !== 'cash' && this.currentOrder) {
            document.getElementById('receivedInput').value = this.currentOrder.total_amount;
            this.calculateChange();
        }
    }

    calculateChange() {
        if (!this.currentOrder) return;
        
        const total = parseFloat(this.currentOrder.total_amount);
        const received = parseFloat(document.getElementById('receivedInput').value || 0);
        const change = received - total;
        
        document.getElementById('changeDisplay').textContent = this.formatCurrency(Math.max(0, change));
        
        // Enable pay button if amount is sufficient
        const payBtn = document.getElementById('payBtn');
        if (this.selectedPaymentMethod === 'cash') {
            payBtn.disabled = received < total;
            payBtn.textContent = received < total ? 'Insufficient Amount' : 'PAY & PRINT (Enter)';
        } else {
            payBtn.disabled = false;
            payBtn.textContent = 'PAY & PRINT (Enter)';
        }
    }

    async processPayment() {
        if (!this.currentOrder) return;
        
        const total = parseFloat(this.currentOrder.total_amount);
        const received = this.selectedPaymentMethod === 'cash' ? 
                        parseFloat(document.getElementById('receivedInput').value || 0) : total;
        
        if (this.selectedPaymentMethod === 'cash' && received < total) {
            this.showNotification('Insufficient payment amount', 'error');
            return;
        }

        try {
            // Create transaction
            const transaction = {
                order_id: this.currentOrder.id,
                payment_method: this.selectedPaymentMethod,
                amount: total,
                change_amount: Math.max(0, received - total),
                cashier: 'Demo Cashier',
                created_at: new Date().toISOString()
            };

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

            // Store last transaction for reprinting
            this.lastTransaction = { order: this.currentOrder, transaction };
            
            // Print receipt
            this.printReceipt(this.currentOrder, transaction);
            
            // Success animation
            document.querySelector('.simple-payment').classList.add('payment-success');
            setTimeout(() => {
                document.querySelector('.simple-payment').classList.remove('payment-success');
            }, 500);
            
            this.showNotification('Payment processed successfully!', 'success');
            
            // Close modal and refresh
            setTimeout(() => {
                this.closeModal();
                this.loadOrders();
            }, 1000);
            
        } catch (error) {
            console.error('Payment failed:', error);
            this.showNotification('Payment processing failed', 'error');
        }
    }

    closeModal() {
        document.getElementById('paymentModal').style.display = 'none';
        this.currentOrder = null;
        
        // Reset form
        this.selectedPaymentMethod = 'cash';
        document.querySelectorAll('.payment-btn-simple').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector('[data-method=\"cash\"]').classList.add('active');
        
        // Focus search
        document.getElementById('orderSearch').focus();
    }

    // ==================== PRINTING ====================
    printReceipt(order, transaction) {
        const receiptContent = this.generateReceiptHTML(order, transaction);
        
        // Try thermal printer first
        if (this.printer) {
            this.sendToThermalPrinter(order, transaction);
        } else {
            // Fallback to browser print
            this.printInBrowser(receiptContent);
        }
    }

    printInBrowser(content) {
        const printWindow = window.open('', '_blank', 'width=400,height=600');
        printWindow.document.write(content);
        printWindow.document.close();
        printWindow.print();
        printWindow.close();
    }

    generateReceiptHTML(order, transaction) {
        const now = new Date();
        
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Receipt</title>
                <style>
                    body { font-family: monospace; width: 300px; margin: 0 auto; padding: 10px; font-size: 12px; }
                    .center { text-align: center; }
                    .line { border-bottom: 1px dashed #000; margin: 5px 0; }
                    .item { display: flex; justify-content: space-between; margin: 2px 0; }
                    .total { font-weight: bold; font-size: 14px; margin-top: 10px; }
                    @media print { body { margin: 0; padding: 5px; } }
                </style>
            </head>
            <body>
                <div class=\"center\">
                    <h2>RAMZ-HOTEL</h2>
                    <p>123 ADAMA<br>Tel: () 123-4567</p>
                </div>
                
                <div class=\"line\"></div>
                
                <p>Date: ${now.toLocaleDateString()}<br>
                Time: ${now.toLocaleTimeString()}<br>
                Cashier: Demo Cashier<br>
                Order: #${order.id.slice(-6)}<br>
                Table: ${order.table_number}<br>
                Customer: ${order.customer_name || 'Walk-in'}</p>
                
                <div class=\"line\"></div>
                
                ${order.order_items.map(item => `
                    <div class=\"item\">
                        <span>${item.quantity}x ${item.menu_items.name}</span>
                        <span>${this.formatCurrency(item.price * item.quantity)}</span>
                    </div>
                `).join('')}
                
                <div class=\"line\"></div>
                
                <div class=\"item total\">
                    <span>TOTAL:</span>
                    <span>${this.formatCurrency(order.total_amount)}</span>
                </div>
                
                <p>Payment: ${transaction.payment_method.toUpperCase()}<br>
                ${transaction.payment_method === 'cash' ? 
                    `Received: ${this.formatCurrency(parseFloat(document.getElementById('receivedInput')?.value || 0))}<br>
                     Change: ${this.formatCurrency(transaction.change_amount)}` : ''}</p>
                
                <div class=\"center\">
                    <p>Thank you for dining with us!<br>Visit us again soon!</p>
                </div>
                
                <script>window.print();</script>
            </body>
            </html>
        `;
    }

    async sendToThermalPrinter(order, transaction) {
        // ESC/POS commands for thermal printer
        const commands = [
            '\\x1B\\x40', // Initialize
            '\\x1B\\x61\\x01', // Center align
            'RAMZ-HOTEL\\n',
            '123 ADAMA\\n',
            'Tel: () 123-4567\\n\\n',
            '\\x1B\\x61\\x00', // Left align
            `Date: ${new Date().toLocaleDateString()}\\n`,
            `Time: ${new Date().toLocaleTimeString()}\\n`,
            `Order: #${order.id.slice(-6)}\\n`,
            `Table: ${order.table_number}\\n`,
            `Customer: ${order.customer_name || 'Walk-in'}\\n\\n`,
            '--------------------------------\\n',
            ...order.order_items.map(item => 
                `${item.quantity}x ${item.menu_items.name}\\n    ${this.formatCurrency(item.price * item.quantity)}\\n`
            ),
            '--------------------------------\\n',
            `TOTAL: ${this.formatCurrency(order.total_amount)}\\n`,
            `Payment: ${transaction.payment_method.toUpperCase()}\\n`,
            transaction.payment_method === 'cash' ? 
                `Change: ${this.formatCurrency(transaction.change_amount)}\\n` : '',
            '\\n\\x1B\\x61\\x01', // Center
            'Thank you!\\n\\n\\n',
            '\\x1D\\x56\\x00' // Cut paper
        ].join('');

        try {
            const writer = this.printer.writable.getWriter();
            await writer.write(new TextEncoder().encode(commands));
            writer.releaseLock();
        } catch (error) {
            console.error('Thermal print failed:', error);
            // Fallback to browser print
            this.printInBrowser(this.generateReceiptHTML(order, transaction));
        }
    }

    printLast() {
        if (!this.lastTransaction) {
            this.showNotification('No recent transaction to reprint', 'info');
            return;
        }
        
        this.printReceipt(this.lastTransaction.order, this.lastTransaction.transaction);
        this.showNotification('Receipt reprinted!', 'success');
    }

    // ==================== PRINTER SETUP ====================
    async setupPrinter() {
        if (!('serial' in navigator)) {
            this.showNotification('Thermal printing not supported in this browser', 'error');
            return;
        }

        try {
            const port = await navigator.serial.requestPort();
            await port.open({ baudRate: 9600 });
            
            this.printer = port;
            this.showNotification('Thermal printer connected!', 'success');
            
            // Test print
            const testCommands = [
                '\\x1B\\x40', // Initialize
                '\\x1B\\x61\\x01', // Center
                'RAMZ-HOTEL\\n',
                'Printer Test\\n',
                `${new Date().toLocaleString()}\\n\\n\\n`,
                '\\x1D\\x56\\x00' // Cut
            ].join('');
            
            const writer = this.printer.writable.getWriter();
            await writer.write(new TextEncoder().encode(testCommands));
            writer.releaseLock();
            
        } catch (error) {
            console.error('Printer setup failed:', error);
            this.showNotification('Printer connection failed', 'error');
        }
    }

    // ==================== UTILITY FUNCTIONS ====================
    async refreshOrders() {
        this.showNotification('Refreshing orders...', 'info');
        await this.loadOrders();
        document.getElementById('orderSearch').value = '';
        document.getElementById('orderSearch').focus();
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount || 0);
    }

    formatTime(timestamp) {
        return new Date(timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }

    showNotification(message, type = 'info') {
        // Simple notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#51cf66' : type === 'error' ? '#ff6b6b' : '#339af0'};
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            font-weight: 600;
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// Initialize when page loads
let simpleCashier;

document.addEventListener('DOMContentLoaded', () => {
    const initCashier = () => {
        if (window.supabaseClient) {
            simpleCashier = new SimpleCashier();
            window.simpleCashier = simpleCashier;
        } else {
            setTimeout(initCashier, 100);
        }
    };
    
    initCashier();
});

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);