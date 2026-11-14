/* HeyTools install prompt.
   Add to any page with:  <script src="../install-prompt.js" defer></script>   (use "install-prompt.js" on the home page)

   - Shows a small "Install HeyTools app" button when the page is open in a normal browser tab.
   - Stays hidden inside the installed app, and inside the app's own frames.
   - Links the app manifest and registers the offline service worker so the browser offers installation
     from any page, not just /app/.
   - Dismissible; stays hidden for 7 days after the person closes it.
   - iPhone/iPad (no install API): the button opens the app page, which shows how to add it to the Home Screen. */
(function () {
  'use strict';
  if (window.__heytoolsInstall) return;
  window.__heytoolsInstall = true;

  /* Inside the app shell (or any frame): never prompt. */
  try { if (window.self !== window.top) return; } catch (e) { return; }

  /* Already running as an installed app: never prompt. */
  function inApp() {
    var modes = ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay'];
    for (var i = 0; i < modes.length; i++) {
      try { if (window.matchMedia('(display-mode: ' + modes[i] + ')').matches) return true; } catch (e) { /* ignore */ }
    }
    return navigator.standalone === true;
  }
  if (inApp()) return;

  /* Site root = the folder this script lives in. */
  var script = document.currentScript;
  var BASE;
  try { BASE = new URL('./', script ? script.src : location.href).href; } catch (e) { return; }
  var APP_URL = BASE + 'app/';
  var APK_URL = window.HEY_APK_URL || 'https://github.com/Mithunsg08/heytools/releases/download/android-latest/HeyTools.apk';
  var isAndroid = /android/i.test(navigator.userAgent);
  /* load the download counter so a click on the button is counted */
  (function () {
    if (window.HeyTrack) return;
    function add(src, next) { var s = document.createElement('script'); s.src = BASE + src; s.onload = next || null; s.onerror = next || null; document.head.appendChild(s); }
    add('track-config.js', function () { add('heytrack.js'); });
  })();

  /* Make the page installable: manifest link + service worker. */
  if (!document.querySelector('link[rel="manifest"]')) {
    var link = document.createElement('link');
    link.rel = 'manifest';
    link.href = APP_URL + 'manifest.webmanifest';
    document.head.appendChild(link);
  }
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register(BASE + 'heytools-sw.js', { scope: BASE }).catch(function () {});
  }

  /* Remember a dismissal for 7 days (storage may be blocked, so never rely on it). */
  var KEY = 'heytools.install.dismissed';
  var WEEK = 7 * 24 * 60 * 60 * 1000;
  function dismissed() {
    try { var t = parseInt(localStorage.getItem(KEY), 10); return t && Date.now() - t < WEEK; } catch (e) { return false; }
  }
  function remember() { try { localStorage.setItem(KEY, String(Date.now())); } catch (e) { /* ignore */ } }
  if (dismissed()) return;

  var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
              (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var deferred = null;
  var host = null;

  function hide() { if (host) { host.remove(); host = null; } }

  function show() {
    if (host || !document.body) return;
    host = document.createElement('div');
    host.id = 'heytools-install';
    host.style.cssText = 'all:initial;position:fixed;z-index:2147483000;right:16px;bottom:16px;';
    var root = host.attachShadow({ mode: 'open' });
    root.innerHTML =
      '<style>' +
      '.box{display:flex;align-items:center;gap:6px;max-width:calc(100vw - 32px);' +
      'margin:0 env(safe-area-inset-right,0) env(safe-area-inset-bottom,0) 0;' +
      'background:#14213D;color:#fff;border:2px solid #FFC93C;border-radius:14px;padding:6px 6px 6px 8px;' +
      'box-shadow:0 6px 18px rgba(20,33,61,.35);font:600 14px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;' +
      'animation:in .25s ease-out}' +
      '@keyframes in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}' +
      '@media (prefers-reduced-motion:reduce){.box{animation:none}}' +
      'button{font:inherit;color:inherit;cursor:pointer;border:0;background:transparent}' +
      'button:focus-visible{outline:3px solid #FFC93C;outline-offset:2px}' +
      '.go{display:flex;align-items:center;gap:10px;padding:6px 10px 6px 4px;border-radius:10px}' +
      '.go:hover{background:rgba(255,255,255,.1)}' +
      '.ico{flex:none;width:30px;height:30px;border-radius:8px;background:#fff;display:grid;place-items:center}' +
      '.ico i{display:block;width:16px;height:16px;position:relative}' +
      '.ico i:before,.ico i:after{content:"";position:absolute;width:9px;height:9px;border-radius:3px}' +
      '.ico i:before{left:0;top:0;background:#FFC93C}.ico i:after{right:0;bottom:0;background:#2B4EFF}' +
      '.x{flex:none;width:30px;height:30px;border-radius:8px;font-size:18px;opacity:.8}' +
      '.x:hover{opacity:1;background:rgba(255,255,255,.1)}' +
      '</style>' +
      '<div class="box" role="region" aria-label="Install the HeyTools app">' +
      '<button class="go" type="button"><span class="ico" aria-hidden="true"><i></i></span>' +
      '<span>' + (isIOS ? 'Get the HeyTools app' : isAndroid ? 'Get the Android app' : 'Install HeyTools app') + '</span></button>' +
      '<button class="x" type="button" aria-label="Dismiss">&#10005;</button>' +
      '</div>';

    root.querySelector('.go').addEventListener('click', function () {
      if (isIOS) { window.location.href = APP_URL; return; }
      if (isAndroid) { try { if (window.HeyTrack) HeyTrack.event('download_click', { where: 'tool-page:' + location.pathname }); } catch (e) { /* ignore */ } window.location.href = APK_URL; return; }
      if (!deferred) return;
      deferred.prompt();
      deferred.userChoice.then(function (c) {
        deferred = null;
        if (c && c.outcome === 'accepted') hide();
      });
    });
    root.querySelector('.x').addEventListener('click', function () { remember(); hide(); });
    document.body.appendChild(host);
  }

  /* Chrome, Edge, Samsung Internet and others fire this only when the app can really be installed. */
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    if (document.body) show(); else document.addEventListener('DOMContentLoaded', show);
  });
  window.addEventListener('appinstalled', function () { remember(); hide(); });

  /* iPhone and iPad have no install event, and Android gets the full app (APK): show the button after the page loads. */
  if (isIOS || isAndroid) {
    var go = function () { setTimeout(show, 1500); };
    if (document.readyState === 'complete') go(); else window.addEventListener('load', go);
  }
})();
