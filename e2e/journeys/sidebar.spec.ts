import { test, expect, type Page } from "@playwright/test"
import { journey } from "../dsl"
import { beforeNeuralAuthNavigate, signInNeuralAuthSDK, waitNeuralAuthOwner } from "../fixtures/neural-auth-sdk"

/**
 * THE DRAWER (owner A5 · E1 · T-b; U45, U46 b, U49 a, U51 e, U53 a, U56 e — v1.242.0). One list
 * replaced the pane's three tabs. Each claim is read off what the drawer RENDERED (rows, their
 * markers, their rects) or what the frame PUBLISHED (`_fogLow`), never recomputed here:
 *   1. One drawer icon opens it, and nothing on screen is labelled "Menu".
 *   2. The order: Search, Explore (expandable: Positions, Transitions, Submissions, Systems,
 *      Principles, Learning), Train (Practice then Path, nothing else), Your lists, Last rolls,
 *      the badge.
 *   3. It draws over the map, the legend included, and the legend never moves.
 *   4. The badge shows today's cards and rolls before it is opened, and a real grade moves it.
 *   5. Practice's row carries the owed reviews and the day's goal; Path's row carries the worn
 *      belt; both, and Last rolls, open their views, and the brand leads back to the list.
 *   6. A lit page (a principle) fades the rest of the map to ~20%, smoothly, not at once.
 *   7. Keyboard: Tab reaches the badge, Enter opens its menu, and its small links work by key.
 *   8. A guest's badge offers to save; a signed-in player gets neither it nor the save toast.
 *   9. On a phone, a left swipe closes the drawer.
 *
 * Harness: the DSL serves `{}` for dossier chunks; no claim here reads one. Systems and concepts
 * payloads are real, so the six categories are awaited, not assumed. No gameplay rng branch is
 * reached: every test pauses or opens the drawer (which pauses) before it reads anything.
 * Mutants: tests/artifacts/sidebar_mutants.md.
 */

type W = Window & { __neural: any }
const drawer = (page: Page) => page.evaluate(() => !!(window as W).__neural.deckShown)

async function openDrawer(j: any, page: Page) {
  await j.clickByMouse(".ng-logo", "the drawer icon")
  await expect(page.locator(".ng-drawer-head")).toBeVisible()
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

test("the drawer lists Search, Explore, Train, your lists and Last rolls, in that order", async ({ page }) => {
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
  await expect(page.locator("[data-explore-stats] .ng-dr-row"), "Train is two rows, nothing under them").toHaveCount(2)
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

test("the drawer draws over the map and the legend, and the legend never moves", async ({ page }) => {
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

test("the badge shows today's cards and rolls before it is opened, and a real grade moves it", async ({ page }) => {
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
    a._pastRolls = [{ log: [{ name: "Mount", idx: 0, role: "Top" }, { name: "Armbar", idx: 0 }], outcome: "win", ts: Date.now() }]
    a.updateAccountUI()
  })
  await openDrawer(j, page)
  const today = page.locator(".ngAcctChip [data-badge-today]")
  await expect(today, "today, on the badge, unopened").toHaveText("Today: 3 of 20 cards · 1 roll")
  expect(await page.evaluate(() => document.querySelector(".ng-account-menu")!.getAttribute("data-open")), "the menu is shut").toBeNull()
  // Practice: grade the owed review, then come home by the brand
  await j.clickByMouse('[data-explore-stats] [data-b="due"]', "Practice")
  await expect(page.locator("[data-mini-reveal]").first()).toBeVisible()
  await page.locator("[data-mini-reveal]").scrollIntoViewIfNeeded()   // the pane chose the row; the mouse is measured
  await j.clickByMouse("[data-mini-reveal]", "Reveal")
  await expect(page.locator("[data-mini-got]")).toBeVisible()
  await page.locator("[data-mini-got]").scrollIntoViewIfNeeded()
  await j.clickByMouse("[data-mini-got]", "Got it")
  await j.clickByMouse(".ng-drawer-brand", "the brand, home")
  await expect(page.locator("[data-drawer-explore]")).toBeVisible()
  await expect(today, "the grade moved the badge").toHaveText("Today: 4 of 20 cards · 1 roll")
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
  // owed reviews open at once, before the planner loads (the eager queue, v1.207.0), under Practice's title
  await expect(page.locator(".ng-pane-drillhead"), "Practice opens the session").toContainText("Practice \u00b7 2 reviews")
  await j.clickByMouse(".ng-drawer-brand", "the brand, out of the session")
  await expect(page.locator("[data-drawer-explore]")).toBeVisible()
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
  // the frame's own fog level (`_fogLow`, published by draw), over ~80 real frames from a fresh start
  const levels: number[] = await page.evaluate(async () => {
    const a = (window as W).__neural, out: number[] = []
    a._fogMix = 0; a._fogT = performance.now()
    for (let i = 0; i < 80; i++) { await new Promise((r) => setTimeout(r, 16)); a.advance(17); out.push(a._fogLow) }
    return out
  })
  console.log("[sidebar] fog levels: " + levels.filter((_, i) => i % 8 === 0).map((v) => v.toFixed(2)).join(" "))
  expect(levels[0], "not at once: the first frame is still mostly clear (at once would read 0.20)").toBeGreaterThan(0.5)
  expect(levels.some((v) => v > 0.3 && v < 0.9), "it passes through the values between").toBe(true)
  expect(levels[levels.length - 1], "and settles at ~20%").toBeCloseTo(0.2, 2)
})

test("keyboard: Tab reaches the badge, Enter opens its menu, and its small links work by key", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await openDrawer(j, page)
  await page.locator(".ng-explorer-search input").focus()
  let reached = false
  for (let i = 0; i < 80 && !reached; i++) {
    await page.keyboard.press("Tab")
    reached = await page.evaluate(() => !!document.activeElement?.classList.contains("ngAcctChip"))
  }
  expect(reached, "Tab reaches the badge").toBe(true)
  await page.keyboard.press("Enter")
  await expect(page.locator(".ng-account-menu")).toHaveAttribute("data-open", "1")
  for (const sel of ["[data-menu-settings]", "[data-menu-feedback]", "[data-menu-request]", "[data-menu-terms]", "[data-menu-privacy]", "[data-gh-chip]"]) {
    const tag = await page.locator(".ng-account-menu " + sel).evaluate((el) => el.tagName)
    expect(["BUTTON", "A"], sel + " is a real control").toContain(tag)
  }
  await page.locator(".ng-account-menu [data-menu-terms]").focus()
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
  await expect(page.locator(".ng-account-menu [data-menu-account]")).toHaveText("Account preferences")
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
