/* @hyperspace {"theme":"lifetime-journeys","L":"srs-veteran","F":"settings","B":"cross-feature"} @invariant "Flipping giMode to 'nogi' at runtime for a veteran re-renders the belt path live: any gi-only lesson row switches to data-live='0' aria-disabled='true' and drops out of its unit's done-math, while nogi-viable proven decks keep data-done='1' — a mid-life settings change re-derives lock/live state without a reload." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { srsVeteran, CURRICULUM } from "./personas"

/**
 * Mechanism under test (neural/src/app.src.jsx, read to confirm):
 *   _lessonLive(l) [2428]: (l.frames||["gi","nogi"]).indexOf(giMode==="nogi"?"nogi":"gi") >= 0
 *     → a gi-only lesson (frames:["gi"]) is FALSE in nogi.
 *   renderBeltPath row [2504-2507]: data-lesson=<deckKey>; data-done="1" iff lessonDone
 *     (prep>=goal, FRAME-INDEPENDENT — a proven gi-only row KEEPS data-done even when dead);
 *     data-live=live?"1":"0"; when !live also sets aria-disabled="true".
 *   unitComplete [2429-2432] iterates ONLY unit.lessons.filter(_lessonLive) — the "done-math"
 *     live-set; the gi-only lesson drops OUT of it in nogi.
 *   setGiMode("nogi") [2634-2642]: sets _giMode, nulls the _explorer cache, and (list visible)
 *     calls renderExplorer() → list.innerHTML="" + a fresh renderBeltPath. LIVE re-render, NO reload.
 *
 * DISTINCT from belt-path.spec.ts:134 (which boots straight into nogi and asserts the STATIC
 * terminal disabled state). This spec proves the LIVE MID-LIFE FLIP: boot a veteran in gi with
 * the gi-only lesson PROVEN + data-done, then setGiMode('nogi') at runtime and assert the row
 * re-derives to dead (data-live=0 / aria-disabled) while KEEPING data-done, a proven both-frame
 * sibling survives untouched, and the unit's _lessonLive done-math set shrinks by exactly one —
 * all without a reload.
 *
 * Seeds + indices derive from the SERVED curriculum fixture, so owner edits fail loudly here
 * rather than silently drifting the assertions.
 */

// The first gi-only lesson in curriculum flat order (belts → units → lessons). srsVeteran seeds
// in this SAME order, so seeding giFlatIdx+1 decks proves every lesson through (and including)
// the gi-only one. Computed dynamically to stay corpus-robust.
function firstGiOnly() {
  let flat = 0
  for (const belt of CURRICULUM.belts)
    for (const u of belt.units)
      for (const l of u.lessons) {
        const fr: string[] = l.frames || ["gi", "nogi"]
        if (fr.length === 1 && fr[0] === "gi")
          return { flat, deckKey: l.deckKey as string, beltId: belt.id as string, unit: u }
        flat++
      }
  return null
}

const GI = firstGiOnly()
// A both-frame lesson in the SAME unit — its data-done must SURVIVE the flip (nogi-viable).
const SIBLING =
  GI &&
  (GI.unit.lessons.find(
    (l: any) => l.deckKey !== GI.deckKey && (l.frames || ["gi", "nogi"]).length === 2,
  ) as { deckKey: string } | undefined)

test("gimode flip re-derives lesson live/lock state live, without a reload", async ({ page }) => {
  // Curriculum preconditions the whole invariant rests on — fail loudly if the corpus shifts.
  test.skip(!GI, "curriculum has no gi-only lesson")
  test.skip(!SIBLING, "gi-only lesson's unit has no both-frame sibling")
  const gi = GI!
  const sibling = SIBLING!
  const N = gi.flat + 1 // decks to seed so the gi-only lesson is among the proven set
  const unitLive = (gi.unit.lessons as any[]).filter((l) => (l.frames || ["gi", "nogi"]).length >= 1)
  expect(unitLive.length).toBeGreaterThan(1) // sibling + gi-only both present in the unit

  const j = journey(page)
  // Veteran booted in the DEFAULT frame (gi): the gi-only lesson is proven (prep=5, rec=3) and alive.
  await j.boot("/", { initialState: srsVeteran(N) })
  await j.land("Mount Top")

  // Open the explorer's PATH view (curriculum loaded → path is the default _viewMode). The list
  // must be VISIBLE for setGiMode to fire its live re-render — openPath guarantees that.
  await page.evaluate(() => (window as any).__neural.toggleExplorer())
  await expect(page.locator("[data-view]").first()).toBeVisible()
  await j.expectBeat("path_opened")

  // Locators re-resolve lazily on every query, so the SAME handle picks up the rebuilt row after
  // the flip — no re-fetch needed.
  const giRow = page.locator(`[data-lesson="${gi.deckKey}"]`).first()
  const sibRow = page.locator(`[data-lesson="${sibling.deckKey}"]`).first()

  // Read the unit's _lessonLive done-math set straight from the app (the set unitComplete iterates).
  const liveSet = () =>
    page.evaluate(
      ([beltId, unitId]) => {
        const a = (window as any).__neural
        const belt = a.curriculum.belts.find((b: any) => b.id === beltId)
        const unit = belt.units.find((u: any) => u.id === unitId)
        return unit.lessons.filter((l: any) => a._lessonLive(l)).map((l: any) => l.deckKey)
      },
      [gi.beltId, gi.unit.id] as const,
    )

  // ── BEFORE (gi frame): gi-only row is alive, enabled, and proven-done; sibling proven-done. ──
  await expect(giRow).toBeVisible()
  expect(await giRow.getAttribute("data-live")).toBe("1")
  expect(await giRow.getAttribute("aria-disabled")).toBeNull()
  expect(await giRow.getAttribute("data-done")).toBe("1")
  expect(await sibRow.getAttribute("data-done")).toBe("1")

  const liveBefore = await liveSet()
  expect(liveBefore).toContain(gi.deckKey) // in the done-math set while gi
  expect(liveBefore).toContain(sibling.deckKey)

  // ── FLIP at runtime: gi → nogi. Explorer stays open, so renderExplorer re-renders in place. ──
  await page.evaluate(() => (window as any).__neural.setGiMode("nogi"))
  expect(await page.evaluate(() => (window as any).__neural._giMode)).toBe("nogi")

  // ── AFTER (nogi frame), NO reload: gi-only row re-derived to dead — live=0 + aria-disabled — ──
  // ── yet KEEPS data-done (frame-independent prep>=goal); sibling untouched, still done. ──
  await expect(giRow).toBeVisible()
  expect(await giRow.getAttribute("data-live")).toBe("0")
  expect(await giRow.getAttribute("aria-disabled")).toBe("true")
  expect(await giRow.getAttribute("data-done")).toBe("1") // proven mastery survives a dead frame
  expect(await sibRow.getAttribute("data-done")).toBe("1") // nogi-viable proven deck unaffected

  // ...and the done-math live-set dropped EXACTLY the gi-only deck: sibling stays, count −1.
  const liveAfter = await liveSet()
  expect(liveAfter).not.toContain(gi.deckKey)
  expect(liveAfter).toContain(sibling.deckKey)
  expect(liveAfter.length).toBe(liveBefore.length - 1)
})
