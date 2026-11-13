// THE ORDER PRACTICE ASKS IN (v1.274.0, owner U171 a, 13 Nov 2026: "What is worth most", and his Anki rule, ANKI1) —
// neural/src/practice-queue.src.js, the planner that plays it (neural/src/gameplan.src.js) and the app's two joins to it
// (`planSummary`, `_practiceSeats`).
//
// The owner's rule, as the option he picked put it: what comes up most in rolls and what you are closest to forgetting,
// position by position; at most 6 per position; every answer counts 1 toward 20; the "N due" count leaves the drawer. And
// the day, in his words (ANKI1): "we only add new cards if there's no due cards left to be reviewed according to the space
// repetition algo." So the 20 are due cards, worth most first, with the 2 due longest always asked; a new card comes only
// when nothing is due. Until ANKI1 the law kept a floor of 4 new a day (its tests and mutants Q2, Q9 and Q18 went with it).
//
// Part 1 pins the law on worlds small enough to price by hand, one claim per test. Part 2 replays the simulation's own days
// (tests/artifacts/practice_queue_parity.json). Part 3 pins the builder and the planner. Part 4 reads the real wire.
//
// PARITY WITH THE SIMULATION (the plan's, qsim.mjs, kept outside the repo as the rating's is). The owner's Anki rule is the
// simulation's policy A (`queueA`), written there from the rule, not from the law: the guard (the 2 due longest, by due day
// then world order), every position that owes anything by its six best owed worths, a visit's 6, the positions visited again
// until nothing is due, the last places kept for the guard, and new things only when nothing is due. Ties are content order
// (positions by their first askable thing, owed things by traffic order) and the fade is 0.9 ** x (the rating's arithmetic),
// as the first push had it. @@PARITY@@ Part 2 is that check frozen: 40 days of a small world, 443 asks, regenerated only
// from the simulation.
//
// MUTANTS (v1.274.0), each applied alone to a clean tree and run against this file; each turned the NAMED test red (the run
// log is in docs/Changelog-Archive.md, v1.274.0):
//   Q1  oldest first restored (positions by their oldest owed card)        → "worth, not age, decides which position comes first"
//   A1  a new card while something is due (new things ride in a position's visit, as the first push asked them)
//                                                                          → "a new card only when nothing is due"
//   A2  the guard removed (no place for the cards due longest)              → "the two cards due longest are asked whatever their worth"
//   A3  the guard's places not kept (the goal fills before its position)    → "the two cards due longest are asked whatever their worth"
//   A4  a position visited once (what is due past its 6 left for new cards)  → "at most 6 a visit; what is due is asked again past 6"
//   A5  new things take a position past 6 in the day                         → "new things never take a position past 6 in the day"
//   Q3  the per-position cap ignored                                        → "at most 6 at a position"
//   Q4  worth without forgetting (an owed thing worth its traffic alone)    → "forgetting counts"
//   Q5a a shared question built once per deck (one thing per deck row)       → "one question is asked once, worth all its decks"
//   Q5b the law's own guard against a thing handed in twice removed         → "a thing handed in twice is asked once, and counted"
//   Q6  a null cell read as zero (a deck this ruleset has not, priced at 0) → "a null cell is dropped and counted"
//   Q7  never looked read as a session (an empty record built as worth)     → "never looked is not a session"
//   Q8  a worth plan done only when the whole owed pile is                  → "a worth plan is done when what it asked is answered"
//   Q10 a placeholder binds a card already answered                         → "placeholders bind the deck's first unanswered cards"
//   Q11 the defending half filed at its attacker's seat                     → "the seat map is the wire's, read twice"
//   Q12 planSummary prices the order with the other ruleset's game          → "the planner prices with this ruleset's game"
//   Q13 a fallback that never says it fired (the beat removed)              → "the planner prices with this ruleset's game"
//   Q16 a met goal deals nothing (the round past the goal removed)          → "a goal, never a cap"
//   Q17 a position's unused move slots kept from its cards (2 new cards)    → "a position with no new move to ask gives its slots to cards"
//   Q19 the memo key without the knowledge revision (the reader's R9)       → "the order is kept for its inputs…"
//   Q20 a visit-less row numbered (the reader's finding 3: "NaN")           → "a row the order did not place is named apart…"
//
// NOT COVERED here:
//   · A RETIRED QUESTION READS AS A LIVE ONE, as in the rating (tests/rating.test.mjs): a deck's new count while its cards
//     are not loaded is its card count less the rows it holds, and a row for a rewritten question counts as one held. Such a
//     deck offers fewer new cards than it has. PR #405 teaches the rating live vs retired; this reads the same manifest.
//   · Moves. Stage 3's page cannot ask a hidden move, so the app hands the law cards only; the law's move handling is pinned
//     by Parts 1 and 2 for Stage 4.
//   · SEATLESS AND UNPRICED DECKS. 214 gi decks (346 no-gi) are priced but no seat claims them (the "…-Control" seats among
//     them): their owed cards are asked in the one "Other cards" position, scored by owed worth like any other, and their new
//     cards come, like any, only when nothing is due. 38 gi decks (293 cards) are allowed in gi but carry no gi weight (Buggy Choke, the heel hooks):
//     the order never asks them; "Everything owed, oldest first" (the eager cover) does. The reader's counts, 13 Nov.
//
// Run: node --test tests/practice_queue.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { ngPracticeVisits, ngPracticeItems, ngPracticeOrder } from "../neural/src/practice-queue.src.js";
import { ngRatingUniverse } from "../neural/src/rating.src.js";
import * as G from "../neural/src/gameplan.src.js";
import { ratingApp, ratingFixture } from "./_rating_fixture.mjs";
import { ngKnowledgeQuestionHash } from "../neural/src/knowledge-profile.src.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = resolve(HERE, "../source/quartz/static/neural");
const D = 20000;
const card = (id, seat, w, row = null, stage = 1) => ({ id, kind: "card", seat, w, row, stage });
const move = (id, seat, w, row = null) => ({ id, kind: "move", seat, w, row });
// a row answered `since` days ago at interval `ivl` (due `ivl` days after it was answered)
const ago = (since, ivl) => [D - since + ivl, ivl, D - since];
const law = (items, o = {}) => ngPracticeVisits({ items, day: D, goal: 20, cap: 6, ...o });

// ── Part 1: the law, by hand ──────────────────────────────────────────────────────────────────────────────────────────

test("worth, not age, decides which position comes first", () => {
  // A: light traffic (1), a card 33 days overdue (answered 40 days ago at 7): worth 1 × (1 − 0.9^(40/7)) = 0.452.
  // B: heavy traffic (10), a card due today (answered 3 days ago at 3): worth 10 × (1 − 0.9) = 1.0. B first; oldest first: A.
  const r = law([card("b", "B|Top", 10, ago(3, 3)), card("a", "A|Top", 1, ago(40, 7))]);
  assert.deepEqual(r.visits.map((v) => v.seat), ["B|Top", "A|Top"]);
  assert.deepEqual(r.asked, ["b", "a"]);
});

test("forgetting counts", () => {
  // C: heavy (3), answered 30 days ago at 30 (0.9 left): worth 0.3. D: light (1), a miss (interval 1, no stage): worth 1.
  const r = law([card("c", "C|Top", 3, ago(30, 30), 2), card("d", "D|Top", 1, ago(60, 1), 0)]);
  assert.deepEqual(r.visits.map((v) => v.seat), ["D|Top", "C|Top"], "a heavy card you still hold waits for a light one you have lost");
  // a move reads its own answer: a No is lost, a Yes fades like a card
  const m = law([move("yes", "Y|Top", 2, [...ago(3, 3), 1]), move("no", "N|Top", 1, [...ago(3, 3), 0])]);
  assert.deepEqual(m.visits.map((v) => v.seat), ["N|Top", "Y|Top"]);
});

test("at most 6 a visit; what is due is asked again past 6 while the goal has room", () => {
  const E = Array.from({ length: 9 }, (_, i) => card("e" + i, "E|Top", 1, ago(10 + i, 3)));
  const items = [...E, card("f0", "F|Top", 0.5, ago(10, 3)), card("f1", "F|Top", 0.5, ago(11, 3))];
  // ANKI1: nothing due is left for a new card, so E comes again for its three left. Until ANKI1 this read [E 6, F 2], 8 asked,
  // "the three left wait for another day" (the visit's 6 was the position's day)
  const r = law(items);
  assert.deepEqual(r.visits.map((v) => [v.seat, v.ids.length]), [["E|Top", 6], ["F|Top", 2], ["E|Top", 3]]);
  assert.equal(r.asked.length, 11, "everything due is asked");
  // the six of the first visit are E's six worth most (the most forgotten: answered longest ago)
  assert.deepEqual(r.visits[0].ids, ["e8", "e7", "e6", "e5", "e4", "e3"]);
  // with the goal at 8 the first visits fill it: the three left wait for another day
  assert.deepEqual(law(items, { goal: 8 }).visits.map((v) => [v.seat, v.ids.length]), [["E|Top", 6], ["F|Top", 2]]);
});

test("moves first at a position, then cards; at most 2 new moves, and 4 new things in all", () => {
  const items = [card("g1", "G|Top", 5, ago(20, 3)), move("m1", "G|Top", 0.1, [...ago(20, 3), 0]),
    move("nm1", "G|Top", 0.3), move("nm2", "G|Top", 0.2), move("nm3", "G|Top", 0.1),
    card("nc1", "G|Top", 0.3), card("nc2", "G|Top", 0.2), card("nc3", "G|Top", 0.1)];
  // what is due first, its moves before its cards; the new things after, once nothing is due (ANKI1). Until ANKI1 this was
  // one visit, ["m1", "nm1", "nm2", "g1", "nc1", "nc2"]: a new thing rode in beside a due one
  const r = law(items, { guard: 0 });
  assert.deepEqual(r.visits.map((v) => v.ids), [["m1", "g1"], ["nm1", "nm2", "nc1", "nc2"]]);
  // the guard puts the two due longest first at their position (here both, tied on their due day: the input's order)
  assert.deepEqual(law(items).visits[0].ids, ["g1", "m1"]);
});

test("a position with no new move to ask gives its slots to cards", () => {
  // Stage 3 hands the law cards only: a new player's position offers 4 new cards, so 20 is 5 positions, not 10
  const items = [];
  for (let s = 0; s < 6; s++) for (let i = 0; i < 5; i++) items.push(card("s" + s + "n" + i, "S" + s + "|Top", 6 - s))
  const r = law(items);
  assert.deepEqual(r.visits.map((v) => v.ids.length), [4, 4, 4, 4, 4]);
  assert.equal(r.n, 20);
});

test("a new card only when nothing is due", () => {
  // ANKI1, the owner: "we only add new cards if there's no due cards left to be reviewed". H owes 2 cards and has 3 heavy new
  // ones, and comes first; K owes 6. Until ANKI1 H's visit asked its new cards beside its due ones, so K's last three waited
  // (and a floor of 4 new topped the day up past the goal: "at least 4 new a day", 10 asked at a goal of 6)
  const items = [card("hn1", "H|Top", 5), card("hn2", "H|Top", 5), card("hn3", "H|Top", 5),
    card("h0", "H|Top", 4, ago(30, 3)), card("h1", "H|Top", 4, ago(30, 3)),
    ...Array.from({ length: 6 }, (_, i) => card("k" + i, "K|Top", 1, ago(30, 3)))];
  const r = law(items, { goal: 8 });
  assert.equal(r.n, 8);
  assert.deepEqual(r.visits.map((v) => v.seat), ["H|Top", "K|Top"], "H first");
  assert.equal(r.fresh, 0, "8 due fill a goal of 8: no new card");
  assert.deepEqual(r.asked.slice().sort(), ["h0", "h1", "k0", "k1", "k2", "k3", "k4", "k5"]);
  // with room left once everything due is asked, the new cards come: H's three, the heaviest
  const all = law(items, { goal: 11 });
  assert.deepEqual(all.asked.slice(8), ["hn1", "hn2", "hn3"]);
  // and the loose things are a position like any: a loose new card comes too (until ANKI1 one never filled the floor)
  const loose = law([card("x0", "X|Top", 5, ago(30, 3)), card("loose", null, 0.9), card("i", "I|Top", 0.4)], { goal: 3 });
  assert.deepEqual(loose.asked, ["x0", "loose", "i"]);
});

test("the two cards due longest are asked whatever their worth", () => {
  // four heavy positions owe 24 cards due 2 days ago; three light cards have waited longer (due 40, 30 and 20 days ago) at
  // positions worth least, the two longest-due at the LAST position. Worth alone would ask 20 heavy cards and none of them
  const heavy = [];
  for (let s = 0; s < 4; s++) for (let i = 0; i < 6; i++) heavy.push(card("s" + s + "c" + i, "S" + s + "|Top", 9 - s, ago(5, 3)));
  const light = [card("old40", "L|Top", 0.01, ago(47, 7)), card("old30", "L|Top", 0.01, ago(37, 7)), card("old20", "M|Top", 0.02, ago(27, 7))];
  const r = law([...heavy, ...light]);
  assert.equal(r.n, 20);
  assert.deepEqual(r.guard, ["old40", "old30"], "the two due longest");
  assert.ok(r.asked.includes("old40") && r.asked.includes("old30"), "both asked, though the goal was full of heavier cards");
  assert.ok(!r.asked.includes("old20"), "the third waits: the guard is two");
  assert.deepEqual(r.visits.at(-1), { seat: "L|Top", ids: ["old40", "old30"] }, "their position comes last; its places were kept");
  // with no guard, worth alone: none of them
  assert.ok(!law([...heavy, ...light], { guard: 0 }).asked.some((id) => id.startsWith("old")));
});

test("new things never take a position past 6 in the day", () => {
  // P asks its 4 due; its new cards (heavier than Q's) then fill only its 2 places left; Q's comes after. Until ANKI1 the
  // floor obeyed the same 6 ("the floor never takes a position past 6")
  const P = Array.from({ length: 4 }, (_, i) => card("p" + i, "P|Top", 5, ago(30, 3)));
  const r = law([...P, card("pn1", "P|Top", 4), card("pn2", "P|Top", 4), card("pn3", "P|Top", 4), card("qn", "Q|Top", 0.1)]);
  assert.deepEqual(r.visits.map((v) => [v.seat, v.ids]), [["P|Top", ["p0", "p1", "p2", "p3"]], ["P|Top", ["pn1", "pn2"]], ["Q|Top", ["qn"]]]);
});

test("every answer counts 1 toward the goal, and the day stops there", () => {
  const items = [];
  for (let s = 0; s < 8; s++) for (let i = 0; i < 6; i++) items.push(card("s" + s + "c" + i, "S" + s + "|Top", 8 - s, i < 3 ? ago(20, 7) : null));
  const r = law(items);
  assert.equal(r.n, 20); assert.equal(r.asked.length, 20);
  // 24 due fill the 20: no new card (ANKI1; until then the visits held 4 new beside the due)
  assert.equal(r.fresh, 0);
  assert.equal(new Set(r.asked).size, 20, "each thing once");
});

test("answered today, or not due yet, is never asked; a bad row is counted", () => {
  const r = law([card("today", "T|Top", 9, [D + 3, 3, D]), card("later", "T|Top", 9, [D + 5, 7, D - 2]),
    card("bad", "T|Top", 9, [D, 0, D - 1]), card("due", "T|Top", 1, ago(5, 3))]);
  assert.deepEqual(r.asked, ["due"]);
  assert.deepEqual([r.counts.today, r.counts.later, r.counts.badRow, r.counts.owed], [1, 1, 1, 1]);
});

test("a thing handed in twice is asked once, and counted", () => {
  const r = law([card("x", "X|Top", 2, ago(9, 3)), card("x", "Y|Top", 2, ago(9, 3)), card("y", "Y|Top", 1, ago(9, 3))]);
  assert.deepEqual(r.asked, ["x", "y"]);
  assert.equal(r.counts.twice, 1);
});

test("a weight that is not a number is dropped and counted, never priced", () => {
  const items = [card("n", "N|Top", null, ago(9, 3)), card("u", "N|Top", undefined, ago(9, 3)), card("z", "N|Top", 0, ago(9, 3)), card("o", "N|Top", 1, ago(9, 3))];
  const r = law(items, { guard: 0 });
  assert.equal(r.counts.outside, 2);
  assert.deepEqual(r.asked, ["o", "z"], "a zero weight is a real 'exists, never attempted': kept, priced at 0, asked last");
  // and it is due, so it is asked: with the guard it comes first (it and o tie on their due day: the input's order)
  assert.deepEqual(law(items).asked, ["z", "o"]);
});

// ── Part 2: the simulation's own days, frozen ────────────────────────────────────────────────────────────────────────

test("the law asks what the simulation asks, on its own days", () => {
  const P = JSON.parse(readFileSync(resolve(HERE, "artifacts/practice_queue_parity.json"), "utf8"));
  let days = 0, asks = 0, guarded = 0, withNew = 0, moves = 0;
  for (const rec of P.records) {
    const state = new Map(rec.state.map((s) => [s[0], s]));
    const items = [];
    P.world.forEach(([kind, seat, w], i) => {
      if (rec.cardsOnly && kind === "move") return;
      const s = state.get(i);
      // "seen": met in a roll and never scheduled, the simulation's one thing that is neither new nor owed
      const row = !s ? null : s[1] === "seen" ? "seen" : kind === "move" ? [s[1], s[2], s[3], s[4]] : [s[1], s[2], s[3]];
      items.push({ id: i, kind, seat, w, row, stage: kind === "move" || !s ? undefined : s[4] });
    });
    const r = ngPracticeVisits({ items, day: rec.day, goal: rec.goal, cap: 6 });
    assert.deepEqual(r.asked, rec.asked, `seed ${rec.seed}, day ${rec.day}: the same things in the same order`);
    assert.deepEqual(r.visits.map((v) => [v.seat, v.ids]), rec.visits, `seed ${rec.seed}, day ${rec.day}: the same visits`);
    assert.deepEqual(r.guard, rec.guard, `seed ${rec.seed}, day ${rec.day}: the same two due longest`);
    assert.equal(r.fresh, rec.fresh, `seed ${rec.seed}, day ${rec.day}: the same new things`);
    days++; asks += r.asked.length; guarded += r.guard.length; if (r.fresh) withNew++; moves += r.asked.filter((i) => P.world[i][0] === "move").length;
  }
  // a replay that compared nothing must not pass (traps-wire.md, "a CHECK THAT NEVER RAN"): it holds days with and without a
  // new thing, guarded cards and moves
  assert.ok(days >= 40 && asks >= 400 && guarded >= 40 && withNew >= 5 && withNew < days && moves >= 40, JSON.stringify({ days, asks, guarded, withNew, moves }));
});

// ── Part 3: the builder and the planner ──────────────────────────────────────────────────────────────────────────────
// Decks: A|Top (4 cards, weight 4 → 1 a card), B|Top (2, weight 20 → 10), S|Attacker (2, 2 → 1), Z|Attacker (2, null:
// not in this ruleset). Seats: A|Top and S|Attacker at A|Top, B|Top at its own, Z|Attacker at A|Top. "qs" is in A|Top and
// S|Attacker (worth 2).
const tiny = () => ngRatingUniverse({
  decks: { "A|Top": { n: 4 }, "B|Top": { n: 2 }, "S|Attacker": { n: 2 }, "Z|Attacker": { n: 2 } },
  weights: { "A|Top": 4, "B|Top": 20, "S|Attacker": 2, "Z|Attacker": null },
  shared: new Map([["qs", ["A|Top", "S|Attacker"]]]),
  seats: { "1/top": { w: 4, hand: {} } },
});
const SEATS = { "A|Top": "A|Top", "B|Top": "B|Top", "S|Attacker": "A|Top", "Z|Attacker": "A|Top" };
const DECKS = () => ({
  "A|Top": { count: 4, questions: ["q1", "qs"], exact: false, allowed: true, headroom: 0.15 },
  "B|Top": { count: 2, questions: ["q2"], exact: false, allowed: true, headroom: 0.15 },
  "S|Attacker": { count: 2, questions: ["qs"], exact: false, allowed: true, headroom: 0.15 },
  "Z|Attacker": { count: 2, questions: ["qz"], exact: false, allowed: true, headroom: 0.15 },
});
const SRS = () => ({ "A|Top": { q1: ago(20, 7), qs: ago(9, 3) }, "S|Attacker": { qs: ago(9, 3) }, "B|Top": { q2: ago(3, 3) }, "Z|Attacker": { qz: ago(9, 3) } });
const order = (o = {}) => ngPracticeOrder({ day: D, goal: 20, srs: SRS(), stage: {}, decks: DECKS(), game: tiny(), seats: SEATS, ...o });

test("one question is asked once, worth all its decks", () => {
  const built = ngPracticeItems({ day: D, srs: SRS(), stage: {}, decks: DECKS(), game: tiny(), seats: SEATS });
  const qs = built.items.filter((it) => it.id === "qs");
  assert.equal(qs.length, 1);
  assert.equal(qs[0].w, 2, "1 from A|Top's card plus 1 from S|Attacker's");
  assert.equal(qs[0].deck, "A|Top", "filed under the first of its decks that holds it at a seat");
  const o = order();
  assert.equal(o.rows.flatMap((r) => r.questions).filter((q) => q === "qs").length, 1);
});

test("a null cell is dropped and counted", () => {
  const o = order();
  assert.equal(o.counts.built.outside, 1, "qz: its one deck has no weight in this ruleset");
  assert.ok(!o.rows.some((r) => r.key === "Z|Attacker" || r.questions.includes("qz")), "and it is never asked");
  // its deck offers no new cards either
  assert.ok(!o.law.asked.some((id) => String(id).startsWith("Z|Attacker#")));
});

test("never looked is not a session", () => {
  const base = { day: D, srs: SRS(), stage: {}, decks: DECKS(), game: tiny(), seats: SEATS };
  assert.equal(ngPracticeItems({ ...base, srs: {} }).status, "empty");
  assert.equal(ngPracticeItems({ ...base, srs: { "A|Top": { q1: [D, 0, D] } } }).status, "empty", "only malformed rows: nothing read");
  assert.equal(ngPracticeItems({ ...base, seats: {} }).status, "no-seats");
  assert.equal(ngPracticeItems({ ...base, decks: {} }).status, "no-manifest");
  assert.equal(ngPracticeItems({ ...base, game: { status: "no-weights", total: 0, counts: {} } }).status, "no-weights");
  assert.equal(ngPracticeItems({ ...base, game: undefined }).status, "no-game");
  // the planner then builds today's order and says so; the weak-spots fallback still serves a session
  const fallback = { rows: [{ key: "B|Top", reason: "A loose spot." }, { key: "A|Top", reason: "A leak." }], assumptions: ["x"] };
  const plan = G.ngGameplanBuild({ day: D, ruleset: "gi", revision: 1, stamp: "s", target: 20, decks: DECKS(), srs: {}, fallback,
    worth: { game: tiny(), seats: SEATS, stage: {} } });
  assert.deepEqual([plan.order, plan.orderStatus], ["oldest", "empty"]);
  assert.deepEqual(plan.fresh.map((r) => r.key), ["B|Top", "A|Top"]);
  const none = G.ngGameplanBuild({ day: D, ruleset: "gi", revision: 1, stamp: "s", target: 20, decks: DECKS(), srs: SRS(), fallback });
  assert.deepEqual([none.order, none.orderStatus], ["oldest", "off"], "a caller that hands no game gets today's order, named");
});

test("the worth plan plays as today's page plays it", () => {
  const plan = G.ngGameplanBuild({ day: D, ruleset: "gi", revision: 1, stamp: "s", target: 20, decks: DECKS(), srs: SRS(),
    fallback: { rows: [{ key: "B|Top", reason: "r" }], assumptions: ["a"] }, worth: { game: tiny(), seats: SEATS, stage: {} } });
  assert.equal(plan.order, "worth");
  // what is due first: B|Top (10 a card, due today: worth 1.0) before A|Top (q1 and qs owed: 0.26 + 0.54); with nothing
  // due left, the new cards: B|Top's (7.5) then A|Top's three (0.75 each: its two placeholders, then S|Attacker's, by id).
  // Until ANKI1 the same 7 came another way (B's visit 2 with its new card, A's 4, then the floor's fourth from S|Attacker)
  assert.deepEqual(plan.visits.map((v) => v.seat), ["B|Top", "A|Top"]);
  assert.deepEqual([plan.counts.asked, plan.counts.askedNew], [7, 4]);
  assert.deepEqual(plan.queue, ["B|Top", "A|Top", "S|Attacker"]);
  assert.deepEqual(plan.fresh.map((r) => [r.key, r.count, r.visit]), [["S|Attacker", 1, 1]]);
  const [b, a] = plan.due;
  assert.deepEqual([b.key, b.owed, b.pending, b.count], ["B|Top", ["q2"], 1, 2]);
  assert.deepEqual([a.key, a.owed.slice().sort(), a.pending], ["A|Top", ["q1", "qs"], 2]);
  assert.match(b.reason, /^1 card due for review, so you keep what you've learned, and 1 new\.$/);
  assert.deepEqual(plan.dueQuestions.slice().sort(), ["q1", "q2", "qs"]);
  assert.equal(plan.newCards, 4); assert.equal(plan.total, 7);
  assert.ok(plan.more.every((r) => !plan.queue.includes(r.key)), "Keep practising adds what the day did not hold");
  assert.match(G.ngGameplanSummary(plan), /Positions come in order of what is worth most/);
  assert.deepEqual(G.ngGameplanLines(plan, { dueCards: 3 }, "A|Top"),
    { heading: "A · Top · position 2 of 2", count: "2 positions: 3 cards to review · 4 new, by how often they come up in your rolls" });
  // a day of reviews says new cards come when nothing is due (ANKI1), never "0 new"; until ANKI1 the line read "N new, by how
  // often they come up in your rolls and how close you are to forgetting them" (forgetting is the reviews', not the new cards')
  assert.equal(G.ngGameplanLines({ ...plan, newCards: 0, fresh: [] }, { dueCards: 3 }, "A|Top").count,
    "2 positions: 3 cards to review · new cards come when nothing is due");
  assert.equal(G.ngGameplanLines({ order: "oldest" }, {}, "A|Top"), null, "today's order keeps today's lines");
});

test("a worth plan is done when what it asked is answered", () => {
  // nine owed cards at one position and a goal of 6: the day asks six; the three left are not the day's debt (until ANKI1 the
  // goal was 20 and a position's one visit of 6 left the three; now a position is visited again while the goal has room)
  const nine = Object.fromEntries(Array.from({ length: 9 }, (_, i) => ["c" + i, ago(20 + i, 7)]));
  const decks = { "A|Top": { count: 9, questions: Object.keys(nine), exact: true, allowed: true, headroom: 0.15 } };
  const game = ngRatingUniverse({ decks: { "A|Top": { n: 9 } }, weights: { "A|Top": 9 }, shared: new Map(), seats: { "1/top": { w: 9, hand: {} } } });
  const srs = { "A|Top": { ...nine } };
  const plan = G.ngGameplanBuild({ day: D, ruleset: "gi", revision: 1, stamp: "s", target: 6, decks, srs, worth: { game, seats: { "A|Top": "A|Top" }, stage: {} } });
  assert.equal(plan.dueQuestions.length, 6);
  for (const q of plan.dueQuestions) srs["A|Top"][q] = [D + 7, 7, D];
  const p = G.ngGameplanProgress(plan, { srs, day: D, decks });
  assert.equal(p.complete, true, "six answered: done, with three still owed");
  assert.equal(p.dueCards, 0);
  assert.deepEqual(p.newDebt, [], "the three it did not ask were owed when it was built: not new debt");
});

test("a goal, never a cap: with today's goal met, Practice deals another round by worth", () => {
  // twenty questions answered today in a deck the game does not hold; the day's goal is met
  const srs = { ...SRS(), "Elsewhere|Top": Object.fromEntries(Array.from({ length: 20 }, (_, i) => ["t" + i, [D + 1, 1, D]])) };
  const plan = G.ngGameplanBuild({ day: D, ruleset: "gi", revision: 1, stamp: "s", target: 20, decks: DECKS(), srs,
    worth: { game: tiny(), seats: SEATS, stage: {} } });
  assert.equal(plan.reviewed.length, 20);
  assert.equal(plan.order, "worth");
  assert.deepEqual(plan.dueQuestions.slice().sort(), ["q1", "q2", "qs"], "the owed cards are still offered");
  assert.equal(plan.overrun, plan.total, "and the summary says the round runs past the goal");
  assert.match(G.ngGameplanSummary(plan), /runs \d+ cards over the goal/);
});

test("the order is kept for its inputs, and the knowledge revision is one of them", () => {
  // `_schedule` (the reveal-unanswered path) edits `srs` IN PLACE: the same object, a new revision. The memo must build again
  // (the reader's R9). Past today's goal every plan is a full round, so the goal in the key does not move when a card is
  // answered there: the revision is then the only input that does. Here 20 are answered today, then an owed card in place.
  const srs = { ...SRS(), "Elsewhere|Top": Object.fromEntries(Array.from({ length: 20 }, (_, i) => ["t" + i, [D + 1, 1, D]])) };
  const decks = DECKS(), game = tiny(), stage = {};
  const build = (revision) => G.ngGameplanBuild({ day: D, ruleset: "gi", revision, stamp: "s", target: 20, decks, srs, worth: { game, seats: SEATS, stage } });
  assert.ok(build(1).dueQuestions.includes("q2"));
  srs["B|Top"].q2 = [D + 3, 3, D];   // answered today, in place
  assert.ok(build(1).dueQuestions.includes("q2"), "the same inputs, the same order (the memo's contract)");
  assert.ok(!build(2).dueQuestions.includes("q2"), "a new revision: built again, the answered card gone");
});

test("a row the order did not place is named apart, never numbered", () => {
  const plan = G.ngGameplanBuild({ day: D, ruleset: "gi", revision: 1, stamp: "s", target: 20, decks: DECKS(), srs: SRS(),
    fallback: { rows: [{ key: "Z|Attacker", reason: "r" }], assumptions: ["a"] }, worth: { game: tiny(), seats: SEATS, stage: {} } });
  const extra = { key: "X|Attacker", kind: "new", questions: ["x1", "x2"], pending: 1, count: 3 };   // as "More new cards" appends it
  const withExtra = { ...plan, fresh: plan.fresh.concat([extra]), newCards: plan.newCards + 3, status: "weak-spots" };
  const L = G.ngGameplanLines(withExtra, { dueCards: 3 }, "X|Attacker");
  assert.equal(L.heading, "More new cards");
  assert.match(L.count, /: 3 cards to review · 4 new, by how often they come up in your rolls; 3 more new, weakest first$/);
  for (const k of withExtra.queue.concat(["X|Attacker"])) {
    const t = G.ngGameplanLines(withExtra, { dueCards: 0 }, k);
    assert.doesNotMatch(t.heading + " " + t.count, /NaN|undefined/, k);
  }
});

test("placeholders bind the deck's first unanswered cards, never more than the row asked", () => {
  const plan = G.ngGameplanBuild({ day: D, ruleset: "gi", revision: 1, stamp: "s", target: 20, decks: DECKS(), srs: SRS(),
    worth: { game: tiny(), seats: SEATS, stage: {} } });
  const decks = { ...DECKS(), "A|Top": { count: 4, questions: ["q1", "qs", "q3", "q4"], exact: true, allowed: true } };
  const srs = { ...SRS(), "A|Top": { ...SRS()["A|Top"], q3: ago(1, 7) } };   // q3 was answered (not due): never a new card
  const bound = G.ngGameplanBind(plan, decks, srs);
  const a = bound.due.find((r) => r.key === "A|Top");
  assert.deepEqual([a.questions, a.pending], [plan.due.find((r) => r.key === "A|Top").questions.concat(["q4"]), 0]);
});

// ── Part 4: the real wire ────────────────────────────────────────────────────────────────────────────────────────────

// the seat map read a second way: straight off `optionsFor` at each position, the plan's walk, not through the rating
function seatsByWalk(a) {
  const map = {};
  for (const p of a.nodes) {
    if (!p.rep || p.ty !== "positions" || p.cal?.stateAlias || !a.rsAllowsIdx(p.idx)) continue;
    for (const role of ["top", "bottom"]) {
      const at = a.currentPos; a.currentPos = p.idx; a._movesBusy = true;
      let opts; try { opts = a.optionsFor(p.idx, role); } finally { a._movesBusy = false; a.currentPos = at; }
      const seat = a.posFamily(p.t) + (role === "bottom" ? "|Bottom" : "|Top");
      map[seat] ??= seat;
      for (const d of opts) { const k = a.deckKeyFor(a.nodes[d.idx]).key; if (k) map[k] ??= seat; }
    }
  }
  for (const [k, s] of Object.entries({ ...map })) {
    const f = k.replace(/\|Attacker$/, "|Defender");
    if (f !== k) map[f] ??= s.endsWith("|Top") ? s.replace(/\|Top$/, "|Bottom") : s.replace(/\|Bottom$/, "|Top");
  }
  return map;
}

test("the seat map is the wire's, read twice", () => {
  for (const frame of ["gi", "nogi"]) {
    const a = ratingApp(DIR, frame), map = a._practiceSeats(a._ratingGame(frame)), walk = seatsByWalk(a);
    const keys = Object.keys(map);
    assert.ok(keys.length > 1000, `${frame}: ${keys.length} decks have a seat`);
    let defenders = 0;
    for (const k of new Set([...keys, ...Object.keys(walk)])) assert.equal(map[k], walk[k], `${frame} ${k}`);
    for (const k of keys) if (k.endsWith("|Defender") && map[k.replace(/\|Defender$/, "|Attacker")]) {
      const at = map[k.replace(/\|Defender$/, "|Attacker")];
      assert.equal(map[k], at.endsWith("|Top") ? at.replace(/\|Top$/, "|Bottom") : at.replace(/\|Bottom$/, "|Top"), `${frame} ${k}`);
      defenders++;
    }
    assert.ok(defenders > 300, `${frame}: ${defenders} defending halves sit opposite their attack`);
    assert.strictEqual(a._practiceSeats(a._ratingGame(frame)), map, "kept for its game");
  }
});

// A record chosen from the wire by rule, never by a typed key: the position deck worth most a card in this ruleset that holds
// three questions of its own and one it shares with another priced deck, all four missed 9 days ago (rows in every deck
// that holds them, as the grade writes them), on top of the rating's shared fixture.
const CARDS = (() => { const c = {}; for (const f of readdirSync(resolve(DIR, "flashcards")).sort()) if (f !== "_index.json") Object.assign(c, JSON.parse(readFileSync(resolve(DIR, "flashcards", f), "utf8"))); return c; })();
function heavySeat(a, frame) {
  const U = a._ratingGame(frame), map = a._practiceSeats(U);
  const decks = Object.keys(map).filter((k) => map[k] === k && U.deckUnit.has(k) && CARDS[k]).sort((x, y) => U.deckUnit.get(y) - U.deckUnit.get(x) || (x < y ? -1 : 1));
  for (const dk of decks) {
    const qs = CARDS[dk].cards.map((c) => ngKnowledgeQuestionHash(c.q));
    const own = qs.filter((q) => !U.shared.has(q)).slice(0, 3), shared = qs.find((q) => U.shared.has(q) && U.shared.get(q).some((o) => o !== dk && U.deckUnit.has(o)));
    if (own.length === 3 && shared) return { dk, own, shared, sharedIn: U.shared.get(shared) };
  }
  return null;
}

test("the planner prices with this ruleset's game, and writes nothing", () => {
  const FIX = ratingFixture(DIR);
  for (const frame of ["gi", "nogi"]) {
    const a = ratingApp(DIR, frame), H = heavySeat(a, frame);
    assert.ok(H, frame + ": a heavy position deck with a shared question");
    a.srs = structuredClone(FIX.blob.srs); a.stage = structuredClone(FIX.blob.stage); a.moves = structuredClone(FIX.blob.moves);
    for (const q of H.own) (a.srs[H.dk] ??= {})[q] = ago(9, 1);
    for (const dk of H.sharedIn) (a.srs[dk] ??= {})[H.shared] = ago(9, 1);
    const before = JSON.stringify([a.srs, a.stage, a.moves, a.settings]);
    a._gameplanRuntime = G; a.weakSpots = () => ({ cold: true, keys: [], veryWeak: [], weak: [] }); a.fx = (n, d) => a.beats.push([n, d]);
    a._checkKnowledgeDay = () => {}; a.startFrom = () => "standing";
    const plan = a.planSummary();
    assert.equal(plan.order, "worth", frame + ": " + plan.orderStatus);
    assert.equal(JSON.stringify([a.srs, a.stage, a.moves, a.settings]), before, frame + ": storage byte-identical");
    assert.equal(a._saves, 0, frame + ": no save asked");
    assert.deepEqual(a.beats.filter(([n]) => n === "practice_order_fallback"), [], "no fallback beat for a worth plan");
    const rows = plan.due.concat(plan.fresh);
    assert.equal(new Set(rows.map((r) => r.key)).size, rows.length, "one row per deck");
    for (const v of plan.visits) {
      const n = rows.filter((r) => v.keys.includes(r.key)).reduce((s, r) => s + r.count, 0);
      assert.ok(n >= 1 && n <= 6, `${frame} ${v.seat}: ${n} cards at one position`);
    }
    assert.ok(plan.visits.length >= 3, `${frame}: ${plan.visits.length} positions`);
    // the fixture owes fewer than what is left of the goal (20 less the 7 it answered today), so every due card is asked and
    // new cards fill the rest (ANKI1; until then "at least 4 new")
    const left = plan.target - plan.reviewed.length;
    assert.ok(plan.dueQuestions.length > 0 && plan.dueQuestions.length < left, `${frame}: ${plan.dueQuestions.length} due of ${left}`);
    assert.equal(plan.dueQuestions.length + plan.newCards, left, `${frame}: ${plan.dueQuestions.length} due, ${plan.newCards} new`);
    // the heavy seat comes first, its four missed cards are asked, the shared one ONCE though it sits in several decks
    const planned = rows.flatMap((r) => r.questions);
    assert.equal(plan.visits[0].seat, H.dk, frame + ": the position worth most first");
    assert.ok(H.sharedIn.length > 1);
    assert.equal(planned.filter((q) => q === H.shared).length, 1, frame + ": the shared question once");
    for (const q of H.own) assert.equal(planned.filter((x) => x === q).length, 1, frame + ": " + q);
    assert.equal(new Set(planned).size, planned.length, frame + ": no question twice anywhere");
    // the fixture's one card no-gi does not weigh (a gi-only technique deck) is outside in no-gi and priced in gi; every
    // other card it holds is priced in both, so the count names the ruleset whose game priced the day
    assert.equal(plan.counts.built.outside, frame === "gi" ? 0 : 1, frame + ": only the gi-only card is outside, and only in no-gi");
    // every row's deck is priced in THIS ruleset's game
    const U = a._ratingGame(frame);
    for (const r of rows) assert.ok(U.deckUnit.has(r.key), `${frame} ${r.key} is in this ruleset's game`);
    // and with no game (no graph yet), today's order, said once
    const b = ratingApp(DIR, frame); b.nodes = []; b._gameplanRuntime = G; b.weakSpots = a.weakSpots; b.fx = (n, d) => b.beats.push([n, d]);
    b._checkKnowledgeDay = () => {}; b.startFrom = () => "standing"; b.srs = structuredClone(FIX.blob.srs);
    const p1 = b.planSummary(), p2 = b.planSummary();
    assert.deepEqual([p1.order, p1.orderStatus, p2.orderStatus], ["oldest", "no-graph", "no-graph"]);
    assert.deepEqual(b.beats.filter(([n]) => n === "practice_order_fallback"), [["practice_order_fallback", { reason: "no-graph" }]]);
  }
});
