// Pure-unit guard for on-demand deck hydration in the Neural app.
//
// `flashcards.decks[key]` used to be ALWAYS fully hydrated ({cat, role, cards:[…]}). The
// on-demand chunk path boots from a manifest STUB ({n} with no `cards`) and fills `cards`
// only once that deck's chunk lands. A stub is TRUTHY, so it sails through every `if (d)`
// guard in app.src.jsx and then throws (or silently yields NaN) at the point of use.
//
// These tests pin the contract: a stub behaves exactly like a MISSING deck — no cards, no
// mastery, no throw. Run: node --test tests/neural_deck_hydration.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, "../neural/src/app.src.jsx");
const src = readFileSync(APP, "utf8");

// app.src.jsx is a bare `class Component extends DCLogic { … }` body (no imports/exports —
// neural/build/build.mjs concatenates it under a shim that supplies DCLogic + React). Class
// bodies evaluate without running field initializers, so we get the real prototype with
// stubs and never construct the component (which would need a DOM, a canvas and a network).
const Component = new Function(
  "DCLogic",
  "React",
  `${src}\nreturn Component;`,
)(class DCLogic {}, { createRef: () => ({ current: null }) });

const STUB = { n: 8 }; // manifest stub: a COUNT, no cards array
const HYDRATED = {
  cat: "Position",
  role: "Top",
  cards: [
    { q: "q1", a: "a1" },
    { q: "q2", a: "a2" },
  ],
};

// a minimal `this`: the real prototype + only the state these methods read
function app(decks) {
  const a = Object.create(Component.prototype);
  a.flashcards = { decks: decks };
  a.stage = {};
  a.prep = {};
  return a;
}

test("_cardsOf: only a real array of cards counts", () => {
  const a = app({});
  assert.equal(a._cardsOf(STUB), null, "manifest stub has no cards yet");
  assert.equal(a._cardsOf(undefined), null, "missing deck");
  assert.equal(a._cardsOf(null), null, "null deck");
  assert.equal(a._cardsOf({ cat: "Position" }), null, "no cards key at all");
  assert.equal(a._cardsOf({ cards: null }), null, "explicit null cards");
  assert.equal(a._cardsOf({ cards: 8 }), null, "a count mistakenly on `cards`");
  // hydrated: returns the SAME array (callers that .slice() still get a copy)
  assert.equal(a._cardsOf(HYDRATED), HYDRATED.cards);
  assert.deepEqual(a._cardsOf({ cat: "Position", cards: [] }), []);
});

test("_entryForKey: a stub yields cards:null instead of throwing", () => {
  const a = app({ "Mount|Top": STUB });
  let e;
  assert.doesNotThrow(() => {
    e = a._entryForKey("Mount|Top");
  });
  assert.equal(e.cards, null, "unhydrated deck reports no cards");
  assert.equal(e.info.key, "Mount|Top");
  assert.equal(e.info.fam, "Mount");
  assert.equal(e.info.role, "Top");
  // renderDrill's no-cards branch does info.cat.toLowerCase() — cat must stay a string
  assert.equal(typeof e.info.cat, "string");
  assert.equal(e.info.cat, "Position");
});

test("_entryForKey: a missing deck and a stub are indistinguishable", () => {
  const stub = app({ "Mount|Top": STUB })._entryForKey("Mount|Top");
  const gone = app({})._entryForKey("Mount|Top");
  assert.deepEqual(stub, gone);
});

test("_entryForKey: hydrated decks are unchanged (copy, not alias)", () => {
  const a = app({ "Mount|Top": HYDRATED });
  const e = a._entryForKey("Mount|Top");
  assert.deepEqual(e.cards, HYDRATED.cards);
  assert.notEqual(e.cards, HYDRATED.cards, "still a .slice() copy");
  assert.equal(e.info.cat, "Position");
});

test("deckMastery / _deckHasCards report zero for a stub", () => {
  const a = app({ "Mount|Top": STUB });
  assert.equal(a.deckMastery("Mount|Top"), 0);
  assert.equal(a._deckHasCards("Mount|Top"), false);
  // and identical to the missing-deck answers
  const empty = app({});
  assert.equal(empty.deckMastery("Mount|Top"), 0);
  assert.equal(empty._deckHasCards("Mount|Top"), false);
});

test("_deckHasCards gates the JIT + panic drills off for a stub", () => {
  // buildDrillPanel's jitKey and startDefense's _panicKey both select via _deckHasCards,
  // so an unhydrated deck yields no key and neither drill renders (missing-deck behavior).
  const a = app({ "Mount|Top": STUB, "Mount|Bottom": HYDRATED });
  assert.equal(a._deckHasCards("Mount|Top"), false);
  assert.equal(a._deckHasCards("Mount|Bottom"), true);
  assert.equal(a._deckHasCards(null), false, "no key at all");
  assert.equal(a._deckHasCards(undefined), false);
});

test("the already-safe deck readers stay safe on a stub", () => {
  const a = app({ "Mount|Top": STUB });
  assert.equal(a.questionFor("Mount|Top"), null, "landing card asks nothing");
  assert.equal(a._deckGoal("Mount|Top"), 3, "falls back to the default goal");
  assert.equal(a.seenGlyph("Mount|Top")[0], "○", "○ new to you");
});

test("hydrated mastery math is untouched by the guard", () => {
  const a = app({ "Mount|Top": HYDRATED });
  assert.equal(a.deckMastery("Mount|Top"), 0, "no stages recorded yet");
  a.stage["Mount|Top"] = { [a.qhash("q1")]: 3, [a.qhash("q2")]: 3 };
  assert.equal(a.deckMastery("Mount|Top"), 1, "both cards recall-proven");
  a.stage["Mount|Top"][a.qhash("q2")] = 0;
  assert.equal(a.deckMastery("Mount|Top"), 0.5);
});

// Anti-regression on the source text itself: the repaired sites must not creep back to
// dereferencing `.cards` off a value that was only checked for truthiness.
test("no site reads .cards off a truthiness-only check", () => {
  assert.match(src, /_cardsOf\(d\)\s*{/, "_cardsOf accessor is present");
  assert.doesNotMatch(src, /\?\s*d\.cards\.slice\(\)/, "entry builders use _cardsOf");
  assert.doesNotMatch(src, /\b(jd|nd|dd)\.cards\b/, "JIT/panic/MC-pool locals hold arrays");
  assert.doesNotMatch(src, /\bdeck\.cards\b/, "dossier + mc pool use _cardsOf");
  // `decks[k] && decks[k].cards.length` — truthy deck, straight to .cards.length. (The
  // `decks[k] && decks[k].cards ? …` form is fine and must NOT trip this.)
  assert.doesNotMatch(
    src,
    /decks\[[^\]]+\]\s*&&\s*decks\[[^\]]+\]\.cards\.length/,
    "key selection uses _deckHasCards",
  );
});
