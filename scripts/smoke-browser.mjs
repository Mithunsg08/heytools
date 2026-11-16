#!/usr/bin/env node
'use strict';

const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'app/tools.js'), 'utf8');
const start = html.indexOf('window.HEY_TOOLS = [');
const end = html.indexOf('];', start);
if (start < 0 || end < 0) throw new Error('Could not read the HeyTools registry');
const source = html.slice(start, end);
const ids = [...source.matchAll(/\bid:\s*'([^']+)'/g)].map(x => x[1]);
const external = new Set([...source.matchAll(/\{[^{}]*\bid:\s*'([^']+)'[^{}]*\bexternal:/gs)].map(x => x[1]));
const local = ids.filter(id => !external.has(id));
const base = process.env.HEYTOOLS_BASE_URL || 'http://127.0.0.1:8000/';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', error => errors.push('homepage: ' + error.message));
    const response = await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (!response || !response.ok()) throw new Error('Homepage failed to load: ' + (response && response.status()));
    await page.waitForFunction(() => Array.isArray(window.HEY_TOOLS) && window.HEY_TOOLS.length > 0, { timeout: 15000 });
    const count = await page.evaluate(() => window.HEY_TOOLS.filter(t => !t.external).length);
    if (count !== local.length) throw new Error('Homepage registry count mismatch: ' + count + ' vs ' + local.length);
    const title = await page.title();
    if (!/HeyTools/i.test(title)) throw new Error('Unexpected homepage title: ' + title);
    console.log('PASS homepage loads and registers ' + count + ' local tools');

    for (const id of local) {
      const toolPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
      toolPage.on('pageerror', error => errors.push(id + ': ' + error.message));
      const url = new URL(id + '/index.html', base).toString();
      const result = await toolPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      if (!result || !result.ok()) {
        errors.push(id + ': HTTP ' + (result && result.status()));
      } else {
        const info = await toolPage.evaluate(() => ({
          title: document.title,
          body: (document.body && document.body.innerText || '').trim(),
          viewport: document.documentElement.scrollWidth <= window.innerWidth + 2
        }));
        if (!info.title || !info.body) errors.push(id + ': empty title or body');
        if (!info.viewport) errors.push(id + ': horizontal overflow at 390px viewport');
      }
      await toolPage.close();
    }
    if (errors.length) {
      console.error('Browser smoke test failures:\n' + errors.map(x => '- ' + x).join('\n'));
      process.exitCode = 1;
    } else {
      console.log('PASS all ' + local.length + ' tool pages load without uncaught JavaScript errors or mobile-width overflow');
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
