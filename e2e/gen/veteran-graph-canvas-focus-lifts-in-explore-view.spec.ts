/* @hyperspace {"theme":"lifetime-journeys","L":"srs-veteran","F":"graph-canvas","B":"cross-feature"} @invariant "Challenge focus dims non-curriculum graph territory without locking content, while switching to Explore clears that focus; returning to Challenges restores the challenge surface and its focused graph state." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { srsVeteran } from "./personas"

const readFocus = () => {
  const app = (window as any).__neural
  const set = app._curriculumIdxSet
  let outside = 0
  if (set) for (const node of app.nodes) if (!set.has(node.idx)) outside++
  return { view: app._viewMode, focused: !!app._pathDim, setSize: set ? set.size : 0, outside }
}

test("veteran: Challenge graph focus clears in Explore and restores on return", async ({ page }) => {
  const j = journey(page)
  await j.boot("/", { initialState: srsVeteran(25) })
  await j.land("Mount Top")
  await page.evaluate(() => (window as any).__neural.toggleExplorer())

  await expect(page.locator('[data-view="challenges"]')).toBeVisible()
  const challenges = await page.evaluate(readFocus)
  expect(challenges).toMatchObject({ view: "challenges", focused: true })
  expect(challenges.setSize).toBeGreaterThan(50)
  expect(challenges.outside).toBeGreaterThan(0)
  expect(await page.locator(".ng-track-card").count()).toBe(5)

  await page.locator('[data-view="explore"]').click()
  const explore = await page.evaluate(readFocus)
  expect(explore).toMatchObject({ view: "explore", focused: false })
  expect(await page.locator(".ng-track-card").count()).toBe(0)
  expect(await page.locator(".ng-challenge-group").count()).toBe(0)

  await page.locator('[data-view="challenges"]').click()
  const back = await page.evaluate(readFocus)
  expect(back).toMatchObject({ view: "challenges", focused: true })
  expect(await page.locator(".ng-track-card").count()).toBe(5)
  expect(await page.locator(".ng-challenge-group").count()).toBeGreaterThan(0)
})
