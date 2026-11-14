import { expect, test, type Page } from "@playwright/test"
import { journey } from "../dsl"

/** NAMES ON THE MAP NEVER SIT ON EACH OTHER, ARE NEVER CUT BY THE SCREEN, NEVER RUN UNDER A CONTROL (v1.275.0).
 *
 * The owner, 13 Nov 2026, looking at the map pulled back: "dunno why in the graph there are many techniques showing but
 * they are unreadable like this you know, when they overlap, avoid that pls". Until v1.275.0 every dealt move within 60 px
 * of the screen was named at one fixed place and nothing tested a name against another name, the screen's edge or a
 * control; the rule now (`_planNames`, app.src.jsx): a name is written only where it can be read, in order of claim
 * (the position's own label, then what the pointer is on, then the names already written, then the rest in the row's
 * order), each at the first of eight places beside its orb that clears every name, control, the edge and the other
 * dealt orbs; a name already written keeps its place down to 3 px of air, a new one needs 6.
 *
 * WHAT IS READ: what the frame PUBLISHED (`_lastNameBoxes`, every ink box it wrote, in order of claim; `_lastOptLabels`;
 * `_lastHoverLabel` / `_lastPairLabel`; `_LY`, `_nodeK`, `_lodK`), never the rule recomputed (CLAUDE.md §6.3). "Under a
 * control" is NOT the app's own list of controls (`_nameBlocks`): it is every PAINTED element of the app's root over the
 * box (text by its own line boxes, an element with a background, border, image or icon by its box), each cut by its
 * clipping ancestors — the browser's layout, measured here, so the app's list cannot agree with itself by construction.
 * The camera moves the way the app's zoom does: a `wheel` on the canvas at the position's drawn point (the handler zooms
 * about the pointer), from the follow camera's settled framing.
 *
 * MUTANTS, each one exact replacement in app.src.jsx, rebuilt and this spec run in full (27 runs after R1, 13 Nov 20:17;
 * after R2, 13 Nov 22:18 to 22:45, the eleven whose assertion or anchor moved, M8 M17 M19 M21 to M28):
 *   M1  the test removed (`fits` always true)              red, first at "the wheel's frame: no name off the map"
 *   M2  the order of claim reversed                        red at "the moves claimed their room in the row's order"
 *   M3  the edge check removed                             red at "no name off the map"
 *   M4  the pointer's single label dropped                 red at "merged: the orb under the mouse is named by the single label"
 *   M4c both pointer labels dropped                        red at "the orb under the mouse is named"
 *   M5  `n.y` for `LY(n)` (a move's anchor)                red at "every name starts just beyond its own orb's drawn width"
 *   M6  widths from `n.r * scale`, not `halfW`             red at the same assertion
 *   M7  what is acted on not first                         red at "the card under the mouse names its orb", "the map names
 *                                                          the card just turned up" (R1 finding 8: the card is picked at rest)
 *   M8  written names treated as new (no incumbency)       red at "while the camera moves a written name keeps its place"
 *   M9  the controls ignored                               red at "no name under a control"
 *   M10 no plan reused                                     red at "60 held frames reuse one plan"
 *   M11 names under the phone's open drawer                red at "nothing is written on the map under the drawer"
 *   M12 other dealt orbs ignored                           red at "no move's name across another dealt orb"
 *   M14 nothing dealt at rest                              red at "the camera rests (new names are dealt)"
 *   M15 a pointed-at node not acted on (R1 finding 4)      red at "the located node ... is named, though a dealt orb crowds it"
 *   M16 names inked at the old fixed place (finding 6)     red at "every name is inked where it is published"
 *   M17 the off-canvas cull back to dev's (finding 5)      red at "no name for an orb drawn off the canvas"
 *   M18 "still" per frame, not per second (finding 9)      red at "the frame calls the camera moving or at rest per second"
 *   M19 a face-down move's partner lit (finding 10)        red at "the hidden move's name ... is never inked"
 *   M20 the room check removed for new names (finding 2,   red at "every named orb stands clear of every other dealt orb"
 *       the reader's surviving mutant)
 *   M21 a pan not counted as motion (the zoom-only rule)   red at "the drag moved the camera on (almost) every frame": the
 *                                                          frame calls a pure pan rest
 *   M22 a written name may change side while moving        red at "while the camera moves a written name keeps its place"
 *   M23 no half-second wait at rest                        red at "ease at 120 Hz: a name the layout refused is back no sooner
 *                                                          than half a second after it left"
 *   M24 a name that left may come back while moving        red at "a name the layout refused comes back only at rest" (the
 *                                                          ease and the drag)
 *   M25 a returning name given -20 px of air (R2 D1)       red at "Mount Top (top) x2, settled: no two names closer than 3 px"
 *   M26 a refused name's wait cleared when its orb         red at "the drag: a name the layout refused comes back only at rest"
 *       leaves the canvas (R2 D2)
 *   M27 a lit node under the pointer named again (R2 D3)   red at "the located node under the mouse is inked once"
 *   M28 an orb wholly under a control or the open drawer   red at "no name for an orb under the drawer's paint, while dragging
 *       a candidate again (`on(c)` as in R1; R2 D4)        under it" and the main drag's "...or under paint that hides it"
 *                                                          (an orb slid under the row); the drawer test's audits at rest
 *                                                          pass under it (no fresh-booted camera leaves an orb under the
 *                                                          drawer: the drag in that test is what reaches the case)
 *   CACHE414 (13-14 Nov, the whole file each, on the built bundle; `_hides`' store and the paint rule):
 *   C1  no cache (the store remade on every ask)           red at "a held camera: zero _hides box or style reads after its
 *                                                          first frame"
 *   C2  the row's scroll out of the store's key            red at "scrolled to the gap: within two frames the planner is
 *                                                          offered exactly the dealt orbs the browser shows"
 *   C3  no expiry (the store's and the answer's)           red at "an answer older than half a second (frame clock) is
 *                                                          asked again"
 *   C4  the paint threshold 0.72                           red at "a control painted rgba(30, 32, 52, 0.6) over ...: the orb
 *                                                          is hidden (not offered)"
 *   C5  the paint threshold 0.3                            red at "...rgba(30, 32, 52, 0.4) ...: the orb is shown (offered)"
 *   C6  the old colour parse (any colour's fourth number)  red at "...color(display-p3 0.12 0.13 0.2) ...: the orb is hidden"
 *   N4  every control's box treated as opaque              red at "...: the planner is offered exactly the dealt orbs the
 *   N5  every control's box treated as transparent         browser shows" (6 and 7 tests)
 * NON-KILLS, so nobody reads them as covered: C1b, the ANSWERS not kept while the store's element memo still is, reads
 * nothing and only costs time (no spec times a frame; tests/artifacts' frame-time script does); M4b, the pointer's PAIR GROUP alone dropped, is the designed fallback (the
 * single label names the orb instead); M8b, a written name needing 6 px like a new one, changes nothing these recordings
 * see (the camera rule and the reused plan hold the names; the stay margin only decides a name between 3 and 6 px of a
 * neighbour at rest); M13, the rest flag dropped from the plan's key, is EQUIVALENT under the pan rule (ii): a moving frame
 * already admits newcomers, so its plan is complete at rest but for names in their half-second wait, and those waits are
 * counted in the key, so the plan is redone the moment one ends.
 * Table and run times in docs/Changelog-Archive.md (v1.275.0).
 */

type W = any
const NO_GAP = 3   // the air a written name keeps (`_planNames`: 3 to keep a place, 6 to take one)

/** THE INK (R1 finding 6): every string the map canvas's `fillText` writes in the frame since its full clear, with the box
 *  the browser measures for it there, so a published name box can be held against what was actually inked. */
const inkHook = () => {
  const w = window as W; if (w.__mnInkHooked) return; w.__mnInkHooked = true
  const proto = CanvasRenderingContext2D.prototype, fill = proto.fillRect, text = proto.fillText
  proto.fillRect = function (x: number, y: number, ww: number, hh: number) { const a = w.__neural; if (a && this === a.ctx && x === 0 && y === 0 && ww === a.W && hh === a.H) w.__mnInk = []; return fill.call(this, x, y, ww, hh) }
  proto.fillText = function (s: string, x: number, y: number, ...rest: W[]) {
    const a = w.__neural
    if (a && this === a.ctx && w.__mnInk) {
      const m = this.measureText(String(s)), t = this.getTransform(), d = a.dpr || 1, X = (t.a * x + t.e) / d, Y = (t.d * y + t.f) / d, k = t.a / d
      w.__mnInk.push({ s: String(s), l: X - m.actualBoundingBoxLeft * k, r: X + m.actualBoundingBoxRight * k, t: Y - m.actualBoundingBoxAscent * k, b: Y + m.actualBoundingBoxDescent * k })
    }
    return (text as W).call(this, s, x, y, ...rest)
  }
}

/** Seat the roll at `title`, side `role`, the way `land()` does (rigged start and draws), and let the camera settle. */
async function seat(page: Page, title: string, role: "top" | "bottom", initialState?: Record<string, unknown>) {
  const j = journey(page)
  await page.addInitScript(inkHook)
  await j.boot("/", initialState ? { initialState } : {})
  await j.rig("ai-skill", [0.5]); await j.rig("role", [role === "bottom" ? 0.9 : 0]); await j.rig("max-moves", [0.5])
  await page.evaluate((t) => { const a = (window as W).__neural; a.rigStart(a.nodes.findIndex((n: W) => n.ty === "positions" && n.t === t)) }, title)
  for (let i = 0; i < 16; i++) {
    await j.advance(1000)
    if (await page.evaluate(() => { const a = (window as W).__neural; return (a.optionIdxs || []).length > 0 && a._arriveGlideUntil == null })) break
  }
  await j.landQuestion()
  await j.engage()
  await j.advance(3000)   // the follow camera settles on the seat
  // NOT SERVED AS A PLAYER SEES IT, so put right: the arrival's centre block fades on the WALL clock (NG_ARRIVE_HANDOFF,
  // a CSS transition) while this harness pumps the game clock, so wait for the fade a player's eye would have seen end;
  // and the badge toast the DSL's tutorial skip raises (White Foundations) is not part of the map: removed.
  await expect.poll(() => page.evaluate(() => +getComputedStyle((window as W).__neural.evCenterRef.current).opacity), { message: "the arrival heading has faded" }).toBeLessThan(0.05)
  await page.evaluate(() => { document.querySelectorAll("[data-reward]").forEach((e) => e.remove()); (window as W).__neural._handTouched = true })   // the row keeps its order (no re-sort when win chances land)
  await j.advance(34)
  expect(await page.evaluate(() => { const a = (window as W).__neural, n = a.nodes[a.currentPos]; return n.t + "/" + a.playerRole }), "seated where asked").toBe(title + "/" + role)
  return j
}

/** The settled camera, and a pull back `f` times through the app's own wheel handler, about the position's drawn point. */
const camOf = (page: Page) => page.evaluate(() => { const c = (window as W).__neural.cam; return { cx: c.cx, cy: c.cy, vw: c.vw } })
async function pullBack(page: Page, f: number, cam0: { cx: number; cy: number; vw: number }, rest = true) {
  await page.evaluate(([f, c]) => {
    const a = (window as W).__neural
    Object.assign(a.cam, c, { lvw: Math.log(c.vw) }); Object.assign(a.camTarget, c); a.advance(17)
    if (f === 1) return
    const m = a.pairMid(a.nodes[a.focusIdx]), s = a.W / a.cam.vw, r = a.canvas.getBoundingClientRect()
    a.canvas.dispatchEvent(new WheelEvent("wheel", { deltaY: Math.log(f) / 0.0012, clientX: (m.x - a.cam.cx) * s + a.W / 2 + r.left, clientY: (m.y - a.cam.cy) * s + a.H / 2 + r.top, bubbles: true, cancelable: true }))
  }, [f, cam0] as const)
  // TWO DRAWN FRAMES: `advance(ms)` simulates every tick but draws ONCE, at its end, so one advance after the wheel is
  // the frame of the jump (names only leave while the zoom moves) and the second is the camera at rest, where they are
  // dealt. A single advance(34) here measured the jump frame (Q410A, the orchestrator's read of picture 06).
  await journey(page).advance(17)
  if (rest) await journey(page).advance(17)
}

/** The next drawn frame's move pass, as the planner itself ran it, and every refused move that the REAL planner, asked
 *  alone against that frame's final names (the same controls, orbs and edge), would have written: at rest there must be
 *  none, or a free place was left unused (Q410A: "a rested camera names every dealt orb that has a free place"). */
const unusedRoom = (page: Page) => page.evaluate(() => {
  const a = (window as W).__neural, proto = Object.getPrototypeOf(a)
  let s: W = null
  const was = Object.prototype.hasOwnProperty.call(a, "_planNames") ? a._planNames : null   // a watcher (`watchCands`) stays
  a._planNames = function (pass: string, ctx: W, cands: W[], claims: W[], orbs: W[], sig: string, admit: boolean, A: W) {
    const plan = (was || proto._planNames).call(this, pass, ctx, cands, claims, orbs, sig, admit, A)
    if (pass === "move") s = { ctx, cands, claims: claims.slice(), orbs, A, admit, plan }
    return plan
  }
  try { a.advance(17) } finally { if (was) a._planNames = was; else delete a._planNames }
  if (!s) return { admit: null, written: 0, refused: 0, missed: [] as string[] }
  const missed: string[] = []
  let k = 0
  for (const c of s.cands) {
    if (s.plan.has(c.i)) continue
    const p = proto._planNames.call(a, "probe", s.ctx, [{ ...c, act: false }], s.claims.slice(), s.orbs, "probe:" + k++, true, s.A)
    delete a._nm.probe
    if (p.has(c.i)) missed.push(a.graphName(c.n))
  }
  return { admit: s.admit, written: s.plan.size, refused: s.cands.length - s.plan.size, missed }
})

/** One frame's names, as published, with what lies over each (see the header: the browser's painted boxes). */
const audit = (page: Page) => page.evaluate((NO_GAP) => {
  const a = (window as W).__neural, W_ = a.W, H_ = a.H, root = a.__ngRoot || a.wrapRef.current, cv = a.canvas, cr = cv.getBoundingClientRect()
  const boxes = (a._lastNameBoxes || []).map((b: W) => ({ ...b }))
  const labels = boxes.filter((b: W) => b.w !== "star")
  // painted elements over the map (canvas px), each cut by its clipping ancestors
  const clips = new Map<Element, W>()
  const clipOf = (el: Element | null): W => {
    if (!el || el === root || el === document.documentElement) return { l: -1e9, t: -1e9, r: 1e9, b: 1e9 }
    if (clips.has(el)) return clips.get(el)
    const up = clipOf(el.parentElement), cs = getComputedStyle(el)
    let c = up
    if (cs.overflowX !== "visible" || cs.overflowY !== "visible") { const r = el.getBoundingClientRect(); c = { l: Math.max(up.l, r.left), t: Math.max(up.t, r.top), r: Math.min(up.r, r.right), b: Math.min(up.b, r.bottom) } }
    clips.set(el, c); return c
  }
  const eff = (el: Element) => { let o = 1; for (let q: Element | null = el; q && q !== document.documentElement; q = q.parentElement) { const cs = getComputedStyle(q); if (cs.display === "none" || cs.visibility === "hidden") return 0; o *= +cs.opacity } return o }
  const painted: W[] = [], covers: W[] = []
  const put = (r: DOMRect, el: Element, what: string) => {
    const c = clipOf(el), l = Math.max(r.left, c.l) - cr.left, t = Math.max(r.top, c.t) - cr.top, rr = Math.min(r.right, c.r) - cr.left, b = Math.min(r.bottom, c.b) - cr.top
    if (rr - l >= 2 && b - t >= 2) painted.push({ l, t, r: rr, b, what, star: !!el.closest("[data-seat-star]") })
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT)
  for (let node: Node | null = walker.currentNode; node; node = walker.nextNode()) {
    if (node === cv || node === root || node.contains(cv)) continue
    const el = (node.nodeType === 3 ? node.parentElement : node) as Element
    if (!el || el.compareDocumentPosition(cv) & Node.DOCUMENT_POSITION_FOLLOWING) continue   // before the canvas: under it
    if (node.nodeType === 3) {
      if (!node.textContent!.trim() || eff(el) < 0.05) continue
      const rg = document.createRange(); rg.selectNodeContents(node)
      for (const r of rg.getClientRects()) put(r, el, "text:" + node.textContent!.trim().slice(0, 20))
      continue
    }
    const cs = getComputedStyle(el), r = el.getBoundingClientRect()
    if (!(r.width > 0 && r.height > 0)) continue
    const bg = !/rgba\([^)]*,\s*0\)$/.test(cs.backgroundColor) && cs.backgroundColor !== "transparent"
    const bd = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderLeftWidth) > 0 && !/rgba\([^)]*,\s*0\)$/.test(cs.borderTopColor)
    const media = /^(IMG|svg|VIDEO|CANVAS|INPUT|SELECT|TEXTAREA)$/i.test(el.tagName) || cs.backgroundImage !== "none"
    if ((bg || bd || media) && eff(el) >= 0.05) put(r, el, el.tagName + "." + String(el.className).split(" ")[0])
    // PAINT THAT HIDES AN ORB (v1.277.0): a background colour at alpha x effective opacity of 0.5 or more, a background
    // image or gradient, a backdrop filter, an image, video or canvas; never text, a border or a line icon (svg)
    // a colour's alpha after its slash (`color(display-p3 r g b / a)`), else rgba's fourth argument, else opaque (CACHE414)
    const bgc = cs.backgroundColor, j = bgc.lastIndexOf("/"), e = eff(el)
    const al = j > 0 ? parseFloat(bgc.slice(j + 1)) / (bgc.endsWith("%)") ? 100 : 1) : /^rgba\(/.test(bgc) ? parseFloat(bgc.split(",")[3]) : bgc === "transparent" ? 0 : 1
    if ((al * e >= 0.5 || (e >= 0.05 && (cs.backgroundImage !== "none" || (cs.backdropFilter || "none") !== "none" || /^(IMG|VIDEO|CANVAS)$/.test(el.tagName))))) {
      const c = clipOf(el); covers.push({ l: Math.max(r.left, c.l) - cr.left, t: Math.max(r.top, c.t) - cr.top, r: Math.min(r.right, c.r) - cr.left, b: Math.min(r.bottom, c.b) - cr.top, what: el.tagName + "." + String(el.className).split(" ")[0] })
    }
  }
  const hit = (p: W, q: W, m = 0) => p.l < q.r + m && p.r > q.l - m && p.t < q.b + m && p.b > q.t - m
  const close: string[] = [], outside: string[] = [], under: string[] = []
  const name = (b: W) => b.w + ":" + (a.nodes[b.i] ? a.graphName(a.nodes[b.i]) : b.i)
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const p = boxes[i], q = boxes[j]
    if (p.g !== q.g && hit(p, q, NO_GAP - 0.01)) close.push(name(p) + " ~ " + name(q))
  }
  for (const b of labels) {
    if (b.l < 0 || b.t < 0 || b.r > W_ || b.b > H_) outside.push(name(b) + " [" + [b.l, b.t, b.r, b.b].map(Math.round) + "]")
    const over = painted.filter((p) => hit(b, p) && !(p.star && (b.w === "position" || b.w === "hover")))
    if (over.length) under.push(name(b) + " under " + over.slice(0, 2).map((p) => p.what).join(", "))
  }
  // a move's name across ANOTHER dealt orb (or the position's pair), as the frame drew it: the silhouette from the app's own
  // `_nodeHalfW` (bare) with the frame's published `_nodeK` / `_lodK`, at `_LY`; a pair's twin counts once split (`_lodK` 0.5)
  const s = W_ / a.cam.vw, f = a.focusIdx, hand = new Set((a.optionIdxs || []).concat(f >= 0 ? [f, a.nodes[f].pi] : []))
  const orbs = [...hand].map((i: number) => a.nodes[i]).filter((n: W) => n && !(n.z && !n.rep && a._lodK < 0.5))
    .map((n: W) => ({ i: n.idx, x: (n.x - a.cam.cx) * s + W_ / 2, y: (a._LY(n) - a.cam.cy) * s + H_ / 2, R: a._nodeHalfW(n, s, a._nodeK, a._lodK, true) }))
  const crossing: string[] = [], offOrb: string[] = [], hidOrb: string[] = [], inkOff: string[] = [], crowded: string[] = [], gaps: number[] = []
  const ink = (window as W).__mnInk || []
  for (const b of labels.filter((b: W) => b.w === "move" || b.w === "lit" || b.w === "point")) {
    const node = a.nodes[b.i], x = (node.x - a.cam.cx) * s + W_ / 2, y = (a._LY(node) - a.cam.cy) * s + H_ / 2, R = a._nodeHalfW(node, s, a._nodeK, a._lodK, true)
    // R1 finding 5: a name only for an orb whose own silhouette is on the canvas
    if (x + R < 0 || x - R > W_ || y + R < 0 || y - R > H_) offOrb.push(name(b) + ` (orb at ${x.toFixed(0)}, ${y.toFixed(0)})`)
    // R2 D4: ...nor for an orb whose silhouette lies wholly under paint that hides it (an open drawer, a card; v1.277.0: a
    // see-through box, text or a line icon hides nothing): no visible orb
    const over = covers.find((p) => p.l <= Math.max(0, x - R) && p.r >= Math.min(W_, x + R) && p.t <= Math.max(0, y - R) && p.b >= Math.min(H_, y + R))
    if (over) hidOrb.push(name(b) + ` (orb at ${x.toFixed(0)}, ${y.toFixed(0)} under ${over.what})`)
    // R1 finding 6: the name is INKED where it is published (the browser's own box for that fillText, within half a pixel)
    const s2 = a.graphName(node)
    if (!ink.some((q: W) => q.s === s2 && Math.abs(q.l - b.l) < 0.5 && Math.abs(q.r - b.r) < 0.5 && Math.abs(q.t - b.t) < 0.5 && Math.abs(q.b - b.b) < 0.5)) inkOff.push(name(b))
    if (b.w === "point") continue   // a node the player was pointed at may, as a last resort, cross an orb
    let gap = 1e9
    for (const o of orbs) {
      if (o.i === b.i || o.i === node.pi) continue
      const dx = Math.max(b.l - o.x, 0, o.x - b.r), dy = Math.max(b.t - o.y, 0, o.y - b.b)
      if (dx * dx + dy * dy < o.R * o.R) crossing.push(name(b) + " across " + a.graphName(a.nodes[o.i]))
      gap = Math.min(gap, Math.hypot(o.x - x, o.y - y) - o.R - R)
    }
    // a name belongs to ONE orb: its orb stands clear of every other dealt orb (3 px for a name kept, 6 for a new one)
    if (b.w === "move") { gaps.push(gap); if (gap < 3 - 0.01) crowded.push(name(b) + ` (${gap.toFixed(1)} px)`) }
  }
  // hidden: what shows of the orb (its silhouette box cut to the canvas) lies wholly under one box of paint that hides it
  const hid = (o: W) => covers.some((p) => p.l <= Math.max(0, o.x - o.R) && p.r >= Math.min(W_, o.x + o.R) && p.t <= Math.max(0, o.y - o.R) && p.b >= Math.min(H_, o.y + o.R))
  const hidden = orbs.filter(hid).length, hiddenIdx = orbs.filter(hid).map((o: W) => o.i)
  // THE PLANNER IS OFFERED EXACTLY THE DEALT ORBS THE BROWSER SHOWS (v1.277.0, NEXT1 part 2; set equality, §6.3): on the
  // canvas and under no paint that hides it, against the moves the frame handed `_planNames` (`watchCands`), each way
  const cands = a.__mnCands as number[] | undefined   // `watchCands` records on the app instance
  let seen: string[] | null = null, thru = 0
  if (cands) {
    seen = []
    // ...and how many of the orbs shown sit wholly inside a control's box (`_nameBlocks`, read only to count): the
    // see-through cases, which a box alone used to hide (so the claim above had them to judge)
    const B = a._nameBlocks().blocks
    thru = orbs.filter((o: W) => (a.optionIdxs || []).includes(o.i) && !hid(o) && B.some((q: W) => q.l <= Math.max(0, o.x - o.R) && q.r >= Math.min(W_, o.x + o.R) && q.t <= Math.max(0, o.y - o.R) && q.b >= Math.min(H_, o.y + o.R))).length
    for (const o of orbs.filter((o: W) => (a.optionIdxs || []).includes(o.i))) {
      const shown = o.x + o.R > 0 && o.x - o.R < W_ && o.y + o.R > 0 && o.y - o.R < H_ && !hid(o)
      if (shown !== cands.includes(o.i)) seen.push(`${a.graphName(a.nodes[o.i])} (${o.x.toFixed(0)}, ${o.y.toFixed(0)}): ${shown ? "shown, not offered" : "hidden, offered"}`)
    }
  }
  return { close, outside, under, crossing, offOrb, hidOrb, hidden, hiddenIdx, seen, thru, inkOff, crowded, gaps, inked: ink.length, moves: labels.filter((b: W) => b.w === "move").length, position: labels.filter((b: W) => b.w === "position").length, W: W_, H: H_ }
}, NO_GAP)

const VPS = [{ width: 390, height: 631, touch: true }, { width: 1440, height: 900, touch: false }]
const SEATS: Array<[string, "top" | "bottom"]> = [["Mount Top", "top"], ["Closed Guard Top", "bottom"], ["Standing Position Top", "top"]]

/** Every layout claim on one audited frame, each its own named assertion. */
function checkFrame(r: W, where: string) {
  expect(r.position, `${where}: the position's own name is written`).toBe(1)
  expect(r.close, `${where}: no two names closer than ${NO_GAP} px`).toEqual([])
  expect(r.outside, `${where}: no name off the map`).toEqual([])
  expect(r.under, `${where}: no name under a control`).toEqual([])
  expect(r.crossing, `${where}: no move's name across another dealt orb`).toEqual([])
  expect(r.offOrb, `${where}: no name for an orb drawn off the canvas`).toEqual([])
  expect(r.hidOrb, `${where}: no name for an orb under paint that hides it`).toEqual([])
  if (r.seen) expect(r.seen, `${where}: the planner is offered exactly the dealt orbs the browser shows`).toEqual([])
  expect(r.inkOff, `${where}: every name is inked where it is published`).toEqual([])
  expect(r.crowded, `${where}: every named orb stands clear of every other dealt orb`).toEqual([])
}

/** Names written frame by frame, with their places, the frame's own call (moving or at rest), its clock (`t`, s) and the
 *  moves it handed the planner (`c`). THE RULE AS RULED (R2 D2): a name the LAYOUT refused (its orb still a candidate on the
 *  frame its name left) comes back only at rest, and no sooner than half a second after it LEFT (timed by the frame clock,
 *  so 30 Hz and 120 Hz recordings are judged alike); a name whose orb left the canvas, or went under a control, follows the
 *  orb back and is only counted; while the camera moves a written name keeps its place. */
type Frame = { still: boolean; t: number; c: number[]; on: Array<[number, number]> }
function holdCheck(rec: Frame[], where: string) {
  const back: string[] = [], side: string[] = [], flick: string[] = []
  const refused = new Map<number, number>(), followed = new Set<number>(), n = { refused: 0, followed: 0, followedBackMoving: 0 }
  for (let k = 1; k < rec.length; k++) {
    const was = new Map(rec[k - 1].on), now = new Map(rec[k].on), f = rec[k]
    for (const [i, p] of now) {
      if (!was.has(i)) {
        const g = refused.get(i)
        if (g != null) {
          if (!f.still) back.push(`frame ${k}: ${i}, refused at ${g.toFixed(3)} s`)
          if (f.t - g < 0.5 - 1e-6) flick.push(`${i}: refused at ${g.toFixed(3)} s, back at ${f.t.toFixed(3)} s`)
          refused.delete(i)
        } else if (followed.delete(i) && !f.still) n.followedBackMoving++
      } else if (!f.still && was.get(i) !== p) side.push(`frame ${k}: ${i} place ${was.get(i)} -> ${p}`)
    }
    for (const i of was.keys()) if (!now.has(i)) { if (f.c.includes(i)) { refused.set(i, f.t); n.refused++ } else { followed.add(i); n.followed++ } }
    // at rest half a second after it left, a refused name's wait is over: from then on it is a newcomer like any other
    if (f.still) for (const [i, g] of refused) if (f.t - g >= 0.5) refused.delete(i)
  }
  expect(back, `${where}: a name the layout refused comes back only at rest`).toEqual([])
  expect(side, `${where}: while the camera moves a written name keeps its place`).toEqual([])
  expect(flick, `${where}: a name the layout refused is back no sooner than half a second after it left`).toEqual([])
  return n
}

/** From now on, the moves each drawn frame hands the planner (`__mnCands`): the instance's `_planNames` wraps the
 *  prototype's, which still decides; a frame with no move pass hands none. */
const watchCands = (page: Page) => page.evaluate(() => {
  const a = (window as W).__neural, proto = Object.getPrototypeOf(a)
  a._planNames = function (pass: string, ctx: W, cands: W[], ...rest: W[]) { if (pass === "move") a.__mnCands = cands.map((c: W) => c.i); return proto._planNames.call(this, pass, ctx, cands, ...rest) }
})

/** One drawn frame, recorded: the frame's own call (moving or at rest), its clock, the camera, the moves handed the planner,
 *  and the moves' names with their places. */
const recFrame = (page: Page, step = 17) => page.evaluate((step) => {
  const a = (window as W).__neural; a.__mnCands = []; a.advance(step)
  return { still: !!a._camStill, t: a.now, c: a.__mnCands, vw: a.cam.vw, cx: a.cam.cx, cy: a.cam.cy, on: (a._lastNameBoxes || []).filter((b: W) => b.w === "move").map((b: W) => [b.i, b.k]) }
}, step)

for (const vp of VPS) {
  test.describe(`map names ${vp.width}x${vp.height}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch, isMobile: vp.touch })

    test(`no two names closer than ${NO_GAP} px, none off the map, none under a control, and at rest no free place left unused: usual zoom and pulled back 2, 4, 9 times (${vp.width})`, async ({ page }) => {
      test.setTimeout(240_000)
      let written = 0, refused = 0, thru = 0, compared = 0
      for (const [title, role] of SEATS) {
        await seat(page, title, role)
        await watchCands(page)
        const cam0 = await camOf(page)
        for (const f of [1, 2, 4, 9]) {
          const where = `${title} (${role}) x${f}`
          // the wheel's own frame (names only leave while the zoom moves), then the camera at rest (R1 finding 2)
          await pullBack(page, f, cam0, false)
          checkFrame(await audit(page), `${where}, the wheel's frame`)
          await journey(page).advance(17)
          const r = await audit(page)
          checkFrame(r, `${where}, at rest`)
          written += r.moves; thru += r.thru; compared += r.seen ? 1 : 0
          // names the jump dropped wait half a second before they may come back (no blink), so "every orb with a free place
          // is named" is asked once that half second has passed, the camera still at rest
          await journey(page).advance(520)
          const u = await unusedRoom(page)
          expect(u.admit, `${where}: the camera rests (new names are dealt)`).toBe(true)
          expect(u.missed, `${where}: at rest no dealt move with a free place is left unnamed`).toEqual([])
          refused += u.refused
          // ...and that frame, where the names the jump dropped come BACK, holds every claim too (R2 D1: the settled,
          // pulled-back map is the owner's own case; its names are the ones a mutant can misplace while every earlier frame
          // stays clean)
          checkFrame(await audit(page), `${where}, settled`)
        }
      }
      console.log(`[map-names] ${vp.width}: ${written} move names written at rest over 3 seats x 4 zooms`)
      // NON-TRIVIAL: "zero overlaps" is never bought by writing nothing (the floor counts frames AT REST)
      expect(written, `moves are still named at rest: at least ${vp.width < 700 ? 40 : 75} names over the twelve frames`).toBeGreaterThanOrEqual(vp.width < 700 ? 40 : 75)
      expect(refused, "...and some were refused, so the free-place check above had moves to ask about").toBeGreaterThan(0)
      console.log(`[map-names] ${vp.width}: ${thru} orbs shown inside a see-through control's box over ${compared} frames compared`)
      expect(compared, "every frame at rest compared the planner's moves with what the browser shows").toBe(12)
      if (vp.width > 700) expect(thru, "orbs inside a see-through control's box (the table of contents, the row's top strip) were in the frames compared").toBeGreaterThan(0)
    })

    test(`a move's name sits beside its own orb, where the frame drew it (${vp.width})`, async ({ page }) => {
      test.setTimeout(240_000)
      await seat(page, "Standing Position Top", "top")
      const cam0 = await camOf(page)
      let checked = 0
      for (const f of [1, 4]) {
        await pullBack(page, f, cam0)
        const bad = await page.evaluate(() => {
          const a = (window as W).__neural, s = a.W / a.cam.vw, out: string[] = []
          let n = 0
          for (const b of (a._lastNameBoxes || []).filter((b: W) => b.w === "move")) {
            const node = a.nodes[b.i], x = (node.x - a.cam.cx) * s + a.W / 2, y = (a._LY(node) - a.cam.cy) * s + a.H / 2
            const hw = a._nodeHalfW(node, s, a._nodeK, a._lodK)   // the drawn width, rings included: what the name starts beyond
            const d = Math.max(Math.max(b.l - x, 0, x - b.r), Math.max(b.t - y, 0, y - b.b))
            n++
            if (d < hw + 3 || d > hw + 10) out.push(`${a.graphName(node)}: ${d.toFixed(1)} px from its orb's centre, drawn ${hw.toFixed(1)} wide`)
          }
          return { n, out }
        })
        checked += bad.n
        expect(bad.out, `x${f}: every name starts just beyond its own orb's drawn width`).toEqual([])
      }
      expect(checked, "names were checked").toBeGreaterThan(5)
    })

    test(`claims go in order: the position first, then the row's order (${vp.width})`, async ({ page }) => {
      test.setTimeout(240_000)
      await seat(page, "Standing Position Top", "top")
      const cam0 = await camOf(page)
      await pullBack(page, 4, cam0)
      const r = await page.evaluate(() => {
        const a = (window as W).__neural
        a._nm = null; a.advance(17)   // a fresh plan: nothing written before, so every move claims in the row's order
        const boxes = a._lastNameBoxes || []
        // the row as the player reads it: the cards' DOM order, left to right
        const cards = (a._optionCards || []).filter((c: W) => !c.opt.threat).sort((p: W, q: W) => p.card.compareDocumentPosition(q.card) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1)
        const rank = new Map(cards.map((c: W, k: number) => [c.opt.idx, k]))
        const moves = boxes.filter((b: W) => b.w === "move").sort((p: W, q: W) => p.g - q.g).map((b: W) => rank.get(b.i))
        return { first: boxes[0] && boxes[0].w, moves }
      })
      expect(r.first, "the position's own name claims first").toBe("position")
      expect(r.moves.length, "several moves are named").toBeGreaterThan(3)
      expect(r.moves, "the moves claimed their room in the row's order").toEqual([...r.moves].sort((p: number, q: number) => p - q))
      // ...and in that fresh plan every name is new: each named orb stands 6 px clear of every other dealt orb (one orb, one name)
      const g = await audit(page)
      expect(g.gaps.filter((x: number) => x < 6 - 0.01).map((x: number) => x.toFixed(1)), "a new name belongs to one orb: its orb 6 px clear of every other").toEqual([])
    })

    // R1 findings 7 and 9: the follow camera's ease back from 4 times out, recorded frame by frame at three frame steps (a
    // 120 Hz, 60 Hz and 30 Hz screen: `advance(step)` draws once per call), held against the rule per SECOND
    for (const step of [1000 / 120, 1000 / 60, 1000 / 30]) test(`names hold through an ease at a ${Math.round(1000 / step)} Hz step: a name the layout refused is back only at rest, none changes side while moving, the frame's call per second (${vp.width})`, async ({ page }) => {
      test.setTimeout(240_000)
      await seat(page, "Standing Position Top", "top")
      const cam0 = await camOf(page)
      await pullBack(page, 4, cam0)
      // no input for 4 s of game time: the follow camera takes the map back and eases in. Every frame recorded.
      await watchCands(page)
      const rec = await page.evaluate((step) => {
        const a = (window as W).__neural, frames: W[] = []
        for (let k = 0; k < Math.round(6800 / step); k++) {
          a.__mnCands = []; a.advance(step)
          frames.push({ still: !!a._camStill, t: a.now, c: a.__mnCands, vw: a.cam.vw, cx: a.cam.cx, cy: a.cam.cy, on: (a._lastNameBoxes || []).filter((b: W) => b.w === "move").map((b: W) => [b.i, b.k]) })
        }
        return frames
      }, step)
      const vws = rec.map((f: W) => f.vw)
      expect(Math.max(...vws) / Math.min(...vws), "the camera eased (the recording is of a move, not a still)").toBeGreaterThan(2)
      // the frame's own call against the rule per second: moving above 0.12 of zoom or 30 px of pan a second (asserted only
      // clear of the threshold, a quarter above or a fifth below, so a frame AT the line decides nothing here)
      const W_ = await page.evaluate(() => (window as W).__neural.W), dt = step / 1000, wrong: string[] = []
      for (let k = 1; k < rec.length; k++) {
        const z = Math.abs(Math.log(rec[k].vw / rec[k - 1].vw)) / dt, pan = Math.hypot(rec[k].cx - rec[k - 1].cx, rec[k].cy - rec[k - 1].cy) * (W_ / rec[k].vw) / dt
        if ((z > 0.15 || pan > 37.5) && rec[k].still) wrong.push(`frame ${k}: moving (${z.toFixed(3)}/s, ${pan.toFixed(1)} px/s) called rest`)
        if (z < 0.096 && pan < 24 && !rec[k].still) wrong.push(`frame ${k}: resting (${z.toFixed(3)}/s, ${pan.toFixed(1)} px/s) called moving`)
      }
      expect(wrong, "the frame calls the camera moving or at rest per second, whatever the frame rate").toEqual([])
      holdCheck(rec, `ease at ${Math.round(1000 / step)} Hz`)
      expect(rec[rec.length - 1].on.length, "names are dealt again once the camera rests").toBeGreaterThan(2)
      if (step === 1000 / 60) {
        // held: the same camera, frame after frame, reuses the last plan (the same object)
        const held = await page.evaluate(() => { const a = (window as W).__neural; a.advance(17); const p = a._nm && a._nm.move && a._nm.move.plan; let same = 0; for (let k = 0; k < 60; k++) { a.advance(17); if (a._nm.move.plan === p) same++ } return { same, cam: a.cam.vw } })
        expect(held.same, "60 held frames reuse one plan").toBe(60)
      }
    })
  })
}

test.describe("what the pointer is on is named (1440x900)", () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test("an orb under the mouse is named, and a card under the mouse names its orb, even where the map was too full", async ({ page }) => {
    test.setTimeout(240_000)
    await seat(page, "Standing Position Top", "top")
    const cam0 = await camOf(page)
    await pullBack(page, 4, cam0)
    // dealt moves whose orb is in the free map (above the row, inside the canvas) and whose name the full map refused
    const pick = (needCard: boolean) => page.evaluate((needCard) => {
      const a = (window as W).__neural, s = a.W / a.cam.vw, written = new Set(a._lastOptLabels || []), out: W[] = []
      const rowTop = a.optionsRef.current.getBoundingClientRect().top
      for (const c of (a._optionCards || []).filter((c: W) => !c.opt.threat)) {
        const n = a.nodes[c.opt.idx], x = (n.x - a.cam.cx) * s + a.W / 2, y = (a._LY(n) - a.cam.cy) * s + a.H / 2
        const cr = c.card.getBoundingClientRect()
        if (written.has(n.idx) || x < 40 || x > a.W - 40 || y < 80 || y > rowTop - 20) continue
        if (needCard && (cr.left < 0 || cr.right > a.W)) continue
        out.push({ idx: n.idx, x, y, card: { x: cr.left + cr.width / 2, y: cr.top + cr.height / 2 } })
      }
      return out
    }, needCard)
    const orbs = await pick(false)
    expect(orbs.length, "dealt moves left unnamed by the full map, their orbs in the free map").toBeGreaterThan(0)
    // the pointer on each in turn until the app's own hit test resolves to that orb (a nearer node can win the pick)
    let orb: W = null
    for (const o of orbs) {
      await page.mouse.move(o.x, o.y)
      await journey(page).advance(34)
      if (await page.evaluate((idx) => { const a = (window as W).__neural; return !!a._hover && (a._hover.idx === idx || a._hover.idx === a.nodes[idx].pi) }, o.idx)) { orb = o; break }
    }
    expect(orb, "the pointer resolves to one of them").not.toBeNull()
    const named = await page.evaluate((idx) => {
      const a = (window as W).__neural, n = a.nodes[idx], h = a._lastHoverLabel, p = a._lastPairLabel
      return !!((h && (h.idx === idx || h.idx === n.pi)) || (p && (p.idx === idx || p.idx === n.pi)))
    }, orb.idx)
    expect(named, "the orb under the mouse is named").toBe(true)
    const r1 = await audit(page)
    expect(r1.close, "...and the other names keep clear of it").toEqual([])
    await page.mouse.move(4, 4); await journey(page).advance(600)   // the hover lapses (0.5 s)
    // ...and pulled back until the pairs merge (`_lodK` under 0.5), where the pointer's label is the single one (YOUR MOVE, name)
    let merged = false
    for (const f of [9, 12, 16, 20]) { await pullBack(page, f, cam0); if (await page.evaluate(() => (window as W).__neural._lodK < 0.5)) { merged = true; break } }
    expect(merged, "pulled back far enough that the pairs merge").toBe(true)
    let single: W = null
    for (const o of await pick(false)) {
      await page.mouse.move(o.x, o.y)
      await journey(page).advance(34)
      if (await page.evaluate((idx) => { const a = (window as W).__neural; return !!a._hover && (a._hover.idx === idx || a._hover.idx === a.nodes[idx].pi) }, o.idx)) { single = o; break }
    }
    expect(single, "the pointer resolves to a dealt orb the merged map left unnamed").not.toBeNull()
    expect(await page.evaluate((idx) => { const a = (window as W).__neural, h = a._lastHoverLabel; return !!h && (h.idx === idx || h.idx === a.nodes[idx].pi) }, single.idx), "merged: the orb under the mouse is named by the single label").toBe(true)
    expect((await audit(page)).close, "...and the other names keep clear of it").toEqual([])
    await page.mouse.move(4, 4); await journey(page).advance(600)
    await pullBack(page, 4, cam0)
    const card = (await pick(true))[0]
    expect(card, "a dealt move left unnamed by the full map, its orb in the free map and its card on screen").toBeTruthy()
    await page.mouse.move(card.card.x, card.card.y)
    await journey(page).advance(34)
    expect(await page.evaluate((idx) => ((window as W).__neural._lastOptLabels || []).includes(idx), card.idx), "the card under the mouse names its orb").toBe(true)
    const r2 = await audit(page)
    expect(r2.close, "...and nothing sits on it").toEqual([])
    // the pointer is over the card, not the map: no node under the card is hovered and named there (it used to be)
    expect(r2.under, "...and nothing is named under the card the pointer is on").toEqual([])
  })
})

test.describe("a lit node under the mouse is named once (1440x900)", () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test("a located node with the mouse on it: the pointer's label names it and nothing names it again (R2 D3)", async ({ page }) => {
    test.setTimeout(240_000)
    await seat(page, "Standing Position Top", "top")
    // nodes not dealt and not the position's pair, whose name no dealt move and not the position shares (so one string is one node)
    const cands: number[] = await page.evaluate(() => {
      const a = (window as W).__neural, f = a.focusIdx, taken = new Set([...a.optionIdxs, f, a.nodes[f].pi].filter((i: number) => i >= 0).map((i: number) => a.graphName(a.nodes[i])))
      return a.nodes.filter((n: W) => n.rep && !a.optionIdxs.includes(n.idx) && n.idx !== f && n.idx !== a.nodes[f].pi && !taken.has(a.graphName(n))).map((n: W) => n.idx).slice(0, 40)
    })
    // the ink of one name, the pointer's label perhaps trimmed by the fitter ("Name…")
    const inked = (name: string) => page.evaluate((name) => (((window as W).__mnInk || []) as W[]).filter((q) => q.s === name || (q.s.endsWith("…") && name.startsWith(q.s.slice(0, -1)))).length, name)
    let done: W = null
    for (const i of cands) {
      await page.mouse.move(4, 4)
      await page.evaluate((i) => (window as W).__neural.locateNode(i), i)
      for (let k = 0; k < 5; k++) await journey(page).advance(200)   // the flight settles; the light lasts 3.2 s
      const o = await page.evaluate((i) => {
        const a = (window as W).__neural, s = a.W / a.cam.vw, n = a.nodes[i], x = (n.x - a.cam.cx) * s + a.W / 2, y = (a._LY(n) - a.cam.cy) * s + a.H / 2
        const r = a.canvas.getBoundingClientRect()
        return { x: x + r.left, y: y + r.top, name: a.graphName(n), map: document.elementFromPoint(x + r.left, y + r.top) === a.canvas, named: (a._lastNameBoxes || []).some((b: W) => b.i === i && b.w === "point") }
      }, i)
      if (!o.map || !o.named) continue   // the light names it before the pointer comes (the case the lit pass would repeat)
      expect(await inked(o.name), `${o.name}: lit and located, named once by its light`).toBe(1)
      await page.mouse.move(o.x, o.y)
      await journey(page).advance(34)
      const h = await page.evaluate((i) => { const a = (window as W).__neural, n = a.nodes[i], h = a._lastHoverLabel, p = a._lastPairLabel; return { on: !!a._hover && (a._hover.idx === i || a._hover.idx === n.pi), named: !!((h && (h.idx === i || h.idx === n.pi)) || (p && (p.idx === i || p.idx === n.pi))), lit: a.now - n.lit < 3.2 } }, i)
      if (!h.on) continue   // a nearer node won the pick
      done = { ...o, ...h, count: await inked(o.name) }
      break
    }
    expect(done, "a located node, named by its light, the mouse then on its orb").not.toBeNull()
    expect([done.named, done.lit], `${done.name}: the pointer's label names it, its light still on`).toEqual([true, true])
    expect(done.count, `${done.name}: the located node under the mouse is inked once`).toBe(1)
  })
})

test.describe("a card turned up by touch names its orb (390x631)", () => {
  test.use({ viewport: { width: 390, height: 631 }, hasTouch: true, isMobile: true })

  test("moves hidden: tapping a face-down card turns it up and the map names its orb; the drawer open names nothing", async ({ page }) => {
    test.setTimeout(240_000)
    await seat(page, "Standing Position Top", "top", { v: 2, settings: { hideMoves: true }, settingsAt: { hideMoves: 1 } })
    expect((await page.evaluate(() => (window as W).__neural._lastOptLabels || [])).length, "face down: no move is named").toBe(0)
    // a face-down card whose orb is in the free map, the row swiped to it as a thumb would (the row scrolls sideways)
    const t = await page.evaluate(() => {
      const a = (window as W).__neural, s = a.W / a.cam.vw, rowTop = a.optionsRef.current.getBoundingClientRect().top
      for (const c of (a._optionCards || []).filter((c: W) => !c.opt.threat)) {
        const n = a.nodes[c.opt.idx], x = (n.x - a.cam.cx) * s + a.W / 2, y = (a._LY(n) - a.cam.cy) * s + a.H / 2
        if (!(x > 30 && x < a.W - 30 && y > 80 && y < rowTop - 20)) continue
        c.card.setAttribute("data-mn", "1"); c.card.scrollIntoView({ inline: "center", block: "nearest" })
        return { idx: n.idx }
      }
      return null
    })
    expect(t, "a face-down card whose orb is in the free map").not.toBeNull()
    await journey(page).advance(300)
    const at = await page.evaluate(() => { const r = document.querySelector('[data-mn="1"]')!.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 40, inView: r.left >= 0 && r.right <= innerWidth } })
    expect(at.inView, "the card is on screen").toBe(true)
    await page.touchscreen.tap(at.x, at.y)
    await journey(page).advance(34)
    expect(await page.locator('[data-mn="1"]').getAttribute("data-revealed"), "the tap turned it up").not.toBeNull()
    expect(await page.evaluate((idx) => ((window as W).__neural._lastOptLabels || []).includes(idx), t!.idx), "the map names the card just turned up").toBe(true)
    const r = await audit(page)
    expect([r.close, r.outside, r.under], "and it sits clear of every name, the edge and every control").toEqual([[], [], []])
    // the drawer takes a phone's screen: no name is written under it, the position's own included
    await journey(page).clickByMouse(".ng-logo", "open the drawer")
    await journey(page).advance(600)
    const open = await page.evaluate(() => { const a = (window as W).__neural; return { shown: !!a.deckShown, boxes: (a._lastNameBoxes || []).length, pair: a._lastPairLabel, rich: a._lastRichLabel } })
    expect(open.shown, "the drawer is open").toBe(true)
    expect([open.boxes, open.pair, open.rich], "nothing is written on the map under the drawer").toEqual([0, null, null])
  })
})

test.describe("the drawer open on a desktop (1440x900)", () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test("no name for an orb under the open drawer or under paint that hides it, and the map beside it still named (R2 D4)", async ({ page }) => {
    test.setTimeout(240_000)
    let written = 0, last: W = null
    // Ushiro Ashi-Garami top first: the seat where the survey found it, three names beside orbs under the open drawer (an orb
    // at x 328 to 351, the drawer's edge near 360; head 130b654f5, the usual zoom and pulled back 2 times)
    for (const [title, role] of ([["Ushiro Ashi-Garami Top", "top"]] as Array<[string, "top" | "bottom"]>).concat(SEATS)) {
      const j = await seat(page, title, role)
      await watchCands(page)
      await j.clickByMouse(".ng-logo", "open the drawer")
      await j.advance(600)
      expect(await page.evaluate(() => !!(window as W).__neural.deckShown), `${title}: the drawer is open`).toBe(true)
      const cam0 = last = await camOf(page)
      for (const f of [1, 2, 4]) {
        const where = `${title} (${role}) drawer open x${f}`
        await pullBack(page, f, cam0)
        checkFrame(await audit(page), `${where}, at rest`)
        await j.advance(520)
        const r = await audit(page)
        checkFrame(r, `${where}, settled`)
        written += r.moves
      }
    }
    console.log(`[map-names] drawer open at 1440: ${written} move names settled over 4 seats x 3 zooms`)
    expect(written, "the map beside the open drawer is still named").toBeGreaterThan(20)
    // ...and the map dragged left under the open drawer, 5 px a frame (Standing top, the usual zoom): a written name keeps its
    // place while the camera moves, so an orb sliding wholly under the drawer must take its name with it
    await pullBack(page, 1, last)
    const at = { x: 1100, y: 300 }
    expect(await page.evaluate((p) => document.elementFromPoint(p.x, p.y) === (window as W).__neural.canvas, at), "the drag starts on the map beside the drawer").toBe(true)
    await page.mouse.move(at.x, at.y); await page.mouse.down()
    const hid: string[] = []
    let slid = 0
    for (let k = 1; k <= 80; k++) {
      await page.mouse.move(at.x - 5 * k, at.y)
      await journey(page).advance(17)
      if (k % 2) continue
      const r = await audit(page)
      hid.push(...r.hidOrb.map((x: string) => `step ${k}: ${x}`)); slid = Math.max(slid, r.hidden)
    }
    await page.mouse.up()
    expect(slid, "dealt orbs slid wholly under the drawer during the drag").toBeGreaterThan(0)
    expect(hid, "no name for an orb under the drawer's paint, while dragging under it").toEqual([])
  })
})

test.describe("the cache of what hides an orb (CACHE414, 1440x900)", () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test("a held camera reads no box and no style in _hides after its first frame; an answer older than half a second is asked again", async ({ page }) => {
    test.setTimeout(240_000)
    await seat(page, "Standing Position Top", "top")
    const r = await page.evaluate(() => {
      const a = (window as W).__neural, proto = Object.getPrototypeOf(a)
      let inH = false, n = 0, calls = 0
      const gb = Element.prototype.getBoundingClientRect, gs = window.getComputedStyle
      Element.prototype.getBoundingClientRect = function (this: Element) { if (inH) n++; return gb.call(this) }
      ;(window as W).getComputedStyle = function (...x: W[]) { if (inH) n++; return (gs as W).apply(this, x) }
      a._hides = function (...x: W[]) { calls++; inH = true; try { return proto._hides.apply(this, x) } finally { inH = false } }
      const frames: W[] = []
      let late: W = null
      try {
        a._hidC = null   // a cold store: the first frame asks
        for (let k = 0; k < 24; k++) { n = 0; calls = 0; const t = a.now; a.advance(17); frames.push({ n, calls, dt: a.now - t }) }   // 24 x 17 ms: 0.41 s
        n = 0; calls = 0; a.advance(120); late = { n, calls }   // past half a second after the first frame's answers
      } finally { Element.prototype.getBoundingClientRect = gb; (window as W).getComputedStyle = gs; delete a._hides }
      return { frames, late }
    })
    console.log(`[map-names] cache: first frame ${r.frames[0].calls} asks, ${r.frames[0].n} reads; then ${JSON.stringify(r.frames.slice(1).map((f: W) => f.n))}; half a second on ${r.late.n} reads`)
    expect(r.frames[0].calls > 0 && r.frames[0].n > 0, "the first frame asks the controls, with reads (an orb lies inside a control's box)").toBe(true)
    expect(r.frames.slice(1).map((f: W) => f.n), "a held camera: zero _hides box or style reads after its first frame").toEqual(Array(23).fill(0))
    expect(r.frames.slice(1).every((f: W) => f.calls > 0), "...while it is still asked every frame (the answers come from the store)").toBe(true)
    expect(r.late.n, "an answer older than half a second (frame clock) is asked again").toBeGreaterThan(0)
  })

  test("paint at alpha 0.6 hides an orb, at 0.4 it does not, and an opaque display-p3 colour hides it (the threshold and the colour parse)", async ({ page }) => {
    test.setTimeout(240_000)
    await seat(page, "Standing Position Top", "top")
    await watchCands(page)
    await journey(page).advance(34)
    // a dealt orb in the free map, offered, inside no control's box
    const o = await page.evaluate(() => {
      const a = (window as W).__neural, s = a.W / a.cam.vw, B = a._nameBlocks().blocks, rowTop = a.optionsRef.current.getBoundingClientRect().top
      for (const i of a.__mnCands as number[]) {
        const n = a.nodes[i], x = (n.x - a.cam.cx) * s + a.W / 2, y = (a._LY(n) - a.cam.cy) * s + a.H / 2, R = a._nodeHalfW(n, s, a._nodeK, a._lodK, true)
        if (x < 300 || x > a.W - 120 || y < 100 || y > rowTop - 80) continue
        if (B.some((q: W) => q.r > x - R - 8 && q.l < x + R + 8 && q.b > y - R - 8 && q.t < y + R + 8)) continue
        return { idx: i, x, y, R, name: a.graphName(n) }
      }
      return null
    })
    expect(o, "a dealt orb in the free map, offered").not.toBeNull()
    for (const [bg, hides] of [["rgba(30, 32, 52, 0.6)", true], ["rgba(30, 32, 52, 0.4)", false], ["color(display-p3 0.12 0.13 0.2)", true]] as Array<[string, boolean]>) {
      const read = await page.evaluate(([o, bg]: W) => {
        const a = (window as W).__neural, wrap = a.wrapRef.current, wr = wrap.getBoundingClientRect(), cv = a.canvas.getBoundingClientRect()
        const d = document.createElement("div"); d.setAttribute("data-mn-fixture", "")
        Object.assign(d.style, { position: "absolute", left: cv.left - wr.left + o.x - o.R - 6 + "px", top: cv.top - wr.top + o.y - o.R - 6 + "px", width: 2 * o.R + 12 + "px", height: 2 * o.R + 12 + "px", background: bg, pointerEvents: "none", zIndex: "3" })
        wrap.appendChild(d)
        return getComputedStyle(d).backgroundColor
      }, [o, bg])
      await journey(page).advance(17); await journey(page).advance(17)
      const offered = await page.evaluate((i) => ((window as W).__neural.__mnCands as number[]).includes(i), o!.idx)
      const r = await audit(page)
      await page.evaluate(() => document.querySelectorAll("[data-mn-fixture]").forEach((e) => e.remove()))
      await journey(page).advance(17)
      console.log(`[map-names] fixture ${bg} (computed ${read}) over ${o!.name}: offered ${offered}`)
      expect(offered, `a control painted ${bg} over ${o!.name}: the orb is ${hides ? "hidden (not offered)" : "shown (offered)"}`).toBe(!hides)
      expect(r.seen, `${bg}: the planner is offered exactly the dealt orbs the browser shows`).toEqual([])
    }
  })
})

test.describe("the cache follows the row's scroll (CACHE414, 390x631)", () => {
  test.use({ viewport: { width: 390, height: 631 }, hasTouch: true, isMobile: true })

  test("scrolling the row: within two frames the planner is offered exactly the dealt orbs the browser shows", async ({ page }) => {
    test.setTimeout(240_000)
    await seat(page, "Standing Position Top", "top")
    await watchCands(page)
    await journey(page).advance(34)
    // THE CASE, PUT IN PLACE: a dealt orb under the middle of a card of the row (the camera held there), then the row
    // scrolled so the gap between that card and the next comes under the orb, and back. Each time the answer kept for that
    // orb must go with the scroll within two frames (not wait for its half second).
    const set = await page.evaluate(() => {
      const a = (window as W).__neural, row = a.optionsRef.current, rr = row.getBoundingClientRect(), cv = a.canvas.getBoundingClientRect()
      const cards = (a._optionCards || []).map((c: W) => c.card.getBoundingClientRect()).filter((r: W) => r.left >= rr.left && r.right <= rr.right).sort((p: W, q: W) => p.left - q.left)
      if (cards.length < 2) return null
      const A = cards[0], B = cards[1], i = a.optionIdxs[0], n = a.nodes[i], s = a.W / a.cam.vw
      const x = (A.left + A.right) / 2 - cv.left, y = (A.top + A.bottom) / 2 - cv.top
      a.cam.cx = n.x - (x - a.W / 2) / s; a.cam.cy = a._LY(n) - (y - a.H / 2) / s; a.cam.lvw = Math.log(a.cam.vw)
      Object.assign(a.camTarget, { cx: a.cam.cx, cy: a.cam.cy, vw: a.cam.vw }); a.holdCamera()
      return { i, gap: (A.right + B.left) / 2 - cv.left, x, name: a.graphName(n) }
    })
    expect(set, "two cards of the row on screen").not.toBeNull()
    await journey(page).advance(17); await journey(page).advance(17)
    const step = async (where: string, scroll: number, hidden: boolean) => {
      const moved = await page.evaluate((d) => { const el = (window as W).__neural.optionsRef.current, x = el.scrollLeft; el.scrollTo({ left: x + d, behavior: "instant" }); return el.scrollLeft - x }, scroll)
      await journey(page).advance(17); await journey(page).advance(17)   // two frames, 34 ms: well inside an answer's half second
      const r = await audit(page), offered = await page.evaluate((i) => ((window as W).__neural.__mnCands as number[]).includes(i), set!.i)
      console.log(`[map-names] row scroll ${where}: moved ${moved} px; ${set!.name} hidden ${r.hiddenIdx.includes(set!.i)}, offered ${offered}`)
      expect(r.hiddenIdx.includes(set!.i), `${where}: ${set!.name} is ${hidden ? "under the card" : "in the gap between two cards"} (the browser's paint)`).toBe(hidden)
      expect(r.seen, `${where}: within two frames the planner is offered exactly the dealt orbs the browser shows`).toEqual([])
    }
    await step("before", 0, true)
    await step("scrolled to the gap", Math.round(set!.gap - set!.x), false)   // scrollLeft up: the row moves left, the gap comes under the orb
    await step("scrolled back", Math.round(set!.x - set!.gap), true)
  })
})

test.describe("a drag (1440x900)", () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test("a mouse drag across the map and back: a name the layout refused never comes back before the camera rests, a name follows its orb off the canvas and back, none changes side while it moves, none for an orb off the canvas", async ({ page }) => {
    test.setTimeout(240_000)
    await seat(page, "Standing Position Top", "top")
    const cam0 = await camOf(page)
    await pullBack(page, 2, cam0)
    await watchCands(page)
    // pressed on the open map above the row, then 120 moves of 6 px left and 2 px down and 120 straight back, one drawn
    // frame each (R1 finding 7; R2 D2: a drag that REVERSES brings back orbs that left the canvas, with their names)
    const at = { x: 1300, y: 330 }
    expect(await page.evaluate((p) => document.elementFromPoint(p.x, p.y) === (window as W).__neural.canvas, at), "the drag starts on the map").toBe(true)
    await page.mouse.move(at.x, at.y); await page.mouse.down()
    const rec: W[] = [], off: string[] = []
    for (let k = 1; k <= 240; k++) {
      const d = k <= 120 ? k : 240 - k
      await page.mouse.move(at.x - 6 * d, at.y + 2 * d)
      const f = await recFrame(page)
      rec.push(f)
      if (k % 20 === 0) { const r = await audit(page); off.push(...r.offOrb.concat(r.hidOrb).map((x: string) => `step ${k}: ${x}`)) }
    }
    await page.mouse.up()
    const rest = await recFrame(page)
    expect(rec.filter((f) => !f.still).length, "the drag moved the camera on (almost) every frame").toBeGreaterThan(200)
    expect(Math.max(...rec.map((f) => f.on.length)), "names were written during the drag").toBeGreaterThan(3)
    const n = holdCheck(rec.concat([rest]), "the drag")
    console.log(`[map-names] the drag: ${n.refused} names the layout refused, ${n.followed} left with their orb, ${n.followedBackMoving} of those back with it while moving`)
    // NON-TRIVIAL: both halves of the rule had subjects in this recording
    expect(n.refused, "the layout refused names while the camera moved (the rule above had names to judge)").toBeGreaterThan(0)
    expect(n.followedBackMoving, "a name whose orb left the canvas came back with it while the camera still moved").toBeGreaterThan(0)
    expect(off, "no name for an orb drawn off the canvas or under paint that hides it, while dragging").toEqual([])
    expect(rest.still, "released, the camera rests").toBe(true)
  })
})

test.describe("a node the player is pointed at (390x631)", () => {
  test.use({ viewport: { width: 390, height: 631 }, hasTouch: true, isMobile: true })

  test("a located node beside the dealt orbs is named (R1 finding 4); a face-down move's pair partner, lit, never is (finding 10)", async ({ page }) => {
    test.setTimeout(240_000)
    await seat(page, "Standing Position Top", "top")
    // candidates: nodes not dealt and not the position's pair, nearest the dealt orbs first (the locate flies the camera wide,
    // so whether a dealt orb CROWDS the node, which the trail's 6 px room rule would refuse, is judged where it lands)
    const cands: number[] = await page.evaluate(() => {
      const a = (window as W).__neural, f = a.focusIdx, dealt = [...new Set(a.optionIdxs as number[])].map((i) => a.nodes[i])
      const out: Array<[number, number]> = []
      for (const n of a.nodes) {
        if (a.optionIdxs.includes(n.idx) || n.idx === f || n.idx === a.nodes[f].pi || !n.rep) continue
        let d = 1e9; for (const o of dealt) if (o.idx !== n.pi && o.pi !== n.idx) d = Math.min(d, Math.hypot(o.x - n.x, o.y - n.y))
        out.push([n.idx, d])
      }
      return out.sort((p, q) => p[1] - q[1]).map((p) => p[0]).slice(0, 16)
    })
    expect(cands.length, "the seat has nodes beside its dealt orbs").toBeGreaterThan(0)
    let found: W = null
    for (const i of cands) {
      await page.evaluate((i) => (window as W).__neural.locateNode(i), i)
      for (let k = 0; k < 6; k++) await journey(page).advance(200)   // the flight settles; the light lasts 3.2 s
      const r = await page.evaluate((i) => {
        const a = (window as W).__neural, s = a.W / a.cam.vw, n = a.nodes[i], x = (n.x - a.cam.cx) * s + a.W / 2, y = (a._LY(n) - a.cam.cy) * s + a.H / 2, R = a._nodeHalfW(n, s, a._nodeK, a._lodK, true)
        let gap = 1e9; for (const d of a.optionIdxs) { const o = a.nodes[d]; if (d === n.pi || o.pi === i) continue; gap = Math.min(gap, Math.hypot((o.x - a.cam.cx) * s + a.W / 2 - x, (a._LY(o) - a.cam.cy) * s + a.H / 2 - y) - a._nodeHalfW(o, s, a._nodeK, a._lodK, true) - R) }
        return { gap, onMap: x > 0 && x < a.W && y > 0 && y < a.H, named: (a._lastNameBoxes || []).some((b: W) => b.i === i && (b.w === "point" || b.w === "lit")), name: a.graphName(n) }
      }, i)
      if (r.onMap && r.gap < 6) { found = r; break }
    }
    expect(found, "a located node still crowded by a dealt orb once the camera has flown to it").not.toBeNull()
    expect(found.named, `the located node (${found && found.name}) is named, though a dealt orb crowds it`).toBe(true)
    // FINDING 10: moves hidden, a face-down move's PAIR PARTNER lit carries the hidden move's name: never written
    await seat(page, "Standing Position Top", "top", { v: 2, settings: { hideMoves: true }, settingsAt: { hideMoves: 1 } })
    const hidden = await page.evaluate(() => {
      const a = (window as W).__neural
      const c = (a._optionCards || []).find((c: W) => !c.opt.threat && c.card.hasAttribute("data-hide") && a.nodes[c.opt.idx].pi >= 0)
      return c ? { pi: a.nodes[c.opt.idx].pi, name: a.graphName(a.nodes[c.opt.idx]) } : null
    })
    expect(hidden, "a face-down dealt move with a pair partner").not.toBeNull()
    await page.evaluate((i) => (window as W).__neural.locateNode(i), hidden!.pi)
    const leak: string[] = []
    for (let k = 0; k < 10; k++) {
      await journey(page).advance(200)
      leak.push(...await page.evaluate((h) => (((window as W).__mnInk || []) as W[]).filter((q) => q.s === h.name).map((q) => `${q.s} at ${q.l.toFixed(0)},${q.t.toFixed(0)}`), hidden!))
    }
    expect(leak, `the hidden move's name (${hidden!.name}) is never inked, though its partner is lit`).toEqual([])
  })
})
