// Pure preparation/coordination only. Root supplies actual model evaluation,
// evaluated-policy exposure, knowledge fingerprints and job freshness. No worker,
// clock, sorted plan, reward projection, persistence or fabricated numeric fallback.
export const NG_GAMEPLAN_STUDY_PROVIDER_VERSION = 1;

function ngGameplanStudyClone(value) {
  if (value == null || ["string", "boolean", "undefined"].includes(typeof value)) return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(ngGameplanStudyClone);
  if (typeof value === "object" && [Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    return Object.fromEntries(Object.keys(value).sort().map((k) => [k, ngGameplanStudyClone(value[k])]));
  }
  throw new Error("non-json-study-input");
}
function ngGameplanStudyFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(ngGameplanStudyFreeze); Object.freeze(value);
  }
  return value;
}
function ngGameplanStudyEqual(a, b) {
  return JSON.stringify(ngGameplanStudyClone(a)) === JSON.stringify(ngGameplanStudyClone(b));
}
function ngGameplanStudyRequire(ok, reason) { if (!ok) throw new Error(reason); }
function ngGameplanStudyRole(d) {
  return d && ["Top", "Bottom", "Attacker", "Defender"].includes(d.role) &&
    typeof d.deckKey === "string" && d.deckKey.endsWith("|" + d.role) && d.deckKey.length > d.role.length + 1;
}
function ngGameplanStudyProfile(profile, request, fingerprint, maxKeys) {
  const fields = ["version", "revision", "contentRevision", "evidenceRevision", "day", "studyPolicy", "permanent", "sharp",
    "userMods", "filmLook", "flowCounts", "status", "diagnostics", "fingerprint"];
  ngGameplanStudyRequire(profile && profile.version === 1 && Object.keys(profile).every((k) => fields.includes(k)) &&
    profile.status === "ready" && typeof profile.fingerprint === "string" &&
    request && request.profileHash === profile.fingerprint && profile.studyPolicy === request.futureStudyPolicy, "unbound-knowledge-profile");
  ngGameplanStudyRequire(request.state && typeof request.state === "object" && !Array.isArray(request.state) &&
    !["snapshotId", "snapshotHash"].some((k) => Object.prototype.hasOwnProperty.call(request.state, k)),
    "transport-snapshot-in-logical-study-context");
  for (const name of ["permanent", "sharp"]) {
    const map = profile[name];
    ngGameplanStudyRequire(map && !Array.isArray(map) && typeof map === "object" && Object.keys(map).length <= maxKeys,
      "invalid-or-over-limit-profile");
    ngGameplanStudyRequire(Object.values(map).every((v) => Number.isFinite(v) && v >= 0 && v <= 1), "invalid-knowledge-bonus");
  }
  const data = Object.fromEntries(Object.entries(profile).filter(([k]) => k !== "fingerprint"));
  ngGameplanStudyRequire(fingerprint(data) === profile.fingerprint, "knowledge-fingerprint-mismatch");
}
function ngGameplanStudyScenario(scenario, baseline, maxDecks) {
  ngGameplanStudyRequire(typeof scenario.id === "string" && scenario.id.length > 0 &&
    Array.isArray(scenario.deckKeys) && scenario.deckKeys.length > 0 && scenario.deckKeys.length <= maxDecks,
    "invalid-or-over-limit-scenario");
  const decks = new Map();
  for (const deck of scenario.deckKeys) {
    ngGameplanStudyRequire(ngGameplanStudyRole(deck) && !decks.has(deck.deckKey) && Number.isFinite(deck.headroom) &&
      deck.headroom >= 0 && deck.headroom <= 1 && deck.componentHeadroom &&
      ["permanent", "sharp"].every((k) => Number.isFinite(deck.componentHeadroom[k]) &&
        deck.componentHeadroom[k] >= 0 && deck.componentHeadroom[k] <= 1), "invalid-role-headroom");
    decks.set(deck.deckKey, deck);
  }
  const changes = scenario.changes;
  ngGameplanStudyRequire(changes && changes.kind === "hypothetical-knowledge-input" && Array.isArray(changes.records) &&
    changes.records.length > 0 && changes.records.length <= 2 * maxDecks, "missing-hypothetical-change-declaration");
  const records = new Map(), covered = new Set(), totalChanges = new Map();
  for (const r of changes.records) {
    const deck = decks.get(r.deckKey), id = JSON.stringify([r.component, r.deckKey]), delta = r.to - r.from;
    ngGameplanStudyRequire(ngGameplanStudyRole(r) && deck && deck.role === r.role && !records.has(id) &&
      ["permanent", "sharp"].includes(r.component) && Number.isFinite(r.from) && Number.isFinite(r.to) &&
      r.to >= r.from && delta <= deck.componentHeadroom[r.component], "invalid-hypothetical-change");
    ngGameplanStudyRequire(r.from === (baseline.profile[r.component][r.deckKey] || 0) &&
      r.to === (scenario.profile[r.component][r.deckKey] || 0), "hypothetical-change-profile-mismatch");
    records.set(id, r); covered.add(r.deckKey);
    totalChanges.set(r.deckKey, (totalChanges.get(r.deckKey) || 0) + delta);
  }
  for (const [key, total] of totalChanges) ngGameplanStudyRequire(total <= decks.get(key).headroom,
    "joint-change-exceeds-deck-headroom");
  ngGameplanStudyRequire(covered.size === decks.size, "undeclared-scenario-deck");
  for (const component of ["permanent", "sharp"]) {
    for (const key of new Set([...Object.keys(baseline.profile[component]), ...Object.keys(scenario.profile[component])])) {
      if ((baseline.profile[component][key] || 0) !== (scenario.profile[component][key] || 0)) {
        ngGameplanStudyRequire(records.has(JSON.stringify([component, key])), "undeclared-profile-change");
      }
    }
  }
  const fixed = (p) => Object.fromEntries(Object.entries(p).filter(([k]) => !["permanent", "sharp", "fingerprint"].includes(k)));
  ngGameplanStudyRequire(ngGameplanStudyEqual(fixed(baseline.profile), fixed(scenario.profile)), "changed-non-study-profile-input");
  for (const key of ["mechanicsHash", "graphHash", "opponentPolicyHash", "ruleset", "objective", "horizon", "futureStudyPolicy", "state", "revision"]) {
    ngGameplanStudyRequire(ngGameplanStudyEqual(baseline.request[key], scenario.request[key]), "changed-study-context:" + key);
  }
}
function ngGameplanStudyExposure(value, args) {
  if (!value || value.status !== "ready") return value;
  ngGameplanStudyRequire(!value.stateEquivalence || value.stateEquivalence.exposureLabelsPreserved !== false,
    "value-only-compression-cannot-certify-deck-exposure");
  ngGameplanStudyRequire(Array.isArray(value.records) && args.deckKeys.every((d) => {
    const matches = value.records.filter((r) => r.deckKey === d.deckKey && r.role === d.role);
    return matches.length === 1 && matches[0].status === "ready";
  }), "missing-or-ambiguous-role-exposure");
  const p = value.provenance;
  // Value-equivalent state compression does NOT imply equal per-deck exposure.
  // Root must validate the actual certificate; this boundary checks its identity
  // and requested label scope, never infers that proof from equal outcome values.
  ngGameplanStudyRequire(p && p.kind === "evaluated-policy" && p.policyId === args.policyId &&
    p.startDistributionHash === args.startDistributionHash && typeof p.contractHash === "string" && p.contractHash.length > 0 &&
    value.stamp && p.contractHash === value.stamp.contractHash,
    "unvalidated-exposure-provenance");
  if (p.behaviorCompression !== false) {
    const proof = p.labelEquivalence;
    ngGameplanStudyRequire(p.behaviorCompression === true && proof && proof.status === "validated" &&
      typeof proof.proofId === "string" && proof.proofId.length > 0 && Array.isArray(proof.deckRoles) &&
      args.deckKeys.every((d) => proof.deckRoles.some((r) => r.deckKey === d.deckKey && r.role === d.role)),
      "unvalidated-compressed-exposure-labels");
  }
  return value;
}
function ngGameplanStudyOutwardAdd(a, b, up) {
  const value = a + b;
  // These sums are exact; in particular an exact zero comparison stays zero.
  if (a === 0 || b === 0 || a === -b) return value;
  if (value === 0) return up ? Number.MIN_VALUE : -Number.MIN_VALUE;
  const bits = new DataView(new ArrayBuffer(8));
  bits.setFloat64(0, value);
  bits.setBigUint64(0, bits.getBigUint64(0) + ((value > 0) === up ? 1n : -1n));
  return bits.getFloat64(0);
}
function ngGameplanStudyWinEvidence(value, args) {
  const p = value.provenance, q = value.quality, win = value.outcomes && value.outcomes.win;
  ngGameplanStudyRequire(p && p.kind === "evaluated-common-policy" && p.scope === "start-distribution" &&
    typeof value.policyId === "string" && value.policyId.length > 0 && p.policyId === value.policyId &&
    p.startDistributionHash === args.startDistributionHash && value.startDistributionHash === args.startDistributionHash &&
    typeof p.contractHash === "string" && p.contractHash.length > 0 && value.stamp && p.contractHash === value.stamp.contractHash,
    "unbound-common-policy-win-evidence");
  // These bounds must cover the aggregate over ALL declared starts, including
  // aggregation rounding. A root-state quality object alone is not that proof.
  ngGameplanStudyRequire(q && ["exact-rational", "certified"].includes(q.numericalStatus) &&
    [q.coordinateErrorBound, q.policyRegretBound].every((n) => Number.isFinite(n) && n >= 0 && n <= 1) &&
    Number.isFinite(win) && win >= 0 && win <= 1, "missing-or-invalid-study-win-bound");
  const lower = Math.max(0, ngGameplanStudyOutwardAdd(win, -q.coordinateErrorBound, false));
  const upper = Math.min(1, ngGameplanStudyOutwardAdd(win, q.coordinateErrorBound, true));
  // Comparing reoptimized profiles must also account for a baseline policy
  // that is only approximately optimal, even when its own value is exact.
  const optimalUpper = Math.min(1, ngGameplanStudyOutwardAdd(upper, q.policyRegretBound, true));
  let optimizedWinBounds = [lower, optimalUpper], boundSource = "coordinate-error-plus-policy-regret";
  if (Object.prototype.hasOwnProperty.call(value, "winBounds")) {
    const pair = value.winBounds;
    ngGameplanStudyRequire(p.winBoundsSemantics === "attainable-lower-optimal-upper" && Array.isArray(pair) && pair.length === 2 &&
      pair.every((n) => Number.isFinite(n) && n >= 0 && n <= 1) && pair[0] <= win && win <= pair[1],
      "invalid-or-ambiguous-optimal-win-bound");
    // An already certified optimal-V interval contains numerical error AND
    // primary regret. Do not charge either again. The lower endpoint must be
    // attainable by this reply's actual common policy; root certifies that fact.
    optimizedWinBounds = pair;
    boundSource = "explicit-attainable-lower-optimal-upper";
  }
  return { policyId: value.policyId, pointEstimate: win, commonPolicyWinBounds: [lower, upper],
    optimizedWinBounds, boundSource, quality: q };
}
function ngGameplanStudyBenefit(baseline, scenario) {
  const lower = ngGameplanStudyOutwardAdd(scenario.optimizedWinBounds[0], -baseline.optimizedWinBounds[1], false);
  const upper = ngGameplanStudyOutwardAdd(scenario.optimizedWinBounds[1], -baseline.optimizedWinBounds[0], true);
  const status = lower > 0 ? "beneficial" : upper <= 0 ? "non-positive" : "uncertain";
  return { status, measure: "simulated-win-probability", comparison: "same-start-separately-reoptimized",
    estimand: "scenario-optimal-win-minus-baseline-optimal-win",
    lowerBoundSemantics: "scenario-attainable-lower-minus-baseline-optimal-upper",
    baseline, scenario, deltaBounds: [Math.max(-1, lower), Math.min(1, upper)],
    pointEstimate: scenario.pointEstimate - baseline.pointEstimate,
    pointEstimateSemantics: "returned-common-policy-win-difference",
    ...(status === "beneficial" ? { orderingScore: lower } : {}),
    ...(status === "uncertain" ? { reason: "win-intervals-overlap" } : {}) };
}

/**
 * input: {baseline:{request,profile}, startDistribution, exposurePolicyId,
 *   scenarios:[{id,request,profile,deckKeys,changes}],
 *   bounds:{maxScenarios,maxDecksPerScenario,maxProfileKeys}}
 * changes: {kind:'hypothetical-knowledge-input',records:[{deckKey,role,
 *   component:'permanent'|'sharp',from,to}]}. Targets/profiles/headrooms come from
 * learning-owned mechanics; this function neither predicts earned credit nor
 * derives target bonuses. All listed changes form ONE joint scenario.
 * deckKeys records require joint headroom and componentHeadroom:{permanent,sharp};
 * each component delta AND the sum for that deck must fit their respective caps.
 * deps: {fingerprint,evaluateStudyScenarios,evaluate,exposure,isCurrent}.
 * evaluate/exposure receive the exact immutable compact `profile` in addition
 * to the existing mdp-learning arguments. Root owns transport/profile binding,
 * actual policy materialization, admission, worker cancellation and deadlines.
 * A ready evaluate reply needs provenance {kind:'evaluated-common-policy',
 * scope:'start-distribution',policyId,contractHash,startDistributionHash} and
 * aggregate quality {numericalStatus,coordinateErrorBound,policyRegretBound}.
 * Optional winBounds:[lower,upper] requires provenance.winBoundsSemantics ===
 * 'attainable-lower-optimal-upper'; it already includes error/regret. Otherwise
 * coordinateErrorBound must describe policy values ONLY and regret is added once.
 * Raw solver secondary/tertiary uncertainty must remain in quality. Every reply
 * describes one common policy's outcomes, not separately optimized coordinates.
 * The result replaces simulatedWinDelta with benefit evidence. Only its strictly
 * positive conservative lower bound has an orderingScore; it never sorts a plan.
 * Study callbacks must use root-admitted transport isolated from live-card
 * workers. This function itself owns no worker/provider cancellation handles.
 */
export async function ngGameplanStudyProvider(input, deps = {}) {
  const count = Array.isArray(input && input.scenarios) ? input.scenarios.length : 0;
  const unavailable = (reason) => ({ apiVersion: 1, status: "unavailable", scenarios: [],
    coverage: { requestedScenarios: count, readyScenarios: 0 }, unresolvedReasons: [reason] });
  let calls = { evaluations: 0, exposures: 0 }, startHash, busy = false;
  const current = () => ngGameplanStudyRequire(deps.isCurrent() === true, "stale-study-context");
  try {
    for (const name of ["fingerprint", "evaluateStudyScenarios", "evaluate", "exposure", "isCurrent"]) {
      ngGameplanStudyRequire(typeof deps[name] === "function", "missing-study-provider:" + name);
    }
    const bounds = input && input.bounds;
    ngGameplanStudyRequire(bounds && ["maxScenarios", "maxDecksPerScenario", "maxProfileKeys"].every((k) =>
      Number.isSafeInteger(bounds[k]) && bounds[k] > 0), "missing-or-invalid-study-bounds");
    ngGameplanStudyRequire(count > 0 && count <= bounds.maxScenarios, "empty-or-over-limit-study-batch");
    const job = ngGameplanStudyFreeze(ngGameplanStudyClone(input));
    ngGameplanStudyRequire(job.baseline && typeof job.exposurePolicyId === "string" && job.exposurePolicyId.length > 0 &&
      Array.isArray(job.startDistribution) && job.startDistribution.length > 0, "missing-study-context");
    current();
    ngGameplanStudyProfile(job.baseline.profile, job.baseline.request, deps.fingerprint, bounds.maxProfileKeys);
    const scenarios = new Map();
    for (const scenario of job.scenarios) {
      ngGameplanStudyProfile(scenario.profile, scenario.request, deps.fingerprint, bounds.maxProfileKeys);
      ngGameplanStudyScenario(scenario, job.baseline, bounds.maxDecksPerScenario);
      ngGameplanStudyRequire(!scenarios.has(scenario.id), "duplicate-study-scenario");
      scenarios.set(scenario.id, scenario);
    }
    const helperInput = { request: job.baseline.request, baseline: {
      profileHash: job.baseline.profile.fingerprint, request: job.baseline.request },
      startDistribution: job.startDistribution, exposurePolicyId: job.exposurePolicyId,
      scenarios: job.scenarios.map((s) => ({ id: s.id, profileHash: s.profile.fingerprint, request: s.request,
        deckKeys: s.deckKeys, changes: s.changes })) };
    const evaluated = new Set(), validatedExposure = new Set(), evaluations = new Map();
    const bind = (args) => {
      current();
      ngGameplanStudyRequire(!busy, "concurrent-study-provider-call");
      ngGameplanStudyRequire(ngGameplanStudyEqual(args.startDistribution, job.startDistribution) &&
        typeof args.startDistributionHash === "string" && args.startDistributionHash.length > 0,
        "unbound-study-start-distribution");
      if (startHash == null) startHash = args.startDistributionHash;
      ngGameplanStudyRequire(startHash === args.startDistributionHash, "changed-study-start-hash");
    };
    const result = await deps.evaluateStudyScenarios(helperInput, {
      evaluate: async (args) => {
        bind(args);
        const key = args.scenarioId == null ? "baseline" : "scenario:" + args.scenarioId;
        const row = args.scenarioId == null ? job.baseline : scenarios.get(args.scenarioId);
        ngGameplanStudyRequire(row && !evaluated.has(key) && calls.evaluations < count + 1 &&
          ngGameplanStudyEqual(args.request, row.request) && args.policySemantics === "reoptimized" &&
          (args.scenarioId == null || ngGameplanStudyEqual(args.changes, row.changes)), "unbound-or-repeated-study-evaluation");
        evaluated.add(key); calls.evaluations++; busy = true;
        let value;
        try { value = await deps.evaluate(ngGameplanStudyFreeze({ ...args, profile: row.profile })); }
        finally { busy = false; }
        current();
        if (value && value.status === "ready") {
          value = ngGameplanStudyFreeze(ngGameplanStudyClone(value));
          evaluations.set(key, { value, evidence: ngGameplanStudyWinEvidence(value, args) });
        }
        return value;
      },
      exposure: async (args) => {
        bind(args);
        const key = JSON.stringify(ngGameplanStudyClone(args.deckKeys));
        ngGameplanStudyRequire(calls.exposures < count && ngGameplanStudyEqual(args.request, job.baseline.request) &&
          args.policyId === job.exposurePolicyId && job.scenarios.some((s) => ngGameplanStudyEqual(s.deckKeys, args.deckKeys)),
          "unbound-study-exposure");
        // Different joint profiles may request the same label set; the helper's
        // per-scenario exposure call remains bounded even in that case.
        calls.exposures++; busy = true;
        let value;
        try { value = await deps.exposure(ngGameplanStudyFreeze({ ...args, profile: job.baseline.profile })); }
        finally { busy = false; }
        current();
        if (value) value = ngGameplanStudyFreeze(ngGameplanStudyClone(value));
        ngGameplanStudyExposure(value, args);
        if (value && value.status === "ready") validatedExposure.add(key);
        return value;
      },
    });
    current();
    ngGameplanStudyRequire(result && result.apiVersion === 1 && ["ready", "partial", "unavailable"].includes(result.status),
      "invalid-study-helper-result");
    if (result.status !== "unavailable") {
      ngGameplanStudyRequire(result.startDistributionHash === startHash &&
        ngGameplanStudyEqual(result.startDistribution, job.startDistribution) && result.exposurePolicyId === job.exposurePolicyId &&
        result.policySemantics === "reoptimized" && evaluated.has("baseline") && Array.isArray(result.scenarios) &&
        result.scenarios.length === count && new Set(result.scenarios.map((s) => s.id)).size === count,
        "unbound-study-helper-result");
      for (const row of result.scenarios) {
        const expected = scenarios.get(row.id);
        ngGameplanStudyRequire(expected && row.profileHash === expected.profile.fingerprint &&
          ngGameplanStudyEqual(row.deckKeys, expected.deckKeys), "unbound-study-scenario-result");
        if (row.status === "ready") ngGameplanStudyRequire(evaluated.has("scenario:" + row.id) &&
          validatedExposure.has(JSON.stringify(ngGameplanStudyClone(row.deckKeys))), "unevaluated-study-scenario-result");
      }
    }
    const baseline = evaluations.get("baseline");
    if (result.baseline) ngGameplanStudyRequire(baseline && ngGameplanStudyEqual(result.baseline, baseline.value),
      "changed-study-baseline-result");
    const rows = (result.scenarios || []).map((row) => {
      // The legacy helper's point subtraction is diagnostic only. Never expose
      // that field to the frozen planner as if it were a certified rank key.
      const { simulatedWinDelta, ...safe } = row;
      if (row.status === "ready") {
        const scenario = evaluations.get("scenario:" + row.id);
        ngGameplanStudyRequire(baseline && scenario && row.baselinePolicyId === baseline.value.policyId &&
          row.scenarioPolicyId === scenario.value.policyId && ngGameplanStudyEqual(row.stamp, scenario.value.stamp) &&
          ngGameplanStudyEqual(row.outcomes, scenario.value.outcomes), "changed-common-policy-study-result");
        safe.benefit = ngGameplanStudyBenefit(baseline.evidence, scenario.evidence);
      }
      return safe;
    });
    return ngGameplanStudyFreeze(ngGameplanStudyClone({ ...result, scenarios: rows, coordinator: {
      version: NG_GAMEPLAN_STUDY_PROVIDER_VERSION, hypothetical: true, calls, bounds: job.bounds } }));
  } catch (error) {
    return unavailable(error instanceof Error ? error.message : "study-provider-failed");
  }
}
