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
// ONE ROW PER GAME THE APP CAN PRICE (v1.209.0). The fixture holds four variants — no-gi and gi,
// each from the uniform "Anywhere" start and from Standing — because the weak-spots ranking is
// now solved in the player's own ruleset and from the start their own rolls use. Every variant is
// the frame as the APP builds it: the frame's own success rate and the ruleset layer's exclusions.
//
// THE HARNESS SERVES NO localStorage, SO IT BOOTS IN GI (§6.4). `_hydrateGiMode` reads the
// ruleset from localStorage and falls back to "gi"; until v1.209.0 every kernel in this file was
// therefore a GI-MODE app with the NO-GI hands — which is exactly the bug a gi player had, and a
// real no-gi player's kernel (the reachability mask on: 248 states, not 264) was never compared
// with anything. Every app here now names its ruleset.
//
// MUTATION RECORD (v1.209.0), each run against the full file; KILLED = at least one named test red:
//   M1  ngFlowBuild reads `_ev` where it should read `_evGi`         KILLED — 9 red (0, 1, gi rows, 6a-6c, 7c)
//   M2  ngFlowBuild drops `rateOf` (gi prices at the folded rate)    KILLED — gi rows, sign, 6a, 6b
//   M3  _deriveDualPairs does not carry `evGi`                       KILLED — 9 red
//   M4  flowScore's memo key omits the start                         KILLED — 7b, 7d
//   M5  ngFlowScore ignores the start law (d0 -> null)               KILLED — 7b
//   M6  ngFlowStart weights only the top seat                        KILLED — standing rows, 7a, 7b
//   M7  _flowStartSpec maps "weak" to Standing too                   KILLED — 7b
//   M8  the emitter files the NO-GI Model's hands as `evGi`          KILLED — 7 red (re-emitted wire)
//   M9  calSuccess ignores its frame argument                        KILLED — 6a (the override)
//   M10 gi cards read `e0` from the gi table (no EDGE rows)          KILLED — 6a
//   M11 ingest never builds `_evGi`                                  KILLED — 9 red
//   M12 flowScore reuses a kernel across a ruleset flip              KILLED — 6d (survived until 6d)
//   Non-kill, recorded so nobody reads this file as covering it: a stale served payload beside a
//   newer bundle is covered only through the stripped-wire fixture in 6c, never a real browser.
//
// Regenerate the fixture: python3 scripts/solve_flow.py --reference
// Run: node --test tests/flow.test.mjs
import { test } from "node:test";
import { gameplanAppSource, gameplanRuntime } from "./_gameplan_harness.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  ngFlowBuild, ngFlowAdjoint, ngFlowV0, ngFlowExactGain, ngFlowScore, ngFlowPersonal, ngFlowStart,
  NG_FLOW_H, NG_FLOW_MCAP,
} from "../neural/src/flow.src.js";
import { ngWireDecks, ngWireScoreWeights } from "../neural/src/wire-keys.src.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const R = (p) => resolve(HERE, "..", p);
const src = gameplanAppSource;
const REF = JSON.parse(readFileSync(R("tests/artifacts/flow_reference.json"), "utf8"));
const WIRE = JSON.parse(readFileSync(R("source/quartz/static/neural/graph-data.json"), "utf8"));
const STANDING = { posId: "standing-position" };

/** One fixture row as {v0, states, nPosDecks, decks, grad, py: Map(deck -> grad)}. */
function refOf(key) {
  const v = REF.variants[key];
  assert.ok(v, `the fixture has no ${key} row — regenerate it with solve_flow.py --reference`);
  const py = new Map();
  REF.decks.forEach((d, i) => { if (v.grad[i] != null) py.set(d, v.grad[i]); });
  return Object.assign({}, v, { decks: [...py.keys()], py: py });
}

// Built WITHOUT the flow functions (test 15 needs exactly that), but WITH the wire decoder the
// bundle concatenates above the class — the deck manifest cannot be ingested without it (v1.204.3).
const Component = new Function("DCLogic", "React", "ngWireDecks", "ngWireScoreWeights", `${src}\nreturn Component;`)(
  class DCLogic {}, { createRef: () => ({ current: null }) }, ngWireDecks, ngWireScoreWeights,
);

/** The real `ingest`, on the real payload — never a spec-side re-implementation (§6.3). */
function bootApp(frame, wire) {
  const a = Object.create(Component.prototype);
  a.settings = {}; a.beats = []; a.track = () => {}; a._saveProgress = () => {};
  a.get = (_k, d) => d; a.set = () => {};
  a._giMode = frame;                       // named, never inherited from an absent localStorage
  a.ingest(JSON.parse(JSON.stringify(wire || WIRE)));
  return a;
}
function kernel(frame) { const app = bootApp(frame); return { app: app, K: ngFlowBuild(app) }; }

const { app: APP, K } = kernel("nogi");
const { app: APPG, K: KG } = kernel("gi");
const ZERO = new Float64Array(K.deckKeys.length);
const RUN = ngFlowAdjoint(K, ZERO, REF.lam, REF.horizon, null, null);
const NOGI = refOf("nogi");
const PY = NOGI.py;

// ── 0: THE HARNESS NAMES ITS RULESET ────────────────────────────────────────────────────────

test("each kernel prices the ruleset its app is in, on that ruleset's own hands", () => {
  assert.equal(K.frame, "nogi"); assert.equal(K.handsFrame, "nogi");
  assert.equal(KG.frame, "gi"); assert.equal(KG.handsFrame, "gi");
  assert.ok(APPG._evGi.size >= 500, `gi hands coverage starved: ${APPG._evGi.size}`);
});

// ── 1: THE PAIR MUST NOT DOUBLE THE STATE SPACE ─────────────────────────────────────────────

test("the kernel collapses the pair, and the no-gi mask removes exactly what the walk excludes", () => {
  // `_deriveDualPairs` files the SAME block on BOTH pair members, so `_ev` / `_evGi` hold two
  // entries per hand. Iterating either directly doubles every stake AND still prints plausible
  // numbers — §6.6's index-join failure exactly. The dedupe is on posId/role.
  // DERIVED, not typed: each count follows the corpus and the reachability walk.
  for (const [app, k, tab, ref] of [[APP, K, APP._ev, NOGI], [APPG, KG, APPG._evGi, refOf("gi")]]) {
    const f = k.frame;
    assert.equal(tab.size % 2, 0, `${f}: the wire files BOTH members of every pair, so the count is even`);
    assert.equal(k.cov.evKeys, tab.size, `${f}: the kernel reads every entry the wire filed`);
    assert.ok(tab.size >= 500, `${f}: hand coverage starved: ${tab.size}`);
    // every filed hand is a kernel state, less what the ruleset mask and the two-seat rule remove
    assert.equal(k.n, tab.size / 2 - k.cov.rsDropped / 2 - k.cov.oppNoHand,
      `${f}: the kernel's states are the filed hands less the masked and one-seated ones (${JSON.stringify(k.cov)})`);
    // ...and that is the SAME state set the reference priced after the app's own exclusions
    assert.equal(k.n, ref.states, `${f}: JS holds ${k.n} states, the reference priced ${ref.states}`);
    assert.equal(k.n, k.states.length, `${f}: the kernel's width IS its state set — role-nodes, not members`);
    assert.equal(k.cov.dropped, 0, `${f}: every entry resolved to a posId`);
    assert.equal(k.cov.unresolved, 0, `${f}: every continuation cell resolved to a state`);
    assert.ok(k.cov.cells > 5000, `${f}: positive cell coverage, got ${k.cov.cells}`);
  }
  // the no-gi mask ACTED — the case the gi-mode harness never exercised — and gi's did not
  assert.ok(K.cov.rsDropped >= 30, `no-gi: the ruleset mask removed only ${K.cov.rsDropped} entries`);
  assert.equal(KG.cov.rsDropped, 0, "gi: nothing is excluded in gi (EXCLUDING_FRAMES is no-gi only)");
});

test("both roles carry occupancy — the top-member collapse must never come back", () => {
  // The cheap formula this replaced scored EXACTLY 0 for every bottom-side technique, because
  // `startPosTraffic` keys through `_posSlugIndex`, which maps a position to its TOP member.
  // A bottom player was handed fifteen guard-passing techniques as their "weakest spots".
  for (const k of [K, KG]) {
    const run = k === K ? RUN : ngFlowAdjoint(k, new Float64Array(k.deckKeys.length), REF.lam, REF.horizon, null, null);
    const bottomStates = k.states.filter((s) => s.endsWith("/bottom"));
    const bottom = k.states.filter((s, i) => s.endsWith("/bottom") && run.rhoV[REF.horizon][i] > 0);
    assert.ok(bottomStates.length >= 120, `${k.frame}: bottom-state coverage starved: ${bottomStates.length}`);
    assert.equal(bottom.length, bottomStates.length,
      `${k.frame}: every bottom state the kernel holds must carry start occupancy (${bottom.length} of ${bottomStates.length})`);
    const botDecks = k.deckKeys.filter((d, i) => d.endsWith("|Bottom") && run.grad[i] !== 0);
    assert.ok(botDecks.length >= 120, `${k.frame}: bottom position decks must score, got ${botDecks.length}`);
  }
});

// ── 2: THE WHOLE-STRUCTURE DIFFERENTIAL AGAINST THE PYTHON REFERENCE, PER GAME ──────────────
//
// V0 within 3%, and the reason IS rounding: the wire's attempt shares are whole percents.
//   MEASURED on v1.205.2 for the no-gi hands: the JS value IS the authored kernel with each state's
//   attempt shares rounded to whole percents exactly as the emitter rounds them (equal to 1.4e-17),
//   and permille shares (+835 B gzip) would cut the gap to 0.14%. Recompute:
//   python3 -B scripts/semantics/scalars.py --consequences.
//   MUTATION, and its blind spot: because each live gap is in one direction, the V0 bound is
//   ONE-SIDED (scaling REF.v0 by 0.99 kills the no-gi row; +0.5% / +2% survive).
//
// The TOLERANCES are per game because the rounding lands differently in each, and every figure
// below is the one MEASURED at v1.212.0 (origin coherence phase 2) so a drift is visible against it:
//   game            V0 gap   top-40 shared   within 5%   worst deck                       L1 gap
//   nogi            0.84%    39/40           86.6%       31.0% Knee Torque Sweep|Attacker 1.56%
//   gi              1.78%    39/40           88.7%       29.5% Kneebar from Half Guard    1.55%
//   nogi/standing   0.18%    40/40           68.6%       31.0% Knee Torque Sweep|Attacker 2.37%
//   gi/standing     1.10%    39/40           73.9%       29.5% Kneebar from Half Guard    1.79%
// v1.212.0 raised the no-gi worst-deck bounds 0.30 -> 0.35 and the top-10 near-tie 1% -> 1.5%, and
// both are ROUNDING, proved rather than assumed: half-guard/bottom now deals Knee Shield Retention
// (deal_here) and lost Lumberjack Sweep (re-homed), so its 1-point cards are 1.408% of the hand and
// ship as 1% — Knee Torque Sweep's gradient is 0.69x the reference's. The same kernel fed the EXACT
// shares (build_hand's, patched into cal.ev / cal.evGi) agrees in all four games: L1 0.00-0.02%,
// top-40 40/40, top-10 order exact. The gi/standing swap (Closed Guard|Top / Half Guard|Top, 1.30%
// apart in the reference) is the same hand. MUTATION: the reference built WITHOUT the deal_here rule
// while the wire keeps it is red in all four games under these bounds (no-gi top-40 37, gi rank 3,
// no-gi/standing rank 6, gi/standing rank 7).
// (v1.210.0: nogi 2.07% / 39/40 / 85.5% / 23.4% / 1.60%; gi 1.84% / 40/40 / 87.8% / 29.0% Spine Lock
// from Truck / 1.50%; nogi/standing 0.87% / 39/40 / 65.4% / 24.7% / 2.31%; gi/standing 1.13% / 39/40 /
// 75.2% / 26.5% / 1.79%.)
// (v1.209.0, before the orphaned techniques were listed at their origins: nogi 2.45% / 40/40 / 87.0% /
// 23.6% / 1.47%; gi 0.68% / 39/40 / 88.7% / 29.0% / 1.44%; nogi/standing 1.05% / 39/40 / 65.1% / 24.6%
// / 2.19%; gi/standing 0.49% / 40/40 / 75.2% / 23.6% / 1.67%.)
// A 39/40 is a boundary swap, not a disagreement: in no-gi it is `Arm Extraction|Attacker`, newly
// listed at side-control/bottom, at py 40 against js 42, its two gradients within 3%. A standing start concentrates all the mass on two hands (standing has
// the largest, 34 cards, many at 1-2%), so whole-percent rounding moves individual magnitudes more
// — the aggregate L1 gap stays under 3% in every game, and the ORDER at the top is exact in all four,
// up to one adjacent near-tie in no-gi (see the top-10 rule in the test).
const GAMES = {
  "nogi":          { frame: "nogi", start: null,     top40: 39, band: 0.85, worst: 0.35 },
  "gi":            { frame: "gi",   start: null,     top40: 39, band: 0.85, worst: 0.35 },
  "nogi/standing": { frame: "nogi", start: STANDING, top40: 38, band: 0.60, worst: 0.35 },
  "gi/standing":   { frame: "gi",   start: STANDING, top40: 39, band: 0.70, worst: 0.30 },
};
function solveGame(key) {
  const g = GAMES[key], k = g.frame === "gi" ? KG : K;
  const st = ngFlowStart(k, g.start);
  const run = ngFlowAdjoint(k, new Float64Array(k.deckKeys.length), REF.lam, REF.horizon, null, st.d0);
  return { g: g, k: k, st: st, run: run, ref: refOf(key) };
}
const SOLVED = Object.fromEntries(Object.keys(GAMES).map((key) => [key, solveGame(key)]));

for (const key of Object.keys(GAMES)) {
  test(`[${key}] the JS kernel matches the reference: deck set, V0, order at the top, magnitudes, sign`, () => {
    const { g, k, st, run, ref } = SOLVED[key];
    assert.equal(st.miss, false, "the start law found its states");
    assert.equal(st.seats, g.start ? 2 : k.n, "the start law's support");
    // the deck set, whole
    assert.equal(k.nPosDecks, ref.nPosDecks);
    assert.deepEqual([...k.deckKeys].sort(), [...ref.decks].sort());
    // V0
    const rel = Math.abs(run.V0 - ref.v0) / Math.abs(ref.v0);
    assert.ok(rel < 0.03, `V0 js ${run.V0} vs py ${ref.v0} (rel ${(rel * 100).toFixed(3)}%)`);
    // the order at the top
    const jsOrder = [...k.deckKeys].sort((a, b) => run.grad[k.deckIdx.get(b)] - run.grad[k.deckIdx.get(a)]);
    const pyOrder = [...ref.decks].sort((a, b) => ref.py.get(b) - ref.py.get(a));
    // The ORDER at the top is exact up to an ADJACENT near-tie the wire's whole-percent shares can flip,
    // the same reasoning as the top-40 boundary swap above. Measured at v1.210.0 (origin coherence):
    // in no-gi `Mount|Top` and `Closed Guard|Bottom` are ranks 5/6 with reference gradients 0.110307 vs
    // 0.110738 (0.39% apart), and the wire puts them 0.02% apart the other way round. A swap is
    // allowed only between neighbours within 1.5% in the reference (1% until v1.212.0; see the
    // tolerance table above); anything else is a disagreement.
    // MUTATION: `Back Control|Top`'s reference gradient x0.8 drops it below `Closed Guard|Top` (4.7% apart):
    // red, "not a near-tie swap". Non-kill, recorded: x0.9 on `Half Guard|Bottom` crosses no neighbour.
    assert.deepEqual([...jsOrder.slice(0, 10)].sort(), [...pyOrder.slice(0, 10)].sort(), "top-10 set");
    for (let r = 0; r < 10; r++) {
      if (jsOrder[r] === pyOrder[r]) continue;
      const near = (a, b) => Math.abs(ref.py.get(a) - ref.py.get(b)) / Math.abs(ref.py.get(b)) <= 0.015;
      const swapped = (jsOrder[r] === pyOrder[r + 1] && jsOrder[r + 1] === pyOrder[r] && near(pyOrder[r], pyOrder[r + 1]))
        || (r > 0 && jsOrder[r] === pyOrder[r - 1] && jsOrder[r - 1] === pyOrder[r] && near(pyOrder[r], pyOrder[r - 1]));
      assert.ok(swapped, `top-10 order differs at rank ${r + 1}: js ${jsOrder[r]} vs py ${pyOrder[r]}, not a near-tie swap`);
    }
    const shared = jsOrder.slice(0, 40).filter((d) => pyOrder.slice(0, 40).includes(d)).length;
    assert.ok(shared >= g.top40, `top-40 sets share ${shared} (floor ${g.top40})`);
    // and the top is positions, which is the finding gameScore cannot see (it weights them 0)
    assert.ok(jsOrder.slice(0, 10).every((d) => d.endsWith("|Top") || d.endsWith("|Bottom")),
      "the ten highest-value decks are positions");
    // magnitudes, deck by deck and in aggregate
    let n = 0, ok = 0, worst = 0, worstDeck = "", l1 = 0, l1d = 0;
    for (const d of k.deckKeys) {
      const p = ref.py.get(d), j = run.grad[k.deckIdx.get(d)];
      l1 += Math.abs(j - p); l1d += Math.abs(p);
      if (Math.abs(p) <= 1e-4) continue;
      n++;
      const r = Math.abs(j - p) / Math.abs(p);
      if (r <= 0.05) ok++;
      if (r > worst) { worst = r; worstDeck = d; }
    }
    assert.ok(n > 900, `positive coverage: ${n} decks compared`);
    assert.ok(ok / n >= g.band, `${((ok / n) * 100).toFixed(1)}% within 5% (floor ${g.band * 100}%)`);
    assert.ok(worst < g.worst, `worst ${(worst * 100).toFixed(1)}% on ${worstDeck}`);
    assert.ok(l1 / l1d < 0.03, `aggregate L1 gap ${((l1 / l1d) * 100).toFixed(2)}%`);
    // the sign: the negative set is the reference's, exactly — outside a ZERO band where BOTH kernels
    // call a deck no effect. Whole-percent rounding flips the sign of a gradient that is zero in all
    // but the eighth decimal: v1.212.0, gi/standing, `Crackhead Control to New York|Attacker` is
    // py +3.94e-8 and js -1.03e-9 (exact shares: js +3.94e-8). The band is symmetric, its members
    // are counted, and a real sign error (any gradient either kernel prices above 1e-7) still fails.
    const ZERO = 1e-7;
    const nil = (d) => Math.abs(ref.py.get(d)) < ZERO && Math.abs(run.grad[k.deckIdx.get(d)]) < ZERO;
    const jsNeg = k.deckKeys.filter((d, i) => run.grad[i] < -1e-12 && !nil(d)).sort();
    const pyNeg = ref.decks.filter((d) => ref.py.get(d) < -1e-12 && !nil(d)).sort();
    // Measured at v1.212.0: 0 decks in the band in three games, 10 of 1,560 in gi/standing (2 of them
    // negative on one side: Vaporizer|Bottom and the deck above). The cap is the measurement plus 2.
    assert.ok(k.deckKeys.filter(nil).length <= 12, `${k.deckKeys.filter(nil).length} decks in the zero band`);
    assert.deepEqual(jsNeg, pyNeg, "the decks whose drilling LOWERS the score are the reference's");
  });
}

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
  // v1.209.0: this is now the no-gi kernel a no-gi player actually gets (the mask on); the count did
  // not move. The gi count is its own tripwire — 21, the same ladder without the rows gi prices up.
  // v1.212.0 (origin coherence phase 2): 24 -> 21 in no-gi, 22 -> 21 in gi. Three LEFT, none joined:
  // Body Triangle Lock and Seat Belt to Body Triangle (both |Attacker), and Vaporizer|Bottom (no-gi
  // only). Body triangle now deals Back Control Maintenance (a deal_here listing), so it is worth
  // more than the seat belt it is entered from and entering it stopped costing value.
  const jsNeg = K.deckKeys.filter((d, i) => RUN.grad[i] < -1e-12).sort();
  const pyNeg = NOGI.decks.filter((d) => PY.get(d) < -1e-12).sort();
  assert.equal(jsNeg.length, 21, "21 decks backfire at lam 2 on a blank no-gi profile"); // census:negDecks
  assert.deepEqual(jsNeg, pyNeg, "and they are the same 21");
  const gi = SOLVED.gi;
  const giNeg = gi.k.deckKeys.filter((d, i) => gi.run.grad[i] < -1e-12);
  // 22 since v1.210.0 (origin coherence): `De La Riva to Inverted Guard|Attacker` joined once 50-50 Entry
  // was listed at inverted-guard/bottom, its own origin, and inverted guard stopped being worth more than
  // the DLR it is entered from. Nothing left the set, and no-gi stayed at 24.
  assert.equal(giNeg.length, 21, "21 decks backfire at lam 2 on a blank gi profile"); // census:negDecksGi
  // ...and they are the Eddie Bravo rubber-guard ladder, which is the finding, not a curiosity
  assert.ok(jsNeg.includes("New York to Invisible Collar|Attacker"));
  assert.ok(jsNeg.includes("New York Control to Invisible Collar|Attacker"));
  // a sign-blind build cannot satisfy this: with |grad| the two sums are equal
  let sum = 0, abs = 0;
  for (const g of RUN.grad) { sum += g; abs += Math.abs(g); }
  assert.ok(sum < abs - 1e-9, "sum(grad) must be strictly less than sum(|grad|)");
});

// ── 4: DEGENERACY DETECTORS (§6.6 — a constant with a function around it) ───────────────────

test("the score is not a constant wearing a function — in every game", () => {
  for (const key of Object.keys(GAMES)) {
    const { run } = SOLVED[key];
    const vals = new Set([...run.grad].map((g) => g.toFixed(9)));
    assert.ok(vals.size >= 900, `${key}: distinct gradient values ${vals.size} (floor 900)`);
    // no bucket may swallow the corpus: check the top decile carries a real share, not all of it
    const sorted = [...run.grad].filter((g) => g > 0).sort((a, b) => b - a);
    const total = sorted.reduce((s, g) => s + g, 0);
    const head = sorted.slice(0, Math.ceil(sorted.length * 0.1)).reduce((s, g) => s + g, 0);
    assert.ok(head / total > 0.25 && head / total < 0.95,
      `${key}: top decile carries ${((head / total) * 100).toFixed(1)}% — degenerate at either extreme`);
  }
});

test("the adjoint IS the derivative — under the uniform start and under a fixed one", () => {
  // The cheap claim to get wrong: a forward sweep that looks like an occupancy but is not. A fixed
  // start is a different d0 through the same sweep, so it gets its own finite differences.
  const eps = 1e-4;
  for (const key of ["nogi", "gi/standing"]) {
    const { k, st, run } = SOLVED[key];
    const zero = new Float64Array(k.deckKeys.length);
    const order = [...k.deckKeys.keys()].sort((a, b) => Math.abs(run.grad[b]) - Math.abs(run.grad[a]));
    for (const d of order.slice(0, 4)) {
      const mp = Float64Array.from(zero), mm = Float64Array.from(zero);
      mp[d] = eps; mm[d] = -eps;
      const fd = (ngFlowV0(k, mp, REF.lam, REF.horizon, null, st.d0) - ngFlowV0(k, mm, REF.lam, REF.horizon, null, st.d0)) / (2 * eps);
      const rel = Math.abs(fd - run.grad[d]) / Math.max(Math.abs(fd), 1e-12);
      assert.ok(rel < 1e-5, `${key} ${k.deckKeys[d]}: grad ${run.grad[d]} vs fd ${fd} (rel ${rel})`);
    }
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
  "DCLogic", "React", "ngFlowBuild", "ngFlowScore", "ngFlowPersonal", "ngFlowStart", "ngWireDecks", "ngWireScoreWeights",
  `${src}\nreturn Component;`,
)(class DCLogic {}, { createRef: () => ({ current: null }) },
  ngFlowBuild, ngFlowScore, ngFlowPersonal, ngFlowStart, ngWireDecks, ngWireScoreWeights);

/** `opts.frame` defaults to "gi" because the APP's default ruleset is gi — named, not inherited. */
function fullApp(opts = {}) {
  const a = Object.create(FlowComponent.prototype);
  const store = Object.assign({}, opts.settings);
  a.settings = {}; a.beats = []; a.track = () => {}; a._saveProgress = () => {};
  a.noteChallenges = () => {};
  a.get = (k, d) => (k in store ? store[k] : d);
  a.set = (k, v) => { store[k] = v; };
  a._giMode = opts.frame || "gi";
  a.ingest(JSON.parse(JSON.stringify(opts.wire || WIRE)));
  a._ingestDeckManifest(JSON.parse(JSON.stringify(MANIFEST)));
  a.prep = opts.prep || {}; a.stage = {}; a.rec = {}; a.srs = {};
  a.flow = opts.flow || {}; a._exploredKeys = new Set(); a._days = {};
  return a;
}

test("weakSpots is the FLOW ranking, and it keeps the digest's wire shape", () => {
  for (const frame of ["gi", "nogi"]) {
    const a = fullApp({ frame });
    const w = a.weakSpots();
    assert.ok(!w.cold, `${frame}: the kernel built`);
    assert.ok(w.ranked.length > 20, `${frame}: ranked pool ${w.ranked.length}`);
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
  }
});

test("one entry per family, and every row is a deck the user can actually open", () => {
  const a = fullApp();
  const w = a.weakSpots();
  const fams = w.ranked.map((r) => r.deck.split("|")[0]);
  assert.equal(new Set(fams).size, fams.length, "no family appears twice");
  for (const r of w.ranked) assert.ok(a.flashcards.decks[r.deck], `${r.deck} is in the manifest`);
});

// Dose/grade/debt invariants now live in gameplan*.test.mjs, against the shared planner.
// D1 (owner, 2026-09-30) REVERSES the v1.207.0 contract "FLOW alone deals nothing": with no study
// comparison, the weak-spots ranking fills the plan, so every player, a new one included, has one.
// The honesty half still holds: FLOW is never passed off as a comparison. The plan says
// `weak-spots` and its `comparison` stays `unavailable`.
test("FLOW fills the plan when no comparison exists, and never passes as a comparison", () => {
  const a = fullApp();
  a._refreshGameplanUI = () => {};
  a.setGameplanRuntime(gameplanRuntime);
  const ranked = a.weakSpots().ranked.map((r) => r.deck);
  assert.ok(ranked.length > 0);
  const plan = a.planSummary();
  assert.equal(plan.status, "weak-spots"); assert.equal(plan.comparison, "unavailable");
  assert.ok(plan.fresh.length > 0, "a new player is dealt new techniques");
  assert.ok(plan.fresh.every((r) => ranked.includes(r.key)), "every dealt deck comes from the ranking");
  assert.deepEqual(a.newTechniques(), plan.fresh.map((r) => r.key));
});

test("a missing kernel degrades LOUDLY to the old rule, never to a table of zeros", () => {
  // §6.6: absence must not produce a plausible answer. The legacy path is reachable and named.
  const a = Object.create(Component.prototype);          // built WITHOUT the flow functions
  a.settings = {}; a.beats = []; a.track = () => {}; a._saveProgress = () => {};
  a.noteChallenges = () => {};
  a.get = (_k, d) => d; a.set = () => {};
  a._giMode = "gi";
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
  for (const a2 of K.hands[st].slice(0, 3)) if (a2.ord >= 0) led[pk][a2.ord] = [40, 2, base._epochDay()];  // persisted rows include their observation day
  const warm = fullApp({ flow: { dev1: led } });
  assert.ok(warm.flowN() > 0, `the ledger reads back, got ${warm.flowN()}`);
  const hot = warm.weakSpots();
  assert.ok(!hot.cold);
  assert.ok(hot.cov.decisions > 0, "coverage names the decisions it used");
  assert.notDeepEqual(hot.ranked.map((r) => r.deck), cold, "a rolled profile ranks differently");
});

// ── 6: A GI PLAYER IS RANKED ON GI NUMBERS (owner, 2026-09-30, docs/GraphSemantics.md §10.7) ──
//
// Until v1.209.0 a gi player's weak spots were the no-gi ranking: `cal.ev` holds no-gi hands only,
// so the kernel dealt no-gi attempt shares at the folded no-gi rate, and not one gi-only deck could
// ever be recommended. `cal.evGi` ships the gi hands (+2,598 B gzip, eager gate); the rate is `calSuccess`'s.

/** The wire's own gi fork, read as DATA: technique node id -> gi rate (percent). */
const GI_FORK = new Map(WIRE.nodes
  .filter((n) => n.cal && n.cal.successRateByRuleset && typeof n.cal.successRateByRuleset.gi === "number")
  .map((n) => [n.id, n.cal.successRateByRuleset.gi]));

test("6a: the gi kernel reads the gi hands and the gi rate; the no-gi kernel neither", () => {
  // HANDS: every gi state's card set is the wire's `evGi` block, and at the states whose shares
  // fork, the kernel's normalised shares are the gi ones, not the no-gi ones.
  let forkedStates = 0, cardsCompared = 0;
  for (let i = 0; i < KG.n; i++) {
    const key = KG.states[i];
    const giBlk = APPG._evGi.get([...APPG._evGi.keys()].find((kk) => {
      const sl = kk.lastIndexOf("/"); const n = APPG.nodes[+kk.slice(0, sl)];
      return n && n.posId + "/" + kk.slice(sl + 1) === key;
    }));
    assert.ok(giBlk, `${key}: a gi state with no gi block`);
    const tot = [...giBlk.values()].reduce((s, r) => s + r.att, 0);
    const hand = KG.hands[i];
    assert.equal(hand.length, giBlk.size, `${key}: the kernel deals the gi block's cards`);
    const ni = K.stateIdx.get(key);
    if (ni != null) {
      const ng = new Map(K.hands[ni].map((a) => [a.name, a.att]));
      if (hand.some((a) => Math.abs((ng.get(a.name) || 0) - a.att) > 1e-9)) forkedStates++;
    }
    for (const a of hand) {
      cardsCompared++;
      const row = [...giBlk.entries()].find(([ti]) => APPG.nodes[ti].t === a.name);
      assert.ok(row, `${key}: ${a.name} is not in the gi block`);
      assert.ok(Math.abs(a.att - row[1].att / tot) < 1e-12, `${key}: ${a.name} carries its gi share`);
    }
  }
  assert.ok(cardsCompared > 1000, `gi card coverage starved: ${cardsCompared}`);
  assert.ok(forkedStates >= 200, `the gi and no-gi shares differ at only ${forkedStates} states`);
  // RATES: every card of a technique with a gi fork prices at the gi rate in gi, the scalar in no-gi
  const byTitle = new Map(APPG.nodes.filter((n) => n.cal && n.cal.outcomes).map((n) => [n.t, n]));
  let forked = 0;
  for (const [k, frame] of [[KG, "gi"], [K, "nogi"]]) {
    for (const hand of k.hands) for (const a of hand) {
      const n = byTitle.get(a.name);
      const want = frame === "gi" && GI_FORK.has(n.id) ? GI_FORK.get(n.id) : n.cal.successRate;
      assert.ok(Math.abs(a.p0 - Math.max(0, Math.min(1, want / 100))) < 1e-12,
        `${frame}: ${a.name} priced at ${a.p0}, the ${frame} rate is ${want}%`);
      if (frame === "gi" && GI_FORK.has(n.id)) forked++;
    }
  }
  assert.ok(forked >= 100, `only ${forked} gi cards carry a forked rate — the rate check is vacuous`);
  // THE OVERRIDE moves hands AND rates: a gi app asked for the no-gi route (what
  // scripts/semantics/wire_semantics.mjs does) prices every card at the no-gi rate, not its own
  const KO = ngFlowBuild(APPG, { frame: "nogi" });
  assert.equal(KO.handsFrame, "nogi");
  let overridden = 0;
  for (const hand of KO.hands) for (const a of hand) {
    const n = byTitle.get(a.name);
    assert.ok(Math.abs(a.p0 - Math.max(0, Math.min(1, n.cal.successRate / 100))) < 1e-12, `override: ${a.name}`);
    if (GI_FORK.has(n.id)) overridden++;
  }
  assert.ok(overridden >= 100, `the override check touched only ${overridden} forked cards`);
  // THE CARD'S EDGE (`e0`, the personal tilt's feature) is the no-gi table's in both rulesets —
  // the number the card prints — and 0 only where the card prints none
  let sameE0 = 0;
  for (let i = 0; i < KG.n; i++) {
    const ni = K.stateIdx.get(KG.states[i]);
    if (ni == null) continue;
    const ng = new Map(K.hands[ni].map((a) => [a.name, a.e0]));
    for (const a of KG.hands[i]) if (ng.has(a.name)) { assert.equal(a.e0, ng.get(a.name), `${KG.states[i]}: ${a.name} e0`); if (a.e0 !== 0) sameE0++; }
  }
  assert.ok(sameE0 >= 500, `only ${sameE0} gi cards carry a non-zero card EDGE`);
});

test("6b: the two rulesets rank differently where they must", () => {
  const gi = SOLVED.gi, ng = SOLVED.nogi;
  const inNogi = new Set(K.deckKeys);
  // the gi-only decks: dealt only in gi (lapel and sleeve guards, collar chokes). Before v1.209.0
  // none of them existed in a gi player's kernel, so none could ever be recommended.
  const giOnly = KG.deckKeys.filter((d) => !inNogi.has(d));
  const scored = giOnly.filter((d) => gi.run.grad[KG.deckIdx.get(d)] > 0);
  assert.ok(giOnly.length >= 100, `gi-only decks: ${giOnly.length}`);
  assert.equal(scored.length, giOnly.length, "every gi-only deck carries value in the gi game");
  const giTop40 = [...KG.deckKeys].sort((a, b) => gi.run.grad[KG.deckIdx.get(b)] - gi.run.grad[KG.deckIdx.get(a)]).slice(0, 40);
  const giOnlyTop = giTop40.filter((d) => !inNogi.has(d));
  assert.ok(giOnlyTop.includes("Cross Collar Choke from Mount|Attacker"),
    `the gi top-40 holds gi-only decks: ${giOnlyTop.join(", ") || "none"}`);
  // ...and the reverse: the heel-hook family is dealt in no-gi only, so a gi player is never sent to it
  const inGi = new Set(KG.deckKeys);
  const nogiOnly = K.deckKeys.filter((d) => !inGi.has(d));
  assert.ok(nogiOnly.includes("Heel Hook from 50-50 Guard|Attacker"), `no-gi-only: ${nogiOnly.slice(0, 4)}`);
  // the app surface: the lists a player reads differ, and each holds only its ruleset's material
  const wg = fullApp({ frame: "gi" }).weakSpots(), wn = fullApp({ frame: "nogi" }).weakSpots();
  assert.notDeepEqual(wg.keys, wn.keys, "a gi and a no-gi player get different weak spots");
  assert.ok(wg.keys.some((d) => !inNogi.has(d)), "the gi list reaches a gi-only deck");
  assert.ok(!wn.keys.some((d) => !inNogi.has(d)), "the no-gi list never names a deck the no-gi game cannot deal");
  assert.ok(!wg.keys.some((d) => !inGi.has(d)), "the gi list never names a deck the gi game cannot deal");
  assert.equal(wg.cov.frame, "gi"); assert.equal(wn.cov.frame, "nogi");
  // the rankings are different games, not one reshuffled: V0 differs, and the order over the
  // decks both rulesets deal is correlated but not the same
  assert.notEqual(gi.run.V0, ng.run.V0);
});

test("6c: a wire without gi hands ranks a gi player on no-gi hands — and SAYS so", () => {
  // §6.6: the fallback is a plausible list on the wrong ruleset's numbers, so it must be named.
  const stripped = JSON.parse(JSON.stringify(WIRE));
  let removed = 0;
  for (const n of stripped.nodes) if (n.cal && n.cal.evGi) { delete n.cal.evGi; removed++; }
  assert.ok(removed > 100, `the fixture removed ${removed} gi blocks`);
  const a = fullApp({ frame: "gi", wire: stripped });
  const w = a.weakSpots();
  assert.ok(!w.cold, "it still ranks");
  assert.equal(w.cov.frame, "gi"); assert.equal(w.cov.handsFrame, "nogi");
  const fb = a.beats.filter((b) => b && b.beat === "flow_frame_fallback");
  assert.equal(fb.length, 1, "and fires ONE named beat");
  assert.equal(fb[0].want, "gi"); assert.equal(fb[0].have, "nogi");
  // with the real wire the beat never fires
  const ok = fullApp({ frame: "gi" }); ok.weakSpots();
  assert.equal(ok.beats.filter((b) => b && b.beat === "flow_frame_fallback").length, 0);
});

test("6d: a ruleset flip re-ranks the same player — even one that never passes setGiMode", () => {
  // `setGiMode` drops the kernel, but `_giMode` is also written by test rigs and journeys directly
  // (the reason `_rulesetMask` stamps its frame). The memo key AND the kernel reuse both read it.
  const a = fullApp({ frame: "gi" });
  const gi = a.weakSpots();
  a._giMode = "nogi";
  const ng = a.weakSpots();
  assert.equal(gi.cov.frame, "gi"); assert.equal(ng.cov.frame, "nogi");
  assert.equal(a._flowKernel.frame, "nogi", "the kernel was rebuilt for the new ruleset");
  assert.notDeepEqual(ng.keys, gi.keys);
  assert.deepEqual(ng.keys, fullApp({ frame: "nogi" }).weakSpots().keys, "and equals a fresh no-gi player's");
});

// ── 7: THE RANKING STARTS WHERE THE PLAYER'S ROLLS START (owner, 2026-09-30, §10.8) ──────────
//
// FLOW integrated over a uniform start — the app's default "Anywhere" roll — for every player. A
// Standing player's rolls open on the feet, and from there the ranking is a different one
// (Spearman 0.68 in no-gi, 0.67 in gi, measured here at v1.209.0; docs/GraphSemantics.md §5.4).

test("7a: ngFlowStart — uniform, a fixed position's two seats, and a named miss", () => {
  const u = ngFlowStart(K, null);
  assert.equal(u.d0, null, "uniform is the null law, bit-for-bit the path FLOW always solved");
  assert.equal(u.mode, "uniform"); assert.equal(u.seats, K.n);
  const s = ngFlowStart(K, STANDING);
  assert.equal(s.mode, "fixed"); assert.equal(s.seats, 2);
  const top = K.stateIdx.get("standing-position/top"), bot = K.stateIdx.get("standing-position/bottom");
  assert.equal(s.d0[top], 0.5); assert.equal(s.d0[bot], 0.5);   // the seat is drawn 50/50
  assert.equal(s.d0.reduce((x, y) => x + y, 0), 1, "a probability law");
  assert.equal(s.d0.filter((x) => x > 0).length, 2, "and nowhere else");
  const miss = ngFlowStart(K, { posId: "no-such-position" });
  assert.equal(miss.miss, true); assert.equal(miss.d0, null); assert.equal(miss.mode, "uniform");
});

test("7b: changing the start setting re-ranks the same player, and only Standing moves it", () => {
  const store = {};
  const a = fullApp({ settings: store });
  const keys = () => a.weakSpots().keys;
  a.set("startFrom", "random");
  const anywhere = keys();
  assert.equal(a.weakSpots().cov.start, "uniform");
  // THE SAME INSTANCE — the memo must not hand back the Anywhere list
  a.set("startFrom", "standing");
  const standing = a.weakSpots();
  assert.equal(standing.cov.start, "fixed"); assert.equal(standing.cov.startSeats, 2);
  assert.notDeepEqual(standing.keys, anywhere, "a Standing player is ranked from the feet");
  // where it MUST move: every Standing roll passes through standing at its first ply, so the
  // standing position leads the list for them and is far down it from a uniform start
  const rank = (ks, fam) => ks.findIndex((k) => k.split("|")[0] === fam);
  // (the list stops at its last tier cut, so "not in the list at all" is -1)
  const rs = rank(standing.keys, "Standing Position"), ra = rank(anywhere, "Standing Position");
  assert.ok(rs >= 0 && rs < 5, `from standing it ranks ${rs}`);
  assert.ok(ra < 0 || ra > 20, `from anywhere it ranks ${ra}`);
  // My weak spots ranks from the Anywhere start ON PURPOSE (a feedback loop otherwise; see
  // `_flowStartSpec`) — and flipping back restores the Anywhere list exactly
  a.set("startFrom", "weak");
  assert.deepEqual(keys(), anywhere, "My weak spots is ranked from the Anywhere start");
  a.set("startFrom", "random");
  assert.deepEqual(keys(), anywhere, "and switching back is a pure function of the setting");
});

test("7c: from standing, nothing the no-gi kernel holds is unreachable — the walk deals by origin", () => {
  // Until v1.210.0 Spider Guard and Double Sleeve Guard sat IN the no-gi kernel at zero from standing: the
  // reachability walk admitted them through a teleporting Tripod Sweep listing (docs/GraphSemantics.md
  // §10.6) that no roll dealt. The walk now deals what `build_hand` deals, so the mask removes them
  // from no-gi entirely and the no-gi kernel holds exactly the states a roll from the feet can reach.
  // Two changes produce this together: the walk now deals by origin, AND the content nulled Tripod Sweep's
  // no-gi cells. So reverting the walk alone leaves this green (measured: an origin-blind walk reaches the
  // same no-gi states on today's content). The walk is pinned by `validate:availability`'s synthetic
  // origin-walk fixture instead; this pins the joint outcome. MUTANT: restoring Tripod Sweep's no-gi cell
  // at open-guard/bottom AND an origin-blind walk puts both guards back here, at zero from standing.
  const ns = SOLVED["nogi/standing"], nu = SOLVED.nogi, gs = SOLVED["gi/standing"];
  const g = (s, d) => s.run.grad[s.k.deckIdx.get(d)];
  for (const d of ["Spider Guard|Bottom", "Spider Guard|Top", "Double Sleeve Guard|Top", "Double Sleeve Guard|Bottom"]) {
    assert.ok(!ns.k.deckKeys.includes(d) && !nu.k.deckKeys.includes(d), `${d} is masked out of no-gi`);
  }
  const zeroS = ns.k.deckKeys.filter((d) => g(ns, d) === 0);
  assert.equal(zeroS.length, 0, `decks the no-gi kernel holds but a standing roll never reaches: ${zeroS.slice(0, 6).join(", ")}`);
  assert.ok(ns.k.deckKeys.length >= 1000, `no-gi coverage: ${ns.k.deckKeys.length} decks`);
  assert.ok(g(gs, "Spider Guard|Bottom") > 0, "in gi the feet do reach spider guard");
  assert.equal(gs.k.deckKeys.filter((d) => g(gs, d) === 0).length, 0, "and nothing is unreachable from standing in gi");
});

test("7d: a fixed start the kernel does not hold is ranked as Anywhere — and SAYS so", () => {
  const a = fullApp();
  const anywhere = a.weakSpots().keys;
  a._flowStartSpec = () => ({ posId: "no-such-position" });
  const w = a.weakSpots();
  assert.equal(w.cov.start, "uniform");
  assert.deepEqual(w.keys, anywhere);
  const fb = a.beats.filter((b) => b && b.beat === "flow_start_fallback");
  assert.equal(fb.length, 1, "ONE named beat");
  assert.equal(fb[0].want, "no-such-position");
});
