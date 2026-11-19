#!/usr/bin/env node
/**
 * THE SEAL: THE OWNER'S PICTURES (v1.272.0; NOT a gate, NOT a test: the gate is e2e/journeys/known-move-seal.spec.ts).
 * v1.280.0: the map's dot and the seal's two kinds are retired (the outlines, NG_MAP_MARKS; the seal's ring / disc / both):
 * this script's map section reads `_lastMapSeals`, which a later bundle no longer publishes. tests/artifacts/_outline_shoot.mjs
 * shoots the outlines and the four seals.
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
 * THE MAP (`map` as the third argument): the same player, plus Cross Collar Choke answered Yes with its flashcards
 * learned (dev: the THICK outline, U122 a's level 2); Americana and Kimura known (dev: the thin one). The camera is
 * framed on Mount and those three orbs the app's own way (`_fitView`), the roll paused, the same frame per width:
 *   10 before / 11 after      the map: thin and thick outlines (dev) against the dots
 *   10z / 11z                 the same frames, the orbs' part enlarged 3x (pixels repeated, nothing redrawn)
 *   12 focus                  every move dealt at Mount Top known, so the seat itself is known: the focus mark wears a
 *                             dot beside dotted option orbs
 *   13 mastery gold           "Turn what you know gold" on: the flashcards' colour on the orbs, and the dots
 *
 *   node tests/artifacts/_seal_shoot.mjs <outDir> <baseDist> [map]        SHOOT_BASE (default http://localhost:8197)
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
  if (ONLY === "map") {
    // Cross Collar Choke: a Yes too, so its deck learned makes dev's outline THICK; read the seat's dealt ordinals once
    const b0 = await boot(browser, VPS[1], {})
    const dealt = await b0.page.evaluate(() => { const a = window.__neural, i = a.nodes.findIndex((n) => n.id === "Positions/Mount" && n.role !== "bottom"); return a._dealtOrds(i, "top") })
    await b0.ctx.close()
    const yes = [TODAY + 9, 14, TODAY - 5, 1]
    BLOB = { ...BLOB, moves: { [S]: { ...MOVES[S], [ORD[ID.learned]]: yes } } }
    const ALL = { ...BLOB, moves: { [S]: Object.fromEntries(dealt.map((o) => [o, yes])) } }
    const frame = async (page, ids) => {
      await page.evaluate((ids) => {
        const a = window.__neural, idx = ids.map((id) => a.nodes.findIndex((n) => n.id === id && n.role !== "defender" && n.role !== "bottom"))
        a.setPaused(true)
        const t = a._fitView(idx, { minW: 0 })
        a.cam = { ...a.cam, cx: t.cx, cy: t.cy, vw: t.vw, lvw: Math.log(t.vw) }; a.camTarget = { ...a.camTarget, cx: t.cx, cy: t.cy, vw: t.vw }
        a.holdCamera()   // the app's own lease on the camera (frameNodes does the same), so the follow-cam leaves it
      }, ids)
      await sleep(700)
    }
    const IDS = ["Positions/Mount", ID.known, ID.due, ID.learned]
    const seals = (page) => page.evaluate(() => (window.__neural._lastMapSeals || []).map((d) => window.__neural.nodes[d.idx].t + " @" + Math.round(d.x) + "," + Math.round(d.y) + " r" + d.r.toFixed(1)))
    for (const vp of VPS) {
      let box = null
      for (const [name, dev, blob, gold] of [["10-map-before", true, BLOB, false], ["11-map-after", false, BLOB, false], ["12-map-focus", false, ALL, false], ["13-map-mastery-gold", false, BLOB, true]]) {
        const keep = BLOB; BLOB = { ...blob, settings: undefined }
        const b = await boot(browser, vp, { dev, hidden: false })
        BLOB = keep
        if (gold) { await b.page.evaluate(() => window.__neural.set("masteryGold", true)); await sleep(1500) }
        await b.page.mouse.move(2, 2)
        await frame(b.page, IDS)
        await shot(b.page, name, vp, (dev ? "dev: " : "this build: ") + name)
        log[log.length - 1].dots = dev ? null : await seals(b.page)
        console.log("   dots:", JSON.stringify(log[log.length - 1].dots))
        if (name === "10-map-before" || name === "11-map-after") {
          // the three move orbs' part of the frame, 3x, the same box in both
          if (!box) box = await b.page.evaluate((ids) => {
            const a = window.__neural, sc = a.W / a.cam.vw, pts = ids.slice(1).map((id) => { const n = a.nodes.find((x) => x.id === id && x.role !== "defender"); return [a.W / 2 + (n.x - a.cam.cx) * sc, a.H / 2 + (a._LY(n) - a.cam.cy) * sc] })
            const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2
            const w = Math.min(a.W, Math.max(120, Math.max(...xs) - Math.min(...xs) + 80)), h = Math.min(a.H, Math.max(90, Math.max(...ys) - Math.min(...ys) + 80))
            return { x: Math.max(0, Math.round(cx - w / 2)), y: Math.max(0, Math.round(cy - h / 2)), width: Math.round(w), height: Math.round(h) }
          }, IDS)
          const buf = await b.page.screenshot({ clip: box, type: "png" })
          const z = await b.page.evaluate(async ([b64, k]) => {
            const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode()
            const c = document.createElement("canvas"); c.width = img.width * k; c.height = img.height * k
            const x = c.getContext("2d"); x.imageSmoothingEnabled = false; x.drawImage(img, 0, 0, c.width, c.height)
            return c.toDataURL("image/jpeg", 0.9).split(",")[1]
          }, [buf.toString("base64"), 3])
          fs.writeFileSync(path.join(OUT, `${name.replace("-map-", "z-map-")}-zoom-${vp.w}.jpg`), Buffer.from(z, "base64"))
        }
        if (b.errors.length) log[log.length - 1].errors = b.errors
        await b.ctx.close()
      }
    }
  } else for (const vp of VPS) {
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
