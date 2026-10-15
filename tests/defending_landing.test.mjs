// v1.227.0: owner's 2026-10-15 journey rule supersedes v1.134.0's orb-arrival rush.
// Only an opponent catch from another state in this active journey carries pressure.
// Browser reachability, the three observed defects and renderer differential live in
// defending-landing.spec.ts; these test provenance and half selection without a DOM.
// Measured mutants: U1 drops the journey equality, U2 drops the stale-entry guard,
// U4 borrows legacy attacker film for an empty defender, and U5 activates
// pressure without opponent proof. Each fails its named assertion here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { knowledgeSource } from "./_knowledge_profile_harness.mjs";

const src = readFileSync(new URL("../neural/src/app.src.jsx", import.meta.url), "utf8");
const Component = new Function("DCLogic", "React", knowledgeSource + "\n" + src + "\nreturn Component;")(class {}, {});
const sub = { idx: 2, pi: 3, ty: "submissions", t: "Submission", role: "attacker" };
const defender = { ...sub, idx: 3, pi: 2, role: "defender" };
function app() {
  const a = Object.create(Component.prototype);
  Object.assign(a, { _journeyId: 7, currentPos: 1, _rollActed: true, nodes: [null, { idx: 1 }, sub, defender] });
  for (const k of ["clearExecution", "killVignette", "fx", "setEvent", "showVignette"]) a[k] = () => {};
  a.splitName = (name) => ({ main: name });
  return a;
}

test("catch provenance requires prior play, another state, and the same journey", () => {
  const a = app();
  assert.equal(a._isLiveCatch(sub, null), false, "being on a defender seat is not evidence of a catch");
  const arrival = a._catchProvenance();
  assert.equal(a._isLiveCatch(sub, arrival), true);
  a._rollActed = false;
  assert.equal(a._isLiveCatch(sub, a._catchProvenance()), false, "play/answer alone is not a roll move");
  a._rollActed = true;
  for (const idx of [2, 3]) {
    a.currentPos = idx;
    assert.equal(a._isLiveCatch(sub, a._catchProvenance()), false, "either half is the same submission state");
  }
  a.clearEngagement();
  assert.equal(a._isLiveCatch(sub, arrival), false, "navigation invalidates the captured journey");
  assert.equal(a._defensePressure, false);
  a._defendSub = sub.idx;
  a._startDefensePressure();
  assert.equal(a._defensePressure, false, "an activation without opponent provenance cannot create pressure");
  // A late callback must not even clear the new journey's execution or seat it elsewhere.
  a.clearExecution = () => { throw new Error("stale callback mutated the new journey"); };
  a.enterDefense(sub.idx, arrival);
  console.log("# defending provenance: 8 assertions");
});

test("the selected half owns films before and after the land slot is cleared", () => {
  const a = app();
  const info = { clips: [{ id: "legacy-attacker" }], perspectives: {
    attacker: { authored: true, clips: [{ id: "attack" }] }, defender: { authored: true, clips: [{ id: "escape" }] },
  } };
  a._stagedTech = { idx: defender.idx, side: "defender" };
  for (const idx of [null, defender.idx, sub.idx]) {
    a._landIdx = idx;
    assert.equal(a._landPerspSide(defender), "defender");
    assert.deepEqual(a._landFilmClips(defender, info), [{ id: "escape" }]);
  }
  a._stagedTech = null;
  assert.deepEqual(a._landFilmClips(defender, info), [{ id: "escape" }], "live catches use the same fixed half");
  info.perspectives.defender.clips = [];
  assert.equal(a._landFilmClips(defender, info), null, "no empty strip and no fallback to attacker clips");
  delete info.perspectives.defender;
  assert.equal(a._landFilmClips(defender, info), null, "unauthored defender blocks cannot inherit attacker film");
  console.log("# defending films: 9 assertions");
});

test("danger animation is a visual preference, intersected with live provenance and reduced motion", () => {
  const a = app();
  let on = true, reduced = false;
  a.get = (key, fallback) => key === "dangerAnimation" ? on : fallback;
  a._reducedMotion = () => reduced;
  a._defensePressure = false;
  assert.equal(a._dangerAnimationOn(), false);
  a._defensePressure = true;
  assert.equal(a._dangerAnimationOn(), true);
  on = false;
  assert.equal(a._dangerAnimationOn(), false);
  on = true; reduced = true;
  assert.equal(a._dangerAnimationOn(), false);
  assert.equal(on, true, "OS preference never overwrites the stored setting");
  console.log("# danger preference: 5 assertions");
});

// Review S2: an actual tick in reader intent used to query .ng-logo and rewrite
// logo/card styles every frame. Count writes at the DOM boundary, not sync calls.
test("unchanged danger ticks do no DOM work; motion is cached and change-driven", () => {
  const oldWindow = globalThis.window;
  const writes = [], queries = [], listeners = new Map();
  let mediaQueries = 0;
  const media = { matches: false, addEventListener: (event, fn) => listeners.set(event, fn) };
  globalThis.window = { matchMedia: () => { mediaQueries++; return media; } };
  try {
    const a = app(), style = new Proxy({}, { set: (target, key, value) => { writes.push([key, value]); target[key] = value; return true; } });
    a.get = (key, fallback) => a.settings?.[key] ?? fallback;
    a._saveProgress = () => {};
    a.wrapRef = { current: { querySelector: selector => { queries.push(selector); return { style }; } } };
    a._landEl = { style, classList: { remove: name => writes.push(name) } };
    a._landMode = "defense"; a._defendSub = sub.idx; a._readerIntent = true;
    a.showVignette = () => { writes.push("show"); a._vignetteEl = { remove: () => writes.push("remove") }; };
    for (let i = 0; i < 122; i++) a._tickDecision(1 / 122);
    assert.equal(writes.length, 0, "calm ticks never rewrite unchanged danger styles");
    assert.deepEqual(queries, [], "calm ticks never look up the logo");
    a._defensePressure = true; a._syncDangerAnimation();
    assert.equal(writes.filter(x => x === "show").length, 1);
    const unchanged = () => {
      const before = [writes.length, queries.length, mediaQueries];
      for (let i = 0; i < 122; i++) { a._tickDecision(1 / 122); a._syncDangerAnimation(); }
      assert.deepEqual([writes.length, queries.length, mediaQueries], before, "unchanged ticks/events do no DOM work or media queries");
    };
    unchanged();
    media.matches = true; listeners.get("change")();
    assert.equal(a._vignetteEl, null, "OS change removes danger immediately, without a tick");
    assert.equal(a._defensePressure, true);
    unchanged();
    media.matches = false; listeners.get("change")();
    assert.equal(writes.filter(x => x === "show").length, 2);
    a.set("dangerAnimation", false);
    assert.equal(a._vignetteEl, null, "the setting removes danger immediately, without a tick");
    unchanged();
    assert.equal(mediaQueries, 1, "one MediaQueryList for the component lifetime");
    console.log("# danger synchronization: 12 assertions, 610 unchanged ticks, 1 media query");
  } finally { if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow; }
});
