/* @hyperspace {"theme":"lifetime-journeys","L":"legacy-corrupt-blob","F":"belt-path","B":"error-fallback"} @invariant "When bjj-neural-progress is malformed JSON, the belt path renders a pristine fresh profile without crashing: white belt row is unlocked (no data-locked), blue belt row data-locked='1', every unit row lacks data-done, and every [data-belt-test] reads 'locked' — corruption degrades to a clean white-belt start, not a broken explorer." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { CORRUPT_BLOB_RAW, CURRICULUM } from "./personas"

/**
 * CORRUPT BLOB → FRESH WHITE-BELT PATH — poisoned storage (syntactically-broken JSON under
 * bjj-neural-progress) falls back to a pristine fresh profile, and the belt PATH view — the
 * curriculum-mode face of the explorer — renders a clean white-belt start rather than crashing
 * or half-ingesting the corruption. Sibling to the two other corrupt-blob gen specs:
 *   - corrupt-blob-fresh-fallback-boot  → the in-memory fallback + a live first hand (gameplay)
 *   - corrupt-blob-heals-on-first-grade → the heal/quarantine lifecycle (persistence)
 * This one isolates the BELT-PATH RENDER off the fallback profile: the belt/unit/test lock
 * lattice must read exactly as a brand-new player's (white open, blue gated, nothing done,
 * every test locked) — corruption degrades to a clean start, never a broken path.
 *
 * Mechanism under test (neural/src/app.src.jsx, source-verified):
 *   - _loadProgress catches the JSON.parse throw and leaves the constructor-fresh maps
 *     (prep {}, rec {}, belts.won {}), so the render below sees a pristine profile.
 *   - beltUnlocked(0) === true unconditionally (:2434) → white belt row NEVER gets data-locked
 *     (:2482); beltUnlocked(1) keys on belts.won[white], absent on fresh → blue row data-locked=1.
 *   - unitComplete needs lessonDone (prep>=goal) AND a units[uk].checkpoint — both empty on
 *     fresh → no unit row is data-done (:~2505), and no belt-test is "ready".
 *   - belt-test state (:2522) = won ? "won" : !ready ? "locked" : …; fresh has zero units complete
 *     and belts 2..5 not even unlocked → EVERY [data-belt-test] resolves to "locked", written to
 *     the NON-OBVIOUS attribute data-test-state (:2531), not data-locked.
 *   - path_opened fires SYNCHRONOUSLY inside renderBeltPath (:2468) — assert with no advance().
 *
 * SEEDING RECIPE (the personas.ts docstring literal is VACUOUS — an addInitScript registered
 * before the first boot runs AHEAD of the DSL wipe, which then clears the poison):
 *   1. throwaway j.boot("/") FIRST, so the DSL wipe/ngseed init scripts register ahead of ours;
 *   2. addInitScript writing CORRUPT_BLOB_RAW, guarded by a ONE-SHOT sessionStorage flag (init
 *      scripts accumulate across boots — the flag stops any later boot from re-poisoning);
 *   3. boot again — the boot under test: wipe → corrupt seed → app parses corrupt bytes.
 *      The raw===CORRUPT_BLOB_RAW assert right after boot 2 is the seed-order proof — without it
 *      every fresh-profile read below is vacuously green (the key is never removed at construction).
 *
 * READ-ONLY belt-path render: no picks/drills. land()'s built-in ai-skill/role/max-moves rigs +
 * rigStart cover every draw the intro touches; the PATH render draws ZERO rng, so no extra rig
 * queues are needed. All ids/keys derive from the served curriculum fixture (never hardcoded);
 * assertions are STRUCTURE only (lock attributes, done attributes, counts, beats) — never TEXT.
 */

const KEY = "bjj-neural-progress"
const BELTS: any[] = CURRICULUM.belts
const [WHITE, BLUE] = BELTS
const ALL_UNIT_KEYS: string[] = BELTS.flatMap((b: any) => b.units.map((u: any) => `${b.id}/${u.id}`))
const TEST_BELT_IDS: string[] = BELTS.filter((b: any) => b.test).map((b: any) => b.id)

test("corrupt bjj-neural-progress: belt path degrades to a pristine fresh white-belt start, no crash", async ({
  page,
}) => {
  // ── curriculum facts the census leans on — fail loudly here if the corpus shifts ──
  expect(BELTS.length, "curriculum defines at least white + blue").toBeGreaterThanOrEqual(2)
  expect(WHITE.test, "white belt defines a test block").toBeTruthy()
  expect(BLUE, "curriculum defines a blue belt").toBeTruthy()
  expect(ALL_UNIT_KEYS.length, "curriculum defines unit rows").toBeGreaterThan(0)
  expect(TEST_BELT_IDS.length, "curriculum defines belt tests to census").toBeGreaterThan(0)
  // premise guard: the persona constant must actually be broken JSON, or the spec is vacuous
  expect(() => JSON.parse(CORRUPT_BLOB_RAW), "persona premise: CORRUPT_BLOB_RAW does not parse").toThrow()

  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))

  const j = journey(page)

  // ── Boot 1 (throwaway): registers the DSL wipe/ngseed init scripts AHEAD of our seed ──
  await j.boot("/")

  // ── One-shot poison seed: runs AFTER the DSL wipe on every later boot, writes only once ──
  await page.addInitScript((raw) => {
    try {
      if (!sessionStorage.getItem("__ng_corrupt_once")) {
        sessionStorage.setItem("__ng_corrupt_once", "1")
        localStorage.setItem("bjj-neural-progress", raw)
      }
    } catch {}
  }, CORRUPT_BLOB_RAW)

  // ── Boot 2 (under test): wipe → our poison → app construction parses the corrupt bytes ──
  await j.boot("/")

  // seed-order proof FIRST — without it the fresh-profile reads below are vacuously green
  expect(
    await page.evaluate((key) => localStorage.getItem(key), KEY),
    "seed-order proof: the corrupt blob was in storage when the app booted (key never removed)",
  ).toBe(CORRUPT_BLOB_RAW)

  // fresh-profile fallback (in-memory, via window.__neural): full ingest, pristine maps, zero mastery
  const fresh = await page.evaluate(() => {
    const a = (window as any).__neural
    return {
      nodes: a.nodes.length,
      prepKeys: Object.keys(a.prep || {}).length,
      recKeys: Object.keys(a.rec || {}).length,
      mastered: a.masteredCount(),
    }
  })
  expect(fresh.nodes, "app ingested the full graph despite the corrupt blob").toBeGreaterThan(1000)
  expect(fresh.prepKeys, "prep fell back to a pristine empty map").toBe(0)
  expect(fresh.recKeys, "rec fell back to a pristine empty map").toBe(0)
  expect(fresh.mastered, "masteredCount() === 0 — no phantom mastery from corrupt bytes").toBe(0)

  await j.land("Mount Top")

  // ── open the explorer's PATH view (curriculum served → path is the default mode);
  //    path_opened fires SYNCHRONOUSLY inside renderBeltPath — assert it with NO advance() between ──
  await page.evaluate(() => (window as any).__neural.toggleExplorer())
  await expect(page.locator("[data-view]").first()).toBeVisible()
  await j.expectBeat("path_opened")
  expect(
    await page.evaluate(() => (window as any).__neural._viewMode),
    "the explorer opened onto the belt PATH view (curriculum default)",
  ).toBe("path")

  // ── white belt row is UNLOCKED: beltUnlocked(0) is always true → no data-locked ──
  const whiteRow = page.locator(`[data-belt="${WHITE.id}"]`).first()
  await expect(whiteRow, "white belt row present").toBeVisible()
  expect(await whiteRow.getAttribute("data-locked"), "white belt row is unlocked on a fresh profile").toBeNull()

  // ── blue belt row is LOCKED: beltUnlocked(1) needs belts.won[white], absent on fresh ──
  const blueRow = page.locator(`[data-belt="${BLUE.id}"]`).first()
  await expect(blueRow, "blue belt row present").toBeVisible()
  expect(await blueRow.getAttribute("data-locked"), "blue belt row is locked (white not won on fresh)").toBe("1")

  // ── nothing is complete: NO unit row carries data-done, and the done-census is exactly zero ──
  for (const uk of ALL_UNIT_KEYS) {
    const unitRow = page.locator(`[data-unit="${uk}"]`).first()
    await expect(unitRow, `unit row present: ${uk}`).toHaveCount(1)
    expect(await unitRow.getAttribute("data-done"), `unit untouched on fresh profile: ${uk}`).toBeNull()
  }
  expect(
    await page.locator("[data-unit][data-done]").count(),
    "no unit is marked done — the fallback profile has zero progress",
  ).toBe(0)

  // ── every belt-test row reads "locked" — state lives in data-test-state, NOT data-locked ──
  const beltTests = page.locator("[data-belt-test]")
  expect(await beltTests.count(), "one belt-test row per curriculum belt that defines a test").toBe(TEST_BELT_IDS.length)
  const testStates = await beltTests.evaluateAll((els) => els.map((e) => e.getAttribute("data-test-state")))
  expect(testStates, "every belt test is locked on a fresh profile (no units complete, belts 2..N gated)").toEqual(
    TEST_BELT_IDS.map(() => "locked"),
  )

  // ── crash guard: registration boot + corrupt boot + landing + path render all ran clean ──
  expect(errors, "zero pageerror across double-boot, landing, and belt-path render").toEqual([])
})
