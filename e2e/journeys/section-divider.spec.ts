import { test, expect } from '@playwright/test'
import { journey } from '../dsl'

// U31 a extends the LEFT divider to the prose inset; words and right edge keep their positions.
// U25 a carries the closed phone labels in one disclosure; the desktop index still reopens them.
// Controls: u14-divider-off-centre and u14-divider-rules-lost target the owned geometry claims.
const READY = '[data-reader][data-reader-ready="true"]'
const QUIET = { v: 2, settings: { landCard: false, landHand: false, landFeedback: false }, settingsAt: {} }

for (const width of [1440, 390]) {
  test(`@curated U31 a: ${width}px divider titles are centred, legible and retain closing`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
    const j = journey(page)
    await j.boot('/Transitions/Knee-Slice-Pass/Attacker', { initialState: QUIET })
    await expect(page.locator(READY)).toBeVisible()
    const selector = '[data-section-type=principles]'
    const section = page.locator(selector), button = section.locator('[data-section-toggle]')
    const body = section.locator('.ng-section-body')
    await button.scrollIntoViewIfNeeded(); await j.readerLayoutSettled()
    const geometry = await section.evaluate(card => {
      const title = card.querySelector('.ng-section-title')!, head = card.querySelector('h2')!
      const text = document.createRange(); text.selectNodeContents(title)
      const words = text.getBoundingClientRect(), box = card.getBoundingClientRect(), h = head.getBoundingClientRect()
      const cs = getComputedStyle(title), before = getComputedStyle(title, '::before'), after = getComputedStyle(title, '::after')
      const lum = (color: string) => {
        const c = color.match(/\d+/g)!.slice(0, 3).map(x => { const n = +x / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4 })
        return c[0] * .2126 + c[1] * .7152 + c[2] * .0722
      }
      const fg = lum(cs.color), bg = lum(getComputedStyle(card).backgroundColor)
      const rule = (s: CSSStyleDeclaration) => ({ width: parseFloat(s.width), height: parseFloat(s.height), shown: s.display !== 'none' && s.content !== 'none' && s.backgroundColor !== 'rgba(0, 0, 0, 0)' })
      const b = card.querySelector('[data-section-toggle]')!.getBoundingClientRect()
      const content = card.querySelector('.ng-section-body')!, c = content.getBoundingClientRect()
      return { title: title.textContent, offset: (words.left + words.right - box.left - box.right) / 2,
        leftInset: title.getBoundingClientRect().left - c.left - parseFloat(getComputedStyle(content).paddingLeft),
        rightReserve: box.right - title.getBoundingClientRect().right,
        vertical: (words.top + words.bottom - h.top - h.bottom) / 2, uppercase: cs.textTransform,
        contrast: (Math.max(fg, bg) + .05) / (Math.min(fg, bg) + .05), before: rule(before), after: rule(after),
        target: { width: b.width, height: b.height }, textClear: words.right < b.left }
    })
    expect(geometry.title!.trim().length, 'premise: a real section title').toBeGreaterThan(0)
    expect(Math.abs(geometry.offset), 'the divider words are centred on the section card').toBeLessThanOrEqual(1)
    expect(Math.abs(geometry.vertical), 'the divider words are vertically centred').toBeLessThanOrEqual(1)
    expect(geometry.uppercase).toBe('uppercase')
    expect(geometry.contrast, 'the divider title retains AA text contrast').toBeGreaterThanOrEqual(4.5)
    expect(geometry.before.shown && geometry.after.shown, 'both divider rules are painted').toBe(true)
    expect(Math.min(geometry.before.width, geometry.after.width), 'both divider rules have positive width').toBeGreaterThan(1)
    expect(Math.abs(geometry.leftInset), 'the left rule starts at the prose inset').toBeLessThanOrEqual(1)
    expect(geometry.rightReserve, 'the right end keeps the close target reserve').toBeCloseTo(52, 0)
    expect(geometry.before.width, 'only the left rule extends').toBeGreaterThan(geometry.after.width)
    expect([geometry.before.height, geometry.after.height]).toEqual([1, 1])
    expect(geometry.target).toEqual({ width: 44, height: 44 })
    expect(geometry.textClear, 'the title never overlaps its close target').toBe(true)
    await j.clickByMouse(`${selector} [data-section-toggle]`, 'close the divider section')
    await expect(body).toBeHidden(); await expect(button).toHaveAttribute('aria-expanded', 'false')
    await j.readerLayoutSettled()
    if (width === 390) {
      await expect(section).toBeHidden()
      await page.locator('.ng-reader-hidden>summary').scrollIntoViewIfNeeded(); await j.readerLayoutSettled()
      await j.clickByMouse('.ng-reader-hidden>summary', 'reveal closed sections')
      await expect(section).toBeVisible()
      expect(await button.evaluate(e => ({ height: e.getBoundingClientRect().height,
        action: getComputedStyle(e.querySelector('.ng-section-closed')!, '::after').content })),
      'U25 keeps the original closed control with a Show action').toEqual({ height: 44, action: '"Show"' })
      await button.scrollIntoViewIfNeeded(); await j.readerLayoutSettled()
      await j.clickByMouse(`${selector} [data-section-toggle]`, 'reopen the compact phone line')
    } else {
      await expect(section, 'U11 leaves no desktop placeholder').toBeHidden()
      await expect(page.locator('[data-toc-type=principles]')).toHaveAttribute('data-collapsed', 'true')
      await expect(page.locator('[data-toc-type=principles] .ng-section-eye')).toBeVisible()
      await j.clickByMouse('[data-toc-type=principles] a', 'reopen from the index')
    }
    await expect(body).toBeVisible(); await expect(button).toHaveAttribute('aria-expanded', 'true')
  })
}
