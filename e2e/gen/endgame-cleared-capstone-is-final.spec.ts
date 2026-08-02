/* @hyperspace {"theme":"lifetime-journeys","L":"multi-belt-endgame","F":"content-capstone","B":"idempotence"} @invariant "A cleared content capstone is final: its disabled Challenge control cannot stage the internal _beltTest or mutate its compatibility win record, while every track remains available to browse." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { multiBeltEndgame, CURRICULUM } from "./personas"

const TRACKS: any[] = CURRICULUM.belts

test("cleared capstones are inert while all content tracks remain browseable", async ({ page }) => {
  const j = journey(page)
  await j.boot("/", { initialState: multiBeltEndgame() })
  await j.land("Mount Top")
  const before = await page.evaluate(() => JSON.parse(JSON.stringify((window as any).__neural.belts.won)))

  await page.evaluate(() => (window as any).__neural.toggleExplorer())
  await expect(page.locator('[data-view="challenges"]')).toBeVisible()
  for (const track of TRACKS) {
    await page.locator(`.ng-track-card[data-track="${track.id}"]`).click()
    const button = page.locator(`[data-capstone="${track.id}"] button`)
    await expect(button).toBeVisible()
    expect(await button.isDisabled(), `${track.id} cleared capstone is not retakeable`).toBe(true)
  }

  const after = await page.evaluate(() => {
    const app = (window as any).__neural
    return {
      won: JSON.parse(JSON.stringify(app.belts.won)),
      staged: !!app._beltTest,
      starts: (app.beats || []).filter((beat: any) => beat.beat === "belt_test_start").length,
    }
  })
  expect(after.won).toEqual(before)
  expect(after.staged).toBe(false)
  expect(after.starts).toBe(0)
})
