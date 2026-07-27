/* @hyperspace {"theme":"lifetime-journeys","L":"srs-veteran","F":"belt-path","B":"guard-limit"} @invariant "A veteran with 25 decks rec-proven but zero checkpoints passed sees those lesson rows marked data-done='1' while every unit row lacks data-done and every checkpoint row remains unpassed — drilled mastery alone never marks a unit complete." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { srsVeteran, CURRICULUM } from "./personas"

/**
 * Mechanism under test (neural/src/app.src.jsx): lessonDone(key) keys on
 * prep[key] >= _deckGoal(key) (min(3, deckSize)) — NOT on rec — so the veteran's
 * prep=5 marks every seeded lesson row done regardless of recall counts. unitComplete
 * additionally requires units[uk].checkpoint, which only completeCheckpoint / an MC
 * quiz pass can set — so seeded mastery alone must never mark a unit or checkpoint
 * done, and neither unit_done nor checkpoint_passed can have fired this life.
 */

const N_DECKS = 25

// Mirror personas.ts srsVeteran iteration order EXACTLY: belts → units → lessons, break at N.
const SEEDED: string[] = []
outer: for (const belt of CURRICULUM.belts)
  for (const u of belt.units)
    for (const l of u.lessons) {
      SEEDED.push(l.deckKey)
      if (SEEDED.length >= N_DECKS) break outer
    }

const TOTAL_UNITS = CURRICULUM.belts.reduce((s: number, b: any) => s + b.units.length, 0)

test("veteran mastery marks lesson rows done; units and checkpoints stay incomplete", async ({ page }) => {
  // curriculum facts the exact-count asserts lean on — fail loudly here if the corpus shifts
  expect(SEEDED).toHaveLength(N_DECKS)
  expect(new Set(SEEDED).size).toBe(N_DECKS) // deckKeys distinct → done-rows map 1:1 to seeds

  const j = journey(page)
  await j.boot("/", { initialState: srsVeteran(N_DECKS) })
  await j.land("Mount Top")

  // open the explorer's PATH view (curriculum loaded → path is the default mode); no extra
  // rigs needed — land()'s ai-skill/role/max-moves cover it and the path render draws no RNG
  await page.evaluate(() => (window as any).__neural.toggleExplorer())
  await expect(page.locator("[data-view]").first()).toBeVisible()
  await j.expectBeat("path_opened")

  // every seeded lesson row is marked done — prep >= goal alone drives data-done
  for (const key of SEEDED) {
    expect(
      await page.locator(`[data-lesson="${key}"]`).first().getAttribute("data-done"),
      `lesson row marked done: ${key}`,
    ).toBe("1")
  }
  // ...and ONLY those rows: the done-row census is exactly the seeded set
  expect(await page.locator('[data-lesson][data-done="1"]').count()).toBe(N_DECKS)

  // structural sanity: every unit renders one unit row + one checkpoint row, even when
  // the belt/unit is locked — the census below counts the WHOLE curriculum, not a subset
  expect(await page.locator("[data-unit]").count()).toBe(TOTAL_UNITS)
  expect(await page.locator("[data-checkpoint]").count()).toBe(TOTAL_UNITS)

  // drilled mastery alone NEVER completes a unit or passes a checkpoint
  expect(await page.locator('[data-unit][data-done="1"]').count()).toBe(0)
  expect(await page.locator('[data-checkpoint][data-done="1"]').count()).toBe(0)

  // and no completion beat ever fired since boot
  const beats = await j.beats()
  expect(beats.filter((b) => b.beat === "unit_done")).toHaveLength(0)
  expect(beats.filter((b) => b.beat === "checkpoint_passed")).toHaveLength(0)
})
