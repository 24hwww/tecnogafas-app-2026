// Public Service Worker
importScripts('https://storage.googleapis.com/workbox-cdn/releases/5.1.2/workbox-sw.js');

const CACHE_NAME = 'tecnogafas-v2';
const CACHE = "pwabuilder-page";
const DB_NAME = 'tecnogafas-sync';
const offlineFallbackPage = "offline.html";

function getDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('pending-orders')) {
        db.createObjectStore('pending-orders', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('config')) {
        db.createObjectStore('config', { keyPath: 'key' });
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

async function savePin(pin) {
  const db = await getDB();
  const tx = db.transaction('config', 'readwrite');
  tx.objectStore('config').put({ key: 'pin', value: pin });
}

async function getPin() {
  const db = await getDB();
  return new Promise(resolve => {
    const req = db.transaction('config', 'readonly').objectStore('config').get('pin');
    req.onsuccess = () => resolve(req.result ? req.result.value : null);
  });
}

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  } else if (event.data && event.data.type === "CLEAR_ALL_CACHES") {
    event.waitUntil(
      caches.keys().then((cacheNames) => Promise.all(cacheNames.map(c => caches.delete(c))))
        .then(() => indexedDB.deleteDatabase(DB_NAME))
    );
  } else if (event.data && event.data.type === 'START_POLLING') {
    if (event.data.pin) savePin(event.data.pin);
    startPolling();
  } else if (event.data && event.data.type === 'APP_ACTIVE') {
    stopPolling();
  } else if (event.data && event.data.type === 'APP_INACTIVE') {
    startPolling();
  }
});

async function syncOrders() {
  const db = await getDB();
  const tx = db.transaction('pending-orders', 'readwrite');
  const store = tx.objectStore('pending-orders');
  
  const pendingRequests = await new Promise((resolve) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
  });

  for (const req of pendingRequests) {
    try {
      const response = await fetch(req.url, {
        method: 'POST',
        headers: req.headers,
        body: req.body
      });
      
      if (response.ok) {
        store.delete(req.id);
      } else if (response.status >= 400 && response.status < 500) {
        console.error('Client error, dropping request:', req.id);
        store.delete(req.id);
      }
    } catch (error) {
      console.error('Network error during sync, will retry:', req.id);
    }
  }
}

let pollingInterval = null;

async function startPolling() {
  if (pollingInterval) return;
  const pin = await getPin();
  if (!pin) return;

  pollingInterval = setInterval(async () => {
    try {
      const response = await fetch('https://api.tecnogafas.com.ar/events/unread', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${pin}` }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.unread > 0) {
          self.registration.showNotification('Tecnogafas', {
            body: `Tienes ${data.unread} notificación(es) pendiente(s)`,
            icon: '/icon.png',
            tag: 'tecnogafas-events', // Tag único para sobrescribir
            renotify: true
          });
        }
      }
    } catch (e) { console.error('Polling error', e); }
  }, 60000);
}
  }, 60000);
}

function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

// Re-register existing listeners...
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE_NAME).then(c => c.add('/'))));
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('sync', (e) => { if (e.tag === 'sync-orders') e.waitUntil(syncOrders()); });


