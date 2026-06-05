// Offline Order Cache Manager
class OfflineOrderCache {
    constructor() {
        this.dbName = 'ramz-cashier-db';
        this.version = 1;
        this.db = null;
        this.init();
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                console.log('📦 IndexedDB initialized');
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Orders store
                if (!db.objectStoreNames.contains('orders')) {
                    const ordersStore = db.createObjectStore('orders', { keyPath: 'id' });
                    ordersStore.createIndex('status', 'status', { unique: false });
                    ordersStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
                
                // Pending transactions store
                if (!db.objectStoreNames.contains('pendingTransactions')) {
                    db.createObjectStore('pendingTransactions', { keyPath: 'id', autoIncrement: true });
                }
                
                // Menu items cache
                if (!db.objectStoreNames.contains('menuItems')) {
                    db.createObjectStore('menuItems', { keyPath: 'id' });
                }
                
                console.log('📦 Database schema created');
            };
        });
    }

    async cacheOrder(order) {
        if (!this.db) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['orders'], 'readwrite');
            const store = transaction.objectStore('orders');
            const request = store.put({
                ...order,
                timestamp: Date.now(),
                cached: true
            });
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getCachedOrders(status = 'ready') {
        if (!this.db) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['orders'], 'readonly');
            const store = transaction.objectStore('orders');
            const index = store.index('status');
            const request = index.getAll(status);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async removeOrder(orderId) {
        if (!this.db) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['orders'], 'readwrite');
            const store = transaction.objectStore('orders');
            const request = store.delete(orderId);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async cachePendingTransaction(transaction) {
        if (!this.db) await this.init();
        
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['pendingTransactions'], 'readwrite');
            const store = tx.objectStore('pendingTransactions');
            const request = store.add({
                ...transaction,
                timestamp: Date.now(),
                synced: false
            });
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getPendingTransactions() {
        if (!this.db) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['pendingTransactions'], 'readonly');
            const store = transaction.objectStore('pendingTransactions');
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async removePendingTransaction(id) {
        if (!this.db) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['pendingTransactions'], 'readwrite');
            const store = transaction.objectStore('pendingTransactions');
            const request = store.delete(id);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async cacheMenuItems(items) {
        if (!this.db) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['menuItems'], 'readwrite');
            const store = transaction.objectStore('menuItems');
            
            items.forEach(item => store.put(item));
            
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    }

    async getCachedMenuItems() {
        if (!this.db) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['menuItems'], 'readonly');
            const store = transaction.objectStore('menuItems');
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async syncPendingTransactions() {
        const pending = await this.getPendingTransactions();
        const synced = [];
        
        for (const transaction of pending) {
            try {
                if (navigator.onLine && window.supabaseClient) {
                    // Strip IndexedDB-only fields before sending to Supabase
                    const { id, timestamp, synced: _, cached, ...supabaseData } = transaction;
                    
                    const { error } = await supabaseClient
                        .from('transactions')
                        .insert([supabaseData]);
                    
                    if (!error) {
                        await this.removePendingTransaction(transaction.id);
                        synced.push(transaction.id);
                    }
                }
            } catch (error) {
                console.warn('Sync failed for transaction:', transaction.id, error);
            }
        }
        
        return synced;
    }

    async clearOldCache(daysOld = 7) {
        if (!this.db) await this.init();
        
        const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['orders'], 'readwrite');
            const store = transaction.objectStore('orders');
            const index = store.index('timestamp');
            const request = index.openCursor();
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    if (cursor.value.timestamp < cutoffTime) {
                        cursor.delete();
                    }
                    cursor.continue();
                } else {
                    resolve();
                }
            };
            
            request.onerror = () => reject(request.error);
        });
    }
}

// Export for use in cashier-simple.js
window.OfflineOrderCache = OfflineOrderCache;
