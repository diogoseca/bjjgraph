import { test, expect } from "@playwright/test"
import { journey } from "../dsl"

/**
 * P0 — THE PANE LAW.
 *
 * The pane (flashcards sidebar — LEFT since v1.94.0) is MANUAL-ONLY. Before this phase it opened itself at
 * the start of a seeded roll, opened itself as a "save your progress" nudge, hid itself at
 * round end, and closed itself on assorted graph clicks — while never touching the clock.
 *
 * The law, in one line: nothing but the user opens or closes the pane; the pane being open
 * STOPS the game; closing it resumes the game ONLY if the pane is what stopped it.
 *
 * Rails: __neural.paused, .deckOpen, .deckShown, ._paneAutoPaused (one latch for the merged pane)
 * Beats: pane_paused, pane_resumed, save_hint
 */

const paused = (page: any) => page.evaluate(() => !!(window as any).__neural.paused)
const shown = (page: any) => page.evaluate(() => !!(window as any).__neural.deckShown)

test("opening the pane stops the game; closing it resumes the game", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await j.openQuestion() // U47 d: establish a question taken up with Answer for Points for the pane to decline.

  expect(await paused(page), "roll is live after landing").toBe(false)
  expect(await shown(page), "pane starts shut").toBe(false)

  // open it the way the user does: the top-left logo (the one pane opener — v1.99.0)
  await page.locator(".ng-logo").click()
  expect(await shown(page), "pane open after tab click").toBe(true)
  expect(await paused(page), "opening the pane stopped the game").toBe(true)
  await j.expectBeat("pane_paused")

  // v1.134.0: the question clock never pauses — opening the pane DECLINES the open question
  // (free), so nothing is draining behind the drawer and nothing was stolen either
  const t0 = await page.evaluate(() => (window as any).__neural._decision?.remaining ?? null)
  expect(t0, "the pane declined the question — no window is running").toBeNull()
  const beats = (await j.beats()).map((b: any) => b.beat)
  expect(beats, "and said so").toContain("land_q_declined")

  // close via the pane's ✕
  await page.locator(".ng-explorer-close").click()
  expect(await shown(page), "pane shut after ✕").toBe(false)
  expect(await paused(page), "closing the pane resumed the game").toBe(false)
  await j.expectBeat("pane_resumed")
})

test("closing the pane does NOT resume a roll the user paused by hand", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  // hand-pause FIRST (transport button seam), then open the pane on top of it
  await page.evaluate(() => (window as any).__neural.setPaused(true))
  await page.locator(".ng-logo").click()
  expect(await shown(page)).toBe(true)
  expect(
    await page.evaluate(() => !!(window as any).__neural._paneAutoPaused),
    "pane did not claim the pause",
  ).toBe(false)

  await page.evaluate(() => (window as any).__neural.setDeckOpen(false))
  expect(await paused(page), "the hand-pause survives closing the pane").toBe(true)
})

test("a round ending never hides the pane", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await page.locator(".ng-logo").click()
  expect(await shown(page)).toBe(true)

  // endRound is normally reached by the resolve path — which needs time, and time is frozen
  // while the pane is open. That is precisely the point: this rail asserts the round-end seam
  // itself no longer clears deckReady behind the user's back.
  await page.evaluate(() => (window as any).__neural.endRound("reset"))
  expect(await shown(page), "pane survives the round boundary").toBe(true)
  expect(
    await page.evaluate(() => !!(window as any).__neural.deckReady),
    "deckReady stays a data flag",
  ).toBe(true)
})

test("a new roll never opens the pane", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  expect(await shown(page)).toBe(false)

  // _openSidebarOnLand is the flag the "roll from here" confirm used to set to force the pane
  // open on the seeded landing. It may now only move FOCUS, never open.
  await j.rig("ai-skill", [0.5])
  await j.rig("role", [0])
  await j.rig("max-moves", [0.5])
  await page.evaluate(() => {
    const a = (window as any).__neural
    a._openSidebarOnLand = true
    a.startRoll()
  })
  for (let i = 0; i < 12; i++) {
    await j.advance(1000)
    if (await page.evaluate(() => ((window as any).__neural.optionIdxs || []).length > 0)) break
  }

  expect(await shown(page), "seeded roll landed with the pane still shut").toBe(false)
  expect(
    await paused(page),
    "and the new roll is live, not stopped by a pane it never opened",
  ).toBe(false)
})

test("the save nudge asks for the pane instead of forcing it open", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  // two graded answers is the nudge threshold (noteCardAnswered is the UI grading choke)
  await page.evaluate(() => {
    const a = (window as any).__neural
    a.noteCardAnswered()
    a.noteCardAnswered()
  })

  await j.expectBeat("save_hint")
  expect(await shown(page), "the nudge did not force the pane open").toBe(false)
  expect(await paused(page), "and did not stop the game").toBe(false)
})

test("a graph click does not close the pane on desktop", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await page.locator(".ng-logo").click()
  expect(await shown(page)).toBe(true)

  // closeDeckIfStudying is the canvas-click seam (canvas hit-testing has no DOM to click)
  await page.evaluate(() => (window as any).__neural.closeDeckIfStudying())
  expect(await shown(page), "desktop graph clicks leave the pane alone").toBe(true)
  expect(await paused(page), "and leave the game stopped").toBe(true)
})

test("Esc closes the pane once no overlay is up", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await page.locator(".ng-logo").click()
  expect(await shown(page)).toBe(true)

  await page.keyboard.press("Escape")
  expect(await shown(page), "Esc closed the pane").toBe(false)
  expect(await paused(page), "and resumed the game it stopped").toBe(false)
})

/**
 * A CLOCK THAT RUNS IS NOBODY'S, AND A KEY TAKES THE ROAD ITS PRESS TAKES (FOLLOW1, v1.293.1).
 *
 * With the drawer open beside the board (a desktop) the drawer holds the roll, and a move played from the hand started
 * the clock with the drawer's latch still set: measured on dev v1.292.1 and on v1.293.0 at 1440 and at 1024, 1 of 1 each,
 * by a mouse press on the card AND by its digit (they are one road, `activateOption`). Shutting the drawer afterwards
 * "resumed" a roll that was already running and beat `pane_resumed` for it. And where the drawer IS the screen (a window
 * of a phone's width) it covers the hand: at 600 and at 640 wide no card can be reached by a press (0 of 18), yet a digit
 * played one unseen (600 wide, 1 of 1).
 * AS IT IS AT 390 (the reader of PR #441, on dev's build and on this one alike): the drawer is 343 px wide there, the ends
 * of two of the hand's 18 cards show beside it, and a touch on one plays it with the drawer open, while its digit is
 * refused. The rule built here was by WIDTH (`isMobile`), not by reach. FOLLOW2 (v1.293.3) asks it BY REACH at
 * `activateOption`, for a digit, a click and a touch (option-reach.spec.ts): the journeys below are unchanged and still
 * hold (at 600 the drawer is the screen, and no card's middle is in reach).
 *
 * The survey behind "one rule, not a patch for 1": 14 key listeners in the build inputs and the window ladder's 14
 * branches, read whole. The digits 1 to 9 are the only keys that act on the roll while the drawer holds it; A to C, Enter,
 * Space, P, the four arrows, X, PageDown and Home changed nothing in a probe (paused, latch, moves, log, execution, the
 * open question, the position: all as they were), each being scoped to the drawer's own surface or standing down with
 * the landing card.
 *
 * Mutants (each alone, in the served bundle, a clean control first):
 *   H1 the clock's start leaves the drawer's latch set (`setPaused`) → both roads at "the drawer's claim on the clock is
 *      over: the roll is not running with the pause still set"
 *   H2 a digit plays a card the drawer covers (the ladder's digit branch) → "…its digit plays nothing" at "no digit played
 *      a card nobody could press"
 * NOT COVERED: a real phone has no keyboard to press a digit with; the covered case is asserted in a mouse window of a
 * phone's width, which is where a keyboard meets it. The touch at 390 on a card's end beside the drawer (above), and a
 * card partly under the drawer at 641 played by its digit: option-reach.spec.ts (FOLLOW2).
 */
const pane = (page: any) => page.evaluate(() => {
  const a = (window as any).__neural
  return { drawer: !!a.deckShown, paused: !!a.paused, latch: !!a._paneAutoPaused, moves: a.moveCount as number, running: !!a._execution || !!a.pulse }
})
const resumed = async (j: any) => (await j.beats()).filter((b: any) => b.beat === "pane_resumed").length
/** the whole record as the next save would write it, without the save's own clock */
const stored = (page: any) => page.evaluate(() => {
  const a = (window as any).__neural, at = a._progressAt, b = JSON.parse(JSON.stringify(a._progressBlob()))
  a._progressAt = at
  delete b.updatedAt
  return b as Record<string, unknown>
})
/** where the hand's first card is, and whether a press at its middle would reach it */
const firstCard = (page: any) => page.evaluate(() => {
  const a = (window as any).__neural, oc = (a._optionCards || []).find((c: any) => !c.opt.threat), card = oc && (oc.card as HTMLElement)
  if (!card) return null
  const b = (card.querySelector(".ng-choice-title-button") as HTMLElement) || card, r = b.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2
  const top = document.elementFromPoint(x, y)
  return { tech: oc.opt.node.t as string, x, y, reachable: !!top && (top === b || b.contains(top) || card.contains(top)) }
})

for (const road of ["a press on its card", "its digit"]) {
  test(`a move played beside the open drawer ends the drawer's claim on the clock: by ${road}`, async ({ page }) => {
    const j = journey(page)
    await j.boot("/")
    await j.land("Mount Top")
    await page.locator(".ng-logo").click()
    await j.advance(1500) // the hand slides clear of the drawer
    expect(await pane(page), "premise: the drawer holds the roll").toMatchObject({ drawer: true, paused: true, latch: true, moves: 0 })
    const card = await firstCard(page)
    expect(card, "premise: a hand is dealt").not.toBeNull()
    expect(card!.reachable, "premise: beside the drawer the hand's first card can be pressed").toBe(true)
    await j.rig("resolve", [0.01]); await j.rig("outcome", [0.01])
    if (road === "its digit") {
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
      await page.keyboard.press("1")
    } else await j.clickByMouse(`[data-tech="${card!.tech}"] .ng-choice-title-button`, "the hand's first card, beside the open drawer")
    await j.advance(300)
    const after = await pane(page)
    expect(after.moves > 0 || after.running, "the move is played").toBe(true)
    expect(after.paused, "and the clock runs: a move is how a held roll goes on").toBe(false)
    expect(after.latch, "the drawer's claim on the clock is over: the roll is not running with the pause still set").toBe(false)
    expect(after.drawer, "the drawer stays where it is").toBe(true)
    // shutting the drawer has no pause left to give back: it resumes nothing and says nothing
    await j.clickByMouse(".ng-explorer-close", "shut the drawer")
    expect(await pane(page), "the drawer is shut and the roll runs on").toMatchObject({ drawer: false, paused: false, latch: false })
    expect(await resumed(j), "shutting it resumed nothing, and beat nothing").toBe(0)
    // ...and the law is whole again at the next opening: open = the game stops, close = it resumes
    await j.nextHand()
    expect((await pane(page)).moves, "premise: that one move was played out").toBe(1)
    await page.locator(".ng-logo").click()
    expect(await pane(page), "opened again, the drawer stops the game and holds it").toMatchObject({ drawer: true, paused: true, latch: true })
    await j.clickByMouse(".ng-explorer-close", "shut the drawer")
    expect(await pane(page), "and shutting it resumes, as it always does").toMatchObject({ drawer: false, paused: false, latch: false })
    expect(await resumed(j), "said once").toBe(1)
  })
}

test.describe("a window of a phone's width, by mouse and keyboard (600x800)", () => {
  test.use({ viewport: { width: 600, height: 800 } })
  test("where the drawer covers the hand no press can reach a card, and its digit plays nothing", async ({ page }) => {
    const j = journey(page)
    await j.boot("/")
    await j.land("Mount Top")
    await page.locator(".ng-logo").click()
    await j.advance(1500)
    expect(await pane(page), "premise: the drawer holds the roll").toMatchObject({ drawer: true, paused: true, latch: true, moves: 0 })
    const card = await firstCard(page)
    expect(card, "premise: a hand is dealt").not.toBeNull()
    expect(card!.reachable, "premise: the drawer covers the hand's first card: a press at its middle does not reach it").toBe(false)
    const before = await stored(page), was = await page.evaluate(() => { const a = (window as any).__neural; return { log: (a.rollLog || []).map((h: any) => h.key), stands: a.currentPos, hand: (a.optionIdxs || []).join(",") } })
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
    for (const k of "123456789") { await page.keyboard.press(k); await j.advance(300) }
    expect(await pane(page), "no digit played a card nobody could press").toMatchObject({ drawer: true, paused: true, latch: true, moves: 0, running: false })
    expect(await page.evaluate(() => { const a = (window as any).__neural; return { log: (a.rollLog || []).map((h: any) => h.key), stands: a.currentPos, hand: (a.optionIdxs || []).join(",") } }), "the roll is as it was").toEqual(was)
    const now = await stored(page)
    expect(Object.keys(before).length, "premise: the record is read whole").toBeGreaterThan(15)
    expect(Object.keys({ ...before, ...now }).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(now[k])), "and nothing is stored").toEqual([])
    // with the drawer shut the hand is the player's again, and its digit plays as ever
    await j.clickByMouse(".ng-explorer-close", "shut the drawer")
    expect(await pane(page), "shutting the drawer resumes the roll it held").toMatchObject({ drawer: false, paused: false, latch: false })
    await j.rig("resolve", [0.01]); await j.rig("outcome", [0.01])
    await page.keyboard.press("1")
    await j.nextHand()
    expect((await pane(page)).moves, "with the drawer shut the digit plays its card, as ever").toBe(1)
  })
})

// NOTHING IS STORED DIFFERENTLY BY THE ROAD. The record's only run-to-run noise is its clocks (epoch-millisecond stamps: a
// challenge's `t`, the belt's `gf`, `openAt`): measured, the SAME road played twice differs in exactly those, so they are set
// to 0 on both sides and the same road twice is this test's own premise. What FOLLOW1 does change is a beat, not a stored
// field of these runs: shutting the drawer after such a move no longer beats `pane_resumed` (asserted above).
test("the same move stores the same whichever road plays it beside the open drawer: a press on its card, or its digit", async ({ browser, baseURL }) => {
  const play = async (road: string) => {
    const ctx = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } }), page = await ctx.newPage()
    const j = journey(page)
    await j.boot("/")
    await j.land("Mount Top")
    await page.locator(".ng-logo").click()
    await j.advance(1500)
    const card = await firstCard(page)
    await j.rig("resolve", [0.01]); await j.rig("outcome", [0.01])
    if (road === "digit") { await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur()); await page.keyboard.press("1") }
    else await j.clickByMouse(`[data-tech="${card!.tech}"] .ng-choice-title-button`, "the hand's first card")
    await j.advance(300)
    await j.clickByMouse(".ng-explorer-close", "shut the drawer")
    await j.nextHand()
    const rec = JSON.parse(JSON.stringify(await stored(page), (_k, v) => (typeof v === "number" && v > 1e12 ? 0 : v))) as Record<string, unknown>
    const out = { rec, moves: (await pane(page)).moves, log: await page.evaluate(() => ((window as any).__neural.rollLog || []).map((h: any) => h.key)), beats: (await j.beats()).map((b: any) => b.beat as string) }
    await ctx.close()
    return out
  }
  const differ = (x: Record<string, unknown>, y: Record<string, unknown>) => Object.keys({ ...x, ...y }).filter((k) => JSON.stringify(x[k]) !== JSON.stringify(y[k]))
  const a = await play("press"), b = await play("digit"), c = await play("press")
  expect(a.moves, "premise: each road played one move").toBe(1)
  expect(Object.keys(a.rec).length, "premise: the record is read whole").toBeGreaterThan(15)
  expect(differ(a.rec, c.rec), "premise: the same road twice stores the same, its clocks apart").toEqual([])
  expect(b.log, "the same roll either way").toEqual(a.log)
  expect(differ(a.rec, b.rec), "the digit stores what the press stores").toEqual([])
  expect(b.beats, "and beats what the press beats").toEqual(a.beats)
})
