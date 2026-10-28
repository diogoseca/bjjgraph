// THE DIRECTED ARRIVAL (v1.237.0, owner U48 → U50 d: S2 · Z2), as source behaviour: who gets it, the
// zoom curve, the path (pick hand-over, hold, rise, landing, bounds), the integrator's pose branch, the
// board, reduced motion and the gesture hand-over. The same claims are measured in a real browser
// through draw()'s transform by e2e/journeys/opening-camera.spec.ts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { knowledgeSource } from "./_knowledge_profile_harness.mjs";

const source = readFileSync(new URL("../neural/src/app.src.jsx", import.meta.url), "utf8");
const evalApp = (tail) => new Function("DCLogic", "React", `${knowledgeSource}\n${source}\n${tail}`)(class {}, { createRef: () => ({ current: null }) });
const Component = evalApp("return Component;");
const K = evalApp("return { ngOpenZoom, ngBezier, NG_CAM_OPEN_EASE, NG_CAM_OPEN_LAND, NG_CAM_OPEN_RISE, NG_CAM_OPEN_ANCHOR, NG_CAM_OPEN_OUT, NG_CAM_OPEN_PICK, NG_CAM_OPEN_STALL_MS, NG_CAM_OPEN_FAINT, NG_READER_FIRST_LAYOUT_MS };");
const make = () => Object.assign(Object.create(Component.prototype), {
  W: 1440, H: 900, graphW: 1600, gcx: 0, gcy: 0, now: 0, NG_ARRIVE_KICKER: 2,
  cam: { cx: 0, cy: 0, vw: 3680 }, camTarget: { cx: 0, cy: 0, vw: 1600 },
});
const dt = 1 / 60;

test("the first opening is directed unless something else owns the board or the camera, and it is considered once", () => {
  for (const [state, directed] of [
    [{}, true], [{ user: { id: "u" }, _authUserId: "u" }, true],   // no longer a guest-only preview
    [{ _urlSeeded: true }, false], [{ _refPage: "principle" }, false], [{ _staged: 0 }, false],
    [{ introDone: true }, false], [{ currentPos: 3 }, false], [{ _camHoldUntil: 1e9, _camHoldTarget: {} }, false],
  ]) {
    const a = Object.assign(make(), state);
    assert.equal(!!a._firstOpening(), directed, JSON.stringify(state));
    a._retireCamOpen();
    assert.equal(a._firstOpening(), null, "never re-enters: later rolls mint their own token in startRoll");
  }
});

test("the zoom curve: endpoints, monotone, starts at v0, touches down at rest on its peak", () => {
  const N = 2000, h = 1e-6, d = (f, u) => (f(Math.min(1, u + h)) - f(Math.max(0, u - h))) / (Math.min(1, u + h) - Math.max(0, u - h));
  for (const v0 of [0, 0.15]) {
    for (const up of [0.34, 0.5, 0.632, 0.66]) {
      const z = (u) => K.ngOpenZoom(u, v0, up);
      assert.ok(Math.abs(z(0)) < 1e-12 && Math.abs(z(1) - 1) < 1e-9, `endpoints v0=${v0} up=${up}`);
      let prev = 0, peak = 0, at = 0;
      for (let i = 1; i <= N; i++) {
        const u = i / N, v = z(u);
        assert.ok(v >= prev - 1e-12, `monotone at ${u}`); prev = v;
        const s = d(z, u - 0.5 / N); if (s > peak) { peak = s; at = u; }
      }
      assert.ok(Math.abs(at - up) < 0.01, `peaks at up (${at} vs ${up})`);
      assert.ok(Math.abs(d(z, 0) - v0) < 2e-3 && d(z, 1) < 2e-3, "starts at v0, lands at rest");
    }
  }
  const e = (x) => K.ngBezier(K.NG_CAM_OPEN_EASE, x);
  assert.equal(e(0), 0); assert.equal(e(1), 1);
  assert.ok(e(1e-3) < 1e-4 && 1 - e(1 - 1e-3) < 1e-4, "the rise departs and settles at rest");
});

// A phone-sized world: a Mount-like node left of centre; the band frames it at (163, 171).
const world = () => {
  const a = Object.assign(make(), { W: 390, H: 844, graphW: 1724, ROLL_ZOOM: 0.085, _mdt: dt, currentPos: 0 });
  a.cam = { cx: 0, cy: 0, vw: 1724 * 2.3 }; a.camTarget = { cx: 0, cy: 0, vw: 1724 * 2.3 };
  const q = { x: -265, y: -120 }, Fw = 146.5;
  a.nodes = [{ idx: 0 }, { idx: 1 }]; a.pairMid = (n) => (n.idx === 0 ? q : { x: 300, y: 200 });
  a.rollCamTarget = () => ({ cx: q.x + 32 * Fw / 390, cy: q.y + 251 * Fw / 390, vw: Fw, _paneFraction: 0 });
  a._reducedMotion = () => false;
  return { a, q };
};
const fly = (a, q, op, frames, start = 0, onFrame = () => {}) => {
  const out = [];
  for (let i = 0; i < frames; i++) {
    a.now = start + i * dt; onFrame(a.now);
    const pose = a._openingPose(op);
    if (!pose) { out.push(null); continue; }
    a.cam = { cx: pose.x, cy: pose.y, vw: pose.w };
    const s = a.W / pose.w;
    out.push({ t: a.now, pose, node: { x: (q.x - pose.x) * s + 195, y: (q.y - pose.y) * s + 422 } });
  }
  return out;
};
const bounds = (live) => {
  let pc = { x: 0, y: 0 }, kick = 0, move = 0, jerk = 0, prevRate = null;
  for (let i = 1; i < live.length; i++) {
    const p = live[i - 1].pose, f = live[i].pose, s0 = 390 / p.w, s1 = 390 / f.w;
    const c = { x: (p.x - f.x) * s1, y: (p.y - f.y) * s1 };
    kick = Math.max(kick, Math.hypot(c.x - pc.x, c.y - pc.y)); pc = c;
    move = Math.max(move, ...[[0, 0], [390, 0], [0, 844], [390, 844]].map(([x, y]) => Math.hypot(c.x + (x - 195) * (s1 / s0 - 1), c.y + (y - 422) * (s1 / s0 - 1))));
    const rate = Math.log(f.w / p.w) / dt;
    if (prevRate != null && !f.last) jerk = Math.max(jerk, Math.abs(rate - prevRate)); prevRate = rate;
  }
  return { kick, move, jerk };
};

test("the first opening: hands over at the pick without a step or a reversal, holds until the board, rises, lands exactly and softly", () => {
  const { a, q } = world();
  const op = { pick: null, cancelled: false };
  const live = fly(a, q, op, 600, 0, (t) => { if (op.pick == null && t - op.t0 > K.NG_CAM_OPEN_PICK) op.pick = t; }).filter(Boolean);
  const E = op.pick + 2, last = live.at(-1);
  assert.ok(last.pose.last && Math.abs(last.t - op.land) < dt, "lands at pick + NG_CAM_OPEN_LAND");
  assert.ok(Math.abs(last.node.x - 163) < 1e-6 && Math.abs(last.node.y - 171) < 1e-6, "lands on the band framing");
  for (let i = 1; i < live.length; i++) assert.ok(live[i].pose.w <= live[i - 1].pose.w + 1e-9, "the zoom never reverses");
  assert.ok(Math.log(live[0].pose.w / live[30].pose.w) > 0.01, "the zoom is already moving in the first half-second");
  const k = live.findIndex((f) => f.t >= op.pick), dv = (i) => ({ x: live[i].node.x - live[i - 1].node.x, y: live[i].node.y - live[i - 1].node.y });
  const v0 = dv(k);
  assert.ok(Math.hypot(v0.x - dv(k - 1).x, v0.y - dv(k - 1).y) < 0.02, "no velocity step at the pick");
  for (let i = k + 1; live[i].t <= op.pick + K.NG_CAM_OPEN_ANCHOR; i++) assert.ok(dv(i).x * v0.x + dv(i).y * v0.y >= -1e-9, "the drift never reverses");
  const held = live.filter((f) => f.t >= op.pick + K.NG_CAM_OPEN_ANCHOR && f.t < E);
  assert.ok(held.length > 60 && held.every((f) => Math.hypot(f.node.x - held[0].node.x, f.node.y - held[0].node.y) < 1e-6), "no rise before the board");
  const rising = live.filter((f) => f.t >= E && f.t <= E + K.NG_CAM_OPEN_RISE);
  for (let i = 1; i < rising.length; i++) assert.ok(rising[i].node.y <= rising[i - 1].node.y + 1e-9, "the rise only rises");
  const tail = live.slice(-3).map((f, i, L) => (i ? Math.abs(Math.log(f.pose.w / L[i - 1].pose.w)) / dt : 0));
  assert.ok(Math.max(...tail) < 0.01, `touches down at rest (${tail})`);
  const b = bounds(live);
  assert.ok(b.kick < 6 && b.move < 48, `camera-continuity's phone bounds: kick ${b.kick} move ${b.move}`);
  assert.ok(b.jerk < 0.02, `the zoom rate is continuous frame to frame (${b.jerk})`);
});

test("a restart breathes out to the overview, dives in from rest, holds until the board, lands exactly", () => {
  const { a, q } = world();
  a.cam = { cx: 300, cy: 200, vw: 146.5 }; a.currentPos = 0;   // settled on another node, at roll zoom
  const op = { pick: 10, cancelled: false, restart: true, from: 1, land: 10 + K.NG_CAM_OPEN_LAND };
  const live = fly(a, q, op, 420, 10).filter(Boolean);
  const E = op.pick + 2, out = live.filter((f) => f.t < op.tin), last = live.at(-1);
  assert.ok(op.tin - op.pick >= K.NG_CAM_OPEN_OUT - 1e-9, "the breath out takes at least NG_CAM_OPEN_OUT");
  for (let i = 1; i < out.length; i++) assert.ok(out[i].pose.w >= out[i - 1].pose.w - 1e-9, "the breath out only widens");
  const dive = live.filter((f) => f.t >= op.tin);
  for (let i = 1; i < dive.length; i++) assert.ok(dive[i].pose.w <= dive[i - 1].pose.w + 1e-9, "then the dive only narrows");
  const held = live.filter((f) => f.t >= op.tin && f.t < E);
  assert.ok(held.length > 20 && held.every((f) => Math.hypot(f.node.x - held[0].node.x, f.node.y - held[0].node.y) < 1e-6), "no rise before the board");
  assert.ok(last.pose.last && Math.abs(last.node.x - 163) < 1e-6 && Math.abs(last.node.y - 171) < 1e-6, "lands on the band framing");
  const b = bounds(live);
  assert.ok(b.kick < 6 && b.move < 48, `camera-continuity's phone bounds: kick ${b.kick} move ${b.move}`);
});

test("the integrator records a directed pose and hands over at rest", () => {
  const a = make();
  a._camStep(dt, { pose: { x: 10, y: 20, w: 1000 } });
  a._camStep(dt, { pose: { x: 12, y: 21, w: 990 } });
  assert.equal(a.cam.cx, 12); assert.equal(a.cam.cy, 21); assert.equal(a.cam.vw, 990);
  assert.ok(a._cm.v.x > 0 && a._cm.v.l < 0, "the chord is its velocity");
  a._camStep(dt, { pose: { x: 13, y: 21, w: 985, last: true } });
  assert.deepEqual(a._cm.v, { x: 0, y: 0, l: 0 });
  assert.equal(a._camFlights ?? 0, 0, "a directed pose never starts a flight");
});

// The board is state on the app wrap (NG_CAM_OPEN_CSS), never a style on a row: a stub wrap and document.
const stubWrap = () => {
  const w = { dataset: {}, listeners: {}, props: {}, fading: [],
    querySelectorAll: () => w.fading,
    addEventListener(type, fn) { (w.listeners[type] ||= []).push(fn); },
    removeEventListener(type, fn) { w.listeners[type] = (w.listeners[type] || []).filter((f) => f !== fn); } };
  w.style = { setProperty: (k, v) => { w.props[k] = v; }, removeProperty: (k) => { delete w.props[k]; } };
  return w;
};
globalThis.getComputedStyle ||= (el) => ({ opacity: el._opacity ?? "1" });
const withDocument = (fn) => {
  const old = globalThis.document, nodes = {};
  globalThis.document = { getElementById: (id) => nodes[id] || null, createElement: () => ({}), head: { appendChild: (el) => { nodes[el.id] = el; } } };
  let out;
  try { out = fn(nodes); } finally { if (!(out instanceof Promise)) globalThis.document = old; }
  return out instanceof Promise ? out.finally(() => { globalThis.document = old; }) : out;
};
const boardApp = (state = {}) => {
  const a = make(), wrap = stubWrap();
  Object.assign(a, { wrapRef: { current: wrap }, _reducedMotion: () => false, get: (k, d) => (k in state ? state[k] : d) });
  return { a, wrap };
};

test("the board is wrap state the CSS turns into styles; a row is styled by where it stands, so adoption needs no frame", () => {
  const css = evalApp("return NG_CAM_OPEN_CSS;");
  assert.match(css, /:not\(\[data-reader-game-part\],\[data-reader-game-media\],\[data-reader-media\]\)\{opacity:var\(--ng-open-o\)!important\}/,
    "a loose row fades by the reader's own marks: adopted, or the film in its media home or slot (re-review F1/F2)");
  assert.match(css, /\[data-ng-open=faint\][^{]*\{visibility:hidden\}/, "a faint board hides its rows");
  assert.match(css, /\[data-ng-open=faint\] \.ng-reader :is\(\[data-reader-media\],\[data-reader-game-media\]\)\{visibility:hidden!important\}/, "...the homed film too, over reading.css (F3)");
  const hides = css.split("}").filter((r) => /visibility/.test(r));
  assert.ok(hides.length >= 1 && hides.every((r) => r.startsWith("[data-ng-open=faint]")), "and only a faint board hides anything: " + hides.join(" | "));
  withDocument((nodes) => {
    const { a, wrap } = boardApp(); a.now = 2.5;
    const op = a._camOpen = { pick: 0, cancelled: false, rise: 0.4, riseDy: 120 };
    a._openingBoard(op);
    assert.ok(nodes["ng-open-css"], "the rule set is injected once");
    assert.deepEqual([wrap.dataset.ngOpen, wrap.props["--ng-open-o"], wrap.props["--ng-open-y"], wrap.dataset.ngBook], ["board", "0.4", "120.00px", "on"]);
    op.rise = 0.05; a.now = 2.1; a._openingBoard(op);
    assert.equal(wrap.dataset.ngOpen, "faint", "below NG_CAM_OPEN_FAINT the rows take no tap");
    wrap.dataset = {}; wrap.props = {}; a.now = 1.5; op.rise = 0; a._openingBoard(op);
    assert.equal(wrap.dataset.ngOpen, undefined, "a first opening holds no board before its reveal: there is none");
    a.now = 4.1; op.rise = 1; op.riseDy = 0; a._openingBoard(op);
    assert.equal(wrap.dataset.ngOpen, undefined); assert.equal(wrap.props["--ng-open-o"], undefined); assert.equal(op.boardDone, true);
    clearTimeout(a._openStall);
  });
});

test("the board's two values never inherit: they are stamped on the parts that read them, and taken off at the end (CAM2548)", () => {
  const css = evalApp("return NG_CAM_OPEN_CSS;");
  assert.match(css, /@property --ng-open-o\{[^}]*inherits:false[^}]*initial-value:1\}/, "the opacity is registered, not inherited, shown by default");
  assert.match(css, /@property --ng-open-y\{[^}]*inherits:false[^}]*initial-value:0px\}/, "and so is the ride");
  withDocument(() => {
    const { a, wrap } = boardApp(), part = () => { const e = { props: {} }; e.style = { setProperty: (k, v) => { e.props[k] = v; }, removeProperty: (k) => { delete e.props[k]; }, getPropertyValue: (k) => e.props[k] ?? "" }; return e; };
    const sec = part(), shelf = part(), card = part(), hand = part();
    Object.assign(a, { _readerEl: sec, _layerDockEl: shelf, _landEl: card, optionsRef: { current: hand }, _landFilmEl: null });
    const op = a._camOpen = { pick: 0, cancelled: false, rise: 0.4, riseDy: 120 };
    a.now = 2.5; a._openingBoard(op);
    for (const [name, e] of [["section", sec], ["shelf", shelf], ["card", card], ["hand", hand]])
      assert.deepEqual([e.props["--ng-open-o"], e.props["--ng-open-y"]], ["0.4", "120.00px"], name + " reads its own stamp: an inherited value on the wrap restyled its whole subtree every frame");
    a._openBoardEnd(false);
    for (const e of [sec, shelf, card, hand]) assert.deepEqual(e.props, {}, "every stamp comes off with the board");
    clearTimeout(a._openStall);
  });
});

test("rows that mount before the clock reaches the reveal are styled at once, faint (re-review F4)", () => {
  withDocument(() => {
    const { a, wrap } = boardApp(); a.now = 1.9;   // the pick at 0: the rAF clock has not reached the reveal (2.0)
    const op = a._camOpen = { pick: 0, cancelled: false, rise: 0, riseDy: 0 };
    a._openingBoard(op);
    assert.equal(wrap.dataset.ngOpen, undefined, "no rows yet: nothing to style");
    op.mounted = true; a._openingBoard(op);   // the reveal's wall-clock timer fired first and mounted them
    assert.equal(wrap.dataset.ngOpen, "faint", "mounted early, the board is faint at once: never a frame at full opacity");
    assert.equal(wrap.props["--ng-open-o"], "0");
    clearTimeout(a._openStall);
  });
});

test("retiring the arrival also ends beat 1's wide view (re-review m-a)", () => {
  withDocument(() => {
    const { a } = boardApp();
    a._camOpen = { pick: 0, cancelled: false }; a._arriveWide = true; a._openHandOff = false;
    a._retireCamOpen();
    assert.equal(a._arriveWide, false, "a pause between the pick and the reveal runs no zoom-out-and-back");
  });
});

test("while the reader is awaited the hand reads preparing, never unavailable (re-review m-c)", () => {
  const a = make();
  Object.assign(a, { choiceValueRuntime: () => null, choiceValueRecord: () => ({ immediateExecutionChance: 0.5, kind: "move" }),
    choiceImmediateFallback: () => ({}), _gameValueState: "idle", _choiceRuntimeState: "unavailable" });
  a._readerAwaited = () => true;
  const v = a.choiceValueView({});
  assert.deepEqual([v.status, v.state], ["pending", "Preparing…"], "the reader's first layout is still coming");
  a._readerAwaited = () => false;
  assert.equal(a.choiceValueView({}).state, "Unavailable", "and once it is not, the old honest answer");
});

test("a release fades to full in 0.2s and its own transitionend clears it, leaving nothing behind", () => {
  withDocument(() => {
    const { a, wrap } = boardApp(); a.now = 2.5;
    const op = a._camOpen = { pick: 0, cancelled: false, rise: 0.3, riseDy: 90 };
    a._openingBoard(op); wrap.fading = [{ offsetHeight: 300, _opacity: "0.3" }]; a._openBoardEnd(true);
    assert.deepEqual([wrap.dataset.ngOpen, wrap.props["--ng-open-o"], wrap.props["--ng-open-y"]], ["release", "1", "0px"]);
    const fire = (propertyName, target) => (wrap.listeners.transitionend || []).slice().forEach((f) => f({ propertyName, target }));
    fire("opacity", { matches: () => false });
    assert.equal(wrap.dataset.ngOpen, "release", "an unrelated element's transition is not the board's");
    fire("opacity", { matches: () => true });
    assert.equal(wrap.dataset.ngOpen, undefined); assert.equal(wrap.props["--ng-open-o"], undefined);
    assert.equal((wrap.listeners.transitionend || []).length, 0, "and the listener goes with it");
    clearTimeout(a._openStall);
  });
});

test("a staged restart takes the board over where it stands; any other retirement releases it", () => {
  withDocument(() => {
    const { a, wrap } = boardApp(); a.now = 2.5;
    a._camOpen = { pick: 0, cancelled: false, rise: 0.44, riseDy: 193 };
    a._openingBoard(a._camOpen);
    a._openHandOff = true; a._retireCamOpen();
    assert.equal(wrap.dataset.ngOpen, "board", "two quick restarts: the old board is not popped back to full");
    assert.deepEqual([a._openO, a._openY], [0.44, 193], "the new token inherits what the board shows");
    wrap.fading = [{ offsetHeight: 300, _opacity: "0.44" }];
    a._openHandOff = false; a._camOpen = { pick: 0, cancelled: false }; a._retireCamOpen();
    assert.equal(wrap.dataset.ngOpen, "release");
    wrap.fading = []; a._camOpen = { pick: 0, cancelled: false, rise: 0.5 }; a.now = 2.6; a._openingBoard(a._camOpen); a._retireCamOpen();
    assert.equal(wrap.dataset.ngOpen, undefined, "nothing fading: cleared at once, never a release that no transitionend would end");
    clearTimeout(a._openStall);
  });
});

test("the last resort: a faint board whose clock stops brings its rows back; a live clock never trips it", async () => {
  await withDocument(async () => {
    const { a, wrap } = boardApp(); a.now = 2.05;
    const op = a._camOpen = { pick: 0, cancelled: false, rise: 0.02, riseDy: 200 };
    a._openingBoard(op);
    assert.equal(wrap.dataset.ngOpen, "faint");
    await new Promise((r) => setTimeout(r, K.NG_CAM_OPEN_STALL_MS + 150));
    assert.equal(wrap.dataset.ngOpen, "board", "never hidden, only faint");
    assert.equal(wrap.props["--ng-open-o"], "0.02", "and the clock that stopped is not overruled: it shows what it showed");
    const live = a._camOpen = { pick: 0, cancelled: false, rise: 0.02, riseDy: 200 };
    for (let i = 0; i < 4; i++) { a.now = 2.1 + i * 0.01; a._openingBoard(live); await new Promise((r) => setTimeout(r, K.NG_CAM_OPEN_STALL_MS * 0.6)); }
    assert.equal(wrap.dataset.ngOpen, "faint", "frames keep coming: the faint window is the rise's own");
    clearTimeout(a._openStall);
  });
});

test("the Win chance is asked again when the board shows and when it ends: a refusal while faint is never final (D-354)", () => {
  withDocument(() => {
    const { a, wrap } = boardApp(); let asked = 0; a._ensureGameValues = () => { asked++; };
    const op = a._camOpen = { pick: 0, cancelled: false, rise: 0.05, riseDy: 200 };
    a.now = 2.05; a._openingBoard(op);
    assert.equal(wrap.dataset.ngOpen, "faint"); assert.equal(asked, 0, "a faint board's hand is hidden: nothing to ask yet");
    op.rise = 0.06; a.now = 2.06; a._openingBoard(op); assert.equal(asked, 0, "still faint");
    op.rise = 0.3; a.now = 2.3; a._openingBoard(op);
    assert.equal(asked, 1, "the frame the hand shows, the activation refused while it was hidden is asked again");
    op.rise = 0.4; a.now = 2.4; a._openingBoard(op); assert.equal(asked, 1, "once, on the transition");
    a._openBoardEnd(false);
    assert.equal(asked, 2, "and when the board is the player's");
    clearTimeout(a._openStall);
  });
});

test("a landing's hand waits for the reader's first layout of it, and that layout asks again (D-354 + D-351 as an order)", async () => {
  const a = make(); let asked = 0; a._ensureGameValues = () => { asked++; }; a.paintChoiceValues = () => {};
  a._landIdx = 7; a._readerQueued = { path: "/Positions/Mount/Top", idx: 7, t0: performance.now() };
  assert.equal(a._readerAwaited(), true, "asked for its article, not yet laid out: not playable");
  a._readerQueued.skip = true; assert.equal(a._readerAwaited(), false, "a skipped article releases it"); delete a._readerQueued.skip;
  a._readerFailed = true; assert.equal(a._readerAwaited(), false, "so does a reader that failed to load"); a._readerFailed = false;
  a._readerQueued.t0 = performance.now() - K.NG_READER_FIRST_LAYOUT_MS - 1;
  assert.equal(a._readerAwaited(), false, "and the bound: a reader that never lays it out is not waited for forever");
  a._readerQueued = { path: "/Positions/Mount/Top", idx: 7, t0: performance.now() };
  Object.assign(a, { optionsRef: { current: { hasAttribute: () => false, toggleAttribute: () => {} } }, _landStackEl: null, _landNavEl: null, _handCloseEl: null,
    _landEl: null, _readerPin: null, _handShown: () => true, _layerOn: () => true, _filmPending: () => false });
  const loc = globalThis.location; globalThis.location = { href: "http://localhost/" };
  try { a._readerHold({ root: { dataset: {} }, path: "/x", layout: () => {} }, false, 390, 844); } finally { globalThis.location = loc; }
  assert.equal(a._readerQueued.laid, true, "the reader's first layout of the landing marks it");
  assert.equal(a._readerAwaited(), false);
  await Promise.resolve();
  assert.equal(asked, 1, "and asks the Win chance again once that layout has adopted (and held, or not) the hand");
});

test("reduced motion: the whole graph until the board, then the landing once it holds still, and the board is never styled", () => {
  withDocument(() => {
    const { a } = world(); a._reducedMotion = () => true; const wrap = stubWrap(); a.wrapRef = { current: wrap };
    const op = { pick: null, cancelled: false };
    assert.deepEqual(a._openingFrame(op), { snap: true, target: { cx: 0, cy: 0, vw: 1724 } });
    op.pick = 3.2; a.now = 5.1;
    assert.equal(a._openingFrame(op).target.vw, 1724, "named, not yet framed: no camera change before the board");
    const seen = [];
    for (let i = 0; i < 8; i++) { a.now = 5.2 + i / 60; seen.push(a._openingFrame(op).target.vw); }
    assert.deepEqual(seen.slice(0, 4), [1724, 1724, 1724, 1724], "the landing waits until the target holds still");
    assert.equal(seen.at(-1), 146.5, "then it is the one change of view");
    a._openingBoard(op);
    assert.equal(wrap.dataset.ngOpen, undefined, "reduced motion never styles the board");
  });
});

test("a pause ends the arrival without taking the camera; the follow-cam resumes with the game", () => {
  withDocument(() => {
    const { a } = world(); const wrap = stubWrap(); a.wrapRef = { current: wrap }; a.paused = true;
    const op = a._camOpen = { pick: 3.2, cancelled: false };
    assert.equal(a._openingFrame(op), null);
    assert.equal(op.cancelled, true); assert.equal(a._camOpen, null);
    assert.equal(a._camOpenManual ?? false, false, "a pause is not a gesture: nothing holds the camera after it");
  });
});

test("a gesture cancels the arrival at once, releases the board, and completion cannot reclaim its camera", () => {
  withDocument(() => {
    const { a, wrap } = boardApp(); a.now = 2.5; a.evCenterRef = { current: { style: {} } };
    const op = a._camOpen = { pick: 0, cancelled: false, rise: 0.3, riseDy: 90 };
    a._openingBoard(op); wrap.fading = [{ offsetHeight: 300, _opacity: "0.3" }];
    a.cam.cx = 200; a._cancelCamOpen();
    assert.equal(a.camTarget.cx, 200, "the camera is where the hand left it");
    assert.equal(wrap.dataset.ngOpen, "release", "the board finishes in 0.2s, not a pop");
    assert.equal(a._openingFrame(op), null, "a cancelled arrival directs nothing");
    a._endArrival();
    assert.equal(a._camOpen, null);
    assert.equal(a._camOpenManual, true, "the arrival's own end does not take the camera back");
    a.clearTimers();
    assert.equal(a._camOpenManual, false, "the player's next deliberate act releases the hold");
    clearTimeout(a._openStall);
  });
});

console.log("camera opening: 12 cases (scope, zoom curve, first opening, restart, integrator, board state, release, restart hand-off, last resort, reduced motion, pause, gesture)");
