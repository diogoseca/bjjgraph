// WHAT A REAL FIRST VISITOR PAYS — because the GATE CANNOT SEE IT.
//
// payload-first-hand.spec.ts pins `start-pos:[0]` -> Gogoplata Control Top, a 7-card hand that is
// UNDER the cap. So the gate is byte-identical whether the cap exists or not: it is structurally
// blind to this change, exactly as replay-digest was blind to cardOrder.
//
// A real first-time visitor is NOT drawn uniformly. `_weightedStart` samples
// `startPosTraffic()^1.5` mixed with a 2% uniform floor, and CLAUDE.md records the effect: the six
// hubs a beginner can NAME take ~66% of first impressions. Those hubs are precisely the biggest
// hands. This reproduces the app's OWN draw probabilities (its table is keyed by node INDEX) and
// reports the expected deck-prefetch bill, capped vs uncapped, in real gzip bytes.
//
//   flock /tmp/bjj-pw.lock node tests/artifacts/_prefetch_traffic_probe.mjs
import { chromium } from "@playwright/test"
import { gzipSync } from "node:zlib"
import { readFileSync } from "node:fs"

const BASE = process.env.BASE || "http://localhost:8080"
const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto(BASE + "/", { waitUntil: "domcontentloaded" })
await page.waitForFunction(() => window.__neural && window.__neural.nodes && window.__neural._ev && window.__neural.curriculum, null, { timeout: 60000 })

const data = await page.evaluate(() => {
  const app = window.__neural
  const realCap = app._capHand
  const tw = app.startPosTraffic()
  const B = app.START_BIAS
  // the pool startRoll draws from, rebuilt the same way: every position node
  const pool = []
  for (let i = 0; i < app.nodes.length; i++) if (app.nodes[i].ty === "positions") pool.push(i)
  // exact _weightedStart probabilities
  const p = pool.map((i) => Math.pow(Math.max(0, tw[i] || 0), B.gamma))
  const total = p.reduce((a, b) => a + b, 0)
  const flat = B.floor / pool.length
  const prob = p.map((v) => (total > 0 ? (1 - B.floor) * (v / total) + flat : 1 / pool.length))

  const rows = []
  for (let pi = 0; pi < pool.length; pi++) {
    const i = pool[pi], n = app.nodes[i]
    for (const role of ["top", "bottom"]) {
      const sp = app.currentPos, sr = app.playerRole
      app.currentPos = i; app.playerRole = role
      let capped = [], uncapped = []
      try {
        capped = app.optionsFor(i) || []
        app._capHand = (s) => s
        uncapped = app.optionsFor(i) || []
      } catch (e) { /* empty */ } finally { app._capHand = realCap }
      app.currentPos = sp; app.playerRole = sr
      if (!uncapped.length) continue
      const hx = (list) => {
        const s = new Set()
        const own = app.deckKeyFor(n).key; if (own) s.add(own)
        for (const o of list) { const k = o.node ? app.deckKeyFor(o.node).key : null; if (k) s.add(k) }
        return [...s].map((k) => app.qhash(k).toString(16).padStart(8, "0"))
      }
      rows.push({ state: (n.posId || n.t) + "/" + role, w: prob[pi] / 2, cap: capped.length, unc: uncapped.length, capH: hx(capped), uncH: hx(uncapped) })
    }
  }
  return { rows, sixHub: null }
})

const cache = new Map()
const gz = (h) => {
  if (cache.has(h)) return cache.get(h)
  let v = 0
  try { v = gzipSync(readFileSync(`source/public/static/neural/flashcards/${h}.json`), { level: 9 }).length } catch { v = 0 }
  cache.set(h, v); return v
}
const bytes = (hs) => { let t = 0; for (const h of new Set(hs)) t += gz(h); return t }
const rows = data.rows.map((r) => ({ ...r, capB: bytes(r.capH), uncB: bytes(r.uncH) }))

const wsum = rows.reduce((s, r) => s + r.w, 0)
let expCap = 0, expUnc = 0
for (const r of rows) { expCap += r.w * r.capB; expUnc += r.w * r.uncB }
console.log(`role-hands ${rows.length} · draw probability mass covered ${(wsum * 100).toFixed(1)}%`)
console.log("")
console.log("EXPECTED FIRST-HAND DECK PREFETCH (gzip, weighted by the app's REAL first-roll draw)")
console.log(`  capped   ${Math.round(expCap / wsum).toLocaleString()} B`)
console.log(`  uncapped ${Math.round(expUnc / wsum).toLocaleString()} B`)
console.log(`  DELTA    +${Math.round((expUnc - expCap) / wsum).toLocaleString()} B gzip on the AVERAGE first visit   (headroom: 7,050 B)`)

console.log("")
console.log("THE LIKELIEST FIRST IMPRESSIONS (top 16 by real draw probability)")
console.log("  state                                 draw%   cards          gzip prefetch")
for (const r of rows.slice().sort((a, b) => b.w - a.w).slice(0, 16))
  console.log(`  ${r.state.padEnd(35)} ${(r.w * 100 / wsum).toFixed(2).padStart(6)}  ${String(r.cap).padStart(2)}->${String(r.unc).padStart(2)}   ${String(r.capB.toLocaleString()).padStart(7)} -> ${String(r.uncB.toLocaleString()).padStart(7)}  (+${(r.uncB - r.capB).toLocaleString()})`)

console.log("")
const over = rows.filter((r) => r.uncB - r.capB > 7050)
let risk = 0; for (const r of over) risk += r.w
console.log(`role-hands whose uncapped prefetch ALONE exceeds the 7,050 B headroom: ${over.length} of ${rows.length}`)
console.log(`PROBABILITY a real first visit lands on one of them: ${(risk * 100 / wsum).toFixed(1)}%`)
for (const r of over.sort((a, b) => (b.uncB - b.capB) - (a.uncB - a.capB)))
  console.log(`  ${r.state.padEnd(35)} draw ${(r.w * 100 / wsum).toFixed(2).padStart(5)}%  +${(r.uncB - r.capB).toLocaleString()} B gzip  (${r.cap}->${r.unc} cards)`)

await browser.close()
