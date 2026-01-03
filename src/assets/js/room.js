// Prevent multiple initializations
if (typeof window.roomInitialized === 'undefined') {
    window.roomInitialized = true;
    
    document.addEventListener('DOMContentLoaded', function() {
        const urlParams = new URLSearchParams(window.location.search);
        const roomId = urlParams.get('room_id') || urlParams.get('room') || urlParams.get('r');
        const floor = urlParams.get('floor') || urlParams.get('f') || '1';

        console.log('Room.js - Room ID:', roomId, 'Floor:', floor);

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
            
            console.log('Room.js - Location set, ready');
            
            // Update UI elements
            const navLocation = document.getElementById('navLocation');
            const menuLocation = document.getElementById('menuLocation');
            
            if (navLocation) navLocation.textContent = locationInfo.location;
            if (menuLocation) menuLocation.textContent = `You are at ${locationInfo.location}. Browse our menu and place your order!`;

            // Hide loading screen
            const hideLoader = () => {
                setTimeout(() => {
                    const loadingScreen = document.getElementById('loadingScreen');
                    if (loadingScreen) loadingScreen.style.display = 'none';
                }, 500);
            };

            if (document.readyState === 'complete') hideLoader();
            else window.addEventListener('load', hideLoader);
            
        } else {
            console.log('Room.js - No room ID found');
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
                    <a href="/" class="btn btn-primary">Go Home</a>
                </div>
            `;
        }
    });
}