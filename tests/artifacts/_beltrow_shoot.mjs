#!/usr/bin/env node
/**
 * THE BELT IN THE DRAWER ROW: THE OWNER'S PICTURES (v1.276.0, STAGE2; NOT a gate, NOT a test: the gate is
 * e2e/journeys/belt-row.spec.ts and tests/belt_row.test.mjs).
 *
 * A real static server of a built tree (scripts/e2e-serve.mjs), real wall clock, real input at measured points (touch at
 * 390, mouse at 1440). Each state is shot twice, the same drawer and the same stored record: BEFORE (dev's own bundle,
 * `baseDist`, served in place of this build's) and AFTER (this build). Phone frames 390x631, not doubled; one desktop pair.
 * Every row was answered the day before (so today's count reads as a player's would, not as every seeded row).
 * Records come from the shared fixture's construction (tests/_rating_fixture.mjs) at numbers that agree with table a:
 *   white2   a record that reads white with two stripes (1224..1255), nothing proven on the Path
 *   dip      the same record holding blue with two stripes (`belts.lvl` 7): the number below what is worn
 *   fresh    an empty browser: nothing answered
 *   top      everything known: 2000, black
 *   waiting  white2 with the live files held: the row before its number lands
 *
 *   node tests/artifacts/_beltrow_shoot.mjs <outDir> <baseDist>      SHOOT_BASE (default http://localhost:8173)
 */
import { chromium } from "playwright"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { ratingApp, RATING_DAY } from "../_rating_fixture.mjs"
import { ngKnowledgeQuestionHash } from "../../neural/src/knowledge-profile.src.js"

const OUT = process.argv[2], BASE_DIST = process.argv[3]
const BASE = process.env.SHOOT_BASE || "http://localhost:8173"
const SERVED = fileURLToPath(new URL("../../source/public/static/neural", import.meta.url))
fs.mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const BASE_FILES = ["neural.js", "neural.css", "settings-ui.js", "gameplan.js"]
const D = RATING_DAY

// ── the records, built and read in node with the unit construction ──
const decks = {}
for (const f of fs.readdirSync(path.join(SERVED, "flashcards"))) {
  if (f === "_index.json" || f.startsWith("live-")) continue
  Object.assign(decks, JSON.parse(fs.readFileSync(path.join(SERVED, "flashcards", f), "utf8")))
}
const app = ratingApp(SERVED, "gi")
app._epochDay = () => D
const read = (srs, moves = {}) => { app.srs = srs; app.stage = {}; app.moves = moves; return app.rating() }
const W = app.scoreWeights("gi")
const order = Object.keys(decks).filter((k) => W[k] > 0).sort((a, b) => W[b] / decks[b].cards.length - W[a] / decks[a].cards.length || (a < b ? -1 : 1))
function recordAt(lo, hi) {
  const srs = {}
  for (const dk of order) {
    const add = {}
    for (const c of decks[dk].cards) add[ngKnowledgeQuestionHash(c.q)] = [D + 29, 30, D - 1]
    srs[dk] = add
    const r = read({ ...srs })
    if (r.points >= hi) {   // overshot with a whole deck: take its cards one by one
      srs[dk] = {}
      for (const [qh, row] of Object.entries(add)) { srs[dk][qh] = row; const s = read({ ...srs }); if (s.points >= lo) return { srs: { ...srs }, r: s } }
    }
    if (r.points >= lo) return { srs: { ...srs }, r }
  }
  throw new Error("no record in " + lo + ".." + hi)
}
const white2 = recordAt(1230, 1250)
const all = {}
// the top: everything known, answered the day before like every other record here. It reads 1996, black, "4 to the top
// of the scale": exactly 2000 needs every answer dated TODAY (a day's fade is 0.9^(1/30) a card), and today's answers ARE
// the daily count, so a 2000 picture would show every seeded card as answered today. The exact-2000 words ("The top of the
// scale") are pinned by tests/belt_row.test.mjs.
for (const [dk, d] of Object.entries(decks)) for (const c of d.cards) (all[dk] = all[dk] || {})[ngKnowledgeQuestionHash(c.q)] = [D + 29, 30, D - 1]
const moves = {}
for (const [st, shares] of app._ratingGame("gi").seats) for (const mv of shares.keys()) (moves[st] = moves[st] || {})[mv] = [D + 29, 30, D - 1, 1]
const top = read(all, moves)
const STATES = {
  white2: { blob: { v: 2, srs: white2.srs }, number: white2.r.points },
  dip: { blob: { v: 2, srs: white2.srs, belts: { won: {}, lvl: { n: 7, t: 1 } } }, number: white2.r.points },
  fresh: { blob: null, number: null },
  top: { blob: { v: 2, srs: all, moves }, number: top.points },
  waiting: { blob: { v: 2, srs: white2.srs }, number: white2.r.points, hold: true },
}

async function boot(browser, vp, dev, st) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: vp.mobile, hasTouch: vp.mobile, deviceScaleFactor: 1 })
  const page = await ctx.newPage(), errors = []
  page.on("pageerror", (e) => errors.push(e.message))
  await page.addInitScript(([d, blob]) => {
    window.__NG_EPOCH_DAY__ = d
    if (blob && !sessionStorage.getItem("shoot-seeded")) {
      sessionStorage.setItem("shoot-seeded", "1")
      localStorage.setItem("bjj-neural-owner:guest:progress", JSON.stringify({ format: "bjj-progress-owner-v1", owner: { kind: "guest" }, blob, savedAt: 0 }))
    }
  }, [D, st.blob])
  if (dev) await page.route((u) => BASE_FILES.some((f) => u.pathname === "/static/neural/app/" + f), (r) => {
    const f = path.basename(new URL(r.request().url()).pathname)
    return r.fulfill({ path: path.join(BASE_DIST, f), contentType: f.endsWith(".css") ? "text/css" : "text/javascript" })
  })
  let release = () => {}
  if (st.hold && !dev) {
    const gate = new Promise((r) => { release = r })
    await page.route(/\/flashcards\/live-\d+\.json(\?.*)?$/, async (r) => { await gate; await r.continue() })
  }
  await page.goto(BASE + "/")
  for (let i = 0; i < 120; i++) {
    if (await page.evaluate(() => !!document.querySelector(".ng-logo") && !!window.__neural)) break
    await sleep(250)
  }
  await sleep(4000)
  return { ctx, page, errors, release }
}
async function press(page, vp, sel) {
  const p = await page.evaluate((s) => { const el = document.querySelector(s); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } }, sel)
  if (!p) throw new Error("nothing to press: " + sel)
  if (vp.mobile) await page.touchscreen.tap(p.x, p.y); else await page.mouse.click(p.x, p.y)
  await sleep(700)
}
const row = (page) => page.evaluate(() => {
  const el = document.querySelector("[data-belt-row]")
  return el ? { state: el.getAttribute("data-belt-state"), number: el.querySelector(".ng-belt-num")?.getAttribute("data-belt-number") || "", lines: [...el.querySelectorAll("[data-belt-line] > div")].map((d) => d.innerText.trim()).filter(Boolean),
    belt: el.querySelector(".ng-belt")?.getAttribute("aria-label") } : null
})
const pathWords = (page) => page.evaluate(() => document.querySelector("[data-tab-sub='challenges']")?.textContent || "")
const today = (page) => page.evaluate(() => ({ tail: document.querySelector('[data-explore-stats] [data-b="due"] .ng-dr-tail')?.textContent || "",
  badge: document.querySelector("[data-badge-today]")?.textContent || "" }))

const PHONE = { w: 390, h: 631, mobile: true }, DESK = { w: 1440, h: 900, mobile: false }
const ONLY = process.env.SHOOT_ONLY ? process.env.SHOOT_ONLY.split(",") : null
const SHOTS = [["white2", PHONE], ["dip", PHONE], ["fresh", PHONE], ["top", PHONE], ["waiting", PHONE], ["white2", DESK]]
const browser = await chromium.launch()
const log = []
let n = 0
for (const [name, vp] of SHOTS) {
  for (const dev of [true, false]) {
    if (ONLY && !ONLY.includes(name)) { n++; continue }
    const st = STATES[name], tag = dev ? "before" : "after"
    const { ctx, page, errors, release } = await boot(browser, vp, dev, st)
    await press(page, vp, ".ng-logo")
    if (!dev) {
      const want = st.hold ? "wait" : st.number == null ? "none" : "ok"
      for (let i = 0; i < 120 && (await row(page))?.state !== want; i++) await sleep(250)
    }
    await sleep(1200)   // the frame at rest
    n++
    const file = String(n).padStart(2, "0") + "-" + name + "-" + tag + "-" + vp.w + ".jpg"
    await page.screenshot({ path: path.join(OUT, file), type: "jpeg", quality: 84 })
    log.push({ file, state: name, tag, vp: vp.w, record: st.number, row: dev ? null : await row(page), path: await pathWords(page), today: await today(page), errors })
    release()
    await ctx.close()
  }
}
await browser.close()
fs.writeFileSync(path.join(OUT, "shoot-log.json"), JSON.stringify(log, null, 1))
console.log(JSON.stringify(log.map((l) => [l.file, l.record && Math.floor(l.record), l.row && [l.row.state, l.row.number, l.row.belt, l.row.lines], l.path, l.today, l.errors.length])))
