import { test, expect, type Page } from "@playwright/test"
import { journey } from "../dsl"

/**
 * SIDECX3, CARRIED TO MASTER THE GAME (v1.284.0, SET1 slice B). Until v1.284.0 this pinned the PATH's visit: only a visible
 * Path visit emitted `challenges_opened` (the White objective "Open Challenges" completes on it, and the White Foundations
 * patch needs all 20 White objectives) and `neural_challenges_viewed`. The owner took the Path row out of the drawer
 * (15 Nov); its corridor is drawn only in Master the game, and the beat moved with it (P22). Pinned here, on the real beat
 * log and the PostHog capture boundary, never by replacing fx/track or the renderers:
 *  · boot, a saved `challengeView = "challenges"` (the remembered Path) and a hidden re-render (setGiMode) are not a visit;
 *    the saved value lands on the drawer's list and stays stored as it was, value and stamp (O2: nothing writes it back);
 *  · opening the drawer on its list is not a visit;
 *  · the first visible corridor in an open drawer emits the beat once; re-rendering and returning within one open drawer
 *    never double-count; closing permits the next visit;
 *  · `neural_challenges_viewed` never fires again (the fourth small loss, accepted, a data-loss event, CLAUDE.md 6.7): 0
 *    at every step, read off the same queue whose beat count proves the visit happened, so the 0 is a reading, not a
 *    queue nobody looked at.
 * The DSL aborts remote requests: SDK delivery is outside this claim. Opening the drawer pauses play.
 * Mutants: the Path's, before v1.284.0, are recorded in tests/artifacts/sidebar_path_mutants.json (against code that left with
 * it); the corridor's are in docs/Changelog-Archive.md, v1.284.0.
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

for (const stored of [false, true]) test(`Master the game's corridor telemetry: ${stored ? "saved" : "fresh"} Path preference counts only visible visits @curated`, async ({ page }) => {
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
  expect(await counts(page), "boot is not a visit").toEqual({ beats: 0, events: 0 })
  await page.evaluate(() => (window as any).__neural.setGiMode("nogi"))
  expect(await counts(page), "a hidden re-render emits neither event").toEqual({ beats: 0, events: 0 })

  await j.clickByMouse(".ng-logo", "open the drawer")
  await expect(page.locator("[data-drawer-explore]")).toBeVisible()
  // O2: the remembered Path lands on the list, and what is stored stays as the player left it
  expect(await page.evaluate(() => { const a = (window as any).__neural; return { view: a._viewMode, stored: a.settings.challengeView ?? null, at: a._settingsAt.challengeView } }),
    "a saved Path lands on the drawer's list; nothing writes the key back").toEqual({ view: "explore", stored: stored ? "challenges" : null, at: 100 })
  await page.evaluate(() => (window as any).__neural.showExplorerList())
  expect(await counts(page), "opening and rendering the drawer list emits neither event").toEqual({ beats: 0, events: 0 })

  await j.openCorridor({ allBelts: false })
  await expect(page.locator(".ng-belt-section")).toHaveCount(5)
  expect(await counts(page), "the first visible corridor emits the beat once, and neural_challenges_viewed no more").toEqual({ beats: 1, events: 0 })
  await page.evaluate(() => (window as any).__neural.setGiMode("gi"))
  await j.clickByMouse('[data-view="explore"]', "back to the drawer list")
  await j.openCorridor({ allBelts: false })
  expect(await counts(page), "re-rendering and returning within one open drawer never double-counts").toEqual({ beats: 1, events: 0 })

  await j.clickByMouse(".ng-explorer-close", "close the drawer")
  await page.evaluate(() => (window as any).__neural.setGiMode("nogi"))
  expect(await counts(page), "a closed re-render cannot mint a second visit").toEqual({ beats: 1, events: 0 })
  await j.clickByMouse(".ng-logo", "reopen the drawer on its list")
  await expect(page.locator("[data-drawer-explore]")).toBeVisible()
  expect(await counts(page), "reopening the list is not another visit").toEqual({ beats: 1, events: 0 })
  await j.openCorridor({ allBelts: false })
  expect(await counts(page), "the next real visit emits a second beat").toEqual({ beats: 2, events: 0 })
})

// RULING 2 (PATH-R1, the independent read of #430, finding 2): `neural_practice_opened` with surface "practice" stays what it
// was, a deliberate opening of Master the game by its own row (or badge). A corridor door (`openCorridor`: View Collection,
// an objective's action, `setViewMode`, `openLearningView`, `openPane("challenges")`) sends it with surface "corridor", so
// the series can still be read apart; already open, a corridor door sends nothing. View Collection from the map is pressed
// by mouse, then the row's own press.
// Mutants: the corridor's surface collapsed to "practice" → red at "View Collection from the map: one opening, its surface";
// `openPane`'s route to `openCorridor` removed (PATH-R2) → red at "openPane(\"challenges\") on the open Master the game keeps its session".
test("neural_practice_opened: a corridor door sends surface \"corridor\", Master the game's own row \"practice\"", async ({ page }) => {
  const j = journey(page)
  await j.boot("/", {
    keepTutorial: true,
    beforeNavigate: async page => {
      await page.addInitScript(() => {
        const queue: any = (window as any).posthog = []
        queue.capture = (...args: any[]) => queue.push(["capture", ...args])
      })
    },
  })
  const opened = () => page.evaluate(() => [...(window as any).posthog]
    .filter((call: any) => call[0] === "capture" && call[1] === "neural_practice_opened").map((call: any) => call[2] && call[2].surface))
  expect(await opened(), "premise: nothing opened at boot").toEqual([])
  // three escapes mint the Houdini coin, whose card carries View Collection (the Mat Coin journey's way, challenges-ui)
  await page.evaluate(() => { const a = (window as any).__neural; for (let i = 0; i < 3; i++) a.fx("escape", { via: "Elbow Escape" }) })
  const reward = page.locator(".ng-challenge-reward[data-reward='coin']")
  await expect(reward).toContainText("MAT COIN MINTED")
  await j.clickByMouse(".ng-challenge-reward[data-reward='coin'] [data-reward-collection]", "View Collection")
  await expect(page.locator("[data-practice-page]"), "View Collection opens Master the game").toHaveCount(1)
  expect(await opened(), "View Collection from the map: one opening, its surface corridor").toEqual(["corridor"])
  // PATH-R2 (the re-read's finding 2): `openPane("challenges")` on the open Master the game goes through `openCorridor`,
  // which repaints in place: the same session, no second opening. Mutant: the route removed → red here.
  expect(await page.evaluate(() => { const a = (window as any).__neural, s = a._session; a.openPane("challenges"); return a._session === s }),
    "openPane(\"challenges\") on the open Master the game keeps its session").toBe(true)
  expect(await opened(), "and sends no second opening").toEqual(["corridor"])
  await j.clickByMouse(".ng-drawer-brand", "back to the drawer's list")
  await expect(page.locator("[data-drawer-explore]")).toBeVisible()
  await j.clickByMouse('[data-explore-stats] [data-b="due"]', "Master the game's own row")
  await expect.poll(opened, { message: "the row's own press is a \"practice\" opening, as before" }).toEqual(["corridor", "practice"])
})
