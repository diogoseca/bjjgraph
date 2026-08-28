// Pure-unit contract for THE SCORE TABLE (v1.145.13).
//
// Game Knowledge used to weight only the attacking third of the corpus: all 1,326 Defender decks
// and all 272 position decks -- 9,071 authored cards, 41.4% -- scored exactly zero, on a design
// decision no human ever made (v1.68.0, an agent commit whose own message claimed "Nothing is cut
// now"). The owner ruled: score the whole corpus and let scores fall, while nobody yet holds a
// belt worth losing.
//
// The wire is compact because the key strings are the whole cost of this payload:
//
//     scoreWeights = { div, p: {k: [positionDeckKey], v: [int]}, t: {k: [techniqueName], v: [int]} }
//
// Every `t` name carries BOTH seats at the same value. That is a CONSTRUCTION, not an estimate --
// the defender block is the attacker block re-keyed and normalised identically -- and the emitter
// round-trips the expansion and refuses to write a wire that stops satisfying it.
//
// What this file pins, none of which the build-side check can see:
//   1. both seats come back from one name, at equal weight;
//   2. a position deck CONTRIBUTES -- the owner's first constraint, and the point of the change;
//   3. a zero is absent, not present-with-no-mass, so it cannot pad gameScore's denominator;
//   4. the pre-v1.145.13 flat `weights` shape still scores (the fixtures carry it);
//   5. NOTHING DECAYS. The score moves only on answers. This is the owner's second constraint --
//      scoring must read as retention, never as pressure -- and in a weights table the choice does
//      not arise: there is no clock here to punish anyone with. Pinned so that if a later change
//      ever introduces one, it breaks a test whose name says why that is not wanted.
//
// Run: node --test tests/neural_score_weights.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(resolve(HERE, "../neural/src/app.src.jsx"), "utf8");
const Component = new Function("DCLogic", "React", `${src}\nreturn Component;`)(
  class DCLogic {}, { createRef: () => ({ current: null }) });

const DIV = 10000000;
const WIRE = {
  div: DIV,
  p: { k: ["Mount|Top", "Mount|Bottom"], v: [3000000, 1000000] },
  t: { k: ["Armbar from Mount", "Never Attempted"], v: [3000000, 0] },
};

function app(curriculum, stage = {}) {
  const a = Object.create(Component.prototype);
  a.flashcards = { decks: {
    "Mount|Top": { n: 1 }, "Mount|Bottom": { n: 1 },
    "Armbar from Mount|Attacker": { n: 1 }, "Armbar from Mount|Defender": { n: 1 },
  }, manifest: true };
  a.stage = stage; a.prep = {}; a.settings = {};
  a.curriculum = curriculum; a._stageVer = 1;
  return a;
}
const proven = (key) => ({ [key]: { [Object.create(Component.prototype).qhash("q1")]: 3 } });

test("one technique name expands to BOTH seats, at equal weight", () => {
  const w = app({ belts: [], scoreWeights: WIRE }).scoreWeights();
  assert.equal(w["Armbar from Mount|Attacker"], 0.3);
  assert.equal(w["Armbar from Mount|Defender"], 0.3, "the defender seat is not half a seat");
  assert.equal(w["Mount|Top"], 0.3);
  assert.equal(w["Mount|Bottom"], 0.1);
});

test("A POSITION DECK CONTRIBUTES TO THE SCORE — the point of the change", () => {
  // The live mass is 0.3 + 0.1 + 0.3 + 0.3 = 1.0 (the zero-weight name is dropped), so proving
  // Mount|Top alone is worth 0.30. Before v1.145.13 it was worth ZERO: studying a position was,
  // to the only number the product publishes, indistinguishable from studying nothing at all.
  const a = app({ belts: [], scoreWeights: WIRE }, proven("Mount|Top"));
  assert.ok(a.gameScore().score > 0, "studying a position moved the score");
  assert.equal(a.gameScore().score.toFixed(4), "0.3000");
});

test("a zero weight is ABSENT, not a key with no mass", () => {
  // `Never Attempted` ships at 0. Kept as a key it would sit in gameScore's denominator and
  // quietly dilute every other deck; the app must drop it exactly as the emitter intends.
  const w = app({ belts: [], scoreWeights: WIRE }).scoreWeights();
  assert.ok(!("Never Attempted|Attacker" in w));
  assert.ok(!("Never Attempted|Defender" in w));
  assert.equal(Object.keys(w).length, 4);
});

test("the pre-v1.145.13 flat `weights` shape still scores", () => {
  const legacy = { belts: [], weights: { "Armbar from Mount|Attacker": 1 } };
  assert.deepEqual(app(legacy).scoreWeights(), { "Armbar from Mount|Attacker": 1 });
  assert.equal(app({ belts: [] }).scoreWeights(), null, "no table at all -> null, never {}");
});

test("NOTHING IN THE SCORE DECAYS: the same profile scores the same, always", () => {
  // The owner's second constraint. deckMastery is stage-based and moves only on answers, so the
  // belt cannot drop because time passed. If a later change wires a clock, interval or lapse
  // count into the score, this is the test that should stop it: the retention/pressure choice
  // belongs in `_schedule` (what you are SHOWN), never in what you are WORTH.
  const a = app({ belts: [], scoreWeights: WIRE }, proven("Mount|Top"));
  const first = a.gameScore().score;
  a._scoreCache = null;
  a.now = (a.now || 0) + 60 * 60 * 24 * 365;   // a year of game clock, no answers
  assert.equal(a.gameScore().score, first, "time alone moved the score");
});
