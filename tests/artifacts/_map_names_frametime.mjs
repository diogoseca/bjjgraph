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
 *
 * A AGAINST B IN ONE PAGE (`--ab`; v1.280.0, so the figures of v1.278.1 and of v1.280.0 come from one script in the tree).
 * Two modes of the SAME bundle timed against each other at the same seat, held (the settled framing) and dragging (3 px a
 * frame, out and back), the frame clock moving 1/60 s a frame as in play:
 *   --ab hides  v1.278.1 (PR 414): `_hides` live (A) against short-circuited to the old box rule, `() => true` on the
 *               instance (B); each block starts from an empty store (`_hidC`). Also counts the box and style reads of one
 *               drawn frame, held and dragging, each mode
 *   --ab marks  v1.280.0: no orb marked (A) against every dealt orb marked both ways (B: `_movesGold` all, `_answered`
 *               all, and `_movesLearned` all for a bundle that still draws the dot). Run with --app on dev's bundle for
 *               the dot, and on the build for the outlines
 * --method blocks  60 frames a mode, alternated, 6 times; each mode's median and p95 (how v1.278.1's figures were taken)
 * --method paired  the modes alternate EVERY frame, 1,200 pairs; each mode's median and the median of the pairs'
 *                  differences, B minus the A drawn just before it, so a slow drift of a shared machine cancels inside each
 *                  pair (the default; how v1.280.0's figures were taken)
 *
 *   node tests/artifacts/_map_names_frametime.mjs --ab hides --method blocks [--base URL] [--app DIR] [--rate 4]
 *   node tests/artifacts/_map_names_frametime.mjs --ab marks [--method paired] [--base URL] [--app DIR] [--rate 4]
 */
import { chromium } from "playwright"
import fs from "node:fs"
import path from "node:path"

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf("--" + k); return i >= 0 ? args[i + 1] : d }
const BASE = opt("base", "http://localhost:8196"), APP = opt("app", null), RATE = +opt("rate", 4)
const AB = opt("ab", null), METHOD = opt("method", "paired")
if (AB && !["hides", "marks"].includes(AB)) throw Error("--ab hides|marks")
if (!["paired", "blocks"].includes(METHOD)) throw Error("--method paired|blocks")
const APP_FILES = APP ? new Set(fs.readdirSync(APP)) : null
/** In the page: A against B (see the header). Every override is on the instance and is deleted at the end. */
function abFrames({ ab, method }) {
  const a = window.__neural, c0 = { cx: a.cam.cx, cy: a.cam.cy, vw: a.cam.vw }
  const stat = (xs) => { const s = [...xs].sort((p, q) => p - q); return { median: +s[s.length >> 1].toFixed(3), p95: +s[Math.floor(s.length * 0.95)].toFixed(3), n: s.length } }
  const scale = () => a.W / a.cam.vw, dealt = [...new Set(a.optionIdxs)], marked = new Set(dealt)
  const mode = (b) => {
    if (ab === "hides") { if (b) a._hides = () => true; else delete a._hides; return }
    a._movesGold = b ? () => new Map(dealt.map((i) => [i, 1])) : () => new Map()
    a._movesLearned = b ? () => new Set(dealt) : () => new Set()
    a._answered = b ? (n) => marked.has(n.idx) : () => false
  }
  const fresh = () => { if (ab === "hides") a._hidC = null }
  const frame = (kind, k, dir) => { if (kind === "drag") a.cam.cx += 3 / scale() * dir; a.now += 1 / 60; const t = performance.now(); a.draw(); return performance.now() - t }
  const res = { ab, method, dealt: dealt.length }
  try {
    for (const kind of ["held", "drag"]) {
      Object.assign(a.cam, c0, { lvw: Math.log(c0.vw) }); fresh()
      const A = [], B = [], D = []
      if (method === "blocks") {
        for (let rep = 0; rep < 6; rep++) for (const b of [false, true]) {
          mode(b); fresh()
          if (kind === "held") Object.assign(a.cam, c0, { lvw: Math.log(c0.vw) })
          for (let k = 0; k < 10; k++) frame("held", k, 0)   // warm, the plan made
          for (let k = 0; k < 60; k++) (b ? B : A).push(frame(kind, k, rep % 2 ? -1 : 1))
        }
      } else {
        for (let k = 0; k < 30; k++) { mode(k % 2 === 1); frame("held", k, 0) }   // warm both
        let last = 0
        for (let k = 0; k < 2400; k++) {
          const b = k % 2 === 1; mode(b)
          const dt = frame(kind, k, Math.floor(k / 400) % 2 ? -1 : 1)
          if (b) { B.push(dt); D.push(dt - last) } else { A.push(dt); last = dt }
        }
      }
      res[kind] = { A: stat(A), B: stat(B), ...(D.length ? { diff: stat(D) } : {}) }
    }
    if (ab === "hides") {
      // the reads of one drawn frame, untimed: box reads and style reads, held and dragging, each mode
      const cnt = { b: 0, s: 0 }, gb = Element.prototype.getBoundingClientRect, gs = window.getComputedStyle
      Element.prototype.getBoundingClientRect = function () { cnt.b++; return gb.call(this) }
      window.getComputedStyle = function (...x) { cnt.s++; return gs.apply(this, x) }
      res.reads = {}
      try {
        for (const kind of ["held", "drag"]) for (const b of [false, true]) {
          mode(b); a._hidC = null; Object.assign(a.cam, c0, { lvw: Math.log(c0.vw) }); if (kind === "drag") a.cam.cx += 400 / scale()
          for (let k = 0; k < 5; k++) frame("held", k, 0)
          let nb = 0, ns = 0
          for (let k = 0; k < 20; k++) { cnt.b = cnt.s = 0; frame(kind, k, 1); nb += cnt.b; ns += cnt.s }
          res.reads[kind + (b ? " B" : " A")] = { box: nb / 20, style: ns / 20 }
        }
      } finally { Element.prototype.getBoundingClientRect = gb; window.getComputedStyle = gs }
    }
  } finally {
    for (const k of ["_hides", "_movesGold", "_movesLearned", "_answered"]) if (Object.prototype.hasOwnProperty.call(a, k)) delete a[k]
    Object.assign(a.cam, c0, { lvw: Math.log(c0.vw) }); a.draw()
  }
  return res
}

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
  const r = AB ? await page.evaluate(abFrames, { ab: AB, method: METHOD }) : await page.evaluate(() => {
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
