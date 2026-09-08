// THE DUE BUCKET IS A COVER OF THE DUE CARDS (v1.172.0).
//
// `_schedule` mirrors a shared card's review into every deck that carries it, so the srs blob
// holds one entry per deck COPY of a fact. Counting decks therefore over-reports the debt — on the
// owner's account 18 distinct cards read as "35 due" next to a band that said "18 cards due".
// `bucketTechniques("due")` now keeps a deck only if it owes a card no kept deck already covers,
// so |rows| <= dueCount() and answering every kept row's due cards clears everything.
//
// Node-side, on the real Component prototype: no browser, no manifest fetch — the deck table
// and the srs blob are the fixture, and `_epochDay()` is the real clock.
// Run: node --test tests/due_cover.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(resolve(HERE, "..", "neural/src/app.src.jsx"), "utf8");
const Component = new Function("DCLogic", "React", `${src}\nreturn Component;`)(
  class DCLogic {}, { createRef: () => ({ current: null }) },
);

function app(decks, srs) {
  const a = Object.create(Component.prototype);
  a.flashcards = { decks: decks, manifest: true };
  a.srs = srs;
  a.prep = {}; a.rec = {}; a.settings = {};
  a.get = (_k, d) => d;
  return a;
}

const T = Component.prototype._epochDay.call({});
/** an srs cell due `od` days ago, last seen before today */
const due = (od) => [T - od, 3, T - od - 3];

test("one fact mirrored into three decks is ONE row, and every printed figure is the card count", () => {
  const a = app({ A: { cat: "Position", n: 5 }, B: { cat: "Position", n: 5 }, C: { cat: "Position", n: 5 } },
    { A: { q1: due(1) }, B: { q1: due(1) }, C: { q1: due(1) } });
  assert.equal(a.dueCount(), 1);
  assert.deepEqual(a.bucketTechniques("due"), ["A"], "the copies add no rows; the tie breaks on the key");
  assert.equal(a.dueDeckCount(), 1);
});

test("the cover keeps every deck that owes something new, most overdue first", () => {
  // A owes q1 (3 days), B owes q1 + q2 (1 day), C owes q2 only (1 day), D owes q3 (2 days)
  const a = app({ A: { n: 5 }, B: { n: 5 }, C: { n: 5 }, D: { n: 5 } }, {
    A: { q1: due(3) },
    B: { q1: due(1), q2: due(1) },
    C: { q2: due(1) },
    D: { q3: due(2) },
  });
  assert.equal(a.dueCount(), 3);
  // A first (3 days), then D (2), then B — it still owes q2 — and C adds nothing after B.
  assert.deepEqual(a.bucketTechniques("due"), ["A", "D", "B"]);
  assert.ok(a.dueDeckCount() <= a.dueCount(), "rows never exceed cards");
});

test("a deck owing MORE distinct cards outranks a same-day deck owing fewer, so fewer rows cover the debt", () => {
  const a = app({ A: { n: 5 }, B: { n: 5 } }, {
    A: { q1: due(1) },
    B: { q1: due(1), q2: due(1) },
  });
  assert.deepEqual(a.bucketTechniques("due"), ["B"], "B covers both; A would be a second row for a covered card");
});

test("a deck the manifest lacks contributes neither a row nor a claim on coverage", () => {
  const a = app({ A: { n: 5 } }, { A: { q1: due(1) }, GHOST: { q1: due(9), q2: due(9) } });
  // GHOST is the most overdue and owes q2 too, but it is not a deck anyone can open: it must not
  // swallow q1 and leave A off the list.
  assert.deepEqual(a.bucketTechniques("due"), ["A"]);
  assert.equal(a.dueCount(), 2, "dueCount stays the honest card figure — the wire, not the manifest, is its domain");
});

test("a card reviewed today has left the pool everywhere, so its copies stop producing rows", () => {
  const a = app({ A: { n: 5 }, B: { n: 5 } }, {
    A: { q1: [T - 1, 3, T] },   // seen today → out until tomorrow
    B: { q1: [T - 1, 3, T] },
  });
  assert.equal(a.dueCount(), 0);
  assert.deepEqual(a.bucketTechniques("due"), []);
});
