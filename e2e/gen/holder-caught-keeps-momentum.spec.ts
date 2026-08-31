/* @hyperspace {"theme":"momentum-and-economy","L":"white-belt-holder","F":"defense-panic","B":"guard-limit"} @invariant "Dice never break the streak: a rigged catch (impact_fail → caught) and the subsequent rigged escape both leave _combo at its earned value with zero combo_break beats — only wrong and ignored break momentum." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { whiteBeltHolder } from "./personas"

/**
 * DICE NEVER BREAK THE STREAK — momentum (v1.70.0) is a knowledge meter, not a luck meter.
 * Source guarantee (neural/src/app.src.jsx): _combo is written ONLY by _comboUp (:4334),
 * _breakCombo (:4349 — reasons "wrong" and "ignored", both player choices) and the three
 * per-MATCH resets (:3330 stageRollAt, :4697 startRoll, :4738 rollFromPosition). Nothing in
 * enterFailCal / opponentDefend / enterDefense / the escape path touches it. So the worst
 * the dice can do — our move fails, the opponent hunts and CATCHES a submission, we have to
 * panic-drill and escape — must leave _combo at exactly the value the player EARNED by
 * answering landing questions, with zero combo_break beats across the whole ordeal.
 *
 * The one player-side trap this spec must dodge is the trap it exists to document: an
 * UNANSWERED landing question makes the next pick an "ignored" break (:4912). So the
 * journey answers the landing question BEFORE every pick, through the real keyboard
 * surface (A/B/C → truth in this._mc, never a DOM attribute), gated on _landPending —
 * the live-unanswered signal (:4285 set, :4303 cleared) — because _mc itself is NOT nulled
 * after an answer (the closure's `answered` flag is the only guard there).
 *
 * Determinism census: land() rigs ai-skill/role/max-moves; the landing MC draws on its own
 * land-mc-pick/land-mc-shuffle tags (surface-scoped RNG — reading _mc.correct consumes
 * nothing). Per hand: resolve 0.99 > the 0.95 moveChance ceiling (always fail);
 * outcome [0.99, 0.99] (fail draw + the counter-branch drawOutcome share the tag);
 * opp-finish 0.01 < the 0.18 pFinish floor (opponent always hunts the finish when adjacent
 * subs exist); opp-sub-pick/opp-pick 0.01 pin which. rig() APPENDS, so re-queueing the
 * identical values on a counter-branch retry is safe. escape 0.01 < the 0.08 escapeChance
 * floor (the escape always lands — note escapeChance itself carries momentumMod, :4421).
 * Probe: caught landed on hand 1 from Mount Top every run; the retry arm is contingency.
 * Red-proof: answering the first question WRONG gave combo 0 — failed at "combo earned at
 * ×1" (Expected 1, Received 0).
 */

test("rigged catch → panic drill → rigged escape: _combo stays at its earned value, zero combo_break", async ({ page }) => {
  const j = journey(page)
  await j.boot("/", { initialState: whiteBeltHolder() })
  await j.land("Mount Top")

  // ── answer the live landing question like a user: keyboard A/B/C. Gated on
  // _landPending (unanswered-question-on-the-table), because _mc lingers after an answer. ──
  const answerLanding = async (): Promise<boolean> => {
    const mc = await page.evaluate(() => {
      const a = (window as any).__neural
      const m = a._mc
      return a._landPending && m && m.surface === "land" && typeof m.correct === "number"
        ? { correct: m.correct }
        : null
    })
    if (!mc) return false // a proven deck asks nothing — silence carries the streak
    await page.keyboard.press("abcd"[mc.correct])
    const pending = await page.evaluate(() => !!(window as any).__neural._landPending)
    expect(pending, "answer registered — nothing left on the table for the pick to ignore").toBe(false)
    return true
  }

  let earned = 0
  if (await answerLanding()) earned++
  expect(earned, "Mount Top asked a landing question and it was answered").toBe(1)
  const s0 = await page.evaluate(() => (window as any).__neural._combo || 0)
  expect(s0, "combo earned at ×1 by the correct answer").toBe(earned)

  // ── get CAUGHT deterministically: our move always fails, the opponent always finishes.
  // Retry arm covers the counter branch (fail can land us elsewhere with a fresh hand):
  // answer the NEW landing question first, re-queue the identical rig, pick again. ──
  let caught = false
  for (let hand = 0; hand < 3 && !caught; hand++) {
    if (hand > 0 && (await answerLanding())) earned++
    await j.rig("resolve", [0.99])
    await j.rig("outcome", [0.99, 0.99])
    await j.rig("opp-finish", [0.01])
    await j.rig("opp-sub-pick", [0.01])
    await j.rig("opp-pick", [0.01])
    // first TRANSITION option — a submission pick would resolve on a different arc
    const firstTransition = await page.evaluate(() => {
      const a = (window as any).__neural
      for (const o of a.optionIdxs || []) {
        const idx = typeof o === "number" ? o : o.idx
        if (a.nodes[idx] && a.nodes[idx].ty === "transitions") return a.nodes[idx].t
      }
      return null
    })
    expect(firstTransition, "a transition option in the tray").toBeTruthy()
    const dealt0 = (await j.beats()).filter((b: any) => b.beat === "options_dealt").length
    await j.pick(firstTransition as string)
    // pump until the catch OR a fresh hand (counter branch). The defense tray sets
    // optionIdxs directly without an options_dealt beat, so "caught" and "new hand"
    // are cleanly distinguishable in the beat stream.
    let spent = 0
    while (spent < 25000) {
      await j.advance(400)
      spent += 400
      const bs = await j.beats()
      if (bs.some((b: any) => b.beat === "caught")) {
        caught = true
        break
      }
      const dealt = bs.filter((b: any) => b.beat === "options_dealt").length
      const n = await page.evaluate(() => (((window as any).__neural || {}).optionIdxs || []).length)
      if (dealt > dealt0 && n > 0) break // counter branch: fresh hand, go around
    }
  }
  expect(caught, "the rigged catch landed within 3 hands").toBe(true)

  // ── MID-ARC CHECKPOINT: the failure spine fired, and none of it touched the streak ──
  const bs1 = await j.beats()
  const spine = bs1.map((b: any) => b.beat)
  const iFail = spine.indexOf("impact_fail")
  const iCaught = spine.indexOf("caught")
  const iPanic = spine.indexOf("panic_drill_opened")
  expect(iFail, "our rigged move failed").toBeGreaterThanOrEqual(0)
  expect(iCaught, "opponent caught a submission after the failure").toBeGreaterThan(iFail)
  expect(iPanic, "panic drill opened on the catch").toBeGreaterThan(iCaught)
  expect(
    spine.filter((b) => b === "combo_break").length,
    "zero combo_break mid-arc — failed dice and the catch never touched the streak",
  ).toBe(0)
  expect(
    (bs1 as any[]).filter((b) => b.beat === "land_q_answered" && b.correct === true).length,
    "the app's own answer ledger agrees with the tracked earned count",
  ).toBe(earned)
  const mid = await page.evaluate(() => (window as any).__neural._combo || 0)
  expect(mid, "combo still at its earned value while caught").toBe(earned)

  // ── panic grade through the real UI: defense study credit must not disturb the streak ──
  await expect(page.locator("[data-panic]"), "inline panic drill visible while caught").toBeVisible()
  await page.locator("[data-panic-reveal]").click()
  await page.locator("[data-panic-got]").click()
  await j.expectBeat("escape_odds_pumped")

  // ── the rigged escape resolves the tension (0.01 < the 0.08 escapeChance floor) ──
  await j.rig("escape", [0.01])
  await page.evaluate(() => (window as any).__neural.pickFirstEscape())
  await j.advanceUntil("escape", 16000)
  await j.advanceUntil("relief", 4000)

  // ── POST-ESCAPE CHECKPOINT: the whole ordeal — fail, catch, panic drill, escape —
  // and the streak sits exactly where the player's answers put it ──
  const bs2 = (await j.beats()).map((b: any) => b.beat)
  expect(bs2.filter((b) => b === "combo_break").length, "zero combo_break post-escape").toBe(0)
  expect(
    bs2.filter((b) => b === "roll_end").length,
    "same match throughout — no per-match reset could have re-zeroed the meter",
  ).toBe(0)
  const post = await page.evaluate(() => (window as any).__neural._combo || 0)
  expect(post, "combo survived the catch → panic → escape arc at its earned value").toBe(earned)
})
