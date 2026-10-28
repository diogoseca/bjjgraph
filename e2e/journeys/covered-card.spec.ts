import { test, expect } from '@playwright/test'
import { journey } from '../dsl'
import { coveredCatch, coveredRolls } from '../fixtures/covered-card'
import { questionGeometry, watchQuestionScroll, stopQuestionScroll } from '../fixtures/question-geometry'

// U47 d (owner, 27 October 2026) supersedes U34 a's in-card Reveal: a landing asks
// with its question alone, and "Answer for Points" (or a tap on the question) shows
// today's card for the rest of that landing. U35–U37 and D-433 are unchanged. The
// media assertion uses real authored dossiers and every production question builder,
// including dormant node MC. The mutant runner injects a Watch control into
// _mountLandQ and must fail at "U35 question surfaces contain no media/watch
// controls", not at setup. Heartbeat samples seek real CSS animations; no 30-second
// wall-clock sleep.

const state = (page: any) => page.evaluate(() => {
  const a = (window as any).__neural
  return { asking: !!a._landAsk, remaining: a._decision?.remaining ?? null,
    q: a._landQ?.card.q, page: a._landPage, qMod: a._qMod || 0,
    grades: (a.beats || []).filter((b: any) => ['mc_correct', 'mc_wrong', 'land_q_expired'].includes(b.beat)).length,
    takenUp: (a.beats || []).filter((b: any) => b.beat === 'land_q_taken_up').length }
})
const funnelMarks = (page: any) => page.evaluate(() => ((window as any).__neural.csBeats || []).filter((b: any) => b.beat === 'funnel').map((b: any) => b.step))
// The measured, hit-tested centre of a control (the clickByMouse canon), for touch and double clicks.
const centre = (page: any, selector: string) => page.evaluate((sel: string) => {
  const e = document.querySelector(sel)!, r = e.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2
  const hit = document.elementFromPoint(x, y)
  return { x, y, hit: !!hit && e.contains(hit), inView: y > 0 && y < innerHeight }
}, selector)


// What of the card is on screen: an element counts when it takes layout.
const face = (page: any) => page.evaluate(() => {
  const a = (window as any).__neural, el = a._landEl, qw = el.querySelector('[data-land-q]')
  const shown = (e: Element | null) => !!e && e.getClientRects().length > 0
  return { asking: el.hasAttribute('data-land-ask'), question: shown(qw.firstElementChild),
    go: el.querySelectorAll('[data-land-ask-go]').length,
    answers: [...el.querySelectorAll('[data-land-mc-opt],[data-land-recall] button')].filter(shown).length,
    inert: qw.lastElementChild.inert, close: shown(el.querySelector('[data-land-close]')), count: shown(el.querySelector('[data-land-count]')),
    clock: shown(el.querySelector('[data-land-clock-track]')), backs: a._landStackEl?.childElementCount ?? 0,
    guides: [...(a._landNavEl?.querySelectorAll('button') || [])].filter((b: any) => !b.hidden).length }
})

for (const width of [1440, 390]) {
  test(`@curated U47 d a landing asks with its question alone; Answer for Points shows today's card (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
    const j = journey(page)
    await j.boot('/', { seedRolls: coveredRolls })
    await j.land('Mount Top')
    await expect(page.locator('.ng-landcard [data-land-ask-go]')).toHaveText('Answer for Points')
    // U34 a's in-card Reveal is deleted, not hidden.
    await expect(page.locator('[data-question-reveal], .ng-question-stage, [data-question-covered]')).toHaveCount(0)
    expect(await face(page), 'U47 d: on landing only the question (and its ✕) shows; the card waits').toEqual(
      { asking: true, question: true, go: 1, answers: 0, inert: true, close: true, count: false, clock: false, backs: 0, guides: 0 })
    const before = await state(page)
    expect(before, 'an arriving question has no running clock').toMatchObject({ asking: true, remaining: null })
    // Letters are INERT while the question asks (they neither answer nor take it up); only
    // Answer for Points or a tap on the question does.
    await page.keyboard.press('a')
    await page.keyboard.press('b')
    await page.keyboard.press('c')
    await page.keyboard.press('ArrowRight')
    // Exercise the same closure as mouse input as well as native inert hit testing.
    await page.evaluate(() => {
      const a = (window as any).__neural
      a._mc.answer(a._mc.correct)
      ;(document.querySelector('[data-land-mc-opt]') as HTMLElement).click()
    })
    await j.advance(20000)
    expect(await state(page), 'an asking question cannot grade, page or charge time').toEqual(before)
    await j.openQuestion()
    expect((await state(page)).takenUp, 'land_q_taken_up fires once per take-up').toBe(1)
    expect((await funnelMarks(page)).filter((m: string) => m === 'question_taken_up'), 'the funnel marks the take-up once').toHaveLength(1)
    const shown = await face(page)
    expect(shown, 'Answer for Points shows today\'s card, with no reveal control inside it').toMatchObject(
      { asking: false, question: true, go: 0, answers: 3, inert: false, close: true, count: true, clock: true })
    expect(shown.backs).toBeGreaterThan(0)
    expect(shown.guides).toBeGreaterThan(0)
    expect((await state(page)).remaining).toBeGreaterThan(0)
    await j.advance(500)
    const opened = await state(page)
    await j.clickByMouse('[data-land-next]', 'page to the next card of this landing')
    await expect.poll(async () => (await state(page)).page).toBe(opened.page + 1)
    const next = await state(page)
    expect(next, 'the shown card stays shown across paging, with its own window').toMatchObject({ asking: false, grades: 0 })
    expect(next.remaining).toBeGreaterThan(0)
    expect((await face(page)).answers).toBe(3)
    await j.clickByMouse('[data-land-prev]', 'return to the partly used question')
    expect(await state(page)).toMatchObject({ asking: false, remaining: opened.remaining, q: opened.q })
    await page.evaluate(() => (window as any).__neural._landBackfill())
    await j.landSettled()
    expect(await state(page), 'backfill keeps the card shown and the remaining window').toMatchObject({ asking: false, remaining: opened.remaining, q: opened.q })
    expect((await face(page)).asking).toBe(false)
    expect((await state(page)).takenUp, 'paging and backfill take nothing up again').toBe(1)
    const correct = await page.evaluate(() => (window as any).__neural._mc.correct)
    await page.keyboard.press('abc'[correct])
    expect((await state(page)).grades).toBe(1)
    await page.keyboard.press('abc'[correct])
    expect((await state(page)).grades).toBe(1)
  })

  test(`@curated U47 d tapping the question itself shows the card (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
    const j = journey(page)
    await j.boot('/', { seedRolls: coveredRolls })
    await j.land('Mount Top')
    const question = '.ng-landcard[data-land-ask] [data-land-ask-text]'
    // A reading gesture first — a real wheel over the article, as a phone scrolls the reader to
    // reach the question (layout C puts Moves and Videos above it). Reading declines a LIVE
    // question; it must not decline one that is still asking.
    const at = await page.evaluate(() => {
      const a = (window as any).__neural, r = a._reader.root.getBoundingClientRect(), art = a._reader.articleEl.getBoundingClientRect()
      return { x: r.left + r.width / 2, y: Math.round(Math.min(r.bottom - 24, Math.max(art.top + 24, r.top + 24))) }
    })
    await page.mouse.move(at.x, at.y)
    await page.mouse.wheel(0, 120)
    await j.advance(500)
    expect(await page.evaluate(() => (window as any).__neural._reader.interacting), 'premise: a reading gesture').toBe(true)
    expect((await j.beats()).map(b => b.beat), 'U47 d: scrolling to an asking question does not decline it').not.toContain('land_q_declined')
    await page.locator(question).scrollIntoViewIfNeeded()
    await j.readerLayoutSettled()
    await j.clickByMouse(question, 'tap the asking question')
    expect(await face(page), 'a tap on the question shows the card').toMatchObject({ asking: false, go: 0, answers: 3, inert: false })
    expect((await state(page)).remaining, 'the question taken up after a scroll starts its clock').toBeGreaterThan(0)
  })
}

// U47 d review (2026-10-28): a double tap or double click on Answer for Points graded answer A, which
// appeared under the second tap. U52 b moved the link inline, so the second tap now lands wherever
// the card puts answer A; these put it there on purpose, inside NG_LAND_TAP_GUARD_MS, which is the
// claim the guard exists for. Each first proves the second tap really lands on an answer.
const secondTapOnAnswer = async (page: any, go: string, tap: (x: number, y: number) => Promise<void>, gap: number) => {
  const at = await centre(page, go)
  expect(at, 'premise: Answer for Points is hit-testable where it sits').toMatchObject({ hit: true, inView: true })
  const t0 = Date.now()
  await tap(at.x, at.y)
  const wait = gap - 40 - (Date.now() - t0)
  expect(wait, 'premise: the second tap still falls inside the gap').toBeGreaterThan(0)
  await page.waitForTimeout(wait)
  // measured just before the second tap, so a settling layout cannot make the claim vacuous
  const a = await centre(page, '[data-land-mc-opt="0"],[data-panic-mc-opt="0"]')
  expect(a, 'premise: answer A is on screen and hit-testable').toMatchObject({ hit: true, inView: true })
  await tap(a.x, a.y)
  expect(Date.now() - t0, 'premise: the second tap fell inside the guard window').toBeLessThan(500)
  await page.waitForTimeout(600)
}
test.describe('touch', () => {
  test.use({ hasTouch: true })
  for (const gap of [180, 350]) {
    test(`@curated U47 d a double tap on Answer for Points grades nothing (touch, ${gap} ms)`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 })
      const j = journey(page)
      await j.boot('/', { seedRolls: coveredRolls })
      await j.land('Mount Top')
      await page.locator('[data-land-ask-go]').scrollIntoViewIfNeeded()
      await j.readerLayoutSettled()
      await secondTapOnAnswer(page, '[data-land-ask-go]', (x, y) => page.touchscreen.tap(x, y), gap)
      expect(await state(page), 'a double tap on Answer for Points grades nothing').toMatchObject({ asking: false, grades: 0, takenUp: 1 })
    })
  }
})

test('@curated U47 d a double click on Answer for Points grades nothing (390 landing)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const j = journey(page)
  await j.boot('/', { seedRolls: coveredRolls })
  await j.land('Mount Top')
  await page.locator('[data-land-ask-go]').scrollIntoViewIfNeeded()
  await j.readerLayoutSettled()
  await secondTapOnAnswer(page, '[data-land-ask-go]', (x, y) => page.mouse.click(x, y), 180)
  expect(await state(page), 'a double click on Answer for Points grades nothing').toMatchObject({ asking: false, grades: 0, takenUp: 1 })
})

test("@curated U47 d a double click on the catch's Answer for Points grades nothing (1440)", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await coveredCatch(page)
  await secondTapOnAnswer(page, '[data-landcard=defense] [data-land-ask-go]', (x, y) => page.mouse.click(x, y), 180)
  expect(await state(page), "a double click on the catch's Answer for Points grades nothing").toMatchObject({ asking: false, grades: 0, takenUp: 1 })
})

// U47 d review: only a wheel or touch scroll spares an asking question. Following an article link is
// leaving the question for the article: it declines, with dev's beat and funnel mark.
test('@curated U47 d following an article link declines an asking question, as on dev', async ({ page }) => {
  const j = journey(page)
  await j.boot('/', { seedRolls: coveredRolls })
  await j.land('Mount Top')
  const marked = await page.evaluate(() => {
    const link = [...document.querySelectorAll('[data-reader-body] a[href^="/Positions/"]')].find(e => (e as HTMLElement).getClientRects().length) as HTMLElement | undefined
    link?.setAttribute('data-u47-link', '')
    return !!link
  })
  expect(marked, 'premise: the article carries a position link').toBe(true)
  await page.locator('[data-u47-link]').scrollIntoViewIfNeeded()
  await j.readerLayoutSettled()
  expect((await state(page)).asking, 'premise: the question is still asking').toBe(true)
  await j.clickByMouse('[data-u47-link]', 'follow an article link')
  const declined = await page.evaluate(() => ((window as any).__neural.beats || []).filter((b: any) => b.beat === 'land_q_declined').map((b: any) => b.reason))
  expect(declined, 'following an article link declines the asking question (reason reading), as on dev').toEqual(['reading'])
  expect(await funnelMarks(page), 'and the funnel marks it question_ignored, as on dev').toContain('question_ignored')
})

// A real 99-character question (Twister Control, Top, card 1), not injected text.
// NON-KILL, recorded (U52 b): questions are capped at 100 characters, so no question plus its link
// needs a third line on a desktop card; trimming on desktop (_fitAskLine without its phone gate) is
// unobservable with real content, and no spec here can kill that mutant.
for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`@curated U47 d a long question is cut to two lines on a phone and shown whole on desktop (${viewport.width}x${viewport.height})`, async ({ page }) => {
    const measure = () => page.evaluate(() => {
      const el = (window as any).__neural._landEl, q = el.querySelector('[data-land-q]').firstElementChild
      const tx = el.querySelector('[data-land-ask-text]'), go = el.querySelector('[data-land-ask-go]')
      const line = parseFloat(getComputedStyle(q).lineHeight), qr = q.getBoundingClientRect()
      let goEnds: boolean | null = null
      if (go) { const rg = document.createRange(); rg.selectNodeContents(go); goEnds = q.contains(go) && Math.abs(rg.getBoundingClientRect().bottom - qr.bottom) <= 4 }
      return { text: (tx || q).textContent, full: tx ? (tx.dataset.full || tx.textContent) : q.textContent,
        lines: Math.round(q.clientHeight / line), cut: /\u2026$/.test((tx || q).textContent),
        // U52 b: Answer for Points runs inline at the end of the question's line
        goEnds, goHeight: go ? go.getBoundingClientRect().height : null }
    })
    await page.setViewportSize(viewport)
    const j = journey(page)
    await j.boot('/', { seedRolls: coveredRolls })
    await j.land('Twister Control Top')
    const asking = await measure()
    const QUESTION = 'What structural configuration defines Twister Control and separates it from ordinary back exposure?'
    expect(asking.full).toBe(QUESTION)
    expect(asking.goEnds, "Answer for Points ends the question's line").toBe(true)
    expect(asking.goHeight, 'the inline link keeps a 44px target').toBeGreaterThanOrEqual(44)
    if (viewport.width <= 640) {
      expect(asking, 'U47 d: a long question is cut to two lines on a phone').toMatchObject({ lines: 2, cut: true })
      expect(QUESTION.startsWith(asking.text!.slice(0, -1).trimEnd()), 'the trim keeps the question\'s own words, in order').toBe(true)
    } else expect(asking, 'desktop shows the whole question and still offers Answer for Points').toMatchObject({ text: QUESTION, cut: false })
    await j.openQuestion()
    expect(await measure(), 'the shown card carries the whole question').toMatchObject({ text: QUESTION, cut: false, goEnds: null })
  })
}

// D-433 (2026-10-26): D-370 adapted to U35 replaces v1's overstrict combined
// question+Moves fit premise. U47 d: the asking question and its Answer for Points on
// arrival, and EVERY shown answer, must be hit-testable without scrolling. Moves may
// need user scroll; their subtree, dimensions, untimed lifetime and real escape after
// expiry remain guarded.
for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 390, height: 631 }]) {
  test(`@curated U35 D-433 the asking question, Answer for Points and answers need no scroll; native Moves stay untimed (${viewport.width}x${viewport.height})`, async ({ page }, info) => {
    await page.setViewportSize(viewport)
    const j = await coveredCatch(page)
    await watchQuestionScroll(page)
    const covered = await questionGeometry(page)
    await info.attach('covered-arrival-geometry', { body: JSON.stringify(covered, null, 2), contentType: 'application/json' })
    expect(covered.scrollTop, 'D-433 arrival has no reader scroll').toBe(0)
    expect(covered.asking, 'premise: the catch arrives asking').toBe(true)
    expect(covered.question, 'D-433 the asking question is hit-testable on arrival without scrolling').toMatchObject({ hit: true, inside: true })
    expect(covered.go, 'D-433 Answer for Points is hit-testable on arrival without scrolling').toMatchObject({ hit: true, inside: true })
    expect(covered.go!.opacity).toBeGreaterThan(.05)
    expect(covered.go!.rect.width).toBeGreaterThanOrEqual(44)
    expect(covered.go!.rect.height).toBeGreaterThanOrEqual(44)
    expect(covered.card.height, 'the asking question retains the original 12px edge-margin fit budget').toBeLessThanOrEqual(covered.bounds.bottom - covered.bounds.top - 24)
    // U47 d at every size: the card's answers are out of layout until the player answers for points.
    expect(covered.answerBlock, 'U47 d the asking card collapses its answer block').toMatchObject({ display: 'none', height: 0, inert: true })
    if (viewport.width > 640) {
      // Desktop keeps the original, stronger combined-height claim too.
      expect(Math.max(covered.moves.bottom, covered.card.bottom) - Math.min(covered.moves.top, covered.card.top),
        'desktop covered question plus native Moves fits with the original 12px edge margins').toBeLessThanOrEqual(covered.bounds.bottom - covered.bounds.top - 24)
    }
    await j.engage()
    await j.advance(20000)
    expect((await state(page)).remaining, 'engagement alone does not start an asking question').toBeNull()
    await page.evaluate(() => {
      const a = (window as any).__neural
      ;(window as any).__coveredHand = { el: a.optionsRef.current, parent: a.optionsRef.current.parentNode,
        cards: [...a.optionsRef.current.querySelectorAll('[data-tech]')], html: a.optionsRef.current.innerHTML }
    })
    // Deliberately NOT openQuestion()/locator.click(): those helpers can scroll.
    await j.clickByMouse('[data-land-ask-go]', 'D-433 Answer for Points at the arrival position')
    await expect(page.locator('[data-land-ask-go]')).toHaveCount(0)
    await j.readerLayoutSettled()
    const opened = await questionGeometry(page)
    const scroll = await stopQuestionScroll(page)
    await info.attach('opened-geometry-and-scroll-writers', { body: JSON.stringify({ opened, scroll }, null, 2), contentType: 'application/json' })
    expect(scroll.writes, 'D-433 no automatic scroll writer through Answer for Points').toEqual([])
    expect(scroll.after).toBe(scroll.before)
    expect(scroll.pageAfter).toBe(scroll.pageBefore)
    expect(scroll.events.every(value => value === scroll.before), 'D-433 no browser scroll anchoring through Answer for Points').toBe(true)
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
        outside: !a._landEl.contains(h.el), covered: !!h.el.closest('[data-land-ask]') }
    })
    expect(hand, 'Answer for Points leaves the separate native Moves subtree untouched').toEqual({ same: true, parent: true, cards: true, html: true, outside: true, covered: false })
    expect([opened.moves.width, opened.moves.height], 'Answer for Points does not resize native Moves').toEqual([covered.moves.width, covered.moves.height])
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
