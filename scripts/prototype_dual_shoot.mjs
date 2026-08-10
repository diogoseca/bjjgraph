// dualshoot.mjs — screenshot driver for the dual close-pair graph prototype.
// Serves the minimal shell in source/public on a PRIVATE port with serve-handler,
// then captures global / mid / roll-zoom / system-lighting shots for both offset
// strategies into tests/artifacts/dualnode/. Run under flock /tmp/bjj-pw.lock.
import http from "node:http";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";

const ROOT = "/home/user/Documents/bjjgraph-dualnode";
const require = createRequire(ROOT + "/package.json");
const handler = require("serve-handler");
const { chromium } = require("playwright-core");

const PORT = 8177;
const OUT = ROOT + "/tests/artifacts/dualnode";
mkdirSync(OUT, { recursive: true });

const server = http.createServer((req, res) =>
  handler(req, res, { public: ROOT + "/source/public", cleanUrls: false }),
);
await new Promise((res) => server.listen(PORT, res));
console.log("serving :" + PORT);

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || undefined,
});

async function shoot(variant) {
  const ctx = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  page.on("console", (m) => {
    if (m.type() === "error") console.log(`[${variant}] console.error:`, m.text().slice(0, 200));
  });
  page.on("pageerror", (e) => console.log(`[${variant}] pageerror:`, String(e).slice(0, 300)));
  await page.goto(`http://localhost:${PORT}/?dual=${variant}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => window.__neural && window.__neural.nodes && window.__neural.nodes.length > 2000,
    null,
    { timeout: 30000 },
  );
  // sanity dump
  const info = await page.evaluate(() => {
    const a = window.__neural;
    const pairs = a.nodes.filter((n) => n.pairId).length;
    return {
      nodes: a.nodes.length,
      links: a.links.length,
      pairs,
      graphW: a.graphW,
      mountTop: a._posSlugIndex.get("mount/top"),
      mountBottom: a._posSlugIndex.get("mount/bottom"),
      mountBare: a._posSlugIndex.get("mount"),
      hubAlias: a._idIndex.get("Positions/Mount"),
    };
  });
  console.log(`[${variant}]`, JSON.stringify(info));

  const holdCam = async (cx, cy, vw, ms = 1200) => {
    await page.evaluate(
      ({ cx, cy, vw, ms }) => {
        const a = window.__neural;
        if (window.__camHoldTimer) clearInterval(window.__camHoldTimer);
        const set = () => {
          a.cam = { cx, cy, vw, lvw: Math.log(vw) };
          a.camTarget = { cx, cy, vw };
        };
        set();
        window.__camHoldTimer = setInterval(set, 40);
        setTimeout(() => clearInterval(window.__camHoldTimer), ms);
      },
      { cx, cy, vw, ms },
    );
    await page.waitForTimeout(ms + 300);
  };

  // pause whatever the boot flow started; camera is ours for the static shots
  await page.evaluate(() => {
    const a = window.__neural;
    try { a.setPaused(true); } catch (e) {}
  });
  await page.waitForTimeout(800);

  // 1. GLOBAL — whole graph
  const g = await page.evaluate(() => {
    const a = window.__neural;
    return { cx: a.gcx || 0, cy: a.gcy || 0, vw: a.graphW * 1.05 };
  });
  await holdCam(g.cx, g.cy, g.vw);
  await page.screenshot({ path: `${OUT}/${variant}-01-global.png` });

  // 2. MID — centered on the Mount pair, a busy neighbourhood
  const mid = await page.evaluate(() => {
    const a = window.__neural;
    const i = a._idIndex.get("Positions/Mount");
    const n = a.nodes[i];
    return { cx: n.x, cy: n.y, vw: a.graphW * 0.18 };
  });
  await holdCam(mid.cx, mid.cy, mid.vw);
  await page.screenshot({ path: `${OUT}/${variant}-02-mid.png` });

  // 2b. CLOSE — pair anatomy, deep zoom on the Mount pair, still camera
  await holdCam(mid.cx, mid.cy, g.vw * 0.045);
  await page.screenshot({ path: `${OUT}/${variant}-03-close.png` });

  // 3. ROLL ZOOM — stage a roll at Mount/Top: fly, land, deal (clock held). The app owns
  // the camera here; this is the real landing frame with fog/focus + the landing card.
  await page.evaluate(() => {
    const a = window.__neural;
    if (window.__camHoldTimer) clearInterval(window.__camHoldTimer);
    const i = a._posSlugIndex.get("mount/top") ?? a._idIndex.get("Positions/Mount");
    a.stageRollAt(i);
  });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${OUT}/${variant}-04-roll.png` });

  // 4. SYSTEM LIGHTING — light one authored System's members (fog drops the rest to 30%)
  const sys = await page.evaluate(async () => {
    const a = window.__neural;
    a._ensureSystems && a._ensureSystems();
    for (let i = 0; i < 50 && !(a.systems && a.systems.length); i++)
      await new Promise((r) => setTimeout(r, 100));
    if (!(a.systems && a.systems.length)) return null;
    const s =
      a.systems.find((x) => /back attack|danaher/i.test(x.name || "")) ||
      a.systems.reduce((b, x) => ((x.nodes || []).length > (b.nodes || []).length ? x : b));
    const idxs = a.systemNodeIdxs(s);
    a.setFocusIdxSet(idxs);
    return { name: s.name, members: idxs.length };
  });
  console.log(`[${variant}] system:`, JSON.stringify(sys));
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${OUT}/${variant}-05-system.png` });

  await ctx.close();
}

for (const v of ["fixed", "force"]) await shoot(v);
await browser.close();
server.close();
console.log("done ->", OUT);
