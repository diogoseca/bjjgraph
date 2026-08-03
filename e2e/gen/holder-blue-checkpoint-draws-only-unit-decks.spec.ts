/* @hyperspace {"theme":"unlock-economy","L":"white-belt-holder","F":"checkpoint-quiz","B":"guard-limit"} @invariant "A checkpoint quiz sources cards only from its OWN unit's lesson decks: blue unit-1's quiz presents cards whose deckKeys all belong to blue u1's lessons and zero cards from any white deck, despite the holder's full white mastery sitting in the same blob." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { whiteBeltHolder, CURRICULUM } from "./personas"

/**
 * BLUE CHECKPOINT DRAWS ONLY FROM ITS OWN UNIT'S DECKS — a white-belt holder carries 32
 * fully-mastered white decks in the same progress blob, then sits blue unit 1's checkpoint.
 * The quiz pool must be PURE: every pick's deckKey is one of blue u1's own lesson decks,
 * and not one card leaks in from the (much larger, much better-drilled) white corpus.
 *
 * Seams under test (probe-verified 2x green ~3s/run + red-proof, deterministic; probe
 * file deleted):
 *   - startCheckpoint (app.src.jsx:3467-3472) builds the pool ONLY by iterating
 *     unit.lessons' decks (mcClip-able cards); each pick = {card, key}. There is no
 *     cross-unit or mastery-weighted source — the blob foil can only leak if that loop
 *     regresses.
 *   - lessonDone gate (:3466) bails with a "Checkpoint locked" toast unless every live
 *     u1 lesson is drilled to goal — so the seed adds prep=3 AND rec=3 for u1's 6 decks
 *     on top of whiteBeltHolder(); _deckGoal (:2426) = min(3, deckSize), so 3 always
 *     suffices.
 *   - _checkpointShow (:3477+) presents each pick on the drill surface with
 *     _posKey = pick.key — corroborating per card that what the USER faces is the
 *     picked deck, not just what the internal queue claims.
 *
 * Determinism: rng(tag) falls back to Math.random when a queue drains, so queue DEPTH is
 * the determinism — checkpoint-pick consumes one draw per pick (rigged cards+2), mc-pick
 * pooling rejections consume ~220 draws per 6-card quiz (observed), mc-shuffle ~60. All
 * keys/counts derive from the served curriculum fixture — blue u1 is
 * "blue/takedowns-and-standing" at authoring, checkpoint {cards:6, pass:5}, and its 6
 * deckKeys are disjoint from all 32 white deckKeys (asserted, so purity is non-vacuous).
 *
 * v1.70 re-validation: the seed sets settings.landQuestions=false (the real Settings →
 * Rolling toggle). The v1.68 question-first landing otherwise mounts ONE landing MC at
 * land() (surface "land", unrigged land-mc-* draws) and fires an extra mc_shown beat,
 * inflating the strict censuses below (6 → 7). The checkpoint deal itself is unchanged:
 * startCheckpoint still deals min(unit.checkpoint.cards, pool) = the authored 6.
 */

const WHITE = CURRICULUM.belts[0]
const BLUE = CURRICULUM.belts[1]
const U1 = BLUE.units[0]
const U1_KEY = `${BLUE.id}/${U1.id}`
const U1_DECKS: string[] = U1.lessons.map((l: any) => l.deckKey)
const WHITE_DECKS: string[] = WHITE.units.flatMap((u: any) => u.lessons.map((l: any) => l.deckKey))
const CP = U1.checkpoint

/** deterministic rig-queue filler (LCG) — pre-sized, never Math.random */
const seq = (seed: number, n: number): number[] => {
  const out: number[] = []
  let s = seed >>> 0
  for (let i = 0; i < n; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    out.push(s / 4294967296)
  }
  return out
}

test("blue u1 checkpoint pool is pure: every pick from u1's own decks, zero white pollution", async ({ page }) => {
  // ── curriculum facts the purity claim leans on — fail loudly here if the corpus shifts ──
  expect(CP && CP.cards, "blue u1 defines a checkpoint quiz").toBeGreaterThan(0)
  expect(CP.cards, "rig queues below are pre-sized to the authored draw count").toBe(6)
  expect(CP.pass, "pass bar achievable within the quiz (truth-rail 6/6 passes)").toBeLessThanOrEqual(CP.cards)
  expect(U1_DECKS.length, "blue u1 defines lessons").toBeGreaterThan(0)
  expect(new Set(U1_DECKS).size, "u1 deckKeys distinct").toBe(U1_DECKS.length)
  expect(
    U1.lessons.every((l: any) => (l.frames || []).includes("gi") && (l.frames || []).includes("nogi")),
    "every u1 lesson is live in both frames — the pool and the lessonDone gate span all 6 decks",
  ).toBe(true)
  expect(WHITE_DECKS.length, "white corpus non-empty — the foil is real (32 decks at authoring)").toBeGreaterThan(0)
  expect(new Set(WHITE_DECKS).size, "white deckKeys distinct").toBe(WHITE_DECKS.length)
  expect(
    U1_DECKS.filter((k) => WHITE_DECKS.includes(k)),
    "white ∩ blue-u1 = ∅ — purity below is non-vacuous",
  ).toEqual([])

  const j = journey(page)
  // seed = full white mastery (the foil) + blue u1 drilled to goal (opens the checkpoint:
  // startCheckpoint's lessonDone gate at :3466 would otherwise bail with a locked toast)
  const seed: any = whiteBeltHolder()
  for (const dk of U1_DECKS) {
    seed.prep[dk] = 3
    seed.rec[dk] = 3
  }
  // v1.68 landing question off at the source — keeps every mc_* census below scoped to
  // the checkpoint quiz alone (see header)
  seed.settings.landQuestions = false
  await j.boot("/", { initialState: seed })
  await j.land("Mount Top")

  // ── blob foil in place: the LIVE app ingested full white mastery alongside blue u1 ──
  const whitePrep: number[] = await page.evaluate(
    (keys) => (keys as string[]).map((k) => ((window as any).__neural.prep || {})[k] || 0),
    WHITE_DECKS,
  )
  expect(
    whitePrep.every((v) => v >= 3),
    "every white deck sits at prep>=3 in live state — the pollution source is loaded",
  ).toBe(true)

  // rig every draw the sitting consumes (depth IS the determinism — see header note)
  await j.rig("checkpoint-pick", seq(7, CP.cards + 2))
  await j.rig("mc-pick", seq(21, 220))
  await j.rig("mc-shuffle", seq(42, 60))

  // ── open the path and start the quiz from the REAL checkpoint row ──
  await page.evaluate(() => (window as any).__neural.toggleExplorer())
  await expect(page.locator("[data-view]").first()).toBeVisible()
  expect(
    await page.locator(`[data-unit="${U1_KEY}"]`).first().getAttribute("data-locked"),
    "blue u1 unlocked for a white-belt holder (precondition)",
  ).toBeNull()
  expect(
    await page.locator(`[data-checkpoint="${U1_KEY}"]`).first().getAttribute("data-done"),
    "checkpoint not yet passed",
  ).toBeNull()
  await page.locator(`[data-checkpoint="${U1_KEY}"]`).first().click() // auto-closes the explorer
  await j.advance(400)
  await j.expectBeat("checkpoint_start")
  const start = ((await j.beats()) as any[]).filter((b) => b.beat === "checkpoint_start").pop() as any
  expect(start.unit, "quiz targets blue u1").toBe(U1_KEY)
  expect(start.cards, "quiz deals the authored count — u1's decks alone hold >= 6 quizzable cards").toBe(CP.cards)

  // ── THE INVARIANT: the full pick queue, read at start, is pure ──
  const queue: string[] = await page.evaluate(() =>
    (window as any).__neural._checkpoint.picks.map((p: any) => p.key),
  )
  expect(queue.length, "live quiz holds the full pick set").toBe(CP.cards)
  expect(
    queue.filter((k) => !U1_DECKS.includes(k)),
    "every pick's deckKey belongs to blue u1's own lessons",
  ).toEqual([])
  expect(
    queue.filter((k) => WHITE_DECKS.includes(k)),
    "zero picks from any white deck — full white mastery never leaks into the pool",
  ).toEqual([])

  // ── walk all 6 cards: the deck the USER faces per card is the picked deck, in order ──
  const walked: string[] = []
  for (let i = 0; i < CP.cards; i++) {
    const st = await page.evaluate(() => {
      const a = (window as any).__neural
      return {
        cursor: a._checkpoint ? a._checkpoint.i : null,
        posKey: a._posKey,
        correct: a._mc ? a._mc.correct : null,
      }
    })
    expect(st.cursor, `cursor sits at card ${i + 1}`).toBe(i)
    expect(st.posKey, `card ${i + 1}: drill surface presents the picked deck`).toBe(queue[i])
    expect(typeof st.correct, `card ${i + 1}: MC truth rail live`).toBe("number")
    walked.push(st.posKey as string)
    await page.locator("[data-mc-opt]").nth(st.correct as number).click()
    await j.advance(700)
  }
  expect(walked, "presented order equals the pick-queue order — no mid-quiz re-sourcing").toEqual(queue)

  // ── closing census: a clean 6/6 pass, every beat accounted for ──
  const beats = (await j.beats()) as any[]
  const names = beats.map((b) => b.beat)
  expect(names.filter((n) => n === "mc_shown").length, "every quiz card presented exactly once").toBe(CP.cards)
  expect(names.filter((n) => n === "mc_correct").length, "every truth-rail answer landed").toBe(CP.cards)
  expect(names.filter((n) => n === "mc_wrong").length, "no accidental wrong answer").toBe(0)
  const passed = beats.filter((b) => b.beat === "checkpoint_passed")
  expect(passed.length, "exactly one checkpoint_passed").toBe(1)
  expect(passed[0].unit, "pass beat names blue u1").toBe(U1_KEY)
  expect(passed[0].firstTry, "6/6 first-try clears the authored pass bar").toBe(CP.cards)
  expect(passed[0].of, "pass beat carries the quiz size").toBe(CP.cards)
  expect(
    await page.evaluate(() => !!(window as any).__neural._checkpoint),
    "quiz resolved and cleared — no dangling state",
  ).toBe(false)
})
