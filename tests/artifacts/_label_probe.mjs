import { chromium } from "@playwright/test";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://localhost:8080/Positions/Kimura-Trap");
await page.waitForFunction(() => (window.__neural?.nodes || []).length > 1000, null, { timeout: 30000 });
await page.waitForTimeout(5500);
await page.evaluate(() => {
  const a = window.__neural;
  a.stageRollAt(a.nodes.findIndex((n) => n.t === "Americana from Kimura Trap"));
});
await page.waitForTimeout(2500);
const st = await page.evaluate(() => {
  const a = window.__neural;
  return {
    pair: a._lastPairLabel || null,
    rich: a._lastRichLabel || null,
    activeMove: a.activeMove ? { name: a.activeMove.name, verb: a.activeMove.verb, idx: a.activeMove.idx } : null,
    pulse: !!a.pulse,
    focus: a.nodes[a.focusIdx]?.t,
    lodK: a._lodK,
  };
});
console.log(JSON.stringify(st, null, 1));
await browser.close();
