// Smart Restaurant System | Menu page functionality

if (typeof window.allMenuItems === 'undefined') {
    window.allMenuItems = [];
    window.filteredMenuItems = [];
}
let allMenuItems = window.allMenuItems;
let filteredMenuItems = window.filteredMenuItems;

// Utility functions
function formatCurrency(amount) {
    return (amount || 0).toFixed(2);
}

function sanitizeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function validateImageUrl(url) {
    try {
        const urlObj = new URL(url);
        return ['http:', 'https:'].includes(urlObj.protocol);
    } catch {
        return false;
    }
}

function validateItemId(id) {
    return /^[a-zA-Z0-9-_]+$/.test(id);
}

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

// Initialize menu
document.addEventListener('DOMContentLoaded', function() {
    initializeMenu();
    setupEventListeners();
});

async function initializeMenu() {
    await loadMenuItems();
    renderMenuItems();
    updateCartCount();
}

function setupEventListeners() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            const category = this.dataset.category;
            filterMenuItems(category);
        });
    });
}

async function loadMenuItems() {
    const menuGrid = document.getElementById('menuGrid');
    if (!menuGrid) return;
    
    menuGrid.innerHTML = `
        <div class="menu-loading">
            <div class="loading-spinner"></div>
            <p>Loading menu items...</p>
        </div>
    `;
    
    try {
        // Wait for Supabase
        let attempts = 0;
        while ((typeof supabase === 'undefined' || !supabase) && attempts < 30) {
            await new Promise(resolve => setTimeout(resolve, 200));
            attempts++;
        }

        if (!supabase) {
            throw new Error('Database connection failed');
        }

        console.log('Loading menu items from Supabase...');
        const { data, error } = await supabase
            .from('menu_items')
            .select('*')
            .eq('is_available', true)
            .order('category');
        
        if (error) {
            console.error('Supabase error:', error);
            throw error;
        }
        
        console.log('Menu data received:', data);
        
        allMenuItems = data || [];
        filteredMenuItems = [...allMenuItems];
        
        console.log('Menu items loaded:', allMenuItems.length);
        
    } catch (error) {
        console.error('Error loading menu:', error);
        allMenuItems = [];
        filteredMenuItems = [];
        
        menuGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Unable to load menu</h3>
                <p>Error: ${error.message}</p>
                <button onclick="location.reload()" class="btn btn-primary">Retry</button>
            </div>
        `;
    }
}

function filterMenuItems(category) {
    if (category === 'all') {
        filteredMenuItems = [...allMenuItems];
    } else {
        filteredMenuItems = allMenuItems.filter(item => 
            item.category && item.category.toLowerCase() === category.toLowerCase()
        );
    }
    renderMenuItems();
}

function renderMenuItems() {
    const menuGrid = document.getElementById('menuGrid');
    if (!menuGrid) return;
    
    menuGrid.innerHTML = '';
    
    if (filteredMenuItems.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.innerHTML = `
            <i class="fas fa-utensils"></i>
            <h3>No menu items available</h3>
            <p>Please check back later or contact admin</p>
        `;
        menuGrid.appendChild(emptyState);
        return;
    }

    filteredMenuItems.forEach((item, index) => {
        const menuItem = document.createElement('div');
        menuItem.className = 'menu-item';
        
        const imageContainer = document.createElement('div');
        imageContainer.className = 'menu-item-image';
        
        if (item.image_url && validateImageUrl(item.image_url)) {
            const img = document.createElement('img');
            img.src = item.image_url;
            img.alt = item.name || '';
            img.loading = 'lazy';
            imageContainer.appendChild(img);
        } else {
            const icon = document.createElement('i');
            icon.className = 'fas fa-utensils';
            icon.style.cssText = 'font-size: 2rem; color: var(--accent-gold);';
            imageContainer.appendChild(icon);
        }
        
        const content = document.createElement('div');
        content.className = 'menu-item-content';
        
        const category = document.createElement('div');
        category.className = 'menu-item-category';
        category.textContent = item.category || '';
        
        const header = document.createElement('div');
        header.className = 'menu-item-header';
        
        const name = document.createElement('h3');
        name.className = 'menu-item-name';
        name.textContent = item.name || '';
        
        const price = document.createElement('span');
        price.className = 'menu-item-price';
        price.textContent = formatCurrency(item.price || 0);
        
        header.appendChild(name);
        header.appendChild(price);
        
        const description = document.createElement('p');
        description.className = 'menu-item-description';
        description.textContent = item.description || '';
        
        const button = document.createElement('button');
        button.className = 'add-to-cart';
        button.innerHTML = '<i class="fas fa-plus"></i> Add to Order';
        button.addEventListener('click', () => addToCart(item.id));
        
        content.appendChild(category);
        content.appendChild(header);
        content.appendChild(description);
        content.appendChild(button);
        
        menuItem.appendChild(imageContainer);
        menuItem.appendChild(content);
        
        menuGrid.appendChild(menuItem);
    });
}

function addToCart(itemId) {
    const item = allMenuItems.find(i => i.id === itemId);
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
    
    // Show feedback
    const notification = document.createElement('div');
    notification.className = 'notification-toast success';
    notification.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <p>Added ${item.name} to cart!</p>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}