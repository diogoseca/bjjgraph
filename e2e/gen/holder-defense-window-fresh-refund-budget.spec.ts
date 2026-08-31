/* @hyperspace {"theme":"momentum-and-economy","L":"white-belt-holder","F":"decision-timer","B":"economy-math"} @invariant "Refund budgets are per decision WINDOW, not per roll: after exhausting both refunds in the attack window, getting caught opens a fresh defense window whose panic-card composure refund (refundDecision(2000)) is granted (timer_refund granted:true, remaining +~2s)." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { whiteBeltHolder } from "./personas"

/**
 * REFUND BUDGET IS PER WINDOW, NOT PER ROLL — the "cap 2" on drill refunds lives on the
 * _decision OBJECT, and each window builds a fresh one. Three seams (neural/src/app.src.jsx):
 *
 *   1. ATTACK WINDOW. Options-deal builds _decision {refunds:0, no onExpire} (:4866).
 *      refundDecision (:4875) grants iff d.refunds < 2 — grade 3 JIT cards in the expand
 *      sheet (each grade calls refundDecision(2500), :1630) and the timer_refund beats read
 *      granted [true, true, false]: the budget is EXHAUSTED, d.refunds pinned at 2.
 *   2. CAUGHT → NEW WINDOW. enterDefense builds a BRAND-NEW _decision {refunds:0,
 *      onExpire: finish} (:5197) — same roll, fresh object, fresh budget. onExpire
 *      falsy→truthy across the catch proves it is a different window, not a reset field.
 *   3. DEFENSE REFUND GRANTED. The panic card's Got-it (:4483) calls refundDecision(2000):
 *      the 4th timer_refund of the roll is granted:true, d.refunds 0→1, and
 *      decisionRemaining() grows by exactly +2.0s — the COMPOSURE refund (2000ms), provably
 *      not the JIT refund (2500ms), so the delta is asserted inside [1.5, 2.5).
 *
 * Determinism census: land() rigs ai-skill/role/max-moves; resolve [0.99] (> the 0.95
 * moveChance clamp — immune to the JIT odds pumps, the attack always fails), outcome [0.99],
 * opp-finish [0.01] (< the 0.18 pFinish floor — opponent goes for the kill), opp-sub-pick
 * [0.01] — all rigged BEFORE [data-go]. The landing-card MC draw is ambient fallback and
 * stays unasserted/unanswered (mc-* queues untouched) — which is exactly why "exactly 4
 * timer_refund beats" holds: a landing answer would mint a 5th. decisionRemaining() reads
 * the LIVE window only, and no sim time is pumped between the before/after reads, so the
 * +2.0s delta is clean.
 */

test("attack window exhausts both refunds (t,t,f) → caught opens a fresh defense window whose panic refund is granted (+~2s, refunds 0→1)", async ({ page }) => {
  const j = journey(page)
  await j.boot("/", { initialState: whiteBeltHolder() })
  await j.land("Mount Top")
  await j.expectBeat("options_dealt")

  // ── open the expand sheet WITHOUT executing: card click only (pick() would auto-Go) ──
  const options = await j.optionTitles()
  expect(options.length, "a live hand was dealt").toBeGreaterThanOrEqual(1)
  await page.locator(`[data-tech="${options[0]}"]`).first().click()
  await expect(page.locator("[data-jit]"), "in-sheet JIT micro-drill visible").toBeVisible()

  // ── EXHAUST the attack window's budget: 3 grades; the block re-renders after each,
  //    same selectors. refundDecision grants iff d.refunds < 2 → [true, true, false]. ──
  for (let i = 0; i < 3; i++) {
    await j.jitGrade()
  }
  const attackGrants = (await j.beats()).filter((b: any) => b.beat === "timer_refund").map((b: any) => b.granted)
  expect(attackGrants, "3 JIT grades: two granted, third refused — budget exhausted").toEqual([true, true, false])

  const attackWin = await page.evaluate(() => {
    const d = (window as any).__neural._decision
    return { refunds: d ? d.refunds : -1, hasOnExpire: !!(d && d.onExpire) }
  })
  expect(attackWin.refunds, "attack window pinned at the cap (refunds counter stays 2)").toBe(2)
  expect(attackWin.hasOnExpire, "attack-window shape: no onExpire (expiry auto-picks, never taps)").toBe(false)

  // ── get CAUGHT deterministically — rig BEFORE Go, same census as the panic-grade spec ──
  await j.rig("resolve", [0.99])
  await j.rig("outcome", [0.99])
  await j.rig("opp-finish", [0.01])
  await j.rig("opp-sub-pick", [0.01])
  await page.locator("[data-go]").first().click()
  await j.advanceUntil("caught", 20000)

  // ── SAME ROLL, FRESH WINDOW: enterDefense built a brand-new _decision with a clean budget ──
  await expect(page.locator("[data-panic]"), "inline panic drill visible when caught").toBeVisible()
  const defenseWin = await page.evaluate(() => {
    const d = (window as any).__neural._decision
    return { refunds: d ? d.refunds : -1, hasOnExpire: !!(d && d.onExpire) }
  })
  expect(defenseWin.refunds, "defense window boots with a FRESH refund budget (0 of 2 used)").toBe(0)
  expect(defenseWin.hasOnExpire, "defense-window shape: onExpire truthy (expiry = tapped) — a genuinely new window").toBe(true)

  // ── the 4th refund of the roll is GRANTED: panic Got-it → refundDecision(2000). No sim
  //    time pumped between these reads (clock is gdt-driven), so the delta is exact. ──
  const before = await page.evaluate(() => (window as any).__neural.decisionRemaining())
  await page.locator("[data-panic-reveal]").click()
  await page.locator("[data-panic-got]").click()
  const after = await page.evaluate(() => (window as any).__neural.decisionRemaining())

  expect(after - before, "composure refund credited ~+2s to the live defense clock").toBeGreaterThanOrEqual(1.5)
  expect(after - before, "the +2.0s COMPOSURE refund (2000ms), not the 2.5s JIT refund").toBeLessThan(2.5)

  const grants = (await j.beats()).filter((b: any) => b.beat === "timer_refund").map((b: any) => b.granted)
  expect(grants, "exactly 4 timer_refund beats; the defense window's first is granted:true").toEqual([true, true, false, true])

  const spent = await page.evaluate(() => (window as any).__neural._decision.refunds)
  expect(spent, "the defense budget is now 1 of 2 used — a real, spendable, per-window budget").toBe(1)
})
