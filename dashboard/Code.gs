/**
 * HeyTools private dashboard (Google Apps Script).
 *
 * WHAT IT DOES
 *   - Receives anonymous events from the website and the app (download clicks, app opens, updates).
 *   - Stores them in a Google Sheet that only YOUR Google account can open.
 *   - Shows a dashboard (downloads by device, by day, by page, plus the real GitHub download counts)
 *     behind a username + password.
 *
 * SECRETS
 *   The username and password are NOT in this file and must never be. Set them in
 *   Project Settings > Script properties:   DASH_EMAIL   and   DASH_PASS
 *   Nobody who reads this code (it is public on GitHub) can learn them.
 *
 * DEPLOY: Deploy > New deployment > Web app > Execute as: Me > Who has access: Anyone.
 */
var REPO = 'Mithunsg08/heytools';
var MAX_FAILS = 5;          // wrong passwords allowed...
var LOCK_SECONDS = 900;     // ...before logins pause for 15 minutes
var SESSION_SECONDS = 1800; // a login lasts 30 minutes
var EVENTS = { download_click: 1, app_open: 1, pwa_install: 1, update_click: 1 };

/* ---------- receiving events (called by the website and app) ---------- */
function doPost(e) {
  if (e && e.parameter && e.parameter.action) return handleForm_(e.parameter);
  var raw = (e && e.postData && e.postData.contents) || '';
  if (raw.length > 1000) return text_('too big');
  var d;
  try { d = JSON.parse(raw); } catch (err) { return text_('bad'); }
  if (!d || !EVENTS[d.e]) return text_('ignored');
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    sheet_().appendRow([new Date(), clean_(d.e, 24), clean_(d.d, 24), d.app ? 'app' : 'web', clean_(d.iid, 40), clean_(d.w, 40), clean_(d.p, 80)]);
  } catch (err) { /* busy: drop this event */ } finally { try { lock.releaseLock(); } catch (x) {} }
  return text_('ok');
}

function doGet(e) {
  if (e && e.parameter && e.parameter.ping) return text_('ok');
  return html_(loginPage_(''));
}

/* ---------- login and dashboard ---------- */
function handleForm_(p) {
  var cache = CacheService.getScriptCache();
  if (p.action === 'login') {
    if (Number(cache.get('fails') || 0) >= MAX_FAILS) return html_(loginPage_('Too many wrong attempts. Try again in 15 minutes.'));
    var props = PropertiesService.getScriptProperties();
    var email = String(props.getProperty('DASH_EMAIL') || ''), pass = String(props.getProperty('DASH_PASS') || '');
    var ok = email && pass && same_(String(p.email || '').trim().toLowerCase(), email.trim().toLowerCase()) & same_(String(p.password || ''), pass);
    if (!ok) {
      cache.put('fails', String(Number(cache.get('fails') || 0) + 1), LOCK_SECONDS);
      return html_(loginPage_('Wrong email or password.'));
    }
    cache.remove('fails');
    var token = Utilities.getUuid() + Utilities.getUuid();
    cache.put('sess:' + token, '1', SESSION_SECONDS);
    return html_(dashboardPage_(token));
  }
  if (p.action === 'view') {
    if (p.token && cache.get('sess:' + p.token)) return html_(dashboardPage_(p.token));
    return html_(loginPage_('Your session ended. Please sign in again.'));
  }
  if (p.action === 'logout') { if (p.token) cache.remove('sess:' + p.token); return html_(loginPage_('Signed out.')); }
  return html_(loginPage_(''));
}
function same_(a, b) {            // compares without stopping at the first different letter
  var r = a.length === b.length ? 0 : 1, n = Math.max(a.length, b.length);
  for (var i = 0; i < n; i++) r |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return r === 0 ? 1 : 0;
}

/* ---------- data ---------- */
function sheet_() {
  var props = PropertiesService.getScriptProperties(), id = props.getProperty('SHEET_ID'), ss;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) {
    ss = SpreadsheetApp.create('HeyTools events (private)');
    props.setProperty('SHEET_ID', ss.getId());
    ss.getSheets()[0].appendRow(['time', 'event', 'device', 'where', 'install id', 'source', 'page']);
  }
  return ss.getSheets()[0];
}
function clean_(v, n) { return String(v == null ? '' : v).replace(/[^\w .:\/\-]/g, '').slice(0, n); }
function ghDownloads_() {
  var cache = CacheService.getScriptCache(), hit = cache.get('gh');
  if (hit) return JSON.parse(hit);
  var out = { total: 0, rels: [], error: '' };
  try {
    var res = UrlFetchApp.fetch('https://api.github.com/repos/' + REPO + '/releases?per_page=30', { muteHttpExceptions: true, headers: { Accept: 'application/vnd.github+json' } });
    var list = JSON.parse(res.getContentText());
    (list || []).forEach(function (r) {
      (r.assets || []).forEach(function (a) {
        if (/\.apk$/i.test(a.name)) { out.total += a.download_count; out.rels.push({ name: r.name || r.tag_name, count: a.download_count }); }
      });
    });
  } catch (e) { out.error = 'GitHub numbers unavailable right now.'; }
  cache.put('gh', JSON.stringify(out), 600);
  return out;
}
function stats_() {
  var sh = sheet_(), last = sh.getLastRow(), rows = last > 1 ? sh.getRange(2, 1, Math.min(last - 1, 50000), 7).getValues() : [];
  var now = Date.now(), DAY = 86400000, s = { clicks: 0, c7: 0, c30: 0, opens: {}, pwa: 0, byDevice: {}, byDay: {}, bySource: {}, openDevice: {}, recent: [] };
  for (var d = 29; d >= 0; d--) s.byDay[day_(new Date(now - d * DAY))] = 0;
  rows.forEach(function (r) {
    var t = new Date(r[0]).getTime(), ev = r[1], dev = r[2] || 'Other', age = now - t;
    if (ev === 'download_click') {
      s.clicks++; if (age < 7 * DAY) s.c7++; if (age < 30 * DAY) s.c30++;
      s.byDevice[dev] = (s.byDevice[dev] || 0) + 1;
      var k = day_(new Date(t)); if (k in s.byDay) s.byDay[k]++;
      var src = r[5] || 'unknown'; s.bySource[src] = (s.bySource[src] || 0) + 1;
    } else if (ev === 'app_open') {
      if (!s.opens[r[4]]) { s.opens[r[4]] = 1; s.openDevice[dev] = (s.openDevice[dev] || 0) + 1; }
    } else if (ev === 'pwa_install') s.pwa++;
  });
  s.recent = rows.slice(-12).reverse().map(function (r) { return [Utilities.formatDate(new Date(r[0]), 'Asia/Kolkata', 'dd MMM HH:mm'), r[1], r[2], r[3], r[5]]; });
  s.installs = Object.keys(s.opens).length;
  return s;
}
function day_(d) { return Utilities.formatDate(d, 'Asia/Kolkata', 'dd MMM'); }

/* ---------- pages ---------- */
function esc_(v) { return String(v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function text_(t) { return ContentService.createTextOutput(t); }
function html_(body) { return HtmlService.createHtmlOutput(body).setTitle('HeyTools dashboard').addMetaTag('viewport', 'width=device-width, initial-scale=1').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL); }
var CSS_ = '<style>*{box-sizing:border-box}body{margin:0;background:#f5f5f7;color:#1d1d1f;font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;padding:20px}.w{max-width:880px;margin:0 auto}h1{font-size:1.6rem;margin:0 0 4px;letter-spacing:-.02em}h2{font-size:1rem;margin:0 0 10px}.sub{color:#6e6e73;margin:0 0 18px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:14px}.card{background:#fff;border-radius:16px;padding:16px;box-shadow:0 1px 2px rgba(0,0,0,.06)}.big{font-size:2rem;font-weight:750;letter-spacing:-.03em}.lbl{color:#6e6e73;font-size:.8rem}.row{display:grid;grid-template-columns:130px 1fr 44px;gap:8px;align-items:center;margin:6px 0;font-size:.88rem}.bar{height:10px;border-radius:99px;background:#e9e9ee;overflow:hidden}.bar i{display:block;height:100%;background:#0071e3}.days{display:flex;align-items:flex-end;gap:3px;height:110px}.days div{flex:1;background:#0071e3;border-radius:3px 3px 0 0;min-height:2px}table{width:100%;border-collapse:collapse;font-size:.84rem}td,th{text-align:left;padding:6px 4px;border-bottom:1px solid #eee}input,button{font:inherit;padding:12px 14px;border-radius:12px;border:1px solid #d2d2d7;width:100%;margin:6px 0}button{background:#0071e3;border-color:#0071e3;color:#fff;font-weight:600;cursor:pointer}button.g{background:#fff;color:#1d1d1f;border-color:#d2d2d7;width:auto;padding:8px 14px}.err{color:#c0392b;margin:6px 0}.top{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap}</style>';
function loginPage_(msg) {
  return '<!doctype html><html><head>' + CSS_ + '</head><body><div class="w" style="max-width:380px;margin-top:8vh"><div class="card"><h1>HeyTools</h1><p class="sub">Private dashboard</p>' +
    (msg ? '<p class="err" role="alert">' + esc_(msg) + '</p>' : '') +
    '<form method="post" action="' + ScriptApp.getService().getUrl() + '" target="_top"><input type="hidden" name="action" value="login">' +
    '<label>Email<input name="email" type="email" autocomplete="username" required></label>' +
    '<label>Password<input name="password" type="password" autocomplete="current-password" required></label><button type="submit">Sign in</button></form></div></div></body></html>';
}
function bars_(map) {
  var keys = Object.keys(map).sort(function (a, b) { return map[b] - map[a]; }), mx = Math.max.apply(null, keys.map(function (k) { return map[k]; }).concat([1]));
  if (!keys.length) return '<p class="lbl">No data yet.</p>';
  return keys.map(function (k) { return '<div class="row"><span>' + esc_(k) + '</span><div class="bar"><i style="width:' + (map[k] / mx * 100) + '%"></i></div><b>' + map[k] + '</b></div>'; }).join('');
}
function dashboardPage_(token) {
  var s = stats_(), g = ghDownloads_(), url = ScriptApp.getService().getUrl();
  var dayKeys = Object.keys(s.byDay), mx = Math.max.apply(null, dayKeys.map(function (k) { return s.byDay[k]; }).concat([1]));
  var days = dayKeys.map(function (k) { return '<div title="' + esc_(k) + ': ' + s.byDay[k] + '" style="height:' + Math.max(2, s.byDay[k] / mx * 100) + '%"></div>'; }).join('');
  var rec = s.recent.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + esc_(c) + '</td>'; }).join('') + '</tr>'; }).join('') || '<tr><td>No events yet.</td></tr>';
  var rels = g.rels.map(function (r) { return '<tr><td>' + esc_(r.name) + '</td><td>' + r.count + '</td></tr>'; }).join('');
  return '<!doctype html><html><head>' + CSS_ + '</head><body><div class="w"><div class="top"><div><h1>HeyTools dashboard</h1><p class="sub">Downloads and devices. Private to you.</p></div>' +
    '<form method="post" action="' + url + '" target="_top" style="display:flex;gap:8px"><input type="hidden" name="token" value="' + esc_(token) + '"><button class="g" name="action" value="view">Refresh</button><button class="g" name="action" value="logout">Sign out</button></form></div>' +
    '<div class="grid"><div class="card"><div class="lbl">APK downloads (GitHub, real)</div><div class="big">' + g.total + '</div></div>' +
    '<div class="card"><div class="lbl">Download clicks (all time)</div><div class="big">' + s.clicks + '</div></div>' +
    '<div class="card"><div class="lbl">Clicks, last 7 days</div><div class="big">' + s.c7 + '</div></div>' +
    '<div class="card"><div class="lbl">Clicks, last 30 days</div><div class="big">' + s.c30 + '</div></div>' +
    '<div class="card"><div class="lbl">Installs that opened the app</div><div class="big">' + s.installs + '</div></div>' +
    '<div class="card"><div class="lbl">Web app installs (iPhone, PC)</div><div class="big">' + s.pwa + '</div></div></div>' +
    '<div class="card" style="margin-bottom:12px"><h2>Download clicks per day (last 30 days)</h2><div class="days">' + days + '</div></div>' +
    '<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr))"><div class="card"><h2>Download clicks by device</h2>' + bars_(s.byDevice) + '</div><div class="card"><h2>App installs by device</h2>' + bars_(s.openDevice) + '</div></div>' +
    '<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr))"><div class="card"><h2>Where people clicked</h2>' + bars_(s.bySource) + '</div><div class="card"><h2>GitHub downloads per release</h2>' + (rels ? '<table>' + rels + '</table>' : '<p class="lbl">' + esc_(g.error || 'None yet.') + '</p>') + '</div></div>' +
    '<div class="card"><h2>Latest events</h2><table><tr><th>Time (IST)</th><th>Event</th><th>Device</th><th>Where</th><th>Source</th></tr>' + rec + '</table></div>' +
    '<p class="lbl" style="margin-top:14px">A download click is a tap on a download button. GitHub counts finished APK downloads, so it is the most exact total. iPhone and computers add to the web app instead of downloading the APK.</p></div></body></html>';
}
