/* @hyperspace {"theme":"momentum-and-economy","L":"curriculum-mid","F":"decision-timer","B":"keyboard-timing"} @invariant "Timing out a pending landing question is neglect but never a wrong answer: clock expiry fires expiry_warning + auto_pick, breaks the streak with combo_break {reason:'ignored', at:1}, yet _qMod stays exactly 0 and no land_q_answered {correct:false} beat ever fires." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { curriculumMid } from "./personas"

/**
 * TIMEOUT IS NEGLECT, NEVER A WRONG ANSWER — the economy draws a hard line between the
 * three ways a landing question can end (app.src.jsx, line-verified):
 *   right   → credit (refund + combo up)                        (_landAnswered :4304-4308)
 *   wrong   → _qMod −0.04/−0.08 + combo break "wrong"           (_landAnswered :4309-4316)
 *   ignored → combo break "ignored" ONLY — no odds penalty ever (enterAttempt  :4912)
 * A player who freezes must lose their momentum (neglect breaks the streak) but must NOT
 * eat the wrong-answer odds hit: the clock expiry path (_tickDecision :4893 warning,
 * :4900 auto_pick → pick → enterAttempt) never calls _landAnswered — which is the ONLY
 * emitter of land_q_answered (:4319) and the ONLY writer of _qMod's penalty (:4311).
 *
 * Journey: a mid-curriculum player answers landing 1 by KEYBOARD (a/b/c/d answers the
 * live MC block) to earn combo ×1, advances one state, then freezes on landing 2's
 * question until the decision clock expires. The streak dies at ×1 with reason "ignored";
 * _qMod stays exactly 0; the beat stream holds exactly ONE land_q_answered (landing 1's
 * correct:true) and ZERO with correct:false.
 *
 * Persona seam: curriculumMid ships prep/rec but an EMPTY stage:{} map, so questionFor's
 * cardStage<2 gate finds an unproven card at EVERY landing — landing 2 asks reliably
 * (asserted via land_q_shown count, structure only, never question text).
 *
 * PRE-ARRIVAL READ GUARD: enterLand resets _qMod = 0 on the NEXT arrival ("a new arrival
 * forgives", :4799) — a lazy post-arrival read would show 0 even if the timeout HAD
 * charged the penalty. advanceUntil stops the pump within one 400ms step of the auto_pick
 * beat, seconds before the travel leg lands, and the final evaluate asserts the land-beat
 * count is still 2 — the _qMod===0 read provably happens BEFORE any forgiveness reset.
 *
 * Determinism census: land() rigs ai-skill/role/max-moves; the landing MC's own draws are
 * surface-scoped (land-mc-pick/land-mc-shuffle) and the answer index is READ from the _mc
 * truth closure (never guessed), so no MC queue needs pre-sizing. Leg 1: resolve 0.01
 * (< the 0.05 moveChance floor → always succeeds) + outcome 0.01 (first cell) on a
 * transitions-type option advances one state. Expiry: auto-pick 0.01 pins the weighted-
 * pool choice (unrigged it falls through to the ungated PRNG — a rails violation), and a
 * second resolve/outcome 0.01 pair keeps any pump overshoot past the commit deterministic.
 * Cap sizing: the landing window is 9s + (opts−1)·0.8s (:4866) — up to ~24s of sim time
 * for a big hand, so advanceUntil gets 45000ms (the DSL default 16s cap is TOO small).
 *
 * Red-proof (probe-verified): pressing a WRONG key at landing 2 instead of freezing fails
 * at the reason assert ("wrong" vs "ignored") — the spec discriminates wrong from ignored.
 */

test("frozen landing question: expiry narrates (warning→auto_pick), breaks ×1 momentum as 'ignored', charges zero _qMod, and never mints a wrong answer", async ({ page }) => {
  const j = journey(page)
  await j.boot("/", { initialState: curriculumMid() })
  await j.land("Mount Top")

  // ── persona ingested + landing 1 asks (empty stage map → unproven card exists) ──
  const boot = await page.evaluate(() => {
    const a = (window as any).__neural
    return { prepDecks: Object.keys(a.prep || {}).length, units: Object.keys(a.units || {}).length }
  })
  expect(boot.prepDecks, "curriculumMid ingested: drilled decks present").toBeGreaterThan(0)
  expect(boot.units, "curriculumMid ingested: unit-1 checkpoint recorded").toBeGreaterThan(0)
  await expect(page.locator("[data-land-q]"), "landing 1 asks a question").toBeVisible()
  await j.expectBeat("land_q_shown")

  // ── landing 1: answer RIGHT by keyboard — the truth lives in the _mc closure ──
  const correctIdx = await page.evaluate(() => {
    const m = (window as any).__neural._mc
    return m && m.surface === "land" && typeof m.correct === "number" ? m.correct : -1
  })
  expect(correctIdx, "live land-surface MC block with a known correct index").toBeGreaterThanOrEqual(0)
  await page.keyboard.press("abcd"[correctIdx])

  const after1 = await page.evaluate(() => {
    const a = (window as any).__neural
    return { combo: a._combo || 0, pending: !!a._landPending, qMod: a._qMod || 0 }
  })
  expect(after1.combo, "correct keyboard answer earned combo ×1").toBe(1)
  expect(after1.pending, "the question is no longer pending").toBe(false)
  expect(after1.qMod, "a right answer charges nothing").toBe(0)

  // ── advance ONE state: first transitions-type option, rigged to succeed ──
  const t = await page.evaluate(() => {
    const a = (window as any).__neural
    for (const o of a.optionIdxs || []) {
      const n = a.nodes[typeof o === "number" ? o : o.idx]
      if (n && n.ty === "transitions") return n.t
    }
    return ""
  })
  expect(t, "a transitions-type option exists in the hand").not.toBe("")
  await j.rig("resolve", [0.01])
  await j.rig("outcome", [0.01])
  await j.pick(t)
  await j.nextHand()

  // ── landing 2 asks again; arrival reset the exchange (_qMod=0, :4799); streak carried ──
  await expect(page.locator("[data-land-q]"), "landing 2 asks a question").toBeVisible()
  const at2 = await page.evaluate(() => {
    const a = (window as any).__neural
    return {
      pending: !!a._landPending,
      qMod: a._qMod || 0,
      combo: a._combo || 0,
      shown: (a.beats || []).filter((b: any) => b.beat === "land_q_shown").length,
    }
  })
  expect(at2.pending, "landing 2's question is pending — the table is set for neglect").toBe(true)
  expect(at2.qMod, "clean slate on arrival (enterLand reset)").toBe(0)
  expect(at2.combo, "the ×1 streak survived the successful move").toBe(1)
  expect(at2.shown, "two questions were asked in total — the second is real, not skipped").toBe(2)

  // ── FREEZE: rig the expiry path's draws, then pump sim time past the whole window ──
  await j.rig("auto-pick", [0.01])
  await j.rig("resolve", [0.01])
  await j.rig("outcome", [0.01])
  await j.advanceUntil("auto_pick", 45000)

  // ── beat-stream forensics + the pre-arrival state read, one evaluate ──
  const m = await page.evaluate(() => {
    const a = (window as any).__neural
    const beats = (a.beats || []).slice()
    const seq = beats.map((b: any) => b.beat)
    return {
      beats,
      iWarn: seq.indexOf("expiry_warning"),
      iAuto: seq.indexOf("auto_pick"),
      iBreak: seq.indexOf("combo_break"),
      autoCount: beats.filter((b: any) => b.beat === "auto_pick").length,
      landCount: beats.filter((b: any) => b.beat === "land").length,
      qMod: a._qMod || 0,
      combo: a._combo || 0,
      pending: !!a._landPending,
    }
  })

  // the narration: 3-2-1 warning strictly BEFORE the auto-pick, exactly one timeout
  expect(m.iWarn, "an expiry_warning was narrated").toBeGreaterThanOrEqual(0)
  expect(m.iAuto, "the clock expired into an auto_pick").toBeGreaterThanOrEqual(0)
  expect(m.iWarn, "expiry_warning precedes auto_pick").toBeLessThan(m.iAuto)
  expect(m.autoCount, "exactly one timeout fired").toBe(1)
  const warnSeconds = m.beats.filter((b: any) => b.beat === "expiry_warning").map((b: any) => b.seconds)
  for (const s of warnSeconds) expect([1, 2, 3], "each warning counts down the final 3 seconds").toContain(s)

  // THE BREAK: neglect kills the streak — exactly once, at ×1, reason "ignored", and it
  // comes FROM the expiry's commit (after auto_pick), not from anything earlier
  const breaks = m.beats.filter((b: any) => b.beat === "combo_break")
  expect(breaks.length, "exactly one combo_break in the whole journey").toBe(1)
  expect((breaks[0] as any).reason, "the break is neglect, not a wrong answer").toBe("ignored")
  expect((breaks[0] as any).at, "the streak died at ×1 — it was alive when the clock ran out").toBe(1)
  expect(m.iBreak, "the break follows the auto_pick that caused it").toBeGreaterThan(m.iAuto)
  expect(m.combo, "momentum is cold after the break").toBe(0)
  expect(m.pending, "the break consumed the pending flag").toBe(false)

  // THE ECONOMY LINE: zero odds penalty. Read is pre-arrival (land count still 2), so
  // enterLand's forgiveness reset (:4799) cannot have masked a charged penalty.
  expect(m.landCount, "no third arrival yet — the _qMod read is pre-forgiveness").toBe(2)
  expect(m.qMod, "_qMod is exactly 0 — timing out charges no odds penalty").toBe(0)

  // AND NO WRONG ANSWER EVER MINTED: _landAnswered (:4319) is the only emitter, and a
  // timeout never calls it — landing 1's correct:true stays the journey's ONLY answer beat
  const answered = m.beats.filter((b: any) => b.beat === "land_q_answered")
  expect(answered.length, "exactly one land_q_answered in the whole journey").toBe(1)
  expect((answered[0] as any).correct, "and it is landing 1's correct answer").toBe(true)
  expect(
    answered.filter((b: any) => b.correct === false).length,
    "zero land_q_answered {correct:false} — a timeout is never a wrong answer",
  ).toBe(0)
})
