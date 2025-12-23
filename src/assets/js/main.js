// Smart Restaurant System | by Assistant
// Main JavaScript for homepage functionality

document.addEventListener('DOMContentLoaded', function() {
    // Mobile navigation toggle
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    
    if (hamburger && navMenu) {
        hamburger.addEventListener('click', function() {
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
        });
        
        // Close menu when clicking on a link
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                hamburger.classList.remove('active');
                navMenu.classList.remove('active');
            });
        });
    }
    
    // Language selection handler
    const languageSelect = document.getElementById('languageSelect');
    if (languageSelect) {
        languageSelect.addEventListener('change', function() {
            if (typeof setStoredLanguage === 'function') {
                setStoredLanguage(this.value);
            } else {
                console.warn('Language switching functionality not available');
                // Store selection for when translation system loads
                localStorage.setItem('preferred_language', this.value);
            }
        });
    }

    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Initialize cart count
    updateCartCount();

    // 3D banner runs automatically with CSS animation

    // Add animation to features on scroll
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.animation = 'fadeInUp 0.6s ease forwards';
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observe feature elements
    document.querySelectorAll('.feature').forEach(el => {
        observer.observe(el);
    });
});

// Secure cart management functions
function getCart() {
    try {
        const cartData = localStorage.getItem('restaurant_cart');
        if (!cartData) return [];
        
        const cart = JSON.parse(cartData);
        
        // Validate cart structure
        if (!Array.isArray(cart)) return [];
        
        // Validate each cart item
        return cart.filter(item => 
            item && 
            typeof item.id === 'string' &&
            typeof item.name === 'string' &&
            typeof item.price === 'number' &&
            typeof item.quantity === 'number' &&
            item.id.length > 0 &&
            item.name.length > 0 &&
            item.price > 0 &&
            item.quantity > 0 &&
            item.quantity <= 99
        );
    } catch (error) {
        console.error('Error reading cart:', error);
        return [];
    }
}

function saveCart(cart) {
    try {
        if (!Array.isArray(cart)) {
            console.error('Invalid cart data');
            return;
        }
        
        // Limit cart size for security
        if (cart.length > 50) {
            console.error('Cart size exceeds limit');
            return;
        }
        
        localStorage.setItem('restaurant_cart', JSON.stringify(cart));
    } catch (error) {
        console.error('Error saving cart:', error);
    }
}

function updateCartCount() {
    const cart = getCart();
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const cartCountElements = document.querySelectorAll('.cart-count');
    
    cartCountElements.forEach(element => {
        element.textContent = totalItems;
    });
}

// Utility function to format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

