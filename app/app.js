(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var TOOLS = window.HEY_TOOLS, CATS = window.HEY_CATS, NATIVE = window.HeyNative || { isNative: false, hasMedia: false };
  var byId = {}, catLabel = {};
  TOOLS.forEach(function (t) { byId[t.id] = t; });
  CATS.forEach(function (c) { catLabel[c.id] = c.label; });

  var NET = { offline: 'Works offline', partial: 'Partly offline', online: 'Needs internet' };
  var PERM_LABEL = { video: 'Asks for your videos', audio: 'Asks for your music', camera: 'Asks for the camera', mic: 'Asks for mic + camera', motion: 'Asks for the motion sensor', geo: 'Asks for camera + location', torch: 'Asks for the camera (torch)' };

  /* ---------- themes (white and black by default) ---------- */
  var THEMES = [
    { id: 'light',    name: 'Light',    tone: 'light', bg: '#F5F5F7', panel: '#FFFFFF', panel2: '#F2F2F4', ink: '#1D1D1F', muted: '#6E6E73', line: '#E5E5EA', accent: '#0071E3', accentInk: '#FFFFFF' },
    { id: 'paper',    name: 'Paper',    tone: 'light', bg: '#FFFFFF', panel: '#FFFFFF', panel2: '#F4F4F4', ink: '#000000', muted: '#6B6B6B', line: '#E6E6E6', accent: '#000000', accentInk: '#FFFFFF' },
    { id: 'dark',     name: 'Dark',     tone: 'dark',  bg: '#000000', panel: '#1C1C1E', panel2: '#2C2C2E', ink: '#F5F5F7', muted: '#98989D', line: '#38383A', accent: '#2997FF', accentInk: '#000000' },
    { id: 'midnight', name: 'Midnight', tone: 'dark',  bg: '#000000', panel: '#0E0E10', panel2: '#1A1A1D', ink: '#FFFFFF', muted: '#8E8E93', line: '#232326', accent: '#F5F5F7', accentInk: '#000000' },
    { id: 'graphite', name: 'Graphite', tone: 'dark',  bg: '#1C1C1E', panel: '#2C2C2E', panel2: '#3A3A3C', ink: '#F2F2F7', muted: '#A1A1A6', line: '#48484A', accent: '#0A84FF', accentInk: '#FFFFFF' },
    { id: 'ocean',    name: 'Ocean',    tone: 'light', bg: '#EAF3FB', panel: '#FFFFFF', panel2: '#EEF5FB', ink: '#0B2540', muted: '#54708C', line: '#D5E4F2', accent: '#0A7AFF', accentInk: '#FFFFFF' },
    { id: 'forest',   name: 'Forest',   tone: 'light', bg: '#EDF4EE', panel: '#FFFFFF', panel2: '#F1F7F2', ink: '#11291A', muted: '#5A7364', line: '#D6E5DA', accent: '#1F8F4E', accentInk: '#FFFFFF' },
    { id: 'sunset',   name: 'Sunset',   tone: 'light', bg: '#FFF3EA', panel: '#FFFFFF', panel2: '#FFF6EF', ink: '#3A1D10', muted: '#8B6552', line: '#F5DFD0', accent: '#F26B2D', accentInk: '#FFFFFF' },
    { id: 'rose',     name: 'Rose',     tone: 'light', bg: '#FFF0F4', panel: '#FFFFFF', panel2: '#FFF5F8', ink: '#3B0F1F', muted: '#8C5B6A', line: '#F6D9E1', accent: '#E0245E', accentInk: '#FFFFFF' },
    { id: 'lavender', name: 'Lavender', tone: 'light', bg: '#F2EFFF', panel: '#FFFFFF', panel2: '#F6F4FF', ink: '#1F1747', muted: '#6B6590', line: '#E1DBF7', accent: '#6C4CF1', accentInk: '#FFFFFF' },
    { id: 'sand',     name: 'Sand',     tone: 'light', bg: '#F4EFE6', panel: '#FFFDF9', panel2: '#F7F2E9', ink: '#2A2113', muted: '#7A6D58', line: '#E7DEC9', accent: '#A06A1C', accentInk: '#FFFFFF' },
    { id: 'aurora',   name: 'Aurora',   tone: 'dark',  bg: '#06130F', panel: '#0D1F19', panel2: '#142A22', ink: '#E8FFF5', muted: '#86A99A', line: '#1D3A2E', accent: '#30D98B', accentInk: '#04130C' },
    { id: 'plum',     name: 'Plum',     tone: 'dark',  bg: '#12081C', panel: '#1C0F2A', panel2: '#26163A', ink: '#F6EDFF', muted: '#A48FBD', line: '#34214D', accent: '#BF5AF2', accentInk: '#12081C' }
  ];
  var themeById = {}; THEMES.forEach(function (t) { themeById[t.id] = t; });
  function rgba(hex, a) { var n = parseInt(hex.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; }

  /* ---------- storage ---------- */
  function get(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function put(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } }

  var PREFS = Object.assign({ theme: 'light', layout: 'grid', density: 'comfortable', desc: true, text: false, resume: true }, get('heytools.prefs.v2', {}));
  if (PREFS.theme !== 'auto' && !themeById[PREFS.theme]) PREFS.theme = 'light';
  var LAYOUT = get('heytools.layout.v1', { order: [], hidden: [] });
  var RECENT = get('heytools.recent.v1', []);
  function normalizeLayout() {
    var seen = {}, order = [];
    (LAYOUT.order || []).forEach(function (id) { if (byId[id] && !seen[id]) { seen[id] = 1; order.push(id); } });
    TOOLS.forEach(function (t) { if (!seen[t.id]) order.push(t.id); });       // new tools land at the end
    LAYOUT.order = order;
    LAYOUT.hidden = (LAYOUT.hidden || []).filter(function (id) { return byId[id]; });
    LAYOUT.pinned = (LAYOUT.pinned || []).filter(function (id, i, a) { return byId[id] && a.indexOf(id) === i; }).slice(0, 8);
  }
  normalizeLayout();
  RECENT = RECENT.filter(function (r) { return r && byId[r.id]; }).slice(0, 12);
  function saveLayout() { put('heytools.layout.v1', LAYOUT); }
  function savePrefs() { put('heytools.prefs.v2', PREFS); }
  function isHidden(id) { return LAYOUT.hidden.indexOf(id) !== -1; }

  /* ---------- state ---------- */
  var current = null, editing = false, netFilter = 'all', cat = 'all';
  var q = $('q'), nav = $('nav'), grid = $('grid'), loading = $('loading');

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k]; else if (k === 'class') n.className = attrs[k]; else n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function ico(t) { var i = el('span', { 'class': 'ico', 'data-cat': t.cat, 'aria-hidden': 'true' }); i.textContent = t.icon; return i; }
  var toastTimer = 0;
  function toast(msg) {
    var t = $('toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 2200);
  }

  /* ---------- tool address ----------
     The Android app serves files itself and answers any address without a file name (like /calculator/) with the home page,
     so inside the app every tool must be opened by its real file: /calculator/index.html */
  function toolPath(t) { return '../' + t.id + '/' + (NATIVE.isNative ? 'index.html' : ''); }

  /* ---------- theme + preferences ---------- */
  function resolveTheme() {
    if (PREFS.theme !== 'auto') return themeById[PREFS.theme];
    return themeById[window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'];
  }
  function applyTheme() {
    var t = resolveTheme(), s = document.documentElement.style;
    s.setProperty('--bg', t.bg); s.setProperty('--panel', t.panel); s.setProperty('--panel2', t.panel2);
    s.setProperty('--ink', t.ink); s.setProperty('--muted', t.muted); s.setProperty('--line', t.line);
    s.setProperty('--accent', t.accent); s.setProperty('--accent-ink', t.accentInk); s.setProperty('--glass', rgba(t.bg, 0.78));
    document.documentElement.setAttribute('data-theme', PREFS.theme);
    try { Object.keys(frames).forEach(function (k) { pushTheme(byId[k], frames[k]); }); } catch (e) { /* frames not ready yet */ }
    document.documentElement.setAttribute('data-tone', t.tone);
    var m = document.querySelector('meta[name=theme-color]'); if (m) m.setAttribute('content', t.bg);
  }
  function renderThemes() {
    var box = $('themes'); box.textContent = '';
    [{ id: 'auto', name: 'Auto', tone: 'light', bg: '#F5F5F7', panel: '#1C1C1E', accent: '#2997FF' }].concat(THEMES).forEach(function (t) {
      var sw = el('span', { 'class': 'sw' }, [el('i', { 'class': 'a' }), el('i', { 'class': 'b' }), el('i', { 'class': 'c' })]);
      sw.style.background = t.bg;
      sw.children[0].style.background = t.panel; sw.children[1].style.background = t.accent; sw.children[2].style.background = t.accent;
      if (t.id === 'auto') { sw.style.background = 'linear-gradient(105deg,#F5F5F7 50%,#000 50%)'; sw.children[0].style.background = '#fff'; sw.children[1].style.background = '#0071E3'; sw.children[2].style.background = '#2997FF'; }
      var b = el('button', { 'class': 'theme', type: 'button', role: 'radio', 'aria-checked': String(PREFS.theme === t.id), 'data-theme-id': t.id }, [sw, el('span', { 'class': 'tn', text: t.name })]);
      b.addEventListener('click', function () { PREFS.theme = t.id; savePrefs(); applyTheme(); renderThemes(); });
      box.appendChild(b);
    });
  }
  function applyPrefs() {
    var b = document.body;
    b.setAttribute('data-layout', PREFS.layout); b.setAttribute('data-density', PREFS.density); b.setAttribute('data-desc', PREFS.desc ? 'on' : 'off');
    applyTheme();
    var segs = document.querySelectorAll('.seg');
    for (var i = 0; i < segs.length; i++) {
      var key = segs[i].getAttribute('data-pref'), btns = segs[i].querySelectorAll('button');
      for (var j = 0; j < btns.length; j++) btns[j].setAttribute('aria-pressed', String(PREFS[key] === btns[j].getAttribute('data-v')));
    }
    $('optDesc').checked = !!PREFS.desc; $('optText').checked = !!PREFS.text; $('optResume').checked = PREFS.resume !== false;
    $('layoutInfo').textContent = (LAYOUT.hidden.length ? LAYOUT.hidden.length + ' hidden. ' : '') + 'Drag tiles to put the ones you use most first. Hide the ones you do not need.';
  }
  document.querySelectorAll('.seg').forEach(function (s) {
    s.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      PREFS[s.getAttribute('data-pref')] = b.getAttribute('data-v'); savePrefs(); applyPrefs();
    });
  });
  $('optDesc').addEventListener('change', function (e) { PREFS.desc = e.target.checked; savePrefs(); applyPrefs(); });
  $('optText').addEventListener('change', function (e) { PREFS.text = e.target.checked; savePrefs(); applyPrefs(); Object.keys(frames).forEach(function (k) { applyHide(byId[k], frames[k]); }); });
  $('optResume').addEventListener('change', function (e) { PREFS.resume = e.target.checked; savePrefs(); });
  if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { if (PREFS.theme === 'auto') applyTheme(); });

  /* ---------- recently used ---------- */
  function recordRecent(id) {
    RECENT = RECENT.filter(function (r) { return r.id !== id; });
    RECENT.unshift({ id: id, t: Date.now() });
    RECENT = RECENT.slice(0, 12); put('heytools.recent.v1', RECENT);
  }
  function ago(ts) {
    var m = Math.round((Date.now() - ts) / 60000);
    if (m < 1) return 'Just now'; if (m < 60) return m + ' min ago';
    var h = Math.round(m / 60); if (h < 24) return h + ' h ago';
    var d = Math.round(h / 24); return d === 1 ? 'Yesterday' : d + ' days ago';
  }
  function clearRecent() { RECENT = []; put('heytools.recent.v1', RECENT); render(); toast('History cleared'); }
  function renderRecent() {
    var box = $('recent'), row = $('recentRow');
    row.textContent = '';
    var list = RECENT.filter(function (r) { return !isHidden(r.id); }).slice(0, 8);
    var show = list.length && !editing && !q.value.trim() && netFilter === 'all' && cat === 'all';
    box.hidden = !show; if (!show) return;
    list.forEach(function (r) {
      var t = byId[r.id];
      row.appendChild(el('a', linkAttrs(t, 'rcard'), [ico(t), el('span', {}, [el('span', { 'class': 'nm', text: t.name }), el('span', { 'class': 'ago', text: ago(r.t) })])]));
    });
  }
  $('clearRecent').addEventListener('click', clearRecent);

  /* ---------- pinned tools: the few you open every day, one tap from the top ---------- */
  function isPinned(id) { return (LAYOUT.pinned || []).indexOf(id) !== -1; }
  function togglePin(id) {
    LAYOUT.pinned = LAYOUT.pinned || [];
    var i = LAYOUT.pinned.indexOf(id);
    if (i === -1) {
      if (LAYOUT.pinned.length >= 8) { toast('You can pin up to 8 tools'); return; }
      LAYOUT.pinned.push(id); toast('Pinned to the top');
    } else { LAYOUT.pinned.splice(i, 1); toast('Unpinned'); }
    saveLayout(); render();
    var b = grid.querySelector('[data-id="' + id + '"] .pin'); if (b) b.focus();
  }
  function renderPinned() {
    var box = $('pinned'), row = $('pinnedRow');
    row.textContent = '';
    var list = (LAYOUT.pinned || []).filter(function (id) { return !isHidden(id); }).map(function (id) { return byId[id]; });
    var show = list.length && !editing && !q.value.trim() && netFilter === 'all' && cat === 'all';
    box.hidden = !show; if (!show) return;
    list.forEach(function (t) {
      row.appendChild(el('a', linkAttrs(t, 'rcard'), [ico(t), el('span', {}, [el('span', { 'class': 'nm', text: t.name })])]));
    });
  }
  $('sheetClearRecent').addEventListener('click', function () { clearRecent(); });

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
    renderCats(); renderNav(); renderGrid(); renderPinned(); renderRecent(); renderTray(); paintSaved();
    var hidden = LAYOUT.hidden.length;
    $('homeSub').textContent = visibleTools().length + ' tools' + (hidden ? ' · ' + hidden + ' hidden' : '') + ' · Version 1.0';
    var active = netFilter !== 'all' ? 1 : 0;
    $('filterCount').hidden = !active; $('filterCount').textContent = active;
  }
  function renderCats() {
    var box = $('cats'); box.textContent = '';
    $('bar').hidden = editing;
    if (editing) return;
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
    visibleTools().forEach(function (t) {
      var a = el('a', linkAttrs(t, 'nav-item'), [ico(t), el('span', { 'class': 'nm', text: t.name }), el('span', { 'class': 'dot ' + t.net, title: NET[t.net] })]);
      if (t.id === current) a.setAttribute('aria-current', 'page');
      nav.appendChild(a);
    });
  }
  function card(t) {
    var nameEl = el('span', { 'class': 'name', text: t.name });
    if (t.isNew) nameEl.appendChild(el('span', { 'class': 'new', text: 'NEW' }));
    var main = el('a', linkAttrs(t, 'tool-main'), [ico(t), el('span', { 'class': 'meta' }, [nameEl, el('span', { 'class': 'desc', text: t.desc })])]);
    var status = el('div', { 'class': 'status' }, [el('span', { 'class': 'st ' + t.net }, [el('i', { 'class': 'dot ' + t.net }), document.createTextNode(NET[t.net])])]);
    if (t.external) { status.appendChild(el('span', { 'class': 'sep', text: '·' })); status.appendChild(el('span', { 'class': 'saved', text: 'Opens its own site' })); }
    else if (t.net !== 'online') { status.appendChild(el('span', { 'class': 'sep', text: '·' })); status.appendChild(el('span', { 'class': 'saved', 'data-saved': t.id })); }
    var extra = t.netNote || (t.perm ? PERM_LABEL[t.perm] : '');
    var a = el('article', { 'class': 'tool', 'data-id': t.id }, [main, extra ? el('div', { 'class': 'note-line', text: extra }) : null, status]);
    var h = el('button', { 'class': 'handle', type: 'button', 'aria-label': 'Drag to reorder ' + t.name + '. With the keyboard, use arrow keys.', title: 'Drag to reorder' }); h.textContent = '⠿';
    var e = el('button', { 'class': 'eye', type: 'button', 'aria-label': 'Hide ' + t.name, title: 'Hide' }); e.textContent = 'Hide';
    a.appendChild(h); a.appendChild(e);
    var pn = el('button', { 'class': 'pin', type: 'button', 'aria-pressed': String(isPinned(t.id)), 'aria-label': (isPinned(t.id) ? 'Unpin ' : 'Pin ') + t.name, title: isPinned(t.id) ? 'Unpin' : 'Pin to the top' });
    pn.textContent = isPinned(t.id) ? '★' : '☆';
    pn.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); togglePin(t.id); });
    a.appendChild(pn);
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
    if (on) { q.value = ''; netFilter = 'all'; cat = 'all'; $('filterPanel').hidden = true; $('filterBtn').setAttribute('aria-expanded', 'false'); if (current) location.hash = '#/'; }
    $('editBar').hidden = !on; $('firstNote').hidden = on; document.querySelector('.searchbox').hidden = on;
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
    drag = { card: cardEl, gx: e.clientX - r.left, gy: e.clientY - r.top, x: e.clientX, y: e.clientY, id: e.pointerId };
    cardEl.classList.add('dragging');
    try { h.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    moveDrag(); raf = requestAnimationFrame(loop);
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
    var home = $('home'), r = home.getBoundingClientRect(), edge = 80, speed = 0;
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
    LAYOUT = { order: TOOLS.map(function (t) { return t.id; }), hidden: [], pinned: LAYOUT.pinned || [] }; normalizeLayout(); saveLayout(); applyPrefs(); render();
  });
  $('sheetReset').addEventListener('click', function () { $('resetLayout').click(); });

  /* ---------- filter + search ---------- */
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
  q.addEventListener('keydown', function (e) { if (e.key === 'Enter') { var f = grid.querySelector('.tool-main'); if (f) f.click(); } });

  /* ---------- settings sheet ---------- */
  function sheetOpen() { return !$('sheetWrap').hidden; }
  function openSheet() { applyPrefs(); renderThemes(); if (window.paintSettingsExtras) window.paintSettingsExtras(); $('sheetWrap').hidden = false; $('closeSheet').focus(); }
  function closeSheet() { $('sheetWrap').hidden = true; }
  $('openSettings').addEventListener('click', openSheet);
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
    torch:  { title: 'Allow the camera for the torch', web: 'Phones switch the flashlight through the camera. Nothing is recorded or saved.', nat: 'Phones switch the flashlight through the camera. Nothing is recorded or saved.', ok: 'Allow camera' },
    geo:    { title: 'Allow camera and location', web: 'Geo Camera puts the place, time and weather on each photo. It needs the camera and your location. Photos stay on your device.', nat: 'Geo Camera puts the place, time and weather on each photo. It needs the camera and your location. Photos stay on your device.', ok: 'Allow access' },
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
    if (NATIVE.hasMedia && (kind === 'video' || kind === 'audio')) {
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
    if (kind === 'camera' || kind === 'mic' || kind === 'torch') {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return Promise.resolve();
      return navigator.mediaDevices.getUserMedia(kind === 'mic' ? { audio: true, video: true } : { video: { facingMode: 'environment' } })
        .then(stopTracks)
        .catch(function (e) {
          if (kind === 'mic') return navigator.mediaDevices.getUserMedia({ audio: true }).then(stopTracks);
          throw e;
        });
    }
    if (kind === 'geo') {
      var cam = (navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
        ? navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(stopTracks) : Promise.resolve();
      return cam.then(function () {                      // a refused location does not block the camera
        return new Promise(function (res) {
          if (!navigator.geolocation) return res();
          navigator.geolocation.getCurrentPosition(function () { res(); }, function () { res(); }, { timeout: 8000 });
        });
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
    box.appendChild(el('div', { 'class': 'gate-card', role: 'dialog', 'aria-label': g.title }, [ico(t), el('h2', { text: g.title }), el('p', { text: NATIVE.hasMedia ? g.nat : g.web }), el('div', { 'class': 'row' }, [ok, later]), msg]));
    box.hidden = false; loading.classList.add('done'); ok.focus();
  }
  function hideGate() { $('gate').hidden = true; }

  /* ---------- opening tools ---------- */
  /* ---------- one frame per tool ----------
     Leaving a tool that is playing music or video keeps its frame alive (hidden), so the sound does not stop.
     Every other tool is unloaded when you leave it, which keeps the phone fast. */
  var frames = {}, framesBox = $('frames'), svcOn = false, pendingMediaAction = null;
  function makeFrame(t) {
    var f = document.createElement('iframe');
    f.className = 'tool-frame'; f.title = t.name; f.setAttribute('data-id', t.id); f.setAttribute('allow', framesBox.getAttribute('data-allow') || ''); f.setAttribute('allowfullscreen', '');
    f.addEventListener('load', function () { onFrameLoad(t, f); });
    framesBox.appendChild(f); frames[t.id] = f; return f;
  }
  function showFrame(id) { Object.keys(frames).forEach(function (k) { frames[k].hidden = (k !== id); }); }
  function dropFrame(id) { var f = frames[id]; if (!f) return; try { f.src = 'about:blank'; } catch (e) { /* ignore */ } f.remove(); delete frames[id]; }
  function activeFrame() { return current ? frames[current] : null; }
  function mediaAvailable(f) {
    try {
      var d = f.contentDocument; if (!d) return false;
      if (d.body && d.body.classList.contains('playing')) return true;
      return d.body && d.body.dataset.mediaReady === 'true';
    } catch (e) { return false; }
  }
  function mediaPlaying(f) {
    try {
      var d = f.contentDocument; if (!d) return false;
      if (d.body && d.body.classList.contains('playing')) return true;
      var els = mediaEls(f);
      for (var i = 0; i < els.length; i++) if (!els[i].paused && !els[i].ended && els[i].readyState > 2) return true;
    } catch (e) { /* ignore */ }
    return false;
  }
  function leave(id) {
    var t = byId[id], f = frames[id]; if (!f) return;
    if (t && t.media && mediaAvailable(f)) { f.hidden = true; syncPlayback(); }
    else if (t && t.keep && keepBusy(f)) { f.hidden = true; syncPlayback(); }      // a long job (compressing, removing a background...) carries on out of sight
    else { dropFrame(id); syncPlayback(); }
  }
  /* the Android foreground service keeps the app alive while something plays; the bar lets you get back to it */
  function playingFrames() { return Object.keys(frames).filter(function (k) { return byId[k] && byId[k].media && mediaAvailable(frames[k]); }); }
  var hiddenAt = 0;
  /* Background and lock screen: when the app is hidden while a song or video plays, Android's own foreground player takes over the sound
     (it does not depend on the web page staying alive). When you come back, the page gets the position back and carries on. */
  var handoff = null;
  function plog(msg) {
    try {
      var l = JSON.parse(localStorage.getItem('heytools.playlog') || '[]'), t = new Date();
      l.push(('0' + t.getHours()).slice(-2) + ':' + ('0' + t.getMinutes()).slice(-2) + ':' + ('0' + t.getSeconds()).slice(-2) + ' ' + String(msg).slice(0, 110));
      localStorage.setItem('heytools.playlog', JSON.stringify(l.slice(-10)));
    } catch (e) { /* ignore */ }
  }
  function mediaEls(f) {
    var list = [];
    try { list = Array.prototype.slice.call(f.contentDocument.querySelectorAll('video,audio')); } catch (e) { /* ignore */ }
    try { (f.contentWindow.__heyMedia || []).forEach(function (e) { if (list.indexOf(e) < 0) list.push(e); }); } catch (e) { /* ignore */ }
    return list;
  }
  function playingElement(f) {
    try {
      var els = mediaEls(f), i;
      for (i = 0; i < els.length; i++) if (!els[i].paused && !els[i].ended && els[i].readyState > 2) return els[i];
      /* the page says it is playing but the element already stopped (the phone paused it as the screen went off): still hand it over */
      if (f.contentDocument.body.classList.contains('playing'))
        for (i = 0; i < els.length; i++) if (!els[i].ended && (els[i].currentSrc || els[i].src) && els[i].currentTime > 0) return els[i];
      plog('no playing audio (' + (f.contentDocument.body.dataset.mkind || 'nothing loaded') + '): ' + els.map(function (e) { return (e.paused ? 'paused' : 'playing') + '/rs' + e.readyState + '/' + String(e.currentSrc || e.src || 'no-src').slice(0, 12); }).join(', '));
    } catch (e) { /* ignore */ }
    return null;
  }
  /* A song picked on the phone lives in the page as a blob that Android's own player cannot open, so it is copied once into app storage. */
  var prepared = {};
  window.__heyLog = plog;
  window.__heyPrepare = function (blobUrl, blob) {
    try {
      if (!NATIVE.isNative || !NATIVE.cacheAudio || !blob || prepared[blobUrl] || blob.size > 400 * 1024 * 1024) return;
      var rec = prepared[blobUrl] = { ready: false, path: '' }, key = 'a' + blob.size + '_' + Date.now().toString(36), pos = 0, STEP = 384 * 1024;
      plog('copying song for background play (' + Math.round(blob.size / 1048576 * 10) / 10 + ' MB)');
      (function next() {
        if (pos >= blob.size && pos > 0) { rec.ready = true; plog('song copy ready'); return; }
        var r = new FileReader();
        r.onload = function () {
          var b64 = String(r.result).split(',')[1] || '';
          NATIVE.cacheAudio(key, b64, pos === 0).then(function (res) { rec.path = res && res.path; pos += STEP; if (pos >= blob.size) { rec.ready = true; plog('song copy ready'); } else setTimeout(next, 0); })
            .catch(function (e) { delete prepared[blobUrl]; plog('song copy failed: ' + ((e && e.message) || e)); });
        };
        r.onerror = function () { delete prepared[blobUrl]; plog('song copy failed: cannot read file'); };
        r.readAsDataURL(blob.slice(pos, pos + STEP));
      })();
    } catch (e) { plog('song copy error: ' + e); }
  };
  function nativeSource(src) {
    if (!src) return '';
    if (src.indexOf('blob:') === 0) { var p = prepared[src]; return p && p.ready && p.path ? 'file://' + p.path : ''; }
    var base = location.origin + '/_capacitor_file_';
    if (src.indexOf(base) === 0) { try { return 'file://' + decodeURIComponent(src.slice(base.length)); } catch (e) { return ''; } }
    if (/^https?:\/\//.test(src) && src.indexOf(location.origin) !== 0) return src;
    return '';                                                   // blob and embedded players cannot be handed over
  }
  function startHandoff(force) {
    if (handoff || !NATIVE.isNative || !NATIVE.startNativeAudio || (!force && !document.hidden)) return;
    var ids = playingFrames(); if (!ids.length) { if (Object.keys(frames).some(function (k) { return byId[k] && byId[k].media; })) plog('a player is open but not ready to hand over'); return; }
    var id = ids[0], f = frames[id], el = f && playingElement(f); if (!el) return;
    var src = nativeSource(el.currentSrc || el.src); if (!src) { plog(id + ': cannot hand over ' + String(el.currentSrc || el.src).slice(0, 14) + ((el.currentSrc || el.src || '').indexOf('blob:') === 0 ? ' (song copy not ready yet)' : '')); return; }
    plog('handing ' + id + ' to Android: ' + src.slice(-40));
    var d = null; try { d = f.contentDocument; } catch (e) { /* ignore */ }
    var tn = d && d.getElementById(id === 'music-player' ? 'nTitle' : 'tt'), ta = d && d.getElementById(id === 'music-player' ? 'nArtist' : 'mt');
    handoff = { id: id, el: el };
    f.__ctlAt = Date.now();
    var p = NATIVE.startNativeAudio(src, (tn && tn.textContent.trim()) || byId[id].name, (ta && ta.textContent.trim()) || byId[id].name, Math.round((el.currentTime || 0) * 1000));
    Promise.resolve(p).then(function () { setTimeout(function () { try { if (handoff && handoff.el === el) { f.__ctlAt = Date.now(); el.pause(); } } catch (e) { /* ignore */ } }, 350); })
      .catch(function (e) { handoff = null; plog('Android refused: ' + ((e && e.message) || e)); });
  }
  function endHandoff() {
    var h = handoff; if (!h) return; handoff = null;
    NATIVE.getNativeAudioState().then(function (s) {
      plog('back in app; Android player ' + (s && s.active ? ((s.playing ? 'was playing at ' : 'paused at ') + Math.round((s.position || 0) / 1000) + 's') : 'was not active') + (s && s.error ? ' | ' + s.error : ''));
      try { NATIVE.controlNativeAudio('stop'); } catch (e) { /* ignore */ }
      var el = h.el; if (!el || !el.isConnected || !s || !s.active) return;
      try { if (s.position > 0) el.currentTime = s.position / 1000; } catch (e) { /* ignore */ }
      if (s.playing) { try { var pr = el.play(); if (pr && pr.catch) pr.catch(function () {}); } catch (e) { /* ignore */ } }
    }).catch(function () { /* ignore */ });
  }
  function forwardMedia(action) {
    window.dispatchEvent(new CustomEvent('heytools:media-action', { detail: { action: action } }));
    if (document.hidden) setTimeout(startHandoff, 1800);        // the next song is a new file: hand that one over too
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { hiddenAt = Date.now(); startHandoff(); } else { endHandoff(); }
  });
  if (NATIVE.isNative) {
    if (NATIVE.onNativeAudioEnded) NATIVE.onNativeAudioEnded(function () { handoff = null; forwardMedia('next'); });
    if (NATIVE.onNativeMediaAction) NATIVE.onNativeMediaAction(function (ev) {
      var a = ev && ev.action; if (!a) return;
      handoff = null; try { NATIVE.controlNativeAudio('stop'); } catch (e) { /* ignore */ }
      forwardMedia(a);
    });
  }
  function guardMedia(f) {
    if (!f || f.__guard) return;
    var d; try { d = f.contentDocument; } catch (e) { return; }
    if (!d) return; f.__guard = true; f.__userAt = 0; f.__ctlAt = 0;
    ['pointerdown', 'touchstart', 'keydown', 'click'].forEach(function (n) { d.addEventListener(n, function () { f.__userAt = Date.now(); }, true); });
    var tries = 0;
    d.addEventListener('pause', function (e) {
      var m = e.target, now = Date.now();
      if (!m || m.ended || !hiddenAt || now - hiddenAt > 4000) { tries = 0; return; }     // only the pause that Android causes when the app is hidden
      if (now - f.__userAt < 1500 || now - f.__ctlAt < 2500) return;                       // the person (or the notification buttons) paused it
      if (tries++ > 3) return;
      setTimeout(function () { try { var p = m.play(); if (p && p.catch) p.catch(function () {}); } catch (err) { /* ignore */ } }, 200);
    }, true);
    d.addEventListener('playing', function () { tries = 0; }, true);
  }
  var currentMediaControlId = null;
  /* tools that run long jobs set <body data-busy="true"> while they work */
  function keepBusy(f) { try { return !!(f && f.contentDocument && f.contentDocument.body && f.contentDocument.body.dataset.busy === 'true'); } catch (e) { return false; } }
  var workOn = false;
  function syncWork() {
    var busy = Object.keys(frames).filter(function (k) { return byId[k] && byId[k].keep && keepBusy(frames[k]); });
    Object.keys(frames).forEach(function (k) { if (k !== current && byId[k] && byId[k].keep && busy.indexOf(k) === -1) dropFrame(k); });
    if (!NATIVE.isNative || !NATIVE.startWork) return;
    if (busy.length && !workOn) { workOn = true; NATIVE.startWork(byId[busy[0]].name + ' is working…', 'Keeps going if you switch to another app'); }
    else if (!busy.length && workOn) { workOn = false; NATIVE.stopWork(); }
  }
  function syncPlayback() {
    syncWork();
    var live = playingFrames();
    currentMediaControlId = live.length ? live[0] : null;
    if (currentMediaControlId) put('heytools.media.active', currentMediaControlId);
    Object.keys(frames).forEach(function (k) { if (k !== current && byId[k] && byId[k].media && live.indexOf(k) === -1) dropFrame(k); });   // paused and out of sight: free the memory
    var other = live.filter(function (k) { return k !== current; });
    var bar = $('nowp');
    if (other.length) {
      var t = byId[other[0]], tf = frames[t.id], td = null; try { td = tf && tf.contentDocument; } catch (e) { /* ignore */ }
      var tn = td && td.getElementById(t.id === 'music-player' ? 'nTitle' : 'tt'), ta = td && td.getElementById(t.id === 'music-player' ? 'nArtist' : 'mt');
      var isPlay = tf ? mediaPlaying(tf) : false;
      $('nowpName').textContent = (tn && tn.textContent.trim()) || t.name;
      $('nowpSub').textContent = ((ta && ta.textContent.trim()) ? ta.textContent.trim() + ' · ' : '') + t.name + (isPlay ? '' : ' · paused');
      $('nowpIco').textContent = t.icon; bar.setAttribute('data-id', t.id);
      var tg = $('nowpToggle'); tg.textContent = isPlay ? '⏸' : '▶'; tg.setAttribute('aria-label', isPlay ? 'Pause' : 'Play');
      bar.hidden = false;
    } else bar.hidden = true;
    live.forEach(function (k) { guardMedia(frames[k]); });
    if (live.length) {
      var mediaId = live[0], mediaFrame = frames[mediaId], mediaDoc = null;
      try { mediaDoc = mediaFrame && mediaFrame.contentDocument; } catch (e) {}
      var titleNode = mediaDoc && mediaDoc.getElementById(mediaId === 'music-player' ? 'nTitle' : 'tt');
      var artistNode = mediaDoc && mediaDoc.getElementById(mediaId === 'music-player' ? 'nArtist' : 'mt');
      var mediaTitle = titleNode ? titleNode.textContent : byId[mediaId].name;
      var mediaArtist = artistNode ? artistNode.textContent : 'Now playing';
      var mediaVideo = mediaDoc && mediaDoc.querySelector('video');
      var mediaIsPlaying = !!(mediaDoc && mediaDoc.body && mediaDoc.body.classList.contains('playing')) || !!(mediaVideo && !mediaVideo.paused && !mediaVideo.ended);
      if (!svcOn) { svcOn = true; NATIVE.startPlayback && NATIVE.startPlayback(mediaTitle, mediaArtist, mediaIsPlaying); }
      else { NATIVE.updatePlayback && NATIVE.updatePlayback(mediaTitle, mediaArtist, mediaIsPlaying); }
    }
    if (!live.length && svcOn) { svcOn = false; NATIVE.stopPlayback && NATIVE.stopPlayback(); }
  }
  if (window.HeyNotify) HeyNotify.on('action', function (action, n) {
    var group = n && n.extra && n.extra.group;
    var targets = { habit: 'habit-tracker', 'habit-snooze': 'habit-tracker', focus: 'focus-timer',
      todo: 'notes-to-do-list', 'todo-snooze': 'notes-to-do-list', timers: 'countdown-timers', 'alarm-snooze': 'alarm-clock',
      water: 'water-tracker', 'water-snooze': 'water-tracker' };
    var target = targets[group]; if (!target) return;
    var payload = { tool: target, group: group, action: action, notification: n, createdAt: Date.now() };
    var f = frames[target];
    if (f && f.contentWindow && f.dataset.ready === '1') {
      f.contentWindow.postMessage({ type: 'heytools:notification-action', payload: payload }, location.origin);
      if (current !== target) location.hash = '#/' + target;
    } else {
      put('heytools.pending.notification', payload);
      location.hash = '#/' + target;
    }
  });
  window.addEventListener('heytools:media-action', function (e) {
    if (!e.detail) return;
    var target = currentMediaControlId || get('heytools.media.active', 'music-player');
    var f = frames[target];
    if (!f || !f.contentWindow || f.dataset.ready !== '1') {
      pendingMediaAction = { target: target, action: e.detail.action };
      if (current !== target) location.hash = '#/' + target;
      return;
    }
    f.__ctlAt = Date.now();
    f.contentWindow.postMessage({ type: 'heytools:media-action', action: e.detail.action }, location.origin);
  });
  /* a screen recording that ends while Recorder is not on screen (for example, stopped from the notification) is handed to Recorder */
  if (NATIVE.isNative && NATIVE.onScreenFinished) {
    NATIVE.onScreenFinished(function (r) {
      put('heytools.screen.pending', r);
      var f = frames.recorder;
      if (f && f.contentWindow) { try { f.contentWindow.postMessage({ type: 'heytools:screen-finished' }, location.origin); } catch (e) { /* ignore */ } }
      toast('Screen recording finished. Open Recorder to find it.');
    });
  }
  /* called by the Android activity itself as it pauses / resumes, which is earlier and more reliable than the page's own hidden event */
  window.__heyPause = function () { hiddenAt = Date.now(); startHandoff(true); };
  window.__heyResume = function () { endHandoff(); };
  window.__HEYTOOLS_READY = true;
  setInterval(syncPlayback, 1500);
  $('nowpToggle').addEventListener('click', function () {
    var id = $('nowp').getAttribute('data-id'), f = id && frames[id]; if (!f || !f.contentWindow) return;
    f.__ctlAt = Date.now();
    try { f.contentWindow.postMessage({ type: 'heytools:media-action', action: 'toggle' }, location.origin); } catch (e) { /* ignore */ }
    setTimeout(syncPlayback, 350);
  });
  $('nowpOpen').addEventListener('click', function () { var id = $('nowp').getAttribute('data-id'); if (id) location.hash = '#/' + id; });
  $('nowpStop').addEventListener('click', function () { var id = $('nowp').getAttribute('data-id'); if (id) dropFrame(id); syncPlayback(); });

  /* ---------- opening tools ---------- */
  function loadTool(t) {
    loading.classList.remove('done');
    var f = makeFrame(t); showFrame(t.id);
    f.src = toolPath(t); $('newTab').href = toolPath(t);
  }
  function setChrome() {
    var inTool = !!current;
    $('backBtn').hidden = !inTool;
    $('topBrand').querySelector('img').hidden = inTool;
    $('actions').hidden = !inTool;
    $('newTab').hidden = !!NATIVE.isNative;
  }
  function openTool(t) {
    var prev = current; if (prev && prev !== t.id) leave(prev);
    current = t.id;
    $('home').hidden = true; $('frameWrap').hidden = false;
    $('title').textContent = t.name; document.title = t.name + ' | HeyTools';
    editing = false; document.body.classList.remove('editing');
    recordRecent(t.id); rememberLast(t.id); setChrome(); renderNav();
    if (frames[t.id]) { hideGate(); showFrame(t.id); loading.classList.add('done'); }          // still running: just show it again
    else { showFrame(null); if (t.perm && !permDone(t.id)) showGate(t); else { hideGate(); loadTool(t); } }
    syncPlayback();
  }
  function showHome() {
    var prev = current; current = null;
    if (prev) leave(prev);
    showFrame(null); $('frameWrap').hidden = true; hideGate();
    $('home').hidden = false; $('title').textContent = 'HeyTools';
    document.title = 'HeyTools | All your private tools in one app';
    rememberLast(null); setChrome(); render(); syncPlayback();
  }
  function route() {
    var id = decodeURIComponent((location.hash || '').replace(/^#\/?/, '')).replace(/\/$/, '');
    var t = byId[id];
    if (t && !t.external) openTool(t); else showHome();
  }

  /* hide the page text (guides, FAQs, footers) so only the tool shows */
  /* tools that share the HeyTools design follow the theme chosen in the app */
  function pushTheme(t, f) {
    try {
      if (!t || !t.themed || !f) return;
      var d = f.contentDocument; if (!d || !d.documentElement) return;
      var th = resolveTheme(), r = d.documentElement.style;
      r.setProperty('--bg', th.bg); r.setProperty('--panel', th.panel); r.setProperty('--panel2', th.panel2);
      r.setProperty('--ink', th.ink); r.setProperty('--muted', th.muted); r.setProperty('--line', th.line);
      r.setProperty('--accent', th.accent); r.setProperty('--accent-ink', th.accentInk); r.setProperty('color-scheme', th.tone);
    } catch (e) { /* ignore */ }
  }
  function applyHide(t, f) {
    try {
      var d = f && f.contentDocument; if (!d || !d.head || !t) return;
      var old = d.getElementById('hey-hide'); if (old) old.remove();
      if (PREFS.text) return;
      var css = ((t.hide || 'footer') + ',.hey-related').split(',').map(function (x) { return x.trim(); }).filter(Boolean).map(function (x) { return x + '{display:none!important}'; }).join('\n');
      var st = d.createElement('style'); st.id = 'hey-hide'; st.textContent = css; d.head.appendChild(st);
    } catch (e) { /* cross-origin */ }
  }

  /* hand phone media to the players (Android app) */
  function pushNativeMedia(t, f) {
    if (!NATIVE.hasMedia || (t.perm !== 'video' && t.perm !== 'audio')) return;
    var kind = t.perm;
    NATIVE.has(kind).then(function (ok) {
      if (!ok) return;
      return NATIVE.scan(kind).then(function (items) {
        var w = f.contentWindow, msg = { type: 'heytools:native-' + kind, items: items };
        var send = function () { try { if (frames[t.id] === f) w.postMessage(msg, location.origin); } catch (e) { /* ignore */ } };
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
  function onFrameLoad(t, f) {
    if (f.getAttribute('src') === 'about:blank') return;
    f.dataset.ready = '1';
    applyHide(t, f); pushTheme(t, f);
    try { interceptLinks(f.contentDocument); } catch (err) { /* ignore */ }
    if (NATIVE.hasSave) injectSaveBridge(f);
    if (pendingMediaAction && t.id === pendingMediaAction.target) {
      try { f.contentWindow.postMessage({ type: 'heytools:media-action', action: pendingMediaAction.action }, location.origin); pendingMediaAction = null; } catch (e) {}
    }
    var pendingAction = get('heytools.pending.notification', null);
    if (pendingAction && pendingAction.tool === t.id && Date.now() - pendingAction.createdAt < 86400000) {
      try {
        localStorage.removeItem('heytools.pending.notification');
        f.contentWindow.postMessage({ type: 'heytools:notification-action', payload: pendingAction }, location.origin);
      } catch (e) {}
    }
    if (current === t.id && $('gate').hidden) loading.classList.add('done');
    if (pendingFiles && pendingFiles.length && t.id === 'music-player') {
      try { f.contentWindow.postMessage({ type: 'heytools:files', files: pendingFiles }, location.origin); } catch (err) { /* ignore */ }
      pendingFiles = null;
    }
    pushNativeMedia(t, f);
  }

  /* ---------- "download" buttons inside tools -> real files on the phone (Android app) ----------
     A web view cannot save blob downloads by itself. This script is added to each tool; it catches those downloads
     and sends the file in small pieces to the app, which writes it to Downloads / Pictures / Movies / Music. */
  var SAVE_SCRIPT = '(function(){if(window.__heySave)return;window.__heySave=1;var CH=1200000;' +
    'function b64(blob){return new Promise(function(r){var fr=new FileReader();fr.onload=function(){r(String(fr.result).split(",")[1]||"")};fr.readAsDataURL(blob)})}' +
    'function send(a){var href=a.href,name=a.getAttribute("download")||"file",id=String(Date.now())+Math.random();' +
    'fetch(href).then(function(r){return r.blob()}).then(function(blob){var n=Math.max(1,Math.ceil(blob.size/CH)),i=0;' +
    '(function next(){b64(blob.slice(i*CH,(i+1)*CH)).then(function(d){parent.postMessage({type:"heytools:save",id:id,name:name,mime:blob.type||"",seq:i,last:i===n-1,data:d},location.origin);i++;if(i<n)setTimeout(next,0)})})()}).catch(function(){})}' +
    'function isFile(a){return a&&a.hasAttribute&&a.hasAttribute("download")&&/^(blob:|data:)/.test(a.href)}' +
    'document.addEventListener("click",function(e){var a=e.target&&e.target.closest&&e.target.closest("a[download]");if(isFile(a)){e.preventDefault();e.stopPropagation();send(a)}},true);' +
    'var oc=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(isFile(this)){send(this);return}return oc.apply(this,arguments)};' +
    'var od=HTMLAnchorElement.prototype.dispatchEvent;HTMLAnchorElement.prototype.dispatchEvent=function(ev){if(ev&&ev.type==="click"&&isFile(this)){send(this);return true}return od.apply(this,arguments)};})();';
  function injectSaveBridge(f) {
    try { var d = f.contentDocument, sc = d.createElement('script'); sc.textContent = SAVE_SCRIPT; (d.head || d.documentElement).appendChild(sc); } catch (e) { /* ignore */ }
  }
  var saves = Object.create(null);
  function isToolFrameSource(source) {
    return Object.keys(frames).some(function (id) {
      try { return !!frames[id] && frames[id].contentWindow === source; } catch (e) { return false; }
    });
  }
  window.addEventListener('message', function (e) {
    // Only accept save requests from this site's own registered tool frames.
    // Embedded third-party players and unrelated windows must never reach the native file-writing bridge.
    if (e.origin !== location.origin || !isToolFrameSource(e.source)) return;
    var d = e.data;
    if (!d || d.type !== 'heytools:save' || !NATIVE.hasSave) return;
    if (typeof d.id !== 'string' || !/^[A-Za-z0-9._-]{1,80}$/.test(d.id) ||
        !Number.isSafeInteger(d.seq) || d.seq < 0 || d.seq > 500 ||
        typeof d.name !== 'string' || d.name.length > 180 || /[\x00-\x1f]/.test(d.name) ||
        typeof d.mime !== 'string' || d.mime.length > 120 ||
        typeof d.data !== 'string' || d.data.length > 1600000 || !/^[A-Za-z0-9+/]*={0,2}$/.test(d.data) ||
        typeof d.last !== 'boolean') return;
    var sv = saves[d.id];
    if (!sv) {
      if (d.seq !== 0) return;
      if (Object.keys(saves).length >= 3) { toast('Finish the current file save before starting another'); return; }
      sv = saves[d.id] = { chain: Promise.resolve(), nid: null, nextSeq: 0, bytes: 0, failed: false };
    }
    if (d.seq !== sv.nextSeq) {
      sv.failed = true;
      sv.chain = sv.chain.catch(function () {}).then(function () {
        if (sv.nid && NATIVE.saveAbort) return NATIVE.saveAbort(sv.nid);
      }).catch(function () {}).then(function () { if (saves[d.id] === sv) delete saves[d.id]; });
      return;
    }
    sv.nextSeq++;
    sv.bytes += Math.floor(d.data.length * 3 / 4);
    if (sv.bytes > 536870912) {
      sv.failed = true;
      sv.chain = sv.chain.catch(function () {}).then(function () {
        if (sv.nid && NATIVE.saveAbort) return NATIVE.saveAbort(sv.nid);
      }).catch(function () {}).then(function () { if (saves[d.id] === sv) delete saves[d.id]; });
      toast('File is too large to save'); return;
    }
    sv.chain = sv.chain.then(function () {
      if (sv.failed) return;
      if (d.seq === 0) return NATIVE.saveStart(d.name, d.mime).then(function (r) { sv.nid = r.id; });
    }).then(function () {
      if (sv.failed) return;
      if (d.data) return NATIVE.saveChunk(sv.nid, d.data);
    }).then(function () {
      if (sv.failed) return;
      if (d.last) return NATIVE.saveFinish(sv.nid).then(function (r) { toast('Saved to ' + ((r && r.where) || 'your phone')); delete saves[d.id]; });
    }).catch(function () {
      sv.failed = true;
      return (sv.nid && NATIVE.saveAbort ? NATIVE.saveAbort(sv.nid).catch(function () {}) : Promise.resolve()).then(function () {
        toast('Could not save the file');
        if (saves[d.id] === sv) delete saves[d.id];
      });
    });
  });

  /* ---------- toolbar + Back button ---------- */
  $('reload').addEventListener('click', function () {
    var fr = activeFrame(); if (!fr) return; loading.classList.remove('done');
    try { fr.contentWindow.location.reload(); } catch (e) { fr.src = fr.src; }
  });
  $('full').addEventListener('click', function () {
    var fr = activeFrame(); if (!fr) return;
    var f = fr.requestFullscreen || fr.webkitRequestFullscreen;
    if (f) { try { f.call(fr); } catch (e) { /* ignore */ } } else if (!NATIVE.isNative) { window.open($('newTab').href, '_blank', 'noopener'); }
  });
  /* Back always steps back one screen: settings -> customize -> tool -> tool list. On the tool list a second press exits. */
  var lastBack = 0;
  function handleBack() {
    if (sheetOpen()) { closeSheet(); return; }
    if (editing) { setEditing(false); return; }
    if (document.fullscreenElement) { try { document.exitFullscreen(); } catch (e) { /* ignore */ } return; }
    if (current) { location.hash = '#/'; return; }
    if (q.value) { q.value = ''; render(); return; }
    if (NATIVE.isNative) {
      if (Date.now() - lastBack < 2000) {
        /* music or a video is open: leave the app in the background (like Home) instead of closing it, so the sound goes on */
        var busy = Object.keys(frames).some(function (k) { return byId[k] && byId[k].media && mediaAvailable(frames[k]); });
        if (busy && NATIVE.minimize && NATIVE.minimize()) { plog('back pressed: app minimised so media keeps playing'); return; }
        NATIVE.exit(); return;
      }
      lastBack = Date.now(); toast('Press back again to exit');
    }
  }
  $('backBtn').addEventListener('click', handleBack);
  NATIVE.onBack && NATIVE.onBack(handleBack);
  document.addEventListener('keydown', function (e) {
    var tag = (e.target && e.target.tagName) || '';
    if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA' && !current) { e.preventDefault(); q.focus(); }
    if (e.key === 'Escape') { if (sheetOpen()) closeSheet(); }
  });

  /* ---------- install, online note, service worker ---------- */
  var deferred = null, installBtns = document.querySelectorAll('.install-btn');
  function showInstall(on) { installBtns.forEach(function (b) { b.hidden = !on; }); }
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; showInstall(true); });
  installBtns.forEach(function (b) { b.addEventListener('click', function () { if (!deferred) return; deferred.prompt(); deferred.userChoice.finally(function () { deferred = null; showInstall(false); }); }); });
  window.addEventListener('appinstalled', function () { showInstall(false); });
  var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (isIOS && !standalone && !NATIVE.isNative) document.querySelectorAll('.ios-hint').forEach(function (n) { n.hidden = false; });
  if (NATIVE.isNative) $('firstNote').innerHTML = '<strong>Everything is built into this app.</strong> Tools marked <em>Works offline</em> run without a connection. Tools marked <em>Needs internet</em> or <em>Partly offline</em> use the network for some features.';
  function net() {
    var txt = navigator.onLine ? 'Private by design. Tools run on your device.' : 'You are offline. Tools marked Works offline still run.';
    document.querySelectorAll('.net-state').forEach(function (n) { n.textContent = txt; });
  }
  window.addEventListener('online', net); window.addEventListener('offline', net); net();
  if (!NATIVE.isNative && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('../heytools-sw.js', { scope: '../' }).catch(function () {});
      /* once the app is up, save every tool for offline use in the background (not on Data Saver) */
      navigator.serviceWorker.ready.then(function (reg) {
        var saver = navigator.connection && navigator.connection.saveData;
        if (reg.active && !saver) setTimeout(function () { try { reg.active.postMessage('precache-tools'); setTimeout(checkSaved, 15000); } catch (e) { /* ignore */ } }, 4000);
      });
    });
  }

  /* ---------- back up and restore ----------
     Saves the things you made (notes, to-dos, habits, expenses, alarms, settings) to a file, so a new install or a new phone can pick up where you stopped. */
  /* Never written to a backup file or restored from one: login tokens, install ids and notification plumbing. */
  var SKIP = /^(heytools\.(update|notif|perm|iid|last|pending|track|onboarded)|mp_sp|mp_sp_cid|mp_ver|__probe)/;
  var BACKUP_VERSION = 2, KEY_OK = /^[A-Za-z0-9_.:\-]{1,120}$/, MAX_VALUE = 1500000, MAX_TOTAL = 6000000, MAX_KEYS = 600;
  function collectBackup() {
    var data = {};
    for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (KEY_OK.test(k) && !SKIP.test(k)) data[k] = localStorage.getItem(k); }
    return { app: 'heytools', v: BACKUP_VERSION, saved: new Date().toISOString(), build: BUILD.run || 0, data: data };
  }
  function saveTextFile(name, text) {
    var b64 = btoa(unescape(encodeURIComponent(text)));
    if (NATIVE.hasSave) {
      NATIVE.saveStart(name, 'application/json').then(function (r) { return NATIVE.saveChunk(r.id, b64).then(function () { return NATIVE.saveFinish(r.id); }); })
        .then(function (r) { toast('Saved to ' + ((r && r.where) || 'your phone')); }).catch(function () { toast('Could not save the backup'); });
      return;
    }
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000); toast('Saving ' + name);
  }
  $('backupBtn').addEventListener('click', function () {
    var d = new Date(), p = function (n) { return String(n).padStart(2, '0'); };
    saveTextFile('heytools-backup-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '.json', JSON.stringify(collectBackup()));
  });
  $('restoreBtn').addEventListener('click', function () { $('restoreFile').click(); });
  $('restoreFile').addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
    if (f.size > 12 * 1024 * 1024) { toast('That file is too large to be a HeyTools backup'); return; }
    var fr = new FileReader();
    fr.onload = function () {
      var j; try { j = JSON.parse(fr.result); } catch (err) { toast('That is not a HeyTools backup'); return; }
      if (!j || j.app !== 'heytools' || !j.data || typeof j.data !== 'object' || Array.isArray(j.data)) { toast('That is not a HeyTools backup'); return; }
      if (typeof j.v === 'number' && j.v > BACKUP_VERSION) { toast('This backup is from a newer HeyTools. Update the app first.'); return; }
      /* only plain text values under safe names are restored, so a edited or hostile file cannot overwrite login tokens or flood storage */
      var keys = Object.keys(j.data).filter(function (k) { return KEY_OK.test(k) && !SKIP.test(k) && typeof j.data[k] === 'string' && j.data[k].length <= MAX_VALUE; });
      var total = keys.reduce(function (s, k) { return s + j.data[k].length; }, 0);
      if (!keys.length) { toast('Nothing to restore in that file'); return; }
      if (keys.length > MAX_KEYS || total > MAX_TOTAL) { toast('That backup is larger than HeyTools allows'); return; }
      if (!confirm('Restore ' + keys.length + ' saved items from the backup of ' + (j.saved ? String(j.saved).slice(0, 10) : 'an earlier day') + '? This replaces the matching data in this app.')) return;
      var failed = 0;
      keys.forEach(function (k) { try { localStorage.setItem(k, j.data[k]); } catch (err) { failed++; } });
      toast(failed ? 'Restored with ' + failed + ' items skipped (storage full)' : 'Backup restored'); setTimeout(function () { location.reload(); }, 900);
    };
    fr.readAsText(f);
  });

  /* ---------- remember where you stopped ---------- */
  var LASTKEY = 'heytools.last.v1';
  function rememberLast(id) { put(LASTKEY, { id: id, t: Date.now() }); }
  function resumeLast() {
    if (PREFS.resume === false || (location.hash || '').replace(/^#\/?/, '')) return;
    var l = get(LASTKEY, null);
    if (l && l.id && byId[l.id] && !byId[l.id].external) { try { history.replaceState(null, '', '#/' + l.id); } catch (e) { /* ignore */ } }
  }

  /* ---------- app version, updates, download button ---------- */
  var APK_URL = window.HEY_APK_URL || 'https://github.com/Mithunsg08/heytools/releases/download/android-latest/HeyTools.apk';
  var REL_API = 'https://api.github.com/repos/Mithunsg08/heytools/releases/tags/android-latest';
  var BUILD = { run: 0, built: 0 }, isAndroid = /android/i.test(navigator.userAgent);
  function loadBuild() {
    if (!NATIVE.isNative) return Promise.resolve();
    return fetch('build.json', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (j) BUILD = j; }).catch(function () {});
  }
  function setVerInfo() {
    $('verInfo').textContent = NATIVE.isNative ? 'HeyTools 1.0 for Android' + (BUILD.run ? ' · build ' + BUILD.run : '') : 'HeyTools 1.0 on the web.';
    $('getAppBtn2').hidden = !(isAndroid && !NATIVE.isNative);
    $('checkUpdate').hidden = !NATIVE.isNative;
    if (!NATIVE.isNative && isAndroid && !standalone) $('getApp').hidden = false;
  }
  function showUpdate(latest, asset) {
    var id = String(latest || asset.updated_at);
    $('updateMsg').textContent = 'A new version of HeyTools is ready.';
    $('updateBar').hidden = false;
    $('updateGo').onclick = function () { if (window.HeyTrack) HeyTrack.event('update_click'); NATIVE.openUrl(APK_URL); };
    $('updateLater').onclick = function () { $('updateBar').hidden = true; };
    if (get('heytools.update.seen', '') !== id) {                   // tell the person once per new version
      put('heytools.update.seen', id);
      if (window.HeyNotify && HeyNotify.isNative) HeyNotify.requestPermission().then(function () {
        HeyNotify.schedule([{ id: 99001, title: 'HeyTools update ready', body: 'Open HeyTools to download the new version.', at: Date.now() + 1500 }]);
      });
    }
  }
  function checkUpdate(manual) {
    if (!NATIVE.isNative) return;
    put('heytools.update.checked', Date.now());
    fetch(REL_API, { headers: { Accept: 'application/vnd.github+json' } }).then(function (r) { return r.json(); }).then(function (rel) {
      var asset = (rel.assets || []).filter(function (a) { return /\.apk$/i.test(a.name); })[0];
      if (!asset) { if (manual) toast('No update found'); return; }
      var m = (rel.body || '').match(/build\D{0,3}(\d+)/i), latest = m ? +m[1] : 0;
      var newer = (latest && BUILD.run) ? latest > BUILD.run : (BUILD.built ? Date.parse(asset.updated_at) - BUILD.built > 20 * 60 * 1000 : false);
      if (newer) showUpdate(latest, asset); else if (manual) toast('You have the latest version');
    }).catch(function () { if (manual) toast('Could not check. Are you online?'); });
  }
  $('checkUpdate').addEventListener('click', function () { checkUpdate(true); });
  function maybeCheckUpdate() { if (NATIVE.isNative && PREFS.autoUpdate !== false && Date.now() - get('heytools.update.checked', 0) > 3600 * 1000) checkUpdate(false); }
  NATIVE.onResume && NATIVE.onResume(function () { maybeCheckUpdate(); syncPlayback(); });


  /* ---------- notifications, privacy and first-run (new) ---------- */
  var HN = window.HeyNotify;
  var REMINDER_TOOLS = ['alarm-clock', 'notes-to-do-list', 'water-tracker', 'habit-tracker', 'focus-timer', 'countdown-timers'];
  var GROUPS = { alarm: ['alarm'], remind: ['todo', 'water', 'habit', 'focus'], timers: ['timers'] };

  /* Tools schedule their own reminders when they load. After a setting changes, load them quietly so every reminder is rebuilt right away. */
  function restoreReminders() {
    var box = document.createElement('div');
    box.setAttribute('aria-hidden', 'true'); box.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden';
    document.body.appendChild(box);
    REMINDER_TOOLS.forEach(function (id) {
      var t = byId[id]; if (!t) return;
      if (frames[id]) { try { frames[id].contentWindow.location.reload(); } catch (e) { /* ignore */ } return; }
      var f = document.createElement('iframe'); f.tabIndex = -1; f.title = ''; f.src = toolPath(t); box.appendChild(f);
    });
    setTimeout(function () { box.remove(); }, 5000);
  }
  function syncUpdateFlag() {
    if (!HN || !HN.setAutoUpdate) return;
    var p = HN.prefs(); HN.setAutoUpdate(PREFS.autoUpdate !== false && p.all && p.updates);
  }
  function setRel(id, label, state, btn) {
    var n = $(id); n.textContent = label + ': ' + (state === 'ok' ? 'Ready' : state === 'unknown' ? 'Could not check' : 'Needs attention');
    n.className = state === 'ok' ? 'ok' : state === 'bad' ? 'warn' : '';
    if (btn) $(btn).hidden = (state === 'ok');
  }
  function paintReliability() {
    if (!NATIVE.isNative || !HN) return;
    HN.permission().then(function (r) {
      setRel('relNotif', 'Notifications', r === 'granted' ? 'ok' : 'bad', 'relNotifBtn');
      if (r !== 'granted' && HN.notificationState) HN.notificationState().then(function (s) {
        if (s) $('relNotif').textContent += ' (Android says: notifications ' + (s.enabled ? 'on' : 'off') + ', permission ' + (s.runtime ? 'yes' : 'no') + ')';
      });
    });
    HN.exactPermission().then(function (r) { setRel('relExact', 'Exact alarms', r === 'granted' ? 'ok' : (r === 'unknown' ? 'unknown' : 'bad'), 'relExactBtn'); });
    if (HN.diagnose) HN.diagnose().then(function (d) {
      var n = $('relPend');
      n.textContent = 'Scheduled reminders: ' + (d.pending >= 0 ? d.pending : 'unknown') + (d.lastError ? ' (last problem: ' + String(d.lastError).slice(0, 80) + ')' : '');
      n.className = d.lastError ? 'warn' : '';
    });
    if (HN.notificationState) HN.notificationState().then(function (s) { var e = $('relAlarmLog'); if (e) e.textContent = 'Alarm log:\n' + ((s && s.alarmLog) || '(empty)') + '\n\nAndroid player log:\n' + ((s && s.playLog) || '(empty)'); });
    try { $('relLog').textContent = 'Playback log:\n' + (JSON.parse(localStorage.getItem('heytools.playlog') || '[]').join('\n') || '(empty)'); } catch (e) { /* ignore */ }
    if (NATIVE.appInfo) NATIVE.appInfo().then(function (i) { $('relBuild').textContent = 'Build: ' + (i ? i.build + ' (v' + i.version + ')' : 'unknown'); }).catch(function () { $('relBuild').textContent = 'Build: unknown'; });
    HN.batteryState().then(function (r) { setRel('relBatt', 'Battery', r === 'ok' ? 'ok' : (r === 'unknown' ? 'unknown' : 'bad'), 'relBattBtn'); });
  }
  function paintNotif() {
    var box = $('notifSet');
    if (!HN) { box.hidden = true; return; }
    var p = HN.prefs();
    $('nAll').checked = p.all; $('nAlarm').checked = p.alarm; $('nRemind').checked = p.remind; $('nTimers').checked = p.timers; $('nUpdates').checked = p.updates; $('nQuiet').checked = p.quiet;
    $('nFrom').value = p.qFrom; $('nTo').value = p.qTo;
    $('nTypes').classList.toggle('off', !p.all); $('quietTimes').hidden = !(p.quiet && p.all);
    $('relBox').hidden = !NATIVE.isNative;
    paintReliability();
  }
  function paintPrivacy() {
    var tracking = !!window.HEY_TRACK_URL;
    $('optTrack').closest('.mini-row').hidden = !tracking;
    $('optTrack').checked = localStorage.getItem('heytools.track.consent') === 'yes';
    $('autoUpdRow').hidden = !NATIVE.isNative; $('optAutoUpd').checked = PREFS.autoUpdate !== false;
    $('privLink').setAttribute('href', NATIVE.isNative ? '../privacy/index.html' : '../privacy/');
    $('licLink').setAttribute('href', NATIVE.isNative ? '../licenses/index.html' : '../licenses/');
  }
  window.paintSettingsExtras = function () { paintNotif(); paintPrivacy(); $('nMsg').textContent = ''; };

  /* turning one type off cancels what is already scheduled; turning it on (or changing quiet hours) rebuilds the reminders */
  function notifChanged(patch, turnedOff) {
    if (!HN) return;
    var before = HN.prefs(), after = HN.setPrefs(patch);
    if (!after.all) { HN.cancelAll(); }
    else Object.keys(GROUPS).forEach(function (k) { if (before[k] && !after[k]) GROUPS[k].forEach(function (g) { HN.cancelGroup(g); }); });
    var gotOn = (!before.all && after.all) || ['alarm', 'remind', 'timers'].some(function (k) { return !before[k] && after[k]; }) ||
      before.quiet !== after.quiet || before.qFrom !== after.qFrom || before.qTo !== after.qTo;
    if (gotOn && after.all) {
      var go = function () { restoreReminders(); toast('Reminders updated'); };
      if (!before.all) HN.requestPermission().then(go); else go();
    }
    syncUpdateFlag(); paintNotif();
  }
  $('nAll').addEventListener('change', function (e) {
    if (!e.target.checked && !confirm('Turn off ALL notifications? Alarms will not ring and reminders will not appear until you turn this back on.')) { e.target.checked = true; return; }
    notifChanged({ all: e.target.checked });
  });
  $('nAlarm').addEventListener('change', function (e) { notifChanged({ alarm: e.target.checked }); });
  $('nRemind').addEventListener('change', function (e) { notifChanged({ remind: e.target.checked }); });
  $('nTimers').addEventListener('change', function (e) { notifChanged({ timers: e.target.checked }); });
  $('nUpdates').addEventListener('change', function (e) { notifChanged({ updates: e.target.checked }); });
  $('nQuiet').addEventListener('change', function (e) { notifChanged({ quiet: e.target.checked }); });
  $('nFrom').addEventListener('change', function (e) { if (e.target.value) notifChanged({ qFrom: e.target.value }); });
  $('nTo').addEventListener('change', function (e) { if (e.target.value) notifChanged({ qTo: e.target.value }); });
  $('nTest').addEventListener('click', function () {
    if (!HN) return;
    HN.sendTest().then(function (r) {
      $('nMsg').textContent = r === 'sent' ? 'Test sent. It should appear in a few seconds.' : r === 'off' ? 'Notifications are switched off above. Turn them on first.' : 'Notifications are blocked. Allow them in your phone settings, then try again.';
      if (r === 'denied' && HN.notificationState) HN.notificationState().then(function (s) { if (s) $('nMsg').textContent += ' (Android reports: notifications ' + (s.enabled ? 'on' : 'off') + ', permission ' + (s.runtime ? 'yes' : 'no') + ', Android ' + s.sdk + ')'; });
      paintReliability();
    });
  });
  $('relNotifBtn').addEventListener('click', function () {
    /* Android only shows its permission dialog twice. After that the switch lives in the phone's settings, so open that page. */
    HN.requestPermission().then(function (r) { if (r !== 'granted') HN.openNotificationSettings(); paintReliability(); });
  });
  $('relExactBtn').addEventListener('click', function () { HN.requestExactPermission().then(paintReliability); });
  $('relBattBtn').addEventListener('click', function () { HN.openBatterySettings(); });
  $('relTest').addEventListener('click', function () {
    HN.testAlarm().then(function (r) {
      $('nMsg').textContent = r === 'scheduled' ? 'A test alarm will ring in 1 minute. Lock your phone and wait for it.' : r === 'unsupported' ? 'Alarm tests need the Android app.' : String(r);
    });
  });
  document.addEventListener('visibilitychange', function () { if (!document.hidden && sheetOpen()) paintReliability(); });
  /* coming back from the phone's own settings does not always count as "visible": listen to the app resume too, and re-check while the sheet is open */
  if (NATIVE.onResume) NATIVE.onResume(function () { if (sheetOpen()) paintReliability(); });
  window.addEventListener('focus', function () { if (sheetOpen()) paintReliability(); });
  setInterval(function () { if (!document.hidden && sheetOpen()) paintReliability(); }, 2000);
  $('optTrack').addEventListener('change', function (e) { try { localStorage.setItem('heytools.track.consent', e.target.checked ? 'yes' : 'no'); } catch (err) { /* ignore */ } });
  $('optAutoUpd').addEventListener('change', function (e) { PREFS.autoUpdate = e.target.checked; savePrefs(); syncUpdateFlag(); });
  syncUpdateFlag();

  /* delete everything HeyTools keeps on this device */
  $('wipeBtn').addEventListener('click', function () {
    if (!confirm('Delete ALL HeyTools data on this device? This removes notes, to-dos, habits, expenses, alarms, saved recordings, photos kept inside HeyTools, and every setting. It cannot be undone.')) return;
    if (!confirm('Last check: really delete everything?')) return;
    var jobs = [];
    Object.keys(frames).forEach(function (k) { dropFrame(k); });
    if (HN) jobs.push(HN.cancelAll());
    if (NATIVE.isNative && NATIVE.stopPlayback) NATIVE.stopPlayback();
    try { localStorage.clear(); sessionStorage.clear(); } catch (e) { /* ignore */ }
    if (window.indexedDB && indexedDB.databases) {
      jobs.push(indexedDB.databases().then(function (list) {
        return Promise.all(list.map(function (d) {
          return new Promise(function (res) { var r = indexedDB.deleteDatabase(d.name); r.onsuccess = r.onerror = r.onblocked = function () { res(); }; });
        }));
      }).catch(function () {}));
    }
    if (window.caches) jobs.push(caches.keys().then(function (ks) { return Promise.all(ks.map(function (n) { return caches.delete(n); })); }).catch(function () {}));
    if (!NATIVE.isNative && navigator.serviceWorker) jobs.push(navigator.serviceWorker.getRegistrations().then(function (rs) { return Promise.all(rs.map(function (r) { return r.unregister(); })); }).catch(function () {}));
    Promise.all(jobs).then(function () { location.replace(location.pathname); });
  });

  /* first-run: privacy in plain words, notification permission with a reason, and pinning */
  function startOnboarding() {
    if (get('heytools.onboarded.v1', false) || (location.hash || '').replace(/^#\/?/, '')) return;
    var wrap = $('onbWrap'), step = 0, steps = [$('onb1'), $('onb2'), $('onb3')], dots = wrap.querySelectorAll('.onb-dots i');
    var canAsk = !!(HN && (HN.isNative || typeof Notification !== 'undefined'));
    $('onbTrack').closest('.mini-row').hidden = !window.HEY_TRACK_URL;
    function show() {
      steps.forEach(function (s, i) { s.hidden = i !== step; });
      for (var i = 0; i < dots.length; i++) dots[i].className = i === step ? 'on' : '';
      $('onbNext').textContent = step === 0 ? 'Next' : step === 1 ? (canAsk ? 'Allow notifications' : 'Next') : 'Get started';
      $('onbSkip').hidden = step === 2;
    }
    function finish() {
      put('heytools.onboarded.v1', true);
      if (window.HEY_TRACK_URL) { try { localStorage.setItem('heytools.track.consent', $('onbTrack').checked ? 'yes' : 'no'); } catch (e) { /* ignore */ } }
      wrap.hidden = true;
    }
    $('onbNext').onclick = function () {
      if (step === 1 && canAsk) {
        put('heytools.notif.asked', true);
        // never wait on the system prompt, so onboarding can not get stuck. Alarms also need "Alarms & reminders", asked right after.
        try {
          HN.requestPermission().then(function () {
            if (!HN.exactPermission || !HN.requestExactPermission) return;
            return HN.exactPermission().then(function (s) { if (s === 'denied' || s === 'prompt') return HN.requestExactPermission(); });
          }).catch(function () {});
        } catch (e) { /* ignore */ }
        step++; show();
        return;
      }
      if (step < 2) { step++; show(); return; }
      finish();
    };
    $('onbSkip').onclick = finish;
    wrap.hidden = false; show(); $('onbNext').focus();
  }
  startOnboarding();

  window.addEventListener('hashchange', route);
  applyPrefs(); syncFilterButtons(); checkSaved(); resumeLast(); route();
  loadBuild().then(function () { setVerInfo(); maybeCheckUpdate(); });
  /* ask once for permission to show notifications (alarms, reminders and update alerts need it) */
  if (NATIVE.isNative && window.HeyNotify && !get('heytools.notif.asked', false) && get('heytools.onboarded.v1', false) && HeyNotify.prefs().all) {
    setTimeout(function () { put('heytools.notif.asked', true); HeyNotify.requestPermission(); }, 4000);
  }
  setVerInfo();
  if (window.HeyTrack && (NATIVE.isNative || standalone)) { try { if (!sessionStorage.getItem('hey.open')) { sessionStorage.setItem('hey.open', '1'); HeyTrack.event('app_open'); } } catch (e) { HeyTrack.event('app_open'); } }
})();
