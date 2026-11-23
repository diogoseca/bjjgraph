// THE LIGHT (L2b S1, v1.295.0): neural/src/map-light.src.js, its pure parts, and the app's own reading of WHEN the map is lit
// and how it comes and goes (`_lightOf`, `_lightMoves`, `_drawLight` in app.src.jsx), on the app class with this worktree's
// payload. What a player sees, by the ink, is pinned by e2e/journeys/map-light.spec.ts.
//
// MUTANTS (each applied alone, red on the named test; the clean files green before and after; the table and its dates are
// in docs/Changelog-Archive.md, v1.295.0):
//   ML1 a move narrower than 2.5 px is a hole (no mark)                → "a move drawn 2.5 px wide or more is a hole…"
//   ML2 the place a mark when it is small                               → "the place is a hole at any size"
//   ML3 a face-down move's mark is gold                                → "a mark is gold only where the map's own line is gold…"
//   ML4 a hole's radius without its 12 px floor                        → "a hole's radius…"
//   ML5 the two fills at the layer's whole alpha each (0.64, not 0.4)  → "the two fills compose to the layer's 40%"
//   ML6 the light over a running game (`_lightOf` without `paused`)    → "never over a running game"
//   ML7 the light under a phone's open drawer                          → "never under a phone's open drawer"
//   ML8 the fade at once without reduced motion                        → "it comes in over a quarter of a second…"
//   ML9 the fade kept under reduced motion                             → "under reduced motion it is on and off at once"
//   ML10 the light never goes out (its target stuck at 1)              → "…and goes out over four tenths, keeping the place"
//   ML11 gameplan.js not in, and nothing said                          → "gameplan.js not in yet: nothing drawn, said once a show"
//   ML12 three of a lit position's hand, not all of it                → "a lit position's moves are the hand it deals…"
//   ML13 a light at its target steps down (the first cut's flicker)     → "a full light stays full, frame after frame"
// S1-R1 (23 Nov 2026, the reader of PR #447 and the orchestrator's rulings 2 and 4):
//   ML14 the fade kept over a running game (no "out at once")           → "out at once when the game starts again…"
//   ML15 the cold path ramps the strength (the planner lands at full)   → "the planner arriving late…"
//   ML16 the look not tied to its row (`_shownRow` always yes)          → "the look ends with its row…"
//   ML17 Last rolls not read (`_viewMode` dropped from `_shownRow`)      → "the look ends with its row…", at "Explore"
// ML6 SINCE S1-R1 SURVIVES, AND IS COVERED TWICE: with `paused` dropped from `_lightOf`, ruling 4's own line in `_drawLight`
// (`running`: the game runs, so the strength is 0) still puts out a light over a running game; ML14 is that line's killer.
// Both guards stay: `_lightOf` also decides which place the fade keeps (`_lightAt`) and when `light_cold` is said.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { NG_LIGHT, ngLightPlan, ngLightAlpha } from "../neural/src/map-light.src.js";
import { ratingApp } from "./_rating_fixture.mjs";

const DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../source/quartz/static/neural");
const pt = (i, hw, o = {}) => ({ i, x: 100 + i, y: 80, hw, place: false, gold: false, down: false, ...o });

test("a move drawn 2.5 px wide or more is a hole; narrower, a mark above the layer", () => {
  const P = ngLightPlan([pt(1, 1.25), pt(2, 1.24), pt(3, 4)]);
  assert.deepEqual(P.holes.map((h) => h.i), [1, 3], "1.25 px half-width is 2.5 px wide: a hole");
  assert.deepEqual(P.marks.map((m) => m.i), [2], "narrower than 2.5 px: a mark");
});

test("the place is a hole at any size", () => {
  const P = ngLightPlan([pt(1, 0.4, { place: true }), pt(2, 0.4)]);
  assert.deepEqual(P.holes.map((h) => [h.i, h.place]), [[1, true]]);
  assert.deepEqual(P.marks.map((m) => m.i), [2]);
});

test("a hole's radius is 2.4 times the orb's drawn half-width, and never under 12 px", () => {
  const [small, big] = ngLightPlan([pt(1, 2), pt(2, 8)]).holes;
  assert.equal(small.r, 12, "4.8 px would be smaller than the orb's own halo: 12");
  assert.equal(big.r, 8 * 2.4);
  assert.equal(NG_LIGHT.holeMin, 12); assert.equal(NG_LIGHT.holeK, 2.4);
});

test("a mark is gold only where the map's own line is gold and the card is not face down; a hidden move's mark is pale", () => {
  const P = ngLightPlan([pt(1, 1, { gold: true }), pt(2, 1, { gold: true, down: true }), pt(3, 1), pt(4, 1, { down: true })]);
  assert.deepEqual(P.marks.map((m) => [m.i, m.gold]), [[1, true], [2, false], [3, false], [4, false]]);
});

test("the two fills compose to the layer's 40% of rgb(7, 8, 16), at full light and through the fade", () => {
  assert.deepEqual(NG_LIGHT.rgb, [7, 8, 16]); assert.equal(NG_LIGHT.a, 0.4);
  for (const k of [1, 0.5, 0.1]) {
    const f = ngLightAlpha(k);
    assert.ok(Math.abs((1 - (1 - f) ** 2) - 0.4 * k) < 1e-12, "two fills of " + f + " are " + 0.4 * k + " at k " + k);
  }
  assert.equal(ngLightAlpha(0), 0);
});

// ── THE APP: when the map is lit, and how it comes and goes ──
// The app class, built the census way, with a runtime that records what it was asked to draw (the draw itself is the
// journey's). The input is what the light rides: a place shown by "Show on the map" (`_shown` with the look's hold, the
// one `_shownNode` reads on a phone) and the game held or not; the clock is the frame clock a test pumps (`now`).
function lit(opts = {}) {
  const a = ratingApp(DIR, "gi", { live: false });
  const drawn = [];
  a._gameplanRuntime = opts.cold ? null : { ngLightDraw: (_app, _ctx, F) => { drawn.push(F); return { k: F.k, place: F.place.idx, holes: [], marks: [] }; } };
  a.W = opts.W || 1440; a.H = 900; a.deckShown = !!opts.drawer; a.paused = opts.paused !== false;
  a._reducedMotion = () => !!opts.reduced;
  a.camHeld = () => false;
  const mount = a.nodes[a.nodeForKey("Mount|Top")];
  a._shown = { i: mount.idx, t: null }; a._lookAutoPaused = true;
  a.now = 10;
  const frame = (ms) => { a.now += ms / 1000; a._drawLight(null, {}); return a._lastLight; };
  // the map draws every frame, so the light always has the last frame's clocks; the first frame here has none (no step)
  const shown = a._shown; a._shown = null; frame(0); a._shown = shown;
  return { a, drawn, frame, mount };
}

test("a full light stays full, frame after frame", () => {
  const { frame } = lit();
  frame(400);
  for (const ms of [16, 16, 33, 500, 16]) assert.equal(frame(ms).k, 1, "at its target the light does not step (" + ms + " ms)");
});

test("never over a running game: a shown place is lit only while the game is held", () => {
  const { a, frame } = lit();
  assert.equal(frame(500).k, 1, "premise: held, the shown place is lit");
  a.paused = false;
  frame(500);
  assert.equal(a._lastLight, null, "the game runs: nothing is lit");
});

test("never under a phone's open drawer (it is the screen there, and no name is written under it either)", () => {
  const phone = lit({ W: 390, drawer: true });
  assert.equal(phone.frame(500), null, "a phone with its drawer open: nothing");
  const desk = lit({ W: 1440, drawer: true });
  assert.equal(desk.frame(500).k, 1, "a computer's drawer stands beside the map: lit");
});

test("out at once when the game starts again, and when a film takes the map; the fade out is for a hold that ends held", () => {
  const { a, frame } = lit();
  assert.equal(frame(400).k, 1, "premise: held, lit in full");
  a.paused = false;
  assert.equal(frame(16), null, "the game runs: out on the very next frame, not over 400 ms");
  assert.equal(a._lightK, 0, "and its strength is 0, so nothing fades back in from where it was");
  const f = lit();
  assert.equal(f.frame(400).k, 1, "premise: lit again");
  f.a._replay = { ts: 1 };
  assert.equal(f.frame(16), null, "a film plays: out at once (the clock is held for the film)");
});

test("the look ends with its row, or with Last rolls: the name goes, and the light fades out over 400 ms", () => {
  const { a, frame } = lit();
  a._viewMode = "history"; a._openRow = "c0"; a._shown.rid = "c0";
  assert.equal(frame(400).k, 1, "premise: shown from an open row of Last rolls, lit");
  a._openRow = null;   // the row pressed again: collapsed
  assert.equal(a._shownNode(), null, "the row collapsed: the place is no longer shown (and so not named)");
  const l = frame(100);
  assert.ok(l && Math.abs(l.k - 0.75) < 0.02, "the game is still held: out over 400 ms (100 ms: 0.75, " + (l && l.k) + ")");
  const b = lit();
  b.a._viewMode = "history"; b.a._openRow = "c0"; b.a._shown.rid = "c0";
  assert.equal(b.frame(400).k, 1, "premise: lit again");
  b.a._viewMode = "explore";   // the drawer switched to Explore
  assert.equal(b.a._shownNode(), null, "Last rolls left for Explore: no longer shown");
  const c = lit();
  c.a._viewMode = "history"; c.a._openRow = "c0"; c.a._shown.rid = "c0";
  assert.equal(c.frame(400).k, 1, "premise: lit again");
  c.a._session = { keys: [] };   // Practise here: Master the game takes the drawer
  assert.equal(c.a._shownNode(), null, "a study surface over Last rolls: no longer shown");
  const d = lit();
  assert.equal(d.frame(400).k, 1, "a place shown with no row (a test's own call) is not tied to one");
});

test("the planner arriving late: the light comes in over its quarter second from when it can first be drawn", () => {
  const { a, frame } = lit({ cold: true });
  frame(300); frame(300); frame(300);
  assert.equal(a._lightK, 0, "while it cannot be drawn its strength waits at 0");
  a._gameplanRuntime = { ngLightDraw: (_app, _ctx, F) => ({ k: F.k, place: F.place.idx, holes: [], marks: [] }) };
  const l = frame(100);
  assert.ok(l && Math.abs(l.k - 0.4) < 0.02, "the first frame it can be drawn: 100 ms of 250, 0.4, not full (" + (l && l.k) + ")");
});

test("it comes in over a quarter of a second on the frame clock", () => {
  const { frame } = lit();
  frame(0);
  assert.ok(Math.abs(frame(100).k - 0.4) < 0.02, "100 ms of 250: 0.4");
  assert.equal(frame(200).k, 1, "and full after 250");
});

test("…and goes out over four tenths, keeping the place it lit", () => {
  const { a, frame, mount, drawn } = lit();
  frame(400);
  a._lookAutoPaused = false;   // the look is over (and no lease): `_shownNode` lets the place go
  const l = frame(100);
  assert.ok(Math.abs(l.k - 0.75) < 0.02, "100 ms of 400: 0.75 (" + l.k + ")");
  assert.equal(drawn[drawn.length - 1].place.idx, mount.idx, "still the place it lit");
  frame(400);
  assert.equal(a._lastLight, null, "out after 400 ms");
});

test("under reduced motion it is on and off at once", () => {
  const { a, frame } = lit({ reduced: true });
  frame(0);
  assert.equal(a._lastLight.k, 1, "on the first frame");
  a.paused = false; frame(0);
  assert.equal(a._lastLight, null, "off on the first frame");
});

test("gameplan.js not in yet: nothing drawn, said once a show (`light_cold`)", () => {
  const { a, frame } = lit({ cold: true });
  frame(300); frame(300); frame(300);
  assert.equal(a._lastLight, null);
  assert.equal(a.beats.filter((b) => b.beat === "light_cold").length, 1, "said once");
  a._shown = { i: a._shown.i, t: null };   // a second press of "Show on the map": a new show
  frame(300);
  assert.equal(a.beats.filter((b) => b.beat === "light_cold").length, 2, "and once again for the next show");
});

test("a lit position's moves are the hand it deals in this ruleset; a submission's are none", () => {
  const { a, frame, drawn, mount } = lit();
  frame(300);
  const hand = [...new Set((a._dealtOpts(mount.idx, "top") || []).map((o) => o.idx))];
  assert.ok(hand.length > 2, "premise: Mount, top deals a hand");
  assert.deepEqual([...drawn[drawn.length - 1].moves].sort((x, y) => x - y), hand.sort((x, y) => x - y));
  assert.ok(drawn[drawn.length - 1].moves.every((i) => a.rsAllowsIdx(i)), "every one drawn in this ruleset");
  const sub = a.nodes.find((n) => n.ty === "submissions" && a.rsAllowsIdx(n.idx));
  a._shown = { i: sub.idx, t: null };
  frame(300);
  assert.deepEqual(drawn[drawn.length - 1].moves, [], "a submission a roll passed through: its pair alone");
});
