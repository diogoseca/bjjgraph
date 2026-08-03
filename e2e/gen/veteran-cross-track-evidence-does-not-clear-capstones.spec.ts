/* @hyperspace {"theme":"lifetime-journeys","L":"srs-veteran","F":"challenges","B":"cross-feature"} @invariant "Cross-track lesson evidence is visible in open Challenges but never substitutes for checkpoints: a veteran can browse White and Blue from day one, while each selected track's capstone stays unavailable until every unit checkpoint is earned." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { srsVeteran, CURRICULUM } from "./personas"

const [WHITE, BLUE] = CURRICULUM.belts
const WHITE_LESSONS = WHITE.units.flatMap((unit: any) => unit.lessons)
const N_DECKS = WHITE_LESSONS.length + 3
const SEEDED = CURRICULUM.belts
  .flatMap((track: any) => track.units.flatMap((unit: any) => unit.lessons.map((lesson: any) => ({ track, lesson }))))
  .slice(0, N_DECKS)

test("veteran: open cross-track Challenges retain checkpoint-only capstone gates", async ({ page }) => {
  expect(SEEDED.some(({ track }: any) => track.id === BLUE.id)).toBe(true)
  const j = journey(page)
  await j.boot("/", { initialState: srsVeteran(N_DECKS) })
  await j.land("Mount Top")
  await page.evaluate(() => (window as any).__neural.toggleExplorer())

  await expect(page.locator('[data-view="challenges"]')).toBeVisible()
  expect(await page.locator(".ng-track-card").count()).toBe(CURRICULUM.belts.length)

  for (const track of [WHITE, BLUE]) {
    await page.locator(`.ng-track-card[data-track="${track.id}"]`).click()
    const seededHere = SEEDED.filter(({ track: owner }: any) => owner.id === track.id)
    for (const { lesson } of seededHere) {
      await expect(page.locator(`.ng-challenge-lesson[data-lesson="${lesson.deckKey}"]`)).toHaveCount(1)
    }
    expect(await page.locator(".ng-challenge-checkpoint").count()).toBe(track.units.length)
    expect(await page.locator(`[data-capstone="${track.id}"] button`).isDisabled()).toBe(true)
  }

  const evidence = await page.evaluate((seeds) => {
    const app = (window as any).__neural
    return seeds.map((item: any) => ({
      done: app.lessonDone(item.key),
      checkpoint: app.unitComplete(item.trackId, item.unit),
    }))
  }, SEEDED.map(({ track, lesson }: any) => {
    const unit = track.units.find((candidate: any) => candidate.lessons.includes(lesson))
    return { trackId: track.id, unit, key: lesson.deckKey }
  }))
  expect(evidence.every((item: any) => item.done)).toBe(true)
  expect(evidence.every((item: any) => !item.checkpoint)).toBe(true)
})
