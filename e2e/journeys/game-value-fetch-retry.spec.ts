import { expect, test } from "@playwright/test"
import { journey } from "../dsl"

/**
 * ONE DROPPED REQUEST MUST NOT COST WIN CHANCE FOR THE SESSION (FGRETRY1, 2026-10-01).
 *
 * The worker loads the solver's metadata (a manifest, a variant, then content-addressed
 * `mdp/part-*.txt` files) before it can describe the first hand. Before this fix, ONE failed fetch
 * failed that description, the provider reported it as `unverified-root-description`, and the runtime
 * HELD the failure until the player pressed Retry. It was found by reproduction: a corpus hydration
 * overlapping the load made Chromium refuse part fetches with net::ERR_INSUFFICIENT_RESOURCES, and
 * Win chance ended for the session in 9 of 15 runs. On a phone, the same class is a dropped request.
 *
 * Faults are injected on the WORKER's own requests (page.route sees a dedicated worker's fetches;
 * each test asserts its fault actually fired, so a route that matched nothing cannot pass):
 *   1. the first part fetch drops once     -> the loader retries it and values still arrive;
 *   2. one part never arrives              -> retries are bounded (4 attempts) and the reason the
 *                                             runtime holds is the real one, metadata-network-failed;
 *   3. one part answers 404                -> never retried (1 attempt), reason metadata-fetch-failed.
 * The loader's classes (which failures are transient, the backoff, integrity never retried) are
 * pinned in tests/game_value_loader.test.mjs; this journey pins that the real worker and the real
 * provider deliver them end to end.
 *
 * Mutants, recorded 2026-10-01 on the built bundles, all killed:
 *   - no retry (empty backoff)   -> test 1 stays "unavailable | … | metadata-network-failed";
 *                                   test 2 sees 1 attempt, not 4;
 *   - the masked reason          -> tests 2 and 3 receive "unverified-root-description";
 *   - retrying an answer (404)   -> test 3 sees 4 attempts, not 1.
 */

const PART = /\/static\/neural\/mdp\/part-[0-9a-f]{64}\.txt(\?|$)/
type Fault = "drop-once" | "drop-always" | "404"

async function bootWithFault(page: any, fault: Fault) {
  const attempts = new Map<string, number>()
  let target: string | null = null
  const j = journey(page)
  await j.boot("/", {
    beforeNavigate: async (p: any) => {
      await p.route(PART, async (route: any) => {
        const url = route.request().url().replace(/\?.*$/, "")
        target = target || url                                   // the first part the worker asks for
        const n = (attempts.get(url) || 0) + 1
        attempts.set(url, n)
        if (url === target && (fault !== "drop-once" || n === 1))
          return fault === "404" ? route.fulfill({ status: 404, body: "" }) : route.abort("connectionreset")
        return route.fallback()
      })
    },
  })
  await j.land("Mount Top")
  return { j, attempts, target: () => target }
}
// status | controller reason | game-value state | the reason the runtime holds
const statusWhy = (page: any) => page.evaluate(() => {
  const a = (window as any).__neural, s = a?._choiceValues?.snapshot()
  return [s?.status || "none", s?.reason, a?._gameValueState, a?._gameValueReason].map((x) => x || "-").join(" | ")
})
const held = (page: any) => page.evaluate(() => {
  const a = (window as any).__neural
  return a?._gameValueState === "unavailable" ? a._gameValueReason || "-" : null
})

test("a metadata part dropped once is retried, and Win chance still arrives", async ({ page }) => {
  test.setTimeout(180_000)
  const { attempts, target } = await bootWithFault(page, "drop-once")
  await expect.poll(() => statusWhy(page), { timeout: 120_000, message: "Win chance settles after one dropped part" }).toMatch(/^(ready|bounded) \|/)
  expect(target(), "the fault fired on a part the worker requested").not.toBeNull()
  expect(attempts.get(target()!), "the dropped part was fetched again, once").toBe(2)
  const values = await page.locator('[data-choice-group="you"] [data-choice-win]').allTextContents()
  expect(values.length, "the hand shows values").toBeGreaterThan(0)
  expect(values.every((v: string) => v !== "—"), "every card settled to a value").toBe(true)
})

test("a part that never arrives is retried a bounded number of times, and the held reason is the real one", async ({ page }) => {
  test.setTimeout(180_000)
  const { attempts, target } = await bootWithFault(page, "drop-always")
  await expect.poll(() => held(page), { timeout: 120_000, message: "the runtime holds a failure" }).not.toBeNull()
  expect(await held(page), "the reason held is the worker's, not a masked one").toBe("metadata-network-failed")
  expect(target(), "the fault fired on a part the worker requested").not.toBeNull()
  expect(attempts.get(target()!), "1 attempt + 3 retries, then it stops").toBe(4)
  await page.waitForTimeout(1500)
  expect(attempts.get(target()!), "and nothing retries it after the bound").toBe(4)
  await expect(page.locator("[data-choice-value-status]").first()).toHaveText("Win chance unavailable")
  await expect(page.locator("[data-choice-value-retry]").first(), "the player keeps a way out").toBeVisible()
})

test("a part that answers 404 is never retried, and the held reason says so", async ({ page }) => {
  test.setTimeout(180_000)
  const { attempts, target } = await bootWithFault(page, "404")
  await expect.poll(() => held(page), { timeout: 120_000, message: "the runtime holds a failure" }).not.toBeNull()
  expect(await held(page), "a 404 is an answer: its own reason").toBe("metadata-fetch-failed")
  expect(target(), "the fault fired on a part the worker requested").not.toBeNull()
  await page.waitForTimeout(1500)
  expect(attempts.get(target()!), "an answer is never retried").toBe(1)
})
