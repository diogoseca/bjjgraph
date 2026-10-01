import { bindProgressGuestForTest } from './_progress_owner_harness.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto, createHash } from 'node:crypto';
const source = readFileSync(new URL('../neural/src/app.src.jsx', import.meta.url), 'utf8');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const wire = '\ufeff {"nodes":[], "links":[], "evFrame":"nogi", "evLam":[1,2,4]}\n';
const bytesFor = text => new TextEncoder().encode(text).buffer;
function fixture(crypto = webcrypto) {
  const C = new Function('DCLogic', 'React', 'crypto', source + '\nreturn Component;')(class {}, { createRef: () => ({ current: null }) }, crypto);
  const app = Object.create(C.prototype), changes = [];
  bindProgressGuestForTest(app);
  Object.assign(app, { _gameValueChanged: (...args) => changes.push(args) });
  const data = () => JSON.parse(wire.replace(/^\ufeff/, ''));
  return { C, app, changes, data, ingest() { app.ingest(data()); return app._gameValueGraph; } };
}
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
test('real ingest retires provenance and raw bytes hash exactly including BOM and whitespace', async () => {
  const f = fixture(), stamp = f.ingest(), bytes = bytesFor(wire);
  assert.equal(stamp.status, 'unverified');
  assert.equal(await f.app._verifyGameValueGraph(bytes, stamp), true);
  assert.equal(f.app._gameValueGraph.hash, digest(new Uint8Array(bytes)));
  assert.notEqual(f.app._gameValueGraph.hash, digest(JSON.stringify(f.data())));
  assert.equal(f.app._gameValueGraph.status, 'verified');
  assert.ok(Object.isFrozen(f.app._gameValueGraph));
  assert.ok(!Object.values(f.app).some(v => v === bytes), 'raw bytes are not retained on app');
  f.ingest(); assert.equal(f.app._gameValueGraph.status, 'unverified'); assert.equal(f.app._gameValueGraph.hash, null);
});
test('late old-ingest digest cannot certify a replacement graph, including fixture ingest', async () => {
  const wait = deferred(), f = fixture({ subtle: { digest: () => wait.promise } });
  const first = f.ingest(), pending = f.app._verifyGameValueGraph(bytesFor(wire), first);
  assert.equal(f.app._gameValueGraph.status, 'pending');
  const second = f.ingest(); wait.resolve(new Uint8Array(32).buffer);
  assert.equal(await pending, false); assert.equal(f.app._gameValueGraph, second);
  assert.equal(f.changes.some(([reason]) => reason === 'graph-verified'), false);
});
test('destroyed and stale-account owners cannot publish late digest success or failure', async () => {
  for (const retirement of ['destroy', 'account']) for (const failure of [false, true]) {
    const wait = deferred(), f = fixture({ subtle: { digest: () => wait.promise } }); let current = true;
    f.app._progressCurrent = () => current;
    const pending = f.app._verifyGameValueGraph(bytesFor(wire), f.ingest());
    if (retirement === 'destroy') f.app.__ngDestroyed = true; else current = false;
    if (failure) wait.reject(new Error('late')); else wait.resolve(new Uint8Array(32).buffer);
    assert.equal(await pending, false);
    assert.equal(f.changes.some(([reason]) => reason.startsWith('graph-verif')), false);
  }
});
test('missing, rejecting and malformed WebCrypto fail closed without weak hash fallback', async () => {
  for (const crypto of [undefined, {}, { subtle: { digest() { throw new Error('unsupported'); } } },
    { subtle: { digest: () => Promise.reject(new Error('failed')) } },
    { subtle: { digest: async () => new ArrayBuffer(16) } }, { subtle: { digest: async () => null } }]) {
    const f = fixture(crypto === undefined ? null : crypto);
    assert.equal(await f.app._verifyGameValueGraph(bytesFor(wire), f.ingest()), false);
    assert.equal(f.app._gameValueGraph.status, 'unavailable'); assert.equal(f.app._gameValueGraph.hash, null);
  }
});
test('mismatched ingestion token cannot start hashing or replace current evidence', async () => {
  let hashes = 0; const f = fixture({ subtle: { digest() { hashes++; return Promise.resolve(new ArrayBuffer(32)); } } });
  const old = f.ingest(), current = f.ingest();
  assert.equal(await f.app._verifyGameValueGraph(bytesFor(wire), old), false);
  assert.equal(hashes, 0); assert.equal(f.app._gameValueGraph, current);
});
test('actual boot fetch splice consumes once, preserves literal rewrite, and never awaits the digest', async () => {
  const start = source.indexOf('    let data = null, graphBytes = null;');
  const end = source.indexOf('    // a /l/<code> arrival', start);
  assert.ok(start >= 0 && end > start);
  const splice = source.slice(start, end);
  assert.ok(splice.includes('fetch("graph-data.json")'));
  const wait = deferred(); let reads = 0, fetches = 0, verification;
  const f = fixture({ subtle: { digest: () => wait.promise } });
  const verify = f.app._verifyGameValueGraph.bind(f.app);
  f.app._verifyGameValueGraph = (...args) => (verification = verify(...args));
  f.app._progressCurrent = () => true;
  f.app._fallbackToLegacy = () => assert.fail('valid graph fell back');
  const boot = new Function('fetch', 'return async function() {\n' + splice + '\nreturn "first-hand-can-continue"; };')(
    async url => { assert.equal(url, 'graph-data.json'); fetches++; return { ok: true, async arrayBuffer() { reads++; return bytesFor(wire); }, json() { assert.fail('double read'); } }; });
  assert.equal(await boot.call(f.app), 'first-hand-can-continue');
  assert.equal(f.app._gameValueGraph.status, 'pending'); assert.equal(reads, 1); assert.equal(fetches, 1);
  wait.resolve(await webcrypto.subtle.digest('SHA-256', bytesFor(wire)));
  assert.equal(await verification, true);
});
test('boot splice guards the owner after fetch and body-read before real ingest', async () => {
  const start = source.indexOf('    let data = null, graphBytes = null;');
  const splice = source.slice(start, source.indexOf('    // a /l/<code> arrival', start));
  for (const phase of ['fetch', 'body']) {
    let owner = true, reads = 0, ingests = 0;
    const boot = new Function('fetch', 'return async function() {\n' + splice + '\n};')(async () => {
      if (phase === 'fetch') owner = false;
      return { ok: true, async arrayBuffer() { reads++; owner = false; return bytesFor(wire); } };
    });
    await boot.call({ _progressCurrent: () => owner, ingest() { ingests++; } });
    assert.equal(ingests, 0); assert.equal(reads, phase === 'fetch' ? 0 : 1);
  }
});
