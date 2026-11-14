// THE PAGE AROUND THE ORDER (v1.278.0, STAGE3-R1: the independent read of PR #409) — the real `_practiceAppend`,
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
//   · STAGE3-R2: the next round's positions numbered without a gap (a) and a Path lesson named and counted as one (d). Item b
//     (the day's floor of 4 new counting a card the first time it is answered, kept in memory by the two writers of a first
//     row) left with the floor it counted for: under the owner's Anki rule (ANKI1) no place is kept for new cards, so the
//     law reads no count of them; its test and its mutants S6 to S6d went with it.
//
// MUTANTS (v1.278.0), each alone on a clean tree, the diff hash checked after:
//   S1 the cold queue's open deck kept whether or not the player moved (finding 2)  → "Practice opens on the plan's first position"
//   S2 a second plan merged into a session in progress (finding 4)                 → "a second plan changes none of the rows in front of the player"
//   S3 the next round numbered from 0 again                                        → "Keep practising deals the next round into the same session"
//   S4 a visit-less row labelled by its (missing) number                           → "the session queue names an appended row apart"
//   S5 the owed session built from the worth plan (the door to the order again)    → "Everything owed is the whole owed pile, priced or not"
// STAGE3-R2 (the reader's delta read, items a and d):
//   S7  the next round's positions not renumbered (the reader's 1 … 6, 8, 9)               → "every position counted is a position shown"
//   S8  a Path lesson's row not marked as one                                              → the queue's last label is "From the Path"
//   S9  the count line counting a lesson under "More new cards"                            → "; N from the Path"
//   S10 the door's visit sent as the page's (`surface: "practice"`)                        → "one Practice visit, from the door"
// R409 (the reader's finding 1: the guard and the live set; the pure order's half is tests/practice_queue.test.mjs):
//   G3 the re-plan removed (an untouched session keeps the plan it took without the set)  → "an untouched session takes its plan again…"
//   G4 the re-plan on a touched session (touched read as untouched)                         → "a touched session keeps its plan…"
//   G5 the re-plan firing twice (the once-flag `guardSettled` removed)                       → "the plan is taken again once…"
//   G6 the event dropped                                                                     → "a touched session keeps its plan…", and the failed and ended ones
// R409-R1 (the reader's read of #415):
//   P1 the open row not kept (`keepOpen` not read: the re-plan opens row 0)                 → "the card on screen never changes…" (its adversarial record)
//   P2 a new plan without the open card taken anyway                                        → "a new plan that does not hold the card on screen is not taken"
//   P3 the guard asked only when no plan was mounted (`!old`, finding 2)                    → "a session that began on today's order is waited for…"
//   P4 every kept plan's word one word again (`failed` for unasked, fallback; nothing for short) → "each plan kept or taken without a whole guard says why…"
// ANKI1-R1 (the reader's delta read): R2c, a gone card keeping its row open → "a session whose row turns out gone from its
//   deck completes, and Keep practising is on its card"; R4, the law's visits not carried to the page → "Keep practising
//   deals the next round…" (at most 6 a visit, the true claim since the page folds a position's second visit into its first)
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
import { ratingApp, ratingLiveFiles } from "./_rating_fixture.mjs";
import { orderFixture, guardFixture } from "./_practice_order_fixture.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = resolve(HERE, "../source/quartz/static/neural");
globalThis.ngGameplanReviewed = GD.ngGameplanReviewed; globalThis.ngGameplanDebt = GD.ngGameplanDebt;
// a DOM element as far as the page's painters touch it (`style` and listeners since ANKI1-R1: the completion card is built here)
const el = () => ({ attrs: {}, children: [], textContent: "", style: {}, listeners: {}, setAttribute(k, v) { this.attrs[k] = String(v); }, appendChild(c) { this.children.push(c); return c; }, querySelector() { return null; },
  addEventListener(k, fn) { (this.listeners[k] = this.listeners[k] || []).push(fn); } });
globalThis.document = globalThis.document || { createElement: el };
const CARDS = (() => { const c = {}; for (const f of readdirSync(resolve(DIR, "flashcards")).sort()) if (f !== "_index.json") Object.assign(c, JSON.parse(readFileSync(resolve(DIR, "flashcards", f), "utf8"))); return c; })();

/** the app on the real wire, every deck's cards loaded, the page's painting stubbed; `blob` is the stored record. R409:
 *  `{bare: true}` loads no deck and leaves the rating's live set unasked (a fresh page) */
function page(blob, day, { bare = false } = {}) {
  const a = ratingApp(DIR, "gi", { live: !bare });
  if (!bare) for (const [dk, d] of Object.entries(a.flashcards.decks)) if (CARDS[dk]) d.cards = CARDS[dk].cards;
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
  // at most 6 a VISIT (ANKI1-R1, the reader's finding 4): a position the law visits again while its cards are due shows them
  // all, folded; until then this read "at most 6 cards a position" off the page's rows
  for (const [seat, n] of s.plan.counts.lawVisits) assert.ok(n <= 6, `${seat}: a visit of ${n}`);
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


test("a session whose row turns out gone from its deck completes, and Keep practising is on its card (ANKI1-R1)", () => {
  // the reader's finding 2: the plan is built before a deck loads and asks a question that deck no longer has; the deck
  // lands without it. Until ANKI1-R1 that row never emptied: no completion card, no "Keep practising"
  const { fx, day, blob } = oldestInPlan();
  const H = fx.heavy[0];
  blob.srs[H] = { ...blob.srs[H], dead0000: [day - 300, 7, day - 307] }; (blob.stage[H] = blob.stage[H] || {}).dead0000 = 2;
  const { a } = page(blob, day);
  a._ratingLiveNow = () => undefined;                // no live set in hand yet
  const cards = a.flashcards.decks[H].cards; delete a.flashcards.decks[H].cards;   // and its deck not loaded
  const s = coldSession(a, day), plan = a.planSummary();
  assert.ok(plan.dueQuestions.includes("dead0000"), "premise: the plan asked it");
  a.flashcards.decks[H].cards = cards;               // the deck lands, without it
  a._practiceAppend(s, plan);
  // every card the session can show answered (a grade writes every deck that holds it, as the app's does)
  for (const r of s.plan.due.concat(s.plan.fresh)) {
    const deckQs = (CARDS[r.key] ? CARDS[r.key].cards : []).map((c) => ngKnowledgeQuestionHash(c.q));
    const qs = r.questions.concat(deckQs.filter((q) => !r.questions.includes(q) && !(a.srs[r.key] || {})[q]).slice(0, r.pending || 0)).filter((q) => q !== "dead0000");
    a.srs = structuredClone(a.srs);
    for (const qh of qs) for (const dk of new Set([r.key, ...Object.keys(a.srs).filter((k) => a.srs[k][qh])])) (a.srs[dk] = a.srs[dk] || {})[qh] = ngKnowledgeScheduleRow((a.srs[dk] || {})[qh] || null, true, day);
  }
  const p = a._gameplanProgress(s);
  assert.equal(p.complete, true, "done: the gone card does not hold the session open");
  assert.ok(p.blocked.includes("dead0000"), "it is counted (the polite line: it stays due)");
  const done = a._sessionDoneCard(s), next = done.children.find((c) => c.attrs && c.attrs["data-plan-next"]);
  assert.ok("data-session-complete" in done.attrs, "the completion card");
  assert.ok(next && next.textContent === "Keep practising", "and Keep practising on it");
});

// ── R409: the guard and the live set ─────────────────────────────────────────────────────────────────────────────────────
// The real `ratingCheck` asks for the live files through `fetch`; here each ask is HELD until `release(ok)` lets it land (the
// payload's own files, or a failed answer), and `release` resolves once the check's chain, the guard's settle included, has
// run. The session is opened as the app opens it at the tap, with the check in flight: `coldSession`, then the plan.
const LIVE = ratingLiveFiles(DIR);
function held(a) {
  let open;
  const gate = new Promise((r) => (open = r));
  globalThis.fetch = (url) => gate.then((ok) => ({ ok, json: () => Promise.resolve(ok ? LIVE[+/live-(\d+)\.json/.exec(url)[1]] : null) }));
  const check = a.ratingCheck();
  return (ok = true) => { open(ok); return check; };
}
function guardSession(opts = {}) {
  const fx = guardFixture(DIR), { a, painted } = page(opts.blob || fx.blob, fx.day, { bare: true });
  const tracked = []; a.track = (name, props) => tracked.push([name, props]);
  if (opts.unlisted) {
    // a live set that does not list one deck (its own deck of the three): the plan taken again is short that one card
    const from = a._ratingLiveFrom.bind(a);
    a._ratingLiveFrom = (files, fp) => { const r = from(files, fp); if (r.decks) r.decks.delete(fx.light[0]); return r; };
  }
  const release = held(a);
  assert.equal(a._ratingLiveNow().status, "checking", "premise: the check is in flight at the tap");
  const s = coldSession(a, fx.day);
  a._practiceAppend(s, a.planSummary());
  // the open deck's cards land, as they do while the player reads it (R409-R1: the card on screen is then a fact to keep)
  if (opts.loadOpen && CARDS[s.keys[s.idx]]) a.flashcards.decks[s.keys[s.idx]].cards = CARDS[s.keys[s.idx]].cards;
  const rows = () => JSON.stringify(s.plan.due.concat(s.plan.fresh).map((r) => [r.key, r.questions, r.visit]));
  const asked = () => fx.oldest.filter((q) => s.plan.dueQuestions.includes(q)).length;
  assert.equal(s.plan.order, "worth");
  assert.deepEqual([s.plan.guarded, asked(), s.plan.dueCards], [false, 0, 20], "premise: mounted without the guard, the three due longest not asked");
  assert.ok(!s.plan.why.includes("The three cards due longest"), "and the explanation does not claim the guard");
  // what the player reads: the open row, and the card the page shows in it (the deck's cards the row asks, in the deck's order,
  // at the deck's inline index: `_sessionRow` and `_miniDeck`)
  const shown = () => {
    const k = s.keys[s.idx], row = s.plan.due.concat(s.plan.fresh).find((r) => r.key === k), st = a._deckState[k];
    const only = (a._cardsOf(a.flashcards.decks[k]) || []).filter((c) => row && row.questions.includes(a.qhash(c.q)));
    return k + " :: " + ((only[st ? st.idx : 0] || {}).q || "(no card loaded)");
  };
  return { fx, a, s, painted, tracked, release, rows, asked, shown };
}

test("an untouched session takes its plan again, once, when the live set lands after the tap (R409)", async () => {
  const { a, s, painted, tracked, release, asked } = guardSession();
  const first = s.keys[0], rendered = painted.rendered;
  await release(true);
  assert.equal(a._ratingLiveNow().status, "ok");
  assert.deepEqual([s.plan.guarded, asked(), s.plan.dueCards], [true, 3, 20], "the three due longest are among the 20");
  assert.ok(s.plan.why.includes("The three cards due longest come every day"), "and now the explanation says so");
  assert.equal(painted.rendered, rendered + 1, "the page was laid out again, once");
  assert.deepEqual([s.idx, s.keys[0]], [0, first], "on the same first position: what the player sees first does not change for this player");
  assert.deepEqual(tracked, [], "taken again: no event");
});

test("a touched session keeps its plan when the live set lands, and says so once (R409)", async () => {
  // touched three ways: a row opened, a card turned, a card answered. The second-plan law stays: the rows do not move.
  for (const how of ["moved", "turned", "answered"]) {
    const { a, s, tracked, release, rows, asked } = guardSession();
    const before = { keys: s.keys.slice(), rows: rows() };
    if (how === "moved") s.moved = true;
    if (how === "turned") a._deckState[s.keys[s.idx]] = { idx: 0, revealed: true };
    if (how === "answered") { const t = a.practiceToday(); a.practiceToday = () => ({ ...t, done: t.done + 1 }); }
    await release(true);
    assert.deepEqual(s.keys, before.keys, how + ": the same rows, in the same order");
    assert.equal(rows(), before.rows, how + ": and the same cards in them");
    assert.deepEqual([s.plan.guarded, asked()], [false, 0], how + ": the plan it took");
    assert.deepEqual(tracked, [["neural_practice_unguarded", { reason: "touched", short: 3, owed: s.plan.counts.law.owed }]], how + ": one event, counts only");
    // a study comparison landing later keeps the explanation true of these rows (the guard sentence not said)
    a._practiceAppend(s, a.planSummary(), []);
    assert.equal(rows(), before.rows, how + ": a second plan moves nothing either");
    assert.ok(!s.plan.why.includes("The three cards due longest"), how + ": and the explanation still does not claim the guard");
  }
});

test("a session whose check failed, or that was left, keeps its plan and says which (R409)", async () => {
  const f = guardSession();
  const before = f.rows();
  await f.release(false);
  assert.equal(f.a._ratingLiveNow().status, "unchecked", "premise: the check failed");
  assert.equal(f.rows(), before, "failed: the plan it took");
  assert.deepEqual(f.tracked.map((t) => t[1].reason), ["failed"]);
  // the next open asks again and the set lands: the session stays as it was, and says nothing more
  await held(f.a)(true);
  assert.equal(f.a._ratingLiveNow().status, "ok");
  assert.equal(f.rows(), before, "a later check does not re-plan a settled session");
  assert.equal(f.tracked.length, 1, "nor send a second event");
  const e = guardSession();
  e.a._session = null;   // the player closed Practice before the set landed
  await e.release(true);
  assert.deepEqual(e.tracked.map((t) => t[1].reason), ["ended"]);
});

test("the plan is taken again once, even when a second check lands on a plan still short (R409)", async () => {
  // a set that does not list the deck of one of the three: the plan taken again holds two of them and is still short one
  const { a, s, painted, tracked, release, asked } = guardSession({ unlisted: true });
  await release(true);
  assert.deepEqual([s.plan.guarded, asked()], [false, 2], "taken again with the set: two of the three, the third not known");
  const after = painted.rendered, rows = JSON.stringify(s.plan.due.map((r) => [r.key, r.questions]));
  // a second check lands (a new manifest's, say): the session is not planned a third time
  a._ratingLive = null;
  await held(a)(true);
  assert.equal(painted.rendered, after, "laid out once, not twice");
  assert.equal(JSON.stringify(s.plan.due.map((r) => [r.key, r.questions])), rows);
  // still short with the set in hand: said, once (R409-R1, the reader's finding 3: until then it said nothing)
  assert.deepEqual(tracked.map((t) => [t[1].reason, t[1].short]), [["short", 1]]);
});

// ── R409-R1: the card on screen, today's order turning worth, the event's words ───────────────────────────────────────────
/** the reader's adversarial record (finding 1 of #415): the guard fixture plus one more debt, the oldest of all, in ANOTHER
 *  deck at the seat the plan opens on, unshared and in that deck only. Once the set lands the guard takes it, and the guard's
 *  cards lead their position, so the new plan's first row is that deck. Chosen by rule from the payload, never by a key. */
function adversarialRecord() {
  const fx = guardFixture(DIR), probe = page(fx.blob, fx.day, { bare: true }).a;
  const s0 = coldSession(probe, fx.day); probe._practiceAppend(s0, probe.planSummary());
  const first = s0.keys[s0.idx], game = probe._ratingGame("gi"), seats = probe._practiceSeats(game), decks = probe._gameplanDecks(true);
  const decksOf = new Map();
  for (const [dk, d] of Object.entries(CARDS)) for (const c of (d && d.cards) || []) { const q = ngKnowledgeQuestionHash(c.q); decksOf.set(q, (decksOf.get(q) || new Set()).add(dk)); }
  const held = new Set(Object.values(fx.blob.srs).flatMap((r) => Object.keys(r)));
  for (const dk of Object.keys(seats).filter((k) => seats[k] === seats[first] && k !== first && CARDS[k] && typeof game.deckUnit.get(k) === "number" && decks[k] && decks[k].allowed !== false).sort()) {
    const q = CARDS[dk].cards.map((c) => ngKnowledgeQuestionHash(c.q)).find((h) => !(game.shared && game.shared.get(h)) && !held.has(h) && decksOf.get(h).size === 1);
    if (!q) continue;
    const blob = structuredClone(fx.blob);
    (blob.srs[dk] = blob.srs[dk] || {})[q] = [fx.day - 500, 7, fx.day - 507]; (blob.stage[dk] = blob.stage[dk] || {})[q] = 1;
    return { blob, first, deck: dk, q };
  }
  throw new Error("no other deck at " + seats[first] + " with an unshared card of its own");
}

test("the card on screen never changes under an untouched player when the plan is taken again (R409-R1)", async () => {
  const adv = adversarialRecord();
  const g = guardSession({ blob: adv.blob, loadOpen: true });
  const before = { open: g.shown(), at: g.s.keys[g.s.idx] };
  assert.equal(before.at, adv.first, "premise: the plan taken without the set opens where the probe found it");
  assert.ok(!before.open.endsWith("(no card loaded)"), "premise: a card is on screen: " + before.open);
  await g.release(true);
  assert.equal(g.s.plan.guarded, true, "taken again with the set");
  assert.ok(g.s.plan.dueQuestions.includes(adv.q), "the oldest debt of all is among the 20");
  assert.equal(g.s.keys[0], adv.deck, "premise: the new plan's first row is the other deck at that seat (where row 0 would have opened)");
  assert.equal(g.s.keys[g.s.idx], before.at, "the open row is the one the player was reading");
  assert.equal(g.shown(), before.open, "and so is the card in it");
  assert.deepEqual(g.tracked, [], "taken again: no event");
});

test("a new plan that does not hold the card on screen is not taken (R409-R1)", async () => {
  const g = guardSession({ loadOpen: true }), k = g.s.keys[g.s.idx], before = { rows: g.rows(), open: g.shown() };
  // the new plan without the open row (the planner never drops it in practice; the branch is the rule's, so it is forced)
  const real = g.a.planSummary.bind(g.a);
  g.a.planSummary = () => { const p = real(); return { ...p, due: p.due.filter((r) => r.key !== k), fresh: p.fresh.filter((r) => r.key !== k) }; };
  await g.release(true);
  assert.deepEqual([g.rows(), g.shown()], [before.rows, before.open], "the plan it took, the card it shows");
  assert.deepEqual(g.tracked.map((t) => t[1].reason), ["reading"], "said under its own word: nothing was touched");
});

test("a session that began on today's order is waited for when its plan turns worth (R409-R1, finding 2)", async () => {
  // the slow first visit: the game is not in at the tap, so the session mounts today's order; the worth plan lands while the
  // live check is still in flight (as a study comparison delivers it), and merges as worth
  const fx = guardFixture(DIR), { a, painted } = page(fx.blob, fx.day, { bare: true });
  const tracked = []; a.track = (name, props) => tracked.push([name, props]);
  const release = held(a), s = coldSession(a, fx.day), real = a._ratingGame.bind(a);
  a._ratingGame = () => ({ status: "no-weights", total: 0, counts: {} });
  a._practiceAppend(s, a.planSummary());
  assert.equal(s.plan.order, "oldest", "premise: today's order at the tap");
  a._ratingGame = real;
  a._practiceAppend(s, a.planSummary(), s.plan.fresh.length ? [] : null);
  assert.deepEqual([s.plan.order, s.plan.guarded, a._guardWait === s], ["worth", false, true], "worth, short, and waiting for the set");
  const rendered = painted.rendered;
  await release(true);
  assert.deepEqual([s.plan.guarded, fx.oldest.filter((q) => s.plan.dueQuestions.includes(q)).length], [true, 3], "untouched: taken again, the three among the 20");
  assert.equal(painted.rendered, rendered + 1);
  assert.deepEqual(tracked, []);
});

test("each plan kept or taken without a whole guard says why, in its own word (R409-R1, finding 3)", async () => {
  const fx = guardFixture(DIR);
  const words = (a) => a.__t.map((t) => t[1].reason);
  const mk = () => { const { a } = page(fx.blob, fx.day, { bare: true }); a.__t = []; a.track = (n, p) => a.__t.push([n, p]); return a; };
  // UNASKED: no check for this deck list (never asked; or a set kept for another manifest or fingerprint): said at once
  const u = mk(), su = coldSession(u, fx.day);
  assert.equal(u._ratingLiveNow(), undefined, "premise: never asked");
  u._practiceAppend(su, u.planSummary());
  assert.deepEqual(words(u), ["unasked"]);
  // SHORT, mounted with the set already in hand: a deck the live files do not list
  const h = mk(), from = h._ratingLiveFrom.bind(h);
  h._ratingLiveFrom = (files, fp) => { const r = from(files, fp); if (r.decks) r.decks.delete(fx.light[0]); return r; };
  h._ratingLiveFrom(LIVE);
  const sh = coldSession(h, fx.day); h._practiceAppend(sh, h.planSummary());
  assert.deepEqual([sh.plan.guarded, words(h)], [false, ["short"]]);
  // NOT ON SCREEN when the set lands (the drawer shut, the Path open): kept, and nothing is said (the archive's Not covered)
  const o = guardSession();
  o.a._sessionInline = () => false;
  await o.release(true);
  assert.deepEqual([o.s.plan.guarded, o.tracked], [false, []]);
  // FALLBACK: the game left before the set landed (the plan at landing is today's order): nothing to take, said
  const f = guardSession();
  f.a._ratingGame = () => ({ status: "no-weights", total: 0, counts: {} });
  await f.release(true);
  assert.deepEqual([f.s.plan.order, f.tracked.map((t) => t[1].reason)], ["worth", ["fallback"]]);
});
