/* Run after "npx cap add android": adds the media plugin, permissions and the app icon. */
const fs = require('fs'), path = require('path'), cp = require('child_process');
const root = path.resolve(__dirname, '../android');
const pkgDir = path.join(root, 'app/src/main/java/com/heytools/app');
fs.mkdirSync(pkgDir, { recursive: true });
for (const f of ['MediaLibraryPlugin.java', 'MainActivity.java'])
  fs.copyFileSync(path.resolve(__dirname, '../plugin', f), path.join(pkgDir, f));

const mp = path.join(root, 'app/src/main/AndroidManifest.xml');
let m = fs.readFileSync(mp, 'utf8');
const perms = [
  ['android.permission.ACCESS_NETWORK_STATE'],
  ['android.permission.READ_MEDIA_VIDEO'],
  ['android.permission.READ_MEDIA_AUDIO'],
  ['android.permission.READ_EXTERNAL_STORAGE', ' android:maxSdkVersion="32"'],
  ['android.permission.CAMERA'],
  ['android.permission.RECORD_AUDIO'],
  ['android.permission.MODIFY_AUDIO_SETTINGS'],
  ['android.permission.ACCESS_COARSE_LOCATION'],
  ['android.permission.ACCESS_FINE_LOCATION'],
  ['android.permission.VIBRATE'],
  ['android.permission.WAKE_LOCK']
];
const add = perms.filter(p => !m.includes('"' + p[0] + '"'))
  .map(p => `    <uses-permission android:name="${p[0]}"${p[1] || ''} />`).join('\n');
m = m.replace('<application', add + '\n    <uses-feature android:name="android.hardware.camera" android:required="false" />\n    <uses-feature android:name="android.hardware.sensor.compass" android:required="false" />\n\n    <application');
if (!m.includes('requestLegacyExternalStorage')) m = m.replace('<application', '<application android:requestLegacyExternalStorage="true"');
fs.writeFileSync(mp, m);

/* App icon: the HeyTools logo from app/icons. Resized with ImageMagick when available, otherwise copied as is. */
(function () {
  const icon = path.resolve(__dirname, '../../app/icons/icon-512.png');
  const res = path.join(root, 'app/src/main/res');
  fs.rmSync(path.join(res, 'mipmap-anydpi-v26'), { recursive: true, force: true });
  const sizes = { 'mipmap-mdpi': 48, 'mipmap-hdpi': 72, 'mipmap-xhdpi': 96, 'mipmap-xxhdpi': 144, 'mipmap-xxxhdpi': 192 };
  let tool = null;
  for (const t of ['magick', 'convert']) { try { cp.execSync(t + ' -version', { stdio: 'ignore' }); tool = t; break; } catch (e) { /* try next */ } }
  for (const [dir, px] of Object.entries(sizes)) {
    const d = path.join(res, dir); fs.mkdirSync(d, { recursive: true });
    for (const n of ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png']) {
      const out = path.join(d, n);
      try { if (!tool) throw new Error('no ImageMagick'); cp.execSync(`${tool} "${icon}" -resize ${px}x${px} "${out}"`); }
      catch (e) { fs.copyFileSync(icon, out); }
    }
  }
})();

/* Launch screen: replace the default Capacitor logo with the HeyTools logo on a plain background. */
(function () {
  const icon = path.resolve(__dirname, '../../app/icons/icon-512.png');
  const res = path.join(root, 'app/src/main/res');
  let tool = null;
  for (const t of ['magick', 'convert']) { try { cp.execSync(t + ' -version', { stdio: 'ignore' }); tool = t; break; } catch (e) { /* try next */ } }
  if (!tool) { console.log('Launch screen step skipped: no ImageMagick'); return; }
  const files = [];
  (function walk(d) { for (const n of fs.readdirSync(d)) { const p = path.join(d, n); if (fs.statSync(p).isDirectory()) walk(p); else if (n === 'splash.png') files.push(p); } })(res);
  for (const f of files) {
    try {
      const size = cp.execSync(`${tool === 'magick' ? 'magick identify' : 'identify'} -format "%wx%h" "${f}"`).toString().trim();
      const [w, h] = size.split('x').map(Number), logo = Math.round(Math.min(w, h) * 0.32);
      cp.execSync(`${tool} -size ${w}x${h} xc:"#F5F5F7" \\( "${icon}" -resize ${logo}x${logo} \\) -gravity center -composite "${f}"`);
    } catch (e) { console.log('Splash skipped for', f, e.message.split('\n')[0]); }
  }
  console.log('Launch screen updated:', files.length, 'image(s)');
})();
console.log('Android project patched.');
