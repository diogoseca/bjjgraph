// OPENING A TECHNIQUE LANDS ON THE TECHNIQUE, on every seat (v1.212.3, OCSTAR1).
//
// Owner, v1.132.0: "when you click on a transition or on a submission, you navigate to it. The URL
// changes to it, and the landcard is standard." Since the pair split each technique has two seats
// (attacker and defender members). Opening either one stages a roll at the technique's origin, and
// the CHOSEN node keeps the focus, the URL and the card; nothing starts until the player acts.
// The one owner-ruled exception is a submission's own escaping seat, where the rush starts at once
// (v1.134.0: "clicking the escaping orb IS choosing to be caught").
//
// THE DEFECT THIS PINS: a transition authored from a CONTROL ALIAS (12 positions, e.g. Gogoplata
// Control, that canonicalise to their submission state) seats you inside that submission. On the
// seat that defends it, enterLand called enterDefense at staging, which unpaused, moved the focus to
// the submission and rewrote the URL. On dev a7bc58ce4 that was 147 transition seats over both
// rulesets (gi 74 + no-gi 73), and each one also lost its seat star (the star is drawn beside the
// FOCUSED label; e2e/journeys/seat-star-coverage.spec.ts pins that half in the browser). Now those
// seats get the ordinary staged landing, and the rush waits for play (`_stagedDefense`,
// `_runDeferredCatch`).
//
// THE SECOND CAUSE, found by the browser half: a COLD submission. The first technique opened per
// alias submission waits for that submission's choices, and the wait called clearOptions(), which
// consumes the staged exchange. The deferred landing then focused the submission (and rushed a
// defender seat), even on a seat the first fix had repaired. The browser sweep caught 12 seats, one
// per alias submission; "Counter Entry to Opponent's Leg" was simply the first opened from its
// origin. Test 4 opens every alias submission cold.
//
// Real wire, real app methods; only DOM/camera/sound side effects are stubbed. clearOptions is
// NOT stubbed: stubbing it hid the race completely (its mutant survived until it ran for real).
// MUTANTS (each turns this file red; measured at v1.212.3):
//   - enterLand without the staged-transition guard (enterDefense at once): tests 1-4;
//   - _runDeferredCatch as a no-op: test 2;
//   - clearEngagement without `_stagedDefense = null`: tests 1, 3, 4;
//   - waitForSubmissionChoices without restoring `_stagedTech` (the race): test 4.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { knowledgeSource } from "./_knowledge_profile_harness.mjs";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const Component = new Function("DCLogic", "React", knowledgeSource + "\n" + read("neural/src/app.src.jsx") + "\nreturn Component;")(class {}, { createRef: () => ({ current: null }) });
const wire = JSON.parse(read("source/quartz/static/neural/graph-data.json"));
globalThis.fetch = async (url) => ({ ok: true, json: async () => JSON.parse(read("source/quartz/static/neural/" + String(url).replace("/seat-test/", ""))) });

const SIDE_EFFECTS = ["fx", "setEvent", "flashFx", "bumpBounce", "flare", "clearTimers", "clearLandCard", "_declineLandQ",
  "renderLandCard", "buildDrillPanel", "renderChoiceGroups", "_syncHandLayer", "_highlightStagedCard", "setBeacon",
  "renderTutorial", "_sayArrivalIfPending", "startLandRipple", "hydrateDecks", "hideCenter", "showCenter", "releaseCamera",
  "_prefetchLandDeck", "_prefetchDefendDeck", "frameNodes", "killVignette", "setStatus", "_endArrival", "stopReplay",
  "cancelChoiceValues", "hideOptDetail", "_closeRoll", "_updateComboChip", "_cancelCheckpoint", "pauseTimers", "resumeTimers", "_saveFlowSoon",
  "_gameValueChanged", "decaySharp", "_flushLandSkipDebt", "showVignette", "buildPanicCard",
  "_paintWinThermometer", "_dockLandCard"];

async function app({ cold = false } = {}) {
  const a = Object.create(Component.prototype);
  a.settings = {}; a.beats = []; a.get = (_k, d) => d; a.set = a.track = a._saveProgress = () => {};
  a.ingest(structuredClone(wire));
  a._dataBase = () => "/seat-test/";
  if (!cold) await Promise.all(a.nodes.filter((n) => n.rep && n.ty === "submissions").map((n) => a.loadSubmissionChoices(n)));
  for (const k of SIDE_EFFECTS) a[k] = () => {};
  a.urls = []; a._syncUrl = (i) => a.urls.push(i);
  a.rollCamTarget = () => ({ cx: 0, cy: 0, vw: 1 }); a.pairMid = (n) => ({ x: n.x, y: n.y });
  a.after = () => {}; a.startTravel = (_p, done) => done(); a.rng = () => 0.5;
  a.optionsRef = { current: null }; a.evRef = { current: null }; a.drillListRef = { current: null };
  a.cam = { cx: 0, cy: 0, vw: 1 }; a.now = 0;
  return a;
}

/** Every seat of every technique this ruleset deals or shows: both members of each technique site. */
function seats(a) {
  const out = [];
  for (const n of a.nodes) {
    if (n.ty === "positions" || !n.rep || !a.rsAllows(n)) continue;
    out.push({ idx: n.idx, n, seat: "attacker" }, { idx: n.pi, n, seat: "defender" });
  }
  return out;
}

/** The seats the defect hit, derived from the DATA rather than from the code under test: a transition
 *  whose origin canonicalises to a submission state, on the seat that is that submission's defender. */
function catchSeats(a) {
  const want = new Set();
  for (const s of seats(a)) {
    if (s.n.ty !== "transitions") continue;
    const o = a.techniqueOrigin(a.nodes[s.idx]);
    if (o.idx < 0) continue;
    const pos = a.nodes[a.canonicalState(o.idx, o.role)];
    const sub = pos && pos.ty === "submissions" ? a.submissionNode(pos) : null;
    if (sub && o.role !== sub.fromRole) want.add(s.idx);
  }
  return want;
}

test("every seat of every technique, opened, keeps the focus and the URL on the chosen node; only a submission's escaping seat starts its rush", async () => {
  const a = await app();
  const counts = {};
  for (const frame of ["gi", "nogi"]) {
    a._giMode = frame;
    const want = catchSeats(a);
    const deferred = new Set();
    let n = 0, rushes = 0;
    for (const s of seats(a)) {
      a.urls.length = 0; a.paused = false;
      a.stageRollAt(s.idx);
      n++;
      const where = `${frame} ${s.n.t} [${s.seat}]`;
      assert.equal(a.focusIdx, s.idx, `${where}: the focus stays on the node you opened`);
      assert.equal(a.urls[a.urls.length - 1], s.idx, `${where}: the URL stays on the node you opened`);
      const escapingSub = s.n.ty === "submissions" && s.seat === "defender";
      if (escapingSub) { rushes++; assert.equal(a.paused, false, `${where}: a submission's escaping seat starts its rush (v1.134.0)`); }
      else {
        assert.equal(a.paused, true, `${where}: nothing starts until the player acts`);
        assert.equal(a._stagedTech && a._stagedTech.idx, s.idx, `${where}: the staged exchange is the chosen node`);
      }
      if (a._stagedDefense != null) {
        deferred.add(s.idx);
        assert.deepEqual(a.optionIdxs, [], `${where}: a deferred catch deals no hand; the rush deals the escapes`);
      }
    }
    // SET EQUALITY against the data-derived set (a second implementation is legitimate only with it),
    // plus a floor, so an empty deferral cannot pass by agreeing with an empty prediction.
    assert.deepEqual([...deferred].sort(), [...want].sort(), `${frame}: the deferred catches are exactly the alias-defender transition seats`);
    assert.ok(want.size >= 60, `${frame}: ${want.size} catch seats is a real population`);
    assert.ok(n > 2000, `${frame}: ${n} seats staged`);
    counts[frame] = { seats: n, deferred: deferred.size, rushes };
  }
  console.log("# seat staging " + JSON.stringify(counts));
});

test("pressing play on a deferred catch runs the rush", async () => {
  const a = await app();
  a._giMode = "nogi";
  const want = [...catchSeats(a)].slice(0, 12);
  assert.ok(want.length === 12);
  for (const idx of want) {
    a.paused = false; a.stageRollAt(idx);
    assert.notEqual(a._stagedDefense, null, `${a.nodes[idx].t}: deferred`);
    const sub = a._stagedDefense;
    a.paused = false;
    assert.equal(a._runDeferredCatch(), true, `${a.nodes[idx].t}: the first unpaused frame consumes it`);
    assert.equal(a._stagedDefense, null);
    assert.equal(a._defendSub, a.submissionNode(a.nodes[sub]).idx, `${a.nodes[idx].t}: the rush is the submission's`);
    assert.equal(a._runDeferredCatch(), false, "and runs once");
  }
});

test("a deferred catch never outlives its roll: restaging elsewhere lifts it", async () => {
  const a = await app();
  a._giMode = "gi";
  const [idx] = [...catchSeats(a)];
  a.paused = false; a.stageRollAt(idx);
  assert.notEqual(a._stagedDefense, null);
  const other = a.nodes.find((n) => n.ty === "transitions" && n.rep && a.rsAllows(n) && !catchSeats(a).has(n.idx));
  a.stageRollAt(other.idx);
  assert.equal(a._stagedDefense, null, "a new roll clears it (clearEngagement)");
  assert.equal(a._runDeferredCatch(), false, "so play cannot start a stale rush");
});

test("a COLD submission (choices not loaded yet) defers the landing without losing the chosen node", async () => {
  // The first technique opened per alias submission meets a cold cache: enterLand waits for the
  // submission's choices (waitForSubmissionChoices). That wait used to clear the staged exchange, so
  // the deferred landing focused the submission and rushed a staged defender seat. The browser
  // sweep caught 12 such seats, one per alias submission, and the warm-cache tests above cannot
  // see it. MUTANT: waitForSubmissionChoices without restoring `_stagedTech` turns this red.
  const a = await app({ cold: true });
  a._giMode = "gi";
  const want = catchSeats(a);
  const bySub = new Map();   // the first catch seat and the first non-catch transition seat per alias submission
  for (const s of seats(a)) {
    if (s.n.ty !== "transitions") continue;
    const o = a.techniqueOrigin(a.nodes[s.idx]); if (o.idx < 0) continue;
    const pos = a.nodes[a.canonicalState(o.idx, o.role)];
    if (!pos || pos.ty !== "submissions") continue;
    const key = a.submissionNode(pos).idx + (want.has(s.idx) ? "/catch" : "/plain");
    if (!bySub.has(key)) bySub.set(key, s);
  }
  assert.ok(bySub.size >= 20, `${bySub.size} cold first-openings`);
  for (const s of bySub.values()) {
    a.urls.length = 0; a.paused = false;
    a.stageRollAt(s.idx);
    for (let i = 0; i < 20 && a._waitingSubmission; i++) await new Promise((r) => setTimeout(r, 0));
    assert.equal(a._waitingSubmission, null, `${s.n.t}: the choices loaded`);
    const where = `cold ${s.n.t} [${s.seat}]`;
    assert.equal(a.focusIdx, s.idx, `${where}: the focus stays on the node you opened`);
    assert.equal(a.urls[a.urls.length - 1], s.idx, `${where}: the URL stays on the node you opened`);
    assert.equal(a.paused, true, `${where}: nothing starts until the player acts`);
    assert.equal(a._stagedDefense != null, want.has(s.idx), `${where}: a catch seat defers its rush, a plain one has none`);
  }
});
