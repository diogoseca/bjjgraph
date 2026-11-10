import { expect, test, type Page } from "@playwright/test"
import { journey } from "../dsl"

/**
 * v1.255.2: `neural_signin_completed` counts the sign-ins this browser started, once. tests/save_echo.test.mjs pins the rule through
 * the real auth listener (tab returns, page-load restores, other tabs and stale intents count nothing; an intent counts once with its
 * method and mode). This journey pins the WIRING the units cannot reach: pressing "Continue with Google" in the sign-in modal, by
 * mouse, writes that intent, and the start is still tracked.
 *
 * HARNESS: the façade is served unconfigured (keyless), so `signInWithGoogle` is replaced by a no-navigation stub as the façade is
 * installed. PostHog is a capture spy assigned after boot. NOT HERE: the completion. Emitting SIGNED_IN for a new account in this
 * harness switches the progress owner and remounts the app, which never settles without the frame pump; the unit file drives that.
 * Red-proof: tests/artifacts/neural_app_mutants.mjs `google-intent-unwritten` (the button's intent write removed) is killed at
 * "the Google button writes the intent".
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
        facade.signInWithGoogle = async () => ({ error: null })
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
