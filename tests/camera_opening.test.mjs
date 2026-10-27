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

console.log("camera opening: 5 cases (slope bound, rest phases, scope, callback ownership, snap)");
