import { test, expect } from '@playwright/test'
import { journey } from '../dsl'

// #345's review asked whether the held line survives a display scale of 125%, the common Windows setup. It did not, on dev or before it.
// At a fractional scale the browser reads a write back snapped (3122.39990234375 for 3122.4), so `placeTop === heldAt` failed, the hold let
// go, and a line re-picked mid-slide drifted. Per slide, worst of 12 over 3 pages, in px:
//
//   scale   fecd354a3 (the carry)   v1.251.1 (no carry)   v1.251.3 (within a pixel)
//   1       0.97                    0.50                  0.50
//   1.25    54.41                   100.81                0.89
//   1.5     71.88                   21.45                 0.80
//
// WHY THIS FILE, AND WHY THESE ARGS: Playwright's deviceScaleFactor is emulation, and under it scrollTop never reads fractional, 0 of 785
// frames, so a journey there passes on the broken build. Only Chromium's own --force-device-scale-factor reaches the snap. It needs
// `viewport: null`, because any viewport overrides the scale, and it binds a whole worker, so it has this file to itself. The premise below
// fails rather than passes if a browser stops snapping, so this cannot go quiet.
// BLIND SPOT: 1.25 at one size. 1.5 is in the table and has no journey: the failure there was not on every run. Browser zoom is not covered.
// Timed by the clock on purpose: the pane's slide is a real transition, and only its real frames show the drift.
// Control: hold-exact, back to ===. 951 is 864 plus the 87px the probe's windows carried, so this is the size the failure was measured at.
test.use({ viewport: null, launchOptions: { args: ['--force-device-scale-factor=1.25', '--window-size=1152,951'] } })

const READY = '[data-reader][data-reader-ready="true"]'

test('at a real device scale of 1.25 the line under the reader holds through a pane opening and closing', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
  const j = journey(page)
  await j.boot('/Submissions/Armbar/from-Mount/Attacker', { beforeNavigate: async () => { await page.route('**/static/neural/content/*.json', r => r.continue()) } })
  await expect(page.locator(READY)).toBeVisible(); await j.readerLayoutSettled()
  await expect(page.locator('[data-reward-close]')).toBeHidden({ timeout: 15000 })
  expect(await page.evaluate(() => [devicePixelRatio, innerWidth]), 'premise: the real scale, at the size the failure was measured').toEqual([1.25, 1152])
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.locator(READY).evaluate(e => {
    const blocks = ([...e.querySelectorAll('[data-reader-body] p,[data-reader-body] li')] as HTMLElement[]).filter(x => x.getClientRects().length)
    e.scrollTop += blocks[Math.floor(blocks.length * .3)].getBoundingClientRect().top - e.getBoundingClientRect().top - 3
  })
  await j.readerLayoutSettled()
  const y0 = await page.locator(READY).evaluate(e => {
    const top = e.getBoundingClientRect().top, line = ([...e.querySelectorAll('[data-reader-body] p,[data-reader-body] li')] as HTMLElement[]).filter(x => x.getClientRects().length && x.getBoundingClientRect().top >= top).sort((x, y) => x.getBoundingClientRect().top - y.getBoundingClientRect().top)[0]
    line.setAttribute('data-test-place', '')
    return line.getBoundingClientRect().top
  })
  // Every real frame, not the harness's pumped steps: the hold lets go between them, and a pumped slide passes on the broken build.
  await page.locator('[data-test-place]').evaluate((line, y0) => {
    const log = (window as any).__slide = { worst: 0, fractional: false, frames: 0, stop: false }, reader = line.closest('[data-reader]')!
    const tick = () => { if (log.stop) return; log.frames++; log.worst = Math.max(log.worst, Math.abs(line.getBoundingClientRect().top - y0)); log.fractional ||= !Number.isInteger(reader.scrollTop); requestAnimationFrame(tick) }
    requestAnimationFrame(tick)
  }, y0)
  await j.clickByMouse('.ng-logo', 'the logo opens the pane')
  await page.waitForTimeout(1100)
  await j.clickByMouse('.ng-explorer-close', 'the pane\'s close button')
  await page.waitForTimeout(1100)
  const { worst, fractional, frames } = await page.evaluate(() => { const l = (window as any).__slide; l.stop = true; return l })
  expect(frames, 'premise: the slides were sampled').toBeGreaterThan(20)
  expect(fractional, 'premise: this browser reads back a fractional scrollTop, or this journey proves nothing').toBe(true)
  expect(worst, `the line holds through both slides (worst ${worst}px)`).toBeLessThanOrEqual(2)
})
