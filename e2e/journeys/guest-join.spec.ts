import { test, expect, type Page } from "@playwright/test"
import { journey } from "../dsl"
import { beforeNeuralAuthNavigate, signInNeuralAuthSDK, waitNeuralAuthOwner } from "../fixtures/neural-auth-sdk"

/**
 * GUEST PRACTICE JOINS THE ACCOUNT AT SIGN-IN (v1.262.0, the owner U138 a, 11 Nov: "Always automatic"). It replaces the
 * badge menu's "Review guest progress" row and its Import dialog. The merge rule and its units are in
 * tests/guest_join_safety.test.mjs; this journey is what a player meets, in the built app, at 1440 by mouse and at
 * 390x844 by touch:
 *   1. a guest who practised signs in: the account holds the practice, the board says "Your practice from before you
 *      signed in is saved", and that line COVERS NO CONTROL (its text's rects meet no visible control's rect, and the
 *      announcer takes no pointer events), and the badge menu has no import row;
 *   2. ONCE: a reload of the same account keeps the practice and says nothing;
 *   3. a SECOND account signing in on the same browser receives the guest practice too, and is told once (the owner's
 *      pick, knowing it: not a leak to "fix").
 * The guest copy is seeded through the harness's `initialState` (a guest copy on the device); the sign-in goes through
 * the real facade with a stub SDK (e2e/fixtures/neural-auth-sdk.ts). The harness serves `{}` for dossier chunks, so no
 * film or article content shows; nothing here depends on either.
 * MUTANTS (2026-11-12, each turned the claim named red; see the archive entry for v1.262.0):
 *   the kicker an empty string instead of a non-breaking space → 390 "covers no control" (the sentence rises onto the
 *     row of the top-left drawer and search icons)
 *   the menu row restored                                      → both widths, "no import row"
 *   the join run on every visit (the mark never read)           → both widths, "once"
 */

const LINE = "Your practice from before you signed in is saved"
const GUEST = { v: 2, prep: { "Mount|Top": 3, "Closed Guard|Bottom": 2 }, rec: { "Mount|Top": 3 },
  lists: { gl1: { name: "Guest list", t: 1762000000000, items: ["Positions/Mount"] } } }

// what the announcer shows, and every visible control its text's rects meet
const lineCover = (page: Page) => page.evaluate(() => {
  const a = (window as any).__neural, box = a.evRef.current as HTMLElement, t = a.evTextRef.current as HTMLElement
  const range = document.createRange(); range.selectNodeContents(t)
  const rects = [...range.getClientRects()].filter((x) => x.width > 0 && x.height > 0)
  const visible = (el: Element) => {
    for (let o: Element | null = el; o; o = o.parentElement) {
      const cs = getComputedStyle(o)
      if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) === 0) return false
    }
    const b = el.getBoundingClientRect()
    return b.width > 0 && b.height > 0 && b.bottom > 0 && b.top < innerHeight && b.right > 0 && b.left < innerWidth
  }
  const controls = [...document.querySelectorAll('button, a[href], [role="button"], [role="menuitem"], [role="tab"], input, select, textarea')]
    .filter((el) => !box.contains(el) && visible(el))
  const hits: string[] = []
  for (const el of controls) {
    const b = el.getBoundingClientRect()
    if (rects.some((x) => x.left < b.right && x.right > b.left && x.top < b.bottom && x.bottom > b.top))
      hits.push((el.getAttribute("aria-label") || el.textContent || el.tagName).trim().slice(0, 40))
  }
  return { text: (t.textContent || "").trim(), shown: box.style.opacity === "1", pointer: getComputedStyle(box).pointerEvents,
    lines: rects.length, controls: controls.length, hits }
})
const held = (page: Page) => page.evaluate(() => (window as any).__neural.prep["Mount|Top"] || 0)

async function press(page: Page, sel: string, what: string, touch: boolean) {
  const j = journey(page)
  if (!touch) return j.clickByMouse(sel, what)
  const at = await page.evaluate((s) => {
    const el = document.querySelector(s) as HTMLElement | null
    if (!el) return null
    const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2
    const top = document.elementFromPoint(x, y)
    return top && (top === el || el.contains(top)) ? { x, y } : null
  }, sel)
  expect(at, what + ": its centre is on screen and nothing covers it").not.toBeNull()
  await page.touchscreen.tap(at!.x, at!.y)
}
async function openMenu(page: Page, touch: boolean) {
  if (!(await page.locator(".ngAcctChip").isVisible())) await press(page, ".ng-logo", "the drawer icon", touch)
  await press(page, ".ngAcctChip", "the badge", touch)
  await expect(page.locator(".ng-account-menu")).toBeVisible()
}

async function story(page: Page, touch: boolean) {
  const j = journey(page)
  await j.boot("/", { beforeNavigate: beforeNeuralAuthNavigate, initialState: GUEST })
  await waitNeuralAuthOwner(page, null)
  expect(await held(page), "the guest copy is on the device").toBe(3)

  // 1. the sign-in joins the practice, and the line says so where it covers nothing
  await signInNeuralAuthSDK(page, "guest-join-a", { email: "player@example.com", name: "Player" })
  expect(await held(page), "the account holds the guest practice").toBe(3)
  expect(await page.evaluate(() => Object.values((window as any).__neural.lists).map((l: any) => l.name)), "and the guest's list").toContain("Guest list")
  await expect.poll(async () => (await lineCover(page)).text, { timeout: 30_000 }).toBe(LINE)
  const c = await lineCover(page)
  expect(c.shown, "the line is showing").toBe(true)
  expect(c.pointer, "the announcer takes no pointer events").toBe("none")
  expect(c.lines, "the sentence was measured").toBeGreaterThan(0)
  expect(c.controls, "controls were found to check against (positive coverage)").toBeGreaterThan(3)
  expect(c.hits, "covers no control").toEqual([])
  await openMenu(page, touch)
  const menu = page.locator(".ng-account-menu")
  await expect(menu.locator("[data-menu-email]")).toContainText("player@example.com")
  await expect(menu.locator("[data-menu-import-guest]"), "no import row").toHaveCount(0)
  await expect(menu, "no import row").not.toContainText("guest progress")

  // 2. once: the same account again, from a fresh page load, keeps the practice and is told nothing
  await j.boot("/", { preserveStorage: true, beforeNavigate: async (p) => { await p.route(/\/app\/game-values\.js(?:\?|$)/, (r) => r.abort("failed")) } })
  await waitNeuralAuthOwner(page, "guest-join-a")
  await expect.poll(() => page.evaluate(() => !!(window as any).__neural._decision), { timeout: 30_000 }).toBe(true)
  expect(await held(page), "the practice stayed with the account").toBe(3)
  await page.waitForTimeout(1500)
  expect((await lineCover(page)).text, "once").not.toBe(LINE)

  // 3. a second account on the same browser receives it too (the owner's pick), and is told once
  await openMenu(page, touch)
  await press(page, "[data-menu-logout]", "Sign out", touch)
  await waitNeuralAuthOwner(page, null)
  expect(await held(page), "signing out plays the guest copy, still there").toBe(3)
  await signInNeuralAuthSDK(page, "guest-join-b", { email: "player@example.com", name: "Player" })
  expect(await held(page), "a second account receives the guest practice too").toBe(3)
  await expect.poll(async () => (await lineCover(page)).text, { timeout: 30_000 }).toBe(LINE)
}

test("a guest who practised signs in at 1440: the practice joins, one line that covers no control, no menu row, once, a second account too", async ({ page }) => {
  await story(page, false)
})

test.describe("phone 390x844, by touch", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  test("a guest who practised signs in at 390: the practice joins, one line that covers no control, no menu row, once, a second account too", async ({ page }) => {
    await story(page, true)
  })
})
