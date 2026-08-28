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

// ─────────────────────────────────────────────────────────────────────────────────────────────
// THE TABLE IS PER RULESET (v1.146.0), and this half is invisible to the build-side check.
//
// `build_technique_weights` read the folded NO-GI `attemptProbability` for 77 versions while
// `attemptProbabilityByRuleset` sat on the same dict. 52 techniques are attemptable ONLY in gi --
// the app's DEFAULT ruleset -- so once v1.145.13 widened the table to both seats, 104 decks and
// 739 authored cards were dealt, browsable, drillable and worth exactly zero.
//
//     scoreWeightsByRuleset = { div, p: {k, gi: [int], nogi: [int]}, t: {k, gi, nogi} }
//
// `k` is the UNION of both frames and a ZERO means "not attemptable in this ruleset".
//
// What these pin, and each one is a mutant that survived everything else:
//   6. the frame actually selects -- a gi-only technique scores in gi and is ABSENT in no-gi;
//   7. the memo is PER FRAME, so the first read cannot pin one ruleset for the session;
//   8. gameScore's own cache is keyed on the frame, or a toggle keeps printing the other
//      ruleset's percentage until the next card grade;
//   9. an older payload (v1.145.13 `scoreWeights`, or a flat `weights`) still scores.
const FORK = {
  div: DIV,
  p: { k: ["Mount|Top", "Mount|Bottom"], gi: [3000000, 1000000], nogi: [3000000, 1000000] },
  // "Collar Drag" is the gi-only shape: real mass in gi, a positive ZERO in no-gi.
  t: { k: ["Armbar from Mount", "Collar Drag"], gi: [3000000, 3000000], nogi: [6000000, 0] },
};
const forkApp = (stage = {}) => {
  const a = app({ belts: [], scoreWeightsByRuleset: FORK }, stage);
  a.flashcards.decks["Collar Drag|Attacker"] = { n: 1 };
  a.flashcards.decks["Collar Drag|Defender"] = { n: 1 };
  return a;
};

test("the frame selects: a gi-only technique is weighted in gi and ABSENT in no-gi", () => {
  const a = forkApp();
  assert.equal(a.scoreWeights("gi")["Collar Drag|Attacker"], 0.3);
  assert.equal(a.scoreWeights("gi")["Collar Drag|Defender"], 0.3, "both seats, as ever");
  assert.ok(!("Collar Drag|Attacker" in a.scoreWeights("nogi")),
    "a zero is ABSENT, not present-with-no-mass — it must not pad gameScore's denominator");
  assert.equal(a.scoreWeights("nogi")["Armbar from Mount|Attacker"], 0.6);
});

test("the weights memo is per frame — one read cannot pin a ruleset for the session", () => {
  const a = forkApp();
  a._giMode = "gi";
  assert.ok(a.scoreWeights()["Collar Drag|Attacker"] > 0, "default frame follows _giMode");
  a._giMode = "nogi";
  assert.ok(!("Collar Drag|Attacker" in a.scoreWeights()),
    "after the toggle the OTHER frame's table is served, not the memoised first one");
});

test("gameScore's cache is keyed on the ruleset, not on _stageVer alone", () => {
  const a = forkApp(proven("Collar Drag|Attacker"));
  a._giMode = "gi";
  const gi = a.gameScore().score;
  a._giMode = "nogi";
  const nogi = a.gameScore().score;
  assert.notEqual(gi, nogi,
    "same _stageVer, different ruleset: a cache keyed on _stageVer alone returns the stale score");
  assert.ok(gi > nogi, "the drilled deck is weighted in gi and unweighted in no-gi");
});

test("older payloads still score: v1.145.13 scoreWeights, and the flat weights before it", () => {
  assert.equal(app({ belts: [], scoreWeights: WIRE }).scoreWeights()["Armbar from Mount|Attacker"], 0.3);
  assert.deepEqual(app({ belts: [], weights: { "Armbar from Mount|Attacker": 1 } }).scoreWeights(),
    { "Armbar from Mount|Attacker": 1 });
});
