// THE RATING (v1.267.0, Stage 1) — neural/src/rating.src.js and its one reader in the app, `rating()`.
//
// The owner's rule (13 Nov 2026): the number is what you can recall RIGHT NOW (method C of the ELO1 report, as C0:
// nothing credited for what you knew before the app), on a points scale from 1000 (nothing) to 2000 (everything);
// table a's belt lines ("Even belts"); black from 1840. Stage 1 computes it and shows it nowhere.
//
// Part 1 pins the law on a hand-sized game whose arithmetic can be read off the page. Part 2 pins the reader on the
// real wire: its game against an independent read of the raw wire (by node ID, not by the index maps the app uses —
// the cal.ev join is index-keyed, CLAUDE.md §6.6 / traps-wire.md), both rulesets, the "never looked" statuses, the
// cache, and that it writes nothing. The shared record (tests/_rating_fixture.mjs) is the one the journey
// (e2e/journeys/rating-reader.spec.ts) seeds into a built page, so the page and this suite read one record.
//
// MUTANTS (v1.267.0), each applied alone and run against this file; each turned the NAMED test red and nothing else
// was needed to see it (the run log is in docs/Changelog-Archive.md, v1.267.0):
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
// NOT COVERED here: whether the weighting is the right one (the owner's call, measured by the ELO1 simulation, whose
// C0 this matches to 2e-11 points on 588 seeded records — scratch, not a gate), and any painted surface (none exists).
//
// Run: node --test tests/rating.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  NG_RATING_TABLE, NG_RATING_FLOOR, NG_RATING_TOP, NG_RATING_BLACK,
  ngRatingPoints, ngRatingLevel, ngRatingLevelFloor, ngRatingBeltOf, ngRatingNext, ngRatingRecall,
  ngRatingUniverse, ngRatingShare,
} from "../neural/src/rating.src.js";
import { ngWireScoreWeights } from "../neural/src/wire-keys.src.js";
import { ratingApp, ratingFixture, RATING_DAY } from "./_rating_fixture.mjs";

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
  shared: new Map([["qs", ["A|Top", "B|Top"]]]),
  seats: { "1/top": { w: 0.6, hand: { 10: 50, 11: 30, 12: null, 13: 20 } }, "2/bottom": { w: null, hand: { 20: 100 } } },
});
const fresh = (ivl = 7) => [D + ivl, ivl, D];

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
  close(ngRatingShare(U, rec, D).share, 0.3 / 1.4, "fresh");
  close(ngRatingShare(U, rec, D + 365).share, (0.3 / 1.4) * 0.9 ** (365 / 30), "a year on");
});

test("a question shared by several decks is ONE question", () => {
  const U = tiny();
  // filed in both decks (as ngKnowledgeApplyGrade files a shared question), its stage in A only
  const r = ngRatingShare(U, { srs: { "A|Top": { qs: fresh() }, "B|Top": { qs: fresh() } }, stage: { "A|Top": { qs: 3 } } }, D);
  close(r.share, 0.35 / 1.4, "worth A's share plus B's, once");
  assert.equal(r.counts.questions, 1); assert.equal(r.counts.rows, 2);
  // filed in ONE deck only (an older blob): still the shared question's whole worth
  close(ngRatingShare(U, { srs: { "B|Top": { qs: fresh() } }, stage: {} }, D).share, 0.35 / 1.4, "its decks are the index's, not the rows'");
  // an interval-1 row whose stage sits in its OTHER deck: the stage is the highest of its decks, so it reads right
  const u = { srs: { "A|Top": { qs: [D + 1, 1, D] }, "B|Top": { qs: [D + 1, 1, D] } }, stage: { "B|Top": { qs: 1 } } };
  close(ngRatingShare(U, u, D).share, (0.35 * 0.9) / 1.4, "a stage in any of its decks");
  // the latest row wins, the same-day tie going to the smaller interval (the cloud merge's rule)
  const late = { srs: { "A|Top": { qs: [D + 120, 120, D - 200] }, "B|Top": { qs: [D + 1, 1, D] } }, stage: {} };
  assert.equal(ngRatingShare(U, late, D).share, 0, "the later row, a reset with no stage, is a miss");
  // everything known, fresh: exactly the whole game
  const all = { srs: { "A|Top": { qs: fresh(), a1: fresh() }, "B|Top": { qs: fresh(), b1: fresh(), b2: fresh(), b3: fresh() } }, stage: {},
    moves: { "1/top": { 10: [D + 7, 7, D, 1], 11: [D + 7, 7, D, 1], 13: [D + 7, 7, D, 1] } } };
  const whole = ngRatingShare(U, all, D);
  close(whole.share, 1, "every question and every move"); assert.equal(whole.points, NG_RATING_TOP);
});

test("zero traffic weighs nothing", () => {
  const U = tiny();
  assert.equal(U.counts.zeroWeight, 1, "Z is a real zero: counted");
  close(U.total, 1.4, "the game's total is its traffic, nothing for Z or G");
  const r = ngRatingShare(U, { srs: { "Z|Attacker": { z1: fresh(30) }, "G|Attacker": { g1: fresh(30) } }, stage: { "Z|Attacker": { z1: 4 }, "G|Attacker": { g1: 4 } } }, D);
  assert.equal(r.status, "ok");
  assert.equal(r.share, 0, "known, and worth nothing");
  assert.equal(r.points, NG_RATING_FLOOR);
  assert.deepEqual([r.counts.weighted, r.counts.outside], [1, 1], "Z is priced (at 0); G is not in this ruleset's game");
});

test("a move counts by its share of the seat's hand", () => {
  const U = tiny();
  close(ngRatingShare(U, { moves: { "1/top": { 10: [D + 7, 7, D, 1] } } }, D).share, (0.6 * 0.5) / 1.4, "a Yes on 10");
  close(ngRatingShare(U, { moves: { "1/top": { 13: [D + 1, 1, D, 1] } } }, D).share, (0.6 * 0.2 * 0.9) / 1.4, "a first Yes (interval 1) at 0.9");
  const r = ngRatingShare(U, { moves: { "1/top": { 11: [D + 1, 1, D, 0], 99: [D + 7, 7, D, 1], e00ff: [D + 7, 7, D, 1] }, "7/top": { 10: [D + 7, 7, D, 1] } } }, D);
  assert.equal(r.share, 0, "a No, a move this seat does not deal, an escape, a seat this ruleset does not deal");
  assert.deepEqual([r.counts.moves, r.counts.weighted, r.counts.outside], [4, 1, 3]);
});

test("a miss is worth nothing", () => {
  const U = tiny();
  const r = ngRatingShare(U, { srs: { "A|Top": { a1: [D + 1, 1, D] } }, stage: { "A|Top": { a1: 0 } }, moves: { "1/top": { 10: [D + 1, 1, D, 0] } } }, D);
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
  const r = ngRatingShare(U, { srs: { "N|Attacker": { n1: fresh(30) } }, stage: { "N|Attacker": { n1: 4 } }, moves: { "1/top": { 12: [D + 7, 7, D, 1] }, "2/bottom": { 20: [D + 7, 7, D, 1] } } }, D);
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
  none(ngRatingShare(ngRatingUniverse({ ...game, decks: null }), { srs: { "A|Top": { a: fresh() } } }, D), "no-manifest");
  none(ngRatingShare(ngRatingUniverse({ ...game, decks: {} }), { srs: { "A|Top": { a: fresh() } } }, D), "no-manifest");
  none(ngRatingShare(ngRatingUniverse({ ...game, weights: {} }), { srs: { "A|Top": { a: fresh() } } }, D), "no-weights");
  none(ngRatingShare(ngRatingUniverse({ ...game, seats: {} }), { srs: { "A|Top": { a: fresh() } } }, D), "no-hands");
  none(ngRatingShare(ngRatingUniverse({ ...game, weights: { "A|Top": 0 }, seats: { "1/top": { w: 0, hand: { 10: 0 } } } }), { srs: { "A|Top": { a: fresh() } } }, D), "no-weights");
  none(ngRatingShare(null, { srs: { "A|Top": { a: fresh() } } }, D), "no-weights");
  const U = ngRatingUniverse(game);
  none(ngRatingShare(U, {}, D), "empty");
  none(ngRatingShare(U, { srs: {}, stage: {}, moves: {} }, D), "empty");
  none(ngRatingShare(U, { srs: { "A|Top": { a: fresh() } } }, undefined), "no-day");
  // a stage with no schedule (a blob from before v1.105.0) IS an answer: a number, and the row counted
  const old = ngRatingShare(U, { stage: { "A|Top": { a: 3 } } }, D);
  assert.equal(old.status, "ok"); assert.equal(old.points, NG_RATING_FLOOR); assert.equal(old.counts.stageOnly, 1);
});

// ── Part 2: the reader, on the real wire ────────────────────────────────────────────────────────────────────────────
const RAW = JSON.parse(readFileSync(resolve(DIR, "graph-data.json"), "utf8"));
const CUR = JSON.parse(readFileSync(resolve(DIR, "curriculum.json"), "utf8"));
const FIX = ratingFixture(DIR);
const APP = { gi: ratingApp(DIR, "gi"), nogi: ratingApp(DIR, "nogi") };
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
    assert.equal(r.counts.questions, 12, frame);
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
    const before = JSON.stringify([a.srs, a.stage, a.moves, a.prep, a.belts, a.units, a.dayLog]);
    const ids = [a.srs, a.stage, a.moves];
    a.rating(); a._epochDay = () => RATING_DAY + 400; a.rating();
    assert.equal(a._saves, 0, frame + ": no save asked for");
    assert.equal(JSON.stringify([a.srs, a.stage, a.moves, a.prep, a.belts, a.units, a.dayLog]), before, frame + ": nothing changed");
    assert.deepEqual([a.srs, a.stage, a.moves], ids, frame + ": the record's objects are the same objects");
  }
});
