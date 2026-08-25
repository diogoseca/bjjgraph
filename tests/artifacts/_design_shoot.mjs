// Design-review portfolio: the REAL app, key surfaces, two viewports.
import { chromium } from "@playwright/test";
const S = "/tmp/claude-1000/-home-user-Documents-bjjgraph/31a1ad2d-0629-4234-8172-2dabc59e194a/scratchpad/shots";
const browser = await chromium.launch();

const shoot = async (viewport, tag, steps) => {
  const page = await browser.newPage({ viewport });
  const boot = async (url = "http://localhost:8080/Positions/Side-Control") => {
    await page.goto(url);
    await page.waitForFunction(() => (window.__neural?.nodes || []).length > 1000, null, { timeout: 30000 });
    await page.waitForTimeout(5500);
  };
  try { await steps(page, boot, async (name) => page.screenshot({ path: `${S}/${tag}-${name}.png` })); }
  catch (e) { console.log(tag, "ERR", String(e).slice(0, 120)); }
  await page.close();
};

// ── desktop 1440x900 ──
await shoot({ width: 1440, height: 900 }, "d", async (page, boot, snap) => {
  // 1: cold start front door (fresh profile, real first impression)
  await page.goto("http://localhost:8080/");
  await page.waitForFunction(() => (window.__neural?.nodes || []).length > 1000, null, { timeout: 30000 });
  await page.waitForTimeout(4500);
  await snap("01-coldstart");
  await page.waitForTimeout(5000);
  await snap("02-first-roll-running");

  // staged landing at a named position
  await boot();
  await snap("03-staged-landing");

  // mid-roll: play + let the clock run
  await page.evaluate(() => window.__neural.setPaused(false));
  await page.waitForTimeout(3500);
  await snap("04-midroll-decision");

  // option detail sheet
  await page.evaluate(() => {
    const a = window.__neural;
    const opt = a._optList && a._optList[0];
    const oc = (a._optionCards || []).find((c) => c.node === opt.node);
    a.expandOption(opt, a._optPick, oc && oc.card);
  });
  await page.waitForTimeout(1200);
  await snap("05-option-detail");
  await page.keyboard.press("Escape");

  // technique staged (v1.132: film + MC)
  await page.evaluate(() => {
    const a = window.__neural;
    a.stageRollAt(a.nodes.findIndex((n) => n.t === "Americana from Kimura Trap"));
  });
  await page.waitForTimeout(3000);
  await snap("06-technique-staged");

  // More fold open
  await page.evaluate(() => window.__neural.expandLandCard(true));
  await page.waitForTimeout(600);
  await snap("07-more-fold");
  await page.evaluate(() => window.__neural.expandLandCard(false));

  // defense rush
  await page.evaluate(() => {
    const a = window.__neural;
    const sub = a.adj[a.currentPos].find((k) => a.nodes[k].ty === "submissions");
    a.enterDefense(sub != null ? sub : 0);
  });
  await page.waitForTimeout(1500);
  await snap("08-defense-rush");
});

// ── desktop: pane surfaces + settings ──
await shoot({ width: 1440, height: 900 }, "d", async (page, boot, snap) => {
  await boot();
  await page.evaluate(() => window.__neural.openPane("explore"));
  await page.waitForTimeout(1500);
  await snap("09-pane-explore");
  await page.evaluate(() => window.__neural.openPane("challenges"));
  await page.waitForTimeout(1500);
  await snap("10-pane-challenges");
  await page.evaluate(() => { const a = window.__neural; a.setDeckOpen(false); a.openHomeToLatest(); });
  await page.waitForTimeout(1500);
  await snap("11-pane-history-study");
  await page.evaluate(() => { window.__neural.setDeckOpen(false); window.__neural.openSettings("rolling"); });
  await page.waitForTimeout(900);
  await snap("12-settings");
});

// ── phone 390x844 ──
await shoot({ width: 390, height: 844 }, "m", async (page, boot, snap) => {
  await boot();
  await snap("01-staged-landing");
  await page.evaluate(() => window.__neural.setPaused(false));
  await page.waitForTimeout(3500);
  await snap("02-midroll");
  await page.evaluate(() => {
    const a = window.__neural;
    a.stageRollAt(a.nodes.findIndex((n) => n.t === "Americana from Kimura Trap"));
  });
  await page.waitForTimeout(3000);
  await snap("03-technique");
  await page.evaluate(() => window.__neural.openPane("challenges"));
  await page.waitForTimeout(1500);
  await snap("04-pane");
  await page.evaluate(() => window.__neural.setDeckOpen(false));
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    const a = window.__neural;
    const sub = a.adj[a.currentPos].find((k) => a.nodes[k].ty === "submissions");
    a.enterDefense(sub != null ? sub : 0);
  });
  await page.waitForTimeout(1500);
  await snap("05-defense");
});

await browser.close();
console.log("portfolio done");
