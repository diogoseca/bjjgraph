// Host lifecycle tests with actual frozen scheduler/projector/coordinator/
// presenter and explicitly synthetic native receipts. No worker solver, real
// starts, metadata corpus, performance, browser or publication claim.
// A worker checkout may set BJJ_STUDY_SOURCE_ROOT to the imported candidate's
// neural/src directory. CI/integration defaults to its own source directory.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { ngGameplanStudyCreateHost, ngGameplanStudyLiveBusy } from "../neural/src/gameplan-study-host.src.js";

const source = process.env.BJJ_STUDY_SOURCE_ROOT ? pathToFileURL(resolve(process.env.BJJ_STUDY_SOURCE_ROOT) + "/") : new URL("../neural/src/", import.meta.url);
const load = file => import(new URL(file, source));
const S = await load("study-scheduler.src.js"), K = await load("knowledge-profile.src.js"), P = await load("knowledge-scenarios.src.js");
const { ngGameplanStudyProvider: coordinate } = await load("gameplan-study-provider.src.js");
const { ngGameplanStudyPresent } = await load("gameplan-study-presenter.src.js");
const M = createRequire(import.meta.url)(fileURLToPath(new URL("mdp-identity.src.js", source)));
const clone = x => structuredClone(x), keys = ["Move|Attacker", "Move|Defender"];
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
function clock() {
  let at = 0, serial = 0; const timers = new Map();
  return { now: () => at, setTimer(fn, delay) { const id = ++serial; timers.set(id, { fn, at: at + delay }); return id; },
    clearTimer(id) { timers.delete(id); }, advance(ms) { at += ms; for (const [id, t] of [...timers]) if (t.at <= at) { timers.delete(id); t.fn(); } }, timers };
}
class Worker {
  listeners = new Map(); messages = []; terminations = 0;
  postMessage(m) { this.messages.push(m); }
  addEventListener(k, fn) { this.listeners.set(k, fn); }
  removeEventListener(k, fn) { if (this.listeners.get(k) === fn) this.listeners.delete(k); }
  terminate() { this.terminations++; }
  reply(part) { const m = this.messages[0]; this.listeners.get("message")?.({ data: { protocol: m.protocol, jobId: m.jobId, key: m.key, ...part } }); }
}
const limits = { maxRequestNodes: 100000, maxRequestBytes: 2000000, maxResultNodes: 200000, maxResultBytes: 4000000,
  maxDepth: 48, maxStarts: 8, maxScenarios: 4, maxTargets: 8, maxQueueMilliseconds: 1000, maxRunMilliseconds: 5000 };
function fixture(overrides = {}) {
  const time = clock(), states = [], workers = [], installed = [], errors = [], counts = { starts: 0, targets: 0, admission: 0, releases: 0, liveCalls: 0 };
  const graphHash = "1".repeat(64), indexHash = "2".repeat(64);
  // The producer's canonical decoded index (wire-keys `ngWireDeckIndex`), as the projector receives it.
  const index = { decks: Object.fromEntries(keys.map(k => [k, { cat: "Transition", n: 2 }])), shared: { "abcd1234": [0, 1] } };
  let profile = K.ngKnowledgeBuildProfile({ prep: {}, sharp: {}, revision: 2, contentRevision: K.ngKnowledgeFingerprint(index), evidenceRevision: "evidence-fixture", day: 100 });
  const runtime = { ...S, ngGameplanStudyPresent, NG_GAMEPLAN_STUDY_BUILD: { version: "fixture", sources: { graphHash, indexHash, lawHashes: { knowledge: "3".repeat(64) } },
    computation: { study: { scheduler: { ...limits } } } } };
  const app = { _progressLoaded: true, _progressOwnerStamp: {}, _progressCurrent: () => true, _checkKnowledgeDay() {},
    _epochDay: () => profile.day, _giMode: "gi", _gameValueResidencyRevision: 1, _gameValueGraph: { status: "verified", hash: graphHash },
    flashcards: { decks: Object.fromEntries(keys.map(k => [k, [{ q: "HOST ONLY private question" }]])) },
    _deckHasCards(key) { return Array.isArray(this.flashcards.decks[key]); }, knowledgeProfile: () => profile,
    _gameplanStamp() { return JSON.stringify([profile.fingerprint, this._giMode, this.goal || 30]); },
    _gameplanDecks: () => Object.fromEntries(keys.map((k, i) => [k, { allowed: true, count: 2, headroom: .15 - (profile.permanent[k] || 0), exact: true, questions: ["shared", "hash" + i] }])),
    setGameplanRecommendations(p) { if (p.stamp !== this._gameplanStamp()) return false; this._gameplanProvider = p; installed.push(p); return true; },
    _session: { keys: ["due", "saved-new"], idx: 1, plan: { fixed: "original order" }, review: { day: 100, questions: ["due"] } },
    _choiceValueSource: { evaluate() { counts.liveCalls++; }, cancel() { counts.liveCalls++; }, destroy() { counts.liveCalls++; } },
  };
  let startKey = "real-start-law-key-fixture", targetKey = "declared-target-key-fixture";
  const deps = { runtime, identity: M, fingerprint: K.ngKnowledgeFingerprint, ...time,
    presenterBounds: { maxScenarios: 4, maxDecks: 16, maxEvidenceNodes: 100000, maxStringLength: 10000 },
    readInputIdentity: () => ({ status: "ready", startKey, targetKey }),
    produceStarts: ({ profile, requestId, revision }) => {
      counts.starts++;
      const snapshot = { nodeId: "toy-position", role: "top", phase: "user", moveCount: 8, arrivalAge: 0, qMod: 0, combo: 0, positionKey: null, panicKey: null };
      const stateId = M.ngMdpStateId(snapshot);
      return { status: "ready", identity: startKey, provenance: { kind: "explicit-start-law-fixture" },
        request: { apiVersion: 2, requestId, revision, modelHash: "model-fixture", mechanicsHash: "mechanics-fixture", graphHash,
          profileHash: profile.fingerprint, opponentPolicyHash: "opponent-fixture", ruleset: app._giMode, objective: M.NG_MDP_OBJECTIVE,
          horizon: { kind: "actual-roll", episodeCap: 9, moveCount: 8 }, futureStudyPolicy: profile.studyPolicy,
          state: { id: stateId, snapshot, aiSkill: .07, challenge: null } },
        startDistribution: [{ stateId, probability: "1" }], startSnapshots: [{ stateId, snapshot }] };
    },
    produceTargets: () => { counts.targets++; return { status: "ready", identity: targetKey, provenance: { kind: "declared-hypothesis-fixture" },
      scenarios: [{ targets: keys.map(deckKey => ({ deckKey, role: deckKey.split("|")[1], permanentTo: .03 })) }] }; },
    admit: () => { counts.admission++; return { status: "admitted", id: "study-lease:" + counts.admission, expiresAt: time.now() + 5000, release() { counts.releases++; } }; },
    createWorker: () => { const w = new Worker(); workers.push(w); return w; },
    onState: s => states.push(s), reportError: e => errors.push(e), ...overrides };
  const host = ngGameplanStudyCreateHost(app, deps); app._gameStudyHost = host;
  return { host, deps, app, time, counts, states, workers, installed, errors, index,
    changeProfile(extra) { const p = { ...profile, ...extra }; delete p.fingerprint; profile = { ...p, fingerprint: K.ngKnowledgeFingerprint(p) }; },
    changeStart() { startKey += ":changed"; }, changeTargets() { targetKey += ":changed"; } };
}

// Controlled fixed-policy/value callbacks, fed through the real projector and
// real conservative coordinator. Exact native provenance here is a contract
// double; production root authenticates it inside the isolated worker.
async function readyPayload(h, worker, options = {}) {
  const wire = worker.messages[0], job = wire.job, c = job.capture;
  const manifest = { version: 1, status: "ready", deckIndex: h.index, identity: { graphHash: c.graphHash, contentRevision: c.contentRevision,
    decks: Object.fromEntries(keys.map(k => [k, { role: k.split("|")[1], category: "Transition", rulesets: { gi: true, nogi: true } }])) } };
  manifest.fingerprint = P.ngKnowledgeScenarioManifestHash(manifest);
  const projections = job.scenarios.map(s => P.ngKnowledgeScenarioProject({ baselineProfile: job.baseline.profile, logicalContextHash: c.logicalContextHash,
    day: c.day, ruleset: c.ruleset, manifest, targets: s.targets, bounds: { maxTargets: 8, maxDecks: 16, maxSharedGroups: 4, maxSharedMemberships: 8 } }));
  for (const p of projections) assert.equal(p.status, "ready", p.reason);
  const scenarios = projections.map(p => {
    const request = { ...job.baseline.request, requestId: job.baseline.request.requestId + ":scenario:" + p.scenario.id, profileHash: p.scenario.profileHash };
    delete request.contractHash;
    return { ...p.scenario, request };
  });
  const receipts = projections.map(p => ({ id: p.scenario.id, projection: p, evaluation: null, exposure: null }));
  let baseline;
  const evaluate = async args => {
    const stamp = M.ngMdpEnvelope(args.request), policyId = args.scenarioId || "toy-baseline-policy", win = args.scenarioId ? (options.win ?? .7) : .5;
    const quality = { numericalStatus: "certified", coordinateErrorBound: .01, policyRegretBound: .01, secondaryStatus: "unresolved-primary-ties" };
    const outcomes = { win, loss: 1 - win, explicitNoResult: 0, nontermination: 0 };
    const v = { status: "ready", stamp, policyId, startDistributionHash: c.startDistributionHash, outcomes, quality, winBounds: [win - .01, win + .01],
      outcomeBounds: Object.fromEntries(Object.entries(outcomes).map(([k, n]) => [k, [Math.max(0, n - .01), Math.min(1, n + .01)]])),
      provenance: { kind: "evaluated-common-policy", scope: "start-distribution", policyId, startDistributionHash: c.startDistributionHash,
        contractHash: stamp.contractHash, winBoundsSemantics: "attainable-lower-optimal-upper" },
      bridgeReceipt: { version: 1, kind: "logical-native-study-bridge", logicalStamp: stamp,
        nativeStamp: { ...stamp, requestId: "native:" + stamp.requestId, contractHash: "native:" + stamp.contractHash },
        logicalStartDistributionHash: c.startDistributionHash, nativeStartDistributionHash: "native:" + c.startDistributionHash,
        profileHash: stamp.profileHash, policyId, behaviorCompression: false, nativeValueQuality: quality, independentQuality: { numericalStatus: "exact-rational" },
        admission: { metadataHash: "toy-decoded-metadata", lawHashes: { toy: "3".repeat(64) } }, mappingHash: "toy-mapping", snapshotId: "toy:" + stamp.profileHash,
        snapshotHash: "toy:" + stamp.profileHash, runtimeHash: c.residencyHash, supportHash: "toy:" + stamp.profileHash, fixedPolicyId: "toy-fixed:" + policyId, hash: "toy:" + policyId } };
    if (args.scenarioId) receipts.find(r => r.id === args.scenarioId).evaluation = v; else baseline = v;
    return v;
  };
  const exposure = async args => {
    const b = baseline.bridgeReceipt, native = { kind: "evaluated-policy", policyId: baseline.policyId, startDistributionHash: b.nativeStartDistributionHash,
      contractHash: b.nativeStamp.contractHash, behaviorCompression: false, exposureConvention: "chosen-execution-escape-input-reads-v1",
      supportHash: b.supportHash, kernelHash: "toy-kernel", policyHash: "toy-policy", labelAdmission: { kind: "admitted-native-label-replay",
        sourceSupportHash: b.supportHash, queryHash: "toy-labels", ...b.admission } };
    return { status: "ready", stamp: baseline.stamp, policyId: baseline.policyId, startDistributionHash: c.startDistributionHash,
      records: args.deckKeys.map(d => ({ deckKey: d.deckKey, role: d.role, status: "ready", kind: "hitting-probability", value: .5, exactZero: false, roundedToZero: false })),
      provenance: { ...native, startDistributionHash: c.startDistributionHash, contractHash: baseline.stamp.contractHash },
      bridgeReceipt: { ...b, nativeExposureProvenance: native, nativeExposureStamp: b.nativeStamp } };
  };
  const coordinator = await coordinate({ baseline: job.baseline, startDistribution: job.startDistribution, exposurePolicyId: "toy-baseline-policy", scenarios,
    bounds: { maxScenarios: 4, maxDecksPerScenario: 16, maxProfileKeys: 16 } }, {
    fingerprint: K.ngKnowledgeFingerprint, isCurrent: () => true, evaluate, exposure,
    evaluateStudyScenarios: async (input, cb) => {
      const common = { startDistribution: job.startDistribution, startDistributionHash: c.startDistributionHash, policySemantics: "reoptimized" };
      const base = await cb.evaluate({ ...common, request: job.baseline.request }), rows = [];
      for (const s of input.scenarios) {
        const e = await cb.exposure({ ...common, request: job.baseline.request, policyId: base.policyId, deckKeys: s.deckKeys });
        receipts.find(r => r.id === s.id).exposure = e;
        const v = await cb.evaluate({ ...common, request: s.request, scenarioId: s.id, changes: s.changes });
        rows.push({ id: s.id, profileHash: s.profileHash, deckKeys: s.deckKeys, status: "ready", stamp: v.stamp,
          outcomes: v.outcomes, exposure: e.records, baselinePolicyId: base.policyId, scenarioPolicyId: v.policyId });
      }
      return { apiVersion: 1, status: "ready", stamp: base.stamp, baseline: base, ...common, exposurePolicyId: base.policyId, scenarios: rows,
        coverage: { requestedScenarios: rows.length, readyScenarios: rows.length }, unresolvedReasons: [] };
    },
  });
  assert.equal(coordinator.status, "ready");
  return clone({ status: coordinator.status, coordinator, scenarioRequests: scenarios.map(s => ({ id: s.id, request: s.request })), receipts: {
    manifest: { kind: "verified-raw-study-manifest", graphHash: c.graphHash, indexHash: c.indexHash, contentRevision: c.contentRevision, manifestHash: manifest.fingerprint },
    startAdmission: { kind: "verified-study-engine-admission", installationId: c.installationId, demandHash: wire.key,
      startDistributionHash: c.startDistributionHash, startMappingHash: c.startMappingHash, declaredStarts: job.startDistribution.length, behaviorCompression: false },
    baseline, scenarios: receipts } });
}

test("construction, stats notifications and invalid intents perform no producer, worker or admission work", async () => {
  const h = fixture(); assert.equal(h.host.snapshot().phase, "idle");
  h.host.reconcile("stats"); await h.host.request("boot"); h.host.reconcile("grade");
  assert.deepEqual(h.counts, { starts: 0, targets: 0, admission: 0, releases: 0, liveCalls: 0 }); assert.equal(h.workers.length, 0);
  assert.equal(h.installed.length, 0); h.host.destroy();
});

test("missing authoritative starts or targets stays unavailable without manufactured requests", async () => {
  for (const change of [d => { delete d.produceStarts; }, d => { delete d.produceTargets; },
    d => { d.readInputIdentity = () => ({ status: "unavailable", reason: "missing-declared-start-law" }); },
    d => { d.produceTargets = () => ({ status: "unavailable", reason: "no-declared-hypothesis" }); }]) {
    const h = fixture(); change(h.deps);
    const s = await h.host.request("open-plan"); assert.equal(s.phase, "unavailable"); assert.equal(h.workers.length, 0);
    assert.equal(h.installed.at(-1).status, "unavailable"); assert.deepEqual(h.installed.at(-1).rows, []); h.host.destroy();
  }
});

test("actual projector/coordinator/presenter result installs conservative rows and full groups without changing session order", async () => {
  const h = fixture(), session = clone(h.app._session), promise = h.host.request("open-plan"); await flush();
  assert.equal(h.workers.length, 1); const w = h.workers[0], wire = w.messages[0];
  assert.doesNotMatch(JSON.stringify(wire), /HOST ONLY|private question/); assert.match(wire.job.capture.ownerEpoch, /^study-owner:/);
  assert.equal(h.host.snapshot().phase, "pending"); w.reply({ type: "progress", stage: "baseline" });
  w.reply({ type: "result", result: await readyPayload(h, w) }); const state = await promise;
  assert.equal(state.phase, "ready", JSON.stringify(state)); assert.equal(state.provider.rows.length, 2);
  assert.equal(state.provider.study.groups.length, 1); assert.equal(state.provider.study.secondaryUnresolved, true);
  assert.ok(state.provider.rows.every(r => r.score > 0 && r.score < .2));
  assert.deepEqual(h.app._session, session); assert.equal(h.counts.liveCalls, 0); assert.equal(h.counts.releases, 1); assert.equal(w.terminations, 1);
  const before = h.workers.length; const saved = await h.host.request("refresh-plan"); assert.equal(h.workers.length, before);
  assert.deepEqual(saved.sourceProvenance, state.sourceProvenance); assert.deepEqual(saved.capture, state.capture);
  assert.equal(h.app._gameplanProvider, state.provider); h.host.destroy();
});

test("positive point noise is partial with complete joint uncertainty, never zero or a positive suggestion", async () => {
  const h = fixture(), p = h.host.request("suggestions"); await flush(); const w = h.workers[0];
  w.reply({ type: "result", result: await readyPayload(h, w, { win: .505 }) }); const s = await p;
  assert.equal(s.phase, "partial"); assert.equal(s.provider.study.groups[0].status, "uncertain");
  assert.ok(s.provider.rows.every(r => !("score" in r))); h.host.destroy();
});

test("unchanged requests coalesce while explicit retry starts fresh owned work", async () => {
  const h = fixture(), a = h.host.request("open-plan"), b = h.host.request("open-plan"); assert.equal(a, b); await flush();
  const w = h.workers[0]; w.reply({ type: "result", result: { status: "unavailable", reason: "coverage-missing", coordinator: null, receipts: {} } });
  assert.equal((await a).phase, "unavailable"); const retry = h.host.request("retry"); await flush(); assert.equal(h.workers.length, 2);
  h.host.invalidate("test-end"); await retry; h.host.destroy();
});

test("owner day profile evidence ruleset content residency starts targets graph and installation invalidate owned work", async () => {
  const changes = [h => { h.app._progressOwnerStamp = {}; }, h => h.changeProfile({ day: 101 }), h => h.changeProfile({ revision: 3 }),
    h => h.changeProfile({ evidenceRevision: "changed-evidence" }), h => h.changeProfile({ contentRevision: "changed-index" }),
    h => { h.app._giMode = "nogi"; }, h => { h.app._gameValueResidencyRevision++; },
    h => { h.app.flashcards.decks[keys[0]] = {}; }, h => h.changeStart(), h => h.changeTargets(),
    h => { h.app._gameValueGraph.hash = "other-graph"; }, h => { h.deps.runtime.NG_GAMEPLAN_STUDY_BUILD.version = "changed"; },
    h => { h.app.goal = 50; }];
  for (const change of changes) {
    const h = fixture(), p = h.host.request("open-plan"); await flush(); change(h); h.host.reconcile("changed");
    assert.equal(h.host.snapshot().phase, "unavailable");
    assert.equal((await p).phase, "unavailable"); assert.equal(h.workers[0].terminations, 1); assert.equal(h.counts.releases, 1);
    assert.equal(h.app._gameplanProvider.status, "unavailable"); h.host.destroy();
  }
});

test("freshness is reread on replies even without a host notification", async () => {
  const h = fixture(), p = h.host.request("open-plan"); await flush(); const w = h.workers[0], result = await readyPayload(h, w);
  h.changeStart(); w.reply({ type: "result", result }); assert.equal((await p).phase, "unavailable");
  assert.equal(h.app._gameplanProvider.status, "unavailable"); h.host.destroy();
});

test("late producer output cannot publish across owner changes and producer capture runs only once", async () => {
  const gate = deferred(), h = fixture(), original = h.deps.produceStarts;
  h.deps.produceStarts = (...args) => { const v = original(...args); return gate.promise.then(() => v); };
  const p = h.host.request("open-plan"); h.host.reconcile("resume"); h.host.reconcile("resume"); assert.equal(h.counts.starts, 1);
  h.app._progressOwnerStamp = {}; h.host.reconcile("owner"); gate.resolve(); assert.equal((await p).phase, "unavailable"); await flush();
  assert.equal(h.counts.targets, 0); assert.equal(h.workers.length, 0); h.host.destroy();
});

test("live priority queues explicit study and later resumes it without touching the live provider", async () => {
  const h = fixture(); h.app._gameValueState = "loading"; const p = h.host.request("open-plan"); await flush();
  assert.equal(h.host.snapshot().phase, "queued"); assert.equal(h.host.snapshot().dependency, "live-choice");
  assert.equal(h.counts.starts, 0); assert.equal(h.workers.length, 0);
  h.app._gameValueState = "prepared"; h.host.reconcile("live-settled"); await flush(); assert.equal(h.workers.length, 1);
  h.host.invalidate("done"); await p; assert.equal(h.counts.liveCalls, 0); h.host.destroy();
});

test("new live work terminates only the study worker and late study replies cannot install", async () => {
  const h = fixture(), p = h.host.request("open-plan"); await flush(); const old = h.workers[0], stale = old.listeners.get("message"), wire = old.messages[0];
  h.app._choiceValues = { snapshot: () => ({ status: "pending" }) }; h.host.reconcile("live-started");
  assert.equal(old.terminations, 1); assert.equal(h.counts.releases, 1); assert.equal(h.host.snapshot().phase, "queued");
  stale({ data: { protocol: wire.protocol, jobId: wire.jobId, key: wire.key, type: "result", result: await readyPayload(h, old) } }); await flush();
  assert.equal(h.host.snapshot().phase, "queued"); assert.equal(h.app._gameplanProvider.status, "pending");
  h.app._choiceValues = { snapshot: () => ({ status: "ready" }) }; h.host.reconcile("live-settled"); await flush();
  assert.equal(h.workers.length, 2); const w = h.workers[1]; w.reply({ type: "result", result: await readyPayload(h, w) });
  assert.equal((await p).phase, "ready"); assert.equal(h.counts.liveCalls, 0); h.host.destroy();
});

test("root deferral remains queued until notified and live work during admission releases the study lease", async () => {
  const h = fixture(), original = h.deps.admit; let allow = false;
  h.deps.admit = (...args) => allow ? original(...args) : { status: "deferred", dependency: "memory-admission" };
  const p = h.host.request("open-plan"); await flush(); assert.equal(h.host.snapshot().dependency, "memory-admission"); assert.equal(h.workers.length, 0);
  allow = true; h.host.reconcile("admission-available"); await flush(); assert.equal(h.workers.length, 1); h.host.invalidate("done"); await p; h.host.destroy();
  const gate = deferred(), second = fixture(); second.deps.admit = () => gate.promise;
  const wait = second.host.request("open-plan"); await flush(); second.app._choiceValueQueued = {};
  gate.resolve({ status: "admitted", id: "late-study", expiresAt: 4000, release() { second.counts.releases++; } }); await flush();
  assert.equal(second.counts.releases, 1); assert.equal(second.workers.length, 0); assert.equal(second.host.snapshot().phase, "queued");
  second.host.invalidate("done"); await wait; second.host.destroy();
});

test("capture/queue deadline and worker deadline end only owned work without indefinite loading", async () => {
  const gate = deferred(), h = fixture({ produceStarts: () => gate.promise }), p = h.host.request("open-plan");
  h.time.advance(1000); assert.equal((await p).reason, "study-host-queue-deadline"); assert.equal(h.workers.length, 0); h.host.destroy();
  const run = fixture(), work = run.host.request("open-plan"); await flush(); run.time.advance(5000);
  assert.equal((await work).phase, "unavailable"); assert.equal(run.workers[0].terminations, 1); assert.equal(run.time.timers.size, 0); run.host.destroy();
});

test("worker and unexpected producer failures are errors, missing evaluated coverage stays unavailable", async () => {
  const h = fixture(), p = h.host.request("open-plan"); await flush(); h.workers[0].listeners.get("error")();
  assert.equal((await p).phase, "error"); h.host.destroy();
  const bad = fixture({ produceStarts() { throw Error("unexpected bug"); } }); assert.equal((await bad.host.request("retry")).phase, "error"); bad.host.destroy();
});

test("full transport, source, manifest and scenario request binding is required before presentation", async () => {
  for (const mutate of [r => { r.receipts.startAdmission.demandHash = "wrong-job"; }, r => { r.receipts.manifest.indexHash = "other-index"; },
    r => { r.scenarioRequests[0].request.horizon.moveCount = 0; }, r => { r.receipts.scenarios.pop(); },
    r => { r.receipts.scenarios[0].evaluation = null; }]) {
    const h = fixture(), p = h.host.request("open-plan"); await flush(); const w = h.workers[0], result = await readyPayload(h, w); mutate(result);
    w.reply({ type: "result", result }); const s = await p;
    assert.ok(["error", "unavailable"].includes(s.phase)); assert.ok(!(h.app._gameplanProvider.rows || []).some(r => r.score > 0)); h.host.destroy();
  }
});

test("observer failures and destroy cannot leak a worker, lease, timer or stale publication", async () => {
  const h = fixture({ onState() { throw Error("observer"); } }), p = h.host.request("open-plan"); await flush(); const before = h.installed.length;
  h.host.destroy(); assert.equal((await p).phase, "destroyed"); h.host.destroy(); await flush();
  assert.equal(h.workers[0].terminations, 1); assert.equal(h.counts.releases, 1); assert.equal(h.time.timers.size, 0); assert.equal(h.installed.length, before + 1);
  assert.equal(h.app._gameplanProvider.status, "unavailable", "retiring this owner clears only its own recommendation synchronously");
  assert.ok(h.errors.length > 0); await h.host.request("retry"); assert.equal(h.workers.length, 1);
});

test("a foreign recommendation or replacement host cannot be overwritten by an old result", async () => {
  for (const replacement of [h => { h.app._gameplanProvider = { status: "external-owner" }; }, h => { h.app._gameStudyHost = {}; }]) {
    const h = fixture(), p = h.host.request("open-plan"); await flush(); const w = h.workers[0], result = await readyPayload(h, w); replacement(h);
    w.reply({ type: "result", result }); assert.equal((await p).phase, "unavailable");
    assert.notEqual(h.app._gameplanProvider.status, "ready"); h.host.destroy();
  }
});

test("live activity checks are read-only and include scheduled, queued and pending work", () => {
  for (const app of [{ _gameValueState: "scheduled" }, { _gameValueState: "preparing" }, { _gameValueLoading: {} }, { _choiceValueQueued: {} },
    { _choiceValues: { snapshot: () => ({ status: "pending" }) } }]) assert.equal(ngGameplanStudyLiveBusy(app), true);
  assert.equal(ngGameplanStudyLiveBusy({ _gameValueState: "prepared" }), false);
});
