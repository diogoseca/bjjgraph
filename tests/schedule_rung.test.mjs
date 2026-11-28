// THE CARD'S LINE IS ITS RUNG'S (v1.281.3, LIN2, ruled after the independent reader's read of PR #421) — neural/src/
// knowledge-profile.src.js (`ngKnowledgeOnRung`, `ngKnowledgeRungState`, `ngKnowledgeNext`, `ngKnowledgeEarly`).
//
// THE RULE, in one sentence a player could read: a card climbs its step at a steady pace: each day you waited before
// answering right earns the same share of the step, whenever you answer. It is the owner's formula (U188) with the ratio of
// the STEP THE CARD IS IN at every answer: a card between rungs r < x < next stands on r's line, (x − r) × r ÷ (next − r)
// days into r's step, and climbs it at (next − r) ÷ r days a day, rung after rung. On time or late it takes his late rule's
// interval (LATE1 and LATE2, below): on the due day exactly one step, after it more. As a level: a real number
// climbing 1 ÷ (its rung's interval) a day, at most one level per EARLY answer.
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
// THE LATE ANSWER (v1.305.0; LATE1, the owner, 25 and 26 Nov 2026; its final form LATE2, 28 Nov 2026, U226 a): a right answer
// on or after the due earns max(one step, t × min(step ÷ I, C(t) ÷ t)), t the days since the last answer, C(t) ÷ t = 2 up to 4
// years and the fitted curve's past them; on the due day exactly one step. The ladder past 2,922 days is the curve's too. The
// early formula is untouched (byte for byte the one-step client's below 4 years and the one-step schedule's on his ladder
// everywhere, pinned in tests/schedule_late.test.mjs), but the claims here compare HISTORIES, and a history's late answers
// now earn more. So each search counts its comparisons on two sides with the captured one-step schedule on his ladder
// (tests/_onestep_client.mjs, `late`): where the late rule decided no answer of either history, the two histories are the
// one-step schedule's row for row and its claim is asserted exactly as it was (0 sooner, 0 behind, 0 ahead in exact days);
// where it decided one, the numbers are measured and pinned. THE ONE PROPERTY IT TAKES: the late rule counts the wait from the
// LAST answer, so an extra early answer restarts it, and a card answered early once more can come due SOONER after a later late
// answer than the card without it (in the extra-answer search, 234,909 of 799,356 such comparisons; LATE1's first form,
// 228,947 of 801,955; the early answer itself still never makes a card due sooner, and never costs a step). On the due day
// the late rule is one step, so it is never an answer on the due day that the restart costs (LATE1's first form cost the
// 60-day card 30 days there, tests/schedule_linear.test.mjs: gone).
//
// THE CLAIMS PINNED HERE, each over the reader's own searches replayed (its seeds, starts and loops, written fresh here):
//   · an early right answer never leaves a card due sooner than without it on the histories the late rule never decided
//     (LIN1-R3's N1 is gone: 0 of 331,178 and 0 of 79,917; until v1.304.0 0 of 1,113,790 and 0 of 509,533, every history),
//     and from rows v1.281.0 wrote, off the rungs, one early answer then the next on any day is never behind there (0 of
//     4,245); where it decided an answer, as measured above;
//   · ahead of answering on time ONLY BY WHOLE DAYS, never in exact days: the on-time path answers on whole due days and
//     restarts there (LIN1-R2's D1: (a) at most 3 days in the reader's early-only search against the one-step on-time path, 839
//     of 566,832 prefixes, and 1 day against the shipped one, 763; (b) 0 of 40,536 where the late rule decides neither side,
//     160 ahead by 14 at most where it does: a late answer paid more than the on-time path's step). Not a general bound: it
//     adds up by about a day per on-time answer as a card ages
//     (the reader of PR #426's 5-day case, two years in, pinned beside it);
//   · every due the writer sets is the rule's in exact fractions, the late rule included (its model below, LATE2's form);
//   · a day later never earns less, on rows of every client; no cliff before the due: a day before it earns half the due
//     day's one step, and half the due day's credit everywhere (no upward jump at the due: 0 of the 246 due days the late rule
//     decides, where LATE1's first form jumped on 51 of 465);
//   · the rows v1.281.0 wrote are never made due sooner, through mixed-writer histories and the merges;
//   · every row the writer emits passes the blob validator, this client's and the older clients' (v1.280.4, production
//     v1.252.0, captured in tests/artifacts/progress_validators.json): a pair day below 0 is never stored (LIN2-R1); such a row
//     stores its exact interval dated on its own day, so every claim above holds on it too, from epoch day 0 (LIN2-R2), and a
//     daily run there ends where one on-time answer of the one-step schedule on his ladder does, and of the shipped writer
//     (LATE1's first form was later from 31 to 89 days).
// His formula on every rung, never sooner and the rest stay in tests/schedule_linear.test.mjs and tests/schedule_ladder.test.mjs.
//
// THE v1.281.0 CLIENT is captured from git (never re-typed) in tests/artifacts/schedule_lin1_client.json
// (tests/artifacts/_capture_lin1_schedule.mjs), the one-step client (v1.304.0) in tests/artifacts/schedule_onestep_client.json
// (tests/artifacts/_capture_onestep_schedule.mjs).
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
import { onestep, onestepNow, late, schedulePart } from "./_onestep_client.mjs";
// the worst cases below pin SCHEDULES (`schedulePart`: the head and the pair); a stretched row also carries v1.305.0's late
// mark after the pair's slot, pinned in tests/schedule_late_mark.test.mjs
const sp = (r) => schedulePart(r);

const W = K.ngKnowledgeScheduleRow, L = K.NG_KNOWLEDGE_LADDER, cell = K.ngKnowledgeCell;
const json = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const LIN1 = json("./artifacts/schedule_lin1_client.json"), PREV = json("./artifacts/schedule_prev_client.json"), OLD = json("./artifacts/schedule_old_client.json");
const lin1 = new Function(LIN1.knowledge.ladder + "\n" + LIN1.knowledge.schedule + "\nreturn { write: ngKnowledgeScheduleRow, merge: ngKnowledgeMergeRow, interval: ngKnowledgeInterval };")();
const lin1MergeMoves = new Function(LIN1.owner.mergeMoves + "\nreturn ngProgressMergeMoves;")();
const prev = new Function(PREV.knowledge.ladder + "\n" + PREV.knowledge.schedule + "\nreturn { write: ngKnowledgeScheduleRow, merge: ngKnowledgeMergeRow };")();
const oldWrite = new Function(OLD.knowledge.intervals + "\n" + OLD.knowledge.scheduleRow + "\nreturn ngKnowledgeScheduleRow;")();
const VALIDATORS = json("./artifacts/progress_validators.json").clients;
const validators = { now: ngProgressValidateBlob, ...Object.fromEntries(Object.entries(VALIDATORS).map(([k, v]) => [k, new Function(v.validator + "\nreturn ngProgressValidateBlob;")()])) };
const rows = (row, days, write = W) => days.map((d) => (row = write(row, true, d)));
const exactDue = (r) => r[2] + K.ngKnowledgeInterval(r);
const lcg = (s) => () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
// a history of right answers with, at each answer, whether the late rule (LATE1, LATE2) decided it or any answer before it: a
// history it never decided is, row for row, the one-step schedule's on his ladder (tests/_onestep_client.mjs, `onestepNow`)
// (an answer before its row's due takes the early branch, which is the one-step schedule's byte for byte — pinned in
// tests/schedule_late.test.mjs — so only an answer on or after the due is asked)
const track = (start, days) => { const out = []; let r = start, dbl = false; for (const d of days) { if (!dbl && d >= r[0] && late(r, d)) dbl = true; r = W(r, true, d); out.push({ r, dbl }); } return out; };

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
  // on its due (LATE2, v1.305.0): exactly one step, 135 days, anchored at its day, as until v1.304.0 (LATE1's first form paid
  // twice the 75 days waited, 150, there); a day before it, the early line's 134 is untouched
  assert.deepEqual(W([D + 75, 60, D], true, D + 75), [D + 75 + 135, 120, D + 75], "on its due: one step, 135 days, anchored at its day");
  assert.deepEqual(onestep.write([D + 75, 60, D], true, D + 75), [D + 75 + 135, 120, D + 75], "the one-step client: exactly one step, 135 days");
  // the two lines agree at the due: one step from 75 is 135 either way
  assert.equal(lin1.write([D + 75, 60, D], true, D + 75)[0], D + 75 + 135);
  // THE ONE-STEP CAP binds only at and past the top (655,856 days since LATE2, where a step is the top): (1) an early answer that walks
  // onto the top rung takes the top, stored at its own day with no pair; (2) a row past the top with a fractional due (no
  // writer makes one: the pull truncates a cloud row's due), answered with no day waited, is capped to the top and kept as it
  // was by the never-sooner guard. Below the top an early answer never reaches the cap
  const top = L[L.length - 1], sec = L[L.length - 2];
  const w = Math.floor(sec / 2), half = W([D + sec, 120, D], true, D + w), d = D + sec + 10;
  assert.deepEqual(half, [K.ngKnowledgeDueDay(D + w + K.ngKnowledgeLinear(sec, w)), 120, D + w, sec, D], "premise: half-way up the second-to-top rung's line");
  assert.deepEqual(W(half, true, d), [d + top, 120, d], "onto the top: the top, at its own day");
  const past = [D + top + 0.4, 120, D];
  assert.deepEqual([W(past, true, D), W(past, true, D - 30)], [past, past], "past the top, no day waited: kept as it was");
});

test("an early right answer never leaves a card due sooner than without it on every history the late rule never decided: the reader's searches replayed (LATE1, LATE2)", () => {
  // (1) the reader's long extra-answer search: base histories of right answers, each with ONE more right answer added in a
  // gap, early when given, compared after every later answer of the base
  const T = 10000, starts = [];
  for (let i = 0; i < 12; i++) starts.push({ kind: "rung", row: [T + L[i], cell(L[i]), T] });
  for (const iv of [2, 5, 10, 20, 42, 45, 59, 75, 89, 100, 120, 150, 241, 300, 500, 1000, 2000]) starts.push({ kind: "dev", row: [T + iv, cell(iv), T] });
  starts.push({ kind: "head", row: W([T + 120, 120, T], true, T + 120) });
  for (let i = 2; i < 11; i++) starts.push({ kind: "mid", row: W([T + L[i], cell(L[i]), T], true, T + Math.floor(L[i] * 0.4)) });
  const rnd = lcg(77);
  // each comparison is counted on its side: UNTOUCHED when the late rule decided no answer of either history up to it (then
  // both are the one-step schedule's histories, row for row, and its claim holds exactly), DECIDED otherwise
  let inserted = 0, compared = 0, sooner = 0, decided = 0, soonerDecided = 0, worst = null;
  const search = (st, ds) => {
    const base = track(st.row, ds), from = [st.row[2], ...ds];
    for (let g = 0; g < ds.length; g++) {
      const lo = from[g], hi = ds[g], prior = g ? base[g - 1].r : st.row, span = hi - lo - 1;
      if (span < 1) continue;
      for (let t = 0, n = Math.min(span, 12); t < n; t++) {
        const e = lo + 1 + Math.floor(((t + rnd()) / n) * span);
        if (!(e > lo && e < hi && e < prior[0])) continue;   // early: before the due of the row it answers
        inserted++;
        const days = [...ds.slice(0, g), e, ...ds.slice(g)], ext = track(st.row, days);
        for (let k = g; k < ds.length; k++) {
          compared++;
          const by = base[k].r[0] - ext[k + 1].r[0];
          if (!ext[k + 1].dbl && !base[k].dbl) { if (by > 0) sooner++; continue; }
          decided++;
          if (by > 0) { soonerDecided++; if (!worst || by > worst.by) worst = { by, start: st.row, days: days.slice(0, k + 2), base: base[k].r, ext: ext[k + 1].r }; }
        }
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
  // the one-step schedule's claim, on every history the late rule never decided (until v1.304.0: 427,680 inserted, 1,113,790
  // compared, 0 sooner; LATE1's first form 434,218 and 329,039; the histories differ because their late answers earn more)
  assert.deepEqual([inserted, compared - decided, sooner], [433348, 331178, 0], "the reader's search replayed, the histories the late rule never decided: never sooner");
  // THE LATE RULE COUNTS THE WAIT FROM THE LAST ANSWER (the owner's rule: "elapsed time in days is doubled"), so an extra early
  // answer restarts the wait a later late answer is paid for: on the histories it decided, the card with the extra answer is
  // due sooner in 234,909 of 799,356 comparisons (LATE1's first form: 228,947 of 801,955). Never by the step: on those
  // histories alone it is never sooner (above). The worst is the search's latest history: a 2,922-day card answered 1.5 to 2
  // times its interval late five times over; the extra answer leaves it due 33,897 days (93 years) before the card without it,
  // at an interval of 175,371 days (LATE1's first form: 74,553 days at 408,482)
  assert.deepEqual([decided, soonerDecided], [799356, 234909], "the histories the late rule decided: sooner, as measured");
  assert.deepEqual({ ...worst, base: sp(worst.base), ext: sp(worst.ext) }, { by: 33897, start: [12922, 120, 10000], days: [14213, 25676, 50024, 102918, 141510, 221431], base: [396803, 120, 221431, 175371.2992267848, 221431], ext: [362906, 120, 221431, 109393, 155567.24408718504] });
  // (2) the reader's exhaustive two-answer search: two base answers b1 < b2, one extra early answer before b1 or
  // between them, over a grid of days from rung starts and dev rows
  let n2 = 0, bad2 = 0, dec2 = 0, bad2Decided = 0, worst2 = null;
  for (const s of [...L.slice(0, 10).map((x) => [x, cell(x), 0]), ...[5, 20, 42, 75, 100, 120, 241, 500, 2000].map((x) => [x, cell(x), 0])]) {
    const I = s[0], st = Math.max(1, Math.floor(I / 15));
    for (let b1 = 1; b1 <= 2 * I; b1 += st) {
      const r1 = W(s, true, b1);
      for (let b2 = b1 + 1; b2 <= b1 + 2 * (r1[0] - r1[2]); b2 += Math.max(1, Math.floor((r1[0] - r1[2]) / 15))) {
        const wo = track(s, [b1, b2])[1], without = wo.r[0];
        for (let e = 1; e < b2; e += st) {
          if (e === b1) continue;
          const prior = e < b1 ? s : r1; if (e >= prior[0]) continue;
          n2++;
          const days = e < b1 ? [e, b1, b2] : [b1, e, b2], w = track(s, days)[2], by = without - w.r[0];
          if (!wo.dbl && !w.dbl) { if (by > 0) bad2++; continue; }
          dec2++;
          if (by > 0) { bad2Decided++; if (!worst2 || by > worst2.by) worst2 = { by, start: s, days, without: wo.r, with: w.r }; }
        }
      }
    }
  }
  // (until v1.304.0: 509,533 tried, 0 sooner; LATE1's first form 606,486 and 79,694)
  assert.deepEqual([n2, n2 - dec2, bad2], [596205, 79917, 0], "the reader's two-answer search replayed, the histories the late rule never decided: never sooner");
  // and where it decided an answer: sooner in 341,836 of 516,288, at worst a 2,000-day card answered 3,991 then 8,114 days in
  // (late both times) and once more on day 18,662: with an extra early answer between the two last it is due 6,469 days
  // sooner (LATE1's first form: 336,998 of 526,792, at worst 7,979 days)
  assert.deepEqual([dec2, bad2Decided], [516288, 341836], "the histories the late rule decided: sooner, as measured");
  assert.deepEqual({ ...worst2, without: sp(worst2.without), with: sp(worst2.with) }, { by: 6469, start: [2000, 120, 0], days: [3991, 8114, 18662], without: [43281, 120, 18662, 24618.158826784726, 18662], with: [36812, 120, 18662, 17179, 17197.99308490204] });
  // the case v1.281.0 lost (LIN1-R3): a 30-day card answered on days 12, 56 and 86, and the same with one more on day 19. Under
  // v1.281.0: 181 and 174; under the one-step client (v1.281.3 to v1.304.0) 173 and 174, the card with the extra answer never
  // behind
  const D = 20400, on = (xs) => xs.map((x) => D + x);
  const without = rows([D + 30, 30, D], on([12, 56, 86])), withE = rows([D + 30, 30, D], on([12, 19, 56, 86]));
  assert.equal(lin1.write(lin1.write(lin1.write([D + 30, 30, D], true, D + 12), true, D + 56), true, D + 86)[0], D + 181, "v1.281.0: 181, and 174 with day 19");
  assert.deepEqual(rows([D + 30, 30, D], on([12, 56, 86]), onestep.write), [[D + 54, 30, D + 12, 30, D], [D + 128, 60, D + 56], [D + 173, 60, D + 86, 60, D + 32]], "the one-step client: day 56 one step from 42 to 72");
  // LATE2: day 56 is late, 44 days after the answer on day 12, on a card at 42 days whose step is 72 (×1.71): the step's own
  // multiple of the 44 days, 75.43, beats one step, at its own day; day 86 early: 75.43 stands on the 60-day rung's line and
  // climbs to 90.86 (LATE1's first form: twice the 44 days, 88, then 116)
  // (each stretched row carries its late mark, v1.305.0: the one-step client's interval for the same answers, 72 then 87)
  assert.deepEqual(without, [[D + 54, 30, D + 12, 30, D], [D + 132, 60, D + 56, (44 * 72) / 42, D + 56, 72, (44 * 72) / 42], [D + 177, 60, D + 86, 90, 20485.14285714286, 87, 90.8571428571413]]);
  assert.deepEqual(without.slice(1).map((r) => K.ngKnowledgeMark(r)), rows([D + 30, 30, D], on([12, 56, 86]), onestep.write).slice(1).map((r) => onestep.interval(r)), "the marks are the one-step client's intervals, row for row");
  // with day 19, day 56 is early and walks the card's first line (60 days from day 30), untouched by the late rule: the extra
  // answer restarted the wait day 56 would have been paid for, so this card is due 3 days sooner than the one without it
  // (LATE1's first form: 28 days)
  assert.deepEqual(withE, [[D + 54, 30, D + 12, 30, D], [D + 68, 30, D + 19, 30, D], [D + 129, 60, D + 56, 60, D + 30], [D + 174, 60, D + 86, 60, D + 30]]);
  // and v1.281.0's worst (a 75-day row, 39 days sooner with one more answer on +21): the one-step client 13936 without it and
  // 14005 with it; the shipped writer, both 14397 (its late answers, on rungs whose step doubles, earn twice the waits, and the
  // extra answer's restart is lost in them)
  const far = [15, 106, 173, 516, 1049, 2113].map((d) => T + d), start = [T + 75, 60, T];
  assert.deepEqual(rows(start, far, onestep.write).at(-1), [13936, 120, 12113, 1822.1916666666668, 12113], "the one-step client without it: due 13936 (v1.281.0: 14046)");
  assert.deepEqual(rows(start, [far[0], T + 21, ...far.slice(1)], onestep.write).at(-1), [14005, 120, 12113, 1891.1833333333334, 12113], "with it: 14005, later (v1.281.0: 14007, 39 days sooner)");
  // (their late marks, v1.305.0: the one-step client's intervals above, 1822.19 and 1891.18, so the rating reads each card as
  // the one-step client would)
  assert.deepEqual(rows(start, far).at(-1), [14397, 120, 12113, 1461, 11290, 1822.1916666666668, 2284], "the shipped writer, without it: due 14397");
  assert.deepEqual(rows(start, [far[0], T + 21, ...far.slice(1)]).at(-1), [14397, 120, 12113, 1461, 11290, 1891.1833333333334, 2284], "with it: the same due");
});

test("from rows v1.281.0 wrote (anchors off the rungs): one early answer, then the next on its old due, its own new due or any later day, is never behind unless the late rule decided the next (LATE1, LATE2)", () => {
  // rows v1.281.0's own writer leaves after mixed histories (early, on time, late), carrying pairs off the rungs
  const rnd = lcg(5), from = [];
  for (const I of [3, 7, 14, 20, 30, 42, 60, 75, 90, 120, 180, 241, 365]) for (let q = 0; q < 40; q++) {
    let r = [10000 + I, cell(I), 10000];
    for (let k = 0, n = 1 + Math.floor(rnd() * 4); k < n; k++) r = lin1.write(r, true, r[2] + Math.max(1, Math.floor((r[0] - r[2]) * (0.1 + rnd() * 1.3))));
    if (r.length >= 5 && r[4] < r[2] && !L.includes(r[3])) from.push(r);
  }
  assert.ok(from.length > 150, `${from.length} rows off the rungs`);
  let pairs = 0, behind = 0, decided = 0, behindDecided = 0, worst = null;
  for (const r of from) {
    const I = r[0] - r[2];
    for (let e = r[2] + 1; e < r[0]; e += Math.max(1, Math.floor(I / 12))) {
      const r1 = W(r, true, e);
      for (const d of new Set([r[0], r1[0], r[0] + 1, e + 1, Math.floor((e + r1[0]) / 2), r1[0] + Math.floor(I / 2)])) {
        if (d <= e) continue;
        pairs++;
        const by = W(r, true, d)[0] - W(r1, true, d)[0];
        // the early answer on e is never decided by the late rule; the next one, on d, may be on either history
        if (!late(r, d) && !late(r1, d)) { if (by > 0) behind++; continue; }
        decided++;
        if (by > 0) { behindDecided++; if (!worst || by > worst.by) worst = { by, row: r, e, d }; }
      }
    }
  }
  assert.ok(pairs > 5000 && pairs - decided > 3000, `${pairs} pairs, ${pairs - decided} the late rule never decided`);
  assert.equal(behind, 0, "one early answer then the next on any day, the late rule deciding neither: never behind");
  // where it decided the next answer, the early answer restarted the wait the late rule pays for (it counts from the last
  // answer), so the card answered early can come due sooner. At worst a v1.281.0 row of 3,964 days answered early 3 days before
  // its due, then 7,295 days later: 6,394 days sooner (LATE1's first form: 8,925 decided, 7,208 behind, at worst 7,922 days)
  assert.deepEqual([pairs, decided, behindDecided], [13015, 8770, 7062], "as measured: the late rule decided 8,770 of 13,015 pairs, 7,062 behind");
  assert.deepEqual(worst, { by: 6394, row: [17768, 120, 13804, 2349.6082, 12190], e: 17765, d: 25060 });
  console.log(`v1.281.0 rows off the rungs: ${from.length}; one early answer then the next: ${pairs} pairs, ${behind} behind; the late rule decided ${decided}, ${behindDecided} behind, worst ${JSON.stringify(worst)}`);
});

test("ahead of answering on time only by whole days, never in exact days: at most 3 in the reader's early-only search (839 of 566,832), 0 of 40,536 in its targeted one, 5 by two years (LATE1, LATE2: against both on-time paths)", () => {
  // the on-time path, answered by `write` (the shipped writer, or the one-step client's: LATE1), `dbl` once the late rule
  // decided one of its answers
  const onTimePath = (row, n, exact, write = W) => { const p = []; let r = row, dbl = false; for (let k = 0; k < n; k++) { const d = exact ? exactDue(r) : r[0]; if (!dbl && write === W && late(r, d)) dbl = true; r = write(r, true, d); p.push({ day: d, row: r, dbl }); } return p; };
  // (a) the reader's early-only search: runs of answers each before the row's due, against the on-time path from the
  // run's start answered on its whole due days, and against the same path answered at its EXACT dues
  const rnd = lcg(21), starts = [];
  for (let i = 0; i < 13; i++) starts.push([10000 + L[i], cell(L[i]), 10000]);
  for (const iv of [2, 5, 10, 20, 42, 45, 59, 75, 89, 100, 120, 150, 241, 300, 500, 1000, 2000]) starts.push([10000 + iv, cell(iv), 10000]);
  // (the runs are early only, so the late rule decides none of their answers: they are the one-step client's runs, row for
  // row below 4 years. Compared with the ONE-STEP on-time path they are exactly the comparisons of v1.281.3 to v1.304.0, and
  // every claim below holds as it did. The late rule moves the other side: the shipped on-time path, answered on whole due
  // days, so a fraction of a day late each time, which the late rule pays (LATE2: at the step's own rate; LATE1's first form
  // doubled the wait between 30 and 90 days), and the early runs are ahead of it in whole days at most a day, never in exact)
  let prefixes = 0, ahead = 0, days = 0, aheadExact = 0, worst = null, aheadNow = 0, daysNow = 0, aheadExactNow = 0, decidedNow = 0, worstNow = null;
  for (const st of starts) {
    const P = onTimePath(st, 40, false, onestep.write), X = onTimePath(st, 40, true, onestep.write), PN = onTimePath(st, 40, false), XN = onTimePath(st, 40, true);
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
        const kn = PN.findIndex((p) => p.day >= d);
        if (kn >= 0) {
          if (PN[kn].dbl) decidedNow++;
          if (r[0] > PN[kn].row[0]) { aheadNow++; if (r[0] - PN[kn].row[0] > daysNow) { daysNow = r[0] - PN[kn].row[0]; worstNow = { st, ds: ds.slice(), r, next: { day: PN[kn].day, row: PN[kn].row } }; } }
        }
        const jn = XN.findIndex((p) => p.day >= d);
        if (jn >= 0 && exactDue(r) > exactDue(XN[jn].row) + 1e-6) aheadExactNow++;
      }
    }
  }
  assert.equal(prefixes, 566832, "the reader's search, replayed");
  assert.ok(ahead <= 839 && days <= 3, `${ahead} prefixes ahead of the one-step on-time path in whole days, by at most ${days}`);
  assert.equal(aheadExact, 0, "never ahead of the one-step on-time path answered at its exact due");
  // against the shipped on-time path (164,780 of the prefixes meet it where the late rule has decided one of its answers):
  // 763 ahead, by 1 day at most, never in exact days (LATE1's first form: 603 of 285,156). The worst: a 1-day card answered early
  // on +1, +3, +8 and +18
  assert.deepEqual([aheadNow, daysNow, aheadExactNow, decidedNow], [763, 1, 0, 164780], "against the shipped on-time path");
  assert.deepEqual({ ...worstNow, r: sp(worstNow.r), next: { ...worstNow.next, row: sp(worstNow.next.row) } }, { st: [10002, 1, 10000], ds: [10001, 10003, 10008, 10018], r: [10041, 14, 10018, 14, 10010.5], next: { day: 10018, row: [10040, 14, 10018] } });
  // the worst: a 20-day row answered early eight times ends 3 days after the on-time path's next answer, on the same 365 rung's
  // line: the on-time path answers on whole due days, a fraction of a day after its exact due each time, and restarts there
  assert.deepEqual(worst.r, [11013, 120, 10508, 365, 10368.75]);
  assert.deepEqual([worst.next.day, worst.next.row[0]], [10508, 11010]);
  // v1.281.0's worst in the same search: a 20-day row answered early on +9, +32, +38, +81, +92 and +134 was due 10 days after
  // the on-time path's next answer ([10268, 120, 10134, 84.3409, 10081] against 10258); on the rung's line, 2 days, whole days only
  let w0 = [10020, 14, 10000];
  for (const x of [9, 32, 38, 81, 92, 134]) w0 = W(w0, true, 10000 + x);
  assert.deepEqual(w0, [10260, 120, 10134, 90, 10098.75]);
  assert.equal(onTimePath([10020, 14, 10000], 40, false, onestep.write).find((p) => p.day >= 10134).row[0], 10258);
  assert.equal(onTimePath([10020, 14, 10000], 40, false).find((p) => p.day >= 10134).row[0], 10264, "the shipped on-time path, its part days paid: 10264 (LATE1's first form: 10314)");
  // (b) the reader's targeted search: early, on its due (+0, 1, 2 or 5), then early near the next due
  // (its runs answer once on or after a due, so the late rule can decide that answer, and the on-time path's: each run is
  // counted on its side as in the extra-answer search)
  let tried = 0, aheadB = 0, decidedB = 0, aheadBDecided = 0, worstB = null;
  for (let i = 0; i < 13; i++) {
    const A = L[i], t = 100000, start = [t + A, cell(A), t], P = onTimePath(start, 12, false);
    for (let f = 1; f < A; f += Math.max(1, Math.floor(A / 60))) for (const lateBy of [0, 1, 2, 5]) for (const g of [0.1, 0.3, 0.5, 0.7, 0.9, 0.97]) for (const tail of [1, 2, 3]) {
      let r = W(start, true, t + f); const ds = [t + f];
      const d2 = r[0] + lateBy, dblRun = late(r, d2); r = W(r, true, d2); ds.push(d2);
      for (let k = 1; k <= tail; k++) { const iv = r[0] - r[2], d = r[2] + Math.max(1, Math.floor((iv * g * k) / tail)); if (d >= r[0]) break; r = W(r, true, d); ds.push(d); }
      tried++;
      const k = P.findIndex((p) => p.day >= ds[ds.length - 1]);
      if (k < 0) continue;
      const by = r[0] - P[k].row[0];
      if (!dblRun && !P[k].dbl) { if (by > 0) aheadB++; continue; }
      decidedB++;
      if (by > 0) { aheadBDecided++; if (!worstB || by > worstB.by) worstB = { by, start, ds: ds.slice(), r, next: { day: P[k].day, row: P[k].row } }; }
    }
  }
  assert.deepEqual([tried, aheadB], [40536, 0], "early, on time, then early, the late rule deciding neither side: never ahead");
  // where it decided an answer (32,868 runs), 160 runs end ahead of the on-time path in whole days, by 14 at most (LATE1's
  // first form: 67 of 31,827, by 5). The worst: a 30-day card answered early on day 4 (34 days), then 5 days past its due, 39
  // days after day 4: the late rule pays the step's own multiple of the 39 days (64 ÷ 34 × 39 = 73.4, where one step is 64),
  // then early twice, and on day 90 it is due 14 days after the on-time path's answer of the same day (90 days from 90). That
  // is the late rule's purpose: the run waited longer than the on-time path, and it is paid for the wait
  assert.deepEqual([decidedB, aheadBDecided], [32868, 160], "the runs the late rule decided: ahead, as measured");
  assert.deepEqual({ ...worstB, r: sp(worstB.r), next: { ...worstB.next, row: sp(worstB.next.row) } }, { by: 14, start: [100030, 30, 100000], ds: [100004, 100043, 100050, 100065, 100090], r: [100194, 60, 100090, 90, 100076.17647058824], next: { day: 100090, row: [100180, 60, 100090] } });
  // v1.281.0's worst (b) sequence: a 30-day card answered on days 13, 56 (its due), 66 and 90 came due on 190 against the
  // on-time path's 180 and stayed about a tenth ahead for good. On the rung's line (the one-step client) it comes due on 180,
  // and stays level
  const D = 20400;
  const leadOf = (write) => {
    let rb = [D + 30, 30, D];
    const bRows = [13, 56, 66, 90].map((x) => (rb = write(rb, true, D + x)));
    let ot = write(write([D + 30, 30, D], true, D + 30), true, D + 90);
    const lead = [[rb[0] - D, ot[0] - D]];
    for (let k = 0; k < 4; k++) { rb = write(rb, true, rb[0]); ot = write(ot, true, ot[0]); lead.push([rb[0] - D, ot[0] - D]); }
    return { bRows, lead };
  };
  const one = leadOf(onestep.write), now = leadOf(W);
  assert.deepEqual(one.bRows, [[D + 56, 30, D + 13, 30, D], [D + 129, 60, D + 56], [D + 144, 60, D + 66, 60, D + 30], [D + 180, 60, D + 90]]);
  assert.deepEqual(one.lead, [[180, 180], [360, 360], [725, 725], [1455, 1455], [2916, 2916]], "the one-step client: no lead, for good");
  // LATE2: the run's day 56 is its due (one step, 73), the on-time path's day 90 its due (one step, 90): the shipped writer's
  // rows are the one-step client's, unmarked, and there is no lead, for good (LATE1's first form doubled both waits, and the
  // run was then BEHIND the on-time path, by 4, 12, 28, 60 and 124 days)
  assert.deepEqual(now.bRows, one.bRows, "the shipped writer: the one-step client's rows");
  assert.deepEqual(now.bRows.map((r) => K.ngKnowledgeMark(r)), [null, null, null, null], "none stretched");
  assert.deepEqual(now.lead, one.lead, "no lead, for good");
  // NOT A GENERAL 3-DAY BOUND (the reader of PR #426, finding 2): the whole-day lead adds up, about a day per on-time answer
  // compared, as a card ages (its generator: up to 3 in a card's first 2 years, 5 by five years, 6 by ten, 12 near the top).
  // Its case: a 14-day card answered one day in, answered early on each of the on-time path's own answer days and on its own
  // due less one between them, is due on 21984; the on-time path, answering on 21196 too, on 21979: 5 days, 796 days in. In
  // exact days it is not ahead: its exact due (21983.08) is before the exact on-time path's next answer
  const c5 = [20417, 14, 20401, 14, 20400];
  let r5 = c5;
  for (const x of [20416, 20417, 20449, 20450, 20512, 20513, 20610, 20804, 21196]) r5 = W(r5, true, x);
  assert.deepEqual(r5, [21984, 120, 21196, 730, 21139]);
  // (the run is early only: the one-step client's run; the case is against the ONE-STEP on-time path, as it was found)
  const P5 = onTimePath(c5, 8, false, onestep.write), X5 = onTimePath(c5, 8, true, onestep.write);
  assert.deepEqual(P5.map((p) => p.day), [20417, 20450, 20513, 20610, 20804, 21196, 21979, 23545], "the one-step on-time path answers on 21196 too");
  assert.equal(P5.find((p) => p.day >= 21196).row[0], 21979, "and is due 5 days before the early run");
  assert.ok(exactDue(r5) <= exactDue(X5.find((p) => p.day >= 21196).row) + 1e-6, "never ahead in exact days");
  // the shipped on-time path is paid its part days (each answer on a whole due day is a fraction of a day past its exact due,
  // and the late rule pays it at the step's own rate: day 20450 is 33 days after 20417 against an exact 32.14, so 33 × 62.14 ÷
  // 32.14 = 63.8 where one step is 62.14; then 101.7 for 96.4, 204.1 for 193.2, about 5% above the one-step path) and its next
  // answer at or after 21196 is on 21234, due 22060: the early run is 76 days behind it, not ahead (LATE1's first form: 21451,
  // due 22523, 539 days)
  const P5n = onTimePath(c5, 8, false);
  assert.deepEqual(P5n.map((p) => p.day), [20417, 20450, 20514, 20616, 20821, 21234, 22060, 23713], "the shipped on-time path");
  assert.deepEqual(P5n.find((p) => p.day >= 21196).row, [22060, 120, 21234, 0, 0, 782.2142857142857, 826], "(its late mark: the one-step 782.21)");
  console.log(`ahead of on time: (a) ${ahead} of ${prefixes} by at most ${days} whole days, ${aheadExact} in exact days; (b) ${aheadB} of ${tried}`);
});

// THE RULE IN EXACT FRACTIONS, written apart from the writer (no code shared): a card holds a level k + f (k a rung's index,
// 0 ≤ f < 1, a fraction of BigInts), its interval L[k] + f × (L[k+1] − L[k]). A right answer before the due climbs the level at
// 1 ÷ L[k] a day, rung after rung, never more than one level; on or after the due, one level, or (v1.305.0, LATE2, U226 a)
// the level of t × min(S ÷ I, C(t) ÷ t) when that is longer, t the days since the last answer, I the interval held, S the
// interval one level on: t × S ÷ I, or 2 t up to 4 years and the ladder's own step of t past them (one level on from t's own
// level); a miss, level 0 and 1 day. The due is the first whole day at or after the exact one, never sooner than the row's.
// The levels end at the ladder's top, so the model holds only intervals below it: a late answer past the top is pinned in
// tests/schedule_late.test.mjs.
const gcd = (a, b) => { a = a < 0n ? -a : a; while (b) [a, b] = [b, a % b]; return a; };
const Q = (n, d = 1n) => { const g = gcd(n, d) || 1n; return d < 0n ? { n: -n / g, d: -d / g } : { n: n / g, d: d / g }; };
const add = (a, b) => Q(a.n * b.d + b.n * a.d, a.d * b.d), sub = (a, b) => Q(a.n * b.d - b.n * a.d, a.d * b.d), mul = (a, b) => Q(a.n * b.n, a.d * b.d);
const div = (a, b) => Q(a.n * b.d, a.d * b.n), lt = (a, b) => a.n * b.d < b.n * a.d, ceilQ = (a) => (a.n >= 0n ? (a.n + a.d - 1n) / a.d : -((-a.n) / a.d));
const LB = L.map((x) => Q(BigInt(x))), TOP = L.length - 1;
const ivlQ = (k, f) => (k >= TOP ? LB[TOP] : add(LB[k], mul(f, sub(LB[k + 1], LB[k]))));
function levelOfQr(X) { if (!lt(X, LB[TOP])) return { k: TOP, f: Q(0n) }; let k = 0; while (!lt(X, LB[k + 1])) k++; return { k, f: div(sub(X, LB[k]), sub(LB[k + 1], LB[k])) }; }
const levelOfQ = (x) => levelOfQr(Q(BigInt(x)));
const stepQ = (X) => { const lv = levelOfQr(X); return lv.k >= TOP ? LB[TOP] : ivlQ(lv.k + 1, lv.f); };   // one level on from X
const minQ = (a, b) => (lt(a, b) ? a : b);
function answerQ(s, ok, day) {
  const d = BigInt(Math.max(day, Number(s.last)));
  if (!ok) return { k: 0, f: Q(0n), last: d, due: d + 1n };
  let k = s.k, f = s.f;
  if (d >= s.due) {
    const I = ivlQ(k, f);
    if (k < TOP) k++;
    const S = ivlQ(k, f), t = Q(d - s.last);
    const lateQ = minQ(div(mul(t, S), I), d - s.last <= 1461n ? mul(Q(2n), t) : stepQ(t));   // LATE2: when it beats one level
    if (lt(S, lateQ)) ({ k, f } = levelOfQr(lateQ));
  }
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
  let answers = 0, differ = 0, dust = 0, ex = null, beyond = 0, lateAnswers = 0;
  for (const x of [1, 2, 3, 5, 7, 10, 14, 20, 30, 42, 45, 59, 60, 75, 89, 90, 100, 120, 150, 180, 241, 300, 365, 500, 730, 1000, 1461, 2000, 2922]) for (let q = 0; q < 250; q++) {
    let r = [10000 + x, cell(x), 10000], s = { ...levelOfQ(x), last: 10000n, due: BigInt(10000 + x) };
    for (let i = 0, n = 1 + Math.floor(rnd() * 9); i < n; i++) {
      const u = rnd(), miss = rnd() < 0.04, same = rnd() < 0.05;
      const d = same ? r[2] : r[2] + Math.max(1, Math.floor((r[0] - r[2]) * (0.05 + u * 1.45)));
      if (!miss && late(r, d)) lateAnswers++;
      r = W(r, !miss, d); s = answerQ(s, !miss, d);
      if (K.ngKnowledgeInterval(r) >= L[TOP]) { beyond++; break; }   // past the model's top: the history ends here
      answers++;
      if (BigInt(r[0]) !== s.due) { differ++; if (!ex) ex = { r, due: s.due.toString() }; }
      const e = exactDue(r); if (Math.abs(e - Math.round(e)) < 1e-6 && !Number.isInteger(e)) dust++;
    }
  }
  assert.ok(answers > 30000 && lateAnswers > 5000, `${answers} answers, ${lateAnswers} of them decided by the late rule`);
  assert.equal(beyond, 0, "no history reached the ladder's top (the model's end)");
  assert.equal(differ, 0, `dues off the exact rule's: ${JSON.stringify(ex)}`);
  // float dust exists (a whole day computed a hair over or under) and is read as the whole day it is. Until v1.304.0 this search
  // met 12 such dues, all on late answers between rungs (one step stored as [step, day]); the late rule pays those answers more
  // than one step (they are a part day late at least), and the search meets none (measured: 0, under LATE1's first form and
  // LATE2's). The dust is still written: an early answer on a row the one-step client wrote stores the same row in both
  // clients, a hair under its whole due day (three of those 12, the rows as found)
  assert.equal(dust, 0, "the search's late answers meet no float dust (measured)");
  for (const [prior, d, row, due] of [[[10208, 60, 10123, 85.0000000000026, 10123], 10158, [10273, 60, 10158, 90, 10132.999999999995], 10273],
    [[10249, 60, 10158, 90.99999999999636, 10158], 10230, [10393, 120, 10230, 90, 10157.000000000004], 10393],
    [[10652, 120, 10346, 180, 10224.000000000002], 10515, [10991, 120, 10515, 365, 10404.000000000002], 10991]]) {
    const n = W(prior, true, d), e = exactDue(n);
    assert.deepEqual([n, onestep.write(prior, true, d)], [row, row], `${prior} on ${d}: the same row in both clients`);
    assert.ok(Math.abs(e - due) < 1e-6 && !Number.isInteger(e) && n[0] === due, `${n}: exact due ${e}, read as day ${due}`);
  }
  console.log(`exact fractions: ${answers} answers, ${differ} dues differ, ${dust} computed within 1e-6 of a whole day`);
});

test("a day later never earns less, and no cliff, on rows of every client", () => {
  // rows the writer makes, rows v1.281.0 made (off the rungs), and rows the older clients made
  const rnd = lcg(31), pop = [];
  for (const write of [W, lin1.write, prev.write, oldWrite]) for (const I of [1, 3, 7, 14, 20, 30, 42, 60, 75, 90, 120, 241, 365, 730]) for (let q = 0; q < 12; q++) {
    let r = [10000 + I, cell(I), 10000];
    for (let k = 0, n = 1 + Math.floor(rnd() * 4); k < n; k++) { r = write(r, rnd() > 0.05, r[2] + Math.max(1, Math.floor((r[0] - r[2]) * (0.05 + rnd() * 1.4)))); pop.push(r); }
  }
  let checked = 0, cliffs = 0, states = 0, jumps = 0, decidedStates = 0, cliffsOneStep = 0;
  for (const r of pop) {
    let prevDue = -Infinity, prevIvl = -Infinity;
    for (let d = r[2]; d <= r[0] + 30; d++) {
      const n = W(r, true, d), iv = K.ngKnowledgeInterval(n);
      assert.ok(n[0] >= prevDue, `${r}: answered on ${d} is due ${n[0]}, a day earlier ${prevDue}`);
      assert.ok(iv >= prevIvl - 1e-9, `${r}: answered on ${d} earns ${iv}, a day earlier ${prevIvl}`);
      prevDue = n[0]; prevIvl = iv; checked++;
    }
    // no cliff: a day before the due earns at least half of what the due day earns. Where the late rule decides the due day's
    // answer (a card whose exact due falls before its whole due day, so the due day is a part day late), the due day earns
    // that part day more, never a jump (LATE2: 0; LATE1's first form, which doubled the wait between 30 and 90 days, jumped
    // upward at the due on 51 of 465 such states), and never a fall after it (the loop above). Against the due day's ONE STEP
    // (the one-step client's credit) the day before still earns half, on every state
    const I = K.ngKnowledgeInterval(r);
    if (r[0] - 1 > r[2]) {
      states++;
      const before = K.ngKnowledgeInterval(W(r, true, r[0] - 1)) - I, on = K.ngKnowledgeInterval(W(r, true, r[0])) - I;
      if (before < onestep.interval(onestep.write(r, true, r[0])) / 2 - I / 2) cliffsOneStep++;
      if (!late(r, r[0])) { if (before < on / 2) cliffs++; continue; }
      decidedStates++;
      if (before < on / 2) jumps++;
    }
  }
  assert.ok(checked > 50000 && states - decidedStates > 1000, `${checked} answers, ${states} states, ${states - decidedStates} the late rule does not decide on the due day`);
  assert.equal(cliffs, 0, "a day before the due earns under half the due day's credit (the late rule not deciding the due day)");
  assert.equal(cliffsOneStep, 0, "a day before the due earns under half the due day's one step");
  assert.deepEqual([states, decidedStates, jumps], [1577, 246, 0], "the due days the late rule decides (246 of 1,577), none an upward jump");
  console.log(`a day later: ${checked} answers on ${pop.length} rows of four clients; no cliff in ${states} states (${decidedStates} due days decided by the late rule, ${jumps} of them an upward jump)`);
});

test("the rows v1.281.0 wrote are never made due sooner: answered by v1.281.3 on every day, and through mixed-writer histories and the merges", () => {
  // (1) v1.281.0's own rows (anchors off the rungs among them), each answered right by v1.281.3 on every day from its last to two
  // intervals past its due: never sooner than the row; and both read the same interval below 4 years. Past them (LATE2) a
  // v1.281.0 pair made on the doubling line may fail its check on the curve's (the row then reads its own whole-day interval,
  // a little longer) or check on it (a little shorter): under a day either way, and no such row exists before 2030 (v1.281.0
  // wrote its first rows on 15 Nov 2026)
  const rnd = lcg(41), built = [];
  for (const I of [1, 3, 7, 14, 20, 30, 42, 60, 75, 90, 120, 180, 241, 365]) for (let q = 0; q < 25; q++) {
    let r = [10000 + I, cell(I), 10000];
    for (let k = 0, n = 1 + Math.floor(rnd() * 5); k < n; k++) { r = lin1.write(r, rnd() > 0.05, r[2] + Math.max(1, Math.floor((r[0] - r[2]) * (0.05 + rnd() * 1.4)))); built.push(r); }
  }
  let answers = 0, past = 0, pastDiffer = 0, pastGap = 0;
  for (const r of built) {
    if (lin1.interval(r) < 1461) assert.equal(K.ngKnowledgeInterval(r), lin1.interval(r), `${r}: read the same`);
    else { past++; const g = K.ngKnowledgeInterval(r) - lin1.interval(r); if (g !== 0) { pastDiffer++; pastGap = Math.max(pastGap, Math.abs(g)); } }
    const I = r[0] - r[2];
    for (let d = r[2]; d <= r[0] + 2 * I; d += Math.max(1, Math.floor(I / 40))) { assert.ok(W(r, true, d)[0] >= r[0], `${r} answered on ${d}`); answers++; }
  }
  assert.ok(answers > 20000, `${answers} answers on v1.281.0's rows`);
  assert.ok(pastDiffer <= past && pastGap < 1, `past 4 years: ${pastDiffer} of ${past} rows read differently, by under a day (${pastGap})`);
  assert.equal(pastDiffer, 7, "as measured: 7 rows past 4 years read on the curve's line");
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
        // its last), read exactly; at today's epoch day only past 40,999.8 days on his ladder (LATE2; 43,776 on the doubling one)
        const pa = at > 3 ? 4 : 3;
        if (ok && d > r[2] && d < r[0] && n.length > pa + 1 && n[pa + 1] === n[2] && !L.includes(n[pa]) && n[0] > r[0]) {
          dated++;
          assert.equal(K.ngKnowledgeInterval(n, at), K.ngKnowledgeNextInterval(r, d, at), `${JSON.stringify(n)}: read exactly`);
          if (T === 20400 && K.ngKnowledgeInterval(n, at) < 40999) realDayDated++;
        }
        r = n; emitted++;
      }
    }
  }
  assert.ok(emitted > 15000 && dated > 50, `${emitted} rows emitted, ${dated} dated on their own day`);
  assert.equal(realDayDated, 0, "at epoch day 20,400 no card under 40,999 days falls back");
  console.log(`validators: ${emitted} emitted rows, all valid under this client, v1.280.4 and production; ${dated} early answers stored their exact interval at their own day`);
});

test("the rows whose rung pair would be dated before 1970 store their exact interval at their own day, and keep every claim (LIN2-R2)", () => {
  // the cards it touches: on a rung above the epoch day, at small days (a wrong clock, a pull's clamp). Counted where it shows,
  // a pair off the rungs dated on the answer's own day (whole intervals store no pair, and read as exactly); every interval read
  // is the exact one, and never sooner, a day later never earns less, one more early answer never costs where the late rule
  // decides neither last answer (where it does, the early answer restarted the wait it pays for; counted)
  let answers = 0, extra = 0, touched = 0, extraDecided = 0, behindDecided = 0;
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
        if (e < d && e < r[0]) {
          const r1 = W(r, true, e);
          if (late(r, d) || late(r1, d)) { extraDecided++; if (W(r1, true, d)[0] < n[0]) behindDecided++; continue; }
          assert.ok(W(r1, true, d)[0] >= n[0], `${r}: one more early answer on ${e} costs by ${d}`); extra++;
        }
      }
    }
  }
  assert.ok(touched >= 15 && answers > 5000 && extra > 4000, `${touched} rows touched, ${answers} answers, ${extra} with one more`);
  assert.deepEqual([extraDecided, behindDecided], [1064, 1020], "the late rule decided 1,064, and the early answer left 1,020 of those behind (LATE1's first form: 1,072 and 1,024)");
  console.log(`rows dated on their own day: ${touched} touched, ${answers} answers read exactly, never sooner and never less a day later, ${extra} with one more early answer never behind`);
});

test("answered every day from epoch day 0 (a clock in 1970): every run ends where one on-time answer of the one-step schedule does, and of the shipped writer (LIN2-R2, LATE2)", () => {
  // the reader of PR #426's re-read: with LIN2-R1's fallback (the pair dropped, a day longer at most per answer) 953 of 2,921
  // daily runs from day 0 ended on another due day, a 731-day card 364 days late. Dated on its own day, the exact interval
  // goes on exactly: the same due day, cell and last day, and interval to 1e-9, for every interval from 1 to 2,921 days, as one
  // on-time answer of the one-step schedule (v1.281.3 to v1.304.0 below 4 years; on his ladder past them, `onestepNow`). A
  // daily run's last answer comes a day after the one before it, so the late rule never decides it; the shipped on-time answer
  // after the whole interval is exactly one step (LATE2), so it ends there too (LATE1's first form decided it where one step
  // is under double, 31 to 89 days, and was later there)
  let off = 0, offOld = 0, offNow = [];
  const same = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && Math.abs(K.ngKnowledgeInterval(a) - K.ngKnowledgeInterval(b)) <= 1e-9;
  for (let I = 1; I <= 2921; I++) {
    let row = [I, cell(I), 0];
    const onTime = onestepNow.write(row, true, I), onTimeOld = onestep.write(row, true, I), onTimeNow = W(row, true, I);
    for (let d = 1; d <= I; d++) row = W(row, true, d);
    if (!same(row, onTime)) off++;
    if (I < 1461 && !same(row, onTimeOld)) offOld++;
    if (!same(row, onTimeNow)) { offNow.push(I); assert.ok(onTimeNow[0] > row[0], `${I}: the shipped on-time answer is later than the daily run`); }
  }
  assert.equal(off, 0, "daily runs from epoch day 0 that do not end where one on-time answer of the one-step schedule does");
  assert.equal(offOld, 0, "below 4 years: where one on-time answer of the one-step client (v1.304.0) does");
  assert.deepEqual(offNow, [], "the shipped on-time answer: the same (LATE1's first form differed, later, from 31 to 89 days)");
});

test("the reader's wrong clock: pull, clamp, answer, validate, save (LIN2-R1)", () => {
  // a device whose clock reads epoch day 3 (4 Jan 1970) pulls the cloud's row: the pull's clamp makes it a card of 20,427 days
  const pulled = K.ngKnowledgeMergeRow(undefined, [20430, 30, 20400], 3);
  assert.deepEqual(pulled, [20430, 30, 3]);
  const a = W(pulled, true, 4), b = W(a, true, 5);
  // its rung pair would be dated before 1970 (20,427 days stands 4,898 days up the 17,179-day rung since LATE2, whose next rung
  // is the curve's 28,571, climbing 11,392 ÷ 17,179 days a day: day 4 − 4,898), so it stores its exact interval at its own day,
  // 20,427.66, then 20,428.33 (the doubling ladder put it 8,740 days up the 11,688-day rung, a day a day, a whole interval and
  // no pair: [20432, 120, 4], [20434, 120, 5])
  assert.deepEqual([a.slice(0, 3), a[4], b.slice(0, 3), b[4]], [[20432, 120, 4], 4, [20434, 120, 5], 5]);
  assert.equal(a[3], K.ngKnowledgeNextInterval(pulled, 4));
  assert.equal(b[3], K.ngKnowledgeNextInterval(a, 5));
  assert.ok(Math.abs(a[3] - (20427 + 11392 / 17179)) < 1e-9 && Math.abs(b[3] - (20427 + (2 * 11392) / 17179)) < 1e-9, "a day's climb each");
  // where the interval is not whole, it is stored at its own day: a 71-day card at epoch day 20 (on the 60-day rung, 22 days up)
  // answered on day 21 has 71.5 days, dated on day 21
  assert.deepEqual(W([91, 60, 20], true, 21), [93, 60, 21, 71.5, 21]);
  const m = W(W(pulled.concat(1), true, 4, 4), true, 5, 4);
  assert.deepEqual(m, [20434, 120, 5, 1, b[3], 5]);
  const blob = { v: 2, srs: { d: { q: b } }, moves: { s: { m } } };
  for (const [name, validate] of Object.entries(validators)) assert.ok(valid(validate, blob), `${name}'s validator`);
  // and it saves: the store takes it (v1.281.3 at a2efd246b wrote [20432,120,4,11688,-8736], which the same store refuses)
  const store = ngProgressCreateStore(memory()), owner = ngProgressOwner();
  assert.equal(store.write(owner, blob).status, "saved");
  assert.deepEqual(store.write(owner, { v: 2, srs: { d: { q: [20432, 120, 4, 11688, -8736] } } }), { status: "unavailable", reason: "unsupported-progress" });
});
