import { expect, test, type Page } from "@playwright/test"
import { journey } from "../dsl"
import { multiBeltEndgame } from "../gen/personas"

/**
 * THE BELT YOU WEAR, AS THE CHALLENGES TAB DRAWS IT (v1.211.0, owner ruling 2026-09-30).
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
 *
 * v1.276.0 (ruled STAGE2-GO 3, ONE belt in the drawer): the belt left the Path row for the drawer's "Master the game" row
 * (`[data-belt-row] .ng-belt`, its `data-belt` and `data-stripes`), which wears the HELD LEVEL (`belts.lvl`), raised to
 * the Path's level by the same `_syncBelt`; with no number read here the two agree, so every assertion below moved to the
 * new element unchanged except where table a differs: black has NO stripes there (the Path's own rule keeps its four,
 * asserted through `wornBelt()`). The Path row now says its course's units in words. Each changed line says what it
 * claimed before. The mutants above were run against the Path row's belt; the new row's are in tests/belt_row.test.mjs.
 */

// v1.276.0: the drawer's one belt, on the "Master the game" row (before: `[data-path-belt] .ng-tab-belt`, under the Path row)
const tabBelt = (page: Page) => page.locator('[data-belt-row] .ng-belt')
const pathWords = (page: Page) => page.locator("[data-tab-sub='challenges']")

/** curriculum and deck manifest resident, and the one-time grandfather has run */
async function migrated(page: Page) {
  await expect
    .poll(() => page.evaluate(() => { const a = (window as any).__neural; return !!(a.curriculum && a.flashcards && a.belts && a.belts.gf) }))
    .toBe(true)
}
// v1.242.0: the worn belt is drawn under the drawer's Path row, on the home list (the Challenges tab is gone)
async function openChallenges(page: Page) {
  await page.evaluate(() => {
    const a = (window as any).__neural
    a.setViewMode("explore")
    a.openExplorer()
    a.showExplorerList()
    a.renderTabSubtitles()
    a._paintBeltRow()
  })
  await expect(page.locator(".ng-drawer-head")).toBeVisible()
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
    a._paintBeltRow()
  }, { belts, frame: opts.frame, checkpoints: opts.checkpoints })
}

test("a finished player wears black with four stripes — never the corridor's white", async ({ page }) => {
  const j = journey(page)
  await j.boot("/", { initialState: multiBeltEndgame() })
  await migrated(page)
  await openChallenges(page)
  await expect(tabBelt(page)).toHaveAttribute("data-belt", "black")
  // before: data-tab-stripes "4" and the Path's dye --tb #8d929f. On table a black has no stripes: the drawer row draws
  // plain black (its red bar, no slots), and the Path's own rule still gives four, read here from the Path itself
  await expect(tabBelt(page)).toHaveAttribute("data-stripes", "0")
  expect(await page.evaluate(() => { const w = (window as any).__neural.wornBelt(); return [w.id, w.stripes] })).toEqual(["black", 4])
  expect(await tabBelt(page).evaluate((el) => (el as HTMLElement).style.getPropertyValue("--belt"))).toBe("#1d1d22")
  await expect(pathWords(page), "the Path row says its course is done, in words").toHaveText(/^(\d+) of \1 units$/)
  // the corridor's frontier still falls back to its top for NAVIGATION — it just dyes nothing now
  expect(await page.evaluate(() => (window as any).__neural._frontierBeltId())).toBe("white")
})

test("lessons alone never promote; proving every unit does", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await migrated(page)
  await openChallenges(page)
  await prove(page, ["white"], { checkpoints: false })
  // before: the same four on `data-tab-belt` / `data-tab-stripes` under the Path row
  await expect(tabBelt(page), "every White lesson done, no checkpoint").toHaveAttribute("data-belt", "white")
  await expect(tabBelt(page)).toHaveAttribute("data-stripes", "0")
  await expect(pathWords(page), "no unit proven yet, in words").toHaveText(/^0 of \d+ units$/)
  await prove(page, ["white"])
  await expect(tabBelt(page), "every White unit proven").toHaveAttribute("data-belt", "blue")
  await expect(tabBelt(page)).toHaveAttribute("data-stripes", "0")
})

test("never lowered by a gi ↔ no-gi flip — and still black after a reload in no-gi", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await migrated(page)
  await page.evaluate(() => (window as any).__neural.setGiMode("gi"))
  await openChallenges(page)
  // White through Brown proven in GI: five units change size between rulesets, three of them Brown's
  await prove(page, ["white", "blue", "purple", "brown"], { frame: "gi" })
  await expect(tabBelt(page)).toHaveAttribute("data-belt", "black")   // before: data-tab-belt
  await page.evaluate(() => (window as any).__neural.setGiMode("nogi"))
  await openChallenges(page)
  expect(
    await page.evaluate(() => (window as any).__neural._beltClearedFlags()[3]),
    "non-trivial: Brown is NOT proven in no-gi (its no-gi-only lessons are undone)",
  ).toBe(false)
  await expect(tabBelt(page), "the flip lowers nothing").toHaveAttribute("data-belt", "black")   // before: data-tab-belt
  // a real reload, storage kept: the belt is the persisted high-water mark, not this session's memory
  await page.evaluate(() => (window as any).__neural._flushSave())
  await j.boot("/", { preserveStorage: true })
  await migrated(page)
  expect(await page.evaluate(() => (window as any).__neural._giMode)).toBe("nogi")
  await openChallenges(page)
  await expect(tabBelt(page), "black after the reload").toHaveAttribute("data-belt", "black")   // before: data-tab-belt
})
