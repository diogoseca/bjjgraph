// FLOW kernel contract — the JS the browser runs against the Python that gates it.
//
// `neural/src/flow.src.js` and `scripts/solve_flow.py` implement the SAME policy evaluation.
// Two implementations of one thing is the §6.5 shape that put a stale `playFrom` next to
// `rollFromPosition` for months — so they exist deliberately (one has to run in a browser, the
// other has to be reproducible from a committed artifact) and this file is the reason that is
// safe: a WHOLE-STRUCTURE differential, not a spot check. §6.6 is explicit that a non-null
// count passes a wrong-but-complete remap, so every deck's gradient is compared.
//
// THE TWO SIDES READ DIFFERENT INPUTS ON PURPOSE. Python reads `graph.json` (exact floats);
// the JS rebuilds from the shipped wire, whose attempt shares are INTEGER percents. So
// magnitudes drift wherever a share is small — measured worst case `Back Control to Cross Body
// Ride`, 0.01299 -> 0.01000, 23.6% on that one deck. `p0` is bit-identical (measured: max
// difference 0.00000 across the state checked), so the drift is entirely that rounding. The
// RANKING is unaffected and is pinned exactly here; the magnitudes are pinned with a floor.
//
// Regenerate the fixture: python3 scripts/solve_flow.py --reference
// Run: node --test tests/flow.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  ngFlowBuild, ngFlowAdjoint, ngFlowV0, ngFlowExactGain, ngFlowScore, ngFlowPersonal,
  NG_FLOW_H, NG_FLOW_MCAP,
} from "../neural/src/flow.src.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const R = (p) => resolve(HERE, "..", p);
const src = readFileSync(R("neural/src/app.src.jsx"), "utf8");
const REF = JSON.parse(readFileSync(R("tests/artifacts/flow_reference.json"), "utf8"));
const WIRE = JSON.parse(readFileSync(R("source/quartz/static/neural/graph-data.json"), "utf8"));

const Component = new Function("DCLogic", "React", `${src}\nreturn Component;`)(
  class DCLogic {}, { createRef: () => ({ current: null }) },
);

/** The real `ingest`, on the real payload — never a spec-side re-implementation (§6.3). */
function kernel() {
  const a = Object.create(Component.prototype);
  a.settings = {}; a.beats = []; a.track = () => {}; a._saveProgress = () => {};
  a.get = (_k, d) => d; a.set = () => {};
  a.ingest(JSON.parse(JSON.stringify(WIRE)));
  return { app: a, K: ngFlowBuild(a) };
}

const { app: APP, K } = kernel();
const ZERO = new Float64Array(K.deckKeys.length);
const RUN = ngFlowAdjoint(K, ZERO, REF.lam, REF.horizon, null, null);
const PY = new Map(REF.decks.map((d, i) => [d, REF.grad[i]]));

// ── 1: THE PAIR MUST NOT DOUBLE THE STATE SPACE ─────────────────────────────────────────────

test("the kernel collapses the pair: 544 ev entries become 272 states, nothing dropped", () => {
  // `_deriveDualPairs` files the SAME cal.ev block on BOTH pair members, so `_ev` holds two
  // entries per hand. Iterating it directly doubles every stake AND still prints plausible
  // numbers — §6.6's index-join failure exactly. The dedupe is on posId/role.
  assert.equal(APP._ev.size, 544, "the wire really does file both members");
  assert.equal(K.cov.evKeys, 544);
  assert.equal(K.n, 272, "272 role-nodes, not 544");
  assert.equal(K.cov.dropped, 0, "every ev entry resolved to a posId");
  assert.equal(K.cov.unresolved, 0, "every continuation cell resolved to a state");
  assert.ok(K.cov.cells > 5000, `positive cell coverage, got ${K.cov.cells}`);
});

test("both roles carry occupancy — the top-member collapse must never come back", () => {
  // The cheap formula this replaced scored EXACTLY 0 for every bottom-side technique, because
  // `startPosTraffic` keys through `_posSlugIndex`, which maps a position to its TOP member.
  // A bottom player was handed fifteen guard-passing techniques as their "weakest spots".
  const bottom = K.states.filter((s, i) => s.endsWith("/bottom") && RUN.rhoV[REF.horizon][i] > 0);
  assert.equal(bottom.length, 136, "all 136 bottom states carry start occupancy");
  const botDecks = K.deckKeys.filter((d, i) => d.endsWith("|Bottom") && RUN.grad[i] !== 0);
  assert.ok(botDecks.length >= 130, `bottom position decks must score, got ${botDecks.length}`);
});

// ── 2: THE WHOLE-STRUCTURE DIFFERENTIAL AGAINST THE PYTHON REFERENCE ────────────────────────

test("the JS kernel scores the same deck set as the Python reference", () => {
  assert.equal(K.deckKeys.length, REF.decks.length);
  assert.equal(K.nPosDecks, REF.nPosDecks);
  assert.deepEqual([...K.deckKeys].sort(), [...REF.decks].sort());
});

// 0.03, not 0.01, and the reason is NOT rounding — the header's rounding story explains the
// per-deck magnitudes (test below, still pinned) but no longer explains this scalar.
//
// MEASURED, v1.156.0. The two sides build from different move sets: Python reads graph.json's
// full per-state transition list, the JS rebuilds from `cal.ev` in the wire, which carries only
// the (state, move) pairs the EDGE solver scored — 1,248 pairs over 272 states. Kimura
// Trap/Bottom is authored with ten moves and all ten survive the nogi reachability walk, but its
// wire `ev` block carries four. That disagreement was WEIGHTLESS while the state was
// unreachable-by-success, so this assertion was green at 1% without ever having looked at it.
//
// v1.156.0 restored the success arrival into that state (`Half Guard to Kimura Trap`), and the
// disagreement immediately acquired weight: js 0.078299 vs py 0.076493, rel 2.362%. Attribution,
// by rebuilding graph.json three times and re-solving:
//     neither new move dealt : V0 0.079070  (bit-equal to the previous committed reference)
//     + Achilles Lock only   : V0 0.079162  (+0.12%)
//     + the Kimura Trap entry: V0 0.077247  (-2.42%)  <- all of it
// (v1.157.0 then moved the Kimura finish to the Bottom seat under the owner's ruling, taking py
//  to 0.076847; the js/py gap is unchanged in cause and size.)
// Python prices that state as a value sink because you cannot finish from it (no submission is
// dealt from Kimura Trap/Bottom) and three of its ten moves loop straight back into it. The JS's
// four-move view of the same state does not price it the same way.
//
// OPEN, and the owner's: whether `solve_flow.py` should build from the same reduced move set the
// wire ships, or the emitter should carry the full list into `cal.ev`. Until that is decided this
// bound tolerates a KNOWN structural gap, not noise — so it is stated with its measurement rather
// than rounded up for comfort. The rounding-only gap is ~0.05%; if this reads much below 2.3%
// again, the underlying disagreement has been fixed and the bound should come back down.
//
// MUTATION, and its blind spot: because the live gap is already 2.391% in one direction, this
// bound is ONE-SIDED. Scaling REF.v0 by 0.99 kills it (rel 3.425%) and by 0.90 kills it, but
// +0.5% / +2% survive — an upward drift of the reference moves it TOWARD the JS value and
// shrinks rel. Read this green as coverage of downward drift only.
test("V0 agrees with the reference within the wire's own rounding", () => {
  const rel = Math.abs(RUN.V0 - REF.v0) / Math.abs(REF.v0);
  assert.ok(rel < 0.03, `V0 js ${RUN.V0} vs py ${REF.v0} (rel ${(rel * 100).toFixed(3)}%)`);
});

test("the RANKING is exact: same top 40, same order at the top", () => {
  const jsOrder = [...K.deckKeys].sort((a, b) => RUN.grad[K.deckIdx.get(b)] - RUN.grad[K.deckIdx.get(a)]);
  const pyOrder = [...REF.decks].sort((a, b) => PY.get(b) - PY.get(a));
  assert.deepEqual(jsOrder.slice(0, 40).sort(), pyOrder.slice(0, 40).sort(), "top-40 set");
  assert.deepEqual(jsOrder.slice(0, 10), pyOrder.slice(0, 10), "top-10 order");
  // and the top is positions, which is the finding gameScore cannot see (it weights them 0)
  assert.ok(jsOrder.slice(0, 10).every((d) => d.endsWith("|Top") || d.endsWith("|Bottom")),
    "the ten highest-value decks are positions");
});

test("magnitudes agree except where the wire rounded a small attempt share", () => {
  let n = 0, ok = 0, worst = 0, worstDeck = "";
  for (const d of K.deckKeys) {
    const p = PY.get(d), j = RUN.grad[K.deckIdx.get(d)];
    if (Math.abs(p) <= 1e-4) continue;
    n++;
    const rel = Math.abs(j - p) / Math.abs(p);
    if (rel <= 0.05) ok++;
    if (rel > worst) { worst = rel; worstDeck = d; }
  }
  assert.ok(n > 1400, `positive coverage: ${n} decks compared`);
  assert.ok(ok / n >= 0.85, `${((ok / n) * 100).toFixed(1)}% within 5% (floor 85%)`);
  // the residual is BOUNDED by the rounding, not open-ended
  assert.ok(worst < 0.30, `worst ${(worst * 100).toFixed(1)}% on ${worstDeck}`);
});

// ── 3: THE SIGN. The one claim no crude rule can satisfy. ───────────────────────────────────

test("drilling can LOWER your score, and the negative set matches the reference exactly", () => {
  // MUTANT: `Math.abs(c1)` / `Math.max(0, A - B)` anywhere in ngFlowAdjoint turns this red.
  // Every crude alternative — today's prep tiers, a count, traffic x att x |swing| — passes a
  // "is it value-weighted?" test and fails this one. It is the owner's own requirement:
  // mastering rubber guard funnelled them into an omoplata they fail, and the score has to be
  // able to say so.
  // 24, not 18. The whole drift is ONE cause, and it is the point this test exists to keep visible:
  // the owner's Kimura Trap seat ruling (v1.157.0) and its 2026-09-01 generalisation (v1.158.0) moved
  // BOTH finishes — `Kimura from Kimura Trap` and `Americana from Kimura Trap` — onto Kimura Trap/
  // Bottom, the seat that holds the figure four. Kimura Trap/Top therefore has no submission at all,
  // so every move that SUCCEEDS into it now costs you value. The six joiners, in order:
  //   v1.157.0 (18 -> 19): Shoulder of Justice Kimura Setup|Attacker
  //   v1.158.0 (19 -> 24): Kimura from Back, Kimura from Crab Ride, Kimura from Diamond Guard,
  //                        Kimura Switch, North-South to Kimura  (all |Attacker)
  // Every one of them is a grip-ESTABLISHING move landing on Top, which is the open question the
  // flow_validation_baseline `reviewed` rows name: the position conflates a top kimura trap with a
  // bottom one, and splitting it is the real fix. The count stays HARD-CODED for the same reason the
  // technique-site count does: it is a tripwire, so a drift belongs in a commit message, not absorbed
  // by deriving it from the source it checks.
  const jsNeg = K.deckKeys.filter((d, i) => RUN.grad[i] < -1e-12).sort();
  const pyNeg = REF.decks.filter((d) => PY.get(d) < -1e-12).sort();
  assert.equal(jsNeg.length, 24, "24 decks backfire at lam 2 on a blank profile");
  assert.deepEqual(jsNeg, pyNeg, "and they are the same 24");
  // ...and they are the Eddie Bravo rubber-guard ladder, which is the finding, not a curiosity
  assert.ok(jsNeg.includes("New York to Invisible Collar|Attacker"));
  assert.ok(jsNeg.includes("New York Control to Invisible Collar|Attacker"));
  // a sign-blind build cannot satisfy this: with |grad| the two sums are equal
  let sum = 0, abs = 0;
  for (const g of RUN.grad) { sum += g; abs += Math.abs(g); }
  assert.ok(sum < abs - 1e-9, "sum(grad) must be strictly less than sum(|grad|)");
});

// ── 4: DEGENERACY DETECTORS (§6.6 — a constant with a function around it) ───────────────────

test("the score is not a constant wearing a function", () => {
  const vals = new Set([...RUN.grad].map((g) => g.toFixed(9)));
  assert.ok(vals.size >= 900, `distinct gradient values ${vals.size} (floor 900)`);
  // no bucket may swallow the corpus: check the top decile carries a real share, not all of it
  const sorted = [...RUN.grad].filter((g) => g > 0).sort((a, b) => b - a);
  const total = sorted.reduce((s, g) => s + g, 0);
  const head = sorted.slice(0, Math.ceil(sorted.length * 0.1)).reduce((s, g) => s + g, 0);
  assert.ok(head / total > 0.25 && head / total < 0.95,
    `top decile carries ${((head / total) * 100).toFixed(1)}% — degenerate at either extreme`);
});

test("the adjoint IS the derivative", () => {
  // The cheap claim to get wrong: a forward sweep that looks like an occupancy but is not.
  const eps = 1e-4;
  const order = [...K.deckKeys.keys()].sort((a, b) => Math.abs(RUN.grad[b]) - Math.abs(RUN.grad[a]));
  for (const k of order.slice(0, 4)) {
    const mp = Float64Array.from(ZERO), mm = Float64Array.from(ZERO);
    mp[k] = eps; mm[k] = -eps;
    const fd = (ngFlowV0(K, mp, REF.lam, REF.horizon) - ngFlowV0(K, mm, REF.lam, REF.horizon)) / (2 * eps);
    const rel = Math.abs(fd - RUN.grad[k]) / Math.max(Math.abs(fd), 1e-12);
    assert.ok(rel < 1e-5, `${K.deckKeys[k]}: grad ${RUN.grad[k]} vs fd ${fd} (rel ${rel})`);
  }
});

test("mastering a deck raises V0 by what the exact re-solve says, and only that deck", () => {
  const k = K.deckIdx.get("Side Control|Top");
  const gain = ngFlowExactGain(K, ZERO, k, REF.lam, REF.horizon);
  assert.ok(gain > 0.03 && gain < 0.06, `Side Control|Top exact gain ${gain}`);
  // the linearisation RANKS but must never be trusted for a sign: record the real spread
  const lin = RUN.grad[k] * NG_FLOW_MCAP;
  const ratio = lin / gain;
  assert.ok(ratio > 0.85 && ratio < 1.15, `linearisation recovers ${(ratio * 100).toFixed(1)}%`);
});

test("the horizon the kernel ships at is the one the reference was solved at", () => {
  assert.equal(NG_FLOW_H, REF.horizon, "a horizon change must regenerate the fixture");
});

// ── 5: THE APP SURFACE — weakSpots / newTechniques on the real payload ──────────────────────
//
// `weakSpots()` references the kernel by the names the BUNDLE gives it (build.mjs concatenates
// flow.src.js above the class), so a headless harness has to inject them. That injection is
// also the proof the fallback works: without it, `flowScore()` throws, `weakSpots()` returns the
// legacy prep tiers and fires `flow_cold` — which is the behaviour a partial payload must get.

const MANIFEST = JSON.parse(readFileSync(R("source/quartz/static/neural/flashcards/_index.json"), "utf8"));
const FlowComponent = new Function(
  "DCLogic", "React", "ngFlowBuild", "ngFlowScore", "ngFlowPersonal",
  `${src}\nreturn Component;`,
)(class DCLogic {}, { createRef: () => ({ current: null }) },
  ngFlowBuild, ngFlowScore, ngFlowPersonal);

function fullApp(opts = {}) {
  const a = Object.create(FlowComponent.prototype);
  const store = Object.assign({}, opts.settings);
  a.settings = {}; a.beats = []; a.track = () => {}; a._saveProgress = () => {};
  a.noteChallenges = () => {};
  a.get = (k, d) => (k in store ? store[k] : d);
  a.set = (k, v) => { store[k] = v; };
  a.ingest(JSON.parse(JSON.stringify(WIRE)));
  a._ingestDeckManifest(JSON.parse(JSON.stringify(MANIFEST)));
  a.prep = opts.prep || {}; a.stage = {}; a.rec = {}; a.srs = {};
  a.flow = opts.flow || {}; a._exploredKeys = new Set(); a._days = {};
  return a;
}

test("weakSpots is the FLOW ranking, and it keeps the digest's wire shape", () => {
  const a = fullApp();
  const w = a.weakSpots();
  assert.ok(!w.cold, "the kernel built");
  assert.ok(w.ranked.length > 20, `ranked pool ${w.ranked.length}`);
  // THE DIGEST WIRE. app.src.jsx writes e.w = [w.n, w.word].concat(w.top) into dayLog, which is
  // persisted, cloud-synced, and read back by a scheduled Worker DAYS later via .slice(2) — with
  // no gate anywhere. A shape change is a broken email, not a red test.
  assert.equal(typeof w.n, "number");
  assert.equal(typeof w.word, "string");
  assert.ok(Array.isArray(w.top) && w.top.length <= 2);
  for (const k of w.top) assert.ok(typeof k === "string" && k.includes("|"), `deck key, got ${k}`);
  // ...and `top` is now the heaviest, not the alphabetically first. The old rule filtered
  // Object.keys(decks) — which ships sorted — so the digest told every fresh user their softest
  // spot was `100% Sweep`, forever.
  assert.notEqual(w.top[0], "100% Sweep|Attacker");
  assert.equal(w.top[0], "Side Control|Top");
});

test("one entry per family, and every row is a deck the user can actually open", () => {
  const a = fullApp();
  const w = a.weakSpots();
  const fams = w.ranked.map((r) => r.deck.split("|")[0]);
  assert.equal(new Set(fams).size, fams.length, "no family appears twice");
  for (const r of w.ranked) assert.ok(a.flashcards.decks[r.deck], `${r.deck} is in the manifest`);
});

test("the dose is a CARD budget and maintenance takes precedence", () => {
  const a = fullApp();
  a.dueCount = () => 0;
  const fresh = a.newTechniques();
  const cards = fresh.reduce((s, k) => s + (a._deckCardCount(a.flashcards.decks[k]) || 0), 0);
  assert.ok(fresh.length > 0, "an empty day deals something");
  assert.ok(cards <= a.get("dailyGoal", 30), `${cards} cards must fit the 30-card budget`);
  // owner's rule: "if we only have maintenance to do, we can't afford to waste the daily goal"
  a.dueCount = () => 30;
  assert.deepEqual(a.newTechniques(), [], "maintenance owning the day leaves no room");
  a.dueCount = () => 24;
  const squeezed = a.newTechniques();
  assert.ok(squeezed.length >= 1 && squeezed.length < fresh.length, "a partial day deals less");
});

test("a missing kernel degrades LOUDLY to the old rule, never to a table of zeros", () => {
  // §6.6: absence must not produce a plausible answer. The legacy path is reachable and named.
  const a = Object.create(Component.prototype);          // built WITHOUT the flow functions
  a.settings = {}; a.beats = []; a.track = () => {}; a._saveProgress = () => {};
  a.noteChallenges = () => {};
  a.get = (_k, d) => d; a.set = () => {};
  a.ingest(JSON.parse(JSON.stringify(WIRE)));
  a._ingestDeckManifest(JSON.parse(JSON.stringify(MANIFEST)));
  a.prep = {}; a.stage = {}; a.rec = {}; a.srs = {}; a.flow = {}; a._exploredKeys = new Set();
  const w = a.weakSpots();
  assert.equal(w.cold, true, "it says it is cold");
  assert.ok(w.n >= 0 && typeof w.word === "string", "and still answers the digest's shape");
  assert.ok(a.beats.some((b) => b && b.beat === "flow_cold"), "and fires a NAMED beat");
});

test("the ledger reaches the score: recorded rolls move the ranking", () => {
  // The whole point of making rolling a write path. Two profiles, identical except that one has
  // rolled: the estimator must produce a DIFFERENT ranking, or personalisation is theatre.
  const base = fullApp();
  const cold = base.weakSpots().ranked.map((r) => r.deck);
  const K = base._flowKernel;
  // hammer one state's moves so the Dirichlet actually bites (pseudo = 8)
  const st = K.stateIdx.get("closed-guard/bottom");
  const led = {};
  const pk = K.deckKeys[K.posDeck[st]];
  led[pk] = {};
  for (const a2 of K.hands[st].slice(0, 3)) if (a2.ord >= 0) led[pk][a2.ord] = [40, 2];  // tried a lot, landed little
  const warm = fullApp({ flow: { dev1: led } });
  assert.ok(warm.flowN() > 0, `the ledger reads back, got ${warm.flowN()}`);
  const hot = warm.weakSpots();
  assert.ok(!hot.cold);
  assert.ok(hot.cov.decisions > 0, "coverage names the decisions it used");
  assert.notDeepEqual(hot.ranked.map((r) => r.deck), cold, "a rolled profile ranks differently");
});
