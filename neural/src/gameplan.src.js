// A study plan owns a frozen selection; SRS owns review debt. No clock, DOM, grade
// writer or game probability lives here. Units are distinct question hashes, not
// deck copies, prep credits, or predicted real-world wins.
import { ngGameplanReviewed, ngGameplanDebt } from "./gameplan-debt.src.js";
import { ngPracticeOrder } from "./practice-queue.src.js";
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
    // a deck the known moves fill (stage 2) has nothing for a comparison to rank: not missing, so never "partial"
    if (!r && d.oddsFull) continue;
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

// D1 (owner, 2026-09-30): "every player, a new one included, always has a plan". With no study
// comparison to rank by (none requested yet, still computing, or out of date), new material is
// ranked by the weak-spots ranking the app already computes (FLOW, `weakSpots()`). The plan says so
// (`status: "weak-spots"`, and `comparison` keeps the comparison's own state); it is never passed off
// as a comparison result. Rows arrive ranked, one per technique family; the same deck gate applies.
export function ngGameplanWeakSpots(fallback, decks) {
  const rows = [];
  for (const r of (fallback && fallback.rows) || []) {
    const d = decks[r.key];
    if (!d || d.allowed === false || !d.count || !(d.headroom > 0) || typeof r.reason !== "string" || !r.reason.trim()) continue;
    rows.push({ key: r.key, role: r.key.split("|")[1] || "", reason: r.reason, source: "weak-spots" });
  }
  return { status: "weak-spots", rows, missing: [], assumptions: ((fallback && fallback.assumptions) || []).slice() };
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
        // ONE PLAIN SENTENCE PER CARD (item 9, owner 2026-09-30). The caveats (joint practice, game
        // effects only) live once in `assumptions`, shown under "Why these decks?".
        reason: "Practising this could win you more games when " + ({ Top: "playing on top", Bottom: "playing from bottom",
          Attacker: "attacking", Defender: "defending" }[deck.role] || "using it") + ", from your chosen starts." };
      if (!rows.has(r.key) || rows.get(r.key).score < r.score) rows.set(r.key, r);
    }
  }
  const ruleset = context.modelStamp.ruleset || context.ruleset;
  const horizon = context.modelStamp.horizon || context.horizon;
  if (!["gi", "nogi"].includes(ruleset) || !horizon || !horizon.kind) return unavailable;
  return { kind: "learning-opportunity", stamp: context.stamp, status: result.status, rows: [...rows.values()], diagnostics: result,
    assumptions: ["Compared in " + (ruleset === "nogi" ? "no-gi" : "gi") + " from " + start.length + " chosen starting position" + (start.length === 1 ? "" : "s") + ", " +
        (horizon.kind === "actual-roll" ? "to the end of the current roll" : "with no move limit") + ", assuming the best moves before and after practising the material together.",
      "These are game effects; they don't measure improvement on the mat."] };
}

// PRACTICE IS ONE SESSION (owner U56 e, D-565): "Practice is flashcards reviewing which included past +
// new (new = gaps)… similar to how Anki mixes known + new cards." The ratio is counted in CARDS: a new
// deck is slipped in once the reviews before it pay four cards for every new card so far (80/20, the
// blend the owner chose for deck seasoning). Four keeps reviews the bulk of a heavy day without starving
// the gaps; two would double tomorrow's debt from a day already in debt. Decks are dealt WHOLE (a median
// of 8 cards), so the copy says "a new technique after every few reviews", never "one card per four"
// (SIDE-R2 M1). Reviews are never capped (goals, not limits).
// Not exported: the deferred chunk pays for every exported name, and nothing outside reads it.
const NG_PRACTICE_REVIEWS_PER_NEW = 4;
// THE DAY'S NEW-CARD QUOTA — the owner's number to set (his question U63); one line, so a change or a
// revert is one line. New cards fill what reviews leave of the goal (`left`, the goal less today's
// answers), and never fewer than one in five of it, so a heavy day still mixes; they stop once the day's
// answers reach the goal. Non-increasing in `due` (SIDE-R2 M2: the first curve gave 16 owed reviews 4 new
// cards and 77 owed the whole goal again). Goal 20: 20 new on a clear day, 4 once 16 or more are owed.
const ngPracticeRoom = (left, due) => Math.max(0, Math.min(left, Math.max(left - due, Math.ceil(left / (NG_PRACTICE_REVIEWS_PER_NEW + 1)))));

// the presenter's sentence for withheld material, verbatim (gameplan-study-presenter.src.js TEXT.limited)
const NG_GAMEPLAN_LIMITED = "Some compared material isn't in today's new cards; its effect is not counted in this plan.";
// Deck descriptors: {count, questions:[hash], exact, allowed, headroom, oddsFull?}.
// A manifest supplies shared hashes + stored SRS hashes before hydration. The
// remainder is counted as pending, never treated as already reviewed.
export function ngGameplanBuild({ day, ruleset, revision, stamp, target = 20, decks = {}, srs = {}, provider, fallback, worth }) {
  const debt = ngGameplanDebt({ srs, day, decks });
  const reviewed = ngGameplanReviewed(srs, day);
  let ranking = ngGameplanRecommendations(provider, stamp, decks);
  const comparison = ranking.status;
  if (fallback && ["unavailable", "pending", "stale"].includes(comparison)) ranking = ngGameplanWeakSpots(fallback, decks);
  // STAGE 2 (v1.256.0, review STAGE2E): a deck whose game odds the known moves already fill (`oddsFull`) has no in-game
  // headroom left for a comparison to rank (the presenter withholds it), while its flashcards are still new. It keeps
  // its weak-spots place AFTER every deck the comparison ranked, so a comparison never takes away what Practice offers.
  else if (fallback) {
    const ranked = new Set(ranking.rows.map((r) => r.key));
    const kept = ngGameplanWeakSpots(fallback, decks).rows.filter((r) => decks[r.key].oddsFull && !ranked.has(r.key));
    if (kept.length) ranking = { ...ranking, rows: ranking.rows.concat(kept) };
  }
  const budget = Math.max(0, Math.floor(Number.isFinite(target) ? target : 20)), left = budget - reviewed.length;
  // WHAT IS WORTH MOST (U171 a, v1.274.0): the day's rows come from practice-queue.src.js when the app hands it the game:
  // what is due first, worth most first, and a new card only when nothing is due (the owner's Anki rule, ANKI1).
  // Anything else (no game, no seat map, a record with no answer) is today's order below, and the plan says why.
  // a goal, never a cap: with nothing left of today's goal, Practice deals another round of the goal's size, by worth
  const order = worth ? ngGameplanOrder({ day, goal: left > 0 ? left : budget, srs, decks, revision, ...worth }) : null;
  if (order && order.status === "ok") return ngGameplanWorth({ day, ruleset, revision, stamp, budget, decks, debt, reviewed, ranking, comparison, order });
  const room = ngPracticeRoom(left, debt.count);
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
  // THE ONE QUEUE: due rows by urgency (ngGameplanDebt's order), and the next new deck once the reviews
  // placed have paid for every new card so far plus one; whatever kind runs out first, the other follows.
  const queue = [];
  let reviews = 0, learned = 0, next = 0;
  for (const r of debt.rows) {
    while (next < fresh.length && reviews >= NG_PRACTICE_REVIEWS_PER_NEW * (learned + 1)) { learned += fresh[next].count; queue.push(fresh[next++].key); }
    queue.push(r.key); reviews += r.count;
  }
  for (const r of fresh.slice(next)) queue.push(r.key);
  // WHERE TODAY'S NEW DECKS CAME FROM (v1.256.2), read by the summary and by Practice's count line, so the two
  // cannot disagree: all from the weak spots, all from the comparison, or the comparison's then the weak spots'
  // (decks the known moves fill, kept after the ranked ones).
  const kept = fresh.filter((r) => r.source === "weak-spots").length;
  const newFrom = !kept ? "comparison" : kept === fresh.length ? "weak-spots" : "mixed";
  // "Some compared material isn't in today's new cards" (the presenter's, when it withheld a deck: its file is in the
  // study bundle's law hashes, so it is matched here, never edited). A deck the moves fill is withheld AND kept, so
  // when EVERY withheld deck is in today's new cards the line is untrue and dropped; it stays while any is not
  // (the orchestrator's call, STAGE2H B a).
  const withheld = ((provider && provider.study && provider.study.groups) || []).filter((g) => g.status === "beneficial")
    .flatMap((g) => (g.members || []).filter((m) => m.withheld).map((m) => m.deck && m.deck.deckKey));
  const today = new Set(fresh.map((r) => r.key));
  const assumptions = withheld.length && withheld.every((k) => today.has(k))
    ? ranking.assumptions.filter((a) => a !== NG_GAMEPLAN_LIMITED) : ranking.assumptions;
  return ngGameplanFreeze({
    version: NG_GAMEPLAN_VERSION, day, ruleset, revision, stamp, target: budget, queue,
    reviewed, due: debt.rows, fresh, more, blocked: debt.blocked,
    dueQuestions: debt.questions, status: ranking.status, comparison, assumptions, newFrom, order: "oldest", orderStatus: order ? order.status : "off",
    missing: ranking.missing, room, newCards: spent, dueCards: debt.count,
    total: debt.count + spent, overrun: Math.max(0, reviewed.length + debt.count + spent - budget),
  });
}

// THE ORDER, KEPT FOR ITS INPUTS. The drawer's Practice row asks for a plan on every refresh (a grade, a payload), and the
// order walks every deck: ~20 ms a call where today's plan takes ~6. A grade or a pull replaces `srs` and `stage` and bumps
// the knowledge revision; a deck that loads flips `exact`; a ruleset flip or a new manifest is a new game. Any of them, or a
// new day or goal, builds it again; nothing else can change what it holds. THE REVISION
// IS LOAD-BEARING: `_schedule` (the reveal-unanswered path) edits `srs` IN PLACE, so the object alone would serve a stale
// order (the reader's R9; pinned in tests/practice_queue.test.mjs).
let ngGameplanOrderAt = null;
function ngGameplanOrder(input) {
  const exact = Object.values(input.decks).reduce((n, d) => n + (d.exact ? 1 : 0), 0);
  const key = [input.srs, input.stage, input.game, input.seats, input.day, input.goal, input.revision, exact];
  const c = ngGameplanOrderAt;
  if (c && c.key.every((v, i) => v === key[i])) return c.order;
  const order = ngPracticeOrder(input);
  ngGameplanOrderAt = { key, order };
  return order;
}

// THE WORTH PLAN (U171 a): the law's rows in the shape the page plays. A row that holds an owed card is a review row (its
// `owed` lists those cards; any new card of the same deck rides along), a row of new cards only is a new row. "Keep practising
// · more new cards" keeps today's ranking (the comparison, else the weak spots), whole decks, as it always has.
function ngGameplanWorth({ day, ruleset, revision, stamp, budget, decks, debt, reviewed, ranking, comparison, order }) {
  const card = (n) => n + (n === 1 ? " card" : " cards");
  const rows = order.rows.map((r) => ({ ...r, kind: r.owed.length ? "due" : "new",
    reason: !r.owed.length ? "New cards, picked for how often this comes up in your rolls." : r.count > r.owed.length
      ? card(r.owed.length) + " due for review, so you keep what you've learned, and " + (r.count - r.owed.length) + " new." : undefined }));
  const due = rows.filter((r) => r.kind === "due"), fresh = rows.filter((r) => r.kind === "new"), keys = new Set(rows.map((r) => r.key));
  const used = new Set([...reviewed, ...rows.flatMap((r) => r.questions)]), more = [];
  for (const [index, r] of ranking.rows.entries()) {
    const d = decks[r.key];
    if (keys.has(r.key) || !d) continue;
    const questions = [...new Set(d.questions || [])].filter((q) => !used.has(q)), pending = d.exact ? 0 : Math.max(0, d.count - (d.questions || []).length);
    if (questions.length + pending) more.push({ ...r, rank: index + 1, questions, pending, count: questions.length + pending, kind: "optional" });
  }
  for (const r of rows) {
    r.related = ranking.rows.filter((other) => other.key !== r.key && (decks[other.key].questions || []).some((q) => r.questions.includes(q)))
      .map((other) => ({ key: other.key, role: other.role, reason: other.reason }));
  }
  const dueQuestions = [...new Set(due.flatMap((r) => r.owed))];
  const newCards = rows.reduce((n, r) => n + r.count - r.owed.length, 0), total = dueQuestions.length + newCards;
  return ngGameplanFreeze({
    version: NG_GAMEPLAN_VERSION, day, ruleset, revision, stamp, target: budget, queue: rows.map((r) => r.key),
    reviewed, due, fresh, more, blocked: debt.blocked, dueQuestions, status: ranking.status, comparison,
    assumptions: ranking.assumptions, newFrom: "worth", order: "worth", orderStatus: "ok",
    visits: order.visits, counts: order.counts, missing: ranking.missing, room: newCards, newCards, dueCards: dueQuestions.length,
    total, overrun: Math.max(0, reviewed.length + total - budget),
    why: "Practice asks the cards that are due first, position by position, starting where it is worth most: what comes up most in " +
      "your rolls and what you are closest to forgetting. At each position it asks at most 6. The two cards due longest come every day, " +
      "so none waits forever. New cards come only when nothing is due. Correct answers make your moves more likely to work in the game; " +
      "that is not a measure of real grappling. A question two decks share counts once. \u201cKeep practising\u201d adds whole new " +
      "techniques: " + ranking.assumptions.join(" "),
  });
}

// THE PAGE'S TWO LINES FOR A WORTH PLAN (the heading over the open card, the count in "Practice details"), here so the eager
// bundle carries none of their copy. `live` is ngGameplanProgress's; `key` the open row's deck.
// A row the ORDER placed carries a numeric `visit`; a row appended by "More new cards" or a Path lesson does not (STAGE3-R1,
// the reader's finding 3: it printed "NaN"), so it is named apart, and its cards are counted apart, by how they were picked.
export function ngGameplanLines(plan, live, key) {
  if (!plan || plan.order !== "worth") return null;
  const rows = plan.due.concat(plan.fresh), row = rows.find((r) => r.key === key), n = plan.visits.length;
  const placed = (r) => typeof r.visit === "number" && r.visit >= 0, lesson = (r) => r.source === "lesson";
  // a Path lesson the player opened rides in the session apart from "More new cards" (STAGE3-R2 d): named and counted by how it came
  const apart = (keep) => rows.filter((r) => !placed(r) && keep(r)).reduce((k, r) => k + r.count - (r.owed ? r.owed.length : 0), 0);
  const extra = apart((r) => !lesson(r)), path = apart(lesson);
  const cards = (k) => k + (k === 1 ? " card" : " cards"), name = (seat) => (seat ? seat.replace("|", " \u00b7 ") : "Other cards");
  // new cards only when nothing is due (ANKI1): a day of reviews says so instead of "0 new"
  const fresh = plan.newCards - extra - path;
  return { heading: !row ? "Practice" : placed(row) ? name(row.seat) + " \u00b7 position " + (row.visit + 1) + " of " + n : lesson(row) ? "From the Path" : "More new cards",
    count: n + (n === 1 ? " position" : " positions") + ": " + (live.dueCards ? cards(live.dueCards) + " to review \u00b7 " : "") +
      (fresh ? fresh + " new, by how often they come up in your rolls" : "new cards come when nothing is due") +
      (extra ? "; " + extra + " more new, " + (plan.status === "weak-spots" ? "weakest first" : "ranked by your study comparison") : "") +
      (path ? "; " + path + " from the Path" : "") };
}

// Hydration binds unknown question identities without reranking the plan. Known
// identities never change underneath an answer. New content requires a refresh.
export function ngGameplanBind(plan, decks, srs) {
  if (plan.order === "worth") return ngGameplanBindWorth(plan, decks, srs);
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

// A worth row's placeholders become the deck's first cards with no row, once its cards land: never a card answered before,
// never one another row holds, and never more than the row asked for (U171 a's "at most 6 per position").
function ngGameplanBindWorth(plan, decks, srs) {
  const rows = plan.due.concat(plan.fresh), used = new Set([...plan.reviewed, ...rows.flatMap((r) => r.questions)]);
  const bind = (r) => {
    const d = decks[r.key];
    if (!r.pending || !d || !d.exact) return r;
    const answered = (srs && srs[r.key]) || {};
    const add = ngGameplanUnique(d.questions).filter((q) => !used.has(q) && !answered[q]).slice(0, r.pending);
    add.forEach((q) => used.add(q));
    return { ...r, questions: r.questions.concat(add), count: r.questions.length + add.length, pending: 0 };
  };
  const due = plan.due.map(bind), fresh = plan.fresh.map(bind);
  if (due.every((r, i) => r === plan.due[i]) && fresh.every((r, i) => r === plan.fresh[i])) return plan;
  const newCards = due.concat(fresh).reduce((n, r) => n + r.count - (r.owed ? r.owed.length : 0), 0), total = plan.dueCards + newCards;
  return ngGameplanFreeze({ ...plan, due, fresh, newCards, total, overrun: Math.max(0, plan.reviewed.length + total - plan.target) });
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
  // a worth plan is done when what it asked is answered: the owed pile beyond it is not the day's debt (U171 a)
  const worth = plan.order === "worth";
  const complete = day === plan.day && (worth || !debt.count) && rows.every((r) => r.done) && plan.dueQuestions.every((q) => reviewed.has(q));
  const required = ngGameplanUnique(plan.dueQuestions.concat(plan.due.concat(plan.fresh).flatMap((r) => r.questions)));
  const missing = rows.flatMap((r) => r.remaining.filter((q) => decks[r.key] && decks[r.key].exact && !decks[r.key].questions.includes(q)));
  return { rows, complete, dayChanged: day !== plan.day, dueCards: worth ? plan.dueQuestions.filter((q) => !reviewed.has(q) || owed.has(q)).length : debt.count,
    // a worth plan claims no new debt: a card that came due after it was built joins the next round by worth, or
    // "Everything owed", never this session (STAGE3-R1: a refresh no longer re-plans a session in progress)
    newDebt: worth ? [] : debt.questions.filter((q) => !plan.dueQuestions.includes(q)),
    completed: required.filter((q) => reviewed.has(q) && !owed.has(q)).length, total: plan.total,
    blocked: ngGameplanUnique(debt.blocked.concat(missing)) };
}

// PLAIN COPY (item 9 + D2, owner 2026-09-30). The counts live in the session's own headings, so this
// says only what they cannot: the daily goal, any overrun, and what ranks the new techniques. It is
// also the Explore cell's tooltip.
export function ngGameplanSummary(plan) {
  const cards = (n) => n + (n === 1 ? " card" : " cards");
  // v1.256.1 (STAGE2G): when EVERY new deck was kept from the weak spots (decks the known moves fill, which a
  // comparison cannot rank), the line says where they came from, never the comparison's "nothing new worth adding".
  // v1.256.2 (STAGE2H A a): ranked decks THEN kept ones read "ranked by your study comparison, then your weakest
  // spots", the partial status keeping its second sentence. A plan with no kept deck reads as it always did.
  const from = plan.status === "weak-spots" ? "comparison" : plan.newFrom;
  const source = plan.order === "worth" ? "Positions come in order of what is worth most: what comes up most in your rolls and what you are closest to forgetting." : {
    "weak-spots": "New techniques are your weakest spots first.",
    ready: "New techniques are ranked by your study comparison.",
    partial: "New techniques are ranked by your study comparison. Some could not be compared, which does not mean you've mastered them.",
    exhausted: "Your study comparison found nothing new worth adding. Reviews still count.",
    unavailable: "There is no ranking for new techniques yet. Reviews still count.",
    pending: "The ranking for new techniques is loading. Reviews still count.",
    stale: "The ranking for new techniques is out of date: refresh the plan. Reviews still count.",
    "ready+kept": "New techniques are ranked by your study comparison, then your weakest spots.",
    "partial+kept": "New techniques are ranked by your study comparison, then your weakest spots. Some could not be compared, which does not mean you've mastered them.",
  }[from === "weak-spots" ? "weak-spots" : from === "mixed" ? plan.status + "+kept" : plan.status];
  // Frozen with the plan, so it speaks of the time BEFORE it opened: the session heading below counts
  // what happens after (a live "you've answered 0 today" read wrong once the session was done).
  return "Your daily goal is " + cards(plan.target) +
    (plan.reviewed.length ? "; the " + cards(plan.reviewed.length) + " you'd already answered today count toward it." : ".") +
    (plan.overrun ? " Today's session runs " + cards(plan.overrun) + " over the goal." : "") +
    (plan.due.concat(plan.fresh).some((r) => r.pending) ? " Card counts settle as decks load." : "") + " " + source;
}
