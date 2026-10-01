import { expect, test } from "@playwright/test"
import { journey } from "../dsl"

/**
 * THE HARNESS NAMES EVERY NAVIGATION THE PAGE STARTS (FGNAV1, 2026-10-01; see `watchNavigations` in
 * e2e/dsl.ts). A curated deploy gate failed once with "Execution context was destroyed" in
 * game-knowledge.spec.ts after the page re-booted under the test; 56 keyed local runs never
 * reproduced it. These journeys pin the tripwire itself, so the next occurrence names its cause:
 *   - a declared navigation is recorded, with its initiator's JS stack, and does not fail;
 *   - an UNDECLARED one fails the journey (test.fail: this test passes only BECAUSE it fails);
 *   - same-document history (pushState) and the harness's own reload are never recorded.
 * Mutants, recorded 2026-10-01: dropping the soft assertion turns the undeclared case red ("expected
 * to fail, but passed"); dropping the sameDocument filter turns the pushState case red; and a
 * `location.reload()` injected after a Challenges grade (the shape of the original failure) fails
 * game-knowledge.spec.ts with the tripwire's line naming `reload` and the injected frame.
 */

test("a declared page-initiated navigation is recorded with its initiator stack, and passes", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  j.allowNavigation(/[?&]tripwire-declared=1/, "this journey navigates on purpose to pin the tripwire")
  await Promise.all([
    page.waitForURL(/tripwire-declared=1/),
    page.evaluate(() => { function tripwireDeclaredProbe() { location.assign("/?tripwire-declared=1") } tripwireDeclaredProbe() }),
  ])
  await expect.poll(() => j.navigations().length).toBe(1)
  const [nav] = j.navigations()
  expect(nav.url).toContain("tripwire-declared=1")
  expect(nav.type).toBe("push")
  expect(nav.allowed).toBe("this journey navigates on purpose to pin the tripwire")
  expect(nav.stack, "the stack names the function that navigated").toContain("tripwireDeclaredProbe")
})

test("an undeclared page-initiated navigation fails the journey", async ({ page }) => {
  test.fail(true, "the tripwire must turn an undeclared navigation into a failure")
  const j = journey(page)
  await j.boot("/")
  await Promise.all([
    page.waitForURL(/tripwire-undeclared=1/),
    page.evaluate(() => { function tripwireUndeclaredProbe() { location.assign("/?tripwire-undeclared=1") } tripwireUndeclaredProbe() }),
  ])
  await expect.poll(() => j.navigations().length).toBe(1)
  expect(j.navigations()[0].stack).toContain("tripwireUndeclaredProbe")
  // the soft assertion raised by the harness is what fails this test
})

test("same-document history and the harness's own reload are never recorded", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")                                   // the app pushState-s the node's URL
  await page.evaluate(() => { history.pushState({}, "", "/?tripwire-same-document=1"); history.replaceState({}, "", "/") })
  await page.reload({ waitUntil: "commit" })                  // browser-initiated, like every DSL boot
  await page.waitForTimeout(500)
  expect(j.navigations(), "nothing the page started crossed a document").toEqual([])
})
