// Admin Dashboard functionality
document.addEventListener('DOMContentLoaded', function() {
    // Wait a bit for supabase to initialize
    setTimeout(() => {
        loadMenuItems();
        loadOrders();
        listenForNewOrders();
        setupEventListeners();
        initializeAdminNavigation();
    }, 500);
});

// Initialize admin navigation
function initializeAdminNavigation() {
    showSection('orders');
    
    // Add click event listeners to navigation buttons
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const onclick = this.getAttribute('onclick');
            if (onclick) {
                // Extract section name from onclick attribute
                const match = onclick.match(/showSection\('([^']+)'\)/);
                if (match) {
                    showSection(match[1]);
                }
            }
        });
    });
    
    // Dynamically add Shifts button if it doesn't exist
    const navContainer = document.querySelector('.admin-nav');
    if (navContainer && !document.querySelector('[onclick="showSection(\'shifts\')"]')) {
        const btn = document.createElement('button');
        btn.className = 'nav-btn';
        btn.setAttribute('onclick', "showSection('shifts')");
        btn.textContent = 'Shifts';
        navContainer.appendChild(btn);
    }
}

// Make showSection globally available
window.showSection = showSection;

function setupEventListeners() {
    // Menu item form
    document.getElementById('showAddItemForm').addEventListener('click', showAddItemForm);
    document.getElementById('cancelEdit').addEventListener('click', hideAddItemForm);
    document.getElementById('menuItemForm').addEventListener('submit', saveMenuItem);
    
    // Image handling
    document.getElementById('itemImagePreset').addEventListener('change', function() {
        if (this.value) {
            document.getElementById('itemImageUrl').value = this.value;
        }
    });
}

// Admin Navigation Functions
function showSection(sectionName) {
    // Hide all sections
    const sections = ['ordersSection', 'analyticsSection', 'advancedSection', 'menuSection', 'shiftsSection', 'inventorySection', 'profitReportSection'];
    sections.forEach(section => {
        const element = document.getElementById(section);
        if (element) {
            element.style.display = 'none';
        }
    });
    
    // Remove active class from all nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    
    // Show selected section and activate button
    if (sectionName === 'orders') {
        const ordersSection = document.getElementById('ordersSection');
        if (ordersSection) {
            ordersSection.style.display = 'block';
        }
        const ordersBtn = document.querySelector('[onclick="showSection(\'orders\')"]');
        if (ordersBtn) {
            ordersBtn.classList.add('active');
        }
    } else if (sectionName === 'analytics') {
        const analyticsSection = document.getElementById('analyticsSection');
        if (analyticsSection) {
            analyticsSection.style.display = 'block';
        }
        const analyticsBtn = document.querySelector('[onclick="showSection(\'analytics\')"]');
        if (analyticsBtn) {
            analyticsBtn.classList.add('active');
        }
        // Reload analytics data when section is shown
        setTimeout(() => {
            if (typeof loadReportsData === 'function') {
                loadReportsData();
            }
        }, 100);
    } else if (sectionName === 'advanced') {
        const advancedSection = document.getElementById('advancedSection');
        if (advancedSection) {
            advancedSection.style.display = 'block';
        }
        const advancedBtn = document.querySelector('[onclick="showSection(\'advanced\')"]');
        if (advancedBtn) {
            advancedBtn.classList.add('active');
        }
        // Load advanced analytics data
        setTimeout(() => {
            if (typeof loadAdvancedAnalytics === 'function') {
                loadAdvancedAnalytics();
            }
        }, 100);
    } else if (sectionName === 'menu') {
        const menuSection = document.getElementById('menuSection');
        if (menuSection) {
            menuSection.style.display = 'block';
        }
        const menuBtn = document.querySelector('[onclick="showSection(\'menu\')"]');
        if (menuBtn) {
            menuBtn.classList.add('active');
        }
    } else if (sectionName === 'inventory') {
        const inventorySection = document.getElementById('inventorySection');
        if (inventorySection) {
            inventorySection.style.display = 'block';
        }
        const invBtn = document.querySelector('[onclick="showSection(\'inventory\')"]');
        if (invBtn) {
            invBtn.classList.add('active');
        }
        loadInventoryDashboard();
    } else if (sectionName === 'profitReport') {
        const section = document.getElementById('profitReportSection');
        if (section) section.style.display = 'block';
        const btn = document.querySelector('[onclick="showSection(\'profitReport\')"]');
        if (btn) btn.classList.add('active');
        if (window.ProfitReport) ProfitReport.load();
    } else if (sectionName === 'shifts') {
        let shiftsSection = document.getElementById('shiftsSection');
        if (!shiftsSection) {
            createShiftsSection();
            shiftsSection = document.getElementById('shiftsSection');
        }
        if (shiftsSection) {
            shiftsSection.style.display = 'block';
            const shiftsBtn = document.querySelector('[onclick="showSection(\'shifts\')"]');
            if (shiftsBtn) shiftsBtn.classList.add('active');
            loadShifts();
        }
    }
}

async function loadOrders() {
    if (!window.supabaseClient) {
        document.getElementById('ordersGrid').innerHTML = '<div class="empty-state">Database connection failed</div>';
        return;
    }
    
    try {
        // Fetch orders, order items, and menu items
        const [ordersResult, orderItemsResult, menuItemsResult] = await Promise.all([
            window.supabaseClient
                .from('orders')
                .select('*')
                .order('created_at', { ascending: false }),
            window.supabaseClient
                .from('order_items')
                .select('*'),
            window.supabaseClient
                .from('menu_items')
                .select('*')
        ]);
        
        if (ordersResult.error) throw ordersResult.error;
        if (orderItemsResult.error) throw orderItemsResult.error;
        if (menuItemsResult.error) throw menuItemsResult.error;
        
        const orders = ordersResult.data || [];
        const orderItems = orderItemsResult.data || [];
        const menuItems = menuItemsResult.data || [];
        
        // Create menu items lookup
        const menuLookup = {};
        menuItems.forEach(item => {
            menuLookup[item.id] = item;
        });
        
        // Join orders with their items and menu details
        const ordersWithItems = orders.map(order => {
            const items = orderItems
                .filter(item => item.order_id === order.id)
                .map(item => {
                    const menuItem = menuLookup[item.menu_item_id];
                    return {
                        ...item,
                        name: menuItem ? menuItem.name : 'Unknown Item',
                        price: item.price || (menuItem ? menuItem.price : 0)
                    };
                });
            return { ...order, items };
        });
        
        renderOrders(ordersWithItems);
        updateOrderStats(ordersWithItems);
    } catch (error) {
        console.error('Error loading orders:', error);
        document.getElementById('ordersGrid').innerHTML = '<div class="empty-state">Failed to load orders: ' + error.message + '</div>';
    }
}

function renderOrders(orders) {
    const ordersGrid = document.getElementById('ordersGrid');
    
    if (orders.length === 0) {
        ordersGrid.innerHTML = '<div class="empty-state">No orders yet</div>';
        return;
    }

    ordersGrid.innerHTML = orders.map(order => `
        <div class="order-card">
            <div class="order-card-header">
                <div class="order-info">
                    <span class="order-table">Table ${order.table_number}</span>
                    <small>${order.customer_name || 'Guest'} - ${order.customer_phone || 'N/A'}</small>
                </div>
                <span class="order-status status-${order.status}">${order.status}</span>
            </div>
            
            <div class="order-items-list">
                ${order.items && Array.isArray(order.items) ? 
                    order.items.map(item => `
                        <div class="order-item-row">
                            <span>${item.quantity || 1}x ${item.name || 'Unknown Item'}</span>
                            <span>${formatCurrency((item.price || 0) * (item.quantity || 1))}</span>
                        </div>
                    `).join('') : 
                    '<div class="order-item-row"><span>No items found</span></div>'
                }
            </div>
            
            ${order.notes ? `
                <div class="order-notes" style="margin: 10px 0; padding: 8px; background: rgba(201, 180, 140, 0.1); border-left: 3px solid var(--accent-gold); font-size: 0.9em;">
                    <i class="fas fa-comment-alt" style="color: var(--accent-gold); margin-right: 5px;"></i>
                    <strong>Note:</strong> ${order.notes}
                </div>
            ` : ''}
            
            <div class="order-summary-row">
                <strong>Total: ${formatCurrency(order.total_amount)}</strong>
            </div>
            
            <div class="order-actions">
                ${order.status === 'pending' ? `
                    <button class="btn btn-primary" onclick="updateOrderStatus('${order.id}', 'preparing')">
                        <i class="fas fa-play"></i> Start Preparing
                    </button>
                ` : ''}
                <button class="btn btn-outline" onclick="printOrderReceipt('${order.id}')">
                    <i class="fas fa-print"></i> Print Receipt
                </button>
                ${order.status === 'pending' ? `
                        <i class="fas fa-play"></i> Start Preparing
                    </button>
                ` : ''}
                ${order.status === 'preparing' ? `
                    <button class="btn btn-success" onclick="updateOrderStatus('${order.id}', 'ready')">
                        <i class="fas fa-check"></i> Mark Ready
                    </button>
                ` : ''}
                ${order.status === 'ready' ? `
                    <button class="btn btn-secondary" onclick="updateOrderStatus('${order.id}', 'completed')">
                        <i class="fas fa-utensils"></i> Mark Served
                    </button>
                ` : ''}
                ${order.status !== 'completed' ? `
                    <button class="btn btn-danger" onclick="deleteOrder('${order.id}')">
                        <i class="fas fa-trash"></i> Cancel
                    </button>
                ` : ''}
            </div>
        </div>
    `).join('');
}

function updateOrderStats(orders) {
    const pending = orders.filter(order => order.status === 'pending').length;
    const preparing = orders.filter(order => order.status === 'preparing').length;
    
    // Calculate average serve time
    const completedOrders = orders.filter(order => order.status === 'completed' && order.created_at && order.updated_at);
    let avgServeTime = 0;
    if (completedOrders.length > 0) {
        const totalServeTime = completedOrders.reduce((sum, order) => {
            const created = new Date(order.created_at);
            const completed = new Date(order.updated_at);
            return sum + (completed - created);
        }, 0);
        avgServeTime = Math.round(totalServeTime / completedOrders.length / 60000); // Convert to minutes
    }
    
    document.getElementById('pendingOrders').textContent = pending;
    document.getElementById('preparingOrders').textContent = preparing;
    document.getElementById('avgServeTime').textContent = avgServeTime + ' min';
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
        
        showNotification(`Order status updated to ${newStatus}`, 'success');
        loadOrders();
        
        // Also refresh reports data if on admin page
        setTimeout(() => {
            if (typeof loadReportsData === 'function') {
                loadReportsData();
            }
        }, 100);
    } catch (error) {
        console.error('Error updating order status:', error);
        showNotification('Failed to update order status', 'error');
    }
}

async function deleteOrder(orderId) {
    if (!confirm('Are you sure you want to cancel this order?')) return;
    
    try {
        // Delete order items first
        const { error: itemsError } = await window.supabaseClient
            .from('order_items')
            .delete()
            .eq('order_id', orderId);
            
        if (itemsError) throw itemsError;
        
        // Delete the order
        const { error: orderError } = await window.supabaseClient
            .from('orders')
            .delete()
            .eq('id', orderId);
            
        if (orderError) throw orderError;
        
        showNotification('Order cancelled successfully', 'success');
        loadOrders();
    } catch (error) {
        console.error('Error deleting order:', error);
        showNotification('Failed to cancel order', 'error');
    }
}

function listenForNewOrders() {
    if (!window.supabaseClient) {
        console.error('Supabase not available for real-time updates');
        return;
    }

    console.log('Setting up real-time subscription for admin...');
    
    const channel = window.supabaseClient
        .channel('admin-orders-realtime')
        .on('postgres_changes', {
            event: '*',
            schema: 'public', 
            table: 'orders'
        }, (payload) => {
            console.log('🔥 Admin - Real-time update:', payload);
            
            if (payload.eventType === 'INSERT') {
                showNotification(`New order received for Table ${payload.new.table_number}`, 'info');
                if (typeof playNotificationSound === 'function') {
                    playNotificationSound();
                }
            } else if (payload.eventType === 'UPDATE') {
                showNotification(`Order updated for Table ${payload.new.table_number}`, 'info');
            }
            
            // Always reload orders on any change
            loadOrders();
        })
        .subscribe((status, err) => {
            console.log('Admin subscription status:', status);
            if (err) console.error('Admin subscription error:', err);
        });
}

// --- Menu Management Functions ---

async function loadMenuItems() {
    if (!window.supabaseClient) {
        document.getElementById('menuManagementGrid').innerHTML = '<div class="empty-state">Database connection failed</div>';
        return;
    }
    
    try {
        const { data, error } = await window.supabaseClient
            .from('menu_items')
            .select('*')
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        renderMenuItems(data || []);
    } catch (error) {
        console.error('Error loading menu items:', error);
        document.getElementById('menuManagementGrid').innerHTML = '<div class="empty-state">Failed to load menu items: ' + error.message + '</div>';
    }
}



function showAddItemForm() {
    document.getElementById('formTitle').textContent = 'Add New Menu Item';
    document.getElementById('menuItemId').value = '';
    document.getElementById('menuItemForm').reset();
    document.getElementById('itemIsAvailable').checked = true;
    document.getElementById('menuItemFormContainer').style.display = 'block';
}

function hideAddItemForm() {
    document.getElementById('menuItemFormContainer').style.display = 'none';
}

// Input validation and sanitization
function sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    return input.replace(/[<>"'&]/g, function(match) {
        const map = {
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#x27;',
            '&': '&amp;'
        };
        return map[match];
    });
}

function validateMenuItem(data) {
    const errors = [];
    
    if (!data.name || data.name.trim().length < 2) {
        errors.push('Name must be at least 2 characters');
    }
    if (!data.description || data.description.trim().length < 5) {
        errors.push('Description must be at least 5 characters');
    }
    if (!data.price || data.price <= 0) {
        errors.push('Price must be greater than 0');
    }
    if (!data.category || data.category.trim().length < 2) {
        errors.push('Category is required');
    }
    if (data.image_url && !isValidUrl(data.image_url)) {
        errors.push('Invalid image URL');
    }
    
    return errors;
}

function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

async function saveMenuItem(event) {
    event.preventDefault();
    
    const itemId = document.getElementById('menuItemId').value;
    const rawData = {
        name: document.getElementById('itemName').value,
        description: document.getElementById('itemDescription').value,
        price: parseFloat(document.getElementById('itemPrice').value),
        category: document.getElementById('itemCategory').value,
        image_url: document.getElementById('itemImageUrl').value,
        is_available: document.getElementById('itemIsAvailable').checked
    };
    
    // Sanitize inputs
    const itemData = {
        name: sanitizeInput(rawData.name?.trim()),
        description: sanitizeInput(rawData.description?.trim()),
        price: rawData.price,
        category: sanitizeInput(rawData.category?.trim()),
        image_url: rawData.image_url?.trim(),
        is_available: rawData.is_available
    };
    
    // Validate inputs
    const validationErrors = validateMenuItem(itemData);
    if (validationErrors.length > 0) {
        showNotification('Validation errors: ' + validationErrors.join(', '), 'error');
        return;
    }
    
    try {
        let result;
        if (itemId) {
            // Update existing item
            result = await window.supabaseClient
                .from('menu_items')
                .update(itemData)
                .eq('id', itemId);
        } else {
            // Create new item
            result = await window.supabaseClient
                .from('menu_items')
                .insert([itemData]);
        }
        
        if (result.error) throw result.error;
        
        showNotification(itemId ? 'Menu item updated successfully' : 'Menu item added successfully', 'success');
        hideAddItemForm();
        loadMenuItems();
    } catch (error) {
        console.error('Error saving menu item:', error);
        showNotification('Failed to save menu item: ' + error.message, 'error');
    }
}

async function editMenuItem(itemId) {
    try {
        const { data, error } = await window.supabaseClient
            .from('menu_items')
            .select('*')
            .eq('id', itemId)
            .single();
            
        if (error) throw error;
        
        // Populate form with existing data
        document.getElementById('formTitle').textContent = 'Edit Menu Item';
        document.getElementById('menuItemId').value = data.id;
        document.getElementById('itemName').value = data.name;
        document.getElementById('itemDescription').value = data.description;
        document.getElementById('itemPrice').value = data.price;
        document.getElementById('itemCategory').value = data.category;
        document.getElementById('itemImageUrl').value = data.image_url || '';
        document.getElementById('itemImagePreset').value = data.image_url || '';
        document.getElementById('itemIsAvailable').checked = data.is_available;
        
        document.getElementById('menuItemFormContainer').style.display = 'block';
    } catch (error) {
        console.error('Error loading menu item:', error);
        showNotification('Failed to load menu item', 'error');
    }
}

function renderMenuItems(items) {
    const grid = document.getElementById('menuManagementGrid');
    
    if (items.length === 0) {
        grid.innerHTML = '<div class="empty-state">No menu items yet</div>';
        return;
    }

    // Clear existing content
    grid.innerHTML = '';
    
    // Secure rendering using DOM methods instead of innerHTML
    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'menu-admin-card';
        
        // Validate and sanitize item ID
        const itemId = validateItemId(item.id) ? item.id : '';
        if (!itemId) {
            console.error('Invalid item ID:', item.id);
            return;
        }
        
        // Create image element
        const imageContainer = document.createElement('div');
        if (item.image_url && isValidUrl(item.image_url) && item.image_url.startsWith('http')) {
            const img = document.createElement('img');
            img.src = item.image_url;
            img.alt = sanitizeInput(item.name || '');
            img.className = 'menu-admin-image';
            img.onerror = function() { this.style.display = 'none'; };
            imageContainer.appendChild(img);
        } else {
            imageContainer.className = 'menu-admin-image';
            imageContainer.style.cssText = 'background: var(--background-dark); display: flex; align-items: center; justify-content: center;';
            const icon = document.createElement('i');
            icon.className = 'fas fa-utensils';
            icon.style.cssText = 'font-size: 2rem; color: var(--accent-gold);';
            imageContainer.appendChild(icon);
        }
        
        // Create content container
        const content = document.createElement('div');
        content.className = 'menu-admin-content';
        
        // Create title
        const title = document.createElement('h3');
        title.textContent = item.name || '';
        
        // Create description
        const description = document.createElement('p');
        description.className = 'menu-admin-description';
        description.textContent = item.description || '';
        
        // Create details container
        const details = document.createElement('div');
        details.className = 'menu-admin-details';
        
        const price = document.createElement('span');
        price.className = 'menu-admin-price';
        price.textContent = formatCurrency(item.price || 0);
        
        const category = document.createElement('span');
        category.className = 'menu-admin-category';
        category.textContent = item.category || '';
        
        const status = document.createElement('span');
        status.className = `menu-admin-status ${item.is_available ? 'available' : 'unavailable'}`;
        status.textContent = item.is_available ? 'Available' : 'Unavailable';
        
        details.appendChild(price);
        details.appendChild(category);
        details.appendChild(status);
        
        // Create actions container
        const actions = document.createElement('div');
        actions.className = 'menu-admin-actions';
        
        const editBtn = document.createElement('button');
        editBtn.className = 'btn btn-outline';
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', () => editMenuItem(itemId));
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-danger';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', () => deleteMenuItem(itemId));
        
        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);
        
        // Assemble the card
        content.appendChild(title);
        content.appendChild(description);
        content.appendChild(details);
        content.appendChild(actions);
        
        card.appendChild(imageContainer);
        card.appendChild(content);
        
        grid.appendChild(card);
    });
}

// Validate item ID to prevent injection
function validateItemId(id) {
    return id && /^[a-zA-Z0-9-_]{1,50}$/.test(id.toString());
}

async function deleteMenuItem(itemId) {
    if (!confirm('Are you sure you want to delete this menu item?')) {
        return;
    }
    
    try {
        const { error } = await window.supabaseClient
            .from('menu_items')
            .delete()
            .eq('id', itemId);
            
        if (error) throw error;
        
        showNotification('Menu item deleted successfully', 'success');
        loadMenuItems();
    } catch (error) {
        console.error('Error deleting menu item:', error);
        showNotification('Failed to delete menu item: ' + error.message, 'error');
    }
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

// --- Shift Management Functions ---

function createShiftsSection() {
    // Find a container to append the new section to (usually after ordersSection)
    const ordersSection = document.getElementById('ordersSection');
    const container = ordersSection ? ordersSection.parentNode : document.querySelector('.container');
    
    if (!container) return;
    
    const section = document.createElement('div');
    section.id = 'shiftsSection';
    section.style.display = 'none';
    section.className = 'admin-section-content';
    
    section.innerHTML = `
        <div class="section-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
            <h2 style="color: var(--accent-gold);">Staff Shifts</h2>
            <button class="btn btn-secondary" onclick="loadShifts()">
                <i class="fas fa-sync"></i> Refresh
            </button>
        </div>
        <div class="table-container" style="background: var(--background-light); padding: 1.5rem; border-radius: 12px; border: 1px solid var(--border-light);">
            <div class="table-wrapper" style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; min-width: 800px;">
                    <thead>
                        <tr>
                            <th style="text-align: left; padding: 1rem; border-bottom: 1px solid #333; color: var(--accent-gold);">Staff</th>
                            <th style="text-align: left; padding: 1rem; border-bottom: 1px solid #333; color: var(--accent-gold);">Role</th>
                            <th style="text-align: left; padding: 1rem; border-bottom: 1px solid #333; color: var(--accent-gold);">Start Time</th>
                            <th style="text-align: left; padding: 1rem; border-bottom: 1px solid #333; color: var(--accent-gold);">End Time</th>
                            <th style="text-align: left; padding: 1rem; border-bottom: 1px solid #333; color: var(--accent-gold);">Orders</th>
                            <th style="text-align: left; padding: 1rem; border-bottom: 1px solid #333; color: var(--accent-gold);">Sales</th>
                            <th style="text-align: left; padding: 1rem; border-bottom: 1px solid #333; color: var(--accent-gold);">Status</th>
                        </tr>
                    </thead>
                    <tbody id="shiftsTableBody"></tbody>
                </table>
            </div>
        </div>
    `;
    
    container.appendChild(section);
}

async function loadShifts() {
    if (!window.supabaseClient) return;
    
    const tbody = document.getElementById('shiftsTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">Loading shifts...</td></tr>';

    try {
        // 1. Get shifts
        const { data: shifts, error: shiftsError } = await window.supabaseClient
            .from('shifts')
            .select('*')
            .order('start_time', { ascending: false })
            .limit(50);

        if (shiftsError) throw shiftsError;

        if (!shifts || shifts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">No shifts recorded yet</td></tr>';
            return;
        }

        // 2. Render
        tbody.innerHTML = shifts.map(shift => {
            const start = new Date(shift.start_time).toLocaleString();
            const end = shift.end_time ? new Date(shift.end_time).toLocaleString() : '-';
            const statusColor = shift.status === 'active' ? '#4caf50' : '#9e9e9e';
            const salesDisplay = typeof formatCurrency === 'function' ? formatCurrency(shift.total_sales || 0) : (shift.total_sales || 0).toFixed(2);
            
            return `
                <tr style="border-bottom: 1px solid #333; transition: background 0.2s;">
                    <td style="padding: 1rem;">${shift.role.toUpperCase()} (ID: ...${shift.user_id.slice(-4)})</td>
                    <td style="padding: 1rem;"><span style="background: #333; padding: 4px 10px; border-radius: 12px; font-size: 0.85em;">${shift.role}</span></td>
                    <td style="padding: 1rem;">${start}</td>
                    <td style="padding: 1rem;">${end}</td>
                    <td style="padding: 1rem;">${shift.total_orders || 0}</td>
                    <td style="padding: 1rem;">${salesDisplay}</td>
                    <td style="padding: 1rem;"><span style="color: ${statusColor}; font-weight: bold; text-transform: uppercase; font-size: 0.9em;">${shift.status}</span></td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        console.error('Error loading shifts:', error);
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #ff4444; padding: 2rem;">Error: ${error.message}</td></tr>`;
    }
}