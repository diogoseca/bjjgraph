import { test, expect, type Page } from '@playwright/test'
import { journey } from '../dsl'
import { legacyDefenseRenderer } from '../fixtures/legacy-defense-renderer'

// v1.227.0 — owner's 2026-10-15 rule supersedes v1.134.0: navigation starts a new,
// calm journey. An answer/play on a dormant defender seat is the third state;
// it cannot manufacture an opponent catch. All buttons use clickByMouse. Orbs
// are canvas drawings, so their actual _LY coordinates are hit-tested and clicked.
// Authored clips come from THIS build, not the DSL's usual empty dossier fixtures.
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
// Playback on YouTube is outside this contract; mounted reel identity is in it.
const LOOP = '/Submissions/Loop-Choke/from-Half-Guard'
const KEY = 'Loop Choke from Half Guard|Defender'
const CLIPS = ['pZmJpXSwRTk', 'iv2YYbzYl-s']
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
async function catchLoop(page: Page, legacy = false) {
  const j = journey(page)
  await j.boot('/Positions/Half-Guard/Bottom', { beforeNavigate: realContent })
  await expect(page.locator(READY)).toBeVisible()
  await j.hydrateAll()
  await page.evaluate(({ old, legacy }) => {
    const a = (window as any).__neural
    // URL staging draws these before boot() can enqueue RNG. Hold the initial
    // opponent and roll length identical for the old/new renderer comparison.
    a.aiSkill = .13; a.maxMoves = 11
    if (legacy) {
      const render = a.renderLandCard
      const previous = new Function('return ({' + old + '}).buildPanicCard')()
      a.renderLandCard = function (node: any, mode: string, ...args: any[]) {
        if (mode === 'defense') {
          previous.call(this, this.optionsRef.current, this.nodes[this._defendSub])
          // The old enterDefense armed immediately AFTER buildPanicCard returned.
          this._armLandClock(this._landEl?.querySelector('[data-land-clock]'))
          return this._landEl
        }
        return render.call(this, node, mode, ...args)
      }
    }
    for (const [tag, values] of Object.entries({ resolve: [.999], outcome: [0], 'opp-finish': [0], 'opp-sub-pick': [.75], 'opp-pick': [0], escape: [0], 'panic-mc-pick': Array(40).fill(.23), 'panic-mc-shuffle': Array(40).fill(.61) })) a.rig(tag, values)
    const pick = a._optionCards.find((c: any) => c.opt.node.t === 'Half Guard to Back Take' && !c.opt.threat)
    if (!pick) throw new Error('the authored move is absent')
    pick.card.setAttribute('data-defending-commit', '')
  }, { old: legacyDefenseRenderer, legacy })
  await j.clickByMouse('[data-defending-commit]', 'commit Half Guard to Back Take')
  await j.advanceUntil('caught', 20000, 100)
  await expect(page.locator('[data-panic-mc-opt]').first()).toBeVisible()
  await expect(page.locator('.ng-evtoast')).toContainText('Caught')
  expect(await page.evaluate(() => (window as any).__neural.nodes[(window as any).__neural._defendSub].t)).toBe('Loop Choke from Half Guard')
  return j
}

test('@curated link, reload and dormant answer keep the generic five-card defender landing calm', async ({ page }) => {
  const j = journey(page)
  await j.boot(LOOP + '/Defender', { beforeNavigate: realContent })
  await calm(page)
  await j.clickByMouse('[data-land-next]', 'browse the next defender card')
  expect(await page.evaluate(() => (window as any).__neural._landPage)).toBe(1)
  await j.clickByMouse('[data-land-prev]', 'return to the first defender card')
  const correct = await page.evaluate(() => (window as any).__neural._mc.correct)
  await j.clickByMouse(`[data-panic-mc-opt="${correct}"]`, 'answer the cold defender landing')
  await j.advance(20000)
  expect(await state(page)).toMatchObject({ pressure: false, vignette: false, caught: 0, remaining: null })
  await page.reload()
  await calm(page)
  expect(await state(page)).toMatchObject({ caught: 0, remaining: null })
})

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

test('@curated the transition defender renders its three authored clips on the first render', async ({ page }) => {
  const j = journey(page)
  await j.boot('/Transitions/Kuzure-Kesa-Gatame-to-Kesa-Gatame/Defender', { beforeNavigate: realContent })
  await expect(page.locator(READY)).toBeVisible()
  await expect.poll(async () => (await state(page)).clips).toEqual(['2M_6VytUaus', '-zFQ6h4yKT4', 'C98ztdlur4E'])
  expect(await state(page)).toMatchObject({ pressure: false, vignette: false, cards: 4, key: 'Kuzure Kesa Gatame to Kesa Gatame|Defender' })
})

test('@curated each Knee Slice Pass half mounts its own clips, including the reader perspective link', async ({ page }) => {
  const j = journey(page)
  await j.boot('/Transitions/Knee-Slice-Pass/Attacker', { beforeNavigate: realContent })
  await expect(page.locator(READY)).toBeVisible()
  await expect.poll(async () => (await state(page)).clips).toEqual(['yj_6xcl2emA', 'TIsH40L5AVQ', 'p40WssWwJoY'])
  await j.clickByMouse('[data-reader]', 'expand the article to reach its perspective links')
  await j.clickByMouse('[aria-label="Reading perspectives"] a[href$="/Defender"]', 'open the defending article perspective')
  await expect(page.locator(READY)).toHaveAttribute('data-reader-path', '/Transitions/Knee-Slice-Pass/Defender')
  await expect.poll(async () => (await state(page)).clips).toEqual(['RvIIpXaPyJM', 'lVLAROiSjNU'])
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
    odds: a.escapeOddsSnapshot(), choices: a._optList.map((o: any) => ({ label: a.choiceLabel(o), res: o.res, role: o.destinationRole })),
    grades: a.beats.filter((b: any) => ['mc_correct', 'mc_wrong', 'escape_odds_pumped', 'land_q_expired', 'combo_break'].includes(b.beat)).map(({ t, ...b }: any) => b) }
})

for (const answer of ['right', 'wrong', 'expiry']) {
  test(`real-catch renderer differential: ${answer} has identical questions, timing, grades, odds and choices`, async ({ page }) => {
    const results = []
    for (const legacy of [true, false]) {
      const j = await catchLoop(page, legacy)
      const before = await mechanics(page)
      expect(before.total).toBe(13500)
      if (answer === 'expiry') await j.advance(14000)
      else {
        const mc = before.mc!
        await j.clickByMouse(`[data-panic-mc-opt="${answer === 'right' ? mc.correct : (mc.correct + 1) % mc.n}"]`)
      }
      results.push({ before, after: await mechanics(page) })
    }
    expect(results[1], 'the generic renderer preserves the retired live drill mechanics').toEqual(results[0])
  })
}

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

test('@curated reduced motion suppresses CSS and frame-driven danger without changing the saved setting', async ({ page }) => {
  const j = await catchLoop(page)
  expect((await state(page)).vignette).toBe(true)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await j.advance(11000)
  const before = await mechanics(page)
  expect(before.remaining).toBeGreaterThan(0)
  expect(before.remaining).toBeLessThanOrEqual(3000)
  expect(await page.evaluate(() => {
    const a = (window as any).__neural
    return { saved: a.get('dangerAnimation', true), pressure: a._defensePressure, vignette: !!a._vignetteEl,
      glow: a._landEl.style.boxShadow, hot: a._landEl.classList.contains('ng-clock-hot'), clock: a._landClockEl.style.transform }
  })).toMatchObject({ saved: true, pressure: true, vignette: false, glow: '', hot: false })
  await j.advance(500)
  expect((await mechanics(page)).remaining).toBeCloseTo(before.remaining! - 500, 4)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await j.advance(20)
  expect((await state(page)).vignette).toBe(true)
})
