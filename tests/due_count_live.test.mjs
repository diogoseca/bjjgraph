// DUE1 (v1.300.4; the orchestrator's DUE1-GO): "N due" is what the planner can actually ask. A question a content pass
// reworded or retired keeps its schedule row for good, and `dueCount()` counted it for ever (10,679 of the 21,199 questions a
// player could hold rows for before v1.182.2 are in no deck on dev: reports/mapshows.md, DUE1). Now `duePool` skips a row the
// app KNOWS is retired (`_rowLive` false: the rating's own three-way reading), and a row not known yet stays counted.
//
// One player state, read by the app's `dueCount()` and by the planner's own item builder (`ngPracticeItems`, with the inputs
// `planSummary` hands it, and the owed test `ngMasterOwedIn` applies: a card item with a seat, priced, its row due and not
// answered today), in the three states a page can be in:
//   1. the live set in hand, no deck loaded (the drawer opened once): the retired rows are known and skipped;
//   2. a fresh page, no live set yet: a retired row in an unloaded deck is not known yet, so both count it;
//   3. every deck loaded: each deck's own cards say it, and the live set is not needed.
// In each, the two counts are equal, and dev's count (every past-due row) is larger where anything is known retired.
// The rows: six live owed cards in six priced decks; four retired questions in four of those decks (16 bits matching none
// of the deck's cards, the rating fixture's rule); a row in a deck the manifest no longer has; a shared question whose due
// row sits in a deck its index does not list (still asked: the planner files it at its home deck with the latest of its
// rows, so it is counted); and two rows that are not owed (a future due day, one answered today).
// MUTANT D1 (`duePool` without `_rowLive`): red in 1 and 3. NOTHING STORED CHANGES: the record is compared whole after.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ngPracticeItems } from "../neural/src/practice-queue.src.js";
import { ngKnowledgeQuestionHash } from "../neural/src/knowledge-profile.src.js";
import { ratingApp, RATING_DAY } from "./_rating_fixture.mjs";

const DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../source/quartz/static/neural");
const CARDS = (() => {
  const c = {};
  for (const f of readdirSync(resolve(DIR, "flashcards")).sort()) if (f !== "_index.json" && !f.startsWith("live-")) Object.assign(c, JSON.parse(readFileSync(resolve(DIR, "flashcards", f), "utf8")));
  return c;
})();
const day = RATING_DAY;
const low16 = (qh) => parseInt(qh, 16) & 0xffff;

function app({ live = true, loaded = false } = {}) {
  const a = ratingApp(DIR, "gi", { live });
  a.prep = {}; a.rec = {}; a._epochDay = () => day;
  if (loaded) for (const [dk, d] of Object.entries(a.flashcards.decks)) if (CARDS[dk]) d.cards = CARDS[dk].cards;
  return a;
}

// the player's record, built from this payload by rule (the same record in every state)
const record = (() => {
  const a = app(), U = a._ratingGame("gi"), seats = a._practiceSeats(U), shared = a._sharedQ || new Map();
  const priced = Object.keys(a.flashcards.decks).filter((k) => typeof U.deckUnit.get(k) === "number" && seats[k] && CARDS[k] && CARDS[k].cards.length)
    .sort().filter((k) => CARDS[k].cards.some((c) => !shared.has(ngKnowledgeQuestionHash(c.q))));
  const owedRow = [day - 2, 1, day - 3];
  const srs = {}, put = (dk, qh, row) => { (srs[dk] = srs[dk] || {})[qh] = row; };
  const live = priced.slice(0, 6).map((dk) => [dk, ngKnowledgeQuestionHash(CARDS[dk].cards.find((c) => !shared.has(ngKnowledgeQuestionHash(c.q))).q)]);
  for (const [dk, qh] of live) put(dk, qh, owedRow);
  const retired = [];
  for (const [dk] of live.slice(0, 4)) {
    const held = new Set(CARDS[dk].cards.map((c) => low16(ngKnowledgeQuestionHash(c.q))));
    for (let i = 0; ; i++) { const qh = ngKnowledgeQuestionHash("a card this deck no longer holds " + dk + " " + i); if (!held.has(low16(qh)) && !shared.has(qh)) { retired.push([dk, qh]); break; } }
  }
  for (const [dk, qh] of retired) put(dk, qh, owedRow);
  put("No Such Deck|Top", ngKnowledgeQuestionHash("a deck the manifest no longer has"), owedRow);
  const [sq, list] = [...shared].find(([, l]) => l.every((k) => !live.some(([dk]) => dk === k)));
  const elsewhere = live.find(([dk]) => !list.includes(dk))[0];
  put(elsewhere, sq, owedRow);
  const later = priced[6], laterQh = ngKnowledgeQuestionHash(CARDS[later].cards[0].q);
  put(later, laterQh, [day + 5, 7, day - 2]);                                            // not due yet
  put(priced[7], ngKnowledgeQuestionHash(CARDS[priced[7]].cards[0].q), [day - 1, 1, day]);   // answered today
  return { srs, live, retired, shared: [elsewhere, sq] };
})();

/** dueCount, the planner's owed cards, and dev's count (every past-due row, unfiltered) for the record in one state */
function read(state) {
  const a = app(state);
  a.srs = structuredClone(record.srs); a.stage = {};
  const before = JSON.stringify(a.srs);
  const U = a._ratingGame("gi"), seats = a._practiceSeats(U);
  const built = ngPracticeItems({ day, srs: a.srs, stage: a.stage, decks: a._gameplanDecks(true), game: U, seats, live: a._ratingLiveNow() });
  assert.equal(built.status, "ok", "premise: the planner's builder ran");
  const owed = built.items.filter((it) => it.kind === "card" && it.seat && it.w >= 0 && it.row && it.row[0] <= day && it.row[2] < day);
  const dev = new Set();
  for (const dk in a.srs) for (const qh in a.srs[dk]) { const e = a.srs[dk][qh]; if (e[0] <= day && e[2] < day) dev.add(qh); }
  const n = a.dueCount();
  assert.equal(JSON.stringify(a.srs), before, "nothing stored changes");
  return { n, planner: owed.length, dev: dev.size, outsideDue: built.counts.outsideDue };
}

test("DUE1 premise: the record holds six live owed cards, four retired, one in a gone deck, one shared elsewhere, two not owed", () => {
  assert.equal(record.live.length, 6);
  assert.equal(record.retired.length, 4);
  assert.ok(record.shared[0] && record.shared[1], "a shared question filed outside its index's decks");
});

test("DUE1 with the live set in hand: N due is what the planner can ask, the retired rows skipped", () => {
  const r = read({ live: true });
  assert.equal(r.outsideDue, 0, "premise: every owed row is in a deck this ruleset prices");
  assert.equal(r.n, r.planner, "dueCount equals the planner's owed cards");
  assert.equal(r.n, 7, "the six live owed cards and the shared question, nothing retired");
  assert.equal(r.dev, 12, "premise: dev counted every past-due row (6 live, 4 retired, the gone deck's, the shared one's)");
});

test("DUE1 on a fresh page (no live set yet): a row not known yet stays counted, by both", () => {
  const r = read({ live: false });
  assert.equal(r.n, r.planner, "dueCount equals the planner's owed cards");
  assert.equal(r.n, 11, "six live, the shared one, and four not known yet; the gone deck's is known without the set");
});

test("DUE1 with every deck loaded: each deck's own cards say it", () => {
  const r = read({ live: false, loaded: true });
  assert.equal(r.n, r.planner, "dueCount equals the planner's owed cards");
  assert.equal(r.n, 7, "the six live owed cards and the shared question");
});
