// Offline-first service worker. Bump VERSION when files change.
const VERSION = 'ragefighter-v1';
const FILES = [
  './', './index.html', './style.css', './manifest.webmanifest',
  './js/game.js', './js/fighter.js', './js/characters.js', './js/render.js', './js/input.js', './js/audio.js', './js/ai.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).then((res) => {
      if (res.ok && new URL(e.request.url).origin === location.origin) {
        const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
