#!/usr/bin/env node
// Real site, real authored cards and payloads. No DSL, ngtest URL, dossier stubs,
// synthetic cards, or locator.click. Only the labelled progress profiles are seeded.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const base = process.env.SHOOT_BASE || "http://localhost:8276";
const out = process.argv[2];
const phase = process.argv[3] || "after";
if (!out) throw Error("Provide the owner screenshot directory");
fs.mkdirSync(out, { recursive: true });
const receipts = [];
async function hit(page, selector) {
  const el = page.locator(selector).first();
  await el.waitFor({ state: "visible" });
  const b = await el.boundingBox();
  if (!b || b.x < 0 || b.y < 0 || b.y + b.height > page.viewportSize().height) throw Error("Offscreen control: " + selector);
  const x = b.x + b.width / 2, y = b.y + b.height / 2;
  if (!await el.evaluate((e, { x, y }) => { const h = document.elementFromPoint(x, y); return h === e || e.contains(h); }, { x, y })) throw Error("Covered control: " + selector);
  await page.mouse.click(x, y);
}
const browser = await chromium.launch();
try {
  for (const vp of [{ width: 390, height: 631 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    for (const profile of ["fresh", "long-answer", "goal-reached", "pending-comparison", "keyboard"]) {
      const context = await browser.newContext({ viewport: vp, hasTouch: vp.width < 500, isMobile: vp.width < 500, deviceScaleFactor: 1 });
      const page = await context.newPage(), errors = [], payloads = new Set();
      page.on("pageerror", e => errors.push(String(e)));
      page.on("response", r => { if (/static\/neural\//.test(r.url()) && r.ok()) payloads.add(new URL(r.url()).pathname); });
      let held = 0, release;
      const gate = new Promise(r => { release = r; });
      if (profile === "pending-comparison") await page.route("**/app/gameplan.js*", async route => { held++; await gate; await route.continue(); });
      try {
        await page.goto(base + "/Positions/Mount/Top", { waitUntil: "load" });
        await page.waitForFunction(() => !!window.__neural?.curriculum && Object.keys(window.__neural.flashcards?.decks || {}).length > 0, { timeout: 30000 });
        await page.waitForTimeout(6500); // the real camera intro, not a rigged clock
        const fixture = await page.evaluate(async profile => {
          const a = window.__neural;
          a.setPaused(true);
          a.srs = {}; a.prep = {}; a.stage = {}; a.rec = {}; a.units = {};
          a.belts = { held: { id: "white", t: 1 }, gf: 1, won: {} };
          a.settings.dailyGoal = 20; a.settings.mcMode = "classic";
          a._gameplanProvider = null; a._miniGraded = new Set();
          const day = a._epochDay();
          let selected;
          if (profile === "long-answer") {
            const keys = a.curriculum.belts[0].units.flatMap(u => u.lessons).filter(l => a._lessonLive(l)).map(l => l.deckKey);
            await a.hydrateDecks(keys);
            selected = keys.flatMap(key => (a._cardsOf(a.flashcards.decks[key]) || []).map(c => ({ key, q: c.q, a: c.a })))
              .sort((a, b) => b.q.length + b.a.length - a.q.length - a.a.length)[0];
          } else if (profile !== "fresh" && profile !== "keyboard") {
            await a.hydrateDeck("Mount|Top");
            const c = a._cardsOf(a.flashcards.decks["Mount|Top"])[0];
            selected = { key: "Mount|Top", q: c.q, a: c.a };
          }
          if (selected) a.srs[selected.key] = { [a.qhash(selected.q)]: [day - 1, 3, day - 4] };
          if (profile === "goal-reached") a.srs["Previous practice|Top"] = Object.fromEntries(Array.from({ length: 20 }, (_, i) => ["prior" + i, [day + 1, 1, day]]));
          if (profile !== "pending-comparison") await a._ensureGameplanRuntime();
          a.setViewMode("explore");
          return { key: selected?.key, questionChars: selected?.q.length, answerChars: selected?.a.length, day };
        }, profile);
        if (!await page.evaluate(() => window.__neural.deckOpen)) await hit(page, ".ng-logo");
        const entry = '[data-explore-stats] [data-b="due"]';
        if (profile === "keyboard") {
          await page.locator(".ng-drawer-brand").focus();
          for (let n = 0; n < 40 && !await page.locator(entry).evaluate(e => e === document.activeElement); n++) await page.keyboard.press("Tab");
          if (!await page.locator(entry).evaluate(e => e === document.activeElement)) throw Error("Tab did not reach Practice");
          await page.keyboard.press("Enter");
        } else await hit(page, entry);
        await page.locator("[data-mini-q]:visible").first().waitFor();
        if (profile === "long-answer") {
          await page.locator("[data-mini-reveal]:visible").scrollIntoViewIfNeeded();
          await hit(page, "[data-mini-reveal]:visible");
        }
        if (profile === "keyboard") await page.keyboard.press("Tab");
        await page.waitForTimeout(250);
        const file = `${phase}-${vp.width}x${vp.height}-${profile}.png`;
        await page.screenshot({ path: path.join(out, file) });
        const state = await page.evaluate(() => {
          const a = window.__neural, q = [...document.querySelectorAll("[data-mini-q]")].find(e => e.getBoundingClientRect().height);
          const r = q?.getBoundingClientRect();
          return { practice: !!document.querySelector("[data-practice-page]"), scroll: a.drillListRef.current.scrollTop,
            questionTop: r?.top, questionBottom: r?.bottom, daily: a.practiceToday(), focused: document.activeElement?.outerHTML.slice(0, 350) };
        });
        if (profile === "pending-comparison" && held !== 1) throw Error("Expected one held real planner request, got " + held);
        receipts.push({ file, phase, viewport: vp, profile, fixture, held, state, errors, realPayloads: [...payloads] });
        console.log("SCREEN", file, JSON.stringify({ ...state, errors, held }));
      } finally { release(); await context.close(); }
    }
  }
} finally {
  await browser.close();
  fs.writeFileSync(path.join(out, phase + "-receipts.json"), JSON.stringify(receipts, null, 2) + "\n");
}
if (receipts.length !== 15 || receipts.some(r => r.errors.length)) process.exitCode = 1;
