// Shared simulator arithmetic. No DOM, storage, clock reads or random draws.
// These are existing GAME rewards, not calibrated effects of studying on grappling.
// Host evidence (question history) stays outside the compact worker profile.
export const NG_KNOWLEDGE_VERSION = 1;
export const NG_KNOWLEDGE_STUDY_POLICY = "no-additional-study-events";
// THE STORED CELL's rungs: the seven-rung ladder every client until v1.277.0 schedules by. A row's interval cell is
// always one of these (the largest at or below its true interval, below), so an older client's `indexOf` always finds
// a rung and its right answer climbs from there, never back to 1 day. The schedule itself is NG_KNOWLEDGE_LADDER.
export const NG_KNOWLEDGE_INTERVALS = Object.freeze([1, 3, 7, 14, 30, 60, 120]);
// THE LADDER (v1.277.0, the owner, 13 Nov 2026: "1 day, then … 3 days … 1 week, then … 2 weeks, 1 month, 2 months,
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
// THE SCHEDULE (v1.277.0, ruled SRS-GO). A row stays [due, interval, last day] (a move's adds its answer and any tail):
// NOTHING NEW IS STORED and no stored row is rewritten.
//   · THE TRUE INTERVAL is `due − last`, never less than the cell (`ngKnowledgeInterval`). Every writer until v1.277.0
//     wrote due = last + interval, so an existing row reads as its own rung; the pull's clamp (last ≤ today) can only
//     make it longer; a row built otherwise (a hand-built one in a spec) never reads below its own rung.
//   · THE CELL (`row[1]`) is written as the largest rung of NG_KNOWLEDGE_INTERVALS at or below the true interval
//     (`ngKnowledgeCell`), so it is what an older client can read: its right answer climbs ITS ladder from the cell (a
//     full rung, capped at 120 days, until a new client answers again) and never goes back to 1 day, and its due counts
//     read `due`, exact. Writing the true interval there instead would send every between-rungs card to 1 day on an older
//     client's right answer (its `indexOf` misses).
//   · A MISS, or a first answer: 1 day (the owner: "otherwise goes back to 1 day until it progresses").
//   · A RIGHT ANSWER moves the card up the ladder by the fraction of its interval that has passed (the research's rule
//     (b), proportional): p = days since the last answer / the true interval, the new place = the place + min(p, 1), and
//     due = today + the interval there (rounded to a day). The owner's example, pinned in tests/knowledge_profile.test.mjs:
//     a card at 30 days answered right the next day comes due on day 31.7 of the old count (30 × 2^(1/30) from day 1);
//     answered on day 29, day 87.6 (30 × 2^(29/30)); on time, day 90. So an answer right after the last one "hardly moves
//     the ball", and one just before the due date earns nearly the whole step. It cannot be farmed: answering every day
//     earns about what one on-time answer does.
//   · A LATE RIGHT ANSWER EARNS ONE RUNG, as on time: NO late bonus, measured, do not "fix" it. Anki and FSRS give one, and
//     the research recommended a capped one. But while rolls feed a backlog a card is late because of the pile, not
//     because the player held it; a bonus lengthens its interval, the order's worth reads the longer interval as "held",
//     and it waits longer still. Measured (ANKI1, the Practice simulation's own memory model, 5 players, two years): with
//     a backlog the bonus cost 7 to 15 points of true recall and raised the rating, which reads the same cell, by 10 to 18;
//     with no backlog it changed nothing. The orchestrator ruled it out on that measurement (SRS-GO).
//   · A right answer NEVER makes a card due sooner: the place only rises, and today is never before the last answer
//     (the pull clamps `last` to today); `Math.max` with the old due holds it even against a clock set back.
export function ngKnowledgeInterval(row) {
  const t = row[0] - row[2], c = Number.isFinite(row[1]) && row[1] >= 1 ? row[1] : 1;
  return Number.isFinite(t) ? Math.max(c, t) : c;
}
export function ngKnowledgeCell(ivl) {
  let c = NG_KNOWLEDGE_INTERVALS[0];
  for (const r of NG_KNOWLEDGE_INTERVALS) if (r <= ivl) c = r;
  return c;
}
function ngKnowledgeAt(x) {
  const L = NG_KNOWLEDGE_LADDER, i = Math.min(L.length - 1, Math.max(0, Math.floor(x)));
  return i >= L.length - 1 ? L[i] : L[i] * Math.pow(L[i + 1] / L[i], x - i);
}
function ngKnowledgePlace(ivl) {
  const L = NG_KNOWLEDGE_LADDER;
  if (!(ivl > L[0])) return 0;
  for (let i = 0; i < L.length - 1; i++) if (ivl < L[i + 1]) return i + Math.log(ivl / L[i]) / Math.log(L[i + 1] / L[i]);
  return L.length - 1;
}
function ngKnowledgeRowOk(r) { return Array.isArray(r) && r.length >= 3 && Number.isFinite(r[0]) && Number.isFinite(r[1]) && Number.isFinite(r[2]); }
// the new interval (in days, not rounded, counted from `day`) a RIGHT answer earns on `prior`
export function ngKnowledgeNextInterval(prior, day) {
  const cur = ngKnowledgeInterval(prior), p = Math.max(0, day - prior[2]) / cur;
  return ngKnowledgeAt(ngKnowledgePlace(cur) + Math.min(1, p));
}
export function ngKnowledgeScheduleRow(prior, ok, day) {
  if (!ok || !ngKnowledgeRowOk(prior)) return [day + 1, NG_KNOWLEDGE_INTERVALS[0], day];
  const due = Math.max(prior[0], day + Math.max(1, Math.round(ngKnowledgeNextInterval(prior, day))));
  return [due, ngKnowledgeCell(due - day), day];
}
// THE PULL'S MERGE OF ONE srs ROW (v1.105.0 in `_mergeProgressFields`; here since v1.277.0 so it is pinned as a unit).
// Per card the LATER review wins (the freshest grade knows the memory best); ties are the common case (`last` is a day),
// so the tie rule IS the rule: the SMALLER cell, then (v1.277.0) the EARLIER due. The cell is floored, so two rows of one
// day can tie on it with different due dates; until v1.277.0 such a tie kept the LOCAL row, and two devices could each
// keep their own. Smaller cell then earlier due is "the smaller true interval" on one day: showing a card early is cheap,
// hiding a forgotten one is not. A winner past rung 0 keeps the LONGER interval it beat (the heal of the grade-before-
// pull race), read as TRUE intervals (`due − last`) since v1.277.0, written `[winner's last + the beaten interval, the
// beaten cell, winner's last]`. The incoming `last` is clamped to today so a fast clock cannot win forever. `local` may
// be undefined (a card only the cloud holds). Returns the row to keep; inputs untouched.
export function ngKnowledgeMergeRow(local, cloud, today) {
  const cc = [cloud[0] | 0, cloud[1] | 0, Math.min(today, cloud[2] | 0)];
  if (!local) return cc;
  const m = local;
  let w, o;
  if (cc[2] !== m[2]) { w = cc[2] > m[2] ? cc : m; }
  else if (cc[1] !== m[1]) { w = cc[1] < m[1] ? cc : m; }
  else { w = cc[0] < m[0] ? cc : m; }
  o = w === cc ? m : cc;
  const tw = ngKnowledgeInterval(w), to = ngKnowledgeInterval(o);
  if (tw > 1 && to > tw) w = [w[2] + to, o[1], w[2]];
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
