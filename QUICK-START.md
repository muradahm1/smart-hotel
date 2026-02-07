# 🚀 Quick Start - RAMZ Cashier PWA

## Step 1: Generate Icons (2 minutes)

1. Open in browser: `src/assets/images/icon-generator.html`
2. Click "Download 192x192" → Save to `src/assets/images/icon-192.png`
3. Click "Download 512x512" → Save to `src/assets/images/icon-512.png`

## Step 2: Verify Files Are in Place

```
✅ /cashier-sw.js
✅ /cashier-manifest.json
✅ /src/pages/cashier.html
✅ /src/assets/js/offline-cache.js
✅ /src/assets/js/cashier-simple.js
✅ /src/assets/images/icon-192.png
✅ /src/assets/images/icon-512.png
```

## Step 3: Deploy to Server

Upload all files maintaining the folder structure. **HTTPS is required!**

## Step 4: Test Installation

1. Open: `https://your-domain.com/src/pages/cashier.html`
2. Look for "Install App" button
3. Click to install
4. App opens in standalone window

## Step 5: Test Offline Mode

1. Open installed app
2. Turn off WiFi/Internet
3. App should still work
4. Process a payment (saved locally)
5. Turn WiFi back on
6. Watch it auto-sync

## ✅ Done!

Your PWA is ready. Staff can now:
- Install on any device
- Work offline
- Auto-sync when online
- Get fast, native-like experience

## 🆘 Troubleshooting

**No install button?**
- Check HTTPS is enabled
- Verify icons exist
- Clear browser cache

**Offline not working?**
- Load page once while online first
- Check browser console for errors

**Need help?**
- See `PWA-GUIDE.md` for detailed instructions
- See `PWA-DEPLOYMENT.md` for full checklist
