// v1.230.0: the owner dropped practise-before-you-try on 2026-10-15 (question 6).
/* @hyperspace {"theme":"momentum-and-economy","L":"curriculum-mid","F":"decision-timer","B":"economy-math"} @invariant "The landing answer, the video viewer and sidebar study share one question window: a correct answer spends it (decisionRemaining 0, combo x1), the viewer finds no open question to decline, and study grades refund no time or momentum." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { curriculumMid } from "./personas"

/** One question window: a correct landing answer spends it, the video viewer finds
 * nothing to decline, and subsequent sidebar grades buy odds but no time or combo.
 * The owner's 2026-10-15 decision retires JIT; all surviving clock/credit assertions
 * now use the video viewer plus the existing study pane. Its entry is fixture setup; grading
 * uses real Reveal / Got it inputs. Historical filename retained for ledger identity.
 * Land RNG tags are rigged before arrival; no move is committed.
 * Existing red proof: removing _landAnswered's disarm fails the spent-window assertion.
 */

test("a correct landing answer spends the one window; the viewer finds nothing to decline; study grades buy no time", async ({ page }) => {
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
  await page.keyboard.press("abc"[mc!.correct])
  const r1 = await remaining()
  // v1.133.0: no +2.5s — answering is what the window was for, so a right answer spends it
  expect(r1, "the correct landing answer SPENDS the window — no refund, no time left").toBe(0)

  const answered = (await j.beats()).filter((b: any) => b.beat === "land_q_answered")
  expect(answered.length, "exactly one landing answer recorded").toBe(1)
  expect((answered[0] as any).correct, "and it was correct").toBe(true)
  expect(await page.evaluate(() => (window as any).__neural._combo || 0), "the right answer paid in momentum (combo ×1)").toBe(1)

  // The video viewer declines only an OPEN question; the landing answer already closed it.
  const options = await j.optionTitles()
  await j.watchChoice(options[0])
  await j.studyChoice(options[0])
  expect(
    (await j.beats()).filter((b: any) => b.beat === "land_q_declined").length,
    "the viewer found no open question — the ONE window was already spent by the answer",
  ).toBe(0)

  // ── Study grades: odds, never time — the shared window stays disarmed ──
  await j.studyGrade()
  const r2 = await remaining()
  expect(r2, "the first study grade buys no time").toBe(0)
  await j.studyGrade()
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
  expect(end.combo, "the answer's momentum survived study").toBe(1)
})
