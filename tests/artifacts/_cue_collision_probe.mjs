#!/usr/bin/env node
/**
 * DOES THE CHALLENGE CUE SIT ON TOP OF THE STATE YOU ARE STANDING IN?
 *
 * Seen in the v1.127.2 owner shoot at 390x844: the "WHITE CHALLENGES / Preview a move" card
 * appears to cross the Mount pair's label group and its upper orb. The camera parks the focus at
 * ~16% of viewport height (the `lift` in `rollCamTarget`, v1.101.0) and the cue is fixed chrome,
 * so if they collide they collide on EVERY landing, not just this one.
 *
 * Measures, not eyeballs: the cue's client rect against the focus orb (centre + drawn radius,
 * projected through draw()'s transform and `_LY`) and against the label group, which `draw()`
 * writes to the RIGHT of the orb starting at `sx + r + 10` on the pair's midline.
 *
 *   node tests/artifacts/_cue_collision_probe.mjs
 */
import { chromium } from "playwright"

const BASE = process.env.SHOOT_BASE || "http://localhost:8080"
const AT = "/Positions/Mount/Top"
const VPS = [
  { tag: "1440x900", width: 1440, height: 900 },
  { tag: "1440x900 legacy", width: 1440, height: 900, q: "?dual=legacy" },
  { tag: "390x844", width: 390, height: 844, isMobile: true, hasTouch: true },
  { tag: "390x844 legacy", width: 390, height: 844, isMobile: true, hasTouch: true, q: "?dual=legacy" },
]
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const overlap = (a, b) =>
  a && b
    ? Math.max(
        0,
        Math.min(a.right, b.right) - Math.max(a.left, b.left),
      ) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
    : 0

for (const vp of VPS) {
  const browser = await chromium.launch()
  const page = await (
    await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: !!vp.isMobile,
      hasTouch: !!vp.hasTouch,
    })
  ).newPage()
  await page.goto(`${BASE}${AT}${vp.q || ""}`, { waitUntil: "load" })
  await sleep(9000)
  for (let i = 0; i < 6; i++) {
    await page.evaluate(() => document.body.getBoundingClientRect().top)
    await sleep(250)
  }

  const m = await page.evaluate(() => {
    const a = window.__neural
    const scale = a.W / a.cam.vw
    const nodeK = Math.max(0.4, Math.min(1, a.cam.vw / (a.graphW * 0.5)))
    const ly = (n) => (a._LY ? a._LY(n) : n.y)
    const f = a.nodes[a.focusIdx]
    const p = f.pi >= 0 ? a.nodes[f.pi] : null
    const box = (n) => {
      const cx = a.W / 2 + (n.x - a.cam.cx) * scale
      const cy = a.H / 2 + (ly(n) - a.cam.cy) * scale
      const r = n.r * nodeK * scale
      return { left: cx - r, right: cx + r, top: cy - r, bottom: cy + r, cx, cy, r }
    }
    const fb = box(f)
    const mid = a.pairMid ? a.pairMid(f) : { x: f.x, y: ly(f) }
    const midY = a.H / 2 + (mid.y - a.cam.cy) * scale
    // the label group: draw() puts it to the RIGHT of the orb, on the pair's midline
    const label = { left: fb.cx + fb.r + 6, right: fb.cx + fb.r + 200, top: midY - 22, bottom: midY + 30 }
    const pick = (sel) => {
      const el = document.querySelector(sel)
      if (!el) return null
      const r = el.getBoundingClientRect()
      if (!r.width || !r.height) return null
      const cs = getComputedStyle(el)
      if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity === 0) return null
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, text: (el.textContent || "").trim().slice(0, 48) }
    }
    return {
      focus: f.id,
      focusBox: fb,
      partnerBox: p ? box(p) : null,
      label,
      cue: pick(".ng-challenge-cue") || pick("[data-challenge-cue]"),
      W: a.W,
      H: a.H,
    }
  })

  const cue = m.cue
  console.log(`\n=== ${vp.tag} · focus ${m.focus} ===`)
  if (!cue) {
    console.log("  no challenge cue on screen")
  } else {
    console.log(`  cue      [${cue.left.toFixed(0)},${cue.top.toFixed(0)} .. ${cue.right.toFixed(0)},${cue.bottom.toFixed(0)}]  "${cue.text}"`)
    console.log(`  focusOrb [${m.focusBox.left.toFixed(0)},${m.focusBox.top.toFixed(0)} .. ${m.focusBox.right.toFixed(0)},${m.focusBox.bottom.toFixed(0)}]  r=${m.focusBox.r.toFixed(0)}`)
    if (m.partnerBox)
      console.log(`  partner  [${m.partnerBox.left.toFixed(0)},${m.partnerBox.top.toFixed(0)} .. ${m.partnerBox.right.toFixed(0)},${m.partnerBox.bottom.toFixed(0)}]`)
    console.log(`  label    [${m.label.left.toFixed(0)},${m.label.top.toFixed(0)} .. ${m.label.right.toFixed(0)},${m.label.bottom.toFixed(0)}]`)
    console.log(`  OVERLAP px^2 — orb ${overlap(cue, m.focusBox).toFixed(0)} · partner ${overlap(cue, m.partnerBox).toFixed(0)} · label ${overlap(cue, m.label).toFixed(0)}`)
    const hit = await page.evaluate(
      ({ x, y }) => {
        const e = document.elementFromPoint(x, y)
        return e ? e.tagName + " " + String(e.className || "").slice(0, 40) : "null"
      },
      { x: m.focusBox.cx, y: m.focusBox.cy },
    )
    console.log(`  elementFromPoint at the orb's centre: ${hit}`)
  }
  await browser.close()
}
