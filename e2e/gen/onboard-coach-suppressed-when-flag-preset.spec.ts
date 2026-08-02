/* @hyperspace {"theme":"onboarding","L":"casual-week1","F":"intro-roll-coach","B":"guard-limit"} @invariant "A returning user whose bjj-neural-coached flag is already set is never re-coached: with the flag pre-seeded the first landing emits zero coach_1 beats and the decision clock runs immediately (drains under a plain advance)." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { casualWeek1 } from "./personas"

/**
 * ONBOARDING COACH — SUPPRESSED FOR A FLAG-PRESET RETURNER (the mirror of the fresh-visitor freeze).
 *
 * The coach-freeze siblings (onboard-coach-freeze-blocks-expiry, guidance-defense core-022) live in
 * the FRESH-VISITOR world: storage is wiped, bjj-neural-coached is absent, so the coach FIRES and
 * FREEZES the decision clock at hand-off. This spec is that world's mirror — the RETURNER world: the
 * bjj-neural-coached flag is already set, so on the very first landing maybeStartCoach short-circuits
 * on the persisted flag and NEVER opens the coach. Not frozen — SUPPRESSED. With no _coach set, the
 * decision clock is live from the instant options are dealt.
 *
 * Mechanism under test (source-verified, neural/src/app.src.jsx):
 *   - maybeStartCoach (:4034-4042): after the in-memory guard (:4035) it reads
 *       `localStorage.getItem("bjj-neural-coached")` (:4036); if truthy it sets
 *       `this._coachDone = true` and RETURNS at :4037 — WITHOUT setting `this._coach` and WITHOUT
 *       firing coach_1 (:4041, reached only when the flag is absent). ⇒ zero coach_1.
 *   - enterLand(first) (:4303): `if (first) this.maybeStartCoach();` — the coach is attempted only
 *       on the first-ever landing, which is exactly the landing this spec exercises.
 *   - finishCoach (:4055-4061) is the SOLE coach_done emitter, and it is reachable only via
 *       advanceCoach/dismissCoach — both of which require `this._coach` to be truthy. The preset
 *       flag never sets _coach ⇒ finishCoach is unreachable ⇒ zero coach_done as well (the flag
 *       latches _coachDone directly at :4037, bypassing the coach_done beat entirely).
 *   - _tickDecision (:4315-4317): `const d = this._decision; if (!d || !this._optPick || this._coach) return;`
 *       — the clock guard trips on `this._coach`. With _coach falsy (preset-flag path) the guard
 *       falls through and `d.remaining -= gdt*1000` (:4318) runs, so the clock DRAINS under a plain
 *       advance() — no dismissCoach needed, unlike the freeze world where the clock only ticks post
 *       coach_done.
 *
 * CALIBRATION (why this is NOT the frozen-coach world — the load-bearing distinction):
 *   In the freeze siblings the clock is armed at `{ remaining: total, ... }` (:4301) and stays pinned
 *   at `remaining == total` through land()'s deal pump because _coach freezes it. HERE the coach is
 *   suppressed, so the clock is live the instant options are dealt and has ALREADY drained a little
 *   during land()'s 2s pump (probe: total=16200ms but remaining0=15716ms, ~483ms already ticked).
 *   So we must NOT assert remaining0 ≈ total (that is a FROZEN-coach assertion and is false here).
 *   The correct suppressed-world assertions are: remaining0(ms) < total (already ticking) AND
 *   remaining0(sec) > total/1000 - 5 (barely any time gone — nothing expired during land).
 *   NB unit gotcha: decisionRemaining() (:4306) returns SECONDS (remaining/1000); d.total/d.remaining
 *   are MILLISECONDS. Assertions below keep the two frames straight.
 *
 * Persona (probe-verified working recipe, 3/3 deterministic, ~1.9s each):
 *   - casualWeek1() via boot("/", {initialState}). boot WIPES localStorage, so the coached flag is
 *     NOT carried by the blob — it MUST be set explicitly AFTER boot, BEFORE land. maybeStartCoach
 *     reads localStorage synchronously at land time (:4036), so post-boot/pre-land is the correct
 *     order; no reload / preserveStorage needed.
 *   - land("Mount Top", {keepCoach:true}) — keepCoach is load-bearing: it deals options WITHOUT
 *     dismissing, so IF a coach had fired we would catch it (its beat would already be in the stream).
 *     land() already rigs ai-skill/role/max-moves; the 2s deal pump never reaches rng("auto-pick")
 *     since the budget (>=9s) far exceeds the pump.
 *   - Assertions are STRUCTURAL — beat identity/counts, boolean flags, clock deltas — never coach
 *     copy text (MC waves and copy edits rewrite content).
 *
 * Non-vacuity: the freeze siblings prove the SAME land("Mount Top",{keepCoach}) DOES emit coach_1
 * and a frozen clock when the flag is ABSENT. So the zero-count assertions here bite because of the
 * preset flag, not because the coach machinery is dead or land() failed to deal a hand — this test
 * also positively asserts options were dealt and a decision window is armed.
 */

const POSITION = "Mount Top" // a valid positions node land() can rig-start on
const COACHED_KEY = "bjj-neural-coached"

test("preset bjj-neural-coached flag suppresses the coach on first landing and the decision clock runs immediately", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))

  const j = journey(page)
  // casualWeek1: a week-1 returner with unit-1 lessons drilled. boot() WIPES storage first, so the
  // persona blob rides the hash-seed but the coached flag does NOT — we set it ourselves next.
  await j.boot("/", { initialState: casualWeek1() })
  // THE PRESEED: set the coached flag AFTER the wipe, BEFORE land. maybeStartCoach reads it
  // synchronously at land time (app.src.jsx:4036), so this order is what a real returner presents.
  await page.evaluate((k) => localStorage.setItem(k, "1"), COACHED_KEY)
  // keepCoach: land deals options + arms the clock WITHOUT dismissing — if a coach had fired its
  // beat would be in the stream for us to catch. (For a suppressed coach there is nothing to dismiss.)
  await j.land(POSITION, { keepCoach: true })

  // ── the first landing happened and dealt a real hand ── (non-vacuity: the machine ran)
  await j.expectBeat("options_dealt")
  const landed = await page.evaluate(() => {
    const a = (window as any).__neural
    const d = a._decision
    return {
      coach: !!a._coach, // must be falsy — the coach was never opened
      coachDone: a._coachDone === true, // latched true by the preset-flag early return (:4037)
      hasDecision: !!d,
      total: d ? d.total : 0, // ms
      remainingMs: d ? d.remaining : 0, // ms
      remainingSec: a.decisionRemaining(), // sec (remaining/1000)
      opts: (a.optionIdxs || []).length,
    }
  })
  expect(landed.opts, "the first hand actually dealt options (machine is live, not dead)").toBeGreaterThanOrEqual(1)
  expect(landed.hasDecision, "a decision window is armed on the first landing").toBe(true)

  // ── SUPPRESSED, NOT OPENED: zero coach beats, and the flags reflect the preset-flag early return ──
  const beats0 = (await j.beats()).map((b) => b.beat)
  expect(beats0.filter((b) => b === "coach_1").length, "preset flag ⇒ the coach never opened: ZERO coach_1").toBe(0)
  expect(
    beats0.filter((b) => b === "coach_done").length,
    "no coach opened ⇒ finishCoach unreachable ⇒ ZERO coach_done (flag latched _coachDone directly)",
  ).toBe(0)
  expect(landed.coach, "_coach is falsy — the coach was never set (suppressed, not frozen)").toBe(false)
  expect(landed.coachDone, "_coachDone latched true by the preset-flag early return at :4037").toBe(true)

  // ── LIVE CLOCK, NOT FROZEN: total is the full authored budget (>=9s), but the clock already
  // ticked a little during land()'s pump — remaining < total from the instant options were dealt. ──
  // total = decisionSec(9)*1000 + (opts-1)*800 → >= 9000ms for any hand (Mount Top ~11-16s).
  expect(landed.total, "decision window is the full authored budget (>=9s)").toBeGreaterThanOrEqual(9000)
  // CALIBRATION: suppressed ≠ frozen. remaining STRICTLY BELOW total ⇒ the clock is already running.
  // (In the freeze world this would be remaining == total; asserting that here is a false, frozen-coach
  //  assertion — see the CALIBRATION note above.)
  expect(
    landed.remainingMs,
    "clock is LIVE from deal time: remaining < total (already ticking, not frozen at total)",
  ).toBeLessThan(landed.total)
  // …but only a little has drained — nothing expired during land(): remaining within 5s of the budget.
  expect(
    landed.remainingSec,
    "barely any time gone during land — nothing expired (remaining > total/1000 - 5s)",
  ).toBeGreaterThan(landed.total / 1000 - 5)

  // ── DRAINS UNDER A PLAIN ADVANCE: no dismissCoach needed — _coach is falsy so _tickDecision's
  // guard (:4317) falls through and the window drains. Snapshot r0 → advance 2s → r1. ──
  const r0 = await page.evaluate(() => (window as any).__neural.decisionRemaining()) // sec
  await j.advance(2000)
  const r1 = await page.evaluate(() => {
    const a = (window as any).__neural
    const d = a._decision
    return {
      remainingSec: a.decisionRemaining(),
      decisionArmed: !!d, // still armed — 2s < the >=9s budget, nothing auto-picked yet
    }
  })
  expect(r0, "a positive decision budget remained before the 2s pump").toBeGreaterThan(0)
  // ~2s of sim time drained the live clock — never frozen. (Freeze world drains 0 without coach_done.)
  expect(r0 - r1.remainingSec, "clock drained ~2s under a plain advance — it was live, not frozen").toBeGreaterThanOrEqual(1.5)
  expect(r1.decisionArmed, "the decision window is still armed after 2s (budget >=9s, no early auto_pick)").toBe(true)

  // ── and the plain advance produced NO auto_pick and STILL never a coach beat ── (structural)
  const beats1 = (await j.beats()).map((b) => b.beat)
  expect(beats1.filter((b) => b === "auto_pick").length, "no auto_pick within the drained 2s (budget >=9s)").toBe(0)
  expect(beats1.filter((b) => b === "coach_1").length, "STILL zero coach_1 after the advance — never re-coached").toBe(0)
  expect(beats1.filter((b) => b === "coach_done").length, "STILL zero coach_done after the advance").toBe(0)

  expect(errors, "no pageerror across the preseed, the suppressed landing, and the live clock").toEqual([])
})
