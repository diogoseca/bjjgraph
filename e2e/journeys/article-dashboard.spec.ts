import { test, expect, type Page } from '@playwright/test'
import { journey } from '../dsl'

// U55 b (owner, 2026-10-28): on desktop the article's sections are a bento dashboard. The owner's words:
// "dashboard looks better although it doesn't leave that 'available' space for the node to show, and it
// should. and also we want to show all content, not show it and only show it when the user clicks the
// section which should do nothing btw. three cols is great but sometimes 2 is better, and they dont need
// to be the same size".
//
// REAL CONTENT. The harness serves `{}` for dossier chunks (e2e/dsl.ts); this journey routes them through
// to the built tree, so Mount/Top reads with its film, a long prose Overview and
// short lists (Essential principles, Prerequisites, Statistics). The page HTML is the served build's own.
// What the harness still does NOT serve: Google Fonts (an empty stylesheet) and YouTube thumbnails
// (aborted). Heights here are fallback-font heights, so every claim is RELATIVE: a tile against its own
// content, a gap against the token, an edge against the index, never an absolute height.
//
// U59 c (owner, 2026-10-28) governs the layout now: "there are two sections side by side always. Some sections
// can take two columns while the other one takes one ... The most important thing is for that dashboard,
// especially when it's viewed on desktop, to never only show one section full width." And the measure is kept
// readable "through some use of padding". So: every desktop row is two open sections in source order (2/3 + 1/3
// either way on three lanes, halves on two), an odd count can make ONE short trio on three lanes, the text sits in a
// centred ~46ch column inside each tile, the reader ends above the account pill, and opening Explore keeps the
// reader's place.
// U65 b (owner, 2026-10-29): every tile ends at its own content; the next row still follows the
// tallest tile plus the token gap. The map may show in the unused space, which remains reader input.
// U65 note: game pages retire the duplicate Videos credits tile; their film stays in the stage.
// Principles and Learning retain the Videos tile and its player.
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
// DASH-R4 (the independent review of R3, scratch/review-323): each control below breaks one claim added for it.
//   u59r4-anchor-arrival   the stage holds still when Explore opens or the window turns at the arrival (no gate)
//   u59r4-reopen-ungated   putting the article away and back keeps the line (the anchor without its gate)
//   u59r4-table-third      a wide table takes two thirds and shows every column (it counted as short text)
//   u59r4-table-measured   a wide table takes two thirds and shows every column (its article kept the 46ch column)
//   u59r4-table-margin     a tablet table fits inside the padded tile (the static table margin restored)
//   u59r4-player-third     a reference page's player takes two thirds and the tile's width (it counted as short)
//   u59r4-trio-unsized     a row of three only holds sections under 1,500 characters (no size threshold)
//   u59r4-thirds-below     no thirds below three lanes (the odd count made a row of three at 768)
//   u59r4-lanes-1366       three lanes from a 1,150px grid: 1366 is halves (the old 1,100px threshold)
//   u59r4-press-full       an article arriving under a held press still pairs (the default span the full width)
//   u65-tiles-stretched    each tile ends at its content (stretch restored)
//   u65-watch-tile-restored game articles omit the duplicate Videos credits tile (its contents restored)
//   u65-film-index-throws  the surviving film's index control works without an exception (null focus dereferenced)
//   u65-gap-passes-map     space below a short tile remains reader input (the grid passes pointer events through)
//   u59r4-phone-measure    the phone keeps a readable line (prose restricted to 120px)
// Opening-camera's u59r4-drag-on-reader separately rejects a drag whose starting target is not the canvas.
const READY = '[data-reader][data-reader-ready="true"]'

async function boot(page: Page, width: number, height: number, path = '/Positions/Mount/Top') {
  await page.setViewportSize({ width, height })
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
  const j = journey(page)
  await j.boot(path, { beforeNavigate: async () => {
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
    pill: box(a.acctChipRef.current), open: cards.length,
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
      // DASH-R4: and sideways. A table is display:block with overflow-x:auto, so a too-narrow tile hides its last
      // columns behind a sideways scroll (the review found 208-229px hidden on all 13 position hubs). The film's clip
      // row (.ng-cliprow) is a deck that scrolls sideways by design, with its own chevrons, as on dev.
      const clippedX = [c, c.lastElementChild!, ...c.lastElementChild!.querySelectorAll('*')].filter(e => {
        if (!e.textContent!.trim() || e.matches('.ng-cliprow')) return false
        return getComputedStyle(e).overflowX !== 'visible' && e.scrollWidth > e.clientWidth + 1
      }).map(e => e.tagName.toLowerCase() + '.' + [...e.classList].join('.') + ' ' + (e.scrollWidth - e.clientWidth) + 'px')
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
      // The owner's rule as the review phrased it, not the packer's code: a table wider than three columns, or a
      // reference page's player, is too big for a third.
      const long = !!body.querySelector('tr>:nth-child(4)') || c.dataset.sectionType === 'videos' && /^\/(Principles|Learning|Systems)\//.test(location.pathname)
      return { type: c.dataset.sectionType!, box: box(c), content: box(body), head: box(c.firstElementChild!), len: body.textContent!.length, long,
        inner, articles, lines, media: body.querySelector('[data-reader-media-slot]') ? box(body.querySelector('[data-reader-media-slot]')!) : null,
        maxHeight: s.maxHeight, mask: s.maskImage || s.getPropertyValue('-webkit-mask-image'), overflowY: s.overflowY, clipped, clippedX }
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
  expect(d.tiles.length, d.path + ' shows its real sections').toBeGreaterThan(3)
  for (const t of d.tiles) {
    // No cap, no fade, no "click to expand": the tile ends at or below its own content.
    expect(t.maxHeight, t.type + ' is not capped').toBe('none')
    expect(t.mask, t.type + ' is not faded').toBe('none')
    expect(t.box.bottom, t.type + ' shows its whole content').toBeGreaterThanOrEqual(t.content.bottom - 1)
    expect(t.box.bottom - t.content.bottom, t.type + ' ends at its own content (U65 b)').toBeLessThanOrEqual(1)
    expect(t.clipped, t.type + ': nothing inside the tile clips its text').toEqual([])
    expect(t.clippedX, t.type + ': nothing inside the tile hides text sideways').toEqual([])
    expect(t.head.top, t.type + ' starts with its own title').toBeGreaterThanOrEqual(t.box.top - 1)
  }
  for (const [i, t] of d.tiles.entries()) for (const o of d.tiles.slice(0, i)) {
    expect(overlaps(t.box, o.box) && t.box.top < o.box.bottom - 1 && o.box.top < t.box.bottom - 1, `${t.type} and ${o.type} never overlap`).toBe(false)
  }
  const rows = rowsOf(d)
  for (const row of rows) {
    // U65 b: a row is as tall as its taller content; each individual tile ends at its own content.
    const names = row.map(t => t.type).join('+')
    expect(Math.min(...row.map(t => t.box.bottom - t.content.bottom)), `the row ${names} ends at its tallest content`).toBeLessThanOrEqual(1)
  }
  // Each gap between rows is the token.
  expect(rows.length, 'the tiles make rows').toBeGreaterThan(1)
  for (const [i, row] of rows.slice(1).entries()) {
    const g = row[0].box.top - Math.max(...rows[i].map(t => t.box.bottom))
    expect(Math.abs(g - d.gap), `gap ${g} is the ${d.gap}px token`).toBeLessThan(1)
  }
}

// U59 c: rows of two (or one row of three thirds), in source order, each row filling the grid. DASH-R4: thirds only
// on three lanes and only for sections under 1,500 characters; otherwise an odd count ends the article with one
// section beside an empty lane (two thirds, or a half), never across the width.
function pairs(d: Dash, lanes: number) {
  // A tile's span out of 12 columns, from its width and the column gap measured between two tiles of a row.
  const rows = rowsOf(d), two = rows.find(r => r.length > 1)!, g = two[1].box.left - two[0].box.right
  const span = (t: Dash['tiles'][number]) => Math.round(12 * (t.box.width + g) / (d.body.width + g))
  const size = (t: Dash['tiles'][number]) => t.long ? Infinity : t.len
  expect(rows.flat().map(t => t.type), 'the eye reads the tiles in source order').toEqual(d.dom)
  const trios = rows.filter(r => r.length === 3), lone = rows.filter(r => r.length === 1)
  for (const [i, row] of rows.entries()) {
    const names = row.map(t => t.type).join('+')
    expect(row.length, `no row holds more than three (${names})`).toBeLessThanOrEqual(3)
    if (row.length === 1) {
      expect(i, `a section alone ends the article (${names})`).toBe(rows.length - 1)
      expect(span(row[0]), `the last section alone takes ${lanes === 3 ? 'two thirds' : 'a half'}, never the width (${names})`).toBe(lanes === 3 ? 8 : 6)
      continue
    }
    expect(row.at(-1)!.box.right - row[0].box.left, `the row ${names} fills the grid`).toBeCloseTo(d.body.width, 0)
    if (row.length === 3) {
      expect(lanes, `a row of three only on three lanes (${names})`).toBe(3)
      expect(row.map(span), `a row of three is three thirds (${names})`).toEqual([4, 4, 4])
      for (const t of row) expect(size(t), `${t.type} in a row of three is under 1,500 characters`).toBeLessThan(1500)
    } else if (lanes === 2) expect(row.map(span), `two lanes are halves (${names})`).toEqual([6, 6])
    else {
      expect(row.map(span).sort(), `three lanes pair two thirds with one (${names})`).toEqual([4, 8])
      // The longer text takes two thirds. Only where the lengths differ clearly: the film's own text arrives late.
      const [x, y] = row
      if (Math.max(size(x), size(y)) > 1.2 * Math.min(size(x), size(y))) expect(span(size(x) > size(y) ? x : y), `of ${names}, the longer takes two thirds`).toBe(8)
    }
  }
  // A wide table or a reference page's player is never in a third.
  for (const t of d.tiles) if (t.long) expect(span(t), `${t.type} holds a wide table or the page's player: never a third`).toBeGreaterThan(4)
  expect(trios.length + lone.length, `${d.open} open sections leave ${d.open % 2} odd row`).toBe(d.open % 2)
  if (lanes < 3) expect(trios.length, 'no thirds below three lanes').toBe(0)
  // A row of three is the run (starting on a row) whose longest section is shortest.
  if (trios.length) {
    const start = d.dom.indexOf(trios[0][0].type), longest = (i: number) => Math.max(...d.tiles.slice(i, i + 3).map(size))
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
    if (t.lines.length && !t.long) expect(Math.max(...t.lines), `${t.type}: no line runs past 80 characters`).toBeLessThanOrEqual(80)
    // Mount/Top's media slot is empty (its film keeps the game's home); a Principles page fills it (below).
    if (t.media?.height) expect(t.media.width, `${t.type}: the media keeps the tile's width`).toBeCloseTo(t.inner.right - t.inner.left, 0)
  }
  if (lanes < 3) return
  const wide = d.tiles.filter(t => t.articles.some(a => a.left > t.inner.left + 20)).flatMap(t => t.lines)
  expect(wide.length, 'premise: a two-thirds tile is wider than its column').toBeGreaterThan(20)
  expect(median(wide), 'a wide tile reads inside the measure band').toBeGreaterThanOrEqual(45)
  expect(median(wide), 'a wide tile reads inside the measure band').toBeLessThanOrEqual(75)
}

for (const [width, height, lanes] of [[1440, 900, 3], [1920, 1080, 3], [1366, 768, 2], [1152, 900, 2]] as const) {
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
  // U65 removes the visible Videos tile, retaining its hidden preference control. Start at an actual
  // visible tile and traverse the rendered focus targets, rather than a fixed number of stops.
  const targets = '[data-reader-body] :is(a[href],button):visible'
  const stops = await page.locator(targets).count()
  await page.locator(targets).first().focus()
  const seen: number[] = []
  for (let i = 0; i < stops; i++) {
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

// The DSL boot pre-completes the White track, so reading can mint an ambient patch toast. It expires
// after 4.8s; wait until it clears instead of racing its expiry between a visibility check and a mouse click.
async function openExplore(page: Page, j: ReturnType<typeof journey>) {
  await expect(page.locator('[data-reward-close]')).toBeHidden({ timeout: 15000 })
  await j.clickByMouse('.ng-logo', 'the logo opens the pane (Explore)')
  for (let i = 0; i < 24; i++) await j.advance(60)
  await j.readerLayoutSettled()
}
const stage = (page: Page) => page.evaluate(() => {
  const a = (window as any).__neural
  return { scrollTop: Math.round(a._reader.root.scrollTop), moves: Math.round(a.optionsRef.current.getBoundingClientRect().top), question: Math.round(a._landEl.getBoundingClientRect().top) }
})

// DASH-R4 (review finding 9a): the line is picked by GEOMETRY, not by the reader's own anchor rule: the first text
// line at or below the reader's top in the grid's first lane, found by walking a point 30px inside the grid's left
// edge down from the reader's top. At two widths (1152 loses the index as the pane opens) and two depths.
for (const [width, height] of [[1440, 900], [1152, 900]] as const) for (const depth of [0.3, 0.6]) {
  test(`U59 c: at ${width}x${height} opening Explore keeps the line at the reader's top (${depth * 100}% down)`, async ({ page }) => {
    const j = await boot(page, width, height)
    // The pane slides open over many frames; each changes the grid's width, so motion is on here.
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    const before = await page.locator(READY).evaluate((e, depth) => {
      const r = (window as any).__neural._reader
      e.scrollTop = Math.round((e.scrollHeight - e.clientHeight) * depth)
      return new Promise<{ top: number | null, grid: number, text: string }>(done => requestAnimationFrame(() => requestAnimationFrame(() => {
        const top = e.getBoundingClientRect().top, x = r.body.getBoundingClientRect().left + 30
        let line: Element | null = null
        for (let y = top + 1; y < top + 400 && !line; y += 3) {
          const hit = document.elementFromPoint(x, y)?.closest('p, li')
          if (hit && hit.getBoundingClientRect().top >= top - 0.5) line = hit
        }
        line?.setAttribute('data-test-place', '')
        done({ top: line ? line.getBoundingClientRect().top : null, grid: Math.round(r.body.getBoundingClientRect().width), text: (line?.textContent || '').trim().slice(0, 40) })
      })))
    }, depth)
    expect(before.top, 'premise: a text line starts at the reader\'s top in the first lane').not.toBeNull()
    await openExplore(page, j)
    const after = await page.locator(READY).evaluate(e => ({
      top: e.querySelector('[data-test-place]')!.getBoundingClientRect().top,
      grid: Math.round((window as any).__neural._reader.body.getBoundingClientRect().width) }))
    expect(after.grid, 'premise: opening Explore changes the grid\'s width').not.toBe(before.grid)
    expect(Math.abs(after.top - before.top!), `"${before.text}" keeps its place (${before.top} -> ${after.top})`).toBeLessThanOrEqual(8)
  })
}

// DASH-R4 (review finding 1): at the arrival the stage (node band, Moves, the question) owns the reader's top. Opening
// Explore at 1152 flips the film from beside the question to above it and shortens the stage; on R3 the place anchor
// then scrolled the reader 53px and pulled the Moves row over the current node. Dev holds still; so must this.
test('U59 c: at 1152x900 opening Explore at the arrival moves nothing on the stage', async ({ page }) => {
  const j = await boot(page, 1152, 900)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  const before = await stage(page), grid = await page.evaluate(() => Math.round((window as any).__neural._reader.body.getBoundingClientRect().width))
  expect(before.scrollTop, 'premise: the reader is at its top').toBe(0)
  await openExplore(page, j)
  expect(await page.evaluate(() => Math.round((window as any).__neural._reader.body.getBoundingClientRect().width)), 'premise: the grid changed').not.toBe(grid)
  expect(await stage(page), 'the reader stays at its top, and the Moves row and the question where they were').toEqual(before)
})

test('U59 c: a desktop window narrowed at the arrival (1440 to 900) leaves the reader at its top', async ({ page }) => {
  const j = await boot(page, 1440, 900)
  const before = await stage(page)
  expect(before.scrollTop, 'premise: the reader is at its top').toBe(0)
  await page.setViewportSize({ width: 900, height: 900 })
  for (let i = 0; i < 6; i++) await j.advance(100)
  await j.readerLayoutSettled()
  expect(await stage(page), 'the reader stays at its top, and the Moves row and the question where they were').toEqual(before)
})

test('U59 c: a phone turned to landscape and back (390x844, 844x390, 390x844) leaves the reader at its top', async ({ page }) => {
  const j = await boot(page, 390, 844)
  const before = await stage(page)
  expect(before.scrollTop, 'premise: the reader is at its top').toBe(0)
  for (const [width, height] of [[844, 390], [390, 844]]) {
    await page.setViewportSize({ width, height })
    for (let i = 0; i < 6; i++) await j.advance(100)
    await j.readerLayoutSettled()
    expect((await stage(page)).scrollTop, `at ${width}x${height} the reader stays at its top`).toBe(0)
  }
  expect(await stage(page), 'back upright, the Moves row and the question are where they were').toEqual(before)
})

// DASH-R4 (review finding 2): the article's own close and the shelf's Book button. sync() restores the reader's scroll
// into the reopened article; on R3 the anchor then held whatever line the never-shown narrow grid had put at the top,
// 113-293px off. The line under a fixed point must come back to the same place, as on dev.
for (const offset of [40, 300]) {
  test(`U59 c: at 1440x900 putting the article away and back (its close ${offset}px below the top) returns the same line`, async ({ page }) => {
    const j = await boot(page, 1440, 900)
    await page.locator(READY).evaluate((e, off) => {
      const x = e.querySelector('[data-reader-close]')!
      e.scrollTop += x.getBoundingClientRect().top - e.getBoundingClientRect().top - off
    }, offset)
    await j.readerLayoutSettled()
    const mark = () => page.evaluate(() => {
      const r = (window as any).__neural._reader, rt = r.root.getBoundingClientRect()
      const w = window as any
      if (!w.__testLine) {
        // At the 300px depth a point 140px below the reader top is still above the article.
        // Select a rendered paragraph first, then retain the character under that fixed point.
        const paragraph = ([...r.body.querySelectorAll('p,li')] as HTMLElement[]).find(e => {
          const b = e.getBoundingClientRect(); return b.width > 0 && b.top >= rt.top && b.top + 20 < rt.bottom
        })
        if (!paragraph) throw Error('premise: a paragraph is visible in the article')
        const b = paragraph.getBoundingClientRect(), pos = (document as any).caretRangeFromPoint(b.left + 10, b.top + 12), range = document.createRange()
        if (!pos || pos.startContainer.nodeType !== Node.TEXT_NODE || !r.body.contains(pos.startContainer)) throw Error('premise: the point names article text')
        range.setStart(pos.startContainer, pos.startOffset); range.setEnd(pos.startContainer, Math.min((pos.startContainer as Text).length ?? 0, pos.startOffset + 1))
        w.__testLine = range
      }
      const b = w.__testLine.getBoundingClientRect()
      return { scrollTop: Math.round(r.root.scrollTop), line: Math.round(b.top), rendered: !!w.__testLine.toString() && b.height > 0 && b.top >= rt.top && b.bottom <= rt.bottom }
    })
    const before = await mark()
    expect(before.rendered, 'premise: the saved range is visible article text, not an empty caret on the map').toBe(true)
    await j.clickByMouse('[data-reader-close]', 'the article\'s own close')
    for (let i = 0; i < 6; i++) await j.advance(100)
    expect(await page.evaluate(() => (window as any).__neural._reader.articleEl.hidden), 'premise: the article is put away').toBe(true)
    await j.clickByMouse('[data-reader-part="book"]', 'the shelf\'s Book button')
    for (let i = 0; i < 6; i++) await j.advance(100)
    await j.readerLayoutSettled()
    expect(await mark(), 'the same line is back under the same point').toEqual(before)
  })
}

// DASH-R4 (review finding 3): the 6-column Top/Bottom comparison on every position hub needs ~520-566px; in a third
// 208-229px of it hid behind a sideways scroll on all 13 hubs.
test('U59 c: at 1440x900 a position hub\'s wide Top/Bottom table takes two thirds and shows every column', async ({ page }) => {
  await boot(page, 1440, 900, '/Positions/Mount')
  const d = await dashboard(page), table = d.tiles.find(t => t.type === 'role-comparison')
  expect(table, 'premise: the hub carries its Top/Bottom comparison').toBeTruthy()
  expect(table!.long, 'premise: its table has more than three columns').toBe(true)
  pairs(d, 3)
  wholeContent(d)
  measure(d, 3)
})

// DASH-R4 (review finding 4): a reference page's player lives in its Videos tile; in a third it shrank 862 -> 337px
// on all 62 Principles pages that embed one.
test('U59 c: at 1440x900 a Principles page\'s player takes two thirds and the tile\'s width', async ({ page }) => {
  await boot(page, 1440, 900, '/Principles/Frames')
  const d = await dashboard(page), videos = d.tiles.find(t => t.type === 'videos')
  expect(videos?.media?.height, 'premise: the page\'s player fills its Videos slot').toBeGreaterThan(100)
  pairs(d, 3)
  wholeContent(d)
  measure(d, 3)
})

test('U59 c: an odd article at 1440x900 only uses a trio when its sections are short', async ({ page }) => {
  await boot(page, 1440, 900, '/Transitions/Knee-Slice-Pass/Attacker')
  const d = await dashboard(page)
  expect(d.open % 2, 'premise: the article has an odd number of open tiles').toBe(1)
  pairs(d, 3)
  wholeContent(d)
})

test('U65: game pages have one film in the stage and no duplicate Videos credits tile', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  const j = await boot(page, 1440, 900)
  const d = await dashboard(page)
  expect(d.dom, 'the article grid has no Videos tile').not.toContain('videos')
  await expect(page.locator('[data-reader-body]')).not.toContainText('Watch on YouTube')
  await expect(page.locator('[data-land-film]')).toHaveCount(1)
  await expect(page.locator('[data-land-media-slot] [data-land-film]')).toBeVisible()
  const close = page.locator('[data-film-close]')
  await close.scrollIntoViewIfNeeded(); await j.readerLayoutSettled()
  await j.clickByMouse('[data-film-close]', 'the surviving film closes with its own control')
  await expect(page.locator('[data-land-film]')).toBeHidden()
  await j.clickByMouse('[data-toc-type=videos] a', 'the existing Videos index preference reopens the film')
  await expect(page.locator('[data-land-media-slot] [data-land-film]')).toBeVisible()
  expect((await dashboard(page)).dom).not.toContain('videos')
  expect(errors, 'the surviving film and its index control do not throw').toEqual([])
})

test('U65 b: the space below a short tile remains reader input', async ({ page }) => {
  const j = await boot(page, 1440, 900, '/Positions/Half-Guard')
  const d = await dashboard(page), row = rowsOf(d).find(r => r.length > 1 && Math.max(...r.map(t => t.box.bottom)) - Math.min(...r.map(t => t.box.bottom)) > 100)!
  expect(row, 'premise: a row contains tiles of different heights').toBeTruthy()
  const short = row.reduce((a, b) => a.box.bottom < b.box.bottom ? a : b)
  await page.locator(READY).evaluate((e, y) => { e.scrollTop += y - e.getBoundingClientRect().top - 100 }, short.box.bottom)
  await j.readerLayoutSettled()
  const point = await page.locator(`[data-reader-body]>[data-section-type="${short.type}"]`).evaluate(e => {
    const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.bottom + 30 }
  })
  expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.matches('[data-reader-body]'), point), 'the visible map below a short tile is covered by the reader grid for input').toBe(true)
  await page.mouse.click(point.x, point.y)
  expect(await page.evaluate(() => ({ paused: (window as any).__neural.paused, reading: (window as any).__neural._reader.interacting, dragging: !!(window as any).__neural.dragging }))).toEqual({ paused: true, reading: true, dragging: false })
})

// DASH-R4 (review finding 5; the owner's rule as DASH-R3 briefed it): below the three-lane width, halves; no thirds.
for (const [width, height] of [[768, 1024], [844, 390]] as const) {
  test(`U59 c: at ${width}x${height} (no index) the sections pair in halves, never thirds`, async ({ page }) => {
    // U65 removes Mount's Videos tile, making that article even. Knee Slice keeps the odd-count
    // premise that distinguishes halves from the retired parity-driven row of thirds.
    await boot(page, width, height, '/Transitions/Knee-Slice-Pass/Attacker')
    const d = await dashboard(page)
    expect(d.open % 2, 'premise: an odd article can expose the retired third-lane rule').toBe(1)
    expect(d.toc, 'premise: the index does not show at this size').toBeNull()
    pairs(d, 2)
    wholeContent(d)
  })
}

// DASH-R4 (review finding 6): layoutNow waits while a press is held, and the spans are its writes. An article that
// arrives under a held press showed every tile across the full width until release; the default is now a half.
test('U59 c: at 1440x900 an article that arrives under a held press still pairs its sections', async ({ page }) => {
  const j = await boot(page, 1440, 900)
  const at = await page.evaluate(() => { const q = (window as any).__neural._landEl.getBoundingClientRect(); return { x: q.left + 30, y: q.top + q.height / 2 } })
  await page.mouse.move(at.x, at.y); await page.mouse.down()
  expect(await page.evaluate(() => !!(window as any).__neural._readerPress), 'premise: the press is held').toBe(true)
  await page.evaluate(() => (window as any).__neural._readArticle('/Transitions/Knee-Slice-Pass/Attacker', true, true))
  await page.waitForFunction(() => { const r = (window as any).__neural._reader; return r.path === '/Transitions/Knee-Slice-Pass/Attacker' && r.root.dataset.readerReady === 'true' })
  await page.evaluate(() => new Promise(requestAnimationFrame))
  const during = await page.evaluate(() => {
    const r = (window as any).__neural._reader, g = r.body.getBoundingClientRect().width
    const cards = ([...r.body.children] as HTMLElement[]).filter(c => c.getClientRects().length)
    return { n: cards.length, full: cards.filter(c => c.getBoundingClientRect().width > g - 2).map(c => c.dataset.sectionType), pressed: !!(window as any).__neural._readerPress }
  })
  expect(during.pressed, 'premise: still pressed while the article arrived').toBe(true)
  expect(during.n, 'premise: the new article shows its sections').toBeGreaterThan(5)
  expect(during.full, 'no section sits alone across the width under the press').toEqual([])
  await page.mouse.up()
  await j.readerLayoutSettled()
  pairs(await dashboard(page), 3)
})

test('@curated U55 b: at 1440x900 a click on a section tile does nothing; its links and its close still work', async ({ page }) => {
  const j = await boot(page, 1440, 900)
  const tile = '[data-reader-body]>[data-section-type=principles]'
  await page.locator(tile).evaluate(e => { const root = e.closest('[data-reader]')!; root.scrollTop += e.getBoundingClientRect().top - root.getBoundingClientRect().top - 24 })
  await j.readerLayoutSettled()
  // The reader's first press anywhere is reading: it pauses the game and declines the asking question,
  // which may restyle the stage above the tiles. Pay that once in the grid's own gap, beside the tile.
  const geometry = await dashboard(page), at = geometry.tiles.find(t => t.type === 'principles')!
  const gap = { x: at.box.left > geometry.body.left + 2 ? at.box.left - 6 : at.box.right + 6, y: at.box.top + 40 }
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
  // Its own close still closes it, and the index brings it back. The ambient reward can overlap the
  // right lane's close; let its ordinary lifetime end before testing that close's mouse target.
  await expect(page.locator('[data-reward-close]')).toBeHidden({ timeout: 15000 })
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
    const boxes = cards.map(c => c.getBoundingClientRect()), body = r.body.getBoundingClientRect()
    // DASH-R4 (review finding 9c): the masonry-era checks (auto rows, no row spans) could no longer fail. These can:
    // every card is the whole column, and every article fills its card's padding (the 46ch measure is wider here).
    const articles = cards.flatMap(c => { const b = c.lastElementChild as HTMLElement, s = getComputedStyle(b), q = b.getBoundingClientRect()
      return [...b.querySelectorAll(':scope>article')].map(a => Math.round(q.width - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight) - a.getBoundingClientRect().width)) })
    return { widths: [...new Set(boxes.map(b => Math.round(body.width - b.width)))], articles: [...new Set(articles)],
      lefts: new Set(boxes.map(b => Math.round(b.left))).size, gaps: boxes.slice(1).map((b, i) => +(b.top - boxes[i].bottom).toFixed(2)),
      token: 3 * parseFloat(getComputedStyle(r.root).getPropertyValue('--section-gap')) }
  })
  expect(phone.gaps.length, 'Mount/Top shows its real sections').toBeGreaterThan(4)
  expect(phone.widths, 'every card is the whole column').toEqual([0])
  expect(phone.articles, 'every article fills its card (no measure on a phone)').toEqual([0])
  expect(phone.lefts, 'one column').toBe(1)
  for (const g of phone.gaps) expect(Math.abs(g - phone.token), `gap ${g} is the phone's ${phone.token}px token`).toBeLessThan(1)
})
