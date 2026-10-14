import { test, expect } from "@playwright/test"
import { journey } from "../dsl"

/** #289 replaces the abridged More renderer with complete published articles.
 * The old folded/pinned virtual-column assertions are superseded by the reader
 * journeys; the independent option-sheet late-dossier assertion remains below.
 * These tests compare against authored HTML, not a second dossier renderer.
 * MDP-sandbox mutation evidence is recorded in reading-mode.spec.ts.
 */

type Dossier = Record<string, any>
const LONG_CUE = "Preserve the connection while your partner changes direction, keeping the near elbow and knee aligned before moving your weight. ".repeat(3) + "THE ENTIRE CUE ENDS HERE."
const SAFETY = {
  notice: "Practise only with qualified supervision; release immediately when your partner taps.",
  risks: Array.from({ length: 5 }, (_, i) => ({ i: `Authored injury risk ${i + 1}`, sev: i ? "moderate" : "severe" })),
  speed: "Apply controlled pressure and leave your partner time to signal. ".repeat(5) + "FINAL APPLICATION SENTENCE.",
  tap: Array.from({ length: 5 }, (_, i) => `Tap signal ${i + 1}: stop as soon as this signal is recognised.`),
  release: Array.from({ length: 5 }, (_, i) => `Release action ${i + 1}: maintain control while removing all finishing pressure.`),
  restrictions: ["Training restriction one: use a qualified supervisor.", "FINAL TRAINING RESTRICTION: do not continue after a stop signal."],
}

const technique = (): Dossier => ({
  cat: "Submission", lead: "A submission-specific authored definition.",
  aka: ["Own variant alias"],
  family: { name: "Ezekiel Choke", aka: ["Sode Guruma Jime", "Family's second alias"], confuse: [{ n: "A different choke", why: "Its finishing grip differs." }] },
  kind: { cat: "Choke", type: "Blood choke", area: "Carotid arteries" },
  safety: SAFETY,
  outcomes: [{ result: "Success", position: "Game Over", prob: 55, tone: "good" }],
  related: ["Related technique sentinel"],
  variations: ["Alternate grip"], varNote: { "Alternate grip": "Use when the sleeve is available." },
  perspectives: {
    attacker: {
      summary: "ATTACKER ONLY summary.", recognition: ["ATTACKER ONLY recognition."],
      prerequisites: ["ATTACKER ONLY prerequisite."],
      steps: Array.from({ length: 8 }, (_, i) => `Execution step ${i + 1}: ${i === 7 ? LONG_CUE : "Preserve a stable connection."}`),
      principles: ["ATTACKER ONLY principle."], counters: ["ATTACKER ONLY counter."],
      mistakes: [{ err: "ATTACKER ONLY mistake.", fix: "ATTACKER ONLY correction." }],
    },
    defender: {
      authored: true, summary: "DEFENDER ONLY summary.", recognition: ["DEFENDER ONLY recognition."],
      principles: ["DEFENDER ONLY principle."],
      options: [{ move: "Recover the defensive frame", when: "Before the grip closes", leadsTo: "Guard recovery" }],
      mistakes: [{ err: "DEFENDER ONLY mistake.", fix: "DEFENDER ONLY correction." }],
      bestOutcomes: ["ATTACKER OUTCOME MUST NOT LEAK"],
    },
  },
})

test("@curated a cold option sheet gains its own dossier without replacing the drill or scroll position", async ({ page }) => {
  const j = journey(page)
  await j.boot()
  await j.land("Mount Top")
  const target = await page.evaluate(() => {
    const w = window as any, a = w.__neural
    const option = a._optionCards.find((c: any) => !c.esc && !c.opt.threat)
    if (!option) throw new Error("The real hand must contain a selectable technique")
    option.card.setAttribute("data-more-test-option", "1")
    const key = option.node.t
    delete (w.NG_CONTENT?.decks || {})[key]
    delete (a._contentWaits || {})[key]
    return { key, filename: a.qhash(key) + ".json", deck: a.deckKeyFor(option.node).key, cat: a.deckCat(option.node) }
  })
  await j.hydrate([target.deck])
  let release!: () => void
  const held = new Promise<void>((resolve) => { release = resolve })
  let requests = 0
  const dossier = technique()
  dossier.cat = target.cat
  if (target.cat !== "Submission") { delete dossier.safety; delete dossier.kind }
  await page.route(`**/content/${target.filename}`, async (route) => {
    requests++
    await held
    await route.fulfill({ json: { [target.key]: dossier } })
  })
  await j.clickByMouse("[data-more-test-option] [data-choice-inspect]", "Inspect on the first real technique in the hand")
  await expect.poll(() => requests, { message: "the sheet's own dossier request is held" }).toBe(1)
  await expect(page.locator("[data-jit]")).toBeVisible()
  const before = await page.evaluate(() => {
    const w = window as any, a = w.__neural
    const jit = document.querySelector("[data-jit]") as HTMLElement
    const scroll = jit.parentElement!
    scroll.scrollTop = 37
    w.__moreSheetJit = jit
    w.__moreSheetJitHTML = jit.outerHTML
    w.__moreSheetScroll = scroll
    return { scroll: scroll.scrollTop, owner: a._detailCtx.contentKey }
  })
  expect(before.owner).toBe(target.key)
  expect(before.scroll, "the cold sheet really is scrolled before the response").toBeGreaterThan(0)
  release()
  await expect(page.locator("[data-sheet-steps]")).toContainText("Execution step 8:")
  expect(await page.evaluate(() => {
    const w = window as any
    return {
      sameDrill: w.__moreSheetJit === document.querySelector("[data-jit]"),
      sameQuestion: w.__moreSheetJitHTML === w.__moreSheetJit.outerHTML,
      scroll: w.__moreSheetScroll.scrollTop,
    }
  })).toEqual({ sameDrill: true, sameQuestion: true, scroll: before.scroll })
  await j.clickByMouse('.ng-pt[data-p="defender"]', "the defender tab added by the late dossier")
  await expect(page.locator("[data-sheet-options]")).toContainText("Recover the defensive frame")
  await expect(page.locator("[data-sheet-steps]")).toHaveCount(0)
  await expect(page.locator("[data-sheet-aka]")).toContainText("Own variant alias")
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
  await j.boot("/Transitions/Knee-Slice-Pass", { initialState: readingState, beforeNavigate: async () => {
    await page.route("**/Transitions/Knee-Slice-Pass/Attacker", route => {
      requests++
      return requests === 1 ? route.fulfill({ status: 503, body: "Unavailable" }) : route.continue()
    })
  } })
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
  await page.evaluate(() => { (window as any).__racingReader = (window as any).__neural._reader })
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
  await j.clickByMouse('div:has(> [data-list-surface="explore"][data-list-add="Positions/Mount"]) > button:first-child')
  await expect(page.locator(READER)).toHaveAttribute("data-reader-path", "/Positions/Mount")
  expect(await page.evaluate(() => (window as any).__racingReader === (window as any).__neural._reader), "both navigations use the same live reader").toBe(true)
  release()
  await expect.poll(() => settled).toBe(true)
  await page.waitForTimeout(100)
  await expect(page.locator('[data-reader-article="guide"]')).toHaveAttribute("data-source-path", "/Positions/Mount/Top")
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
