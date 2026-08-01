/* @hyperspace {"theme":"lifetime-journeys","L":"srs-veteran","F":"graph-canvas","B":"cross-feature"} @invariant "For a veteran the path-view fog-of-war is a PATH-view artifact, not a permanent dim: while PATH view is open _pathDim is active and _curriculumIdxSet excludes some nodes, but toggling to TREE view clears _pathDim (fog off) and renders zero [data-locked]/[data-lesson] — switching view mode fully lifts the fog for a mastered profile." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { srsVeteran } from "./personas"

/**
 * CROSS-FEATURE: the graph-canvas fog-of-war is SCOPED to path view, never a latch.
 *
 * Mechanism under test (neural/src/app.src.jsx):
 *   - renderExplorer() (L2707): `if (this._viewMode === "path" && this.curriculum)
 *     { this.renderBeltPath(list, mk); return; }` short-circuits into the path branch.
 *     renderBeltPath (L2467) sets `this._pathDim = true` and is the ONLY site that emits
 *     [data-locked] (belt/unit rows) and [data-lesson] (lesson rows). When NOT in path
 *     mode, L2708 sets `this._pathDim = false` and renders tree groups — no lock/lesson attrs.
 *   - The canvas fog draw (L5075) reads `const fogSet = this._pathDim ? this._curriculumIdxSet
 *     : null;` then dims non-curriculum nodes to 0.3 only while _pathDim is true. So _pathDim
 *     IS the fog gate; TREE view (_pathDim=false → fogSet=null) draws every node at full alpha.
 *   - setViewMode(m) (L2409) stores the mode + re-invokes renderExplorer() when the panel is
 *     open, so _pathDim is RE-DERIVED on every toggle — a value, not a latch. Toggling back to
 *     PATH must reconstruct the fog + lesson rows from scratch.
 *
 * The srsVeteran wins NO belts, so PATH renders real locks (33 today) AND lessons alongside
 * the fog: this proves the fog and the lock economy coexist in one render, then both drain the
 * instant view mode flips. Toggling PATH→TREE→PATH exercises the re-derivation both directions.
 *
 * No gameplay draws: land()'s built-in rigs (ai-skill/role/max-moves) cover every RNG site
 * touched, and the path/tree renders draw no RNG — no per-spec rig sizing needed.
 */

const N_DECKS = 25

// The exact canvas-fog dim read, as a page-side probe of the live instance fields.
const readFog = () => {
  const a = (window as any).__neural
  const set = a._curriculumIdxSet
  // count nodes OUTSIDE the curriculum set — these are exactly the ones the fog dims to 0.3
  let outside = 0
  if (set) for (const n of a.nodes) if (!set.has(n.idx)) outside++
  return {
    viewMode: a._viewMode,
    pathDim: !!a._pathDim,
    setSize: set ? set.size : 0,
    outside,
    total: a.nodes.length,
  }
}

test("veteran: path-view fog + locks lift entirely when view mode toggles to tree", async ({ page }) => {
  const j = journey(page)
  await j.boot("/", { initialState: srsVeteran(N_DECKS) })
  await j.land("Mount Top")

  // open the explorer — with the curriculum loaded PATH is the default face; gate on the
  // segmented [data-view] control being visible + the path render having fired its beat
  await page.evaluate(() => (window as any).__neural.toggleExplorer())
  await expect(page.locator("[data-view]").first()).toBeVisible()
  await j.expectBeat("path_opened")

  // ── PHASE 1 · PATH: fog is ON and it genuinely dims territory ──
  const inPath = await page.evaluate(readFog)
  expect(inPath.viewMode, "explorer opens on path view").toBe("path")
  expect(inPath.pathDim, "path view arms the canvas fog gate").toBe(true)
  // the fog set is substantial AND leaves nodes outside it (those are the ones dimmed to 0.3):
  // a fog that covered everything, or nothing, would be no fog at all
  expect(inPath.setSize, "curriculum fog set is substantial").toBeGreaterThan(50)
  expect(inPath.outside, "fog dims real territory outside the curriculum").toBeGreaterThan(0)
  expect(inPath.total, "graph carries far more nodes than the fog set").toBeGreaterThan(inPath.setSize)

  // ...and the path DOM is populated: lessons render, and this veteran (zero belts won) still
  // has locks — fog and the lock economy coexist in the SAME render
  const lessonsInPath = await page.locator("[data-lesson]").count()
  const locksInPath = await page.locator("[data-locked]").count()
  expect(lessonsInPath, "path view renders lesson rows").toBeGreaterThan(0)
  expect(locksInPath, "veteran won no belts → path view still shows locks").toBeGreaterThan(0)

  // ── PHASE 2 · TREE: flip view mode via the REAL segmented control → fog lifts fully ──
  await page.locator('[data-view="tree"]').click()

  const inTree = await page.evaluate(readFog)
  expect(inTree.viewMode, "clicking TREE switches the view mode").toBe("tree")
  expect(inTree.pathDim, "tree view clears the fog gate (fog off)").toBe(false)

  // the fog artifacts are PATH-only: tree renders neither locks nor lesson rows
  expect(await page.locator("[data-locked]").count(), "tree view renders zero locks").toBe(0)
  expect(await page.locator("[data-lesson]").count(), "tree view renders zero lesson rows").toBe(0)

  // ── PHASE 3 · BACK TO PATH: _pathDim is RE-DERIVED, not latched off ──
  await page.locator('[data-view="path"]').click()

  const backInPath = await page.evaluate(readFog)
  expect(backInPath.viewMode, "clicking PATH restores path view").toBe("path")
  expect(backInPath.pathDim, "returning to path re-arms the fog (re-derived, not a latch)").toBe(true)
  // the lesson rows rebuild from scratch — same populated path DOM as phase 1
  expect(await page.locator("[data-lesson]").count(), "path lesson rows rebuild on return").toBe(lessonsInPath)
  expect(await page.locator("[data-locked]").count(), "path locks rebuild on return").toBe(locksInPath)
})
