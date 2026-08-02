/* @hyperspace {"theme":"unlock-economy","L":"legacy-corrupt-blob","F":"belt-path","B":"economy-math"} @invariant "The v1->v2 migration enriches the card ledger but fabricates zero unlock state: a legacy v1 blob's prep marks its lesson rows data-done='1', yet the units census shows zero done units, zero passed checkpoints, blue data-locked='1', every belt-test row 'locked', and belts.won empty." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { legacyV1, CURRICULUM } from "./personas"

/**
 * V1→V2 MIGRATION MINTS NO UNLOCKS — upgrading a VALID legacy blob enriches the card
 * ledger (rec grandfathered from prep) but fabricates ZERO unlock-economy state: no
 * unit completions, no checkpoint passes, no belts won. The economy's currencies are
 * earnable only through play — a schema upgrade must never mint them.
 *
 * Mechanism under test (neural/src/app.src.jsx, source-verified):
 *   - _loadProgress (:1090-1107): v1 accepted (p.v===1); prep copied; rec grandfathered
 *     from p.prep (v1 predates recall history); this.units / this.belts.won rebuilt from
 *     p.units / p.belts.won — ABSENT on a v1 blob → both stay {}.
 *   - _progressBlob (:1114) re-emits v:2 — the headline migration witness.
 *   - lessonDone keys on prep>=goal → migrated prep alone marks u1's lesson rows
 *     data-done="1"; unitComplete additionally needs units[uk].checkpoint (empty) → zero
 *     unit/checkpoint rows done; beltUnlocked(1) needs belts.won[white] (empty) → blue
 *     row data-locked="1"; every belt-test row resolves to data-test-state="locked"
 *     (belt-test state lives in data-test-state, NOT data-locked).
 *   - belt_unlocked is emitted ONLY at :3793 on a belt-test win — never during ingest.
 *
 * Sibling distinctness: core-008 pins the rec-grandfather VALUE (rec===prep), so ledger
 * enrichment is asserted here at the keys-exist level only; the corrupt-blob belt-path
 * spec covers MALFORMED→fresh — this one covers VALID v1→v2 enrich-without-minting.
 *
 * Read-only belt-path render: land()'s built-in rigs (ai-skill/role/max-moves + rigStart)
 * cover every draw; the path render draws zero RNG. All ids/keys derive from the served
 * curriculum fixture; assertions are STRUCTURE only (attrs, counts, beats) — never text.
 */

const BELTS: any[] = CURRICULUM.belts
const [WHITE, BLUE] = BELTS
const U1_KEYS: string[] = WHITE.units[0].lessons.map((l: any) => l.deckKey)
const TOTAL_UNITS: number = BELTS.reduce((s: number, b: any) => s + b.units.length, 0)
const TEST_BELT_IDS: string[] = BELTS.filter((b: any) => b.test).map((b: any) => b.id)
const ALL_KEYS: string[] = BELTS.flatMap((b: any) => b.units.flatMap((u: any) => u.lessons.map((l: any) => l.deckKey)))

test("legacy v1 blob migrates to v2: ledger enriched, zero unlock state minted", async ({ page }) => {
  // ── curriculum facts the exact-count census leans on — fail loudly here if the corpus shifts ──
  expect(U1_KEYS.length, "white u1 defines 5 lessons").toBe(5)
  expect(new Set(ALL_KEYS).size, "deckKeys globally distinct → done-rows map 1:1 to seeds").toBe(ALL_KEYS.length)
  expect(TOTAL_UNITS, "curriculum defines 30 units").toBe(30)
  expect(TEST_BELT_IDS.length, "all 5 belts define tests").toBe(BELTS.length)
  expect(BELTS.length, "curriculum defines 5 belts").toBe(5)

  // ── persona premise guards: a VALID v1 blob — prep only, none of the v2 economy keys ──
  const seed: any = legacyV1()
  expect(seed.v, "persona premise: legacy schema version").toBe(1)
  expect(seed.units, "persona premise: v1 has no units map").toBeUndefined()
  expect(seed.belts, "persona premise: v1 has no belts map").toBeUndefined()
  expect(Object.keys(seed.prep).sort(), "persona premise: prep covers exactly white u1").toEqual([...U1_KEYS].sort())

  const j = journey(page)
  await j.boot("/", { initialState: seed })

  // ── migration witness: the ingested profile re-emits as v2 with an ENRICHED ledger but
  //    EMPTY economy maps (rec VALUES belong to core-008 — keys-exist only here) ──
  const migrated = await page.evaluate(() => {
    const b = (window as any).__neural._progressBlob()
    return {
      v: b.v,
      recKeys: Object.keys(b.rec || {}).length,
      unitKeys: Object.keys(b.units || {}).length,
      beltsWonKeys: Object.keys((b.belts || {}).won || {}).length,
    }
  })
  expect(migrated.v, "blob re-emits as schema v2").toBe(2)
  expect(migrated.recKeys, "ledger enriched: grandfathered rec is non-empty").toBeGreaterThan(0)
  expect(migrated.unitKeys, "zero unit completions minted by migration").toBe(0)
  expect(migrated.beltsWonKeys, "zero belts won minted by migration").toBe(0)

  await j.land("Mount Top")

  // ── open the explorer's PATH view (curriculum served → path is the default mode);
  //    path_opened fires synchronously inside renderBeltPath — no advance() in between ──
  await page.evaluate(() => (window as any).__neural.toggleExplorer())
  await expect(page.locator("[data-view]").first()).toBeVisible()
  await j.expectBeat("path_opened")

  // ── ledger face: migrated prep marks EXACTLY the seeded u1 lesson rows done ──
  for (const key of U1_KEYS) {
    expect(
      await page.locator(`[data-lesson="${key}"]`).first().getAttribute("data-done"),
      `migrated prep marks lesson row done: ${key}`,
    ).toBe("1")
  }
  expect(
    await page.locator('[data-lesson][data-done="1"]').count(),
    "done-lesson census is exactly the seeded set — anti-vacuity witness",
  ).toBe(U1_KEYS.length)

  // ── structural sanity: the zero-censuses below span the WHOLE curriculum, not a subset ──
  expect(await page.locator("[data-unit]").count(), "one unit row per curriculum unit").toBe(TOTAL_UNITS)
  expect(await page.locator("[data-checkpoint]").count(), "one checkpoint row per unit").toBe(TOTAL_UNITS)

  // ── economy face: zero done units, zero passed checkpoints — migration minted nothing ──
  expect(await page.locator('[data-unit][data-done="1"]').count(), "zero units done").toBe(0)
  expect(await page.locator('[data-checkpoint][data-done="1"]').count(), "zero checkpoints passed").toBe(0)

  // ── blue stays victory-locked: beltUnlocked(1) needs belts.won[white], which is empty ──
  expect(
    await page.locator(`[data-belt="${BLUE.id}"]`).first().getAttribute("data-locked"),
    "blue belt row locked — no white victory was fabricated",
  ).toBe("1")

  // ── every belt-test row locked — state lives in data-test-state, NOT data-locked ──
  const beltTests = page.locator("[data-belt-test]")
  expect(await beltTests.count(), "one belt-test row per test-defining belt").toBe(TEST_BELT_IDS.length)
  const states = await beltTests.evaluateAll((els) => els.map((e) => e.getAttribute("data-test-state")))
  expect(states, "every belt test locked — no test readiness minted").toEqual(TEST_BELT_IDS.map(() => "locked"))

  // ── post-render re-read: landing + path render minted nothing en route ──
  const after = await page.evaluate(() => {
    const b = (window as any).__neural._progressBlob()
    return { unitKeys: Object.keys(b.units || {}).length, beltsWonKeys: Object.keys((b.belts || {}).won || {}).length }
  })
  expect(after.unitKeys, "units still empty after land + path render").toBe(0)
  expect(after.beltsWonKeys, "belts.won still empty after land + path render").toBe(0)

  // ── beat ledger: no completion/unlock beat ever fired this life ──
  const beats = await j.beats()
  expect(beats.filter((b) => b.beat === "unit_done"), "zero unit_done beats").toHaveLength(0)
  expect(beats.filter((b) => b.beat === "checkpoint_passed"), "zero checkpoint_passed beats").toHaveLength(0)
  expect(beats.filter((b) => b.beat === "belt_unlocked"), "zero belt_unlocked beats").toHaveLength(0)
})
