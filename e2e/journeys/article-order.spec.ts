import { test, expect, type Page } from '@playwright/test'
import { journey } from '../dsl'

// The owner on Side Control Bottom (2026-11-01). His words govern; they are in scratch's brief and, in short, here:
//   "the choices row should always have the same size as the grid ... I kind of like it that it's centered"
//   "what should show up first ... should be the 'Also known as' section, and then 'What is side control bottom?'"
//   "the essential principles ... after the position definition"; decisions and mistakes "very nice"
//   "the statistics, I would push that upwards"; the overview "should be split ... too much content in one single container"
//   "training is not very nice ... push that downwards"; statistics and decisions carry a "beta"-style mark.
//
// REAL CONTENT: dossier chunks route through to the built tree, as in article-dashboard.spec.ts.
//
// Claims and the control that breaks each, in tests/artifacts/article_sections_mutants.mjs:
//   order-position-list      a position reads in the owner's order (the old list on every page)
//   order-reaches-others     every other page keeps today's order, safety included (the new list everywhere)
//   relations-not-split      the relations are tiles of their own (the aside stays one block in Overview)
//   definition-in-overview   the definition is its own tile (state-invariants back in Overview)
//   wikilink-printed         no tile prints a wikilink's brackets (the name not resolved)
//   overview-one-wall        a position's Overview is several short tiles (the split removed)
//   overview-index-rows      the index keeps one Overview row (every tile gets a row)
//   overview-loses-text      the split keeps every sentence (a tile dropped)
//   width-right-edge         the grid keeps the index's 12px clearance (the grid back to the old, wider width)
//   row-keeps-inset          the first card sits on the grid's left edge (the row's 24px inset back)
//   row-full-width           below the index the row shares the grid too (the row back to the window's width)
//   grid-spans-all           no section spans the grid (a tile across all 12 columns)
//   beta-everywhere          only a position's two sections carry Beta (the mark on every options tile)
//   band-uncapped            the map stops above a live question's answers (half the window, no cap)
//   band-old-144             the map is half the window (the old 144px band)
//   band-follows-card        nothing moves when a question opens (a band read off the open card)
//   ask-line-centred         the question line starts at the label's left edge (the line centred, as it was)
// pane-layout.spec.ts carries the 768 close (pane-hold-*). The band mutants edit neural.js, so they sit outside that file's
// reader-only runner: the commands and the receipt are in docs/Changelog-Archive.md's v1.251.0 entry.

const READY = '[data-reader][data-reader-ready="true"]'
const SCB = '/Positions/Side-Control/Bottom'

async function boot(page: Page, width: number, height: number, path = SCB) {
  await page.setViewportSize({ width, height })
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
  const j = journey(page)
  await j.boot(path, { beforeNavigate: async () => { await page.route('**/static/neural/content/*.json', r => r.continue()) } })
  await expect(page.locator(READY)).toBeVisible(); await j.readerLayoutSettled()
  return j
}
const tiles = (page: Page) => page.evaluate(() => {
  const r = (window as any).__neural._reader, g = r.body.getBoundingClientRect()
  return { grid: { left: g.left, right: g.right, width: g.width }, toc: [...r.contents.querySelectorAll('[data-toc-type]')].map((e: any) => e.dataset.tocType),
    open: ([...r.body.children] as HTMLElement[]).filter(c => c.getClientRects().length).map(c => { const b = c.getBoundingClientRect(), s = getComputedStyle(c.querySelector('h2')!, '::after')
      return { type: c.dataset.sectionType!, title: c.querySelector('.ng-section-title')!.textContent, text: (c.querySelector('.ng-section-body') as HTMLElement).innerText.replace(/\s+/g, ' ').trim(), width: b.width, beta: s.content === '"Beta"' } }) }
})

test('@curated a position reads in the owner\'s order, with a tile for each relation and for the definition', async ({ page }) => {
  await boot(page, 1440, 900)
  const d = await tiles(page), kinds = [...new Set(d.open.map(t => t.type))]
  expect(kinds).toEqual(['aka', 'confused', 'definition', 'principles', 'options', 'mistakes', 'statistics', 'overview', 'prerequisites', 'training', 'related'])
  const of = (type: string) => d.open.find(t => t.type === type)!
  expect(of('aka').title).toBe('Also known as')
  expect(of('aka').text, 'the relation is its own small tile').toContain('Side Mount')
  expect(of('confused').title).toBe('Often confused with')
  expect(of('confused').text).toContain('Shoulder of Justice')
  expect(of('definition').text.startsWith('What is Side Control (Bottom)?'), 'the question leads the definition').toBe(true)
  expect(of('overview').text, 'the relations left the Overview').not.toContain('Side Mount')
  expect(d.open.map(t => t.text).join(' '), 'no tile prints a wikilink').not.toContain('[[')
  const faint = await page.evaluate(() => {
    const title = document.querySelector('[data-section-type=definition] .ng-section-title') as HTMLElement, q = document.querySelector('[data-section-type=definition] .section-subtitle') as HTMLElement
    return { title: title.textContent, size: parseFloat(getComputedStyle(title).fontSize), opacity: +getComputedStyle(title).opacity, question: parseFloat(getComputedStyle(q).fontSize) }
  })
  expect(faint.title, 'the eyebrow keeps the words').toBe('Position definition')
  expect(faint.opacity, 'the eyebrow is almost unnoticeable').toBeLessThan(.6)
  expect(faint.size, 'the eyebrow is smaller than the question').toBeLessThan(faint.question)
})

test('@curated a position\'s Overview is several short tiles that keep every sentence, with one index row', async ({ page }) => {
  await boot(page, 1440, 900)
  const d = await tiles(page), overview = d.open.filter(t => t.type === 'overview')
  expect(overview.length, 'the one long paragraph is split').toBeGreaterThanOrEqual(2)
  for (const t of overview) expect(t.text.length, `${t.title} is a short tile`).toBeLessThan(900)
  expect(d.toc.filter(t => t === 'overview'), 'the index has one Overview row').toHaveLength(1)
  const source = await page.evaluate(async path => new DOMParser().parseFromString(await (await fetch(path)).text(), 'text/html').querySelector('#overview')!.textContent!.replace(/\s+/g, ' ').trim(), SCB)
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim()
  expect(norm(overview.map(t => t.text).join(' ')), 'every sentence survives, in order').toBe(source)
})

test('@curated every other page keeps today\'s order, and safety stays where it sorts', async ({ page }) => {
  await boot(page, 1440, 900, '/Transitions/Knee-Slice-Pass/Attacker')
  const d = await tiles(page), kinds = [...new Set(d.open.map(t => t.type))]
  expect(kinds.slice(0, 7), 'a transition reads as it did').toEqual(['overview', 'principles', 'setup', 'options', 'safety', 'mistakes', 'outcomes'])
  expect(d.open.filter(t => t.type === 'overview'), 'its Overview stays whole').toHaveLength(1)
  expect(d.open.some(t => t.beta), 'its options tile carries no Beta').toBe(false)
})

test('@curated only a position\'s Statistics and Decisions carry the Beta mark', async ({ page }) => {
  await boot(page, 1440, 900)
  const d = await tiles(page)
  expect(d.open.filter(t => t.beta).map(t => t.type)).toEqual(['options', 'statistics'])
})

// Measured before this change at 1408: grid 236-1384, row 236-1172, first card 260. Sweep from the brief: 1024 to 1920 by 64.
const widths: number[] = []
for (let w = 1024; w <= 1920; w += 64) widths.push(w)
test('@curated the choices row and the grid share both edges and stay centred, 1024 to 1920', async ({ page }) => {
  test.setTimeout(240000)
  const seen: number[] = []
  for (const width of widths) {
    await boot(page, width, 900)
    const e = await page.evaluate(() => {
      const a = (window as any).__neural, r = a._reader, g = r.body.getBoundingClientRect(), row = a.optionsRef.current, b = row.getBoundingClientRect(), s = getComputedStyle(row)
      const cards = [...row.querySelectorAll('[data-tech],[data-threat-tech]')].map((c: any) => c.getBoundingClientRect().left)
      return { left: g.left, right: g.right, rowLeft: b.left + parseFloat(s.paddingLeft), rowRight: b.right - parseFloat(s.paddingRight), first: Math.min(...cards), free: a._paneLayout().center,
        index: r.contents.hidden ? null : r.contents.getBoundingClientRect().right }
    })
    expect(Math.abs(e.rowLeft - e.left), `left edges at ${width}`).toBeLessThanOrEqual(1)
    expect(Math.abs(e.rowRight - e.right), `right edges at ${width}`).toBeLessThanOrEqual(1)
    expect(Math.abs(e.first - e.left), `the first card sits on the edge at ${width}`).toBeLessThanOrEqual(1)
    expect(Math.abs((e.left + e.right) / 2 - e.free), `centred at ${width}`).toBeLessThanOrEqual(1)
    // Two edges can match and stay centred while the grid runs under the index, so the clearance is its own claim.
    if (e.index != null) expect(Math.abs(e.left - (e.index + 12)), `the grid clears the index at ${width}`).toBeLessThanOrEqual(1)
    seen.push(width)
  }
  expect(seen, 'the sweep ran every width').toEqual(widths)
})

for (const [width, height] of [[1152, 864], [1440, 900], [1920, 1080]] as const) {
  test(`no section spans the whole grid at ${width}x${height}`, async ({ page }) => {
    await boot(page, width, height)
    const d = await tiles(page)
    expect(d.open.length, 'premise: the article shows').toBeGreaterThan(8)
    for (const t of d.open) expect(t.width, `${t.type} is narrower than the grid`).toBeLessThan(d.grid.width - 24)
  })
}

// U90 a (owner, 2026-11-06): "half the window, never hiding a live question's answers". The map ends at half the window, or
// NG_LIVE_ANSWER_ROOM above the window's bottom if that is higher. D-368 and D-433 pin the catch; these pin the calm card.
for (const [width, height, bottom, note] of [[1440, 900, 280, 'capped'], [1152, 864, 244, 'capped'], [1920, 1400, 700, 'exactly half']] as const) {
  test(`@curated U90 at ${width}x${height} the map ends at ${bottom}px (${note}), and nothing moves when a question opens`, async ({ page }) => {
    const j = await boot(page, width, height)
    const stage = () => page.evaluate(() => {
      const a = (window as any).__neural, r = a._reader
      return { band: r.nodeBand.bottom, row: a.optionsRef.current.getBoundingClientRect().top, label: a.optionsRef.current.firstElementChild.getBoundingClientRect().left, scrollTop: r.root.scrollTop }
    })
    const before = await stage()
    expect(before.band, 'the map\'s bottom').toBe(bottom)
    await j.openQuestion()
    await j.readerLayoutSettled()
    expect(await stage(), 'the map, the Moves row and the reader hold still').toEqual(before)
    const open = await page.evaluate(() => {
      const a = (window as any).__neural, end = a._reader.root.getBoundingClientRect().bottom
      return { end, answers: [...a._landEl.querySelectorAll('[data-land-q] button')].filter((e: any) => e.getClientRects().length && e.getBoundingClientRect().width > 150).map((e: any) => {
        const b = e.getBoundingClientRect(), hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2)
        return { bottom: b.bottom, hit: !!hit && e.contains(hit) } }) }
    })
    expect(open.answers.length, 'premise: the question shows its answers').toBeGreaterThan(1)
    expect(open.answers.filter(x => !x.hit || x.bottom > Math.min(height, open.end) - 8), 'every answer is on screen, 8px clear of the reader\'s end').toEqual([])
  })
}

// U90 note: "the question below the choices should be left aligned, aligned with the left start of Your choices/moves label".
// Text against text, because the label and the line each sit inside their own box.
for (const [width, height] of [[1440, 900], [1152, 864], [900, 900], [390, 844]] as const) {
  test(`@curated U90 at ${width}x${height} the question line starts at the left edge of the label above the choices`, async ({ page }) => {
    await boot(page, width, height)
    const e = await page.evaluate(() => {
      const a = (window as any).__neural, left = (n: Node) => { const r = document.createRange(); r.selectNodeContents(n); return r.getBoundingClientRect().left }
      const label = a.optionsRef.current.querySelector('[data-choice-group]').firstChild, ask = a._landEl.querySelector('[data-land-ask-text]')
      return { name: label.firstChild.textContent, label: left(label.firstChild), ask: left(ask.firstChild), below: ask.getBoundingClientRect().top - a.optionsRef.current.querySelector('[data-tech]').getBoundingClientRect().bottom }
    })
    expect(e.name, 'premise: the label above the choices').toBe('Your move')
    expect(e.below, 'premise: the question sits below the choices').toBeGreaterThan(0)
    expect(Math.abs(e.ask - e.label), `the line starts at the label (${e.ask} vs ${e.label})`).toBeLessThanOrEqual(.5)
  })
}
