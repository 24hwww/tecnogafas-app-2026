importScripts('https://storage.googleapis.com/workbox-cdn/releases/5.1.2/workbox-sw.js');
const l = 'tecnogafas-v2',
  d = 'tecnogafas-sync';
function i() {
  return new Promise((e, n) => {
    const t = indexedDB.open(d, 2);
    (t.onupgradeneeded = (s) => {
      const a = s.target.result;
      a.objectStoreNames.contains('pending-orders') ||
        a.createObjectStore('pending-orders', { keyPath: 'id' }),
        a.objectStoreNames.contains('config') || a.createObjectStore('config', { keyPath: 'key' });
    }),
      (t.onsuccess = (s) => e(s.target.result)),
      (t.onerror = (s) => n(s.target.error));
  });
}
async function f(e) {
  (await i())
    .transaction('config', 'readwrite')
    .objectStore('config')
    .put({ key: 'pin', value: e });
}
async function g() {
  const e = await i();
  return new Promise((n) => {
    const t = e.transaction('config', 'readonly').objectStore('config').get('pin');
    t.onsuccess = () => n(t.result ? t.result.value : null);
  });
}
self.addEventListener('message', (e) => {
  e.data && e.data.type === 'SKIP_WAITING'
    ? self.skipWaiting()
    : e.data && e.data.type === 'CLEAR_ALL_CACHES'
      ? e.waitUntil(
          caches
            .keys()
            .then((n) => Promise.all(n.map((t) => caches.delete(t))))
            .then(() => indexedDB.deleteDatabase(d)),
        )
      : e.data && e.data.type === 'START_POLLING'
        ? (e.data.pin && f(e.data.pin), c())
        : e.data && e.data.type === 'APP_ACTIVE'
          ? u()
          : e.data && e.data.type === 'APP_INACTIVE' && c();
});
async function p() {
  const t = (await i()).transaction('pending-orders', 'readwrite').objectStore('pending-orders'),
    s = await new Promise((a) => {
      const o = t.getAll();
      o.onsuccess = () => a(o.result);
    });
  for (const a of s)
    try {
      const o = await fetch(a.url, { method: 'POST', headers: a.headers, body: a.body });
      o.ok
        ? t.delete(a.id)
        : o.status >= 400 &&
          o.status < 500 &&
          (console.error('Client error, dropping request:', a.id), t.delete(a.id));
    } catch {
      console.error('Network error during sync, will retry:', a.id);
    }
}
let r = null;
async function c() {
  if (r) return;
  const e = await g();
  e &&
    (r = setInterval(async () => {
      try {
        const n = await fetch('https://api.tecnogafas.com.ar/events/unread', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${e}` },
        });
        if (n.ok) {
          const t = await n.json();
          t.unread > 0 &&
            self.registration.showNotification('Tecnogafas', {
              body: `Tienes ${t.unread} notificación(es) pendiente(s)`,
              icon: '/icon.png',
              tag: 'unread-events',
            });
        }
      } catch (n) {
        console.error('Polling error', n);
      }
    }, 6e4));
}
function u() {
  r && (clearInterval(r), (r = null));
}
self.addEventListener('install', (e) => e.waitUntil(caches.open(l).then((n) => n.add('/'))));
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('sync', (e) => {
  e.tag === 'sync-orders' && e.waitUntil(p());
});
