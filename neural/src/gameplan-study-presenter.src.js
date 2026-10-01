// Intentional adapter to the frozen deck planner. Root supplies admitted study
// evidence and owns freshness, scheduling and UI installation. This module has
// no solver, worker, session, clock, SRS or earned-credit side effects.
export const NG_GAMEPLAN_STUDY_PRESENTER_VERSION = 1;

const ROLES = ["Top", "Bottom", "Attacker", "Defender"];
const OUTCOMES = ["win", "loss", "explicitNoResult", "nontermination"];
const SAME_CONTEXT = ["revision", "mechanicsHash", "graphHash", "opponentPolicyHash", "ruleset", "objective", "horizon", "futureStudyPolicy"];
// PLAIN COPY (item 9, owner 2026-09-30: the old wording "reads like a disclaimer"). One plain sentence
// per card in `reason`; each caveat is said ONCE, here, and shown under "Why these decks?". The
// meaning is unchanged: game effects only, joint practice, and no promise about real grappling.
const TEXT = {
  hypothesis: "These are game effects only: they don't predict how fast you'll learn or how you'll do on the mat.",
  joint: "Each comparison assumes you practise all of its material; practising only part of it may not have the same effect.",
  partial: "Some comparisons are uncertain or unavailable, so this is not a full picture.",
  limited: "Some compared material isn't in today's new cards; its effect is not counted in this plan.",
  secondary: "Some other outcomes stay uncertain, even where the comparison shows more wins.",
  unavailable: "Study suggestions need a finished comparison. Your reviews are still available.",
};
const need = (condition, reason) => { if (!condition) throw new Error(reason); };
const word = (x) => typeof x === "string" && x.trim().length > 0;
const finite = (x) => typeof x === "number" && Number.isFinite(x);
const unit = (x) => finite(x) && x >= 0 && x <= 1;
const role = (d) => d && ROLES.includes(d.role) && word(d.deckKey) && d.deckKey.split("|").length === 2 && d.deckKey.endsWith("|" + d.role);
const pair = (x, min = 0, max = 1) => Array.isArray(x) && x.length === 2 && x.every(n => finite(n) && n >= min && n <= max) && x[0] <= x[1];
function canonical(v) {
  if (Array.isArray(v)) return v.map(canonical);
  return v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])])) : v;
}
const equal = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
function freeze(v) {
  if (v && typeof v === "object") { Object.values(v).forEach(freeze); Object.freeze(v); }
  return v;
}
function copyInput(input) {
  // Inspect the budget without executing caller accessors. No budget allows a
  // partial copy, sparse array, cycle, silent field loss or prototype mutation.
  const raw = input && Object.getOwnPropertyDescriptor(input, "bounds")?.value;
  const bounds = {};
  for (const key of ["maxScenarios", "maxDecks", "maxEvidenceNodes", "maxStringLength"]) {
    const n = raw && Object.getOwnPropertyDescriptor(raw, key)?.value;
    need(Number.isSafeInteger(n) && n > 0, "missing-or-invalid-presenter-bounds"); bounds[key] = n;
  }
  let nodes = 0;
  const active = new Set();
  function copy(v, depth) {
    need(++nodes <= bounds.maxEvidenceNodes && depth <= 64, "presenter-evidence-budget");
    if (v === null || typeof v === "boolean" || finite(v)) return v;
    if (typeof v === "string") { need(v.length <= bounds.maxStringLength, "presenter-string-budget"); return v; }
    need(v && typeof v === "object" && !active.has(v), "non-json-presenter-input");
    const array = Array.isArray(v);
    need(array || [Object.prototype, null].includes(Object.getPrototypeOf(v)), "non-json-presenter-input");
    const keys = Reflect.ownKeys(v).filter(k => !(array && k === "length"));
    need(keys.length <= bounds.maxEvidenceNodes - nodes, "presenter-evidence-budget");
    if (array) need(keys.length === v.length && keys.every((k, i) => k === String(i)), "non-json-presenter-input");
    active.add(v);
    const entries = keys.map(k => {
      const d = Object.getOwnPropertyDescriptor(v, k);
      need(typeof k === "string" && k.length <= bounds.maxStringLength && d.enumerable && "value" in d, "non-json-presenter-input");
      return [k, copy(d.value, depth + 1)];
    });
    active.delete(v);
    return array ? entries.map(e => e[1]) : Object.fromEntries(entries);
  }
  return copy(input, 0);
}
function stamp(s) {
  need(s && s.apiVersion === 2 && Number.isSafeInteger(s.revision) && s.revision >= 0 &&
    ["requestId", "modelHash", "mechanicsHash", "graphHash", "profileHash", "opponentPolicyHash", "objective", "futureStudyPolicy", "contractHash"].every(k => word(s[k])) &&
    ["gi", "nogi"].includes(s.ruleset) && s.objective === "max-win/min-loss/min-nontermination" && s.futureStudyPolicy === "no-additional-study-events" &&
    (s.horizon?.kind === "eventual" || (s.horizon?.kind === "actual-roll" && Number.isSafeInteger(s.horizon.episodeCap) && s.horizon.episodeCap > 0 &&
      Number.isSafeInteger(s.horizon.moveCount) && s.horizon.moveCount >= 0)), "missing-full-study-stamp");
}
function bridge(value, expected, startHash) {
  const b = value.bridgeReceipt;
  need(b && b.version === 1 && b.kind === "logical-native-study-bridge" && equal(b.logicalStamp, expected) &&
    b.logicalStartDistributionHash === startHash && b.profileHash === expected.profileHash && b.policyId === value.policyId &&
    b.behaviorCompression === false && ["nativeStartDistributionHash", "mappingHash", "snapshotId", "snapshotHash", "runtimeHash", "supportHash", "fixedPolicyId", "hash"].every(k => word(b[k])),
    "missing-or-unbound-native-bridge-receipt");
  stamp(b.nativeStamp);
  need([...SAME_CONTEXT, "profileHash"].every(k => equal(b.nativeStamp[k], expected[k])) &&
    b.nativeValueQuality && b.independentQuality && b.admission && word(b.admission.metadataHash) && b.admission.lawHashes,
    "unbound-native-context-or-admission");
  return b;
}
function valueEvidence(v, expected, startHash) {
  need(v && v.status === "ready" && equal(v.stamp, expected) && v.startDistributionHash === startHash && word(v.policyId), "missing-or-stale-common-policy-value");
  const p = v.provenance, q = v.quality;
  need(p && p.kind === "evaluated-common-policy" && p.scope === "start-distribution" && p.policyId === v.policyId &&
    p.startDistributionHash === startHash && p.contractHash === expected.contractHash && p.winBoundsSemantics === "attainable-lower-optimal-upper",
    "unbound-common-policy-provenance");
  need(q && ["exact-rational", "certified"].includes(q.numericalStatus) && unit(q.coordinateErrorBound) && unit(q.policyRegretBound) &&
    v.outcomes && OUTCOMES.every(k => unit(v.outcomes[k])) && Math.abs(OUTCOMES.reduce((n, k) => n + v.outcomes[k], 0) - 1) <= 1e-10 &&
    pair(v.winBounds) && v.winBounds[0] <= v.outcomes.win && v.outcomes.win <= v.winBounds[1] && v.outcomeBounds &&
    OUTCOMES.every(k => pair(v.outcomeBounds[k]) && v.outcomeBounds[k][0] <= v.outcomes[k] && v.outcomes[k] <= v.outcomeBounds[k][1]),
    "missing-certified-common-policy-bounds");
  bridge(v, expected, startHash);
}
function benefitEvidence(b, baseline, scenario) {
  need(b && b.measure === "simulated-win-probability" && b.comparison === "same-start-separately-reoptimized" &&
    b.estimand === "scenario-optimal-win-minus-baseline-optimal-win" &&
    b.lowerBoundSemantics === "scenario-attainable-lower-minus-baseline-optimal-upper" &&
    b.pointEstimateSemantics === "returned-common-policy-win-difference", "unsupported-benefit-estimand");
  for (const [e, v] of [[b.baseline, baseline], [b.scenario, scenario]]) {
    need(e && e.policyId === v.policyId && e.pointEstimate === v.outcomes.win && equal(e.quality, v.quality) &&
      e.boundSource === "explicit-attainable-lower-optimal-upper" && equal(e.optimizedWinBounds, v.winBounds) &&
      pair(e.commonPolicyWinBounds) && e.commonPolicyWinBounds[0] <= v.outcomes.win && v.outcomes.win <= e.commonPolicyWinBounds[1],
      "changed-benefit-policy-evidence");
  }
  need(pair(b.deltaBounds, -1, 1) && b.deltaBounds[0] <= scenario.winBounds[0] - baseline.winBounds[1] &&
    b.deltaBounds[1] >= scenario.winBounds[1] - baseline.winBounds[0] && b.pointEstimate === scenario.outcomes.win - baseline.outcomes.win,
    "nonconservative-benefit-interval");
  const [lower, upper] = b.deltaBounds;
  const status = lower > 0 ? "beneficial" : upper <= 0 ? "non-positive" : "uncertain";
  need(b.status === status && (status === "beneficial" ? b.orderingScore === lower && b.orderingScore > 0 : !("orderingScore" in b)), "invalid-conservative-ordering-score");
  return status;
}
function projectionEvidence(projection, row, context) {
  const s = projection?.scenario, p = projection?.provenance;
  need(projection?.apiVersion === 1 && projection.status === "ready" && s && s.id === row.id && s.profileHash === row.profileHash &&
    s.profile?.version === 1 && s.profile.fingerprint === row.profileHash && s.profile.status === "ready" && s.profile.day === context.day &&
    s.profile.studyPolicy === context.baselineStamp.futureStudyPolicy && equal(s.deckKeys, row.deckKeys) &&
    p && p.knowledgeVersion === 1 && p.kind === "hypothetical-knowledge-input" && p.targetSemantics === "declared-mechanics-input-no-earned-credit" &&
    p.baselineProfileHash === context.baselineStamp.profileHash && p.manifestHash === context.manifestHash &&
    p.logicalContextHash === context.logicalContextHash && p.graphHash === context.baselineStamp.graphHash && p.ruleset === context.baselineStamp.ruleset && p.day === context.day &&
    p.sharedClosure?.status === "validated" && p.sharedClosure.scope === "transitive-permanent-deck-closure" && Array.isArray(p.sharedClosure.deckKeys) && p.sharedClosure.deckKeys.every(role),
    "missing-or-unbound-knowledge-projection");
  need(equal(p.caps, { permanent: .15, sharp: .1 }) && s.changes?.kind === "hypothetical-knowledge-input" && Array.isArray(s.changes.records) &&
    s.changes.records.length > 0 && s.changes.records.length <= row.deckKeys.length * 2, "missing-projected-input-changes");
  const records = new Map();
  for (const r of s.changes.records) {
    const id = JSON.stringify([r.deckKey, r.component]);
    need(role(r) && !records.has(id) && ["permanent", "sharp"].includes(r.component) && finite(r.from) && finite(r.to) && r.from >= 0 && r.to > r.from &&
      r.to <= p.caps[r.component] && s.profile[r.component]?.[r.deckKey] === r.to && row.deckKeys.some(d => d.deckKey === r.deckKey && d.role === r.role), "invalid-projected-input-change");
    records.set(id, r);
  }
  for (const d of row.deckKeys) {
    const h = d.componentHeadroom;
    need(role(d) && typeof d.available === "boolean" && h && unit(h.permanent) && unit(h.sharp) && h.permanent <= .15 && h.sharp <= .1 &&
      d.headroom === h.permanent + h.sharp && d.headroomSemantics === "joint-permanent-plus-sharp-input-capacity", "invalid-projected-headroom");
    let delta = 0;
    for (const component of ["permanent", "sharp"]) {
      const r = records.get(JSON.stringify([d.deckKey, component]));
      const from = r ? r.from : (s.profile[component]?.[d.deckKey] || 0);
      need(h[component] === p.caps[component] - from && (!r || r.to - r.from <= h[component]), "changed-projected-component-headroom");
      if (r) delta += r.to - r.from;
      if (r && component === "permanent") need(p.sharedClosure.deckKeys.some(c => c.deckKey === d.deckKey && c.role === d.role), "missing-shared-closure-member");
      if (r && component === "sharp") need(d.available, "inactive-sharpness-change");
    }
    need(delta > 0 && delta === d.jointDelta && delta <= d.headroom, "changed-projected-joint-headroom");
  }
}
function exposureEvidence(e, row, baseline, context) {
  need(e && e.status === "ready" && equal(e.stamp, context.baselineStamp) && e.startDistributionHash === context.startDistributionHash &&
    e.policyId === context.exposurePolicyId && e.policyId === baseline.policyId && equal(e.records, row.exposure), "missing-or-unbound-role-exposure");
  const p = e.provenance, b = e.bridgeReceipt, base = baseline.bridgeReceipt;
  need(p && p.kind === "evaluated-policy" && p.policyId === e.policyId && p.contractHash === context.baselineStamp.contractHash &&
    p.startDistributionHash === context.startDistributionHash && p.behaviorCompression === false &&
    e.stateEquivalence?.exposureLabelsPreserved !== false && p.exposureConvention === "chosen-execution-escape-input-reads-v1" &&
    p.supportHash === base.supportHash && word(p.kernelHash) && word(p.policyHash), "unvalidated-literal-label-exposure");
  need(b && equal(Object.fromEntries(Object.entries(b).filter(([k]) => !["nativeExposureStamp", "nativeExposureProvenance"].includes(k))), base) &&
    equal(b.nativeExposureStamp, base.nativeStamp), "changed-exposure-native-binding");
  const native = b.nativeExposureProvenance;
  need(native && equal({ ...native, contractHash: context.baselineStamp.contractHash, startDistributionHash: context.startDistributionHash }, p) &&
    native.contractHash === base.nativeStamp.contractHash && native.startDistributionHash === base.nativeStartDistributionHash,
    "changed-exposure-native-provenance");
  const admission = p.labelAdmission;
  need(admission?.kind === "admitted-native-label-replay" && admission.sourceSupportHash === base.supportHash && word(admission.queryHash) &&
    admission.metadataHash === base.admission.metadataHash && equal(admission.lawHashes, base.admission.lawHashes), "unadmitted-exposure-labels");
  need(Array.isArray(e.records) && e.records.length === row.deckKeys.length && row.deckKeys.every(d => {
    const matches = e.records.filter(r => r.deckKey === d.deckKey && r.role === d.role), r = matches[0];
    return matches.length === 1 && r.status === "ready" && ["hitting-probability", "expected-visits"].includes(r.kind) &&
      finite(r.value) && r.value >= 0 && (r.kind !== "hitting-probability" || r.value <= 1) &&
      r.roundedToZero !== true && (r.value !== 0 || r.exactZero === true);
  }), "missing-finite-exact-role-exposure");
}
function member(d, exposure, context) {
  const descriptor = context.decks[d.deckKey];
  need(descriptor && typeof descriptor.allowed === "boolean" && descriptor.allowed === d.available &&
    Number.isSafeInteger(descriptor.count) && descriptor.count >= 0 && finite(descriptor.headroom) &&
    Math.abs(descriptor.headroom - d.componentHeadroom.permanent) <= 1e-12, "stale-planner-deck-descriptor");
  const withheld = !d.available ? "inactive-ruleset" : descriptor.count === 0 ? "no-available-cards" :
    d.componentHeadroom.permanent === 0 ? "planner-permanent-headroom-exhausted" : exposure.value === 0 ? "zero-baseline-exposure" : null;
  return { deck: d, exposure, plannerHeadroom: d.componentHeadroom.permanent, withheld };
}
function reason(group, m, ruleset) {
  const seat = { Top: "playing on top", Bottom: "playing from bottom", Attacker: "attacking", Defender: "defending" }[m.deck.role];
  const frame = ruleset === "gi" ? "gi" : "no-gi";
  if (group.status === "uncertain") return `Not clear yet whether practising this helps when ${seat} in ${frame}.`;
  if (group.status === "non-positive") return `The comparison found no gain when ${seat} in ${frame}.`;
  return `Practising this${group.members.length > 1 ? " with its group" : ""} could win you more games when ${seat} in ${frame}.`;
}
function rankRows(groups, context) {
  const candidates = new Map();
  for (const g of groups) for (const m of g.members) {
    const d = m.deck;
    // Permanent headroom is a legacy eligibility gate, NOT the joint projected
    // capacity. Sharp-only potential at that cap remains visible in the group.
    if (!d.available || !(m.plannerHeadroom > 0) || m.withheld === "no-available-cards") continue;
    const row = { key: d.deckKey, role: d.role, groupId: g.id, headroom: m.plannerHeadroom, reason: reason(g, m, context.baselineStamp.ruleset) };
    if (g.status === "beneficial" && !m.withheld) Object.assign(row, { status: "ready", score: g.source.benefit.orderingScore,
      scoreSemantics: "joint-hypothesis-ordering-key", exposure: m.exposure.value });
    else if (g.status === "non-positive") Object.assign(row, { status: "ready", score: 0,
      scoreSemantics: "non-ranking-assessment-marker", exposure: m.exposure.value });
    else Object.assign(row, { status: g.status === "uncertain" ? "uncertain" : "unavailable", reason: m.withheld ? TEXT.limited : row.reason });
    if (!candidates.has(row.key)) candidates.set(row.key, []);
    candidates.get(row.key).push(row);
  }
  // An unavailable alternative must remain visible even if another hypothesis
  // covers this deck. It cannot silently turn an uncertain deck into exhausted.
  for (const g of groups.filter(g => g.status === "unavailable")) for (const d of g.source.deckKeys || []) {
    if (!role(d)) continue;
    if (!candidates.has(d.deckKey)) candidates.set(d.deckKey, []);
    candidates.get(d.deckKey).push({ key: d.deckKey, role: d.role, groupId: g.id, status: "unavailable", reason: TEXT.unavailable });
  }
  const priority = r => r.score > 0 ? 4 : r.status === "uncertain" ? 3 : r.status === "unavailable" ? 2 : 1;
  return [...candidates].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, rows]) => {
    rows.sort((a, b) => priority(b) - priority(a) || (b.score || 0) - (a.score || 0) || (a.groupId < b.groupId ? -1 : a.groupId > b.groupId ? 1 : 0));
    return { ...rows[0], groupIds: rows.map(r => r.groupId).sort() };
  });
}
function unavailable(stampValue, reasonValue, source = null) {
  return freeze({ kind: "learning-opportunity", stamp: stampValue, status: "unavailable", rows: [], assumptions: [TEXT.unavailable, TEXT.hypothesis],
    study: { version: NG_GAMEPLAN_STUDY_PRESENTER_VERSION, status: "unavailable", reason: reasonValue, source, groups: [], coverage: null } });
}

/**
 * {result,context,receipts,bounds} -> frozen learning-opportunity provider.
 * Context binds current planner stamp, full baseline/scenario v2 stamps, starts,
 * named baseline exposure policy, logical context/manifest/day, deck descriptors.
 * Receipts [{id,projection,evaluation,exposure}] retain the bridge/projector data
 * omitted by the frozen MDP helper. Bounds explicitly cap scenarios, decks, JSON
 * nodes and strings. Root authenticates evidence; this adapter checks joins.
 *
 * Install through setGameplanRecommendations, never ngGameplanFromModel. Root
 * must retain study.status/groups: the frozen planner drops those fields and can
 * coarsen partial coverage. It cannot enforce atomic JOINT study targets. Do not
 * replace a mounted plan or due queue when this stateless adapter returns.
 */
export function ngGameplanStudyPresent(input) {
  let job, plannerStamp = null, source = null;
  try {
    job = copyInput(input);
    const { result: r, context: c, receipts, bounds } = job;
    need(c && word(c.stamp), "missing-planner-context"); plannerStamp = c.stamp;
    source = r ? { status: r.status, coverage: r.coverage || null, unresolvedReasons: r.unresolvedReasons || [] } : null;
    need(r?.coordinator?.version === 1 && r.coordinator.hypothetical === true && ["ready", "partial", "unavailable"].includes(r.status), "missing-conservative-study-provider");
    stamp(c.baselineStamp);
    need(word(c.logicalContextHash) && word(c.manifestHash) && Number.isSafeInteger(c.day) && c.day >= 0 &&
      word(c.startDistributionHash) && word(c.exposurePolicyId) && Array.isArray(c.startDistribution) && c.startDistribution.length > 0 &&
      c.decks && typeof c.decks === "object" && !Array.isArray(c.decks) && Object.keys(c.decks).length <= bounds.maxDecks &&
      Array.isArray(c.scenarios) && c.scenarios.length > 0 && c.scenarios.length <= bounds.maxScenarios, "missing-or-over-limit-presenter-context");
    need(Object.entries(c.decks).every(([key, d]) => role({ deckKey: key, role: key.split("|")[1] }) && d &&
      typeof d.allowed === "boolean" && Number.isSafeInteger(d.count) && d.count >= 0 && finite(d.headroom) && d.headroom >= 0 && d.headroom <= .15),
      "invalid-planner-deck-descriptor");
    need(equal(r.stamp, c.baselineStamp) && equal(r.startDistribution, c.startDistribution) && r.startDistributionHash === c.startDistributionHash &&
      r.exposurePolicyId === c.exposurePolicyId && r.policySemantics === "reoptimized", "stale-study-context");
    need(Array.isArray(r.scenarios) && r.scenarios.length === c.scenarios.length && new Set(r.scenarios.map(s => s.id)).size === r.scenarios.length &&
      Array.isArray(receipts) && receipts.length <= c.scenarios.length && new Set(receipts.map(s => s.id)).size === receipts.length, "missing-or-ambiguous-study-scenarios");
    const expected = new Map();
    for (const s of c.scenarios) {
      stamp(s.stamp);
      need(word(s.id) && !expected.has(s.id) && SAME_CONTEXT.every(k => equal(s.stamp[k], c.baselineStamp[k])), "changed-logical-study-context");
      expected.set(s.id, s.stamp);
    }
    need(receipts.every(s => expected.has(s.id)) && r.scenarios.every(s => expected.has(s.id) && Array.isArray(s.deckKeys) &&
      s.deckKeys.length > 0 && s.deckKeys.length <= bounds.maxDecks && s.deckKeys.every(role) &&
      new Set(s.deckKeys.map(d => d.deckKey)).size === s.deckKeys.length && !("simulatedWinDelta" in s)), "unbound-study-scenario-set");
    const readyCount = r.scenarios.filter(s => s.status === "ready").length;
    need(r.coverage?.requestedScenarios === r.scenarios.length && r.coverage.readyScenarios === readyCount &&
      r.status === (readyCount === r.scenarios.length ? "ready" : readyCount ? "partial" : "unavailable"), "inconsistent-study-coverage");
    valueEvidence(r.baseline, c.baselineStamp, c.startDistributionHash);
    need(r.baseline.policyId === c.exposurePolicyId, "exposure-policy-is-not-baseline-policy");
    const groups = r.scenarios.map(row => {
      const receipt = receipts.find(s => s.id === row.id) || null;
      const g = { id: row.id, status: "unavailable", source: row, receipts: receipt, members: [] };
      try {
        need(row.status === "ready", row.reason || "study-scenario-unavailable");
        need(receipt && equal(row.stamp, expected.get(row.id)) && row.profileHash === row.stamp.profileHash, "missing-or-stale-scenario-receipts");
        valueEvidence(receipt.evaluation, expected.get(row.id), c.startDistributionHash);
        need(receipt.evaluation.bridgeReceipt.runtimeHash === r.baseline.bridgeReceipt.runtimeHash &&
          equal(receipt.evaluation.bridgeReceipt.admission, r.baseline.bridgeReceipt.admission), "changed-study-runtime-or-source-admission");
        need(row.baselinePolicyId === r.baseline.policyId && row.scenarioPolicyId === receipt.evaluation.policyId &&
          equal(row.outcomes, receipt.evaluation.outcomes), "changed-scenario-common-policy");
        projectionEvidence(receipt.projection, row, c);
        exposureEvidence(receipt.exposure, row, r.baseline, c);
        const status = benefitEvidence(row.benefit, r.baseline, receipt.evaluation);
        g.members = row.deckKeys.map(d => member(d, row.exposure.find(e => e.deckKey === d.deckKey && e.role === d.role), c));
        g.status = status;
      } catch (error) { g.reason = error.message; }
      return g;
    });
    const rows = rankRows(groups, c);
    const eligible = Object.entries(c.decks).filter(([, d]) => d.allowed && d.count > 0 && d.headroom > 0).map(([key]) => key).sort();
    const assessed = new Set(rows.filter(r => r.status === "ready").map(r => r.key));
    const coverage = { requestedScenarios: groups.length, validatedScenarios: groups.filter(g => g.status !== "unavailable").length,
      beneficialScenarios: groups.filter(g => g.status === "beneficial").length, uncertainScenarios: groups.filter(g => g.status === "uncertain").length,
      nonPositiveScenarios: groups.filter(g => g.status === "non-positive").length, unavailableScenarios: groups.filter(g => g.status === "unavailable").length,
      rankedDecks: rows.filter(r => r.score > 0).length, eligibleDecks: eligible.length, assessedDecks: eligible.filter(key => assessed.has(key)).length,
      unassessedDeckKeys: eligible.filter(key => !assessed.has(key)),
      withheldBeneficialMembers: groups.filter(g => g.status === "beneficial").reduce((n, g) => n + g.members.filter(m => m.withheld).length, 0) };
    const secondaryUnresolved = groups.some(g => [g.source.benefit?.baseline?.quality, g.source.benefit?.scenario?.quality].some(q =>
      q && [q.secondaryStatus, q.tertiaryStatus].some(s => typeof s === "string" && /unresolved|unavailable|partial/.test(s))));
    const partial = r.status !== "ready" || coverage.unavailableScenarios > 0 || coverage.uncertainScenarios > 0 || coverage.withheldBeneficialMembers > 0 || coverage.unassessedDeckKeys.length > 0;
    const status = !coverage.validatedScenarios ? "unavailable" : partial ? "partial" : "ready";
    const assumptions = [TEXT.hypothesis, TEXT.joint, `The comparison uses the same starting positions and roles and opponent in ${c.baselineStamp.ruleset === "gi" ? "gi" : "no-gi"}, ${c.baselineStamp.horizon.kind === "actual-roll" ? "with the same remaining game time" : "without a game-time limit"}.`,
      ...(partial ? [TEXT.partial] : []), ...(coverage.withheldBeneficialMembers ? [TEXT.limited] : []), ...(secondaryUnresolved ? [TEXT.secondary] : [])];
    const { decks, ...context } = c;
    return freeze({ kind: "learning-opportunity", stamp: plannerStamp, status, rows, assumptions,
      study: { version: NG_GAMEPLAN_STUDY_PRESENTER_VERSION, status, context, source: { ...source, coordinator: r.coordinator }, baseline: r.baseline,
        groups, coverage, secondaryUnresolved, orderingSemantics: "positive-conservative-joint-lower-only", selectionSemantics: "individual-decks-not-atomic-joint-targets" } });
  } catch (error) { return unavailable(plannerStamp, error.message, source); }
}
