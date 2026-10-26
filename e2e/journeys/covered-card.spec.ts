import { test, expect } from '@playwright/test'
import { journey } from '../dsl'
import { coveredCatch, coveredRolls } from '../fixtures/covered-card'
import { questionGeometry, watchQuestionScroll, stopQuestionScroll } from '../fixtures/question-geometry'

// U34–U37, owner 26 October 2026. The media assertion uses real authored
// dossiers and every production question builder, including dormant node MC.
// The mutant runner injects a Watch control into _mountLandQ and must fail at
// "U35 question surfaces contain no media/watch controls", not at setup.
// Heartbeat samples seek real CSS animations; no 30-second wall-clock sleep.
// Host evidence is required before calling either mutant or these gates green.

const state = (page: any) => page.evaluate(() => {
  const a = (window as any).__neural
  return { opened: !!a._landQ?.opened, remaining: a._decision?.remaining ?? null,
    q: a._landQ?.card.q, page: a._landPage, qMod: a._qMod || 0,
    grades: (a.beats || []).filter((b: any) => ['mc_correct', 'mc_wrong', 'land_q_expired'].includes(b.beat)).length }
})

for (const width of [1440, 390]) {
  test(`@curated U34 cover gates mouse, keys and time per card (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
    const j = journey(page)
    await j.boot('/', { seedRolls: coveredRolls })
    await j.land('Mount Top')
    const cover = page.locator('[data-question-reveal]')
    await expect(cover.locator('strong')).toHaveText('Reveal')
    await expect(cover.locator('small')).toHaveText('Answer for a boost')
    const before = await state(page)
    expect(before.opened).toBe(false)
    expect(before.remaining).toBeNull()
    await page.keyboard.press('a')
    await page.keyboard.press('b')
    await page.keyboard.press('c')
    // Exercise the same closure as mouse input as well as native inert hit testing.
    await page.evaluate(() => {
      const a = (window as any).__neural
      a._mc.answer(a._mc.correct)
      ;(document.querySelector('[data-land-mc-opt]') as HTMLElement).click()
    })
    await j.advance(20000)
    expect(await state(page), 'covered input and time cannot grade or charge').toEqual(before)
    expect(await page.locator('[data-land-mc-opt]').first().evaluate(el => {
      const r = el.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
      return el.contains(hit)
    }), 'covered answers cannot intercept the mouse').toBe(false)
    await j.openQuestion()
    expect((await state(page)).remaining).toBeGreaterThan(0)
    await j.advance(500)
    const opened = await state(page)
    await j.clickByMouse('[data-land-next]', 'page to a different covered card')
    await expect.poll(async () => (await state(page)).page).toBe(opened.page + 1)
    expect(await state(page)).toMatchObject({ opened: false, remaining: null, grades: 0 })
    await j.advance(20000)
    await j.clickByMouse('[data-land-prev]', 'return to the partly used question')
    expect(await state(page)).toMatchObject({ opened: true, remaining: opened.remaining, q: opened.q })
    await page.evaluate(() => (window as any).__neural._landBackfill())
    await j.landSettled()
    expect(await state(page), 'backfill preserves consent and the remaining window').toMatchObject({ opened: true, remaining: opened.remaining, q: opened.q })
    const correct = await page.evaluate(() => (window as any).__neural._mc.correct)
    await page.keyboard.press('abc'[correct])
    expect((await state(page)).grades).toBe(1)
    await page.keyboard.press('abc'[correct])
    expect((await state(page)).grades).toBe(1)
  })
}

// D-433 (2026-10-26): D-370 adapted to U35 replaces v1's overstrict combined
// question+Moves fit premise. Reveal on arrival and EVERY opened answer must be
// hit-testable without scrolling. Moves may need user scroll; their subtree,
// dimensions, untimed lifetime and real escape after expiry remain guarded.
for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 390, height: 631 }]) {
  test(`@curated U35 D-433 Reveal and answers need no scroll; native Moves stay untimed (${viewport.width}x${viewport.height})`, async ({ page }, info) => {
    await page.setViewportSize(viewport)
    const j = await coveredCatch(page)
    await watchQuestionScroll(page)
    const covered = await questionGeometry(page)
    await info.attach('covered-arrival-geometry', { body: JSON.stringify(covered, null, 2), contentType: 'application/json' })
    expect(covered.scrollTop, 'D-433 arrival has no reader scroll').toBe(0)
    expect(covered.reveal, 'D-433 Reveal is hit-testable on arrival without scrolling').toMatchObject({ hit: true, inside: true })
    expect(covered.reveal!.opacity).toBeGreaterThan(.05)
    expect(covered.reveal!.rect.width).toBeGreaterThanOrEqual(44)
    expect(covered.reveal!.rect.height).toBeGreaterThanOrEqual(44)
    expect(covered.card.height, 'the covered question retains the original 12px edge-margin fit budget').toBeLessThanOrEqual(covered.bounds.bottom - covered.bounds.top - 24)
    if (viewport.height < 700) {
      expect(covered.answerBlock, 'D-433 short cover actually collapses the inline answer block').toMatchObject({ display: 'none', height: 0, inert: true })
      expect(covered.stage.height, 'D-433 short cover reserves only its 60px Reveal target').toBe(60)
    }
    if (viewport.width > 640) {
      // Desktop keeps the original, stronger combined-height claim too.
      expect(Math.max(covered.moves.bottom, covered.card.bottom) - Math.min(covered.moves.top, covered.card.top),
        'desktop covered question plus native Moves fits with the original 12px edge margins').toBeLessThanOrEqual(covered.bounds.bottom - covered.bounds.top - 24)
    }
    await j.engage()
    await j.advance(20000)
    expect((await state(page)).remaining).toBeNull()
    await page.evaluate(() => {
      const a = (window as any).__neural
      ;(window as any).__coveredHand = { el: a.optionsRef.current, parent: a.optionsRef.current.parentNode,
        cards: [...a.optionsRef.current.querySelectorAll('[data-tech]')], html: a.optionsRef.current.innerHTML }
    })
    // Deliberately NOT openQuestion()/locator.click(): those helpers can scroll.
    await j.clickByMouse('[data-question-reveal]', 'D-433 Reveal at the arrival position')
    await expect(page.locator('[data-question-reveal]')).toHaveCount(0)
    await j.readerLayoutSettled()
    const opened = await questionGeometry(page)
    const scroll = await stopQuestionScroll(page)
    await info.attach('opened-geometry-and-scroll-writers', { body: JSON.stringify({ opened, scroll }, null, 2), contentType: 'application/json' })
    expect(scroll.writes, 'D-433 no automatic scroll writer through Reveal').toEqual([])
    expect(scroll.after).toBe(scroll.before)
    expect(scroll.pageAfter).toBe(scroll.pageBefore)
    expect(scroll.events.every(value => value === scroll.before), 'D-433 no browser scroll anchoring through Reveal').toBe(true)
    expect(opened.answers).toHaveLength(3)
    for (const answer of opened.answers) {
      expect(answer, 'D-433 every revealed answer is hit-testable without scrolling').toMatchObject({ inside: true, hit: true })
      expect(answer.opacity).toBeGreaterThan(.05)
      expect(answer.rect.height, 'the native answer keeps its 44px target').toBeGreaterThanOrEqual(44)
      expect(answer.rect.width).toBeGreaterThanOrEqual(44)
      expect(answer.bottomMargin, 'D-370 answer clearance survives U35').toBeGreaterThanOrEqual(8)
      expect(answer.fontSize, 'answer typography is unchanged').toBe('12px')
    }
    expect(opened.card.height, 'the opened question retains the original 12px edge-margin fit budget').toBeLessThanOrEqual(opened.bounds.bottom - opened.bounds.top - 24)
    expect(opened.answerBlock).toMatchObject({ display: 'flex', visibility: 'visible', inert: false })
    expect((await state(page)).remaining).toBeGreaterThan(0)
    const hand = await page.evaluate(() => {
      const a = (window as any).__neural, h = (window as any).__coveredHand
      return { same: h.el === a.optionsRef.current, parent: h.parent === h.el.parentNode,
        cards: h.cards.every((el: Element) => h.el.contains(el)), html: h.html === h.el.innerHTML,
        outside: !a._landEl.contains(h.el), covered: !!h.el.closest('[data-question-covered]') }
    })
    expect(hand, 'Reveal leaves the separate native Moves subtree untouched').toEqual({ same: true, parent: true, cards: true, html: true, outside: true, covered: false })
    expect([opened.moves.width, opened.moves.height], 'Reveal does not resize native Moves').toEqual([covered.moves.width, covered.moves.height])
    if (viewport.width <= 640) {
      expect(opened.moves.top - opened.card.bottom, 'D-433 separate Moves follows the phone question without overlap').toBeGreaterThanOrEqual(16)
      expect(await page.evaluate(() => {
        const a = (window as any).__neural
        return !!(a._landEl.compareDocumentPosition(a.optionsRef.current) & Node.DOCUMENT_POSITION_FOLLOWING)
      }), 'phone Tab order follows the visible question then Moves').toBe(true)
    }
    // Even a question timeout cannot take the player's escape away. Only this
    // explicit user-scroll phase may move the reader; the no-scroll audit ended.
    await j.advance(20000)
    const escape = '.ng-choice-title-button'
    await page.locator(escape).first().scrollIntoViewIfNeeded()
    await j.readerLayoutSettled()
    await j.clickByMouse(escape, 'choose the native escape after the question expires')
    await j.advanceUntil('relief', 12000)
    await j.expectBeat('escape')
  })
}

test('@curated U35 every question builder segregates technique media', async ({ page }) => {
  const j = await coveredCatch(page)
  await expect(page.locator('.ng-landfilm .ng-clip')).toHaveCount(1)
  const builders = await page.evaluate(() => {
    const a = (window as any).__neural, { key, card } = a._landQ, deck = a.flashcards.decks[key]
    const host = document.createElement('div'); host.dataset.questionAudit = ''
    document.body.append(host)
    const add = (name: string, el: HTMLElement) => {
      if (!el) throw Error('Question builder absent: ' + name)
      el.dataset.questionSurface = name; host.append(el)
    }
    a._landEl.dataset.questionSurface = 'covered-catch'
    add('inline-flashcards', a._miniDeck(key, deck, false, 'u35'))
    for (const surface of ['deck', 'checkpoint', 'node', 'land', 'panic']) {
      add('mc-' + surface, a._mcBlock(card, key, () => {}, surface))
      add('recall-' + surface, a._recallBlock(card, key, () => {}, surface))
    }
    const node = document.createElement('div')
    a._renderNodeQuestion(a.nodes[a._landIdx], node)
    if (!node.textContent) throw Error('Node question fixture is empty')
    add('node-question', node)
    // renderDrill owns the full study/checkpoint face and its footer, beyond the
    // shared MC block. Clone its emitted DOM before the next format replaces it.
    for (const mode of ['classic', 'mc']) {
      a.set('mcMode', mode); a.openStudy(key); a.deckIdx = 0; a.revealed = false; a.renderDrill()
      if (!a.drillListRef.current.textContent) throw Error('Study fixture is empty')
      add('study-' + mode, a.drillListRef.current.cloneNode(true))
      if (mode === 'classic') {
        a.revealed = true; a.renderDrill()
        add('study-revealed', a.drillListRef.current.cloneNode(true))
      }
    }
    return [...document.querySelectorAll('[data-question-surface]')].map(e => e.getAttribute('data-question-surface'))
  })
  expect(builders).toHaveLength(16)
  const violations = await page.locator('[data-question-surface]').evaluateAll(roots => roots.flatMap(root => {
    const controls = [...root.querySelectorAll('button,a,[role=button]')].filter(e => /watch|play (?:video|technique)|next video/i.test((e.textContent || '') + ' ' + e.getAttribute('aria-label')))
    const media = [...root.querySelectorAll('video,iframe,[poster],.ng-clip,.ngPlayerHost,[data-film-play],[data-choice-watch],img[src*="ytimg"],a[href*="youtu"]')]
    return [...new Set([...controls, ...media])].map(el => ({ surface: root.getAttribute('data-question-surface'), html: el.outerHTML }))
  }))
  expect(violations, 'U35 question surfaces contain no media/watch controls').toEqual([])
  await expect(page.locator('.ng-landfilm [data-film-play]')).toHaveCount(1)
  // The positive film witness excludes an empty-content harness as an explanation.
  expect((await j.beats()).some(b => b.beat === 'caught')).toBe(true)
})

test('@curated U36 one active double beat then soft 30-second rhythm; reduced motion is static', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  const j = await coveredCatch(page, true)
  const timing = await page.locator('.ng-vignette').evaluate(el => {
    const animations = el.getAnimations() as CSSAnimation[]
    ;(window as any).__catchAnimations = animations
    return animations.map(a => ({ name: a.animationName, ...a.effect!.getTiming() }))
  })
  expect(timing.map(t => ({ name: t.name, duration: t.duration, delay: t.delay, iterations: t.iterations }))).toEqual([
    { name: 'ngCatchStart', duration: 1000, delay: 0, iterations: 1 },
    { name: 'ngHeartbeat', duration: 30000, delay: 1000, iterations: Infinity },
  ])
  const sample = async (time: number) => page.locator('.ng-vignette').evaluate(async (el, time) => {
    for (const animation of (window as any).__catchAnimations) { animation.pause(); animation.currentTime = time }
    await new Promise(requestAnimationFrame)
    return Number(getComputedStyle(el).opacity)
  }, time)
  for (const [time, opacity] of [[0, .34], [50, 1], [180, .44], [235, .74], [460, .35], [1000, .136], [2500, .4], [6400, .176], [8050, .296], [31000, .136], [32500, .4]]) {
    expect(await sample(time), 'U36 opacity at ' + time + 'ms').toBeCloseTo(opacity, 3)
  }
  await j.openQuestion()
  await j.advance(2000)
  expect(await page.locator('.ng-vignette').evaluate(el => (el.getAnimations() as CSSAnimation[]).find(a => a.animationName === 'ngHeartbeat')!.effect!.getTiming().duration), 'question time cannot accelerate the catch rhythm').toBe(30000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect.poll(() => page.locator('.ng-vignette').evaluate(el => ({ opacity: Number(getComputedStyle(el).opacity), animations: el.getAnimations().length }))).toEqual({ opacity: .144, animations: 0 })
  expect(await page.evaluate(() => (window as any).__neural.get('dangerAnimation', true))).toBe(true)
})
