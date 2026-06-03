// Smart Restaurant System | Menu page functionality

// Cache configuration
const CACHE_KEY = 'menu_cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

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

// Cache functions
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

// Sanitize HTML to prevent XSS
function sanitizeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Validate URL for images
function validateImageUrl(url) {
    try {
        const urlObj = new URL(url);
        return ['http:', 'https:'].includes(urlObj.protocol);
    } catch {
        return false;
    }
}

// Validate item ID to prevent injection
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

// Prevent multiple initializations
if (typeof window.menuInitialized === 'undefined') {
    window.menuInitialized = true;
    
    document.addEventListener('DOMContentLoaded', function() {
        initializeMenu();
        setupEventListeners();
        initScrollToTop();
        initMobileNavigation();
        initScrollAnimations();
        displayLocationInfo();
    });
}

// Display location information if coming from QR scan
function displayLocationInfo() {
    const locationInfo = JSON.parse(localStorage.getItem('currentLocation') || '{}');
    const fromQR = localStorage.getItem('ramzFromQR') === 'true';
    
    if (fromQR && locationInfo.location) {
        // Update navigation location display
        const navLogo = document.querySelector('.nav-logo');
        if (navLogo) {
            const locationDisplay = navLogo.querySelector('.location-display') || document.createElement('p');
            locationDisplay.className = 'location-display';
            locationDisplay.style.cssText = 'font-size: 0.8em; margin: 0; color: var(--accent-gold);';
            locationDisplay.textContent = locationInfo.location;
            if (!navLogo.querySelector('.location-display')) {
                navLogo.appendChild(locationDisplay);
            }
        }
        
        // Update menu header with location info
        const menuHeader = document.querySelector('.menu-header');
        if (menuHeader) {
            const locationMessage = menuHeader.querySelector('.location-message') || document.createElement('div');
            locationMessage.className = 'location-message';
            locationMessage.style.cssText = 'background: var(--background-light); padding: 1rem; border-radius: var(--border-radius); margin-bottom: 2rem; border-left: 4px solid var(--accent-gold);';
            locationMessage.innerHTML = `
                <p style="margin: 0; color: var(--accent-gold); font-weight: 600;">
                    <i class="fas fa-map-marker-alt"></i> 
                    You are at ${locationInfo.location}
                </p>
                <p style="margin: 0.5rem 0 0 0; color: var(--text-secondary); font-size: 0.9rem;">
                    Browse our menu and place your order directly to your ${locationInfo.type}!
                </p>
            `;
            if (!menuHeader.querySelector('.location-message')) {
                menuHeader.appendChild(locationMessage);
            }
        }
    }
}

async function initializeMenu() {
    // Try cache first for instant loading
    const cached = getCachedMenu();
    if (cached) {
        console.log('✅ Using cached menu data');
        allMenuItems = cached;
        filteredMenuItems = [...allMenuItems];
        renderMenuItems();
        updateCartCount();
        return;
    }
    
    await loadMenuItems();
    renderMenuItems();
    updateCartCount();
}

function setupEventListeners() {
    // Category filter buttons
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Update active state
            filterButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            // Clear search when filtering by category
            const searchInput = document.getElementById('menuSearch');
            if (searchInput) {
                searchInput.value = '';
                toggleClearButton(false);
            }
            
            // Filter menu items
            const category = this.dataset.category;
            filterMenuItems(category);
        });
    });
    
    // Search functionality
    const searchInput = document.getElementById('menuSearch');
    const clearButton = document.getElementById('clearSearch');
    
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.trim();
            toggleClearButton(searchTerm.length > 0);
            
            if (searchTerm.length > 0) {
                // Clear category filter when searching
                filterButtons.forEach(btn => btn.classList.remove('active'));
                document.querySelector('[data-category="all"]').classList.add('active');
                searchMenuItems(searchTerm);
            } else {
                // Show all items when search is cleared
                filteredMenuItems = [...allMenuItems];
                renderMenuItems();
            }
        });
    }
    
    if (clearButton) {
        clearButton.addEventListener('click', function() {
            searchInput.value = '';
            toggleClearButton(false);
            filteredMenuItems = [...allMenuItems];
            renderMenuItems();
            searchInput.focus();
        });
    }
}

function toggleClearButton(show) {
    const clearButton = document.getElementById('clearSearch');
    if (clearButton) {
        clearButton.style.display = show ? 'block' : 'none';
    }
}

function searchMenuItems(searchTerm) {
    const term = searchTerm.toLowerCase();
    filteredMenuItems = allMenuItems.filter(item => 
        item.name.toLowerCase().includes(term) ||
        item.description.toLowerCase().includes(term) ||
        item.category.toLowerCase().includes(term)
    );
    renderMenuItems();
}

async function loadMenuItems() {
    const menuGrid = document.getElementById('menuGrid');
    if (!menuGrid) return;
    
    menuGrid.innerHTML = `
        <div class="menu-loading">
            <div class="loading-spinner"></div>
            <p>Loading...</p>
        </div>
    `;
    
    try {
        // Wait for Supabase with timeout
        let attempts = 0;
        while ((typeof window.supabaseClient === 'undefined' || !window.supabaseClient) && attempts < 15) {
            await new Promise(resolve => setTimeout(resolve, 200));
            attempts++;
        }

        if (!window.supabaseClient) {
            throw new Error('Database connection timeout');
        }

        const { data, error } = await window.supabaseClient
            .from('menu_items')
            .select('id,name,description,price,category,image_url')
            .eq('is_available', true)
            .order('category');
        
        if (error) throw error;
        
        allMenuItems = data || [];
        filteredMenuItems = [...allMenuItems];
        
        // Cache the data
        setCachedMenu(allMenuItems);
        
    } catch (error) {
        console.error('Error loading menu:', error);
        allMenuItems = [];
        filteredMenuItems = [];
        
        menuGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Connection Error</h3>
                <button onclick="location.reload()">Retry</button>
            </div>
        `;
    }
}

function filterMenuItems(category) {
    if (category === 'all') {
        filteredMenuItems = [...allMenuItems];
    } else {
        filteredMenuItems = allMenuItems.filter(item => {
            const itemCategory = item.category.toLowerCase();
            const filterCategory = category.toLowerCase();
            
            const categoryMap = {
                'appetizers': 'starters',
                'drinks': 'beverages',
                'mains': 'international'
            };
            
            const mappedCategory = categoryMap[itemCategory] || itemCategory;
            return mappedCategory === filterCategory || itemCategory === filterCategory;
        });
    }
    
    renderMenuItems();
}

function renderMenuItems() {
    const menuGrid = document.getElementById('menuGrid');
    if (!menuGrid) return;
    
    if (filteredMenuItems.length === 0) {
        menuGrid.innerHTML = '<div class="empty-state"><i class="fas fa-utensils"></i><h3>No items found</h3></div>';
        return;
    }

    // Use DocumentFragment for better performance
    const fragment = document.createDocumentFragment();
    
    filteredMenuItems.forEach(item => {
        const menuItem = document.createElement('div');
        menuItem.className = 'menu-item';
        
        menuItem.innerHTML = `
            <div class="menu-item-image">
                ${item.image_url ? `<img src="${item.image_url}" alt="${item.name}" loading="lazy">` : '<i class="fas fa-utensils"></i>'}
            </div>
            <div class="menu-item-content">
                <div class="menu-item-category">${item.category}</div>
                <div class="menu-item-header">
                    <h3 class="menu-item-name">${item.name}</h3>
                    <span class="menu-item-price">${formatCurrency(item.price)}</span>
                </div>
                <p class="menu-item-description">${item.description}</p>
                <button class="add-to-cart" onclick="addToCart('${item.id}')">
                    <i class="fas fa-plus"></i> Add to Order
                </button>
            </div>
        `;
        
        fragment.appendChild(menuItem);
    });
    
    menuGrid.innerHTML = '';
    menuGrid.appendChild(fragment);
}

function createEmptyState() {
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    
    const icon = document.createElement('i');
    icon.className = allMenuItems.length === 0 ? 'fas fa-utensils' : 'fas fa-search';
    
    const title = document.createElement('h3');
    title.textContent = allMenuItems.length === 0 ? 'No menu items available' : 'No items found';
    
    const text = document.createElement('p');
    text.textContent = allMenuItems.length === 0 ? 
        "Admin hasn't added any menu items yet. Please check back later." :
        'Try adjusting your search or browse our categories';
    
    emptyState.appendChild(icon);
    emptyState.appendChild(title);
    emptyState.appendChild(text);
    
    return emptyState;
}

function addToCart(itemId) {
    const item = allMenuItems.find(i => i.id === itemId || i.id === parseInt(itemId));
    if (!item) {
        console.error('Item not found:', itemId);
        return;
    }

    const cart = getCart();
    const existingItem = cart.find(cartItem => cartItem.id === itemId || cartItem.id === parseInt(itemId));

    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            ...item,
            quantity: 1,
            cartId: Date.now().toString() // Unique ID for cart item
        });
    }

    saveCart(cart);
    updateCartCount();
    
    // Show feedback
    showAddToCartFeedback(item.name);
}

function showAddToCartFeedback(itemName) {
    // Create enhanced feedback notification
    const feedback = document.createElement('div');
    feedback.className = 'notification-toast success';
    
    // Create elements safely without innerHTML
    const icon = document.createElement('i');
    icon.className = 'fas fa-check-circle';
    
    const contentDiv = document.createElement('div');
    const strong = document.createElement('strong');
    strong.setAttribute('data-translate', 'menu_added_to_order');
    strong.textContent = typeof translate === 'function' ? translate('menu_added_to_order') : 'Added to Order';
    
    const p = document.createElement('p');
    p.textContent = itemName;
    
    contentDiv.appendChild(strong);
    contentDiv.appendChild(p);
    feedback.appendChild(icon);
    feedback.appendChild(contentDiv);
    
    // Add to notification area or create one
    let notificationArea = document.querySelector('.notification-area');
    if (!notificationArea) {
        notificationArea = document.createElement('div');
        notificationArea.className = 'notification-area';
        document.body.appendChild(notificationArea);
    }
    
    notificationArea.appendChild(feedback);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        feedback.style.animation = 'slideOutRight 0.3s ease forwards';
        setTimeout(() => {
            if (feedback.parentNode) {
                feedback.remove();
            }
        }, 300);
    }, 3000);
}

// Mobile Navigation
function initMobileNavigation() {
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    
    if (hamburger && navMenu) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
        });
        
        // Close menu when clicking on a link
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                hamburger.classList.remove('active');
                navMenu.classList.remove('active');
            });
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!hamburger.contains(e.target) && !navMenu.contains(e.target)) {
                hamburger.classList.remove('active');
                navMenu.classList.remove('active');
            }
        });
    }
    
    // Language selection handler
    const languageSelect = document.getElementById('languageSelect');
    if (languageSelect) {
        languageSelect.addEventListener('change', function() {
            if (typeof setStoredLanguage === 'function') {
                setStoredLanguage(this.value);
            }
        });
    }
}

// Enhanced Scroll Animations with Magic Effects
function initScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
                entry.target.classList.add('reveal');
            }
        });
    }, observerOptions);
    
    // Observe elements that should animate
    const animateElements = document.querySelectorAll('.scroll-animate, .scroll-magic');
    animateElements.forEach(el => observer.observe(el));
    
    // Add scroll magic to menu items
    setTimeout(() => {
        const menuItems = document.querySelectorAll('.menu-item');
        menuItems.forEach(item => {
            item.classList.add('scroll-magic');
            observer.observe(item);
        });
    }, 1000);
    
    // Parallax effect for hero elements
    let ticking = false;
    window.addEventListener('scroll', () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                const scrolled = window.pageYOffset;
                const parallaxElements = document.querySelectorAll('.parallax-element');
                parallaxElements.forEach(element => {
                    const speed = element.dataset.speed || 0.5;
                    const yPos = -(scrolled * speed);
                    element.style.transform = `translateY(${yPos}px)`;
                });
                ticking = false;
            });
            ticking = true;
        }
    });
}

// Scroll to Top functionality
function initScrollToTop() {
    const scrollToTopBtn = document.getElementById('scrollToTop');
    const homeBtn = document.querySelector('.home-btn');
    
    // Show/hide buttons based on scroll position
    let ticking = false;
    window.addEventListener('scroll', () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                if (window.pageYOffset > 300) {
                    if (scrollToTopBtn) scrollToTopBtn.classList.add('show');
                    if (homeBtn) homeBtn.classList.add('show');
                } else {
                    if (scrollToTopBtn) scrollToTopBtn.classList.remove('show');
                    if (homeBtn) homeBtn.classList.remove('show');
                }
                ticking = false;
            });
            ticking = true;
        }
    });
    
    // Scroll to top when clicked
    if (scrollToTopBtn) {
        scrollToTopBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }
}