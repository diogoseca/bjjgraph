import { test, expect, type Page } from '@playwright/test'
import { journey } from '../dsl'

// v1.227.0: owner 2026-10-15 supersedes v1.134.0. Navigation ends the
// current journey even after an actual opponent catch. Only fixture preparation
// uses app methods; navigation controls are reached with the mouse and wheel.
// Built dossiers are served here (the DSL normally replaces them with {}).
// The animation preference is off in this fixture so the sidebar's logo remains
// available during the catch. Pressure must still be live before every exit.
// MUTANT M14 freezes clearEngagement's journey identity: sidebar search fails
// its same-app journey-change assertion after the actual opponent catch.
// STALE TIMING (PR 307 CI): the caught card can publish before its article/TOC.
// Await that article and its layout before the native Overview click.
const ID = 'Submissions/Loop-Choke/from-Half-Guard'
const READY = '[data-reader-ready="true"]'
const content = async (page: Page) => { await page.route('**/static/neural/content/*.json', r => r.continue()) }
const snapshot = (page: Page) => page.evaluate(() => {
  const w = window as any, a = w.__neural
  if (w.__arrivalIdentity?.app !== a) w.__arrivalIdentity = { app: a, id: (w.__arrivalIdentity?.id || 0) + 1 }
  return { document: performance.timeOrigin, instance: w.__arrivalIdentity.id, journey: a._journeyId || 0, pressure: !!a._defensePressure, caught: a.beats.filter((b: any) => b.beat === 'caught').length,
    vignette: !!a._vignetteEl, key: a._landQ?.key, remaining: a._decision?.remaining ?? null }
})
async function caught(page: Page) {
  const j = journey(page)
  await j.boot('/Positions/Half-Guard/Bottom', {
    beforeNavigate: content, initialState: { v: 2, settings: { dangerAnimation: false }, settingsAt: {} },
  })
  await j.hydrateAll()
  await page.evaluate(() => {
    const a = (window as any).__neural
    a.aiSkill = .13; a.maxMoves = 11
    for (const [k, v] of Object.entries({ resolve: [.999], outcome: [0], 'opp-finish': [0], 'opp-sub-pick': [.75], 'opp-pick': [0], escape: [0] })) a.rig(k, v)
    a._optionCards.find((c: any) => c.opt.node.t === 'Half Guard to Back Take' && !c.opt.threat).card.setAttribute('data-arrival-commit', '')
  })
  await j.clickByMouse('[data-arrival-commit]')
  await j.advanceUntil('caught', 20000, 100)
  await expect(page.locator('[data-panic-mc-opt]').first()).toBeVisible()
  expect(await snapshot(page)).toMatchObject({ pressure: true, caught: 1, key: 'Loop Choke from Half Guard|Defender' })
  return { j, previous: await snapshot(page) }
}
async function calm(page: Page, previous: { document: number, instance: number, journey: number }, path = '/' + ID + '/Defender') {
  await expect(page.locator(READY)).toHaveAttribute('data-reader-path', path)
  await journey(page).advance(20000)
  const s = await snapshot(page)
  // Quartz may replace the app inside this same document on Back/Forward.
  // Counters are local to an app instance; track the actual object identity too.
  expect(s.document !== previous.document || s.instance !== previous.instance || s.journey > previous.journey,
    'navigation starts a fresh journey: ' + JSON.stringify({ previous, current: s })).toBe(true)
  expect(s).toMatchObject({ pressure: false, vignette: false, remaining: null })
  if (path.endsWith(ID + '/Defender')) {
    expect(s.key).toBe('Loop Choke from Half Guard|Defender')
    await expect(page.locator('.ng-landstack')).toBeVisible()
    await expect(page.locator('.ng-landfilm .ng-clip')).toHaveCount(2)
  }
}
async function explore(page: Page) {
  const j = journey(page)
  await j.clickByMouse('.ng-logo', 'open the sidebar during a live catch')
  await j.clickByMouse('[data-view="explore"]', 'open Browse')
  await page.evaluate(async () => {
    const a = (window as any).__neural
    await Promise.all([a._ensureSystems(), a._ensureConcepts()])
  })
  await page.waitForTimeout(450)
}
async function wheelTo(page: Page, selector: string, scroller: string) {
  for (let i = 0; i < 35; i++) {
    const r = await page.locator(selector).boundingBox(), box = (await page.locator(scroller).boundingBox())!
    if (r && r.y >= box.y && r.y + r.height <= Math.min(box.y + box.height, 900)) return
    await page.mouse.move(box.x + box.width / 2, Math.max(70, Math.min(800, box.y + box.height / 2)))
    await page.mouse.wheel(0, r && r.y < box.y ? -220 : 220)
    await page.waitForTimeout(60)
  }
  throw new Error('wheel could not expose ' + selector)
}
const leaf = `div:has(> [data-list-surface="explore"][data-list-add="${ID}"]) > button:first-child`
async function defenderLink(page: Page) {
  const j = journey(page)
  await expect(page.locator(READY)).toBeVisible()
  if (!(await page.locator('[aria-label="Reading perspectives"] a[href$="/Defender"]').isVisible())) await j.clickByMouse('.ng-reader-toc-row:has([data-toc-eye="overview"]) a')
  await j.clickByMouse('[aria-label="Reading perspectives"] a[href$="/Defender"]', 'read the defending half')
}

test('@curated sidebar search and perspective links end an already active journey', async ({ page }) => {
  const { j, previous } = await caught(page)
  await explore(page)
  await page.locator('.ng-explorer-search input').fill('Loop Choke')
  await j.clickByMouse(leaf, 'read the search result')
  await calm(page, previous, '/' + ID)
  const next = await snapshot(page)
  await defenderLink(page)
  await calm(page, next)
})

test('@curated Browse category navigation clears a catch before opening the defender page', async ({ page }) => {
  const { j, previous } = await caught(page)
  await explore(page)
  const scroll = '.ng-learning-list'
  await j.clickByMouse('[data-explore-section="Submissions"]', 'expand Submissions')
  await page.locator('button:has(> span:text-is("Loop Choke"))').evaluate(e => e.setAttribute('data-arrival-family', ''))
  const family = '[data-arrival-family]'
  await wheelTo(page, family, scroll)
  await j.clickByMouse(family, 'expand the Loop Choke family')
  await wheelTo(page, leaf, scroll)
  await j.clickByMouse(leaf, 'read the browsed technique')
  await calm(page, previous, '/' + ID)
  await defenderLink(page)
  await calm(page, previous)
})

test('@curated a saved list item starts a fresh journey before its defender link', async ({ page }) => {
  const { j, previous } = await caught(page)
  const list = await page.evaluate(id => {
    const a = (window as any).__neural, list = a.newList('Escape study')
    a.addToList(id + '/Defender', list)
    return list
  }, ID)
  await explore(page)
  // Lists store the technique site, not its role. Follow the real role link after
  // that site arrival, and assert the old catch ended at the first click already.
  if (!(await page.locator(`[data-list-item="${ID}"]`).isVisible())) await j.clickByMouse(`[data-list-open="${list}"]`)
  await j.clickByMouse(`[data-list-item="${ID}"]`, 'read the saved technique')
  await calm(page, previous, '/' + ID + '/Attacker')
  await defenderLink(page)
  await calm(page, previous)
})

test('@curated clicking the caught defender orb manually restages a calm journey', async ({ page }) => {
  const { j, previous } = await caught(page)
  await j.advance(4000)
  const locate = () => page.evaluate(() => {
    const a = (window as any).__neural, n = a.nodes[a.currentPos], r = a.canvas.getBoundingClientRect(), s = a.W / a.cam.vw
    const x = r.left + a.W / 2 + (n.x - a.cam.cx) * s, y = r.top + a.H / 2 + (a._LY(n) - a.cam.cy) * s
    return { x, y, idx: n.idx, split: a._lodK, exposed: document.elementFromPoint(x, y) === a.canvas, cover: document.elementFromPoint(x, y)?.className }
  })
  let hit = await locate()
  // The catch frames all escape destinations; pan the actual map if its node
  // lies behind the reading column. This is a gesture, never a camera assignment.
  for (let i = 0; (!hit.exposed || hit.split < .95) && i < 16; i++) {
    if (hit.exposed) {
      // At catch overview zoom the pair is one site. Zoom into the actual orb
      // until the defender is separately drawn and therefore separately pickable.
      await page.mouse.move(hit.x, hit.y)
      await page.mouse.wheel(0, -400)
      await page.waitForTimeout(70)
    } else {
      // The right gutter is now occupied by the fixed TOC. Find an exposed
      // point in the actual left gutter and a native drag whose endpoints are
      // both canvas, instead of panning toward the former right-side target.
      const drag = await page.evaluate(hit => {
        const a = (window as any).__neural, canvas = a.canvas;
        const edges = [a._reader.articleEl, a._reader.contents, a._landEl, a._landFilmEl]
          .filter(el => el && el.offsetHeight && getComputedStyle(el).visibility !== 'hidden')
          .map(el => el.getBoundingClientRect()).filter(r => r.left > 0 && r.top < 330 && r.bottom > 330);
        const edge = Math.min(a.W / 2, ...edges.map(r => r.left));
        const goal = [edge / 2, edge / 3, edge * .75].find(x => document.elementFromPoint(x, 330) === canvas);
        if (goal == null) return null;
        const dx = Math.max(-180, Math.min(180, goal - hit.x)), dy = Math.max(-100, Math.min(100, 330 - hit.y));
        for (const x of [edge - 20, 20, edge / 2]) for (const y of [120, 220, 400]) {
          if (document.elementFromPoint(x, y) === canvas && document.elementFromPoint(x + dx, y + dy) === canvas) return { x, y, dx, dy };
        }
        return null;
      }, hit)
      expect(drag, 'a native pan has exposed canvas at both ends').toBeTruthy()
      await page.mouse.move(drag!.x, drag!.y)
      await page.mouse.down()
      await page.mouse.move(drag!.x + drag!.dx, drag!.y + drag!.dy, { steps: 8 })
      await page.mouse.up()
    }
    await j.advance(100)
    hit = await locate()
  }
  expect(hit.exposed, JSON.stringify(hit)).toBe(true)
  expect(hit.split).toBeGreaterThanOrEqual(.95)
  await page.mouse.move(hit.x, hit.y)
  expect(await page.evaluate(() => (window as any).__neural._hover?.idx), 'the app hit-tests the drawn defender').toBe(hit.idx)
  await page.mouse.click(hit.x, hit.y)
  await calm(page, previous)
})

test('a list click on the current position also ends its old journey', async ({ page }) => {
  const j = journey(page)
  await j.boot('/Positions/Mount/Top', { beforeNavigate: content })
  await expect(page.locator('[data-land-mc-opt]').first()).toBeVisible()
  const q = await j.landQuestion()
  await j.clickByMouse(`[data-land-mc-opt="${q!.correct}"]`, 'start play with an answer')
  const previous = (await snapshot(page)).journey
  const list = await page.evaluate(() => {
    const a = (window as any).__neural, list = a.newList('Same position')
    a.addToList('Positions/Mount', list); return list
  })
  await explore(page)
  if (!(await page.locator('[data-list-item="Positions/Mount"]').isVisible())) await j.clickByMouse(`[data-list-open="${list}"]`)
  await j.clickByMouse('[data-list-item="Positions/Mount"]', 'restage the current position')
  await expect.poll(async () => (await snapshot(page)).journey).toBeGreaterThan(previous)
  expect(await page.evaluate(() => { const a = (window as any).__neural; return { paused: a.paused, played: a._played } })).toEqual({ paused: true, played: false })
})

test('@curated a shared list link opens its defending item without a catch', async ({ page }) => {
  const j = journey(page)
  await j.boot('/Positions/Mount/Top', { beforeNavigate: content })
  const code = await page.evaluate(id => {
    const a = (window as any).__neural, list = a.newList('Shared escapes')
    a.addToList(id + '/Defender', list)
    return a.listShareCode(list)
  }, ID)
  await j.boot('/?l=' + code, { beforeNavigate: content })
  await expect(page.locator('[data-shared-list]')).toBeVisible()
  // Test mode has no RAF. Give the idle share shell its first frame before a
  // landing records its animation time, just as a visible browser would.
  await j.advance(20)
  const previous = await snapshot(page)
  await j.clickByMouse(`[data-shared-item="${ID}"]`, 'read the shared technique')
  await calm(page, previous, '/' + ID + '/Attacker')
  await defenderLink(page)
  await calm(page, previous)
  expect((await snapshot(page)).caught).toBe(0)
})

test('@curated article links, Back and Forward start fresh journeys after a catch', async ({ page }) => {
  const { j, previous } = await caught(page)
  await expect(page.locator(READY)).toHaveAttribute('data-reader-path', '/' + ID + '/Defender')
  await j.readerLayoutSettled()
  await j.clickByMouse('.ng-reader-toc-row:has([data-toc-eye="overview"]) a', 'read the caught submission article')
  const link = page.locator('[data-reader-body] a[href*="/Positions/"]').first()
  await link.evaluate(e => e.setAttribute('data-arrival-article-link', ''))
  await wheelTo(page, '[data-arrival-article-link]', '[data-reader]')
  const target = new URL((await link.getAttribute('href'))!, page.url()).pathname
  await j.clickByMouse('[data-arrival-article-link]', 'navigate through an authored article link')
  await calm(page, previous, target)
  const after = await snapshot(page)
  await page.goBack()
  await calm(page, after)
  const back = await snapshot(page)
  await page.goForward()
  await calm(page, back, target)
})
