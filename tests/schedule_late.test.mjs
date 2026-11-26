// THE LATE ANSWER (v1.305.0, LATE1) — neural/src/knowledge-profile.src.js (`ngKnowledgeLate`, called by `ngKnowledgeNext`).
//
// THE OWNER'S RULE (25 Nov 2026): "when answering late, [the] elapsed time in days is doubled, that is the time in days for
// the next repetition space"; "i agree with the edges. also remember the rule where if it's answered earlier, there's already
// a formula for that right which discounts it". Ruled 26 Nov on the measured card (U223 b): "Your rule, no cap". So a RIGHT
// answer ON OR AFTER the due day earns max(one step from the interval it reads, 2 × the days since the last answer); no
// ceiling of ours (the ladder's own top bounds only the step); early answers (the formula that discounts them) and wrong
// answers exactly as before; the row keeps its shape [due, cell, last] (+ the pair while the interval is not whole).
//
// THE ONE-STEP CLIENT (v1.281.3 to v1.304.0, where a late answer earned exactly one step) is captured from git in
// tests/artifacts/schedule_onestep_client.json (tests/artifacts/_capture_onestep_schedule.mjs, never re-typed), and runs
// here through tests/_onestep_client.mjs: every early answer and every wrong answer is compared with it byte for byte, and
// it is also one of the older builds that read the rows this rule writes, beside v1.281.0, v1.280.2 and v1.278.2.
//
// THE CLAIMS: on its due day, one step, except where a step is under double (30 < interval < 90; the 60-day card goes to
// 120, ruled); a day later never earns less, on every rung, between rungs and on the moves rows; very late, twice the days
// since the last answer however many (no cap); early and wrong as before, byte for byte (the schedule on every row; the whole
// row on every row without v1.305.0's late mark, which a stretched row carries after the pair's slot for the rating:
// tests/schedule_late_mark.test.mjs); every older build reads a row this rule writes and climbs from it, and every captured
// validator takes it.
// The sync of such a row (a fake cloud that holds rows, an older client's merge): tests/answers_before_sync.test.mjs, "a late
// answer's doubled wait meets an older client's row…".
//
// MUTANTS (v1.305.0), each applied alone to the writer and run against this file and the schedule unit files; each turned
// the NAMED test red (the run is in docs/Changelog-Archive.md, v1.305.0):
//   T1  the max dropped (2 × the days only)          → "on its due day: one step…"
//   T2  the factor 2 → 1                             → "the 60-day card answered on its due day goes to 120…"
//   T3  `>=` → `>` at the due (the due day early)    → "the 60-day card answered on its due day goes to 120…"
//   T4  a cap sneaked in (the 2,922-day rung)        → "very late: twice the days since the last answer…"
//   T5  the early formula touched                    → "an early right answer: byte for byte the one-step client's…"
//
// Run: node --test tests/schedule_late.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as K from "../neural/src/knowledge-profile.src.js";
import { ngProgressValidateBlob } from "../neural/src/progress-owner.src.js";
import { onestep, schedulePart } from "./_onestep_client.mjs";

const W = K.ngKnowledgeScheduleRow, L = K.NG_KNOWLEDGE_LADDER, cell = K.ngKnowledgeCell, iv = K.ngKnowledgeInterval;
const json = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const LIN1 = json("./artifacts/schedule_lin1_client.json"), PREV = json("./artifacts/schedule_prev_client.json"), OLD = json("./artifacts/schedule_old_client.json");
const lin1 = new Function(LIN1.knowledge.ladder + "\n" + LIN1.knowledge.schedule + "\nreturn ngKnowledgeScheduleRow;")();
const prev = new Function(PREV.knowledge.ladder + "\n" + PREV.knowledge.schedule + "\nreturn ngKnowledgeScheduleRow;")();
const oldWrite = new Function(OLD.knowledge.intervals + "\n" + OLD.knowledge.scheduleRow + "\nreturn ngKnowledgeScheduleRow;")();
const VALIDATORS = json("./artifacts/progress_validators.json").clients;
const validators = { now: ngProgressValidateBlob, ...Object.fromEntries(Object.entries(VALIDATORS).map(([k, v]) => [k, new Function(v.validator + "\nreturn ngProgressValidateBlob;")()])) };
const D = 20400;   // a real epoch day (16 Nov 2025)
const onRung = (r) => [D + r, cell(r), D];

// rows of every shape the writer reads: on each rung, between rungs, rows early answers left (rung pairs), rows this rule left
// (doubled), rows v1.281.0 left (anchors off the rungs), a hand-built row whose cell is above due − last; srs and moves
function shapes() {
  const out = [];
  for (const r of L.slice(0, 14)) out.push(onRung(r));
  for (const x of [2, 5, 10, 20, 42, 45, 59, 75, 89, 100, 120, 150, 241, 300, 500, 1000, 2000, 5000]) out.push([D + x, cell(x), D]);
  for (const r of [7, 30, 60, 90, 180, 365]) for (const f of [0.2, 0.5, 0.9]) out.push(W(onRung(r), true, D + Math.max(1, Math.floor(r * f))));
  for (const r of [3, 14, 30, 60, 180]) for (const late of [1, 10, 100]) out.push(W(onRung(r), true, D + r + late));
  for (const r of [14, 42, 75, 120]) out.push(lin1(lin1(onRung(r), true, D + Math.floor(r / 3)), true, D + r + 5));
  out.push([D + 2, 14, D]);
  return out;
}
const moves = (row) => row.slice(0, 3).concat(1, row.slice(3));   // a moves row: the answer at [3], the pair after it

test("on its due day: one step, except where a step is under double (30 < interval < 90)", () => {
  // on each of the first 14 rungs, answered on its due day: the next rung, as the one-step client gives it, except 60 → 120
  const got = L.slice(0, 14).map((r) => iv(W(onRung(r), true, D + r)));
  assert.deepEqual(got, [3, 7, 14, 30, 60, 120, 180, 365, 730, 1461, 2922, 5844, 11688, 23376]);
  assert.deepEqual(L.slice(0, 14).map((r) => iv(onestep.write(onRung(r), true, D + r))), [3, 7, 14, 30, 60, 90, 180, 365, 730, 1461, 2922, 5844, 11688, 23376]);
  // the 1-day card: one step, 3 days (twice its 1 day would be 2: the step is the floor)
  assert.deepEqual(W([D + 1, 1, D], true, D + 1), [D + 4, 3, D + 1]);
  assert.deepEqual(W([D + 3, 3, D], true, D + 3), [D + 10, 7, D + 3], "3 → 7 (twice would be 6)");
  // on time, every interval from 1 to 400 days: one step, except 31 to 89 (twice the interval, a step being under double)
  const doubled = [];
  for (let I = 1; I <= 400; I++) {
    const now = iv(W([D + I, cell(I), D], true, D + I)), one = onestep.next([D + I, cell(I), D], D + I);
    assert.equal(now, Math.max(one, 2 * I), `${I} days on its due day`);
    if (now !== one) doubled.push(I);
  }
  assert.deepEqual(doubled, Array.from({ length: 59 }, (_, k) => 31 + k), "the doubled wait decides on the due day only from 31 to 89 days");
});

test("the 60-day card answered on its due day goes to 120 (skipping 90), and a day later to 122", () => {
  // (a row the doubled wait stretched carries its late mark after the pair's slot, v1.305.0: [0, 0, the one-step interval,
  // its own]; tests/schedule_late_mark.test.mjs)
  assert.deepEqual(W([D + 60, 60, D], true, D + 60), [D + 180, 120, D + 60, 0, 0, 90, 120], "on its due: 120 days");
  assert.deepEqual(onestep.write([D + 60, 60, D], true, D + 60), [D + 150, 60, D + 60], "the one-step client: 90");
  assert.deepEqual(W([D + 60, 60, D], true, D + 61), [D + 61 + 122, 120, D + 61, 0, 0, 90, 122], "a day late: twice 61");
  // and the study's rung table (LATE1, Part A): on the due, a day late, the interval late (twice the interval since)
  const table = [[1, 3, 4, 4], [3, 7, 8, 12], [7, 14, 16, 28], [14, 30, 30, 56], [30, 60, 62, 120], [60, 120, 122, 240], [90, 180, 182, 360],
    [180, 365, 365, 720], [365, 730, 732, 1460]];
  for (const [r, due, plus1, twice] of table) {
    assert.deepEqual([iv(W(onRung(r), true, D + r)), iv(W(onRung(r), true, D + r + 1)), iv(W(onRung(r), true, D + 2 * r))], [due, plus1, twice], `the ${r}-day rung`);
  }
  // a 75-day card on its due (the study's): 150 (one step gave 135)
  assert.equal(iv(W([D + 75, 60, D], true, D + 75)), 150);
});

test("very late: twice the days since the last answer, however many (no cap of ours)", () => {
  // two years late on a 3-day card: twice the 733 days since its last answer, four years and more
  assert.deepEqual(W([D + 3, 3, D], true, D + 733), [D + 733 + 1466, 120, D + 733, 0, 0, 7, 1466]);
  assert.ok(1466 > 4 * 365);
  // a 2,922-day card two years late: 7,304 days (one step gave 5,844); the 75-day carried card answered 75 days after: 150
  assert.equal(iv(W(onRung(2922), true, D + 2922 + 730)), 7304);
  assert.equal(iv(W([D + 3, 3, D], true, D + 75)), 150);
  // a hundred years, and past the ladder's own top (11,968,512 days): still twice, never a ceiling
  for (const since of [730, 2923, 5845, 36525, 365250, L[L.length - 1] + 1, 2 * L[L.length - 1]]) {
    const r = W([D + 7, 7, D], true, D + since);
    assert.equal(iv(r), 2 * since, `${since} days after its last answer`);
    assert.equal(r[0], D + 3 * since);
  }
  assert.equal(K.ngKnowledgeLate(14, 400), 800);
  assert.equal(K.ngKnowledgeLate(90, 30), 90);
  // the moves rows read the same rule (`at` 4): the answer at [3] kept
  assert.deepEqual(W([D + 7, 7, D, 1], true, D + 400, 4), [D + 1200, 120, D + 400, 1, 0, 0, 14, 800]);
});

// (v1.305.0's late mark, the rows the doubled wait stretched: the one-step client copies a prior's cells after the pair forward
// and writes no mark of its own, so on a marked row the two rows differ after the pair's slot and only there; the schedule,
// the head and the pair, is compared on every row, and the whole row on every row without a mark)
test("an early right answer: byte for byte the one-step client's, on every row shape, srs and moves", () => {
  let n = 0, whole = 0;
  for (const row of shapes()) {
    const last = row[2], due = row[0], marked = K.ngKnowledgeMark(row) !== null;
    for (let d = last - 3; d < due; d += Math.max(1, Math.floor((due - last) / 40))) {
      const a = W(row, true, d), b = onestep.write(row, true, d), am = W(moves(row), true, d, 4), bm = onestep.write(moves(row), true, d, 4);
      assert.deepEqual(schedulePart(a), schedulePart(b), `${row} on day ${d}`);
      assert.deepEqual(schedulePart(am, 4), schedulePart(bm, 4), `moves ${row} on day ${d}`);
      if (!marked) { assert.deepEqual(a, b, `${row} on day ${d}, whole`); assert.deepEqual(am, bm, `moves ${row} on day ${d}, whole`); whole += 2; }
      n += 2;
    }
  }
  assert.ok(n > 3000 && whole > 2000, `${n} early answers compared, ${whole} whole`);
});

test("a wrong answer: byte for byte the one-step client's, early, on the due day and late", () => {
  let n = 0;
  // (a miss writes no late mark: on a marked row the one-step client copies the old mark forward, where its check then fails)
  for (const row of shapes()) for (const d of [row[2] - 2, row[2], row[2] + 1, row[0] - 1, row[0], row[0] + 1, row[0] + 400]) {
    const marked = K.ngKnowledgeMark(row) !== null, a = W(row, false, d), am = W(moves(row), false, d, 4);
    const b = onestep.write(row, false, d), bm = onestep.write(moves(row), false, d, 4);
    assert.deepEqual(marked ? a : schedulePart(a), marked ? b.slice(0, 3) : schedulePart(b), `${row} missed on day ${d}`);
    assert.deepEqual(marked ? am : schedulePart(am, 4), marked ? bm.slice(0, 4) : schedulePart(bm, 4), `moves ${row} missed on day ${d}`);
    if (!marked) { assert.deepEqual(a, b); assert.deepEqual(am, bm); }
    if (marked) assert.equal(K.ngKnowledgeMark(b), null, `${row}: the old mark the one-step client copied fails its check`);
    n += 2;
  }
  // a first answer, right or wrong, as before
  for (const ok of [true, false]) assert.deepEqual(W(null, ok, D), onestep.write(null, ok, D));
  assert.ok(n > 500, `${n} misses compared`);
});

test("no cliff: a day later never earns less, on every rung, between rungs and on the moves rows, the due day included", () => {
  let n = 0;
  for (const row of shapes()) {
    const I = row[0] - row[2], stepBy = Math.max(1, Math.floor(I / 150));
    let prevDue = -Infinity, prevIvl = -Infinity;
    for (let d = row[0] - 1; d <= row[0] + 3 * I + 3; d += stepBy) {
      const w = W(row, true, d), m = W(moves(row), true, d, 4);
      assert.ok(w[0] >= prevDue, `${row}: day ${d} comes due ${w[0]}, before the day before's ${prevDue}`);
      if (d >= row[0]) assert.ok(iv(w) >= prevIvl, `${row}: day ${d} earns ${iv(w)}, less than the day before's ${prevIvl}`);
      assert.deepEqual(m.slice(0, 3), w.slice(0, 3), `${row}: the moves row reads the same on day ${d}`);
      if (d >= row[0]) prevIvl = iv(w);
      prevDue = w[0];
      n++;
    }
    // the day after the due never earns less than the due day
    assert.ok(iv(W(row, true, row[0] + 1)) >= iv(W(row, true, row[0])), `${row}: the day after its due`);
  }
  assert.ok(n > 15000, `${n} days swept`);
});

test("an older build reads a row this rule wrote and climbs from it; every captured validator takes it", () => {
  const written = [];
  for (const r of L.slice(0, 12)) for (const late of [0, 1, r, 75, 730]) written.push(W(onRung(r), true, D + r + late));
  for (const x of [42, 75, 241]) for (const late of [0, 30]) written.push(W([D + x, cell(x), D], true, D + x + late));
  let n = 0;
  for (const row of written) {
    const I = iv(row);
    assert.equal(row.length === 3 || row.length === 5 || row.length === 7, true, `${row}: the row keeps its shape (+ the pair, + the late mark)`);
    assert.ok([1, 3, 7, 14, 30, 60, 120].includes(row[1]), `${row}: its cell is a rung every client finds`);
    for (const [name, write] of [["v1.304.0", onestep.write], ["v1.281.0", lin1], ["v1.280.2", prev]]) {
      for (const d of [row[0], row[0] + 10]) {
        const next = write(row, true, d);
        // these builds read due − last (or the pair) and step from it: never sooner, never back to 1 day
        assert.ok(next[0] >= row[0] && next[0] - next[2] >= Math.min(I, 3), `${name} on ${row} (day ${d}): ${next}`);
        n++;
      }
    }
    // v1.278.2 climbs its own seven rungs from the cell (capped at 120): never back to 1 day
    const old = oldWrite(row, true, row[0]);
    assert.ok(old[1] >= Math.min(120, row[1]) && old[1] > 1, `v1.278.2 on ${row}: ${old}`);
    for (const [name, v] of Object.entries(validators)) assert.doesNotThrow(() => v({ v: 2, srs: { d: { q: row } }, moves: { s: { m: moves(row) } } }), `${name} validator on ${row}`);
    n++;
  }
  assert.ok(written.length > 60 && n > 400, `${written.length} rows, ${n} reads`);
});
