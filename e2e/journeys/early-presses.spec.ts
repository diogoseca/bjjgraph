import { expect, test, type BrowserContext, type Page } from "@playwright/test"
import { journey } from "../dsl"

/**
 * A PRESS BEFORE THE MAP'S DATA HAS LANDED (EARLY1, v1.288.1; found on production by the orchestrator's probes).
 * The logo and the search button are on screen before the graph is ingested. A press then ran the list's build over
 * `this.nodes` (undefined): the page threw "this.nodes is not iterable" and the panel stayed shut, also after the data
 * landed (`ingest` resets the drawer). The rule: such a press is never lost and never throws; it ends in exactly the state
 * a late press on the same page ends in, on every kind of page, and `pane_opened` is sent once, for a panel the player can
 * see; a second press on the logo, Esc, or a navigation says otherwise.
 * EARLY1-R1 (the reader of #432): the first build honoured the press before the URL seeded the page, and a reading
 * arrival shut the drawer again in the same task, so on a position or concept page an early press opened nothing (4 of 4);
 * these journeys booted only "/". Now each one compares an early press with a late press on the same page, on a fresh page
 * of the same context, on the home page, a position, a technique, a principle, a system, a learning page and a hub; the
 * end state includes the drawer's body (EARLY1-R2: on a reference page the early press ended on the root list where a late
 * press ends on the page's entry). On a page that opens the panel
 * itself (a hub), a late press would close it, so there the early press is compared with no press: the panel as the page
 * opened it, and one `pane_opened`.
 * Every early press is made on a HELD graph (`graph-data.json`, `never`), so it comes before the data by construction,
 * never by a race; by a real mouse at 1440x900 and by touch at 390x631, at the measured centre, hit-tested.
 * FAULT 2 (the reader of PR #430, 4b): Master the game opened in the first seconds after a load was ended by the intro's
 * deal of the first roll (6 of 6 on "/" by real presses on a real clock). Its journey holds the intro's clock with the
 * test-mode pump instead of a request: the cause is a deal on a clock.
 * Mutants (the seat's mutantsR2.py, run 17 Nov 13:09-13:16, each red at the step named; the control C0 green, 30 of 30):
 * toggleExplorer's early branch removed → "the early press ends where a late press ends" (its press falls to `openPane`'s
 * branch and is replayed without the logo's focus) and "the second press takes the pressed look back too"; openSearchPane's
 * → "the control shows the press was taken"; the take-back removed → "the second press takes the pressed look back too";
 * dev's reset back in the intro's deal → "Master the game is still open after the first roll is dealt"; the honour moved
 * back before the seed → "the early press ends where a late press ends" on the position, technique and principle pages;
 * the page check removed → "a navigation drops the press"; the page read with its query → "a stripped ?code= keeps the
 * press"; the deal's argument ignored → "a later deal ends the session"; Esc's branch removed → "Esc takes the pressed
 * look back"; the pressed look never set → "the control shows the press was taken"; the panel-already-open check
 * removed → "the early press leaves the panel as the page opened it" (the hub); the search replayed as the logo → "the
 * early press ends where a late press ends" (the search button, touch); the reference page's re-render removed
 * (`_referenceLanded`) → "the early press ends where a late press ends" on the principle, system and learning pages.
 * NON-KILL, recorded: openPane's own early branch removed stays green (30 of 30), because no early input reaches it (the
 * logo and the search have their own); it stands for any later caller.
 * REFSEARCH-2: the node pages below, and an early search on a page that opens the panel itself (the hub).
 * Mutants (mutantsS.py, 17 Nov 15:57-16:03; the control C0 green, 38 of 38 here): a roll's first landing rebuilding a shown
 * session's panel again, the reader's seat resetting the session again, and the reader's seat not marked as an arrival →
 * each red at "Master the game is still open after the page's own first landing" (position, technique, submission); a
 * player's own roll keeping a shown session → "a roll the player starts ends the session"; the early search dropped on
 * an open panel → "the early press ends where a late press ends" (the search button on a hub). NON-KILL, recorded: the
 * intro's URL seat not marked as an arrival stays green (8 of 8): no page reaches it while reading is the default on
 * every content address (`NG_READING_DEFAULT_ON_CONTENT_URL`), so the reader's seat is the only arrival there is today.
 */

type W = Window & { __neural: any }
async function press(page: Page, selector: string, what: string, touch: boolean) {
  const at = await page.evaluate((sel) => {
    const el = [...document.querySelectorAll(sel)].find((e) => (e as HTMLElement).getClientRects().length) as HTMLElement | undefined
    if (!el) return { ok: false, why: "no element matches", x: 0, y: 0 }
    const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2
    const top = document.elementFromPoint(x, y)
    return { ok: !!top && (top === el || el.contains(top)), why: top ? "<" + top.tagName.toLowerCase() + " " + (top as HTMLElement).className + ">" : "nothing", x, y }
  }, selector)
  expect(at.ok, `${what}: the point under the press is the control (${at.why})`).toBe(true)
  if (touch) await page.touchscreen.tap(at.x, at.y)
  else await page.mouse.click(at.x, at.y)
}
async function bootHeld(page: Page, path = "/") {
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))
  const j = journey(page)
  await j.boot(path, { unready: true, payloads: { "graph-data.json": { never: true } } })
  await expect(page.locator(".ng-logo"), "premise: the logo is on screen").toBeVisible({ timeout: 20_000 })
  expect(await page.evaluate(() => Array.isArray((window as W).__neural?.nodes)), "premise: the map's data has not landed").toBe(false)
  return { j, errors }
}
const landed = (page: Page) => expect.poll(() => page.evaluate(() => Array.isArray((window as W).__neural?.nodes) && (window as W).__neural.nodes.length > 0),
  { message: "the map's data lands", timeout: 30_000 }).toBe(true)
// the page has settled: a reading arrival imports the reader, so wait until it is in (or was never asked for); on a
// reference page (a principle, a learning page, a system) also until its record has landed (`_reader.reference`, EARLY1-R2)
const settled = (page: Page) => expect.poll(() => page.evaluate(() => {
  const a = (window as W).__neural
  if (a._readerFailed || !a._readerRequest) return true
  if (!a._reader) return false
  return !/^\/(Principles|Learning|Systems)\//i.test(location.pathname) || !!a._reader.reference
}), { message: "the page has settled (the reader, if asked for, is in, and a reference page's record has landed)", timeout: 20_000 }).toBe(true)
const shown = (page: Page) => page.evaluate(() => !!(window as W).__neural.deckShown)
const busy = (page: Page, selector: string) => page.evaluate((sel) => document.querySelector(sel)?.getAttribute("aria-busy") === "true", selector)
// the end state a press leaves, read the same way for an early and a late press
const endState = (page: Page) => page.evaluate(() => {
  const a = (window as W).__neural
  const funnel = ((a.csBeats || []) as any[]).filter((b) => b.beat === "funnel").map((b) => b.step)
  return {
    shown: !!a.deckShown,
    view: a.deckShown ? a._viewMode : null,
    drill: a.deckShown ? a._drillView : null,
    reading: !!a._readerIntent,
    readerPath: a._readerRequest ? a._readerRequest.path : null,
    searchFocused: document.activeElement === a.explorerSearchRef.current,
    // the drawer's body (EARLY1-R2): Explore's root list, or the entry it shows, and which
    body: (() => {
      if (!a.deckShown) return null
      const list = a.explorerListRef?.current, entry = list?.querySelector("[data-concept-detail], [data-system-detail]")
      if (entry) return entry.hasAttribute("data-system-detail") ? "system " + entry.getAttribute("data-system-detail") : "entry " + entry.getAttribute("data-concept-detail")
      return list && list.children.length ? "list" : "empty"
    })(),
    searchRow: !!a.explorerToolsRef?.current && getComputedStyle(a.explorerToolsRef.current).display !== "none",
    paneOpened: funnel.filter((s) => s === "pane_opened").length,
    pressedLook: document.querySelectorAll(".ng-logo[aria-busy], .ng-search[aria-busy]").length,
  }
})

// One early press on `control` on `path`, then the same page fresh with a late press (or none, where the page opens the
// panel itself), and the two end states compared.
async function earlyThenLate(page: Page, context: BrowserContext, path: string, control: { sel?: string; key?: string; what: string }, touch: boolean) {
  const doPress = (p: Page, what: string) => (control.key ? p.keyboard.press(control.key) : press(p, control.sel!, what, touch))
  const early = await bootHeld(page, path)
  await doPress(page, control.what)
  await page.waitForTimeout(300)
  expect(early.errors, "no page error while the data is held").toEqual([])
  expect(await busy(page, control.sel || ".ng-search"), "the control shows the press was taken").toBe(true)
  await early.j.releasePayload("graph-data.json")
  await landed(page)
  await settled(page)
  const a = await endState(page)
  expect(early.errors, "no page error").toEqual([])
  await page.close()

  const p2 = await context.newPage()
  const late = await bootHeld(p2, path)
  await late.j.releasePayload("graph-data.json")
  await landed(p2)
  await settled(p2)
  const opensItself = await shown(p2)
  // a page that opens the panel itself: a late LOGO press would shut it, so the logo is compared with no press. A search
  // asks for the search, which an open panel is not, so it is asked for late there too (REFSEARCH): the open panel
  // covers the search button, so the late ask is a press on the panel's own search field (or the key)
  const pressLate = !opensItself || control.sel !== ".ng-logo"
  if (pressLate && opensItself && control.sel) { await press(p2, ".ng-explorer-tools input", "the panel's search field, late", touch); await settled(p2) }
  else if (pressLate) { await doPress(p2, control.what + ", late"); await settled(p2) }
  const b = await endState(p2)
  expect(late.errors, "no page error on the late press").toEqual([])
  expect(a, pressLate ? "the early press ends where a late press ends" : "the early press leaves the panel as the page opened it").toEqual(b)
  expect(a.shown, "the panel is open").toBe(true)
  expect(a.paneOpened, "pane_opened sent once, for a panel the player can see").toBe(1)
  return { opensItself }
}

const NODE_PAGES = [
  { path: "/Positions/Mount/Top", what: "a position page" },
  { path: "/Transitions/Knee-Slice-Pass", what: "a technique page" },
  { path: "/Submissions/Triangle-Choke/from-Triangle-Control/Attacker", what: "a submission page" },
]
const PAGES = [
  { path: "/", what: "the home page" },
  { path: "/Positions/Mount/Top", what: "a position page" },
  { path: "/Transitions/Knee-Slice-Pass", what: "a technique page" },
  { path: "/Principles/Frames", what: "a principle page" },
  { path: "/Systems/10th-Planet-No-Gi-Guard-System", what: "a system page" },
  { path: "/Learning/BJJ-Guard-Types-Explained", what: "a learning page" },
  { path: "/Positions", what: "a hub" },
]

for (const touch of [false, true]) {
  const tag = touch ? "touch 390x631" : "mouse 1440x900"
  test.describe(tag, () => {
    test.use(touch ? { hasTouch: true, isMobile: true, viewport: { width: 390, height: 631 } } : { viewport: { width: 1440, height: 900 } })

    for (const pg of PAGES) {
      test(`an early press on the logo on ${pg.what} ends where a late press ends (${tag})`, async ({ page, context }) => {
        const { opensItself } = await earlyThenLate(page, context, pg.path, { sel: ".ng-logo", what: "the logo" }, touch)
        if (pg.what === "a hub") expect(opensItself, "premise: the hub opens the panel itself").toBe(true)
      })
    }
    for (const pg of [PAGES[0], PAGES[1], PAGES[3], PAGES[6]]) {
      test(`an early press on the search button on ${pg.what} ends where a late press ends (${tag})`, async ({ page, context }) => {
        await earlyThenLate(page, context, pg.path, { sel: ".ng-search", what: "the search button" }, touch)
      })
    }

    // REFSEARCH-2 (the orchestrator's probe on the preview, 3 of 6 in one run): on a position, technique or
    // submission page the page's own first landing is the READER's (its `open` seats the board with `rollFromPosition` as
    // soon as its file has landed), and it ended a session opened before it. #432 held on the home page only: its test
    // booted "/". The order is FORCED here by holding the reader's file (`app/reader.js`, `never`): the logo and the row are
    // pressed, the session is open, and only then is the reader released, so its landing comes after by construction.
    // The player's own roll then ends the session: called the way a row's ▶ makes it (`playFrom`), because on a phone
    // the panel covers the map and no control that starts a roll is on screen beside an open session.
    for (const pg of NODE_PAGES) {
      test(`Master the game opened on ${pg.what} before the page's own first landing stays open when it lands, and the player's own roll ends it (${tag})`, async ({ page }) => {
        const errors: string[] = []
        page.on("pageerror", (e) => errors.push(e.message))
        const j = journey(page)
        await j.boot(pg.path, { unready: true, payloads: { "app/reader.js": { never: true } } })
        await landed(page)
        await page.evaluate(() => (window as W).__neural.advance(17))   // one frame first, as on the home page (see there)
        const landings = () => page.evaluate(() => (((window as W).__neural.beats || []) as any[]).filter((b) => b.beat === "land").length)
        expect([await page.evaluate(() => !!(window as W).__neural._reader), await landings()], "premise: the reader has not landed, and nothing has landed on the board").toEqual([false, 0])
        await press(page, ".ng-logo", "the logo", touch)
        await expect(page.locator('[data-explore-stats] [data-b="due"]')).toBeVisible()
        await press(page, '[data-explore-stats] [data-b="due"]', "Master the game", touch)
        await expect.poll(() => page.evaluate(() => !!(window as W).__neural._practiceInDrawer()), { message: "premise: Master the game is open" }).toBe(true)
        expect(await page.evaluate(() => { (window as any).__openSession = (window as W).__neural._session; return !!(window as any).__openSession }),
          "premise: a session is open").toBe(true)
        expect(await landings(), "premise: still nothing has landed").toBe(0)
        await j.releasePayload("app/reader.js")
        await expect.poll(async () => [await page.evaluate(() => !!(window as W).__neural._reader), (await landings()) > 0],
          { message: "premise: the reader landed and the page's own first landing happened", timeout: 20_000 }).toEqual([true, true])
        expect(await page.evaluate(() => (window as W).__neural._session === (window as any).__openSession && (window as W).__neural._practiceInDrawer()),
          "Master the game is still open after the page's own first landing").toBe(true)
        await expect(page.locator("[data-practice-page]"), "and its page is on screen").toBeVisible()
        await page.evaluate(() => { const a = (window as W).__neural; a.playFrom(a.currentPos, a.playerRole) })
        expect(await page.evaluate(() => (window as W).__neural._session === (window as any).__openSession), "a roll the player starts ends the session").toBe(false)
        expect(errors, "no page error").toEqual([])
      })
    }

    test(`a press taken back before the data lands opens nothing (${tag})`, async ({ page }) => {
      const { j, errors } = await bootHeld(page)
      await press(page, ".ng-logo", "the logo", touch)
      await press(page, ".ng-logo", "the logo again", touch)
      expect(await busy(page, ".ng-logo"), "the second press takes the pressed look back too").toBe(false)
      await j.releasePayload("graph-data.json")
      await landed(page)
      await page.waitForTimeout(500)
      expect(await shown(page), "a press taken back opens nothing").toBe(false)
      expect(errors, "no page error").toEqual([])
      await press(page, ".ng-logo", "a press after the data", touch)
      await expect.poll(() => shown(page), { message: "and the next press opens it" }).toBe(true)
    })

    // "A navigation drops it": the site's own links move the address in the same document (Quartz's router pushes it the
    // same way), here to another pathname, a principle page, whose reading arrival keeps the drawer shut
    test(`a navigation before the data lands drops the press (${tag})`, async ({ page }) => {
      const { j, errors } = await bootHeld(page)
      await press(page, ".ng-logo", "the logo", touch)
      await page.evaluate(() => history.pushState(null, "", "/Principles/Frames"))
      await j.releasePayload("graph-data.json")
      await landed(page)
      await settled(page)
      expect(await shown(page), "a navigation drops the press").toBe(false)
      expect(await busy(page, ".ng-logo"), "and its pressed look").toBe(false)
      expect(errors, "no page error").toEqual([])
    })

    // The page is its pathname (EARLY1-R2): the sign-in signs in by PKCE, so its redirect-back carries `?code=` in the
    // QUERY, and the auth SDK strips it with `replaceState` after the exchange, maybe before the data lands. That is the
    // same page. The address is moved in the page as the arrival and the SDK move it (the harness has no Supabase).
    test(`a sign-in's ?code= stripped before the data lands keeps the press (${tag})`, async ({ page }) => {
      const { j, errors } = await bootHeld(page)
      await page.evaluate(() => history.replaceState(null, "", "/?code=ng-early-arrival"))
      await press(page, ".ng-logo", "the logo", touch)
      await page.evaluate(() => history.replaceState(null, "", "/"))
      await j.releasePayload("graph-data.json")
      await landed(page)
      await expect.poll(() => shown(page), { message: "a stripped ?code= keeps the press" }).toBe(true)
      expect(errors, "no page error").toEqual([])
    })

    // FAULT 2 (the reader of #430, finding 4b): Master the game opened before the first roll is dealt. The intro hands over
    // at 3.2 s of its own clock and deals the first roll; that deal ended the session. Here the clock is HELD by the test-mode
    // pump (`advance`): the intro waits until the journey moves it, so the presses come before the deal by construction.
    test(`Master the game opened before the first roll is dealt stays open when it is dealt, and a later deal ends it (${tag})`, async ({ page }) => {
      const errors: string[] = []
      page.on("pageerror", (e) => errors.push(e.message))
      const j = journey(page)
      await j.boot("/")
      // One frame first, as a real clock has always ticked by the time the data lands: in test mode `this.now` is unset until
      // the first `advance`, so a node lit before it (opening Master the game lights its position) keeps a glow time that is
      // not a number and the next draw throws (`createRadialGradient` non-finite). Diagnosed under dev's own reset too, so it
      // is the harness's clock, not this fix; the reader of #432 found no non-finite glow on a real clock either.
      await page.evaluate(() => (window as W).__neural.advance(17))
      expect(await page.evaluate(() => !!(window as W).__neural.introDone), "premise: the first roll is not dealt yet").toBe(false)
      await press(page, ".ng-logo", "the logo", touch)
      await expect(page.locator('[data-explore-stats] [data-b="due"]')).toBeVisible()
      await press(page, '[data-explore-stats] [data-b="due"]', "Master the game", touch)
      await expect.poll(() => page.evaluate(() => !!(window as W).__neural._practiceInDrawer()), { message: "premise: Master the game is open" }).toBe(true)
      expect(await page.evaluate(() => { (window as any).__openSession = (window as W).__neural._session; return !!(window as any).__openSession }),
        "premise: a session is open").toBe(true)
      await page.evaluate(() => (window as W).__neural.advance(4500))
      expect(await page.evaluate(() => !!(window as W).__neural.introDone), "premise: the first roll was dealt").toBe(true)
      expect(await page.evaluate(() => (window as W).__neural._session === (window as any).__openSession && (window as W).__neural._practiceInDrawer()),
        "Master the game is still open after the first roll is dealt").toBe(true)
      // Only that one deal keeps it (an argument of the intro's call, never a flag a later roll could inherit). No control
      // on screen deals while the panel is open (a player's own roll, from a node or a row's ▶, goes through
      // `rollFromPosition`, which always ends it), so the later deal is called the way `resetRoll` makes it.
      await page.evaluate(() => (window as W).__neural.resetRoll())
      expect(await page.evaluate(() => (window as W).__neural._session === (window as any).__openSession), "a later deal ends the session").toBe(false)
      expect(errors, "no page error").toEqual([])
    })
  })
}

// keys are a desktop's: "/" is the search's key, and Esc says "not that"
test.describe("keys, 1440x900", () => {
  test.use({ viewport: { width: 1440, height: 900 } })
  test("the / key before the data lands ends where a late / ends", async ({ page, context }) => {
    await earlyThenLate(page, context, "/", { key: "/", what: "the / key" }, false)
  })
  test("Esc before the data lands forgets a remembered press", async ({ page }) => {
    const { j, errors } = await bootHeld(page)
    await page.keyboard.press("/")
    expect(await busy(page, ".ng-search"), "premise: the search shows the press was taken").toBe(true)
    await page.keyboard.press("Escape")
    expect(await busy(page, ".ng-search"), "Esc takes the pressed look back").toBe(false)
    await j.releasePayload("graph-data.json")
    await landed(page)
    await page.waitForTimeout(500)
    expect(await shown(page), "Esc forgets it: nothing opens when the data lands").toBe(false)
    expect(errors, "no page error").toEqual([])
    await page.keyboard.press("/")
    await expect.poll(() => shown(page), { message: "and a / after the data opens it" }).toBe(true)
  })
})
