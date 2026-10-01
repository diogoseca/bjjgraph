import { expect, test, type Page } from "@playwright/test"
import { journey } from "../dsl"
import { multiBeltEndgame } from "../gen/personas"

/**
 * THE BELT YOU WEAR, AS THE CHALLENGES TAB DRAWS IT (v1.210.0, owner ruling 2026-09-30).
 *
 * You wear the belt after the last belt whose units are ALL proven (lessons + checkpoint); it is
 * a high-water mark (`belts.held`) that nothing lowers. The rule, the merge and the grandfather
 * are gated headless on the real class in tests/belt_worn.test.mjs (16 mutants, each killed by a
 * named test). This file pins what a player SEES: the tab belt's `data-tab-belt` (a marker the
 * renderer owns, CLAUDE.md §6.7) and `data-tab-stripes`, in a real browser, across a real reload.
 *
 * Mutants run against this file (2026-10-01, rebuilt and served inside the build lock), each red:
 *   the tab dyed by `_frontierBeltId()` again → tests 1, 2 and 3 (the finished player wears white;
 *     the frontier moves on lessons; no-gi's frontier is brown);
 *   `wornBelt()` ignoring `held` → test 3;
 *   the colour promoting on lessons again (`_beltCleared` reading lessons only) → test 2.
 */

const tabBelt = (page: Page) => page.locator('.ng-learning-nav [data-view="challenges"] .ng-tab-belt')

/** curriculum and deck manifest resident, and the one-time grandfather has run */
async function migrated(page: Page) {
  await expect
    .poll(() => page.evaluate(() => { const a = (window as any).__neural; return !!(a.curriculum && a.flashcards && a.belts && a.belts.gf) }))
    .toBe(true)
}
async function openChallenges(page: Page) {
  await page.evaluate(() => {
    const a = (window as any).__neural
    a.setViewMode("challenges")
    a.openExplorer()
    a.showExplorerList()
    a.renderTabSubtitles()
  })
  await expect(page.locator(".ng-learning-nav")).toBeVisible()
}
/** raw evidence for whole belts (every lesson live in `frame`, or all), then the seam every grade calls */
async function prove(page: Page, belts: string[], opts: { frame?: string; checkpoints?: boolean } = {}) {
  await page.evaluate(({ belts, frame, checkpoints }) => {
    const a = (window as any).__neural
    for (const belt of a.curriculum.belts) {
      if (!belts.includes(belt.id)) continue
      for (const u of belt.units) {
        for (const l of u.lessons) if (!frame || (l.frames || ["gi", "nogi"]).includes(frame)) a.prep[l.deckKey] = 3
        if (checkpoints !== false) a.units[belt.id + "/" + u.id] = { checkpoint: true, t: Date.now() }
      }
    }
    a._publishKnowledge("journey")
    a.renderTabSubtitles()
  }, { belts, frame: opts.frame, checkpoints: opts.checkpoints })
}

test("a finished player wears black with four stripes — never the corridor's white @curated", async ({ page }) => {
  const j = journey(page)
  await j.boot("/", { initialState: multiBeltEndgame() })
  await migrated(page)
  await openChallenges(page)
  await expect(tabBelt(page)).toHaveAttribute("data-tab-belt", "black")
  await expect(tabBelt(page)).toHaveAttribute("data-tab-stripes", "4")
  expect(await tabBelt(page).evaluate((el) => (el as HTMLElement).style.getPropertyValue("--tb"))).toBe("#8d929f")
  // the corridor's frontier still falls back to its top for NAVIGATION — it just dyes nothing now
  expect(await page.evaluate(() => (window as any).__neural._frontierBeltId())).toBe("white")
})

test("lessons alone never promote; proving every unit does", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await migrated(page)
  await openChallenges(page)
  await prove(page, ["white"], { checkpoints: false })
  await expect(tabBelt(page), "every White lesson done, no checkpoint").toHaveAttribute("data-tab-belt", "white")
  await expect(tabBelt(page)).toHaveAttribute("data-tab-stripes", "0")
  await prove(page, ["white"])
  await expect(tabBelt(page), "every White unit proven").toHaveAttribute("data-tab-belt", "blue")
  await expect(tabBelt(page)).toHaveAttribute("data-tab-stripes", "0")
})

test("never lowered by a gi ↔ no-gi flip — and still black after a reload in no-gi", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await migrated(page)
  await page.evaluate(() => (window as any).__neural.setGiMode("gi"))
  await openChallenges(page)
  // White through Brown proven in GI: five units change size between rulesets, three of them Brown's
  await prove(page, ["white", "blue", "purple", "brown"], { frame: "gi" })
  await expect(tabBelt(page)).toHaveAttribute("data-tab-belt", "black")
  await page.evaluate(() => (window as any).__neural.setGiMode("nogi"))
  await openChallenges(page)
  expect(
    await page.evaluate(() => (window as any).__neural._beltClearedFlags()[3]),
    "non-trivial: Brown is NOT proven in no-gi (its no-gi-only lessons are undone)",
  ).toBe(false)
  await expect(tabBelt(page), "the flip lowers nothing").toHaveAttribute("data-tab-belt", "black")
  // a real reload, storage kept: the belt is the persisted high-water mark, not this session's memory
  await page.evaluate(() => (window as any).__neural._flushSave())
  await j.boot("/", { preserveStorage: true })
  await migrated(page)
  expect(await page.evaluate(() => (window as any).__neural._giMode)).toBe("nogi")
  await openChallenges(page)
  await expect(tabBelt(page), "black after the reload").toHaveAttribute("data-tab-belt", "black")
})
