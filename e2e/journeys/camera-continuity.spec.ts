import { test, expect, type Page } from "@playwright/test";
import { journey } from "../dsl";

/**
 * THE CAMERA GLIDES, AND IT FRAMES WHAT YOU CAN SEE (v1.219.0).
 *
 * Owner, 2026-10-05, testing the dev preview at v1.218.0:
 *   1. "when the state is selected, it seems to zoom or start from a camera pan state already too
 *      zoomed and panned so much so I wonder if there was a break in the continuity of the camera
 *      motion? please polish that so it doesnt feel so abrupt in the first second when starting the
 *      roll / navigating to a new current node"
 *   2. "when i click on Mount or any other technique in the Explore tab, it should center the Mount
 *      node not to the center of the screen but to the visible area of the graph that's available
 *      after the videos row, landcard, and choices row show and take space"
 *
 * EVERY NUMBER HERE IS READ THROUGH draw()'s TRANSFORM, never from `camTarget` (CLAUDE.md 6.2: it
 * has nine writers and the follow-cam rewrites it every frame). Each pumped frame (1/60 s) records
 * `cam`, and consecutive frames give the motion a viewer SEES. For views (c0, s0) -> (c1, s1), with
 * s = W / vw, a screen point p moves by
 *     d(p) = (c0 - c1) * s1 + (p - C) * (s1 / s0 - 1)
 * and the largest |d| is at a viewport corner. Three bounds, per frame, on every case:
 *   MOVE  max |d| over the corners                ≤ MOVE_PX[width]   (no frame teleports the world)
 *   ZOOM  s1 / s0 (or its inverse)                ≤ ZOOM_RATIO       (no frame jumps the scale)
 *   KICK  |d_k - d_(k-1)| at the screen centre    ≤ KICK_PX[width]   (no frame starts a motion at
 *         full speed: the owner's "abrupt in the first second" is exactly a large first kick)
 * Measured on v1.218.0 by the same sampler (the camera read per frame), the cases broke these at:
 *   Explore -> Mount 1440: the follow-cam's band clamp moved Mount 1,105 px vertically in ONE frame
 *   while it was still 5,300 px off-screen, and the first-order easing's first frame moved 220 px;
 *   boot reveal 1440: 108 px, then 95 px when the card laid out; exchange landing and URL arrival
 *   at 390: 250 px in one frame when the film row mounted.
 *
 * AND THE ROWS. Wherever the band is PREDICTABLE the camera makes room before the rows mount, and
 * ZERO overlap is asserted on every frame: the roll start (v1.237.0: the directed arrival holds the node
 * until the board mounts, then the board rides up a fixed distance below it), the URL
 * arrival (the intro's parting overview lifts), the exchange (travel frames into the landing's band)
 * — here — and the staged restart in `landing-reveal.spec.ts`. The one rule that is not zero is for a
 * row the camera cannot see coming:
 *   CLEAR_SEC  a row that mounts UNANNOUNCED — a film row whose content arrives after the landing —
 *              is cleared within CLEAR_SEC, and every frame after that is clear.
 * Other unannounced cases the same rule covers (not separately journeyed): a card taller than any
 * this viewport has measured for its row set, and the very first landing at a viewport, whose
 * prediction is a guess (`_predictBottom`).
 * D-350b (2026-10-21): a frame counts only while some of the pair's silhouette is on screen. A pair
 * wholly off screen covers nothing: the no-Videos exchange at 390 failed 5 of 5 on 5 such frames,
 * mid arc flight, pair right edge at x -140 to -214 and label ending at x <= -0.07, while all 245
 * frames with the pair on screen cleared the rows by >= 30.2px. Asserted / excluded per run, 5
 * full-file runs (H45, on pre-D-351 bytes; review-claude's Delta 6 measured the final bytes at 279,
 * 128-129, 235-237 and 101 or 125 for the same rows): roll start 287 / 0 and URL arrival 418-420 / 0 at both widths; the exchange
 * at 390 137 / 223 and without Videos 245 / 115, every run; at 1440 109 / 0 in 4 runs and 134 / 226
 * in 1 (its rows were up through the execution). Every excluded frame is the EXECUTED technique's
 * pair, left behind off screen while the camera arcs to the landing (no-Videos run: frames 168-282,
 * fx -12 to -457); from the landing on, the new current node is on screen and asserted.
 *
 * ITEM 2: the clicked node projects inside the CENTRAL BAND of the visible graph rect, measured from
 * the DOM here (pane right edge; announcer bottom; the highest visible bottom row), with the layers
 * on and off. Not the screen centre (asserted to differ where the rect's centre does), not under a
 * layer.
 *
 * Mutation kills and recorded non-kills: see the archive entry for v1.219.0 and the table in this
 * header.
 *   restore the hard band clamp                       → "MOVE" (explore 1440, exchange 390)
 *   first-order easing instead of the eased flight    → "KICK"
 *   a flight with no zoom-out arc (pivot always)      → "MOVE" (explore)
 *   zero-length flights (snap to the target)          → "MOVE" (asserted first; "ZOOM" by firstorder)
 *   `_viewRect` ignores the bottom rows               → "central band"
 *   the lift's edge takes 1 s                         → the lift unit (camera_motion.test.mjs); here
 *                                                       the re-aimed flight still clears the node in time
 *   ...and flights take ≥1.5 s too (slow clearing)    → "CLEAR_SEC"
 *   no pre-lift (the arrival makes no room)           → "ZERO overlap" (URL arrival; the roll start is the
 *                                                       directed arrival since v1.237.0, whose own mutants
 *                                                       are in opening-camera.spec.ts's header);
 *                                                       scripted since D-350b as noprelift-url-arrival,
 *                                                       killed under the on-screen filter (H45)
 *   the directed arrival's board does not ride        → "ZERO overlap roll start" (390): the rows stand at
 *                                                       their settled place under the held node; scripted
 *                                                       as noride-roll-start (PR #320's review), replacing
 *                                                       the retired noprelift-roll-start
 *   no prediction (`ahead` ignored)                   → NON-KILL since the reading view (D-350b, H45):
 *                                                       noahead-exchange-1440/-390 pass under the
 *                                                       filtered AND the pre-D-350b helper, so no kill
 *                                                       was lost to the filter. A reading-view exchange
 *                                                       frames through the reader's frameExecution, so
 *                                                       `ahead` decides only a map-view exchange, which
 *                                                       no journey here runs. H139 / ORCH-377 again
 *                                                       measured both as NON-KILLS on green baselines;
 *                                                       neither is prediction coverage.
 *   fixed 30px band-flight gate                     → "ZERO overlap URL arrival" (ORCH-382)
 *   track the hold only after that gate opens         → "ZERO overlap URL arrival" (ORCH-382)
 *     H140 before the fix: final 0/10, CI-green 3c3a4f949 10/10, video-cards 76891e049 10/10.
 *     The actual silhouette and zero-offset tracking preserve the existing frame bounds and hover.
 *   the escape's stand-in takes the camera            → "the stand-in does not take the camera" and "MOVE"
 *                                                       (a pick after the catch's lease; inside it the
 *                                                       lease decides, so the earlier escape case cannot)
 *   the escape keeps the click's activity latch       → "the landing hands the camera to the roll"
 *
 * NOT PINNED HERE: user gestures (a pan, pinch or wheel moves the camera 1:1 with the hand, by
 * design, and is excluded from every bound); the camera under reduced motion (the execution
 * framing snaps there, `roll-execution.spec.ts`).
 *
 * Rails: __neural.cam, .nodes, .pairMid, ._LY, .focusIdx, ._landEl, ._landFilmEl, .optionsRef,
 *        .drillRef, .evRef, .deckShown, .setLayer, ._camFlights
 */

// D-331 N4 (review-claude, PLAUSIBLE): D-329's fallback marks only the article column below the node
// band occupied, while a landing's hand row spans the full width. Probed at 1440x480 (a 64px band):
// some search found a slot (_execFrame.noFit 0) and the exchange stayed clear of the landing rows on
// every frame. The probe did not count whether the band search failed first, so it does not show that
// the column-only fallback ran (D-332 D2-N1). Not reproduced; 1366x460 could not run
// because this file's motion bounds are keyed to 1440 and 390. Receipt: claude-verify/n4.log.
// ── THE BOUNDS ── stated per frame at 60 fps (the pump's step). Px scale with the viewport.
const MOVE_PX: Record<number, number> = { 1440: 120, 390: 48 };
const KICK_PX: Record<number, number> = { 1440: 14, 390: 6 };
const ZOOM_RATIO = 1.07;
const CLEAR_SEC = 0.35;

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
];

type Sample = {
  t: number; W: number; H: number; cx: number; cy: number; vw: number;
  fi: number; fx: number | null; fy: number | null; lo: number | null; xl: number | null; xr: number | null;
  rows: number | null; bottom: number; film: number | null; pane: number; evBottom: number; head?: number[] | null; why?: any;
};

/** One frame: pump 1/60 s, then read what the frame drew. */
const frame = (page: Page) =>
  page.evaluate(() => {
    const a = (window as any).__neural;
    a.advance(1000 / 60);
    const W = a.W, H = a.H, s = W / a.cam.vw;
    const n = a.focusIdx >= 0 ? a.nodes[a.focusIdx] : null;
    let fx = null, fy = null, lo = null, xl = null, xr = null;
    if (n) {
      const mid = a.pairMid(n);
      fx = W / 2 + (mid.x - a.cam.cx) * s;
      fy = H / 2 + (mid.y - a.cam.cy) * s;
      const nodeK = Math.max(0.4, Math.min(1, a.cam.vw / (a.graphW * 0.5)));
      lo = -1e9; xl = 1e9; xr = -1e9;
      for (const q of [n, n.pi >= 0 ? a.nodes[n.pi] : null]) {
        if (!q) continue;
        lo = Math.max(lo, H / 2 + (a._LY(q) - a.cam.cy) * s + q.r * nodeK * s * 1.6);
        // the same silhouette across: D-350b excludes a frame only when ALL of it is off screen
        const qx = W / 2 + (q.x - a.cam.cx) * s, half = q.r * nodeK * s * 1.6;
        xl = Math.min(xl, qx - half); xr = Math.max(xr, qx + half);
      }
    }
    const shown = (el: any) => el && el.offsetHeight && getComputedStyle(el).display !== "none" && getComputedStyle(el).visibility !== "hidden";
    // The centred article is an occupied surface only across its actual width.
    // A node in the free side gutter keeps that gutter's full vertical band.
    const article = a._reader?.articleEl;
    let blocks = false;
    if (n && shown(article)) {
      const r = article.getBoundingClientRect(), k = Math.max(.4, Math.min(1, a.cam.vw / (a.graphW * .5)));
      const half = Math.max(...[n, n.pi >= 0 ? a.nodes[n.pi] : null].filter(Boolean).map(q => a._nodeHalfW(q, s, k, a._lodK ?? 1)));
      blocks = fx! - half < r.right && fx! + half + 11 + a._labelWidthPx(n) > r.left;
    }
    const rows = [a._landEl, a._landFilmEl, a._handShown() && a.optionsRef.current]
      .filter(shown).map((el: HTMLElement) => el.getBoundingClientRect().top).filter((y: number) => y > 48);
    const tops = rows.concat([blocks && article, a._layerDockEl].filter(shown)
      .map((el: HTMLElement) => el.getBoundingClientRect().top).filter((y: number) => y > 48));
    const film = shown(a._landFilmEl) ? a._landFilmEl.getBoundingClientRect().top : null;
    const pane = a.deckShown && !a.isMobile() && a.drillRef.current ? a.drillRef.current.getBoundingClientRect().right : 0;
    const ev = a.evRef.current, er = ev && ev.getBoundingClientRect();
    const evBottom = er && er.height > 0 && getComputedStyle(ev).opacity !== "0" ? er.bottom : 0;
    const m = a._cm, L = m && m.lift, E = m && m.edge;
    // the integrator's own state, so a failing frame names its cause (flight / spring / lift)
    const why = m ? { fl: m.flight ? [m.flight.kind, +m.flight.t.toFixed(3), +m.flight.dur.toFixed(2)] : null,
      lift: L ? [+L.o.toFixed(1), +L.w.toFixed(1), L.exact, L.on] : null, edge: E ? [Math.round(E.from), Math.round(E.to), +E.t.toFixed(2)] : null,
      held: a.camHeld(), exec: !!a._execution, pulse: !!a.pulse } : null;
    // the travelling light (headPos), through the same transform: what a player's eye follows
    const hp = a.pulse && a.headPos ? a.headPos() : null;
    const head = hp ? [W / 2 + (hp.x - a.cam.cx) * s, H / 2 + (hp.y - a.cam.cy) * s] : null;
    return { t: a.now, W, H, cx: a.cam.cx, cy: a.cam.cy, vw: a.cam.vw, fi: a.focusIdx, fx, fy, lo, xl, xr,
      rows: rows.length ? Math.min(...rows) : null, bottom: tops.length ? Math.min(...tops) - 12 : H - 16,
      film, pane, evBottom, head, why } as any;
  }) as Promise<Sample>;

/** D-354 (B2's class, by mechanism): on CI, roll-execution's identical phone pick was force-scrolled by
 *  card.click()'s retry while the reader still laid out, putting Videos across the node band. So the phone
 *  waits for the ready reader (D9-N1) and its layout, brings the card in along its tray, and presses with a
 *  mouse that cannot scroll; the arrival scrollTop is asserted before the press and at the pointerdown. */
const phonePick = async (page: Page, j: any, opt: string) => {
  await expect(page.locator('[data-reader][data-reader-ready="true"]')).toBeVisible();
  await j.readerLayoutSettled();
  const arrival = await page.evaluate(name => {
    const w = window as any, a = w.__neural, top = a._reader.root.scrollTop;
    a._optionCards.find((c: any) => c.opt.node.t === name).card.scrollIntoView({ block: "nearest", inline: "center", behavior: "instant" });
    document.addEventListener("pointerdown", () => { w.__pickTop = a._reader.root.scrollTop }, { capture: true, once: true });
    return top;
  }, opt);
  await j.readerLayoutSettled();
  expect(await page.evaluate(() => (window as any).__neural._reader.root.scrollTop), "premise: the tray brought the card in, the reader stayed where it arrived").toBe(arrival);
  await j.clickByMouse(`[data-tech="${opt}"] .ngchoice-title`, "pick the transition by mouse");
  expect(await page.evaluate(() => (window as any).__pickTop), "premise: the pick is pressed where the reader arrived").toBe(arrival);
};

const record = async (page: Page, frames: number) => {
  const out: Sample[] = [];
  for (let i = 0; i < frames; i++) out.push(await frame(page));
  return out;
};

/** The three per-frame bounds over a run, with the worst frame named. */
/** `fromRest`: the run begins with the camera at rest, so its first motion is measured as a kick
 *  from zero (the owner's "abrupt in the first second"). A run that starts mid-motion says false. */
const motion = (S: Sample[], fromRest = true) => {
  let move = { v: 0, i: -1 }, kick = { v: 0, i: -1 }, zoom = { v: 1, i: -1 };
  let prev: [number, number] | null = fromRest ? [0, 0] : null;
  for (let i = 1; i < S.length; i++) {
    const a = S[i - 1], b = S[i];
    const s0 = a.W / a.vw, s1 = b.W / b.vw;
    let m = 0;
    for (const [px, py] of [[0, 0], [b.W, 0], [0, b.H], [b.W, b.H]]) {
      const dx = (a.cx - b.cx) * s1 + (px - b.W / 2) * (s1 / s0 - 1);
      const dy = (a.cy - b.cy) * s1 + (py - b.H / 2) * (s1 / s0 - 1);
      m = Math.max(m, Math.hypot(dx, dy));
    }
    const c: [number, number] = [(a.cx - b.cx) * s1, (a.cy - b.cy) * s1];
    const k = prev ? Math.hypot(c[0] - prev[0], c[1] - prev[1]) : 0;
    prev = c;
    const z = Math.max(s1 / s0, s0 / s1);
    if (m > move.v) move = { v: m, i };
    if (k > kick.v) kick = { v: k, i };
    if (z > zoom.v) zoom = { v: z, i };
  }
  return { move, kick, zoom };
};

const expectContinuous = (S: Sample[], width: number, what: string, fromRest = true) => {
  // a run that sampled nothing, or never moved, would pass every bound — refuse it
  expect(S.length, `${what}: frames sampled`).toBeGreaterThan(30);
  const m = motion(S, fromRest);
  const travel = S.reduce((t, x, i) => (i ? t + Math.hypot(x.cx - S[i - 1].cx, x.cy - S[i - 1].cy) * x.W / x.vw : 0), 0)
    + Math.abs(Math.log(S[S.length - 1].vw / S[0].vw)) * 1000;
  expect(travel, `${what}: the camera actually moved (or this measures nothing)`).toBeGreaterThan(40);
  const at = (i: number) => JSON.stringify({ frame: i, prev: S[i - 1], cur: S[i] });
  expect(m.move.v, `MOVE ${what} @${width}: ${at(m.move.i)}`).toBeLessThanOrEqual(MOVE_PX[width]);
  expect(m.kick.v, `KICK ${what} @${width}: ${at(m.kick.i)}`).toBeLessThanOrEqual(KICK_PX[width]);
  expect(m.zoom.v, `ZOOM ${what} @${width}: ${at(m.zoom.i)}`).toBeLessThanOrEqual(ZOOM_RATIO);
  return m;
};

/** ZERO OVERLAP where the band is predictable (the orchestrator's CAM1 condition 1): on every
 *  frame a landing's rows are up, the focus's drawn silhouette (both pair members) sits above the
 *  highest row by 2px — the landing-reveal spec's own test.
 *  D-350b: a pair ENTIRELY off screen covers nothing, so a frame whose whole silhouette (the 1.6r
 *  `lo` uses) lies outside [0, W] is excluded; a partly visible pair stays asserted. Both counts
 *  are reported, and fewer than 31 asserted frames fail, so an all-off-screen run cannot pass. */
const expectClearOfRows = (S: Sample[], width: number, what: string) => {
  const up = S.filter((x) => x.fi >= 0 && x.rows != null && x.lo != null);
  const asserted = up.filter((x) => x.xr! > 0 && x.xl! < x.W);
  const counts = `asserted ${asserted.length}, excluded ${up.length - asserted.length} (whole silhouette off screen)`;
  test.info().annotations.push({ type: "clear-of-rows", description: `${what} @${width}: ${counts}` });
  expect(asserted.length, `ZERO overlap ${what}: frames with a focus, rows up and the pair on screen; ${counts}`).toBeGreaterThan(30);
  for (const x of asserted) expect(x.lo!, `ZERO overlap ${what} @${width}: ${JSON.stringify(x)}`).toBeLessThan(x.rows! - 2);
};

/** The visible graph rect, measured from the DOM (not asked of the app). */
const visibleRect = (x: Sample) => {
  const top = Math.max(16, x.evBottom ? x.evBottom + 12 : 16);
  const bottom = x.bottom;
  return { left: x.pane, right: x.W, top, bottom };
};

/** The playable position farthest from Mount (by its title, for `j.land`), so the Explore flight
 *  is a long one — the case that streamed the graph past at roll zoom. */
const farFromMount = (page: Page) =>
  page.evaluate(() => {
    const a = (window as any).__neural;
    const m = a.nodes.find((n: any) => n.ty === "positions" && n.rep !== false && a.graphName(n) === "Mount");
    let best: any = null, bd = -1;
    for (const n of a.nodes) {
      if (n.ty !== "positions" || n.rep === false || !/ Top$/.test(n.t || "")) continue;
      if (!a.adj[n.idx].some((k: number) => a.nodes[k].ty !== "positions")) continue;
      const d = Math.hypot(n.x - m.x, n.y - m.y);
      if (d > bd) { bd = d; best = n; }
    }
    return best.t as string;
  });

const pickFar = (page: Page, fromName: string) =>
  page.evaluate((name) => {
    const a = (window as any).__neural;
    const to = a.nodes.findIndex((n: any) => n.ty === "positions" && n.rep !== false && a.graphName(n) === name);
    return { to, name: a.nodes[to].t };
  }, fromName);

const seedFilm = (page: Page, deck: string) =>
  page.evaluate((key) => {
    const w = window as any;
    w.NG_CONTENT ||= {}; w.NG_CONTENT.decks ||= {};
    w.NG_CONTENT.decks[key] = { clips: [{ id: "aQ2vFXXBn-o", title: "Film for the camera journey" }] };
  }, deck);

/** Pane → Explore → Positions, by mouse, and tag the "Mount" row; the click itself is separate so
 *  the at-rest frame before it is sampled AFTER the pane's own navigation has pumped its time. */
const openMountInExplore = async (page: Page, j: ReturnType<typeof journey>) => {
  // the DSL boot pre-completes the White track, so a landing can mint a patch whose phone toast
  // (`.ng-challenge-reward`) covers the pane's tabs for 4.8s — dismiss it the way a player would
  // (landcard-deck.spec.ts does the same)
  if (await page.locator("[data-reward-close]").isVisible())
    await j.clickByMouse("[data-reward-close]", "dismiss the harness visitor's earned patch");
  await j.clickByMouse(".ng-logo", "the logo opens the pane");
  await j.advance(400);
  await j.clickByMouse("[data-view='explore']", "the Explore tab");
  await page.evaluate(() => { const a = (window as any).__neural; a._ensureSystems(); a._ensureConcepts(); });
  await expect.poll(() => page.evaluate(() => { const a = (window as any).__neural; return !!a.systems && (a.concepts || []).length > 0; }), { timeout: 20_000 }).toBe(true);
  await j.advance(200);
  if ((await page.locator('[data-explore-section="Positions"]').getAttribute("aria-expanded")) !== "true")
    await j.clickByMouse('[data-explore-section="Positions"]', "the Positions section");
  await j.advance(200);
  // the row is a button whose accessible name is "Mount aka Full Mount"; tag it to click by mouse
  const tagged = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll("button")).find((x) => (x.textContent || "").trim() === "Mount aka Full Mount");
    if (!b) return false;
    b.setAttribute("data-cam-test", "mount"); b.scrollIntoView({ block: "center" }); return true;
  });
  expect(tagged, "the Explore list shows Mount").toBe(true);
};
const clickMount = async (page: Page, j: ReturnType<typeof journey>) => {
  await j.clickByMouse('[data-cam-test="mount"]', "read Mount from Explore");
  await expect(page.locator('[data-reader-ready="true"]')).toBeVisible();
};

for (const viewport of VIEWPORTS) {
  const W = viewport.width;
  test.describe(`${W}px camera continuity`, () => {
    test.use({ viewport, ...(W === 390 ? { hasTouch: true } : {}) });

    test("roll start: the intro and the staged arrival glide, every frame within the bounds @curated", async ({ page }) => {
      const j = journey(page);
      await j.boot("/");
      await j.rig("ai-skill", [0.5]); await j.rig("role", [0]); await j.rig("max-moves", [0.5]);
      const S = await record(page, 60 * 10);   // intro 3.2 s + arrival 6.2 s + settle
      const m = expectContinuous(S, W, "roll start");
      expectClearOfRows(S, W, "roll start");
      // v1.237.0: the opening is a directed pose per frame (`_openingPose`), not a flight. Either way a
      // run that drove neither measures only the spring.
      const directed = await page.evaluate(() => (window as any).__neural._camPoses || 0);
      expect(directed, "the arrival was directed (a run with no directed frame measures only the spring)").toBeGreaterThan(300);
      test.info().annotations.push({ type: "motion", description: JSON.stringify(m) });
    });

    test("URL arrival: from the intro to the staged board, every frame within the bounds", async ({ page }) => {
      const j = journey(page);
      await j.boot("/Positions/Mount");
      const S = await record(page, 60 * 7);
      expectContinuous(S, W, "URL arrival");
      expectClearOfRows(S, W, "URL arrival");
    });

    // NON-KILL, recorded (D-338, 2026-10-20): execution-node-band-removed (D-329's node-band
    // preference replaced by the free-space search) now passes here at 390px. Since D-338 the lifted
    // Videos section is occupied space above the hand, so the free search lands in the node band
    // anyway and the two framings coincide in this journey: measured only WITH a Videos section, so the
    // band preference is gated by the no-Videos variant below (D5-S3), not here.
    test("an exchange lands on a new current node: every frame within the bounds, and clear of the rows", async ({ page }) => {
      const j = journey(page);
      await j.boot("/");
      await j.land("Mount Top");
      await seedFilm(page, "Side Control|Top");   // the landing's film row mounts WITH it: predictable
      await j.rig("resolve", [0]); await j.rig("outcome", Array(32).fill(0)); await j.rig("opp-finish", [0.99]);
      const opt = await page.evaluate(() => {
        const a = (window as any).__neural;
        const o = (a.optionIdxs || []).map((i: number) => a.nodes[i]).find((n: any) => n.ty === "transitions");
        return o ? o.t : null;
      });
      expect(opt, "the hand deals a transition").toBeTruthy();
      // D-354 (B2's class, by mechanism): H95 saw noFit on every frame here once, with no trace kept,
      // and 0 of 30 since (20 isolated, 10 under a 30% CPU quota). On CI, roll-execution's identical phone
      // pick was force-scrolled by card.click()'s retry while the reader still laid out, putting Videos
      // across the node band. So the phone waits for the layout, brings the card in along its tray, and
      // presses with a mouse that cannot scroll; the arrival scrollTop is asserted at the pointerdown.
      if (W < 640) await phonePick(page, j, opt!); else await j.pick(opt!);
      const S = await record(page, 60 * 6);
      // D-331 S1: the exchange's execution always found a slot (D-322/D-329), never the unfitted target.
      const execFrame = await page.evaluate(() => (window as any).__neural._execFrame || { noFrame: 0, noFit: 0 });
      expect(execFrame.noFit, "no execution frame fell back to the unfitted target").toBe(0);
      expectContinuous(S, W, "exchange");
      expectClearOfRows(S, W, "exchange");
      const landed = S.findIndex((x, i) => i > 0 && x.fi !== S[0].fi && x.rows != null);
      expect(landed, "the exchange landed inside the sampled window").toBeGreaterThan(0);
    });

    // D5-S3 (D-347): the same exchange from a node whose article has NO Videos section, the state the
    // lifted-Videos equivalence above does not cover.
    // NON-KILL, recorded (D-350b, H45, against a green baseline): execution-node-band-removed passes
    // here too. Since D-338 everything below the 390 band is article content (the Moves section, the
    // column) that frameExecution's free search already counts as occupied, so the free search lands
    // in the node band and D-329's preference coincides with it at this width. Clearing the rows, the
    // claim the preference serves, holds without it; the preference itself is ungated here.
    if (W === 390) test("an exchange from a node with no Videos section lands clear of the rows", async ({ page }) => {
      const j = journey(page);
      await j.boot("/");
      await j.land("Reverse Mount Top");
      await j.rig("resolve", [0]); await j.rig("outcome", Array(32).fill(0)); await j.rig("opp-finish", [0.99]);
      await expect(page.locator('[data-reader-ready="true"]')).toBeVisible();
      expect(await page.evaluate(() => { const r = (window as any).__neural._reader; return { videos: r.sections.some((s: any) => s.type === "videos"), lifted: !!r.videoCard } }),
        "premise: the article read during the exchange has no Videos section").toEqual({ videos: false, lifted: false });
      const opt = await page.evaluate(() => {
        const a = (window as any).__neural;
        const o = (a.optionIdxs || []).map((i: number) => a.nodes[i]).find((n: any) => n.ty === "transitions");
        return o ? o.t : null;
      });
      expect(opt, "the hand deals a transition").toBeTruthy();
      // D9-N2: the same phone pick and premise as the exchange above.
      if (W < 640) await phonePick(page, j, opt!); else await j.pick(opt!);
      const S = await record(page, 60 * 6);
      const execFrame = await page.evaluate(() => (window as any).__neural._execFrame || { noFrame: 0, noFit: 0 });
      expect(execFrame.noFit, "no execution frame fell back to the unfitted target").toBe(0);
      expectContinuous(S, W, "exchange without Videos");
      expectClearOfRows(S, W, "exchange without Videos");
      const landed = S.findIndex((x, i) => i > 0 && x.fi !== S[0].fi && x.rows != null);
      expect(landed, "the exchange landed inside the sampled window").toBeGreaterThan(0);
    });

    test("control: the share-list flight stays within the bounds", async ({ page }) => {
      const j = journey(page);
      await j.boot("/");
      await j.land("Mount Top");
      const ids = await page.evaluate(() => {
        const a = (window as any).__neural;
        return (a.adj[a.currentPos] || []).map((i: number) => a.nodes[i]).filter((x: any) => x && typeof x.o === "number" && x.ty !== "positions").slice(0, 5).map((x: any) => x.idx);
      });
      expect(ids.length).toBe(5);
      // stand far away first, then light the class: the lease's flight is the subject
      await page.evaluate(() => { const a = (window as any).__neural; a.camTarget = { ...a.camTarget, cx: a.cam.cx + a.graphW * 0.6 }; });
      await j.advance(2500);
      await page.evaluate((idxs) => (window as any).__neural.frameNodes(idxs), ids);
      const S = await record(page, 60 * 3);
      expectContinuous(S, W, "share-list flight");
    });

    for (const layers of [
      { film: true, card: true, hand: true },
      { film: false, card: true, hand: true },
      { film: true, card: false, hand: false },
      { film: false, card: false, hand: false },
    ]) {
      const name = Object.entries(layers).map(([k, v]) => k + (v ? "+" : "-")).join(" ");
      test(`Explore → Mount by mouse (${name}): glides there, and lands in the visible rect's central band`, async ({ page }) => {
        const j = journey(page);
        await j.boot("/");
        await j.land(await farFromMount(page));   // far from Mount, so the flight is a real one
        await seedFilm(page, "Mount|Top");
        await page.evaluate((L) => {
          const a = (window as any).__neural;
          a.setLayer("film", L.film, "test"); a.setLayer("card", L.card, "test"); a.setLayer("hand", L.hand, "test");
        }, layers);
        await j.advance(1500);
        const target = await pickFar(page, "Mount");
        await openMountInExplore(page, j);
        const S = [await frame(page)];          // at rest: the click's first frame is a kick from here
        await clickMount(page, j);
        S.push(...(await record(page, 60 * 3)));
        expectContinuous(S, W, `Explore → Mount (${name})`);
        const last = S[S.length - 1];
        expect(last.fi === target.to || (await page.evaluate((i) => (window as any).__neural.nodes[i].pi, target.to)) === last.fi,
          "the clicked node is the focus").toBe(true);
        // STALE CONTRACT (D-318 U4a, CI 48be3a910): with the article shown the visible graph rect is
        // the reader's reserved node band (what _viewRect returns), so its central band is measured there.
        const band = await page.evaluate(() => { const a = (window as any).__neural; return a.get("readerBook", true) ? a._reader?.nodeBand : null; });
        const R = band ? { ...visibleRect(last), top: band.top, bottom: band.bottom } : visibleRect(last);
        const w = R.right - R.left, h = R.bottom - R.top;
        const info = JSON.stringify({ R, node: [last.fx, last.fy], lo: last.lo, rows: last.rows });
        // the central band: the middle 40% vertically, the middle 70% horizontally (the composition
        // biases left, and a phone centres the orb+label block, so the orb sits left of centre)
        expect(last.fy!, `central band (vertical) ${info}`).toBeGreaterThan(R.top + h * 0.3);
        expect(last.fy!, `central band (vertical) ${info}`).toBeLessThan(R.bottom - h * 0.3);
        expect(last.fx!, `central band (horizontal) ${info}`).toBeGreaterThan(R.left + w * 0.15);
        expect(last.fx!, `central band (horizontal) ${info}`).toBeLessThan(R.right - w * 0.15);
        if (last.rows != null) expect(last.lo!, `not under a layer ${info}`).toBeLessThan(last.rows - 2);
        expect(last.lo!, `clear of the occupied article/shelf band ${info}`).toBeLessThan(R.bottom + 10);
        // not the screen centre, wherever the visible rect's centre is somewhere else
        const rectMid = (R.top + R.bottom) / 2;
        if (Math.abs(rectMid - last.H / 2) > 60)
          expect(Math.abs(last.fy! - last.H / 2), `centred on the visible rect, not the screen ${info}`).toBeGreaterThan(40);
      });
    }

    /** Rows the camera cannot see coming: from the frame they mount, the node is clear within
     *  CLEAR_SEC and stays clear, and every frame keeps the motion bounds. */
    const expectClearedWithin = (S: Sample[], what: string) => {
      const info = JSON.stringify(S.slice(0, 30).map((x) => [Math.round(x.lo!), Math.round(x.rows!)]));
      const firstClear = S.findIndex((x) => x.lo! < x.rows! - 2);
      expect(firstClear, `CLEAR_SEC ${what}: never cleared ${info}`).toBeGreaterThanOrEqual(0);
      expect(firstClear / 60, `CLEAR_SEC ${what}: cleared within ${CLEAR_SEC}s ${info}`).toBeLessThanOrEqual(CLEAR_SEC);
      for (const [i, x] of S.entries()) if (i >= firstClear)
        expect(x.lo!, `CLEAR_SEC ${what}: stays clear (frame ${i}) ${info}`).toBeLessThan(x.rows! - 2);
      return firstClear;
    };

    test("an escape: the catch keeps its own framing through the pick, and the landing glides — every frame within the bounds", async ({ page }) => {
      // DEVMV31-CAM (v1.218.1, PR 265): a picked escape runs startExecution with `_execution.camera =
      // false`, so its stand-in does NOT take the camera and the catch keeps its frameNodes framing.
      // That seat recorded the camera half as a non-kill; this pins it, and the whole sequence's motion.
      const j = journey(page);
      await j.boot("/Submissions/Triangle-Choke/from-Triangle-Control/Defender");   // card-click-contract's seat
      await j.advance(4000);
      await expect.poll(async () => { await j.advance(200); return page.evaluate(() => ((window as any).__neural._optionCards || []).filter((c: any) => !c.opt.threat && c.opt.action === "escape").length); }, { timeout: 20_000 }).toBeGreaterThan(0);
      const S = await record(page, 60 * 2);                 // the catch's framing settles
      const title = await page.evaluate(() => {
        const a = (window as any).__neural;
        a._handTouched = true;
        const hit = (a._optionCards || []).find((c: any) => !c.opt.threat && c.opt.action === "escape");
        hit.card.setAttribute("data-cam-test", "escape");
        hit.card.scrollIntoView({ inline: "nearest", block: "nearest" });
        return hit.card.querySelector(".ngchoice-title").textContent.trim();
      });
      await j.rig("escape", [0]);
      await j.advance(400);                                  // the dealt card's ease-in comes to rest
      S.push(...(await record(page, 1)));
      const pickAt = S.length;
      await j.clickByMouse('[data-cam-test="escape"] .ngchoice-title', `the escape "${title}"`);
      S.push(...(await record(page, 60 * 5)));
      // The end is read 2.5s after the LANDING, not at a fixed time after the pick: the escape's travel
      // runs on game time that async work can stretch (3.3s, and 4.7s under 4x CPU, D-332 claude-verify
      // H5cpu), and a landing 0.3s before the end of a fixed window is still mid-flight.
      const landed = S.findIndex((x, i) => i >= pickAt && !x.why?.exec);
      if (landed > 0 && S.length - landed < 150) S.push(...(await record(page, 150 - (S.length - landed))));
      expectContinuous(S, W, "escape", false);   // the catch is still flying in when sampling starts
      // THE CATCH OWNS THE CAMERA until the landing: from the pick, while the escape executes, the view
      // keeps the catch's zoom — the stand-in taking the camera would fly to the escape at roll zoom
      const landAt = S.findIndex((x, i) => i >= pickAt && !x.why?.exec);
      expect(landAt, "the escape landed (its execution ended) inside the window").toBeGreaterThan(pickAt);
      const vw0 = S[pickAt].vw;
      for (let i = pickAt; i < landAt; i++)
        expect(Math.abs(S[i].vw / vw0 - 1), `the catch keeps its framing through the escape (frame ${i}) ${JSON.stringify(S[i])}`).toBeLessThan(0.03);
      // THE LANDING HANDS THE CAMERA TO THE ROLL: the canonical seat you land on need not be one of
      // the escape destinations the catch framed (here it is off-screen), so the camera must fly there
      // — not sit on the catch until the click's 4s activity latch and the catch's lease run out
      const flew = S.slice(landAt, landAt + 30).some((x) => x.why?.fl);
      expect(flew, `the landing hands the camera to the roll ${JSON.stringify(S.slice(landAt, landAt + 3))}`).toBe(true);
      const end = S[S.length - 1];
      // D-333 D3-N1: the landing's flight has no fixed length, so a longer one fails here as a premise,
      // not as a framing failure.
      expect(end.why?.fl ?? null, `premise: the end is read after the landing's flight ${JSON.stringify(end)}`).toBeNull();
      const R = visibleRect(end);
      expect(end.fy!, `the landed node ends in the visible rect ${JSON.stringify(end)}`).toBeGreaterThan(R.top);
      expect(end.lo!, `...clear of the rows ${JSON.stringify(end)}`).toBeLessThan(end.rows != null ? end.rows - 2 : end.H);
      expect(end.fx!, `...on screen ${JSON.stringify(end)}`).toBeGreaterThan(R.left);
      expect(end.fx!, `...on screen ${JSON.stringify(end)}`).toBeLessThan(R.right);
    });

    test("an escape picked AFTER the catch's lease: its stand-in still does not take the camera", async ({ page }) => {
      // `_execution.camera = false` is redundant while the catch's 7s lease lives (the lease outranks
      // every automatic camera). It is what decides a LATE pick: without it the stand-in would take the
      // camera and dive to the escape's roll framing; with it the roll's own follow-cam keeps tracking
      // the escape's travel at the travel zoom (`rollCamTarget`'s `moving`).
      const j = journey(page);
      await j.boot("/Submissions/Triangle-Choke/from-Triangle-Control/Defender");
      await j.advance(4000);
      await expect.poll(async () => { await j.advance(200); return page.evaluate(() => ((window as any).__neural._optionCards || []).filter((c: any) => !c.opt.threat && c.opt.action === "escape").length); }, { timeout: 20_000 }).toBeGreaterThan(0);
      await expect(page.locator('[data-reader-ready="true"]')).toBeVisible();
      await page.waitForTimeout(350); // finish deferred layout before the at-rest mouse sample
      await j.advance(8000);                                 // the catch's lease (camHoldSec 7) has run out
      expect(await page.evaluate(() => (window as any).__neural.camHeld()), "the lease is over").toBe(false);
      const title = await page.evaluate(() => {
        const a = (window as any).__neural;
        a._handTouched = true;
        const hit = (a._optionCards || []).find((c: any) => !c.opt.threat && c.opt.action === "escape");
        hit.card.setAttribute("data-cam-test", "escape");
        hit.card.scrollIntoView({ inline: "nearest", block: "nearest" });
        return hit.card.querySelector(".ngchoice-title").textContent.trim();
      });
      await j.rig("escape", [0]);
      const S = [await frame(page)];
      await j.clickByMouse('[data-cam-test="escape"] .ngchoice-title', `the escape "${title}"`);
      S.push(...(await record(page, 60 * 4)));
      expectContinuous(S, W, "late escape", false);
      // the stand-in's own framing is the escape's TECHNIQUE node, which is not on the escape's path
      // ([submission -> destination]); the roll's follow-cam tracks the travelling light instead. So:
      // while the escape executes, the light the player is watching stays on the glass, every frame.
      const during = S.filter((x) => x.why?.exec && x.head);
      expect(during.length, "frames while the escape travels").toBeGreaterThan(10);
      for (const x of during)
        expect(x.head![0] >= 0 && x.head![0] <= x.W && x.head![1] >= 0 && x.head![1] <= x.H,
          `the stand-in does not take the camera: the escape's light stays on screen ${JSON.stringify(x)}`).toBe(true);
    });

    test("an escape picked just inside the catch's window keeps the catch framing through its whole travel", async ({ page }) => {
      // CI 105c5f110: the window was re-read every frame, so an escape picked inside it lost the
      // catch's framing the moment its travel outlived the window (4x CPU: 3 of 6 red, both widths).
      // The verdict is the pick's, kept to the landing: pick 0.4s before the window closes, so the
      // travel deterministically crosses it.
      const j = journey(page);
      await j.boot("/Submissions/Triangle-Choke/from-Triangle-Control/Defender");
      await j.advance(4000);
      await expect.poll(async () => { await j.advance(200); return page.evaluate(() => ((window as any).__neural._optionCards || []).filter((c: any) => !c.opt.threat && c.opt.action === "escape").length); }, { timeout: 20_000 }).toBeGreaterThan(0);
      await expect(page.locator('[data-reader-ready="true"]')).toBeVisible();
      await page.waitForTimeout(350); // finish deferred layout before the at-rest mouse sample
      const left = await page.evaluate(() => { const a = (window as any).__neural; return a._calmCatchUntil - a.now; });
      expect(left, "premise: the calm catch's window is live").toBeGreaterThan(1);
      await j.advance(Math.floor((left - 0.4) * 1000));
      const until = await page.evaluate(() => (window as any).__neural._calmCatchUntil);
      const title = await page.evaluate(() => {
        const a = (window as any).__neural;
        a._handTouched = true;
        const hit = (a._optionCards || []).find((c: any) => !c.opt.threat && c.opt.action === "escape");
        hit.card.setAttribute("data-cam-test", "escape");
        hit.card.scrollIntoView({ inline: "nearest", block: "nearest" });
        return hit.card.querySelector(".ngchoice-title").textContent.trim();
      });
      await j.rig("escape", [0]);
      const S = [await frame(page)];
      expect(until - S[0].t, "premise: picked inside the window, under half a second before it closes").toBeGreaterThan(0);
      expect(until - S[0].t).toBeLessThan(0.5);
      await j.clickByMouse('[data-cam-test="escape"] .ngchoice-title', `the escape "${title}"`);
      S.push(...(await record(page, 60 * 6)));
      const landAt = S.findIndex((x, i) => i > 0 && !x.why?.exec);
      expect(landAt, "the escape landed inside the recording").toBeGreaterThan(1);
      expect(S[landAt].t, "premise: the travel outlived the window").toBeGreaterThan(until + 0.2);
      const vw0 = S[0].vw;
      for (let i = 1; i < landAt; i++)
        expect(Math.abs(S[i].vw / vw0 - 1), `an escape picked inside the window keeps the catch framing to the landing (frame ${i}) ${JSON.stringify(S[i])}`).toBeLessThan(0.03);
    });

    // STALE CONTRACT (D-338, no View menu): the article view has no Book control, so these map-view
    // camera rules boot with the article away, as a returning reader left it (the persisted setting
    // the retired click wrote). The clearance claims are unchanged.
    test("CLEAR_SEC: a card the player turns back on mounts over the node, and is cleared within the rule", async ({ page }) => {
      const j = journey(page);
      await j.boot("/", { initialState: { v: 2, settings: { readerBook: false }, settingsAt: {} } });
      await j.land("Mount Top");
      // every layer off: nothing bounds the graph, so the node is framed at the screen's middle
      await expect(page.locator('[data-reader-ready="true"]')).toHaveCount(1);
      await page.evaluate(() => { const a = (window as any).__neural; for (const k of ["film", "card", "hand"]) a.setLayer(k, false, "test"); });
      await j.readerLayoutSettled();
      await j.advance(6000); // let any input lease and the resulting flight settle
      const before = await frame(page);
      expect(before.rows, "no rows while every layer is off").toBeNull();
      // the player turns the card and the hand back on (the layer dock): rows the camera did not predict
      await page.evaluate(() => { const a = (window as any).__neural; a.setLayer("card", true, "test"); a.setLayer("hand", true, "test"); });
      const S = await record(page, 60 * 2);
      expect(S[0].rows, "the rows mounted").not.toBeNull();
      // NON-VACUITY: the row came up OVER the node; a scenario where it did not would pass vacuously
      expect(S[0].lo!, `the card mounted over the node ${JSON.stringify(S[0])}`).toBeGreaterThan(S[0].rows! - 2);
      expectContinuous([before, ...S], W, "a row turned on");
      expectClearedWithin(S, "a row turned on");
    });

    test("CLEAR_SEC: a film row whose content arrives after the landing never stays over the node", async ({ page }) => {
      const j = journey(page);
      await j.boot("/", { initialState: { v: 2, settings: { readerBook: false }, settingsAt: {} } });
      await j.land("Mount Top");          // the harness serves no clips: no film row at the landing
      await expect(page.locator('[data-reader-ready="true"]')).toHaveCount(1);
      // A small A film fits beside practice without moving the camera. Put the
      // other surfaces away so the late film alone changes an unbounded band.
      await page.evaluate(() => { const a = (window as any).__neural; a.setLayer("card", false, "test"); a.setLayer("hand", false, "test"); });
      await j.readerLayoutSettled();
      await j.advance(6000); // let the mouse-input camera lease and the resulting flight settle
      const before = await frame(page);
      expect(before.film, "no film row before its content arrives").toBeNull();
      // the content arrives late: the same path a hydrated dossier chunk takes
      await seedFilm(page, "Mount|Top");
      await page.evaluate(() => {
        const a = (window as any).__neural;
        a._refreshReadingContent();
      });
      const S = await record(page, 60 * 2);
      const visible = S.findIndex(s => s.film != null);
      expect(visible, "the late film row mounted after its coalesced layout frame").toBeGreaterThanOrEqual(0);
      expectContinuous([before, ...S], W, "late film row");
      expectClearedWithin(S.slice(visible), "late film row");
    });
  });
}
