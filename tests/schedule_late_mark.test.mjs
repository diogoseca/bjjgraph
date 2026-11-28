// THE LATE MARK (v1.305.0, LATE1, the rating's correction) — neural/src/knowledge-profile.src.js (`ngKnowledgeMark`,
// `ngKnowledgeShadow`, the writer's `ngKnowledgeRowOut`, the pull merge `ngKnowledgeMergeRow`), its copies in
// neural/src/rating.src.js (`ngRatingReadInterval`, read by `ngRatingRecall`, which Practice's worth reads too) and
// neural/src/progress-owner.src.js (`ngProgressMark`, the moves merge).
//
// WHY: the late rule stretches a card's interval without its memory being stronger, and the rating read a longer
// `due − last` as better recall (LATE1 Part A: 16 to 31 points high while true recall fell). The row alone cannot say a row was
// stretched (a 30-day card on its due and a 3-day card answered 30 days after its last answer both store [last + 60, 60,
// last]), so a stretched row stores [R, I, L] after the pair's slot: R the interval the one-step schedule would hold after the
// same answers, I the row's own exact interval and L the day of its answer (the mark's checks; L since LATEFIX1, the reader's
// F1). The rating reads R; the schedule never reads the mark.
//
// LATE2 (v1.305.0, the late rule's final form, U226 a; the ladder past 4 years the fitted curve's): the mark is unchanged in
// code. Its one-step schedule is the captured one-step code ON HIS LADDER (`onestepNow`, tests/_onestep_client.mjs), which is
// v1.304.0's below 4 years; on its due day a card is no longer stretched (the rule is one step there; LATE1's first form
// marked the 60-day card's due day); and an older build's row past 4 years, made on v1.304.0's doubling line, can read another
// interval here (none exists: the first card to wait 4 years is due in 2030). Restated below, none removed: the bit-for-bit
// claim below 4 years with the rows past them counted, the 60-day card's example a day late, and the one-device equality
// against the one-step schedule on his ladder (64,000 of 64,000) with v1.304.0 kept as a never-above bound.
//
// THE CLAIMS:
//   · every row written before this build reads exactly as v1.304.0's rating reads it, bit for bit: the rows of the four
//     captured older writers over long histories, srs and moves, and the stored record the rating journey reads
//     (tests/_rating_fixture.mjs), so no rating moves at the update;
//   · a stretched row reads at the one-step interval: on one device, every card reads as the one-step schedule on his ladder
//     reads its own row for the same answers, never above (measured: equal in every one of 64,000 readings over 800
//     histories, srs and moves, early, on time, late and very late, with misses), and never above v1.304.0's;
//   · the mark checks itself: an older build's later answer (it copies the cells forward), a clamped pull, a damaged mark;
//   · an older build's CHAIN of answers never makes a stale mark count again (LATEFIX1, the reader's F1): a miss, then a climb
//     back to exactly the mark's interval, through v1.304.0's writer, its moves merge (captured) and its journal replay;
//   · it rides through this build's pull merge, and the heal writes its own; the three copies agree on every row shape;
//   · a full tie on a moves row (one schedule, two marks that both check) settles the same on this build and an older one, so
//     the cloud never flips between them (LATEFIX1, the reader's F2; its flip script, rounds and rows, is the test).
//
// MUTANTS (v1.305.0), each applied alone and run against this file and the schedule unit files; each turned the NAMED test red
// (the run is in docs/Changelog-Archive.md, v1.305.0):
//   K1  the rating ignores the mark (`ngRatingReadInterval` returns the schedule's) → "a stretched row reads at the one-step…"
//   K2  the shadow ignores the prior's mark (no chain)                           → "on one device, every card reads as the…"
//   K3  the mark's check dropped (`ivl === I`)                                   → "the mark checks itself…"
//   K4  the pull merge drops the cloud's mark                                    → "the pull merge carries the mark…"
//   K5  the heal writes no mark                                                  → "the pull merge carries the mark…"
//   K6  a full tie without the reading (the text decides)                        → tests/schedule_linear.test.mjs, "the srs merge…"
//   L1  the mark's day check dropped (LATEFIX1; all three copies)                 → "an older build's chain of answers never makes…"
//       and "the mark checks itself…"
//   L2  the moves merge's reading tie back (LATE1's)                             → "a full tie on a moves row settles the same…"
//   L3  the moves same-day heal reads the longer of the two readings again       → "a full tie on a moves row settles the same…"
//
// Run: node --test tests/schedule_late_mark.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as K from "../neural/src/knowledge-profile.src.js";
import * as R from "../neural/src/rating.src.js";
import { ngProgressMark, ngProgressMergeMoves, ngProgressReplay, ngProgressValidateBlob } from "../neural/src/progress-owner.src.js";
import { onestep, onestepRecall, onestepNow, onestepNowRecall, onestepMergeMoves, schedulePart } from "./_onestep_client.mjs";
import { ratingFixture } from "./_rating_fixture.mjs";

const W = K.ngKnowledgeScheduleRow, L = K.NG_KNOWLEDGE_LADDER, cell = K.ngKnowledgeCell;
const json = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const LIN1 = json("./artifacts/schedule_lin1_client.json"), PREV = json("./artifacts/schedule_prev_client.json"), OLD = json("./artifacts/schedule_old_client.json");
const lin1 = new Function(LIN1.knowledge.ladder + "\n" + LIN1.knowledge.schedule + "\nreturn ngKnowledgeScheduleRow;")();
const prev = new Function(PREV.knowledge.ladder + "\n" + PREV.knowledge.schedule + "\nreturn ngKnowledgeScheduleRow;")();
const oldWrite = new Function(OLD.knowledge.intervals + "\n" + OLD.knowledge.scheduleRow + "\nreturn ngKnowledgeScheduleRow;")();
const lcg = (s) => () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const D = 20400;
const moves = (row) => row.slice(0, 3).concat(1, row.slice(3));
// a history of answers: right four times in five, each a fraction of the row's interval after its last (early, on time,
// late, very late), from a first answer
function history(rnd, n) {
  const out = []; let day = D, ivl = 1;
  for (let i = 0; i < n; i++) { day += Math.max(0, Math.floor(ivl * (rnd() < 0.15 ? 3 + rnd() * 20 : 0.1 + rnd() * 1.9))); const ok = rnd() < 0.8; out.push([day, ok]); ivl = ok ? Math.max(1, ivl * 2) : 1; }
  return out;
}
const readsAt = (row, at) => [row[2], row[0], row[0] + 3, row[2] + 2 * Math.max(1, row[0] - row[2]) + 1, row[2] + 500];

test("every row written before this build reads exactly as v1.304.0's rating reads it below 4 years, bit for bit (every row that can exist today: no rating moves at the update)", () => {
  // SINCE LATE2 the ladder past 4 years is the fitted curve's (U226 a), so an older build's row on a stretch past 4 years can
  // read another interval here: its pair, made on v1.304.0's doubling line, may fail its check (then the row reads its own
  // whole-day interval, a little longer) or check on the new line (a little shorter, under a day). No such row exists: rows
  // began on 16 Aug 2026 and none can hold more than about 242 days today; the first card to wait 4 years is due in 2030
  const rnd = lcg(11);
  let n = 0, past = 0, pastSame = 0, pastAbove = 0;
  for (const [name, write, at] of [["v1.304.0", onestep.write, 3], ["v1.304.0 moves", onestep.write, 4], ["v1.281.0", lin1, 3], ["v1.280.2", prev, 3], ["v1.278.2", oldWrite, 3]]) {
    for (let h = 0; h < 120; h++) {
      let row = null;
      for (const [day, ok] of history(rnd, 14)) {
        row = at === 4 ? write(row && row, ok, day, 4) : write(row, ok, day);
        if (at === 4 && row.length < 4) row = row.concat(ok ? 1 : 0);
        assert.ok(row.length <= at + 2, `${name}: ${row} carries nothing after the pair`);
        const young = onestep.interval(row, at) < 1461;
        for (const d of readsAt(row, at)) for (const right of [true, false]) {
          const x = R.ngRatingRecall(row, right, d, at), y = onestepRecall(row, right, d, at);
          if (young) { assert.equal(x, y, `${name}: ${row} on day ${d}`); n++; continue; }
          past++; if (x === y) pastSame++; else if (x > y) pastAbove++;
        }
      }
    }
  }
  // past 4 years, as measured on these histories: 770 readings, 766 the same, 4 higher (a pair that fails its check on the
  // new line), none lower
  assert.deepEqual([past, pastSame, pastAbove], [770, 766, 4], "the older builds' rows past 4 years");
  // and the one shape that reads lower, said in a row: v1.304.0's card one day into the 8-year rung's line (its pair [2922,
  // last − 1], due 2,923 days on) reads 2,922.89 days here (the new line, whose next rung is 5,525), 2,923 there
  const eight = [D + 2923, 120, D, 2922, D - 1];
  assert.equal(onestep.interval(eight), 2923);
  assert.equal(R.ngRatingSchedInterval(eight, 3), 2922 + 2603 / 2922);
  // the stored record the rating journey reads (tests/_rating_fixture.mjs): every srs and moves row of it
  const here = dirname(fileURLToPath(import.meta.url)), FIX = ratingFixture(resolve(here, "../source/quartz/static/neural"));
  let f = 0;
  for (const deck of Object.values(FIX.blob.srs)) for (const row of Object.values(deck)) for (const d of readsAt(row, 3)) {
    assert.equal(R.ngRatingRecall(row, true, d), onestepRecall(row, true, d), `the fixture's ${row} on day ${d}`); f++;
  }
  for (const seat of Object.values(FIX.blob.moves)) for (const row of Object.values(seat)) for (const d of readsAt(row, 4)) {
    assert.equal(R.ngRatingRecall(row, row[3] === 1, d, 4), onestepRecall(row, row[3] === 1, d, 4), `the fixture's move ${row} on day ${d}`); f++;
  }
  assert.ok(n > 40000 && f > 50, `${n} readings of older writers' rows below 4 years, ${f} of the fixture's`);
});

test("a stretched row reads at the one-step interval: the 3-day card 75 days on reads 0.9 a week later, the 60-day card at 90 days", () => {
  const r = W([D + 3, 3, D], true, D + 75);
  assert.deepEqual(r, [D + 75 + 150, 120, D + 75, 0, 0, 7, 150, D + 75], "due in 150 days, its late mark 7 (one step from 3), of the answer on day D + 75");
  assert.ok(Math.abs(R.ngRatingRecall(r, true, D + 82) - 0.9) < 1e-12, "read at 7 days: 0.9 a week on");
  assert.ok(R.ngRatingRecall(r.slice(0, 3), true, D + 82) > 0.99, "read at 150 (the row without its mark): 0.995");
  assert.equal(R.ngRatingRecall(r, true, D + 82), onestepRecall(onestep.write([D + 3, 3, D], true, D + 75), true, D + 82), "as the one-step client reads its own row");
  // the 60-day card a day late (LATE2: 1.5 × the 61 days, 91.5; on its due day it takes one step, 90, and is not stretched)
  const s = W([D + 60, 60, D], true, D + 61);
  assert.deepEqual(s, [D + 61 + 92, 60, D + 61, 91.5, D + 61, 90, 91.5, D + 61]);
  assert.ok(Math.abs(R.ngRatingRecall(s, true, D + 151) - 0.9) < 1e-12, "the 60-day card a day late: due in 91.5, read at 90");
  assert.ok(Math.abs(R.ngRatingRecall([D + 61 + 92, 60, D + 61, 91.5, D + 61], true, D + 151) - Math.pow(0.9, 90 / 91.5)) < 1e-12, "without its mark: at 91.5");
  // the moves layout reads the same, the answer at [3]
  const m = W([D + 3, 3, D, 1], true, D + 75, 4);
  assert.deepEqual(m, [D + 225, 120, D + 75, 1, 0, 0, 7, 150, D + 75]);
  assert.ok(Math.abs(R.ngRatingRecall(m, true, D + 82, 4) - 0.9) < 1e-12);
  // a row the late rule did not stretch carries nothing: on its due day on every rung (the 60-day one too, since LATE2), and
  // every early answer
  for (const rung of L.slice(0, 16)) assert.equal(W([D + rung, cell(rung), D], true, D + rung).length <= 5, true, `the ${rung}-day rung on its due`);
  assert.deepEqual(W([D + 30, 30, D], true, D + 29), [D + 88, 30, D + 29, 30, D]);
});

test("on one device, every card reads as the one-step schedule on his ladder reads its own row for the same answers, and never above v1.304.0's", () => {
  // the one-step schedule is `onestepNow` since LATE2 (the captured v1.304.0 code on his final ladder: the mark's R is one step
  // on today's ladder); v1.304.0 itself, whose ladder doubled past 2,922 days, reads a card that went past 4 years a little
  // higher, so against it the claim is never above
  const rnd = lcg(29);
  let n = 0, equal = 0, below = 0, marked = 0, worst = 0, equalOld = 0, belowOld = 0;
  for (const at of [3, 4]) for (let h = 0; h < 400; h++) {
    let a = null, b = null, c = null;
    for (const [day, ok] of history(rnd, 16)) {
      a = W(a, ok, day, at); b = onestepNow.write(b, ok, day, at); c = onestep.write(c, ok, day, at);
      if (at === 4) { for (const r of [a, b, c]) if (r.length < 4) r.push(ok ? 1 : 0); }
      if ((at === 3 ? K.ngKnowledgeMark(a) : ngProgressMark(a)) !== null) marked++;
      const right = at === 4 ? a[3] === 1 : a[1] > 1, rt = (r) => (at === 4 ? r[3] === 1 : r[1] > 1);
      for (const d of [day, day + 1, a[0], b[0], day + 400]) {
        const x = R.ngRatingRecall(a, right, d, at), y = onestepNowRecall(b, rt(b), d, at), z = onestepRecall(c, rt(c), d, at);
        assert.ok(x <= y + 1e-9, `${at}: ${a} reads ${x} on day ${d}, above the one-step schedule's ${y} (${b})`);
        assert.ok(x <= z + 1e-9, `${at}: ${a} reads ${x} on day ${d}, above v1.304.0's ${z} (${c})`);
        assert.ok(x <= onestepNowRecall(a.slice(0, at + 2), right, d, at) + 1e-12, `${a}: never above its own uncorrected reading`);
        if (Math.abs(x - y) < 1e-9) equal++; else { below++; worst = Math.max(worst, y - x); }
        if (Math.abs(x - z) < 1e-9) equalOld++; else belowOld++;
        n++;
      }
    }
  }
  assert.ok(n > 50000 && marked > 2000, `${n} readings, ${marked} rows marked`);
  // measured: every reading exactly the one-step schedule's on his ladder (64,000 of 64,000); never above is the claim, equal
  // is the measure; against v1.304.0, 516 readings lower (the cards that went past 4 years, where its ladder doubled)
  assert.deepEqual([n, equal, below], [64000, 64000, 0], `${equal} of ${n} equal, ${below} below (worst ${worst})`);
  assert.deepEqual([equalOld, belowOld], [63484, 516], "against v1.304.0");
  console.log(`late mark: ${n} readings, ${equal} equal to the one-step schedule's on his ladder, ${below} below (worst by ${worst.toFixed(4)}), ${marked} marked rows; ${belowOld} below v1.304.0's`);
});

test("the mark checks itself: an older build's later answer, a clamped pull, a damaged mark", () => {
  const r = W([D + 3, 3, D], true, D + 75);   // [D + 225, 120, D + 75, 0, 0, 7, 150, D + 75]
  assert.equal(K.ngKnowledgeMark(r), 7);
  // the one-step client (and every v1.281.x build) answers it later: it copies the cells after the pair forward under its own
  // new answer, so the mark fails its check (its day is not the row's last) and the row reads as that build wrote it
  for (const d of [D + 100, D + 225, D + 300]) {
    const o = onestep.write(r, true, d);
    assert.deepEqual(o.slice(5), [7, 150, D + 75], `premise: the one-step client copied the cells on day ${d}`);
    assert.equal(K.ngKnowledgeMark(o), null, `day ${d}: stale`);
    assert.equal(R.ngRatingReadInterval(o, 3), K.ngKnowledgeInterval(o), `day ${d}: read as its own interval`);
    assert.equal(R.ngRatingRecall(o, true, d + 9), onestepRecall(o, true, d + 9), `day ${d}: as v1.304.0 reads it`);
  }
  // the same day (no day waited) the one-step client keeps the row as it was, and the mark still describes it
  assert.equal(K.ngKnowledgeMark(onestep.write(r, true, D + 75)), 7);
  // a miss by the one-step client: one day, the copied mark stale
  assert.equal(K.ngKnowledgeMark(onestep.write(r, false, D + 80)), null);
  // a pull clamps a fast clock's `last`: the interval read grows, the mark fails, the row reads its longer interval
  const clamped = K.ngKnowledgeMergeRow(undefined, r, D + 70);
  assert.deepEqual(clamped, [D + 225, 120, D + 70, 0, 0, 7, 150, D + 75]);
  assert.equal(K.ngKnowledgeMark(clamped), null);
  // damaged: R not below I, R below 1, I not the row's interval, not numbers; the day not the row's last (LATEFIX1), or
  // missing (LATE1's two-cell form, never shipped); and the [0, 0, 0] that fills an empty slot. Each tail differs from the
  // valid one in ONE cell, so each case is decided by its own condition (the valid one first, as the control)
  const L = D + 75, valid = r.slice(0, 5).concat([7, 150, L]);
  assert.equal(K.ngKnowledgeMark(valid), 7);
  assert.equal(R.ngRatingReadInterval(valid, 3), 7);
  assert.equal(ngProgressMark(moves(valid)), 7);
  for (const tail of [[150, 150, L], [151, 150, L], [0.5, 150, L], [7, 149, L], [7, 151, L], [NaN, 150, L], [7, Infinity, L],
    [7, 150, L - 1], [7, 150, L + 1], [7, 150, NaN], [7, 150], [0, 0, 0]]) {
    const x = r.slice(0, 5).concat(tail);
    assert.equal(K.ngKnowledgeMark(x), null, `${tail}`);
    assert.equal(R.ngRatingReadInterval(x, 3), 150, `${tail}: read at its own interval`);
    assert.equal(ngProgressMark(moves(x)), null, `${tail} (moves)`);
  }
});

// LATEFIX1 (the reader of PR #472, F1): every build from v1.281.0 to v1.304.x keeps the cells after the pair (its writer copies
// them on every answer, its moves merge keeps a cloud row's tail, its journal replay rebuilds on the cloud's row with the tail),
// and its answers can bring a card back to EXACTLY the interval a stale mark names: a miss, then on-time answers. Until the mark
// carried its answer's day, the stale mark then checked again and this build read the card a rung low for good (60 where the
// one-step schedule and v1.304.1 read 90; its next answers 90, 180, 365 for 180, 365, 730). The day closes it: an older build's
// answer always moves the row's last, except an answer on the same day, which either leaves the row as it was (an early right
// answer with no day waited: the mark still describes it) or sends it to 1 day (a miss: no mark checks at 1 day)
test("an older build's chain of answers never makes a stale mark count again: a miss, then a climb back to the same interval, through its writer, its moves merge and its journal replay (LATEFIX1)", () => {
  const D0 = 21000;
  const climb = (row, at, write) => {   // a miss on the due day, then six right answers each on its due day
    let r = write(row, false, row[0], at);
    for (let i = 0; i < 6; i++) r = write(r, true, r[0], at);
    return r;
  };
  // the one-step schedule over the same answers, for the reading every build should agree on
  const oneStep = (prior, at, firstDay) => { let x = onestepNow.write(prior, true, firstDay, at); x = onestepNow.write(x, false, x[0], at); for (let i = 0; i < 6; i++) x = onestepNow.write(x, true, x[0], at); return x; };
  // (1) A MOVES ROW, the reader's case: this build answers a 30-day move 45 days after its last answer (twice 45: 90, marked 60)
  const prior = [D0 - 15, 30, D0 - 45, 1], a = W(prior, true, D0, 4);
  assert.deepEqual(a, [D0 + 90, 60, D0, 1, 0, 0, 60, 90, D0], "premise: stretched and marked on its answer's day");
  // v1.304.0's moves merge (captured) pulls it and keeps it whole; that build misses it and climbs back to 90 days
  const pulled = onestepMergeMoves({ s: { m: prior.slice() } }, { s: { m: a.slice() } }, D0).s.m;
  assert.deepEqual(pulled, a, "premise: the older merge keeps the cells");
  const b = climb(pulled, 4, onestep.write);
  assert.deepEqual(b.slice(5), [0, 60, 90, D0], "premise: the older writer copied the stale mark forward");
  assert.equal(onestep.interval(b, 4), 90, "premise: back at exactly the mark's interval");
  // this build pulls it back: the stale mark does not count, and the card reads as v1.304.0 and the one-step schedule read it
  const c = ngProgressMergeMoves({ s: { m: a.slice() } }, { s: { m: b.slice() } }, b[2]).s.m, ref = oneStep(prior, 4, D0);
  assert.equal(ngProgressMark(c), null, "the stale mark (progress-owner's copy)");
  assert.equal(K.ngKnowledgeMark(c, 4), null, "the stale mark (the law)");
  assert.deepEqual([R.ngRatingReadInterval(c, 4), onestepNow.interval(ref, 4)], [90, 90], "read at 90, the one-step schedule's (it read 60)");
  assert.equal(R.ngRatingRecall(c, true, c[2] + 30, 4), onestepRecall(c, true, c[2] + 30, 4), "recall as v1.304.0 reads it");
  // and this build's next answers on time read as the one-step schedule does, not a rung behind
  let e = c, f = ref;
  for (const want of [180, 365, 730]) {
    const d = e[0]; e = W(e, true, d, 4); f = onestepNow.write(f, true, d, 4);
    assert.deepEqual([R.ngRatingReadInterval(e, 4), onestepNow.interval(f, 4)], [want, want], `on time: ${want}`);
  }
  // (2) AN SRS ROW, through the older writer (an older tab on the same browser answers the row this build stored)
  const sp = [D0 - 15, 30, D0 - 45], sa = W(sp, true, D0), sb = climb(sa, 3, onestep.write);
  assert.deepEqual([sb.slice(3), onestep.interval(sb)], [[0, 0, 60, 90, D0], 90], "premise: the stale mark carried, at 90 again");
  assert.equal(K.ngKnowledgeMark(sb), null);
  assert.deepEqual([R.ngRatingReadInterval(sb, 3), onestepNow.interval(oneStep(sp, 3, D0))], [90, 90]);
  // (3) THE OLDER JOURNAL REPLAY: its replay (byte for byte this build's `ngProgressReplay`) with its own writer rebuilds a
  // miss onto the cloud's marked row, cells kept; that build then climbs back to 90
  const cloud = { v: 2, srs: { d: { q: sa.slice() } } }, miss = [1, 0, "d", "q", 0, sa[0], [sa[0] + 1, 1, sa[0]]];
  const rep = ngProgressReplay({ v: 2, srs: { d: { q: miss[6] } } }, cloud, [miss], onestep.write, sa[0]);
  const replayed = rep.blob.srs.d.q;
  assert.deepEqual(replayed, [sa[0] + 1, 1, sa[0], 0, 0, 60, 90, D0], "premise: the replayed miss carries the cells");
  let rr = replayed;
  for (let i = 0; i < 6; i++) rr = onestep.write(rr, true, rr[0]);
  assert.deepEqual([onestep.interval(rr), rr.slice(5)], [90, [60, 90, D0]], "premise: back at 90 with the stale mark");
  assert.equal(K.ngKnowledgeMark(rr), null);
  assert.equal(R.ngRatingReadInterval(rr, 3), 90);
  // (4) THE SAME DAY: an older build's answer on the mark's own day either keeps the row (early, no day waited: the mark still
  // describes it, and still counts) or misses it (1 day: no mark checks there, then or after any climb)
  const same = onestep.write(sa, true, D0);
  assert.deepEqual(same, sa, "premise: kept as it was");
  assert.equal(K.ngKnowledgeMark(same), 60);
  const sameMiss = onestep.write(sa, false, D0);
  assert.deepEqual([sameMiss.slice(0, 3), K.ngKnowledgeMark(sameMiss)], [[D0 + 1, 1, D0], null]);
  assert.equal(K.ngKnowledgeMark(climb(sameMiss, 3, onestep.write)), null);
});

// LATEFIX1 (the reader of PR #472, F2): one schedule, two marks that both check (two devices whose histories differ, answered
// late on the same day to the same interval). LATE1's moves merge let the longer one-step reading decide such a tie, and every
// build from v1.281.0 to v1.304.x lets the tail's text decide it (their moves merge keeps the cells after the pair), so a
// device on this build and one on an older build kept different rows and the cloud flipped on every push between them. The
// moves merge now settles a full tie by the same text, and its same-day heal keeps the beaten row as it is (read as it reads),
// so a second pull writes nothing. (The srs merge keeps LATE1's reading tie: older builds pull srs rows without the cells, so
// they hold the unmarked row, which always reads longer: the reading tie is what settles beside them.)
test("a full tie on a moves row settles the same on this build and an older one: the cloud never flips (LATEFIX1)", () => {
  const t = 20141, rounds = (a, b, mergeA, mergeB) => {
    let cloud = b.slice(), x = a.slice(), y = b.slice();
    const out = [];
    for (let i = 0; i < 3; i++) {
      x = mergeA({ s: { m: x } }, { s: { m: cloud } }, t).s.m; cloud = x.slice(); const c1 = cloud.slice();
      y = mergeB({ s: { m: y } }, { s: { m: cloud } }, t).s.m; cloud = y.slice();
      out.push([c1, cloud.slice()]);
    }
    return out;
  };
  // (1) the reader's script, verbatim rows (LATE1's two-cell marks: since LATEFIX1 neither is read)
  const ra = [t, 30, 20105, 1, 0, 0, 7, 36], rb = [t, 30, 20105, 1, 0, 0, 3, 36];
  assert.deepEqual([ngProgressMark(ra), ngProgressMark(rb)], [null, null]);
  for (const [afterThis, afterOld] of rounds(ra, rb, ngProgressMergeMoves, onestepMergeMoves)) assert.deepEqual([afterThis, afterOld], [rb, rb], "the reader's rows: settled");
  // (2) the same with three-cell marks that both check
  const a = [t, 30, 20105, 1, 0, 0, 7, 36, 20105], b = [t, 30, 20105, 1, 0, 0, 3, 36, 20105];
  assert.deepEqual([ngProgressMark(a), ngProgressMark(b)], [7, 3], "premise: both marks check");
  const older = onestepMergeMoves({ s: { m: a.slice() } }, { s: { m: b.slice() } }, t).s.m;
  assert.deepEqual(older, b, "premise: v1.304.0 keeps the smaller tail text");
  for (const [x, y] of [[a, b], [b, a]]) {
    assert.deepEqual(ngProgressMergeMoves({ s: { m: x.slice() } }, { s: { m: y.slice() } }, t).s.m, older, `this build keeps the same row (${x[6]} local)`);
    for (const [afterThis, afterOld] of rounds(x, y, ngProgressMergeMoves, onestepMergeMoves)) assert.deepEqual([afterThis, afterOld], [b, b], "every round: one row, both builds");
  }
  // (3) the same-day heal keeps the beaten row as it is: a fresh 30-day answer on the stretched row's own day beats it (smaller
  // cell) and heals to its 150 days, read at that row's own 7 (LATE1 wrote the winner's longer 30, which the tail's text could
  // then hand back to the beaten row on the next pull); a second pull, on either build, writes nothing
  const mv = W([D + 3, 3, D, 1], true, D + 75, 4), w30 = [D + 105, 30, D + 75, 1];
  const healed = ngProgressMergeMoves({ s: { m: w30 } }, { s: { m: mv } }, D + 90).s.m;
  assert.deepEqual(healed, [D + 225, 120, D + 75, 1, 0, 0, 7, 150, D + 75]);
  assert.deepEqual(ngProgressMergeMoves({ s: { m: mv } }, { s: { m: w30 } }, D + 90).s.m, healed);
  for (const z of [mv, healed]) {
    assert.deepEqual(ngProgressMergeMoves({ s: { m: healed } }, { s: { m: z } }, D + 90).s.m, healed, "absorbed");
    assert.deepEqual(ngProgressMergeMoves({ s: { m: z } }, { s: { m: healed } }, D + 90).s.m, healed, "absorbed, the other order");
  }
  // a fresh anchor at the winner's later day still reads at the longer of the two one-step readings (as the srs heal)
  assert.deepEqual(ngProgressMergeMoves({ s: { m: [D + 106, 30, D + 76, 1] } }, { s: { m: mv } }, D + 90).s.m, [D + 226, 120, D + 76, 1, 0, 0, 30, 150, D + 76]);
  assert.deepEqual(K.ngKnowledgeMergeRow([D + 106, 30, D + 76], W([D + 3, 3, D], true, D + 75), D + 90), [D + 226, 120, D + 76, 0, 0, 30, 150, D + 76]);
});

test("the pull merge carries the mark, and the heal writes its own; the three copies agree on every row shape", () => {
  const r = W([D + 3, 3, D], true, D + 75);
  // a card only the cloud holds, and the cloud's later answer over an older local row
  assert.deepEqual(K.ngKnowledgeMergeRow(undefined, r, D + 90), r);
  assert.deepEqual(K.ngKnowledgeMergeRow([D + 10, 3, D + 3], r, D + 90), r);
  assert.deepEqual(K.ngKnowledgeMergeRow(r, [D + 10, 3, D + 3], D + 90), r, "the local stretched row wins whole");
  // the heal: a fresh 3-day answer on the same day beats the stretched row (smaller cell) and heals to its 150 days; it reads
  // at the longer of the two one-step readings (7 and 3): 7
  const fresh = [D + 78, 3, D + 75];
  assert.deepEqual(K.ngKnowledgeMergeRow(fresh, r, D + 90), [D + 225, 120, D + 75, 0, 0, 7, 150, D + 75]);
  assert.deepEqual(K.ngKnowledgeMergeRow(r, fresh, D + 90), [D + 225, 120, D + 75, 0, 0, 7, 150, D + 75]);
  // from an earlier day: a fresh anchor at the winner's last, its own mark for it
  assert.deepEqual(K.ngKnowledgeMergeRow([D + 79, 3, D + 76], r, D + 90), [D + 226, 120, D + 76, 0, 0, 7, 150, D + 76]);
  // where the winner's own reading is the longer, it is the mark's; where it reaches the heal's interval, no mark
  assert.deepEqual(K.ngKnowledgeMergeRow([D + 105, 30, D + 75], r, D + 90), [D + 225, 120, D + 75, 0, 0, 30, 150, D + 75]);
  assert.deepEqual(K.ngKnowledgeMergeRow([D + 105, 30, D + 75], r.slice(0, 3), D + 90), [D + 225, 120, D + 75]);
  // LATEFIX2 (the reader's R2): the cells a later build adds after the mark ride through this build's srs pull, as through
  // its writer and its moves merge: a card only the cloud holds, the cloud's later answer, a full tie (both devices on this
  // build settle at once), and the heal (the winner's cells kept, as the moves heal keeps them)
  const tailed = r.concat(42, 5);
  assert.deepEqual(K.ngKnowledgeMergeRow(undefined, tailed, D + 90), tailed, "pulled alone: the tail rides");
  assert.deepEqual(K.ngKnowledgeMergeRow([D + 10, 3, D + 3], tailed, D + 90), tailed, "the cloud's later answer: the tail rides");
  assert.deepEqual(W(tailed, true, D + 100).slice(8), [42, 5], "premise: this build's writer keeps it too");
  for (const [x, y] of [[tailed, r], [r, tailed]]) {
    let cloud = y.slice(), a = x.slice(), b = y.slice();
    const first = K.ngKnowledgeMergeRow(a, cloud, D + 90);
    for (let i = 0; i < 3; i++) {
      a = K.ngKnowledgeMergeRow(a, cloud, D + 90); cloud = a.slice();
      b = K.ngKnowledgeMergeRow(b, cloud, D + 90); cloud = b.slice();
      assert.deepEqual([a, b, cloud], [first, first, first], `two devices on this build settle at once (round ${i})`);
    }
  }
  const tailedFresh = [D + 78, 3, D + 75, 0, 0, 0, 0, 0, 42];
  assert.deepEqual(K.ngKnowledgeMergeRow(tailedFresh, r, D + 90), [D + 225, 120, D + 75, 0, 0, 7, 150, D + 75, 42], "the heal: the winner's tail after the mark");
  assert.deepEqual(K.ngKnowledgeMergeRow(tailedFresh, r.slice(0, 3), D + 90), [D + 225, 120, D + 75, 0, 0, 0, 0, 0, 42], "the heal with no mark: the slots filled, the tail after them");
  // (the reader's R3) a cloud row whose mark cells are not all numbers pulls to its schedule, never an undefined cell: the
  // two-cell form of LATE1, never shipped; a null where JSON had a number; a damaged mark with a tail after it
  for (const bad of [[D + 225, 120, D + 75, 0, 0, 7, 150], [D + 225, 120, D + 75, 0, 0, 7, 150, null], [D + 225, 120, D + 75, 0, 0, 7, null, D + 75, 42],
    [D + 225, 120, D + 75, 0, 0, 7, 150, D + 75, 42, null]]) {
    const pulled = K.ngKnowledgeMergeRow(undefined, bad, D + 90);
    const want = bad[7] === null || bad[6] === null || bad.length < 8 ? [D + 225, 120, D + 75, 0, 0] : [D + 225, 120, D + 75, 0, 0, 7, 150, D + 75];
    assert.deepEqual(pulled, want, `${JSON.stringify(bad)}`);
    assert.ok(pulled.every((x) => Number.isFinite(x)), `${JSON.stringify(pulled)}: numbers only`);
    assert.doesNotThrow(() => ngProgressValidateBlob({ v: 2, srs: { d: { q: pulled } } }), `${JSON.stringify(pulled)}: the blob validates`);
  }
  // the moves merge the same way
  const mv = W([D + 3, 3, D, 1], true, D + 75, 4), mfresh = [D + 78, 3, D + 75, 1];
  const mm = ngProgressMergeMoves({ s: { m: mfresh } }, { s: { m: mv } }, D + 90).s.m;
  assert.deepEqual(mm, [D + 225, 120, D + 75, 1, 0, 0, 7, 150, D + 75]);
  assert.deepEqual(ngProgressMergeMoves({ s: { m: mv } }, { s: { m: mfresh } }, D + 90).s.m, mm);
  // the copies: the rating's and the moves merge's readers equal the law's on every row the writer makes, marked or not
  const rnd = lcg(3);
  let n = 0, m = 0;
  for (let h = 0; h < 300; h++) {
    let a = null;
    for (const [day, ok] of history(rnd, 14)) {
      a = W(a, ok, day);
      const law = K.ngKnowledgeMark(a);
      assert.equal(R.ngRatingReadInterval(a, 3), law === null ? K.ngKnowledgeInterval(a) : law, `${a}`);
      assert.equal(ngProgressMark(moves(a)), law, `moves ${a}`);
      if (law !== null) m++;
      n++;
    }
  }
  assert.ok(n > 3000 && m > 400, `${n} rows, ${m} marked`);
});
