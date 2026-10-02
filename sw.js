/* V-SHAPE — service worker
   Mude CACHE a cada publicação: é o que faz o celular pegar a versão nova.
*/
var CACHE = 'vshape-v2.0.0';

var ARQUIVOS = [
  './',
  './index.html',
  './app.css',
  './app.js',
  './treinos.js',
  './manifest.json'
];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      // addAll falha inteiro se um arquivo faltar; aqui cada um é opcional
      return Promise.all(ARQUIVOS.map(function (u) {
        return c.add(u).catch(function () {});
      }));
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (nomes) {
      return Promise.all(nomes.map(function (n) {
        if (n !== CACHE) return caches.delete(n);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

/* rede primeiro, cache como reserva — evita ficar preso numa versão antiga */
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  e.respondWith(
    fetch(e.request).then(function (res) {
      var copia = res.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copia); });
      return res;
    }).catch(function () {
      return caches.match(e.request).then(function (r) {
        return r || caches.match('./index.html');
      });
    })
  );
});
