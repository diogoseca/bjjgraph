import { test, expect } from '@playwright/test'
import { journey } from '../dsl'

// MDP sandbox controls, 2026-10-14: m33 restores the old sticky-head placement
// and drifts 14px (limit 1) at both widths; m34 clips an 804-character structured
// step to 180 and fails exact text equality. Served bytes differ in both controls.
// The page-race control and its Back-only non-kills are in reading-mode.spec.ts;
// the current opposite-seat race control is in reading-contract.spec.ts.

const READY = '[data-reader][data-reader-ready="true"]'
const KNEE = '/Transitions/Knee-Slice-Pass'
// D-338 retired Focus (its reading* overrides are no longer read). QUIET seeds the same closed
// Questions and Moves and silent Feedback through the game layers; the map stays shown, as
// leaving Focus showed it for the other-half tap.
const QUIET = { v: 2, settings: { landCard: false, landHand: false, landFeedback: false }, settingsAt: {} }

for (const width of [320, 390]) {
  // RETIRED in part (D-338, no View menu): the article view has no Book toggle, so its hide/restore
  // steps and their ghost-hit and scroll claims go. Keys, section toggles and no play remain.
  test(`@curated ${width}px native reading keys and section toggles preserve the complete document`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    const j = journey(page)
    await j.boot(KNEE + '/Attacker', { initialState: QUIET })
    await expect(page.locator(READY)).toBeVisible()
    const before = await page.evaluate(() => {
      const w = window as any, a = w.__neural, root = document.querySelector('[data-reader]')!
      w.__readingBody = root.querySelector('[data-reader-body]')
      w.__readingText = w.__readingBody.textContent
      const heads = [...root.querySelectorAll('[data-section-toggle]')]
      return { labels: heads.map(e => e.textContent!.trim()), question: a._landQ?.card.q ?? null, beats: a.beats.length }
    })
    expect(before.labels.length).toBeGreaterThan(5)
    await expect(page.locator('.ng-reader-toc')).toBeHidden()
    await expect(page.locator('[data-reader-target]')).toHaveCount(0)
    await page.locator('[data-reader-body]').focus()
    await page.keyboard.press('PageDown')
    await expect.poll(() => page.locator(READY).evaluate(e => e.scrollTop)).toBeGreaterThan(0)
    const first = await page.locator(READY).evaluate(e => e.scrollTop)
    await page.keyboard.press('Space')
    await expect.poll(() => page.locator(READY).evaluate(e => e.scrollTop)).toBeGreaterThan(first)
    await page.keyboard.press('Control+End')
    await expect.poll(() => page.locator(READY).evaluate(e => e.scrollHeight - e.clientHeight - e.scrollTop)).toBeLessThan(2)
    await page.keyboard.press('Control+Home')
    await expect.poll(() => page.locator(READY).evaluate(e => e.scrollTop)).toBe(0)
    const bodyTop = await page.locator('[data-reader-body]').evaluate(e => e.getBoundingClientRect().top)
    const r = await page.locator(READY).boundingBox()
    // U65 note: the retired game Videos tile keeps only a hidden preference control.
    const prose = await page.locator('[data-reader-body]>.ng-section-card:visible').first().boundingBox()
    await page.mouse.move(prose!.x + prose!.width / 2, Math.min(prose!.y + 60, r!.y + r!.height - 20))
    await page.mouse.wheel(0, 400)
    await expect.poll(() => page.locator(READY).evaluate(e => e.scrollTop)).toBeGreaterThan(200)
    expect(await page.locator('[data-reader-body]').evaluate(e => e.getBoundingClientRect().top)).toBeLessThan(bodyTop - 200)
    await page.locator('[data-section-toggle]').last().evaluate(e => e.setAttribute('data-reader-last-header', ''))
    const last = page.locator('[data-reader-last-header]')
    await last.scrollIntoViewIfNeeded()
    await j.clickByMouse('[data-reader-last-header]', 'phone sections have their own toggle')
    await expect(last).toHaveAttribute('aria-expanded', 'false')
    // STALE SPEC (D-482 / U25 a): closing transfers focus to the aggregate disclosure.
    // Enter opens that list; Tab reaches the SAME section's row; Enter reopens it.
    await expect(page.locator('.ng-reader-hidden>summary')).toBeFocused()
    await expect(page.locator('.ng-reader-hidden')).not.toHaveAttribute('open', '')
    await page.keyboard.press('Enter')
    await expect(page.locator('.ng-reader-hidden')).toHaveAttribute('open', '')
    await page.keyboard.press('Tab')
    await expect(last, 'the hidden row remains in native keyboard order').toBeFocused()
    await page.keyboard.press('Enter')
    await expect(last, 'D-482: Enter on the revealed row reopens the section').toHaveAttribute('aria-expanded', 'true')
    await expect(last).toBeFocused()
    await expect(page.locator('.ng-reader-hidden')).toBeHidden()
    await expect(page.locator('[data-layer-hide]:visible,[data-layer-show]:visible'), 'no Book control in the article view').toHaveCount(0)
    expect(await page.evaluate(() => (window as any).__readingBody === document.querySelector('[data-reader-body]'))).toBe(true)
    expect(await page.evaluate(() => (window as any).__readingText === document.querySelector('[data-reader-body]')!.textContent), 'complete authored document and order survive the round trip').toBe(true)
    expect(await page.locator(READY).evaluate(e => e.scrollWidth - e.clientWidth), 'the document has no horizontal overflow').toBeLessThanOrEqual(1)
    await j.advance(20000)
    expect(await page.evaluate(() => {
      const a = (window as any).__neural
      return { question: a._landQ?.card.q ?? null, played: !!a._played, misses: a.beats.filter((b: any) => b.beat === 'land_q_expired').length }
    })).toEqual({ question: before.question, played: false, misses: 0 })
  })
}

test('@curated a late full article preserves the answered question and never pays twice', async ({ page }) => {
  const j = journey(page)
  let release!: () => void, requested = false
  const held = new Promise<void>(resolve => { release = resolve })
  await j.boot(KNEE, { beforeNavigate: async () => {
    await page.route('**/Transitions/Knee-Slice-Pass/Attacker', async route => { requested = true; await held; await route.continue() })
  } })
  await expect.poll(() => requested).toBe(true)
  const q = await j.landQuestion()
  expect(q).not.toBeNull()
  // U47 d: explicitly Answer for Points before answering, without waiting for the held article.
  await j.clickByMouse('[data-land-ask-go]', 'Answer for Points before its answer')
  await j.tapGuardSettled() // the double-tap guard; the article stays held throughout
  await j.clickByMouse(`[data-land-mc-opt="${q!.correct}"]`)
  const before = await page.evaluate(() => {
    const w = window as any, a = w.__neural
    w.__answeredReaderQuestion = document.querySelector('[data-land-q]')
    return { html: w.__answeredReaderQuestion.outerHTML, qMod: a._qMod, answers: a.beats.filter((b: any) => b.beat === 'land_q_answered').length }
  })
  release()
  await expect(page.locator(READY)).toBeVisible()
  const after = await page.evaluate(() => {
    const w = window as any, a = w.__neural, q = document.querySelector('[data-land-q]')!
    return { html: q.outerHTML, qMod: a._qMod, answers: a.beats.filter((b: any) => b.beat === 'land_q_answered').length, same: w.__answeredReaderQuestion === q }
  })
  expect(after).toEqual({ ...before, same: true })
  expect(before.answers).toBe(1)
})

// REAL BREAK, orchestrator ruling 2026-10-19. The compositor proof in
// scratch/article-sections/ci-e26/late-answer-paint-report.md shows painted old
// answers plus the sections-only 68px adoption shift. Hold the first QUEUED
// layout, then deliver it between the original measurement and native click.
// New-question publication must have positioned the controls synchronously;
// waiting for reader readiness here would hide the defect instead of fixing it.
test('@curated the first queued reader layout cannot move a published answer before its first click', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as any, prior = Object.getOwnPropertyDescriptor(w, '__neural'); let app: any
    Object.defineProperty(w, '__neural', { configurable: true, get: () => app, set: a => {
      app = a; prior?.set?.call(w, a); if (!a) return
      let reader: any
      Object.defineProperty(a, '_reader', { configurable: true, get: () => reader, set: r => {
        reader = r; if (!r) return
        const queued = r.layout
        r.layout = () => {}
        w.__publishReader = () => {
          const answer = document.querySelector('[data-land-mc-opt]')!, before = answer.getBoundingClientRect()
          r.layout = queued; r.layoutNow()
          const after = answer.getBoundingClientRect()
          w.__answerPublication = { dx: after.x - before.x, dy: after.y - before.y, same: answer.isConnected }
        }
      } })
    } })
  })
  const j = journey(page)
  let release!: () => void, requested = false
  const held = new Promise<void>(resolve => { release = resolve })
  await j.boot(KNEE, { beforeNavigate: async () => {
    await page.route('**/Transitions/Knee-Slice-Pass/Attacker', async route => { requested = true; await held; await route.continue() })
  } })
  await expect.poll(() => requested).toBe(true)
  const q = await j.landQuestion(); expect(q).not.toBeNull()
  // U47 d: Answer for Points before arming the ANSWER-click interceptor. No reader-ready or
  // layout wait may consume the first queued-publication race being tested.
  await j.clickByMouse('[data-land-ask-go]', 'Answer for Points before the answer publication probe')
  const click = page.mouse.click.bind(page.mouse)
  page.mouse.click = async (...args: Parameters<typeof click>) => {
    page.mouse.click = click
    await page.evaluate(() => (window as any).__publishReader())
    return click(...args)
  }
  await j.tapGuardSettled() // the double-tap guard; reader.layout is held, so no queued layout runs meanwhile
  await j.clickByMouse(`[data-land-mc-opt="${q!.correct}"]`)
  // U52 b: the take-up itself lays the reader out (the shown card leaves the quiet line's width), so a layout
  // queued before it moves nothing.
  expect(await page.evaluate(() => (window as any).__answerPublication), 'the first queued layout moves no published answer').toEqual({ dx: 0, dy: 0, same: true })
  const before = await page.evaluate(() => {
    const w = window as any, a = w.__neural
    w.__answeredReaderQuestion = document.querySelector('[data-land-q]')
    return { html: w.__answeredReaderQuestion.outerHTML, qMod: a._qMod, answers: a.beats.filter((b: any) => b.beat === 'land_q_answered').length }
  })
  release()
  await expect(page.locator(READY)).toBeVisible()
  expect(await page.evaluate(() => {
    const w = window as any, a = w.__neural, q = document.querySelector('[data-land-q]')!
    return { html: q.outerHTML, qMod: a._qMod, answers: a.beats.filter((b: any) => b.beat === 'land_q_answered').length, same: q === w.__answeredReaderQuestion }
  })).toEqual({ ...before, same: true })
  expect(before.answers).toBe(1)
})

// A real app race, not stale assertion timing: the integrated failure was
// reproduced by first adoption during pointerdown. The correct option received
// down, another option (or blank space) received up, and no answer was recorded.
// Native moveBefore also failed: preserving DOM identity cannot preserve a
// moving hit target. Force that ordering against the actual installed reader.
for (const width of [390, 1440]) {
  test(`@curated ${width}px reader adoption during a mouse press preserves the first answer`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
    const j = journey(page)
    await j.boot(KNEE)
    await expect(page.locator(READY)).toBeVisible()
    const q = await j.landQuestion()
    expect(q).not.toBeNull()
    // U47 d: Answer for Points before restoreGame and the one-shot answer pointerdown hook;
    // the adoption race still begins with the original answer measurement.
    await j.clickByMouse('[data-land-ask-go]', 'Answer for Points before the native answer press')
    await page.evaluate(() => {
      const w = window as any, a = w.__neural, reader = a._reader;
      const layout = reader.layoutNow;
      reader.layoutNow = () => {}; // hold the same pending first-layout boundary
      reader.restoreGame();
      const question = document.querySelector('[data-land-q]');
      w.__pressedReader = { question, card: a._landEl };
      window.addEventListener('pointerdown', event => {
        const target = event.target as HTMLElement;
        if (!target.closest('[data-land-mc-opt]')) throw Error('the forced press must target an answer');
        const before = target.getBoundingClientRect(), parent = a._landEl.parentElement;
        reader.layoutNow = layout;
        reader.layoutNow(); // asynchronous adoption lands during this native press
        const after = target.getBoundingClientRect();
        w.__pressedReader.held = { sameParent: parent === a._landEl.parentElement, dx: after.x - before.x, dy: after.y - before.y };
      }, { once: true, capture: true });
    })
    await j.tapGuardSettled() // the double-tap guard; layoutNow is held, so the adoption still lands in the press
    await j.clickByMouse(`[data-land-mc-opt="${q!.correct}"]`)
    expect(await page.evaluate(() => {
      const w = window as any, a = w.__neural, old = w.__pressedReader;
      return { held: old.held, sameQuestion: old.question === document.querySelector('[data-land-q]'),
        sameCard: old.card === a._landEl, answers: a.beats.filter((b: any) => b.beat === 'land_q_answered').length };
    })).toEqual({ held: { sameParent: true, dx: 0, dy: 0 }, sameQuestion: true, sameCard: true, answers: 1 })
    await expect(page.locator('.ng-reader-game [data-land-q]')).toBeVisible()
  })
}

// STALE CONTRACT (D-338, D5-S4): the article view has no Book control, but the saved Book-off state keeps
// its restore, so the claim is kept there: the seats are read in the map view and Book restores
// without refetching either seat.
test('@curated successful article responses are reused across seat navigation and Book restores', async ({ page }) => {
  const j = journey(page), requests: string[] = []
  page.on('request', r => { if (r.resourceType() === 'fetch' && /Knee-Slice-Pass\/(Attacker|Defender)$/.test(new URL(r.url()).pathname)) requests.push(new URL(r.url()).pathname) })
  await j.boot(KNEE + '/Attacker', { initialState: { ...QUIET, settings: { ...QUIET.settings, readerBook: false } } })
  await expect(page.locator(READY)).toHaveCount(1)
  for (const seat of ['Defender', 'Attacker', 'Defender']) {
    await j.readingOtherHalf() // D-318 U6a: the native paired half replaces the retired switch.
    await expect(page.locator('[data-reader]')).toHaveAttribute('data-reader-path', KNEE + '/' + seat)
  }
  await j.clickByMouse('[data-layer-show="book"]', 'restore Book from the saved map view')
  await expect(page.locator(READY)).toBeVisible()
  expect(requests.filter(x => x.endsWith('/Defender'))).toHaveLength(1)
  expect(requests.filter(x => x.endsWith('/Attacker'))).toHaveLength(0)
})

for (const first of ['pane', 'reading']) {
  test(`@curated closing ${first} first never resumes reading without a game action`, async ({ page }) => {
    // STALE CONTRACT (D-338): Focus, which set reading intent, is gone. A content URL arrival sets
    // the same intent; the pane opens from the logo, before or after reading the prose.
    const j = journey(page)
    await j.boot(KNEE)
    await expect(page.locator(READY)).toBeVisible()
    if (first === 'reading') await page.locator('[data-reader-body]').focus()
    await page.locator(READY).evaluate(e => { e.scrollTop = 0 })
    await j.clickByMouse('.ng-logo')
    if (first === 'pane') await page.locator('[data-reader-body]').focus()
    expect(await page.evaluate(() => (window as any).__neural.paused)).toBe(true)
    await j.clickByMouse('.ng-explorer-close')
    await j.advance(20000)
    expect(await page.evaluate(() => ({ paused: (window as any).__neural.paused, reading: !!(window as any).__neural._readerIntent }))).toEqual({ paused: true, reading: true })
  })
}

// STALE CONTRACT (D-338): Focus and Browse are gone. A content URL arrival sets the reading intent
// Focus set (its seat's landing is the one-state history), and the logo opens the pane.
test('@curated ending a replay after the pane closes preserves reading intent', async ({ page }) => {
  const j = journey(page)
  await j.boot(KNEE)
  await expect(page.locator(READY)).toBeVisible()
  expect(await page.evaluate(() => { const a = (window as any).__neural; return { intent: !!a._readerIntent, history: a.rollLog.length > 0 } }), 'premise: reading intent and a landing to replay').toEqual({ intent: true, history: true })
  await page.locator(READY).evaluate(e => { e.scrollTop = 0 })
  await j.clickByMouse('.ng-logo')
  // A one-state history fixture isolates ownership; playback uses its real entry point.
  expect(await page.evaluate(() => {
    const a = (window as any).__neural
    return a.startReplay({ ts: 123, log: a.rollLog.slice(0, 1), outcome: 'scramble' })
  })).toBe(true)
  await j.clickByMouse('.ng-explorer-close')
  expect(await page.evaluate(() => !!(window as any).__neural._replay)).toBe(true)
  await page.waitForTimeout(350)
  await j.clickByMouse('[data-replay-stop]')
  await expect(page.locator(READY)).toBeVisible()
  await j.advance(20000)
  expect(await page.evaluate(() => {
    const a = (window as any).__neural
    return { reading: !!a._readerIntent, paused: a.paused, replay: !!a._replay, clock: a._decision?.remaining ?? null }
  })).toEqual({ reading: true, paused: true, replay: false, clock: null })
})

test('@curated a complete structured step keeps its long description and plain sibling', async ({ page }) => {
  const j = journey(page)
  const long = 'Extend the hips progressively '.padEnd(44, '-') + 'X'.repeat(760)
  await j.boot(KNEE, { initialState: QUIET, beforeNavigate: async () => {
    // A labelled markup fixture exercises length/structure independently of the
    // real-corpus completeness checks in landcard-more-content.spec.ts.
    await page.route('**/Transitions/Knee-Slice-Pass/Attacker', route => route.fulfill({ contentType: 'text/html', body: `<h1>Attacker</h1><article><section id="steps"><h2 id="steps">Execution Steps</h2><h3>Extend hips for the finish</h3><p>${long}</p><p>Plain step with no shape</p></section></article>` }))
  } })
  await expect(page.locator(READY)).toBeVisible()
  const guide = page.locator('[data-reader-article="guide"]')
  await expect(guide.locator('h3')).toHaveText('Extend hips for the finish')
  await expect(guide.locator('p').first()).toHaveText(long)
  await expect(guide.locator('p').last()).toHaveText('Plain step with no shape')
  expect(await guide.locator('p').first().evaluate(e => e.textContent!.length)).toBe(804)
})

test('@curated a late real dossier preserves reader focus, scroll and the answered question', async ({ page }) => {
  const j = journey(page)
  await j.boot(KNEE)
  await expect(page.locator(READY)).toBeVisible()
  const q = await j.landQuestion()
  expect(q).not.toBeNull()
  await j.openQuestion() // U47 d: Answer for Points before the real answer click.
  // D-338: Questions follows Videos and Moves and can start below the fold; scroll to it first.
  await page.locator(`[data-land-mc-opt="${q!.correct}"]`).evaluate(e => e.scrollIntoView({ block: 'nearest' }))
  await j.readerLayoutSettled()
  await j.clickByMouse(`[data-land-mc-opt="${q!.correct}"]`)
  await page.locator('[data-reader-body]').focus()
  await page.keyboard.press('PageDown')
  await expect.poll(() => page.locator(READY).evaluate(e => e.scrollTop)).toBeGreaterThan(0)
  await page.waitForTimeout(400) // native PageDown motion must finish before the delivery snapshot
  const before = await page.evaluate(() => {
    const w = window as any, a = w.__neural, n = a.nodes[a._landIdx]
    w.__dossierReader = a._readerEl; w.__dossierBody = a._readerEl.querySelector('[data-reader-body]'); w.__dossierQuestion = document.querySelector('[data-land-q]'); w.__dossierFocus = document.activeElement
    delete w.NG_CONTENT.decks[n.t]; delete (a._contentWaits || {})[n.t]
    return { key: n.t, filename: a.qhash(n.t) + '.json', scroll: a._readerEl.scrollTop, html: [...w.__dossierBody.querySelectorAll('[data-source-path]')].map(e => e.outerHTML).join(''), question: w.__dossierQuestion.outerHTML, qMod: a._qMod, answers: a.beats.filter((b: any) => b.beat === 'land_q_answered').length }
  })
  await page.unroute('**/static/neural/content/*.json')
  const response = page.waitForResponse(r => new URL(r.url()).pathname.endsWith('/content/' + before.filename))
  await page.evaluate(async key => { const a = (window as any).__neural; await a._hydrateContent(key); a.onContentReady(key) }, before.key)
  expect((await response).status()).toBe(200)
  const after = await page.evaluate(() => {
    const w = window as any, a = w.__neural
    return { scroll: a._readerEl.scrollTop, html: [...w.__dossierBody.querySelectorAll('[data-source-path]')].map(e => e.outerHTML).join(''), question: document.querySelector('[data-land-q]')!.outerHTML, qMod: a._qMod, answers: a.beats.filter((b: any) => b.beat === 'land_q_answered').length,
      same: w.__dossierReader === a._readerEl && w.__dossierBody === a._readerEl.querySelector('[data-reader-body]') && w.__dossierQuestion === document.querySelector('[data-land-q]'), focus: w.__dossierFocus === document.activeElement }
  })
  const { key, filename, ...expected } = before
  expect(after).toEqual({ ...expected, same: true, focus: true })
})
