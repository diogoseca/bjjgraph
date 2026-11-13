#!/usr/bin/env node
/**
 * EVERYTHING OPENS: THE OWNER'S PICTURES (v1.269.0, U163 c; NOT a gate, NOT a test: the gate is
 * e2e/journeys/everything-opens.spec.ts).
 *
 * A real static server of a built tree (scripts/e2e-serve.mjs), real wall clock, real input at measured points; a fresh
 * white belt (an empty browser). Per width (390x844, 1440x900), before (dev's own bundle, `baseDist`, served in place of
 * this build's) and after (this build), the same three places, each at the same anchor in both shots:
 *   path      the Path, scrolled so the Blue section starts at the top of the drawer (after: unfolded, its lessons shown)
 *   settings  Settings, Flashcards, scrolled to the Recall mode row
 *   practice  Practice: before, the first new card it offers; after, a card from a later family (via "Keep practising"
 *             and the session queue)
 *
 *   node tests/artifacts/_opens_shoot.mjs <outDir> <baseDist>      SHOOT_BASE (default http://localhost:8167)
 */
import { chromium } from "playwright"
import fs from "node:fs"
import path from "node:path"

const OUT = process.argv[2], BASE_DIST = process.argv[3]
const BASE = process.env.SHOOT_BASE || "http://localhost:8167"
fs.mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const CUR = JSON.parse(fs.readFileSync(new URL("../../source/public/static/neural/curriculum.json", import.meta.url), "utf8"))
const WHITE = [...new Set(CUR.belts.find((b) => b.id === "white").units.flatMap((u) => u.lessons.map((l) => l.deckKey.split("|")[0])))]
const BASE_FILES = ["neural.js", "neural.css", "settings-ui.js", "gameplan.js"]
const VPS = [{ w: 390, h: 844, mobile: true }, { w: 1440, h: 900, mobile: false }]

async function boot(browser, vp, dev) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: vp.mobile, hasTouch: vp.mobile, deviceScaleFactor: 2 })
  const page = await ctx.newPage(), errors = []
  page.on("pageerror", (e) => errors.push(e.message))
  if (dev) await page.route((u) => BASE_FILES.some((f) => u.pathname === "/static/neural/app/" + f), (r) => {
    const f = path.basename(new URL(r.request().url()).pathname)
    return r.fulfill({ path: path.join(BASE_DIST, f), contentType: f.endsWith(".css") ? "text/css" : "text/javascript" })
  })
  await page.goto(BASE + "/")
  for (let i = 0; i < 120; i++) {
    if (await page.evaluate(() => { const a = window.__neural; return !!(a && a.curriculum && a.belts && a.belts.gf && a.flashcards) })) break
    await sleep(250)
  }
  await sleep(1500)
  return { ctx, page, errors }
}
async function press(page, vp, sel) {
  const p = await page.evaluate((s) => { const el = document.querySelector(s); if (!el) return null; el.scrollIntoView({ block: "nearest" }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } }, sel)
  if (!p) throw new Error("nothing to press: " + sel)
  if (vp.mobile) await page.touchscreen.tap(p.x, p.y); else await page.mouse.click(p.x, p.y)
  await sleep(600)
}
/** bring `sel` to the top of its scroller, the same anchor in the before and the after shot */
async function anchor(page, sel) {
  await page.evaluate((s) => { const el = document.querySelector(s); if (el) el.scrollIntoView({ block: "start" }) }, sel)
  await sleep(500)
}
async function shot(page, name) { await page.screenshot({ path: path.join(OUT, name), type: "jpeg", quality: 82 }) }

const browser = await chromium.launch()
const log = []
for (const vp of VPS) {
  for (const [n, dev] of [[0, true], [1, false]]) {
    const tag = dev ? "before" : "after"
    // 1. the Path
    let { ctx, page, errors } = await boot(browser, vp, dev)
    await press(page, vp, ".ng-logo")
    await press(page, vp, '.ng-dr-row[data-view="challenges"]')
    if (!dev) await press(page, vp, '[data-belt-toggle="blue"]')
    await anchor(page, '[data-belt="blue"]')
    await shot(page, `0${1 + n}-path-${tag}-${vp.w}.jpg`)
    log.push({ vp: vp.w, tag, place: "path", locked: await page.locator("[data-belt-locked]").count(), errors: errors.length })
    await ctx.close();
    // 2. Settings
    ({ ctx, page, errors } = await boot(browser, vp, dev))
    await page.evaluate(() => window.__neural.openSettings("flashcards")); await sleep(800)
    await anchor(page, dev ? "[data-recall-locked]" : "[data-recall-mode]")
    await shot(page, `0${3 + n}-settings-${tag}-${vp.w}.jpg`)
    log.push({ vp: vp.w, tag, place: "settings", switch: await page.locator("[data-recall-mode]").count(), errors: errors.length })
    await ctx.close();
    // 3. Practice
    ({ ctx, page, errors } = await boot(browser, vp, dev))
    await press(page, vp, ".ng-logo")
    await press(page, vp, '[data-explore-stats] [data-b="due"]')
    for (let i = 0; i < 40 && !(await page.evaluate(() => !!window.__neural._session?.plan)); i++) await sleep(250)
    let key = null
    if (!dev) {
      await press(page, vp, "[data-plan-more]")
      key = await page.evaluate((white) => (window.__neural._session.plan.fresh.map((r) => r.key).find((k) => !white.includes(k.split("|")[0]))) || null, WHITE)
      await press(page, vp, "[data-practice-details] > summary")
      await page.evaluate((k) => { const b = [...document.querySelectorAll("[data-practice-queue] button")].find((x) => x.textContent === k.replace("|", " · ")); if (b) b.setAttribute("data-shoot-jump", "1") }, key)
      await press(page, vp, "[data-shoot-jump]")
    }
    const fresh = await page.evaluate(() => window.__neural._session.plan.fresh.map((r) => r.key))
    await anchor(page, '[data-session-row][aria-expanded="true"]')
    await shot(page, `0${5 + n}-practice-${tag}-${vp.w}.jpg`)
    log.push({ vp: vp.w, tag, place: "practice", shown: key || (await page.locator('[data-session-row][aria-expanded="true"]').getAttribute("data-session-row")), laterFamiliesOffered: fresh.filter((k) => !WHITE.includes(k.split("|")[0])).length, fresh: fresh.length, errors: errors.length })
    await ctx.close()
  }
}
await browser.close()
fs.writeFileSync(path.join(OUT, "shoot-log.json"), JSON.stringify(log, null, 1))
console.log(JSON.stringify(log))
