/* HeyTools app service worker.
   Lives at the site root so its scope covers /app/ AND every tool folder.
   - Install: caches only the small app shell, so the app is ready fast.
   - The app then asks this worker (message 'precache-tools') to save every tool, font and library in the background.
   - Same-origin files: network first with a 3 second limit. On a slow or dead connection the saved copy is shown instead of waiting.
   - Fonts and libraries are shipped with the app. Nothing is fetched from Google or a CDN.
   - Everything else (speed tests, streams, APIs, range requests) goes straight to the network.
   Bump VERSION whenever the app shell or any tool implementation changes. */
const VERSION = 'heytools-app-v12';
const NETWORK_TIMEOUT_MS = 3000;

const TOOLS = [
  'background-removal', 'barcode-generate', 'calculator', 'compass', 'cyber-rush',
  'dice-roller', 'earth-zipcode', 'emulsion', 'image-compress', 'image-to-pdf-converter',
  'internet-speed', 'media-downloads', 'music-player', 'notes-to-do-list',
  'password-generator', 'recorder', 'scientific-calculator', 'video-loop',
  'video-player', 'word-counter', 'world-clock',
  'unit-converter', 'qr-scanner', 'spirit-level', 'json-formatter', 'color-picker',
  'expense-tracker', 'habit-tracker', 'focus-timer', 'geo-camera', 'alarm-clock',
  'flashlight', 'countdown-timers', 'water-tracker', 'sleep-calculator', 'breathing', 'tally-counter', 'split-bills', 'date-calculator', 'encoder-hash', 'markdown-editor', 'image-resizer', 'spin-wheel', 'typing-test'
];

const SHELL = [
  './app/',
  './app/index.html',
  './app/app.css',
  './app/app.js',
  './app/tools.js',
  './app/native.js',
  './app/fonts/inter.woff2',
  './tones.js',
  './heynotify.js',
  './track-config.js',
  './heytrack.js',
  './app/manifest.webmanifest',
  './install-prompt.js',
  './index.html',
  './privacy/',
  './fonts/fonts.css',
  './fonts/inter-400-normal.woff2',
  './fonts/inter-600-normal.woff2',
  './fonts/inter-700-normal.woff2',
  './app/icons/icon-192.png',
  './app/icons/icon-512.png',
  './app/icons/apple-touch-icon.png'
];

const ASSETS = [
  // fonts and libraries that tools use (saved in the background phase)
  './fonts/abril-fatface-400-normal.woff2',
  './fonts/alfa-slab-one-400-normal.woff2',
  './fonts/anton-400-normal.woff2',
  './fonts/archivo-black-400-normal.woff2',
  './fonts/bangers-400-normal.woff2',
  './fonts/bebas-neue-400-normal.woff2',
  './fonts/bricolage-grotesque-400-normal.woff2',
  './fonts/bricolage-grotesque-500-normal.woff2',
  './fonts/bricolage-grotesque-600-normal.woff2',
  './fonts/bricolage-grotesque-700-normal.woff2',
  './fonts/bricolage-grotesque-800-normal.woff2',
  './fonts/caveat-600-normal.woff2',
  './fonts/cinzel-400-normal.woff2',
  './fonts/cinzel-700-normal.woff2',
  './fonts/dancing-script-400-normal.woff2',
  './fonts/dancing-script-700-normal.woff2',
  './fonts/dm-mono-400-normal.woff2',
  './fonts/dm-mono-500-normal.woff2',
  './fonts/dm-sans-400-normal.woff2',
  './fonts/dm-sans-500-normal.woff2',
  './fonts/dm-sans-700-normal.woff2',
  './fonts/dm-serif-display-400-normal.woff2',
  './fonts/figtree-400-normal.woff2',
  './fonts/figtree-500-normal.woff2',
  './fonts/figtree-600-normal.woff2',
  './fonts/figtree-700-normal.woff2',
  './fonts/fonts.css',
  './fonts/fredoka-400-normal.woff2',
  './fonts/fredoka-600-normal.woff2',
  './fonts/great-vibes-400-normal.woff2',
  './fonts/ibm-plex-mono-400-normal.woff2',
  './fonts/ibm-plex-mono-500-normal.woff2',
  './fonts/ibm-plex-sans-400-normal.woff2',
  './fonts/ibm-plex-sans-500-normal.woff2',
  './fonts/ibm-plex-sans-600-normal.woff2',
  './fonts/im-fell-english-400-italic.woff2',
  './fonts/im-fell-english-400-normal.woff2',
  './fonts/instrument-sans-400-normal.woff2',
  './fonts/instrument-sans-500-normal.woff2',
  './fonts/instrument-sans-600-normal.woff2',
  './fonts/inter-400-normal.woff2',
  './fonts/inter-500-normal.woff2',
  './fonts/inter-600-normal.woff2',
  './fonts/inter-700-normal.woff2',
  './fonts/inter-800-normal.woff2',
  './fonts/jetbrains-mono-400-normal.woff2',
  './fonts/jetbrains-mono-500-normal.woff2',
  './fonts/jetbrains-mono-600-normal.woff2',
  './fonts/jetbrains-mono-700-normal.woff2',
  './fonts/jetbrains-mono-800-normal.woff2',
  './fonts/lobster-400-normal.woff2',
  './fonts/lora-500-normal.woff2',
  './fonts/lora-700-normal.woff2',
  './fonts/manrope-400-normal.woff2',
  './fonts/manrope-500-normal.woff2',
  './fonts/manrope-600-normal.woff2',
  './fonts/manrope-800-normal.woff2',
  './fonts/merriweather-400-normal.woff2',
  './fonts/merriweather-700-normal.woff2',
  './fonts/montserrat-400-normal.woff2',
  './fonts/montserrat-700-normal.woff2',
  './fonts/montserrat-800-normal.woff2',
  './fonts/nunito-400-normal.woff2',
  './fonts/nunito-600-normal.woff2',
  './fonts/nunito-700-normal.woff2',
  './fonts/nunito-800-normal.woff2',
  './fonts/orbitron-500-normal.woff2',
  './fonts/orbitron-700-normal.woff2',
  './fonts/orbitron-900-normal.woff2',
  './fonts/oswald-500-normal.woff2',
  './fonts/oswald-700-normal.woff2',
  './fonts/outfit-400-normal.woff2',
  './fonts/outfit-500-normal.woff2',
  './fonts/outfit-600-normal.woff2',
  './fonts/outfit-700-normal.woff2',
  './fonts/outfit-800-normal.woff2',
  './fonts/pacifico-400-normal.woff2',
  './fonts/permanent-marker-400-normal.woff2',
  './fonts/pirata-one-400-normal.woff2',
  './fonts/playfair-display-500-normal.woff2',
  './fonts/playfair-display-800-normal.woff2',
  './fonts/plus-jakarta-sans-300-normal.woff2',
  './fonts/plus-jakarta-sans-400-normal.woff2',
  './fonts/plus-jakarta-sans-500-normal.woff2',
  './fonts/plus-jakarta-sans-600-normal.woff2',
  './fonts/plus-jakarta-sans-700-normal.woff2',
  './fonts/plus-jakarta-sans-800-normal.woff2',
  './fonts/poppins-400-normal.woff2',
  './fonts/poppins-600-normal.woff2',
  './fonts/poppins-700-normal.woff2',
  './fonts/press-start-2p-400-normal.woff2',
  './fonts/rajdhani-500-normal.woff2',
  './fonts/rajdhani-600-normal.woff2',
  './fonts/rajdhani-700-normal.woff2',
  './fonts/raleway-400-normal.woff2',
  './fonts/raleway-700-normal.woff2',
  './fonts/righteous-400-normal.woff2',
  './fonts/roboto-slab-400-normal.woff2',
  './fonts/roboto-slab-700-normal.woff2',
  './fonts/satisfy-400-normal.woff2',
  './fonts/sora-400-normal.woff2',
  './fonts/sora-600-normal.woff2',
  './fonts/sora-700-normal.woff2',
  './fonts/sora-800-normal.woff2',
  './fonts/space-mono-400-normal.woff2',
  './fonts/space-mono-700-normal.woff2'
];
const LIBS = [
  './vendor/JsBarcode.all-3.11.6.min.js',
  './vendor/OrbitControls-r128.js',
  './vendor/fabric-5.3.0.min.js',
  './vendor/jspdf-2.5.1.umd.min.js',
  './vendor/jszip-3.10.1.min.js',
  './vendor/lucide-0.468.0.min.js',
  './vendor/qrcode-generator-1.4.4.js',
  './vendor/three-r128.min.js'
];

const TOOL_PAGES = TOOLS.map(t => './' + t + '/');

const CDN_HOSTS = [
  'cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'unpkg.com',
  'cdn.tailwindcss.com', 'fonts.googleapis.com', 'fonts.gstatic.com'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(VERSION)
      .then(cache => Promise.all(SHELL.map(url => cache.add(url).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

/* Background phase: save every tool page, font and library. Skipped when the person asked their browser to save data. */
async function precacheTools() {
  const cache = await caches.open(VERSION);
  const jobs = TOOL_PAGES.concat(LIBS, ASSETS);
  let i = 0;
  async function worker() {
    while (i < jobs.length) {
      const url = jobs[i++];
      try { if (!(await cache.match(url))) await cache.add(url); } catch (e) { /* offline or missing: try again next time */ }
    }
  }
  await Promise.all([worker(), worker(), worker()]);   // three at a time keeps the phone responsive
}

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('heytools-app-') && k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
  if (event.data === 'precache-tools') event.waitUntil(precacheTools());
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
  const fresh = fetch(req).then(res => {
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  });
  const hit = await cache.match(req, { ignoreSearch: true });
  if (!hit) {
    try { return await fresh; }
    catch (err) {
      if (req.mode === 'navigate') { const shell = await cache.match('./app/'); if (shell) return shell; }
      throw err;
    }
  }
  // A saved copy exists: wait for the network only briefly, then show the saved copy. The fetch keeps running and refreshes the cache.
  fresh.catch(() => {});
  return Promise.race([
    fresh,
    new Promise(resolve => setTimeout(() => resolve(hit), NETWORK_TIMEOUT_MS))
  ]).catch(() => hit);
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
