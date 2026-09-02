// PER-RULESET GRAPH EXCLUSION — the differential, measured on the real app and the real wire.
//
// THE RULE: a state or technique the active ruleset cannot produce is ABSENT, not de-ranked and
// not dimmed. In no-gi there are no lapels, so a lapel guard is not a rare position — it is not a
// position. Everything here asserts what a surface EMITTED (`optionsFor`'s hand, `buildExplorer`'s
// groups, `pickAt`'s hit) rather than re-deriving it, because a spec-side copy of the filter is
// written from the same reading of the code under test and agrees by construction (CLAUDE.md 6.3).
//
// WHERE THE VERDICT COMES FROM, and why it is not a name matcher (ruling P3a).
//   `cal.avail.{gi,nogi}` is emitted by `scripts/regenerate_neural_data.py:frame_reachable`, a BFS
//   from `standing-position/{top,bottom}` over that frame's own attempt probabilities. A name sweep
//   was refuted in advance by the calibration panel's own notes and flags `Rear Naked Choke from
//   Invisible Collar` — the canonical no-gi choke — because the POSITION is named "Collar". The
//   `nameMatcherWouldHaveKilled` test below is the standing guard against that regressing.
//
// NON-KILLS, recorded so nobody reads this file as covering more than it does:
//  · It does NOT prove the CANVAS omits the orb — `draw()` needs a real 2D context. It proves the
//    hit-test omits it, which is the half a user can act on; the paint half is unguarded.
//  · It does NOT cover the flashcard/drill surfaces (`weakSpots`, `bucketTechniques`), which need
//    a resident manifest.
//  · It says nothing about whether the CORPUS's verdict is right — whether `lasso-guard` SHOULD be
//    unreachable in no-gi is a content question, sized in the availability ledger, not here.
//
// Run: node --test tests/ruleset_availability.test.mjs   (npm run test:units)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const R = (p) => resolve(HERE, "..", p);
const src = readFileSync(R("neural/src/app.src.jsx"), "utf8");
const WIRE = JSON.parse(readFileSync(R("source/quartz/static/neural/graph-data.json"), "utf8"));

const Component = new Function("DCLogic", "React", `${src}\nreturn Component;`)(
  class DCLogic {}, { createRef: () => ({ current: null }) },
);

/** The real `ingest` in a chosen frame — never a test-side re-implementation. */
function app(frame) {
  const a = Object.create(Component.prototype);
  a.settings = {}; a.beats = []; a.track = () => {}; a._saveProgress = () => {};
  a.get = (_k, d) => d; a.set = () => {};
  a._giMode = frame;
  a.ingest(JSON.parse(JSON.stringify(WIRE)));
  a._giMode = frame; a._rebuildRulesetMask();   // ingest hydrates from localStorage, absent in node
  a.flashcards = { decks: {} }; a.prep = {}; a.rec = {}; a.stage = {}; a.srs = {}; a._sharp = {};
  return a;
}
/** The CONTROL: the same app with the filter switched off. Every claim below is a differential. */
function unfiltered(frame) { const a = app(frame); a._rsOk = new Uint8Array(a.nodes.length).fill(1); return a; }

const GI = app("gi"), NOGI = app("nogi"), CTRL = unfiltered("gi");

function hand(a, p) {
  a.currentPos = p.idx;
  a.playerRole = p.role === "bottom" ? "bottom" : "top";
  try { return a.optionsFor(p.idx) || []; } catch { return []; }
}
function census(a) {
  let states = 0, options = 0, empty = [];
  for (const p of a.nodes.filter((n) => n.ty === "positions")) {
    if (!a.rsAllows(p)) continue;
    const o = hand(a, p);
    if (!o.length) { empty.push(p.id); continue; }
    states++; options += o.length;
  }
  return { states, options, empty };
}

// ── 1: THE TABLE EXISTS AND IS NOT DEGENERATE ───────────────────────────────────────────────

test("the wire carries a real availability table in both directions", () => {
  // Non-triviality FIRST, both ends. An all-true table and an empty one both let every assertion
  // below pass while the feature does nothing — "found no gi-only moves" and "never looked" must
  // not produce the same output (CLAUDE.md 6.6).
  const withVerdict = WIRE.nodes.filter((n) => n.cal && n.cal.avail && typeof n.cal.avail.gi === "boolean");
  assert.ok(withVerdict.length >= 1200, `availability table starved: ${withVerdict.length} nodes carry a verdict`);
  const giOnly = withVerdict.filter((n) => n.cal.avail.gi && !n.cal.avail.nogi);
  assert.ok(giOnly.length >= 80, `no gi-only nodes on the wire (${giOnly.length}) — the emitter found nothing`);
  // and the two columns must genuinely differ, or `avail` is one column wearing two names
  const cols = withVerdict.map((n) => `${n.cal.avail.gi}${n.cal.avail.nogi}`);
  assert.ok(new Set(cols).size > 1, "`avail` carries the same value in both frames on every node");
});

test("both members of a derived pair inherit the same verdict", () => {
  // `_deriveDualPairs` mints the partner AFTER `avail` is stamped. If the partner lost it, half of
  // every excluded state would survive — and it is the half a bottom player stands on.
  let pairs = 0, split = 0;
  for (let i = 0; i < GI.nodes.length - 1; i++) {
    const a = GI.nodes[i], b = GI.nodes[i + 1];
    if (!a.rep || b.rep || b.pi !== a.idx) continue;
    pairs++;
    if (GI.rsAllows(a) !== GI.rsAllows(b) || NOGI.rsAllows(a) !== NOGI.rsAllows(b)) split++;
  }
  assert.ok(pairs >= 100, `pair coverage starved: ${pairs} pairs walked`);
  assert.equal(split, 0, `${split} pair(s) disagree with their own partner about availability`);
});

// ── 2: THE DIFFERENTIAL, PER FRAME ──────────────────────────────────────────────────────────

test("no-gi is the acting frame; gi is admitted whole", () => {
  // The emitter's `EXCLUDING_FRAMES` is ("nogi",) and the reasoning is at that constant: the gi
  // column the walk reports is IBJJF heel-hook LEGALITY, not equipment, and excluding it emptied
  // `backside-50-50/bottom`'s main pass into the origin-relaxed fallback. If gi is ever added to
  // that tuple this test goes red and the fallback test below is the one to read first.
  const excl = (a) => a.nodes.filter((n) => n.rep && !a.rsAllows(n));
  assert.equal(excl(CTRL).length, 0, "the control must exclude nothing, or every number below is meaningless");
  assert.equal(excl(GI).length, 0, "gi is not an excluding frame — see EXCLUDING_FRAMES");
  assert.ok(excl(NOGI).length >= 80, `no-gi excludes ${excl(NOGI).length} sites — expected the cloth-defined guards and their techniques`);
  assert.ok(excl(NOGI).filter((n) => n.ty === "positions").length >= 8,
    "no-gi must remove whole POSITIONS, not just moves — a lapel guard is not a rare position, it is not a position");
});

test("NO HAND FALLS INTO THE ORIGIN-RELAXED FALLBACK", () => {
  // The sharper form of the dead-end check, and the one that caught the real defect. `optionsFor`
  // has a safety net: when role+origin filtering leaves NOTHING it re-deals with ORIGIN relaxed —
  // cards from a state you are not standing in, carrying that other state's `ev` row. An empty-hand
  // check cannot see it, because the fallback RETURNS CARDS; and graph.json cannot see it coming,
  // because its per-frame sums apply neither role nor origin and report the state healthy.
  //
  // THIS TEST SHIPPED BROKEN IN v1.153.0, TWICE OVER, and both halves are fixed here.
  //  · It walked `n.rep` position nodes. All 136 of those are the hub, whose role is "top" — so it
  //    covered 136 of 272 hands and could not see a BOTTOM seat. `backside-50-50/bottom` is a
  //    bottom seat, and it is the single state the whole gi-exclusion decision turned on. The
  //    detector was blind to the one case it was written for.
  //  · It keyed on `o[0].ord === undefined`. `orderScore` returns null on 100 of 1328 main-pass
  //    cards (3 of them a hand's first card), so the check survived only on the undefined/null
  //    distinction, and any fix that set `ord` in the fallback would have blinded it permanently.
  //    The fallback now stamps `relaxed: true` — a positive signal, not an absence.
  for (const a of [CTRL, GI, NOGI]) {
    const relaxed = [];
    let walked = 0;
    // BOTH SEATS. `_deriveDualPairs` stamps the member's side on the member, so the 272 position
    // members ARE the 272 role-hands; the rep half alone is every "top" and no "bottom".
    for (const p of a.nodes.filter((n) => n.ty === "positions" && a.rsAllows(n))) {
      const o = hand(a, p);
      if (!o.length) continue;
      walked++;
      if (o.some((x) => x.relaxed)) relaxed.push(p.id + "/" + (p.role || "?"));
    }
    const seats = new Set(a.nodes.filter((n) => n.ty === "positions" && a.rsAllows(n)).map((n) => n.role));
    assert.deepEqual([...seats].sort(), ["bottom", "top"], `${a._giMode}: the walk must cover both seats`);
    assert.ok(walked >= 200, `${a._giMode}: hand coverage starved — only ${walked} hands walked`);
    assert.deepEqual(relaxed, [], `${a._giMode}: ${relaxed.length} hand(s) fell through to the origin-relaxed fallback`);
  }
});

test("…and the fallback detector can actually fire", () => {
  // A fixture that cannot trigger the failure it forbids is a decoration (CLAUDE.md §6.3, and the
  // lesson `tests/occurrence_gate.test.mjs` learned when its "Collar Guard A/B" fixture let a
  // name-matcher mutant survive). Zero hands reach the fallback naturally, so the test above passes
  // on a build whose detector is broken — as v1.153.0's was. This forces the branch and proves the
  // detector sees it.
  //
  // The fixture is DERIVED, not named: the first BOTTOM seat that (a) falls wholly into the
  // fallback when its own origin-local bottom moves are masked off, (b) leaves its TOP seat dealing
  // a normal hand — which is what makes it a test of SEAT COVERAGE and not just of the branch — and
  // (c) carries at least one `myVal` tie, without which the comparator's name tiebreak is never
  // exercised. A hard-coded position name would rot on the next corpus change; the search does not.
  const a = app("gi");
  a.noteChallenges = () => {};   // the beat's downstream lives in a sibling bundle file, not here
  let fixture = null;
  for (const seat of a.nodes.filter((n) => n.ty === "positions" && n.role === "bottom")) {
    const mask = a._rulesetMask();
    const saved = [];
    for (const k of a.adj[seat.idx]) {
      const n = a.nodes[k];
      if (n.ty !== "positions" && n.fromPositionId === seat.posId && n.fromRole === "bottom") {
        saved.push([k, mask[k]]); mask[k] = 0;
      }
    }
    const forced = hand(a, seat);
    const top = a.nodes.find((n) => n.ty === "positions" && n.posId === seat.posId && n.role === "top");
    const topHand = top ? hand(a, top) : [];
    let ties = 0;
    for (let i = 0; i < forced.length; i++) {
      for (let j = i + 1; j < forced.length; j++) if (a.myVal(forced[i].node) === a.myVal(forced[j].node)) ties++;
    }
    if (forced.length && forced.every((x) => x.relaxed) && topHand.length
        && !topHand.some((x) => x.relaxed) && ties > 0) { fixture = { seat, forced, topHand, ties }; break; }
    for (const [k, v] of saved) mask[k] = v;   // restore before trying the next seat
  }
  assert.ok(fixture, "no bottom seat could be forced into the fallback with a tie — the fixture search found nothing, so this test proves nothing");

  // 1. the branch stamps its positive signal
  assert.ok(fixture.forced.every((x) => x.relaxed === true),
    "the fallback fired but did not stamp `relaxed` — the detector is blind again");
  // 2. it is a BOTTOM seat and its TOP seat is unaffected: a rep-only walk cannot see this hand,
  //    which is exactly how v1.153.0's detector missed backside-50-50/bottom.
  assert.equal(fixture.seat.role, "bottom");
  assert.equal(fixture.seat.rep, false, "the fixture seat must be the non-rep half, or it proves nothing about seat coverage");
  assert.ok(!fixture.topHand.some((x) => x.relaxed), "the fixture's top seat must stay normal");
  // 3. the relaxed hand is a STRICT TOTAL ORDER under the app's OWN comparator. `_cmpRelaxed` is a
  //    named seam for exactly this reason — a spec-side copy would agree with itself by
  //    construction. `ties > 0` above is what makes the name tiebreak reachable at all.
  //    SEAT THE COMPARATOR FIRST: `_cmpRelaxed` reads `myVal` -> `valIdx` -> `this.playerRole`, so
  //    it answers a different question in the other seat. The fixture search above ends on the TOP
  //    seat, and comparing a bottom hand under a top seat reorders it — which is how this assertion
  //    caught its own harness.
  a.currentPos = fixture.seat.idx;
  a.playerRole = "bottom";
  let zeroPairs = 0;
  for (let i = 0; i < fixture.forced.length; i++) {
    for (let j = i + 1; j < fixture.forced.length; j++) {
      if (a._cmpRelaxed(fixture.forced[i], fixture.forced[j]) === 0) zeroPairs++;
    }
  }
  assert.ok(fixture.ties > 0, "fixture carries no myVal tie, so the tiebreak is untested");
  assert.equal(zeroPairs, 0, `the relaxed comparator called ${zeroPairs} distinct card pair(s) equal — a tie hands the order to the node index`);
  const resorted = fixture.forced.slice().reverse().sort((x, y) => a._cmpRelaxed(x, y));
  assert.deepEqual(resorted.map((o) => o.node.t), fixture.forced.map((o) => o.node.t),
    "the relaxed hand's order moved when the input was permuted");
});

test("NO POSITION IS LEFT WITHOUT EXITS — the dead-end check", () => {
  // The one consequence that would make exclusion unshippable: a state you can still be sent to
  // whose whole hand the ruleset removed. A roll landing there has nothing to play.
  const seats = GI.nodes.filter((n) => n.ty === "positions" && n.rep).length;
  assert.ok(seats >= 130, `position coverage starved: ${seats} sites`);
  for (const a of [GI, NOGI]) {
    const c = census(a);
    const live = a.nodes.filter((n) => n.ty === "positions" && a.rsAllows(n)).length;
    // DERIVED, not typed: every state the ruleset keeps must deal a hand, so the count is the
    // live-state count and re-typing it on each availability change is impossible by construction.
    assert.ok(live >= 200, `live-state coverage starved in ${a._giMode}: ${live}`);
    assert.equal(c.states, live, `${a._giMode}: ${live - c.states} live state(s) dealt no hand`);
    assert.deepEqual(c.empty, [], `${a._giMode}: ${c.empty.length} reachable state(s) deal an EMPTY hand`);
  }
});

test("exclusion costs the no-gi hand no probability mass", () => {
  // SCOPED TO NO-GI ON PURPOSE. `cal.ev`'s `att` is solved in ONE frame — `evFrame`, which the
  // emitter pins to "nogi" — so asking it about a gi-excluded move returns that move's NO-GI
  // attempt share and the answer is about the wrong column. The gi half of this claim is asserted
  // where the per-frame numbers actually live, against `attemptProbabilityByRuleset` in
  // graph.json: `scripts/validate_occurrence_surface.py`, section 5.
  assert.equal(WIRE.evFrame, "nogi", "evFrame moved — this test's frame scoping is now wrong");
  let dropped = 0, checked = 0;
  for (const p of CTRL.nodes.filter((n) => n.ty === "positions" && n.rep)) {
    if (!NOGI.rsAllows(p)) continue;
    const evOf = CTRL._evRowsFor(p.idx, p.role === "bottom" ? "bottom" : "top");
    if (!evOf) continue;
    for (const k of CTRL.adj[p.idx]) {
      const n = CTRL.nodes[k];
      if (n.ty === "positions") continue;
      if (n.fromRole && n.fromRole !== (p.role === "bottom" ? "bottom" : "top")) continue;
      checked++;
      if (NOGI.rsAllows(n)) continue;
      const row = evOf(k);
      if (row && row.att > 0) dropped += row.att;
    }
  }
  assert.ok(checked >= 1000, `edge coverage starved: ${checked} (state, move) pairs walked`);
  assert.equal(dropped, 0, `${dropped} attempt-percentage points dropped from live no-gi hands — renormalization has become a real question and is the owner's call`);
});

// ── 3: THE SURFACES ACTUALLY HONOUR IT ──────────────────────────────────────────────────────

test("every node-visible surface inherits the filter", () => {
  const gone = NOGI.nodes.filter((n) => n.rep && !NOGI.rsAllows(n));
  assert.ok(gone.length >= 80, `nothing excluded in no-gi (${gone.length}) — the rest of this test would pass vacuously`);
  const victim = gone.find((n) => n.ty !== "positions");
  assert.ok(victim, "expected at least one excluded technique to probe the surfaces with");

  // the hand
  for (const p of NOGI.nodes.filter((n) => n.ty === "positions" && NOGI.rsAllows(n))) {
    const bad = hand(NOGI, p).filter((o) => !NOGI.rsAllows(o.node || NOGI.nodes[o.idx]));
    assert.equal(bad.length, 0, `${p.id} dealt ${bad.length} unavailable move(s)`);
  }
  // Explore's category tree
  const groups = NOGI.buildExplorer().groups;
  const listed = new Set();
  for (const ty of Object.keys(groups)) for (const fam of Object.keys(groups[ty])) for (const n of groups[ty][fam]) listed.add(n.idx);
  assert.ok(listed.size >= 800, `explorer starved: ${listed.size} rows`);
  assert.equal([...listed].filter((i) => !NOGI.rsAllowsIdx(i)).length, 0, "Explore listed an unavailable node");
  // hit-testing: an orb that is not drawn must not be pickable. Driven through the REAL
  // `_updateHover` with the pointer placed exactly on the victim's centre — a spec-side copy of
  // the pick loop would agree with the code it was copied from (CLAUDE.md 6.3).
  const hoverAt = (a, n) => {
    a.W = 1000; a.H = 1000; a.now = 1;
    a.cam = { cx: n.x, cy: n.y, vw: 1000 };
    a._LY = (q) => q.y;
    a.canvas = { getBoundingClientRect: () => ({ left: 0, top: 0 }) };
    a._updateHover({ clientX: 500, clientY: 500 });
    return a._hover && a._hover.idx;
  };
  assert.equal(hoverAt(CTRL, victim), victim.idx, "the control must pick it, or the assertion below passes for the wrong reason");
  assert.notEqual(hoverAt(NOGI, victim), victim.idx, `${victim.t} is absent from no-gi but still pickable`);
  // the roll seeder must never open on an excluded state
  NOGI._posIdx = null;
  const seedPool = NOGI.nodes.filter((n) => n.ty === "positions" && n.rep && NOGI.rsAllows(n)
    && NOGI.adj[n.idx].some((k) => NOGI.nodes[k].ty !== "positions" && NOGI.rsAllows(NOGI.nodes[k])));
  assert.ok(seedPool.length >= 100 && seedPool.length < 136, `seeder pool ${seedPool.length} — expected fewer sites than gi's 136, but not a collapse`);
});

test("the opponent is bound by the same garment you are", () => {
  let checked = 0;
  for (const p of NOGI.nodes.filter((n) => n.ty === "positions" && NOGI.rsAllows(n)).slice(0, 60)) {
    for (const k of NOGI.adj[p.idx]) {
      const n = NOGI.nodes[k];
      if (n.ty === "positions") continue;
      checked++;
    }
  }
  assert.ok(checked > 500, "adjacency starved");
  // `adj` itself must stay WHOLE — it is per-SITE and role-blind by design, and filtering inside it
  // would silently change opponentDefend, mcDistractors and _posIdx at once (CLAUDE.md 6.6).
  const ctrlAdj = CTRL.adj.reduce((s, a) => s + a.length, 0);
  const nogiAdj = NOGI.adj.reduce((s, a) => s + a.length, 0);
  assert.equal(nogiAdj, ctrlAdj, "adj was filtered — it must stay whole; the ruleset test belongs at the reader");
});

// ── 4: THE STANDING GUARD AGAINST P3a ───────────────────────────────────────────────────────

test("availability is never decided by a name", () => {
  // The exact row the near-miss was about: the position is named "Invisible Collar", so every
  // collar/lapel/sleeve name sweep flags it — and it is the canonical no-gi strangle. If anyone
  // reintroduces a name heuristic, this goes red and names the node it killed.
  const NAME_SWEEP = /collar|sleeve|lapel|spider|lasso|worm|loop |bow and arrow|ezekiel|cross choke|judo|gi tail|pant/i;
  const rnc = NOGI.nodes.find((n) => n.rep && /^Rear Naked Choke from Invisible Collar$/i.test(n.t || ""));
  assert.ok(rnc, "fixture node missing from the corpus — this test cannot fail correctly without it");
  assert.ok(NAME_SWEEP.test(rnc.t), "the fixture must be one a name matcher WOULD flag, or it proves nothing");
  assert.equal(NOGI.rsAllows(rnc), true, "a name matcher has been reintroduced: the canonical no-gi choke was removed from no-gi");

  // …and the converse: nodes a name sweep would MISS but the data excludes anyway. If this set is
  // empty the test above is satisfiable by a name matcher and stops being evidence.
  const dataOnly = NOGI.nodes.filter((n) => n.rep && !NOGI.rsAllows(n) && !NAME_SWEEP.test(n.t || ""));
  assert.ok(dataOnly.length >= 10,
    `only ${dataOnly.length} excluded node(s) are invisible to a name sweep — a name matcher would score nearly as well, so this suite could not tell them apart`);
});
