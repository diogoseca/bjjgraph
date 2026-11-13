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
//     no weight included, and no plan lands on it;
//   · STAGE3-R2: the next round's positions numbered without a gap (a), the day's floor counting a new card the first time it
//     is answered, right or wrong, on any surface (b), and a Path lesson named and counted as one (d).
//
// MUTANTS (v1.274.0), each alone on a clean tree, the diff hash checked after:
//   S1 the cold queue's open deck kept whether or not the player moved (finding 2)  → "Practice opens on the plan's first position"
//   S2 a second plan merged into a session in progress (finding 4)                 → "a second plan changes none of the rows in front of the player"
//   S3 the next round numbered from 0 again                                        → "Keep practising deals the next round into the same session"
//   S4 a visit-less row labelled by its (missing) number                           → "the session queue names an appended row apart"
//   S5 the owed session built from the worth plan (the door to the order again)    → "Everything owed is the whole owed pile, priced or not"
// STAGE3-R2 (the reader's delta read, items a, b and d):
//   S6  the floor read off `_days[today]` again (every first-RIGHT answer, owed included) → "an owed card answered right is not a new card"
//   S6b a card revealed unanswered (`_schedule`) not counted as met                       → "…revealed unanswered on a roll's landing is met too"
//   S6c every graded card counted as new (no row check)                                    → "an owed card answered right is not a new card"
//   S6d the grade path's note removed (only a reveal counts)                             → "a new card answered WRONG is a new card met"
//   S7  the next round's positions not renumbered (the reader's 1 … 6, 8, 9)               → "every position counted is a position shown"
//   S8  a Path lesson's row not marked as one                                              → the queue's last label is "From the Path"
//   S9  the count line counting a lesson under "More new cards"                            → "; N from the Path"
//   S10 the door's visit sent as the page's (`surface: "practice"`)                        → "one Practice visit, from the door"
// NOT COVERED here: a reload restarts the day's set of new cards met (it is kept in memory, by design: the stored record
// cannot tell a first answer from a miss); nothing pins that a reload gives at most 4 more, because nothing can.
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
  const tracked = []; a.track = (name, data) => tracked.push([name, data]);
  a._openOwedPractice();
  const s = a._session;
  assert.ok(s.owed, "a session of its own");
  assert.deepEqual(tracked, [["neural_practice_opened", { surface: "owed" }]], "one Practice visit, from the door (docs/SEO.md, Practice visits)");
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

/** the reader's construction for item a (keeppractising2.mjs): one owed card in each of the 12 decks the gi table weighs most
 *  a card, so the next round's positions reach decks the first round already holds */
function twelveHeaviest(day) {
  const probe = page({ srs: {} }, day).a, U = probe._ratingGame("gi"), decks = probe._gameplanDecks(true);
  const keys = Object.keys(decks).filter((k) => typeof U.deckUnit.get(k) === "number" && (decks[k].questions || []).length)
    .sort((x, y) => U.deckUnit.get(y) - U.deckUnit.get(x) || (x < y ? -1 : 1)).slice(0, 12);
  const srs = {}, stage = {};
  for (const dk of keys) { const q = decks[dk].questions[0]; srs[dk] = { [q]: [day, 1, day - 1] }; stage[dk] = { [q]: 0 }; }
  return { srs, stage };
}

test("Keep practising numbers the positions the player sees without a gap (STAGE3-R2 a)", () => {
  const day = orderFixture(DIR).day;
  const { a } = page(twelveHeaviest(day), day), s = coldSession(a, day);
  a._practiceAppend(s, a.planSummary());
  const first = { keys: s.keys.slice(), visits: s.plan.visits.length };
  const decks = a._gameplanDecks(true);
  // the round is done: every card of it answered, in every deck that holds it (the grade path writes them all)
  a.srs = structuredClone(a.srs);
  for (const r of s.plan.due.concat(s.plan.fresh)) for (const q of r.questions)
    for (const dk of Object.keys(decks)) if ((decks[dk].questions || []).includes(q)) (a.srs[dk] = a.srs[dk] || {})[q] = ngKnowledgeScheduleRow((a.srs[dk] || {})[q] || null, true, day);
  const next = a.planSummary();
  assert.ok(next.visits.some((v) => v.keys.length && v.keys.every((k) => first.keys.includes(k))),
    "premise: a position of the next round holds only decks the first round already has (the reader's 1 … 6, 8, 9)");
  a._practiceNextRound(s);
  const rows = s.plan.due.concat(s.plan.fresh), n = s.plan.visits.length;
  const shown = [...new Set(rows.map((r) => r.visit).filter((v) => typeof v === "number"))].sort((x, y) => x - y);
  assert.deepEqual(shown, [...Array(n).keys()], "every position counted is a position shown, numbered 1 to " + n);
  const labels = s.queue.children.filter((c) => /^\d+$/.test(c.attrs["data-practice-visit"] || "")).map((c) => +c.textContent.split(" ")[0]);
  assert.deepEqual(labels, [...Array(labels.length).keys()].map((i) => i + 1), "the queue's numbers: " + labels.join(", "));
  assert.equal(labels.length, n, "the queue names every position once");
  for (const k of s.keys) {
    const h = G.ngGameplanLines(s.plan, { dueCards: 1 }, k).heading, m = /position (\d+) of (\d+)/.exec(h);
    if (m) assert.ok(+m[1] <= +m[2] && +m[2] === n, k + ": " + h);
  }
  assert.deepEqual(s.keys.slice(0, first.keys.length), first.keys, "the first round's rows stay where they were");
});

test("a Path lesson opened into Practice is named and counted as one, not as More new cards (STAGE3-R2 d)", async () => {
  const { day, blob } = oldestInPlan();
  const { a } = page(blob, day), s = coldSession(a, day);
  a._practiceAppend(s, a.planSummary());
  const decks = a._gameplanDecks();
  const key = Object.keys(decks).sort().find((k) => !s.keys.includes(k) && decks[k].allowed && decks[k].count > 0 && !s.plan.more.some((r) => r.key === k));
  assert.ok(key, "premise: a lesson deck the session does not hold");
  Object.assign(a, { beltUnlocked: () => true, _lessonIndex: { [key]: { belt: "white" } }, _ensureGameplanRuntime: () => Promise.resolve(true), _afterPress: (f) => f() });
  a._practiceAppend(s, s.plan, s.plan.more.slice(0, 2));   // More new cards first, so both kinds are on the page
  a._practiceLesson(key);
  await new Promise((r) => setTimeout(r, 0));
  assert.ok(s.keys.includes(key), "the lesson is in the session");
  const labels = s.queue.children.filter((c) => "data-practice-visit" in c.attrs).map((c) => c.textContent);
  assert.equal(labels[labels.length - 1], "From the Path", JSON.stringify(labels));
  assert.ok(labels.includes("More new cards"), "the More new cards rows keep their own name");
  const row = s.plan.fresh.find((r) => r.key === key), L = G.ngGameplanLines(s.plan, { dueCards: 1 }, key);
  assert.equal(L.heading, "From the Path");
  assert.match(L.count, new RegExp("; " + row.count + " from the Path$"), L.count);
  const more = s.plan.fresh.filter((r) => typeof r.visit !== "number" && r.source !== "lesson").reduce((k, r) => k + r.count, 0);
  assert.ok(more > 0 && L.count.includes("; " + more + " more new, "), "More new cards counted without the lesson: " + L.count);
});

test("the day's floor counts a new card the first time it is answered, right or wrong, on any surface (STAGE3-R2 b)", () => {
  const { day, blob } = oldestInPlan();
  const { a } = page(blob, day);
  Object.assign(a, { _progressCurrent: () => true, _publishKnowledge: () => {}, _knowledgeEffect: () => {} });
  const seen = [];
  a._gameplanRuntime = { ...G, ngGameplanBuild: (x) => { seen.push(x.worth.newToday); return G.ngGameplanBuild(x); } };
  const card = (dk, qh) => CARDS[dk].cards.find((c) => ngKnowledgeQuestionHash(c.q) === qh);
  const rowOf = (qh) => Object.values(a.srs).some((m) => m && m[qh]);
  const owedKey = Object.keys(blob.srs).sort().find((dk) => CARDS[dk] && Object.entries(blob.srs[dk]).some(([qh, r]) => r[0] <= day && r[2] < day && card(dk, qh)));
  const owedQ = Object.entries(blob.srs[owedKey]).find(([qh, r]) => r[0] <= day && r[2] < day && card(owedKey, qh))[0];
  const freshKey = Object.keys(CARDS).sort().find((dk) => a.flashcards.decks[dk] && CARDS[dk].cards.length >= 2 && CARDS[dk].cards.every((c) => !rowOf(ngKnowledgeQuestionHash(c.q))));
  const [n1, n2] = CARDS[freshKey].cards;
  const plan = () => { a.planSummary(); return seen[seen.length - 1]; };
  assert.equal(plan(), 0, "nothing met yet today");
  assert.equal(a._gradeKnowledge(owedKey, card(owedKey, owedQ), true, "recall", null, "t1", "practice").status, "applied");
  assert.equal(plan(), 0, "an owed card answered right is not a new card (v1.274.0's first push counted it)");
  a._gradeKnowledge(freshKey, n1, false, "recall", null, "t2", "practice");
  assert.equal(plan(), 1, "a new card answered WRONG is a new card met");
  a._schedule(freshKey, n2.q, false);
  assert.equal(plan(), 2, "a new card revealed unanswered on a roll's landing is met too");
  a._gradeKnowledge(freshKey, n1, true, "mc", null, "t3", "land");
  assert.equal(plan(), 2, "the same card met again is not a second new card");
  a._epochDay = () => day + 1;
  assert.equal(plan(), 0, "a new day starts again");
});
