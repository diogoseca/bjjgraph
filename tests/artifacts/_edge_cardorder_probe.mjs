// THE `cardOrder` RETIREMENT MEASUREMENT.
//
// BEFORE (v1.121.0): `orderScore` forked on `cardOrder` but `edgeMark` did not, so with
// `Popularity` selected the hand was ranked by `movePopularity` while every card still PRINTED
// EDGE. This walks every live role-hand and reports, per mode:
//   · how often the printed integers run OUT of descending order down the tray (the contradiction)
//   · how much the setting actually changed — dealt SET, dealt ORDER, top card (the owner's
//     "control over almost nothing" claim, measured rather than asserted)
//
// AFTER (v1.122.0): `orderScore` is EDGE, full stop, and the setting is gone. Both modes must
// report 0 out-of-order hands and 0 differences of any kind — the key is dormant, not read.
//
//   flock /tmp/bjj-pw.lock node tests/artifacts/_edge_cardorder_probe.mjs
import { chromium } from "@playwright/test"

const BASE = process.env.BASE || "http://localhost:8080"

const page = await (await chromium.launch()).newPage()
await page.goto(BASE + "/", { waitUntil: "domcontentloaded" })
await page.waitForFunction(() => window.__neural && window.__neural.nodes && window.__neural._ev, null, { timeout: 60000 })

const out = await page.evaluate(() => {
  const app = window.__neural
  const walk = (mode) => {
    app.set("cardOrder", mode)
    const hands = []
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
        let bad = 0
        for (let k = 1; k < ints.length; k++) if (ints[k] > ints[k - 1]) bad++
        hands.push({ state: n.posId + "/" + role, bad, ints, order: hand.map((o) => o.node.t) })
      }
    }
    return hands
  }
  const base = walk("potential")
  const pop = walk("popularity")
  app.set("cardOrder", "potential")

  const summarise = (hs) => {
    let notDesc = 0, worst = null
    for (const h of hs) if (h.bad) { notDesc++; if (!worst || h.bad > worst.bad) worst = h }
    return { hands: hs.length, notDesc, worst }
  }
  let setDiff = 0, orderDiff = 0, topDiff = 0
  for (let i = 0; i < base.length; i++) {
    const a = base[i], b = pop[i]
    if (a.order.join("|") !== b.order.join("|")) orderDiff++
    if (a.order.slice().sort().join("|") !== b.order.slice().sort().join("|")) setDiff++
    if (a.order[0] !== b.order[0]) topDiff++
  }
  return { potential: summarise(base), popularity: summarise(pop), setDiff, orderDiff, topDiff }
})

for (const mode of ["potential", "popularity"]) {
  const r = out[mode]
  console.log(`cardOrder=${mode}: ${r.hands} hands, ${r.notDesc} with the printed EDGE running OUT of descending order`)
  if (r.worst) console.log(`   worst: ${r.worst.state} — ${r.worst.bad} ascending steps — printed ${JSON.stringify(r.worst.ints)}`)
}
console.log(`what the setting actually changed: dealt SET differs in ${out.setDiff} hands · dealt ORDER in ${out.orderDiff} · top card in ${out.topDiff}`)
process.exit(0)
