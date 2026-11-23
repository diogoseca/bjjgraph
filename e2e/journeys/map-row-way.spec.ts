import { expect, test, type Page } from "@playwright/test"
import { journey } from "../dsl"

/**
 * A ROW LIGHTS ITS WAY (L2b S4, v1.298.0). The orchestrator's ruling (d), 19 Nov 2026: "A lit row moves no camera, ever. It
 * writes its move's name first and draws ONE line, place → move → on toward where it leads. Where the destination is in view
 * it stands clear and is named; where it is not, the line simply runs off the edge of the view toward it, and the row's own
 * second line is where the player reads its name." And (a): "Before Show, a bar lights WHERE its move lives … the layer, the
 * place and that one move's orb standing clear; no name, no gold on it even where it is recalled, no line onward, no
 * destination." S4-GO, 23 Nov: two destinations, ONE line to the first; a move that keeps the place, place to move only;
 * the pointer's row while the pointer is over the rows, else the focused row; a tablet (measured: at 820x1180 the map stands
 * beside the drawer) lights a row by a tap on its name until the next tap, Hide, Done or the cloze leaving, in memory only.
 * Which row is lit: `ngClozeWay` (master-cloze.src.js), read from the DOM once a frame (`_czWay`); what it lights: `_drawLight`
 * and `ngLightDraw` (the line, `_lastLight.way`); its names: the "row" pass ahead of the cloze's (`draw()`).
 *
 * The player and the board are map-cloze-place.spec.ts's (Mount, bottom, owes five moves and remembers a sixth; the board
 * staged at Half Guard, top). Pressed by a real mouse at 1440x900 (moves over the rows, Tab for the focus) and a touch at
 * 820x1180, at points `elementFromPoint` confirms. What is read is what the frame published (`_lastLight`, its holes and its
 * way, `_lastNameBoxes`) and, for the line, its ink against a control frame drawn at the same instant with no row lit.
 *
 * MUTANTS, each built alone into the served bundle after a neutral control that left this file green; each RED at the step
 * named (the table and its date: docs/Changelog-Archive.md, v1.298.0):
 *   W1  no hole for the destination                    → "after Show…" at "the place it leads to stands clear"
 *   W2  the line under the map (drawn behind it)       → "after Show…" at "the line is drawn above the layer"
 *   W3  the lit row kept in a stored field             → "before Show…" at "the pointer away from the rows: nothing lit
 *       before Show" (the bar the opening press left under the pointer, kept)
 *   W4  a bar's move named                             → "before Show…" at "no name for it"; and master-cloze.spec.ts's
 *       "the hand is face down…" at "and still no name…" (it reads the map's names, `_lastNameBoxes`, since v1.298.0)
 *   W5  a bar's line drawn                             → "before Show…" at "no line"; and master-cloze.spec.ts's at
 *       "no gold on it, no line"
 *   W6  the camera moved for a row                     → "after Show…" at "the camera never moves"
 *   W7  focus ignored                                  → "the keyboard…" at "the focused row lights its way"
 *   W8  the layer dropping between two rows (its fade restarted at each row) → "moving from row to row…" at "the layer
 *       stays on". W8b, the layer only while a row is lit, is NOT red at that step: the cloze's rows touch, so the pointer
 *       crossing them is always on one (the stop midway lands on a row). It is red here only at "the line is drawn above
 *       the layer" (whose control frame, no row lit, then has no layer either), and it is S2's own claim, "after Show the
 *       place stays lit": map-cloze-place.spec.ts (its run: docs/Changelog-Archive.md, v1.298.0).
 *   W9  no row pass (the move named by the cloze's)    → "after Show…" at "its move named first"
 *   W10 the second place drawn (not the first)         → "two places…" at "one line, to the first"; and "after Show…" at
 *       "row 5: its way…"
 *   W11 a tablet's tap kept across Hide                → "a tablet…" at "Hide, and Show again: not lit"
 *   W12 hover read after a touch                       → "a tablet…" at "the same name again: off"
 *   W14 only a tap on a name ends it                   → "a tablet…" at "the next tap, anywhere: a row's Had it?"
 *   W16 the cloze's leaving not ending it              → "a tablet…" at "the cloze left and opened again: not lit"
 * The tablet's Hide, Done and leaving are pressed by a MOUSE (a tablet's trackpad) on purpose: a tap there is "the next
 * tap" and ends the light by itself, so only a press that is no tap shows each lifter on its own.
 * NOT COVERED HERE: a move that keeps the place or is itself the finish (none at Mount, bottom; the unit's,
 * tests/master_cloze.test.mjs); a phone (its look shows every hidden move as a pale mark, map-cloze-look.spec.ts); a bar's
 * move given gold (before Show its card is face down, and the light's gold is never drawn on a face-down move, so nothing
 * here can see it: the unit's, tests/map_light.test.mjs WY2); `ngClozeWay`'s own Done guard (the light's, `_lightOf`, ends
 * it first: the unit's, CW4); a drag on a tablet taken for a tap.
 */

type W = any
const DAY = 20774
const SEAT = "Mount|Bottom"
const PLACES = ["Mount|Bottom", "Side Control|Bottom", "Closed Guard|Bottom"]

async function press(page: Page, selector: string, what: string, touch: boolean, scroll = true) {
  if (scroll) await page.locator(selector).first().scrollIntoViewIfNeeded()
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

/** the seeded player (master-cloze.spec.ts's way): at Mount, bottom, five moves owed and a sixth remembered, not due; at the
 *  other places six owed. `at`: the board staged at that seat; `cards`: two cards due at Mount, bottom, too (the session
 *  then holds its deck, so the map rings the place) */
async function setup(page: Page, opts: { at: string; cards?: boolean }) {
  await page.addInitScript((d) => { (window as W).__NG_EPOCH_DAY__ = d }, DAY)
  const j = journey(page, { answerMode: "classic" })
  await j.boot("/", { initialState: { v: 2, explored: PLACES } })
  await expect.poll(() => page.evaluate(() => {
    const a = (window as W).__neural
    return !!(a && a.nodes && a.nodes.length && a.flashcards && a.flashcards.decks && Object.keys(a.flashcards.decks).length && a.curriculum)
  }), { timeout: 60_000, message: "graph, deck manifest and curriculum in" }).toBe(true)
  await j.advance(12000)   // the root intro finishes before a seat is staged
  const dealt = await page.evaluate(({ places, at, seat }: W) => {
    const a = (window as W).__neural, d = a._epochDay(), out: Record<string, number> = {}
    a.moves = a.moves || {}
    for (const k of places) {
      const i = a.nodeForKey(k), role = k.endsWith("|Bottom") ? "bottom" : "top", o = a._ordById.get(a.siteIdOf(a.nodes[i].id)), dl = a._dealtOrds(i, role) || []
      const row = (a.moves[o + "/" + role] = a.moves[o + "/" + role] || {})
      dl.slice(0, 6).forEach((m: string, n: number) => {
        row[m] = k === seat && n === 5 ? [d + 30, 30, d - 1, 1, 30, 30] : [d - 1 - n, 7, d - 8 - n, 1, 7, 7]   // the sixth at the seat: remembered, not due
      })
      out[k] = dl.length
    }
    a._movesRev = (a._movesRev || 0) + 1
    a._saveProgress(); a._flushSave()
    a.stageRollAt(a.nodeForKey(at), at.endsWith("|Bottom") ? "bottom" : "top")   // as a press on its place on the map stages it
    return out
  }, { places: PLACES, at: opts.at, seat: SEAT })
  for (const k of PLACES) expect(dealt[k], `premise: ${k} deals at least six moves`).toBeGreaterThanOrEqual(6)
  if (opts.cards) {
    const due = await page.evaluate(async (seat: string) => {
      const a = (window as W).__neural, day = a._epochDay()
      await a.hydrateDeck(seat)
      a.srs[seat] = a.srs[seat] || {}
      for (const c of (a._cardsOf(a.flashcards.decks[seat]) || []).slice(0, 2)) a.srs[seat][a.qhash(c.q)] = [day - 3, 7, day - 10]
      a._bumpStageVer && a._bumpStageVer()
      return Object.keys(a.srs[seat]).length
    }, SEAT)
    expect(due, "premise: two cards due at the place").toBe(2)
  }
  for (let i = 0; i < 16; i++) { await j.advance(1000); if (await page.evaluate(() => ((window as W).__neural.optionIdxs || []).length > 0)) break }
  await j.advance(2500)
  return j
}
async function openCloze(page: Page, touch: boolean) {
  await press(page, ".ng-logo", "open the drawer", touch, false)
  await press(page, '[data-explore-stats] [data-b="due"]', "the Master the game row", touch)
  await expect.poll(() => page.evaluate(() => (window as W).__neural._session?.plan?.order || null), { timeout: 30_000, message: "the worth plan lands" }).toBe("worth")
  await expect(page.locator(`[data-master-row="${SEAT}"]`).first(), "the place's row is painted").toBeVisible({ timeout: 30_000 })
  await press(page, `[data-master-row="${SEAT}"]`, "the place's row", touch)
  await expect(page.locator(`[data-cloze="${SEAT}"]`), "its cloze is open").toBeVisible()
}
/** the camera at rest: advance until it stops moving (the glide over), at most 4 s of frames */
async function settle(j: W, page: Page) {
  let last = ""
  for (let i = 0; i < 40; i++) {
    await j.advance(100)
    const now = await page.evaluate(() => { const a = (window as W).__neural; return [a.cam.cx, a.cam.cy, a.cam.vw].map((v: number) => v.toFixed(2)).join(",") })
    if (now === last) return
    last = now
  }
}
/** where the place's pair and the cloze's moves are on screen (each node's `pairMid` through the frame's camera), the calm
 *  area (the visible map, `_viewRect`, inset 34 / 38 / 34 / 37: design round 6, the ruling's figures), the zoom against the
 *  roll's own, and what the frame published: the light, the names, the place's label */
const view = (page: Page) => page.evaluate((seat) => {
  const a = (window as W).__neural, s = a._session, c = s && s.cz && s.cz.get(seat), hub = a.nodeForKey(seat), place = a._seatMember(hub, seat.endsWith("|Bottom") ? "bottom" : "top")
  const sc = a.W / a.cam.vw, R = a._viewRect(), at = (i: number) => { const p = a.pairMid(a.nodes[i]); return { i, x: a.W / 2 + (p.x - a.cam.cx) * sc, y: a.H / 2 + (p.y - a.cam.cy) * sc } }
  const calm = { l: R.left + 34, t: R.top + 38, r: R.left + R.width - 34, b: R.top + R.height - 37 }
  const pts = [place, a.nodes[place].pi].filter((i) => i >= 0).concat(c ? c.rows.map((r: W) => r.idx) : []).map(at)
  const label = [a._lastPairLabel, a._lastHoverLabel].find((l: W) => !!l && (l.idx === place || l.idx === a.nodes[place].pi))
  const boxes = (a._lastNameBoxes || []).map((b: W) => ({ w: b.w as string, i: b.i as number }))
  return { place, placePt: at(place), out: pts.filter((p: W) => p.x < calm.l || p.x > calm.r || p.y < calm.t || p.y > calm.b).map((p: W) => p.i), n: pts.length,
    zoom: a.cam.vw / (a.graphW * a.ROLL_ZOOM), named: !!label, light: a._lastLight ? { k: a._lastLight.k, place: a._lastLight.place } : null,
    clozeNames: boxes.filter((b: W) => b.w === "cloze").map((b: W) => b.i), rows: c ? c.rows.map((r: W) => r.idx) : [], hidden: c ? c.rows.filter((r: W) => r.ask).map((r: W) => r.idx) : [],
    solid: c ? c.rows.filter((r: W) => !r.ask).map((r: W) => r.idx) : [], boxes, czAt: !!a._czAt(), shown: !!(c && c.shown), done: !!(c && c.done) }
}, SEAT)
const moved = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)

/** the open cloze's rows: their move, kind, first lead and the point of their name (or bar) on screen */
const rowsOf = (page: Page) => page.evaluate((seat) => {
  const a = (window as W).__neural, c = a._session.cz.get(seat), els = [...document.querySelectorAll("[data-cz-row]")] as HTMLElement[]
  return c.rows.map((r: W, i: number) => {
    const el = els[i], t = (el.querySelector(".nm") || el.querySelector(".br") || el) as HTMLElement, b = t.getBoundingClientRect()
    return { i, idx: r.idx, ask: r.ask, leads: (r.leads || []).map((l: W) => l.idx), x: b.left + Math.min(8, b.width / 2), y: b.top + b.height / 2 }
  })
}, SEAT)
/** what the light drew this frame: its strength, what stands clear, its way; and the names the frame wrote */
const lit = (page: Page) => page.evaluate(() => {
  const a = (window as W).__neural, L = a._lastLight
  return { L: L ? { k: L.k, place: L.place, moves: L.holes.filter((h: W) => !h.place).map((h: W) => h.i).concat(L.marks.map((m: W) => m.i)), way: L.way } : null,
    names: (a._lastNameBoxes || []).map((b: W) => ({ w: b.w as string, i: b.i as number })), place: a._czAt() ? a._czAt().n.idx : -1 }
})
/** the place's projected point (the camera, read through the frame's own transform) */
const placeAt = (page: Page) => page.evaluate(() => { const a = (window as W).__neural, z = a._czAt(), p = a.pairMid(z.n), sc = a.W / a.cam.vw; return { x: a.W / 2 + (p.x - a.cam.cx) * sc, y: a.H / 2 + (p.y - a.cam.cy) * sc } })
/** the line's ink: the brightest pixel within 2 px of each segment's midpoint that lies on the visible map, in this frame and
 *  in a control frame drawn at the same instant with no row lit (the light's own record put back after) */
const lineInk = (page: Page) => page.evaluate(() => {
  const a = (window as W).__neural, live = a.ctx, dpr = a.dpr || 1
  const shot = () => { const c = document.createElement("canvas"); c.width = live.canvas.width; c.height = live.canvas.height; const ctx = c.getContext("2d", { willReadFrequently: true })!; a.ctx = ctx; ctx.save(); try { a.draw() } finally { a.ctx = live; ctx.restore() } return ctx }
  const L = a._lastLight, seg = L && L.way ? L.way.seg : []
  const litC = shot(), keep = a._czWay, keepSet = a._lightSet
  a._czWay = () => null
  let ctl: W
  try { ctl = shot() } finally { a._czWay = keep; a._lightSet = keepSet }
  a.draw()
  const R = a._viewRect(), cr = a.canvas.getBoundingClientRect()
  const max = (c: W, x: number, y: number) => { let m = 0; const d = c.getImageData(Math.floor((x - 2) * dpr), Math.floor((y - 2) * dpr), Math.ceil(4 * dpr), Math.ceil(4 * dpr)).data; for (let i = 0; i < d.length; i += 4) m = Math.max(m, d[i], d[i + 1], d[i + 2]); return m }
  return seg.map((q: number[]) => { const x = (q[0] + q[2]) / 2, y = (q[1] + q[3]) / 2, inMap = x > R.left + 4 && x < R.left + R.width - 4 && y > R.top + 4 && y < R.top + R.height - 4 && document.elementFromPoint(cr.left + x, cr.top + y) === a.canvas; return { x: Math.round(x), y: Math.round(y), inMap, lit: max(litC, x, y), ctl: max(ctl, x, y) } })
})
/** each frame the light draws from now on (its strength), the light's own draw wrapped once a page */
const watch = (page: Page) => page.evaluate(() => { const a = (window as W).__neural; a.__lk = []; if (a.__lkw) return; a.__lkw = 1; const f = a._drawLight.bind(a); a._drawLight = (c: W, F: W) => { f(c, F); a.__lk.push(a._lastLight ? +a._lastLight.k.toFixed(3) : 0) } })
const watched = (page: Page) => page.evaluate(() => (window as W).__neural.__lk as number[])

test.describe("1440x900, mouse", () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test("before Show, a bar under the pointer lights where its move lives: the place and that one move stand clear, no name for it, no line; leaving puts the light out", async ({ page }) => {
    const j = await setup(page, { at: "Half Guard|Top" })
    await openCloze(page, false)
    await settle(j, page)
    const rows = await rowsOf(page), bar = rows.find((r) => r.ask)!
    await page.mouse.move(2, 2)   // (the press that opened the cloze left the pointer over its rows)
    await j.advance(500)
    expect((await lit(page)).L, "the pointer away from the rows: nothing lit before Show (W3)").toBeNull()
    await page.mouse.move(bar.x, bar.y)
    await j.advance(400)
    const v = await lit(page)
    expect([v.L && v.L.k, v.L && v.L.place], "the layer comes, and the place is lit").toEqual([1, v.place])
    expect(v.L!.moves, "that one move stands clear, nothing else").toEqual([bar.idx])
    expect(v.names.filter((n) => n.i === bar.idx || n.w === "row" || n.w === "cloze"), "no name for it (W4)").toEqual([])
    expect(v.L!.way, "no line, no destination (W5)").toBeNull()
    await page.mouse.move(2, 2)
    await j.advance(100)
    const f = await lit(page)
    expect(f.L && f.L.moves, "while it fades, still that one move: never the place's whole hand").toEqual([bar.idx])
    await j.advance(400)
    expect((await lit(page)).L, "leaving puts the light out (W3)").toBeNull()
  })

  test("after Show, a row under the pointer lights its way: its move named first, one line place → move → on, the place it leads to standing clear and named where the map shows it; the camera never moves", async ({ page }) => {
    const j = await setup(page, { at: "Half Guard|Top" })
    await openCloze(page, false)
    await settle(j, page)
    await press(page, "[data-master-bar] [data-cz-show]", "Show", false, false)
    await settle(j, page)
    const rows = await rowsOf(page), p0 = await placeAt(page)
    let destNamed = 0, destHeld = 0, inks = 0
    for (const r of rows) {
      await page.mouse.move(r.x, r.y)
      await j.advance(300)
      const v = await lit(page)
      const want = r.leads.length && r.leads[0] !== r.idx ? r.leads[0] : null
      expect(v.L && v.L.way && [v.L.way.move, v.L.way.dest], `row ${r.i}: its way, the move and the first place it leads to`).toEqual([r.idx, want])
      expect(v.names.find((n) => n.i === r.idx)?.w, `row ${r.i}: its move named first, by the row's own pass (W9)`).toBe("row")
      if (want != null) {
        // where the frame drew it (the way's own end, `_lastLight.way.to`): on the visible map, and the canvas the top there
        const on = await page.evaluate(() => { const a = (window as W).__neural, p = a._lastLight.way.to, R = a._viewRect(), cr = a.canvas.getBoundingClientRect(); return !!p && p.x > R.left && p.x < R.left + R.width && p.y > R.top && p.y < R.top + R.height && document.elementFromPoint(cr.left + p.x, cr.top + p.y) === a.canvas })
        if (on) {
          expect(v.L!.moves, `row ${r.i}: the place it leads to stands clear (W1)`).toContain(want)
          destHeld++
          if (v.names.some((n) => n.i === want && n.w === "row")) destNamed++
        }
      }
      for (const s of (await lineInk(page)).filter((s: W) => s.inMap)) {
        inks++
        expect(s.lit - s.ctl, `row ${r.i}: the line is drawn above the layer (${s.lit} against ${s.ctl} at ${s.x},${s.y}) (W2)`).toBeGreaterThan(40)
      }
      const p = await placeAt(page)
      expect(moved(p, p0), `row ${r.i}: the camera never moves (W6)`).toBeLessThan(1)
    }
    expect([destHeld > 0, destNamed > 0, inks >= 3], "premise: destinations on the map, named, and the line's ink read").toEqual([true, true, true])
  })

  test("two places: one line, to the first; the second undrawn", async ({ page }) => {
    const j = await setup(page, { at: "Half Guard|Top" })
    await openCloze(page, false)
    await settle(j, page)
    await press(page, "[data-master-bar] [data-cz-show]", "Show", false, false)
    await settle(j, page)
    const two = (await rowsOf(page)).find((r) => r.leads.length === 2)
    expect(two, "premise: a row that leads to two places").toBeTruthy()
    await page.mouse.move(two!.x, two!.y)
    await j.advance(300)
    const v = await lit(page)
    expect([v.L!.way.dest, v.L!.moves.includes(two!.leads[1])], "one line, to the first; the second neither drawn nor lit (W10)").toEqual([two!.leads[0], false])
  })

  test("the keyboard: the focused row lights its way while the pointer is away from the cloze; the pointer's row wins over it", async ({ page }) => {
    const j = await setup(page, { at: "Half Guard|Top" })
    await openCloze(page, false)
    await settle(j, page)
    await page.mouse.move(2, 2)
    // the keyboard's way: the opened cloze holds the focus, Space shows it, Tab walks its rows' toggles
    expect(await page.evaluate(() => !!document.activeElement?.closest(".ngz")), "premise: the opened cloze holds the focus").toBe(true)
    await page.keyboard.press("Space")
    await settle(j, page)
    expect(await page.evaluate((seat) => (window as W).__neural._session.cz.get(seat).shown, SEAT), "premise: Space showed it").toBe(true)
    let at = -1
    for (let k = 0; k < 10 && at < 0; k++) {
      await page.keyboard.press("Tab")
      at = await page.evaluate(() => { const f = document.activeElement as HTMLElement | null, el = f && f.closest("[data-cz-row]"); return el ? [...document.querySelectorAll("[data-cz-row]")].indexOf(el) : -1 })
    }
    expect(at, "premise: Tab reaches a row of the cloze").toBeGreaterThanOrEqual(0)
    const rows = await rowsOf(page)
    await j.advance(300)
    expect((await lit(page)).L?.way?.move, "the focused row lights its way (W7)").toBe(rows[at].idx)
    const other = rows.find((r) => r.i !== at)!
    await page.mouse.move(other.x, other.y)
    await j.advance(300)
    expect((await lit(page)).L?.way?.move, "the pointer's row wins").toBe(other.idx)
    await page.mouse.move(2, 2)
    await j.advance(300)
    expect((await lit(page)).L?.way?.move, "the pointer away again: the focused row").toBe(rows[at].idx)
  })

  test("moving from row to row keeps the layer on: only the row's own way changes", async ({ page }) => {
    const j = await setup(page, { at: "Half Guard|Top" })
    await openCloze(page, false)
    await settle(j, page)
    await press(page, "[data-master-bar] [data-cz-show]", "Show", false, false)
    await settle(j, page)
    const rows = await rowsOf(page)
    await page.mouse.move(rows[0].x, rows[0].y)
    await j.advance(400)
    await watch(page)
    for (let i = 1; i < rows.length; i++) {
      await page.mouse.move((rows[i - 1].x + rows[i].x) / 2, (rows[i - 1].y + rows[i].y) / 2)   // between the two (a gap where there is one)
      await j.advance(100)
      await page.mouse.move(rows[i].x, rows[i].y)
      await j.advance(100)
    }
    const k = await watched(page)
    expect(k.length, "premise: frames drawn").toBeGreaterThan(5)
    expect(Math.min(...k), "the layer stays on, at full strength, on every frame between rows (W8)").toBeGreaterThan(0.99)
  })
})

test.describe("820x1180, touch (a tablet)", () => {
  test.use({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true })

  test("a tablet: a tap on a row's name lights its way until the next tap, Hide, Done or the cloze leaving", async ({ page }) => {
    const j = await setup(page, { at: "Half Guard|Top" })
    await openCloze(page, true)
    await settle(j, page)
    expect(await page.evaluate(() => { const a = (window as W).__neural, R = a._viewRect(); return [a.isMobile(), R.width > 300] }), "premise: a computer's layout, the map beside the drawer").toEqual([false, true])
    await press(page, "[data-master-bar] [data-cz-show]", "Show", true, false)
    await settle(j, page)
    const rows = await rowsOf(page), [r0, r1] = rows
    const way = async () => { await j.advance(500); return (await lit(page)).L?.way?.move ?? null }   // (past the light's 400 ms fade)
    const tap = async (r: { x: number; y: number }) => { await page.touchscreen.tap(r.x, r.y) }
    await tap(r0)
    expect(await way(), "a tap on a row's name lights its way").toBe(r0.idx)
    await tap(r1)
    expect(await way(), "the next tap on a name: that row").toBe(r1.idx)
    await tap(r1)
    expect(await way(), "the same name again: off (W12)").toBeNull()
    await tap(r0)
    expect(await way(), "lit again").toBe(r0.idx)
    // the next tap, anywhere: here the "Had it?" of another row
    const tg = await page.evaluate((i) => { const el = document.querySelectorAll("[data-cz-row]")[i].querySelector("[data-cz-had]") as HTMLElement, b = el.getBoundingClientRect(), x = b.left + b.width / 2, y = b.top + b.height / 2; return { x, y, on: el.contains(document.elementFromPoint(x, y)) } }, r1.i)
    expect(tg.on, "premise: the point is row 1's Had it?").toBe(true)
    await page.touchscreen.tap(tg.x, tg.y)
    expect(await way(), "the next tap, anywhere: a row's Had it? ends it (W14)").toBeNull()
    // the cloze left and opened again, by a mouse (a tablet's trackpad): it opens as it was, shown, and nothing is lit
    await tap(r0)
    expect(await way(), "lit again").toBe(r0.idx)
    await press(page, "[data-master-list]", "back to the list", false, false)
    await press(page, `[data-master-row="${SEAT}"]`, "the place's row again", false)
    await expect(page.locator(`[data-cloze="${SEAT}"]`), "its cloze is open again").toBeVisible()
    await page.mouse.move(2, 2)
    expect(await page.evaluate((seat) => (window as W).__neural._session.cz.get(seat).shown, SEAT), "premise: it opens as it was, shown").toBe(true)
    expect(await way(), "the cloze left and opened again: not lit (W16)").toBeNull()
    // Hide and Show again, by the mouse
    const again = await rowsOf(page)
    await tap(again[0])
    expect(await way(), "lit again").toBe(again[0].idx)
    await press(page, "[data-master-bar] [data-cz-hide]", "Hide", false, false)
    expect(await way(), "Hide puts it out").toBeNull()
    await press(page, "[data-master-bar] [data-cz-show]", "Show", false, false)
    await page.mouse.move(2, 2)
    expect(await way(), "Hide, and Show again: not lit (W11)").toBeNull()
    // Done, by the mouse
    await tap(again[0])
    expect(await way(), "lit again").toBe(again[0].idx)
    await press(page, "[data-master-bar] [data-cz-done]", "Done", false, false)
    await page.mouse.move(2, 2)
    expect(await way(), "Done puts it out").toBeNull()
  })
})
