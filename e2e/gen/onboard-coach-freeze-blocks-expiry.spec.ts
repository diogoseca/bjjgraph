/* @hyperspace {"theme":"onboarding","L":"fresh-visitor","F":"intro-roll-coach","B":"keyboard-timing"} @invariant "While the coach is up the decision clock is fully frozen so no matter how much sim time is pumped neither expiry_warning nor auto_pick can fire; only after coach_done does pumping to zero produce the narrated expiry pair." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { freshVisitor } from "./personas"

/**
 * GUIDED-FIRST-ROLL COACH FREEZES THE DECISION CLOCK — a fresh visitor lands on their first-ever
 * hand while the onboarding coach is up. The coach is a HARD freeze on the decision timer: a single
 * enormous sim-time pump (30000ms, ~3x the window) drains the clock by EXACTLY 0ms and fires ZERO
 * expiry_warning / ZERO auto_pick. Only after the coach is dismissed (coach_done) does draining the
 * window to zero produce the narrated expiry pair, IN ORDER: expiry_warning → auto_pick.
 *
 * This is the strong form of the freeze law. The soft precedent
 * (guidance-defense.spec.ts "guided first roll ... clock frozen until dismissed") asserts a ~3000ms
 * drift under the coach; THIS spec pumps 30000ms in ONE advance() and asserts exactly-zero expiry
 * events — the frozen-coach clock does not merely drift slowly, it does not tick at all.
 *
 * Mechanism under test (source-verified, neural/src/app.src.jsx):
 *   - _tickDecision (:4315-4317): `const d = this._decision; if (!d || !this._optPick || this._coach) return;`
 *     — the coach guard is BEFORE `d.remaining -= gdt*1000` (:4318). While this._coach is truthy the
 *     remaining never decrements, so neither expiry_warning (:4326) nor auto_pick (:4333) can fire no
 *     matter how much sim time advance() pumps (advance → _tick → _tickDecision every 16.6ms tick, :4763).
 *   - The landing window is armed at :4301 as `{ remaining: dsec*1000, total: dsec*1000, ... }` with
 *     dsec = get("decisionSec",9) + (opts-1)*0.8 (:4289-4290) → total >= 9000ms (Mount Top ~11-12s).
 *     It has NO onExpire (that field is defense-window-only, :4617), so at remaining<=0 it takes the
 *     auto_pick branch (:4333), never the defense "tapped" branch (:4330).
 *   - dismissCoach() → finishCoach() (:4050, 4055-4060) sets _coach=null; _coachDone=true and fires
 *     coach_done. From then the clock ticks: expiry_warning once/sec at secLeft in {1,2,3} (:4323-4326),
 *     auto_pick at remaining<=0 (:4329-4338).
 *
 * Determinism (house rails): the auto_pick weighted-pool select reads this.rng("auto-pick") (:4335);
 * UNRIGGED it falls through to the ungated Math.random PRNG (a no-Math.random rail violation).
 * j.rig("auto-pick",[0]) pins the target and keeps the expiry path deterministic. land() already rigs
 * the intro ambient draws (ai-skill/role/max-moves); no other RNG site is on this path.
 *
 * Non-vacuity: a control probe (default land("Mount Top"), which auto-dismisses the coach) + the SAME
 * single advance(30000) DOES drain the ~11s clock and fires expiry_warning → auto_pick. So the
 * zero-count assertions below bite because of the FREEZE, not because 30000ms was too small a pump —
 * proven internally here by the post-dismissal half of the same test (same 30000ms cap fires both).
 */

test("coach freezes the decision clock: 30s pump drains 0ms + fires no expiry; only coach_done unfreezes it", async ({ page }) => {
  const j = journey(page)
  // fresh visitor: boot wipes storage → bjj-neural-coached absent → the coach fires on landing.
  // freshVisitor() returns undefined; the plain wiped boot IS the fresh path (do not pass it on).
  await j.boot("/")
  // Pin the auto_pick target BEFORE anything can expire — the weighted-pool select reads
  // this.rng("auto-pick"); unrigged it violates the house no-Math.random rail.
  await j.rig("auto-pick", [0])
  // keepCoach: land() deals options + arms the clock but does NOT dismiss the coach, so the clock
  // stays frozen at `total` the whole time (land pumps up to 12x1000ms until optionIdxs populates).
  await j.land("Mount Top", { keepCoach: true })
  await j.expectBeat("options_dealt")
  await j.expectBeat("coach_1")

  // ── the coach is up and the clock is armed at its full, un-drained budget ──
  const boot = await page.evaluate(() => {
    const a = (window as any).__neural
    const d = a._decision
    return {
      coach: !!a._coach,
      hasDecision: !!d,
      total: d ? d.total : 0,
      remainingMs: d ? d.remaining : 0,
      remainingSec: a.decisionRemaining(),
      opts: (a.optionIdxs || []).length,
    }
  })
  expect(boot.coach, "the onboarding coach is up while we hold the first hand").toBe(true)
  expect(boot.opts, "the first hand actually dealt options").toBeGreaterThanOrEqual(1)
  expect(boot.hasDecision, "a decision window is armed under the coach").toBe(true)
  // total = decisionSec(9)*1000 + (opts-1)*800 → >= 9000ms for any hand (Mount Top ~11-12s)
  expect(boot.total, "decision window is the full authored budget (>=9s)").toBeGreaterThanOrEqual(9000)
  // un-drained at hand-off: the frozen-coach clock never ticked during land()
  expect(boot.remainingMs, "clock un-drained under the coach: remaining == total").toBe(boot.total)
  expect(boot.remainingSec * 1000, "decisionRemaining() (sec) mirrors the raw total").toBeCloseTo(boot.total, -2)

  const beatsBeforePump = (await j.beats()).map((b: any) => b.beat)
  expect(beatsBeforePump, "no expiry_warning has fired under the coach yet").not.toContain("expiry_warning")
  expect(beatsBeforePump, "no auto_pick has fired under the coach yet").not.toContain("auto_pick")

  // ── FREEZE: pump 30000ms in ONE advance() — ~3x the window — while the coach is up ──
  await j.advance(30000)

  const frozen = await page.evaluate(() => {
    const a = (window as any).__neural
    const d = a._decision
    return {
      coach: !!a._coach,
      total: d ? d.total : 0,
      remainingMs: d ? d.remaining : 0,
      remainingSec: a.decisionRemaining(),
    }
  })
  const frozenBeats = (await j.beats()).map((b: any) => b.beat)
  // the clock drained EXACTLY 0ms across a 30000ms pump — the freeze is total, not a slow drift
  expect(frozen.coach, "coach still up after the 30s pump").toBe(true)
  expect(frozen.remainingMs, "remaining unchanged after a 30000ms pump — clock drained exactly 0ms").toBe(boot.total)
  expect(frozen.remainingSec * 1000, "decisionRemaining() still pinned at total after the pump").toBeCloseTo(frozen.total, -2)
  // and ZERO expiry narration fired — the whole point of the strong claim
  expect(frozenBeats.filter((b) => b === "expiry_warning").length, "ZERO expiry_warning under the coach across 30s").toBe(0)
  expect(frozenBeats.filter((b) => b === "auto_pick").length, "ZERO auto_pick under the coach across 30s").toBe(0)

  // ── UNFREEZE: dismiss the coach (coach_done), then drain the window to zero ──
  await page.evaluate(() => (window as any).__neural.dismissCoach())
  await j.expectBeat("coach_done")
  // advanceUntil(beat, capMs, stepMs): capMs is the 2nd positional arg, NOT an options object.
  // Chunked steps so the per-second 3-2-1 warnings register at fine granularity; 30000ms cap is
  // well above Mount Top's ~11-12s window (and is the SAME budget that stayed frozen above).
  await j.advanceUntil("auto_pick", 30000, 500)

  // ── the NARRATION, asserted on beat ORDER (indices), never on any label text ──
  const seq = (await j.beats()).map((b: any) => b.beat)
  const iCoachDone = seq.indexOf("coach_done")
  const iWarn = seq.indexOf("expiry_warning")
  const iAuto = seq.indexOf("auto_pick")
  expect(iCoachDone, "coach_done was emitted on dismissal").toBeGreaterThanOrEqual(0)
  expect(iWarn, "a 3-2-1 expiry_warning was narrated after unfreezing").toBeGreaterThanOrEqual(0)
  expect(iAuto, "the timeout fired an auto_pick (never a silent teleport)").toBeGreaterThanOrEqual(0)
  // the expiry pair is IN ORDER, and BOTH land strictly AFTER coach_done — proving no warning/pick
  // existed pre-dismissal (the freeze half above) and the clock only ran once the coach was gone.
  expect(iWarn, "expiry_warning fires only AFTER coach_done (nothing ticked under the coach)").toBeGreaterThan(iCoachDone)
  expect(iAuto, "auto_pick fires only AFTER coach_done").toBeGreaterThan(iCoachDone)
  expect(iWarn, "expiry_warning PRECEDES auto_pick — the user was warned before the pick").toBeLessThan(iAuto)

  // warning is fired at secLeft in {1,2,3} — structural, off the beat's own prop, not any text
  const warnSeconds = (await j.beats())
    .filter((b: any) => b.beat === "expiry_warning")
    .map((b: any) => b.seconds)
  expect(warnSeconds.length, "at least one countdown warning was emitted post-unfreeze").toBeGreaterThanOrEqual(1)
  for (const s of warnSeconds) expect([1, 2, 3], "each warning counts down within the last 3 seconds").toContain(s)
})
