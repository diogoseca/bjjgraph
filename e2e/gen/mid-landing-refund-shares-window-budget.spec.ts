/* @hyperspace {"theme":"momentum-and-economy","L":"curriculum-mid","F":"decision-timer","B":"economy-math"} @invariant "The landing answer's refundDecision(2500) and JIT-drill refunds draw the SAME 2-per-window budget: a correct landing answer consumes refund #1, the first JIT grade gets refund #2, and the second JIT grade is denied — timer_refund beats carry granted [true,true,false] across the two surfaces." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { curriculumMid } from "./personas"

/**
 * MID-LANDING REFUND SHARES THE WINDOW BUDGET — the cross-surface economy claim.
 *
 * jit-loop.spec.ts proves the JIT drill alone is capped at 2 refunds per window. This spec
 * proves the cap is a SINGLE budget shared with the landing question, not a per-surface
 * allowance: refundDecision (app.src.jsx :4875-4881) closes over the live _decision window
 * and gates on `d.refunds < 2`, emitting fx("timer_refund",{granted}) on EVERY call. The
 * landing answer's refund goes through _landAnswered (:4305, refundDecision(2500) on correct);
 * the sheet's JIT "Got it" goes through the drill block (:1630, refundDecision(2500)) — same
 * object, one budget, two doors. The DISCRIMINATING observation is the JIT drill getting only
 * ONE grant after a correct landing answer: separate per-surface budgets would have given it two.
 *
 * Persona: curriculumMid — a mid-curriculum player whose blob has prep/rec but stage:{} EMPTY,
 * so questionFor(key) (:4189, first card with cardStage < 2) finds an unproven card and the
 * Mount|Top landing asks. land() dismisses the guided coach and finishCoach (:4606) hands over
 * to renderLandCard, so [data-landcard]/[data-land-q] are live right after land().
 *
 * Determinism (house rails): the landing MC block draws on the LAND-scoped RNG tags
 * ("land-mc-pick"/"land-mc-shuffle" via mcDistractors' tag param, :3526) — rigged with
 * pre-sized queues BEFORE land(); the sidebar "mc-*" queues are never touched. The answer is
 * read from the truth rail __neural._mc ({correct, surface:"land"}) and clicked by STRUCTURE
 * ([data-land-mc-opt="<correct>"]) — never by option text (MC waves rewrite it). Test mode
 * freezes the decision clock (no advance() between reads), so every decisionRemaining() delta
 * is a pure refund. The sheet is opened but never committed (no [data-go]) — no resolve/outcome
 * draws exist to rig.
 */

test("a correct landing answer consumes refund #1, the JIT drill gets #2 then is denied — one shared 2-per-window budget", async ({ page }) => {
  const j = journey(page)
  await j.boot("/", { initialState: curriculumMid() })

  // Land-scoped MC rig BEFORE land(): pre-sized queues cover distractor pool picks (authored
  // tiers may consume zero) + the option shuffle, for the post-coach land-card render.
  await j.rig("land-mc-pick", [
    0.07, 0.19, 0.31, 0.43, 0.55, 0.67, 0.79, 0.91, 0.11, 0.23, 0.37, 0.47,
    0.59, 0.71, 0.83, 0.13, 0.29, 0.41, 0.53, 0.61, 0.73, 0.87, 0.17, 0.33,
  ])
  await j.rig("land-mc-shuffle", [0.2, 0.5, 0.8, 0.35, 0.65, 0.95])
  await j.land("Mount Top")

  // ── the mid-curriculum landing asks: blob ingested, question live, window fresh ──
  const boot = await page.evaluate(() => {
    const a = (window as any).__neural
    const d = a._decision
    return {
      prepDecks: Object.keys(a.prep || {}).length, // curriculumMid seeded graded decks
      hasDecision: !!d,
      refunds: d ? d.refunds : -1,
    }
  })
  expect(boot.prepDecks, "persona ingested: curriculumMid's graded decks are present").toBeGreaterThan(0)
  expect(boot.hasDecision, "a live decision window is armed on the hand").toBe(true)
  expect(boot.refunds, "no refund consumed yet on a fresh window").toBe(0)
  await expect(page.locator("[data-landcard]"), "landing card docked above the hand").toBeVisible()
  await expect(page.locator("[data-land-q]"), "stage:{} empty → an unproven card asks").toBeVisible()

  const remaining = () => page.evaluate(() => (window as any).__neural.decisionRemaining())

  // ── REFUND #1: the landing answer (truth rail → structural click, never text) ──
  const mc = await page.evaluate(() => {
    const m = (window as any).__neural._mc
    return m ? { correct: m.correct, surface: m.surface } : null
  })
  expect(mc?.surface, "the live MC block is the landing surface").toBe("land")
  const r0 = await remaining()
  await page.locator(`[data-land-mc-opt="${mc!.correct}"]`).click()
  const r1 = await remaining()
  // refundDecision(2500): a pure +2.5s (frozen clock — no drain between reads)
  expect(r1 - r0, "the correct landing answer is granted refund #1 (+2.5s)").toBeGreaterThanOrEqual(2)

  const answered = (await j.beats()).filter((b: any) => b.beat === "land_q_answered")
  expect(answered.length, "exactly one landing answer recorded").toBe(1)
  expect((answered[0] as any).correct, "and it was correct — the refunding path").toBe(true)

  // ── REFUND #2: first JIT grade in the expand sheet (sheet only — never [data-go]) ──
  const options = await j.optionTitles()
  await page.locator(`[data-tech="${options[0]}"]`).first().click()
  await expect(page.locator("[data-jit]"), "in-sheet JIT micro-drill visible").toBeVisible()

  await page.locator("[data-jit-reveal]").click()
  await page.locator("[data-jit-got]").click()
  const r2 = await remaining()
  expect(r2 - r1, "the first JIT grade still fits the budget — refund #2 granted").toBeGreaterThanOrEqual(2)

  // ── DENIED: the second JIT grade — separate per-surface budgets would have granted it ──
  await page.locator("[data-jit-reveal]").click()
  await page.locator("[data-jit-got]").click()
  const r3 = await remaining()
  expect(r3 - r2, "the second JIT grade is denied — the landing answer already ate slot #1").toBeLessThan(1)

  // ── the shared ledger: one window saturated at 2, three calls, granted [true,true,false] ──
  const used = await page.evaluate(() => {
    const d = (window as any).__neural._decision
    return d ? d.refunds : -1
  })
  expect(used, "the SAME window's budget saturated at 2 across both surfaces").toBe(2)

  const refunds = (await j.beats()).filter((b: any) => b.beat === "timer_refund")
  expect(refunds.length, "every refundDecision call left a beat — three across two doors").toBe(3)
  expect(
    refunds.map((r: any) => r.granted),
    "landing grant, JIT grant, JIT denial — one budget, in that order",
  ).toEqual([true, true, false])
})
