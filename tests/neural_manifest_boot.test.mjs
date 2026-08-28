// Pure-unit contract for the MANIFEST BOOT (v1.80.4).
//
// The Neural app no longer downloads a 16.4MB deck monolith before the visitor can move: it boots
// from flashcards/_index.json (every deck key -> [chunk, cat, card count]) and fetches a deck's
// ~6KB chunk when something needs it. That turns "the decks are here" from an invariant into a
// timeline, and these tests pin the six places where a naive version of it lies to the user:
//
//   1. deckMastery / gameScore must be EXACT before the cards arrive — a manifest boot must not
//      demote a black belt to white (and gameScore memoises, so the lie would stick).
//   2. hydration must invalidate the score memo (_stageVer) and the cross-deck question index.
//   3. hydration must fill IN PLACE, so surfaces holding the deck object see the cards.
//   4. counts (goal, seen-glyph, card totals) must read the manifest's `n`, not 0.
//   5. MC distractor draws must not depend on which chunks happen to be resident.
//   6. both manifest formats must ingest.
//
// Run: node --test tests/neural_manifest_boot.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, "../neural/src/app.src.jsx");
const src = readFileSync(APP, "utf8");

const Component = new Function(
  "DCLogic",
  "React",
  `${src}\nreturn Component;`,
)(class DCLogic {}, { createRef: () => ({ current: null }) });

/** A minimal `this`: the real prototype plus only the state these methods read. */
function app(decks, opts = {}) {
  const a = Object.create(Component.prototype);
  a.flashcards = { decks: decks, manifest: opts.manifest !== false };
  a.stage = opts.stage || {};
  a.prep = {};
  a.settings = {};
  a.currentPos = null;
  a.deckShown = false;
  a.renderKnowledgeHeader = () => {};   // real one needs DOM refs
  a._saveProgress = () => {};
  a.beats = [];
  return a;
}

const MANIFEST_V2 = {
  _meta: { format: 2 },
  decks: { "Mount|Top": ["mount__top.json", "Position", 4] },
};
const MANIFEST_V1 = {
  decks: { "Mount|Top": { file: "mount__top.json", cat: "Position", role: "Top", n: 4 } },
};

test("manifest ingest: both formats yield the same stub", () => {
  const a2 = app({});
  a2._ingestDeckManifest(MANIFEST_V2);
  const a1 = app({});
  a1._ingestDeckManifest(MANIFEST_V1);
  assert.deepEqual(a2.flashcards.decks, a1.flashcards.decks);
  assert.deepEqual(a2.flashcards.decks["Mount|Top"], {
    file: "mount__top.json",
    cat: "Position",
    n: 4,
  });
  assert.equal(a2._cardsOf(a2.flashcards.decks["Mount|Top"]), null, "a stub has no cards");
  assert.equal(a2.flashcards.manifest, true, "flagged, so warm paths know residency is a timeline");
});

// ── 1 + 5: the belt must not collapse while the decks are still downloading ──────────────────

test("deckMastery on a stub is EXACT, from the manifest count + persisted grades", () => {
  const cards = [{ q: "q1", a: "a1" }, { q: "q2", a: "a2" }, { q: "q3", a: "a3" }, { q: "q4", a: "a4" }];
  const hyd = app({ "Mount|Top": { cat: "Position", cards: cards } });
  const stub = app({ "Mount|Top": { cat: "Position", n: 4 } });
  // the same grades, recorded by question hash exactly as the app persists them
  for (const A of [hyd, stub]) {
    A.stage["Mount|Top"] = { [A.qhash("q1")]: 3, [A.qhash("q2")]: 2, [A.qhash("q3")]: 1 };
  }
  assert.equal(hyd.deckMastery("Mount|Top"), (1 + 2 / 3 + 1 / 3 + 0) / 4);
  assert.equal(
    stub.deckMastery("Mount|Top"),
    hyd.deckMastery("Mount|Top"),
    "an unhydrated deck reports the SAME mastery — the cards only enumerate the zeroes",
  );
});

test("deckMastery on a stub: no grades = 0, all proven = 1, stale grades clamp at 1", () => {
  const a = app({ "D|Top": { cat: "Position", n: 2 } });
  assert.equal(a.deckMastery("D|Top"), 0);
  a.stage["D|Top"] = { x: 3, y: 3 };
  assert.equal(a.deckMastery("D|Top"), 1);
  a.stage["D|Top"] = { x: 3, y: 3, retired: 3 }; // a grade for a card that no longer exists
  assert.equal(a.deckMastery("D|Top"), 1, "clamped — mastery can never exceed the deck");
  assert.equal(a.deckMastery("nope|Top"), 0, "a deck not in the manifest is still 0");
});

test("gameScore is identical on a manifest boot and a fully resident one", () => {
  const cards = [{ q: "q1", a: "a1" }, { q: "q2", a: "a2" }];
  const weights = { "Mount|Top": 0.6, "Guard|Bottom": 0.4 };
  const mk = (resident) => {
    const decks = resident
      ? { "Mount|Top": { cat: "Position", cards }, "Guard|Bottom": { cat: "Position", cards } }
      : { "Mount|Top": { cat: "Position", n: 2 }, "Guard|Bottom": { cat: "Position", n: 2 } };
    const a = app(decks);
    a.curriculum = { weights: weights };
    a.stage = { "Mount|Top": { [a.qhash("q1")]: 3, [a.qhash("q2")]: 3 } }; // one deck fully proven
    return a;
  };
  const warm = mk(true).gameScore();
  const cold = mk(false).gameScore();
  assert.equal(cold.score, warm.score, "same score");
  assert.equal(cold.belt, warm.belt, "same belt");
  assert.equal(cold.stripes, warm.stripes);
  assert.equal(warm.score, 0.6, "sanity: the 0.6-weight deck is the proven one");
  assert.equal(warm.belt, "purple", "and 0.6 is exactly the purple threshold");
});

test("the score memo is invalidated by hydration, not only by a card grade", async () => {
  const a = app({ "Mount|Top": { cat: "Position", n: 1, file: "m.json" } });
  a.curriculum = { weights: { "Mount|Top": 1 } };
  const before = a.gameScore();
  assert.equal(before.score, 0);
  assert.equal(a.gameScore(), before, "memoised: same object back");
  // a chunk lands carrying a card the user has already proven
  a.stage["Mount|Top"] = { [a.qhash("q1")]: 3 };
  const v0 = a._stageVer || 0;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ cat: "Position", cards: [{ q: "q1", a: "a1" }] }) });
  await a.hydrateDeck("Mount|Top");
  assert.ok((a._stageVer || 0) > v0, "hydration bumps _stageVer");
  assert.notEqual(a.gameScore(), before, "and the memo is gone");
  assert.equal(a.gameScore().score, 1);
});

// ── 2 + 3: hydration housekeeping ────────────────────────────────────────────────────────────

test("hydrateDeck fills IN PLACE and is coalesced", async () => {
  const a = app({ "Mount|Top": { cat: "Position", n: 1, file: "m.json" } });
  const stub = a.flashcards.decks["Mount|Top"];
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return { ok: true, json: async () => ({ cat: "Position", role: "Top", cards: [{ q: "q1", a: "a1" }] }) };
  };
  const [d1, d2] = await Promise.all([a.hydrateDeck("Mount|Top"), a.hydrateDeck("Mount|Top")]);
  assert.equal(calls, 1, "two callers, one fetch");
  assert.equal(d1, stub, "the SAME deck object — surfaces holding it see the cards appear");
  assert.equal(d2, stub);
  assert.equal(a._cardsOf(stub).length, 1);
  assert.equal(await a.hydrateDeck("Mount|Top"), stub, "already resident: no refetch");
  assert.equal(calls, 1);
});

test("a failed chunk asks nothing and stays retryable (it is NOT an empty deck)", async () => {
  // v1.80.5 corrected this contract: caching the failure as `cards = []` meant one dropped
  // request emptied that deck for the whole session and killed the authority of its `n`. The
  // full retry/backoff/status contract lives in tests/neural_residency_contract.test.mjs.
  const a = app({ "Mount|Top": { cat: "Position", n: 3, file: "m.json" } });
  globalThis.fetch = async () => ({ ok: false, status: 503, json: async () => null });
  await a.hydrateDeck("Mount|Top");
  assert.equal(a._cardsOf(a.flashcards.decks["Mount|Top"]), null, "no cards — and no fake empty deck");
  assert.equal(a.questionFor("Mount|Top"), null, "asks nothing while it has nothing");
  assert.equal(a._deckCardCount(a.flashcards.decks["Mount|Top"]), 3, "`n` still speaks for it");
  assert.equal(a.deckStatus("Mount|Top"), "failed");
});

test("the cross-deck question index is rebuilt after a late deck lands", async () => {
  const a = app({
    "A|Top": { cat: "Position", cards: [{ q: "shared", a: "a1" }] },
    "B|Top": { cat: "Position", n: 1, file: "b.json" },
  });
  a._qkDecks = null;
  a.noteCardDone = Component.prototype.noteCardDone;
  // build the index while B is still a stub
  a._qkDecks = new Map();
  for (const k of Object.keys(a.flashcards.decks))
    for (const c of a._cardsOf(a.flashcards.decks[k]) || []) a._qkDecks.set(c.q, [k]);
  assert.deepEqual(a._qkDecks.get("shared"), ["A|Top"], "B is invisible while unhydrated");
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ cards: [{ q: "shared", a: "b1" }] }) });
  await a.hydrateDeck("B|Top");
  assert.equal(a._qkDecks, null, "invalidated — a stale index would never see B again");
});

// ── 4: counts must read the manifest ─────────────────────────────────────────────────────────

test("goals, glyphs and card totals read `n` before the cards land", () => {
  const a = app({
    "One|Top": { cat: "Position", n: 1 },
    "Eight|Top": { cat: "Position", n: 8 },
    "None|Top": { cat: "Position", n: 0 },
  });
  assert.equal(a._deckGoal("One|Top"), 1, "a 1-card deck asks for 1, not the default 3");
  assert.equal(a._deckGoal("Eight|Top"), 3, "capped at 3");
  assert.equal(a._deckCardCount(a.flashcards.decks["Eight|Top"]), 8);
  assert.equal(a.seenGlyph("Eight|Top")[0], "○");
  assert.equal(a.seenGlyph("Eight|Top")[2], "new to you", "NOT 'no cards authored yet'");
  assert.equal(a.seenGlyph("None|Top")[2], "no cards authored yet", "a genuinely empty deck still says so");
  a.stage["Eight|Top"] = { x: 3, y: 1 };
  assert.deepEqual(a.seenGlyph("Eight|Top").slice(0, 1), ["◐"]);
  assert.equal(a.seenGlyph("Eight|Top")[2], "2 of 8 met");
  a.prep["One|Top"] = 1;
  assert.equal(a.lessonDone("One|Top"), true, "a done 1-card lesson stays done through a boot");
});

// ── 5: MC distractor determinism under partial residency ─────────────────────────────────────

/**
 * A synthetic corpus + graph: the pooling algorithm's own logic, none of the DOM.
 *
 * Deliberately shaped so ALL THREE tiers run — a fixture whose own deck already yields enough
 * distractors would exercise nothing about residency at all (the first draft did exactly that,
 * and "no cold consult" passed vacuously):
 *   · the target's own deck offers ONE candidate, and it is a near-duplicate of the correct
 *     answer, so the similarity guard rejects it -> the neighbour tier must run;
 *   · of the two neighbours only N1 offers a usable answer — N2's line is a near-duplicate of
 *     N1's, so the SIBLING similarity guard rejects it -> one survivor is not enough for
 *     MC_DISTRACTORS=2 and the global tier (a bounded random walk over every manifest key) must
 *     run too. N2 is still CONSULTED, so its residency still counts.
 *
 * RE-SHAPED AT v1.148.0, and this is the whole point of the file. The old fixture leaned on
 * "two neighbours give two, which is short of n=3". When MC dropped to three options (n=2) that
 * became exactly enough, the global tier stopped executing, and every test here would have gone
 * on passing while covering one tier fewer — the §6.6 vacuity class, arriving as green. If you
 * change MC_DISTRACTORS again, re-check that the anti-vacuity assertion below still fires.
 */
function mcFixture(resident) {
  const CORRECT = "post the far hand and turn the corner with your shoulder.";
  // one distinct sentence per deck: near-duplicates would be rejected by the Jaccard guard and
  // the fixture would starve instead of reaching the tiers it exists to reach
  const LINES = {
    "N1|Top": "drive the elbow across the centre line before you sit up.",
    // a near-duplicate of N1 ON PURPOSE (Jaccard 9/11 = 0.82 > 0.8): the sibling guard must
    // reject it so the neighbour tier cannot fill the pool on its own
    "N2|Top": "drive the elbow across the centre line before you sit down.",
    "Far1|Top": "climb the knee shield and staple the hip to the mat.",
    "Far2|Top": "switch your base back and swim the underhook deep.",
    "Far3|Top": "walk the fingers to the collar and pull the head down.",
  };
  const answers = (p) =>
    p === "Mount|Top"
      ? [
          { q: "target", a: CORRECT },
          // same words, different order: the accidental-correct guard kills it
          { q: "dupe", a: "turn the corner with your shoulder and post the far hand." },
        ]
      : [{ q: p + "-q1", a: LINES[p] }];
  const keys = ["Mount|Top", "N1|Top", "N2|Top", "Far1|Top", "Far2|Top", "Far3|Top"];
  const decks = {};
  keys.forEach((k) => {
    const cards = answers(k);
    decks[k] = resident.includes(k)
      ? { cat: "Position", cards: cards, n: cards.length, file: k + ".json" }
      : { cat: "Position", n: cards.length, file: k + ".json" };
  });
  const a = app(decks);
  // stub the graph: node 0 is Mount|Top, its neighbours are N1/N2
  a.nodes = keys.map((k, i) => ({ idx: i, key: k, ty: "positions", t: k }));
  a.adj = [[1, 2], [0], [0], [], [], []];
  a.deckKeyFor = (n) => ({ key: n.key });
  a.nodeForKey = (k) => keys.indexOf(k);
  // hydration without a network: fill in place from the fixture, through the real seam
  a.hydrateDeck = (k) => {
    const d = a.flashcards.decks[k];
    if (d && !a._cardsOf(d)) { d.cards = answers(k); a._onDeckHydrated(k); }
    return Promise.resolve(d);
  };
  return { a, keys, card: answers("Mount|Top")[0] };
}

/** Rig a long deterministic queue for both pick and shuffle sites. */
function rigged(a, n = 400) {
  a._rig = { "mc-pick": [], "mc-shuffle": [] };
  for (let i = 0; i < n; i++) {
    a._rig["mc-pick"].push(((i * 7919) % 997) / 997);
    a._rig["mc-shuffle"].push(((i * 6151) % 991) / 991);
  }
  return a;
}

test("the RNG transaction puts every draw back, in order", () => {
  const a = app({});
  a._rig = { t: [0.1, 0.2, 0.3] };
  a._rngBegin();
  assert.equal(a.rng("t"), 0.1);
  assert.equal(a.rng("t"), 0.2);
  a._rngRollback();
  assert.deepEqual(a._rig.t, [0.1, 0.2, 0.3], "the stream is exactly where it was");
  // and Math.random draws are captured too, so a replay sees what the probe saw
  const b = app({});
  b._rngBegin();
  const v = b.rng("u");
  b._rngRollback();
  assert.equal(b.rng("u"), v, "an unrigged draw replays identically");
});

test("MC options are identical under warmed partial residency — and cost the same draws", async () => {
  const full = mcFixture(["Mount|Top", "N1|Top", "N2|Top", "Far1|Top", "Far2|Top", "Far3|Top"]);
  rigged(full.a);
  const warm = full.a.mcDistractors(full.card, "Mount|Top", full.a.MC_DISTRACTORS, null);
  const leftFull = full.a._rig["mc-pick"].length;

  const partial = mcFixture(["Mount|Top"]);           // only the card's own deck is resident
  rigged(partial.a);
  await partial.a._warmMcPool(partial.card, "Mount|Top", null);
  const cold = partial.a.mcDistractors(partial.card, "Mount|Top", partial.a.MC_DISTRACTORS, null);
  const leftPartial = partial.a._rig["mc-pick"].length;

  assert.equal(warm && warm.options.length, full.a.MC_DISTRACTORS + 1, "sanity: a full-width MC block");
  // ANTI-VACUITY (§6.6: emit a positive coverage count, never let "never looked" read as a pass).
  // Everything below is about residency not moving the RNG stream, which is only interesting if
  // the pooler actually WALKED past its own deck. Name the tiers it reached, and fail on zero.
  const reached = Object.keys(partial.a.flashcards.decks).filter((k) => partial.a._cardsOf(partial.a.flashcards.decks[k]));
  assert.ok(reached.includes("N1|Top"), `the neighbour tier never ran (reached: ${reached})`);
  assert.ok(reached.some((k) => k.startsWith("Far")), `the global tier never ran (reached: ${reached})`);
  assert.deepEqual(cold.options, warm.options, "same options, same order");
  assert.equal(cold.correctIdx, warm.correctIdx);
  assert.equal(
    leftPartial,
    leftFull,
    "same number of draws consumed — residency must not shift the RNG stream",
  );
  assert.deepEqual(partial.a.beats.filter((b) => b.beat === "mc_pool_cold"), [], "no cold consult");
});

test("an unwarmed cold consult is LOUD (a beat), never silent", () => {
  const f = mcFixture(["Mount|Top"]);
  rigged(f.a);
  f.a.mcDistractors(f.card, "Mount|Top", f.a.MC_DISTRACTORS, null);   // deliberately skipping the warm
  const cold = f.a.beats.filter((b) => b.beat === "mc_pool_cold");
  assert.ok(cold.length > 0, "the pooler reached a deck it did not have and said so");
});

test("mcPoolWarm is always true on a non-manifest boot (nothing to warm)", () => {
  const a = app({ "Mount|Top": { cat: "Position", cards: [{ q: "q", a: "a" }] } }, { manifest: false });
  assert.equal(a.mcPoolWarm("Mount|Top", { q: "q" }), true);
});

// ── anti-regression on the source text ───────────────────────────────────────────────────────

test("no boot path fetches a monolith any more", () => {
  assert.doesNotMatch(src, /fetch\([^)]*"flashcards\.json"/, "the 16.4MB deck monolith is gone");
  assert.doesNotMatch(src, /technique-content\.js/, "the 21.2MB dossier bundle is gone");
  assert.match(src, /flashcards\/_index\.json/, "boot reads the manifest");
  assert.doesNotMatch(src, /\{\s*cache:\s*"no-cache"/, "no fetch defeats the edge cache tier");
});

test("_stageVer is only ever bumped through the one seam", () => {
  const bumps = src.match(/_stageVer = \(this\._stageVer \|\| 0\) \+ 1/g) || [];
  assert.equal(bumps.length, 1, "one writer (_bumpStageVer) — hydration and grades share it");
});
