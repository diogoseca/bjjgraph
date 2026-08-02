/* @hyperspace {"theme":"lifetime-journeys","L":"white-belt-holder","F":"belt-test","B":"guard-limit"} @invariant "Winning white unlocks blue STUDY but not the blue TEST: a white-belt holder with zero blue progress sees white's test row 'won' and blue's test row 'locked' — belt tests gate on that belt's own units, not on the previous belt's victory." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { whiteBeltHolder, CURRICULUM } from "./personas"

/**
 * HOLDER'S NEXT TEST STAYS LOCKED — the belt-test gate is TWO-layered, and winning a
 * belt only opens the first layer. A fresh white-belt holder (white won, zero blue
 * progress) must see blue's STUDY open but blue's TEST still locked: tests gate on that
 * belt's OWN units, never on the previous belt's victory alone.
 *
 * Mechanism under test (neural/src/app.src.jsx):
 *   - beltUnlocked(i) (~2428) keys ONLY on belts.won[prev.id] — so the blue BELT row
 *     renders with NO data-locked attr the moment white is won (the attr renders only
 *     when locked; getAttribute → null means study-unlocked).
 *   - the test row (~2513-2528): ready = unlocked && belt.units.every(unitComplete);
 *     state = won ? "won" : !ready ? "locked" : attempts ? "retry" : "ready". Blue is
 *     unlocked but has zero units complete → !ready → data-test-state="locked". White
 *     has belts.won.white seeded → "won". Purple's PREVIOUS belt (blue) is unwon → its
 *     belt row keeps data-locked="1" — the victory gate the invariant says tests
 *     DON'T reuse.
 *
 * No moves are resolved — land()'s built-in rigs (ai-skill/role/max-moves) cover every
 * RNG site touched; the path render draws no RNG. All ids derive from the served
 * curriculum fixture, never hardcoded.
 */

const BELTS: any[] = CURRICULUM.belts
const [WHITE, BLUE, PURPLE] = BELTS

test("white-belt holder: blue study open, blue test locked — tests gate on own units, not prior victory", async ({ page }) => {
  // curriculum facts the census asserts lean on — fail loudly here if the corpus shifts
  expect(BELTS.length, "curriculum defines at least white/blue/purple").toBeGreaterThanOrEqual(3)
  expect(
    BELTS.every((b: any) => b.test),
    "every belt defines a test block (the test-row census assumes it)",
  ).toBe(true)

  const j = journey(page)
  await j.boot("/", { initialState: whiteBeltHolder() })
  await j.land("Mount Top")

  // open the explorer's PATH view (curriculum loaded → path is the default mode);
  // path_opened fires synchronously inside renderBeltPath — no advance() in between
  await page.evaluate(() => (window as any).__neural.toggleExplorer())
  await expect(page.locator("[data-view]").first()).toBeVisible()
  await j.expectBeat("path_opened")

  // ── layer 1, history: white's own test row reads "won" (belts.won.white seeded) ──
  expect(
    await page.locator(`[data-belt-test="${WHITE.id}"]`).first().getAttribute("data-test-state"),
    "white test row records the victory",
  ).toBe("won")

  // ── layer 1, frontier: white's victory unlocked blue STUDY (no data-locked attr) ──
  const blueRow = page.locator(`[data-belt="${BLUE.id}"]`).first()
  await expect(blueRow).toBeVisible()
  expect(await blueRow.getAttribute("data-locked"), "blue belt row is study-unlocked").toBeNull()

  // ── layer 2, the crux: blue's TEST is still locked (zero blue units complete) ──
  expect(
    await page.locator(`[data-belt-test="${BLUE.id}"]`).first().getAttribute("data-test-state"),
    "blue test stays locked despite white's victory",
  ).toBe("locked")

  // ── boundary control: purple still sits behind the VICTORY gate (blue unwon) ──
  expect(
    await page.locator(`[data-belt="${PURPLE.id}"]`).first().getAttribute("data-locked"),
    "purple belt row is victory-locked",
  ).toBe("1")
  // belt-lock census: exactly the belts after blue carry the victory lock
  expect(await page.locator("[data-belt][data-locked]").count()).toBe(BELTS.length - 2)

  // ── test-state census: ONE won row (white's), every other belt's test locked —
  //    none ready/retry, because no other belt has its own units complete ──
  expect(await page.locator("[data-test-state]").count(), "one test row per belt").toBe(BELTS.length)
  expect(await page.locator('[data-test-state="won"]').count(), "white is the only won test").toBe(1)
  expect(
    await page.locator('[data-test-state="locked"]').count(),
    "all remaining tests are locked",
  ).toBe(BELTS.length - 1)
})
