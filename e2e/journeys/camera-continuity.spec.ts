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
 * ZERO overlap is asserted on every frame: the roll start (beat 1 lifts the wide framing), the URL
 * arrival (the intro's parting overview lifts), the exchange (travel frames into the landing's band)
 * — here — and the staged restart in `landing-reveal.spec.ts`. The one rule that is not zero is for a
 * row the camera cannot see coming:
 *   CLEAR_SEC  a row that mounts UNANNOUNCED — a film row whose content arrives after the landing —
 *              is cleared within CLEAR_SEC, and every frame after that is clear.
 * Other unannounced cases the same rule covers (not separately journeyed): a card taller than any
 * this viewport has measured for its row set, and the very first landing at a viewport, whose
 * prediction is a guess (`_predictBottom`).
 *
 * ITEM 2: the clicked node projects inside the CENTRAL BAND of the visible graph rect, measured from
 * the DOM here (pane right edge; announcer bottom; the highest visible bottom row), with the layers
 * on and off. Not the screen centre (asserted to differ where the rect's centre does), not under a
 * layer.
 *
 * Mutants (all red by name): see the archive entry for v1.219.0 and the table at the end of this
 * header.
 *   restore the hard band clamp                       → "MOVE" (explore 1440, exchange 390)
 *   first-order easing instead of the eased flight    → "KICK"
 *   a flight with no zoom-out arc (pivot always)      → "MOVE" (explore)
 *   zero-length flights (snap to the target)          → "MOVE" (asserted first; "ZOOM" by firstorder)
 *   `_viewRect` ignores the bottom rows               → "central band"
 *   the lift's edge takes 1 s                         → the lift unit (camera_motion.test.mjs); here
 *                                                       the re-aimed flight still clears the node in time
 *   ...and flights take ≥1.5 s too (slow clearing)    → "CLEAR_SEC"
 *   no pre-lift (the arrival makes no room)           → "ZERO overlap" (roll start, URL arrival)
 *   no prediction (`ahead` ignored)                   → "ZERO overlap" (exchange)
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
  fi: number; fx: number | null; fy: number | null; lo: number | null;
  rows: number | null; film: number | null; pane: number; evBottom: number; head?: number[] | null; why?: any;
};

/** One frame: pump 1/60 s, then read what the frame drew. */
const frame = (page: Page) =>
  page.evaluate(() => {
    const a = (window as any).__neural;
    a.advance(1000 / 60);
    const W = a.W, H = a.H, s = W / a.cam.vw;
    const n = a.focusIdx >= 0 ? a.nodes[a.focusIdx] : null;
    let fx = null, fy = null, lo = null;
    if (n) {
      const mid = a.pairMid(n);
      fx = W / 2 + (mid.x - a.cam.cx) * s;
      fy = H / 2 + (mid.y - a.cam.cy) * s;
      const nodeK = Math.max(0.4, Math.min(1, a.cam.vw / (a.graphW * 0.5)));
      lo = -1e9;
      for (const q of [n, n.pi >= 0 ? a.nodes[n.pi] : null]) {
        if (!q) continue;
        lo = Math.max(lo, H / 2 + (a._LY(q) - a.cam.cy) * s + q.r * nodeK * s * 1.6);
      }
    }
    const shown = (el: any) => el && el.offsetHeight && getComputedStyle(el).display !== "none";
    const tops = [a._landEl, a._landFilmEl, a._handShown() && a.optionsRef.current]
      .filter(shown).map((el: HTMLElement) => el.getBoundingClientRect().top).filter((y: number) => y > 48);
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
    return { t: a.now, W, H, cx: a.cam.cx, cy: a.cam.cy, vw: a.cam.vw, fi: a.focusIdx, fx, fy, lo,
      rows: tops.length ? Math.min(...tops) : null, film, pane, evBottom, head, why } as any;
  }) as Promise<Sample>;

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
 *  highest row by 2px — the landing-reveal spec's own test. */
const expectClearOfRows = (S: Sample[], width: number, what: string) => {
  const up = S.filter((x) => x.fi >= 0 && x.rows != null && x.lo != null);
  expect(up.length, `ZERO overlap ${what}: frames with a focus and rows up`).toBeGreaterThan(30);
  for (const x of up) expect(x.lo!, `ZERO overlap ${what} @${width}: ${JSON.stringify(x)}`).toBeLessThan(x.rows! - 2);
};

/** The visible graph rect, measured from the DOM (not asked of the app). */
const visibleRect = (x: Sample) => {
  const top = Math.max(16, x.evBottom ? x.evBottom + 12 : 16);
  const bottom = x.rows != null ? x.rows - 12 : x.H - 16;
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
const clickMount = (j: ReturnType<typeof journey>) => j.clickByMouse('[data-cam-test="mount"]', "the Mount row in Explore");

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
      const flights = await page.evaluate(() => (window as any).__neural._camFlights || 0);
      expect(flights, "the arrival flew (a run with no flight measures only the spring)").toBeGreaterThan(0);
      test.info().annotations.push({ type: "motion", description: JSON.stringify(m) });
    });

    test("URL arrival: from the intro to the staged board, every frame within the bounds", async ({ page }) => {
      const j = journey(page);
      await j.boot("/Positions/Mount");
      const S = await record(page, 60 * 7);
      expectContinuous(S, W, "URL arrival");
      expectClearOfRows(S, W, "URL arrival");
    });

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
      await j.pick(opt!);
      const S = await record(page, 60 * 6);
      expectContinuous(S, W, "exchange");
      expectClearOfRows(S, W, "exchange");
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
        await clickMount(j);
        S.push(...(await record(page, 60 * 3)));
        expectContinuous(S, W, `Explore → Mount (${name})`);
        const last = S[S.length - 1];
        expect(last.fi === target.to || (await page.evaluate((i) => (window as any).__neural.nodes[i].pi, target.to)) === last.fi,
          "the clicked node is the focus").toBe(true);
        const R = visibleRect(last);
        const w = R.right - R.left, h = R.bottom - R.top;
        const info = JSON.stringify({ R, node: [last.fx, last.fy], lo: last.lo, rows: last.rows });
        // the central band: the middle 40% vertically, the middle 70% horizontally (the composition
        // biases left, and a phone centres the orb+label block, so the orb sits left of centre)
        expect(last.fy!, `central band (vertical) ${info}`).toBeGreaterThan(R.top + h * 0.3);
        expect(last.fy!, `central band (vertical) ${info}`).toBeLessThan(R.bottom - h * 0.3);
        expect(last.fx!, `central band (horizontal) ${info}`).toBeGreaterThan(R.left + w * 0.15);
        expect(last.fx!, `central band (horizontal) ${info}`).toBeLessThan(R.right - w * 0.15);
        if (last.rows != null) expect(last.lo!, `not under a layer ${info}`).toBeLessThan(last.rows - 2);
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

    test("CLEAR_SEC: a card the player turns back on mounts over the node, and is cleared within the rule", async ({ page }) => {
      const j = journey(page);
      await j.boot("/");
      await j.land("Mount Top");
      // every layer off: nothing bounds the graph, so the node is framed at the screen's middle
      await page.evaluate(() => { const a = (window as any).__neural; for (const k of ["film", "card", "hand"]) a.setLayer(k, false, "test"); });
      await j.advance(3000);
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
      await j.boot("/");
      await j.land("Mount Top");          // the harness serves no clips: no film row at the landing
      await j.advance(3000);
      const before = await frame(page);
      expect(before.film, "no film row before its content arrives").toBeNull();
      // the content arrives late: the same path a hydrated dossier chunk takes
      await seedFilm(page, "Mount|Top");
      await page.evaluate(() => (window as any).__neural._refreshReadingContent());
      const S = await record(page, 60 * 2);
      expect(S[0].film, "the late film row mounted").not.toBeNull();
      expectContinuous([before, ...S], W, "late film row");
      expectClearedWithin(S, "late film row");
    });
  });
}
