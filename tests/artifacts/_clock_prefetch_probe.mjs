// THE DECISION CLOCK AND THE PREFETCH, READ FROM THE APP ITSELF.
//
// Not a formula retyped here — this drives `enterLand` at every live role-hand and reads the
// `_decisionDsec` the app actually armed, plus the deck keys `hydrateDecks` was actually handed
// (captured by wrapping the method). Both numbers therefore come from the shipped bundle.
//
//   flock /tmp/bjj-pw.lock node tests/artifacts/_clock_prefetch_probe.mjs
import { chromium } from "@playwright/test"

const BASE = process.env.BASE || "http://localhost:8080"
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto(BASE + "/", { waitUntil: "domcontentloaded" })
await page.waitForFunction(() => window.__neural && window.__neural.nodes && window.__neural._ev, null, { timeout: 60000 })

const rows = await page.evaluate(async () => {
  const app = window.__neural
  // capture what the warm-up is handed, without letting it fetch
  const realHydrate = app.hydrateDecks.bind(app)
  let lastKeys = null
  app.hydrateDecks = (keys) => { lastKeys = (keys || []).slice(); return Promise.resolve([]) }
  const out = []
  for (let i = 0; i < app.nodes.length; i++) {
    const n = app.nodes[i]
    if (n.ty !== "positions" || !n.posId) continue
    for (const role of ["top", "bottom"]) {
      app.currentPos = i; app.playerRole = role
      lastKeys = null
      let cards = 0
      try {
        cards = (app.optionsFor(i) || []).length
        if (!cards) continue
        app.enterLand(false)
      } catch (e) { continue }
      await new Promise((r) => setTimeout(r, 0))   // let enterLand's setTimeout(...,0) run
      out.push({ st: n.posId + "/" + role, cards, dsec: app._decisionDsec, keys: lastKeys ? lastKeys.length : 0, uniq: lastKeys ? new Set(lastKeys).size : 0 })
    }
  }
  app.hydrateDecks = realHydrate
  return out
})

const OLD = (n) => 9 + (n - 1) * 0.8
const sorted = rows.slice().sort((a, b) => b.cards - a.cards)
const num = (a) => a.slice().sort((x, y) => x - y)
const pct = (a, p) => { const s = num(a); return s[Math.min(s.length - 1, Math.floor(p * s.length))] }

console.log(`role-hands driven through enterLand: ${rows.length}`)
console.log("")
console.log("DECISION CLOCK — app's own _decisionDsec vs the old linear formula")
console.log("  state                                cards    OLD      NEW    delta")
for (const r of sorted.slice(0, 14))
  console.log(`  ${r.st.padEnd(35)} ${String(r.cards).padStart(4)}   ${OLD(r.cards).toFixed(1).padStart(5)}s  ${r.dsec.toFixed(1).padStart(5)}s  ${(r.dsec - OLD(r.cards) >= 0 ? "+" : "") + (r.dsec - OLD(r.cards)).toFixed(1)}s`)

const changed = rows.filter((r) => Math.abs(r.dsec - OLD(r.cards)) > 0.001)
console.log("")
console.log(`worst turn:  OLD ${Math.max(...rows.map((r) => OLD(r.cards))).toFixed(1)}s  ->  NEW ${Math.max(...rows.map((r) => r.dsec)).toFixed(1)}s`)
console.log(`median turn: OLD ${pct(rows.map((r) => OLD(r.cards)), 0.5).toFixed(1)}s  ->  NEW ${pct(rows.map((r) => r.dsec), 0.5).toFixed(1)}s`)
console.log(`hands whose clock CHANGED at all: ${changed.length} of ${rows.length}  (all are >${10} cards: ${changed.every((r) => r.cards > 10)})`)
console.log(`hands at or under the knee, clock identical to the old formula: ${rows.filter((r) => r.cards <= 10).length}`)
// continuity: the two branches must meet
const at10 = rows.filter((r) => r.cards === 10)
if (at10.length) console.log(`continuity at n=10: ${at10[0].dsec.toFixed(3)}s vs old ${OLD(10).toFixed(3)}s`)

console.log("")
console.log("PREFETCH — deck keys handed to hydrateDecks")
console.log(`  max distinct: ${Math.max(...rows.map((r) => r.uniq))}   (was 35 uncapped, 12 under the old cap)`)
const big = sorted.slice(0, 6)
for (const r of big) console.log(`  ${r.st.padEnd(35)} ${String(r.cards).padStart(3)} cards -> ${r.uniq} distinct decks warmed`)
const overCap = rows.filter((r) => r.uniq > 11)
console.log(`  hands warming more than 11 decks (10 options + own): ${overCap.length}`)

await browser.close()
