/* @hyperspace {"theme":"momentum-and-economy","L":"curriculum-mid","F":"decision-timer","B":"economy-math"} @invariant "The landing answer and the in-sheet JIT drill share ONE question window and neither door buys time: a correct landing answer SPENDS the window (decisionRemaining 0, combo x1), the option sheet then finds no open question to decline (zero land_q_declined), and JIT grades after it refund nothing (zero timer_refund, the window stays disarmed)." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { curriculumMid } from "./personas"

/**
 * ONE WINDOW, TWO DOORS, NO TIME — the cross-surface economy claim, under the v1.133.0 law.
 *
 * INVERTED (gen-triage, v1.206.x) — the owner reversed this spec's claim on purpose. It pinned
 * that the landing answer's refundDecision(2500) and the JIT drill's refunds drew ONE 2-per-window
 * budget (granted [true,true,false] across the two doors). v1.133.0 (e6f655a6a) retired
 * refundDecision/timer_refund: "answering IS what the window was for" (owner: "Pressure should
 * not be on the choices … You get penalized if you don't click the right answer or click 'Show'
 * in time"), and v1.134.0 (f12f8f74c) made opening a move's sheet DECLINE an open question. What survives —
 * and what this spec now pins — is that the two doors still share ONE window:
 *   - door 1, the landing answer (`_landAnswered`): a correct MC answer disarms the window
 *     (spent, well) and credits momentum (combo ×1) — no +2.5s;
 *   - door 2, the option sheet (`expandOption` → `_declineLandQ("sheet")`): it declines only an
 *     OPEN question, so after door 1 it finds nothing to decline — zero land_q_declined, and the
 *     combo the answer earned survives;
 *   - the JIT drill inside the sheet grades into odds, never time: decisionRemaining() stays 0
 *     across two grades and no timer_refund beat exists. (The JIT door alone is jit-loop.spec.ts's
 *     "drilling pumps odds and buys NO time"; the DISCRIMINATING observation here is the
 *     cross-surface one — the sheet sees the window door 1 already closed.)
 *
 * Persona: curriculumMid — prep/rec but stage:{} EMPTY, so questionFor finds an unproven card and
 * the Mount|Top landing asks (MC). j.land() engages, so the question's clock arms at its mount.
 *
 * Determinism (house rails): the landing MC block draws on the LAND-scoped RNG tags
 * ("land-mc-pick"/"land-mc-shuffle") — rigged with pre-sized queues BEFORE land(); the sidebar
 * "mc-*" queues are never touched. The answer is read from the truth rail __neural._mc
 * ({correct, surface:"land"}) and clicked by STRUCTURE ([data-land-mc-opt="<correct>"]) — never
 * by option text. The sheet is opened but never committed — no resolve/outcome draws exist.
 *
 * Red-proof: `_landAnswered` no longer disarming the window fails "the correct answer SPENDS the
 * window" (gen-triage mutant).
 */

test("a correct landing answer spends the one window; the sheet finds nothing to decline; JIT grades buy no time", async ({ page }) => {
  const j = journey(page)
  await j.boot("/", { initialState: curriculumMid() })

  // Land-scoped MC rig BEFORE land(): pre-sized queues cover distractor pool picks (authored
  // tiers may consume zero) + the option shuffle, for the land-card render.
  await j.rig("land-mc-pick", [
    0.07, 0.19, 0.31, 0.43, 0.55, 0.67, 0.79, 0.91, 0.11, 0.23, 0.37, 0.47,
    0.59, 0.71, 0.83, 0.13, 0.29, 0.41, 0.53, 0.61, 0.73, 0.87, 0.17, 0.33,
  ])
  await j.rig("land-mc-shuffle", [0.2, 0.5, 0.8, 0.35, 0.65, 0.95])
  await j.land("Mount Top")

  // ── the mid-curriculum landing asks: blob ingested, question live, its window fresh ──
  const boot = await page.evaluate(() => {
    const a = (window as any).__neural
    const d = a._decision
    return {
      prepDecks: Object.keys(a.prep || {}).length, // curriculumMid seeded graded decks
      hasDecision: !!d,
      total: d ? d.total : null,
      remaining: d ? d.remaining : null,
      base: a.get("decisionSec", 9) * 1000 * (a._returningVisitor() ? 1 : 1.5),
    }
  })
  expect(boot.prepDecks, "persona ingested: curriculumMid's graded decks are present").toBeGreaterThan(0)
  expect(boot.hasDecision, "a live decision window is armed on the hand").toBe(true)
  expect(boot.total, "the question's window is armed at the full authored length").toBe(boot.base)
  expect(boot.remaining, "and it is running — fresh, nothing spent yet").toBeGreaterThan(0)
  await expect(page.locator("[data-landcard]"), "landing card docked above the hand").toBeVisible()
  await expect(page.locator("[data-land-q]"), "stage:{} empty → an unproven card asks").toBeVisible()

  const remaining = () => page.evaluate(() => (window as any).__neural.decisionRemaining())

  // ── DOOR 1: the landing answer (truth rail → structural click, never text) ──
  const mc = await page.evaluate(() => {
    const m = (window as any).__neural._mc
    return m ? { correct: m.correct, surface: m.surface } : null
  })
  expect(mc?.surface, "the live MC block is the landing surface").toBe("land")
  const r0 = await remaining()
  expect(r0, "the window is running before the answer").toBeGreaterThan(0)
  await page.locator(`[data-land-mc-opt="${mc!.correct}"]`).click()
  const r1 = await remaining()
  // v1.133.0: no +2.5s — answering is what the window was for, so a right answer spends it
  expect(r1, "the correct landing answer SPENDS the window — no refund, no time left").toBe(0)

  const answered = (await j.beats()).filter((b: any) => b.beat === "land_q_answered")
  expect(answered.length, "exactly one landing answer recorded").toBe(1)
  expect((answered[0] as any).correct, "and it was correct").toBe(true)
  expect(await page.evaluate(() => (window as any).__neural._combo || 0), "the right answer paid in momentum (combo ×1)").toBe(1)

  // ── DOOR 2: the option sheet — it declines only an OPEN question, and door 1 closed it ──
  const options = await j.optionTitles()
  await page.locator(`[data-tech="${options[0]}"]`).first().locator("[data-choice-inspect]").click()
  await expect(page.locator("[data-jit]"), "in-sheet JIT micro-drill visible").toBeVisible()
  expect(
    (await j.beats()).filter((b: any) => b.beat === "land_q_declined").length,
    "the sheet found no open question — the ONE window was already spent by the answer",
  ).toBe(0)

  // ── JIT grades: odds, never time — the shared window stays disarmed ──
  await j.jitGrade()
  const r2 = await remaining()
  expect(r2, "the first JIT grade buys no time").toBe(0)
  await j.jitGrade()
  const r3 = await remaining()
  expect(r3, "nor does the second — there is no budget to draw on").toBe(0)

  // ── the shared ledger: one window, spent once, zero refunds across both doors ──
  const end = await page.evaluate(() => {
    const a = (window as any).__neural
    const d = a._decision
    const beats = a.beats || []
    return {
      windowLeft: d ? d.remaining : "no-decision",
      refunds: beats.filter((b: any) => b.beat === "timer_refund").length,
      declined: beats.filter((b: any) => b.beat === "land_q_declined").length,
      combo: a._combo || 0,
    }
  })
  expect(end.windowLeft, "the SAME window is still disarmed after both doors").toBeNull()
  expect(end.refunds, "zero timer_refund beats — neither door refunds (the beat is retired)").toBe(0)
  expect(end.declined, "still zero declines — an answered question is never re-declined").toBe(0)
  expect(end.combo, "the answer's momentum survived the sheet and the drill").toBe(1)
})
