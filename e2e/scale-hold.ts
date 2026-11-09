import { expect, type Page } from '@playwright/test'

// The held line through a pane opening and closing, at a REAL device scale. Shared by the reader-scale-*.spec.ts files, each of which
// binds its own --force-device-scale-factor, because Playwright's deviceScaleFactor is emulation and never snaps a scroll (0 of 785
// frames read fractional under it), and launch args bind a whole worker. Not under journeys/, so no config collects it as a spec.
//
// Booted as a page, not through journey(): the harness's boot leaves the stage in a state the failure does not reach, and the same steps
// under it passed on the broken build (hold-exact survived twice). Timed by the clock: the pane's slide is a real transition.
const READY = '[data-reader][data-reader-ready="true"]'

export async function holdThroughSlide(page: Page, scale: number, width: number, offGrid: number) {
  await page.route(url => !/^(localhost|127\.0\.0\.1)$/.test(url.hostname), r => r.abort())
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/Submissions/Armbar/from-Mount/Attacker', { waitUntil: 'domcontentloaded' })
  await page.locator(READY + ' .ng-section-card').first().waitFor({ state: 'attached', timeout: 60000 })
  await page.waitForTimeout(2600)
  await page.evaluate(() => (document.querySelector('[data-reward-close]') as HTMLElement | null)?.click())
  expect(await page.evaluate(() => [devicePixelRatio, innerWidth]), 'premise: the real scale, at the size the failure was measured').toEqual([scale, width])
  // The premise that keeps this from going quiet: a write off the device grid must read back different. A browser that kept the written
  // value would let the old === hold, and the slide below would pass on the broken build.
  const snapped = await page.locator(READY).evaluate((e, off) => { const want = Math.floor(e.scrollTop) + 200 + off; e.scrollTop = want; return e.scrollTop !== want }, offGrid)
  expect(snapped, 'premise: this browser snaps a scroll write, or this journey proves nothing').toBe(true)
  await page.locator(READY).evaluate(e => {
    const blocks = ([...e.querySelectorAll('[data-reader-body] p,[data-reader-body] li')] as HTMLElement[]).filter(x => x.getClientRects().length)
    e.scrollTop += blocks[Math.floor(blocks.length * .3)].getBoundingClientRect().top - e.getBoundingClientRect().top - 3
  })
  await page.waitForTimeout(500)
  await page.locator(READY).evaluate(reader => {
    const top = reader.getBoundingClientRect().top, line = ([...reader.querySelectorAll('[data-reader-body] p,[data-reader-body] li')] as HTMLElement[]).filter(x => x.getClientRects().length && x.getBoundingClientRect().top >= top).sort((x, y) => x.getBoundingClientRect().top - y.getBoundingClientRect().top)[0]
    const y0 = line.getBoundingClientRect().top, log = (window as any).__slide = { worst: 0, frames: 0, stop: false }
    const tick = () => { if (log.stop) return; log.frames++; log.worst = Math.max(log.worst, Math.abs(line.getBoundingClientRect().top - y0)); requestAnimationFrame(tick) }
    requestAnimationFrame(tick)
  })
  const press = async (selector: string) => {
    const at = await page.evaluate(sel => { const e = document.querySelector(sel)!, b = e.getBoundingClientRect(), x = b.left + b.width / 2, y = b.top + b.height / 2, hit = document.elementFromPoint(x, y); return { x, y, hit: !!hit && (hit === e || e.contains(hit)) } }, selector)
    expect(at.hit, `premise: ${selector} is reachable by the mouse`).toBe(true)
    await page.mouse.click(at.x, at.y)
  }
  await press('.ng-logo')
  await page.waitForTimeout(1100)
  await press('.ng-explorer-close')
  await page.waitForTimeout(1100)
  const { worst, frames } = await page.evaluate(() => { const l = (window as any).__slide; l.stop = true; return l })
  expect(frames, 'premise: the slides were sampled').toBeGreaterThan(20)
  expect(worst, `the line holds through both slides (worst ${worst}px)`).toBeLessThanOrEqual(2)
}
