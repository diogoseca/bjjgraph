// THE LADDER WITHOUT ROUNDING (v1.281.0, LIN1: the owner's own formula, U188, ruled 15 Nov 2026) — neural/src/
// knowledge-profile.src.js (`ngKnowledgeScheduleRow`, `ngKnowledgeAnchor`, `ngKnowledgeStep`, `ngKnowledgeMergeRow`), its two
// copies of the exact reader (progress-owner's `ngProgressSchedInterval` for the moves merge, rating's `ngRatingSchedInterval`
// for the rating and the Practice order), the moves merge (`ngProgressMergeMoves`) and the replay of the journal.
//
// The rule: credit LINEAR in the days waited since the card's last full step (A from day t0): interval = A + w × (B − A) ÷ A.
// The days past a step count at the next step's ratio; an answer takes at most one step from where the previous one left it
// (which binds exactly on and after the due: late earns one step, no bonus). The whole-day due is the first day at or after
// the exact due; the pair [A, t0] rides at the row's end (srs [3], moves [4]) while the card sits between steps, and is read
// only if it reproduces the row's due day. The ladder's own cases (his numbers, the cell, daily runs, older clients' rungs)
// are tests/schedule_ladder.test.mjs.
//
// SINCE v1.281.3 (LIN2) THE LINE IS THE RUNG'S: a card between rungs climbs the line of the rung below it, the pair an early
// answer stores is a rung pair, and nothing is rounded (tests/schedule_rung.test.mjs, its claims and the v1.281.0 client).
// Every test here still holds on it, with three of v1.281.0's own bounds removed below (said where).
//
// THE OLDER CLIENTS, captured from git (never re-typed): dev v1.278.2 (production's text) in tests/artifacts/
// schedule_old_client.json and v1.280.2 (the log-scale credit) in tests/artifacts/schedule_prev_client.json.
//
// MUTANTS (v1.281.0), each applied alone to a clean tree and run against the eight schedule unit files (this one, the ladder's,
// answers_before_sync, moves_record, knowledge_profile, rating, practice_queue, progress_owner.integration); each turned the
// NAMED test red (the run log: docs/Changelog-Archive.md, v1.281.0):
//   M1  the credit on a log scale (v1.279.0's)           → "his formula on a card at a full step…" (and 10 more)
//   M2  the days past a step dropped (the first draft)   → "the days past a step count at the next step's ratio…"
//   M3  a late bonus (negative days left)                → the same, and "a late right answer earns one rung, no bonus"
//   M4  the one-step cap on an early answer removed      → the same, and "an older client's moves writer leaves a pair…"
//   M5  the pair never written                           → "nothing rounds per answer…", "a run of early answers…" (16 in all)
//   M6  the pair read without its self-check             → "the pair checks itself…", "the three readers…"
//   M7  the srs merge drops the cloud's pair             → "the srs merge: the winner's pair rides…"
//   M8  the srs same-day heal as a fresh anchor          → the same (its absorb case)
//   M9  the moves same-day heal as a fresh anchor        → "the moves merge: the same three rules…"
//   M10 the rating's row choice without the exact due    → "the rating and the Practice order choose a shared question's row…"
//   M11 progress-owner's copy reads due − last           → "the three readers…", "the moves merge…", moves_record's R5
//   M12 rating's copy reads due − last                   → "the three readers…", "the rating and the Practice order choose…"
//   M13 the app's moves writer without the pair's place  → answers_before_sync's "the app's moves writer on a card between steps…"
//   M14 the replay writes from the first cells           → answers_before_sync's "P1 on a card between steps…", and this file's last
//   M15 the replay's base row drops an srs row's pair    → answers_before_sync's P1, P2, P3 and "P1 on a card between steps…"
//   M16 the host's replayer drops the pair's place       → answers_before_sync's P1, P3 and "P1 on a card between steps…"
//   M18 the never-sooner guard dropped                   → the ladder's "a right answer never makes a card due sooner"
// NOT KILLED, said so here so nobody reads this file as covering them:
//   M17 the first whole day without its 1e-6 tolerance: no row the writer makes has an exact due within 1e-6 above a whole
//       day (0 of 11,677 over five-answer histories), so the tolerance is a guard against float dust that never acts.
//   M19, M20 the moves and srs merges' tie without the exact due: on one day with one cell the heal always takes the longer
//       exact interval whichever row wins the tie, and a rung-0 row (no heal) has an exact interval of exactly 1, so the tie
//       never decides a row the due day would not. Kept, as ruled (the three merge rules), and harmless.
// LIN1-R2 (the reader's three fixes), each mutant applied alone to a copy of the tree and run against the same unit files
// plus moves_account_safety; each turned the NAMED test red:
//   H1  rating's ladder, rung 90 as 91                 → "the three readers of the exact interval agree…"
//   H2  progress-owner's copy without the 1e-6 tolerance, and H2r the same in rating's → the same (the boundary rows)
//   H3  rating's `last − t0 < A` as `<=`, and H3p the same in progress-owner's       → the same
//   H4  progress-owner's ladder cut at 20 rungs, and H4r the same in rating's         → the same
//   H5  rating's step between rungs as x × next ÷ this → the same
//   H6  progress-owner's `t0 <= last` dropped, and H6r the same in rating's → "a fast clock's moves row: the merge clamps its
//       last below its pair's day, and all three readers read it as its own", and the three readers' test
//   B1  the cliff correction undone (the days past the step dropped) → "the days past a step count at the next step's ratio…"
//       and "ahead of on time, (a)…" (its worst sequence's row)
//   B2  the one-step cap on an early answer removed     → "ahead of on time, (a)…" and "(b)…"
//   B3  a fresh anchor at every early answer (his formula from the previous answer at the anchor's step ratio) → "one early
//       answer, then the next on its old due or its own new due, never costs the card anything…", (a), (b) and 12 more
// LIN1-R3 (the reader's N1: over longer runs one more early answer can cost days; ruled, the rule stays and the claim is
// scoped, pinned as a bound), each mutant applied alone to a copy of the tree and run against this file; each turned "over
// longer runs one more early answer can leave a card due sooner…" red:
//   N1a the step between rungs 5% steeper                     (and 8 more, the scoped table among them)
//   N1b a walked card's line at 0.9 of the next step's ratio   (and 5 more)
//   N1c a late answer's step 1% longer                         (and 5 more, the scoped table among them)
//   N1d a late answer one step from its line's value on the answer's day, not from the interval it holds (and 6 more, the table)
//
// Run: node --test tests/schedule_linear.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as K from "../neural/src/knowledge-profile.src.js";
import { ngProgressMergeMoves, ngProgressSchedInterval } from "../neural/src/progress-owner.src.js";
import * as R from "../neural/src/rating.src.js";

const W = K.ngKnowledgeScheduleRow, L = K.NG_KNOWLEDGE_LADDER, TOP = L[L.length - 1];
const OLD = JSON.parse(readFileSync(new URL("./artifacts/schedule_old_client.json", import.meta.url), "utf8"));
const PREV = JSON.parse(readFileSync(new URL("./artifacts/schedule_prev_client.json", import.meta.url), "utf8"));
const oldWrite = new Function(OLD.knowledge.intervals + "\n" + OLD.knowledge.scheduleRow + "\nreturn ngKnowledgeScheduleRow;")();
const prevK = new Function(PREV.knowledge.ladder + "\n" + PREV.knowledge.schedule + "\nreturn { ngKnowledgeScheduleRow, ngKnowledgeMergeRow };")();
const oldMergeBlock = new Function("cloud", OLD.app.srsMerge);
const oldMerge = (local, cloud, today) => {
  const host = { srs: { A: local ? { q: local.slice() } : {} }, _epochDay: () => today };
  oldMergeBlock.call(host, { srs: { A: { q: cloud.slice() } } });
  return host.srs.A.q;
};
const oldMergeMoves = new Function(OLD.owner.mergeMoves + "\nreturn ngProgressMergeMoves;")();
const prevMergeMoves = new Function(PREV.owner.mergeMoves + "\nreturn ngProgressMergeMoves;")();
// the older clients' moves writer: the app's `_gradeMove` row line, run over each client's own writer
const gradeWith = (write) => {
  const f = new Function("ngKnowledgeScheduleRow", "prior", "ok", "day", "const row = {}, k = [0, 1];\n" + PREV.app.gradeMove + "\nreturn row[k[1]];");
  return (prior, ok, day) => f(write, prior, ok, day);
};
const clients = { "v1.278.2": { write: oldWrite, merge: oldMerge, mergeMoves: oldMergeMoves, grade: gradeWith(oldWrite) },
  "v1.280.2": { write: prevK.ngKnowledgeScheduleRow, merge: prevK.ngKnowledgeMergeRow, mergeMoves: prevMergeMoves, grade: gradeWith(prevK.ngKnowledgeScheduleRow) } };
const moves = (row) => row.slice(0, 3).concat(1, row.slice(3));   // an srs-layout row in the moves layout, its Yes at [3]
const exactDue = (row, at = 3) => row[2] + K.ngKnowledgeInterval(row, at);

// every row the writer makes over short histories from a spread of starts: on rungs, between them, off the ladder, legacy
function population(at = 3, depth = 3) {
  const out = [], seen = new Set();
  const walk = (row, n) => {
    if (row && !seen.has(row.join())) { seen.add(row.join()); out.push(row); }
    if (!n) return;
    const I = row ? K.ngKnowledgeInterval(row, at) : 1, last = row ? row[2] : 1000;
    for (const d of new Set([last, last + 1, last + Math.floor(I / 3), last + Math.floor(I) - 1, row ? row[0] - 1 : last, row ? row[0] : last + 1, row ? row[0] + 9 : last + 2]))
      if (d >= last) for (const ok of [true, false]) walk(W(row, ok, d, at), n - 1);
  };
  const ok1 = at > 3 ? [1] : [];
  for (const I of [1, 3, 7, 14, 30, 42, 60, 75, 90, 120, 180, 241, 365, 500, 730, 1461, 2922]) walk([1000 + I, K.ngKnowledgeCell(I), 1000, ...ok1], depth);
  walk(null, depth);
  return out;
}
const POP = population(), POP_MOVES = population(4, 3);

test("his formula on a card at a full step: 59, 31 and 60, each day waited adding the same", () => {
  assert.deepEqual([29, 1, 30].map((d) => K.ngKnowledgeNextInterval([30, 30, 0], d)), [59, 31, 60]);
  // (interval − days left) × ratio + days left, his words, for every rung and every day of its step
  for (let i = 0; i < 12; i++) {
    const A = L[i], B = L[i + 1], ratio = B / A;
    for (let w = 0; w < A; w++) {
      const left = A - w, his = (A - left) * ratio + left;
      assert.ok(Math.abs(K.ngKnowledgeNextInterval([A, K.ngKnowledgeCell(A), 0], w) - his) < 1e-9, `${A} days, ${w} waited`);
    }
  }
});

test("the days past a step count at the next step's ratio; an answer never takes more than one step", () => {
  const early = W([30, 30, 0], true, 29);
  assert.deepEqual(early, [88, 30, 29, 30, 0], "early on day 29: 59 days, between steps");
  assert.deepEqual(W(early, true, 50), [120, 60, 50, 60, 30], "on day 50: 20 days into the next step, at its ratio: 70");
  assert.deepEqual(W(early, true, 87), [176, 60, 87, 60, 30], "a day before its due: 88.5 days");
  assert.deepEqual(W(early, true, 88), [177, 60, 88], "on its due: one step from 59, 89 days");
  assert.deepEqual(W(early, true, 120), [209, 60, 120], "late: one step, 89, no more");
  // NO CLIFF: from every between-steps row, an answer the day before the due earns at least half of what the due day earns
  // (the first draft, which dropped the days past the step, gave 1 day against 30 above: under half in 72% of such states).
  // The gap between the two is one day of the path's rate where it stands, never a step
  let checked = 0, worst = 1;
  for (const row of POP) {
    const due = row[0], I = K.ngKnowledgeInterval(row);
    if (row.length < 5 || due - 1 <= row[2]) continue;
    const before = K.ngKnowledgeInterval(W(row, true, due - 1)) - I, on = K.ngKnowledgeInterval(W(row, true, due)) - I;
    assert.ok(before >= on / 2, `${row}: a day before its due earns ${before}, on it ${on}`);
    worst = Math.min(worst, before / on);
    checked++;
  }
  assert.ok(checked > 300 && worst < 1, `${checked} between-steps rows, worst share ${worst}`);
  // never more than one step from where the previous answer left the card, on any day
  for (const row of POP) for (const d of [row[2], row[2] + 1, row[0] - 1, row[0], row[0] + 400]) {
    if (d < row[2]) continue;
    const n = W(row, true, d);
    assert.ok(K.ngKnowledgeInterval(n) <= K.ngKnowledgeStep(K.ngKnowledgeInterval(row)) + 1e-4, `${row} on ${d}: ${n}`);
  }
});

test("a run of early answers inside one step earns exactly what one answer at its end earns", () => {
  let a = 13; const rnd = () => { a = (a * 1103515245 + 12345) >>> 0; return a / 4294967296; };
  let runs = 0;
  for (let k = 0; k < 3000; k++) {
    const I = 2 + Math.floor(rnd() * 2920), start = [1000 + I, K.ngKnowledgeCell(I), 1000], days = [];
    let d = 1000;
    while (true) { d += 1 + Math.floor(rnd() * Math.max(1, I / 4)); if (d >= 1000 + I) break; days.push(d); }
    if (!days.length) continue;
    let row = start;
    for (const t of days) row = W(row, true, t);
    assert.deepEqual(row, W(start, true, days[days.length - 1]), `${I} days, answered on ${days.join(",")}`);
    runs++;
  }
  assert.ok(runs > 2500, `${runs} runs`);
});

test("nothing is rounded (v1.281.3): an on-time answer lands exactly on its step, an early one stores a rung pair, moved only when a rung is crossed", () => {
  // a 14-day card (ratio 15/7, not whole) answered on every one of its 13 early days: the rung pair stays [14, D], every
  // interval exact to 1e-9 (at a real epoch day, D = 20,400: LIN2-R1)
  const D = 20400;
  let row = [D + 14, 14, D];
  for (let d = 1; d < 14; d++) {
    row = W(row, true, D + d);
    assert.deepEqual(row.slice(3), [14, D], `day ${d}: the card still stands on the 14-day rung's line`);
    assert.ok(Math.abs(K.ngKnowledgeInterval(row) - (14 + (d * 16) / 14)) < 1e-9, `day ${d}`);
  }
  // ON TIME OR LATE: exactly one step from the interval read (the number computed, not rounded), anchored at the answer's day
  let onTime = 0;
  for (const r of POP) for (const d of [r[0], r[0] + 9]) {
    const n = W(r, true, d), want = K.ngKnowledgeStep(K.ngKnowledgeInterval(r));
    if (K.ngKnowledgeDueDay(d + want) < r[0]) continue;   // the never-sooner guard's own rows
    assert.equal(K.ngKnowledgeInterval(n), want, `${r} on ${d}: ${n}`);
    assert.equal(n.length === 5 ? n[4] : d, d, `${r} on ${d}: anchored at its own day`);
    onTime++;
  }
  assert.ok(onTime > 1000, `${onTime} on-time and late answers`);
  assert.deepEqual(W([D + 120, 120, D], true, D + 120), [D + 362, 120, D + 120, 180 + 185 / 3, D + 120], "one step from 120 days: 241.666…, not rounded");
  // the same in the moves layout (the pair at [4]): every row of POP_MOVES answered on its due and past it
  let movesOnTime = 0;
  for (const r of POP_MOVES) for (const d of [r[0], r[0] + 9]) {
    const n = W(r, true, d, 4), want = K.ngKnowledgeStep(K.ngKnowledgeInterval(r, 4));
    if (K.ngKnowledgeDueDay(d + want) < r[0]) continue;
    assert.equal(K.ngKnowledgeInterval(n, 4), want, `${r} on ${d} (moves): ${n}`);
    movesOnTime++;
  }
  assert.ok(movesOnTime > 300, `${movesOnTime} on-time and late answers, moves layout`);
  // EARLY: the pair a right answer stores before the due is a rung pair (its A on the ladder), unless no day was waited (the
  // row kept as it was), in both layouts
  for (const r of POP) if (r.length >= 5 && r[4] !== r[2]) assert.ok(L.includes(r[3]), `${r}: an early answer's pair stands on a rung`);
  for (const r of POP_MOVES) if (r.length >= 6 && r[5] !== r[2]) assert.ok(L.includes(r[4]), `${r}: an early answer's pair stands on a rung (moves)`);
  // a second right answer the same day rewrites nothing, whatever pair the row holds (v1.281.0's off-rung pairs included)
  for (const r of POP) if (r[0] > r[2]) assert.deepEqual(W(r, true, r[2]), r, `${r} answered again on its own last day`);
  assert.deepEqual(W([D + 181, 60, D + 86, 72, D + 56], true, D + 86), [D + 181, 60, D + 86, 72, D + 56], "a v1.281.0 pair off the rungs (72 days from its day 56), kept");
  // a row the writer makes never carries a pair that says nothing (anchored at its last on a whole interval)
  for (const r of POP) if (r.length >= 5) assert.ok(r[4] !== r[2] || !Number.isInteger(r[3]), `${r}: a redundant pair`);
});

test("the pair checks itself: a stale, damaged or clamped pair is read as the row's own", () => {
  for (const r of POP) {
    const a = K.ngKnowledgeAnchor(r);
    if (r.length >= 5) assert.equal(K.ngKnowledgeDueDay(r[2] + a.ivl), r[0], `${r}: the pair reproduces its due day`);
  }
  const own = (r) => K.ngKnowledgeAnchor(r.slice(0, 3));
  const cases = [
    [[88, 30, 29, 30, 0], false, "the writer's own"],
    [[119, 60, 50, 30, 0], true, "behind another due (an older writer's): w past A"],
    [[88, 30, 29, 0.5, 0], true, "A below 1"],
    [[88, 30, 29, 30, 40], true, "t0 after last"],
    [[88, 30, 29, 30, NaN], true, "t0 not a number"],
    [[89, 30, 29, 30, 0], true, "a due one day off"],
    [[88, 30, 29], true, "no pair"],
  ];
  for (const [r, isOwn, why] of cases) assert.deepEqual(K.ngKnowledgeAnchor(r), isOwn ? own(r) : { A: 30, t0: 0, ivl: 59, pair: true }, why);
  // a pulled row whose last the merge clamps (a clock 30 days fast) loses its pair's reading and keeps its due day
  const fast = W([1060, 30, 1030], true, 1059);
  const kept = K.ngKnowledgeMergeRow(undefined, fast, 1040);
  assert.equal(kept[0], fast[0], "never sooner");
  assert.deepEqual(K.ngKnowledgeAnchor(kept), own(kept), "the clamped row reads as its own");
});

// THE SELF-CHECK'S BOUNDARY ROWS (LIN1-R2, the reader's D3: its mutants H2, H3, H4 and H6 survived the pin without them)
//   · an exact due within 1e-6 above a whole day: that day (H2, a copy without the 1e-6 tolerance, reads the row's own 30)
//   · last − t0 = A exactly: not this step, the row's own 120 (H3, `<` as `<=`, reads the line's 60)
//   · a pair past the ladder's 20th rung (800,000.5 days, 7 in: 800,007.5): the module's ladder (H4, a copy's ladder cut at 20
//     rungs, reads the row's own 800,008)
//   · t0 after last, whose line still reproduces the due: the row's own 9 (H6, `t0 <= last` dropped, reads 8.2857); the row a
//     fast clock's moves row becomes when the merge clamps its last is the named test below
//   · a pair on its own last (30 days) and one 29 days into its step (the line: 59): the plain cases beside them
const FAR = 800000.5, FARL = 5000, FAR_IVL = K.ngKnowledgeLinear(FAR, 7);
const BOUNDARY = [[1030, 30, 1000, 30.0000005, 1000], [1060, 120, 1000, 30, 970], [K.ngKnowledgeDueDay(FARL + FAR_IVL), 120, FARL, FAR, FARL - 7],
  [1009, 7, 1000, 14, 1005], [1030, 30, 1000, 30, 1000], [1059, 30, 1000, 30, 971]];

test("the three readers of the exact interval agree on every row the writers make", () => {
  let n = 0;
  for (const r of POP) {
    const k = K.ngKnowledgeInterval(r), p = ngProgressSchedInterval(r, 3), q = R.ngRatingSchedInterval(r, 3);
    assert.equal(p, k, `${r}: progress-owner's copy`); assert.equal(q, k, `${r}: rating's copy`); n++;
  }
  for (const m of POP_MOVES) {
    const k = K.ngKnowledgeInterval(m, 4);
    assert.equal(ngProgressSchedInterval(m, 4), k, `${m}`); assert.equal(R.ngRatingSchedInterval(m, 4), k, `${m}`); n++;
  }
  // and on damaged pairs, older clients' rows and THE SELF-CHECK'S BOUNDARY ROWS (LIN1-R2, the reader's D3: each row is one
  // where a single condition decides, so a copy that drops or bends it reads another interval than the module)
  for (const r of [[88, 30, 29, 30, 40], [119, 60, 50, 30, 0], [2, 14, 1], [430.4, 30, 400], [50, 0, 20], ...BOUNDARY]) {
    assert.equal(ngProgressSchedInterval(r, 3), K.ngKnowledgeInterval(r), `${r}: progress-owner's copy`);
    assert.equal(R.ngRatingSchedInterval(r, 3), K.ngKnowledgeInterval(r), `${r}: rating's copy`);
    assert.equal(ngProgressSchedInterval(moves(r), 4), K.ngKnowledgeInterval(moves(r), 4), `${r}: progress-owner's copy, moves layout`);
    assert.equal(R.ngRatingSchedInterval(moves(r), 4), K.ngKnowledgeInterval(moves(r), 4), `${r}: rating's copy, moves layout`);
    n++;
  }
  // each boundary row is read as its rule says, so the pin cannot pass on three copies that agree on a wrong reading
  assert.deepEqual(BOUNDARY.map((r) => K.ngKnowledgeInterval(r)), [30.0000005, 120, 800007.5, 9, 30, 59]);
  // the copies' ladders are the module's
  for (let x = 1; x <= 30000; x += 7) assert.equal(R.ngRatingSchedInterval([0, 1, 0, x, -1], 3) === K.ngKnowledgeInterval([0, 1, 0, x, -1]), true);
  assert.ok(n > 2000, `${n} rows`);
  // the rating reads the exact interval: a card 59 days into its interval reads 59, not the 59 whole days' 59 + its rounding
  const r = [88, 30, 29, 30, 0];
  assert.equal(R.ngRatingRecall(r, true, 88), Math.pow(R.NG_RATING_FADE, 59 / 59));
  const half = W([14, 14, 0], true, 1);   // 15.1429 days, due on day 17
  assert.ok(Math.abs(R.ngRatingRecall(half, true, 17) - Math.pow(R.NG_RATING_FADE, 16 / (14 + 16 / 14))) < 1e-12);
  assert.equal(R.ngRatingRecall(moves(half), true, 17, 4), R.ngRatingRecall(half, true, 17), "a moves row reads its pair at [4]");
});

test("a fast clock's moves row: the merge clamps its last below its pair's day, and all three readers read it as its own", () => {
  // a device whose clock runs 30 days fast answers a 14-day card early (5 days in) and writes a pair whose day is its own last;
  // a device on the right day pulls it, and the moves merge clamps `last` to today, below that day (t0 > last)
  const today = 2000, fast = W([today + 30 + 9, 14, today + 30 - 5, 1], true, today + 30, 4);
  assert.equal(fast.length, 6, "a pair rides");
  const clamped = ngProgressMergeMoves({ s: { m: fast } }, {}, today).s.m;
  assert.equal(clamped[2], today);
  assert.ok(clamped[5] > clamped[2], `${clamped}: its pair's day is after its last`);
  const own = clamped[0] - clamped[2];
  for (const [name, read] of [["the module", K.ngKnowledgeInterval(clamped, 4)], ["progress-owner's copy", ngProgressSchedInterval(clamped, 4)], ["rating's copy", R.ngRatingSchedInterval(clamped, 4)]])
    assert.equal(read, own, `${name} reads the clamped row as its own`);
  // there the pair's line no longer reaches the due either (the clamp moves last + its interval by a day or more), so a copy
  // without `t0 <= last` would still read the row's own: the row that tells them apart is one whose line DOES reach its due
  // with its day after its last (the boundary row above): all three read its own 9 days, where the line says 8.2857
  const after = [1009, 7, 1000, 1, 14, 1005];
  for (const read of [K.ngKnowledgeInterval(after, 4), ngProgressSchedInterval(after, 4), R.ngRatingSchedInterval(after, 4)]) assert.equal(read, 9);
  assert.ok(Math.abs(K.ngKnowledgeLinear(14, -5) - 8.2857) < 1e-4 && K.ngKnowledgeDueDay(1000 + K.ngKnowledgeLinear(14, -5)) === 1009, "the line reproduces its due");
});

// THE BOUNDS OF v1.281.0 (LIN1-R2's "ahead of on time" (a) and (b), LIN1-R3's "one more early answer can cost days") pinned
// that rule's straight line from a card's own interval. v1.281.3 (LIN2) puts every card on its rung's line, where neither
// holds any more: their successors, "ahead of answering on time by at most 3 whole days, never in exact days" and "an early
// right answer never leaves a card due sooner than without it", are tests/schedule_rung.test.mjs, replayed over the same
// searches. Removed here on purpose, not lost.
test("one early answer, then the next on its old due or its own new due, never costs the card anything (LIN1-R2, scoped at LIN1-R3)", () => {
  // the property the owner is asked to prefer (U192), and only this much of it holds (LIN1-R3: over longer runs an extra
  // early answer can cost days, the next test). For every rung, a card answered once early on every day of its step, then
  // (i) again on the day its first due fell (the day a player who never answered early answers it) or (ii) on its own new due,
  // ends no sooner than the card answered only on its due day. [rung, that card's due, the least (i) − it, the least (ii) − it]
  const TABLE = [[3, 10, 0, 6], [7, 21, 0, 5], [14, 44, 0, 6], [30, 90, 0, 3], [60, 150, 0, 4], [90, 270, 0, 5], [180, 545, 0, 6],
    [365, 1095, 0, 5], [730, 2191, 0, 6], [1461, 4383, 0, 4], [2922, 8766, 0, 4]];
  const got = [];
  for (let i = 1; i < 12; i++) {
    const A = L[i], s0 = [A, K.ngKnowledgeCell(A), 0], only = W(s0, true, A);
    let least1 = Infinity, least2 = Infinity;
    for (let w = 1; w < A; w++) {
      const early = W(s0, true, w);
      least1 = Math.min(least1, W(early, true, A)[0] - only[0]);
      least2 = Math.min(least2, W(early, true, early[0])[0] - only[0]);
    }
    got.push([A, only[0], least1, least2]);
  }
  assert.deepEqual(got, TABLE);
  // the reader's case against the level rule: a 30-day card answered on day 15 and on day 30 gets 60 days, as answering only
  // on day 30 does (the level rule gave 55)
  assert.deepEqual(W(W([30, 30, 0], true, 15), true, 30), [90, 60, 30]);
  assert.deepEqual(W([30, 30, 0], true, 30), [90, 60, 30]);
});

test("the rating and the Practice order choose a shared question's row by the earlier EXACT due, in either order", () => {
  // one day, one cell, one due day: 60.5 days against 61; the due count owes both on day 1061, the rating reads the earlier
  const a = [1061, 60, 1000, 60, 999], b = [1061, 60, 1000];
  assert.equal(R.ngRatingNewerRow(a, b), true);
  assert.equal(R.ngRatingNewerRow(b, a), false);
  let pick = null; for (const r of [a, b]) if (R.ngRatingNewerRow(r, pick)) pick = r;
  let back = null; for (const r of [b, a]) if (R.ngRatingNewerRow(r, back)) back = r;
  assert.deepEqual([pick, back], [a, a]);
  // the later `last` and the smaller cell still come first
  assert.equal(R.ngRatingNewerRow([1062, 60, 1001], a), true);
  assert.equal(R.ngRatingNewerRow([1061, 30, 1000], a), true);
});

test("the srs merge: the winner's pair rides only while it checks; the heal is a fresh anchor; ties read the exact due", () => {
  // (1) the cloud's pair rides with it
  assert.deepEqual(K.ngKnowledgeMergeRow([31, 1, 1], [88, 30, 29, 30, 0], 100), [88, 30, 29, 30, 0]);
  // (2) the heal: a fresh first answer (3 days) beats the row it heals from (between steps, 19.714… days): that interval as
  // read, not rounded (v1.281.3), at the winner's last, with a pair because it is not whole; a whole one carries none
  const between = W([14, 14, 0], true, 5);
  assert.deepEqual(K.ngKnowledgeMergeRow([13, 3, 10], between, 100), [30, 14, 10, 14 + (5 * 16) / 14, 10]);
  assert.deepEqual(K.ngKnowledgeMergeRow([13, 3, 10], [60, 30, 5], 100), [65, 30, 10]);
  // (3) one day, one cell, one due day, two exact dues (60.5 and 61): the earlier exact due wins the tie and heals to the
  // longer interval it beat, 61, whole, so no pair; the same in both orders
  const a = [1061, 60, 1000, 60, 999], b = [1061, 60, 1000];
  assert.deepEqual([K.ngKnowledgeInterval(a), K.ngKnowledgeInterval(b)], [60.5, 61]);
  assert.deepEqual(K.ngKnowledgeMergeRow(a, b, 2000), [1061, 60, 1000]);
  assert.deepEqual(K.ngKnowledgeMergeRow(b, a, 2000), [1061, 60, 1000]);
  // two rows of one exact interval with different pairs: the pair read as text decides, in both orders
  const c = [1061, 60, 1000, 60.5, 1000];
  assert.equal(K.ngKnowledgeInterval(c), 60.5);
  assert.deepEqual(K.ngKnowledgeMergeRow(a, c, 2000), a);
  assert.deepEqual(K.ngKnowledgeMergeRow(c, a, 2000), a);
  // over every pair of rows the writer makes for one card on one day: commutative and idempotent
  const day = 1400, rows = POP.filter((r) => r[2] <= day).slice(0, 420);
  let pairs = 0;
  for (const x of rows) for (const y of rows) {
    const xy = K.ngKnowledgeMergeRow(x, y, day), yx = K.ngKnowledgeMergeRow(y, x, day);
    assert.deepEqual(xy, yx, `${x} | ${y}`);
    assert.deepEqual(K.ngKnowledgeMergeRow(xy, xy, day), xy, `idempotent on ${xy}`);
    // a second pull after one exchange writes nothing (the heal from a beaten row of the winner's own day takes that row as
    // it is, pair and all: written as a fresh anchor, it lost the pair-text tie to the row it came from)
    assert.deepEqual(K.ngKnowledgeMergeRow(x, xy, day), xy, `absorbed by ${x}: ${x} | ${y}`);
    assert.deepEqual(K.ngKnowledgeMergeRow(y, xy, day), xy, `absorbed by ${y}: ${x} | ${y}`);
    assert.ok(xy[0] >= Math.min(x[0], y[0]), `${x} | ${y}: never sooner than both`);
    pairs++;
  }
  assert.ok(pairs > 100000, `${pairs} pairs`);
  // the case that found it: a fresh 3-day row against a between-steps row of the same day holding 8 days
  const y8 = [1008, 7, 1000, 7, 999];
  assert.deepEqual(K.ngKnowledgeMergeRow([1003, 3, 1000], y8, 1400), y8);
  assert.deepEqual(K.ngKnowledgeMergeRow(y8, K.ngKnowledgeMergeRow([1003, 3, 1000], y8, 1400), 1400), y8);
});

test("the moves merge: the same three rules, the answer and the later build's cells kept", () => {
  const day = 1400, rows = POP_MOVES.filter((r) => r[2] <= day).slice(0, 300);
  let pairs = 0;
  for (const x of rows) for (const y of rows) {
    const xy = ngProgressMergeMoves({ s: { m: x } }, { s: { m: y } }, day).s.m, yx = ngProgressMergeMoves({ s: { m: y } }, { s: { m: x } }, day).s.m;
    assert.deepEqual(xy, yx, `${x} | ${y}`);
    assert.deepEqual(ngProgressMergeMoves({ s: { m: xy } }, { s: { m: xy } }, day).s.m, xy, `idempotent on ${xy}`);
    // absorbed after one exchange, where both answers agree (a later-same-day No over a healed Yes re-writes the row on dev
    // too, by the No-first tie: 150 of 4,900 pairs of dev's own rows; not this change)
    if (x[3] === y[3]) for (const z of [x, y]) assert.deepEqual(ngProgressMergeMoves({ s: { m: z } }, { s: { m: xy } }, day).s.m, xy, `absorbed by ${z}: ${x} | ${y}`);
    pairs++;
  }
  assert.ok(pairs > 50000, `${pairs} pairs`);
  // a same-day heal takes the beaten row as it is, the winner's answer kept
  assert.deepEqual(ngProgressMergeMoves({ s: { m: [1003, 3, 1000, 1] } }, { s: { m: [1008, 7, 1000, 1, 7, 999] } }, 1400).s.m, [1008, 7, 1000, 1, 7, 999]);
  // the heal to an exact interval that is not whole, the winner's Yes kept
  assert.deepEqual(ngProgressMergeMoves({ s: { m: [13, 3, 10, 1] } }, { s: { m: moves(W([14, 14, 0], true, 5)) } }, 100).s.m, [30, 14, 10, 1, 14 + (5 * 16) / 14, 10]);
});

test("an older client: its merges keep the due day of a row with a pair, and its writers never send it to 1 day", () => {
  let checked = 0;
  for (const [name, c] of Object.entries(clients)) {
    for (const r of POP) {
      const today = r[2] + 3;
      // it pulls the row: the due it keeps is the row's, never sooner; the pair is dropped or kept, and read only if it checks
      const kept = c.merge(undefined, r, today);
      assert.equal(kept[0], r[0], `${name} pulls ${r}`);
      assert.deepEqual(kept.slice(0, 3), [r[0], r[1], r[2]]);
      // it answers the row right: never back to 1 day (its own ladder climbs from the cell), never sooner than its own reading
      const back = c.write(r, true, r[0]);
      assert.ok(back[0] - back[2] >= 3 || K.ngKnowledgeInterval(r) < 3, `${name} on ${r}: ${back}`);
      checked++;
    }
  }
  assert.ok(checked > 2000, `${checked}`);
});

// THE STALE PAIR, said plainly (LIN1-R2, the reader's D2): an older moves writer keeps the cells after the fourth, so the pair
// rides behind its own new due. Where it still passes its check (0.01% to 0.21% of such answers in the reader's runs), the next
// due is never sooner than the row and never beyond one on-time answer; against the same row read as its own it moves the due
// SOONER, against the player, by up to 13 days, and later by up to 10 (the reader's figures; this file's own population below)
test("an older client's moves writer leaves a pair behind its own new due: never sooner than the row, never beyond one on-time answer, up to 13 days against the player", () => {
  let older = 0, passed = 0, answers = 0, against = 0, favour = 0, mostAgainst = 0, mostFavour = 0;
  for (const [name, c] of Object.entries(clients)) for (const r of POP_MOVES.filter((m) => m.length >= 6)) {
    for (const d of [r[2], r[2] + 1, r[0] - 1, r[0], r[0] + 20]) for (const ok of [true, false]) {
      if (d < r[2]) continue;
      const o = c.grade(r, ok, d); older++;
      const stripped = o.slice(0, 4), a = K.ngKnowledgeAnchor(o, 4);
      if (a.t0 === o[2] && a.A === K.ngKnowledgeInterval(stripped, 4)) continue;
      passed++;
      const onTime = W(stripped, true, o[0], 4)[0];
      for (let t = o[2]; t <= o[0] + 30; t++) {
        const n = W(o, true, t, 4)[0], asOwn = W(stripped, true, t, 4)[0];
        assert.ok(n >= o[0], `${name}: ${o} answered on ${t}: ${n} is sooner`);
        if (t <= o[0]) assert.ok(n <= onTime, `${name}: ${o} answered on ${t}: ${n} beyond one on-time answer, ${onTime}`);
        if (n < asOwn) { against++; mostAgainst = Math.max(mostAgainst, asOwn - n); } else if (n > asOwn) { favour++; mostFavour = Math.max(mostFavour, n - asOwn); }
        answers++;
      }
    }
  }
  assert.ok(older > 5000 && passed > 0 && answers > 1000, `${older} older answers, ${passed} stale pairs still checking, ${answers} next answers`);
  assert.ok(mostAgainst <= 13 && mostFavour <= 10, `against the player by up to ${mostAgainst} days, in its favour by up to ${mostFavour}`);
  console.log(`older moves answers ${older}, stale pairs that still check ${passed}, next answers on them ${answers}: none sooner than the row, none beyond one on-time answer; against the row read as its own, sooner (against the player) in ${against} by up to ${mostAgainst} days, later in ${favour} by up to ${mostFavour}`);
});

test("the replay and the base row carry the pair: an entry replayed between steps is delivered on its exact row", async () => {
  const src = readFileSync(new URL("../neural/src/progress-owner.src.js", import.meta.url), "utf8");
  assert.ok(src.includes("row = write(row, e[4] === 1, e[5], field ? 4 : 3);"), "the replay writes the whole row");
  assert.ok(src.includes("head.concat(r.slice(3));"), "the base row keeps an srs row's pair");
  assert.ok(src.includes("write: (p, ok, d, at) => inst._scheduleWrite(p, ok, d, at)"), "the host passes the pair's place");
});
