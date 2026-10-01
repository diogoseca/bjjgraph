/* @hyperspace {"theme":"momentum-and-economy","L":"white-belt-holder","F":"victory-defeat","B":"cross-feature"} @invariant "Winning hot is never scored as breaking: a rigged submission win at ×2 emits finish/victory_cascade/roll_end with zero combo_break beats, and the next auto-started roll opens cold (_combo 0, chip gone) — per-roll reset flows through the victory path, not through _breakCombo." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { whiteBeltHolder } from "./personas"

/**
 * WINNING HOT IS NEVER SCORED AS BREAKING — the victory route through the per-roll reset.
 *
 * Momentum is per MATCH (v1.70.0), and there are two exits: `_breakCombo` — the PUNISHMENT,
 * reachable today only via a wrong answer ("wrong") or a question clock running out ("slow");
 * committing past an unanswered question used to break it too ("ignored") until v1.133.0
 * (e6f655a6a) made that a FREE SKIP — and the plain bookkeeping zero at the head of the next
 * match. `endRound("win")` fires victory_cascade → finish → roll_end{outcome:"win"} and never
 * touches _combo; the auto-restart chain (hold 6.6s → hideCenter → after 0.8 → startRoll; it
 * was 4.4/0.55 before v1.168.0) goes cold through `startRoll`'s per-match reset
 * (`_combo = 0; _landPending = false; _updateComboChip()`), which emits NO combo_break beat
 * and removes the chip through the non-shatter branch. So a player who finishes the match
 * while ×2+ hot must see zero combo_break beats across the ENTIRE journey — through the build,
 * the cascade, and the auto-started next roll. (Symbols cited by name in
 * neural/src/app.src.jsx; the :line numbers this header carried had drifted ~11,000 lines.)
 *
 * TWO PICKS, ONE WIN (re-targeted 2026-10-01, gen-suite triage): since v1.176.0 (cdc35cefe,
 * "Give submission states their own choices") the first pick of a submission card only
 * ENTERS its state — deterministic travel, no resolve draw — and that state is a landing
 * like any other: it deals a "Finish" card under the same title AND asks its own landing
 * question (measured: it does, on whiteBeltHolder). The journey answers that question
 * correctly too (the build continues honestly, ×2 → ×3) and re-asserts "nothing unanswered on
 * the table" before the Finish — the second pick, where the rigged resolve is drawn and the
 * roll ends. The claim is unchanged: the win is still taken hot (≥ ×2), and still scored
 * clean.
 *
 * Nearest neighbors, differentiated: core-019 (golden-path win — no momentum in play at
 * all) and momentum.spec's per-roll-cold test (manual startRoll() call — no victory path,
 * no zero-break assertion). This spec is the cross-feature seam between them: the win
 * CASCADE is what carries the streak into the reset.
 *
 * Determinism census: land() rigs the intro's ai-skill/role/max-moves; landing MCs draw on
 * surface-scoped land-mc-pick/land-mc-shuffle (reading _mc consumes nothing); each hop and
 * the finish rig resolve/outcome [0.01] (the entry pick draws neither; the Finish consumes
 * both); the post-finish rigs (ai-skill/role/max-moves/start-pos) are queued AFTER the finish
 * beat but BEFORE pumping past endRound's 6.6s hold, exactly when startRoll consumes them.
 * whiteBeltHolder()'s stage:{} is empty, so every landing still asks (cardStage < 2) and heat
 * can be built the honest way. The trap this used to dodge: _landPending is asserted false
 * before BOTH submission commits — pre-v1.133.0 an unanswered question made a commit read as
 * "ignored" and fake a break; today the skip is free, but the guard is kept so the "no
 * combo_break" claim is never satisfied by an unanswered question being silently waived.
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

  // ── the rigged finish: submission hits, the round ends in a win. v1.176.0: the first pick
  // ENTERS the submission state (no draw); that state asks its own landing question, which is
  // answered like every other one before its Finish is taken. ──
  await j.rig("resolve", [0.01])
  await j.rig("outcome", [0.01])
  await j.pick(sub as string) // establishes the submission state
  await j.nextHand()
  if (await answerLanding()) earned++
  expect(await combo(), "still hot inside the submission state, at its earned value").toBe(earned)
  expect(
    await page.evaluate(() => !!(window as any).__neural._landPending),
    "no unanswered question on the table at the Finish — the commit must not score as ignored",
  ).toBe(false)
  await j.pick(sub as string) // its Finish: the rigged resolve is drawn here and the roll ends
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
  // endRound's 6.6s hold — startRoll consumes all four ──
  await j.rig("ai-skill", [0.5])
  await j.rig("role", [0.1])
  await j.rig("max-moves", [0.1])
  await j.rig("start-pos", [0.1])
  await j.nextHand(30000) // hold 6.6s + 0.8s + startRoll's intro and landing → fresh hand

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
