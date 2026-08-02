/* @hyperspace {"theme":"onboarding","L":"first-roll-day1","F":"decision-timer","B":"keyboard-timing"} @invariant "A day-1 player's first decision window behaves as designed once the coach is gone: the clock is live (drains under advance), a single JIT grade refunds >=2s of decisionRemaining with a timer_refund granted:true beat, and letting it run to zero still narrates expiry_warning then auto_pick." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { firstRollDay1 } from "./personas"

/**
 * DAY-1 FIRST-DECISION WINDOW, POST-COACH — the firstRollDay1 analogue of jit-loop.spec.ts's
 * refund + expiry beats fused with returner-decision-timer-expiry's narration order, with the
 * day-1-persona-under-coach hand-off as the fresh coverage. Three claims, one window:
 *
 *   1. LIVE CLOCK. The coach freezes the decision clock (_tickDecision early-returns while
 *      this._coach is set, :4317). land() dismisses the coach AFTER dealing options, so once
 *      _optPick is set and _coach is null the clock drains: decisionRemaining() (:4306, seconds)
 *      falls by ~2s under advance(2000). (Probe: 16.2s → 14.2s on a 10-option Mount Top window.)
 *   2. JIT REFUND. Opening a move's expand sheet mounts the in-sheet micro-drill ([data-jit],
 *      :1570). One reveal ([data-jit-reveal]) → Got-it ([data-jit-got], :1587) calls
 *      refundDecision(2500) (:4308): decisionRemaining += 2.5s AND fx("timer_refund",{granted})
 *      with granted = (d.refunds < 2) (:4310) — the FIRST grade is always granted:true.
 *   3. RUN TO ZERO. Escape closes the sheet via closeOptionDetail() (:1796) which leaves _optPick
 *      and _decision intact — the clock keeps ticking. Draining past zero fires
 *      fx("expiry_warning",{seconds}) once per second at secLeft<=3 (:4324) THEN fx("auto_pick",{})
 *      at remaining<=0 (:4333), whose weighted pool selects via this.rng("auto-pick") (:4335) and
 *      pick()s → enterAttempt → fx("commit") (:4342) — a narrated advance, never a silent teleport.
 *
 * Persona validity: firstRollDay1 seeds prep (a day-1 card graded) but NOT
 * localStorage["bjj-neural-coached"], so the rigStart rail's enterLand(true) → maybeStartCoach()
 * DOES fire the coach; land() then dismisses it. Post-land a._coach===null, a._coachDone===true —
 * exactly the "coach auto-dismissed" hand-off the invariant is about. A boot read proves prep
 * ingested + the coach actually ran-then-cleared, so this isn't a plain fresh boot masquerading
 * as the day-1 case.
 *
 * Determinism (house rails): j.rig("auto-pick",[0]) BEFORE landing pins the weighted-pool select
 * (unrigged it falls through to the ungated Math.random PRNG — a rails violation). land() rigs the
 * intro ambient draws (ai-skill/role/max-moves); resolve/outcome are rigged for the post-auto_pick
 * attempt so the advance is deterministic. Beats are asserted on ORDER (indexOf) and on the beat's
 * own {granted}/{seconds} props — never on card/answer TEXT (MC waves rewrite it).
 */

test("day-1 post-coach: clock drains, one JIT grade refunds >=2s (granted:true), run-to-zero narrates expiry_warning→auto_pick", async ({ page }) => {
  const j = journey(page)
  await j.boot("/", { initialState: firstRollDay1() })
  // Pin the auto-pick target BEFORE the window can expire (weighted pool reads this.rng("auto-pick")).
  await j.rig("auto-pick", [0])
  // "Mount Top" (space, matches node.t): land() rigs the intro draws, deals options, THEN dismisses
  // the coach the rigStart rail fired — so post-land the clock is live and the hand is real.
  await j.land("Mount Top")
  await j.expectBeat("land")
  await j.expectBeat("options_dealt")

  const remaining = () => page.evaluate(() => (window as any).__neural.decisionRemaining())

  // ── persona ingested + the coach ran-then-cleared, and a live un-drained window is armed ──
  const boot = await page.evaluate(() => {
    const a = (window as any).__neural
    const d = a._decision
    return {
      prepDecks: Object.keys(a.prep || {}).length,
      coach: a._coach, // null after dismissal
      coachDone: !!a._coachDone,
      hasDecision: !!d,
      total: d ? d.total : 0,
      remaining: d ? d.remaining : 0,
      refunds: d ? d.refunds : -1,
      opts: (a.optionIdxs || []).length,
    }
  })
  expect(boot.prepDecks, "persona ingested: firstRollDay1 seeded a graded day-1 deck").toBeGreaterThan(0)
  expect(boot.coach, "the guided coach was auto-dismissed after the hand was dealt").toBeNull()
  expect(boot.coachDone, "coach marked done — the day-1 hand-off completed").toBe(true)
  expect(boot.opts, "the first hand actually dealt options").toBeGreaterThanOrEqual(1)
  expect(boot.hasDecision, "a live decision window is armed on the first hand").toBe(true)
  // total = decisionSec(9)*1000 + (opts-1)*800 → >= 9000ms; frozen-coach clock never ticked during
  // land, so remaining == total the instant it goes live, and no refund has been granted yet.
  expect(boot.total, "decision window is the full authored budget (>=9s)").toBeGreaterThanOrEqual(9000)
  expect(boot.remaining, "clock un-drained at hand-off (coach froze it through land)").toBe(boot.total)
  expect(boot.refunds, "no refund granted yet on a fresh window").toBe(0)

  // ── CLAIM 1: the clock is LIVE — draining sim time drops decisionRemaining ~2s (coach gone). ──
  const live0 = await remaining()
  await j.advance(2000)
  const live1 = await remaining()
  expect(live1, "the decision clock drains once the coach is gone (was frozen under coaching)").toBeLessThan(
    live0 - 1.5,
  )

  // ── CLAIM 2: open the expand sheet, drill ONE card, and the grade refunds >=2s + a granted beat. ──
  const options = await j.optionTitles()
  await page.locator(`[data-tech="${options[0]}"]`).first().click()
  await expect(page.locator("[data-jit]"), "in-sheet JIT micro-drill visible").toBeVisible()

  const r0 = await remaining()
  await page.locator("[data-jit-reveal]").click()
  await page.locator("[data-jit-got]").click()
  const r1 = await remaining()
  // refundDecision(2500): +2.5s on the first (granted) grade. >=2 absorbs the ceil/rounding of the
  // seconds read; it must be a clear INCREASE past whatever the sheet-open drained.
  expect(r1 - r0, "one JIT grade refunds >=2s of the decision window (+2.5s, first is granted)").toBeGreaterThanOrEqual(2)

  const refunds = (await j.beats()).filter((b: any) => b.beat === "timer_refund")
  expect(refunds.length, "exactly one timer_refund beat for the single grade").toBe(1)
  expect(refunds[0].granted, "the first grade's refund is granted:true (d.refunds<2)").toBe(true)

  // ── CLAIM 3: close the sheet (clock survives) and let it RUN TO ZERO — narration, not a teleport. ──
  // Escape → closeOptionDetail() clears _detailCtx only; _optPick & _decision survive so the clock
  // keeps ticking. Rig the post-auto_pick attempt for a deterministic advance.
  await j.rig("resolve", [0.99])
  await j.rig("outcome", [0.5])
  await page.keyboard.press("Escape")
  // advance() sub-ticks at 16.6ms so per-second 3-2-1 warnings register; cap 20000ms is well above
  // Mount Top's window (~16s here); advanceUntil stops the instant auto_pick fires.
  await j.advanceUntil("auto_pick", 20000, 500)

  const beats = await j.beats()
  const seq = beats.map((b: any) => b.beat)
  const iWarn = seq.indexOf("expiry_warning")
  const iAuto = seq.indexOf("auto_pick")
  const iCommit = seq.indexOf("commit")
  expect(iWarn, "a 3-2-1 expiry_warning was narrated before the timeout").toBeGreaterThanOrEqual(0)
  expect(iAuto, "the timeout fired an auto_pick (never a silent teleport)").toBeGreaterThanOrEqual(0)
  expect(iWarn, "expiry_warning PRECEDES auto_pick — the day-1 player was warned before the pick").toBeLessThan(iAuto)
  expect(iCommit, "commit PRESENT — the auto-pick advanced the position (no silent freeze)").toBeGreaterThanOrEqual(0)
  expect(iAuto, "auto_pick precedes the commit it drives").toBeLessThan(iCommit)

  // warnings fire at secLeft in {1,2,3} — structural, off the beat's own prop, not any label text.
  const warnSeconds = beats.filter((b: any) => b.beat === "expiry_warning").map((b: any) => b.seconds)
  expect(warnSeconds.length, "at least one countdown warning was emitted").toBeGreaterThanOrEqual(1)
  for (const s of warnSeconds) expect([1, 2, 3], "each warning counts down within the last 3 seconds").toContain(s)
})
