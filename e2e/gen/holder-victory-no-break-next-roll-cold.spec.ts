/* @hyperspace {"theme":"momentum-and-economy","L":"white-belt-holder","F":"victory-defeat","B":"cross-feature"} @invariant "Winning hot is never scored as breaking: a rigged submission win at ×2 emits finish/victory_cascade/roll_end with zero combo_break beats, and the next auto-started roll opens cold (_combo 0, chip gone) — per-roll reset flows through the victory path, not through _breakCombo." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { whiteBeltHolder } from "./personas"

/**
 * WINNING HOT IS NEVER SCORED AS BREAKING — the victory route through the per-roll reset.
 *
 * Momentum is per MATCH (v1.70.0), and there are two exits: _breakCombo (app.src.jsx:4345)
 * — the PUNISHMENT, reachable only via a wrong answer (:4312) or committing past an
 * unanswered question (enterAttempt, :4912) — and the plain bookkeeping zero at the head of
 * the next match. endRound("win") (:4050-4083) fires victory_cascade → finish →
 * roll_end{outcome:"win"} and never touches _combo; the auto-restart chain (hold 4.4s →
 * hideCenter → after 0.55 → startRoll) goes cold through startRoll's per-match reset
 * (:4738 — `_combo = 0; _landPending = false; _updateComboChip()`), which emits NO
 * combo_break beat and removes the chip through the non-shatter branch. So a player who
 * finishes the match while ×2 hot must see zero combo_break beats across the ENTIRE
 * journey — through the build, the cascade, and the auto-started next roll.
 *
 * Nearest neighbors, differentiated: core-019 (golden-path win — no momentum in play at
 * all) and momentum.spec's per-roll-cold test (manual startRoll() call — no victory path,
 * no zero-break assertion). This spec is the cross-feature seam between them: the win
 * CASCADE is what carries the streak into the reset.
 *
 * Determinism census: land() rigs the intro's ai-skill/role/max-moves; landing MCs draw on
 * surface-scoped land-mc-pick/land-mc-shuffle (reading _mc consumes nothing); each hop and
 * the finish rig resolve/outcome [0.01]; the post-finish rigs (ai-skill/role/max-moves/
 * start-pos) are queued AFTER the finish beat but BEFORE pumping past endRound's 4.4s hold,
 * exactly when startRoll consumes them (:4738-4765). whiteBeltHolder()'s stage:{} is empty,
 * so every landing still asks (cardStage < 2) and heat can be built the honest way. The one
 * trap dodged deliberately: _landPending is asserted false before the submission commit —
 * an unanswered question would make the win read as "ignored" and fake a break.
 * Probe: 3/3 green; a submission was dealt within <=5 hops from Mount Top on every run.
 */

test("submission win at ×2: victory spine clean of combo_break, next auto-roll opens cold", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/", { initialState: whiteBeltHolder() })
  await j.land("Mount Top")

  // ── answer the live landing question CORRECTLY via the keyboard. Gated on _landPending
  // (the unanswered-question signal) because _mc lingers after an answer. ──
  const answerLanding = async (): Promise<boolean> => {
    const mc = await page.evaluate(() => {
      const a = (window as any).__neural
      const m = a._mc
      return a._landPending && m && m.surface === "land" && typeof m.correct === "number"
        ? { correct: m.correct }
        : null
    })
    if (!mc) return false // a landing that asks nothing carries the streak
    await page.keyboard.press("abcd"[mc.correct])
    const pending = await page.evaluate(() => !!(window as any).__neural._landPending)
    expect(pending, "answer registered — nothing left for the next commit to ignore").toBe(false)
    return true
  }
  const combo = () => page.evaluate(() => (window as any).__neural._combo || 0)
  const subInTray = () =>
    page.evaluate(() => {
      const a = (window as any).__neural
      for (const o of a.optionIdxs || []) {
        const n = a.nodes[typeof o === "number" ? o : o.idx]
        if (n && n.ty === "submissions") return n.t as string
      }
      return null
    })
  const firstTransition = () =>
    page.evaluate(() => {
      const a = (window as any).__neural
      for (const o of a.optionIdxs || []) {
        const n = a.nodes[typeof o === "number" ? o : o.idx]
        if (n && n.ty === "transitions") return n.t as string
      }
      return null
    })

  // ── build real heat the honest way: right at Mount Top (×1), then hop-and-answer until
  // ×2+ hot AND a submission sits in the tray (probe: <=5 hops always sufficed) ──
  let earned = 0
  if (await answerLanding()) earned++
  expect(earned, "Mount Top asked a landing question and it was answered").toBe(1)

  let sub: string | null = null
  for (let hop = 0; hop < 5 && !sub; hop++) {
    const t = await firstTransition()
    expect(t, "a transition to hop on").toBeTruthy()
    await j.rig("resolve", [0.01])
    await j.rig("outcome", [0.01])
    await j.pick(t as string)
    await j.nextHand()
    if (await answerLanding()) earned++
    if (earned >= 2) sub = await subInTray()
  }
  expect(sub, "a submission dealt within 5 hops while >= ×2 hot").toBeTruthy()
  expect(earned, "at least ×2 earned before the finish").toBeGreaterThanOrEqual(2)
  expect(await combo(), "the meter sits exactly at its earned value").toBe(earned)
  const combosBefore = (await j.beats()).filter((b: any) => b.beat === "combo") as any[]
  expect(combosBefore.some((b) => b.n === 2), "the ×2 combo beat fired during the build").toBe(true)
  await expect(page.locator("[data-momentum]"), "the heat chip is live going in").toBeVisible()
  expect(
    await page.evaluate(() => !!(window as any).__neural._landPending),
    "no unanswered question on the table — the commit must not score as ignored",
  ).toBe(false)

  // ── the rigged finish: submission hits, the round ends in a win ──
  await j.rig("resolve", [0.01])
  await j.rig("outcome", [0.01])
  await j.pick(sub as string)
  await j.advanceUntil("finish", 20000)

  // ── the victory spine, in order, with the streak STILL hot (endRound never touches
  // _combo — the reset belongs to the next match, not to the win) ──
  const spine = (await j.beats()).map((b: any) => b.beat)
  const iCascade = spine.indexOf("victory_cascade")
  const iFinish = spine.indexOf("finish")
  const iEnd = spine.indexOf("roll_end")
  expect(iCascade, "victory_cascade fired").toBeGreaterThanOrEqual(0)
  expect(iFinish, "finish after the cascade").toBeGreaterThan(iCascade)
  expect(iEnd, "roll_end closes the spine").toBeGreaterThan(iFinish)
  expect(await j.lastOutcome(), "the roll ended in a win").toBe("win")
  expect(
    spine.filter((b) => b === "combo_break").length,
    "zero combo_break through the whole win — winning hot is not breaking",
  ).toBe(0)
  expect(await combo(), "still hot through the cascade, pre-restart").toBe(earned)

  // ── next-roll rigs, queued in the seam: after the finish beat, before pumping past
  // endRound's 4.4s hold — startRoll consumes all four (start-pos at :4765) ──
  await j.rig("ai-skill", [0.5])
  await j.rig("role", [0.1])
  await j.rig("max-moves", [0.1])
  await j.rig("start-pos", [0.1])
  await j.nextHand(30000) // hold 4.4s + 0.55s + startRoll's 1.3s land → fresh hand

  // ── the auto-started roll opens COLD, and cold is not broken ──
  expect(await combo(), "cold: _combo 0 in the new match").toBe(0)
  expect(
    await page.evaluate(() => (window as any).__neural.momentumMod()),
    "no residual momentum bonus",
  ).toBe(0)
  await expect(page.locator("[data-momentum]"), "chip gone with the old match").toHaveCount(0)
  const bs = await j.beats()
  expect(
    bs.filter((b: any) => b.beat === "combo_break").length,
    "STILL zero combo_break across the whole journey — the reset flowed through victory, not _breakCombo",
  ).toBe(0)
  expect(
    (bs as any[]).filter((b) => b.beat === "roll_end").length,
    "exactly one match ended, and it ended in the win",
  ).toBe(1)
})
