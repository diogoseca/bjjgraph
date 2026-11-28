// Shared simulator arithmetic. No DOM, storage, clock reads or random draws.
// These are existing GAME rewards, not calibrated effects of studying on grappling.
// Host evidence (question history) stays outside the compact worker profile.
export const NG_KNOWLEDGE_VERSION = 1;
export const NG_KNOWLEDGE_STUDY_POLICY = "no-additional-study-events";
// THE STORED CELL's rungs: the seven-rung ladder every client until v1.279.0 schedules by. A row's interval cell is
// always one of these (the largest at or below its true interval, below), so an older client's `indexOf` always finds
// a rung and its right answer climbs from there, never back to 1 day. The schedule itself is NG_KNOWLEDGE_LADDER.
export const NG_KNOWLEDGE_INTERVALS = Object.freeze([1, 3, 7, 14, 30, 60, 120]);
// THE LADDER (v1.279.0, the owner, 13 Nov 2026: "1 day, then … 3 days … 1 week, then … 2 weeks, 1 month, 2 months,
// 3 months, 6 months, 1 year, then every 2^n years thereon"; ruled SRS-GO): 1, 3, 7, 14, 30, 60, 90, 180, 365, 730,
// 1461, 2922 days, then (v1.305.0, LATE2) THE FITTED CURVE: each rung past 2,922 is C(the one before), rounded to a whole
// day, C(x) = x × (1 + (4 years ÷ x)^(1/6)): 5,525, 9,951, 17,179, 28,571 … (15.1, 27.2, 47, 78 years), 24 rungs as before.
// A card may sit BETWEEN two rungs (the research's frame, reports kept outside the repo): its place is read from its true
// interval on a log scale, so halfway from 30 to 60 days is 42.4, not 45. Between two rungs the step runs in a straight
// line (`ngKnowledgeStep`), so past 4 years it sits within 1.8% under the exact curve (tests/schedule_late.test.mjs).
// THE TOP (v1.305.0, LATE2; the owner, 28 Nov 2026, card U226 a: "The fitted curve: power 1/6"; the study it was ruled on,
// SAT1, is kept outside the repo): past 4 years a right answer's multiple falls from 2 as (4 years ÷ x)^(1/6), for the
// ladder's own rungs and for a late answer alike (`ngKnowledgeLate`), so the wait grows for ever, a little slower than
// doubling: on time 4 years → 8 → 15.1 → 27.2 → 47 years. Both numbers are HIS, and the reasons are at each:
// the start, 4 years (1,461 days): his last named doubling step is kept, 4 years → 8 (C(1461) = 2 × 1461 = 2,922)
export const NG_KNOWLEDGE_TOP_FROM = 1461;
// the power, 1/6: FSRS-6's fitted rate of fall (its gain after a right answer falls as S^(−w9), w9 = 0.1666 in its fitted defaults)
export const NG_KNOWLEDGE_TOP_POWER = 1 / 6;
// THE CURVE, C(x) = x × (1 + (4 years ÷ x)^(1/6)): read only to make the rungs, each rounded to a whole day, so the
// ECMAScript engine's own Math.pow (not bound to be the same in every browser) never reaches a stored number
export function ngKnowledgeCurve(x) { return x * (1 + Math.pow(NG_KNOWLEDGE_TOP_FROM / x, NG_KNOWLEDGE_TOP_POWER)); }
export const NG_KNOWLEDGE_LADDER = Object.freeze((() => {
  const L = [1, 3, 7, 14, 30, 60, 90, 180, 365, 730, 1461, 2922];
  while (L.length < 24) L.push(Math.round(ngKnowledgeCurve(L[L.length - 1])));
  return L;
})());

function ngKnowledgeOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
function ngKnowledgeClone(v) {
  if (Array.isArray(v)) return v.map(ngKnowledgeClone);
  if (v && typeof v === "object") {
    // Define keys rather than assigning them: legacy/imported deck names are data,
    // including __proto__. Sorting also makes serialization independent of insertion.
    const out = {};
    for (const k of Object.keys(v).sort()) Object.defineProperty(out, k, {
      value: ngKnowledgeClone(v[k]), enumerable: true, writable: true, configurable: true,
    });
    return out;
  }
  return v;
}
function ngKnowledgeFreeze(v) {
  if (v && typeof v === "object" && !Object.isFrozen(v)) {
    for (const k of Object.keys(v)) ngKnowledgeFreeze(v[k]);
    Object.freeze(v);
  }
  return v;
}
function ngKnowledgeRead(map, key, fallback = 0) {
  return map && ngKnowledgeOwn(map, key) ? map[key] : fallback;
}
// A deterministic, non-cryptographic content identity, not an authentication token.
// Revision is also stamped: a replace/reset with identical odds still invalidates work.
export function ngKnowledgeFingerprint(value) {
  const s = JSON.stringify(ngKnowledgeClone(value), (_k, v) =>
    typeof v === "number" && !Number.isFinite(v) ? { nonFinite: String(v) } : v);
  let a = 2166136261, b = 3335557771;
  for (let i = 0; i < s.length; i++) {
    a = Math.imul(a ^ s.charCodeAt(i), 16777619);
    b = Math.imul(b ^ s.charCodeAt(i), 2246822519);
  }
  return "k" + NG_KNOWLEDGE_VERSION + ":" + s.length + ":" +
    (a >>> 0).toString(16).padStart(8, "0") + (b >>> 0).toString(16).padStart(8, "0");
}

// Arithmetic is deliberately not normalized/clamped beyond the previous live law.
// Boundary tests compare the captured prior methods, including unusual finite inputs.
export function ngKnowledgeMastery(count) { return Math.min(0.15, 0.03 * (count || 0)); }
export function ngKnowledgeSharpAfter(value, arrivals = 0) {
  if (!Number.isSafeInteger(arrivals) || arrivals < 0) throw new RangeError("Invalid arrival age");
  let sharp = value || 0;
  if (!arrivals) return sharp;
  // The first step rounds arbitrary imported inputs. Later steps are integer mills;
  // compressing those steps is exactly equivalent and cannot loop on a huge age.
  sharp = Math.round((sharp - 0.025) * 1000) / 1000;
  if (sharp <= 0) return 0;
  return Math.max(0, (Math.round(sharp * 1000) - 25 * (arrivals - 1)) / 1000);
}
export function ngKnowledgeMomentum(combo) {
  return Math.min(0.10, Math.max(0, (Math.min(combo || 0, 5) - 1) * 0.025));
}
export function ngKnowledgeSkew(combo) {
  return Math.min(0.40, Math.max(0, (Math.min(combo || 0, 5) - 1) * 0.10));
}
export function ngKnowledgeOverride(userMods, act) {
  if (!userMods) return null;
  const m = userMods.find((x) => x.on && x.name === act.t);
  return m ? Math.max(0.05, Math.min(0.95, m.pct / 100)) : null;
}
// THE TECHNIQUE AS PLAYED FROM ONE LISTING (v1.214.0, origin coherence PR B). A transition dealt at an
// away listing may carry that listing's own table on the wire, `cal.at[posId]` = {successRate,
// successRateByRuleset, outcomes}, because its canonical table, written for its origin, would send
// a miss back to the origin. This returns the node with those three fields overlaid and `here` set,
// or THE NODE ITSELF when the move has no table at `hereId`, so a corpus without listing tables reads
// exactly as before. ONE implementation for the app (`_at`), the adapter (`actAt`) and FLOW; its
// Python twins are solve_edge_values.listing_view (graph.json) and _mdp_mechanics.cal_at (the wire).
export function ngKnowledgeCalAt(node, hereId) {
  const at = node && node.cal && node.cal.at && hereId != null ? node.cal.at[hereId] : null;
  if (!at) return node;
  return { ...node, here: hereId, cal: { ...node.cal, successRate: at.successRate,
    successRateByRuleset: at.successRateByRuleset, outcomes: at.outcomes } };
}
export function ngKnowledgeCalibrated(act, ruleset) {
  const c = act && act.cal;
  if (!c) return { chance: null, provenance: "missing-calibration", explicitNull: false };
  const br = c.successRateByRuleset;
  const selected = br && ruleset && br[ruleset] != null;
  const v = selected ? br[ruleset] : c.successRate;
  const explicitNull = !!(br && ruleset && ngKnowledgeOwn(br, ruleset) && br[ruleset] === null);
  return {
    chance: typeof v === "number" ? Math.max(0, Math.min(1, v / 100)) : null,
    provenance: selected ? "ruleset-calibration" : explicitNull ? "legacy-null-scalar-fallback" :
      typeof v === "number" ? "legacy-scalar-calibration" : "missing-calibration",
    explicitNull,
  };
}
export function ngKnowledgeMoveChance({ override = null, calibrated = null, type, dominance,
  positionBonus = 0, techniqueBonus = 0, film = false, opponentValue = 0,
  aiSkill = 0, qMod = 0, momentum = 0 }) {
  if (override != null) return override;
  const base = calibrated != null ? calibrated : (type === "submissions" ? 0.36 : 0.56) + dominance * 0.1;
  const playerMod = positionBonus + techniqueBonus + (film ? 0.04 : 0);
  const aiMod = Math.max(0, opponentValue) * 0.4 + (aiSkill || 0);
  return Math.max(0.05, Math.min(0.95, base + playerMod - aiMod + (qMod || 0) + momentum));
}
export function ngKnowledgeEscapeChance({ valid = true, calibrated = null,
  destinationValue = 0, submissionValue = 0, defenseBonus = 0, aiSkill = 0, momentum = 0 }) {
  if (!valid) return 0;
  const base = calibrated != null ? 1 - calibrated : 0.4;
  return Math.max(0.08, Math.min(0.92, base + (destinationValue - submissionValue) * 0.15 +
    defenseBonus - (aiSkill || 0) + momentum));
}
export function ngKnowledgeOutcomeWeights(act, branch, skew = 0) {
  const all = act && act.cal && Array.isArray(act.cal.outcomes) ? act.cal.outcomes : null;
  if (!all || !all.length) return { outcomes: [], weights: [], total: 0, drawRequired: false, fallback: "missing-outcomes" };
  let outcomes = all, fallback = null;
  if (branch != null) {
    const sub = all.filter((o) => (o.result === "success") === !!branch);
    if (sub.length) outcomes = sub; else fallback = "empty-branch";
  }
  const weights = outcomes.map((o) => {
    let v = Math.max(0, +o.probability || 0);
    if (skew > 0 && o.result === "counter") v *= 1 - skew;
    return v;
  });
  let total = 0;
  for (const w of weights) total += w;
  return { outcomes, weights, total, drawRequired: !(total <= 0), fallback: total <= 0 ? "zero-weight" : fallback };
}
export function ngKnowledgePickOutcome(table, unitDraw) {
  if (!table.outcomes.length) return null;
  if (!table.drawRequired) return table.outcomes[0];
  let r = unitDraw * table.total;
  for (let i = 0; i < table.outcomes.length; i++) {
    r -= table.weights[i];
    if (r <= 0) return table.outcomes[i];
  }
  return table.outcomes[table.outcomes.length - 1];
}

export function ngKnowledgeBuildProfile(input) {
  const i = input || {}, diagnostics = [];
  if (input == null) diagnostics.push("missing-profile");
  const permanent = {};
  for (const k of Object.keys(i.prep || {}).sort()) Object.defineProperty(permanent, k, {
    value: ngKnowledgeMastery(i.prep[k]), enumerable: true, writable: true, configurable: true,
  });
  const data = ngKnowledgeClone({ version: NG_KNOWLEDGE_VERSION, revision: i.revision || 0,
    contentRevision: i.contentRevision || "", evidenceRevision: i.evidenceRevision || "",
    day: i.day || 0, studyPolicy: NG_KNOWLEDGE_STUDY_POLICY, permanent,
    sharp: i.sharp || {}, userMods: i.userMods || [], filmLook: i.filmLook || {}, flowCounts: i.flowCounts || {} });
  for (const name of ["permanent", "sharp"]) for (const k of Object.keys(data[name])) {
    if (typeof data[name][k] !== "number" || !Number.isFinite(data[name][k])) diagnostics.push("invalid-" + name + ":" + k);
  }
  if (!Array.isArray(data.userMods)) diagnostics.push("invalid-overrides");
  else for (const m of data.userMods) if (!m || (m.on && !Number.isFinite(Number(m.pct)))) diagnostics.push("invalid-override");
  if (!Number.isSafeInteger(data.revision) || data.revision < 0) diagnostics.push("invalid-revision");
  data.status = diagnostics.length ? "unavailable" : "ready";
  data.diagnostics = diagnostics;
  data.fingerprint = ngKnowledgeFingerprint(data);
  return ngKnowledgeFreeze(data);
}
export function ngKnowledgeBonus(profile, deckKey, arrivalAge = 0) {
  if (!profile || profile.status !== "ready") return { mastery: null, sharp: null, total: null };
  const mastery = deckKey ? ngKnowledgeRead(profile.permanent, deckKey) : 0;
  const sharp = deckKey ? ngKnowledgeSharpAfter(ngKnowledgeRead(profile.sharp, deckKey), arrivalAge) : 0;
  return { mastery, sharp, total: mastery + sharp };
}
export function ngKnowledgeProject(profile, context = {}, arrivals = 0) {
  if (!Number.isSafeInteger(arrivals) || arrivals < 0) throw new RangeError("Invalid arrivals");
  const arrivalAge = (context.arrivalAge || 0) + arrivals;
  if (!Number.isSafeInteger(arrivalAge) || arrivalAge < 0) throw new RangeError("Invalid arrival age");
  return ngKnowledgeFreeze({ ...ngKnowledgeClone(context), arrivalAge,
    qMod: arrivals ? 0 : context.qMod || 0, combo: context.combo || 0,
    profileFingerprint: profile && profile.fingerprint });
}
export function ngKnowledgeAdvance(context, event) {
  const c = { ...ngKnowledgeClone(context) };
  const surface = event.surface || "land";
  // Only the landing onDone owns gameplay question rewards. Deck/JIT/panic MC
  // grades change evidence, but never earn momentum. The panic drill is the one
  // other surface that costs it: a wrong answer and an expiry both break combo,
  // without the landing's question penalty (the drill since v1.221.0, PR #272).
  if (["mc-correct", "recall-correct"].includes(event.type) && surface !== "land") return ngKnowledgeFreeze(c);
  if ((event.type === "wrong" || event.type === "expiry") && surface !== "land" && surface !== "panic") return ngKnowledgeFreeze(c);
  switch (event.type) {
    case "arrival": c.qMod = 0; c.arrivalAge = (c.arrivalAge || 0) + (event.first ? 0 : 1); break;
    case "commit": c.questionPending = false; break;
    case "mc-correct": c.combo = (c.combo || 0) + 1; c.questionPending = false; break;
    case "recall-correct": c.questionPending = false; break;
    case "wrong": case "expiry":
      // The panic drill only breaks momentum. It never applies qMod.
      if (event.surface !== "panic") c.qMod = (c.qMod || 0) - (event.type === "wrong" && event.tier === "trap" ? 0.08 : 0.04);
      c.combo = 0; c.questionPending = false; break;
    case "new-roll": c.arrivalAge = 0; c.combo = 0; c.qMod = 0; c.questionPending = false; break;
    default: throw new Error("Unknown knowledge event: " + event.type);
  }
  return ngKnowledgeFreeze(c);
}

function ngKnowledgeComponents(profile, keys, age) {
  const out = [];
  for (const deckKey of keys) {
    if (!deckKey) continue;
    const b = ngKnowledgeBonus(profile, deckKey, age);
    const role = deckKey.slice(deckKey.lastIndexOf("|") + 1);
    out.push({ deckKey, role, source: "practice", bonus: b.mastery },
      { deckKey, role, source: "sharpness", bonus: b.sharp });
  }
  return out;
}
function ngKnowledgeUnavailable(reason) {
  return { status: "unavailable", reason, knowledge: { status: "unavailable", components: [], reason } };
}
export function ngKnowledgeExplainMove(profile, context, act) {
  if (!profile || profile.status !== "ready") return ngKnowledgeUnavailable("missing-or-invalid-profile");
  if (!act || !context || !context.techniqueKey || (!context.positionKey && context.noPositionBonus !== true) || !Number.isFinite(context.opponentValue)) return ngKnowledgeUnavailable("missing-move-context");
  const age = context.arrivalAge || 0, cal = ngKnowledgeCalibrated(act, context.ruleset);
  const override = ngKnowledgeOverride(profile.userMods, act);
  const p = ngKnowledgeBonus(profile, context.positionKey, age), t = ngKnowledgeBonus(profile, context.techniqueKey, age);
  const input = { override, calibrated: cal.chance, type: act.ty, dominance: act.dom,
    positionBonus: p.total, techniqueBonus: t.total, film: ngKnowledgeRead(profile.filmLook, act.t),
    opponentValue: context.opponentValue, aiSkill: context.aiSkill, qMod: context.qMod,
    momentum: ngKnowledgeMomentum(context.combo) };
  const chance = ngKnowledgeMoveChance(input);
  const comparison = ngKnowledgeMoveChance({ ...input, positionBonus: 0, techniqueBonus: 0 });
  if (!Number.isFinite(chance)) return ngKnowledgeUnavailable("invalid-move-arithmetic");
  const base = cal.chance != null ? cal.chance : (act.ty === "submissions" ? 0.36 : 0.56) + act.dom * 0.1;
  const raw = base + (p.total + t.total + (input.film ? 0.04 : 0)) -
    (Math.max(0, context.opponentValue) * 0.4 + (context.aiSkill || 0)) +
    (context.qMod || 0) + input.momentum;
  return ngKnowledgeFreeze({ status: "ready", chance, base, provenance: cal.chance == null ? "dominance-fallback" : cal.provenance,
    override, knowledge: { status: override != null ? "bypassed" : "applied",
      components: ngKnowledgeComponents(profile, [context.positionKey, context.techniqueKey], age),
      ...(override != null ? { reason: "absolute-probability-override" } : {}) },
    comparison: { kind: "same-context-no-knowledge", chance: comparison, effectiveDelta: chance - comparison },
    clamp: { min: 0.05, max: 0.95, applied: override == null && raw !== chance } });
}
export function ngKnowledgeExplainEscape(profile, context, sub) {
  if (!profile || profile.status !== "ready") return ngKnowledgeUnavailable("missing-or-invalid-profile");
  const key = context && (context.panicKey || context.defenderKey);
  if (!sub || !key || !Number.isFinite(context.destinationValue) || !Number.isFinite(context.submissionValue)) return ngKnowledgeUnavailable("missing-defense-context");
  if (!context.panicKey && context.defenderKey !== sub.t + "|Defender") return ngKnowledgeUnavailable("incorrect-defender-identity");
  const age = context.arrivalAge || 0, cal = ngKnowledgeCalibrated(sub, context.ruleset);
  const b = ngKnowledgeBonus(profile, key, age);
  const input = { calibrated: cal.chance, destinationValue: context.destinationValue,
    submissionValue: context.submissionValue, defenseBonus: b.total, aiSkill: context.aiSkill,
    momentum: ngKnowledgeMomentum(context.combo) };
  const chance = ngKnowledgeEscapeChance(input);
  const comparison = ngKnowledgeEscapeChance({ ...input, defenseBonus: 0 });
  if (!Number.isFinite(chance)) return ngKnowledgeUnavailable("invalid-escape-arithmetic");
  const base = cal.chance == null ? 0.4 : 1 - cal.chance;
  const raw = base + (context.destinationValue - context.submissionValue) * 0.15 + b.total -
    (context.aiSkill || 0) + input.momentum;
  return ngKnowledgeFreeze({ status: "ready", chance, base, provenance: cal.chance == null ? "escape-fallback" : cal.provenance,
    knowledge: { status: "applied", components: ngKnowledgeComponents(profile, [key], age) },
    comparison: { kind: "same-context-no-knowledge", chance: comparison, effectiveDelta: chance - comparison },
    clamp: { min: 0.08, max: 0.92, applied: raw !== chance } });
}

// Read-side rolling window: never erase persisted G-counter partitions to expire a view.
export function ngKnowledgeFlowCounts(flow, day, windowDays = 180) {
  const counts = {};
  for (const device of Object.values(flow || {})) for (const pk of Object.keys(device)) {
    for (const ord of Object.keys(device[pk])) {
      const row = device[pk][ord];
      if ((row[2] || 0) < day - windowDays) continue;
      if (!ngKnowledgeOwn(counts, pk)) Object.defineProperty(counts, pk, { value: {}, enumerable: true });
      const table = counts[pk];
      if (!ngKnowledgeOwn(table, ord)) Object.defineProperty(table, ord, { value: [0, 0], enumerable: true });
      table[ord][0] += row[0] || 0; table[ord][1] += row[1] || 0;
    }
  }
  return ngKnowledgeFreeze(counts);
}

export function ngKnowledgeQuestionHash(q) {
  let h = 0x811c9dc5;
  const s = String(q || "");
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return ("0000000" + h.toString(16)).slice(-8);
}
// A CARD'S KEY (CARD1-S2, v1.303.0): its stable key `k` when the wire carries one (a card whose question was reworded keeps
// the key of the text it replaced; the emitter writes `k` only when it differs from the text's hash), else the FNV-1a of
// its question. The app's `cardKey` and the emitter's `_card_key` are the same rule. With no `k` on any card (no content
// file carries an `id` yet), every key is the text's hash, as before. The MDP reads no card: this moves no game value.
export function ngKnowledgeCardKey(card) {
  if (card && typeof card === "object") return typeof card.k === "string" && /^[0-9a-f]{8}$/.test(card.k) ? card.k : ngKnowledgeQuestionHash(card.q);
  return ngKnowledgeQuestionHash(card);
}
function ngKnowledgePut(map, key, value) {
  Object.defineProperty(map, key, { value, enumerable: true, writable: true, configurable: true });
  return value;
}
function ngKnowledgeBucket(map, key) {
  return ngKnowledgeOwn(map, key) ? map[key] : ngKnowledgePut(map, key, {});
}
export function ngKnowledgeBuildEvidence(input = {}) {
  // These are legacy persisted fields, not a new storage format. Attempts and
  // creditedQuestions are host-session latches; do not sync them across devices.
  return ngKnowledgeFreeze(ngKnowledgeClone({ version: NG_KNOWLEDGE_VERSION,
    revision: input.revision || 0, subject: input.subject || "local",
    contentRevision: input.contentRevision || "", prep: input.prep || {},
    stage: input.stage || {}, rec: input.rec || {}, srs: input.srs || {},
    sharp: input.sharp || {}, days: input.days || {},
    creditedQuestions: input.creditedQuestions || [], attempts: input.attempts || {} }));
}
// `card` is the card (keyed by `ngKnowledgeCardKey`), or (an older caller) its question's text
export function ngKnowledgeSharedDecks(manifest, card, key) {
  const m = manifest || {}, qh = ngKnowledgeCardKey(card);
  if (m.shared != null) {
    const list = m.shared instanceof Map ? m.shared.get(qh) : ngKnowledgeRead(m.shared, qh, null);
    return list && list.length > 1 && list.includes(key) ? [...new Set(list)] : [];
  }
  // Explicit legacy fallback, only for old manifests with no sharing index.
  const list = [];
  for (const [dk, d] of Object.entries(m.decks || {})) {
    const cards = Array.isArray(d) ? d : d && d.cards;
    if (cards && cards.some((c) => c && c.q && ngKnowledgeCardKey(c) === qh)) list.push(dk);
  }
  return list.length > 1 ? list : [];
}
// THE SCHEDULE (v1.281.3, LIN2: the owner's own formula, U188, on the ladder's own lines; v1.281.0, LIN1, carried the credit
// exactly; the ladder and the rest as ruled at v1.279.0, SRS-GO).
// A row is [due, cell, last day] (a move's adds its answer at [3]), plus THE PAIR [A, t0] right after (srs [3], moves [4])
// while the row's exact interval is not its own whole one: either a RUNG PAIR, the rung A the card's line starts from and t0
// the day the card stood on it (an early answer stores this), or a step anchored at its own day, [the exact interval, last]
// (an on-time or late answer between rungs stores this, as v1.281.0 did). A row written by any older client has no pair and
// reads as anchored at its own last, so nothing stored is rewritten. A row the late rule stretched past one step carries,
// after the pair's slot ([0, 0] there when it has no pair), THE LATE MARK [R, I, L] for the rating (v1.305.0, `ngKnowledgeMark`
// below); the schedule never reads it. NOTHING IS ROUNDED (v1.281.3): the numbers stored are the
// numbers computed, a JSON number reads back as itself, and every due is the rule's in exact arithmetic (pinned in fractions).
//   · THE RULE, as a player could read it: A CARD CLIMBS ITS STEP AT A STEADY PACE: EACH DAY YOU WAITED BEFORE ANSWERING RIGHT
//     EARNS THE SAME SHARE OF THE STEP, WHENEVER YOU ANSWER. The owner's formula (15 Nov 2026: next = (interval − days left) ×
//     ratio + days left, ratio = next step ÷ this step) with the ratio of THE STEP THE CARD IS IN, at every answer: a card
//     between rungs r < x < next stands on r's line, (x − r) × r ÷ (next − r) days into r's step (`ngKnowledgeOnRung`), and its
//     interval w days into a rung's step is r + w × (next − r) ÷ r (`ngKnowledgeLinear` on a rung). As a level: a real number
//     climbing 1 ÷ (its rung's interval) a day, at most one level per EARLY answer (a late one: below, LATE1, LATE2). His numbers, pinned in
//     tests/schedule_ladder.test.mjs: a 30-day card answered 1 day before its due comes due 59 days on, 29 days before it 31,
//     on time 60; and his own check (U193): day 15 gives 45, then day 30 (a 45-day gap, 30 days left) gives 60.
//   · v1.281.0 drew ONE straight line from a card's own interval, A + w × (step(A) − A) ÷ A; the two differ only where it stored
//     an anchor off the rungs. Its rows read as they did (the same interval), and go on from there on their rung's line.
//   · WHAT THAT BUYS, pinned over the reader's own searches in tests/schedule_rung.test.mjs: AN EARLY RIGHT ANSWER NEVER LEAVES A
//     CARD DUE SOONER THAN WITHOUT IT (v1.281.0 lost up to 39 days in 4,196 of 1,123,024 comparisons: now 0), and a card can end
//     ahead of answering on time ONLY BY WHOLE DAYS, NEVER IN EXACT DAYS: the on-time path answers on whole due days, a fraction
//     of a day after its exact due, and restarts there, while early answers ride the line exactly. In the reader's early-only
//     search that is at most 3 days (839 of 566,832 prefixes, against v1.281.0's 1,150 by up to 10; early, on time, then early:
//     0 of 40,536, against 63); it adds up, about a day per on-time answer compared, as a card ages (the reader of PR #426: 5
//     within five years, 12 near the top of the ladder), and is 0 in exact days throughout. ITS
//     ONE TRADE-OFF: a card between rungs earns less early credit in the first part of its wait and more later (a 75-day card
//     answered on day 28: 89 days, where v1.281.0's line gave 98; a 42-day card on day 18: 60, against 55); at the due the
//     two agree (one step).
//   · THE STEP IS TAKEN WHEN THE DAYS REACH IT, and an EARLY answer takes AT MOST ONE STEP from where the previous answer left
//     it (until v1.305.0 every answer did; a late one now earns more, below). Early, the card walks rung after rung (each rung crossed moves the pair on: A ← the next rung, t0 ← t0 + A) and takes
//     the line there; on those lines the line is one step up exactly at the exact due, so below the top an early answer never
//     reaches the cap (`ngKnowledgeEarly`'s cap binds only at and past the top, where a step is the top). AN ANSWER ON OR AFTER
//     THE DUE takes HIS LATE RULE's interval (`ngKnowledgeLate`, v1.305.0: LATE1, the owner's rule, 25 Nov 2026, ruled U223 b;
//     its final form LATE2, 28 Nov 2026, U226 a): max(one step, t × min(step ÷ I, C(t) ÷ t)), t the days since the last answer,
//     I the interval it reads, C(t) ÷ t = 2 up to 4 years and the fitted curve's past them. One step is the floor (day 29 → 59
//     days; on that due, 89; a day before it, 88.5); ON ITS DUE DAY IT IS EXACTLY ONE STEP, so an on-time card lands on his
//     named rungs (60 → 90; LATE1's first form, max(step, 2t), sent it to 120 and every on-time step after that a third above
//     his rungs), and every later day earns more: twice the wait wherever his step at least doubles (a 30-day card 10 days
//     late: 80, where one step gave 60), the step's own multiple of it where it does not (the 60-day card a day late: 1.5 × 61,
//     91.5), past 4 years the ladder's own step for the days waited. A card between whole days, answered on its whole due day,
//     is late by the part of a day its exact due falls before it, and is paid that part day at the step's own rate (60.5 days
//     → 92.26 on its due day, where one step is 91.5). Until v1.305.0 LATE EARNED ONE STEP AND NO MORE: the formula's negative
//     "days left" would pay a late bonus (10 days late: 70), measured out at v1.279.0 (ANKI1: with a backlog the bonus cost 7
//     to 15 points of true recall); the owner's rule was measured again before it was ruled (LATE1, Part A: it saves 1 to 3% of
//     reviews and costs about a point of recall at each review on the cards answered late; SAT1 for the top). THE LATE RULE
//     COUNTS THE WAIT FROM THE LAST ANSWER, so an early answer restarts it: an extra early answer can leave a card due sooner,
//     after a later late answer, than without it (never below one step from where it left the card, and never on a due day,
//     where the rule is one step; pinned in tests/schedule_rung.test.mjs and tests/schedule_linear.test.mjs). Dropping the
//     days past the step (LIN1's first draft) made an answer a day before the due earn almost nothing on a card between
//     steps; NO CLIFF since: a day later never earns less, the due day included, and no jump at the due.
//   · AN EARLY ANSWER WITH NO DAY WAITED (on the row's own last day, or a clock set back) leaves the level where it is and keeps
//     the pair exactly as stored, so a second answer the same day rewrites nothing.
//   · BETWEEN TWO RUNGS the interval sits on the straight line between them (`ngKnowledgeStep`: one step from 120 days, a third
//     of the way from 90 to 180, is a third of the way from 180 to 365, 241.67). From a rung every interval is exact (A and
//     B whole; the numerator is multiplied first).
//   · THE DUE stays a whole day, the first at or after the exact due (`ngKnowledgeDueDay`), so every reader of `due`, every
//     older client's due count and the "answered today" tests are unchanged. The exact interval is recomputed from the
//     pair at each answer, so nothing rounds per answer.
//   · THE PAIR CHECKS ITSELF (`ngKnowledgeAnchor`): it is read only if t0 ≤ last, last − t0 < A, and it reproduces the
//     row's due day. Otherwise the row reads as its own: anchored at its last, interval max(cell, due − last). That covers
//     a clamped pull (a fast clock), an older client's merge (it drops the pair), and an older moves writer that kept a
//     stale pair behind its own new due (v1.255.0 to v1.280.2).
//   · THE CELL (`row[1]`) is the largest rung of NG_KNOWLEDGE_INTERVALS at or below the exact interval
//     (`ngKnowledgeCell`), what an older client reads: its right answer climbs ITS ladder from the cell (a full rung,
//     capped at 120 days) and never goes back to 1 day.
//   · A MISS, or a first answer: 1 day (the owner: "otherwise goes back to 1 day until it progresses").
//   · A right answer NEVER makes a card due sooner: the exact due only rises (`Math.max` with the old due day guards it),
//     and THE WRITER NEVER MOVES `last` BACKWARD (SRS-R1, finding 4): an answer on a day before the row's last (a clock
//     set back) is filed on that last, so w is never negative.
//   · The pull's clamp (last ≤ today, `ngKnowledgeMergeRow`) can lengthen a fast clock's row by as many days as that clock
//     ran ahead (SRS-R1, finding 4), never shorten it; its pair then fails its check and the row reads as its own.
const NG_KNOWLEDGE_EPS = 1e-6;
export function ngKnowledgeDueDay(x) { return Math.ceil(x - NG_KNOWLEDGE_EPS); }
export function ngKnowledgeCell(ivl) {
  let c = NG_KNOWLEDGE_INTERVALS[0];
  for (const r of NG_KNOWLEDGE_INTERVALS) if (r <= ivl) c = r;
  return c;
}
// one step on from `ivl`: a rung's next rung, or the same place on the next stretch of the straight line; the top holds
export function ngKnowledgeStep(ivl) {
  const L = NG_KNOWLEDGE_LADDER, n = L.length - 1, x = Math.max(L[0], ivl);
  for (let i = 0; i < n; i++) {
    if (x < L[i + 1]) return i + 1 >= n ? L[n] : x === L[i] ? L[i + 1] : L[i + 1] + ((x - L[i]) * (L[i + 2] - L[i + 1])) / (L[i + 1] - L[i]);
  }
  return L[n];
}
// the interval w days into the step from A (0 ≤ w < A), linear: A + w × (B − A) ÷ A
export function ngKnowledgeLinear(A, w) { return A + (w * (ngKnowledgeStep(A) - A)) / A; }
function ngKnowledgeRowOk(r) { return Array.isArray(r) && r.length >= 3 && Number.isFinite(r[0]) && Number.isFinite(r[1]) && Number.isFinite(r[2]); }
function ngKnowledgeOwnInterval(row) {
  const t = row[0] - row[2], c = Number.isFinite(row[1]) && row[1] >= 1 ? row[1] : 1;
  return Number.isFinite(t) ? Math.max(c, t) : c;
}
// THE ROW'S EXACT STATE {A, t0, ivl}: from its pair at `at` (3 on an srs row, 4 on a moves row) when the pair checks
// itself against the row, otherwise anchored at its own last with its own interval
export function ngKnowledgeAnchor(row, at = 3) {
  const last = row[2], A = row[at], t0 = row[at + 1];
  if (Number.isFinite(A) && A >= 1 && Number.isFinite(t0) && t0 <= last && last - t0 < A) {
    const ivl = ngKnowledgeLinear(A, last - t0);
    if (ngKnowledgeDueDay(last + ivl) === row[0]) return { A, t0, ivl, pair: true };
  }
  const ivl = ngKnowledgeOwnInterval(row);
  return { A: ivl, t0: last, ivl, pair: false };
}
// THE CARD'S LINE IS ITS RUNG'S (v1.281.3, LIN2): a card at interval `ivl` on day `day` stands on the line of the rung
// below it, r ≤ ivl < next, (ivl − r) × r ÷ (next − r) days into r's step. Returned as the rung pair {A: r, t0: the day the
// card stood on r}; a card on a rung, or at the top, is its own pair. Nothing is rounded: t0 is the number computed.
function ngKnowledgeOnRung(ivl, day) {
  const L = NG_KNOWLEDGE_LADDER, n = L.length - 1;
  if (ivl >= L[n]) return { A: L[n], t0: day };
  let i = 0;
  while (i < n && L[i + 1] <= ivl) i++;
  return ivl === L[i] ? { A: L[i], t0: day } : { A: L[i], t0: day - ((ivl - L[i]) * L[i]) / (L[i + 1] - L[i]) };
}
// an early answer on day `last` from the rung pair (A, t0) of a card at interval `ivl`: walk the rungs to the step `last` is
// in (each rung crossed moves the pair on: t0 + A, the next rung), then take that rung's line, never more than one step
// from `ivl` (the cap: below the top an early answer never reaches it; it binds when the walk lands on the top rung, and on
// a row past the top, whose step is the top: pinned in tests/schedule_rung.test.mjs). EARLY ONLY: a late answer earns the
// late rule's interval (`ngKnowledgeLate`), which no cap of ours bounds
function ngKnowledgeEarly(A, t0, ivl, last) {
  const top = NG_KNOWLEDGE_LADDER[NG_KNOWLEDGE_LADDER.length - 1];
  while (last - t0 >= A && A < top) { t0 += A; A = ngKnowledgeStep(A); }
  const at = ngKnowledgeLinear(A, last - t0), cap = ngKnowledgeStep(ivl);
  return at >= cap ? { A: cap, t0: last, ivl: cap } : { A, t0, ivl: at };
}
// the state the writer works from: the row's exact state (`ngKnowledgeAnchor`), moved onto its rung's line when its pair is
// not a rung pair (a row's own interval between rungs, an on-time step between rungs, or a v1.281.0 row anchored off the
// rungs): the interval it reads is kept, only the line it climbs from there is the rung's
function ngKnowledgeRungState(prior, at) {
  const s = ngKnowledgeAnchor(prior, at);
  return NG_KNOWLEDGE_LADDER.includes(s.A) ? s : { ...ngKnowledgeOnRung(s.ivl, prior[2]), ivl: s.ivl };
}
// the exact interval a row holds, `due − last` before any rounding (the rating and the Practice order read it too)
export function ngKnowledgeInterval(row, at = 3) { return ngKnowledgeAnchor(row, at).ivl; }
// THE LATE ANSWER (v1.305.0; LATE1, the owner, 25 Nov 2026: "when answering late, [the] elapsed time in days is doubled, that
// is the time in days for the next repetition space"; 26 Nov, U223 b: "Your rule, no cap"; ITS FINAL FORM, LATE2, 28 Nov 2026,
// card U226 a: "The fitted curve: power 1/6"): a right answer ON OR AFTER the due day, `elapsed` days after the last answer,
// on a card at interval `ivl`, earns
//     max(step(I), t × min(step(I) ÷ I, C(t) ÷ t)),   C(t) ÷ t = 2 up to 4 years, the ladder's own step(t) ÷ t past them
// (the curve's rungs, NG_KNOWLEDGE_LADDER, run in straight lines between them, within 0.41% under the exact curve). So: on the
// due day exactly ONE STEP, his named rung (the 60-day card goes to 90; LATE1's first form, max(step, 2t), sent it to 120); after
// it twice the wait wherever his step at least doubles, the step's own multiple of it where it does not (1.5 × on the 60-day
// rung), and past 4 years the ladder's own step for the days waited (a 4-year or a 1-year card answered 8 years on: 5,525
// days). A day later never earns less (each term only grows with the days); no jump at the due (it meets the early line);
// late never earns less than on time. No ceiling of ours: the ladder's own top (655,856 days) is the step's. The ONLY place
// the shape lives (LATEHOLD); swap this body, nothing else. WRITTEN AS min(t × step ÷ I, t × the multiple), the same
// function as t × min(…) to float dust, so that on the due day (t = I) it is EXACTLY one step: the study's form lands 10^-12
// of a day above it on 23,070 of 700,000 whole-day intervals past 4 years (tests/schedule_late.test.mjs pins both).
export function ngKnowledgeLate(ivl, elapsed) {
  const s = ngKnowledgeStep(ivl);
  return Math.max(s, Math.min((elapsed * s) / ivl, elapsed <= NG_KNOWLEDGE_TOP_FROM ? 2 * elapsed : ngKnowledgeStep(elapsed)));
}
// the new exact interval (in days, counted from the answer's day) a RIGHT answer on `day` earns on `prior`
export function ngKnowledgeNextInterval(prior, day, at = 3) { return ngKnowledgeNext(prior, Math.max(day, prior[2]), at).ivl; }
// A RIGHT ANSWER on `last` (never before the row's last): the new state {A, t0, ivl}. Nothing is rounded (v1.281.3): what is
// computed here is what the stored pair reproduces, a JSON number reading back as itself. ON TIME OR LATE the card takes
// his late rule's interval from the interval it reads and the days since its last answer (`ngKnowledgeLate`, v1.305.0: on
// the due day one step, after it more), anchored at its own day as v1.281.0 stored it; EARLY it climbs its rung's line
// and the rung pair is stored. An early answer with no day waited (on the row's own last day, or a clock set back) leaves the
// level where it is and keeps the pair exactly as stored, so a second answer the same day rewrites nothing
function ngKnowledgeNext(prior, last, at) {
  if (last >= prior[0]) { const A = ngKnowledgeLate(ngKnowledgeAnchor(prior, at).ivl, last - prior[2]); return { A, t0: last, ivl: A }; }
  const s = last === prior[2] ? ngKnowledgeAnchor(prior, at) : ngKnowledgeRungState(prior, at);
  return ngKnowledgeEarly(s.A, s.t0, s.ivl, last);
}
// THE LATE MARK (v1.305.0, LATE1, the rating's correction). The late rule (`ngKnowledgeLate`) stretches a card's interval
// without its memory being any stronger, and the rating (`ngRatingRecall`, rating.src.js) and Practice's worth read a longer
// interval as better recall (the study, LATE1 Part A: 16 to 31 points high while true recall fell). The row alone cannot say
// it: a 30-day card answered on its due and a 3-day card answered 30 days after its last answer both store [last + 60, 60,
// last], and every interval a stretched row can hold is held by some row written before this build, so any reading from the
// row alone either lowers a row that exists today or corrects nothing. So a row the late rule stretched carries three more
// numbers after the pair's slot ([0, 0] there when it has no pair): [R, I, L], R the interval THE ONE-STEP SCHEDULE (v1.281.3
// to v1.304.0's writer, on today's ladder: its rungs past 4 years the curve's since LATE2) would hold after the same answers,
// I the row's own exact interval when it was written, and L THE DAY OF THE ANSWER IT BELONGS TO (LATEFIX1, the reader of PR
// #472, F1: below). The rating reads R (never more than the schedule's own); the schedule
// never reads the mark. SINCE LATE2 (the late rule's final form) an answer on a card's due day stretches nothing (the rule is
// one step there), so a mark starts only on an answer after the due day, or on the due day of a card between whole days (its
// part day); a marked card keeps it while the two readings differ (below).
//   · WRITTEN only when R < I, on a right answer (a miss and a first answer write none): R is the one-step writer run on the
//     card's own row, or on the row its mark stands for (`ngKnowledgeShadow`), so a chain of answers keeps the one-step
//     reading (a stretched card answered early stays marked, its R the early line from R), and the mark goes when the two
//     agree again. Rows not stretched are byte for byte as before; every row written before this build has none, so every
//     rating reads as it did at the update.
//   · IT CHECKS ITSELF (`ngKnowledgeMark`): read only when R ≥ 1, R < I, I is the row's exact interval as read now, AND L is
//     the row's last. Every build from v1.281.0 to v1.304.x KEEPS the three cells: its writer copies the cells after the pair
//     on every answer, a miss included; its moves merge keeps a cloud row's whole tail; its journal replay rebuilds on the
//     cloud's row with the tail. Its answers can bring the card back to exactly I (a miss, then on-time answers), and with
//     [R, I] alone the stale mark then checked again: this build read the card a rung low for good (the reader's F1: 60 where
//     the one-step schedule reads 90). The day closes it. An older build's answer always moves `last`, except an answer on
//     the same day, which either keeps the row as it was (an early right answer with no day waited: the mark still describes
//     it) or sends it to 1 day (a miss: no mark checks at 1 day). So a kept mark never counts again once that build has
//     answered the card (tests/schedule_late_mark.test.mjs: its writer, moves merge and replay, a miss and the climb back).
//     A pull's clamped `last` fails it the same way; the merge's heal writes its own (`ngKnowledgeMergeRow`).
//   · NOT COVERED: an older build's ANSWER, and an older build's srs pull (v1.281.0 to v1.304.x keep the pair only there,
//     so the three cells go). After either, the row reads uncorrected, as it would without this mark: higher, never lower,
//     and never on a schedule's day. Cells a later build adds ride after the mark.
export function ngKnowledgeMark(row, at = 3) {
  const R = row[at + 2], I = row[at + 3];
  return Number.isFinite(R) && R >= 1 && Number.isFinite(I) && R < I && row[2] === row[at + 4] && ngKnowledgeInterval(row, at) === I ? R : null;
}
// the interval the one-step schedule would hold after a right answer on `last` (never before the row's last), on the prior
// row or, when it carries a mark that checks itself, on the row the mark stands for (its interval R anchored at the prior's
// last, the pair only when R is not whole, read back as the writer reads any such row): one step on or after that row's due,
// the same early lines before it (`ngKnowledgeNext`, whose early branch is shared), and never sooner than that row's due
function ngKnowledgeShadow(prior, last, at) {
  const R = ngKnowledgeMark(prior, at);
  let p = prior;
  if (R !== null) {
    p = [ngKnowledgeDueDay(prior[2] + R), ngKnowledgeCell(R), prior[2]];
    if (at > 3) p.push(prior[3]);
    if (!Number.isInteger(R)) p.push(R, prior[2]);
  }
  if (last >= p[0]) return ngKnowledgeStep(ngKnowledgeAnchor(p, at).ivl);
  const s = ngKnowledgeNext(p, last, at).ivl;
  return ngKnowledgeDueDay(last + s) < p[0] ? p[0] - last : s;
}
// a row as stored: [due, cell, last] (+ a move's answer), then the pair, then the late mark [R, I, last] (`R` the one-step
// interval, kept only when it is shorter than the row's own, `I` the row's own, `last` its answer's day: LATEFIX1); [0, 0] and
// [0, 0, 0] in a slot left empty when cells follow it, and cells a later build added ride after the mark
function ngKnowledgeRowOut(due, ivl, last, pair, ok, prior, at, R = null) {
  const row = [due, ngKnowledgeCell(ivl), last];
  if (at > 3) row.push(ok ? 1 : 0);
  const rest = Array.isArray(prior) && prior.length > at + 5 ? prior.slice(at + 5) : [];
  const I = R === null ? null : ngKnowledgeInterval(pair ? row.concat(pair) : row, at);
  const mark = I !== null && R < I ? [R, I, last] : rest.length ? [0, 0, 0] : [];
  if (pair) row.push(pair[0], pair[1]); else if (mark.length) row.push(0, 0);
  return row.concat(mark, rest);
}
// THE WRITER: one answer on `prior`; `at` 3 for an srs row, 4 for a moves row (which then carries `ok` at [3])
export function ngKnowledgeScheduleRow(prior, ok, day, at = 3) {
  if (!ngKnowledgeRowOk(prior)) return ngKnowledgeRowOut(day + 1, NG_KNOWLEDGE_INTERVALS[0], day, null, ok, prior, at);
  const last = Math.max(day, prior[2]);   // never backward (a clock set back): see the header
  if (!ok) return ngKnowledgeRowOut(last + 1, NG_KNOWLEDGE_INTERVALS[0], last, null, ok, prior, at);
  const { A, t0, ivl } = ngKnowledgeNext(prior, last, at);
  const due = ngKnowledgeDueDay(last + ivl), R = ngKnowledgeShadow(prior, last, at);   // R: the late mark's (v1.305.0)
  if (due < prior[0]) return ngKnowledgeRowOut(prior[0], prior[0] - last, last, null, ok, prior, at, R);   // never sooner
  // A PAIR DAY BELOW 0 IS NEVER STORED (v1.281.3, LIN2-R1 and R2, the reader of PR #426): every client's blob validator takes
  // only numbers at or above 0, so a rung pair dated before epoch day 0 (a card whose rung outlasts the days since 1970: a
  // clock before about 1975 after a pull's clamp, or a damaged row) would make the whole blob invalid. Such a row stores its
  // EXACT INTERVAL DATED ON ITS OWN LAST DAY instead, [ivl, last] (no pair when ivl is whole), the form an on-time answer
  // stores: every reader reads it exactly, it holds no negative number, and the next early answer puts the card on its rung's
  // line from there, so nothing is lost or gained over any run of answers (LIN2-R1 dropped the pair, a day longer at most per
  // answer, and that added up: a 731-day card answered daily from epoch day 0 came due 364 days late). At epoch day d it
  // touches only a card on a rung r above d whose interval is above r + d × (next − r) ÷ r: from 60 + d ÷ 2 on the 60-day
  // rung; at d = 20,400 (on his ladder since LATE2, whose first rung above d is the curve's 28,571, next 45,978), above
  // 40,999.8 days (about 112 years; on the doubling ladder until then, 43,776)
  const pair = t0 < 0 ? (Number.isInteger(ivl) ? null : [ivl, last]) : t0 === last && Number.isInteger(A) ? null : [A, t0];
  return ngKnowledgeRowOut(due, ivl, last, pair, ok, prior, at, R);
}
// THE PULL'S MERGE OF ONE srs ROW (v1.105.0 in `_mergeProgressFields`; here since v1.279.0 so it is pinned as a unit).
// Per card the LATER review wins (the freshest grade knows the memory best); ties are the common case (`last` is a day),
// so the tie rule IS the rule: the SMALLER cell, then the EARLIER EXACT DUE (v1.281.0; the due day before it), then the
// earlier due day, then the pair read as text, so a full tie keeps the same row whichever side holds it. Smaller cell
// then earlier due is "the smaller true interval" on one day: showing a card early is cheap, hiding a forgotten one is
// not. A winner past rung 0 keeps the LONGER interval it beat (the heal of the grade-before-pull race), read as EXACT
// intervals: a beaten row of the winner's own day is taken as it is, its pair with it (so a second pull finds the same row
// and writes nothing); one from an earlier day is written as a fresh anchor at the winner's last: [its first whole day,
// the beaten cell, winner's last], with a pair only when that interval is not whole. The cloud row's pair rides with it (read only if it checks itself). The
// incoming `last` is clamped to today so a fast clock cannot win forever (its pair then fails its check); `local` may be
// undefined (a card only the cloud holds). Returns the row to keep; inputs untouched.
// THE LATE MARK (v1.305.0) rides with the cloud row's pair (read only if it checks itself; a clamped `last` fails it), and the
// heal writes its own: the kept card reads at the longer of the two rows' one-step readings (each row's mark, else its own
// interval), marked only while that is shorter than the interval the heal keeps; and a tie on the whole schedule keeps the
// row with the longer reading before the text decides, so the heal's row is what a second pull keeps (it writes nothing).
// Rows without a mark read their own interval, equal on such a tie: every row written before this build ties as before.
export function ngKnowledgeMergeRow(local, cloud, today) {
  const cc = [cloud[0] | 0, cloud[1] | 0, Math.min(today, cloud[2] | 0)];
  if (Number.isFinite(cloud[3]) && Number.isFinite(cloud[4])) {
    cc.push(cloud[3], cloud[4]);
    if ([5, 6, 7].every((i) => Number.isFinite(cloud[i]))) cc.push(cloud[5], cloud[6], cloud[7]);   // the late mark (v1.305.0)
  }
  if (!local) return cc;
  const m = local, ed = (r) => r[2] + ngKnowledgeInterval(r), rd = (r) => { const k = ngKnowledgeMark(r); return k === null ? ngKnowledgeInterval(r) : k; };
  let w;
  if (cc[2] !== m[2]) w = cc[2] > m[2] ? cc : m;
  else if (cc[1] !== m[1]) w = cc[1] < m[1] ? cc : m;
  else if (ed(cc) !== ed(m)) w = ed(cc) < ed(m) ? cc : m;
  else if (cc[0] !== m[0]) w = cc[0] < m[0] ? cc : m;
  // the longer one-step reading, as the heal keeps (v1.305.0). It is also what lets an srs row settle beside an older build:
  // v1.281.0 to v1.304.x pull srs rows without the cells after the pair, so they hold the unmarked row, and the unmarked one
  // always reads longer (LATEFIX1, the reader's F2, measured: the text tie here left 2,118 of 6,000 mixed syncs unsettled).
  // The moves merge, whose older copies keep the cells, settles by their own rule instead (`ngProgressMergeMoves`)
  else if (rd(cc) !== rd(m)) w = rd(cc) > rd(m) ? cc : m;
  else w = JSON.stringify(cc.slice(3)) <= JSON.stringify(m.slice(3)) ? cc : m;
  const o = w === cc ? m : cc;
  const tw = ngKnowledgeInterval(w), to = ngKnowledgeInterval(o);
  if (tw > 1 && to > tw) {
    const mw = ngKnowledgeMark(w), mo = ngKnowledgeMark(o), R = Math.max(mw === null ? tw : mw, mo === null ? to : mo);
    if (o[2] === w[2]) w = o.slice(0, 3).concat(ngKnowledgeAnchor(o).pair ? o.slice(3, 5) : []);
    else {
      const A = to;   // the beaten interval as read, not rounded (v1.281.3)
      w = [ngKnowledgeDueDay(w[2] + A), o[1], w[2]];
      if (!Number.isInteger(A)) w.push(A, w[2]);
    }
    if (R < to) { if (w.length === 3) w.push(0, 0); w.push(R, ngKnowledgeInterval(w), w[2]); }   // the heal's late mark
  }
  return w;
}
export function ngKnowledgeApplyGrade(evidence, event, manifest, day) {
  const e = evidence || ngKnowledgeBuildEvidence();
  const invalid = !event || !event.attemptId || !event.key || !event.card || !event.card.q ||
    !["mc", "recall", "expiry", "reveal"].includes(event.mode) || !Number.isSafeInteger(day);
  if (invalid) return { status: "invalid", evidence: e, changedDecks: [], effects: {} };
  if (ngKnowledgeOwn(e.attempts, event.attemptId)) return { status: "duplicate", evidence: e, changedDecks: [], effects: {} };
  // Reveal is not a grade and does not consume a later real grading attempt.
  if (event.mode === "reveal") return { status: "revealed", evidence: e, changedDecks: [], effects: {} };
  const next = ngKnowledgeClone(e), key = event.key, qh = ngKnowledgeCardKey(event.card);   // CARD1-S2: the card's key
  const shared = ngKnowledgeSharedDecks(manifest, event.card, key);
  const decks = [...new Set([key, ...shared])];
  const ok = !!event.correct && event.mode !== "expiry";
  const cur = ngKnowledgeRead(ngKnowledgeRead(next.stage, key, {}), qh);
  let stage = cur;
  if (ok || event.mode === "recall" || event.tier === "trap") {
    const stages = ngKnowledgeBucket(next.stage, key);
    const cap = event.mode === "mc" && ok ? 2 : 4;
    // THE FLOOR AT 2 (v1.282.0, ruling R1, owner 15 Nov: "after a player dominates MC for a card he is shown FC cards, and
    // never again the multiple choice"). Stage 2 is what Auto calls mastered as multiple choice (`_cardAsksMc`, app), and a
    // miss there used to send the card back to 1, i.e. back to multiple choice. Now no answer takes a card below 2 once it
    // got there; a miss still costs its schedule (rung 0, due tomorrow, below) and still costs a stage above 2 (3 -> 2,
    // 4 -> 3, as before). Side effect, told to the owner: a card missed at 2 keeps 2/3 of its mastery (min(stage,3)/3)
    // where it dropped to 1/3. Nothing stored is added; the per-card MAX merge already never lowers it.
    stage = ok ? Math.max(cur, Math.min(cap, cur + 1)) : Math.max(cur >= 2 ? 2 : 0, Math.min(cap, cur - 1));
    ngKnowledgePut(stages, qh, stage);
  }
  for (const dk of decks) {
    const schedules = ngKnowledgeBucket(next.srs, dk), prior = ngKnowledgeRead(schedules, qh, null);
    ngKnowledgePut(schedules, qh, ngKnowledgeScheduleRow(prior, ok, day));
  }
  const proven = ok && event.mode === "recall" && cur < 3 && stage >= 3;
  // the session latch is per CARD, by its key (CARD1-S2; the app's `cardDone` is the same set): never stored
  const firstCredit = ok && !next.creditedQuestions.includes(qh);
  if (ok) {
    ngKnowledgePut(next.prep, key, ngKnowledgeRead(next.prep, key) + 1);
    ngKnowledgePut(next.sharp, key, 0.10);
    if (proven) ngKnowledgePut(next.rec, key, ngKnowledgeRead(next.rec, key) + 1);
    if (firstCredit) {
      next.creditedQuestions.push(qh);
      const dayKey = event.dayKey || String(day);
      ngKnowledgePut(next.days, dayKey, ngKnowledgeRead(next.days, dayKey) + 1);
      for (const dk of shared) {
        if (dk === key) continue;
        const d = manifest && manifest.decks && ngKnowledgeRead(manifest.decks, dk, null);
        const cards = Array.isArray(d) ? d : d && d.cards;
        const cap = cards ? cards.length : (d && d.n) || 0;
        ngKnowledgePut(next.prep, dk, Math.min(cap, ngKnowledgeRead(next.prep, dk) + 1));
      }
    }
  }
  next.revision++;
  ngKnowledgePut(next.attempts, event.attemptId, { surface: event.surface || "unspecified",
    mode: event.mode, correct: ok, tier: event.tier || null, key, qh, day });
  return ngKnowledgeFreeze({ status: "applied", evidence: next, changedDecks: decks,
    effects: { save: true, stage, correct: ok, recallProven: proven, firstCredit,
      refreshSharp: ok ? key : null, publishRevision: next.revision } });
}
