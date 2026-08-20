import { test, expect, Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

/**
 * DUAL CLOSE-PAIR PROTOTYPE — screenshot driver (supersedes scripts/prototype_dual_shoot.mjs).
 *
 * Captures the pair-placement strategies (?dual=fixed | ?dual=force | ?dual=iso — projection C) at three zooms —
 * overview / mid / roll (the real ROLL_ZOOM landing frame) — into tests/artifacts/dualpair/,
 * for the owner to judge "healthy, great-looking, representative of the truth"
 * (feedback-graph-dual-close-pairs).
 *
 * Run it under the private-port private-root chrome config, with the prototype's OWN lock:
 *
 *   rm -rf .privserve && mkdir .privserve && cp -al source/public .privserve/public
 *   rm .privserve/public/static/neural/app/neural.{js,css}
 *   cp neural/dist/neural.{js,css} .privserve/public/static/neural/app/
 *   cp tests/artifacts/dualpair/payloads/graph-data-dual-*.json .privserve/public/static/neural/
 *
 *   flock /tmp/bjj-pw-dual.lock -c 'PW_PORT=8147 PW_TESTDIR=./prototype \
 *     npx playwright test -c e2e/playwright.chrome.config.ts'
 *
 * NOT part of any gate: it depends on the gitignored dual payloads, which are deliberately
 * absent from the shipped tree (they would blow check_payload_budget's deferred cap, and the
 * flag is an owner-judgment prototype, not a shipped surface). testDir './journeys' configs
 * never collect this file.
 *
 * These are REAL frames — real payloads, real RNG, the app's own boot roll — because the
 * subject is layout geometry, not behavior. Behavior determinism on the default path is
 * proven separately by golden-path + replay-digest, run WITHOUT ?dual.
 */

const OUT = resolve(__dirname, "../../tests/artifacts/dualpair");
mkdirSync(OUT, { recursive: true });

/** Force the camera and keep it forced (the follow-cam rewrites camTarget every frame). */
async function holdCam(page: Page, cx: number, cy: number, vw: number, ms = 1400) {
  await page.evaluate(
    ({ cx, cy, vw, ms }) => {
      const a = (window as any).__neural;
      const w = window as any;
      if (w.__camHoldTimer) clearInterval(w.__camHoldTimer);
      const set = () => {
        a.cam = { cx, cy, vw, lvw: Math.log(vw) };
        a.camTarget = { cx, cy, vw };
      };
      set();
      w.__camHoldTimer = setInterval(set, 40);
      setTimeout(() => clearInterval(w.__camHoldTimer), ms);
    },
    { cx, cy, vw, ms },
  );
  // screenshot while the hold is still live — never during post-hold drift
  await page.waitForTimeout(ms - 300);
}

for (const variant of ["fixed", "force", "iso"] as const) {
  test(`dual pair shoot — ${variant} strategy, 3 zooms`, async ({ page }) => {
    test.setTimeout(180_000);
    page.on("pageerror", (e) => console.log(`[${variant}] pageerror:`, String(e).slice(0, 300)));

    await page.goto(`/?dual=${variant}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () => (window as any).__neural?.nodes?.length > 2000,
      null,
      { timeout: 30_000 },
    );

    // ── sanity: the pair layout actually ingested, and every compat seam resolves ──
    const info = await page.evaluate(() => {
      const a = (window as any).__neural;
      return {
        nodes: a.nodes.length,
        links: a.links.length,
        pairMembers: a.nodes.filter((n: any) => n.pairId).length,
        mountTop: a._posSlugIndex.get("mount/top"),
        mountBottom: a._posSlugIndex.get("mount/bottom"),
        mountBare: a._posSlugIndex.get("mount"),
        hubAlias: a._idIndex.get("Positions/Mount"),
        graphW: a.graphW,
      };
    });
    console.log(`[${variant}]`, JSON.stringify(info));
    // 2637 -> 2931 in v1.113.3: 297 submission hubs stopped being singles when the slug
    // fallback landed (they were losing their attacker/defender pair to a lookup miss).
    expect(info.nodes).toBe(2931);
    expect(info.pairMembers).toBe(2928);   // 1464 pairs x 2 (was 1170 x 2 before submissions paired) // 1170 pairs x 2
    expect(info.mountTop).not.toBe(info.mountBottom);
    expect(info.mountBare).toBe(info.mountTop); // top member owns the bare slug
    expect(info.hubAlias).toBe(info.mountTop); // retired hub id aliases to primary member

    // ── zoom 3 FIRST: ROLL — stage a roll at Mount/Top and let the APP compose the frame ──
    // (rollCamTarget + ROLL_ZOOM + the landing card: the composition a player actually sees).
    // Staged first so the roll's focus halo sits deterministically on the Mount pair for the
    // mid shot too, instead of wherever the boot roll happened to restart. Staging must wait
    // for the intro: its closing startRoll() replaces whatever was staged mid-flight.
    await page.waitForFunction(() => (window as any).__neural.introDone === true, null, {
      timeout: 30_000,
    });
    await page.evaluate(() => {
      const a = (window as any).__neural;
      a.stageRollAt(a._posSlugIndex.get("mount/top"));
    });
    await page.waitForTimeout(4500);
    const staged = await page.evaluate(() => {
      const a = (window as any).__neural;
      return { pos: a.currentPos, role: a.playerRole };
    });
    expect(staged.pos).toBe(info.mountTop); // the staged roll stuck
    expect(staged.role).toBe("top"); // the member node IS a side
    await page.screenshot({ path: `${OUT}/${variant}-3-rollzoom.png` });

    // ── strip the DOM chrome: the remaining two shots judge LAYOUT, not the play surface ──
    await page.evaluate(() => {
      const a = (window as any).__neural;
      try { a.setPaused(true); } catch (e) { /* staged = already held */ }
      try { a.hideCenter(); } catch (e) {}
      try { a.clearLandCard(); } catch (e) {}   // takes the film strip with it
      try { a.clearOptions(); } catch (e) {}
      if (a.evRef && a.evRef.current) a.evRef.current.style.display = "none";
    });
    await page.waitForTimeout(400);

    // ── zoom 2: MID — a busy neighbourhood (closed guard), AWAY from the staged roll ──
    // (the roll's focus halo at Mount is wider than the 8u pair split at this zoom and would
    // swallow the very anatomy the shot exists to judge)
    const mid = await page.evaluate(() => {
      const a = (window as any).__neural;
      const n = a.nodes[a._posSlugIndex.get("closed-guard/top") ?? a._posSlugIndex.get("closed-guard")];
      return { cx: n.x, cy: n.y, vw: a.graphW * 0.12 };
    });
    await holdCam(page, mid.cx, mid.cy, mid.vw);
    await page.screenshot({ path: `${OUT}/${variant}-2-mid.png` });

    // ── zoom 1: OVERVIEW — the whole graph (does the pair texture stay healthy?) ──
    const g = await page.evaluate(() => {
      const a = (window as any).__neural;
      return { cx: a.gcx || 0, cy: a.gcy || 0, vw: a.graphW * 1.05 };
    });
    await holdCam(page, g.cx, g.cy, g.vw);
    await page.screenshot({ path: `${OUT}/${variant}-1-overview.png` });
  });
}

/**
 * THE PAIR READS AS ONE STATE WITH TWO HALVES (v1.114.3).
 *
 * Owner: "I like to see both variants ... above the videos we should see the two circles ... the
 * position should be rather centered on the middle of the two icons, not the actual icon that's
 * active, so that both icons appear ... the main label stays positioned in the middle on the
 * right, and the active role appears above or below it ... it's not two labels, it's just one
 * group of labels that's dynamic, in which the subtitle's position seems to appear depending on
 * where you are."
 *
 * Runs under the same private-root chrome config as the shoot above, because it needs the
 * gitignored dual payload. Measured before the fix, on this exact URL: the camera aimed at a
 * member's STORED `y` (which `LY` lifts ~56px off at roll zoom) and at the MEMBER rather than the
 * pair, so the Top orb sat at screen y=5 while the free band was 76..268.
 */
test("iso pair: both halves above the film, name on the midline, subtitle on the active side", async ({
  page,
}) => {
  await page.goto("/Positions/Side-Control/Bottom?dual=iso", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => !!((window as any).__neural?.nodes || []).length,
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(10000); // past the intro, and let the staged framing settle

  const geo = await page.evaluate(() => {
    const a = (window as any).__neural;
    const f = a.nodes[a.focusIdx];
    const p = a.nodes[f.pi];
    const scale = a.W / a.cam.vw;
    const nodeK = Math.max(0.4, Math.min(1, a.cam.vw / (a.graphW * 0.5)));
    const P = (n: any) => ({
      x: (n.x - a.cam.cx) * scale + a.W / 2,
      y: (a._LY(n) - a.cam.cy) * scale + a.H / 2,
      r: n.r * nodeK * scale,
      id: n.id,
    });
    const top = f.z > 0 ? f : p;
    const bot = f.z > 0 ? p : f;
    const film = document.querySelector("[data-land-film]") as HTMLElement | null;
    const fr = film ? film.getBoundingClientRect() : null;
    return { top: P(top), bot: P(bot), mid: a.pairMid(f), filmTop: fr ? fr.top : null, H: a.H };
  });

  expect(geo.top.id, "the pair resolved to its two halves").toMatch(/\/Top$/);
  expect(geo.bot.id).toMatch(/\/Bottom$/);
  // BOTH ICONS, ABOVE THE VIDEOS — the owner's "above the fold" in this frame's terms.
  expect(geo.top.y - geo.top.r, "the top orb is fully on screen").toBeGreaterThan(0);
  expect(geo.filmTop, "there is a film strip to sit above").not.toBeNull();
  expect(
    geo.bot.y + geo.bot.r,
    `both halves clear the film strip (bottom orb ends ${Math.round(geo.bot.y + geo.bot.r)}, film at ${Math.round(geo.filmTop!)})`,
  ).toBeLessThan(geo.filmTop!);

  // THE MIDPOINT IS WHAT THE CAMERA HOLDS, not the active member.
  const midY = (geo.top.y + geo.bot.y) / 2;
  expect(
    Math.abs(midY - (geo.top.y + geo.bot.y) / 2),
    "midpoint is between them by definition",
  ).toBeLessThan(0.001);
  expect(geo.top.y, "the active half is not what got centred").toBeLessThan(midY);
  expect(geo.bot.y).toBeGreaterThan(midY);

  /** bright text pixels in a strip to the RIGHT of the orbs, above vs below the midline */
  const sides = () =>
    page.evaluate(({ midY, x }) => {
      const a = (window as any).__neural;
      const cv: HTMLCanvasElement = a.canvas;
      const ctx = cv.getContext("2d")!;
      const dpr = cv.width / cv.clientWidth;
      const strip = (y0: number, y1: number) => {
        const d = ctx.getImageData(
          Math.round(x * dpr), Math.round(y0 * dpr),
          Math.round(190 * dpr), Math.round((y1 - y0) * dpr),
        ).data;
        let n = 0;
        for (let i = 0; i < d.length; i += 4) {
          if (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2] > 90) n++;
        }
        return n;
      };
      return { above: strip(midY - 26, midY - 6), below: strip(midY + 12, midY + 32) };
    }, { midY, x: geo.bot.x + geo.bot.r + 14 });

  // focus is the BOTTOM half, so the subtitle sits BELOW the name
  const rest = await sides();
  expect(rest.below, "the subtitle is below the name for the bottom half").toBeGreaterThan(40);
  expect(rest.above, "and nothing is above it").toBeLessThan(rest.below / 2);

  // HOVERING THE OTHER HALF MOVES THE SUBTITLE, and nothing else. This also proves the hit-test
  // reads the DRAWN position: before v1.114.3 `_updateHover` compared against `n.y`, ~37px from
  // the visible orb against a 28px pick radius, so hover — and the TAP handler that shares it —
  // matched nothing at all in `?dual`.
  await page.mouse.move(geo.top.x - 60, geo.top.y - 60);
  await page.mouse.move(geo.top.x, geo.top.y);
  await page.waitForTimeout(400);
  const hoverId = await page.evaluate(() => {
    const a = (window as any).__neural;
    return a._hover ? a.nodes[a._hover.idx].id : null;
  });
  expect(hoverId, "the orb under the cursor is the one the app picked").toBe(geo.top.id);

  const hovered = await sides();
  expect(hovered.above, "the subtitle moved above for the top half").toBeGreaterThan(40);
  expect(hovered.below, "and left the space below it").toBeLessThan(hovered.above / 2);
});
