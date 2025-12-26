// Order page functionality
document.addEventListener('DOMContentLoaded', function() {
    loadOrderItems();
    updateCartCount();
    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('placeOrderBtn').addEventListener('click', placeOrder);
    
    // Payment method change listener
    document.querySelectorAll('input[name="paymentMethod"]').forEach(radio => {
        radio.addEventListener('change', handlePaymentMethodChange);
    });
}

function handlePaymentMethodChange() {
    const selectedMethod = document.querySelector('input[name="paymentMethod"]:checked').value;
    const paymentDetails = document.getElementById('paymentDetails');
    const accountNumber = document.getElementById('accountNumber');
    const paymentInstructions = document.getElementById('paymentInstructions');
    const paymentAmount = document.getElementById('paymentAmount');
    
    // Calculate total
    const cart = getCart();
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = subtotal * 0.1;
    const total = subtotal + tax;
    paymentAmount.textContent = formatCurrency(total);
    
    if (selectedMethod === 'cash') {
        paymentDetails.style.display = 'none';
    } else {
        paymentDetails.style.display = 'block';
        
        switch (selectedMethod) {
            case 'telebirr':
                accountNumber.textContent = '+251-911-234-567';
                paymentInstructions.textContent = 'Send money to the above Telebirr number. Use your order number as reference.';
                break;
            case 'cbe':
                accountNumber.textContent = '+251-912-345-678';
                paymentInstructions.textContent = 'Send money to the above CBE Birr number. Use your table number as reference.';
                break;
            case 'bank':
                accountNumber.textContent = '1000123456789 (CBE)';
                paymentInstructions.textContent = 'Transfer to the above bank account. Use your name and table number as reference.';
                break;
        }
    }
}

function loadOrderItems() {
    const cart = getCart();
    const orderItemsContainer = document.getElementById('orderItems');
    const orderSummaryContainer = document.getElementById('orderSummary');
    
    // Auto-fill table number only if came from QR/NFC scan
    const storedTable = localStorage.getItem('ramzTableId');
    const fromQR = localStorage.getItem('ramzFromQR');
    const locationData = localStorage.getItem('currentLocation');
    const tableInput = document.getElementById('tableNumber');
    
    // Handle Room vs Table UI based on saved location
    if (locationData) {
        try {
            const location = JSON.parse(locationData);
            if (location.type === 'room') {
                const label = document.querySelector('label[for="tableNumber"]');
                if (label) {
                    label.textContent = 'Room Number:';
                    label.removeAttribute('data-translate');
                }
                if (tableInput) {
                    tableInput.placeholder = 'Enter room number';
                    tableInput.removeAttribute('data-translate-placeholder');
                }
            }
        } catch (e) {
            console.error('Error parsing location data:', e);
        }
    }

    if (storedTable && fromQR === 'true' && tableInput) {
        tableInput.value = storedTable;
        tableInput.readOnly = true;
        tableInput.style.backgroundColor = '#2a2a2a';
        tableInput.style.color = '#c9b48c';
        tableInput.style.border = '2px solid #c9b48c';
        
        // Add a clear button for QR scanned tables
        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'btn btn-secondary';
        clearBtn.style.marginLeft = '10px';
        clearBtn.innerHTML = `<i class="fas fa-times"></i> ${translate('clear_button')}`;
        clearBtn.onclick = clearTableNumber;
        tableInput.parentNode.appendChild(clearBtn);
    }

    if (cart.length === 0) {
        orderItemsContainer.innerHTML = `
            <div class="empty-order">
                <h3 data-translate="order_cart_empty">${translate('order_cart_empty')}</h3>
                <p data-translate="order_cart_empty_prompt">${translate('order_cart_empty_prompt')}</p>
                <a href="menu.html" class="btn btn-primary" data-translate="order_browse_menu">${translate('order_browse_menu')}</a>
            </div>
        `;
        orderSummaryContainer.innerHTML = '';
        return;
    }

    // Render order items
    orderItemsContainer.innerHTML = cart.map(item => `
        <div class="order-item">
            <div class="order-item-info">
                <h4 class="order-item-name">${item.name}</h4>
                <p class="order-item-price">${formatCurrency(item.price)}</p>
            </div>
            <div class="order-item-controls">
                <button class="quantity-btn" onclick="updateQuantity('${item.id}', ${item.quantity - 1})">-</button>
                <span class="quantity">${item.quantity}</span>
                <button class="quantity-btn" onclick="updateQuantity('${item.id}', ${item.quantity + 1})">+</button>
                <button class="remove-btn" onclick="removeFromCart('${item.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');

    // Calculate and render summary
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = subtotal * 0.1; // 10% tax
    const total = subtotal + tax;

    orderSummaryContainer.innerHTML = `
        <h3 data-translate="order_summary_title">${translate('order_summary_title')}</h3>
        <div class="summary-row">
            <span data-translate="order_summary_subtotal">${translate('order_summary_subtotal')}</span>
            <span>${formatCurrency(subtotal)}</span>
        </div>
        <div class="summary-row">
            <span data-translate="order_summary_tax">${translate('order_summary_tax')}</span>
            <span>${formatCurrency(tax)}</span>
        </div>
        <div class="summary-row total">
            <span data-translate="order_summary_total">${translate('order_summary_total')}</span>
            <span>${formatCurrency(total)}</span>
        </div>
    `;
}

function updateQuantity(itemId, newQuantity) {
    if (newQuantity <= 0) {
        removeFromCart(itemId);
        return;
    }

    const cart = getCart();
    const item = cart.find(i => i.id === itemId);
    if (item) {
        item.quantity = newQuantity;
        saveCart(cart);
        loadOrderItems();
        updateCartCount();
    }
}

function removeFromCart(itemId) {
    const cart = getCart();
    const updatedCart = cart.filter(item => item.id !== itemId);
    saveCart(updatedCart);
    loadOrderItems();
    updateCartCount();
}

// Rate limiting for order submissions
let lastOrderTime = 0;
const ORDER_COOLDOWN = 30000; // 30 seconds

// Enhanced input validation functions
function validateTableNumber(tableNumber) {
    const num = parseInt(tableNumber);
    return Number.isInteger(num) && num >= 1 && num <= 10000; // Increased limit for rooms
}

function validateCustomerName(name) {
    if (!name || typeof name !== 'string') return false;
    const trimmed = name.trim();
    return trimmed.length >= 2 && 
           trimmed.length <= 50 && 
           /^[a-zA-Z\s\u00C0-\u017F\u1E00-\u1EFF]+$/.test(trimmed); // Support international characters
}

function validatePhoneNumber(phone) {
    if (!phone || typeof phone !== 'string') return false;
    const cleaned = phone.replace(/[\s\-()]/g, '');
    return /^[+]?[0-9]{10,15}$/.test(cleaned);
}

function validateOrderNotes(notes) {
    if (!notes) return true; // Notes are optional
    return typeof notes === 'string' && notes.length <= 500;
}

function validatePaymentMethod(method) {
    const allowedMethods = ['telebirr', 'cbe', 'bank'];
    return allowedMethods.includes(method);
}

function validateCartItem(item) {
    return item && 
           typeof item.id === 'string' && 
           typeof item.name === 'string' && 
           typeof item.price === 'number' && 
           typeof item.quantity === 'number' &&
           item.id.length > 0 &&
           item.name.length > 0 &&
           item.price > 0 &&
           item.quantity > 0 &&
           item.quantity <= 99; // Reasonable quantity limit
}

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

async function placeOrder() {
    // Rate limiting check
    const now = Date.now();
    if (now - lastOrderTime < ORDER_COOLDOWN) {
        const remainingTime = Math.ceil((ORDER_COOLDOWN - (now - lastOrderTime)) / 1000);
        alert(translate('alert_wait_for_order').replace('{seconds}', remainingTime));
        return;
    }

    const cart = getCart();
    if (cart.length === 0) {
        alert(translate('alert_cart_empty'));
        return;
    }

    const tableNumber = document.getElementById('tableNumber').value;
    const customerName = document.getElementById('customerName').value;
    const customerPhone = document.getElementById('customerPhone').value;
    const orderNotes = document.getElementById('orderNotes').value;
    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value;

    // Enhanced input validation
    if (!validateTableNumber(tableNumber)) {
        alert(translate('alert_invalid_table'));
        return;
    }
    if (!validateCustomerName(customerName)) {
        alert(translate('alert_invalid_name'));
        return;
    }
    if (!validatePhoneNumber(customerPhone)) {
        alert(translate('alert_invalid_phone'));
        return;
    }
    if (!validateOrderNotes(orderNotes)) {
        alert('Order notes are too long (maximum 500 characters)');
        return;
    }
    if (!paymentMethod || !validatePaymentMethod(paymentMethod)) {
        alert(translate('alert_select_payment'));
        return;
    }
    
    // Validate cart items thoroughly
    if (!cart.every(validateCartItem)) {
        alert(translate('alert_invalid_cart_items'));
        return;
    }
    
    // Additional security checks
    if (cart.length === 0 || cart.length > 50) {
        alert('Invalid cart size');
        return;
    }

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = subtotal * 0.1;
    const total = subtotal + tax;

    // Sanitize inputs and show confirmation modal
    showOrderConfirmation({
        tableNumber: parseInt(tableNumber),
        customerName: sanitizeInput(customerName.trim()),
        customerPhone: sanitizeInput(customerPhone.trim()),
        orderNotes: sanitizeInput(orderNotes.trim()),
        cart,
        total,
        paymentMethod
    });
    
    lastOrderTime = now;
}

function showOrderConfirmation(orderData) {
    const modal = document.createElement('div');
    modal.className = 'order-confirmation-modal';
    
    // Create modal structure using DOM methods for security
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    
    const card = document.createElement('div');
    card.className = 'confirmation-card';
    
    // Header
    const header = document.createElement('div');
    header.className = 'card-header';
    
    const title = document.createElement('h2');
    title.setAttribute('data-translate', 'order_confirmation_title');
    
    const icon = document.createElement('i');
    icon.className = 'fas fa-receipt';
    
    title.appendChild(icon);
    title.appendChild(document.createTextNode(' ' + translate('order_confirmation_title')));
    header.appendChild(title);
    
    // Content
    const content = document.createElement('div');
    content.className = 'card-content';
    
    // Order details
    const details = document.createElement('div');
    details.className = 'order-details';
    
    // Table row
    const tableRow = createDetailRow(translate('confirm_table'), orderData.tableNumber.toString());
    details.appendChild(tableRow);
    
    // Customer row
    const customerRow = createDetailRow(translate('confirm_customer'), orderData.customerName);
    details.appendChild(customerRow);
    
    // Phone row
    const phoneRow = createDetailRow(translate('confirm_phone'), orderData.customerPhone);
    details.appendChild(phoneRow);
    
    content.appendChild(details);
    
    // Order items preview
    const itemsPreview = document.createElement('div');
    itemsPreview.className = 'order-items-preview';
    
    const itemsTitle = document.createElement('h3');
    itemsTitle.textContent = translate('confirm_order_items');
    itemsPreview.appendChild(itemsTitle);
    
    orderData.cart.forEach(item => {
        const itemRow = document.createElement('div');
        itemRow.className = 'item-row';
        
        const itemName = document.createElement('span');
        itemName.className = 'item-name';
        itemName.textContent = `${item.quantity}x ${item.name}`;
        
        const itemPrice = document.createElement('span');
        itemPrice.className = 'item-price';
        itemPrice.textContent = formatCurrency(item.price * item.quantity);
        
        itemRow.appendChild(itemName);
        itemRow.appendChild(itemPrice);
        itemsPreview.appendChild(itemRow);
    });
    
    content.appendChild(itemsPreview);
    
    // Special notes if any
    if (orderData.orderNotes && orderData.orderNotes.trim()) {
        const notesSection = document.createElement('div');
        notesSection.className = 'special-notes';
        
        const notesTitle = document.createElement('h3');
        notesTitle.textContent = translate('confirm_special_notes');
        
        const notesText = document.createElement('p');
        notesText.textContent = orderData.orderNotes;
        
        notesSection.appendChild(notesTitle);
        notesSection.appendChild(notesText);
        content.appendChild(notesSection);
    }
    
    // Total amount
    const totalAmount = document.createElement('div');
    totalAmount.className = 'total-amount';
    
    const totalText = document.createElement('strong');
    totalText.textContent = `${translate('confirm_total')} ${formatCurrency(orderData.total)}`;
    totalAmount.appendChild(totalText);
    
    content.appendChild(totalAmount);
    
    // Actions
    const actions = document.createElement('div');
    actions.className = 'card-actions';
    
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = translate('confirm_cancel');
    cancelBtn.addEventListener('click', closeConfirmationModal);
    
    const submitBtn = document.createElement('button');
    submitBtn.className = 'btn btn-primary';
    submitBtn.textContent = translate('confirm_submit');
    submitBtn.addEventListener('click', submitConfirmedOrder);
    
    actions.appendChild(cancelBtn);
    actions.appendChild(submitBtn);
    
    // Assemble modal
    card.appendChild(header);
    card.appendChild(content);
    card.appendChild(actions);
    
    overlay.appendChild(card);
    modal.appendChild(overlay);
    
    document.body.appendChild(modal);
    
    // Store order data for submission
    window.pendingOrderData = orderData;
}

function createDetailRow(label, value) {
    const row = document.createElement('div');
    row.className = 'detail-row';
    
    const labelSpan = document.createElement('span');
    labelSpan.className = 'label';
    labelSpan.textContent = label;
    
    const valueSpan = document.createElement('span');
    valueSpan.className = 'value';
    valueSpan.textContent = value;
    
    row.appendChild(labelSpan);
    row.appendChild(valueSpan);
    
    return row;
}

function closeConfirmationModal() {
    const modal = document.querySelector('.order-confirmation-modal');
    if (modal) modal.remove();
    delete window.pendingOrderData;
}

async function submitConfirmedOrder() {
    const orderData = window.pendingOrderData;
    if (!orderData) return;

    closeConfirmationModal();

    try {
        // Wait for Supabase client to be ready
        let attempts = 0;
        while (!window.supabaseClient && attempts < 20) {
            await new Promise(resolve => setTimeout(resolve, 200));
            attempts++;
        }

        if (!window.supabaseClient) {
            throw new Error('Database connection not available');
        }
        // Get location info from localStorage
        const locationInfo = JSON.parse(localStorage.getItem('currentLocation') || '{}');
        const fromQR = localStorage.getItem('ramzFromQR') === 'true';
        
        // Create order
        const { data: order, error: orderError } = await window.supabaseClient
            .from('orders')
            .insert([{
                table_number: parseInt(orderData.tableNumber),
                customer_name: orderData.customerName,
                customer_phone: orderData.customerPhone,
                total_amount: orderData.total,
                notes: orderData.orderNotes,
                status: 'pending',
                location_type: locationInfo.type || 'table',
                location_floor: locationInfo.floor || '1',
                location_info: locationInfo.location || `Table ${orderData.tableNumber}`,
                order_source: fromQR ? 'qr_scan' : 'manual_entry'
            }])
            .select()
            .single();

        if (orderError) throw orderError;

        // Create order items
        const orderItems = orderData.cart.map(item => ({
            order_id: order.id,
            menu_item_id: item.id,
            quantity: item.quantity,
            price: item.price
        }));

        const { error: itemsError } = await window.supabaseClient
            .from('order_items')
            .insert(orderItems);

        if (itemsError) throw itemsError;

        // Clear cart and show success
        localStorage.removeItem('restaurant_cart');
        showOrderSuccess(order.id, orderData.tableNumber);
        
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 3000);

    } catch (error) {
        console.error('Error placing order:', error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint
        });
        const errorMessage = error.message || translate('unknown_error');
        const alertMessage = `${translate('order_failed')}: ${errorMessage}. ${translate('alert_order_failed').split('. ')[1]}`;
        alert(alertMessage);
    }
}

// Utility functions
function getCart() {
    return JSON.parse(localStorage.getItem('restaurant_cart')) || [];
}

function saveCart(cart) {
    localStorage.setItem('restaurant_cart', JSON.stringify(cart));
}

function updateCartCount() {
    const cart = getCart();
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const cartCountElements = document.querySelectorAll('.cart-count');
    
    cartCountElements.forEach(element => {
        element.textContent = totalItems;
    });
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

function clearTableNumber() {
    localStorage.removeItem('ramzTableId');
    localStorage.removeItem('ramzFromQR');
    const tableInput = document.getElementById('tableNumber');
    if (tableInput) {
        tableInput.value = '';
        tableInput.readOnly = false;
        tableInput.style.backgroundColor = '';
        tableInput.style.color = '';
        tableInput.style.border = '';
        tableInput.placeholder = 'Enter table number';
    }
    // Remove clear button
    const clearBtn = tableInput.parentNode.querySelector('.btn-secondary');
    if (clearBtn) clearBtn.remove();
}

function showOrderSuccess(orderId, tableNumber) {
    const successModal = document.createElement('div');
    successModal.innerHTML = `
        <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 9999; display: flex; align-items: center; justify-content: center;">
            <div style="background: var(--background-light); padding: 2rem; border-radius: var(--border-radius); text-align: center; border: 2px solid var(--accent-gold);">
                <i class="fas fa-check-circle" style="font-size: 3rem; color: var(--accent-gold); margin-bottom: 1rem;"></i>
                <h2 style="color: var(--accent-gold); margin-bottom: 1rem;">${translate('order_success_header')}</h2>
                <p style="margin-bottom: 0.5rem;">${translate('order_success_id')} <strong>${orderId.substring(0, 8)}</strong></p>
                <p style="margin-bottom: 1rem;">${translate('order_success_table')} <strong>${tableNumber}</strong></p>
                <p style="color: var(--text-secondary);">${translate('order_success_redirect')}</p>
            </div>
        </div>
    `;
    document.body.appendChild(successModal);
}