'use strict';
const assert = require('node:assert');
const nodeCrypto = require('node:crypto');
function mk(withPlugin, ls = new Map()) {
  const localStorage = { getItem: k => ls.has(k) ? ls.get(k) : null, setItem: (k, v) => ls.set(k, String(v)), removeItem: k => ls.delete(k), get length() { return ls.size; }, key: i => [...ls.keys()][i] };
  const key = nodeCrypto.randomBytes(32);
  const plugin = {
    encrypt: async ({ key: k, value }) => { const iv = nodeCrypto.randomBytes(12); const c = nodeCrypto.createCipheriv('aes-256-gcm', key, iv); c.setAAD(Buffer.from('heytools-secure-record-v1:' + k)); const d = Buffer.concat([c.update(value, 'utf8'), c.final(), c.getAuthTag()]); return { v: 1, alg: 'A256GCM', iv: iv.toString('base64'), data: d.toString('base64') }; },
    decrypt: async ({ key: k, envelope }) => { const b = Buffer.from(envelope.data, 'base64'); const d = nodeCrypto.createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64')); d.setAAD(Buffer.from('heytools-secure-record-v1:' + k)); d.setAuthTag(b.subarray(b.length - 16)); return { value: Buffer.concat([d.update(b.subarray(0, b.length - 16)), d.final()]).toString('utf8') }; }
  };
  const root = { localStorage, setInterval, clearInterval, crypto: nodeCrypto.webcrypto };
  if (withPlugin) { root.Capacitor = { isNativePlatform: () => true, Plugins: { SecureStorage: plugin } }; root.top = root; root.parent = root; }
  delete require.cache[require.resolve('../heysecure.js')];
  const g = globalThis; const keep = g.window; g.window = root;
  const HS = require('../heysecure.js'); g.window = keep;
  return { HS, ls, plugin };
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
  // forgotten password: erase leaves nothing
  await third.reset();
  assert.strictEqual([...ls.keys()].filter(k => k.startsWith('hs')).length, 0);
  const fresh = mk(true, ls).HS; assert.strictEqual(fresh.isSetUp(), false);
  console.log('heysecure tests passed'); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
