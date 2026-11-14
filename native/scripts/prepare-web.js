/* Copies the website (app + every tool) into native/www so Capacitor can bundle it inside the APK. */
const fs = require('fs'), path = require('path');
const src = path.resolve(__dirname, '../..'), out = path.resolve(__dirname, '../www');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const skip = new Set(['native', 'node_modules', 'dashboard', 'signing']);
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

/* Google Fonts links: download the font CSS and the font files once so tools look the same offline. If a download fails the original link is kept. */
const GF = /<link\b[^>]*\bhref=["'](https:\/\/fonts\.googleapis\.com\/[^"']+)["'][^>]*>/gi;
const UA = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';
async function vendorFonts() {
  const dir = path.join(out, 'vendor', 'fonts'); fs.mkdirSync(dir, { recursive: true });
  const pages = [];
  (function walk(d) { for (const n of fs.readdirSync(d)) { const p = path.join(d, n), st = fs.statSync(p);
    if (st.isDirectory()) { if (n !== 'vendor') walk(p); } else if (n === 'index.html' && path.dirname(p) !== out && path.basename(path.dirname(p)) !== 'app') pages.push(p); } })(out);
  const done = {};
  for (const page of pages) {
    let html = fs.readFileSync(page, 'utf8'), changed = false;
    for (const m of [...html.matchAll(GF)]) {
      const url = m[1].replace(/&amp;/g, '&');
      if (!(url in done)) {
        try {
          const res = await fetch(url, { headers: { 'User-Agent': UA } });
          if (!res.ok) throw new Error('HTTP ' + res.status);
          let css = await res.text();
          for (const f of [...new Set([...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map(x => x[1]))]) {
            const fr = await fetch(f); if (!fr.ok) throw new Error('font HTTP ' + fr.status);
            const name = crypto.createHash('sha1').update(f).digest('hex').slice(0, 10) + '.woff2';
            fs.writeFileSync(path.join(dir, name), Buffer.from(await fr.arrayBuffer()));
            css = css.split(f).join('./' + name);
          }
          const cssName = crypto.createHash('sha1').update(url).digest('hex').slice(0, 10) + '.css';
          fs.writeFileSync(path.join(dir, cssName), css); done[url] = cssName; console.log('  bundled fonts', url.slice(0, 70));
        } catch (e) { done[url] = null; console.log('  could not bundle fonts', url.slice(0, 70), '-', e.message); }
      }
      if (done[url]) { html = html.split(m[1]).join('../vendor/fonts/' + done[url]); changed = true; }
    }
    if (changed) fs.writeFileSync(page, html);
  }
}
module.exports = { vendorLibs, vendorFonts };

function finish() {
/* build info: lets the app know which build it is, so it can tell when a newer one has been published */
fs.writeFileSync(path.join(out, 'app', 'build.json'), JSON.stringify({ run: Number(process.env.GITHUB_RUN_NUMBER || 0), sha: (process.env.GITHUB_SHA || '').slice(0, 7), built: Date.now() }));
fs.writeFileSync(path.join(out, 'index.html'),
  '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<title>HeyTools</title><script>location.replace("app/index.html")</script>');
console.log('Web files copied to', out);
}

vendorLibs().then(vendorFonts).then(finish, e => { console.log('Library bundling skipped:', e.message); finish(); });
