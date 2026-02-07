# RAMZ Cashier PWA - Installation & Usage Guide

## 🚀 Features

- **Offline Support**: Works without internet connection
- **Order Caching**: Orders cached locally for offline access
- **Auto-Sync**: Automatically syncs when back online
- **Installable**: Install as native app on any device
- **Fast & Reliable**: Service worker caching for instant loading

## 📱 Installation Instructions

### Desktop (Chrome/Edge)
1. Open `https://your-domain.com/src/pages/cashier.html`
2. Look for the **Install App** button in the top bar
3. Click **Install App** or use the browser's install icon (⊕) in the address bar
4. Click **Install** in the popup
5. App will open in standalone window

### Mobile (Android)
1. Open the cashier page in Chrome
2. Tap the menu (⋮) → **Add to Home screen**
3. Name it "RAMZ Cashier"
4. Tap **Add**
5. Icon appears on home screen

### Mobile (iOS)
1. Open the cashier page in Safari
2. Tap the Share button (□↑)
3. Scroll and tap **Add to Home Screen**
4. Name it "RAMZ Cashier"
5. Tap **Add**
6. Icon appears on home screen

## 🔧 Technical Setup

### Files Structure
```
smart-hotel/
├── cashier-sw.js                    # Service Worker
├── cashier-manifest.json            # PWA Manifest
└── src/
    ├── pages/
    │   └── cashier.html            # Main app
    └── assets/
        ├── js/
        │   ├── offline-cache.js    # IndexedDB cache manager
        │   ├── cashier-simple.js   # Main app logic
        │   ├── config-public.js    # Configuration
        │   └── supabase.js         # Database client
        ├── css/
        │   ├── style.css
        │   └── cashier.css
        └── images/
            ├── icon-192.png        # PWA icon 192x192
            └── icon-512.png        # PWA icon 512x512
```

### Generate Icons
1. Open `src/assets/images/icon-generator.html` in browser
2. Click **Download 192x192** and **Download 512x512**
3. Save both files to `src/assets/images/`

## 💾 Offline Capabilities

### What Works Offline
- ✅ View cached orders
- ✅ Process payments (saved locally)
- ✅ Print receipts
- ✅ Create manual orders
- ✅ View menu items
- ✅ Daily statistics

### Auto-Sync When Online
- Pending transactions sync automatically
- Orders refresh from server
- Menu items update
- Statistics recalculate

## 🔄 Cache Management

### Automatic Cache
- Orders cached when loaded
- Menu items cached on first load
- Transactions queued when offline
- Old cache cleared after 7 days

### Manual Cache Clear
```javascript
// In browser console
indexedDB.deleteDatabase('ramz-cashier-db');
localStorage.clear();
location.reload();
```

## 🎯 Usage Tips

### Keyboard Shortcuts
- **Enter**: Process payment (when payment panel open)
- **Esc**: Cancel/close modal
- **Tab**: Navigate between fields

### Best Practices
1. Keep app installed for best performance
2. Sync regularly when online
3. Check offline indicator in top bar
4. Print receipts immediately after payment

## 🔍 Troubleshooting

### App Won't Install
- Ensure HTTPS is enabled (required for PWA)
- Check browser supports PWA (Chrome, Edge, Safari)
- Clear browser cache and try again

### Offline Mode Not Working
- Check service worker is registered (F12 → Application → Service Workers)
- Verify IndexedDB is enabled in browser
- Ensure app was loaded at least once while online

### Sync Issues
- Check internet connection
- Verify Supabase credentials in config
- Check browser console for errors
- Try manual refresh

## 📊 Monitoring

### Check Service Worker Status
```javascript
navigator.serviceWorker.getRegistrations().then(regs => {
    console.log('Active workers:', regs.length);
});
```

### Check Cached Data
```javascript
// Open browser DevTools → Application → IndexedDB → ramz-cashier-db
```

### Check Pending Syncs
```javascript
const cache = new OfflineOrderCache();
cache.getPendingTransactions().then(pending => {
    console.log('Pending syncs:', pending.length);
});
```

## 🔐 Security Notes

- Service worker only works over HTTPS
- Cached data stored locally on device
- Clear cache when changing devices
- Credentials never cached offline

## 🆕 Updates

### Auto-Update
- App checks for updates automatically
- Prompts user to reload when update available
- Service worker updates in background

### Force Update
1. Unregister service worker
2. Clear cache
3. Reload page

```javascript
navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(reg => reg.unregister());
});
```

## 📞 Support

For issues or questions:
- Check browser console for errors
- Verify all files are properly uploaded
- Ensure service worker path is correct
- Test on different browsers/devices

---

**Version**: 2.0.0  
**Last Updated**: 2024  
**Compatibility**: Chrome 90+, Edge 90+, Safari 14+, Firefox 90+
