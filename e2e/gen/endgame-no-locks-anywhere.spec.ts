/* @hyperspace {"theme":"lifetime-journeys","L":"multi-belt-endgame","F":"belt-path","B":"guard-limit"} @invariant "With every belt won the path view has exhausted its lock economy: zero [data-locked] elements render anywhere in path view, every unit row is data-done='1', and every belt's test row reads 'won'." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { multiBeltEndgame, CURRICULUM } from "./personas"

/**
 * ENDGAME LOCK-ECONOMY EXHAUSTION — a player who has won EVERY belt opens the path
 * view: nothing may be locked, nothing may be pending. The lock economy has one exit
 * state and this persona is standing in it.
 *
 * Mechanism under test (neural/src/app.src.jsx renderBeltPath, ~2460-2530):
 *   - data-locked="1" is set on belt rows (!beltUnlocked) and unit rows (uLocked) ONLY
 *     when locked — unlocked rows carry NO attribute (getAttribute → null). A bare
 *     [data-locked] selector is therefore the exact census of remaining locks; endgame
 *     must drain it to zero. beltUnlocked(i) keys on belts.won[prev.id], seeded for
 *     every belt by the persona.
 *   - unit rows get data-done="1" iff unitComplete (lessons prep>=goal + checkpoint —
 *     both seeded). Path view does NOT collapse or virtualize finished belts: every
 *     unit row across every belt renders, so the done census must equal the FULL
 *     curriculum unit count.
 *   - each belt-test row carries data-belt-test=beltId + data-test-state, where
 *     state = won | locked | retry | ready and won wins: belts.won[b.id] is seeded
 *     for all belts, so every test row must read "won".
 *
 * No gameplay draws in this journey — land()'s built-in rigs (ai-skill/role/max-moves)
 * cover every RNG site touched; the path render itself draws no RNG. All totals derive
 * from the served curriculum fixture (5 belts / 30 units today), never hardcoded.
 */

const BELTS: any[] = CURRICULUM.belts
const TOTAL_UNITS = BELTS.reduce((s: number, b: any) => s + b.units.length, 0)

test("multi-belt endgame: path view renders zero locks, all units done, every belt test won", async ({ page }) => {
  // curriculum facts the exact-count asserts lean on — fail loudly here if the corpus shifts
  expect(BELTS.length, "curriculum defines belts").toBeGreaterThan(0)
  expect(TOTAL_UNITS, "curriculum defines units").toBeGreaterThan(0)
  expect(
    BELTS.every((b: any) => b.test),
    "every belt defines a test (the per-belt test-row census assumes it)",
  ).toBe(true)

  const j = journey(page)
  await j.boot("/", { initialState: multiBeltEndgame() })
  await j.land("Mount Top")

  // open the explorer's PATH view (curriculum loaded → path is the default mode)
  await page.evaluate(() => (window as any).__neural.toggleExplorer())
  await expect(page.locator("[data-view]").first()).toBeVisible()
  await j.expectBeat("path_opened")

  // ── lock economy exhausted: not one data-locked row anywhere in path view ──
  // (attribute renders only when locked, so the bare selector IS the lock census)
  expect(await page.locator("[data-locked]").count(), "zero locked rows remain").toBe(0)

  // ── every unit row rendered AND done: the full-curriculum census, no collapse ──
  expect(await page.locator("[data-unit]").count(), "all unit rows render").toBe(TOTAL_UNITS)
  expect(
    await page.locator('[data-unit][data-done="1"]').count(),
    "every unit row is marked done",
  ).toBe(TOTAL_UNITS)

  // ── every belt's test row exists and reads "won" ──
  expect(await page.locator("[data-test-state]").count(), "one test row per belt").toBe(BELTS.length)
  expect(
    await page.locator('[data-test-state="won"]').count(),
    "every test row is in the won state",
  ).toBe(BELTS.length)
  for (const b of BELTS) {
    expect(
      await page.locator(`[data-belt-test="${b.id}"]`).first().getAttribute("data-test-state"),
      `belt test row reads won: ${b.id}`,
    ).toBe("won")
  }
})
