#!/usr/bin/env node
/**
 * THE SEAL: THE OWNER'S PICTURES (v1.272.0; NOT a gate, NOT a test: the gate is e2e/journeys/known-move-seal.spec.ts).
 *
 * A real static server of a built tree (scripts/e2e-serve.mjs), real wall clock, real posters, real input at measured
 * points; one player seeded the way a saved account is (the guest progress envelope in localStorage), at Mount Top:
 *   known    Americana from Mount           a Yes, due in 9 days                 (dev: gold outline; now: filled seal)
 *   learned  Cross Collar Choke from Mount  never answered, every card learned   (dev: nothing;      now: hollow seal)
 *   due      Kimura from Mount              a Yes, due yesterday                 (dev: gold outline; now: no seal)
 *   fresh    Armbar from Mount              never met                            (nothing either way)
 * FOR THE PICTURE ONLY the four cards are moved to the front of the row, in that order, so they sit side by side at
 * both widths (the hand is marked touched first, so the app does not re-sort it). The "before" is dev's own bundle:
 * the files of `baseDist` that differ from this build's, served in place of them.
 *   01 before / 02 after      moves hidden, the row's start
 *   03 before / 04 after      moves shown, the row's start (every card face up: the due one wears gold before, nothing after)
 *   05 before / 06 after      moves hidden, the row scrolled to the due card (the phone shows the due and never-met cards)
 *   07 asked                  moves hidden: a look at the due card (hover at 1440, tap at 390) asks "Still got it?",
 *                             beside the sealed cards
 *   08 focused                moves shown: the known card focused from the keyboard (its focus ring) with its seal
 *   09 played                 moves shown: the known card just played (the stand-in, as it rises)
 *
 *   node tests/artifacts/_seal_shoot.mjs <outDir> <baseDist>        SHOOT_BASE (default http://localhost:8197)
 */
import { chromium } from "playwright"
import fs from "node:fs"
import path from "node:path"

const OUT = process.argv[2], BASE_DIST = process.argv[3], ONLY = process.argv[4] || "cards"
const BASE = process.env.SHOOT_BASE || "http://localhost:8197"
fs.mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const ORD = JSON.parse(fs.readFileSync(new URL("../../node_ordinals.json", import.meta.url), "utf8")).ordinals
const now = new Date(), TODAY = Math.floor((now.getTime() - now.getTimezoneOffset() * 60000) / 86400000)
const S = ORD["Positions/Mount"] + "/top"
const ID = { known: "Submissions/Americana/from-Mount", learned: "Submissions/Cross-Collar-Choke/from-Mount", due: "Submissions/Kimura/from-Mount", fresh: "Submissions/Armbar/from-Mount" }
const MOVES = { [S]: { [ORD[ID.known]]: [TODAY + 9, 14, TODAY - 5, 1], [ORD[ID.due]]: [TODAY - 1, 3, TODAY - 4, 1] } }
const HERE = path.resolve(new URL("../../neural/dist", import.meta.url).pathname)
const DIFFER = fs.readdirSync(HERE).filter((f) => fs.existsSync(path.join(BASE_DIST, f)) && !fs.readFileSync(path.join(HERE, f)).equals(fs.readFileSync(path.join(BASE_DIST, f))))
const VPS = [{ w: 390, h: 844, mobile: true }, { w: 1440, h: 900, mobile: false }]
console.log("  before = dev's", DIFFER.join(", "))

let BLOB = null
async function boot(browser, vp, { dev = false, hidden = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: vp.mobile, hasTouch: vp.mobile, deviceScaleFactor: 1 })
  const page = await ctx.newPage(), errors = []
  page.on("pageerror", (e) => errors.push(e.message))
  if (dev) await page.route((u) => DIFFER.some((f) => u.pathname === "/static/neural/app/" + f), (r) => {
    const f = path.basename(new URL(r.request().url()).pathname)
    return r.fulfill({ path: path.join(BASE_DIST, f), contentType: f.endsWith(".css") ? "text/css" : "text/javascript" })
  })
  await page.addInitScript(([blob, day]) => {
    if (blob) localStorage.setItem("bjj-neural-owner:guest:progress", JSON.stringify({ format: "bjj-progress-owner-v1", owner: { kind: "guest" }, blob, savedAt: 0 }))
    window.__NG_EPOCH_DAY__ = day
    let inst = null
    Object.defineProperty(window, "__neural", { configurable: true, get: () => inst, set: (v) => { inst = v; if (v && v.rig) { v.rig("ai-skill", [0.5]); v.rig("max-moves", [0.5]); v.rig("role", [0]) } } })
  }, [BLOB && { ...BLOB, settings: { hideMoves: hidden }, settingsAt: { hideMoves: 1 } }, TODAY])
  await page.goto(BASE + "/Positions/Mount/Top")
  for (let i = 0; i < 240; i++) {
    const ok = await page.evaluate(() => {
      const a = window.__neural, own = (a && a._optionCards || []).filter((c) => !c.opt.threat)
      const st = document.querySelector("[data-choice-value-status]")
      return own.length > 3 && own.every((c) => /^\d+$/.test(c.card.querySelector("[data-choice-win]")?.textContent || "")) && !!st && !/Calculating/.test(st.textContent || "")
    }).catch(() => false)
    if (ok) break
    await sleep(250)
  }
  await sleep(800)
  return { ctx, page, errors }
}
/** the picture's staging: the four seeded cards first in the row, in order; the hand marked touched (no re-sort) */
const stage = (page) => page.evaluate((ids) => {
  const a = window.__neural, cards = Object.entries(ids).map(([k, id]) => { const c = a._optionCards.find((o) => o.opt.node.id === id && !o.opt.threat).card; c.setAttribute("data-shot", k); return c })
  a._handTouched = true
  const row = cards[0].parentElement
  for (const c of cards.reverse()) row.insertBefore(c, row.firstElementChild)
  a._trayStop?.(); row.scrollLeft = 0
}, ID)
const scrollTo = (page, k) => page.evaluate((k) => { window.__neural._trayStop?.(); document.querySelector(`[data-shot="${k}"]`).scrollIntoView({ inline: "start", block: "nearest" }) }, k)
const state = (page) => page.evaluate(() => [...document.querySelectorAll("[data-shot]")].map((c) => {
  const s = getComputedStyle(c)
  return `${c.getAttribute("data-shot")}: ${c.hasAttribute("data-hide") && !c.hasAttribute("data-revealed") ? "face down" : "face up"}, seal ${c.getAttribute("data-seal") || "none"}, gold ${c.hasAttribute("data-mastered") ? "yes" : "no"}, border ${s.borderTopColor}${c.hasAttribute("data-asking") ? ", asks " + c.querySelector("[data-choice-grade] span")?.textContent : ""}`
}))
const log = []
async function shot(page, name, vp, note) {
  const file = path.join(OUT, `${name}-${vp.w}.jpg`)
  await page.screenshot({ path: file, type: "jpeg", quality: 88 })
  const row = { shot: path.basename(file), note, cards: await state(page) }
  log.push(row); console.log(" ", row.shot, JSON.stringify(row.cards))
}
async function pointAt(page, k, y = 22) {
  return page.evaluate(([k, y]) => {
    const c = document.querySelector(`[data-shot="${k}"]`), r = c.getBoundingClientRect(), x = r.left + r.width / 2, yy = r.top + y, t = document.elementFromPoint(x, yy)
    if (!t || !c.contains(t)) throw new Error(k + ": not reachable at its title row")
    return { x, y: yy }
  }, [k, y])
}

const browser = await chromium.launch()
try {
  // the learned deck's question hashes, from the app itself
  {
    const b = await boot(browser, VPS[1], {})
    const key = await b.page.evaluate((id) => { const a = window.__neural, k = a.deckKeyFor(a.nodes.find((n) => n.id === id && n.role !== "defender")).key; if (!a._deckHasCards(k)) void a.hydrateDeck(k); return k }, ID.learned)
    for (let i = 0; i < 120 && !(await b.page.evaluate((k) => window.__neural._deckHasCards(k), key)); i++) await sleep(250)
    const qh = await b.page.evaluate((k) => window.__neural._cardsOf(window.__neural.flashcards.decks[k]).map((c) => window.__neural.qhash(c.q)), key)
    await b.ctx.close()
    console.log("  learned deck", key, qh.length, "cards")
    BLOB = { v: 2, moves: MOVES, stage: { [key]: Object.fromEntries(qh.map((q) => [q, 3])) }, srs: { [key]: Object.fromEntries(qh.map((q) => [q, [TODAY + 30, 30, TODAY - 2]])) } }
  }
  for (const vp of VPS) {
    for (const [nb, na, hidden, at, what] of [["01-before", "02-after", true, "known", "moves hidden"], ["03-before-shown", "04-after-shown", false, "known", "moves shown"], ["05-before-due-and-new", "06-after-due-and-new", true, "due", "moves hidden, at the due card"]]) {
      for (const [name, dev] of [[nb, true], [na, false]]) {
        const b = await boot(browser, vp, { dev, hidden })
        await stage(b.page); await scrollTo(b.page, at); await b.page.mouse.move(2, 2); await sleep(900)
        await shot(b.page, name, vp, (dev ? "dev: " : "this build: ") + what)
        if (b.errors.length) log[log.length - 1].errors = b.errors
        await b.ctx.close()
      }
    }
    // 07: the asked card beside the sealed ones
    {
      const b = await boot(browser, vp, { hidden: true })
      await stage(b.page); await scrollTo(b.page, vp.mobile ? "learned" : "known"); await sleep(600)
      const p = await pointAt(b.page, "due")
      if (vp.mobile) await b.page.touchscreen.tap(p.x, p.y); else await b.page.mouse.move(p.x, p.y)
      await sleep(900)
      await shot(b.page, "07-asked-beside-sealed", vp, "this build: a look at the due card asks, beside the sealed cards")
      await b.ctx.close()
    }
    // 08: the known card focused from the keyboard
    {
      const b = await boot(browser, vp, { hidden: false })
      await stage(b.page); await scrollTo(b.page, "known"); await b.page.mouse.move(2, 2); await sleep(600)
      await b.page.evaluate(() => { const all = [...document.querySelectorAll('[data-choice-group="you"] [data-choice-execute]')], k = document.querySelector('[data-shot="known"] [data-choice-execute]'); const i = all.indexOf(k); (i > 0 ? all[i - 1] : document.querySelector('[data-hide-switch]') || document.body).focus() })
      await b.page.keyboard.press("Tab"); await sleep(400)
      await shot(b.page, "08-focused", vp, "this build: the known card focused from the keyboard")
      await b.ctx.close()
    }
    // 09: the known card just played
    {
      const b = await boot(browser, vp, { hidden: false })
      await stage(b.page); await scrollTo(b.page, "known"); await b.page.mouse.move(2, 2); await sleep(600)
      const p = await pointAt(b.page, "known")
      if (vp.mobile) await b.page.touchscreen.tap(p.x, p.y); else await b.page.mouse.click(p.x, p.y)
      await sleep(260)
      const file = path.join(OUT, `09-played-${vp.w}.jpg`)
      await b.page.screenshot({ path: file, type: "jpeg", quality: 88 })
      const st = await b.page.evaluate(() => { const h = document.querySelector("[data-executing-tech]"), f = h && h.firstElementChild; return h ? { tech: h.getAttribute("data-executing-tech"), seal: f.getAttribute("data-seal"), border: getComputedStyle(f).borderTopColor } : null })
      log.push({ shot: path.basename(file), note: "this build: the known card just played (the stand-in)", standIn: st }); console.log(" ", path.basename(file), JSON.stringify(st))
      await b.ctx.close()
    }
  }
} finally {
  fs.writeFileSync(path.join(OUT, "shots-" + ONLY + ".json"), JSON.stringify(log, null, 1))
  await browser.close()
}
