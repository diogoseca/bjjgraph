// Reproduce the owner's three reports on the REAL dev server (:8080), real wall clock.
import { chromium } from "@playwright/test";
const S = "/tmp/claude-1000/-home-user-Documents-bjjgraph/31a1ad2d-0629-4234-8172-2dabc59e194a/scratchpad";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const boot = async (url) => {
  await page.goto(url);
  await page.waitForFunction(() => (window.__neural?.nodes || []).length > 1000, null, { timeout: 30000 });
  await page.waitForTimeout(5000); // intro + first landing
};
const dump = async (label) => {
  const d = await page.evaluate(() => {
    const a = window.__neural;
    const vis = (sel) => { const e = document.querySelector(sel); if (!e) return null;
      const cs = getComputedStyle(e); const r = e.getBoundingClientRect();
      return { display: cs.display, vis: cs.visibility, op: cs.opacity, w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top) }; };
    return {
      url: location.pathname,
      currentPos: a.nodes[a.currentPos]?.t, paused: a.paused, staged: a._staged,
      landMode: a._landMode, landIdx: a._landIdx != null ? a.nodes[a._landIdx]?.t : null,
      landOpen: a._landOpen, focusIdx: a.focusIdx >= 0 ? a.nodes[a.focusIdx]?.t : null,
      landcard: vis(".ng-landcard"), moreBody: vis("[data-land-more-body]"),
      landPlay: vis("[data-land-play]"), landId: vis("[data-land-id]"),
      optSheet: vis("[data-opt-detail]") || vis(".ng-optdetail"), confirm: vis("[data-confirm-play]"),
      modal: vis(".ng-modal"), nodeCard: a.nodeCardRef?.current ? getComputedStyle(a.nodeCardRef.current).display : null,
      trayCards: document.querySelectorAll("[data-tech]").length,
    };
  });
  console.log("── " + label + "\n" + JSON.stringify(d, null, 1));
  await page.screenshot({ path: `${S}/probe-${label}.png` });
};
// click the first VISIBLE node of a given type (what the owner actually does: taps an orb
// they can see around their position) — projected through the draw transform
const clickVisible = async (ty) => {
  const pt = await page.evaluate((want) => {
    const a = window.__neural;
    const cx = a.cam.cx, cy = a.cam.cy, vw = a.cam.vw, W = a.W, H = a.H;
    const s = W / vw;
    for (let i = 0; i < a.nodes.length; i++) {
      const n = a.nodes[i];
      if (n.ty !== want || i === a.currentPos) continue;
      const ly = a._LY ? a._LY(n) : n.y;
      const x = (n.x - cx) * s + W / 2, y = (ly - cy) * s + H / 2;
      // clear of the landing card band and edges
      if (x > 120 && x < W - 120 && y > 120 && y < 320) return { x, y, t: n.t, i };
    }
    return null;
  }, ty);
  if (!pt) { console.log("no visible node of type", ty); return null; }
  console.log("clicking", pt.t, "at", Math.round(pt.x), Math.round(pt.y));
  await page.mouse.click(pt.x, pt.y);
  await page.waitForTimeout(2500);
  return pt.t;
};

// A — graph tap on a SUBMISSION near the current position
await boot("http://localhost:8080/Positions/Side-Control/Top");
await dump("A0-arrival-side-control-top");
await clickVisible("submissions");
await dump("A1-tapped-submission");

// B — graph tap on a TRANSITION
await page.evaluate(() => window.__neural.rollFromPosition(
  window.__neural.nodes.findIndex((n) => n.t === "Side Control Top"), true));
await page.waitForTimeout(2000);
await clickVisible("transitions");
await dump("B1-tapped-transition");

// C — URL arrival ("redirected") on the submission's own pages
await boot("http://localhost:8080/Submissions/Belly-Down-Armbar/from-Side-Control");
await dump("C1-url-variant");
await boot("http://localhost:8080/Submissions/Belly-Down-Armbar");
await dump("C2-url-family-hub");

// D — PLAY on a DEFENDER-staged submission: the red rush
await boot("http://localhost:8080/Submissions/Kimura/from-Knee-on-Belly/Defender");
await dump("D0-defender-staged");
await page.evaluate(() => window.__neural.setPaused(false));
await page.waitForTimeout(1500);
const dBeats = await page.evaluate(() => (window.__neural.beats || []).slice(-8).map((b) => b.beat));
const dPanic = await page.evaluate(() => ({
  panic: !!document.querySelector("[data-panic]"),
  vignette: (() => { const v = document.querySelector(".ng-vignette"); return v ? getComputedStyle(v).opacity : null; })(),
  ev: window.__neural.evRef?.current?.textContent || "",
}));
console.log("D beats:", JSON.stringify(dBeats), "panic:", JSON.stringify(dPanic));
await dump("D1-defender-played");

// E — PLAY on an ATTACKER-staged transition: the exchange commits
await boot("http://localhost:8080/Transitions/Float-Passing");
await dump("E0-attacker-staged");
await page.evaluate(() => window.__neural.setPaused(false));
await page.waitForTimeout(2500);
const eBeats = await page.evaluate(() => (window.__neural.beats || []).slice(-10).map((b) => b.beat + (b.technique ? ":" + b.technique : "")));
console.log("E beats:", JSON.stringify(eBeats));
await dump("E1-attacker-played");
await browser.close();
