// Tiny adapter contracts, NOT a production study provider, projector proof,
// solver, exposure calculation, transport, browser or efficacy test. The actual
// frozen coordinator computes conservative benefit rows from controlled callback
// receipts. Projector/native certificates here are explicit contract doubles;
// root authenticates real sources. Semantic mutants are recorded in the receipt.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { ngGameplanStudyProvider } from "../neural/src/gameplan-study-provider.src.js";
import { ngGameplanStudyPresent as present, NG_GAMEPLAN_STUDY_PRESENTER_VERSION } from "../neural/src/gameplan-study-presenter.src.js";
import { ngGameplanRecommendations, ngGameplanBuild, ngGameplanBind, ngGameplanProgress } from "../neural/src/gameplan.src.js";

const clone = v => JSON.parse(JSON.stringify(v));
const canonical = v => Array.isArray(v) ? v.map(canonical) : v && typeof v === "object"
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])])) : v;
const hash = v => createHash("sha256").update(JSON.stringify(canonical(v))).digest("hex");
const roleOf = key => key.split("|")[1];
const keys = ["Move|Attacker", "Move|Defender"];
const profile = (permanent, sharp) => {
  const p = { version: 1, revision: 7, contentRevision: "toy-index", evidenceRevision: "toy-evidence", day: 100,
    studyPolicy: "no-additional-study-events", permanent, sharp, userMods: [], filmLook: {}, flowCounts: {}, status: "ready", diagnostics: [] };
  return { ...p, fingerprint: hash(p) };
};
const envelope = request => { const { state, ...rest } = request; return { ...rest, contractHash: hash(request) }; };
const defaultScenarios = () => [{ id: "joint", targets: keys.map(deckKey => ({ deckKey, permanentTo: .03 })), win: .65, winBounds: [.64, .66] }];

async function fixture(options = {}) {
  const specs = options.scenarios || defaultScenarios(), baseSpec = options.baseline || { win: .5, winBounds: [.49, .51] };
  const allKeys = [...new Set(specs.flatMap(s => s.targets.map(t => t.deckKey)))];
  const permanent = Object.fromEntries(allKeys.map(k => [k, options.permanent?.[k] || 0]));
  const sharp = Object.fromEntries(allKeys.map(k => [k, options.sharp?.[k] || 0]));
  const baseline = profile(permanent, sharp), ruleset = options.ruleset || "nogi";
  const request = (p, requestId) => ({ apiVersion: 2, requestId, revision: 7, modelHash: "toy-model", mechanicsHash: "toy-mechanics",
    graphHash: "toy-graph", profileHash: p.fingerprint, opponentPolicyHash: "toy-opponent", ruleset,
    objective: "max-win/min-loss/min-nontermination", futureStudyPolicy: p.studyPolicy,
    horizon: options.horizon || { kind: "actual-roll", moveCount: 2, episodeCap: 10 }, state: { id: "guard/bottom", role: "Bottom", combo: 0, qMod: 0 } });
  const projections = specs.map(spec => {
    const after = profile({ ...permanent }, { ...sharp }), records = [], deckKeys = [];
    for (const t of spec.targets) {
      const key = t.deckKey, role = roleOf(key), componentHeadroom = { permanent: .15 - permanent[key], sharp: .1 - sharp[key] };
      let jointDelta = 0;
      for (const component of ["permanent", "sharp"]) {
        const from = baseline[component][key], to = t[component + "To"] ?? from;
        if (to !== from) { records.push({ deckKey: key, role, component, from, to }); after[component][key] = to; jointDelta += to - from; }
      }
      if (jointDelta > 0) deckKeys.push({ deckKey: key, role, available: options.available?.[key] ?? true,
        headroom: componentHeadroom.permanent + componentHeadroom.sharp, componentHeadroom, jointDelta,
        headroomSemantics: "joint-permanent-plus-sharp-input-capacity" });
    }
    delete after.fingerprint; after.fingerprint = hash(after);
    return { apiVersion: 1, status: "ready", scenario: { id: spec.id, profile: after, profileHash: after.fingerprint, deckKeys,
      changes: { kind: "hypothetical-knowledge-input", records } }, provenance: {
      kind: "hypothetical-knowledge-input", targetSemantics: "declared-mechanics-input-no-earned-credit", knowledgeVersion: 1,
      baselineProfileHash: baseline.fingerprint, manifestHash: "toy-manifest", graphHash: "toy-graph", logicalContextHash: "toy-logical",
      ruleset, day: 100, caps: { permanent: .15, sharp: .1 }, sharedClosure: { status: "validated", scope: "transitive-permanent-deck-closure",
        deckKeys: spec.targets.filter(t => t.permanentTo != null).map(t => ({ deckKey: t.deckKey, role: roleOf(t.deckKey) })) } } };
  });
  const job = { baseline: { profile: baseline, request: request(baseline, "baseline") },
    startDistribution: [{ stateId: "guard/bottom", probability: "1/2" }, { stateId: "mount/top", probability: "1/2" }],
    exposurePolicyId: "toy-baseline-policy", bounds: { maxScenarios: 8, maxDecksPerScenario: 16, maxProfileKeys: 64 },
    scenarios: projections.map(p => ({ ...p.scenario, request: request(p.scenario.profile, p.scenario.id) })) };
  const receipts = [], evaluations = new Map(), startHash = hash(job.startDistribution), calls = { value: 0, exposure: 0 };
  const deps = {
    fingerprint: hash, isCurrent: () => true,
    evaluate: async args => {
      calls.value++;
      const spec = args.scenarioId ? specs.find(s => s.id === args.scenarioId) : baseSpec;
      const s = envelope(args.request), policyId = args.scenarioId ? "toy-policy:" + args.scenarioId : job.exposurePolicyId;
      const error = spec.error ?? .01;
      const quality = { numericalStatus: error ? "certified" : "exact-rational", coordinateErrorBound: error,
        policyRegretBound: spec.regret ?? .02, secondaryStatus: "unresolved-primary-ties", tertiaryStatus: "unresolved-primary-loss-ties",
        unresolvedReasons: ["toy-secondary-not-certified"] };
      const outcomes = { win: spec.win, loss: 1 - spec.win, explicitNoResult: 0, nontermination: 0 };
      const value = { status: "ready", stamp: s, policyId, startDistributionHash: args.startDistributionHash, outcomes,
        outcomeBounds: Object.fromEntries(Object.entries(outcomes).map(([k, n]) => [k, [Math.max(0, n - error), Math.min(1, n + error)]])),
        winBounds: spec.winBounds, quality, provenance: { kind: "evaluated-common-policy", scope: "start-distribution", policyId,
          contractHash: s.contractHash, startDistributionHash: args.startDistributionHash, winBoundsSemantics: "attainable-lower-optimal-upper" },
        bridgeReceipt: { version: 1, kind: "logical-native-study-bridge", logicalStamp: s,
          nativeStamp: { ...s, requestId: "native:" + s.requestId, contractHash: "native-contract:" + s.contractHash },
          nativeValueQuality: quality, nativeValueDiagnostics: { algorithm: "toy-certificate-double", certificate: { toy: true } },
          independentQuality: { numericalStatus: "exact-rational", policySemantics: "fixed", coordinateErrorBound: 0 },
          logicalStartDistributionHash: args.startDistributionHash, nativeStartDistributionHash: "native:" + args.startDistributionHash,
          mappingHash: "toy-mapping", snapshotId: "toy-snapshot:" + s.profileHash, snapshotHash: "toy-snapshot:" + s.profileHash,
          profileHash: s.profileHash, runtimeHash: "toy-runtime", admission: { metadataHash: "toy-metadata", lawHashes: { adapter: "toy-a", knowledge: "toy-k" } },
          supportHash: "toy-support:" + s.profileHash, policyId, fixedPolicyId: "toy-fixed:" + policyId, behaviorCompression: false,
          hash: "toy-bridge-receipt:" + policyId } };
      evaluations.set(args.scenarioId || "baseline", value);
      return value;
    },
    exposure: async args => {
      calls.exposure++;
      const base = evaluations.get("baseline"), b = base.bridgeReceipt, s = base.stamp;
      const native = { kind: "evaluated-policy", policyId: base.policyId, contractHash: b.nativeStamp.contractHash,
        startDistributionHash: b.nativeStartDistributionHash, behaviorCompression: false,
        exposureConvention: "chosen-execution-escape-input-reads-v1", supportHash: b.supportHash,
        kernelHash: "toy-labelled-kernel", policyHash: "toy-labelled-policy", labelAdmission: { kind: "admitted-native-label-replay",
          sourceSupportHash: b.supportHash, queryHash: hash(args.deckKeys.map(({ deckKey, role }) => ({ deckKey, role }))), ...b.admission } };
      return { status: "ready", stamp: s, policyId: base.policyId, startDistributionHash: args.startDistributionHash,
        records: args.deckKeys.map(d => ({ deckKey: d.deckKey, role: d.role, status: "ready", kind: options.exposureKind || "hitting-probability",
          value: options.exposure?.[d.deckKey] ?? .4, exactZero: options.exposure?.[d.deckKey] === 0, roundedToZero: false })),
        provenance: { ...native, contractHash: s.contractHash, startDistributionHash: args.startDistributionHash },
        bridgeReceipt: { ...b, nativeExposureStamp: b.nativeStamp, nativeExposureProvenance: native },
        diagnostics: { expectedCounts: [{ status: "unavailable", reason: "infinite-recurrent-count", exact: "infinity" }] } };
    },
    evaluateStudyScenarios: async (j, cb) => {
      const common = { startDistribution: j.startDistribution, startDistributionHash: startHash, policySemantics: "reoptimized" };
      const base = await cb.evaluate({ ...common, request: j.request });
      const scenarios = [];
      for (const s of j.scenarios) {
        const exposure = await cb.exposure({ ...common, request: j.request, policyId: j.exposurePolicyId, deckKeys: s.deckKeys });
        const evaluation = await cb.evaluate({ ...common, request: s.request, scenarioId: s.id, changes: s.changes });
        receipts.push({ id: s.id, projection: projections.find(p => p.scenario.id === s.id), exposure, evaluation });
        scenarios.push({ id: s.id, profileHash: s.profileHash, deckKeys: s.deckKeys, status: "ready", stamp: evaluation.stamp,
          exposure: exposure.records, outcomes: evaluation.outcomes, baselinePolicyId: base.policyId, scenarioPolicyId: evaluation.policyId,
          headroom: Math.max(...s.deckKeys.map(d => d.headroom)), headroomSemantics: "maximum-input-capacity-not-gain",
          simulatedWinDelta: evaluation.outcomes.win - base.outcomes.win });
      }
      return { apiVersion: 1, status: "ready", stamp: base.stamp, baseline: base, ...common, exposurePolicyId: j.exposurePolicyId,
        scenarios, coverage: { requestedScenarios: scenarios.length, readyScenarios: scenarios.length }, unresolvedReasons: [] };
    },
  };
  const result = await ngGameplanStudyProvider(job, deps);
  assert.equal(result.status, "ready", JSON.stringify(result));
  const input = { result, context: { stamp: "planner:7:100", baselineStamp: envelope(job.baseline.request), startDistribution: job.startDistribution,
    startDistributionHash: startHash, exposurePolicyId: job.exposurePolicyId, logicalContextHash: "toy-logical", manifestHash: "toy-manifest", day: 100,
    scenarios: job.scenarios.map(s => ({ id: s.id, stamp: envelope(s.request) })),
    decks: Object.fromEntries(allKeys.map((key, i) => [key, { count: 2, questions: ["shared", "q" + i], exact: true,
      allowed: options.available?.[key] ?? true, headroom: .15 - permanent[key] }])) }, receipts,
    bounds: { maxScenarios: 8, maxDecks: 64, maxEvidenceNodes: 50000, maxStringLength: 4096 } };
  return { input: clone(input), calls };
}
const ranked = output => output.rows.filter(r => r.status === "ready" && r.score > 0);
const frozenRank = (input, output) => ngGameplanRecommendations(output, input.context.stamp, input.context.decks);
function requireUnavailable(input, message) {
  const p = present(input);
  assert.equal(p.status, "unavailable", message || JSON.stringify(p));
  assert.equal(ranked(p).length, 0);
  return p;
}

test("actual coordinator lower bounds become joint ordering keys, never per-deck gains", async () => {
  const { input, calls } = await fixture(), p = present(input), b = input.result.scenarios[0].benefit;
  assert.equal(NG_GAMEPLAN_STUDY_PRESENTER_VERSION, 1); assert.equal(p.status, "ready");
  assert.equal(p.study.groups.length, 1); assert.equal(ranked(p).length, 2);
  assert.equal(frozenRank(input, p).rows.length, 2);
  assert.deepEqual(calls, { value: 2, exposure: 1 });
  for (const r of p.rows) {
    assert.equal(r.score, b.deltaBounds[0]); assert.notEqual(r.score, b.pointEstimate);
    assert.equal(r.scoreSemantics, "joint-hypothesis-ordering-key"); assert.equal(r.groupId, "joint");
    assert.equal(r.headroom, .15); assert.equal(r.exposure, .4);
    for (const forbidden of ["benefit", "simulatedWinDelta", "winGain", "earnedCredit", "pointEstimate"]) assert.equal(forbidden in r, false);
  }
  assert.equal("simulatedWinDelta" in p.study.groups[0].source, false);
  assert.deepEqual(p.study.groups[0].source.benefit, b);
  assert.equal(p.study.groups[0].members[0].deck.headroom, .25);
});

test("positive point noise with overlapping bounds remains uncertain and never exhausts a known deck", async () => {
  const { input } = await fixture({ scenarios: [{ ...defaultScenarios()[0], win: .505, winBounds: [.495, .515] }] });
  const p = present(input);
  assert.ok(input.result.scenarios[0].benefit.pointEstimate > 0);
  assert.equal(p.status, "partial"); assert.equal(p.study.groups[0].status, "uncertain");
  assert.equal(ranked(p).length, 0); assert.ok(p.rows.every(r => !("score" in r)));
  assert.equal(frozenRank(input, p).status, "partial"); assert.equal(p.study.coverage.uncertainScenarios, 1);
});

test("non-positive assessment uses zero only as a legacy non-ranking marker with its actual interval retained", async () => {
  const { input } = await fixture({ scenarios: [{ ...defaultScenarios()[0], win: .4, winBounds: [.39, .41] }] });
  const p = present(input);
  assert.equal(p.status, "ready"); assert.equal(p.study.groups[0].status, "non-positive");
  assert.ok(p.study.groups[0].source.benefit.deltaBounds[1] < 0);
  assert.ok(p.rows.every(r => r.score === 0 && r.scoreSemantics === "non-ranking-assessment-marker"));
  assert.equal(frozenRank(input, p).status, "exhausted");
});

test("an exact zero lower endpoint is not a positive ordering score", async () => {
  const { input } = await fixture({ baseline: { win: .5, winBounds: [.5, .5], error: 0, regret: 0 },
    scenarios: [{ ...defaultScenarios()[0], win: .5, winBounds: [.5, .5], error: 0, regret: 0 }] });
  assert.deepEqual(input.result.scenarios[0].benefit.deltaBounds, [0, 0]);
  assert.equal(ranked(present(input)).length, 0);
});

test("optimal intervals already cover policy regret and unresolved secondary outcomes remain visible", async () => {
  const { input } = await fixture({ baseline: { win: .5, winBounds: [.49, .51], regret: .8 },
    scenarios: [{ ...defaultScenarios()[0], regret: .8 }] });
  const p = present(input);
  assert.equal(ranked(p).length, 2);
  assert.ok(ranked(p)[0].score > .12, "regret must not be charged a second time");
  assert.equal(p.study.secondaryUnresolved, true);
  assert.deepEqual(p.study.baseline.quality, input.result.baseline.quality);
  assert.deepEqual(p.study.groups[0].receipts.evaluation.quality, input.receipts[0].evaluation.quality);
  assert.match(p.assumptions.join(" "), /other game outcomes remain uncertain/);
});

test("forged ordering keys, semantics and optimistic interval changes cannot rank", async () => {
  const { input } = await fixture();
  for (const alter of [
    b => { b.orderingScore = b.pointEstimate; },
    b => { b.deltaBounds[0] = b.orderingScore = .3; },
    b => { b.estimand = "best-action-Q"; },
    b => { b.status = "uncertain"; },
    b => { b.scenario.optimizedWinBounds[0] = .9; },
    b => { b.baseline.quality.secondaryStatus = "resolved"; },
  ]) {
    const changed = clone(input); alter(changed.result.scenarios[0].benefit); requireUnavailable(changed);
  }
});

test("all expected stamps, logical starts, manifest and day bind the current context", async () => {
  const { input } = await fixture();
  for (const alter of [
    i => { i.context.baselineStamp.revision++; },
    i => { i.context.baselineStamp.contractHash = "other-contract"; },
    i => { delete i.context.baselineStamp.opponentPolicyHash; },
    i => { i.context.scenarios[0].stamp.ruleset = "gi"; },
    i => { i.context.scenarios[0].stamp.horizon.moveCount++; },
    i => { i.context.scenarios[0].stamp.opponentPolicyHash = "other-opponent"; },
    i => { i.context.scenarios[0].stamp.profileHash = "other-profile"; },
    i => { i.context.startDistribution[0].stateId = "other-seat"; },
    i => { i.context.startDistributionHash = "other-starts"; },
    i => { i.context.exposurePolicyId = "unrelated-policy"; },
    i => { i.context.logicalContextHash = "other-context"; },
    i => { i.context.manifestHash = "other-manifest"; },
    i => { i.context.day++; },
  ]) { const changed = clone(input); alter(changed); requireUnavailable(changed); }
});

test("missing native/projector receipts or changed policy bindings stay unavailable rather than inventing zero", async () => {
  const { input } = await fixture();
  for (const alter of [
    i => { delete i.result; }, i => { i.receipts = []; },
    i => { delete i.result.baseline.bridgeReceipt; },
    i => { delete i.receipts[0].projection; },
    i => { delete i.receipts[0].evaluation.bridgeReceipt; },
    i => { delete i.receipts[0].exposure; },
    i => { i.receipts[0].evaluation.policyId = "other-policy"; },
    i => { i.receipts[0].evaluation.bridgeReceipt.nativeStamp.profileHash = "other-profile"; },
    i => { i.receipts[0].evaluation.bridgeReceipt.logicalStartDistributionHash = "other-starts"; },
    i => { i.receipts[0].evaluation.bridgeReceipt.runtimeHash = "other-runtime"; },
    i => { i.receipts[0].evaluation.bridgeReceipt.admission.metadataHash = "other-source"; },
    i => { i.receipts[0].exposure.bridgeReceipt.supportHash = "other-support"; },
    i => { i.receipts[0].exposure.bridgeReceipt.nativeExposureProvenance.contractHash = "other-native"; },
  ]) { const changed = clone(input); alter(changed); const p = requireUnavailable(changed); assert.ok(p.rows.every(r => !("score" in r))); }
});

test("value-only compression and absent or mismatched native label replay are never exposure evidence", async () => {
  const { input } = await fixture();
  for (const alter of [
    e => { e.provenance.behaviorCompression = true; e.bridgeReceipt.nativeExposureProvenance.behaviorCompression = true; },
    e => { e.stateEquivalence = { exposureLabelsPreserved: false }; },
    e => { e.provenance.exposureConvention = "offered-cards"; },
    e => { e.provenance.labelAdmission.metadataHash = "other-metadata"; e.bridgeReceipt.nativeExposureProvenance.labelAdmission.metadataHash = "other-metadata"; },
    e => { delete e.provenance.labelAdmission; },
    e => { e.provenance.policyHash = ""; },
  ]) { const changed = clone(input); alter(changed.receipts[0].exposure); requireUnavailable(changed); }
});

test("role-matched exposure rejects missing, ambiguous, wrong-role, infinite and positive-underflow selected measures", async () => {
  const { input } = await fixture();
  for (const alter of [
    rows => rows.pop(), rows => rows.push({ ...rows[0] }),
    rows => { rows[1].role = "Attacker"; }, rows => { rows[1].status = "unavailable"; },
    rows => { rows[0].value = "infinity"; }, rows => { rows[0].value = 0; rows[0].exactZero = false; },
    rows => { rows[0].value = 0; rows[0].exactZero = true; rows[0].roundedToZero = true; },
  ]) {
    const changed = clone(input); alter(changed.receipts[0].exposure.records);
    changed.result.scenarios[0].exposure = clone(changed.receipts[0].exposure.records); requireUnavailable(changed);
  }
});

test("proved zero baseline exposure is retained separately from missing coverage and positive joint benefit", async () => {
  const { input } = await fixture({ exposure: { [keys[1]]: 0 } }), p = present(input);
  assert.equal(p.status, "partial"); assert.equal(p.study.groups[0].status, "beneficial");
  assert.equal(ranked(p).length, 1); assert.equal(ranked(p)[0].key, keys[0]);
  const m = p.study.groups[0].members.find(m => m.deck.deckKey === keys[1]);
  assert.equal(m.exposure.value, 0); assert.equal(m.exposure.exactZero, true); assert.equal(m.withheld, "zero-baseline-exposure");
  assert.equal(p.study.coverage.unavailableScenarios, 0); assert.equal(frozenRank(input, p).status, "partial");
});

test("finite expected visits can rank while hitting evidence keeps infinite alternate counts diagnostic only", async () => {
  for (const exposureKind of ["expected-visits", "hitting-probability"]) {
    const { input } = await fixture({ exposureKind, exposure: { [keys[0]]: exposureKind === "expected-visits" ? 3 : .4 } });
    const p = present(input); assert.equal(p.status, "ready"); assert.equal(ranked(p).length, 2);
    assert.equal(p.study.groups[0].receipts.exposure.diagnostics.expectedCounts[0].exact, "infinity");
  }
});

test("multiple joint hypotheses choose a maximum priority per deck with one benefit per group, never summed", async () => {
  const a = defaultScenarios()[0], z = { ...a, id: "z", win: .75, winBounds: [.74, .76] };
  const { input } = await fixture({ scenarios: [a, z] }), p = present(input);
  assert.equal(p.study.groups.length, 2); assert.equal(p.rows.length, 2);
  for (const r of ranked(p)) {
    assert.equal(r.groupId, "z"); assert.equal(r.score, input.result.scenarios[1].benefit.orderingScore);
    assert.deepEqual(r.groupIds, ["joint", "z"]);
  }
  const tied = await fixture({ scenarios: [z, { ...z, id: "a" }] });
  assert.ok(ranked(present(tied.input)).every(r => r.groupId === "a"));
});

test("valid alternatives rank without erasing uncertain or missing comparisons from partial coverage", async () => {
  const a = defaultScenarios()[0], uncertain = { ...a, id: "uncertain", win: .505, winBounds: [.495, .515] };
  const { input } = await fixture({ scenarios: [a, uncertain] });
  for (const missing of [false, true]) {
    const changed = clone(input); if (missing) changed.receipts.pop();
    const p = present(changed);
    assert.equal(p.status, "partial"); assert.equal(ranked(p).length, 2);
    assert.equal(p.study.coverage[missing ? "unavailableScenarios" : "uncertainScenarios"], 1);
    assert.equal(frozenRank(changed, p).status, "ready", "frozen consumer coarsens status; root must retain presenter study status");
    assert.match(p.assumptions.join(" "), /not a complete assessment/);
  }
});

test("unrequested eligible material stays explicitly unassessed instead of becoming zero opportunity", async () => {
  const { input } = await fixture();
  input.context.decks["Other|Bottom"] = { count: 1, questions: ["other"], exact: true, allowed: true, headroom: .15 };
  const p = present(input);
  assert.equal(p.status, "partial"); assert.equal(ranked(p).length, 2);
  assert.deepEqual(p.study.coverage.unassessedDeckKeys, ["Other|Bottom"]);
  assert.equal(p.study.coverage.eligibleDecks, 3); assert.equal(p.study.coverage.assessedDecks, 2);
  assert.equal(p.rows.some(r => r.key === "Other|Bottom"), false); assert.equal(frozenRank(input, p).status, "partial");
});

test("a malformed alternative preserves a separately valid hypothesis and its partial status", async () => {
  const { input } = await fixture({ scenarios: [defaultScenarios()[0], { ...defaultScenarios()[0], id: "invalid" }] });
  delete input.result.scenarios[1].benefit.baseline;
  const p = present(input);
  assert.equal(p.status, "partial"); assert.equal(ranked(p).length, 2); assert.equal(p.study.groups[1].status, "unavailable");
});

test("unavailable source rows and full provider reasons survive alongside valid comparisons", async () => {
  const { input } = await fixture({ scenarios: [defaultScenarios()[0], { ...defaultScenarios()[0], id: "missing" }] });
  const row = input.result.scenarios[1]; row.status = "unavailable"; row.reason = "labelled-exposure-not-ready"; delete row.benefit;
  input.result.status = "partial"; input.result.coverage.readyScenarios = 1; input.result.unresolvedReasons = [row.reason];
  input.receipts.pop();
  const p = present(input);
  assert.equal(p.status, "partial"); assert.equal(p.study.groups[1].reason, row.reason);
  assert.deepEqual(p.study.source.unresolvedReasons, [row.reason]); assert.equal(p.study.source.coverage.readyScenarios, 1);
});

test("permanent and joint headroom stay distinct; sharp-only potential at permanent cap is not mastery", async () => {
  const { input } = await fixture({ permanent: { [keys[0]]: .15, [keys[1]]: .15 },
    scenarios: [{ ...defaultScenarios()[0], targets: keys.map(deckKey => ({ deckKey, sharpTo: .03 })) }] });
  const p = present(input);
  assert.equal(p.status, "partial"); assert.equal(p.study.groups[0].status, "beneficial"); assert.equal(ranked(p).length, 0);
  assert.ok(p.study.groups[0].members.every(m => m.plannerHeadroom === 0 && m.deck.headroom === .1 && m.withheld === "planner-permanent-headroom-exhausted"));
  assert.match(p.assumptions.join(" "), /outside the available new-card suggestions/);
  assert.doesNotMatch(p.assumptions.join(" "), /mastered/);
});

test("projected component capacities and summed deltas cannot be changed into legacy headroom", async () => {
  const { input } = await fixture();
  for (const alter of [
    d => { d.headroom = .15; }, d => { d.componentHeadroom.permanent = .25; },
    d => { d.jointDelta = .4; }, d => { d.role = "Defender"; },
  ]) {
    const changed = clone(input); alter(changed.receipts[0].projection.scenario.deckKeys[0]);
    changed.result.scenarios[0].deckKeys = clone(changed.receipts[0].projection.scenario.deckKeys); requireUnavailable(changed);
  }
  const changed = clone(input); changed.context.decks[keys[0]].headroom = .25; requireUnavailable(changed);
});

test("explicit inactive shared peers stay in the joint proof without becoming illegal suggestions", async () => {
  const { input } = await fixture({ ruleset: "nogi", available: { [keys[1]]: false } });
  const p = present(input);
  assert.equal(p.status, "partial"); assert.deepEqual(ranked(p).map(r => r.key), [keys[0]]);
  assert.equal(p.study.groups[0].receipts.projection.provenance.sharedClosure.deckKeys.length, 2);
  assert.equal(p.study.groups[0].members.find(m => m.deck.deckKey === keys[1]).withheld, "inactive-ruleset");
  const changed = clone(input); changed.context.decks[keys[1]].allowed = true; requireUnavailable(changed);
});

test("all four exact roles in both rulesets have plain conditional wording without numeric real-world promises", async () => {
  for (const ruleset of ["gi", "nogi"]) {
    const deckKeys = ["Position|Top", "Position|Bottom", ...keys];
    const { input } = await fixture({ ruleset, scenarios: [{ ...defaultScenarios()[0], targets: deckKeys.map(deckKey => ({ deckKey, permanentTo: .03 })) }] });
    const p = present(input);
    assert.equal(ranked(p).length, 4); assert.deepEqual(new Set(p.rows.map(r => r.role)), new Set(["Top", "Bottom", "Attacker", "Defender"]));
    const copy = [...p.assumptions, ...p.rows.map(r => r.reason)].join(" ");
    assert.match(copy, /hypothetical game-input/); assert.match(copy, /do not predict learning success or real BJJ outcomes/);
    assert.match(copy, /all proposed credit changes/); assert.match(copy, /deck alone does not establish/);
    assert.doesNotMatch(copy, /[0-9%]|baseline policy|reoptimized|Horizon actual-roll|deck manifest|simulatedWinDelta/);
    assert.ok(p.rows.every(r => r.reason.includes(ruleset === "gi" ? " in gi" : " in no-gi")));
  }
});

test("untimed comparisons use honest horizon wording instead of suggesting remaining game time", async () => {
  const { input } = await fixture({ horizon: { kind: "eventual" } }), p = present(input);
  assert.equal(p.status, "ready"); assert.match(p.assumptions.join(" "), /without a game-time limit/);
  assert.doesNotMatch(p.assumptions.join(" "), /remaining game time/);
});

test("complete provenance and source snapshots are deeply preserved without mutating or freezing inputs", async () => {
  const { input } = await fixture(), before = JSON.stringify(input), p = present(input);
  assert.equal(p.status, "ready"); assert.equal(JSON.stringify(input), before); assert.equal(Object.isFrozen(input), false);
  assert.deepEqual(p.study.context.startDistribution, input.context.startDistribution);
  assert.deepEqual(p.study.baseline, input.result.baseline);
  assert.deepEqual(p.study.groups[0].source, input.result.scenarios[0]);
  assert.deepEqual(p.study.groups[0].receipts, input.receipts[0]);
  assert.ok(Object.isFrozen(p.study.groups[0].receipts.exposure.bridgeReceipt.nativeExposureProvenance));
  input.receipts[0].evaluation.quality.secondaryStatus = "changed";
  assert.equal(p.study.groups[0].receipts.evaluation.quality.secondaryStatus, "unresolved-primary-ties");
  assert.throws(() => { p.rows[0].score = 9; }, TypeError);
});

test("duplicate scenario IDs, fabricated coverage and over-budget input reject without truncating", async () => {
  const { input } = await fixture();
  for (const alter of [
    i => { i.receipts.push(clone(i.receipts[0])); },
    i => { i.context.scenarios.push(clone(i.context.scenarios[0])); },
    i => { i.result.coverage.readyScenarios = 0; },
    i => { i.bounds.maxDecks = 1; }, i => { i.bounds.maxEvidenceNodes = 100; },
    i => { i.bounds.maxStringLength = 10; }, i => { delete i.bounds; },
    i => { i.result.scenarios[0].simulatedWinDelta = .9; },
  ]) { const changed = clone(input); alter(changed); requireUnavailable(changed); }
});

test("non-JSON evidence, accessors, cycles, sparse arrays and nonfinite values fail closed without side effects", async () => {
  const { input } = await fixture();
  for (const alter of [
    i => { i.receipts[0].exposure.diagnostics.bad = Infinity; },
    i => { i.context.extra = i; }, i => { i.receipts[0].extra = new Map(); },
    i => { i.receipts[0].extra = Array(2); }, i => { i.receipts[0].extra = undefined; },
    i => { Object.defineProperty(i.context, "extra", { get() { throw Error("getter executed"); }, enumerable: true }); },
    i => { Object.defineProperty(i.context, "extra", { value: 1, enumerable: false }); },
    i => { i.context[Symbol("hidden")] = 1; },
  ]) { const changed = clone(input); alter(changed); const p = requireUnavailable(changed); assert.notEqual(p.study.reason, "getter executed"); }
});

test("frozen planner keeps authoritative due debt, soft budget and shared-card dedupe with the new provider", async () => {
  const { input } = await fixture(), p = present(input);
  const srs = { [keys[0]]: { shared: [2, 99, 98] } };
  const plan = ngGameplanBuild({ day: 100, ruleset: "nogi", revision: 7, stamp: input.context.stamp, target: 1,
    decks: input.context.decks, srs, provider: p });
  assert.equal(plan.dueCards, 1); assert.equal(plan.fresh.length, 0); assert.equal(plan.more[0].questions.includes("shared"), false);
  assert.equal(ngGameplanProgress(plan, { srs, day: 100, decks: input.context.decks }).complete, false);
  const without = ngGameplanBuild({ day: 100, ruleset: "nogi", revision: 7, stamp: input.context.stamp, target: 1,
    decks: input.context.decks, srs, provider: present({ ...input, receipts: [] }) });
  assert.deepEqual(without.due, plan.due.map(r => ({ ...r, related: [] })));
  assert.equal(without.dueCards, 1); assert.equal(without.status, "unavailable");
});

test("new study results cannot reorder a mounted snapshot or grant completion; hydration only binds identities", async () => {
  const { input } = await fixture(), decks = clone(input.context.decks);
  for (const d of Object.values(decks)) { d.questions = []; d.exact = false; }
  const plan = ngGameplanBuild({ day: 100, ruleset: "nogi", revision: 7, stamp: input.context.stamp, target: 2,
    decks, srs: {}, provider: present(input) });
  const before = JSON.stringify(plan), newInput = (await fixture({ scenarios: [{ ...defaultScenarios()[0], win: .4, winBounds: [.39, .41] }] })).input;
  assert.equal(ranked(present(newInput)).length, 0); assert.equal(JSON.stringify(plan), before);
  const bound = ngGameplanBind(plan, input.context.decks);
  assert.deepEqual(bound.fresh.map(r => r.key), plan.fresh.map(r => r.key));
  assert.equal(ngGameplanProgress(bound, { day: 100, srs: {}, decks: input.context.decks }).complete, false);
  const actual = Object.fromEntries(bound.fresh.map(r => [r.key, Object.fromEntries(r.questions.map(q => [q, [2, 101, 100]]))]));
  assert.equal(ngGameplanProgress(bound, { day: 100, srs: actual, decks: input.context.decks }).complete, true);
  assert.equal(ngGameplanProgress(bound, { day: 101, srs: actual, decks: input.context.decks }).complete, false);
  assert.equal(frozenRank({ ...input, context: { ...input.context, stamp: "new-day" } }, present(input)).status, "stale");
});
