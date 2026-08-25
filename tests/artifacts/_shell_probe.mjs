import { chromium } from "@playwright/test";
const S = "/tmp/claude-1000/-home-user-Documents-bjjgraph/31a1ad2d-0629-4234-8172-2dabc59e194a/scratchpad";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto("http://localhost:8080/Positions/Side-Control");
await p.waitForFunction(() => (window.__neural?.nodes || []).length > 1000, null, { timeout: 30000 });
await p.waitForTimeout(6500);
const t0 = await p.evaluate(() => {
  const a = window.__neural;
  const bar = document.querySelector(".ng-winbar > div");
  return {
    transport: !!document.querySelector("[data-transport]"),
    meterGrad: bar ? getComputedStyle(bar).backgroundImage.slice(0, 60) : null,
    labels: Array.from(document.querySelectorAll(".ng-winbar span")).map((s) => s.textContent).filter((t) => t === "Win" || t === "Lose"),
    paused: a.paused,
    clockArmed: a._decision ? a._decision.remaining : null,
  };
});
console.log("T0:", JSON.stringify(t0));
// the clock drains WHILE STAGED (paused)
await p.waitForTimeout(3000);
const t1 = await p.evaluate(() => ({ rem: window.__neural._decision?.remaining, paused: window.__neural.paused }));
console.log("T1 (staged drain):", JSON.stringify(t1));
// last-3s: hot card
await p.waitForTimeout(4200);
const t2 = await p.evaluate(() => ({
  hot: !!document.querySelector(".ng-landcard.ng-clock-hot"),
  rem: Math.round(window.__neural._decision?.remaining ?? -1),
}));
console.log("T2 (hot):", JSON.stringify(t2));
// bg click 1 → card closes; bg click 2 → roam
const bg = await p.evaluate(() => {
  const a = window.__neural;
  a._tapBackground();
  return { card: !!a._landEl, beats: (a.beats || []).slice(-3).map((x) => x.beat), tray: (a.optionIdxs || []).length };
});
console.log("T3 (bg1):", JSON.stringify(bg));
const bg2 = await p.evaluate(() => {
  const a = window.__neural;
  const vw0 = a.cam.vw;
  a._tapBackground();
  return { roam: !!a._roam, tray: (a.optionIdxs || []).length, beats: (a.beats || []).slice(-2).map((x) => x.beat), vwTarget: a.camTarget ? +(a.camTarget.vw / vw0).toFixed(2) : null };
});
console.log("T4 (bg2 roam):", JSON.stringify(bg2));
// from roam: click (stage) a submission ATTACKER — Finish-it highlight + in-place commit
await p.evaluate(() => {
  const a = window.__neural;
  a.stageRollAt(a.nodes.findIndex((n) => n.t === "Americana from Kimura Trap"));
});
await p.waitForTimeout(2500);
const t5 = await p.evaluate(() => {
  const a = window.__neural;
  const st = a._stagedTech;
  const oc = (a._optionCards || []).find((c) => c.opt && st && c.opt.idx === st.idx);
  return {
    roam: !!a._roam, staged: st ? a.nodes[st.idx].t + "/" + st.side : null,
    eyebrow: oc ? oc.card.querySelector("span").textContent : null,
    border: oc ? oc.card.style.borderColor : null,
  };
});
console.log("T5 (finish-it):", JSON.stringify(t5));
await p.screenshot({ path: `${S}/finish-it.png` });
// commit it: in-place (no travel-back) — record camFocus before/after start
const t6 = await p.evaluate(() => {
  const a = window.__neural;
  const before = { ...a.camFocus };
  const st = a._stagedTech;
  const opt = (a._optList || []).find((o) => o.idx === st.idx);
  a._optPick(opt);
  return { pulsePath: a.pulse ? a.pulse.path.map((i) => a.nodes[i].t) : null, before };
});
console.log("T6 (commit):", JSON.stringify(t6));
await p.waitForTimeout(400);
const t6b = await p.evaluate(() => {
  const a = window.__neural;
  return { camFocus: a.camFocus ? "moved" : null, focus: a.focusIdx >= 0 ? a.nodes[a.focusIdx].t : null, pulseDone: !a.pulse || a.pulse.done };
});
console.log("T6b:", JSON.stringify(t6b));
await p.waitForTimeout(4000);
console.log("T6c beats:", JSON.stringify(await p.evaluate(() => (window.__neural.beats || []).slice(-5).map((x) => x.beat))));
// escaping orb → immediate rush
await p.evaluate(() => {
  const a = window.__neural;
  const kim = a.nodes.findIndex((n) => n.t === "Kimura from Knee on Belly");
  const node = a.nodes[kim];
  const partner = node.pi >= 0 ? node.pi : kim;
  a.stageRollAt(a.nodes[partner].role === "defender" ? partner : kim);
});
await p.waitForTimeout(2500);
const t7 = await p.evaluate(() => {
  const a = window.__neural;
  return {
    defense: a._defendSub != null,
    vignette: !!document.querySelector(".ng-vignette"),
    panic: !!document.querySelector("[data-panic]"),
    beats: (a.beats || []).slice(-4).map((x) => x.beat),
  };
});
console.log("T7 (rush on click):", JSON.stringify(t7));
await b.close();
