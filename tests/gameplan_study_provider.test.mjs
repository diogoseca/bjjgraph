// Coordinator contract tests. The dispatch double below describes a deterministic
// terminal toy (win=1 before/after study); numerical tests use controlled bound
// records. Neither is a production solver/exposure receipt. No real solve loop,
// worker scheduling, label-equivalence proof or production aggregation is tested.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { ngGameplanStudyProvider as provide } from "../neural/src/gameplan-study-provider.src.js";

const canonical = (v) => Array.isArray(v) ? v.map(canonical) : v && typeof v === "object"
  ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical(v[k])])) : v;
const fingerprint = (v) => createHash("sha256").update(JSON.stringify(canonical(v))).digest("hex");
const role = (key) => key.split("|")[1];
function profile(permanent = {}, sharp = {}, more = {}) {
  const p = { version: 1, revision: 7, contentRevision: "content", evidenceRevision: "evidence", day: 100,
    studyPolicy: "no-additional-study-events", permanent, sharp, userMods: [], filmLook: {}, flowCounts: {},
    status: "ready", diagnostics: [], ...more };
  return { ...p, fingerprint: fingerprint(p) };
}
function fixture() {
  const baseline = profile({ "Move|Attacker": 0, "Move|Defender": 0 });
  const changed = profile({ "Move|Attacker": .03, "Move|Defender": .03 });
  const request = (p, id) => ({ apiVersion: 2, requestId: id, revision: 7, modelHash: "toy-model", mechanicsHash: "mechanics",
    graphHash: "graph", profileHash: p.fingerprint, opponentPolicyHash: "opponent", ruleset: "nogi",
    objective: "max-win/min-loss/min-nontermination", horizon: { kind: "actual-roll", episodeCap: 10, moveCount: 2 },
    futureStudyPolicy: p.studyPolicy, state: { id: "guard/bottom", combo: 0, qMod: 0 } });
  const deckKeys = ["Move|Attacker", "Move|Defender"].map((deckKey) => ({ deckKey, role: role(deckKey), headroom: .25,
    componentHeadroom: { permanent: .15, sharp: .1 } }));
  return { baseline: { request: request(baseline, "baseline"), profile: baseline },
    startDistribution: [{ stateId: "guard/bottom", probability: "1/2" }, { stateId: "mount/top", probability: "1/2" }],
    exposurePolicyId: "actual-toy-policy", bounds: { maxScenarios: 2, maxDecksPerScenario: 4, maxProfileKeys: 8 },
    scenarios: [{ id: "joint", request: request(changed, "joint"), profile: changed, deckKeys,
      changes: { kind: "hypothetical-knowledge-input", records: deckKeys.map((d) => ({ deckKey: d.deckKey, role: d.role,
        component: "permanent", from: 0, to: .03 })) } }] };
}

function providers(options = {}) {
  const seen = { evaluate: [], exposure: [], helper: [] };
  const deps = {
    fingerprint, isCurrent: () => true,
    evaluate: async (args) => {
      seen.evaluate.push(args);
      const stamp = { ...args.request, contractHash: fingerprint(args.request) }, policyId = args.scenarioId || "actual-toy-policy";
      return { status: "ready", stamp, startDistributionHash: args.startDistributionHash, policyId,
        provenance: { kind: "evaluated-common-policy", scope: "start-distribution", policyId,
          contractHash: stamp.contractHash, startDistributionHash: args.startDistributionHash },
        quality: { numericalStatus: "exact-rational", coordinateErrorBound: 0, policyRegretBound: 0 },
        outcomes: { win: 1, loss: 0, explicitNoResult: 0, nontermination: 0 } };
    },
    exposure: async (args) => {
      seen.exposure.push(args);
      const stamp = { ...args.request, contractHash: fingerprint(args.request) };
      return { status: "ready", stamp, policyId: args.policyId, startDistributionHash: args.startDistributionHash,
        records: args.deckKeys.map((d) => ({ deckKey: d.deckKey, role: d.role, status: "ready", kind: "hitting-probability", value: 0 })),
        provenance: { kind: "evaluated-policy", behaviorCompression: false, policyId: args.policyId,
          startDistributionHash: args.startDistributionHash, contractHash: stamp.contractHash } };
    },
    evaluateStudyScenarios: async (job, callbacks) => {
      seen.helper.push(job);
      const common = { startDistribution: job.startDistribution, startDistributionHash: fingerprint(job.startDistribution), policySemantics: "reoptimized" };
      const baseline = await callbacks.evaluate({ ...common, request: job.request });
      const scenarios = [];
      for (const s of job.scenarios) {
        const row = { id: s.id, profileHash: s.profileHash, deckKeys: s.deckKeys, status: "unavailable" };
        try {
          const exposure = await callbacks.exposure({ ...common, request: job.request, policyId: job.exposurePolicyId, deckKeys: s.deckKeys });
          if (!exposure || exposure.status !== "ready") throw Error("missing-toy-exposure");
          const value = await callbacks.evaluate({ ...common, request: s.request, scenarioId: s.id, changes: s.changes });
          Object.assign(row, { status: "ready", stamp: value.stamp, exposure: exposure.records, outcomes: value.outcomes,
            baselinePolicyId: baseline.policyId, scenarioPolicyId: value.policyId,
            simulatedWinDelta: value.outcomes.win - baseline.outcomes.win });
        } catch (error) { row.reason = error.message; }
        scenarios.push(row);
      }
      const ready = scenarios.filter((s) => s.status === "ready").length;
      return { apiVersion: 1, status: ready === scenarios.length ? "ready" : ready ? "partial" : "unavailable",
        stamp: baseline.stamp, baseline, ...common, exposurePolicyId: job.exposurePolicyId, scenarios,
        coverage: { requestedScenarios: scenarios.length, readyScenarios: ready }, unresolvedReasons: scenarios.filter((s) => s.reason).map((s) => s.reason) };
    }, ...options,
  };
  return { deps, seen };
}
function numericalProviders(baseline, scenario) {
  const p = providers(), evaluate = p.deps.evaluate;
  p.deps.evaluate = async (args) => {
    const value = await evaluate(args), spec = args.scenarioId ? scenario : baseline;
    value.outcomes = { win: spec.win, loss: 1 - spec.win, explicitNoResult: 0, nontermination: 0 };
    value.quality = { numericalStatus: "certified", coordinateErrorBound: spec.error, policyRegretBound: spec.regret || 0,
      secondaryStatus: "unresolved-primary-ties", tertiaryStatus: "unresolved-primary-loss-ties",
      unresolvedReasons: ["exact-secondary-and-tertiary-ties-not-certified"] };
    return value;
  };
  return p;
}

test("one JOINT profile is evaluated once with the same starts, baseline profile drives exposure, and zero stays evidence", async () => {
  const input = fixture(), before = JSON.stringify(input), { deps, seen } = providers();
  const result = await provide(input, deps);
  assert.equal(result.status, "ready");
  const benefit = result.scenarios[0].benefit;
  assert.equal(benefit.status, "non-positive"); assert.equal(benefit.pointEstimate, 0);
  assert.deepEqual(benefit.deltaBounds, [0, 0]); assert.equal("orderingScore" in benefit, false);
  assert.equal("simulatedWinDelta" in result.scenarios[0], false, "legacy point rank is never exposed");
  assert.equal(result.scenarios[0].exposure[1].value, 0, "evaluated zero is not missing exposure");
  assert.equal(seen.evaluate.length, 2, "baseline plus one JOINT solve, no per-deck pseudo-solves");
  assert.deepEqual(seen.evaluate[1].profile, input.scenarios[0].profile);
  assert.equal(seen.evaluate[1].profile.permanent["Move|Defender"], .03);
  assert.deepEqual(seen.exposure[0].profile, input.baseline.profile);
  assert.deepEqual(seen.evaluate[1].startDistribution, input.startDistribution);
  assert.deepEqual(result.coordinator.calls, { evaluations: 2, exposures: 1 });
  assert.equal(JSON.stringify(input), before, "hypotheses never persist or mutate credit");
  assert.ok(Object.isFrozen(seen.evaluate[1].profile)); assert.ok(Object.isFrozen(result));
  assert.equal("ranking" in result, false); assert.equal("sessionGain" in result, false);
});

test("absent providers and empty or over-limit requests stay unavailable without work or silent truncation", async () => {
  for (const key of ["evaluateStudyScenarios", "evaluate", "exposure", "fingerprint", "isCurrent"]) {
    const { deps, seen } = providers(); delete deps[key];
    const result = await provide(fixture(), deps);
    assert.equal(result.status, "unavailable"); assert.match(result.unresolvedReasons[0], /missing-study-provider/);
    assert.equal(seen.evaluate.length, 0);
  }
  for (const change of [(i) => i.scenarios.push({ ...i.scenarios[0], id: "second" }, { ...i.scenarios[0], id: "third" }),
    (i) => i.scenarios.splice(0), (i) => { i.bounds.maxProfileKeys = 1; }, (i) => { delete i.bounds; }]) {
    const input = fixture(), { deps, seen } = providers(); change(input);
    const result = await provide(input, deps);
    assert.equal(result.status, "unavailable"); assert.equal(seen.helper.length, 0);
    assert.equal(result.coverage.requestedScenarios, input.scenarios.length);
  }
});

test("fingerprints bind exact compact profiles and host-only question evidence cannot enter them", async () => {
  const { deps, seen } = providers(), input = fixture();
  input.scenarios[0].profile.permanent["Move|Defender"] = .06;
  assert.match((await provide(input, deps)).unresolvedReasons[0], /fingerprint/);
  const raw = fixture(); raw.baseline.profile.rawQuestion = "host-only";
  assert.match((await provide(raw, deps)).unresolvedReasons[0], /unbound-knowledge-profile/);
  assert.equal(seen.evaluate.length, 0);
});

test("missing shared-role changes, false headroom and changed physical/transport state are rejected before solving", async () => {
  const mutations = [
    (i) => { i.scenarios[0].deckKeys.pop(); i.scenarios[0].changes.records.pop(); },
    (i) => { i.scenarios[0].deckKeys[0].headroom = .01; },
    (i) => { i.scenarios[0].changes.records[1].role = "Attacker"; },
    (i) => { i.scenarios[0].request.state = { ...i.scenarios[0].request.state, qMod: .04 }; },
    (i) => { i.scenarios[0].request.state = { ...i.scenarios[0].request.state, snapshotHash: "different-profile-binding" }; },
    (i) => { i.scenarios[0].profile = profile({ "Move|Attacker": .03, "Move|Defender": .03 }, {}, { day: 101 }); i.scenarios[0].request.profileHash = i.scenarios[0].profile.fingerprint; },
  ];
  for (const mutate of mutations) {
    const input = fixture(), { deps, seen } = providers(); mutate(input);
    assert.equal((await provide(input, deps)).status, "unavailable"); assert.equal(seen.evaluate.length, 0);
  }
});

test("logical comparison fixes starts, role, clock and opponent while transport snapshots belong to the root adapter", async () => {
  const variants = [
    (i) => { i.scenarios[0].request.ruleset = "gi"; },
    (i) => { i.scenarios[0].request.horizon.moveCount++; },
    (i) => { i.scenarios[0].request.opponentPolicyHash = "other-opponent"; },
    (i) => { i.scenarios[0].request.state.role = "top"; },
    (i) => { i.scenarios[0].request.state.positionKey = "different-position|Top"; },
    (i) => { i.scenarios[0].request.state.panicKey = "different-panic|Defender"; },
    (i) => { i.baseline.request.state.snapshotId = i.scenarios[0].request.state.snapshotId = "same-but-profile-bound-id"; },
    (i) => { i.baseline.request.state.snapshotHash = i.scenarios[0].request.state.snapshotHash = "same-but-profile-bound-hash"; },
  ];
  for (const mutate of variants) {
    const input = fixture(), { deps, seen } = providers(); mutate(input);
    assert.equal((await provide(input, deps)).status, "unavailable"); assert.equal(seen.evaluate.length, 0);
  }
});

test("permanent and sharp changes each respect their own component headroom", async () => {
  for (const mutate of [
    (i) => { i.scenarios[0].deckKeys[0].componentHeadroom.permanent = .01; },
    (i) => { delete i.scenarios[0].deckKeys[0].componentHeadroom; },
    (i) => { delete i.scenarios[0].deckKeys[0].componentHeadroom.sharp; },
  ]) {
    const input = fixture(), { deps, seen } = providers(); mutate(input);
    assert.equal((await provide(input, deps)).status, "unavailable"); assert.equal(seen.evaluate.length, 0);
  }
});

test("joint permanent plus sharp change cannot exceed deck headroom even when each component fits", async () => {
  const input = fixture(), s = input.scenarios[0];
  s.profile = profile({ "Move|Attacker": .03, "Move|Defender": .03 }, { "Move|Attacker": .03 });
  s.request.profileHash = s.profile.fingerprint;
  s.changes.records.push({ deckKey: "Move|Attacker", role: "Attacker", component: "sharp", from: 0, to: .03 });
  s.deckKeys[0].headroom = .05;
  const { deps, seen } = providers(), rejected = await provide(input, deps);
  assert.equal(rejected.status, "unavailable"); assert.deepEqual(rejected.unresolvedReasons, ["joint-change-exceeds-deck-headroom"]);
  assert.equal(seen.evaluate.length, 0);
  s.deckKeys[0].headroom = .06;
  const accepted = await provide(input, providers().deps);
  assert.equal(accepted.status, "ready", "exactly filled joint cap is legal");
});

test("role exposure needs unambiguous records and value-equivalent compression is never proof by itself", async () => {
  for (const variant of ["absent", "compression-only", "wrong-role", "wrong-policy", "wrong-starts", "wrong-contract", "missing-defender", "contradiction", "ambiguous-measure"]) {
    const { deps, seen } = providers(), exposure = deps.exposure;
    deps.exposure = async (args) => {
      const value = await exposure(args), p = value.provenance;
      if (variant === "absent") delete value.provenance;
      if (variant === "compression-only") p.behaviorCompression = true;
      if (variant === "wrong-role") { p.behaviorCompression = true; p.labelEquivalence = {
        status: "validated", proofId: "fixture-certificate", deckRoles: [{ deckKey: "Move|Defender", role: "Attacker" }] }; }
      if (variant === "wrong-policy") p.policyId = "another-policy";
      if (variant === "wrong-starts") p.startDistributionHash = "another-distribution";
      if (variant === "wrong-contract") p.contractHash = "another-model";
      if (variant === "missing-defender") value.records.pop();
      if (variant === "contradiction") value.stateEquivalence = { exposureLabelsPreserved: false };
      if (variant === "ambiguous-measure") value.records.push({ ...value.records[0], kind: "expected-visits", value: 1 });
      return value;
    };
    const result = await provide(fixture(), deps);
    assert.equal(result.status, "unavailable", variant);
    assert.equal(seen.evaluate.length, 1, "unsupported exposure does not produce a hypothetical solve or gain");
    assert.ok(result.unresolvedReasons.some((s) => s.includes("exposure")));
  }
});

test("explicit label-aware proof covers every requested role under the bound policy/context", async () => {
  const { deps } = providers(), exposure = deps.exposure;
  deps.exposure = async (args) => {
    const value = await exposure(args);
    value.provenance.behaviorCompression = true;
    value.provenance.labelEquivalence = { status: "validated", proofId: "toy-label-partition-certificate",
      deckRoles: args.deckKeys.map(({ deckKey, role }) => ({ deckKey, role })) };
    return value;
  };
  assert.equal((await provide(fixture(), deps)).status, "ready");
});

test("profile/context mutation during an outstanding solve cannot overwrite the captured inputs", async () => {
  const input = fixture(), { deps, seen } = providers(), evaluate = deps.evaluate;
  let release, entered;
  const begun = new Promise((r) => { entered = r; }), gate = new Promise((r) => { release = r; });
  deps.evaluate = async (args) => { if (!args.scenarioId) { entered(); await gate; } return evaluate(args); };
  const pending = provide(input, deps); await begun;
  input.scenarios[0].profile.permanent["Move|Attacker"] = .15;
  input.startDistribution[0].stateId = "changed";
  release();
  assert.equal((await pending).status, "ready");
  assert.equal(seen.evaluate[1].profile.permanent["Move|Attacker"], .03);
  assert.equal(seen.evaluate[1].startDistribution[0].stateId, "guard/bottom");
});

test("stale results are discarded before further work, not reinterpreted as zero opportunity", async () => {
  let current = true;
  const { deps, seen } = providers({ isCurrent: () => current }), evaluate = deps.evaluate;
  deps.evaluate = async (args) => { const value = await evaluate(args); current = false; return value; };
  const result = await provide(fixture(), deps);
  assert.equal(result.status, "unavailable"); assert.deepEqual(result.unresolvedReasons, ["stale-study-context"]);
  assert.equal(seen.evaluate.length, 1); assert.equal(seen.exposure.length, 0);
  assert.equal("simulatedWinDelta" in result, false);
});

test("the coordinator refuses redirected requests, repeated evaluation and start hash drift", async () => {
  for (const variant of ["profile", "repeat", "starts"]) {
    const { deps, seen } = providers();
    deps.evaluateStudyScenarios = async (job, callbacks) => {
      const args = { request: job.request, startDistribution: job.startDistribution,
        startDistributionHash: "original", policySemantics: "reoptimized" };
      if (variant === "profile") args.request = { ...args.request, profileHash: "wrong" };
      await callbacks.evaluate(args);
      if (variant === "starts") args.startDistributionHash = "different";
      return callbacks.evaluate(args);
    };
    assert.equal((await provide(fixture(), deps)).status, "unavailable");
    assert.equal(seen.evaluate.length, variant === "profile" ? 0 : 1);
  }
});

test("positive numerical noise and touching win intervals cannot become beneficial ordering", async () => {
  for (const [baseline, scenario] of [
    [{ win: .5, error: 4 * Number.EPSILON }, { win: .5 + Number.EPSILON, error: 4 * Number.EPSILON }],
    [{ win: .25, error: .0625 }, { win: .375, error: .0625 }],
    [{ win: .25, error: .02 }, { win: .28, error: .011 }],
  ]) {
    const { deps } = numericalProviders(baseline, scenario), result = await provide(fixture(), deps);
    assert.equal(result.status, "ready", "valid uncertain evaluation remains available evidence");
    const b = result.scenarios[0].benefit;
    assert.ok(b.pointEstimate > 0); assert.equal(b.status, "uncertain");
    assert.ok(b.deltaBounds[0] <= 0 && b.deltaBounds[1] > 0); assert.equal("orderingScore" in b, false);
    assert.equal("simulatedWinDelta" in result.scenarios[0], false);
  }
});

test("beneficial ordering uses the conservative joint lower bound and preserves unresolved ties", async () => {
  const { deps, seen } = numericalProviders({ win: .25, error: .01 }, { win: .375, error: .02 });
  const result = await provide(fixture(), deps), row = result.scenarios[0], b = row.benefit;
  assert.equal(result.status, "ready"); assert.equal(b.status, "beneficial");
  assert.equal(b.estimand, "scenario-optimal-win-minus-baseline-optimal-win");
  assert.equal(b.lowerBoundSemantics, "scenario-attainable-lower-minus-baseline-optimal-upper");
  assert.ok(b.orderingScore > .094 && b.orderingScore <= .095, ".125 point difference minus BOTH coordinate errors");
  assert.equal(b.orderingScore, b.deltaBounds[0]); assert.ok(b.orderingScore < b.pointEstimate);
  assert.equal(b.baseline.quality.secondaryStatus, "unresolved-primary-ties");
  assert.equal(b.scenario.quality.tertiaryStatus, "unresolved-primary-loss-ties");
  assert.deepEqual(b.scenario.quality.unresolvedReasons, ["exact-secondary-and-tertiary-ties-not-certified"]);
  assert.notEqual(b.baseline.policyId, b.scenario.policyId, "each scenario retains its OWN common optimizing policy");
  assert.equal(seen.evaluate.length, 2, "a joint two-deck profile is still one evaluation");
});

test("baseline policy regret can erase apparent gain even when policy coordinate values are exact", async () => {
  const { deps } = numericalProviders({ win: .4, error: 0, regret: .05 }, { win: .44, error: 0, regret: .01 });
  const b = (await provide(fixture(), deps)).scenarios[0].benefit;
  assert.ok(b.pointEstimate > 0); assert.equal(b.status, "uncertain"); assert.equal("orderingScore" in b, false);
  assert.ok(b.baseline.optimizedWinBounds[1] >= .45); assert.deepEqual(b.baseline.commonPolicyWinBounds, [.4, .4]);
  assert.ok(b.deltaBounds[0] <= -.01 && b.deltaBounds[1] >= .05);
});

test("explicit attainable/optimal winBounds are not charged numerical error or policy regret twice", async () => {
  const { deps } = numericalProviders({ win: .25, error: .1, regret: .2 }, { win: .35, error: .1, regret: .2 });
  const evaluate = deps.evaluate;
  deps.evaluate = async (args) => {
    const value = await evaluate(args);
    value.winBounds = args.scenarioId ? [.34, .4] : [.25, .3];
    value.provenance.winBoundsSemantics = "attainable-lower-optimal-upper";
    return value;
  };
  const result = await provide(fixture(), deps), b = result.scenarios[0].benefit;
  assert.equal(result.status, "ready"); assert.equal(b.status, "beneficial");
  assert.ok(b.orderingScore > .039 && b.orderingScore <= .041);
  assert.deepEqual(b.baseline.optimizedWinBounds, [.25, .3]); assert.deepEqual(b.scenario.optimizedWinBounds, [.34, .4]);
  assert.equal(b.baseline.boundSource, "explicit-attainable-lower-optimal-upper");
  assert.equal(b.scenario.quality.policyRegretBound, .2, "diagnostic quality remains intact, not added to certified endpoints");
});

test("an explicit optimal bound needs clear attainable semantics and a valid enclosing interval", async () => {
  for (const variant of ["unlabelled", "only-policy-value", "reversed", "misses-center", "not-finite"]) {
    const { deps } = numericalProviders({ win: .25, error: .01 }, { win: .35, error: .01 }), evaluate = deps.evaluate;
    deps.evaluate = async (args) => {
      const value = await evaluate(args);
      value.winBounds = [.24, .3];
      if (variant !== "unlabelled") value.provenance.winBoundsSemantics = "attainable-lower-optimal-upper";
      if (variant === "only-policy-value") value.provenance.winBoundsSemantics = "policy-value";
      if (variant === "reversed") value.winBounds = [.3, .2];
      if (variant === "misses-center") value.winBounds = [.26, .3];
      if (variant === "not-finite") value.winBounds[1] = NaN;
      return value;
    };
    assert.equal((await provide(fixture(), deps)).status, "unavailable", variant);
  }
});

test("negative bounds and probability endpoints stay valid without invented positive opportunity", async () => {
  for (const [baseline, scenario, status] of [
    [{ win: .75, error: .01 }, { win: .25, error: .02 }, "non-positive"],
    [{ win: 0, error: .01 }, { win: 1, error: .02 }, "beneficial"],
    [{ win: 1, error: .01 }, { win: 0, error: .02 }, "non-positive"],
  ]) {
    const { deps } = numericalProviders(baseline, scenario), b = (await provide(fixture(), deps)).scenarios[0].benefit;
    assert.equal(b.status, status); assert.ok(b.deltaBounds[0] >= -1 && b.deltaBounds[1] <= 1);
    for (const v of [b.baseline, b.scenario]) assert.ok(v.optimizedWinBounds[0] >= 0 && v.optimizedWinBounds[1] <= 1);
    if (status !== "beneficial") assert.equal("orderingScore" in b, false);
  }
});

test("outward rounding encloses tiny nonzero terms that ordinary subtraction loses", async () => {
  const tiny = Number.MIN_VALUE;
  const positive = numericalProviders({ win: tiny, error: tiny }, { win: 1, error: tiny });
  const p = (await provide(fixture(), positive.deps)).scenarios[0].benefit;
  assert.equal(1 - tiny, 1, "control: ordinary Number subtraction rounds away positive mass");
  assert.ok(p.deltaBounds[0] < 1 && p.deltaBounds[0] > .99, "guaranteed gain must stay strictly below one");
  assert.equal(p.deltaBounds[1], 1);
  const negative = numericalProviders({ win: 1, error: tiny }, { win: tiny, error: tiny });
  const n = (await provide(fixture(), negative.deps)).scenarios[0].benefit;
  assert.equal(n.deltaBounds[0], -1); assert.ok(n.deltaBounds[1] > -1 && n.deltaBounds[1] < -.99);
});

test("missing, malformed or unbound aggregate numerical evidence is unavailable, never a zero error assumption", async () => {
  const variants = [
    (v) => { delete v.quality; }, (v) => { delete v.quality.coordinateErrorBound; },
    (v) => { delete v.quality.policyRegretBound; }, (v) => { v.quality.coordinateErrorBound = -.01; },
    (v) => { v.quality.coordinateErrorBound = Infinity; }, (v) => { v.quality.policyRegretBound = NaN; },
    (v) => { v.quality.numericalStatus = "approximate"; }, (v) => { delete v.provenance; },
    (v) => { v.provenance.scope = "root-state"; }, (v) => { v.provenance.policyId = "another-policy"; },
    (v) => { v.provenance.contractHash = "another-profile"; }, (v) => { v.provenance.startDistributionHash = "another-start"; },
  ];
  for (const mutate of variants) {
    const { deps, seen } = providers(), evaluate = deps.evaluate;
    deps.evaluate = async (args) => { const value = await evaluate(args); mutate(value); return value; };
    const result = await provide(fixture(), deps);
    assert.equal(result.status, "unavailable"); assert.equal(seen.evaluate.length, 1); assert.equal(seen.exposure.length, 0);
    assert.equal(result.scenarios.some((s) => s.benefit && "orderingScore" in s.benefit), false);
  }
});

test("a helper cannot substitute another policy or vector after evaluation", async () => {
  for (const mutate of [
    (r) => { r.scenarios[0].scenarioPolicyId = "another-policy"; },
    (r) => { r.scenarios[0].outcomes = { win: .9, loss: .1, explicitNoResult: 0, nontermination: 0 }; },
    (r) => { r.scenarios[0].stamp = { contractHash: "another-context" }; },
    (r) => { r.baseline = { ...r.baseline, policyId: "another-baseline" }; },
  ]) {
    const { deps } = providers(), helper = deps.evaluateStudyScenarios;
    deps.evaluateStudyScenarios = async (...args) => { const result = await helper(...args); mutate(result); return result; };
    const result = await provide(fixture(), deps);
    assert.equal(result.status, "unavailable"); assert.match(result.unresolvedReasons[0], /changed-.*study-.*result/);
  }
});

test("one missing scenario bound preserves supported joint evidence without inventing a score for the other", async () => {
  const input = fixture(), another = structuredClone(input.scenarios[0]);
  another.id = "uncertified"; another.request.requestId = "uncertified"; input.scenarios.push(another);
  const { deps, seen } = numericalProviders({ win: .25, error: .01 }, { win: .375, error: .02 }), evaluate = deps.evaluate;
  deps.evaluate = async (args) => {
    const value = await evaluate(args);
    if (args.scenarioId === "uncertified") delete value.quality.coordinateErrorBound;
    return value;
  };
  const result = await provide(input, deps);
  assert.equal(result.status, "partial"); assert.deepEqual(result.coverage, { requestedScenarios: 2, readyScenarios: 1 });
  assert.equal(result.scenarios[0].benefit.status, "beneficial"); assert.equal(result.scenarios[1].status, "unavailable");
  assert.equal("benefit" in result.scenarios[1], false); assert.equal("simulatedWinDelta" in result.scenarios[1], false);
  assert.match(result.scenarios[1].reason, /study-win-bound/);
  assert.equal(seen.evaluate.length, 3, "one baseline and each joint profile once");
});
