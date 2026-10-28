// v1.230.0: the owner dropped practise-before-you-try on 2026-10-15 (question 6).
/* @hyperspace {"theme":"onboarding","L":"first-roll-day1","F":"decision-timer","B":"keyboard-timing"} @invariant "A day-1 player's first question window behaves as designed with no coach in the way: no clock runs before their first interaction, then it is live (drains under advance); the video viewer declines the question for free (land_q_declined, no penalty, no momentum loss) and sidebar study buys no time (zero timer_refund) but pays in odds (bonus_pumped); and freezing afterwards expires nothing, because the hand is never timed." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { firstRollDay1 } from "./personas"

/** A returning day-1 profile still waits for its first real engagement before the
 * question clock runs. The video viewer declines that question without penalty; a real
 * sidebar grade earns odds and no time. With the question gone, the hand never expires.
 * Owner decision 2026-10-15 retires JIT; Video viewer + the existing study pane carry these
 * surviving laws. Sidebar entry is fixture setup, grading uses real mouse controls.
 * Historical filename retained for ledger identity. No move is committed.
 */

test("day-1 first window: no clock before engagement, then live; the viewer declines for free and study buys no time; freezing after expires nothing", async ({ page }) => {
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
  // U47 d: engagement alone no longer arms an asking question; Answer for Points does (no pump).
  // Engagement is read BEFORE Answer for Points, which engages by itself.
  expect(await page.evaluate(() => !!(window as any).__neural._engaged), "the corner moves engaged the player").toBe(true)
  expect(await page.evaluate(() => (window as any).__neural._decision?.remaining ?? null), "U47 d: engagement alone leaves the asking question unclocked").toBeNull()
  await j.openQuestion()
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

  // the viewer declines the question for free; study subsequently pays in odds, never time.
  const options = await j.optionTitles()
  await j.watchChoice(options[0])
  const onOpen = await page.evaluate(() => {
    const a = (window as any).__neural
    return { left: a.decisionRemaining(), qMod: a._qMod || 0, pending: !!a._landPending }
  })
  expect(onOpen.left, "the viewer DECLINED the question — no window is running").toBe(0)
  expect(onOpen.pending, "the declined question is no longer pending").toBe(false)
  expect(onOpen.qMod, "declining is free — no odds penalty").toBe(0)
  const declined = (await j.beats()).filter((b: any) => b.beat === "land_q_declined")
  expect(declined.length, "exactly one land_q_declined — the viewer put the question away").toBe(1)
  expect((declined[0] as any).reason, "declined BY the video viewer").toBe("reading")

  await j.studyChoice(options[0])
  const pumped0 = (await j.beats()).filter((b: any) => b.beat === "bonus_pumped").length
  await j.studyGrade()
  expect(await remaining(), "still no clock — the drill buys odds, never time").toBe(0)
  const afterGrade = await j.beats()
  expect(afterGrade.filter((b: any) => b.beat === "timer_refund").length, "zero timer_refund beats — the refund is retired").toBe(0)
  expect(afterGrade.filter((b: any) => b.beat === "bonus_pumped").length, "the day-1 grade paid in odds (bonus_pumped)").toBe(pumped0 + 1)

  // ── CLAIM 3 (inverted v1.133.0): close study and FREEZE for twice the window — nothing
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
