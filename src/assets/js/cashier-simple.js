// Simple RAMZ Cashier System
class SimpleCashier {
    constructor() {
        this.currentOrder = null;
        this.selectedPaymentMethod = 'cash';
        this.lastTransaction = null;
        this.manualOrderItems = [];
        this.allMenuItems = [];
        this.offlineCache = new OfflineOrderCache();
        this.init();
    }

    async init() {
        console.log('🏪 Simple Cashier System Starting...');
        this.setupEventListeners();
        await this.loadOrders();
        this.setupRealTimeUpdates();
        this.syncOfflineData();
        console.log('✅ Simple Cashier Ready');
    }
    
    async syncOfflineData() {
        if (navigator.onLine && window.supabaseClient) {
            try {
                const synced = await this.offlineCache.syncPendingTransactions();
                if (synced.length > 0) {
                    console.log(`✅ Synced ${synced.length} offline transactions`);
                    this.showNotification(`Synced ${synced.length} offline transactions`, 'success');
                }
                await this.offlineCache.clearOldCache(7);
            } catch (error) {
                console.warn('Sync failed:', error);
            }
        }
    }

    setupEventListeners() {
        // Search
        document.getElementById('searchBtn').addEventListener('click', () => this.searchOrder());
        
        // Refresh orders
        document.getElementById('refreshOrders').addEventListener('click', () => this.refreshOrders());
        
        // Print last receipt
        document.getElementById('printLastBtn').addEventListener('click', () => this.printLast());
        
        // Manual print button
        document.getElementById('manualPrintBtn').addEventListener('click', () => this.showManualOrderModal());
        
        // Payment methods
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
        
        // Manual order modal events (with null checks)
        const closeBtn = document.getElementById('closeManualOrder');
        const printBtn = document.getElementById('printManualOrder');
        const clearBtn = document.getElementById('clearManualOrder');
        const searchInput = document.getElementById('menuSearch');
        
        if (closeBtn) closeBtn.addEventListener('click', () => this.closeManualOrderModal());
        if (printBtn) printBtn.addEventListener('click', () => this.printManualOrder());
        if (clearBtn) clearBtn.addEventListener('click', () => this.clearManualOrder());
        if (searchInput) searchInput.addEventListener('input', (e) => this.searchMenuItems(e.target.value));
    }

    async loadOrders() {
        try {
            console.log('Loading orders...');
            
            if (!window.supabaseClient || !navigator.onLine) {
                console.log('Offline - loading from cache');
                const cachedReady = await this.offlineCache.getCachedOrders('ready');
                const cachedServed = await this.offlineCache.getCachedOrders('served');
                this.renderOrders([...cachedReady, ...cachedServed]);
                this.updateStats();
                return;
            }
            
            const { data: orders, error } = await supabaseClient
                .from('orders')
                .select(`
                    *,
                    order_items (
                        *,
                        menu_items (name, price)
                    )
                `)
                .in('status', ['ready', 'served'])
                .order('created_at', { ascending: true });

            if (error) {
                console.error('Database error:', error);
                const cachedReady = await this.offlineCache.getCachedOrders('ready');
                const cachedServed = await this.offlineCache.getCachedOrders('served');
                this.renderOrders([...cachedReady, ...cachedServed]);
                return;
            }

            console.log('Orders loaded:', orders);
            
            // Cache orders for offline use
            if (orders && orders.length > 0) {
                for (const order of orders) {
                    await this.offlineCache.cacheOrder(order);
                }
            }
            
            this.renderOrders(orders || []);
            this.updateStats();
            
        } catch (error) {
            console.error('Failed to load orders:', error);
            const cachedReady = await this.offlineCache.getCachedOrders('ready');
            const cachedServed = await this.offlineCache.getCachedOrders('served');
            this.renderOrders([...cachedReady, ...cachedServed]);
        }
    }
    

    renderOrders(orders) {
        const container = document.getElementById('ordersList');

        if (orders.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No Ready Orders</h3>
                    <p>All orders processed!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = orders.map(order => {
            const orderAge = this.getOrderAge(order.created_at);
            const statusClass = orderAge > 15 ? 'urgent' : orderAge > 10 ? 'waiting' : 'new';
            const isServed = order.status === 'served';
            const servedBadge = isServed ? `<div style="font-size:0.75rem;color:#51cf66;font-weight:600;">✓ SERVED</div>` : '';

            return `
                <div class="order-item ${statusClass}" onclick="simpleCashier.selectOrder('${order.id}', event)">
                    <div class="order-item-header">
                        <div class="order-table">Table ${order.table_number}</div>
                        <div class="order-total">${this.formatCurrency(order.total_amount)}</div>
                    </div>
                    <div class="order-customer">${order.customer_name || 'Walk-in'}</div>
                    <div class="order-time">${this.formatTime(order.created_at)} (${orderAge}m)</div>
                    ${servedBadge}
                </div>
            `;
        }).join('');
    }

    async updateStats() {
        try {
            const today = new Date().toISOString().split('T')[0];
            let totalSales = 0;
            let orderCount = 0;
            let readyCount = 0;
            
            // Try to get data from database
            try {
                const { data: transactions } = await supabaseClient
                    .from('transactions')
                    .select('amount')
                    .gte('created_at', today + 'T00:00:00');

                const { data: readyOrders } = await supabaseClient
                    .from('orders')
                    .select('id')
                    .in('status', ['ready', 'served']);

                if (transactions) {
                    totalSales = transactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
                    orderCount = transactions.length;
                }
                if (readyOrders) {
                    readyCount = readyOrders.length;
                }
            } catch (dbError) {
                console.warn('Database stats failed, using localStorage:', dbError);
            }
            
            // Add localStorage data (for manual orders and offline tracking)
            const localStats = this.getLocalStats();
            totalSales += localStats.sales;
            orderCount += localStats.orders;

            document.getElementById('todaySales').textContent = this.formatCurrency(totalSales);
            document.getElementById('orderCount').textContent = orderCount;
            document.getElementById('readyCount').textContent = readyCount;
            
        } catch (error) {
            console.error('Failed to update stats:', error);
            // Fallback to localStorage only
            const localStats = this.getLocalStats();
            document.getElementById('todaySales').textContent = this.formatCurrency(localStats.sales);
            document.getElementById('orderCount').textContent = localStats.orders;
            document.getElementById('readyCount').textContent = '0';
        }
    }

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
                .in('status', ['ready', 'served']);

            if (!isNaN(searchTerm)) {
                query = query.eq('table_number', parseInt(searchTerm));
            } else {
                query = query.ilike('id', `%${searchTerm}%`);
            }

            const { data: orders } = await query;
            
            if (orders && orders.length > 0) {
                this.renderOrders(orders);
                if (orders.length === 1) {
                    setTimeout(() => this.selectOrder(orders[0].id), 500);
                }
            } else {
                this.showNotification('No orders found', 'info');
                this.loadOrders();
            }
            
        } catch (error) {
            console.error('Search failed:', error);
            this.showNotification('Search failed', 'error');
        }
    }

    async selectOrder(orderId, clickEvent) {
        try {
            const { data: order } = await window.supabaseClient
                .from('orders')
                .select(`*, order_items (id, quantity, price, menu_item_id, menu_items (name, price))`)
                .eq('id', orderId)
                .single();

            if (!order) {
                this.showNotification('Order not found', 'error');
                return;
            }

            this.currentOrder = order;
            
            // Update order selection visual
            document.querySelectorAll('.order-item').forEach(item => {
                item.classList.remove('selected');
            });
            
            if (clickEvent && clickEvent.target) {
                clickEvent.target.closest('.order-item').classList.add('selected');
            }
            
            this.showOrderDetails(order);
            this.showPaymentPanel(order);
            
        } catch (error) {
            console.error('Failed to select order:', error);
            this.showNotification('Failed to load order', 'error');
        }
    }
    
    showOrderDetails(order) {
        const panel = document.getElementById('orderDetailsPanel');
        const isServed = order.status === 'served';
        panel.innerHTML = `
            <div class="order-details-content active">
                <div class="order-header-details">
                    <h2>Table ${order.table_number}</h2>
                    <div class="order-info-row">
                        <span class="label">Customer:</span>
                        <span class="value">${order.customer_name || 'Walk-in'}</span>
                    </div>
                    <div class="order-info-row">
                        <span class="label">Order Time:</span>
                        <span class="value">${this.formatTime(order.created_at)}</span>
                    </div>
                    <div class="order-info-row">
                        <span class="label">Status:</span>
                        <span class="value" style="color:${isServed ? '#51cf66' : '#ffd43b'};font-weight:600;">${isServed ? '✓ Served - Awaiting Payment' : 'Ready'}</span>
                    </div>
                    <div class="order-info-row">
                        <span class="label">Total:</span>
                        <span class="value">${this.formatCurrency(order.total_amount)}</span>
                    </div>
                </div>

                <div class="order-items-details">
                    <h3>Order Items</h3>
                    ${order.order_items.map(item => `
                        <div class="item-row">
                            <div class="item-name">${item.menu_items.name}</div>
                            <div class="item-qty">${item.quantity}</div>
                            <div class="item-price">${this.formatCurrency(item.price * item.quantity)}</div>
                        </div>
                    `).join('')}
                </div>

                <div class="order-actions">
                    <button class="btn btn-primary" onclick="simpleCashier.printAndCloseOrder('${order.id}')">
                        <i class="fas fa-print"></i> Print Receipt & Close
                    </button>
                </div>
            </div>
        `;
    }
    
    showPaymentPanel(order) {
        document.getElementById('orderInfo').innerHTML = `
            <h4>Table ${order.table_number} - ${order.customer_name || 'Walk-in'}</h4>
            <div style="margin: 10px 0; font-size: 0.9rem; color: var(--text-secondary);">
                ${order.order_items.length} items • ${this.formatTime(order.created_at)}
            </div>
        `;
        
        document.getElementById('totalAmount').textContent = this.formatCurrency(order.total_amount);
        document.getElementById('receivedInput').value = '';
        document.getElementById('changeDisplay').textContent = '0.00';
        
        document.getElementById('paymentPanel').style.display = 'block';
        
        setTimeout(() => {
            document.getElementById('receivedInput').focus();
        }, 100);
    }

    selectPaymentMethod(method) {
        this.selectedPaymentMethod = method;
        
        document.querySelectorAll('.payment-btn-simple').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-method="${method}"]`).classList.add('active');
        
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
            let cashierName = 'Demo Cashier';
            try {
                const { data } = await supabaseClient.rpc('get_cashier_name');
                if (data) cashierName = data;
            } catch (e) {
                console.warn('Could not get cashier name:', e);
            }
            
            // Get current shift ID to link this transaction to the active shift
            const shiftId = localStorage.getItem('current_shift_id');
            
            const transaction = {
                order_id: this.currentOrder.id,
                payment_method: this.selectedPaymentMethod,
                amount: total,
                change_amount: Math.max(0, received - total),
                cashier: cashierName,
                shift_id: shiftId, // Link to shift
                created_at: new Date().toISOString()
            };

            // Try online sync first
            if (navigator.onLine && window.supabaseClient) {
                try {
                    const { error: transactionError } = await window.supabaseClient
                        .from('transactions')
                        .insert([{
                            order_id:       this.currentOrder.id,
                            payment_method: this.selectedPaymentMethod,
                            amount:         total,
                            change_amount:  Math.max(0, received - total),
                            cashier:        cashierName,
                            shift_id:       shiftId || null,
                            created_at:     new Date().toISOString()
                        }]);
                        
                    if (transactionError) {
                        console.warn('Transaction insert failed:', transactionError);
                        await this.offlineCache.cachePendingTransaction(transaction);
                    }
                } catch (transactionErr) {
                    console.warn('Transaction failed, caching offline:', transactionErr);
                    await this.offlineCache.cachePendingTransaction(transaction);
                }
                
            const { error: orderError } = await window.supabaseClient
                    .from('orders')
                    .update({ 
                        status: 'completed',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', this.currentOrder.id);
                    
                if (orderError) {
                    console.warn('Order update failed:', orderError);
                }
                
                // Remove from offline cache
                await this.offlineCache.removeOrder(this.currentOrder.id);
            } else {
                // Offline - cache transaction
                await this.offlineCache.cachePendingTransaction(transaction);
                this.showNotification('Payment saved offline - will sync when online', 'info');
            }

            this.addToLocalStats(total);
            this.lastTransaction = { order: this.currentOrder, transaction };
            this.printReceipt(this.currentOrder, transaction);
            this.showNotification('Payment processed successfully!', 'success');
            
            setTimeout(() => {
                this.closeModal();
                this.loadOrders();
                this.updateStats();
            }, 1000);
            
        } catch (error) {
            console.error('Payment failed:', error);
            this.showNotification('Payment processing failed', 'error');
        }
    }

    async deductInventory(order) {
        console.log('📦 Deducting inventory for order:', order.id);
        console.log('📦 Order items:', order.order_items);

        try {
            const { data: { user } } = await window.supabaseClient.auth.getUser();

            for (const item of order.order_items) {
                const menuItemId = item.menu_item_id;
                console.log(`🔍 Looking up recipe for menu_item_id: ${menuItemId} (${item.menu_items?.name})`);

                if (!menuItemId) {
                    console.warn('⚠️ item.menu_item_id is missing — skipping', item);
                    continue;
                }

                // Fetch recipe + current ingredient stock in one query
                const { data: recipes, error: recipeErr } = await window.supabaseClient
                    .from('recipes')
                    .select(`
                        quantity_required,
                        ingredient_id,
                        ingredients ( id, name, current_stock )
                    `)
                    .eq('menu_item_id', menuItemId);

                if (recipeErr) {
                    console.error('Recipe fetch error:', recipeErr);
                    continue;
                }

                if (!recipes || recipes.length === 0) {
                    console.warn(`⚠️ No recipe for "${item.menu_items?.name}" — no deduction`);
                    continue;
                }

                console.log(`✅ Found ${recipes.length} recipe(s) for "${item.menu_items?.name}"`);

                for (const recipe of recipes) {
                    const totalDeduction  = recipe.quantity_required * item.quantity;
                    const currentStock    = parseFloat(recipe.ingredients.current_stock);
                    const newStock        = Math.max(0, currentStock - totalDeduction);

                    console.log(`   → ${recipe.ingredients.name}: ${currentStock} - ${totalDeduction} = ${newStock}`);

                    const { error: movErr } = await window.supabaseClient
                        .from('stock_movements')
                        .insert([{
                            ingredient_id:     recipe.ingredient_id,
                            user_id:           user?.id || null,
                            type:              'sale',
                            quantity_change:   -totalDeduction,
                            previous_quantity: currentStock,
                            new_quantity:      newStock,
                            reference_id:      order.id,
                            notes:             `Sale: ${item.quantity}x ${item.menu_items?.name}`
                        }]);

                    if (movErr) console.error('❌ Stock movement failed:', movErr);
                    else console.log(`✅ Deducted ${totalDeduction} from ${recipe.ingredients.name}`);
                }
            }
        } catch (err) {
            console.error('❌ Inventory deduction crashed:', err);
        }
    }

    closeModal() {
        document.getElementById('paymentPanel').style.display = 'none';
        this.currentOrder = null;
        
        document.querySelectorAll('.order-item').forEach(item => {
            item.classList.remove('selected');
        });
        
        document.getElementById('orderDetailsPanel').innerHTML = `
            <div class="no-selection">
                <i class="fas fa-hand-pointer"></i>
                <h3>Select an Order</h3>
                <p>Click on an order from the left to view details and process payment</p>
            </div>
        `;
        
        this.selectedPaymentMethod = 'cash';
        document.querySelectorAll('.payment-btn-simple').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector('[data-method="cash"]').classList.add('active');
    }

    printReceipt(order, transaction) {
        const receiptContent = this.generateReceiptHTML(order, transaction);
        this.printInBrowser(receiptContent);
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
                <div class="center">
                    <h2>RAMZ-HOTEL</h2>
                    <p>123 ADAMA<br>Tel: () 123-4567</p>
                </div>
                
                <div class="line"></div>
                
                <p>Date: ${now.toLocaleDateString()}<br>
                Time: ${now.toLocaleTimeString()}<br>
                Cashier: Demo Cashier<br>
                Order: #${order.id.slice(-6)}<br>
                ${order.table_number ? `Table: ${order.table_number}<br>` : ''}
                Customer: ${order.customer_name || 'Walk-in'}</p>
                
                <div class="line"></div>
                
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
                
                <p>Payment: ${transaction.payment_method.toUpperCase()}<br>
                ${transaction.payment_method === 'cash' ? 
                    `Received: ${this.formatCurrency(parseFloat(document.getElementById('receivedInput')?.value || 0))}<br>
                     Change: ${this.formatCurrency(transaction.change_amount)}` : ''}</p>
                
                <div class="center">
                    <p>Thank you for dining with us!<br>Visit us again soon!</p>
                </div>
                
                <script>window.print();</script>
            </body>
            </html>
        `;
    }

    printLast() {
        if (!this.lastTransaction) {
            this.showNotification('No recent transaction to reprint', 'info');
            return;
        }
        
        this.printReceipt(this.lastTransaction.order, this.lastTransaction.transaction);
        this.showNotification('Receipt reprinted!', 'success');
    }

    setAmount(amount) {
        document.getElementById('receivedInput').value = amount;
        this.calculateChange();
    }
    
    setExactAmount() {
        if (this.currentOrder) {
            document.getElementById('receivedInput').value = this.currentOrder.total_amount;
            this.calculateChange();
        }
    }
    
    async refreshOrders() {
        this.showNotification('Refreshing orders...', 'info');
        await this.loadOrders();
        document.getElementById('orderSearch').value = '';
    }
    
    getOrderAge(timestamp) {
        const now = new Date();
        const orderTime = new Date(timestamp);
        return Math.floor((now - orderTime) / (1000 * 60));
    }
    
    async printOrderReceipt(orderId) {
        try {
            const { data: order } = await supabaseClient
                .from('orders')
                .select(`*, order_items (*, menu_items (name, price))`)
                .eq('id', orderId)
                .single();

            if (!order) { this.showNotification('Order not found', 'error'); return; }

            const mockTransaction = {
                payment_method: 'manual_print',
                amount: order.total_amount,
                change_amount: 0,
                created_at: new Date().toISOString()
            };
            this.printReceipt(order, mockTransaction);
            this.showNotification('Receipt printed!', 'success');
        } catch (error) {
            console.error('Failed to print receipt:', error);
            this.showNotification('Failed to print receipt', 'error');
        }
    }

    async printAndCloseOrder(orderId) {
        try {
            const { data: order } = await window.supabaseClient
                .from('orders')
                .select(`*, order_items (id, quantity, price, menu_item_id, menu_items (name, price))`)
                .eq('id', orderId)
                .single();

            if (!order) { this.showNotification('Order not found', 'error'); return; }

            const transaction = {
                payment_method: this.selectedPaymentMethod || 'cash',
                amount: order.total_amount,
                change_amount: 0,
                created_at: new Date().toISOString()
            };
            this.printReceipt(order, transaction);

            const { error } = await window.supabaseClient
                .from('orders')
                .update({ status: 'completed', updated_at: new Date().toISOString() })
                .eq('id', orderId);

            if (error) throw error;

            // Deduct inventory on close
            await this.deductInventory(order);

            this.showNotification('Receipt printed & order closed!', 'success');
            this.closeModal();
            this.loadOrders();
            this.updateStats();
        } catch (error) {
            console.error('Failed to print and close order:', error);
            this.showNotification('Failed to close order', 'error');
        }
    }
    
    showManualOrderModal() {
        this.manualOrderItems = [];
        const modal = document.getElementById('manualOrderModal');
        if (modal) {
            modal.style.display = 'flex';
            this.loadMenuItems();
            this.updateManualOrderDisplay();
        }
    }
    
    closeManualOrderModal() {
        const modal = document.getElementById('manualOrderModal');
        if (modal) {
            modal.style.display = 'none';
            this.manualOrderItems = [];
        }
    }
    
    async loadMenuItems() {
        console.log('Loading menu items from database...');
        
        try {
            // Try cache first if offline
            if (!navigator.onLine) {
                const cachedItems = await this.offlineCache.getCachedMenuItems();
                if (cachedItems.length > 0) {
                    this.allMenuItems = cachedItems;
                    this.renderMenuItems(this.allMenuItems);
                    return;
                }
            }
            
            let { data: menuItems, error } = await supabaseClient
                .from('menu_items')
                .select('*')
                .order('name');

            if (error) {
                console.warn('First query failed:', error);
                const result = await supabaseClient
                    .from('menu_items')
                    .select('id, name, price')
                    .order('name');
                    
                menuItems = result.data;
            }

            if (menuItems && menuItems.length > 0) {
                console.log('Database menu items loaded:', menuItems);
                this.allMenuItems = menuItems;
                await this.offlineCache.cacheMenuItems(menuItems);
                this.renderMenuItems(this.allMenuItems);
                return;
            }
            
        } catch (error) {
            console.error('Failed to load menu items from database:', error);
            
            // Try cache
            const cachedItems = await this.offlineCache.getCachedMenuItems();
            if (cachedItems.length > 0) {
                this.allMenuItems = cachedItems;
                this.renderMenuItems(this.allMenuItems);
                return;
            }
        }
        
        console.log('Using fallback test menu items');
        this.allMenuItems = [
            { id: 1, name: 'Burger', price: 12.99 },
            { id: 2, name: 'Pizza', price: 18.99 },
            { id: 3, name: 'Fries', price: 5.99 },
            { id: 4, name: 'Salad', price: 9.99 },
            { id: 5, name: 'Soda', price: 2.99 },
            { id: 6, name: 'Chicken Wings', price: 14.99 },
            { id: 7, name: 'Pasta', price: 16.99 },
            { id: 8, name: 'Coffee', price: 3.99 }
        ];
        
        this.renderMenuItems(this.allMenuItems);
    }
    
    renderMenuItems(items) {
        console.log('Rendering menu items:', items);
        const container = document.getElementById('menuItemsList');
        
        if (!container) {
            console.error('Menu items container not found!');
            return;
        }
        
        if (!items || items.length === 0) {
            container.innerHTML = '<div class="no-items">No menu items available</div>';
            return;
        }
        
        container.innerHTML = items.map(item => `
            <div class="menu-item-card" data-id="${item.id}" data-name="${item.name.replace(/"/g, '&quot;')}" data-price="${item.price}">
                <div class="menu-item-name">${item.name}</div>
                <div class="menu-item-price">${this.formatCurrency(item.price)}</div>
            </div>
        `).join('');
        
        // Add event listeners to menu items
        container.querySelectorAll('.menu-item-card').forEach(card => {
            card.addEventListener('click', () => {
                const id = card.dataset.id;
                const name = card.dataset.name;
                const price = card.dataset.price;
                this.addToManualOrder(id, name, price);
            });
        });
        
        console.log('Menu items rendered, total:', items.length);
    }
    
    searchMenuItems(query) {
        if (!query) {
            this.renderMenuItems(this.allMenuItems);
            return;
        }
        
        const filtered = this.allMenuItems.filter(item => 
            item.name.toLowerCase().includes(query.toLowerCase())
        );
        this.renderMenuItems(filtered);
    }
    
    addToManualOrder(id, name, price) {
        console.log('Adding to manual order:', { id, name, price });
        
        // Ensure manualOrderItems is initialized
        if (!this.manualOrderItems) {
            this.manualOrderItems = [];
        }
        
        // Convert id to number for consistent comparison
        const itemId = parseInt(id);
        const itemPrice = parseFloat(price);
        
        const existingItem = this.manualOrderItems.find(item => parseInt(item.id) === itemId);
        
        if (existingItem) {
            existingItem.quantity += 1;
            console.log('Updated existing item:', existingItem);
        } else {
            const newItem = { 
                id: itemId, 
                name: name, 
                price: itemPrice, 
                quantity: 1 
            };
            this.manualOrderItems.push(newItem);
            console.log('Added new item:', newItem);
        }
        
        console.log('Current manual order items:', this.manualOrderItems);
        this.updateManualOrderDisplay();
    }
    
    updateManualOrderDisplay() {
        console.log('Updating manual order display');
        const container = document.getElementById('orderItemsList');
        
        if (!container) {
            console.error('Order items container not found!');
            return;
        }
        
        if (!this.manualOrderItems || this.manualOrderItems.length === 0) {
            container.innerHTML = '<div class="empty-order">No items added</div>';
            document.getElementById('manualOrderTotal').textContent = '0.00';
            return;
        }
        
        container.innerHTML = this.manualOrderItems.map(item => `
            <div class="order-item-row">
                <div>
                    <div class="item-name">${item.name}</div>
                    <div class="item-price">${this.formatCurrency(item.price)} each</div>
                </div>
                <div class="order-item-controls">
                    <button class="qty-btn" onclick="simpleCashier.changeQuantity(${item.id}, -1)">-</button>
                    <span class="quantity">${item.quantity}</span>
                    <button class="qty-btn" onclick="simpleCashier.changeQuantity(${item.id}, 1)">+</button>
                    <span class="item-total">${this.formatCurrency(item.price * item.quantity)}</span>
                </div>
            </div>
        `).join('');
        
        const total = this.manualOrderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        document.getElementById('manualOrderTotal').textContent = this.formatCurrency(total);
        
        console.log('Manual order display updated, total:', total);
    }
    
    changeQuantity(id, change) {
        const itemId = parseInt(id);
        const item = this.manualOrderItems.find(item => parseInt(item.id) === itemId);
        if (!item) return;
        
        item.quantity += change;
        
        if (item.quantity <= 0) {
            this.manualOrderItems = this.manualOrderItems.filter(i => parseInt(i.id) !== itemId);
        }
        
        this.updateManualOrderDisplay();
    }
    
    clearManualOrder() {
        this.manualOrderItems = [];
        this.updateManualOrderDisplay();
    }
    
    async printManualOrder() {
        if (this.manualOrderItems.length === 0) {
            this.showNotification('No items to print', 'error');
            return;
        }
        
        const total = this.manualOrderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        try {
            // Get cashier name
            let cashierName = 'Demo Cashier';
            try {
                const { data } = await supabaseClient.rpc('get_cashier_name');
                if (data) cashierName = data;
            } catch (e) {
                console.warn('Could not get cashier name:', e);
            }
            
            // Get current shift ID
            const shiftId = localStorage.getItem('current_shift_id');
            
            // Create order in database
            const orderData = {
                table_number: null,
                customer_name: 'Walk-in',
                total_amount: total,
                status: 'completed',
                order_type: 'manual',
                created_at: new Date().toISOString()
            };
            
            const { data: newOrder, error: orderError } = await supabaseClient
                .from('orders')
                .insert([orderData])
                .select()
                .single();
                
            if (orderError) {
                console.warn('Failed to save manual order:', orderError);
            }
            
            // Create order items if order was saved
            if (newOrder) {
                const orderItems = this.manualOrderItems.map(item => ({
                    order_id: newOrder.id,
                    menu_item_id: item.id,
                    quantity: item.quantity,
                    price: item.price
                }));
                
                const { error: itemsError } = await supabaseClient
                    .from('order_items')
                    .insert(orderItems);
                    
                if (itemsError) {
                    console.warn('Failed to save order items:', itemsError);
                }
                
                // Create transaction record
                const { error: transactionError } = await window.supabaseClient
                    .from('transactions')
                    .insert([{
                        order_id:       newOrder.id,
                        payment_method: 'cash',
                        amount:         total,
                        change_amount:  0,
                        cashier:        cashierName,
                        shift_id:       shiftId || null,
                        created_at:     new Date().toISOString()
                    }]);
                    
                if (transactionError) {
                    console.warn('Failed to save transaction:', transactionError);
                }
            }
            
        } catch (error) {
            console.warn('Database save failed for manual order:', error);
        }
        
        // Create order object for receipt
        const manualOrder = {
            id: (newOrder ? newOrder.id : 'manual-' + Date.now()),
            table_number: null,
            customer_name: 'Walk-in',
            total_amount: total,
            created_at: new Date().toISOString(),
            order_items: this.manualOrderItems.map(item => ({
                quantity: item.quantity,
                price: item.price,
                menu_item_id: item.id,
                menu_items: { name: item.name, price: item.price }
            }))
        };
        
        const transaction = {
            payment_method: 'manual_order',
            amount: total,
            change_amount: 0,
            created_at: new Date().toISOString()
        };
        
        // Track in localStorage for stats
        this.addToLocalStats(total);
        
        // Deduct inventory for manual order
        await this.deductInventory(manualOrder);

        this.printReceipt(manualOrder, transaction);
        this.showNotification('Manual order saved and printed!', 'success');
        this.closeManualOrderModal();
        this.updateStats();
    }

    formatCurrency(amount) {
        return (amount || 0).toFixed(2);
    }

    formatTime(timestamp) {
        return new Date(timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }

    showNotification(message, type = 'info') {
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
    
    getLocalStats() {
        try {
            const today = new Date().toISOString().split('T')[0];
            const stats = JSON.parse(localStorage.getItem('dailyStats') || '{}');
            return stats[today] || { sales: 0, orders: 0 };
        } catch (error) {
            return { sales: 0, orders: 0 };
        }
    }
    
    addToLocalStats(amount) {
        try {
            const today = new Date().toISOString().split('T')[0];
            const allStats = JSON.parse(localStorage.getItem('dailyStats') || '{}');
            const todayStats = allStats[today] || { sales: 0, orders: 0 };
            
            todayStats.sales += parseFloat(amount);
            todayStats.orders += 1;
            
            allStats[today] = todayStats;
            localStorage.setItem('dailyStats', JSON.stringify(allStats));
        } catch (error) {
            console.warn('Failed to save local stats:', error);
        }
    }
    
    setupRealTimeUpdates() {
        if (!window.supabaseClient) {
            console.warn('No Supabase client - using polling fallback');
            this.startPolling();
            return;
        }

        // Debounce timer to avoid rapid consecutive reloads
        this._reloadTimer = null;

        try {
            supabaseClient
                .channel('orders-changes')
                .on('postgres_changes',
                    { event: '*', schema: 'public', table: 'orders' },
                    (payload) => {
                        console.log('Order change detected:', payload);
                        this.handleOrderChange(payload);
                    }
                )
                .subscribe();

            console.log('✅ Real-time subscriptions active');
        } catch (error) {
            console.warn('Real-time setup failed, using polling:', error);
            this.startPolling();
        }
    }

    startPolling() {
        setInterval(() => this.loadOrders(), 30000);
        console.log('📡 Polling mode active (30s intervals)');
    }

    handleOrderChange(payload) {
        const { eventType, new: newRecord, old: oldRecord } = payload;

        // Show notifications
        if (eventType === 'UPDATE') {
            if (newRecord.status === 'ready' && oldRecord.status !== 'ready') {
                this.showNotification(`Order ready: Table ${newRecord.table_number}`, 'info');
            } else if (newRecord.status === 'served') {
                this.showNotification(`Order served - awaiting payment: Table ${newRecord.table_number}`, 'info');
            }
        }

        // If order became 'completed', remove it from local display immediately
        // without waiting for a reload (avoids flicker)
        if (eventType === 'UPDATE' && newRecord.status === 'completed') {
            const container = document.getElementById('ordersList');
            const el = container?.querySelector(`[onclick*="'${newRecord.id}'"]`);
            if (el) el.closest('.order-item')?.remove();
        }

        // Debounce reloads — wait 600ms after last event before reloading
        // This prevents rapid-fire reloads from Supabase real-time that
        // cause the 'served' order to flicker and disappear
        clearTimeout(this._reloadTimer);
        this._reloadTimer = setTimeout(() => this.loadOrders(), 600);
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