import { test, expect, type Page } from "@playwright/test"
import { journey } from "../dsl"

// v1.227.0: owner 2026-10-15 supersedes v1.134.0; a dormant defender
// answer/escape starts play without inventing an opponent catch. OWNERQ1 + D-297a. All activations use real mouse coordinates. Content and
// safety oracles come from the served build; the unauthored case is labelled.
// MDP sandbox controls (2026-10-14), with emitted-byte differences checked:
// m25 adds a Practice gate: 4 failures, including both real answers staying paused.
// m26 includes attacker context: 3 failures (two built roles and the missing guide).
// m27 truncates safety: exact complete-guide equality fails.
// m28 breaks the spacing ratio: 6 instead of 4 at both widths.
// m29 inverts heading size/color (compound): 14px is below its 18px subheading.
// m30 removes abort + serial checks (compound): late Bottom replaces Top.
// m31 restores game-first: the immediate complete reader is absent at both widths.
// m32 removes engagement/tick/clock guards (compound): hovering produces a miss.
// The old m35 expected pressure after the first action. v1.227.0 reverses that
// expectation; defending-landing.spec.ts M1 pins an answer inventing pressure.
// m36b removes Inspect Go's beginPlay: both choice-value escape journeys stay at
// Triangle Control instead of Half Guard. m36's earlier asset-cwd failure is invalid.
// m39 removes narrow-band fitting: the drawn caption reaches 122.6px; videos start at 98px.
// CI298 correction controls: m45 restores the Practice gate (four reds); m46
// removes pair fitting and fails the same film clearance across merged/split labels.
// m54_nan_role_baseline makes the required role coordinate NaN: it must fail by
// name before the clearance calculation, never disappear from its measurements.
// These controls assert UI/state contracts, not external video playback or the
// accuracy of authored safety advice. The renderer must preserve that advice.
const READY = '[data-reader][data-reader-ready="true"]'
const KNEE = '/Transitions/Knee-Slice-Pass'
const RNC = '/Submissions/Rear-Naked-Choke/from-Back-Control'
const FOCUS = { v: 2, settings: { readingFocus: true, readingFilm: false, readingCard: false, readingHand: false, readingMap: false, readingFeedback: false }, settingsAt: {} }
const activity = (page: Page) => page.evaluate(() => {
  const a = (window as any).__neural
  return { intent: !!a._readerIntent, paused: a.paused, played: !!a._played,
    current: a.nodes[a.focusIdx]?.id, seat: a.playerRole, remaining: a._decision?.remaining ?? null,
    moves: a.moveCount || 0, active: a.activeMove ?? null,
    beats: a.beats.filter((b: any) => ['options_dealt', 'engaged', 'commit', 'defend_start', 'land_q_expired', 'land_q_answered'].includes(b.beat)).map((b: any) => b.beat) }
})

test('@curated a short desktop arrival keeps the node title clear of real built videos', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  const j = journey(page)
  await j.boot(KNEE, { beforeNavigate: async () => {
    // The usual DSL empties dossiers. Let the real published clips claim space.
    await page.route('**/static/neural/content/*.json', route => route.continue())
  } })
  await expect(page.locator(READY)).toBeVisible()
  await expect.poll(() => page.locator('.ng-landfilm .ng-clip').count()).toBeGreaterThan(1)
  await j.landQuestion()
  await j.advance(6000)
  const frame = await page.evaluate(() => {
    const a = (window as any).__neural, pair = a._lastPairLabel, rich = a._lastRichLabel
    // Fitting the real video stack can merge the pair. Measure whichever naming
    // design THIS frame drew, including its role and optional qualifier baselines.
    const label = pair ? { idx: pair.idx, main: pair.main, role: pair.sub, focused: pair.focused, titleY: pair.nameY, roleY: pair.subY, qualifier: pair.qual, qualY: pair.qualY }
      : rich ? { idx: rich.idx, main: rich.name, role: rich.kicker, focused: rich.big, titleY: rich.nameY, roleY: rich.roleY, qualifier: rich.qual, qualY: rich.qualY } : null
    const film = a._landFilmEl.getBoundingClientRect()
    return { label, focus: a.focusIdx, filmTop: film.top, reader: a._readerEl.getBoundingClientRect().height }
  })
  expect(frame.label?.main, 'the frame really drew the selected node').toBe('Knee Slice Pass')
  expect(frame.label!.idx).toBe(frame.focus)
  expect(frame.label!.focused).toBe(true)
  expect(frame.label!.role).toBeTruthy()
  expect(frame.reader, 'the article still has a readable preview').toBeGreaterThanOrEqual(50)
  expect(Number.isFinite(frame.label!.titleY), 'the required title baseline is finite').toBe(true)
  expect(Number.isFinite(frame.label!.roleY), 'the required role baseline is finite').toBe(true)
  const baselines = [frame.label!.titleY, frame.label!.roleY]
  // The renderer publishes null only when there is no qualifier. A present word
  // with a missing coordinate, or a non-null invalid coordinate, must fail too.
  if (frame.label!.qualifier || frame.label!.qualY !== null) {
    expect(Number.isFinite(frame.label!.qualY), 'the present qualifier baseline is finite').toBe(true)
    baselines.push(frame.label!.qualY)
  }
  expect(Math.max(...baselines) + 5, 'the drawn title, seat and qualifier stay above the real videos').toBeLessThan(frame.filmTop - 2)
  expect(await activity(page)).toMatchObject({ intent: true, paused: true, played: false, remaining: null, beats: [] })
})

for (const width of [1366, 390]) {
  test(`@curated ${width}px reading-first arrival is dormant until a real outcome click`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
    const j = journey(page)
    await j.boot('/Positions/Mount/Top')
    await expect(page.locator(READY)).toBeVisible()
    await j.landQuestion()
    await j.advance(5000)
    const before = await activity(page)
    expect(before).toMatchObject({ intent: true, paused: true, played: false, current: 'Positions/Mount', seat: 'top', remaining: null, moves: 0, active: null, beats: [] })
    await expect(page.locator('[data-reader-body]')).toContainText('Training')
    await expect(page.locator('[data-land-q]')).toBeVisible()
    await expect(page.locator('[data-reader-practice],[data-reader-practice-offer]')).toHaveCount(0)
    await page.mouse.move(width / 2, 100)
    await j.advance(20000)
    expect(await activity(page), 'arrival and hover never start a question clock or hand activity').toEqual(before)
    await page.evaluate(() => { const a = (window as any).__neural; a._optionCards.find((c: any) => !c.opt.threat).card.setAttribute('data-reading-choice', '') })
    await j.clickByMouse('[data-reading-choice]', 'choose a real outcome without a Practice gate')
    await expect.poll(async () => (await activity(page)).intent).toBe(false)
    await j.advance(100)
    expect((await activity(page)).paused).toBe(false)
    await expect(page.locator('[data-executing-tech]')).toBeVisible()
  })

  test(`@curated ${width}px a real landing-card answer starts the dormant game once`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
    const j = journey(page)
    await j.boot('/Positions/Mount/Top')
    await expect(page.locator(READY)).toBeVisible()
    const q = await j.landQuestion()
    expect(q).not.toBeNull()
    await j.advance(20000)
    expect(await activity(page)).toMatchObject({ intent: true, paused: true, remaining: null, played: false, beats: [] })
    await j.clickByMouse(`[data-land-mc-opt="${q!.correct}"]`, 'answer the dormant landing card')
    expect(await activity(page)).toMatchObject({ intent: false, paused: false, remaining: null })
    await j.advance(20000)
    const after = await activity(page)
    expect(after.played).toBe(true)
    expect(after.beats.filter((b: string) => b === 'land_q_answered')).toHaveLength(1)
    expect(after.beats).not.toContain('land_q_expired')
  })
}

test('@curated reading gestures, minimizing and article navigation never start play', async ({ page }) => {
  const j = journey(page)
  await j.boot(KNEE)
  await expect(page.locator(READY)).toBeVisible()
  await j.advance(5000)
  const p = page.locator('[data-reader-article="hub"] [data-source-id="overview"] > p').first()
  await p.scrollIntoViewIfNeeded()
  const r = await p.boundingBox()
  await page.mouse.move(r!.x + 2, r!.y + 12)
  await page.mouse.down()
  await page.mouse.move(r!.x + 85, r!.y + 12, { steps: 12 })
  await page.mouse.up()
  expect(await page.evaluate(() => getSelection()?.toString().length || 0)).toBeGreaterThan(0)
  const box = await page.locator(READY).boundingBox()
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height - 18)
  await page.mouse.wheel(0, 500)
  await expect.poll(() => page.locator(READY).evaluate(e => e.scrollTop)).toBeGreaterThan(0)
  for (const part of ['book', 'card', 'hand', 'map', 'feedback']) {
    await j.clickByMouse(`[data-layer-hide="${part}"]`)
    await j.clickByMouse(`[data-layer-show="${part}"]`)
  }
  await j.advance(20000)
  expect(await activity(page)).toMatchObject({ intent: true, paused: true, played: false, remaining: null, beats: [] })
  await page.locator('[data-reading-focus]').scrollIntoViewIfNeeded()
  await j.clickByMouse('[data-reading-focus]')
  const link = page.locator('[data-reader-body] a[href*="/Positions/"]').first()
  await link.scrollIntoViewIfNeeded()
  await link.evaluate(e => e.setAttribute('data-reading-next', ''))
  const path = new URL(await link.getAttribute('href')!, page.url()).pathname
  await j.clickByMouse('[data-reading-next]')
  await expect(page.locator(READY)).toHaveAttribute('data-reader-path', decodeURI(path))
  await j.advance(20000)
  expect(await activity(page)).toMatchObject({ intent: true, paused: true, played: false, remaining: null, beats: [] })
})

for (const path of [KNEE, RNC]) {
  test(`@curated defender reading excludes attacker rules and preserves real safety: ${path}`, async ({ page }) => {
    const j = journey(page)
    await j.boot(path + '/Defender', { initialState: FOCUS })
    await expect(page.locator(READY)).toBeVisible()
    await j.advance(20000)
    const proof = await page.evaluate(async path => {
      const norm = (s: string | null) => (s || '').replace(/\s+/g, ' ').trim()
      const load = async (p: string) => { const r = await fetch(p); if (r.status !== 200) throw new Error(p + ': ' + r.status); return new DOMParser().parseFromString(await r.text(), 'text/html') }
      const hub = await load(path), defender = await load(path + '/Defender')
      const guide = norm(defender.querySelector('article')!.textContent)
      const attackerOnly = [...hub.querySelectorAll('#attacker-summary li')].map(n => norm(n.textContent)).filter(s => s.length > 30 && !guide.includes(s))
      const reader = norm(document.querySelector('[data-reader-body]')!.textContent)
      const safety = hub.querySelector('#safety-considerations')
      return { attackerOnly, leaked: attackerOnly.filter(s => reader.includes(s)),
        safety: safety ? norm(safety.textContent) : null,
        shownSafety: norm(document.querySelector('[data-reader-article="hub"] [data-source-id="safety-considerations"]')?.textContent || ''),
        rows: safety?.querySelectorAll('li,td').length || 0,
        sourceGuide: [...defender.querySelectorAll('article p,article li')].map(n => norm(n.textContent)).filter(s => s.length > 40), reader }
    }, path)
    expect(proof.attackerOnly.length, 'the built hub has actual attacker-only rules to exclude').toBeGreaterThan(2)
    expect(proof.leaked, 'no attacker steps, principles or counters in defender reading').toEqual([])
    for (const prose of proof.sourceGuide) expect(proof.reader).toContain(prose)
    if (path === RNC) {
      expect(proof.rows, 'the full authored safety guide is nonempty').toBeGreaterThan(20)
      expect(proof.shownSafety, 'every risk, speed, tap, release and restriction survives').toBe(proof.safety)
    }
    expect(await activity(page)).toMatchObject({ intent: true, paused: true, played: false, remaining: null, beats: [] })
  })
}

test('@curated an unauthored defender never falls back to the attacker hub', async ({ page }) => {
  const j = journey(page)
  // Explicit missing-author fixture; the hub remains the real built attacker-rich page.
  await j.boot(KNEE, { initialState: FOCUS, beforeNavigate: async () => {
    await page.route('**/Transitions/Knee-Slice-Pass/Defender', route => route.fulfill({ contentType: 'text/html', body: '<h1>Defender</h1><article><p>This defender guide has not been authored.</p></article>' }))
  } })
  await expect(page.locator(READY)).toBeVisible()
  await j.clickByMouse('[aria-label="Reading perspectives"] a[href$="/Defender"]')
  await expect(page.locator(READY)).toHaveAttribute('data-reader-path', KNEE + '/Defender')
  await expect(page.locator('[data-reader-body]')).toHaveText(/This defender guide has not been authored/)
  await expect(page.locator('[data-reader-body]')).not.toContainText(/Execution Steps|Playing as Attacker|Possible Outcomes/)
  await expect(page.locator('[data-landcard=defense]')).toHaveCount(0)
})

for (const width of [1366, 390]) {
  test(`@curated ${width}px reader rhythm scales as a ratio and headings keep their hierarchy`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const j = journey(page)
    await j.boot(RNC + '/Defender', { initialState: FOCUS })
    await expect(page.locator(READY)).toBeVisible()
    const sample = () => page.locator('[data-reader-article="guide"] [data-source-id="key-principles"]').evaluate(section => {
      const px = (e: Element, p: string) => parseFloat((getComputedStyle(e) as any)[p])
      const lum = (e: Element) => { const [r,g,b] = getComputedStyle(e).color.match(/\d+/g)!.slice(0,3).map(s => { const x = +s / 255; return x <= .03928 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4 }); return .2126*r + .7152*g + .0722*b }
      const list = section.querySelector('ul')!, card = section.closest('.ng-section-card')!, head = card.querySelector('[data-section-toggle]')!, prose = list.querySelector('li')!
      const sub = document.querySelector('[data-reader-article="guide"] [data-source-id="defensive-options"] h3')!
      return { gap: card.nextElementSibling!.getBoundingClientRect().top - card.getBoundingClientRect().bottom,
        item: px(list, 'rowGap'), unit: parseFloat(getComputedStyle(section.closest('[data-reader]')!).getPropertyValue('--reader-unit')),
        head: px(head, 'fontSize'), sub: px(sub, 'fontSize'), prose: px(prose, 'fontSize'), headLum: lum(head), bodyLum: lum(prose) }
    })
    const normal = await sample()
    expect(normal.gap).toBe(6)
    expect(normal.item / normal.unit).toBe(.5)
    expect(normal.head).toBeGreaterThan(normal.sub)
    expect(normal.sub).toBeGreaterThan(normal.prose)
    expect(normal.headLum).toBeGreaterThan(normal.bodyLum)
    await page.locator(READY).evaluate(e => (e as HTMLElement).style.setProperty('--reader-unit', '18px'))
    const scaled = await sample()
    expect(scaled.gap, 'section spacing retains the approved independent 6px token').toBe(6)
    expect(scaled.item / scaled.unit).toBe(.5)
    expect(scaled.item).not.toBe(normal.item)
  })
}

test('@curated a late response cannot repaint the opposite seat in the same reader', async ({ page }) => {
  const j = journey(page)
  await j.boot('/Positions/Mount', { initialState: FOCUS })
  await expect(page.locator(READY)).toBeVisible()
  await page.evaluate(() => { (window as any).__seatReader = (window as any).__neural._reader })
  let release!: () => void, requested = false, settled = false
  const held = new Promise<void>(resolve => { release = resolve })
  const settle = (r: { url(): string }) => { if (new URL(r.url()).pathname === '/Positions/Mount/Bottom') settled = true }
  page.on('requestfinished', settle); page.on('requestfailed', settle)
  await page.route('**/Positions/Mount/Bottom', async route => { requested = true; await held; await route.continue().catch(() => {}) })
  await j.clickByMouse('[aria-label="Reading perspectives"] a[href$="/Bottom"]')
  await expect.poll(() => requested).toBe(true)
  await j.clickByMouse('.ng-logo')
  await j.clickByMouse('[data-view="explore"]')
  await page.locator('.ng-explorer-search input').fill('Mount')
  await page.waitForTimeout(450) // the pane's CSS slide must settle before a coordinate click
  await j.clickByMouse('div:has(> [data-list-surface="explore"][data-list-add="Positions/Mount"]) > button:first-child')
  await expect(page.locator(READY)).toHaveAttribute('data-reader-path', '/Positions/Mount')
  release()
  await expect.poll(() => settled).toBe(true)
  await page.waitForTimeout(100)
  expect(await page.evaluate(() => (window as any).__seatReader === (window as any).__neural._reader)).toBe(true)
  expect(await page.locator('[data-reader-article="guide"]').evaluateAll(es => [...new Set(es.map(e => e.getAttribute("data-source-path")))])).toEqual(['/Positions/Mount/Top'])
  const toc = await page.locator('[data-section-link]').evaluateAll(nodes => nodes.map(e => e.textContent))
  expect(toc).not.toContain('Key Defensive Principles')
})

for (const path of [RNC, '/Submissions/Triangle-Choke/from-Triangle-Control']) {
  for (const action of ['escape', 'answer']) {
    test(`@curated dormant defender ${action} starts play directly: ${path}`, async ({ page }) => {
      const j = journey(page)
      await j.boot(path + '/Defender')
      await expect(page.locator(READY)).toBeVisible()
      await expect.poll(() => page.evaluate(() => ((window as any).__neural._optionCards || []).filter((c: any) => c.opt.action === 'escape').length)).toBeGreaterThan(0)
      await expect(page.locator('[data-panic-mc-opt]').first()).toBeVisible()
      await j.advance(20000)
      expect(await activity(page)).toMatchObject({ intent: true, paused: true, played: false, remaining: null, beats: [] })
      await expect(page.locator('[data-land-clock-track]')).toBeHidden()
      if (action === 'escape') {
        await page.evaluate(() => (window as any).__neural._optionCards.find((c: any) => c.opt.action === 'escape').card.setAttribute('data-reading-escape', ''))
        await j.clickByMouse('[data-reading-escape]', 'choose a dormant escape')
        await expect(page.locator('[data-executing-tech]')).toBeVisible()
      } else {
        const correct = await page.evaluate(() => (window as any).__neural._mc.correct)
        await j.clickByMouse(`[data-panic-mc-opt="${correct}"]`, 'answer the dormant defender question')
      }
      expect(await activity(page)).toMatchObject({ intent: false, paused: false })
      expect((await activity(page)).beats.filter((b: string) => b === 'defend_start')).toHaveLength(0)
    })
  }
}
