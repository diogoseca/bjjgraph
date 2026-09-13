import { test, expect } from '@playwright/test'
import { journey } from '../dsl'

// Exercise the production group/card renderer with controlled choice labels. These
// assertions cover text geometry and font/viewport refitting, not gameplay outcomes.
for (const width of [390, 1440]) {
  test(`@curated choice titles fit two lines and odds stay at the bottom at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const j = journey(page)
    await j.boot('/')
    await j.advance(4000)
    await page.evaluate(() => {
      const a = (window as any).__neural
      a.currentPos = a.nodes.find((n: any) => n.posId === "mount" && n.role === "top").idx
      a.playerRole = "top"
      const opt = a.optionsFor(a.currentPos)[0]
      a.clearOptions()
      a.renderChoiceGroups(a.optionsRef.current, [
        { ...opt, label: 'Kimura' },
        { ...opt, label: 'Reverse De La Riva to Single Leg X Guard Sweep' },
        { ...opt, label: 'Counterclockwise' },
      ], [{ ...opt, label: 'Arm Triangle Choke', threat: true }], () => {}, 0, true)
    })
    const measure = () => page.locator('.ng-optionrow').evaluate(tray => ({
      height: Math.round(tray.getBoundingClientRect().height * 100) / 100,
      cards: [...tray.querySelectorAll('[data-tech], [data-threat-tech]')].map(card => {
        const slot = card.querySelector('.ngchoice-title')!
        const title = slot.firstElementChild as HTMLElement
        const footer = card.querySelector('.ngbotrow')!
        const odds = card.querySelector('.ngodds')!
        const range = document.createRange()
        range.selectNodeContents(title)
        const lines = [...range.getClientRects()]
        const r = card.getBoundingClientRect(), f = footer.getBoundingClientRect()
        // Entrance transforms can introduce fractional-pixel noise in DOM rects.
        return {
          label: title.textContent,
          height: Math.round(r.height * 100) / 100,
          fontSize: parseFloat(getComputedStyle(title).fontSize),
          lines: new Set(lines.map(line => line.top)).size,
          fitsWidth: lines.every(line => line.left >= slot.getBoundingClientRect().left - 1 && line.right <= slot.getBoundingClientRect().right + 1),
          fitsSlot: title.getBoundingClientRect().bottom <= slot.getBoundingClientRect().bottom + 1,
          footerGap: Math.round((r.bottom - f.bottom) * 100) / 100,
          afterTitle: f.top >= slot.getBoundingClientRect().bottom,
          oddsHeight: Math.round(odds.getBoundingClientRect().height * 100) / 100,
        }
      }),
    }))
    const initial = await measure()
    expect(initial.cards).toHaveLength(4)
    for (const card of initial.cards) {
      expect(card.height, card.label!).toBe(144)
      expect(card.lines, card.label!).toBeLessThanOrEqual(2)
      expect(card.fitsWidth, card.label!).toBe(true)
      expect(card.fitsSlot, card.label!).toBe(true)
      expect(card.footerGap, card.label!).toBeCloseTo(14, 0)
      expect(card.afterTitle, card.label!).toBe(true)
      expect(card.oddsHeight, card.label!).toBeCloseTo(18, 0)
    }
    expect(initial.cards[0].fontSize).toBe(13.5)
    expect(initial.cards[1].fontSize).toBeLessThan(13.5)
    expect(initial.cards[1].lines).toBe(2)

    // A late font event must remeasure from the normal size, allowing text to grow
    // again; resize must do the same for an already mounted hand.
    await page.locator('.ngchoice-title > span').evaluateAll(titles => titles.forEach(title => (title as HTMLElement).style.fontSize = '2px'))
    await page.evaluate(() => document.fonts.dispatchEvent(new Event('loadingdone')))
    expect((await measure()).cards).toEqual(initial.cards)
    await page.locator('.ngchoice-title > span').evaluateAll(titles => titles.forEach(title => (title as HTMLElement).style.fontSize = '2px'))
    await page.setViewportSize({ width: width === 390 ? 1440 : 390, height: 900 })
    await expect.poll(async () => (await measure()).cards[0].fontSize).toBe(13.5)
    expect((await measure()).cards).toEqual(initial.cards)

    const resized = await measure()
    await page.evaluate(() => {
      const a = (window as any).__neural
      const opt = a._optionCards[0].opt
      a.clearOptions()
      a.renderChoiceGroups(a.optionsRef.current, [{ ...opt, label: 'Kimura' }], [], () => {}, 0, false)
    })
    const redealt = await measure()
    expect(redealt.cards[0].height).toBe(initial.cards[0].height)
    expect(redealt.height).toBe(resized.height)
  })
}
