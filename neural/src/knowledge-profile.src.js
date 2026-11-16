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
// 1461, 2922 days, then doubling. A card may sit BETWEEN two rungs (the research's frame, reports kept outside the repo):
// its place is read from its true interval on a log scale, so halfway from 30 to 60 days is 42.4, not 45.
export const NG_KNOWLEDGE_LADDER = Object.freeze((() => {
  const L = [1, 3, 7, 14, 30, 60, 90, 180, 365, 730, 1461, 2922];
  while (L.length < 24) L.push(L[L.length - 1] * 2);
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
export function ngKnowledgeSharedDecks(manifest, question, key) {
  const m = manifest || {}, qh = ngKnowledgeQuestionHash(question);
  if (m.shared != null) {
    const list = m.shared instanceof Map ? m.shared.get(qh) : ngKnowledgeRead(m.shared, qh, null);
    return list && list.length > 1 && list.includes(key) ? [...new Set(list)] : [];
  }
  // Explicit legacy fallback, only for old manifests with no sharing index.
  const list = [];
  for (const [dk, d] of Object.entries(m.decks || {})) {
    const cards = Array.isArray(d) ? d : d && d.cards;
    if (cards && cards.some((c) => c.q === question)) list.push(dk);
  }
  return list.length > 1 ? list : [];
}
// THE SCHEDULE (v1.281.3, LIN2: the owner's own formula, U188, on the ladder's own lines; v1.281.0, LIN1, carried the credit
// exactly; the ladder and the rest as ruled at v1.279.0, SRS-GO).
// A row is [due, cell, last day] (a move's adds its answer at [3]), plus THE PAIR [A, t0] right after (srs [3], moves [4])
// while the row's exact interval is not its own whole one: either a RUNG PAIR, the rung A the card's line starts from and t0
// the day the card stood on it (an early answer stores this), or a step anchored at its own day, [the exact interval, last]
// (an on-time or late answer between rungs stores this, as v1.281.0 did). A row written by any older client has no pair and
// reads as anchored at its own last, so nothing stored is rewritten. NOTHING IS ROUNDED (v1.281.3): the numbers stored are the
// numbers computed, a JSON number reads back as itself, and every due is the rule's in exact arithmetic (pinned in fractions).
//   · THE RULE, as a player could read it: A CARD CLIMBS ITS STEP AT A STEADY PACE: EACH DAY YOU WAITED BEFORE ANSWERING RIGHT
//     EARNS THE SAME SHARE OF THE STEP, WHENEVER YOU ANSWER. The owner's formula (15 Nov 2026: next = (interval − days left) ×
//     ratio + days left, ratio = next step ÷ this step) with the ratio of THE STEP THE CARD IS IN, at every answer: a card
//     between rungs r < x < next stands on r's line, (x − r) × r ÷ (next − r) days into r's step (`ngKnowledgeOnRung`), and its
//     interval w days into a rung's step is r + w × (next − r) ÷ r (`ngKnowledgeLinear` on a rung). As a level: a real number
//     climbing 1 ÷ (its rung's interval) a day, at most one level per answer. His numbers, pinned in
//     tests/schedule_ladder.test.mjs: a 30-day card answered 1 day before its due comes due 59 days on, 29 days before it 31,
//     on time 60; and his own check (U193): day 15 gives 45, then day 30 (a 45-day gap, 30 days left) gives 60.
//   · v1.281.0 drew ONE straight line from a card's own interval, A + w × (step(A) − A) ÷ A; the two differ only where it stored
//     an anchor off the rungs. Its rows read as they did (the same interval), and go on from there on their rung's line.
//   · WHAT THAT BUYS, pinned over the reader's own searches in tests/schedule_rung.test.mjs: AN EARLY RIGHT ANSWER NEVER LEAVES A
//     CARD DUE SOONER THAN WITHOUT IT (v1.281.0 lost up to 39 days in 4,196 of 1,123,024 comparisons: now 0), and a card ends
//     ahead of answering on time BY AT MOST 3 WHOLE DAYS, NEVER IN EXACT DAYS (839 of 566,832 early-only prefixes, against
//     v1.281.0's 1,150 by up to 10; early, on time, then early: 0 of 40,536, against 63): the on-time path answers on whole
//     due days, a fraction of a day after its exact due, and restarts there, while early answers ride the line exactly. ITS
//     ONE TRADE-OFF: a card between rungs earns less early credit in the first part of its wait and more later (a 75-day card
//     answered on day 28: 89 days, where v1.281.0's line gave 98; a 42-day card on day 18: 60, against 55); at the due the
//     two agree (one step).
//   · THE STEP IS TAKEN WHEN THE DAYS REACH IT, and an answer takes AT MOST ONE STEP from where the previous answer left it.
//     Early, the card walks rung after rung (each rung crossed moves the pair on: A ← the next rung, t0 ← t0 + A) and takes
//     the line there; on those lines the line is one step up exactly at the exact due, so below the top an early answer never
//     reaches the cap (`ngKnowledgeEarly`'s cap binds only at and past the top, where a step is the top). AN ANSWER ON OR AFTER THE DUE takes exactly one step from the
//     interval it reads (day 29 → 59 days; on that due, 89; a day before it, 88.5). LATE EARNS ONE STEP AND NO MORE: the
//     formula's negative "days left" would pay a late bonus (10 days late: 70, not 60); it was measured out at v1.279.0
//     (ANKI1: with a backlog the bonus cost 7 to 15 points of true recall) and stays out. Dropping the days past the step
//     (LIN1's first draft) made an answer a day before the due earn almost nothing on a card between steps; NO CLIFF since.
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
// a row past the top, whose step is the top: pinned in tests/schedule_rung.test.mjs)
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
// the new exact interval (in days, counted from the answer's day) a RIGHT answer on `day` earns on `prior`
export function ngKnowledgeNextInterval(prior, day, at = 3) { return ngKnowledgeNext(prior, Math.max(day, prior[2]), at).ivl; }
// A RIGHT ANSWER on `last` (never before the row's last): the new state {A, t0, ivl}. Nothing is rounded (v1.281.3): what is
// computed here is what the stored pair reproduces, a JSON number reading back as itself. ON TIME OR LATE the card takes
// exactly one step from the interval it reads, anchored at its own day as v1.281.0 stored it; EARLY it climbs its rung's line
// and the rung pair is stored. An early answer with no day waited (on the row's own last day, or a clock set back) leaves the
// level where it is and keeps the pair exactly as stored, so a second answer the same day rewrites nothing
function ngKnowledgeNext(prior, last, at) {
  if (last >= prior[0]) { const A = ngKnowledgeStep(ngKnowledgeAnchor(prior, at).ivl); return { A, t0: last, ivl: A }; }
  const s = last === prior[2] ? ngKnowledgeAnchor(prior, at) : ngKnowledgeRungState(prior, at);
  return ngKnowledgeEarly(s.A, s.t0, s.ivl, last);
}
// a row as stored: [due, cell, last] (+ a move's answer), then the pair or, when cells a later build added follow, [0, 0]
function ngKnowledgeRowOut(due, ivl, last, pair, ok, prior, at) {
  const row = [due, ngKnowledgeCell(ivl), last];
  if (at > 3) row.push(ok ? 1 : 0);
  const rest = Array.isArray(prior) && prior.length > at + 2 ? prior.slice(at + 2) : [];
  if (pair) row.push(pair[0], pair[1]); else if (rest.length) row.push(0, 0);
  return rest.length ? row.concat(rest) : row;
}
// THE WRITER: one answer on `prior`; `at` 3 for an srs row, 4 for a moves row (which then carries `ok` at [3])
export function ngKnowledgeScheduleRow(prior, ok, day, at = 3) {
  if (!ngKnowledgeRowOk(prior)) return ngKnowledgeRowOut(day + 1, NG_KNOWLEDGE_INTERVALS[0], day, null, ok, prior, at);
  const last = Math.max(day, prior[2]);   // never backward (a clock set back): see the header
  if (!ok) return ngKnowledgeRowOut(last + 1, NG_KNOWLEDGE_INTERVALS[0], last, null, ok, prior, at);
  const { A, t0, ivl } = ngKnowledgeNext(prior, last, at);
  const due = ngKnowledgeDueDay(last + ivl);
  if (due < prior[0]) return ngKnowledgeRowOut(prior[0], prior[0] - last, last, null, ok, prior, at);   // never sooner
  return ngKnowledgeRowOut(due, ivl, last, t0 === last && Number.isInteger(A) ? null : [A, t0], ok, prior, at);
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
export function ngKnowledgeMergeRow(local, cloud, today) {
  const cc = [cloud[0] | 0, cloud[1] | 0, Math.min(today, cloud[2] | 0)];
  if (Number.isFinite(cloud[3]) && Number.isFinite(cloud[4])) cc.push(cloud[3], cloud[4]);
  if (!local) return cc;
  const m = local, ed = (r) => r[2] + ngKnowledgeInterval(r);
  let w;
  if (cc[2] !== m[2]) w = cc[2] > m[2] ? cc : m;
  else if (cc[1] !== m[1]) w = cc[1] < m[1] ? cc : m;
  else if (ed(cc) !== ed(m)) w = ed(cc) < ed(m) ? cc : m;
  else if (cc[0] !== m[0]) w = cc[0] < m[0] ? cc : m;
  else w = JSON.stringify(cc.slice(3)) <= JSON.stringify(m.slice(3)) ? cc : m;
  const o = w === cc ? m : cc;
  const tw = ngKnowledgeInterval(w), to = ngKnowledgeInterval(o);
  if (tw > 1 && to > tw) {
    if (o[2] === w[2]) w = o.slice(0, 3).concat(ngKnowledgeAnchor(o).pair ? o.slice(3, 5) : []);
    else {
      const A = to;   // the beaten interval as read, not rounded (v1.281.3)
      w = [ngKnowledgeDueDay(w[2] + A), o[1], w[2]];
      if (!Number.isInteger(A)) w.push(A, w[2]);
    }
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
  const next = ngKnowledgeClone(e), key = event.key, q = event.card.q, qh = ngKnowledgeQuestionHash(q);
  const shared = ngKnowledgeSharedDecks(manifest, q, key);
  const decks = [...new Set([key, ...shared])];
  const ok = !!event.correct && event.mode !== "expiry";
  const cur = ngKnowledgeRead(ngKnowledgeRead(next.stage, key, {}), qh);
  let stage = cur;
  if (ok || event.mode === "recall" || event.tier === "trap") {
    const stages = ngKnowledgeBucket(next.stage, key);
    const cap = event.mode === "mc" && ok ? 2 : 4;
    stage = ok ? Math.max(cur, Math.min(cap, cur + 1)) : Math.max(0, Math.min(cap, cur - 1));
    ngKnowledgePut(stages, qh, stage);
  }
  for (const dk of decks) {
    const schedules = ngKnowledgeBucket(next.srs, dk), prior = ngKnowledgeRead(schedules, qh, null);
    ngKnowledgePut(schedules, qh, ngKnowledgeScheduleRow(prior, ok, day));
  }
  const proven = ok && event.mode === "recall" && cur < 3 && stage >= 3;
  const firstCredit = ok && !next.creditedQuestions.includes(q);
  if (ok) {
    ngKnowledgePut(next.prep, key, ngKnowledgeRead(next.prep, key) + 1);
    ngKnowledgePut(next.sharp, key, 0.10);
    if (proven) ngKnowledgePut(next.rec, key, ngKnowledgeRead(next.rec, key) + 1);
    if (firstCredit) {
      next.creditedQuestions.push(q);
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
