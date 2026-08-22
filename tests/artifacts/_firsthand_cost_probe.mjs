// WHAT UNCAPPING COSTS THE FIRST-HAND BUDGET.
//
// payload-first-hand.spec.ts freezes its request set when `[data-tech]` attaches. `enterLand`
// schedules `hydrateDecks` in a setTimeout(...,0) BEFORE it appends the cards, so those chunk
// fetches land inside the measured window — the recorded report proves it: 5 flashcards/*.json
// rows are in its top-15 heaviest. So hand size is a PAYLOAD input, not only a UX one.
//
// The rig pins `start-pos:[0]`, `role:[0]`. Empirically that lands on Gogoplata Control Top.
// This measures THAT hand capped vs uncapped, in distinct deck keys and in real gzip bytes,
// against the live headroom.
//
//   flock /tmp/bjj-pw.lock node tests/artifacts/_firsthand_cost_probe.mjs
import { chromium } from "@playwright/test"
import { gzipSync } from "node:zlib"
import { readFileSync } from "node:fs"

const BASE = process.env.BASE || "http://localhost:8080"
const budget = JSON.parse(readFileSync("tests/artifacts/budget_neural.json", "utf8"))
const report = JSON.parse(readFileSync("tests/artifacts/first_hand_payload.json", "utf8"))

const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto(BASE + "/", { waitUntil: "domcontentloaded" })
await page.waitForFunction(() => window.__neural && window.__neural.nodes && window.__neural._ev, null, { timeout: 60000 })

const res = await page.evaluate(() => {
  const app = window.__neural
  const realCap = app._capHand
  const find = (needle) => {
    for (let i = 0; i < app.nodes.length; i++) {
      const n = app.nodes[i]
      if (n.ty === "positions" && (n.t === needle || n.posId === needle)) return i
    }
    return -1
  }
  const measure = (idx, role) => {
    const sp = app.currentPos, sr = app.playerRole
    app.currentPos = idx; app.playerRole = role
    let capped = [], uncapped = []
    try {
      capped = app.optionsFor(idx) || []
      app._capHand = (s) => s
      uncapped = app.optionsFor(idx) || []
    } finally { app._capHand = realCap }
    app.currentPos = sp; app.playerRole = sr
    const keys = (list) => {
      const s = new Set()
      const own = app.deckKeyFor(app.nodes[idx]).key; if (own) s.add(own)
      for (const o of list) { const k = o.node ? app.deckKeyFor(o.node).key : null; if (k) s.add(k) }
      return [...s]
    }
    return { cap: capped.length, unc: uncapped.length, capKeys: keys(capped), uncKeys: keys(uncapped) }
  }
  const i = find("Gogoplata Control Top")
  const m = measure(i, "top")
  // hash -> chunk filename, exactly how the app addresses a chunk
  return { idx: i, ...m, qh: (k) => null, hashes: { cap: m.capKeys.map((k) => app.qhash(k).toString(16).padStart(8, "0")), unc: m.uncKeys.map((k) => app.qhash(k).toString(16).padStart(8, "0")) } }
})

console.log(`pinned start = "Gogoplata Control Top" (node ${res.idx}), role top`)
console.log(`hand:          capped ${res.cap} cards -> uncapped ${res.unc} cards`)
console.log(`distinct decks capped ${res.capKeys.length}      -> uncapped ${res.uncKeys.length}`)

// real bytes for the chunks the two hands would pull
const bytesFor = (hashes) => {
  let raw = 0, gz = 0, missing = 0
  const seen = new Set()
  for (const h of hashes) {
    if (seen.has(h)) continue; seen.add(h)
    try {
      const b = readFileSync(`source/public/static/neural/flashcards/${h}.json`)
      raw += b.length; gz += gzipSync(b, { level: 9 }).length
    } catch { missing++ }
  }
  return { raw, gz, missing, n: seen.size }
}
const A = bytesFor(res.hashes.cap), B = bytesFor(res.hashes.unc)
console.log("")
console.log(`chunk bytes capped:   ${A.n} files  raw ${A.raw.toLocaleString()}  gzip ${A.gz.toLocaleString()}  (missing ${A.missing})`)
console.log(`chunk bytes uncapped: ${B.n} files  raw ${B.raw.toLocaleString()}  gzip ${B.gz.toLocaleString()}  (missing ${B.missing})`)
console.log(`DELTA:                raw +${(B.raw - A.raw).toLocaleString()}   gzip +${(B.gz - A.gz).toLocaleString()}`)

const gzHead = budget.first_hand_gzip_bytes - report.first_hand_gzip_bytes
const rawHead = budget.first_hand_raw_bytes - report.first_hand_raw_bytes
console.log("")
console.log(`headroom now:  gzip ${gzHead.toLocaleString()} B   raw ${rawHead.toLocaleString()} B`)
console.log(`after uncapping: gzip ${(gzHead - (B.gz - A.gz)).toLocaleString()} B   raw ${(rawHead - (B.raw - A.raw)).toLocaleString()} B`)
console.log(gzHead - (B.gz - A.gz) < 0 ? "  >>> GZIP CEILING BREAKS" : "  >>> gzip ceiling holds")

await browser.close()
