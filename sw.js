const CACHE_NAME = 'bp26-v1';
const CORE_ASSETS = [
  './',
  './index.html',
  './budapest-logo.svg',
  './manifest.json'
];

// Install — cache core assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate — clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — cache-first for core + images, network-first for everything else
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Cache-first for same-origin assets (HTML, SVG, manifest)
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        // Return cached, but also update cache in background (stale-while-revalidate)
        const fetchPromise = fetch(e.request).then(response => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          }
          return response;
        }).catch(() => null);

        return cached || fetchPromise;
      })
    );
    return;
  }

  // For external resources (Wikimedia images) — cache-first, fallback to network
  if (url.hostname.includes('wikimedia.org') || url.hostname.includes('wikipedia.org')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(response => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          }
          return response;
        }).catch(() => new Response('', { status: 408 }));
      })
    );
    return;
  }

  // Everything else — network only (Google Maps links etc.)
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
