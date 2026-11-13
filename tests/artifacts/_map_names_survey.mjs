#!/usr/bin/env node
/**
 * THE MAP'S NAMES: A SURVEY (v1.275.0; NOT a gate, NOT a test: the gate is e2e/journeys/map-names.spec.ts).
 *
 * The owner, 13 Nov: "dunno why in the graph there are many techniques showing but they are unreadable like this you
 * know, when they overlap, avoid that pls". This measures the fault on the ORDINARY map, so before and after are numbers.
 *
 * WHAT IT READS: every string the frame passes to the map canvas's `fillText`, with the ink box the browser itself
 * measures for it at that moment (`measureText`'s actual bounding box, the font, baseline and transform then in force).
 * That is the render's own output, the same on the bundle before the change and after it, so the two runs are measured
 * by one instrument and neither depends on what the app chooses to publish. The lines of one label (a kicker, a name,
 * a "from ..." line) are drawn consecutively at one x and are grouped back into that label.
 *
 * FOR EACH CASE it counts, over the labels written:
 *   overlaps   pairs of labels whose ink boxes intersect (and `near`: pairs closer than 6 px, the designer's air)
 *   cut        labels whose box leaves the map canvas (and `trimmed`: names the fitter ended with an ellipsis)
 *   under      labels under a control: a PAINTED element of the app's own root over the box (text, by the text's own
 *              line boxes; an element with a background, a border, an image or an icon, by its box; each cut by every
 *              ancestor that clips, so a card scrolled out of the row or a visually hidden heading is not over the map), the canvas
 *              itself and anything at under 5% effective opacity excepted; the seat star beside the position's own
 *              role word is part of that label and is not counted against it
 *   crossOrb   labels crossing the drawn orb of another dealt move or of the position's pair (not their own)
 *   crossSeal  labels crossing a gold dot that is not their own (`_lastMapSeals`)
 *   crossBg    labels crossing any other orb drawn on screen (the cloud: reported, not a target)
 * and how many labels were written, by kind (the position's own, dealt moves, other), ON THE SETTLED FRAME: each case settles
 * half a second at the usual zoom, wheels, and records half a second after the camera rests (a name the jump dropped waits
 * that long before it may come back); `jump` counts the moves named on the wheel's own frame, `rest1` on the first at rest,
 * so "zero overlaps" can never be
 * bought by writing nothing, beside how many dealt orbs were on the canvas (`inView`) and in the FREE map, their centre
 * under no control (`inMap`: the moves a name could be written beside at all). Orb radii here are the silhouette (`shapePath`'s widening of the type, the mitosis
 * radius, `nodeK`) recomputed from draw()'s formulas; that is a re-implementation and is why this is a survey.
 *
 * THE CASES: 40 seats spread over the map (the five the brief names first: Mount top, Side Control top, Closed Guard
 * bottom, Standing top, a four-move seat; then one per cell of a 6x6 grid over the map, round robin), at 390x631,
 * 390x844 and 1440x900; at the app's usual zoom (the follow camera, settled) and pulled back 2, 4 and 9 times by the
 * app's own wheel handler, centred on the position (a synthetic `wheel` on the canvas: the handler zooms about the
 * pointer); with the drawer shut and open (the logo button, pressed at its measured centre).
 *
 *   node tests/artifacts/_map_names_survey.mjs <out.json> [--base URL] [--app DIR] [--vp 390x631,390x844,1440x900]
 *        [--n 40] [--zooms 1,2,4,9] [--drawer shut,open]
 *   --app DIR serves the app files found in DIR in place of the build's (the "before" bundle).
 */
import { chromium } from "playwright"
import fs from "node:fs"
import path from "node:path"

const args = process.argv.slice(2)
const OUT = args[0]
if (!OUT) { console.error("usage: _map_names_survey.mjs <out.json> [--base URL] [--app DIR] [--vp ...] [--n 40]"); process.exit(2) }
const opt = (k, d) => { const i = args.indexOf("--" + k); return i > 0 ? args[i + 1] : d }
const BASE = opt("base", "http://localhost:8196")
const APP = opt("app", null)
const VPS = opt("vp", "390x631,390x844,1440x900").split(",").map((s) => { const [w, h] = s.split("x").map(Number); return { w, h, mobile: w < 700 } })
const N = +opt("n", 40)
const ZOOMS = opt("zooms", "1,2,4,9").split(",").map(Number)
const DRAWERS = opt("drawer", "shut,open").split(",")
const APP_FILES = APP ? new Set(fs.readdirSync(APP)) : null

// ── THE SEATS, chosen from the wire the page reads (deterministic) ─────────────────────────────────────────────────
const WIRE = JSON.parse(fs.readFileSync(new URL("../../source/quartz/static/neural/graph-data.json", import.meta.url), "utf8"))
function chooseSeats() {
  const pos = WIRE.nodes.map((n, i) => ({ ...n, i })).filter((n) => n.ty === "positions" && n.cal && n.cal.ev)
  const seats = []
  const have = new Set()
  const add = (t, role) => { const k = t + "|" + role; if (have.has(k)) return; const n = pos.find((p) => p.t === t); if (!n) throw new Error("no position " + t); have.add(k); seats.push({ t, role, x: n.x, y: n.y, moves: (n.cal.ev[role] || [[]])[0].length }) }
  add("Mount Top", "top"); add("Side Control Top", "top"); add("Closed Guard Top", "bottom"); add("Standing Position Top", "top")
  const four = pos.flatMap((n) => ["top", "bottom"].map((r) => ({ n, r, k: ((n.cal.ev[r] || [[]])[0] || []).length }))).filter((q) => q.k === 4).sort((p, q) => p.n.t.localeCompare(q.n.t))[0]
  if (four) add(four.n.t, four.r)
  const xs = pos.map((p) => p.x), ys = pos.map((p) => p.y)
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), G = 6
  const cells = new Map()
  for (const p of pos.sort((p, q) => p.t.localeCompare(q.t))) {
    const cx = Math.min(G - 1, Math.floor((p.x - x0) / (x1 - x0 + 1e-9) * G)), cy = Math.min(G - 1, Math.floor((p.y - y0) / (y1 - y0 + 1e-9) * G))
    const k = cy * G + cx; if (!cells.has(k)) cells.set(k, []); cells.get(k).push(p)
  }
  const keys = [...cells.keys()].sort((a, b) => a - b)
  for (let round = 0; seats.length < N && round < 50; round++) {
    for (const k of keys) {
      if (seats.length >= N) break
      const p = cells.get(k)[round]; if (!p) continue
      // alternate the seat by the cell and the round, and only a seat that deals at least two moves
      const roles = (k + round) % 2 ? ["bottom", "top"] : ["top", "bottom"]
      const r = roles.find((r) => ((p.cal.ev[r] || [[]])[0] || []).length >= 2)
      if (r) add(p.t, r)
    }
  }
  return seats
}
const SEATS = chooseSeats()

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ── IN THE PAGE ─────────────────────────────────────────────────────────────────────────────────────────────────────
function instrument() {
  window.__NEURAL_TEST__ = true
  try { localStorage.clear(); sessionStorage.clear() } catch {}
  const fill = CanvasRenderingContext2D.prototype.fillText
  window.__ngTextLog = []
  CanvasRenderingContext2D.prototype.fillText = function (s, x, y, mw) {
    const a = window.__neural
    if (window.__ngTextRec && a && this.canvas === a.canvas) {
      const m = this.measureText(String(s)), t = this.getTransform()
      window.__ngTextLog.push({ s: String(s), x, y, a: t.a, d: t.d, e: t.e, f: t.f, l: m.actualBoundingBoxLeft, r: m.actualBoundingBoxRight, asc: m.actualBoundingBoxAscent, desc: m.actualBoundingBoxDescent, alpha: this.globalAlpha, fill: String(this.fillStyle) })
    }
    return fill.call(this, s, x, y, mw)
  }
}

/** One frame, recorded: everything the map wrote, grouped into labels, and the four counts. */
async function measure(page) {
  return page.evaluate(() => {
    const a = window.__neural
    // one frame after the wheel's jump, then the one recorded: the frame of a jump is a moving camera (v1.275.0 deals new
    // names only at rest), and the bundle before keeps no state between frames, so the extra 17 ms changes nothing there
    a.advance(17)
    const jump = (a._lastOptLabels || []).length   // move names on the wheel's own frame (the camera moving)
    a.advance(17)
    const rest1 = (a._lastOptLabels || []).length  // ...on the first frame at rest (a name the jump dropped still waits)
    a.advance(520 - 17)                            // half a second at rest: what the player then sees; recorded below
    window.__ngTextLog = []; window.__ngTextRec = true
    a.advance(17)
    window.__ngTextRec = false
    // keep only the LAST frame's calls: advance(17) can tick twice
    const log = window.__ngTextLog
    const dpr = a.dpr || 1, W = a.W, H = a.H
    // group consecutive calls at one x (a kicker, its name and its "from" line are one label)
    const groups = []
    for (const c of log) {
      const ink = c.alpha > 0 && !/rgba\([^)]*,\s*0(\.0+)?\)$/.test(c.fill)
      const X = (c.a * c.x + c.e) / dpr, Y = (c.d * c.y + c.f) / dpr, k = c.a / dpr
      const box = { l: X - c.l * k, r: X + c.r * k, t: Y - c.asc * k, b: Y + c.desc * k }
      const g = groups[groups.length - 1]
      if (g && Math.abs(g.x - X) < 0.5 && Math.abs(Y - g.lastY) < 42) { g.lines.push(c.s); g.box = { l: Math.min(g.box.l, box.l), r: Math.max(g.box.r, box.r), t: Math.min(g.box.t, box.t), b: Math.max(g.box.b, box.b) }; g.lastY = Y; g.ink = g.ink || ink }
      else groups.push({ x: X, lastY: Y, lines: [c.s], box, ink })
    }
    const live = groups.filter((g) => g.ink && g.box.r - g.box.l > 0.5)
    // classify by what the app is drawing this frame
    const focus = a._camOpen && !a._camOpen.cancelled && a._camOpen.pick != null ? a.currentPos : a.focusIdx
    const fn = focus >= 0 ? a.nodes[focus] : null
    const fName = fn ? a.graphName(fn) : null
    const optByName = new Map()
    for (const i of a.optionIdxs || []) optByName.set(a.graphName(a.nodes[i]), i)
    const hov = a._lastHoverLabel ? a._lastHoverLabel.idx : null
    const labels = live.map((g) => {
      let kind = "other", idx = null
      const main = g.lines.find((s) => !/^[A-Z ]+$/.test(s) && !/^from /.test(s)) || g.lines[0]
      if (fName && g.lines.some((s) => s === fName || (s.endsWith("…") && fName.startsWith(s.slice(0, -1))))) { kind = "position"; idx = focus }
      else if (optByName.has(main) || [...optByName.keys()].some((k) => main.endsWith("…") && k.startsWith(main.slice(0, -1)))) { kind = "move"; idx = optByName.get(main) ?? [...optByName.entries()].find(([k]) => k.startsWith(main.slice(0, -1)))[1] }
      if (hov != null && a.nodes[hov] && a.graphName(a.nodes[hov]) === main) kind = kind === "move" ? "move-hover" : "hover", idx = hov
      return { kind, idx, text: g.lines.join(" / "), box: g.box, trimmed: g.lines.some((s) => s.endsWith("…")) }
    })
    // ── controls: painted elements of the app root over a box ──
    const root = a.__ngRoot || a.wrapRef.current, cv = a.canvas
    const painted = []
    const eff = (el) => { let o = 1; for (let q = el; q && q !== document.documentElement; q = q.parentElement) { const cs = getComputedStyle(q); if (cs.display === "none" || cs.visibility === "hidden") return 0; o *= +cs.opacity } return o }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT)
    const seatStar = (el) => el.closest && el.closest("[data-seat-star]")
    // what the element can actually paint: its box cut by every ancestor that clips (a scrolled row, a visually hidden heading)
    const clips = new Map()
    const clipOf = (el) => {
      if (!el || el === root || el === document.documentElement) return { l: -1e9, t: -1e9, r: 1e9, b: 1e9 }
      if (clips.has(el)) return clips.get(el)
      const up = clipOf(el.parentElement), cs = getComputedStyle(el)
      let c = up
      if (cs.overflowX !== "visible" || cs.overflowY !== "visible") { const r = el.getBoundingClientRect(); c = { l: Math.max(up.l, r.left), t: Math.max(up.t, r.top), r: Math.min(up.r, r.right), b: Math.min(up.b, r.bottom) } }
      clips.set(el, c); return c
    }
    const cut = (p, el) => { const c = clipOf(el); return { ...p, l: Math.max(p.l, c.l), t: Math.max(p.t, c.t), r: Math.min(p.r, c.r), b: Math.min(p.b, c.b) } }
    const below = (el) => !!(el.compareDocumentPosition(cv) & Node.DOCUMENT_POSITION_FOLLOWING) && !el.contains(cv)   // painted before the canvas: under it
    const clip = (r) => ({ ...r, l: Math.max(0, r.l), t: Math.max(0, r.t), r: Math.min(W, r.r), b: Math.min(H, r.b) })
    for (let node = walker.currentNode; node; node = walker.nextNode()) {
      if (node === cv || node === root || node.contains(cv)) continue
      if (below(node.nodeType === 3 ? node.parentElement : node)) continue
      if (node.nodeType === 3) {
        if (!node.textContent.trim()) continue
        const el = node.parentElement; if (!el || eff(el) < 0.05) continue
        const rg = document.createRange(); rg.selectNodeContents(node)
        for (const r of rg.getClientRects()) if (r.width > 0 && r.height > 0) painted.push({ el, l: r.left, r: r.right, t: r.top, b: r.bottom, what: (el.className && typeof el.className === "string" ? el.className.split(" ")[0] : el.tagName) + ":" + node.textContent.trim().slice(0, 24), star: !!seatStar(el) })
        continue
      }
      const el = node, cs = getComputedStyle(el)
      if (cs.display === "none" || cs.visibility === "hidden") { /* its subtree is skipped by eff() below anyway */ }
      const r = el.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0)) continue
      const bg = cs.backgroundColor, bgOn = bg && !/rgba\([^)]*,\s*0\)$/.test(bg) && bg !== "transparent"
      const bd = (parseFloat(cs.borderTopWidth) + parseFloat(cs.borderLeftWidth) > 0) && !/rgba\([^)]*,\s*0\)$/.test(cs.borderTopColor)
      const media = /^(IMG|svg|VIDEO|CANVAS|INPUT|SELECT|TEXTAREA)$/i.test(el.tagName) || cs.backgroundImage !== "none"
      if (!(bgOn || bd || media)) continue
      if (eff(el) < 0.05) continue
      painted.push({ el: el.parentElement, l: r.left, r: r.right, t: r.top, b: r.bottom, what: (typeof el.className === "string" && el.className ? el.className.split(" ")[0] : el.tagName) + (el.getAttribute("data-tech") ? "[card]" : ""), star: !!seatStar(el) })
    }
    for (let i = 0; i < painted.length; i++) painted[i] = clip(cut(painted[i], painted[i].el))
    // a sliver under 2 px is not a control a name can sit under (a visually hidden heading clipped to 1 x 1)
    for (let i = painted.length - 1; i >= 0; i--) if (!(painted[i].r - painted[i].l >= 2 && painted[i].b - painted[i].t >= 2)) painted.splice(i, 1)
    const hit = (p, q, m = 0) => p.l < q.r + m && p.r > q.l - m && p.t < q.b + m && p.b > q.t - m
    // ── orbs and dots, from draw()'s own formulas (see the header) ──
    const scale = W / a.cam.vw, nodeK = Math.max(0.4, Math.min(1, a.cam.vw / (a.graphW * 0.5))), kLOD = a._lodK == null ? 1 : a._lodK
    const LY = a._LY || ((n) => n.y), rsOk = a._rulesetMask()
    const hand = new Set(a.optionIdxs || []); if (focus >= 0) { hand.add(focus); if (fn.pi >= 0) hand.add(fn.pi) }
    const orbs = []
    for (const n of a.nodes) {
      if (!rsOk[n.idx]) continue
      let rr = n.r, aK = 1
      if (n.z) { if (n.rep) rr = n.rSite + (n.r - n.rSite) * kLOD; else { aK = kLOD; if (aK < 0.02) continue } }
      const f = n.ty === "submissions" ? 1.242 : n.ty === "positions" ? 1 : 1.18
      const R = rr * nodeK * f * scale
      const x = (n.x - a.cam.cx) * scale + W / 2, y = (LY(n) - a.cam.cy) * scale + H / 2
      if (x < -R || x > W + R || y < -R || y > H + R) continue
      orbs.push({ idx: n.idx, pi: n.pi, x, y, R, hand: hand.has(n.idx) })
    }
    const seals = (a._lastMapSeals || []).map((s) => ({ ...s }))
    const circ = (b, c, R) => { const dx = Math.max(b.l - c.x, 0, c.x - b.r), dy = Math.max(b.t - c.y, 0, c.y - b.b); return dx * dx + dy * dy < R * R }
    // ── the counts ──
    const out = { written: { position: 0, move: 0, other: 0 }, overlaps: 0, near: 0, cut: 0, trimmed: 0, under: 0, crossOrb: 0, crossSeal: 0, crossBg: 0, faults: [] }
    for (const L of labels) out.written[L.kind === "position" ? "position" : /move/.test(L.kind) ? "move" : "other"]++
    for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) {
      const p = labels[i], q = labels[j]
      if (hit(p.box, q.box)) { out.overlaps++; out.faults.push(["overlap", p.text, q.text]) }
      else if (hit(p.box, q.box, 6)) out.near++
    }
    for (const L of labels) {
      const own = (o) => L.idx != null && (o.idx === L.idx || o.idx === (a.nodes[L.idx] || {}).pi)
      if (L.box.l < 0 || L.box.t < 0 || L.box.r > W || L.box.b > H) { out.cut++; out.faults.push(["cut", L.text, [L.box.l | 0, L.box.t | 0, L.box.r | 0, L.box.b | 0]]) }
      if (L.trimmed) out.trimmed++
      const over = painted.filter((p) => hit(L.box, p) && !(p.star && L.kind === "position"))
      if (over.length) { out.under++; out.faults.push(["under", L.text, over.slice(0, 3).map((p) => p.what)]) }
      if (orbs.some((o) => o.hand && !own(o) && circ(L.box, o, o.R))) { out.crossOrb++; out.faults.push(["crossOrb", L.text]) }
      if (seals.some((s) => !own(s) && circ(L.box, s, s.r))) { out.crossSeal++; out.faults.push(["crossSeal", L.text]) }
      if (orbs.some((o) => !o.hand && !own(o) && circ(L.box, o, o.R))) out.crossBg++
    }
    out.hand = (a.optionIdxs || []).length
    out.jump = jump; out.rest1 = rest1
    out.inView = (a.optionIdxs || []).filter((i) => orbs.some((o) => o.idx === i && o.x > 0 && o.x < W && o.y > 0 && o.y < H)).length
    // ...and in the FREE map: the orb's centre on the canvas and under no painted control (what a name could be written beside)
    out.inMap = (a.optionIdxs || []).filter((i) => orbs.some((o) => o.idx === i && o.x > 0 && o.x < W && o.y > 0 && o.y < H && !painted.some((p) => o.x >= p.l && o.x <= p.r && o.y >= p.t && o.y <= p.b))).length
    out.labels = labels.map((L) => [L.kind, L.text, Math.round(L.box.l), Math.round(L.box.t), Math.round(L.box.r), Math.round(L.box.b)])
    out.cam = { cx: a.cam.cx, cy: a.cam.cy, vw: a.cam.vw }
    return out
  })
}

async function boot(browser, vp) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: vp.mobile, hasTouch: vp.mobile, deviceScaleFactor: 1 })
  const page = await ctx.newPage(), errors = []
  page.on("pageerror", (e) => errors.push(e.message))
  await page.addInitScript(instrument)
  await page.route("**/*", (r) => {
    const u = r.request().url()
    if (/^(http:\/\/localhost|http:\/\/127\.|data:|blob:|about:)/.test(u)) {
      if (APP_FILES) { const p = new URL(u).pathname; const f = path.basename(p); if (p === "/static/neural/app/" + f && APP_FILES.has(f)) return r.fulfill({ path: path.join(APP, f), contentType: f.endsWith(".css") ? "text/css" : "text/javascript" }) }
      if (/\/static\/neural\/content\/[^/]+\.json$/.test(u)) return r.fulfill({ body: "{}", contentType: "application/json" })
      return r.continue()
    }
    if (/fonts\.(googleapis|gstatic)\.com/.test(u)) return r.fulfill({ status: 200, contentType: "text/css", body: "" })
    return r.abort()
  })
  await page.goto(BASE + "/?ngb=1", { waitUntil: "commit" })
  await page.waitForFunction(() => { const a = window.__neural; return !!(a && a.nodes && a.nodes.length && typeof a.advance === "function" && a.flashcards && a.flashcards.decks) }, null, { timeout: 120000 })
  await page.evaluate(() => { const a = window.__neural; if (a.TUTORIAL) { a.tut = { done: {} }; for (const s of a.TUTORIAL) a.tut.done[s.id] = 1; a._syncWhiteChallengeCompatibility(Date.now()); a.tutHidden = true; a.renderTutorial() } })
  return { ctx, page, errors }
}

/** Seat the roll at `t`/`role` the way the journeys do (rigStart + the rigged draws), then let the hand and camera settle. */
async function seat(page, s, first) {
  await page.evaluate(([t, role, first]) => {
    const a = window.__neural
    a.rig("ai-skill", [0.5]); a.rig("role", [role === "bottom" ? 0.9 : 0]); a.rig("max-moves", [0.5])
    const idx = a.nodes.findIndex((n) => n.ty === "positions" && n.t === t); if (idx < 0) throw new Error("no " + t)
    a.rigStart(idx)
    if (!first) a.startRoll()
  }, [s.t, s.role, first])
  for (let i = 0; i < 20; i++) {
    await page.evaluate(() => window.__neural.advance(1000))
    const ok = await page.evaluate(() => { const a = window.__neural; return (a.optionIdxs || []).length > 0 && a._arriveGlideUntil == null && !a.pulse })
    if (ok) break
  }
  // the camera eases in for ~1.5 s after the hand; give it 3 s, then close any toast a test rail's tutorial skip raised
  await page.evaluate(() => window.__neural.advance(3000))
  await page.evaluate(() => { for (const b of document.querySelectorAll("[data-reward] button")) if (/close|dismiss|×|✕/i.test(b.getAttribute("aria-label") || b.textContent || "")) b.click(); document.querySelectorAll("[data-reward]").forEach((e) => e.remove()) })
  // the arrival heading (a DOM block) fades on the WALL clock: let it finish, as it does for a player
  await sleep(1600)
  await page.evaluate(() => window.__neural.advance(200))
  return page.evaluate(() => { const a = window.__neural, n = a.nodes[a.currentPos]; return { at: n.t, role: a.playerRole, id: n.id } })
}

/** Pull the camera back `f` times about the position, through the app's own wheel handler. */
async function zoomOut(page, f, cam0) {
  await page.evaluate(([f, cam0]) => {
    const a = window.__neural
    Object.assign(a.cam, cam0, { lvw: Math.log(cam0.vw) }); Object.assign(a.camTarget, cam0)
    a.advance(17); a.advance(520)   // settled at the usual zoom (half a second: a name the restore dropped waits that long)
    if (f === 1) return
    const fi = a.focusIdx, n = a.nodes[fi], m = a.pairMid(n), scale = a.W / a.cam.vw
    const r = a.canvas.getBoundingClientRect()
    const sx = (m.x - a.cam.cx) * scale + a.W / 2 + r.left, sy = (m.y - a.cam.cy) * scale + a.H / 2 + r.top
    a.canvas.dispatchEvent(new WheelEvent("wheel", { deltaY: Math.log(f) / 0.0012, clientX: sx, clientY: sy, bubbles: true, cancelable: true }))
  }, [f, cam0])
}

async function setDrawer(page, open) {
  const shown = await page.evaluate(() => !!window.__neural.deckShown)
  if (shown === open) return true
  const box = await page.evaluate(() => { const b = document.querySelector(".ng-logo"); if (!b || b.style.visibility === "hidden") return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })
  if (box) await page.mouse.click(box.x, box.y)
  else await page.evaluate((open) => window.__neural.setDeckOpen ? window.__neural.setDeckOpen(open) : null, open)
  for (let i = 0; i < 20; i++) { await page.evaluate(() => window.__neural.advance(100)); await sleep(30) }
  return page.evaluate(() => !!window.__neural.deckShown)
}

const browser = await chromium.launch()
const result = { when: new Date().toISOString(), base: BASE, app: APP, seats: SEATS, cases: [] }
const t0 = Date.now()
for (const vp of VPS) {
  const { ctx, page, errors } = await boot(browser, vp)
  let first = true
  for (const s of SEATS) {
    let at
    try { at = await seat(page, s, first) } catch (e) { result.cases.push({ vp: vp.w + "x" + vp.h, seat: s.t + "/" + s.role, error: String(e).slice(0, 200) }); continue }
    first = false
    const settled = await page.evaluate(() => { const c = window.__neural.cam; return { cx: c.cx, cy: c.cy, vw: c.vw } })
    for (const drawer of DRAWERS) {
      await page.evaluate((c) => { const a = window.__neural; Object.assign(a.cam, c, { lvw: Math.log(c.vw) }); Object.assign(a.camTarget, c); a.advance(17) }, settled)
      const okDrawer = await setDrawer(page, drawer === "open")
      const cam0 = await page.evaluate(() => { const c = window.__neural.cam; return { cx: c.cx, cy: c.cy, vw: c.vw } })
      for (const f of ZOOMS) {
        await zoomOut(page, f, cam0)
        const m = await measure(page)
        result.cases.push({ vp: vp.w + "x" + vp.h, seat: s.t + "/" + s.role, at: at.at + "/" + at.role, drawer, drawerOk: okDrawer, zoom: f, ...m })
      }
    }
    await setDrawer(page, false)
    process.stdout.write(".")
  }
  result.errors = (result.errors || []).concat(errors.map((e) => vp.w + ": " + e))
  await ctx.close()
  console.log(" " + vp.w + "x" + vp.h + " done at " + ((Date.now() - t0) / 1000 | 0) + "s")
}
await browser.close()

// ── the table ──
const rows = new Map()
for (const c of result.cases) {
  if (c.error) continue
  const k = c.vp + " " + c.drawer + " x" + c.zoom
  const r = rows.get(k) || { cases: 0, jumpNames: 0, rest1Names: 0, positionNames: 0, moveNames: 0, otherNames: 0, overlaps: 0, near: 0, cut: 0, trimmed: 0, under: 0, crossOrb: 0, crossSeal: 0, crossBg: 0, inView: 0, inMap: 0, hand: 0 }
  r.cases++; r.jumpNames += c.jump || 0; r.rest1Names += c.rest1 || 0; r.positionNames += c.written.position; r.moveNames += c.written.move; r.otherNames += c.written.other
  for (const f of ["overlaps", "near", "cut", "trimmed", "under", "crossOrb", "crossSeal", "crossBg", "inView", "inMap", "hand"]) r[f] += c[f]
  rows.set(k, r)
}
result.table = Object.fromEntries(rows)
fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true })
fs.writeFileSync(OUT, JSON.stringify(result, null, 1))
console.log("case (counts on the frame SETTLED, half a second at rest after the wheel; jumpN the wheel's own frame, rest1N the first frame at rest)   n  posN moveN othN jumpN rest1N | overlap near  cut trim under | xOrb xSeal  xBg | inView inMap hand")
for (const [k, r] of rows) console.log(k.padEnd(24), String(r.cases).padStart(2), String(r.positionNames).padStart(5), String(r.moveNames).padStart(5), String(r.otherNames).padStart(4), String(r.jumpNames).padStart(5), String(r.rest1Names).padStart(6), "|", String(r.overlaps).padStart(7), String(r.near).padStart(4), String(r.cut).padStart(4), String(r.trimmed).padStart(4), String(r.under).padStart(5), "|", String(r.crossOrb).padStart(4), String(r.crossSeal).padStart(5), String(r.crossBg).padStart(4), "|", String(r.inView).padStart(6), String(r.inMap).padStart(5), String(r.hand).padStart(4))
console.log("errors:", (result.errors || []).length, "failed seats:", result.cases.filter((c) => c.error).length)
