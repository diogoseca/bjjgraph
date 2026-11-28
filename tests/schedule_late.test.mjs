// THE LATE ANSWER AND THE LADDER'S TOP (v1.305.0, LATE1 and LATE2) — neural/src/knowledge-profile.src.js (`ngKnowledgeLate`,
// called by `ngKnowledgeNext`; `NG_KNOWLEDGE_LADDER`, `NG_KNOWLEDGE_TOP_FROM`, `NG_KNOWLEDGE_TOP_POWER`).
//
// THE OWNER'S RULE, IN ITS FINAL FORM (28 Nov 2026, card U226 a: "The fitted curve: power 1/6"; LATE1's first form, ruled 25
// and 26 Nov, U223 b, was max(one step, 2 × the days since the last answer)). One function for the whole schedule, with I the
// card's interval now, t the days since its last answer, step(I) his ladder, and past 4 years the curve
// C(x) = x × (1 + (1461 ÷ x)^(1/6)):
//   · EARLY (t < I): I + (t ÷ I) × (step(I) − I), the line shipped since v1.281.0, untouched;
//   · ON TIME OR LATE (t ≥ I): max(step(I), t × min(step(I) ÷ I, C(t) ÷ t)), C(t) ÷ t being 2 up to 4 years: on the due day
//     exactly one step (his named rungs; the 60-day card goes to 90, not LATE1's 120), and after it twice the wait wherever
//     his step at least doubles, the step's own multiple of it where it does not (1.5 × on the 60-day rung);
//   · THE TOP: past 4 years the multiple falls as (4 years ÷ x)^(1/6), for the ladder's rungs (each rung past 2,922 days is
//     C(the one before), rounded to a whole day: on time 4 years → 8 → 15.1 → 27.2 → 47) and for a late answer alike (it earns
//     the ladder's own step for the days waited: a 4-year or a 1-year card answered 8 years after its last answer, 5,525 days).
// As measured in the study (SAT1, §7), with one rewriting that changes no number by more than float dust: t × min(a, b) is
// computed as min(t × a, t × b), so that on the due day the answer is EXACTLY one step (the study's own form lands 10^-12 of a
// day above it on 23,070 of 700,000 whole-day intervals past 4 years). Wrong answers exactly as before; the row keeps its
// shape [due, cell, last] (+ the pair while the interval is not whole, + the late mark: tests/schedule_late_mark.test.mjs).
//
// THE CLIENTS COMPARED (tests/_onestep_client.mjs): THE ONE-STEP CLIENT (v1.281.3 to v1.304.0, a late answer earned exactly
// one step, the ladder doubled past 2,922 days) is captured from git in tests/artifacts/schedule_onestep_client.json
// (tests/artifacts/_capture_onestep_schedule.mjs, never re-typed); `onestepNow` is the same captured code on his final ladder.
// Every early answer below 4 years and every wrong answer is compared with v1.304.0 byte for byte, and every early answer
// with `onestepNow`; v1.304.0 is also one of the older builds that read the rows this rule writes, beside v1.281.0, v1.280.2
// and v1.278.2.
//
// THE CLAIMS: the study's four conditions on the writer (a late answer never earns less than an on-time one; the next
// interval never falls as the wait grows; no jump at the due, the largest one-day rise at the due being the early line's
// own slope; an on-time card lands on his named rungs); on its due day exactly one step, every whole interval to the ladder's
// top, and a card between whole days paid its part day; the top's values; late past 4 years; very late, the ladder's own
// step for the days waited (its top, 655,856 days, about 1,796 years, the only bound; no cap of ours); between rungs within
// 0.41% under the exact curve from 4 to 60 years; early and wrong as before; every older build reads a row this rule writes
// and climbs from it, and every captured validator takes it.
// The sync of such a row (a fake cloud that holds rows, an older client's merge): tests/answers_before_sync.test.mjs, "a late
// answer meets an older client's row…".
//
// MUTANTS (v1.305.0, LATE2), each applied alone (to the writer, or to the one copy named) and run against this file and the
// schedule unit files; each turned the NAMED test red against a green control (the run is in docs/Changelog-Archive.md,
// v1.305.0, LATE2):
//   M1  `min(t × s ÷ I, …)` dropped (LATE1's 60 → 120 back)   → "on its due day: exactly one step…"
//   M2  the power 1/6 → 1/2                                    → "the top: past 4 years…"
//   M3  the power 1/6 → 0 (doubling back)                      → "the top: past 4 years…"
//   M4  the 4-year start moved (1,461 → 2,922)                 → "the top: past 4 years…"
//   M5  `>=` → `>` at the due (the due day early)              → "on its due day: exactly one step…" (the part day)
//   M6  the max dropped                                         → "on its due day: exactly one step…"
//   M7  the early line touched                                  → "an early right answer: byte for byte…"
//   M8  the rating's ladder copy left doubling                  → tests/schedule_linear.test.mjs "the three readers…"
//   M9  progress-owner's ladder copy left doubling              → tests/schedule_linear.test.mjs "the three readers…"
//
// Run: node --test tests/schedule_late.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as K from "../neural/src/knowledge-profile.src.js";
import { ngProgressValidateBlob } from "../neural/src/progress-owner.src.js";
import { onestep, onestepNow, schedulePart } from "./_onestep_client.mjs";

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

test("on its due day: exactly one step, every whole interval to the ladder's top; a card between whole days is paid its part day", () => {
  // on each of the first 14 rungs, answered on its due day: the next rung, as the one-step schedule gives it (LATE1's first
  // form sent the 60-day card to 120 here, twice its 60 days: gone, U226 a)
  const got = L.slice(0, 14).map((r) => iv(W(onRung(r), true, D + r)));
  assert.deepEqual(got, [3, 7, 14, 30, 60, 90, 180, 365, 730, 1461, 2922, 5525, 9951, 17179]);
  assert.deepEqual(got, L.slice(1, 15), "his named rungs, then the curve's");
  assert.deepEqual(L.slice(0, 14).map((r) => iv(onestepNow.write(onRung(r), true, D + r))), got, "the one-step schedule on his ladder");
  assert.deepEqual(W([D + 60, 60, D], true, D + 60), [D + 150, 60, D + 60], "the 60-day card: 90 days, no late mark (120 is gone)");
  assert.deepEqual(W([D + 1, 1, D], true, D + 1), [D + 4, 3, D + 1], "1 → 3 (twice would be 2: the step is the floor)");
  assert.deepEqual(W([D + 3, 3, D], true, D + 3), [D + 10, 7, D + 3], "3 → 7 (twice would be 6)");
  // on time, every whole interval from 1 to 3,000 days through the writer: one step, the late rule deciding none
  for (let I = 1; I <= 3000; I++) {
    const row = [D + I, cell(I), D];
    assert.equal(iv(W(row, true, D + I)), onestepNow.next(row, D + I), `${I} days on its due day`);
    if (I < 1461) assert.equal(iv(W(row, true, D + I)), onestep.next(row, D + I), `${I} days: v1.304.0's own step`);
  }
  // and the rule's own function on every whole interval to the ladder's top: exactly one step, not a rounding above it
  let n = 0;
  for (let I = 1; I <= L[L.length - 1]; I += I < 5000 ? 1 : 97) { assert.equal(K.ngKnowledgeLate(I, I), K.ngKnowledgeStep(I), `${I}`); n++; }
  assert.ok(n > 10000, `${n} intervals`);
  // A CARD BETWEEN WHOLE DAYS (an early answer left it at 60.5 days, due on its 61st whole day): on its due day the late rule
  // pays the part day, t × step ÷ I = 61 × 91.5 ÷ 60.5 = 92.256 days, a little more than the 91.5 one step (the early line
  // stops at one step: the due day is LATE, `last >= due`)
  const half = W([D + 60, 60, D], true, D + 1);
  assert.deepEqual(half, [D + 62, 60, D + 1, 60, D], "60.5 days, due on day 62");
  const due = W(half, true, half[0]);
  assert.equal(iv(due), (61 * 91.5) / 60.5);
  assert.deepEqual(due, [D + 62 + 93, 60, D + 62, (61 * 91.5) / 60.5, D + 62, 91.5, (61 * 91.5) / 60.5], "its late mark: the one-step 91.5");
});

test("the continuous form: twice the wait wherever his step at least doubles, the step's own multiple where it does not (60 → 90 on its due, 91.5 a day late)", () => {
  // (a row the late rule stretched carries its late mark after the pair's slot: [0, 0, the one-step interval, its own];
  // tests/schedule_late_mark.test.mjs)
  assert.deepEqual(W([D + 60, 60, D], true, D + 61), [D + 61 + 92, 60, D + 61, 91.5, D + 61, 90, 91.5], "a day late: 1.5 × 61");
  assert.deepEqual(W([D + 60, 60, D], true, D + 120), [D + 120 + 180, 120, D + 120, 0, 0, 90, 180], "the interval late: 1.5 × 120");
  assert.deepEqual(onestep.write([D + 60, 60, D], true, D + 61), [D + 61 + 90, 60, D + 61], "the one-step client: 90");
  // the rung table (LATE1's study, Part A): on the due, a day late, the interval late (twice the interval since); only the
  // 60-day rung moves from LATE1's first form ([60, 120, 122, 240] there)
  const table = [[1, 3, 4, 4], [3, 7, 8, 12], [7, 14, 16, 28], [14, 30, 30, 56], [30, 60, 62, 120], [60, 90, 91.5, 180], [90, 180, 182, 360],
    [180, 365, 365, 720], [365, 730, 732, 1460]];
  for (const [r, onDue, plus1, twice] of table) {
    assert.deepEqual([iv(W(onRung(r), true, D + r)), iv(W(onRung(r), true, D + r + 1)), iv(W(onRung(r), true, D + 2 * r))], [onDue, plus1, twice], `the ${r}-day rung`);
  }
  // a 75-day card on its due: one step, 135 (LATE1's first form gave 150); 1.8 × the wait after it (135 ÷ 75)
  assert.equal(iv(W([D + 75, 60, D], true, D + 75)), 135);
  assert.equal(iv(W([D + 75, 60, D], true, D + 100)), 180);
  // THE STUDY'S TABLES (SAT1 §5, candidate A, from its copy of the writer), in whole days: on the due day and twice late
  const Is = [30, 60, 90, 180, 365, 730, 1461, 2922, 5844];
  const at = (I, t) => iv(W([D + I, cell(I), D], true, D + t));
  assert.deepEqual(Is.map((I) => Math.round(at(I, I))), [60, 90, 180, 365, 730, 1461, 2922, 5525, 10472], "on the due day");
  assert.deepEqual(Is.map((I) => Math.round(at(I, 2 * I))), [120, 180, 360, 720, 1460, 2920, 5525, 10472, 19917], "twice late");
});

test("the top: past 4 years the rungs are the fitted curve's, and a late answer earns the ladder's own step for the days waited", () => {
  // HIS NUMBERS, typed from the ruling (U226 a): C(x) = x × (1 + (1461 ÷ x)^(1/6)), each rung past 2,922 = C(the one before),
  // rounded to a whole day; 24 rungs, as the doubling ladder had
  const C = (x) => x * (1 + Math.pow(1461 / x, 1 / 6));
  assert.equal(K.NG_KNOWLEDGE_TOP_FROM, 1461);
  assert.equal(K.NG_KNOWLEDGE_TOP_POWER, 1 / 6);
  assert.deepEqual(L.slice(0, 12), [1, 3, 7, 14, 30, 60, 90, 180, 365, 730, 1461, 2922], "his named rungs");
  assert.deepEqual(L.slice(12), [5525, 9951, 17179, 28571, 45978, 71854, 109393, 162677, 236844, 338273, 474783, 655856]);
  for (let i = 12; i < L.length; i++) assert.equal(L[i], Math.round(C(L[i - 1])), `rung ${i}`);
  assert.equal(C(1461), 2922, "his last named doubling step is the curve's first: 4 years → 8");
  // each rung's rounding is far from a half day, so no engine's Math.pow can round it the other way
  for (let i = 11; i < L.length - 1; i++) assert.ok(Math.abs((C(L[i]) % 1) - 0.5) > 0.02, `rung ${i + 1}: ${C(L[i])}`);
  // ON TIME, from 4 years: 4 → 8 → 15.1 → 27.2 → 47 years (whole days 1,461 → 2,922 → 5,525 → 9,951 → 17,179)
  let r = onRung(1461);
  const life = [];
  for (let k = 0; k < 5; k++) { life.push(iv(r)); r = W(r, true, r[0]); }
  assert.deepEqual(life, [1461, 2922, 5525, 9951, 17179]);
  assert.deepEqual(life.map((d) => +(d / 365.25).toFixed(1)), [4, 8, 15.1, 27.2, 47]);
  // a card between rungs past 4 years, on its due: the ladder's straight line (5,844 days → 10,471.95, the study's 10,472)
  assert.equal(iv(W([D + 5844, 120, D], true, D + 5844)), 9951 + (319 * (17179 - 9951)) / (9951 - 5525));
  // LATE PAST 4 YEARS: the ladder's own step for the days waited, whatever the card held (a 4-year, a 1-year and a 7-day card
  // answered 8 years after its last answer: 5,525 days; twice the 8 years would be 5,844)
  for (const I of [1461, 365, 7]) assert.equal(iv(W([D + I, cell(I), D], true, D + 2922)), 5525, `a ${I}-day card, 2,922 days on`);
  assert.equal(K.ngKnowledgeLate(1461, 2922), 5525);
  assert.equal(K.ngKnowledgeLate(365, 2922), 5525);
  // up to 4 years a late answer is still twice the wait (a 365-day card 1,461 days on: 2,922; a day past: the curve's line)
  assert.equal(K.ngKnowledgeLate(365, 1461), 2922);
  assert.equal(K.ngKnowledgeLate(365, 1462), K.ngKnowledgeStep(1462));
  assert.ok(K.ngKnowledgeLate(365, 1462) > 2922 && K.ngKnowledgeLate(365, 1462) < 2924, "no jump at 4 years");
  // the multiple a late answer earns past 4 years falls as the curve's: 2 at 4 years, 1.89 at 8, 1.80 at 15.1, 1.73 at 27.2
  assert.deepEqual([1461, 2922, 5525, 9951].map((t) => +(K.ngKnowledgeLate(7, t) / t).toFixed(2)), [2, 1.89, 1.8, 1.73]);
});

test("very late: the ladder's own step for the days waited, however many (its top the only bound, no cap of ours)", () => {
  // two years late on a 3-day card: twice the 733 days since its last answer, four years and more
  assert.deepEqual(W([D + 3, 3, D], true, D + 733), [D + 733 + 1466, 120, D + 733, 0, 0, 7, 1466]);
  // a 2,922-day card two years late: the curve's line at 3,652 days, 6,766.25 (one step gave 5,525; LATE1's first form 7,304)
  assert.equal(iv(W(onRung(2922), true, D + 2922 + 730)), 5525 + (730 * (9951 - 5525)) / (5525 - 2922));
  assert.equal(iv(W([D + 3, 3, D], true, D + 75)), 150, "the 75-day carried card answered 75 days after: 150");
  // a hundred and a thousand years: the ladder's step for the days waited; past the ladder's own top (655,856 days, about
  // 1,796 years), its top
  for (const since of [730, 1461]) assert.equal(iv(W([D + 7, 7, D], true, D + since)), 2 * since, `${since} days: twice`);
  for (const since of [2922, 5525, 36525, 365250]) assert.equal(iv(W([D + 7, 7, D], true, D + since)), K.ngKnowledgeStep(since), `${since} days`);
  assert.ok(iv(W([D + 7, 7, D], true, D + 36525)) > 57800, "a hundred years away: 158 years");
  for (const since of [L[L.length - 1], L[L.length - 1] + 1, 2 * L[L.length - 1]]) assert.equal(iv(W([D + 7, 7, D], true, D + since)), L[L.length - 1], `${since} days: the top`);
  assert.equal(K.ngKnowledgeLate(14, 400), 800);
  assert.equal(K.ngKnowledgeLate(90, 30), 180, "(a wait shorter than the interval is the writer's early line, never this function's: here one step)");
  // the moves rows read the same rule (`at` 4): the answer at [3] kept
  assert.deepEqual(W([D + 7, 7, D, 1], true, D + 400, 4), [D + 1200, 120, D + 400, 1, 0, 0, 14, 800]);
});

test("the study's four conditions on the writer: late never below on time, never falling as the wait grows, no jump at the due, his named rungs on time", () => {
  // (SAT1's check, `check_laws.mjs`, on the shipped writer: whole days, as the app answers; srs and moves rows)
  const Is = [1, 2, 3, 5, 7, 10, 14, 20, 30, 42, 45, 59, 60, 61, 75, 89, 90, 100, 120, 150, 180, 241, 300, 365, 500, 730, 1000, 1461, 2000, 2922, 4000, 5525, 5844, 9951, 20000];
  let checked = 0, lateBelow = 0, falls = 0, worst = { r: -Infinity };
  for (const I of Is) for (const at of [3, 4]) {
    const prior = at === 3 ? [D + I, cell(I), D] : [D + I, cell(I), D, 1];
    const nx = (t) => K.ngKnowledgeNextInterval(prior, D + t, at);
    const onTime = nx(I);
    let prev = -Infinity;
    for (let t = 1; t <= 12 * I + 400; t += t < 3 * I ? 1 : Math.max(1, Math.floor(I / 7))) {
      const v = nx(t); checked++;
      if (t >= I && v < onTime) lateBelow++;
      if (v < prev) falls++;
      prev = v;
    }
    // the rise from the day before the due to the due day, against the early line's rise over the day before that
    const jump = nx(I) - nx(I - 1), slope = I >= 3 ? nx(I - 1) - nx(I - 2) : jump;
    if (jump - slope > worst.r) worst = { r: jump - slope, I };
  }
  assert.equal(lateBelow, 0, "a late answer never earns less than the on-time one");
  assert.equal(falls, 0, "the next interval never falls as the wait grows");
  assert.ok(worst.r < 1e-9, `no jump at the due: the due day's rise is the early line's own slope (worst ${worst.r} at ${worst.I})`);
  assert.ok(checked > 100000, `${checked} answers`);
  // an on-time card from its first answer, answered on every due day: his named rungs, then the curve's
  let row = W(null, true, D);
  const life = [];
  while (life.length < 16) { life.push(iv(row)); row = W(row, true, row[0]); }
  assert.deepEqual(life, [1, 3, 7, 14, 30, 60, 90, 180, 365, 730, 1461, 2922, 5525, 9951, 17179, 28571]);
});

test("between the rungs the writer runs in straight lines: from 4 to 60 years within 0.41% under the exact curve, never above it but for a rung's rounding", () => {
  const C = (x) => x * (1 + Math.pow(1461 / x, 1 / 6));
  let worst = { g: 0 }, above = 0, n = 0;
  for (let x = 1461; x <= 60 * 365.25; x += 0.25) {
    const s = K.ngKnowledgeStep(x), c = C(x), g = (c - s) / c;
    if (s - c > 0.5) above++;
    if (g > worst.g) worst = { g, x };
    n++;
  }
  // the largest gap: 0.4036% at 2,030 days (5.6 years: 3,935.8 against the curve's 3,951.7)
  assert.equal(+(100 * worst.g).toFixed(4), 0.4036);
  assert.equal(worst.x, 2030);
  assert.equal(above, 0, "above the curve only by a rung's rounding (at most half a day)");
  // and a late answer past 4 years reads the same line: the ladder's step for the days waited
  for (const t of [1462, 2030, 4000, 9000, 21000]) assert.equal(K.ngKnowledgeLate(30, t), K.ngKnowledgeStep(t));
  assert.ok(n > 80000, `${n} points`);
});

// (v1.305.0's late mark, the rows the late rule stretched: the one-step client copies a prior's cells after the pair forward
// and writes no mark of its own, so on a marked row the two rows differ after the pair's slot and only there; the schedule,
// the head and the pair, is compared on every row, and the whole row on every row without a mark)
test("an early right answer: byte for byte the one-step client's below 4 years, and everywhere the one-step schedule's on his ladder, srs and moves", () => {
  let n = 0, whole = 0, now = 0;
  for (const row of shapes()) {
    const last = row[2], due = row[0], marked = K.ngKnowledgeMark(row) !== null, young = iv(row) < 1461;
    for (let d = last - 3; d < due; d += Math.max(1, Math.floor((due - last) / 40))) {
      const a = W(row, true, d), am = W(moves(row), true, d, 4);
      const c = onestepNow.write(row, true, d), cm = onestepNow.write(moves(row), true, d, 4);
      assert.deepEqual(schedulePart(a), schedulePart(c), `${row} on day ${d}: the one-step schedule on his ladder`);
      assert.deepEqual(schedulePart(am, 4), schedulePart(cm, 4), `moves ${row} on day ${d}: the one-step schedule on his ladder`);
      now += 2;
      if (!young) continue;
      const b = onestep.write(row, true, d), bm = onestep.write(moves(row), true, d, 4);
      assert.deepEqual(schedulePart(a), schedulePart(b), `${row} on day ${d}`);
      assert.deepEqual(schedulePart(am, 4), schedulePart(bm, 4), `moves ${row} on day ${d}`);
      if (!marked) { assert.deepEqual(a, b, `${row} on day ${d}, whole`); assert.deepEqual(am, bm, `moves ${row} on day ${d}, whole`); whole += 2; }
      n += 2;
    }
  }
  assert.ok(n > 3000 && whole > 2000 && now > n, `${n} early answers compared with v1.304.0, ${whole} whole, ${now} with the one-step schedule on his ladder`);
  // past 4 years the early line is the same line (LIN2: the card stands on its rung's line) on the new step: a 2,000-day card
  // answered 1,000 days in stands 539 days into the 4-year rung's line, so the answer is 78 days into the 8-year rung's step,
  // 2,922 + 78 × (5,525 − 2,922) ÷ 2,922 = 2,991.48 days (v1.304.0, whose ladder doubled: 2,922 + 78 = 3,000)
  assert.equal(iv(W([D + 2000, 120, D], true, D + 1000)), 2922 + (78 * (5525 - 2922)) / 2922);
  assert.equal(iv(onestep.write([D + 2000, 120, D], true, D + 1000)), 3000, "v1.304.0, whose ladder doubled: 3,000");
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
