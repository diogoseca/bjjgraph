// THE SCHEDULE (v1.279.0, ruled SRS-GO) — neural/src/knowledge-profile.src.js (`ngKnowledgeScheduleRow`, `ngKnowledgeMergeRow`,
// `ngKnowledgeInterval`, `ngKnowledgeCell`), the app's srs pull merge that calls it (`_mergeProgressFields`) and the moves merge
// (`ngProgressMergeMoves`, neural/src/progress-owner.src.js).
//
// The owner's ladder: 1, 3, 7, 14, 30, 60, 90, 180, 365, 730, 1461, 2922 days, then (since v1.305.0, LATE2, U226 a) the
// fitted curve, each rung C(the one before), C(x) = x × (1 + (4 years ÷ x)^(1/6)): 5,525, 9,951, 17,179 … (it doubled from
// v1.279.0 to v1.304.0). A miss: back to 1 day. A late right answer: since v1.305.0 (LATE1 and LATE2, the owner's rule, U223 b
// and U226 a) max(one step, t × min(step ÷ I, C(t) ÷ t)), t the days since its last answer: on its due day exactly one step,
// after it twice the wait wherever his step at least doubles and the step's own multiple where it does not, past 4 years the
// curve's (one rung and no bonus from v1.279.0 to v1.304.0, measured then by ANKI1; the rule's own cases, the study's four
// conditions and its mutants: tests/schedule_late.test.mjs). A card answered on every due day climbs his rungs, 60 → 90 (LATE1's
// first form sent it 60 → 120, past the 90 rung). An early right answer: since v1.281.0 (LIN1) the owner's own formula,
// LINEAR credit in the days waited since the card's last full step, carried exactly in the row's pair [A, t0] while the card
// sits between steps (its own cases, the copies of its reader and its mutants: tests/schedule_linear.test.mjs); v1.279.0's
// proportional log-scale credit is gone, and with it the 60-to-89-day band that held its interval under daily answers. No
// stored row is rewritten: a row without a pair reads as anchored at its last, its interval due − last (never below the
// cell); the cell is written as the largest rung of the seven-rung ladder at or below the exact interval, so an older client
// always finds a rung.
//
// THE OLDER CLIENT is dev v1.278.2's own code (3b050d06f; its writer and merges are the same text as v1.273.1's), cut from git's
// copy of each file by tests/artifacts/_capture_old_schedule.mjs into tests/artifacts/schedule_old_client.json (never re-typed):
// its `ngKnowledgeScheduleRow`, its inline srs pull merge, its `ngProgressMergeMoves` and its rating's `ngRatingRecall`. THE LOSS ON AN OLDER CLIENT, said plainly: its right answer gives the card a full rung of ITS ladder
// from the cell, capped at 120 days, whatever the day (a 365-day card comes back in 120), until a new client answers it again;
// it never sends a card back to 1 day, its due counts read `due` (exact), and its heal can only make a card due later.
//
// MUTANTS (v1.279.0), each applied alone to a clean tree and run against this file (the run log is in
// docs/Changelog-Archive.md, v1.279.0); each turned the NAMED test red:
//   L1  an early right answer earns a full rung (today's rule)              → "his example: day 31.7, day 87.6 and day 90"
//   L2  a late right answer earns more than a rung (the credit uncapped)    → "a late right answer earns one rung, no bonus"
//       (v1.305.0: L2 IS the owner's rule now; that test pins the rule's numbers instead, and the rule's own mutants are in
//       tests/schedule_late.test.mjs)
//   L3  the ladder capped at 120 days (today's seven rungs)                 → "the 120-day card's next step is 241 days on time"
//   L4  the cell written unfloored (the true interval)                      → "the cell is always a rung of the seven" and
//                                                                              "an older client never sends a new row to 1 day"
//   L5  the place read from the stored cell, not the true interval          → "a right answer never makes a card due sooner"
//   L6  a right answer off the ladder resets to 1 day (`indexOf` on a rung) → "a right answer never goes back to 1 day"
//   L7  the pull merge without the due tie-break                            → "two devices converge, both orders, a cloud that holds a row"
//   L8  the srs heal read from the cells                                    → "a winning success keeps the longer TRUE interval it beat"
//   L9  the moves heal read from the cells                                  → "a winning success keeps the longer TRUE interval it beat"
// SRS-R1 (the independent reader's findings 1 to 5), the same way:
//   L10 the never-sooner guard dropped (`Math.max(prior[0], …)`)           → "a right answer never makes a card due sooner"
//   L11 an answer filed on today's day again (`last` moved backward)       → "a clock set back never lengthens an interval"
//   L12 the rating reads the cell again (`ivl = row[1]`)                   → "the rating reads a card at 0.9 on its due day, at 90,
//                                                                              365 and 2,922 days" and "the Practice order's worth
//                                                                              moves with the rating's read"
//   L13 a shared question's row without the earlier-due tie (rating.src.js) → "a shared question whose decks drifted is asked
//                                                                              when it is owed, and read the same in either order"
//   L14 the Practice order's row choice back to its own inline rule         → the same test
//   L15 an early answer's interval rounded UP whenever a day has passed     → "answered every day: never more than one on-time
//       (the reader's candidate fix for the 60 to 89 day band, not taken)      answer, and a card at 60 to 89 days holds"
//   L16 the app's pull block back to dev's own inline merge                 → "the app's pull merges srs and moves rows the same
//                                                                              in both orders…" (tests/progress_owner.integration
//                                                                              .test.mjs, the app's own pull against a cloud that
//                                                                              holds rows); L7, L8 and L9 are red there too
//
// Run: node --test tests/schedule_ladder.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as K from "../neural/src/knowledge-profile.src.js";
import { ngProgressMergeMoves } from "../neural/src/progress-owner.src.js";
import * as R from "../neural/src/rating.src.js";
import { ngPracticeItems, ngPracticeVisits } from "../neural/src/practice-queue.src.js";
import { ngGameplanDebt } from "../neural/src/gameplan-debt.src.js";
import { knowledgeSource } from "./_knowledge_profile_harness.mjs";
import { onestep } from "./_onestep_client.mjs";

const OLD = JSON.parse(readFileSync(new URL("./artifacts/schedule_old_client.json", import.meta.url), "utf8"));
// dev's own writer, closing over dev's own ladder
const oldRow = new Function(OLD.knowledge.intervals + "\n" + OLD.knowledge.scheduleRow + "\nreturn ngKnowledgeScheduleRow;")();
// dev's own srs pull merge, run as the app runs it: `this` holds the local srs, `cloud` the pulled blob
const oldMergeBlock = new Function("cloud", OLD.app.srsMerge);
const oldMerge = (local, cloud, today) => {
  const host = { srs: { A: local ? { q: local.slice() } : {} }, _epochDay: () => today };
  oldMergeBlock.call(host, { srs: { A: { q: cloud.slice() } } });
  return host.srs.A.q;
};
const oldMergeMoves = new Function(OLD.owner.mergeMoves + "\nreturn ngProgressMergeMoves;")();
// dev's own rating read of a row (the cell as the interval)
const oldRecall = new Function([OLD.rating.num, OLD.rating.fade, OLD.rating.unsure, OLD.rating.recall].join("\n") + "\nreturn ngRatingRecall;")();
const SEVEN = [1, 3, 7, 14, 30, 60, 120];

// every row the new writer can produce from a spread of histories: on-ladder and between-rungs rows, answered on every day
// from the same day to twice late, right and wrong
function newRows() {
  const out = [];
  const starts = [[1, 1, 0], [3, 3, 0], [7, 7, 0], [14, 14, 0], [30, 30, 0], [60, 60, 0], [120, 120, 0], [42, 30, 0], [95, 60, 0],
    [241, 120, 0], [500, 120, 0], [2, 14, 1] /* a hand-built row: its cell above due − last */];
  for (const s of starts) {
    const iv = K.ngKnowledgeInterval(s);
    for (const day of new Set([s[2], s[2] + 1, s[2] + Math.floor(iv / 2), s[0] - 1, s[0], s[0] + iv, s[2] + 2 * iv + 3])) {
      if (day < s[2]) continue;
      for (const ok of [true, false]) out.push({ prior: s, day, ok, row: K.ngKnowledgeScheduleRow(s, ok, day) });
    }
  }
  return out;
}

test("his example: 59 days answered 1 day early, 31 days answered 29 days early, 60 on time (LIN1)", () => {
  // a card at 30 days, last answered on day 0 (due day 30). His words: "(30 - 1) x2 + 1 = 59 … (30-29) x 2 + 29 = 31"
  const card = [30, 30, 0];
  assert.equal(K.ngKnowledgeNextInterval(card, 29), 59, "1 day before its due: 59 days from that answer");
  assert.equal(K.ngKnowledgeNextInterval(card, 1), 31, "29 days before (the day after the last answer): 31; the log rule gave 30.7");
  assert.equal(K.ngKnowledgeNextInterval(card, 30), 60, "on time: one step, 30 to 60 days");
  // the stored rows: the whole due day, the cell a rung of the seven, and the pair [A, t0] while the card is between steps
  assert.deepEqual(K.ngKnowledgeScheduleRow(card, true, 1), [32, 30, 1, 30, 0]);
  assert.deepEqual(K.ngKnowledgeScheduleRow(card, true, 29), [88, 30, 29, 30, 0]);
  assert.deepEqual(K.ngKnowledgeScheduleRow(card, true, 30), [90, 60, 30]);
  // every day waited adds the same: here one day of credit a day, 30 to 60 over the step
  for (let d = 0; d < 30; d++) assert.equal(K.ngKnowledgeNextInterval(card, d), 30 + d);
  // it cannot be farmed: a right answer every day for 30 days lands exactly on one on-time answer, no more
  let row = card;
  for (let d = 1; d <= 30; d++) row = K.ngKnowledgeScheduleRow(row, true, d);
  assert.deepEqual(row, [90, 60, 30], "thirty daily answers: the step taken on day 30, as one on-time answer");
  // a second answer the same day earns nothing
  assert.deepEqual(K.ngKnowledgeScheduleRow([32, 30, 1, 30, 0], true, 1), [32, 30, 1, 30, 0]);
});

test("a late right answer earns one rung, no bonus", () => {
  // v1.305.0 (LATE1, LATE2): the title is v1.279.0's claim, kept so the mutant table above still names it; the claim is now the
  // owner's late rule (twice the days since the last answer here, on rungs whose step doubles; the one-step client's numbers
  // beside it)
  // a 30-day card answered right on day 60 (30 days late): twice the 60 days since its last answer, 120 (one step gave 60)
  assert.equal(K.ngKnowledgeNextInterval([30, 30, 0], 60), 120);
  assert.equal(onestep.next([30, 30, 0], 60), 60, "the one-step client: one rung");
  // (its late mark after the pair's slot, v1.305.0: [0, 0, the one-step 60, its own 120])
  assert.deepEqual(K.ngKnowledgeScheduleRow([30, 30, 0], true, 60), [180, 120, 60, 0, 0, 60, 120]);
  // a year late on a 7-day card: 800 days, twice the 400 since its last answer (one step gave 14)
  assert.deepEqual(K.ngKnowledgeScheduleRow([7, 7, 0], true, 400), [1200, 120, 400, 0, 0, 14, 800]);
  assert.deepEqual(onestep.write([7, 7, 0], true, 400), [414, 14, 400], "the one-step client: still one rung");
  // and on its due day, one step: the step is the floor, never less
  assert.deepEqual(K.ngKnowledgeScheduleRow([30, 30, 0], true, 30), [90, 60, 30]);
  assert.deepEqual(K.ngKnowledgeScheduleRow([7, 7, 0], true, 7), [21, 14, 7]);
});

test("the ladder: his rungs, a miss back to 1 day, and the 120-day card's next step is 241.67 days on time", () => {
  // his rungs to 2,922 days, then the fitted curve's (LATE2, U226 a; v1.279.0 to v1.304.0 doubled: 5,844, 11,688)
  assert.deepEqual(K.NG_KNOWLEDGE_LADDER.slice(0, 14), [1, 3, 7, 14, 30, 60, 90, 180, 365, 730, 1461, 2922, 5525, 9951]);
  // on time, from a first right answer, every answer on its due day: rung after rung, as the one-step client climbed them to 8
  // years, then the curve's (LATE2: on its due day the late rule is exactly one step; LATE1's first form sent the 60-day card
  // to 120 there and every on-time step after it ran a third above his rungs: 242, 487, 974, 1,949, 3,898, 7,796)
  let row = K.ngKnowledgeScheduleRow(null, true, 0), steps = [row[0] - row[2]];
  for (let i = 0; i < 12; i++) { row = K.ngKnowledgeScheduleRow(row, true, row[0]); steps.push(row[0] - row[2]); }
  assert.deepEqual(steps, [1, 3, 7, 14, 30, 60, 90, 180, 365, 730, 1461, 2922, 5525]);
  { let o = onestep.write(null, true, 0); const one = [o[0] - o[2]];
    for (let i = 0; i < 12; i++) { o = onestep.write(o, true, o[0]); one.push(o[0] - o[2]); }
    assert.deepEqual(one, [1, 3, 7, 14, 30, 60, 90, 180, 365, 730, 1461, 2922, 5844], "the one-step client: rung after rung"); }
  // and the rungs themselves are his: a card ON each rung, answered on its due day, takes the next rung, the 60-day card too
  // (90; LATE1's first form: 120)
  { const D = 20400;
    assert.deepEqual(K.NG_KNOWLEDGE_LADDER.slice(0, 12).map((r) => K.ngKnowledgeInterval(K.ngKnowledgeScheduleRow([D + r, K.ngKnowledgeCell(r), D], true, D + r))),
      [3, 7, 14, 30, 60, 90, 180, 365, 730, 1461, 2922, 5525]); }
  // a miss, early or late, at any rung: 1 day
  for (const r of [[3, 3, 0], [120, 120, 0], [361, 120, 120]]) for (const d of [r[2], r[0], r[0] + 50]) assert.deepEqual(K.ngKnowledgeScheduleRow(r, false, d), [d + 1, 1, d]);
  // a card at today's top rung (120 days, a third of the way from 90 to 180 on his ladder): one step on is a third of the way
  // from 180 to 365, 241.67 days (180 + 185 ÷ 3, carried as computed since v1.281.3), in the pair and due on its first whole
  // day; then 486.67 (365 + 365 ÷ 3)
  // (at a real epoch day, D = 20,400, so every pinned row is one a device could hold: LIN2-R1)
  const D = 20400, top = [D + 120, 120, D], step = 180 + 185 / 3;
  assert.deepEqual(K.ngKnowledgeScheduleRow(top, true, D + 120), [D + 362, 120, D + 120, step, D + 120]);
  assert.deepEqual(K.ngKnowledgeScheduleRow([D + 362, 120, D + 120, step, D + 120], true, D + 362), [D + 849, 120, D + 362, K.ngKnowledgeStep(step), D + 362]);
  assert.ok(Math.abs(K.ngKnowledgeStep(step) - (365 + 365 / 3)) < 1e-9);
  // and early, the next day: it hardly moves. Since v1.281.3 it stands on the 90-day rung's line, 30 days in (a day a day):
  // 121 days from its next day (v1.281.0's line from 120 itself gave 121.01, a day more)
  assert.deepEqual(K.ngKnowledgeScheduleRow(top, true, D + 1), [D + 122, 120, D + 1, 90, D - 30]);
});

test("the cell is always a rung of the seven, the largest at or below the true interval", () => {
  let checked = 0;
  for (const { row } of newRows()) {
    assert.ok(SEVEN.includes(row[1]), `${row}: cell ${row[1]} is a rung of the seven`);
    const t = K.ngKnowledgeInterval(row);
    assert.equal(row[1], Math.max(...SEVEN.filter((r) => r <= t)), `${row}: the largest at or below ${t}`);
    assert.equal(row[0], K.ngKnowledgeDueDay(row[2] + t), `${row}: due on the first whole day at or after the exact due`);
    assert.ok(row[0] - row[2] - t < 1 && row[0] - row[2] >= t, `${row}: the whole days hold the exact interval`);
    checked++;
  }
  assert.ok(checked > 150, `${checked} rows`);
});

test("a right answer never makes a card due sooner", () => {
  let checked = 0;
  for (const { prior, day, ok, row } of newRows()) {
    if (!ok) continue;
    assert.ok(row[0] >= prior[0], `${prior} answered right on day ${day}: due ${row[0]}, was ${prior[0]}`);
    checked++;
  }
  // between rungs: a 42-day card (cell 30) answered the next day comes due on day 44, never by its cell. Since v1.281.3 it
  // stands on the 30-day rung's line, 12 days in, a day a day: 43 days from day 1 (v1.281.0's line from 42 gave 42.71)
  assert.deepEqual(K.ngKnowledgeScheduleRow([20442, 30, 20400], true, 20401), [20444, 30, 20401, 30, 20388]);   // at a real epoch day (LIN2-R1)
  // a clock set back (SRS-R1, the reader's finding 5): every row, answered right 1, 30 and 400 days before its last answer
  for (const { row } of newRows()) for (const back of [1, 30, 400]) {
    const w = K.ngKnowledgeScheduleRow(row, true, row[2] - back);
    assert.ok(w[0] >= row[0], `${row} answered right ${back} days before its last: due ${w[0]}`);
    checked++;
  }
  // THE GUARD'S OWN ROW. Since SRS-R1 an answer before the row's last is filed on its last (the next test), and since LIN1
  // the exact due only rises, so the guard holds only a row whose due is a hair past a whole day: no writer stores one and the
  // pull truncates a cloud row (`| 0`), so it would come from a hand-edited or damaged blob. Its first whole day falls a
  // millionth short of the due it had, and the guard keeps that due (L10 red here). A due of 430.4 is held by the rule itself
  const hair = 430 + 5e-7;
  assert.deepEqual(K.ngKnowledgeScheduleRow([hair, 30, 400], true, 400), [hair, 30, 400]);
  assert.deepEqual(K.ngKnowledgeScheduleRow([hair, 30, 400], true, 390), [hair, 30, 400]);
  assert.deepEqual(K.ngKnowledgeScheduleRow([430.4, 30, 400], true, 400), [431, 30, 400, 430.4 - 400, 400]);   // carried as computed (v1.281.3)
  assert.ok(checked > 500, `${checked} right answers`);
});

test("a clock set back never lengthens an interval: the writer never moves `last` backward", () => {
  // the reader's row (finding 4): a 30-day card last answered on day 400, answered right on a device whose clock reads 390
  const r = [430, 30, 400];
  assert.deepEqual(K.ngKnowledgeScheduleRow(r, true, 390), [430, 30, 400], "filed on its last: the row as it was");
  assert.deepEqual(K.ngKnowledgeScheduleRow(r, true, 100), [430, 30, 400], "set back 300 days: the same");
  // then the clock is right again and the card is answered on its due day: the on-time step from 30 is 60 (it was 71 when the
  // answer was filed on day 390: a true interval of 40 for nothing)
  assert.deepEqual(K.ngKnowledgeScheduleRow(K.ngKnowledgeScheduleRow(r, true, 390), true, 430), [490, 60, 430]);
  // a miss there comes due the day after the row's last
  assert.deepEqual(K.ngKnowledgeScheduleRow(r, false, 390), [401, 1, 400]);
  // every row the writer produces, every day before its last: `last` never moves back, and a right answer leaves the row as it was
  let checked = 0;
  for (const { row } of newRows()) for (const back of [1, 10, 300]) {
    assert.deepEqual(K.ngKnowledgeScheduleRow(row, true, row[2] - back), row, `${row}, ${back} days back`);
    const miss = K.ngKnowledgeScheduleRow(row, false, row[2] - back);
    assert.deepEqual(miss, [row[2] + 1, 1, row[2]], `${row} missed ${back} days back`);
    checked++;
  }
  assert.ok(checked > 250, `${checked} rows`);
});

test("answered every day: exactly one on-time answer, in every band, and no band holds its interval (LIN1)", () => {
  // THE CLAIM: an early answer never earns more than an on-time one, and with linear credit a run of early answers earns
  // exactly what one answer at its end earns. Every interval from 1 to 2,922 days, answered right every day for one interval,
  // ends where exactly one on-time answer does: the same due day, the same interval (to float dust, 1e-9). Since v1.281.3 the
  // two rows may say it two ways: the run's last answer is early, so it stores the rung pair it climbed; the on-time answer
  // stores its step anchored at its own day
  // (from a real epoch day, D = 20,400: a card's rung pair is dated up to its rung's interval before its last answer, and from
  // day 0 a card of 42 days or more would have been written without it, LIN2-R1)
  // v1.305.0 (LATE2): the one on-time answer earns the late rule's number, which on the due day is exactly one step, so the
  // claim holds again on every interval (LATE1's first form paid the on-time answer twice the interval where that beat one
  // step, 31 to 89 days, and the daily run ended behind it there, never ahead; that branch below is kept and finds nothing)
  const off = [];
  const D = 20400;
  for (let I = 1; I <= 2922; I++) {
    let row = [D + I, K.ngKnowledgeCell(I), D];
    const onTime = K.ngKnowledgeScheduleRow(row, true, D + I);
    for (let d = 1; d <= I; d++) row = K.ngKnowledgeScheduleRow(row, true, D + d);
    if (row[0] !== onTime[0] || row[1] !== onTime[1] || row[2] !== onTime[2] || Math.abs(K.ngKnowledgeInterval(row) - K.ngKnowledgeInterval(onTime)) > 1e-9) {
      off.push(I);
      assert.ok(row[0] < onTime[0], `${I} days: the daily run (${row}) ends behind the one on-time answer (${onTime}), never ahead`);
    }
  }
  assert.deepEqual(off, [], "every daily run ends where one on-time answer does (LATE1's first form: 31 to 89 days did not)");
  // THE BAND v1.279.0 left standing: a 60-day card answered every day now moves half a day a day (90/60: the step adds 30
  // days over 60), never sooner, and takes the step to 90 on day 60
  let r = [60, 60, 0];
  for (let d = 1; d < 60; d++) {
    const n = K.ngKnowledgeScheduleRow(r, true, d);
    assert.ok(n[0] >= r[0], `day ${d}: never sooner`);
    assert.equal(K.ngKnowledgeInterval(n), 60 + d / 2, `day ${d}: half a day a day`);
    r = n;
  }
  assert.deepEqual(K.ngKnowledgeScheduleRow(r, true, 60), [150, 60, 60]);
  // every interval from 59 to 90 answered daily for 3 intervals and a month moves past where it started, and every second day too
  for (let I = 59; I <= 90; I++) {
    let row = [I, K.ngKnowledgeCell(I), 0];
    for (let d = 1; d <= 3 * I + 30; d++) row = K.ngKnowledgeScheduleRow(row, true, d);
    assert.ok(K.ngKnowledgeInterval(row) > I, `${I} days answered daily: ${row}`);
    let two = [I, K.ngKnowledgeCell(I), 0];
    for (let d = 2; d <= 2 * I; d += 2) two = K.ngKnowledgeScheduleRow(two, true, d);
    assert.ok(K.ngKnowledgeInterval(two) > I, `${I} days answered every second day: ${two}`);
  }
});

test("a right answer never goes back to 1 day", () => {
  for (const { prior, ok, row } of newRows()) if (ok) assert.ok(row[0] - row[2] >= Math.min(3, K.ngKnowledgeInterval(prior)), `${prior} → ${row}`);
  // off today's ladder (between rungs and past 120): a right answer climbs from where the card is
  assert.deepEqual(K.ngKnowledgeScheduleRow([20495, 60, 20400], true, 20495), [20495 + 191, 120, 20495, 180 + (5 * 185) / 90, 20495]);   // a real epoch day (LIN2-R1)
  assert.ok(K.ngKnowledgeScheduleRow([500, 120, 0], true, 500)[0] - 500 > 500);
});

test("an older client never sends a new row to 1 day, and its loss is a full rung capped at 120 days", () => {
  let checked = 0;
  for (const { row } of newRows()) {
    for (const day of [row[2], row[2] + 1, row[0], row[0] + 30]) {
      const back = oldRow(row, true, day), ivl = back[0] - back[2];
      assert.ok(ivl >= 3, `dev's writer on ${row}, day ${day}: ${back}`);
      // its loss, said plainly: the next rung of ITS ladder from the cell, whatever the day, never past 120
      assert.equal(ivl, SEVEN[Math.min(6, SEVEN.indexOf(row[1]) + 1)]);
      // and the new client reads the row it wrote at that rung: never below
      assert.equal(K.ngKnowledgeInterval(back), ivl);
      checked++;
    }
  }
  // a 365-day card answered right on an older client comes back in 120; the next new-client answer climbs from 120 again
  assert.deepEqual(oldRow([365, 120, 0], true, 365), [485, 120, 365]);
  assert.equal(K.ngKnowledgeScheduleRow([485, 120, 365], true, 485)[0] - 485, 242);
  assert.ok(checked > 500, `${checked} older-client answers`);
});

test("an older client's heal can only make a card due later", () => {
  // the winner is known by construction in each case: a later `last`; on one day the smaller cell; equal cells, the local row
  const today = 400, cases = [
    // [local, cloud, the winner, why]
    [[350, 30, 308], [395, 60, 300], "local", "later last: a 42-day row beats a 95-day row it heals from"],
    [[330, 3, 326], [460, 120, 300], "local", "later last: a fresh 4-day row and a 160-day row"],
    [[343, 30, 300], [395, 60, 300], "local", "one day, smaller cell"],
    [[395, 60, 300], [343, 30, 300], "cloud", "one day, smaller cell, the other order"],
    [[365, 60, 300], [395, 60, 300], "local", "one day, equal cells: dev keeps the local row"],
  ];
  for (const [local, cloud, win, why] of cases) {
    const got = oldMerge(local, cloud, today), w = win === "local" ? local : cloud;
    assert.ok(got[0] >= w[0], `${why}: ${got} is due no sooner than the winner ${w}`);
    assert.equal(got[2], w[2], why);
    assert.ok(SEVEN.includes(got[1]), `${why}: still a rung an older client reads`);
  }
  // and dev's moves merge the same way, on rows the new writer produced
  const m = oldMergeMoves({ s: { mv: [350, 30, 308, 1] } }, { s: { mv: [395, 60, 300, 1] } }, today);
  assert.ok(m.s.mv[0] >= 350);
});

test("two devices converge, both orders, a cloud that holds a row", () => {
  // rows two devices can hold for one card: a lower and a higher interval, the same day and another day; two rows of one day
  // that tie on the floored cell with different due dates (42 and 55 days, both cell 30); and a miss of today beside a miss
  // written by a device whose clock ran a day ahead, its `last` clamped by the pull ([402, 1, 400]: cell 1, two days)
  const today = 400;
  const rows = [[442, 30, 400], [455, 30, 400], [460, 60, 400], [401, 1, 400], [402, 1, 400], [395, 60, 300], [350, 30, 308], [300, 120, 180]];
  let checked = 0;
  for (const a of rows) for (const b of rows) {
    const ab = K.ngKnowledgeMergeRow(a.slice(), b.slice(), today), ba = K.ngKnowledgeMergeRow(b.slice(), a.slice(), today);
    assert.deepEqual(ab, ba, `device A holds ${a} and pulls ${b}; device B holds ${b} and pulls ${a}`);
    checked++;
  }
  // two right answers of one day: the longer true interval stands (the heal), whichever device holds which
  assert.deepEqual(K.ngKnowledgeMergeRow([455, 30, 400], [442, 30, 400], today), [455, 30, 400]);
  assert.deepEqual(K.ngKnowledgeMergeRow([442, 30, 400], [455, 30, 400], today), [455, 30, 400]);
  // one day, one cell, no heal (a miss wins at rung 0): the EARLIER due decides, so both devices keep the miss of today. Until
  // v1.279.0 the tie kept the local row, and the two devices each kept their own
  assert.deepEqual(K.ngKnowledgeMergeRow([402, 1, 400], [401, 1, 400], today), [401, 1, 400]);
  assert.deepEqual(K.ngKnowledgeMergeRow([401, 1, 400], [402, 1, 400], today), [401, 1, 400]);
  // a cloud row only: kept, its `last` clamped to today
  assert.deepEqual(K.ngKnowledgeMergeRow(undefined, [600, 60, 500], today), [600, 60, 400]);
  assert.equal(checked, 64);
});

test("the app's pull merges srs through the one rule, and the moves merge reads the true interval the same way", () => {
  // the app class, built the census way, merging a pulled blob that holds rows against its own
  const Component = new Function("DCLogic", "React", knowledgeSource + "\n" +
    readFileSync(new URL("../neural/src/progress-owner.src.js", import.meta.url), "utf8").replace(/^export (function|const|let|var|class) /gm, "$1 ") + "\n" +
    readFileSync(new URL("../neural/src/app.src.jsx", import.meta.url), "utf8") + "\nreturn Component;")(class {}, { createRef: () => ({ current: null }) });
  const src = readFileSync(new URL("../neural/src/app.src.jsx", import.meta.url), "utf8");
  assert.equal(src.split("l[qh] = ngKnowledgeMergeRow(l[qh], c, today);").length, 2, "one call site, in the pull's merge");
  assert.ok(typeof Component === "function");
  // the moves merge's own reading of a row's true interval equals ngKnowledgeInterval on every row the writer produces
  for (const { row } of newRows()) {
    const mv = row.slice(0, 3).concat(1, row.slice(3)), other = [row[2] - 5 + 1, 1, row[2] - 5, 0];   // the moves layout
    const merged = ngProgressMergeMoves({ s: { mv } }, { s: { mv: other } }, row[2]).s.mv;
    assert.deepEqual(merged, mv, `${row}: the later answer wins and is not healed by an older 1-day row`);
  }
});

test("a winning success keeps the longer TRUE interval it beat", () => {
  // srs: the winner (later last) is a 65-day row (cell 60); the row it beat was 90 days (cell 60): the cells tie, the true
  // intervals do not, and the heal gives the winner the 90 days
  assert.deepEqual(K.ngKnowledgeMergeRow([365, 60, 300], [380, 60, 290], 400), [390, 60, 300]);
  // moves: the same rows, the answer carried
  assert.deepEqual(ngProgressMergeMoves({ s: { mv: [365, 60, 300, 1] } }, { s: { mv: [380, 60, 290, 1] } }, 400).s.mv, [390, 60, 300, 1]);
  // a winner at rung 0 (a miss) keeps its 1 day
  assert.deepEqual(K.ngKnowledgeMergeRow([301, 1, 300], [380, 60, 290], 400), [301, 1, 300]);
});

test("nothing stored is rewritten: every row written before v1.279.0 reads as its own rung", () => {
  for (const r of SEVEN) for (const last of [0, 17, 400]) {
    const row = [last + r, r, last];
    assert.equal(K.ngKnowledgeInterval(row), r);
    // answered on time, it climbs his ladder from there; nothing is written until an answer
    const next = K.ngKnowledgeScheduleRow(row, true, last + r);
    assert.ok(next[0] - next[2] > r || r === K.NG_KNOWLEDGE_LADDER[K.NG_KNOWLEDGE_LADDER.length - 1]);
  }
  // the writer is the only author of a row: the evidence a grade starts from is not rewritten by building it
  const initial = K.ngKnowledgeBuildEvidence({ srs: { a: { h: [2, 14, 1] } } });
  assert.deepEqual(initial.srs.a.h, [2, 14, 1]);
});

// THE RATING READS THE TRUE INTERVAL (SRS-R1, the reader's finding 1, ruled into this PR): `ngRatingRecall` reads a row's
// interval as `due − last`, never below its cell. Read from the cell, a card answered right on every due day read 0.854 on its
// due day at 90 days, 0.726 at 365 and 0.077 at 2,922, and the number drifted down as cards matured.
function devRows() {
  // every row dev's writer produces, by short histories (right or wrong, on the same day, the next, early, on time, late), and
  // what dev's own pull leaves when the other device's clock ran ahead (its `last` clamped to today, its due kept)
  const out = new Map(), add = (r) => out.set(r.join(","), r);
  const walk = (row, depth) => {
    if (row) add(row);
    if (!depth) return;
    const last = row ? row[2] : 0, due = row ? row[0] : 0, ivl = row ? row[1] : 1;
    for (const d of new Set([last, last + 1, last + Math.floor(ivl / 2), due, due + ivl])) for (const ok of [true, false]) walk(oldRow(row, ok, d), depth - 1);
  };
  walk(null, 6);
  for (const r of [...out.values()]) for (const ahead of [1, 7, 60]) add(oldMerge(undefined, [r[0] + ahead, r[1], r[2] + ahead], r[2]));
  return [...out.values()];
}

test("the rating reads a row's true interval: at the update nothing reads lower, and dev's rows read the same", () => {
  // the reader's 406 readings: every rung dev writes, read on its answer day and every 7 days for 400 days, right: equal
  let same = 0;
  for (const c of SEVEN) for (let since = 0; since <= 400; since += 7) {
    const row = [1000 + c, c, 1000];
    if (R.ngRatingRecall(row, true, 1000 + since) === oldRecall(row, true, 1000 + since)) same++;
  }
  assert.equal(same, 406);
  // every row dev's writer (and dev's pull) can produce, read on every 3rd day for 400 days, right and wrong: the same, or
  // higher where the pull lengthened the row (due − last above the cell); never lower
  let equal = 0, higher = 0;
  const rows = devRows();
  for (const row of rows) for (let day = row[2]; day <= row[2] + 400; day += 3) for (const right of [true, false]) {
    const now = R.ngRatingRecall(row, right, day), was = oldRecall(row, right, day);
    assert.ok(now >= was, `${row} on day ${day}: ${now} below dev's ${was}`);
    if (now === was) equal++;
    else { higher++; assert.ok(row[0] - row[2] > row[1], `${row}: higher only where due − last is above the cell`); }
  }
  assert.ok(rows.length > 40 && equal > 20000 && higher > 1000, `${rows.length} rows, ${equal} equal, ${higher} higher`);
});

test("the rating reads a card at 0.9 on its due day, at 90, 365 and 2,922 days", () => {
  // a card answered right on every due day, from its first answer: on each due day it reads 0.9, whatever its cell.
  // v1.305.0 (LATE2): the on-time chain climbs his rungs again (on its due day the late rule is exactly one step), so it
  // passes 90, 365 and 2,922 days and no row of it is stretched: none carries a late mark (LATE1's first form sent it 60 → 120
  // → 241.67 …, and this test then read those rows from elsewhere). A row the late rule stretched is read at its late mark,
  // the one-step interval (`ngRatingReadInterval`): it reads 0.9 at the end of THAT interval, never at the longer one it is
  // due at (a 30-day card answered 15 days late is due in 90 days and reads 0.9 at 60, as one step would say)
  let row = K.ngKnowledgeScheduleRow(null, true, 0);
  const onDue = new Map();
  for (let i = 0; i < 12; i++) { row = K.ngKnowledgeScheduleRow(row, true, row[0]); onDue.set(row[0] - row[2], [row, R.ngRatingRecall(row, true, row[0])]); }
  for (const [I, [r, k]] of onDue) {
    assert.ok(Math.abs(k - 0.9) < 1e-12, `the chain, ${I} days (${r}): ${k}`);
    assert.equal(K.ngKnowledgeMark(r), null, `the chain, ${I} days (${r}): not stretched`);
  }
  for (const I of [90, 365, 2922]) {
    const [r, k] = onDue.get(I);
    assert.ok(Math.abs(k - 0.9) < 1e-12, `${I} days (${r}, cell ${r[1]}): ${k}`);
    assert.ok(r[1] < I, `${I} days: its cell (${r[1]}) is shorter than its schedule, so a cell read would say less`);
  }
  const stretched = K.ngKnowledgeScheduleRow([20430, 30, 20400], true, 20445);
  assert.deepEqual(stretched, [20535, 60, 20445, 0, 0, 60, 90], "a 30-day card 15 days late: due in 90 days, its late mark 60");
  assert.ok(Math.abs(R.ngRatingRecall(stretched, true, 20445 + 60) - 0.9) < 1e-12, "and it reads 0.9 at 60 days");
  assert.ok(R.ngRatingRecall(stretched, true, 20535) < 0.9, "on its later due day it reads below 0.9");
});

test("the Practice order's worth moves with the rating's read", () => {
  // two cards owed today, one weight: a 365-day card on its due day (cell 120) and a 30-day card 70 days past its last. Read
  // from the true interval the first recalls 0.9 and the second 0.78, so the second is worth more; read from the cell the
  // first would read 0.73 and come first
  const D = 2000, mature = [D, 120, D - 365], plain = [D - 40, 30, D - 70];
  const items = [{ id: "mature", kind: "card", seat: "s", w: 1, row: mature, stage: 3 }, { id: "plain", kind: "card", seat: "s", w: 1, row: plain, stage: 3 }];
  const law = ngPracticeVisits({ items, day: D, goal: 1, guard: 0 });
  assert.deepEqual(law.asked, ["plain"], "the one place goes to the card closest to forgetting");
  assert.ok(Math.abs(R.ngRatingRecall(mature, true, D) - 0.9) < 1e-12 && R.ngRatingRecall(plain, true, D) < 0.8);
  // and the law's worth is 1 − that read, in its own order, on every row dev writes
  for (const row of devRows().filter((r) => r[1] > 1).slice(0, 60)) {
    const day = row[0] + 3, other = [day - 1 - 7, 7, day - 1 - 14];   // a 7-day row 15 days on: 0.9^(15/7)
    const pick = ngPracticeVisits({ items: [{ id: "a", kind: "card", seat: "s", w: 1, row, stage: 3 }, { id: "b", kind: "card", seat: "s", w: 1, row: other, stage: 3 }], day, goal: 1, guard: 0 }).asked[0];
    const ka = R.ngRatingRecall(row, true, day), kb = R.ngRatingRecall(other, true, day);
    if (ka !== kb) assert.equal(pick, ka < kb ? "a" : "b", `${row} on day ${day}`);
  }
});

test("a shared question whose decks drifted is asked when it is owed, and read the same in either order", () => {
  // the reader's case (finding 2): one question in decks A and B whose rows had drifted (A at 30 days, B at 14, both answered on
  // day 1000), answered right on B's due day through the one writer, which files both: the same `last`, the same floored cell,
  // due days 11 apart. And one mature pair: both cells floored to 120, due 241 and 486 days on
  const qh = "0a1b2c3d";
  const cases = [
    ["drifted", K.ngKnowledgeScheduleRow([1030, 30, 1000], true, 1014), K.ngKnowledgeScheduleRow([1014, 14, 1000], true, 1014)],
    ["mature", [1000 + 486, 120, 1000], [1000 + 241, 120, 1000]],
  ];
  assert.deepEqual(cases[0].slice(1), [[1058, 30, 1014, 30, 1000], [1044, 30, 1014]]);
  const decks = { A: { exact: true, questions: [qh], count: 1 }, B: { exact: true, questions: [qh], count: 1 } };
  const game = { status: "ok", deckUnit: new Map([["A", 1], ["B", 1]]), shared: new Map([[qh, ["A", "B"]]]) };
  const U = R.ngRatingUniverse({ decks: { A: { n: 1 }, B: { n: 1 } }, weights: { A: 0.5, B: 0.5 }, shared: new Map([[qh, ["A", "B"]]]),
    seats: { "1/top": { w: 0.1, hand: { 10: 100 } } } });
  for (const [name, A, B] of cases) {
    const day = B[0];   // the day the earlier row comes due
    const shares = [];
    for (const order of [["A", "B"], ["B", "A"]]) {
      const srs = {};
      for (const k of order) srs[k] = { [qh]: k === "A" ? A : B };
      const debt = ngGameplanDebt({ srs, day, decks });
      assert.equal(debt.count, 1, `${name}, stored ${order}: the due count owes it`);
      const built = ngPracticeItems({ day, srs, stage: { A: { [qh]: 3 } }, decks, game, seats: { A: "1/top", B: "1/top" } });
      const it = built.items.find((x) => x.id === qh);
      assert.deepEqual(it.row, B, `${name}, stored ${order}: Practice reads the row the due count owes`);
      const law = ngPracticeVisits({ items: built.items, day, goal: 20 });
      assert.deepEqual([law.counts.owed, law.asked], [1, [qh]], `${name}, stored ${order}: and asks it`);
      const share = R.ngRatingShare(U, { srs, stage: { A: { [qh]: 3 } } }, day);
      assert.equal(share.status, "ok");
      shares.push(share.share);
    }
    assert.equal(shares[0], shares[1], `${name}: the rating reads one row whichever deck is stored first`);
    assert.ok(Math.abs(shares[0] - R.ngRatingRecall(B, true, day) / 1.1) < 1e-12, `${name}: and it is the earlier-due row`);
  }
});
