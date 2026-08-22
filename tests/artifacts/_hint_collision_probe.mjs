// WHERE THE "SEE MORE" HINT ACTUALLY COLLIDES.
//
// The owner reports it overlapping the user icon "in mobile". Measured, the element DOES carry
// .ng-seemore and the @media (max-width:640px) rule DOES fire — at 390px it is display:none. So
// the report cannot be a portrait phone. This walks the widths where the hint IS shown and
// measures its box against the account chip's, including LANDSCAPE PHONE (844x390), which is
// 844px WIDE and therefore sails past the 640px breakpoint.
//
//   flock /tmp/bjj-pw.lock node tests/artifacts/_hint_collision_probe.mjs
import { chromium } from "@playwright/test"

const BASE = process.env.BASE || "http://localhost:8080"
const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto(BASE + "/", { waitUntil: "domcontentloaded" })
await page.waitForFunction(() => window.__neural && window.__neural.nodes && window.__neural._ev, null, { timeout: 60000 })

const VIEWPORTS = [
  ["phone portrait", 390, 844],
  ["phone landscape", 844, 390],
  ["phone landscape XL", 932, 430],
  ["tablet portrait", 768, 1024],
  ["tablet landscape", 1024, 768],
  ["small laptop", 1280, 800],
  ["desktop", 1440, 900],
]

console.log("viewport                    hint display   hint box                chip box                verdict")
for (const [label, w, h] of VIEWPORTS) {
  await page.setViewportSize({ width: w, height: h })
  await page.evaluate(() => {
    const app = window.__neural
    let idx = -1
    for (let i = 0; i < app.nodes.length; i++) { const n = app.nodes[i]; if (n.ty === "positions" && n.posId === "standing-position") { idx = i; break } }
    app.currentPos = idx; app.playerRole = "top"
    app.enterLand(false)
  })
  await page.waitForSelector("[data-tech]", { timeout: 20000 })
  await page.waitForTimeout(350)
  const m = await page.evaluate(() => {
    const app = window.__neural
    const hint = app.optionHintRef.current
    const chip = document.querySelector(".ng-acctwrap")
    const cue = document.querySelector(".ng-sharecue")
    const box = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { l: Math.round(b.left), t: Math.round(b.top), r: Math.round(b.right), b: Math.round(b.bottom) } }
    const hb = box(hint), cb = box(chip)
    const disp = hint ? getComputedStyle(hint).display : "?"
    let hits = false, at = null
    if (hb && cb && disp !== "none") {
      hits = !(hb.r <= cb.l || hb.l >= cb.r || hb.b <= cb.t || hb.t >= cb.b)
      const e = document.elementFromPoint((hb.l + hb.r) / 2, (hb.t + hb.b) / 2)
      at = e ? e.tagName + (typeof e.className === "string" && e.className ? "." + e.className.split(" ")[0] : "") : null
    }
    // vertical clearance between the hint's bottom and the chip's top
    const gap = hb && cb && disp !== "none" ? cb.t - hb.b : null
    return { disp, hb, cb, hits, at, gap, cue: box(cue), vh: innerHeight }
  })
  const fmt = (b) => (b ? `[${b.l},${b.t}..${b.r},${b.b}]`.padEnd(22) : "—".padEnd(22))
  let verdict = "hidden"
  if (m.disp !== "none") {
    verdict = m.hits ? `OVERLAPS chip` : `gap ${m.gap}px to chip`
    if (!m.hits && m.gap != null && m.gap <= 8) verdict += "  <-- TOUCHING"
  }
  console.log(`${label.padEnd(20)} ${String(w) + "x" + h}`.padEnd(28) + ` ${m.disp.padEnd(13)} ${fmt(m.hb)} ${fmt(m.cb)} ${verdict}`)
}

await browser.close()
