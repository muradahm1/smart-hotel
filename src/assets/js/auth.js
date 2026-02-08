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

// --- SHIFT MANAGEMENT HELPERS ---

async function startShift(user) {
    // Only cashiers need shift management
    if (user.role !== 'cashier') {
        console.log('Shift tracking not required for role:', user.role);
        return null;
    }

    try {
        // Check for existing active shift
        const { data: existingShift } = await supabase.rpc('get_active_shift', {
            p_user_id: user.id
        });

        if (existingShift) {
            console.log('Resuming existing shift:', existingShift.id);
            localStorage.setItem('current_shift_id', existingShift.id);
            return existingShift.id;
        }

        // Prompt for opening cash
        const openingCash = await promptForOpeningCash();
        if (openingCash === null) {
            throw new Error('Shift start cancelled - opening cash required');
        }

        // Start new shift using RPC function
        const { data: newShift, error } = await supabase.rpc('start_shift', {
            p_user_id: user.id,
            p_role: user.role,
            p_opening_cash: openingCash
        });

        if (error) throw error;
        
        console.log('Shift started:', newShift.id);
        localStorage.setItem('current_shift_id', newShift.id);
        showNotification(`Shift started with $${openingCash.toFixed(2)} opening cash`, 'success');
        return newShift.id;
    } catch (error) {
        console.error('Error starting shift:', error);
        showNotification('Failed to start shift: ' + error.message, 'error');
        throw error;
    }
}

async function endShift(user) {
    const shiftId = localStorage.getItem('current_shift_id');
    if (!shiftId || user.role !== 'cashier') return;

    try {
        // Get shift details for expected cash calculation
        const { data: shift } = await supabase
            .from('shifts')
            .select('opening_cash, cash_sales')
            .eq('id', shiftId)
            .single();

        if (!shift) {
            console.warn('No active shift found');
            localStorage.removeItem('current_shift_id');
            return;
        }

        const expectedCash = parseFloat(shift.opening_cash || 0) + parseFloat(shift.cash_sales || 0);

        // Prompt for closing cash
        const closingCash = await promptForClosingCash(expectedCash);
        if (closingCash === null) {
            throw new Error('Cannot logout - shift must be closed first');
        }

        // Close shift using RPC function
        const { data: closedShift, error } = await supabase.rpc('close_shift', {
            p_user_id: user.id,
            p_closing_cash: closingCash
        });

        if (error) throw error;
        
        const variance = parseFloat(closedShift.cash_variance || 0);
        if (variance !== 0) {
            const varianceMsg = variance > 0 
                ? `Cash over by $${Math.abs(variance).toFixed(2)}` 
                : `Cash short by $${Math.abs(variance).toFixed(2)}`;
            showNotification(varianceMsg, variance > 0 ? 'warning' : 'error');
        } else {
            showNotification('Shift closed - cash balanced perfectly!', 'success');
        }
        
        console.log('Shift closed successfully');
        localStorage.removeItem('current_shift_id');
    } catch (error) {
        console.error('Error ending shift:', error);
        showNotification('Failed to close shift: ' + error.message, 'error');
        throw error;
    }
}

function promptForOpeningCash() {
    return new Promise((resolve) => {
        const amount = prompt('Enter opening cash amount in drawer:', '500.00');
        if (amount === null) {
            resolve(null);
            return;
        }
        const parsed = parseFloat(amount);
        if (isNaN(parsed) || parsed < 0) {
            alert('Invalid amount. Please enter a positive number.');
            resolve(promptForOpeningCash());
        } else {
            resolve(parsed);
        }
    });
}

function promptForClosingCash(expectedCash) {
    return new Promise((resolve) => {
        const message = `Count cash in drawer:\n\nExpected: $${expectedCash.toFixed(2)}\n\nEnter actual amount:`;
        const amount = prompt(message, expectedCash.toFixed(2));
        if (amount === null) {
            if (confirm('You must close your shift before logging out. Cancel logout?')) {
                resolve(null);
            } else {
                resolve(promptForClosingCash(expectedCash));
            }
            return;
        }
        const parsed = parseFloat(amount);
        if (isNaN(parsed) || parsed < 0) {
            alert('Invalid amount. Please enter a positive number.');
            resolve(promptForClosingCash(expectedCash));
        } else {
            resolve(parsed);
        }
    });
}

function showNotification(message, type = 'info') {
    const colors = {
        success: '#51cf66',
        error: '#ff6b6b',
        warning: '#ffa94d',
        info: '#339af0'
    };

    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${colors[type] || colors.info};
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        font-weight: 600;
        z-index: 10000;
        animation: slideIn 0.3s ease;
        max-width: 300px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

// --------------------------------

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
        
        // Start tracking the shift
        await startShift(user);
        
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
        
        const user = await getCurrentUser();
        
        // Close the shift before signing out (for cashiers)
        if (user && user.role === 'cashier') {
            await endShift(user);
        }
        
        await supabase.auth.signOut();
        window.location.href = '/login';
    } catch (error) {
        console.error('Logout error:', error);
        // If shift close fails, ask user if they want to force logout
        if (error.message.includes('shift')) {
            if (confirm('Failed to close shift. Force logout anyway? (Not recommended)')) {
                await supabase.auth.signOut();
                localStorage.removeItem('current_shift_id');
                window.location.href = '/login';
            }
        } else {
            window.location.href = '/login';
        }
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