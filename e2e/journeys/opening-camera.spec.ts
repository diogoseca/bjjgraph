import { test, expect, type Page } from "@playwright/test";
import { journey } from "../dsl";

/**
 * THE OPENING AND EVERY STAGED RESTART ARE DIRECTED (v1.235.0, owner U48 → U50 d, "S2 · Z2").
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
 * never from `camTarget`. The claims, one assertion each, so a mutant names the claim it broke:
 *   ZOOM-START   the zoom is already moving in the first half-second
 *   ZOOM-ON      ...and never stops or reverses until it lands
 *   SOFT         it touches down at rest
 *   HOLD         the named node does not move on the glass until the board mounts
 *   FADE         the board is invisible on the frame it mounts and only grows
 *   NO-FLASH     no board row paints outside the reader section (the reader adopts them a frame late)
 *   RIDE         the board rides up with the node: node-to-Moves-row distance constant through the rise
 *   GLIDE        the heading never jumps (the old cut moved it 251px in one frame)
 *   HOLD-ARTICLE a restart's fading article stays where it sat in its board (the old cut jumped it 748px)
 *   BOUNDS       camera-continuity's per-frame MOVE / KICK / ZOOM bounds hold on a restart too
 *   INPUT        a 2px drag takes the camera at once, and nothing takes it back
 *   SNAP         reduced motion: the view changes on at most two frames, and the board is never styled
 * Mutation kills (each at its own message, against a green control; the archive entry for v1.235.0):
 *   the rise starts at the pick                → HOLD            zoom held until the pick → ZOOM-START
 *   Z1 (lands at speed)                        → SOFT            the board pops at full opacity → FADE
 *   S1 (the board fades in place)              → RIDE            the heading cut to the band → GLIDE
 *   unadopted rows not hidden                  → NO-FLASH
 *   no article hold                            → HOLD-ARTICLE    a 0.15s rise → BOUNDS (camera-continuity too)
 *   a drag that does not cancel                → INPUT           reduced motion ignored → SNAP
 *   The hand-over at the pick (the drift eases to rest, never reverses) is pinned in
 *   tests/camera_opening.test.mjs ("the drift never reverses").
 * NOT PINNED HERE: the live frame rate (the pump is deterministic), and a wheel mid-rise, which scrolls
 * the reading column by design and so does not cancel (app.src.jsx's document capture listener).
 */

const MOVE_PX: Record<number, number> = { 1440: 120, 390: 48 };
const KICK_PX: Record<number, number> = { 1440: 14, 390: 6 };
const ZOOM_RATIO = 1.07;

type F = { t: number; el: number; W: number; H: number; cx: number; cy: number; vw: number; node: { x: number; y: number } | null;
  pick: number | null; secO: number | null; secInline: string; hand: number | null; head: number | null; article: number | null; loose: number };
// `article` is measured from the board's own top: in a restart the board sinks while it fades, on purpose

const frame = (page: Page) => page.evaluate(() => {
  const a = (window as any).__neural;
  a.advance(1000 / 60);
  const W = a.W, H = a.H, s = W / a.cam.vw;
  const n = a.currentPos != null && a.currentPos >= 0 ? a.nodes[a.currentPos] : null, mid = n ? a.pairMid(n) : null;
  const sec = a._readerEl || a._reader?.root;
  const shown = (el: any) => el && el.isConnected && el.offsetHeight && getComputedStyle(el).display !== "none";
  let secO: number | null = null;
  if (shown(sec)) { secO = 1; for (let q = sec; q && q.nodeType === 1; q = q.parentElement) secO *= parseFloat(getComputedStyle(q).opacity); }
  const hand = a._handShown?.() && shown(a.optionsRef?.current) && a.optionsRef.current.offsetHeight > 40 ? a.optionsRef.current.getBoundingClientRect().top : null;
  const box = a.evCenterRef.current, blk = box?.firstElementChild, br = blk?.getBoundingClientRect();
  const art = a._reader?.articleEl;
  const eff = (el: any) => { let o = 1; for (let q = el; q && q.nodeType === 1; q = q.parentElement) o *= parseFloat(getComputedStyle(q).opacity); return o; };
  // a board row PAINTING outside the reader section: the old reveal frame showed Videos at y 67
  const loose = [a._landFilmEl, a._landEl, a.optionsRef?.current].filter((el: any) => el && el.isConnected && el.offsetHeight > 40
    && !(sec && sec.isConnected && sec.contains(el)) && getComputedStyle(el).visibility !== "hidden" && eff(el) > 0.02).length;
  return { t: a.now, el: a.now - a.startTime, W, H, cx: a.cam.cx, cy: a.cam.cy, vw: a.cam.vw,
    node: mid ? { x: W / 2 + (mid.x - a.cam.cx) * s, y: H / 2 + (mid.y - a.cam.cy) * s } : null,
    pick: a._camOpen?.pick ?? null, secO, secInline: sec ? (sec.style.opacity || "") + "|" + (sec.style.translate || "") : "",
    hand, head: br && parseFloat(getComputedStyle(box).opacity) > 0.05 ? br.top + br.height / 2 : null,
    article: shown(art) && shown(sec) ? art.getBoundingClientRect().top - sec.getBoundingClientRect().top : null, loose };
}) as Promise<F>;

const record = async (page: Page, frames: number) => { const out: F[] = []; for (let i = 0; i < frames; i++) out.push(await frame(page)); return out; };
const rigStart = (page: Page, title: string) => page.evaluate((title) => {
  const a = (window as any).__neural, m = a.nodes.filter((n: any) => n.ty === "positions" && n.rep && n.t === title);
  if (m.length !== 1) throw new Error("expected one " + title + ", got " + m.length);
  a.rigStart(m[0].idx);
}, title);
const rigAmbient = async (j: ReturnType<typeof journey>) => { await j.rig("ai-skill", [0.5]); await j.rig("role", [0]); await j.rig("max-moves", [0.5]); };

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

test.describe("the directed arrival", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("first opening: the zoom runs from the first frames, the node holds until the board, rises with it, lands softly @curated", async ({ page }) => {
    const j = journey(page);
    await j.boot("/");
    await rigAmbient(j); await rigStart(page, "Mount Top");
    const S = await record(page, 613);   // the first app frame to the landing (9.2s) + 1s
    const pick = S.find((f) => f.pick != null)?.pick;
    expect(pick, "premise: the first opening was directed (a token with a pick)").toBeTruthy();
    const at = (t: number) => S.reduce((b, f) => (Math.abs(f.t - t) < Math.abs(b.t - t) ? f : b));
    const E = pick! + 2.0, land = pick! + 6.0;

    expect(S[0].vw / at(S[0].t + 0.5).vw, "ZOOM-START: the zoom is already moving in the first half-second").toBeGreaterThan(1.005);
    const on = S.filter((f) => f.t > S[0].t + 0.1 && f.t < land - 0.1);
    const stalls = on.filter((f, i) => i && !(f.vw < on[i - 1].vw));
    expect(stalls.length, "ZOOM-ON: the zoom narrows on every frame until the landing").toBe(0);
    const tail = S.filter((f) => f.t > land - 0.06 && f.t <= land + 1e-9);
    const rate = Math.max(...tail.map((f, i) => (i ? Math.abs(Math.log(f.vw / tail[i - 1].vw)) * 60 : 0)));
    expect(rate, "SOFT: it touches down at rest (ln-width per second over the last frames)").toBeLessThan(0.03);

    const held = S.filter((f) => f.t >= pick! + 0.8 && f.t < E && f.node).map((f) => f.node!);
    expect(held.length, "premise: frames between the hand-over and the board").toBeGreaterThan(60);
    expect(Math.max(span(held.map((p) => p.x)), span(held.map((p) => p.y))), "HOLD: the node does not move on the glass before the board").toBeLessThan(0.5);

    const mounted = S.filter((f) => f.secO != null);
    expect(mounted.length, "premise: the board mounted").toBeGreaterThan(60);
    expect(mounted[0].secO!, "FADE: the board is invisible on the frame it mounts").toBeLessThan(0.02);
    const drops = mounted.filter((f, i) => i && f.secO! < mounted[i - 1].secO! - 1e-6);
    expect(drops.length, "FADE: ...and its opacity only grows").toBe(0);
    expect(S.filter((f) => f.t < land && f.loose > 0).map((f) => +f.t.toFixed(3)), "NO-FLASH: no board row paints outside the reader section").toEqual([]);

    const rise = S.filter((f) => f.t >= E && f.t <= E + 2.0 && f.hand != null && f.node && f.secO! > 0.02);
    expect(rise.length, "premise: rise frames with the Moves row up").toBeGreaterThan(60);
    expect(span(rise.map((f) => f.hand! - f.node!.y)), "RIDE: the node stays a fixed distance above the Moves row through the rise").toBeLessThan(1.5);
    expect(rise[0].node!.y - rise.at(-1)!.node!.y, "premise: the node did rise").toBeGreaterThan(100);

    const heads = S.filter((f) => f.head != null);
    const jump = Math.max(...heads.map((f, i) => (i ? Math.abs(f.head! - heads[i - 1].head!) : 0)));
    expect(jump, "GLIDE: the heading never moves more than 20px in one frame").toBeLessThan(20);
  });

  test("a restart breathes out, holds the old article while it fades, and lands inside the bounds @curated", async ({ page }) => {
    const j = journey(page);
    await j.boot("/");
    await rigAmbient(j); await rigStart(page, "Side Control Top");
    const settled = (await record(page, 630)).at(-1)!;   // the first opening, settled: where the article sits
    expect(settled.article, "premise: the settled board shows its article").not.toBeNull();
    await rigStart(page, "Mount Top");
    await page.evaluate(() => (window as any).__neural.resetRoll());
    const S = await record(page, 414);
    const pick = S[0].pick;
    expect(pick, "premise: the restart was directed").toBeTruthy();
    const E = pick! + 2.0;
    const fading = S.filter((f) => f.t < E && f.secO != null && f.secO > 0.01 && f.article != null);
    expect(fading.length, "premise: frames with the old board fading").toBeGreaterThan(30);
    // against the frame BEFORE the restart: the clears reflow the reader before the first recorded frame
    expect(Math.max(...fading.map((f) => Math.abs(f.article! - settled.article!))), "HOLD-ARTICLE: the fading article stays where it sat in its board").toBeLessThan(1);
    const m = motion(S);
    expect(m.move, "BOUNDS: MOVE").toBeLessThanOrEqual(MOVE_PX[390]);
    expect(m.kick, "BOUNDS: KICK").toBeLessThanOrEqual(KICK_PX[390]);
    expect(m.zoom, "BOUNDS: ZOOM").toBeLessThanOrEqual(ZOOM_RATIO);
    const held = S.filter((f) => f.t >= pick! + 1.5 && f.t < E && f.node).map((f) => f.node!);
    expect(Math.max(span(held.map((p) => p.x)), span(held.map((p) => p.y))), "HOLD: the named node does not move before the board").toBeLessThan(0.5);
  });

  test("reduced motion: the view changes on at most two frames, and the board is never styled @curated", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const j = journey(page);
    await j.boot("/");
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches), "premise: reduced motion is emulated").toBe(true);
    await rigAmbient(j); await rigStart(page, "Mount Top");
    const S = await record(page, 613);
    const moves = S.filter((f, i) => i > 1 && (f.cx !== S[i - 1].cx || f.cy !== S[i - 1].cy || f.vw !== S[i - 1].vw));
    expect(moves.length, "SNAP: the camera changes view on at most two frames (the overview, then the landing)").toBeLessThanOrEqual(2);
    expect(S.filter((f) => f.secInline !== "|" && f.secInline !== "").length, "SNAP: the board is never styled").toBe(0);
  });
});

test.describe("the directed arrival on desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("a 2px drag while the node is named takes the camera at once, and nothing takes it back @curated", async ({ page }) => {
    const j = journey(page);
    await j.boot("/");
    await rigAmbient(j); await rigStart(page, "Mount Top");
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
});
