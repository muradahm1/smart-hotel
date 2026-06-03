// ============================================
// SHIFTS AUTHENTICATION INTEGRATION
// Auto-start shift on login, auto-close on logout
// ============================================

class ShiftsAuthIntegration {
    constructor() {
        this.currentShiftId = null;
        this.userId = null;
        this.userRole = null;
    }

    // Call this after successful login
    async onLogin(userId, userRole) {
        console.log('🔐 Login detected:', userId, userRole);
        
        // Only start shifts for cashier role
        if (userRole !== 'cashier') {
            console.log('⏭️ Skipping shift start - not a cashier role');
            return;
        }

        this.userId = userId;
        this.userRole = userRole;

        try {
            // Check if user already has an active shift
            const { data: activeShift, error: checkError } = await supabaseClient
                .rpc('get_active_shift', { p_user_id: userId });

            if (checkError) {
                console.warn('Error checking active shift:', checkError);
            }

            if (activeShift) {
                console.log('✅ Active shift already exists:', activeShift);
                this.currentShiftId = activeShift.id;
                localStorage.setItem('current_shift_id', activeShift.id);
                this.showShiftNotification(`Shift resumed: ${this.formatCurrency(activeShift.opening_cash)} opening cash`);
                return activeShift;
            }

            // Prompt for opening cash amount
            const openingCash = await this.promptOpeningCash();
            if (openingCash === null) {
                console.log('❌ Shift start cancelled by user');
                return null;
            }

            // Start new shift
            const { data: newShift, error: startError } = await supabaseClient
                .rpc('start_shift', {
                    p_user_id: userId,
                    p_role: userRole,
                    p_opening_cash: openingCash
                });

            if (startError) {
                console.error('❌ Failed to start shift:', startError);
                this.showShiftNotification('Failed to start shift: ' + startError.message, 'error');
                return null;
            }

            console.log('✅ Shift started:', newShift);
            this.currentShiftId = newShift.id;
            localStorage.setItem('current_shift_id', newShift.id);
            this.showShiftNotification(`Shift started: ${this.formatCurrency(openingCash)} opening cash`, 'success');
            
            return newShift;

        } catch (error) {
            console.error('❌ Shift start error:', error);
            this.showShiftNotification('Error starting shift', 'error');
            return null;
        }
    }

    // Call this before logout
    async onLogout() {
        console.log('🔓 Logout detected');

        if (!this.userId || this.userRole !== 'cashier') {
            console.log('⏭️ Skipping shift close - no active cashier session');
            return;
        }

        try {
            // Check if there's an active shift
            const { data: activeShift, error: checkError } = await supabaseClient
                .rpc('get_active_shift', { p_user_id: this.userId });

            if (checkError || !activeShift) {
                console.log('⏭️ No active shift to close');
                this.cleanup();
                return;
            }

            // Calculate expected cash
            const expectedCash = parseFloat(activeShift.opening_cash) + parseFloat(activeShift.cash_sales || 0);

            // Prompt for closing cash amount
            const closingCash = await this.promptClosingCash(expectedCash);
            if (closingCash === null) {
                console.log('❌ Shift close cancelled - logout aborted');
                return false; // Prevent logout
            }

            // Close shift
            const { data: closedShift, error: closeError } = await supabaseClient
                .rpc('close_shift', {
                    p_user_id: this.userId,
                    p_closing_cash: closingCash
                });

            if (closeError) {
                console.error('❌ Failed to close shift:', closeError);
                this.showShiftNotification('Failed to close shift: ' + closeError.message, 'error');
                return false; // Prevent logout
            }

            console.log('✅ Shift closed:', closedShift);
            
            // Show variance if any
            const variance = parseFloat(closedShift.cash_variance || 0);
            if (variance !== 0) {
                const varianceMsg = variance > 0 
                    ? `Cash over by ${this.formatCurrency(Math.abs(variance))}` 
                    : `Cash short by ${this.formatCurrency(Math.abs(variance))}`;
                this.showShiftNotification(varianceMsg, variance > 0 ? 'info' : 'warning');
            } else {
                this.showShiftNotification('Shift closed - cash balanced perfectly!', 'success');
            }

            this.cleanup();
            return true; // Allow logout

        } catch (error) {
            console.error('❌ Shift close error:', error);
            this.showShiftNotification('Error closing shift', 'error');
            return false; // Prevent logout
        }
    }

    // Prompt user for opening cash amount
    async promptOpeningCash() {
        return new Promise((resolve) => {
            const modal = this.createCashModal(
                'Start Shift',
                'Enter opening cash amount in drawer:',
                '500.00',
                (amount) => resolve(amount),
                () => resolve(null)
            );
            document.body.appendChild(modal);
        });
    }

    // Prompt user for closing cash amount
    async promptClosingCash(expectedCash) {
        return new Promise((resolve) => {
            const modal = this.createCashModal(
                'Close Shift',
                `Count cash in drawer:\n\nExpected: ${this.formatCurrency(expectedCash)}`,
                expectedCash.toFixed(2),
                (amount) => resolve(amount),
                () => resolve(null)
            );
            document.body.appendChild(modal);
        });
    }

    // Create modal for cash input
    createCashModal(title, message, defaultValue, onConfirm, onCancel) {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

        modal.innerHTML = `
            <div style="
                background: #1a1a1a;
                border: 2px solid #c9b48c;
                border-radius: 12px;
                padding: 2rem;
                max-width: 400px;
                width: 90%;
            ">
                <h2 style="color: #c9b48c; margin: 0 0 1rem 0;">${title}</h2>
                <p style="color: #fff; white-space: pre-line; margin-bottom: 1.5rem;">${message}</p>
                <input 
                    type="number" 
                    id="cashAmountInput" 
                    step="0.01" 
                    value="${defaultValue}"
                    style="
                        width: 100%;
                        padding: 12px;
                        font-size: 1.2rem;
                        border: 1px solid #c9b48c;
                        border-radius: 8px;
                        background: #2a2a2a;
                        color: #fff;
                        margin-bottom: 1.5rem;
                    "
                />
                <div style="display: flex; gap: 1rem;">
                    <button id="confirmCashBtn" style="
                        flex: 1;
                        padding: 12px;
                        background: #c9b48c;
                        color: #1a1a1a;
                        border: none;
                        border-radius: 8px;
                        font-weight: bold;
                        cursor: pointer;
                        font-size: 1rem;
                    ">Confirm</button>
                    <button id="cancelCashBtn" style="
                        flex: 1;
                        padding: 12px;
                        background: #333;
                        color: #fff;
                        border: none;
                        border-radius: 8px;
                        font-weight: bold;
                        cursor: pointer;
                        font-size: 1rem;
                    ">Cancel</button>
                </div>
            </div>
        `;

        const input = modal.querySelector('#cashAmountInput');
        const confirmBtn = modal.querySelector('#confirmCashBtn');
        const cancelBtn = modal.querySelector('#cancelCashBtn');

        confirmBtn.addEventListener('click', () => {
            const amount = parseFloat(input.value);
            if (isNaN(amount) || amount < 0) {
                alert('Please enter a valid amount');
                return;
            }
            modal.remove();
            onConfirm(amount);
        });

        cancelBtn.addEventListener('click', () => {
            modal.remove();
            onCancel();
        });

        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                confirmBtn.click();
            }
        });

        setTimeout(() => input.focus(), 100);

        return modal;
    }

    // Show notification
    showShiftNotification(message, type = 'info') {
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
        `;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }

    // Format currency
    formatCurrency(amount) {
        return (amount || 0).toFixed(2);
    }

    // Cleanup
    cleanup() {
        this.currentShiftId = null;
        this.userId = null;
        this.userRole = null;
        localStorage.removeItem('current_shift_id');
    }

    // Get current shift ID (for linking transactions)
    getCurrentShiftId() {
        return this.currentShiftId || localStorage.getItem('current_shift_id');
    }
}

// ============================================
// USAGE EXAMPLE
// ============================================

// Initialize the integration
const shiftsAuth = new ShiftsAuthIntegration();

// In your login handler:
/*
async function handleLogin(email, password) {
    const { data: { user }, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
    });
    
    if (error) {
        console.error('Login failed:', error);
        return;
    }
    
    // Get user role from profiles table
    const { data: profile } = await supabaseClient
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
    
    // Start shift if cashier
    await shiftsAuth.onLogin(user.id, profile.role);
    
    // Continue with normal login flow...
}
*/

// In your logout handler:
/*
async function handleLogout() {
    // Close shift if cashier
    const canLogout = await shiftsAuth.onLogout();
    
    if (!canLogout) {
        console.log('Logout cancelled - shift not closed');
        return;
    }
    
    // Continue with normal logout
    await supabaseClient.auth.signOut();
    window.location.href = '/login.html';
}
*/

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ShiftsAuthIntegration;
}
