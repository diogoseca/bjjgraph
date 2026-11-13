#!/usr/bin/env node
/**
 * WHAT IS WORTH MOST: THE OWNER'S PICTURES (v1.274.0, U171 a; NOT a gate, NOT a test: the gates are
 * tests/practice_queue.test.mjs and e2e/journeys/practice-order.spec.ts).
 *
 * A real static server of a built tree (scripts/e2e-serve.mjs), real wall clock, real input at measured points; ONE player,
 * seeded the way a saved account is (the guest progress envelope in localStorage): the journey's player
 * (tests/_practice_order_fixture.mjs: owed cards due today in the 4 position decks the game weighs most, a month overdue in
 * the 4 it weighs least). Oldest first puts the light decks first; worth puts the heavy positions first. The day is the app's test seam
 * (`__NG_EPOCH_DAY__`), set to today. Per width (390x844, 1440x900), before (dev's own bundle, `baseDist`, served in place
 * of this build's) and after (this build):
 *   01/02 drawer   the drawer open on its Train rows: before, Practice's "N due" pill; after, today's count only
 *   03/04 practice Practice open on its first card: the heading over it
 *   05/06 queue    "Practice details & session queue" open: the decks in order (after: under their positions)
 *
 *   node tests/artifacts/_order_shoot.mjs <outDir> <baseDist> [perf]      SHOOT_BASE (default http://localhost:8167)
 * `perf` shoots nothing: it times the first and a repeat `planSummary()` for the seeded player, before and after.
 */
import { chromium } from "playwright"
import fs from "node:fs"
import path from "node:path"
import { orderFixture } from "../_practice_order_fixture.mjs"

const OUT = process.argv[2], BASE_DIST = process.argv[3], PERF = process.argv[4] === "perf"
const BASE = process.env.SHOOT_BASE || "http://localhost:8167"
if (!PERF) fs.mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const now = new Date(), TODAY = Math.floor((now.getTime() - now.getTimezoneOffset() * 60000) / 86400000)
// the journey's player (tests/_practice_order_fixture.mjs), on today's date, from the tree this server serves
const FX = orderFixture(new URL("../../source/public/static/neural/", import.meta.url).pathname, TODAY)
const HEAVY = FX.heavy, LIGHT = FX.light, BLOB = FX.blob
const BASE_FILES = ["neural.js", "neural.css", "gameplan.js", "settings-ui.js", "mastery-gold.js"]
const VPS = [{ w: 390, h: 844, mobile: true }, { w: 1440, h: 900, mobile: false }]

async function boot(browser, vp, dev) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: vp.mobile, hasTouch: vp.mobile, deviceScaleFactor: 2 })
  const page = await ctx.newPage(), errors = []
  page.on("pageerror", (e) => errors.push(e.message))
  if (dev) await page.route((u) => BASE_FILES.some((f) => u.pathname === "/static/neural/app/" + f), (r) => {
    const f = path.basename(new URL(r.request().url()).pathname)
    return r.fulfill({ path: path.join(BASE_DIST, f), contentType: f.endsWith(".css") ? "text/css" : "text/javascript" })
  })
  await page.addInitScript(([blob, day]) => {
    localStorage.setItem("bjj-neural-owner:guest:progress", JSON.stringify({ format: "bjj-progress-owner-v1", owner: { kind: "guest" }, blob, savedAt: 0 }))
    window.__NG_EPOCH_DAY__ = day
  }, [BLOB, TODAY])
  await page.goto(BASE + "/")
  for (let i = 0; i < 160; i++) {
    if (await page.evaluate(() => !!document.querySelector(".ng-logo") && !!window.__neural?.nodes?.length && !!window.__neural?.flashcards?.decks).catch(() => false)) break
    await sleep(250)
  }
  await sleep(4000)
  return { ctx, page, errors }
}
async function press(page, vp, sel) {
  const p = await page.evaluate((s) => { const el = document.querySelector(s); if (!el) return null; el.scrollIntoView({ block: "nearest" }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } }, sel)
  if (!p) throw new Error("nothing to press: " + sel)
  if (vp.mobile) await page.touchscreen.tap(p.x, p.y); else await page.mouse.click(p.x, p.y)
  await sleep(700)
}
async function shot(page, name) { await page.screenshot({ path: path.join(OUT, name), type: "jpeg", quality: 84 }) }
const readRow = (page) => page.evaluate(() => { const r = document.querySelector('[data-explore-stats] [data-b="due"]'); return r ? { tail: r.querySelector(".ng-dr-tail")?.textContent, title: r.title } : null })
const readQueue = (page) => page.evaluate(() => [...document.querySelectorAll("[data-practice-queue] > *")].map((e) => (e.tagName === "P" ? "## " : "") + e.textContent))

const browser = await chromium.launch()
const log = { seed: { heavy: HEAVY, light: LIGHT, today: TODAY }, shots: [] }
for (const vp of VPS) {
  for (const [n, dev] of [[0, true], [1, false]]) {
    const tag = dev ? "before" : "after"
    const { ctx, page, errors } = await boot(browser, vp, dev)
    if (PERF) {
      const r = await page.evaluate(async () => {
        const a = window.__neural; await a._ensureGameplanRuntime()
        const t0 = performance.now(), p = a.planSummary(), t1 = performance.now(), again = []
        for (let i = 0; i < 7; i++) { const u = performance.now(); a.planSummary(); again.push(performance.now() - u) }
        again.sort((x, y) => x - y)
        return { first: +(t1 - t0).toFixed(1), againMedian: +again[3].toFixed(1), againMin: +again[0].toFixed(1), order: p.order || "(none)", rows: p.queue.length }
      })
      log.shots.push({ vp: vp.w, tag, ...r }); console.log(vp.w, tag, JSON.stringify(r)); await ctx.close(); continue
    }
    await press(page, vp, ".ng-logo")
    await page.evaluate(() => document.querySelector("[data-explore-stats]")?.scrollIntoView({ block: "start" })); await sleep(400)
    await shot(page, `0${1 + n}-drawer-${tag}-${vp.w}.jpg`)
    log.shots.push({ shot: `0${1 + n}-drawer-${tag}-${vp.w}.jpg`, row: await readRow(page), errors: errors.length })
    await press(page, vp, '[data-explore-stats] [data-b="due"]')
    for (let i = 0; i < 60 && !(await page.evaluate(() => !!window.__neural?._session?.plan)); i++) await sleep(250)
    await sleep(1200)
    await page.evaluate(() => document.querySelector("[data-plan-goal]")?.scrollIntoView({ block: "start" })); await sleep(400)
    await shot(page, `0${3 + n}-practice-${tag}-${vp.w}.jpg`)
    const heading = await page.evaluate(() => document.querySelector("[data-practice-section]")?.textContent)
    const open = await page.evaluate(() => document.querySelector('[data-session-row][aria-expanded="true"]')?.getAttribute("data-session-row"))
    log.shots.push({ shot: `0${3 + n}-practice-${tag}-${vp.w}.jpg`, heading, open, errors: errors.length })
    await press(page, vp, "[data-practice-details] > summary")
    await page.evaluate(() => document.querySelector("[data-practice-details]")?.scrollIntoView({ block: "start" })); await sleep(500)
    await shot(page, `0${5 + n}-queue-${tag}-${vp.w}.jpg`)
    log.shots.push({ shot: `0${5 + n}-queue-${tag}-${vp.w}.jpg`, queue: await readQueue(page),
      count: await page.evaluate(() => document.querySelector('[data-practice-details] [data-session-section="Practice"]')?.textContent), errors: errors.length })
    console.log(vp.w, tag, JSON.stringify(log.shots.slice(-3)))
    await ctx.close()
  }
}
await browser.close()
if (!PERF) fs.writeFileSync(path.join(OUT, "shoot-log.json"), JSON.stringify(log, null, 1))
console.log(JSON.stringify(log.seed))
