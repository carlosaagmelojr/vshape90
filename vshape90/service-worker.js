/* ============================================================
   V-SHAPE 90 — service-worker.js
   Cache do app shell para funcionamento 100% offline após 1º acesso
   ============================================================ */

const CACHE_NAME = 'vshape90-cache-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/storage.js',
  './js/charts.js',
  './js/workouts.js',
  './js/running.js',
  './js/recovery.js',
  './js/app.js',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* Estratégia: cache primeiro, com atualização em segundo plano (stale-while-revalidate) */
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      const fetchPromise = fetch(event.request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return networkResponse;
      }).catch(() => cached); // offline: usa o cache se a rede falhar

      return cached || fetchPromise;
    })
  );
});
