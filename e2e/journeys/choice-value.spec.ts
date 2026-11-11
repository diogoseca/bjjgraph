import { expect, test, type Page } from '@playwright/test'
import { journey } from '../dsl'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

// v1.230.0 reverses v1.218.1 Inspect and v1.220.0 sheet/score layout.
// Value freshness, order, identity and playable-unavailable contracts are retained.
test.beforeAll(async ({ request }) => {
  for (const file of ['neural.js', 'neural.css', 'choice-values.js']) {
    const response = await request.get('/static/neural/app/' + file)
    expect(response.ok()).toBe(true)
    const hash = (data: Buffer) => createHash('sha256').update(data).digest('hex')
    const served = hash(await response.body()), built = hash(readFileSync('neural/dist/' + file))
    expect(served, 'served ' + file + ' must match this checkout\'s fresh bundle').toBe(built)
    console.log('[choice-assets]', file, served)
  }
})

// Controlled consumer journeys: block the native model module, wait for the actual
// import failure, then explicitly install the fresh deferred Choice ESM where needed.
// Real worker/model integration belongs to game-value-live.spec.ts. Dossier content
// is absent in this harness; these tests do not infer authored-content coverage.
const nativeRequests = new WeakMap<Page, { blocked: string[], workers: string[] }>()

test.afterEach(async ({ page }) => {
  const requests = nativeRequests.get(page)
  if (requests) expect(requests.workers, 'controlled consumer must not start the production worker').toEqual([])
})

async function installChoiceRuntime(page: Page) {
  const installed = await page.evaluate(async () => {
    const a = (window as any).__neural
    const url = new URL('/static/neural/app/choice-values.js', document.baseURI).href
    const runtime = await import(url)
    if ((window as any).__neural !== a || a.__ngDestroyed) throw new Error('Choice fixture owner changed during import')
    return a.setChoiceValueRuntime(runtime)
  })
  expect(installed, 'actual deferred Choice module must install').toBe(true)
}

async function ready(page: Page, defense = false, { runtime = true } = {}) {
  const requests = { blocked: [] as string[], workers: [] as string[] }
  nativeRequests.set(page, requests)
  page.on('request', request => {
    if (/\/app\/game-model\.worker\.js(?:\?|$)/.test(request.url())) requests.workers.push(request.url())
  })
  const j = journey(page)
  await j.boot(defense ? '/Submissions/Triangle-Choke/from-Triangle-Control/Defender' : '/', {
    // journey.boot registers a later catch-all route.continue(); install this override
    // after those defaults so the very first native import is actually intercepted.
    beforeNavigate: async page => {
      await page.route(/\/app\/game-values\.js(?:\?|$)/, async route => {
        requests.blocked.push(route.request().url())
        await route.abort('failed')
      })
    },
  })
  if (defense) await j.advance(4000)
  else await j.land('Mount Top')
  await j.decksSettled()
  await expect.poll(() => requests.blocked.length, { message: 'native host module must actually be requested and blocked' }).toBeGreaterThan(0)
  await expect.poll(() => page.evaluate(() => {
    const a = (window as any).__neural
    return { failed: a._gameValueFailed, state: a._gameValueState, loading: !!a._gameValueLoading, live: !!a._gameValueRuntime }
  })).toEqual({ failed: true, state: 'error', loading: false, live: false })
  if (runtime) await installChoiceRuntime(page)
  return j
}

async function installControlledProvider(page: Page, fixedImmediate?: number, wait = true) {
  // The late-runtime test intentionally parks the already-imported ESM in loading/error.
  if (wait) expect(await page.evaluate(() => !!(window as any).__neural.choiceValueRuntime())).toBe(true)
  await page.evaluate((fixedImmediate) => {
    const a = (window as any).__neural
    const pending: any[] = []
    let lastCapture: any, lastKey = ''
    const live = () => JSON.stringify({
      position: a.currentPos, role: a.playerRole, ruleset: a.get('ruleset', 'nogi'),
      cap: a.maxMoves, count: a.moveCount, defense: a._defendSub, panic: a._panicKey,
      prep: a.prep, sharp: a._sharp, qMod: a._qMod, combo: a.combo,
      film: a._filmLook, skill: a.aiSkill, mods: a.userMods,
    })
    a._choiceFixture = { pending, cancellations: [], live }
    a.setChoiceValueSource({
      capture(app: any, options: any[], handId: string) {
        const stamp = live()
        const ids = options.map(o => JSON.stringify([app.nodes[app.currentPos].id, o.node.id,
          o.action || (o.node.ty === 'submissions' ? 'entry' : 'transition'), app.nodes[o.res]?.id || '', o.defense?.label || '']))
        const key = JSON.stringify([stamp, handId, ids])
        if (key === lastKey) return lastCapture
        lastKey = key
        const actions = options.map((o, i) => ({ actionId: ids[i],
          immediateExecutionKind: o.action === 'escape' ? 'escape' : o.action === 'finish' ? 'finish' : o.node.ty === 'submissions' ? 'entry' : 'transition',
          immediateExecutionChance: o.node.ty === 'submissions' && o.action !== 'finish' && o.action !== 'escape' ? 1 : fixedImmediate ?? app.choiceChance(o),
        }))
        return lastCapture = { actions, request: {
          apiVersion: 2, requestId: 'fixture-' + pending.length, revision: pending.length,
          contractHash: stamp, modelHash: 'fixture-model', mechanicsHash: 'fixture-mechanics',
          graphHash: 'fixture-graph', profileHash: JSON.stringify(app.prep || {}), opponentPolicyHash: 'fixture-opponent',
          ruleset: app.get('ruleset', 'nogi'), state: { id: app.nodes[app.currentPos].id, live: stamp, handId },
          horizon: { kind: 'actual-roll', episodeCap: app.maxMoves || 10, moveCount: app.moveCount || 0 },
          objective: 'max-win/min-loss/min-nontermination', futureStudyPolicy: 'no-additional-study-events', requestedActionIds: ids,
        } }
      },
      isCurrent(_app: any, req: any, hand: string) { return req.state.live === live() && req.state.handId === hand },
      evaluate(req: any) { return new Promise((resolve, reject) => pending.push({ req, resolve, reject })) },
      cancel(reason: string) { a._choiceFixture.cancellations.push(reason) },
    })
    a._choiceFixture.resolve = (index: number, values?: number[]) => {
      const { req, resolve } = pending[index]
      const actions = req.requestedActionIds.map((id: string, i: number) => {
        const win = values?.[i] ?? (i === 1 ? .65 : i === 0 ? .35 : .2)
        // an ENTRY's row carries the finish it leads to, as the real adapter's does (`followUp`)
        const kind = JSON.parse(id)[2], follow = fixedImmediate ?? .4
        return { actionId: id, stateId: req.state.id, policyId: 'fixture-policy', status: 'ready',
          outcomes: { win, loss: .1, explicitNoResult: 1 - win - .1, nontermination: 0 },
          ...(kind === 'entry' || kind === 'enter' ? { followUp: { kind: 'finish', chance: follow, explanation: { status: 'ready', chance: follow } } } : {}) }
      })
      const selected = actions[1] || actions[0]
      resolve({ ...req, root: { ...selected, selectedActionId: selected.actionId }, actions,
        quality: { numericalStatus: 'exact-rational', maxWinError: 0, policyRegretBound: 0, coordinateErrorBound: 0,
          actionCoverage: actions.length, supportHash: 'fixture-support', unresolvedReasons: [] } })
    }
  }, fixedImmediate)
  if (wait) await expect.poll(() => page.evaluate(() => (window as any).__neural._choiceFixture.pending.length)).toBe(1)
}

const names = (page: Page) => page.locator('[data-choice-group="you"] [data-tech]').evaluateAll(cards => cards.map(c => c.getAttribute('data-tech')))
// THE ONE STATUS SLOT (v1.257.0, the owner's note on U130, s2): the status line beside "Your moves" and its one press
// ("Sort by win chance" or "Retry"), which replaced the bold "Sort by win chance" / "Retry win chances" buttons. Read
// off the DOM the player sees: its text, the press, and where the line ENDS against the hand's ✕ (and the screen
// edge), with the title's line height. Every state that can be the widest is asserted clear of the ✕ at 390 below:
// "Win chance unavailable · Retry" (the native-failure test), "Calculating win chances…", "Sort by win chance" and
// "Sorted by win chance" (the explicit-sort test). "Updating…" and "Preparing…" are narrower than "Calculating…".
// What changed and what it claimed before: the explicit-sort test pressed the bold button ('[data-choice-value-sort]')
// and now presses the slot's "Sort by win chance"; the re-solve test's "status empty" now also reads the press that
// offers the sort; the native-failure test gains the slot's Retry and the clearance.
// ONE NON-KILL, recorded so nobody reads it as covered: the slot asks ngChoiceValueRanked whether the hand stands in a
// ranking; wiring it back to ngChoiceValueOrder ("the order came back unchanged") changes nothing these journeys can
// see, because the only READY hand with no ranking is a certified value whose interval straddles a display bin, which
// this fixture (exact-rational) cannot produce — a missing card makes the snapshot "partial", which reads "Win chance
// unavailable". The helper itself is pinned by tests/choice_value.test.mjs (null for an ambiguous or partial hand).
const slot = (page: Page) => page.evaluate(() => {
  const t = document.querySelector('[data-choice-group="you"] > div') as HTMLElement
  const st = t.querySelector('[data-choice-value-status]')!, pr = t.querySelector('[data-choice-value-press]') as HTMLElement
  const shown = getComputedStyle(pr).display !== 'none'
  const end = (el: Element) => { const g = document.createRange(); g.selectNodeContents(el); return g.getBoundingClientRect().right }
  const x = (window as any).__neural._handCloseEl, xr = x && x.isConnected && getComputedStyle(x).visibility !== 'hidden' ? x.getBoundingClientRect() : null
  return { status: st.textContent, press: shown ? pr.textContent!.replace('\u00a0·\u00a0', '') : null, act: shown ? pr.getAttribute('data-act') : null,
    end: Math.round(Math.max(end(st), shown ? end(pr) : 0)), limit: Math.round(Math.min(xr && xr.width ? xr.left : innerWidth, innerWidth)), line: t.getBoundingClientRect().height }
})
const clearOfClose = (s: { end: number, limit: number, line: number }) => s.end <= s.limit && s.line === 24
const wins = (page: Page) => page.locator('[data-choice-group="you"] [data-choice-win]').allTextContents()

for (const [width, height] of [[390, 844], [1440, 900]]) {
  test(`@curated native model module failure leaves honest unavailable values and usable choices at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message))
    const j = await ready(page, false, { runtime: false })
    const own = page.locator('[data-choice-group="you"]')
    expect((await wins(page)).length).toBeGreaterThan(1)
    expect((await wins(page)).every(v => v === '—')).toBe(true)
    await expect(own.locator('[data-choice-value-status]')).toHaveText('Win chance unavailable')
    const failed = await slot(page)
    expect([failed.press, failed.act], 'the slot offers Retry after the status, in its own type').toEqual(['Retry', 'retry'])
    await expect(own.locator('[data-choice-value-press]'), 'Retry is named in full').toHaveAccessibleName('Retry win chances')
    expect(clearOfClose(failed), `"Win chance unavailable · Retry" ends clear of the ✕ on one 24px line: ${JSON.stringify(failed)}`).toBe(true)
    await expect(own.locator('[data-choice-read], footer')).toHaveCount(0)
    await page.keyboard.press('Shift+Digit1')
    await expect(page.locator('[data-choice-value-detail], [data-go]')).toHaveCount(0)
    await page.keyboard.press('1')
    await expect(page.locator('[data-executing-tech]')).toHaveCount(1)
    expect(errors).toEqual([])
  })

  test(`@curated async values repaint without moving the focused hand; sorting is explicit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const j = await ready(page)
    await installControlledProvider(page)
    const before = await names(page)
    const first = page.locator('[data-choice-group="you"] [data-choice-execute]').first()
    // STALE CONTRACT (D-318 U4a): on a phone the hand starts below the reader's scroll edge, so
    // focusing a card's control natively scrolls it into view (measured 660 -> 298). The claim is about
    // the async repaint, so the origin is taken after focus, before the values resolve.
    await first.focus()
    const origin = await page.locator('[data-choice-group="you"] [data-tech]').first().boundingBox()
    await expect(page.locator('[data-choice-value-status]')).toHaveText('Calculating win chances…')
    const calculating = await slot(page)
    expect([calculating.press, clearOfClose(calculating)], `"Calculating win chances…" alone in the slot, clear of the ✕: ${JSON.stringify(calculating)}`).toEqual([null, true])
    await page.evaluate(() => (window as any).__neural._choiceFixture.resolve(0))
    await expect.poll(() => wins(page)).toContain('65')
    expect(await names(page)).toEqual(before)
    const settled = await page.locator('[data-choice-group="you"] [data-tech]').first().boundingBox()
    expect(settled?.x).toBeCloseTo(origin!.x, 0)
    expect(settled?.y).toBeCloseTo(origin!.y, 0)
    await expect(first).toBeFocused()
    await expect(page.locator('[data-choice-recommended]').filter({ hasText: 'Recommended' })).toHaveCount(1)
    const rects = await page.locator('[data-choice-group="you"] [data-tech]').evaluateAll(cards => cards.map(card => {
      const r = card.getBoundingClientRect(), win = card.querySelector('[data-choice-win]')!.getBoundingClientRect()
      const bottom = r.bottom
      return { height: r.height, winBottom: win.bottom, bottom, clipped: card.scrollHeight > card.clientHeight + 1, scroll: card.scrollHeight, client: card.clientHeight, children: [...card.children].map(c => ({ tag: c.tagName, cls: c.className, h: c.getBoundingClientRect().height })) }
    }))
    for (const r of rects) { expect(r.height).toBeCloseTo(176, 0); expect(r.winBottom).toBeLessThanOrEqual(r.bottom - 1); expect(r.clipped, JSON.stringify(r)).toBe(false) }
    // the touched hand did not sort itself: the slot offers the sort, quietly, where the status was
    const offered = await slot(page)
    expect([offered.status, offered.press, offered.act], 'a hand touched before its values landed is offered "Sort by win chance"').toEqual(['', 'Sort by win chance', 'sort'])
    expect(clearOfClose(offered), `...clear of the ✕: ${JSON.stringify(offered)}`).toBe(true)
    await expect(page.locator('[data-choice-value-press]')).toHaveAccessibleName('Sort by win chance')
    await j.clickByMouse('[data-choice-value-press]', 'explicit score sorting ("Sort by win chance")')
    expect((await names(page))[0]).toBe(before[1])
    const sorted = await slot(page)
    expect([sorted.status, sorted.press], 'pressed: the slot says the hand is sorted, and offers nothing').toEqual(['Sorted by win chance', null])
    expect(clearOfClose(sorted), `...clear of the ✕: ${JSON.stringify(sorted)}`).toBe(true)
    const next = page.locator('[data-choice-group="you"] [data-choice-execute]').first()
    await expect(next).toBeFocused()
    await expect(next).toHaveAccessibleName(/Win chance 65%/)
    await page.keyboard.press('Shift+Digit1')
    await expect(page.locator('[data-choice-value-detail]')).toHaveCount(0)
    await expect(next).toHaveAccessibleName(/Win chance 65%/)
    await page.keyboard.press('1')
    await expect(page.locator('[data-executing-tech]')).toHaveAttribute('data-executing-tech', /.+/)
  })
}

test('@curated completed MC updates immediate odds, requests one new value snapshot and rejects the pre-grade reply', async ({ page }) => {
  const j = await ready(page)
  const question = await j.landQuestion()
  expect(question).toBeTruthy()
  await j.openQuestion() // U47 d: Answer for Points precedes the answer; keys cannot take an asking question up.
  await installControlledProvider(page)
  const before = await names(page)
  const chance = await page.locator('[data-choice-group="you"] .ngodds').allTextContents()
  await page.keyboard.press('ABC'[question!.correct])
  await j.expectBeat('mc_correct')
  await expect.poll(() => page.evaluate(() => (window as any).__neural._choiceFixture.pending.length)).toBe(2)
  await page.evaluate(() => (window as any).__neural._choiceFixture.resolve(0))
  expect((await wins(page)).every(v => v === '—')).toBe(true)
  expect(await names(page)).toEqual(before)
  expect(await page.locator('[data-choice-group="you"] .ngodds').allTextContents()).not.toEqual(chance)
  await page.evaluate(() => (window as any).__neural._choiceFixture.resolve(1))
  await expect.poll(() => wins(page)).toContain('65')
  // SORT ONCE (owner, 2026-09-29): the first values to arrive on an untouched hand re-order it by
  // Win chance, once; answering the question is not touching the hand. The fixture values the
  // dealt second card 65% and the first 35%, the rest 20% (a tie, so they keep the dealt order).
  expect(await names(page)).toEqual([before[1], before[0], ...before.slice(2)])
})

// THE LAST NUMBER STAYS WHILE THE SAME HAND RE-SOLVES (WINLAT1, 2026-10-05; the owner, on a phone: "the
// probabilities (win chance) take a while to load properly"). After an answer the same hand re-solves;
// each card keeps its last Win chance, dimmed, until the new one lands (`ngChoiceValueUpdating`,
// `choiceValueShown`). A stale number is never CURRENT: it suggests nothing, puts no number on the
// legend and moves no card. A new deal starts from "—". Mutants (WINLAT1), each red at the named line:
//   M-a  ngChoiceValueUpdating returns the pending view   -> "every card keeps its last number";
//   M-b  the stale view copies the previous suggestion    -> the "no suggestion" count;
//   M-c  the [data-choice-stale] CSS rule removed         -> "dimmed: computed opacity".
// ...and it SAYS so (v1.220.0, #267 review), each red at the named line, recorded 2026-10-06:
//   the `[data-choice-stale]::after` ellipsis rule removed -> "a stale number trails an ellipsis";
//   the stale strong's aria-label removed                  -> "a stale number is announced as updating".
// NOT pinned here: the threat card's and the entry's stale aria-labels (this fixture deals no threat
// values and no stale entry number); both are written beside the toggle that dims them.
// NOT a kill, by design: removing the per-hand reset in `_choiceShownMemo` alone stays green, because
// the pairing is keyed by the card OBJECT and a new deal never reuses one; the reset is a second guard.
// "a new deal starts from —" below guards the first one (a pairing by title or position would fail it).
test('@curated a re-solve after an answer keeps each card\'s last Win chance, dimmed, and never treats it as current', async ({ page }) => {
  const j = await ready(page)
  const question = await j.landQuestion()
  expect(question).toBeTruthy()
  await j.openQuestion() // U47 d: Answer for Points before establishing the pre-grade provider snapshot.
  await installControlledProvider(page)
  await page.evaluate(() => (window as any).__neural._choiceFixture.resolve(0))
  await expect.poll(() => wins(page)).toContain('65')
  const sorted = await names(page), shown = await wins(page)
  expect(shown.every(v => /^\d+$/.test(v)), 'the first values are on every card').toBe(true)
  await expect(page.locator('[data-legend-win]')).toHaveAttribute('data-win-chance', /%/)
  await page.keyboard.press('ABC'[question!.correct])
  await j.expectBeat('mc_correct')
  await expect.poll(() => page.evaluate(() => (window as any).__neural._choiceFixture.pending.length)).toBe(2)
  const stale = page.locator('[data-choice-group="you"] [data-choice-win][data-choice-stale]')
  expect(await wins(page), 'every card keeps its last number while the same hand re-solves').toEqual(shown)
  await expect(stale).toHaveCount(shown.length)
  await expect(page.locator('[data-choice-value-status]')).toHaveText('Updating win chances…')
  const opacity = await stale.first().evaluate(el => +getComputedStyle(el).opacity)
  expect(opacity, 'dimmed: computed opacity of a stale number').toBeLessThan(0.7)
  // ...AND IT SAYS SO (v1.220.0, #267 review: "dimming alone is easy to miss on a phone or under Dark
  // Reader"): it reads "52%…" and its aria-label is "Win chance 52%, updating".
  const cue = await stale.first().evaluate(el => ({ after: getComputedStyle(el, '::after').content, aria: el.getAttribute('aria-label'), text: el.textContent }))
  expect(cue.after, 'a stale number trails an ellipsis ("52%…")').toBe('"\u2026"')
  expect(cue.aria, 'a stale number is announced as updating').toBe(`Win ${cue.text}%, updating`)
  // a stale number is not current: no suggestion, no number on the legend, no card moved
  await expect(page.locator('[data-choice-group="you"] [data-choice-recommended]').filter({ hasText: /\S/ })).toHaveCount(0)
  expect(await page.locator('[data-legend-win]').getAttribute('data-win-chance'), 'a stale number is not current (legend)').toBeNull()
  expect(await names(page)).toEqual(sorted)
  // the new values land undimmed; the hand already sorted once, so a new best does not move a card
  const n = shown.length
  await page.evaluate((n) => (window as any).__neural._choiceFixture.resolve(1, [.8, ...Array(n - 1).fill(.1)]), n)
  await expect.poll(() => wins(page)).toContain('80')
  await expect(stale).toHaveCount(0)
  const fresh = await page.locator('[data-choice-group="you"] [data-choice-win]').first().evaluate(el => ({ after: getComputedStyle(el, '::after').content, aria: el.getAttribute('aria-label') }))
  expect(fresh.after, 'a current number has no ellipsis').toBe('none')
  expect(fresh.aria).not.toContain('updating')
  await expect(page.locator('[data-choice-value-status]')).toHaveText('')
  // ...and the new best is OFFERED, not applied: the slot reads "Sort by win chance" (v1.257.0; before, the bold button)
  expect([(await slot(page)).press, (await slot(page)).act], 'a re-solve that changes the best offers the sort, it never applies it').toEqual(['Sort by win chance', 'sort'])
  expect(await names(page)).toEqual(sorted)
  // a new deal has no previous numbers: it starts from "—"
  await page.keyboard.press('1')
  await j.nextHand()
  await expect.poll(() => page.evaluate(() => (window as any).__neural._choiceFixture.pending.length)).toBeGreaterThan(2)
  expect((await wins(page)).every(v => v === '—'), 'a new deal starts from —').toBe(true)
  await expect(stale).toHaveCount(0)
})

// A PRESS ON THE TITLE IS NOT A REACH INTO THE HAND (v1.257.0, hidetoggle round 2's finding). The word and the
// slot's press sit in the title row inside the tray, whose pointerdown/key/focus latch "touched" and stop the hand
// sorting itself when its values land. Before, two presses on the switch (Hidden, then Shown) before the values landed
// left the hand in dealt order. The control is the explicit-sort test above: a FOCUSED card still freezes the hand.
test('@curated a press on the word before the values land does not stop the hand sorting itself', async ({ page }) => {
  const j = await ready(page)
  await installControlledProvider(page)
  const before = await names(page)
  await j.clickByMouse('[data-hide-switch]', 'the word (to Hidden)')
  await j.clickByMouse('[data-hide-switch]', 'the word (back to Shown)')
  expect(await page.evaluate(() => (window as any).__neural._handTouched), 'two presses on the title, and the hand is not touched').toBe(false)
  const pending = await page.evaluate(() => (window as any).__neural._choiceFixture.pending.length)
  await page.evaluate((i) => (window as any).__neural._choiceFixture.resolve(i), pending - 1)
  await expect.poll(() => wins(page)).toContain('65')
  await expect.poll(() => names(page), { message: 'the hand sorted itself: the 65% card first' }).not.toEqual(before)
  const s = await slot(page)
  expect([s.status, s.press], 'and the slot says so').toEqual(['Sorted by win chance', null])
})

for (const mutate of ['role', 'ruleset', 'clock', 'profile']) {
  test(`@curated ${mutate} changed before refresh makes an old result inert`, async ({ page }) => {
    await ready(page); await installControlledProvider(page)
    await page.evaluate((kind) => {
      const a = (window as any).__neural
      if (kind === 'role') a.playerRole = a.playerRole === 'top' ? 'bottom' : 'top'
      if (kind === 'ruleset') a.settings.ruleset = a.get('ruleset', 'nogi') === 'gi' ? 'nogi' : 'gi'
      if (kind === 'clock') a.moveCount++
      if (kind === 'profile') a.prep = { 'different-player|Defender': 4 }
      a._choiceFixture.resolve(0)
    }, mutate)
    expect((await wins(page)).every(v => v === '—')).toBe(true)
    await expect(page.locator('[data-choice-value-status]')).toHaveText('Calculating win chances…')
  })
}

for (const width of [390, 1440]) {
  test(`@curated defender card preserves its own odds and escape identity at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const j = await ready(page, true)
    await installControlledProvider(page)
    const labels = await names(page)
    await page.evaluate(() => (window as any).__neural._choiceFixture.resolve(0))
    await expect.poll(() => wins(page)).toContain('65')
    // Both escapes carry the SAME data-tech (one technique, two defenses), so identity is the
    // card's title. The hand sorted itself once: the fixture's 65% escape (dealt second) leads.
    const tray = await page.locator('[data-choice-group="you"] .ngchoice-title').allTextContents()
    expect(tray.map(t => t.trim()), 'sorted once: the 65% escape first').toEqual(['Stack escape', 'Posture up'])
    const chosen = page.locator('[data-choice-group="you"] [data-tech]').first()
    await expect(chosen.locator('[data-choice-read]')).toHaveCount(0)
    await page.keyboard.press('Shift+Digit1')
    await expect(page.locator('[data-choice-preview]')).toHaveCount(0)
    expect(await names(page)).toEqual(labels)
    await j.rig('escape', [0])
    await chosen.locator('.ng-choice-title-button').scrollIntoViewIfNeeded()
    await j.clickByMouse('[data-choice-group="you"] [data-tech]:first-child .ng-choice-title-button', 'choose the identified escape')
    await j.advance(4000)
    // Stack escape's authored destination; Posture up would have landed in open-guard.
    expect(await page.evaluate(() => (window as any).__neural.nodes[(window as any).__neural.currentPos].posId)).toBe('half-guard')
  })
}

test('@curated committing while scoring retires the worker; a late reply cannot alter selected-card status', async ({ page }) => {
  const j = await ready(page)
  await installControlledProvider(page)
  await page.keyboard.press('1')
  const card = page.locator('[data-executing-tech]')
  await expect(card.locator('.ngchoice-title')).not.toBeEmpty()
  await expect(card.locator('[data-cat]')).toHaveText(/Executing|Entering/)
  await expect(card.locator('button')).toHaveCount(0)
  const before = await card.textContent()
  await page.evaluate(() => (window as any).__neural._choiceFixture.resolve(0))
  await expect(card).toHaveText(before!)
  await expect(page.locator('[data-choice-group="you"]')).toHaveCount(0)
  expect(await page.evaluate(() => (window as any).__neural._choiceFixture.cancellations)).toContain('hand-ended')
  await j.advance(200)
})

for (const defense of [false, true]) {
  test(`@curated unchanged refresh preserves Works and tiny immediate values; defense ${defense}`, async ({ page }) => {
    await ready(page, defense)
    await installControlledProvider(page, .001)
    await page.evaluate(() => (window as any).__neural._choiceFixture.resolve(0))
    await expect.poll(() => wins(page)).toContain('65')
    const own = page.locator('[data-choice-group="you"]')
    const before = await own.locator('.ngodds').allTextContents()
    expect(before).toContain('<1')
    if (!defense) {
      // an entry prints the finish it leads to ("Works"), never its certain step (v1.213.0)
      const entry = own.locator('[data-tech]').filter({ has: page.locator('[data-immediate-label]', { hasText: 'Works' }) })
      expect(await entry.count()).toBeGreaterThan(0)
      for (const p of await entry.locator('.ngodds').allTextContents()) expect(p).toBe('<1')
    }
    await page.evaluate(() => {
      const a = (window as any).__neural
      a.refreshOptionOdds(); a.refreshEscapeOdds(); a.refreshChoiceValues()
    })
    await expect.poll(() => own.locator('.ngodds').allTextContents()).toEqual(before)
    // Mutant, recorded 2026-09-29: capturing in TRAY order (before v1.207.7) turns this red — the
    // sort-once reordered the tray, so an unchanged refresh re-solved the hand (2 requests). Re-run
    // 2026-10-01 (v1.213.0): still red, both defense cases. An entry printing its own step instead
    // of its follow-up (`ngChoiceValueImmediate`) turns the "Works <1%" line red.
    expect(await page.evaluate(() => (window as any).__neural._choiceFixture.pending.length)).toBe(1)
    const label0 = (await own.locator('[data-immediate-label]').first().textContent())!.trim()
    await page.keyboard.press('Shift+Digit1')
    await expect(page.locator('[data-choice-value-detail]')).toHaveCount(0)
    await expect(own.locator('[data-immediate-label]').first()).toHaveText(label0)
    expect(await own.locator('.ngodds').allTextContents()).toEqual(before)
  })
}

test('@curated a failed calculation explains the error while keeping the move executable', async ({ page }) => {
  await ready(page); await installControlledProvider(page)
  await page.evaluate(() => (window as any).__neural._choiceFixture.pending[0].reject(new Error('test worker failure')))
  await expect(page.locator('[data-choice-value-status]')).toHaveText('Win chance unavailable')
  expect((await wins(page)).every(v => v === '—')).toBe(true)
  await page.keyboard.press('Shift+Digit1')
  await expect(page.locator('[data-choice-value-detail]')).toHaveCount(0)
  await expect(page.locator('[data-choice-execute]').first()).toBeEnabled()
  await page.keyboard.press('1')
  await expect(page.locator('[data-executing-tech] .ngchoice-title')).not.toBeEmpty()
})

test('@curated late runtime survives load failure, retries and replacement without moving the hand', async ({ page }) => {
  const j = await ready(page), before = await names(page)
  await page.evaluate(() => {
    const a = (window as any).__neural
    a._fixtureRuntime = a.choiceValueRuntime()
    a.setChoiceValueRuntime(null, 'loading')
  })
  await installControlledProvider(page, undefined, false)
  await expect(page.locator('[data-choice-value-status]')).toHaveText('Preparing win chances…')
  expect(await page.evaluate(() => (window as any).__neural._choiceFixture.pending.length)).toBe(0)
  await page.keyboard.press('Shift+Digit1')
  await expect(page.locator('[data-choice-value-detail], [data-go]')).toHaveCount(0)
  await page.locator('[data-choice-execute]').first().focus() // freeze the hand while the runtime retries
  await page.evaluate(() => (window as any).__neural.setChoiceValueRuntime(null, 'error'))
  await expect(page.locator('[data-choice-value-status]')).toHaveText('Win chance unavailable')
  expect(await names(page)).toEqual(before)
  await expect(page.locator('[data-choice-group="you"] [data-choice-execute]').first()).toBeEnabled()
  await page.evaluate(() => { const a = (window as any).__neural; a.setChoiceValueRuntime(a._fixtureRuntime) })
  await expect.poll(() => page.evaluate(() => (window as any).__neural._choiceFixture.pending.length)).toBe(1)
  await page.evaluate(() => (window as any).__neural._choiceFixture.resolve(0))
  await expect.poll(() => wins(page)).toContain('65')
  expect(await names(page)).toEqual(before)
  await page.evaluate(() => { const a = (window as any).__neural; a.prep = { 'different-profile|Top': 1 }; a.refreshChoiceValues() })
  await expect.poll(() => page.evaluate(() => (window as any).__neural._choiceFixture.pending.length)).toBe(2)
  await page.evaluate(() => { const a = (window as any).__neural; a.setChoiceValueRuntime(a._fixtureRuntime) })
  await expect.poll(() => page.evaluate(() => (window as any).__neural._choiceFixture.pending.length)).toBe(3)
  await page.evaluate(() => (window as any).__neural._choiceFixture.resolve(1))
  // The retired runtime's reply is inert. Since WINLAT1 the same hand keeps its last numbers, DIMMED,
  // while it re-solves, so "inert" reads as: no card shows a CURRENT number, and the tray is updating.
  // Accepting that reply would make its (identical-looking) values current and turn this red.
  await expect(page.locator('[data-choice-group="you"] [data-choice-win]:not([data-choice-stale])')).toHaveCount(0)
  await expect(page.locator('[data-choice-value-status]')).toHaveText('Updating win chances…')
  await page.evaluate(() => (window as any).__neural._choiceFixture.resolve(2))
  await expect.poll(() => wins(page)).toContain('65')
  expect(await names(page)).toEqual(before)
  await j.advance(100)
})

test('@curated unmount makes a late runtime and its old solve inert', async ({ page }) => {
  await ready(page); await installControlledProvider(page)
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message))
  const after = await page.evaluate(async () => {
    const a = (window as any).__neural, runtime = a.choiceValueRuntime()
    a.destroy()
    a._choiceFixture.resolve(0)
    const installed = a.setChoiceValueRuntime(runtime)
    await Promise.resolve(); await Promise.resolve()
    return { installed, snapshot: a._choiceValues.snapshot(), token: a._choiceValueToken }
  })
  expect(after).toEqual({ installed: false, snapshot: null, token: null })
  expect(errors).toEqual([])
})

test.describe('touch choice controls', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } })
  test('@curated touch the empty media region commits its move and preserves an inert status card', async ({ page }) => {
    const j = await ready(page)
    const card = page.locator('[data-choice-group="you"] [data-tech]').first()
    const name = await card.locator('.ngchoice-title').textContent()
    await card.scrollIntoViewIfNeeded()
    const inspect = card.locator('[data-choice-media]')
    const p = await inspect.evaluate(el => {
      const r = el.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2
      return { x, y, hit: el.contains(document.elementFromPoint(x, y)) }
    })
    expect(p.hit).toBe(true)
    await page.touchscreen.tap(p.x, p.y)
    await expect(page.locator('[data-executing-tech] .ngchoice-title')).toHaveText(name!)
    await expect(page.locator('[data-executing-tech] button')).toHaveCount(0)
    await j.advance(100)
  })
})


test('@curated Enter on the focused card commits its move; choice groups remain separate', async ({ page }) => {
  await ready(page)
  const card = page.locator('[data-choice-group="you"] [data-tech]').first()
  const name = await card.locator('.ngchoice-title').textContent()
  const before = await page.evaluate(() => ((window as any).__neural.beats || []).filter((b: any) => b.beat === 'commit').length)
  const groups = await page.locator('[data-choice-group]').evaluateAll(groups => groups.map(g => ({ left: g.getBoundingClientRect().left, right: g.getBoundingClientRect().right })))
  expect(groups.length).toBeGreaterThan(1)
  expect(groups[0].right).toBeLessThanOrEqual(groups[1].left)
  await card.locator('[data-choice-execute]').focus()
  await page.keyboard.press('Enter')
  expect(await page.evaluate(() => ((window as any).__neural.beats || []).filter((b: any) => b.beat === 'commit').length)).toBe(before + 1)
  await expect(page.locator('[data-executing-tech] .ngchoice-title')).toHaveText(name!)
})
