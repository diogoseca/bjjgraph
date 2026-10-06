import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { ngGameValueDecode, ngGameValueCreateWorkerHost } from '../neural/src/game-value-loader.src.js';
import { ngGameValueRegistrationKey } from '../neural/src/game-value-provider.src.js';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const encode = value => Buffer.from(JSON.stringify(value));
const H = letter => sha(letter);
const M = { ngMdpStable: value => JSON.stringify(value) };
function recordsOf(value) {
  const records = [];
  function put(v) {
    let record = v;
    if (Array.isArray(v)) record = v.map(put);
    else if (v && typeof v === 'object') { record = {}; for (const [k, x] of Object.entries(v)) record[put(k)] = put(x); }
    const i = records.length; records.push(record); return i;
  }
  const root = put(value); return { root, records };
}
function wireFixture() {
  const coverage = { status: 'COMPLETE', source: 'fixture', nodes: 2, hands: 1 };
  const packed = { header: { version: 1, ruleset: 'gi', evFrame: 'nogi', lossAversion: 2, coverage },
    nodes: [['position', 'Position', 'positions', 'top', null, null, null, null, null, [1, -1], 0.2, true, null, 'Position|Top', 'top', 'position'],
      ['submission', 'Submission', 'submissions', null, 'top', 0, 1, 'position', 'position', [2, -2], 0.5, true,
        { defenses: [{ to: 'reset', detail: 0 }] }, 'Submission', 'top', 'submission']],
    hands: [[0, 'top', [[1, 0, 'top', 'entry', null, false, { att: 1, c1: 0.1 }]]]],
    canonical: [[1, 'bottom', 0]], destinations: [['reset', null, null, true]], evHands: [[0, 'top', [[1, 1, 0.1]]]] };
  const table = recordsOf(packed), raw = encode(table.records), files = new Map(), parts = [];
  const url = file => 'https://test/mdp/' + file;
  for (let start = 0; start < raw.length; start += 190) {
    const bytes = raw.subarray(start, start + 190), hash = sha(bytes), file = 'part-' + hash + '.txt';
    files.set(url(file), bytes); parts.push({ file, sha256: hash, rawBytes: bytes.length });
  }
  const descriptor = { ruleset: 'gi', lossAversion: 2, mechanicsHash: H('mechanics'), coverage,
    codec: 'mdp-columns-v1', partEncoding: 'utf8-json-fragments', root: table.root, records: table.records.length,
    parts, transfer: { rawBytes: raw.length, sha256: sha(raw) } };
  const descriptorRaw = encode(descriptor), metadataHash = sha(descriptorRaw), variantFile = 'variant-' + metadataHash + '.json';
  files.set(url(variantFile), descriptorRaw);
  const lawHashes = Object.fromEntries(['adapter', 'model', 'knowledge', 'identity', 'certified'].map(k => [k, H(k)]));
  const manifest = { version: 1, codec: 'mdp-columns-v1', status: 'COMPLETE',
    provenance: { graphHash: H('graph'), modelHash: H('model build'), lawHashes },
    variants: [{ ruleset: 'gi', lossAversion: 2, mechanicsHash: H('mechanics'), status: 'COMPLETE',
      file: variantFile, sha256: metadataHash, rawBytes: descriptorRaw.length }] };
  const manifestRaw = encode(manifest), manifestHash = sha(manifestRaw);
  files.set(url('manifest.json'), manifestRaw);
  const expected = { graphHash: manifest.provenance.graphHash, modelHash: manifest.provenance.modelHash,
    opponentPolicyHash: H('policy'), lawHashes, manifestHash, manifestBytes: manifestRaw.length };
  const reg = { verified: true, coverage, ...expected, mechanicsHash: H('mechanics'), metadataHash,
    manifestUrl: url('manifest.json'), metadataUrl: url(variantFile), ruleset: 'gi', evFrame: 'nogi', evIndex: 1, lossAversion: 2 };
  const calls = []; let active = 0, peak = 0;
  const deps = { mdp: M, knowledge: {}, expected, registrationKey: ngGameValueRegistrationKey,
    sha256: async bytes => sha(bytes), async fetch(u) {
      calls.push(u); active++; peak = Math.max(peak, active);
      await new Promise(resolve => setImmediate(resolve)); active--;
      const bytes = files.get(u); return { ok: !!bytes, async arrayBuffer() { return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength); } };
    }, createAdapter(metadata, profile, knowledge, runtime) { return { metadata, profile, runtime }; },
    async expandAsync(adapter, request, options) { return { adapter, request, cancelled: options.cancelled() }; } };
  return { packed, table, descriptor, manifest, files, deps, expected, reg, calls, get peak() { return peak; } };
}
test('lossless decoder resolves authored IDs, sparse canonical rows and all gameplay tables', () => {
  const f = wireFixture(), m = ngGameValueDecode(f.table.records, f.table.root);
  assert.equal(m.nodes[1].pairId, 'position'); assert.equal(m.nodes[1].submissionId, 'submission');
  assert.equal(m.canonical['["submission","bottom"]'], 'position');
  assert.equal(m.canonical['["submission","top"]'], 'submission');
  assert.equal(m.hands['["position","top"]'][0].techniqueId, 'submission');
  assert.equal(m.evHands['["position","top"]'][0].techniqueId, 'submission');
  assert.equal(m.destinations.reset.nodeId, null); assert.equal(m.destinations.reset.terminal, true);
  assert.equal(m.evFrame, 'nogi'); assert.equal(m.ruleset, 'gi');
  assert.equal(Object.isFrozen(m.nodes[1].cal.defenses), true);
});
test('decoder rejects references to current/future records and unsafe primitive numbers', () => {
  assert.throws(() => ngGameValueDecode([[0]], 0), /invalid-metadata-reference/);
  assert.throws(() => ngGameValueDecode([Infinity], 0), /invalid-metadata-number/);
  assert.throws(() => ngGameValueDecode([2 ** 54], 0), /invalid-metadata-number/);
  const f = wireFixture(); assert.throws(() => ngGameValueDecode(f.table.records, 0), /invalid-metadata-root/);
});
test('prototype-looking authored keys remain data without altering prototypes', () => {
  const f = wireFixture(); Object.defineProperty(f.packed.header, '__proto__', { value: { polluted: true }, enumerable: true });
  const table = recordsOf(f.packed), m = ngGameValueDecode(table.records, table.root);
  assert.equal(Object.prototype.polluted, undefined);
  assert.equal(Object.hasOwn(m, '__proto__'), true); assert.equal(m.__proto__.polluted, true);
});
test('worker loads and verifies once with at most four requests then returns only bounded root identities', async () => {
  const f = wireFixture(), host = ngGameValueCreateWorkerHost(f.deps);
  assert.equal(f.calls.length, 0);
  const [a, b] = await Promise.all([host.load(f.reg), host.load(f.reg)]); assert.equal(a, b);
  assert.equal(f.calls.length, 2 + f.descriptor.parts.length); assert.ok(f.peak <= 4); assert.ok(f.peak > 1);
  const before = f.calls.length, root = await host.describeRoot(f.reg, { nodeId: 'position', role: 'top' });
  await assert.rejects(host.describeRoot(f.reg, { nodeId: 'missing', role: 'top' }), /unknown-root-state/);
  assert.equal(before, f.calls.length); assert.equal(root.canonicalNodeId, 'position');
});
test('root projection never includes graph, calibrated rows, EV arrays or source detail prose', async () => {
  const f = wireFixture(), host = ngGameValueCreateWorkerHost(f.deps);
  const root = await host.describeRoot(f.reg, { nodeId: 'position', role: 'top' });
  assert.equal(root.graphHash, f.reg.graphHash); assert.equal(root.coverage.status, 'COMPLETE');
  assert.equal(root.registrationKey, ngGameValueRegistrationKey(f.reg, M.ngMdpStable));
  assert.equal(root.nodes, undefined); assert.equal(root.hand[0].ev, undefined);
  assert.equal(root.hand[0].defense, null); assert.equal(root.hand[0].techniqueId, 'submission');
});
test('changed bytes, byte counts, build identity or law hash refuse metadata', async () => {
  const f = wireFixture(); f.files.set(f.reg.metadataUrl, Buffer.from('changed'));
  await assert.rejects(ngGameValueCreateWorkerHost(f.deps).load(f.reg), /metadata-size-mismatch/);
  const g = wireFixture(), raw = Buffer.from(g.files.get(g.reg.metadataUrl)); raw[0] ^= 1; g.files.set(g.reg.metadataUrl, raw);
  await assert.rejects(ngGameValueCreateWorkerHost(g.deps).load(g.reg), /metadata-digest-mismatch/);
  const h = wireFixture();
  await assert.rejects(ngGameValueCreateWorkerHost(h.deps).load({ ...h.reg, graphHash: H('other') }), /stale-worker-build/);
  h.expected.lawHashes.adapter = H('other law');
  await assert.rejects(ngGameValueCreateWorkerHost(h.deps).load(h.reg), /stale-metadata-law:adapter/);
});
test('profile and all registration stamps verified before adapter; cancellation is not an outcome', async () => {
  const f = wireFixture(), host = ngGameValueCreateWorkerHost(f.deps);
  const profile = { fingerprint: 'profile', status: 'ready' }, runtime = { residencyRevision: 1, deckReady: {} };
  const snapshot = { id: 'snapshot', hash: 'snapshotHash', profileHash: 'profile', profile, runtime };
  const request = { ...f.reg, profileHash: 'profile', state: { snapshotId: snapshot.id, snapshotHash: snapshot.hash } };
  const scope = { snapshot, cancelled: () => false }, result = await host.buildModel(f.reg, request, scope);
  assert.equal(result.adapter.profile, profile); assert.equal(result.adapter.runtime, runtime);
  await assert.rejects(host.buildModel(f.reg, { ...request, profileHash: 'stale' }, scope), /stale-worker-profile/);
  await assert.rejects(host.buildModel(f.reg, request, { ...scope, cancelled: () => true }), /cancelled/);
});
test('certified law is mandatory and the complete dynamic law key set must match', async () => {
  const f = wireFixture(); delete f.expected.lawHashes.certified;
  assert.throws(() => ngGameValueCreateWorkerHost(f.deps), /missing-worker-build-identities/);
  const g = wireFixture(); g.expected.lawHashes.certified = H('different-certified');
  await assert.rejects(ngGameValueCreateWorkerHost(g.deps).load(g.reg), /stale-metadata-law:certified/);
  const h = wireFixture(); h.expected.lawHashes.futureLaw = H('future law');
  await assert.rejects(ngGameValueCreateWorkerHost(h.deps).load(h.reg), /metadata-law-key-mismatch/);
});
// FGRETRY1: a transient failure is retried with bounded backoff; an answer (404, integrity) never is
function flaky(f, rules) {
  const real = f.deps.fetch, attempts = new Map(), slept = [];
  f.deps.sleep = async ms => { slept.push(ms); };
  f.deps.fetch = async u => {
    const n = (attempts.get(u) || 0) + 1; attempts.set(u, n);
    const rule = rules(u, n);
    if (rule === 'network') throw new TypeError('Failed to fetch');
    if (typeof rule === 'number') return { ok: false, status: rule, async arrayBuffer() { return new ArrayBuffer(0); } };
    if (rule === 'drop-body') { const r = await real(u); return { ...r, body: { getReader() { return { async read() { throw new TypeError('network error'); }, releaseLock() {}, async cancel() {} }; } } }; }
    return real(u);
  };
  return { attempts, slept, partUrl: 'https://test/mdp/' + f.descriptor.parts[0].file };
}
test('a transient failure (network error, dropped body, 503) is retried and the metadata still loads', async () => {
  for (const kind of ['network', 'drop-body', 503, 429, 408]) {
    const f = wireFixture(), x = flaky(f, (u, n) => (u === 'https://test/mdp/' + f.descriptor.parts[0].file && n === 1 ? kind : null));
    const host = ngGameValueCreateWorkerHost(f.deps);
    const root = await host.describeRoot(f.reg, { nodeId: 'position', role: 'top' });
    assert.equal(root.canonicalNodeId, 'position', String(kind));
    assert.equal(x.attempts.get(x.partUrl), 2, `${kind}: the failed part was fetched exactly twice`);
    assert.deepEqual(x.slept, [300], `${kind}: one backoff`);
  }
});
test('a failure that never clears is bounded (4 attempts, 300/1000/3000 ms) and keeps its own class', async () => {
  const f = wireFixture(), x = flaky(f, u => (u === 'https://test/mdp/' + f.descriptor.parts[0].file ? 'network' : null));
  await assert.rejects(ngGameValueCreateWorkerHost(f.deps).load(f.reg), /^Error: metadata-network-failed$/);
  assert.equal(x.attempts.get(x.partUrl), 4); assert.deepEqual(x.slept, [300, 1000, 3000]);
  const g = wireFixture(), y = flaky(g, u => (u === 'https://test/mdp/' + g.descriptor.parts[0].file ? 503 : null));
  await assert.rejects(ngGameValueCreateWorkerHost(g.deps).load(g.reg), /^Error: metadata-fetch-failed$/);
  assert.equal(y.attempts.get(y.partUrl), 4);
});
test('an answer is never retried: a 404 or an integrity mismatch fails on the first attempt', async () => {
  const f = wireFixture(), x = flaky(f, u => (u === 'https://test/mdp/' + f.descriptor.parts[0].file ? 404 : null));
  await assert.rejects(ngGameValueCreateWorkerHost(f.deps).load(f.reg), /^Error: metadata-fetch-failed$/);
  assert.equal(x.attempts.get(x.partUrl), 1); assert.deepEqual(x.slept, []);
  const g = wireFixture(), raw = Buffer.from(g.files.get(g.reg.metadataUrl)); raw[0] ^= 1; g.files.set(g.reg.metadataUrl, raw);
  const y = flaky(g, () => null);
  await assert.rejects(ngGameValueCreateWorkerHost(g.deps).load(g.reg), /metadata-digest-mismatch/);
  assert.equal(y.attempts.get(g.reg.metadataUrl), 1); assert.deepEqual(y.slept, []);
});
test('a bug inside the loader is never mistaken for a network error', async () => {
  const f = wireFixture(), x = flaky(f, () => null);
  f.deps.sha256 = async () => { throw new TypeError('digest is not a function'); };
  await assert.rejects(ngGameValueCreateWorkerHost(f.deps).load(f.reg), /digest is not a function/);
  assert.deepEqual(x.slept, []);
});
