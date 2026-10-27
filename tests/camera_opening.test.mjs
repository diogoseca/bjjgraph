// THE DIRECTED ARRIVAL (v1.235.0, owner U48 → U50 d: S2 · Z2), as source behaviour: who gets it, the
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
const K = evalApp("return { ngOpenZoom, ngBezier, NG_CAM_OPEN_EASE, NG_CAM_OPEN_LAND, NG_CAM_OPEN_RISE, NG_CAM_OPEN_ANCHOR, NG_CAM_OPEN_OUT, NG_CAM_OPEN_PICK };");
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

test("the board fades in and rides the node's remaining rise, and nothing outlives it", () => {
  const a = make(), sec = { isConnected: true, style: { opacity: "", translate: "", transition: "" } };
  a._readerEl = sec; a._layerDockEl = null; a._reducedMotion = () => false; a.now = 2.5;
  const op = a._camOpen = { pick: 0, cancelled: false, rise: 0.4, riseDy: 120 };
  a._openingBoard(op);
  assert.equal(sec.style.opacity, "0.4"); assert.equal(sec.style.translate, "0 120.00px"); assert.equal(sec.style.transition, "none");
  a.now = 1.5; op.rise = 0; a._openingBoard(op);
  assert.equal(sec.style.opacity, "0", "before the reveal a first opening's board stays out of sight");
  a.now = 4.1; op.rise = 1; op.riseDy = 0; a._openingBoard(op);
  assert.equal(sec.style.opacity, ""); assert.equal(sec.style.translate, ""); assert.equal(sec.style.transition, "");
  assert.equal(op.boardDone, true);
});

test("a row the reader has not adopted yet is hidden, not faded, and handed back the moment it is adopted", () => {
  const a = make(), inside = new Set();
  const sec = { isConnected: true, style: { opacity: "", translate: "", transition: "" }, contains: (el) => inside.has(el) };
  const film = { isConnected: true, offsetHeight: 220, style: { visibility: "" } };
  a._readerEl = sec; a._landFilmEl = film; a._layerDockEl = null; a._reducedMotion = () => false; a.get = () => true; a.now = 2.02;
  const op = a._camOpen = { pick: 0, cancelled: false, rise: 0, riseDy: 230 };
  a._openingBoard(op);
  assert.equal(film.style.visibility, "hidden", "outside the section on the reveal frame: hidden, so it neither paints nor takes a click");
  inside.add(film); a.now = 2.04; a._openingBoard(op);
  assert.equal(film.style.visibility, "", "adopted: the section carries the fade from here");
  assert.equal(sec.style.translate, "0 230.00px");
});

test("reduced motion: the whole graph until the board, then the landing framing, and the board is left alone", () => {
  const { a } = world(); a._reducedMotion = () => true;
  const op = { pick: null, cancelled: false };
  assert.deepEqual(a._openingFrame(op), { snap: true, target: { cx: 0, cy: 0, vw: 1724 } });
  op.pick = 3.2; a.now = 5.1;
  assert.equal(a._openingFrame(op).target.vw, 1724, "named, not yet framed: no camera change before the board");
  a.now = 5.2;
  assert.equal(a._openingFrame(op).target.vw, 146.5, "the board's frame is the one change of view");
  const sec = { isConnected: true, style: { opacity: "", translate: "", transition: "" } };
  a._readerEl = sec; a._openingBoard(op);
  assert.equal(sec.style.opacity, ""); assert.equal(sec.style.translate, "");
});

test("a gesture cancels the arrival at once, finishes the board, and completion cannot reclaim its camera", () => {
  const a = make(), sec = { isConnected: true, style: { opacity: "", translate: "", transition: "" } };
  a._readerEl = sec; a._layerDockEl = null; a._reducedMotion = () => false; a.now = 2.5;
  a.evCenterRef = { current: { style: {} } };
  const op = a._camOpen = { pick: 0, cancelled: false, rise: 0.3, riseDy: 90 };
  a._openingBoard(op);
  a.cam.cx = 200; a._cancelCamOpen();
  assert.equal(a.camTarget.cx, 200, "the camera is where the hand left it");
  assert.equal(sec.style.opacity, ""); assert.match(sec.style.transition, /^opacity \.2s/, "the board finishes in 0.2s, not a pop");
  assert.equal(a._openingFrame(op), null, "a cancelled arrival directs nothing");
  a._endArrival();
  assert.equal(a._camOpen, null);
  assert.equal(a._camOpenManual, true, "the arrival's own end does not take the camera back");
  a.clearTimers();
  assert.equal(a._camOpenManual, false, "the player's next deliberate act releases the hold");
});

console.log("camera opening: 9 cases (scope, zoom curve, first opening, restart, integrator, board, unadopted rows, reduced motion, gesture)");
