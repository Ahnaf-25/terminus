/* Terminus service worker.
   Precaches the whole app so it opens with no network. Files are served from the cache first and refreshed in the
   background; a new version (new cache name) replaces the old one the next time the app is opened online. */
const CACHE = 'fe-d863997e74';
const PAPERS = 'fe-papers-fb9fd4e6';   // scanned past-paper pages: cached as they are opened, or all at once from More
const ASSETS = [
  "./",
  "css/app.css",
  "data/plan.js",
  "fonts/AnekLatin-wdth-wght.woff2",
  "fonts/MartianMono-wdth-wght.woff2",
  "icons/apple-touch-icon.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "icons/icon.svg",
  "index.html",
  "js/app.js",
  "js/core.js",
  "js/store.js",
  "js/tear.js",
  "js/ui.js",
  "js/views-courses.js",
  "js/views-more.js",
  "js/views-questions.js",
  "js/views-today.js",
  "manifest.webmanifest"
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('fe-') && k !== CACHE && k !== PAPERS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.indexOf('/papers/') >= 0) {
    e.respondWith(caches.open(PAPERS).then(async (cache) => {
      const hit = await cache.match(req);
      if (hit) return hit;
      try { const res = await fetch(req); if (res && res.ok) e.waitUntil(cache.put(req, res.clone())); return res; } catch (err) { return Response.error(); }
    }));
    return;
  }
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const hit = await cache.match(req, { ignoreSearch: true });
    const net = fetch(req).then((res) => { if (res && res.ok && res.type === 'basic') cache.put(req, res.clone()); return res; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    const res = await net;
    if (res) return res;
    if (req.mode === 'navigate') return (await cache.match('./')) || (await cache.match('index.html')) || Response.error();
    return Response.error();
  }));
});
