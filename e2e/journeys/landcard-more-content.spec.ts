import { test, expect } from "@playwright/test"
import { journey } from "../dsl"

/** #289 replaces the abridged More renderer with complete published articles.
 * The old folded/pinned virtual-column assertions are superseded by the reader
 * journeys; the late-choice dossier assertion protects the current landing question below.
 * These tests compare against authored HTML, not a second dossier renderer.
 * MDP-sandbox mutation evidence is recorded in reading-mode.spec.ts.
 * m55_late_article_wins removes cancellation and the serial paint guard: the
 * same-reader Browse journey must reject the old Defender article by name.
 * A cancellation-only control survives: the serial check still blocks its paint.
 */

// v1.230.0 reverses v1.218.1/v1.220.0 Inspect. Late media belongs to its
// existing card; the landing question and the hand's scroll position must survive.
test("@curated a cold choice gains its approved video without replacing the landing question or hand scroll", async ({ page }) => {
  const j = journey(page)
  await j.boot()
  await j.land("Mount Top")
  await expect.poll(() => page.evaluate(() => !((window as any).__neural._choiceMediaActive > 0))).toBe(true)
  const target = await page.evaluate(() => {
    const w = window as any, a = w.__neural
    const option = a._optionCards.find((c: any) => !c.esc && !c.opt.threat)
    option.card.setAttribute("data-more-test-option", "1")
    const key = option.node.t
    delete (w.NG_CONTENT?.decks || {})[key]
    delete (a._contentWaits || {})[key]
    return { key, filename: a.qhash(key) + ".json", deck: a.deckKeyFor(option.node).key }
  })
  await j.hydrate([target.deck])
  let release!: () => void
  const held = new Promise<void>(resolve => { release = resolve })
  let requests = 0
  await page.route(`**/content/${target.filename}`, async route => {
    requests++
    await held
    await route.fulfill({ json: { [target.key]: { perspectives: { attacker: {
      clips: [{ id: "aaaaaaaaaaa", title: target.key, front: true, duration: 42 }],
    } } } } })
  })
  const before = await page.evaluate(() => {
    const w = window as any, a = w.__neural
    const card = document.querySelector("[data-more-test-option]") as any
    a._queueChoiceMedia(card, card._choiceTarget, a._choiceHandId)
    const question = document.querySelector("[data-land-q]") as HTMLElement
    if (!question) throw new Error("The landing must have a live question before the held response")
    const scroll = a.optionsRef.current
    a._trayStop(); scroll.scrollLeft = 37
    w.__moreQuestion = question; w.__moreQuestionHTML = question.outerHTML; w.__moreScroll = scroll; w.__moreCard = card
    return { scroll: scroll.scrollLeft, owner: a._landQ.key }
  })
  expect(before.owner).toBe("Mount|Top")
  expect(before.scroll, "the actual hand is scrolled before the response").toBeGreaterThan(0)
  await expect.poll(() => requests, { message: "the choice's own dossier request is held" }).toBe(1)
  release()
  await expect(page.locator("[data-more-test-option] [data-choice-watch]")).toBeVisible()
  expect(await page.evaluate(() => {
    const w = window as any
    return { sameHost: w.__moreQuestion === document.querySelector("[data-land-q]"),
      sameQuestion: w.__moreQuestionHTML === w.__moreQuestion.outerHTML, scroll: w.__moreScroll.scrollLeft,
      sameCard: w.__moreCard === document.querySelector("[data-more-test-option]") }
  })).toEqual({ sameHost: true, sameQuestion: true, scroll: before.scroll, sameCard: true })
})


const READER = '[data-reader-ready="true"]'
const readingState = { v: 2, settings: { readingFocus: true, readingFilm: false,
  readingCard: false, readingHand: false, readingMap: false, readingFeedback: false }, settingsAt: {} }

for (const path of [
  "/Positions/Mount/Top", "/Positions/Mount/Bottom",
  "/Transitions/Knee-Slice-Pass/Attacker", "/Transitions/Knee-Slice-Pass/Defender",
  "/Submissions/Rear-Naked-Choke/from-Back-Control/Attacker", "/Principles/Base",
  "/Submissions/Armbar",
  "/Learning/Position-Over-Submission", "/Systems/10th-Planet-No-Gi-Guard-System",
]) {
  test(`@curated complete published article: ${path}`, async ({ page }) => {
    const j = journey(page)
    await j.boot(path, { initialState: readingState })
    await j.advance(5000)
    await expect(page.locator(READER)).toBeVisible({ timeout: 20000 })
    const comparison = await page.evaluate(async (path) => {
      const response = await fetch(path)
      const doc = new DOMParser().parseFromString(await response.text(), "text/html")
      const source = doc.querySelector("article")!
      const normalized = (s: string) => s.replace(/Play as /g, "Read as ").replace(/\s+/g, " ").trim()
      const prose = [...source.querySelectorAll("p,li,h2,h3,h4,td,th,aside")].map(n => normalized(n.textContent || "")).filter(s => s.length > 0)
      const shown = normalized(document.querySelector('[data-reader-article="guide"]')!.textContent || "")
      const a = (window as any).__neural
      return { status: response.status, prose: prose.length, missing: prose.filter(s => !shown.includes(s)),
        current: a.currentPos ?? null, staged: !!a._staged, played: !!a._played, paused: a.paused, clock: a._decision?.remaining ?? null, deals: (a.beats || []).filter((b: any) => b.beat === "options_dealt").length,
        hand: document.querySelectorAll("[data-tech]").length, question: !!a._landQ,
        links: document.querySelectorAll('[data-reader-article="guide"] a[href]').length }
    }, path)
    expect(comparison.status).toBe(200)
    expect(comparison.prose, "source comparison is nonempty").toBeGreaterThan(0)
    expect(comparison.missing, "every full published paragraph/list item survives").toEqual([])
    expect(comparison.links, "the complete guide keeps its links").toBeGreaterThan(0)
    expect(comparison).toMatchObject({ played: false, paused: true, clock: null, deals: 0 })
  })
}

test("@curated role reading retains hub safety and never creates duplicate IDs", async ({ page }) => {
  const j = journey(page)
  await j.boot("/Submissions/Rear-Naked-Choke/from-Back-Control/Defender", { initialState: readingState })
  await j.advance(5000)
  await expect(page.locator(READER)).toBeVisible()
  await expect(page.locator('[data-reader-article="hub"]')).toContainText(/Safety/)
  const ids = await page.locator("[id]").evaluateAll(nodes => nodes.map(n => n.id))
  const readerIds = ids.filter(id => id.startsWith("reader-"))
  expect(readerIds.length).toBeGreaterThan(5)
  for (const id of readerIds) expect(ids.filter(x => x === id)).toHaveLength(1)
})

test("@curated a failed article request has a real Retry path", async ({ page }) => {
  const j = journey(page)
  let requests = 0
  let release!: () => void
  const held = new Promise<void>(resolve => { release = resolve })
  await j.boot("/Transitions/Knee-Slice-Pass", { initialState: readingState, beforeNavigate: async () => {
    await page.route("**/Transitions/Knee-Slice-Pass/Attacker", async route => {
      requests++
      if (requests === 1) await held
      return requests === 1 ? route.fulfill({ status: 503, body: "Unavailable" }) : route.continue()
    })
  } })
  await expect(page.locator("[data-reader] [role=status]")).toHaveText("Loading the complete article…")
  await expect(page.locator("[data-reader-article]")).toHaveCount(0)
  release()
  await j.advance(5000)
  await expect(page.locator("[data-reader] [role=alert]")).toContainText("503")
  await j.clickByMouse("[data-reader-retry]", "retry the failed full article")
  await expect(page.locator(READER)).toBeVisible()
  expect(requests).toBe(2)
  await expect(page.locator('[data-reader-article="guide"]')).toContainText("Training Progressions")
})

test("@curated Back retires an in-flight article instead of repainting the current page", async ({ page }) => {
  const j = journey(page)
  await j.boot("/Transitions/Knee-Slice-Pass", { initialState: readingState })
  await j.advance(5000)
  await expect(page.locator(READER)).toBeVisible()
  let release!: () => void
  const held = new Promise<void>(resolve => { release = resolve })
  let requested = false
  let settled = false
  const settledRequest = (request: { url(): string }) => {
    if (new URL(request.url()).pathname === "/Transitions/Knee-Slice-Pass/Defender") settled = true
  }
  page.on("requestfinished", settledRequest)
  page.on("requestfailed", settledRequest)
  await page.route("**/Transitions/Knee-Slice-Pass/Defender", async route => {
    requested = true
    await held
    await route.continue().catch(() => {})
  })
  await j.clickByMouse('[aria-label="Reading perspectives"] a[href$="/Defender"]')
  await expect.poll(() => requested).toBe(true)
  await page.goBack()
  await expect(page.locator(READER)).toHaveAttribute("data-reader-path", "/Transitions/Knee-Slice-Pass")
  release()
  await expect.poll(() => settled, { message: "the old request finished or was aborted before checking its paint" }).toBe(true)
  await page.waitForTimeout(100)
  await expect(page.locator(READER)).toHaveAttribute("data-reader-path", "/Transitions/Knee-Slice-Pass")
  await expect(page.locator('[data-reader-article="guide"]')).toHaveAttribute("data-source-path", "/Transitions/Knee-Slice-Pass/Attacker")
})

test("@curated a slower article never replaces a later Browse selection in the same reader", async ({ page }) => {
  const j = journey(page)
  await j.boot("/Transitions/Knee-Slice-Pass", { initialState: readingState })
  await j.advance(5000)
  await expect(page.locator(READER)).toBeVisible()
  await page.evaluate(() => {
    const w = window as any, reader = w.__racingReader = w.__neural._reader
    const open = reader.open
    // Observe the real operation, including its paint, not just the network event.
    reader.open = function (request: any) {
      const done = open.call(this, request)
      if (request.path === "/Transitions/Knee-Slice-Pass/Defender") w.__slowArticle = done
      return done
    }
  })
  let release!: () => void
  const held = new Promise<void>(resolve => { release = resolve })
  let requested = false, settled = false
  const settledRequest = (request: { url(): string }) => {
    if (new URL(request.url()).pathname === "/Transitions/Knee-Slice-Pass/Defender") settled = true
  }
  page.on("requestfinished", settledRequest)
  page.on("requestfailed", settledRequest)
  await page.route("**/Transitions/Knee-Slice-Pass/Defender", async route => {
    requested = true
    await held
    await route.continue().catch(() => {})
  })
  await j.clickByMouse('[aria-label="Reading perspectives"] a[href$="/Defender"]')
  await expect.poll(() => requested).toBe(true)
  await j.clickByMouse(".ng-logo", "Browse while the previous article is still loading")
  await j.clickByMouse('[data-view="explore"]', "the Browse tab")
  await expect(page.locator(".ng-explorer-search input")).toBeVisible()
  await page.locator(".ng-explorer-search input").fill("Mount")
  // Alias/Systems hydration rebuilds these rows. In the failed dev deploy it
  // moved Mount's measured centre onto Mount to Armbar before pointerdown. Wait
  // for both actual payloads before measuring; keep the real mouse and exact ID.
  await expect.poll(() => page.evaluate(() => {
    const a = (window as any).__neural
    return !!a._aliasesReady && a.systems?.length > 0 && !a._systemsLoading
  }), { message: "Browse hydration finishes before measuring the Mount row" }).toBe(true)
  await expect(page.locator("[data-alias-status], [data-systems-status]")).toHaveCount(0)
  await j.clickByMouse('div:has(> [data-list-surface="explore"][data-list-add="Positions/Mount"]) > button:first-child')
  await expect(page.locator(READER)).toHaveAttribute("data-reader-path", "/Positions/Mount")
  expect(await page.evaluate(() => (window as any).__racingReader === (window as any).__neural._reader), "both navigations use the same live reader").toBe(true)
  release()
  await expect.poll(() => settled).toBe(true)
  await page.evaluate(async () => {
    const done = (window as any).__slowArticle
    if (!done) throw new Error("The held Defender article must have a real reader operation")
    await done
  })
  await expect(page.locator(READER)).toHaveAttribute("data-reader-path", "/Positions/Mount")
  await expect(page.locator('[data-reader-article="guide"]'), "the completed old Defender request cannot repaint the later Mount selection")
    .toHaveAttribute("data-source-path", "/Positions/Mount/Top")
})

test("@curated a failed reader module remains retryable without substituting another page", async ({ page }) => {
  const j = journey(page)
  let requests = 0
  await j.boot("/Transitions/Knee-Slice-Pass", { initialState: readingState, beforeNavigate: async () => {
    await page.route("**/app/reader.js?*", route => ++requests === 1 ? route.abort() : route.continue())
  } })
  await expect(page.locator('[data-reader-load-retry]')).toBeVisible()
  expect(await page.evaluate(() => (window as any).__neural.optionIdxs.length)).toBe(0)
  await j.clickByMouse('[data-reader-load-retry]')
  await expect(page.locator(READER)).toHaveAttribute('data-reader-path', '/Transitions/Knee-Slice-Pass')
  await expect(page.locator('[data-reader-article="guide"]')).toContainText('Training Progressions')
  expect(requests).toBe(2)
})

// Ported from neural_reading_content.test.mjs when the unreachable Inspect renderer retired.
for (const role of ["Attacker", "Defender"]) {
  test(`@curated the published ${role} reader preserves a complete long overview and authored outcomes`, async ({ page }) => {
    const j = journey(page), path = "/Transitions/Knee-Slice-Pass/" + role
    const overview = "First sentence. " + "Further authored context. ".repeat(30) + "FINAL OVERVIEW SENTENCE."
    const outcome = role === "Defender" ? "Authored escape destination" : "Authored attack destination"
    let served = 0
    await j.boot(path, { initialState: readingState, beforeNavigate: async () => {
      await page.route(url => url.pathname === path, async route => {
        // The reader seeds its cache from the navigation document. Replace that
        // document's article too, keeping the real app shell and boot scripts.
        const response = await route.fetch(), source = await response.text()
        const fixture = '<section id="overview"><h2>Overview</h2><p>' + overview + '</p></section><section id="best-outcomes"><h2>Best outcomes</h2><ul><li>' + outcome + '</li></ul></section>'
        expect(source.match(/<article\b/g)).toHaveLength(1)
        const body = source.replace(/(<article\b[^>]*>)[\s\S]*?(<\/article>)/, (_, open, close) => open + fixture + close)
        served++
        await route.fulfill({ response, body })
      })
    } })
    expect(served, "the long article fixture actually reached the reader").toBeGreaterThan(0)
    await expect(page.locator(READER)).toBeVisible()
    const guide = page.locator('[data-reader-article="guide"]')
    await expect(guide.locator('[data-source-id="overview"] p')).toHaveText(overview.trim())
    await expect(guide).toContainText(outcome)
    await expect(guide).not.toContainText(role === "Defender" ? "Authored attack destination" : "Authored escape destination")
  })
}
