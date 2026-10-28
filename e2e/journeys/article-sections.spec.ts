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
// D-338 retired Focus (its reading* overrides are no longer read). QUIET seeds the same closed
// Questions and Moves and silent Feedback through the game layers; the map stays shown, as
// leaving Focus showed it for the other-half tap.
const QUIET = { v: 2, settings: { landCard: false, landHand: false, landFeedback: false }, settingsAt: {} }
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
    await j.boot(path, { initialState: QUIET })
    await expect(page.locator(READY)).toBeVisible()
    const proof = await page.evaluate(async () => {
      // D-338 lifts the Videos section into the game flow above the hand: read the whole reader.
      const root = document.querySelector('[data-reader]')!, body = root
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
      const cards = [...root.querySelectorAll('[data-reader-body]>.ng-section-card,.ng-reader-game>.ng-section-card')]
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
  // STALE CONTRACT (D-338, owner): Videos, Moves, Questions, then the article; no header names
  // Moves or Questions, and Focus/Browse no longer sit above them. Each boundary is still one
  // measured gap, the prose cards keep the six-pixel token, and the hand is never rebuilt.
  // STALE CONTRACT (D-368, layout C): nothing is lifted above Moves any more. Moves lead the flow at the
  // parts' own step after the node band; the current card, when a film exists, sits in the stage beside
  // or above the question, and the Videos section reads with the article.
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
      // U11 (D-355): where the index shows, a closed section leaves no placeholder; the visible cards keep the token.
      const a = (window as any).__neural, r = a._reader, cards = [...document.querySelectorAll('[data-reader-body] > .ng-section-card')].filter(c => (c as HTMLElement).getClientRects().length)
      const card = a._landEl.getBoundingClientRect(), hand = a.optionsRef.current.getBoundingClientRect(), first = cards[0].getBoundingClientRect(), head = r.head.getBoundingClientRect()
      const labels = r.gameSections.map((s: any) => s.card.getBoundingClientRect().height)
      return { deck: a._landEl.classList.contains('ng-land-deck'),
        headGap: hand.top - head.bottom, lifted: !!r.videoCard, cardGap: card.top - hand.bottom, sectionGap: r.articleEl.getBoundingClientRect().top - card.bottom,
        closeRow: first.top - (r.root.querySelector('[data-reader-close]')?.getBoundingClientRect().bottom ?? NaN),
        headInArticle: r.head.parentElement === r.game && r.head.contains(r.tools) && r.head.hasAttribute('data-bare'),
        sectionHeaders: labels, step: a._landEl.classList.contains('ng-land-deck') ? 16 : a.isMobile() ? 8 : 12,
        backs: 3 * (a._landStackEl?.childElementCount || 0),
        // U31: cards can share a row. Measure between actual row unions, not between peers.
        gaps: [...new Set(cards.map(c => c.getBoundingClientRect().top))].slice(1).map(top => top - Math.max(...cards.map(c => c.getBoundingClientRect()).filter(r => r.top < top).map(r => r.bottom))),
        overflow: a._readerEl.scrollWidth - a._readerEl.clientWidth }
    })
    const normal = await measure()
    expect(normal.deck).toBe(true)
    expect(normal.lifted, 'nothing is lifted above Moves').toBe(false)
    expect(normal.headInArticle).toBe(true)
    expect(normal.headGap, 'Moves lead the flow at the parts\' step').toBeCloseTo(normal.step, 0)
    expect(normal.sectionHeaders, 'no header names an open Moves or Questions').toEqual([0, 0])
    expect(normal.cardGap, 'Questions follows Moves at the deck gap').toBeCloseTo(16, 0)
    // The deck's backs peek 3px per remaining card below the face; the token is paid after them.
    // U47 d: a reading arrival's question asks alone, with no backs until Answer for Points (which
    // would start play, so this reading journey cannot take it up); landcard-deck.spec.ts measures
    // the shown deck's backs and its article clearance.
    expect(normal.backs, 'U47 d: the asking question shows no backs').toBe(0)
    expect(normal.sectionGap, 'the article follows Questions (and its backs) at the six-pixel token').toBeCloseTo(normal.backs + 6, 0)
    // U12 a (D-355): the article's own ✕ is its top row; the first section follows it directly.
    expect(normal.closeRow, 'the first section follows the article\'s ✕ row').toBeCloseTo(0, 0)
    const gapScale = width < 600 ? 3 : 4
    expect(normal.gaps.length).toBeGreaterThan(0)
    expect(normal.gaps.every(g => Math.abs(g - 6 * gapScale) < 1)).toBe(true)
    expect(normal.overflow).toBeLessThanOrEqual(1)
    await page.locator('[data-section-toggle=principles]').scrollIntoViewIfNeeded()
    await j.clickByMouse('[data-section-toggle=principles]')
    await expect(page.locator('[data-section-type=principles]')).toHaveAttribute('data-collapsed', 'true')
    expect((await measure()).gaps.every(g => Math.abs(g - 6 * gapScale) < 1)).toBe(true)
    expect(await page.evaluate(() => (window as any).__sectionsHand === (window as any).__neural.optionsRef.current)).toBe(true)
    expect(await page.evaluate(() => {
      const w = window as any, cards = [...w.__neural.optionsRef.current.querySelectorAll('.ngchoice-title')]
      return { titles: cards.map((e: any) => e.textContent), same: cards.every((e, i) => e === w.__sectionsCards[i]) && cards.length === w.__sectionsCards.length }
    })).toEqual({ titles: snapshot.titles, same: true })
    await page.locator(READY).evaluate(e => (e as HTMLElement).style.setProperty('--section-gap', '12px'))
    expect((await measure()).gaps.every(g => Math.abs(g - 12 * gapScale) < 1)).toBe(true)
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
    // D-318 keeps the node reservation fixed. Chrome relocates the head out of the flow;
    // only that measured reservation is removed. D-338: the flow reads Videos, Moves,
    // Questions with Book shown (card over hand with it off), so the part gap is measured
    // in flow order and the article follows the lower part.
    r.gameTop = 180
    const measure = () => {
      const c = a._landEl.getBoundingClientRect(), h = a.optionsRef.current.getBoundingClientRect(), cards = [...r.root.querySelectorAll('.ng-section-card')] as HTMLElement[]
      const first = r.videoCard && !r.videoCard.hidden ? r.videoCard : a.optionsRef.current
      return { top: r.root.getBoundingClientRect().top, start: parseFloat(first.style.top), cardTop: c.top,
        cardGap: Math.max(h.top - c.bottom, c.top - h.bottom), articleGap: r.articleEl.getBoundingClientRect().top - Math.max(c.bottom, h.bottom),
        band: r.nodeBand?.height, inlineHead: head.parentElement === r.game ? head.getBoundingClientRect().height + 6 : 0,
        gaps: cards.slice(1).map((e, i) => e.getBoundingClientRect().top - cards[i].getBoundingClientRect().bottom) }
    }
    r.layoutNow()
    const before = measure(), ownTop = Math.max(68, (a.wrapRef.current.querySelector('.ng-logo')?.getBoundingClientRect().bottom || 0) + 12)
    const headBottom = ownTop + 24, offset = 8
    // D-368 (layout C): Moves lead at the parts' step after the band, or after an inline head that is taller.
    const step = a._landEl.classList.contains('ng-land-deck') ? 16 : a.isMobile() ? 8 : 12
    const expectedStart = r.nodeBand.height + Math.max(before.inlineHead, step), headLead = Math.max(before.inlineHead, step) - step
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
    return { before, after, nullHook, undefinedHook, ownTop, expectedStart, headLead, headBottom, offset, hooked, readingEnd, readingReserved, clamped, reserved, zeroReserve, sameHead }
  })
  expect(result.before.top).toBeCloseTo(result.ownTop, 2)
  expect(result.before.start).toBeCloseTo(result.expectedStart, 2)
  expect(result.sameHead).toBe(true)
  expect(result.hooked.cardTop - result.before.cardTop).toBeCloseTo(result.headBottom - result.ownTop + result.offset - result.headLead, 2)
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

  await j.boot('/Principles/Frames', { initialState: QUIET })
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
      // D-338 removed Focus and Browse: a game page's head carries no control, and the flow's
      // first part is Videos (or Moves without them).
      const first = r.videoCard && !r.videoCard.hidden ? r.videoCard : a.optionsRef.current
      const measure = () => ({ headInFlow: head.parentElement === r.game, toolsInHead: tools.parentElement === head,
        toolsInFlow: tools.parentElement === r.game, beforeSections: tools.getBoundingClientRect().bottom <= first.getBoundingClientRect().top,
        controls: head.querySelectorAll('button').length, bare: head.hasAttribute('data-bare') })
      r.layoutNow(); const before = measure()
      a.readerChromeFrame = (el: HTMLElement) => { el.style.position = 'fixed'; el.style.top = '12px'; return { headBottom: 80, offset: 8 } }
      r.layoutNow(); const active = measure()
      const same = r.head === head && r.tools === tools
      a.readerChromeFrame = () => null; r.layoutNow()
      return { before, active, restored: measure(), same, position: getComputedStyle(head).position }
    })
    expect(result.before).toMatchObject({ headInFlow: true, toolsInHead: true, beforeSections: true, controls: 0, bare: true })
    expect(result.active).toMatchObject({ headInFlow: false, toolsInHead: width > 640, toolsInFlow: width <= 640, controls: 0 })
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
    await j.boot(KNEE + '/Attacker', { initialState: QUIET })
    await expect(page.locator(READY)).toBeVisible()
    // Closed pane: 680px article + two (200px TOC + 24px edge + 12px gap) gutters.
    // Hidden on narrow tablets as well as phones; the article never yields width.
    const hasToc = viewport.width >= 1152 && viewport.height > 500
    const header = page.locator('[data-section-toggle=principles]'), body = page.locator('[data-section-type=principles] .ng-section-body')
    await expect(page.locator('.ng-reader-contents-button')).toHaveCount(0)
    const column = await page.locator('.ng-reader-article').boundingBox()
    expect(column!.x + column!.width / 2).toBeCloseTo(viewport.width / 2, 1)
    expect(column!.width).toBe(Math.min(680, viewport.width - 24))
    // STALE CONTRACT (D-338): one close icon on every width, the section's own ✕; the index only
    // navigates (its eyes are gone). RETIRED with them: "eye changes visibility without navigation".
    // STALE CONTRACT (D-355, U9 b and U11): the index sits on the LEFT, 24px in, and where it shows a closed
    // section leaves NO placeholder in the content: the index row carries it (greyed, its eye) and reopens it.
    // Without the index, the closed section is one compact line, its greyed name and then its eye, no icon.
    await header.scrollIntoViewIfNeeded(); await j.readerLayoutSettled(); await j.clickByMouse('[data-section-toggle=principles]', "the section's ✕")
    await expect(header).toHaveAttribute('aria-expanded', 'false'); await expect(body).toBeHidden()
    expect(await header.getAttribute('aria-controls')).toBe(await body.getAttribute('id'))
    await expect(page.locator('.ng-reader .ng-section-glyph'), 'sections no longer have icons').toHaveCount(0)
    if (!hasToc) {
      await expect(page.locator('.ng-reader-toc')).toBeHidden()
      // U25 a supersedes the in-flow placeholder: reveal the SAME closed label in the disclosure.
      await expect(header).toBeHidden()
      await expect(page.locator('.ng-reader-hidden>summary')).toHaveText('Hidden sections (1)›')
      await page.locator('.ng-reader-hidden>summary').scrollIntoViewIfNeeded(); await j.readerLayoutSettled()
      await j.clickByMouse('.ng-reader-hidden>summary', 'reveal the closed labels')
      await expect(header).toBeVisible()
      // D-338 / D-475: a closed section is a light label with no box. A zero-width border
      // draws nothing even when its computed color is currentColor; the open-card glow must vanish too.
      const closed = await page.locator('[data-section-type=principles]').evaluate(e => {
        const cs = getComputedStyle(e)
        return { background: cs.backgroundColor, shadow: cs.boxShadow,
          borders: ['top', 'right', 'bottom', 'left'].map(side => ({ side,
            width: parseFloat(cs.getPropertyValue(`border-${side}-width`)),
            color: cs.getPropertyValue(`border-${side}-color`) })) }
      })
      expect(closed.background, 'D-338: no background around a closed section').toBe('rgba(0, 0, 0, 0)')
      expect(closed.shadow, 'D-475: no shadow around a closed section').toBe('none')
      for (const { side, width, color } of closed.borders) {
        const transparent = color === 'transparent' || /^rgba\(.+,\s*0(?:\.0+)?\s*\)$/.test(color)
        expect(width === 0 || transparent, `D-338: no visible ${side} border around a closed section`).toBe(true)
      }
      const line = await header.evaluate(e => { const label = e.querySelector('.ng-section-closed')!, s = getComputedStyle(label)
        return { height: Math.round(e.getBoundingClientRect().height), display: s.display, align: s.alignItems, action: getComputedStyle(label, '::after').content } })
      expect(line, 'U25: one compact line, section name and Show action').toEqual({ height: 44, display: 'flex', align: 'center', action: '"Show"' })
      // The resting label, not its hover: the mouse that closed it is still over it.
      await page.mouse.move(viewport.width - 2, viewport.height - 2)
      const contrast = await header.evaluate(e => {
        const lum = (color: string) => { const c = color.match(/\d+/g)!.slice(0, 3).map(x => { const n = +x / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4 }); return c[0] * .2126 + c[1] * .7152 + c[2] * .0722 }
        const fg = lum(getComputedStyle(e).color), bg = lum(getComputedStyle(e.closest('.ng-section-card')!).backgroundColor)
        return (Math.max(fg, bg) + .05) / (Math.min(fg, bg) + .05)
      })
      expect(contrast, 'U16B-S1: the closed section label retains 7:1 contrast').toBeGreaterThanOrEqual(7)
      await header.focus(); await page.keyboard.press('Space')
    } else {
      await expect(page.locator('.ng-reader-toc')).toBeVisible()
      await expect(page.locator('.ng-reader-toc button')).toHaveCount(0)
      const toc = await page.locator('.ng-reader-toc').boundingBox()
      expect(column!.x - toc!.x - toc!.width, 'the index sits left of the column').toBeGreaterThanOrEqual(12)
      expect(toc!.x, 'at the 24px inset').toBe(24)
      await expect(page.locator('[data-section-type=principles]'), 'no placeholder where the index carries it').toBeHidden()
      await expect(page.locator('[data-toc-type=principles]'), 'the index shows the section closed').toHaveAttribute('data-collapsed', 'true')
      await expect(page.locator('[data-toc-type=principles] .ng-section-eye'), 'with its eye').toBeVisible()
      await page.locator(READY).evaluate(e => { e.scrollTop = 0 })
      await j.clickByMouse('[data-toc-type=principles] a', 'the index row reopens the closed section')
      await expect(header).toBeFocused()
    }
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
    if (width >= 1152) await j.clickByMouse('[data-toc-type=overview] a')
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
    // CLAIM CHANGED (U59 c, owner, 2026-10-28). Old: the node's centre is under a section card. New: it is under the
    // article's grid, a section card or the token gutter between two cards of one row. Reason: desktop rows are two
    // sections side by side with a 24px gutter between them, and at 1366 on this page the node's centre (x 608) falls
    // in the gutter between Videos (1/3) and Overview (2/3); the map shows through it there by design.
    expect(await page.evaluate(({ x, y }) => {
      const hit = document.elementFromPoint(x, y)
      if (hit?.closest('.ng-section-card')) return true
      if (!hit?.matches('[data-reader-body]')) return false
      const row = [...hit.children].map(c => c.getBoundingClientRect()).filter(r => r.width && r.top <= y && r.bottom >= y)
      return row.some(l => l.right <= x) && row.some(r => r.left >= x)
    }, reading.point), 'native prose covers the stationary node (a card, or the gutter inside a row)').toBe(true)
    expect(reading.intersections, width + 'px reading: ' + JSON.stringify(reading)).toEqual([])
    const column = await page.locator('.ng-reader-article').boundingBox()
    expect(column!.x).toBe(Math.max(12, (width - 680) / 2))
  }
})

for (const viewport of [{ width: 1440, height: 900 }, { width: 1152, height: 900 }, { width: 1024, height: 768 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
  // STALE CONTRACT (D-338, owner): no header names Questions or Moves and the index has no eyes.
  // Each closes with its own ✕ and leaves a legible label that names the surface it reopens.
  // The index heading reads role first, one phrase (reversing D-331 N1).
  // STALE CONTRACT (D-355, U9 b and U11): the index sits LEFT of the column; where it shows, a closed part
  // leaves no label in the content and its index row (closed, with its eye) reopens it. Without the index
  // the compact label keeps its 44px target, its contrast and the surface it names.
  test(`@curated D-338 ${viewport.width}px Questions and Moves close with their own ✕ and the other node half changes role`, async ({ page }) => {
    await page.setViewportSize(viewport)
    const j = journey(page); await j.boot(LOOP)
    await expect(page.locator(READY)).toBeVisible()
    await j.readerLayoutSettled()
    await expect(page.locator('.ng-reader-shelf')).toBeHidden()
    await expect(page.locator('[aria-label="Reading perspectives"]')).toHaveCount(0)
    await expect(page.locator('.ng-reader-toc h2')).toHaveText('Escaping Loop Choke from Half Guard')
    expect(await page.locator('.ng-reader-toc h2 small').evaluate(e => getComputedStyle(e).display), 'the qualifier stays in the phrase').toBe('inline')
    expect((await page.locator('.ng-reader-toc-row a').allTextContents()).slice(0, 4)).toEqual(['Videos', 'Moves', 'Questions', 'Overview'])
    const hasToc = viewport.width >= 1152
    for (const [part, close] of [['card', '[data-land-close]'], ['hand', '[data-hand-close]']]) {
      const label = page.locator(`[data-game-open="${part}"]`)
      await expect(label, 'an open part has no header').toBeHidden()
      expect(await label.evaluate((el, part) => {
        const a = (window as any).__neural
        const body = part === 'card' ? a._landEl : a.optionsRef.current, id = el.getAttribute('aria-controls')!
        return { part, control: id, body: body?.id, connected: !!body?.isConnected, same: document.getElementById(id) === body }
      }, part), 'the label names the actual game surface it reopens').toEqual({ part, control: `reader-${part}-body`, body: `reader-${part}-body`, connected: true, same: true })
      await page.locator(close).scrollIntoViewIfNeeded(); await j.readerLayoutSettled()
      if (part === 'card') await expect(page.locator('[data-landcard]'), 'the open question is a visible card').toBeVisible()
      // Moves sits beside the index's rows: the tray ends 12px short of it (clickByMouse below
      // also proves its ✕ is reachable, which it was not under an index link at 1152px).
      if (hasToc && part === 'hand') {
        const tray = await page.evaluate(() => { const a = (window as any).__neural, t = a.optionsRef.current.getBoundingClientRect(), c = a._reader.articleEl.getBoundingClientRect()
          return { gap: t.left - a._reader.contents.getBoundingClientRect().right, off: (t.left + t.right) / 2 - (c.left + c.right) / 2 } })
        expect(tray.gap, 'the Moves tray starts 12px past the index').toBeGreaterThanOrEqual(12)
        expect(Math.abs(tray.off), 'the Moves tray is centred on the article column').toBeLessThan(1)
      }
      await j.clickByMouse(close, `the ${part}'s own ✕`)
      await expect(label).toHaveAttribute('aria-expanded', 'false')
      if (hasToc) {
        await expect(page.locator(`[data-toc-type="${part}"]`)).toHaveAttribute('data-collapsed', 'true')
        await expect(label, 'no placeholder where the index carries the closed part').toBeHidden()
        expect(await page.evaluate(part => {
          const a = (window as any).__neural
          return part === 'card' ? !a._landEl : getComputedStyle(a.optionsRef.current).visibility === 'hidden'
        }, part)).toBe(true)
        await page.locator(READY).evaluate(e => { e.scrollTop = 0 })
        await j.clickByMouse(`[data-toc-type="${part}"] a`, `reopen ${part} from its index row`)
        await expect(label).toBeHidden()
        if (part === 'card') await expect(page.locator('[data-landcard]'), 'the Questions row restores a visible card').toBeVisible()
        continue
      }
      await expect(label).toBeVisible()
      expect((await label.boundingBox())!.height, 'the label keeps a 44px target').toBeGreaterThanOrEqual(44)
      const contrast = await label.evaluate(el => {
        const luminance = (color: string) => {
          const c = color.match(/\d+/g)!.slice(0, 3).map(x => { const n = +x / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4 })
          return c[0] * .2126 + c[1] * .7152 + c[2] * .0722
        }
        const fg = luminance(getComputedStyle(el).color), bg = luminance(getComputedStyle((window as any).__neural.wrapRef.current).backgroundColor)
        return (Math.max(fg, bg) + .05) / (Math.min(fg, bg) + .05)
      })
      expect(contrast, 'a closed game part leaves a legible label').toBeGreaterThanOrEqual(7)
      expect(await page.evaluate(part => {
        const a = (window as any).__neural
        return part === 'card' ? !a._landEl : getComputedStyle(a.optionsRef.current).visibility === 'hidden'
      }, part)).toBe(true)
      await j.clickByMouse(`[data-game-open="${part}"]`, `reopen ${part} from its label`)
      await expect(label).toBeHidden()
      // D-336: the restore half shows the card, not only the control's state (D-318's reader gate).
      if (part === 'card') await expect(page.locator('[data-landcard]'), 'the Questions label restores a visible card').toBeVisible()
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
    await expect(page.locator('.ng-reader-toc h2')).toHaveText('Attacking Loop Choke from Half Guard')
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
test('@curated a late question backfill retains the closed label\'s target', async ({ page }) => {
  const j = journey(page)
  await j.boot('/Positions/Mount/Top')
  await expect(page.locator(READY)).toBeVisible()
  expect(await j.landQuestion()).not.toBeNull()
  const proof = await page.evaluate(() => {
    const a = (window as any).__neural, before = a._landEl, question = before.querySelector('[data-land-q]')
    a._landBackfill()
    const eye = document.querySelector('[data-game-open=card]')!, body = document.getElementById(eye.getAttribute('aria-controls')!)
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
        position: cs.position, z: +cs.zIndex, pointer: toc.style.pointerEvents, inset: box.left, controlInset: innerWidth - edge.right,
        surfaces: [toc, ...toc.querySelectorAll('a,button')].map(e => {
          const s = getComputedStyle(e); return { bg: s.backgroundColor, image: s.backgroundImage, border: s.borderTopWidth, shadow: s.boxShadow }
        }), top: box.top }
    })
    expect(surface.graphOn).toBe(true)
    expect(surface.before).toEqual(surface.without)
    expect(surface.before).toEqual({ left: 380, width: 680 })
    expect(surface).toMatchObject({ sibling: true, position: 'fixed', z: 6, pointer: 'auto' })
    // STALE CONTRACT (D-355, U9 b): the index sits on the LEFT, at the 24px inset it had on the right.
    expect(surface.inset).toBe(24)
    for (const s of surface.surfaces) expect(s).toEqual({ bg: 'rgba(0, 0, 0, 0)', image: 'none', border: '0px', shadow: 'none' })
    // STALE CONTRACT (D-338): the index lost its eyes; a section closes with its own ✕ in the
    // column. RETIRED with the eyes: "eye changes visibility" and the label/eye colour match.
    await page.locator('[data-section-toggle=principles]').scrollIntoViewIfNeeded(); await j.readerLayoutSettled()
    await j.clickByMouse('[data-section-toggle=principles]', "the section's ✕ closes it without capturing the canvas")
    await expect(page.locator('[data-section-type=principles]')).toHaveAttribute('data-collapsed', 'true')
    await page.locator(READY).evaluate(e => { e.scrollTop = 0 })
    const contrast = await page.locator('[data-toc-type=principles] a').evaluate(label => {
      const a = (window as any).__neural, cs = getComputedStyle(label)
      const lum = (s: string) => { const c = s.match(/[\d.]+/g)!.slice(0, 3).map(x => { const n = +x / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4 }); return c[0] * .2126 + c[1] * .7152 + c[2] * .0722 }
      const fg = lum(cs.color), backgrounds = [getComputedStyle(a.wrapRef.current).backgroundColor, getComputedStyle(document.querySelector('.ng-section-card')!).backgroundColor, cs.textShadow.match(/rgb\([^)]+\)/)?.[0]]
      return { labelColor: cs.color, shadow: cs.textShadow,
        ratios: backgrounds.map(bg => { const b = lum(bg!); return (Math.max(fg, b) + .05) / (Math.min(fg, b) + .05) }) }
    })
    expect(contrast.shadow).not.toBe('none')
    for (const ratio of contrast.ratios) expect(ratio).toBeGreaterThanOrEqual(7)
    // STALE CONTRACT (D-355, U11): on a desktop a closed section leaves no placeholder, so its index row
    // reopens it and focuses its header; Space on that header still toggles it.
    await j.clickByMouse('[data-toc-type=principles] a', 'the index row reopens the closed section')
    await expect(page.locator('[data-section-toggle=principles]')).toBeFocused()
    await expect(page.locator('[data-section-type=principles]')).toHaveAttribute('data-collapsed', 'false')
    expect((await page.locator('.ng-reader-toc').boundingBox())!.y).toBe(surface.top)
    await page.keyboard.press('Space')
    await expect(page.locator('[data-section-type=principles]')).toHaveAttribute('data-collapsed', 'true')
    await expect(page.locator('[data-toc-type=principles] a')).toHaveCSS('color', contrast.labelColor)
    const eye = (await page.locator('[data-toc-type=principles] a').boundingBox())!
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
  const j = journey(page); await j.boot(KNEE + '/Attacker', { initialState: QUIET })
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
  const j = journey(page); await j.boot(KNEE + '/Attacker', { initialState: QUIET })
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

for (const width of [1440, 390]) test(`@curated ${width}px unknown authored sections and cross-section anchors survive regrouping`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
  const j = journey(page)
  await j.boot(KNEE + '/Attacker', { initialState: QUIET })
  await expect(page.locator(READY)).toBeVisible()
  const path = '/Learning/Section-Shape-Fixture'
  await page.route('**' + path, route => route.fulfill({ contentType: 'text/html', body: '<h1>Section shape fixture</h1><article><h2 id="key-principles">Principles</h2><p>First complete authored statement. <a href="#legacy-notes">Read the original notes</a></p><h2 id="legacy-notes">Legacy notes</h2><p>Unmapped content survives in full.</p><h3 id="deep-note">An authored subheading</h3><p>Its detail also survives.</p><h2 id="related">Related</h2><p>A related source.</p><h2 id="sources">Sources</h2><p>A final citation.</p></article>' }))
  await page.evaluate(path => (window as any).__neural._readArticle(path), path)
  await expect(page.locator(READY)).toHaveAttribute('data-reader-path', path)
  await expect(page.locator(READY)).toHaveAttribute('data-reader-ready', 'true')
  expect(await page.locator('.ng-section-card').evaluateAll(es => es.map(e => e.getAttribute('data-section-type')))).toEqual(['principles', 'additional', 'related', 'sources'])
  await expect(page.locator('[data-section-type=additional]')).toContainText('Unmapped content survives in full.')
  await expect(page.locator('[data-section-type=additional]')).toContainText('Its detail also survives.')
  const original = await page.locator('[data-reader-body]').textContent()
  const followAnchor = async () => {
    const anchor = page.locator('[data-reader-anchor=legacy-notes]')
    await anchor.scrollIntoViewIfNeeded(); await j.readerLayoutSettled()
    // STALE SPEC (D-482): the approved side-by-side grid wraps this inline link.
    // Its union-box centre is blank paragraph space, not a link fragment. Hit-test
    // the first actual fragment, still rejecting ancestors/overlays; use a real mouse.
    const hit = await anchor.evaluate(el => {
      const rect = el.getClientRects()[0]
      if (!rect || !rect.width || !rect.height) return { x: 0, y: 0, reachable: false }
      const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2
      const top = document.elementFromPoint(x, y)
      let opacity = 1, visible = true
      for (let parent: Element | null = el; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent)
        opacity *= Number(style.opacity); visible &&= style.visibility === 'visible'
      }
      return { x, y, reachable: visible && opacity >= .99 && x >= 0 && y >= 0 && x < innerWidth && y < innerHeight && !!top && (top === el || el.contains(top)) }
    })
    expect(hit.reachable, 'D-482: the authored link text is reachable by mouse').toBe(true)
    await page.mouse.click(hit.x, hit.y)
  }
  await followAnchor()
  expect(await page.evaluate(() => document.activeElement?.closest('[data-section-type]')?.getAttribute('data-section-type'))).toBe('additional')
  const body = page.locator('[data-section-type=additional] .ng-section-body')
  await body.evaluate(e => { (e as HTMLElement).tabIndex = 0; (e as HTMLElement).focus() })
  await page.evaluate(() => { const a = (window as any).__neural; a.set('readerSection.additional', false); a._applyLayers() })
  // U11 / U25 a: closing moves focus to the index or the phone disclosure summary.
  await expect(page.locator(width === 1440 ? '[data-toc-type=additional] a' : '.ng-reader-hidden>summary')).toBeFocused()
  await expect(body).toBeHidden()
  expect(await body.evaluate(e => (e as HTMLElement).inert)).toBe(true)
  // REAL BREAK (D-482): the old anchor path measured a closed, hidden control.
  // Both widths must reveal the SAME target and focus its visible anchor destination.
  await body.evaluate(e => { (window as any).__anchorTargetBody = e })
  await followAnchor()
  await expect(page.locator('[data-section-toggle=additional]'), 'D-482: a cross-section anchor reveals its closed target').toHaveAttribute('aria-expanded', 'true')
  await expect(body).toBeVisible()
  expect(await body.evaluate(e => e === (window as any).__anchorTargetBody && !(e as HTMLElement).inert)).toBe(true)
  expect(await page.locator('[data-section-type=additional]').evaluate(card => {
    const el = document.activeElement!
    const box = el.getBoundingClientRect(), root = card.closest('[data-reader]')!.getBoundingClientRect()
    return card.contains(el) && box.width > 0 && box.height > 0 && box.top >= root.top && box.top < root.bottom
  }), 'the anchor destination is inside the reader').toBe(true)
  expect(new URL(page.url()).hash).toBe('#legacy-notes')
  expect(await page.locator('[data-reader-body]').textContent(), 'every authored character returns in source order').toBe(original)
  expect(await state(page)).toMatchObject({ paused: true, played: false, deals: 0, misses: 0 })
})

// D-351: the other mid-game path change. An exchange lands on a new node whose article (and its
// Videos section, which leads the view since D-338) arrives after the landing: the reader holds
// the new landing's card and hand until it renders, so neither is ever shown at one place and
// then moved. Each role page is held 500ms; the hub fetched after it is not, so holds never stack.
test('D-351: an exchange whose article lands late never moves the new card or hand once shown', async ({ page }) => {
  const j = journey(page)
  await j.boot('/')
  await j.land('Mount Top')
  await expect(page.locator(READY)).toBeVisible()
  await j.rig('resolve', [0]); await j.rig('outcome', Array(32).fill(0)); await j.rig('opp-finish', [0.99])
  const held: string[] = []
  await page.route((url) => /^\/(Positions|Transitions|Submissions)\/.*\/(Top|Bottom|Attacker|Defender)$/.test(url.pathname), async (route) => {
    if (route.request().resourceType() === 'fetch') { held.push(new URL(route.request().url()).pathname); await new Promise((r) => setTimeout(r, 500)) }
    await route.continue()
  })
  const start = await page.evaluate(() => {
    const w = window as any, a = w.__neural, out: any[] = (w.__d351 = [])
    const rect = (el: HTMLElement | null) => {
      const box = el?.getBoundingClientRect()
      return el && box!.height && getComputedStyle(el).visibility !== 'hidden' ? Math.round(box!.top * 2) / 2 : null
    }
    const tick = () => {
      const r = a._reader
      out.push({ idx: a._landIdx, ready: r.root.dataset.readerReady, path: r.path, present: !!a._landEl, card: rect(a._landEl), hand: rect(a.optionsRef.current) })
      if (!w.__d351stop) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
    return a._landIdx
  })
  // A move that leaves Mount for a full position (its own deck, hand and Videos section).
  const opt = await page.evaluate(() => {
    const a = (window as any).__neural, dealt = (a.optionIdxs || []).map((i: number) => a.nodes[i].t)
    return ['Mount to Knee on Belly', 'Mount to 3-4 Mount'].find((t) => dealt.includes(t)) ?? null
  })
  expect(opt, 'the hand deals a move to another position').toBeTruthy()
  await j.pick(opt!)
  // The exchange's execution and flight run on the pumped clock (camera-continuity samples 6s).
  for (let i = 0; i < 40; i++) await j.advance(150)
  await expect.poll(async () => { await j.advance(150); return page.evaluate((s) => { const a = (window as any).__neural, r = a._reader
    return { landed: a._landIdx === a.currentPos && a.currentPos !== s, card: !!a._landEl, ready: r.root.dataset.readerReady, path: r.path } }, start) },
    { timeout: 20_000, intervals: [100], message: 'the exchange landed and its article rendered' }).toMatchObject({ landed: true, card: true, ready: 'true', path: expect.stringMatching(/^\/Positions\/(Knee-on-Belly|Mount\/3-4-Mount)/) })
  // Keep tracing the published landing for a while: a late move would show after publication.
  await expect.poll(() => page.evaluate(() => { const w = window as any; return w.__d351.filter((x: any) => x.idx === w.__neural._landIdx && x.card != null).length }),
    { message: 'the published landing was traced for 30 frames' }).toBeGreaterThan(30)
  const S = await page.evaluate(() => { (window as any).__d351stop = true; return (window as any).__d351 as any[] })
  const landed = S[S.length - 1], mine = S.filter((x) => x.idx === landed.idx)
  const rendered = (x: any) => x.ready === 'true' && x.path === landed.path
  expect(held.length, 'premise: the landing article fetch was held').toBeGreaterThan(0)
  expect(mine.some((x) => x.present && !rendered(x)), 'premise: the new landing existed while its article was loading').toBe(true)
  for (const part of ['card', 'hand'] as const) {
    const tops = mine.map((x) => x[part]).filter((y) => y != null)
    expect(tops.length, `premise: the new ${part} was traced on screen`).toBeGreaterThan(3)
    expect(Math.max(...tops) - Math.min(...tops), `the new ${part} is shown once, at its final place`).toBeLessThan(0.5)
  }
})

// D-352 S1: a landing laid out with the article put away is live (its hand and card play in the
// map view). Showing the article while that landing's page is still loading must not hide the live
// hand again: it publishes pinned at once, as the ceiling does, so the late article cannot move it
// either. Review-claude measured the failure: the hand pending (hidden, digits inert) for 49 frames,
// t63 to t859, while its card stayed live.
test('D-352: showing the article while its page loads never hides the live hand again', async ({ page }) => {
  const j = journey(page)
  await j.boot('/', { initialState: { v: 2, settings: { readerBook: false }, settingsAt: {} } })
  const held: string[] = []
  await page.route((url) => url.pathname === '/Positions/Mount/Top', async (route) => {
    if (route.request().resourceType() === 'fetch') { held.push(new URL(route.request().url()).pathname); await new Promise((r) => setTimeout(r, 2500)) }
    await route.continue()
  })
  await j.land('Mount Top')
  await expect.poll(() => held.length, { message: 'premise: the landing asked for its article, and it is held' }).toBeGreaterThan(0)
  const before = await page.evaluate(() => { const a = (window as any).__neural, r = a._reader; return { book: a.get('readerBook', true), ready: r.root.dataset.readerReady === 'true' && r.path === '/Positions/Mount/Top', hand: !!a.optionsRef.current?.querySelector('[data-tech]') } })
  expect(before, 'premise: the hand is live in the map view and its article has not rendered').toEqual({ book: false, ready: false, hand: true })
  await page.evaluate(() => {
    const w = window as any, out: any[] = (w.__d352 = [])
    const tick = () => {
      const a = w.__neural, r = a._reader, row = a.optionsRef.current, box = row?.getBoundingClientRect()
      out.push({ book: a.get('readerBook', true) !== false, ready: r.root.dataset.readerReady === 'true' && r.path === '/Positions/Mount/Top', pending: !!row?.hasAttribute('data-reader-pending'), shown: !!row && !!box!.height && getComputedStyle(row).visibility !== 'hidden', top: box ? Math.round(box.top * 2) / 2 : null })
      if (!w.__d352stop) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  await j.clickByMouse('[data-layer-show="book"]', 'show the article while its page is still loading')
  await expect.poll(() => page.evaluate(() => (window as any).__d352.filter((x: any) => x.ready).length), { timeout: 10_000, message: 'the held article rendered' }).toBeGreaterThan(10)
  const S = await page.evaluate(() => { (window as any).__d352stop = true; return (window as any).__d352 as any[] })
  const book = S.filter((x) => x.book)
  expect(book.some((x) => !x.ready), 'premise: the article was shown while its page was still loading').toBe(true)
  expect(book.filter((x) => x.pending || !x.shown), 'the live hand is never hidden again').toEqual([])
  const i = S.findIndex((x) => x.ready)
  expect(S.slice(i, i + 10).map((x) => x.top), 'and the late article does not move it').toEqual(Array(Math.min(10, S.length - i)).fill(S[i - 1].top))
})

// D-352 N2: D5-S2's clamp and N3's order, each gated. At arrival the reader sits above the question,
// so Home and PageUp never move the view down; and the hand comes before the closed Questions label in
// the reader's DOM, so Tab reads Moves, then Questions.
test('D-352: at arrival Home and PageUp never move the reader down, and Moves precede Questions in the DOM', async ({ page }) => {
  const j = journey(page)
  await j.boot('/')
  await j.land('Mount Top')
  await expect(page.locator(READY)).toBeVisible()
  await j.readerLayoutSettled()
  const order = await page.evaluate(() => {
    const a = (window as any).__neural, r = a._reader, row = a.optionsRef.current, label = r.gameSections.find((s: any) => s.part === 'card').card
    return { adopted: row.parentElement === r.game, before: !!(row.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING) }
  })
  expect(order, 'the hand comes before the Questions label in the reader flow').toEqual({ adopted: true, before: true })
  const top = () => page.evaluate(() => (window as any).__neural._reader.root.scrollTop)
  const top0 = await top()
  for (const key of ['PageUp', 'Home']) {
    await page.keyboard.press(key)
    await j.readerLayoutSettled()
    expect(await top(), `${key} never moves the view down at arrival`).toBeLessThanOrEqual(top0)
  }
  await page.keyboard.press('End')
  await j.readerLayoutSettled()
  expect(await top(), 'premise: the keys reach the reader (End moves it to the question)').toBeGreaterThan(top0)
})

// D-354 (found by H95/H97: choice-value's setup poll "native host module must actually be requested" red 3 of
// 20 isolated): REAL BREAK from D-351. The reader holds a reading-view hand pending, and so hidden, until
// its article renders; the game-value activation refuses a hidden hand (_gameValuePlayable), so one that
// came during the hold went idle, and only a later refreshChoiceValues (a deck load, a layer change) could
// retry it. When the hand published after the last of those, the Win chance never started. Publication
// now starts it. (choice-value.spec.ts refuses a mutated bundle, so the gate lives here.) Mount Top's role page is held past the 800ms ceiling, so the activation meets the held
// hand; the claim reads the publication frame itself, before any later refresh could rescue it.
test('D-354: a hand the reader held starts its Win chance once it publishes', async ({ page }) => {
  const requested: string[] = []
  page.on('request', request => { if (/\/app\/game-values\.js(?:\?|$)/.test(request.url())) requested.push(request.url()) })
  const j = journey(page)
  await j.boot('/')
  const held: string[] = []
  await page.route(url => url.pathname === '/Positions/Mount/Top', async route => {
    if (route.request().resourceType() === 'fetch') { held.push(route.request().url()); await new Promise(r => setTimeout(r, 1500)) }
    await route.continue()
  })
  await page.evaluate(() => {
    const w = window as any, out: any[] = (w.__d354gv = [])
    const tick = () => {
      const a = w.__neural, row = a?.optionsRef?.current
      if (row?.isConnected) out.push({ pending: row.hasAttribute('data-reader-pending'),
        active: !!(a._gameValueLoading || a._gameValueRuntime || a._gameValueFailed || a._gameValueActivationFrame != null || a._gameValueActivationTask != null) })
      if (out.length < 900) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  const before = requested.length
  await j.land('Mount Top')
  await expect.poll(() => page.evaluate(() => { const t = (window as any).__d354gv as any[]; return t.some(x => x.pending) && !t[t.length - 1].pending }),
    { message: 'premise: the hand was held pending, then published', timeout: 10_000 }).toBe(true)
  const S: any[] = await page.evaluate(() => (window as any).__d354gv)
  const pub = S.findIndex((x, i) => i > 0 && S[i - 1].pending && !x.pending)
  expect(held.length, 'premise: the Mount Top article fetch was held 1.5s').toBeGreaterThan(0)
  expect(before, 'premise: no game-value import before the held landing').toBe(0)
  expect(S.slice(0, pub).some(x => x.pending && !x.active), 'premise: the held hand had no game-value activation').toBe(true)
  expect(S[pub].active, 'the Win chance starts in the frame the held hand publishes').toBe(true)
  await expect.poll(() => requested.length, { message: 'the Win chance starts once the held hand publishes', timeout: 10_000 }).toBeGreaterThan(0)
})
