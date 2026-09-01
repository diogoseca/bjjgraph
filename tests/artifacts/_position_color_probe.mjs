// WHOSE POINT OF VIEW DOES THE CANVAS PAINT A POSITION FROM?
//
// CLAUDE.md has carried an OPEN, OWNER'S-CALL disclosure since v1.104.3: `ingest` bakes
// `dom = n.s[0]`, `s[0]` is the TOP player's value for a position, so "while you play bottom the
// canvas paints them from your opponent's point of view". It quoted "85 of 136 positions (62%)
// have opposite-sign slots".
//
// Two things need measuring, not asserting:
//   1. the CONTENT fact  — how many position hubs carry opposite-sign [top, bottom] slots;
//   2. the RENDER fact   — whether the orb the canvas actually draws is painted with the value of
//      the side that orb represents. v1.125.0 made `_deriveDualPairs` the default, and it stamps
//      `sv` (this member's OWN side) which `ingest` prefers over `s[0]`, so the premise itself
//      may have moved out from under the disclosure.
//
// Both paths are walked in one session: the default (pair) and the noPairs control group, the
// hatch that skips the derivation.
//
//   flock /tmp/bjj-pw.lock node tests/artifacts/_position_color_probe.mjs
import { chromium } from "@playwright/test"

const BASE = process.env.BASE || "http://localhost:8080"
const browser = await chromium.launch()

async function walk(path, noPairs = false) {
  const page = await browser.newPage()
  // v1.158.1: `?dual=legacy` is gone. The pre-split graph is reachable only through the flag the
  // DSL uses, and it MUST be set before the bundle boots — passing the old param would now be
  // silently ignored and this probe would compare the paired graph against itself, which is the
  // repo's own "absence produces a plausible answer" failure wearing a probe's clothes.
  if (noPairs) await page.addInitScript(() => { window.__NEURAL_NO_PAIRS__ = true })
  await page.goto(BASE + path, { waitUntil: "domcontentloaded" })
  await page.waitForFunction(() => window.__neural && window.__neural.nodes && window.__neural.nodes.length, null, { timeout: 60000 })
  const out = await page.evaluate(() => {
    const app = window.__neural
    const pos = app.nodes.filter((n) => n.ty === "positions")
    const sameCol = (a, b) => a && b && a.r === b.r && a.g === b.g && a.b === b.b
    // Which slot of `s` does this DRAWN node represent?  On the pair path the member says so
    // outright (`role`); on the legacy path one node stands for the whole hub, so there is no
    // answer — the hub is drawn once and can only wear one side's colour.
    let ownSide = 0, otherSide = 0, oppSign = 0, hubs = new Set()
    const examples = []
    for (const n of pos) {
      const s = n.s || []
      if (s.length >= 2 && s[0] * s[1] < 0) oppSign++
      hubs.add(n.pairId ? [n.id, n.pairId].sort()[0] : n.id)
      if (!n.role) continue
      const mine = n.role === "bottom" ? s[1] : s[0]
      if (Math.abs((n.dom || 0) - mine) < 1e-9) ownSide++
      else { otherSide++; if (examples.length < 4) examples.push({ id: n.id, role: n.role, dom: n.dom, s }) }
    }
    // What a BOTTOM player sees: is the orb they are standing on painted their own colour?
    const savedPos = app.currentPos, savedRole = app.playerRole
    app.playerRole = "bottom"
    let hueClash = 0, seen = 0
    for (const n of pos) {
      if (n.role === "top") continue          // on the pair path only the bottom orb is "yours"
      const s = n.s || []
      if (s.length < 2) continue
      seen++
      if (!sameCol(n.col, app.myColor(n))) hueClash++
    }
    app.currentPos = savedPos; app.playerRole = savedRole
    return {
      drawnPositionNodes: pos.length, hubs: hubs.size, pairsDerived: app._pairsDerived || null,
      oppSignNodes: oppSign, ownSide, otherSide, examples,
      bottomView: { considered: seen, paintedFromTheOtherSide: hueClash },
    }
  })
  await page.close()
  return out
}

const pair = await walk("/")
const legacy = await walk("/", true)

const show = (tag, r) => {
  console.log("\n== %s ==", tag)
  console.log("   drawn position nodes ......... %d   (distinct hubs %d)", r.drawnPositionNodes, r.hubs)
  console.log("   pair derivation .............. %s", r.pairsDerived ? JSON.stringify(r.pairsDerived) : "not run")
  console.log("   nodes whose s = [top,bottom] have OPPOSITE SIGNS .. %d", r.oppSignNodes)
  console.log("   painted with its OWN side's value ................. %d", r.ownSide)
  console.log("   painted with the OTHER side's value ............... %d", r.otherSide)
  if (r.examples.length) console.log("     e.g. %s", JSON.stringify(r.examples))
  console.log("   PLAYING BOTTOM: orbs considered %d, painted from the other side %d",
    r.bottomView.considered, r.bottomView.paintedFromTheOtherSide)
}
show("DEFAULT (the pair, v1.125.0)", pair)
show("noPairs control group (hubs, the pre-v1.125.0 render)", legacy)

await browser.close()
