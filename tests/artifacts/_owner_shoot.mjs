#!/usr/bin/env node
/**
 * OWNER SHOOT — the six views this arc will be judged on, at 1440x900 and 390x844.
 *
 * NOT a gate and NOT a test: no assertions, no fixtures, no rigged clock. It drives the REAL dev
 * server (`npm run serve`, :8080) with real wall-clock time, so what lands in the PNG is what the
 * owner sees when they run the same command. That is the whole point — a screenshot taken under
 * the harness would show the harness's `{}` dossier chunks and its empty film strip, which is not
 * the product.
 *
 * Every navigation is a URL a person can type, and every interaction is a real mouse event at a
 * MEASURED coordinate (share-camera / clickByMouse canon) — never `locator.click()`, which scrolls
 * and would hide exactly the clipping bugs a shoot is for.
 *
 *   node tests/artifacts/_owner_shoot.mjs [outDir]
 */
import { chromium } from "playwright"
import fs from "node:fs"
import path from "node:path"

const OUT = process.argv[2] || "/home/user/.claude/jobs/0f0ff31e/tmp"
const BASE = process.env.SHOOT_BASE || "http://localhost:8080"
fs.mkdirSync(OUT, { recursive: true })

const VIEWPORTS = [
  { tag: "1440x900", width: 1440, height: 900 },
  { tag: "390x844", width: 390, height: 844, isMobile: true, hasTouch: true },
]

/** The state everyone can name, on the side the pair makes legible. */
const AT = "/Positions/Mount/Top"
/** 25 authored moves — the biggest hand the uncapping actually changed. */
const HAND = "/Positions/Side-Control/Top"

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** The intro runs 3.2s; the landing card animates in after it. Read between layout flushes. */
async function settle(page, ms = 9000) {
  await sleep(ms)
  for (let i = 0; i < 6; i++) {
    await page.evaluate(() => document.body.getBoundingClientRect().top)
    await sleep(250)
  }
}

async function shot(page, name, vp) {
  const file = path.join(OUT, `${name}--${vp.tag}.png`)
  await page.screenshot({ path: file })
  const kb = (fs.statSync(file).size / 1024).toFixed(0)
  console.log(`  ✓ ${path.basename(file)}  (${kb} KB)`)
  return file
}

/** What the app itself says is on screen — printed beside each shot so the PNG is checkable. */
const facts = (page) =>
  page.evaluate(() => {
    const a = window.__neural
    if (!a) return { boot: false }
    const f = a.nodes[a.focusIdx]
    const p = f && f.pi >= 0 ? a.nodes[f.pi] : null
    return {
      nodes: a.nodes.length,
      reps: a.nodes.filter((n) => n.rep).length,
      focus: f ? f.id : null,
      focusRole: f ? f.role : null,
      partner: p ? p.id : null,
      partnerRole: p ? p.role : null,
      camVw: Math.round(a.cam.vw),
      graphW: Math.round(a.graphW),
      cards: document.querySelectorAll(".ng-optionrow > *").length,
      landcard: !!document.querySelector(".ng-landcard"),
      paused: !!a.paused,
    }
  })

async function run(vp) {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: !!vp.isMobile,
    hasTouch: !!vp.hasTouch,
    deviceScaleFactor: 1,
    reducedMotion: "no-preference",
  })
  const page = await ctx.newPage()
  const errs = []
  page.on("pageerror", (e) => errs.push(String(e)))
  const written = []

  console.log(`\n=== ${vp.tag} ===`)

  // ── 1 + 2 · the default graph at roll zoom, then the same view zoomed out ──────────────────
  await page.goto(`${BASE}${AT}`, { waitUntil: "load" })
  await settle(page)
  console.log("  facts(pair landing):", JSON.stringify(await facts(page)))
  written.push(await shot(page, "01-pair-landing-rollzoom-default", vp))

  // A real wheel-out: `userActiveNow()` then owns the camera, which is exactly how a person zooms
  // out. Nothing is set through the app's internals.
  //
  // THE WHEEL POINT MUST BE MEASURED, NOT ASSUMED. The canvas handler is one listener among many,
  // and every fixed overlay that owns controls calls `stopPropagation` on `wheel` (app.src.jsx:400)
  // — so a wheel aimed at the middle of the screen lands on the landing card and does NOTHING.
  // Measured at 1440x900: (720,306) hit a SPAN and left `cam.vw` at 130.5; (120,120) hit the
  // CANVAS and took it to 187.0. So hit-test first and use a point that is really the canvas.
  const canvasPoint = async () => {
    const cands = [
      [vp.width * 0.09, vp.height * 0.12],
      [vp.width * 0.5, vp.height * 0.09],
      [vp.width * 0.91, vp.height * 0.12],
      [vp.width * 0.09, vp.height * 0.5],
    ]
    for (const [x, y] of cands) {
      const tag = await page.evaluate(
        ({ x, y }) => {
          const e = document.elementFromPoint(x, y)
          return e ? e.tagName : "null"
        },
        { x, y },
      )
      if (tag === "CANVAS") return [x, y]
    }
    throw new Error("no canvas point free of overlays")
  }
  const [wx, wy] = await canvasPoint()
  const vw0 = await page.evaluate(() => window.__neural.cam.vw)
  // STOP AT THE WHOLE GRAPH, not at the zoom ceiling. 26 clicks reached `cam.vw` 3991 against a
  // `graphW` of 1535 — 2.6x the graph, which is the clamp — and since the wheel pins the world
  // point under the CURSOR, zooming from a corner drove the whole map into that corner and left
  // 70% of the frame empty. Zoom until the graph fits, then pan it into the free band.
  for (let i = 0; i < 30; i++) {
    const done = await page.evaluate(() => window.__neural.cam.vw >= window.__neural.graphW * 1.1)
    if (done) break
    await page.mouse.move(wx, wy)
    await page.mouse.wheel(0, 220)
    await sleep(45)
  }
  await settle(page, 900)
  // A REAL DRAG, from canvas to canvas, long enough to be a pan and not a tap.
  const band = await page.evaluate(() => {
    const a = window.__neural
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9
    const ly = (n) => (a._LY ? a._LY(n) : n.y)
    for (const n of a.nodes) { if (n.x < x0) x0 = n.x; if (n.x > x1) x1 = n.x; const y = ly(n); if (y < y0) y0 = y; if (y > y1) y1 = y }
    const scale = a.W / a.cam.vw
    const cx = a.W / 2 + ((x0 + x1) / 2 - a.cam.cx) * scale
    const cy = a.H / 2 + ((y0 + y1) / 2 - a.cam.cy) * scale
    const card = document.querySelector("[data-landcard]")
    const top = card ? card.getBoundingClientRect().top : a.H * 0.7
    return { cx, cy, wantX: a.W / 2, wantY: Math.max(90, top / 2) }
  })
  const from = await canvasPoint()
  const dx = band.wantX - band.cx, dy = band.wantY - band.cy
  await page.mouse.move(from[0], from[1])
  await page.mouse.down()
  for (let s = 1; s <= 12; s++) { await page.mouse.move(from[0] + (dx * s) / 12, from[1] + (dy * s) / 12); await sleep(20) }
  await page.mouse.up()
  await settle(page, 1400)
  const vw1 = await page.evaluate(() => window.__neural.cam.vw)
  console.log(`  wheel-out at (${Math.round(wx)},${Math.round(wy)}): cam.vw ${vw0.toFixed(1)} -> ${vw1.toFixed(1)} · panned (${Math.round(dx)},${Math.round(dy)})`)
  if (!(vw1 > vw0 * 3)) throw new Error(`the wheel did not zoom out (${vw0} -> ${vw1})`)
  console.log("  facts(overview):", JSON.stringify(await facts(page)))
  written.push(await shot(page, "02-pair-overview-zoomedout-default", vp))

  // ── 3 · a TECHNIQUE pair ──────────────────────────────────────────────────────────────────
  // WHEEL-ZOOM ONTO THE TECHNIQUE, do not tap it. A graph tap on a technique STAGES the roll at
  // that technique's ORIGIN POSITION (v1.126.0's `techniqueOrigin` seat — measured here: tapping
  // `Trap and Roll from Mount` moved the focus to `Positions/Mount/Bottom` and dealt its 6-card
  // hand), which frames a POSITION pair, not the technique. The wheel keeps the world point under
  // the cursor fixed while it zooms, so parking the cursor on a technique orb and wheeling IN
  // grows that pair into the frame — a real gesture, and the only one that composes this shot.
  // The coordinate is projected through draw()'s transform + `_LY`, never the stored `n.y`.
  await page.goto(`${BASE}${AT}`, { waitUntil: "load" })
  await settle(page)
  const aim = await page.evaluate(() => {
    const a = window.__neural
    const scale = a.W / a.cam.vw
    // `_LY` is the ONE definition of the edge-anchored lift the frame just drew with. Reading the
    // stored `n.y` instead is the defect this repo has now shipped three times.
    const ly = (n) => (a._LY ? a._LY(n) : n.y)
    const scr = (n) => ({ x: a.W / 2 + (n.x - a.cam.cx) * scale, y: a.H / 2 + (ly(n) - a.cam.cy) * scale })
    const f = a.nodes[a.focusIdx]
    // AIM AT A TECHNIQUE THAT IS IN THE DEALT HAND. Every technique is a pair, but only the ones
    // in your hand are LIT and carry their label group and ring; an arbitrary neighbour renders as
    // a dim outline, which photographs as nothing. The hand is also the honest subject — these are
    // the pairs a player is actually looking at.
    const dealt = new Set((a.optionIdxs || []).map((o) => (typeof o === "number" ? o : o.idx)))
    let best = null
    for (const n of a.nodes) {
      if (n.ty === "positions") continue
      if (!dealt.has(n.idx)) continue
      if (n.pi < 0) continue // must be half of a pair — that is the subject of the shot
      const s = scr(n)
      if (s.x < 90 || s.x > a.W - 90 || s.y < 110 || s.y > a.H - 300) continue
      // ...AND THE POINT MUST BE THE CANVAS. At 390x844 the challenge cue is a full-width band at
      // [12,118 .. 378,168] and the camera parks the focus at ~16% of viewport height, so the
      // nodes nearest the state you are standing on sit UNDER it — measured, a wheel aimed at
      // `Trap and Roll from Mount` (131,133) left `cam.vw` at 130.5, unchanged. Overlay chrome
      // eats the gesture, so an unhit-tested coordinate produces a screenshot of nothing happening.
      if (document.elementFromPoint(s.x, s.y) !== a.canvas) continue
      const d = Math.hypot(n.x - f.x, ly(n) - ly(f))
      if (!best || d < best.d) best = { d, id: n.id, ty: n.ty, x: s.x, y: s.y }
    }
    return best
  })
  if (!aim) throw new Error("no on-screen technique pair to zoom onto")
  console.log("  zooming onto technique:", aim.id, `(${aim.ty}) @ ${Math.round(aim.x)},${Math.round(aim.y)}`)
  // STOP WHERE THE LABEL IS STILL DRAWN. 22 steps took `cam.vw` to 9.2 and the pair filled the
  // screen as two unlabelled shapes — correct behaviour (v1.114.0: "nothing is written inside a
  // node, however far you zoom in") and a useless picture. ~3x in from roll zoom puts both orbs
  // and their one label group in frame, so wheel until the target is reached rather than counting
  // clicks, which depend on the starting zoom.
  const tvw0 = await page.evaluate(() => window.__neural.cam.vw)
  for (let i = 0; i < 30; i++) {
    if ((await page.evaluate(() => window.__neural.cam.vw)) <= 42) break
    await page.mouse.move(aim.x, aim.y)
    await page.mouse.wheel(0, -170)
    await sleep(45)
  }
  await settle(page, 1600)
  const tz = await page.evaluate((id) => {
    const a = window.__neural
    const n = a.nodes.find((q) => q.id === id)
    const p = n && n.pi >= 0 ? a.nodes[n.pi] : null
    const scale = a.W / a.cam.vw
    const ly = (q) => (a._LY ? a._LY(q) : q.y)
    const sc = (q) => ({ x: Math.round(a.W / 2 + (q.x - a.cam.cx) * scale), y: Math.round(a.H / 2 + (ly(q) - a.cam.cy) * scale) })
    return { vw: a.cam.vw, on: sc(n), partner: p ? { id: p.id, ...sc(p) } : null }
  }, aim.id)
  console.log(`  cam.vw ${tvw0.toFixed(1)} -> ${tz.vw.toFixed(1)} · ${aim.id} at ${tz.on.x},${tz.on.y} · partner ${tz.partner ? tz.partner.id + " at " + tz.partner.x + "," + tz.partner.y : "none"}`)
  console.log("  facts(technique pair):", JSON.stringify(await facts(page)))
  written.push(await shot(page, "03-technique-pair-rollzoom-default", vp))

  // ── 4 · the option hand at side control / top, uncapped ───────────────────────────────────
  await page.goto(`${BASE}${HAND}`, { waitUntil: "load" })
  await settle(page)
  const hand = await facts(page)
  console.log("  facts(hand):", JSON.stringify(hand))
  written.push(await shot(page, "04-option-hand-side-control-top-uncapped", vp))

  // ── 5 · Settings → Rolling, the loss-aversion dial ────────────────────────────────────────
  // Real path: the account chip opens the menu, the menu opens Settings, the Rolling tab is a
  // click. Measured coordinates throughout.
  const clickCentre = async (sel) => {
    const box = await page.locator(sel).first().boundingBox()
    if (!box) throw new Error(`no box for ${sel}`)
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.up()
    await sleep(420)
  }
  await clickCentre(".ngAcctChip")
  await clickCentre("[data-menu-settings]")
  await clickCentre(".t-rl")
  await sleep(700)
  // READ THE SELECTED RUNG THE WAY THE GATE DOES. `segBtn` marks the active choice with a filled
  // background and a brighter border and sets NO `aria-pressed`, `aria-checked` or data flag — so
  // an accessible-state read reports "nothing selected" on a control that is plainly selected.
  // `loss-aversion.spec.ts:84` tests `/rgba\(74, 108, 255/` on the inline background for exactly
  // this reason; matching it here keeps the printed facts true to the picture.
  const dial = await page.evaluate(() => {
    const seg = document.querySelector("[data-settings-loss]")
    if (!seg) return { present: false }
    const bs = [...seg.querySelectorAll("button")]
    return {
      present: true,
      rungs: bs.map((b) => b.textContent.trim()),
      selected: bs.filter((b) => /rgba\(74, 108, 255/.test(b.style.background)).map((b) => b.textContent.trim()),
      ariaPressed: bs.filter((b) => b.getAttribute("aria-pressed") === "true").length,
      note: (document.querySelector("[data-loss-note]") || {}).textContent || null,
      visible: seg.getBoundingClientRect().height > 0,
    }
  })
  console.log("  loss-aversion dial:", JSON.stringify(dial))
  written.push(await shot(page, "05-settings-rolling-loss-aversion", vp))

  // ── 6 · the SAME view under ?dual=legacy ──────────────────────────────────────────────────
  await page.goto(`${BASE}${AT}?dual=legacy`, { waitUntil: "load" })
  await settle(page)
  console.log("  facts(legacy):", JSON.stringify(await facts(page)))
  written.push(await shot(page, "06-same-view-dual-legacy-comparison", vp))

  if (errs.length) console.log("  !! pageerrors:", errs.slice(0, 5))
  else console.log("  (0 page errors)")
  await browser.close()
  return written
}

const all = []
for (const vp of VIEWPORTS) all.push(...(await run(vp)))
console.log(`\n${all.length} files under ${OUT}`)
for (const f of all) console.log(f)
