import { test, expect, type Page } from "@playwright/test"
import { journey } from "../dsl"
import { beforeNeuralAuthNavigate, signInNeuralAuthSDK, waitNeuralAuthOwner } from "../fixtures/neural-auth-sdk"

/**
 * THE BADGE AND ITS MENU (owner U46 b, v1.242.0) — the account chip that sat bottom-right since
 * v1.94.0 is now the badge at the drawer's foot (see sidebar.spec.ts for the drawer itself). The
 * owner's contract, one line each:
 *
 *   1. The badge is inside the drawer; a mouse click opens `.ng-account-menu` above it, and a second
 *      click shuts it. The drawer already holds the game paused (pane law); the menu changes nothing.
 *   2. The menu is short. Signed out: Mastered (the detail, after opening) │ Settings · Feedback ·
 *      Create account · Log in, and one small line: Terms · Privacy · GitHub (U67 a).
 *   3. Signed in: the email (not a control) · Mastered │ Settings · Feedback ·
 *      Sign out (+ Review guest progress when an owned guest cache exists). Sign out flips the badge.
 *   4. Rows open the real surfaces: the auth modal, Settings (including its Notifications tab, U60 b), the merged Feedback form (U67 a), the legal modals, the Mastered list.
 *   5. Esc closes the menu FIRST, then the drawer; an outside tap closes the menu too.
 *   6. On a 390x844 phone the badge and its menu sit in thumb reach and on screen; the main rows are
 *      44px targets, the small line's at least 24px.
 *   7. Under prefers-reduced-motion the menu appears static.
 * Keyboard reach (Tab to the badge, Enter, the small links by key) is sidebar.spec.ts's claim 7.
 * U61 c / U67 a red-proof (SIDECX2): restoring About or the separate Request a technique row
 * each fails its named absence assertion in the signed-out claim (1 test ran per control).
 * Both killed; no new non-kills. Exact patches: tests/artifacts/sidebar_r3_mutants.json.
 */

const menuOpen = (page: Page) =>
  page.evaluate(() => {
    const m = document.querySelector(".ng-account-menu") as HTMLElement | null
    return !!m && m.style.display !== "none"
  })
const paneShown = (page: Page) => page.evaluate(() => !!(window as any).__neural.deckShown)

test("the badge sits in the drawer and opens its menu above itself", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await expect(page.locator(".ngAcctChip"), "no corner chip on the map").toBeHidden()
  await j.clickByMouse(".ng-logo", "the drawer icon")
  expect(await page.locator(".ngAcctChip").evaluate((el) => !!el.closest(".ng-drill")), "the badge is in the drawer").toBe(true)
  expect(await menuOpen(page), "menu starts shut").toBe(false)
  await j.clickByMouse(".ngAcctChip", "the badge")
  expect(await menuOpen(page), "badge click opened the menu").toBe(true)
  expect(await paneShown(page), "the drawer stays").toBe(true)
  await expect(page.locator(".ngAcctChip")).toHaveAttribute("aria-expanded", "true")
  const m = await j.boxOf(".ng-account-menu", "the account menu")
  const badge = await j.boxOf(".ngAcctChip", "the badge")
  expect(m.y + m.height, "menu sits above the badge").toBeLessThanOrEqual(badge.y + 1)
  await j.clickByMouse(".ngAcctChip", "the badge again")
  expect(await menuOpen(page), "the badge toggles the menu shut").toBe(false)
  await expect(page.locator(".ngAcctChip")).toHaveAttribute("aria-expanded", "false")
})

test("signed out: a short menu and one small line", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await j.openAccountMenu()
  const menu = page.locator(".ng-account-menu")
  await expect(menu.locator("[data-menu-mastered]")).toContainText(/^Mastered \d+ · \d+%$/)
  await expect(menu.locator("[data-menu-sep]"), "ONE separator").toHaveCount(1)
  await expect(menu.locator("[data-menu-settings]")).toHaveText("Settings")
  await expect(menu.locator("[data-menu-feedback]")).toHaveText("Feedback")
  await expect(menu.locator("[data-menu-feedback]"), "U67 a: one Feedback row").toHaveCount(1)
  await expect(menu.locator("[data-menu-request]"), "U67 a: no separate technique row").toHaveCount(0)
  await expect(menu.getByRole("menuitem", { name: "About", exact: true }), "U61 c: About stays absent").toHaveCount(0)
  await expect(menu.locator("[data-menu-create]")).toHaveText("Create account")
  await expect(menu.locator("[data-menu-login]")).toHaveText("Log in")
  await expect(menu.locator("[data-menu-account]"), "U60 b: preferences live in Settings").toHaveCount(0)
  await expect(menu.locator("[data-menu-shortcuts]"), "Keyboard shortcuts are Settings' own tab").toHaveCount(0)
  const small = menu.locator(".ng-menu-small > *")
  await expect(small).toHaveText(["Terms", "Privacy", /GitHub|★/])
  await expect(menu.locator("button")).toHaveCount(7)
  await expect(menu.locator("[data-menu-email]")).toHaveCount(0)
  await expect(menu.locator("[data-menu-logout]")).toHaveCount(0)
  // a storage failure says so in the menu, and only then (inventory row 105)
  await expect(menu.locator('[role="status"]')).toHaveCount(0)
  await page.keyboard.press("Escape")
  await page.evaluate(() => { (window as any).__neural._progressStorageError = true })
  await j.openAccountMenu()
  await expect(menu.locator('[role="status"]')).toContainText("Progress could not be saved on this device")
})

test("signed in with legacy progress: email, Settings, Sign out; sign out flips the badge", async ({ page }) => {
  const j = journey(page)
  await j.boot("/", { beforeNavigate: beforeNeuralAuthNavigate })
  await waitNeuralAuthOwner(page, null)
  // Both sources are valid: this must catch a restored legacy row, not just an empty browser.
  const legacy = {
    "bjj-neural-progress": '{ "v": 2, "prep": { "legacy": 7 } }\n',
    "bjj-neural-ladder": '{ "rank": 3 }',
    "bjj-neural-firstroll": "1",
    "bjj-neural-coached": "1",
  }
  await page.evaluate((entries) => {
    ;(window as any).__neural._flushSave()
    for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value)
  }, legacy)
  await signInNeuralAuthSDK(page, "account-menu-user", { email: "diogo@example.com", name: "Diogo" })
  await j.land("Mount Top")
  await expect(page.locator(".ngAcctChip")).toContainText("Diogo")
  await j.openAccountMenu("the signed-in badge")
  const menu = page.locator(".ng-account-menu")
  await expect(menu.locator("[data-menu-email]")).toContainText("diogo@example.com")
  expect(await menu.locator("[data-menu-email]").evaluate((el) => el.tagName), "the email row is not a button").not.toBe("BUTTON")
  await expect(menu.locator("[data-menu-account]"), "U60 b: only Settings remains").toHaveCount(0)
  await expect(menu.locator("[data-menu-settings]")).toHaveCount(1)
  await expect(menu.locator("[data-menu-logout]")).toHaveText("Sign out")
  await expect(menu.locator("[data-menu-create]"), "no create row when signed in").toHaveCount(0)
  await expect(menu.locator("[data-menu-login]"), "no login row when signed in").toHaveCount(0)
  await expect(menu.locator("[data-menu-sep]"), "still ONE separator").toHaveCount(1)
  await expect(menu.locator("[data-menu-import-guest]")).toHaveText("Review guest progress")
  await expect(menu.locator("button")).toHaveCount(7)
  // U60 b: Account preferences is folded into Settings; Notifications is still reachable there.
  await j.clickByMouse("[data-menu-settings]", "Settings")
  await expect(page.locator("#ng-stab-notifications")).toBeVisible()
  await j.clickByMouse("#ng-stab-notifications", "Notifications in Settings")
  await expect(page.locator("#ng-stab-notifications"), "Settings opened on Notifications").toHaveAttribute("aria-selected", "true")
  await expect(page.locator('[role="tabpanel"]')).toHaveAttribute("aria-labelledby", "ng-stab-notifications")
  expect(await page.evaluate(() => (window as any).__neural._settingsTab)).toBe("notifications")
  await page.evaluate(() => (window as any).__neural.closeModal())
  await j.openAccountMenu("the signed-in badge, again")

  await j.clickByMouse("[data-menu-logout]", "Sign out")
  await waitNeuralAuthOwner(page, null)
  expect(await menuOpen(page), "acting on a row closes the menu").toBe(false)
  await expect(page.locator(".ngAcctChip"), "back to Guest").toContainText("Guest")
  expect(await page.evaluate((keys) => Object.fromEntries(keys.map((key) => [key, localStorage.getItem(key)])), Object.keys(legacy)),
    "sign-in, menu use and sign-out preserve every legacy byte").toEqual(legacy)
})

test("rows open the real surfaces", async ({ page }) => {
  const j = journey(page)
  // the star count is asked for once per page, however often the menu renders (SIDE-R2 M5); the harness
  // aborts the request, the miss every first visit, 403 or offline player meets
  let gh = 0
  page.on("request", (r) => { if (r.url().startsWith("https://api.github.com/")) gh++ })
  await j.boot("/")
  await j.land("Mount Top")
  const via = async (sel: string, what: string) => { await j.openAccountMenu(); await j.clickByMouse(sel, what); expect(await menuOpen(page), "menu closed before " + what).toBe(false) }
  const close = () => page.evaluate(() => (window as any).__neural.closeModal())

  await via("[data-menu-create]", "Create account"); await expect(page.locator("body")).toContainText("Create your account"); await close()
  await via("[data-menu-login]", "Log in"); await expect(page.locator("body")).toContainText("Welcome back"); await close()
  await via("[data-menu-settings]", "Settings")
  expect(await page.evaluate(() => (window as any).__neural._settingsTab), "plain Settings opens its first tab").toBe("flashcards"); await close()
  await via("[data-menu-feedback]", "Feedback"); await expect(page.locator("[data-feedback-title]")).toHaveText("Feedback"); await close()
  await via("[data-menu-terms]", "Terms"); await expect(page.locator("body")).toContainText("Terms of Use"); await close()
  await via("[data-menu-privacy]", "Privacy"); await expect(page.locator("body")).toContainText("Privacy Policy"); await close()
  await via("[data-menu-mastered]", "Mastered"); await expect(page.locator(".ng-modal")).toContainText("Mastered"); await close()
  await j.openAccountMenu()
  await expect(page.locator("[data-gh-chip]")).toHaveAttribute("href", "https://github.com/diogoseca/bjjgraph")
  expect(gh, "repeated menu renders, one star request").toBe(1)
})

test("Esc closes the menu first, then the drawer; an outside tap closes the menu", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await j.openAccountMenu()
  expect(await menuOpen(page)).toBe(true)
  await page.keyboard.press("Escape")
  expect(await menuOpen(page), "first Esc closed the menu").toBe(false)
  expect(await paneShown(page), "…and left the drawer alone").toBe(true)
  await page.keyboard.press("Escape")
  expect(await paneShown(page), "second Esc closed the drawer").toBe(false)

  await j.openAccountMenu()
  expect(await menuOpen(page)).toBe(true)
  await j.clickByMouse("[data-drawer-explore]", "a drawer row (it stops propagation)")
  expect(await menuOpen(page), "tapping the drawer closed the menu").toBe(false)
  expect(await paneShown(page), "and the drawer carried on").toBe(true)
  await j.openAccountMenu()
  await page.mouse.click(1000, 300) // the map, outside the drawer
  expect(await menuOpen(page), "an outside tap closed the menu").toBe(false)
})

test("phone 390x844: the badge and its menu in thumb reach, on screen, with real targets", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await j.clickByMouse(".ng-logo", "the drawer icon")
  const badge = await j.boxOf(".ngAcctChip", "the badge")
  expect(badge.height, "44px badge target").toBeGreaterThanOrEqual(43)
  expect(badge.y, "bottom of the drawer — thumb reach").toBeGreaterThan(844 * 0.8)
  await j.clickByMouse(".ngAcctChip", "the phone badge")
  expect(await menuOpen(page)).toBe(true)
  const m = (await page.locator(".ng-account-menu").boundingBox())!
  expect(m.x, "menu fully on-screen").toBeGreaterThanOrEqual(0)
  expect(m.x + m.width).toBeLessThanOrEqual(390)
  expect(m.y).toBeGreaterThanOrEqual(0)
  for (const r of await page.locator(".ng-account-menu > button").all()) expect((await r.boundingBox())!.height, "44px row").toBeGreaterThanOrEqual(43)
  for (const r of await page.locator(".ng-account-menu .ng-menu-small > *").all()) expect((await r.boundingBox())!.height, "small links still a 24px target").toBeGreaterThanOrEqual(24)
  await j.clickByMouse("[data-menu-login]", "the Log in row")
  await expect(page.locator("body")).toContainText("Welcome back")
})

test("reduced motion: the menu appears static", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await j.openAccountMenu()
  expect(await menuOpen(page)).toBe(true)
  expect(await page.locator(".ng-account-menu").evaluate((el) => getComputedStyle(el).animationName), "no entry animation under reduced motion").toBe("none")
})
