/* @hyperspace {"theme":"lifetime-journeys","L":"multi-belt-endgame","F":"belt-test","B":"idempotence"} @invariant "Clicking an already-won belt-test row never erases the recorded win: belts.won keeps all 5 entries with their original moves/dominance, no belt_test_start beat fires from the click (or, if a retake opens, aborting it via resetRoll leaves belts.won and every row's 'won' state intact)." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { multiBeltEndgame, CURRICULUM } from "./personas"

/**
 * ENDGAME WON-TEST FINALITY — a player holding EVERY belt clicks an already-won belt-test
 * row in the path view. A won test is final: the click must be inert, and the recorded
 * win (moves/dominance) must survive byte-for-byte in memory and in the persisted blob.
 *
 * Mechanism under test (probe-verified live twice, deterministic, ~2.1s/run):
 *   - renderBeltPath's test row (neural/src/app.src.jsx ~2506-2527): state = won ? "won" :
 *     !ready ? "locked" : attempts ? "retry" : "ready", and onClick is
 *     `state === "ready" || state === "retry" ? () => this.startBeltTest(b.id) : null`
 *     — a "won" row gets NULL.
 *   - the mk row helper (~2680-2688) attaches a click listener only `if (onClick)`, so a
 *     won row is inert DOM: clicking it runs no app code at all.
 *   - startBeltTest (~2540-2565) is the ONLY emitter of belt_test_start (2561) and the only
 *     place this flow closes the explorer (2562-3) — so the no-op is triply observable:
 *     zero belt_test_start beats, _beltTest never staged, explorer STILL open after click.
 *   - belts.won round-trips wholesale: ingest copies it verbatim (~1098-1099) and
 *     _progressBlob() writes this.belts unfiltered, so the persona's seeded
 *     {moves, dominance, byPoints} fields survive boot → save → compare.
 *
 * The invariant's retake parenthetical is dead-code armor: the handler is never attached
 * for a won row, so no retake CAN open. Rather than exercising an unreachable resetRoll
 * abort, this spec asserts the strictly stronger fact (zero belt_test_start beats +
 * _beltTest stays unstaged) — if a regression ever attaches the handler, those trip first.
 *
 * GOTCHA (probe-found): because startBeltTest never runs, the inert click leaves the
 * explorer OPEN — the fresh-render census must close-if-open first, then re-open.
 *
 * No dice are rolled anywhere in this journey: land()'s built-in rigs (ai-skill/role/
 * max-moves) cover every RNG site touched. All counts derive from the served curriculum
 * fixture (5 belts with tests today) — never hardcoded.
 */

const BELTS: any[] = CURRICULUM.belts
const TEST_BELTS: any[] = BELTS.filter((b: any) => b.test)

test("won belt-test row is inert: no belt_test_start from the click, belts.won deep-stable in memory + storage, every row stays won", async ({ page }) => {
  // curriculum facts the exact-count asserts lean on — fail loudly here if the corpus shifts
  const N_TESTS = TEST_BELTS.length
  expect(N_TESTS, "curriculum defines at least one belt test").toBeGreaterThan(0)

  const j = journey(page)
  await j.boot("/", { initialState: multiBeltEndgame() })
  await j.land("Mount Top")

  // ── ORIGINAL snapshot + persona premise: every belt won, seeded fields intact ──
  const snapshot = await page.evaluate(() =>
    JSON.parse(JSON.stringify((window as any).__neural.belts.won)),
  )
  const expectedWon: Record<string, unknown> = {}
  for (const b of BELTS) expectedWon[b.id] = { moves: 12, dominance: 5, byPoints: false }
  expect(snapshot, "ingest round-tripped every seeded win wholesale (dominance included)").toEqual(expectedWon)

  // ── open the explorer's PATH face (curriculum loaded → path is the default mode) ──
  await page.evaluate(() => (window as any).__neural.toggleExplorer())
  await j.expectBeat("path_opened")
  const firstTest = TEST_BELTS[0]
  const row = page.locator(`[data-belt-test="${firstTest.id}"]`)
  await expect(row, "first belt's test row rendered").toBeVisible()
  expect(await row.getAttribute("data-test-state"), "row reads won before the click").toBe("won")

  // ── THE CLICK (Playwright auto-scrolls the explorer list): a won row has no listener ──
  await row.click()
  await j.advance(1000)

  // no retake opened — the three observable faces of the inert branch
  expect(
    await page.evaluate(() => !!(window as any).__neural._beltTest),
    "no belt test was staged by the click",
  ).toBe(false)
  const beats = await j.beats()
  expect(
    beats.filter((b) => b.beat === "belt_test_start").length,
    "zero belt_test_start beats after clicking the won row",
  ).toBe(0)
  expect(
    await page.evaluate(() => (window as any).__neural.explorerRef.current.style.display),
    "explorer stayed open — startBeltTest's closing branch never ran",
  ).toBe("flex")

  // ── fresh-render census: close-if-open (the inert click left it open), re-open ──
  await page.evaluate(() => {
    const a = (window as any).__neural
    if (a.explorerRef.current && a.explorerRef.current.style.display === "flex") a.toggleExplorer()
    a.toggleExplorer()
  })
  await expect(row, "test row rendered again on the fresh open").toBeVisible()
  expect(await page.locator("[data-belt-test]").count(), "one test row per belt with a test").toBe(N_TESTS)
  expect(
    await page.locator('[data-belt-test][data-test-state="won"]').count(),
    "every test row still reads won",
  ).toBe(N_TESTS)

  // ── the win record itself: in-memory AND persisted blob deep-equal the original ──
  const after = await page.evaluate(() => ({
    won: JSON.parse(JSON.stringify((window as any).__neural.belts.won)),
    storedWon: (() => {
      try {
        const raw = localStorage.getItem("bjj-neural-progress")
        return raw ? ((JSON.parse(raw).belts || {}).won ?? null) : null
      } catch {
        return null
      }
    })(),
  }))
  expect(after.won, "belts.won unchanged by the click — moves/dominance intact").toEqual(snapshot)
  // guard with if-present: the app may not have re-saved by now (then storage still holds
  // the seed blob, whose belts.won equals the snapshot anyway — both paths must agree)
  if (after.storedWon) {
    expect(after.storedWon, "persisted blob's belts.won matches the original snapshot").toEqual(snapshot)
  }
})
