import { expect, test, type Page } from "@playwright/test"
import { journey } from "../dsl"

/**
 * A PHONE'S LOOK FROM THE CLOZE (L2b S3, v1.297.0). The orchestrator's ruling (b) on L2b Part A, 19 Nov 2026: "A 'Map'
 * control in the cloze's foot (measure the fit on a real 390x631 screen first; if Done's words do not fit beside it, the
 * small press at the right of the place's heading line); the panel shuts, the session is kept, the clock held by the
 * look's own latch with the same lifters; the map frames the place and its moves; the light on for as long as the look
 * lasts; hidden moves pale marks, shown moves named where a name fits. Back by the pill '‹ Back to your moves' AND by a tap
 * on the map, consumed; a drag or a pinch moves the map and does not end this look. Offered before Done only." Measured
 * at 390x631 (19 Nov): Done's words do not fit beside it in the foot (Done 14 px wide), so "Map" is at the right of the
 * place's heading line. On a phone only: a computer's map stands beside the drawer (map-cloze-place.spec.ts).
 * What is pinned elsewhere: the look's state and the pale marks (tests/map_light.test.mjs, LK1 to LK7).
 *
 * The player of map-cloze-place.spec.ts: Mount, bottom, owes five moves and remembers a sixth. A LIVE roll at Half Guard,
 * top (`j.land`): the drawer is what stops it, so the look takes the drawer's pause. Pressed by a touch tap at 390x631 at
 * points `elementFromPoint` confirms, and by a mouse in a window as narrow (a phone's width with a mouse, §6.1).
 *
 * MUTANTS, each built alone into the served bundle under the lock, after a neutral control that left this file green;
 * every one RED at the step named (the table and its date: docs/Changelog-Archive.md, v1.297.0):
 *   M1  no Map press                                  → "Map before Show…" at "Map: the point under the press is the control"
 *   M2  the session dropped as the drawer shuts       → the same test, at "the session is the same, its cloze open"
 *   M3  the look not lit                               → the same test, at "the place is lit for as long as the look lasts"
 *   M4  a hidden move drawn as a hole (not pale)       → the same test, at "each hidden move a pale mark, never gold, no name"
 *   M5  no pill                                        → the same test, at "the pill stands in the map, a thumb's size"
 *   M6  a drag ends the look                           → the same test, at "a drag moves the map and the look stays"
 *   M7  the tap not consumed (no way back by the map)  → the same test, at "a tap on the map brings the drawer back"
 *   M8  Map after Done                                 → "after Show…" at "after Done there is no Map"
 *   M9  Esc does not bring the drawer back             → "a narrow window with a mouse…" at "Esc brings the drawer back"
 *   M10 a computer shows Map                           → "a computer has no Map" at "no Map press at 1440"
 *   M11 the look framed in the ordinary calm area       → "Map before Show…" at "nothing the look shows is under the pill"
 *   M12 the press at the practice page's 44 px floor   → "Map before Show…" at "the Map press is small and clear of the day's goal
 *       (`.ng-mslim .ng-czmap{min-height:0}` gone)          line"
 * NOT COVERED HERE: a real pinch (Playwright sends one finger; the pinch's start resets the tap, `czTap`); the hand held
 * down during the look when the roll stands at the place (the unit's, LK6); a film during a look (a film is started in
 * the drawer, whose opening ends the look). The harness serves `{}` for dossiers: nothing here reads a film or an article.
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

/** the seeded player (map-cloze-place.spec.ts's, master-cloze.spec.ts's way): at Mount, bottom, five moves owed and a sixth remembered, not due; at the
 *  other places six owed. `at`: the board staged at that seat; `cards`: two cards due at Mount, bottom, too (the session
 *  then holds its deck, so the map rings the place) */
async function setup(page: Page, opts: { at?: string; live?: string; cards?: boolean }) {
  await page.addInitScript((d) => { (window as W).__NG_EPOCH_DAY__ = d }, DAY)
  const j = journey(page, { answerMode: "classic" })
  await j.boot("/", { initialState: { v: 2, explored: PLACES } })
  await expect.poll(() => page.evaluate(() => {
    const a = (window as W).__neural
    return !!(a && a.nodes && a.nodes.length && a.flashcards && a.flashcards.decks && Object.keys(a.flashcards.decks).length && a.curriculum)
  }), { timeout: 60_000, message: "graph, deck manifest and curriculum in" }).toBe(true)
  if (opts.live) await j.land(opts.live)   // a live roll there: the drawer is what stops it (the look takes that pause)
  else await j.advance(12000)   // the root intro finishes before a seat is staged
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
    if (at) a.stageRollAt(a.nodeForKey(at), at.endsWith("|Bottom") ? "bottom" : "top")   // as a press on its place on the map stages it
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
  if (!opts.live) { for (let i = 0; i < 16; i++) { await j.advance(1000); if (await page.evaluate(() => ((window as W).__neural.optionIdxs || []).length > 0)) break } }
  await j.advance(2500)
  return j
}
async function dismissReward(page: Page, touch: boolean) {
  for (let i = 0; i < 4 && (await page.locator("[data-reward-close]").isVisible()); i++) {
    await press(page, "[data-reward-close]", "put the earned reward away", touch, false)
    await page.waitForTimeout(150)
  }
}
async function openCloze(page: Page, touch: boolean) {
  await press(page, ".ng-logo", "open the drawer", touch, false)
  await press(page, '[data-explore-stats] [data-b="due"]', "the Master the game row", touch)
  await expect.poll(() => page.evaluate(() => (window as W).__neural._session?.plan?.order || null), { timeout: 30_000, message: "the worth plan lands" }).toBe("worth")
  await expect(page.locator(`[data-master-row="${SEAT}"]`).first(), "the place's row is painted").toBeVisible({ timeout: 30_000 })
  await press(page, `[data-master-row="${SEAT}"]`, "the place's row", touch)
  await expect(page.locator(`[data-cloze="${SEAT}"]`), "its cloze is open").toBeVisible()
  // a reward the session minted can lie over the drawer's top, over the place's heading line: put away, as a player does
  await dismissReward(page, touch)
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

const look = (page: Page) => page.evaluate((seat) => {
  const a = (window as W).__neural, s = a._session, c = s && s.cz && s.cz.get(seat), L = a._lastLight
  const hidden = c ? c.rows.filter((r: W) => r.ask && !c.shown).map((r: W) => r.idx) : []
  const pill = document.querySelector("[data-cz-back]") as HTMLElement | null, pr = pill && !pill.hidden ? pill.getBoundingClientRect() : null
  const cv = a.canvas.getBoundingClientRect(), R = a._viewRect()
  return { drawer: !!a.deckShown, paused: !!a.paused, held: !!a._lookAutoPaused, pane: !!a._paneAutoPaused, on: !!a._czLookOn(), same: s === (window as W).__ngS, open: s ? s.czOpen : null,
    light: L ? { k: L.k, place: L.place, holes: L.holes.map((h: W) => h.i), marks: L.marks.map((m: W) => ({ i: m.i, gold: m.gold, pale: !!m.pale })) } : null,
    hidden, names: (a._lastNameBoxes || []).map((b: W) => ({ w: b.w as string, i: b.i as number })),
    pill: pr ? { x: pr.left + pr.width / 2, y: pr.top + pr.height / 2, h: pr.height, top: pr.top, bottom: pr.bottom, inMap: pr.top >= cv.top + R.top && pr.bottom <= cv.top + R.top + R.height && pr.left >= cv.left + R.left && pr.right <= cv.left + R.left + R.width, hit: document.elementFromPoint(pr.left + pr.width / 2, pr.top + pr.height / 2) === pill } : null,
    bars: document.querySelectorAll(`[data-cloze="${seat}"] [data-cz-row="ask"] .br`).length, shown: !!(c && c.shown), place: a._seatMember(a.nodeForKey(seat), "bottom") }
}, SEAT)
const beats = (page: Page, name: string) => page.evaluate((n) => ((window as W).__neural.beats || []).filter((b: W) => b.beat === n).map((b: W) => ({ ...b })), name)
/** the roll as a player would know it (last-rolls-places.spec.ts's): where it stands, its hand, its card, what is staged */
const theRoll = (page: Page) => page.evaluate(() => {
  const a = (window as W).__neural
  return { stands: a.currentPos as number, hand: (a.optionIdxs || []).join(","), journey: a._journeyId as number, staged: a._staged ?? null, roam: !!a._roam,
    card: a._landEl && a._landEl.isConnected ? (a._landIdx as number) : null, url: location.pathname }
})
/** a point of the visible map with nothing under it (the app's own hover test), or with a node under it (`node`) */
const mapPoint = (page: Page, node: boolean) => page.evaluate((node) => {
  const a = (window as W).__neural, c = a.canvas.getBoundingClientRect(), R = a._viewRect()
  for (let y = c.top + R.top + 14; y < c.top + R.top + R.height - 60; y += 9) for (let x = c.left + R.left + 14; x < c.left + R.left + R.width - 14; x += 11) {
    if (document.elementFromPoint(x, y) !== a.canvas) continue
    a._updateHover({ clientX: x, clientY: y, type: "pointerup", target: a.canvas }); const h = a._hover ? a._hover.idx : -1; a._hover = null
    if (node ? h >= 0 : h < 0) return { x, y, node: h }
  }
  return null
}, node)

test.describe("390x631, touch", () => {
  test.use({ viewport: { width: 390, height: 631 }, hasTouch: true, isMobile: true })

  test("Map before Show: the drawer shuts on the cloze and the look holds the clock; the place lit, its hidden moves pale marks; a drag keeps the look, a tap brings the drawer back and does nothing else", async ({ page }) => {
    const j = await setup(page, { live: "Half Guard Top" })
    expect(await page.evaluate(() => !!(window as W).__neural.paused), "premise: the roll is live").toBe(false)
    await openCloze(page, true)
    await page.evaluate(() => { (window as W).__ngS = (window as W).__neural._session })
    expect(await look(page), "premise: the drawer stopped the game").toMatchObject({ drawer: true, paused: true, pane: true })
    // the press: small to the eye, a thumb's size to the touch, and clear of the day's goal line under the heading
    const mp = await page.evaluate(() => {
      const m = document.querySelector("[data-cz-map]") as HTMLElement, r = m.getBoundingClientRect(), g = document.querySelector("[data-master-slim] [data-plan-goal]") as HTMLElement
      const gr = g.getBoundingClientRect(), hit = (x: number, y: number) => m.contains(document.elementFromPoint(x, y))
      return { h: r.height, overGoal: r.bottom > gr.top + 1, edges: [hit(r.left + r.width / 2, r.top + r.height / 2 - 20), hit(r.left + r.width / 2, r.top + r.height / 2 + 20)] }
    })
    expect([mp.h <= 24, mp.overGoal], "the Map press is small and clear of the day's goal line").toEqual([true, false])
    expect(mp.edges, "and a thumb's press 40 px tall around it is still on it").toEqual([true, true])
    await press(page, "[data-cz-map]", "Map", true)
    await settle(j, page)
    let v = await look(page)
    expect([v.same, v.open], "the session is the same, its cloze open").toEqual([true, SEAT])
    expect([v.drawer, v.paused, v.held, v.pane, v.on], "the drawer is shut and the clock is the look's").toEqual([false, true, true, false, true])
    expect((await beats(page, "look_held")).length, "the hold says it was taken").toBe(1)
    const where = await view(page)
    expect(where.out, "the map frames the place and its moves (the visible map, inset)").toEqual([])
    expect(v.light && v.light.k, "the place is lit for as long as the look lasts").toBe(1)
    expect(v.light!.place, "the place is the half the cloze's seat plays").toBe(v.place)
    expect(v.hidden.length, "premise: five hidden moves").toBe(5)
    const marks = new Map(v.light!.marks.map((m: W) => [m.i, m]))
    for (const i of v.hidden) {
      expect(v.light!.holes.includes(i), "each hidden move a pale mark, never gold, no name: not a hole").toBe(false)
      if (marks.has(i)) expect(marks.get(i), "each hidden move a pale mark, never gold, no name").toMatchObject({ gold: false, pale: true })
    }
    expect(v.hidden.filter((i: number) => marks.has(i)).length, "premise: the hidden moves on screen are read").toBeGreaterThan(0)
    expect(v.names.filter((b: W) => v.hidden.includes(b.i)), "each hidden move a pale mark, never gold, no name: no name").toEqual([])
    expect(v.pill, "the pill stands in the map, a thumb's size").not.toBeNull()
    expect([v.pill!.inMap, v.pill!.h >= 44, v.pill!.hit], "the pill stands in the map, a thumb's size, and nothing is over it").toEqual([true, true, true])
    // the glide keeps what it shows clear of the pill (NG_LIGHT.lookCalm): no lit orb, no mark and no name under it
    const under = await page.evaluate(() => {
      const a = (window as W).__neural, p = (document.querySelector("[data-cz-back]") as HTMLElement).getBoundingClientRect(), cv = a.canvas.getBoundingClientRect(), L = a._lastLight
      const inP = (x: number, y: number, r: number) => x + r > p.left - cv.left && x - r < p.right - cv.left && y + r > p.top - cv.top && y - r < p.bottom - cv.top
      return L.holes.filter((h: W) => inP(h.x, h.y, h.hw)).map((h: W) => h.i).concat(L.marks.filter((m: W) => inP(m.x, m.y, 2)).map((m: W) => m.i),
        (a._lastNameBoxes || []).filter((b: W) => b.l < p.right - cv.left && b.r > p.left - cv.left && b.t < p.bottom - cv.top && b.b > p.top - cv.top).map((b: W) => b.i))
    })
    expect(under, "nothing the look shows is under the pill").toEqual([])
    // a drag moves the map and does not end the look (a mouse drag: Playwright's touch has a tap alone)
    const free = await mapPoint(page, false)
    expect(free, "premise: a free point of the map").not.toBeNull()
    const p0 = (await view(page)).placePt
    await page.mouse.move(free!.x, free!.y); await page.mouse.down(); await page.mouse.move(free!.x + 30, free!.y + 8, { steps: 5 }); await page.mouse.up()
    await j.advance(300)
    v = await look(page)
    expect([v.drawer, v.on, v.paused, (v.light && v.light.k) === 1, !!v.pill], "a drag moves the map and the look stays").toEqual([false, true, true, true, true])
    expect(Math.hypot((await view(page)).placePt.x - p0.x, (await view(page)).placePt.y - p0.y), "premise: the map moved").toBeGreaterThan(10)
    // a tap on the map: the way back, and nothing else (no roll staged, no card or page closed, the address as it was)
    const was = await theRoll(page)
    const tap = await mapPoint(page, false)
    await page.touchscreen.tap(tap!.x, tap!.y)
    await j.advance(450)
    v = await look(page)
    expect([v.drawer, v.on], "a tap on the map brings the drawer back").toEqual([true, false])
    expect([v.same, v.open, v.bars], "on the same cloze, its bars as they were").toEqual([true, SEAT, 5])
    expect([v.paused, v.pane, v.held], "the pause is the drawer's again").toEqual([true, true, false])
    expect((await beats(page, "look_ended")).map((b: W) => b.by), "the look says how it ended").toEqual(["drawer"])
    expect(v.light, "and the light is out").toBeNull()
    expect(await theRoll(page), "the tap did nothing else").toEqual(was)
  })

  test("after Show the look names the shown moves; a tap on a place on the map only brings the drawer back; the pill does too; after Done there is no Map", async ({ page }) => {
    const j = await setup(page, { live: "Half Guard Top" })
    await openCloze(page, true)
    await page.evaluate(() => { (window as W).__ngS = (window as W).__neural._session })
    await press(page, "[data-master-bar] [data-cz-show]", "Show", true, false)
    await j.advance(400)
    await press(page, "[data-cz-map]", "Map", true)
    await settle(j, page)
    // the names: a name the layout refused during the glide comes back only half a second after the camera rests
    // (`_planNames`: "at rest until half a second after it left"), so they are read after that, not on the first still frame
    await j.advance(700)
    let v = await look(page)
    expect([v.on, v.shown], "premise: a look after Show").toEqual([true, true])
    expect(v.light!.marks.filter((m: W) => m.pale), "nothing is hidden now: no pale mark").toEqual([])
    expect(v.names.filter((b: W) => b.w === "cloze").length, "the shown moves are named where a name fits").toBeGreaterThan(0)
    const was = await theRoll(page)
    const node = await mapPoint(page, true)
    expect(node, "premise: a place on the map under a finger").not.toBeNull()
    await page.touchscreen.tap(node!.x, node!.y)
    await j.advance(450)
    v = await look(page)
    expect([v.drawer, v.on, v.same, v.shown], "a tap on a place brings the drawer back on the same shown cloze").toEqual([true, false, true, true])
    expect(await theRoll(page), "and opens nothing, stages nothing, closes nothing").toEqual(was)
    await press(page, "[data-cz-map]", "Map", true)
    await j.advance(400)
    expect((await look(page)).on, "premise: looking again").toBe(true)
    await press(page, "[data-cz-back]", "the pill", true, false)
    await j.advance(450)
    v = await look(page)
    expect([v.drawer, v.on, v.same, v.shown], "the pill brings the drawer back on the same shown cloze").toEqual([true, false, true, true])
    await press(page, "[data-master-bar] [data-cz-done]", "Done", true, false)
    await j.advance(400)
    expect(await page.evaluate(() => { const m = document.querySelector("[data-cz-map]") as HTMLElement | null; return !!m && !m.hidden }), "after Done there is no Map").toBe(false)
  })
})

test.describe("390x631, mouse", () => {
  test.use({ viewport: { width: 390, height: 631 } })

  test("a narrow window with a mouse: Map and the pill by the mouse; Esc brings the drawer back", async ({ page }) => {
    const j = await setup(page, { live: "Half Guard Top" })
    await openCloze(page, false)
    await press(page, "[data-cz-map]", "Map", false)
    await j.advance(400)
    expect((await look(page)).on, "the mouse opens the look").toBe(true)
    await press(page, "[data-cz-back]", "the pill", false, false)
    await j.advance(400)
    expect((await look(page)).drawer, "the pill by the mouse brings the drawer back").toBe(true)
    await press(page, "[data-cz-map]", "Map", false)
    await j.advance(400)
    expect((await look(page)).on, "premise: looking again").toBe(true)
    await page.keyboard.press("Escape")
    await j.advance(400)
    const v = await look(page)
    expect([v.drawer, v.on, v.open], "Esc brings the drawer back, on the cloze").toEqual([true, false, SEAT])
  })
})

test.describe("1440x900, mouse", () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test("a computer has no Map: the map stands beside the drawer", async ({ page }) => {
    await setup(page, { at: "Half Guard|Top" })
    await openCloze(page, false)
    expect(await page.evaluate(() => { const m = document.querySelector("[data-cz-map]") as HTMLElement | null; return !!m && !m.hidden }), "no Map press at 1440").toBe(false)
  })
})
