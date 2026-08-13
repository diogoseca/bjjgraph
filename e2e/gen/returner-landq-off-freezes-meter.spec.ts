/* @hyperspace {"theme":"momentum-and-economy","L":"lapsed-returner","F":"settings","B":"cross-feature"} @invariant "landQuestions=false removes the question surface AND freezes the momentum economy with it — across multiple hops no [data-land-q] renders, _combo stays 0 with zero combo/combo_break beats — and flipping it back on mid-session asks again at the very next arrival (the gate is read live per enterLand)." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { lapsedReturner } from "./personas"

/**
 * THE QUESTION SWITCH FREEZES THE WHOLE ECONOMY — one setting, two coupled guarantees
 * (neural/src/app.src.jsx, line-verified):
 *   1. renderLandCard reads the gate LIVE on every arrival (:4221 —
 *      `this.get("landQuestions", true) ? this.questionFor(key) : null`). Nothing is cached:
 *      identity (:4237) / definition / film render regardless; only the question block (:4272)
 *      is gated. So a mid-session flip changes behavior at the VERY NEXT landing, both ways.
 *   2. The momentum economy is downstream of that block and freezes with it:
 *      _landPending is set ONLY when a question block mounts (:4285), so enterAttempt's
 *      ignored-break (:4912) can never fire while off — picks are not "walking past" anything.
 *      _comboUp (:4333) is reachable ONLY from _landAnswered (:4306), whose only caller is the
 *      mounted block's callback (:4280) — so _combo stays 0 and no combo-family beat can exist.
 *
 * Journey: a lapsed returner (white-belt holder back from a break) turns landing questions
 * OFF before their comeback roll, plays three arrivals — each shows identity but no
 * [data-land-q], no heat chip, _combo 0, momentumMod 0, nothing pending, zero
 * land_q_shown/land_q_answered/combo/combo_big/combo_break beats — then flips the setting
 * back ON mid-session. The next hop's arrival asks again (the journey's FIRST land_q_shown);
 * answering it by keyboard mints the first land_q_answered {correct:true} and thaws the
 * meter to exactly ×1 (still no combo beat — the announcer only fires at n>=2, :4336).
 *
 * Persona seam: lapsedReturner ships full white-belt prep/rec but an EMPTY stage:{} map, so
 * questionFor's cardStage<2 gate finds an unproven card in EVERY deck — the on-phase is
 * non-vacuous by construction (a proven deck would ask nothing and pass vacuously).
 *
 * Determinism census: land() rigs ai-skill/role/max-moves. Per hop: resolve 0.01 (< the 0.05
 * moveChance floor → always succeeds) + outcome 0.01 (first cell) on the first
 * transitions-type option, then nextHand() — the exact pattern of e2e/journeys/momentum.spec.ts.
 * The post-flip MC's own draws are surface-scoped (land-mc-pick/land-mc-shuffle) and the
 * answer index is READ from the _mc truth closure (never guessed), so no MC queue is rigged.
 *
 * Discriminator: if the gate were snapshotted at roll start instead of read per arrival, the
 * post-flip arrival would render no question — "the very next arrival asks again" fails on
 * [data-land-q] visibility and the land_q_shown count stays 0.
 */

test("landQuestions off freezes surface + meter across hops; flipping back on asks at the very next arrival", async ({ page }) => {
  const j = journey(page)
  await j.boot("/", { initialState: lapsedReturner() })

  // ── flip the gate OFF through the same settings seam the UI toggle uses (:1165 set),
  // BEFORE the first landing — arrival 1 must already render questionless ──
  await page.evaluate(() => (window as any).__neural.set("landQuestions", false))

  await j.land("Mount Top")

  // ── the off-phase contract, checked at every arrival: card without question, cold meter ──
  const frozen = async (label: string) => {
    await expect(page.locator("[data-landcard]"), `${label}: the card renders regardless of the gate`).toBeVisible()
    await expect(page.locator("[data-land-q]"), `${label}: no question surface`).toHaveCount(0)
    await expect(page.locator("[data-momentum]"), `${label}: no heat chip`).toHaveCount(0)
    const s = await page.evaluate(() => {
      const a = (window as any).__neural
      const m = a._mc
      return {
        combo: a._combo || 0,
        mod: a.momentumMod(),
        pending: !!a._landPending,
        landMc: !!(m && m.surface === "land"),
      }
    })
    expect(s.combo, `${label}: _combo frozen at 0`).toBe(0)
    expect(s.mod, `${label}: momentumMod is 0`).toBe(0)
    expect(s.pending, `${label}: nothing pending — a pick can never be an "ignored" break`).toBe(false)
    expect(s.landMc, `${label}: no land-surface MC truth closure mounted`).toBe(false)
  }

  // ── one deterministic hop: first transitions-type option, rigged to succeed ──
  const hop = async () => {
    const t = await page.evaluate(() => {
      const a = (window as any).__neural
      for (const o of a.optionIdxs || []) {
        const n = a.nodes[typeof o === "number" ? o : o.idx]
        if (n && n.ty === "transitions") return n.t
      }
      return ""
    })
    expect(t, "a transitions-type option to hop on").not.toBe("")
    await j.rig("resolve", [0.01])
    await j.rig("outcome", [0.01])
    await j.pick(t)
    await j.nextHand()
  }

  await frozen("arrival 1 (off)")
  await hop()
  await frozen("arrival 2 (off)")
  await hop()
  await frozen("arrival 3 (off)")

  // ── the whole off-phase emitted ZERO question or economy beats — the freeze is total ──
  const offBeats = (await j.beats()).map((b: any) => b.beat)
  for (const b of ["land_q_shown", "land_q_answered", "combo", "combo_big", "combo_break"]) {
    expect(offBeats.filter((x) => x === b).length, `zero ${b} beats across the off-phase`).toBe(0)
  }

  // ── FLIP BACK ON mid-session: the gate is read live per arrival (:4221), so the VERY
  // NEXT landing asks — no reload, no new roll, same match ──
  await page.evaluate(() => (window as any).__neural.set("landQuestions", true))
  await hop()

  await expect(page.locator("[data-land-q]"), "the very next arrival asks again").toBeVisible()
  const mc = await page.evaluate(() => {
    const a = (window as any).__neural
    const m = a._mc
    return a._landPending && m && m.surface === "land" && typeof m.correct === "number"
      ? { correct: m.correct }
      : null
  })
  expect(mc, "live land-surface MC block with a known correct index").toBeTruthy()
  await page.keyboard.press("abcd"[mc!.correct])

  // ── the thaw, in one read: exactly one shown, one answered {correct:true}, meter at ×1 ──
  const end = await page.evaluate(() => {
    const a = (window as any).__neural
    const beats = (a.beats || []).slice()
    return {
      combo: a._combo || 0,
      pending: !!a._landPending,
      shown: beats.filter((b: any) => b.beat === "land_q_shown").length,
      answered: beats.filter((b: any) => b.beat === "land_q_answered"),
      comboFamily: beats.filter((b: any) => ["combo", "combo_big", "combo_break"].includes(b.beat)).length,
    }
  })
  expect(end.shown, "exactly one land_q_shown in the whole journey — the post-flip arrival's").toBe(1)
  expect(end.answered.length, "exactly one land_q_answered in the whole journey").toBe(1)
  expect((end.answered[0] as any).correct, "and it was answered correctly").toBe(true)
  expect(end.combo, "the meter thawed to exactly ×1 on the first post-flip answer").toBe(1)
  expect(end.pending, "the answer cleared the table").toBe(false)
  expect(end.comboFamily, "still zero combo-family beats — ×1 announces nothing (combo fires at n>=2)").toBe(0)
})
