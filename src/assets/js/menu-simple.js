// Simplified Menu Loading Script
console.log('Loading menu script...');

let menuItems = [];
let filteredItems = [];

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing menu...');
    initializeMenu();
    setupEventListeners();
});

async function initializeMenu() {
    const menuGrid = document.getElementById('menuGrid');
    if (!menuGrid) {
        console.error('Menu grid not found');
        return;
    }

    // Show loading state
    menuGrid.innerHTML = `
        <div class="menu-loading">
            <div class="loading-spinner"></div>
            <p>Loading menu items...</p>
        </div>
    `;

    try {
        await loadMenuItems();
        renderMenuItems();
        updateCartCount();
    } catch (error) {
        console.error('Failed to initialize menu:', error);
        showErrorState();
    }
}

async function loadMenuItems() {
    console.log('Loading menu items...');
    
    // Wait for Supabase to be available
    let attempts = 0;
    while (!window.supabaseClient && attempts < 30) {
        await new Promise(resolve => setTimeout(resolve, 200));
        attempts++;
    }

    if (!window.supabaseClient) {
        throw new Error('Database connection not available');
    }

    const { data, error } = await window.supabaseClient
        .from('menu_items')
        .select('*')
        .eq('is_available', true)
        .order('category');

    if (error) {
        console.error('Database error:', error);
        throw new Error(`Database error: ${error.message}`);
    }

    console.log('Menu data loaded:', data?.length || 0, 'items');
    menuItems = data || [];
    filteredItems = [...menuItems];
}

function renderMenuItems() {
    const menuGrid = document.getElementById('menuGrid');
    if (!menuGrid) return;

    menuGrid.innerHTML = '';

    if (filteredItems.length === 0) {
        showEmptyState();
        return;
    }

    filteredItems.forEach(item => {
        const menuItemElement = createMenuItemElement(item);
        menuGrid.appendChild(menuItemElement);
    });
}

function createMenuItemElement(item) {
    const menuItem = document.createElement('div');
    menuItem.className = 'menu-item';
    
    menuItem.innerHTML = `
        <div class="menu-item-image">
            ${item.image_url ? 
                `<img src="${item.image_url}" alt="${item.name}" loading="lazy" onerror="this.style.display='none'">` :
                `<i class="fas fa-utensils" style="font-size: 2rem; color: var(--accent-gold);"></i>`
            }
        </div>
        <div class="menu-item-content">
            <div class="menu-item-category">${item.category || ''}</div>
            <div class="menu-item-header">
                <h3 class="menu-item-name">${item.name || ''}</h3>
                <span class="menu-item-price">${(item.price || 0).toFixed(2)}</span>
            </div>
            <p class="menu-item-description">${item.description || ''}</p>
            <button class="add-to-cart" onclick="addToCart('${item.id}')">
                <i class="fas fa-plus"></i> Add to Order
            </button>
        </div>
    `;
    
    return menuItem;
}

function showEmptyState() {
    const menuGrid = document.getElementById('menuGrid');
    menuGrid.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-utensils"></i>
            <h3>No menu items available</h3>
            <p>Please check back later or contact admin</p>
        </div>
    `;
}

function showErrorState() {
    const menuGrid = document.getElementById('menuGrid');
    menuGrid.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Unable to load menu</h3>
            <p>Please check your connection and try again</p>
            <button onclick="location.reload()" class="btn btn-primary">Retry</button>
        </div>
    `;
}

function setupEventListeners() {
    // Category filters
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            const category = this.dataset.category;
            filterMenuItems(category);
        });
    });

    // Search functionality
    const searchInput = document.getElementById('menuSearch');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            searchMenuItems(searchTerm);
        });
    }
}

function filterMenuItems(category) {
    if (category === 'all') {
        filteredItems = [...menuItems];
    } else {
        filteredItems = menuItems.filter(item => 
            item.category && item.category.toLowerCase() === category.toLowerCase()
        );
    }
    renderMenuItems();
}

function searchMenuItems(searchTerm) {
    if (!searchTerm) {
        filteredItems = [...menuItems];
    } else {
        filteredItems = menuItems.filter(item =>
            item.name.toLowerCase().includes(searchTerm) ||
            item.description.toLowerCase().includes(searchTerm) ||
            item.category.toLowerCase().includes(searchTerm)
        );
    }
    renderMenuItems();
}

function addToCart(itemId) {
    const item = menuItems.find(i => i.id === itemId);
    if (!item) return;

    const cart = getCart();
    const existingItem = cart.find(cartItem => cartItem.id === itemId);

    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            ...item,
            quantity: 1
        });
    }

    saveCart(cart);
    updateCartCount();
    
    // Show notification
    showNotification(`Added ${item.name} to cart!`);
}

function getCart() {
    try {
        return JSON.parse(localStorage.getItem('restaurant_cart')) || [];
    } catch {
        return [];
    }
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

function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification-toast success';
    notification.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <p>${message}</p>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

console.log('Menu script loaded');