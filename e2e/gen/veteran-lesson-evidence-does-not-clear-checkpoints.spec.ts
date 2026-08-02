/* @hyperspace {"theme":"lifetime-journeys","L":"srs-veteran","F":"challenges","B":"guard-limit"} @invariant "Lesson evidence does not silently clear checkpoints: a veteran's studied lessons remain available in Challenges, while every unearned checkpoint and the selected track's content capstone remain unavailable." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { srsVeteran, CURRICULUM } from "./personas"

const N_DECKS = 25
const WHITE = CURRICULUM.belts[0]
const SEEDED = WHITE.units.flatMap((unit: any) => unit.lessons).slice(0, N_DECKS)

test("veteran lesson evidence leaves checkpoints and content capstones unearned", async ({ page }) => {
  const j = journey(page)
  await j.boot("/", { initialState: srsVeteran(N_DECKS) })
  await j.land("Mount Top")
  await page.evaluate(() => (window as any).__neural.toggleExplorer())

  await expect(page.locator('[data-view="challenges"]')).toBeVisible()
  await page.locator(`.ng-track-card[data-track="${WHITE.id}"]`).click()
  for (const lesson of SEEDED) {
    await expect(page.locator(`.ng-challenge-lesson[data-lesson="${lesson.deckKey}"]`)).toHaveCount(1)
  }
  expect(await page.locator(".ng-challenge-checkpoint").count()).toBe(WHITE.units.length)
  expect(await page.locator(`[data-capstone="${WHITE.id}"] button`).isDisabled()).toBe(true)

  const state = await page.evaluate((trackId) => {
    const app = (window as any).__neural
    const track = app.curriculum.belts.find((item: any) => item.id === trackId)
    return {
      studied: track.units.flatMap((unit: any) => unit.lessons).filter((lesson: any) => app.lessonDone(lesson.deckKey)).length,
      checkpoints: track.units.filter((unit: any) => app.unitComplete(trackId, unit)).length,
    }
  }, WHITE.id)
  expect(state.studied).toBe(N_DECKS)
  expect(state.checkpoints).toBe(0)
})
