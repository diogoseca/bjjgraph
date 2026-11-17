/* @hyperspace {"theme":"lifetime-journeys","L":"srs-veteran","F":"graph-canvas","B":"cross-feature"} @invariant "Challenge focus dims non-curriculum graph territory without locking content, while switching to Explore clears that focus; returning to Challenges restores the challenge surface and its focused graph state." */
// SIDECX3 / v1.242.0: the drawer opens on its list; select Path explicitly. v1.287.0 (SET1 slice B): the Path row left the
// drawer; its corridor is Master the game's ("corridor" below), opened by its row, and its draw arms the fog as the Path's
// did (P19); the brand ("‹ Master the game") leads back to the list. The claims below are otherwise unchanged.
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { srsVeteran } from "./personas"

const readFocus = () => {
  const app = (window as any).__neural
  const set = app._curriculumIdxSet
  let outside = 0
  if (set) for (const node of app.nodes) if (!set.has(node.idx)) outside++
  return { view: app._practiceInDrawer() ? "corridor" : app._viewMode, focused: !!app._pathDim, setSize: set ? set.size : 0, outside }
}

test("veteran: Challenge graph focus clears in Explore and restores on return", async ({ page }) => {
  const j = journey(page)
  await j.boot("/", { initialState: srsVeteran(25) })
  await j.land("Mount Top")
  await page.evaluate(() => (window as any).__neural.toggleExplorer())
  await j.openCorridor()

  await expect(page.locator(".ng-track-card").first()).toBeVisible()
  const challenges = await page.evaluate(readFocus)
  expect(challenges).toMatchObject({ view: "corridor", focused: true })
  expect(challenges.setSize).toBeGreaterThan(50)
  expect(challenges.outside).toBeGreaterThan(0)
  expect(await page.locator(".ng-belt-section").count()).toBe(5)

  await page.locator('[data-view="explore"]').click()
  const explore = await page.evaluate(readFocus)
  expect(explore).toMatchObject({ view: "explore", focused: false })
  // Master the game's page is hidden, not torn down, when the brand leads home: what is ON SCREEN is the claim
  expect(await page.locator(".ng-track-card:visible").count()).toBe(0)
  expect(await page.locator(".ng-challenge-group:visible").count()).toBe(0)

  await j.openCorridor()
  const back = await page.evaluate(readFocus)
  expect(back).toMatchObject({ view: "corridor", focused: true })
  expect(await page.locator(".ng-belt-section").count()).toBe(5)
  expect(await page.locator(".ng-challenge-group").count()).toBeGreaterThan(0)
})
