# PWA Deployment Checklist

## ✅ Pre-Deployment

### 1. Generate PWA Icons
- [ ] Open `src/assets/images/icon-generator.html`
- [ ] Download icon-192.png
- [ ] Download icon-512.png
- [ ] Place both in `src/assets/images/`

### 2. Configure Manifest
- [ ] Update `cashier-manifest.json` with correct URLs
- [ ] Set proper `start_url`
- [ ] Verify icon paths
- [ ] Set theme colors

### 3. Service Worker Setup
- [ ] Verify `cashier-sw.js` is in root directory
- [ ] Update cache version if needed
- [ ] Check all asset paths in ASSETS_TO_CACHE
- [ ] Test service worker registration

### 4. Database Configuration
- [ ] Set Supabase credentials in `config-public.js`
- [ ] Test database connection
- [ ] Verify RLS policies allow transactions
- [ ] Test offline fallback

## 🚀 Deployment Steps

### 1. Upload Files
```bash
# Upload all files maintaining structure
/cashier-sw.js
/cashier-manifest.json
/src/pages/cashier.html
/src/assets/js/offline-cache.js
/src/assets/js/cashier-simple.js
/src/assets/js/config-public.js
/src/assets/js/supabase.js
/src/assets/css/style.css
/src/assets/css/cashier.css
/src/assets/images/icon-192.png
/src/assets/images/icon-512.png
```

### 2. HTTPS Setup (REQUIRED)
- [ ] Ensure site is served over HTTPS
- [ ] PWA requires secure context
- [ ] Test SSL certificate validity

### 3. Server Configuration

#### Apache (.htaccess)
```apache
# Enable HTTPS
RewriteEngine On
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

# Service Worker MIME type
AddType application/javascript .js
AddType application/manifest+json .json

# Cache headers
<FilesMatch "\.(js|css|png|jpg|jpeg|gif|ico)$">
    Header set Cache-Control "max-age=31536000, public"
</FilesMatch>

<FilesMatch "cashier-sw.js">
    Header set Cache-Control "max-age=0, no-cache, no-store, must-revalidate"
    Header set Service-Worker-Allowed "/"
</FilesMatch>
```

#### Nginx
```nginx
# HTTPS redirect
server {
    listen 80;
    return 301 https://$host$request_uri;
}

# Service Worker headers
location /cashier-sw.js {
    add_header Cache-Control "max-age=0, no-cache, no-store, must-revalidate";
    add_header Service-Worker-Allowed "/";
}

# Static assets cache
location ~* \.(js|css|png|jpg|jpeg|gif|ico)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### 4. Test Installation
- [ ] Open cashier page in browser
- [ ] Check for "Install App" button
- [ ] Click install and verify it works
- [ ] Test app in standalone mode
- [ ] Verify offline functionality

## 🧪 Testing Checklist

### Online Mode
- [ ] Orders load from database
- [ ] Payments process successfully
- [ ] Receipts print correctly
- [ ] Manual orders work
- [ ] Statistics update
- [ ] Real-time updates work

### Offline Mode
- [ ] Cached orders display
- [ ] Can process payments offline
- [ ] Transactions queue for sync
- [ ] Receipts print offline
- [ ] Manual orders work offline
- [ ] Menu items load from cache

### Sync Testing
- [ ] Go offline, process payment
- [ ] Go back online
- [ ] Verify auto-sync notification
- [ ] Check transaction in database
- [ ] Verify pending queue clears

### Cross-Browser Testing
- [ ] Chrome (Desktop)
- [ ] Edge (Desktop)
- [ ] Safari (Desktop)
- [ ] Chrome (Android)
- [ ] Safari (iOS)
- [ ] Firefox (Desktop)

### Device Testing
- [ ] Desktop (Windows)
- [ ] Desktop (Mac)
- [ ] Tablet (Android)
- [ ] Tablet (iOS)
- [ ] Phone (Android)
- [ ] Phone (iOS)

## 🔍 Verification

### Service Worker Check
```javascript
// Open browser console on cashier page
navigator.serviceWorker.getRegistrations().then(regs => {
    console.log('Registered workers:', regs.length);
    regs.forEach(reg => console.log('Scope:', reg.scope));
});
```

### Cache Check
```javascript
// Check what's cached
caches.keys().then(keys => {
    console.log('Cache names:', keys);
    keys.forEach(key => {
        caches.open(key).then(cache => {
            cache.keys().then(requests => {
                console.log(`${key}:`, requests.length, 'items');
            });
        });
    });
});
```

### IndexedDB Check
```javascript
// Check offline data
const cache = new OfflineOrderCache();
cache.getCachedOrders().then(orders => {
    console.log('Cached orders:', orders.length);
});
cache.getPendingTransactions().then(pending => {
    console.log('Pending syncs:', pending.length);
});
```

## 📱 Post-Deployment

### User Training
- [ ] Create user guide
- [ ] Train staff on installation
- [ ] Explain offline mode
- [ ] Show sync indicators
- [ ] Demonstrate troubleshooting

### Monitoring
- [ ] Set up error logging
- [ ] Monitor sync failures
- [ ] Track installation rate
- [ ] Check performance metrics
- [ ] Review user feedback

### Maintenance
- [ ] Schedule regular updates
- [ ] Monitor cache size
- [ ] Clear old data periodically
- [ ] Update service worker version
- [ ] Test after updates

## 🐛 Common Issues & Fixes

### Issue: Install button doesn't appear
**Fix**: 
- Verify HTTPS is enabled
- Check manifest.json is accessible
- Ensure all icons exist
- Clear browser cache

### Issue: Offline mode not working
**Fix**:
- Check service worker registered
- Verify IndexedDB enabled
- Load page once while online
- Check browser console for errors

### Issue: Sync not happening
**Fix**:
- Verify internet connection
- Check Supabase credentials
- Review RLS policies
- Check pending transactions queue

### Issue: Old version still showing
**Fix**:
- Increment cache version in SW
- Unregister old service worker
- Clear browser cache
- Hard reload (Ctrl+Shift+R)

## 📊 Success Metrics

- [ ] 90%+ installation rate among staff
- [ ] <2s page load time
- [ ] 100% offline functionality
- [ ] <1min sync time when online
- [ ] Zero data loss incidents

## 🔄 Update Process

1. Update cache version in `cashier-sw.js`
2. Make code changes
3. Test locally
4. Deploy files
5. Service worker auto-updates
6. Users prompted to reload
7. Verify update successful

---

**Deployment Date**: _____________  
**Deployed By**: _____________  
**Version**: 2.0.0  
**Next Review**: _____________
