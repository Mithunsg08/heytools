#!/usr/bin/env node
/* Takes a phone-sized screenshot of every public local tool -> screenshots/<id>.webp
   Usage: node scripts/make-screenshots.js [id ...]     (no ids = all tools)
   Needs Playwright with Chromium, and either `sharp` or Python PIL to write WebP. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'screenshots');
const tmpDir = path.join(require('node:os').tmpdir(), 'heytools-shots');
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(tmpDir, { recursive: true });

let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }
let sharp = null;
try { sharp = require('sharp'); } catch (e) { /* falls back to Python PIL */ }

/* ---- registry ---- */
const src = fs.readFileSync(path.join(root, 'app/tools.js'), 'utf8');
const sandbox = { window: {} };
new Function('window', src)(sandbox.window);
const TOOLS = sandbox.window.HEY_TOOLS.filter((t) => !t.external && !t.appOnly);
const only = process.argv.slice(2);

/* ---- per-tool preparation: make the tool look like it is being used ---- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const prep = {
  'calculator': async (p) => { await clickText(p, ['EMI']); await sleep(200); await fillAll(p, ['500000', '8.5', '5']); },
  'scientific-calculator': async (p) => { for (const k of ['sin', '3', '0', ')', '+', '2', '^', '5']) await clickText(p, [k]); },
  'word-counter': async (p) => { await p.fill('textarea', 'HeyTools is a collection of small, private tools that run entirely in your browser. Count words, characters, sentences and paragraphs as you type, and see how long your text takes to read aloud.\n\nNothing you write ever leaves your device.'); },
  'password-generator': async (p) => { await clickText(p, ['Generate', 'Regenerate', 'New']); },
  'json-formatter': async (p) => { await p.fill('textarea', '{"name":"HeyTools","private":true,"tools":[{"id":"json-formatter","offline":true},{"id":"calculator","offline":true}],"version":2.1}'); await clickText(p, ['Format', 'Beautify', 'Pretty']); },
  'unit-converter': async (p) => { const i = p.locator('input[type=number],input[inputmode=decimal],input[type=text]').first(); await i.fill('12.5'); },
  'barcode-generate': async (p) => { await p.locator('input[type=text],textarea').first().fill('https://mithunsg08.github.io/heytools/'); await clickText(p, ['Generate', 'Create', 'Make']); },
  'encoder-hash': async (p) => { await p.locator('textarea').first().fill('Hello, HeyTools!'); },
  'markdown-editor': async (p) => { await p.locator('textarea').first().fill('# Hello HeyTools\n\nWrite **Markdown** and see it live.\n\n- Fast\n- Private\n- Offline\n\n> Nothing leaves your device.'); },
  'date-calculator': async (p) => { const d = await p.locator('input[type=date]').all(); if (d[0]) await d[0].fill('2026-01-01'); if (d[1]) await d[1].fill('2026-12-25'); },
  'split-bills': async (p) => {},
  'typing-test': async (p) => { await p.keyboard.type('the quick brown fox jumps', { delay: 10 }); },
  'tally-counter': async (p) => { for (let i = 0; i < 27; i++) await p.locator('#tap,.tap,button.big,#count,main button').first().click().catch(() => {}); },
  'dice-roller': async (p) => { await clickText(p, ['Roll']); await sleep(1800); },
  'spin-wheel': async (p) => {},
  'world-clock': async (p) => { await sleep(600); },
  'compass': async (p) => { await sleep(500); },
  'color-picker': async (p) => {},
  'sleep-calculator': async (p) => { await clickText(p, ['Calculate', 'Wake', 'Bed']); },
};
async function clickText(page, names) {
  for (const n of names) {
    const loc = page.locator('button, a.btn, [role=button], .key, .btn').filter({ hasText: new RegExp('^\\s*' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }).first();
    if (await loc.count()) { try { await loc.click({ timeout: 1500 }); return true; } catch (e) { /* try next */ } }
  }
  return false;
}
async function fillAll(page, values) {
  const ins = await page.locator('input:visible:not([type=checkbox]):not([type=radio]):not([type=hidden])').all();
  for (let i = 0; i < Math.min(ins.length, values.length); i++) { try { await ins[i].fill(values[i], { timeout: 1000 }); } catch (e) {} }
}

/* ---- tiny static server ---- */
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

async function toWebp(png, out) {
  if (sharp) { await sharp(png).resize({ width: 600 }).webp({ quality: 78 }).toFile(out); return; }
  execFileSync('python3', ['-c', 'import sys;from PIL import Image;im=Image.open(sys.argv[1]).convert("RGB");w=600;im=im.resize((w,round(im.height*w/im.width)),Image.LANCZOS);im.save(sys.argv[2],"WEBP",quality=78,method=6)', png, out]);
}

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
  const list = TOOLS.filter((t) => !only.length || only.includes(t.id));
  let total = 0;
  for (const t of list) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 700 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'no-preference', colorScheme: 'dark', permissions: ['geolocation', 'camera', 'microphone'], geolocation: { latitude: 51.5074, longitude: -0.1278 }, locale: 'en-US', timezoneId: 'Europe/London' });
    await ctx.addInitScript(() => {
      try { localStorage.setItem('heytools.track.consent', 'no'); localStorage.setItem('heytools.consent', 'no'); } catch (e) {}
    });
    await ctx.route('**/*', (route) => { const u = route.request().url(); return u.startsWith(base) || u.startsWith('data:') || u.startsWith('blob:') ? route.continue() : route.abort(); });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    try {
      await page.goto(base + '/' + t.id + '/index.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
      await sleep(900);
      /* show the tool the way the app does: registry `hide` selectors remove marketing/SEO sections */
      if (t.hide) await page.addStyleTag({ content: t.hide + '{display:none !important}' }).catch(() => {});
      /* dismiss popups */
      await page.evaluate(() => { document.querySelectorAll('[id*=consent i],[class*=consent i],[id*=cookie i],[class*=cookie i],[class*=onboard i]').forEach((n) => { if (getComputedStyle(n).position === 'fixed') n.remove(); }); }).catch(() => {});
      if (prep[t.id]) { try { await prep[t.id](page); } catch (e) { console.log('  prepare failed for', t.id, e.message.split('\n')[0]); } await sleep(500); }
      await page.evaluate(() => window.scrollTo(0, 0));
      const png = path.join(tmpDir, t.id + '.png');
      await page.screenshot({ path: png, clip: { x: 0, y: 0, width: 390, height: 700 } });
      const out = path.join(outDir, t.id + '.webp');
      await toWebp(png, out);
      const kb = Math.round(fs.statSync(out).size / 1024);
      total += kb;
      console.log((kb + ' KB').padStart(7), t.id, errs.length ? '(page errors: ' + errs[0].slice(0, 60) + ')' : '');
    } catch (e) { console.log('FAILED', t.id, e.message.split('\n')[0]); }
    await ctx.close();
  }
  console.log('total', total, 'KB for', list.length, 'tools');
  await browser.close();
  server.close();
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
