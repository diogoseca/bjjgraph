/* @hyperspace {"theme":"lifetime-journeys","L":"srs-veteran","F":"belt-path","B":"cross-feature"} @invariant "A 25-deck SRS veteran whose proven decks span multiple belts sees every lesson row those decks back marked data-done='1' across belt boundaries, yet because no checkpoint passed and no belt won, every belt-test row still reads data-test-state 'locked' and blue's units remain sequentially locked — drilled recall crosses belts but never unlocks a test." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { srsVeteran, CURRICULUM } from "./personas"

/**
 * Mechanism under test (neural/src/app.src.jsx, renderBeltPath ~2484-2535):
 *   - lesson done attr (2497/2505): ld = lessonDone(key) = prep[key] >= _deckGoal(key)
 *     (min(3,deckSize)). srsVeteran seeds prep=5, so EVERY live (gi-frame) seeded deck
 *     renders data-done="1" — and the row's data-lesson/data-done are set independent of
 *     the unit lock, so a deck inside a LOCKED blue unit still shows done. Recall (rec)
 *     never enters this predicate: pure drill marks the row.
 *   - belt-test gate (2519-2531): ready = unlocked && b.units.every(unitComplete);
 *     state = won ? "won" : !ready ? "locked" : attempts ? "retry" : "ready". unitComplete
 *     (2429) additionally requires units[uk].checkpoint — the veteran has ZERO checkpoints,
 *     so every belt (white included) fails ready → every test row is "locked". No belt won,
 *     no attempts logged → never "won"/"retry". White's OWN test is locked despite a fully
 *     drilled white belt: drills don't ready a test, checkpoints/wins do.
 *   - sequential unit locks (2489): uLocked = !unlocked || !prevUnitDone. White U0 has
 *     unlocked=true and prevUnitDone=true (seed) but no checkpoint → uDone=false → data-done
 *     null AND (not locked) data-locked null. White U1 inherits prevUnitDone=uDone(U0)=false
 *     → data-locked="1" (fully drilled yet gated). Blue is a locked BELT (beltUnlocked=false,
 *     no white win) → every blue unit carries data-locked="1" regardless of prevUnitDone.
 *
 * The seeded set is derived by REPLAYING personas.srsVeteran's exact belts→units→lessons
 * iteration (break at N), so every id/count below tracks the served curriculum fixture and
 * owner curriculum edits can never silently drift the asserts. No moves resolve — land()'s
 * ai-skill/role/max-moves rigs cover every RNG site; the path render draws none.
 */

const BELTS: any[] = CURRICULUM.belts
const [WHITE, BLUE] = BELTS

// srsVeteran(25) can't cross belts: white holds 32 lessons, so 25 decks live entirely in
// white. Size N past the white total (+3) to genuinely span white→blue. Never hardcode 25.
const WHITE_TOTAL: number = WHITE.units.reduce((s: number, u: any) => s + u.lessons.length, 0)
const N_DECKS = WHITE_TOTAL + 3

// Mirror personas.ts srsVeteran iteration EXACTLY: belts → units → lessons, break at N.
// Carry each seed's owning belt so the cross-belt claim is asserted, not assumed.
const SEEDED: Array<{ belt: string; key: string }> = []
outer: for (const belt of BELTS)
  for (const u of belt.units)
    for (const l of u.lessons) {
      SEEDED.push({ belt: belt.id, key: l.deckKey })
      if (SEEDED.length >= N_DECKS) break outer
    }
const SEEDED_KEYS = SEEDED.map((s) => s.key)
const BLUE_SEEDED = SEEDED.filter((s) => s.belt === BLUE.id)
// the blue unit the crossed lessons belong to (derived, not hardcoded)
const BLUE_CROSSED_UNIT: string = (() => {
  for (const u of BLUE.units)
    if (u.lessons.some((l: any) => BLUE_SEEDED.some((s) => s.key === l.deckKey))) return `${BLUE.id}/${u.id}`
  return ""
})()

const TOTAL_UNITS = BELTS.reduce((s: number, b: any) => s + b.units.length, 0)
const TEST_BELTS = BELTS.filter((b: any) => b.test).length

test("veteran cross-belt: every drilled lesson row done across belts, yet all tests locked and blue units gated", async ({
  page,
}) => {
  // ── curriculum facts the exact-count asserts lean on — fail loudly if the corpus shifts ──
  expect(N_DECKS, "N sized past white total so seeds cross into blue").toBeGreaterThanOrEqual(33)
  expect(SEEDED).toHaveLength(N_DECKS)
  expect(new Set(SEEDED_KEYS).size, "deckKeys distinct → done-rows map 1:1 to seeds").toBe(N_DECKS)
  expect(new Set(SEEDED.map((s) => s.belt)).size, "seeded decks span >1 belt").toBeGreaterThanOrEqual(2)
  expect(BLUE_SEEDED.length, "at least one seeded deck lives in blue").toBeGreaterThan(0)
  expect(BLUE_CROSSED_UNIT, "resolved the blue unit that owns the crossed lessons").not.toBe("")
  expect(TEST_BELTS, "every belt defines a test (the test-row census assumes it)").toBe(BELTS.length)

  const j = journey(page)
  await j.boot("/", { initialState: srsVeteran(N_DECKS) })
  await j.land("Mount Top")

  // open the explorer's PATH view (curriculum loaded → path is the default mode);
  // path_opened fires synchronously inside renderBeltPath — no advance() in between
  await page.evaluate(() => (window as any).__neural.toggleExplorer())
  await expect(page.locator("[data-view]").first()).toBeVisible()
  await j.expectBeat("path_opened")

  // ── LEG 1 — cross-belt done census: every seeded lesson row (white AND blue) is done ──
  for (const { key } of SEEDED) {
    expect(
      await page.locator(`[data-lesson="${key}"]`).first().getAttribute("data-done"),
      `seeded lesson row marked done across belt boundary: ${key}`,
    ).toBe("1")
  }
  // ...and ONLY those rows — the done-row census is exactly the seeded set (no over-marking)
  expect(
    await page.locator('[data-lesson][data-done="1"]').count(),
    "done-lesson census equals seeded set exactly",
  ).toBe(N_DECKS)

  // ── LEG 2 — belt-test gate: every belt's test row locked, none won/ready/retry ──
  const testRows = page.locator("[data-belt-test]")
  expect(await testRows.count(), "one test row per belt").toBe(TEST_BELTS)
  expect(
    await testRows.evaluateAll((els) => els.map((e) => e.getAttribute("data-test-state"))),
    "no checkpoint + no belt won → every belt test locked (white's own included)",
  ).toEqual(Array(TEST_BELTS).fill("locked"))
  // crux, spelled out: white is fully drilled yet its own test is still locked
  expect(
    await page.locator(`[data-belt-test="${WHITE.id}"]`).first().getAttribute("data-test-state"),
    "white test locked despite a fully drilled white belt — drills don't ready a test",
  ).toBe("locked")

  // ── LEG 3 — sequential unit locks: white U0 open, white U1 gated, blue units locked ──
  const whiteU0 = page.locator(`[data-unit="${WHITE.id}/${WHITE.units[0].id}"]`).first()
  expect(await whiteU0.getAttribute("data-locked"), "white unit 0 is open (no lock)").toBeNull()
  expect(await whiteU0.getAttribute("data-done"), "white unit 0 not complete (no checkpoint)").toBeNull()
  expect(
    await page.locator(`[data-unit="${WHITE.id}/${WHITE.units[1].id}"]`).first().getAttribute("data-locked"),
    "white unit 1 locked — U0 fully drilled but no checkpoint → prevUnitDone false",
  ).toBe("1")
  expect(
    await page.locator(`[data-unit="${BLUE_CROSSED_UNIT}"]`).first().getAttribute("data-locked"),
    "blue unit locked — blue is a locked belt (white unwon), even with its lessons drilled",
  ).toBe("1")

  // ── LEG 4 — zero completion: no unit/checkpoint done, structure fully rendered ──
  expect(await page.locator("[data-unit]").count(), "every unit renders one unit row").toBe(TOTAL_UNITS)
  expect(await page.locator("[data-checkpoint]").count(), "every unit renders one checkpoint row").toBe(TOTAL_UNITS)
  expect(await page.locator('[data-unit][data-done="1"]').count(), "no unit complete").toBe(0)
  expect(await page.locator('[data-checkpoint][data-done="1"]').count(), "no checkpoint passed").toBe(0)

  // ── no completion beat ever fired this life — drilled recall crossed belts, unlocked nothing ──
  const beats = await j.beats()
  expect(beats.filter((b) => b.beat === "unit_done"), "no unit_done beat").toHaveLength(0)
  expect(beats.filter((b) => b.beat === "checkpoint_passed"), "no checkpoint_passed beat").toHaveLength(0)
  expect(beats.filter((b) => b.beat === "belt_test_won"), "no belt_test_won beat").toHaveLength(0)
})
