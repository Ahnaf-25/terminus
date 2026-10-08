/* Terminus service worker.
   Precaches the whole app so it opens with no network. Files are served from the cache first and refreshed in the
   background; a new version (new cache name) replaces the old one the next time the app is opened online. */
const CACHE = 'fe-9b218d2b61';
const ANSWERS = 'fe-answers';   // model answers: content-hashed files, kept across app updates
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
  "js/views-answers.js",
  "js/views-courses.js",
  "js/views-more.js",
  "js/views-questions.js",
  "js/views-today.js",
  "manifest.webmanifest",
  "vendor/katex/LICENSE",
  "vendor/katex/fonts/KaTeX_AMS-Regular.woff2",
  "vendor/katex/fonts/KaTeX_Caligraphic-Bold.woff2",
  "vendor/katex/fonts/KaTeX_Caligraphic-Regular.woff2",
  "vendor/katex/fonts/KaTeX_Fraktur-Bold.woff2",
  "vendor/katex/fonts/KaTeX_Fraktur-Regular.woff2",
  "vendor/katex/fonts/KaTeX_Main-Bold.woff2",
  "vendor/katex/fonts/KaTeX_Main-BoldItalic.woff2",
  "vendor/katex/fonts/KaTeX_Main-Italic.woff2",
  "vendor/katex/fonts/KaTeX_Main-Regular.woff2",
  "vendor/katex/fonts/KaTeX_Math-BoldItalic.woff2",
  "vendor/katex/fonts/KaTeX_Math-Italic.woff2",
  "vendor/katex/fonts/KaTeX_SansSerif-Bold.woff2",
  "vendor/katex/fonts/KaTeX_SansSerif-Italic.woff2",
  "vendor/katex/fonts/KaTeX_SansSerif-Regular.woff2",
  "vendor/katex/fonts/KaTeX_Script-Regular.woff2",
  "vendor/katex/fonts/KaTeX_Size1-Regular.woff2",
  "vendor/katex/fonts/KaTeX_Size2-Regular.woff2",
  "vendor/katex/fonts/KaTeX_Size3-Regular.woff2",
  "vendor/katex/fonts/KaTeX_Size4-Regular.woff2",
  "vendor/katex/fonts/KaTeX_Typewriter-Regular.woff2",
  "vendor/katex/katex.min.css",
  "vendor/katex/katex.min.js"
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('fe-') && k !== CACHE && k !== PAPERS && k !== ANSWERS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.indexOf('/answers/') >= 0) {
    e.respondWith(caches.open(ANSWERS).then(async (cache) => {
      const hit = await cache.match(req);
      if (hit) return hit;
      try { const res = await fetch(req); if (res && res.ok) e.waitUntil(cache.put(req, res.clone())); return res; } catch (err) { return Response.error(); }
    }));
    return;
  }
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
