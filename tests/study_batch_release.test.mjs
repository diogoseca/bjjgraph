import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../neural/src/',import.meta.url));
const require = createRequire(import.meta.url), M = require(root + 'mdp-identity.src.js'), math = require(root + 'mdp-model.src.js');
const moduleFrom = text => import('data:text/javascript;base64,' + Buffer.from(text).toString('base64'));
const K = await moduleFrom(readFileSync(root + 'knowledge-profile.src.js', 'utf8'));
const { ngGameplanStudyProvider } = await moduleFrom(readFileSync(root + 'gameplan-study-provider.src.js', 'utf8'));
const { ngGameplanStudyCreateBatchRunner } = await import(new URL('../neural/src/study-batch-runner.src.js', import.meta.url).href);
// Actual frozen helper call order. Only its tiny rational scalar primitives are
// injected; no native model expansion, optimizer, exposure engine or solve runs.
const sandbox = { ...M, NG_MDP_OUTCOMES: ['win', 'loss', 'explicitNoResult', 'nontermination'],
  ngMdpRat: math.ngMdpRat, ngMdpAdd: math.ngMdpAdd,
  ngMdpCmp: (a, b) => a[0] * b[1] < b[0] * a[1] ? -1 : a[0] * b[1] > b[0] * a[1] ? 1 : 0,
  ngMdpProbability: value => { const p = math.ngMdpRat(value); assert.ok(p[0] >= 0n && p[0] <= p[1]); return p; }, module: { exports: {} } };
// Evaluate in this realm: the coordinator deliberately rejects foreign object
// prototypes, so a VM realm would test a fixture boundary absent in production.
const learning = new Function(...Object.keys(sandbox), readFileSync(root + 'mdp-learning.src.js', 'utf8') + '\nreturn module.exports;')(...Object.values(sandbox));
const evaluateStudyScenarios = learning.ngMdpEvaluateStudyScenarios;

function setup({ count = 12, throwsAt = 0, unavailableAt = 0, staleAt = 0, missingRelease = false } = {}) {
  const profile = K.ngKnowledgeBuildProfile({ revision: 1, contentRevision: 'fixture-index', evidenceRevision: 'fixture-evidence', day: 21 });
  const request = { apiVersion: 2, requestId: 'fixture-baseline', revision: 1, modelHash: 'fixture-model', mechanicsHash: 'fixture-mechanics',
    graphHash: '1'.repeat(64), profileHash: profile.fingerprint, opponentPolicyHash: 'fixture-opponent', ruleset: 'gi',
    objective: M.NG_MDP_OBJECTIVE, horizon: { kind: 'actual-roll', episodeCap: 12, moveCount: 0 },
    futureStudyPolicy: profile.studyPolicy, state: { id: 'fixture-state', snapshot: { fixture: true } } };
  const starts = [{ stateId: 'fixture-state', probability: '1' }], startHash = M.ngMdpDigest(starts);
  const capture = { graphHash: request.graphHash, indexHash: '2'.repeat(64), contentRevision: profile.contentRevision,
    profileHash: profile.fingerprint, logicalContextHash: M.ngMdpContractHash(request), day: 21, ruleset: 'gi', startDistributionHash: startHash };
  const job = { baseline: { request, profile }, capture, startDistribution: starts,
    scenarios: Array.from({ length: count }, (_, i) => ({ targets: [{ deckKey: 'Guard|Top', role: 'Top', sharpTo: (i + 1) * .005 }] })) };
  const manifest = { status: 'ready', manifest: { fingerprint: 'fixture-manifest' }, provenance: { kind: 'verified-raw-study-manifest',
    graphHash: capture.graphHash, indexHash: capture.indexHash, contentRevision: capture.contentRevision, manifestHash: 'fixture-manifest' } };
  const cache = new Map(), evaluateArgs = [], released = [], created = [], rawResults = new Map(), events = [];
  let peak = 0, exposures = 0, clears = 0, cacheHits = 0, stale = false, projection = 0;
  const key = args => M.ngMdpDigest([M.ngMdpEnvelope(args.request), args.startDistributionHash,
    M.ngMdpDigest({ profile: args.profile, runtime: { residencyRevision: 1, deckReady: {} } })]);
  const baselineKey = key({ request, profile, startDistributionHash: startHash });
  const bridge = {
    async evaluate(args) {
      evaluateArgs.push(args); const id = key(args);
      if (cache.has(id)) { cacheHits++; return cache.get(id).result; }
      if (cache.size >= 8) throw new Error('study-artifact-budget');
      const scenario = args.scenarioId ? Number(args.scenarioId.split('-').at(-1)) : 0;
      const policyId = scenario ? 'fixture-policy-' + scenario : 'fixture-baseline-policy';
      const value = { status: scenario === unavailableAt && scenario ? 'unavailable' : 'ready', stamp: M.ngMdpEnvelope(args.request),
        startDistributionHash: args.startDistributionHash, policyId,
        outcomes: { win: .5, loss: .5, explicitNoResult: 0, nontermination: 0 },
        quality: { numericalStatus: 'exact-rational', coordinateErrorBound: 0, policyRegretBound: 0 },
        winBounds: [.5, .5], provenance: { kind: 'evaluated-common-policy', scope: 'start-distribution', policyId,
          contractHash: M.ngMdpContractHash(args.request), startDistributionHash: args.startDistributionHash,
          winBoundsSemantics: 'attainable-lower-optimal-upper' }, bridgeReceipt: { fixtureOnly: true, contextKey: id } };
      // Deliberately separate immutable receipt from retained private kernel.
      Object.freeze(value); cache.set(id, { result: value, privateKernel: { fixture: true } }); peak = Math.max(peak, cache.size);
      created.push(id); rawResults.set(args.scenarioId || 'baseline', value); events.push(['evaluate', args.scenarioId || 'baseline']);
      if (scenario === staleAt && scenario) stale = true;
      if (scenario === throwsAt && scenario) throw new Error('fixture-scenario-evaluation-failed');
      return value;
    },
    async exposure(args) {
      assert.ok(cache.has(baselineKey), 'baseline must survive every exposure');
      assert.equal(cache.size, 1, 'previous hypothetical kernel must be gone before next baseline exposure');
      assert.equal(key(args), baselineKey); exposures++; events.push(['exposure', exposures]);
      return { status: 'ready', stamp: M.ngMdpEnvelope(args.request), policyId: args.policyId,
        startDistributionHash: args.startDistributionHash,
        records: args.deckKeys.map(d => ({ deckKey: d.deckKey, role: d.role, status: 'ready', kind: 'hitting-probability', value: 1 })),
        provenance: { kind: 'evaluated-policy', policyId: args.policyId, contractHash: M.ngMdpContractHash(args.request),
          startDistributionHash: args.startDistributionHash, behaviorCompression: false },
        stateEquivalence: { exposureLabelsPreserved: true } };
    },
    release(args) {
      assert.ok(evaluateArgs.includes(args), 'release uses the identical full callback context object');
      assert.ok(args.scenarioId, 'baseline must never be individually released');
      assert.ok(cache.has(baselineKey), 'baseline remains retained while releasing scenarios');
      released.push(args.scenarioId); events.push(['release', args.scenarioId]); return cache.delete(key(args));
    },
    clear() { clears++; events.push(['clear', cache.size]); cache.clear(); },
  };
  if (missingRelease) delete bridge.release;
  const run = ngGameplanStudyCreateBatchRunner({ loadSources: async () => ({ verifiedManifest: manifest }), manifestProduce() { assert.fail('verified loader fixture'); },
    project(input) {
      const id = 'fixture-scenario-' + (++projection), next = structuredClone(profile); next.sharp['Guard|Top'] = input.targets[0].sharpTo;
      const body = { ...next }; delete body.fingerprint; next.fingerprint = K.ngKnowledgeFingerprint(body);
      return { status: 'ready', scenario: { id, profile: next, profileHash: next.fingerprint,
        deckKeys: [{ deckKey: 'Guard|Top', role: 'Top', headroom: .25, componentHeadroom: { permanent: .15, sharp: .1 } }],
        changes: { kind: 'hypothetical-knowledge-input', records: [{ deckKey: 'Guard|Top', role: 'Top', component: 'sharp', from: 0, to: input.targets[0].sharpTo }] } },
        provenance: { kind: 'hypothetical-knowledge-input', targetSemantics: 'declared-mechanics-input-no-earned-credit',
          baselineProfileHash: profile.fingerprint, manifestHash: 'fixture-manifest', graphHash: capture.graphHash,
          logicalContextHash: capture.logicalContextHash, ruleset: 'gi', day: 21, sharedClosure: { status: 'validated', deckKeys: [] } } };
    }, prepareBridge: async () => ({ status: 'ready', bridge, receipt: { fixtureOnly: true } }),
    coordinate: ngGameplanStudyProvider, evaluateStudyScenarios, fingerprint: K.ngKnowledgeFingerprint }, {
    manifest: {}, projector: {}, bridge: {}, coordinator: { maxScenarios: 32, maxDecksPerScenario: 8, maxProfileKeys: 64 } });
  return { execute: () => run(job, { installation: { graphHash: capture.graphHash, indexHash: capture.indexHash },
    check() { if (stale) throw new Error('fixture-stale-after-value'); }, progress() {} }),
    cache, released, created, rawResults, events,
    state: () => ({ peak, exposures, clears, cacheHits, evaluations: evaluateArgs.length }) };
}

test('12 sequential hypotheses with a hard 8-artifact cache retain only baseline plus current kernel', async () => {
  const f = setup(), result = await f.execute();
  assert.equal(result.status, 'ready'); assert.equal(result.coordinator.coverage.readyScenarios, 12);
  assert.deepEqual(f.state(), { peak: 2, exposures: 12, clears: 1, cacheHits: 1, evaluations: 14 });
  assert.equal(f.created.length, 13); assert.equal(f.released.length, 12); assert.equal(f.cache.size, 0);
  for (const row of result.receipts.scenarios) assert.equal(row.evaluation, f.rawResults.get(row.id));
  assert.equal(result.receipts.baseline, f.rawResults.get('baseline'));
  assert.deepEqual(f.events.at(-1), ['clear', 1]);
});
test('a scenario that throws after retaining an artifact still releases it and later hypotheses continue', async () => {
  const f = setup({ throwsAt: 5 }), result = await f.execute();
  assert.equal(result.status, 'partial'); assert.equal(result.coordinator.coverage.readyScenarios, 11);
  assert.equal(f.released.length, 12); assert.equal(f.state().peak, 2); assert.equal(f.state().exposures, 12);
  assert.equal(result.receipts.scenarios[4].evaluation, null); assert.ok(result.receipts.scenarios[4].exposure);
  assert.match(result.coordinator.scenarios[4].reason, /fixture-scenario-evaluation-failed/);
});
test('unavailable scenario result is captured and released without dropping the remaining scope', async () => {
  const f = setup({ unavailableAt: 4 }), result = await f.execute();
  assert.equal(result.status, 'partial'); assert.equal(result.coordinator.coverage.readyScenarios, 11);
  assert.equal(result.receipts.scenarios[3].evaluation, f.rawResults.get('fixture-scenario-4'));
  assert.equal(f.state().peak, 2); assert.equal(f.released.length, 12);
});
test('freshness failure after a value arrives preserves its raw receipt and releases before final clear', async () => {
  const f = setup({ staleAt: 1 }), result = await f.execute();
  assert.equal(result.status, 'unavailable'); assert.equal(result.reason, 'fixture-stale-after-value');
  assert.equal(result.receipts.scenarios[0].evaluation, f.rawResults.get('fixture-scenario-1'));
  assert.deepEqual(f.released, ['fixture-scenario-1']); assert.deepEqual(f.events.slice(-2), [['release', 'fixture-scenario-1'], ['clear', 1]]);
});
test('bridge without selective release is refused before any kernel evaluation', async () => {
  const f = setup({ missingRelease: true }), result = await f.execute();
  assert.equal(result.reason, 'invalid-study-bridge'); assert.equal(f.created.length, 0); assert.equal(f.state().clears, 1);
});
