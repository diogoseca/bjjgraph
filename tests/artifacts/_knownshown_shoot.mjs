#!/usr/bin/env node
/**
 * A MOVE YOU KNOW STAYS FACE UP: THE OWNER'S PICTURES (v1.266.0; NOT a gate, NOT a test: the gate is
 * e2e/journeys/known-moves-shown.spec.ts).
 *
 * A real static server of a built tree (scripts/e2e-serve.mjs, the production URL rule), real wall clock, real input at
 * measured points; one player, seeded the way a saved account is (the guest progress envelope in localStorage) with
 * moves hidden and, at Mount Top: two moves known (a Yes) and not due, due in 3 and in 9 days; one known and due
 * yesterday; the rest never answered. The day is the app's own test seam (`__NG_EPOCH_DAY__`), set to today.
 * Every shot is Mount Top with the row scrolled to the same card, per width:
 *   01 before     dev's own bundle (the 6 files of `baseDist`, served in place of this build's): everything face down
 *   02 after      this build: the two known, not-due moves face up
 *   03 due        the player comes back 4 days later: the move due in 3 days is face down again; the other stays up
 *                 (on the phone the row starts at the move that comes due; at 1440 at the row's first card)
 *   04 asked      a look at it (hover / tap) asks "Still got it?"
 *   05 yes        a Yes: face up again
 *   06 other      the reading NOT built (a runtime patch of `_moveState`, this shoot only): a never-answered move whose
 *                 flashcards are all learned counts as mastered, so it is face up too (with no gold: the card's gold is
 *                 the move's own Yes)
 *
 *   node tests/artifacts/_knownshown_shoot.mjs <outDir> <baseDist>      SHOOT_BASE (default http://localhost:8193)
 */
import { chromium } from "playwright"
import fs from "node:fs"
import path from "node:path"

const OUT = process.argv[2], BASE_DIST = process.argv[3]
const BASE = process.env.SHOOT_BASE || "http://localhost:8193"
fs.mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const ORD = JSON.parse(fs.readFileSync(new URL("../../node_ordinals.json", import.meta.url), "utf8")).ordinals
const now = new Date(), TODAY = Math.floor((now.getTime() - now.getTimezoneOffset() * 60000) / 86400000)
const S = ORD["Positions/Mount"] + "/top"
const ID = { soon: "Submissions/Ezekiel-Choke/from-Mount", later: "Submissions/Americana/from-Mount", due: "Submissions/Kimura/from-Mount" }
const MOVES = { [S]: {
  [ORD[ID.soon]]: [TODAY + 3, 7, TODAY - 4, 1],
  [ORD[ID.later]]: [TODAY + 9, 14, TODAY - 5, 1],
  [ORD[ID.due]]: [TODAY - 1, 3, TODAY - 4, 1],
} }
const BLOB = { v: 2, settings: { hideMoves: true }, settingsAt: { hideMoves: 1 }, moves: MOVES }
const BASE_FILES = ["neural.js", "settings-ui.js", "game-model.worker.js", "game-study.js", "game-study.worker.js", "game-values.js"]
const VPS = [{ w: 390, h: 844, mobile: true }, { w: 1440, h: 900, mobile: false }]

async function boot(browser, vp, dev) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: vp.mobile, hasTouch: vp.mobile, deviceScaleFactor: 2 })
  const page = await ctx.newPage(), errors = []
  page.on("pageerror", (e) => errors.push(e.message))
  if (dev) await page.route((u) => BASE_FILES.some((f) => u.pathname === "/static/neural/app/" + f), (r) =>
    r.fulfill({ path: path.join(BASE_DIST, path.basename(new URL(r.request().url()).pathname)), contentType: "text/javascript" }))
  await page.addInitScript(([blob, day]) => {
    localStorage.setItem("bjj-neural-owner:guest:progress", JSON.stringify({ format: "bjj-progress-owner-v1", owner: { kind: "guest" }, blob, savedAt: 0 }))
    window.__NG_EPOCH_DAY__ = day
    // the same rolls in every boot: the ambient draws a journey rigs (e2e/dsl.ts `land`), queued as the app appears
    let inst = null
    Object.defineProperty(window, "__neural", { configurable: true, get: () => inst, set: (v) => { inst = v; if (v && v.rig) { v.rig("ai-skill", [0.5]); v.rig("max-moves", [0.5]); v.rig("role", [0]) } } })
  }, [BLOB, TODAY])
  await page.goto(BASE + "/Positions/Mount/Top")
  // the hand, sorted by its win chances (or left as dealt), with every card's Win % painted
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
/** each own card in the row: its name, whether a player sees the name, its gold, what it asks, its Win % */
const cards = (page) => page.evaluate(() => [...document.querySelectorAll('[data-choice-group="you"] .ng-choice-card')].map((c) => ({
  t: c._choiceOpt.node.t, id: c._choiceOpt.node.id, up: getComputedStyle(c.querySelector(".ngchoice-title")).visibility === "visible",
  gold: c.hasAttribute("data-mastered"), asking: c.hasAttribute("data-asking") ? c.querySelector("[data-choice-grade] span")?.textContent : null,
  win: c.querySelector("[data-choice-win]")?.textContent, left: Math.round(c.getBoundingClientRect().left) })))
/** the same scroll in every shot: the row starts at the card named `at` */
const scrollTo = (page, id) => page.evaluate((id) => {
  const a = window.__neural, row = a.optionsRef.current, c = a._optionCards.find((o) => o.opt.node.id === id && !o.opt.threat).card
  a._handTouched = true
  row.scrollLeft = Math.max(0, c.offsetLeft - c.parentElement.offsetLeft - 8)
}, id)
async function shot(page, name, vp, at, log) {
  await page.mouse.move(2, 2)
  await scrollTo(page, at); await sleep(400)
  const file = path.join(OUT, `${name}-${vp.w}.jpg`)
  await page.screenshot({ path: file, type: "jpeg", quality: 86 })
  const row = await cards(page)
  log.push({ shot: path.basename(file), cards: row.filter((c) => c.left > -100 && c.left < vp.w).map((c) => `${c.t} [${c.up ? "up" : "down"}${c.gold ? ", gold" : ""}${c.asking ? ", asks " + c.asking : ""}] ${c.win}`) })
  console.log(" ", path.basename(file), JSON.stringify(log[log.length - 1].cards))
}
async function look(page, vp, id) {
  const p = await page.evaluate((id) => {
    const c = window.__neural._optionCards.find((o) => o.opt.node.id === id && !o.opt.threat).card
    c.scrollIntoView({ inline: "nearest", block: "nearest" })
    const r = c.getBoundingClientRect()
    const x = r.left + r.width / 2, y = r.top + 22, t = document.elementFromPoint(x, y)
    return { x, y, ok: !!t && c.contains(t) }
  }, id)
  if (!p.ok) throw new Error(`${id}: its title row is not reachable`)
  if (vp.mobile) await page.touchscreen.tap(p.x, p.y); else await page.mouse.move(p.x, p.y)
  await sleep(700)
  return p
}

const browser = await chromium.launch()
const log = []
try {
  for (const vp of VPS) {
    // the row starts at the move that comes due in shot 03 on the phone, at the row's first card at 1440: the same card in
    // every shot of a width
    let b = await boot(browser, vp, false)
    const order = (await cards(b.page)).map((c) => c.id)
    const start = vp.mobile ? order.find((id) => id === ID.soon) || order[0] : order[0]
    await b.ctx.close()
    const dev = await boot(browser, vp, true)
    await shot(dev.page, "01-before-everything-hidden", vp, start, log)
    log[log.length - 1].errors = dev.errors
    await dev.ctx.close()
    b = await boot(browser, vp, false)
    await shot(b.page, "02-after-known-moves-shown", vp, start, log)
    // four days later, the tab comes back to the front: the move due in 3 days is up for review
    await b.page.evaluate((d) => { window.__NG_EPOCH_DAY__ = d; document.dispatchEvent(new Event("visibilitychange")) }, TODAY + 4)
    await sleep(600)
    await shot(b.page, "03-a-shown-move-comes-due", vp, start, log)
    await scrollTo(b.page, start); await sleep(300)
    const p = await look(b.page, vp, ID.soon)
    const file4 = path.join(OUT, `04-asked-still-got-it-${vp.w}.jpg`)
    await b.page.screenshot({ path: file4, type: "jpeg", quality: 86 })
    log.push({ shot: path.basename(file4), cards: (await cards(b.page)).filter((c) => c.id === ID.soon).map((c) => `${c.t} [${c.up ? "up" : "down"}, asks ${c.asking}]`) })
    console.log(" ", path.basename(file4), JSON.stringify(log[log.length - 1].cards))
    await sleep(600)
    const yes = await b.page.evaluate((id) => { const r = window.__neural._optionCards.find((o) => o.opt.node.id === id && !o.opt.threat).card.querySelector('[data-grade="yes"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } }, ID.soon)
    if (vp.mobile) await b.page.touchscreen.tap(yes.x, yes.y); else await b.page.mouse.click(yes.x, yes.y)
    await sleep(500)
    await shot(b.page, "05-yes-face-up-again", vp, start, log)
    log[log.length - 1].errors = b.errors
    await b.ctx.close()
    // the reading not built: a never-answered move whose flashcards are all learned counts as mastered
    b = await boot(browser, vp, false)
    const learned = await b.page.evaluate(async (start) => {
      // the first never-answered card from the shot's first card on: inside the picture at both widths
      const a = window.__neural, own = a._optionCards.filter((c) => !c.opt.threat)
      const i = Math.max(0, own.findIndex((c) => c.opt.node.id === start))
      const pick = own.slice(i).find((c) => !a._moveRow(c.opt) && c.opt.action !== "escape")
      const key = a.deckKeyFor(pick.opt.node).key
      if (!a._deckHasCards(key)) await a.hydrateDeck(key)
      a.stage[key] = Object.fromEntries(a._cardsOf(a.flashcards.decks[key]).map((c) => [a.qhash(c.q), 3]))
      const orig = a._moveState.bind(a)
      a._moveState = (opt) => { const s = orig(opt); return s === "new" && !a._moveRow(opt) && opt.action !== "escape" && a.deckMastery(a.deckKeyFor(opt.node).key) >= 1 ? "known" : s }
      a._publishKnowledge("shoot:other-reading")
      return { t: pick.opt.node.t, mastery: a.deckMastery(key) }
    }, start)
    console.log("  other reading: flashcards learned on", JSON.stringify(learned))
    await shot(b.page, "06-other-reading-flashcards-learned", vp, start, log)
    log[log.length - 1].learned = learned
    log[log.length - 1].errors = b.errors
    await b.ctx.close()
  }
} finally {
  fs.writeFileSync(path.join(OUT, "shots.json"), JSON.stringify(log, null, 1))
  await browser.close()
}
