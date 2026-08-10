// Pure-unit contract for what ON-DEMAND RESIDENCY MUST NOT COST (v1.80.5).
//
// The chunked payload (v1.80.4) took bytes-to-first-hand from 43.6MB to 2.4MB. Review of that
// work found four ways the lazy path could quietly give the win back, or lie:
//
//   1. WARM FAN-OUT. _warmMcPool pre-fetched the landing deck AND EVERY GRAPH NEIGHBOUR before
//      its first dry pass — an unbounded fetch on the path that exists to be lazy, paid on every
//      landing for a distractor pool that 85.5% of cards never consult. The dry pass is what
//      knows; it must decide, and each top-up must be bounded.
//   2. A POISONED DECK. One dropped request set `d.cards = []` and cached that as SUCCESS: the
//      deck was empty for the rest of the session, indistinguishable from "authored with no
//      cards", and the manifest's `n` lost its authority for that deck. Gym wifi does this.
//   3. RESIDENCY-DEPENDENT CREDIT. Cross-deck credit for a shared question was computed from
//      RESIDENT decks only, so the same answer paid differently depending on load order — a
//      correctness bug in the mastery economy, not a caching detail. The manifest ships the
//      shared-question index, so credit is residency-independent.
//   4. UNDER-REPORTED COUNTS. Card counts shown to the user must come from the manifest's `n`,
//      which is authoritative before (and after) a chunk lands.
//
// Run: node --test tests/neural_residency_contract.test.mjs
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
  a.beats = [];
  a._saveProgress = () => {};
  a.renderKnowledgeHeader = () => {};
  a.track = () => {};
  a.bumpSharp = () => {};
  a.noteChallenges = () => {};
  return a;
}

// ── 1: THE WARM POOL MUST FETCH WHAT IT NEEDS, WHEN IT NEEDS IT ──────────────────────────────

/**
 * One target deck + N graph neighbours + a few far decks, all stubs unless named resident.
 * `hydrated` records every key the app actually asked for, in order.
 */
function poolFixture(resident, opts = {}) {
  const CORRECT = "post the far hand and turn the corner with your shoulder.";
  const LINES = {
    "Mount|Top": [
      "drive the elbow across the centre line before you sit up.",
      "break the grip at the thumb, never against four fingers.",
      "climb the knee shield and staple the hip to the mat.",
    ],
    "N1|Top": ["switch your base back and swim the underhook deep."],
    "N2|Top": ["walk the fingers to the collar and pull the head down."],
    "N3|Top": ["kick the leg free and turn your hips to the ceiling."],
    "N4|Top": ["frame on the neck and shrimp your hips out sideways."],
    "Far1|Top": ["thread the arm under the chin and close the triangle."],
    "Far2|Top": ["load the shin across the belt line and lift."],
  };
  const keys = Object.keys(LINES);
  const cardsFor = (k) =>
    k === "Mount|Top"
      ? [{ q: "target", a: CORRECT, ...(opts.authored ? { mc: { p: LINES[k].slice(0, 2), t: [LINES[k][2]] } } : {}) }].concat(
          LINES[k].map((a, i) => ({ q: "own" + i, a: a })),
        )
      : LINES[k].map((a, i) => ({ q: k + i, a: a }));
  const decks = {};
  for (const k of keys) {
    const n = cardsFor(k).length;
    decks[k] = resident.includes(k) ? { cat: "Position", n: n, cards: cardsFor(k) } : { cat: "Position", n: n };
  }
  const a = app(decks);
  a.nodes = keys.map((k, i) => ({ idx: i, key: k, ty: "positions", t: k }));
  // Mount|Top's neighbours are N1..N4
  a.adj = [[1, 2, 3, 4], [0], [0], [0], [0], [], []];
  a.deckKeyFor = (n) => ({ key: n.key });
  a.nodeForKey = (k) => keys.indexOf(k);
  const hydrated = [];
  a.hydrateDeck = (k) => {
    const d = a.flashcards.decks[k];
    hydrated.push(k);
    if (d && !a._cardsOf(d)) { d.cards = cardsFor(k); a._onDeckHydrated(k); }
    return Promise.resolve(d || null);
  };
  a._rig = { "mc-pick": [], "mc-shuffle": [] };
  for (let i = 0; i < 600; i++) {
    a._rig["mc-pick"].push(((i * 7919) % 997) / 997);
    a._rig["mc-shuffle"].push(((i * 6151) % 991) / 991);
  }
  return { a, hydrated, card: cardsFor("Mount|Top")[0], keys };
}

test("a card whose distractors are AUTHORED costs zero deck fetches", async () => {
  const f = poolFixture(["Mount|Top"], { authored: true });
  await f.a._warmMcPool(f.card, "Mount|Top", null);
  assert.deepEqual(f.hydrated, [], "the authored tiers filled the pool — nothing to fetch");
  assert.equal(f.a.mcPoolWarm("Mount|Top", f.card), true, "and the pool is marked warm");
});

test("the warm pool fetches only the decks the DRY PASS actually reached", async () => {
  // the target's own deck alone yields three usable distractors, so the neighbour and global
  // tiers never run — and their chunks must never be requested
  const f = poolFixture([]);
  await f.a._warmMcPool(f.card, "Mount|Top", null);
  assert.deepEqual(
    [...new Set(f.hydrated)],
    ["Mount|Top"],
    "no pre-emptive neighbour sweep: the own deck satisfied the pool",
  );
  assert.deepEqual(f.a.beats.filter((b) => b.beat === "mc_pool_cold"), [], "warmed: no cold consult");
});

test("a warm top-up is BOUNDED per pass, not one fetch per manifest key", async () => {
  // The shape that has no ceiling without one: the own deck offers nothing usable (one card, the
  // target itself), so the pooler falls through to the GLOBAL tier — a bounded random walk over
  // every manifest key. Every key it draws is cold, so a naive "fetch whatever the pass asked
  // for" pulls dozens of chunks for ONE landing question.
  const CORRECT = "post the far hand and turn the corner with your shoulder.";
  const a = app({});
  const keys = ["Mount|Top"];
  for (let i = 0; i < 120; i++) keys.push("Far" + i + "|Top");
  const cardsFor = (k) =>
    k === "Mount|Top"
      ? [{ q: "target", a: CORRECT }]
      : [{ q: k, a: "sentence number " + k + " long enough to survive the length ratio guard." }];
  for (const k of keys) a.flashcards.decks[k] = { cat: "Position", n: cardsFor(k).length };
  a.nodes = keys.map((k, i) => ({ idx: i, key: k, ty: "positions", t: k }));
  a.adj = keys.map(() => []);
  a.deckKeyFor = (n) => ({ key: n.key });
  a.nodeForKey = (k) => keys.indexOf(k);
  const hydrated = [];
  a.hydrateDeck = (k) => {
    const d = a.flashcards.decks[k];
    hydrated.push(k);
    if (d && !a._cardsOf(d)) { d.cards = cardsFor(k); a._onDeckHydrated(k); }
    return Promise.resolve(d || null);
  };
  a._rig = { "mc-pick": [], "mc-shuffle": [] };
  for (let i = 0; i < 2000; i++) {
    a._rig["mc-pick"].push(((i * 7919) % 997) / 997);
    a._rig["mc-shuffle"].push(((i * 6151) % 991) / 991);
  }
  await a._warmMcPool(cardsFor("Mount|Top")[0], "Mount|Top", null);
  assert.ok(hydrated.length > 0, "sanity: this fixture does need chunks");
  assert.ok(
    new Set(hydrated).size <= 12,
    `a single landing pulled ${new Set(hydrated).size} chunks — the top-up is unbounded`,
  );
});

test("mcDistractors options are identical warm vs lazily-warmed (the RNG stream cannot move)", async () => {
  const full = poolFixture(["Mount|Top", "N1|Top", "N2|Top", "N3|Top", "N4|Top", "Far1|Top", "Far2|Top"]);
  const warm = full.a.mcDistractors(full.card, "Mount|Top", 3, null);
  const left = full.a._rig["mc-pick"].length;
  const lazy = poolFixture([]);
  await lazy.a._warmMcPool(lazy.card, "Mount|Top", null);
  const cold = lazy.a.mcDistractors(lazy.card, "Mount|Top", 3, null);
  assert.ok(warm && warm.options.length >= 3, "sanity: a real MC block");
  assert.deepEqual(cold.options, warm.options, "same options, same order");
  assert.equal(lazy.a._rig["mc-pick"].length, left, "same draws consumed");
});

// ── 2: A TRANSIENT FETCH FAILURE MUST NOT POISON A DECK ──────────────────────────────────────

test("a failed chunk is RETRYABLE: the stub survives, `n` keeps its authority", async () => {
  const a = app({ "Mount|Top": { cat: "Position", n: 3, file: "m.json" } });
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    throw new Error("net::ERR_INTERNET_DISCONNECTED");
  };
  assert.equal(await a.hydrateDeck("Mount|Top"), null, "a failure resolves null, not a fake deck");
  const d = a.flashcards.decks["Mount|Top"];
  assert.equal(a._cardsOf(d), null, "NOT cached as an empty resident deck");
  assert.equal(d.n, 3, "the manifest count still speaks for this deck");
  assert.equal(a._deckCardCount(d), 3);
  assert.equal(a.deckStatus("Mount|Top"), "failed", "and the failure is legible");
  assert.equal(
    a.beats.filter((b) => b.beat === "deck_fetch_failed").length,
    1,
    "a dropped chunk is loud, never silent success",
  );
  // the retry: same key, and this time the network is there
  globalThis.fetch = async () => {
    calls++;
    return {
      ok: true,
      json: async () => ({ "Mount|Top": { cat: "Position", cards: [{ q: "q1", a: "a1" }, { q: "q2", a: "a2" }, { q: "q3", a: "a3" }] } }),
    };
  };
  const got = await a.hydrateDeck("Mount|Top");
  assert.equal(calls, 2, "the second call actually went to the network");
  assert.equal(got, d, "filled IN PLACE, as always");
  assert.equal(a._cardsOf(d).length, 3);
  assert.equal(a.deckStatus("Mount|Top"), "ready");
});

test("a genuinely empty deck is DISTINGUISHABLE from a failed one", async () => {
  const a = app({
    "Empty|Top": { cat: "Position", n: 0, file: "e.json" },
    "Broken|Top": { cat: "Position", n: 4, file: "b.json" },
    "Waiting|Top": { cat: "Position", n: 4, file: "w.json" },
  });
  globalThis.fetch = async (u) =>
    /e\.json/.test(String(u))
      ? { ok: true, json: async () => ({ "Empty|Top": { cat: "Position", cards: [] } }) }
      : { ok: true, json: async () => ({}) }; // a chunk that does not carry this deck at all
  await a.hydrateDeck("Empty|Top");
  assert.equal(a.deckStatus("Empty|Top"), "empty", "authored with no cards");
  await a.hydrateDeck("Broken|Top");
  assert.equal(
    a.deckStatus("Broken|Top"),
    "failed",
    "a chunk that carries no cards for a deck the manifest says has 4 is BROKEN, not empty",
  );
  assert.equal(a._deckCardCount(a.flashcards.decks["Broken|Top"]), 4, "`n` is still authoritative");
  assert.equal(a.deckStatus("Waiting|Top"), "pending", "never asked for: not loaded YET");
  assert.equal(a.deckStatus("Nope|Top"), "missing");
});

test("repeated failures back off instead of hammering, and recover after the cooldown", async () => {
  const a = app({ "Mount|Top": { cat: "Position", n: 3, file: "m.json" } });
  let calls = 0;
  globalThis.fetch = async () => { calls++; return { ok: false, status: 503, json: async () => null }; };
  for (let i = 0; i < 6; i++) await a.hydrateDeck("Mount|Top");
  assert.ok(calls <= 3, `hammered the failing chunk ${calls} times`);
  assert.equal(a.deckStatus("Mount|Top"), "failed", "still a retry candidate, not a lie");
  // the cooldown expires
  a.flashcards.decks["Mount|Top"].errAt = Date.now() - 10 * 60 * 1000;
  globalThis.fetch = async () => { calls++; return { ok: true, json: async () => ({ "Mount|Top": { cards: [{ q: "q", a: "a" }] } }) }; };
  await a.hydrateDeck("Mount|Top");
  assert.equal(a.deckStatus("Mount|Top"), "ready", "a deck that failed all day still recovers");
});

// ── 3: CROSS-DECK CREDIT MUST NOT DEPEND ON WHAT HAPPENS TO BE LOADED ────────────────────────

const SHARED_Q = "What is the core mechanic of this position?";
function sharedManifest(a) {
  // three decks carry the same hierarchy card; the manifest names them by INDEX into its own
  // (ordered) deck list, which is what makes the index tiny enough to ship eagerly
  const decks = { "A|Top": ["Position", 2], "B|Top": ["Position", 4], "C|Top": ["Position", 3] };
  const shared = {};
  shared[a.qhash(SHARED_Q)] = [0, 1, 2];
  return { _meta: { format: 3 }, decks: decks, shared: shared };
}

test("credit for a shared question is identical whether the sibling decks are resident", () => {
  const cold = app({});
  cold._ingestDeckManifest(sharedManifest(cold));
  cold.noteCardDone({ q: SHARED_Q, a: "x" }, "A|Top");
  assert.equal(cold.prep["B|Top"], 1, "an UNHYDRATED sibling is credited — the manifest knows it exists");
  assert.equal(cold.prep["C|Top"], 1);

  const warm = app({});
  warm._ingestDeckManifest(sharedManifest(warm));
  for (const k of ["A|Top", "B|Top", "C|Top"])
    warm.flashcards.decks[k].cards = [{ q: SHARED_Q, a: "x" }, { q: k + "-own", a: "y" }];
  warm.noteCardDone({ q: SHARED_Q, a: "x" }, "A|Top");
  assert.deepEqual(cold.prep, warm.prep, "same answer, same credit, whatever is loaded");
});

test("a question that is NOT shared credits nobody, and the cap is the manifest count", () => {
  const a = app({});
  a._ingestDeckManifest(sharedManifest(a));
  a.noteCardDone({ q: "a role-specific question", a: "x" }, "A|Top");
  assert.deepEqual(a.prep, {}, "role cards are unique to their deck");
  // repeat credit is capped at the deck's own card count, from `n`
  for (let i = 0; i < 9; i++) {
    a.cardDone = null;
    a.noteCardDone({ q: SHARED_Q, a: "x" }, "A|Top");
  }
  assert.equal(a.prep["B|Top"] <= 4, true, "capped by B's manifest `n`");
});

// ── 4: COUNTS COME FROM THE MANIFEST ─────────────────────────────────────────────────────────

test("the deck-row count label reads `n`, so a cold visitor is not under-reported", () => {
  const a = app({
    "Stub|Top": { cat: "Position", n: 8 },
    "Ready|Top": { cat: "Position", n: 2, cards: [{ q: "a", a: "1" }, { q: "b", a: "2" }] },
    "Empty|Top": { cat: "Position", n: 0, cards: [] },
    "Failed|Top": { cat: "Position", n: 5, err: 1, errAt: Date.now() },
  });
  assert.equal(a._deckCountLabel("Stub|Top"), "8 cards", "NOT 'soon' — the deck has 8 cards");
  assert.equal(a._deckCountLabel("Stub|Top", true), "8", "compact form for the session list");
  assert.equal(a._deckCountLabel("Ready|Top"), "2 cards");
  assert.equal(a._deckCountLabel("Empty|Top"), "soon");
  assert.equal(a._deckCountLabel("Failed|Top"), "retry", "a dropped chunk says so instead of lying");
});

test("both deck-list surfaces read the count through that one seam", () => {
  const body = (name) => {
    const i = src.indexOf("\n  " + name + "(");
    assert.ok(i > 0, name + " exists");
    return src.slice(i, src.indexOf("\n  }", i));
  };
  for (const fn of ["renderFlashBrowser", "renderSession"]) {
    const b = body(fn);
    assert.match(b, /_deckCountLabel\(/, fn + " must read the manifest count");
    assert.doesNotMatch(b, /dc\.length/, fn + " must not count only what is resident");
  }
});

// ── minor: ONE definition of mastery, resident or not ────────────────────────────────────────

test("grades for cards the deck no longer has cannot inflate a stub, and are healed on arrival", async () => {
  const cards = [{ q: "q1", a: "a1" }, { q: "q2", a: "a2" }];
  const staleGrades = (A) => ({
    [A.qhash("q1")]: 3,          // live, proven
    [A.qhash("retired-a")]: 3,   // a question whose text changed in a later content pass
    [A.qhash("retired-b")]: 3,
  });
  const hyd = app({ "D|Top": { cat: "Position", n: 2, cards: cards } });
  hyd.stage["D|Top"] = staleGrades(hyd);
  assert.equal(hyd.deckMastery("D|Top"), 0.5, "resident: one of two live cards proven");

  // BOUNDED: a stub cannot count more grades than the deck has cards. (It cannot know WHICH
  // grades are live — the card text is exactly what has not arrived — so it takes the best `n`,
  // which is why the healing below matters.)
  const stub = app({ "D|Top": { cat: "Position", n: 2, file: "d.json" } });
  stub.stage["D|Top"] = staleGrades(stub);
  assert.ok(stub.deckMastery("D|Top") <= 1, "never exceeds the deck");
  assert.equal(Object.keys(stub.stage["D|Top"]).length, 3, "three grades persisted");

  // HEALED: when the chunk lands, grades the shipped deck has no card for are dropped — they
  // count for nothing in the resident branch either — and the two branches agree from then on.
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ "D|Top": { cat: "Position", cards: cards } }) });
  await stub.hydrateDeck("D|Top");
  assert.deepEqual(Object.keys(stub.stage["D|Top"]), [stub.qhash("q1")], "stale grades pruned");
  assert.equal(stub.deckMastery("D|Top"), hyd.deckMastery("D|Top"), "one definition of mastery");
});

test("a chunk that DISAGREES with the manifest count never deletes a grade", async () => {
  const a = app({ "D|Top": { cat: "Position", n: 4, file: "d.json" } });
  a.stage["D|Top"] = { [a.qhash("q1")]: 3, [a.qhash("q2")]: 3 };
  // a truncated / mid-deploy chunk: two cards where the manifest promises four
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ "D|Top": { cat: "Position", cards: [{ q: "q9", a: "a9" }, { q: "q8", a: "a8" }] } }),
  });
  await a.hydrateDeck("D|Top");
  assert.equal(Object.keys(a.stage["D|Top"]).length, 2, "a user's proof survives a bad payload");
});

// ── source-text guards for the two claims this file exists to keep honest ────────────────────

test("the warm pool no longer sweeps graph neighbours pre-emptively", () => {
  const i = src.indexOf("_warmMcPool(");
  const body = src.slice(i, src.indexOf("\n  /**", i));
  assert.doesNotMatch(body, /hydrateDecks\(this\.mcPoolKeys/, "the pre-emptive fan-out is gone");
  assert.doesNotMatch(src, /mcPoolKeys\(/, "and the helper that only served it is gone with it");
});

test("the mc_pool_cold comment does not claim a journey that does not exist", () => {
  const i = src.indexOf("_mcCold(");
  const around = src.slice(Math.max(0, i - 400), i + 600);
  assert.doesNotMatch(around, /journeys assert this beat never fires/,
    "no journey references mc_pool_cold — only this suite does");
});
