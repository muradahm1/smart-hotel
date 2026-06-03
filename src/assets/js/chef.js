// Chef Dashboard functionality
let orders = [];
let audioContext;
let audioEnabled = false;

document.addEventListener('DOMContentLoaded', function() {
    // Initialize audio permission system
    const audioOverlay = document.getElementById('audio-permission-overlay');
    const enableBtn = document.getElementById('enableAudioBtn');
    const skipBtn = document.getElementById('skipAudioBtn');
    
    // Check if user has already made a choice
    const audioChoice = localStorage.getItem('chefAudioEnabled');
    if (audioChoice === 'true') {
        audioOverlay.style.display = 'none';
        initAudio();
    } else if (audioChoice === 'false') {
        audioOverlay.style.display = 'none';
    } else {
        audioOverlay.style.display = 'flex';
    }
    
    enableBtn.addEventListener('click', function() {
        localStorage.setItem('chefAudioEnabled', 'true');
        audioOverlay.style.display = 'none';
        initAudio();
    });
    
    skipBtn.addEventListener('click', function() {
        localStorage.setItem('chefAudioEnabled', 'false');
        audioOverlay.style.display = 'none';
    });

    setTimeout(() => {
        loadChefOrders();
        listenForOrderUpdates();
        // Fallback polling every 30 seconds (optimized for data usage)
        setInterval(() => {
            console.log('🔄 Polling for updates...');
            loadChefOrders();
        }, 30000);
    }, 500);
});

// Function to initialize the AudioContext after user interaction
function initAudio() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        audioEnabled = true;
        console.log('Audio context initialized for Chef');
    } catch (e) {
        console.error('Web Audio API not supported', e);
    }
}

function playNotificationSound() {
    if (!audioEnabled || !audioContext) return;
    
    // Resume context if suspended (browser policy)
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Urgent "Double Beep" for Kitchen
    oscillator.type = 'square'; // Sharper sound to cut through kitchen noise
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // High pitch
    oscillator.frequency.setValueAtTime(0, audioContext.currentTime + 0.1); // Silence
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime + 0.15); // Second beep
    
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.3);
    gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.35);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.4);
}

async function loadChefOrders() {
    if (!window.supabaseClient) {
        console.log('Database configuration missing');
        showConnectionError();
        return;
    }
    
    try {
        // Only load orders from today for security
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Load orders with their items (no pricing data)
        const { data: ordersData, error: ordersError } = await window.supabaseClient
            .from('orders')
            .select('id, table_number, customer_name, status, created_at, updated_at, location_info, order_source, notes')
            .in('status', ['pending', 'preparing', 'ready'])
            .gte('created_at', today.toISOString())
            .order('created_at', { ascending: true });
            
        if (ordersError) throw ordersError;
        
        // Load order items for each order
        const ordersWithItems = await Promise.all(
            (ordersData || []).map(async (order) => {
                const { data: itemsData, error: itemsError } = await window.supabaseClient
                    .from('order_items')
                    .select(`
                        quantity,
                        price,
                        menu_items(name)
                    `)
                    .eq('order_id', order.id);
                    
                if (itemsError) {
                    console.error('Error loading items for order:', order.id, itemsError);
                    return { ...order, items: [] };
                }
                
                // Format items for display
                const formattedItems = (itemsData || []).map(item => ({
                    name: item.menu_items?.name || 'Unknown Item',
                    quantity: item.quantity,
                    price: item.price
                }));
                
                return { ...order, items: formattedItems };
            })
        );
        
        orders = ordersWithItems;
        renderChefOrders(orders);
        updateChefStats(orders);
    } catch (error) {
        console.error('Error loading orders:', error);
        document.getElementById('chefOrdersGrid').innerHTML = '<div class="empty-state">Failed to load orders: ' + error.message + '</div>';
    }
}

function showConnectionError() {
    document.getElementById('chefOrdersGrid').innerHTML = `
        <div class="empty-state">
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Database Connection Error</h3>
            <p>Unable to connect to the database. Please check configuration.</p>
        </div>
    `;
}

function renderChefOrders(orders) {
    const ordersGrid = document.getElementById('chefOrdersGrid');
    
    if (orders.length === 0) {
        ordersGrid.innerHTML = '<div class="empty-state">No active orders</div>';
        return;
    }

    ordersGrid.innerHTML = orders.map(order => `
        <div class="chef-order-card ${order.status}">
            <div class="order-header">
                <div class="order-info">
                    <h3>${order.location_info || `Table ${order.table_number}`}</h3>
                    <p class="customer-name">${order.customer_name || 'Guest'}</p>
                    <p class="order-time">${formatTime(order.created_at)}</p>
                </div>
                <span class="order-status-badge status-${order.status}">${order.status.toUpperCase()}</span>
            </div>
            
            <div class="order-items">
                ${order.items && Array.isArray(order.items) ? 
                    order.items.map(item => `
                        <div class="order-item">
                            <span class="item-quantity">${item.quantity || 1}x</span>
                            <span class="item-name">${item.name || 'Unknown Item'}</span>
                            <span class="item-price">${formatCurrency((item.price || 0) * (item.quantity || 1))}</span>
                        </div>
                    `).join('') : 
                    '<div class="order-item"><span class="item-name">No items found</span></div>'
                }
                ${order.notes ? `
                    <div class="order-special-requirements" style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed rgba(255,255,255,0.2); color: #ff9f43;">
                        <i class="fas fa-comment-dots" style="margin-right: 5px;"></i>
                        <strong>Note:</strong> ${order.notes}
                    </div>
                ` : ''}
            </div>
            
            <div class="order-actions">
                ${order.status === 'pending' ? `
                    <button class="btn btn-primary" onclick="updateOrderStatus('${order.id}', 'preparing')">
                        <i class="fas fa-play"></i> Start Cooking
                    </button>
                ` : ''}
                ${order.status === 'preparing' ? `
                    <button class="btn btn-success" onclick="updateOrderStatus('${order.id}', 'ready')">
                        <i class="fas fa-check"></i> Mark Ready
                    </button>
                ` : ''}
                ${order.status === 'ready' ? `
                    <div class="ready-indicator">
                        <i class="fas fa-bell"></i> Ready for Pickup
                    </div>
                ` : ''}
            </div>
        </div>
    `).join('');
}

function updateChefStats(orders) {
    const pending = orders.filter(order => order.status === 'pending').length;
    const preparing = orders.filter(order => order.status === 'preparing').length;
    
    loadCompletedCount();
    
    document.getElementById('pendingOrders').textContent = pending;
    document.getElementById('preparingOrders').textContent = preparing;
}

async function loadCompletedCount() {
    try {
        const { data, error } = await window.supabaseClient
            .from('orders')
            .select('*')
            .eq('status', 'completed');
            
        if (error) throw error;
        document.getElementById('completedOrders').textContent = data.length;
    } catch (error) {
        console.error('Error loading completed orders count:', error);
    }
}

async function updateOrderStatus(orderId, newStatus) {
    try {
        const { error } = await window.supabaseClient
            .from('orders')
            .update({ 
                status: newStatus,
                updated_at: new Date().toISOString()
            })
            .eq('id', orderId);
            
        if (error) throw error;
        
        showNotification(`Order ${newStatus === 'preparing' ? 'started cooking' : 'marked as ready'}`, 'success');
        
        loadChefOrders();
        
    } catch (error) {
        console.error('Error updating order status:', error);
        showNotification('Failed to update order status', 'error');
    }
}

function listenForOrderUpdates() {
    if (!window.supabaseClient) {
        console.error('Supabase not available for real-time updates');
        return;
    }

    console.log('Setting up real-time subscription for chef...');
    
    const channel = window.supabaseClient
        .channel('chef-orders-realtime')
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'orders'
        }, (payload) => {
            console.log('🔥 Chef - Real-time update:', payload);
            
            if (payload.eventType === 'INSERT' && payload.new.status === 'pending') {
                console.log('🆕 New order detected!');
                showNotification(`New order from ${payload.new.location_info || `Table ${payload.new.table_number}`}`, 'info');
                playNotificationSound();
            }
            
            // Always reload orders on any change
            loadChefOrders();
        })
        .subscribe((status, err) => {
            console.log('Chef subscription status:', status);
            if (err) console.error('Chef subscription error:', err);
        });
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
}

function formatCurrency(amount) {
    return (amount || 0).toFixed(2);
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification-toast ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'exclamation' : 'info'}-circle"></i>
        <p>${message}</p>
    `;
    
    document.getElementById('notificationArea').appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 5000);
}