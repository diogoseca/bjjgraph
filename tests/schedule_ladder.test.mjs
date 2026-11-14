// THE SCHEDULE (v1.277.0, ruled SRS-GO) — neural/src/knowledge-profile.src.js (`ngKnowledgeScheduleRow`, `ngKnowledgeMergeRow`,
// `ngKnowledgeInterval`, `ngKnowledgeCell`), the app's srs pull merge that calls it (`_mergeProgressFields`) and the moves merge
// (`ngProgressMergeMoves`, neural/src/progress-owner.src.js).
//
// The owner's ladder: 1, 3, 7, 14, 30, 60, 90, 180, 365, 730, 1461, 2922 days, then doubling. A miss: back to 1 day. An early
// right answer: the research's (b), proportional (the card moves the fraction of a rung that the fraction of its interval passed
// earns). A late right answer: one rung, NO bonus (measured, ANKI1). Storage: no new field, no stored row rewritten; the place
// between rungs read from the true interval (due − last, never below the cell); the cell written as the largest rung of the
// seven-rung ladder at or below it, so an older client always finds a rung.
//
// THE OLDER CLIENT is dev v1.273.1's own code, cut from git's copy of each file by tests/artifacts/_capture_old_schedule.mjs into
// tests/artifacts/schedule_old_client.json (never re-typed): its `ngKnowledgeScheduleRow`, its inline srs pull merge and its
// `ngProgressMergeMoves`. THE LOSS ON AN OLDER CLIENT, said plainly: its right answer gives the card a full rung of ITS ladder
// from the cell, capped at 120 days, whatever the day (a 365-day card comes back in 120), until a new client answers it again;
// it never sends a card back to 1 day, its due counts read `due` (exact), and its heal can only make a card due later.
//
// MUTANTS (v1.277.0), each applied alone to a clean tree and run against this file (the run log is in
// docs/Changelog-Archive.md, v1.277.0); each turned the NAMED test red:
//   L1  an early right answer earns a full rung (today's rule)              → "his example: day 31.7, day 87.6 and day 90"
//   L2  a late right answer earns more than a rung (the credit uncapped)    → "a late right answer earns one rung, no bonus"
//   L3  the ladder capped at 120 days (today's seven rungs)                 → "the 120-day card's next step is 241 days on time"
//   L4  the cell written unfloored (the true interval)                      → "the cell is always a rung of the seven" and
//                                                                              "an older client never sends a new row to 1 day"
//   L5  the place read from the stored cell, not the true interval          → "a right answer never makes a card due sooner"
//   L6  a right answer off the ladder resets to 1 day (`indexOf` on a rung) → "a right answer never goes back to 1 day"
//   L7  the pull merge without the due tie-break                            → "two devices converge, both orders, a cloud that holds a row"
//   L8  the srs heal read from the cells                                    → "a winning success keeps the longer TRUE interval it beat"
//   L9  the moves heal read from the cells                                  → "a winning success keeps the longer TRUE interval it beat"
//
// Run: node --test tests/schedule_ladder.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as K from "../neural/src/knowledge-profile.src.js";
import { ngProgressMergeMoves } from "../neural/src/progress-owner.src.js";
import { knowledgeSource } from "./_knowledge_profile_harness.mjs";

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

test("his example: day 31.7, day 87.6 and day 90", () => {
  // a card at 30 days, last answered on day 0 (due day 30); "new due" counts from day 0, the old count
  const card = [30, 30, 0];
  const at = (day) => +(day + K.ngKnowledgeNextInterval(card, day)).toFixed(1);
  assert.equal(at(1), 31.7, "answered right the next day: it hardly moves");
  assert.equal(at(29), 87.6, "answered right on day 29: nearly the whole step");
  assert.equal(at(30), 90, "on time: one rung, 30 to 60 days");
  // the stored rows: the due day rounded, the cell a rung of the seven at or below the true interval
  assert.deepEqual(K.ngKnowledgeScheduleRow(card, true, 1), [32, 30, 1]);
  assert.deepEqual(K.ngKnowledgeScheduleRow(card, true, 29), [88, 30, 29]);
  assert.deepEqual(K.ngKnowledgeScheduleRow(card, true, 30), [90, 60, 30]);
  // it cannot be farmed: a right answer every day for 30 days, then left alone, earns no more than one on-time answer
  // (day 90 here: unrounded the thirty earn 0.76 of a rung, and the stored due day is rounded at each answer)
  let row = card;
  for (let d = 1; d <= 30; d++) row = K.ngKnowledgeScheduleRow(row, true, d);
  assert.ok(row[0] <= 90 && row[0] > 60, `thirty daily answers: due day ${row[0]}, against 90 for one on-time answer`);
  // a second answer the same day earns nothing
  assert.deepEqual(K.ngKnowledgeScheduleRow([31, 30, 1], true, 1), [31, 30, 1]);
});

test("a late right answer earns one rung, no bonus", () => {
  // a 30-day card answered right on day 60 (30 days late) gets 60 days from day 60, as an on-time answer would
  assert.equal(K.ngKnowledgeNextInterval([30, 30, 0], 60), 60);
  assert.deepEqual(K.ngKnowledgeScheduleRow([30, 30, 0], true, 60), [120, 60, 60]);
  // a year late on a 7-day card: still one rung, 14 days
  assert.deepEqual(K.ngKnowledgeScheduleRow([7, 7, 0], true, 400), [414, 14, 400]);
});

test("the ladder: his rungs, a miss back to 1 day, and the 120-day card's next step is 241 days on time", () => {
  assert.deepEqual(K.NG_KNOWLEDGE_LADDER.slice(0, 14), [1, 3, 7, 14, 30, 60, 90, 180, 365, 730, 1461, 2922, 5844, 11688]);
  // on time, rung after rung, from a first right answer
  let row = K.ngKnowledgeScheduleRow(null, true, 0), steps = [row[0] - row[2]];
  for (let i = 0; i < 12; i++) { row = K.ngKnowledgeScheduleRow(row, true, row[0]); steps.push(row[0] - row[2]); }
  assert.deepEqual(steps, [1, 3, 7, 14, 30, 60, 90, 180, 365, 730, 1461, 2922, 5844]);
  // a miss, early or late, at any rung: 1 day
  for (const r of [[3, 3, 0], [120, 120, 0], [361, 120, 120]]) for (const d of [r[2], r[0], r[0] + 50]) assert.deepEqual(K.ngKnowledgeScheduleRow(r, false, d), [d + 1, 1, d]);
  // a card at today's top rung (120 days, place 6.4 on his ladder, between 90 and 180): 241 days on time, then 486
  const top = [120, 120, 0];
  assert.deepEqual(K.ngKnowledgeScheduleRow(top, true, 120), [361, 120, 120]);
  assert.deepEqual(K.ngKnowledgeScheduleRow([361, 120, 120], true, 361), [361 + 486, 120, 361]);
  // and early, the next day: it hardly moves (from day 120 to day 122)
  assert.equal(K.ngKnowledgeScheduleRow(top, true, 1)[0], 122);
});

test("the cell is always a rung of the seven, the largest at or below the true interval", () => {
  let checked = 0;
  for (const { row } of newRows()) {
    assert.ok(SEVEN.includes(row[1]), `${row}: cell ${row[1]} is a rung of the seven`);
    const t = row[0] - row[2];
    assert.equal(row[1], Math.max(...SEVEN.filter((r) => r <= t)), `${row}: the largest at or below ${t}`);
    assert.equal(K.ngKnowledgeInterval(row), t, `${row}: the true interval is due − last`);
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
  // between rungs: a 42-day card (cell 30) answered the next day comes due on day 44 (42.7 days from day 1), never by its cell
  assert.deepEqual(K.ngKnowledgeScheduleRow([42, 30, 0], true, 1), [44, 30, 1]);
  assert.ok(checked > 70, `${checked} right answers`);
});

test("a right answer never goes back to 1 day", () => {
  for (const { prior, ok, row } of newRows()) if (ok) assert.ok(row[0] - row[2] >= Math.min(3, K.ngKnowledgeInterval(prior)), `${prior} → ${row}`);
  // off today's ladder (between rungs and past 120): a right answer climbs from where the card is
  assert.deepEqual(K.ngKnowledgeScheduleRow([95, 60, 0], true, 95), [95 + 190, 120, 95]);
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
  assert.equal(K.ngKnowledgeScheduleRow([485, 120, 365], true, 485)[0] - 485, 241);
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
  // v1.277.0 the tie kept the local row, and the two devices each kept their own
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
    const local = { s: { mv: [...row, 1] } }, other = [row[2] - 5 + 1, 1, row[2] - 5, 0];
    const merged = ngProgressMergeMoves(local, { s: { mv: other } }, row[2]).s.mv;
    assert.deepEqual(merged.slice(0, 3), row, `${row}: the later answer wins and is not healed by an older 1-day row`);
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

test("nothing stored is rewritten: every row written before v1.277.0 reads as its own rung", () => {
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
