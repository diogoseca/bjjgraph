import { test, expect, type Page } from "@playwright/test";
import { journey } from "../dsl";

type Any = any;

/**
 * ZOOM IS A CAMERA, AND THE ARRIVAL IS THE EVENT (v1.114.0).
 *
 * Two owner reports, one surface:
 *
 *  1. "When we go to a node there's this bigger, wider circle that appears, and it's blooming,
 *     beaming. I don't like that very much. I'd rather have the pulse signal, the white node that
 *     goes from one node to another — when it arrives at its final node its bloom should grow a
 *     little bit more, like 50% or even 100% more. A bigger, wider circle shouldn't appear on its
 *     back anymore. That used to be the motivation for content to appear inside it. Now we don't
 *     want content to appear inside any node… the label, which consists of the role and the
 *     technique name, should appear to the right of it. That's the winner design for labelling
 *     these nodes, even when we zoom in or zoom out."
 *
 *  2. "When we're zooming in we want to see other nodes that are around it. We don't want more
 *     detail on a node. To see details on a node we click on it. We don't zoom in anymore."
 *
 * WHAT WAS ACTUALLY THERE. Two passes drew the wide circle, and one of them was a scaling bug:
 * v1.113.1 made every orb `n.r * nodeK` (nodeK = 0.4 at roll zoom) but the current-position
 * marker was never told, so its fill was 1.28/0.4 = **3.2x** the node it marks and its ring
 * **7.25x**. The second was a sustained radial halo reaching ~11x the drawn radius, lit and
 * breathing for the whole roll. Both are gone; light now fires on arrival and decays.
 *
 * WHY THESE ASSERTIONS ARE PIXELS. "No content inside the node" and "no wide circle behind it"
 * are claims about what the renderer PUT ON SCREEN — every state variable involved could be
 * correct while `draw()` still painted a name or a ring. So this file reads the canvas back.
 *
 * WHY THE SHAPE OF THE MEASUREMENT IS WHAT IT IS — three mutants had to die for this. A sparse
 * ring of sample points passed against a restored ring and a restored in-node name, because it
 * was measuring the empty space either side of the ring (3.6x and 8x, while the ring sits at
 * 7.25x) and outside the glyph. A dense radial profile scored by ANGULAR COVERAGE — "what
 * fraction of wedges hold a pixel brighter than sky" — then passed the ring too, because the
 * dealt hand's own option nodes genuinely encircle the state you stand in (measured: 82% of
 * wedges at r=7.7x), so coverage was already saturated where the ring lives and could not rise.
 *
 * The statistic that survives all three is a CONTROL FRAME plus a PER-SECTOR LUMINANCE DELTA:
 * take the same pixels twice, once with `focusIdx` set and once with it cleared, and per radius
 * band compare the brightest pixel in each of 96 wedges. Everything the graph would have drawn
 * anyway — orbs, edges, labels — subtracts to zero. A ring or a halo is radially symmetric, so
 * it raises EVERY wedge and the median delta moves; the edges the focus legitimately lights are
 * spokes in a handful of wedges and the median ignores them. It cannot saturate, and it self-
 * checks on the mark itself, so a sampler that has silently stopped seeing anything fails.
 *
 * Rails: __neural.nodes[].litK, .ARRIVE_BLOOM, .cam, .canvas, .focusIdx, .graphW, .rollLog
 */

type Prof = {
  rPx: number;
  sky: number;
  step: number;
  med: (number | null)[];
  max: (number | null)[];
  /** per bin, per angular sector: the brightest pixel in that wedge (null = no pixels sampled) */
  sect: (number | null)[][];
};

/**
 * Read the canvas back around a node and bin every pixel by (radius / drawn radius, angle).
 * `spanMul` is the box half-width in units of the node's DRAWN radius (`n.r * nodeK`, the number
 * the base pass uses — `n.r` alone has not been the drawn radius since v1.113.1).
 */
const profile = (
  page: Page,
  idx: number,
  spanMul: number,
  bins = 32,
): Promise<Prof> =>
  page.evaluate(
    ({ idx, spanMul, bins }) => {
      const a = (window as Any).__neural;
      const cv: HTMLCanvasElement = a.canvas;
      const ctx = cv.getContext("2d")!;
      const dpr = cv.width / cv.clientWidth;
      const n = a.nodes[idx];
      const scale = a.W / a.cam.vw;
      const nodeK = Math.max(0.4, Math.min(1, a.cam.vw / (a.graphW * 0.5)));
      const rPx = n.r * nodeK * scale;
      const sx = (n.x - a.cam.cx) * scale + a.W / 2;
      // THE DRAWN y, NOT `n.y` (v1.125.0) — the same correction `parkOn` needed, and the same
      // one the tap handler needed in v1.114.3. Every state is a pair, `LY(n)` lifts each half off
      // the shared ground, and profiling an annulus around the stored point centres it on empty
      // sky: the ring is still drawn, this just stops looking at it. Identity on an unpaired node.
      const sy = ((a._LY ? a._LY(n) : n.y) - a.cam.cy) * scale + a.H / 2;
      const span = rPx * spanMul;
      const x0 = Math.max(0, Math.round((sx - span) * dpr));
      const y0 = Math.max(0, Math.round((sy - span) * dpr));
      const x1 = Math.min(cv.width, Math.round((sx + span) * dpr));
      const y1 = Math.min(cv.height, Math.round((sy + span) * dpr));
      const w = x1 - x0;
      const h = y1 - y0;
      const img = ctx.getImageData(x0, y0, w, h).data;
      const SEC = 96;
      const vals: number[][] = Array.from({ length: bins }, () => []);
      const sect: (number | null)[][] = Array.from({ length: bins }, () =>
        new Array(SEC).fill(null),
      );
      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          const gx = (x0 + px) / dpr - sx;
          const gy = (y0 + py) / dpr - sy;
          const rr = Math.sqrt(gx * gx + gy * gy) / rPx;
          const b = Math.floor((rr / spanMul) * bins);
          if (b < 0 || b >= bins) continue;
          const o = (py * w + px) * 4;
          const l = 0.2126 * img[o] + 0.7152 * img[o + 1] + 0.0722 * img[o + 2];
          vals[b].push(l);
          let s = Math.floor(
            ((Math.atan2(gy, gx) + Math.PI) / (2 * Math.PI)) * SEC,
          );
          if (s < 0) s = 0;
          if (s >= SEC) s = SEC - 1;
          if (sect[b][s] === null || l > (sect[b][s] as number)) sect[b][s] = l;
        }
      }
      const med = vals.map((v) => {
        if (!v.length) return null;
        v.sort((p, q) => p - q);
        return v[v.length >> 1];
      });
      const max = vals.map((v) => {
        let m: number | null = null;
        for (const x of v) if (m === null || x > m) m = x;
        return m;
      });
      // SKY: the darkest bin median in the outer fifth of the box. A ring or halo can only RAISE
      // a bin, so the minimum out there is the honest background — and taking it from the data
      // means the test does not hard-code a palette that a theme change would invalidate.
      const outer = med
        .slice(Math.floor(bins * 0.8))
        .filter((x): x is number => x !== null);
      const sky = outer.length ? Math.min(...outer) : 0;
      return { rPx, sky, step: spanMul / bins, med, max, sect };
    },
    { idx, spanMul, bins },
  );

/** Park the camera on a node without the follow-cam stealing it back. */
const parkOn = async (page: Page, idx: number, vwFrac: number) =>
  page.evaluate(
    ({ idx, vwFrac }) => {
      const a = (window as Any).__neural;
      const n = a.nodes[idx];
      if (!a.paused) a.setPaused(true); // pausing suppresses updateCamera's auto-retarget
      const vw = a.graphW * vwFrac;
      // PARK ON THE POINT THE RENDERER DRAWS AT, NOT ON `n.y` (v1.125.0). Every state is a pair
      // now, and `LY(n)` lifts each member off the shared ground by `z * h` — so centring on the
      // stored y puts the orb outside the annulus this file profiles, and the measurement comes
      // back as "nothing is drawn here" rather than as the thing it is checking. `_LY` is the
      // renderer's own published lift (one definition, the frame's own); it is the identity on an
      // unpaired node, so the legacy graph is untouched.
      const cy = a._LY ? a._LY(n) : n.y;
      a.cam.cx = n.x;
      a.cam.cy = cy;
      a.cam.vw = vw;
      a.cam.lvw = Math.log(vw);
      a.camTarget = { cx: n.x, cy: cy, vw };
      a.holdCamera();
    },
    { idx, vwFrac },
  );

test("@curated nothing is written inside a node, however far you zoom in", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  await j.advance(2600); // let the arrival bloom decay out, so we measure the steady state

  // A node that is NOT the focus: the focus is deliberately repainted in your perspective colour,
  // and this journey is about TEXT and PLATES, which the deleted pass drew on every node alike.
  const target = await page.evaluate(() => {
    const a = (window as Any).__neural;
    const cand = (a.optionIdxs || []).find((i: number) => i !== a.focusIdx);
    return (
      cand ??
      a.nodes.findIndex(
        (x: Any, i: number) => i !== a.focusIdx && x.ty === "positions",
      )
    );
  });
  expect(target, "found a node to zoom into").toBeGreaterThanOrEqual(0);

  // the DEEPEST zoom the wheel allows (graphW * 0.006). This is where the retired pass drew a
  // dark plate, a stroked outline, an 800-weight kicker and up to three lines of near-white name.
  await parkOn(page, target, 0.006);
  await j.advance(260);

  const p = await profile(page, target, 1.0, 24);
  expect(
    p.rPx,
    "the node fills a serious part of the screen at this zoom",
  ).toBeGreaterThan(80);

  // every pixel strictly INSIDE the orb, clear of its own edge
  const insideMax = Math.max(
    ...p.max
      .slice(0, Math.floor(24 * 0.75))
      .filter((x): x is number => x !== null),
  );
  // The retired in-node name was rgba(240,243,248,0.98) => luminance ~243, and it was set at
  // `rs * 0.24`, so at this zoom it spanned most of the orb. Measured on the fixed build the
  // brightest thing in here is the specular highlight at ~107, so 200 is a real gap, not a
  // threshold tuned to squeak past.
  expect(
    insideMax,
    `no text or plate pixels inside the orb (brightest sample ${Math.round(insideMax)}, sky ${Math.round(p.sky)})`,
  ).toBeLessThan(200);
});

test("no wide circle appears behind the node you are standing on", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  await j.advance(2600); // past the 1.9s arrival flare — the steady state is what was complained about

  const idx = await page.evaluate(() => (window as Any).__neural.focusIdx);
  await parkOn(page, idx, 0.085); // ROLL_ZOOM: exactly where the owner met it
  // AGE THE ARRIVAL BLOOM OUT, EXPLICITLY. `parkOn` pauses, and `this.now` IS the game clock, so
  // a paused roll freezes `age = now - lit` and leaves the node stuck mid-bloom — which is how an
  // early version of the floor below passed against a build with the resting glow deleted. The
  // subject of this journey is the RESTING state; say so in the state rather than hoping for it.
  await page.evaluate(() => {
    const a = (window as Any).__neural;
    a.nodes[a.focusIdx].lit = a.now - 5;
  });
  await j.advance(260);
  expect(
    await page.evaluate(() => {
      const a = (window as Any).__neural;
      return a.now - a.nodes[a.focusIdx].lit;
    }),
    "the arrival bloom really is over, so what we measure is the resting light",
  ).toBeGreaterThan(1.9);

  // 14x the drawn radius: past the retired ring (7.25x) AND past the retired halo (~11x).
  const lit = await profile(page, idx, 14, 32);

  // A CONTROL FRAME. Absolute brightness cannot answer this: the hand's option nodes genuinely
  // encircle the state you are standing in, which is the graph doing its job, and no threshold
  // tells that ring of NODES from a ring of LIGHT. So take the same pixels with the same camera
  // and the same neighbours, and only the focus treatment removed — `focusIdx = -1` gates off the
  // marker and its label and nothing else. What remains is exactly "what does standing here add
  // to the picture", which is the owner's question.
  await page.evaluate(() => {
    const a = (window as Any).__neural;
    (a as Any).__keepFocus = a.focusIdx;
    a.focusIdx = -1;
  });
  await j.advance(260);
  const bare = await profile(page, idx, 14, 32);
  await page.evaluate(() => {
    const a = (window as Any).__neural;
    a.focusIdx = (a as Any).__keepFocus;
  });

  /** Per radius band: the MEDIAN over 96 angular wedges of (lit brightest − bare brightest). */
  const wedgeDelta = (b: number) => {
    const d: number[] = [];
    for (let s = 0; s < lit.sect[b].length; s++) {
      const L = lit.sect[b][s];
      const B = bare.sect[b][s];
      if (L === null || B === null) continue;
      d.push(L - B);
    }
    if (!d.length) return null;
    d.sort((x, y) => x - y);
    return d[d.length >> 1];
  };

  // SELF-CHECK — the difference must be able to SEE the focus treatment, or this whole test is a
  // tautology. On the node itself it is unmissable: the mark repaints the orb at 0.98 alpha in
  // your perspective colour over a 0.62-alpha base.
  const onNode = wedgeDelta(0);
  expect(
    Math.abs(onNode!),
    `being the current node visibly changes it (wedge delta ${onNode!.toFixed(1)})`,
  ).toBeGreaterThan(10);

  const rings = lit.med
    .map((_, i) => ({ i, r: (i + 0.5) * lit.step, d: wedgeDelta(i) }))
    .filter((b) => b.d !== null);

  // TWO BOUNDS, AND THE FLOOR IS THE v1.114.1 REGRESSION. v1.114.0 deleted the sustained halo and
  // put nothing in its place, so once the 1.9s arrival bloom expired the state you were standing
  // in went inert for the rest of the turn — measured, light reaching 30px against a 21px orb.
  // Owner: "there seems to be no highlight at all now ... that pulse, when it reaches the correct
  // node, it disappears, and it becomes stale." So this pins a FLOOR as well as a ceiling: the
  // current node is LIT, and the light HUGS THE ORB.
  // The band starts at 1.8x, CLEAR of the mark itself: the mark is drawn at 1.28x with a 2px rim,
  // and a band starting at 1.2x measured that rim's antialiasing (19.6 luminance with the glow
  // deleted) rather than any glow — which is how the first version of this floor passed against
  // the very build it exists to reject. Median of the band, not max, for the same reason.
  const near = rings.filter((b) => b.r >= 1.8 && b.r <= 2.6).map((b) => b.d!);
  expect(near.length, "there are bins just outside the mark").toBeGreaterThan(1);
  near.sort((x, y) => x - y);
  expect(
    near[near.length >> 1],
    `the state you are standing in is never dark — it carries a resting glow (band median ${near[near.length >> 1].toFixed(1)})`,
  ).toBeGreaterThan(8);

  // ...and the ceiling, at the radii the retired ring (7.25x) and the retired halo (~11x) held.
  const band = rings.filter((b) => b.r >= 3.6 && b.r <= 12);
  expect(band.length, "there are bins to check out there").toBeGreaterThan(8);

  const worst = band.reduce((a2, b) => (b.d! > a2.d! ? b : a2));
  expect(
    worst.d!,
    `standing here draws nothing that encircles the node (worst band r=${worst.r.toFixed(1)}x adds ${worst.d!.toFixed(1)} luminance in the median wedge, sky ${Math.round(lit.sky)})`,
  ).toBeLessThan(8);
});

test("the hand's rings are a multiple of the orb they ring, not of a stale radius", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  await j.advance(2600);

  const opt = await page.evaluate(() => {
    const a = (window as Any).__neural;
    const idxs = (a.optionIdxs || []).map((o: Any) =>
      typeof o === "number" ? o : o.idx,
    );
    return idxs.find((i: number) => i !== a.focusIdx) ?? -1;
  });
  expect(
    opt,
    "the hand is dealt and has a card to inspect",
  ).toBeGreaterThanOrEqual(0);

  await parkOn(page, opt, 0.085); // ROLL_ZOOM again — where nodeK is 0.4 and the drift is worst
  await j.advance(260);
  const withRing = await profile(page, opt, 10, 32);

  // Same control-frame trick, on the other side of the same defect: emptying the hand removes
  // the option ring and nothing else. The focus's own ring pass was fixed first; this is the
  // pass that shipped the bug to every card in the hand.
  const kept = await page.evaluate(() => {
    const a = (window as Any).__neural;
    const k = a.optionIdxs;
    a.optionIdxs = [];
    return k;
  });
  await j.advance(260);
  const noRing = await profile(page, opt, 10, 32);
  await page.evaluate((k) => ((window as Any).__neural.optionIdxs = k), kept);

  const wedge = (b: number) => {
    const d: number[] = [];
    for (let sIdx = 0; sIdx < withRing.sect[b].length; sIdx++) {
      const L = withRing.sect[b][sIdx];
      const B = noRing.sect[b][sIdx];
      if (L === null || B === null) continue;
      d.push(L - B);
    }
    if (!d.length) return null;
    d.sort((x, y) => x - y);
    return d[d.length >> 1];
  };

  const all = withRing.med
    .map((_, i) => ({ r: (i + 0.5) * withRing.step, d: wedge(i) }))
    .filter((b) => b.d !== null);
  const peak = all.reduce((a2, b) => (b.d! > a2.d! ? b : a2));

  // SELF-CHECK: the ring exists AND is found against its orb. This is the assertion that fails
  // when the pass forgets `nodeK` — not because the ring vanished, but because it moved out to
  // ~6x, so the failure message names where it actually went.
  const inner = all.filter((b) => b.r <= 3.2);
  expect(
    inner.reduce((a2, b) => Math.max(a2, b.d!), 0),
    `being an option rings the node, within 3.2x of it (the brightest added band is at r=${peak.r.toFixed(1)}x)`,
  ).toBeGreaterThan(4);

  // ...and nowhere outside it. At nodeK = 0.4 the pre-fix ring sat at 6x the drawn orb.
  const worst = all
    .filter((b) => b.r >= 3.6)
    .reduce((a2, b) => (b.d! > a2.d! ? b : a2));
  expect(
    worst.d!,
    `the ring stays against its orb (worst band r=${worst.r.toFixed(1)}x adds ${worst.d!.toFixed(1)} luminance in the median wedge)`,
  ).toBeLessThan(6);
});

test("the node a move LANDS on blooms harder than one the light passed through", async ({
  page,
}) => {
  const j = journey(page);
  await j.boot("/");
  await j.land("Mount Top");
  await j.advance(1500);

  // ...AND NEITHER MAY THE OPPONENT'S. The line below already states the rule — a finish ends the
  // round instead of landing — but it only ever applied it to MY move. A missed transition hands
  // the turn over (`enterFailCal` -> `opponentDefend`), which draws `rng("opp-finish")` against a
  // pFinish of up to 0.85 and, when it hits, submits you: `endRound`, no second `land`, ever.
  // Nothing here rigged that draw, so it was a live `Math.random` and the journey failed whenever
  // the roll ended instead of continuing — MEASURED at 4 of 48 isolated runs (8.3%) plus the one
  // that turned a full core run red. It is not an app defect: the app correctly ended the round
  // (the announcer read "Tapped · Crotch Ripper" in the failing snapshot). It is this journey
  // walking into a state it has nothing to say about. 0.99 clears the pFinish ceiling, so the
  // opponent takes the positional branch, travels, and lands somewhere — which is the subject.
  await j.rig("opp-finish", [0.99, 0.99, 0.99]);

  // deliberately NOT a submission: a finish ends the round instead of landing, and this journey
  // is about what the light does when it ARRIVES somewhere.
  const pickName = await page.evaluate(() => {
    const a = (window as Any).__neural;
    const idxs = (a.optionIdxs || []).map((o: Any) =>
      typeof o === "number" ? o : o.idx,
    );
    const t = idxs.find(
      (i: number) => a.nodes[i] && a.nodes[i].ty !== "submissions",
    );
    return t == null ? null : a.nodes[t].t;
  });
  expect(pickName, "there is a non-finishing move in the hand").toBeTruthy();
  await j.pick(pickName!);

  // NOT advanceUntil("land"): the beat stream already holds the OPENING landing's "land", so it
  // would return before the move had travelled anywhere. Wait for a NEW one.
  const landsBefore = (await j.beats()).filter((b) => b.beat === "land").length;
  for (let spent = 0; spent < 24000; spent += 400) {
    await j.advance(400);
    if ((await j.beats()).filter((b) => b.beat === "land").length > landsBefore)
      break;
  }
  expect(
    (await j.beats()).filter((b) => b.beat === "land").length,
    "the exchange resolved into a new landing",
  ).toBeGreaterThan(landsBefore);

  const m = await page.evaluate(() => {
    const a = (window as Any).__neural;
    const last = (a.rollLog || [])[a.rollLog.length - 1] || {};
    const via = last.via ? a.nodes[last.via.idx] : null;
    return {
      amp: a.ARRIVE_BLOOM,
      destK: a.nodes[a.currentPos].litK,
      viaK: via ? via.litK : null,
      viaName: via ? via.t : null,
    };
  });

  expect(m.amp, "the arrival amplitude is the owner's '100% more'").toBe(2);
  expect(m.destK, "the node the move landed on carries it").toBe(m.amp);
  if (m.viaK !== null) {
    expect(
      m.viaK,
      `the technique the light travelled over does not (${m.viaName})`,
    ).toBe(1);
  }
});

/**
 * ONE CLOCK, INVERTED (v1.114.1 → v1.133.0). The v1.114.1 lesson was that a bar disagreeing with
 * its clock is a lie; v1.133.0 moved the clock to the QUESTION, so now the honest claims are the
 * mirror image: the option cards' bars are STATIC EDGE colour (nothing on the hand drains), and
 * the card's own [data-land-clock] bar is written by _tickDecision from the same number the
 * window holds.
 */
test("the option bars never drain, and the question bar cannot disagree with its clock", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await j.advance(1500)

  const read = () =>
    page.evaluate(() => {
      const a = (window as Any).__neural
      const d = a._decision || {}
      const bars = Array.from(document.querySelectorAll(".ngbar")).map((b) => {
        const t = getComputedStyle(b as HTMLElement).transform
        if (!t || t === "none") return 1
        const m = t.match(/matrix\(([-\d.]+)/)
        return m ? parseFloat(m[1]) : 1
      })
      const q = document.querySelector("[data-land-clock]") as HTMLElement | null
      let qbar = null
      if (q) {
        const t = getComputedStyle(q).transform
        const m = t && t !== "none" ? t.match(/matrix\(([-\d.]+)/) : null
        qbar = m ? parseFloat(m[1]) : null
      }
      return {
        remaining: d.remaining ?? null,
        total: d.total ?? null,
        n: bars.length,
        minBar: bars.length ? Math.min(...bars) : null,
        qbar: qbar,
      }
    })

  const before = await read()
  expect(before.n, "the hand is dealt and its cards carry bars").toBeGreaterThan(2)
  expect(before.remaining, "the question armed its window").not.toBeNull()

  await j.advance(4000)
  const mid = await read()
  expect(mid.minBar!, "no option bar drained — the hand is untimed").toBeGreaterThan(0.99)
  expect(mid.qbar!, "the question bar tracks the window").toBeCloseTo(mid.remaining! / mid.total!, 1)
  expect(mid.qbar!, "and it really is draining").toBeLessThan(0.95)
})

/**
 * THE GRAPH NEVER BAKES A ROLE INTO A NAME (v1.128.1). @curated
 *
 * Owner: "when i'm zoomed out i often see 'Turtle Top' instead of 'Turtle' (roleless in the
 * further zoomed out state). pls fix that too so it says Turtle? or wtv without the role like top
 * bottom attacking or attempting or defending."
 *
 * Every position hub is TITLED "… Top" in graph-data.json — a rendering artifact of the visual
 * collapse, not a claim about the side (v1.82.3) — and `splitName().main` only strips a
 * "from <position>" tail, which a position title does not have. So every canvas label that fell
 * back to the raw title printed the role as part of the name. **Measured: 136 of 136 position
 * titles carry one.** At MERGE scale that is plainly wrong — there is one orb, it is neither side,
 * and the role belongs to the pair group which is deliberately not drawn there (v1.128.0).
 *
 * The focus label already used `posFamily`; `graphName(n)` is the same rule for the other three
 * canvas label paths (the fading recent-node labels, the active-move label during travel, and the
 * hover label), so the graph answers "what is this" exactly one way at every zoom.
 */
test("@curated no position label the graph draws carries its role", async ({ page }) => {
  const j = journey(page)
  await j.boot("/Positions/Side-Control/Bottom")
  await j.advance(6000)

  // THE WHOLE CORPUS, through the app's own helper — this is the claim, and it is 136-wide.
  const corpus = await page.evaluate(() => {
    const a: any = (window as any).__neural
    let titled = 0
    let roled = 0
    const bad: string[] = []
    for (const n of a.nodes) {
      if (!n.rep || n.ty !== "positions") continue
      if (/\s(Top|Bottom)$/i.test(a.splitName(n.t).main)) titled++
      if (/\s(Top|Bottom)$/i.test(a.graphName(n))) { roled++; if (bad.length < 3) bad.push(a.graphName(n)) }
    }
    return { titled, roled, bad }
  })
  expect(corpus.titled, "every position hub really is titled with a role — that is the hazard").toBe(136)
  expect(corpus.roled, `and the graph prints none of them (${JSON.stringify(corpus.bad)})`).toBe(0)

  // ...AND ON THE GLASS, which is what stops this journey from being a re-implementation of the
  // thing it checks (the v1.126.0 lesson: never assert a render by re-running its logic). The
  // corpus block above would pass on a build where `graphName` is perfect and NO draw site calls
  // it; this half fails on exactly that build.
  //
  // THE ORACLE IS THE NARROW WINDOW WHERE " Top" WOULD GO — the span between the roleless width
  // and the roled width, ~27px. A first attempt swept 340px right of the orb and read 238px of
  // bright pixels against a 114px name: at merge scale the whole graph is on screen and that strip
  // was full of OTHER nodes' labels. Hence both the narrow window and the isolation filter.
  await page.mouse.move(page.viewportSize()!.width * 0.25, page.viewportSize()!.height * 0.18)
  for (let i = 0; i < 24; i++) {
    await page.mouse.wheel(0, 500)
    await j.advance(120)
  }
  const shot = await page.evaluate(() => {
    const a: any = (window as any).__neural
    const scale = a.W / a.cam.vw
    const K = Math.max(0.4, Math.min(1, a.cam.vw / (a.graphW * 0.5)))
    const P = (n: any) => ({
      sx: (n.x - a.cam.cx) * scale + a.W / 2,
      sy: (a._LY(n) - a.cam.cy) * scale + a.H / 2,
    })
    const c = document.createElement("canvas").getContext("2d")!
    c.font = "600 13px 'Plus Jakarta Sans', sans-serif"
    let best: any = null
    for (const n of a.nodes) {
      if (n.ty !== "positions" || !n.rep) continue
      const p = P(n)
      if (!(p.sx > 80 && p.sx < a.W - 320 && p.sy > 80 && p.sy < a.H - 320)) continue
      const wRoleless = c.measureText(a.graphName(n)).width
      const wRoled = c.measureText(a.splitName(n.t).main).width
      // ISOLATION: nothing else may sit in the band this label is drawn in, out to the far edge
      // of where " Top" would land, or a neighbour's own label answers for it.
      let clear = 1e9
      for (const m of a.nodes) {
        if (m.idx === n.idx || !m.rep) continue
        const q = P(m)
        if (Math.abs(q.sy - p.sy) > 26) continue
        if (q.sx <= p.sx) continue
        clear = Math.min(clear, q.sx - p.sx)
      }
      const need = n.r * K * scale + 9 + wRoled + 40
      if (clear < need) continue
      if (!best || clear > best.clear)
        best = { sx: p.sx, sy: p.sy, r: n.r * K * scale, wRoleless, wRoled, clear, name: a.graphName(n) }
    }
    return best ? { ...best, lodK: a._lodK } : null
  })
  expect(shot, "there is an isolated merged position to point at").not.toBeNull()
  expect(shot!.lodK, "and we really are at merge scale").toBeLessThan(0.5)

  await page.mouse.move(shot!.sx - 40, shot!.sy - 40)
  await page.mouse.move(shot!.sx, shot!.sy)
  await j.advance(120)

  const px = await page.evaluate(
    ({ sx, sy, r, wRoleless, wRoled }: any) => {
      const a: any = (window as any).__neural
      const cv: HTMLCanvasElement = a.canvas
      const ctx = cv.getContext("2d")!
      const dpr = cv.width / cv.clientWidth
      const ox = sx + r + 9 // where the label starts (halfW + 9)
      const band = (from: number, to: number) => {
        const x0 = Math.round((ox + from) * dpr)
        const w = Math.max(1, Math.round((to - from) * dpr))
        const d = ctx.getImageData(x0, Math.round((sy - 20) * dpr), w, Math.round(16 * dpr)).data
        let n = 0
        for (let i = 0; i < d.length; i += 4)
          if (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2] > 90) n++
        return n
      }
      return { name: band(2, wRoleless - 4), role: band(wRoleless + 4, wRoled + 2) }
    },
    { sx: shot!.sx, sy: shot!.sy, r: shot!.r, wRoleless: shot!.wRoleless, wRoled: shot!.wRoled },
  )
  // SELF-CHECK FIRST: if the name itself is not on screen the role window is trivially empty and
  // this would pass against a build that draws no label at all.
  expect(px.name, `the hover label was drawn (name "${shot!.name}", ${JSON.stringify(px)})`).toBeGreaterThan(30)
  expect(
    px.role,
    `nothing is drawn where " Top" would be (${JSON.stringify(px)}, roleless ${Math.round(shot!.wRoleless)}px vs roled ${Math.round(shot!.wRoled)}px)`,
  ).toBeLessThan(px.name / 6)
})

/**
 * THE QUALIFIER IS ITS OWN LINE (v1.129.0). @curated
 *
 * Owner, on names running off a phone: "probably a great idea to do wrapping in that case".
 *
 * The break is SEMANTIC, not arbitrary. `splitName` already separates "Rear Naked Choke" from
 * "from Seat Belt Control Back", and the app already renders exactly that pair as bold-over-dimmer
 * in `setEvent`, in every Explore row and in every list surface — so putting the graph label on the
 * same idiom halves the widest line AND stops the canvas being a second naming system.
 *
 * MEASURED at the hover label's 13px, over the whole corpus: the widest SUBMISSION label goes
 * 330px -> 165px (295 of 297 carry a qualifier). Transitions keep a 275px worst case because 681
 * of 1034 have no "from" at all — those are handled by `_fitText`, which ellipsizes to the room
 * actually available rather than running off the screen.
 */
test("@curated a qualified technique name is drawn as two lines, not one long one", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/Positions/Side-Control/Bottom")
  await j.advance(6000)

  // a technique pair with a real qualifier, well clear of other nodes in its own label bands
  const pick = await page.evaluate(() => {
    const a: any = (window as any).__neural
    const scale = a.W / a.cam.vw
    const K = Math.max(0.4, Math.min(1, a.cam.vw / (a.graphW * 0.5)))
    const P = (n: any) => ({
      sx: (n.x - a.cam.cx) * scale + a.W / 2,
      sy: (a._LY(n) - a.cam.cy) * scale + a.H / 2,
    })
    let best: any = null
    for (const n of a.nodes) {
      if (n.ty === "positions" || n.pi < 0 || n.z <= 0) continue
      if (!a.splitName(n.t).from) continue // must actually have a qualifier to split
      // ...AND ITS SHORT NAME MUST BE AMBIGUOUS, so `displayName` really would print the long
      // inline form. Without this the candidate can be a technique whose short name is unique,
      // where `displayName(n) === splitName(n.t).main` — and the "prints the inline long name"
      // mutant is then a NO-OP on the very node the test picked, and survives. (It did.)
      if (a.displayName(n) === a.splitName(n.t).main) continue
      if (n.idx === a.focusIdx || n.idx === a.nodes[a.focusIdx].pi) continue
      const p = P(n)
      const q = P(a.nodes[n.pi])
      if (!(p.sx > 100 && p.sx < a.W - 320 && Math.min(p.sy, q.sy) > 90 && Math.max(p.sy, q.sy) < a.H - 330)) continue
      let clear = 1e9
      for (const m of a.nodes) {
        if (m.idx === n.idx || m.idx === n.pi || !m.rep) continue
        const r = P(m)
        if (Math.abs(r.sy - (p.sy + q.sy) / 2) > 46) continue
        if (r.sx <= p.sx) continue
        clear = Math.min(clear, r.sx - p.sx)
      }
      if (clear < 300) continue
      if (!best || clear > best.clear)
        best = { sx: p.sx, sy: p.sy, mid: (p.sy + q.sy) / 2, r: n.r * K * scale, clear, idx: n.idx,
                 main: a.splitName(n.t).main, from: a.splitName(n.t).from, t: n.t }
    }
    return best
  })
  expect(pick, "there is an isolated qualified technique pair on screen").not.toBeNull()

  // THE TAIL WINDOW: where the INLINE long name would reach and the short name never does.
  const win = await page.evaluate(
    ({ main, disp }: any) => {
      const a: any = (window as any).__neural
      const c = document.createElement("canvas").getContext("2d")!
      c.font = "700 15px " + (a._displayFam || "'Space Grotesk'") + ", sans-serif"
      return { short: c.measureText(main).width, long: c.measureText(disp).width }
    },
    { main: pick!.main, disp: pick!.disp },
  )

  // A CONTROL FRAME, because the band is NOT empty on a correct build. Measured while chasing this:
  // the PARTNER orb's own label lands at baseline 154 inside a 144..160 window, so a raw reading
  // reports ~266 bright px whether the group drew a short name or a long one — and the "prints the
  // inline name" mutant SURVIVED a raw assertion for exactly that reason. Everything the graph
  // draws anyway subtracts to zero; only what the hover ADDS is attributable to the group.
  //
  // THE BAND COMES FROM THE PUBLISHED GEOMETRY, NOT A CONSTANT. A version pinned to the pair's
  // midline broke the moment v1.129.4 lifted a two-row block off it (body 0 -> 21 against a > 40
  // bar) — the test describing where the label USED to be. `ox` and `nameY` are what the frame
  // actually drew with, so hover FIRST to learn them, then take the control reading at the same
  // coordinates with the pointer away.
  const bandAt = ({ ox, y, from, to }: any) =>
    page.evaluate(
      ({ ox, y, from, to }: any) => {
        const a: any = (window as any).__neural
        const cv: HTMLCanvasElement = a.canvas
        const ctx = cv.getContext("2d")!
        const dpr = cv.width / cv.clientWidth
        const x0 = Math.round((ox + from) * dpr)
        const w = Math.max(1, Math.round((to - from) * dpr))
        const d = ctx.getImageData(x0, Math.round((y - 13) * dpr), w, Math.round(17 * dpr)).data
        let n = 0
        for (let i = 0; i < d.length; i += 4)
          if (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2] > 70) n++
        return n
      },
      { ox, y, from, to },
    )

  await page.mouse.move(pick!.sx - 50, pick!.sy - 50)
  await page.mouse.move(pick!.sx, pick!.sy)
  await j.advance(120)
  const geo = await page.evaluate(() => (window as any).__neural._lastPairLabel)
  expect(geo, "the group drew and published its geometry").toBeTruthy()

  const tail = { ox: geo.ox, y: geo.nameY, from: win.short + 14, to: win.long }
  const body = { ox: geo.ox, y: geo.nameY, from: 2, to: win.short - 6 }
  const hotTail = await bandAt(tail)
  const hotBody = await bandAt(body)

  // the control: same strips, pointer parked on empty sky
  await page.mouse.move(6, 6)
  await j.advance(700) // past `_hover`'s 0.5s freshness window
  const coldTail = await bandAt(tail)
  const coldBody = await bandAt(body)

  // SELF-CHECK: the hover must have added a name at all, or an empty tail proves nothing.
  expect(
    hotBody - coldBody,
    `the hover drew a name on the pair's midline (body ${coldBody} -> ${hotBody})`,
  ).toBeGreaterThan(40)
  expect(
    hotTail - coldTail,
    `and nothing where the INLINE long name would have reached (tail ${coldTail} -> ${hotTail}, window ${Math.round(win.short + 14)}..${Math.round(win.long)}px)`,
  ).toBeLessThan(Math.max(8, (hotBody - coldBody) / 5))

  // WHAT THE FRAME ACTUALLY PASSED TO fillText. The pixel bands below prove a qualifier line is
  // RENDERED; this proves WHICH STRING the main line is — and it has to come from the app, because
  // `ox` is derived from `halfW`, a draw-local closure. Three pixel oracles built on a recomputed
  // `ox` all landed over the name's body instead of its tail and let the "inline long name" mutant
  // through. `_lastPairLabel` is published by the renderer itself, so this reads output, not logic.
  // `geo` was captured WHILE hovering the picked pair, before the control frame parked the pointer
  // on empty sky. Re-hovering to re-read it is not free: `_lastPairLabel` holds whichever group
  // drew LAST in the frame, and a hover that has not re-registered leaves the FOCUS's group there
  // — measured, idx 145 (the focus) where 1682 (the pick) was expected. Read the capture, do not
  // take a second one.
  const drawn = geo
  expect(drawn, "the pair group published what it drew").not.toBeFalsy()
  // compared against the node we PICKED, not against live `_hover`: the control frame parks the
  // pointer on empty sky, so `_hover` is legitimately null between readings and reading it here
  // was a TypeError waiting for the first person to add a control frame (it was).
  expect(drawn.idx, "…for the pair we are pointing at").toBe(pick!.idx)
  expect(
    drawn.main,
    `the main line is the SHORT name, not the inline qualified one (drew "${drawn.main}")`,
  ).toBe(pick!.main)
  expect(drawn.qual, "and the qualifier is a separate string on its own line").toBe(pick!.from)
  // SELF-CHECK: the hover must have added a name at all, or an empty tail proves nothing.
  expect(
    hotBody - coldBody,
    `the hover drew a name on the pair's midline (body ${coldBody} -> ${hotBody})`,
  ).toBeGreaterThan(40)
  expect(
    hotTail - coldTail,
    `and nothing where the INLINE long name would have reached (tail ${coldTail} -> ${hotTail}, window ${Math.round(win.short + 14)}..${Math.round(win.long)}px)`,
  ).toBeLessThan((hotBody - coldBody) / 5)

  // ...AND A QUALIFIER LINE IS GENUINELY RENDERED, not merely computed. The published strings
  // above prove WHICH name is on each row; these two bands prove there ARE two rows on the glass.
  // Both are measured at the baselines the frame published — a version pinned to `mid + 6` /
  // `mid + 21` went red the moment v1.129.4 lifted the block off the midline, which is the test
  // describing where the label used to be rather than where it is.
  const rowAt = (y: number) =>
    page.evaluate(
      ({ ox, y }: any) => {
        const a: any = (window as any).__neural
        const cv: HTMLCanvasElement = a.canvas
        const ctx = cv.getContext("2d")!
        const dpr = cv.width / cv.clientWidth
        const d = ctx.getImageData(
          Math.round((ox + 2) * dpr),
          Math.round((y - 12) * dpr),
          Math.round(300 * dpr),
          Math.round(15 * dpr),
        ).data
        let n = 0
        for (let i = 0; i < d.length; i += 4)
          if (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2] > 70) n++
        return n
      },
      { ox: geo.ox, y },
    )
  await page.mouse.move(pick!.sx - 50, pick!.sy - 50)
  await page.mouse.move(pick!.sx, pick!.sy)
  await j.advance(120)
  const mainRow = await rowAt(geo.nameY)
  const qualRow = await rowAt(geo.qualY)
  expect(mainRow, `the main name row is on the glass (${mainRow} px at y=${geo.nameY})`).toBeGreaterThan(60)
  expect(qualRow, `and the qualifier is a SECOND row beneath it (${qualRow} px at y=${geo.qualY})`).toBeGreaterThan(20)
  expect(geo.qualY - geo.nameY, "one row lead apart").toBeCloseTo(15, 5)

})

/**
 * THE FOCUS KICKER NAMES THE SIDE, NOT THE CATEGORY (v1.129.1). @curated
 *
 * Owner, zoomed out: "the subtitle instead of saying 'top', it says 'position: top', and that
 * position is irrelevant. I mean, it's saying that it's a position before saying 'top'."
 *
 * Right — and the graph already answers it. SHAPE is the category vocabulary (circle = position,
 * triangle = submission, diamond = transition, v1.103.6), shared by `nodeGlyph` and the canvas
 * `draw()`. Printing the word beside the shape that means it is the same "stated twice" defect the
 * in-node pass was deleted for in v1.114.0. The ROLE is the part no shape carries.
 *
 * This only shows at MERGE scale, where `pairGroup` stands down (v1.128.0) and the focus falls
 * through to `richLabel` — which is exactly the state the owner was looking at.
 */
test("@curated zoomed out, the focus label says the side and not the category", async ({ page }) => {
  const j = journey(page)
  await j.boot("/Positions/Side-Control/Bottom")
  await j.advance(6000)

  await page.mouse.move(page.viewportSize()!.width * 0.25, page.viewportSize()!.height * 0.18)
  for (let i = 0; i < 24; i++) {
    await page.mouse.wheel(0, 500)
    await j.advance(120)
  }
  await j.advance(200)

  const m = await page.evaluate(() => {
    const a: any = (window as any).__neural
    return { lodK: a._lodK, rich: a._lastRichLabel, pair: a._lastPairLabel, role: a.roleLabel() }
  })
  expect(m.lodK, "we are at merge scale, where the group stands down").toBeLessThan(0.5)
  expect(m.pair, "…so no pair group is drawn").toBeFalsy()
  expect(m.rich, "and the focus is named by the single rich label").toBeTruthy()
  expect(m.role, "the roll has a side to name").toBeTruthy()

  expect(
    m.rich.kicker.toUpperCase(),
    `the kicker is just the side (drew "${m.rich.kicker}")`,
  ).toBe(String(m.role).toUpperCase())
  for (const w of ["POSITION", "SUBMISSION", "TRANSITION"])
    expect(
      m.rich.kicker.toUpperCase(),
      `and never names the category — the shape already does (drew "${m.rich.kicker}")`,
    ).not.toContain(w)
})
