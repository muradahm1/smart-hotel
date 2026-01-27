// RAMZ Cashier Service Worker
// Handles offline functionality, caching, and background sync

const CACHE_NAME = 'ramz-cashier-v1.0.0';
const OFFLINE_URL = '/src/pages/cashier.html';

// Files to cache for offline use
const CACHE_FILES = [
    '/src/pages/cashier.html',
    '/src/assets/css/style.css',
    '/src/assets/css/cashier.css',
    '/src/assets/js/cashier.js',
    '/src/assets/js/supabase.js',
    '/src/assets/js/config.js',
    '/cashier-manifest.json',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Inter:wght@300;400;600&display=swap'
];

// Install event - cache resources
self.addEventListener('install', event => {
    console.log('Cashier SW: Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Cashier SW: Caching files');
                return cache.addAll(CACHE_FILES);
            })
            .then(() => {
                console.log('Cashier SW: Installed successfully');
                return self.skipWaiting();
            })
            .catch(error => {
                console.error('Cashier SW: Installation failed', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    console.log('Cashier SW: Activating...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME && cacheName.startsWith('ramz-cashier-')) {
                        console.log('Cashier SW: Deleting old cache', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('Cashier SW: Activated successfully');
            return self.clients.claim();
        })
    );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', event => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    // Handle Supabase API requests
    if (event.request.url.includes('supabase.co')) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // Store successful responses for offline access
                    if (response.ok) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME + '-api').then(cache => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    // Return cached API response if available
                    return caches.match(event.request);
                })
        );
        return;
    }

    // Handle other requests with cache-first strategy
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Return cached version if available
                if (response) {
                    return response;
                }

                // Fetch from network
                return fetch(event.request)
                    .then(response => {
                        // Don't cache non-successful responses
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        // Cache successful responses
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, responseToCache);
                        });

                        return response;
                    })
                    .catch(() => {
                        // Return offline page for navigation requests
                        if (event.request.mode === 'navigate') {
                            return caches.match(OFFLINE_URL);
                        }
                    });
            })
    );
});

// Background sync for offline transactions
self.addEventListener('sync', event => {
    console.log('Cashier SW: Background sync triggered', event.tag);
    
    if (event.tag === 'sync-transactions') {
        event.waitUntil(syncOfflineTransactions());
    }
});

// Sync offline transactions when connection is restored
async function syncOfflineTransactions() {
    try {
        console.log('Cashier SW: Syncing offline transactions...');
        
        // Get offline transactions from IndexedDB
        const offlineTransactions = await getOfflineTransactions();
        
        if (offlineTransactions.length === 0) {
            console.log('Cashier SW: No offline transactions to sync');
            return;
        }

        // Send each transaction to server
        for (const transaction of offlineTransactions) {
            try {
                await syncTransaction(transaction);
                await removeOfflineTransaction(transaction.id);
                console.log('Cashier SW: Synced transaction', transaction.id);
            } catch (error) {
                console.error('Cashier SW: Failed to sync transaction', transaction.id, error);
            }
        }

        // Notify clients about sync completion
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
            client.postMessage({
                type: 'SYNC_COMPLETE',
                synced: offlineTransactions.length
            });
        });

    } catch (error) {
        console.error('Cashier SW: Background sync failed', error);
    }
}

// Helper functions for IndexedDB operations
async function getOfflineTransactions() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('ramz-cashier-db', 1);
        
        request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction(['offline_transactions'], 'readonly');
            const store = transaction.objectStore('offline_transactions');
            const getAll = store.getAll();
            
            getAll.onsuccess = () => resolve(getAll.result);
            getAll.onerror = () => reject(getAll.error);
        };
        
        request.onerror = () => reject(request.error);
    });
}

async function syncTransaction(transaction) {
    const response = await fetch('/api/sync-transaction', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(transaction)
    });
    
    if (!response.ok) {
        throw new Error(`Sync failed: ${response.status}`);
    }
    
    return response.json();
}

async function removeOfflineTransaction(id) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('ramz-cashier-db', 1);
        
        request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction(['offline_transactions'], 'readwrite');
            const store = transaction.objectStore('offline_transactions');
            const deleteRequest = store.delete(id);
            
            deleteRequest.onsuccess = () => resolve();
            deleteRequest.onerror = () => reject(deleteRequest.error);
        };
        
        request.onerror = () => reject(request.error);
    });
}

// Handle messages from main thread
self.addEventListener('message', event => {
    console.log('Cashier SW: Received message', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'CACHE_TRANSACTION') {
        // Cache transaction for offline sync
        cacheOfflineTransaction(event.data.transaction);
    }
});

// Cache transaction for offline sync
async function cacheOfflineTransaction(transaction) {
    try {
        const request = indexedDB.open('ramz-cashier-db', 1);
        
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains('offline_transactions')) {
                db.createObjectStore('offline_transactions', { keyPath: 'id' });
            }
        };
        
        request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction(['offline_transactions'], 'readwrite');
            const store = tx.objectStore('offline_transactions');
            store.add({
                ...transaction,
                timestamp: Date.now(),
                synced: false
            });
        };
    } catch (error) {
        console.error('Cashier SW: Failed to cache offline transaction', error);
    }
}