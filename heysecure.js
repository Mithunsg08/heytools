/* HeySecure: encrypted storage for private HeyTools data.
   Android app: AES-256-GCM with a hardware-backed Android Keystore key (SecureStorage plugin).
   Browser / PWA: AES-256-GCM with a non-extractable WebCrypto key kept in IndexedDB.
   Only ciphertext is written to localStorage ("hs1:<key>"). There is no plaintext fallback: if encryption
   is unavailable, reads return the fallback and writes fail with an error instead of saving readable data. */
(function (root) {
  'use strict';
  var PREFIX = 'hs1:', AAD = 'heytools-secure-record-v1:', KEY_RE = /^[A-Za-z0-9_.:-]{1,120}$/;
  var MAX = 1024 * 1024;
  var te = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
  var td = typeof TextDecoder !== 'undefined' ? new TextDecoder() : null;

  function store() { try { return root.localStorage; } catch (e) { return null; } }
  function b64(buf) { var s = '', b = new Uint8Array(buf); for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s); }
  function unb64(s) { var r = atob(s), b = new Uint8Array(r.length); for (var i = 0; i < r.length; i++) b[i] = r.charCodeAt(i); return b; }

  /* ---------- Android Keystore backend ---------- */
  function nativePlugin() {
    var tries = [function () { return root.top; }, function () { return root.parent; }, function () { return root; }];
    for (var i = 0; i < tries.length; i++) {
      try {
        var w = tries[i](), c = w && w.Capacitor;
        if (c && c.isNativePlatform && c.isNativePlatform()) {
          var p = c.Plugins && c.Plugins.SecureStorage;
          if (!p && c.registerPlugin) p = c.registerPlugin('SecureStorage');
          if (p && p.encrypt) return p;
        }
      } catch (e) {}
    }
    return null;
  }
  var nativeBackend = {
    name: 'android-keystore',
    available: function () { return !!nativePlugin(); },
    encrypt: function (key, text) {
      return nativePlugin().encrypt({ key: key, value: text }).then(function (r) { return { v: 1, alg: 'A256GCM', iv: r.iv, data: r.data }; });
    },
    decrypt: function (key, env) {
      return nativePlugin().decrypt({ key: key, envelope: { v: 1, alg: 'A256GCM', iv: env.iv, data: env.data } }).then(function (r) { return r.value; });
    }
  };

  /* ---------- WebCrypto backend ---------- */
  var cryptoKeyP = null;
  function idb() {
    return new Promise(function (res, rej) {
      var q = root.indexedDB.open('heysecure', 1);
      q.onupgradeneeded = function () { q.result.createObjectStore('keys'); };
      q.onsuccess = function () { res(q.result); };
      q.onerror = function () { rej(q.error); };
    });
  }
  function getCryptoKey() {
    if (cryptoKeyP) return cryptoKeyP;
    cryptoKeyP = idb().then(function (db) {
      return new Promise(function (res, rej) {
        var g = db.transaction('keys').objectStore('keys').get('master');
        g.onsuccess = function () {
          if (g.result) return res(g.result);
          root.crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']).then(function (k) {
            var p = db.transaction('keys', 'readwrite').objectStore('keys').put(k, 'master');
            p.onsuccess = function () { res(k); };
            p.onerror = function () { rej(p.error); };
          }, rej);
        };
        g.onerror = function () { rej(g.error); };
      });
    }).catch(function (e) { cryptoKeyP = null; throw e; });
    return cryptoKeyP;
  }
  var webBackend = {
    name: 'webcrypto',
    available: function () { return !!(root.crypto && root.crypto.subtle && root.indexedDB && te && td && typeof btoa === 'function'); },
    encrypt: function (key, text) {
      var iv = root.crypto.getRandomValues(new Uint8Array(12));
      return getCryptoKey().then(function (k) {
        return root.crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv, additionalData: te.encode(AAD + key) }, k, te.encode(text));
      }).then(function (ct) { return { v: 1, alg: 'A256GCM', iv: b64(iv), data: b64(ct) }; });
    },
    decrypt: function (key, env) {
      return getCryptoKey().then(function (k) {
        return root.crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(env.iv), additionalData: te.encode(AAD + key) }, k, unb64(env.data));
      }).then(function (pt) { return td.decode(pt); });
    }
  };

  function backend() {
    if (nativeBackend.available()) return nativeBackend;
    if (webBackend.available()) return webBackend;
    return null;
  }
  /* The Android bridge can appear a moment after the page loads, so wait briefly for it before giving up */
  function waitBackend() {
    return new Promise(function (res) {
      var b = backend(), n = 0;
      if (b) return res(b);
      var t = setInterval(function () { b = backend(); if (b || ++n > 20) { clearInterval(t); res(b); } }, 150);
    });
  }

  /* ---------- Repository ---------- */
  function checkKey(k) { if (!KEY_RE.test(k || '')) throw new Error('Invalid secure storage key'); }
  var queues = Object.create(null);
  function enqueue(key, fn) {
    var p = (queues[key] || Promise.resolve()).then(fn, fn);
    queues[key] = p.catch(function () {});
    return p;
  }
  function readEnvelope(key) {
    var s = store(); if (!s) return null;
    var raw = s.getItem(PREFIX + key); if (!raw) return null;
    try { var e = JSON.parse(raw); return e && e.v === 1 && e.iv && e.data ? e : null; } catch (x) { return null; }
  }
  function writeRaw(key, text) {
    return waitBackend().then(function (b) {
      if (!b) throw new Error('Encryption is not available on this device');
      if (text.length > MAX / 2) throw new Error('Record too large for secure storage');
      return b.encrypt(key, text).then(function (env) {
        /* verify the record decrypts before the readable copy is ever touched */
        return b.decrypt(key, env).then(function (back) {
          if (back !== text) throw new Error('Encrypted record failed verification');
          var s = store(); if (!s) throw new Error('Storage unavailable');
          s.setItem(PREFIX + key, JSON.stringify(env));
        });
      });
    });
  }

  var HS = {
    PREFIX: PREFIX,
    status: function () { var b = backend(); return { available: !!b, backend: b ? b.name : null }; },
    /* Resolves the stored JSON value, migrating a legacy plaintext copy the first time. Never throws for missing data. */
    getJSON: function (key, fallback) {
      checkKey(key);
      return enqueue(key, function () {
        var env = readEnvelope(key);
        if (env) {
          return waitBackend().then(function (b) {
            if (!b) throw new Error('Encryption is not available on this device');
            return b.decrypt(key, env);
          }).then(function (t) { return JSON.parse(t); });
        }
        var s = store(), legacy = null;
        try { legacy = s && s.getItem(key); } catch (e) {}
        if (legacy == null) return fallback;
        var val; try { val = JSON.parse(legacy); } catch (e) { return fallback; }
        return writeRaw(key, JSON.stringify(val)).then(function () {
          try { s.removeItem(key); } catch (e) {}      /* readable copy removed only after verified encryption */
          return val;
        }, function () { return val; });                /* encryption unavailable: keep legacy data readable but unchanged */
      });
    },
    setJSON: function (key, value) {
      checkKey(key);
      var text = JSON.stringify(value);
      return enqueue(key, function () {
        return writeRaw(key, text).then(function () {
          try { var s = store(); if (s && s.getItem(key) != null) s.removeItem(key); } catch (e) {}
        });
      });
    },
    remove: function (key) {
      checkKey(key);
      return enqueue(key, function () { var s = store(); if (s) { s.removeItem(PREFIX + key); s.removeItem(key); } });
    },
    keys: function () {
      var s = store(), out = [];
      if (s) for (var i = 0; i < s.length; i++) { var k = s.key(i); if (k && k.indexOf(PREFIX) === 0) out.push(k.slice(PREFIX.length)); }
      return out;
    },
    /* Show a one-line notice when a save fails, so data is never silently lost */
    onError: function (e) { try { console.warn('HeySecure:', e && e.message); } catch (x) {} }
  };
  root.HeySecure = HS;
  if (typeof module !== 'undefined' && module.exports) module.exports = HS;
})(typeof window !== 'undefined' ? window : globalThis);
