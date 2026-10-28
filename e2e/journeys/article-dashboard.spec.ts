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
// U59 c (owner, 2026-10-28) governs the layout now: "there are two sections side by side always. Some sections
// can take two columns while the other one takes one ... The most important thing is for that dashboard,
// especially when it's viewed on desktop, to never only show one section full width." And the measure is kept
// readable "through some use of padding". So: every desktop row is two open sections in source order (2/3 + 1/3
// either way on three lanes, halves on two), an odd count makes ONE row of three thirds, the text sits in a
// centred ~46ch column inside each tile, the reader ends above the account pill, and opening Explore keeps the
// reader's place.
//
// Claims, each with its control in tests/artifacts/article_sections_mutants.mjs:
//   u55-tile-capped        every tile shows its whole content (a 520px cap, the owner-rejected mock)
//   u59-rows-padded        each row ends at its tallest content (100px padded under every tile)
//   u55r-body-capped       nothing inside a tile clips its text (the body capped at 240px)
//   u55r-para-clamp        nothing inside a tile clips its text (paragraphs clamped to two lines)
//   u59-row-alone          every row holds two sections, or three thirds (a long section alone across the width)
//   u59-pair-flipped       of a pair, the longer text takes two thirds (the shorter one takes them)
//   u59-trio-last          the row of three is the run whose longest section is shortest (always the last three)
//   u59-order-moved        the eye reads the tiles in source order (a late section moved first)
//   u59-tab-rtl            Tab walks the tiles in the order the eye does (the rows laid right to left)
//   u59-measure-unset      prose lines keep a readable measure (the 46ch column removed)
//   u59-pill-covers        the reader ends above the account pill (its reserve measured over the old column only)
//   u59-place-lost         opening Explore keeps the reader's place (the anchor's restore removed)
//   u55-tile-click-toggles a section tile click does nothing (a click on the tile toggles it)
//   u55r-link-swallowed    a link inside a tile still opens its page (the tile swallows the click)
//   u55-band-covered       the node band stays clear (the article pulled up over the game stage)
//   u55-width-unused       the dashboard uses the width (the grid keeps the centred column)
//   u59-phone-pairs        the phone keeps its stacked flow (the desktop spans applied at 390px)
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
    W: innerWidth, band: r.nodeBand, scrollTop: r.root.scrollTop, path: location.pathname, root: box(r.root),
    pill: box(a.acctChipRef.current), open: r.sections.filter((s: any) => !s.body.hidden).length,
    toc: r.contents.hidden ? null : box(r.contents), body: box(r.body), gap: 4 * parseFloat(getComputedStyle(r.root).getPropertyValue('--section-gap')),
    dom: cards.map(c => c.dataset.sectionType!),
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
      // The measure: each article column inside the tile's padding, and the characters on every full line of its
      // paragraphs and list entries (all but each block's last line), counted per glyph from the rendered text.
      const body = c.lastElementChild as HTMLElement, bs = getComputedStyle(body)
      const inner = { left: box(body).left + parseFloat(bs.paddingLeft), right: box(body).right - parseFloat(bs.paddingRight) }
      const articles = [...body.querySelectorAll(':scope>article')].map(e => box(e))
      const lines: number[] = []
      for (const e of body.querySelectorAll('p, li')) {
        if (e.querySelector('p, li')) continue
        const walk = document.createTreeWalker(e, NodeFilter.SHOW_TEXT), tops = new Map<number, number>()
        for (let t: Text | null; (t = walk.nextNode() as Text | null);) for (let i = 0; i < t.length; i++) {
          const range = document.createRange(); range.setStart(t, i); range.setEnd(t, i + 1)
          const q = range.getBoundingClientRect(); if (!q.height) continue
          tops.set(Math.round(q.top), (tops.get(Math.round(q.top)) || 0) + 1)
        }
        const counts = [...tops.entries()].sort((x, y) => x[0] - y[0]).map(x => x[1])
        lines.push(...counts.slice(0, -1))
      }
      return { type: c.dataset.sectionType!, box: box(c), content: box(body), head: box(c.firstElementChild!), len: body.textContent!.length,
        inner, articles, lines, media: body.querySelector('[data-reader-media-slot]') ? box(body.querySelector('[data-reader-media-slot]')!) : null,
        maxHeight: s.maxHeight, mask: s.maskImage || s.getPropertyValue('-webkit-mask-image'), overflowY: s.overflowY, clipped }
    }),
  }
})
type Dash = Awaited<ReturnType<typeof dashboard>>
const overlaps = (p: DOMRect, q: DOMRect) => p.left < q.right - 1 && q.left < p.right - 1

// Rows: tiles that share a top. Visual order is row by row, left to right.
const rowsOf = (d: Dash) => {
  const rows: Dash['tiles'][] = []
  for (const t of d.tiles) { const row = rows.find(r => Math.abs(r[0].box.top - t.box.top) < 1.5); if (row) row.push(t); else rows.push([t]) }
  return rows.sort((x, y) => x[0].box.top - y[0].box.top).map(r => r.sort((x, y) => x.box.left - y.box.left))
}
const median = (xs: number[]) => [...xs].sort((x, y) => x - y)[xs.length >> 1]

function wholeContent(d: Dash) {
  expect(d.tiles.length, 'Mount/Top shows its real sections').toBeGreaterThan(5)
  for (const t of d.tiles) {
    // No cap, no fade, no "click to expand": the tile ends at or below its own content.
    expect(t.maxHeight, t.type + ' is not capped').toBe('none')
    expect(t.mask, t.type + ' is not faded').toBe('none')
    expect(t.box.bottom, t.type + ' shows its whole content').toBeGreaterThanOrEqual(t.content.bottom - 1)
    expect(t.clipped, t.type + ': nothing inside the tile clips its text').toEqual([])
    expect(t.head.top, t.type + ' starts with its own title').toBeGreaterThanOrEqual(t.box.top - 1)
  }
  for (const [i, t] of d.tiles.entries()) for (const o of d.tiles.slice(0, i)) {
    expect(overlaps(t.box, o.box) && t.box.top < o.box.bottom - 1 && o.box.top < t.box.bottom - 1, `${t.type} and ${o.type} never overlap`).toBe(false)
  }
  const rows = rowsOf(d)
  for (const row of rows) {
    // A row is as tall as its taller content: the shorter tile stretches beside it, and nothing pads the row.
    const names = row.map(t => t.type).join('+')
    for (const t of row) expect(t.box.bottom, `${t.type} ends with its row (${names})`).toBeCloseTo(row[0].box.bottom, 0)
    expect(Math.min(...row.map(t => t.box.bottom - t.content.bottom)), `the row ${names} ends at its tallest content`).toBeLessThanOrEqual(1)
  }
  // Each gap between rows is the token.
  expect(rows.length, 'the tiles make rows').toBeGreaterThan(2)
  for (const [i, row] of rows.slice(1).entries()) {
    const g = row[0].box.top - rows[i][0].box.bottom
    expect(Math.abs(g - d.gap), `gap ${g} is the ${d.gap}px token`).toBeLessThan(1)
  }
}

// U59 c: rows of two (or one row of three thirds), in source order, each row filling the grid.
function pairs(d: Dash, lanes: number) {
  // A tile's span out of 12 columns, from its width and the column gap measured between two tiles of a row.
  const rows = rowsOf(d), g = rows.find(r => r.length > 1)![1].box.left - rows.find(r => r.length > 1)![0].box.right
  const span = (t: Dash['tiles'][number]) => Math.round(12 * (t.box.width + g) / (d.body.width + g))
  expect(rows.flat().map(t => t.type), 'the eye reads the tiles in source order').toEqual(d.dom)
  const trios = rows.filter(r => r.length === 3)
  for (const row of rows) {
    const names = row.map(t => t.type).join('+')
    expect(row.length, `every row holds two sections, or three thirds (${names})`).toBeGreaterThanOrEqual(2)
    expect(row.length, `no row holds more than three (${names})`).toBeLessThanOrEqual(3)
    expect(row.at(-1)!.box.right - row[0].box.left, `the row ${names} fills the grid`).toBeCloseTo(d.body.width, 0)
    if (row.length === 3) expect(row.map(span), `a row of three is three thirds (${names})`).toEqual([4, 4, 4])
    else if (lanes === 2) expect(row.map(span), `two lanes are halves (${names})`).toEqual([6, 6])
    else {
      expect(row.map(span).sort(), `three lanes pair two thirds with one (${names})`).toEqual([4, 8])
      // The longer text takes two thirds. Only where the lengths differ clearly: the film's own text arrives late.
      const [x, y] = row
      if (Math.max(x.len, y.len) > 1.2 * Math.min(x.len, y.len)) expect(span(x.len > y.len ? x : y), `of ${names}, the longer text takes two thirds`).toBe(8)
    }
  }
  // An odd count makes exactly one row of three: the run (starting on a row) whose longest section is shortest.
  expect(trios.length, `${d.open} open sections make ${d.open % 2} row of three`).toBe(d.open % 2)
  if (trios.length) {
    const start = d.dom.indexOf(trios[0][0].type), longest = (i: number) => Math.max(...d.tiles.slice(i, i + 3).map(t => t.len))
    for (let i = 0; i + 3 <= d.tiles.length; i += 2) expect(longest(start), `the row of three is the shortest run (vs ${d.dom.slice(i, i + 3).join('+')})`).toBeLessThanOrEqual(longest(i) * 1.05)
  }
}

// U59 c: a readable measure. Each article column is centred inside its tile's padding, and no paragraph or list
// entry runs past 80 characters a line (WCAG 1.4.8). On three lanes a two-thirds tile is wider than the column, and
// its lines sit inside a 45-75 character band around the median. The band is wide because the fonts here are the
// fallbacks: 46ch of them measures a 51-52 median, where the real fonts measure 65-68 on real pages
// (scratch/article-dashboard/r3/probe-r3.cjs). Uncapped, the same tiles run ~86-95.
function measure(d: Dash, lanes: number) {
  for (const t of d.tiles) {
    for (const a of t.articles) {
      expect(a.right, `${t.type}: its column stays inside the tile's padding`).toBeLessThanOrEqual(t.inner.right + 1)
      expect(Math.abs((a.left - t.inner.left) - (t.inner.right - a.right)), `${t.type}: its column is centred in the tile`).toBeLessThan(1.5)
    }
    if (t.lines.length) expect(Math.max(...t.lines), `${t.type}: no line runs past 80 characters`).toBeLessThanOrEqual(80)
    // NOT COVERED HERE: Mount/Top's media slot is empty in this harness (0x0, no film in it), so "a video keeps the
    // tile's width" is only structural (the slot sits outside the article column). Checked whenever a slot is filled.
    if (t.media?.height) expect(t.media.width, `${t.type}: the media keeps the tile's width`).toBeCloseTo(t.inner.right - t.inner.left, 0)
  }
  if (lanes < 3) return
  const wide = d.tiles.filter(t => t.articles.some(a => a.left > t.inner.left + 20)).flatMap(t => t.lines)
  expect(wide.length, 'premise: a two-thirds tile is wider than its column').toBeGreaterThan(20)
  expect(median(wide), 'a wide tile reads inside the measure band').toBeGreaterThanOrEqual(45)
  expect(median(wide), 'a wide tile reads inside the measure band').toBeLessThanOrEqual(75)
}

for (const [width, height, lanes] of [[1440, 900, 3], [1920, 1080, 3], [1152, 900, 2]] as const) {
  test(`${width === 1440 ? '@curated ' : ''}U59 c: at ${width}x${height} the dashboard pairs its sections in ${lanes} lanes, shows every tile whole and keeps the node band clear`, async ({ page }) => {
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
    // The account pill sits in the corner over the grid's last lane; the reader ends above it, so nothing scrolls under it.
    expect(d.pill.left, 'premise: the pill is over the grid').toBeLessThan(d.body.right)
    expect(d.root.bottom, 'the reader ends above the account pill').toBeLessThanOrEqual(d.pill.top)
    pairs(d, lanes)
    wholeContent(d)
    measure(d, lanes)
    // Scrolled through the whole dashboard, every tile stays whole and the rows hold.
    await page.locator(READY).evaluate(e => { e.scrollTop = e.scrollHeight })
    await journey(page).readerLayoutSettled()
    const end = await dashboard(page)
    wholeContent(end)
    pairs(end, lanes)
  })
}

test('U59 c: at 1440x900 Tab walks the tiles in the order the eye reads them', async ({ page }) => {
  await boot(page, 1440, 900)
  await page.locator(READY).evaluate(e => (e.querySelector('[data-reader-body] a[href], [data-reader-body] button') as HTMLElement).focus())
  const seen: number[] = []
  for (let i = 0; i < 45; i++) {
    seen.push(await page.evaluate(() => {
      const r = (window as any).__neural._reader, box = (c: Element) => c.getBoundingClientRect()
      const visual = ([...r.body.children] as HTMLElement[]).filter(c => c.getClientRects().length).sort((x, y) => box(x).top - box(y).top || box(x).left - box(y).left)
      return visual.findIndex(c => c.contains(document.activeElement))
    }))
    await page.keyboard.press('Tab')
  }
  const inTiles = seen.filter(k => k >= 0)
  expect(new Set(inTiles).size, 'premise: Tab reaches several tiles').toBeGreaterThan(4)
  // Within a row left then right, and rows in order: the tile under focus never goes back, except a wrap to the top.
  for (const [i, k] of inTiles.slice(1).entries()) if (k !== 0) expect(k, `Tab stop ${i + 1} goes forward (${inTiles.join(',')})`).toBeGreaterThanOrEqual(inTiles[i])
})

test('U59 c: at 1440x900 opening Explore keeps the reader\'s place', async ({ page }) => {
  const j = await boot(page, 1440, 900)
  // The pane slides open over many frames; each changes the grid's width, so motion is on here.
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  const before = await page.locator(READY).evaluate(e => {
    const r = (window as any).__neural._reader
    e.scrollTop = Math.round((e.scrollHeight - e.clientHeight) * 0.45)
    return new Promise<{ top: number, lanes: string }>(done => requestAnimationFrame(() => requestAnimationFrame(() => {
      const top = e.getBoundingClientRect().top, first = [...r.body.querySelectorAll('p, li')].find((x: Element) => x.getBoundingClientRect().top >= top) as HTMLElement
      first.setAttribute('data-test-place', '')
      done({ top: first.getBoundingClientRect().top, lanes: [...new Set(([...r.body.children] as HTMLElement[]).filter(c => c.getClientRects().length).map(c => Math.round(c.getBoundingClientRect().width)))].join('/') })
    })))
  })
  // The DSL boot pre-completes the White track, so reading can mint a patch whose toast sits in the corner:
  // dismiss it the way a player would (camera-continuity.spec.ts does the same) before the logo opens the pane.
  if (await page.locator('[data-reward-close]').isVisible()) await j.clickByMouse('[data-reward-close]', 'dismiss the earned patch')
  await j.clickByMouse('.ng-logo', 'the logo opens the pane (Explore)')
  for (let i = 0; i < 24; i++) await j.advance(60)
  await j.readerLayoutSettled()
  const after = await page.locator(READY).evaluate(e => {
    const r = (window as any).__neural._reader, place = e.querySelector('[data-test-place]')!
    return { top: place.getBoundingClientRect().top, lanes: [...new Set(([...r.body.children] as HTMLElement[]).filter(c => c.getClientRects().length).map(c => Math.round(c.getBoundingClientRect().width)))].join('/'), rootTop: e.getBoundingClientRect().top }
  })
  expect(after.lanes, 'premise: opening Explore re-lays the tiles').not.toBe(before.lanes)
  expect(Math.abs(after.top - before.top), `the first text block at the reader's top keeps its place (${before.top} -> ${after.top})`).toBeLessThanOrEqual(8)
})

test('@curated U55 b: at 1440x900 a click on a section tile does nothing; its links and its close still work', async ({ page }) => {
  const j = await boot(page, 1440, 900)
  const tile = '[data-reader-body]>[data-section-type=principles]'
  await page.locator(tile).evaluate(e => { const root = e.closest('[data-reader]')!; root.scrollTop += e.getBoundingClientRect().top - root.getBoundingClientRect().top - 24 })
  await j.readerLayoutSettled()
  // The reader's first press anywhere is reading: it pauses the game and declines the asking question,
  // which may restyle the stage above the tiles. Pay that once in the grid's own gap, beside the tile.
  const at = (await dashboard(page)).tiles.find(t => t.type === 'principles')!, gap = { x: at.box.right + 6, y: at.box.top + 40 }
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
