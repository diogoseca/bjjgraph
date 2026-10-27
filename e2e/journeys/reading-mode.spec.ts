import { test, expect, type Page } from "@playwright/test"
import { journey } from "../dsl"

// STALE TIMING — reading-back-race.md (fixbots, 2026-10-15): the unchanged
// Back case failed 3/20 on dc72b958c, before escape, and 0/20 on f006d73b8.
// Quartz remounts the app after the outgoing cached reader publishes its path;
// the old path check and the next global state read could name different apps.
// Holding HTML, then the new graph, reproduced it on both heads; all 6 traced
// cases converged after the replacement reader became ready.
// Observe real nav + replacement-reader publication, then assert that SAME
// instance's state once. Intent and pause are never readiness predicates.
// D-318 U6a replaces the perspective link with a native tap on the other half;
// content, Back ordering, replacement identity and stopped-clock assertions stay.
// D-338 (2026-10-20) retires Focus on reading, Browse and the View controls: the
// m-series below that names them is history, not current coverage; the current
// close/reopen and logo claims are migrated in place and listed in the PR body.

/** Complete article journeys for #289. Published HTML is real; the DSL controls
 * gameplay only. Historical PRE-OWNERQ1 controls, 2026-10-09: 24 final variants
 * rejected by 44 assertion failures, with emitted-byte differentials checked.
 *
 * m01 truncated prose: 9 full-HTML comparisons fail across all named page types.
 * m02 retained gameplay: Focus leaves 20 cards and a staged move instead of none.
 * m03b disabled reading interaction + clock guard (compound): focus/selection
 *      accrue a miss after 20s; wheel no longer enters reading. All three fail.
 * m04 ignored saved Focus: reload deals once; the zero-deals assertion fails.
 * m05 reset part overrides: restored Map disappears on reload (both widths).
 * m06 Book follows Card: hiding Practice hides the independent article.
 * m07 visible Map / m08 visible Feedback (both planes, compound): computed
 *      visibility stays visible after minimizing, at both widths.
 * m09 24px shelf targets: both widths fail the unchanged 44px minimum.
 * m10 reading navigations play: Browse creates a hand and timed question.
 * m11 reused previous HTML: the complete Defender prose comparison fails.
 * m12c removed abort + serial guard (compound): a late Defender response replaces
 *      Mount in the SAME reader instance. Non-kill: Back-only m12 and m12b stayed
 *      green, even after awaiting request settlement; Back alone does not prove
 *      these guards. The same-reader Browse race supplies the positive kill.
 * m13 bubbling reading keys: a/1/Space change gameplay and unpause it.
 * m14b retained iframe: hiding Videos leaves one playing frame instead of zero.
 * m15 forced Top: an automatic Bottom article keeps the wrong perspective.
 * m16 dropped arrival hash: reload fails to focus the requested source heading.
 * m17 retained failed module promise: Retry cannot render the original article.
 * m18 removed cold preview reservation: opening-flight aim drifts 6.82, limit 3.
 * m19 dropped paused lift: both pane widths change vertical clearance.
 * m20 Practice bypasses staging: both camera placement checks fail.
 * m21 reset Book: keyboard-minimized Book reappears after reload (both widths).
 * m22 auto-pause on render: the running-roll precondition fails before reading.
 * m23 hidden preview: prose visibility/hit-testing fails before any click.
 * m24b eager reader import: the real first-hand gate names reader.js as banned.
 *
 * OWNERQ1 supersedes m02/m04/m20: content arrivals now keep dormant controls and
 * have no Practice gate. Current controls live in reading-contract/navigation.
 * m37 (2026-10-14) resets saved Focus on arrival: both reload journeys fail on
 * the missing hidden-film restore target. It replaces m04's old zero-deal proof.
 *
 * Invalid attempts are NOT kills: m14 did not compile; m24 selected zero tests.
 * The first m03 selection setup targeted a now-hidden title; m03b selects actual
 * prose and replaces that evidence. Original logs remain in the delivery report.
 * Real Firefox privacy/no-JS views are separate observations, not mutant coverage;
 * external video playback and exhaustive corpus/browser combinations are unproved.
 */
const READY = '[data-reader][data-reader-ready="true"]'
const KNEE = "/Transitions/Knee-Slice-Pass"
const state = (page: Page) => page.evaluate(() => {
  const a = (window as any).__neural
  return { intent: !!a._readerIntent, interacting: !!a._reader?.interacting, paused: !!a.paused, position: a.currentPos, hand: (a._optList || []).length,
    deals: (a.beats || []).filter((b: any) => b.beat === "options_dealt").length,
    question: !!a._landQ, staged: !!a._staged,
    misses: (a.beats || []).filter((b: any) => b.beat === "land_q_expired").length,
    pending: !!a._landPending, clock: a._decision?.remaining ?? null }
})

for (const viewport of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
  test(`@curated ${viewport.width}px complete article, every close and reopen, and reload`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.emulateMedia({ reducedMotion: "reduce" })
    const j = journey(page)
    await j.boot(KNEE)
    await j.advance(5000)
    await expect(page.locator(READY)).toBeVisible({ timeout: 20000 })
    await expect(page.locator("[data-land-more]")).toHaveCount(0)
    await expect(page.locator("[data-reader-body]")).toContainText("Training Progressions")
    expect(await state(page)).toMatchObject({ intent: true, paused: true, clock: null, deals: 0 })
    await expect(page.locator('.ng-section-card').first()).toHaveAttribute('data-section-type', 'videos')
    await expect(page.locator('[data-section-type=overview]')).toContainText('Knee Slice')
    // RETIRED (D-338, owner: no View menu; Focus on reading and Browse removed). The Focus preset,
    // its saved reload and the article view's Map, Feedback and Book toggles have no control left
    // to press; their absence is the claim now, on both widths.
    await expect(page.locator("[data-reading-focus],[data-reader-browse]")).toHaveCount(0)
    for (const part of ["book", "map", "feedback", "film", "card", "hand"]) {
      await expect(page.locator(`[data-layer-hide="${part}"],[data-layer-show="${part}"]`), `no View control offers ${part}`).toBeHidden()
    }
    // D-338: each part has its own ✕. U25 a moves the closed Videos label into Hidden sections;
    // Questions/Moves retain their own labels. Neither closing nor reopening starts play.
    const close = { film: '[data-section-toggle="videos"]', card: '[data-land-close]', hand: '[data-hand-close]' } as Record<string, string>
    const open = { film: '[data-section-toggle="videos"]', card: '[data-game-open="card"]', hand: '[data-game-open="hand"]' } as Record<string, string>
    // STALE SPEC (D-368, layout C): Moves lead the flow, so reopening a part can scroll the tray out of view, and the
    // hand's ✕ docks only beside a visible tray (_dockHandClose); its own last rectangle is stale while hidden. The
    // tray is brought into view before its ✕ is pressed or looked for.
    const tray = async () => { await page.evaluate(() => (window as any).__neural.optionsRef.current.scrollIntoView({ block: "nearest" })); await j.readerLayoutSettled(); await j.advance(40) }
    const press = async (sel: string, what: string) => { if (sel === '[data-hand-close]') await tray(); await page.locator(sel).scrollIntoViewIfNeeded(); await j.readerLayoutSettled(); await j.clickByMouse(sel, what) }
    // STALE SPEC (D-355, U11): where the index shows (1366), a closed part or section leaves no label or header in
    // the content: its index row shows it closed and reopens it. Without the index (390), use its label
    // after opening Hidden sections for Videos (D-482 / U25 a).
    const indexed = await page.locator('.ng-reader-toc').isVisible()
    const row = { film: '[data-toc-type="videos"]', card: '[data-toc-type="card"]', hand: '[data-toc-type="hand"]' } as Record<string, string>
    for (const part of ["film", "card", "hand"]) {
      await press(close[part], `close ${part}`)
      if (indexed) await expect(page.locator(row[part]), `a closed ${part} shows closed in the index`).toHaveAttribute("data-collapsed", "true")
      else if (part === "film") await expect(page.locator(open.film)).toHaveAttribute("aria-expanded", "false")
      else await expect(page.locator(open[part]), `a closed ${part} leaves its label`).toBeVisible()
      expect((await state(page)).deals, "closing never deals or starts play").toBe(0)
      if (indexed) {
        await j.clickByMouse(`${row[part]} a`, `reopen ${part} from the index`)
        await j.readerLayoutSettled()
        // U11: the index row reopens the part AND brings it into view (its top inside the reader's scrollport)
        if (part !== "film") expect(await page.evaluate(part => { const a = (window as any).__neural, el = part === "card" ? a._landEl : a.optionsRef.current
          const b = el?.getBoundingClientRect(), v = a._reader.root.getBoundingClientRect(); return !!b && b.top >= v.top - 1 && b.top < v.bottom }, part), `the index row shows the reopened ${part}`).toBe(true)
      }
      else {
        if (part === 'film') {
          // STALE SPEC (D-482): a rectangle under a closed disclosure is not a reachable control.
          await expect(page.locator('.ng-reader-hidden')).not.toHaveAttribute('open', '')
          await press('.ng-reader-hidden>summary', 'reveal the hidden Videos control')
          await expect(page.locator('.ng-reader-hidden')).toHaveAttribute('open', '')
        }
        await press(open[part], `reopen ${part}`)
      }
      if (part === "film") await expect(page.locator(open.film)).toHaveAttribute("aria-expanded", "true")
      else { await expect(page.locator(open[part])).toBeHidden(); if (part === "hand") await tray(); await expect(page.locator(close[part]).first()).toBeVisible() }
      expect((await state(page)).deals, "reopening never deals or starts play").toBe(0)
    }
    await press(close.card, "close the question")
    await press(close.hand, "close the moves")
    // Closed parts are saved: a reload keeps both closed (their labels, or their index rows) and still deals nothing.
    await j.boot(KNEE, { preserveStorage: true })
    await j.advance(5000)
    await expect(page.locator(READY)).toBeVisible()
    for (const part of ["card", "hand"]) {
      if (indexed) await expect(page.locator(row[part])).toHaveAttribute("data-collapsed", "true")
      else await expect(page.locator(open[part])).toBeVisible()
    }
    expect(await state(page)).toMatchObject({ intent: true, paused: true, clock: null, deals: 0 })
    // The label (or the index link) is a real control: the keyboard reopens it too.
    await page.locator(indexed ? `${row.card} a` : open.card).focus()
    await page.keyboard.press("Enter")
    if (indexed) await expect(page.locator(row.card)).toHaveAttribute("data-collapsed", "false")
    else await expect(page.locator(open.card)).toBeHidden()
    expect(await state(page)).toMatchObject({ intent: true, paused: true, clock: null, deals: 0 })
  })
}

test("@curated reading interaction waits past the question window without a miss", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await j.landQuestion()
  await expect(page.locator(READY)).toBeVisible({ timeout: 20000 })
  await j.openQuestion() // U34 a: Reveal starts the live question that this reading interaction declines.
  await page.evaluate(() => { const a = (window as any).__neural; a._engage("reading-test"); a._tryArmClock() })
  expect((await state(page)).clock, "a live question before reading").toBeGreaterThan(0)
  const before = await state(page)
  expect(before.paused, "automatic article rendering leaves a live roll running").toBe(false)
  expect(before.interacting).toBe(false)
  await page.locator("[data-reader-body]").focus()
  await j.advance(20000)
  expect((await state(page)).misses).toBe(before.misses)
  expect((await state(page)).clock).toBeNull()
  const reading = await state(page)
  await page.keyboard.press("a")
  await page.keyboard.press("1")
  await page.keyboard.press("Space")
  expect(await state(page), "article keys never activate or resume the game").toEqual(reading)
})

async function observeReadingBack(page: Page) {
  await page.evaluate(() => {
    const w = window as any
    const observation = w.__readingBack = { outgoing: w.__neural, outgoingRoot: w.__neural._readerEl, published: false, url: null }
    document.addEventListener('nav', (event: any) => {
      observation.published = true
      observation.url = event.detail.url
    }, { once: true })
  })
}

async function replacementReadingSnapshot(page: Page) {
  const ready = await page.waitForFunction(path => {
    const w = window as any, nav = w.__readingBack, app = w.__neural, root = app?._readerEl
    return nav?.published && '/' + nav.url === path && app !== nav.outgoing && !app?.__ngDestroyed &&
      root?.isConnected && root === app._reader?.root && root.dataset.readerReady === 'true' && root.dataset.readerPath === path
      ? { app, root } : false
  }, KNEE, { timeout: 5000 }) // Same bound as the original toHaveAttribute assertion.
  // Retain the app and root returned by readiness. A later global assignment
  // cannot silently substitute a different generation in this single snapshot.
  const snapshot = await ready.evaluate(({ app, root }: any) => ({
    current: app === (window as any).__neural,
    replacement: app !== (window as any).__readingBack.outgoing,
    connected: root.isConnected && root === app._readerEl && root === app._reader.root,
    path: root.dataset.readerPath, ready: root.dataset.readerReady,
    intent: !!app._readerIntent, paused: app.paused, clock: app._decision?.remaining ?? null,
  }))
  await ready.dispose()
  return snapshot
}

for (const forced of [false, true]) test("@curated reading perspectives and Back retain canonical content without gameplay" + (forced ? " with HTML then graph held" : ""), async ({ page }) => {
  const j = journey(page)
  // A Focus saved before D-338 stays in storage and is inert: nothing reads it or its overrides
  // (§6.6), so the question and the moves it hid are shown as the game layers say.
  const saved = { readingFocus: true, readingCard: false, readingHand: false }
  await j.boot(KNEE, { initialState: { v: 2, settings: saved, settingsAt: Object.fromEntries(Object.keys(saved).map(k => [k, Date.now()])) } })
  await j.advance(5000)
  await expect(page.locator(READY)).toBeVisible()
  await expect(page.locator('[data-landcard]'), 'a saved Focus no longer hides the question').toBeVisible()
  for (const part of ['card', 'hand']) await expect(page.locator(`[data-game-open="${part}"]`), `no closed label for a shown ${part}`).toBeHidden()
  // STALE SPEC (D-355, U11): where the index shows, a closed part leaves no label in the content and its index
  // row carries the closed state, so a shown part's row is not collapsed (control d338-saved-focus-read).
  if (await page.locator('.ng-reader-toc').isVisible()) for (const part of ['card', 'hand'])
    await expect(page.locator(`[data-toc-type="${part}"]`), `the index shows the ${part} open`).not.toHaveAttribute('data-collapsed', 'true')
  expect(await page.evaluate(() => (window as any).__neural._handShown()), 'a saved Focus no longer hides the moves').toBe(true)
  await j.readingOtherHalf() // D-318 U6a: the native paired half replaces the retired switch.
  await expect(page).toHaveURL(/Knee-Slice-Pass\/Defender/)
  await expect(page.locator(READY)).toHaveAttribute("data-reader-path", KNEE + "/Defender")
  await expect(page.locator('[data-reader-body]')).toContainText("Defender")
  const missing = await page.evaluate(async path => {
    const doc = new DOMParser().parseFromString(await (await fetch(path)).text(), "text/html")
    const norm = (s: string) => s.replace(/\s+/g, " ").trim()
    const text = norm([...document.querySelectorAll('[data-reader-article="guide"]')].map(e => e.textContent).join(" "))
    return [...doc.querySelectorAll("article p,article li")].map(e => norm(e.textContent || "")).filter(s => s.length > 40 && !text.includes(s))
  }, KNEE + "/Defender")
  expect(missing, "navigation cannot reuse the previous page's HTML under a new path").toEqual([])
  expect(await state(page)).toMatchObject({ intent: true, paused: true, clock: null })
  let releaseHTML!: () => void, releaseGraph!: () => void, htmlRequests = 0, graphRequests = 0
  if (forced) {
    const html = new Promise<void>(resolve => { releaseHTML = resolve })
    const graph = new Promise<void>(resolve => { releaseGraph = resolve })
    // Install only after the perspective/content assertions. These are Back's
    // actual Quartz HTML request and the replacement app's actual graph fetch.
    // Match paths, including Back's original boot query/seed URL.
    await page.route(url => url.pathname === KNEE, async route => { htmlRequests++; await html; await route.fallback() })
    await page.route(url => url.pathname.endsWith('/graph-data.json'), async route => { graphRequests++; await graph; await route.fallback() })
  }
  await observeReadingBack(page)
  try {
    await page.goBack()
    if (forced) {
      await expect.poll(() => htmlRequests).toBe(1)
      await page.waitForFunction(path => {
        const w = window as any, old = w.__readingBack.outgoing, root = w.__readingBack.outgoingRoot
        return w.__neural === old && root?.isConnected && root.dataset.readerReady === 'true' && root.dataset.readerPath === path
      }, KNEE, { timeout: 5000 })
      releaseHTML()
      await expect.poll(() => graphRequests).toBe(1)
      const loading = await page.evaluate(() => {
        const w = window as any, app = w.__neural, oldRoot = w.__readingBack.outgoingRoot
        return { nav: w.__readingBack.published, replacement: app !== w.__readingBack.outgoing,
          oldPublished: oldRoot.dataset.readerReady === 'true' && oldRoot.dataset.readerPath === '/Transitions/Knee-Slice-Pass',
          connected: !!app._readerEl?.isConnected, nodes: app.nodes?.length ?? 0 }
      })
      expect(loading, 'the outgoing article is not evidence that the replacement has loaded').toEqual({ nav: true, replacement: true, oldPublished: true, connected: false, nodes: 0 })
      releaseGraph()
    }
    const restored = await replacementReadingSnapshot(page)
    expect(restored).toMatchObject({ current: true, replacement: true, connected: true, path: KNEE, ready: 'true' })
    expect(restored).toMatchObject({ intent: true, paused: true, clock: null })
  } finally {
    releaseHTML?.(); releaseGraph?.()
  }
})

test("@curated an automatic game article follows the bottom player's perspective", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await expect(page.locator(READY)).toBeVisible()
  await page.evaluate(() => { const a = (window as any).__neural; a.rollFromPosition(a.currentPos, true, "bottom") })
  await j.advance(5000)
  await expect(page.locator(READY)).toHaveAttribute("data-reader-path", "/Positions/Mount/Bottom")
  expect(await page.locator('[data-reader-article="guide"]').evaluateAll(es => [...new Set(es.map(e => e.getAttribute("data-source-path")))])).toEqual(['/Positions/Mount/Bottom'])
  expect((await state(page)).intent).toBe(false)
})

test("@curated a technique outside the active game ruleset remains readable on direct arrival", async ({ page }) => {
  const j = journey(page), path = "/Submissions/Cross-Collar-Choke/from-High-Mount/Attacker"
  await j.boot(path, { beforeNavigate: async () => { await page.addInitScript(() => localStorage.setItem("bjj_gi_mode", "nogi")) } })
  await j.advance(5000)
  await expect(page.locator(READY)).toHaveAttribute("data-reader-path", path)
  expect(await page.evaluate(() => (window as any).__neural._nodeAndRoleForPath(location.pathname).idx)).toBeLessThan(0)
  expect(await state(page)).toMatchObject({ intent: true, hand: 0, question: false, deals: 0 })
  await expect(page.locator('[data-reader-body]')).toContainText("Cross Collar Choke")
})

for (const action of ["wheel", "selection"] as const) {
  test(`@curated mixed ${action} declines the live question without scoring a miss`, async ({ page }) => {
    const j = journey(page)
    await j.boot("/")
    await j.land("Mount Top")
    await j.advance(5000)
    await expect(page.locator(READY)).toBeVisible()
    await j.landQuestion()
    await j.openQuestion() // U34 a: covered time is free; explicitly Reveal before testing the live-window gesture.
    await page.evaluate(() => { const a = (window as any).__neural; a._engage("reading-proof"); a._tryArmClock() })
    expect((await state(page)).clock).toBeGreaterThan(0)
    const before = await state(page)
    if (action === "wheel") {
      // D-338: the reader's bottom edge is now the question (game input), so the wheel goes over
      // reading that is on screen at arrival: the Videos section's own text, first in the flow.
      // STALE CONTRACT (D-368, layout C): nothing is lifted into the game; the Videos section opens the article,
      // after the stage, and its text must be on screen at arrival for this wheel.
      const r = await page.locator(".ng-reader-article [data-section-type=videos] .section-subtitle").first().boundingBox()
      expect(r && r.y + r.height / 2 < 900, "premise: the Videos section's text is on screen at arrival").toBe(true)
      await page.mouse.move(r!.x + r!.width / 2, r!.y + r!.height / 2)
      await page.mouse.wheel(0, 300)
      await expect(page.locator("[data-reader]")).toHaveAttribute("data-reading-expanded", "")
      // The first wheel expands the compact prose into authored document order.
      // Continue the gesture in the resulting native scrollport.
      await page.mouse.wheel(0, 300)
      await expect.poll(() => page.locator("[data-reader]").evaluate(e => e.scrollTop)).toBeGreaterThan(0)
    } else {
      const p = page.locator('[data-reader-body] [data-source-id="overview"] > p').first()
      await p.scrollIntoViewIfNeeded()
      const r = await p.boundingBox()
      await page.mouse.move(r!.x + 2, r!.y + 12)
      await page.mouse.down()
      await page.mouse.move(r!.x + Math.min(r!.width - 2, 90), r!.y + 12, { steps: 10 })
      await page.mouse.up()
      expect(await page.evaluate(() => getSelection()?.toString().length || 0), "native text selection survives expansion").toBeGreaterThan(0)
    }
    await j.advance(20000)
    expect((await state(page)).misses).toBe(before.misses)
    expect((await state(page)).clock).toBeNull()
  })
}

// STALE CONTRACT (D-338): Browse is gone; the logo opens the same pane, and its Explore tab is
// one press away. Saved Focus is no longer read, so the seed carries only the Feedback layer.
async function explore(page: Page, j: ReturnType<typeof journey>) {
  await page.locator(READY).evaluate(e => { e.scrollTop = 0 })
  await j.clickByMouse(".ng-logo", "the logo opens the pane, as Browse did")
  if (await page.evaluate(() => (window as any).__neural._viewMode !== "explore")) await j.clickByMouse('[data-view="explore"]', "the Explore tab")
}
test("@curated the logo and linked content keep reading intent through positions, techniques and principles", async ({ page }) => {
  const j = journey(page)
  await j.boot(KNEE, { initialState: { v: 2, settings: { landFeedback: false }, settingsAt: {} } })
  await expect(page.locator(READY)).toBeVisible()
  await explore(page, j)
  await page.locator(".ng-explorer-search input").fill("Mount")
  const star = page.locator('[data-list-surface="explore"][data-list-add="Positions/Mount"]')
  await expect(star).toHaveCount(1)
  // A coordinate click waits for the app's own alias-loading row to retire: results reorder as the
  // aliases index lands (the D-325 race, pinned on its own by reading-browse-hydration.spec.ts). The
  // logo's extra tab press moved this journey into that window; its claim is reading intent.
  await expect(page.locator('[data-alias-status="loading"]')).toHaveCount(0)
  await j.clickByMouse('div:has(> [data-list-surface="explore"][data-list-add="Positions/Mount"]) > button:first-child', "read the Mount search result")
  await expect(page.locator(READY)).toHaveAttribute("data-reader-path", /\/Positions\/Mount(?:\/Top)?$/)
  expect(await state(page)).toMatchObject({ intent: true, paused: true, clock: null })
  const link = page.locator('[data-reader-body] a[href*="/Transitions/"]').first()
  const url = new URL(await link.getAttribute("href")!, page.url())
  await link.scrollIntoViewIfNeeded()
  await link.evaluate(e => e.setAttribute("data-reading-link", ""))
  await j.clickByMouse("[data-reading-link]", "a linked technique")
  await expect(page.locator(READY)).toHaveAttribute("data-reader-path", decodeURI(url.pathname))
  expect(await state(page)).toMatchObject({ intent: true, paused: true, clock: null })
  await explore(page, j)
  await page.locator(".ng-explorer-search input").fill("")
  const section = page.locator('[data-explore-section="Principles"]')
  if (await section.getAttribute("aria-expanded") !== "true") await j.clickByMouse('[data-explore-section="Principles"]')
  const principle = page.locator('[data-concept-row="Principles/Base"]')
  await principle.scrollIntoViewIfNeeded()
  await j.clickByMouse('[data-concept-row="Principles/Base"]')
  await expect(page.locator(READY)).toHaveAttribute("data-reader-path", "/Principles/Base")
  expect(await state(page)).toMatchObject({ intent: true, paused: true, clock: null })
})

// STALE CONTRACT (D-338): the article can no longer be minimized from the article view, and saved
// Focus is not read. The question starts closed through its own saved layer and reopens from its
// label in the article; answering it still starts play, the claim this journey keeps.
test("@curated heading links focus the cloned article and a reopened question starts play", async ({ page }) => {
  const j = journey(page)
  await j.boot(KNEE, { initialState: { v: 2, settings: { landCard: false, landHand: false, landFeedback: false }, settingsAt: {} } })
  await expect(page.locator(READY)).toBeVisible()
  // Canonical authored fragment links remain valid after semantic regrouping.
  await page.evaluate(() => { const a = document.createElement('a'); a.href = '/Transitions/Knee-Slice-Pass#key-principles'; a.dataset.readerAnchor = 'key-principles'; a.dataset.testSourceAnchor = ''; a.textContent = 'Principles'; document.querySelector('[data-reader-body]')!.prepend(a) })
  const heading = page.locator('[data-test-source-anchor]')
  await heading.focus()
  await page.keyboard.press("Enter")
  expect(await page.evaluate(() => document.activeElement?.closest('[data-reader]') != null)).toBe(true)
  expect(new URL(page.url()).hash.length).toBeGreaterThan(1)
  const hash = new URL(page.url()).hash
  await j.boot(KNEE + hash, { preserveStorage: true })
  await expect(page.locator(READY)).toBeVisible()
  expect(await page.evaluate(() => document.activeElement?.closest('[data-section-type]')?.getAttribute('data-section-type'))).toBe('principles')
  // STALE SPEC (D-355, U11): where the index shows, the closed question's index row reopens it.
  if (await page.locator('.ng-reader-toc').isVisible()) await j.clickByMouse('[data-toc-type="card"] a', 'reopen the question from its index row')
  else {
    await page.locator('[data-game-open="card"]').scrollIntoViewIfNeeded()
    await j.readerLayoutSettled()
    await j.clickByMouse('[data-game-open="card"]', 'reopen the question from its label')
  }
  await expect(page.locator('[data-reader-practice-offer]')).toHaveCount(0)
  const q = await j.landQuestion()
  expect(q).not.toBeNull()
  await j.advance(20000)
  expect(await state(page)).toMatchObject({ intent: true, paused: true, clock: null })
  await page.locator(`[data-land-mc-opt="${q!.correct}"]`).scrollIntoViewIfNeeded()
  await j.readerLayoutSettled()
  await j.openQuestion() // U34: answering is an explicit play action.
  await j.clickByMouse(`[data-land-mc-opt="${q!.correct}"]`, 'answer the reopened question directly')
  await expect.poll(() => state(page)).toMatchObject({ intent: false })
  await j.advance(1000)
  expect((await state(page)).hand).toBeGreaterThan(0)
})

// The former independent article iframe owner is retired by the approved one-host
// seam. reading-media-placement.spec.ts covers identity, playback, collapse and
// quiet fallback; article-sections.spec.ts covers the persisted Videos control.
