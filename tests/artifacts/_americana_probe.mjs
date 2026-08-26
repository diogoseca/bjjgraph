// Reproduce: stand in Kimura Trap, click "Americana from Kimura Trap" — the owner's exact flow.
import { chromium } from "@playwright/test";
const S = "/tmp/claude-1000/-home-user-Documents-bjjgraph/31a1ad2d-0629-4234-8172-2dabc59e194a/scratchpad";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://localhost:8080/Positions/Kimura-Trap");
await page.waitForFunction(() => (window.__neural?.nodes || []).length > 1000, null, { timeout: 30000 });
await page.waitForTimeout(5500);
// click the Americana node the way the owner did (real projected click if visible, else stageRollAt)
const how = await page.evaluate(() => {
  const a = window.__neural;
  const i = a.nodes.findIndex((n) => n.t === "Americana from Kimura Trap");
  if (i < 0) return "missing";
  const s = a.W / a.cam.vw;
  const x = (a.nodes[i].x - a.cam.cx) * s + a.W / 2;
  const y = (a._LY(a.nodes[i]) - a.cam.cy) * s + a.H / 2;
  if (x > 60 && x < a.W - 60 && y > 60 && y < a.H - 60) { window.__pt = { x, y }; return "click"; }
  a.stageRollAt(i); return "staged-direct";
});
console.log("path:", how);
if (how === "click") {
  const pt = await page.evaluate(() => window.__pt);
  await page.mouse.click(pt.x, pt.y);
}
await page.waitForTimeout(2000);
const early = await page.evaluate(() => ({
  q: !!document.querySelector("[data-land-q]"),
  film: !!document.querySelector("[data-land-film]"),
}));
console.log("at +2s:", JSON.stringify(early));
await page.waitForTimeout(8000); // wall clock — payloads have long landed by now
const st = await page.evaluate(() => {
  const a = window.__neural;
  const key = a._landIdx != null ? a.deckKeyFor(a.nodes[a._landIdx]).key : null;
  return {
    url: location.pathname,
    currentPos: a.nodes[a.currentPos]?.t,
    focus: a.focusIdx >= 0 ? a.nodes[a.focusIdx]?.t : null,
    landIdx: a._landIdx != null ? a.nodes[a._landIdx]?.t : null,
    landMode: a._landMode,
    stagedTech: a._stagedTech ? a.nodes[a._stagedTech.idx].t + "/" + a._stagedTech.side : null,
    q: !!document.querySelector("[data-land-q]"),
    film: !!document.querySelector("[data-land-film]"),
    key,
    deckResident: key ? a._deckResident(key) : null,
    warmP: !!a._landWarmP,
    clips: (() => { const c = a.ngContentFor(a.nodes[a._landIdx]); return c && c.clips ? c.clips.length : null; })(),
    beatsTail: (a.beats || []).slice(-12).map((b) => b.beat + (b.reason ? ":" + b.reason : "")),
    ev: (a.evRef?.current?.textContent || "").replace(/\s+/g, " ").trim(),
  };
});
console.log(JSON.stringify(st, null, 1));
await page.screenshot({ path: `${S}/americana.png` });
await browser.close();
