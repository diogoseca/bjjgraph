import { expect, type Page } from '@playwright/test'
import { journey } from '../dsl'

export const coveredRolls = Object.fromEntries([
  'land-mc-pick', 'land-mc-shuffle', 'panic-mc-pick', 'panic-mc-shuffle',
].map(tag => [tag, Array(160).fill(.5)]))

// The default DSL omits dossiers. U35 needs real authored media present outside
// the question, so an empty harness cannot satisfy the segregation assertion.
export async function coveredCatch(page: Page, pauseHeartbeat = false) {
  const j = journey(page)
  await j.boot('/Positions/Half-Guard/Bottom', {
    beforeNavigate: async page => {
      await page.route('**/static/neural/content/*.json', route => route.continue())
      if (pauseHeartbeat) await page.addInitScript(() => {
        const style = document.createElement('style')
        style.textContent = '.ng-vignette{animation-play-state:paused!important}'
        document.addEventListener('DOMContentLoaded', () => document.head.append(style), { once: true })
      })
    }, seedRolls: coveredRolls,
  })
  await j.hydrateAll()
  await page.evaluate(() => {
    const a = (window as any).__neural
    a.aiSkill = .13; a.maxMoves = 11
    for (const [tag, values] of Object.entries({ resolve: [.999], outcome: [0], 'opp-finish': [0], 'opp-sub-pick': [.75], 'opp-pick': [0], escape: [0] })) a.rig(tag, values)
  })
  const move = '[data-tech="Half Guard to Back Take"] .ng-choice-title-button'
  await page.locator(move).scrollIntoViewIfNeeded()
  await j.readerLayoutSettled()
  await j.clickByMouse(move, 'take the authored move into the opponent catch')
  await j.advanceUntil('caught', 20000, 100)
  await j.landSettled()
  await expect(page.locator('[data-landcard=defense][data-land-ask] [data-land-ask-go]')).toBeVisible()
  await j.readerLayoutSettled()
  expect(await page.evaluate(() => (window as any).__neural._landQ.key)).toBe('Loop Choke from Half Guard|Defender')
  return j
}
