#!/usr/bin/env node
/**
 * Variant shoot — drives a REAL served build with real wall-clock time, no harness, no fixtures.
 * Every navigation is a URL a person can type; the More press is a real mouse click at a measured
 * coordinate (never locator.click(), which scrolls and hides the very clipping this is for).
 *
 *   node shoot.mjs <baseURL> <outDir> <tag>
 */
import { chromium } from "playwright"
import fs from "node:fs"
import path from "node:path"

const BASE = process.argv[2]
const OUT = process.argv[3]
const TAG = process.argv[4] || "x"
const NODE_PATH_ = process.env.SHOOT_NODE || "/Submissions/Kneebar/from-Top/Attacker"
fs.mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const VIEWPORTS = [
  { tag: "1440x900", width: 1440, height: 900 },
  { tag: "390x844", width: 390, height: 844, isMobile: true, hasTouch: true },
]

async function settle(page, ms = 9000) {
  await sleep(ms)
  for (let i = 0; i < 6; i++) { await page.evaluate(() => document.body.getBoundingClientRect().top); await sleep(250) }
}

async function shot(page, name, vp) {
  const file = path.join(OUT, `${TAG}-${name}--${vp.tag}.png`)
  await page.screenshot({ path: file })
  console.log(`  shot ${path.basename(file)} (${(fs.statSync(file).size / 1024).toFixed(0)} KB)`)
}

/** A real mouse click at the element's measured centre; refuses an off-screen centre. */
async function mouseClick(page, sel) {
  const hit = await page.evaluate((s) => {
    const el = document.querySelector(s); if (!el) return { ok: false, why: "no element" }
    const r = el.getBoundingClientRect()
    const x = r.left + r.width / 2, y = r.top + r.height / 2
    if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return { ok: false, why: `centre ${Math.round(x)},${Math.round(y)} off screen` }
    const top = document.elementFromPoint(x, y)
    return { ok: !!top && (top === el || el.contains(top)), x, y, why: top ? top.tagName + "." + top.className : "nothing" }
  }, sel)
  if (!hit.ok) throw new Error(`${sel} not clickable: ${hit.why}`)
  await page.mouse.click(hit.x, hit.y)
  return hit
}

const facts = (page) => page.evaluate(() => {
  const a = window.__neural
  const pin = document.querySelector("[data-read-pin]")
  const nav = document.querySelector("[data-read-nav]")
  const body = document.querySelector("[data-land-more-body]")
  return {
    boot: !!a,
    open: a ? !!a._landOpen : null,
    readS: a ? a._readS || 0 : null,
    readMax: a ? a._readMax || 0 : null,
    pinTop: a ? a._readPinTop : null, pinInset: a ? a._readPinInset : null, pinCap: a ? a._readPinCap : null,
    entries: nav ? nav.querySelectorAll("[data-read-to]").length : 0,
    pinned: pin ? pin.classList.contains("pinned") : null,
    pinRect: pin ? (({ top, bottom, left, width }) => ({ top: Math.round(top), bottom: Math.round(bottom), left: Math.round(left), width: Math.round(width) }))(pin.getBoundingClientRect()) : null,
    navRect: nav ? (({ top, bottom }) => ({ top: Math.round(top), bottom: Math.round(bottom) }))(nav.getBoundingClientRect()) : null,
    bodyTop: body ? Math.round(body.getBoundingClientRect().top) : null,
    hasPinEl: !!pin,
  }
})

const browser = await chromium.launch()
for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  page.on("pageerror", (e) => console.log("  PAGEERROR", e.message))
  await page.goto(BASE + NODE_PATH_, { waitUntil: "domcontentloaded" })
  await settle(page)
  console.log(vp.tag, "arrived:", JSON.stringify(await facts(page)))
  await shot(page, "1-landed", vp)
  await mouseClick(page, "[data-land-more]")
  await sleep(1200)
  console.log(vp.tag, "opened :", JSON.stringify(await facts(page)))
  await shot(page, "2-more-open", vp)
  // read down with the wheel, over the document, exactly as a reader does
  const at = await page.evaluate(() => {
    const r = document.querySelector("[data-land-more-body]").getBoundingClientRect()
    return { x: Math.round(r.left + r.width / 2), y: Math.round(Math.min(r.top + 40, innerHeight - 60)) }
  })
  await page.mouse.move(at.x, at.y)
  for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, 240); await sleep(60) }
  await sleep(700)
  console.log(vp.tag, "read 8 :", JSON.stringify(await facts(page)))
  await shot(page, "3-read-part", vp)
  for (let i = 0; i < 14; i++) { await page.mouse.wheel(0, 240); await sleep(60) }
  await sleep(700)
  console.log(vp.tag, "read 22:", JSON.stringify(await facts(page)))
  await shot(page, "4-read-deep", vp)
  await ctx.close()
}
await browser.close()
console.log("done")
