// Enkel offline-støtte: legg alle filene i hurtiglageret ved installasjon.
const CACHE = 'strikketeller-v2';
const FILES = [
  './',
  'index.html',
  'style.css',
  'app.js',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

// Nett først, så du alltid får nyeste versjon; hurtiglageret brukes når du er offline.
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.open(CACHE).then(cache =>
      fetch(event.request, { cache: 'no-cache' })
        .then(res => {
          if (res.ok && new URL(event.request.url).origin === location.origin) {
            cache.put(event.request, res.clone());
          }
          return res;
        })
        .catch(() => cache.match(event.request, { ignoreSearch: true }))
    )
  );
});
