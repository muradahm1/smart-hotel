document.addEventListener('DOMContentLoaded', function() {
    // Get room info from URL
    const urlParams = new URLSearchParams(window.location.search);
    const roomNumber = urlParams.get('room') || urlParams.get('r');
    const floor = urlParams.get('floor') || urlParams.get('f') || '1';
    
    let locationInfo;
    if (roomNumber) {
        locationInfo = {
            type: 'room',
            number: roomNumber,
            floor: floor,
            location: `Floor ${floor}, Room ${roomNumber}`
        };
        const loadingTitle = document.getElementById('loadingTitle');
        const loadingText = document.getElementById('loadingText');
        
        if (loadingTitle) loadingTitle.textContent = `Welcome to Room ${roomNumber}`;
        if (loadingText) loadingText.textContent = `Floor ${floor} - Preparing your room service menu...`;
    }
    
    if (locationInfo) {
        localStorage.setItem('currentLocation', JSON.stringify(locationInfo));
        localStorage.setItem('ramzFromQR', 'true');
        localStorage.setItem('ramzTableId', locationInfo.number);
        
        setTimeout(() => {
            document.getElementById('loadingScreen').style.display = 'none';
            document.getElementById('navLocation').textContent = locationInfo.location;
            document.getElementById('menuLocation').textContent = `${locationInfo.location} - Order directly to your room`;
        }, 300);
    } else {
        // No location info, hide loading immediately
        document.getElementById('loadingScreen').style.display = 'none';
    }
});