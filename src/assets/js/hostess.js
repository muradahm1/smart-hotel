// Waiters dashboard - no authentication required
let orders = [];

document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        loadOrders();
        listenForOrderUpdates();
    }, 500);
});

async function loadOrders() {
    if (!supabase) {
        document.getElementById('ordersGrid').innerHTML = '<div class="empty-state">Database connection failed</div>';
        return;
    }
    
    try {
        // Only load orders from today and yesterday for security
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);
        
        const { data, error } = await supabase
            .from('orders')
            .select(`
                id, table_number, customer_name, status, created_at, updated_at, location_info, order_source,
                order_items (
                    quantity,
                    price,
                    menu_items (name)
                )
            `)
            .gte('created_at', yesterday.toISOString())
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        orders = data || [];
        renderOrders();
        updateStats();
    } catch (error) {
        console.error('Error loading orders:', error);
        document.getElementById('ordersGrid').innerHTML = '<div class="empty-state">Failed to load orders: ' + error.message + '</div>';
    }
}

function renderOrders() {
    const ordersGrid = document.getElementById('ordersGrid');
    
    // Clear existing content
    ordersGrid.innerHTML = '';
    
    if (orders.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.textContent = 'No orders yet';
        ordersGrid.appendChild(emptyState);
        return;
    }

    const readyOrders = orders.filter(order => order.status === 'ready');

    if (readyOrders.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.textContent = 'No orders are ready for pickup.';
        ordersGrid.appendChild(emptyState);
        return;
    }

    // Render orders securely using DOM methods
    readyOrders.forEach(order => {
        // Validate order ID
        if (!order.id || typeof order.id !== 'string') {
            console.error('Invalid order ID:', order.id);
            return;
        }
        
        const orderCard = document.createElement('div');
        orderCard.className = 'order-card';
        
        // Header
        const header = document.createElement('div');
        header.className = 'order-card-header';
        
        const orderInfo = document.createElement('div');
        orderInfo.className = 'order-info';
        
        const tableSpan = document.createElement('span');
        tableSpan.className = 'order-table';
        tableSpan.textContent = order.location_info || `Table ${order.table_number || 'Unknown'}`;
        
        const customerSmall = document.createElement('small');
        const customerText = (order.customer_name || 'Unknown Customer');
        const qrText = order.order_source === 'qr_scan' ? ' 📱 QR Scan' : '';
        customerSmall.textContent = customerText + qrText;
        
        orderInfo.appendChild(tableSpan);
        orderInfo.appendChild(customerSmall);
        
        const statusSpan = document.createElement('span');
        statusSpan.className = `order-status status-${order.status || 'unknown'}`;
        statusSpan.textContent = order.status || 'unknown';
        
        header.appendChild(orderInfo);
        header.appendChild(statusSpan);
        
        // Items list
        const itemsList = document.createElement('div');
        itemsList.className = 'order-items-list';
        
        if (order.order_items && order.order_items.length > 0) {
            order.order_items.forEach(item => {
                const itemRow = document.createElement('div');
                itemRow.className = 'order-item-row';
                
                const itemName = document.createElement('span');
                itemName.textContent = `${item.quantity || 0}x ${item.menu_items?.name || 'Unknown Item'}`;
                
                const itemPrice = document.createElement('span');
                itemPrice.textContent = formatCurrency((item.price || 0) * (item.quantity || 0));
                
                itemRow.appendChild(itemName);
                itemRow.appendChild(itemPrice);
                itemsList.appendChild(itemRow);
            });
        } else {
            const noItemsRow = document.createElement('div');
            noItemsRow.className = 'order-item-row';
            const noItemsSpan = document.createElement('span');
            noItemsSpan.textContent = 'No items found';
            noItemsRow.appendChild(noItemsSpan);
            itemsList.appendChild(noItemsRow);
        }
        
        // Actions
        const actions = document.createElement('div');
        actions.className = 'order-card-actions';
        
        const servedBtn = document.createElement('button');
        servedBtn.className = 'btn btn-success';
        
        const icon = document.createElement('i');
        icon.className = 'fas fa-check-circle';
        
        servedBtn.appendChild(icon);
        servedBtn.appendChild(document.createTextNode(' Mark as Served'));
        
        // Add secure event listener
        servedBtn.addEventListener('click', () => {
            if (order.id) {
                markAsServed(order.id);
            }
        });
        
        actions.appendChild(servedBtn);
        
        // Assemble order card
        orderCard.appendChild(header);
        orderCard.appendChild(itemsList);
        orderCard.appendChild(actions);
        
        ordersGrid.appendChild(orderCard);
    });
}

async function markAsServed(orderId) {
    try {
        const { error } = await supabase
            .from('orders')
            .update({ 
                status: 'completed',
                updated_at: new Date().toISOString()
            })
            .eq('id', orderId);
            
        if (error) throw error;
        
        showNotification(`Order ${orderId.substring(0, 8)} marked as served.`, 'success');
        loadOrders();
    } catch (error) {
        console.error('Error marking order as served:', error);
        showNotification('Failed to mark order as served', 'error');
    }
}

// Make updateOrderStatus globally available
window.updateOrderStatus = async function(orderId, newStatus) {
    try {
        const { error } = await supabase
            .from('orders')
            .update({ 
                status: newStatus,
                updated_at: new Date().toISOString()
            })
            .eq('id', orderId);
            
        if (error) throw error;
        
        showNotification(`Order status updated to ${newStatus}`, 'success');
        loadOrders();
    } catch (error) {
        console.error('Error updating order status:', error);
        showNotification('Failed to update order status', 'error');
    }
};

function updateStats() {
    const pending = orders.filter(order => order.status === 'pending').length;
    const preparing = orders.filter(order => order.status === 'preparing').length;
    const ready = orders.filter(order => order.status === 'ready').length;
    
    document.getElementById('pendingOrders').textContent = pending;
    document.getElementById('preparingOrders').textContent = preparing;
    document.getElementById('readyOrders').textContent = ready;
}

function listenForOrderUpdates() {
    if (!supabase) return;

    const channel = supabase.channel('hostess-orders')
        .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'orders' 
        }, payload => {
            console.log('Waiters - Order update detected:', payload);

            // Play sound for ready orders (chef marked as ready)
            if (payload.eventType === 'UPDATE' && payload.new.status === 'ready') {
                showNotification(`Order for ${payload.new.location_info || `Table ${payload.new.table_number}`} is ready for pickup!`, 'success');
                if (typeof playNotificationSound === 'function') {
                    playNotificationSound();
                }
            }
            
            // Play sound for new orders
            if (payload.eventType === 'INSERT') {
                showNotification(`New order from ${payload.new.location_info || `Table ${payload.new.table_number}`}`, 'info');
                if (typeof playNotificationSound === 'function') {
                    playNotificationSound();
                }
            }

            setTimeout(() => loadOrders(), 100);
        })
        .subscribe((status) => {
            console.log('Waiters subscription status:', status);
        });
}



function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification-toast ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'exclamation' : 'info'}-circle"></i>
        <p>${message}</p>
    `;
    
    const notificationArea = document.getElementById('notificationArea');
    if (notificationArea) {
        notificationArea.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}