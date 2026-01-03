// Prevent multiple initializations
if (typeof window.tableInitialized === 'undefined') {
    window.tableInitialized = true;
    
    document.addEventListener('DOMContentLoaded', function() {
        const urlParams = new URLSearchParams(window.location.search);
        const tableId = urlParams.get('table_id') || urlParams.get('table') || urlParams.get('t');
        const roomId = urlParams.get('room_id') || urlParams.get('room') || urlParams.get('r');
        const floor = urlParams.get('floor') || urlParams.get('f') || '1';

        let locationId = tableId || roomId;
        let locationType = tableId ? 'table' : (roomId ? 'room' : null);

        if (locationId && locationType) {
            // Store location data immediately
            localStorage.setItem('ramzLocationId', locationId);
            localStorage.setItem('ramzLocationType', locationType);
            localStorage.setItem('ramzFromQR', 'true');
            localStorage.setItem('ramzTableId', locationId);
            
            // Create location info object
            const locationInfo = {
                type: locationType,
                number: locationId,
                floor: floor,
                location: `Floor ${floor}, ${locationType.charAt(0).toUpperCase() + locationType.slice(1)} ${locationId}`
            };
            localStorage.setItem('currentLocation', JSON.stringify(locationInfo));
            
            // Redirect immediately to menu page
            window.location.href = './menu.html';
            
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
                    <h1 style="color: var(--accent-gold); margin-bottom: 1rem;">Invalid Location</h1>
                    <p style="color: var(--text-secondary); margin-bottom: 2rem;">The scanned QR code is invalid. Please try again.</p>
                    <a href="../../index.html" class="btn btn-primary">Go Home</a>
                </div>
            `;
        }
    });
}