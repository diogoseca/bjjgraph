// PROTOTYPE ONLY (practicedrawer, PRACT1): the touch-plan finding on this worktree's build. A tap on Practice leaves
// the plan unmerged (`_afterPress` waits on a pointerleave the tap already fired); a second tap does not recover it.
//   node e2e/practicedrawer-shots/probe-touch-plan.mjs   (needs this worktree served on :8217)
import { chromium } from "playwright";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch();
for (const mode of [{ isMobile: true, hasTouch: true }]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, ...mode });
  const p = await ctx.newPage();
  await p.goto("http://localhost:8217/");
  await p.waitForFunction(() => window.__neural && window.__neural.curriculum && window.__neural.nodes && window.__neural.nodes.length > 100, null, { timeout: 90000 });
  await sleep(5000);
  await p.evaluate(async () => { const a = window.__neural; a.settings.dailyGoal = 20; await a._ensureGameplanRuntime(); });
  const tap = async (sel) => { const r = await p.locator(sel).first().boundingBox(); await p.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2); };
  await tap(".ng-logo"); await sleep(900);
  await tap('[data-explore-stats] [data-b="due"]'); await sleep(3000);
  const st = () => p.evaluate(() => { const a = window.__neural, s = a._session, l = a.explorerListRef.current; return { plan: !!(s && s.plan), keys: s && s.keys.length, listHover: l.matches(":hover"), listShown: getComputedStyle(l).display, panePress: !!a._panePress, owed: (a._paneOwed || []).length }; });
  console.log(JSON.stringify(mode), "after tap:", JSON.stringify(await st()));
  console.log("diag", JSON.stringify(await p.evaluate(() => { const a = window.__neural, s = a._session; let ps = null, err = null; try { const x = a.planSummary(); ps = x ? { status: x.status, fresh: x.fresh.length, due: x.due.length } : null; } catch (e) { err = String(e).slice(0, 200); } return { inline: a._sessionInline(), deckShown: a.deckShown, deck: !!a.deck, cp: !!a._checkpoint, ps, err, W: a.W }; })));
  await tap("[data-plan-goal]"); await sleep(1500);
  console.log(JSON.stringify(mode), "after a second tap on the goal line:", JSON.stringify(await st()));
  await ctx.close();
}
await b.close();
