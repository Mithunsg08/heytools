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
fs.writeFileSync(path.join(out, 'index.html'),
  '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<title>HeyTools</title><script>location.replace("app/index.html")</script>');
console.log('Web files copied to', out);
