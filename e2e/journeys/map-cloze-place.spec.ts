import { expect, test, type Page } from "@playwright/test"
import { journey } from "../dsl"

/**
 * A CLOZE'S PLACE ON THE MAP (L2b S2, v1.296.0). The orchestrator's ruling (d) on L2b Part A, 19 Nov 2026: "When a place's
 * cloze opens, the map goes to the place and its moves … At Show, one glide holds the place and its SHOWN moves (not where
 * they lead): never closer than the roll's zoom, held for as long as the cloze shows (a hold of its own, beside
 * `_conceptId`'s; released at once when the cloze goes), with the light on from Show until Hide, Done or the place is
 * left, the shown moves named where a name fits"; and (c): "No pulsing session ring for the lit place while the light is
 * on". On a computer, where the map stands beside the drawer; a phone's drawer is the screen (its look is S3).
 * What is pinned elsewhere: the light itself, by the ink (map-light.spec.ts); when the place is held and lit and the glide's
 * own rule (tests/map_light.test.mjs, CZ1 to CZ6).
 *
 * The player: Mount, bottom, owes five moves (answered a week ago) and remembers a sixth (a Yes, not due: a "solid" row), as
 * master-cloze.spec.ts seeds its places, by the map's own ordinals. The board is STAGED at Half Guard, top, as a press on
 * its place on the map stages it (`stageRollAt`: set, held, never played; five roll-zoom views from Mount on this map,
 * measured 19 Nov): the board whose own framing takes the camera back when nothing holds it (`stagedIdle`). A roll made
 * from a place with the clock held (`rollFromPosition(…, true)`) is NOT such a board: nothing there moves the camera
 * under the drawer's pause, and on it the hold's mutant survived (K2, first run). Positions are read
 * through the frame's own transform (`pairMid` with `cam`), never `camTarget` (CLAUDE.md 6.2). Pressed by a real mouse at
 * 1440x900 and a touch tap at 390x631, at points `elementFromPoint` confirms are the control.
 *
 * MUTANTS, each built alone into the served bundle under the lock, after a neutral control that left this file green;
 * every one RED at the step named (the table and its date: docs/Changelog-Archive.md, v1.296.0):
 *   K1  no glide as a cloze opens                         → "opening a place's cloze…" at "the place and its moves are in the calm area"
 *   K2  no hold (`updateCamera` without `_czAt`)          → the same test, at "the place and its moves are in the calm area" (the
 *       staged board's own framing takes the camera back before the glide lands)
 *   K3  the hold kept with the drawer shut                → the same test, at "Esc: the hold is gone, and the board's own framing…"
 *   K4  lit before Show                                   → the same test, at "nothing is lit before Show"
 *   K10 the place not named                               → the same test, at "the map names the place"
 *   K12 the cloze's moves named before Show               → the same test, at "no move of the cloze is named before Show"
 *   K5  lit after Done                                    → "at Show…" at "Done: the light is out"
 *   K6  a glide at Show with everything in view            → the same test, at "nothing moves at Show"
 *   K7  the shown moves not named                         → the same test, at "the shown moves are named where a name fits"
 *   K13 the roll's own hand named while the cloze is lit  → "at Show…" at "the map's own names step back", and "standing at the
 *       place…" at "no orb is named twice" (there the hand is the cloze's own moves)
 *   K9  the lit place's session ring drawn                → "…wears no session ring" at "the place's ring is not drawn"
 *   K11 the place taken on a phone too (`_czAt`)          → "on a phone…" at "the cloze moves nothing on the map"
 * S2-R1 (23 Nov 2026; the reader of PR #449 and the orchestrator's rulings 1 and 2):
 *   KH1 the hold kept while the game runs (`updateCamera` without `paused`) → "a move played beside an open cloze…" (both)
 *       at "the camera is the roll's again"
 *   S8  the cloze's names over a running game (`czLit` without `paused`, the reader's) → "…after Show" at "none of the
 *       cloze's names stay while the roll runs"
 * NOT KILLED, AND WHAT WOULD: the reader's S11 (the glide only on the player's own press, `fresh ||` dropped) is equivalent on
 * every door tried: Practise here and a row's press are both `mine`. It needs a door that opens a place's cloze without the
 * player's press on that place (a plan that lands and opens the next place by itself, `ngClozeResume`), read for the glide.
 * NOT COVERED HERE: a lit row (S4); the phone's look (S3). The harness serves `{}` for dossiers: nothing here reads a film or
 * an article.
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
/** the roll: where it stands, whether its place is on the visible map (through the frame's own camera), the clock, and the
 *  names the frame wrote for its hand ("move") and for the cloze ("cloze") */
const theRoll = (page: Page) => page.evaluate(() => {
  const a = (window as W).__neural, n = a.nodes[a.currentPos], p = a.pairMid(n), sc = a.W / a.cam.vw, R = a._viewRect()
  const x = a.W / 2 + (p.x - a.cam.cx) * sc, y = a.H / 2 + (p.y - a.cam.cy) * sc, b = (a._lastNameBoxes || []) as W[]
  const hp = a.headPos(), hx = a.W / 2 + (hp.x - a.cam.cx) * sc, hy = a.H / 2 + (hp.y - a.cam.cy) * sc, s = a._session
  return { at: a.currentPos as number, inView: x >= R.left && x <= R.left + R.width && y >= R.top && y <= R.top + R.height, paused: !!a.paused, open: s ? s.czOpen : null,
    headInView: hx >= R.left && hx <= R.left + R.width && hy >= R.top && hy <= R.top + R.height,
    dealt: (a.optionIdxs || []).length, hand: b.filter((e) => e.w === "move").length, cloze: b.filter((e) => e.w === "cloze").length, czAt: !!a._czAt() }
})
/** play a move of the hand beside the open drawer: the first whose card the mouse can reach where it sits (a real click) */
async function playAMove(j: W, page: Page) {
  const t = await page.evaluate(() => {
    const a = (window as W).__neural
    for (const i of a.optionIdxs || []) {
      const e = document.querySelector(`[data-tech="${a.nodes[i].t}"] .ng-choice-title-button`) as HTMLElement | null, r = e && e.getBoundingClientRect()
      if (r && r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight) return a.nodes[i].t as string
    }
    return ""
  })
  expect(t, "premise: a card of the hand dealt beside the drawer, where the mouse reaches it").not.toBe("")
  await j.rig("resolve", [0.01]); await j.rig("outcome", [0.01])
  await j.pick(t)
}

test.describe("1440x900, mouse", () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test("opening a place's cloze takes the map to the place and its moves, names the place, lights nothing, and holds there until the drawer shuts", async ({ page }) => {
    const j = await setup(page, { at: "Half Guard|Top" })
    const before = await view(page)
    expect(before.out.length, "premise: the place and its moves are not on the staged board's map").toBeGreaterThan(0)
    await openCloze(page, false)
    await settle(j, page)
    const v = await view(page)
    expect([v.hidden.length, v.solid.length], "premise: five moves asked, one remembered").toEqual([5, 1])
    expect(v.out, `the place and its moves are in the calm area (${v.n} read)`).toEqual([])
    expect(v.zoom, "never closer than the roll's zoom").toBeGreaterThanOrEqual(0.999)
    expect(v.named, "the map names the place").toBe(true)
    expect(v.light, "nothing is lit before Show").toBeNull()
    expect(v.clozeNames, "no move of the cloze is named before Show (the remembered one included)").toEqual([])
    // the staged board's own framing would take the camera back: the hold keeps it (the camera's 7 s lease alone would not)
    await j.advance(14000)
    const held = await view(page)
    expect(held.out, "fourteen seconds on, the place and its moves are still in the calm area").toEqual([])
    expect(moved(held.placePt, v.placePt), "and the map has not moved").toBeLessThan(2)
    // the drawer shut (the session kept, the cloze with it): the hold goes with the cloze's place on screen, and the
    // staged board's own framing takes the camera back to where it stands
    const staged = () => page.evaluate(() => {
      const a = (window as W).__neural, n = a.nodes[a._staged], p = a.pairMid(n), sc = a.W / a.cam.vw, R = a._viewRect()
      const x = a.W / 2 + (p.x - a.cam.cx) * sc, y = a.H / 2 + (p.y - a.cam.cy) * sc
      return { at: a._staged as number, inBand: x >= R.left && x <= R.left + R.width && y >= R.top && y <= R.top + R.height }
    })
    const was = await staged()
    expect(was.at, "premise: the board is staged").not.toBeNull()
    expect(was.inBand, "premise: while the cloze is held, the staged place is not on the map").toBe(false)
    await page.keyboard.press("Escape")
    await j.advance(400)
    expect(await page.evaluate(() => !!(window as W).__neural.deckShown), "premise: the drawer is shut").toBe(false)
    await j.advance(3000)
    expect((await staged()).inBand, "Esc: the hold is gone, and the board's own framing takes the camera back to the place it stands").toBe(true)
  })

  test("at Show the place is lit and its shown moves named; nothing moves while they are in view; Hide and Done put the light out", async ({ page }) => {
    const j = await setup(page, { at: "Half Guard|Top" })
    await openCloze(page, false)
    await settle(j, page)
    // the player moves the map a little; everything stays in view (a drag on a free point of the map, beside the drawer)
    const free = await page.evaluate(() => {
      const a = (window as W).__neural, c = a.canvas.getBoundingClientRect(), R = a._viewRect()
      for (let y = c.top + R.top + 60; y < c.top + R.top + R.height - 60; y += 17) for (let x = c.left + R.left + 80; x < c.left + R.left + R.width - 80; x += 23) {
        if (document.elementFromPoint(x, y) !== a.canvas) continue
        a._updateHover({ clientX: x, clientY: y }); const h = a._hover && a._hover.idx >= 0; a._hover = null
        if (!h) return { x, y }
      }
      return null
    })
    expect(free, "premise: a free point of the map").not.toBeNull()
    await page.mouse.move(free!.x, free!.y); await page.mouse.down(); await page.mouse.move(free!.x + 24, free!.y + 10, { steps: 4 }); await page.mouse.up()
    await page.mouse.move(2, 2)
    await settle(j, page)
    const v0 = await view(page)
    expect(v0.out, "premise: after the drag the place and its moves are still in the calm area").toEqual([])
    await press(page, "[data-master-bar] [data-cz-show]", "Show", false, false)
    await j.advance(1000)
    const v = await view(page)
    expect(v.light, "Show: the place is lit").toEqual({ k: 1, place: v.place })
    expect(moved(v.placePt, v0.placePt), "nothing moves at Show: the place and its moves were in view").toBeLessThan(1)
    expect(v.clozeNames.length, "the shown moves are named where a name fits").toBeGreaterThan(0)
    expect(v.clozeNames.every((i: number) => v.rows.includes(i)), "only the cloze's own moves").toBe(true)
    // design round 6, rule 6: "The map's own names stay off while Practice is on" (the roll's hand stands at Half Guard)
    expect(v.boxes.filter((b: W) => b.w === "move" || b.w === "lit").map((b: W) => b.i), "the map's own names step back: no move of the roll's hand, no trail").toEqual([])
    await press(page, "[data-master-bar] [data-cz-hide]", "Hide", false, false)
    await j.advance(450)
    const h = await view(page)
    expect(h.light, "Hide: the light is out").toBeNull()
    expect(h.clozeNames, "and no move of the cloze is named").toEqual([])
    expect(moved(h.placePt, v.placePt), "and nothing moves").toBeLessThan(1)
    await press(page, "[data-master-bar] [data-cz-show]", "Show", false, false)
    await j.advance(450)
    expect((await view(page)).light?.k, "premise: lit again").toBe(1)
    await press(page, "[data-master-bar] [data-cz-done]", "Done", false, false)
    await j.advance(450)
    const d = await view(page)
    expect(d.done, "premise: confirmed").toBe(true)
    expect(d.light, "Done: the light is out").toBeNull()
    expect(d.czAt, "the cloze still open: the place is still held").toBe(true)
  })

  for (const when of ["before Show", "after Show"] as const) {
    test(`a move played beside an open cloze, ${when}: the game runs, the camera is the roll's again, and the names are the roll's`, async ({ page }) => {
      const j = await setup(page, { at: "Half Guard|Top" })
      await openCloze(page, false)
      await settle(j, page)
      if (when === "after Show") {
        await press(page, "[data-master-bar] [data-cz-show]", "Show", false, false)
        await j.advance(1000)
        expect((await view(page)).clozeNames.length, "premise: lit, its shown moves named").toBeGreaterThan(0)
      }
      expect((await theRoll(page)).inView, "premise: held at the cloze's place, the roll's own is off the map").toBe(false)
      await playAMove(j, page)
      // while the move travels (the landing comes about 2 s on, and may close the cloze), read every 200 ms for 1.6 s
      const seen: W[] = []
      for (let k = 0; k < 8; k++) { await j.advance(200); seen.push(await theRoll(page)) }
      expect([seen[0].paused, seen[0].open], "premise: the roll runs, the cloze still open in the drawer").toEqual([false, SEAT])
      expect(seen.some((r) => r.headInView), "the game runs: the camera is the roll's again, the move comes onto the map as it travels (KH1)").toBe(true)
      expect(seen.filter((r) => r.open === SEAT).map((r) => r.cloze), "none of the cloze's names stay while the roll runs (S8)").toEqual(seen.filter((r) => r.open === SEAT).map(() => 0))
      for (let i = 0; i < 12 && !(await theRoll(page)).dealt; i++) await j.advance(500)
      // (the names planner gives a held name back half a second after the camera rests, `_planNames`: up to 4 s here)
      for (let i = 0; i < 8 && !(await theRoll(page)).hand; i++) await j.advance(500)
      const d = await theRoll(page)
      expect([d.dealt > 0, d.hand > 0], "and once the roll's next hand is dealt, it is named").toEqual([true, true])
    })
  }

  test("standing at the place: after Show no orb is named twice (the hand and the cloze are the same moves)", async ({ page }) => {
    const j = await setup(page, { at: SEAT })
    await openCloze(page, false)
    await settle(j, page)
    await press(page, "[data-master-bar] [data-cz-show]", "Show", false, false)
    await j.advance(1000)
    const v = await view(page)
    expect(v.light?.k, "premise: lit").toBe(1)
    const named = v.boxes.filter((b: W) => b.w !== "position" && b.w !== "star").map((b: W) => b.i)
    expect(named.length, "premise: the moves are named").toBeGreaterThan(0)
    expect(named.length - new Set(named).size, `no orb is named twice (${named.join(",")})`).toBe(0)
  })

  test("the lit place wears no session ring while the light is on", async ({ page }) => {
    const j = await setup(page, { at: "Half Guard|Top", cards: true })
    await openCloze(page, false)
    await settle(j, page)
    await press(page, "[data-master-bar] [data-cz-show]", "Show", false, false)
    await j.advance(1000)
    // four frames at one instant, each into an offscreen copy of the canvas: lit or not, the session's rings or none; read
    // over the place's two holes out to their soft edge, where its ring (three times the orb) would be drawn
    const r = await page.evaluate(() => {
      const a = (window as W).__neural, live = a.ctx, dpr = a.dpr || 1, s = a._session, c = s.cz.get(s.czOpen)
      const shot = () => { const cv = document.createElement("canvas"); cv.width = live.canvas.width; cv.height = live.canvas.height; const ctx = cv.getContext("2d", { willReadFrequently: true })!; a.ctx = ctx; ctx.save(); try { a.draw() } finally { a.ctx = live; ctx.restore() } return ctx }
      const L = a._lastLight, holes = L ? L.holes.filter((h: W) => h.place) : [], rings = a._sessionNodes
      const keep = { k: a._lightK, t: a._lightT, s: a._lightS }
      let A: W, B: W, C: W, D: W
      try {
        A = shot(); a._sessionNodes = []; B = shot(); a._sessionNodes = rings
        c.shown = false; a._lightK = 0; C = shot(); a._sessionNodes = []; D = shot()
      } finally { a._sessionNodes = rings; c.shown = true; a._lightK = keep.k; a._lightT = keep.t; a._lightS = keep.s; a.draw() }
      const diff = (P: W, Q: W) => {
        let m = 0
        for (const h of holes) {
          const R = h.r * 1.35 + 4, x0 = Math.max(0, Math.floor((h.x - R) * dpr)), y0 = Math.max(0, Math.floor((h.y - R) * dpr)), w = Math.ceil(2 * R * dpr), hh = Math.ceil(2 * R * dpr)
          const p = P.getImageData(x0, y0, w, hh).data, q = Q.getImageData(x0, y0, w, hh).data
          for (let i = 0; i < p.length; i += 4) m = Math.max(m, Math.abs(p[i] - q[i]), Math.abs(p[i + 1] - q[i + 1]), Math.abs(p[i + 2] - q[i + 2]))
        }
        return m
      }
      const ringed = (rings || []).some((k: number) => k === L?.place || k === a.nodes[L?.place]?.pi)
      return { holes: holes.length, ringed, lit: diff(A, B), unlit: diff(C, D) }
    })
    expect(r.holes, "premise: the place's holes are read").toBeGreaterThan(0)
    expect(r.ringed, "premise: the session holds the place's deck, so the map rings the place").toBe(true)
    expect(r.unlit, "premise: unlit, its ring is drawn there").toBeGreaterThan(20)
    expect(r.lit, "lit, the place's ring is not drawn: the frame is the same with the session's rings or without").toBeLessThanOrEqual(2)
  })
})

test.describe("390x631, touch", () => {
  test.use({ viewport: { width: 390, height: 631 }, hasTouch: true, isMobile: true })

  test("on a phone the cloze moves nothing on the map and lights nothing (the drawer is the screen; its look is S3)", async ({ page }) => {
    const j = await setup(page, { at: "Half Guard|Top" })
    await openCloze(page, true)
    await settle(j, page)
    const v = await view(page)
    expect(v.czAt, "no place on a phone").toBe(false)
    expect(v.out.length, "the cloze moves nothing on the map: its place and moves are not brought into view").toBeGreaterThan(0)
    await press(page, "[data-master-bar] [data-cz-show]", "Show", true, false)
    await j.advance(800)
    expect(await page.evaluate(() => (window as W).__neural._lastLight), "and lights nothing").toBeNull()
  })
})
