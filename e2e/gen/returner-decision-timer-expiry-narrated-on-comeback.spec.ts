/* @hyperspace {"theme":"lifetime-journeys","L":"lapsed-returner","F":"decision-timer","B":"keyboard-timing"} @invariant "A returner who freezes on their first comeback hand's question gets a NARRATED reveal, never a move made for them: the question clock waits for their first interaction, then runs the full returner window (no first-session grace), emits expiry_warning then land_q_expired, leaves the hand live with no commit, and cardsToday stays 0 across the expiry (a revealed-unanswered card is a failed SRS review, never a graded card)." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { lapsedReturner, CURRICULUM } from "./personas"

/**
 * RETURNER DECISION-TIMER EXPIRY IS NARRATED — a lapsed white-belt holder comes back, freezes
 * on the very first hand of their comeback, and the app must NARRATE the timeout (3-2-1 warning
 * → the answer revealed as a miss) rather than silently acting. And because a revealed card was
 * never answered, the daily card counter must NOT move: cardsToday stays 0 across the whole
 * expiry, no day key is minted.
 *
 * RETARGETED (gen-triage, v1.206.x) — three deliberate changes moved this spec's mechanism, and
 * each claim now rides its successor:
 *   - v1.129.0 (7677bfe70) retired `auto_pick`; v1.133.0 (e6f655a6a) retired the hand clock.
 *     Owner: "when the clock runs out, the algorithm doesn't choose for you. You still choose."
 *     The clock times the QUESTION (`_armLandClock` on mount); expiry (`_expireLandQ`) reveals
 *     the answer as a miss and the HAND STAYS LIVE. So "warning → auto_pick → commit" is now
 *     "warning → land_q_expired, and NO commit" — the same "never a silent teleport" claim,
 *     strengthened: nothing moves the returner at all.
 *   - v1.104.0 (bb80a008c) deleted the first-roll coach, which used to freeze the clock through
 *     land() ("clock un-drained at hand-off"). Its successor is v1.137.0 (d3bcb63d3), owner:
 *     "a first-time Guest can land on TOO SLOW · −4% before ever interacting" — no window arms
 *     until the first REAL interaction (`_engage`) AND the card is visible. So this spec lands
 *     WITHOUT j.land()'s engage (j.land() always ends with one), proves the window is PARKED
 *     while nobody has touched anything, then engages with the same two corner mouse-moves the
 *     DSL uses and reads the window at the instant it arms: remaining === total, exactly.
 *   - "decision window consumed — the hand is resolved" inverts: the window is consumed
 *     (remaining null, decisionRemaining() 0) but the hand is NOT resolved — it is still dealt.
 *
 * Mechanism under test (neural/src/app.src.jsx):
 *   - the landing deal builds `_decision = { remaining: null, total: null, warned: 0, pick, opts }`
 *     — disarmed; `_mountLandQ` asks `_armLandClock`, which PARKS (`_cwArm`) until `_clockGate()`.
 *   - `_armLandClock`: total = decisionSec × (returning ? 1 : 1.5) — a returner gets full pressure.
 *   - `_tickDecision`: fx("expiry_warning",{seconds}) once per second at secLeft<=3, then
 *     `_expireLandQ` → fx("land_q_expired",{deckKey}), a failed SRS review (`_schedule(…,false)`).
 *   - noteCardDone is the ONLY writer of cardsToday / _days; the expiry path never calls it.
 *
 * Determinism: the expiry path draws nothing. The land steps below are j.land()'s own (rigs for
 * ai-skill/role/max-moves, the rigStart rail, the 1s pump until the hand is up, landQuestion())
 * minus the engage — j.land() cannot be used here because engagement is a one-way latch.
 *
 * Persona validity: a silently-fresh visitor ALSO boots with cardsToday 0 and no _days key, so a
 * bare "cardsToday==0" would pass vacuously on a broken ingest. The boot read first proves the
 * returner's career actually seeded (belts.won[whiteId] + non-empty prep) — and the srs write
 * proves the expiry really touched a card, so "cardsToday stays 0" is a distinction, not a no-op.
 */

const WHITE: any = CURRICULUM.belts[0]

test("returner freeze on comeback hand → clock waits for engagement, then narrated reveal (warning→land_q_expired), no move made for them, cardsToday stays 0", async ({ page }) => {
  const j = journey(page)
  await j.boot("/", { initialState: lapsedReturner() })

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

  // ── persona-ingested guards + the comeback hand, its question up, and NO clock running ──
  const boot = await page.evaluate((whiteId) => {
    const a = (window as any).__neural
    const d = a._decision
    return {
      wonWhite: !!(a.belts && a.belts.won && a.belts.won[whiteId as string]),
      prepDecks: Object.keys(a.prep || {}).length,
      cardsToday: a.cardsToday,
      dayKeys: Object.keys(a._days || {}),
      hasDecision: !!d,
      engaged: !!a._engaged,
      remaining: d ? d.remaining : "no-decision",
      parked: !!a._cwArm,
      asks: !!(a._mc && a._mc.surface === "land"),
      opts: (a.optionIdxs || []).length,
      returning: a._returningVisitor(),
      base: a.get("decisionSec", 9) * 1000,
    }
  }, WHITE.id)
  expect(boot.wonWhite, `persona ingested: belts.won["${WHITE.id}"] present (rules out a silently-fresh boot)`).toBe(true)
  expect(boot.prepDecks, "persona ingested: prep carries the returner's drilled decks").toBeGreaterThan(0)
  expect(boot.returning, "a seeded career is a RETURNING visitor — full pressure, no grace").toBe(true)
  expect(boot.opts, "the comeback hand actually dealt options").toBeGreaterThanOrEqual(1)
  expect(boot.hasDecision, "a decision context is armed on the first comeback hand").toBe(true)
  expect(boot.asks, "and its landing question is on the table").toBe(true)
  // v1.137.0 — the successor of the deleted coach's freeze: ~10s of land() pumping, no clock
  expect(boot.engaged, "nobody has touched anything yet").toBe(false)
  expect(boot.remaining, "no window runs before the returner engages").toBeNull()
  expect(boot.parked, "the arm is parked, waiting for them").toBe(true)
  expect(boot.cardsToday, "comeback boots at a clean daily zero").toBe(0)
  expect(boot.dayKeys, "no day key exists before any graded card").toEqual([])

  // ── the first REAL interaction (dsl.engage()'s two corner moves, without its pump) ──
  await page.mouse.move(4, 4)
  await page.mouse.move(6, 6)
  const armed = await page.evaluate(() => {
    const d = (window as any).__neural._decision
    return { total: d ? d.total : 0, remaining: d ? d.remaining : 0 }
  })
  // total = decisionSec(9) × 1 (returner) → >= 9000ms; armed at the interaction, nothing drained
  expect(armed.total, "decision window is the full authored budget (>=9s)").toBeGreaterThanOrEqual(9000)
  expect(armed.total, "the returner's window carries no first-session grace").toBe(boot.base)
  expect(armed.remaining, "clock un-drained at hand-off (it armed at the returner's first interaction)").toBe(armed.total)

  // ── FREEZE: pump sim time past the window without ever picking. advance() sub-ticks at 16.6ms
  //    so the per-second 3-2-1 warnings register; cap 20000ms is well above the 9s window. ──
  await j.advanceUntil("land_q_expired", 20000, 500)

  // ── the NARRATION, asserted on beat ORDER (indices), never on text ──
  const beats = await j.beats()
  const seq = beats.map((b: any) => b.beat)
  const iWarn = seq.indexOf("expiry_warning")
  const iExp = seq.indexOf("land_q_expired")
  expect(iWarn, "a 3-2-1 expiry_warning was narrated before the timeout").toBeGreaterThanOrEqual(0)
  expect(iExp, "the timeout is a named reveal (land_q_expired), never a silent act").toBeGreaterThanOrEqual(0)
  expect(iWarn, "expiry_warning PRECEDES land_q_expired — the user was warned first").toBeLessThan(iExp)
  expect(seq.filter((b) => b === "commit").length, "NO commit — the clock never chooses a move for the returner").toBe(0)
  expect(seq, "the retired auto-pick never fires").not.toContain("auto_pick")

  // warning is fired at secLeft in {1,2,3} — structural, off the beat's own prop, not any label text
  const warnSeconds = beats
    .filter((b: any) => b.beat === "expiry_warning")
    .map((b: any) => b.seconds)
  expect(warnSeconds.length, "at least one countdown warning was emitted").toBeGreaterThanOrEqual(1)
  for (const s of warnSeconds) expect([1, 2, 3], "each warning counts down within the last 3 seconds").toContain(s)

  // ── the invariant's other half: a revealed card is a failed REVIEW, never a graded card ──
  const expKey = (beats[iExp] as any).deckKey
  const after = await page.evaluate((key) => {
    const a = (window as any).__neural
    const d = a._decision
    return {
      cardsToday: a.cardsToday,
      dayKeys: Object.keys(a._days || {}),
      srsRows: Object.keys((a.srs && a.srs[key]) || {}).length,
      windowLeft: d ? d.remaining : "no-decision",
      secondsLeft: a.decisionRemaining(),
      hand: (a.optionIdxs || []).length,
      handLive: !!(d && d.opts && d.opts.length && typeof a._optPick === "function"),
      revealed: !!document.querySelector("[data-land-q] [data-mc-result='correct']"),
    }
  }, expKey)
  expect(expKey, "the expiry names the deck whose card it revealed").toBeTruthy()
  expect(after.srsRows, "the revealed card WAS scheduled — a failed SRS review (the expiry touched it)").toBeGreaterThanOrEqual(1)
  expect(after.cardsToday, "cardsToday STAYS 0 across the expiry — a revealed card is not a graded card").toBe(0)
  expect(after.dayKeys, "no day key minted by the expiry (noteCardDone was never called)").toEqual([])
  expect(after.windowLeft, "the question window is consumed — not silently re-armed").toBeNull()
  expect(after.secondsLeft, "no time left on any clock").toBe(0)
  expect(after.revealed, "the answer is on the table").toBe(true)
  expect(after.hand, "the hand is NOT resolved — every comeback option is still dealt").toBe(boot.opts)
  expect(after.handLive, "and still pickable: the returner chooses, untimed").toBe(true)
})
