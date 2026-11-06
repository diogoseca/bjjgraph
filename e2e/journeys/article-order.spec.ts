import { test, expect, type Page } from '@playwright/test'
import { journey } from '../dsl'

// The owner on Side Control Bottom (2026-11-01). His words govern; they are in scratch's brief and, in short, here:
//   "the choices row should always have the same size as the grid ... I kind of like it that it's centered"
//   "what should show up first ... should be the 'Also known as' section, and then 'What is side control bottom?'"
//   "the essential principles ... after the position definition"; decisions and mistakes "very nice"
//   "the statistics, I would push that upwards"; the overview "should be split ... too much content in one single container"
//   U96, U101 b, U102 a (2026-11-06, replacing the numbered tiles): "there should only be one overview, and it shouldn't be called
//   'overview.'" So one tile, "How it works", a short opening, and "Read more" opening the rest in place, one way.
//   "training is not very nice ... push that downwards"; statistics and decisions carry a "beta"-style mark.
//
// REAL CONTENT: dossier chunks route through to the built tree, as in article-dashboard.spec.ts.
//
// Claims and the control that breaks each, in tests/artifacts/article_sections_mutants.mjs:
//   order-position-list      a position reads in the owner's order (the old list on every page)
//   order-reaches-others     every other page keeps today's order, safety included (the new list everywhere)
//   relations-not-split      the relations are tiles of their own (the aside stays one block in How it works)
//   definition-in-overview   the definition is its own tile (state-invariants back in How it works)
//   wikilink-printed         no tile prints a wikilink's brackets (the name not resolved)
//   overview-one-wall        a position opens short (no Read more: the whole text shown)
//   read-more-open           a position opens short (the disclosure starts open)
//   overview-loses-text      Read more keeps every word (the later paragraphs dropped)
//   read-more-sentence-lost  Read more keeps every word (the rest of the first paragraph dropped)
//   label-reverted           one tile and one index row named How it works (the old label)
//   label-hub-reverted       a hub's seats and its shared line take the new names (the old labels)
//   read-more-everywhere     Read more is a position's alone (on a transition too)
//   read-more-global-css     a page's own disclosures keep their summaries (the rule not scoped to the class)
//   width-right-edge         the grid keeps the index's 12px clearance (the grid back to the old, wider width)
//   row-keeps-inset          the first card sits on the grid's left edge (the row's 24px inset back)
//   row-full-width           below the index the row shares the grid too (the row back to the window's width)
//   grid-spans-all           no section spans the grid (a tile across all 12 columns)
//   beta-everywhere          only a position's two sections carry Beta (the mark on every options tile)
//   beta-suffix              the same, on a System and on Training (the selector back to id suffixes)
//   relations-label-unscoped a transition keeps its words (the rule not scoped to a position's own tile)
//   relations-label-shown    a position drops them (the rule removed)
//   u99-wheel-declines       the wheel declines nothing (a wheel over the card counts as reading)
//   index-from-1152          the index waits for a readable line (back at 1,152)
//   index-never              the index shows at 1,350 (never)
//   band-uncapped            the map stops at the median card's room (half the window, no cap)
//   band-old-144             the map is half the window (the old 144px band)
//   u99-no-scroll            every answer is reached by a real scroll (the reader cannot scroll)
//   u99-fixed-over-answer    nothing is fixed over an answer (a fixed strip along the window's bottom)
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
  expect(of('aka').text, 'the tile\'s title says it, so the line does not').not.toContain('Also known as')
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

// Rewritten from "several short tiles that keep every sentence" by U101 b and U102 a: one section, one name, and the same words.
// Every position role page was swept once at v1.251.0: 266 of 266 equal to the source, 0 with a block that is not a paragraph.
for (const path of [SCB, '/Positions/Rubber-Guard/New-York/Bottom']) {
  test(`@curated ${path}: one tile named How it works, a short opening, one index row, and every word of the source`, async ({ page }) => {
    await boot(page, 1440, 900, path)
    const d = await tiles(page), section = d.open.filter(t => t.type === 'overview')
    expect(section.map(t => t.title), 'one section, one name').toEqual(['How it works'])
    const seen = await page.evaluate(async path => {
      const r = (window as any).__neural._reader, t = r.body.querySelector('[data-section-type=overview]'), body = t.querySelector('.ng-section-body'), squeeze = (s: string) => s.replace(/\s+/g, '')
      const source = new DOMParser().parseFromString(await (await fetch(path)).text(), 'text/html').querySelector('#overview')!
      for (const x of source.querySelectorAll('.also-known-as,.often-confused-with,[data-source-id],aside')) x.remove()
      return { rows: [...r.contents.querySelectorAll('[data-toc-type=overview] a')].map((a: any) => a.textContent), read: t.querySelector('summary')?.textContent, open: !!t.querySelector('details[open]'),
        shown: body.innerText.replace(/\s+/g, ' ').trim().length, dom: squeeze(body.textContent).replace('Readmore', '').replace('Howitworks', ''), source: squeeze(source.textContent) }
    }, path)
    expect(seen.rows, 'the index has one row for the section').toEqual(['How it works'])
    expect(seen.read, 'the rest waits behind Read more').toBe('Read more')
    expect(seen.open, 'closed on arrival').toBe(false)
    expect(seen.shown, 'the opening is short').toBeLessThan(700)
    expect(seen.dom.length, 'premise: real text').toBeGreaterThan(600)
    expect(seen.dom, 'every word of the source stays in the DOM, in order').toBe(seen.source)
  })
}

// The names a reader sees on a hub. The prose may use the word; a label may not.
for (const [path, seats] of [['/Positions/Mount', ['From the top', 'From the bottom']], ['/Transitions/Knee-Slice-Pass', ['As the attacker', 'As the defender']]] as const) {
  test(`@curated ${path}: the seats take their new names, and no label says overview`, async ({ page }) => {
    await boot(page, 1440, 900, path)
    const d = await page.evaluate(() => { const r = (window as any).__neural._reader; return {
      titles: [...r.body.querySelectorAll('.ng-section-title')].map((e: any) => e.textContent),
      rows: [...r.contents.querySelectorAll('.ng-reader-toc-row a')].map((e: any) => e.textContent),
      shared: [...r.body.querySelectorAll('.ng-section-provenance')].map((e: any) => e.textContent) } })
    for (const seat of seats) expect(d.titles, 'the tile').toContain(seat)
    for (const seat of seats) expect(d.rows, 'the index').toContain(seat)
    expect(d.shared, 'the line over the shared text').toContain('For both sides')
    expect([...d.titles, ...d.rows, ...d.shared].filter(t => /overview/i.test(t)), 'no label keeps the word').toEqual([])
  })
}

// The names follow through every place that lists sections, and a saved choice survives them: settings are stored by type.
test('@curated a saved closed section survives the new name, in the index, Settings and Hidden sections', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 })
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
  const j = journey(page)
  await j.boot(SCB, { initialState: { v: 2, settings: { 'readerSection.overview': false }, settingsAt: {} }, beforeNavigate: async () => { await page.route('**/static/neural/content/*.json', r => r.continue()) } })
  await expect(page.locator(READY)).toBeVisible(); await j.readerLayoutSettled()
  expect(await page.locator('[data-section-toggle=overview]').getAttribute('aria-expanded'), 'the saved choice still closes it').toBe('false')
  // 1024 has no index, so Hidden sections carries it. 1440 has one, and the index row does.
  await expect(page.locator('.ng-reader-hidden>summary'), 'it is listed as hidden').toContainText('Hidden sections (1)')
  await expect(page.locator('.ng-reader-hidden [data-section-toggle=overview] .ng-section-closed'), 'under its new name').toContainText('How it works')
  await page.setViewportSize({ width: 1440, height: 900 }); await j.readerLayoutSettled()
  const row = page.locator('.ng-reader-toc-row[data-toc-type=overview]')
  await expect(row, 'the index carries it under its new name').toHaveText('How it works')
  await expect(row, 'closed').toHaveAttribute('data-collapsed', 'true')
  // The Settings page itself, not the list it reads.
  await page.evaluate(() => (window as any).__neural.openSettings('rolling'))
  await expect(page.locator('[data-section-setting=overview]'), 'Settings shows the saved choice').not.toBeChecked()
  for (const [type, name] of [['overview', 'How it works'], ['top-summary', 'From the top'], ['bottom-summary', 'From the bottom'], ['attacker-summary', 'As the attacker'], ['defender-summary', 'As the defender']])
    expect(await page.locator(`[data-section-setting="${type}"]`).evaluate(e => e.parentElement!.textContent), `Settings names ${type}`).toBe(name)
})

// Learning, Systems and Submission family pages publish their own <details>. Opening one must leave its question in place.
test('@curated a page\'s own disclosures keep their summaries when opened', async ({ page }) => {
  await boot(page, 1440, 900, '/Learning/Asymmetric-Warfare')
  const d = await page.evaluate(() => { const own = [...document.querySelectorAll('[data-reader-body] article details')] as HTMLDetailsElement[]; own.forEach(x => { x.open = true }); return { own: own.length, shown: own.filter(x => x.querySelector('summary')?.getClientRects().length).length } })
  expect(d.own, 'premise: the page publishes its own').toBeGreaterThan(0)
  expect(d.shown, 'every summary stays').toBe(d.own)
})

test('@curated every other page keeps today\'s order, and safety stays where it sorts', async ({ page }) => {
  await boot(page, 1440, 900, '/Transitions/Knee-Slice-Pass/Attacker')
  const d = await tiles(page), kinds = [...new Set(d.open.map(t => t.type))]
  expect(kinds.slice(0, 7), 'a transition reads as it did').toEqual(['overview', 'principles', 'setup', 'options', 'safety', 'mistakes', 'outcomes'])
  const section = d.open.filter(t => t.type === 'overview')
  expect(section.map(t => t.title), 'its section takes the new name too').toEqual(['How it works'])
  expect(await page.locator('[data-section-type=overview] summary').count(), 'and stays whole: Read more is a position\'s').toBe(0)
  expect(d.open.some(t => t.beta), 'its options tile carries no Beta').toBe(false)
})

// U92 a: Statistics and Decisions, on position pages, and nothing else. A suffix selector also lit How it works on all 83 Systems
// (an empty assessment-metrics) and Training on two positions (a *-decision-tree id), so each is here. beta-suffix.
for (const [path, id, marked] of [[SCB, 'decision-tree', ['options', 'statistics']], ['/Positions/Leg-Drag-Control/Top', 'leg-drag-decision-tree', ['options', 'statistics']],
  ['/Systems/10th-Planet-No-Gi-Guard-System', 'assessment-metrics', []]] as const) {
  test(`@curated only a position's Statistics and Decisions carry the Beta mark: ${path}`, async ({ page }) => {
    await boot(page, 1440, 900, path)
    const d = await tiles(page)
    expect(await page.locator(`[data-reader-body] [data-source-id="${id}"]`).count(), `premise: the page carries ${id}`).toBeGreaterThan(0)
    expect(d.open.filter(t => t.beta).map(t => t.type)).toEqual(marked)
  })
}

// The tile's title says "Also known as", so a position drops those words from its own line. A transition's and a submission's relations
// sit in one block with no such title, where the words are the only label. relations-label-unscoped, relations-label-shown.
test('@curated a transition keeps the words Also known as, which only a position\'s own tile can drop', async ({ page }) => {
  await boot(page, 1440, 900, '/Transitions/Half-Guard-to-Leg-Weave/Defender')
  const label = page.locator('[data-reader-body] .also-known-as>em').first()
  await expect(label, 'the words are the label here').toBeVisible()
  await expect(label).toContainText('Also known as')
})

// Measured before this change at 1408: grid 236-1384, row 236-1172, first card 260. Sweep from the brief: 1024 to 1920 by 64.
const widths: number[] = [1349, 1350]
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

// U97 b (owner, 2026-11-06): the index shows only from about 1,350px, where a line stays at 45 characters (1,346 on five real
// pages, real fonts). The harness's fallback fonts cannot measure characters, so the claim here is the widths that carry it:
// a 387px text column at the threshold, and the 902px grid just below it, which is what keeps the seam small.
for (const [width, index, grid] of [[1349, false, 902], [1350, true, 878]] as const) {
  test(`@curated U97 at ${width}px the index is ${index ? 'shown' : 'hidden'} and the grid is ${grid}px`, async ({ page }) => {
    await boot(page, width, 900)
    const e = await page.evaluate(() => {
      const r = (window as any).__neural._reader, tile = r.body.querySelector(':scope>:not([data-media-control])')
      return { index: !r.contents.hidden, grid: r.body.getBoundingClientRect().width, text: tile.querySelector('article').getBoundingClientRect().width }
    })
    expect(e.index, 'the index').toBe(index)
    expect(e.grid, 'the grid').toBeCloseTo(grid, 0)
    expect(e.text, 'a line has its room').toBeGreaterThanOrEqual(386)
  })
}

for (const [width, height] of [[1152, 864], [1440, 900], [1920, 1080]] as const) {
  test(`no section spans the whole grid at ${width}x${height}`, async ({ page }) => {
    await boot(page, width, height)
    const d = await tiles(page)
    expect(d.open.length, 'premise: the article shows').toBeGreaterThan(8)
    for (const t of d.open) expect(t.width, `${t.type} is narrower than the grid`).toBeLessThan(d.grid.width - 24)
  })
}

// U90 a, then U99 b (owner, 2026-11-06): a taller map, 43% at 900px tall, "knowing half of all cards then need a scroll to reach
// their last answer". He overrode the first build's "never hiding", so D-368's no-scroll claim on a desktop is replaced by the
// floor below: every answer of every card can be reached by a real scroll. The map ends at half the window, or NG_LIVE_ANSWER_ROOM
// (514, the median card) above the window's bottom if that is higher, and it reads the window alone.
for (const [width, height, bottom, note] of [[1440, 900, 386, '43%'], [1152, 864, 350, 'capped'], [1920, 1400, 700, 'exactly half']] as const) {
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
  })
}

// U99 b's floor. Americana from Side Control holds the longest card measured (589px below the map, real fonts). Each answer of
// each card is walked to by the real wheel, over the card, and must then sit whole inside the reader with nothing over it. The
// premise makes a page that stops needing a scroll fail here instead of passing without the claim.
const answersOf = (page: Page) => page.evaluate(() => {
  const a = (window as any).__neural, end = a._reader.root.getBoundingClientRect().bottom, top = a._reader.root.getBoundingClientRect().top
  return { end, top, scrollTop: a._reader.root.scrollTop, question: a._landQ?.card?.q, answers: [...a._landEl.querySelectorAll('[data-land-q] button')].filter((e: any) => e.getClientRects().length && e.getBoundingClientRect().width > 150).map((e: any) => {
    const b = e.getBoundingClientRect(), inside = b.top >= top && b.bottom <= end, hit = inside && document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2)
    return { top: b.top, bottom: b.bottom, left: b.left, width: b.width, inside, hit: !!hit && e.contains(hit) }
  }) }
})
// Reaching an answer is worth nothing if the wheel spent the question. The press is real, the beat is what scored it, and nothing
// declined it on the way: a wheel over the card is game input. u99-wheel-declines.
test('@curated U99 at 1440x900 the last answer, reached by the wheel, scores, and the wheel declines nothing', async ({ page }) => {
  test.setTimeout(120000)
  const j = await boot(page, 1440, 900, '/Submissions/Americana/from-Side-Control/Attacker')
  await j.openQuestion()
  await j.readerLayoutSettled()
  let card = await answersOf(page)
  for (let n = 0; n < 16 && card.answers.at(-1)!.inside; n++) {
    await j.clickByMouse('[data-land-next]', 'the next card')
    await j.readerLayoutSettled()
    card = await answersOf(page)
  }
  const last = card.answers.at(-1)!
  expect(last.inside, 'premise: this card\'s last answer starts below the reader\'s end').toBe(false)
  await page.mouse.move(last.left + last.width / 2, Math.min(last.top + 4, card.end - 12))
  await page.mouse.wheel(0, last.bottom - card.end + 12)
  await expect.poll(async () => (await answersOf(page)).answers.at(-1)!.inside, { message: 'the wheel brought it into the reader' }).toBe(true)
  await j.readerLayoutSettled()
  const now = (await answersOf(page)).answers.at(-1)!
  expect((await j.beats()).map(b => b.beat), 'the wheel declined nothing').not.toContain('land_q_declined')
  expect(now.hit, 'nothing is over it').toBe(true)
  await page.mouse.click(now.left + now.width / 2, (now.top + now.bottom) / 2)
  await j.readerLayoutSettled()
  const beats = (await j.beats()).map(b => b.beat)
  expect(beats, 'the press scored').toContain('land_q_answered')
  expect(beats, 'and still nothing declined').not.toContain('land_q_declined')
})

for (const [width, height] of [[1440, 900], [1152, 864]] as const) {
  test(`@curated U99 at ${width}x${height} every answer of every card on the longest deck is reached by a real scroll`, async ({ page }) => {
    test.setTimeout(180000)
    const j = await boot(page, width, height, '/Submissions/Americana/from-Side-Control/Attacker')
    await j.openQuestion()
    await j.readerLayoutSettled()
    const seen = new Set<string>()
    let scrolled = 0
    for (let n = 0; n < 16; n++) {
      const card = await answersOf(page)
      expect(card.answers.length, 'premise: the question shows its answers').toBeGreaterThan(1)
      if (seen.has(card.question)) break
      seen.add(card.question)
      for (let i = 0; i < card.answers.length; i++) {
        let now = await answersOf(page)
        for (let tries = 0; !now.answers[i].inside && tries < 6; tries++) {
          const at = now.answers[i]
          await page.mouse.move(at.left + at.width / 2, Math.min(at.top + 4, now.end - 12))
          await page.mouse.wheel(0, at.bottom - now.end + 12)
          await expect.poll(async () => (await answersOf(page)).scrollTop, { message: 'the wheel moves the reader' }).toBeGreaterThan(now.scrollTop)
          await j.readerLayoutSettled()
          now = await answersOf(page); scrolled++
        }
        expect(now.answers[i], `answer ${i + 1} of "${card.question}" sits whole in the reader, with nothing over it`).toMatchObject({ inside: true, hit: true })
      }
      await page.locator('[data-reader]').evaluate(e => { e.scrollTop = 0 })
      await j.readerLayoutSettled()
      const next = page.locator('[data-land-next]')
      if (!(await next.count()) || !(await next.first().isVisible())) break
      await j.clickByMouse('[data-land-next]', 'the next card')
      await j.readerLayoutSettled()
    }
    expect(seen.size, 'premise: several cards were walked').toBeGreaterThan(3)
    expect(scrolled, 'premise: some answers needed the scroll this claim is about').toBeGreaterThan(0)
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
