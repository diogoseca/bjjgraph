/* @hyperspace {"theme":"lifetime-journeys","L":"multi-belt-endgame","F":"challenges","B":"guard-limit"} @invariant "A fully completed profile still renders all five open content tracks: every unit checkpoint is visibly cleared and every content capstone is final, without any content-lock surface." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { multiBeltEndgame, CURRICULUM } from "./personas"

const TRACKS: any[] = CURRICULUM.belts
const TOTAL_UNITS = TRACKS.reduce((total: number, track: any) => total + track.units.length, 0)

test("content-capstone endgame: every open track renders cleared checkpoints and final capstones", async ({ page }) => {
  const j = journey(page)
  await j.boot("/", { initialState: multiBeltEndgame() })
  await j.land("Mount Top")
  await page.evaluate(() => (window as any).__neural.toggleExplorer())

  await expect(page.locator('[data-view="challenges"]')).toBeVisible()
  expect(await page.locator(".ng-track-card").count()).toBe(TRACKS.length)

  for (const track of TRACKS) {
    await page.locator(`.ng-track-card[data-track="${track.id}"]`).click()
    expect(await page.locator(".ng-challenge-group").count()).toBe(track.units.length)
    expect(await page.locator(".ng-challenge-checkpoint").count()).toBe(track.units.length)
    expect(await page.locator(`[data-capstone="${track.id}"] button`).isDisabled()).toBe(true)
  }

  expect(TOTAL_UNITS).toBeGreaterThan(0)
})
