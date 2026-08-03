/* @hyperspace {"theme":"unlock-economy","L":"belt-ready","F":"defense-panic","B":"cross-feature"} @invariant "Getting caught during a belt test is survivable: a rigged catch opens the panic drill inside the live test and a rigged escape returns to the test with _beltTest intact (same beltId), zero belt_test_lost beats, and zero attempts burned — only a finished tap loses the test, not the catch itself." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { beltReady, CURRICULUM } from "./personas"

/**
 * CAUGHT MID-BELT-TEST != LOSING THE BELT TEST — the defense-panic drill runs INSIDE a live
 * boss battle and the whole catch→drill→escape arc leaves the test running.
 *
 * Cross-feature seam (source-verified in neural/src/app.src.jsx at authoring):
 *   - startBeltTest sets _beltTest BEFORE rollFromPosition (:2558-2566), and clearEngagement
 *     (:184, run inside every roll/hand reset) deliberately leaves _beltTest alone — so the
 *     catch's engagement churn cannot drop the test.
 *   - The ONLY writers of belt_test_won/belt_test_lost/attempts live inside endRound
 *     (:3789-3800), and endRound is the ONLY emitter of roll_end (:3817). The escape path
 *     (:4599-4608) never calls endRound: rng("escape") < chance → fx("escape") → killVignette
 *     → fx("relief") → after(0.7, enterLand(false)). Ergo a survived catch must leave ZERO
 *     belt_test_lost / belt_test_won / roll_end beats and attempts untouched — only a
 *     FINISHED tap (defense expiry / failed escape → finish()) reaches endRound("lose").
 *   - Move budget headroom: _beltTest.maxMoves (authored, 14 default :2564) vs ≤4 catch
 *     moves + the escape's moveCount++ — the cap's endRound("reset") is unreachable here.
 *
 * Rig discipline (probe-validated 3/3 green): rig() APPENDS (:113), so every loop iteration
 * queues IDENTICAL values and stale leftovers cannot drift behavior. Per catch attempt:
 *   resolve[.99]        → player's move fails
 *   outcome[.99,.99]    → TWO values: the fail's drawOutcome + the counter branch's
 *                         drawOutcome shares the "outcome" tag (:4655 branch)
 *   opp-finish[.01]     → opponent hunts the finish WHEN an adjacent sub is in the strict
 *                         white pool (:4643); otherwise the counter branch fires instead
 *   opp-sub-pick[.01]   → deterministic subs[0] on the finish branch
 *   opp-pick[.01]       → deterministic counter pick when no adjacent sub exists
 * The strict belt pool means some hands offer NO legal finish → loop ≤4 transition moves,
 * advanceUntil("caught").catch → nextHand and try again (probe: caught within budget every run).
 *
 * Distinct from the accepted corpus:
 *   - core-021 (guidance-defense: defense drama) — the SAME panic mechanics but a fresh
 *     visitor on a NORMAL roll; no belt test exists, so it can't say the test survives.
 *   - core-013 (belt-test: engagement survival) — a DELIBERATE resetRoll cancel nulls
 *     _beltTest cleanly; this spec is the opposite polarity: an in-fight catastrophe that
 *     must NOT null the test, burn an attempt, or emit any loss/end beat.
 * Novel cell: F=defense-panic × a live belt-test engagement (B=cross-feature) at L=belt-ready.
 *
 * Structure-only assertions: beats, data-attributes, curriculum IDs (CURRICULUM.belts[0].id),
 * counts — never card/answer/technique text.
 */

const WHITE = CURRICULUM.belts[0]

test("belt-ready: caught mid-test opens the panic drill, escape resumes the SAME live test — no loss beat, no attempt burned, next hand deals", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/", { initialState: beltReady() })
  await j.land("Mount Top")

  // ── Start the belt test from its READY capstone button (v1.74 UI; persona premise asserted
  //    first). The roll seeder re-draws ai-skill/role/max-moves inside rollFromPosition, so
  //    re-rig them BEFORE the click (land() only covered the intro roll's draws). ──
  await page.evaluate(() => (window as any).__neural.toggleExplorer())
  const capBtn = page.locator(`[data-capstone="${WHITE.id}"] button`).first()
  expect(await capBtn.isDisabled(), "beltReady persona: white capstone is OFFERED").toBe(false)
  expect(await capBtn.textContent(), "beltReady persona: button reads Start capstone").toBe("Start capstone")
  await j.rig("ai-skill", [0.5])
  await j.rig("role", [0])
  await j.rig("max-moves", [0.5])
  await capBtn.click()
  await j.advanceUntil("belt_test_start", 20000)

  const t0 = await page.evaluate((beltId: string) => {
    const a = (window as any).__neural
    return {
      beltId: a._beltTest?.beltId ?? null,
      attempts: a.belts?.attempts?.[beltId] ?? 0,
    }
  }, WHITE.id)
  expect(t0.beltId, "the live test carries the curriculum's white belt id").toBe(WHITE.id)
  expect(t0.attempts, "no attempt burned by merely starting").toBe(0)
  await j.nextHand(30000)

  // ── CATCH LOOP (≤4 moves): fail a transition into the opponent's turn until the strict
  //    white pool offers an adjacent finish and the catch lands. ──
  let caught = false
  for (let m = 0; m < 4 && !caught; m++) {
    await j.rig("resolve", [0.99])
    await j.rig("outcome", [0.99, 0.99]) // fail draw + possible counter-branch drawOutcome
    await j.rig("opp-finish", [0.01])
    await j.rig("opp-sub-pick", [0.01])
    await j.rig("opp-pick", [0.01]) // counter branch only (no adjacent sub in pool)
    const t = await page.evaluate(() => {
      const a = (window as any).__neural
      for (const k of a.optionIdxs || []) {
        const o = typeof k === "number" ? k : k.idx
        const n = a.nodes[o]
        if (n && n.ty === "transitions") return n.t
      }
      return null
    })
    expect(t, `hand ${m + 1}: a transition option exists to fail into the opponent's turn`).toBeTruthy()
    await j.pick(t as string)
    try {
      await j.advanceUntil("caught", 25000)
      caught = true
    } catch {
      await j.nextHand(30000) // counter branch fired (strict pool, no adjacent sub) — play on
    }
  }
  expect(caught, "the opponent caught us within the 4-move budget").toBe(true)

  // ── CAUGHT INSIDE THE LIVE TEST: full panic beat trio + visible drill + test untouched. ──
  const midBeats = (await j.beats()).map((b: any) => b.beat)
  expect(midBeats, "the failed move impacted").toContain("impact_fail")
  expect(midBeats, "the catch registered").toContain("caught")
  expect(midBeats, "the panic drill opened inside the test").toContain("panic_drill_opened")
  await expect(page.locator("[data-panic]"), "inline panic micro-card visible while caught").toBeVisible()
  expect(
    await page.evaluate(() => (window as any).__neural._beltTest?.beltId ?? null),
    "the catch itself never clears the running test",
  ).toBe(WHITE.id)

  // ── Grade the defender card (real UI buttons) → escape odds pump. ──
  await page.locator("[data-panic-reveal]").click()
  await page.locator("[data-panic-got]").click()
  await j.expectBeat("escape_odds_pumped")

  // ── ESCAPE (rigged success): tension snaps off, the roll continues. ──
  await j.rig("escape", [0.01])
  await page.evaluate(() => (window as any).__neural.pickFirstEscape())
  await j.advanceUntil("escape", 16000)
  await j.advanceUntil("relief", 4000)

  // ── THE INVARIANT: the belt test SURVIVED the whole catch→escape arc. ──
  const post = await page.evaluate((beltId: string) => {
    const a = (window as any).__neural
    return {
      vignette: !!a._vignetteEl,
      beltId: a._beltTest?.beltId ?? null,
      attempts: a.belts?.attempts?.[beltId] ?? 0,
    }
  }, WHITE.id)
  expect(post.vignette, "heartbeat vignette cleared by the escape").toBe(false)
  expect(post.beltId, "_beltTest intact with the SAME beltId after the escape").toBe(WHITE.id)
  expect(post.attempts, "zero attempts burned by a survived catch").toBe(0)

  const beats = (await j.beats()).map((b: any) => b.beat)
  expect(beats, "no loss recorded — the catch is not a defeat").not.toContain("belt_test_lost")
  expect(beats, "no phantom win either").not.toContain("belt_test_won")
  expect(beats, "endRound never ran: zero roll_end across the entire arc").not.toContain("roll_end")

  // ── LIVENESS: the test deals the next hand — still in the fight, still the same test. ──
  await j.nextHand(30000)
  const live = await page.evaluate(() => {
    const a = (window as any).__neural
    return { options: (a.optionIdxs || []).length, beltId: a._beltTest?.beltId ?? null }
  })
  expect(live.options, "a live hand of options after the escape").toBeGreaterThan(0)
  expect(live.beltId, "the same belt test is still running on the next hand").toBe(WHITE.id)
})
