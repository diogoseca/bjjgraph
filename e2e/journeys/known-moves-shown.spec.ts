import { expect, test, type Page } from "@playwright/test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { journey } from "../dsl"

/** A MOVE YOU KNOW STAYS FACE UP (v1.266.0, the owner, 13 Nov 2026, "a must implement").
 *
 * His words: "moves which are golden / mastered and not yet up for review show visible instead of hidden in the
 * choices row by default ok? that reduces the necessity of hidding everything including our mastered techniques".
 * With moves hidden (`hideMoves`), a move whose last answer was a Yes and that is not yet due is dealt FACE UP, its
 * name and its film as when nothing is hidden; every other move stays face down as before; the moment a face-up
 * move comes due it goes face down and its look asks "Still got it?"; a Yes turns it up again. One state per move,
 * read from its own row `[due, ivl, last, ok]` (`_moveState` in app.src.jsx): gold is the row's Yes, due is the
 * row's date, so his two words are one fact in the code.
 *
 * THE SEAT: Mount Top, three of its dealt moves seeded by their permanent share ordinals (node_ordinals.json):
 *   known  Americana from Mount  [DAY + 9, 14, DAY - 5, 1]  a Yes, due in nine days
 *   due    Kimura from Mount     [DAY - 1, 3, DAY - 4, 1]   a Yes, due yesterday
 *   fresh  Armbar from Mount     no row                     never answered
 * The day is the app's own test seam (`window.__NG_EPOCH_DAY__`, read by `_epochDay`). The day moves the way it
 * does for a player who left the tab open overnight: the page comes back to the foreground (a visibilitychange
 * with the page visible), and the app re-reads every dealt card's face (`_onVisHide` -> `_paintHandFaces`).
 *
 * WHAT A PLAYER SEES, never the text: the name's computed visibility, whether the back covers the film slot to the
 * pixel, the name a screen reader is given, the gold attribute. The map: the label the frame DREW for that orb when
 * the pointer is on it (`_lastPairLabel` / `_lastHoverLabel`, published by `draw()`), never the rule recomputed.
 * Presses: `j.clickByMouse` and `page.mouse` at measured points; `page.touchscreen.tap` at measured points.
 *
 * MUTANTS (v1.266.0), each a region of the SERVED bundle, run against this file and red at the named assertion; a
 * neutral control (a warn string) stays green in all five tests, and the moves-shown control test is green under every
 * mutant. Table in docs/Changelog-Archive.md (v1.266.0):
 *   a mastered move hidden anyway (`_applyHide` ignores the state)   -> "known: face up..." (both mouse, touch) and the
 *                                                                       pull's "precondition: the known card is face up"
 *   a due move shown (`_moveState` never answers "due")              -> "due: face down..." (both mouse, touch)
 *   the map asks the rule's old set (the cards not consulted)        -> "...and the map names the known move" (both
 *                                                                       mouse, touch) and the pull's "...the map names it"
 *   no face repaint on a knowledge publish ("moves-face" gone)       -> "...and it stays up once the pointer has left"
 *                                                                       (both mouse), "...and the known card stays face
 *                                                                       up" (touch), "another device's No: face down"
 *   coming back does not re-read the faces (`_onVisHide` as on dev)  -> "coming back the next day: it is face down"
 *                                                                       (touch). PARTIAL: both mouse tests stay green,
 *     because once the app has read the day (the hand's value request), the values' own visibilitychange listener re-
 *     reads it too and its "day-rollover" publish turns the card down; the touch run comes back before that first read.
 * Dev's own bundle (v1.265.1's sources) fails the four hidden-mode tests at "known: face up..." / the pull's
 * precondition, and passes the control.
 * NOT COVERED here: a day that turns while the tab stays in the foreground and nothing else re-reads it (no clock
 * re-reads the day under an open hand; the next deal, publish or return to the tab does); the PostHog `shown`
 * property (no PR shard is keyed, §6.4).
 */

type W = any
const ORD = JSON.parse(readFileSync(resolve(__dirname, "../../node_ordinals.json"), "utf8")).ordinals as Record<string, number>
const DAY = 20000
const S = ORD["Positions/Mount"] + "/top"
const ID = { known: "Submissions/Americana/from-Mount", due: "Submissions/Kimura/from-Mount", fresh: "Submissions/Armbar/from-Mount" }
const ROWS = { [ORD[ID.known]]: [DAY + 9, 14, DAY - 5, 1], [ORD[ID.due]]: [DAY - 1, 3, DAY - 4, 1] }
/** the grade buttons answer only a press that began NG_GRADE_ARM_MS (500 ms) after the strip appeared */
const ARM = 600
const NEXT = DAY + 10   // past the known move's due date (DAY + 9)

async function seat(page: Page, hidden = true) {
  await page.addInitScript((d) => { (window as W).__NG_EPOCH_DAY__ = d }, DAY)
  const j = journey(page)
  await j.boot("/", { initialState: { v: 2, settings: { hideMoves: hidden }, settingsAt: { hideMoves: 1 }, moves: { [S]: ROWS } } })
  await j.land("Mount Top")
  await expect.poll(() => page.evaluate(() => ((window as W).__neural._optionCards || []).filter((c: W) => !c.opt.threat).length)).toBeGreaterThan(3)
  // by IDENTITY (§6.3): a hand can re-sort once when its win chances land, and the tag rides the card
  const n = await page.evaluate((id) => {
    const a = (window as W).__neural
    let n = 0
    for (const c of a._optionCards) for (const [k, v] of Object.entries(id)) if (c.opt.node.id === v && !c.opt.threat) { c.card.setAttribute("data-ks", k); n++ }
    return n
  }, ID)
  expect(n, "the three seeded moves are dealt at Mount Top").toBe(3)
  return j
}

/** What a player can SEE of the card: never its text */
const face = (page: Page, k: string) => page.evaluate((k) => {
  const c = document.querySelector(`[data-ks="${k}"]`) as HTMLElement
  const back = c.querySelector(".ng-choice-back") as HTMLElement | null, film = c.querySelector("[data-choice-media]")!.getBoundingClientRect()
  const b = back && getComputedStyle(back).display !== "none" ? back.getBoundingClientRect() : null
  const covered = !!b && Math.abs(b.top - film.top) < 1 && Math.abs(b.bottom - film.bottom) < 1 && Math.abs(b.left - film.left) < 1 && Math.abs(b.right - film.right) < 1
  const aria = c.querySelector("[data-choice-execute]")?.getAttribute("aria-label") || ""
  return {
    name: getComputedStyle(c.querySelector(".ngchoice-title")!).visibility, film: covered ? "covered" : "open",
    announced: /^Hidden move \d+$/.test(aria) ? "hidden move" : aria.length > 0 ? "by name" : "nothing", gold: c.hasAttribute("data-mastered"),
    asking: c.hasAttribute("data-asking") ? c.querySelector("[data-choice-grade] span")?.textContent || "?" : null,
  }
}, k)
const UP = { name: "visible", film: "open", announced: "by name", asking: null }
const DOWN = { name: "hidden", film: "covered", announced: "hidden move", asking: null }

/** Does the map name this card's orb when the pointer is on it? Read off the frame `draw()` rendered. */
const named = (page: Page, k: string) => page.evaluate((k) => {
  const a = (window as W).__neural, o = a._optionCards.find((c: W) => c.card.getAttribute("data-ks") === k).opt
  const idx = o.idx, partner = a.nodes[idx].pi
  a._hover = { idx, t: a.now }; a.advance(30)
  const hit = (l: W) => !!l && (l.idx === idx || l.idx === partner)
  const r = hit(a._lastPairLabel) || hit(a._lastHoverLabel)
  a._hover = null; a.advance(30)
  return r
}, k)

/** A point on the card's title row that a real pointer reaches: the card owns it (§6.1) */
async function pointOn(page: Page, k: string) {
  const at = await page.evaluate((k) => {
    const c = document.querySelector(`[data-ks="${k}"]`) as HTMLElement
    ;(window as W).__neural._handTouched = true   // the hand keeps its order from here (a peek touches it anyway)
    c.scrollIntoView({ inline: "nearest", block: "nearest" })
    const r = c.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + 22
    const top = document.elementFromPoint(x, y)
    return { x, y, ok: !!top && c.contains(top), who: top ? top.outerHTML.slice(0, 80) : "nothing" }
  }, k)
  expect(at.ok, `the ${k} card's title row is reachable where it sits (elementFromPoint: ${at.who})`).toBe(true)
  return at
}

const row = (page: Page, k: string) => page.evaluate(([s, m]) => ((window as W).__neural.moves[s] || {})[m] || null, [S, String(ORD[(ID as W)[k]])])
const executing = (page: Page) => page.evaluate(() => !!(window as W).__neural._execution)
/** the player comes back to the tab the next day */
const comeBack = (page: Page, day: number) => page.evaluate((d) => { (window as W).__NG_EPOCH_DAY__ = d; document.dispatchEvent(new Event("visibilitychange")) }, day)

async function threeFaces(page: Page) {
  expect({ ...(await face(page, "known")), gold: undefined }, "known: face up, its name and its film, announced by name (owner, 13 Nov)").toEqual({ ...UP, gold: undefined })
  expect({ ...(await face(page, "due")), gold: undefined }, "due: face down, name and film, announced by its place").toEqual({ ...DOWN, gold: undefined })
  expect({ ...(await face(page, "fresh")), gold: undefined }, "never answered: face down").toEqual({ ...DOWN, gold: undefined })
  expect([(await face(page, "known")).gold, (await face(page, "due")).gold, (await face(page, "fresh")).gold], "gold: the two Yeses (due too), not the new one").toEqual([true, true, false])
  expect(await named(page, "known"), "...and the map names the known move").toBe(true)
  expect([await named(page, "due"), await named(page, "fresh")], "...and neither face-down one").toEqual([false, false])
}

for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 631 }]) {
  test.describe(`mouse ${vp.width}x${vp.height}`, () => {
    test.use({ viewport: vp })

    test(`a known move not due is face up; it comes due and is asked; a Yes turns it up again (${vp.width})`, async ({ page }) => {
      const j = await seat(page)
      await threeFaces(page)
      // a hover on the face-up card is not a look: it turns nothing, asks nothing, and the card stays as it was
      const p = await pointOn(page, "known")
      await page.mouse.move(p.x, p.y)
      await page.waitForTimeout(300)
      expect({ ...(await face(page, "known")), gold: undefined }, "the pointer on the known card: still face up, and it asks nothing").toEqual({ ...UP, gold: undefined })
      await page.mouse.move(p.x, p.y - 160)

      await comeBack(page, NEXT)
      await expect.poll(async () => ({ ...(await face(page, "known")), gold: undefined }), { message: "coming back the next day: it is face down, as every move to recall" }).toEqual({ ...DOWN, gold: undefined })
      expect((await face(page, "known")).gold, "...still gold (the last answer was a Yes)").toBe(true)
      expect(await named(page, "known"), "...and the map no longer names it").toBe(false)

      const q = await pointOn(page, "known")
      await page.mouse.move(q.x, q.y)
      await expect.poll(async () => (await face(page, "known")).asking, { message: "a look asks Still got it?" }).toBe("Still got it?")
      expect(await page.locator('[data-ks="known"] [data-grade]').count(), "...with Yes and No").toBe(2)
      await page.waitForTimeout(ARM)
      await j.clickByMouse('[data-ks="known"] [data-grade="yes"]', '"Yes"')
      expect(await executing(page), "Yes is not a play").toBe(false)
      expect({ ...(await face(page, "known")), gold: undefined }, "a Yes: face up again at once, asking nothing").toEqual({ ...UP, gold: undefined })
      await page.mouse.move(q.x, q.y - 160)
      await page.waitForTimeout(200)
      expect({ ...(await face(page, "known")), gold: undefined }, "...and it stays up once the pointer has left").toEqual({ ...UP, gold: undefined })
      const r = await row(page, "known")
      expect([r[3], r[2], r[0] > NEXT], "the row: a Yes answered today, due again after today").toEqual([1, NEXT, true])
      expect(await named(page, "known"), "the map names it again").toBe(true)
      expect([(await face(page, "due")).name, (await face(page, "fresh")).name], "the other two are still face down").toEqual(["hidden", "hidden"])
    })
  })
}

test.describe("touch 390x631", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 631 } })

  test("by touch: the known card is up, comes due and is asked, a Yes keeps it up through another card's look, and its first tap plays", async ({ page }) => {
    await seat(page)
    await threeFaces(page)
    await comeBack(page, NEXT)
    await expect.poll(async () => (await face(page, "known")).name, { message: "coming back the next day: it is face down" }).toBe("hidden")
    const p = await pointOn(page, "known")
    await page.touchscreen.tap(p.x, p.y)
    expect(await executing(page), "the first tap on a face-down card turns it up and plays nothing").toBe(false)
    expect((await face(page, "known")).asking, "...and asks Still got it?").toBe("Still got it?")
    const yes = await page.evaluate(() => { const r = document.querySelector('[data-ks="known"] [data-grade="yes"]')!.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })
    await page.waitForTimeout(ARM)
    await page.touchscreen.tap(yes.x, yes.y)
    expect(await executing(page), "a tap on Yes grades and plays nothing").toBe(false)
    expect({ ...(await face(page, "known")), gold: undefined }, "a Yes: face up").toEqual({ ...UP, gold: undefined })
    // another card's first tap closes the card turned up before it, but a known card is not turned up: it stays
    const f = await pointOn(page, "fresh")
    await page.touchscreen.tap(f.x, f.y)
    expect([(await face(page, "fresh")).name, (await face(page, "fresh")).asking], "the fresh card's first tap turns it up and asks").toEqual(["visible", "Did you get it?"])
    expect({ ...(await face(page, "known")), gold: undefined }, "...and the known card stays face up").toEqual({ ...UP, gold: undefined })
    expect(await executing(page)).toBe(false)
    const k = await pointOn(page, "known")
    await page.touchscreen.tap(k.x, k.y)
    expect(await executing(page), "a face-up card's first tap plays it, as with moves shown").toBe(true)
  })
})

test("a pull from another device: its No turns the card down in place, its Yes turns it up again", async ({ page }) => {
  await seat(page)
  expect((await face(page, "known")).name, "precondition: the known card is face up").toBe("visible")
  // the live receipt path: `_pullAndMerge` and another tab's write both land through `_hydrateProgressBlob`
  const pull = (r: number[]) => page.evaluate(([s, m, r]) => {
    const a = (window as W).__neural, b = a._progressBlob()
    a._hydrateProgressBlob({ ...b, moves: { ...b.moves, [s as string]: { ...b.moves[s as string], [m as string]: r } } })
  }, [S, String(ORD[ID.known]), r] as const)
  await pull([DAY + 1, 1, DAY, 0])
  expect({ ...(await face(page, "known")), gold: undefined }, "another device's No: face down, no redeal").toEqual({ ...DOWN, gold: undefined })
  expect([(await face(page, "known")).gold, await named(page, "known")], "...its gold gone, and the map withholds its name").toEqual([false, false])
  await pull([DAY + 3, 3, DAY, 1])
  expect({ ...(await face(page, "known")), gold: undefined }, "another device's Yes: face up again").toEqual({ ...UP, gold: undefined })
  expect([(await face(page, "known")).gold, await named(page, "known")], "...gold again, and the map names it").toEqual([true, true])
})

test("control: with moves shown nothing is face down, before or after the day turns", async ({ page }) => {
  await seat(page, false)
  expect(await page.locator("[data-hide], .ng-choice-back, [data-choice-grade]").count(), "no hidden-moves DOM on any card while shown").toBe(0)
  for (const k of ["known", "due", "fresh"]) expect({ ...(await face(page, k)), gold: undefined }, `${k}: face up`).toEqual({ ...UP, gold: undefined })
  expect([await named(page, "known"), await named(page, "due"), await named(page, "fresh")], "the map names all three").toEqual([true, true, true])
  await comeBack(page, NEXT)
  await page.waitForTimeout(200)
  expect(await page.locator("[data-hide], .ng-choice-back, [data-choice-grade]").count(), "...and still none after the day turns").toBe(0)
})
