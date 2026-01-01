// Authentication system for RAMZ-HOTEL using Supabase
let currentUser = null;

// Wait for Supabase to be initialized
function waitForSupabase() {
    return new Promise((resolve) => {
        if (typeof supabase !== 'undefined' && supabase) {
            resolve();
        } else {
            const checkInterval = setInterval(() => {
                if (typeof supabase !== 'undefined' && supabase) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);
        }
    });
}

// Check if user is authenticated
async function isAuthenticated() {
    try {
        await waitForSupabase();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            currentUser = user;
            return true;
        }
        return false;
    } catch (error) {
        console.error('Auth check error:', error);
        return false;
    }
}

// Get current user with role
async function getCurrentUser() {
    try {
        await waitForSupabase();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;
        
        // Get user role from profiles table
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
            
        return {
            ...user,
            role: profile?.role || 'customer'
        };
    } catch (error) {
        console.error('Get user error:', error);
        return null;
    }
}

// Login function with enhanced security
async function login(email, password) {
    try {
        // Input validation
        if (!email || !password) {
            throw new Error('Email and password are required');
        }
        
        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw new Error('Please enter a valid email address');
        }
        
        // Password strength check
        if (password.length < 8) {
            throw new Error('Password must be at least 8 characters long');
        }
        
        // Check password complexity
        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
            throw new Error('Password must contain uppercase, lowercase, and number');
        }
        
        await waitForSupabase();
        
        // Rate limiting check
        const lastLoginAttempt = localStorage.getItem('lastLoginAttempt');
        const now = Date.now();
        if (lastLoginAttempt && (now - parseInt(lastLoginAttempt)) < 3000) {
            throw new Error('Please wait before trying again');
        }
        localStorage.setItem('lastLoginAttempt', now.toString());
        
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email.trim().toLowerCase(),
            password
        });
        
        if (error) {
            // Don't expose detailed error messages for security
            if (error.message.includes('Invalid login credentials')) {
                throw new Error('Invalid email or password');
            }
            throw new Error('Login failed. Please try again.');
        }
        
        const user = await getCurrentUser();
        if (!user) {
            throw new Error('Failed to retrieve user information');
        }
        
        // Clear rate limiting on successful login
        localStorage.removeItem('lastLoginAttempt');
        
        // Secure redirect based on role
        const allowedRoles = ['admin', 'chef', 'hostess'];
        if (allowedRoles.includes(user.role)) {
            // Use relative paths for security
            switch(user.role) {
                case 'admin':
                    window.location.href = '/admin';
                    break;
                case 'chef':
                    window.location.href = '/chef';
                    break;
                case 'hostess':
                    window.location.href = '/hostess';
                    break;
            }
        } else {
            window.location.href = '/';
        }
        
        return user;
    } catch (error) {
        console.error('Login error:', error.message);
        throw new Error(error.message || 'Login failed');
    }
}

// Logout function
async function logout() {
    try {
        await waitForSupabase();
        await supabase.auth.signOut();
        window.location.href = '/login';
    } catch (error) {
        console.error('Logout error:', error);
        window.location.href = '/login';
    }
}

// Protect page based on required role
async function requireAuth(requiredRole) {
    const authenticated = await isAuthenticated();
    
    if (!authenticated) {
        window.location.href = '/login';
        return false;
    }
    
    const user = await getCurrentUser();
    if (user.role !== requiredRole) {
        alert('Access denied. You do not have permission to access this page.');
        window.location.href = '/login';
        return false;
    }
    
    return true;
}

// Login form handler
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const submitBtn = e.target.querySelector('button[type="submit"]');
            
            try {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Signing in...';
                
                await login(email, password);
            } catch (error) {
                alert(error.message);
                submitBtn.disabled = false;
                submitBtn.textContent = 'Login';
            }
        });
    }
});

// Add logout functionality to existing pages
async function addLogoutButton() {
    const user = await getCurrentUser();
    if (!user) return;
    
    const navMenu = document.querySelector('.nav-menu');
    if (navMenu) {
        const logoutBtn = document.createElement('a');
        logoutBtn.href = '#';
        logoutBtn.className = 'nav-link logout-btn';
        logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Logout';
        logoutBtn.onclick = function(e) {
            e.preventDefault();
            logout();
        };
        navMenu.appendChild(logoutBtn);
    }
}