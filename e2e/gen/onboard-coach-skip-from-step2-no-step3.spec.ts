/* @hyperspace {"theme":"onboarding","L":"fresh-visitor","F":"intro-roll-coach","B":"interruption-abort"} @invariant "Advancing the coach to step 2 then skipping emits coach_1,coach_2,coach_done in order with exactly zero coach_3 beats — a mid-walk skip finalizes onboarding from wherever the user stopped, never fabricating the skipped step." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { freshVisitor } from "./personas"

/**
 * ONBOARDING COACH — MID-WALK SKIP FINALIZES FROM WHERE YOU STOPPED.
 *
 * The guided first-roll coach is a 3-step walk. A user who advances partway (to step 2) then
 * skips must have onboarding FINALIZED from that point — never dragged through the step they
 * skipped. The beat stream is the contract: coach_1, coach_2, coach_done in order, with
 * EXACTLY ZERO coach_3. coach_3 is emitted ONLY by advanceCoach() stepping INTO step 3, so a
 * skip from step 2 provably never fabricates it.
 *
 * Mechanism under test (source-verified, neural/src/app.src.jsx:4034-4061):
 *   advanceCoach()  — from _coach=1: the `_coach>=3` guard is FALSE → _coach++ (=2),
 *                     fx("coach_2"), renderCoach(). No finish, so coach_3 is NOT reached.
 *   dismissCoach()  — while _coach is truthy → finishCoach().
 *   finishCoach()   — _coach=null, _coachDone=true, writes bjj-neural-coached="1",
 *                     fx("coach_done"). It does NOT walk the remaining steps → no coach_3.
 * coach_3 is emitted ONLY when advanceCoach() steps INTO step 3 (`_coach++` making it 3); a
 * skip from step 2 exits via finishCoach() and provably never emits it.
 *
 * Working recipe (probe-verified, 2/2 deterministic, ~1.9s each):
 *   - freshVisitor() → pass NO initialState; boot's storage wipe leaves bjj-neural-coached
 *     absent, which is what makes the coach fire on the first landing.
 *   - land("Mount Top", {keepCoach:true}) — keepCoach is MANDATORY; land() otherwise calls
 *     dismissCoach() and finalizes onboarding before we can drive the walk.
 *   - SELECTOR: the beat stream (j.beats()) is the STRUCTURAL contract; live coach state via
 *     __neural._coach / __neural._coachDone. advanceCoach/dismissCoach are canvas-free rail
 *     methods driven via page.evaluate; they are synchronous (no sim-time pump for the walk)
 *     and the decision clock is frozen while _coach is set, so there is no timer flake.
 *
 * Complementary (not redundant) with:
 *   - guidance-defense.spec.ts:100 — the FULL 3-beat walk (advance x3 → coach_3 → coach_done).
 *   - onboard-coach-dom-lifecycle-single-card.spec.ts — the singleton [data-coach] DOM lifecycle.
 * This spec isolates the MID-WALK-SKIP beat semantics: advance ONCE, skip, assert zero coach_3.
 */

test("mid-walk skip from step 2: coach_1,coach_2,coach_done in order, zero coach_3", async ({ page }) => {
  const j = journey(page)
  // freshVisitor: boot wipes storage → bjj-neural-coached absent → the coach fires on landing
  await j.boot("/", { initialState: freshVisitor() })
  await j.land("Mount Top", { keepCoach: true }) // keepCoach: don't let land() finalize onboarding

  const coachStep = () => page.evaluate(() => (window as any).__neural._coach ?? null)
  const coachDone = () => page.evaluate(() => (window as any).__neural._coachDone === true)

  // ── GATE: the coach started at step 1 ──
  await j.expectBeat("coach_1")
  expect(await coachStep(), "coach state machine at step 1 after land").toBe(1)

  // ── ADVANCE ONE STEP (1→2): coach_2 fires; step 3 is NOT reached ──
  await page.evaluate(() => (window as any).__neural.advanceCoach())
  {
    const mid = (await j.beats()).map((b) => b.beat)
    expect(mid, "coach_2 emitted after single advance").toContain("coach_2")
    expect(mid, "coach_3 NOT emitted while parked at step 2").not.toContain("coach_3")
  }
  expect(await coachStep(), "coach parked at step 2 (guard false, no finish)").toBe(2)

  // ── SKIP from step 2: dismissCoach() → finishCoach() finalizes from HERE ──
  await page.evaluate(() => (window as any).__neural.dismissCoach())

  const all = (await j.beats()).map((b) => b.beat)

  // (a) the skipped step is NEVER fabricated: exactly zero coach_3 beats
  expect(all.filter((b) => b === "coach_3").length, "the skipped step 3 is never fabricated").toBe(0)

  // (b) each finalization beat appears exactly once — no dupes across the advance+skip
  expect(all.filter((b) => b === "coach_1").length, "coach_1 exactly once").toBe(1)
  expect(all.filter((b) => b === "coach_2").length, "coach_2 exactly once").toBe(1)
  expect(all.filter((b) => b === "coach_done").length, "coach_done exactly once").toBe(1)

  // (c) strict order: coach_1 < coach_2 < coach_done (indexOf on the durable beat stream)
  const i1 = all.indexOf("coach_1")
  const i2 = all.indexOf("coach_2")
  const iDone = all.indexOf("coach_done")
  expect(i1, "coach_1 present").toBeGreaterThanOrEqual(0)
  expect(i2, "coach_2 after coach_1").toBeGreaterThan(i1)
  expect(iDone, "coach_done after coach_2 (finalized straight from step 2)").toBeGreaterThan(i2)

  // ── FINALIZED: onboarding is complete and latched, having skipped step 3 ──
  expect(await coachStep(), "_coach cleared to null on finalize").toBeNull()
  expect(await coachDone(), "_coachDone latched true on finalize").toBe(true)
  expect(
    await page.evaluate(() => localStorage.getItem("bjj-neural-coached")),
    "coached flag persisted so the coach never fires again",
  ).toBe("1")
})
