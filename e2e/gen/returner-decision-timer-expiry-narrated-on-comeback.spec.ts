/* @hyperspace {"theme":"lifetime-journeys","L":"lapsed-returner","F":"decision-timer","B":"keyboard-timing"} @invariant "A returner who freezes on their first comeback hand gets a narrated auto-pick, not a silent teleport: letting the decision window expire emits expiry_warning then auto_pick, and cardsToday stays 0 across the expiry (an auto-picked option is not a graded card)." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { lapsedReturner, CURRICULUM } from "./personas"

/**
 * RETURNER DECISION-TIMER EXPIRY IS NARRATED — a lapsed white-belt holder comes back, freezes
 * on the very first hand of their comeback, and the app must NARRATE the timeout (3-2-1 warning
 * → visible auto-pick pop → the position advances) rather than silently teleporting. And because
 * an auto-picked option was never studied, the daily card counter must NOT move: cardsToday
 * stays 0 across the whole expiry, no day key is minted.
 *
 * Mechanism under test (neural/src/app.src.jsx, probe-verified against source):
 *   - The landing options deal builds the decision CLOCK (:4302):
 *       this._decision = { remaining: dsec*1000, total: dsec*1000, refunds:0, warned:0, pick, opts }
 *     with dsec = get("decisionSec",9) + (opts.length-1)*0.8 (:4289-4290) → total >= 9000ms for
 *     any hand (Mount Top ~11-12s). No onExpire is set on a LANDING window (that field is a
 *     defense-window-only thing), so expiry takes the auto_pick branch, not the "tapped" branch.
 *   - _tickDecision (:4306) EARLY-RETURNS while this._coach is set — the frozen-coach clock never
 *     ticks during land(); land() dismisses the coach only AFTER pumping options, so remaining ==
 *     total the instant the clock goes live (no drain happened yet).
 *   - As the window drains: at secLeft<=3 it fires fx("expiry_warning", {seconds}) once per second
 *     (d.warned dedup, :4322-4327); at remaining<=0 it fires fx("auto_pick", {}) (:4333) then
 *     weighted-pool selects via this.rng("auto-pick") (:4335) and pick()s — enterAttempt fires
 *     fx("commit", ...) (:4340). So the ORDER expiry_warning → auto_pick → commit is the narration.
 *   - noteCardDone (:840) is the ONLY writer of cardsToday / _days; the auto-pick path
 *     (pick → enterAttempt → travel) never calls it, so cardsToday cannot move on a timeout.
 *
 * Determinism (house rails): the weighted-pool auto-pick draws this.rng("auto-pick"); UNRIGGED it
 * falls through to the ungated Math.random PRNG (a rails violation). j.rig("auto-pick",[0]) pins the target and
 * keeps every draw deterministic. land() already rigs the intro ambient draws (ai-skill/role/
 * max-moves); no other RNG site is touched on the expiry path.
 *
 * Persona validity: a silently-fresh visitor ALSO boots with cardsToday 0 and no _days key, so a
 * bare "cardsToday==0" would pass vacuously on a broken ingest. The boot read first proves the
 * returner's career actually seeded (belts.won[whiteId] + non-empty prep) — this is the returner's
 * FIRST comeback hand, not a fresh boot masquerading as one.
 */

const WHITE: any = CURRICULUM.belts[0]

test("returner freeze on comeback hand → narrated auto_pick (warning→pick→commit), cardsToday stays 0", async ({ page }) => {
  const j = journey(page)
  await j.boot("/", { initialState: lapsedReturner() })
  // Pin the auto-pick target BEFORE the window can expire — the weighted pool select reads
  // this.rng("auto-pick"); unrigged it violates the house no-Math.random rail.
  await j.rig("auto-pick", [0])
  // "Mount Top" (space, matches node.t) — land() rigs the intro draws and dismisses the coach
  // AFTER dealing options, so post-land the clock is live and the hand is real.
  await j.land("Mount Top")
  await j.expectBeat("land")
  await j.expectBeat("options_dealt")

  // ── persona-ingested guards + a live, un-drained decision window (the returner's comeback hand) ──
  const boot = await page.evaluate((whiteId) => {
    const a = (window as any).__neural
    const d = a._decision
    return {
      wonWhite: !!(a.belts && a.belts.won && a.belts.won[whiteId as string]),
      prepDecks: Object.keys(a.prep || {}).length,
      cardsToday: a.cardsToday,
      dayKeys: Object.keys(a._days || {}),
      hasDecision: !!d,
      total: d ? d.total : 0,
      remaining: d ? d.remaining : 0,
      opts: (a.optionIdxs || []).length,
    }
  }, WHITE.id)
  expect(boot.wonWhite, `persona ingested: belts.won["${WHITE.id}"] present (rules out a silently-fresh boot)`).toBe(true)
  expect(boot.prepDecks, "persona ingested: prep carries the returner's drilled decks").toBeGreaterThan(0)
  expect(boot.opts, "the comeback hand actually dealt options").toBeGreaterThanOrEqual(1)
  expect(boot.hasDecision, "a live decision window is armed on the first comeback hand").toBe(true)
  // total = decisionSec(9)*1000 + (opts-1)*800 → >= 9000ms for any hand; and the frozen-coach
  // clock never ticked during land, so remaining == total the instant it goes live.
  expect(boot.total, "decision window is the full authored budget (>=9s)").toBeGreaterThanOrEqual(9000)
  expect(boot.remaining, "clock un-drained at hand-off (coach froze it through land)").toBe(boot.total)
  expect(boot.cardsToday, "comeback boots at a clean daily zero").toBe(0)
  expect(boot.dayKeys, "no day key exists before any graded card").toEqual([])

  // ── FREEZE: pump sim time past the window without ever picking. advance() sub-ticks at 16.6ms
  //    so the per-second 3-2-1 warnings register at fine granularity; cap 20000ms is well above
  //    Mount Top's ~11-12s window. advanceUntil stops the instant auto_pick fires. ──
  await j.advanceUntil("auto_pick", 20000, 500)

  // ── the NARRATION, asserted on beat ORDER (indices), never on text ──
  const beats = await j.beats()
  const seq = beats.map((b: any) => b.beat)
  const iWarn = seq.indexOf("expiry_warning")
  const iAuto = seq.indexOf("auto_pick")
  const iCommit = seq.indexOf("commit")
  expect(iWarn, "a 3-2-1 expiry_warning was narrated before the timeout").toBeGreaterThanOrEqual(0)
  expect(iAuto, "the timeout fired an auto_pick (never a silent teleport)").toBeGreaterThanOrEqual(0)
  expect(iWarn, "expiry_warning PRECEDES auto_pick — the user was warned before the pick").toBeLessThan(iAuto)
  expect(iCommit, "commit PRESENT — the auto-pick actually advanced the position (no silent freeze)").toBeGreaterThanOrEqual(0)
  expect(iAuto, "auto_pick precedes the commit it drives").toBeLessThan(iCommit)

  // warning is fired at secLeft in {1,2,3} — structural, off the beat's own prop, not any label text
  const warnSeconds = beats
    .filter((b: any) => b.beat === "expiry_warning")
    .map((b: any) => b.seconds)
  expect(warnSeconds.length, "at least one countdown warning was emitted").toBeGreaterThanOrEqual(1)
  for (const s of warnSeconds) expect([1, 2, 3], "each warning counts down within the last 3 seconds").toContain(s)

  // ── the invariant's other half: an auto-picked option is NOT a graded card ──
  const after = await page.evaluate(() => {
    const a = (window as any).__neural
    return { cardsToday: a.cardsToday, dayKeys: Object.keys(a._days || {}), decision: a._decision }
  })
  expect(after.cardsToday, "cardsToday STAYS 0 across the expiry — an auto-pick is not a graded card").toBe(0)
  expect(after.dayKeys, "no day key minted by the auto-pick (noteCardDone was never called)").toEqual([])
  expect(after.decision, "decision window consumed — the hand is resolved, not silently re-armed").toBeNull()
})
