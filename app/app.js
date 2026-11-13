(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var TOOLS = window.HEY_TOOLS, CATS = window.HEY_CATS, NATIVE = window.HeyNative || { isNative: false };
  var byId = {}, catLabel = {};
  TOOLS.forEach(function (t) { byId[t.id] = t; });
  CATS.forEach(function (c) { catLabel[c.id] = c.label; });

  var NET = { offline: 'Works offline', partial: 'Partly offline', online: 'Needs internet' };
  var PERM_LABEL = { video: 'Asks for videos', audio: 'Asks for music', camera: 'Asks for camera', mic: 'Asks for mic + camera', motion: 'Asks for motion sensor' };

  /* ---------- storage ---------- */
  function get(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function put(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } }

  var PREFS = Object.assign({ theme: 'system', layout: 'grid', density: 'comfortable', desc: true, text: false }, get('heytools.prefs.v1', {}));
  var LAYOUT = get('heytools.layout.v1', { order: [], hidden: [] });
  function normalizeLayout() {
    var seen = {}, order = [];
    (LAYOUT.order || []).forEach(function (id) { if (byId[id] && !seen[id]) { seen[id] = 1; order.push(id); } });
    TOOLS.forEach(function (t) { if (!seen[t.id]) order.push(t.id); });       // new tools land at the end
    LAYOUT.order = order;
    LAYOUT.hidden = (LAYOUT.hidden || []).filter(function (id) { return byId[id]; });
  }
  normalizeLayout();
  function saveLayout() { put('heytools.layout.v1', LAYOUT); }
  function savePrefs() { put('heytools.prefs.v1', PREFS); }
  function isHidden(id) { return LAYOUT.hidden.indexOf(id) !== -1; }

  /* ---------- state ---------- */
  var current = null, editing = false, netFilter = 'all', cat = 'all';
  var q = $('q'), nav = $('nav'), grid = $('grid'), frame = $('frame'), loading = $('loading');

  /* ---------- small DOM helper ---------- */
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k]; else if (k === 'class') n.className = attrs[k]; else n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function ico(t) { var i = el('span', { 'class': 'ico', 'data-cat': t.cat, 'aria-hidden': 'true' }); i.textContent = t.icon; return i; }

  /* ---------- preferences ---------- */
  function applyPrefs() {
    var root = document.documentElement, b = document.body;
    if (PREFS.theme === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', PREFS.theme);
    b.setAttribute('data-layout', PREFS.layout);
    b.setAttribute('data-density', PREFS.density);
    b.setAttribute('data-desc', PREFS.desc ? 'on' : 'off');
    var dark = PREFS.theme === 'dark' || (PREFS.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var m = document.querySelector('meta[name=theme-color]'); if (m) m.setAttribute('content', dark ? '#141B2E' : '#0F172A');
    var segs = document.querySelectorAll('.seg');
    for (var i = 0; i < segs.length; i++) {
      var key = segs[i].getAttribute('data-pref'), btns = segs[i].querySelectorAll('button');
      for (var j = 0; j < btns.length; j++) btns[j].setAttribute('aria-pressed', String(PREFS[key] === btns[j].getAttribute('data-v')));
    }
    $('optDesc').checked = !!PREFS.desc;
    $('optText').checked = !!PREFS.text;
    $('layoutInfo').textContent = LAYOUT.hidden.length ? LAYOUT.hidden.length + ' hidden tool' + (LAYOUT.hidden.length > 1 ? 's' : '') + '. Drag tiles to put the ones you use most first.' : 'Drag tiles to put the ones you use most first. Hide the ones you do not need.';
  }
  document.querySelectorAll('.seg').forEach(function (s) {
    s.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      PREFS[s.getAttribute('data-pref')] = b.getAttribute('data-v'); savePrefs(); applyPrefs();
    });
  });
  $('optDesc').addEventListener('change', function (e) { PREFS.desc = e.target.checked; savePrefs(); applyPrefs(); });
  $('optText').addEventListener('change', function (e) { PREFS.text = e.target.checked; savePrefs(); applyPrefs(); if (current) applyHide(byId[current]); });
  if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyPrefs);

  /* ---------- offline "saved" status ---------- */
  var saved = {};
  function checkSaved() {
    if (NATIVE.isNative) { TOOLS.forEach(function (t) { saved[t.id] = true; }); paintSaved(); return; }
    if (!('caches' in window)) return;
    caches.keys().then(function (keys) {
      var names = keys.filter(function (k) { return k.indexOf('heytools-app-') === 0; }).sort();
      if (!names.length) return;
      return caches.open(names.pop()).then(function (c) {
        return Promise.all(TOOLS.filter(function (t) { return !t.external; }).map(function (t) {
          return c.match('../' + t.id + '/', { ignoreSearch: true }).then(function (r) { saved[t.id] = !!r; });
        }));
      });
    }).then(paintSaved).catch(function () {});
  }
  function paintSaved() {
    var nodes = document.querySelectorAll('[data-saved]');
    for (var i = 0; i < nodes.length; i++) {
      var id = nodes[i].getAttribute('data-saved'), t = byId[id];
      if (t.net === 'online') { nodes[i].textContent = 'Always needs internet'; nodes[i].className = 'saved'; }
      else if (saved[id]) { nodes[i].textContent = NATIVE.isNative ? '✓ Built into the app' : '✓ Saved on this device'; nodes[i].className = 'saved ok'; }
      else { nodes[i].textContent = 'First time needs internet'; nodes[i].className = 'saved'; }
    }
  }

  /* ---------- filtering ---------- */
  function visibleTools() { return LAYOUT.order.filter(function (id) { return !isHidden(id); }).map(function (id) { return byId[id]; }); }
  function matches(t) {
    if (netFilter !== 'all' && t.net !== netFilter) return false;
    if (cat !== 'all' && t.cat !== cat) return false;
    var term = q.value.trim().toLowerCase();
    if (!term) return true;
    var hay = (t.name + ' ' + t.desc + ' ' + catLabel[t.cat] + ' ' + NET[t.net]).toLowerCase();
    return term.split(/\s+/).every(function (w) { return hay.indexOf(w) !== -1; });
  }
  function linkAttrs(t, cls) {
    return t.external ? { 'class': cls, href: t.external, target: '_blank', rel: 'noopener noreferrer' } : { 'class': cls, href: '#/' + t.id };
  }

  /* ---------- rendering ---------- */
  function render() {
    renderCats(); renderNav(); renderGrid(); renderTray(); paintSaved();
    var hidden = LAYOUT.hidden.length;
    $('homeSub').textContent = visibleTools().length + ' tools' + (hidden ? ' · ' + hidden + ' hidden' : '') + (NATIVE.isNative ? '' : ' · private, on your device');
    var active = netFilter !== 'all' ? 1 : 0;
    $('filterCount').hidden = !active; $('filterCount').textContent = active;
  }
  function renderCats() {
    var box = $('cats'); box.textContent = '';
    if (editing) { box.hidden = true; return; }
    box.hidden = false;
    var present = {}; visibleTools().forEach(function (t) { present[t.cat] = 1; });
    if (cat !== 'all' && !present[cat]) cat = 'all';
    [{ id: 'all', label: 'All' }].concat(CATS.filter(function (c) { return present[c.id]; })).forEach(function (c) {
      var b = el('button', { 'class': 'chip-btn', type: 'button', role: 'tab', 'aria-selected': String(cat === c.id), text: c.label });
      b.addEventListener('click', function () { cat = c.id; render(); });
      box.appendChild(b);
    });
  }
  function renderNav() {
    nav.textContent = '';
    var list = visibleTools().filter(function (t) {
      var term = q.value.trim().toLowerCase();
      return !term || (t.name + ' ' + t.desc).toLowerCase().indexOf(term) !== -1;
    });
    list.forEach(function (t) {
      var a = el('a', linkAttrs(t, 'nav-item'), [ico(t), el('span', { 'class': 'nm', text: t.name }), el('span', { 'class': 'dot ' + t.net, title: NET[t.net] })]);
      if (t.id === current) a.setAttribute('aria-current', 'page');
      nav.appendChild(a);
    });
    if (!list.length) nav.appendChild(el('p', { 'class': 'empty', text: 'No tools found.' }));
  }
  function card(t) {
    var chips = el('div', { 'class': 'chips' }, [el('span', { 'class': 'chip ' + t.net, text: NET[t.net] })]);
    if (t.perm) chips.appendChild(el('span', { 'class': 'chip perm', text: PERM_LABEL[t.perm] }));
    if (t.isNew) chips.appendChild(el('span', { 'class': 'chip new', text: 'New' }));
    var main = el('a', linkAttrs(t, 'tool-main'), [ico(t), el('span', { 'class': 'meta' }, [el('span', { 'class': 'name', text: t.name }), el('span', { 'class': 'desc', text: t.desc })])]);
    var a = el('article', { 'class': 'tool', 'data-id': t.id }, [
      main, chips,
      t.netNote ? el('div', { 'class': 'note-line', text: t.netNote }) : null,
      t.external ? el('div', { 'class': 'saved', text: 'Opens its own site. Needs internet.' }) : el('div', { 'class': 'saved', 'data-saved': t.id })
    ]);
    var h = el('button', { 'class': 'handle', type: 'button', 'aria-label': 'Drag to reorder ' + t.name + '. With the keyboard, use arrow keys.', title: 'Drag to reorder' }); h.textContent = '⠿';
    var e = el('button', { 'class': 'eye', type: 'button', 'aria-label': 'Hide ' + t.name, title: 'Hide' }); e.textContent = 'Hide';
    a.appendChild(h); a.appendChild(e);
    return a;
  }
  function renderGrid() {
    grid.textContent = '';
    var list = editing ? visibleTools() : visibleTools().filter(matches);
    list.forEach(function (t) { grid.appendChild(card(t)); });
    var empty = $('empty');
    empty.hidden = list.length > 0;
    if (!list.length) empty.textContent = visibleTools().length ? 'No tools match. Clear the search or filter.' : 'Every tool is hidden. Tap Customize to bring some back.';
    document.body.classList.toggle('editing', editing);
  }
  function renderTray() {
    var tray = $('tray'), box = $('trayList');
    box.textContent = '';
    var hid = LAYOUT.hidden.map(function (id) { return byId[id]; });
    tray.hidden = !(editing && hid.length);
    hid.forEach(function (t) {
      var b = el('button', { 'class': 'tray-item', type: 'button', 'aria-label': 'Show ' + t.name }, [ico(t), el('span', { text: t.name + '  +' })]);
      b.addEventListener('click', function () { setHidden(t.id, false); });
      box.appendChild(b);
    });
  }
  function setHidden(id, hide) {
    var i = LAYOUT.hidden.indexOf(id);
    if (hide && i === -1) LAYOUT.hidden.push(id);
    if (!hide && i !== -1) LAYOUT.hidden.splice(i, 1);
    saveLayout(); applyPrefs(); render();
  }

  /* ---------- customize mode: drag to reorder, hide / unhide ---------- */
  function setEditing(on) {
    editing = on;
    if (on) { q.value = ''; netFilter = 'all'; cat = 'all'; $('filterPanel').hidden = true; $('filterBtn').setAttribute('aria-expanded', 'false'); if (location.hash && location.hash !== '#/') location.hash = '#/'; }
    $('editBar').hidden = !on; $('filterBtn').hidden = on; $('customizeBtn').hidden = on; $('firstNote').hidden = on;
    render();
  }
  function persistOrderFromDom() {
    var ids = [].map.call(grid.querySelectorAll('.tool'), function (n) { return n.getAttribute('data-id'); });
    LAYOUT.order = ids.concat(LAYOUT.order.filter(function (id) { return ids.indexOf(id) === -1; }));
    saveLayout();
  }
  var drag = null, raf = 0;
  grid.addEventListener('pointerdown', function (e) {
    if (!editing) return;
    var eye = e.target.closest('.eye');
    if (eye) { setHidden(eye.closest('.tool').getAttribute('data-id'), true); return; }
    var h = e.target.closest('.handle'); if (!h) return;
    e.preventDefault();
    var cardEl = h.closest('.tool'), r = cardEl.getBoundingClientRect();
    drag = { card: cardEl, gx: e.clientX - r.left, gy: e.clientY - r.top, x: e.clientX, y: e.clientY, id: e.pointerId, handle: h };
    cardEl.classList.add('dragging');
    try { h.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    moveDrag();
    raf = requestAnimationFrame(loop);
  });
  grid.addEventListener('pointermove', function (e) { if (drag && e.pointerId === drag.id) { drag.x = e.clientX; drag.y = e.clientY; moveDrag(); } });
  function endDrag(e) {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    cancelAnimationFrame(raf);
    drag.card.classList.remove('dragging'); drag.card.style.transform = '';
    drag = null; persistOrderFromDom();
  }
  grid.addEventListener('pointerup', endDrag);
  grid.addEventListener('pointercancel', endDrag);
  function moveDrag() {
    if (!drag) return;
    var c = drag.card;
    c.style.transform = '';
    var cards = [].slice.call(grid.querySelectorAll('.tool')).filter(function (n) { return n !== c; });
    for (var i = 0; i < cards.length; i++) {
      var b = cards[i].getBoundingClientRect();
      if (drag.x >= b.left && drag.x <= b.right && drag.y >= b.top && drag.y <= b.bottom) {
        var targetIsBefore = !!(c.compareDocumentPosition(cards[i]) & Node.DOCUMENT_POSITION_PRECEDING);
        grid.insertBefore(c, targetIsBefore ? cards[i] : cards[i].nextSibling);
        break;
      }
    }
    var n = c.getBoundingClientRect();
    c.style.transform = 'translate(' + (drag.x - drag.gx - n.left) + 'px,' + (drag.y - drag.gy - n.top) + 'px)';
  }
  function loop() {                                   // scroll the page while dragging near an edge
    if (!drag) return;
    var home = $('home'), r = home.getBoundingClientRect(), edge = 70, speed = 0;
    if (drag.y < r.top + edge) speed = -Math.ceil((r.top + edge - drag.y) / 5);
    else if (drag.y > r.bottom - edge) speed = Math.ceil((drag.y - (r.bottom - edge)) / 5);
    if (speed) { home.scrollTop += speed; moveDrag(); }
    raf = requestAnimationFrame(loop);
  }
  grid.addEventListener('keydown', function (e) {       // keyboard reordering
    var h = e.target.closest && e.target.closest('.handle'); if (!editing || !h) return;
    var c = h.closest('.tool'), prev = e.key === 'ArrowLeft' || e.key === 'ArrowUp', next = e.key === 'ArrowRight' || e.key === 'ArrowDown';
    if (!prev && !next) return;
    e.preventDefault();
    if (prev && c.previousElementSibling) grid.insertBefore(c, c.previousElementSibling);
    if (next && c.nextElementSibling) grid.insertBefore(c, c.nextElementSibling.nextSibling);
    persistOrderFromDom(); h.focus();
  });
  grid.addEventListener('click', function (e) {
    var eye = editing && e.detail === 0 && e.target.closest('.eye');   // keyboard activation
    if (eye) setHidden(eye.closest('.tool').getAttribute('data-id'), true);
  });
  $('customizeBtn').addEventListener('click', function () { setEditing(true); });
  $('doneEdit').addEventListener('click', function () { setEditing(false); });
  $('resetLayout').addEventListener('click', function () {
    if (!confirm('Reset to the default order and show all tools?')) return;
    LAYOUT = { order: TOOLS.map(function (t) { return t.id; }), hidden: [] }; saveLayout(); applyPrefs(); render();
  });
  $('sheetReset').addEventListener('click', function () { $('resetLayout').click(); });

  /* ---------- filter ---------- */
  $('filterBtn').addEventListener('click', function () {
    var p = $('filterPanel'); p.hidden = !p.hidden;
    $('filterBtn').setAttribute('aria-expanded', String(!p.hidden));
  });
  document.querySelectorAll('[data-net]').forEach(function (b) {
    b.addEventListener('click', function () { netFilter = b.getAttribute('data-net'); syncFilterButtons(); render(); });
  });
  function syncFilterButtons() {
    document.querySelectorAll('[data-net]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-net') === netFilter)); });
  }
  q.addEventListener('input', function () { render(); });
  q.addEventListener('keydown', function (e) { if (e.key === 'Enter') { var f = nav.querySelector('.nav-item'); if (f) f.click(); } });

  /* ---------- settings sheet ---------- */
  function openSheet() { applyPrefs(); $('sheetWrap').hidden = false; $('closeSheet').focus(); }
  function closeSheet() { $('sheetWrap').hidden = true; }
  $('openSettings').addEventListener('click', function () { closeSide(); openSheet(); });
  $('topSettings').addEventListener('click', openSheet);
  $('closeSheet').addEventListener('click', closeSheet);
  $('sheetScrim').addEventListener('click', closeSheet);
  $('sheetCustomize').addEventListener('click', function () { closeSheet(); showHome(); setEditing(true); });

  /* ---------- permission gate ---------- */
  var PKEY = 'heytools.perm.';
  function permDone(id) { try { return localStorage.getItem(PKEY + id) === '1'; } catch (e) { return false; } }
  function setPermDone(id) { try { localStorage.setItem(PKEY + id, '1'); } catch (e) { /* ignore */ } }
  var pendingFiles = null;
  var GATE = {
    video:  { title: 'Allow access to your videos', web: 'Pick the folder where your videos live (for example Movies or DCIM). HeyTools lists every video inside it. Files are never uploaded.', nat: 'HeyTools will find every video on this phone so you can play them. Files are never uploaded.', ok: 'Allow access' },
    audio:  { title: 'Allow access to your music', web: 'Pick your Music folder. HeyTools adds every song inside it to the player. Files are never uploaded.', nat: 'HeyTools will find every song on this phone so you can play them. Files are never uploaded.', ok: 'Allow access' },
    camera: { title: 'Allow the camera', web: 'The scanner reads codes from your camera on this device. Nothing is recorded or uploaded.', nat: 'The scanner reads codes from your camera on this device. Nothing is recorded or uploaded.', ok: 'Allow camera' },
    mic:    { title: 'Allow microphone and camera', web: 'The recorder needs these to capture voice and video. Recordings stay on your device.', nat: 'The recorder needs these to capture voice and video. Recordings stay on your device.', ok: 'Allow access' },
    motion: { title: 'Allow motion sensors', web: 'This tool reads your phone sensors to find direction and tilt. Nothing leaves your device.', nat: 'This tool reads your phone sensors to find direction and tilt. Nothing leaves your device.', ok: 'Allow sensors' }
  };
  var MEDIA_AUDIO = /\.(mp3|m4a|aac|wav|flac|ogg|oga|opus|weba)$/i;
  function idbPut(handle) {
    return new Promise(function (res) {
      try {
        var r = indexedDB.open('vp3', 1);
        r.onupgradeneeded = function () { r.result.createObjectStore('d', { keyPath: 'name' }); };
        r.onsuccess = function () {
          var tx = r.result.transaction('d', 'readwrite');
          tx.objectStore('d').put({ name: handle.name, handle: handle });
          tx.oncomplete = function () { res(true); }; tx.onerror = tx.onabort = function () { res(false); };
        };
        r.onerror = function () { res(false); };
      } catch (e) { res(false); }
    });
  }
  async function walkAudio(dir, out) {
    for await (var entry of dir.entries()) {
      if (out.length > 5000) return;
      var n = entry[0], h = entry[1];
      if (h.kind === 'directory') { if (n.charAt(0) !== '.') await walkAudio(h, out); }
      else if (MEDIA_AUDIO.test(n)) { try { out.push(await h.getFile()); } catch (e) { /* skip */ } }
    }
  }
  function pickFilesFallback(accept) {
    return new Promise(function (res) {
      var i = document.createElement('input'); i.type = 'file'; i.multiple = true; i.accept = accept;
      i.onchange = function () { res([].slice.call(i.files)); }; i.oncancel = function () { res([]); }; i.click();
    });
  }
  function stopTracks(st) { st.getTracks().forEach(function (x) { x.stop(); }); }
  function askPermission(t, msg) {
    var kind = t.perm;
    if (NATIVE.isNative && (kind === 'video' || kind === 'audio')) {
      return NATIVE.ensure(kind).then(function (ok) { if (!ok) throw new Error('denied'); });
    }
    if (kind === 'video') {
      if (window.showDirectoryPicker) {
        return showDirectoryPicker({ id: 'vp-media', mode: 'read', startIn: 'videos' })
          .catch(function (e) { if (e.name === 'TypeError') return showDirectoryPicker({ mode: 'read' }); throw e; })
          .then(function (h) { return idbPut(h); });
      }
      msg.textContent = 'This browser cannot open folders. Use Import in the player to select videos.';
      return Promise.resolve();
    }
    if (kind === 'audio') {
      if (window.showDirectoryPicker) {
        return showDirectoryPicker({ id: 'mp-media', mode: 'read', startIn: 'music' })
          .catch(function (e) { if (e.name === 'TypeError') return showDirectoryPicker({ mode: 'read' }); throw e; })
          .then(function (h) { var out = []; msg.textContent = 'Reading your music…'; return walkAudio(h, out).then(function () { pendingFiles = out; }); });
      }
      return pickFilesFallback('audio/*').then(function (f) { pendingFiles = f; });
    }
    if (kind === 'camera' || kind === 'mic') {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return Promise.resolve();
      return navigator.mediaDevices.getUserMedia(kind === 'mic' ? { audio: true, video: true } : { video: { facingMode: 'environment' } })
        .then(stopTracks)
        .catch(function (e) {
          if (kind === 'mic') return navigator.mediaDevices.getUserMedia({ audio: true }).then(stopTracks);
          throw e;
        });
    }
    if (kind === 'motion') {
      var D = window.DeviceOrientationEvent;
      if (D && typeof D.requestPermission === 'function') return D.requestPermission().then(function (r) { if (r !== 'granted') throw new Error('denied'); });
    }
    return Promise.resolve();
  }
  function showGate(t) {
    var g = GATE[t.perm], box = $('gate');
    box.textContent = '';
    var msg = el('p', { 'class': 'gate-msg', role: 'status', 'aria-live': 'polite' });
    var ok = el('button', { 'class': 'btn primary', type: 'button', text: g.ok });
    var later = el('button', { 'class': 'btn', type: 'button', text: 'Not now' });
    ok.addEventListener('click', function () {
      ok.disabled = true;
      Promise.resolve(askPermission(t, msg)).then(function () { setPermDone(t.id); hideGate(); loadTool(t); }).catch(function (e) {
        ok.disabled = false;
        msg.textContent = (e && e.name === 'AbortError') ? 'No folder chosen. Try again or tap Not now.' : 'Permission was not granted. You can allow it in your phone settings, or tap Not now.';
      });
    });
    later.addEventListener('click', function () { hideGate(); loadTool(t); });
    box.appendChild(el('div', { 'class': 'gate-card', role: 'dialog', 'aria-label': g.title }, [ico(t), el('h2', { text: g.title }), el('p', { text: NATIVE.isNative ? g.nat : g.web }), el('div', { 'class': 'row' }, [ok, later]), msg]));
    box.hidden = false; loading.classList.add('done'); ok.focus();
  }
  function hideGate() { $('gate').hidden = true; }

  /* ---------- opening tools ---------- */
  function loadTool(t) {
    var path = '../' + t.id + '/';
    loading.classList.remove('done');
    frame.title = t.name; frame.src = path; $('newTab').href = path;
  }
  function openTool(t) {
    current = t.id;
    $('home').hidden = true; $('frameWrap').hidden = false; $('actions').hidden = false;
    $('title').textContent = t.name; document.title = t.name + ' | HeyTools';
    editing = false; document.body.classList.remove('editing');
    renderNav();
    frame.src = 'about:blank';
    $('newTab').href = '../' + t.id + '/';
    if (t.perm && !permDone(t.id)) showGate(t); else { hideGate(); loadTool(t); }
  }
  function showHome() {
    current = null; frame.src = 'about:blank'; $('frameWrap').hidden = true; hideGate();
    $('home').hidden = false; $('actions').hidden = true; $('title').textContent = 'HeyTools';
    document.title = 'HeyTools | All your private tools in one app'; renderNav();
  }
  function route() {
    var id = decodeURIComponent((location.hash || '').replace(/^#\/?/, '')).replace(/\/$/, '');
    var t = byId[id];
    if (t && !t.external) openTool(t); else showHome();
    closeSide();
  }

  /* hide the page text (guides, FAQs, footers) so only the tool shows */
  function applyHide(t) {
    try {
      var d = frame.contentDocument; if (!d || !d.head || !t) return;
      var old = d.getElementById('hey-hide'); if (old) old.remove();
      if (PREFS.text) return;
      var css = (t.hide || 'footer').split(',').map(function (s) { return s.trim(); }).filter(Boolean).map(function (s) { return s + '{display:none!important}'; }).join('\n');
      var s = d.createElement('style'); s.id = 'hey-hide'; s.textContent = css; d.head.appendChild(s);
    } catch (e) { /* cross-origin */ }
  }

  /* hand phone media to the players (Android app) */
  function pushNativeMedia(t) {
    if (!NATIVE.isNative || (t.perm !== 'video' && t.perm !== 'audio')) return;
    var kind = t.perm;
    NATIVE.has(kind).then(function (ok) {
      if (!ok) return;
      return NATIVE.scan(kind).then(function (items) {
        var w = frame.contentWindow, msg = { type: 'heytools:native-' + kind, items: items };
        var send = function () { try { if (current === t.id) w.postMessage(msg, location.origin); } catch (e) { /* ignore */ } };
        send(); setTimeout(send, 1500); setTimeout(send, 4000);     // players finish loading their own library at different speeds; repeats are ignored
      });
    }).catch(function () {});
  }

  var BASE = new URL('../', location.href).pathname;
  function interceptLinks(doc) {
    doc.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (!a || (a.target && a.target !== '_self')) return;
      var u; try { u = new URL(a.getAttribute('href'), a.ownerDocument.baseURI); } catch (err) { return; }
      if (u.origin !== location.origin) return;
      var rel = u.pathname.indexOf(BASE) === 0 ? u.pathname.slice(BASE.length) : u.pathname.replace(/^\//, '');
      var seg = rel.split('/')[0];
      if (seg === 'app' || a.getAttribute('href').charAt(0) === '#' || seg === current) return;
      if (seg === '' || seg === 'index.html') { e.preventDefault(); location.hash = '#/'; }
      else if (byId[seg] && !byId[seg].external) { e.preventDefault(); location.hash = '#/' + seg; }
    }, true);
  }
  frame.addEventListener('load', function () {
    if (frame.getAttribute('src') === 'about:blank' || !current) return;
    if (!$('gate').hidden) return;
    var t = byId[current];
    applyHide(t);
    loading.classList.add('done');
    if (pendingFiles && pendingFiles.length && current === 'music-player') {
      try { frame.contentWindow.postMessage({ type: 'heytools:files', files: pendingFiles }, location.origin); } catch (err) { /* ignore */ }
      pendingFiles = null;
    }
    pushNativeMedia(t);
    try { interceptLinks(frame.contentDocument); } catch (err) { /* ignore */ }
  });

  /* ---------- toolbar ---------- */
  $('reload').addEventListener('click', function () {
    if (!current) return; loading.classList.remove('done');
    try { frame.contentWindow.location.reload(); } catch (e) { frame.src = frame.src; }
  });
  $('full').addEventListener('click', function () {
    var f = frame.requestFullscreen || frame.webkitRequestFullscreen;
    if (f) { try { f.call(frame); } catch (e) { /* ignore */ } } else { window.open($('newTab').href, '_blank', 'noopener'); }
  });

  /* ---------- drawer ---------- */
  var appEl = $('app');
  function openSide() { appEl.classList.add('open'); }
  function closeSide() { appEl.classList.remove('open'); }
  $('openSide').addEventListener('click', openSide);
  $('closeSide').addEventListener('click', closeSide);
  $('scrim').addEventListener('click', closeSide);
  document.addEventListener('keydown', function (e) {
    var tag = (e.target && e.target.tagName) || '';
    if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') { e.preventDefault(); openSide(); q.focus(); }
    if (e.key === 'Escape') { closeSide(); closeSheet(); }
  });

  /* ---------- install, online note, service worker ---------- */
  var deferred = null, installBtn = $('install');
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; installBtn.hidden = false; });
  installBtn.addEventListener('click', function () { if (!deferred) return; deferred.prompt(); deferred.userChoice.finally(function () { deferred = null; installBtn.hidden = true; }); });
  window.addEventListener('appinstalled', function () { installBtn.hidden = true; });
  var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (isIOS && !standalone) $('iosHint').hidden = false;
  if (standalone || NATIVE.isNative) $('firstNote').querySelector('strong').textContent = NATIVE.isNative ? 'Everything is built into this app.' : 'First time needs internet.';
  if (NATIVE.isNative) $('firstNote').innerHTML = '<strong>Everything is built into this app.</strong> Tools marked <em>Works offline</em> run without a connection. Tools marked <em>Needs internet</em> or <em>Partly offline</em> use the network for some features.';
  function net() {
    $('netState').textContent = navigator.onLine ? 'Private by design. Tools run on your device.' : 'You are offline. Tools marked Works offline still run.';
  }
  window.addEventListener('online', net); window.addEventListener('offline', net); net();
  if (!NATIVE.isNative && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('../heytools-sw.js', { scope: '../' }).catch(function () {}); });
  }

  window.addEventListener('hashchange', route);
  applyPrefs(); syncFilterButtons(); render(); checkSaved(); route();
})();
