// Security utilities for RAMZ-HOTEL application
// This file contains common security functions used across the application

/**
 * Comprehensive input sanitization
 * @param {string} input - The input to sanitize
 * @returns {string} - Sanitized input
 */
function sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    
    // HTML entity encoding
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

/**
 * Validate and sanitize HTML content
 * @param {string} html - HTML content to sanitize
 * @returns {string} - Sanitized HTML
 */
function sanitizeHTML(html) {
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
}

/**
 * Validate item ID format
 * @param {string} id - ID to validate
 * @returns {boolean} - True if valid
 */
function validateItemId(id) {
    return id && typeof id === 'string' && /^[a-zA-Z0-9-_]{1,50}$/.test(id);
}

/**
 * Validate URL format and protocol
 * @param {string} url - URL to validate
 * @returns {boolean} - True if valid
 */
function validateImageUrl(url) {
    try {
        const urlObj = new URL(url);
        return ['http:', 'https:'].includes(urlObj.protocol);
    } catch {
        return false;
    }
}

/**
 * Rate limiting utility
 * @param {string} key - Unique key for the operation
 * @param {number} cooldown - Cooldown period in milliseconds
 * @returns {boolean} - True if operation is allowed
 */
function checkRateLimit(key, cooldown = 30000) {
    const lastTime = localStorage.getItem(`rateLimit_${key}`);
    const now = Date.now();
    
    if (lastTime && (now - parseInt(lastTime)) < cooldown) {
        return false;
    }
    
    localStorage.setItem(`rateLimit_${key}`, now.toString());
    return true;
}

/**
 * Secure event listener attachment
 * @param {Element} element - Element to attach listener to
 * @param {string} event - Event type
 * @param {Function} handler - Event handler
 */
function secureEventListener(element, event, handler) {
    if (element && typeof handler === 'function') {
        element.addEventListener(event, handler);
    }
}

/**
 * Create secure DOM element with text content
 * @param {string} tagName - HTML tag name
 * @param {string} textContent - Text content
 * @param {string} className - CSS class name
 * @returns {Element} - Created element
 */
function createSecureElement(tagName, textContent = '', className = '') {
    const element = document.createElement(tagName);
    if (textContent) element.textContent = textContent;
    if (className) element.className = className;
    return element;
}

/**
 * Validate form data
 * @param {Object} data - Form data to validate
 * @param {Object} rules - Validation rules
 * @returns {Object} - Validation result
 */
function validateFormData(data, rules) {
    const errors = [];
    
    for (const [field, rule] of Object.entries(rules)) {
        const value = data[field];
        
        if (rule.required && (!value || value.toString().trim() === '')) {
            errors.push(`${field} is required`);
            continue;
        }
        
        if (value && rule.minLength && value.toString().length < rule.minLength) {
            errors.push(`${field} must be at least ${rule.minLength} characters`);
        }
        
        if (value && rule.maxLength && value.toString().length > rule.maxLength) {
            errors.push(`${field} must be no more than ${rule.maxLength} characters`);
        }
        
        if (value && rule.pattern && !rule.pattern.test(value.toString())) {
            errors.push(`${field} format is invalid`);
        }
        
        if (value && rule.type === 'number') {
            const num = parseFloat(value);
            if (isNaN(num)) {
                errors.push(`${field} must be a valid number`);
            } else if (rule.min !== undefined && num < rule.min) {
                errors.push(`${field} must be at least ${rule.min}`);
            } else if (rule.max !== undefined && num > rule.max) {
                errors.push(`${field} must be no more than ${rule.max}`);
            }
        }
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Secure localStorage operations
 */
const secureStorage = {
    get: function(key) {
        try {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            console.error('Error reading from localStorage:', error);
            return null;
        }
    },
    
    set: function(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error('Error writing to localStorage:', error);
            return false;
        }
    },
    
    remove: function(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('Error removing from localStorage:', error);
            return false;
        }
    }
};

/**
 * Security configuration validation
 */
function validateSecurityConfig() {
    const issues = [];
    
    // Check CSP
    const csp = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (!csp) {
        issues.push('Missing Content Security Policy');
    }
    
    // Check HTTPS in production
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        issues.push('Application should use HTTPS in production');
    }
    
    // Check for exposed credentials
    if (window.SUPABASE_URL && window.SUPABASE_URL.includes('YOUR_SUPABASE_URL_HERE')) {
        issues.push('Supabase credentials not configured');
    }
    
    return {
        isSecure: issues.length === 0,
        issues
    };
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        sanitizeInput,
        sanitizeHTML,
        validateItemId,
        validateImageUrl,
        checkRateLimit,
        secureEventListener,
        createSecureElement,
        validateFormData,
        secureStorage,
        validateSecurityConfig
    };
}