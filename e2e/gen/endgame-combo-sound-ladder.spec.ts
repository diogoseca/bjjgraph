/* @hyperspace {"theme":"sound","L":"multi-belt-endgame","F":"momentum","B":"beat-voice-parity"}
   @invariant "The sound bus mirrors the combo arc: climbing to ×5 logs combo voices from ×2 onward plus one distinct combo_big voice at ×5, and a wrong answer then logs a combo_break voice — the beats and the voices agree on the arc." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { multiBeltEndgame } from "../gen/personas"

/**
 * PROMOTED — Q003 is FIXED (ledger: accepted); the prose below documents the bug as born.
 *
 * The v1.70.0 momentum patches exist in the synth (sound.src.js: combo "a bright two-step
 * for every combo", combo_break "a string-snap slide when the streak dies") but are
 * UNREACHABLE in play: fx("combo") / fx("combo_break") fire in the SAME synchronous answer
 * handler as fx("mc_correct"|"mc_wrong") (+ bonus_pumped / timer_refund), and NGSound.beat's
 * 40ms wall-clock voice spacing (sound.src.js:94) drops every non-major patch that follows
 * the first accepted voice. Only combo_big carries major:1 and survives. The audible ladder
 * is therefore: ding … ding … STAB — no two-step at ×2/×3/×4, no snap on the break.
 *
 * This spec asserts the arc the sound design intends. It goes green when combo/combo_break
 * become audible (any fix shape: major-flag, spacing exemption, emission reorder, …).
 */

/** is an UNANSWERED landing question live? (_mc persists after answering; _landPending is
 *  the on-the-table flag, cleared in _landAnswered) */
const hasLandQ = (page: any) =>
  page.evaluate(() => {
    const a = (window as any).__neural
    return !!(a._landPending && a._mc && a._mc.surface === "land")
  })

/** answer the live landing question via the keyboard (A-D), correct or deliberately wrong */
const answer = async (page: any, correct: boolean) => {
  const mc = await page.evaluate(() => {
    const m = (window as any).__neural._mc
    return m && m.surface === "land" ? { correct: m.correct, n: m.n } : null
  })
  expect(mc, "a live landing question").toBeTruthy()
  await page.keyboard.press("abcd"[correct ? mc!.correct : (mc!.correct + 1) % mc!.n])
}

/** execute a rigged-successful transition and pump to the next hand */
const advanceState = async (j: any, page: any) => {
  const t = await page.evaluate(() => {
    const a = (window as any).__neural
    for (const i of a.optionIdxs || []) if (a.nodes[i].ty === "transitions") return a.nodes[i].t
    return ""
  })
  expect(t, "a transition to advance on").toBeTruthy()
  await j.rig("resolve", [0.01])
  await j.rig("outcome", [0.01])
  await j.pick(t)
  await j.nextHand()
}

test("climbing to ×5 voices the combo two-step from ×2, the ULTRA stab at ×5, and the snap on the break", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/", { initialState: multiBeltEndgame() })
  await j.land("Mount Top")

  // climb: answer right at every landing that asks, hop states until _combo === 5
  let combo = 0
  for (let hop = 0; hop < 18 && combo < 5; hop++) {
    if (await hasLandQ(page)) {
      await answer(page, true)
      combo = await page.evaluate(() => (window as any).__neural._combo || 0)
    }
    if (combo < 5) await advanceState(j, page)
  }
  expect(combo, "the ladder reached ULTRA (×5)").toBe(5)

  // break it: find the next landing question and answer it wrong
  let asked = false
  for (let hop = 0; hop < 10 && !asked; hop++) {
    if (await hasLandQ(page)) {
      asked = true
      await answer(page, false)
      break
    }
    await advanceState(j, page)
  }
  expect(asked, "a landing question to answer wrong").toBe(true)
  expect(await page.evaluate(() => (window as any).__neural._combo || 0), "streak died").toBe(0)

  // the BEAT layer mirrors the arc (this half already holds — it anchors the parity claim)
  const beats = (await j.beats()) as any[]
  expect(
    beats.filter((b) => b.beat === "combo").map((b) => b.n),
    "combo beats fired at every tier from ×2",
  ).toEqual([2, 3, 4, 5])
  expect(beats.some((b) => b.beat === "combo_big" && b.n === 5), "combo_big beat at ×5").toBe(true)
  expect(beats.some((b) => b.beat === "combo_break" && b.at === 5), "combo_break beat on wrong").toBe(true)

  // the VOICE layer must mirror it too (RED today: only combo_big survives the 40ms spacing)
  const voices = (await j.soundLog()) as any[]
  const comboVoices = voices.filter((v) => v.beat === "combo")
  const bigVoices = voices.filter((v) => v.beat === "combo_big")
  const breakVoices = voices.filter((v) => v.beat === "combo_break")

  // ×2 ×3 ×4 must each be audible (×5 may legitimately voice only the louder combo_big stab)
  expect(comboVoices.length, "combo voices logged from ×2 onward").toBeGreaterThanOrEqual(3)
  expect(comboVoices[0].patch.length, "combo patch non-empty").toBeGreaterThan(0)
  expect(bigVoices.length, "exactly one combo_big voice at ×5").toBe(1)
  expect(bigVoices[0].patch.length, "combo_big patch non-empty").toBeGreaterThan(0)
  expect(bigVoices[0].patch, "combo_big is a DIFFERENT voice than combo").not.toBe(comboVoices[0].patch)
  expect(breakVoices.length, "a combo_break voice on the wrong answer").toBeGreaterThanOrEqual(1)
})
