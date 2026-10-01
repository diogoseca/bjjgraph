import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import * as K from '../neural/src/knowledge-profile.src.js';
import { ngStudyCreateEngine } from '../neural/src/game-study-engine.src.js';
import { ngWireDecks, ngWireDeckIndex } from '../neural/src/wire-keys.src.js';
const require = createRequire(import.meta.url), root = new URL('../neural/src/', import.meta.url);
const text = name => readFileSync(new URL(name, root), 'utf8');
const M = require('../neural/src/mdp-model.src.js'), E = require('../neural/src/mdp-exposure.src.js');
// The exact native concatenation convention; all adapter scalar laws and the
// actual learning helper are resolved from frozen native source in this realm.
const G = new Function('module', 'require', text('mdp-identity.src.js') + '\n' + text('mdp-model.src.js') + '\n' + text('mdp-adapter.src.js') + '\nreturn module.exports;')({ exports: {} }, createRequire(new URL('mdp-model.src.js', root)));
const L = new Function('module', 'require', text('mdp-identity.src.js') + '\n' + text('mdp-model.src.js') + '\n' + text('mdp-learning.src.js') + '\nreturn module.exports;')({ exports: {} }, createRequire(new URL('mdp-model.src.js', root)));
const sha = bytes => createHash('sha256').update(bytes).digest('hex'), encode = value => new TextEncoder().encode(JSON.stringify(value));
const laws = Object.fromEntries(['identity','model','adapter','knowledge','certified','exposure'].map(k =>
  [k, sha(text(k === 'knowledge' ? 'knowledge-profile.src.js' : 'mdp-' + k + '.src.js'))]));
const copy = value => structuredClone(value);
function fixture({ choice = true, scenarios = 1 } = {}) {
  const rawNodes = [{ id: 'Mount', t: 'Mount Top', ty: 'positions', posId: 'mount', cal: { avail: { gi: true, nogi: true }, stateAlias: null } }];
  const decks = { 'Mount|Top': ['Position', 1], 'Mount|Bottom': ['Position', 1] };
  if (choice) {
    rawNodes.push({ id: 'Tap', t: 'Tap', ty: 'transitions', cal: { avail: { gi: true, nogi: true }, stateAlias: null } });
    decks['Tap|Attacker'] = ['Transition', 1]; decks['Tap|Defender'] = ['Transition', 1];
  }
  const graph = { nodes: rawNodes, links: [], toTab: [], evFrame: 'nogi' };
  const index = { _meta: { format: 3, status: 'generated' }, decks, shared: {} }, gb = encode(graph), ib = encode(index);
  const nodes = [{ id: 'Mount', t: 'Mount Top', ty: 'positions', role: 'top', deckKey: 'Mount|Top', dom: 0, allowed: true, s: [0, 0] },
    { id: 'Mount/Bottom', t: 'Mount Bottom', ty: 'positions', role: 'bottom', deckKey: 'Mount|Bottom', dom: 0, allowed: true, s: [0, 0] }];
  if (choice) nodes.push({ id: 'Tap', t: 'Tap', ty: 'transitions', role: 'attacker', fromRole: 'top', fallbackRole: 'top', deckKey: 'Tap|Attacker', dom: 0,
    allowed: true, s: [0, 0], cal: { successRate: 50, outcomes: [{ result: 'success', to: 'win', probability: 1 }, { result: 'fail', to: 'same', probability: 1 }] } });
  const metadata = { version: 1, coverage: { status: 'COMPLETE' }, ruleset: 'gi', lossAversion: 1, evFrame: 'nogi', nodes,
    canonical: { [M.ngMdpStable(['Mount','bottom'])]: 'Mount/Bottom' },
    hands: { [M.ngMdpStable(['Mount','top'])]: choice ? [{ techniqueId: 'Tap', kind: 'transition', destinationId: 'Mount' }] : [],
      [M.ngMdpStable(['Mount/Bottom','bottom'])]: [] }, evHands: {},
    destinations: { win: { terminal: true }, same: { nodeId: 'Mount', role: 'top', terminal: false } } };
  const profile = K.ngKnowledgeBuildProfile({ revision: 1, evidenceRevision: 'fixture-evidence', contentRevision: K.ngKnowledgeFingerprint(ngWireDeckIndex(ngWireDecks(index, rawNodes), index.shared)), day: 5 });
  const registration = { modelHash: 'fixture-model', mechanicsHash: 'fixture-mechanics', graphHash: sha(gb), opponentPolicyHash: 'fixture-opponent',
    ruleset: 'gi', lossAversion: 1, manifestHash: 'c'.repeat(64), variantHash: 'd'.repeat(64), transportOnly: 'not-request-context' };
  const expected = { graphHash: sha(gb), indexHash: sha(ib), graphBytes: gb.length, indexBytes: ib.length, lawHashes: laws };
  const installation = { graphHash: expected.graphHash, indexHash: expected.indexHash, lawHashes: laws }; installation.id = M.ngMdpDigest(installation);
  const snapshot = { nodeId: 'Mount', role: 'top', phase: 'user', moveCount: 0, arrivalAge: 0, qMod: 0, combo: 0, positionKey: 'Mount|Top', panicKey: null };
  const request = { apiVersion: 2, requestId: 'baseline', revision: 1, ...Object.fromEntries(['modelHash','mechanicsHash','graphHash','opponentPolicyHash','ruleset'].map(k => [k, registration[k]])),
    profileHash: profile.fingerprint, objective: M.NG_MDP_OBJECTIVE, horizon: { kind: 'actual-roll', episodeCap: 2, moveCount: 0 },
    futureStudyPolicy: profile.studyPolicy, state: { id: 'logical-context', snapshot, aiSkill: 0, challenge: null } };
  const runtime = { residencyRevision: 1, deckReady: Object.fromEntries(Object.keys(decks).map(k => [k,true])) };
  const startDistribution = [{ stateId: 'declared-start', probability: '1' }], startSnapshots = [{ stateId: 'declared-start', snapshot }];
  const capture = { ownerEpoch: 'fixture-owner-1', day: 5, ruleset: 'gi', profileHash: profile.fingerprint, profileRevision: profile.revision,
    evidenceRevision: profile.evidenceRevision, contentRevision: profile.contentRevision, residencyHash: M.ngMdpDigest(runtime), residencyRevision: 1,
    logicalContextHash: M.ngMdpContractHash(request), startDistributionHash: M.ngMdpDigest(startDistribution), startMappingHash: M.ngMdpDigest(startSnapshots),
    installationId: installation.id, graphHash: expected.graphHash, indexHash: expected.indexHash };
  const job = { baseline: { request, profile }, runtime, startDistribution, startSnapshots, capture,
    scenarios: Array.from({ length: scenarios }, (_, i) => ({ targets: [{ deckKey: 'Mount|Top', role: 'Top', sharpTo: (i + 1) / 200 }] })) };
  const config = { expected, registration, installation, dataBase: 'https://fixture.test/neural/', bounds: {
    scheduler: { maxRequestNodes: 10000, maxRequestBytes: 100000, maxResultNodes: 100000, maxResultBytes: 1000000, maxDepth: 48,
      maxStarts: 8, maxScenarios: 16, maxTargets: 8, maxQueueMilliseconds: 1000, maxRunMilliseconds: 10000 },
    manifest: { maxGraphBytes: 10000, maxIndexBytes: 10000, maxNodes: 32, maxDecks: 64, maxSharedGroups: 32, maxSharedMemberships: 128 },
    projector: { maxTargets: 8, maxDecks: 64, maxSharedGroups: 32, maxSharedMemberships: 128 },
    coordinator: { maxScenarios: 16, maxDecksPerScenario: 8, maxProfileKeys: 128 },
    bridge: { maxStarts: 8, maxStates: 32, maxBranches: 128, maxWorkStates: 32, maxWorkBranches: 128, maxCacheEntries: 8,
      maxMilliseconds: 5000, maxPrepareMilliseconds: 1000, maxSolveMilliseconds: 1000, maxFixedMilliseconds: 1000,
      maxExposureMilliseconds: 1000, maxRationalBits: 4096 } } };
  const reads = [], counts = { solve: 0, fixed: 0, exposure: 0, metadata: 0 }, stageLimits = [];
  const deps = { M: { ...M, async ngMdpSolveAsync(...args) { counts.solve++; stageLimits.push(['solve',args[2].maxMilliseconds]); return M.ngMdpSolveAsync(...args); } },
    G, K, E: { ...E, async ngMdpEvaluateFixedPolicyAsync(...args) { counts.fixed++; stageLimits.push(['fixed',args[4].maxMilliseconds]); return E.ngMdpEvaluateFixedPolicyAsync(...args); },
      async ngMdpEvaluateExposureAsync(...args) { counts.exposure++; stageLimits.push(['exposure',args[2].maxMilliseconds]); return E.ngMdpEvaluateExposureAsync(...args); } },
    evaluateStudyScenarios: L.ngMdpEvaluateStudyScenarios, metadataHost: { async load(reg) { counts.metadata++; assert.deepEqual(reg, registration); return copy(metadata); } },
    async fetch(url, options) { reads.push({ url, options }); return new Response(url.endsWith('graph-data.json') ? gb : ib); } };
  let stale = false;
  const control = { installation, check() { if (stale) throw new Error('fixture-stale-owner'); }, progress() {} };
  return { config, deps, job, control, counts, reads, metadata, stageLimits, stale() { stale = true; }, engine() { return ngStudyCreateEngine(config, deps); } };
}

test('actual tiny native choice model runs verified source/projector/bridge/fixed/exposure/coordinator assembly', async () => {
  const f = fixture(), original = JSON.stringify(f.job), result = await f.engine().execute(f.job, f.control);
  assert.equal(result.status, 'ready', JSON.stringify(result));
  assert.equal(result.coordinator.coverage.readyScenarios, 1); assert.deepEqual(f.counts, { solve: 2, fixed: 2, exposure: 1, metadata: 1 });
  assert.equal(result.receipts.baseline.outcomes.win, .5); // authored fixture, not production result
  const row = result.receipts.scenarios[0]; assert.equal(row.evaluation.outcomes.win, .505);
  assert.equal(row.exposure.records[0].value, 1); assert.equal(row.exposure.records[0].evidence.exact, '1/1');
  assert.equal(row.exposure.provenance.labelAdmission.kind, 'admitted-native-label-replay');
  assert.equal(row.exposure.provenance.labelAdmission.metadataHash, M.ngMdpDigest(f.metadata));
  assert.equal(row.evaluation.bridgeReceipt.independentDiagnostics.algorithm, 'fixed-policy-sparse-scc-v1');
  assert.equal(result.receipts.startAdmission.behaviorCompression, false);
  assert.ok(f.stageLimits.every(([,n]) => n === 1000)); assert.equal(JSON.stringify(f.job), original);
  assert.equal(f.reads.length, 2); assert.ok(f.reads.every(r => r.options.signal.aborted && r.options.credentials === 'omit'));
});

test('12 real tiny hypotheses preserve baseline exposure without hitting the 8-artifact cap', async () => {
  const f = fixture({ choice: false, scenarios: 12 }), result = await f.engine().execute(f.job, f.control);
  assert.equal(result.status, 'ready', JSON.stringify(result)); assert.equal(result.coordinator.coverage.readyScenarios, 12);
  assert.deepEqual(f.counts, { solve: 13, fixed: 13, exposure: 12, metadata: 1 });
  assert.ok(result.receipts.scenarios.every(r => r.exposure.records[0].exactZero && r.evaluation.outcomes.explicitNoResult === 1));
});

test('trusted native registration mismatch rejects a coherently rehashed job before source IO', async () => {
  const f = fixture(); f.job.baseline.request.modelHash = 'untrusted-model'; f.job.capture.logicalContextHash = M.ngMdpContractHash(f.job.baseline.request);
  const result = await f.engine().execute(f.job, f.control);
  assert.equal(result.reason, 'stale-study-engine-registration:modelHash'); assert.equal(f.reads.length, 0); assert.equal(f.counts.solve, 0);
});

test('complete start mapping is required; invalid exact total is not silently normalized', async () => {
  for (const kind of ['missing', 'mass']) {
    const f = fixture();
    if (kind === 'missing') f.job.startSnapshots = [];
    else { f.job.startDistribution[0].probability = '1/2'; f.job.capture.startDistributionHash = M.ngMdpDigest(f.job.startDistribution); }
    const result = await f.engine().execute(f.job, f.control);
    assert.equal(result.status, 'unavailable'); assert.equal(f.counts.solve, 0);
    if (kind === 'missing') { assert.match(result.reason, /complete-study-starts/); assert.equal(f.reads.length, 0); }
    else assert.equal(result.receipts.baseline.reason, 'non-normalized-start-distribution');
  }
});

test('equal-size untrusted graph bytes fail actual hash admission and dispose the loader', async () => {
  const f = fixture(), real = f.deps.fetch;
  f.deps.fetch = async (...args) => { const r = await real(...args); const bytes = new Uint8Array(await r.arrayBuffer()); if (args[0].endsWith('graph-data.json')) bytes[5] ^= 1; return new Response(bytes); };
  const result = await f.engine().execute(f.job, f.control);
  assert.match(result.reason, /graph-sha256-mismatch/); assert.equal(f.counts.solve, 0); assert.ok(f.reads.every(r => r.options.signal.aborted));
});

test('stale owner after native fixed receipt cannot publish scenario values', async () => {
  const f = fixture(), fixed = f.deps.E.ngMdpEvaluateFixedPolicyAsync;
  f.deps.E.ngMdpEvaluateFixedPolicyAsync = async (...args) => { const value = await fixed(...args); f.stale(); return value; };
  const result = await f.engine().execute(f.job, f.control);
  assert.equal(result.status, 'unavailable'); assert.match(result.reason, /stale-owner/); assert.equal(f.counts.exposure, 0);
  assert.ok(f.reads.every(r => r.options.signal.aborted));
});

test('concurrent batches are rejected and disposal invalidates pending source work', async () => {
  const f = fixture(); let release;
  f.deps.metadataHost.load = () => new Promise(resolve => { release = resolve; });
  const engine = f.engine(), pending = engine.execute(f.job, f.control);
  assert.equal((await engine.execute(f.job, f.control)).reason, 'study-engine-busy');
  engine.dispose(); release(copy(f.metadata));
  const result = await pending; assert.equal(result.status, 'unavailable'); assert.match(result.reason, /disposed/);
  assert.equal((await engine.execute(f.job, f.control)).reason, 'study-engine-disposed'); assert.equal(f.counts.solve, 0);
  assert.ok(f.reads.every(r => r.options.signal.aborted));
});

test('sequential jobs create fresh source/bridge ownership without touching earned profile evidence', async () => {
  const f = fixture({ choice: false }), engine = f.engine();
  const first = await engine.execute(f.job, f.control), second = await engine.execute(f.job, f.control);
  assert.equal(first.status, 'ready', JSON.stringify(first)); assert.equal(second.status, 'ready', JSON.stringify(second));
  assert.equal(f.counts.metadata, 2); assert.equal(f.counts.solve, 4); assert.equal(f.job.baseline.profile.sharp['Mount|Top'], undefined);
  assert.ok(f.reads.every(r => r.options.signal.aborted));
});

// Execute the actual engine with only resource factories wrapped for cleanup
// faults; all source loading, tiny native solves and coordinator work stay real.
async function cleanupFaultEngine(wrapSource, wrapBridge) {
  const imports = await Promise.all([
    import('../neural/src/game-study-sources.src.js'),
    import('../neural/src/knowledge-scenario-manifest.src.js'),
    import('../neural/src/knowledge-scenarios.src.js'),
    import('../neural/src/study-batch-runner.src.js'),
    import('../neural/src/study-native-bridge.src.js'),
    import('../neural/src/gameplan-study-provider.src.js'),
    import('../neural/src/study-scheduler.src.js'),
  ]);
  const source = text('game-study-engine.src.js').replace(/^import .* from ".*";$/gm, '').replace('export function ngStudyCreateEngine', 'function ngStudyCreateEngine');
  const bindings = Object.assign({}, ...imports);
  bindings.ngStudyCreateSources = (...args) => wrapSource(imports[0].ngStudyCreateSources(...args));
  bindings.ngStudyCreateBridge = (...args) => wrapBridge(imports[4].ngStudyCreateBridge(...args));
  return new Function(...Object.keys(bindings), source + '\nreturn ngStudyCreateEngine;')(...Object.values(bindings));
}

test('source cleanup failure prevents publication, attempts disposal and releases the engine for the next job', async () => {
  let calls = 0;
  const factory = await cleanupFaultEngine(source => ({ ...source, dispose() {
    calls++; source.dispose(); if (calls === 1) throw new Error('injected-source-cleanup');
  } }), bridge => bridge);
  const f = fixture({ choice: false }), engine = factory(f.config, f.deps);
  const first = await engine.execute(f.job, f.control);
  assert.equal(first.status, 'unavailable'); assert.equal(first.reason, 'injected-source-cleanup');
  assert.ok(f.reads.every(r => r.options.signal.aborted));
  const second = await engine.execute(f.job, f.control);
  assert.equal(second.status, 'ready', JSON.stringify(second)); assert.equal(calls, 2);
});

test('dispose attempts source cleanup after bridge cleanup throws and cannot retain a pending native job', async () => {
  let bridgeCalls = 0, sourceCalls = 0, releaseFixed, enteredFixed;
  const entered = new Promise(resolve => { enteredFixed = resolve; });
  const gate = new Promise(resolve => { releaseFixed = resolve; });
  const factory = await cleanupFaultEngine(source => ({ ...source, dispose() {
    sourceCalls++; source.dispose(); throw new Error('injected-source-dispose');
  } }), bridge => ({ ...bridge, clear() {
    bridgeCalls++; bridge.clear(); throw new Error('injected-bridge-dispose');
  } }));
  const f = fixture(), fixed = f.deps.E.ngMdpEvaluateFixedPolicyAsync;
  f.deps.E.ngMdpEvaluateFixedPolicyAsync = async (...args) => { enteredFixed(); await gate; return fixed(...args); };
  const engine = factory(f.config, f.deps), pending = engine.execute(f.job, f.control);
  await entered;
  try { assert.throws(() => engine.dispose(), /injected-bridge-dispose/); }
  finally { releaseFixed(); }
  assert.equal(sourceCalls, 1); assert.equal(bridgeCalls, 1);
  assert.ok(f.reads.every(r => r.options.signal.aborted));
  assert.equal((await pending).status, 'unavailable');
  engine.dispose(); assert.equal(sourceCalls, 1); assert.equal(bridgeCalls, 1);
  assert.equal((await engine.execute(f.job, f.control)).reason, 'study-engine-disposed');
});

test('even a falsy thrown cleanup value prevents ready publication', async () => {
  const factory = await cleanupFaultEngine(source => ({ ...source, dispose() { source.dispose(); throw null; } }), bridge => bridge);
  const f = fixture({ choice: false }), result = await factory(f.config, f.deps).execute(f.job, f.control);
  assert.equal(result.status, 'unavailable'); assert.equal(result.reason, 'study-engine-cleanup-failed');
  assert.ok(f.reads.every(r => r.options.signal.aborted));
});
