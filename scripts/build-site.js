#!/usr/bin/env node
/* Generates the homepage (index.html) and the features page (features/index.html)
   from app/tools.js (the tool registry) + features-data.json (what each tool does) + screenshots/<id>.webp.
   Run: node scripts/build-site.js     Screenshots: node scripts/make-screenshots.js */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const BASE = 'https://mithunsg08.github.io/heytools';
const APK = 'https://github.com/Mithunsg08/heytools/releases/download/android-latest/HeyTools.apk';
const sandbox = { window: {} };
new Function('window', fs.readFileSync(path.join(root, 'app/tools.js'), 'utf8'))(sandbox.window);
const CATS = sandbox.window.HEY_CATS, ALL = sandbox.window.HEY_TOOLS;
const FD = JSON.parse(fs.readFileSync(path.join(root, 'features-data.json'), 'utf8'));
const local = ALL.filter((t) => !t.external && !t.appOnly);
const ext = ALL.filter((t) => t.external);
const guard = ALL.find((t) => t.appOnly);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const NET = { offline: ['Works offline', 'ok'], partial: ['Partly online', 'mid'], online: ['Needs internet', 'net'] };
const missing = local.filter((t) => !FD[t.id] || !fs.existsSync(path.join(root, 'screenshots', t.id + '.webp')));
if (missing.length) { console.error('Missing features/screenshot for: ' + missing.map((t) => t.id).join(', ')); process.exit(1); }
const N = local.length;

const FONT = '';
const CSS = `
:root{--bg:#fff;--ink:#1d1d1f;--muted:#6e6e73;--line:#d2d2d7;--panel:#f5f5f7;--blue:#0071e3;--blue2:#0058b0;--tint:#f5f5f7;--ok:#248a3d;--warn:#b25000;--net:#c4321c;--r:22px;--sf:-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text','Helvetica Neue','Segoe UI',Roboto,Arial,sans-serif}
@media(prefers-color-scheme:dark){:root{--bg:#000;--ink:#f5f5f7;--muted:#a1a1a6;--line:#2d2d30;--panel:#161617;--blue:#2997ff;--blue2:#64b5ff;--tint:#1d1d1f;--ok:#30d158;--warn:#ffb340;--net:#ff6b57}}
*{box-sizing:border-box}html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:17px/1.47 var(--sf);letter-spacing:-.011em;-webkit-font-smoothing:antialiased}
h1,h2,h3{font-family:var(--sf);line-height:1.07;margin:0;letter-spacing:-.03em;font-weight:700}
a{color:var(--blue);text-decoration:none}a:hover{text-decoration:underline}:focus-visible{outline:3px solid var(--blue);outline-offset:3px;border-radius:10px}
.wrap{max-width:1080px;margin:0 auto;padding:0 22px}
.skip{position:absolute;left:-999px}.skip:focus{left:12px;top:12px;background:#000;color:#fff;padding:8px 14px;border-radius:10px;z-index:99}
header.top{position:sticky;top:0;z-index:40;background:color-mix(in srgb,var(--bg) 80%,transparent);backdrop-filter:saturate(180%) blur(20px);-webkit-backdrop-filter:saturate(180%) blur(20px);border-bottom:1px solid var(--line)}
.bar{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:52px}
.logo{font-weight:700;font-size:1.15rem;color:var(--ink);letter-spacing:-.03em}.logo:hover{text-decoration:none}.logo span{opacity:.55;margin-left:1px}
nav.m{display:flex;gap:2px;align-items:center}nav.m a{color:var(--ink);opacity:.8;font-size:.86rem;padding:8px 12px;border-radius:99px}nav.m a:hover,nav.m a[aria-current]{opacity:1;text-decoration:none;background:var(--panel)}
nav.m a.btn{opacity:1;background:var(--blue);color:#fff;min-height:32px;padding:6px 14px;border:0;font-size:.82rem}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:12px 26px;border-radius:99px;font:600 1.02rem var(--sf);border:1.5px solid var(--blue);color:var(--blue);background:transparent;cursor:pointer;letter-spacing:-.01em}
.btn:hover{text-decoration:none;background:color-mix(in srgb,var(--blue) 10%,transparent)}
.btn.pri{background:var(--blue);color:#fff}.btn.pri:hover{background:var(--blue2);border-color:var(--blue2)}
.hero{padding:clamp(48px,9vw,110px) 0 clamp(20px,4vw,40px);text-align:center}
.hero-g{display:block}.hero .lead{margin-left:auto;margin-right:auto}.hero .btns{justify-content:center}
.pill{display:inline-block;font-weight:600;font-size:.95rem;color:var(--ink);margin:0 0 14px;letter-spacing:-.01em}
h1{font-size:clamp(2.6rem,8vw,5.2rem);font-weight:700;letter-spacing:-.045em}h1 em{font-style:normal;color:var(--muted)}
.lead{font-size:clamp(1.1rem,2.2vw,1.5rem);color:var(--muted);max-width:44ch;margin:20px 0 28px;line-height:1.35;letter-spacing:-.02em}
.btns{display:flex;flex-wrap:wrap;gap:12px}.fine{font-size:.85rem;color:var(--muted);margin:16px 0 0}
.shots{display:flex;gap:18px;justify-content:center;align-items:flex-end;margin-top:clamp(28px,5vw,56px)}
.phone{width:min(44%,250px);border-radius:34px;border:7px solid #1d1d1f;background:#1d1d1f;box-shadow:0 40px 80px -30px rgba(0,0,0,.45);overflow:hidden;aspect-ratio:9/18}
.phone img{width:100%;height:100%;object-fit:cover;object-position:top;display:block}.shots .phone:nth-child(2){margin-bottom:-6px;transform:translateY(-22px)}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:0;margin:clamp(28px,5vw,48px) 0 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.stat{padding:26px 14px;text-align:center}.stat+.stat{border-left:1px solid var(--line)}.stat b{display:block;font-size:clamp(1.8rem,4vw,2.8rem);letter-spacing:-.04em;font-weight:700}.stat span{color:var(--muted);font-size:.9rem}
section{padding:clamp(56px,9vw,110px) 0}
.alt{background:var(--panel)}.dk{background:#000;color:#f5f5f7;--bg:#000;--ink:#f5f5f7;--muted:#a1a1a6;--line:#2d2d30;--panel:#161617;--blue:#2997ff;--blue2:#64b5ff}
.sh{max-width:760px;margin:0 auto 44px;text-align:center}.sh h2{font-size:clamp(2rem,5.4vw,3.6rem);font-weight:700;letter-spacing:-.04em}.sh p{color:var(--muted);margin:16px auto 0;font-size:clamp(1.05rem,2vw,1.35rem);line-height:1.38;max-width:52ch}
.cols{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}
.card{background:var(--panel);border-radius:var(--r);padding:28px}.alt .card{background:var(--bg)}.dk .card{background:#161617}
.card h3{font-size:1.4rem;margin-bottom:8px;letter-spacing:-.025em}.card p{margin:0;color:var(--muted)}.card ul{margin:10px 0 0;padding-left:1.1em;color:var(--muted)}
.ico{font-size:2rem;display:block;margin-bottom:14px}
.tools-bar{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 24px;align-items:center;justify-content:center}
.chip{min-height:40px;padding:8px 18px;border-radius:99px;border:0;background:var(--panel);color:var(--ink);font:500 .92rem var(--sf);cursor:pointer}.alt .chip{background:var(--bg)}
.chip[aria-pressed=true]{background:var(--ink);color:var(--bg)}.chip:hover{text-decoration:none}
.search{flex:1 1 100%;max-width:420px;min-height:44px;padding:8px 18px;border-radius:99px;border:1px solid var(--line);background:var(--bg);color:var(--ink);font:1rem var(--sf)}
.grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(250px,1fr))}
.tool{display:flex;flex-direction:column;background:var(--bg);border-radius:var(--r);overflow:hidden;color:var(--ink);transition:transform .3s cubic-bezier(.2,.8,.2,1),box-shadow .3s}
.tool:hover{transform:scale(1.02);box-shadow:0 20px 40px -20px rgba(0,0,0,.35);text-decoration:none}
.tool .im{aspect-ratio:16/11;background:#000;overflow:hidden}.tool img{width:100%;height:100%;object-fit:cover;object-position:top;display:block}
.tool .tx{padding:16px 18px 20px;display:flex;flex-direction:column;gap:6px;flex:1}.tool h3{font-size:1.15rem}.tool p{margin:0;color:var(--muted);font-size:.92rem}
.bd{display:inline-block;align-self:flex-start;font-size:.72rem;font-weight:600;padding:2px 10px;border-radius:99px;background:var(--panel);margin-top:2px}.bd.ok{color:var(--ok)}.bd.mid{color:var(--warn)}.bd.net{color:var(--net)}
.alt .bd{background:var(--bg)}.tool .bd{background:var(--panel)}
.three{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(270px,1fr))}.three .card b.n{display:block;font-size:.85rem;color:var(--blue);margin-bottom:10px;font-weight:600}
.faq{max-width:760px}.faq details{border-bottom:1px solid var(--line);padding:2px 0}.faq summary{cursor:pointer;font-weight:600;font-size:1.1rem;padding:18px 0;min-height:44px;list-style:none;display:flex;justify-content:space-between;gap:12px}.faq summary::after{content:'+';font-size:1.5rem;line-height:1;color:var(--muted)}.faq details[open] summary::after{content:'–'}.faq summary::-webkit-details-marker{display:none}.faq p{margin:0 0 18px;color:var(--muted)}
.getg{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}.getg .card.is-you{box-shadow:0 0 0 2px var(--blue)}
footer{padding:36px 0 56px;background:var(--panel);color:var(--muted);font-size:.8rem;border-top:1px solid var(--line)}.fl{display:flex;flex-wrap:wrap;gap:6px 22px;margin:0 0 14px}.fl a{color:var(--ink);opacity:.85;font-size:.85rem}
.feat{display:grid;grid-template-columns:minmax(0,260px) 1fr;gap:clamp(22px,5vw,64px);align-items:center;padding:clamp(32px,6vw,64px) 0;border-top:1px solid var(--line);scroll-margin-top:70px}
.feat .phone{width:100%;max-width:260px}.feat h2{font-size:clamp(1.8rem,4vw,2.8rem);letter-spacing:-.04em}.feat ul{padding-left:1.15em;margin:16px 0 22px;color:var(--muted)}.feat li{margin:7px 0}.feat li::marker{color:var(--ink)}
.cat-h{font-size:.85rem;color:var(--muted);margin:48px 0 0;text-transform:uppercase;letter-spacing:.1em;font-weight:600}
.crumb{font-size:.88rem;color:var(--muted);margin:0 0 14px}
.prose{max-width:720px}.prose h2{font-size:clamp(1.6rem,3.2vw,2.2rem);margin:44px 0 12px;letter-spacing:-.035em}.prose p,.prose li{color:var(--muted);font-size:1.08rem;line-height:1.5}.prose strong{color:var(--ink)}
.center{text-align:center}
@media(max-width:860px){.stats{grid-template-columns:repeat(2,1fr)}.stat:nth-child(3){border-left:0}.stat:nth-child(n+3){border-top:1px solid var(--line)}nav.m a.hide-s{display:none}.feat{grid-template-columns:1fr;text-align:left}.feat .phone{max-width:220px}.shots .phone:nth-child(2){transform:none}}
@media(prefers-reduced-motion:reduce){*{transition:none!important;scroll-behavior:auto!important}}
`;
const NAV = (cur, up) => `<header class="top"><div class="wrap bar"><a class="logo" href="${up}">Hey<span>Tools</span></a><nav class="m" aria-label="Main"><a class="hide-s" href="${up}#tools"${cur === 'tools' ? ' aria-current="page"' : ''}>Tools</a><a href="${up}features/"${cur === 'features' ? ' aria-current="page"' : ''}>Features</a><a class="hide-s" href="${up}about/"${cur === 'about' ? ' aria-current="page"' : ''}>About</a><a class="hide-s" href="${up}privacy/">Privacy</a><a class="btn pri" style="min-height:42px;padding:8px 16px" href="${up}#get-app">Get the app</a></nav></div></header>`;
const FOOT = (up) => `<footer><div class="wrap"><div class="fl"><a href="${up}">Home</a><a href="${up}features/">Features</a><a href="${up}about/">About</a><a href="${up}privacy/">Privacy</a><a href="https://github.com/Mithunsg08/heytools/blob/main/SECURITY.md" rel="noopener">Security</a><a href="${up}licenses/">Licenses</a><a href="https://github.com/Mithunsg08/heytools" rel="noopener">GitHub</a></div>© <span id="yr">2026</span> HeyTools. No accounts, no ads. Built to run on your device. Safeguards are listed honestly on the <a href="${up}privacy/">privacy page</a>; they are not a security certification.</div></footer><script>document.getElementById('yr').textContent=new Date().getFullYear()</script>`;
const HEAD = ({ title, desc, url, up, ld, og = 'og/heytools.jpg' }) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}"><meta name="robots" content="index,follow,max-image-preview:large">
<meta name="theme-color" content="#000000"><meta name="color-scheme" content="light dark">
<meta property="og:type" content="website"><meta property="og:site_name" content="HeyTools"><meta property="og:locale" content="en">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${url}">
<meta property="og:image" content="${BASE}/${og}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${BASE}/${og}">
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%2314213D'/><rect x='6' y='6' width='10' height='10' rx='3' fill='%23FFC93C'/><rect x='16' y='16' width='10' height='10' rx='3' fill='%232B4EFF'/></svg>">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
${FONT.replace('%fonts%', up)}
<style>${CSS}</style></head><body><a class="skip" href="#main">Skip to content</a>`;

const badge = (t) => { const [l, c] = NET[t.net] || NET.offline; return `<span class="bd ${c}">${l}</span>`; };
const shot = (t, w) => `<img src="${w}screenshots/${t.id}.webp" alt="${esc(t.name)} screenshot" width="600" height="1077" loading="lazy" decoding="async">`;
const FAQ = [
  ['Is HeyTools really free? Do I need an account?', 'Yes, it is free, and there is no account, no sign-up and no advertising. You can open any tool straight away.'],
  ['Where is my data stored?', 'On your device. Notes, trackers, expenses, recordings and photos are never sent to a HeyTools server, because there is no such server. In the Android app, private tool data is encrypted on the device.'],
  ['Which tools use the internet?', `Mainly Music Player and Video Player (streaming, live TV, search), Geo Camera (weather, address, map), Earth’s Zipcode, Internet Speed and Media Downloads. Everything else works offline. The privacy page lists every service and what it receives.`],
  ['Can I lock my private data with a password or my fingerprint?', 'In the Android app you choose: a password (with optional fingerprint or face unlock, which needs the password to turn on), or no password, where the data is still encrypted with a key kept on the device and opens automatically.'],
  ['What happens if I forget my password?', 'It cannot be recovered, by design: nobody, including us, can open the encrypted data. You can erase it and start fresh, or restore an encrypted backup with that backup’s own password.'],
  ['Is HeyTools security-certified?', 'No. It uses safeguards such as a Content Security Policy, blocked cleartext traffic, disabled Android backup, Android Keystore encryption, encrypted backups, dependency audits and source checks, all verified automatically. That is not a certification or an independent audit, and SECURITY.md lists the limits.'],
  ['What is Anti-Theft Guard?', 'An Android-app-only tool. It watches for the charger being unplugged or the phone being snatched, locks the screen and sounds a loud alarm until you unlock. It cannot stop a hardware force-restart.'],
  ['Does it work offline?', `Yes, most of the ${N} tools do. Each tool shows whether it works offline, partly online or needs internet.`],
  ['How do I install it?', 'On Android, download the APK from the Get the app section. On iPhone, iPad and computers, open the web app and use Add to Home Screen or your browser’s install button.']
];

/* ---------------- homepage ---------------- */
function home() {
  const ldTools = local.map((t, i) => ({ '@type': 'ListItem', position: i + 1, url: `${BASE}/${t.id}/`, name: t.name }));
  const ld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'Organization', '@id': BASE + '/#org', name: 'HeyTools', url: BASE + '/', logo: BASE + '/og/heytools.jpg' },
    { '@type': 'WebSite', '@id': BASE + '/#site', name: 'HeyTools', url: BASE + '/', description: 'Free, private, local-first tools for your phone and browser.', publisher: { '@id': BASE + '/#org' } },
    { '@type': 'SoftwareApplication', name: 'HeyTools', softwareVersion: '1.0', operatingSystem: 'Android', applicationCategory: 'UtilitiesApplication', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, downloadUrl: APK, image: BASE + '/og/heytools.jpg', description: `One free app with ${N} private tools: video and music player, recorder, alarm clock, notes, geo camera, converters, calculators and an Anti-Theft Guard.` },
    { '@type': 'ItemList', name: 'HeyTools tools', numberOfItems: N, itemListElement: ldTools },
    { '@type': 'FAQPage', mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }
  ] };
  const hero = ['video-player', 'music-player', 'geo-camera'].map((id) => local.find((t) => t.id === id)).filter(Boolean);
  const grid = local.map((t) => `<a class="tool" href="${t.id}/" data-cat="${t.cat}" data-q="${esc((t.name + ' ' + t.desc).toLowerCase())}"><div class="im">${shot(t, '')}</div><div class="tx"><h3>${esc(t.name)}</h3><p>${esc(t.desc)}</p>${badge(t)}</div></a>`).join('');
  const chips = `<button class="chip" aria-pressed="true" data-f="all">All ${N}</button>` + CATS.filter((c) => local.some((t) => t.cat === c.id)).map((c) => `<button class="chip" aria-pressed="false" data-f="${c.id}">${esc(c.label)}</button>`).join('');
  return HEAD({ title: `HeyTools: ${N} free private tools for your phone and browser`, desc: `HeyTools is a free app and website with ${N} private tools: video and music player, recorder, notes, alarms, geo camera, converters, calculators and more. No account, no ads, data stays on your device.`, url: BASE + '/', up: '', ld }) + NAV('', '') + `
<main id="main">
<div class="hero"><div class="wrap hero-g"><div>
  <p class="pill">Free · No account · No ads</p>
  <h1>Everyday tools.<br><em>Kept on your device.</em></h1>
  <p class="lead">HeyTools is ${N} small, fast tools in one place: play your videos and music, record, take notes, set alarms, convert files, calculate and more. They run on your phone or in your browser, and your data stays with you.</p>
  <div class="btns"><a class="btn pri" href="#get-app">Download for Android</a><a class="btn ghost" href="app/">Open the web app</a><a class="btn ghost" href="features/">See every feature</a></div>
  <p class="fine">Some tools (streaming, weather, speed test, downloads) use the internet when you use them. <a href="privacy/">See exactly what is sent.</a></p>
</div><div class="shots" aria-hidden="true">${hero.slice(0, 2).map((t) => `<div class="phone">${shot(t, '').replace('loading="lazy"', 'fetchpriority="high"')}</div>`).join('')}</div></div></div>

<div class="wrap"><div class="stats"><div class="stat"><b>${N}</b><span>tools you can open today</span></div><div class="stat"><b>0</b><span>accounts, ads or trackers by default</span></div><div class="stat"><b>${local.filter((t) => t.net === 'offline').length}</b><span>tools that work fully offline</span></div><div class="stat"><b>AES-256</b><span>encryption for private data in the app</span></div></div></div>

<section id="solve"><div class="wrap"><div class="sh"><h2>What HeyTools solves</h2><p>Most phones are full of single-purpose apps that ask for an account, show ads, or upload what you give them. HeyTools replaces that pile with one app that does the job and stays out of your way.</p></div>
<div class="cols">
<div class="card"><span class="ico">🧰</span><h3>Too many apps</h3><p>Video and music players, a recorder, notes, timers, alarms, converters and calculators in one install, with one consistent design.</p></div>
<div class="card"><span class="ico">🔒</span><h3>Privacy you can check</h3><p>No sign-up and no ad networks. Files you pick are processed on your device. Private data in the app is encrypted, and the privacy page lists every online service a tool can contact.</p></div>
<div class="card"><span class="ico">📴</span><h3>Works without signal</h3><p>${local.filter((t) => t.net === 'offline').length} tools work fully offline, and most others work offline for the parts that do not need the internet.</p></div>
<div class="card"><span class="ico">⚡</span><h3>Fast and light</h3><p>Each tool is a small page that opens instantly. No bloated suite to wait for, and no account to create first.</p></div>
</div></div></section>

<section id="tools" class="alt"><div class="wrap"><div class="sh"><h2>All ${N} tools</h2><p>Tap a tool to open it. The label shows whether it works offline. <a href="features/">Read what each one can do →</a></p></div>
<div class="tools-bar" role="group" aria-label="Filter tools">${chips}<input class="search" id="q" type="search" placeholder="Search tools" aria-label="Search tools"></div>
<div class="grid" id="grid">${grid}</div><p id="none" class="fine" hidden>No tool matches that search.</p>
${ext.map((t) => `<p class="fine">Also from the maker: <a href="${t.external}" target="_blank" rel="noopener">${esc(t.name)}</a>, ${esc(t.desc.replace(/\.$/, ''))}. It has its own privacy policy.</p>`).join('')}
</div></section>

<section id="highlights" class="dk"><div class="wrap"><div class="sh"><h2>Highlights</h2><p>A few things people use HeyTools for most.</p></div>
<div class="cols">
<div class="card"><span class="ico">▶️</span><h3>Video Player</h3><p>Import videos or folders, resume where you stopped, watch live TV from 100+ countries, search streaming sites, with a queue, picture-in-picture and subtitles.</p></div>
<div class="card"><span class="ico">🎵</span><h3>Music Player</h3><p>A 3D vinyl player for your own audio files, plus Spotify, YouTube, SoundCloud, Apple Music and Deezer links.</p></div>
<div class="card"><span class="ico">🛡️</span><h3>Anti-Theft Guard <small>(Android app)</small></h3><p>${esc(guard ? guard.desc : 'Locks the screen and sounds an alarm if your phone is snatched or unplugged.')} Not available on the website.</p></div>
<div class="card"><span class="ico">📍</span><h3>Geo Camera</h3><p>Photos stamped with place, date, time, weather and coordinates.</p></div>
<div class="card"><span class="ico">🎙️</span><h3>Recorder</h3><p>Voice, video and screen recording with pause and markers. Recordings stay on your device, encrypted in the app.</p></div>
<div class="card"><span class="ico">📝</span><h3>Notes, trackers and money</h3><p>Notes, to-dos, habits, water, expenses and bill splitting, with reminders, all private.</p></div>
</div><p class="fine center"><a href="features/">See screenshots and details for every tool →</a></p></div></section>

<section id="privacy"><div class="wrap"><div class="sh"><h2>Privacy, with clear boundaries</h2><p>No account and no advertising is the promise. These three lines say where the honest edges are.</p></div>
<div class="three">
<div class="card"><b class="n">1</b><h3>Never leaves your device</h3><p>Notes, trackers, expenses, recordings, photos, passwords and settings. Files you pick are processed locally. Private data in the app is encrypted with a password you choose, or with a device-only key if you prefer no password.</p></div>
<div class="card"><b class="n">2</b><h3>Sent only when you use an online feature</h3><p>Music and video streaming, live TV, weather and place lookups, the internet speed test and media downloads contact the services that provide them, and those services receive the request they need to answer.</p></div>
<div class="card"><b class="n">3</b><h3>Optional analytics</h3><p>Anonymous download counts are off until you turn them on. When on, they send an event name, device type and a random number, never your files or notes.</p></div>
</div><p class="fine center"><a href="privacy/">Read the full privacy page →</a> · Security checks are safeguards, not a certification: <a href="https://github.com/Mithunsg08/heytools/blob/main/SECURITY.md" rel="noopener">what they cover and what they don’t</a>.</p></div></section>

<section id="get-app" class="alt"><div class="wrap"><div class="sh"><h2>Get HeyTools</h2><p>One app with every tool. It finds the videos and music on your phone, keeps playback going with the screen off, and sends alarm and reminder notifications.</p></div>
<div class="getg">
<div class="card" data-for="android"><h3>Android phone or tablet</h3><p>Free download. Your phone may ask once to allow installs from your browser, and Google Play Protect may offer to scan the app: tap <b>Scan</b> or <b>Install anyway</b>.</p><p style="margin-top:14px"><a class="btn pri" data-apk data-where="hub-section" href="${APK}" download>Download for Android</a></p></div>
<div class="card" data-for="ios"><h3>iPhone and iPad</h3><p>Open the web app, tap Share, then <b>Add to Home Screen</b>. Many tools run offline. App-only tools such as Anti-Theft Guard are Android only.</p><p style="margin-top:14px"><a class="btn ghost" href="app/">Open the web app</a></p></div>
<div class="card" data-for="desktop"><h3>Windows, Mac and Chromebook</h3><p>Open the web app and use your browser’s install button to add it to your computer.</p><p style="margin-top:14px"><a class="btn ghost" href="app/">Open the web app</a></p></div>
</div></div></section>

<section id="faq"><div class="wrap faq" style="margin:auto"><div class="sh"><h2>Questions</h2></div>${FAQ.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div></section>
</main>` + FOOT('') + `
<script src="track-config.js"></script><script src="heytrack.js"></script><script src="install-prompt.js" defer></script>
<script>(function(){var g=document.getElementById('grid'),cs=[].slice.call(g.children),q=document.getElementById('q'),bs=[].slice.call(document.querySelectorAll('.chip')),f='all',n=document.getElementById('none');
function run(){var t=q.value.trim().toLowerCase(),c=0;cs.forEach(function(e){var ok=(f==='all'||e.dataset.cat===f)&&(!t||e.dataset.q.indexOf(t)>=0);e.hidden=!ok;if(ok)c++});n.hidden=c>0}
bs.forEach(function(b){b.onclick=function(){f=b.dataset.f;bs.forEach(function(x){x.setAttribute('aria-pressed',x===b)});run()}});q.oninput=run;
var ua=navigator.userAgent||'',k=/iPhone|iPad|iPod/i.test(ua)||(/Macintosh/i.test(ua)&&navigator.maxTouchPoints>1)?'ios':/Android/i.test(ua)?'android':'desktop',c=document.querySelector('[data-for="'+k+'"]');if(c){c.classList.add('is-you');c.parentNode.insertBefore(c,c.parentNode.firstChild)}})();</script>
</body></html>
`;
}

/* ---------------- features page ---------------- */
function features() {
  const ld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'CollectionPage', name: 'HeyTools features', url: BASE + '/features/', description: `Screenshots and features of all ${N} HeyTools tools.`, isPartOf: { '@id': BASE + '/#site' } },
    { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'HeyTools', item: BASE + '/' }, { '@type': 'ListItem', position: 2, name: 'Features', item: BASE + '/features/' }] }
  ] };
  let body = '';
  for (const c of CATS) {
    const ts = local.filter((t) => t.cat === c.id); if (!ts.length) continue;
    body += `<h2 class="cat-h" id="c-${c.id}">${esc(c.label)}</h2>` + ts.map((t) => `<article class="feat" id="${t.id}"><div class="phone">${shot(t, '../')}</div><div><h2>${esc(t.icon)} ${esc(t.name)}</h2><p style="margin:8px 0 10px;color:var(--muted)">${esc(t.desc)}</p>${badge(t)}${t.netNote ? `<p class="fine">${esc(t.netNote)}</p>` : ''}<ul>${FD[t.id].map((f) => `<li>${esc(f)}</li>`).join('')}</ul><a class="btn pri" href="../${t.id}/">Open ${esc(t.name)}</a></div></article>`).join('');
  }
  const guardCard = guard ? `<article class="feat" id="${guard.id}"><div class="phone" style="display:grid;place-items:center;font-size:4rem;aspect-ratio:9/12;background:linear-gradient(160deg,#14213D,#2B4EFF)">🛡️</div><div><h2>${esc(guard.name)}</h2><p style="margin:8px 0 10px;color:var(--muted)">${esc(guard.desc)}</p><span class="bd ok">Android app only</span><ul><li>Arms when the phone is charging and sounds a loud alarm if the charger is unplugged</li><li>Detects a real snatch (carried away, not just picked up and put down), locks the screen and sounds the siren</li><li>Alarm keeps going until you unlock the phone, or until your own time limit</li><li>History log of events, kept on the device</li></ul><p class="fine">It cannot stop a hardware force-restart or the power menu; Android does not allow that without special powers.</p><a class="btn pri" href="../#get-app">Get the Android app</a></div></article>` : '';
  return HEAD({ title: `HeyTools features: screenshots of all ${N} tools`, desc: `See what every HeyTools tool does, with screenshots: video and music player, recorder, geo camera, notes, trackers, converters, calculators, games and more. Free, private, no account.`, url: BASE + '/features/', up: '../', ld }) + NAV('features', '../') + `
<main id="main"><div class="wrap"><div style="padding:clamp(28px,5vw,56px) 0 8px"><p class="crumb"><a href="../">HeyTools</a> › Features</p><h1 style="font-size:clamp(2.1rem,5vw,3.6rem)">Every tool. <em>In pictures.</em></h1><p class="lead">What each of the ${N} tools does, with a real screenshot. Labels show whether a tool works offline.</p>
<div class="tools-bar" aria-label="Jump to a category">${CATS.filter((c) => local.some((t) => t.cat === c.id)).map((c) => `<a class="chip" style="text-decoration:none;display:inline-flex;align-items:center" href="#c-${c.id}">${esc(c.label)}</a>`).join('')}<a class="chip" style="text-decoration:none;display:inline-flex;align-items:center" href="#${guard ? guard.id : ''}">App only</a></div></div>
${body}${guardCard}</div></main>` + FOOT('../') + `<script src="../track-config.js"></script><script src="../heytrack.js"></script></body></html>
`;
}
fs.mkdirSync(path.join(root, 'features'), { recursive: true });
fs.writeFileSync(path.join(root, 'index.html'), home());
fs.writeFileSync(path.join(root, 'features/index.html'), features());
module.exports = { HEAD, NAV, FOOT, BASE, N, esc };
if (require.main === module) console.log('Built index.html and features/index.html for', N, 'tools');

/* ---------------- about page ---------------- */
function about() {
  const ld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'AboutPage', name: 'About HeyTools', url: BASE + '/about/', isPartOf: { '@id': BASE + '/#site' }, about: { '@id': BASE + '/#org' } },
    { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'HeyTools', item: BASE + '/' }, { '@type': 'ListItem', position: 2, name: 'About', item: BASE + '/about/' }] }
  ] };
  return HEAD({ title: 'About HeyTools: private, local-first tools with no account or ads', desc: 'Why HeyTools exists: replace a pile of single-purpose apps with one free set of private tools. What we solve, how it works, what stays on your device and the honest limits.', url: BASE + '/about/', up: '../', ld }) + NAV('about', '../') + `
<main id="main"><div class="wrap prose" style="padding-top:clamp(28px,5vw,56px)"><p class="crumb"><a href="../">HeyTools</a> › About</p>
<h1 style="font-size:clamp(2.1rem,5vw,3.4rem)">Small tools. <em>Big respect for your data.</em></h1>
<p class="lead">HeyTools is a free collection of ${N} everyday tools for your phone and browser, built around three ideas: no account, no advertising, and your data stays on your device.</p>
<h2>What we are solving</h2>
<ul><li><strong>App clutter.</strong> Players, recorders, notes, timers, converters and calculators usually come from different apps with different designs. HeyTools puts them in one place.</li>
<li><strong>Sign-ups and ads for simple jobs.</strong> Counting words or resizing an image should not need an account or an ad network.</li>
<li><strong>Uploads you cannot verify.</strong> Where possible the work happens on your device, so there is no upload step to trust.</li>
<li><strong>Private notes and trackers.</strong> Your notes, expenses, habits and recordings are yours. In the Android app they are encrypted on the device.</li></ul>
<h2>How it works</h2>
<p>Every tool is a self-contained page that runs in your browser. The Android app wraps the same tools, adds things a website cannot do (background playback, reliable alarms, notifications, Anti-Theft Guard) and encrypts private data. There is no HeyTools server that receives your content.</p>
<h2>Local-first, with honest edges</h2>
<p>Some tools are useful because they go online: music and video streaming, live TV, weather and place lookups, the internet speed test, media downloads. Those services receive the requests needed to answer, only when you use that feature. The <a href="../privacy/">privacy page</a> separates what never leaves your device, what is sent when you use an online feature, and the optional anonymous download counts that are off by default.</p>
<h2>Security, without overclaiming</h2>
<p>HeyTools uses a Content Security Policy, blocks cleartext network traffic on Android, disables Android backup, keeps encryption keys in the Android Keystore, encrypts backups, audits dependencies and checks its own source automatically. These are safeguards, <strong>not a security certification or an independent audit</strong>. <a href="https://github.com/Mithunsg08/heytools/blob/main/SECURITY.md" rel="noopener">SECURITY.md</a> explains what each one does and does not cover, including limits such as Anti-Theft Guard being unable to stop a hardware force-restart.</p>
<h2>Who makes it</h2>
<p>HeyTools is built and maintained by one developer, Mithun. The code is public on <a href="https://github.com/Mithunsg08/heytools" rel="noopener">GitHub</a>, where you can report a problem or suggest a tool.</p>
<p class="btns" style="margin-top:28px"><a class="btn pri" href="../#get-app">Get the app</a><a class="btn ghost" href="../features/">See every feature</a><a class="btn ghost" href="../privacy/">Read the privacy page</a></p>
</div></main>` + FOOT('../') + `<script src="../track-config.js"></script><script src="../heytrack.js"></script></body></html>
`;
}
fs.mkdirSync(path.join(root, 'about'), { recursive: true });
fs.writeFileSync(path.join(root, 'about/index.html'), about());
