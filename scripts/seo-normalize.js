#!/usr/bin/env node
/* Keeps every tool page's search and sharing tags correct. Safe to run again at any time:  node scripts/seo-normalize.js
   - real canonical + og:url (never a placeholder domain)
   - og / twitter tags and a 1200x630 share image per tool (og/<tool>.jpg, made by scripts/make-og.py)
   - WebApplication structured data where missing
   - "Related tools" links (hidden inside the installed app, because it is a <footer class="hey-related">)
   - sitemap.xml rebuilt from the tool list */
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const BASE = 'https://mithunsg08.github.io/heytools';
const ctx = { window: {} }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'app/tools.js'), 'utf8'), ctx);
const TOOLS = ctx.window.HEY_TOOLS, CATS = ctx.window.HEY_CATS;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const LD_CAT = { media: 'MultimediaApplication', image: 'MultimediaApplication', daily: 'LifestyleApplication', utility: 'UtilitiesApplication', dev: 'DeveloperApplication', games: 'GameApplication', business: 'BusinessApplication' };
let touched = 0;

for (const t of TOOLS) {
  if (t.external) continue;
  const file = path.join(root, t.id, 'index.html');
  if (!fs.existsSync(file)) continue;
  let h = fs.readFileSync(file, 'utf8'); const orig = h;
  const url = `${BASE}/${t.id}/`;
  const title = ((h.match(/<title>([^<]*)<\/title>/) || [])[1] || t.name).trim();
  const desc = ((h.match(/<meta name="description" content="([^"]*)"/) || [])[1] || t.desc).trim();
  const img = `${BASE}/og/${t.id}.jpg`;

  // placeholder domains inside any existing tags / JSON-LD
  { // placeholder domains: only in the <head> (canonical, og, JSON-LD). Never in page text, placeholders or script strings.
    const cut = h.indexOf('</head>');
    if (cut > 0) h = h.slice(0, cut).replace(/https?:\/\/(www\.)?(example\.com|YOUR-DOMAIN\.com|YOUR-USERNAME\.github\.io|yourdomain\.com)\/?[a-z0-9-]*\/?/gi, url) + h.slice(cut);
  }
  h = h.replace(/(<html)(?![^>]*\blang=)/i, '$1 lang="en"');

  // canonical
  if (/<link[^>]*rel="canonical"/.test(h)) h = h.replace(/<link[^>]*rel="canonical"[^>]*>/, `<link rel="canonical" href="${url}">`);
  else h = h.replace('</head>', `<link rel="canonical" href="${url}">\n</head>`);
  if (t.id === 'earth-zipcode') h = h.replace(`<link rel="canonical" href="${url}">`, '<link rel="canonical" href="https://earthszipcode.com/">');

  // og + twitter (only add what is missing, fix urls and the image)
  const need = [];
  const has = re => re.test(h);
  const setMeta = (attr, key, val) => {
    const re = new RegExp(`<meta[^>]*${attr}="${key}"[^>]*>`);
    const tag = `<meta ${attr}="${key}" content="${esc(val)}">`;
    if (re.test(h)) h = h.replace(re, tag); else need.push(tag);
  };
  const canon = t.id === 'earth-zipcode' ? 'https://earthszipcode.com/' : url;
  setMeta('property', 'og:type', 'website'); setMeta('property', 'og:site_name', 'HeyTools');
  setMeta('property', 'og:title', title); setMeta('property', 'og:description', desc);
  setMeta('property', 'og:url', canon); setMeta('property', 'og:image', img);
  setMeta('property', 'og:image:width', '1200'); setMeta('property', 'og:image:height', '630');
  setMeta('name', 'twitter:card', 'summary_large_image'); setMeta('name', 'twitter:title', title);
  setMeta('name', 'twitter:description', desc); setMeta('name', 'twitter:image', img);
  if (need.length) h = h.replace('</head>', need.join('\n') + '\n</head>');

  // structured data
  if (!/application\/ld\+json/.test(h)) {
    const ld = { '@context': 'https://schema.org', '@type': 'WebApplication', name: t.name, url: canon, description: desc,
      applicationCategory: LD_CAT[t.cat] || 'UtilitiesApplication', operatingSystem: 'Any', browserRequirements: 'Requires JavaScript',
      isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, publisher: { '@type': 'Organization', name: 'HeyTools', url: BASE + '/' } };
    h = h.replace('</head>', `<script type="application/ld+json">${JSON.stringify(ld)}</script>\n</head>`);
  }

  // related tools: same category first, then neighbours, max 6, plain links for people and for search engines
  h = h.replace(/\n?<footer class="hey-related"[^>]*>[\s\S]*?<\/footer>\n?/g, '');
  const rel = TOOLS.filter(x => x.id !== t.id && !x.external && x.cat === t.cat).concat(TOOLS.filter(x => x.id !== t.id && !x.external && x.cat !== t.cat)).slice(0, 6);
  const links = rel.map(x => `<a href="../${x.id}/">${esc(x.name)}</a>`).join(' · ');
  const block = `<footer class="hey-related" style="max-width:960px;margin:28px auto 0;padding:18px 16px 28px;font:14px/1.7 system-ui,sans-serif;text-align:center;opacity:.85"><p style="margin:0 0 6px"><strong>More free tools from HeyTools</strong></p><p style="margin:0">${links}</p><p style="margin:8px 0 0"><a href="../">All tools</a> · <a href="../privacy/">Privacy</a></p></footer>\n`;
  // placed right after the page's own footer, so it sits in the same layout slot. Full-screen app-style tools without a footer are left alone.
  const scriptRanges = [...h.matchAll(/<script\b[\s\S]*?<\/script>/gi)].map(m => [m.index, m.index + m[0].length]);
  const inScript = i => scriptRanges.some(([a, b]) => i >= a && i < b);
  let at = h.lastIndexOf('</footer>');
  while (at !== -1 && inScript(at)) at = h.lastIndexOf('</footer>', at - 1);
  if (at !== -1) h = h.slice(0, at + 9) + '\n' + block + h.slice(at + 9);

  // accessibility defaults: visible keyboard focus, and calmer motion for people who ask their phone for it.
  // Games and the spinning wheel are left alone because their motion is the point of the tool.
  h = h.replace(/\n?<style id="hey-a11y">[\s\S]*?<\/style>\n?/, '');
  const motionOk = !['cyber-rush', 'dice-roller', 'spin-wheel', 'emulsion', 'video-player', 'video-loop', 'music-player'].includes(t.id);
  const a11y = (/:focus-visible/.test(h) ? '' : ':focus-visible{outline:3px solid #5B3DF5;outline-offset:2px}') +
    (motionOk ? '@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}}' : '');
  if (a11y) h = h.replace('</head>', `<style id="hey-a11y">${a11y}</style>\n</head>`);

  if (h !== orig) { fs.writeFileSync(file, h); touched++; }
}

// sitemap
const urls = [`${BASE}/`, `${BASE}/app/`, `${BASE}/privacy/`].concat(TOOLS.filter(t => !t.external && fs.existsSync(path.join(root, t.id, 'index.html'))).map(t => `${BASE}/${t.id}/`));
const today = new Date().toISOString().slice(0, 10);
fs.writeFileSync(path.join(root, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map(u => `  <url><loc>${u}</loc><lastmod>${today}</lastmod></url>`).join('\n') + '\n</urlset>\n');
console.log(`seo-normalize: ${touched} pages updated, ${urls.length} sitemap URLs`);
