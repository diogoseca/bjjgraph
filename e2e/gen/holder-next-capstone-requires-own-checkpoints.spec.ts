/* @hyperspace {"theme":"lifetime-journeys","L":"white-capstone-holder","F":"content-capstone","B":"guard-limit"} @invariant "A White-capstone holder opens White, Blue and (since U163 c, v1.270.0) every later section too; Blue's own capstone remains unavailable until every Blue unit checkpoint carries evidence." */
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
  await page.locator('[data-view="challenges"]').click() // v1.242.0: the drawer opens on its list; Path (the old Challenges tab) is one row away
  expect(await page.locator(".ng-belt-section").count()).toBe(CURRICULUM.belts.length)
  for (const track of [WHITE, BLUE]) {
    await expect(page.locator(`.ng-track-card[data-track="${track.id}"]`)).toBeVisible()
  }

  // Until v1.270.0 Purple stayed an inert section (U87): `[data-belt-locked]`, no `[data-track]`. U163 c (owner, 13 Nov,
  // "everything opens"): Purple is an ordinary section with its own header
  await expect(page.locator(`[data-belt="${PURPLE.id}"] .ng-track-card[data-track="${PURPLE.id}"]`)).toBeVisible()

  await page.locator(`.ng-track-card[data-track="${WHITE.id}"]`).click()
  expect(await page.locator(`[data-capstone="${WHITE.id}"] button`).isDisabled()).toBe(true)
  await page.locator(`.ng-track-card[data-track="${BLUE.id}"]`).click()
  expect(await page.locator(`[data-capstone="${BLUE.id}"] button`).isDisabled()).toBe(true)
  // v1.76.0 ladder renders every track's curriculum — scope the count to Blue's section
  expect(await page.locator(`[data-track-curriculum="${BLUE.id}"] .ng-challenge-checkpoint`).count()).toBe(BLUE.units.length)

  const state = await page.evaluate((blueId) => {
    const app = (window as any).__neural
    const track = app.curriculum.belts.find((item: any) => item.id === blueId)
    return track.units.map((unit: any) => app.unitComplete(blueId, unit))
  }, BLUE.id)
  expect(state).toEqual(BLUE.units.map(() => false))
})
