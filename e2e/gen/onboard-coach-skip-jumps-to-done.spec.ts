/* @hyperspace {"theme":"onboarding","L":"fresh-visitor","F":"intro-roll-coach","B":"interruption-abort"} @invariant "Skipping the coach at step 1 (dismissCoach) jumps straight to coach_done without ever emitting coach_2 or coach_3, unfreezes the clock, and persists bjj-neural-coached='1' — an early abort still completes the onboarding contract." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { freshVisitor } from "./personas"

/**
 * ONBOARDING — COACH EARLY ABORT (SKIP AT STEP 1).
 *
 * The complement of the full guided-first-roll walk (guidance-defense.spec.ts / ledger core-022,
 * which drives advanceCoach×3 and asserts strict coach_1<2<3<done ordering). Here the fresh
 * visitor SKIPS the coach at step 1 — dismissCoach() while _coach===1 routes through finishCoach()
 * directly, NOT advanceCoach(), so coach_2/coach_3 are structurally impossible on this branch. The
 * onboarding contract must still complete: coach_done fires exactly once, the frozen decision clock
 * resumes, and bjj-neural-coached persists so the coach never re-fires.
 *
 * Source seam (neural/src/app.src.jsx):
 *   dismissCoach()  → if (this._coach) this.finishCoach()               [step-1 skip enters here]
 *   finishCoach()   → _coach=null; _coachDone=true; localStorage bjj-neural-coached="1"; fx("coach_done")
 *   _tickDecision() → early-returns while this._coach is truthy (clock frozen), ticks once _coach null.
 *
 * Persona: freshVisitor → boot with NO initialState (boot wipes storage) so the coach fires on land.
 * keepCoach:true is MANDATORY — the DSL's default land() dismisses the coach itself (which would be
 * the abort under test, but we want to drive it explicitly and sample state on both sides).
 * Structural assertions only (beat identity/counts/ordering, clock drift), never coach copy text.
 */

const POSITION = "Mount Top"

test("coach skip at step 1 jumps straight to coach_done — no coach_2/coach_3, clock unfreezes, flag persists", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))

  const j = journey(page)
  // freshVisitor() is undefined by design → boot wipes storage and passes no initialState, so the
  // guided first-roll coach fires on landing (its trigger is the absence of bjj-neural-coached).
  await j.boot("/", { initialState: freshVisitor() })
  // keepCoach: the coach must remain UP after landing so we can drive the skip ourselves.
  await j.land(POSITION, { keepCoach: true })

  // ── PRECONDITION: the coach actually fired at step 1, and ONLY step 1. ──
  await j.expectBeat("coach_1")
  const beforeSkip = (await j.beats()).map((b) => b.beat)
  expect(beforeSkip.filter((b) => b === "coach_1").length, "coach opened at step 1 exactly once").toBe(1)
  expect(beforeSkip.filter((b) => b === "coach_2").length, "no coach_2 before any advance").toBe(0)
  expect(beforeSkip.filter((b) => b === "coach_3").length, "no coach_3 before any advance").toBe(0)
  expect(beforeSkip.filter((b) => b === "coach_done").length, "coach not yet finished").toBe(0)

  // ── FREEZE SANITY: while the coach is up the decision clock is frozen (drift < 0.5s over 2s). ──
  const rFrozen0 = await page.evaluate(() => (window as any).__neural.decisionRemaining())
  await j.advance(2000)
  const rFrozen1 = await page.evaluate(() => (window as any).__neural.decisionRemaining())
  expect(Math.abs(rFrozen1 - rFrozen0), "clock frozen while the coach is up").toBeLessThan(0.5)

  // ── THE ABORT: skip the coach at step 1. dismissCoach() with _coach===1 calls finishCoach()
  // directly (not advanceCoach), so the branch can never mint coach_2/coach_3. ──
  await page.evaluate(() => (window as any).__neural.dismissCoach())

  const afterSkip = (await j.beats()).map((b) => b.beat)
  expect(afterSkip.filter((b) => b === "coach_2").length, "skip branch NEVER emits coach_2").toBe(0)
  expect(afterSkip.filter((b) => b === "coach_3").length, "skip branch NEVER emits coach_3").toBe(0)
  expect(afterSkip.filter((b) => b === "coach_done").length, "the abort still completes: coach_done fires once").toBe(1)
  // ordering: coach_done comes AFTER coach_1 (a straight jump, with nothing in between).
  expect(
    afterSkip.indexOf("coach_done"),
    "coach_done lands after coach_1 (a step-1 jump, not a walk-through)",
  ).toBeGreaterThan(afterSkip.indexOf("coach_1"))

  // ── PERSIST: the onboarding contract wrote the coached flag (guards against re-coaching). ──
  expect(
    await page.evaluate(() => localStorage.getItem("bjj-neural-coached")),
    "aborting still persists bjj-neural-coached='1'",
  ).toBe("1")

  // ── UNFREEZE: with _coach null the clock ticks again — >=1.5s drains over 2s of sim time. ──
  const rLive0 = await page.evaluate(() => (window as any).__neural.decisionRemaining())
  expect(rLive0, "a decision window is armed after the skip").toBeGreaterThan(0)
  await j.advance(2000)
  const rLive1 = await page.evaluate(() => (window as any).__neural.decisionRemaining())
  expect(rLive0 - rLive1, "clock unfrozen after the abort: ~2s drained the window").toBeGreaterThanOrEqual(1.5)

  expect(errors, "no pageerror across the land, the skip, and the resumed clock").toEqual([])
})
