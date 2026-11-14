/* Card Archive offline application shell — no collection data is transmitted or cached here. */
const CACHE_NAME = 'card-archive-shell-v0412-dev3';
const APP_SHELL = ['./', './index.html', './style.css', './script.js', './manifest.webmanifest', './icon.svg', './apple-touch-icon.png', './icon-192.png', './icon-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('card-archive-shell-') && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(self.registration.scope.replace(self.location.origin, ''))) return;
  if (request.mode === 'navigate') {
    event.respondWith(caches.open(CACHE_NAME).then(async cache => {
      const saved = await cache.match('./index.html');
      if (saved) return saved;
      try { return await fetch(request); } catch { return Response.error(); }
    }));
    return;
  }
  const shellNames = new Set(['style.css','script.js','manifest.webmanifest','icon.svg','apple-touch-icon.png','icon-192.png','icon-512.png']);
  const name = url.pathname.split('/').pop();
  if (!shellNames.has(name)) return;
  event.respondWith(caches.open(CACHE_NAME).then(async cache => {
    const saved = await cache.match(new URL(name, self.registration.scope).toString(), {ignoreSearch:true});
    if (saved) return saved;
    return fetch(request);
  }));
});
