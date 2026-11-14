/* HeyTools download counter. Counts downloads and the kind of device (phone, tablet, iPhone, computer).
   It sends no name, no email and no files, only an event name, the device type and a random id made on the device.
   It does nothing until HEY_TRACK_URL is set in track-config.js. */
(function () {
  function iid() {
    try {
      var k = 'heytools.iid', v = localStorage.getItem(k);
      if (!v) { v = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now(); localStorage.setItem(k, v); }
      return v;
    } catch (e) { return 'na'; }
  }
  function isNativeApp() { try { return !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform()); } catch (e) { return false; } }
  function device() {
    var ua = navigator.userAgent || '', touch = navigator.maxTouchPoints > 1, minSide = Math.min(screen.width || 0, screen.height || 0);
    if (/iPhone|iPod/i.test(ua)) return 'iPhone';
    if (/iPad/i.test(ua) || (/Macintosh/i.test(ua) && touch)) return 'iPad';
    if (/Android/i.test(ua)) return (/Mobile/i.test(ua) && minSide < 600) ? 'Android phone' : 'Android tablet';
    if (/Windows/i.test(ua)) return 'Windows computer';
    if (/Macintosh|Mac OS X/i.test(ua)) return 'Mac computer';
    if (/CrOS/i.test(ua)) return 'Chromebook';
    if (/Linux/i.test(ua)) return 'Linux computer';
    return 'Other';
  }
  function event(name, extra) {
    var url = window.HEY_TRACK_URL; if (!url) return;
    try {
      var body = JSON.stringify({ e: name, d: device(), app: isNativeApp() ? 1 : 0, iid: iid(), w: (extra && extra.where) || '', p: location.pathname.slice(0, 80), t: Date.now() });
      if (navigator.sendBeacon && navigator.sendBeacon(url, body)) return;
      fetch(url, { method: 'POST', mode: 'no-cors', body: body, keepalive: true }).catch(function () {});
    } catch (e) { /* never break the page */ }
  }
  /* every Android download button counts a click, wherever it is on the site */
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[data-apk]') : null;
    if (a) event('download_click', { where: a.getAttribute('data-where') || location.pathname });
  }, true);
  window.addEventListener('appinstalled', function () { event('pwa_install'); });
  window.HeyTrack = { event: event, device: device };
})();
