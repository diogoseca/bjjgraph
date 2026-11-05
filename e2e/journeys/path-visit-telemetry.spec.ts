import { test, expect, type Page } from "@playwright/test"
import { journey } from "../dsl"

/**
 * SIDECX3: only a visible Path visit emits challenges_opened / neural_challenges_viewed.
 * A saved Path preference is not a visit. setGiMode renders the remembered list even when
 * its parent is closed: on dev f63049013 and PR head 4829453c9 this minted both events and
 * consumed the dedupe flag before the player ever selected Path. Closing a real Path visit
 * and changing gi mode minted another pair. The drawer's list itself emitted neither.
 *
 * Read the actual beat log and PostHog capture boundary, never replace fx/track or the
 * renderers. The DSL aborts remote requests: SDK delivery is outside this claim. No gameplay
 * branch is reached; opening the drawer pauses play. Both a fresh and a saved Path preference
 * must stay silent until the measured mouse press opens Path. Existing once-per-pane-visit
 * dedupe remains: re-render / list / Path emits no extra pair, closing permits the next visit.
 * Seven source mutants were killed at named assertions: hidden render / drawer inflation,
 * either event suppressed, repeat render counted, next visit suppressed, and (keyed only) the
 * loader's queue dropped. No non-kills.
 * Exact patches and results: tests/artifacts/sidebar_path_mutants.json / sidebar_mutants.md.
 *
 * KEYED AND KEYLESS BUILDS BOTH RUN THIS (v1.247.1, DEPLOYFIX). PR shards build keyless; both
 * deploys build keyed, and the key changes exactly one output, postscript.js. There the PostHog
 * loader takes `window.posthog||[]` and `posthog.init()` writes a queue shim over every method,
 * `capture` included, that pushes `[method, ...args]`. A plain `{ capture }` spy (#327) was
 * overwritten, the shim threw `t.push is not a function` on the object, track() swallowed it and
 * this read events: 0, so every deploy failed while a visitor's real queue held the event once.
 * So the spy is that queue: an array, which a keyed build runs through the REAL loader and shim,
 * while a keyless build, which has no loader, runs the stand-in below and pushes the same shape.
 * Keep it an init script: the post-boot `page.evaluate` spies elsewhere never see the boot, and
 * "boot is not a Path visit" is a claim about the boot.
 */

const counts = (page: Page) => page.evaluate(() => {
  const w = window as any
  return {
    beats: (w.__neural.beats || []).filter((b: any) => b.beat === "challenges_opened").length,
    events: [...w.posthog].filter((call: any) => call[0] === "capture" && call[1] === "neural_challenges_viewed").length,
  }
})

for (const stored of [false, true]) test(`Path telemetry: ${stored ? "saved" : "fresh"} preference counts only visible visits @curated`, async ({ page }) => {
  const j = journey(page)
  await j.boot("/", {
    keepTutorial: true,
    initialState: {
      v: 2, settings: stored ? { challengeView: "challenges" } : {},
      settingsAt: { challengeView: 100 }, updatedAt: 100,
    },
    beforeNavigate: async page => {
      await page.addInitScript(() => {
        const queue: any = (window as any).posthog = []
        queue.capture = (...args: any[]) => queue.push(["capture", ...args])
      })
    },
  })
  await expect.poll(() => page.evaluate(() => !!(window as any).__neural.curriculum)).toBe(true)
  expect(await counts(page), "boot is not a Path visit").toEqual({ beats: 0, events: 0 })
  await page.evaluate(() => (window as any).__neural.setGiMode("nogi"))
  expect(await counts(page), "a closed restored Path render emits neither event").toEqual({ beats: 0, events: 0 })

  await j.clickByMouse(".ng-logo", "open the drawer")
  await expect(page.locator("[data-drawer-explore]")).toBeVisible()
  await page.evaluate(() => (window as any).__neural.showExplorerList())
  expect(await counts(page), "opening and rendering the drawer list emits neither event").toEqual({ beats: 0, events: 0 })

  await j.clickByMouse('[data-view="challenges"]', "deliberately visit Path")
  await expect(page.locator(".ng-track-card")).toHaveCount(5)
  expect(await counts(page), "the first real Path visit emits one of each event").toEqual({ beats: 1, events: 1 })
  await page.evaluate(() => (window as any).__neural.setGiMode("gi"))
  await j.clickByMouse('[data-view="explore"]', "back to the drawer list")
  await j.clickByMouse('[data-view="challenges"]', "return to Path in the same open drawer")
  expect(await counts(page), "re-rendering and revisiting within one open drawer never double-counts").toEqual({ beats: 1, events: 1 })

  await j.clickByMouse(".ng-explorer-close", "close Path")
  await page.evaluate(() => (window as any).__neural.setGiMode("nogi"))
  expect(await counts(page), "a closed Path re-render cannot mint a second visit").toEqual({ beats: 1, events: 1 })
  await j.clickByMouse(".ng-logo", "reopen the drawer on its list")
  await expect(page.locator("[data-drawer-explore]")).toBeVisible()
  expect(await counts(page), "reopening the list is not another Path visit").toEqual({ beats: 1, events: 1 })
  await j.clickByMouse('[data-view="challenges"]', "deliberately visit Path again")
  expect(await counts(page), "the next real Path visit emits a second pair").toEqual({ beats: 2, events: 2 })
})
