import { expect, test, type Page } from "@playwright/test"
import { journey } from "../dsl"

/**
 * THE LIGHT (L2b S1, v1.295.0): "the map shows where" (the owner's U202 a), first on Last rolls' "Show on the map".
 *
 * Until now "Show on the map" flew to the place and NAMED it; nothing tied the name to its orb at a glance. Now the map
 * steps back under one layer of rgb(7, 8, 16) at 40% (half of direction B, design round 6), and the place's pair and every
 * move it deals in this ruleset stand clear of it (the owner's U175 rule), over every line and orb and under every name.
 * Ruled with the rest of L2b Part A (c) on 19 Nov 2026. What is drawn: neural/src/map-light.src.js; when: `_lightOf` and
 * `_drawLight` in app.src.jsx; the fade's timing and the rules of what is a hole and what a mark: tests/map_light.test.mjs.
 *
 * WHAT IS READ: the pixels `draw()` paints, never the rule recomputed (CLAUDE.md 6.3). Each claim is a DIFFERENTIAL against a
 * CONTROL FRAME: the same frame drawn again at the same instant with nothing shown, so everything the map draws anyway
 * subtracts out (both drawn into offscreen copies of the real canvas, the live context swapped for each, as
 * map-gold.spec.ts reads the gold). Pressed as a player does: a real mouse at 1440x900 (at dpr 1 and 2), a touch tap at
 * 390x631 (dpr 2), at points `elementFromPoint` confirms are the control.
 *
 * MUTANTS, each built alone into the served bundle (`npm run dev:neural:app`, under the lock), after a neutral control that
 * left this file green; the clean bundle rebuilt after. Every one RED at the step named (the table and its date are in
 * docs/Changelog-Archive.md, v1.295.0):
 *   J1  the layer at 0.8 (B's own strength)                          → "…lights the place" at "the map steps back to 40%"
 *   J2  no hole for the place's pair                                  → the same test, at "the place's orbs are not dimmed"
 *   J3  the layer drawn after the names                               → the same test, at "the place's name is not dimmed" (its
 *       first reading kept the name's letters inside the place's own hole, red at 390 only: the name is read outside the holes)
 *   J4  no hole for the moves                                         → the same test, at "the moves it deals stand clear"
 *   J5  the light over a running game (`_lightOf` without `paused`)   → "…the drawer shut by Esc…" at "the game runs: the light
 *                                                                        is out", and the phone's at "…the light goes"
 *   J6  the light under a phone's open drawer                         → (19 Nov) "on a phone…" at "the drawer opened over the
 *       look: no light under it". NOT A KILL HERE SINCE S1-R1: the drawer a player opens over a look opens on Explore, which
 *       ends the look (ruling 2), so no frame has a place shown under a phone's open drawer; the guard stays (`_lightOf`),
 *       and the unit ML7 holds it
 *   J7  the planner's bundle not in, and nothing said                 → "the planner's bundle not in yet…" at "said once"
 * WHERE IT MEETS v1.294.0 (BGCLOSE: one press on the bare map closes the page and the address goes to the root), on the merged
 * tree, 23 Nov 2026. Nothing of the light's own decides either; each is pinned here because the light rides both:
 *   J8  the press that ends a look not consumed (`attachInput`: `closing` not set by `looked`)
 *                                                                     → "on a phone, after a look…" at "the press that ends the
 *                                                                        look closes nothing"
 *   J9  the name kept past a new camera hold (`_shownNode` reading `camHeld()` alone: the close's own hold for free roam
 *       then keeps the place named, and lit, over the closed map)    → "on a phone, after a look…" and "…the drawer shut by
 *                                                                        Esc…", each at "the name goes with it"
 * S1-R1 (23 Nov 2026; the reader of PR #447, `reports/review-pr447.md`, and the orchestrator's rulings 2 and 4). The reader's
 * own mutants, verbatim, after a neutral control (one comment character, 14 of 14 green):
 *   R1  the hand's cache forgets which place it was kept for          → "every move the place deals, and only those…" at "a
 *                                                                        second place lights its own hand, nothing of the first's"
 *   R2  the hand's cache forgets the ruleset                          → the same test, at "the ruleset switched while lit…"
 *   R3  no 4 px marks                                                 → the same test, at "each mark is drawn above the layer"
 *   R5  no soft band (both fills cut at the hole's own radius)        → "…lights the place" at "each hole's edge is soft" (all three)
 *   R6  a move near the view's edge never lit (the cull 60 px inside) → "…lights the place" at "every dealt move on the visible
 *                                                                        map is lit" (at 1440, dpr 1 and 2; at 390 none is so near)
 *   JR2a the look not tied to its row                                 → "on a computer the look ends with its row…" at "the row
 *                                                                        collapsed: the place is no longer named"
 *   JR2b Last rolls not read                                          → the same test, at "Last rolls left for Explore…"
 *   JR4 the fade kept over a running game (no "out at once")          → "the light goes out AT ONCE…", all four, at "out on the
 *                                                                        first frame"
 * NOT KILLED, AND WHAT WOULD: R4 (the partner orb not added to the holes). Wherever it was measured the pair's two orbs lie in
 * ONE hole (the place's own radius takes in its partner at the roll's zoom and further out), so it is equivalent there; it
 * would need a frame zoomed in far enough that the pair's two orbs stand more than a hole's radius apart (closer than the
 * roll's zoom, where "Show on the map" never frames), read at the partner's own orb. J5 (`paused` dropped from `_lightOf`)
 * survives since S1-R1 and is covered twice: ruling 4's own line in `_drawLight` (`running`) puts out a light over a
 * running game, and JR4 is its killer (the unit file says the same of ML6).
 * NOT A KILL HERE: the fade kept under reduced motion. The step "under reduced motion the light is full on the first frame"
 * reads the frame after the press, and the press takes a real mouse some tenths of a second, which the fade (on the clock
 * that moved more) may already have run through; its killer is the unit ("under reduced motion it is on and off at once",
 * tests/map_light.test.mjs). The step here is the wiring: the player's setting reaches the light.
 * NOT COVERED HERE: a mark above the layer (an orb drawn under 2.5 px: at the look's zoom no move of Mount is that small;
 * the rule is the unit's); a film (it takes the camera's lease, `_replayFrame`, so the place is no longer shown: no clause
 * of the light's own to mutate). The harness serves `{}` for dossiers: no claim here reads a film or an article.
 */

type W = any

// ── the helpers of e2e/journeys/last-rolls-places.spec.ts that this file needs, the same steps (copied: a spec cannot import a
// spec without running its tests) ──
async function press(page: Page, selector: string, what: string, touch: boolean) {
  for (let i = 0; ; i++) {
    try { await page.locator(selector).first().scrollIntoViewIfNeeded({ timeout: 3_000 }); break }
    catch (e) { if (i >= 4) throw e; await page.waitForTimeout(250) }
  }
  await expect.poll(() => page.evaluate((sel) => { let a = 1; for (let n = document.querySelector(sel) as HTMLElement | null; n; n = n.parentElement) a *= Number(getComputedStyle(n).opacity); return a }, selector),
    { message: `${what}: fully shown`, timeout: 5_000 }).toBeGreaterThan(0.99)
  const at = await page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement | null
    if (!el) return { ok: false, why: "no element matches", x: 0, y: 0 }
    const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2
    if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return { ok: false, why: "off screen", x, y }
    const top = document.elementFromPoint(x, y)
    return { ok: !!top && (top === el || el.contains(top)), why: top ? "<" + top.tagName.toLowerCase() + " " + (top as HTMLElement).className + ">" : "nothing", x, y }
  }, selector)
  expect(at.ok, `${what}: the point under the press is the control (${at.why})`).toBe(true)
  if (touch) await page.touchscreen.tap(at.x, at.y)
  else await page.mouse.click(at.x, at.y)
}
async function dismissReward(page: Page, touch: boolean) {
  for (let i = 0; i < 4 && (await page.locator("[data-reward-close]").isVisible()); i++) {
    await press(page, "[data-reward-close]", "put the earned reward away", touch)
    await page.waitForTimeout(150)
  }
}
/** a roll from Mount (top) that has moved once, so Mount is a row of Last rolls and not where the roll stands; the roll live */
async function rolled(page: Page, touch: boolean, beforeNavigate?: (p: Page) => Promise<void>) {
  const j = journey(page)
  await j.boot("/", beforeNavigate ? { beforeNavigate } : {})
  await j.land("Mount Top")
  const t = await page.evaluate(() => {
    const a = (window as W).__neural
    for (const i of a.optionIdxs || []) if (a.nodes[i].ty === "transitions") return a.nodes[i].t as string
    return ""
  })
  await j.rig("resolve", [0.01]); await j.rig("outcome", [0.01])
  await j.pick(t)
  await j.nextHand()
  await dismissReward(page, touch)
  expect(await page.evaluate(() => ((window as W).__neural.rollLog || [])[0]?.key), "premise: the roll started at Mount, top").toBe("Mount|Top")
  expect(await page.evaluate(() => !!(window as W).__neural.paused), "premise: the roll is live").toBe(false)
  return j
}
/** Last rolls open, Mount's row pressed, "Show on the map" pressed */
async function show(page: Page, touch: boolean, key = "Mount|Top") {
  await dismissReward(page, touch)
  if (!(await page.evaluate(() => !!(window as W).__neural.deckShown))) await press(page, ".ng-logo", "open the drawer", touch)
  // (the drawer opens again on the view it was left on: Last rolls' rows are then already there)
  if (!(await page.locator(`[data-hist="${key}"]`).first().isVisible())) await press(page, '[data-view="history"]', "Last rolls", touch)
  if (!(await page.locator(`[data-hist="${key}"] + .ng-hact [data-hist-show]`).first().isVisible())) await press(page, `[data-hist="${key}"]`, `the row of ${key}`, touch)
  await press(page, `[data-hist="${key}"] + .ng-hact [data-hist-show]`, "Show on the map", touch)
}
const state = (page: Page) => page.evaluate(() => {
  const a = (window as W).__neural
  return { paused: !!a.paused, drawer: !!a.deckShown, look: !!a._lookAutoPaused }
})
const light = (page: Page) => page.evaluate(() => { const l = (window as W).__neural._lastLight; return l ? { k: l.k as number, place: l.place as number, holes: l.holes.length as number } : null })
const mountTop = (page: Page) => page.evaluate(() => { const a = (window as W).__neural; return a._seatMember(a.nodeForKey("Mount|Top"), "top") as number })
/** does the map name Mount: the label the last frame published for the pointer's node or a pair (`draw()`'s own output) */
const named = (page: Page) => page.evaluate(() => {
  const a = (window as W).__neural, i = a.nodeForKey("Mount|Top"), n = a.nodes[i], want = a.graphName(n)
  return [a._lastPairLabel, a._lastHoverLabel].some((l: W) => !!l && (l.idx === i || l.idx === n.pi) && String(l.main || "").includes(want))
})
/** the page: its address, free roam (a closed page), the landing card (v1.294.0's three marks of a page that was closed) */
const where = (page: Page) => page.evaluate(() => { const a = (window as W).__neural; return { url: location.pathname, roam: !!a._roam, card: !!a._landEl } })
const shownAt = (page: Page) => page.evaluate(() => !!(window as W).__neural._shownNode())
const beats = (page: Page, name: string) => page.evaluate((n) => ((window as W).__neural.beats || []).filter((b: W) => b.beat === n).length, name)
/** a point of the map no node and no control is under, found with the app's own hover test */
const emptyMapPoint = (page: Page) => page.evaluate(() => {
  const a = (window as W).__neural, c = a.canvas.getBoundingClientRect()
  for (let y = c.top + 70; y < c.bottom - 40; y += 23) for (let x = c.left + 30; x < c.right - 30; x += 31) {
    const el = document.elementFromPoint(x, y)
    if (el !== a.canvas && el !== a.wrapRef.current) continue
    a._updateHover({ clientX: x, clientY: y })
    const free = !a._hover || a._hover.idx < 0
    a._hover = null
    if (free) return { x, y }
  }
  return null
})

/**
 * THE INK, lit against its control. Draws the frame as it is (the light on) and the same frame at the same instant with
 * nothing shown (the control), each into an offscreen copy of the live canvas, and reads:
 *   plain  points of the visible map at least 3 px beyond every hole's soft edge and every mark, and 12 px clear of every
 *          name either frame wrote (a name's shadow darkens round it): lit, and what the layer would make of the control
 *          (60% of it plus 40% of rgb(7, 8, 16)), channel by channel;
 *   holes  each lit move's centre where the light cut its hole, and each orb of the place where the frame draws it (its own
 *          lift and camera, not the light's record), lit and control, each 12 px clear of every name;
 *   name   the brightest pixel of the place's own name OUTSIDE every hole's soft edge, lit: white text (240 to 248) whose
 *          anti-aliased 13 px glyphs read 221 to 223 at their brightest under no layer; under the layer at most 155.
 * The light's own state (`_shown`, its strength and clocks) is put back exactly after the control frame.
 */
const ink = (page: Page) => page.evaluate(() => {
  const a = (window as W).__neural, live = a.ctx, dpr = a.dpr || 1
  const shot = () => {
    const c = document.createElement("canvas"); c.width = live.canvas.width; c.height = live.canvas.height
    const ctx = c.getContext("2d", { willReadFrequently: true })!
    a.ctx = ctx; ctx.save()
    try { a.draw() } finally { a.ctx = live; ctx.restore() }
    return { ctx, names: (a._lastNameBoxes || []).map((b: W) => ({ l: b.l, r: b.r, t: b.t, b: b.b, i: b.i, w: b.w })), light: a._lastLight ? JSON.parse(JSON.stringify(a._lastLight)) : null }
  }
  const lit = shot()
  const keep = { shown: a._shown, k: a._lightK, at: a._lightAt, t: a._lightT, s: a._lightS }
  let ctl: W
  a._shown = null; a._lightK = 0
  try { ctl = shot() } finally { a._shown = keep.shown; a._lightK = keep.k; a._lightAt = keep.at; a._lightT = keep.t; a._lightS = keep.s }
  a.draw()   // the real frame again on the live canvas, so what the page publishes (`_lastLight`, the labels) is not the control's
  const L = lit.light
  if (!L) return { L: null }
  const px = (c: W, x: number, y: number) => { const d = c.getImageData(Math.floor(x * dpr), Math.floor(y * dpr), 1, 1).data; return [d[0], d[1], d[2]] }
  const boxes = lit.names.concat(ctl.names), nearName = (x: number, y: number, m: number) => boxes.some((b: W) => x > b.l - m && x < b.r + m && y > b.t - m && y < b.b + m)
  const R = a._viewRect(), plain: W[] = []
  for (let y = R.top + 6; y < R.top + R.height - 6; y += 11) for (let x = R.left + 6; x < R.left + R.width - 6; x += 13) {
    if (L.holes.some((h: W) => Math.hypot(x - h.x, y - h.y) < h.r * 1.35 + 3) || L.marks.some((m: W) => Math.hypot(x - m.x, y - m.y) < 6) || nearName(x, y, 12)) continue
    const p = px(lit.ctx, x, y), q = px(ctl.ctx, x, y), want = q.map((v, i) => 0.6 * v + 0.4 * [7, 8, 16][i])
    plain.push({ x, y, p, q, off: +Math.max(...p.map((v, i) => Math.abs(v - want[i]))).toFixed(1) })
  }
  const read = (i: number, x: number, y: number, place: boolean) => {
    const p = px(lit.ctx, x, y), q = px(ctl.ctx, x, y)
    return { i, place, p, q, dimmed: Math.max(...q.map((v, k) => v - p[k])) }
  }
  // the MOVES where the light says it cut their holes; the PLACE where the frame draws its two orbs (`pairMid` is not the
  // orb: each half through the frame's own lift `_LY` and camera, as last-rolls-places.spec.ts's `orbPoint`), so a light
  // that cut no hole for the place cannot pass by having nothing to read
  const sc = a.W / a.cam.vw, shown = a.nodes[L.place], at = (n: W) => ({ x: a.W / 2 + (n.x - a.cam.cx) * sc, y: a.H / 2 + (a._LY(n) - a.cam.cy) * sc })
  const holes = L.holes.filter((h: W) => !h.place && !nearName(h.x, h.y, 12)).map((h: W) => read(h.i, h.x, h.y, false))
  for (const n of [shown, shown.pi >= 0 ? a.nodes[shown.pi] : null]) if (n) { const o = at(n); if (!nearName(o.x, o.y, 12)) holes.push(read(n.idx, o.x, o.y, true)) }
  // the place's own name, its brightest pixel OUTSIDE every hole's soft edge: its first letters can sit in the place's own
  // hole, where a layer drawn over the names would leave them bright anyway
  const own = lit.names.find((b: W) => (b.i === L.place || b.i === shown.pi) && b.w === "hover")
  let name = -1, nameOut = 0
  if (own) {
    const x0 = Math.floor(own.l * dpr), y0 = Math.floor(own.t * dpr), w = Math.max(1, Math.ceil(own.r * dpr) - x0), d = lit.ctx.getImageData(x0, y0, w, Math.max(1, Math.ceil(own.b * dpr) - y0)).data
    for (let i = 0; i < d.length; i += 4) {
      const x = (x0 + (i / 4) % w) / dpr, y = (y0 + Math.floor(i / 4 / w)) / dpr
      if (L.holes.some((h: W) => Math.hypot(x - h.x, y - h.y) < h.r * 1.35 + 2)) continue
      nameOut++; name = Math.max(name, d[i], d[i + 1], d[i + 2])
    }
  }
  // THE SOFT EDGE (S1-R1, the reader's R5): between a move's hole (r) and 1.35 r only one of the two fills lies, so the map
  // there steps back by about 23% of the way to rgb(7, 8, 16), not the layer's 40%: read on a ring at 1.175 r round each
  // move's hole, clear of every other hole, mark and name, where the control is bright enough to tell (25 over the layer's
  // colour on its brightest channel). Each reading: how far toward rgb(7, 8, 16) the lit frame stepped, 0 to 1.
  const ring: number[] = []
  for (const h of L.holes.filter((h: W) => !h.place)) for (let t = 0; t < 12; t++) {
    const x = h.x + Math.cos(t * Math.PI / 6) * h.r * 1.175, y = h.y + Math.sin(t * Math.PI / 6) * h.r * 1.175
    if (x < R.left + 2 || x > R.left + R.width - 2 || y < R.top + 2 || y > R.top + R.height - 2) continue
    if (L.holes.some((o: W) => o !== h && Math.hypot(x - o.x, y - o.y) < o.r * 1.35 + 2) || L.marks.some((m: W) => Math.hypot(x - m.x, y - m.y) < 6) || nearName(x, y, 12)) continue
    const p = px(lit.ctx, x, y), q = px(ctl.ctx, x, y), c = q.map((v, i) => v - [7, 8, 16][i]), m = c.indexOf(Math.max(...c))
    if (c[m] >= 25) ring.push(+((q[m] - p[m]) / c[m]).toFixed(3))
  }
  ring.sort((u, v) => u - v)
  const hand = new Set((a._dealtOpts(L.place, a.nodes[L.place].role === "bottom" ? "bottom" : "top") || []).map((o: W) => o.idx))
  return { ring, L: { k: L.k, place: L.place, holes: L.holes.length, moves: L.holes.filter((h: W) => !h.place).map((h: W) => h.i), marks: L.marks.length }, plain, holes, name, nameOut, hand: [...hand] }
})

/**
 * EVERY MOVE THE LIT PLACE DEALS, read apart from the light's own record (S1-R1, the reader's finding 3: the journey read
 * "three or more stand clear" and "every move lit is one it deals", a subset, and a cull pulled inside the view, a cache
 * that forgot its place or its ruleset, and no marks at all each left it green). The hand is the app's own deal
 * (`_dealtOpts`, as the rating deals it); each move's orb is projected through the frame's own camera and lift, and it is
 * ON THE VISIBLE MAP when it is on the canvas and `elementFromPoint` there is the map (not the drawer, not a card). Read:
 *   visible  the hand's moves on the visible map, each lit (a hole, or a mark above the layer), none dimmed;
 *   extra    what is lit that the place does not deal in this ruleset;
 *   marks    each mark's pixel against what the layer would make of the control there (`over`: brighter by that much).
 */
const census = (page: Page) => page.evaluate(() => {
  const a = (window as W).__neural, live = a.ctx, dpr = a.dpr || 1
  const shot = () => {
    const c = document.createElement("canvas"); c.width = live.canvas.width; c.height = live.canvas.height
    const ctx = c.getContext("2d", { willReadFrequently: true })!
    a.ctx = ctx; ctx.save()
    try { a.draw() } finally { a.ctx = live; ctx.restore() }
    return { ctx, light: a._lastLight ? JSON.parse(JSON.stringify(a._lastLight)) : null }
  }
  const lit = shot()
  const keep = { shown: a._shown, k: a._lightK, at: a._lightAt, t: a._lightT, s: a._lightS }
  let ctl: W
  a._shown = null; a._lightK = 0
  try { ctl = shot() } finally { a._shown = keep.shown; a._lightK = keep.k; a._lightAt = keep.at; a._lightT = keep.t; a._lightS = keep.s }
  a.draw()
  const L = lit.light
  if (!L) return null
  const px = (c: W, x: number, y: number) => { const d = c.getImageData(Math.floor(x * dpr), Math.floor(y * dpr), 1, 1).data; return [d[0], d[1], d[2]] }
  const sc = a.W / a.cam.vw, at = (n: W) => ({ x: a.W / 2 + (n.x - a.cam.cx) * sc, y: a.H / 2 + (a._LY(n) - a.cam.cy) * sc })
  const place = a.nodes[L.place], cr = a.canvas.getBoundingClientRect()
  const hand = [...new Set((a._dealtOpts(L.place, place.role === "bottom" ? "bottom" : "top") || []).map((o: W) => o.idx))] as number[]
  const lt = new Set([...L.holes.filter((h: W) => !h.place).map((h: W) => h.i), ...L.marks.map((m: W) => m.i)])
  const visible = hand.map((i) => {
    const o = at(a.nodes[i]), on = o.x >= 0 && o.x <= a.W && o.y >= 0 && o.y <= a.H
    const el = on ? document.elementFromPoint(cr.left + o.x, cr.top + o.y) : null
    return { i, t: a.nodes[i].t as string, seen: !!el && (el === a.canvas || el === a.wrapRef.current), lit: lt.has(i) }
  }).filter((r) => r.seen)
  const marks = L.marks.map((m: W) => { const p = px(lit.ctx, m.x, m.y), q = px(ctl.ctx, m.x, m.y); return { i: m.i, over: Math.max(...p.map((v, k) => v - (0.6 * q[k] + 0.4 * [7, 8, 16][k]))) } })
  return { place: L.place, gi: a._giMode as string, hand: hand.length, visible: visible.length, dark: visible.filter((r) => !r.lit).map((r) => r.t),
    extra: [...lt].filter((i) => !hand.includes(i as number)).map((i) => a.nodes[i as number].t as string), holes: L.holes.length, marks }
})
/** each frame the light draws from now on: [paused, a film playing, its strength, a place still shown] (the light's own
 *  draw, wrapped once a page: what each frame of the running app did, whatever pumps it) */
const watch = (page: Page) => page.evaluate(() => {
  const a = (window as W).__neural; a.__lk = []
  if (a.__lkw) return
  a.__lkw = 1; const f = a._drawLight.bind(a)
  a._drawLight = (ctx: W, F: W) => { f(ctx, F); a.__lk.push([a.paused ? 1 : 0, a._replay ? 1 : 0, a._lastLight ? +a._lastLight.k.toFixed(3) : 0, a._shown ? 1 : 0]) }
})
const watched = (page: Page) => page.evaluate(() => { const a = (window as W).__neural; a.advance(1000 / 60); return a.__lk as number[][] })
/** the first frame of the running game (or of a film) and the frame before it, from what `watch` saw */
const atResume = (f: number[][]) => { const i = f.findIndex((r) => r[0] === 0 || r[1] === 1); return { before: i > 0 ? f[i - 1] : null, first: i >= 0 ? f[i] : null } }

for (const [label, vp] of [["mouse 1440x900 dpr 1", { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }],
  ["mouse 1440x900 dpr 2", { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }],
  ["touch 390x631 dpr 2", { viewport: { width: 390, height: 631 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }]] as const) {
  test.describe(label, () => {
    test.use(vp)
    const touch = label.startsWith("touch")

    test(`Show on the map lights the place: the map steps back, the place and the moves it deals stand clear, no name is dimmed (${label})`, async ({ page }) => {
      const j = await rolled(page, touch)
      await show(page, touch)
      // the arrival's bloom (`flare`, 3.2 s) is over, and the light is full: read it at rest, inside the camera's 7 s lease
      await j.advance(3600)
      if (!touch) await page.mouse.move(2, 2)   // the pointer off the map: it names nothing of its own
      await j.advance(100)
      const r = await ink(page)
      expect(r.L, "the map is lit").not.toBeNull()
      expect(r.L!.k, "at full strength").toBe(1)
      expect(r.L!.place, "and what is lit is the place shown: Mount, the half the row is about").toBe(await mountTop(page))
      expect(r.plain!.length, "premise: enough plain map to read (a floor: a count that ran on nothing would pass)").toBeGreaterThan(30)
      const worst = r.plain!.reduce((m: W, p: W) => (p.off > m.off ? p : m), { off: -1 })
      expect(worst.off, `the map steps back to 40% of rgb(7, 8, 16) everywhere it is not lit (worst at ${worst.x},${worst.y}: ${worst.p} against ${worst.q})`).toBeLessThanOrEqual(3)
      const place = r.holes!.filter((h: W) => h.place), moves = r.holes!.filter((h: W) => !h.place)
      expect(place.length, "premise: an orb of the place's pair is read").toBeGreaterThan(0)
      for (const h of place) expect(h.dimmed, `the place's orbs are not dimmed (orb ${h.i}: ${h.p} against ${h.q})`).toBeLessThanOrEqual(2)
      expect(moves.length, "premise: the moves it deals stand clear: three or more are in view").toBeGreaterThanOrEqual(3)
      for (const h of moves) expect(h.dimmed, `the moves it deals stand clear (move ${h.i}: ${h.p} against ${h.q})`).toBeLessThanOrEqual(2)
      expect(r.L!.moves.every((i: number) => r.hand!.includes(i)), "every move lit is one the place deals").toBe(true)
      expect(r.nameOut, "premise: the place's name reaches past the holes (its pixels there are read)").toBeGreaterThan(40)
      expect(r.name, "the place's name is not dimmed: it is drawn after the light (a dimmed name reads 155 at most)").toBeGreaterThanOrEqual(200)
      expect(await named(page), "and the map still names the place").toBe(true)
      expect(r.ring!.length, "premise: six or more readings of the holes' soft edges").toBeGreaterThanOrEqual(6)
      const mid = r.ring![Math.floor(r.ring!.length / 2)]
      expect(mid, `each hole's edge is soft: between the hole and the layer the map steps back about 23%, not 40% (median ${mid} of ${r.ring!.length})`).toBeLessThanOrEqual(0.31)
      // EVERY move it deals that the visible map shows is lit, counted against the hand (R6)
      const c = await census(page)
      expect(c && c.visible, "premise: three or more of its dealt moves are on the visible map").toBeGreaterThanOrEqual(3)
      expect(c!.dark, `every dealt move on the visible map is lit (${c!.visible} on it of ${c!.hand} dealt)`).toEqual([])
      expect(c!.extra, "and nothing is lit that the place does not deal").toEqual([])
    })
  })
}

test.describe("mouse 1440x900", () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test("on a desktop the light lasts while the drawer holds the game; the drawer shut by Esc lets the game run, and the light is out", async ({ page }) => {
    const j = await rolled(page, false)
    await show(page, false)
    await j.advance(1200)
    expect(await state(page), "premise: the drawer stays and holds the game").toMatchObject({ drawer: true, paused: true })
    expect((await light(page))?.k, "lit").toBe(1)
    await page.keyboard.press("Escape")
    await j.advance(450)
    expect((await state(page)).paused, "premise: the drawer shut, the game runs").toBe(false)
    expect(await light(page), "the game runs: the light is out").toBeNull()
    // v1.294.0: the next press on the bare map closes the page, and the place it named goes with it (J9)
    expect(await named(page), "premise: the place is still named, for the camera's hold").toBe(true)
    const p = await emptyMapPoint(page)
    expect(p, "premise: a point of the map with nothing on it").not.toBeNull()
    await page.mouse.click(p!.x, p!.y)
    await j.advance(450)
    expect(await where(page), "the press on the bare map closes the page: the map alone, the address the root").toMatchObject({ url: "/", roam: true, card: false })
    expect([await named(page), await shownAt(page)], "the name goes with it").toEqual([false, false])
    expect(await light(page), "and nothing is lit").toBeNull()
  })

  test("every move the place deals, and only those: the ruleset switched while lit, a second place shown after the first, and the marks when the map is pulled back", async ({ page }) => {
    const j = await rolled(page, false)
    await show(page, false)
    await j.advance(1500)
    let c = await census(page)
    expect([c && c.gi, c && c.dark, c && c.extra], "premise: Mount lit in gi, its hand and only its hand").toEqual(["gi", [], []])
    // the ruleset switched while lit (the app's own switch, as the ruleset journeys turn it): the no-gi hand, re-lit (R2)
    await page.evaluate(() => (window as W).__neural.setGiMode("nogi"))
    await j.advance(300)
    c = await census(page)
    expect(c && c.gi, "premise: no-gi, and still lit").toBe("nogi")
    expect(c!.extra, "the ruleset switched while lit: nothing of the other ruleset's hand stays lit").toEqual([])
    expect(c!.dark, "and every move of this ruleset's hand on the visible map is lit").toEqual([])
    await page.evaluate(() => (window as W).__neural.setGiMode("gi"))
    await j.advance(300)
    // a second place: the row of the place the roll stands on, pressed and shown as the first was (R1)
    const k2 = await page.evaluate(() => document.querySelector("[data-hist-current]")?.getAttribute("data-hist") || "")
    expect(k2 && k2 !== "Mount|Top", "premise: a second row, another place").toBe(true)
    await press(page, `[data-hist="${k2}"]`, "the second row", false)
    await press(page, `[data-hist="${k2}"] + .ng-hact [data-hist-show]`, "Show on the map, the second place", false)
    await j.advance(1500)
    c = await census(page)
    expect(c && c.place !== (await mountTop(page)), "premise: the second place is lit, not Mount").toBe(true)
    expect(c!.extra, "a second place lights its own hand, nothing of the first's").toEqual([])
    expect(c!.dark, "and all of its hand that the visible map shows").toEqual([])
    // pulled far back (the camera written as a pinch would leave it, inside the look's own hold: a real wheel on a computer
    // takes the camera, which ends the look), the moves are drawn too small for a hole: each a 4 px mark ABOVE the layer (R3)
    let marks: W[] = []
    for (const f of [4, 8, 16, 32]) {
      await page.evaluate((f) => { const a = (window as W).__neural; a.__vw0 = a.__vw0 || a.cam.vw; a.cam.vw = a.__vw0 * f; a.cam.lvw = Math.log(a.cam.vw); a.camTarget.vw = a.cam.vw }, f)
      c = await census(page)
      marks = (c && c.marks) || []
      if (marks.length >= 3) break
    }
    expect(marks.length, "premise: pulled back, three or more of its moves are marks").toBeGreaterThanOrEqual(3)
    for (const m of marks) expect(m.over, `each mark is drawn above the layer (move ${m.i}: ${m.over} brighter than the layer makes its point)`).toBeGreaterThan(40)
  })

  test("on a computer the look ends with its row, or with Last rolls: the name goes at once, and the light goes out over 400 ms with the game still held", async ({ page }) => {
    const j = await rolled(page, false)
    await show(page, false)
    await j.advance(1200)
    expect([(await light(page))?.k, await named(page)], "premise: lit and named").toEqual([1, true])
    await watch(page)
    await j.advance(17)   // a frame now, so the first frame after the press is the press's own
    await press(page, '[data-hist="Mount|Top"]', "the row of Mount, pressed again: collapsed", false)
    const f = await watched(page)
    expect(await named(page), "the row collapsed: the place is no longer named").toBe(false)
    const out = f.find((r) => r[3] === 0)
    expect(out && out[0], "premise: the frame that let the place go, with the game still held").toBe(1)
    expect(out![2] > 0 && out![2] < 1, `the light fades: neither full nor gone on the first frame after (${out![2]})`).toBe(true)
    await j.advance(450)
    expect(await light(page), "out after 400 ms").toBeNull()
    // shown again, then the drawer switched to Explore
    await show(page, false)
    await j.advance(1200)
    expect([(await light(page))?.k, await named(page)], "premise: lit and named again").toEqual([1, true])
    await press(page, '[data-view="explore"]', "Explore", false)
    await j.advance(17)
    expect(await named(page), "Last rolls left for Explore: the place is no longer named").toBe(false)
    await j.advance(450)
    expect(await light(page), "and the light is out").toBeNull()
  })

  for (const how of ["a move played from the hand", "▶ on a row", "a film started", "the round's countdown let go"] as const) {
    test(`the light goes out AT ONCE when the game starts again: ${how}`, async ({ page }) => {
      let j: W, ts = 0
      if (how === "a film started") {
        j = await rolled(page, false)
        // a roll filed in Last rolls has a film (its ⟲): the roll is filed as the board is staged again (as history-replay's)
        await page.evaluate(() => { const a = (window as W).__neural; a.rollFromPosition(a.currentPos, true) })
        await j.advance(1500)
        await dismissReward(page, false)
        ts = await page.evaluate(() => ((window as W).__neural._pastRolls || [])[0]?.ts || 0)
        expect(ts, "premise: a roll is filed, with its film").toBeGreaterThan(0)
      } else j = await rolled(page, false)
      if (how === "the round's countdown let go") {
        await page.evaluate(() => (window as W).__neural.endRound("win", "Armbar"))
        await j.advance(3800)
      }
      // (the film's case shows the staged board's own row: a filed roll's rows sit in its group; its key is read once Last
      // rolls is drawn)
      let key = "Mount|Top"
      if (how === "a film started") {
        await press(page, ".ng-logo", "open the drawer", false)
        if (!(await page.locator("[data-hist-current]").first().isVisible())) await press(page, '[data-view="history"]', "Last rolls", false)
        key = await page.evaluate(() => document.querySelector("[data-hist-current]")?.getAttribute("data-hist") || "")
        expect(key, "premise: the staged board has its row").not.toBe("")
      }
      await show(page, false, key)
      await j.advance(1200)
      expect((await light(page))?.k, "premise: lit in full, the game held").toBe(1)
      await watch(page)
      await j.advance(17)
      if (how === "a move played from the hand") {
        const t = await page.evaluate(() => { const a = (window as W).__neural; return (a.optionIdxs || []).map((i: number) => a.nodes[i].t as string)[0] || "" })
        await j.pick(t)
      } else if (how === "▶ on a row") await press(page, '[data-hist="Mount|Top"] .hplay', "▶, roll from Mount", false)
      else if (how === "a film started") await press(page, `[data-replay-roll="${ts}"]`, "the filed roll's film", false)
      else await page.keyboard.press("Escape")
      const r = atResume(await watched(page))
      expect(r.first, "premise: the game runs again (or a film plays)").not.toBeNull()
      expect(r.before && r.before[2], "lit in full up to the last frame of the held game").toBe(1)
      expect(r.first![2], `${how}: out on the first frame, not fading over the running game`).toBe(0)
    })
  }

  test("under reduced motion the light is full on the first frame after the press", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    const j = await rolled(page, false)
    await dismissReward(page, false)
    await press(page, ".ng-logo", "open the drawer", false)
    await press(page, '[data-view="history"]', "Last rolls", false)
    await press(page, '[data-hist="Mount|Top"]', "the row of Mount, top", false)
    expect(await page.evaluate(() => (window as W).__neural._reducedMotion()), "premise: the player's setting reaches the app").toBe(true)
    await j.advance(17)
    await press(page, "[data-hist-show]", "Show on the map", false)
    await j.advance(17)
    expect((await light(page))?.k, "under reduced motion the light is full on the first frame after the press").toBe(1)
  })

  test("the planner's bundle not in yet: nothing is drawn and that is said once; the place is still named", async ({ page }) => {
    // gameplan.js held, never answered (as practice-page.spec.ts holds it): the runtime that draws the light never arrives
    let held = 0
    const j = await rolled(page, false, async (p) => { await p.route("**/app/gameplan.js*", () => { held++ }) })
    await show(page, false)
    await j.advance(1500)
    expect(held, "premise: the planner's bundle was asked for and held").toBeGreaterThan(0)
    expect(await light(page), "nothing is drawn").toBeNull()
    expect(await beats(page, "light_cold"), "said once").toBe(1)
    expect(await named(page), "the place is still named").toBe(true)
  })
})

test.describe("touch 390x631", () => {
  test.use({ viewport: { width: 390, height: 631 }, hasTouch: true, isMobile: true })

  test("on a phone, after a look (v1.294.0: a press on the bare map closes the page): the press that ends the look closes nothing; the next one closes the page, and the name and the light go with it", async ({ page }) => {
    const j = await rolled(page, true)
    const was = await where(page)
    expect(was, "premise: a page of a place, its card up").toMatchObject({ roam: false, card: true })
    await show(page, true)
    await j.advance(1200)
    expect([await state(page), (await light(page))?.k], "premise: a look, lit").toEqual([{ paused: true, drawer: false, look: true }, 1])
    let p = await emptyMapPoint(page)
    expect(p, "premise: a point of the map with nothing on it").not.toBeNull()
    await page.touchscreen.tap(p!.x, p!.y)
    await j.advance(450)
    expect(await where(page), "the press that ends the look closes nothing: the page, its address and its card stay (J8)").toEqual(was)
    expect([(await state(page)).look, await light(page), await named(page)], "it ends the look: the light goes, the name stays (L3-R2)").toEqual([false, null, true])
    p = await emptyMapPoint(page)
    expect(p, "premise: a point of the map with nothing on it").not.toBeNull()
    await page.touchscreen.tap(p!.x, p!.y)
    await j.advance(450)
    expect(await where(page), "the next press on the bare map closes the page: the map alone, the address the root").toMatchObject({ url: "/", roam: true, card: false })
    expect([await named(page), await shownAt(page)], "the name goes with it").toEqual([false, false])
    expect(await light(page), "and nothing is lit").toBeNull()
    await j.advance(3000)
    expect([await named(page), await light(page)], "nor does either come back inside the camera's 7 s").toEqual([false, null])
  })

  test("on a phone the light lasts as long as the look; the press that ends it puts the light out and leaves the name; the drawer opened over a look opens on Explore, which ends the look: no name, no light", async ({ page }) => {
    const j = await rolled(page, true)
    await show(page, true)
    expect(await state(page), "premise: a look: the drawer shut, the clock held").toMatchObject({ drawer: false, paused: true, look: true })
    await j.advance(9000)
    expect((await light(page))?.k, "nine seconds on (past the camera's 7 s): the look holds, and so does the light").toBe(1)
    const p = await emptyMapPoint(page)
    expect(p, "premise: a point of the map with nothing on it").not.toBeNull()
    await page.touchscreen.tap(p!.x, p!.y)
    expect((await state(page)).paused, "premise: the press ends the look, the roll runs").toBe(false)
    await j.advance(450)
    expect(await light(page), "the roll runs: the light goes").toBeNull()
    expect(await named(page), "and the place stays named for the camera's hold (L3-R2)").toBe(true)
    // a second look, and the drawer opened over it inside the camera's hold: it opens on its home view, Explore, and Last rolls
    // left ends the look (S1-R1, ruling 2): the place is no longer shown, so nothing is lit under the drawer
    await show(page, true)
    await j.advance(1200)
    expect((await light(page))?.k, "premise: lit again").toBe(1)
    await press(page, ".ng-logo", "open the drawer over the look", true)
    await j.advance(450)
    expect(await state(page), "premise: the drawer is open").toMatchObject({ drawer: true })
    expect(await page.evaluate(() => (window as W).__neural._viewMode), "premise: it opens on its home view").toBe("explore")
    expect([await page.evaluate(() => !!(window as W).__neural._shownNode()), await named(page)], "Last rolls is not the drawer's view: the look is over, the place neither shown nor named").toEqual([false, false])
    expect(await light(page), "and nothing is lit under the drawer").toBeNull()
  })
})
