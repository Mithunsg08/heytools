'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const failures = [];
const pass = (m) => console.log('PASS  ' + m);
const fail = (m) => failures.push(m);

const android = read('native/scripts/patch-android.js');
if (/android:allowBackup="false"/.test(android) && /android:usesCleartextTraffic="false"/.test(android)) pass('Android backup and cleartext traffic protections are configured');
else fail('Android backup or cleartext traffic protection is missing');
if (/m = m\.replace\(\/\\s\+android:requestLegacyExternalStorage/.test(android) && !/m = m\.replace\('<application'.*requestLegacyExternalStorage/.test(android)) pass('Legacy shared-storage access is removed from generated manifests');
else fail('Legacy shared-storage access is enabled or is not explicitly stripped');
if (android.includes('android:name=".AlarmBootReceiver" android:enabled="true" android:exported="false"')) pass('Alarm boot receiver is not exported');
else fail('Alarm boot receiver export state needs review');

const music = read('music-player/index.html');
if (music.includes("secureSession.set('mp_sp',JSON.stringify(SP.tok))") &&
    music.includes("secureSession.set('mp_ver',ver)") &&
    music.includes("secureSession.get('mp_ver','')")) pass('Spotify tokens and PKCE verifier use tab-scoped session storage');
else fail('Spotify credentials or PKCE verifier are not consistently stored in session storage');
if (music.includes("ls.del('mp_sp');ls.del('mp_ver');")) pass('Legacy persistent Spotify token and verifier keys are cleared on upgrade');
else fail('Legacy persistent Spotify credential cleanup is missing');
if (!music.includes("ls.set('mp_sp',") && !music.includes("ls.set('mp_ver',")) pass('Spotify credentials are not written to localStorage');
else fail('Spotify credentials are still written to localStorage');

const shell = read('app/index.html');
if (/object-src\s+'none'/.test(shell) && /base-uri\s+'self'/.test(shell) && /frame-src\s+'self'/.test(shell)) pass('App shell CSP blocks plugins and restricts framing/base URLs');
else fail('App shell CSP baseline directives are missing');
if (shell.includes("script-src 'self' 'unsafe-inline'") || shell.includes("style-src 'self' 'unsafe-inline'")) {
  console.log('WARN  CSP still permits inline script/style; nonce/hash migration requires a separate compatibility review');
}
if (/connect-src\s+'self'\s+https:/.test(shell)) console.log('WARN  CSP allows broad HTTPS connections for online tools; a per-provider allowlist remains future hardening');

const appSource = read('app/app.js');
if (appSource.includes("name: 'AES-GCM', length: 256") &&
    appSource.includes("PBKDF2") &&
    appSource.includes("iterations = 310000") &&
    appSource.includes("additionalData: new TextEncoder().encode('heytools-backup-v1')")) pass('Exported backups use password-derived AES-256-GCM with authenticated metadata');
else fail('Encrypted backup implementation or authenticated encryption parameters are missing');
if (appSource.includes("heytools-encrypted-backup") &&
    appSource.includes("This is an older, unencrypted backup")) pass('Encrypted backups are recognized and legacy plaintext restores require warning confirmation');
else fail('Encrypted backup restore or legacy plaintext warning is missing');
if (appSource.includes("SKIP.test(k)") && appSource.includes("backup.data[k]")) pass('Backup restore filters reserved credential and internal keys');
else fail('Backup restore reserved-key filtering needs review');

const appHtml = read('app/index.html');
if (/script-src 'self'(?:;|["'])/.test(appHtml) && !/script-src[^;]*unsafe-inline/.test(appHtml) &&
    !/<script>\\s*[\\s\\S]*?<\\/script>/i.test(appHtml)) pass('App shell JavaScript is same-origin and has no inline executable script');
else fail('App shell CSP permits inline JavaScript or inline script remains');
if (/Permissions-Policy/.test(appHtml) && /referrer" content="no-referrer"/.test(appHtml)) pass('App shell limits browser capability policy and referrer disclosure');
else fail('App shell Permissions Policy or strict referrer policy is missing');
if (/network_security_config.xml/.test(android) &&
    /trust-anchors><certificates src="system"/.test(android) &&
    /cleartextTrafficPermitted="false"/.test(android) &&
    /android:networkSecurityConfig="@xml\\/network_security_config"/.test(android)) pass('Android generator writes system-CA-only network security config and denies cleartext');
else fail('Android network security config is missing required trust and cleartext restrictions');

const tracking = read('heytrack.js');
if (/heytools\.track\.consent['"]\)\s*!==\s*'yes'/.test(tracking)) pass('Optional event tracking requires explicit consent');
else fail('Tracking consent guard is missing');

if (failures.length) {
  for (const m of failures) console.error('FAIL  ' + m);
  process.exitCode = 1;
} else {
  console.log('Security source checks passed. These checks are not a penetration test or certification.');
}
