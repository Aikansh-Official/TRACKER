const CACHE = 'tracker-shell-v2';
const SHELL = ['/', '/manifest.webmanifest'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL))));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('tracker-shell-') && key !== CACHE).map(key => caches.delete(key))))));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  const navigation = event.request.mode === 'navigate';
  const asset = url.pathname.startsWith('/assets/');
  if (!navigation && !asset) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // Content-hashed assets are immutable. API data is never cached here.
    if (asset) { const cached = await cache.match(event.request); if (cached) return cached; }
    try {
      const response = await fetch(event.request);
      if (response.ok) await cache.put(navigation ? '/' : event.request, response.clone());
      return response;
    } catch {
      // Missing scripts must not receive HTML, which causes blank-screen errors.
      return (await cache.match(navigation ? '/' : event.request)) || Response.error();
    }
  })());
});
