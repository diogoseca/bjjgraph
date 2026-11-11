// PROTOTYPE ONLY (practicedrawer, PRACT1): the same finding on a deployed site, touch against mouse, read-only.
//   node e2e/practicedrawer-shots/probe-touch-plan-deployed.mjs https://dev.bjjgraph.pages.dev
import { chromium } from "playwright";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const base = process.argv[2];
const b = await chromium.launch();
for (const mode of [{ isMobile: true, hasTouch: true, touch: true }, { isMobile: false, hasTouch: false, touch: false }]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: mode.isMobile, hasTouch: mode.hasTouch });
  const p = await ctx.newPage();
  await p.goto(base + "/");
  await p.waitForFunction(() => window.__neural && window.__neural.curriculum && window.__neural.nodes && window.__neural.nodes.length > 100, null, { timeout: 90000 });
  await sleep(5000);
  const ver = await p.evaluate(() => (document.querySelector('script[src*="neural.js"]') || {}).src || "");
  await p.evaluate(async () => { await window.__neural._ensureGameplanRuntime(); });
  const press = async (sel) => { const r = await p.locator(sel).first().boundingBox(); const x = r.x + r.width / 2, y = r.y + r.height / 2; if (mode.touch) await p.touchscreen.tap(x, y); else await p.mouse.click(x, y); };
  await press(".ng-logo"); await sleep(900);
  await press('[data-explore-stats] [data-b="due"]'); await sleep(6000);
  console.log(mode.touch ? "touch" : "mouse", ver.split("/").pop(), JSON.stringify(await p.evaluate(() => { const a = window.__neural, s = a._session; return { practice: !!(s && s.practice), plan: !!(s && s.plan), keys: s && s.keys.length, count: (document.querySelector("[data-practice-details] p[data-session-section]") || {}).textContent }; })));
  await ctx.close();
}
await b.close();
