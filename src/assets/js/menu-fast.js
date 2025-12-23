// Optimized Menu Loading Script
let menuItems = [];
let filteredItems = [];
let supabaseClient = null;

// Cache menu data
const CACHE_KEY = 'menu_cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Initialize immediately when DOM loads
document.addEventListener('DOMContentLoaded', initMenu);

async function initMenu() {
    const menuGrid = document.getElementById('menuGrid');
    if (!menuGrid) return;

    // Try cache first
    const cached = getCachedMenu();
    if (cached) {
        console.log('Using cached menu data');
        menuItems = cached;
        filteredItems = [...menuItems];
        renderMenuItems();
        updateCartCount();
        return;
    }

    // Show loading
    menuGrid.innerHTML = '<div class="menu-loading"><div class="loading-spinner"></div><p>Loading...</p></div>';

    try {
        await initSupabase();
        await loadMenuItems();
        renderMenuItems();
        updateCartCount();
        setupEventListeners();
    } catch (error) {
        console.error('Menu init failed:', error);
        showErrorState();
    }
}

async function initSupabase() {
    if (supabaseClient) return;
    
    // Wait max 3 seconds for Supabase
    for (let i = 0; i < 15; i++) {
        if (window.supabase) {
            supabaseClient = window.supabase.createClient(
                'https://ozhvejzazlvsxojeoxcj.supabase.co',
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96aHZlanphemx2c3hvamVveGNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzOTkzOTEsImV4cCI6MjA3ODk3NTM5MX0.fXoNjZGYK40OFuEZKGUeNFGVjCJPU9T2acKLhcC8CEg'
            );
            return;
        }
        await new Promise(r => setTimeout(r, 200));
    }
    throw new Error('Supabase timeout');
}

async function loadMenuItems() {
    const { data, error } = await supabaseClient
        .from('menu_items')
        .select('id,name,description,price,category,image_url')
        .eq('is_available', true)
        .order('category');

    if (error) throw error;

    menuItems = data || [];
    filteredItems = [...menuItems];
    
    // Cache the data
    setCachedMenu(menuItems);
}

function getCachedMenu() {
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (!cached) return null;
        
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp > CACHE_DURATION) {
            localStorage.removeItem(CACHE_KEY);
            return null;
        }
        return data;
    } catch {
        return null;
    }
}

function setCachedMenu(data) {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
            data,
            timestamp: Date.now()
        }));
    } catch {}
}

function renderMenuItems() {
    const menuGrid = document.getElementById('menuGrid');
    if (!filteredItems.length) {
        menuGrid.innerHTML = '<div class="empty-state"><i class="fas fa-utensils"></i><h3>No items found</h3></div>';
        return;
    }

    // Use DocumentFragment for better performance
    const fragment = document.createDocumentFragment();
    
    filteredItems.forEach(item => {
        const div = document.createElement('div');
        div.className = 'menu-item';
        div.innerHTML = `
            <div class="menu-item-image">
                ${item.image_url ? `<img src="${item.image_url}" alt="${item.name}" loading="lazy">` : '<i class="fas fa-utensils"></i>'}
            </div>
            <div class="menu-item-content">
                <div class="menu-item-category">${item.category}</div>
                <div class="menu-item-header">
                    <h3>${item.name}</h3>
                    <span>$${item.price.toFixed(2)}</span>
                </div>
                <p>${item.description}</p>
                <button onclick="addToCart('${item.id}')"><i class="fas fa-plus"></i> Add to Order</button>
            </div>
        `;
        fragment.appendChild(div);
    });
    
    menuGrid.innerHTML = '';
    menuGrid.appendChild(fragment);
}

function setupEventListeners() {
    // Category filters
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.onclick = function() {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            const category = this.dataset.category;
            filteredItems = category === 'all' ? [...menuItems] : 
                menuItems.filter(item => item.category === category);
            renderMenuItems();
        };
    });

    // Search
    const search = document.getElementById('menuSearch');
    if (search) {
        search.oninput = function() {
            const term = this.value.toLowerCase();
            filteredItems = term ? menuItems.filter(item =>
                item.name.toLowerCase().includes(term) ||
                item.description.toLowerCase().includes(term)
            ) : [...menuItems];
            renderMenuItems();
        };
    }
}

function addToCart(itemId) {
    const item = menuItems.find(i => i.id === itemId);
    if (!item) return;

    const cart = JSON.parse(localStorage.getItem('restaurant_cart') || '[]');
    const existing = cart.find(c => c.id === itemId);

    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({...item, quantity: 1});
    }

    localStorage.setItem('restaurant_cart', JSON.stringify(cart));
    updateCartCount();
    
    // Quick notification
    const toast = document.createElement('div');
    toast.className = 'notification-toast success';
    toast.innerHTML = `<i class="fas fa-check"></i> Added ${item.name}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}

function updateCartCount() {
    const cart = JSON.parse(localStorage.getItem('restaurant_cart') || '[]');
    const total = cart.reduce((sum, item) => sum + item.quantity, 0);
    document.querySelectorAll('.cart-count').forEach(el => el.textContent = total);
}

function showErrorState() {
    document.getElementById('menuGrid').innerHTML = `
        <div class="empty-state">
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Connection Error</h3>
            <button onclick="location.reload()">Retry</button>
        </div>
    `;
}