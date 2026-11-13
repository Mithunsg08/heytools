/* Copies the website (app + every tool) into native/www so Capacitor can bundle it inside the APK. */
const fs = require('fs'), path = require('path');
const src = path.resolve(__dirname, '../..'), out = path.resolve(__dirname, '../www');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const skip = new Set(['native', 'node_modules']);
for (const name of fs.readdirSync(src)) {
  if (skip.has(name) || name.startsWith('.')) continue;
  const p = path.join(src, name), st = fs.statSync(p);
  if (st.isDirectory()) fs.cpSync(p, path.join(out, name), { recursive: true });
  else if (/\.(js|json|png|svg|webmanifest)$/.test(name)) fs.copyFileSync(p, path.join(out, name));
}
/* Bundle the online script libraries (three.js, fabric.js, QR/barcode makers...) so those tools also work offline inside the app.
   Each <script src="https://cdn..."> in a tool page is downloaded once into www/vendor and the page points at the local copy.
   If a download fails the original link is kept, so the build never breaks. */
const CDN = /<script\b[^>]*\bsrc=["'](https:\/\/(?:cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com|cdn\.tailwindcss\.com)[^"']*)["'][^>]*>/gi;
const crypto = require('crypto');
async function vendorLibs() {
  const vendor = path.join(out, 'vendor'); fs.mkdirSync(vendor, { recursive: true });
  const done = {};
  const pages = [];
  (function walk(d) { for (const n of fs.readdirSync(d)) { const p = path.join(d, n), st = fs.statSync(p);
    if (st.isDirectory()) { if (n !== 'vendor') walk(p); } else if (n === 'index.html' && path.dirname(p) !== out && path.basename(path.dirname(p)) !== 'app') pages.push(p); } })(out);
  for (const page of pages) {
    let html = fs.readFileSync(page, 'utf8'), changed = false;
    const urls = [...new Set([...html.matchAll(CDN)].map(m => m[1]))];
    for (const url of urls) {
      if (!(url in done)) {
        let base = url.split('?')[0].split('/').filter(Boolean).pop() || 'lib';
        if (/^cdn\.tailwindcss\.com$/.test(new URL(url).hostname)) base = 'tailwind';
        if (!/\.js$/.test(base)) base += '.js';
        const file = crypto.createHash('sha1').update(url).digest('hex').slice(0, 8) + '-' + base;
        try {
          const res = await fetch(url, { redirect: 'follow' });
          if (!res.ok) throw new Error('HTTP ' + res.status);
          fs.writeFileSync(path.join(vendor, file), Buffer.from(await res.arrayBuffer()));
          done[url] = file; console.log('  bundled', url);
        } catch (e) { done[url] = null; console.log('  could not bundle', url, '-', e.message); }
      }
      if (done[url]) { html = html.split(url).join('../vendor/' + done[url]); changed = true; }
    }
    if (changed) fs.writeFileSync(page, html.replace(/\sintegrity=["'][^"']*["']/g, ''));
  }
}
module.exports = { vendorLibs };

function finish() {
fs.writeFileSync(path.join(out, 'index.html'),
  '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<title>HeyTools</title><script>location.replace("app/index.html")</script>');
console.log('Web files copied to', out);
}

vendorLibs().then(finish, e => { console.log('Library bundling skipped:', e.message); finish(); });
