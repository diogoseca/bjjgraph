import { expect, test, type Page } from '@playwright/test'
import { journey } from '../dsl'

// Sections are a view of the served article, not a second content pipeline.
// Source equality is checked independently of the semantic order. Integrated
// section/media/game controls on the pre-D-318 head (2026-10-16): 46 retained assertion kills plus
// the corrected wheel and two review controls, 49 total. The original wheel
// delivery timeout was NOT a behavioral kill. Capture-phase delivery now reaches
// the ownership assertion. Receipts: orchestrator scratch/article-sections/
// verification-{2,3}-mutants and review-fixes-2-mutants; timeouts never count.
// Initial non-kill: head-over-map survived the dual-pair orb fixture because its
// orb was clear of the misplaced head. The approved-home assertion below rejects
// it; the unchanged native orb-tap journey also passes. TOC geometry/screenshots:
// scratch/article-sections/toc2-shots.json, including five shown widths.
// D-318 delta (2026-10-19): 55 of 58 controls killed at assertions; receipts in
// ci-e26/d318-{retained-controls,header-controls,late-header-control,game-controls}.
// Three remain pending View: reference-videos-removed, pane-card-overflow and
// film-only-node-band-lost. They are not counted as current kills. Initial
// non-kills: aria/contrast targets hit new game rules instead of their original
// semantic rules; corrected targets and separate game-header claims now fail.
// The sync-only body-ID control survived one natural ordering; forcing the real
// backfill after reader publication kills it at the target-identity assertion.
// D-322 retains those 55 results and adds the execution-occupied-space-lost
// assertion kill: 56/59 controls, the same three View cases pending. Receipt:
// ci-e26/d322-execution-control-final; both exact-e26 native-wheel cases also
// fail at the painted-overlap claim, not at input delivery or a readiness wait.
const READY = '[data-reader][data-reader-ready="true"]'
const KNEE = '/Transitions/Knee-Slice-Pass'
const LOOP = '/Submissions/Loop-Choke/from-Half-Guard/Defender'
const FOCUS = { v: 2, settings: { readingFocus: true, readingCard: false, readingHand: false, readingMap: false, readingFeedback: false }, settingsAt: {} }
const state = (page: Page) => page.evaluate(() => {
  const a = (window as any).__neural
  return { paused: a.paused, played: !!a._played, misses: (a.beats || []).filter((b: any) => b.beat === 'land_q_expired').length, deals: (a.beats || []).filter((b: any) => b.beat === 'options_dealt').length }
})

for (const path of [
  '/Positions/Mount', '/Positions/Mount/Top', '/Positions/Mount/Bottom',
  KNEE, KNEE + '/Attacker', KNEE + '/Defender',
  '/Submissions/Loop-Choke', '/Submissions/Loop-Choke/from-Half-Guard', LOOP,
  '/Submissions/Loop-Choke/from-Half-Guard/Attacker',
  '/Principles/Frames', '/Learning/Position-Over-Submission',
  '/Systems/Danaher-Pin-Escape-Fundamentals-System',
]) {
  test(`@curated semantic sections preserve every published source block: ${path}`, async ({ page }) => {
    const j = journey(page)
    await j.boot(path, { initialState: FOCUS })
    await expect(page.locator(READY)).toBeVisible()
    const proof = await page.evaluate(async () => {
      const root = document.querySelector('[data-reader]')!, body = root.querySelector('[data-reader-body]')!
      const norm = (s: string | null) => (s || '').replace(/Play as /g, 'Read as ').replace(/\s+/g, ' ').trim()
      const sources = [...new Set([...body.querySelectorAll('[data-source-path]')].map(e => e.getAttribute('data-source-path')!))]
      const missing: string[] = []
      for (const path of sources) {
        const res = await fetch(path); if (!res.ok) throw Error(path + ': ' + res.status)
        const doc = new DOMParser().parseFromString(await res.text(), 'text/html')
        const fragments = [...body.querySelectorAll('[data-source-path]')].filter(e => e.getAttribute('data-source-path') === path)
        const shown = fragments.map(e => norm(e.textContent)).join(' ')
        const guide = fragments.some(e => e.getAttribute('data-reader-article') === 'guide')
        const source = doc.querySelector('article')!
        const selected = guide || !/\/(Top|Bottom|Attacker|Defender)$/.test(root.getAttribute('data-reader-path')!) ? [source] : [...source.querySelectorAll('#safety-considerations,blockquote.callout.danger')]
        for (const container of selected) for (const leaf of container.querySelectorAll('p,li,th,td')) {
          const text = norm(leaf.textContent); if (text && !shown.includes(text)) missing.push(text)
        }
      }
      const cards = [...body.querySelectorAll(':scope>.ng-section-card')]
      return { sources, missing, types: cards.map(c => c.getAttribute('data-section-type')), count: cards.length,
        ids: [...root.querySelectorAll('[id]')].map(e => e.id), horizontalTabs: root.querySelectorAll('.ng-reader-contents,[data-land-more]').length,
        reference: /\/(Principles|Learning|Systems)\//.test(root.getAttribute('data-reader-path')!),
        hand: (window as any).__neural._optList?.length || 0 }
    })
    expect(proof.sources.length).toBeGreaterThan(0)
    expect(proof.missing, 'all published paragraphs, list entries and table cells remain').toEqual([])
    expect(proof.count).toBeGreaterThan(2)
    expect(new Set(proof.ids).size).toBe(proof.ids.length)
    expect(proof.horizontalTabs).toBe(0)
    const main = ['videos', 'overview', 'principles', 'recognition', 'setup', 'prerequisites', 'options', 'safety', 'mistakes']
    const actual = proof.types.filter(t => main.includes(t!))
    expect(actual).toEqual(main.filter(t => proof.types.includes(t)))
    if (proof.types.includes('related')) expect(proof.types.slice(proof.types.indexOf('related'))).toEqual(proof.reference && proof.types.includes('sources') ? ['related', 'sources'] : ['related'])
    if (proof.reference) expect(proof.hand).toBe(0)
    expect(await state(page)).toMatchObject({ paused: true, played: false, misses: 0, deals: 0 })
  })
}

for (const width of [1366, 390]) {
  test(`@curated ${width}px choices precede section cards and preserve the six-pixel token`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 768 })
    const j = journey(page)
    await j.boot(LOOP)
    await expect(page.locator(READY)).toBeVisible()
    const snapshot = await page.evaluate(() => {
      const a = (window as any).__neural; (window as any).__sectionsHand = a.optionsRef.current;
      (window as any).__sectionsCards = [...a.optionsRef.current.querySelectorAll('.ngchoice-title')]
      return { titles: [...a.optionsRef.current.querySelectorAll('.ngchoice-title')].map(e => e.textContent) }
    })
    const measure = () => page.evaluate(() => {
      const a = (window as any).__neural, cards = [...document.querySelectorAll('.ng-section-card')]
      const card = a._landEl.getBoundingClientRect(), hand = a.optionsRef.current.getBoundingClientRect(), first = cards[0].getBoundingClientRect(), head = a._reader.head.getBoundingClientRect()
      const questions = a._reader.gameSections[0].card.getBoundingClientRect(), moves = a._reader.gameSections[1].card.getBoundingClientRect()
      return { deck: a._landEl.classList.contains('ng-land-deck'), cardGap: moves.top - card.bottom, headGap: questions.top - head.bottom, sectionGap: first.top - hand.bottom,
        headInArticle: a._reader.head.parentElement === a._reader.game && a._reader.head.contains(a._reader.tools),
        sectionHeaders: [questions.height, moves.height], handGap: hand.top - moves.bottom,
        gaps: cards.slice(1).map((c, i) => c.getBoundingClientRect().top - cards[i].getBoundingClientRect().bottom),
        overflow: a._readerEl.scrollWidth - a._readerEl.clientWidth }
    })
    const normal = await measure()
    // D-318 inserts the named Moves header after the unchanged 16px deck gap.
    // Focus/Browse now precedes Questions; the article still follows the hand.
    expect(normal.deck).toBe(true)
    expect(normal.cardGap).toBeCloseTo(16, 0)
    expect(normal.headInArticle).toBe(true)
    expect(normal.headGap).toBeCloseTo(6, 0)
    expect(normal.sectionHeaders).toEqual([44, 44])
    expect(normal.handGap).toBeCloseTo(0, 0)
    expect(normal.sectionGap).toBeCloseTo(6, 0)
    expect(normal.gaps.every(g => g === 6)).toBe(true)
    expect(normal.overflow).toBeLessThanOrEqual(1)
    await page.locator('[data-section-toggle=principles]').scrollIntoViewIfNeeded()
    await j.clickByMouse('[data-section-toggle=principles]')
    await expect(page.locator('[data-section-type=principles]')).toHaveAttribute('data-collapsed', 'true')
    expect((await measure()).gaps.every(g => g === 6)).toBe(true)
    expect(await page.evaluate(() => (window as any).__sectionsHand === (window as any).__neural.optionsRef.current)).toBe(true)
    expect(await page.evaluate(() => {
      const w = window as any, cards = [...w.__neural.optionsRef.current.querySelectorAll('.ngchoice-title')]
      return { titles: cards.map((e: any) => e.textContent), same: cards.every((e, i) => e === w.__sectionsCards[i]) && cards.length === w.__sectionsCards.length }
    })).toEqual({ titles: snapshot.titles, same: true })
    await page.locator(READY).evaluate(e => (e as HTMLElement).style.setProperty('--section-gap', '12px'))
    expect((await measure()).gaps.every(g => g === 12)).toBe(true)
    expect(await state(page)).toMatchObject({ paused: true, played: false, misses: 0 })
  })
}

test('@curated optional chrome frame preserves the node band and every flow gap', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 1600 })
  const j = journey(page)
  await j.boot(LOOP)
  await expect(page.locator(READY)).toBeVisible()
  await j.advance(500)
  const result = await page.evaluate(() => {
    const a = (window as any).__neural, r = a._reader, head = r.root.querySelector('.ng-reader-head')
    // D-318 keeps the node reservation fixed. Chrome relocates the desktop tools
    // out of the flow; only that measured toolbar reservation is removed.
    r.gameTop = 180
    const measure = () => {
      const c = a._landEl.getBoundingClientRect(), h = a.optionsRef.current.getBoundingClientRect(), cards = [...r.root.querySelectorAll('.ng-section-card')] as HTMLElement[]
      return { top: r.root.getBoundingClientRect().top, start: parseFloat(a._landEl.style.top), cardTop: c.top,
        cardGap: h.top - c.bottom, articleGap: r.articleEl.getBoundingClientRect().top - h.bottom,
        band: r.nodeBand?.height, inlineHead: head.parentElement === r.game ? head.getBoundingClientRect().height + 6 : 0,
        gaps: cards.slice(1).map((e, i) => e.getBoundingClientRect().top - cards[i].getBoundingClientRect().bottom) }
    }
    r.layoutNow()
    const before = measure(), ownTop = Math.max(68, (a.wrapRef.current.querySelector('.ng-logo')?.getBoundingClientRect().bottom || 0) + 12)
    const headBottom = ownTop + 24, offset = 8
    const expectedStart = r.nodeBand.height + before.inlineHead + 44
    let sameHead = false
    a.readerChromeFrame = (el: HTMLElement) => { sameHead = el === head; return { headBottom, offset } }
    r.layoutNow(); const hooked = measure()
    const readingEnd = r.root.getBoundingClientRect().bottom, readingReserve = innerHeight - readingEnd - 40
    a.readerChromeFrame = () => ({ headBottom, offset, bottomReserve: readingReserve })
    r.layoutNow(); const readingReserved = { geometry: measure(), end: r.root.getBoundingClientRect().bottom }
    a.readerChromeFrame = () => ({ headBottom, offset })
    // Book off retains the compact fixed-game fit. Exercise its bottom clamp
    // separately: a scrollable article must not squeeze the reserved node band.
    a.set('readerBook', false); r.sync(); r.root.scrollTop = 0; r.gameTop = 100000
    r.layoutNow()
    const clamped = { bottom: r.game.getBoundingClientRect().bottom, end: r.dock.getBoundingClientRect().top - 8 }
    // Chrome supplies the entire bottom exclusion, including shelf clearance
    // and its existing 8px gap. The clamp must not count those twice.
    const bottomReserve = innerHeight - (r.dock.getBoundingClientRect().top - 8) - 40
    a.readerChromeFrame = () => ({ headBottom, offset, bottomReserve })
    r.layoutNow()
    const reserved = { bottom: r.game.getBoundingClientRect().bottom, end: innerHeight - bottomReserve,
      rootEnd: r.root.getBoundingClientRect().bottom, geometry: measure() }
    a.readerChromeFrame = () => ({ headBottom, offset, bottomReserve: 0 })
    r.layoutNow()
    const zeroReserve = { bottom: r.game.getBoundingClientRect().bottom, end: innerHeight }
    a.set('readerBook', true); r.sync(); r.gameTop = 180; delete a.readerChromeFrame
    r.layoutNow()
    const after = measure()
    a.readerChromeFrame = () => null; r.layoutNow(); const nullHook = measure()
    a.readerChromeFrame = () => undefined; r.layoutNow(); const undefinedHook = measure()
    delete a.readerChromeFrame
    return { before, after, nullHook, undefinedHook, ownTop, expectedStart, headBottom, offset, hooked, readingEnd, readingReserved, clamped, reserved, zeroReserve, sameHead }
  })
  expect(result.before.top).toBeCloseTo(result.ownTop, 2)
  expect(result.before.start).toBeCloseTo(result.expectedStart, 2)
  expect(result.sameHead).toBe(true)
  expect(result.hooked.cardTop - result.before.cardTop).toBeCloseTo(result.headBottom - result.ownTop + result.offset - result.before.inlineHead, 2)
  expect(result.hooked.band).toBe(result.before.band)
  expect(result.hooked.start).toBeGreaterThan(result.offset)
  expect(result.hooked.cardGap).toBe(result.before.cardGap)
  expect(result.hooked.articleGap).toBe(result.before.articleGap)
  expect(result.hooked.gaps).toEqual(result.before.gaps)
  expect(result.readingReserved.geometry).toEqual(result.hooked)
  expect(result.readingReserved.end - result.readingEnd).toBeCloseTo(40, 1)
  expect(result.clamped.bottom).toBeCloseTo(result.clamped.end, 1)
  expect(result.reserved.bottom).toBeCloseTo(result.reserved.end, 1)
  expect(result.reserved.bottom - result.clamped.bottom).toBeCloseTo(40, 1)
  expect(result.reserved.rootEnd).toBeCloseTo(result.reserved.end, 1)
  expect(result.reserved.geometry.cardGap).toBe(16)
  expect(result.zeroReserve.bottom).toBeCloseTo(result.zeroReserve.end, 1)
  expect(result.after).toEqual(result.before)
  expect(result.nullHook).toEqual(result.before)
  expect(result.undefinedHook).toEqual(result.before)

  await j.boot('/Principles/Frames', { initialState: FOCUS })
  await expect(page.locator(READY)).toBeVisible()
  const reference = await page.evaluate(() => {
    const a = (window as any).__neural, r = a._reader, head = r.root.querySelector('.ng-reader-head'), title = head.querySelector('h1')
    const measure = () => ({ top: r.root.getBoundingClientRect().top, headTop: head.getBoundingClientRect().top, title: title.textContent, flow: getComputedStyle(head).position, inside: r.root.contains(title) })
    r.layoutNow(); const before = measure()
    a.readerChromeFrame = () => null; r.layoutNow(); const nil = measure()
    a.readerChromeFrame = () => undefined; r.layoutNow()
    return { before, nil, absent: measure() }
  })
  expect(reference.before).toMatchObject({ flow: 'relative', inside: true })
  expect(reference.nil).toEqual(reference.before)
  expect(reference.absent).toEqual(reference.before)
  await expect(page.locator('.ng-reader-head h1')).toBeVisible()
})

for (const width of [1366, 390]) {
  test(`@curated ${width}px chrome keeps the same controls in their approved homes`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    const j = journey(page)
    await j.boot(LOOP)
    await expect(page.locator(READY)).toBeVisible()
    const result = await page.evaluate(() => {
      const a = (window as any).__neural, r = a._reader, head = r.head, tools = r.tools
      const measure = () => ({ headInFlow: head.parentElement === r.game, toolsInHead: tools.parentElement === head,
        toolsInFlow: tools.parentElement === r.game, beforeSections: tools.getBoundingClientRect().bottom <= r.gameSections[0].card.getBoundingClientRect().top,
        controls: head.querySelectorAll('[data-reading-focus],[data-reader-browse]').length })
      r.layoutNow(); const before = measure()
      a.readerChromeFrame = (el: HTMLElement) => { el.style.position = 'fixed'; el.style.top = '12px'; return { headBottom: 80, offset: 8 } }
      r.layoutNow(); const active = measure()
      const same = r.head === head && r.tools === tools
      a.readerChromeFrame = () => null; r.layoutNow()
      return { before, active, restored: measure(), same, position: getComputedStyle(head).position }
    })
    expect(result.before).toMatchObject({ headInFlow: true, toolsInHead: true, beforeSections: true, controls: 2 })
    expect(result.active).toMatchObject({ headInFlow: false, toolsInHead: width > 640, toolsInFlow: width <= 640, controls: width > 640 ? 2 : 0 })
    if (width <= 640) expect(result.active.beforeSections).toBe(true)
    expect(result.same).toBe(true)
    expect(result.restored).toEqual(result.before)
    expect(result.position).toBe('absolute')
  })
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }, { width: 1152, height: 900 }, { width: 1151, height: 900 }, { width: 1024, height: 768 }, { width: 768, height: 1024 }, { width: 641, height: 844 }, { width: 640, height: 844 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
  test(`@curated contents and header targets at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport); await page.emulateMedia({ reducedMotion: 'reduce' })
    const j = journey(page)
    await j.boot(KNEE + '/Attacker', { initialState: FOCUS })
    await expect(page.locator(READY)).toBeVisible()
    // Closed pane: 680px article + two (200px TOC + 24px edge + 12px gap) gutters.
    // Hidden on narrow tablets as well as phones; the article never yields width.
    const hasToc = viewport.width >= 1152 && viewport.height > 500
    const header = page.locator('[data-section-toggle=principles]'), body = page.locator('[data-section-type=principles] .ng-section-body')
    await expect(page.locator('.ng-reader-contents-button')).toHaveCount(0)
    const column = await page.locator('.ng-reader-article').boundingBox()
    expect(column!.x + column!.width / 2).toBeCloseTo(viewport.width / 2, 1)
    expect(column!.width).toBe(Math.min(680, viewport.width - 24))
    if (!hasToc) {
      await expect(page.locator('.ng-reader-toc')).toBeHidden()
      await header.scrollIntoViewIfNeeded(); await j.clickByMouse('[data-section-toggle=principles]')
    } else {
      await expect(page.locator('.ng-reader-toc')).toBeVisible()
      const toc = await page.locator('.ng-reader-toc').boundingBox()
      expect(toc!.x - column!.x - column!.width).toBeGreaterThanOrEqual(12)
      expect(viewport.width - toc!.x - toc!.width).toBe(24)
      const before = await page.locator(READY).evaluate(e => e.scrollTop)
      await j.clickByMouse('[data-toc-eye=principles]')
      expect(await page.locator(READY).evaluate(e => e.scrollTop), 'eye changes visibility without navigation').toBe(before)
      const link = page.locator('[data-toc-eye=principles]').locator('..').locator('a')
      await link.evaluate(e => e.setAttribute('data-test-section-label', ''))
      await j.clickByMouse('[data-test-section-label]')
      await expect(header).toBeFocused()
    }
    await expect(header).toHaveAttribute('aria-expanded', 'false'); await expect(body).toBeHidden()
    expect(await header.getAttribute('aria-controls')).toBe(await body.getAttribute('id'))
    const contrast = await header.evaluate(e => {
      const lum = (color: string) => { const c = color.match(/\d+/g)!.slice(0, 3).map(x => { const n = +x / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4 }); return c[0] * .2126 + c[1] * .7152 + c[2] * .0722 }
      const fg = lum(getComputedStyle(e).color), bg = lum(getComputedStyle(e.closest('.ng-section-card')!).backgroundColor)
      return (Math.max(fg, bg) + .05) / (Math.min(fg, bg) + .05)
    })
    expect(contrast).toBeGreaterThanOrEqual(7)
    await header.focus(); await page.keyboard.press('Space')
    await expect(body).toBeVisible(); await expect(header).toHaveAttribute('aria-expanded', 'true')
    const before = await state(page); await j.advance(20000); expect(await state(page)).toEqual(before)
  })
}

// Measure this frame's published label strings/baselines with their actual font,
// and both drawn seats through LY. Never use the camera target or stored n.y.
const tocCanvasGeometry = (page: Page) => page.evaluate(() => {
  const a = (window as any).__neural, n = a.nodes[a.focusIdx], scale = a.W / a.cam.vw
  const pair = a._lastPairLabel, rich = a._lastRichLabel
  const group = pair && pair.focused && [n.idx, n.pi].includes(pair.idx) ? pair : null
  const label = group || rich
  if (!label || !group && (!rich.big || rich.idx !== n.idx)) throw Error('The current node must have a drawn label')
  const ctx = document.createElement('canvas').getContext('2d')!, fam = a._displayFam || "'Space Grotesk'"
  const rows = group ? [[group.main, group.nameY, group.namePx, 700], [group.qual, group.qualY, 11.5, 600], [group.sub, group.subY, 12, 700]]
    : [[rich.name, rich.nameY, rich.namePx, 700], [rich.qual, rich.qualY, 11.5, 600], [rich.kicker.toUpperCase(), rich.roleY, 11, 700]]
  const labels = rows.filter(([text]) => text).map(([text, y, size, weight]) => {
    ctx.font = `${weight} ${size}px ${fam}, sans-serif`
    const m = ctx.measureText(text as string)
    return { left: label.ox - m.actualBoundingBoxLeft, right: label.ox + m.actualBoundingBoxRight,
      top: y - m.actualBoundingBoxAscent, bottom: y + m.actualBoundingBoxDescent, text }
  })
  const k = Math.max(.4, Math.min(1, a.cam.vw / (a.graphW * .5)))
  const orbs = [n, n.pi >= 0 ? a.nodes[n.pi] : null].filter(Boolean).map(q => {
    const x = a.W / 2 + (q.x - a.cam.cx) * scale, y = a.H / 2 + (a._LY(q) - a.cam.cy) * scale
    // Include the focus rim and the widest triangle/diamond extremity.
    const r = a._nodeHalfW(q, scale, k, a._lodK ?? 1)
    return { left: x - r, right: x + r, top: y - r, bottom: y + r }
  })
  const t = a._reader.contents.getBoundingClientRect()
  const toc = { left: t.left, right: t.right, top: t.top, bottom: t.bottom }
  const intersections = [...labels, ...orbs].filter(r => r.left < toc.right && r.right > toc.left && r.top < toc.bottom && r.bottom > toc.top)
  const bounds = [...labels, ...orbs], mid = a.pairMid(n)
  return { toc, labels, orbs, intersections, map: a._graphInputOn(), reading: !!a._reader.interacting,
    center: (Math.min(...bounds.map(r => r.left)) + Math.max(...bounds.map(r => r.right))) / 2,
    point: { x: a.W / 2 + (mid.x - a.cam.cx) * scale, y: a.H / 2 + (mid.y - a.cam.cy) * scale },
    firstTop: a._reader.head.getBoundingClientRect().top }
})

// STALE CONTRACT: D-318 U4a replaces the free-gutter correction with centred
// arrival and native occlusion. Restoring that correction must fail this claim.
test('@curated current node stays centred as the native sections cover it at every width', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const j = journey(page)
  await j.boot(LOOP)
  await expect(page.locator(READY)).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  for (const [width, height] of [[1152, 900], [1200, 900], [1280, 900], [1366, 900], [1440, 900], [1024, 768], [768, 1024], [390, 844]]) {
    await page.setViewportSize({ width, height })
    await page.locator(READY).evaluate(e => { e.scrollTop = 0 })
    await j.advance(3000); await page.evaluate(() => document.body.offsetHeight); await j.advance(3000)
    // Repeated reading can mint White Foundations. Its deliberate phone overlay
    // covers the node band; dismiss it natively before testing article occlusion.
    if (await page.locator('[data-reward-close]').isVisible()) await j.clickByMouse('[data-reward-close]')
    if (width >= 1152) await expect(page.locator('.ng-reader-toc')).toBeVisible()
    else await expect(page.locator('.ng-reader-toc')).toBeHidden()
    const board = await tocCanvasGeometry(page)
    expect(board.map).toBe(true)
    expect(Math.abs(board.center - width / 2), width + 'px centred visible composition').toBeLessThan(2)
    expect(Math.max(...board.labels.map(r => r.bottom), ...board.orbs.map(r => r.bottom))).toBeLessThan(board.firstTop)
    expect(board.intersections, width + 'px map: ' + JSON.stringify(board)).toEqual([])
    if (width >= 1152) await j.clickByMouse('.ng-reader-toc-row:has([data-toc-eye=overview]) a')
    else {
      await page.locator('[data-reader-body]').focus()
      await page.keyboard.press('PageDown')
      await page.locator('[data-section-type=overview]').scrollIntoViewIfNeeded()
    }
    await j.advance(3000); await page.evaluate(() => document.body.offsetHeight); await j.advance(3000)
    const reading = await tocCanvasGeometry(page)
    expect(reading).toMatchObject({ map: true, reading: true })
    expect(Math.abs(reading.center - board.center)).toBeLessThan(1)
    expect(Math.abs(reading.point.y - board.point.y)).toBeLessThan(1)
    expect(await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest('.ng-section-card'), reading.point), 'native prose covers the stationary node').toBe(true)
    expect(reading.intersections, width + 'px reading: ' + JSON.stringify(reading)).toEqual([])
    const column = await page.locator('.ng-reader-article').boundingBox()
    expect(column!.x).toBe(Math.max(12, (width - 680) / 2))
  }
})

for (const viewport of [{ width: 1440, height: 900 }, { width: 1152, height: 900 }, { width: 1024, height: 768 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
  test(`@curated D-318 ${viewport.width}px Questions and Moves use named eyes and the other node half changes role`, async ({ page }) => {
    await page.setViewportSize(viewport)
    const j = journey(page); await j.boot(LOOP)
    await expect(page.locator(READY)).toBeVisible()
    await j.readerLayoutSettled()
    await expect(page.locator('.ng-reader-shelf')).toBeHidden()
    await expect(page.locator('[aria-label="Reading perspectives"]')).toHaveCount(0)
    // D-331 N1: name · role on one line (D-318 U6a's "Loop Choke · Escaping"), the qualifier beneath.
    await expect(page.locator('.ng-reader-toc h2')).toHaveText('Loop Choke · Escapingfrom Half Guard')
    expect(await page.locator('.ng-reader-toc h2').evaluate(h => { const r = h.querySelector('span')!.getBoundingClientRect(), q = h.querySelector('small')!.getBoundingClientRect(), range = document.createRange(); range.selectNodeContents(h.firstChild!); const n = range.getBoundingClientRect(); return { line: Math.abs(r.top - n.top) < 2, below: q.top >= r.bottom - 1 } }), 'the role shares the name line; the qualifier sits beneath').toEqual({ line: true, below: true })
    expect(await page.locator('.ng-reader-toc-row a').allTextContents()).toEqual(expect.arrayContaining(['Questions', 'Moves', 'Videos', 'Overview']))
    for (const part of ['card', 'hand']) {
      const header = page.locator(`[data-game-eye="${part}"]`)
      await header.scrollIntoViewIfNeeded()
      const target = await header.boundingBox()
      expect(target!.height).toBeGreaterThanOrEqual(44)
      expect(await header.evaluate((el, part) => {
        const a = (window as any).__neural
        const body = part === 'card' ? a._landEl : a.optionsRef.current, id = el.getAttribute('aria-controls')!
        return { part, control: id, body: body?.id, connected: !!body?.isConnected, same: document.getElementById(id) === body }
      }, part), 'the eye names the actual game surface it controls').toEqual({ part, control: `reader-${part}-body`, body: `reader-${part}-body`, connected: true, same: true })
      await j.clickByMouse(`[data-game-eye="${part}"]`)
      await expect(header).toHaveAttribute('aria-expanded', 'false')
      await expect(page.locator(`[data-toc-eye="${part}"]`)).toHaveAttribute('aria-expanded', 'false')
      const contrast = await header.evaluate(el => {
        const luminance = (color: string) => {
          const c = color.match(/\d+/g)!.slice(0, 3).map(x => { const n = +x / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4 })
          return c[0] * .2126 + c[1] * .7152 + c[2] * .0722
        }
        const fg = luminance(getComputedStyle(el).color), bg = luminance(getComputedStyle(el.parentElement!).backgroundColor)
        return (Math.max(fg, bg) + .05) / (Math.min(fg, bg) + .05)
      })
      expect(contrast, 'a hidden game section retains a legible header and eye').toBeGreaterThanOrEqual(7)
      expect(await page.evaluate(part => {
        const a = (window as any).__neural
        return part === 'card' ? !a._landEl : getComputedStyle(a.optionsRef.current).visibility === 'hidden'
      }, part)).toBe(true)
      await j.clickByMouse(`[data-game-eye="${part}"]`)
      await expect(header).toHaveAttribute('aria-expanded', 'true')
    }
    await page.locator(READY).evaluate(e => { e.scrollTop = 0 })
    await j.advance(6000)
    // The fixture can earn White Foundations while toggling the sections. Its
    // temporary reward screen deliberately covers the phone map; close it by
    // mouse, then retain the unchanged orb reachability assertion below.
    if (await page.locator('[data-reward-close]').isVisible()) await j.clickByMouse('[data-reward-close]')
    const other = await page.evaluate(() => {
      const a = (window as any).__neural, n = a.nodes[a.nodes[a.focusIdx].pi], scale = a.W / a.cam.vw
      const x = a.W / 2 + (n.x - a.cam.cx) * scale, y = a.H / 2 + (a._LY(n) - a.cam.cy) * scale
      return { x, y, canvas: document.elementFromPoint(x, y) === a.canvasRef.current }
    })
    expect(other.canvas, 'the real other half is reachable above the first section').toBe(true)
    await page.mouse.click(other.x, other.y)
    await j.advance(6000)
    await expect(page.locator(READY)).toHaveAttribute('data-reader-path', LOOP.replace('/Defender', '/Attacker'))
    await expect(page.locator('.ng-reader-toc h2')).toHaveText('Loop Choke · Attackingfrom Half Guard')
    expect(await state(page)).toMatchObject({ played: false, misses: 0 })
    expect(await page.evaluate(() => {
      const a = (window as any).__neural;
      return { intent: !!a._readerIntent, paused: a.paused, clock: a._decision?.remaining ?? null };
    }), 'changing the read role retains reading intent and the stopped clock').toEqual({ intent: true, paused: true, clock: null })
  })
}

// A normal cold run exposed this missing ID, but the old sync-only writer can
// pass when its network ordering differs. Deliver the real backfill after the
// reader has published; assert its new shell and unchanged question together.
test('@curated a late question backfill retains the named eye target', async ({ page }) => {
  const j = journey(page)
  await j.boot('/Positions/Mount/Top')
  await expect(page.locator(READY)).toBeVisible()
  expect(await j.landQuestion()).not.toBeNull()
  const proof = await page.evaluate(() => {
    const a = (window as any).__neural, before = a._landEl, question = before.querySelector('[data-land-q]')
    a._landBackfill()
    const eye = document.querySelector('[data-game-eye=card]')!, body = document.getElementById(eye.getAttribute('aria-controls')!)
    return { replaced: a._landEl !== before, retired: !before.isConnected, sameQuestion: question === a._landEl.querySelector('[data-land-q]'),
      named: body === a._landEl, id: a._landEl.id, paused: a.paused, played: !!a._played }
  })
  expect(proof).toEqual({ replaced: true, retired: true, sameQuestion: true, named: true, id: 'reader-card-body', paused: true, played: false })
})

for (const theme of ['light', 'dark'] as const) {
  test(`@curated floating contents owns real mouse input and preserves the centred article in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
    const j = journey(page)
    // Keep the real map visible: Focus would disable graph input and mask a missing guard.
    await j.boot(KNEE + '/Attacker')
    await expect(page.locator(READY)).toBeVisible()
    await page.evaluate(theme => document.documentElement.setAttribute('saved-theme', theme), theme)
    const surface = await page.evaluate(() => {
      const w = window as any, a = w.__neural, r = a._reader, toc = r.contents, wrap = a.wrapRef.current
      const column = () => { const b = r.articleEl.getBoundingClientRect(); return { left: b.left, width: b.width } }
      const before = column(); toc.hidden = true; const without = column(); toc.hidden = false
      w.__tocInput = { captures: 0, picks: 0, zooms: 0 }
      const capture = wrap.setPointerCapture
      wrap.setPointerCapture = function (id: number) { w.__tocInput.captures++; return capture.call(this, id) }
      for (const key of ['_tapBackground', 'stageRollAt', 'openDossier', 'releaseCamera']) {
        const original = a[key]
        a[key] = function (...args: any[]) { w.__tocInput[key === 'releaseCamera' ? 'zooms' : 'picks']++; return original.apply(this, args) }
      }
      const cs = getComputedStyle(toc), edge = a.accountRef.current.getBoundingClientRect(), box = toc.getBoundingClientRect()
      return { before, without, graphOn: a._graphInputOn(), sibling: toc.parentElement === wrap && !r.root.contains(toc),
        position: cs.position, z: +cs.zIndex, pointer: toc.style.pointerEvents, inset: innerWidth - box.right, controlInset: innerWidth - edge.right,
        surfaces: [toc, ...toc.querySelectorAll('a,button')].map(e => {
          const s = getComputedStyle(e); return { bg: s.backgroundColor, image: s.backgroundImage, border: s.borderTopWidth, shadow: s.boxShadow }
        }), top: box.top }
    })
    expect(surface.graphOn).toBe(true)
    expect(surface.before).toEqual(surface.without)
    expect(surface.before).toEqual({ left: 380, width: 680 })
    expect(surface).toMatchObject({ sibling: true, position: 'fixed', z: 6, pointer: 'auto' })
    expect(surface.inset).toBe(surface.controlInset)
    for (const s of surface.surfaces) expect(s).toEqual({ bg: 'rgba(0, 0, 0, 0)', image: 'none', border: '0px', shadow: 'none' })
    const scroll = await page.locator(READY).evaluate(e => e.scrollTop)
    await j.clickByMouse('[data-toc-eye=principles]', 'eye changes visibility without capturing the canvas')
    await expect(page.locator('[data-section-type=principles]')).toHaveAttribute('data-collapsed', 'true')
    expect(await page.locator(READY).evaluate(e => e.scrollTop)).toBe(scroll)
    const contrast = await page.locator('[data-toc-eye=principles]').evaluate(e => {
      const a = (window as any).__neural, label = e.parentElement!.querySelector('a')!, cs = getComputedStyle(label)
      const lum = (s: string) => { const c = s.match(/[\d.]+/g)!.slice(0, 3).map(x => { const n = +x / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4 }); return c[0] * .2126 + c[1] * .7152 + c[2] * .0722 }
      const fg = lum(cs.color), backgrounds = [getComputedStyle(a.wrapRef.current).backgroundColor, getComputedStyle(document.querySelector('.ng-section-card')!).backgroundColor, cs.textShadow.match(/rgb\([^)]+\)/)?.[0]]
      return { labelColor: cs.color, eyeColor: getComputedStyle(e).color, shadow: cs.textShadow,
        ratios: backgrounds.map(bg => { const b = lum(bg!); return (Math.max(fg, b) + .05) / (Math.min(fg, b) + .05) }) }
    })
    expect(contrast.labelColor).toBe(contrast.eyeColor)
    expect(contrast.shadow).not.toBe('none')
    for (const ratio of contrast.ratios) expect(ratio).toBeGreaterThanOrEqual(7)
    await j.clickByMouse('.ng-reader-toc-row:has([data-toc-eye=principles]) a', 'label scrolls to the collapsed header without toggling')
    await expect(page.locator('[data-section-toggle=principles]')).toBeFocused()
    await expect(page.locator('[data-section-type=principles]')).toHaveAttribute('data-collapsed', 'true')
    await expect(page.locator('.ng-reader-toc-row:has([data-toc-eye=principles]) a')).toHaveCSS('color', contrast.eyeColor)
    expect((await page.locator('.ng-reader-toc').boundingBox())!.y).toBe(surface.top)
    await page.locator('[data-toc-eye=principles]').focus(); await page.keyboard.press('Space')
    await expect(page.locator('[data-section-type=principles]')).toHaveAttribute('data-collapsed', 'false')
    const eye = (await page.locator('[data-toc-eye=principles]').boundingBox())!
    await page.mouse.move(eye.x + eye.width / 2, eye.y + eye.height / 2); await page.mouse.wheel(0, 120)
    expect(await page.evaluate(() => (window as any).__tocInput)).toEqual({ captures: 0, picks: 0, zooms: 0 })
    // Positive control: the spies must see an actual canvas gesture.
    const point = await page.evaluate(() => {
      const a = (window as any).__neural
      for (let y = 150; y < innerHeight - 100; y += 50) for (let x = 20; x < 300; x += 50) {
        if (document.elementFromPoint(x, y) === a.canvas) return { x, y }
      }
      throw Error('No exposed canvas for the input positive control')
    })
    await page.mouse.click(point.x, point.y)
    const positive = await page.evaluate(() => (window as any).__tocInput)
    expect(positive.captures).toBeGreaterThan(0); expect(positive.picks).toBeGreaterThan(0)
  })
}

test('@curated section settings carry to another type, reload and the Settings editor', async ({ page }) => {
  const j = journey(page); await j.boot(KNEE + '/Attacker', { initialState: FOCUS })
  await expect(page.locator(READY)).toBeVisible()
  await page.locator('[data-section-toggle=principles]').scrollIntoViewIfNeeded(); await j.clickByMouse('[data-section-toggle=principles]')
  await page.evaluate(() => (window as any).__neural._readArticle('/Positions/Mount/Bottom'))
  await expect(page.locator(READY)).toHaveAttribute('data-reader-path', '/Positions/Mount/Bottom')
  await expect(page.locator('[data-section-toggle=principles]')).toHaveAttribute('aria-expanded', 'false')
  await j.boot(new URL(page.url()).pathname, { preserveStorage: true }); await expect(page.locator(READY)).toBeVisible()
  await expect(page.locator('[data-section-toggle=principles]')).toHaveAttribute('aria-expanded', 'false')
  await page.evaluate(() => (window as any).__neural.openSettings('rolling'))
  await page.locator('[data-section-setting=principles]').scrollIntoViewIfNeeded()
  await expect(page.locator('[data-section-setting=principles]')).not.toBeChecked()
  await j.clickByMouse('[data-section-setting=principles]')
  expect(await page.evaluate(() => { const a = (window as any).__neural; return { value: a.settings['readerSection.principles'], stamp: a._settingsAt['readerSection.principles'] } })).toMatchObject({ value: true, stamp: expect.any(Number) })
  await expect(page.locator('[data-section-toggle=principles]')).toHaveAttribute('aria-expanded', 'true')
})


test('@curated independent section preferences merge per key and preserve stale keys', async ({ page }) => {
  const j = journey(page); await j.boot(KNEE + '/Attacker', { initialState: FOCUS })
  await expect(page.locator(READY)).toBeVisible()
  await page.locator('[data-section-toggle=principles]').scrollIntoViewIfNeeded()
  await j.clickByMouse('[data-section-toggle=principles]')
  const result = await page.evaluate(() => {
    const a = (window as any).__neural, local = a._progressBlob(), t = local.settingsAt['readerSection.principles']
    const remote = { v: 2, settings: { 'readerSection.principles': true, 'readerSection.options': false, 'readerSection.future-type': false }, settingsAt: { 'readerSection.principles': t - 1, 'readerSection.options': t + 1, 'readerSection.future-type': t + 1 }, updatedAt: t + 1 }
    const merged = a._mergeProgressBlobs(local, remote)
    a._hydrateProgressBlob(merged); a._applyLayers(); a._saveProgress()
    return { principles: a.get('readerSection.principles'), options: a.get('readerSection.options'), future: a.get('readerSection.future-type'), stamp: a._settingsAt['readerSection.principles'], expected: t }
  })
  expect(result).toEqual({ principles: false, options: false, future: false, stamp: result.expected, expected: result.expected })
  await expect(page.locator('[data-section-toggle=principles]')).toHaveAttribute('aria-expanded', 'false')
  await expect(page.locator('[data-section-toggle=options]')).toHaveAttribute('aria-expanded', 'false')
  await j.boot(new URL(page.url()).pathname, { preserveStorage: true }); await expect(page.locator(READY)).toBeVisible()
  await expect(page.locator('[data-section-toggle=options]')).toHaveAttribute('aria-expanded', 'false')
  expect(await page.evaluate(() => (window as any).__neural.get('readerSection.future-type'))).toBe(false)
})

test('@curated unknown authored sections and cross-section anchors survive regrouping', async ({ page }) => {
  const j = journey(page)
  await j.boot(KNEE + '/Attacker', { initialState: FOCUS })
  await expect(page.locator(READY)).toBeVisible()
  const path = '/Learning/Section-Shape-Fixture'
  await page.route('**' + path, route => route.fulfill({ contentType: 'text/html', body: '<h1>Section shape fixture</h1><article><h2 id="key-principles">Principles</h2><p>First complete authored statement. <a href="#legacy-notes">Read the original notes</a></p><h2 id="legacy-notes">Legacy notes</h2><p>Unmapped content survives in full.</p><h3 id="deep-note">An authored subheading</h3><p>Its detail also survives.</p><h2 id="related">Related</h2><p>A related source.</p><h2 id="sources">Sources</h2><p>A final citation.</p></article>' }))
  await page.evaluate(path => (window as any).__neural._readArticle(path), path)
  await expect(page.locator(READY)).toHaveAttribute('data-reader-path', path)
  await expect(page.locator(READY)).toHaveAttribute('data-reader-ready', 'true')
  expect(await page.locator('.ng-section-card').evaluateAll(es => es.map(e => e.getAttribute('data-section-type')))).toEqual(['principles', 'additional', 'related', 'sources'])
  await expect(page.locator('[data-section-type=additional]')).toContainText('Unmapped content survives in full.')
  await expect(page.locator('[data-section-type=additional]')).toContainText('Its detail also survives.')
  await page.locator('[data-reader-anchor=legacy-notes]').scrollIntoViewIfNeeded()
  await j.clickByMouse('[data-reader-anchor=legacy-notes]')
  expect(await page.evaluate(() => document.activeElement?.closest('[data-section-type]')?.getAttribute('data-section-type'))).toBe('additional')
  const body = page.locator('[data-section-type=additional] .ng-section-body')
  await body.evaluate(e => { (e as HTMLElement).tabIndex = 0; (e as HTMLElement).focus() })
  await page.evaluate(() => { const a = (window as any).__neural; a.set('readerSection.additional', false); a._applyLayers() })
  await expect(page.locator('[data-section-toggle=additional]')).toBeFocused()
  await expect(body).toBeHidden()
  expect(await body.evaluate(e => (e as HTMLElement).inert)).toBe(true)
  expect(await state(page)).toMatchObject({ paused: true, played: false, deals: 0, misses: 0 })
})
