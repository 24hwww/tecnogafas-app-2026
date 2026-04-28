// Public Service Worker
const CACHE_NAME = 'tecnogafas-v1';

// Helper: Open IndexedDB
function getDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('tecnogafas-sync', 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('pending-orders')) {
        db.createObjectStore('pending-orders', { keyPath: 'id' });
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(['/']);
    })
  );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-orders') {
    event.waitUntil(syncOrders());
  }
});

async function syncOrders() {
  const db = await getDB();
  const tx = db.transaction('pending-orders', 'readonly');
  const store = tx.objectStore('pending-orders');
  
  const pendingRequests = await new Promise((resolve) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
  });

  for (const req of (pendingRequests)) {
    try {
      const response = await fetch(req.url, {
        method: 'POST',
        headers: req.headers,
        body: req.body
      });
      
      if (response.ok) {
        // Remove from IDB
        const txDel = db.transaction('pending-orders', 'readwrite');
        txDel.objectStore('pending-orders').delete(req.id);
        await new Promise((resolve) => txDel.oncomplete = resolve);
        console.log('Order synced successfully:', req.id);
      } else {
        console.error('Failed to sync order:', req.id, response.statusText);
      }
    } catch (error) {
      console.error('Network error during sync:', error);
      // Keep in queue for next retry
    }
  }
}

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data.json();
  } catch (e) {
    data = { title: 'TecnoGafas', body: event.data.text() };
  }
  
  const options = {
    body: data.body || 'Tienes una nueva actualización',
    icon: '/icon.png',
    badge: '/icon.png'
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'TecnoGafas', options)
  );
});

