// THE LATE MARK (v1.305.0, LATE1, the rating's correction) — neural/src/knowledge-profile.src.js (`ngKnowledgeMark`,
// `ngKnowledgeShadow`, the writer's `ngKnowledgeRowOut`, the pull merge `ngKnowledgeMergeRow`), its copies in
// neural/src/rating.src.js (`ngRatingReadInterval`, read by `ngRatingRecall`, which Practice's worth reads too) and
// neural/src/progress-owner.src.js (`ngProgressMark`, the moves merge).
//
// WHY: the doubled wait stretches a card's interval without its memory being stronger, and the rating read a longer
// `due − last` as better recall (LATE1 Part A: 16 to 31 points high while true recall fell). The row alone cannot say a row was
// stretched (a 30-day card on its due and a 3-day card answered 30 days after its last answer both store [last + 60, 60,
// last]), so a stretched row stores [R, I] after the pair's slot: R the interval the one-step schedule would hold after the
// same answers, I the row's own exact interval (the mark's check). The rating reads R; the schedule never reads the mark.
//
// THE CLAIMS:
//   · every row written before this build reads exactly as v1.304.0's rating reads it, bit for bit: the rows of the four
//     captured older writers over long histories, srs and moves, and the stored record the rating journey reads
//     (tests/_rating_fixture.mjs), so no rating moves at the update;
//   · a stretched row reads at the one-step interval: on one device, every card reads as the one-step client reads its own
//     row for the same answers, never above (measured: equal in every one of 64,000 readings over 800 histories, srs and
//     moves, early, on time, late and very late, with misses);
//   · the mark checks itself: an older build's later answer (it copies the cells forward), a clamped pull, a damaged mark;
//   · it rides through this build's pull merge, and the heal writes its own; the three copies agree on every row shape.
//
// MUTANTS (v1.305.0), each applied alone and run against this file and the schedule unit files; each turned the NAMED test red
// (the run is in docs/Changelog-Archive.md, v1.305.0):
//   K1  the rating ignores the mark (`ngRatingReadInterval` returns the schedule's) → "a stretched row reads at the one-step…"
//   K2  the shadow ignores the prior's mark (no chain)                           → "on one device, every card reads as the…"
//   K3  the mark's check dropped (`ivl === I`)                                   → "the mark checks itself…"
//   K4  the pull merge drops the cloud's mark                                    → "the pull merge carries the mark…"
//   K5  the heal writes no mark                                                  → "the pull merge carries the mark…"
//   K6  a full tie without the reading (the text decides)                        → tests/schedule_linear.test.mjs, "the srs merge…"
//
// Run: node --test tests/schedule_late_mark.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as K from "../neural/src/knowledge-profile.src.js";
import * as R from "../neural/src/rating.src.js";
import { ngProgressMark, ngProgressMergeMoves } from "../neural/src/progress-owner.src.js";
import { onestep, onestepRecall, schedulePart } from "./_onestep_client.mjs";
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

test("every row written before this build reads exactly as v1.304.0's rating reads it, bit for bit (no rating moves at the update)", () => {
  const rnd = lcg(11);
  let n = 0;
  for (const [name, write, at] of [["v1.304.0", onestep.write, 3], ["v1.304.0 moves", onestep.write, 4], ["v1.281.0", lin1, 3], ["v1.280.2", prev, 3], ["v1.278.2", oldWrite, 3]]) {
    for (let h = 0; h < 120; h++) {
      let row = null;
      for (const [day, ok] of history(rnd, 14)) {
        row = at === 4 ? write(row && row, ok, day, 4) : write(row, ok, day);
        if (at === 4 && row.length < 4) row = row.concat(ok ? 1 : 0);
        assert.ok(row.length <= at + 2, `${name}: ${row} carries nothing after the pair`);
        for (const d of readsAt(row, at)) for (const right of [true, false]) {
          assert.equal(R.ngRatingRecall(row, right, d, at), onestepRecall(row, right, d, at), `${name}: ${row} on day ${d}`);
          n++;
        }
      }
    }
  }
  // the stored record the rating journey reads (tests/_rating_fixture.mjs): every srs and moves row of it
  const here = dirname(fileURLToPath(import.meta.url)), FIX = ratingFixture(resolve(here, "../source/quartz/static/neural"));
  let f = 0;
  for (const deck of Object.values(FIX.blob.srs)) for (const row of Object.values(deck)) for (const d of readsAt(row, 3)) {
    assert.equal(R.ngRatingRecall(row, true, d), onestepRecall(row, true, d), `the fixture's ${row} on day ${d}`); f++;
  }
  for (const seat of Object.values(FIX.blob.moves)) for (const row of Object.values(seat)) for (const d of readsAt(row, 4)) {
    assert.equal(R.ngRatingRecall(row, row[3] === 1, d, 4), onestepRecall(row, row[3] === 1, d, 4), `the fixture's move ${row} on day ${d}`); f++;
  }
  assert.ok(n > 40000 && f > 50, `${n} readings of older writers' rows, ${f} of the fixture's`);
});

test("a stretched row reads at the one-step interval: the 3-day card 75 days on reads 0.9 a week later, the 60-day card at 90 days", () => {
  const r = W([D + 3, 3, D], true, D + 75);
  assert.deepEqual(r, [D + 75 + 150, 120, D + 75, 0, 0, 7, 150], "due in 150 days, its late mark 7 (one step from 3)");
  assert.ok(Math.abs(R.ngRatingRecall(r, true, D + 82) - 0.9) < 1e-12, "read at 7 days: 0.9 a week on");
  assert.ok(R.ngRatingRecall(r.slice(0, 3), true, D + 82) > 0.99, "read at 150 (the row without its mark): 0.995");
  assert.equal(R.ngRatingRecall(r, true, D + 82), onestepRecall(onestep.write([D + 3, 3, D], true, D + 75), true, D + 82), "as the one-step client reads its own row");
  const s = W([D + 60, 60, D], true, D + 60);
  assert.deepEqual(s, [D + 180, 120, D + 60, 0, 0, 90, 120]);
  assert.ok(Math.abs(R.ngRatingRecall(s, true, D + 150) - 0.9) < 1e-12, "the 60-day card on its due: due in 120, read at 90");
  // the moves layout reads the same, the answer at [3]
  const m = W([D + 3, 3, D, 1], true, D + 75, 4);
  assert.deepEqual(m, [D + 225, 120, D + 75, 1, 0, 0, 7, 150]);
  assert.ok(Math.abs(R.ngRatingRecall(m, true, D + 82, 4) - 0.9) < 1e-12);
  // a row the doubled wait did not stretch carries nothing: on its due day on every rung but 60, and every early answer
  for (const rung of L.slice(0, 12)) if (rung !== 60) assert.equal(W([D + rung, cell(rung), D], true, D + rung).length <= 5, true, `the ${rung}-day rung on its due`);
  assert.deepEqual(W([D + 30, 30, D], true, D + 29), [D + 88, 30, D + 29, 30, D]);
});

test("on one device, every card reads as the one-step client reads its own row for the same answers, or below it, never above", () => {
  const rnd = lcg(29);
  let n = 0, equal = 0, below = 0, marked = 0, worst = 0;
  for (const at of [3, 4]) for (let h = 0; h < 400; h++) {
    let a = null, b = null;
    for (const [day, ok] of history(rnd, 16)) {
      a = W(a, ok, day, at); b = onestep.write(b, ok, day, at);
      if (at === 4) { if (a.length < 4) a = a.concat(ok ? 1 : 0); if (b.length < 4) b = b.concat(ok ? 1 : 0); }
      if ((at === 3 ? K.ngKnowledgeMark(a) : ngProgressMark(a)) !== null) marked++;
      const right = at === 4 ? a[3] === 1 : a[1] > 1;
      for (const d of [day, day + 1, a[0], b[0], day + 400]) {
        const x = R.ngRatingRecall(a, right, d, at), y = onestepRecall(b, at === 4 ? b[3] === 1 : b[1] > 1, d, at);
        assert.ok(x <= y + 1e-9, `${at}: ${a} reads ${x} on day ${d}, above the one-step client's ${y} (${b})`);
        assert.ok(x <= onestepRecall(a.slice(0, at + 2), right, d, at) + 1e-12, `${a}: never above its own uncorrected reading`);
        if (Math.abs(x - y) < 1e-9) equal++; else { below++; worst = Math.max(worst, y - x); }
        n++;
      }
    }
  }
  assert.ok(n > 50000 && marked > 2000, `${n} readings, ${marked} rows marked`);
  // measured: every reading exactly the one-step client's (64,000 of 64,000); never above is the claim, equal is the measure
  assert.deepEqual([n, equal, below], [64000, 64000, 0], `${equal} of ${n} equal, ${below} below (worst ${worst})`);
  console.log(`late mark: ${n} readings, ${equal} equal to the one-step client's, ${below} below (worst by ${worst.toFixed(4)}), ${marked} marked rows`);
});

test("the mark checks itself: an older build's later answer, a clamped pull, a damaged mark", () => {
  const r = W([D + 3, 3, D], true, D + 75);   // [D + 225, 120, D + 75, 0, 0, 7, 150]
  assert.equal(K.ngKnowledgeMark(r), 7);
  // the one-step client (and every v1.281.x build) answers it later: it copies the cells after the pair forward under its own
  // new interval, so the mark fails its check and the row reads as that build wrote it
  for (const d of [D + 100, D + 225, D + 300]) {
    const o = onestep.write(r, true, d);
    assert.deepEqual(o.slice(5), [7, 150], `premise: the one-step client copied the cells on day ${d}`);
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
  assert.deepEqual(clamped, [D + 225, 120, D + 70, 0, 0, 7, 150]);
  assert.equal(K.ngKnowledgeMark(clamped), null);
  // damaged: R not below I, R below 1, I not the row's interval, not numbers; and the [0, 0] that fills an empty slot
  for (const tail of [[150, 150], [151, 150], [0.5, 150], [7, 149], [7, 151], [NaN, 150], [7, Infinity], [0, 0]]) {
    const x = r.slice(0, 5).concat(tail);
    assert.equal(K.ngKnowledgeMark(x), null, `${tail}`);
    assert.equal(R.ngRatingReadInterval(x, 3), 150, `${tail}: read at its own interval`);
    assert.equal(ngProgressMark(moves(x)), null, `${tail} (moves)`);
  }
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
  assert.deepEqual(K.ngKnowledgeMergeRow(fresh, r, D + 90), [D + 225, 120, D + 75, 0, 0, 7, 150]);
  assert.deepEqual(K.ngKnowledgeMergeRow(r, fresh, D + 90), [D + 225, 120, D + 75, 0, 0, 7, 150]);
  // from an earlier day: a fresh anchor at the winner's last, its own mark for it
  assert.deepEqual(K.ngKnowledgeMergeRow([D + 79, 3, D + 76], r, D + 90), [D + 226, 120, D + 76, 0, 0, 7, 150]);
  // where the winner's own reading is the longer, it is the mark's; where it reaches the heal's interval, no mark
  assert.deepEqual(K.ngKnowledgeMergeRow([D + 105, 30, D + 75], r, D + 90), [D + 225, 120, D + 75, 0, 0, 30, 150]);
  assert.deepEqual(K.ngKnowledgeMergeRow([D + 105, 30, D + 75], r.slice(0, 3), D + 90), [D + 225, 120, D + 75]);
  // the moves merge the same way
  const mv = W([D + 3, 3, D, 1], true, D + 75, 4), mfresh = [D + 78, 3, D + 75, 1];
  const mm = ngProgressMergeMoves({ s: { m: mfresh } }, { s: { m: mv } }, D + 90).s.m;
  assert.deepEqual(mm, [D + 225, 120, D + 75, 1, 0, 0, 7, 150]);
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
