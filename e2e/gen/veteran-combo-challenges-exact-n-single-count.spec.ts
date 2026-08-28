/* @hyperspace {"theme":"challenges-and-belt-bar","L":"srs-veteran","F":"challenges","B":"economy-math"} @invariant "Combo challenges match their exact when-predicate n — one climb through ×2..×8 completes blue.combo-three and purple.combo-five once each, advances black.combo-seven-three by exactly one (the ×8 re-stamp never double-counts n===7), and mints the GODLIKE coin exactly once." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { srsVeteran } from "./personas"

/**
 * EXACT-N COMBO CHALLENGE MATCHING — the when-predicates are ===, not >=.
 * Source seams (verified at authoring, neural/src/):
 *   - challenge-definitions.src.js:271 blue.combo-three   (target 1, when p.n === 3)
 *   - challenge-definitions.src.js:278 purple.combo-five  (target 1, when p.n === 5)
 *   - challenge-definitions.src.js:285 brown.combo-seven  (target 1, when p.n === 7 — ALSO
 *     completes on the same ×7 beat as black's first tick; asserted alongside)
 *   - challenge-definitions.src.js:292 black.combo-seven-three (target 3, when p.n === 7 —
 *     the ×8 GODLIKE re-stamp carries n=8 and must MISS this predicate: no double-count)
 *   - challenge-definitions.src.js:348 coin godlike (event "combo", when p.n >= 7 — a
 *     candidate at BOTH n=7 and n=8; ngRewardChanges' `if (nextCoins[id]) continue` is the
 *     mint-once guard this spec pins)
 *   - challenge-engine.src.js ngAdvanceChallenges — +1 only on an exact ngMatches hit;
 *     app.src.jsx _comboUp (:4292) emits combo{n,name,mod} only from n>=2, so a clean
 *     8-answer climb reads ns [2..8] with ONE n===7 and ONE n===8.
 *
 * Persona premise: srsVeteran has stage:{} so EVERY landing asks (questionFor = first
 * cardStage<2 card) — 8 landings, 8 questions, 8 correct answers, ×1→×8 with zero breaks.
 * keepTutorial:true keeps the 20 White objectives live, so white-track challenge_completed
 * beats (white.answer, white.commit, ...) fire mid-climb — every count here is PER-ID,
 * never a global beat total.
 *
 * Determinism census: rig() APPENDS, so "max-moves" [0.99] queued BEFORE land() is consumed
 * by the intro roll ahead of land()'s own 0.5 → maxMoves = 12 (the route needs 7 picks).
 * land-mc-pick/land-mc-shuffle pre-sized at 64 cover all 8 landing questions (surface-scoped
 * land-mc-* tags — option ORDER is never asserted; truth is read from _mc.correct and
 * answered through the real keyboard surface, gated on _landPending so a pick can never
 * become an "ignored" break). Per hop: resolve [0.01] (success) + outcome [0.01] — resolve
 * success re-selects the calibrated SUCCESS outcome row (~:5164) regardless of the outcome
 * draw, so the destination is topology-determined.
 *
 * ROUTE is a hard-coded graph-verified 8-question chain (all role=top, found by in-page BFS
 * over optionsFor + calibrated success outcomes). Naive greedy hopping dead-ends (Mount Top
 * → 3-4 Mount Top → Consolidate Mount → High Mount Top has no forward tray). If an
 * occurrence/calibration wave rewrites outcomes, re-derive the chain via that BFS
 * (optionsFor(idx) under the simulated playerRole — myVal is role-dependent — following
 * resolveOutcomeTo(success outcome).idx/.role).
 *
 * Probe: CONFIRMED 2/2 green (13.5s/13.1s), fully REAL ×8 climb — no fx("combo") choke
 * fallback needed. Structure-only assertions: beat ns, per-id counts, challenge/coin state.
 */

const ROUTE = [
  "Inverted Triangle", // → ×2
  "Triangle to Omoplata", // → ×3  blue.combo-three
  "Omoplata to Back", // → ×4
  "Back Control to Crucifix", // → ×5  purple.combo-five
  "Crucifix to Mount", // → ×6
  "Mount to 3-4 Mount", // → ×7  brown.combo-seven + black +1 + GODLIKE mint
  "Consolidate Mount", // → ×8  re-stamp: black stays at 1, no second mint
] as const

test("one ×2..×8 climb: exact-n challenges complete once each, the ×8 re-stamp never double-counts black.combo-seven-three, GODLIKE mints once", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/", { initialState: srsVeteran(), keepTutorial: true })

  // queued BEFORE land() so the intro roll draws 0.99 → maxMoves 12 (rig appends; land()'s
  // own 0.5 sits behind it unused for this draw)
  await j.rig("max-moves", [0.99])
  await j.rig("land-mc-pick", Array(64).fill(0.37))
  await j.rig("land-mc-shuffle", Array(64).fill(0.51))

  await j.land("Triangle Escape Position Top")

  // ── instrumentation: boot-cumulative beat stream → everything is ns/counts per id ──
  const comboNs = (): Promise<number[]> =>
    page.evaluate(() =>
      (((window as any).__neural || {}).beats || [])
        .filter((b: any) => b.beat === "combo")
        .map((b: any) => b.n),
    )
  const beatCount = (name: string, id?: string) =>
    page.evaluate(
      ([n, i]) =>
        (((window as any).__neural || {}).beats || []).filter(
          (b: any) => b.beat === n && (i === null || b.id === i),
        ).length,
      [name, id ?? null] as const,
    )
  const ledger = () =>
    page.evaluate(() => {
      const a = (window as any).__neural
      return {
        combo: a._combo || 0,
        blue: a.challengeProgress("blue.combo-three"),
        purple: a.challengeProgress("purple.combo-five"),
        brown: a.challengeProgress("brown.combo-seven"),
        black: a.challengeProgress("black.combo-seven-three"),
        godlikeCoin: !!(a.coins && a.coins.godlike),
      }
    })

  // answer the live landing question like a user: keyboard A/B/C. Gated on _landPending
  // (the live-unanswered signal) because _mc lingers after an answer; asserting it cleared
  // guarantees the next pick can never break the streak as "ignored".
  const answerLanding = async () => {
    const mc = await page.evaluate(() => {
      const a = (window as any).__neural
      const m = a._mc
      return a._landPending && m && m.surface === "land" && typeof m.correct === "number"
        ? { correct: m.correct }
        : null
    })
    expect(mc, "landing question live (srsVeteran stage:{} — every landing asks)").toBeTruthy()
    await page.keyboard.press("abcd"[(mc as any).correct])
    const pending = await page.evaluate(() => !!(window as any).__neural._landPending)
    expect(pending, "answer registered — nothing left on the table for the pick to ignore").toBe(false)
  }

  // ── ×1 baseline: first correct answer, no announcer yet, every combo counter untouched ──
  await answerLanding()
  const base = await ledger()
  expect(base.combo, "combo at ×1 after the first correct answer").toBe(1)
  expect(await comboNs(), "no combo beat at ×1 — the announcer starts at ×2").toEqual([])
  expect(base.blue, "blue.combo-three baseline").toMatchObject({ progress: 0, done: false })
  expect(base.purple, "purple.combo-five baseline").toMatchObject({ progress: 0, done: false })
  expect(base.brown, "brown.combo-seven baseline").toMatchObject({ progress: 0, done: false })
  expect(base.black, "black.combo-seven-three baseline").toMatchObject({ progress: 0, done: false })
  expect(base.godlikeCoin, "no GODLIKE coin before the climb").toBe(false)

  // ── THE CLIMB: 7 rigged-success hops, the ledger read at every rung ──
  for (let hop = 0; hop < ROUTE.length; hop++) {
    const n = hop + 2 // the combo value this rung's correct answer reaches
    await j.rig("resolve", [0.01]) // < moveChance floor → success
    await j.rig("outcome", [0.01]) // consumed by drawOutcome; resolve re-selects the success row
    await j.pick(ROUTE[hop])
    await j.nextHand()
    await answerLanding()

    expect(await comboNs(), `one combo beat per rung through ×${n}`).toEqual(
      Array.from({ length: n - 1 }, (_, k) => k + 2),
    )
    const s = await ledger()
    expect(s.combo, `momentum at ×${n}`).toBe(n)
    // exact-n matching: each counter moves ONLY on its own n, then holds
    expect(s.blue, `blue.combo-three at ×${n} (fires only at n===3)`).toMatchObject({
      progress: n >= 3 ? 1 : 0,
      done: n >= 3,
    })
    expect(s.purple, `purple.combo-five at ×${n} (fires only at n===5)`).toMatchObject({
      progress: n >= 5 ? 1 : 0,
      done: n >= 5,
    })
    expect(s.brown, `brown.combo-seven at ×${n} (fires only at n===7)`).toMatchObject({
      progress: n >= 7 ? 1 : 0,
      done: n >= 7,
    })
    // THE CRUX at n=8: the GODLIKE re-stamp carries n=8, misses the n===7 predicate,
    // and black.combo-seven-three holds at exactly 1 of 3 — never 2
    expect(s.black, `black.combo-seven-three at ×${n} — exactly one n===7 tick, never done`).toMatchObject({
      progress: n >= 7 ? 1 : 0,
      done: false,
    })
    expect(s.godlikeCoin, `GODLIKE coin state at ×${n}`).toBe(n >= 7)
    expect(
      await beatCount("coin_earned", "godlike"),
      `GODLIKE mint count at ×${n} — candidate at both n=7 and n=8, minted at most once`,
    ).toBe(n >= 7 ? 1 : 0)
  }

  // ── SETTLE: the whole climb in the durable stream — nothing re-fires, nothing doubles ──
  await j.advance(3000)
  expect(await comboNs(), "the full climb: ns [2..8] exactly — one n===7, one ×8 re-stamp").toEqual([
    2, 3, 4, 5, 6, 7, 8,
  ])
  expect(await beatCount("combo_break"), "zero combo_break — the streak never broke").toBe(0)
  expect(
    await page.evaluate(
      () =>
        (((window as any).__neural || {}).beats || []).filter(
          (b: any) => b.beat === "land_q_answered" && b.correct === true,
        ).length,
    ),
    "eight correct landing answers built the eight-rung ladder",
  ).toBe(8)
  // per-id completion counts (keepTutorial → white-track completions also fire; never count globally)
  for (const [id, count] of [
    ["blue.combo-three", 1],
    ["purple.combo-five", 1],
    ["brown.combo-seven", 1],
    ["black.combo-seven-three", 0], // 1 of 3 — advanced, never completed
  ] as const) {
    expect(await beatCount("challenge_completed", id), `challenge_completed count for ${id}`).toBe(count)
  }
  expect(
    await beatCount("coin_earned", "godlike"),
    "still exactly ONE GODLIKE mint after settling — the mint-once guard held through the re-stamp",
  ).toBe(1)
  expect(
    await page.evaluate(() => Object.keys(((window as any).__neural || {}).coins || {})),
    "the GODLIKE coin sits in the collection",
  ).toContain("godlike")
})
