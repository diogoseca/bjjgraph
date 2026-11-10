// THE `moves` RECORD (v1.255.0, hidden moves, owner U116): moves[state][move] = [due, ivl, last, ok].
// Its merge rule (`ngProgressMergeMoves`, progress-owner.src.js) and the blob validator's entry
// (`ngProgressValidateBlob`, progress-owner.src.js). The app wiring (emit, hydrate, merge call) is
// pinned end to end by e2e/journeys/hidden-moves.spec.ts ("kept across a reload").
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ngProgressValidateBlob, ngProgressMergeMoves } from "../neural/src/progress-owner.src.js";

const S = "76/top", M = "307", T = 20000;
const merge = (l, c, today = T) => ngProgressMergeMoves(l, c, today);

test("a cell only one side has is kept, from either side", () => {
  assert.deepEqual(merge({ [S]: { [M]: [T + 3, 3, T, 1] } }, {}), { [S]: { [M]: [T + 3, 3, T, 1] } });
  assert.deepEqual(merge({}, { [S]: { [M]: [T + 3, 3, T, 1] } }), { [S]: { [M]: [T + 3, 3, T, 1] } });
});

test("the later answer wins, and carries its own ok: mastery is the LAST answer", () => {
  const yes = [T + 6, 7, T - 1, 1], no = [T + 1, 1, T, 0];
  assert.deepEqual(merge({ [S]: { [M]: yes } }, { [S]: { [M]: no } })[S][M], no, "a later No on the other device takes the gold away");
  assert.deepEqual(merge({ [S]: { [M]: no } }, { [S]: { [M]: yes } })[S][M], no, "...in either direction");
});

test("a same-day tie goes to the smaller interval, so a same-day No beats a same-day Yes", () => {
  const yes = [T + 3, 3, T, 1], no = [T + 1, 1, T, 0];
  assert.deepEqual(merge({ [S]: { [M]: yes } }, { [S]: { [M]: no } })[S][M], no);
  assert.deepEqual(merge({ [S]: { [M]: no } }, { [S]: { [M]: yes } })[S][M], no);
});

test("a winner past rung 0 keeps the longer interval it beat (a fresh device's 1 -> 3 heals), with its own ok", () => {
  const fresh = [T + 3, 3, T, 1], mature = [T + 20, 30, T - 10, 1];
  assert.deepEqual(merge({ [S]: { [M]: fresh } }, { [S]: { [M]: mature } })[S][M], [T + 30, 30, T, 1]);
  // a rung-0 winner (a No) does NOT inherit the old interval: the No stands
  const no = [T + 1, 1, T, 0];
  assert.deepEqual(merge({ [S]: { [M]: no } }, { [S]: { [M]: mature } })[S][M], no);
});

test("an ingested `last` is clamped to today, so a fast clock cannot win forever", () => {
  const future = [T + 40, 30, T + 9, 1], local = [T + 1, 1, T, 0];
  const out = merge({ [S]: { [M]: local } }, { [S]: { [M]: future } })[S][M];
  assert.equal(out[2], T, "the clamped cloud row ties today, and the smaller interval (the local No) wins the tie");
  assert.deepEqual(out, local);
});

test("malformed cloud cells are skipped, the inputs are untouched, and other cells merge", () => {
  const local = { [S]: { [M]: [T + 1, 1, T, 1] } };
  const cloud = { [S]: { "9": [T, 1, T], "10": "x", "11": [T + 3, 3, T - 1, 1] }, "77/bottom": { "5": [T + 7, 7, T - 2, 1] } };
  const snap = JSON.stringify([local, cloud]);
  const out = merge(local, cloud);
  assert.deepEqual(out, { [S]: { [M]: [T + 1, 1, T, 1], "11": [T + 3, 3, T - 1, 1] }, "77/bottom": { "5": [T + 7, 7, T - 2, 1] } });
  assert.equal(JSON.stringify([local, cloud]), snap, "neither input was mutated");
});

test("the blob validator accepts `moves` rows and rejects a broken one", () => {
  const ok = { v: 2, moves: { [S]: { [M]: [T + 3, 3, T, 1], "e1a2b3c4d": [T + 1, 1, T, 0] } } };
  assert.doesNotThrow(() => ngProgressValidateBlob(ok));
  assert.doesNotThrow(() => ngProgressValidateBlob({ v: 2, moves: { [S]: { [M]: [T + 3, 3, T, 1, 0] } } }), "a longer row from a later build is kept");
  assert.throws(() => ngProgressValidateBlob({ v: 2, moves: { [S]: { [M]: [T + 3, 3, T] } } }), /Invalid move record/);
  assert.throws(() => ngProgressValidateBlob({ v: 2, moves: { [S]: { [M]: [T + 3, -1, T, 1] } } }), /Invalid move record/);
  assert.throws(() => ngProgressValidateBlob({ v: 2, moves: [] }), /Invalid saved progress field: moves/);
});

test("the app merges `moves` through this function and emits it in the blob", () => {
  const app = readFileSync(new URL("../neural/src/app.src.jsx", import.meta.url), "utf8");
  assert.match(app, /this\.moves = ngProgressMergeMoves\(this\.moves \|\| \{\}, cloud\.moves \|\| \{\}, today\)/);
  assert.match(app, /srs: this\.srs \|\| \{\}, moves: this\.moves \|\| \{\}/);
});
