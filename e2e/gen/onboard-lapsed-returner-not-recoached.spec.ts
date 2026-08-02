/* @hyperspace {"theme":"onboarding","L":"lapsed-returner","F":"intro-roll-coach","B":"guard-limit"} @invariant "A lapsed returner who was already coached in a prior life is never coached again: with bjj-neural-coached pre-seeded alongside their career blob, the comeback landing emits zero coach_1 and the clock runs immediately — onboarding is a once-per-profile ritual that a break does not reset." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { lapsedReturner, CURRICULUM } from "./personas"

/**
 * ONBOARDING COACH — NEVER RE-FIRES FOR A LAPSED RETURNER (onboarding is once-per-profile).
 *
 * The freeze siblings (onboard-coach-freeze-blocks-expiry, guidance-defense core-022) live in the
 * FRESH-VISITOR world: storage wiped, bjj-neural-coached absent → the coach FIRES and FREEZES the
 * decision clock. onboard-coach-suppressed-when-flag-preset proves the mirror for a casualWeek1
 * returner. THIS spec sharpens that mirror onto the lapsed-returner axis: the flag is pre-seeded
 * ALONGSIDE a full career blob (white curriculum drilled, white belt won). The load-bearing claim
 * is the ORTHOGONALITY — the coach guard keys ONLY on bjj-neural-coached, so a break that leaves a
 * decorated career behind still never re-runs onboarding. A comeback is not a do-over.
 *
 * Mechanism under test (source-verified, neural/src/app.src.jsx):
 *   - maybeStartCoach (:4034-4042): after the in-memory guard (:4035) it reads
 *       `localStorage.getItem("bjj-neural-coached")` (:4036); if truthy it sets
 *       `this._coachDone = true` and RETURNS at :4037 — WITHOUT setting `this._coach` and WITHOUT
 *       firing coach_1 (:4041, reached only when the flag is absent). ⇒ zero coach_1.
 *   - enterLand(first) (:4303): `if (first) this.maybeStartCoach();` — the coach is attempted only
 *       on the first-ever landing, exactly the landing this spec exercises. The decision window is
 *       armed one line earlier (:4301) at `{ remaining: dsec*1000, total: dsec*1000, ... }`.
 *   - _tickDecision (:4317): `if (!d || !this._optPick || this._coach) return;` — the clock guard
 *       trips on `this._coach`. With _coach falsy (preset-flag path) the guard falls through and
 *       `d.remaining -= gdt*1000` (:4318) runs, so the clock DRAINS under a plain advance() — no
 *       dismissCoach needed, unlike the freeze world where the clock only ticks post coach_done.
 *   - The career blob (belts.won, prep) is ORTHOGONAL: maybeStartCoach never reads it. A returner
 *       with a won belt presents an identical coach-guard input to any other flag-preset user ⇒ the
 *       break does not reset onboarding.
 *
 * CALIBRATION (why this is NOT the frozen-coach world — the same distinction the sibling draws):
 *   In the freeze siblings the clock is pinned at `remaining == total` through land()'s deal pump
 *   because _coach freezes it. HERE the coach is suppressed, so the clock is live from the instant
 *   options are dealt and has ALREADY drained a little during land()'s pump. So we do NOT assert
 *   remaining ≈ total (a FROZEN-coach assertion, false here). Correct suppressed-world assertions:
 *   remaining(ms) < total (already ticking) AND remaining(sec) > total/1000 - 5 (nothing expired).
 *   Unit gotcha: decisionRemaining() (:4306) returns SECONDS (remaining/1000); d.total/d.remaining
 *   are MILLISECONDS. The r0 - r1 >= 1.5 delta over a 2s advance matches guidance-defense.spec.ts's
 *   live-clock threshold exactly.
 *
 * Persona (probe-verified working recipe, passed first try + 3/3 deterministic, ~1.9s each):
 *   - lapsedReturner() (== whiteBeltHolder(): real belts.won.white; white belt id = "white") via
 *     boot("/", {initialState}). boot WIPES localStorage, so the coached flag is NOT carried by the
 *     blob — it MUST be set explicitly AFTER boot (post-wipe), BEFORE land (pre-app-read).
 *     maybeStartCoach reads localStorage synchronously at land time (:4036), so post-boot/pre-land is
 *     the correct order; no reload / preserveStorage needed.
 *   - land("Mount Top", {keepCoach:true}) — keepCoach is load-bearing: it deals options WITHOUT
 *     dismissing, so IF a coach had fired we would catch its beat in the stream. land() already rigs
 *     ai-skill/role/max-moves; no custom rig tags needed (no MC/roll draws touched, budget >=9s far
 *     exceeds the 2s deal pump so rng("auto-pick") is never reached).
 *   - Assertions are STRUCTURAL — beat identity/counts, boolean flags, clock deltas, blob booleans
 *     — never coach copy or card text (MC waves and copy edits rewrite content).
 *
 * Non-vacuity: guidance-defense.spec.ts:100 and spa-nav-single-instance-law.spec.ts:87 already prove
 * a FRESH visitor's land("Mount Top",{keepCoach:true}) DOES emit coach_1. So the zero-count assertions
 * here bite because of the preset flag on a career profile, not because the coach machinery is dead or
 * land() failed to deal a hand — this test also positively asserts options were dealt, a decision
 * window is armed, AND the seeded career is present (the break-doesn't-reset premise is live).
 *
 * Mirrors the accepted returner-decision-timer-expiry / spa-nav-single-instance-law family already
 * in e2e/gen/; a promotable spec could reuse this recipe verbatim.
 */

const POSITION = "Mount Top" // a valid positions node land() can rig-start on
const COACHED_KEY = "bjj-neural-coached"
const BELT_ID: string = CURRICULUM.belts[0].id // "white"

test("lapsed returner (career + coached flag both seeded): the comeback landing never re-coaches and the clock runs immediately", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))

  const j = journey(page)
  // lapsedReturner == whiteBeltHolder: full white curriculum drilled + white belt won. boot() WIPES
  // storage first, so the persona blob rides the hash-seed but the coached flag does NOT.
  await j.boot("/", { initialState: lapsedReturner() })
  // THE PRESEED: set the coached flag AFTER the wipe, BEFORE land — a real returner who was coached
  // in a prior life presents exactly this (flag persisted alongside their career). maybeStartCoach
  // reads it synchronously at land time (app.src.jsx:4036).
  await page.evaluate((k) => localStorage.setItem(k, "1"), COACHED_KEY)
  // keepCoach: land deals options + arms the clock WITHOUT dismissing — if a coach had fired its beat
  // would be in the stream for us to catch. (For a suppressed coach there is nothing to dismiss.)
  await j.land(POSITION, { keepCoach: true })

  // ── the comeback landing happened and dealt a real hand ── (non-vacuity: the machine ran)
  await j.expectBeat("land")
  await j.expectBeat("options_dealt")
  const landed = await page.evaluate(
    (bid) => {
      const a = (window as any).__neural
      const d = a._decision
      const blob = a._progressBlob() // the authored save shape {v,prep,rec,units,belts,...}
      return {
        coach: !!a._coach, // must be falsy — the coach was never opened
        coachDone: a._coachDone === true, // latched true by the preset-flag early return (:4037)
        hasDecision: !!d,
        total: d ? d.total : 0, // ms
        remainingMs: d ? d.remaining : 0, // ms
        remainingSec: a.decisionRemaining(), // sec (remaining/1000)
        opts: (a.optionIdxs || []).length,
        beltWon: !!(blob.belts?.won || {})[bid], // the returner's career is genuinely present
        prepKeys: Object.keys(blob.prep || {}).length,
      }
    },
    BELT_ID,
  )
  expect(landed.opts, "the comeback hand actually dealt options (machine is live, not dead)").toBeGreaterThanOrEqual(1)
  expect(landed.hasDecision, "a decision window is armed on the comeback landing").toBe(true)

  // ── THE BREAK-DOESN'T-RESET PREMISE: the career is genuinely a lapsed returner's, so the
  // zero-coach result below is about onboarding memory, not an empty profile. ──
  expect(landed.beltWon, "the seeded white belt win is present — this is a decorated returner, not a fresh visitor").toBe(true)
  expect(landed.prepKeys, "the full white prep map ingested — a real career sits behind this landing").toBeGreaterThan(0)

  // ── SUPPRESSED, NOT OPENED: zero coach beats; the flags reflect the preset-flag early return. The
  // career blob is orthogonal — the guard keyed only on bjj-neural-coached, so the belt never mattered. ──
  const beats0 = (await j.beats()).map((b) => b.beat)
  expect(
    beats0.filter((b) => b === "coach_1").length,
    "already coached in a prior life ⇒ the coach never re-opens: ZERO coach_1 despite the career blob",
  ).toBe(0)
  expect(
    beats0.filter((b) => b === "coach_done").length,
    "no coach opened ⇒ finishCoach unreachable ⇒ ZERO coach_done (flag latched _coachDone directly at :4037)",
  ).toBe(0)
  expect(landed.coach, "_coach is falsy — the coach was never set (suppressed by the persisted flag, not frozen)").toBe(false)
  expect(landed.coachDone, "_coachDone latched true by the preset-flag early return at :4037").toBe(true)

  // ── LIVE CLOCK, NOT FROZEN: total is the full authored budget (>=9s), but the clock already ticked
  // a little during land()'s pump — remaining < total from the instant options were dealt. ──
  expect(landed.total, "decision window is the full authored budget (>=9s)").toBeGreaterThanOrEqual(9000)
  // CALIBRATION: suppressed ≠ frozen. remaining STRICTLY BELOW total ⇒ the clock is already running.
  expect(
    landed.remainingMs,
    "clock is LIVE from deal time: remaining < total (already ticking, not frozen at total)",
  ).toBeLessThan(landed.total)
  // …but only a little has drained — nothing expired during land(): remaining within 5s of the budget.
  expect(
    landed.remainingSec,
    "barely any time gone during land — nothing expired (remaining > total/1000 - 5s)",
  ).toBeGreaterThan(landed.total / 1000 - 5)

  // ── DRAINS UNDER A PLAIN ADVANCE: no dismissCoach needed — _coach is falsy so _tickDecision's guard
  // (:4317) falls through and the window drains. Snapshot r0 → advance 2s → r1. Same live-clock
  // threshold (>=1.5s drained over 2s) as guidance-defense.spec.ts. ──
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
  expect(
    r0 - r1.remainingSec,
    "clock drained ~2s under a plain advance — it was live from the comeback landing, not frozen",
  ).toBeGreaterThanOrEqual(1.5)
  expect(r1.decisionArmed, "the decision window is still armed after 2s (budget >=9s, no early auto_pick)").toBe(true)

  // ── the plain advance produced NO auto_pick and STILL never a coach beat ── (structural)
  const beats1 = (await j.beats()).map((b) => b.beat)
  expect(beats1.filter((b) => b === "auto_pick").length, "no auto_pick within the drained 2s (budget >=9s)").toBe(0)
  expect(beats1.filter((b) => b === "coach_1").length, "STILL zero coach_1 after the advance — never re-coached").toBe(0)
  expect(beats1.filter((b) => b === "coach_done").length, "STILL zero coach_done after the advance").toBe(0)

  // ── and the persisted onboarding flag is untouched at the end — the profile's once-per ritual is intact ──
  const flagAtEnd = await page.evaluate((k) => localStorage.getItem(k), COACHED_KEY)
  expect(flagAtEnd, "bjj-neural-coached is still '1' — the comeback neither cleared nor re-ran onboarding").toBe("1")

  expect(errors, "no pageerror across the preseed, the suppressed comeback landing, and the live clock").toEqual([])
})
