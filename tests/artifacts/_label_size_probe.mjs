/**
 * WHAT THE GRAPH'S NAME LABEL MAY WEIGH, measured — the recompute script for NG_NAME_PX* .
 *
 * CLAUDE.md 6.9: a canon number nobody can reproduce is worse than no number. The focused pair
 * label's size is bounded by ONE thing — `dual-pair.spec.ts`'s @curated `labelRight < W` at
 * 320/360/390, which reads the UNTRIMMED `_labelWidthPx`, so the gate fails before a user ever
 * sees an ellipsis. This prints, per viewport, the largest font size that still fits.
 *
 * It measures the CORPUS, not just the widest position: `pairGroup` draws `posFamily(t)` for a
 * position and `splitName(t).main` for a technique, and nothing had ever checked the second set.
 *
 * Run:  npx serve source/public -l 8134 --no-clipboard   (then)
 *       node tests/artifacts/_label_size_probe.mjs
 */
import { chromium } from "@playwright/test"

const BASE = process.env.PROBE_BASE || "http://localhost:8134"
const CANDIDATES = [18, 18.5, 19, 20, 21, 22, 23, 24, 25, 26]
const VIEWPORTS = [320, 360, 390, 414, 641, 700, 768, 900, 1024, 1280, 1440]

const browser = await chromium.launch()

// ---- pass 1: the corpus's widest DRAWN name, at 18px, on one boot -------------------------
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto(`${BASE}/Positions/Mount/Top`)
await page.waitForFunction(() => (window.__neural?.nodes || []).length > 1000, null, { timeout: 45000 })

const corpus = await page.evaluate((CANDIDATES) => {
  const a = window.__neural
  const c = document.createElement("canvas").getContext("2d")
  const fam = (a._displayFam || "'Space Grotesk'") + ", sans-serif"
  const drawn = (n) => (n.ty === "positions" ? a.posFamily(n.t) : a.splitName(n.t).main)
  const out = {}
  for (const px of CANDIDATES) {
    c.font = "700 " + px + "px " + fam
    let best = { w: 0, t: "", ty: "" }
    const byType = {}
    for (const n of a.nodes) {
      if (n.rep === false) continue
      const t = drawn(n)
      const w = c.measureText(t).width
      if (w > best.w) best = { w: Math.round(w * 10) / 10, t, ty: n.ty }
      if (!byType[n.ty] || w > byType[n.ty].w) byType[n.ty] = { w: Math.round(w * 10) / 10, t }
    }
    out[px] = { widest: best, byType }
  }
  return { out, fam, resolvedFont: getComputedStyle(document.body).fontFamily, nodes: a.nodes.length }
}, CANDIDATES)

console.log("=== font actually in use ===")
console.log("  _displayFam :", corpus.fam)
console.log("  nodes       :", corpus.nodes)
console.log("\n=== widest DRAWN name in the corpus, per candidate size ===")
for (const px of CANDIDATES) {
  const r = corpus.out[px]
  const per = Object.entries(r.byType).map(([k, v]) => `${k}=${v.w}`).join(" ")
  console.log(`  ${String(px).padStart(4)}px  max ${String(r.widest.w).padStart(6)}px  "${r.widest.t}" [${r.widest.ty}]   (${per})`)
}
await page.close()

// ---- pass 2: labelRight vs W, per viewport, on the node the gate actually boots -----------
console.log("\n=== labelRight vs W  (the dual-pair.spec.ts formula, on its own node) ===")
const worst18 = corpus.out[18].widest
const rows = []
for (const width of VIEWPORTS) {
  const p = await browser.newPage({ viewport: { width, height: 780 } })
  await p.goto(`${BASE}/Positions/Straight-Ankle-Lock-Control`)
  await p.waitForFunction(() => (window.__neural?.nodes || []).length > 1000, null, { timeout: 45000 })
  await p.waitForTimeout(3500)
  const g = await p.evaluate((CANDIDATES) => {
    const a = window.__neural
    const scale = a.W / a.cam.vw
    const K = Math.max(0.4, Math.min(1, a.cam.vw / (a.graphW * 0.5)))
    const f = a.nodes[a.focusIdx]
    const pr = f.pi >= 0 ? a.nodes[f.pi] : null
    const sx = (a.pairMid(f).x - a.cam.cx) * scale + a.W / 2
    const r = Math.max(f.r * K * scale, pr ? pr.r * K * scale : 0) * 1.28
    const c = document.createElement("canvas").getContext("2d")
    const fam = (a._displayFam || "'Space Grotesk'") + ", sans-serif"
    const nm = f.ty === "positions" ? a.posFamily(f.t) : a.splitName(f.t).main
    const fits = {}
    for (const px of CANDIDATES) {
      c.font = "700 " + px + "px " + fam
      const lw = c.measureText(nm).width
      // mobile re-centres the orb+label BLOCK, so the orb's x moves with the label width
      const mob = a.isMobile()
      const wantLeft = a.W / 2 - (11 + lw) / 2 - r
      const orbLeft = mob ? Math.max(a.NG_LABEL_LEFT_MIN, wantLeft) : sx - r
      fits[px] = Math.round((orbLeft + 2 * r + 11 + lw) * 10) / 10
    }
    return { W: a.W, name: nm, r: Math.round(r * 100) / 100, sx: Math.round(sx * 10) / 10, mobile: a.isMobile(), fits }
  }, CANDIDATES)
  rows.push({ width, ...g })
  await p.close()
}

for (const row of rows) {
  const ok = CANDIDATES.filter((px) => row.fits[px] < row.W)
  const max = ok.length ? ok[ok.length - 1] : "NONE"
  const detail = CANDIDATES.map((px) => `${px}:${row.fits[px]}${row.fits[px] < row.W ? "" : "*"}`).join(" ")
  console.log(`  ${String(row.width).padStart(5)}px  mobile=${row.mobile ? "y" : "n"}  max fitting size = ${max}`)
  console.log(`          ${detail}`)
}
console.log("\n  (* = labelRight >= W, i.e. dual-pair.spec.ts goes RED at that size)")
console.log(`  worst drawn name at 18px: "${worst18.t}" (${worst18.w}px, ${worst18.ty})`)
await browser.close()
