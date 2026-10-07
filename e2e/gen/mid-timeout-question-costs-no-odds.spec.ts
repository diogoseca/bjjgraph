/* @hyperspace {"theme":"momentum-and-economy","L":"curriculum-mid","F":"decision-timer","B":"keyboard-timing"} @invariant "Timing out a pending landing question is priced EXACTLY like a plain wrong answer and recorded as an expiry, never as an answer: the 3-2-1 expiry_warning precedes one land_q_expired, the streak breaks once with combo_break {reason:'slow', at:1}, _qMod is exactly -0.04 before the next arrival forgives it, no land_q_answered {correct:false} is ever minted, and the hand stays live (no commit is made for the player)." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { curriculumMid } from "./personas"

/**
 * TIMEOUT IS A MISS, PRICED LIKE A WRONG ANSWER, RECORDED AS AN EXPIRY.
 *
 * INVERTED (gen-triage, v1.206.x) — the owner reversed this spec's claim on purpose. It was
 * written at v1.70.2 against "ignored → combo break ONLY — no odds penalty ever" and the old
 * hand clock's auto-pick (expiry_warning → auto_pick → commit). v1.129.0 (7677bfe70) retired
 * auto_pick; v1.133.0 (e6f655a6a) moved the clock to the QUESTION and made expiry a miss.
 * Owner: "when the clock runs out, the algorithm doesn't choose for you. You still choose. …
 * the right choice and the wrong choices are revealed … You get penalized if you don't click the
 * right answer or click 'Show' in time." — answered fork: expiry counts as a wrong answer
 * (combo break, −4% this exchange, SRS miss). So the economy line moved:
 *   right   → credit (combo up)                                  (_landAnswered)
 *   wrong   → _qMod −0.04 (−0.08 trap) + combo_break "wrong"     (_landAnswered)
 *   expired → _qMod −0.04 + combo_break "slow" + failed SRS review, answer revealed,
 *             HAND STAYS LIVE                                    (_expireLandQ)
 *   skipped → committing past an open question is FREE (land_q_ignored, momentum untouched)
 * What did NOT move, and is still asserted: an expiry never goes through _landAnswered, the only
 * emitter of land_q_answered — it is its own named beat (land_q_expired), so the beat stream can
 * always tell "slow" from "wrong" even though the two cost the same.
 *
 * Journey: a mid-curriculum player answers landing 1 by KEYBOARD (a/b/c answers the live MC
 * block) to earn combo ×1, advances one state, then freezes on landing 2's question until the
 * question clock expires.
 *
 * Persona seam: curriculumMid ships prep/rec but an EMPTY stage:{} map, so questionFor's
 * cardStage<2 gate finds an unproven card at EVERY landing — landing 2 asks reliably
 * (asserted via land_q_shown count, structure only, never question text).
 *
 * PRE-ARRIVAL READ: enterLand resets _qMod = 0 on the NEXT arrival ("a new arrival forgives").
 * Under the new law nothing moves after the expiry (no commit is made for the player), so the
 * read is pre-arrival by construction — and the land/commit counts prove it.
 *
 * Determinism census: land() rigs ai-skill/role/max-moves; the landing MC's own draws are
 * surface-scoped (land-mc-pick/land-mc-shuffle) and the answer index is READ from the _mc truth
 * closure (never guessed). Leg 1: resolve 0.01 (< the moveChance floor → always succeeds) +
 * outcome 0.01 (first cell) on a transitions-type option advances one state. The expiry path
 * draws nothing (the retired "auto-pick" tag no longer exists). Window: one flat decisionSec
 * (9s; curriculumMid is a RETURNING visitor, so no 1.5× grace), armed only once engaged —
 * land() engages — so advanceUntil's 20000ms cap clears it twice over.
 *
 * Red-proof: deleting the −0.04 from _expireLandQ (the v1.133.0 "expiry-costs-nothing" mutant)
 * fails the exact _qMod assert.
 */

test("frozen landing question: expiry narrates (warning→land_q_expired), breaks ×1 momentum as 'slow', charges exactly the −4% miss, never mints a wrong answer, and leaves the hand live", async ({ page }) => {
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

  // ── FREEZE: no draws to rig (the expiry path chooses nothing); pump past the question window ──
  const hand2 = await page.evaluate(() => ((window as any).__neural.optionIdxs || []).length)
  const commits2 = (await j.beats()).filter((b: any) => b.beat === "commit").length
  await j.advanceUntil("land_q_expired", 20000)

  // ── beat-stream forensics + the pre-arrival state read, one evaluate ──
  const m = await page.evaluate(() => {
    const a = (window as any).__neural
    const beats = (a.beats || []).slice()
    const seq = beats.map((b: any) => b.beat)
    return {
      beats,
      iWarn: seq.indexOf("expiry_warning"),
      iExp: seq.indexOf("land_q_expired"),
      iBreak: seq.indexOf("combo_break"),
      expCount: beats.filter((b: any) => b.beat === "land_q_expired").length,
      landCount: beats.filter((b: any) => b.beat === "land").length,
      commits: beats.filter((b: any) => b.beat === "commit").length,
      hand: (a.optionIdxs || []).length,
      revealed: !!document.querySelector("[data-land-q] [data-mc-result='correct']"),
      qMod: a._qMod || 0,
      combo: a._combo || 0,
      pending: !!a._landPending,
    }
  })

  // the narration: 3-2-1 warning strictly BEFORE the reveal, exactly one timeout
  expect(m.iWarn, "an expiry_warning was narrated").toBeGreaterThanOrEqual(0)
  expect(m.iExp, "the clock expired into a named reveal (land_q_expired), not a silent theft").toBeGreaterThanOrEqual(0)
  expect(m.iWarn, "expiry_warning precedes land_q_expired").toBeLessThan(m.iExp)
  expect(m.expCount, "exactly one timeout fired").toBe(1)
  const warnSeconds = m.beats.filter((b: any) => b.beat === "expiry_warning").map((b: any) => b.seconds)
  for (const s of warnSeconds) expect([1, 2, 3], "each warning counts down the final 3 seconds").toContain(s)

  // THE BREAK: the miss kills the streak — exactly once, at ×1, reason "slow" (v1.133.0: was
  // "ignored" when the auto-pick's commit broke it), and it comes FROM the expiry, after its beat
  const breaks = m.beats.filter((b: any) => b.beat === "combo_break")
  expect(breaks.length, "exactly one combo_break in the whole journey").toBe(1)
  expect((breaks[0] as any).reason, "the break is the timeout's own — 'slow', neither 'wrong' nor 'ignored'").toBe("slow")
  expect((breaks[0] as any).at, "the streak died at ×1 — it was alive when the clock ran out").toBe(1)
  expect(m.iBreak, "the break follows the land_q_expired that caused it").toBeGreaterThan(m.iExp)
  expect(m.combo, "momentum is cold after the break").toBe(0)
  expect(m.pending, "the expiry consumed the pending flag").toBe(false)

  // THE HAND STAYS LIVE: "the algorithm doesn't choose for you" — no commit, no arrival, the
  // revealed answer is on the table and every dealt option is still there to pick
  expect(m.commits, "no move was committed for the frozen player").toBe(commits2)
  expect(m.landCount, "no third arrival — the _qMod read below is pre-forgiveness").toBe(2)
  expect(m.hand, "the hand survives the clock").toBe(hand2)
  expect(m.revealed, "the correct option is lit — the answer was revealed").toBe(true)

  // THE ECONOMY LINE (inverted v1.133.0): the expiry costs exactly what a plain wrong answer
  // costs — −0.04 on this exchange — no more (not the −0.08 trap price), no less (not free)
  expect(m.qMod, "_qMod is exactly −0.04 — a timeout is priced like a wrong answer").toBe(-0.04)

  // AND NO WRONG ANSWER EVER MINTED: _landAnswered is the only emitter of land_q_answered, and
  // an expiry never calls it — landing 1's correct:true stays the journey's ONLY answer beat
  const answered = m.beats.filter((b: any) => b.beat === "land_q_answered")
  expect(answered.length, "exactly one land_q_answered in the whole journey").toBe(1)
  expect((answered[0] as any).correct, "and it is landing 1's correct answer").toBe(true)
  expect(
    answered.filter((b: any) => b.correct === false).length,
    "zero land_q_answered {correct:false} — a timeout is recorded as an expiry, never as an answer",
  ).toBe(0)
})
