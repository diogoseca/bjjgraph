/* @hyperspace {"theme":"lifetime-journeys","L":"srs-veteran","F":"settings","B":"cross-feature"} @invariant "Changing giMode to nogi re-renders the open Challenge curriculum live: a gi-only lesson disappears from the selectable lesson surface, a nogi-viable sibling remains, and retained lesson evidence is never erased." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { srsVeteran, CURRICULUM } from "./personas"

function firstGiOnly() {
  let index = 0
  for (const track of CURRICULUM.belts)
    for (const unit of track.units)
      for (const lesson of unit.lessons) {
        const frames: string[] = lesson.frames || ["gi", "nogi"]
        if (frames.length === 1 && frames[0] === "gi") {
          const sibling = unit.lessons.find(
            (candidate: any) =>
              candidate.deckKey !== lesson.deckKey &&
              (candidate.frames || ["gi", "nogi"]).includes("nogi"),
          )
          return sibling ? { index, track, unit, lesson, sibling } : null
        }
        index++
      }
  return null
}

const GI = firstGiOnly()

test("giMode flip removes gi-only Challenge lessons without deleting evidence", async ({ page }) => {
  test.skip(!GI, "curriculum has no gi-only lesson with a nogi sibling")
  const gi = GI!
  const j = journey(page)
  await j.boot("/", { initialState: srsVeteran(gi.index + 1) })
  await j.land("Mount Top")
  await page.evaluate(() => (window as any).__neural.toggleExplorer())
  await expect(page.locator('[data-view="challenges"]')).toBeVisible()
  await page.locator(`.ng-track-card[data-track="${gi.track.id}"]`).click()

  const giLesson = page.locator(`.ng-challenge-lesson[data-lesson="${gi.lesson.deckKey}"]`)
  const sibling = page.locator(`.ng-challenge-lesson[data-lesson="${gi.sibling.deckKey}"]`)
  await expect(giLesson).toHaveCount(1)
  await expect(sibling).toHaveCount(1)
  expect(await page.evaluate((key) => (window as any).__neural.lessonDone(key), gi.lesson.deckKey)).toBe(true)

  await page.evaluate(() => (window as any).__neural.setGiMode("nogi"))
  expect(await page.evaluate(() => (window as any).__neural._giMode)).toBe("nogi")
  await expect(giLesson).toHaveCount(0)
  await expect(sibling).toHaveCount(1)
  expect(
    await page.evaluate((key) => (window as any).__neural.lessonDone(key), gi.lesson.deckKey),
    "changing the frame only changes availability; evidence remains durable",
  ).toBe(true)
})
