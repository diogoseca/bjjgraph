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
 * ONE CLOCK (v1.114.1). Owner, testing: "for the current node, there's very little time for it to
 * be answered." The window itself is not short — measured 16.2s (a 9s base plus 0.8s per extra
 * option, settable in Settings -> Rolling) — and `setPaused` already froze the bars along with the
 * clock. What nobody kept in step was a REFUND: answering the landing question correctly calls
 * `refundDecision(2500)`, twice at most, adding up to 5s to that 16.2s window, while the bar was a
 * fixed-duration CSS animation that could not know. The hand then LOOKED about to expire with a
 * third of its time left. The bar is now written by `_tickDecision` from the same number.
 */
test("the countdown bar cannot disagree with the clock it draws", async ({ page }) => {
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
        const m = t.match(/matrix\(([-\d.]+)/) // scaleX lands in matrix[0]
        return m ? parseFloat(m[1]) : 1
      })
      return {
        remaining: d.remaining ?? null,
        total: d.total ?? null,
        n: bars.length,
        bar: bars.length ? bars.reduce((x, y) => x + y, 0) / bars.length : null,
      }
    })

  const before = await read()
  expect(before.n, "the hand is dealt and its cards carry bars").toBeGreaterThan(2)
  expect(
    before.bar!,
    "and the bars agree with the clock at the start",
  ).toBeCloseTo(before.remaining! / before.total!, 1)

  await j.advance(4000)
  const mid = await read()
  expect(mid.bar!, "they track it as it drains").toBeCloseTo(mid.remaining! / mid.total!, 1)

  // THE CASE THAT WAS LYING: buy time back the way a correct landing answer does.
  const granted = await page.evaluate(() =>
    (window as Any).__neural.refundDecision(2500),
  )
  expect(granted, "the refund was granted (cap is 2 per hand)").toBe(true)
  await j.advance(120)
  const after = await read()

  expect(
    after.remaining!,
    "the clock really did get the time back",
  ).toBeGreaterThan(mid.remaining!)
  expect(
    after.bar!,
    `and the bar moved with it (bar ${after.bar!.toFixed(3)} vs clock ${(after.remaining! / after.total!).toFixed(3)})`,
  ).toBeCloseTo(after.remaining! / after.total!, 1)
  expect(after.bar!, "visibly, not just arithmetically").toBeGreaterThan(mid.bar! + 0.05)
})
