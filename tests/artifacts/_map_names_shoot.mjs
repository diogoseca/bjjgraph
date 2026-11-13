#!/usr/bin/env node
/**
 * THE MAP'S NAMES: THE OWNER'S PICTURES (v1.275.0; NOT a gate, NOT a test: the gate is e2e/journeys/map-names.spec.ts).
 *
 * The same seat and the same camera, before (the bundle given with --app, served in place of the build's app files) and
 * after (the build), as PNG frames, to be paired side by side for the owner. The seat is reached the way the
 * journeys reach it (test mode, a rigged start), the camera is the follow camera's settled framing, pulled back by the
 * app's own wheel handler about the position; the arrival heading is given its wall-clock fade, and the badge toast
 * the test rail's tutorial skip raises is removed (it is not part of the map). Phones at 390 px, not doubled.
 *
 *   node tests/artifacts/_map_names_shoot.mjs <outDir> <tag> [--app DIR] [--base URL]
 */
import { chromium } from "playwright"
import fs from "node:fs"
import path from "node:path"

const [OUT, TAG] = process.argv.slice(2), args = process.argv.slice(4), opt = (k, d) => { const i = args.indexOf("--" + k); return i >= 0 ? args[i + 1] : d }
const BASE = opt("base", "http://localhost:8196"), APP = opt("app", null), APP_FILES = APP ? new Set(fs.readdirSync(APP)) : null
fs.mkdirSync(OUT, { recursive: true })
const SHOTS = [
  { name: "closed-guard-usual", w: 390, h: 844, t: "Closed Guard Top", role: "bottom", f: 1 },
  { name: "side-control-usual", w: 390, h: 844, t: "Side Control Top", role: "top", f: 1 },
  { name: "mount-pulled-back", w: 390, h: 844, t: "Mount Top", role: "top", f: 4 },
  { name: "standing-pulled-back", w: 390, h: 844, t: "Standing Position Top", role: "top", f: 9 },
  { name: "closed-guard-usual", w: 1440, h: 900, t: "Closed Guard Top", role: "bottom", f: 1 },
  { name: "standing-pulled-back", w: 1440, h: 900, t: "Standing Position Top", role: "top", f: 4 },
]
const browser = await chromium.launch()
for (const s of SHOTS) {
  const mobile = s.w < 700
  const ctx = await browser.newContext({ viewport: { width: s.w, height: s.h }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 })
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
  await page.evaluate(([t, role]) => { const a = window.__neural; if (a.TUTORIAL) { a.tut = { done: {} }; for (const s of a.TUTORIAL) a.tut.done[s.id] = 1; a._syncWhiteChallengeCompatibility(Date.now()); a.tutHidden = true; a.renderTutorial() } a.rig("ai-skill", [0.5]); a.rig("role", [role === "bottom" ? 0.9 : 0]); a.rig("max-moves", [0.5]); a.rigStart(a.nodes.findIndex((n) => n.ty === "positions" && n.t === t)) }, [s.t, s.role])
  for (let i = 0; i < 16; i++) { await page.evaluate(() => window.__neural.advance(1000)); if (await page.evaluate(() => (window.__neural.optionIdxs || []).length > 0 && window.__neural._arriveGlideUntil == null)) break }
  await page.evaluate(() => window.__neural.advance(3000)); await new Promise((r) => setTimeout(r, 1800))
  await page.evaluate((f) => {
    const a = window.__neural
    document.querySelectorAll("[data-reward]").forEach((e) => e.remove())
    a._handTouched = true; a.advance(200)
    if (f > 1) { const m = a.pairMid(a.nodes[a.focusIdx]), sc = a.W / a.cam.vw, r = a.canvas.getBoundingClientRect(); a.canvas.dispatchEvent(new WheelEvent("wheel", { deltaY: Math.log(f) / 0.0012, clientX: (m.x - a.cam.cx) * sc + a.W / 2 + r.left, clientY: (m.y - a.cam.cy) * sc + a.H / 2 + r.top, bubbles: true, cancelable: true })) }
    // two drawn frames: `advance` draws once per call, and the first frame after the wheel is the jump (names only leave
    // while the zoom moves); the second is the camera at rest, where they are dealt (Q410A: the first pictures showed the jump)
    a.advance(17); a.advance(17); a.advance(520)   // ...and half a second at rest: a name the jump dropped waits that long (v1.275.0 R1)
  }, s.f)
  const file = path.join(OUT, `${s.name}-${TAG}-${s.w}.png`)
  await page.screenshot({ path: file })
  console.log(file)
  await ctx.close()
}
await browser.close()
