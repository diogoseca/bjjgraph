/* @hyperspace {"theme":"lifetime-journeys","L":"white-capstone-holder","F":"content-capstone","B":"guard-limit"} @invariant "Clearing White's content capstone does not open or close tracks: Blue is immediately browseable, but its own capstone remains unavailable until every Blue unit checkpoint carries evidence." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { whiteBeltHolder, CURRICULUM } from "./personas"

const [WHITE, BLUE, PURPLE] = CURRICULUM.belts

test("white capstone does not gate Blue content; Blue capstone needs Blue checkpoints", async ({ page }) => {
  const j = journey(page)
  await j.boot("/", { initialState: whiteBeltHolder() })
  await j.land("Mount Top")
  await page.evaluate(() => (window as any).__neural.toggleExplorer())

  await expect(page.locator('[data-view="challenges"]')).toBeVisible()
  expect(await page.locator(".ng-track-card").count()).toBe(CURRICULUM.belts.length)
  for (const track of [WHITE, BLUE, PURPLE]) {
    await expect(page.locator(`.ng-track-card[data-track="${track.id}"]`)).toBeVisible()
  }

  await page.locator(`.ng-track-card[data-track="${WHITE.id}"]`).click()
  expect(await page.locator(`[data-capstone="${WHITE.id}"] button`).isDisabled()).toBe(true)
  await page.locator(`.ng-track-card[data-track="${BLUE.id}"]`).click()
  expect(await page.locator(`[data-capstone="${BLUE.id}"] button`).isDisabled()).toBe(true)
  expect(await page.locator(".ng-challenge-checkpoint").count()).toBe(BLUE.units.length)

  const state = await page.evaluate((blueId) => {
    const app = (window as any).__neural
    const track = app.curriculum.belts.find((item: any) => item.id === blueId)
    return track.units.map((unit: any) => app.unitComplete(blueId, unit))
  }, BLUE.id)
  expect(state).toEqual(BLUE.units.map(() => false))
})
