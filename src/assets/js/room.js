// Prevent multiple initializations
if (typeof window.roomInitialized === 'undefined') {
    window.roomInitialized = true;
    
    document.addEventListener('DOMContentLoaded', function() {
        const urlParams = new URLSearchParams(window.location.search);
        const roomId = urlParams.get('room_id') || urlParams.get('room') || urlParams.get('r');
        const floor = urlParams.get('floor') || urlParams.get('f') || '1';

        if (roomId) {
            // Store location data immediately
            localStorage.setItem('ramzLocationId', roomId);
            localStorage.setItem('ramzLocationType', 'room');
            localStorage.setItem('ramzFromQR', 'true');
            localStorage.setItem('ramzTableId', roomId);
            
            // Create location info object
            const locationInfo = {
                type: 'room',
                number: roomId,
                floor: floor,
                location: `Floor ${floor}, Room ${roomId}`
            };
            localStorage.setItem('currentLocation', JSON.stringify(locationInfo));
            
            // Redirect immediately to menu page
            window.location.href = '/menu';
            
        } else {
            // Clear any existing location data when QR scan fails
            localStorage.removeItem('ramzLocationId');
            localStorage.removeItem('ramzLocationType');
            localStorage.removeItem('ramzFromQR');
            localStorage.removeItem('ramzTableId');
            localStorage.removeItem('currentLocation');
            
            // Show error message
            document.body.innerHTML = `
                <div class="container" style="text-align: center; padding-top: 5rem;">
                    <h1 style="color: var(--accent-gold); margin-bottom: 1rem;">Invalid Room</h1>
                    <p style="color: var(--text-secondary); margin-bottom: 2rem;">The scanned QR code is invalid. Please try again.</p>
                    <a href="../../index.html" class="btn btn-primary">Go Home</a>
                </div>
            `;
        }
    });
}