#!/usr/bin/env node
/* Builds THIRD_PARTY_NOTICES.md, fonts/LICENSES.md and licenses/index.html from the real license files of the bundled packages.
   Usage:  node scripts/build-notices.js /path/to/folder/with/node_modules
   (install the packages listed in vendor/README.md and @fontsource/* there first) */
const fs = require('fs'), path = require('path');
const nm = path.join(process.argv[2] || '.', 'node_modules'), root = path.join(__dirname, '..');
const read = f => fs.existsSync(f) ? fs.readFileSync(f, 'utf8').trim() : '';
const firstFile = (dir, re) => { try { const f = fs.readdirSync(dir).find(n => re.test(n)); return f ? path.join(dir, f) : null; } catch (e) { return null; } };

const LIBS = [
  ['fabric.js', 'fabric', '5.3.0', 'MIT', 'Emulsion', 'http://fabricjs.com'],
  ['three.js (and OrbitControls)', 'three', 'r128', 'MIT', 'Cyber Rush, Earth ZIP code', 'https://threejs.org'],
  ['JsBarcode', 'jsbarcode', '3.11.6', 'MIT', 'Barcode & QR', 'https://github.com/lindell/JsBarcode', 'Copyright (c) 2012-2020 Johan Lindell'],
  ['qrcode-generator', 'qrcode-generator', '1.4.4', 'MIT', 'Barcode & QR', 'https://github.com/kazuhikoarase/qrcode-generator', 'Copyright (c) 2009 Kazuhiko Arase'],
  ['jsPDF', 'jspdf', '2.5.1', 'MIT', 'Image to PDF', 'https://github.com/parallax/jsPDF'],
  ['JSZip', 'jszip', '3.10.1', 'MIT (HeyTools uses it under the MIT option)', 'Image to PDF', 'https://stuk.github.io/jszip/'],
  ['Lucide icons', 'lucide', '0.468.0', 'ISC', 'Earth ZIP code', 'https://lucide.dev'],
];
const MIT = `Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`;

let md = `# Third-party notices

HeyTools itself is proprietary (see [LICENSE](LICENSE)). It includes, loads or depends on the open-source components below. **Each component stays under its own license**, shown here as required. HeyTools' license does not change, restrict or replace them.

## 1. Libraries shipped inside HeyTools (\`vendor/\`)

| Component | Version | License | Used by | Source |
| --- | --- | --- | --- | --- |
${LIBS.map(l => `| ${l[0]} | ${l[2]} | ${l[3]} | ${l[4]} | ${l[5]} |`).join('\n')}

`;
for (const l of LIBS) {
  const dir = path.join(nm, l[1]), lf = firstFile(dir, /^licen[sc]e/i);
  let text = lf ? read(lf) : '';
  if (!text) text = `${l[6] || ''}\n\n${MIT}`.trim();
  md += `### ${l[0]} ${l[2]}\n\n\`\`\`text\n${text}\n\`\`\`\n\n`;
}

md += `## 2. Fonts shipped inside HeyTools (\`fonts/\`)

All fonts come from the [Fontsource](https://fontsource.org) packages (latin subset) and are open-licensed under the SIL Open Font License 1.1 or the Apache License 2.0. The full list with each font's copyright line is in [fonts/LICENSES.md](fonts/LICENSES.md).

## 3. Code loaded from the internet when a feature is used (not stored in this repository)

| Component | License | Used by | Notes |
| --- | --- | --- | --- |
| hls.js 1.7.3 | Apache-2.0 | Video Player (live TV) | Loaded from jsDelivr. https://github.com/video-dev/hls.js |
| Tailwind CSS play CDN 3.4.17 | MIT | Earth ZIP code | Loaded from cdn.tailwindcss.com. https://tailwindcss.com |
| pdf.js, mammoth, xlsx, ffmpeg.wasm and similar helpers | See each project | Image to PDF (Word, Excel, PowerPoint and video conversions) | Loaded from cdnjs only when you use those conversions. |
| **@imgly/background-removal 1.5.5** | **AGPL-3.0** (commercial license available from IMG.LY) | Background Removal | Loaded from jsDelivr, with its AI model from IMG.LY. See the AGPL note below. https://github.com/imgly/background-removal-js |

### AGPL-3.0 note (Background Removal)

The Background Removal tool uses IMG.LY's \`@imgly/background-removal\` library, which is licensed under the **GNU Affero General Public License v3.0** (https://www.gnu.org/licenses/agpl-3.0.html), with a separate commercial license sold by IMG.LY. HeyTools does not copy or modify that library; the person's browser downloads it directly from the CDN when the tool is used. The AGPL applies to that library, and its source is available at the link above. Using it inside a proprietary product can create obligations or risks that depend on how it is combined and distributed. **The project owner should either obtain IMG.LY's commercial license, replace the library with a permissively licensed one, or take legal advice before distributing this tool commercially.**

## 4. Android app build

The Android app is built with [Capacitor](https://capacitorjs.com) (MIT) and its LocalNotifications and App plugins (MIT), AndroidX libraries (Apache-2.0) and the Android Gradle toolchain (Apache-2.0).

## 5. Services

Some tools call public web services (maps, weather, music and video catalogs). They are not part of HeyTools and have their own terms; see the [privacy page](https://mithunsg08.github.io/heytools/privacy/).
`;
fs.writeFileSync(path.join(root, 'THIRD_PARTY_NOTICES.md'), md + '\n');

// fonts/LICENSES.md
let fm = `# Font licenses

These font files are served by HeyTools itself (nothing is loaded from Google). Each family keeps its own license and copyright, listed below. The SIL Open Font License 1.1 and the Apache License 2.0 are reproduced at the end.

| Family | License | Copyright |
| --- | --- | --- |
`;
let oflText = '', apacheText = '';
for (const d of fs.readdirSync(path.join(nm, '@fontsource')).sort()) {
  const dir = path.join(nm, '@fontsource', d), j = JSON.parse(read(path.join(dir, 'package.json')));
  const lf = firstFile(dir, /^LICENSE/i), t = read(lf);
  const cp = (t.split('\n').find(l => /^copyright/i.test(l.trim())) || '').replace(/\|/g, '/').trim();
  fm += `| ${j.name.replace('@fontsource/', '')} | ${j.license} | ${cp} |\n`;
  if (j.license === 'OFL-1.1' && !oflText) oflText = t.slice(t.indexOf('-----------------------------------------------------------'));
  if (j.license === 'Apache-2.0' && !apacheText) apacheText = t;
}
fm += `\n## SIL Open Font License, Version 1.1\n\n\`\`\`text\n${oflText || 'See https://openfontlicense.org'}\n\`\`\`\n\n## Apache License, Version 2.0\n\n\`\`\`text\n${apacheText}\n\`\`\`\n`;
fs.writeFileSync(path.join(root, 'fonts', 'LICENSES.md'), fm);

// licenses/index.html: the same text, readable inside the app and on the website
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
fs.mkdirSync(path.join(root, 'licenses'), { recursive: true });
fs.writeFileSync(path.join(root, 'licenses', 'index.html'), `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Open-source licenses – HeyTools</title>
<meta name="description" content="Licenses and notices for the open-source libraries and fonts included in HeyTools.">
<link rel="canonical" href="https://mithunsg08.github.io/heytools/licenses/"><meta name="color-scheme" content="light dark">
<style>:root{--bg:#F7F7FB;--ink:#14141F;--muted:#585872;--line:#E3E3EE;--panel:#fff}@media (prefers-color-scheme:dark){:root{--bg:#0E0E16;--ink:#F2F2F8;--muted:#A5A5BD;--line:#2A2A3A;--panel:#16161F}}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom)}
main{max-width:860px;margin:0 auto;padding:24px 16px 56px}a{color:#5B3DF5}h1{letter-spacing:-.02em}
pre{white-space:pre-wrap;word-wrap:break-word;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px;font:13px/1.55 ui-monospace,Menlo,Consolas,monospace}</style></head>
<body><main><p><a href="../">← All tools</a> · <a href="../privacy/">Privacy</a></p>
<h1>Open-source licenses</h1>
<p>HeyTools is proprietary software. These components are included with it or used by it, and each keeps its own license.</p>
<pre>${esc(md)}</pre>
<h2>Fonts</h2><pre>${esc(fm)}</pre></main></body></html>
`);
console.log('notices written:', md.length, 'bytes; fonts:', fm.length);
