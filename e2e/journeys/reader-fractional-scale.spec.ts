import { test, expect } from '@playwright/test'

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
// Timed by the clock on purpose: the pane's slide is a real transition, and only its real frames show the drift. And booted as a page,
// not through journey(): the harness's boot leaves the stage in a state this failure does not reach, and the same steps under it
// passed on the broken build (hold-exact survived twice), while this boot fails it 3 of 3 at 100.81 to 126.41px.
// Control: hold-exact, back to ===. 951 is 864 plus the 87px the probe's windows carried, so this is the size the failure was measured at.
test.use({ viewport: null, launchOptions: { args: ['--force-device-scale-factor=1.25', '--window-size=1152,951'] } })

const READY = '[data-reader][data-reader-ready="true"]'

test('at a real device scale of 1.25 the line under the reader holds through a pane opening and closing', async ({ page }) => {
  await page.route(url => !/^(localhost|127\.0\.0\.1)$/.test(url.hostname), r => r.abort())
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/Submissions/Armbar/from-Mount/Attacker', { waitUntil: 'domcontentloaded' })
  await page.locator(READY + ' .ng-section-card').first().waitFor({ state: 'attached', timeout: 60000 })
  await page.waitForTimeout(2600)
  await page.evaluate(() => (document.querySelector('[data-reward-close]') as HTMLElement | null)?.click())
  expect(await page.evaluate(() => [devicePixelRatio, innerWidth]), 'premise: the real scale, at the size the failure was measured').toEqual([1.25, 1152])
  await page.locator(READY).evaluate(e => {
    const blocks = ([...e.querySelectorAll('[data-reader-body] p,[data-reader-body] li')] as HTMLElement[]).filter(x => x.getClientRects().length)
    e.scrollTop += blocks[Math.floor(blocks.length * .3)].getBoundingClientRect().top - e.getBoundingClientRect().top - 3
  })
  await page.waitForTimeout(500)
  // Every real frame, from the line nearest the reader's top.
  await page.locator(READY).evaluate(reader => {
    const top = reader.getBoundingClientRect().top, line = ([...reader.querySelectorAll('[data-reader-body] p,[data-reader-body] li')] as HTMLElement[]).filter(x => x.getClientRects().length && x.getBoundingClientRect().top >= top).sort((x, y) => x.getBoundingClientRect().top - y.getBoundingClientRect().top)[0]
    const y0 = line.getBoundingClientRect().top, log = (window as any).__slide = { worst: 0, fractional: false, frames: 0, stop: false }
    const tick = () => { if (log.stop) return; log.frames++; log.worst = Math.max(log.worst, Math.abs(line.getBoundingClientRect().top - y0)); log.fractional ||= !Number.isInteger(reader.scrollTop); requestAnimationFrame(tick) }
    requestAnimationFrame(tick)
  })
  // Real presses at measured points, each checked to land on its control.
  const press = async (selector: string) => {
    const at = await page.evaluate(sel => { const e = document.querySelector(sel)!, b = e.getBoundingClientRect(), x = b.left + b.width / 2, y = b.top + b.height / 2, hit = document.elementFromPoint(x, y); return { x, y, hit: !!hit && (hit === e || e.contains(hit)) } }, selector)
    expect(at.hit, `premise: ${selector} is reachable by the mouse`).toBe(true)
    await page.mouse.click(at.x, at.y)
  }
  await press('.ng-logo')
  await page.waitForTimeout(1100)
  await press('.ng-explorer-close')
  await page.waitForTimeout(1100)
  const { worst, fractional, frames } = await page.evaluate(() => { const l = (window as any).__slide; l.stop = true; return l })
  expect(frames, 'premise: the slides were sampled').toBeGreaterThan(20)
  expect(fractional, 'premise: this browser reads back a fractional scrollTop, or this journey proves nothing').toBe(true)
  expect(worst, `the line holds through both slides (worst ${worst}px)`).toBeLessThanOrEqual(2)
})
