// THE CAMERA'S MOTION LAW, without a browser (v1.219.0). `_camStep` is driven directly at 60 fps
// and every frame is read the way draw() reads it (scale = W / vw). The browser half — the real
// flights, the rows, the pane, the mouse — is e2e/journeys/camera-continuity.spec.ts; these units
// pin the law that spec measures, so a push to dev (which runs no Playwright) still checks it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { knowledgeSource } from "./_knowledge_profile_harness.mjs";

const source = readFileSync(new URL("../neural/src/app.src.jsx", import.meta.url), "utf8");
const Component = new Function("DCLogic", "React", `${knowledgeSource}\n${source}\nreturn Component;`)(
  class {}, { createRef: () => ({ current: null }) },
);

const W = 1440, H = 900, GW = 16000, ROLL = GW * 0.085, DT = 1 / 60;
function app() {
  const a = Object.create(Component.prototype);
  a.W = W; a.H = H; a.graphW = GW; a.now = 0;
  return a;
}
/** The view that puts world point p at screen point (sx, sy) with view width w. */
const frameAt = (p, sx, sy, w) => ({ cx: p.x - (sx - W / 2) * w / W, cy: p.y - (sy - H / 2) * w / W, vw: w });
/** Per-frame motion a viewer sees: max corner displacement, zoom ratio, centre kick (spec header). */
function motion(views, width = W) {
  let move = 0, kick = 0, zoom = 1, prev = [0, 0];
  for (let i = 1; i < views.length; i++) {
    const a = views[i - 1], b = views[i], s0 = width / a.vw, s1 = width / b.vw;
    for (const [px, py] of [[0, 0], [width, 0], [0, H], [width, H]]) {
      move = Math.max(move, Math.hypot((a.cx - b.cx) * s1 + (px - width / 2) * (s1 / s0 - 1), (a.cy - b.cy) * s1 + (py - H / 2) * (s1 / s0 - 1)));
    }
    const c = [(a.cx - b.cx) * s1, (a.cy - b.cy) * s1];
    kick = Math.max(kick, Math.hypot(c[0] - prev[0], c[1] - prev[1])); prev = c;
    zoom = Math.max(zoom, s1 / s0, s0 / s1);
  }
  return { move, kick, zoom };
}
const run = (a, frames, ctx) => {
  const out = [{ ...a.cam }];
  for (let i = 0; i < frames; i++) { a.now += DT; a._camStep(DT, ctx ? ctx(a) : {}); out.push({ ...a.cam }); }
  return out;
};

test("a far destination is a FLIGHT: it starts at rest, zooms out and back, and never teleports", () => {
  const a = app();
  const A = { x: 0, y: 0 }, B = { x: 6728 * ROLL / W, y: -1100 * ROLL / W };   // Explore -> Mount, measured
  a.cam = { ...frameAt(A, 634, 132, ROLL), lvw: Math.log(ROLL) };
  a.camTarget = frameAt(B, 634, 132, ROLL);
  const v = run(a, 150);
  const m = motion(v);
  assert.ok(a._camFlights === 1, "one flight");
  assert.ok(m.move <= 120, `MOVE ${m.move.toFixed(1)}px/frame`);
  assert.ok(m.kick <= 14, `KICK ${m.kick.toFixed(1)}px/frame²`);
  assert.ok(m.zoom <= 1.07, `ZOOM ${m.zoom.toFixed(4)}/frame`);
  // the first frame after the click moves less than a pixel: the old law moved 220
  assert.ok(motion(v.slice(0, 2)).move < 5, `first frame ${motion(v.slice(0, 2)).move.toFixed(2)}px`);
  assert.ok(Math.max(...v.map((x) => x.vw)) > ROLL * 2, "a long pan zooms out on the way");
  const last = v[v.length - 1];
  assert.ok(Math.hypot((B.x - last.cx) * W / last.vw - (634 - W / 2), (B.y - last.cy) * W / last.vw - (132 - H / 2)) < 1, "arrives");
});

test("a zoom into an on-screen node keeps it on a straight line (no swing out)", () => {
  const a = app();
  const P = { x: 0, y: 0 };
  a.cam = { ...frameAt(P, 1061, 432, GW * 1.02), lvw: Math.log(GW * 1.02) };   // boot reveal, measured
  a.camTarget = frameAt(P, 634, 132, ROLL);
  const v = run(a, 120);
  const pts = v.map((x) => [(P.x - x.cx) * W / x.vw + W / 2, (P.y - x.cy) * W / x.vw + H / 2]);
  const [x0, y0] = pts[0], [x1, y1] = pts[pts.length - 1];
  let off = 0;
  for (const [x, y] of pts) off = Math.max(off, Math.abs((x1 - x0) * (y0 - y) - (x0 - x) * (y1 - y0)) / Math.hypot(x1 - x0, y1 - y0));
  assert.ok(off < 2, `the node leaves its line by ${off.toFixed(2)}px`);
  const m = motion(v);
  assert.ok(m.kick <= 14 && m.zoom <= 1.07, JSON.stringify(m));
});

test("a direct write to cam (a pan, pinch or wheel) is adopted AT REST: no inherited velocity", () => {
  const a = app();
  const A = { x: 0, y: 0 }, B = { x: 4000 * ROLL / W, y: 0 };
  a.cam = { ...frameAt(A, W / 2, H / 2, ROLL), lvw: Math.log(ROLL) };
  a.camTarget = frameAt(B, W / 2, H / 2, ROLL);
  run(a, 30);                                   // mid-flight, moving fast
  a.cam.cx += 50; a.camTarget = { ...a.cam };    // the user's hand, as attachInput writes it
  const held = { ...a.cam };
  run(a, 30);
  assert.ok(Math.abs(a.cam.cx - held.cx) < 1e-9 && Math.abs(a.cam.cy - held.cy) < 1e-9, "the camera stays where the hand left it");
});

test("THE LIFT: a band that shrinks under the node clears it within CLEAR_SEC, continuously", () => {
  const a = app();
  const n = { x: 0, y: 0, r: 6 };
  a.nodes = [n]; a._LY = (q) => q.y;
  a.cam = { ...frameAt(n, 634, 300, ROLL), lvw: Math.log(ROLL) };
  a.camTarget = { ...a.cam };
  let bottom = 700;
  const ctx = () => ({ lift: { f: { x: n.x, y: n.y }, n, top: 16, bottom } });
  run(a, 30, ctx);
  bottom = 248;                                  // a late film row mounts: the band ends at 248
  const v = run(a, 60, ctx);
  // the band ends 12px above the row; "clear" is the reveal spec's: the lower edge 2px above the row.
  // The lift holds a conservative 30px margin below the orb's centre (the retired clamp's).
  const ys = v.map((x) => (n.y - x.cy) * W / x.vw + H / 2);
  const rowTop = 248 + 12, margin = 30;
  const first = ys.findIndex((y) => y + margin < rowTop - 2);
  assert.ok(first >= 0 && first * DT <= 0.35, `cleared at frame ${first}: ${ys.slice(0, 30).map(Math.round)}`);
  for (let i = first; i < ys.length; i++) assert.ok(ys[i] + margin < rowTop - 2, `stays clear (frame ${i}: ${ys[i]})`);
  const m = motion(v);
  assert.ok(m.move <= 120 && m.kick <= 14, `the lift is smooth: ${JSON.stringify(m)}`);
  assert.ok(motion(v.slice(0, 2)).move < 6, "the band change does not jump the camera on its own frame");
});

test("a target that moves LESS than a jump during a flight bends it smoothly, never in one frame", () => {
  // measured on an exchange: the announcer hiding moved the band's top, and the flight's endpoint with
  // it, by 33px at 1440 — under NG_CAM_JUMP, so no new flight; tracked raw it jumped the pose 33px
  const a = app();
  const P = { x: 0, y: 0 };
  a.cam = { ...frameAt(P, 634, 400, ROLL * 3), lvw: Math.log(ROLL * 3) };
  a.camTarget = frameAt(P, 634, 200, ROLL);
  const v = run(a, 40);                           // most of the way through the flight
  a.camTarget = { ...a.camTarget, cy: a.camTarget.cy - 33 * ROLL / W };
  v.push(...run(a, 90).slice(1));
  const m = motion(v);
  assert.ok(m.kick <= 14, `KICK ${m.kick.toFixed(1)}px`);
  const last = v[v.length - 1];
  assert.ok(Math.abs((P.y - last.cy) * W / last.vw + H / 2 - 233) < 1, "and it still arrives at the moved target");
});

function readerCamera() {
  const a = app(), reader = {}, n = { idx: 0, pi: -1, x: 0, y: 0, r: 12, ty: "positions" };
  a.W = 1152; a.nodes = [n]; a.focusIdx = 0; a.paused = true;
  a._LY = q => q.y; a._paneLayout = () => ({ left: 0, shift: 0, center: a.W / 2, width: a.W }); a._labelWidthPx = () => 150;
  a.get = () => true; a.isMobile = () => false; a.ROLL_ZOOM = .085; a.NG_LABEL_LEFT_MIN = 50;
  reader.nodeBand = a._readerBand(); a._reader = reader;
  reader.contents = { hidden: false, getBoundingClientRect: () => ({ left: 928, right: 1128, top: 68, bottom: 700, width: 200 }) };
  reader.articleEl = { getBoundingClientRect: () => ({ left: 236, right: 916, top: 68, bottom: 800, width: 680 }) };
  return { a, reader, n };
}

// D-318 U4a supersedes the free-gutter claim: scrolling covers a stationary,
// centred composition. Keep the original continuity bounds and idempotence.
test("the reader centres its drawn composition continuously, independently of article and index", () => {
  const { a, reader, n } = readerCamera();
  const original = { cx: a.W / 2 - 980, cy: H / 2 - 300, vw: a.W };
  a.cam = { ...original }; a.camTarget = { ...original };
  const settle = () => {
    const views = [{ ...a.cam }];
    let framed;
    for (let i = 0; i < 240; i++) {
      a.camTarget = a.rollCamTarget(n, false);
      if (!framed) framed = { ...a.camTarget };
      // Target equality pins idempotence only. Motion and visibility below read
      // the actual drawn camera, never the requested target (§6.2).
      assert.equal(a.camTarget.cx, framed.cx, "re-applying the reading composition must not drift");
      a._camStep(DT); views.push({ ...a.cam });
    }
    const m = motion(views, a.W);
    assert.ok(m.move <= 120 && m.kick <= 14 && m.zoom <= 1.07, JSON.stringify(m));
  };
  settle();
  const drawnX = (n.x - a.cam.cx) * a.W / a.cam.vw + a.W / 2;
  assert.ok(Math.abs(drawnX + (150 + 11) / 2 - a.W / 2) < 1e-6, "orb and full label are centred together: " + JSON.stringify({ drawnX, cam: a.cam, target: a.camTarget }));
  assert.ok(Math.abs(H / 2 + (n.y - a.cam.cy) * a.W / a.cam.vw - 140) < 1e-6, "node is in the reserved arrival band");
  const before = { ...a.cam };
  reader.contents.hidden = true;
  reader.articleEl.getBoundingClientRect = () => ({ left: 236, right: 916, top: 0, bottom: 900, width: 680 });
  settle();
  assert.ok(Math.abs(a.cam.cx - before.cx) < 1e-6 && Math.abs(a.cam.cy - before.cy) < 1e-6, "scrolling or hiding the index never moves the node");
});

test("a deliberate camera subject is never retargeted by the pane composition", () => {
  const { a, reader, n } = readerCamera(), subject = { x: 2000, y: 0 };
  a.cam = { cx: subject.x, cy: 150, vw: a.W }; a.camTarget = { ...a.cam };
  for (let i = 0; i < 180; i++) {
    a.camTarget = a._paneCameraTarget(a.camTarget); a._camStep(DT);
    assert.equal(a.W / 2 + (subject.x - a.cam.cx) * a.W / a.cam.vw, a.W / 2,
      "the requested subject remains at the drawn centre");
    assert.ok(a.W / 2 + (n.x - a.cam.cx) * a.W / a.cam.vw < 0, "the off-screen current node is not pulled back");
  }
});

// D-347 / pane-layout:82 (CI 48be3a910): in the reading view the follow-cam engages NO lift while no flight is under
// way. The reader's node band is reserved and rollCamTarget already centres the pair in it, so a lift against its edge
// only held the node off centre until a pane toggle reset it: two rest framings. pane-layout:131 was this claim's only
// gate, and from v1.237.0 its first landing is the directed arrival, which never flies and so never met the lift
// (PR #320's review: reading-band-lift-restored survived there). updateCamera is driven here, at rest, on the
// reader's band; the lift it hands the integrator is read from the integrator's own state (`_cm.lift`).
test("in the reading view the follow-cam engages no lift at rest: one rest framing, whatever the pane does (D-347)", () => {
  const { a, n } = readerCamera();
  Object.assign(a, { introDone: true, startTime: 0, camFocus: { x: n.x, y: n.y }, pulse: null, _camOpenChecked: true, _camOpen: null,
    _reducedMotion: () => false, userActiveNow: () => false, camHeld: () => false, cfg: () => ({ cameraMode: "Follow" }),
    _frameArrivalHeading: () => {}, _refPage: null, _execution: null });
  a.paused = false;
  const rest = a.rollCamTarget(n, false);
  a.cam = { ...rest, lvw: Math.log(rest.vw) }; a.camTarget = { ...rest };
  const on = [];
  for (let i = 0; i < 120; i++) { a.now += DT; a.updateCamera(DT); on.push(!!a._cm?.lift?.on); }
  assert.equal(a._viewRect().band, true, "premise: the reading view's band (the reader's reserved node band)");
  assert.ok(a._cm && !a._cm.flight, "premise: no flight was under way");
  assert.deepEqual(on.filter(Boolean).length, 0, "no frame at rest engaged a lift against the reader's band");
  const drawnY = H / 2 + (n.y - a.cam.cy) * a.W / a.cam.vw, restY = H / 2 + (n.y - rest.cy) * a.W / rest.vw;
  assert.ok(Math.abs(drawnY - restY) < 1e-6, "and the node rests exactly where rollCamTarget framed it: " + JSON.stringify({ drawnY, restY }));
});

console.log("camera motion: 8 cases (flight, straight zoom, adopted write, lift, moving goal, reader exclusion, deliberate subject, no rest lift)");
