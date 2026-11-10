import { expect, test, type Page } from "@playwright/test"
import { journey } from "../dsl"

/**
 * v1.255.2: `neural_signin_completed` counts the sign-ins this browser started, once. tests/save_echo.test.mjs pins the rule through
 * the real auth listener (tab returns, page-load restores, other tabs and stale intents count nothing; an intent counts once with its
 * method and mode). This journey pins the WIRING the units cannot reach: pressing "Continue with Google" in the sign-in modal, by
 * mouse, writes that intent, and the start is still tracked; so does "Log in" with an email and password (#360's review, E1); and an
 * attempt that fails in place, either way, removes it (E5), so a later restore cannot spend it.
 *
 * HARNESS: the façade is served unconfigured (keyless), so `signInWithGoogle` is replaced by a no-navigation stub as the façade is
 * installed. PostHog is a capture spy assigned after boot. NOT HERE: the completion. Emitting SIGNED_IN for a new account in this
 * harness switches the progress owner and remounts the app, which never settles without the frame pump; the unit file drives that.
 * Red-proof (tests/artifacts/neural_app_mutants.mjs, each killed at its claim): `google-intent-unwritten` ("the Google button
 * writes the intent"), `email-intent-unwritten` ("Log in writes the intent"), `email-failure-keeps-intent` and
 * `google-failure-keeps-intent` ("a failed attempt leaves no intent").
 */

const KEY = "bjj-neural-signin-intent"

async function boot(page: Page) {
  await page.addInitScript(() => {
    let real: any
    Object.defineProperty(window, "__bjjAuth", {
      configurable: true,
      get: () => real,
      set: (facade: any) => {
        real = facade
        if (!facade) return
        // the attempt's outcome is the spec's to choose: success by default, a failure shown in the form when set
        facade.signInWithGoogle = async () => (window as any).__googleResult || { error: null }
        facade.signIn = async () => (window as any).__signInResult || { error: null }
      },
    })
  })
  const j = journey(page)
  await j.boot("/")
  await page.evaluate(() => { const w = window as any; w.__ph = []; w.posthog = { capture: (e: string, p: any) => w.__ph.push([e, p]) } })
  return j
}
const events = (page: Page, name: string) => page.evaluate(n => (window as any).__ph.filter(([e]: [string]) => e === n).map(([, p]: [string, any]) => p), name)

test("@curated v1.255.2: Continue with Google writes the sign-in intent its SIGNED_IN will count (1440, by mouse)", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const j = await boot(page)
  await j.clickByMouse(".ng-logo", "the drawer button")
  await j.clickByMouse(".ngAcctChip", "the badge")
  await j.clickByMouse("[data-menu-login]", "Log in")
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find(x => /Continue with Google/.test(x.textContent || ""))
    if (!b) throw Error("no Google button"); b.setAttribute("data-spec-google", "")
  })
  await j.clickByMouse("[data-spec-google]", "Continue with Google")
  const intent = await page.evaluate(k => JSON.parse(localStorage.getItem(k) || "null"), KEY)
  expect(intent && { method: intent.method, mode: intent.mode }, "the Google button writes the intent").toEqual({ method: "google", mode: "login" })
  expect(Math.abs(Date.now() - intent.at), "stamped now").toBeLessThan(60_000)
  expect(await events(page, "neural_signin_started"), "premise: the start is tracked as before").toEqual([{ method: "google", mode: "login", variant: "neural" }])
})

async function openLogin(page: Page, j: ReturnType<typeof journey>) {
  await j.clickByMouse(".ng-logo", "the drawer button")
  await j.clickByMouse(".ngAcctChip", "the badge")
  await j.clickByMouse("[data-menu-login]", "Log in")
}
async function tagButton(page: Page, text: RegExp, attr: string) {
  await page.evaluate(([src, a]) => {
    const re = new RegExp(src), b = [...document.querySelectorAll("button")].find(x => re.test((x.textContent || "").trim()))
    if (!b) throw Error("no button " + src); b.setAttribute(a, "")
  }, [text.source, attr] as [string, string])
}
async function logIn(page: Page, j: ReturnType<typeof journey>) {
  await j.clickByMouse('input[type="email"]', "the email field"); await page.keyboard.type("spec@example.invalid")
  await j.clickByMouse('input[type="password"]', "the password field"); await page.keyboard.type("not-a-real-password")
  await tagButton(page, /^Log in$/, "data-spec-login")
  await j.clickByMouse("[data-spec-login]", "Log in")
}
const intentOf = (page: Page) => page.evaluate(k => JSON.parse(localStorage.getItem(k) || "null"), KEY)

test("@curated v1.255.2: Log in with an email writes the sign-in intent (1440, by mouse)", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const j = await boot(page)
  await openLogin(page, j)
  await logIn(page, j)
  await expect.poll(async () => { const i = await intentOf(page); return i && { method: i.method, mode: i.mode } }, { message: "Log in writes the intent" }).toEqual({ method: "email", mode: "login" })
})

test("@curated v1.255.2: a sign-in attempt that fails in place leaves no intent, email or Google (1440, by mouse)", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const j = await boot(page)
  await page.evaluate(() => { (window as any).__signInResult = { error: "Invalid login credentials" }; (window as any).__googleResult = { error: "The pop-up was closed" } })
  await openLogin(page, j)
  await logIn(page, j)
  await expect(page.getByText("Invalid login credentials"), "premise: the failure shows in the form").toBeVisible()
  expect(await intentOf(page), "a failed attempt leaves no intent (email)").toBeNull()
  await tagButton(page, /Continue with Google/, "data-spec-google")
  await j.clickByMouse("[data-spec-google]", "Continue with Google")
  await expect(page.getByText("The pop-up was closed"), "premise: the Google failure shows in the form").toBeVisible()
  expect(await intentOf(page), "a failed attempt leaves no intent (Google)").toBeNull()
})
