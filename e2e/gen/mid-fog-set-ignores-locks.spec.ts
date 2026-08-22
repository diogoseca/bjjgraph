/* @hyperspace {"theme":"unlock-economy","L":"curriculum-mid","F":"graph-canvas","B":"guard-limit"} @invariant "Fog-of-war encodes curriculum membership, never progress or track selection: an unselected blue-track lesson's node index is INSIDE _curriculumIdxSet (undimmed) while a genuine non-curriculum node stays outside — membership is exactly the fixture ids, blind to completion state and to which track the Challenges view renders." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { curriculumMid, CURRICULUM } from "./personas"

/**
 * FOG SET IGNORES PROGRESS AND TRACK SELECTION — the canvas fog-of-war and the study
 * economy are separate systems that must NOT leak into each other. For a mid-curriculum
 * white belt the Challenges view renders only the SELECTED track's lessons (white by
 * default, v1.74 — track locks themselves are retired: every track is open), yet blue's
 * lesson nodes glow undimmed on the canvas: the fog answers "is this on the curriculum?",
 * never "is this rendered / studied yet?".
 *
 * Mechanism under test (neural/src/app.src.jsx):
 *   - _onCurriculum builds _curriculumIdxSet by walking EVERY belt's units
 *     (u.positionNodeId) and lessons (l.nodeId) through _idIndex.get — with zero
 *     progress/track-selection consultation. Membership is coverage-blind by construction.
 *   - _idIndex is the Map id→idx built in ingest: node ids resolve to the indices the
 *     fog set stores.
 *   - The canvas fog draw reads `const fogSet = this._pathDim ? this._curriculumIdxSet
 *     : null;` — _pathDim is armed by renderChallenges (v1.74: `this._pathDim =
 *     !!this.curriculum`), then dims exactly the nodes OUTSIDE the set. In-set ⇒
 *     undimmed, studied or not, rendered or not.
 *   - renderChallenges renders lesson buttons ONLY for the selected track
 *     (challengeCurriculumElement(selected.id)) — so an unselected blue lesson has NO
 *     DOM row at all, making set membership demonstrably render-independent.
 *
 * The probe target is the first BLUE-EXCLUSIVE lesson: its nodeId appears in no white
 * unit's positionNodeId nor lesson nodeIds, so for a curriculumMid persona (white track
 * selected by default) its set membership can only come from the unselected blue track.
 * Everything derives from the served curriculum fixture — never hard-coded.
 *
 * No gameplay draws beyond land()'s built-in rigs (ai-skill/role/max-moves): the
 * challenges render and the fog set construction draw no RNG.
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

test("curriculum-mid: unselected blue lesson's node sits INSIDE the fog set; membership is exactly the fixture ids, selection-blind", async ({ page }) => {
  // ── curriculum facts the derivations lean on — fail loudly here if the corpus shifts ──
  expect(BELTS.length, "curriculum defines white + blue at minimum").toBeGreaterThanOrEqual(2)
  expect(blueExclusive.length, "blue-exclusive lessons exist (the probe target)").toBeGreaterThan(0)
  expect(FIXTURE_IDS.length, "fixture coverage is substantial (matches setSize>50 gate)").toBeGreaterThan(50)

  const j = journey(page)
  await j.boot("/", { initialState: curriculumMid() })
  await j.land("Mount Top") // built-in rigs (ai-skill/role/max-moves) cover every draw; path render draws none

  // open the explorer — curriculum loaded → CHALLENGES is the default face;
  // challenges_opened fires synchronously inside renderChallenges
  await page.evaluate(() => (window as any).__neural.toggleExplorer())
  await expect(page.locator("[data-view]").first()).toBeVisible()
  await j.expectBeat("challenges_opened")

  // ── preconditions: fog is ARMED (this is the state in which membership decides dimming) ──
  const pre = await page.evaluate(() => {
    const a = (window as any).__neural
    return { viewMode: a._viewMode, pathDim: !!a._pathDim, setSize: a._curriculumIdxSet ? a._curriculumIdxSet.size : 0 }
  })
  expect(pre.viewMode, "explorer opens on the challenges view").toBe("challenges")
  expect(pre.pathDim, "the challenges view arms the canvas fog gate").toBe(true)
  expect(pre.setSize, "fog set is substantial").toBeGreaterThan(50)

  // ── selection evidence: blue is genuinely UNSELECTED (and thus unrendered) for this persona ──
  const blueCard = page.locator(`.ng-track-card[data-track="${BLUE.id}"]`)
  expect(await blueCard.count(), "blue track card renders (all tracks open, v1.74)").toBe(1)
  expect(
    await blueCard.first().getAttribute("aria-pressed"),
    "blue is NOT the selected track (white is the default)",
  ).toBe("false")
  // v1.76.0 ladder: every track's curriculum renders, so the blue lesson DOES have a row —
  // but only inside BLUE's own section. Selection still governs the objectives detail, so
  // set membership below still cannot be an artifact of the selected view.
  expect(
    await page.locator(`[data-track-curriculum="${BLUE.id}"] [data-lesson="${TARGET.l.deckKey}"]`).count(),
    "unselected blue lesson renders inside blue's ladder section",
  ).toBe(1)
  expect(
    await page.locator(`.ng-challenge-detail [data-lesson="${TARGET.l.deckKey}"]`).count(),
    "and not inside the selected track's objectives detail",
  ).toBe(0)

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

  // (1) the unselected blue lesson's node index is INSIDE the fog set → drawn undimmed
  expect(verdict.targetIdx, "target lesson node resolves via _idIndex").toBeGreaterThanOrEqual(0)
  expect(verdict.targetInSet, "UNSELECTED blue lesson's node is inside _curriculumIdxSet (undimmed)").toBe(true)

  // (2) a genuine non-curriculum node exists and stays OUTSIDE → the fog dims real territory
  expect(verdict.compId, "a non-curriculum node exists in the graph").not.toBeNull()
  expect(verdict.compInSet, "non-curriculum node stays outside the fog set (dimmed)").toBe(false)

  // (3) census: every lesson of every belt — selected track or not — resolves into the set, 0 misses
  expect(verdict.misses, `all ${ALL_LESSON_IDS.length} lesson occurrences across all belts are in the set`).toBe(0)

  // (4) reverse census: 0 extras — membership is EXACTLY unit positionNodeIds + lesson
  // nodeIds, i.e. curriculum coverage, with progress/selection contributing nothing either way
  expect(verdict.unresolved, "every distinct fixture id resolves to a node index").toBe(0)
  expect(verdict.extras, "the set holds nothing beyond the fixture ids").toBe(0)
  expect(verdict.setSize, "set size equals the distinct fixture-id count — coverage-exact equality").toBe(verdict.expectedSize)
})
