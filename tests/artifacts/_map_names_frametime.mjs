#!/usr/bin/env node
/**
 * THE MAP'S NAMES: WHAT THEY COST A FRAME (v1.275.0; NOT a gate). The names are laid out in the draw path, 60 times a
 * second, on a phone (`_planNames`), so this times `draw()` itself, in the page, under a 4x CPU throttle (CDP
 * Emulation.setCPUThrottlingRate), at Standing Position top (36 dealt moves: the most names), at 390x844 and 1440x900:
 *   held   the follow camera's settled framing, and the same pulled back 4 times, 240 frames each (a plan made once, reused)
 *   ease   240 frames each moving the camera a step from 4 times out back to the usual zoom (a plan made every frame)
 * Reports the median and the 95th percentile per frame, in ms. Run once on the bundle before the change (--app DIR serves
 * that bundle's app files in place of the build's) and once on the build:
 *
 *   node tests/artifacts/_map_names_frametime.mjs [--base URL] [--app DIR] [--rate 4]
 */
import { chromium } from "playwright"
import fs from "node:fs"
import path from "node:path"

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf("--" + k); return i >= 0 ? args[i + 1] : d }
const BASE = opt("base", "http://localhost:8196"), APP = opt("app", null), RATE = +opt("rate", 4)
const APP_FILES = APP ? new Set(fs.readdirSync(APP)) : null
const browser = await chromium.launch()
const out = {}
for (const vp of [{ w: 390, h: 844 }, { w: 1440, h: 900 }]) {
  const mobile = vp.w < 700
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 3 : 1 })
  const page = await ctx.newPage()
  await page.addInitScript(() => { try { localStorage.clear() } catch {}; window.__NEURAL_TEST__ = true })
  await page.route("**/*", (r) => {
    const u = r.request().url()
    if (/^(http:\/\/localhost|data:|blob:|about:)/.test(u)) {
      const p = new URL(u).pathname, f = path.basename(p)
      if (APP_FILES && p === "/static/neural/app/" + f && APP_FILES.has(f)) return r.fulfill({ path: path.join(APP, f), contentType: f.endsWith(".css") ? "text/css" : "text/javascript" })
      return /\/static\/neural\/content\//.test(u) ? r.fulfill({ body: "{}", contentType: "application/json" }) : r.continue()
    }
    if (/fonts\./.test(u)) return r.fulfill({ status: 200, contentType: "text/css", body: "" })
    return r.abort()
  })
  await page.goto(BASE + "/?ngb=1", { waitUntil: "commit" })
  await page.waitForFunction(() => { const a = window.__neural; return a && a.nodes && a.nodes.length && a.flashcards && a.flashcards.decks }, null, { timeout: 120000 })
  await page.evaluate(() => { const a = window.__neural; if (a.TUTORIAL) { a.tut = { done: {} }; for (const s of a.TUTORIAL) a.tut.done[s.id] = 1; a._syncWhiteChallengeCompatibility(Date.now()); a.tutHidden = true; a.renderTutorial() } a.rig("ai-skill", [0.5]); a.rig("role", [0]); a.rig("max-moves", [0.5]); a.rigStart(a.nodes.findIndex((n) => n.ty === "positions" && n.t === "Standing Position Top")) })
  for (let i = 0; i < 16; i++) { await page.evaluate(() => window.__neural.advance(1000)); if (await page.evaluate(() => (window.__neural.optionIdxs || []).length > 0 && window.__neural._arriveGlideUntil == null)) break }
  await page.evaluate(() => window.__neural.advance(3000)); await new Promise((r) => setTimeout(r, 1600))
  await page.evaluate(() => { document.querySelectorAll("[data-reward]").forEach((e) => e.remove()); window.__neural._handTouched = true; window.__neural.advance(200) })
  const cdp = await ctx.newCDPSession(page)
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: RATE })
  const r = await page.evaluate(() => {
    const a = window.__neural, c0 = { cx: a.cam.cx, cy: a.cam.cy, vw: a.cam.vw }, N = 240
    const stat = (xs) => { const s = [...xs].sort((p, q) => p - q); return { median: +s[s.length >> 1].toFixed(3), p95: +s[Math.floor(s.length * 0.95)].toFixed(3) } }
    const time = (step) => { const xs = []; for (let k = 0; k < N; k++) { step(k); const t = performance.now(); a.draw(); xs.push(performance.now() - t) } return stat(xs) }
    const set = (vw) => { a.cam.vw = vw; a.cam.lvw = Math.log(vw) }
    for (let k = 0; k < 20; k++) a.draw()   // warm
    const res = {}
    set(c0.vw); res.held1 = time(() => {})
    set(c0.vw * 4); res.held4 = time(() => {})
    res.ease = time((k) => set(c0.vw * Math.pow(4, 1 - k / (N - 1))))
    set(c0.vw); a.draw()
    res.names1 = (a._lastNameBoxes || a._lastOptLabels || []).length
    return res
  })
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 })
  out[vp.w + "x" + vp.h] = r
  console.log(vp.w + "x" + vp.h, JSON.stringify(r))
  await ctx.close()
}
await browser.close()
