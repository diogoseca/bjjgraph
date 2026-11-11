// PROTOTYPE ONLY (practicedrawer, PRACT1): what paints over the phone drawer (nothing) and its 98.4% background.
//   node e2e/practicedrawer-shots/probe-drawer-bleed.mjs   (needs this worktree served on :8217)
import { chromium } from "playwright";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
await p.goto("http://localhost:8217/Positions/Mount/Top?practice=a");
await p.waitForFunction(() => window.__neural && window.__neural.nodes && window.__neural.nodes.length > 100, null, { timeout: 90000 });
await sleep(6000);
const r = await p.locator(".ng-logo").boundingBox(); await p.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2); await sleep(1200);
console.log(JSON.stringify(await p.evaluate(() => {
  const d = document.querySelector(".ng-drill"), cs = getComputedStyle(d), dz = +cs.zIndex || 0;
  // what paints over the drawer: elements whose box meets the drawer, outside it, visible, on a higher plane
  const over = [];
  for (const x of [60, 200, 320]) for (const y of [40, 300, 600, 800]) {
    const stack = document.elementsFromPoint(x, y), i = stack.findIndex((e) => d.contains(e) || e === d);
    const above = stack.slice(0, Math.max(0, i)).filter((e) => !d.contains(e)).map((e) => e.tagName + "." + String(e.className).slice(0, 30) + " op=" + getComputedStyle(e).opacity + " pe=" + getComputedStyle(e).pointerEvents);
    if (above.length) over.push({ x, y, above: above.slice(0, 3) });
  }
  return { bg: cs.backgroundImage.slice(0, 120), bgc: cs.backgroundColor, z: cs.zIndex, opacity: cs.opacity, backdrop: cs.backdropFilter, over: over.slice(0, 6) };
})));
await b.close();
