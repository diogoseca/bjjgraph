/* @hyperspace {"theme":"unlock-economy","L":"curriculum-mid","F":"graph-canvas","B":"guard-limit"} @invariant "Fog-of-war encodes curriculum membership, never lock state: a locked blue-belt lesson's node index is INSIDE _curriculumIdxSet (undimmed) while a genuine non-curriculum node stays outside — locked-but-curricular content is visible on the canvas, locks live only in the path rows." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { curriculumMid, CURRICULUM } from "./personas"

/**
 * FOG SET IGNORES LOCKS — the canvas fog-of-war and the unlock economy are separate
 * systems that must NOT leak into each other. For a mid-curriculum white belt, ALL of
 * blue is study-locked in the path rows, yet blue's lesson nodes glow undimmed on the
 * canvas: the fog answers "is this on the curriculum?", never "may you study it yet?".
 *
 * Mechanism under test (neural/src/app.src.jsx):
 *   - _onCurriculum (L2388-2402) builds _curriculumIdxSet by walking EVERY belt's units
 *     (u.positionNodeId) and lessons (l.nodeId) through _idIndex.get — with zero
 *     beltUnlocked/unitComplete consultation. Membership is lock-blind by construction.
 *   - _idIndex is the Map id→idx built in ingest (L361-363): node ids resolve to the
 *     indices the fog set stores.
 *   - The canvas fog draw (L5075) reads `const fogSet = this._pathDim ?
 *     this._curriculumIdxSet : null;` — gated ONLY on _pathDim (path view open), then
 *     dims exactly the nodes OUTSIDE the set. In-set ⇒ undimmed, locked or not.
 *   - renderBeltPath (L2467+) is where locks DO live: data-locked renders on belt rows
 *     (~L2483) and unit rows (~L2494) only. Lesson rows get data-lesson but NEVER
 *     data-locked — so a locked belt's lessons still render as (dimmed-styled) rows.
 *
 * The probe target is the first BLUE-EXCLUSIVE lesson: its nodeId appears in no white
 * unit's positionNodeId nor lesson nodeIds, so for a curriculumMid persona (zero belts
 * won → blue fully locked) its set membership can only come from the locked blue belt.
 * Everything derives from the served curriculum fixture — never hard-coded.
 *
 * No gameplay draws beyond land()'s built-in rigs (ai-skill/role/max-moves): the path
 * render and the fog set construction draw no RNG.
 */

const BELTS: any[] = CURRICULUM.belts
const BLUE = BELTS[1]

// White's coverage, mirroring exactly what _onCurriculum ingests per unit
const whiteIds = new Set<string>()
for (const u of BELTS[0].units) {
  if (u.positionNodeId) whiteIds.add(u.positionNodeId)
  for (const l of u.lessons) whiteIds.add(l.nodeId)
}
// First blue lesson whose node belongs to NO white unit (33 exist today; first is
// Positions/Standing-Position → deckKey "Standing Position|Top") — derived, not pinned
const blueExclusive: Array<{ u: any; l: any }> = []
for (const u of BLUE.units) for (const l of u.lessons) if (!whiteIds.has(l.nodeId)) blueExclusive.push({ u, l })
const TARGET = blueExclusive[0]

// Full fixture coverage across ALL belts — the set _onCurriculum is supposed to equal
const FIXTURE_IDS: string[] = []
{
  const seen = new Set<string>()
  for (const b of BELTS)
    for (const u of b.units) {
      if (u.positionNodeId && !seen.has(u.positionNodeId)) { seen.add(u.positionNodeId); FIXTURE_IDS.push(u.positionNodeId) }
      for (const l of u.lessons) if (!seen.has(l.nodeId)) { seen.add(l.nodeId); FIXTURE_IDS.push(l.nodeId) }
    }
}
// Every lesson occurrence (cross-belt duplicates included) for the forward census
const ALL_LESSON_IDS: string[] = BELTS.flatMap((b: any) => b.units.flatMap((u: any) => u.lessons.map((l: any) => l.nodeId)))

test("curriculum-mid: locked blue lesson's node sits INSIDE the fog set; membership is exactly the fixture ids, lock-blind", async ({ page }) => {
  // ── curriculum facts the derivations lean on — fail loudly here if the corpus shifts ──
  expect(BELTS.length, "curriculum defines white + blue at minimum").toBeGreaterThanOrEqual(2)
  expect(blueExclusive.length, "blue-exclusive lessons exist (the probe target)").toBeGreaterThan(0)
  expect(FIXTURE_IDS.length, "fixture coverage is substantial (matches setSize>50 gate)").toBeGreaterThan(50)

  const j = journey(page)
  await j.boot("/", { initialState: curriculumMid() })
  await j.land("Mount Top") // built-in rigs (ai-skill/role/max-moves) cover every draw; path render draws none

  // open the explorer — curriculum loaded → PATH is the default face; path_opened fires
  // synchronously inside renderBeltPath
  await page.evaluate(() => (window as any).__neural.toggleExplorer())
  await expect(page.locator("[data-view]").first()).toBeVisible()
  await j.expectBeat("path_opened")

  // ── preconditions: fog is ARMED (this is the state in which membership decides dimming) ──
  const pre = await page.evaluate(() => {
    const a = (window as any).__neural
    return { viewMode: a._viewMode, pathDim: !!a._pathDim, setSize: a._curriculumIdxSet ? a._curriculumIdxSet.size : 0 }
  })
  expect(pre.viewMode, "explorer opens on path view").toBe("path")
  expect(pre.pathDim, "path view arms the canvas fog gate").toBe(true)
  expect(pre.setSize, "fog set is substantial").toBeGreaterThan(50)

  // ── lock evidence: blue is genuinely LOCKED in the path rows for this persona ──
  expect(
    await page.locator(`[data-belt="${BLUE.id}"]`).first().getAttribute("data-locked"),
    "blue belt row is victory-locked (curriculumMid won no belts)",
  ).toBe("1")
  expect(
    await page.locator(`[data-unit="${BLUE.id}/${TARGET.u.id}"]`).first().getAttribute("data-locked"),
    "the unit containing the target lesson is locked",
  ).toBe("1")
  // ...and the locked lesson STILL renders its row — lock-free, because lesson rows
  // never carry data-locked (locks live on belt/unit rows only)
  const lessonRow = page.locator(`[data-lesson="${TARGET.l.deckKey}"]`)
  expect(await lessonRow.count(), "locked blue lesson still renders its path row").toBe(1)
  expect(await lessonRow.first().getAttribute("data-locked"), "lesson rows never carry data-locked").toBeNull()
  expect(await page.locator("[data-lesson][data-locked]").count(), "NO lesson row anywhere carries a lock").toBe(0)

  // ── the four membership claims, read off the live instance the way the fog draw does ──
  const verdict = await page.evaluate(
    ([targetId, fixtureIds, lessonIds]) => {
      const a = (window as any).__neural
      const set: Set<number> = a._curriculumIdxSet
      const fixture = new Set(fixtureIds as string[])
      // (1) the locked-blue lesson's node index
      const targetIdx = a._idIndex.get(targetId)
      // (2) first genuine non-curriculum node: id in NO belt's units/lessons
      const comp = a.nodes.find((n: any) => !fixture.has(n.id))
      // (3) forward census: every lesson occurrence across every belt resolves into the set
      let misses = 0
      for (const id of lessonIds as string[]) {
        const i = a._idIndex.get(id)
        if (i == null || !set.has(i)) misses++
      }
      // (4) reverse census: the set is EXACTLY the distinct fixture ids' indices — no extras
      const expected = new Set<number>()
      let unresolved = 0
      for (const id of fixtureIds as string[]) {
        const i = a._idIndex.get(id)
        if (i == null) unresolved++
        else expected.add(i)
      }
      let extras = 0
      for (const i of set) if (!expected.has(i)) extras++
      return {
        targetIdx: targetIdx == null ? -1 : targetIdx,
        targetInSet: targetIdx != null && set.has(targetIdx),
        compId: comp ? comp.id : null,
        compInSet: comp ? set.has(comp.idx) : true,
        misses,
        unresolved,
        extras,
        setSize: set.size,
        expectedSize: expected.size,
      }
    },
    [TARGET.l.nodeId, FIXTURE_IDS, ALL_LESSON_IDS] as const,
  )

  // (1) the locked blue lesson's node index is INSIDE the fog set → drawn undimmed
  expect(verdict.targetIdx, "target lesson node resolves via _idIndex").toBeGreaterThanOrEqual(0)
  expect(verdict.targetInSet, "LOCKED blue lesson's node is inside _curriculumIdxSet (undimmed)").toBe(true)

  // (2) a genuine non-curriculum node exists and stays OUTSIDE → the fog dims real territory
  expect(verdict.compId, "a non-curriculum node exists in the graph").not.toBeNull()
  expect(verdict.compInSet, "non-curriculum node stays outside the fog set (dimmed)").toBe(false)

  // (3) census: every lesson of every belt — locked or not — resolves into the set, 0 misses
  expect(verdict.misses, `all ${ALL_LESSON_IDS.length} lesson occurrences across all belts are in the set`).toBe(0)

  // (4) reverse census: 0 extras — membership is EXACTLY unit positionNodeIds + lesson
  // nodeIds, i.e. curriculum coverage, with lock state contributing nothing either way
  expect(verdict.unresolved, "every distinct fixture id resolves to a node index").toBe(0)
  expect(verdict.extras, "the set holds nothing beyond the fixture ids").toBe(0)
  expect(verdict.setSize, "set size equals the distinct fixture-id count — lock-blind equality").toBe(verdict.expectedSize)
})
