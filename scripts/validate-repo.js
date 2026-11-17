#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const fail = (message) => { console.error('FAIL:', message); process.exitCode = 1; };
const pass = (message) => console.log('PASS:', message);

const registrySource = read('app/tools.js');
const registryStart = registrySource.indexOf('window.HEY_TOOLS = [');
const registryEnd = registrySource.indexOf('];', registryStart);
if (registryStart < 0 || registryEnd < 0) {
  fail('Could not locate the tool registry in app/tools.js');
  process.exit(1);
}

const registry = registrySource.slice(registryStart, registryEnd);
const ids = [...registry.matchAll(/\bid:\s*'([^']+)'/g)].map((m) => m[1]);
const externalIds = [...registry.matchAll(/\bid:\s*'([^']+)'[^}]*\bexternal:/gs)].map((m) => m[1]);
const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
if (duplicates.length) fail('Duplicate tool IDs: ' + [...new Set(duplicates)].join(', '));
else pass('No duplicate tool IDs (' + ids.length + ' registered)');

const localIds = ids.filter((id) => !externalIds.includes(id));
for (const id of localIds) {
  const page = path.join(root, id, 'index.html');
  if (!fs.existsSync(page)) fail('Missing tool page: ' + id + '/index.html');
}
if (localIds.every((id) => fs.existsSync(path.join(root, id, 'index.html')))) {
  pass('All ' + localIds.length + ' local tools have an index.html page');
}

for (const id of localIds) {
  const html = read(id + '/index.html');
  const inlineScripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  let checked = 0;
  inlineScripts.forEach((match, index) => {
    const attrs = match[1] || '';
    if (/\bsrc\s*=|application\/(?:ld\+)?json|type\s*=\s*["']module["']/i.test(attrs)) return;
    try {
      new vm.Script(match[2], { filename: id + '/index.html inline script ' + (index + 1) });
      checked++;
    } catch (error) {
      fail('Inline JavaScript syntax error in ' + id + '/index.html script ' + (index + 1) + ': ' + error.message);
    }
  });
  if (checked === 0) fail('No inline JavaScript was checked for ' + id);
}
pass('Inline scripts checked for all local tool pages');

const swSource = read('heytools-sw.js');
const swBlock = (swSource.match(/const TOOLS = \[([\s\S]*?)\];/) || [])[1];
if (!swBlock) {
  fail('Could not locate TOOLS in heytools-sw.js');
} else {
  const cachedIds = [...swBlock.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  const missing = localIds.filter((id) => !cachedIds.includes(id));
  const stale = cachedIds.filter((id) => !localIds.includes(id));
  if (missing.length || stale.length) {
    fail('Service-worker tool list mismatch. Missing: [' + missing.join(', ') + '], stale: [' + stale.join(', ') + ']');
  } else {
    pass('Service-worker precache list matches all local tools (' + cachedIds.length + ')');
  }
}

const jsFiles = [
  'app/app.js', 'app/native.js', 'app/tools.js', 'heynotify.js', 'heytrack.js',
  'heytools-sw.js', 'tones.js', 'track-config.js', 'install-prompt.js',
  'native/scripts/patch-android.js', 'native/scripts/prepare-web.js',
  'scripts/test-notifications.js', 'dashboard/Code.gs'
];
for (const file of jsFiles) {
  try {
    new vm.Script(read(file), { filename: file });
    pass('JavaScript syntax: ' + file);
  } catch (error) {
    fail('JavaScript syntax error in ' + file + ': ' + error.message);
  }
}

const androidPatch = read('native/scripts/patch-android.js');
if (!androidPatch.includes("android.permission.SCHEDULE_EXACT_ALARM")) {
  fail('Android build does not declare user-controlled exact-alarm access');
} else if (androidPatch.includes("android.permission.USE_EXACT_ALARM")) {
  fail('Do not request USE_EXACT_ALARM for this general-purpose toolkit; use user-granted SCHEDULE_EXACT_ALARM');
} else {
  pass('Android exact-alarm permission is user-controlled');
}


const alarmSources = ['HeyAlarmPlugin.java', 'AlarmScheduler.java', 'AlarmReceiver.java',
  'AlarmActionReceiver.java', 'AlarmBootReceiver.java', 'AlarmRingingService.java'];
for (const file of alarmSources) {
  if (!androidPatch.includes("'" + file + "'")) fail('Android generator does not copy ' + file);
  if (!fs.existsSync(path.join(root, 'native/plugin', file))) fail('Missing native alarm source: ' + file);
}
const mainActivity = read('native/plugin/MainActivity.java');
if (!mainActivity.includes('registerPlugin(HeyAlarmPlugin.class)')) fail('Native alarm plugin is not registered');
if (!mainActivity.includes('dispatchAlarmOpen')) fail('Alarm notification taps are not routed to the alarm clock');
const notifySource = read('heynotify.js');
if (!notifySource.includes("group==='alarm'") || !notifySource.includes('HA.syncAlarms')) fail('Alarm clock is not routed through the persistent native scheduler');
const manifestPatch = androidPatch;
['android.permission.SCHEDULE_EXACT_ALARM','android.permission.RECEIVE_BOOT_COMPLETED','android.permission.USE_FULL_SCREEN_INTENT',
 'AlarmBootReceiver','AlarmRingingService'].forEach((v) => {
  if (!manifestPatch.includes(v)) fail('Android manifest generator is missing ' + v);
});
if (fs.existsSync(path.join(root, 'native/tests/AlarmSchedulerTest.java'))) pass('Native alarm instrumentation tests are present');
else fail('Native alarm instrumentation tests are missing');

const trackingConfig = read('track-config.js');
if (/window\.HEY_TRACK_URL\s*=\s*['"]https?:/.test(trackingConfig)) {
  fail('Analytics endpoint is enabled by default; require an explicit consent design first');
} else {
  pass('Analytics endpoint is disabled by default');
}

const manifest = JSON.parse(read('app/manifest.webmanifest'));
if (!manifest.name || !manifest.start_url || !manifest.scope || !Array.isArray(manifest.icons)) {
  fail('PWA manifest is missing required identity, launch, scope, or icon fields');
} else {
  pass('PWA manifest parses and has required fields');
}

if (process.exitCode) {
  console.error('Repository validation failed.');
} else {
  console.log('Repository validation completed successfully.');
}
