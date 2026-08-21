// THE PHONE TRAY: 2 OF 34 CARDS, AND A SWIPE RESTARTS THE ROLL.
//
// This began as "is a 34-card hand reachable one-handed?" and ended as the reproduction of a
// SEPARATE, PRE-EXISTING defect. Read the numbers it prints in that light:
//
//   · "cards 34 / visible 2"  is REAL and is the reason the question matters (it was 2 of 10
//     before the cap was lifted, so the ratio is worse but the shape is not new).
//   · "one thumb swipe moves the tray: 0px" is NOT evidence that the tray cannot scroll. The
//     reading is taken 450ms after touchend, and ~1s after a swipe the roll RESTARTS — which
//     clears the tray and resets scrollLeft to 0. Instrumented mid-gesture the tray does move.
//     Any conclusion about touch scrolling drawn from this probe is confounded until the restart
//     is fixed. See CLAUDE.md, "MOBILE REACH IS AN OPEN QUESTION".
//   · "hand still intact: 0 cards" IS the defect: one `stakes` beat, no click, no bg_dismissed,
//     paused true throughout, landing on a fresh random position — the signature of
//     `enterLand`'s `if (!opts.length) after(1.0, () => startRoll())`.
//
// Uses CDP `Input.dispatchTouchEvent`, NOT synthesised TouchEvents (they do not drive scrolling)
// and NOT page.touchscreen.tap (a tap in the tray lands on an option card and commits a move).
//
//   flock /tmp/bjj-pw.lock node tests/artifacts/_onehand_reach_probe.mjs
import { chromium } from "@playwright/test"

const BASE = process.env.BASE || "http://localhost:8080"
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
const page = await ctx.newPage()
const cdp = await ctx.newCDPSession(page)
await page.goto(BASE + "/", { waitUntil: "domcontentloaded" })
await page.waitForFunction(() => window.__neural && window.__neural.nodes && window.__neural._ev, null, { timeout: 60000 })

await page.evaluate(() => {
  const a = window.__neural
  let idx = -1
  for (let i = 0; i < a.nodes.length; i++) { const n = a.nodes[i]; if (n.ty === "positions" && n.posId === "standing-position") { idx = i; break } }
  a.rollFromPosition(idx, true, "top")
})
await page.waitForSelector("[data-tech]", { timeout: 20000 })
await page.waitForTimeout(1500)

const geo = await page.evaluate(() => {
  const row = window.__neural.optionsRef.current
  const r = row.getBoundingClientRect()
  return { cards: row.querySelectorAll("[data-tech]").length, max: row.scrollWidth - row.clientWidth, y: Math.round(r.top + r.height / 2), top: Math.round(r.top), bottom: Math.round(r.bottom) }
})
console.log(`390x844 · standing-position/top`)
console.log(`  cards ${geo.cards} · scrollable extent ${geo.max}px · tray band y ${geo.top}..${geo.bottom} (mid ${geo.y})`)
console.log(`  a 844-tall phone's comfortable thumb band is roughly y 500-790 — the tray sits inside it`)

const touch = (type, x, y) =>
  cdp.send("Input.dispatchTouchEvent", {
    type,
    touchPoints: type === "touchEnd" ? [] : [{ x, y, radiusX: 12, radiusY: 12, force: 1 }],
  })

// ONE thumb swipe, right-to-left, entirely inside the tray band.
const swipe = async () => {
  await touch("touchStart", 340, geo.y)
  for (let x = 340; x >= 50; x -= 24) { await touch("touchMove", x, geo.y); await page.waitForTimeout(10) }
  await touch("touchEnd", 50, geo.y)
  await page.waitForTimeout(450)   // let any fling settle
  return page.evaluate(() => window.__neural.optionsRef.current.scrollLeft)
}

const first = await swipe()
console.log("")
console.log(`  one thumb swipe moves the tray: ${first}px`)

let swipes = 1, prev = first
while (swipes < 40) {
  const at = await swipe(); swipes++
  if (at >= geo.max - 4) { prev = at; break }
  if (at <= prev) { prev = at; break }   // stopped moving
  prev = at
}

const end = await page.evaluate(() => {
  const row = window.__neural.optionsRef.current
  const cards = [...row.querySelectorAll("[data-tech]")]
  const r = row.getBoundingClientRect()
  const vis = cards.filter((c) => { const b = c.getBoundingClientRect(); return b.left >= r.left - 1 && b.right <= r.right + 1 })
  return {
    at: row.scrollLeft, max: row.scrollWidth - row.clientWidth,
    cards: cards.length,
    lastVisible: vis.length ? vis[vis.length - 1].getAttribute("data-tech") : null,
    isLast: cards.length ? cards[cards.length - 1].getAttribute("data-tech") : null,
  }
})
console.log(`  thumb swipes to the far end: ${swipes}   (${end.at}/${end.max}px)`)
console.log(`  hand still intact: ${end.cards} cards (a swipe must never commit a move)`)
console.log(`  last card in the tray:   ${end.isLast}`)
console.log(`  last card now on screen: ${end.lastVisible}`)
// NB `lastVisible === isLast` is null===null once the restart has emptied the tray, which would
// read as success. Name that case for what it is instead.
console.log(`  >>> ${end.cards === 0
  ? "INCONCLUSIVE — the roll restarted and took the tray with it (see the header)"
  : end.lastVisible === end.isLast ? "the last card IS reachable one-handed" : "NOT REACHED"}`)
const pageScrolled = await page.evaluate(() => (window.scrollX || 0) + (window.scrollY || 0))
console.log(`  page scroll offset after ${swipes} swipes: ${pageScrolled} (must be 0 — the tray never takes the page with it)`)

await browser.close()
