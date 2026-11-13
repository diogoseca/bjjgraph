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
 *
 * AND A MOVE WHOSE FLASHCARDS ARE ALL LEARNED (v1.268.0, KS2; the owner, 13 Nov 05:47: "b, Also a move whose
 * flashcards are all learned"). Two more seeded moves, never answered in the row:
 *   learned     Cross Collar Choke from Mount  every card at stage 3, none due        face up, no gold
 *   learnedDue  Loop Choke from Mount          every card at stage 3, ONE due today   face down; a look asks "Did you get it?"
 * "All learned" is the test gold's level 2 reads, `deckMastery(key) >= 1` (`_deckLearned`); "due" is the formula
 * `duePool` uses. The row rules wherever it exists: another device's No puts the learned move face down. It is never a
 * known move: no row, "Moves known" and the odds' moves part unchanged. A deck with no flashcards is never learned:
 * every technique deck the wire names is walked, with stale grades planted on each empty or missing one.
 * The decks' question hashes come from a first plain boot (the app's own `qhash` over its hydrated cards), once per file.
 * Today's wire has NO technique deck that is empty or missing (1,298 walked, 0 and 0, printed every run), so the
 * empty-deck test makes the three shapes itself on a dealt move, each with stale grades planted, and keeps a control.
 *
 * KS2 MUTANTS (v1.268.0), the served bundle, each red at the named assertion; the neutral control is green in all ten:
 *   kind 2 off (`_deckLearned` false)                -> "learned: ... face up, no gold" (both mouse, touch), the pull's
 *                                                       precondition, the empty-deck test's control
 *   a due flashcard ignored                          -> "learnedDue: ... face down, no gold" (both mouse, touch)
 *   the flashcards overrule a No in the row          -> "another device's No: face down whatever its flashcards say"
 *   zero cards read learned (`deckMastery`, n 0 -> 1) -> "a deck whose manifest says 0 cards: not learned, ..."
 *   a laxer threshold (0.6, not gold's test)          -> "one of its cards at stage 2: face down" (both mouse)
 *   kind 2 wears gold                                -> "learned: ... face up, no gold" (both mouse, touch)
 * #401's own bundle fails the five KS2 tests (the empty-deck one before its claim: `_deckLearned` does not exist there)
 * and passes the five #401 tests.
 *
 * THE GOLD BECAME A SEAL (v1.272.0, the owner, 13 Nov: "The mastered cards show up with a golden outline, and this is
 * confusing. It seems like this is the selected technique"; his pick "a, A gold seal in the corner": "A small filled
 * seal: you answered Yes here. A hollow one: its flashcards are learned"). This file's `gold` (`data-mastered`) became
 * `seal` (`data-seal`: "known" filled, "learned" hollow, null none). What each changed assertion claimed before:
 *   the three faces     was "gold: the two Yeses (due too), not the new one" [true, true, false]
 *                       now "the filled seal on the known move only" ["known", null, null]: a due move FACE DOWN wears none
 *   coming back (mouse) was "...still gold (the last answer was a Yes)"   now "...and its seal gone (it is due and face down)"
 *   the pull's No / Yes was "its gold gone" / "gold again"               now no seal / the filled seal
 *   learned (4 places)  was "face up, no gold"                           now "face up, the HOLLOW seal"
 *   learnedDue          was "face down, no gold"                         now "face down, no seal"
 *   the learned pull    was No "no gold" / Yes "now a known move, gold"  now no seal / the filled seal
 * KS2's mutant "kind 2 wears gold" has no claim left (kind 2 wears the hollow seal now); its successor, "filled and
 * hollow swapped", is killed in known-move-seal.spec.ts, which pins the seal's geometry, words and kinds.
 */

type W = any
const ORD = JSON.parse(readFileSync(resolve(__dirname, "../../node_ordinals.json"), "utf8")).ordinals as Record<string, number>
const DAY = 20000
const S = ORD["Positions/Mount"] + "/top"
const ID = { known: "Submissions/Americana/from-Mount", due: "Submissions/Kimura/from-Mount", fresh: "Submissions/Armbar/from-Mount",
  learned: "Submissions/Cross-Collar-Choke/from-Mount", learnedDue: "Submissions/Loop-Choke/from-Mount" }
const ROWS = { [ORD[ID.known]]: [DAY + 9, 14, DAY - 5, 1], [ORD[ID.due]]: [DAY - 1, 3, DAY - 4, 1] }
/** the grade buttons answer only a press that began NG_GRADE_ARM_MS (500 ms) after the strip appeared */
const ARM = 600
const NEXT = DAY + 10   // past the known move's due date (DAY + 9)
const LEARNED_DUE = DAY + 30   // the learned decks' cards come due here (one of learnedDue's is due already)

/** the two learned decks: their keys and their cards' question hashes, read once from the app itself */
let DECKS: Record<"learned" | "learnedDue", { key: string; qh: string[] }> | null = null
async function decks(page: Page) {
  if (DECKS) return DECKS
  await journey(page).boot("/")
  // NEVER AN ASYNC EVALUATE THAT AWAITS A DECK: under load Chromium collects its promise and Playwright reports "Execution
  // context was destroyed" with no navigation (it bit this file's picture script). The hydration starts fire-and-forget,
  // a read-only signal is polled, and the hashes are read synchronously.
  const keys = await page.evaluate((ids) => {
    const a = (window as W).__neural, out: W = {}
    for (const [k, id] of Object.entries(ids)) {
      const key = out[k] = a.deckKeyFor(a.nodes.find((n: W) => n.id === id && n.role !== "defender")).key
      if (!a._deckHasCards(key)) void a.hydrateDeck(key)
    }
    return out as Record<string, string>
  }, { learned: ID.learned, learnedDue: ID.learnedDue })
  await expect.poll(() => page.evaluate((keys) => Object.values(keys).every((k) => (window as W).__neural._deckHasCards(k)), keys), { message: "both decks landed" }).toBe(true)
  DECKS = await page.evaluate((keys) => {
    const a = (window as W).__neural
    return Object.fromEntries(Object.entries(keys).map(([k, key]) => [k, { key, qh: a._cardsOf(a.flashcards.decks[key]).map((c: W) => a.qhash(c.q)) }]))
  }, keys) as W
  expect(DECKS!.learned.qh.length, "the learned move's deck has flashcards").toBeGreaterThan(0)
  expect(DECKS!.learnedDue.qh.length, "...and the other more than one, so one can be due while the rest are not").toBeGreaterThan(1)
  return DECKS!
}

async function seat(page: Page, hidden = true) {
  const D = await decks(page)
  // every card of both decks learned (stage 3) and scheduled ahead, but for ONE of learnedDue's, due yesterday
  const stage = Object.fromEntries(Object.values(D).map((d) => [d.key, Object.fromEntries(d.qh.map((q) => [q, 3]))]))
  const srs = Object.fromEntries(Object.entries(D).map(([k, d]) => [d.key, Object.fromEntries(d.qh.map((q, i) =>
    [q, k === "learnedDue" && i === 0 ? [DAY - 1, 7, DAY - 8] : [LEARNED_DUE, 30, DAY - 2]]))]))
  await page.addInitScript((d) => { (window as W).__NG_EPOCH_DAY__ = d }, DAY)
  const j = journey(page)
  await j.boot("/", { initialState: { v: 2, settings: { hideMoves: hidden }, settingsAt: { hideMoves: 1 }, moves: { [S]: ROWS }, stage, srs } })
  await j.land("Mount Top")
  await expect.poll(() => page.evaluate(() => ((window as W).__neural._optionCards || []).filter((c: W) => !c.opt.threat).length)).toBeGreaterThan(3)
  // by IDENTITY (§6.3): a hand can re-sort once when its win chances land, and the tag rides the card
  const n = await page.evaluate((id) => {
    const a = (window as W).__neural
    let n = 0
    for (const c of a._optionCards) for (const [k, v] of Object.entries(id)) if (c.opt.node.id === v && !c.opt.threat) { c.card.setAttribute("data-ks", k); n++ }
    return n
  }, ID)
  expect(n, "the five seeded moves are dealt at Mount Top").toBe(5)
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
    announced: /^Hidden move \d+$/.test(aria) ? "hidden move" : aria.length > 0 ? "by name" : "nothing", seal: c.getAttribute("data-seal"),
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
  expect({ ...(await face(page, "known")), seal: undefined }, "known: face up, its name and its film, announced by name (owner, 13 Nov)").toEqual({ ...UP, seal: undefined })
  expect({ ...(await face(page, "due")), seal: undefined }, "due: face down, name and film, announced by its place").toEqual({ ...DOWN, seal: undefined })
  expect({ ...(await face(page, "fresh")), seal: undefined }, "never answered: face down").toEqual({ ...DOWN, seal: undefined })
  // v1.272.0: was [true, true, false], "gold: the two Yeses (due too), not the new one"
  expect([(await face(page, "known")).seal, (await face(page, "due")).seal, (await face(page, "fresh")).seal], "the filled seal on the known move; none on the due one (being asked) or the new one").toEqual(["known", null, null])
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
      expect({ ...(await face(page, "known")), seal: undefined }, "the pointer on the known card: still face up, and it asks nothing").toEqual({ ...UP, seal: undefined })
      await page.mouse.move(p.x, p.y - 160)

      await comeBack(page, NEXT)
      await expect.poll(async () => ({ ...(await face(page, "known")), seal: undefined }), { message: "coming back the next day: it is face down, as every move to recall" }).toEqual({ ...DOWN, seal: undefined })
      // v1.272.0: was true, "...still gold (the last answer was a Yes)"
      expect((await face(page, "known")).seal, "...and its seal gone: due and face down, a card to be asked wears none").toBeNull()
      expect(await named(page, "known"), "...and the map no longer names it").toBe(false)

      const q = await pointOn(page, "known")
      await page.mouse.move(q.x, q.y)
      await expect.poll(async () => (await face(page, "known")).asking, { message: "a look asks Still got it?" }).toBe("Still got it?")
      expect(await page.locator('[data-ks="known"] [data-grade]').count(), "...with Yes and No").toBe(2)
      await page.waitForTimeout(ARM)
      await j.clickByMouse('[data-ks="known"] [data-grade="yes"]', '"Yes"')
      expect(await executing(page), "Yes is not a play").toBe(false)
      expect({ ...(await face(page, "known")), seal: undefined }, "a Yes: face up again at once, asking nothing").toEqual({ ...UP, seal: undefined })
      await page.mouse.move(q.x, q.y - 160)
      await page.waitForTimeout(200)
      expect({ ...(await face(page, "known")), seal: undefined }, "...and it stays up once the pointer has left").toEqual({ ...UP, seal: undefined })
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
    expect({ ...(await face(page, "known")), seal: undefined }, "a Yes: face up").toEqual({ ...UP, seal: undefined })
    // another card's first tap closes the card turned up before it, but a known card is not turned up: it stays
    const f = await pointOn(page, "fresh")
    await page.touchscreen.tap(f.x, f.y)
    expect([(await face(page, "fresh")).name, (await face(page, "fresh")).asking], "the fresh card's first tap turns it up and asks").toEqual(["visible", "Did you get it?"])
    expect({ ...(await face(page, "known")), seal: undefined }, "...and the known card stays face up").toEqual({ ...UP, seal: undefined })
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
  expect({ ...(await face(page, "known")), seal: undefined }, "another device's No: face down, no redeal").toEqual({ ...DOWN, seal: undefined })
  // v1.272.0: was [false, false], "...its gold gone"
  expect([(await face(page, "known")).seal, await named(page, "known")], "...its seal gone, and the map withholds its name").toEqual([null, false])
  await pull([DAY + 3, 3, DAY, 1])
  expect({ ...(await face(page, "known")), seal: undefined }, "another device's Yes: face up again").toEqual({ ...UP, seal: undefined })
  // v1.272.0: was [true, true], "...gold again"
  expect([(await face(page, "known")).seal, await named(page, "known")], "...the filled seal again, and the map names it").toEqual(["known", true])
})

test("control: with moves shown nothing is face down, before or after the day turns", async ({ page }) => {
  await seat(page, false)
  expect(await page.locator("[data-hide], .ng-choice-back, [data-choice-grade]").count(), "no hidden-moves DOM on any card while shown").toBe(0)
  for (const k of ["known", "due", "fresh", "learned", "learnedDue"]) expect({ ...(await face(page, k)), seal: undefined }, `${k}: face up`).toEqual({ ...UP, seal: undefined })
  expect([await named(page, "known"), await named(page, "due"), await named(page, "fresh")], "the map names all three").toEqual([true, true, true])
  await comeBack(page, NEXT)
  await page.waitForTimeout(200)
  expect(await page.locator("[data-hide], .ng-choice-back, [data-choice-grade]").count(), "...and still none after the day turns").toBe(0)
})

// ── KS2 (v1.268.0): a move never answered in the row whose flashcards are all learned ─────────────────────────────

async function learnedFaces(page: Page) {
  // v1.272.0: was { ...UP, gold: false } / { ...DOWN, gold: false }, "no gold"; the learned move wears the hollow seal
  expect(await face(page, "learned"), "learned: never answered, every flashcard learned, none due: face up, the hollow seal (owner, 13 Nov 05:47)").toEqual({ ...UP, seal: "learned" })
  expect(await face(page, "learnedDue"), "learnedDue: the same, with one flashcard due: face down, no seal").toEqual({ ...DOWN, seal: null })
  expect([await named(page, "learned"), await named(page, "learnedDue")], "...the map names the face-up one, not the face-down one").toEqual([true, false])
}

/** what the record says of the learned move: no row, not a known move, and the moves add nothing to its deck */
const notKnown = (page: Page) => page.evaluate(([s, m, key]) => {
  const a = (window as W).__neural, line = a._movesKnownLine()
  return { row: ((a.moves || {})[s] || {})[m] || null, known: line && line.known, movesPart: a.mastery(key) - a._flashMastery(key) }
}, [S, String(ORD[ID.learned]), DECKS!.learned.key])

for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 631 }]) {
  test.describe(`learned, mouse ${vp.width}x${vp.height}`, () => {
    test.use({ viewport: vp })

    test(`a move whose flashcards are all learned is face up until one comes due; it is never a known move (${vp.width})`, async ({ page }) => {
      const j = await seat(page)
      await learnedFaces(page)
      expect(await notKnown(page), "no row for it, Moves known counts only the two seeded Yeses, and the moves add nothing to its deck").toEqual({ row: null, known: 2, movesPart: 0 })
      // the pointer on it is not a look: nothing asks
      const p = await pointOn(page, "learned")
      await page.mouse.move(p.x, p.y)
      await page.waitForTimeout(300)
      // v1.272.0: was gold: false
      expect(await face(page, "learned"), "the pointer on the learned card: still face up with its hollow seal, asking nothing").toEqual({ ...UP, seal: "learned" })
      // a look at the one with a due flashcard asks as for any move never answered: Did you get it? (Yes only)
      const q = await pointOn(page, "learnedDue")
      await page.mouse.move(q.x, q.y)
      await expect.poll(async () => (await face(page, "learnedDue")).asking, { message: "a look at learnedDue asks Did you get it?" }).toBe("Did you get it?")
      expect(await page.locator('[data-ks="learnedDue"] [data-grade]').count(), "...with Yes only").toBe(1)
      await page.mouse.move(q.x, q.y - 160)
      // "all learned" is every card at stage 3: one card back at stage 2 (a recognition answer's ceiling) is not
      await page.evaluate(([key, qh]) => { const a = (window as W).__neural; a.stage[key][qh] = 2; a._publishKnowledge("test:one-card-at-stage-2") }, [DECKS!.learned.key, DECKS!.learned.qh[0]])
      await expect.poll(async () => (await face(page, "learned")).name, { message: "one of its cards at stage 2: face down" }).toBe("hidden")
      await page.evaluate(([key, qh]) => { const a = (window as W).__neural; a.stage[key][qh] = 3; a._publishKnowledge("test:learned-again") }, [DECKS!.learned.key, DECKS!.learned.qh[0]])
      await expect.poll(async () => (await face(page, "learned")).name, { message: "learned again: face up" }).toBe("visible")
      // the day its flashcards come due, the player comes back: face down, and a look asks
      await comeBack(page, LEARNED_DUE + 1)
      await expect.poll(async () => ({ ...(await face(page, "learned")), seal: undefined }), { message: "its flashcards due: face down" }).toEqual({ ...DOWN, seal: undefined })
      const r = await pointOn(page, "learned")
      await page.mouse.move(r.x, r.y)
      await expect.poll(async () => (await face(page, "learned")).asking, { message: "...and a look asks Did you get it?" }).toBe("Did you get it?")
      expect(await executing(page), "nothing played").toBe(false)
      void j
    })
  })
}

test.describe("learned, touch 390x631", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 631 } })

  test("by touch: the learned card is up and its first tap plays; the one with a due flashcard turns up on a tap and asks", async ({ page }) => {
    await seat(page)
    await learnedFaces(page)
    const d = await pointOn(page, "learnedDue")
    await page.touchscreen.tap(d.x, d.y)
    expect(await executing(page), "a first tap on the face-down one turns it up and plays nothing").toBe(false)
    expect([(await face(page, "learnedDue")).name, (await face(page, "learnedDue")).asking], "...and asks Did you get it?").toEqual(["visible", "Did you get it?"])
    // v1.272.0: was gold: false
    expect(await face(page, "learned"), "the learned card stays face up, with its hollow seal").toEqual({ ...UP, seal: "learned" })
    const l = await pointOn(page, "learned")
    await page.touchscreen.tap(l.x, l.y)
    expect(await executing(page), "the learned card's first tap plays it, as a face-up card's does").toBe(true)
  })
})

test("a learned move answered in the row on another device: the row rules from then on", async ({ page }) => {
  await seat(page)
  expect((await face(page, "learned")).name, "precondition: the learned card is face up").toBe("visible")
  const pull = (r: number[]) => page.evaluate(([s, m, r]) => {
    const a = (window as W).__neural, b = a._progressBlob()
    a._hydrateProgressBlob({ ...b, moves: { ...b.moves, [s as string]: { ...b.moves[s as string], [m as string]: r } } })
  }, [S, String(ORD[ID.learned]), r] as const)
  await pull([DAY + 1, 1, DAY, 0])
  // v1.272.0: was { ...DOWN, gold: false } and { ...UP, gold: true }
  expect(await face(page, "learned"), "another device's No: face down whatever its flashcards say, no seal").toEqual({ ...DOWN, seal: null })
  await pull([DAY + 3, 3, DAY, 1])
  expect(await face(page, "learned"), "another device's Yes: face up, now a known move: the hollow seal fills").toEqual({ ...UP, seal: "known" })
})

test("a deck with no flashcards is never learned: none on today's wire (counted), so made three ways on a dealt move", async ({ page }) => {
  await seat(page)
  // the census: every technique deck the wire names, and how many are empty or missing today
  const census = await page.evaluate(() => {
    const a = (window as W).__neural, decks = a.flashcards.decks
    let walked = 0, empty = 0, missing = 0
    for (const n of a.nodes) {
      if (n.ty === "positions" || n.role === "defender") continue
      walked++
      const d = decks[a.deckKeyFor(n).key]
      if (!d) missing++; else if (a._deckCardCount(d) === 0) empty++
    }
    return { walked, empty, missing }
  })
  console.log(`[known-moves-shown] technique decks walked ${census.walked}: ${census.empty} empty, ${census.missing} missing`)
  expect(census.walked, "the walk saw the technique corpus").toBeGreaterThan(1000)
  // so the never-answered "fresh" move's deck is made empty three ways, each with stale grades planted (what a 0-of-0
  // or a count of grades would read as "all learned"), and its card must stay face down
  const shape = (how: string) => page.evaluate(async (how) => {
    const a = (window as W).__neural, oc = a._optionCards.find((c: W) => c.card.getAttribute("data-ks") === "fresh"), key = a.deckKeyFor(oc.opt.node).key
    a.__realDeck = a.__realDeck || a.flashcards.decks[key]
    if (how === "missing") delete a.flashcards.decks[key]
    else a.flashcards.decks[key] = how === "stub" ? { n: 0 } : { n: 0, cards: [] }
    a.stage[key] = { "0badc0de": 3, "0badc0df": 3 }
    a.srs[key] = { "0badc0de": [99999, 30, 1], "0badc0df": [99999, 30, 1] }
    a._publishKnowledge("test:empty-deck-" + how)
    return { learned: a._deckLearned(oc.opt), mastery: a.deckMastery(key) }
  }, how)
  for (const how of ["missing", "stub", "resident"]) {
    const r = await shape(how)
    expect({ ...r, face: (await face(page, "fresh")).name }, `a deck ${how === "missing" ? "missing from the manifest" : how === "stub" ? "whose manifest says 0 cards" : "with 0 cards resident"}: not learned, mastery 0, face down`)
      .toEqual({ learned: false, mastery: 0, face: "hidden" })
  }
  // control: the same move with its real deck, every card learned and none due, turns face up
  const freshKey = await page.evaluate(() => {
    const a = (window as W).__neural, oc = a._optionCards.find((c: W) => c.card.getAttribute("data-ks") === "fresh"), key = a.deckKeyFor(oc.opt.node).key
    a.flashcards.decks[key] = a.__realDeck
    if (!a._deckHasCards(key)) void a.hydrateDeck(key)   // fire-and-forget, then poll (never await a deck in an evaluate)
    return key as string
  })
  await expect.poll(() => page.evaluate((key) => (window as W).__neural._deckHasCards(key), freshKey), { message: "the real deck landed" }).toBe(true)
  const control = await page.evaluate(() => {
    const a = (window as W).__neural, oc = a._optionCards.find((c: W) => c.card.getAttribute("data-ks") === "fresh"), key = a.deckKeyFor(oc.opt.node).key
    const qh = a._cardsOf(a.flashcards.decks[key]).map((c: W) => a.qhash(c.q))
    a.stage[key] = Object.fromEntries(qh.map((q: string) => [q, 3]))
    a.srs[key] = Object.fromEntries(qh.map((q: string) => [q, [99999, 30, 1]]))
    a._publishKnowledge("test:real-deck-learned")
    return { cards: qh.length, learned: a._deckLearned(oc.opt) }
  })
  expect({ ...control, face: (await face(page, "fresh")).name }, "control: its real deck learned, the same card turns face up").toEqual({ cards: control.cards, learned: true, face: "visible" })
  expect(control.cards, "...a deck with cards").toBeGreaterThan(0)
})
