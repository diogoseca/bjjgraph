import { chromium } from "@playwright/test";
const S = "/tmp/claude-1000/-home-user-Documents-bjjgraph/31a1ad2d-0629-4234-8172-2dabc59e194a/scratchpad";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://localhost:8080/Positions/Side-Control");
await page.waitForFunction(() => (window.__neural?.nodes || []).length > 1000, null, { timeout: 30000 });
await page.waitForTimeout(6000);
await page.evaluate(() => window.__neural.setPaused(false));
await page.waitForTimeout(1200);
const t0 = await page.evaluate(() => {
  const a = window.__neural;
  return {
    cue: !!document.querySelector("[data-challenge-cue]") || !!document.querySelector(".ng-tut"),
    legendEdge: !!document.querySelector("[data-legend-edge]"),
    armed: a._decision ? a._decision.remaining : "no-decision",
    clockBar: (() => { const b = document.querySelector("[data-land-clock]"); return b ? b.style.transform : null; })(),
    optBar: (() => { const b = document.querySelector(".ngbar"); return b ? b.style.transform : null; })(),
  };
});
console.log("T0:", JSON.stringify(t0));
// let the window expire (real clock)
await page.waitForTimeout(9500);
const t1 = await page.evaluate(() => {
  const a = window.__neural;
  return {
    remaining: a._decision ? a._decision.remaining : "no-decision",
    handAlive: (a.optionIdxs || []).length,
    revealed: !!document.querySelector("[data-land-q] [data-mc-result]"),
    qMod: a._qMod,
    beatsTail: (a.beats || []).slice(-6).map((b) => b.beat),
    currentPos: a.nodes[a.currentPos].t,
    ev: (a.evRef?.current?.textContent || "").replace(/\s+/g, " ").trim(),
    optBar: (() => { const b = document.querySelector(".ngbar"); return b ? b.style.transform : null; })(),
  };
});
console.log("T1 (post-expiry):", JSON.stringify(t1, null, 1));
await page.screenshot({ path: `${S}/clock-expired.png` });
// the hand still picks
await page.evaluate(() => { const a = window.__neural; a._optPick(a._optList[0]); });
await page.waitForTimeout(2500);
const t2 = await page.evaluate(() => ({ beats: (window.__neural.beats || []).slice(-5).map((b) => b.beat) }));
console.log("T2 (picked after expiry):", JSON.stringify(t2));
// defense
await page.evaluate(() => {
  const a = window.__neural;
  const sub = a.adj[a.currentPos].find((k) => a.nodes[k].ty === "submissions");
  a.enterDefense(sub != null ? sub : 0);
});
await page.waitForTimeout(1800);
const t3 = await page.evaluate(() => {
  const a = window.__neural;
  return {
    drillArmed: a._decision ? a._decision.remaining : "no-decision",
    panicClock: !!document.querySelector("[data-panic] [data-land-clock]"),
    logoHidden: (() => { const l = document.querySelector(".ng-logo"); return l ? l.style.opacity : null; })(),
    fog: a._dangerSet ? a._dangerSet.size : null,
    ev: (a.evRef?.current?.textContent || "").replace(/\s+/g, " ").trim(),
  };
});
console.log("T3 (defense):", JSON.stringify(t3, null, 1));
await page.screenshot({ path: `${S}/danger-new.png` });
// drill expiry: no pump, escapes still live
await page.waitForTimeout(9500);
const t4 = await page.evaluate(() => {
  const a = window.__neural;
  return {
    tapped: (a.beats || []).slice(-8).map((b) => b.beat),
    escapesAlive: (a.optionIdxs || []).length,
    pansShown: (() => { const p = document.querySelector(".pAns"); return p ? p.style.display : null; })(),
    stillCaught: a._defendSub != null,
  };
});
console.log("T4 (drill expired):", JSON.stringify(t4, null, 1));
await browser.close();
