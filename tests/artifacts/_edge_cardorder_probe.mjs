// Probe: with `cardOrder = "popularity"` the hand is ranked by `movePopularity` while every card
// still PRINTS EDGE. Measures how often the printed integers run out of order down the tray.
//   flock /tmp/bjj-pw.lock node tests/artifacts/_edge_cardorder_probe.mjs
import { chromium } from "@playwright/test"

const BASE = process.env.BASE || "http://localhost:8080"

const page = await (await chromium.launch()).newPage()
await page.goto(BASE + "/", { waitUntil: "domcontentloaded" })
await page.waitForFunction(() => window.__neural && window.__neural.nodes && window.__neural._ev, null, { timeout: 60000 })

const out = await page.evaluate(() => {
  const app = window.__neural
  const res = {}
  for (const mode of ["potential", "popularity"]) {
    app.set("cardOrder", mode)
    let hands = 0, notDesc = 0, worst = null
    for (let i = 0; i < app.nodes.length; i++) {
      const n = app.nodes[i]
      if (n.ty !== "positions") continue
      for (const role of ["top", "bottom"]) {
        const savedPos = app.currentPos, savedRole = app.playerRole
        app.currentPos = i; app.playerRole = role
        let hand = [], ints = []
        // marks MUST be read while currentPos/playerRole are still set — moveChance reads oppVal
        // of the CURRENT position, which is exactly the per-state handicap the baseline cancels
        try {
          hand = app.optionsFor(i) || []
          ints = hand.map((o) => { const m = app.edgeMark(o); return m ? m.i : null }).filter((v) => v != null)
        } catch (e) { hand = []; ints = [] }
        app.currentPos = savedPos; app.playerRole = savedRole
        if (hand.length < 2) continue
        hands++
        let bad = 0
        for (let k = 1; k < ints.length; k++) if (ints[k] > ints[k - 1]) bad++
        if (bad) { notDesc++; if (!worst || bad > worst.bad) worst = { state: n.posId + "/" + role, bad, ints } }
      }
    }
    res[mode] = { hands, notDesc, worst }
  }
  app.set("cardOrder", "potential")
  return res
})

for (const [mode, r] of Object.entries(out)) {
  console.log(`cardOrder=${mode}: ${r.hands} hands, ${r.notDesc} with the printed EDGE running OUT of descending order`)
  if (r.worst) console.log(`   worst: ${r.worst.state} — ${r.worst.bad} ascending steps — printed ${JSON.stringify(r.worst.ints)}`)
}
process.exit(0)
