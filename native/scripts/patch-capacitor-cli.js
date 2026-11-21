/* Compatibility shim: Capacitor 6's compiled default import assumes tar v6's
 * CommonJS interop. Security-patched tar v7 exposes extract as a named export.
 * Normalize the module reference at the CLI call site without downgrading tar.
 */
const fs = require('fs');
const path = require('path');

const cliEntry = require.resolve('@capacitor/cli');
const templateFile = path.resolve(path.dirname(cliEntry), 'util', 'template.js');
if (!fs.existsSync(templateFile)) {
  throw new Error('Capacitor CLI template extractor was not found: ' + templateFile);
}

let source = fs.readFileSync(templateFile, 'utf8');
const broken = 'tar_1.default.extract';
const fixed = '(tar_1.default || tar_1).extract';

if (source.includes(fixed)) {
  console.log('Capacitor tar compatibility patch already applied.');
} else if (source.includes(broken)) {
  source = source.replace(broken, fixed);
  fs.writeFileSync(templateFile, source);
  console.log('Patched Capacitor 6 template extraction to support security-patched tar v7.');
} else {
  throw new Error('Unexpected Capacitor CLI template.js format; refusing an unsafe blind patch.');
}
