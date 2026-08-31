// THE SEAT AXIS, ON THE APP'S SIDE — every deck the build ships must be one the app can ask for.
//
// The corpus half of this invariant is scripts/validate_seat_decks.py (S1 purity, S2 ownership,
// S4 one-finisher). This is S3, REACHABILITY, and it cannot live in that script: deciding which
// deck keys the app can mint means running `deckKeyFor`, and asserting it from Python — against
// app.src.jsx source text, or against the minified bundle — is a check written from a second
// reading of the code under test. It would agree with itself and report green on a build already
// broken (CLAUDE.md §6.3). So this drives the REAL `ingest` on the REAL wire and asserts on what
// `deckKeyFor` EMITTED, the same construction tests/flow.test.mjs uses for the same reason.
//
// WHAT WAS BROKEN, AND HOW BADLY
//   `deckRole` returned the constant "Attacker" for every technique node, so all 1,326
//   `<name>|Defender` decks — 6,403 cards, 29.2% of the whole corpus — were emitted and then
//   addressable by nothing that went through `deckKeyFor`. (`defendKeyFor` reaches the 297
//   submission ones from the panic drill; the 1,029 transition ones, 4,880 cards, reached nothing.)
//   `playedRole` had the identical defect one axis over: outside a live roll it fell to a regex on
//   the node title, and all 136 collapsed hub titles end "… Top" while the partner member carries
//   the hub's own title — so both halves of every pair read "Top" and all 136 `<pos>|Bottom` decks
//   were unmintable too. Both are the same fix: `_deriveDualPairs` stamps the member's side on the
//   member, and both functions now read it.
//
// WHY SET EQUALITY AND NOT A COUNT
//   A non-null count passes a wrong-but-complete remap (§6.6). Both directions are asserted:
//   nothing shipped is unreachable, AND nothing reachable is missing a deck. The second direction
//   is not decoration — it is what catches a key the app mints that the emitter never wrote, which
//   is how a silent rename would present.
//
// NON-KILLS, recorded so nobody reads this file as covering more than it does:
//  · It does NOT prove a human can REACH the defender orb with a pointer. It proves the key
//    resolves once the node is selected. The hit-testing half is `dual-pair.spec.ts`'s subject.
//  · It does NOT cover `defendKeyFor` or the panic drill's `deckKeyOverride` branch, which stamps
//    a synthetic `cat: "Defense"` in place of the node's real category.
//  · It says nothing about whether a seat's CARDS are right for that seat — that is S1/S2/S4, in
//    scripts/validate_seat_decks.py, over the authored corpus.
//
// Run: node --test tests/neural_seat_decks.test.mjs   (npm run test:units)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const R = (p) => resolve(HERE, "..", p);
const src = readFileSync(R("neural/src/app.src.jsx"), "utf8");
const WIRE = JSON.parse(readFileSync(R("source/quartz/static/neural/graph-data.json"), "utf8"));
const MANIFEST = JSON.parse(readFileSync(R("source/quartz/static/neural/flashcards/_index.json"), "utf8"));

const Component = new Function("DCLogic", "React", `${src}\nreturn Component;`)(
  class DCLogic {}, { createRef: () => ({ current: null }) },
);

/** The real `ingest`, on the real payload — never a test-side re-implementation (§6.3). */
function app(mutate) {
  const a = Object.create(Component.prototype);
  a.settings = {}; a.beats = []; a.track = () => {}; a._saveProgress = () => {};
  a.get = (_k, d) => d; a.set = () => {};
  a.ingest(JSON.parse(JSON.stringify(WIRE)));
  if (mutate) mutate(a);
  return a;
}

const APP = app();
const DECKS = MANIFEST.decks;
const SITES = APP.nodes.filter((n) => n.rep);

// ── 1: THE BIJECTION ────────────────────────────────────────────────────────────────────────

test("every shipped deck is mintable, and every mintable key ships a deck", () => {
  const mint = new Set(APP.nodes.map((n) => APP.deckKeyFor(n).key));
  const shipped = new Set(Object.keys(DECKS));

  // non-triviality floor FIRST: an empty node list would satisfy set equality perfectly.
  assert.ok(shipped.size >= 2900, `manifest starved: ${shipped.size} decks`);
  assert.ok(APP.nodes.length >= 2900, `node set starved: ${APP.nodes.length}`);

  const unreachable = [...shipped].filter((k) => !mint.has(k));
  assert.deepEqual(unreachable, [], `${unreachable.length} shipped deck(s) the app cannot ask for`);
  const orphan = [...mint].filter((k) => !shipped.has(k));
  assert.deepEqual(orphan, [], `${orphan.length} minted key(s) with no deck behind them`);
  assert.equal(mint.size, shipped.size);
});

// ── 2: EACH MEMBER RESOLVES TO ITS OWN SEAT ─────────────────────────────────────────────────

test("all 1,331 technique sites: the rep keys |Attacker and the partner keys |Defender", () => {
  const tech = SITES.filter((n) => n.ty !== "positions");
  assert.equal(tech.length, 1331, "the technique site count itself");
  let checked = 0;
  for (const rep of tech) {
    const partner = APP.nodes.find((m) => m.id === rep.pairId);
    assert.ok(partner, `${rep.id} has a partner`);
    assert.equal(APP.deckKeyFor(rep).role, "Attacker", rep.id);
    assert.equal(APP.deckKeyFor(partner).role, "Defender", partner.id);
    checked += 2;
  }
  assert.equal(checked, 2662, "positive coverage: every technique seat was read");
});

test("all 136 position sites: the rep keys |Top and the partner keys |Bottom", () => {
  const pos = SITES.filter((n) => n.ty === "positions");
  assert.equal(pos.length, 136);
  let checked = 0;
  for (const rep of pos) {
    const partner = APP.nodes.find((m) => m.id === rep.pairId);
    assert.equal(APP.deckKeyFor(rep).role, "Top", rep.id);
    assert.equal(APP.deckKeyFor(partner).role, "Bottom", partner.id);
    checked += 2;
  }
  assert.equal(checked, 272);
});

// ── 3: THE ROLL STILL OVERRIDES THE MEMBER, AND LEGACY IS UNTOUCHED ─────────────────────────

test("standing on a position, the SIDE YOU PLAY wins over the member's own stamp", () => {
  // `playedRole`'s first branch is the whole reason it exists: the top orb of the state in play,
  // while you are playing bottom, is still YOUR deck. Reading the member there would re-break it.
  const rep = SITES.find((n) => n.ty === "positions");
  const a = app((x) => { x.currentPos = rep.idx; x.playerRole = "bottom"; });
  assert.equal(a.deckKeyFor(a.nodes[rep.idx]).role, "Bottom", "the roll's seat, not the member's");
  const b = app((x) => { x.currentPos = rep.idx; x.playerRole = "top"; });
  assert.equal(b.deckKeyFor(b.nodes[rep.idx]).role, "Top");
});

test("?dual=legacy is byte-identical: with no stamped role, techniques fall back to |Attacker", () => {
  // The escape hatch ships no pairs, so no node carries `role`. Both fixes must be the identity
  // there or the flag stops being an escape hatch.
  const a = app((x) => { for (const n of x.nodes) delete n.role; });
  const tech = a.nodes.filter((n) => n.ty !== "positions");
  assert.ok(tech.length > 2000);
  assert.equal(tech.filter((n) => a.deckKeyFor(n).role !== "Attacker").length, 0);
});

// ── 4: THE FIX MUST NOT MOVE THE HAND ───────────────────────────────────────────────────────

test("the dealt hand is untouched: every option is the rep member, on all 272 states", () => {
  // The claim that made `deckRole` safe to change was that `_deriveDualPairs` hands the attempt
  // edge to the PERFORMER side, so `optionsFor` can only ever deal a rep. That is reasoning, and
  // reasoning is what §6.5 says gets this repo into trouble — so it is measured instead, over the
  // whole state space rather than a sample. If a future change ever deals a partner, the option's
  // deck key silently becomes |Defender and its EDGE, odds and mastery credit move with it.
  // AGAINST A CONTROL FRAME (v1.153.0). `optionsFor` now drops moves the active ruleset cannot
  // produce. In gi that removes nothing today, so this count is unchanged — but the mask is forced
  // all-ones anyway so the number stays this test's own subject: a bare count would silently start
  // measuring the ruleset filter the day `EXCLUDING_FRAMES` gains "gi", and would then have to be
  // re-typed on every availability change. The ruleset differential is
  // `tests/ruleset_availability.test.mjs`'s subject, not this one's.
  const a = app();
  a._rsOk = new Uint8Array(a.nodes.length).fill(1);
  a.flashcards = { decks: {} }; a.prep = {}; a.rec = {}; a.stage = {}; a.srs = {}; a._sharp = {};
  let states = 0, options = 0, moved = 0;
  for (const p of a.nodes.filter((n) => n.ty === "positions")) {
    a.currentPos = p.idx;
    a.playerRole = p.role === "bottom" ? "bottom" : "top";
    let o;
    try { o = a.optionsFor(p.idx); } catch { continue; }
    if (!o || !o.length) continue;
    states++;
    for (const x of o) {
      const n = x.node || a.nodes[x.idx];
      if (!n) continue;
      options++;
      if (n.role === "defender" || a.deckKeyFor(n).role !== "Attacker") moved++;
    }
  }
  assert.equal(states, 272, "every position seat deals a hand");   // positive coverage
  assert.equal(options, 1326, "and the whole corpus of dealt options was read");
  assert.equal(moved, 0, `${moved} dealt option(s) resolved to a Defender deck`);
});
