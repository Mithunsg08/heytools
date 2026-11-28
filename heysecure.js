/* HeySecure: encryption for private HeyTools data, with two unlock modes:
   - Password (recommended): see below. Optional fingerprint/face quick unlock, which can only be turned on with the password.
   - No password: the same AES-256-GCM encryption, but the data key is kept by the Android Keystore (app) or a non-extractable
     WebCrypto key (browser) on this device only, and opens automatically. It protects copied files and backups, not a phone that is
     unlocked in someone's hand. The person can switch between the modes in Settings; no data is re-encrypted because the data key stays the same.
   Password mode: the person sets one password. A random 256-bit data key encrypts every record (AES-256-GCM); that key is itself
   encrypted ("wrapped") with a key derived from the password (PBKDF2-SHA-256, 600,000 rounds, random salt).
   The password and the unwrapped key live only in memory and are never stored, so a forgotten password cannot be recovered:
   the data stays unreadable and the only way forward is to erase it. Only ciphertext is written to localStorage ("hs1:<key>").
   There is no plaintext fallback. Records written by the earlier device-key version (v1) are upgraded on first unlock. */
(function (root) {
  'use strict';
  /* Same-origin tool pages inside the app share the app shell's instance, so one unlock covers every tool. */
  try { if (root.top && root.top !== root && root.top.HeySecure && root.top.HeySecure.__core) { root.HeySecure = root.top.HeySecure; return; } } catch (e) {}
  var PREFIX = 'hs1:', META = 'hs2meta', AAD1 = 'heytools-secure-record-v1:', AAD2 = 'heytools-secure-record-v2:', AADW = 'heytools-key-wrap-v2';
  var KEY_RE = /^[A-Za-z0-9_.:-]{1,120}$/, MAX = 1024 * 1024, ITER = 600000, MIN_PW = 10;
  var SECURE_KEYS = ['notes-and-todo:v1', 'heytools.expenses.v1', 'heytools.habits.v1', 'heytools.split.v1', 'heytools.water.v1',
    'heytools.focus.v1', 'heytools.breath.v1', 'heytools.tally.v1', 'heytools.timers.v1', 'heytools.wheel.v1', 'heytools.markdown.v1',
    'wc-text', 'md-history'];
  var CHUNK = 4 * 1024 * 1024, QUICK = 'hs2quick', DEV = 'hs2dev', DEVCTX = 'hs-dev';
  var te = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
  var td = typeof TextDecoder !== 'undefined' ? new TextDecoder() : null;
  function subtle() { return root.crypto && root.crypto.subtle; }
  function store() { try { return root.localStorage; } catch (e) { return null; } }
  function b64(buf) { var s = '', b = new Uint8Array(buf); for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s); }
  function unb64(s) { var r = atob(s), b = new Uint8Array(r.length); for (var i = 0; i < r.length; i++) b[i] = r.charCodeAt(i); return b; }

  /* ---------- Android Keystore backend ---------- */
  function pluginNamed(name) {
    var tries = [function () { return root.top; }, function () { return root.parent; }, function () { return root; }];
    for (var i = 0; i < tries.length; i++) {
      try {
        var w = tries[i](), c = w && w.Capacitor;
        if (c && c.isNativePlatform && c.isNativePlatform()) { var p = (c.Plugins && c.Plugins[name]) || (c.registerPlugin && c.registerPlugin(name)); if (p) return p; }
      } catch (e) {}
    }
    return null;
  }
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
        return root.crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv, additionalData: te.encode(AAD1 + key) }, k, te.encode(text));
      }).then(function (ct) { return { v: 1, alg: 'A256GCM', iv: b64(iv), data: b64(ct) }; });
    },
    decrypt: function (key, env) {
      return getCryptoKey().then(function (k) {
        return root.crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(env.iv), additionalData: te.encode(AAD1 + key) }, k, unb64(env.data));
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


  /* ---------- Password key ---------- */
  var dek = null, unlockP = null, fails = 0, lastFail = 0;
  function deriveKek(pw, salt, iter) {
    return subtle().importKey('raw', te.encode(pw), 'PBKDF2', false, ['deriveKey']).then(function (base) {
      return subtle().deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: salt, iterations: iter }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    });
  }
  function importDek(raw) { return subtle().importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']); }
  function readMeta() {
    var s = store(); if (!s) return null;
    try { var m = JSON.parse(s.getItem(META)); return m && m.v === 2 && m.salt && m.iv && m.wrapped ? m : null; } catch (e) { return null; }
  }
  function readDev() {
    var s = store(); if (!s) return null;
    try { var e = JSON.parse(s.getItem(DEV)); return e && e.v === 1 && e.iv && e.data ? e : null; } catch (x) { return null; }
  }
  function mode() { return readMeta() ? 'password' : readDev() ? 'device' : null; }
  function unwrapWith(pw) {
    var m = readMeta(); if (!m) return Promise.reject(new Error('Password mode is not on'));
    return deriveKek(pw, unb64(m.salt), m.iter || ITER).then(function (kek) {
      return subtle().decrypt({ name: 'AES-GCM', iv: unb64(m.iv), additionalData: te.encode(AADW) }, kek, unb64(m.wrapped));
    }).then(function (raw) { return raw; }, function () { throw new Error('Wrong password'); });
  }
  function deviceSeal(raw) {
    return waitLegacy().then(function (b) {
      if (!b) throw new Error('This device cannot keep an encryption key');
      return b.encrypt(DEVCTX, b64(raw));
    });
  }
  function deviceOpen() {
    var env = readDev(); if (!env) return Promise.reject(new Error('No device key'));
    return waitLegacy().then(function (b) {
      if (!b) throw new Error('This device cannot unlock the data');
      return b.decrypt(DEVCTX, env);
    }).then(function (t) { return unb64(t); });
  }
  function wrap(raw, pw) {
    var salt = root.crypto.getRandomValues(new Uint8Array(16)), iv = root.crypto.getRandomValues(new Uint8Array(12));
    return deriveKek(pw, salt, ITER).then(function (kek) {
      return subtle().encrypt({ name: 'AES-GCM', iv: iv, additionalData: te.encode(AADW) }, kek, raw);
    }).then(function (ct) { return { v: 2, kdf: 'PBKDF2-SHA256', iter: ITER, salt: b64(salt), iv: b64(iv), wrapped: b64(ct) }; });
  }
  function checkPw(pw) {
    if (typeof pw !== 'string' || pw.length < MIN_PW) return new Error('Use a password of at least ' + MIN_PW + ' characters');
    return null;
  }

  /* ---------- Records ---------- */
  function checkKey(k) { if (!KEY_RE.test(k || '')) throw new Error('Invalid secure storage key'); }
  var queues = Object.create(null), latest = Object.create(null);
  function enqueue(key, fn) {
    var p = (queues[key] || Promise.resolve()).then(fn, fn);
    queues[key] = p.catch(function () {});
    return p;
  }
  function readEnvelope(key) {
    var s = store(); if (!s) return null;
    var raw = s.getItem(PREFIX + key); if (!raw) return null;
    try { var e = JSON.parse(raw); return e && (e.v === 1 || e.v === 2) && e.iv && e.data ? e : null; } catch (x) { return null; }
  }
  function enc2(key, text) {
    if (text.length > MAX / 2) return Promise.reject(new Error('Record too large for secure storage'));
    var iv = root.crypto.getRandomValues(new Uint8Array(12));
    return subtle().encrypt({ name: 'AES-GCM', iv: iv, additionalData: te.encode(AAD2 + key) }, dek, te.encode(text))
      .then(function (ct) { return { v: 2, alg: 'A256GCM', iv: b64(iv), data: b64(ct) }; });
  }
  function dec2(key, env) {
    return subtle().decrypt({ name: 'AES-GCM', iv: unb64(env.iv), additionalData: te.encode(AAD2 + key) }, dek, unb64(env.data)).then(function (pt) { return td.decode(pt); });
  }
  function writeText(key, text) {
    return enc2(key, text).then(function (env) {
      return dec2(key, env).then(function (back) {   /* verify before the old copy is replaced */
        if (back !== text) throw new Error('Encrypted record failed verification');
        var s = store(); if (!s) throw new Error('Storage unavailable');
        s.setItem(PREFIX + key, JSON.stringify(env));
      });
    });
  }
  function readText(key, env) {
    if (env.v === 2) return dec2(key, env);
    /* v1 (device key) record: read with the old backend and upgrade it */
    return waitLegacy().then(function (b) {
      if (!b) throw new Error('This record was made on a device key that is not available');
      return b.decrypt(key, env);
    }).then(function (t) { return writeText(key, t).then(function () { return t; }, function () { return t; }); });
  }
  function waitLegacy() {
    return new Promise(function (res) {
      var b = legacyBackend(), n = 0;
      if (b) return res(b);
      var t = setInterval(function () { b = legacyBackend(); if (b || ++n > 20) { clearInterval(t); res(b); } }, 150);
    });
  }
  function legacyBackend() { if (nativeBackend.available()) return nativeBackend; if (webBackend.available()) return webBackend; return null; }

  /* ---------- Lock screen ---------- */
  var CSS = '#hs-lock{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:20px;background:radial-gradient(120% 90% at 50% 0%,#2a1f4d 0%,#0e1020 60%,#070810 100%);font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#f3f1ff}' +
    '#hs-lock *{box-sizing:border-box}#hs-card{width:100%;max-width:380px;padding:28px 24px;border-radius:24px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);box-shadow:0 30px 80px rgba(0,0,0,.5)}' +
    '#hs-ico{width:56px;height:56px;border-radius:18px;margin:0 auto 14px;display:flex;align-items:center;justify-content:center;font-size:28px;background:linear-gradient(135deg,#8b7bff,#ff7bd0)}' +
    '#hs-card h2{margin:0 0 6px;text-align:center;font-size:22px;font-weight:700}#hs-card p{margin:0 0 16px;text-align:center;font-size:14px;line-height:1.45;color:#c9c5e6}' +
    '.hs-f{position:relative;margin-bottom:10px}.hs-f input{width:100%;padding:14px 46px 14px 14px;border-radius:14px;border:1px solid rgba(255,255,255,.2);background:rgba(0,0,0,.28);color:#fff;font-size:16px;outline:none}.hs-f input:focus{border-color:#a99bff}' +
    '.hs-f button{position:absolute;right:6px;top:6px;width:36px;height:36px;border:0;border-radius:10px;background:transparent;color:#c9c5e6;font-size:18px}' +
    '#hs-go{width:100%;padding:14px;border:0;border-radius:14px;font-size:16px;font-weight:700;color:#fff;background:linear-gradient(135deg,#7c6bff,#ff6bc8);margin-top:4px}#hs-go[disabled]{opacity:.6}' +
    '#hs-err{min-height:20px;margin:8px 0 0;text-align:center;font-size:13px;color:#ffb4c0}#hs-warn{margin:12px 0 0;padding:10px 12px;border-radius:12px;background:rgba(255,200,90,.12);color:#ffe2a8;font-size:12.5px;line-height:1.4;text-align:left}' +
    '#hs-forgot{display:block;margin:14px auto 0;background:none;border:0;color:#b9b4dd;font-size:13px;text-decoration:underline}';
  function showLock(mode, done) {
    var d = root.document; if (!d || !d.body) { return false; }
    var el = d.createElement('div'); el.id = 'hs-lock'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
    var setup = mode === 'setup', broken = mode === 'devicefail';
    if (broken) {
      el.innerHTML = '<style>' + CSS + '</style><div id="hs-card"><div id="hs-ico">⚠️</div><h2>Can\u2019t open your data</h2><p>HeyTools could not get this device\u2019s encryption key. Try again. If the phone was reset or the key was lost, the data cannot be opened.</p><div id="hs-err" role="alert"></div><button id="hs-go" type="button">Try again</button><button id="hs-forgot" type="button">Erase data and start fresh</button></div>';
      d.body.appendChild(el);
      el.querySelector('#hs-go').onclick = function () { say(''); HS.unlockDevice().then(function () { el.remove(); done(); }, function (e) { say(e && e.message || 'Still not working'); }); };
      function say(m) { el.querySelector('#hs-err').textContent = m || ''; }
      el.querySelector('#hs-forgot').onclick = function () {
        if (!root.confirm('This permanently deletes your encrypted data on this device. Erase it?')) return;
        HS.reset().then(function () { el.remove(); unlockP = null; HS.ensureUnlocked().then(done); });
      };
      return true;
    }
    el.innerHTML = '<style>' + CSS + '</style><div id="hs-card"><div id="hs-ico">🔐</div>' +
      '<h2>' + (setup ? 'Protect your data' : 'Unlock HeyTools') + '</h2>' +
      '<p>' + (setup ? 'Choose a password. Your notes, expenses and habits are encrypted with it on this device.' : 'Enter your password to open your private data.') + '</p>' +
      (!setup && HS.quickReady() ? '<button id="hs-quick" type="button" style="width:100%;padding:14px;margin:0 0 12px;border-radius:14px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.1);color:#fff;font-size:16px;font-weight:700">🔓 Unlock with fingerprint or face</button><p style="margin:-4px 0 10px">or enter your password</p>' : '') +
      '<form id="hs-form" autocomplete="off"><div class="hs-f"><input id="hs-pw" type="password" placeholder="' + (setup ? 'New password (10+ characters)' : 'Password') + '" autocomplete="' + (setup ? 'new-password' : 'current-password') + '"><button type="button" id="hs-eye" aria-label="Show password">👁</button></div>' +
      (setup ? '<div class="hs-f"><input id="hs-pw2" type="password" placeholder="Repeat password" autocomplete="new-password"></div><div id="hs-warn">⚠ There is no password reset. If you forget it, your encrypted data cannot be opened by anyone, including us.</div>' : '') +
      '<div id="hs-err" role="alert"></div><button id="hs-go" type="submit">' + (setup ? 'Create password' : 'Unlock') + '</button></form>' +
      (setup ? '<button id="hs-nopw" type="button" style="display:block;width:100%;margin:12px 0 0;padding:12px;border-radius:14px;border:1px solid rgba(255,255,255,.22);background:transparent;color:#e7e3ff;font-size:14px;font-weight:600">Use no password</button><p style="margin:8px 0 0;font-size:12px;color:#aaa5cf">Still encrypted. The key stays on this device and opens automatically. Anyone who can use your unlocked phone can see the data. You can add a password later in Settings.</p>' : '') +
      (setup ? '' : '<button id="hs-forgot" type="button">Forgot password?</button>') + '</div>';
    d.body.appendChild(el);
    var pw = el.querySelector('#hs-pw'), pw2 = el.querySelector('#hs-pw2'), err = el.querySelector('#hs-err'), go = el.querySelector('#hs-go');
    function say(m) { err.textContent = m || ''; }
    el.querySelector('#hs-eye').onclick = function () { var t = pw.type === 'password' ? 'text' : 'password'; pw.type = t; if (pw2) pw2.type = t; };
    el.querySelector('#hs-form').onsubmit = function (ev) {
      ev.preventDefault(); say('');
      if (setup && pw.value !== pw2.value) return say('The two passwords do not match');
      go.disabled = true; var label = go.textContent; go.textContent = 'Working…';
      (setup ? HS.setup(pw.value) : HS.unlock(pw.value)).then(function () {
        pw.value = ''; if (pw2) pw2.value = ''; el.remove(); done();
      }, function (e) { say(e && e.message || 'Something went wrong'); go.disabled = false; go.textContent = label; if (!setup) { pw.select(); } });
    };
    var np = el.querySelector('#hs-nopw');
    if (np) np.onclick = function () {
      np.disabled = true; say('');
      HS.setupDevice().then(function () { pw.value = ''; if (pw2) pw2.value = ''; el.remove(); done(); }, function (e) { np.disabled = false; say(e && e.message || 'Could not turn on encryption'); });
    };
    var qk = el.querySelector('#hs-quick'), typing = false, quickBusy = false;
    /* typing a password means the person chose the password: never show the fingerprint prompt after that */
    ['input', 'keydown', 'pointerdown'].forEach(function (ev) { pw.addEventListener(ev, function () { typing = true; }); });
    if (qk) {
      var tryQuick = function (manual) {
        if (quickBusy || (!manual && typing)) return;
        quickBusy = true; say('');
        HS.unlockQuick().then(function () { pw.value = ''; el.remove(); done(); }, function (e) { quickBusy = false; if (e && e.message !== 'Not confirmed') say(e.message); });
      };
      qk.onclick = function () { typing = false; tryQuick(true); }; setTimeout(function () { tryQuick(false); }, 350);
    }
    var fg = el.querySelector('#hs-forgot');
    if (fg) fg.onclick = function () {
      if (!root.confirm('There is no way to recover a forgotten password. To continue you must erase all encrypted data (notes, expenses, habits) on this device. Erase it now?')) return;
      if (!root.confirm('This permanently deletes your encrypted data. You can restore it later only from a backup and its backup password. Erase everything?')) return;
      HS.reset().then(function () { el.remove(); unlockP = null; HS.ensureUnlocked().then(done); });
    };
    if (!qk) setTimeout(function () { try { pw.focus(); } catch (e) {} }, 50);   // with fingerprint available, keep the keyboard closed until the person taps the field
    return true;
  }

  var HS = {
    __core: true, PREFIX: PREFIX, MIN_PASSWORD: MIN_PW,
    isSetUp: function () { return !!mode(); },
    /* 'password', 'device' (no password, still encrypted) or null before the first setup */
    mode: mode,
    /* true inside the HeyTools app (native app, or a tool page shown inside the app shell). Public website pages return false and do not keep private text. */
    inApp: function () {
      try { if (root.top && root.top !== root && root.top.HeySecure && root.top.HeySecure.__core) return true; } catch (e) {}
      try { var c = root.Capacitor; return !!(c && c.isNativePlatform && c.isNativePlatform()); } catch (e) { return false; }
    },
    isUnlocked: function () { return !!dek; },
    isSecureKey: function (k) { return SECURE_KEYS.indexOf(k) >= 0 || !!readEnvelope(k); },
    /* Create the password for the first time. Also upgrades any records written by the earlier device-key version. */
    setup: function (pw) {
      var bad = checkPw(pw); if (bad) return Promise.reject(bad);
      if (!subtle() || !te) return Promise.reject(new Error('This browser cannot encrypt data'));
      if (readMeta()) return Promise.reject(new Error('A password is already set'));
      var raw = root.crypto.getRandomValues(new Uint8Array(32));
      return wrap(raw, pw).then(function (meta) {
        return importDek(raw).then(function (k) { dek = k; store().setItem(META, JSON.stringify(meta)); });
      }).then(function () { return upgradeAll(); }).then(function () { return true; });
    },
    /* No-password mode: encrypted with a random key that this device keeps for you. */
    setupDevice: function () {
      if (!subtle() || !te) return Promise.reject(new Error('This browser cannot encrypt data'));
      if (mode()) return Promise.reject(new Error('Encryption is already set up'));
      var raw = root.crypto.getRandomValues(new Uint8Array(32));
      return deviceSeal(raw).then(function (env) {
        return importDek(raw).then(function (k) { store().setItem(DEV, JSON.stringify(env)); dek = k; });
      }).then(function () { return upgradeAll(); }).then(function () { return true; });
    },
    unlockDevice: function () {
      if (mode() !== 'device') return Promise.reject(new Error('Not in no-password mode'));
      return deviceOpen().then(function (raw) { return importDek(raw); }).then(function (k) { dek = k; return upgradeAll().then(function () { return true; }); });
    },
    /* Password mode -> no password. Needs the current password. The data key does not change, so nothing is re-encrypted. */
    switchToDevice: function (pw) {
      if (mode() !== 'password' || !dek) return Promise.reject(new Error('Unlock first'));
      return unwrapWith(pw).then(function (raw) { return deviceSeal(new Uint8Array(raw)); }).then(function (env) {
        var s = store(); s.setItem(DEV, JSON.stringify(env)); s.removeItem(META); s.removeItem(QUICK); return true;
      });
    },
    /* No password -> password mode. */
    switchToPassword: function (newPw) {
      var bad = checkPw(newPw); if (bad) return Promise.reject(bad);
      if (mode() !== 'device' || !dek) return Promise.reject(new Error('Unlock first'));
      return deviceOpen().then(function (raw) { return wrap(raw, newPw); }).then(function (meta) {
        var s = store(); s.setItem(META, JSON.stringify(meta)); s.removeItem(DEV); return true;
      });
    },
    unlock: function (pw) {
      var wait = Math.min(30000, fails > 2 ? Math.pow(2, fails - 2) * 1000 : 0) - (Date.now() - lastFail);
      var delay = wait > 0 ? new Promise(function (r) { setTimeout(r, wait); }) : Promise.resolve();
      var m = readMeta();
      if (!m) return Promise.reject(new Error(mode() === 'device' ? 'Password mode is not on' : 'No password has been set yet'));
      if (typeof pw !== 'string' || !pw) return Promise.reject(new Error('Enter your password'));
      return delay.then(function () { return deriveKek(pw, unb64(m.salt), m.iter || ITER); }).then(function (kek) {
        return subtle().decrypt({ name: 'AES-GCM', iv: unb64(m.iv), additionalData: te.encode(AADW) }, kek, unb64(m.wrapped));
      }).then(function (raw) { return importDek(raw); }).then(function (k) {
        dek = k; fails = 0; return upgradeAll().then(function () { return true; });
      }, function () { fails++; lastFail = Date.now(); throw new Error('Wrong password'); });
    },
    lock: function () { dek = null; unlockP = null; },
    /* Resolves when the data is unlocked, showing the password screen if needed. */
    ensureUnlocked: function () {
      if (dek) return Promise.resolve();
      if (unlockP) return unlockP;
      unlockP = new Promise(function (res, rej) {
        function open() {
          if (mode() === 'device') {
            HS.unlockDevice().then(function () { res(); }, function () {
              if (!showLock('devicefail', function () { res(); })) rej(new Error('Cannot unlock'));
            });
            return;
          }
          if (!showLock(mode() ? 'unlock' : 'setup', function () { res(); })) { if (!root.document || root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', open, { once: true }); else rej(new Error('Cannot show the password screen')); }
        }
        open();
      });
      return unlockP;
    },
    changePassword: function (oldPw, newPw) {
      var bad = checkPw(newPw); if (bad) return Promise.reject(bad);
      var m = readMeta(); if (!m || !dek) return Promise.reject(new Error(mode() === 'device' ? 'Password mode is not on' : 'Unlock first'));
      return deriveKek(oldPw, unb64(m.salt), m.iter || ITER).then(function (kek) {
        return subtle().decrypt({ name: 'AES-GCM', iv: unb64(m.iv), additionalData: te.encode(AADW) }, kek, unb64(m.wrapped));
      }).then(function (raw) { return wrap(raw, newPw); }, function () { throw new Error('Current password is wrong'); })
        .then(function (meta) { store().setItem(META, JSON.stringify(meta)); return true; });
    },
    /* Erase every encrypted record and the password. Used for "forgot password" and "delete all my data". */
    reset: function () {
      var s = store(); dek = null; unlockP = null; fails = 0;
      if (s) { HS.keys().forEach(function (k) { s.removeItem(PREFIX + k); }); s.removeItem(META); s.removeItem(DEV); s.removeItem(QUICK); SECURE_KEYS.forEach(function (k) { s.removeItem(k); }); }
      return new Promise(function (r) { try { var q = root.indexedDB.deleteDatabase('heysecure'); q.onsuccess = q.onerror = q.onblocked = function () { r(); }; } catch (e) { r(); } });
    },
    getJSON: function (key, fallback, opts) {
      checkKey(key);
      if (!HS.inApp()) {                                   // public website page: data stays a plain, local-only setting as before
        try { var pv = store().getItem(key); if (pv == null) return Promise.resolve(fallback); try { return Promise.resolve(JSON.parse(pv)); } catch (e) { return Promise.resolve(opts && opts.raw ? pv : fallback); } } catch (e) { return Promise.resolve(fallback); }
      }
      return HS.ensureUnlocked().then(function () {
        return enqueue(key, function () {
          var env = readEnvelope(key);
          if (env) return readText(key, env).then(function (t) { return JSON.parse(t); });
          var s = store(), legacy = null;
          try { legacy = s && s.getItem(key); } catch (e) {}
          if (legacy == null) return fallback;
          var val; try { val = JSON.parse(legacy); } catch (e) { if (opts && opts.raw) val = legacy; else return fallback; }
          return writeText(key, JSON.stringify(val)).then(function () { try { s.removeItem(key); } catch (e) {} return val; });
        });
      });
    },
    setJSON: function (key, value) {
      checkKey(key);
      if (!HS.inApp()) { try { store().setItem(key, JSON.stringify(value)); return Promise.resolve(); } catch (e) { return Promise.reject(e); } }
      latest[key] = JSON.stringify(value);                 // while a write is running, newer values replace queued ones
      return HS.ensureUnlocked().then(function () {
        return enqueue(key, function () {
          var text = latest[key]; if (text === undefined) return;
          delete latest[key];
          return writeText(key, text).then(function () { try { var s = store(); if (s && s.getItem(key) != null) s.removeItem(key); } catch (e) {} });
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
    /* Decrypted copy of every secure record as { data: { key: jsonText }, failed: [keys that could not be read] }, for building a backup. */
    exportAll: function () {
      return HS.ensureUnlocked().then(function () {
        var names = HS.keys();
        SECURE_KEYS.forEach(function (k) { if (names.indexOf(k) < 0 && store() && store().getItem(k) != null) names.push(k); });
        var out = {}, failed = [];
        return Promise.all(names.map(function (k) { return HS.getJSON(k, undefined).then(function (v) { if (v !== undefined) out[k] = JSON.stringify(v); }, function () { failed.push(k); }); })).then(function () { return { data: out, failed: failed }; });
      });
    },
    /* Unlock with the phone's own lock (fingerprint, face, PIN) instead of typing the password. The data key is kept
       encrypted by the Android Keystore and is only released after the phone's lock screen confirms the person.
       The password still works and is still needed on a new phone or after a reinstall. */
    canQuick: function () { return !!(pluginNamed('SecureStorage') && pluginNamed('AppLock')); },
    quickReady: function () { var s = store(); return HS.canQuick() && !!(s && s.getItem(QUICK)); },
    enableQuick: function (pw) {
      var m = readMeta(); if (!m || !dek) return Promise.reject(new Error('Fingerprint unlock needs a data password'));
      if (!HS.canQuick()) return Promise.reject(new Error('Not available on this device'));
      return deriveKek(pw, unb64(m.salt), m.iter || ITER).then(function (kek) {
        return subtle().decrypt({ name: 'AES-GCM', iv: unb64(m.iv), additionalData: te.encode(AADW) }, kek, unb64(m.wrapped));
      }).then(function (raw) { return nativeBackend.encrypt(QUICK, b64(raw)); }, function () { throw new Error('Wrong password'); })
        .then(function (env) { store().setItem(QUICK, JSON.stringify(env)); return true; });
    },
    disableQuick: function () { var s = store(); if (s) s.removeItem(QUICK); return Promise.resolve(true); },
    unlockQuick: function () {
      if (!HS.quickReady()) return Promise.reject(new Error('Fingerprint unlock is not set up'));
      return pluginNamed('AppLock').authenticate({ title: 'HeyTools', subtitle: 'Unlock your private data' }).then(function (r) {
        if (!r || !r.ok) throw new Error('Not confirmed');
        return nativeBackend.decrypt(QUICK, JSON.parse(store().getItem(QUICK)));
      }).then(function (b) { return importDek(unb64(b)); }).then(function (k) {
        dek = k; fails = 0; return upgradeAll().then(function () { return true; });
      }, function (e) { throw new Error(e && e.message === 'Not confirmed' ? 'Not confirmed' : 'Could not unlock with your phone lock. Use your password.'); });
    },
    /* Encrypts a Blob (or any JSON value) for IndexedDB storage. Big files are cut into 4 MB pieces, each with its own IV;
       the piece number and count are bound into the tag so pieces cannot be reordered or dropped. ctx names the record. */
    sealBlob: function (ctx, blob) {
      return HS.ensureUnlocked().then(function () {
        var n = Math.max(1, Math.ceil(blob.size / CHUNK)), out = [], p = Promise.resolve();
        for (var i = 0; i < n; i++) (function (i) {
          p = p.then(function () { return blob.slice(i * CHUNK, Math.min(blob.size, (i + 1) * CHUNK)).arrayBuffer(); }).then(function (buf) {
            var iv = root.crypto.getRandomValues(new Uint8Array(12));
            return subtle().encrypt({ name: 'AES-GCM', iv: iv, additionalData: te.encode('heytools-blob-v2:' + ctx + ':' + i + ':' + n) }, dek, buf).then(function (ct) { out.push({ iv: iv, data: ct }); });
          });
        })(i);
        return p.then(function () { return { v: 2, type: blob.type || '', size: blob.size, chunks: out }; });
      });
    },
    openBlob: function (ctx, env) {
      return HS.ensureUnlocked().then(function () {
        var n = env.chunks.length, parts = [], p = Promise.resolve();
        for (var i = 0; i < n; i++) (function (i) {
          p = p.then(function () {
            var c = env.chunks[i];
            return subtle().decrypt({ name: 'AES-GCM', iv: c.iv, additionalData: te.encode('heytools-blob-v2:' + ctx + ':' + i + ':' + n) }, dek, c.data).then(function (pt) { parts.push(pt); });
          });
        })(i);
        return p.then(function () { return new Blob(parts, { type: env.type || '' }); });
      });
    },
    sealJSON: function (ctx, value) { return HS.sealBlob(ctx, new Blob([JSON.stringify(value)])); },
    openJSON: function (ctx, env) { return HS.openBlob(ctx, env).then(function (b) { return b.text(); }).then(JSON.parse); },
    onError: function (e) { try { console.warn('HeySecure:', e && e.message); } catch (x) {} }
  };
  /* Upgrade v1 device-key records and any readable copies of known keys now that the password key is open. */
  function upgradeAll() {
    var names = HS.keys();
    SECURE_KEYS.forEach(function (k) { if (names.indexOf(k) < 0 && store() && store().getItem(k) != null) names.push(k); });
    return Promise.all(names.map(function (k) { return HS.getJSON(k, undefined).catch(function () {}); }));
  }
  root.HeySecure = HS;
  if (typeof module !== 'undefined' && module.exports) module.exports = HS;
})(typeof window !== 'undefined' ? window : globalThis);
