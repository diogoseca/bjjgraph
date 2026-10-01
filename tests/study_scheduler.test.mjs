import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { ngGameplanStudyCreateScheduler, ngStudyDemand, ngStudyLimits, ngStudyInstallation,
  ngStudySnapshot, NG_GAMEPLAN_STUDY_PROTOCOL as protocol } from '../neural/src/study-scheduler.src.js';
import { ngGameplanStudyInstallWorker } from '../neural/src/study-worker.src.js';
import { ngGameplanStudyCreateBatchRunner } from '../neural/src/study-batch-runner.src.js';

const source = new URL('../neural/src/', import.meta.url);
const M = createRequire(import.meta.url)(fileURLToPath(new URL('mdp-identity.src.js', source)));
const K = await import('data:text/javascript;base64,' + Buffer.from(readFileSync(new URL('knowledge-profile.src.js', source))).toString('base64'));
const limits = { maxRequestNodes: 2000, maxRequestBytes: 40000, maxResultNodes: 2000, maxResultBytes: 40000,
  maxDepth: 20, maxStarts: 16, maxScenarios: 4, maxTargets: 8, maxQueueMilliseconds: 50, maxRunMilliseconds: 20 };
const rawInstallation = { graphHash: '1'.repeat(64), indexHash: '2'.repeat(64), lawHashes: { knowledge: '3'.repeat(64) } };
const installation = { ...rawInstallation, id: M.ngMdpDigest(rawInstallation) };
const dependencies = { identity: M, fingerprint: K.ngKnowledgeFingerprint, installation };
const tick = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function fixture(ownerEpoch = 'opaque-owner-1') {
  const profile = K.ngKnowledgeBuildProfile({ prep: { 'Guard|Top': 1 }, sharp: {}, revision: 2,
    contentRevision: 'index-fingerprint-fixture', evidenceRevision: 'evidence-fixture', day: 21 });
  const snapshot = { nodeId: 'guard', role: 'top', phase: 'user', moveCount: 0, arrivalAge: 0, qMod: 0, combo: 0, positionKey: 'Guard|Top', panicKey: null };
  const id = M.ngMdpStateId(snapshot), runtime = { residencyRevision: 1, deckReady: { 'Guard|Top': true } };
  const request = { apiVersion: 2, requestId: 'test-request', revision: 2, modelHash: 'model-fixture', mechanicsHash: 'mechanics-fixture',
    graphHash: installation.graphHash, profileHash: profile.fingerprint, opponentPolicyHash: 'opponent-fixture', ruleset: 'gi',
    objective: M.NG_MDP_OBJECTIVE, horizon: { kind: 'actual-roll', episodeCap: 12, moveCount: 0 }, futureStudyPolicy: profile.studyPolicy,
    state: { id, snapshot, aiSkill: 0.07, challenge: null } };
  const startDistribution = [{ stateId: id, probability: '1' }], startSnapshots = [{ stateId: id, snapshot }];
  return structuredClone({ capture: { ownerEpoch, day: 21, ruleset: 'gi', profileHash: profile.fingerprint, profileRevision: 2,
    evidenceRevision: profile.evidenceRevision, contentRevision: profile.contentRevision, residencyHash: M.ngMdpDigest(runtime), residencyRevision: 1,
    logicalContextHash: M.ngMdpContractHash(request), startDistributionHash: M.ngMdpDigest(startDistribution), startMappingHash: M.ngMdpDigest(startSnapshots),
    installationId: installation.id, graphHash: installation.graphHash, indexHash: installation.indexHash },
    baseline: { request, profile }, runtime, startDistribution, startSnapshots, scenarios: [{ targets: [{ deckKey: 'Guard|Top', role: 'Top', sharpTo: .05 }] }] });
}
function clock() {
  let at = 0, serial = 0; const timers = new Map();
  return { now: () => at, setTimer(fn, delay) { const id = ++serial; timers.set(id, { fn, at: at + delay }); return id; },
    clearTimer(id) { timers.delete(id); }, advance(ms) { at += ms; for (const [id, timer] of [...timers]) if (timer.at <= at) { timers.delete(id); timer.fn(); } }, timers };
}
class WorkerDouble {
  listeners = new Map(); messages = []; terminations = 0;
  addEventListener(name, fn) { this.listeners.set(name, fn); }
  removeEventListener(name, fn) { if (this.listeners.get(name) === fn) this.listeners.delete(name); }
  postMessage(message) { this.messages.push(message); }
  terminate() { this.terminations++; }
  reply(part) { const m = this.messages.find(x => x.type === 'run'); this.listeners.get('message')?.({ data: { protocol, jobId: m.jobId, key: m.key, ...part } }); }
}
function host(extra = {}) {
  const time = clock(), workers = [], statuses = []; let releases = 0, admissions = 0;
  const lease = () => ({ status: 'admitted', id: 'test-admission-' + admissions, expiresAt: time.now() + 100, release() { releases++; } });
  const deps = { ...dependencies, ...time, isCurrent: () => true, onStatus: s => statuses.push(s),
    async admit() { admissions++; return lease(); }, createWorker() { const w = new WorkerDouble(); workers.push(w); return w; }, ...extra };
  return { scheduler: ngGameplanStudyCreateScheduler(deps, limits), deps, workers, statuses, time, lease,
    get releases() { return releases; }, get admissions() { return admissions; } };
}
const unavailable = { status: 'unavailable', reason: 'synthetic-no-model', coordinator: null };

test('identical demand coalesces; immutable copy and exact-once teardown preserve unavailable evidence', async () => {
  const h = host(), job = fixture(), a = h.scheduler.submit(job), b = h.scheduler.submit(structuredClone(job));
  assert.equal(a, b); job.capture.ownerEpoch = 'mutated-caller'; await tick();
  assert.equal(h.admissions, 1); assert.equal(h.workers.length, 1);
  assert.equal(h.workers[0].messages[0].job.capture.ownerEpoch, 'opaque-owner-1');
  h.workers[0].reply({ type: 'accepted' }); h.workers[0].reply({ type: 'result', result: unavailable });
  const result = await a; assert.equal(result.transportStatus, 'complete'); assert.equal(result.result.reason, 'synthetic-no-model');
  assert.ok(Object.isFrozen(result.result)); assert.equal(h.releases, 1); assert.equal(h.workers[0].terminations, 1);
  h.scheduler.destroy(); assert.equal(h.releases, 1); assert.equal(h.workers[0].terminations, 1);
});
test('new owner supersedes old worker; late old reply cannot cancel or publish into new job', async () => {
  const h = host(), first = h.scheduler.submit(fixture()); await tick(); const old = h.workers[0], late = old.listeners.get('message');
  const second = h.scheduler.submit(fixture('opaque-owner-2')); await tick();
  assert.equal((await first).reason, 'study-superseded'); assert.equal(old.terminations, 1);
  late({ data: { ...old.messages[0], type: 'result', result: unavailable } });
  assert.equal(h.workers[1].terminations, 0); h.workers[1].reply({ type: 'result', result: unavailable });
  assert.equal((await second).capture.ownerEpoch, 'opaque-owner-2'); assert.equal(h.releases, 2);
});
test('late granted admission is released after cancellation; no worker starts', async () => {
  const grant = deferred(), h = host({ admit: () => grant.promise }), promise = h.scheduler.submit(fixture());
  h.scheduler.invalidate('owner-changed'); assert.equal((await promise).reason, 'owner-changed');
  grant.resolve(h.lease()); await tick(); assert.equal(h.releases, 1); assert.equal(h.workers.length, 0);
});
test('superseding a hung admission cannot accumulate concurrent admission callbacks', async () => {
  const gate = deferred(); let calls = 0;
  const h = host({ admit: () => { calls++; return calls === 1 ? gate.promise : h.lease(); } });
  const a = h.scheduler.submit(fixture('a')), b = h.scheduler.submit(fixture('b')), c = h.scheduler.submit(fixture('c'));
  assert.equal((await a).reason, 'study-superseded'); assert.equal((await b).reason, 'study-superseded'); assert.equal(calls, 1);
  assert.equal(h.statuses.at(-1).dependency, 'previous-study-admission'); gate.resolve(h.lease()); await tick();
  assert.equal(calls, 2); assert.equal(h.workers.length, 1); h.workers[0].reply({ type: 'result', result: unavailable }); await c;
  assert.equal(h.releases, 2);
});
test('named deferred admission stays queued until explicit retry, without background work', async () => {
  let allow = false; const h = host({ admit: () => allow ? h.lease() : { status: 'deferred', dependency: 'live-choice-worker' } });
  const p = h.scheduler.submit(fixture()); await tick(); assert.equal(h.workers.length, 0);
  assert.deepEqual(h.statuses.at(-1).dependency, 'live-choice-worker'); assert.equal(h.statuses.at(-1).phase, 'queued');
  allow = true; h.scheduler.retryAdmission(); await tick(); assert.equal(h.workers.length, 1);
  h.workers[0].reply({ type: 'result', result: unavailable }); await p;
});
test('queue expiry aborts a hanging admission and releases a later grant once', async () => {
  const grant = deferred(), h = host({ admit: (_m, signal) => { h.signal = signal; return grant.promise; } });
  const p = h.scheduler.submit(fixture()); h.time.advance(50); assert.equal((await p).reason, 'study-queue-deadline');
  assert.ok(h.signal.aborted); grant.resolve(h.lease()); await tick(); assert.equal(h.releases, 1);
});
test('hard deadline terminates an unresponsive worker and leaves no lease or timer', async () => {
  const h = host(), p = h.scheduler.submit(fixture()); await tick(); h.time.advance(20);
  assert.equal((await p).reason, 'study-hard-deadline'); assert.equal(h.workers[0].terminations, 1);
  assert.equal(h.releases, 1); assert.equal(h.time.timers.size, 0);
});
test('full freshness predicate is checked after admission and before accepting a reply', async () => {
  let current = true; const h = host({ isCurrent: () => current }); const p = h.scheduler.submit(fixture()); await tick(); current = false;
  h.workers[0].reply({ type: 'result', result: unavailable }); assert.equal((await p).reason, 'stale-study-capture');
  assert.equal(h.workers[0].terminations, 1); assert.equal(h.releases, 1);
});
test('wrong job key is ignored; malformed owned response fails instead of inventing zero', async () => {
  const h = host(), p = h.scheduler.submit(fixture()); await tick(); const w = h.workers[0];
  w.reply({ type: 'result', key: 'wrong', result: unavailable }); assert.equal(w.terminations, 0);
  w.reply({ type: 'result', result: { status: 'bogus', numericFallback: 0 } });
  const r = await p; assert.equal(r.reason, 'invalid-study-worker-result'); assert.equal(r.result, null);
});
test('capture detects day, profile, ruleset, residency, raw-source and complete-start drift before admission', async () => {
  const mutations = [j => j.capture.day++, j => j.capture.profileRevision++, j => j.capture.ruleset = 'nogi',
    j => j.runtime.deckReady['Guard|Top'] = false, j => j.capture.indexHash = '4'.repeat(64),
    j => j.startSnapshots.pop(), j => j.startDistribution[0].probability = '1/2', j => j.baseline.profile.permanent['Guard|Top'] = .15];
  for (const mutate of mutations) { const h = host(), j = fixture(); mutate(j); const r = await h.scheduler.submit(j); assert.equal(r.transportStatus, 'unavailable'); assert.equal(h.admissions, 0); }
});
test('snapshot rejects getters without executing them, sparse arrays, hidden fields and oversized strings', () => {
  const l = { maxNodes: 100, maxBytes: 64, maxDepth: 4 }; let invoked = false;
  const getter = {}; Object.defineProperty(getter, 'secret', { enumerable: true, get() { invoked = true; return 1; } });
  assert.throws(() => ngStudySnapshot(getter, l), /accessor/); assert.equal(invoked, false);
  assert.throws(() => ngStudySnapshot([, 1], l), /sparse/);
  const hidden = {}; Object.defineProperty(hidden, 'hidden', { value: 1 }); assert.throws(() => ngStudySnapshot(hidden, l), /hidden/);
  assert.throws(() => ngStudySnapshot({ huge: 'x'.repeat(80) }, l), /budget/);
});
test('destroyed scheduler never creates another worker; live-client-like object is not an accepted transport', async () => {
  const h = host(); h.scheduler.destroy(); assert.equal((await h.scheduler.submit(fixture())).reason, 'study-scheduler-destroyed'); assert.equal(h.admissions, 0);
  const bad = host({ createWorker: () => ({ updateSnapshot() { throw Error('must not call'); }, cancel() { throw Error('must not call'); } }) });
  const r = await bad.scheduler.submit(fixture()); assert.equal(r.reason, 'invalid-study-worker'); assert.equal(bad.releases, 1);
});
test('lease cleanup failure cannot publish apparently complete evidence', async () => {
  const h = host({ admit: () => ({ status: 'admitted', id: 'broken-lease', expiresAt: 100, release() { throw Error('fixture'); } }) });
  const p = h.scheduler.submit(fixture()); await tick(); h.workers[0].reply({ type: 'result', result: unavailable });
  const r = await p; assert.equal(r.reason, 'admission-release-failed'); assert.equal(r.result, null);
});
test('worker independently rejects changed source installation/key and permits only one job', async () => {
  const replies = [], endpoint = { addEventListener(_n, f) { this.receive = f; }, removeEventListener() {}, postMessage(m) { replies.push(m); } };
  let calls = 0; ngGameplanStudyInstallWorker(endpoint, { ...dependencies, execute: async () => { calls++; return unavailable; } }, limits);
  const { job, key } = ngStudyDemand(fixture(), dependencies, ngStudyLimits(limits), ngStudyInstallation(installation, M, limits));
  await endpoint.receive({ data: { protocol, type: 'run', jobId: 'fixture', key: 'wrong', job } });
  assert.equal(replies.at(-1).reason, 'study-demand-key-mismatch'); assert.equal(calls, 0);
  await endpoint.receive({ data: { protocol, type: 'run', jobId: 'fixture2', key, job } });
  assert.equal(replies.at(-1).reason, 'study-worker-single-job-only'); assert.equal(calls, 0);
});
test('worker cooperative cancellation suppresses late result and immutable job reaches executor', async () => {
  const replies = [], pending = deferred(), endpoint = { addEventListener(_n, f) { this.receive = f; }, removeEventListener() {}, postMessage(m) { replies.push(m); } };
  ngGameplanStudyInstallWorker(endpoint, { ...dependencies, execute: async job => { assert.ok(Object.isFrozen(job.baseline.profile)); return pending.promise; } }, limits);
  const { job, key } = ngStudyDemand(fixture(), dependencies, ngStudyLimits(limits), ngStudyInstallation(installation, M, limits));
  const run = endpoint.receive({ data: { protocol, type: 'run', jobId: 'fixture', key, job } }); await tick();
  await endpoint.receive({ data: { protocol, type: 'cancel', jobId: 'fixture', key } }); pending.resolve(unavailable); await run;
  assert.deepEqual(replies.map(r => r.type), ['accepted']);
});
test('missing real batch executor remains unavailable, never a dummy policy', async () => {
  const replies = [], endpoint = { addEventListener(_n, f) { this.receive = f; }, removeEventListener() {}, postMessage(m) { replies.push(m); } };
  ngGameplanStudyInstallWorker(endpoint, dependencies, limits);
  const { job, key } = ngStudyDemand(fixture(), dependencies, ngStudyLimits(limits), ngStudyInstallation(installation, M, limits));
  await endpoint.receive({ data: { protocol, type: 'run', jobId: 'fixture', key, job } }); assert.equal(replies.at(-1).reason, 'missing-study-batch-executor');
});
test('batch assembly refuses missing source seam and propagates real manifest unavailability before any bridge', async () => {
  const control = { installation, check() {}, progress() {} };
  assert.equal((await ngGameplanStudyCreateBatchRunner({}, {})(fixture(), control)).reason, 'missing-study-executor:loadSources');
  let bridges = 0;
  const run = ngGameplanStudyCreateBatchRunner({ loadSources: async () => ({ graphBytes: new Uint8Array([1]), indexBytes: new Uint8Array([2]) }),
    manifestProduce: async args => { assert.equal(args.expected.indexHash, installation.indexHash); return { status: 'unavailable', reason: 'index-sha256-mismatch' }; },
    project() { assert.fail('must not project'); }, prepareBridge() { bridges++; }, coordinate() {}, evaluateStudyScenarios() {}, fingerprint: K.ngKnowledgeFingerprint }, { manifest: {} });
  const r = await run(fixture(), control); assert.equal(r.reason, 'index-sha256-mismatch'); assert.equal(bridges, 0); assert.equal(r.coordinator, null);
});
test('runner retains entire projections and the exact serial callback receipts needed by presenter v1', async () => {
  const job = fixture(); job.scenarios.push({ targets: [{ deckKey: 'Guard|Top', role: 'Top', sharpTo: .06 }] });
  let projected = 0, exposures = 0, cleared = 0; const outputs = [], released = [];
  const manifest = { status: 'ready', manifest: { fingerprint: 'fixture-manifest' }, provenance: {
    kind: 'verified-raw-study-manifest', graphHash: job.capture.graphHash, indexHash: job.capture.indexHash,
    contentRevision: job.capture.contentRevision, manifestHash: 'fixture-manifest' } };
  const baseline = { status: 'ready', policyId: 'fixture-baseline-policy', bridgeReceipt: { fixture: true } };
  const secondExposure = { status: 'ready', fixture: 'second-actual-callback-no-numeric-evidence' };
  const bridge = { async evaluate(args) { return args.scenarioId ? { status: 'unavailable', reason: 'fixture-native-refusal' } : baseline; },
    async exposure() { return ++exposures === 1 ? { status: 'unavailable', reason: 'fixture-first-exposure' } : secondExposure; },
    release(args) { released.push(args.scenarioId); },
    clear() { cleared++; } };
  const run = ngGameplanStudyCreateBatchRunner({ loadSources: async () => ({ graphBytes: new Uint8Array([1]), indexBytes: new Uint8Array([2]) }),
    manifestProduce: async () => manifest, project(args) {
      const id = 'fixture-' + (++projected), profile = structuredClone(args.baselineProfile); profile.sharp['Guard|Top'] = args.targets[0].sharpTo;
      const body = { ...profile }; delete body.fingerprint; profile.fingerprint = K.ngKnowledgeFingerprint(body);
      const output = { status: 'ready', scenario: { id, profile, profileHash: profile.fingerprint,
        deckKeys: [{ deckKey: 'Guard|Top', role: 'Top', headroom: .22, componentHeadroom: { permanent: .12, sharp: .1 } }],
        changes: { kind: 'hypothetical-knowledge-input', records: [{ deckKey: 'Guard|Top', role: 'Top', component: 'sharp', from: 0, to: args.targets[0].sharpTo }] } },
        provenance: { kind: 'hypothetical-knowledge-input', targetSemantics: 'declared-mechanics-input-no-earned-credit',
          baselineProfileHash: job.capture.profileHash, manifestHash: 'fixture-manifest', graphHash: job.capture.graphHash,
          logicalContextHash: job.capture.logicalContextHash, ruleset: 'gi', day: 21, sharedClosure: { status: 'validated', deckKeys: [] } } };
      outputs.push(output); return output;
    }, prepareBridge: async () => ({ status: 'ready', bridge, receipt: { fixture: 'not-source-authentication' } }),
    async coordinate(input, callbacks) {
      await callbacks.evaluate({ ...input.baseline, scenarioId: undefined });
      await callbacks.exposure({ deckKeys: input.scenarios[0].deckKeys }); // fails; helper does not evaluate scenario1
      await callbacks.exposure({ deckKeys: input.scenarios[1].deckKeys });
      await callbacks.evaluate({ scenarioId: input.scenarios[1].id, request: input.scenarios[1].request, profile: input.scenarios[1].profile });
      return { status: 'unavailable', reason: 'synthetic-provider-refusals' };
    }, evaluateStudyScenarios() {}, fingerprint: K.ngKnowledgeFingerprint }, { manifest: {}, projector: {}, coordinator: {}, bridge: {} });
  const result = await run(job, { installation, check() {}, progress() {} });
  assert.equal(result.status, 'unavailable'); assert.equal(cleared, 1); assert.equal(result.receipts.scenarios.length, 2);
  assert.equal(result.receipts.scenarios[0].projection, outputs[0]); assert.equal(result.receipts.scenarios[0].exposure, null);
  assert.equal(result.receipts.scenarios[1].projection, outputs[1]); assert.equal(result.receipts.scenarios[1].exposure, secondExposure);
  assert.equal(result.receipts.scenarios[1].evaluation.reason, 'fixture-native-refusal');
  assert.equal(result.receipts.exposureCalls[0].result.reason, 'fixture-first-exposure');
  assert.equal(result.scenarioRequests.length, 2);
  assert.deepEqual(released, ['fixture-2']);
});
