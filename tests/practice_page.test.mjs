// THE PAGE AROUND THE ORDER (v1.274.0, STAGE3-R1: the independent read of PR #409) — the real `_practiceAppend`,
// `_practiceRows`, `_practiceNextRound` and `_openOwedPractice` of neural/src/app.src.jsx, on the real wire with every deck's
// cards loaded (the reader's scripts drove the same functions the same way), with the DOM-painting steps stubbed out.
//
//   · finding 2: the cold queue's first deck (the oldest debt, never chosen) no longer decides where Practice opens: the
//     plan's first position does, unless the player had moved;
//   · finding 4: a second plan landing on a session in progress changes none of its rows (only "More new cards" and the
//     plan's summary);
//   · finding 5: "Keep practising" deals the next round by worth into the same session, positions numbered on;
//   · finding 3: a row appended by "More new cards" is named apart in the session queue, never numbered (no "NaN");
//   · finding 1's door: "Everything owed, oldest first" is the eager cover over the whole owed pile, a deck the gi table gives
//     no weight included, and no plan lands on it.
//
// MUTANTS (v1.274.0), each alone on a clean tree, the diff hash checked after:
//   S1 the cold queue's open deck kept whether or not the player moved (finding 2)  → "Practice opens on the plan's first position"
//   S2 a second plan merged into a session in progress (finding 4)                 → "a second plan changes none of the rows in front of the player"
//   S3 the next round numbered from 0 again                                        → "Keep practising deals the next round into the same session"
//   S4 a visit-less row labelled by its (missing) number                           → "the session queue names an appended row apart"
//   S5 the owed session built from the worth plan (the door to the order again)    → "Everything owed is the whole owed pile, priced or not"
//
// Run: node --test tests/practice_page.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import * as G from "../neural/src/gameplan.src.js";
import * as GD from "../neural/src/gameplan-debt.src.js";
import { ngKnowledgeQuestionHash, ngKnowledgeScheduleRow } from "../neural/src/knowledge-profile.src.js";
import { ratingApp } from "./_rating_fixture.mjs";
import { orderFixture } from "./_practice_order_fixture.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = resolve(HERE, "../source/quartz/static/neural");
globalThis.ngGameplanReviewed = GD.ngGameplanReviewed; globalThis.ngGameplanDebt = GD.ngGameplanDebt;
const el = () => ({ attrs: {}, children: [], textContent: "", setAttribute(k, v) { this.attrs[k] = String(v); }, appendChild(c) { this.children.push(c); return c; }, querySelector() { return null; } });
globalThis.document = globalThis.document || { createElement: el };
const CARDS = (() => { const c = {}; for (const f of readdirSync(resolve(DIR, "flashcards")).sort()) if (f !== "_index.json") Object.assign(c, JSON.parse(readFileSync(resolve(DIR, "flashcards", f), "utf8"))); return c; })();

/** the app on the real wire, every deck's cards loaded, the page's painting stubbed; `blob` is the stored record */
function page(blob, day) {
  const a = ratingApp(DIR, "gi");
  for (const [dk, d] of Object.entries(a.flashcards.decks)) if (CARDS[dk]) d.cards = CARDS[dk].cards;
  a._epochDay = () => day; a._dayKey = () => "today"; a._days = {};
  a.srs = structuredClone(blob.srs); a.stage = structuredClone(blob.stage || {}); a.prep = {}; a.rec = {};
  a._gameplanRuntime = G; a.weakSpots = () => ({ cold: true, keys: Object.keys(a.flashcards.decks).filter((k) => k.endsWith("|Attacker")).slice(0, 30), veryWeak: [], weak: [] });
  a._checkKnowledgeDay = () => {}; a.startFrom = () => "standing"; a.fx = () => {}; a.track = () => {};
  const painted = { rendered: 0 };
  Object.assign(a, { _sessionInline: () => true, _deckState: {}, hydrateDecks: () => Promise.resolve(), _paintGameplanProgress: () => {},
    renderSession: () => { painted.rendered++; a._sessionOpeners = []; if (a._session) { a._session.visitShown = null; a._session.queue = el(); a._session.rows = Object.assign(el(), { isConnected: true }); a._practiceRows(a._session); } },
    _sessionRow: () => ({ el: el(), open() {} }), _sessionOpeners: [], nodeForKey: () => -1, _scrollFocusedDeck: () => {} });
  a.practiceToday = () => ({ done: GD.ngGameplanReviewed(a.srs, day).length, goal: 20 });
  return { a, painted };
}
/** the cold session exactly as openPlanSession builds it, before the planner lands */
function coldSession(a, day) {
  const review = { ...GD.ngGameplanDebt({ srs: a.srs, day, decks: a._gameplanDecks() }), day };
  const s = { practice: true, keys: review.rows.map((r) => r.key), review, idx: 0, anchor: "due", bucket: "plan", started: a.practiceToday().done,
    rows: Object.assign(el(), { isConnected: true }), queue: el() };
  a._session = s;
  return s;
}
/** the journey's player, with its heavy misses made the oldest debt: the cold queue opens on a deck the plan holds later */
function oldestInPlan() {
  const fx = orderFixture(DIR), day = fx.day, blob = structuredClone(fx.blob);
  return { fx, day, blob };
}

test("Practice opens on the plan's first position, not on the cold queue's first deck", () => {
  const { day, blob } = oldestInPlan();
  // find a deck the plan asks AFTER its first position, and make one of its owed cards the oldest debt of all
  const probe = page(blob, day).a, plan0 = probe.planSummary();
  const later = plan0.due.find((r) => r.visit >= 1 && r.owed.length);
  assert.ok(later, "premise: the plan reviews owed cards after its first position");
  const qh = later.owed[0];
  for (const dk of Object.keys(blob.srs)) if (blob.srs[dk][qh]) blob.srs[dk][qh] = [day - 400, 1, day - 401];
  const { a } = page(blob, day), s = coldSession(a, day);
  assert.equal(s.keys[0], later.key, "premise: the cold queue opens on that deck");
  const plan = a.planSummary();
  assert.ok(plan.queue.indexOf(later.key) > 0, "premise: the plan holds it, later than its first position");
  a._practiceAppend(s, plan);
  assert.equal(s.idx, 0, "the open card is the plan's first row");
  assert.equal(s.keys[0], plan.queue[0]);
  // a player who had moved keeps their deck
  const b = page(blob, day).a, t = coldSession(b, day);
  t.moved = true;
  b._practiceAppend(t, b.planSummary());
  assert.equal(t.keys[t.idx], later.key, "moved: the deck the player chose stays open");
});

/** a deep owed pile, as the reader's re-plan case had: 4 missed cards in each of the 50 position decks weighed most a card,
 *  so answering the first position's cards brings positions the first plan never held */
function deepPile(day) {
  const probe = page({ srs: {} }, day).a, U = probe._ratingGame("gi"), map = probe._practiceSeats(U);
  const decks = Object.keys(map).filter((k) => map[k] === k && U.deckUnit.has(k) && CARDS[k] && CARDS[k].cards.length >= 4)
    .sort((x, y) => U.deckUnit.get(y) - U.deckUnit.get(x) || (x < y ? -1 : 1)).slice(0, 50);
  const srs = {}, stage = {};
  for (const dk of decks) for (const c of CARDS[dk].cards.slice(0, 4)) {
    const qh = ngKnowledgeQuestionHash(c.q), list = U.shared.get(qh) || [dk];
    for (const k of list) { (srs[k] = srs[k] || {})[qh] = [day, 1, day - 1]; (stage[k] = stage[k] || {})[qh] = 0; }
  }
  return { srs, stage };
}

test("a second plan changes none of the rows in front of the player", () => {
  const day = orderFixture(DIR).day, blob = deepPile(day);
  const { a } = page(blob, day), s = coldSession(a, day);
  a._practiceAppend(s, a.planSummary());
  const before = { keys: s.keys.slice(), rows: JSON.stringify(s.plan.due.concat(s.plan.fresh).map((r) => [r.key, r.questions, r.visit])) };
  // the player answers the first position's cards, then a study comparison lands with a new plan
  const v0 = s.plan.due.concat(s.plan.fresh).filter((r) => r.visit === 0).flatMap((r) => r.questions);
  for (const qh of v0) {
    a.srs = structuredClone(a.srs);
    for (const dk of Object.keys(a.srs)) if (a.srs[dk][qh]) a.srs[dk][qh] = ngKnowledgeScheduleRow(a.srs[dk][qh], true, day);
  }
  // the player has also raised the daily goal to 40 in Settings meanwhile, so the new plan reaches positions the first did not
  a.get = (k, d) => (k === "dailyGoal" ? 40 : d);
  const second = a.planSummary();
  assert.ok(second.queue.some((k) => !before.keys.includes(k)), "premise: the second plan holds rows the first did not");
  a._practiceAppend(s, second, s.plan.fresh.length ? [] : null);   // what setGameplanRecommendations does
  assert.deepEqual(s.keys, before.keys, "the same rows, in the same order");
  assert.equal(JSON.stringify(s.plan.due.concat(s.plan.fresh).map((r) => [r.key, r.questions, r.visit])), before.rows, "and the same cards in them");
  assert.deepEqual(s.plan.more.map((r) => r.key), second.more.filter((r) => !before.keys.includes(r.key)).map((r) => r.key), "only More new cards follows the new plan");
});

test("Keep practising deals the next round into the same session, its positions numbered on", () => {
  const { day, blob } = oldestInPlan();
  const { a } = page(blob, day), s = coldSession(a, day);
  a._practiceAppend(s, a.planSummary());
  const first = { keys: s.keys.slice(), visits: s.plan.visits.length };
  // every card of the first round answered (a grade replaces the record, as the app's does)
  for (const r of s.plan.due.concat(s.plan.fresh)) {
    const cards = (CARDS[r.key] ? CARDS[r.key].cards : []).map((c) => ngKnowledgeQuestionHash(c.q));
    const qs = r.questions.concat(cards.filter((q) => !r.questions.includes(q) && !(a.srs[r.key] || {})[q]).slice(0, r.pending || 0));
    a.srs = structuredClone(a.srs);
    for (const qh of qs) (a.srs[r.key] = a.srs[r.key] || {})[qh] = ngKnowledgeScheduleRow((a.srs[r.key] || {})[qh] || null, true, day);
  }
  a._practiceNextRound(s);
  assert.deepEqual(s.keys.slice(0, first.keys.length), first.keys, "the first round's rows stay where they were");
  assert.ok(s.plan.visits.length > first.visits, "the next round's positions are added");
  const rows = s.plan.due.concat(s.plan.fresh);
  for (const r of rows) assert.ok(typeof r.visit === "number" && r.visit >= 0, r.key + " is placed");
  const added = rows.filter((r) => !first.keys.includes(r.key));
  assert.ok(added.length > 0, "the next round brings rows");
  for (const r of added) assert.ok(r.visit >= first.visits, `${r.key}: position ${r.visit + 1} comes after the first round's ${first.visits}`);
  const per = new Map(); for (const r of added) per.set(r.visit, (per.get(r.visit) || 0) + r.count);
  for (const [v, n] of per) assert.ok(n <= 6, `position ${v + 1}: ${n} cards`);
  assert.ok(s.moved, "the next round's first row is opened as the player's own move");
});

test("the session queue names an appended row apart, never by a number it does not have", () => {
  const { day, blob } = oldestInPlan();
  const { a } = page(blob, day), s = coldSession(a, day);
  a._practiceAppend(s, a.planSummary());
  const placed = s.queue.children.filter((c) => "data-practice-visit" in c.attrs).map((c) => c.textContent);
  assert.ok(placed.length >= 2 && placed.every((t) => /^\d+ · /.test(t)), JSON.stringify(placed));
  a._practiceAppend(s, s.plan, s.plan.more.slice(0, 10));   // More new cards
  const labels = s.queue.children.filter((c) => "data-practice-visit" in c.attrs).map((c) => c.textContent);
  assert.equal(labels[labels.length - 1], "More new cards", JSON.stringify(labels));
  assert.ok(labels.every((t) => !/NaN|undefined/.test(t)), JSON.stringify(labels));
  for (const k of s.keys) { const L = G.ngGameplanLines(s.plan, { dueCards: 1 }, k); assert.doesNotMatch(L.heading + " " + L.count, /NaN|undefined/, k); }
});

test("Everything owed is the whole owed pile, oldest first, priced or not, and no plan lands on it", () => {
  const { day, blob } = oldestInPlan();
  // a deck the gi ruleset allows but the gi table gives no weight (Buggy Choke, the heel hooks: the reader's 38)
  const probe = page(blob, day).a, W = probe.scoreWeights("gi");
  const unpriced = Object.keys(probe.flashcards.decks).filter((k) => !(k in W) && CARDS[k] && probe.nodeForKey && (() => { const i = probe.constructor.prototype.nodeForKey.call(probe, k); return i >= 0 && probe.rsAllowsIdx(i); })()).sort()[0];
  assert.ok(unpriced, "premise: a deck allowed in gi with no gi weight");
  const q = ngKnowledgeQuestionHash(CARDS[unpriced].cards[0].q);
  blob.srs[unpriced] = { [q]: [day - 2, 3, day - 5] };
  const { a } = page(blob, day);
  const debt = GD.ngGameplanDebt({ srs: a.srs, day, decks: a._gameplanDecks() });
  a._session = { practice: true, keys: [], origin: { view: "explore" } };
  a._openOwedPractice();
  const s = a._session;
  assert.ok(s.owed, "a session of its own");
  assert.deepEqual(s.keys, debt.rows.map((r) => r.key), "every owed deck, the cover, most overdue first");
  assert.ok(s.keys.includes(unpriced), "the deck the gi table does not price is there");
  assert.equal(s.review.count, a.dueCount(), "every owed card");
  const keys = s.keys.slice();
  a._practiceAppend(s, a.planSummary());
  assert.deepEqual(s.keys, keys, "no plan lands on it");
  assert.equal(s.plan, undefined);
  // and the order itself never asks that deck
  assert.ok(!a.planSummary().queue.includes(unpriced));
});
