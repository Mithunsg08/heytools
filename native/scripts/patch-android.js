/* Run after "npx cap add android": adds the media plugin, permissions and the app icon. */
const fs = require('fs'), path = require('path'), cp = require('child_process');
const root = path.resolve(__dirname, '../android');
const pkgDir = path.join(root, 'app/src/main/java/com/heytools/app');
fs.mkdirSync(pkgDir, { recursive: true });
for (const f of ['MediaLibraryPlugin.java', 'PlaybackService.java', 'MainActivity.java', 'UpdateWorker.java', 'HeyAlarmPlugin.java', 'AlarmScheduler.java', 'AlarmReceiver.java', 'AlarmActionReceiver.java', 'AlarmBootReceiver.java', 'AlarmRingingService.java', 'AlarmRingActivity.java', 'ScreenRecordPlugin.java', 'ScreenRecordService.java', 'KeepAliveService.java'])
  fs.copyFileSync(path.resolve(__dirname, '../plugin', f), path.join(pkgDir, f));

const mp = path.join(root, 'app/src/main/AndroidManifest.xml');
let m = fs.readFileSync(mp, 'utf8');
/* Enforce HTTPS and trust only Android system CAs. */
const xmlDir = path.join(root, 'app/src/main/res/xml');
fs.mkdirSync(xmlDir, { recursive: true });
fs.writeFileSync(path.join(xmlDir, 'network_security_config.xml'),
  '<?xml version="1.0" encoding="utf-8"?>\n' +
  '<network-security-config>\\n' +
  '  <base-config cleartextTrafficPermitted="false">\n' +
  '    <trust-anchors><certificates src="system" /></trust-anchors>\n' +
  '  </base-config>\n' +
  '</network-security-config>\\n');

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
  ['android.permission.WAKE_LOCK'],
  ['android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION'],
  ['android.permission.FOREGROUND_SERVICE_DATA_SYNC'],
  ['android.permission.FOREGROUND_SERVICE'],
  ['android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK'],
  ['android.permission.POST_NOTIFICATIONS'],
  ['android.permission.SCHEDULE_EXACT_ALARM'],
  ['android.permission.RECEIVE_BOOT_COMPLETED'],
  ['android.permission.USE_FULL_SCREEN_INTENT'],
  ['android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS']
];
const add = perms.filter(p => !m.includes('"' + p[0] + '"'))
  .map(p => `    <uses-permission android:name="${p[0]}"${p[1] || ''} />`).join('\n');
m = m.replace('<application', add + '\n    <uses-feature android:name="android.hardware.camera" android:required="false" />\n    <uses-feature android:name="android.hardware.sensor.compass" android:required="false" />\n\n    <application');
/* Do not opt into legacy shared-storage access. Android's scoped-storage model
   limits the app to media selected or explicitly granted by the user. Also strip
   the attribute if an older generated manifest already contains it. */
m = m.replace(/\s+android:requestLegacyExternalStorage="true"/g, '');
/* Privacy and security: keep app data out of cloud / adb backups (notes, expenses and Spotify tokens live in it) and refuse plain-http traffic. */
m = m.replace(/android:allowBackup="true"/, 'android:allowBackup="false"');
if (!m.includes('android:allowBackup')) m = m.replace('<application', '<application android:allowBackup="false"');
m = m.replace(/android:usesCleartextTraffic="true"/, 'android:usesCleartextTraffic="false"');
if (!m.includes('usesCleartextTraffic')) m = m.replace('<application', '<application android:usesCleartextTraffic="false"');
if (!m.includes('android:networkSecurityConfig=')) m = m.replace('<application', '<application android:networkSecurityConfig="@xml/network_security_config"');
if (!m.includes('KeepAliveService')) m = m.replace('</application>', '    <service android:name=".KeepAliveService" android:exported="false" android:foregroundServiceType="dataSync" />\n    </application>');
if (!m.includes('ScreenRecordService')) m = m.replace('</application>', '    <service android:name=".ScreenRecordService" android:exported="false" android:foregroundServiceType="mediaProjection" />\n    </application>');
if (!m.includes('PlaybackService')) m = m.replace('</application>', '    <service android:name=".PlaybackService" android:exported="false" android:foregroundServiceType="mediaPlayback" />\n    </application>');
const alarmComponents = [
  '<activity android:name=".AlarmRingActivity" android:exported="false" android:launchMode="singleInstance" android:excludeFromRecents="true" android:showWhenLocked="true" android:turnScreenOn="true" android:theme="@android:style/Theme.DeviceDefault.NoActionBar" />',
  '<service android:name=".AlarmRingingService" android:exported="false" android:directBootAware="true" android:foregroundServiceType="mediaPlayback" />',
  '<receiver android:name=".AlarmReceiver" android:exported="false" android:directBootAware="true" />',
  '<receiver android:name=".AlarmActionReceiver" android:exported="false" android:directBootAware="true" />',
  '<receiver android:name=".AlarmBootReceiver" android:enabled="true" android:exported="false" android:directBootAware="true"><intent-filter><action android:name="android.intent.action.BOOT_COMPLETED" /><action android:name="android.intent.action.LOCKED_BOOT_COMPLETED" /><action android:name="android.intent.action.TIME_SET" /><action android:name="android.intent.action.TIMEZONE_CHANGED" /><action android:name="android.intent.action.TIMEZONE_OFFSET_CHANGED" /><action android:name="android.intent.action.MY_PACKAGE_REPLACED" /><action android:name="android.app.action.SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED" /></intent-filter></receiver>'
];
for (const component of alarmComponents) {
  const match = component.match(/(?:service|receiver|activity) android:name="([^"]+)/);
  if (match && !m.includes('android:name="' + match[1] + '"')) {
    m = m.replace('</application>', '    ' + component + '\n    </application>');
  }
}
const testSource = path.resolve(__dirname, '../tests/AlarmSchedulerTest.java');
const testTargetDir = path.join(root, 'app/src/androidTest/java/com/heytools/app');
fs.mkdirSync(testTargetDir, { recursive: true });
fs.copyFileSync(testSource, path.join(testTargetDir, 'AlarmSchedulerTest.java'));
const playbackTestSource = path.resolve(__dirname, '../tests/PlaybackServiceTest.java');
fs.copyFileSync(playbackTestSource, path.join(testTargetDir, 'PlaybackServiceTest.java'));
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

/* Alarm tones: render every HeyTones recipe to a WAV in res/raw so each tone can be a notification channel sound. */
(function () {
  const T = require('../../tones.js');
  const raw = path.join(root, 'app/src/main/res/raw');
  fs.mkdirSync(raw, { recursive: true });
  for (const t of T.list) fs.writeFileSync(path.join(raw, 'tone_' + t.id + '.wav'), T.wav(t.id, 22050));
  console.log('Alarm tones written:', T.list.length);
})();

/* Small white notification icon (Android shows notification icons as a silhouette). */
(function () {
  const res = path.join(root, 'app/src/main/res/drawable');
  fs.mkdirSync(res, { recursive: true });
  const out = path.join(res, 'ic_stat_hey.png');
  let tool = null;
  for (const t of ['magick', 'convert']) { try { cp.execSync(t + ' -version', { stdio: 'ignore' }); tool = t; break; } catch (e) { /* next */ } }
  try {
    if (!tool) throw new Error('no ImageMagick');
    cp.execSync(`${tool} -size 96x96 xc:none -fill white -draw "roundrectangle 14,14 82,82 22,22" -fill black -draw "roundrectangle 30,30 50,50 6,6" "${out}"`);
  } catch (e) { fs.copyFileSync(path.resolve(__dirname, '../../app/icons/icon-192.png'), out); }
})();

/* Version numbers and signing.
   versionCode goes up with every build so Android accepts the new APK as an update.
   When the workflow provides a signing key (HEY_KEYSTORE), every build is signed with the SAME key, which is what lets
   a new version install over the old one without uninstalling. */
(function () {
  const gp = path.join(root, 'app/build.gradle');
  let g = fs.readFileSync(gp, 'utf8');
  const run = Number(process.env.GITHUB_RUN_NUMBER || 1);
  g = g.replace(/versionCode \d+/, 'versionCode ' + run).replace(/versionName "[^"]*"/, 'versionName "1.0"');
  if (process.env.HEY_KEYSTORE && !g.includes('signingConfigs')) {
    g = g.replace('    buildTypes {', [
      '    signingConfigs {',
      '        heytools {',
      '            storeFile file(System.getenv("HEY_KEYSTORE"))',
      '            storePassword System.getenv("HEY_KEYSTORE_PASSWORD")',
      '            keyAlias System.getenv("HEY_KEY_ALIAS")',
      '            keyPassword System.getenv("HEY_KEYSTORE_PASSWORD")',
      '        }',
      '    }',
      '    buildTypes {',
      '        debug {',
      '            signingConfig signingConfigs.heytools',
      '        }'
    ].join('\n'));
    g = g.replace(/release \{\n(\s+)minifyEnabled false/, 'release {\n$1signingConfig signingConfigs.heytools\n$1minifyEnabled false');
  }
  if (!g.includes('androidx.media:media')) g = g.replace('dependencies {', "dependencies {\n    implementation 'androidx.media:media:1.7.0'");
  if (!g.includes('androidx.work:work-runtime')) g = g.replace("implementation project(':capacitor-android')", "implementation project(':capacitor-android')\n    implementation 'androidx.work:work-runtime:2.9.0'");
  if (!g.includes('testInstrumentationRunner')) g = g.replace('defaultConfig {', 'defaultConfig {\n        testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"');
  if (!g.includes('androidx.test:runner')) g = g.replace('dependencies {', "dependencies {\n    androidTestImplementation 'androidx.test:runner:1.6.2'\n    androidTestImplementation 'androidx.test.ext:junit:1.2.1'");
  if (!g.includes('checkReleaseBuilds')) g = g.replace('android {\n    namespace', 'android {\n    lint {\n        checkReleaseBuilds false\n        abortOnError false\n    }\n    namespace');
  fs.writeFileSync(gp, g);
  console.log('Version', run, process.env.HEY_KEYSTORE ? '(signed with the HeyTools key)' : '(default debug signing)');
})();
console.log('Android project patched.');
