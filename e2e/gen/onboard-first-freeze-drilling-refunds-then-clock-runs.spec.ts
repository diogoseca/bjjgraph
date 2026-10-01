/* @hyperspace {"theme":"onboarding","L":"first-roll-day1","F":"decision-timer","B":"keyboard-timing"} @invariant "A day-1 player's first question window behaves as designed with no coach in the way: no clock runs before their first interaction, then it is live (drains under advance); drilling a move in its sheet DECLINES the question for free (land_q_declined, no penalty, no momentum loss) and buys no time (zero timer_refund) — the drill pays in odds (bonus_pumped); and freezing afterwards expires nothing, because the hand is never timed." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { firstRollDay1 } from "./personas"

/**
 * DAY-1 FIRST WINDOW: FREEZE, DRILL, THEN LET THE CLOCK RUN — firstRollDay1's first landing.
 *
 * RETARGETED + INVERTED (gen-triage, v1.206.x). This spec was written at v1.67.6 against three
 * mechanics the owner has since removed on purpose; its journey (land, freeze, drill one card in
 * the sheet, close it, let time run) is unchanged, and each claim now rides the deliberate
 * successor:
 *   1. "the guided coach was auto-dismissed … clock un-drained at hand-off (coach froze it)" →
 *      the coach was DELETED in v1.104.0 (bb80a008c, owner: it "shows on top and is really
 *      nasty"). The freeze it gave a newcomer's first window now comes from v1.137.0 (d3bcb63d3,
 *      owner: "a first-time Guest can land on TOO SLOW · −4% before ever interacting"): no window
 *      arms until the first REAL interaction AND the card is visible. The spec therefore lands
 *      WITHOUT j.land()'s built-in engage, proves the window is parked, engages with the DSL's
 *      own two corner moves, and reads remaining === total at the instant it arms. Then the clock
 *      is LIVE: advance(2000) drains it ~2s (claim kept as written).
 *   2. "one JIT grade refunds >=2s (timer_refund granted:true)" → INVERTED. v1.133.0 (e6f655a6a)
 *      retired refundDecision/timer_refund ("answering IS what the window was for"), and v1.134.0 (f12f8f74c)
 *      made opening a move's sheet DECLINE the open question — owner: "he needs to answer it
 *      fast, otherwise he needs to close the dialog". So drilling in the sheet costs nothing
 *      (land_q_declined, no −4%, no combo_break) and buys nothing in TIME: decisionRemaining()
 *      is 0 the moment the sheet opens and stays 0 through the grade. The drill pays in ODDS —
 *      bonus_pumped (core: jit-loop.spec.ts "drilling pumps odds and buys NO time").
 *   3. "run to zero narrates expiry_warning → auto_pick" → INVERTED. v1.129.0 (7677bfe70)
 *      retired auto_pick; v1.133.0 put the clock on the QUESTION, never the hand (owner:
 *      "Pressure should not be on the choices … the choices are fun to click"). After the decline
 *      there is no question facing the player, so pumping twice the window past the close
 *      expires NOTHING: zero expiry_warning, zero land_q_expired, _qMod 0, no commit, and the
 *      hand is still dealt. "The penalty exists only for letting it expire while it faces you."
 *      (The narrated-expiry branch is pinned by returner-decision-timer-expiry-narrated-on-
 *      comeback and mid-timeout-question-costs-no-odds.)
 *
 * Persona validity: firstRollDay1 seeds prep (a day-1 card graded), so it is a RETURNING visitor
 * by `_returningVisitor()` (the progress key exists) — full pressure, no 1.5× grace. A boot read
 * proves prep ingested, so this isn't a plain fresh boot masquerading as the day-1 case.
 *
 * Determinism: the land steps are j.land()'s own (ai-skill/role/max-moves rigs, rigStart, the 1s
 * pump, landQuestion()) minus the engage — engagement is a one-way latch, so j.land() cannot be
 * used for a pre-engagement read. Nothing is committed, so no resolve/outcome draw exists; the
 * JIT drill grades through j.jitGrade() (format-agnostic, truth from __neural._mc). Beats are
 * asserted on presence/order and their own props — never on card/answer TEXT.
 */

test("day-1 first window: no clock before engagement, then live; drilling in the sheet declines for free and buys no time; freezing after expires nothing", async ({ page }) => {
  const j = journey(page)
  await j.boot("/", { initialState: firstRollDay1() })

  // ── j.land("Mount Top") minus its engage (see header) ──
  await j.rig("ai-skill", [0.5])
  await j.rig("role", [0])
  await j.rig("max-moves", [0.5])
  await page.evaluate(() => {
    const a = (window as any).__neural
    const idx = a.nodes.findIndex((n: any) => n.ty === "positions" && n.t === "Mount Top")
    if (idx < 0) throw new Error("position not found: Mount Top")
    a.rigStart(idx)
  })
  for (let i = 0; i < 16; i++) {
    await j.advance(1000)
    const ready = await page.evaluate(() => {
      const a = (window as any).__neural
      return (a.optionIdxs || []).length > 0 && a._arriveGlideUntil == null
    })
    if (ready) break
  }
  await j.landQuestion()
  await j.expectBeat("land")
  await j.expectBeat("options_dealt")

  const remaining = () => page.evaluate(() => (window as any).__neural.decisionRemaining())

  // ── persona ingested, the first hand dealt with its question up — and no clock yet ──
  const boot = await page.evaluate(() => {
    const a = (window as any).__neural
    const d = a._decision
    return {
      prepDecks: Object.keys(a.prep || {}).length,
      engaged: !!a._engaged,
      parked: !!a._cwArm,
      asks: !!(a._mc && a._mc.surface === "land"),
      hasDecision: !!d,
      remaining: d ? d.remaining : "no-decision",
      opts: (a.optionIdxs || []).length,
      base: a.get("decisionSec", 9) * 1000,
      grace: a._returningVisitor() ? 1 : 1.5,
    }
  })
  expect(boot.prepDecks, "persona ingested: firstRollDay1 seeded a graded day-1 deck").toBeGreaterThan(0)
  expect(boot.opts, "the first hand actually dealt options").toBeGreaterThanOrEqual(1)
  expect(boot.hasDecision, "a decision context is armed on the first hand").toBe(true)
  expect(boot.asks, "the first landing asks a question").toBe(true)
  expect(boot.engaged, "the day-1 player has not touched anything yet").toBe(false)
  expect(boot.remaining, "so no window runs — the clock waits for the player (v1.137.0)").toBeNull()
  expect(boot.parked, "the arm is parked until they engage").toBe(true)

  // ── the first REAL interaction (dsl.engage()'s two corner moves, without its pump) ──
  await page.mouse.move(4, 4)
  await page.mouse.move(6, 6)
  const armed = await page.evaluate(() => {
    const d = (window as any).__neural._decision
    return { total: d ? d.total : 0, remaining: d ? d.remaining : 0 }
  })
  // total = decisionSec(9)*1000 × grace → >= 9000ms; armed at the interaction, nothing drained yet
  expect(armed.total, "decision window is the full authored budget (>=9s)").toBeGreaterThanOrEqual(9000)
  expect(armed.total, "decisionSec × the visitor's grace — nothing else shapes it").toBe(boot.base * boot.grace)
  expect(armed.remaining, "clock un-drained at hand-off (it armed at the first interaction)").toBe(armed.total)

  // ── CLAIM 1: the clock is LIVE — draining sim time drops decisionRemaining ~2s. ──
  const live0 = await remaining()
  await j.advance(2000)
  const live1 = await remaining()
  expect(live1, "the question clock drains once the player has engaged").toBeLessThan(live0 - 1.5)

  // ── CLAIM 2 (inverted v1.133.0/v1.134.0): open the sheet, drill ONE card — the question is
  //    declined for free and no time is bought; the drill pays in odds. ──
  const options = await j.optionTitles()
  await page.locator(`[data-tech="${options[0]}"]`).first().locator("[data-choice-inspect]").click()
  await expect(page.locator("[data-jit]"), "in-sheet JIT micro-drill visible").toBeVisible()
  const onOpen = await page.evaluate(() => {
    const a = (window as any).__neural
    return { left: a.decisionRemaining(), qMod: a._qMod || 0, pending: !!a._landPending }
  })
  expect(onOpen.left, "opening the sheet DECLINED the question — no window is running").toBe(0)
  expect(onOpen.pending, "the declined question is no longer pending").toBe(false)
  expect(onOpen.qMod, "declining is free — no odds penalty").toBe(0)
  const declined = (await j.beats()).filter((b: any) => b.beat === "land_q_declined")
  expect(declined.length, "exactly one land_q_declined — the sheet put the question away").toBe(1)
  expect((declined[0] as any).reason, "declined BY the option sheet").toBe("sheet")

  const pumped0 = (await j.beats()).filter((b: any) => b.beat === "bonus_pumped").length
  await j.jitGrade()
  expect(await remaining(), "still no clock — the drill buys odds, never time").toBe(0)
  const afterGrade = await j.beats()
  expect(afterGrade.filter((b: any) => b.beat === "timer_refund").length, "zero timer_refund beats — the refund is retired").toBe(0)
  expect(afterGrade.filter((b: any) => b.beat === "bonus_pumped").length, "the day-1 grade paid in odds (bonus_pumped)").toBe(pumped0 + 1)

  // ── CLAIM 3 (inverted v1.133.0): close the sheet and FREEZE for twice the window — nothing
  //    faces the player, so nothing expires, nothing is charged, nothing is chosen for them. ──
  await page.keyboard.press("Escape")
  await j.advance(2 * armed.total)

  const end = await page.evaluate(() => {
    const a = (window as any).__neural
    const beats = (a.beats || []).map((b: any) => b.beat)
    return {
      warn: beats.filter((b: string) => b === "expiry_warning").length,
      expired: beats.filter((b: string) => b === "land_q_expired").length,
      breaks: beats.filter((b: string) => b === "combo_break").length,
      commits: beats.filter((b: string) => b === "commit").length,
      autoPick: beats.filter((b: string) => b === "auto_pick").length,
      qMod: a._qMod || 0,
      left: a.decisionRemaining(),
      hand: (a.optionIdxs || []).length,
    }
  })
  expect(end.warn, "no 3-2-1 countdown — no question is on the clock").toBe(0)
  expect(end.expired, "no land_q_expired — a declined question cannot time out").toBe(0)
  expect(end.qMod, "no −4% — the penalty exists only for letting a question expire while it faces you").toBe(0)
  expect(end.breaks, "no momentum lost anywhere in the journey").toBe(0)
  expect(end.commits, "no commit — the hand is never timed, so nothing is picked for the day-1 player").toBe(0)
  expect(end.autoPick, "the retired auto-pick never fires").toBe(0)
  expect(end.left, "no clock running after the freeze").toBe(0)
  expect(end.hand, "the first hand is still dealt and waiting").toBe(boot.opts)
})
