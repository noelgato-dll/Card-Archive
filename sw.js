/* Card Archive: network-first navigation with offline application-shell fallback. */
const CACHE_NAME = 'card-archive-shell-v0412-stable1';
const APP_SHELL = ['./', './index.html', './style.css', './script.js', './manifest.webmanifest', './icon.svg', './apple-touch-icon.png', './icon-192.png', './icon-512.png'];
const SHELL_FILES = new Set(['index.html','style.css','script.js','manifest.webmanifest','icon.svg','apple-touch-icon.png','icon-192.png','icon-512.png']);
const scopeURL = new URL(self.registration.scope);
function inScope(url) { return url.origin === scopeURL.origin && url.pathname.startsWith(scopeURL.pathname); }
async function cachedFallback(cache, request, filename) {
  return (await cache.match(request, {ignoreSearch:true})) || (await cache.match(new URL(filename, scopeURL).toString(), {ignoreSearch:true}));
}
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
  if (!inScope(url)) return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request);
        if (response.ok && response.type === 'basic') {
          await cache.put(new URL('index.html', scopeURL).toString(), response.clone()).catch(() => {});
        }
        return response;
      } catch (error) {
        const fallback = await cachedFallback(cache, request, 'index.html');
        return fallback || Response.error();
      }
    })());
    return;
  }
  const filename = url.pathname.split('/').pop();
  if (!SHELL_FILES.has(filename)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') await cache.put(new URL(filename, scopeURL).toString(), response.clone()).catch(() => {});
      return response;
    } catch (error) {
      return (await cachedFallback(cache, request, filename)) || Response.error();
    }
  })());
});
