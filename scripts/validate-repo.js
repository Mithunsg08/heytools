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
  'dashboard/Code.gs'
];
for (const file of jsFiles) {
  try {
    new vm.Script(read(file), { filename: file });
    pass('JavaScript syntax: ' + file);
  } catch (error) {
    fail('JavaScript syntax error in ' + file + ': ' + error.message);
  }
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
