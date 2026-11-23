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
// S2 (v1.296.0, a cloze's place on the map):
//   CZ1 the place on a phone too (`_czAt` without its computer clause)  → "an open cloze's place: the half its seat plays…"
//   CZ2 the place with the drawer shut (no `_sessionInline`)            → the same test
//   CZ3 lit before Show                                                → "a cloze's place is lit from Show until Hide or Done…"
//   CZ4 lit after Done                                                 → the same test
//   CZ5 the glide every time (no "already in view")                    → "the glide: none when the place and its moves are in view…"
//   CZ6 the glide closer than the roll's zoom                          → "…and never closer than the roll's zoom"
// S3 (v1.297.0, a phone's look from the cloze):
//   LK1 a hidden move a hole in the look (no pale rule)                → "a phone's look: a hidden move is a pale mark at any size…"
//   LK2 the look not ended by its drawer opening (`_czLookOn` without `deckShown`) → "the look lasts while…: and only while"
//   LK3 …nor by the game running                                       → the same test
//   LK4 …nor by Done                                                   → the same test
//   LK5 the look lit only after Show                                   → "during the look the place is lit before Show too…"
//   LK6 the hand let up during the look (`_czDown` without the look)   → the same test
//   LK7 the look taken without the drawer's pause handed over (`_paneAutoPaused` kept) → "opening the look: the drawer shuts…"
// S3-R1 (23 Nov 2026; the reader of PR #453 and the orchestrator's ruling 4):
//   LK8 a look lost with no lifter keeps the clock (`_czLookSync` doing nothing) → "the clock's hold follows the look…"
//   LK9 a band measured for another size read as this view's (`_viewRect` without the size check) → "a band measured for…"
// S1-R1 (23 Nov 2026, the reader of PR #447 and the orchestrator's rulings 2 and 4):
//   ML14 the fade kept over a running game (no "out at once")           → "out at once when the game starts again…"
//   ML15 the cold path ramps the strength (the planner lands at full)   → "the planner arriving late…"
//   ML16 the look not tied to its row (`_shownRow` always yes)          → "the look ends with its row…"
//   ML17 Last rolls not read (`_viewMode` dropped from `_shownRow`)      → "the look ends with its row…", at "Explore"
//   ML18 (S2) the drawer shut not read on a computer                    → "the look ends with its row…", at "the drawer shut"
//   ML19 (S2-R1) the look's place read from the width, not where it began → the same test, at "turned to landscape"
// ML6 SINCE S1-R1 SURVIVES, AND IS COVERED TWICE: with `paused` dropped from `_lightOf`, ruling 4's own line in `_drawLight`
// (`running`: the game runs, so the strength is 0) still puts out a light over a running game; ML14 is that line's killer.
// Both guards stay: `_lightOf` also decides which place the fade keeps (`_lightAt`) and when `light_cold` is said.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { NG_LIGHT, ngLightPlan, ngLightAlpha, ngLightFrame } from "../neural/src/map-light.src.js";
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
  const { a, frame } = lit({ drawer: true });
  a._viewMode = "history"; a._openRow = "c0"; a._shown.rid = "c0";
  assert.equal(frame(400).k, 1, "premise: shown from an open row of Last rolls, lit");
  a._openRow = null;   // the row pressed again: collapsed
  assert.equal(a._shownNode(), null, "the row collapsed: the place is no longer shown (and so not named)");
  const l = frame(100);
  assert.ok(l && Math.abs(l.k - 0.75) < 0.02, "the game is still held: out over 400 ms (100 ms: 0.75, " + (l && l.k) + ")");
  const b = lit({ drawer: true });
  b.a._viewMode = "history"; b.a._openRow = "c0"; b.a._shown.rid = "c0";
  assert.equal(b.frame(400).k, 1, "premise: lit again");
  b.a._viewMode = "explore";   // the drawer switched to Explore
  assert.equal(b.a._shownNode(), null, "Last rolls left for Explore: no longer shown");
  const c = lit({ drawer: true });
  c.a._viewMode = "history"; c.a._openRow = "c0"; c.a._shown.rid = "c0";
  assert.equal(c.frame(400).k, 1, "premise: lit again");
  c.a._session = { keys: [] };   // Practise here: Master the game takes the drawer
  assert.equal(c.a._shownNode(), null, "a study surface over Last rolls: no longer shown");
  const d = lit();
  assert.equal(d.frame(400).k, 1, "a place shown with no row (a test's own call) is not tied to one");
  // S2 (the orchestrator's ruling on the reader's re-read of PR #447): on a computer the drawer shut ends it; a phone keeps it
  const e = lit({ drawer: true });
  e.a._viewMode = "history"; e.a._openRow = "c0"; e.a._shown.rid = "c0";
  assert.equal(e.frame(400).k, 1, "premise: a computer, the drawer open on Last rolls: lit");
  e.a.deckShown = false;
  assert.equal(e.a._shownNode(), null, "a computer, the drawer shut: Last rolls is out of sight, the look is over");
  const f = lit({ W: 390 });
  f.a._viewMode = "history"; f.a._openRow = "c0"; f.a._shown.rid = "c0"; f.a._shown.phone = true;   // (`_showPlace` marks a look begun on a phone)
  assert.equal(f.frame(400).k, 1, "a phone, the drawer shut: that is its look, lit");
  // S2-R1 (ruling 3): a look begun on a phone keeps its place whatever the width (turned to 844x390 it is no longer "mobile")
  f.a.W = 844;
  assert.equal(f.frame(16).k, 1, "turned to landscape, the look begun on a phone is still lit");
  f.a.W = 390;
  assert.equal(f.frame(16).k, 1, "and turned back");
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

// ── S2 (v1.296.0): A CLOZE'S PLACE ON THE MAP ──
// The app class with this payload and a session that holds an open cloze, as master-cloze.src.js builds one (`seat`, `side`,
// `shown`, `done`, `rows`); the drawer showing it (`_sessionInline`: the drawer shown, a session, no card study).
function clozed(opts = {}) {
  const a = ratingApp(DIR, "gi", { live: false });
  a.W = opts.W || 1440; a.H = 900; a.deckShown = opts.drawer !== false; a.deck = null; a._checkpoint = null; a.paused = true;
  const seat = opts.seat || "Mount|Bottom", hub = a.nodeForKey(seat), side = seat.endsWith("|Bottom") ? "bottom" : "top";
  const hand = [...new Set((a._dealtOpts(hub, side) || []).map((o) => o.idx))];
  const c = { seat, side, shown: false, done: null, rows: hand.slice(0, 6).map((idx, k) => ({ id: "m" + k, idx, ask: true })) };
  c.down = new Set(c.rows.flatMap((r) => [r.idx, a.nodes[r.idx].pi].filter((i) => i >= 0)));   // as the builder makes it (master-cloze.src.js)
  a._session = { czOpen: seat, cz: new Map([[seat, c]]) };
  return { a, c, hub, hand };
}

test("an open cloze's place: the half its seat plays, on a computer, while the drawer shows the cloze", () => {
  const { a, hub } = clozed({ seat: "Mount|Bottom" });
  const z = a._czAt();
  assert.ok(z, "a cloze open in the drawer beside the map: its place");
  assert.equal(z.n.idx, a._seatMember(hub, "bottom"), "the half the seat plays (Mount, bottom)");
  assert.equal(z.n.role, "bottom");
  assert.equal(clozed({ W: 390 }).a._czAt(), null, "a phone: the drawer is the screen (S3's look)");
  assert.equal(clozed({ drawer: false }).a._czAt(), null, "the drawer shut: the cloze is not on screen");
  const shut = clozed(); shut.a._session.czOpen = null;
  assert.equal(shut.a._czAt(), null, "no cloze open: none");
});

test("a cloze's place is lit from Show until Hide or Done, never over a running game", () => {
  const { a, c } = clozed();
  assert.equal(a._lightOf(), null, "before Show: no light");
  c.shown = true;
  assert.equal(a._lightOf()?.idx, a._czAt().n.idx, "after Show: the place");
  a.paused = false;
  assert.equal(a._lightOf(), null, "the game runs: none");
  a.paused = true; c.shown = false;
  assert.equal(a._lightOf(), null, "Hide: none");
  c.shown = true; c.done = { u: null, rows: new Map() };
  assert.equal(a._lightOf(), null, "Done: none");
});

// the glide (`ngLightFrame`): the calm area is the visible map (`_viewRect`, here the whole 1440x900 frame) inset by NG_LIGHT.calm
function framed(a) {
  a.ROLL_ZOOM = 0.085;   // a class field: the fixture builds the class without running its initialisers
  a._viewRect = () => ({ left: 0, top: 0, width: a.W, height: a.H });
  const at = (idxs) => {
    const T = a.camTarget, sc = a.W / T.vw, [l, t, r, b] = NG_LIGHT.calm;
    return idxs.every((i) => { const p = a.pairMid(a.nodes[i]), x = (p.x - T.cx) * sc + a.W / 2, y = (p.y - T.cy) * sc + a.H / 2; return x >= l && x <= a.W - r && y >= t && y <= a.H - b; });
  };
  return at;
}
test("the glide: none when the place and its moves are in view, one when they are not", () => {
  const { a, hand, hub } = clozed({ seat: "Mount|Top" });
  const inView = framed(a), set = [hub].concat(hand.slice(0, 6));
  a.camTarget = { cx: a.nodes[hub].x + a.graphW, cy: a.nodes[hub].y, vw: a.graphW * 0.3 };
  assert.equal(inView(set), false, "premise: the camera is elsewhere");
  assert.equal(ngLightFrame(a, set), true, "one glide");
  assert.equal(inView(set), true, "after it the place and its moves are in the calm area");
  const T = { ...a.camTarget };
  assert.equal(ngLightFrame(a, set), false, "asked again with all of it in view: no glide");
  assert.deepEqual(a.camTarget, T, "and the camera's target is as it was");
});
test("…and never closer than the roll's zoom", () => {
  const { a, hand, hub } = clozed({ seat: "Mount|Top" });
  framed(a);
  const n = a.nodes[hub], near = hand.map((i) => a.nodes[i]).sort((p, q) => Math.hypot(p.x - n.x, p.y - n.y) - Math.hypot(q.x - n.x, q.y - n.y))[0];
  a.camTarget = { cx: n.x + a.graphW, cy: n.y, vw: a.graphW };
  ngLightFrame(a, [hub, near.idx]);
  assert.ok(Math.abs(a.camTarget.vw - a.graphW * 0.085) < 1e-9, "a place and its nearest move fit closer: the view stays at the roll's zoom (" + (a.camTarget.vw / a.graphW).toFixed(4) + ")");
  a.camTarget = { cx: n.x, cy: n.y, vw: a.graphW * 0.05 };
  assert.equal(ngLightFrame(a, [hub, near.idx]), true, "in view but closer than the roll's zoom: it glides out to it");
  assert.ok(a.camTarget.vw >= a.graphW * 0.085 - 1e-9);
});

// ── S3 (v1.297.0): A PHONE'S LOOK FROM THE CLOZE ──
test("a phone's look: a hidden move is a pale mark at any size, never gold; a shown move as before", () => {
  const P = ngLightPlan([pt(1, 4, { down: true, pale: true, gold: true }), pt(2, 4, { gold: true }), pt(3, 0.5, { gold: true })]);
  assert.deepEqual(P.holes.map((h) => h.i), [2], "a shown move drawn 8 px wide: a hole");
  assert.deepEqual(P.marks.map((m) => [m.i, m.gold, m.pale]), [[1, false, true], [3, true, false]], "the hidden one a pale mark (8 px wide or not), the small shown one gold");
});
function looked(opts = {}) {
  const x = clozed({ W: 390, ...opts });
  x.a.fx = function (beat, props) { (this.beats = this.beats || []).push({ beat, ...(props || {}) }); };
  x.a.setDeckOpen = function (open) { this.deckOpen = !!open; this.deckShown = !!open; };   // the drawer's own seam, without its DOM
  x.a._paneAutoPaused = opts.held !== false;
  return x;
}
test("opening the look: the drawer shuts, the session and its cloze are kept, the clock is the look's", () => {
  const { a, c } = looked();
  const s = a._session;
  assert.equal(a._czLookOpen(s), true);
  assert.equal(a.deckShown, false, "the drawer is shut");
  assert.equal(a._session, s, "the session is the same");
  assert.equal(s.czOpen, c.seat, "and its cloze is open");
  assert.equal([a.paused, a._lookAutoPaused, a._paneAutoPaused].join(), "true,true,false", "the drawer's pause is the look's");
  assert.equal(a._czLookOn(), true);
  const desk = looked({ W: 1440 });
  assert.equal(desk.a._czLookOpen(desk.a._session), false, "a computer has no look: the map is beside the drawer");
  const still = looked({ held: false });
  still.a._czLookOpen(still.a._session);
  assert.equal(!!still.a._lookAutoPaused, false, "a board that was already still is not the look's");
  assert.equal(still.a._czLookOn(), true, "and the look is on there all the same");
});
test("the clock's hold follows the look: a look that ends by no lifter (the session dropped under it) hands the clock back as its pill would", () => {
  const x = looked(); x.a._czLookOpen(x.a._session);
  assert.equal([x.a.paused, x.a._lookAutoPaused, x.a._czLookOn()].join(), "true,true,true", "premise: a look holding the clock");
  x.a._session = null;   // the day's session ending under the shut drawer (the reader's stand-in)
  assert.equal(x.a._czLookOn(), false, "premise: the look is off");
  x.a._czLookSync();
  assert.equal(x.a._lookAutoPaused, false, "the look's hold on the clock goes with it");
  assert.equal([x.a.deckShown, x.a._paneAutoPaused, x.a.paused].join(), "true,true,true", "handed back as the pill hands it: the drawer back, its pause the drawer's");
  assert.ok((x.a.beats || []).some((b) => b.beat === "cz_look_lost"), "and said (`cz_look_lost`)");
  const y = looked(); y.a._czLookOpen(y.a._session); y.a._czLookSync();
  assert.equal([y.a._lookAutoPaused, y.a.deckShown].join(), "true,false", "a look still on is left as it is");
  const z = looked(); z.a._czLookOpen(z.a._session); z.a._session.czOpen = "Side Control|Bottom"; z.a._czLookSync();
  assert.equal([z.a._lookAutoPaused, z.a.deckShown].join(), "false,true", "nor does another place opened under it keep the clock");
});

test("a band measured for another size is not this view's: a phone turned to landscape frames against its own strip", () => {
  const { a } = looked();
  a.W = 844; a.H = 390;
  a._reader = { nodeBand: { top: 72, bottom: 258, height: 186 }, nodeBandAt: "390x631" };   // the portrait band, its layout not run yet
  assert.equal(a._viewRect().height, 64, "the reader's band was measured at 390x631: the view reads its own, 64 px");
  a._reader.nodeBand = { top: 70, bottom: 134, height: 64 }; a._reader.nodeBandAt = "844x390";
  assert.equal(a._viewRect().top, 70, "measured for this size, the reader's band is the view's");
});

test("the look lasts while the drawer is shut, the game held and the cloze not confirmed: and only while", () => {
  const mk = () => { const x = looked(); x.a._czLookOpen(x.a._session); return x; };
  let x = mk(); x.a.deckShown = true;
  assert.equal(x.a._czLookOn(), false, "the drawer opened, by any door");
  x = mk(); x.a.paused = false;
  assert.equal(x.a._czLookOn(), false, "the game runs");
  x = mk(); x.c.done = { u: null, rows: new Map() };
  assert.equal(x.a._czLookOn(), false, "the cloze confirmed");
  x = mk(); x.a._session = { czOpen: x.c.seat, cz: new Map([[x.c.seat, x.c]]) };
  assert.equal(x.a._czLookOn(), false, "another session");
  x = mk(); x.a._lookEnd("roll");
  assert.equal(x.a._czLookOn(), false, "any lifter of the look's latch ends it too");
});
test("during the look the place is lit before Show too, its hidden moves held down; the way back opens the drawer", () => {
  const { a, c } = looked();
  a._czLookOpen(a._session);
  assert.equal(c.shown, false, "premise: before Show");
  assert.equal(a._lightOf()?.idx, a._czAt().n.idx, "lit for as long as the look lasts");
  assert.ok(a._czDown() && c.rows.every((r) => a._czDown().has(r.idx)), "its hidden moves stay down while the drawer is shut");
  assert.equal(a._czLookBack("pill"), true);
  assert.equal(a.deckShown, true, "the way back opens the drawer");
  assert.equal(a._czLookOn(), false, "and the look is over");
  assert.equal(a._czLookBack("pill"), false, "a second way back finds no look");
});
