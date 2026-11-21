'use strict';
const assert = require('node:assert');
const nodeCrypto = require('node:crypto');
function mk(withPlugin) {
  const ls = new Map();
  const localStorage = { getItem: k => ls.has(k) ? ls.get(k) : null, setItem: (k, v) => ls.set(k, String(v)), removeItem: k => ls.delete(k), get length() { return ls.size; }, key: i => [...ls.keys()][i] };
  const key = nodeCrypto.randomBytes(32);
  const plugin = {
    encrypt: async ({ key: k, value }) => { const iv = nodeCrypto.randomBytes(12); const c = nodeCrypto.createCipheriv('aes-256-gcm', key, iv); c.setAAD(Buffer.from('heytools-secure-record-v1:' + k)); const d = Buffer.concat([c.update(value, 'utf8'), c.final(), c.getAuthTag()]); return { v: 1, alg: 'A256GCM', iv: iv.toString('base64'), data: d.toString('base64') }; },
    decrypt: async ({ key: k, envelope }) => { const b = Buffer.from(envelope.data, 'base64'); const d = nodeCrypto.createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64')); d.setAAD(Buffer.from('heytools-secure-record-v1:' + k)); d.setAuthTag(b.subarray(b.length - 16)); return { value: Buffer.concat([d.update(b.subarray(0, b.length - 16)), d.final()]).toString('utf8') }; }
  };
  const root = { localStorage, setInterval, clearInterval };
  if (withPlugin) { const C = { isNativePlatform: () => true, Plugins: { SecureStorage: plugin } }; root.Capacitor = C; root.top = root; root.parent = root; }
  delete require.cache[require.resolve('../heysecure.js')];
  const g = globalThis; const keep = g.window; g.window = root;
  const HS = require('../heysecure.js'); g.window = keep;
  return { HS, ls, plugin };
}
(async () => {
  const { HS, ls } = mk(true);
  // legacy plaintext is migrated, then removed
  ls.set('notes:v1', JSON.stringify({ notes: [{ t: 'secret' }] }));
  assert.deepStrictEqual(await HS.getJSON('notes:v1', null), { notes: [{ t: 'secret' }] });
  assert.strictEqual(ls.get('notes:v1'), undefined, 'plaintext removed after migration');
  assert.ok(!ls.get('hs1:notes:v1').includes('secret'), 'ciphertext only');
  // round trip + overwrite
  await HS.setJSON('k1', { a: 1 }); await HS.setJSON('k1', { a: 2 });
  assert.deepStrictEqual(await HS.getJSON('k1', null), { a: 2 });
  // missing returns fallback
  assert.strictEqual(await HS.getJSON('nope', 'fb'), 'fb');
  // record cannot be moved to another key (AAD)
  ls.set('hs1:other', ls.get('hs1:k1'));
  await assert.rejects(HS.getJSON('other', null));
  // tamper detected
  const env = JSON.parse(ls.get('hs1:k1')); env.data = Buffer.from('x'.repeat(24)).toString('base64'); ls.set('hs1:k1', JSON.stringify(env));
  await assert.rejects(HS.getJSON('k1', null));
  // invalid key rejected
  assert.throws(() => HS.getJSON('bad key!', null));
  // concurrent writes keep order
  await Promise.all([1, 2, 3, 4, 5].map(n => HS.setJSON('q', { n })));
  assert.deepStrictEqual(await HS.getJSON('q', null), { n: 5 });
  // remove
  await HS.remove('q'); assert.strictEqual(await HS.getJSON('q', 'gone'), 'gone');
  // fail closed: no backend, writes reject and nothing readable is stored
  const n = mk(false); n.HS.status = n.HS.status;
  const origSet = n.ls.set.bind(n.ls);
  await assert.rejects(n.HS.setJSON('z', { secret: 1 }));
  assert.strictEqual(n.ls.size, 0, 'no plaintext fallback');
  console.log('heysecure tests passed');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
