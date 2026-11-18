import { test, expect, Page } from "@playwright/test"
import { journey } from "../dsl"

/**
 * AN OPTION IS PLAYED ONLY WHEN THE PLAYER CAN SEE WHAT THEY ARE PLAYING (FOLLOW2, v1.293.3)
 *
 * One condition, asked where every road that plays an option meets (`_optionReach` / `_playState`, app.src.jsx; the
 * reader's wrapper of `activateOption` asks the same one). The roads, surveyed: the digits 1 to 9; a click on the card (a
 * mouse, a touch's click, and Enter or Space on the focused card, which is a click with no pointer). Nothing else plays an
 * option in the app.
 *
 * WHAT WAS SO, measured on dev v1.293.1:
 *   · BY KEY. PR #441 refused a digit by WIDTH (640 and under, the drawer open). Width is not reach: at 641 a card with its
 *     middle under the drawer was played by its digit, and at 1440 the row shows five cards of a hand of 24 (it scrolls
 *     sideways and clips), yet the digits 6 to 9 played cards nobody could see (their middles are the canvas's or off the
 *     screen). The rule: a key plays its card only when the card's MIDDLE is what `elementFromPoint` finds there.
 *   · A KEY WHOSE CARD IS SCROLLED OUT OF THE HAND'S OWN ROW SHOWS IT FIRST (FOLLOW2-R0, ruled): refusing it would take
 *     away a keyboard player's road to the sixth card and on. The key brings its card whole into the row's view and
 *     marks it (the keyboard's own focus on the card's play button, the outline it already draws), and plays nothing;
 *     the same key again, the card now seen, plays it. Only for a card the ROW's scroll has put out of view: a card under
 *     the drawer, a menu or a modal stays refused, and is not moved.
 *   · THE PHONE'S SLIVER. Beside the open drawer (343 px of 390) a strip of the board shows. A touch on the MAP there
 *     shuts the drawer, the roll it held resumes, and it does nothing else (pane law, `closeDeckIfStudying`). The ends of
 *     two of the hand's cards show there too, and a touch on one PLAYED it, the drawer still open over the board. Now the
 *     card's end does what the map does beside it, by the map's own function: the sliver is one thing.
 *   · A FILM'S HAND. While a film runs the hand is put away (the row at a tenth of its strength, `pointer-events:none`),
 *     but the stylesheet gives a card's buttons `pointer-events:auto`: a touch on a dim card's title played the move and
 *     ended the film (390x844 and 390x631, 1 of 1 each). Put away now means not in play, by any road.
 *   · A DESKTOP'S PRESS beside the drawer plays as it always did (the pointer on the card is its own proof), a card half
 *     under the drawer's edge included; pane-law.spec.ts pins the press and the digit there, and that both store the same.
 *
 * Mutants (each alone, in the served bundle, a clean control first):
 *   R1 a key plays its card wherever the card is (the middle's test out: THE FIRST PRESS PLAYS) → "digit 7 on a card out of
 *      view…" at "the first 7 plays nothing", "beside the open drawer at 641…" at "its middle under the drawer, its digit
 *      plays nothing", "Enter on a focused card…" at "Enter plays nothing: the card's middle is under the drawer", and "on
 *      a reading arrival…" at "the digit began nothing: the page is still being read"
 *   R7 the key marks its card and does not bring it into view (THE SECOND PRESS DOES NOTHING) → "digit 7 on a card out of
 *      view…" at "the card is whole in the row's view"
 *   R8 the key brings its card into view and does not mark it → the same test at "and marked: the keyboard's focus is on
 *      its play button"
 *   R9 a card under the drawer is taken for one scrolled out of the row (it is brought out and marked) → "beside the
 *      open drawer at 641…" at "nor is it brought out from under the drawer: the row has not moved and nothing is marked"
 *   R2 a press on the hand beside the open drawer on a phone goes on to the card (the row's listener out) → "the sliver…"
 *      at "a touch on a card's end shuts the drawer"
 *   R3 the drawer being the screen is no bar to a key (the clause out of `_optionReach`) → "a window of a phone's
 *      width…" at "the drawer is the screen: the digit of a card whose middle shows beside it plays nothing"
 *   R4 a hand a film has put away is still in play (the clause out) → "a film's put-away hand…" at "a touch on a dim
 *      card plays nothing, and the film runs on"
 *   R5 Enter on a focused card is taken for a press (`detail` not read) → "Enter on a focused card…" at "Enter plays
 *      nothing: the card's middle is under the drawer"
 *   R6 the reader begins play before the question is asked (its old copy of the guard) → "on a reading arrival…" at "the
 *      digit began nothing: the page is still being read"
 * NOT COVERED: a real phone's keyboard (the phone's digits are pressed in its emulation); a menu or a modal over a card's
 * middle (the same `elementFromPoint`: the drawer is the cover pressed here); a face-down hand (`hideMoves`).
 */

type W = any
const game = (page: Page) => page.evaluate(() => {
  const a = (window as W).__neural
  return { drawer: !!a.deckShown, paused: !!a.paused, latch: !!a._paneAutoPaused, moves: a.moveCount as number, running: !!a._execution || !!a.pulse, film: !!a._replay,
    log: (a.rollLog || []).map((h: W) => h.key as string).join(" > "), hand: (a.optionIdxs || []).join(","), reading: !!a._readerIntent }
})
/** the n-th card of the hand (from 1): its move, its box, its middle, and whether its middle is in reach of a press */
const cardAt = (page: Page, n: number) => page.evaluate((n) => {
  const a = (window as W).__neural, oc = (a._optionCards || [])[n - 1]
  if (!oc) return null
  const r = (oc.card as HTMLElement).getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, t = document.elementFromPoint(x, y)
  return { tech: oc.opt.node.t as string, left: r.left, right: r.right, top: r.top, x, y, inReach: !!t && oc.card.contains(t) }
}, n)
/** the whole record as the next save would write it, without the save's own clock */
const stored = (page: Page) => page.evaluate(() => {
  const a = (window as W).__neural, at = a._progressAt, b = JSON.parse(JSON.stringify(a._progressBlob()))
  a._progressAt = at
  delete b.updatedAt
  return b as Record<string, unknown>
})
const differ = (x: Record<string, unknown>, y: Record<string, unknown>) => Object.keys({ ...x, ...y }).filter((k) => JSON.stringify(x[k]) !== JSON.stringify(y[k]))
const noClocks = (r: Record<string, unknown>) => JSON.parse(JSON.stringify(r, (_k, v) => (typeof v === "number" && v > 1e12 ? 0 : v))) as Record<string, unknown>
/** ...and without the visit's own name: `flow` files what was played under an id drawn afresh for every visit (measured: the
 *  same road in two visits differs in that key and in nothing under it), so two visits are compared by what is filed */
const noVisit = (r: Record<string, unknown>) => ({ ...noClocks(r), flow: Object.values((r.flow || {}) as Record<string, unknown>).map((v) => JSON.stringify(v)).sort() }) as Record<string, unknown>
const drawerRight = (page: Page) => page.evaluate(() => ((window as W).__neural.drillRef.current as HTMLElement).getBoundingClientRect().right)
/** the hand's row moved sideways by so much (what a wheel or a drag over it does; the fixture, not the claim) */
const slideHand = (page: Page, by: number) => page.evaluate((by) => { const a = (window as W).__neural; a._trayStop && a._trayStop(); (a.optionsRef.current as HTMLElement).scrollLeft += by }, by)
const noFocus = (page: Page) => page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
const rigged = async (j: any) => { await j.rig("resolve", [0.01]); await j.rig("outcome", [0.01]) }

test.describe("1440x900, the drawer shut", () => {
  test.use({ viewport: { width: 1440, height: 900 } })
  /** where the n-th card stands in the hand's row: whole inside the row's box and the screen, and whether the keyboard's
   *  focus is on its play button (the mark) */
  const inRow = (page: Page, n: number) => page.evaluate((n) => {
    const a = (window as W).__neural, oc = (a._optionCards || [])[n - 1], row = (a.optionsRef.current as HTMLElement).getBoundingClientRect(), r = (oc.card as HTMLElement).getBoundingClientRect()
    const b = oc.card.querySelector("[data-choice-execute]") as HTMLElement
    return { whole: r.left >= row.left - 0.5 && r.right <= Math.min(row.right, innerWidth) + 0.5, marked: document.activeElement === b, ring: document.activeElement === b && b.matches(":focus-visible"), scroll: (a.optionsRef.current as HTMLElement).scrollLeft }
  }, n)
  const marks = (page: Page) => page.evaluate(() => { const a = (window as W).__neural; return (a._optionCards || []).map((oc: W, i: number) => (document.activeElement && oc.card.contains(document.activeElement) ? i + 1 : 0)).filter(Boolean) })

  test("digit 7 on a card out of view: nothing played, the card brought whole into the row and marked, nothing stored; 7 again plays it, with the record a press on that card leaves", async ({ page, browser, baseURL }) => {
    const j = journey(page)
    await j.boot("/")
    await j.land("Mount Top")
    const seventh = await cardAt(page, 7)
    expect(seventh, "premise: the hand has a seventh card").not.toBeNull()
    expect([(await cardAt(page, 1))!.inReach, seventh!.inReach, (await inRow(page, 7)).whole], "premise: the first card is in view, the seventh is scrolled out of the row (it shows five)").toEqual([true, false, false])
    const was = await game(page), rec = await stored(page)
    await rigged(j)
    await noFocus(page)
    await page.keyboard.press("7")
    await j.advance(700)
    expect(await game(page), "the first 7 plays nothing").toEqual(was)
    const shown = await inRow(page, 7)
    expect(shown.whole, "the card is whole in the row's view").toBe(true)
    expect((await cardAt(page, 7))!.inReach, "its middle in reach of a press now").toBe(true)
    expect([shown.marked, shown.ring], "and marked: the keyboard's focus is on its play button, with the outline a keyboard's focus draws").toEqual([true, true])
    expect(await marks(page), "that card and no other").toEqual([7])
    expect(Object.keys(rec).length, "premise: the record is read whole").toBeGreaterThan(15)
    expect(differ(rec, await stored(page)), "and nothing is stored").toEqual([])
    // the same digit again, the card now seen
    await page.keyboard.press("7")
    await j.advance(300)
    const after = await game(page)
    expect(after.moves > 0 || after.running, "7 again plays it").toBe(true)
    await j.nextHand()
    const byKey = { rec: noVisit(await stored(page)), log: (await game(page)).log }
    expect((byKey.rec.flow as unknown[]).length, "premise: the move is filed").toBeGreaterThan(0)
    // THE SAME RECORD AS A PRESS ON THAT CARD: a second visit, the row scrolled by hand, the card pressed by a mouse
    const ctx = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } }), page2 = await ctx.newPage(), j2 = journey(page2)
    await j2.boot("/")
    await j2.land("Mount Top")
    const c7 = (await cardAt(page2, 7))!
    await rigged(j2)
    await slideHand(page2, c7.x - 700)
    await expect.poll(async () => (await cardAt(page2, 7))!.inReach, { message: "premise: the seventh card scrolled into view by hand" }).toBe(true)
    await j2.clickByMouse(`[data-tech="${c7.tech}"] .ng-choice-title-button`, "the seventh card, by a mouse")
    await j2.nextHand()
    expect((await game(page2)).log, "the same roll either way").toBe(byKey.log)
    expect(differ(byKey.rec, noVisit(await stored(page2))), "the key's two presses leave the record a press on that card leaves").toEqual([])
    await ctx.close()
  })

  test("a digit whose card is in view plays at once: digit 2", async ({ page }) => {
    const j = journey(page)
    await j.boot("/")
    await j.land("Mount Top")
    expect((await cardAt(page, 2))!.inReach, "premise: the second card is in view").toBe(true)
    const scroll0 = (await inRow(page, 2)).scroll
    await rigged(j)
    await noFocus(page)
    await page.keyboard.press("2")
    await j.advance(300)
    const after = await game(page)
    expect(after.moves > 0 || after.running, "one press plays it, as ever").toBe(true)
    expect(scroll0, "premise: the row was not scrolled").toBe(0)
  })

  test("after the first 7, a different digit acts on its own card: one in view is played, one out of view is shown and takes the mark", async ({ page }) => {
    const j = journey(page)
    await j.boot("/")
    await j.land("Mount Top")
    await rigged(j)
    await noFocus(page)
    await page.keyboard.press("7")
    await j.advance(300)
    expect([(await inRow(page, 7)).marked, (await game(page)).moves], "premise: the first 7 showed and marked the seventh card, and played nothing").toEqual([true, 0])
    // the first card is scrolled out of view now (the row moved to show the seventh): its digit shows it and takes the mark
    expect((await cardAt(page, 1))!.inReach, "premise: the first card is out of view now").toBe(false)
    const was = await game(page)
    await page.keyboard.press("1")
    await j.advance(300)
    expect(await game(page), "digit 1 plays nothing: its own card was out of view").toEqual(was)
    expect([(await inRow(page, 1)).whole, await marks(page)], "its own card is brought into view, and the mark is on it now, not on the seventh").toEqual([true, [1]])
    // a card in view is played at once, whatever card is marked: digit 2 plays the second card, not the marked first
    const second = (await cardAt(page, 2))!
    expect(second.inReach, "premise: the second card is in view").toBe(true)
    await page.keyboard.press("2")
    await j.advance(300)
    const after = await game(page)
    expect(after.moves > 0 || after.running, "digit 2 plays").toBe(true)
    expect(await page.evaluate(() => { const a = (window as W).__neural, x = a._execution; return x && a.nodes[x.idx] ? (a.nodes[x.idx].t as string) : null }), "and what it plays is its own card, the second").toBe(second.tech)
  })

  test("on a reading arrival a digit whose card is out of view begins nothing", async ({ page }) => {
    const j = journey(page)
    await j.boot("/Positions/Mount/Top")
    await expect.poll(() => page.evaluate(() => ((window as W).__neural._optionCards || []).length), { message: "premise: the page's arrival seats a hand" }).toBeGreaterThan(6)
    await j.advance(600)
    const was = await game(page)
    expect(was.reading, "premise: the page is being read (the reader holds play)").toBe(true)
    const out = await page.evaluate(() => { const a = (window as W).__neural; for (let n = 9; n >= 1; n--) { const oc = (a._optionCards || [])[n - 1]; if (!oc) continue; const r = oc.card.getBoundingClientRect(), t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); if (!(t && oc.card.contains(t))) return n } return 0 })
    expect(out, "premise: one of the first nine cards is out of view").toBeGreaterThan(0)
    await noFocus(page)
    await page.keyboard.press(String(out))
    await j.advance(600)
    expect(await game(page), "the digit began nothing: the page is still being read").toEqual(was)
  })
})

test.describe("641x800, the drawer open beside the board", () => {
  test.use({ viewport: { width: 641, height: 800 } })
  /** the drawer open, the hand slid so that the first card's middle is under the drawer and its end still shows */
  async function firstCardHalfUnder(page: Page) {
    const j = journey(page)
    await j.boot("/")
    await j.land("Mount Top")
    await page.locator(".ng-logo").click()
    await j.advance(1500)
    const edge = await drawerRight(page), c0 = await cardAt(page, 1)
    expect(c0!.inReach, "premise: unscrolled, the first card's middle shows beside the drawer").toBe(true)
    await slideHand(page, c0!.x - (edge - 30))
    await expect.poll(async () => { const c = (await cardAt(page, 1))!; return c.x < edge && c.right > edge + 30 && !c.inReach }, { message: "premise: the first card's middle is under the drawer, its end beside it" }).toBe(true)
    expect((await game(page)), "premise: the drawer holds the roll").toMatchObject({ drawer: true, paused: true, latch: true, moves: 0 })
    return { j, edge }
  }

  test("beside the open drawer at 641: a digit plays a card whose middle shows, not one whose middle is under the drawer; a press on that card's end plays as ever", async ({ page }) => {
    const { j, edge } = await firstCardHalfUnder(page)
    const was = await game(page), scrolled = await page.evaluate(() => ((window as W).__neural.optionsRef.current as HTMLElement).scrollLeft)
    await rigged(j)
    await noFocus(page)
    await page.keyboard.press("1")
    await j.advance(700)
    expect(await game(page), "its middle under the drawer, its digit plays nothing").toEqual(was)
    const still = await page.evaluate(() => { const a = (window as W).__neural; return { scroll: (a.optionsRef.current as HTMLElement).scrollLeft, marked: (a._optionCards || []).some((oc: W) => !!document.activeElement && oc.card.contains(document.activeElement)) } })
    expect([still.scroll === scrolled, still.marked], "nor is it brought out from under the drawer: the row has not moved and nothing is marked").toEqual([true, false])
    // the press on its visible end: a desktop's press beside the drawer plays, as it always did
    const c = (await cardAt(page, 1))!
    const at = await page.evaluate(({ tech, from }) => { const b = document.querySelector(`[data-tech="${tech}"] .ng-choice-title-button`) as HTMLElement, r = b.getBoundingClientRect(); for (let x = Math.max(from + 6, r.left + 4); x < r.right - 4; x += 4) { const t = document.elementFromPoint(x, r.top + r.height / 2); if (t && b.contains(t)) return { x, y: r.top + r.height / 2 } } return null }, { tech: c.tech, from: edge })
    expect(at, "premise: the card's title shows beside the drawer").not.toBeNull()
    await page.mouse.click(at!.x, at!.y)
    await j.advance(300)
    const after = await game(page)
    expect([after.moves > 0 || after.running, after.paused, after.drawer], "a press on its end plays it, the drawer staying beside the board").toEqual([true, false, true])
  })

  test("beside the open drawer at 641: the digit of a card whose middle shows plays it", async ({ page }) => {
    const j = journey(page)
    await j.boot("/")
    await j.land("Mount Top")
    await page.locator(".ng-logo").click()
    await j.advance(1500)
    const c = (await cardAt(page, 1))!, edge = await drawerRight(page)
    expect([c.inReach, c.left < edge + 60], "premise: the first card stands at the drawer's edge, its middle showing").toEqual([true, true])
    await rigged(j)
    await noFocus(page)
    await page.keyboard.press("1")
    await j.advance(300)
    const after = await game(page)
    expect([after.moves > 0 || after.running, after.paused, after.latch], "its digit plays it, and the drawer's claim on the clock ends with the move").toEqual([true, false, false])
  })

  test("Enter on a focused card is a key: it plays nothing while the card's middle is under the drawer, and plays it in view", async ({ page }) => {
    const { j } = await firstCardHalfUnder(page)
    const was = await game(page), c = (await cardAt(page, 1))!
    await rigged(j)
    const focused = await page.evaluate((tech) => { const b = document.querySelector(`[data-tech="${tech}"] [data-choice-execute]`) as HTMLElement; b.focus({ preventScroll: true }); return document.activeElement === b }, c.tech)
    expect(focused, "premise: the card's own button has the focus").toBe(true)
    await page.keyboard.press("Enter")
    await j.advance(700)
    expect(await game(page), "Enter plays nothing: the card's middle is under the drawer").toEqual(was)
    await slideHand(page, -1000)
    await expect.poll(async () => (await cardAt(page, 1))!.inReach, { message: "premise: the card is in view again" }).toBe(true)
    await page.evaluate((tech) => (document.querySelector(`[data-tech="${tech}"] [data-choice-execute]`) as HTMLElement).focus({ preventScroll: true }), c.tech)
    await page.keyboard.press("Enter")
    await j.advance(300)
    const after = await game(page)
    expect(after.moves > 0 || after.running, "in view, Enter on the focused card plays it").toBe(true)
  })
})

test.describe("a window of a phone's width, by mouse and keyboard (600x800)", () => {
  test.use({ viewport: { width: 600, height: 800 } })
  test("the drawer is the screen: no digit plays, a click on a card's end shuts the drawer, and with it shut a digit plays the card in view", async ({ page }) => {
    const j = journey(page)
    await j.boot("/")
    await j.land("Mount Top")
    await page.locator(".ng-logo").click()
    await j.advance(1500)
    const edge = await drawerRight(page)
    // slide the hand until some card's MIDDLE shows in the strip beside the drawer: by reach alone its digit would play
    let n = 0
    for (let k = 0; k < 40 && !n; k++) {
      n = await page.evaluate((edge) => { const a = (window as W).__neural; for (let i = 0; i < Math.min(9, (a._optionCards || []).length); i++) { const r = a._optionCards[i].card.getBoundingClientRect(), x = r.left + r.width / 2, t = document.elementFromPoint(x, r.top + r.height / 2); if (x > edge + 8 && x < innerWidth - 8 && t && a._optionCards[i].card.contains(t)) return i + 1 } return 0 }, edge)
      if (!n) await slideHand(page, 12)
    }
    expect(n, "premise: a card's middle shows in the strip beside the drawer").toBeGreaterThan(0)
    const was = await game(page), rec = await stored(page)
    expect(was, "premise: the drawer holds the roll").toMatchObject({ drawer: true, paused: true, latch: true, moves: 0 })
    await rigged(j)
    await noFocus(page)
    await page.keyboard.press(String(n))
    await j.advance(700)
    expect(await game(page), "the drawer is the screen: the digit of a card whose middle shows beside it plays nothing").toEqual(was)
    expect(differ(rec, await stored(page)), "and stores nothing").toEqual([])
    // a click on that card: the strip is the drawer's way out, for the map and for a card alike
    const c = (await cardAt(page, n))!
    await page.mouse.click(c.x, c.y)
    await j.advance(300)
    const shut = await game(page)
    expect([shut.drawer, shut.paused, shut.moves, shut.running, shut.hand], "a click on a card beside the drawer shuts the drawer, the roll resumes, and no card is played").toEqual([false, false, 0, false, was.hand])
    // with the drawer shut the hand is the player's again
    const inView = (await cardAt(page, 1))!.inReach ? 1 : n
    await page.keyboard.press(String(inView))
    await j.advance(300)
    const after = await game(page)
    expect(after.moves > 0 || after.running, "with the drawer shut, the digit of a card in view plays it").toBe(true)
  })
})

test.describe("a phone, 390x631 by touch", () => {
  test.use({ viewport: { width: 390, height: 631 }, hasTouch: true, isMobile: true })
  /** the drawer open by a touch on the logo; a point of the MAP in the strip beside it, and a point on a CARD's end there
   *  (both well clear of the drawer's edge: a touch within a few px of a control is the control's) */
  async function strip(page: Page) {
    const j = journey(page)
    await j.boot("/")
    await j.land("Mount Top")
    const l = (await page.locator(".ng-logo").boundingBox())!
    await page.touchscreen.tap(l.x + l.width / 2, l.y + l.height / 2)
    await page.waitForTimeout(200)
    await j.advance(1500)
    const pts = await page.evaluate(() => {
      const a = (window as W).__neural, edge = (a.drillRef.current as HTMLElement).getBoundingClientRect().right, out: W = { edge, map: null, card: null }
      for (let y = 100; y < innerHeight - 30 && !(out.map && out.card); y += 6) for (let x = innerWidth - 6; x > edge + 14; x -= 4) {
        const t = document.elementFromPoint(x, y) as HTMLElement | null; if (!t) continue
        if (!out.map && t === a.canvas) out.map = { x, y }
        const c = t.closest(".ng-choice-card") as HTMLElement | null
        if (!out.card && c && !c.hasAttribute("data-opponent-threat")) out.card = { x, y, tech: c.getAttribute("data-tech") }
      }
      return out
    })
    expect(pts.map, "premise: the map shows in the strip beside the drawer").not.toBeNull()
    expect(pts.card, "premise: a card's end shows in the strip beside the drawer").not.toBeNull()
    expect(await game(page), "premise: the drawer holds the roll").toMatchObject({ drawer: true, paused: true, latch: true, moves: 0 })
    return { j, pts }
  }
  const resumed = async (j: any) => (await j.beats()).filter((b: W) => b.beat === "pane_resumed").length

  test("the sliver beside the open drawer behaves as one thing: a touch on the map there, and a touch on a card's end there", async ({ page, browser, baseURL }) => {
    // THE MAP'S OWN PART, as it always was: the drawer shuts, the roll it held resumes, nothing else
    const { j, pts } = await strip(page)
    const was = await game(page)
    await rigged(j)
    await page.touchscreen.tap(pts.map.x, pts.map.y)
    await j.advance(400)
    const byMap = await game(page)
    expect({ drawer: byMap.drawer, paused: byMap.paused, moves: byMap.moves, running: byMap.running, hand: byMap.hand, log: byMap.log }, "a touch on the map's sliver shuts the drawer and the roll resumes: nothing played")
      .toEqual({ drawer: false, paused: false, moves: 0, running: false, hand: was.hand, log: was.log })
    expect(await resumed(j), "said once").toBe(1)
    const recMap = noClocks(await stored(page))
    // A CARD'S END, in a second visit with the same roll: the same
    const ctx = await browser.newContext({ baseURL, viewport: { width: 390, height: 631 }, hasTouch: true, isMobile: true }), page2 = await ctx.newPage()
    const s2 = await strip(page2)
    const was2 = await game(page2)
    await rigged(s2.j)
    await page2.touchscreen.tap(s2.pts.card.x, s2.pts.card.y)
    await s2.j.advance(400)
    const byCard = await game(page2)
    expect({ drawer: byCard.drawer, paused: byCard.paused }, "a touch on a card's end shuts the drawer").toEqual({ drawer: false, paused: false })
    expect({ moves: byCard.moves, running: byCard.running, hand: byCard.hand, log: byCard.log }, "and plays no card: the same hand, the same roll").toEqual({ moves: 0, running: false, hand: was2.hand, log: was2.log })
    expect(await resumed(s2.j), "said once, as the map's part says it").toBe(1)
    expect(differ(recMap, noClocks(await stored(page2))), "the two halves of the sliver store the same").toEqual([])
    // ...and with the drawer shut that same card is the player's: a touch plays it
    const c = await page2.evaluate((tech) => { const b = document.querySelector(`[data-tech="${tech}"] .ng-choice-title-button`) as HTMLElement; b.scrollIntoView({ block: "nearest", inline: "center" }); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } }, s2.pts.card.tech)
    await page2.waitForTimeout(150)
    await page2.touchscreen.tap(c.x, c.y)
    await s2.j.advance(300)
    const played = await game(page2)
    expect(played.moves > 0 || played.running, "with the drawer shut, a touch on that card plays it").toBe(true)
    await ctx.close()
  })

  test("on a phone with the drawer open no digit plays a card", async ({ page }) => {
    const { j } = await strip(page)
    const was = await game(page), rec = await stored(page)
    await rigged(j)
    await noFocus(page)
    for (const k of "123456789") { await page.keyboard.press(k); await j.advance(200) }
    expect(await game(page), "nine digits, nothing played").toEqual(was)
    expect(differ(rec, await stored(page)), "nothing stored").toEqual([])
  })
})

test.describe("a film's put-away hand, 390x844 by touch", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  test("while a film runs the hand is put away: a touch on a dim card plays nothing and the film runs on; nor does its digit", async ({ page }) => {
    const j = journey(page)
    await j.boot("/")
    await j.land("Mount Top")
    // a roll that has been somewhere, filed; a new one live at Mount; the film of the filed one, watched on the map
    let moved = 1
    for (let n = 0; n < 6 && moved < 2; n++) { await rigged(j); const t = await j.optionTitles(); await j.pick(t[Math.min(n, t.length - 1)]); await j.nextHand(); moved = await page.evaluate(() => ((window as W).__neural.rollLog || []).length) }
    await page.evaluate(() => { const a = (window as W).__neural; a.rollFromPosition(a.nodeForKey("Mount|Top"), false, "top") })
    await j.advance(2500)
    for (let i = 0; i < 6; i++) { const left = await page.evaluate(() => { const b = document.querySelector("[data-reward-close]") as HTMLElement | null; if (b) b.click(); return document.querySelectorAll("[data-reward-close]").length }); if (!left) break; await page.waitForTimeout(60) }
    const ts = await page.evaluate(() => ((window as W).__neural._pastRolls || [])[0].ts as number)
    const tapAt = async (sel: string) => { const b = (await page.locator(sel).first().boundingBox())!; await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2) }
    await tapAt(".ng-logo"); await page.waitForTimeout(150)
    await tapAt('[data-view="history"]'); await page.waitForTimeout(150)
    await tapAt(`[data-replay-roll="${ts}"]`); await j.advance(300)
    await tapAt(".ng-explorer-close"); await j.advance(1500); await page.waitForTimeout(150)
    // (the film draws its own travel on the map, so "a move is under way" is read from the roll's execution alone here)
    const roll = () => page.evaluate(() => { const a = (window as W).__neural; return { film: !!a._replay, drawer: !!a.deckShown, paused: !!a.paused, moves: a.moveCount as number, executing: !!a._execution, log: (a.rollLog || []).map((h: W) => h.key as string).join(" > "), hand: (a.optionIdxs || []).join(",") } })
    const was = await roll()
    expect(was, "premise: the film runs on the map, the drawer shut, the clock held").toMatchObject({ film: true, drawer: false, paused: true, moves: 0, executing: false })
    // a point on a dim card's title that the film's bar does not cover, and that a touch reaches
    const pt = await page.evaluate(() => {
      const a = (window as W).__neural, bar = document.querySelector("[data-replay-bar]")!.getBoundingClientRect()
      for (const oc of a._optionCards || []) {
        if (oc.opt.threat) continue
        const b = oc.card.querySelector(".ng-choice-title-button") as HTMLElement | null; if (!b) continue
        const r = b.getBoundingClientRect()
        for (let y = r.top + 6; y < r.bottom - 5; y += 5) for (let x = Math.max(8, r.left + 10); x < Math.min(innerWidth - 8, r.right - 10); x += 9) {
          if (y >= bar.top - 4 && y <= bar.bottom + 4) continue
          const t = document.elementFromPoint(x, y)
          if (t && b.contains(t)) return { x, y, n: (a._optionCards as W[]).indexOf(oc) + 1, strength: Number(getComputedStyle(a.optionsRef.current).opacity) }
        }
      }
      return null
    })
    expect(pt, "premise: a dim card's title is still what a touch reaches (its buttons keep their pointer events)").not.toBeNull()
    expect(pt!.strength, "premise: the hand is put away, a tenth of its strength").toBeLessThan(0.2)
    await rigged(j)
    await page.touchscreen.tap(pt!.x, pt!.y)
    await j.advance(500)
    expect(await roll(), "a touch on a dim card plays nothing, and the film runs on").toEqual(was)
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
    await page.keyboard.press(String(pt!.n))
    await j.advance(500)
    expect(await roll(), "nor does its digit").toEqual(was)
    // the film stopped by its ✕, the hand is back and that card plays
    await tapAt("[data-replay-stop]")
    await j.advance(600)
    expect((await game(page)).film, "premise: the ✕ stopped the film").toBe(false)
    await page.touchscreen.tap(pt!.x, pt!.y)
    await j.advance(300)
    const after = await game(page)
    expect(after.moves > 0 || after.running, "the film over, a touch on that card plays it").toBe(true)
  })
})
