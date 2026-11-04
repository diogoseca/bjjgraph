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
 * Six source mutants were killed at named assertions: hidden render / drawer inflation,
 * either event suppressed, repeat render counted, and next visit suppressed. No non-kills.
 * Exact patches and results: tests/artifacts/sidebar_path_mutants.json / sidebar_mutants.md.
 */

const counts = (page: Page) => page.evaluate(() => {
  const w = window as any
  return {
    beats: (w.__neural.beats || []).filter((b: any) => b.beat === "challenges_opened").length,
    events: w.__pathEvents.filter((e: any) => e.event === "neural_challenges_viewed").length,
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
        const w = window as any
        w.__pathEvents = []
        w.posthog = { capture: (event: string, props: any) => w.__pathEvents.push({ event, props }) }
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
