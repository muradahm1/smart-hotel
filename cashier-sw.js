const CACHE_VERSION = 'v2.0.0';
const CACHE_NAME = `ramz-cashier-${CACHE_VERSION}`;
const DATA_CACHE = `ramz-data-${CACHE_VERSION}`;

const ASSETS_TO_CACHE = [
  '/src/pages/cashier.html',
  '/src/assets/css/style.css',
  '/src/assets/css/cashier.css',
  '/src/assets/js/config-public.js',
  '/src/assets/js/supabase.js',
  '/src/assets/js/offline-cache.js',
  '/src/assets/js/cashier-simple.js',
  '/favicon.ico'
];

// Install - cache assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching app shell');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && cacheName !== DATA_CACHE) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch - network first for API, cache first for assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API requests - network first with cache fallback
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache successful GET requests
          if (request.method === 'GET' && response.status === 200) {
            const responseClone = response.clone();
            caches.open(DATA_CACHE).then(cache => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Return cached data if offline
          return caches.match(request);
        })
    );
    return;
  }

  // Static assets - cache first
  event.respondWith(
    caches.match(request)
      .then(response => response || fetch(request))
      .catch(() => caches.match('/src/pages/cashier.html'))
  );
});

// Background sync for offline orders
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-orders') {
    event.waitUntil(syncOfflineOrders());
  }
});

async function syncOfflineOrders() {
  const cache = await caches.open(DATA_CACHE);
  const requests = await cache.keys();
  
  for (const request of requests) {
    if (request.method === 'POST' || request.method === 'PUT') {
      try {
        await fetch(request.clone());
        await cache.delete(request);
      } catch (error) {
        console.log('[SW] Sync failed, will retry:', error);
      }
    }
  }
}

// Push notifications for new orders
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const options = {
    body: data.body || 'New order ready!',
    icon: '/src/assets/images/icon-192.png',
    badge: '/src/assets/images/icon-192.png',
    vibrate: [200, 100, 200],
    tag: 'order-notification',
    requireInteraction: true
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'RAMZ Cashier', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/src/pages/cashier.html')
  );
});