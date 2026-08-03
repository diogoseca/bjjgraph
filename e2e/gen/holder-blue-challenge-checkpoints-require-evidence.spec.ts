/* @hyperspace {"theme":"lifetime-journeys","L":"white-capstone-holder","F":"challenges","B":"cross-feature"} @invariant "A white-capstone holder can open Blue content immediately, but Blue checkpoints require that unit's lesson evidence: finishing unit one enables only its checkpoint, and passing it never gates or unlocks other content tracks." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { whiteBeltHolder, CURRICULUM } from "./personas"

const BLUE = CURRICULUM.belts[1]
const U1 = BLUE.units[0]
const U2 = BLUE.units[1]
const U1_KEY = `${BLUE.id}/${U1.id}`
const U2_KEY = `${BLUE.id}/${U2.id}`

test("white-capstone holder: Blue checkpoint evidence progresses its unit without track locks", async ({ page }) => {
  const j = journey(page)
  await j.boot("/", { initialState: whiteBeltHolder() })
  await j.land("Mount Top")
  await page.evaluate(() => (window as any).__neural.toggleExplorer())

  await expect(page.locator('[data-view="challenges"]')).toBeVisible()
  await page.locator(`.ng-track-card[data-track="${BLUE.id}"]`).click()
  expect(await page.locator(".ng-track-card").count()).toBe(CURRICULUM.belts.length)
  await expect(page.locator(`[data-checkpoint="${U1_KEY}"]`)).toBeVisible()
  await expect(page.locator(`[data-checkpoint="${U2_KEY}"]`)).toHaveCount(1)
  expect(await page.locator(`[data-checkpoint="${U1_KEY}"]`).isDisabled()).toBe(true)
  expect(await page.locator(`[data-checkpoint="${U2_KEY}"]`).isDisabled()).toBe(true)

  for (const lesson of U1.lessons) await j.drill(3, lesson.deckKey)
  await page.evaluate(() => (window as any).__neural.renderExplorer())
  expect(await page.locator(`[data-checkpoint="${U1_KEY}"]`).isDisabled()).toBe(false)
  expect(await page.locator(`[data-checkpoint="${U2_KEY}"]`).isDisabled()).toBe(true)

  await j.rig("checkpoint-pick", [0.1, 0.3, 0.5, 0.7, 0.9, 0.2])
  await page.locator(`[data-checkpoint="${U1_KEY}"]`).click()
  await j.advance(500)
  const cards = U1.checkpoint.cards
  for (let index = 0; index < cards; index++) {
    const correct = await page.evaluate(() => (window as any).__neural._mc.correct)
    await page.locator("[data-mc-opt]").nth(correct).click()
    await j.advance(700)
  }
  await j.expectBeat("checkpoint_passed")

  await page.evaluate(() => (window as any).__neural.toggleExplorer())
  await expect(page.locator('[data-view="challenges"]')).toBeVisible()
  await page.locator(`.ng-track-card[data-track="${BLUE.id}"]`).click()
  expect(await page.locator(`[data-checkpoint="${U1_KEY}"]`).isDisabled()).toBe(false)
  expect(await page.locator(`[data-checkpoint="${U2_KEY}"]`).isDisabled()).toBe(true)
  expect(await page.locator(`[data-capstone="${BLUE.id}"] button`).isDisabled()).toBe(true)
  expect(await page.locator(".ng-track-card").count()).toBe(CURRICULUM.belts.length)
})
