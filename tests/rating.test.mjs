// THE RATING (v1.269.0, Stage 1) — neural/src/rating.src.js and its one reader in the app, `rating()`.
//
// The owner's rule (13 Nov 2026): the number is what you can recall RIGHT NOW (method C of the seat's simulation, as C0:
// nothing credited for what you knew before the app), on a points scale from 1000 (nothing) to 2000 (everything);
// table a's belt lines ("Even belts"); black from 1840. Stage 1 computes it and shows it nowhere.
//
// Part 1 pins the law on a hand-sized game whose arithmetic can be read off the page. Part 2 pins the reader on the
// real wire: its game against an independent read of the raw wire (by node ID, not by the index maps the app uses —
// the cal.ev join is index-keyed, CLAUDE.md §6.6 / traps-wire.md), both rulesets, the "never looked" statuses, the
// cache, and that it writes nothing. The shared record (tests/_rating_fixture.mjs) is the one the journey
// (e2e/journeys/rating-reader.spec.ts) seeds into a built page, so the page and this suite read one record.
//
// MUTANTS (v1.269.0), each applied alone and run against this file; each turned the NAMED test red and nothing else
// was needed to see it (the run log is in docs/Changelog-Archive.md, v1.269.0):
//   M1  forgetting removed (a right row reads 1 however old)            → "a right answer fades 10% per interval"
//   M2  a shared question counted once per deck instead of once         → "a question shared by several decks is ONE question"
//   M3a a zero-traffic deck given a floor weight (as a sampler would)   → "zero traffic weighs nothing"
//   M3b a deck outside this ruleset's weights given a floor weight      → "zero traffic weighs nothing", "no-gi reads no-gi's weights"
//   M4  moves dropped                                                   → "a move counts by its share of the seat's hand"
//   M5a the gi score weights read in no-gi                              → "no-gi reads no-gi's weights"
//   M5b the gi hand table read in no-gi                                 → "the reader's game is the wire's, seat by seat"
//   M6  a miss counted as a half                                        → "a miss is worth nothing"
//   M7  a null cell read as zero                                        → "a null cell is dropped and counted"
//   M8a never looked read as 1000                                       → "never looked is not a number" (the law, the reader)
//   M8b an empty record read as a number                                → "never looked is not a number" (the law, the reader)
//   M9  the reader saves                                                → "the reader writes nothing"
//   M10 white's stripes counted from 1000                               → "the belt lines are table a"
//   M11 a question's stage read from one deck only                      → "a question shared by several decks is ONE question"
//   M12 the cache not keyed on the day                                  → "cached, and keyed on the day"
//   M13 the ruleset mask dropped from the seat walk                     → "the reader's game is the wire's, seat by seat"
//   M14 the shared index ignored (a question's decks = where its rows are) → "a question shared by several decks is ONE question"
// READ402 (the independent reader's findings), each applied alone, each killed by the named test:
//   M15 rows that are all malformed or in unknown decks read "ok", 1000 (F1) → "never looked is not a number" (both)
//   M16 the deck cap removed (F2)                                       → "a deck never counts for more than its own full worth"
//   M17 the cap's counts not kept (F2)                                  → "a deck never counts for more than its own full worth"
//   M18 a record of stages alone reads "ok" (F5)                        → "a record of stages alone is unscheduled"
//   M19 ngRatingLevelFloor unguarded, throws on NaN (F6)                → "the belt lines are table a"
//   M20 the weights read before the graph check (F7)                    → "never looked is not a number (the reader)"
//   M21 a move at a seat this ruleset does not deal read as "outside"   → "never looked is not a number (the law)",
//                                                                         "answers from the other ruleset: classed as today"
//   X9  the reader writes a setting in memory without saving            → "the reader writes nothing"
//   X11 the deal leaves `_movesBusy` set                                → "the reader leaves the roll as it found it"
//   X12 the deal leaves `currentPos` moved                              → "the reader leaves the roll as it found it"
//   X15 the same-day tie goes to the larger interval                    → "a question shared by several decks is ONE question"
//   X18 a hand that fails to deal is skipped, not "hand-failed"         → "a hand that fails to deal fails the game"
// GO402 (the reader's delta read):
//   M22 the snap of a share within 1e-9 of 1 removed (D1)               → "everything known reads exactly 2000"
//   M23 a card on a deck only the other ruleset weighs read as unknown  → "answers from the other ruleset: classed as today"
// LIVE2 (the independent reader's findings on #405):
//   V1  another build's file accepted (the content fingerprint unchecked) → "the live files decode against the deck list they were built for"
//   V2  a manifest without a fingerprint accepted                       → "the live files decode against the deck list they were built for"
//   V3  the reader fetches with no fingerprint to check against         → "the reader's live check: never at a plain read, …"
//   V4  the files asked for under a constant, not the manifest's value   → "the reader's live check: never at a plain read, …"
//   V5  a retired row priced (F3)                                       → "a question that moved decks is priced one way…", "a shared question is live…"
//   V6  the file-count check removed (F4)                               → "the live files decode against the deck list they were built for"
//   V7  the live-count-over-cards check removed (F4)                    → "the live files decode against the deck list they were built for"
//   V8  the trailing-bytes check removed (F4)                           → "the live files decode against the deck list they were built for"
//   V9  the every-deck-covered check removed (F4)                       → "the live files decode against the deck list they were built for"
//   V10 a check's result used for a replaced manifest (F4)              → "the reader's live check: never at a plain read, …"
//   V11 the reader follows any file count (F5)                          → "the reader's live check: never at a plain read, …"
//   V12 the decoder's file cap removed (F5)                             → "the live files decode against the deck list they were built for"
//   V13 the app reads the fingerprint from the manifest's top level      → "the reader's live check: never at a plain read, …"
//   V14 the EMITTER writes it at the top level (re-emitted in place)     → "the emitter's live rules are the app's", and
//       tests/knowledge_scenario_manifest_corpus.test.mjs (the study worker refuses an unknown top-level key: every study
//       plan "unavailable"; caught by ci:validate before the push, v1.271.0)
//   (the emitter's one-deck rule, F2, is tests/live_questions_test.py's, through tests/live_questions_py.test.mjs)
// LIVE1 (the live check, v1.271.0):
//   L1  a retired row counted (any row in a checked deck read as live)  → "a retired row is not priced, and is counted"
//   L2  a live row dropped (every row in a checked deck read as retired) → "a retired row is not priced, and is counted"
//   L3  a shared question checked against the files, not its index     → "a shared question is live where its index lists it, retired elsewhere"
//   L4  a shared question read as live in every deck                    → "a shared question is live where its index lists it, retired elsewhere"
//   L5  an unchecked row counted as known (a deck with no live set)     → "an unchecked row is never known, and the answer is not final"
//   L6  "final" said while rows are unchecked                           → "an unchecked row is never known, and the answer is not final"
//   L7  the check skipped entirely (no live check read as all live)     → "not asked, checking, and what the boot manifest can check alone"
//   L8  the check cut to 8 bits                                         → "16 bits a card, not 8"
//   L9  a file built for another deck list accepted                     → "the live files decode against the deck list they were built for"
//   L10 the reader fetches on a plain read                              → "the reader's live check: never at a plain read, …"
//   L11 the reader fetches again once the check has landed              → "the reader's live check: never at a plain read, …"
//   L12 the cache not keyed on the live check                           → "the reader's live check: never at a plain read, …"
//   (the gi table read in no-gi stays M5a and M5b)
//
// NOT COVERED here:
//   · WHAT 16 BITS CANNOT SEE (v1.271.0). The live check keeps a retired row when its low 16 bits equal one of its deck's
//     live cards'. Measured on this wire, per retired row: 5.7e-5 in decks of 1-4 cards, 8.9e-5 in 5-8, 1.5e-4 in
//     9-16, 3.2e-4 in 17-33 (the worst deck 5.0e-4). "16 bits a card, not 8" pins the width; the rate itself is not
//     asserted (it is a property of the content). Two live cards of one deck sharing a value is harmless (2 decks).
//   · A QUESTION THAT MOVED DECKS carries nothing to its new deck: its old row is retired where it was filed (one rule,
//     LIVE2 F3: a row counts where the app's own scheduler would find it, priced and live or neither).
//   · PARITY WITH THE SIMULATION IS NOT TESTED HERE. It rests on the seat's simulation scripts, kept outside the repo
//     with the orchestrator: the module through this reader matched the simulation's C0, computed by the simulation's
//     own code, to 2.2e-11 points on 588 seeded records, with the simulation's gi moves re-priced from the gi table
//     (its own pricing read every move from the no-gi table; on the independent reader's 86 gi records that differs
//     by -8.16 to +1.73 points, a quarter of a stripe at most). Nothing here would notice the two drifting apart.
//   · ANSWERS FROM THE OTHER RULESET ARE CLASSED TWO WAYS: a flashcard on a deck only the other ruleset weighs is
//     `outside` (alone, "ok" and 1000), a move at a seat only the other ruleset deals is `unknownSeat` (alone,
//     "unmatched" and null). Pinned as it is today by "answers from the other ruleset: classed as today", so changing
//     it is a decision, not an accident (GO402 D2).
//   · Whether the weighting is the right one (the owner's call), and any painted surface (none exists).
//
// Run: node --test tests/rating.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  NG_RATING_TABLE, NG_RATING_FLOOR, NG_RATING_TOP, NG_RATING_BLACK, NG_RATING_CHECKING,
  ngRatingPoints, ngRatingLevel, ngRatingLevelFloor, ngRatingBeltOf, ngRatingNext, ngRatingRecall,
  ngRatingUniverse, ngRatingShare, ngRatingQ16, ngRatingLiveRev, ngRatingLiveDecode, ngRatingLiveFp, NG_RATING_LIVE_MAX_FILES,
} from "../neural/src/rating.src.js";
import { ngWireScoreWeights } from "../neural/src/wire-keys.src.js";
import { ngKnowledgeQuestionHash } from "../neural/src/knowledge-profile.src.js";
import { ratingApp, ratingFixture, ratingLiveFiles, RATING_DAY } from "./_rating_fixture.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = resolve(HERE, "../source/quartz/static/neural");
const D = 20000;
const close = (a, b, msg, eps = 1e-12) => assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} vs ${b}`);

// ── Part 1: the law, on a game small enough to price by hand ────────────────────────────────────────────────────────
// Decks: A (2 cards, weight 0.6 → 0.3 a question), B (4 cards, 0.2 → 0.05), Z (zero traffic), N (a null cell), G (not
// in this ruleset's weights at all). One question, "qs", is in A and B (0.35). Seat 1/top weighs 0.6 and deals 10
// (50%), 11 (30%), 12 (null) and 13 (20%); seat 2/bottom's weight is null. Total = 0.8 + 0.6 = 1.4.
const tiny = () => ngRatingUniverse({
  decks: { "A|Top": { n: 2 }, "B|Top": { n: 4 }, "Z|Attacker": { n: 1 }, "N|Attacker": { n: 1 }, "G|Attacker": { n: 1 } },
  weights: { "A|Top": 0.6, "B|Top": 0.2, "Z|Attacker": 0, "N|Attacker": null },
  shared: new Map([[H("qs"), ["A|Top", "B|Top"]]]),
  seats: { "1/top": { w: 0.6, hand: { 10: 50, 11: 30, 12: null, 13: 20 } }, "2/bottom": { w: null, hand: { 20: 100 } } },
});
const fresh = (ivl = 7) => [D + ivl, ivl, D];
// Stored question hashes are 8 hex digits (`ngKnowledgeQuestionHash`); the hand-sized records name their questions and
// `R` turns each name into its real hash. `everyLive` is the live check of a world where every stored row's card is
// still in its deck; `S` reads a record against it unless a test hands its own live check (v1.271.0).
const H = (name) => ngKnowledgeQuestionHash(name);
const hx = (m) => Object.fromEntries(Object.entries(m || {}).map(([dk, rows]) => [dk,
  rows && typeof rows === "object" ? Object.fromEntries(Object.entries(rows).map(([k, v]) => [H(k), v])) : rows]));
const R = (rec) => (rec ? { ...rec, srs: hx(rec.srs), stage: hx(rec.stage) } : rec);
const liveOf = (decks) => ({ status: "ok", decks: new Map(Object.entries(decks).map(([dk, names]) => [dk, new Set(names.map((n) => ngRatingQ16(H(n))))])) });
const everyLive = (rec) => ({ status: "ok", decks: new Map(Object.entries((rec && rec.srs) || {}).map(([dk, rows]) =>
  [dk, new Set(Object.keys(rows || {}).map(ngRatingQ16).filter((k) => k != null))])) });
const S = (U, rec, day, live) => { const r = R(rec); return ngRatingShare(U, r, day, live === undefined ? everyLive(r) : live); };

test("the belt lines are table a", () => {
  assert.deepEqual(NG_RATING_TABLE.map((r) => [r.from, r.step]), [[1160, 32], [1320, 32], [1480, 32], [1640, 40], [1840, 0]]);
  for (let k = 0; k < 4; k++) assert.equal(NG_RATING_TABLE[k].from + 5 * NG_RATING_TABLE[k].step, NG_RATING_TABLE[k + 1].from, "four stripes, then the next belt");
  assert.ok(Object.isFrozen(NG_RATING_TABLE) && NG_RATING_TABLE.every(Object.isFrozen), "one frozen constant");
  // white: nothing until 1192 (stripes counted from 1160), then one every 32
  const at = { 1000: 0, 1159: 0, 1160: 0, 1191.99: 0, 1192: 1, 1224: 2, 1256: 3, 1288: 4, 1319.99: 4, 1320: 5, 1352: 6, 1479: 9,
    1480: 10, 1639: 14, 1640: 15, 1679: 15, 1680: 16, 1800: 19, 1839.99: 19, 1840: 20, 2000: 20 };
  for (const [x, L] of Object.entries(at)) assert.equal(ngRatingLevel(+x), L, `level at ${x}`);
  for (let L = 1; L <= NG_RATING_BLACK; L++) {
    assert.equal(ngRatingLevel(ngRatingLevelFloor(L)), L, `floor of ${L} reaches it`);
    assert.equal(ngRatingLevel(ngRatingLevelFloor(L) - 1e-9), L - 1, `just below the floor of ${L}`);
  }
  assert.deepEqual([ngRatingLevelFloor(0), ngRatingLevelFloor(1), ngRatingLevelFloor(15), ngRatingLevelFloor(20)], [1000, 1192, 1640, 1840]);
  assert.deepEqual(ngRatingBeltOf(17), { belt: 3, stripes: 2 });
  assert.deepEqual(ngRatingBeltOf(20), { belt: 4, stripes: 0 });
  assert.equal(ngRatingPoints(0), NG_RATING_FLOOR); assert.equal(ngRatingPoints(1), NG_RATING_TOP); assert.equal(ngRatingPoints(0.84), 1840);
  assert.equal(ngRatingLevel(null), null); assert.equal(ngRatingLevel(NaN), null);
  // the next goal: from max(held, the number's own level), and how far below the held level the number sits
  assert.deepEqual(ngRatingNext(1129, 10), { level: 0, held: 10, next: 11, at: 1512, toNext: 383, toHeld: 351 });
  assert.deepEqual(ngRatingNext(1300, null), { level: 4, held: 4, next: 5, at: 1320, toNext: 20, toHeld: 0 });
  assert.deepEqual(ngRatingNext(1900, 3), { level: 20, held: 20, next: null, at: 2000, toNext: 100, toHeld: 0 });
  assert.equal(ngRatingNext(null, 3), null);
  // not a number: no level, no floor, no belt — never a throw, never a silent white (READ402 F6)
  for (const bad of [NaN, undefined, null, "3", Infinity]) {
    assert.equal(ngRatingLevelFloor(bad), null, `floor of ${String(bad)}`);
    assert.equal(ngRatingBeltOf(bad), null, `belt of ${String(bad)}`);
  }
});

test("a right answer fades 10% per interval", () => {
  close(ngRatingRecall([D + 7, 7, D], true, D), 1, "on the day it was answered");
  close(ngRatingRecall([D + 7, 7, D], true, D + 7), 0.9, "on its due day");
  close(ngRatingRecall([D + 7, 7, D], true, D + 70), 0.9 ** 10, "ten intervals on");
  close(ngRatingRecall([D + 1, 1, D], true, D + 3), 0.9 * 0.9 ** 3, "an interval of 1 is read as right at 0.9, then fades");
  close(ngRatingRecall([D + 7, 7, D + 5], true, D), 1, "a clock ahead of the row reads as fresh, never above 1");
  assert.equal(ngRatingRecall([D, 0, D], true, D), null, "interval 0 is malformed");
  // and in the share: the same record, a year on, reads lower
  const U = tiny(), rec = { srs: { "A|Top": { a1: fresh(30) } }, stage: { "A|Top": { a1: 4 } } };
  close(S(U, rec, D).share, 0.3 / 1.4, "fresh");
  close(S(U, rec, D + 365).share, (0.3 / 1.4) * 0.9 ** (365 / 30), "a year on");
});

test("a question shared by several decks is ONE question", () => {
  const U = tiny();
  // filed in both decks (as ngKnowledgeApplyGrade files a shared question), its stage in A only
  const r = S(U, { srs: { "A|Top": { qs: fresh() }, "B|Top": { qs: fresh() } }, stage: { "A|Top": { qs: 3 } } }, D);
  close(r.share, 0.35 / 1.4, "worth A's share plus B's, once");
  assert.equal(r.counts.questions, 1); assert.equal(r.counts.rows, 2);
  // filed in ONE deck only (an older blob): still the shared question's whole worth
  close(S(U, { srs: { "B|Top": { qs: fresh() } }, stage: {} }, D).share, 0.35 / 1.4, "its decks are the index's, not the rows'");
  // an interval-1 row whose stage sits in its OTHER deck: the stage is the highest of its decks, so it reads right
  const u = { srs: { "A|Top": { qs: [D + 1, 1, D] }, "B|Top": { qs: [D + 1, 1, D] } }, stage: { "B|Top": { qs: 1 } } };
  close(S(U, u, D).share, (0.35 * 0.9) / 1.4, "a stage in any of its decks");
  // the latest row wins, the same-day tie going to the smaller interval (the cloud merge's rule)
  const late = { srs: { "A|Top": { qs: [D + 120, 120, D - 200] }, "B|Top": { qs: [D + 1, 1, D] } }, stage: {} };
  assert.equal(S(U, late, D).share, 0, "the later row, a reset with no stage, is a miss");
  // ...and on the SAME day the smaller interval wins, whichever deck holds it (READ402 X15)
  const tieA = { srs: { "A|Top": { qs: [D + 30, 30, D] }, "B|Top": { qs: [D + 1, 1, D] } }, stage: {} };
  const tieB = { srs: { "A|Top": { qs: [D + 1, 1, D] }, "B|Top": { qs: [D + 30, 30, D] } }, stage: {} };
  assert.equal(S(U, tieA, D).share, 0, "a same-day reset beats the longer interval (it sits in B)");
  assert.equal(S(U, tieB, D).share, 0, "a same-day reset beats the longer interval (it sits in A)");
  // everything known, fresh: exactly the whole game
  const all = { srs: { "A|Top": { qs: fresh(), a1: fresh() }, "B|Top": { qs: fresh(), b1: fresh(), b2: fresh(), b3: fresh() } }, stage: {},
    moves: { "1/top": { 10: [D + 7, 7, D, 1], 11: [D + 7, 7, D, 1], 13: [D + 7, 7, D, 1] } } };
  const whole = S(U, all, D);
  close(whole.share, 1, "every question and every move"); assert.equal(whole.points, NG_RATING_TOP);
});

test("zero traffic weighs nothing", () => {
  const U = tiny();
  assert.equal(U.counts.zeroWeight, 1, "Z is a real zero: counted");
  close(U.total, 1.4, "the game's total is its traffic, nothing for Z or G");
  const r = S(U, { srs: { "Z|Attacker": { z1: fresh(30) }, "G|Attacker": { g1: fresh(30) } }, stage: { "Z|Attacker": { z1: 4 }, "G|Attacker": { g1: 4 } } }, D);
  assert.equal(r.status, "ok");
  assert.equal(r.share, 0, "known, and worth nothing");
  assert.equal(r.points, NG_RATING_FLOOR);
  assert.deepEqual([r.counts.weighted, r.counts.outside], [1, 1], "Z is priced (at 0); G is not in this ruleset's game");
});

test("a move counts by its share of the seat's hand", () => {
  const U = tiny();
  close(S(U, { moves: { "1/top": { 10: [D + 7, 7, D, 1] } } }, D).share, (0.6 * 0.5) / 1.4, "a Yes on 10");
  close(S(U, { moves: { "1/top": { 13: [D + 1, 1, D, 1] } } }, D).share, (0.6 * 0.2 * 0.9) / 1.4, "a first Yes (interval 1) at 0.9");
  const r = S(U, { moves: { "1/top": { 11: [D + 1, 1, D, 0], 99: [D + 7, 7, D, 1], e00ff: [D + 7, 7, D, 1] }, "7/top": { 10: [D + 7, 7, D, 1] } } }, D);
  assert.equal(r.share, 0, "a No, a move this seat does not deal, an escape, a seat this ruleset does not deal");
  assert.deepEqual([r.counts.moves, r.counts.weighted, r.counts.outside, r.counts.unknownSeat], [4, 1, 2, 1]);
});

test("a deck never counts for more than its own full worth", () => {
  const U = tiny();
  // A has 2 cards; a live check that wrongly holds a THIRD (a 16-bit wrong accept in a deck already fully known: the
  // one way the cap can still fire once the check exists) — the cap is the second line of defence
  const three = { srs: { "A|Top": { a1: fresh(), a2: fresh(), a3: fresh() } }, stage: {} };
  const r = S(U, three, D);
  close(r.share, 0.6 / 1.4, "capped at A's whole worth, not 1.5 times it");
  assert.deepEqual([r.counts.decksOver, r.counts.rowsOver], [1, 1], "and the cut is counted, deck and rows");
  // a cap on value, not on rows: three faded rows under A's worth are not cut, but still counted
  const faded = { srs: { "A|Top": { a1: [D, 30, D - 300], a2: [D, 30, D - 300], a3: [D, 30, D - 300] } }, stage: {} };
  const f = S(U, faded, D);
  close(f.share, (0.3 * 3 * 0.9 ** 10) / 1.4, "under the cap: each row at its own worth");
  assert.deepEqual([f.counts.decksOver, f.counts.rowsOver], [1, 1]);
  // a shared question is booked to each of its decks: A full (qs + a1) is not over, B is not touched beyond its 4
  const ok = S(U, { srs: { "A|Top": { qs: fresh(), a1: fresh() }, "B|Top": { qs: fresh() } }, stage: {} }, D);
  assert.deepEqual([ok.counts.decksOver, ok.counts.rowsOver], [0, 0]);
  // on the real wire, with the live check: a deck answered in full plus as many retired rows again reads as the deck in
  // full, the retired rows are counted, and the cap has nothing to cut
  const dk = FIX.parts.ownDeck, cards = deckCards(dk), n = cards.length;
  const only = (rows) => { const b = ratingApp(DIR, "gi"); b.srs = { [dk]: rows }; b.stage = {}; b.moves = {}; return b.rating(); };
  const live = Object.fromEntries(cards.map((qh) => [qh, [RATING_DAY + 30, 30, RATING_DAY]]));
  const more = Object.fromEntries(retiredFor(dk, n).map((qh) => [qh, [RATING_DAY + 30, 30, RATING_DAY]]));
  const full = only(live), doubled = only({ ...live, ...more });
  assert.equal(doubled.points, full.points, "twice the rows, the same worth: the retired half is not priced");
  assert.deepEqual([doubled.counts.retired, doubled.counts.decksOver, full.counts.retired, full.counts.decksOver], [n, 0, 0, 0]);
  assert.ok(full.points > 1000, "a real deck, a real worth");
});

test("a retired row is not priced, and is counted", () => {
  const U = tiny();
  const rec = { srs: { "A|Top": { a1: fresh(30), a9: fresh(30) } }, stage: {} };
  const r = S(U, rec, D, liveOf({ "A|Top": ["a1", "a2"], "B|Top": [] }));
  close(r.share, 0.3 / 1.4, "a1 is A's; a9 is no longer A's card");
  assert.deepEqual([r.status, r.final, r.counts.checked, r.counts.retired, r.counts.unchecked], ["ok", true, 2, 1, 0]);
  // and a record of nothing but retired rows met the game: a number (the floor), not "unmatched"
  const gone = S(U, { srs: { "A|Top": { a9: fresh(30) } }, stage: {} }, D, liveOf({ "A|Top": ["a1", "a2"] }));
  assert.deepEqual([gone.status, gone.points, gone.counts.retired], ["ok", NG_RATING_FLOOR, 1]);
});

test("a shared question is live where its index lists it, retired elsewhere", () => {
  // the rule (LIVE2 F3): a row counts where the app's own scheduler would find it. A shared question's row is live in the
  // decks its index lists, whatever the live files say, and priced from there; a row filed in any other deck is retired
  // there, neither priced nor allowed to set the question's number
  const U = tiny();
  const rec = { srs: { "A|Top": { qs: fresh(30) }, "Z|Attacker": { qs: fresh(30) } }, stage: {} };
  const r = S(U, rec, D, liveOf({ "A|Top": [], "B|Top": [], "Z|Attacker": [] }));
  close(r.share, 0.35 / 1.4, "priced once, at A's and B's worth: the index says so, not the live files");
  assert.deepEqual([r.counts.checked, r.counts.retired], [2, 1], "its row in Z, a deck the index does not list, is retired there");
  const onlyThere = S(U, { srs: { "Z|Attacker": { qs: [D + 30, 30, D] } }, stage: {} }, D, liveOf({ "Z|Attacker": [] }));
  assert.deepEqual([onlyThere.share, onlyThere.counts.retired, onlyThere.counts.weighted], [0, 1, 0], "filed only in a deck its index does not list: neither priced nor live");
  // a fresher row in a retired deck does not set the number: the live row does
  const late = S(U, { srs: { "A|Top": { qs: [D, 30, D - 300] }, "Z|Attacker": { qs: fresh(30) } }, stage: {} }, D, liveOf({ "A|Top": [], "Z|Attacker": [] }));
  close(late.share, (0.35 * 0.9 ** 10) / 1.4, "priced from A's own (older) row");
});

test("a question that moved decks is priced one way: no row both priced and counted retired", () => {
  const U = tiny();
  // moved from B to A (unshared now): its row in B is retired, and nothing is priced
  const one = S(U, { srs: { "B|Top": { m1: fresh(30) } }, stage: {} }, D, liveOf({ "A|Top": ["m1"], "B|Top": [] }));
  assert.deepEqual([one.share, one.counts.retired, one.counts.weighted], [0, 1, 0]);
  // moved into a shared home (A and B) from Z: its row in Z is retired there, and nothing is priced either
  const Ushared = ngRatingUniverse({ decks: { "A|Top": { n: 2 }, "B|Top": { n: 4 }, "Z|Attacker": { n: 1 } }, weights: { "A|Top": 0.6, "B|Top": 0.2, "Z|Attacker": 0.1 },
    shared: new Map([[H("mv"), ["A|Top", "B|Top"]]]), seats: { "1/top": { w: 0.6, hand: { 10: 100 } } } });
  const two = S(Ushared, { srs: { "Z|Attacker": { mv: fresh(30) } }, stage: {} }, D, liveOf({ "A|Top": [], "B|Top": [], "Z|Attacker": [] }));
  assert.deepEqual([two.share, two.counts.retired, two.counts.weighted], [0, 1, 0], "the same rule whether its new home is shared or not");
});

test("an unchecked row is never known, and the answer is not final", () => {
  const U = tiny();
  const rec = { srs: { "A|Top": { a1: fresh(30) }, "B|Top": { b1: fresh(30) } }, stage: {} };
  const half = S(U, rec, D, liveOf({ "A|Top": ["a1"] }));   // the check knows A, not B
  assert.deepEqual([half.status, half.final, half.points, half.share, half.level], ["unchecked", false, null, null, null], "no number while any row waits");
  assert.deepEqual([half.counts.checked, half.counts.unchecked], [1, 1]);
});

test("not asked, checking, and what the boot manifest can check alone", () => {
  const U = tiny();
  const rec = { srs: { "A|Top": { a1: fresh(30) } }, stage: {} };
  const notAsked = S(U, rec, D, null);
  assert.deepEqual([notAsked.status, notAsked.reason, notAsked.final, notAsked.points], ["unchecked", "not-asked", false, null]);
  const checking = S(U, rec, D, NG_RATING_CHECKING);
  assert.deepEqual([checking.status, checking.reason, checking.final, checking.points], ["checking", null, false, null]);
  const failed = S(U, rec, D, { status: "unchecked", reason: "stale-live", decks: null });
  assert.deepEqual([failed.status, failed.reason, failed.final, failed.points], ["unchecked", "stale-live", false, null]);
  // a record whose card rows are all shared questions, or that has only moves, needs no file: final as it stands
  const shared = S(U, { srs: { "A|Top": { qs: fresh(30) } }, stage: {} }, D, null);
  assert.deepEqual([shared.status, shared.final, shared.counts.checked, shared.counts.unchecked], ["ok", true, 1, 0]);
  close(shared.share, 0.35 / 1.4, "the index alone checked it");
  const moves = S(U, { moves: { "1/top": { 10: [D + 7, 7, D, 1] } } }, D, null);
  assert.deepEqual([moves.status, moves.final], ["ok", true]);
});

test("a record of stages alone is unscheduled", () => {
  const U = tiny();
  const old = S(U, { stage: { "A|Top": { a1: 3 }, "B|Top": { b1: 4 } } }, D);
  assert.equal(old.status, "unscheduled", "not ok: a surface must choose to show it");
  assert.deepEqual([old.points, old.share, old.level, old.counts.stageOnly], [NG_RATING_FLOOR, 0, 0, 2], "the number the definition gives");
  const mixed = S(U, { srs: { "A|Top": { a1: fresh() } }, stage: { "A|Top": { a1: 2 }, "B|Top": { b1: 4 } } }, D);
  assert.equal(mixed.status, "ok", "with one scheduled row it is an ordinary number");
  assert.equal(mixed.counts.stageOnly, 1);
});

test("a miss is worth nothing", () => {
  const U = tiny();
  const r = S(U, { srs: { "A|Top": { a1: [D + 1, 1, D] } }, stage: { "A|Top": { a1: 0 } }, moves: { "1/top": { 10: [D + 1, 1, D, 0] } } }, D);
  assert.equal(r.status, "ok", "answered: a number");
  assert.equal(r.share, 0); assert.equal(r.points, NG_RATING_FLOOR); assert.equal(r.level, 0);
  assert.equal(r.counts.weighted, 2, "both priced, both at 0");
});

test("a null cell is dropped and counted", () => {
  const U = tiny();
  // N|Attacker's weight, move 12's share, and seat 2/bottom's weight (its one move) are null: three cells, all absent
  assert.equal(U.counts.absent, 3, "every null cell counted");
  assert.equal(U.counts.zeroWeight, 1, "a null is not a zero");
  assert.ok(!U.deckUnit.has("N|Attacker"), "a null deck is not priced at all");
  assert.equal(U.seats.get("1/top").get("12"), null, "a null share stays null");
  const r = S(U, { srs: { "N|Attacker": { n1: fresh(30) } }, stage: { "N|Attacker": { n1: 4 } }, moves: { "1/top": { 12: [D + 7, 7, D, 1] }, "2/bottom": { 20: [D + 7, 7, D, 1] } } }, D);
  assert.equal(r.share, 0);
  assert.deepEqual([r.counts.weighted, r.counts.outside], [0, 3], "dropped, and counted as outside the game");
});

test("never looked is not a number (the law)", () => {
  const none = (r, status) => {
    assert.equal(r.status, status);
    assert.equal(r.points, null, status + ": no number"); assert.equal(r.share, null); assert.equal(r.level, null);
    assert.notEqual(r.points, NG_RATING_FLOOR);
  };
  const game = { decks: { "A|Top": { n: 2 } }, weights: { "A|Top": 1 }, seats: { "1/top": { w: 1, hand: { 10: 100 } } } };
  none(S(ngRatingUniverse({ ...game, decks: null }), { srs: { "A|Top": { a: fresh() } } }, D), "no-manifest");
  none(S(ngRatingUniverse({ ...game, decks: {} }), { srs: { "A|Top": { a: fresh() } } }, D), "no-manifest");
  none(S(ngRatingUniverse({ ...game, weights: {} }), { srs: { "A|Top": { a: fresh() } } }, D), "no-weights");
  none(S(ngRatingUniverse({ ...game, seats: {} }), { srs: { "A|Top": { a: fresh() } } }, D), "no-hands");
  none(S(ngRatingUniverse({ ...game, weights: { "A|Top": 0 }, seats: { "1/top": { w: 0, hand: { 10: 0 } } } }), { srs: { "A|Top": { a: fresh() } } }, D), "no-weights");
  none(S(null, { srs: { "A|Top": { a: fresh() } } }, D), "no-weights");
  const U = ngRatingUniverse(game);
  none(S(U, {}, D), "empty");
  none(S(U, { srs: {}, stage: {}, moves: {} }, D), "empty");
  none(S(U, { srs: { "A|Top": { a: fresh() } } }, undefined), "no-day");
  // rows that met nothing are "nothing read", not "nothing known" (READ402 F1)
  none(S(U, { srs: { "A|Top": { a: [D, 0, D], b: "x" } }, moves: { "1/top": { 10: [D, 3] } } }, D), "unmatched");
  none(S(U, { srs: { "No Such|Top": { a: fresh(), b: fresh() } }, moves: { "9/top": { 10: [D + 7, 7, D, 1] } } }, D), "unmatched");
  const un = S(U, { srs: { "No Such|Top": { a: fresh() } }, moves: { "9/top": { 10: [D + 7, 7, D, 1] } } }, D);
  assert.deepEqual([un.counts.unknownDeck, un.counts.unknownSeat, un.counts.weighted], [1, 1, 0], "and the reasons are counted");
});

// ── Part 2: the reader, on the real wire ────────────────────────────────────────────────────────────────────────────
const RAW = JSON.parse(readFileSync(resolve(DIR, "graph-data.json"), "utf8"));
const CUR = JSON.parse(readFileSync(resolve(DIR, "curriculum.json"), "utf8"));
const FIX = ratingFixture(DIR);
const APP = { gi: ratingApp(DIR, "gi"), nogi: ratingApp(DIR, "nogi") };
// a real deck's live question hashes, from its own chunk, and n hashes it does NOT hold whose low 16 bits match none of its
const deckCards = (dk) => JSON.parse(readFileSync(resolve(DIR, "flashcards", ngKnowledgeQuestionHash(dk) + ".json"), "utf8"))[dk].cards.map((c) => ngKnowledgeQuestionHash(c.q));
// the test's own 16-bit key, never the module's (a mutated mask must not change what the test asks for)
const k16 = (qh) => parseInt(qh, 16) & 0xffff;
const retiredFor = (dk, n) => {
  const live16 = new Set(deckCards(dk).map(k16)), out = [];
  for (let i = 0; out.length < n && i < 100000; i++) { const qh = ngKnowledgeQuestionHash(dk + " retired " + i); if (!live16.has(k16(qh))) out.push(qh); }
  assert.equal(out.length, n, "found the retired hashes");
  return out;
};
const LIVE = ratingLiveFiles(DIR);
const MAN_FP = JSON.parse(readFileSync(resolve(DIR, "flashcards/_index.json"), "utf8"))._meta.live;
const seeded = (frame) => { const a = ratingApp(DIR, frame); a.srs = FIX.blob.srs; a.stage = FIX.blob.stage; a.moves = FIX.blob.moves; return a; };
// the ruleset's own hand table read straight off the RAW wire, keyed by node ID — never through `_ev`/`_evGi`'s indexes
const rawHands = (frame) => {
  const t = new Map();
  for (const n of RAW.nodes) {
    const tab = n.cal && (frame === "gi" ? n.cal.evGi : n.cal.ev);
    if (tab) for (const role in tab) t.set(n.id + "/" + role, new Map(tab[role][0].map((ti, k) => [RAW.nodes[ti].id, tab[role][1][k]])));
  }
  return t;
};

test("the reader's game is the wire's, seat by seat", () => {
  for (const frame of ["gi", "nogi"]) {
    const a = APP[frame], G = a._ratingGame(frame), raw = rawHands(frame), W = a.scoreWeights(frame);
    assert.equal(G.status, "ok", frame);
    // every dealt move, priced from the ruleset's own table, matched by ID against the raw wire
    let checked = 0, nulls = 0;
    for (const [st, shares] of G.seats) {
      const [o, role] = st.split("/"), seat = a.nodes[a._idIndex.get(a._ordToId.get(+o))];
      const seatW = W[a.posFamily(seat.t) + "|" + (role === "bottom" ? "Bottom" : "Top")] || 0;
      const tab = raw.get(a.nodes[a.canonicalState(seat.idx, role)].id + "/" + role);
      for (const [mv, v] of shares) {
        const att = tab && tab.get(a._ordToId.get(+mv));
        if (att == null) { assert.equal(v, null, `${frame} ${st}:${mv} has no row in the raw table, so no share`); nulls++; continue; }
        close(v, seatW * att / 100, `${frame} ${st}:${mv}`, 1e-15);
        checked++;
      }
    }
    assert.equal(nulls, G.counts.absent, `${frame}: the unpriced moves are exactly the counted ones`);
    assert.ok(checked > 1000, `${frame}: a differential over ${checked} moves, not a handful`);
    assert.ok(G.counts.seats > 200, frame + " seats");
  }
  assert.equal(APP.gi._ratingGame("gi").counts.dealt, 1350); // census:movePairs
  assert.equal(APP.nogi._ratingGame("nogi").counts.dealt, 1206); // census:movePairsNogi
  // and every manifest deck the ruleset weighs is priced at its weight over its card count
  for (const frame of ["gi", "nogi"]) {
    const a = APP[frame], G = a._ratingGame(frame), w = ngWireScoreWeights(CUR, frame, RAW.nodes).w;
    let n = 0;
    for (const [dk, d] of Object.entries(a.flashcards.decks)) if (d.n > 0 && w[dk] > 0) { close(G.deckUnit.get(dk), w[dk] / d.n, dk, 1e-15); n++; }
    assert.equal(G.counts.decks, n, frame + ": decks priced");
    assert.ok(n > 2500, frame + " decks");
  }
});

test("no-gi reads no-gi's weights", () => {
  const [deck, qh] = FIX.parts.giOnly;
  assert.ok(deck && qh, "the fixture found a technique deck gi weighs and no-gi does not");
  const without = (frame) => { const a = seeded(frame); a.srs = JSON.parse(JSON.stringify(a.srs)); delete a.srs[deck]; return a.rating(); };
  const gi = seeded("gi").rating(), nogi = seeded("nogi").rating();
  assert.ok(gi.points > without("gi").points, "gi prices it");
  assert.equal(nogi.points, without("nogi").points, "no-gi does not: it is not in no-gi's game");
  assert.equal(nogi.counts.outside, gi.counts.outside + 1, "and says so");
  assert.ok(APP.nogi._ratingGame("nogi").counts.decks < APP.gi._ratingGame("gi").counts.decks, "no-gi weighs fewer decks");
});

test("the fixture's number, and each part of it", () => {
  for (const frame of ["gi", "nogi"]) {
    const r = seeded(frame).rating();
    assert.equal(r.status, "ok", frame);
    assert.ok(r.points > 1000 && r.points < 1100, `${frame}: ${r.points} — a handful of questions, a little above the floor`);
    assert.deepEqual([r.counts.unknownDeck, r.counts.badRow, r.counts.stageOnly], [1, 1, 1], frame);
    assert.equal(r.counts.moves, 5, frame);
    assert.equal(r.counts.questions, 14, frame);
    assert.equal(r.final, true, frame);
    assert.deepEqual([r.counts.retired, r.counts.unchecked], [3, 0], `${frame}: two retired cards and a shared question filed elsewhere`);
    assert.ok(r.counts.checked > 20, `${frame}: the check ran on ${r.counts.checked} rows (a check that never ran is not a pass)`);
  }
  // a retired row is worth nothing: remove it and the number does not move
  for (const qh of FIX.parts.retired) {
    const b = seeded("gi"); b.srs = JSON.parse(JSON.stringify(b.srs)); delete b.srs[FIX.parts.ownDeck][qh];
    assert.equal(b.rating().points, seeded("gi").rating().points, "a retired row removed");
  }
  // each own-deck row read as the law says: remove it and the share drops by exactly its weight × its recall
  const a = seeded("gi"), G = a._ratingGame("gi"), base = a.rating(), u = G.deckUnit.get(FIX.parts.ownDeck);
  const expect = [1, 0.9, 0.9 ** 3, 0, 1];
  FIX.parts.own.forEach((qh, i) => {
    const b = seeded("gi"); b.srs = JSON.parse(JSON.stringify(b.srs)); delete b.srs[FIX.parts.ownDeck][qh];
    close(base.share - b.rating().share, (u * expect[i]) / G.total, `own row ${i}`, 1e-15);
  });
});

test("cached, and keyed on the day", () => {
  const a = seeded("gi");
  const r1 = a.rating();
  assert.equal(a.rating(), r1, "a repaint reads the cache");
  a._epochDay = () => RATING_DAY + 120;
  const r2 = a.rating();
  assert.ok(r2.points < r1.points, "a new day fades it");
  a._epochDay = () => RATING_DAY;
  assert.equal(a.rating().points, r1.points);
  a.srs = Object.assign({}, a.srs, { [FIX.parts.ownDeck]: {} });   // a grade replaces the record
  assert.ok(a.rating().points < r1.points, "a replaced record recomputes");
  a._giMode = "nogi";
  assert.equal(a.rating().frame, "nogi", "a ruleset flip recomputes");
});

test("never looked is not a number (the reader)", () => {
  const blank = ratingApp(DIR, "gi");
  blank.nodes = []; blank._ordById = null;
  assert.deepEqual([blank.rating().status, blank.rating().points], ["no-graph", null]);
  // with no graph the weights are never asked for, so no empty table is memoised and no false beat fires (READ402 F7)
  assert.ok(!(blank._scoreW && "gi" in blank._scoreW), "no score table memoised without a graph");
  assert.equal(blank.beats.filter((b) => b.beat === "wire_key_unresolved").length, 0, "no wire_key_unresolved beat");
  const lost = ratingApp(DIR, "gi"); lost.srs = { "No Such Deck|Top": { "00000000": [RATING_DAY + 3, 3, RATING_DAY] } };
  assert.deepEqual([lost.rating().status, lost.rating().points], ["unmatched", null], "rows only in a deck the manifest lacks");
  const noMan = ratingApp(DIR, "gi"); noMan.flashcards = null; noMan.srs = FIX.blob.srs;
  assert.deepEqual([noMan.rating().status, noMan.rating().points], ["no-manifest", null]);
  const noCur = ratingApp(DIR, "gi"); noCur.curriculum = null; noCur._scoreW = null; noCur.srs = FIX.blob.srs;
  assert.deepEqual([noCur.rating().status, noCur.rating().points], ["no-weights", null]);
  const noHands = ratingApp(DIR, "gi"); noHands._evGi = new Map(); noHands.srs = FIX.blob.srs;
  assert.deepEqual([noHands.rating().status, noHands.rating().points], ["no-hands", null], "no gi hands: never a cards-only number");
  const empty = ratingApp(DIR, "gi");
  assert.deepEqual([empty.rating().status, empty.rating().points], ["empty", null]);
  assert.equal(empty._ratingGame("gi").status, "ok", "the game was there; the record was empty");
});

test("the reader writes nothing", () => {
  const deep = (o) => { if (o && typeof o === "object" && !Object.isFrozen(o)) { Object.freeze(o); for (const k of Object.keys(o)) deep(o[k]); } return o; };
  for (const frame of ["gi", "nogi"]) {
    const a = seeded(frame);
    const rec = JSON.parse(JSON.stringify(FIX.blob));
    a.srs = deep(rec.srs); a.stage = deep(rec.stage); a.moves = deep(rec.moves);
    a.prep = deep({}); a.belts = deep({ won: {}, held: { id: "blue", t: 1 } }); a.units = deep({}); a.dayLog = deep({});
    a.settings = deep({ hideMoves: true }); a._settingsAt = deep({ hideMoves: 1 });
    // EVERY field `_progressBlob()` saves (it cannot run in this harness: it needs the challenge sources), so a write
    // that is never saved — a setting set in memory — is caught here, where storage cannot see it (READ402 X9).
    // THIS LIST IS BY HAND (GO402 D3): it matched `_progressBlob()` in app.src.jsx at v1.271.0. A field added to that
    // blob must be added HERE too, or this test stops watching it (CLAUDE.md §6.7, the hand-maintained list).
    const SAVED = ["_progressExtras", "prep", "rec", "stage", "srs", "dayLog", "_rollDays", "units", "belts", "tut", "challenges",
      "badges", "coins", "lists", "flow", "_exploredKeys", "_days", "settings", "_settingsAt", "moves", "cardDone", "_progressAt",
      "_openAt", "_recallCarry"];   // the last two: v1.270.0 (U163 c), saved as `openAt` / `recallCarry` once set
    const snap = () => JSON.stringify(SAVED.map((k) => [k, a[k] instanceof Set ? [...a[k]] : a[k] === undefined ? null : a[k]]));
    const before = snap(), ids = SAVED.map((k) => a[k]);
    a.rating(); a._epochDay = () => RATING_DAY + 400; a.rating();
    assert.equal(a._saves, 0, frame + ": no save asked for");
    assert.equal(snap(), before, frame + ": nothing a save would write changed");
    assert.deepEqual(SAVED.map((k) => a[k]), ids, frame + ": every saved field is the same object");
  }
});

test("the reader leaves the roll as it found it", () => {
  for (const frame of ["gi", "nogi"]) {
    // standing on a seat, and standing nowhere (the deal stands in for the seat and must give it back)
    for (const at of ["Positions/Side-Control", null]) {
      const a = seeded(frame);
      a.currentPos = at ? a.nodes.find((n) => n.id === at && n.ty === "positions").idx : undefined;
      a._movesBusy = false;
      const before = a.currentPos;
      assert.equal(a.rating().status, "ok");
      assert.equal(a.currentPos, before, `${frame} ${at}: currentPos where it was (READ402 X12)`);
      assert.equal(a._movesBusy, false, `${frame} ${at}: _movesBusy released (READ402 X11)`);
    }
  }
});

test("a hand that fails to deal fails the game", () => {
  const a = seeded("gi"), mount = a.nodes.find((n) => n.id === "Positions/Mount" && n.ty === "positions");
  const proto = Object.getPrototypeOf(a).optionsFor;
  a.optionsFor = function (i, role) {
    if (this.nodes[i] && this.nodes[i].posId === mount.posId && role === "top") throw new Error("deal failed");
    return proto.call(this, i, role);
  };
  a._movesHandBeat = 1;   // its once-per-app beat already spent: the beat's own path is moves-mastery's, not this test's
  const before = a.currentPos;
  const r = a.rating();
  assert.deepEqual([r.status, r.points], ["hand-failed", null], "a game short one seat is not the game (READ402 X18)");
  assert.equal(a._movesBusy, false); assert.equal(a.currentPos, before);
  delete a.optionsFor;
  assert.equal(a.rating().status, "ok", "and it was never kept: the next read deals again");
});

// the whole game known: every live question of every deck filed in every deck that holds it (as a grade files it), and
// every dealt move a Yes, all answered today — read from the cards themselves, not from the manifest's counts
const complete = (frame) => {
  const a = ratingApp(DIR, frame), srs = {}, moves = {};
  for (const f of readdirSync(resolve(DIR, "flashcards"))) {
    if (f === "_index.json" || f.startsWith("live-")) continue;
    const decks = JSON.parse(readFileSync(resolve(DIR, "flashcards", f), "utf8"));
    for (const [dk, d] of Object.entries(decks)) for (const c of d.cards) (srs[dk] = srs[dk] || {})[ngKnowledgeQuestionHash(c.q)] = [RATING_DAY + 30, 30, RATING_DAY];
  }
  for (const [st, shares] of a._ratingGame(frame).seats) for (const mv of shares.keys()) (moves[st] = moves[st] || {})[mv] = [RATING_DAY + 30, 30, RATING_DAY, 1];
  a.srs = srs; a.stage = {}; a.moves = moves;
  return a.rating();
};

test("everything known reads exactly 2000", () => {
  for (const frame of ["gi", "nogi"]) {
    const r = complete(frame);
    assert.equal(r.status, "ok", frame);
    assert.equal(r.share, 1, `${frame}: the whole game, exactly (GO402 D1)`);
    assert.equal(r.points, NG_RATING_TOP, `${frame}: exactly 2000, not 2000 less a rounding`);
    assert.equal(r.level, NG_RATING_BLACK);
    assert.equal(ngRatingNext(r.points, 20).toNext, 0, `${frame}: nothing left to the top`);
    assert.deepEqual([r.counts.decksOver, r.counts.unknownDeck, r.counts.badRow], [0, 0, 0], `${frame}: live cards only, none over a count`);
  }
});

test("answers from the other ruleset: classed as today", () => {
  // pinned AS IT IS (GO402 D2), so a change is a decision: see NOT COVERED in the header
  const gi = APP.gi._ratingGame("gi"), no = APP.nogi._ratingGame("nogi");
  const seat = [...gi.seats.keys()].filter((st) => !no.seats.has(st) && gi.seats.get(st).size).sort()[0];
  assert.ok(seat, "a seat gi deals and no-gi does not");
  const mv = [...gi.seats.get(seat).keys()][0];
  const onlyGiMoves = ratingApp(DIR, "nogi"); onlyGiMoves.moves = { [seat]: { [mv]: [RATING_DAY + 7, 7, RATING_DAY, 1] } };
  const m = onlyGiMoves.rating();
  assert.deepEqual([m.status, m.points, m.counts.unknownSeat, m.counts.outside], ["unmatched", null, 1, 0], "moves at a gi-only seat, read in no-gi");
  const [deck, qh] = FIX.parts.giOnly;
  const onlyGiCards = ratingApp(DIR, "nogi"); onlyGiCards.srs = { [deck]: { [qh]: [RATING_DAY + 30, 30, RATING_DAY] } }; onlyGiCards.stage = { [deck]: { [qh]: 3 } };
  const c = onlyGiCards.rating();
  assert.deepEqual([c.status, c.points, c.counts.outside, c.counts.unknownDeck], ["ok", 1000, 1, 0], "flashcards on a gi-only deck, read in no-gi");
});

test("the live files decode against the deck list they were built for", () => {
  const a = APP.gi, list = a._ratingDeckList();
  const ok = ngRatingLiveDecode(LIVE, list, MAN_FP);
  assert.equal(ok.status, "ok");
  assert.equal(ngRatingLiveFp(LIVE), MAN_FP, "the manifest carries the live data's own fingerprint");
  assert.equal(ok.rev, ngRatingLiveRev(list), "built for this manifest's decks and counts");
  assert.equal(ok.counts.decks, list.length, "every deck, once");
  // the entries are exactly the unshared cards, counted from the chunks themselves
  const shared = new Set(a._sharedQ.keys());
  let unshared = 0;
  for (const [dk] of list) unshared += deckCards(dk).filter((qh) => !shared.has(qh)).length;
  assert.equal(ok.counts.entries, unshared);
  assert.ok(LIVE.length >= 2 && LIVE.every((f) => JSON.stringify(f).length <= 40000), "two or more files, each a chunk under 40,000 B");
  // a file built for another deck list (a content deploy between boot and fetch) is never read (LIVE1-GO 3)
  const stale = LIVE.map((f) => ({ ...f, rev: "00000000" }));
  const dec = (files, l = list, fp = MAN_FP) => ngRatingLiveDecode(files, l, fp).reason;
  assert.deepEqual([ngRatingLiveDecode(stale, list, MAN_FP).status, dec(stale)], ["unchecked", "stale-live"]);
  const counted = list.map(([k, n], i) => (i === 0 ? [k, n + 1] : [k, n]));
  assert.equal(dec(LIVE, counted), "stale-live", "one deck's count changed: stale");
  assert.equal(dec([LIVE[0], null]), "fetch-failed", "a file missing leaves everything unchecked");
  assert.equal(dec([LIVE[0], LIVE[0]]), "bad-live", "the same file twice does not cover every deck");
  assert.equal(dec(LIVE.map((f) => ({ ...f, bits: 8 }))), "bad-live");
  // ANOTHER BUILD with the same deck list and counts (a reworded card), older or newer: refused (LIVE2 F1)
  const q0 = Buffer.from(LIVE[0].q, "base64");
  const older = [{ ...LIVE[0], q: Buffer.from(q0.map((b, i) => (i === 0 ? b ^ 1 : b))).toString("base64") }, LIVE[1]];
  const newer = [LIVE[0], { ...LIVE[1], q: Buffer.from(Buffer.from(LIVE[1].q, "base64").map((b, i, a) => (i === a.length - 1 ? b ^ 0x80 : b))).toString("base64") }];
  assert.equal(older[0].rev, LIVE[0].rev, "the same list and counts");
  assert.equal(dec(older), "stale-live", "an older file under the same list and counts");
  assert.equal(dec(newer), "stale-live", "a newer one too");
  assert.equal(dec(LIVE, list, null), "no-fingerprint", "a manifest from before the live files: nothing can be checked");
  // the five guards, each on a file set that passes every OTHER check (LIVE2 F4): fingerprints recomputed so only the
  // guard under test can refuse
  const fpOf = (files) => ngRatingLiveFp(files);
  const three = LIVE.map((f) => ({ ...f, files: 3 }));
  assert.equal(dec(three, list, fpOf(three)), "bad-live", "a set that says three files where two arrived");
  const n1 = Buffer.from(LIVE[1].n, "base64"), q1 = Buffer.from(LIVE[1].q, "base64");
  const over = n1.findIndex((c, i) => c === list[LIVE[1].from + i][1]);   // a deck whose live count equals its card count
  assert.ok(over >= 0, "a deck with every card unshared exists to raise");
  const before = n1.slice(0, over).reduce((t, c) => t + c, 0) * 2;
  const raised = [LIVE[0], { ...LIVE[1], n: Buffer.from(n1.map((c, i) => (i === over ? c + 1 : c))).toString("base64"),
    q: Buffer.concat([q1.subarray(0, before), Buffer.from([1, 2]), q1.subarray(before)]).toString("base64") }];
  assert.equal(dec(raised, list, fpOf(raised)), "bad-live", "a deck holding more live cards than it has cards");
  const trailing = [LIVE[0], { ...LIVE[1], q: Buffer.concat([q1, Buffer.from([1, 2])]).toString("base64") }];
  assert.equal(dec(trailing, list, fpOf(trailing)), "bad-live", "bytes left over after the last deck");
  const skip = Buffer.from(LIVE[1].n, "base64"), firstN = skip[0];
  const gap = [LIVE[0], { ...LIVE[1], from: LIVE[1].from + 1, n: skip.subarray(1).toString("base64"), q: q1.subarray(2 * firstN).toString("base64") }];
  assert.equal(dec(gap, list, fpOf(gap)), "bad-live", "a deck covered by no file");
  // the real data re-split into k files, as the emitter could write them: three decode, nine are over the cap (LIVE2 F5)
  const resplit = (k) => {
    const ns = [], qs = [];
    for (const f of [...LIVE].sort((x, y) => x.file - y.file)) {
      const n = Buffer.from(f.n, "base64"), q = Buffer.from(f.q, "base64"); let at = 0;
      for (const c of n) { ns.push(c); qs.push(q.subarray(at, at + 2 * c)); at += 2 * c; }
    }
    const per = Math.ceil(ns.length / k);
    return Array.from({ length: k }, (_, i) => ({ ...LIVE[0], file: i, files: k, from: i * per, to: Math.min(ns.length, (i + 1) * per),
      n: Buffer.from(ns.slice(i * per, (i + 1) * per)).toString("base64"), q: Buffer.concat(qs.slice(i * per, (i + 1) * per)).toString("base64") }));
  };
  const three3 = resplit(3);
  assert.equal(ngRatingLiveDecode(three3, list, fpOf(three3)).status, "ok", "three files, as the emitter could write them");
  const nine = resplit(9);
  assert.equal(dec(nine, list, fpOf(nine)), "bad-live", "more files than the emitter can write");
  // and through the reader: a stale file leaves every row unchecked, named, never priced
  const b = seeded("gi"); b._ratingLiveFrom(stale);
  const r = b.rating();
  assert.deepEqual([r.status, r.reason, r.final, r.points], ["unchecked", "stale-live", false, null]);
});

test("16 bits a card, not 8", () => {
  // a question this deck does not hold whose LOW 8 bits equal a live card's but whose 16 do not: with 16 bits it is
  // retired; cut the check to 8 bits and it would read as live (LIVE1-GO 1)
  const dk = FIX.parts.ownDeck, cards = deckCards(dk), low8 = new Set(cards.map((qh) => k16(qh) & 0xff)), live16 = new Set(cards.map(k16));
  let qh = null;
  for (let i = 0; !qh && i < 100000; i++) { const h = ngKnowledgeQuestionHash(dk + " near " + i); if (low8.has(k16(h) & 0xff) && !live16.has(k16(h))) qh = h; }
  assert.ok(qh, "found a near match");
  const b = ratingApp(DIR, "gi"); b.srs = { [dk]: { [qh]: [RATING_DAY + 30, 30, RATING_DAY] } }; b.stage = {}; b.moves = {};
  const r = b.rating();
  assert.deepEqual([r.status, r.counts.retired, r.points], ["ok", 1, NG_RATING_FLOOR], "an 8-bit match is not a live card");
  const decoded = ngRatingLiveDecode(LIVE, APP.gi._ratingDeckList(), MAN_FP);
  assert.ok([...decoded.decks.values()].some((set) => [...set].some((k) => k > 0xff)), "the files carry 16 bits");
});

test("the reader's live check: never at a plain read, two requests once, a retry after a failure", async () => {
  const realFetch = globalThis.fetch, asked = [];
  let fail = false;
  globalThis.fetch = async (url) => {
    asked.push(String(url));
    const m = /flashcards\/(live-\d+)\.json\?live=([0-9a-f]{8})$/.exec(String(url));
    if (fail || !m) return { ok: false, status: 404, json: async () => null };
    const body = JSON.parse(readFileSync(resolve(DIR, "flashcards", m[1] + ".json"), "utf8"));
    return { ok: true, status: 200, json: async () => (claim ? { ...body, files: claim } : body) };
  };
  let claim = 0;
  try {
    const a = ratingApp(DIR, "gi", { live: false });
    a.srs = FIX.blob.srs; a.stage = FIX.blob.stage; a.moves = FIX.blob.moves;
    for (let i = 0; i < 3; i++) a.rating();
    assert.equal(asked.length, 0, "a plain read fetches nothing (LIVE1-GO 2)");
    assert.deepEqual([a.rating().status, a.rating().reason, a.rating().final], ["unchecked", "not-asked", false]);
    fail = true;
    const r0 = await a.ratingCheck();
    assert.deepEqual([r0.status, r0.reason, r0.points], ["unchecked", "fetch-failed", null], "offline: named, no number");
    fail = false; asked.length = 0;
    const p = a.ratingCheck();
    assert.equal(a.rating().status, "checking", "in flight: checking, still no number");
    assert.equal(a.ratingCheck(), p, "coalesced");
    const r = await p;
    assert.deepEqual([r.status, r.final], ["ok", true]);
    assert.deepEqual(asked.map((u) => u.split("/").pop()), ["live-0.json?live=" + MAN_FP, "live-1.json?live=" + MAN_FP], "exactly the two files, under the manifest's fingerprint");
    const fixtureNumber = seeded("gi").rating().points;
    assert.equal(r.points, fixtureNumber, "the same number as the files read in hand");
    await a.ratingCheck(); a.rating();
    assert.equal(asked.length, 2, "and never again for this manifest");
    a._giMode = "nogi";
    assert.deepEqual([a.rating().frame, a.rating().final, asked.length], ["nogi", true, 2], "a ruleset flip: final, nothing fetched (LIVE2 F6)");
    a._giMode = "gi";
    // a REPLACED manifest is a new one: the old result is not used, and the next ask fetches again (LIVE2 F4)
    a._ingestDeckManifest(JSON.parse(readFileSync(resolve(DIR, "flashcards/_index.json"), "utf8")));
    assert.deepEqual([a.rating().status, a.rating().reason], ["unchecked", "not-asked"], "the check was for the old manifest");
    await a.ratingCheck();
    assert.equal(asked.length, 4, "two more, for the new one");
    // a file that claims 400 files is refused, never followed: still exactly two requests (LIVE2 F5)
    const c = ratingApp(DIR, "gi", { live: false }); c.srs = FIX.blob.srs; c.stage = FIX.blob.stage; c.moves = FIX.blob.moves;
    asked.length = 0; claim = 400;
    const big = await c.ratingCheck();
    assert.deepEqual([big.status, big.reason, asked.length], ["unchecked", "bad-live", 2]);
    claim = 0;
    // a manifest from before the live files: nothing fetched, named, no number (LIVE2 F1)
    const old = ratingApp(DIR, "gi", { live: false }); old.srs = FIX.blob.srs;
    const m0 = JSON.parse(readFileSync(resolve(DIR, "flashcards/_index.json"), "utf8")); delete m0._meta.live; old._ingestDeckManifest(m0);
    asked.length = 0;
    const none = await old.ratingCheck();
    assert.deepEqual([none.status, none.reason, none.points, asked.length], ["unchecked", "no-fingerprint", null, 0]);
  } finally { globalThis.fetch = realFetch; }
});

test("the emitter's live rules are the app's", () => {
  // the file cap is one number in two places, pinned equal
  const py = readFileSync(resolve(HERE, "../scripts/regenerate_neural_data.py"), "utf8");
  assert.equal(Number(/^LIVE_MAX_FILES = (\d+)$/m.exec(py)[1]), NG_RATING_LIVE_MAX_FILES);
  // a question repeated inside ONE deck: the manifest lists it in `shared` with that one deck, which the app ignores, so
  // the live writer must keep it (LIVE2 F2; the emitter's own case is tests/live_questions_test.py). On this wire:
  const shared = JSON.parse(readFileSync(resolve(DIR, "flashcards/_index.json"), "utf8")).shared, entries = Object.values(shared);
  assert.ok(entries.length > 300, `looked at ${entries.length} shared entries`);
  assert.equal(entries.filter((v) => new Set(v).size < 2).length, 0, "none names fewer than two decks today");
  // the fingerprint rides `_meta`, never the top level: the study worker inside the game bundles refuses any top-level key it
  // does not know (knowledge-scenario-manifest.src.js), so a top-level `live` read every player's study plan "unavailable"
  const man = JSON.parse(readFileSync(resolve(DIR, "flashcards/_index.json"), "utf8"));
  assert.deepEqual(Object.keys(man).sort(), ["_meta", "deckOrd", "shared"], "the manifest's top level is the study worker's");
  assert.match(man._meta.live, /^[0-9a-f]{8}$/, "and its _meta carries the live fingerprint");
});
