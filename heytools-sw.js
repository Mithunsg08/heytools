/* HeyTools app service worker.
   Lives at the site root so its scope covers /app/ AND every tool folder.
   - Pre-caches the app shell and all tool pages so the app opens offline.
   - Same-origin files: network first (updates show up), cache as offline fallback.
   - Common CDN libraries and fonts: stale-while-revalidate.
   - Everything else (speed tests, streams, APIs, range requests) goes straight to the network.
   Bump VERSION whenever you add or rename a tool. */
const VERSION = 'heytools-app-v1';

const TOOLS = [
  'background-removal', 'barcode-generate', 'calculator', 'compass', 'cyber-rush',
  'dice-roller', 'earth-zipcode', 'emulsion', 'image-compress', 'image-to-pdf-converter',
  'internet-speed', 'media-downloads', 'music-player', 'notes-to-do-list',
  'password-generator', 'recorder', 'scientific-calculator', 'video-loop',
  'video-player', 'word-counter', 'world-clock'
];

const SHELL = [
  './app/',
  './app/index.html',
  './app/manifest.webmanifest',
  './app/icons/icon-192.png',
  './app/icons/icon-512.png',
  './app/icons/apple-touch-icon.png'
];

const PRECACHE = SHELL.concat(TOOLS.map(t => './' + t + '/'));

const CDN_HOSTS = [
  'cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'unpkg.com',
  'cdn.tailwindcss.com', 'fonts.googleapis.com', 'fonts.gstatic.com'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(VERSION)
      .then(cache => Promise.all(PRECACHE.map(url => cache.add(url).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('heytools-app-') && k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;

  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(req));
  } else if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(req));
  }
});

async function networkFirst(req) {
  const cache = await caches.open(VERSION);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') {
      const shell = await cache.match('./app/');
      if (shell) return shell;
    }
    throw err;
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req);
  const refresh = fetch(req)
    .then(res => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);
  return hit || (await refresh) || Response.error();
}
