import { test, expect, type Page } from '@playwright/test'
import { journey } from '../dsl'
import { legacyDefenseRenderer } from '../fixtures/legacy-defense-renderer'

// v1.227.0 — owner's 2026-10-15 rule supersedes v1.134.0: navigation starts a new,
// calm journey. An answer/play on a dormant defender seat is the third state;
// it cannot manufacture an opponent catch. All buttons use clickByMouse. Orbs
// are canvas drawings, so their actual _LY coordinates are hit-tested and clicked.
// Authored clips come from THIS build, not the DSL's usual empty dossier fixtures.
// v1.230.0 U8: the catch fixture commits through the authored move's title;
// the card face commits outside Play, and Watch opens the viewer. Defense assertions stay intact.
// Measured v1.227.0 mutants, all killed by the named cases below:
// M1 cold answer invents pressure -> link/reload; M2 keeps attacker deck -> orb;
// M3 selects attacker films -> BOTH transition and Knee Slice half tests;
// M4 reader sync clears the reel -> link; M6 disables paging -> link;
// M7 discards live provenance -> real catch; M8 ignores preference -> toggle;
// M9 ignores reduced motion -> motion; M10 toggle disarms clock -> toggle;
// M11 omits save -> immediate durable-value assert (reload alone SURVIVED because
// pagehide flushes progress); M12 changes grade -> right differential;
// M13 removes 1s -> expiry differential; M15 refills time when paging back ->
// real catch. M14 navigation is in defending-arrivals.
// Cold-deck odds remain frozen independently of the displayed deck; M16 is
// killed by the exhaustive routing replay in tests/mdp_corpus.test.mjs.
// NON-KILL: M5 borrows legacy top-level clips in an empty half. The five real gaps
// have no legacy clips to borrow. Their no-strip assertions pass; the synthetic
// competing reel in defending_landing.test.mjs kills this exact fallback (U4).
// Renderer differential scope: both arms use the head's shared grading/expiry helpers;
// this is not a full base-app differential. It compares question identity/order, timing
// state, grades, combo, study counters and PUBLISHED escape-card percentages, plus choices.
// It does NOT compare the beacon, clock DOM disconnection, or the full persisted SRS record.
// Cold fallback is included with a held panic-pool warm-up (review B1): production
// reveal, Space, replacement and grading stay live. Paging is a new-renderer-only pin.
// Review red proofs (2026-10-15): B1's reviewed visibility guard fails both real
// mouse/Space cases, with and without paging: MC credit 0 -> 1; fixed stays 0.
// S1: removing NEW _defenseAnswered's wrong break is killed at the outcome
// comparison (combo 3 vs 0, missing break beat, published 64/67% vs 59/62%).
// The new-renderer-only expiry-break mutant fails the same comparison. Expiry
// remains shared head code; this conditional mutant does not make it a base-app oracle.
// N1: suppressing paintChoiceValues' new defensive card percentage writes AFTER
// grading is killed at the outcome comparison: published 59/62% vs 72/75%,
// although escapeOddsSnapshot is 72 in both arms. Controls and mutant builds pass.
// NON-KILL (review N1): deleting only _defenseAnswered's refreshEscapeOdds survives;
// _mcAnswer -> refreshOptionOdds already refreshes. No redundant call-count assertion.
// Playback on YouTube is outside this contract; mounted reel identity is in it.
const LOOP = '/Submissions/Loop-Choke/from-Half-Guard'
const KEY = 'Loop Choke from Half Guard|Defender'
// D-307: one exact escape; the Whittier course/coupon promotion remains withheld.
const CLIPS = ['pZmJpXSwRTk']
const READY = '[data-reader-ready="true"]'
const realContent = async (page: Page) => {
  await page.route('**/static/neural/content/*.json', route => route.continue())
}
const state = (page: Page) => page.evaluate(() => {
  const a = (window as any).__neural
  return { journey: a._journeyId, pressure: !!a._defensePressure, vignette: !!a._vignetteEl,
    key: a._landQ?.key, mode: a._landMode, cards: a._landQ ? a._landDeckCards(a._landQ.key).length : 0,
    caught: a.beats.filter((b: any) => b.beat === 'caught').length,
    remaining: a._decision?.remaining ?? null, played: !!a._played,
    clips: [...document.querySelectorAll('.ng-landfilm .ng-clip')].map(e => e.querySelector('img')?.getAttribute('src')?.split('/vi/')[1]?.split('/')[0]) }
})
async function settled(page: Page) {
  await expect(page.locator('[data-land-q]')).toBeVisible()
  await expect(page.locator(READY)).toBeVisible()
  await expect.poll(async () => (await state(page)).clips).toEqual(CLIPS)
}
async function calm(page: Page) {
  await settled(page)
  expect(await state(page)).toMatchObject({ pressure: false, vignette: false, key: KEY, cards: 5, clips: CLIPS })
  await expect(page.locator('[data-land-nav]')).toBeVisible()
  await expect(page.locator('.ng-landstack')).toBeVisible()
  await expect(page.locator('[data-defense-prompt]')).toHaveCount(0)
}
async function catchLoop(page: Page, legacy = false, cold = false, before?: () => Promise<unknown>) {
  const j = journey(page)
  await j.boot('/Positions/Half-Guard/Bottom', { beforeNavigate: realContent })
  await expect(page.locator(READY)).toBeVisible()
  await j.hydrateAll()
  await page.evaluate(({ old, legacy, cold }) => {
    const a = (window as any).__neural
    // URL staging draws these before boot() can enqueue RNG. Hold the initial
    // opponent and roll length identical for the old/new renderer comparison.
    a.aiSkill = .13; a.maxMoves = 11
    if (legacy) {
      const render = a.renderLandCard
      const previous = new Function('return ({' + old + '}).buildPanicCard')()
      a.renderLandCard = function (node: any, mode: string, ...args: any[]) {
        if (mode === 'defense') {
          // D-351: the retired renderer runs under the same reader contract as the generic one: its
          // landing queues the defender article and stays pending (hidden, clock parked) until the
          // reader publishes it. Both happen before any paint, as renderLandCard does them.
          this._queueReader(this.nodes[this._defendSub], 'defender')
          previous.call(this, this.optionsRef.current, this.nodes[this._defendSub])
          if (this.get('readerBook', true)) this._landEl?.setAttribute('data-reader-pending', '')
          // The old enterDefense armed immediately AFTER buildPanicCard returned.
          this._landQ = { opened: true } // legacy control represents a deliberately opened question
          this._armLandClock(this._landEl?.querySelector('[data-land-clock]'))
          return this._landEl
        }
        return render.call(this, node, mode, ...args)
      }
    }
    if (cold) {
      const originalMc = a._mcBlock, originalWarm = a._warmMcPool
      let release: () => void
      const pending = new Promise<void>(resolve => { release = resolve })
      a.__coldWarmCalls = 0
      a._mcBlock = function (...args: any[]) {
        if (args[3] === 'panic' && (!a.__coldQuestion || args[0].q === a.__coldQuestion)) {
          a.__coldQuestion = args[0].q; return null
        }
        return originalMc.apply(this, args)
      }
      a._warmMcPool = function (...args: any[]) {
        if (args[2] !== 'panic' || args[0].q !== a.__coldQuestion) return originalWarm.apply(this, args)
        a.__coldWarmCalls++; return pending
      }
      a.__releaseCold = () => { a._mcBlock = originalMc; a._warmMcPool = originalWarm; release!() }
    }
    for (const [tag, values] of Object.entries({ resolve: [.999], outcome: [0], 'opp-finish': [0], 'opp-sub-pick': [.75], 'opp-pick': [0], escape: [0], 'panic-mc-pick': Array(40).fill(.23), 'panic-mc-shuffle': Array(40).fill(.61) })) a.rig(tag, values)
    const pick = a._optionCards.find((c: any) => c.opt.node.t === 'Half Guard to Back Take' && !c.opt.threat)
    if (!pick) throw new Error('the authored move is absent')
    // H139: the temporary data-defending-commit marker disappeared when the landing rerendered
    // before the press (844 control timed out before its catch claim). Select the same authored own
    // move by the app's stable data-tech identity below; a replaced card remains the same choice.
  }, { old: legacyDefenseRenderer, legacy, cold })
  if (before) await before()
  await page.locator('[data-tech="Half Guard to Back Take"] .ng-choice-title-button').scrollIntoViewIfNeeded()
  await j.clickByMouse('[data-tech="Half Guard to Back Take"] .ng-choice-title-button', 'choose Half Guard to Back Take')
  await j.advanceUntil('caught', 20000, 100)
  if (!legacy) await j.openQuestion() // U34: this mechanics fixture studies an opened catch.
  await expect(page.locator(cold ? '[data-panic-reveal]' : '[data-panic-mc-opt]').first()).toBeVisible()
  // STALE TIMING (D-351, H57): a reading-view landing stays unpublished, its clock parked, until the
  // article it asked for renders, which happens in real time after the pumped catch; the parked arm
  // fires on the next frame. Without that frame both clocks read null (20 of 20 differentials red,
  // the legacy fixture also unheld then). One frame after publication arms both on the same tick.
  await j.advance(17)
  await expect(page.locator('.ng-evtoast')).toContainText('Caught')
  expect(await page.evaluate(() => (window as any).__neural.nodes[(window as any).__neural._defendSub].t)).toBe('Loop Choke from Half Guard')
  return j
}

// STALE SPEC (PR 305, owner D-307): link, reload and dormant answer keep the generic five-card defender landing calm.
// Curated IDs/counts are fixed below; the Knee Slice pair remains a nonempty wrong-role control.
test('@curated link, reload and dormant answer keep the generic five-card defender landing calm', async ({ page }) => {
  const j = journey(page)
  await j.boot(LOOP + '/Defender', { beforeNavigate: realContent })
  await calm(page)
  await j.clickByMouse('[data-land-next]', 'browse the next defender card')
  expect(await page.evaluate(() => (window as any).__neural._landPage)).toBe(1)
  await j.clickByMouse('[data-land-prev]', 'return to the first defender card')
  const correct = await page.evaluate(() => (window as any).__neural._mc.correct)
  await j.openQuestion()
  await j.clickByMouse(`[data-panic-mc-opt="${correct}"]`, 'answer the cold defender landing')
  await j.advance(20000)
  expect(await state(page)).toMatchObject({ pressure: false, vignette: false, caught: 0, remaining: null })
  await page.reload()
  await calm(page)
  expect(await state(page)).toMatchObject({ caught: 0, remaining: null })
})

// STALE SPEC (PR 305, owner D-307): an orb arrival never retains the warm attacker deck.
// Curated IDs/counts are fixed below; the Knee Slice pair remains a nonempty wrong-role control.
test('@curated an orb arrival never retains the warm attacker deck', async ({ page }) => {
  const j = journey(page)
  await j.boot(LOOP + '/Attacker', { beforeNavigate: realContent })
  await expect(page.locator(READY)).toBeVisible()
  await expect.poll(() => page.evaluate(() => (window as any).__neural._landQ?.key)).toBe('Loop Choke from Half Guard|Attacker')
  await j.advance(6000)
  const hit = await page.evaluate(() => {
    const a = (window as any).__neural, n = a.nodes.find((n: any) => n.id === 'Submissions/Loop-Choke/from-Half-Guard/Defender')
    const r = a.canvas.getBoundingClientRect(), scale = a.W / a.cam.vw
    const x = r.left + a.W / 2 + (n.x - a.cam.cx) * scale, y = r.top + a.H / 2 + (a._LY(n) - a.cam.cy) * scale
    return { x, y, exposed: document.elementFromPoint(x, y) === a.canvas, journey: a._journeyId }
  })
  expect(hit.exposed, 'the drawn escaping orb is reachable').toBe(true)
  await page.mouse.click(hit.x, hit.y)
  await j.advance(3000)
  await calm(page)
  expect((await state(page)).journey).toBeGreaterThan(hit.journey)
  expect((await state(page)).caught).toBe(0)
})

// STALE SPEC (PR 305, owner D-307): the curated empty transition defender mounts no reel on the first render.
// Curated IDs/counts are fixed below; the Knee Slice pair remains a nonempty wrong-role control.
// D-313 / B4: article readiness precedes dossier publication. Hold the specific real
// request, then observe publication AND the real content refresh returning before
// checking absence. Fixed: 10/10; a delayed one-clip response fails the exact IDs
// assertion after this barrier. An empty DOM before the response is not the oracle.
test('@curated the curated empty transition defender mounts no reel on the first render', async ({ page }) => {
  const j = journey(page)
  const dossierKey = 'Kuzure Kesa Gatame to Kesa Gatame'
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  let held = 0
  try {
    await j.boot('/Transitions/Kuzure-Kesa-Gatame-to-Kesa-Gatame/Defender', { beforeNavigate: async page => {
      await realContent(page)
      await page.route('**/static/neural/content/92e63be8.json', async route => {
        held++
        await gate
        await route.continue()
      })
    } })
    await expect(page.locator(READY)).toBeVisible()
    await expect.poll(() => held, 'the specific real dossier request is held').toBe(1)
    // Article readiness and an empty DOM do not mean the film payload has arrived.
    // Observe the REAL refresh returning after publication; do not call it from the test.
    await page.evaluate(key => {
      const a = (window as any).__neural
      const refresh = a._refreshReadingContent
      a.__emptyHalfRefreshes = 0
      a._refreshReadingContent = function (keys: string[] | null) {
        const result = refresh.call(this, keys)
        if (keys?.includes(key) && (window as any).NG_CONTENT?.decks?.[key]) this.__emptyHalfRefreshes++
        return result
      }
    }, dossierKey)
    release()
    await expect.poll(() => page.evaluate(key => ({
      published: !!(window as any).NG_CONTENT?.decks?.[key],
      completedRefreshes: (window as any).__neural.__emptyHalfRefreshes,
    }), dossierKey), 'the authored dossier is published and its film refresh completed').toEqual({ published: true, completedRefreshes: 1 })
    await expect.poll(async () => (await state(page)).clips).toEqual([])
    await expect(page.locator('.ng-landfilm')).toHaveCount(0)
    await expect(page.locator('.ng-landfilm .ng-clip')).toHaveCount(0)
    expect(await state(page)).toMatchObject({ pressure: false, vignette: false, cards: 4, key: 'Kuzure Kesa Gatame to Kesa Gatame|Defender' })
  } finally { release() }
})

// STALE SPEC (PR 305, owner D-307): each Knee Slice Pass half mounts its own clips, including the reader perspective link.
// Curated IDs/counts are fixed below; the Knee Slice pair remains a nonempty wrong-role control.
test('@curated each Knee Slice Pass half mounts its own clips, including the reader perspective link', async ({ page }) => {
  const j = journey(page)
  await j.boot('/Transitions/Knee-Slice-Pass/Attacker', { beforeNavigate: realContent })
  await expect(page.locator(READY)).toBeVisible()
  await expect.poll(async () => (await state(page)).clips).toEqual(['yj_6xcl2emA'])
  await j.readingOtherHalf() // D-318 U6a: the native paired half replaces the retired switch.
  await expect(page.locator(READY)).toHaveAttribute('data-reader-path', '/Transitions/Knee-Slice-Pass/Defender')
  await expect.poll(async () => (await state(page)).clips).toEqual(['RvIIpXaPyJM'])
  expect((await state(page)).key).toBe('Knee Slice Pass|Defender')
  expect((await state(page)).pressure).toBe(false)
})

for (const path of ['Americana/from-Triangle-Control', 'Armbar/from-Triangle-Control', 'Kimura/from-Triangle-Control', 'Achilles-Lock/from-Inside-Ashi-Garami', 'Suloev-Stretch/from-Half-Guard']) {
  test(`no empty reel for the authored clip gap: ${path}`, async ({ page }) => {
    const j = journey(page)
    await j.boot('/Submissions/' + path + '/Defender', { beforeNavigate: realContent })
    await expect(page.locator(READY)).toBeVisible()
    await expect(page.locator('[data-land-q]')).toBeVisible()
    await expect(page.locator('.ng-landfilm')).toHaveCount(0)
  })
}

const mechanics = (page: Page) => page.evaluate(() => {
  const a = (window as any).__neural, key = a._panicKey
  const fc = a._panicFc?.fc || a._landQ?.card
  const q = fc?.q
  return { key, q, aiSkill: a.aiSkill, mc: a._mc ? { correct: a._mc.correct, tiers: a._mc.tiers, n: a._mc.n, qhash: a._mc.qhash, surface: a._mc.surface } : null,
    answers: [...(a._landEl?.querySelectorAll('[data-panic-mc-opt]') || [])].map((button: any) => button.textContent.trim()),
    total: a._decision?.total ?? null, remaining: a._decision?.remaining ?? null,
    prep: a.prep?.[key] || 0, sharp: a._sharp?.[key] || 0, stage: a.stage?.[key] || {}, rec: a.rec?.[key] || {},
    combo: a._combo || 0, qMod: a._qMod || 0, cardsToday: a.cardsToday || 0,
    odds: a.escapeOddsSnapshot(), publishedOdds: a._optList.map((o: any) => ({
      label: a.choiceLabel(o), res: o.res, role: o.destinationRole,
      percent: a._optionCards.find((oc: any) => oc.opt === o)?.card.querySelector('.ngodds')?.textContent.trim() })), choices: a._optList.map((o: any) => ({ label: a.choiceLabel(o), res: o.res, role: o.destinationRole })),
    grades: a.beats.filter((b: any) => ['mc_correct', 'mc_wrong', 'escape_odds_pumped', 'land_q_expired', 'combo_break'].includes(b.beat)).map(({ t, ...b }: any) => b) }
})

for (const answer of ['right', 'wrong', 'expiry']) {
  test(`real-catch renderer differential: ${answer} has identical questions, timing, grades, odds and choices`, async ({ page }) => {
    const results = []
    for (const legacy of [true, false]) {
      const j = await catchLoop(page, legacy)
      if (answer !== 'right') await page.evaluate(() => {
        const a = (window as any).__neural
        a._combo = 3; a.refreshOptionOdds()
      })
      const before = await mechanics(page)
      if (answer !== 'right') expect(before.combo).toBe(3)
      expect(before.publishedOdds).toHaveLength(before.choices.length)
      // STALE SPEC (v1.230.0, feat/video-cards merged, U8): the % unit moved to the card's heading; the
      // published odds are bare integers, compared renderer to renderer below.
      for (const card of before.publishedOdds) expect(card.percent).toMatch(/^\d+$/)
      expect(before.total).toBe(13500)
      if (answer === 'expiry') await j.advance(14000)
      else {
        const mc = before.mc!
        await j.clickByMouse(`[data-panic-mc-opt="${answer === 'right' ? mc.correct : (mc.correct + 1) % mc.n}"]`)
      }
      results.push({ before, after: await mechanics(page) })
    }
    expect(results[1], 'the generic renderer preserves the retired live drill mechanics').toEqual(results[0])
    if (answer !== 'right') {
      expect(results[1].after.combo).toBe(0)
      expect(results[1].after.grades).toContainEqual({ beat: 'combo_break', at: 3, reason: answer === 'wrong' ? 'wrong' : 'slow' })
    } else expect(results[1].after.publishedOdds).not.toEqual(results[1].before.publishedOdds)
  })
}

const coldState = (page: Page) => page.evaluate(() => {
  const a = (window as any).__neural
  return { mc: !!a._landEl.querySelector('[data-panic-mc-opt]'), warmCalls: a.__coldWarmCalls,
    cardsToday: a.cardsToday || 0, correct: a.beats.filter((b: any) => b.beat === 'mc_correct').length }
})
async function releaseCold(page: Page) {
  await page.evaluate(async () => {
    const a = (window as any).__neural
    a.__releaseCold()
    // The held promise's upgrade callback runs before this microtask completes.
    await Promise.resolve()
  })
}

test('cold renderer differential: an untouched fallback upgrades exactly once', async ({ page }) => {
  const results = []
  for (const legacy of [true, false]) {
    const j = await catchLoop(page, legacy, true)
    expect(await coldState(page)).toEqual({ mc: false, warmCalls: 1, cardsToday: 0, correct: 0 })
    const before = await mechanics(page)
    await releaseCold(page)
    await expect(page.locator('[data-panic-mc-opt]').first()).toBeVisible()
    expect(await coldState(page)).toEqual({ mc: true, warmCalls: 1, cardsToday: 0, correct: 0 })
    await page.evaluate(() => { const a = (window as any).__neural; a.__coldUpgradeBlock = a._landEl.querySelector('[role="radiogroup"]') })
    await releaseCold(page)
    await j.advance(20)
    expect(await page.evaluate(() => { const a = (window as any).__neural; return a.__coldUpgradeBlock === a._landEl.querySelector('[role="radiogroup"]') })).toBe(true)
    const upgraded = await mechanics(page)
    expect(upgraded.q).toBe(before.q)
    await j.clickByMouse(`[data-panic-mc-opt="${upgraded.mc!.correct}"]`, 'answer the untouched upgraded question')
    results.push({ upgraded, after: await mechanics(page), cold: await coldState(page) })
  }
  expect(results[1]).toEqual(results[0])
  expect(results[1].cold).toMatchObject({ warmCalls: 1, cardsToday: 1, correct: 1 })
})

for (const paged of [false, true]) {
  test(`cold fallback: reveal then Space hide cannot buy fresh MC credit${paged ? ' after paging away and back' : ' (old/new differential)'}`, async ({ page }) => {
    const results = []
    // The retired renderer had no pager; the shared cold contract still compares both arms.
    for (const legacy of paged ? [false] : [true, false]) {
      const j = await catchLoop(page, legacy, true)
      const question = (await mechanics(page)).q
      await j.clickByMouse('[data-panic-reveal]', 'read the cold answer')
      await j.clickByMouse('[data-panic-answer],.pAns', 'read the answer text, leaving native focus outside the button')
      await page.keyboard.press('Space')
      if (!legacy) await expect(page.locator('[data-panic-answer]')).toBeHidden()
      if (paged) {
        await j.clickByMouse('[data-land-next]', 'leave the seen question while warm-up is pending')
        await expect.poll(() => page.evaluate(() => (window as any).__neural._landPage)).toBe(1)
        // H160/H161 STALE TIMING (2026-10-24): the next card's cursor commits before its
        // requested reader layout. On both cf773f511 and this app, releasing that layout after
        // mouse measurement moves Previous by 53px and misses it (original 0/3, observed 3/3;
        // both settled arms 3/3). Observe publication before measuring; all credit claims stay.
        await j.readerLayoutSettled()
        await expect(page.locator('[data-land-prev]')).toBeVisible()
        await j.clickByMouse('[data-land-prev]', 'return to its cached hidden answer')
        expect((await mechanics(page)).q).toBe(question)
        await expect(page.locator('[data-panic-answer]')).toBeHidden()
      }
      await releaseCold(page)
      const after = await coldState(page)
      // If the regression returns, exercise the illicit credit with an actual mouse,
      // rather than failing at a setup check before the outcome can be observed.
      if (after.mc) {
        const correct = (await mechanics(page)).mc!.correct
        await j.clickByMouse(`[data-panic-mc-opt="${correct}"]`, 'try to earn fresh MC credit after seeing this answer')
      }
      results.push({ after, credit: await coldState(page) })
    }
    console.log('COLD_SEEN', JSON.stringify({ paged, results }))
    for (const result of results) {
      expect(result.after.mc, 'an exposed answer never upgrades to fresh MC, even when hidden').toBe(false)
      expect(result.credit).toEqual({ mc: false, warmCalls: 1, cardsToday: 0, correct: 0 })
    }
    if (!paged) expect(results[1]).toEqual(results[0])
  })
}

// STALE SPEC (PR 305, owner D-307): a real catch keeps its generic stack and own films while danger is active.
// Curated IDs/counts are fixed below; the Knee Slice pair remains a nonempty wrong-role control.
test('@curated a real catch keeps its generic stack and own films while danger is active', async ({ page }) => {
  const j = await catchLoop(page)
  await settled(page)
  expect(await state(page)).toMatchObject({ pressure: true, vignette: true, key: KEY, cards: 5, caught: 1 })
  await expect(page.locator('.ng-landstack')).toBeVisible()
  await j.advance(1000)
  const before = await mechanics(page)
  await j.clickByMouse('[data-land-next]', 'browse the live catch deck')
  expect(await page.evaluate(() => (window as any).__neural._landPage)).toBe(1)
  await j.clickByMouse('[data-land-prev]', 'return to the timed question')
  expect((await mechanics(page)).remaining, 'paging cannot refill the time already spent on this question').toBeCloseTo(before.remaining!, 4)
  expect((await mechanics(page)).mc, 'the cached question keeps its answer order').toEqual(before.mc)
  await expect(page.locator('[data-defense-prompt]')).toHaveCount(0)
})

async function dangerSettings(page: Page) {
  const j = journey(page)
  await j.clickByMouse('.ngAcctChip', 'open the account menu')
  await j.clickByMouse('[data-menu-settings]', 'open Settings')
  await expect(page.locator('#ng-stab-rolling')).toBeVisible()
  await j.clickByMouse('#ng-stab-rolling', 'open Rolling settings')
  // Scroll the real panel; clickByMouse never scrolls an off-screen control for us.
  for (let i = 0; i < 8; i++) {
    const row = await page.locator('[data-danger-animation]').boundingBox()
    const panel = (await page.locator('[role="tabpanel"]').boundingBox())!
    if (row && row.y + row.height < panel.y + panel.height && row.y >= panel.y) break
    await page.mouse.move(panel.x + panel.width / 2, panel.y + panel.height / 2)
    await page.mouse.wheel(0, 220)
    await page.waitForTimeout(80)
  }
}

// STALE SPEC (PR 305, owner D-307): Danger animation toggles live visuals only and survives a reload.
// Curated IDs/counts are fixed below; the Knee Slice pair remains a nonempty wrong-role control.
test('@curated Danger animation toggles live visuals only and survives a reload', async ({ page }) => {
  const j = await catchLoop(page)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await j.advance(11000)
  await dangerSettings(page)
  const before = await mechanics(page)
  expect(before.remaining).toBeGreaterThan(0)
  expect(before.remaining).toBeLessThanOrEqual(3000)
  const status = (await page.locator('.ng-evtoast').textContent())!
  expect(status).toContain('Answer')
  await j.clickByMouse('[data-danger-animation] button:nth-child(2)', 'turn Danger animation off')
  // Reload also flushes progress. Read the durable setting before that other
  // writer can mask a missing save in this control's own click handler.
  expect(await page.evaluate(() => JSON.parse((window as any).__ngGuestProgressRaw()).settings.dangerAnimation)).toBe(false)
  expect(await mechanics(page), 'the toggle does not replace or grade a question, reset its timer, or move odds').toEqual(before)
  await expect(page.locator('.ng-evtoast')).toHaveText(status)
  await expect(page.locator('[data-land-clock-track]')).toBeVisible()
  expect(await page.evaluate(() => {
    const a = (window as any).__neural
    return { saved: a.get('dangerAnimation', true), pressure: a._defensePressure, vignette: !!a._vignetteEl, glow: a._landEl.style.boxShadow }
  })).toEqual({ saved: false, pressure: true, vignette: false, glow: '' })
  await j.advance(500)
  expect((await mechanics(page)).remaining).toBeCloseTo(before.remaining! - 500, 4)
  expect(await page.evaluate(() => (window as any).__neural._landEl.style.boxShadow)).toBe('')
  // Genuine reload, preserving storage only across the DSL's test-only wipe hook.
  await page.evaluate(() => sessionStorage.setItem('__ng_keep', '1'))
  await page.reload()
  await calm(page)
  expect(await page.evaluate(() => (window as any).__neural.get('dangerAnimation', true))).toBe(false)
  await dangerSettings(page)
  await j.clickByMouse('[data-danger-animation] button:nth-child(1)', 'turn Danger animation on again')
  expect(await page.evaluate(() => (window as any).__neural.get('dangerAnimation', true))).toBe(true)
  expect((await state(page)).vignette, 'a setting cannot turn navigation into a catch').toBe(false)
})

// The browser delivers media-query changes outside the manual simulation clock.
// advance(20) cannot establish that the real change handler has run. Delayed native
// delivery reproduces the immediate-assert race on base and head; waiting for the
// visible outcome passes while removing the real listener must still fail.
test('@curated reduced motion keeps a static cue and suppresses frame-driven danger without changing the saved setting', async ({ page }) => {
  const j = await catchLoop(page)
  expect((await state(page)).vignette).toBe(true)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect.poll(() => page.locator('.ng-vignette').evaluate(el => ({ opacity: getComputedStyle(el).opacity, animations: el.getAnimations().length }))).toEqual({ opacity: '0.144', animations: 0 })
  await j.advance(11000)
  const before = await mechanics(page)
  expect(before.remaining).toBeGreaterThan(0)
  expect(before.remaining).toBeLessThanOrEqual(3000)
  expect(await page.evaluate(() => {
    const a = (window as any).__neural
    return { saved: a.get('dangerAnimation', true), pressure: a._defensePressure, vignette: !!a._vignetteEl,
      glow: a._landEl.style.boxShadow, hot: a._landEl.classList.contains('ng-clock-hot'), clock: a._landClockEl.style.transform }
  })).toMatchObject({ saved: true, pressure: true, vignette: true, glow: '', hot: false })
  await j.advance(500)
  expect((await mechanics(page)).remaining).toBeCloseTo(before.remaining! - 500, 4)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await j.advance(20)
  await expect.poll(async () => (await state(page)).vignette, 'the real media-change handler restores danger').toBe(true)
})

// ── D-351: an article that lands after the catch never moves a live answer ────────────────────
// Since D-338 the panic card sits in the reader's column under Videos and Moves, and the catch
// opens the submission's defender article. Arriving 29-79ms after the card was clickable, its
// Videos section pushed the hand and the answers down 114px, so a measured click on an answer
// executed an escape move instead (10 full-file runs, 180 tests: dev 557c57d14 0 red, this
// branch 6, H49; traced in H50/H51). The reader now holds a landing until the article it asked for
// renders (800ms at most), and parts the ceiling publishes stay pinned until they settle.
// These journeys trace the ANSWERS only; the hand's half of the hold is gated by article-sections'
// exchange journey (control d351-hand-hold-removed, D-352 N1).
// Delaying the article fetch, not the deck, is what makes the state reachable on demand. Only the
// defender page is held: the reader fetches the hub after it, and holding both would stack.
const LOOP_DEFENDER = '/Submissions/Loop-Choke/from-Half-Guard/Defender'
const lateArticle = (page: Page, ms: number) => {
  const held: string[] = []
  return { held, route: () => page.route((url) => url.pathname === LOOP_DEFENDER, async (route) => {
    if (route.request().resourceType() === 'fetch') { held.push(new URL(route.request().url()).pathname); await new Promise((r) => setTimeout(r, ms)) }
    await route.continue()
  }) }
}
// Per animation frame, the first answer's rectangle and whether it is shown, beside the
// reader's readiness for the article the catch opened.
const traceAnswer = (page: Page) => page.evaluate(() => {
  const w = window as any, out: any[] = (w.__d351 = []), t0 = performance.now()
  const tick = () => {
    const r = w.__neural?._reader, el = document.querySelector('[data-panic-mc-opt]') as HTMLElement | null, box = el?.getBoundingClientRect()
    out.push({ t: Math.round(performance.now() - t0), ready: r?.root.dataset.readerReady, path: r?.path, present: !!el,
      shown: !!el && !!box!.height && getComputedStyle(el).visibility !== 'hidden', top: box?.top, left: box?.left, lifted: !!r?.videoCard })
    if (performance.now() - t0 < 30000 && !w.__d351stop) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
})
// D-368 (layout C): the current card is shown in the reader's media home, visibly, with a height.
const filmShown = () => { const a = (window as any).__neural, f = a._landFilmEl, home = a._reader?.mediaHome
  return !!f && f.parentElement === home && !home.hidden && !f.hidden && f.getBoundingClientRect().height > 0 && getComputedStyle(f).visibility !== 'hidden' }
const answerTrace = (page: Page) => page.evaluate(() => { (window as any).__d351stop = true; return (window as any).__d351 as any[] })

test('D-351: a catch whose article lands late shows its answers once, at their final rect, and a click grades them', async ({ page }) => {
  const late = lateArticle(page, 500)
  const j = await catchLoop(page, false, false, async () => { await late.route(); await traceAnswer(page) })
  await expect(page.locator(READY)).toHaveAttribute('data-reader-path', LOOP_DEFENDER)
  await j.advance(200)
  const S = await answerTrace(page), rendered = (x: any) => x.ready === 'true' && x.path === LOOP_DEFENDER
  expect(late.held.length, 'premise: the defender article fetch was held 500ms').toBeGreaterThan(0)
  expect(S.some((x) => x.present && !rendered(x)), 'premise: the question existed while its article was loading').toBe(true)
  const shown = S.filter((x) => x.shown)
  expect(shown.filter((x) => !rendered(x)), 'no answer is shown before the catch article renders').toEqual([])
  expect(shown.length, 'premise: the answer was traced on screen').toBeGreaterThan(3)
  const tops = shown.map((x) => x.top), lefts = shown.map((x) => x.left)
  expect(Math.max(...tops) - Math.min(...tops) + Math.max(...lefts) - Math.min(...lefts), 'the answer appears once, at its final rect').toBeLessThan(0.5)
  const mc = (await mechanics(page)).mc!
  await j.clickByMouse(`[data-panic-mc-opt="${mc.correct}"]`, 'answer the panic card where it sits')
  expect(await page.evaluate(() => !!(window as any).__neural._optList), 'the click executed no escape move').toBe(true)
  expect((await mechanics(page)).grades.map((g: any) => g.beat), 'the measured click graded the intended answer').toContain('mc_correct')
})

test('D-351: past the 800ms ceiling the answers publish, and the late article still never moves them', async ({ page }) => {
  const late = lateArticle(page, 1500)
  const j = await catchLoop(page, false, false, async () => { await late.route(); await traceAnswer(page) })
  await expect(page.locator(READY)).toHaveAttribute('data-reader-path', LOOP_DEFENDER, { timeout: 10_000 })
  await j.advance(200)
  const S = await answerTrace(page), rendered = (x: any) => x.ready === 'true' && x.path === LOOP_DEFENDER
  expect(late.held.length, 'premise: the defender article fetch was held 1.5s').toBeGreaterThan(0)
  const shown = S.filter((x) => x.shown)
  expect(shown.some((x) => !rendered(x)), 'premise: the ceiling published the answers before the article').toBe(true)
  expect(shown.some(rendered), 'premise: the article landed while the answers were live').toBe(true)
  const tops = shown.map((x) => x.top), lefts = shown.map((x) => x.left)
  expect(Math.max(...tops) - Math.min(...tops) + Math.max(...lefts) - Math.min(...lefts), 'the answers never move when the late article lands').toBeLessThan(0.5)
  const mc = (await mechanics(page)).mc!
  await j.clickByMouse(`[data-panic-mc-opt="${mc.correct}"]`, 'answer the panic card where it sits')
  expect(await page.evaluate(() => !!(window as any).__neural._optList), 'the click executed no escape move').toBe(true)
  expect((await mechanics(page)).grades.map((g: any) => g.beat), 'the measured click graded the intended answer').toContain('mc_correct')
  // Graded is settled: the held-back film shows now, after the player's own input. STALE SPEC (D-368, layout C):
  // nothing lifts any more; the current card shows in the game's media home, beside the question card.
  await expect.poll(() => page.evaluate(filmShown), 'the held-back film shows once the answer is graded').toBe(true)
})

// D-352 S2: past the ceiling the answers publish pinned; a film that arrives while they are pinned
// (the caught submission's content chunk is fetched at the catch, and here it lands after both the
// ceiling and the article) must wait, never opening the media home over the pinned hand. Review-claude
// measured the failure at 1440: the film at y218-316 over the pinned row at y218-414 for 164 frames.
test('D-352: past the ceiling, a film arriving while the answers are pinned never covers the hand', async ({ page }) => {
  const late = lateArticle(page, 1500)
  let chunks = 0
  const j = await catchLoop(page, false, false, async () => {
    await late.route()
    await page.route('**/static/neural/content/*.json', async (route) => { chunks++; await new Promise((r) => setTimeout(r, 2600)); await route.continue() })
    await page.evaluate(() => {
      const w = window as any, out: any[] = (w.__d352 = []), t0 = performance.now()
      const box = (el: any) => { if (!el || !el.getClientRects().length || getComputedStyle(el).visibility === 'hidden') return null; const r = el.getBoundingClientRect(); return r.height ? [r.left, r.top, r.right, r.bottom] : null }
      const tick = () => {
        const a = w.__neural
        out.push({ t: Math.round(performance.now() - t0), pinned: !!a._readerPin, film: !!a._landFilmEl, filmBox: box(a._landFilmEl), row: box(a.optionsRef.current) })
        if (!w.__d352stop) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
  })
  await expect.poll(() => page.evaluate(() => { const a = (window as any).__neural; return !!a._readerPin && !!a._landFilmEl }), { timeout: 10_000, message: 'premise: the film arrived while the answers were pinned' }).toBe(true)
  await j.advance(200)
  const S = await page.evaluate(() => { (window as any).__d352stop = true; return (window as any).__d352 as any[] })
  expect(late.held.length, 'premise: the defender article fetch was held 1.5s').toBeGreaterThan(0)
  expect(chunks, 'premise: the content chunk was held past the ceiling').toBeGreaterThan(0)
  const pinned = S.filter((x) => x.pinned && x.film && x.row)
  expect(pinned.length, 'premise: frames with the film present while pinned').toBeGreaterThan(3)
  const over = pinned.filter((x) => x.filmBox && x.filmBox[0] < x.row[2] && x.filmBox[2] > x.row[0] && x.filmBox[1] < x.row[3] && x.filmBox[3] > x.row[1])
  expect(over, 'the film never covers the pinned hand').toEqual([])
  const mc = (await mechanics(page)).mc!
  await j.clickByMouse(`[data-panic-mc-opt="${mc.correct}"]`, 'answer the panic card where it sits')
  // Graded is settled: the held-back film shows now, after the player's own input. STALE SPEC (D-368, layout C):
  // nothing lifts any more; the current card shows in the game's media home, beside the question card.
  await expect.poll(() => page.evaluate(filmShown), 'the held-back film shows once the answer is graded').toBe(true)
})

// D-353 (review-claude Delta 7, B1): a play is the player's own input and settles the pin, as grading
// does. Pinned, the opened player grew the film in place over the escape tray (y218-440 over the row
// at y332; the titles' clicks went to the film), and the next relayout hid the playing video under
// S2's rule. Released, the rows move down beside the player.
test('D-353: playing the pinned film opens it beside the hand, never over it, and it stays visible', async ({ page }) => {
  const late = lateArticle(page, 6000)
  const j = await catchLoop(page, false, false, async () => { await late.route(); await traceAnswer(page) })
  await expect.poll(() => page.evaluate(() => {
    const a = (window as any).__neural, f = a._landFilmEl
    return !!a._readerPin && a._readerPin.film === a._reader.media && !!f && f.getClientRects().length > 0 && getComputedStyle(f).visibility !== 'hidden'
  }), { message: 'premise: the answers published pinned with the film shown in the media home' }).toBe(true)
  const S = await answerTrace(page)
  const shown = S.filter((x) => x.shown)
  expect(shown.length, 'premise: the answers were traced on screen before the play').toBeGreaterThan(3)
  const tops = shown.map((x) => x.top)
  expect(Math.max(...tops) - Math.min(...tops), 'the answers never move before the play').toBeLessThan(0.5)
  await j.clickByMouse('.ng-landfilm .ng-clip', 'play the pinned film')
  await expect.poll(() => page.evaluate(() => !!(window as any).__neural._expandedClip), { message: 'premise: the clip opened its player' }).toBe(true)
  await j.readerLayoutSettled()
  const hits = await page.evaluate(() => {
    const a = (window as any).__neural, film = a._landFilmEl, out: any[] = []
    for (const t of a.optionsRef.current.querySelectorAll('[data-tech] .ngchoice-title')) {
      const r = t.getBoundingClientRect()
      if (!r.height || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      out.push({ title: t.textContent.trim(), onFilm: !!hit && film.contains(hit) })
    }
    return out
  })
  expect(hits.length, 'premise: escape titles are on screen').toBeGreaterThan(0)
  expect(hits.filter((h) => h.onFilm), 'no escape title hits the film').toEqual([])
  await page.evaluate(() => (window as any).__neural._reader.layoutNow())
  const film = await page.evaluate(() => {
    const a = (window as any).__neural, f = a._landFilmEl, r = f.getBoundingClientRect()
    return { playing: !!a._expandedClip, visible: f.getClientRects().length > 0 && getComputedStyle(f).visibility !== 'hidden' && r.height > 0 }
  })
  expect(film, 'the playing player stays visible through a relayout').toEqual({ playing: true, visible: true })
})

// RETIRED (D-368, layout C): D-354 N1 pinned a play after the article rendered into the lifted Videos card.
// Under C a game node's current card never moves into the Videos slot (it sits in the game's media home,
// beside or above the question), so no empty slot can be left under a playing film; D-353's journey keeps
// the play beside the hand. Its control d354-play-film-left-home is retired with it.

// D-354 N2 (D8C): closing the pinned film hides its home for the pin's life (D-352's sticky rule), so
// the player's own reopen did nothing until the parts settled. A reopen settles the pin, as a play does.
test('D-354 N2: reopening Videos while pinned settles the pin and shows the film', async ({ page }) => {
  const late = lateArticle(page, 1500)
  const j = await catchLoop(page, false, false, async () => { await late.route() })
  await expect.poll(() => page.evaluate(() => {
    const a = (window as any).__neural, f = a._landFilmEl
    return !!a._readerPin && a._readerPin.film === a._reader.media && !!f && f.getClientRects().length > 0
  }), { message: 'premise: the answers published pinned with the film shown in the media home' }).toBe(true)
  await j.clickByMouse('.ng-landfilm [data-film-close]', 'hide the pinned film')
  await expect(page.locator(READY)).toHaveAttribute('data-reader-path', LOOP_DEFENDER)
  // U11 (D-355): where the index shows, a closed section leaves no placeholder; its index row reopens it.
  const indexed = await page.locator('[data-reader][data-indexed]').count() > 0
  const toggle = indexed ? '[data-toc-type="videos"] a' : '[data-section-toggle="videos"]'
  if (!indexed) await page.evaluate((sel) => document.querySelector(sel)!.scrollIntoView({ block: 'center' }), toggle)
  await j.readerLayoutSettled()
  const closed = await page.evaluate(() => {
    const a = (window as any).__neural, f = a._landFilmEl
    return { pinned: !!a._readerPin, hid: !!a._readerPin?.hid, shown: !!f && f.getClientRects().length > 0 && !f.hidden && f.getBoundingClientRect().height > 0 }
  })
  expect(closed, 'premise: still pinned, the closed film hidden').toEqual({ pinned: true, hid: true, shown: false })
  await j.clickByMouse(toggle, 'reopen Videos while pinned')
  await expect.poll(() => page.evaluate(() => {
    const a = (window as any).__neural, f = a._landFilmEl
    return { pinned: !!a._readerPin, shown: !!f && f.getClientRects().length > 0 && !f.hidden && f.getBoundingClientRect().height > 0 }
  }), { message: 'the reopen settles the pin and the film is shown again' }).toEqual({ pinned: false, shown: true })
})

// D-354 N3: D-353 observes a film in the media home; the film's only remover (_clearLandFilm)
// now ends that observation, so a replaced film is not held until the reader is destroyed.
test('D-354 N3: a removed film is no longer observed by the reader', async ({ page }) => {
  await page.addInitScript(() => {
    const P = ResizeObserver.prototype, observe = P.observe, unobserve = P.unobserve, disconnect = P.disconnect, held = new WeakMap<object, Set<Element>>()
    ;(window as any).__roHolds = (ro: object, el: Element) => !!held.get(ro)?.has(el)
    P.observe = function (el: Element, ...rest: any[]) { if (!held.has(this)) held.set(this, new Set()); held.get(this)!.add(el); return observe.call(this, el, ...rest) }
    P.unobserve = function (el: Element) { held.get(this)?.delete(el); return unobserve.call(this, el) }
    P.disconnect = function () { held.get(this)?.clear(); return disconnect.call(this) }
  })
  const late = lateArticle(page, 6000)
  await catchLoop(page, false, false, async () => { await late.route() })
  await expect.poll(() => page.evaluate(() => {
    const w = window as any, a = w.__neural, f = a._landFilmEl
    return !!f && f.parentElement === a._reader.mediaHome && w.__roHolds(a._reader.resize, f)
  }), { message: 'premise: the film in the media home is observed by the reader' }).toBe(true)
  const released = await page.evaluate(() => {
    const w = window as any, a = w.__neural, f = a._landFilmEl
    a._clearLandFilm()
    return { removed: !f.isConnected, observed: w.__roHolds(a._reader.resize, f) }
  })
  expect(released, 'the removed film is no longer observed by the reader').toEqual({ removed: true, observed: false })
})

// D-433 (2026-10-26), D-370 adapted to U35: the covered phone question must
// expose Reveal and every opened answer without scrolling. This supersedes U16 b's
// phone Moves-first/scroll-accepted premise. Keep desktop clearance, native Moves,
// account visibility, normal card padding, target size and execution handoff claims.
test.beforeEach(async ({ page }, info) => { if (!/^(D-368|U16 b|D-433)/.test(info.title)) return
  await page.addInitScript(() => { (window as any).__d368film = () => { const f = (window as any).__neural?._landFilmEl
    return !!f && f.isConnected && !f.hidden && f.getClientRects().length > 0 && f.getBoundingClientRect().height > 0 } }) })
for (const [width, height] of [[1440, 900], [390, 844], [390, 631]] as const) {
  test(width > 640 ? `D-368: in a catch at ${width}x${height} the escape answers are on screen without scrolling`
    : `D-433: in a catch at ${width}x${height} every opened answer is reachable without scrolling`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const j = await catchLoop(page)
    await j.readerLayoutSettled()
    const r = await page.evaluate(() => {
      const a = (window as any).__neural
      const answers = [...document.querySelectorAll('[data-panic-mc-opt]')].map((el: any) => {
        const b = el.getBoundingClientRect(), hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2)
        return { top: Math.round(b.top), bottom: Math.round(b.bottom), hit: !!hit && el.contains(hit) }
      })
      return { answers, film: (window as any).__d368film(), layout: a._reader.game.dataset.mediaLayout,
        end: Math.round(a._reader.root.getBoundingClientRect().bottom), pressure: !!a._defensePressure,
        handBottom: a.optionsRef.current.getBoundingClientRect().bottom, handTop: a.optionsRef.current.getBoundingClientRect().top, cardTop: a._landEl.getBoundingClientRect().top, cardBottom: a._landEl.getBoundingClientRect().bottom, band: a._reader.nodeBand.height }
    })
    expect(r.film, 'premise: the current card is shown').toBe(true)
    expect(r.pressure, 'premise: a live catch').toBe(true)
    expect(r.answers.length, 'premise: the escape answers').toBeGreaterThan(1)
    if (width > 640) {
      const off = r.answers.filter((x) => !x.hit || x.top < 0 || x.bottom > Math.min(height, r.end) - 8)
      expect(off, 'every escape answer is on screen and reachable without scrolling, 8px clear of the scrollport end').toEqual([])
    } else {
      // D-433 restores D-370's no-scroll answers for U35. Unlike the old
      // combined-fit oracle, this checks the actual clipped reader and targets.
      expect(r.band, 'D-433 live phone band preserves the opened question clearance').toBe(height < 700 ? 80 : 144)
      expect(r.handTop - r.cardBottom, 'D-433 keeps native Moves separate after the phone question').toBeGreaterThanOrEqual(16)
      expect(r.answers.filter(x => !x.hit || x.top < 0 || x.bottom > Math.min(height, r.end) - 8),
        'D-433 every answer is immediately hit-testable, 8px clear of the reader end').toEqual([])
      const answers = page.locator('[data-panic-mc-opt]')
      const identities = await answers.evaluateAll(es => es.map(e => e.getAttribute('data-panic-mc-opt')))
      for (const identity of identities) {
        const answer = page.locator(`[data-panic-mc-opt="${identity}"]`)
        await answer.evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' }))
        await j.readerLayoutSettled()
        const visible = await answer.evaluate(el => {
          const b = el.getBoundingClientRect(), root = el.closest('[data-reader]')!.getBoundingClientRect()
          const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2)
          return { inside: b.top >= root.top && b.bottom <= root.bottom, hit: !!hit && el.contains(hit), height: b.height }
        })
        expect(visible, `escape answer ${identity} is fully visible and hit-testable after scrolling`).toMatchObject({ inside: true, hit: true })
        expect(visible.height, 'the escape answer keeps its 44px target').toBeGreaterThanOrEqual(44)
      }
      // Also deliver an actual mouse activation after scrolling, retaining the deck's own identity.
      const correct = await page.evaluate(() => String((window as any).__neural._mc.correct))
      const target = `[data-panic-mc-opt="${correct}"]`
      await page.locator(target).evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' }))
      await j.readerLayoutSettled()
      // U16 b (owner, 2026-10-24): a live catch answers through _mcAnswer/_defenseAnswered,
      // which emits mc_correct and advances its deck, not the calm landing's land_q_answered beat.
      // H158 already advanced to Card 2/5; the original new oracle named the wrong event.
      const answered = () => page.evaluate(() => { const a = (window as any).__neural
        return { correct: a.beats.filter((b: any) => b.beat === 'mc_correct').length, page: a._landPage } })
      const before = await answered()
      await j.clickByMouse(target, 'answer the scrolled live catch')
      expect(await answered(), 'the scrolled escape answer receives its real mouse click and advances the deck').toEqual({ correct: before.correct + 1, page: before.page + 1 })
    }
  })
}

test('D-368: at 1440x900 the question card\'s top is above the fold', async ({ page }) => {
  const j = journey(page)
  await j.boot('/Positions/Half-Guard/Bottom', { beforeNavigate: realContent })
  await expect(page.locator(READY)).toBeVisible()
  await j.hydrateAll()
  await j.readerLayoutSettled()
  const r = await page.evaluate(() => ({ film: (window as any).__d368film(), top: Math.round((window as any).__neural._landEl.getBoundingClientRect().top) }))
  expect(r.film, 'premise: the current card is shown').toBe(true)
  expect(r.top, "the question card's top is above the fold").toBeLessThan(900)
})

// D-433 (2026-10-26): the short live catch uses an 80px band and question-first order.
// Retain U16 b's visible account and normal card spacing. The clicked escape keeps
// its measured rectangle through the pick/result; D-325's handoff claim is unchanged.
test('D-433: at 390x631 the smaller live band reverts without moving the native pick', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 631 })
  const j = await catchLoop(page)
  await j.readerLayoutSettled()
  const look = () => page.evaluate(() => {
    const a = (window as any).__neural, acct = a.accountRef.current
    return { band: a._reader.nodeBand?.height, account: getComputedStyle(acct).visibility, conceded: a.wrapRef.current.hasAttribute('data-phone-catch'),
      padding: a._landEl ? getComputedStyle(a._landEl).paddingTop : null,
      end: Math.round(a._reader.root.getBoundingClientRect().bottom), acctTop: Math.round(acct.getBoundingClientRect().top), pressure: !!a._defensePressure }
  })
  const caught = await look()
  expect(caught, 'D-433 short live catch uses the smaller band').toMatchObject({ pressure: true, band: 80, account: 'visible', conceded: true, padding: '11px' })
  expect(caught.end, 'the account keeps its scrollport reserve during the catch').toBeLessThanOrEqual(caught.acctTop - 8)
  const title = '[data-tech] .ngchoice-title'
  await page.evaluate((sel) => (window as any).__neural.optionsRef.current.querySelector(sel).scrollIntoView({ block: 'nearest', behavior: 'instant' }), title)
  await j.readerLayoutSettled()
  const name = await page.evaluate((sel) => (window as any).__neural.optionsRef.current.querySelector(sel).closest('[data-tech]').dataset.tech, title)
  const rect = (sel: string) => page.evaluate((sel) => { const b = document.querySelector(sel)!.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom] }, sel)
  const chosen = await rect(`[data-tech="${name}"]`)
  await j.clickByMouse(`[data-tech="${name}"] .ngchoice-title`, 'pick an escape')
  await j.advance(40)
  expect(await look(), 'at the pick the small band holds and the account stays visible').toMatchObject({ band: 80, account: 'visible', conceded: true })
  // D-433 changes phone ordering, not the native handoff: the picked escape
  // stays in place, including when the result restores the taller band.
  const stand = await rect('[data-executing-tech]')
  expect(stand.map((v, i) => Math.abs(v - chosen[i])).every((d) => d <= 2), `the stand-in sits where the escape was (${stand} vs ${chosen})`).toBe(true)
  await expect.poll(async () => { await j.advance(200); return (await look()).pressure }, 'the escape resolves').toBe(false)
  await expect.poll(async () => (await look()).conceded, 'the reader lays out the result').toBe(false)
  const after = await look()
  expect(after, 'the result transition restores the usual 186px band').toMatchObject({ band: 186, account: 'visible', conceded: false })
  expect(after.end, 'the scrollport still ends above the account button').toBeLessThanOrEqual(after.acctTop - 8)
  const result = await rect('[data-executing-tech]')
  expect(result.map((v, i) => Math.abs(v - chosen[i])).every((d) => d <= 2), 'the result-time band revert preserves the picked escape rectangle').toBe(true)
})

// U16 b (owner, 2026-10-24): the narrower band belongs to a LIVE catch, never a calm defender arrival.
test('U16 b: a calm phone defender landing keeps the usual 186px band', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const j = journey(page)
  await j.boot(LOOP + '/Defender', { beforeNavigate: realContent })
  await calm(page); await j.readerLayoutSettled()
  expect(await page.evaluate(() => (window as any).__neural._reader.nodeBand.height), 'a calm phone defender keeps the usual band').toBe(186)
})
