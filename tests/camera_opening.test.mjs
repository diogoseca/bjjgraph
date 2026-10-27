// Preview-only opening law and ownership; native DOM/gesture/media coverage is
// in the sealed CAMP2GO495 host kit, against the actual emitted front door.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { knowledgeSource } from "./_knowledge_profile_harness.mjs";

const source = readFileSync(new URL("../neural/src/app.src.jsx", import.meta.url), "utf8");
const Component = new Function("DCLogic", "React", `${knowledgeSource}\n${source}\nreturn Component;`)(class {}, { createRef: () => ({ current: null }) });
const make = () => Object.assign(Object.create(Component.prototype), {
  W: 1440, H: 900, graphW: 1600, gcx: 0, gcy: 0, now: 0, NG_ARRIVE_KICKER: 2,
  cam: { cx: 0, cy: 0, vw: 3680 }, camTarget: { cx: 0, cy: 0, vw: 1600 },
});
const dt = 1 / 60;
const run = (a, frames, ctx) => {
  const samples = [{ ...a.cam }];
  for (let i = 0; i < frames; i++) { a.now += dt; a._camStep(dt, ctx); samples.push({ ...a.cam }); }
  return samples;
};

test("preview quintic respects the 1.875 zoom slope, including a too-short requested flight", () => {
  const a = make(); a.cam.vw = 1600; a.camTarget.vw = 16;
  const frames = run(a, 240, { quintic: true, openPhase: "in", dur: () => .1 });
  const rates = frames.slice(1).map((v, i) => Math.abs(Math.log(v.vw / frames[i].vw)) / dt);
  assert.ok(Math.max(...rates) <= 3.2, Math.max(...rates));
  assert.ok(Math.abs(a.cam.vw - 16) < 1e-9);
  assert.equal(a._cm.flight, null);
  assert.ok(Math.abs(a._cm.v.l) < 1e-12, "static quintic endpoint has no inherited chord velocity");
});

test("shared intro finishes at rest; V1 can widen and preframe as separate flights", () => {
  const a = make();
  const frames = run(a, 193, { quintic: true, openPhase: "intro", dur: () => 3.2 });
  assert.ok(Math.abs(a.cam.vw - 1600) < 1e-9);
  assert.ok(Math.abs(Math.log(frames[1].vw / frames[0].vw)) < 2e-6, "gentle first sample");
  assert.ok(Math.abs(a._cm.v.l) < 1e-12);
  a.camTarget.vw *= 1.12;
  run(a, 45, { quintic: true, openPhase: "out", dur: () => .75 });
  assert.ok(Math.abs(a.cam.vw - 1792) < 1e-8);
  assert.ok(Math.abs(a._cm.v.l) < 1e-12);
  // Below the stock jump threshold: still a rest-to-rest preview phase.
  a.camTarget.cy = 20;
  run(a, 76, { quintic: true, openPhase: "wide", dur: () => 1.25 });
  assert.equal(a._camFlights, 3);
  assert.ok(Math.abs(a.cam.cy - 20) < 1e-9);
});

test("URL switch is guest-only, unseeded, and considered just once", () => {
  const old = globalThis.window;
  try {
    for (const [query, state, auth, expected] of [
      ["?camOpen=v1", {}, false, "v1"], ["?camOpen=v2", {}, false, "v2"],
      ["", {}, false, null], ["?camOpen=invalid", {}, false, null],
      ["?camOpen=v1", {}, true, null], ["?camOpen=v1", { _urlSeeded: true }, false, null],
      ["?camOpen=v1", { _refPage: "principle" }, false, null],
      ["?camOpen=v1", { _staged: 0 }, false, null], ["?camOpen=v1", { introDone: true }, false, null],
    ]) {
      globalThis.window = { location: { search: query, hash: "" }, __bjjAuth: { isAuthenticated: () => auth } };
      const a = Object.assign(make(), state);
      assert.equal(a._openingPreview()?.variant ?? null, expected);
      a._retireCamOpen();
      assert.equal(a._openingPreview(), null, "never re-enters on a later roll");
    }
  } finally { globalThis.window = old; }
});

test("a gesture kills a queued identity reveal and completion cannot reclaim its camera", () => {
  const old = globalThis.requestAnimationFrame, callbacks = [];
  globalThis.requestAnimationFrame = fn => callbacks.push(fn);
  try {
    const a = make(), text = { style: {} }, sub = { style: {} };
    a.evcTextRef = { current: text }; a.evcSubRef = { current: sub };
    a.evCenterRef = { current: { style: {} } }; a._frameArrivalHeading = () => {};
    const opening = a._camOpen = { variant: "v1", pick: 3.2, cancelled: false };
    a._centerReveal("Mount", "Top", opening);
    callbacks.shift()(); // inner rAF remains queued
    a.cam.cx = 200; a._cancelCamOpen();
    while (callbacks.length) callbacks.shift()();
    assert.equal(text.style.opacity, "0"); assert.equal(sub.style.opacity, "0");
    assert.equal(a.camTarget.cx, 200);
    a._endArrival();
    assert.equal(a._camOpen, null);
    assert.equal(a._camOpenManual, true, "completion releases preview, preserves user's camera");
    a.clearTimers();
    assert.equal(a._camOpenManual, false, "the next deliberate journey releases the hold");
  } finally { globalThis.requestAnimationFrame = old; }
});

test("reduced-motion context snaps in the sole integrator and discards a running flight", () => {
  const a = make(); run(a, 25, { quintic: true, openPhase: "intro", dur: () => 3.2 });
  assert.ok(a._cm.flight);
  a._camStep(dt, { snap: true });
  assert.equal(a.cam.cx, a.camTarget.cx); assert.equal(a.cam.cy, a.camTarget.cy);
  assert.equal(a.cam.vw, a.camTarget.vw); assert.equal(a._cm, null);
});

// ── ROUND 2 (owner U48): the directed opening, `?camOpen=v2s{1,2}z{1,2}` ──────────────────────────
const R2 = new Function("DCLogic", "React", `${knowledgeSource}\n${source}\nreturn { ngOpenZoom, ngBezier, NG_CAM_OPEN2_EASE, NG_CAM_OPEN2_LAND, NG_CAM_OPEN2_RISE, NG_CAM_OPEN2_ANCHOR };`)(class {}, { createRef: () => ({ current: null }) });

test("round-2 zoom curves: endpoints, monotone, Z1 lands at speed, Z2 touches down at rest on its peak", () => {
  const N = 2000, h = 1e-6, d = (f, u) => (f(Math.min(1, u + h)) - f(Math.max(0, u - h))) / (Math.min(1, u + h) - Math.max(0, u - h));
  for (const v0 of [0, 0.15]) {
    const z1 = (u) => R2.ngOpenZoom("z1", u, v0, 0.6);
    assert.equal(z1(0), 0); assert.ok(Math.abs(z1(1) - 1) < 1e-12);
    assert.ok(Math.abs(d(z1, 0) - v0) < 2e-3, "Z1 starts at v0");
    assert.ok(Math.abs(d(z1, 1) - (2 - v0)) < 2e-3, "Z1 lands at 2 - v0");
    for (const up of [0.34, 0.5, 0.632, 0.66]) {
      const z2 = (u) => R2.ngOpenZoom("z2", u, v0, up);
      assert.ok(Math.abs(z2(0)) < 1e-12 && Math.abs(z2(1) - 1) < 1e-9, `Z2 endpoints v0=${v0} up=${up}`);
      let prev = 0, peak = 0, at = 0;
      for (let i = 1; i <= N; i++) {
        const u = i / N, z = z2(u);
        assert.ok(z >= prev - 1e-12, `Z2 monotone at ${u}`); prev = z;
        const v = d(z2, u - 0.5 / N); if (v > peak) { peak = v; at = u; }
      }
      assert.ok(Math.abs(at - up) < 0.01, `Z2 peaks at up (${at} vs ${up})`);
      assert.ok(Math.abs(d(z2, 0) - v0) < 2e-3 && d(z2, 1) < 2e-3, "Z2 starts at v0, lands at rest");
    }
  }
  const e = (x) => R2.ngBezier(R2.NG_CAM_OPEN2_EASE, x);
  assert.equal(e(0), 0); assert.equal(e(1), 1);
  assert.ok(e(1e-3) < 1e-4 && 1 - e(1 - 1e-3) < 1e-4, "the rise departs and settles at rest");
});

test("round-2 switch: four variants, guest-only, and the kind outlives the first token (restarts)", () => {
  const old = globalThis.window;
  try {
    for (const [query, expected] of [["?camOpen=v2s1z1", "v2s1z1"], ["?camOpen=v2s2z2", "v2s2z2"], ["?camOpen=v2s3z1", null], ["?camOpen=v2s1", null]]) {
      globalThis.window = { location: { search: query, hash: "" }, __bjjAuth: { isAuthenticated: () => false } };
      const a = make();
      assert.equal(a._openingPreview()?.variant ?? null, expected);
      assert.equal(a._camOpenKind ?? null, expected);
    }
  } finally { globalThis.window = old; }
});

// A phone-sized world: Mount-like node left of centre, the band framing it at (163, 171).
const directed = (variant) => {
  const a = Object.assign(make(), { W: 390, H: 844, graphW: 1724, ROLL_ZOOM: 0.085, _mdt: dt, currentPos: 0 });
  a.cam = { cx: 0, cy: 0, vw: 1724 * 2.3 }; a.camTarget = { cx: 0, cy: 0, vw: 1724 * 2.3 };
  const q = { x: -265, y: -120 }, Fw = 146.5;
  a.nodes = [{ idx: 0 }]; a.pairMid = () => q;
  a.rollCamTarget = () => ({ cx: q.x + 32 * Fw / 390, cy: q.y + 251 * Fw / 390, vw: Fw, _paneFraction: 0 });
  a._reducedMotion = () => false;
  const op = { variant, pick: null, cancelled: false }, frames = [];
  for (let i = 0; i < 600; i++) {
    a.now = i * dt;
    if (op.pick == null && a.now - op.t0 > 3.2) op.pick = a.now;   // startRoll, as updateCamera calls it
    const pose = a._openingPose(op);
    if (!pose) { frames.push(null); continue; }
    const s = a.W / pose.w;
    frames.push({ t: a.now, pose, node: { x: (q.x - pose.x) * s + 195, y: (q.y - pose.y) * s + 422 }, rise: op.rise });
  }
  return { a, op, frames };
};

test("round-2 path: holds the named node until the board, rises with it, lands exactly, inside the bounds", () => {
  for (const variant of ["v2s1z1", "v2s2z2"]) {
    const { op, frames } = directed(variant);
    const live = frames.filter(Boolean), E = op.pick + 2, last = live.at(-1);
    assert.ok(last.pose.last && Math.abs(last.t - op.land) < dt, "lands at pick + NG_CAM_OPEN2_LAND");
    assert.ok(frames[frames.indexOf(last) + 1] === null, "nothing directs after the landing");
    assert.ok(Math.abs(last.node.x - 163) < 1e-6 && Math.abs(last.node.y - 171) < 1e-6, "lands on the band framing");
    const held = live.filter((f) => f.t >= op.pick + R2.NG_CAM_OPEN2_ANCHOR && f.t < E);
    assert.ok(held.length > 60 && held.every((f) => Math.hypot(f.node.x - held[0].node.x, f.node.y - held[0].node.y) < 1e-6), "no rise before the board");
    // the hand-over at the pick: the node keeps its drift, eases it to rest, never reverses
    const k = live.findIndex((f) => f.t >= op.pick), dv = (i) => ({ x: live[i].node.x - live[i - 1].node.x, y: live[i].node.y - live[i - 1].node.y });
    const v0 = dv(k);
    assert.ok(Math.hypot(v0.x - dv(k - 1).x, v0.y - dv(k - 1).y) < 0.02, "no velocity step at the pick");
    for (let i = k + 1; live[i].t <= op.pick + R2.NG_CAM_OPEN2_ANCHOR; i++) assert.ok(dv(i).x * v0.x + dv(i).y * v0.y >= -1e-9, "the drift never reverses");
    const rising = live.filter((f) => f.t >= E && f.t <= E + R2.NG_CAM_OPEN2_RISE);
    for (let i = 1; i < rising.length; i++) assert.ok(rising[i].node.y <= rising[i - 1].node.y + 1e-9, "the rise only rises");
    let pc = { x: 0, y: 0 }, maxKick = 0, maxMove = 0, prevRate = null, maxJerk = 0;
    for (let i = 1; i < live.length; i++) {
      const p = live[i - 1].pose, f = live[i].pose, s0 = 390 / p.w, s1 = 390 / f.w;
      assert.ok(f.w <= p.w + 1e-9, "the zoom never reverses");
      const c = { x: (p.x - f.x) * s1, y: (p.y - f.y) * s1 };
      maxKick = Math.max(maxKick, Math.hypot(c.x - pc.x, c.y - pc.y)); pc = c;
      maxMove = Math.max(maxMove, ...[[0, 0], [390, 0], [0, 844], [390, 844]].map(([x, y]) => Math.hypot(c.x + (x - 195) * (s1 / s0 - 1), c.y + (y - 422) * (s1 / s0 - 1))));
      const rate = Math.log(f.w / p.w) / dt;
      if (prevRate != null && !f.last) maxJerk = Math.max(maxJerk, Math.abs(rate - prevRate)); prevRate = rate;
    }
    // the landing stop of Z1 included: camera-continuity's phone bounds are KICK 6 and MOVE 48
    assert.ok(maxKick < 6 && maxMove < 48, `${variant} kick ${maxKick} move ${maxMove}`);
    assert.ok(maxJerk < 0.02, `${variant}: the zoom rate is continuous frame to frame (${maxJerk})`);
  }
});

test("round-2 integrator records a directed pose and hands over at rest", () => {
  const a = make();
  a._camStep(dt, { pose: { x: 10, y: 20, w: 1000 } });
  a._camStep(dt, { pose: { x: 12, y: 21, w: 990 } });
  assert.equal(a.cam.cx, 12); assert.equal(a.cam.cy, 21); assert.equal(a.cam.vw, 990);
  assert.ok(a._cm.v.x > 0 && a._cm.v.l < 0, "the chord is its velocity");
  a._camStep(dt, { pose: { x: 13, y: 21, w: 985, last: true } });
  assert.deepEqual(a._cm.v, { x: 0, y: 0, l: 0 });
  assert.equal(a._camFlights ?? 0, 0, "a directed pose never starts a flight");
});

test("round-2 board: S1 fades in place, S2 rides the remaining rise, and nothing outlives it", () => {
  for (const [variant, ty] of [["v2s1z2", ""], ["v2s2z2", "0 120.00px"]]) {
    const a = make(), sec = { isConnected: true, style: { opacity: "", translate: "", transition: "" } };
    a._readerEl = sec; a._layerDockEl = null; a._reducedMotion = () => false; a.now = 2.5;
    const op = a._camOpen = { variant, pick: 0, cancelled: false, rise: 0.4, riseDy: 120 };
    a._openingBoard(op);
    assert.equal(sec.style.opacity, "0.4"); assert.equal(sec.style.translate, ty); assert.equal(sec.style.transition, "none");
    op.rise = 1; op.riseDy = 0; a._openingBoard(op);
    assert.equal(sec.style.opacity, ""); assert.equal(sec.style.translate, ""); assert.equal(sec.style.transition, "");
    assert.equal(op.boardDone, true);
  }
  const a = make(), sec = { isConnected: true, style: { opacity: "", translate: "", transition: "" } };
  a._readerEl = sec; a._layerDockEl = null; a._reducedMotion = () => false; a.now = 2.5;
  a.evCenterRef = { current: { style: {} } };
  const op = a._camOpen = { variant: "v2s2z1", pick: 0, cancelled: false, rise: 0.3, riseDy: 90 };
  a._openingBoard(op); a._cancelCamOpen();
  assert.equal(sec.style.opacity, ""); assert.match(sec.style.transition, /^opacity \.2s/, "a gesture finishes the board in 0.2s");
});

console.log("camera opening: 10 cases (slope bound, rest phases, scope, callback ownership, snap; round 2: curves, switch, path, integrator, board)");
