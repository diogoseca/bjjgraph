// Run the real app methods without a browser. Pointer reachability, layout and the window
// key ladder are covered separately by roll-execution.spec.ts; these units do not prove them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../neural/src/app.src.jsx", import.meta.url), "utf8");
const Component = new Function("DCLogic", "React", `${source}\nreturn Component;`)(
  class {}, { createRef: () => ({ current: null }) },
);
globalThis.window = { __NEURAL_TEST__: true };

function app() {
  const a = new Component({});
  a.props = {};
  a.now = 0;
  a._tick = (t) => { a.now = t; }; // pump real timers; this test has no canvas
  a.events = [];
  a.fx = (beat, data) => a.events.push({ beat, ...data });
  a.track = () => {};
  a.evRef.current = { style: {} };
  a.evKickerRef.current = { style: {}, textContent: "" };
  a.evTextRef.current = { innerHTML: "" };
  return a;
}

test("digits and layout-specific shifted keys map to the same option, without browser modifiers", () => {
  const a = app();
  for (let i = 1; i <= 9; i++) {
    assert.equal(a.optionKeyIndex({ key: String(i) }), i - 1);
    assert.equal(a.optionKeyIndex({ key: "!@#$%^&*("[i - 1], code: `Digit${i}`, shiftKey: true }), i - 1);
    assert.equal(a.optionKeyIndex({ key: String(i), code: `Digit${i}`, shiftKey: true }), i - 1);
    for (const modifier of ["altKey", "ctrlKey", "metaKey"]) {
      assert.equal(a.optionKeyIndex({ key: String(i), [modifier]: true }), -1);
    }
  }
  for (const key of ["0", "a", "Enter", ""]) assert.equal(a.optionKeyIndex({ key }), -1);
});

test("own activation commits once per guarded hand; Inspect, threats and escapes only inspect", () => {
  const a = app(), opened = [], committed = [];
  a.expandOption = (...args) => opened.push(args);
  const own = { idx: 1 }, card = {};
  const pick = (opt) => { committed.push(opt); a.startExecution(opt); };
  a.activateOption(own, pick, card, true);
  assert.equal(opened.length, 1);
  assert.equal(committed.length, 0);
  a.activateOption({ threat: true }, pick, card);
  a.activateOption({ action: "escape" }, pick, card);
  assert.equal(opened.length, 3);
  a._rollHand = { mounted: false };
  a.activateOption(own, pick, card);
  assert.equal(committed.length, 0, "an unmounted forecast hand cannot commit");
  a._rollHand.mounted = true;
  a._checkpoint = {};
  a.activateOption(own, pick, card);
  assert.equal(committed.length, 0, "a checkpoint owns input");
  a._checkpoint = null;
  a.activateOption(own, pick, card);
  a.activateOption(own, pick, card);
  assert.deepEqual(committed, [own], "a second activation cannot consume another move");
});

test("Inspect cannot execute when its detail surface is unavailable", () => {
  const a = app();
  a.activateOption({ idx: 1, node: {} }, () => assert.fail("Inspect must never commit"), null, true);
});

test("an open modal contains digit, Inspect, Enter and Space before the real app key ladder", () => {
  const a = app();
  const handlers = source.match(/this\._onKey = \(e\) => \{[\s\S]*?\n    \};/g);
  assert.equal(handlers?.length, 1, "exercise the actual registered window handler");
  new Function(handlers[0]).call(a);
  a.modalRef.current = { style: { display: "flex" } };
  a._readKey = () => assert.fail("modal keys must not reach the underlying app");
  for (const key of ["1", "!", "Enter", " "]) a._onKey({ key, code: "Digit1", shiftKey: key === "!" });
});

function sweepApp(roll, outcome) {
  const a = app();
  const act = { idx: 1, t: "Fixture transition", ty: "transitions", cal: {
    successRate: 60,
    outcomes: [
      { to: "success-a", result: "success", probability: 30 },
      { to: "success-b", result: "success", probability: 30 },
      { to: "stay", result: "failure", probability: 10 },
      { to: "reversal", result: "counter", probability: 30 },
    ],
  } };
  a.nodes = [{ idx: 0 }, act]; a.currentPos = 0; a.aiSkill = .1;
  a.stateBonus = () => 0; a.oppVal = () => 0; a.deckKeyFor = () => ({ key: "fixture" });
  a._noteFlow = () => {};
  a.flare = () => {};
  a.verdicts = [];
  a.enterSuccessCal = (_opt, row) => a.verdicts.push({ success: true, row });
  a.enterFailCal = (_opt, row) => a.verdicts.push({ success: false, row });
  a.rig("resolve", [roll]); a.rig("outcome", [outcome]);
  const rng = a.rng.bind(a); a.draws = [];
  a.rng = (tag) => { a.draws.push(tag); return rng(tag); };
  return { a, opt: { idx: 1, node: act } };
}

test("the 1.08s sweep keeps the existing gate, conditional outcome and draw sequence", () => {
  for (const [roll, outcome, success, dest] of [
    [.1, .2, true, "success-a"], [.49, .8, true, "success-b"],
    [.5, .1, false, "stay"], [.99, .8, false, "reversal"],
  ]) {
    const { a, opt } = sweepApp(roll, outcome);
    assert.equal(a.moveChance(opt.node), .5);
    a.tensionSweep(opt);
    assert.deepEqual(a.draws, ["resolve"]);
    assert.equal(a._sweep.timer.remaining, 1080);
    a.advance(1079);
    assert.equal(a.verdicts.length, 0);
    a.advance(2);
    assert.deepEqual(a.draws, ["resolve", "outcome"]);
    assert.equal(a.verdicts.length, 1);
    assert.equal(a.verdicts[0].success, success);
    assert.equal(a.verdicts[0].row.to, dest);
    assert.equal(a._sweep, null);
  }
});

test("pausing holds needle progress and verdict together even as this.now advances", () => {
  const { a, opt } = sweepApp(.1, .8);
  a.tensionSweep(opt);
  a.advance(430);
  const elapsed = a.sweepElapsed(a._sweep), time = a.now;
  a.setPaused(true);
  a.advance(20000);
  assert.ok(a.now > time + 19);
  assert.equal(a.sweepElapsed(a._sweep), elapsed);
  assert.equal(a.verdicts.length, 0);
  a.setPaused(false);
  a.advance(649);
  assert.equal(a.verdicts.length, 0);
  a.advance(2);
  assert.equal(a.verdicts.length, 1);
});

test("a cancelled sweep cannot resolve into the next engagement", () => {
  const { a, opt } = sweepApp(.1, .8);
  a.startExecution(opt);
  a.tensionSweep(opt);
  const old = a._sweep.timer;
  a.clearExecution();
  a.startExecution(opt);
  old._fire(); // simulate a callback already queued when teardown ran
  assert.deepEqual(a.draws, ["resolve"]);
  assert.equal(a.verdicts.length, 0);
});

test("deterministic submission entry still travels and lands without a resolve or outcome draw", () => {
  const a = app();
  const sub = { idx: 1, t: "Fixture submission", ty: "submissions", fromRole: "bottom" };
  a.nodes = [{ idx: 0 }, sub]; a.currentPos = 0; a.moveCount = 2;
  a._endArrival = a._flushLandSkipDebt = a._disarmLandClock = a._prefetchLandDeck = () => {};
  a.submissionNode = () => sub;
  const draws = []; a.rng = (tag) => { draws.push(tag); return .5; };
  let landed = 0; a.enterLand = () => landed++;
  a.enterAttempt({ idx: 1, res: 1, node: sub, action: "enter" });
  assert.equal(a.evKickerRef.current.textContent, "You go for");
  assert.deepEqual(a.pulse.path, [0, 1]);
  assert.equal(a._sweep, undefined);
  a.pulse.onArrive();
  assert.equal(landed, 1); assert.equal(a.currentPos, 1);
  assert.equal(a.playerRole, "bottom"); assert.equal(a.moveCount, 3);
  assert.deepEqual(draws, []);
});

test("attempt ownership protects its sentence, yields to replay, and releases on teardown", () => {
  const a = app(), attrs = {}, label = { style: {} };
  let removed = false;
  const card = { setAttribute: (k, v) => { attrs[k] = v; }, querySelector: () => label, remove: () => { removed = true; } };
  a.startExecution({ idx: 1 }, card);
  a.executionEvent("You go for", "Fixture", "info", "executing");
  a.setEvent("Unrelated", "late callback", "info");
  assert.equal(a.evKickerRef.current.textContent, "You go for");
  a._replay = {}; a.setEvent("Replay", "archived move", "info");
  assert.equal(a.evKickerRef.current.textContent, "Replay");
  a._replay = null;
  a.executionEvent("Countered", "Fixture reversed", "bad", "countered");
  assert.equal(attrs["data-execution-status"], "countered");
  assert.equal(label.textContent, "Countered");
  assert.equal(a._execution.result, true);
  a.clearExecution();
  assert.equal(removed, true); assert.equal(a._execution, null);
  a.setEvent("Opponent goes for", "Next move", "bad");
  assert.equal(a.evKickerRef.current.textContent, "Opponent goes for");
});

test("the execution camera follows the technique, then the actual destination, and yields to a gesture", () => {
  const a = app();
  a.nodes = [{ idx: 0 }, { idx: 1 }, { idx: 2 }]; a.currentPos = 0;
  a.pairMid = (n) => ({ x: n.idx, y: 10 });
  a.rollCamTarget = (point, moving, idx) => ({ point, moving, idx });
  a.startExecution({ idx: 1 });
  a.pulse = { path: [0, 1], done: false };
  assert.equal(a.executionCameraTarget().idx, 1);
  a._execution.result = true;
  a.pulse = { path: [1, 2], done: false };
  assert.equal(a.executionCameraTarget().idx, 2);
  a.pulse.done = true; a.currentPos = 2;
  assert.equal(a.executionCameraTarget().idx, 2);
  a.releaseCamera(); assert.equal(a._execution.camera, false);
});

test("reduced motion snaps the execution framing without changing the simulation", () => {
  const a = app();
  a.startExecution({ idx: 1 });
  a.introDone = true; a.startTime = 0; a.now = 2; a.W = 900;
  a.cam = { cx: 0, cy: 0, vw: 1000, lvw: Math.log(1000) };
  a.camTarget = { cx: 0, cy: 0, vw: 1000 };
  a._paneCameraTarget = (t) => t;
  a.userActiveNow = a.camHeld = () => false;
  a._reducedMotion = () => true;
  a.executionCameraTarget = () => ({ cx: 12, cy: 30, vw: 300 });
  a.updateCamera(.016);
  assert.deepEqual(a.cam, { cx: 12, cy: 30, vw: 300, lvw: Math.log(300) });
  assert.equal(a._execution.result, false);
  assert.equal(a._timers, undefined);
});

test("the actual canvas sweep uses the lifted orb and freezes its needle during pause", () => {
  const a = app(), strokes = [];
  a.settings = {}; a.get = (_key, fallback) => fallback; a.set = a._saveProgress = () => {};
  a.ingest(JSON.parse(readFileSync(new URL("../source/quartz/static/neural/graph-data.json", import.meta.url), "utf8")));
  const n = a.nodes.find((n) => n.t === "Trap and Roll from Mount" && n.role === "defender");
  assert.ok(n && n.pi >= 0, "a paired technique is needed to distinguish stored and drawn coordinates");
  let path = [];
  a.ctx = new Proxy({}, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === "beginPath") return () => { path = []; };
      if (["arc", "moveTo", "lineTo"].includes(key)) return (...args) => path.push([key, ...args]);
      if (key === "stroke") return () => strokes.push({ color: target.strokeStyle, path: [...path] });
      if (key === "measureText") return (text) => ({ width: String(text).length * 7 });
      if (key === "createLinearGradient" || key === "createRadialGradient") return () => ({ addColorStop() {} });
      return () => {};
    },
  });
  Object.assign(a, { W: 495, H: 600, dpr: 1, alpha: 1, startTime: 0, focusIdx: n.idx,
    currentPos: n.idx, playerRole: "top", pulse: null, activeMove: null, optionIdxs: [], trail: [], ripples: [] });
  a.anim = (_key, fallback) => fallback; a.updateNodeCard = a._syncSeatStars = () => {};
  a.cam = { cx: n.x, cy: a.nodes[n.pi].y, vw: 165 };
  const sw = a._sweep = { idx: n.idx, hold: .38, dur: .7, band: .6, roll: .8, t0: a.now,
    timer: a.after(1.08, () => assert.fail("a paused sweep must not finish")) };
  a.advance(640);
  const drawSweep = () => {
    strokes.length = 0; a.draw();
    return strokes.filter((s) => s.color === "rgba(126,224,168,.55)" || s.color === "rgba(255,255,255,.92)");
  };
  const before = drawSweep();
  assert.equal(before.length, 2, "the draw emits a band and a needle");
  assert.notEqual(a._LY(n), n.y, "the fixture must exercise a visible lift");
  assert.deepEqual(before[0].path[0].slice(0, 4), ["arc", n.x, a._LY(n), 22]);
  a.setPaused(true); a.advance(20000);
  assert.equal(a._sweep, sw);
  assert.deepEqual(drawSweep(), before, "the real draw cannot age the needle on the frame clock");
  a._replay = {};
  assert.deepEqual(drawSweep(), [], "a replay cannot display the paused live attempt's needle");
  a._replay = null;
  assert.deepEqual(drawSweep(), before);
});

test("closing Inspect returns only the pause it took", () => {
  for (const wasPaused of [false, true]) {
    const a = app();
    a.hideOptDetail = a.clearClipLoops = a._setDetailCtx = () => {};
    a.paused = true; a._detailWasPaused = wasPaused;
    a.closeOptionDetail();
    assert.equal(a.paused, wasPaused);
    assert.equal(a._detailWasPaused, null);
  }
});

test("a replay borrows and returns the live attempt's announcer and camera ownership", () => {
  const a = app();
  a.nodes = [{ idx: 0 }];
  a.replaySteps = () => [{ kind: "wide", name: "Archived fixture", nodes: [0] }];
  a._replayFrame = () => ({ cx: 0, cy: 0, vw: 10 });
  a.cam = { cx: 0, cy: 0, vw: 20, lvw: Math.log(20) }; a.camTarget = { ...a.cam };
  a._paneCameraTarget = (t) => t; a._reducedMotion = () => false;
  a.flare = a._suppressTray = a._renderReplayBar = a._clearReplayBar = a._refreshHistoryRows = () => {};
  a.startExecution({ idx: 0 });
  a.executionEvent("You go for", "Live fixture", "info", "executing");
  const owner = a._execution;
  assert.equal(a.startReplay({ log: [] }), true);
  assert.equal(a.paused, true); assert.equal(owner.camera, false);
  assert.equal(a.evKickerRef.current.textContent, "Replay");
  assert.equal(a.stopReplay("test"), true);
  assert.equal(a._execution, owner); assert.equal(owner.camera, true);
  assert.equal(a.paused, false);
  assert.equal(a.evKickerRef.current.textContent, "You go for");
  a.setEvent("Unrelated", "late callback", "info");
  assert.equal(a.evKickerRef.current.textContent, "You go for");
});

console.log("roll execution: 14 focused behavioral cases; browser geometry/input remain separate");
