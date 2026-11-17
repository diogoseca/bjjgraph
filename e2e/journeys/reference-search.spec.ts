import { expect, test, type BrowserContext, type Page } from "@playwright/test"
import { journey } from "../dsl"

/**
 * SEARCH OPENS SEARCH, ON A REFERENCE PAGE TOO (REFSEARCH, v1.290.1; the third read of PR #432, faults dev had all along).
 * On a principle, a system and a learning page:
 *  1. a search typed before the reader's own file landed was wiped when it landed, and the focus jumped to the article's
 *     heading (4 of 4 with `reader.js` held): the reader's `open` emptied the query and focused the heading;
 *  2. a late press on the search button opened the page's entry with no search row and nothing focused (6 of 6);
 *  3. a late "/" did nothing while the focus was in the article (3 of 3): the reader's root stopped the key.
 * The rule (the orchestrator's): on every page kind, search opens search: the panel, the search row, the caret in it,
 * whatever the page shows; the page's own entry may show under an empty query and gives way to results as soon as something
 * is typed; and what the player typed is never taken away by something that lands later. The reader may move the focus to
 * the article's heading only when the player has not put it somewhere themselves.
 * Every press is real (a mouse click at 1440x900, a touch tap at 390x631, at the measured centre, hit-tested), the keys are
 * typed, and the focus and the caret are read from the DOM (`document.activeElement`, `selectionStart`). An early press is
 * made on a HELD `graph-data.json`; the reader's late landing is forced by holding `app/reader.js`, never raced.
 * Kept, each with a step: Esc, the entry's own back row, the article's heading taking the focus on a plain arrival (a
 * screen-reader user lands on the page's name), and the article keeping its other keys (Space pages it).
 * Mutants (the seat's mutantsS.py, run 17 Nov 15:57-16:03; the control C0 green, 28 of 28 here), each red at the step named:
 * the reader emptying the query of an open panel again → "the typed query survives the reader's landing"; the search row
 * hidden on an entry again → "the search row shows"; the search's keys stopped in the article again → "a late ask for
 * search opens the panel" and "Ctrl+K opens the panel"; the heading taking the focus from the search field → "the caret
 * stays in the search field when the reader lands"; `_searchAsked` never lifted → "with no search row: search is asked
 * for by the search button and its keys, not by the logo"; the heading never focused → "with no press, the article's
 * heading has the focus"; the reader stopping no key → "a key that is not the search's stays in the article: Space pages
 * it". NON-KILL, recorded: the search row's own blur when it hides (`_syncExploreTools`) removed stays green here and in
 * early-presses (6 of 6): the browser moves the focus off a hidden field by itself at its next rendering step, nearly
 * always before a state is read (the one red it explains: 1 in 266 runs of early-presses' early = late step, before it).
 */

type W = Window & { __neural: any }
async function press(page: Page, selector: string, what: string, touch: boolean) {
  const at = await page.evaluate((sel) => {
    const el = [...document.querySelectorAll(sel)].find((e) => (e as HTMLElement).getClientRects().length && getComputedStyle(e).visibility !== "hidden") as HTMLElement | undefined
    if (!el) return { ok: false, why: "no element matches", x: 0, y: 0 }
    const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2
    const top = document.elementFromPoint(x, y)
    return { ok: !!top && (top === el || el.contains(top)), why: top ? "<" + top.tagName.toLowerCase() + " " + (top as HTMLElement).className + ">" : "nothing", x, y }
  }, selector)
  expect(at.ok, `${what}: the point under the press is the control (${at.why})`).toBe(true)
  if (touch) await page.touchscreen.tap(at.x, at.y)
  else await page.mouse.click(at.x, at.y)
}
async function bootHeld(page: Page, path: string, holds: string[] = ["graph-data.json"]) {
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))
  const j = journey(page)
  await j.boot(path, { unready: true, payloads: Object.fromEntries(holds.map((h) => [h, { never: true }])) })
  await expect(page.locator(".ng-search"), "premise: the search button is on screen").toBeVisible({ timeout: 20_000 })
  if (holds.includes("graph-data.json"))
    expect(await page.evaluate(() => Array.isArray((window as W).__neural?.nodes)), "premise: the map's data has not landed").toBe(false)
  return { j, errors }
}
const landed = (page: Page) => expect.poll(() => page.evaluate(() => Array.isArray((window as W).__neural?.nodes) && (window as W).__neural.nodes.length > 0),
  { message: "the map's data lands", timeout: 30_000 }).toBe(true)
// the reference page has settled: the reader is in, its article is laid out (the heading focus, if any, is taken in that
// same task) and the page's record has landed
const settled = (page: Page) => expect.poll(() => page.evaluate(() => {
  const a = (window as W).__neural, root = document.querySelector("[data-reader-path]") as HTMLElement | null
  return !!a._reader && !!a._reader.reference && !!root && root.dataset.readerReady === "true"
}), { message: "the reference page has settled (the reader in, its article laid out, its record landed)", timeout: 20_000 }).toBe(true)
const state = (page: Page) => page.evaluate(() => {
  const a = (window as W).__neural, inp = a.explorerSearchRef.current as HTMLInputElement, list = a.explorerListRef.current as HTMLElement
  const tools = a.explorerToolsRef.current as HTMLElement, at = document.activeElement as HTMLElement | null
  const entry = list?.querySelector("[data-concept-detail], [data-system-detail]")
  const article = document.querySelector("[data-reader-path]")
  return {
    shown: !!a.deckShown,
    body: !a.deckShown ? null : entry ? (entry.hasAttribute("data-system-detail") ? "system " + entry.getAttribute("data-system-detail") : "entry " + entry.getAttribute("data-concept-detail"))
      : (a._exQ || "").trim() ? "results" : "list",
    rows: a.deckShown && (a._exQ || "").trim() ? list.children.length : null,
    searchRow: !!tools && getComputedStyle(tools).display !== "none",
    caretInSearch: at === inp,
    caret: at === inp ? inp.selectionStart : null,
    value: inp ? inp.value : null,
    query: a._exQ || "",
    focus: !at || at === document.body ? "the page" : at === inp ? "the search field" : article && article.contains(at) ? "the article: " + at.tagName.toLowerCase() : at.tagName.toLowerCase(),
  }
})

const PAGES = [
  { path: "/Principles/Frames", what: "a principle page", back: "[data-concept-back]" },
  { path: "/Systems/10th-Planet-No-Gi-Guard-System", what: "a system page", back: "[data-system-back]" },
  { path: "/Learning/BJJ-Guard-Types-Explained", what: "a learning page", back: "[data-concept-back]" },
]

// An early ask for search, then the same page fresh with a late one: both end states, and the late page left open.
async function earlyThenLate(page: Page, context: BrowserContext, path: string, ask: (p: Page, what: string) => Promise<void>) {
  const early = await bootHeld(page, path)
  await ask(page, "early")
  await page.waitForTimeout(300)
  expect(early.errors, "no page error while the data is held").toEqual([])
  await early.j.releasePayload("graph-data.json")
  await landed(page)
  await settled(page)
  const a = await state(page)
  expect(early.errors, "no page error").toEqual([])
  await page.close()
  const p2 = await context.newPage()
  const late = await bootHeld(p2, path)
  await late.j.releasePayload("graph-data.json")
  await landed(p2)
  await settled(p2)
  const arrival = await state(p2)
  await ask(p2, "late")
  await expect.poll(() => p2.evaluate(() => !!(window as W).__neural.deckShown), { message: "a late ask for search opens the panel" }).toBe(true)
  const b = await state(p2)
  expect(late.errors, "no page error on the late ask").toEqual([])
  return { a, b, arrival, p2 }
}
function expectSearch(s: Awaited<ReturnType<typeof state>>, when: string) {
  expect(s.shown, `${when}: the panel is open`).toBe(true)
  expect(s.searchRow, `${when}: the search row shows`).toBe(true)
  expect(s.caretInSearch, `${when}: the caret is in the search field (the focus is on ${s.focus})`).toBe(true)
  expect(s.caret, `${when}: the caret at the start of an empty field`).toBe(0)
  expect(s.body, `${when}: the page's own entry shows under the empty query`).toMatch(/^(entry|system) /)
}

for (const touch of [false, true]) {
  const tag = touch ? "touch 390x631" : "mouse 1440x900"
  test.describe(tag, () => {
    test.use(touch ? { hasTouch: true, isMobile: true, viewport: { width: 390, height: 631 } } : { viewport: { width: 1440, height: 900 } })

    for (const pg of PAGES) {
      test(`the search button opens search on ${pg.what}, early as late, and the entry gives way to what is typed (${tag})`, async ({ page, context }) => {
        const { a, b, p2 } = await earlyThenLate(page, context, pg.path, (p, what) => press(p, ".ng-search", `the search button, ${what}`, touch))
        expectSearch(b, "a late press on the search button")
        expect(a, "the early press ends where the late press ends").toEqual(b)
        await expect(p2.locator(pg.back), "the entry's own back row is still there, under the search row").toBeVisible()
        // typed: results. Emptied again: the root list (a typed query leaves the entry, as any search does on dev: the
        // list's render with a query clears the page's id), the search row and the caret still there
        await p2.keyboard.type("arm", { delay: 20 })
        const typed = await state(p2)
        expect(typed.value, "what is typed goes into the search field").toBe("arm")
        expect(typed.body, "the entry gives way to results as soon as something is typed").toBe("results")
        expect(typed.rows, "and there are results").toBeGreaterThan(0)
        for (let i = 0; i < 3; i++) await p2.keyboard.press("Backspace")
        const emptied = await state(p2)
        expect([emptied.value, emptied.body], "emptied again, the list shows").toEqual(["", "list"])
        expect([emptied.searchRow, emptied.caretInSearch], "and the search row stays, the caret in it").toEqual([true, true])
      })

      // `_searchAsked` has one lifter, the panel shutting: after it, the logo opens the entry as it always did
      test(`after search, the panel shut and opened by the logo shows ${pg.what}'s entry with no search row (${tag})`, async ({ page }) => {
        const { j, errors } = await bootHeld(page, pg.path)
        await j.releasePayload("graph-data.json")
        await landed(page)
        await settled(page)
        await press(page, ".ng-search", "the search button", touch)
        expectSearch(await state(page), "premise, after the search button")
        await press(page, ".ng-explorer-close", "the panel's ✕", touch)
        await expect.poll(() => page.evaluate(() => !!(window as W).__neural.deckShown), { message: "premise: the panel is shut" }).toBe(false)
        await press(page, ".ng-logo", "the logo", touch)
        await expect.poll(() => page.evaluate(() => !!(window as W).__neural.deckShown), { message: "the logo opens the panel" }).toBe(true)
        const s = await state(page)
        expect(s.body, "the logo opens the page's own entry").toMatch(/^(entry|system) /)
        expect(s.searchRow, "with no search row: search is asked for by the search button and its keys, not by the logo").toBe(false)
        // kept: the entry's own back row leads to the root list, which has its search row
        await press(page, pg.back, "the entry's back row", touch)
        const root = await state(page)
        expect([root.body, root.searchRow], "the entry's back row leads to the root list, with its search row").toEqual(["list", true])
        expect(errors, "no page error").toEqual([])
      })

      // What the player typed before the reader's own file landed is theirs: the reader is HELD (`app/reader.js`), so its
      // landing comes after the typing by construction
      test(`a search typed on ${pg.what} before the reader lands is kept when it lands, the caret with it (${tag})`, async ({ page }) => {
        const { j, errors } = await bootHeld(page, pg.path, ["graph-data.json", "app/reader.js"])
        await press(page, ".ng-search", "the search button, early", touch)
        await j.releasePayload("graph-data.json")
        await landed(page)
        await expect.poll(() => state(page).then((s) => s.caretInSearch), { message: "premise: the panel is open on its search, the caret in it" }).toBe(true)
        await page.keyboard.type("arm", { delay: 20 })
        const typed = await state(page)
        expect([typed.value, typed.body], "premise: \"arm\" is typed and its results show").toEqual(["arm", "results"])
        expect(await page.evaluate(() => !!(window as W).__neural._reader), "premise: the reader has not landed").toBe(false)
        await j.releasePayload("app/reader.js")
        await settled(page)
        const after = await state(page)
        expect([after.value, after.query], "the typed query survives the reader's landing").toEqual(["arm", "arm"])
        expect(after.caretInSearch, `the caret stays in the search field when the reader lands (the focus is on ${after.focus})`).toBe(true)
        expect(after.caret, "the caret after what was typed").toBe(3)
        expect([after.body, after.searchRow], "the results and the search row stay").toEqual(["results", true])
        // not a count against the one before: the result list pages itself in and starts over on a re-render, so its row
        // count moves both ways by itself (42 then 61 in one run, 61 then 42 in another)
        expect(after.rows, "and there are results in it").toBeGreaterThan(0)
        expect(errors, "no page error").toEqual([])
      })

      // Kept: with no press, the article's heading takes the focus on arrival (a screen-reader user lands on the page's
      // name), and the article still keeps every key but Esc, the game's and the search's to itself
      test(`a plain arrival on ${pg.what} ends on the article's heading, and the article keeps its other keys (${tag})`, async ({ page }) => {
        const { j, errors } = await bootHeld(page, pg.path)
        await j.releasePayload("graph-data.json")
        await landed(page)
        await settled(page)
        const s = await state(page)
        expect(s.focus, "with no press, the article's heading has the focus").toBe("the article: h1")
        expect(s.shown, "and the panel is shut").toBe(false)
        // Space is the article's own key: it pages the reading column. The app's key handler would take it (it prevents
        // Space's default everywhere but on a focused control), so the article scrolling shows the reader kept the key.
        const top = () => page.evaluate(() => (document.querySelector("[data-reader-path]") as HTMLElement).scrollTop)
        expect(await top(), "premise: the article is at its top").toBe(0)
        await page.keyboard.press("Space")
        await expect.poll(top, { message: "a key that is not the search's stays in the article: Space pages it", timeout: 5_000 }).toBeGreaterThan(0)
        expect((await state(page)).focus, "and the focus stays on the heading").toBe("the article: h1")
        expect(errors, "no page error").toEqual([])
      })
    }
  })
}

// keys are a desktop's
test.describe("keys, 1440x900", () => {
  test.use({ viewport: { width: 1440, height: 900 } })
  for (const pg of PAGES) {
    test(`"/" opens search on ${pg.what}, early as late, from the article too`, async ({ page, context }) => {
      const { a, b, arrival, p2 } = await earlyThenLate(page, context, pg.path, (p) => p.keyboard.press("/"))
      expect(arrival.focus, "premise: before the late \"/\" the focus is in the article, on its heading").toBe("the article: h1")
      expectSearch(b, "a late \"/\" from the article")
      expect(a, "the early \"/\" ends where the late \"/\" ends").toEqual(b)
      expect(b.value, "and the \"/\" itself is not typed into the field").toBe("")
      await p2.keyboard.press("Escape")
      await expect.poll(() => p2.evaluate(() => !!(window as W).__neural.deckShown), { message: "Esc shuts the panel" }).toBe(false)
    })
  }
  test("Ctrl+K opens search from the article of a principle page", async ({ page }) => {
    const { j, errors } = await bootHeld(page, PAGES[0].path)
    await j.releasePayload("graph-data.json")
    await landed(page)
    await settled(page)
    expect((await state(page)).focus, "premise: the focus is on the article's heading").toBe("the article: h1")
    await page.keyboard.press("Control+k")
    await expect.poll(() => page.evaluate(() => !!(window as W).__neural.deckShown), { message: "Ctrl+K opens the panel" }).toBe(true)
    expectSearch(await state(page), "Ctrl+K from the article")
    expect(errors, "no page error").toEqual([])
  })
})
