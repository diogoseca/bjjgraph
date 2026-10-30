import { test, expect, type Page } from "@playwright/test";
import { journey } from "../dsl";

/**
 * THE OPENING AND EVERY STAGED RESTART ARE DIRECTED (v1.237.0, owner U48 → U50 d, "S2 · Z2").
 *
 * Owner, 2026-10-27, on the round-1 preview: "It seems weird that the graph ... moves up. It would make
 * sense if the scaffold was already appearing ... the zoom should already have started in the first
 * frames and accelerate ... until we land on the node (... so it lands smoothly rather than abruptly)".
 * Measured on the old arrival (Mount Top, 390x844): the wide graph panned 317px up over an empty screen
 * (beat 1's pre-lift aims at `_predictBottom`'s H*0.1 guess), 95px past its landing, and came back
 * down; the board then appeared at full opacity on one frame and the heading jumped 251px. Four
 * variants were built and shown side by side; the owner picked S2 · Z2 (`_openingPose`, NG_CAM_OPEN_*).
 *
 * EVERY NUMBER IS READ THROUGH draw()'s TRANSFORM (CLAUDE.md 6.2), one pumped 1/60 s frame at a time,
 * never from `camTarget`. The board's styles are wrap state (`data-ng-open`, NG_CAM_OPEN_CSS), so they
 * are read as COMPUTED values on the elements a player sees. The claims, one assertion each:
 *   ZOOM-START   the zoom is already moving in the first half-second
 *   ZOOM-ON      ...and never stops or reverses until it lands
 *   SOFT         it touches down at rest
 *   HOLD         the named node does not move on the glass until the board mounts
 *   FADE         the board is invisible on the frame it mounts and only grows
 *   FADE-ROWS    ...and so is the Moves row, wherever it stands (with the Book put away it IS the board)
 *   FAINT        while the board is faint (opacity < 0.1) its rows are hidden: an invisible row takes no tap
 *   NO-FLASH     (Book on) no board row paints outside the reader section when the reader adopts it inside the faint
 *                window (~0.24 s), as it does here; a later adoption shows the loose row fading with the board, as
 *                dev shows it at the reveal (the B1 rule: never hidden waiting for the reader)
 *   RIDE         the board rides up with the node: node-to-Moves-row distance constant through the rise
 *   GLIDE        the heading never jumps (the old cut moved it 251px; Book off once moved it 51.9px)
 *   HOLD-ARTICLE (Book on) a restart's fading article stays where it sat in its board (the old cut: 748px)
 *   BOUNDS       camera-continuity's per-frame MOVE / KICK / ZOOM bounds hold on a restart too
 *   SNAP         reduced motion: two cuts only, the overview then the landing, and the board is never styled
 *   STALL        a clock that stops while the board is faint leaves no row hidden (the last resort)
 *   HEADING      a camera lease mid-arrival (holdCamera: a share cue, a session) still takes the heading down: its
 *                target is 0 at the arrival's end, and its fade settles within its own transition (wall clock)
 *   PAUSE        a pause during the arrival does not freeze the camera: it frames the node after the game resumes
 *   HANDOFF      two quick restarts do not pop the old board back to full
 *   INPUT        a 2px drag takes the camera at once, and nothing takes it back
 *   RELEASE      a gesture's 0.2s release leaves no state and no transition behind
 *   ASK-FAINT    while faint, a tap on #319's "Answer for Points" line does not reach the link
 *   FAINT-INERT  while faint, no control in the reader section (article links, tools, section labels) is live
 *   MOUNT        rows whose wall-clock reveal timer fires before the rAF clock reaches the reveal are styled at once
 *   PAUSE-EARLY  a pause between the pick and the reveal runs no wide zoom-out (beat 1 is retired with the arrival)
 *   FILM-FADE    (real content, a Videos row) the film's effective opacity is the section's: it fades once
 *   FILM-RIDE    ...the film-to-Moves distance is constant through the rise: it rides once
 *   FILM-FAINT   ...and the film is hidden while the board is faint, over reading.css's visible!important
 * The rows held hidden until the reader adopted them (PR #320's CI) are killed at the cold-start journeys
 * (coldstart-spine's watch-button visibility); the pick hand-over in tests/camera_opening.test.mjs.
 * Mutation kills (each at its own message, against a green control; the archive entry for v1.237.0):
 *   the rise starts at the pick → HOLD           zoom held until the pick → ZOOM-START   Z1 → SOFT
 *   the board pops at full opacity → FADE        no loose-row fade → FADE-ROWS (Book off)
 *   no faint hiding → FAINT                       S1 (no ride) → RIDE                     the heading cut → GLIDE
 *   no ride compensation in _viewRect → RIDE (Book off)                                   no article hold → HOLD-ARTICLE
 *   a 0.15s rise → BOUNDS                         reduced motion ignored → SNAP           no last resort → STALL
 *   the hide gated on the token → HEADING         a pause that takes the camera → PAUSE
 *   a retirement that ends the board on a restart → HANDOFF   a drag that does not cancel → INPUT
 *   a release that is never cleared → RELEASE     the band skips the faint rows → RIDE (Book off)
 *   the board rides against the spring's goal → RIDE (Book off)
 *   reduced motion lands before the reader adopts the rows → SNAP (Book off)
 *   the film styled as loose too (fade) → FILM-FADE (Book on)   ...(ride) → FILM-RIDE (Book off)
 *   no faint rule for the homed film → FILM-FAINT   no faint rule for the section's controls → FAINT-INERT
 *   the ask link made visible over its card's hide → ASK-FAINT
 *   the reveal timer that does not style the board → MOUNT       a retirement that keeps beat 1 → PAUSE-EARLY
 * WHAT THE HARNESS DOES NOT DO (CLAUDE.md 6.4), and so what a case here must author itself:
 *   - every content chunk is served as `{}`, so no node has a Videos row: the real-content cases inject Mount Top's
 *     content with two clips (a re-review found the film riding twice and fading at o-squared where no spec looked);
 *   - `after()` timers fire inside `advance()`, in lockstep with the game clock, so the reveal's wall-clock timer can
 *     never fire ahead of the rAF clock here: MOUNT fires it early by hand;
 *   - CSS transitions (the heading's hand-off, the release) run on the document timeline, which is WALL clock, never the
 *     pumped one: HEADING and RELEASE read them without pumping (CI's faster pump once read the heading at 0.066).
 * NOT PINNED HERE: the live frame rate (the pump is deterministic), and a wheel mid-rise, which scrolls
 * the reading column by design and so does not cancel (app.src.jsx's document capture listener).
 */

const MOVE_PX: Record<number, number> = { 1440: 120, 390: 48 };
const KICK_PX: Record<number, number> = { 1440: 14, 390: 6 };
const ZOOM_RATIO = 1.07;
const BOOK_OFF = { initialState: { v: 2, settings: { readerBook: false }, settingsAt: {} } };

type F = { t: number; el: number; W: number; H: number; cx: number; cy: number; vw: number; node: { x: number; y: number } | null;
  pick: number | null; secO: number | null; open: string; hand: number | null; handO: number | null; head: number | null;
  headO: number; article: number | null; loose: number; rowsShown: number; rowsHidden: number;
  film: number | null; filmO: number | null; filmVis: string | null; secLive: number; askHit: boolean | null };
// `article` is measured from the board's own top: in a restart the board sinks while it fades, on purpose

const frame = (page: Page) => page.evaluate(() => {
  const a = (window as any).__neural;
  a.advance(1000 / 60);
  const W = a.W, H = a.H, s = W / a.cam.vw;
  const n = a.currentPos != null && a.currentPos >= 0 ? a.nodes[a.currentPos] : null, mid = n ? a.pairMid(n) : null;
  const sec = a._readerEl || a._reader?.root;
  const shown = (el: any) => el && el.isConnected && el.offsetHeight && getComputedStyle(el).display !== "none";
  const eff = (el: any) => { let o = 1; for (let q = el; q && q.nodeType === 1; q = q.parentElement) o *= parseFloat(getComputedStyle(q).opacity); return o; };
  const secO = shown(sec) ? eff(sec) : null;
  const handEl = a._handShown?.() && shown(a.optionsRef?.current) && a.optionsRef.current.offsetHeight > 40 ? a.optionsRef.current : null;
  const box = a.evCenterRef.current, blk = box?.firstElementChild, br = blk?.getBoundingClientRect();
  const art = a._reader?.articleEl;
  // a card of any height counts: #319's asking line is ~37px (the re-review's m-e)
  const rows = [a._landFilmEl, a._landEl, a.optionsRef?.current].filter((el: any) => el && el.isConnected && el.offsetHeight > (el === a._landEl ? 0 : 40));
  const film = a._landFilmEl && shown(a._landFilmEl) && a._landFilmEl.offsetHeight > 40 ? a._landFilmEl : null;
  const open = a.wrapRef.current.dataset.ngOpen || "";
  // the section's own controls a tap or Tab could reach (only counted while faint: it walks the article)
  const secLive = open === "faint" && sec ? [...sec.querySelectorAll("a,button,input,select,textarea,summary,[tabindex]")]
    .filter((e: any) => e.getAttribute("tabindex") !== "-1" && getComputedStyle(e).visibility !== "hidden" && e.getClientRects().length).length : 0;
  // #319's interplay: what a tap at the centre of "Answer for Points" reaches while faint (null: no link, or not faint)
  const go = open === "faint" ? document.querySelector("[data-land-ask-go]") as HTMLElement | null : null, gr = go?.getBoundingClientRect();
  const hit = go && gr && gr.width > 0 ? document.elementFromPoint(gr.left + gr.width / 2, gr.top + gr.height / 2) : null;
  const askHit = go && gr && gr.width > 0 ? !!hit && (hit === go || go.contains(hit)) : null;
  // a board row PAINTING outside the reader section: the old reveal frame showed Videos at y 67
  const loose = rows.filter((el: any) => !(sec && sec.isConnected && sec.contains(el)) && getComputedStyle(el).visibility !== "hidden" && eff(el) > 0.02).length;
  return { t: a.now, el: a.now - a.startTime, W, H, cx: a.cam.cx, cy: a.cam.cy, vw: a.cam.vw,
    node: mid ? { x: W / 2 + (mid.x - a.cam.cx) * s, y: H / 2 + (mid.y - a.cam.cy) * s } : null,
    pick: a._camOpen?.pick ?? null, secO, open,
    film: film ? film.getBoundingClientRect().top : null, filmO: film ? eff(film) : null, filmVis: film ? getComputedStyle(film).visibility : null, secLive, askHit,
    hand: handEl ? handEl.getBoundingClientRect().top : null, handO: handEl ? eff(handEl) : null,
    head: br && parseFloat(getComputedStyle(box).opacity) > 0.05 ? br.top + br.height / 2 : null, headO: parseFloat(getComputedStyle(box).opacity),
    article: shown(art) && shown(sec) ? art.getBoundingClientRect().top - sec.getBoundingClientRect().top : null, loose,
    rowsShown: rows.length, rowsHidden: rows.filter((el: any) => getComputedStyle(el).visibility === "hidden").length };
}) as Promise<F>;

const record = async (page: Page, frames: number) => { const out: F[] = []; for (let i = 0; i < frames; i++) out.push(await frame(page)); return out; };
const rigStart = (page: Page, title: string) => page.evaluate((title) => {
  const a = (window as any).__neural, m = a.nodes.filter((n: any) => n.ty === "positions" && n.rep && n.t === title);
  if (m.length !== 1) throw new Error("expected one " + title + ", got " + m.length);
  a.rigStart(m[0].idx);
}, title);
const rigAmbient = async (j: ReturnType<typeof journey>) => { await j.rig("ai-skill", [0.5]); await j.rig("role", [0]); await j.rig("max-moves", [0.5]); };
const bootTo = async (page: Page, title: string, book: "on" | "off" = "on") => {
  const j = journey(page);
  await j.boot("/", book === "off" ? BOOK_OFF : {});
  expect(await page.evaluate(() => (window as any).__neural.get("readerBook", true)), "premise: the Book is " + book).toBe(book === "on");
  await rigAmbient(j); await rigStart(page, title);
  return j;
};

/** camera-continuity's three per-frame bounds (its header has the derivation). */
const motion = (S: F[]) => {
  let move = 0, kick = 0, zoom = 1, prev: [number, number] = [0, 0];
  for (let i = 1; i < S.length; i++) {
    const a = S[i - 1], b = S[i], s0 = a.W / a.vw, s1 = b.W / b.vw;
    let m = 0;
    for (const [px, py] of [[0, 0], [b.W, 0], [0, b.H], [b.W, b.H]])
      m = Math.max(m, Math.hypot((a.cx - b.cx) * s1 + (px - b.W / 2) * (s1 / s0 - 1), (a.cy - b.cy) * s1 + (py - b.H / 2) * (s1 / s0 - 1)));
    const c: [number, number] = [(a.cx - b.cx) * s1, (a.cy - b.cy) * s1];
    kick = Math.max(kick, Math.hypot(c[0] - prev[0], c[1] - prev[1])); prev = c;
    move = Math.max(move, m); zoom = Math.max(zoom, s1 / s0, s0 / s1);
  }
  return { move, kick, zoom };
};
const span = (xs: number[]) => (xs.length ? Math.max(...xs) - Math.min(...xs) : NaN);

for (const book of ["on", "off"] as const) {
test.describe(`the directed arrival, Book ${book}`, () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test(`first opening (Book ${book}): the zoom runs from the first frames, the node holds until the board, rises with it, lands softly @curated`, async ({ page }) => {
    await bootTo(page, "Mount Top", book);
    const S = await record(page, 613);   // the first app frame to the landing (9.2s) + 1s
    const pick = S.find((f) => f.pick != null)?.pick;
    expect(pick, "premise: the first opening was directed (a token with a pick)").toBeTruthy();
    const at = (t: number) => S.reduce((b, f) => (Math.abs(f.t - t) < Math.abs(b.t - t) ? f : b));
    const E = pick! + 2.0, land = pick! + 6.0;

    expect(S[0].vw / at(S[0].t + 0.5).vw, "ZOOM-START: the zoom is already moving in the first half-second").toBeGreaterThan(1.005);
    const on = S.filter((f) => f.t > S[0].t + 0.1 && f.t < land - 0.1);
    expect(on.filter((f, i) => i && !(f.vw < on[i - 1].vw)).length, "ZOOM-ON: the zoom narrows on every frame until the landing").toBe(0);
    const tail = S.filter((f) => f.t > land - 0.06 && f.t <= land + 1e-9);
    const rate = Math.max(...tail.map((f, i) => (i ? Math.abs(Math.log(f.vw / tail[i - 1].vw)) * 60 : 0)));
    expect(rate, "SOFT: it touches down at rest (ln-width per second over the last frames)").toBeLessThan(0.03);

    const held = S.filter((f) => f.t >= pick! + 0.8 && f.t < E && f.node).map((f) => f.node!);
    expect(held.length, "premise: frames between the hand-over and the board").toBeGreaterThan(60);
    expect(Math.max(span(held.map((p) => p.x)), span(held.map((p) => p.y))), "HOLD: the node does not move on the glass before the board").toBeLessThan(0.5);

    const mounted = S.filter((f) => f.t > E && f.handO != null);
    expect(mounted.length, "premise: the Moves row mounted").toBeGreaterThan(60);
    if (book === "on") {
      const sec = S.filter((f) => f.secO != null);
      expect(sec[0].secO!, "FADE: the board is invisible on the frame it mounts").toBeLessThan(0.02);
      expect(sec.filter((f, i) => i && f.secO! < sec[i - 1].secO! - 1e-6).length, "FADE: ...and its opacity only grows").toBe(0);
      expect(S.filter((f) => f.t < land && f.loose > 0).map((f) => +f.t.toFixed(3)), "NO-FLASH: no board row paints outside the reader section").toEqual([]);
    }
    expect(mounted[0].handO!, "FADE-ROWS: the Moves row is invisible on the frame it mounts").toBeLessThan(0.02);
    expect(mounted.filter((f, i) => i && f.handO! < mounted[i - 1].handO! - 1e-6).length, "FADE-ROWS: ...and only grows").toBe(0);
    const faint = S.filter((f) => f.t > E && f.open === "faint" && f.rowsShown > 0);
    expect(faint.length, "premise: the board was faint for a few frames").toBeGreaterThan(3);
    expect(faint.filter((f) => f.rowsHidden < f.rowsShown).map((f) => +f.t.toFixed(3)), "FAINT: a faint board's rows are hidden, not merely transparent").toEqual([]);
    const asking = faint.filter((f) => f.askHit != null);
    expect(asking.length, "premise: the landing asks with #319's Answer for Points line while the board is faint").toBeGreaterThan(0);
    expect(asking.filter((f) => f.askHit).map((f) => +f.t.toFixed(3)), "ASK-FAINT: a tap on Answer for Points while faint does not reach the link").toEqual([]);
    expect(faint.filter((f) => f.secLive > 0).map((f) => [+f.t.toFixed(3), f.secLive]), "FAINT-INERT: no control in the reader section is live while faint").toEqual([]);

    const rise = S.filter((f) => f.t >= E && f.t <= E + 2.0 && f.hand != null && f.node && f.handO! > 0.02);
    expect(rise.length, "premise: rise frames with the Moves row up").toBeGreaterThan(60);
    expect(span(rise.map((f) => f.hand! - f.node!.y)), "RIDE: the node stays a fixed distance above the Moves row through the rise").toBeLessThan(1.5);
    expect(rise[0].node!.y - rise.at(-1)!.node!.y, "premise: the node did rise").toBeGreaterThan(100);

    const heads = S.filter((f) => f.head != null);
    const jump = Math.max(...heads.map((f, i) => (i ? Math.abs(f.head! - heads[i - 1].head!) : 0)));
    expect(jump, "GLIDE: the heading never moves more than 20px in one frame").toBeLessThan(20);
    expect(S.at(-1)!.open, "premise: nothing of the board's state outlives the arrival").toBe("");
  });

  test(`a restart (Book ${book}) breathes out, holds the old article while it fades, and lands inside the bounds @curated`, async ({ page }) => {
    await bootTo(page, "Side Control Top", book);
    const settled = (await record(page, 630)).at(-1)!;   // the first opening, settled: where the article sits
    await rigStart(page, "Mount Top");
    await page.evaluate(() => (window as any).__neural.resetRoll());
    const S = await record(page, 414);
    const pick = S[0].pick;
    expect(pick, "premise: the restart was directed").toBeTruthy();
    const E = pick! + 2.0;
    if (book === "on") {
      expect(settled.article, "premise: the settled board shows its article").not.toBeNull();
      const fading = S.filter((f) => f.t < E && f.secO != null && f.secO > 0.01 && f.article != null);
      expect(fading.length, "premise: frames with the old board fading").toBeGreaterThan(30);
      // against the frame BEFORE the restart: the clears reflow the reader before the first recorded frame
      expect(Math.max(...fading.map((f) => Math.abs(f.article! - settled.article!))), "HOLD-ARTICLE: the fading article stays where it sat in its board").toBeLessThan(1);
    }
    const m = motion(S);
    expect(m.move, "BOUNDS: MOVE").toBeLessThanOrEqual(MOVE_PX[390]);
    expect(m.kick, "BOUNDS: KICK").toBeLessThanOrEqual(KICK_PX[390]);
    expect(m.zoom, "BOUNDS: ZOOM").toBeLessThanOrEqual(ZOOM_RATIO);
    const held = S.filter((f) => f.t >= pick! + 1.5 && f.t < E && f.node).map((f) => f.node!);
    expect(Math.max(span(held.map((p) => p.x)), span(held.map((p) => p.y))), "HOLD: the named node does not move before the board").toBeLessThan(0.5);
    expect(S.at(-1)!.open, "premise: nothing of the board's state outlives the arrival").toBe("");
  });

  test(`reduced motion (Book ${book}): the view cuts twice, the overview then the landing, and the board is never styled @curated`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await bootTo(page, "Mount Top", book);
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches), "premise: reduced motion is emulated").toBe(true);
    const S = await record(page, 613);
    // a change of VIEW is one a player could see: a hundredth of a pixel (the token's retirement re-states the
    // landing pose with float noise of 1e-10 world units, which is not a frame of motion; a snap is hundreds of px).
    // The overview is the FIRST frame's cut, so S[0] already shows it (measured: 604px at frame 1, el 0); every
    // later change is counted. Book off once landed on the loose rows and cut again 32px when the reader adopted
    // them, which a limit of two let through.
    const moves = S.filter((f, i) => i > 0 && motion([S[i - 1], f]).move > 0.01);
    expect(moves.length, "premise: the camera cut to the landing").toBeGreaterThanOrEqual(1);
    expect(moves.map((f) => +f.el.toFixed(3)), "SNAP: after the overview the camera changes view on one frame only (the landing)").toHaveLength(1);
    expect(S.filter((f) => f.open !== "").length, "SNAP: the board is never styled").toBe(0);
  });
});
}

test.describe("the directed arrival: what it hands back", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("a clock that stops while the board is faint leaves no row hidden @curated", async ({ page }) => {
    await bootTo(page, "Mount Top");
    const S = await record(page, 318);   // the reveal (pick + 2.0s, ~5.22s) and a few frames: faint
    expect(S.at(-1)!.open, "premise: the board is faint when the clock stops").toBe("faint");
    expect(S.at(-1)!.rowsHidden, "premise: its rows are hidden").toBeGreaterThan(0);
    await page.waitForTimeout(1000);   // wall clock: nothing advances the app's own (a hidden tab, a stopped test clock)
    const hidden = await page.evaluate(() => {
      const a = (window as any).__neural;
      return [a._landFilmEl, a._landEl, a.optionsRef?.current, a._layerDockEl].filter((el: any) => el && el.isConnected && getComputedStyle(el).visibility === "hidden").length;
    });
    expect(hidden, "STALL: no board row is left hidden when nothing advances the opening").toBe(0);
  });

  test("a camera lease mid-arrival still takes the heading down @curated", async ({ page }) => {
    await bootTo(page, "Mount Top");
    const before = await record(page, 255);   // ~4.25s: pick + 1.0, the heading names the node
    expect(before.at(-1)!.headO, "premise: the heading is up").toBeGreaterThan(0.9);
    await page.evaluate(() => (window as any).__neural.holdCamera(7));   // a share cue's or a session's flight
    await record(page, 360);   // to pick + 7.0
    // THE APP'S DECISION, clock-free: by the arrival's end the hand-off and the hide have both set the heading's target
    // to 0. Gated on the token a lease retires (review M1), neither ran and the target stayed "1" for good.
    expect(await page.evaluate(() => (window as any).__neural.evCenterRef.current.style.opacity), "HEADING: the arrival's end takes the heading down (its target opacity is 0)").toBe("0");
    // THE FADE ITSELF is the hand-off's CSS transition (NG_ARRIVE_HANDOFF, 1.8 s) on the document timeline, WALL clock,
    // while this recording pumps the game clock: CI's faster pump read 0.066 at the last sample, where this box's timeline
    // had run 2.4-4.0 s (CAM-CI). So it is read without pumping, until it settles, bounded at its own 1.8 s + 0.7 s.
    await expect.poll(() => page.evaluate(() => parseFloat(getComputedStyle((window as any).__neural.evCenterRef.current).opacity)),
      { message: "HEADING: ...and the heading's fade settles within its own 1.8 s transition (+0.7 s)", timeout: 2500, intervals: [25] }).toBeLessThan(0.05);
  });

  test("a pause during the arrival does not freeze the camera @curated", async ({ page }) => {
    await bootTo(page, "Mount Top");
    await record(page, 255);   // pick + 1.0
    await page.evaluate(() => (window as any).__neural.setPaused(true));   // the pane opens
    await record(page, 96);    // 1.6s with the game stopped
    await page.evaluate(() => (window as any).__neural.setPaused(false));  // ...and closes
    const S = await record(page, 300);
    const band = await page.evaluate(() => (window as any).__neural._viewRect());
    const end = S.at(-1)!;
    expect(end.node && end.node.y >= band.top && end.node.y <= band.bottom, `PAUSE: the camera frames the node in the band after the pause (node ${end.node?.y.toFixed(1)}, band ${band.top}-${band.bottom})`).toBe(true);
  });

  test("rows whose reveal timer fires before the clock reaches the reveal are styled at once, never shown unstyled @curated", async ({ page }) => {
    await bootTo(page, "Mount Top");
    await record(page, 310);   // ~5.17s: the pick (~3.22s) + 1.95, a few frames short of the reveal
    const r = await page.evaluate(() => {
      const a = (window as any).__neural, op = a._camOpen;
      if (!op || !op.reveal || op.pick == null) return null;
      const early = op.pick + a.NG_ARRIVE_KICKER - a.now;
      op.reveal._fire();   // the reveal's own wall-clock timer, as a real browser can fire it: ahead of the rAF clock
      const rows = [a._landFilmEl, a._landEl, a.optionsRef?.current].filter((el: any) => el && el.isConnected && el.offsetHeight > 0);
      return { early, open: a.wrapRef.current.dataset.ngOpen || "", rows: rows.length, visible: rows.filter((el: any) => getComputedStyle(el).visibility !== "hidden").length };
    });
    expect(r, "premise: the arrival carries its reveal timer").not.toBeNull();
    expect(r!.early, "premise: fired before the clock reached the reveal").toBeGreaterThan(0);
    expect(r!.rows, "premise: the timer mounted the rows").toBeGreaterThan(0);
    expect([r!.open, r!.visible], "MOUNT: rows mounted before the reveal are styled at once: faint, and hidden").toEqual(["faint", 0]);
  });

  test("a pause between the pick and the reveal runs no wide zoom-out @curated", async ({ page }) => {
    await bootTo(page, "Mount Top");
    await record(page, 225);   // ~3.75s: the pick + 0.5, before the reveal
    expect(await page.evaluate(() => (window as any).__neural._camOpen?.pick != null), "premise: the arrival has picked").toBe(true);
    await page.evaluate(() => (window as any).__neural.setPaused(true));
    await record(page, 30);
    await page.evaluate(() => (window as any).__neural.setPaused(false));
    const S = await record(page, 120);   // past beat 1's old deadline (pick + 2.5)
    const widest = Math.max(...S.map((f, i) => (i ? f.vw / S[i - 1].vw : 1)));
    expect(widest, "PAUSE-EARLY: after the pause the view never widens (beat 1's zoom-out-and-back is retired with the arrival)").toBeLessThan(1.002);
  });

  test("two quick restarts do not pop the old board back to full @curated", async ({ page }) => {
    await bootTo(page, "Side Control Top");
    await record(page, 630);
    await rigStart(page, "Mount Top");
    await page.evaluate(() => (window as any).__neural.resetRoll());
    const A = await record(page, 156);   // 2.6s: the first restart's board mid-rise
    expect(A.at(-1)!.secO!, "premise: the first restart's board is mid-fade").toBeLessThan(0.9);
    await rigStart(page, "Side Control Top");
    await page.evaluate(() => (window as any).__neural.resetRoll());
    const B = await record(page, 60);
    const all = [A.at(-1)!, ...B].filter((f) => f.secO != null);
    const up = Math.max(...all.map((f, i) => (i ? f.secO! - all[i - 1].secO! : 0)));
    expect(up, "HANDOFF: the old board fades on from where it stood, never back to full").toBeLessThan(0.1);
  });
});

test.describe("the directed arrival on desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("a 2px drag while the node is named takes the camera at once, and nothing takes it back @curated", async ({ page }) => {
    await bootTo(page, "Mount Top");
    await record(page, 240);   // 4.0s: the node is named and the zoom is running
    await page.mouse.move(900, 600); await page.mouse.down(); await page.mouse.move(902, 600);
    const [f1, f2] = await record(page, 2);   // the button is still down: the first 2px must already own the camera
    expect(Math.hypot(f2.cx - f1.cx, f2.cy - f1.cy) + Math.abs(Math.log(f2.vw / f1.vw)), "INPUT: the first 2px of a drag stop the directed camera at once").toBe(0);
    await page.mouse.move(930, 610, { steps: 5 }); await page.mouse.up();   // a pan, not a tap (a tap navigates)
    const after = await record(page, 360);   // through the reveal, the rise and the landing
    expect(after.some((f) => f.secO != null), "premise: the board still mounted (the game clock ran)").toBe(true);
    const moved = after.filter((f, i) => i && (f.cx !== after[i - 1].cx || f.cy !== after[i - 1].cy || f.vw !== after[i - 1].vw));
    expect(moved.length, "INPUT: after the drag the camera never moves on its own").toBe(0);
  });

  test("a drag mid-rise releases the board in 0.2s and leaves no state or transition behind @curated", async ({ page }) => {
    await bootTo(page, "Mount Top");
    const S = await record(page, 345);   // ~5.75s: 0.5s into the rise
    expect(S.at(-1)!.open, "premise: the board is mid-rise").toBe("board");
    // POINT MOVED, CLAIM UNCHANGED (U55 b, 2026-10-28). Old: the drag started at (1300,760), which was map
    // beside the centred 902px article. The desktop dashboard now runs the sections to the right edge, so that
    // point is an article tile and the press was reading, not a drag. New: the right side of the node band,
    // which the reader keeps clear by design (article-dashboard.spec.ts pins that).
    const at = { x: 1300, y: 160 };
    // DASH-R4 (review finding 9e): the premise names what the point IS, the map's canvas, not only what it is not.
    expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, at),
      "premise: the drag starts on the map (its canvas), not on an article tile or a game part").toBe("CANVAS");
    await page.mouse.move(at.x, at.y); await page.mouse.down(); await page.mouse.move(at.x + 2, at.y);
    await page.mouse.move(at.x + 30, at.y + 10, { steps: 5 }); await page.mouse.up();
    await page.waitForTimeout(700);   // the release is a CSS transition: wall clock
    const left = await page.evaluate(() => {
      const a = (window as any).__neural, wrap = a.wrapRef.current, sec = a._readerEl || a._reader?.root;
      return { open: wrap.dataset.ngOpen || "", vars: wrap.style.getPropertyValue("--ng-open-o"), dur: getComputedStyle(sec).transitionDuration, o: getComputedStyle(sec).opacity };
    });
    expect(left, "RELEASE: no state, no transition and a fully shown board after the release").toEqual({ open: "", vars: "", dur: "0s", o: "1" });
  });
});

/** Mount Top's content with two clips, so the landing has a Videos row (the harness serves `{}` for every chunk). */
const withFilm = (page: Page, title: string) => page.evaluate((title) => {
  const w = window as any, a = w.__neural, n = a.nodes.filter((x: any) => x.ty === "positions" && x.rep && x.t === title)[0];
  w.NG_CONTENT ||= {}; w.NG_CONTENT.decks ||= {};
  const keys = [...new Set([n, n.pi >= 0 ? a.nodes[n.pi] : null].filter(Boolean).map((m: any) => a.deckKeyFor(m).key))];
  for (const key of keys) {
    w.NG_CONTENT.decks[key] = { cat: "Position", role: "Top", lead: "Opening fixture: a real Videos row.",
      principles: ["Keep the connection while your partner changes direction."],
      clips: [{ id: "aQ2vFXXBn-o", title: "First mounted demonstration" }, { id: "aQ2vFXXBn-o", title: "Second mounted demonstration" }] };
    a.onContentReady(key);
  }
  return keys;
}, title);

for (const book of ["on", "off"] as const) {
test.describe(`the directed arrival with a Videos row, Book ${book}`, () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test(`the film fades and rides once, with the section, and is hidden while faint (Book ${book}) @curated`, async ({ page }) => {
    await bootTo(page, "Mount Top", book);
    expect((await withFilm(page, "Mount Top")).length, "premise: the content is authored").toBeGreaterThan(0);
    const S = await record(page, 613);
    const pick = S.find((f) => f.pick != null)?.pick, E = pick! + 2.0;
    const withF = S.filter((f) => f.t >= E && f.t <= E + 2.0 && f.film != null);
    expect(withF.length, "premise: the Videos row mounted with the board").toBeGreaterThan(60);
    const seen = withF.filter((f) => f.filmVis !== "hidden" && f.filmO! > 0.02 && f.secO != null && f.hand != null);
    expect(seen.length, "premise: rise frames with the film, the section and the Moves row up").toBeGreaterThan(60);
    expect(Math.max(...seen.map((f) => Math.abs(f.filmO! - f.secO!))), "FILM-FADE: the film's effective opacity is the section's (it fades once)").toBeLessThan(0.01);
    expect(span(seen.map((f) => f.hand! - f.film!)), "FILM-RIDE: the film-to-Moves distance is constant through the rise (it rides once)").toBeLessThan(1.5);
    const faint = S.filter((f) => f.open === "faint" && f.film != null);
    expect(faint.length, "premise: faint frames with the film mounted").toBeGreaterThan(3);
    expect(faint.filter((f) => f.filmVis !== "hidden").map((f) => +f.t.toFixed(3)), "FILM-FAINT: the film is hidden while the board is faint").toEqual([]);
  });
});
}
