import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { journey } from "../dsl";

/**
 * WHO OWNS THE CAMERA — measured in the VIEWPORT, not in a variable.
 *
 * A shared class lights up and the camera flies to it. Three review passes accepted that as
 * working because the code plainly asks for it: `relightShare()` → `setFocusIdxSet(idxs)` →
 * `frameNodes(idxs)`. But `frameNodes` does not move the camera. It writes `camTarget` and
 * returns; the render loop eases the camera toward `camTarget` — and `updateCamera()`'s
 * follow-cam RE-AIMS `camTarget` at the CURRENT roll node on EVERY frame. camTarget has nine
 * writers and the roll owns most of them, so a focus flight lost the camera within one frame of
 * a live roll. Nobody saw it on a desktop because the arrival opened the pane, and an open pane
 * pauses the roll (`if (this.introDone && (this.paused || …)) tgt = null`). The moment a phone
 * arrival stopped opening the pane (v1.81.3, deliberately — the terminal state on a phone is the
 * LIT GRAPH) the follow-cam won every time.
 *
 * So every assertion here is a MEASURED SCREEN POSITION: each shared node is projected through
 * the very transform `draw()` uses (`W/2 + (n.x - cam.cx) * W/cam.vw`) and required to be inside
 * the 390x844 rect, SECONDS after arrival, WITH THE ROLL RUNNING. A test that asserts camTarget
 * was assigned is exactly how this survived three passes.
 *
 * Rails: __neural.cam, .camTarget, ._camHoldUntil, ._focusIdxSet, .paused, .currentPos
 */

const PHONE = { width: 390, height: 844 };
test.use({ viewport: PHONE, hasTouch: true });

const shellPath = resolve(__dirname, "../../source/public/l.html");

/** The production `/l/* /l.html 200` rewrite with NO Function in the path. */
const serveShellWithoutFunction = async (page: Page) => {
  const shell = readFileSync(shellPath);
  await page.route("**/l/*", (r) =>
    r.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: shell }),
  );
};

/** A REAL class list: the techniques you can attempt from the position you drilled from. A
 *  coach's list is a neighbourhood, not five nodes sampled across the whole map. */
const pickClassNodes = (page: Page, n: number) =>
  page.evaluate((count) => {
    const a = (window as any).__neural;
    const pos = a.currentPos;
    const near = (a.adj[pos] || [])
      .map((i: number) => a.nodes[i])
      .filter(
        (x: any) =>
          x && typeof x.o === "number" && (x.ty === "transitions" || x.ty === "submissions"),
      );
    return near.slice(0, count).map((x: any) => ({ id: x.id, name: x.t }));
  }, n);

const codeFor = (page: Page, ids: string[]) =>
  page.evaluate((list: string[]) => {
    const a = (window as any).__neural;
    for (const id of list) a.addToList(id);
    return a.listShareCode(a.activeListId);
  }, ids);

/**
 * WHERE THE LIT CLASS ACTUALLY IS ON THE GLASS.
 *
 * Same projection as `draw()`: scale = W / cam.vw, screen = centre + (world - camCentre) * scale.
 * Returns one row per lit node plus the current roll node, so a failure prints how far off
 * screen each one drifted instead of "expected true, got false".
 */
const screen = (page: Page) =>
  page.evaluate(() => {
    const a = (window as any).__neural;
    const W = a.W,
      H = a.H,
      scale = W / a.cam.vw;
    const project = (n: any) => ({
      id: n.id,
      x: Math.round(W / 2 + (n.x - a.cam.cx) * scale),
      y: Math.round(H / 2 + (n.y - a.cam.cy) * scale),
    });
    const pts = Array.from(a._focusIdxSet || []).map((i: any) => project(a.nodes[i]));
    const inside = (p: any) => p.x >= 0 && p.x <= W && p.y >= 0 && p.y <= H;
    const cur = a.nodes[a.currentPos] ? project(a.nodes[a.currentPos]) : null;
    return {
      W,
      H,
      t: Math.round((a.now || 0) * 100) / 100,
      vw: Math.round(a.cam.vw),
      graphW: Math.round(a.graphW),
      cam: { cx: Math.round(a.cam.cx), cy: Math.round(a.cam.cy) },
      pts,
      offscreen: pts.filter((p: any) => !inside(p)),
      litOnScreen: pts.filter(inside).length,
      lit: pts.length,
      currentOnScreen: !!(cur && inside(cur)),
      current: cur,
      paused: !!a.paused,
      hand: (a.optionIdxs || []).length,
      // the app's own predicate where it exists — GUARDED, because this same helper has to run
      // against the PRE-FIX bundle to prove the test detects the bug, and calling a method that
      // build does not have turns a red proof into a TypeError that proves nothing
      holdLive: typeof a.camHeld === "function" ? !!a.camHeld() : false,
    };
  });

/** Box + hit-test of a control, in viewport coordinates (see share-mobile.spec for why every
 *  mobile control is measured this way rather than clicked through a locator). */
const reach = (page: Page, selector: string) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement | null;
    if (!el) return { found: false } as any;
    const r = el.getBoundingClientRect();
    const x = Math.round(r.x + r.width / 2);
    const y = Math.round(r.y + r.height / 2);
    const at = document.elementFromPoint(x, y) as HTMLElement | null;
    return {
      found: true,
      x,
      y,
      w: Math.round(r.width),
      h: Math.round(r.height),
      left: Math.round(r.left),
      right: Math.round(r.right),
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      inViewport:
        r.width > 0 && r.height > 0 && r.left >= 0 && r.top >= 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight,
      hit: !at
        ? "NOTHING (the canvas is above it)"
        : at === el || el.contains(at)
          ? "the control"
          : `${at.tagName}[${(at.getAttributeNames() || []).filter((n) => n.startsWith("data-")).join(",")}].${String(at.className).slice(0, 34)}`,
    };
  }, selector);

/** A point where the GRAPH is what a pointer would hit. The landing card is `calc(100vw - 20px)`
 *  wide and its height depends on the hand, so a hard-coded "middle of the screen" lands inside it
 *  as often as not — and a pan that starts on an overlay is not a pan. Scan for the canvas. */
const canvasPoint = (page: Page) =>
  page.evaluate(() => {
    for (const y of [150, 190, 230, 270, 310, 120, 100]) {
      for (const x of [195, 120, 270, 60, 330]) {
        const at = document.elementFromPoint(x, y);
        if (at && at.tagName === "CANVAS") return { x, y };
      }
    }
    return null;
  });

/**
 * Arrive on a shared link, phone-shaped, with a class of five neighbouring techniques — and START
 * THE RECIPIENT'S ROLL SOMEWHERE ELSE.
 *
 * That last part is the whole difference between a test that measures the bug and one that passes
 * by luck. A coach captures their class where they were drilling; the recipient's roll seeds at an
 * unrelated position (`startRoll` draws one). If the two happen to coincide, the follow-cam is
 * already pointing at the class and "the class is on screen" says nothing about who owns the
 * camera. So the roll is rigged to the FARTHEST playable position from the class centroid: pre-fix
 * the follow-cam drags the view away from the class every time, post-fix the lease holds it.
 */
const arrive = async (page: Page, count = 5) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  const picks = await pickClassNodes(page, count);
  expect(picks.length, "the landed position offers a class-sized neighbourhood").toBe(count);
  const code = await codeFor(
    page,
    picks.map((p) => p.id),
  );
  await serveShellWithoutFunction(page);
  await j.boot(`/l/${code}`);
  const far = await page.evaluate((ids: string[]) => {
    const a = (window as any).__neural;
    const nodes = ids.map((id) => a.nodes[a._idIndex.get(id)]).filter(Boolean);
    const cx = nodes.reduce((t: number, n: any) => t + n.x, 0) / nodes.length;
    const cy = nodes.reduce((t: number, n: any) => t + n.y, 0) / nodes.length;
    let best = -1;
    let bd = -1;
    for (const n of a.nodes) {
      if (n.ty !== "positions") continue;
      if (!a.adj[n.idx].some((k: number) => a.nodes[k].ty !== "positions")) continue; // playable
      const d = (n.x - cx) * (n.x - cx) + (n.y - cy) * (n.y - cy);
      if (d > bd) {
        bd = d;
        best = n.idx;
      }
    }
    a.rigStart(best); // test rail: the next startRoll begins here
    return { name: a.nodes[best].t, dist: Math.round(Math.sqrt(bd)), graphW: Math.round(a.graphW) };
  }, picks.map((p) => p.id));
  expect(
    far.dist,
    `the roll must start away from the class for this to measure anything (${far.name} is ` +
      `${far.dist} world units from the class, graph width ${far.graphW})`,
  ).toBeGreaterThan(far.graphW * 0.25);
  return { j, code, want: picks.map((p) => p.id).sort(), far };
};

// ═══════════════════════════════ 1. THE BLOCKER: the flight has to still be there

test("the class a link lit is STILL ON SCREEN seconds after arrival, with the roll running @curated", async ({
  page,
}) => {
  const { j, want } = await arrive(page);
  expect(await page.evaluate(() => {
    const a = (window as any).__neural;
    return Array.from(a._focusIdxSet || []).map((i: any) => a.nodes[i].id).sort();
  }), "premise: the link lit the coach's five techniques").toEqual(want);

  // the intro flight owns the camera for its first 3.2s and then hands over to the roll
  await j.advance(3500);
  // …and now the roll is LIVE: this is the state the pane used to hide by pausing
  await j.advance(2500);

  const s = await screen(page);
  expect(s.paused, "premise: the roll is RUNNING (nothing paused it — pane law stands)").toBe(false);
  expect(s.hand, "premise: a hand is dealt, so the follow-cam has a node it wants").toBeGreaterThan(0);
  expect(
    s.litOnScreen,
    `${s.lit - s.litOnScreen} of ${s.lit} shared nodes are OFF a ${s.W}x${s.H} screen ${s.t}s ` +
      `after arrival: ${JSON.stringify(s.offscreen)} (cam ${JSON.stringify(s.cam)} vw ${s.vw}). ` +
      `The camera was re-aimed at the roll's current node, so the recipient is looking at ` +
      `something other than the class the link was for.`,
  ).toBe(s.lit);
  expect(
    s.vw,
    `and the camera actually FLEW there — vw ${s.vw} vs graph width ${s.graphW}: a whole-map ` +
      `overview would contain the class without ever showing it`,
  ).toBeLessThan(s.graphW * 0.95);
  // a measuring test should SHOW its measurement, pass or fail — this line is the on-screen
  // evidence for "the class is still there", in viewport pixels
  console.log(
    `[on-screen] arrival+${s.t}s roll=${s.paused ? "paused" : "running"} viewport ${s.W}x${s.H} ` +
      `vw=${s.vw}/${s.graphW} lit ${s.litOnScreen}/${s.lit} inside: ` +
      s.pts.map((p: any) => `(${p.x},${p.y})`).join(" "),
  );

  // NOT FROZEN: the lease expires and the roll gets its camera back (the 400ms pan-to-current
  // behaviour must survive this fix — a permanently held camera is a worse bug than the one
  // being fixed).
  const before = s.cam;
  await j.advance(9000);
  const after = await screen(page);
  expect(
    after.currentOnScreen,
    `once the lease lapses the roll owns the camera again — current node ` +
      `${JSON.stringify(after.current)} on a ${after.W}x${after.H} screen at t=${after.t}s`,
  ).toBe(true);
  expect(
    Math.hypot(after.cam.cx - before.cx, after.cam.cy - before.cy),
    "and the camera MOVED to get there (a frozen camera would pass the assertion above by luck)",
  ).toBeGreaterThan(1);
});

test("tapping ◉ re-lights the class AND brings the camera back, mid-roll @curated", async ({
  page,
}) => {
  const { j, want } = await arrive(page);

  // let the roll take the camera away first — that is the state a recipient taps ◉ in
  await j.advance(3500);
  await j.advance(12_000);
  const lost = await screen(page);
  expect(lost.paused, "premise: still rolling").toBe(false);

  const cue = await reach(page, "[data-share-cue]");
  expect(cue.found, "the re-light control is on screen").toBe(true);
  expect(cue.hit, `elementFromPoint(${cue.x},${cue.y}) must be the cue itself`).toBe("the control");
  await page.touchscreen.tap(cue.x, cue.y);

  await j.advance(2500);
  const s = await screen(page);
  expect(
    Array.from(s.pts).map((p: any) => p.id).sort(),
    "the tap re-lit exactly the class",
  ).toEqual(want);
  expect(s.paused, "…without pausing the roll (nothing but the user stops the game)").toBe(false);
  expect(
    s.litOnScreen,
    `◉ must MOVE THE CAMERA, not just re-tint nodes: ${s.lit - s.litOnScreen} of ${s.lit} are ` +
      `off a ${s.W}x${s.H} screen ${Math.round((s.t - lost.t) * 10) / 10}s after the tap ` +
      `(${JSON.stringify(s.offscreen)})`,
  ).toBe(s.lit);
  console.log(
    `[on-screen] after ◉ at t=${lost.t}s → t=${s.t}s: lit ${s.litOnScreen}/${s.lit} inside ` +
      `${s.W}x${s.H}: ` +
      s.pts.map((p: any) => `(${p.x},${p.y})`).join(" ") +
      ` (before the tap the camera was at ${JSON.stringify(lost.cam)}, class off-screen)`,
  );
  await j.expectBeat("list_relit");
});

test("a drag hands the camera straight back to the user — the app never fights a pan", async ({
  page,
}) => {
  const { j } = await arrive(page);
  await j.advance(3500);
  await j.advance(2000); // the class is framed and the lease is live

  // a REAL pan: pointerdown, several moves, pointerup — the gesture that means "I'll look
  // where I like". The lease must be released by it, not merely overridden for one frame.
  const from = await canvasPoint(page);
  expect(from, "a point where the graph itself is hit-testable").not.toBeNull();
  await page.mouse.move(from!.x, from!.y);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(from!.x - i * 18, from!.y + i * 8);
  await page.mouse.up();

  const held = await page.evaluate(() => {
    const a = (window as any).__neural;
    return { holdLive: typeof a.camHeld === "function" ? !!a.camHeld() : false };
  });
  expect(held.holdLive, "the user took over: the focus lease is gone, not waiting to snap back").toBe(
    false,
  );

  // and the roll's own camera resumes normally afterwards (userActiveNow() holds it for 4s)
  await j.advance(6500);
  const s = await screen(page);
  expect(
    s.currentOnScreen,
    `the follow-cam is back on the roll after the pan — current ${JSON.stringify(s.current)} ` +
      `on ${s.W}x${s.H} at t=${s.t}s`,
  ).toBe(true);
});

// ═══════════════════════════════ 2. THE MAJOR: the thumb band's tenants stay reachable

test("the share cue and Class opener stay reachable in the 390x844 thumb band @curated", async ({ page }) => {
  await arrive(page);

  // v1.134.0: the transport is RETIRED — the band's tenants are now the share cue, the Class
  // opener, and the legend. Each must exist, sit on screen, and win its own hit-test.
  const cue = await reach(page, "[data-share-cue]");
  const open = await reach(page, "[data-class-open]");
  for (const [name, box] of [
    ["the ◉ re-light cue", cue],
    ["the Class ▸ opener", open],
  ] as [string, any][]) {
    if (!box.found) continue; // an absent optional tenant is not a collision
    expect(box.inViewport, `${name} is on a 390x844 screen (${JSON.stringify(box)})`).toBe(true);
    expect(box.hit, `${name}: elementFromPoint(${box.x},${box.y}) must name it — got ${box.hit}`).toBe("the control");
  }

  const hits = (a: any, b: any) =>
    a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  const legend = await reach(page, ".ng-legend");
  if (legend.found && cue.found)
    expect(hits(cue, legend), "the cue and the legend do not share the band").toBe(false);
});
