// SHOW EVERY OPTION — the measurement that decides the design.
//
// (1) HAND SIZE, capped vs uncapped, over every live role-hand. `optionsFor` ends in `_capHand`;
//     monkeypatching that to identity gives the pool the cap is hiding, WITHOUT touching any
//     other filter (role, origin, dedupe) — so the two columns differ by the cap and nothing else.
// (2) THE DECISION CLOCK that hand size drives: dsec = decisionSec + (n-1)*0.8.
// (3) THE DECK PREFETCH BILL: enterLand hydrates one deck per dealt card. Uncapping multiplies
//     that fan-out, and the browser-measured first-hand gzip budget has 6,510 bytes of headroom.
//     Counted as DISTINCT deck keys, because hydrateDecks dedupes and a shared key is one fetch.
//
//   flock /tmp/bjj-pw.lock node tests/artifacts/_hand_uncapped_probe.mjs
import { chromium } from "@playwright/test"

const BASE = process.env.BASE || "http://localhost:8080"
const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto(BASE + "/", { waitUntil: "domcontentloaded" })
await page.waitForFunction(() => window.__neural && window.__neural.nodes && window.__neural._ev, null, { timeout: 60000 })

const out = await page.evaluate(() => {
  const app = window.__neural
  const realCap = app._capHand
  const hands = []
  for (let i = 0; i < app.nodes.length; i++) {
    const n = app.nodes[i]
    if (n.ty !== "positions") continue
    for (const role of ["top", "bottom"]) {
      const sp = app.currentPos, sr = app.playerRole
      app.currentPos = i; app.playerRole = role
      let capped = [], uncapped = []
      try {
        capped = app.optionsFor(i) || []
        app._capHand = (s) => s
        uncapped = app.optionsFor(i) || []
      } catch (e) { /* leave empty */ } finally { app._capHand = realCap }
      app.currentPos = sp; app.playerRole = sr
      if (!uncapped.length) continue
      // distinct deck keys — hydrateDecks dedupes, so a shared key is ONE fetch not two
      const keys = (list) => {
        const s = new Set()
        for (const o of list) { const k = o.node ? app.deckKeyFor(o.node).key : null; if (k) s.add(k) }
        // enterLand also hydrates the CURRENT position's own deck
        const own = app.deckKeyFor(app.nodes[i]).key; if (own) s.add(own)
        return s.size
      }
      hands.push({
        state: (n.posId || n.t) + "/" + role,
        cap: capped.length, unc: uncapped.length,
        capKeys: keys(capped), uncKeys: keys(uncapped),
        cats: uncapped.reduce((a, o) => { a[o.node.ty] = (a[o.node.ty] || 0) + 1; return a }, {}),
      })
    }
  }
  return { hands, decisionSec: app.get("decisionSec", 9) }
})

const { hands, decisionSec } = out
const num = (a) => a.slice().sort((x, y) => x - y)
const pct = (a, p) => { const s = num(a); return s[Math.min(s.length - 1, Math.floor(p * s.length))] }
const sum = (a) => a.reduce((x, y) => x + y, 0)

const cap = hands.map((h) => h.cap), unc = hands.map((h) => h.unc)
const dsec = (n) => decisionSec + (n - 1) * 0.8

console.log(`role-hands measured: ${hands.length}   decisionSec base: ${decisionSec}s`)
console.log("")
console.log("HAND SIZE                capped    uncapped")
for (const [lab, f] of [["min", (a) => num(a)[0]], ["median", (a) => pct(a, 0.5)], ["p95", (a) => pct(a, 0.95)], ["max", (a) => num(a)[a.length - 1]], ["mean", (a) => (sum(a) / a.length).toFixed(1)]])
  console.log(`  ${lab.padEnd(22)} ${String(f(cap)).padStart(6)} ${String(f(unc)).padStart(11)}`)
console.log(`  ${"total cards dealt".padEnd(22)} ${String(sum(cap)).padStart(6)} ${String(sum(unc)).padStart(11)}`)
console.log(`  ${"hands over 10".padEnd(22)} ${String(cap.filter((v) => v > 10).length).padStart(6)} ${String(unc.filter((v) => v > 10).length).padStart(11)}`)
console.log(`  ${"hands over 20".padEnd(22)} ${String(cap.filter((v) => v > 20).length).padStart(6)} ${String(unc.filter((v) => v > 20).length).padStart(11)}`)

console.log("")
console.log("DECISION CLOCK  dsec = decisionSec + (n-1)*0.8")
console.log(`  worst capped   ${dsec(Math.max(...cap)).toFixed(1)}s  (n=${Math.max(...cap)})`)
console.log(`  worst uncapped ${dsec(Math.max(...unc)).toFixed(1)}s  (n=${Math.max(...unc)})`)
console.log(`  median capped  ${dsec(pct(cap, 0.5)).toFixed(1)}s     median uncapped ${dsec(pct(unc, 0.5)).toFixed(1)}s`)

console.log("")
console.log("BIGGEST HANDS (uncapped)")
for (const h of hands.slice().sort((a, b) => b.unc - a.unc).slice(0, 12))
  console.log(`  ${h.state.padEnd(38)} ${String(h.cap).padStart(2)} -> ${String(h.unc).padStart(2)}   dsec ${dsec(h.cap).toFixed(1)} -> ${dsec(h.unc).toFixed(1)}s   ${JSON.stringify(h.cats)}`)

console.log("")
console.log("DECK PREFETCH (distinct keys hydrated by enterLand, incl. the position's own)")
const ck = hands.map((h) => h.capKeys), uk = hands.map((h) => h.uncKeys)
console.log(`  max     ${Math.max(...ck)} -> ${Math.max(...uk)}`)
console.log(`  median  ${pct(ck, 0.5)} -> ${pct(uk, 0.5)}`)
console.log(`  mean    ${(sum(ck) / ck.length).toFixed(1)} -> ${(sum(uk) / uk.length).toFixed(1)}`)
const worstK = hands.slice().sort((a, b) => b.uncKeys - a.uncKeys)[0]
console.log(`  worst   ${worstK.state}: ${worstK.capKeys} -> ${worstK.uncKeys} distinct decks`)

await browser.close()
