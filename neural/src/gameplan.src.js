// A study plan owns a frozen selection; SRS owns review debt. No clock, DOM, grade
// writer or game probability lives here. Units are distinct question hashes, not
// deck copies, prep credits, or predicted real-world wins.
import { ngGameplanReviewed, ngGameplanDebt } from "./gameplan-debt.src.js";
export const NG_GAMEPLAN_VERSION = 1;

function ngGameplanFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(ngGameplanFreeze);
    Object.freeze(value);
  }
  return value;
}
function ngGameplanUnique(xs) { return [...new Set(xs)]; }
function ngGameplanCompare(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
function ngGameplanCanonical(v) {
  if (Array.isArray(v)) return v.map(ngGameplanCanonical);
  return v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, ngGameplanCanonical(v[k])])) : v;
}
function ngGameplanEqual(a, b) { return JSON.stringify(ngGameplanCanonical(a)) === JSON.stringify(ngGameplanCanonical(b)); }

// A provider must explicitly certify learning opportunity, its profile/context,
// exposure, headroom and assumptions. An action's max-Q is never study value.
// The score is only an ordering key. It is never summed or displayed as win gain.
export function ngGameplanRecommendations(provider, stamp, decks) {
  const fallback = { status: "unavailable", rows: [], assumptions: [], missing: [] };
  if (!provider || provider.status === "unavailable") return fallback;
  if (provider.status === "pending") return { ...fallback, status: "pending" };
  if (provider.kind !== "learning-opportunity" || provider.stamp !== stamp || !Array.isArray(provider.assumptions) || !provider.assumptions.length) {
    return { ...fallback, status: "stale" };
  }
  const byKey = new Map((provider.rows || []).map((r) => [r.key, r]));
  const rows = [], missing = [];
  for (const [key, d] of Object.entries(decks)) {
    if (d.allowed === false || !d.count || !(d.headroom > 0)) continue;
    const r = byKey.get(key);
    if (!r || r.status !== "ready" || !Number.isFinite(r.score) || !Number.isFinite(r.exposure) || r.exposure < 0 ||
        !Number.isFinite(r.headroom) || r.headroom <= 0 || r.headroom > d.headroom + 1e-9 ||
        typeof r.reason !== "string" || !r.reason.trim() || !r.role || r.role !== key.split("|")[1]) {
      missing.push(key); continue;
    }
    if (r.score > 0 && r.exposure > 0) rows.push({ key, score: r.score, exposure: r.exposure, headroom: r.headroom, role: r.role, reason: r.reason });
  }
  rows.sort((a, b) => b.score - a.score || ngGameplanCompare(a.key, b.key));
  return {
    status: missing.length ? "partial" : rows.length ? "ready" : "exhausted",
    rows, missing, assumptions: provider.assumptions.slice(),
  };
}

// Consumer of ngMdpEvaluateStudyScenarios (mdp-learning.src.js). Root owns that
// asynchronous producer and supplies the expected full stamp alongside our local
// UI stamp. Each scenario was solved jointly; assigning its rank to related decks
// is not an additive attribution or a prediction about a person's learning.
export function ngGameplanFromModel(result, context) {
  const unavailable = { kind: "learning-opportunity", stamp: context.stamp, status: "unavailable", rows: [], assumptions: [] };
  if (!result || result.status === "unavailable") return unavailable;
  if (result.apiVersion !== 1 || result.policySemantics !== "reoptimized" ||
      !context.modelStamp || !ngGameplanEqual(result.stamp, context.modelStamp) ||
      !ngGameplanEqual(result.startDistribution, context.startDistribution) ||
      !context.exposurePolicyId || result.exposurePolicyId !== context.exposurePolicyId ||
      !Array.isArray(result.startDistribution) || !result.startDistribution.length) return unavailable;
  const start = result.startDistribution;
  // The producer validates rational mass exactly; this consumer also accepts its
  // fraction-string wire representation instead of silently rejecting "1/2".
  const probability = (v) => {
    const fraction = typeof v === "string" && v.match(/^(\d+)\/(\d+)$/);
    return fraction ? Number(fraction[1]) / Number(fraction[2]) : Number(v);
  };
  if (start.some((s) => !s.stateId || !Number.isFinite(probability(s.probability)) || probability(s.probability) < 0) ||
      Math.abs(start.reduce((n, s) => n + probability(s.probability), 0) - 1) > 1e-9) return unavailable;
  const rows = new Map();
  for (const scenario of result.scenarios || []) {
    if (scenario.status !== "ready" || !Number.isFinite(scenario.simulatedWinDelta) || !scenario.baselinePolicyId || !scenario.scenarioPolicyId) continue;
    for (const deck of scenario.deckKeys || []) {
      const e = (scenario.exposure || []).find((r) => r.deckKey === deck.deckKey && r.role === deck.role);
      if (!e || e.status !== "ready" || !["hitting-probability", "expected-visits"].includes(e.kind) ||
          !Number.isFinite(e.value) || e.value < 0 || (e.kind === "hitting-probability" && e.value > 1) ||
          !Number.isFinite(deck.headroom) || deck.headroom <= 0 || deck.headroom > 1) continue;
      const r = { key: deck.deckKey, role: deck.role, status: "ready", headroom: deck.headroom,
        exposure: e.value, score: scenario.simulatedWinDelta, scenarioId: scenario.id,
        reason: "Remaining game practice credit can help with " + (deck.role === "Defender" ? "defense" : deck.role === "Attacker" ? "performing this technique" : "moves from the " + deck.role + " position") +
          ". The comparison includes chances to use it from your chosen starts after practicing this material together." };
      if (!rows.has(r.key) || rows.get(r.key).score < r.score) rows.set(r.key, r);
    }
  }
  const ruleset = context.modelStamp.ruleset || context.ruleset;
  const horizon = context.modelStamp.horizon || context.horizon;
  if (!["gi", "nogi"].includes(ruleset) || !horizon || !horizon.kind) return unavailable;
  return { kind: "learning-opportunity", stamp: context.stamp, status: result.status, rows: [...rows.values()], diagnostics: result,
    assumptions: ["Training setting: " + (ruleset === "nogi" ? "no-gi" : "gi") + "; " + start.length + " chosen starting position and role" + (start.length === 1 ? "." : " combinations."),
      (horizon.kind === "actual-roll" ? "Looks ahead to the end of the current roll." : "Looks ahead without a move limit.") +
        " Assumes the best available moves before and after practicing this material together.",
      "These game effects do not measure improvement on the mat."] };
}

// Deck descriptors: {count, questions:[hash], exact, allowed, headroom}.
// A manifest supplies shared hashes + stored SRS hashes before hydration. The
// remainder is counted as pending, never treated as already reviewed.
export function ngGameplanBuild({ day, ruleset, revision, stamp, target = 30, decks = {}, srs = {}, provider }) {
  const debt = ngGameplanDebt({ srs, day, decks });
  const reviewed = ngGameplanReviewed(srs, day);
  const ranking = ngGameplanRecommendations(provider, stamp, decks);
  const budget = Math.max(0, Math.floor(Number.isFinite(target) ? target : 30));
  const room = Math.max(0, budget - reviewed.length - debt.count);
  const used = new Set([...reviewed, ...debt.questions]);
  const dueKeys = new Set(debt.rows.map((r) => r.key));
  const fresh = [], more = [];
  let spent = 0, full = !room;
  for (const [index, r] of ranking.rows.entries()) {
    if (dueKeys.has(r.key)) continue;
    const d = decks[r.key], known = ngGameplanUnique(d.questions || []);
    const questions = known.filter((q) => !used.has(q));
    const pending = d.exact ? 0 : Math.max(0, d.count - known.length);
    const count = questions.length + pending;
    if (!count) continue;
    const row = { ...r, rank: index + 1, questions, pending, count, kind: "new" };
    // Soft whole-deck target: admit the first deck when room remains, explicitly
    // report its overrun. Later decks wait; due cards are never capped by budget.
    if (!full && (!fresh.length || spent + count <= room)) {
      fresh.push(row); spent += count;
      questions.forEach((q) => used.add(q));
      if (spent >= room) full = true;
    } else { full = true; more.push({ ...row, kind: "optional" }); }
  }
  for (const r of debt.rows.concat(fresh)) {
    r.related = ranking.rows.filter((other) => other.key !== r.key &&
      (decks[other.key].questions || []).some((q) => r.questions.includes(q)))
      .map((other) => ({ key: other.key, role: other.role, reason: other.reason }));
  }
  return ngGameplanFreeze({
    version: NG_GAMEPLAN_VERSION, day, ruleset, revision, stamp, target: budget,
    reviewed, due: debt.rows, fresh, more, blocked: debt.blocked,
    dueQuestions: debt.questions, status: ranking.status, assumptions: ranking.assumptions,
    missing: ranking.missing, room, newCards: spent, dueCards: debt.count,
    total: debt.count + spent, overrun: Math.max(0, reviewed.length + debt.count + spent - budget),
  });
}

// Hydration binds unknown question identities without reranking the plan. Known
// identities never change underneath an answer. New content requires a refresh.
export function ngGameplanBind(plan, decks) {
  const used = new Set([...plan.reviewed, ...plan.dueQuestions]);
  const bind = (r) => {
    const d = decks[r.key];
    if (!r.pending || !d || !d.exact) { r.questions.forEach((q) => used.add(q)); return r; }
    const questions = ngGameplanUnique(d.questions).filter((q) => !used.has(q));
    questions.forEach((q) => used.add(q));
    return { ...r, questions, count: questions.length, pending: 0 };
  };
  const fresh = plan.fresh.map(bind);
  if (fresh.every((r, i) => r === plan.fresh[i])) return plan;
  const newCards = fresh.reduce((n, r) => n + r.count, 0);
  return ngGameplanFreeze({ ...plan, fresh, newCards, total: plan.dueCards + newCards,
    overrun: Math.max(0, plan.reviewed.length + plan.dueCards + newCards - plan.target) });
}

export function ngGameplanProgress(plan, { srs = {}, day, decks = {} }) {
  const debt = ngGameplanDebt({ srs, day, decks });
  const owed = new Set(debt.questions), reviewed = new Set(ngGameplanReviewed(srs, plan.day));
  const rows = plan.due.concat(plan.fresh).map((r) => {
    // Deleted/ reset schedule entries do not prove a review. Both success and a
    // recorded failure resolve today's obligation; revealing an answer does not.
    const remaining = r.questions.filter((q) => !reviewed.has(q) || owed.has(q));
    return { key: r.key, remaining, count: r.count, pending: r.pending,
      done: !remaining.length && !r.pending, completed: r.questions.length - remaining.length };
  });
  const complete = day === plan.day && !debt.count && rows.every((r) => r.done) && plan.dueQuestions.every((q) => reviewed.has(q));
  const required = ngGameplanUnique(plan.dueQuestions.concat(plan.fresh.flatMap((r) => r.questions)));
  const missing = rows.flatMap((r) => r.remaining.filter((q) => decks[r.key] && decks[r.key].exact && !decks[r.key].questions.includes(q)));
  return { rows, complete, dayChanged: day !== plan.day, dueCards: debt.count,
    newDebt: debt.questions.filter((q) => !plan.dueQuestions.includes(q)),
    completed: required.filter((q) => reviewed.has(q) && !owed.has(q)).length, total: plan.total,
    blocked: ngGameplanUnique(debt.blocked.concat(missing)) };
}

export function ngGameplanSummary(plan) {
  const status = {
    unavailable: "Study recommendations unavailable. Review dates still apply.",
    pending: "Study recommendations loading. Review dates still apply.",
    stale: "Study recommendations need a refresh. Review dates still apply.",
    partial: "Some roles could not be assessed. This does not mean mastered.",
    exhausted: "No further study opportunities found in the material assessed. Reviews still protect recall.",
    ready: "Ordered by remaining game practice credit and chances to use this material.",
  }[plan.status];
  return plan.dueCards + " cards due · " + plan.fresh.length + " suggested decks · " + plan.newCards + " additional cards. " +
    "Soft target: " + plan.target + " cards; " + plan.reviewed.length + " reviewed today." +
    (plan.overrun ? " Whole decks and protected reviews exceed it by " + plan.overrun + "." : "") +
    (plan.fresh.some((r) => r.pending) ? " Counts settle when cards load." : "") + " " + status;
}
