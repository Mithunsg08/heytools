'use strict';
const assert = require('node:assert');
const nodeCrypto = require('node:crypto');
function mk(withPlugin, ls = new Map()) {
  const localStorage = { getItem: k => ls.has(k) ? ls.get(k) : null, setItem: (k, v) => ls.set(k, String(v)), removeItem: k => ls.delete(k), get length() { return ls.size; }, key: i => [...ls.keys()][i] };
  const key = ls.__key || (ls.__key = nodeCrypto.randomBytes(32));   // the Keystore key persists across app restarts
  const plugin = {
    encrypt: async ({ key: k, value }) => { const iv = nodeCrypto.randomBytes(12); const c = nodeCrypto.createCipheriv('aes-256-gcm', key, iv); c.setAAD(Buffer.from('heytools-secure-record-v1:' + k)); const d = Buffer.concat([c.update(value, 'utf8'), c.final(), c.getAuthTag()]); return { v: 1, alg: 'A256GCM', iv: iv.toString('base64'), data: d.toString('base64') }; },
    decrypt: async ({ key: k, envelope }) => { const b = Buffer.from(envelope.data, 'base64'); const d = nodeCrypto.createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64')); d.setAAD(Buffer.from('heytools-secure-record-v1:' + k)); d.setAuthTag(b.subarray(b.length - 16)); return { value: Buffer.concat([d.update(b.subarray(0, b.length - 16)), d.final()]).toString('utf8') }; }
  };
  const root = { localStorage, setInterval, clearInterval, crypto: nodeCrypto.webcrypto };
  if (withPlugin) { root.Capacitor = { isNativePlatform: () => true, Plugins: { SecureStorage: plugin, AppLock: { authenticate: async () => ({ ok: root.__authOk !== false }) } } }; root.top = root; root.parent = root; }
  delete require.cache[require.resolve('../heysecure.js')];
  const g = globalThis; const keep = g.window; g.window = root;
  const HS = require('../heysecure.js'); g.window = keep;
  return { HS, ls, plugin, root };
}
(async () => {
  const PW = 'correct horse battery';
  const { HS, ls, plugin } = mk(true);
  // a record from the earlier device-key version, plus an old plaintext key
  const v1 = await plugin.encrypt({ key: 'heytools.habits.v1', value: JSON.stringify({ h: [{ n: 'old' }] }) });
  ls.set('hs1:heytools.habits.v1', JSON.stringify(v1));
  ls.set('notes-and-todo:v1', JSON.stringify({ notes: [{ t: 'secret-note' }] }));
  assert.strictEqual(HS.isSetUp(), false);
  await assert.rejects(HS.setup('short'));
  await HS.setup(PW);
  assert.ok(HS.isSetUp() && HS.isUnlocked());
  assert.strictEqual(ls.get('notes-and-todo:v1'), undefined, 'plaintext removed');
  assert.ok(![...ls.values()].some(v => v.includes('secret-note')), 'no readable data stored');
  assert.strictEqual(JSON.parse(ls.get('hs1:heytools.habits.v1')).v, 2, 'v1 upgraded to password key');
  assert.deepStrictEqual(await HS.getJSON('heytools.habits.v1', null), { h: [{ n: 'old' }] });
  // round trip, ordering, key binding
  await Promise.all([1, 2, 3].map(n => HS.setJSON('k1', { n })));
  assert.deepStrictEqual(await HS.getJSON('k1', null), { n: 3 });
  ls.set('hs1:other', ls.get('hs1:k1'));
  await assert.rejects(HS.getJSON('other', null));
  // password is never stored
  assert.ok(![...ls.values()].some(v => v.includes(PW)));
  // restart: locked, wrong password rejected, right password opens
  const again = mk(true, ls).HS;
  assert.strictEqual(again.isUnlocked(), false);
  await assert.rejects(again.unlock('wrong password!'), /Wrong password/);
  assert.strictEqual(again.isUnlocked(), false);
  await again.unlock(PW);
  assert.deepStrictEqual(await again.getJSON('k1', null), { n: 3 });
  // export is decrypted for backups
  const exr = await again.exportAll(), ex = exr.data;
  assert.deepStrictEqual(exr.failed, ['other']);
  assert.deepStrictEqual(JSON.parse(ex['notes-and-todo:v1']), { notes: [{ t: 'secret-note' }] });
  // change password
  await assert.rejects(again.changePassword('nope nope nope', 'another long password'));
  await again.changePassword(PW, 'another long password');
  const third = mk(true, ls).HS;
  await assert.rejects(third.unlock(PW));
  await third.unlock('another long password');
  assert.deepStrictEqual(await third.getJSON('k1', null), { n: 3 });
  // blobs: chunked, bound to their record, tamper-evident
  const big = new Blob([nodeCrypto.randomBytes(9 * 1024 * 1024)], { type: 'video/webm' });
  const env = await third.sealBlob('rec:1:blob', big);
  assert.strictEqual(env.chunks.length, 3);
  const back = await third.openBlob('rec:1:blob', env);
  assert.strictEqual(back.size, big.size); assert.strictEqual(back.type, 'video/webm');
  assert.ok(Buffer.from(await back.arrayBuffer()).equals(Buffer.from(await big.arrayBuffer())), 'blob round trip');
  await assert.rejects(third.openBlob('rec:2:blob', env), 'record binding');
  await assert.rejects(third.openBlob('rec:1:blob', { ...env, chunks: [env.chunks[1], env.chunks[0], env.chunks[2]] }), 'reorder detected');
  await assert.rejects(third.openBlob('rec:1:blob', { ...env, chunks: env.chunks.slice(0, 2) }), 'truncation detected');
  const je = await third.sealJSON('m', { name: 'private name' });
  assert.deepStrictEqual(await third.openJSON('m', je), { name: 'private name' });
  // legacy raw string (markdown, word counter) is migrated as text
  ls.set('wc-text', 'plain draft, not JSON');
  assert.strictEqual(await third.getJSON('wc-text', '', { raw: true }), 'plain draft, not JSON');
  assert.strictEqual(ls.get('wc-text'), undefined);
  // rapid saves collapse to the newest value
  await Promise.all(Array.from({ length: 20 }, (_, n) => third.setJSON('typing', 'v' + n)));
  assert.strictEqual(await third.getJSON('typing', null), 'v19');
  // quick unlock with the phone lock instead of typing the password
  assert.ok(third.canQuick() && !third.quickReady());
  await assert.rejects(third.enableQuick('not the password'), /Wrong password/);
  await third.enableQuick('another long password');
  assert.ok(third.quickReady());
  assert.ok(!ls.get('hs2quick').includes('another long password'));
  const q = mk(true, ls); const qHS = q.HS;
  assert.strictEqual(qHS.isUnlocked(), false);
  await qHS.unlockQuick();
  assert.deepStrictEqual(await qHS.getJSON('k1', null), { n: 3 });
  // phone lock declined: stays locked
  const dec = mk(true, ls); dec.root.__authOk = false;
  await assert.rejects(dec.HS.unlockQuick(), /Not confirmed/);
  assert.strictEqual(dec.HS.isUnlocked(), false);
  await third.disableQuick(); assert.ok(!third.quickReady());
  // a public website page (not the app) keeps plain local settings and never shows the lock screen
  const web = mk(false); web.HS.inApp = () => false;
  await web.HS.setJSON('wc-text', 'hello'); assert.strictEqual(await web.HS.getJSON('wc-text', null), 'hello');
  assert.strictEqual(web.ls.get('wc-text'), '"hello"');
  // forgotten password: erase leaves nothing
  await third.reset();
  assert.strictEqual([...ls.keys()].filter(k => k.startsWith('hs')).length, 0);
  const fresh = mk(true, ls).HS; assert.strictEqual(fresh.isSetUp(), false);
  console.log('heysecure tests passed'); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
