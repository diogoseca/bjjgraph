import { test, expect, type Page } from "@playwright/test"
import { journey } from "../dsl"
import { beforeNeuralAuthNavigate, signInNeuralAuthSDK, waitNeuralAuthOwner } from "../fixtures/neural-auth-sdk"

/**
 * THE DRAWER (owner A5 · E1 · T-b; U45, U46 b, U49 a, U51 e, U53 a, U56 e — v1.242.0). One list
 * replaced the pane's three tabs. Each claim is read off what the drawer RENDERED (rows, their
 * markers, their rects) or what the frame PUBLISHED (`_fogLow`), never recomputed here:
 *   1. One drawer icon opens it, and nothing on screen is labelled "Menu".
 *   2. The order: Search, Explore (expandable: Positions, Transitions, Submissions, Systems,
 *      Principles, Learning), Practice then Path (U60 b: no Train header), Your lists, Last rolls,
 *      the badge.
 *   3. It draws over the map, the legend included, and the legend never moves.
 *   4. The badge shows today's cards and rolls before it is opened, a real grade moves it, and the
 *      day's rolls survive a reload (SIDE-R2 M4).
 *   5. Practice's row carries the owed reviews and the day's goal; Path's row carries the worn
 *      belt; both, and Last rolls, open their views, and the brand leads back to the list.
 *   6. A lit page (a principle) fades the rest of the map to ~20%, smoothly, not at once.
 *   7. Keyboard: real Tab presses reach the badge, Enter opens its menu WITH focus inside it, the arrows
 *      walk its items to a small link that works by key, and Esc hands focus back (SIDE-R2 M7).
 *   8. A guest's badge offers to save; a signed-in player gets neither it nor the save toast.
 *   9. On a phone, a left swipe closes the drawer — but never mid-study (SIDE-R2 S1), never from a
 *      horizontal scroller, a vertical drag or a pinch, and a swipe is never a tap (the retired pager's
 *      guards, re-pinned on the gesture that replaced it).
 *  10. On a phone, the tap on the exposed strip that closes the drawer does only that: over a node it
 *      stages nothing, over the background it dismisses nothing (SIDE-R2 P1).
 *  11. The closed drawer's icon wears an amber dot while reviews are owed, and none when nothing is.
 *  12. Explore's fold survives a reload.
 *  13. SIDE-R3 N1: held concept headers reserve their height; Practice stays within 1px and a
 *      press aimed before the index lands still opens it (phone touch and desktop mouse).
 *  14. SIDE-R3 N3: a finger opens the badge without moving focus into its menu.
 *  10 also covers N2: closing the drawer leaves a replay running; a subsequent graph input stops it.
 * Claims 2, 3, 4 and 7 are @curated, so the deploy gate covers the drawer.
 *
 * Harness: the DSL serves `{}` for dossier chunks; no claim here reads one. Systems and concepts
 * payloads are real, so the six categories are awaited, not assumed. No gameplay rng branch is
 * reached: every test pauses or opens the drawer (which pauses) before it reads anything.
 * Mutants: tests/artifacts/sidebar_mutants.md.
 */

type W = Window & { __neural: any }
const drawer = (page: Page) => page.evaluate(() => !!(window as W).__neural.deckShown)

for (const width of [390, 1440]) test.describe(`index landing ${width}`, () => {
  test.use({ viewport: { width, height: width === 390 ? 844 : 900 }, hasTouch: width === 390 })
  test("Practice stays under the arriving press when concepts land (SIDE-R3 N1) @curated", async ({ page }) => {
    const j = journey(page)
    await j.boot("/")
    let release!: () => void, held = 0
    const gate = new Promise<void>(resolve => { release = resolve })
    await page.route("**/concepts.json", async route => { held++; await gate; await route.continue() })
    try {
      await openDrawer(j, page)
      await expect.poll(() => held, { message: "the real concepts request is held" }).toBe(1)
      await expect(page.locator('[data-explore-section="Systems"]')).toBeVisible()
      expect(await page.evaluate(() => ((window as W).__neural.concepts || []).length)).toBe(0)
      const practice = page.locator('[data-explore-stats] [data-b="due"]')
      const before = (await practice.boundingBox())!
      release()
      await expect(page.locator('[data-explore-section="Learning"]')).toBeVisible()
      const after = (await practice.boundingBox())!
      console.log(`[N1] ${width}: before=${before.y} after=${after.y} move=${after.y - before.y}`)
      expect(Math.abs(after.y - before.y), "Practice did not move when concepts landed").toBeLessThanOrEqual(1)
      const x = before.x + before.width / 2, y = before.y + before.height / 2
      if (width === 390) await page.touchscreen.tap(x, y)
      else await page.mouse.click(x, y)
      await expect(page.locator(".ng-pane-drillhead"), "the press aimed before landing opens Practice").toContainText("Practice")
    } finally { release() }
  })
})

async function openDrawer(j: any, page: Page) {
  await j.clickByMouse(".ng-logo", "the drawer icon")
  await expect(page.locator(".ng-drawer-head")).toBeVisible()
}
/** A press on a deck control that a deck landing may repaint: located afresh if a repaint replaced it. */
async function pressDeck(page: Page, j: any, sel: string, what: string) {
  for (let i = 0; ; i++) {
    try { await expect(page.locator(sel).first()).toBeVisible(); await page.locator(sel).first().scrollIntoViewIfNeeded(); await j.clickByMouse(sel, what); return }
    catch (e) { if (i >= 3 || !/not attached|detached/.test(String(e))) throw e }
  }
}

test("one drawer icon opens the drawer, and nothing is labelled Menu", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  const opener = page.locator(".ng-logo")
  await expect(opener).toHaveAttribute("aria-label", "Open the sidebar")
  expect((await opener.innerText()).trim(), "the opener is an icon, with no words").toBe("")
  await openDrawer(j, page)
  expect(await drawer(page)).toBe(true)
  const labelled = await page.evaluate(() => [...document.querySelectorAll("body *")].filter((el) => {
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(" ")
    return /\bmenu\b/i.test(own) || /\bmenu\b/i.test(el.getAttribute("aria-label") || "") || /\bmenu\b/i.test(el.getAttribute("title") || "")
  }).map((el) => el.outerHTML.slice(0, 80)))
  expect(labelled, "no visible word or accessible name says Menu").toEqual([])
  await j.clickByMouse(".ng-explorer-close", "the drawer's own close icon")
  expect(await drawer(page)).toBe(false)
})

// AN OPEN THAT NAMES NO VIEW LANDS ON THE LIST (SIDE-R2 M8): the phone dossier's ‹ Back and `openExplorer`
// pass no view, and a player with nothing stored used to land on Path. Read once the curriculum has landed,
// which is when the stored view is resolved, and before anything else opened the drawer.
test("an open that names no view lands on the drawer's list, never on Path", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await page.waitForFunction(() => !!(window as W).__neural.curriculum)
  expect(await page.evaluate(() => (window as W).__neural._viewMode), "nothing stored: the list").toBe("explore")
  await page.evaluate(() => (window as W).__neural.openExplorer())
  await expect(page.locator("[data-drawer-explore]"), "a no-view open lands on the drawer's list").toBeVisible()
  await expect(page.locator(".ng-track-card")).toHaveCount(0)
})

test("the drawer lists Search, Explore, Practice, Path, your lists and Last rolls, in that order @curated", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await openDrawer(j, page)
  const cats = page.locator(".ng-dr-sub > [data-explore-section]")
  await expect.poll(() => cats.count(), { message: "the six categories mount once their payloads land", timeout: 30_000 }).toBe(6)
  expect(await cats.evaluateAll((els) => els.map((e) => e.getAttribute("data-explore-section"))),
    "Explore's categories, in the owner's order").toEqual(["Positions", "Transitions", "Submissions", "Systems", "Principles", "Learning"])
  const order = await page.evaluate(() => {
    const pane = document.querySelector(".ng-drill")!
    const marks: [string, string][] = [["search", ".ng-explorer-search"], ["explore", "[data-drawer-explore]"],
      ["practice", '[data-explore-stats] [data-b="due"]'], ["path", '[data-explore-stats] [data-view="challenges"]'],
      ["lists", '[data-explore-section="Your lists"]'], ["rolls", 'button[data-view="history"]'], ["badge", ".ngAcctChip"]]
    return marks.map(([k, sel]) => {
      const els = pane.querySelectorAll(sel)
      return { k, n: els.length, top: els.length ? (els[0] as HTMLElement).getBoundingClientRect().top : -1 }
    })
  })
  for (const m of order) expect(m.n, m.k + " is there exactly once").toBe(1)
  for (let i = 1; i < order.length; i++) expect(order[i].top, order[i].k + " sits below " + order[i - 1].k).toBeGreaterThan(order[i - 1].top)
  await expect(page.locator("[data-explore-stats] .ng-dr-row"), "Practice then Path are the only two rows").toHaveCount(2)
  await expect(page.locator("[data-explore-stats] .ng-dr-label"), "U60 b: no Train header").toHaveCount(0)
  // THE WORD GAP (orchestrator SIDE-R1): Plus Jakarta Sans draws its space at 0.143em, so "Your lists"
  // read as one word. The harness aborts the Google font request, so the face here is a fallback with a
  // wide space and an absolute gap would pass without the fix (mutant D5 survived exactly that). The claim
  // is measured as a DIFFERENTIAL instead: the label's word gap minus the same words in the same computed
  // font with normal spacing — the extra tenth of an em the drawer adds, whichever face loaded.
  const gap = await page.evaluate(() => {
    const head = document.querySelector('[data-explore-section="Your lists"]')!
    const w = document.createTreeWalker(head, NodeFilter.SHOW_TEXT); let n: Node | null
    while ((n = w.nextNode())) if ((n.textContent || "").includes("Your lists")) break
    const between = (node: Node) => { const t = node.textContent!, i = t.indexOf(" "), r = (a: number) => { const g = document.createRange(); g.setStart(node, a); g.setEnd(node, a + 1); return g.getBoundingClientRect() }; return r(i + 1).left - r(i - 1).right }
    const cs = getComputedStyle(n!.parentElement!), ctl = document.createElement("span")
    ctl.style.cssText = "position:absolute;visibility:hidden;white-space:pre;word-spacing:normal"
    ctl.textContent = "Your lists"; n!.parentElement!.appendChild(ctl)   // the label's own font, by inheritance
    const control = between(ctl.firstChild!); ctl.remove()
    return (between(n!) - control) / parseFloat(cs.fontSize)
  })
  expect(gap, "the drawer adds about a tenth of an em to every word gap").toBeGreaterThanOrEqual(0.08)
  // Explore folds, and its fold is remembered
  await j.clickByMouse("[data-drawer-explore]", "Explore")
  await expect(page.locator(".ng-dr-sub")).toHaveCount(0)
  await expect(page.locator("[data-drawer-explore]")).toHaveAttribute("aria-expanded", "false")
  await j.clickByMouse("[data-drawer-explore]", "Explore again")
  await expect(cats).toHaveCount(6)
})

test("the drawer draws over the map and the legend, and the legend never moves @curated", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  const before = await page.locator(".ng-legend").boundingBox()
  await openDrawer(j, page)
  const after = await page.locator(".ng-legend").boundingBox()
  expect(after, "the legend did not move").toEqual(before)
  const covered = await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest(".ng-drill"), { x: before!.x + 8, y: before!.y + 8 })
  expect(covered, "the drawer is on top of the legend").toBe(true)
})

test("the badge shows today's cards and rolls before it is opened, a real grade moves it, and the rolls survive a reload @curated", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await page.evaluate(async () => {
    const a = (window as W).__neural, day = a._epochDay()
    a.setPaused(true)
    a.srs = { "Seed|Top": { s0: [day + 1, 1, day], s1: [day + 1, 1, day], s2: [day + 1, 1, day] } }
    const key = Object.keys(a.flashcards.decks).find((k: string) => k.endsWith("|Top") && a._deckCardCount(a.flashcards.decks[k]) >= 2)
    await a.hydrateDecks([key])
    const c = a._cardsOf(a.flashcards.decks[key])[0]
    a.srs[key] = { [a.qhash(c.q)]: [day - 2, 3, day - 5] }   // one review owed
    // one roll archived today through the real seam (`_closeRoll` counts the day's rolls, SIDE-R2 M4)
    a.rollLog = [{ name: "Mount", idx: 0, role: "Top" }, { name: "Armbar", idx: 0 }]; a._played = true; a._lastOutcome = "win"
    a._closeRoll()
    a.updateAccountUI()
  })
  await openDrawer(j, page)
  const today = page.locator(".ngAcctChip [data-badge-today]")
  await expect(today, "today, on the badge, unopened").toHaveText("Today: 3 of 20 cards · 1 roll")
  expect(await page.evaluate(() => document.querySelector(".ng-account-menu")!.getAttribute("data-open")), "the menu is shut").toBeNull()
  // Practice: grade the owed review, then come home by the brand
  await j.clickByMouse('[data-explore-stats] [data-b="due"]', "Practice")
  await pressDeck(page, j, "[data-mini-reveal]", "Reveal")   // the pane chose the row; the mouse is measured
  await pressDeck(page, j, "[data-mini-got]", "Got it")
  await j.clickByMouse(".ng-drawer-brand", "the brand, home")
  await expect(page.locator("[data-drawer-explore]")).toBeVisible()
  await expect(today, "the grade moved the badge").toHaveText("Today: 4 of 20 cards · 1 roll")
  // THE DAY'S ROLLS SURVIVE A RELOAD (SIDE-R2 M4): the shelf of past rolls is this visit's, the count is not
  await page.evaluate(() => sessionStorage.setItem("__ng_keep", "1"))   // the app's own save, no flush of ours
  await page.reload()
  await page.waitForFunction(() => !!(window as W).__neural?.nodes?.length)
  expect(await page.evaluate(() => ((window as W).__neural._pastRolls || []).length), "premise: the shelf itself did not survive").toBe(0)
  await openDrawer(j, page)
  await expect(today, "the day's roll survived the reload").toHaveText(/ · 1 roll$/)
})

test("Practice, Path and Last rolls open their views, and the brand leads back", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await page.evaluate(async () => {
    const a = (window as W).__neural, day = a._epochDay()
    const key = Object.keys(a.flashcards.decks).find((k: string) => k.endsWith("|Top") && a._deckCardCount(a.flashcards.decks[k]) >= 2)
    await a.hydrateDecks([key])
    a.srs = { [key]: Object.fromEntries(a._cardsOf(a.flashcards.decks[key]).slice(0, 2).map((c: any) => [a.qhash(c.q), [day - 1, 3, day - 4]])) }
    a.srs["Seed|Top"] = { s0: [day + 1, 1, day] }
  })
  await openDrawer(j, page)
  const practice = page.locator('[data-explore-stats] [data-b="due"]')
  await expect(practice.locator(".ng-dr-pill"), "the owed reviews, on the row").toHaveText("2 due")
  await expect(practice.locator(".ng-dr-tail"), "and the day's goal").toContainText("1/20")
  const path = page.locator('[data-explore-stats] [data-view="challenges"]')
  await expect(path.locator("[data-tab-sub='challenges']")).toHaveText("0 stripes")
  await expect(page.locator("[data-path-belt] .ng-tab-belt[data-tab-belt='white'][data-tab-stripes='0']"), "the worn belt under Path").toHaveCount(1)

  await j.clickByMouse('[data-explore-stats] [data-view="challenges"]', "Path")
  await expect(page.locator(".ng-drawer-brand")).toHaveText("‹ Path")
  await expect(page.locator(".ng-track-card").first()).toBeVisible()
  await j.clickByMouse(".ng-drawer-brand", "‹ Path, home")
  await expect(page.locator("[data-drawer-explore]")).toBeVisible()

  await j.clickByMouse('button[data-view="history"]', "Last rolls")
  await expect(page.locator(".ng-drawer-brand")).toHaveText("‹ Last rolls")
  await expect(page.locator("[data-hist-empty]")).toBeVisible()
  await j.clickByMouse(".ng-drawer-brand", "‹ Last rolls, home")

  await j.clickByMouse('[data-explore-stats] [data-b="due"]', "Practice")
  // titled by what it holds: the owed reviews, then the plan's new cards (practice-mix.spec pins the mix)
  await expect(page.locator(".ng-pane-drillhead"), "Practice opens the session").toContainText("Practice \u00b7 2 reviews")
  // the study head's ‹ Back is a real button (SIDE-R2 P2): it takes focus, and Enter takes it home
  await page.locator("[data-pane-back]").focus()
  expect(await page.evaluate(() => document.activeElement?.getAttribute("data-pane-back")), "‹ Back takes focus").toBe("1")
  await page.keyboard.press("Enter")
  await expect(page.locator("[data-drawer-explore]"), "Enter on ‹ Back leaves the session").toBeVisible()
  await j.clickByMouse('[data-explore-stats] [data-b="due"]', "Practice, again")
  await expect(page.locator(".ng-pane-drillhead")).toContainText("Practice")
  await j.clickByMouse(".ng-drawer-brand", "the brand, out of the session")
  await expect(page.locator("[data-drawer-explore]")).toBeVisible()
})

// A REPAINT MID-PRESS MUST NOT SWALLOW THE PRESS (SIDE-R2 M10, FGD13's class): a residency or planner
// refresh repaints the Practice row in place, and a pill rewritten between pointerdown and pointerup
// leaves the browser no common target, so no click is dispatched at all. Nothing changed, nothing is written.
test("a repaint between pressing Practice and releasing it does not swallow the press", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await page.evaluate(async () => {
    const a = (window as W).__neural, day = a._epochDay()
    const key = Object.keys(a.flashcards.decks).find((k: string) => k.endsWith("|Top") && a._deckCardCount(a.flashcards.decks[k]) >= 2)
    await a.hydrateDecks([key])
    a.srs = { [key]: { [a.qhash(a._cardsOf(a.flashcards.decks[key])[0].q)]: [day - 1, 3, day - 4] } }
  })
  await openDrawer(j, page)
  const pill = (await j.boxOf('[data-explore-stats] [data-b="due"] .ng-dr-pill', "Practice's due pill"))
  await page.mouse.move(pill.x + pill.width / 2, pill.y + pill.height / 2)
  await page.mouse.down()
  await page.evaluate(() => (window as W).__neural._paintTrain())
  await page.mouse.up()
  await expect(page.locator(".ng-pane-drillhead"), "the press opened Practice").toContainText("Practice")
})

test("a principle lights its places and fades the rest of the map to ~20%, smoothly", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await openDrawer(j, page)
  await expect(page.locator('[data-explore-section="Principles"]')).toBeVisible({ timeout: 30_000 })
  await j.clickByMouse('[data-explore-section="Principles"]', "Principles")
  const row = page.locator("[data-concept-row]").first()
  await expect(row).toBeVisible()
  await row.scrollIntoViewIfNeeded()
  await j.clickByMouse("[data-concept-row]", "the first principle")
  await expect.poll(() => page.evaluate(() => { const a = (window as W).__neural; return a._focusIdxSet ? a._focusIdxSet.size : 0 }),
    { message: "the principle lights its places" }).toBeGreaterThan(0)
  // the frame's own fog level (`_fogLow`, published by draw), over 80 pumped frames from a fresh start
  const levels: number[] = await page.evaluate(() => {
    const a = (window as W).__neural, out: number[] = []
    a._fogMix = 0; a._fogT = performance.now(); a._fogS = (a.now || 0) * 1000
    // Observe every draw synchronously. Waiting on wall-clock timers let a busy CI browser skip
    // the fade's first frames altogether (0.20 on its first sample), although the ease was correct.
    // The existing pumped-time path is production code; this only chooses when its output is read.
    for (let i = 0; i < 80; i++) { a.advance(17); out.push(a._fogLow) }
    return out
  })
  console.log("[sidebar] fog levels: " + levels.filter((_, i) => i % 8 === 0).map((v) => v.toFixed(2)).join(" "))
  expect(levels[0], "not at once: the first frame is still mostly clear (at once would read 0.20)").toBeGreaterThan(0.5)
  expect(levels.some((v) => v > 0.3 && v < 0.9), "it passes through the values between").toBe(true)
  expect(levels[levels.length - 1], "and settles at ~20%").toBeCloseTo(0.2, 2)
})

test("keyboard: Tab reaches the badge, Enter opens its menu with focus inside it, the arrows walk it, and its links work by key @curated", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await openDrawer(j, page)
  await page.locator(".ng-explorer-search input").focus()
  let presses = 0
  for (; presses < 80; presses++) {
    if (await page.evaluate(() => !!document.activeElement?.classList.contains("ngAcctChip"))) break
    await page.keyboard.press("Tab")
  }
  console.log("[sidebar] Tab presses from search to the badge: " + presses)
  expect(await page.evaluate(() => !!document.activeElement?.classList.contains("ngAcctChip")), "real Tab presses reach the badge").toBe(true)
  await page.keyboard.press("Enter")
  await expect(page.locator(".ng-account-menu")).toHaveAttribute("data-open", "1")
  // THE MENU IS PORTALED out of the drawer, so Tab from the badge never arrived in it (SIDE-R2 M7):
  // opening moves focus to its first item, and the arrows walk the items (`role=menu`'s own keys)
  const focused = () => page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null
    return el && el.closest(".ng-account-menu") ? [...el.attributes].map((x) => x.name).find((n) => n.startsWith("data-menu-") || n === "data-gh-chip") || el.tagName : "outside"
  })
  expect(await focused(), "focus moved into the menu, on its first item").toBe("data-menu-mastered")
  for (const sel of ["[data-menu-settings]", "[data-menu-feedback]", "[data-menu-request]", "[data-menu-terms]", "[data-menu-privacy]", "[data-gh-chip]"]) {
    const tag = await page.locator(".ng-account-menu " + sel).evaluate((el) => el.tagName)
    expect(["BUTTON", "A"], sel + " is a real control").toContain(tag)
  }
  await page.keyboard.press("ArrowUp")
  expect(await focused(), "ArrowUp from the first item wraps to the last").toBe("data-gh-chip")
  await page.keyboard.press("Home")
  const walked: string[] = []
  for (let i = 0; i < 12 && (await focused()) !== "data-menu-terms"; i++) { await page.keyboard.press("ArrowDown"); walked.push(String(await focused())) }
  expect(walked, "ArrowDown walks the items in order").toEqual(["data-menu-settings", "data-menu-feedback", "data-menu-create", "data-menu-login", "data-menu-request", "data-menu-terms"])
  // Esc closes the menu and hands focus back to the badge
  await page.keyboard.press("Escape")
  await expect(page.locator(".ng-account-menu")).not.toHaveAttribute("data-open", "1")
  expect(await page.evaluate(() => !!document.activeElement?.classList.contains("ngAcctChip")), "focus is back on the badge").toBe(true)
  // and by key all the way to a small link that works
  await page.keyboard.press("Enter")
  await page.keyboard.press("End"); await page.keyboard.press("ArrowUp"); await page.keyboard.press("ArrowUp")
  expect(await focused()).toBe("data-menu-terms")
  await page.keyboard.press("Enter")
  await expect(page.locator("body")).toContainText("Terms of Use")
})

test("a guest's badge offers to save; a signed-in player gets neither it nor the save toast", async ({ page }) => {
  const j = journey(page)
  await j.boot("/", { beforeNavigate: beforeNeuralAuthNavigate })
  await waitNeuralAuthOwner(page, null)
  await openDrawer(j, page)
  await expect(page.locator(".ngAcctChip")).toContainText("Guest")
  await j.clickByMouse("[data-badge-save]", "the guest's Save")
  await expect(page.locator("body")).toContainText("Create your account")
  await page.evaluate(() => (window as W).__neural.closeModal())
  const guestToast = await page.evaluate(() => { const a = (window as W).__neural; a.saveShown = false; a.maybeShowSaveHint("cards"); return !!a.saveShown })
  expect(guestToast, "a guest still gets the one save toast").toBe(true)

  await signInNeuralAuthSDK(page, "sidebar-user", { email: "player@example.com", name: "Player" })
  await expect(page.locator(".ngAcctChip")).toContainText("Player")
  await expect(page.locator("[data-badge-save]"), "no save offer once signed in").toBeHidden()
  const toast = await page.evaluate(() => {
    const a = (window as W).__neural; a.saveShown = false; a.setEvent("", "", "muted"); a.maybeShowSaveHint("cards")
    return { shown: !!a.saveShown, text: a.evTextRef.current.textContent }
  })
  expect(toast.shown, "no save toast for a signed-in player").toBe(false)
  expect(toast.text).not.toContain("Save your progress")
  await j.openAccountMenu("the signed-in badge")
  await expect(page.locator(".ng-account-menu [data-menu-account]")).toHaveCount(0)
  await expect(page.locator(".ng-account-menu [data-menu-settings]")).toHaveText("Settings")
  await expect(page.locator(".ng-account-menu [data-menu-logout]")).toHaveText("Sign out")
})

test("on a phone, a left swipe closes the drawer", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const j = journey(page)
  await j.boot("/")
  await openDrawer(j, page)
  const box = (await page.locator(".ng-drill").boundingBox())!
  const y = box.y + box.height * 0.6
  // a rightward drag pages nothing and closes nothing
  await page.evaluate(([x1, x2, yy]) => {
    const el = document.querySelector(".ng-drill") as HTMLElement
    const t = (x: number) => new Touch({ identifier: 1, target: el, clientX: x, clientY: yy })
    el.dispatchEvent(new TouchEvent("touchstart", { changedTouches: [t(x1)], bubbles: true }))
    el.dispatchEvent(new TouchEvent("touchend", { changedTouches: [t(x2)], bubbles: true }))
  }, [box.x + 60, box.x + 220, y])
  expect(await drawer(page), "a rightward swipe leaves it open").toBe(true)
  await page.evaluate(([x1, x2, yy]) => {
    const el = document.querySelector(".ng-drill") as HTMLElement
    const t = (x: number) => new Touch({ identifier: 1, target: el, clientX: x, clientY: yy })
    el.dispatchEvent(new TouchEvent("touchstart", { changedTouches: [t(x1)], bubbles: true }))
    el.dispatchEvent(new TouchEvent("touchend", { changedTouches: [t(x2)], bubbles: true }))
  }, [box.x + 220, box.x + 60, y])
  expect(await drawer(page), "a leftward swipe closes it").toBe(false)
  // the 88vw drawer leaves a strip of graph exposed, and a tap there closes it (inventory row 4)
  await openDrawer(j, page)
  await page.mouse.click(386, 420)
  await expect.poll(() => drawer(page), { message: "a tap on the exposed strip closes the drawer" }).toBe(false)
  // the legend's key is hidden on a phone (row 144); the Win/Lose bar stays
  await expect(page.locator(".ng-legendkey")).toBeHidden()
  await expect(page.locator(".ng-winbar")).toBeVisible()
})

/** A touch drag dispatched on `sel`, bubbling to the drawer (the retired pager spec's idiom). Two
 *  fingers when `pinch`: the second arrives as its own touchstart, as a browser delivers it. */
const swipe = (page: Page, sel: string, x1: number, y1: number, x2: number, y2: number, pinch = false) =>
  page.evaluate(([s, a, b, c, d, two]) => {
    const el = document.querySelector(s as string) as HTMLElement
    if (!el) throw new Error("no element for " + s)
    const mk = (id: number, x: number, y: number) => new Touch({ identifier: id, target: el, clientX: x, clientY: y })
    el.dispatchEvent(new TouchEvent("touchstart", { touches: [mk(1, a as number, b as number)], changedTouches: [mk(1, a as number, b as number)], bubbles: true }))
    if (two) el.dispatchEvent(new TouchEvent("touchstart", { touches: [mk(1, a as number, b as number), mk(2, (a as number) - 60, b as number)], changedTouches: [mk(2, (a as number) - 60, b as number)], bubbles: true }))
    el.dispatchEvent(new TouchEvent("touchend", { changedTouches: [mk(1, c as number, d as number)], bubbles: true }))
  }, [sel, x1, y1, x2, y2, pinch] as const)

test.describe("phone 390x844", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test("a finger opens the badge without a scripted focus ring (SIDE-R3 N3)", async ({ page }) => {
    const j = journey(page)
    await j.boot("/")
    await openDrawer(j, page)
    const badge = (await j.boxOf(".ngAcctChip", "the badge"))!
    await page.touchscreen.tap(badge.x + badge.width / 2, badge.y + badge.height / 2)
    await expect(page.locator(".ng-account-menu")).toHaveAttribute("data-open", "1")
    const focus = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement
      return { keyboard: !!(window as W).__neural._kbNav, menu: !!el.closest(".ng-account-menu"),
        visible: el.matches(":focus-visible"), outline: getComputedStyle(el).outlineStyle }
    })
    console.log("[N3] touch focus " + JSON.stringify(focus))
    expect(focus.keyboard, "premise: a finger, not keyboard navigation").toBe(false)
    expect(focus.menu, "a touch never moves focus into the menu").toBe(false)
    expect(focus.visible, "no focus-visible ring after the touch").toBe(false)
  })

  test("a left swipe mid-Practice keeps the drawer and the session (SIDE-R2 S1)", async ({ page }) => {
    const j = journey(page)
    await j.boot("/")
    await page.evaluate(async () => {
      const a = (window as W).__neural, day = a._epochDay()
      const key = Object.keys(a.flashcards.decks).find((k: string) => k.endsWith("|Top") && a._deckCardCount(a.flashcards.decks[k]) >= 2)
      await a.hydrateDecks([key])
      a.srs = { [key]: { [a.qhash(a._cardsOf(a.flashcards.decks[key])[0].q)]: [day - 1, 3, day - 4] } }
    })
    await openDrawer(j, page)
      await j.clickByMouse('[data-explore-stats] [data-b="due"]', "Practice")
    await expect(page.locator("[data-session-row]").first()).toBeVisible()
    await page.evaluate(() => { (window as any).__practice = (window as W).__neural._session })
    const box = (await page.locator(".ng-drill").boundingBox())!
    await swipe(page, ".ng-drill", box.x + 260, box.y + box.height * 0.6, box.x + 60, box.y + box.height * 0.6 + 4)
    expect(await page.evaluate(() => ({ shown: !!(window as W).__neural.deckShown, same: (window as any).__practice === (window as W).__neural._session })),
      "the swipe left the drawer open and the session whole").toEqual({ shown: true, same: true })
    // and the same swipe on the home list still closes it, so the claim above is about the guard
    await page.waitForTimeout(750)   // past the swipe's click-suppressor latch (700ms): a tap just after a swipe is eaten
    await j.clickByMouse(".ng-drawer-brand", "the brand, home")
    await expect(page.locator("[data-drawer-explore]")).toBeVisible()
    await swipe(page, ".ng-drill", box.x + 260, box.y + box.height * 0.6, box.x + 60, box.y + box.height * 0.6 + 4)
    expect(await drawer(page), "off the session, a left swipe closes the drawer").toBe(false)
  })

  test("the left swipe's guards: a horizontal scroller, a vertical drag and a pinch keep the drawer; a swipe is not a tap", async ({ page }) => {
    const j = journey(page)
    await j.boot("/")
    await j.land("Mount Top")
    await openDrawer(j, page)
    const box = (await page.locator(".ng-drill").boundingBox())!
    const y = box.y + box.height * 0.55
    // a mostly vertical drag belongs to the scroller, even drifting left past 40px
    await swipe(page, ".ng-drill", box.x + 240, y - 120, box.x + 180, y + 120)
    expect(await drawer(page), "a vertical-dominant drag keeps the drawer").toBe(true)
    // a pinch is not a swipe
    await swipe(page, ".ng-drill", box.x + 260, y, box.x + 60, y, true)
    expect(await drawer(page), "a two-finger gesture keeps the drawer").toBe(true)
    // a drag begun inside a horizontal scroller is that scroller's. No row in the drawer scrolls sideways
    // today, so one is stood up: the guard reads the ELEMENT's overflow, which is what is built here.
    await page.evaluate(() => {
      const list = (window as W).__neural.explorerListRef.current as HTMLElement
      const row = document.createElement("div"); row.setAttribute("data-test-hscroll", "1")
      row.style.cssText = "display:flex;gap:8px;overflow-x:auto;height:80px;"
      for (let i = 0; i < 8; i++) { const c = document.createElement("div"); c.style.cssText = "flex:none;width:200px;height:60px;background:#234;"; row.appendChild(c) }
      list.insertBefore(row, list.firstChild)
    })
    const strip = (await page.locator("[data-test-hscroll]").boundingBox())!
    await swipe(page, "[data-test-hscroll]", strip.x + strip.width - 20, strip.y + 40, strip.x + 20, strip.y + 42)
    expect(await drawer(page), "the scroller kept its own gesture").toBe(true)
    // A SWIPE IS NOT A TAP: a drag that closes nothing (vertical-dominant) and lifts over the Path row
    // must not press it with the click the browser synthesises after it…
    const path = (await page.locator('[data-explore-stats] [data-view="challenges"]').boundingBox())!
    await page.evaluate(([x, y1, y2]) => {
      const el = document.querySelector('[data-explore-stats] [data-view="challenges"]') as HTMLElement
      const mk = (yy: number) => new Touch({ identifier: 1, target: el, clientX: x, clientY: yy })
      el.dispatchEvent(new TouchEvent("touchstart", { touches: [mk(y1)], changedTouches: [mk(y1)], bubbles: true }))
      el.dispatchEvent(new TouchEvent("touchend", { changedTouches: [mk(y2)], bubbles: true }))
      el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))
    }, [path.x + path.width / 2, path.y + path.height / 2 - 60, path.y + path.height / 2] as const)
    expect(await page.evaluate(() => (window as W).__neural._viewMode), "the swipe pressed nothing").toBe("explore")
    // …while a 10px wobble is still a press (the browser's own tap slop is ~8-10px)
    await page.evaluate(([x, yy]) => {
      const el = document.querySelector('[data-explore-stats] [data-view="challenges"]') as HTMLElement
      const mk = (dx: number) => new Touch({ identifier: 1, target: el, clientX: x + dx, clientY: yy })
      el.dispatchEvent(new TouchEvent("touchstart", { touches: [mk(0)], changedTouches: [mk(0)], bubbles: true }))
      el.dispatchEvent(new TouchEvent("touchend", { changedTouches: [mk(-10)], bubbles: true }))
      el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))
    }, [path.x + path.width / 2, path.y + path.height / 2] as const)
    expect(await page.evaluate(() => (window as W).__neural._viewMode), "a 10px wobble is a press").toBe("challenges")
  })

  test("the tap on the exposed strip that closes the drawer does only that (SIDE-R2 P1)", async ({ page }) => {
    const j = journey(page)
    await j.boot("/")
    await j.land("Mount Top")
    await j.advance(500)
    const state = () => page.evaluate(() => { const a = (window as W).__neural; return { pos: a.nodes[a.currentPos]?.id, roam: !!a._roam } })
    const quiet = async (b0: number) => (await j.beats()).slice(b0).map((b: any) => b.beat).filter((b: string) => b !== "pane_resumed")
    for (const what of ["node", "background"]) {
      await openDrawer(j, page)
      const right = await page.locator(".ng-drill").evaluate((el) => el.getBoundingClientRect().right)
      // the exposed strip's canvas: a node (not the one we stand on) brought to (366, 150), or open ground
      const pt = await page.evaluate(({ what, right }) => {
        const a = (window as W).__neural, scale = a.W / a.cam.vw, cur = a.nodes[a.currentPos]
        const at = (n: any) => ({ x: (n.x - a.cam.cx) * scale + a.W / 2, y: (a._LY(n) - a.cam.cy) * scale + a.H / 2 })
        if (what === "node") {
          const n = a.nodes.filter((n: any) => n.idx !== a.currentPos && n.z > 0 && a.rsAllowsIdx(n.idx) && n.ty === "positions")
            .sort((p: any, q: any) => Math.hypot(p.x - cur.x, p.y - cur.y) - Math.hypot(q.x - cur.x, q.y - cur.y))[0]
          const p = at(n)
          a.cam.cx += (p.x - 366) / scale; a.cam.cy += (p.y - 150) / scale
          a.camTarget.cx = a.cam.cx; a.camTarget.cy = a.cam.cy; a.camTarget.vw = a.cam.vw
          return { x: 366, y: 150 }
        }
        const x = (right + a.W) / 2
        for (let y = 50; y < 260; y += 10) if (a.nodes.every((n: any) => Math.hypot(at(n).x - x, at(n).y - y) > 45)) return { x, y }
        return null
      }, { what, right })
      expect(pt, "premise: a " + what + " point in the strip").not.toBeNull()
      if (what === "node") await j.advance(50)
      const hit = await page.evaluate(({ x, y }) => { const a = (window as W).__neural, h = document.elementFromPoint(x, y); return h === a.canvas || h === a.wrapRef.current }, pt!)
      expect(hit, "premise: the point is exposed map, not a card or the drawer").toBe(true)
      if (what === "node") expect(await page.evaluate(({ x, y }) => {
        const a = (window as W).__neural, scale = a.W / a.cam.vw
        return a.nodes.some((n: any) => n.idx !== a.currentPos && Math.hypot((n.x - a.cam.cx) * scale + a.W / 2 - x, (a._LY(n) - a.cam.cy) * scale + a.H / 2 - y) < 6)
      }, pt!), "premise: a node sits under the point").toBe(true)
      const before = await state(), b0 = (await j.beats()).length
      await page.mouse.click(pt!.x, pt!.y)
      await j.advance(600)
      expect(await drawer(page), "the " + what + " tap closed the drawer").toBe(false)
      expect(await state(), "and changed nothing on the map").toEqual(before)
      expect(await quiet(b0), "nothing staged, nothing dismissed").toEqual([])
    }
    // N2: a short real replay, with two graph states. Closing the drawer is how a phone watches it.
    await openDrawer(j, page)
    expect(await page.evaluate(() => {
      const a = (window as W).__neural
      const log = ["Mount", "Side Control"].map(name => {
        const n = a.nodes.find((n: any) => n.ty === "positions" && n.rep !== false && a.graphName(n) === name)
        return { idx: n.idx, name, role: "Top" }
      })
      return a.startReplay({ ts: 1, log })
    }), "premise: a replay started").toBe(true)
    const right = await page.locator(".ng-drill").evaluate(el => el.getBoundingClientRect().right)
    const pt = { x: Math.ceil(right + (390 - right) * .9), y: 150 }
    expect(await page.evaluate(p => document.elementFromPoint(p.x, p.y) === (window as W).__neural.canvas, pt), "premise: exposed canvas").toBe(true)
    await page.touchscreen.tap(pt.x, pt.y)
    expect(await drawer(page), "the closing tap closed the drawer").toBe(false)
    expect(await page.evaluate(() => !!(window as W).__neural._replay), "N2: closing the drawer keeps the replay").toBe(true)
    await j.advance(1700)
    expect(await page.evaluate(() => (window as W).__neural._replay?.i), "the replay continues to its next step").toBeGreaterThan(0)
    await page.mouse.click(pt.x, pt.y)
    expect(await page.evaluate(() => !!(window as W).__neural._replay), "a subsequent graph input still stops the replay").toBe(false)
  })

  test("the closed drawer's icon wears an amber dot while reviews are owed, and none when nothing is", async ({ page }) => {
    const j = journey(page)
    await j.boot("/")
    const dot = page.locator(".ng-logo [data-drawer-dot]")
    await expect(dot, "nothing owed: no dot").toBeHidden()
    await page.evaluate(async () => {
      const a = (window as W).__neural, day = a._epochDay()
      const key = Object.keys(a.flashcards.decks).find((k: string) => k.endsWith("|Top") && a._deckCardCount(a.flashcards.decks[k]) >= 2)
      await a.hydrateDecks([key])
      a.srs = { [key]: { [a.qhash(a._cardsOf(a.flashcards.decks[key])[0].q)]: [day - 1, 3, day - 4] } }
      a.updateAccountUI()
    })
    await expect(dot, "a review owed: the dot").toBeVisible()
    const [r, g, bl] = (await dot.evaluate((el) => getComputedStyle(el).backgroundColor)).match(/\d+/g)!.map(Number)
    expect(r > 200 && r > g && g > bl + 40, "amber: warm, red over green over blue").toBe(true)
    await page.evaluate(() => { const a = (window as W).__neural; a.srs = {}; a.updateAccountUI() })
    await expect(dot, "paid off: gone").toBeHidden()
  })

  test("Explore's fold survives a reload", async ({ page }) => {
    const j = journey(page)
    await j.boot("/")
    await openDrawer(j, page)
    await expect(page.locator("[data-drawer-explore]")).toHaveAttribute("aria-expanded", "true")
    await j.clickByMouse("[data-drawer-explore]", "Explore, folded")
    await expect(page.locator(".ng-dr-sub")).toHaveCount(0)
    await page.evaluate(() => sessionStorage.setItem("__ng_keep", "1"))   // the app's own save, no flush of ours
    await page.reload()
    await page.waitForFunction(() => !!(window as W).__neural?.nodes?.length)
    await openDrawer(j, page)
    await expect(page.locator("[data-drawer-explore]"), "still folded after the reload").toHaveAttribute("aria-expanded", "false")
    await expect(page.locator(".ng-dr-sub")).toHaveCount(0)
  })
})
