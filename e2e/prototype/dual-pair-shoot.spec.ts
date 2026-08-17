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
    expect(info.nodes).toBe(2637);
    expect(info.pairMembers).toBe(2340); // 1170 pairs x 2
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
