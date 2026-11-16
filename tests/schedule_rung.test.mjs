// THE CARD'S LINE IS ITS RUNG'S (v1.281.3, LIN2, ruled after the independent reader's read of PR #421) — neural/src/
// knowledge-profile.src.js (`ngKnowledgeOnRung`, `ngKnowledgeRungState`, `ngKnowledgeNext`, `ngKnowledgeEarly`).
//
// THE RULE, in one sentence a player could read: a card climbs its step at a steady pace: each day you waited before
// answering right earns the same share of the step, whenever you answer. It is the owner's formula (U188) with the ratio of
// the STEP THE CARD IS IN at every answer: a card between rungs r < x < next stands on r's line, (x − r) × r ÷ (next − r)
// days into r's step, and climbs it at (next − r) ÷ r days a day, rung after rung. On time or late it takes exactly one step
// from the interval it reads. As a level: a real number climbing 1 ÷ (its rung's interval) a day, at most one level per answer.
// v1.281.0 drew one straight line from the card's own interval (A + w × (step(A) − A) ÷ A), which differs only where it stored
// an anchor off the rungs.
//
// WHAT IS STORED (no format change: a rung pair is a pair, and the readers' copies are unchanged): an on-time or late answer
// stores its step anchored at its own day, [step, day], exactly as v1.281.0 did; an early answer stores the RUNG pair [rung,
// the day the card stood on it]; a row whose pair is not a rung pair (an older client's, a step between rungs, v1.281.0's
// off-rung anchors) is put on its rung's line at the interval it reads, at its last answer. NOTHING IS ROUNDED: the numbers
// stored are the ones computed (a JSON number reads back as itself), so an on-time answer lands exactly on its step and every
// due is the rule's in exact arithmetic (pinned below in fractions). The 1e-6 tolerance of `ngKnowledgeDueDay` reads float
// dust under or over a whole day right.
//
// THE CLAIMS PINNED HERE, each over the reader's own searches replayed (its seeds, starts and loops, written fresh here):
//   · an early right answer never leaves a card due sooner than without it (LIN1-R3's N1 is gone: 0 of 1,113,790, 0 of
//     509,533), and from rows v1.281.0 wrote, off the rungs, one early answer then the next on any day is never behind;
//   · ahead of answering on time ONLY BY WHOLE DAYS, never in exact days: the on-time path answers on whole due days and
//     restarts there (LIN1-R2's D1: (a) at most 3 days in the reader's early-only search, 839 of 566,832 prefixes; (b) 0 of
//     40,536). Not a general bound: it adds up by about a day per on-time answer as a card ages (the reader of PR #426's
//     5-day case, two years in, pinned beside it);
//   · every due the writer sets is the rule's in exact fractions;
//   · a day later never earns less, and no cliff, on rows of every client;
//   · the rows v1.281.0 wrote are never made due sooner, through mixed-writer histories and the merges;
//   · every row the writer emits passes the blob validator, this client's and the older clients' (v1.280.4, production
//     v1.252.0, captured in tests/artifacts/progress_validators.json): a pair day below 0 is never stored (LIN2-R1); such a row
//     stores its exact interval dated on its own day, so every claim above holds on it too, from epoch day 0 (LIN2-R2).
// His formula on every rung, never sooner and the rest stay in tests/schedule_linear.test.mjs and tests/schedule_ladder.test.mjs.
//
// THE v1.281.0 CLIENT is captured from git (never re-typed) in tests/artifacts/schedule_lin1_client.json
// (tests/artifacts/_capture_lin1_schedule.mjs).
//
// MUTANTS (v1.281.3), each applied alone to a copy of the tree and run against the ten schedule unit files (this one,
// schedule_linear, schedule_ladder, knowledge_profile, moves_record, moves_account_safety, answers_before_sync,
// progress_owner.integration, rating, practice_queue); each turned the NAMED tests red (the counts leave out one red the copy
// shows in its control too, the progress host's "build owner pinning", which needs files the copy does not hold):
//   G1  no rung state: every card on v1.281.0's line          → "an early right answer never leaves a card due sooner…",
//       "ahead of answering on time…", "every due the writer sets is the rule's in exact fractions…", "the rung pair…", "from
//       rows v1.281.0 wrote…", and 3 more (8)
//   G2  an on-time step rounded to 4 decimals (v1.281.0's)      → "every due … exact fractions…", "nothing is rounded…", "a day
//       later never earns less…", "an early right answer never…", "ahead of…", and 4 more (9)
//   G3  the rung pair's day to 4 decimals, the nearest (the reader's Candidate 2) → "every due … exact fractions…", "ahead of
//       answering on time … never in exact days…", and the daily runs (3)
//   G4  no day waited still moves the card onto its rung's line → "nothing is rounded…" (a second answer the same day), "a right
//       answer never makes a card due sooner", "a clock set back never lengthens an interval…" (3)
//   G5  the line of the rung ABOVE the card                     → 14, this file's five rule tests among them
//   G6  the walk's pair a hundredth of a day late at each rung  → 13, his example among them
//   G8  the srs heal rounded to 4 decimals again                → "the srs merge…" (1)
//   G9  the moves heal rounded to 4 decimals again              → "the moves merge…", moves_record's R5 (2)
//   G10 a late answer steps from its line's value, not from the interval it reads → 26
// G7, the one-step cap on an early answer removed, SURVIVED the first run, and was first written down here as equivalent. What
// the seat (1,280 rows, 247,008 answers) and the reader of PR #426 (406,764 hostile rows) found: it is equivalent in every due
// on rows a client writes; it decides the stored bytes when an early answer walks onto the top rung, and the due (by under a
// day) on one damaged shape, a row past the top with a fractional due answered with no day waited. Both are now pinned in "the
// rung pair…" (G7 red there).
//   N   the pair day kept below 0 (the fallback removed) → "every row the writer emits passes the blob validator…", "the rows
//       whose rung pair would be dated before 1970…", "the reader's wrong clock…"
//   N1  the fallback dropping the pair, as LIN2-R1 first built it → "answered every day from epoch day 0…", "the rows whose rung
//       pair would be dated before 1970…" and "every row the writer emits…" (both read exactly), "the reader's wrong clock…" (the
//       71-day card at day 20)
//
// Run: node --test tests/schedule_rung.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as K from "../neural/src/knowledge-profile.src.js";
import { ngProgressMergeMoves, ngProgressValidateBlob, ngProgressCreateStore, ngProgressOwner } from "../neural/src/progress-owner.src.js";

const W = K.ngKnowledgeScheduleRow, L = K.NG_KNOWLEDGE_LADDER, cell = K.ngKnowledgeCell;
const json = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const LIN1 = json("./artifacts/schedule_lin1_client.json"), PREV = json("./artifacts/schedule_prev_client.json"), OLD = json("./artifacts/schedule_old_client.json");
const lin1 = new Function(LIN1.knowledge.ladder + "\n" + LIN1.knowledge.schedule + "\nreturn { write: ngKnowledgeScheduleRow, merge: ngKnowledgeMergeRow, interval: ngKnowledgeInterval };")();
const lin1MergeMoves = new Function(LIN1.owner.mergeMoves + "\nreturn ngProgressMergeMoves;")();
const prev = new Function(PREV.knowledge.ladder + "\n" + PREV.knowledge.schedule + "\nreturn { write: ngKnowledgeScheduleRow, merge: ngKnowledgeMergeRow };")();
const oldWrite = new Function(OLD.knowledge.intervals + "\n" + OLD.knowledge.scheduleRow + "\nreturn ngKnowledgeScheduleRow;")();
const VALIDATORS = json("./artifacts/progress_validators.json").clients;
const validators = { now: ngProgressValidateBlob, ...Object.fromEntries(Object.entries(VALIDATORS).map(([k, v]) => [k, new Function(v.validator + "\nreturn ngProgressValidateBlob;")()])) };
const rows = (row, days) => days.map((d) => (row = W(row, true, d)));
const exactDue = (r) => r[2] + K.ngKnowledgeInterval(r);
const lcg = (s) => () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

test("the rung pair: a card between rungs stands on the line of the rung below it, at the interval it reads", () => {
  const D = 20400;   // a real epoch day (16 Nov 2025): every pinned row is one a device could hold
  // a 42-day card (between 30 and 60) is 12 days into the 30-day rung's step, and climbs it a day a day
  assert.deepEqual(W([D + 42, 30, D], true, D + 1), [D + 44, 30, D + 1, 30, D - 12], "43 days from its next day");
  assert.deepEqual(W([D + 42, 30, D], true, D + 17), [D + 76, 30, D + 17, 30, D - 12], "59 days: a day short of the 60 rung");
  assert.deepEqual(W([D + 42, 30, D], true, D + 18), [D + 78, 60, D + 18], "on the 60 rung: 60 days, the pair says nothing more");
  assert.deepEqual(W([D + 42, 30, D], true, D + 28), [D + 93, 60, D + 28, 60, D + 18], "10 days into the 60 rung, half a day a day: 65");
  // a 75-day card (between 60 and 90): 30 days into the 60-day step, which climbs half a day a day, then the 90 rung a day a day
  assert.deepEqual(W([D + 75, 60, D], true, D + 28), [D + 28 + 89, 60, D + 28, 60, D - 30], "day 28: 89 days (v1.281.0's line from 75 gave 98)");
  assert.deepEqual(W([D + 75, 60, D], true, D + 74), [D + 74 + 134, 120, D + 74, 90, D + 30], "a day before its due: 134 days");
  assert.deepEqual(W([D + 75, 60, D], true, D + 75), [D + 75 + 135, 120, D + 75], "on its due: exactly one step, 135 days, anchored at its day");
  // the two lines agree at the due: one step from 75 is 135 either way
  assert.equal(lin1.write([D + 75, 60, D], true, D + 75)[0], D + 75 + 135);
  // THE ONE-STEP CAP binds only at and past the top (11,968,512 days, where a step is the top): (1) an early answer that walks
  // onto the top rung takes the top, stored at its own day with no pair; (2) a row past the top with a fractional due (no
  // writer makes one: the pull truncates a cloud row's due), answered with no day waited, is capped to the top and kept as it
  // was by the never-sooner guard. Below the top an early answer never reaches the cap
  const top = L[L.length - 1], sec = L[L.length - 2];
  const half = W([D + sec, 120, D], true, D + sec / 2), d = D + sec + 10;
  assert.deepEqual(half, [D + 2 * sec, 120, D + sec / 2, sec, D], "premise: half-way up the second-to-top rung's line");
  assert.deepEqual(W(half, true, d), [d + top, 120, d], "onto the top: the top, at its own day");
  const past = [D + top + 0.4, 120, D];
  assert.deepEqual([W(past, true, D), W(past, true, D - 30)], [past, past], "past the top, no day waited: kept as it was");
});

test("an early right answer never leaves a card due sooner than without it: the reader's searches replayed, 0 of 1,113,790 and 0 of 509,533", () => {
  // (1) the reader's long extra-answer search: base histories of right answers, each with ONE more right answer added in a
  // gap, early when given, compared after every later answer of the base
  const T = 10000, starts = [];
  for (let i = 0; i < 12; i++) starts.push({ kind: "rung", row: [T + L[i], cell(L[i]), T] });
  for (const iv of [2, 5, 10, 20, 42, 45, 59, 75, 89, 100, 120, 150, 241, 300, 500, 1000, 2000]) starts.push({ kind: "dev", row: [T + iv, cell(iv), T] });
  starts.push({ kind: "head", row: W([T + 120, 120, T], true, T + 120) });
  for (let i = 2; i < 11; i++) starts.push({ kind: "mid", row: W([T + L[i], cell(L[i]), T], true, T + Math.floor(L[i] * 0.4)) });
  const rnd = lcg(77);
  let inserted = 0, compared = 0, sooner = 0;
  const search = (st, ds) => {
    const base = rows(st.row, ds), from = [st.row[2], ...ds];
    for (let g = 0; g < ds.length; g++) {
      const lo = from[g], hi = ds[g], prior = g ? base[g - 1] : st.row, span = hi - lo - 1;
      if (span < 1) continue;
      for (let t = 0, n = Math.min(span, 12); t < n; t++) {
        const e = lo + 1 + Math.floor(((t + rnd()) / n) * span);
        if (!(e > lo && e < hi && e < prior[0])) continue;   // early: before the due of the row it answers
        inserted++;
        const ext = rows(st.row, [...ds.slice(0, g), e, ...ds.slice(g)]);
        for (let k = g; k < ds.length; k++) { compared++; if (ext[k + 1][0] < base[k][0]) sooner++; }
      }
    }
  };
  for (const st of starts) {
    const I = K.ngKnowledgeInterval(st.row);
    { const d = []; let r = st.row; for (let i = 0; i < 4; i++) { d.push(r[0]); r = W(r, true, r[0]); } for (let n = 1; n <= 4; n++) search(st, d.slice(0, n)); }
    for (const fr of [[0.2], [0.5], [0.9], [0.3, 0.6], [0.5, 0.95], [0.2, 0.5, 0.8]]) {
      const d = []; let r = st.row;
      for (const f of fr) { const day = r[2] + Math.max(1, Math.floor((r[0] - r[2]) * f)); if (day >= r[0]) break; d.push(day); r = W(r, true, day); }
      for (let i = 0; i < 2; i++) { d.push(r[0]); r = W(r, true, r[0]); }
      search(st, d);
    }
    for (const gap of [0.3, 0.45, 0.7]) {
      const step = Math.max(1, Math.floor(I * gap)), d = [];
      for (let x = st.row[2] + step; x <= st.row[2] + Math.min(2.2 * I, 60 * step); x += step) d.push(x);
      if (d.length) search(st, d);
    }
    { const d = []; let r = st.row; for (const f of [1.3, 0.5, 1.0, 2.0]) { const day = r[2] + Math.max(1, Math.floor((r[0] - r[2]) * f)); d.push(day); r = W(r, true, day); } search(st, d); }
    for (let q = 0; q < 300; q++) {
      const d = []; let r = st.row;
      for (let i = 0, n = 1 + Math.floor(rnd() * 6); i < n; i++) { const day = r[2] + Math.max(1, Math.floor((r[0] - r[2]) * (0.05 + rnd() * 1.45))); d.push(day); r = W(r, true, day); }
      search(st, d);
    }
  }
  assert.deepEqual([inserted, compared, sooner], [427680, 1113790, 0], "the reader's search replayed: never sooner");
  // (2) the reader's exhaustive two-answer search: two base answers b1 < b2, one extra early answer before b1 or
  // between them, over a grid of days from rung starts and dev rows
  let n2 = 0, bad2 = 0;
  for (const s of [...L.slice(0, 10).map((x) => [x, cell(x), 0]), ...[5, 20, 42, 75, 100, 120, 241, 500, 2000].map((x) => [x, cell(x), 0])]) {
    const I = s[0], st = Math.max(1, Math.floor(I / 15));
    for (let b1 = 1; b1 <= 2 * I; b1 += st) {
      const r1 = W(s, true, b1);
      for (let b2 = b1 + 1; b2 <= b1 + 2 * (r1[0] - r1[2]); b2 += Math.max(1, Math.floor((r1[0] - r1[2]) / 15))) {
        const without = W(r1, true, b2)[0];
        for (let e = 1; e < b2; e += st) {
          if (e === b1) continue;
          const prior = e < b1 ? s : r1; if (e >= prior[0]) continue;
          n2++;
          if (rows(s, e < b1 ? [e, b1, b2] : [b1, e, b2]).at(-1)[0] < without) bad2++;
        }
      }
    }
  }
  assert.deepEqual([n2, bad2], [509533, 0], "the reader's two-answer search replayed: never sooner");
  // the case v1.281.0 lost (LIN1-R3): a 30-day card answered on days 12, 56 and 86, and the same with one more on day 19. Under
  // v1.281.0: 181 and 174. Now the card with the extra answer is never behind
  const D = 20400, on = (xs) => xs.map((x) => D + x);
  const without = rows([D + 30, 30, D], on([12, 56, 86])), withE = rows([D + 30, 30, D], on([12, 19, 56, 86]));
  assert.equal(lin1.write(lin1.write(lin1.write([D + 30, 30, D], true, D + 12), true, D + 56), true, D + 86)[0], D + 181, "v1.281.0: 181, and 174 with day 19");
  // day 56 is late (one step from 42 to 72, at its own day), day 86 early: 72 stands on the 60-day rung's line, 24 days in
  assert.deepEqual(without, [[D + 54, 30, D + 12, 30, D], [D + 128, 60, D + 56], [D + 173, 60, D + 86, 60, D + 32]]);
  // with day 19, day 56 is early and walks the card's first line (60 days from day 30)
  assert.deepEqual(withE, [[D + 54, 30, D + 12, 30, D], [D + 68, 30, D + 19, 30, D], [D + 129, 60, D + 56, 60, D + 30], [D + 174, 60, D + 86, 60, D + 30]]);
  // and v1.281.0's worst (a 75-day row, 39 days sooner with one more answer on +21)
  const far = [15, 106, 173, 516, 1049, 2113].map((d) => T + d), start = [T + 75, 60, T];
  assert.deepEqual(rows(start, far).at(-1), [13936, 120, 12113, 1822.1916666666668, 12113], "without it: due 13936 (v1.281.0: 14046)");
  assert.deepEqual(rows(start, [far[0], T + 21, ...far.slice(1)]).at(-1), [14005, 120, 12113, 1891.1833333333334, 12113], "with it: 14005, later (v1.281.0: 14007, 39 days sooner)");
});

test("from rows v1.281.0 wrote (anchors off the rungs): one early answer, then the next on its old due, its own new due or any later day, is never behind", () => {
  // rows v1.281.0's own writer leaves after mixed histories (early, on time, late), carrying pairs off the rungs
  const rnd = lcg(5), from = [];
  for (const I of [3, 7, 14, 20, 30, 42, 60, 75, 90, 120, 180, 241, 365]) for (let q = 0; q < 40; q++) {
    let r = [10000 + I, cell(I), 10000];
    for (let k = 0, n = 1 + Math.floor(rnd() * 4); k < n; k++) r = lin1.write(r, true, r[2] + Math.max(1, Math.floor((r[0] - r[2]) * (0.1 + rnd() * 1.3))));
    if (r.length >= 5 && r[4] < r[2] && !L.includes(r[3])) from.push(r);
  }
  assert.ok(from.length > 150, `${from.length} rows off the rungs`);
  let pairs = 0, behind = 0;
  for (const r of from) {
    const I = r[0] - r[2];
    for (let e = r[2] + 1; e < r[0]; e += Math.max(1, Math.floor(I / 12))) {
      const r1 = W(r, true, e);
      for (const d of new Set([r[0], r1[0], r[0] + 1, e + 1, Math.floor((e + r1[0]) / 2), r1[0] + Math.floor(I / 2)])) {
        if (d <= e) continue;
        pairs++;
        if (W(r1, true, d)[0] < W(r, true, d)[0]) behind++;
      }
    }
  }
  assert.ok(pairs > 5000, `${pairs} pairs`);
  assert.equal(behind, 0, "one early answer then the next on any day: never behind");
  console.log(`v1.281.0 rows off the rungs: ${from.length}; one early answer then the next: ${pairs} pairs, ${behind} behind`);
});

test("ahead of answering on time only by whole days, never in exact days: at most 3 in the reader's early-only search (839 of 566,832), 0 of 40,536 in its targeted one, 5 by two years", () => {
  const onTimePath = (row, n, exact) => { const p = []; let r = row; for (let k = 0; k < n; k++) { const d = exact ? exactDue(r) : r[0]; r = W(r, true, d); p.push({ day: d, row: r }); } return p; };
  // (a) the reader's early-only search: runs of answers each before the row's due, against the on-time path from the
  // run's start answered on its whole due days, and against the same path answered at its EXACT dues
  const rnd = lcg(21), starts = [];
  for (let i = 0; i < 13; i++) starts.push([10000 + L[i], cell(L[i]), 10000]);
  for (const iv of [2, 5, 10, 20, 42, 45, 59, 75, 89, 100, 120, 150, 241, 300, 500, 1000, 2000]) starts.push([10000 + iv, cell(iv), 10000]);
  let prefixes = 0, ahead = 0, days = 0, aheadExact = 0, worst = null;
  for (const st of starts) {
    const P = onTimePath(st, 40, false), X = onTimePath(st, 40, true);
    for (let q = 0; q < 3000; q++) {
      let r = st; const ds = [];
      for (let i = 0, n = 2 + Math.floor(rnd() * 10); i < n; i++) {
        const room = r[0] - r[2] - 1; if (room < 1) break;
        const d = r[2] + 1 + Math.floor(rnd() ** (rnd() < 0.5 ? 0.3 : 2) * room);
        r = W(r, true, d); ds.push(d); prefixes++;
        const k = P.findIndex((p) => p.day >= d);
        if (k >= 0 && r[0] > P[k].row[0]) { ahead++; if (r[0] - P[k].row[0] > days) { days = r[0] - P[k].row[0]; worst = { st, ds: ds.slice(), r, next: P[k] }; } }
        const j = X.findIndex((p) => p.day >= d);
        if (j >= 0 && exactDue(r) > exactDue(X[j].row) + 1e-6) aheadExact++;
      }
    }
  }
  assert.equal(prefixes, 566832, "the reader's search, replayed");
  assert.ok(ahead <= 839 && days <= 3, `${ahead} prefixes ahead in whole days, by at most ${days}`);
  assert.equal(aheadExact, 0, "never ahead of the on-time path answered at its exact due");
  // the worst: a 20-day row answered early eight times ends 3 days after the on-time path's next answer, on the same 365 rung's
  // line: the on-time path answers on whole due days, a fraction of a day after its exact due each time, and restarts there
  assert.deepEqual(worst.r, [11013, 120, 10508, 365, 10368.75]);
  assert.deepEqual([worst.next.day, worst.next.row[0]], [10508, 11010]);
  // v1.281.0's worst in the same search: a 20-day row answered early on +9, +32, +38, +81, +92 and +134 was due 10 days after
  // the on-time path's next answer ([10268, 120, 10134, 84.3409, 10081] against 10258); on the rung's line, 2 days, whole days only
  let w0 = [10020, 14, 10000];
  for (const x of [9, 32, 38, 81, 92, 134]) w0 = W(w0, true, 10000 + x);
  assert.deepEqual(w0, [10260, 120, 10134, 90, 10098.75]);
  assert.equal(onTimePath([10020, 14, 10000], 40, false).find((p) => p.day >= 10134).row[0], 10258);
  // (b) the reader's targeted search: early, on its due (+0, 1, 2 or 5), then early near the next due
  let tried = 0, aheadB = 0;
  for (let i = 0; i < 13; i++) {
    const A = L[i], t = 100000, start = [t + A, cell(A), t], P = onTimePath(start, 12, false);
    for (let f = 1; f < A; f += Math.max(1, Math.floor(A / 60))) for (const lateBy of [0, 1, 2, 5]) for (const g of [0.1, 0.3, 0.5, 0.7, 0.9, 0.97]) for (const tail of [1, 2, 3]) {
      let r = W(start, true, t + f); const ds = [t + f];
      const d2 = r[0] + lateBy; r = W(r, true, d2); ds.push(d2);
      for (let k = 1; k <= tail; k++) { const iv = r[0] - r[2], d = r[2] + Math.max(1, Math.floor((iv * g * k) / tail)); if (d >= r[0]) break; r = W(r, true, d); ds.push(d); }
      tried++;
      const k = P.findIndex((p) => p.day >= ds[ds.length - 1]);
      if (k >= 0 && r[0] > P[k].row[0]) aheadB++;
    }
  }
  assert.deepEqual([tried, aheadB], [40536, 0], "early, on time, then early: never ahead");
  // v1.281.0's worst (b) sequence: a 30-day card answered on days 13, 56 (its due), 66 and 90 came due on 190 against the
  // on-time path's 180 and stayed about a tenth ahead for good. On the rung's line it comes due on 180, and stays level
  const D = 20400;
  let rb = [D + 30, 30, D];
  const bRows = [13, 56, 66, 90].map((x) => (rb = W(rb, true, D + x)));
  assert.deepEqual(bRows, [[D + 56, 30, D + 13, 30, D], [D + 129, 60, D + 56], [D + 144, 60, D + 66, 60, D + 30], [D + 180, 60, D + 90]]);
  let ot = W(W([D + 30, 30, D], true, D + 30), true, D + 90);
  const lead = [[rb[0] - D, ot[0] - D]];
  for (let k = 0; k < 4; k++) { rb = W(rb, true, rb[0]); ot = W(ot, true, ot[0]); lead.push([rb[0] - D, ot[0] - D]); }
  assert.deepEqual(lead, [[180, 180], [360, 360], [725, 725], [1455, 1455], [2916, 2916]], "no lead, for good");
  // NOT A GENERAL 3-DAY BOUND (the reader of PR #426, finding 2): the whole-day lead adds up, about a day per on-time answer
  // compared, as a card ages (its generator: up to 3 in a card's first 2 years, 5 by five years, 6 by ten, 12 near the top).
  // Its case: a 14-day card answered one day in, answered early on each of the on-time path's own answer days and on its own
  // due less one between them, is due on 21984; the on-time path, answering on 21196 too, on 21979: 5 days, 796 days in. In
  // exact days it is not ahead: its exact due (21983.08) is before the exact on-time path's next answer
  const c5 = [20417, 14, 20401, 14, 20400];
  let r5 = c5;
  for (const x of [20416, 20417, 20449, 20450, 20512, 20513, 20610, 20804, 21196]) r5 = W(r5, true, x);
  assert.deepEqual(r5, [21984, 120, 21196, 730, 21139]);
  const P5 = onTimePath(c5, 8, false), X5 = onTimePath(c5, 8, true);
  assert.deepEqual(P5.map((p) => p.day), [20417, 20450, 20513, 20610, 20804, 21196, 21979, 23545], "the on-time path answers on 21196 too");
  assert.equal(P5.find((p) => p.day >= 21196).row[0], 21979, "and is due 5 days before the early run");
  assert.ok(exactDue(r5) <= exactDue(X5.find((p) => p.day >= 21196).row) + 1e-6, "never ahead in exact days");
  console.log(`ahead of on time: (a) ${ahead} of ${prefixes} by at most ${days} whole days, ${aheadExact} in exact days; (b) ${aheadB} of ${tried}`);
});

// THE RULE IN EXACT FRACTIONS, written apart from the writer (no code shared): a card holds a level k + f (k a rung's index,
// 0 ≤ f < 1, a fraction of BigInts), its interval L[k] + f × (L[k+1] − L[k]). A right answer before the due climbs the level at
// 1 ÷ L[k] a day, rung after rung, never more than one level; on or after the due, one level; a miss, level 0 and 1 day. The
// due is the first whole day at or after the exact one, never sooner than the row's.
const gcd = (a, b) => { a = a < 0n ? -a : a; while (b) [a, b] = [b, a % b]; return a; };
const Q = (n, d = 1n) => { const g = gcd(n, d) || 1n; return d < 0n ? { n: -n / g, d: -d / g } : { n: n / g, d: d / g }; };
const add = (a, b) => Q(a.n * b.d + b.n * a.d, a.d * b.d), sub = (a, b) => Q(a.n * b.d - b.n * a.d, a.d * b.d), mul = (a, b) => Q(a.n * b.n, a.d * b.d);
const div = (a, b) => Q(a.n * b.d, a.d * b.n), lt = (a, b) => a.n * b.d < b.n * a.d, ceilQ = (a) => (a.n >= 0n ? (a.n + a.d - 1n) / a.d : -((-a.n) / a.d));
const LB = L.map((x) => Q(BigInt(x))), TOP = L.length - 1;
const ivlQ = (k, f) => (k >= TOP ? LB[TOP] : add(LB[k], mul(f, sub(LB[k + 1], LB[k]))));
function levelOfQ(x) { const X = Q(BigInt(x)); if (!lt(X, LB[TOP])) return { k: TOP, f: Q(0n) }; let k = 0; while (!lt(X, LB[k + 1])) k++; return { k, f: div(sub(X, LB[k]), sub(LB[k + 1], LB[k])) }; }
function answerQ(s, ok, day) {
  const d = BigInt(Math.max(day, Number(s.last)));
  if (!ok) return { k: 0, f: Q(0n), last: d, due: d + 1n };
  let k = s.k, f = s.f;
  if (d >= s.due) { if (k < TOP) k++; }
  else {
    let rem = Q(d - s.last);
    while (rem.n > 0n && k < TOP) { const dist = mul(sub(Q(1n), f), LB[k]); if (lt(rem, dist)) { f = add(f, div(rem, LB[k])); rem = Q(0n); } else { rem = sub(rem, dist); k++; f = Q(0n); } }
    if (k >= TOP) f = Q(0n);
    if (k > s.k + 1 || (k === s.k + 1 && lt(s.f, f))) { k = Math.min(TOP, s.k + 1); f = k >= TOP ? Q(0n) : s.f; }   // one level at most
  }
  const due = ceilQ(add(Q(d), ivlQ(k, f)));
  return { k, f, last: d, due: due > s.due ? due : s.due };
}

test("every due the writer sets is the rule's in exact fractions (so the 1e-6 tolerance only ever reads float dust)", () => {
  const rnd = lcg(13);
  let answers = 0, differ = 0, dust = 0, ex = null;
  for (const x of [1, 2, 3, 5, 7, 10, 14, 20, 30, 42, 45, 59, 60, 75, 89, 90, 100, 120, 150, 180, 241, 300, 365, 500, 730, 1000, 1461, 2000, 2922]) for (let q = 0; q < 250; q++) {
    let r = [10000 + x, cell(x), 10000], s = { ...levelOfQ(x), last: 10000n, due: BigInt(10000 + x) };
    for (let i = 0, n = 1 + Math.floor(rnd() * 9); i < n; i++) {
      const u = rnd(), miss = rnd() < 0.04, same = rnd() < 0.05;
      const d = same ? r[2] : r[2] + Math.max(1, Math.floor((r[0] - r[2]) * (0.05 + u * 1.45)));
      r = W(r, !miss, d); s = answerQ(s, !miss, d); answers++;
      if (BigInt(r[0]) !== s.due) { differ++; if (!ex) ex = { r, due: s.due.toString() }; }
      const e = exactDue(r); if (Math.abs(e - Math.round(e)) < 1e-6 && !Number.isInteger(e)) dust++;
    }
  }
  assert.ok(answers > 30000, `${answers} answers`);
  assert.equal(differ, 0, `dues off the exact rule's: ${JSON.stringify(ex)}`);
  // float dust exists (a whole day computed a hair over or under) and is read as the whole day it is
  assert.ok(dust > 0, `${dust} dues computed within 1e-6 of a whole day, every one the exact rule's`);
  console.log(`exact fractions: ${answers} answers, ${differ} dues differ, ${dust} computed within 1e-6 of a whole day`);
});

test("a day later never earns less, and no cliff, on rows of every client", () => {
  // rows the writer makes, rows v1.281.0 made (off the rungs), and rows the older clients made
  const rnd = lcg(31), pop = [];
  for (const write of [W, lin1.write, prev.write, oldWrite]) for (const I of [1, 3, 7, 14, 20, 30, 42, 60, 75, 90, 120, 241, 365, 730]) for (let q = 0; q < 12; q++) {
    let r = [10000 + I, cell(I), 10000];
    for (let k = 0, n = 1 + Math.floor(rnd() * 4); k < n; k++) { r = write(r, rnd() > 0.05, r[2] + Math.max(1, Math.floor((r[0] - r[2]) * (0.05 + rnd() * 1.4)))); pop.push(r); }
  }
  let checked = 0, cliffs = 0, states = 0;
  for (const r of pop) {
    let prevDue = -Infinity, prevIvl = -Infinity;
    for (let d = r[2]; d <= r[0] + 30; d++) {
      const n = W(r, true, d), iv = K.ngKnowledgeInterval(n);
      assert.ok(n[0] >= prevDue, `${r}: answered on ${d} is due ${n[0]}, a day earlier ${prevDue}`);
      assert.ok(iv >= prevIvl - 1e-9, `${r}: answered on ${d} earns ${iv}, a day earlier ${prevIvl}`);
      prevDue = n[0]; prevIvl = iv; checked++;
    }
    // no cliff: a day before the due earns at least half of what the due day earns
    const I = K.ngKnowledgeInterval(r);
    if (r[0] - 1 > r[2]) {
      states++;
      const before = K.ngKnowledgeInterval(W(r, true, r[0] - 1)) - I, on = K.ngKnowledgeInterval(W(r, true, r[0])) - I;
      if (before < on / 2) cliffs++;
    }
  }
  assert.ok(checked > 50000 && states > 1000, `${checked} answers, ${states} states`);
  assert.equal(cliffs, 0, "a day before the due earns under half the due day's credit");
  console.log(`a day later: ${checked} answers on ${pop.length} rows of four clients; no cliff in ${states} states`);
});

test("the rows v1.281.0 wrote are never made due sooner: answered by v1.281.3 on every day, and through mixed-writer histories and the merges", () => {
  // (1) v1.281.0's own rows (anchors off the rungs among them), each answered right by v1.281.3 on every day from its last to two
  // intervals past its due: never sooner than the row; and both read the same interval
  const rnd = lcg(41), built = [];
  for (const I of [1, 3, 7, 14, 20, 30, 42, 60, 75, 90, 120, 180, 241, 365]) for (let q = 0; q < 25; q++) {
    let r = [10000 + I, cell(I), 10000];
    for (let k = 0, n = 1 + Math.floor(rnd() * 5); k < n; k++) { r = lin1.write(r, rnd() > 0.05, r[2] + Math.max(1, Math.floor((r[0] - r[2]) * (0.05 + rnd() * 1.4)))); built.push(r); }
  }
  let answers = 0;
  for (const r of built) {
    assert.equal(K.ngKnowledgeInterval(r), lin1.interval(r), `${r}: read the same`);
    const I = r[0] - r[2];
    for (let d = r[2]; d <= r[0] + 2 * I; d += Math.max(1, Math.floor(I / 40))) { assert.ok(W(r, true, d)[0] >= r[0], `${r} answered on ${d}`); answers++; }
  }
  assert.ok(answers > 20000, `${answers} answers on v1.281.0's rows`);
  // (2) mixed writers (the reader's mixed-writer search, written fresh): one card on one to three devices, each answering with its own client
  // (v1.281.3, v1.281.0, v1.280.2, v1.278.2) and pulling the cloud's row through its own merge; v1.281.3's right answers are
  // never sooner than the row before them, and its merges never below both rows they merge
  const clients = { now: { write: W, merge: K.ngKnowledgeMergeRow }, lin1: { write: lin1.write, merge: lin1.merge }, prev: { write: prev.write, merge: prev.merge }, old: { write: oldWrite, merge: null } };
  const names = Object.keys(clients), r2 = lcg(3);
  const stat = { right: 0, sooner: 0, merges: 0, belowBoth: 0 };
  for (let k = 0; k < 20000; k++) {
    const nd = 1 + Math.floor(r2() * 3), devs = Array.from({ length: nd }, () => ({ c: names[Math.floor(r2() * names.length)], row: null }));
    let day = 1000;
    const I0 = [1, 3, 7, 14, 30, 60, 120][Math.floor(r2() * 7)], start = [1000 + I0, I0, 1000];
    for (const d of devs) d.row = start.slice();
    let cloud = start.slice();
    for (let s = 0; s < 12; s++) {
      const d = devs[Math.floor(r2() * nd)], c = clients[d.c];
      day += Math.floor(r2() * 40);
      if (r2() < 0.6 && c.merge) { const m = c.merge(d.row.slice(), cloud.slice(), day); if (d.c === "now") { stat.merges++; if (m[0] < Math.min(d.row[0], cloud[0])) stat.belowBoth++; } d.row = m; }
      const ok = r2() < 0.85, after = c.write(d.row, ok, day);
      if (ok && d.c === "now") { stat.right++; if (after[0] < d.row[0]) stat.sooner++; }
      d.row = after;
      if (r2() < 0.7) cloud = d.row.slice();
    }
  }
  assert.ok(stat.right > 20000 && stat.merges > 15000, JSON.stringify(stat));
  assert.deepEqual([stat.sooner, stat.belowBoth], [0, 0], "v1.281.3 on mixed histories: never sooner, no merge below both");
  // (3) the moves merge, v1.281.3's against v1.281.0's rows and back: the merged due never below both
  let mm = 0, mbad = 0;
  const mv = (r) => r.slice(0, 3).concat(1, r.slice(3));
  for (let i = 0; i + 1 < built.length; i += 2) for (const [a, b] of [[built[i], W(built[i + 1], true, built[i + 1][0])], [W(built[i], true, built[i][2] + 1), built[i + 1]]]) {
    for (const today of [Math.max(a[2], b[2]), Math.max(a[2], b[2]) + 30]) {
      const m = ngProgressMergeMoves({ s: { m: mv(a) } }, { s: { m: mv(b) } }, today).s.m, m1 = lin1MergeMoves({ s: { m: mv(a) } }, { s: { m: mv(b) } }, today).s.m;
      mm++; if (m[0] < Math.min(a[0], b[0])) mbad++;
      assert.ok(m1[0] >= Math.min(a[0], b[0]), "v1.281.0's moves merge as well");
    }
  }
  assert.ok(mm > 1000, `${mm} moves merges`);
  assert.equal(mbad, 0, "the moves merge: never below both rows");
  console.log(`v1.281.0 rows: ${built.length}, ${answers} answers on them; mixed: ${JSON.stringify(stat)}; moves merges ${mm}, ${mbad} below both`);
});

// A PAIR DAY BELOW 0 IS NEVER STORED (LIN2-R1, the reader of PR #426's finding 1): every client's blob validator takes only
// numbers at or above 0. A rung pair's day lies before the card's last answer, by up to its rung's interval, so on a small
// epoch day (a clock before about 1975 after a pull's clamp, a damaged row) it could fall below 0 and make the whole blob
// invalid: that device would then save nothing more. Such a row is written without its pair, and reads its interval from due
// and last (at most a day longer, never shorter)
const memory = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
const blobOf = (row, at) => (at > 3 ? { v: 2, moves: { s: { m: row } } } : { v: 2, srs: { d: { q: row } } });
const valid = (validate, blob) => { try { validate(blob); return true; } catch { return false; } };

test("every row the writer emits passes the blob validator: this client's, v1.280.4's and production's (LIN2-R1)", () => {
  const rnd = lcg(19), top = L[L.length - 1];
  let emitted = 0, dated = 0, realDayDated = 0;
  for (const T of [0, 3, 40, 1000, 10000, 20400]) for (const I of [1, 3, 7, 14, 20, 30, 42, 60, 75, 120, 241, 365, 1461, 2922, 5844, 20000, 1e5, top - 1, top, 2 * top]) {
    const starts = [[T + I, cell(I), T], [T + I + 0.4, cell(I), T], [T + Math.ceil(I / 3), cell(I), T], [T + I, 120, T], [T + I, 1, T]];
    if (I >= 2) starts.push(lin1.write([T + I, cell(I), T], true, T + Math.floor(I / 2)));   // a v1.281.0 row, its pair off the rungs
    for (const A of [I, 1.3 * I, L.find((x) => x >= I) || top]) for (const back of [0, 1, Math.floor(I / 2), I + 5]) if (T - back >= 0) starts.push([T + I, cell(I), T, A, T - back]);   // odd pairs
    for (const s0 of starts) for (const at of [3, 4]) {
      let r = at > 3 ? s0.slice(0, 3).concat(1, s0.slice(3)) : s0;
      for (let k = 0; k < 5; k++) {
        const iv = Math.max(1, r[0] - r[2]), d = r[2] + [0, 1, Math.floor(iv / 3), Math.floor(iv) - 1, Math.floor(iv), Math.floor(iv) + 9][Math.floor(rnd() * 6)];
        const ok = rnd() > 0.08, n = W(r, ok, d, at);
        for (const [name, validate] of Object.entries(validators)) assert.ok(valid(validate, blobOf(n, at)), `${name}'s validator rejects ${JSON.stringify(n)} (${at > 3 ? "moves" : "srs"}), from ${JSON.stringify(r)} on ${d}`);
        // the rows the fallback touched: an early answer storing its exact interval dated on its own day (a pair off the rungs at
        // its last), read exactly; at today's epoch day only past 43,776 days
        const pa = at > 3 ? 4 : 3;
        if (ok && d > r[2] && d < r[0] && n.length > pa + 1 && n[pa + 1] === n[2] && !L.includes(n[pa]) && n[0] > r[0]) {
          dated++;
          assert.equal(K.ngKnowledgeInterval(n, at), K.ngKnowledgeNextInterval(r, d, at), `${JSON.stringify(n)}: read exactly`);
          if (T === 20400 && K.ngKnowledgeInterval(n, at) < 43776) realDayDated++;
        }
        r = n; emitted++;
      }
    }
  }
  assert.ok(emitted > 15000 && dated > 50, `${emitted} rows emitted, ${dated} dated on their own day`);
  assert.equal(realDayDated, 0, "at epoch day 20,400 no card under 43,776 days falls back");
  console.log(`validators: ${emitted} emitted rows, all valid under this client, v1.280.4 and production; ${dated} early answers stored their exact interval at their own day`);
});

test("the rows whose rung pair would be dated before 1970 store their exact interval at their own day, and keep every claim (LIN2-R2)", () => {
  // the cards it touches: on a rung above the epoch day, at small days (a wrong clock, a pull's clamp). Counted where it shows,
  // a pair off the rungs dated on the answer's own day (whole intervals store no pair, and read as exactly); every interval read
  // is the exact one, and never sooner, a day later never earns less, one more early answer never costs
  let answers = 0, extra = 0, touched = 0;
  for (const T of [0, 3, 40, 400]) for (const I of [20, 75, 200, 1000, 2000, 5844, 20000, 1e5]) {
    const s = [T + I, cell(I), T];
    for (const first of [T + 1, T + Math.floor(I / 3), T + I - 1]) {
      const r = W(s, true, first);
      if (r.length === 5 && r[4] === r[2] && !L.includes(r[3])) touched++;
      assert.equal(K.ngKnowledgeInterval(r), K.ngKnowledgeNextInterval(s, first), `${JSON.stringify(r)}: the exact interval`);
      let prevDue = -Infinity, prevIvl = -Infinity;
      for (let d = r[2]; d <= r[0] + 30; d += Math.max(1, Math.floor((r[0] - r[2]) / 200))) {
        const n = W(r, true, d), iv = K.ngKnowledgeInterval(n);
        assert.equal(iv, K.ngKnowledgeNextInterval(r, d), `${r} on ${d}: read exactly`);
        assert.ok(n[0] >= r[0], `${r} on ${d}: due ${n[0]}, sooner`);
        assert.ok(n[0] >= prevDue && iv >= prevIvl - 1e-9, `${r} on ${d}: a day later earns less`);
        prevDue = n[0]; prevIvl = iv; answers++;
        // one more early answer on the way, then this one: never behind
        const e = r[2] + Math.max(1, Math.floor((d - r[2]) / 2));
        if (e < d && e < r[0]) { assert.ok(W(W(r, true, e), true, d)[0] >= n[0], `${r}: one more early answer on ${e} costs by ${d}`); extra++; }
      }
    }
  }
  assert.ok(touched >= 15 && answers > 5000 && extra > 4000, `${touched} rows touched, ${answers} answers, ${extra} with one more`);
  console.log(`rows dated on their own day: ${touched} touched, ${answers} answers read exactly, never sooner and never less a day later, ${extra} with one more early answer never behind`);
});

test("answered every day from epoch day 0 (a clock in 1970): every run ends where one on-time answer does (LIN2-R2)", () => {
  // the reader of PR #426's re-read: with LIN2-R1's fallback (the pair dropped, a day longer at most per answer) 953 of 2,921
  // daily runs from day 0 ended on another due day, a 731-day card 364 days late. Dated on its own day, the exact interval
  // goes on exactly: the same due day, cell and last day, and interval to 1e-9, for every interval from 1 to 2,921 days
  let off = 0;
  for (let I = 1; I <= 2921; I++) {
    let row = [I, cell(I), 0];
    const onTime = W(row, true, I);
    for (let d = 1; d <= I; d++) row = W(row, true, d);
    if (row[0] !== onTime[0] || row[1] !== onTime[1] || row[2] !== onTime[2] || Math.abs(K.ngKnowledgeInterval(row) - K.ngKnowledgeInterval(onTime)) > 1e-9) off++;
  }
  assert.equal(off, 0, "daily runs from epoch day 0 that do not end where one on-time answer does");
});

test("the reader's wrong clock: pull, clamp, answer, validate, save (LIN2-R1)", () => {
  // a device whose clock reads epoch day 3 (4 Jan 1970) pulls the cloud's row: the pull's clamp makes it a card of 20,427 days
  const pulled = K.ngKnowledgeMergeRow(undefined, [20430, 30, 20400], 3);
  assert.deepEqual(pulled, [20430, 30, 3]);
  const a = W(pulled, true, 4), b = W(a, true, 5);
  // its rung pair would be dated before 1970 (20,427 days stands 8,740 days up the 11,688-day rung: day 4 − 8,740), and its
  // interval is whole: no pair, and due − last is exactly the interval
  assert.deepEqual([a, b], [[20432, 120, 4], [20434, 120, 5]]);
  // where the interval is not whole, it is stored at its own day: a 71-day card at epoch day 20 (on the 60-day rung, 22 days up)
  // answered on day 21 has 71.5 days, dated on day 21
  assert.deepEqual(W([91, 60, 20], true, 21), [93, 60, 21, 71.5, 21]);
  const m = W(W(pulled.concat(1), true, 4, 4), true, 5, 4);
  assert.deepEqual(m, [20434, 120, 5, 1]);
  const blob = { v: 2, srs: { d: { q: b } }, moves: { s: { m } } };
  for (const [name, validate] of Object.entries(validators)) assert.ok(valid(validate, blob), `${name}'s validator`);
  // and it saves: the store takes it (v1.281.3 at a2efd246b wrote [20432,120,4,11688,-8736], which the same store refuses)
  const store = ngProgressCreateStore(memory()), owner = ngProgressOwner();
  assert.equal(store.write(owner, blob).status, "saved");
  assert.deepEqual(store.write(owner, { v: 2, srs: { d: { q: [20432, 120, 4, 11688, -8736] } } }), { status: "unavailable", reason: "unsupported-progress" });
});
