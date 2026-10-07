import { test, expect, type Page } from "@playwright/test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

/**
 * THE APP BUNDLE CANNOT OUTLIVE A DEPLOY (v1.205.1). @curated
 *
 * THE INCIDENT. On 2026-09-29 production deployed v1.204.4, and its format-4 data was served fresh.
 * But bjjgraph.org/static/neural/app/neural.js came out of Cloudflare's edge cache as v1.182.15
 * (cf-cache-status HIT, age 13,642): /static/* is cached for 4 h plus a 1 d stale-while-revalidate
 * at a FIXED URL, and the edge does not cache JSON. The old app reads `j.decks` and
 * `scoreWeightsByRuleset`, and format 4 has neither, so every visitor on that copy saw no decks and
 * a white belt.
 *
 * THE MECHANISM UNDER TEST.
 *   - NeuralMount.tsx's afterDOMLoaded puts the deploy's build stamp, window.__NEURAL_BUILD = the
 *     package version, into /postscript.js. That file is served `max-age=0, must-revalidate`, which
 *     scripts/check_headers_cache.py gates.
 *   - variant.inline.ts (the loader) requests neural.js and neural.css with ?v=<stamp>.
 *   - The app requests its deferred sheets with ?v=<NG_APP_VERSION>.
 * A new deploy therefore means new cache keys, and an old copy can never answer for a new build.
 * That the zone keys its cache on the query string was verified on the live site, not here: a
 * novel ?v= MISSed, then HIT with age 1, and served the current v1.204.4 bundle, while the fixed
 * URL still served v1.182.15.
 *
 * WHAT THE HARNESS DOES NOT SERVE (CLAUDE.md §6.4). The test server has no HTTP cache and ignores
 * query strings, so no assertion here can be satisfied by caching behaviour. What is asserted is
 * which URLs the page ASKS for, and that the bundle which RAN is the stamped build. The fixed URLs
 * are POISONED below: if the loader ever requests one, a stub runs and flags itself.
 *
 * MUTANTS, MEASURED on a keyless build of v1.205.1 by patching the EMITTED bytes, as
 * tests/artifacts/_presentation_mutants.sh does:
 *   - prescript.js: the loader reads the wrong global, so it cannot see the stamp → 1 RED, 2 RED
 *     (2 falls because the poisoned fixed URL answers and the app never mounts)
 *   - postscript.js: the stamp assignment removed                          → 1 RED, 2 RED
 *   - neural.js: _appAsset drops ?v=                                        → 2 RED, 1 GREEN
 *   (and auth-redirect-back.spec.ts's glob reverted to the exact URL → its test 3 RED on the new
 *    positive block count: the drift this release would otherwise have caused silently)
 * NOT COVERED: a tab left open across a deploy keeps its in-memory bundle and fetches newer data
 * lazily. That is the named residual; the follow-up is the app comparing a data build stamp
 * against itself.
 */

const VERSION: string = JSON.parse(readFileSync(resolve(__dirname, "../../package.json"), "utf8")).version
const APP_FILES = /\/static\/neural\/app\/(neural\.js|neural\.css|reading\.css|reference\.css)(\?[^#]*)?$/
const FIXED_URL = /\/static\/neural\/app\/(neural\.js|neural\.css|reading\.css|reference\.css)$/

async function watch(page: Page) {
  const requested: string[] = []
  page.on("request", (r) => {
    if (APP_FILES.test(r.url())) requested.push(r.url())
  })
  // A stale edge copy under the old key: if this ever answers, the stamp did not reach the URL.
  await page.route(FIXED_URL, (route) => {
    const js = route.request().url().endsWith(".js")
    return route.fulfill({
      status: 200,
      contentType: js ? "application/javascript" : "text/css",
      body: js ? "window.__STALE_FIXED_URL__ = (window.__STALE_FIXED_URL__ || 0) + 1" : "/* stale fixed-URL copy */",
    })
  })
  return requested
}

const versioned = (urls: string[], file: string) =>
  urls.filter((u) => u.includes(`/app/${file}?`)).map((u) => new URL(u).searchParams.get("v"))

test("@curated the loader requests the bundle under the deploy's build stamp, never the fixed URL", async ({ page }) => {
  const requested = await watch(page)
  await page.goto("/", { waitUntil: "load" })
  await page.waitForFunction(() => typeof (window as any).__mountNeural === "function", null, { timeout: 60_000 })

  const ran = await page.evaluate(() => ({
    stamp: (window as any).__NEURAL_BUILD,
    bundle: typeof (window as any).NG_APP_VERSION === "string" ? (window as any).NG_APP_VERSION : null,
    stale: (window as any).__STALE_FIXED_URL__ || 0,
  }))
  expect(ran.stamp, "window.__NEURAL_BUILD is not package.json's version — /postscript.js carries no stamp").toBe(VERSION)
  expect(ran.bundle, "the bundle that RAN is not the stamped build").toBe(VERSION)
  expect(ran.stale, "a FIXED, unversioned app URL was requested and answered — the skew is back").toBe(0)

  // Positive coverage: both files were requested, and every request carried the stamp.
  for (const file of ["neural.js", "neural.css"]) {
    const vs = versioned(requested, file)
    expect(vs.length, `${file} was never requested with ?v= — the loader did not key it on the stamp`).toBeGreaterThanOrEqual(1)
    expect(new Set(vs), `${file} was requested under a key other than the build stamp`).toEqual(new Set([VERSION]))
  }
  expect(requested.filter((u) => FIXED_URL.test(u)), "fixed, unversioned app URLs were requested").toEqual([])
})

test("@curated the app's deferred reference sheet is keyed on the bundle's own version", async ({ page }) => {
  const requested = await watch(page)
  // A Principle page loads the concepts index, and with it reference.css (_ensureConcepts).
  const sheet = page.waitForRequest((r) => /\/app\/reference\.css/.test(r.url()), { timeout: 60_000 })
  await page.goto("/Principles/Frames", { waitUntil: "load" })
  await sheet
  const vs = versioned(requested, "reference.css")
  expect(vs.length, "reference.css was never requested with ?v=").toBeGreaterThanOrEqual(1)
  expect(new Set(vs), "reference.css was requested under a key other than the bundle's version").toEqual(new Set([VERSION]))
  expect(requested.filter((u) => FIXED_URL.test(u)), "fixed, unversioned app URLs were requested").toEqual([])
})
