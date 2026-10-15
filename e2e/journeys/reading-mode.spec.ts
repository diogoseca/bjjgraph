import { test, expect, type Page } from "@playwright/test"
import { journey } from "../dsl"

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
    question: !!a._landQ, staged: !!a._staged, focus: a.get("readingFocus", false),
    misses: (a.beats || []).filter((b: any) => b.beat === "land_q_expired").length,
    pending: !!a._landPending, clock: a._decision?.remaining ?? null }
})

for (const viewport of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
  test(`@curated ${viewport.width}px complete article, Focus, every restore and reload`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.emulateMedia({ reducedMotion: "reduce" })
    const j = journey(page)
    await j.boot(KNEE)
    await j.advance(5000)
    await expect(page.locator(READY)).toBeVisible({ timeout: 20000 })
    await expect(page.locator("[data-land-more]")).toHaveCount(0)
    await expect(page.locator("[data-reader-body]")).toContainText("Training Progressions")
    expect((await state(page)).intent).toBe(true)
    const prose = await page.locator('[data-reader-body] [data-source-id="overview"] > p').first().evaluate(el => {
      const r = el.getBoundingClientRect(), box = el.closest('[data-reader]')!.getBoundingClientRect()
      const y = Math.max(r.top, box.top) + 12, x = r.left + 10
      const hit = document.elementFromPoint(x, y)
      return { text: el.textContent?.trim().length || 0, visible: getComputedStyle(el).visibility,
        lineVisible: y + 8 < Math.min(r.bottom, box.bottom), hit: !!hit && el.contains(hit) }
    })
    expect(prose.text, "the immediate preview contains authored prose").toBeGreaterThan(80)
    expect(prose, "a real prose line is visible before any disclosure click").toMatchObject({ visible: "visible", lineVisible: true, hit: true })
    await j.clickByMouse("[data-reading-focus]", "one-click Focus on reading")
    await expect.poll(() => state(page)).toMatchObject({ intent: true, paused: true, clock: null, focus: true, deals: 0 })
    await expect(page.locator(READY)).toBeVisible()
    for (const part of ["film", "card", "hand", "map", "feedback"]) {
      await j.clickByMouse(`[data-layer-show="${part}"]`, `restore ${part}`)
      await expect(page.locator(`[data-layer-hide="${part}"]`)).toBeVisible()
      if (part === "map" || part === "feedback") expect(await page.evaluate(p => { const a = (window as any).__neural; return getComputedStyle(p === "map" ? a.canvas : a.evRef.current).visibility }, part)).toBe("visible")
      expect((await state(page)).deals, "restoration never deals or starts play").toBe(0)
      await j.clickByMouse(`[data-layer-hide="${part}"]`, `minimize ${part}`)
      if (part === "map" || part === "feedback") expect(await page.evaluate(p => { const a = (window as any).__neural; return getComputedStyle(p === "map" ? a.canvas : a.evRef.current).visibility }, part)).toBe("hidden")
    }
    await j.clickByMouse('[data-layer-hide="book"]')
    await expect(page.locator("[data-reader]")).toBeHidden()
    await j.clickByMouse('[data-layer-show="book"]')
    await expect(page.locator(READY)).toBeVisible()
    await j.clickByMouse('[data-layer-show="map"]')
    const geometry = await page.locator("[data-reader-part]").evaluateAll((nodes) => {
      const boxes = nodes.map(n => n.getBoundingClientRect())
      return { sizes: boxes.map(b => [b.width, b.height]), overlap: boxes.some((b, i) => boxes.some((c, k) => k > i && Math.min(b.right, c.right) > Math.max(b.left, c.left) && Math.min(b.bottom, c.bottom) > Math.max(b.top, c.top))) }
    })
    expect(geometry.overlap).toBe(false)
    for (const [w, h] of geometry.sizes) { expect(w).toBeGreaterThanOrEqual(44); expect(h).toBeGreaterThanOrEqual(44) }
    await j.boot(KNEE, { preserveStorage: true })
    await j.advance(5000)
    await expect(page.locator(READY)).toBeVisible()
    await expect(page.locator('[data-layer-hide="map"]')).toBeVisible()
    for (const part of ["film", "card", "hand", "feedback"]) await expect(page.locator(`[data-layer-show="${part}"]`)).toBeVisible()
    expect(await state(page)).toMatchObject({ intent: true, paused: true, clock: null, focus: true, deals: 0 })
    await page.locator('[data-layer-hide="book"]').focus()
    await page.keyboard.press("Enter")
    await expect(page.locator("[data-reader]")).toBeHidden()
    await j.boot(KNEE, { preserveStorage: true })
    await expect(page.locator('[data-layer-show="book"]')).toBeVisible()
    await expect(page.locator("[data-reader]")).toBeHidden()
    await page.locator('[data-layer-show="book"]').focus()
    await page.keyboard.press("Enter")
    await expect(page.locator(READY)).toBeVisible()
    expect(await state(page)).toMatchObject({ intent: true, paused: true, clock: null, focus: true, deals: 0 })
  })
}

test("@curated reading interaction waits past the question window without a miss", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await j.landQuestion()
  await expect(page.locator(READY)).toBeVisible({ timeout: 20000 })
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

test("@curated reading perspectives and Back retain canonical content without gameplay", async ({ page }) => {
  const j = journey(page)
  await j.boot(KNEE, { initialState: { v: 2, settings: { readingFocus: true }, settingsAt: { readingFocus: Date.now() } } })
  await j.advance(5000)
  await expect(page.locator(READY)).toBeVisible()
  await j.clickByMouse('[aria-label="Reading perspectives"] a[href$="/Defender"]')
  await expect(page).toHaveURL(/Knee-Slice-Pass\/Defender/)
  await expect(page.locator(READY)).toHaveAttribute("data-reader-path", KNEE + "/Defender")
  await expect(page.locator('[data-reader-article="guide"]')).toContainText("Defender")
  const missing = await page.evaluate(async path => {
    const doc = new DOMParser().parseFromString(await (await fetch(path)).text(), "text/html")
    const norm = (s: string) => s.replace(/\s+/g, " ").trim()
    const text = norm(document.querySelector('[data-reader-article="guide"]')!.textContent || "")
    return [...doc.querySelectorAll("article p,article li")].map(e => norm(e.textContent || "")).filter(s => s.length > 40 && !text.includes(s))
  }, KNEE + "/Defender")
  expect(missing, "navigation cannot reuse the previous page's HTML under a new path").toEqual([])
  expect(await state(page)).toMatchObject({ intent: true, paused: true, clock: null })
  await page.goBack()
  await expect(page.locator(READY)).toHaveAttribute("data-reader-path", KNEE)
  expect(await state(page)).toMatchObject({ intent: true, paused: true, clock: null })
})

test("@curated an automatic game article follows the bottom player's perspective", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await expect(page.locator(READY)).toBeVisible()
  await page.evaluate(() => { const a = (window as any).__neural; a.rollFromPosition(a.currentPos, true, "bottom") })
  await j.advance(5000)
  await expect(page.locator(READY)).toHaveAttribute("data-reader-path", "/Positions/Mount/Bottom")
  await expect(page.locator('[data-reader-article="guide"]')).toHaveAttribute("data-source-path", "/Positions/Mount/Bottom")
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
    await page.evaluate(() => { const a = (window as any).__neural; a._engage("reading-proof"); a._tryArmClock() })
    expect((await state(page)).clock).toBeGreaterThan(0)
    const before = await state(page)
    if (action === "wheel") {
      const r = await page.locator("[data-reader]").boundingBox()
      await page.mouse.move(r!.x + r!.width / 2, r!.y + r!.height - 12)
      await page.mouse.wheel(0, 300)
      await expect(page.locator("[data-reader]")).toHaveAttribute("data-reading-expanded", "")
      // The first wheel expands the compact prose into authored document order.
      // Continue the gesture in the resulting native scrollport.
      await page.mouse.wheel(0, 300)
      await expect.poll(() => page.locator("[data-reader]").evaluate(e => e.scrollTop)).toBeGreaterThan(0)
    } else {
      const r = await page.locator('[data-reader-body] [data-source-id="overview"] > p').first().boundingBox()
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

test("@curated Browse and linked content keep reading intent through positions, techniques and principles", async ({ page }) => {
  const j = journey(page)
  await j.boot(KNEE, { initialState: { v: 2, settings: { readingFocus: true, readingFeedback: false }, settingsAt: {} } })
  await expect(page.locator(READY)).toBeVisible()
  await j.clickByMouse("[data-reader-browse]")
  await page.locator(".ng-explorer-search input").fill("Mount")
  const star = page.locator('[data-list-surface="explore"][data-list-add="Positions/Mount"]')
  await expect(star).toHaveCount(1)
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
  await j.clickByMouse("[data-reader-browse]")
  await page.locator(".ng-explorer-search input").fill("")
  const section = page.locator('[data-explore-section="Principles"]')
  if (await section.getAttribute("aria-expanded") !== "true") await j.clickByMouse('[data-explore-section="Principles"]')
  const principle = page.locator('[data-concept-row="Principles/Base"]')
  await principle.scrollIntoViewIfNeeded()
  await j.clickByMouse('[data-concept-row="Principles/Base"]')
  await expect(page.locator(READY)).toHaveAttribute("data-reader-path", "/Principles/Base")
  expect(await state(page)).toMatchObject({ intent: true, paused: true, clock: null })
})

test("@curated heading links focus the cloned article and a restored question starts play with Book minimized", async ({ page }) => {
  const j = journey(page)
  await j.boot(KNEE, { initialState: { v: 2, settings: { readingFocus: true, readingFilm: false, readingCard: false, readingHand: false, readingFeedback: false }, settingsAt: {} } })
  await expect(page.locator(READY)).toBeVisible()
  const heading = page.locator('[data-reader-target]').first()
  await heading.focus()
  await page.keyboard.press("Enter")
  expect(await page.evaluate(() => document.activeElement?.closest('[data-reader]') != null)).toBe(true)
  expect(new URL(page.url()).hash.length).toBeGreaterThan(1)
  const hash = new URL(page.url()).hash
  await j.boot(KNEE + hash, { preserveStorage: true })
  await expect(page.locator(READY)).toBeVisible()
  expect(await page.evaluate(() => (document.activeElement as HTMLElement)?.dataset.sourceId)).toBe(decodeURIComponent(hash.slice(1)))
  await j.clickByMouse('[data-layer-hide="book"]')
  await j.clickByMouse('[data-layer-show="card"]')
  await expect(page.locator('[data-reader-practice-offer]')).toHaveCount(0)
  const q = await j.landQuestion()
  expect(q).not.toBeNull()
  await j.advance(20000)
  expect(await state(page)).toMatchObject({ intent: true, paused: true, clock: null })
  await j.clickByMouse(`[data-land-mc-opt="${q!.correct}"]`, 'answer the restored question directly')
  await expect.poll(() => state(page)).toMatchObject({ intent: false, focus: false })
  await j.advance(1000)
  expect((await state(page)).hand).toBeGreaterThan(0)
})

test("@curated reading videos have one explicit owner and stop when Videos or Book is hidden", async ({ page }) => {
  const j = journey(page)
  await page.route(/youtube(?:-nocookie)?\.com\/embed\//, route => route.fulfill({ contentType: "text/html", body: "<title>Video fixture</title>" }))
  await j.boot(KNEE, { initialState: { v: 2, settings: { readingFocus: true, readingFilm: false }, settingsAt: {} } })
  await expect(page.locator(READY)).toBeVisible()
  await expect(page.locator('[data-reader] iframe')).toHaveCount(0)
  await j.clickByMouse('[data-layer-show="film"]')
  const play = page.locator('[data-reader-video]').first()
  await play.scrollIntoViewIfNeeded()
  await play.evaluate(el => el.setAttribute("data-reading-play", ""))
  await j.clickByMouse('[data-reading-play]')
  await expect(page.locator('[data-reader] iframe')).toHaveCount(1)
  await expect(page.locator('[data-land-film] iframe')).toHaveCount(0)
  await j.clickByMouse('[data-layer-hide="film"]')
  await expect(page.locator('[data-reader] iframe')).toHaveCount(0)
  await j.clickByMouse('[data-layer-show="film"]')
  await expect(page.locator('[data-reader] iframe')).toHaveCount(0)
  await page.locator('[data-reading-play]').scrollIntoViewIfNeeded()
  await j.clickByMouse('[data-reading-play]')
  await expect(page.locator('[data-reader] iframe')).toHaveCount(1)
  await j.clickByMouse('[data-layer-hide="book"]')
  await expect(page.locator('[data-reader] iframe')).toHaveCount(0)
  await j.clickByMouse('[data-layer-show="book"]')
  await expect(page.locator('[data-reader] iframe')).toHaveCount(0)
  expect(await state(page)).toMatchObject({ intent: true, paused: true, clock: null })
})
