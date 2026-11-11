#!/usr/bin/env node
/**
 * THE SWITCH WORD + THE ONE STATUS SLOT, AS SHIPPED (v1.258.0; NOT a gate, NOT a test — the gates are the journeys).
 *
 * Real dev server, real wall clock, one browser at a time, every state reached by real input:
 *   calculating  the first frames after the deal, shot the instant the status says it (kept only if it still does)
 *   not sorted   a real WHEEL over card 1 before the values land: the hand is touched and never re-sorts itself
 *   sorted       a real tap (390) / click (1440) on "Sort by win chance"
 *   failed       game-values.js refused on its first import, then Retry pressed for real
 * Shown and Hidden: Hidden is set by a real press on the word right after the deal — which is ALSO the check that a
 * title press no longer freezes the hand (it must still sort itself when nothing else touched it).
 *
 *   node tests/artifacts/_hidetoggle_ship_shoot.mjs <rawDir> [main|trays]      SHOOT_BASE (default http://localhost:8167)
 */
import { chromium } from "playwright"
import fs from "node:fs"
import path from "node:path"

const RAW = process.argv[2], PART = process.argv[3] || "main"
const BASE = process.env.SHOOT_BASE || "http://localhost:8167"
fs.mkdirSync(RAW, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const VPS = [{ w: 390, h: 844, mobile: true }, { w: 1440, h: 900, mobile: false }]
const TITLE = '[data-choice-group="you"] > div'

const row = (page) => page.evaluate((TITLE) => {
  const a = window.__neural, t = document.querySelector(TITLE)
  if (!t) return null
  const st = t.querySelector("[data-choice-value-status]"), pr = t.querySelector("[data-choice-value-press]"), sw = t.querySelector("[data-hide-switch]")
  const shown = (el) => !!el && getComputedStyle(el).display !== "none" && el.getBoundingClientRect().width > 0
  const textEnd = (el) => { const g = document.createRange(); g.selectNodeContents(el); return g.getBoundingClientRect().right }
  const R = (el) => { const q = el.getBoundingClientRect(); return { l: q.left, t: q.top, r: q.right, b: q.bottom, w: q.width, h: q.height } }
  const cards = (a._optionCards || []).filter((c) => !c.opt.threat)
  return {
    status: st ? st.textContent : null, press: shown(pr) ? pr.textContent : null, pressName: shown(pr) ? (pr.getAttribute("aria-label") || pr.textContent) : null,
    act: shown(pr) ? pr.getAttribute("data-act") : null, pressBox: shown(pr) ? R(pr) : null,
    word: sw ? sw.textContent : null, switchName: sw ? sw.getAttribute("aria-label") : null, switchBox: sw ? R(sw) : null,
    end: Math.max(st ? textEnd(st) : 0, shown(pr) ? textEnd(pr) : 0), close: a._handCloseEl ? a._handCloseEl.getBoundingClientRect().left : null,
    line: t.getBoundingClientRect().height, title: R(t), touched: !!a._handTouched, cards: cards.length, hidden: a.get("hideMoves", false) === true,
  }
}, TITLE)
async function until(page, want, ms = 60000) {
  const t0 = Date.now()
  for (;;) {
    const r = await row(page).catch(() => null)
    if (r && want(r)) return r
    if (Date.now() - t0 > ms) return null
    await sleep(50)
  }
}
async function press(page, vp, sel) {
  const at = await page.evaluate(([TITLE, sel]) => {
    const b = document.querySelector(TITLE).querySelector(sel)
    const r = b.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, t = document.elementFromPoint(x, y)
    return { x, y, ok: !!t && b.contains(t), who: t ? t.outerHTML.slice(0, 90) : "nothing" }
  }, [TITLE, sel])
  if (!at.ok) throw new Error(`${sel}: its centre is not its own: ${at.who}`)
  if (vp.mobile) await page.touchscreen.tap(at.x, at.y); else await page.mouse.click(at.x, at.y)
  await sleep(700)
}
async function touchTray(page) {
  const p = await page.evaluate(() => { const c = window.__neural._optionCards.find((o) => !o.opt.threat).card.getBoundingClientRect(); return { x: c.left + c.width / 2, y: c.bottom - 12 } })
  await page.mouse.move(p.x, p.y); await page.mouse.wheel(0, 1); await page.mouse.move(5, 200)
}
async function boot(browser, vp, url, failFirst) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: vp.mobile, hasTouch: vp.mobile, deviceScaleFactor: 2 })
  const page = await ctx.newPage(), errors = []
  page.on("pageerror", (e) => errors.push(e.message))
  if (failFirst) await page.route(/\/app\/game-values\.js\?.*attempt=0/, (r) => r.abort())
  await page.goto(BASE + url)
  await until(page, (r) => r.cards > 1)
  return { ctx, page, errors }
}
const frame = async (page, file) => { await page.evaluate(() => { const r = window.__neural.optionsRef.current; if (r) r.scrollLeft = 0 }); await page.screenshot({ path: path.join(RAW, file) }); return row(page) }

const browser = await chromium.launch()
const log = []
try {
  if (PART === "main") {
    for (const vp of VPS) {
      for (const hide of [false, true]) {
        const tag = `${hide ? "hidden" : "shown"}-${vp.w}`, e = { w: vp.w, hide, states: {} }
        // calculating (retry the boot until the frame is caught; the window is short at 1440)
        for (let i = 0; i < 8 && !e.states.calculating; i++) {
          const b = await boot(browser, vp, "/Positions/Mount/Top")
          if (hide) await press(b.page, vp, "[data-hide-switch]")
          if (await until(b.page, (r) => r.status === "Calculating win chances…", 20000)) {
            await b.page.screenshot({ path: path.join(RAW, `${tag}-calculating.png`) })
            const after = await row(b.page)
            if (after.status === "Calculating win chances…") e.states.calculating = after
          }
          await b.ctx.close()
        }
        // untouched but for the word: it must still sort itself ("Sorted by win chance")
        let b = await boot(browser, vp, "/Positions/Mount/Top")
        if (hide) { const pre = await row(b.page); await press(b.page, vp, "[data-hide-switch]"); e.wordPressedWhile = pre.status }
        const self = await until(b.page, (r) => r.status === "Sorted by win chance" || (r.status === "" && !!r.press), 60000)
        e.afterWordOnly = self && { status: self.status, press: self.press, touched: self.touched }
        e.states.sorted = await frame(b.page, `${tag}-sorted.png`)
        await b.ctx.close()
        // touched early: "Sort by win chance", then pressed
        b = await boot(browser, vp, "/Positions/Mount/Top")
        if (hide) await press(b.page, vp, "[data-hide-switch]")
        await touchTray(b.page)
        await until(b.page, (r) => r.act === "sort" || r.status === "Sorted by win chance", 60000)
        await sleep(600)
        e.states.notSorted = await frame(b.page, `${tag}-notsorted.png`)
        if (e.states.notSorted.act === "sort") { await press(b.page, vp, "[data-choice-value-press]"); e.afterSortPress = await row(b.page) }
        e.errors = b.errors
        await b.ctx.close()
        // failed, then Retry
        b = await boot(browser, vp, "/Positions/Mount/Top", true)
        if (hide) await press(b.page, vp, "[data-hide-switch]")
        if (await until(b.page, (r) => r.act === "retry", 60000)) {
          e.states.failed = await frame(b.page, `${tag}-failed.png`)
          await press(b.page, vp, "[data-choice-value-press]")
          const back = await until(b.page, (r) => r.status === "Sorted by win chance" || (r.status === "" && !!r.press), 60000)
          e.afterRetry = back && { status: back.status, press: back.press, touched: back.touched }
        }
        e.errors.push(...b.errors)
        await b.ctx.close()
        const s = e.states
        console.log(tag, Object.keys(s).map((k) => `${k}: "${s[k].status}"${s[k].press ? " [" + s[k].press + "]" : ""} end ${Math.round(s[k].end)}`).join(" | "))
        console.log("   word only ->", JSON.stringify(e.afterWordOnly), "| sort press ->", e.afterSortPress && e.afterSortPress.status, "| retry ->", JSON.stringify(e.afterRetry), e.errors.length ? "ERR " + e.errors.join(";") : "")
        log.push(e)
      }
    }
  } else {
    const vp = VPS[0]
    for (const [where, url] of [["escape", "/Submissions/Triangle-Choke/from-Triangle-Control/Defender"], ["submission", "/Submissions/Triangle-Choke/from-Triangle-Control/Attacker"]]) {
      const b = await boot(browser, vp, url)
      const r = await until(b.page, (r) => r.status === "Sorted by win chance" || (r.status === "" && !!r.press), 60000)
      const f = await frame(b.page, `${where}-shown-390.png`)
      log.push({ where, row: f, errors: b.errors })
      console.log(where, JSON.stringify({ word: f.word, status: f.status, press: f.press, end: Math.round(f.end), close: f.close, titleW: Math.round(f.title.w) }), b.errors.join(";"))
      await b.ctx.close()
    }
  }
} finally {
  fs.writeFileSync(path.join(RAW, `ship-${PART}.json`), JSON.stringify(log, null, 1))
  await browser.close()
}
