import { test, expect, type Page } from '@playwright/test'
import { journey } from '../dsl'

// U55 b (owner, 2026-10-28): on desktop the article's sections are a bento dashboard. The owner's words:
// "dashboard looks better although it doesn't leave that 'available' space for the node to show, and it
// should. and also we want to show all content, not show it and only show it when the user clicks the
// section which should do nothing btw. three cols is great but sometimes 2 is better, and they dont need
// to be the same size".
//
// REAL CONTENT. The harness serves `{}` for dossier chunks (e2e/dsl.ts); this journey routes them through
// to the built tree, so Mount/Top reads with its film and its Videos section, a long prose Overview and
// short lists (Essential principles, Prerequisites, Statistics). The page HTML is the served build's own.
// What the harness still does NOT serve: Google Fonts (an empty stylesheet) and YouTube thumbnails
// (aborted). Heights here are fallback-font heights, so every claim is RELATIVE: a tile against its own
// content, a gap against the token, an edge against the index, never an absolute height.
//
// Claims, each with its control in tests/artifacts/article_sections_mutants.mjs:
//   u55-tile-capped        every tile shows its whole content (a 520px cap, the owner-rejected mock)
//   u55-rows-short         every tile shows its whole content (rows counted short of the content)
//   u55-margin-uncounted   every tile shows its whole content (a heading's collapsed margin left out)
//   u55r-rows-long         every tile ends within one 8px row of its content (25 rows too many)
//   u55r-body-capped       nothing inside a tile clips its text (the body capped at 240px)
//   u55r-para-clamp        nothing inside a tile clips its text (paragraphs clamped to two lines)
//   u55-tile-click-toggles a section tile click does nothing (a click on the tile toggles it)
//   u55r-link-swallowed    a link inside a tile still opens its page (the tile swallows the click)
//   u55-band-covered       the node band stays clear (the article pulled up over the game stage)
//   u55-width-unused       the dashboard uses the width (the grid keeps the centred column)
//   u55r-phone-dashboard   the phone keeps its stacked flow (the dashboard's rows applied at 390px)
const READY = '[data-reader][data-reader-ready="true"]'

async function boot(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height })
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
  const j = journey(page)
  await j.boot('/Positions/Mount/Top', { beforeNavigate: async () => {
    await page.route('**/static/neural/content/*.json', r => r.continue())
  } })
  await expect(page.locator(READY)).toBeVisible(); await j.readerLayoutSettled()
  return j
}

// What the page EMITTED: every shown tile's box, its content's box and its type, plus the index and band.
const dashboard = (page: Page) => page.evaluate(() => {
  const a = (window as any).__neural, r = a._reader, box = (e: Element) => e.getBoundingClientRect().toJSON()
  const cards = ([...r.body.children] as HTMLElement[]).filter(c => c.getClientRects().length)
  return {
    W: innerWidth, band: r.nodeBand, scrollTop: r.root.scrollTop, path: location.pathname,
    toc: r.contents.hidden ? null : box(r.contents), body: box(r.body), gap: 4 * parseFloat(getComputedStyle(r.root).getPropertyValue('--section-gap')),
    question: a._landEl ? box(a._landEl) : null, hand: a.optionsRef.current ? box(a.optionsRef.current) : null,
    states: r.sections.map((s: any) => s.type + ':' + s.toggle.getAttribute('aria-expanded') + ':' + s.card.dataset.collapsed).join(' '),
    tiles: cards.map(c => {
      const s = getComputedStyle(c)
      // Anything that hides text: the tile, or any box inside it holding text, whose content overflows a
      // non-visible overflow. A cap (max-height), a clamp (-webkit-line-clamp) or a fade-by-overflow all show up
      // here once they actually cut something; a clamp that cuts nothing (the Related cards' 3-line blurbs, all
      // one line on this page) does not. Boxes with no text are left out (an inline SVG icon clips by default).
      const clipped = [c, c.lastElementChild!, ...c.lastElementChild!.querySelectorAll('*')].filter(e => {
        if (!e.textContent!.trim()) return false
        return getComputedStyle(e).overflowY !== 'visible' && e.scrollHeight > e.clientHeight + 1
      }).map(e => e.tagName.toLowerCase() + '.' + [...e.classList].join('.'))
      return { type: c.dataset.sectionType!, box: box(c), content: box(c.lastElementChild!), head: box(c.firstElementChild!),
        maxHeight: s.maxHeight, mask: s.maskImage || s.getPropertyValue('-webkit-mask-image'), overflowY: s.overflowY, clipped }
    }),
  }
})
type Dash = Awaited<ReturnType<typeof dashboard>>
const overlaps = (p: DOMRect, q: DOMRect) => p.left < q.right - 1 && q.left < p.right - 1

function wholeContent(d: Dash) {
  expect(d.tiles.length, 'Mount/Top shows its real sections').toBeGreaterThan(5)
  for (const t of d.tiles) {
    // No cap, no fade, no "click to expand": the tile ends at or below its own content.
    expect(t.maxHeight, t.type + ' is not capped').toBe('none')
    expect(t.mask, t.type + ' is not faded').toBe('none')
    expect(t.box.bottom, t.type + ' shows its whole content').toBeGreaterThanOrEqual(t.content.bottom - 1)
    expect(t.box.bottom - t.content.bottom, t.type + ' ends within one 8px row of its content').toBeLessThanOrEqual(8.5)
    expect(t.clipped, t.type + ': nothing inside the tile clips its text').toEqual([])
    expect(t.head.top, t.type + ' starts with its own title').toBeGreaterThanOrEqual(t.box.top - 1)
  }
  for (const [i, t] of d.tiles.entries()) for (const o of d.tiles.slice(0, i)) {
    expect(overlaps(t.box, o.box) && t.box.top < o.box.bottom - 1 && o.box.top < t.box.bottom - 1, `${t.type} and ${o.type} never overlap`).toBe(false)
  }
  // Each gap is the token, measured to the nearest tile above in the same lane.
  const gaps = d.tiles.map(t => {
    const above = d.tiles.filter(o => o !== t && overlaps(t.box, o.box) && o.box.bottom <= t.box.top + 1)
    return above.length ? t.box.top - Math.max(...above.map(o => o.box.bottom)) : null
  }).filter((g): g is number => g !== null)
  expect(gaps.length, 'tiles stack in lanes').toBeGreaterThan(2)
  for (const g of gaps) expect(Math.abs(g - d.gap), `gap ${g} is the ${d.gap}px token`).toBeLessThan(1)
}

for (const [width, height, lanes] of [[1440, 900, 3], [1920, 1080, 3], [1152, 900, 2]] as const) {
  test(`${width === 1440 ? '@curated ' : ''}U55 b: at ${width}x${height} the dashboard uses the width in ${lanes} lanes, shows every tile whole and keeps the node band clear`, async ({ page }) => {
    await boot(page, width, height)
    const d = await dashboard(page)
    // The node band: at arrival no tile is over it, and the dashboard starts below the question and the Moves row.
    expect(d.scrollTop).toBe(0)
    expect(d.band?.height, 'the reader reserves its node band').toBeGreaterThan(100)
    for (const t of d.tiles) expect(t.box.top, `${t.type} leaves the node band clear`).toBeGreaterThanOrEqual(d.band!.bottom)
    const stage = Math.max(d.question?.bottom ?? 0, d.hand?.bottom ?? 0)
    expect(stage, 'the question and the Moves row are on screen').toBeGreaterThan(d.band!.bottom)
    expect(Math.min(...d.tiles.map(t => t.box.top)), 'the dashboard starts below the question and the Moves row').toBeGreaterThanOrEqual(stage)
    // The width: from the index's 12px clearance to a 24px right margin.
    expect(d.toc, 'the left index shows').not.toBeNull()
    expect(d.body.left).toBeCloseTo(d.toc!.right + 12, 0)
    expect(d.body.right).toBeCloseTo(width - 24, 0)
    expect(Math.max(...d.tiles.map(t => t.box.right))).toBeCloseTo(width - 24, 0)
    // Mixed spans: the video's tile takes two of three lanes (or both of two), and a narrower tile shares its rows.
    const video = d.tiles.find(t => t.type === 'videos')!, unit = d.body.width / lanes
    expect(video.box.left).toBeCloseTo(d.body.left, 0)
    expect(video.box.width / d.body.width, 'the video takes most of the width').toBeGreaterThan(lanes === 3 ? 0.6 : 0.95)
    const beside = d.tiles.filter(t => t !== video && !overlaps(t.box, video.box) && t.box.top < video.box.bottom)
    if (lanes === 3) expect(beside.map(t => t.type), 'a one-third tile sits beside the video').toHaveLength(1)
    expect([...new Set(d.tiles.map(t => Math.round(t.box.width / unit)))].sort(), `tiles take one lane or ${lanes === 3 ? 'two' : 'both'}`).toEqual([1, 2])
    wholeContent(d)
    // Scrolled through the whole dashboard, every tile stays whole and the index follows what is in view.
    await page.locator(READY).evaluate(e => { e.scrollTop = e.scrollHeight })
    await journey(page).readerLayoutSettled()
    wholeContent(await dashboard(page))
  })
}

test('@curated U55 b: at 1440x900 a click on a section tile does nothing; its links and its close still work', async ({ page }) => {
  const j = await boot(page, 1440, 900)
  const tile = '[data-reader-body]>[data-section-type=principles]'
  await page.locator(tile).evaluate(e => { const root = e.closest('[data-reader]')!; root.scrollTop += e.getBoundingClientRect().top - root.getBoundingClientRect().top - 24 })
  await j.readerLayoutSettled()
  // The reader's first press anywhere is reading: it pauses the game and declines the asking question,
  // which may restyle the stage above the tiles. Pay that once in the grid's own gap, beside the tile.
  const at = (await dashboard(page)).tiles.find(t => t.type === 'principles')!, gap = { x: at.box.left - 6, y: at.box.top + 40 }
  expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.matches('[data-reader-body]'), gap), 'the gap is the grid, not a tile').toBe(true)
  await page.mouse.click(gap.x, gap.y); await j.readerLayoutSettled()
  const tiles = async () => { const d = await dashboard(page); return { states: d.states, tiles: d.tiles, scrollTop: d.scrollTop, path: d.path, body: d.body } }
  const before = await tiles()
  // Three places a reader might click on a tile: its title, a list entry, and the tile's own padding.
  for (const [selector, what] of [[`${tile}>h2>.ng-section-title`, 'the title'], [`${tile} li`, 'a list entry']]) {
    await j.clickByMouse(selector, what); await j.readerLayoutSettled()
    expect(await tiles(), `a click on ${what} changes nothing`).toEqual(before)
  }
  const pad = before.tiles.find(t => t.type === 'principles')!
  const point = { x: pad.box.left + 6, y: (pad.box.top + pad.box.bottom) / 2 }
  expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('[data-section-type]')?.getAttribute('data-section-type'), point)).toBe('principles')
  await page.mouse.click(point.x, point.y); await j.readerLayoutSettled()
  expect(await tiles(), 'a click on the tile itself changes nothing').toEqual(before)
  // Its own close still closes it, and the index brings it back. Reading can mint a patch, a deliberate
  // screen in the top-right corner over the right lane's first close: dismiss it through its own control.
  if (await page.locator('[data-reward-close]').isVisible()) await j.clickByMouse('[data-reward-close]', 'dismiss the earned reward')
  await j.clickByMouse('[data-section-toggle=principles]')
  await expect(page.locator('[data-section-toggle=principles]')).toHaveAttribute('aria-expanded', 'false')
  await j.clickByMouse('[data-toc-type=principles] a')
  await expect(page.locator('[data-section-toggle=principles]')).toHaveAttribute('aria-expanded', 'true')
  // A link inside a tile still works: it opens its page in the reader.
  const link = await page.evaluate(() => {
    const r = (window as any).__neural._reader
    // A same-origin link to another technique or position page (tiles carry absolute hrefs; anchors and the
    // Videos tile's YouTube links are other paths).
    const a = [...r.body.querySelectorAll('.ng-section-card a[href]')].find(e => {
      const u = new URL((e as HTMLAnchorElement).href)
      return u.origin === location.origin && !(e as HTMLElement).dataset.readerAnchor && /^\/(Positions|Transitions|Submissions)\//.test(u.pathname) && !u.pathname.startsWith('/Positions/Mount')
    }) as HTMLAnchorElement
    if (!a) return null
    a.setAttribute('data-test-tile-link', '')
    r.root.scrollTop += a.getBoundingClientRect().top - r.root.getBoundingClientRect().top - 200
    return new URL(a.href).pathname.replace(/\.html$/, '').replace(/\/$/, '')
  })
  expect(link, 'premise: a tile on Mount/Top carries an internal link').toBeTruthy()
  await j.readerLayoutSettled()
  await j.clickByMouse('[data-test-tile-link]', 'a link inside a tile')
  await expect(page.locator('[data-reader]')).toHaveAttribute('data-reader-path', decodeURI(link!))
})

test('U55 b: at 390x844 the phone keeps its stacked flow, untouched by the dashboard', async ({ page }) => {
  await boot(page, 390, 844)
  const phone = await page.evaluate(() => {
    const r = (window as any).__neural._reader, cards = ([...r.body.children] as HTMLElement[]).filter(c => c.getClientRects().length)
    const boxes = cards.map(c => c.getBoundingClientRect())
    return { rows: getComputedStyle(r.body).gridAutoRows, spans: [...new Set(cards.map(c => getComputedStyle(c).gridRowEnd))],
      lefts: new Set(boxes.map(b => Math.round(b.left))).size, gaps: boxes.slice(1).map((b, i) => +(b.top - boxes[i].bottom).toFixed(2)),
      token: 3 * parseFloat(getComputedStyle(r.root).getPropertyValue('--section-gap')) }
  })
  expect(phone.gaps.length, 'Mount/Top shows its real sections').toBeGreaterThan(4)
  expect(phone.rows, 'no dashboard rows on a phone').toBe('auto')
  expect(phone.spans, 'no card spans rows on a phone').toEqual(['auto'])
  expect(phone.lefts, 'one column').toBe(1)
  for (const g of phone.gaps) expect(Math.abs(g - phone.token), `gap ${g} is the phone's ${phone.token}px token`).toBeLessThan(1)
})
