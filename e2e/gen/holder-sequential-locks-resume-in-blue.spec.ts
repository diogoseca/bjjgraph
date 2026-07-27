/* @hyperspace {"theme":"lifetime-journeys","L":"white-belt-holder","F":"belt-path","B":"cross-feature"} @invariant "The sequential-unit lock discipline carries across the belt boundary: for a fresh white-belt holder, blue unit 1 renders unlocked, blue unit 2 renders data-locked='1', and drilling blue unit 1's lessons to goal (lesson_done per lesson) is what releases nothing until its checkpoint passes." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { whiteBeltHolder, CURRICULUM } from "./personas"

/**
 * SEQUENTIAL LOCKS RESUME INSIDE BLUE — winning white opens the blue BELT, but inside
 * blue the unit ladder restarts from zero: only unit 1 is playable, and lessons alone
 * never advance the ladder — the checkpoint is the sole release latch.
 *
 * Mechanism under test (neural/src/app.src.jsx):
 *   - renderBeltPath (~2483): uLocked = !beltUnlocked(bi) || !prevUnitDone, with
 *     prevUnitDone seeded true per belt → blue U1 unlocked the moment white is won,
 *     U2+ locked until unitComplete(U1).
 *   - unitComplete (~2426) = every live lesson done AND units[uk].checkpoint — so
 *     drilling all lessons to goal leaves the unit incomplete (data-done absent).
 *   - _maybeLessonDone (~2430) fires ONLY via noteCardDone (~839): the seeded white
 *     progress in the blob re-fires nothing at boot; lesson_done beats this life are
 *     exactly the blue drills we perform.
 *   - startCheckpoint (~3456): draws checkpoint.cards picks via rng("checkpoint-pick")
 *     (one draw per pick — the rig queue is pre-sized), auto-closes the explorer,
 *     fires checkpoint_start {unit, cards}.
 *   - _mcAnswer checkpoint branch (~3400): onDone(true) synchronously →
 *     _checkpointAnswer → on pass sets units[uk].checkpoint + fires
 *     checkpoint_passed + unit_done — the ONLY writer of the release latch.
 *
 * All keys derive from the served curriculum fixture (exact [data-unit] keys, never
 * positional nth — white's rows render first in the same list).
 */

const BLUE = CURRICULUM.belts[1]
const U1 = BLUE.units[0]
const U2 = BLUE.units[1]
const U1_KEY = `${BLUE.id}/${U1.id}`
const U2_KEY = `${BLUE.id}/${U2.id}`
const U1_DECKS: string[] = U1.lessons.map((l: any) => l.deckKey)
const CARDS: number = U1.checkpoint.cards

test("white-belt holder: blue unit ladder locks sequentially; lessons release nothing until the checkpoint passes", async ({ page }) => {
  // ── curriculum facts the assertions lean on — fail loudly here if the corpus shifts ──
  expect(BLUE.units.length, "blue has units 3+ for the tail census").toBeGreaterThanOrEqual(3)
  expect(U1_DECKS.length, "blue U1 defines lessons").toBeGreaterThan(0)
  expect(new Set(U1_DECKS).size, "U1 deckKeys distinct → beat census maps 1:1").toBe(U1_DECKS.length)
  expect(
    U1.lessons.every((l: any) => (l.frames || []).includes("gi")),
    "every U1 lesson is live in the default gi frame (drilling all of them satisfies the checkpoint gate)",
  ).toBe(true)
  expect(CARDS, "rig queue below is pre-sized to the checkpoint draw count").toBe(6)

  const j = journey(page)
  await j.boot("/", { initialState: whiteBeltHolder() })
  await j.land("Mount Top")

  // open the explorer's PATH view (curriculum loaded → path is the default mode);
  // land()'s built-in rigs cover every RNG site touched — the path render draws none
  await page.evaluate(() => (window as any).__neural.toggleExplorer())
  await expect(page.locator("[data-view]").first()).toBeVisible()
  await j.expectBeat("path_opened")

  const unitAttr = (uk: string, attr: string) =>
    page.locator(`[data-unit="${uk}"]`).first().getAttribute(attr)

  // ── phase A: the discipline resumes at the boundary — U1 open, U2 and ALL later locked ──
  expect(await unitAttr(U1_KEY, "data-locked"), "blue unit 1 is unlocked").toBeNull()
  expect(await unitAttr(U1_KEY, "data-done"), "blue unit 1 starts incomplete").toBeNull()
  for (const u of BLUE.units.slice(1)) {
    expect(
      await unitAttr(`${BLUE.id}/${u.id}`, "data-locked"),
      `later blue unit locked: ${u.id}`,
    ).toBe("1")
  }

  // ── phase B: drill every U1 lesson to goal — beats prove blue work starts from zero ──
  const beatsOf = async (name: string) => ((await j.beats()) as any[]).filter((b) => b.beat === name)
  expect((await beatsOf("lesson_done")).length, "seeded white progress re-fires no beats at boot").toBe(0)
  for (const dk of U1_DECKS) await j.drill(3, dk)
  const lessonBeats = await beatsOf("lesson_done")
  expect(lessonBeats.length, "one lesson_done per U1 deck").toBe(U1_DECKS.length)
  expect(new Set(lessonBeats.map((b) => b.deckKey))).toEqual(new Set(U1_DECKS))

  // ── phase C: lessons alone release NOTHING — re-render (close + reopen) and re-census ──
  await page.evaluate(() => (window as any).__neural.toggleExplorer())
  await page.evaluate(() => (window as any).__neural.toggleExplorer())
  await expect(page.locator("[data-view]").first()).toBeVisible()
  expect(await unitAttr(U2_KEY, "data-locked"), "unit 2 STILL locked after all U1 lessons").toBe("1")
  expect(await unitAttr(U1_KEY, "data-done"), "unit 1 still incomplete without its checkpoint").toBeNull()
  expect(
    await page.locator(`[data-checkpoint="${U1_KEY}"]`).first().getAttribute("data-done"),
    "U1 checkpoint row unpassed",
  ).toBeNull()
  expect((await beatsOf("unit_done")).length, "no unit completed yet").toBe(0)

  // ── phase D: pass the checkpoint — the sole release latch ──
  await j.rig("checkpoint-pick", [0.1, 0.3, 0.5, 0.7, 0.9, 0.2]) // pre-sized: one draw per pick
  await page.locator(`[data-checkpoint="${U1_KEY}"]`).first().click() // auto-scrolls; auto-closes explorer
  await j.advance(500)
  const started = await beatsOf("checkpoint_start")
  expect(started.length).toBe(1)
  expect(started[0].unit).toBe(U1_KEY)
  expect(started[0].cards, "draw queue was pre-sized to the checkpoint spec").toBe(CARDS)
  for (let i = 0; i < CARDS; i++) {
    const correct = await page.evaluate(() => (window as any).__neural._mc.correct)
    expect(typeof correct, `truth rail live for card ${i + 1}`).toBe("number")
    await page.locator("[data-mc-opt]").nth(correct).click()
    await j.advance(700)
  }
  const passed = await beatsOf("checkpoint_passed")
  expect(passed.length).toBe(1)
  expect(passed[0].unit).toBe(U1_KEY)
  expect(passed[0].firstTry, "every truth-rail answer landed first try").toBe(CARDS)
  expect(passed[0].of).toBe(CARDS)
  const unitDone = await beatsOf("unit_done")
  expect(unitDone.length).toBe(1)
  expect(unitDone[0].unit).toBe(U1_KEY)
  expect(unitDone[0].belt).toBe(BLUE.id)

  // ── phase E: NOW the ladder advances exactly one rung (re-open: startCheckpoint closed it) ──
  await page.evaluate(() => (window as any).__neural.toggleExplorer())
  await expect(page.locator("[data-view]").first()).toBeVisible()
  expect(await unitAttr(U1_KEY, "data-done"), "unit 1 complete").toBe("1")
  expect(await unitAttr(U2_KEY, "data-locked"), "unit 2 released").toBeNull()
  for (const u of BLUE.units.slice(2)) {
    expect(
      await unitAttr(`${BLUE.id}/${u.id}`, "data-locked"),
      `unit 3+ still locked: ${u.id}`,
    ).toBe("1")
  }
})
