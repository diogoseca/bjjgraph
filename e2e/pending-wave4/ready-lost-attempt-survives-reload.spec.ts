/* @hyperspace {"theme":"unlock-economy","L":"belt-ready","F":"persistence-reload","B":"persistence-reload"} @invariant "A burned belt-test attempt is durable economy: after a rigged loss the attempts counter reads exactly 1 and the row shows 'retry', and both survive a preserveStorage reload with belts.won still empty — the debit persists, the loss never half-records a win." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { beltReady, CURRICULUM } from "./personas"

/**
 * READY → LOST → ATTEMPT SURVIVES RELOAD — the burned-attempt half of the unlock economy.
 *
 * A belt-READY player (all white units checkpointed, no belt won) starts the white belt test
 * and LOSES it by a rigged catch + defense-window expiry. The debit must be REAL and DURABLE:
 * attempts counts exactly 1 (live + in the stored blob), the path row flips ready→retry in the
 * same life, and ALL of it survives a preserveStorage reload — while belts.won stays EMPTY on
 * both sides of the reload (a loss must never half-record a win) and blue stays locked.
 *
 * Mechanism under test (source-verified at authoring, probe green twice — 1.2m/1.1m, zero
 * selector or rig iteration needed):
 *   - endRound's belt-branch loss arm (neural/src/app.src.jsx:3796-3800): increments
 *     belts.attempts[beltId], fires belt_test_lost {attempts} BEFORE the generic roll_end,
 *     then calls _flushSave() — the blob is already flushed synchronously at assert time.
 *   - _progressBlob() (:1114) serializes this.belts wholesale (attempts included);
 *     _loadProgress() (:1104) restores it via Object.assign of p.belts — the reload seam.
 *   - Path row state (:2521-2522): won ? "won" : !ready ? "locked" : attempts ? "retry" :
 *     "ready" — so ready→retry is a pure function of the persisted attempts counter.
 *
 * Novel vs core-016 (the only other attempts-burning spec): core-016 checks in-session
 * retry/attempts on the POINTS-EXPIRY branch only. The reload durability + won-stays-empty +
 * blue-still-locked postimage is unpinned by the existing corpus.
 *
 * Determinism: land() rigs the intro roll's ambients; the belt-test roll seeder's ambient
 * draws (ai-skill/role/max-moves) are re-rigged before the row click — the authored budget/
 * role override them, but rigging keeps zero Math.random. The loss recipe is verbatim from
 * the green core (stakes-impact.spec.ts w1-23), looped ≤4 moves to tolerate the counter
 * branch (probe: caught on move 1 in both runs from the authored Mount/Bottom test start).
 * No escape rig, no escape pick — the defense clock expires → tapped → endRound("lose").
 *
 * Author gotchas honored: outcome string is "lose" (not "loss"); attempts live under
 * belts.attempts (NOT top-level); the retry row's "attempt 2" label is TEXT — asserted only
 * via data-test-state + counters; the lost beat is read via beats.filter(...).pop(), and
 * indexOf ordering vs roll_end is safe (single roll_end in this journey).
 */

const WHITE = CURRICULUM.belts[0]
const BLUE = CURRICULUM.belts[1]

test("belt-ready loss burns exactly one durable attempt: retry row + attempts:1 + empty belts.won all survive a preserveStorage reload", async ({ page }) => {
  test.skip(!BLUE, "curriculum has no second (blue) belt — the blue-still-locked postimage is gone")

  const j = journey(page)

  // ── Boot 1: belt-READY persona — every white unit checkpointed, nothing won ──
  await j.boot("/", { initialState: beltReady() })
  await j.land("Mount Top")

  const base = await page.evaluate((whiteId) => {
    const a = (window as any).__neural
    return {
      wonKeys: Object.keys((a.belts || {}).won || {}),
      attempts: ((a.belts || {}).attempts || {})[whiteId as string] || 0,
    }
  }, WHITE.id)
  expect(base.wonKeys, "persona premise: no belt won at boot").toEqual([])
  expect(base.attempts, "persona premise: zero attempts burned at boot").toBe(0)

  // ── The row reads READY, then start the test (starting it closes the explorer) ──
  await page.evaluate(() => (window as any).__neural.toggleExplorer())
  const row = page.locator(`[data-belt-test="${WHITE.id}"]`).first()
  await expect(row, "white belt-test row rendered").toBeVisible()
  expect(await row.getAttribute("data-test-state"), "row reads ready before the test").toBe("ready")

  // belt-test roll seeder ambients (authored budget/role override them; rigging keeps zero Math.random)
  await j.rig("ai-skill", [0.5])
  await j.rig("role", [0])
  await j.rig("max-moves", [0.5])
  await row.click()
  await j.advanceUntil("belt_test_start", 20000)
  await j.nextHand(30000)

  // ── LOSE the test (w1-23 recipe): fail a transition, opponent hunts the finish, get
  //    caught, let the defense window EXPIRE (no escape rig, no escape pick) → tapped.
  //    Looped ≤4 moves purely for the counter-branch tolerance (probe: caught on move 1). ──
  let caught = false
  for (let m = 0; m < 4 && !caught; m++) {
    const t = await page.evaluate(() => {
      const a = (window as any).__neural
      for (const k of a.optionIdxs || []) if (a.nodes[k].ty === "transitions") return a.nodes[k].t
      return null
    })
    expect(t, `move ${m + 1}: a transition option to fail`).toBeTruthy()
    await j.rig("resolve", [0.99])
    await j.rig("outcome", [0.99])
    await j.rig("opp-finish", [0.01])
    await j.rig("opp-sub-pick", [0.01])
    await j.pick(t as string)
    try {
      await j.advanceUntil("defend_start", 25000)
      caught = true
    } catch {
      // counter branch: no catch this move — re-fail from the next hand (if not already live)
      const live = await page.evaluate(() => (((window as any).__neural || {}).optionIdxs || []).length > 0)
      if (!live) await j.nextHand(30000)
    }
  }
  expect(caught, "opponent caught a submission within 4 failed moves").toBe(true)
  await j.advanceUntil("belt_test_lost", 30000) // defense clock expires → tapped
  await j.advanceUntil("roll_end", 20000)

  // ── The loss resolved as a LOSS, verdict-first, and never half-recorded a win ──
  expect(await j.lastOutcome(), "the expired defense is a lose outcome").toBe("lose")
  const beats = await j.beats()
  const names = beats.map((b: any) => b.beat)
  const lost = (beats as any[]).filter((b) => b.beat === "belt_test_lost").pop()
  expect(lost, "belt_test_lost beat emitted").toBeTruthy()
  expect(lost.belt, "the lost test is the white belt's").toBe(WHITE.id)
  expect(lost.attempts, "the lost beat carries attempts:1 — first burn").toBe(1)
  expect(names.indexOf("belt_test_lost"), "verdict precedes the generic roll_end").toBeLessThan(names.indexOf("roll_end"))
  expect(names.filter((b: string) => b === "belt_test_won").length, "zero belt_test_won beats").toBe(0)

  // ── The debit is LIVE and already FLUSHED (endRound's loss arm called _flushSave) ──
  const sameLife = await page.evaluate((whiteId) => {
    const a = (window as any).__neural
    const blob = JSON.parse(localStorage.getItem("bjj-neural-progress") || "null")
    return {
      liveAttempts: ((a.belts || {}).attempts || {})[whiteId as string] || 0,
      liveWonKeys: Object.keys((a.belts || {}).won || {}),
      storedAttempts: (((blob || {}).belts || {}).attempts || {})[whiteId as string] || 0,
      storedWonKeys: Object.keys(((blob || {}).belts || {}).won || {}),
    }
  }, WHITE.id)
  expect(sameLife.liveAttempts, "live belts.attempts[white] === 1 after the loss").toBe(1)
  expect(sameLife.liveWonKeys, "live belts.won still empty — no half-recorded win").toEqual([])
  expect(sameLife.storedAttempts, "stored blob already carries attempts:1 (synchronous flush)").toBe(1)
  expect(sameLife.storedWonKeys, "stored blob's belts.won still empty").toEqual([])

  // ── Same life: the row flipped ready→retry (starting the test closed the panel — re-open) ──
  await page.evaluate(() => (window as any).__neural.toggleExplorer())
  await expect(row, "belt-test row rendered after the loss").toBeVisible()
  expect(await row.getAttribute("data-test-state"), "row flips to retry in the same life").toBe("retry")

  // ── Boot 2 (preserveStorage): the burned attempt is DURABLE economy ──
  await j.boot("/", { preserveStorage: true })
  await j.land("Mount Top")
  await page.evaluate(() => (window as any).__neural.toggleExplorer())
  await expect(row, "belt-test row rendered after reload").toBeVisible()
  expect(await row.getAttribute("data-test-state"), "row still reads retry after reload").toBe("retry")

  const post = await page.evaluate((whiteId) => {
    const a = (window as any).__neural
    return {
      attempts: ((a.belts || {}).attempts || {})[whiteId as string] || 0,
      wonKeys: Object.keys((a.belts || {}).won || {}),
    }
  }, WHITE.id)
  expect(post.attempts, "belts.attempts[white] still exactly 1 after reload — debited once, not re-burned, not refunded").toBe(1)
  expect(post.wonKeys, "belts.won still empty after reload — the loss never minted a belt").toEqual([])
  expect(
    await page.locator(`[data-belt="${BLUE.id}"]`).first().getAttribute("data-locked"),
    "blue still locked after the lost test",
  ).toBe("1")
})
