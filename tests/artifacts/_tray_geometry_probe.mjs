// THE TRAY, MEASURED IN A REAL BROWSER, AT THE TWO VIEWPORTS THAT MATTER.
//
// Deals the WORST hand (standing-position/top, 34 cards uncapped) and asks the three questions
// the owner will ask: how wide does the tray get, can a thumb reach the hand, and is the
// "see more" hint on screen where it must not be.
//
// The hint question was settled here FIRST, and the answer was "the breakpoint misses": the
// element DOES carry .ng-seemore and the old @media (max-width:640px) rule DOES fire, so a
// PORTRAIT phone was never the case the owner saw. A LANDSCAPE phone is 844x390 — 844px WIDE —
// and sailed past a width-only rule. The rule is now `(max-width:767px), (max-height:500px)`.
//
//   flock /tmp/bjj-pw.lock node tests/artifacts/_tray_geometry_probe.mjs
import { chromium } from "@playwright/test"

const BASE = process.env.BASE || "http://localhost:8080"
const browser = await chromium.launch()

const dealWorst = async (page) => {
  await page.evaluate(() => {
    const app = window.__neural
    let idx = -1
    for (let i = 0; i < app.nodes.length; i++) { const n = app.nodes[i]; if (n.ty === "positions" && n.posId === "standing-position") { idx = i; break } }
    app.currentPos = idx; app.playerRole = "top"
    app.enterLand(false)
  })
  await page.waitForSelector("[data-tech]", { timeout: 20000 })
  await page.waitForTimeout(400)
}

const geom = (page) => page.evaluate(() => {
  const app = window.__neural
  const row = app.optionsRef.current
  const hint = app.optionHintRef.current
  const cards = [...row.querySelectorAll("[data-tech]")]
  const r = row.getBoundingClientRect()
  const cs = hint ? getComputedStyle(hint) : null
  const hr = hint ? hint.getBoundingClientRect() : null
  // what is actually AT the hint's centre — the owner's "overlaps user icon and text"
  let atHint = null
  if (hr && hr.width) {
    const e = document.elementFromPoint(hr.left + hr.width / 2, hr.top + hr.height / 2)
    atHint = e ? (e.tagName + (e.className && typeof e.className === "string" ? "." + e.className.split(" ")[0] : "")) : null
  }
  const vis = cards.filter((c) => { const b = c.getBoundingClientRect(); return b.left >= r.left - 1 && b.right <= r.right + 1 })
  return {
    vw: innerWidth, vh: innerHeight,
    cards: cards.length,
    scrollW: row.scrollWidth, clientW: row.clientWidth,
    overflow: row.scrollWidth - row.clientWidth,
    rowTop: Math.round(r.top), rowBottom: Math.round(r.bottom), rowH: Math.round(r.height),
    visibleCards: vis.length,
    firstCardW: cards[0] ? Math.round(cards[0].getBoundingClientRect().width) : 0,
    hint: hint ? { display: cs.display, opacity: cs.opacity, top: Math.round(hr.top), bottom: Math.round(hr.bottom), left: Math.round(hr.left), right: Math.round(hr.right), w: Math.round(hr.width), h: Math.round(hr.height), atCentre: atHint } : null,
    // the bottom band tenants the owner named
    chip: (() => { const e = document.querySelector(".ng-acctwrap"); if (!e) return null; const b = e.getBoundingClientRect(); return { top: Math.round(b.top), left: Math.round(b.left), right: Math.round(b.right), bottom: Math.round(b.bottom) } })(),
  }
})

for (const [label, vw, vh] of [["desktop", 1440, 900], ["phone", 390, 844]]) {
  const page = await browser.newPage({ viewport: { width: vw, height: vh }, hasTouch: vw < 700 })
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" })
  await page.waitForFunction(() => window.__neural && window.__neural.nodes && window.__neural._ev, null, { timeout: 60000 })

  {
    await dealWorst(page)
    const g = await geom(page)
    console.log(`\n=== ${label} ${g.vw}x${g.vh} · standing-position/top ===`)
    console.log(`  cards dealt ${g.cards}   visible without scrolling ${g.visibleCards}   card width ~${g.firstCardW}px`)
    console.log(`  tray scrollWidth ${g.scrollW} vs clientWidth ${g.clientW}  ->  overflow ${g.overflow}px`)
    console.log(`  tray band  top ${g.rowTop}  bottom ${g.rowBottom}  height ${g.rowH}`)
    if (g.hint) console.log(`  HINT  display:${g.hint.display} opacity:${g.hint.opacity}  box [${g.hint.left},${g.hint.top} .. ${g.hint.right},${g.hint.bottom}] ${g.hint.w}x${g.hint.h}  elementFromPoint:${g.hint.atCentre}`)
    if (g.chip) console.log(`  account chip box [${g.chip.left},${g.chip.top} .. ${g.chip.right},${g.chip.bottom}]`)
  }
  await page.close()
}

// THE BREAKPOINT LADDER — where does .ng-seemore actually stop being hidden?
const p = await browser.newPage()
await p.goto(BASE + "/", { waitUntil: "domcontentloaded" })
await p.waitForFunction(() => window.__neural && window.__neural.nodes, null, { timeout: 60000 })
console.log("\n=== .ng-seemore computed display, by viewport width ===")
for (const w of [360, 390, 414, 430, 540, 600, 640, 641, 700, 768, 820, 900, 1024, 1280]) {
  await p.setViewportSize({ width: w, height: 800 })
  const d = await p.evaluate(() => {
    const h = window.__neural.optionHintRef.current
    return h ? { cls: h.className, display: getComputedStyle(h).display } : null
  })
  console.log(`  ${String(w).padStart(5)}px  class="${d.cls}"  display:${d.display}`)
}
await p.close()
await browser.close()
