/* @hyperspace {"theme":"momentum-and-economy","L":"white-belt-holder","F":"decision-timer","B":"economy-math"} @invariant "Question clocks are per decision WINDOW, not per roll: after the attack window's question clock has been SPENT (expired, the -4% miss paid), getting caught opens a brand-new defense window whose drill clock arms in full (total = the whole decisionSec window, nothing carried over); and answering the drill right pays in escape odds (escape_odds_pumped) and spends that window — it buys no time (zero timer_refund)." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { whiteBeltHolder } from "./personas"

/**
 * THE CLOCK IS PER WINDOW, NOT PER ROLL.
 *
 * RETARGETED (gen-triage, v1.206.x). This spec pinned the per-window REFUND budget: three JIT
 * grades in the attack window read timer_refund granted [true,true,false], then the caught
 * defense window's panic refund was granted again (+2.0s). v1.133.0 (e6f655a6a) retired
 * refundDecision/timer_refund outright ("answering IS what the window was for"; owner: "Pressure
 * should not be on the choices") — there is no budget left to exhaust. What survives is the
 * claim's SHAPE: each window is its own object with its own clock, so exhausting window 1 cannot
 * deplete window 2. Today that rides the question clock:
 *   1. ATTACK WINDOW, SPENT. The landing deal builds `_decision {remaining:null,…}`; the landing
 *      question's mount arms it (`_armLandClock`; j.land() engages). Freezing runs it to zero:
 *      `_expireLandQ` reveals the miss (land_q_expired, _qMod −0.04) and disarms it — the
 *      worst case a window can end in, the successor of "budget exhausted".
 *   2. CAUGHT → NEW WINDOW. enterDefense builds a BRAND-NEW `_decision` (escapes as its opts) and
 *      `armDrill()` arms the panic drill's clock on it at the FULL decisionSec — the spent attack
 *      window contributes nothing. Proven by object identity against a test-side reference to
 *      the attack window, by its opts (the escapes) and by total === the authored window.
 *   3. THE DRILL PAYS IN ODDS, NOT TIME (inverted from "the composure refund is granted +2s"):
 *      a right drill answer fires escape_odds_pumped and `done()` disarms the window — spent well.
 *      decisionRemaining() reads 0 after it; no timer_refund beat exists anywhere in the roll.
 *
 * Mutants (gen-triage): the drill never arms → red at "armed IN FULL"; a right drill answer adds
 * +2s instead of spending the window → red at "SPENDS the defense window". EQUIVALENT, not a
 * gap: making enterDefense REUSE the previous `_decision` object (Object.assign onto it) changes
 * nothing observable, because the attack commit's own `pick` closure already nulls `_decision` —
 * the commit discards the attack window before the catch, so there is nothing to carry over.
 *
 * Determinism census: land() rigs ai-skill/role/max-moves; the expiry path draws nothing; before
 * the commit: resolve [0.99] (above the moveChance clamp — the attack always fails), outcome
 * [0.99], opp-finish [0.01] (below the 0.18 pFinish floor — the opponent goes for the kill),
 * opp-sub-pick [0.01]. The commit is a runtime-chosen TRANSITIONS option (a submission pick would
 * ENTER its state since v1.176.0). The panic MC's own panic-mc-* draws are not rigged: the answer
 * index is READ from the `_mc` truth closure, never guessed (recall fallback handled too).
 */

test("attack window spent by expiry → caught opens a NEW defense window armed in full; the drill's right answer pays odds and buys no time", async ({ page }) => {
  const j = journey(page)
  await j.boot("/", { initialState: whiteBeltHolder() })
  await j.land("Mount Top")
  await j.expectBeat("options_dealt")

  // ── ATTACK WINDOW: the landing question is up and its clock armed ──
  const attack = await page.evaluate(() => {
    const a = (window as any).__neural
    const d = a._decision
    ;(window as any).__bAttackWin = d // a TEST-side reference — identity is the claim below
    return {
      asks: !!(a._mc && a._mc.surface === "land"),
      total: d ? d.total : null,
      remaining: d ? d.remaining : null,
      base: a.get("decisionSec", 9) * 1000 * (a._returningVisitor() ? 1 : 1.5),
    }
  })
  expect(attack.asks, "the attack window's landing question is on the table").toBe(true)
  expect(attack.total, "the attack window is armed at the full authored window").toBe(attack.base)
  expect(attack.remaining, "and it is running").toBeGreaterThan(0)

  // ── SPEND IT: freeze until the question clock runs out ──
  await j.advanceUntil("land_q_expired", 20000)
  const spent = await page.evaluate(() => {
    const a = (window as any).__neural
    const d = a._decision
    return {
      same: d === (window as any).__bAttackWin,
      remaining: d ? d.remaining : "no-decision",
      left: a.decisionRemaining(),
      qMod: a._qMod || 0,
      expired: (a.beats || []).filter((b: any) => b.beat === "land_q_expired").length,
    }
  })
  expect(spent.same, "still the attack window (the hand stays live after an expiry)").toBe(true)
  expect(spent.remaining, "the attack window's clock is SPENT — disarmed by its expiry").toBeNull()
  expect(spent.left, "no time left in the attack window").toBe(0)
  expect(spent.qMod, "the miss was paid in full (−4%)").toBe(-0.04)
  expect(spent.expired, "exactly one expiry so far — the attack window's").toBe(1)

  // ── get CAUGHT deterministically — rig BEFORE the commit ──
  const tech = await page.evaluate(() => {
    const a = (window as any).__neural
    for (const o of a.optionIdxs || []) {
      const n = a.nodes[typeof o === "number" ? o : o.idx]
      if (n && n.ty === "transitions") return n.t
    }
    return ""
  })
  expect(tech, "a transitions-type option exists in the hand").not.toBe("")
  await j.rig("resolve", [0.99])
  await j.rig("outcome", [0.99])
  await j.rig("opp-finish", [0.01])
  await j.rig("opp-sub-pick", [0.01])
  await j.pick(tech)
  await j.advanceUntil("caught", 20000)

  // ── SAME ROLL, NEW WINDOW: a fresh object, the escapes as its hand, its drill clock FULL ──
  await expect(page.locator("[data-panic]"), "inline panic drill visible when caught").toBeVisible()
  const defense = await page.evaluate(() => {
    const a = (window as any).__neural
    const d = a._decision
    return {
      fresh: !!d && d !== (window as any).__bAttackWin,
      optsAreHand: !!d && Array.isArray(d.opts) && d.opts.length === (a.optionIdxs || []).length && d.pick === a._optPick,
      total: d ? d.total : null,
      remaining: d ? d.remaining : null,
      panicExpired: (a.beats || []).filter((b: any) => b.beat === "land_q_expired" && b.surface === "panic").length,
    }
  })
  expect(defense.fresh, "enterDefense built a BRAND-NEW decision window — not the spent attack one").toBe(true)
  expect(defense.optsAreHand, "the new window carries the defense hand (the escapes) and its pick").toBe(true)
  expect(defense.total, "the defense drill's clock armed IN FULL — nothing carried over from the spent window").toBe(attack.base)
  expect(defense.remaining, "and it is live, not inherited-expired").toBeGreaterThan(0)
  expect(defense.panicExpired, "the defense window did not inherit the attack window's expiry").toBe(0)

  // ── the drill's RIGHT answer: pays in escape odds, spends the window, buys NO time ──
  const pumped0 = (await j.beats()).filter((b: any) => b.beat === "escape_odds_pumped").length
  const mcCorrect = await page.evaluate(() => {
    const a = (window as any).__neural
    const card = document.querySelector("[data-panic]")
    return card && card.querySelector("[data-panic-mc-opt]") && a._mc && a._mc.surface === "panic" ? a._mc.correct : null
  })
  if (mcCorrect != null) {
    await page.locator(`[data-panic-mc-opt="${mcCorrect}"]`).click()
  } else {
    await page.locator("[data-panic-reveal]").click()
    await page.locator("[data-panic-got]").click()
  }
  const graded = await page.evaluate(() => {
    const a = (window as any).__neural
    const beats = a.beats || []
    return {
      left: a.decisionRemaining(),
      pumped: beats.filter((b: any) => b.beat === "escape_odds_pumped").length,
      refunds: beats.filter((b: any) => b.beat === "timer_refund").length,
      expired: beats.filter((b: any) => b.beat === "land_q_expired").length,
    }
  })
  expect(graded.pumped, "the right drill answer pays in escape odds").toBe(pumped0 + 1)
  expect(graded.left, "and SPENDS the defense window — answering buys no time (v1.133.0)").toBe(0)
  expect(graded.refunds, "zero timer_refund beats across both windows — the refund is retired").toBe(0)
  expect(graded.expired, "still exactly one expiry in the roll — each window ended on its own terms").toBe(1)
})
