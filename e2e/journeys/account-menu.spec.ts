import { test, expect, type Page } from "@playwright/test"
import { journey } from "../dsl"

/**
 * THE ACCOUNT MENU (v1.94.0) — the bottom-right chip stops opening the pane and opens a
 * compact account menu instead. Owner's contract, one line each:
 *
 *   1. A real mouse click on the chip opens `.ng-account-menu`, anchored above the chip —
 *      and does NOT open the pane, pause the game, or touch the roll clock (chrome, not
 *      gameplay).
 *   2. Signed out it holds EXACTLY: Create account · Log in │ Settings · Keyboard
 *      shortcuts · Terms · Privacy — one separator, no filler rows.
 *   3. Signed in the auth rows become: the account email (non-interactive) · Log out.
 *   4. Rows are wired to the surfaces that already exist: the auth modal (create/login),
 *      the Settings modal (Shortcuts deep-links its tab), the legal modals.
 *   5. Esc closes the menu FIRST (before the pane); an outside tap closes it too — even a
 *      tap on the pane, whose pointerdown stops propagation (the closer is capture-phase).
 *   6. The pane opener is the LOGO, top-left, only — it opens the pane on the LEFT and
 *      leaves the menu's corner alone.
 *   7. On a 390x844 phone both the chip and its menu sit in thumb reach without covering
 *      the transport band; every row is a 44px target.
 *   8. Under prefers-reduced-motion the menu appears static (no entry animation).
 */

const menuOpen = (page: Page) =>
  page.evaluate(() => {
    const m = document.querySelector(".ng-account-menu") as HTMLElement | null
    return !!m && m.style.display !== "none"
  })

const paused = (page: Page) => page.evaluate(() => !!(window as any).__neural.paused)
const paneShown = (page: Page) => page.evaluate(() => !!(window as any).__neural.deckShown)

test("the chip opens the menu — not the pane, not the pause latch, not the clock", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  await expect(page.locator(".ng-account-menu")).toBeAttached()
  expect(await menuOpen(page), "menu starts shut").toBe(false)

  await j.clickByMouse(".ngAcctChip", "the account chip")
  expect(await menuOpen(page), "chip click opened the menu").toBe(true)
  expect(await paneShown(page), "and did NOT open the pane").toBe(false)
  expect(await paused(page), "and did NOT stop the game").toBe(false)

  // the roll clock keeps running under the open menu — chrome never freezes gameplay
  const t0 = await page.evaluate(() => (window as any).__neural._decision?.remaining ?? null)
  await j.advance(2000)
  const t1 = await page.evaluate(() => (window as any).__neural._decision?.remaining ?? null)
  expect(t0, "a live hand has a decision clock").not.toBeNull()
  expect(t1, "the clock ran on — the menu did not touch it").toBeLessThan(t0!)

  // chip ARIA reflects the popup state
  await expect(page.locator(".ngAcctChip")).toHaveAttribute("aria-expanded", "true")

  // second chip click closes it again (toggle)
  await j.clickByMouse(".ngAcctChip", "the account chip again")
  expect(await menuOpen(page), "chip toggles the menu shut").toBe(false)
  await expect(page.locator(".ngAcctChip")).toHaveAttribute("aria-expanded", "false")
})

test("signed out: exactly the owner's rows, one separator, no filler", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await j.clickByMouse(".ngAcctChip", "the account chip")

  const menu = page.locator(".ng-account-menu")
  await expect(menu.locator("[data-menu-create]")).toContainText("Create account")
  await expect(menu.locator("[data-menu-login]")).toContainText("Log in")
  await expect(menu.locator("[data-menu-sep]"), "ONE separator").toHaveCount(1)
  await expect(menu.locator("[data-menu-settings]")).toContainText("Settings")
  await expect(menu.locator("[data-menu-shortcuts]")).toContainText("Keyboard shortcuts")
  await expect(menu.locator("[data-menu-terms]")).toContainText("Terms")
  await expect(menu.locator("[data-menu-privacy]")).toContainText("Privacy")
  // no filler: those six buttons are the WHOLE menu (email/logout are signed-in only)
  await expect(menu.locator("button")).toHaveCount(6)
  await expect(menu.locator("[data-menu-email]")).toHaveCount(0)
  await expect(menu.locator("[data-menu-logout]")).toHaveCount(0)

  // geometry: anchored ABOVE the chip, hugging the same right edge
  const m = (await menu.boundingBox())!
  const chip = (await page.locator(".ngAcctChip").boundingBox())!
  expect(m.y + m.height, "menu sits above the chip").toBeLessThanOrEqual(chip.y + 1)
  const vp = page.viewportSize()!
  expect(vp.width - (m.x + m.width), "on the chip's right edge").toBeLessThan(60)
})

test("signed in: email row (non-interactive) + Log out; logging out flips the chip", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  // seed a signed-in identity through the same seam the SIGNED_IN handler uses
  await page.evaluate(() => {
    const a = (window as any).__neural
    a._applyUser({ email: "diogo@example.com", user_metadata: { full_name: "Diogo" } })
  })
  await expect(page.locator(".ngAcctChip")).toContainText("Diogo")

  await j.clickByMouse(".ngAcctChip", "the signed-in chip")
  const menu = page.locator(".ng-account-menu")
  await expect(menu.locator("[data-menu-email]")).toContainText("diogo@example.com")
  expect(
    await menu.locator("[data-menu-email]").evaluate((el) => el.tagName),
    "the email row is not a button",
  ).not.toBe("BUTTON")
  await expect(menu.locator("[data-menu-logout]")).toContainText("Log out")
  await expect(menu.locator("[data-menu-create]"), "no create row when signed in").toHaveCount(0)
  await expect(menu.locator("[data-menu-login]"), "no login row when signed in").toHaveCount(0)
  await expect(menu.locator("[data-menu-sep]"), "still ONE separator").toHaveCount(1)
  // email + logout replace create + login: five buttons + the email div
  await expect(menu.locator("button")).toHaveCount(5)

  await j.clickByMouse("[data-menu-logout]", "the Log out row")
  expect(await menuOpen(page), "acting on a row closes the menu").toBe(false)
  await expect(page.locator(".ngAcctChip"), "back to Guest").toContainText("Guest")
})

test("rows open the real surfaces: auth modal, Settings, Shortcuts tab, Terms", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  await j.clickByMouse(".ngAcctChip", "the account chip")
  await j.clickByMouse("[data-menu-create]", "the Create account row")
  expect(await menuOpen(page), "menu closed before the modal").toBe(false)
  await expect(page.locator("body")).toContainText("Create your account")
  await page.evaluate(() => (window as any).__neural.closeModal())

  await j.clickByMouse(".ngAcctChip", "the account chip")
  await j.clickByMouse("[data-menu-login]", "the Log in row")
  await expect(page.locator("body")).toContainText("Welcome back")
  await page.evaluate(() => (window as any).__neural.closeModal())

  await j.clickByMouse(".ngAcctChip", "the account chip")
  await j.clickByMouse("[data-menu-shortcuts]", "the Keyboard shortcuts row")
  await expect(page.locator("body"), "Settings opened").toContainText("Settings")
  expect(
    await page.evaluate(() => (window as any).__neural._settingsTab),
    "deep-linked to the Shortcuts tab",
  ).toBe("shortcuts")
  await page.evaluate(() => (window as any).__neural.closeModal())

  await j.clickByMouse(".ngAcctChip", "the account chip")
  await j.clickByMouse("[data-menu-settings]", "the Settings row")
  expect(
    await page.evaluate(() => (window as any).__neural._settingsTab),
    "plain Settings opens its first tab",
  ).toBe("flashcards")
  await page.evaluate(() => (window as any).__neural.closeModal())

  await j.clickByMouse(".ngAcctChip", "the account chip")
  await j.clickByMouse("[data-menu-terms]", "the Terms row")
  await expect(page.locator("body")).toContainText("Terms of Use")
})

test("Esc closes the menu first; an outside tap closes it too — pane untouched", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  // Esc ordering: pane open (via the logo) + menu open on top — Esc eats the MENU first
  await j.clickByMouse(".ng-logo", "the logo (the pane opener)")
  expect(await paneShown(page), "logo opened the pane").toBe(true)
  await j.clickByMouse(".ngAcctChip", "the account chip, over the open pane")
  expect(await menuOpen(page), "menu opens while the pane is up").toBe(true)
  expect(await paneShown(page), "without touching the pane").toBe(true)

  await page.keyboard.press("Escape")
  expect(await menuOpen(page), "first Esc closed the menu").toBe(false)
  expect(await paneShown(page), "…and left the pane alone").toBe(true)
  await page.keyboard.press("Escape")
  expect(await paneShown(page), "second Esc closed the pane (existing order)").toBe(false)

  // outside tap: the graph
  await j.clickByMouse(".ngAcctChip", "the account chip")
  expect(await menuOpen(page)).toBe(true)
  await page.mouse.click(400, 300) // empty graph — outside the wrap
  expect(await menuOpen(page), "outside tap closed the menu").toBe(false)

  // outside tap on a surface that STOPS PROPAGATION (the pane) still counts as outside
  await j.clickByMouse(".ng-logo", "the logo")
  expect(await paneShown(page)).toBe(true)
  await j.clickByMouse(".ngAcctChip", "the account chip")
  expect(await menuOpen(page)).toBe(true)
  await j.clickByMouse(".ng-learning-nav [data-view='history']", "a pane tab (stops propagation)")
  expect(await menuOpen(page), "tapping the pane closed the menu").toBe(false)
  expect(await paneShown(page), "and the pane itself carried on").toBe(true)
})

test("the logo opens the pane on the LEFT and only the pane", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  await j.clickByMouse(".ng-logo", "the top-left logo")
  expect(await paneShown(page), "pane open").toBe(true)
  expect(await menuOpen(page), "menu untouched").toBe(false)

  const pane = (await page.locator(".ng-drill").boundingBox())!
  expect(pane.x, "the pane anchors the LEFT edge").toBeLessThan(2)
  expect(pane.width, "desktop rail width").toBeGreaterThanOrEqual(340)

  // the chip no longer sits under the pane on desktop — it stays put and stays clickable
  for (let i = 0; i < 20; i++) await j.advance(500)
  const chip = await page.evaluate(() => {
    const el = document.querySelector(".ng-acctwrap") as HTMLElement
    return { o: parseFloat(el.style.opacity || "1"), pe: el.style.pointerEvents }
  })
  expect(chip.o, "no desktop fade — the pane is on the other side now").toBeGreaterThan(0.9)
  expect(chip.pe, "chip keeps taking clicks").not.toBe("none")
  await j.clickByMouse(".ngAcctChip", "the chip beside the open pane")
  expect(await menuOpen(page), "menu opens with the pane up").toBe(true)
})

test("phone 390x844: chip + menu in thumb reach, clear of the transport band, 44px rows", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  const chip = (await page.locator(".ngAcctChip").boundingBox())!
  expect(chip.height, "44px chip target on touch").toBeGreaterThanOrEqual(43)
  expect(chip.y, "bottom half — thumb reach").toBeGreaterThan(844 * 0.6)

  await j.clickByMouse(".ngAcctChip", "the phone account chip")
  expect(await menuOpen(page)).toBe(true)

  const m = (await page.locator(".ng-account-menu").boundingBox())!
  const bar = (await page.locator(".ng-transport").boundingBox())!
  const overlaps =
    m.x < bar.x + bar.width && bar.x < m.x + m.width && m.y < bar.y + bar.height && bar.y < m.y + m.height
  expect(overlaps, "menu clears the transport band").toBe(false)
  expect(m.x, "menu fully on-screen").toBeGreaterThanOrEqual(0)
  expect(m.x + m.width).toBeLessThanOrEqual(390)
  expect(m.y).toBeGreaterThanOrEqual(0)

  // every row is a 44px target
  const rows = await page.locator(".ng-account-menu button").all()
  expect(rows.length).toBeGreaterThan(0)
  for (const r of rows) {
    const b = (await r.boundingBox())!
    expect(b.height, "44px row").toBeGreaterThanOrEqual(43)
  }

  // and a row actually works from the thumb: Log in opens the auth modal
  await j.clickByMouse("[data-menu-login]", "the Log in row")
  await expect(page.locator("body")).toContainText("Welcome back")
})

test("reduced motion: the menu appears static", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  await j.clickByMouse(".ngAcctChip", "the account chip")
  expect(await menuOpen(page)).toBe(true)
  expect(
    await page
      .locator(".ng-account-menu")
      .evaluate((el) => getComputedStyle(el).animationName),
    "no entry animation under reduced motion",
  ).toBe("none")
})
