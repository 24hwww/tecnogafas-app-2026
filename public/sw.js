// Public Service Worker
importScripts('https://storage.googleapis.com/workbox-cdn/releases/5.1.2/workbox-sw.js');

const CACHE_NAME = 'tecnogafas-v1';
const CACHE = "pwabuilder-page";
const offlineFallbackPage = "offline.html";

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

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(['/']);
    })
  );
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.add(offlineFallbackPage))
  );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

if (workbox.navigationPreload.isSupported()) {
  workbox.navigationPreload.enable();
}

self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const preloadResp = await event.preloadResponse;

        if (preloadResp) {
          return preloadResp;
        }

        const networkResp = await fetch(event.request);
        return networkResp;
      } catch (error) {
        const cache = await caches.open(CACHE);
        const cachedResp = await cache.match(offlineFallbackPage);
        return cachedResp;
      }
    })());
  }
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
    data = { title: 'Tecnogafas', body: event.data.text() };
  }
  
  const options = {
    body: data.body || 'Tienes una nueva actualización',
    icon: '/icon.png',
    badge: '/icon.png'
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'Tecnogafas', options)
  );
});

// Polling para verificar eventos no leídos en background
// Nota: EventSource no está disponible en service workers, usamos polling
// Solo activo cuando la app está en background (SSE no está activo)
let pollingInterval = null;
let isAppActive = false;

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'START_POLLING') {
    if (!isAppActive) {
      startPolling(event.data.pin);
    }
  } else if (event.data && event.data.type === 'STOP_POLLING') {
    stopPolling();
  } else if (event.data && event.data.type === 'APP_ACTIVE') {
    isAppActive = true;
    stopPolling(); // Detener polling cuando la app está activa (SSE maneja esto)
  } else if (event.data && event.data.type === 'APP_INACTIVE') {
    isAppActive = false;
    // Reiniciar polling cuando la app se vuelve inactiva
    if (event.data.pin) {
      startPolling(event.data.pin);
    }
  }
});

function startPolling(pin) {
  if (pollingInterval) return;
  
  pollingInterval = setInterval(async () => {
    try {
      const response = await fetch('https://api.tecnogafas.com.ar/events/unread', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${pin}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.unread > 0) {
          // Mostrar notificación de eventos pendientes
          self.registration.showNotification('Tecnogafas', {
            body: `Tienes ${data.unread} notificación(es) pendiente(s)`,
            icon: '/icon.png',
            badge: '/icon.png',
            tag: 'unread-events',
            requireInteraction: true
          });
        }
      }
    } catch (error) {
      console.error('Error polling events:', error);
    }
  }, 60000); // Verificar cada minuto
}

function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

