// Prevent multiple initializations
if (typeof window.tableInitialized === 'undefined') {
    window.tableInitialized = true;
    
    document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const tableId = urlParams.get('table_id') || urlParams.get('table');
    const roomId = urlParams.get('room_id') || urlParams.get('room');

    let locationId = tableId || roomId;
    let locationType = tableId ? 'table' : (roomId ? 'room' : null);

    if (locationId && locationType) {
        localStorage.setItem('ramzLocationId', locationId);
        localStorage.setItem('ramzLocationType', locationType);
        localStorage.setItem('ramzFromQR', 'true');
        
        const translatedLocationType = translate(`location_type_${locationType}`);

        // Show location info before redirecting
        document.body.innerHTML = `
            <div class="container" style="text-align: center; padding-top: 5rem;">
                <h1 style="color: var(--accent-gold); font-size: 3rem; margin-bottom: 1rem;" data-translate="location_welcome">${translate('location_welcome').replace('{locationType}', translatedLocationType).replace('{locationId}', locationId)}</h1>
                <p style="font-size: 1.2rem; margin-bottom: 2rem;" data-translate="location_seated">${translate('location_seated').replace('{locationType}', translatedLocationType).replace('{locationId}', locationId)}</p>
                <p data-translate="location_redirect">${translate('location_redirect').replace('{seconds}', '<span id="countdown">3</span>')}</p>
            </div>
        `;
        
        let countdown = 3;
        const countdownElement = document.getElementById('countdown');
        
        if (countdownElement) {
            const timer = setInterval(() => {
                countdown--;
                countdownElement.textContent = countdown;
                
                if (countdown <= 0) {
                    clearInterval(timer);
                    window.location.href = './menu.html';
                }
            }, 1000);
        }
        
    } else {
        // Clear any existing location data when QR scan fails
        localStorage.removeItem('ramzLocationId');
        localStorage.removeItem('ramzLocationType');
        localStorage.removeItem('ramzFromQR');
        document.body.innerHTML = `
            <div class="container" style="text-align: center; padding-top: 5rem;">
                <h1 data-translate="location_error_title">${translate('location_error_title')}</h1>
                <p data-translate="location_error_text">${translate('location_error_text')}</p>
            </div>
        `;
    }
    });
}