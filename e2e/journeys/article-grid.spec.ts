import { test, expect, type Page } from '@playwright/test'
import { journey } from '../dsl'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const READY = '[data-reader][data-reader-ready="true"]'

// Owner frames use the production CSS and layout. Never inject preview styles or camera poses.
async function settledText(page: Page) {
  const j = journey(page)
  await j.hydrateAll()
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all([...document.querySelectorAll<HTMLImageElement>('[data-reader] img')]
      .filter(i => i.getClientRects().length).map(i => i.decode().catch(() => null)))
  })
  await expect.poll(async () => {
    await j.advance(100)
    return page.locator('[data-legend-win]').getAttribute('data-win-chance')
  }, { message: 'the legend percentage must be painted before every owner frame', timeout: 45000 }).toMatch(/\d.*%/)
  let previous = '', stable = 0
  await expect.poll(async () => {
    await j.advance(80); await j.readerLayoutSettled()
    const value = await page.evaluate(() => document.body.innerText)
    stable = value === previous ? stable + 1 : 0; previous = value
    return stable
  }, { message: 'visible text must settle over three consecutive samples', intervals: [200], timeout: 15000 }).toBeGreaterThanOrEqual(3)
}

async function ownerFrame(page: Page, name: string) {
  const out = process.env.LAYOUT3_OWNER_OUT
  if (!out) return
  await settledText(page)
  const styles = await page.locator('[data-reader-body]>.ng-section-card').evaluateAll(cards => cards.map(card => {
    const s = getComputedStyle(card)
    const texts: { text: string, color: string, opacity: number, backgrounds: string[], backgroundImages: string[] }[] = []
    const walk = document.createTreeWalker(card, NodeFilter.SHOW_TEXT)
    while (walk.nextNode()) {
      const node = walk.currentNode, parent = node.parentElement!
      if (!node.textContent?.trim() || !parent.getClientRects().length) continue
      const cs = getComputedStyle(parent)
      if (cs.visibility !== 'visible' || cs.display === 'none') continue
      let opacity = 1
      const backgrounds: string[] = [], backgroundImages: string[] = []
      for (let el: Element | null = parent; el; el = el.parentElement) {
        const style = getComputedStyle(el); opacity *= Number(style.opacity)
        if (el !== card && card.contains(el)) { backgrounds.unshift(style.backgroundColor); backgroundImages.push(style.backgroundImage) }
        if (el.matches('[data-reader]')) break
      }
      texts.push({ text: node.textContent.trim(), color: cs.color, opacity, backgrounds, backgroundImages })
    }
    return { type: (card as HTMLElement).dataset.sectionType, background: s.backgroundColor, shadow: s.boxShadow,
      border: s.borderWidth, outline: s.outlineStyle, filter: s.filter, backdrop: s.backdropFilter,
      webkit: s.getPropertyValue('-webkit-backdrop-filter'), webkitSupported: CSS.supports('-webkit-backdrop-filter', 'none'), texts }
  }))
  mkdirSync(out, { recursive: true })
  await page.screenshot({ path: join(out, name + '.png'), animations: 'disabled' })
  writeFileSync(join(out, name + '.json'), JSON.stringify({ name, legend: await page.locator('[data-legend-win]').textContent(), styles }, null, 2) + '\n')
}

for (const width of [1440, 390]) test(`@curated article grid ${width}px preserves content, packing and hidden-section controls`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
  const j = journey(page)
  await j.boot('/Positions/Mount/Top', { beforeNavigate: async () => {
    await page.route('**/static/neural/content/*.json', r => r.continue())
    if (process.env.LAYOUT3_OWNER_OUT) {
      for (const host of ['fonts.googleapis.com', 'fonts.gstatic.com', 'i.ytimg.com']) await page.route(`**/${host}/**`, r => r.continue())
    }
  } })
  await expect(page.locator(READY)).toBeVisible(); await j.readerLayoutSettled()
  const original = await page.locator('[data-reader-body]').textContent()
  // U65 note (owner, 2026-10-29): Videos keeps only its closed control; no open credits tile on game pages.
  const geometry = await page.locator('[data-reader-body]').evaluate(body => [...body.children]
    .filter(card => !card.hasAttribute('data-media-control') && card.getAttribute('data-collapsed') !== 'true').map(card => {
    const b = card.getBoundingClientRect(), s = getComputedStyle(card)
    return { type: (card as HTMLElement).dataset.sectionType, rendered: card.getClientRects().length > 0,
      left: b.left, top: b.top, right: b.right, bottom: b.bottom,
      fill: s.backgroundColor, border: s.borderWidth, shadow: s.boxShadow, filter: s.filter, backdrop: s.backdropFilter,
      webkit: s.getPropertyValue('-webkit-backdrop-filter'), webkitSupported: CSS.supports('-webkit-backdrop-filter', 'none'),
      overflow: card.scrollWidth - card.clientWidth }
  }))
  expect(geometry.length).toBeGreaterThan(4)
  for (const [i, card] of geometry.entries()) {
    expect(card.rendered, card.type + ': every open content section is rendered').toBe(true)
    expect(card.fill).toBe('rgb(20, 27, 43)'); expect(card.border).toBe('0px')
    // The owner's A/B/C choice changes ONE CSS line, never the regression expectation.
    expect(card.shadow).toMatch(/^rgba\(155, 174, 255, 0\.(2|12|06)\) 0px 0px 16px 2px$/)
    expect(card.shadow).toBe(geometry[0].shadow)
    expect(card.filter).toBe('none'); expect(card.backdrop).toBe('none')
    expect(card.webkit, 'missing WebKit support is explicit, never an ignored field').toBe(card.webkitSupported ? 'none' : '')
    expect(card.overflow, card.type + ' has no horizontal overflow').toBeLessThanOrEqual(1)
    expect(card.left).toBeGreaterThanOrEqual(24); expect(card.right).toBeLessThanOrEqual(width - 24)
    if (i) expect(card.top).toBeGreaterThanOrEqual(geometry[i - 1].top - 1)
    for (const other of geometry.slice(0, i)) expect(card.left >= other.right - 1 || card.right <= other.left + 1 || card.top >= other.bottom - 1, 'cards never overlap').toBe(true)
  }
  if (width === 390) expect(new Set(geometry.map(c => c.left)).size).toBe(1)
  else expect(geometry.some((c, i) => i && Math.abs(c.top - geometry[i - 1].top) < 1), 'desktop really pairs cards').toBe(true)
  // A stable real section identity, not a first/nth fixture that changes when the corpus grows.
  const prerequisites = page.locator('[data-section-type=prerequisites]')
  await prerequisites.evaluate(el => { const root = el.closest('[data-reader]')!; root.scrollTop += el.getBoundingClientRect().top - root.getBoundingClientRect().top - 24 })
  await j.readerLayoutSettled()
  await ownerFrame(page, `grid-stack-${width}`)
  for (const type of ['principles', 'prerequisites', 'mistakes']) {
    const selector = `[data-section-toggle=${type}]`
    await page.locator(selector).scrollIntoViewIfNeeded(); await j.readerLayoutSettled()
    // CLAIM UNCHANGED (U59 c, DASH-R4): the DSL boot pre-completes the White track, so reading mints a patch whose
    // toast sits in the top-right corner over the right lane's top tile, where Mistakes' ✕ now lands at 1440.
    // Let its ordinary 4.8s lifetime end; a separate mouse click can race that expiry.
    await expect(page.locator('[data-reward-close]')).toBeHidden({ timeout: 15000 })
    await j.clickByMouse(selector)
    await expect(page.locator(selector)).toHaveAttribute('aria-expanded', 'false')
  }
  const summary = page.locator('.ng-reader-hidden>summary')
  if (width === 390) {
    await summary.scrollIntoViewIfNeeded(); await j.readerLayoutSettled()
    await expect(summary).toHaveText('Hidden sections (3)›')
    const style = await summary.evaluate(el => { const s = getComputedStyle(el), [text, arrow] = [...el.children].map(e => e.getBoundingClientRect()); return { border: s.borderWidth, shadow: s.boxShadow, gap: arrow.left - text.right, height: el.getBoundingClientRect().height } })
    expect(style.border).toBe('0px'); expect(style.shadow).toBe('none'); expect(style.gap).toBe(6); expect(style.height).toBeGreaterThanOrEqual(48)
    await ownerFrame(page, 'hidden-collapsed-390')
    await j.clickByMouse('.ng-reader-hidden>summary', 'open hidden sections')
    await expect(page.locator('.ng-reader-hidden')).toHaveAttribute('open', '')
    await page.locator(READY).evaluate(el => el.scrollTop = el.scrollHeight); await j.readerLayoutSettled()
    await ownerFrame(page, 'hidden-expanded-390')
  } else await expect(summary).toBeHidden()
  for (const type of ['principles', 'prerequisites', 'mistakes']) {
    const selector = width === 390 ? `[data-section-toggle=${type}]` : `[data-toc-type=${type}] a`
    await page.locator(selector).scrollIntoViewIfNeeded(); await j.readerLayoutSettled(); await j.clickByMouse(selector)
    await expect(page.locator(`[data-section-toggle=${type}]`)).toHaveAttribute('aria-expanded', 'true')
    await expect(page.locator(`[data-section-toggle=${type}]`)).toBeFocused()
  }
  await expect(summary).toBeHidden()
  expect(await page.locator('[data-reader-body]').textContent(), 'full source text and order return unchanged').toBe(original)
})
