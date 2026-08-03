/* @hyperspace {"theme":"unlock-economy","L":"curriculum-mid","F":"belt-path","B":"economy-math"} @invariant "A lesson completes at exactly prep===goal (min(3, deckSize)): prep=goal-1 leaves lessonDone(key) false and zero lesson_done beats, the single crossing grade flips the predicate and emits exactly one lesson_done, and further grades never re-emit a second one." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { curriculumMid, CURRICULUM } from "./personas"

/**
 * Mechanism under test (neural/src/app.src.jsx): lessonDone(key) = prep[key] >= _deckGoal(key)
 * with _deckGoal = min(3, deckSize) (~line 2426). _maybeLessonDone (~2437) runs on EVERY grade
 * via noteCardDone — BEFORE the cross-deck cardDone dedupe — and its in-memory _lessonBeatFired
 * Set makes lesson_done once-only per deck per life; cross-deck shared-question credit bumps
 * OTHER decks' prep but never fires their lesson_done, so exact beat-count asserts are safe.
 * Two rails notes (v1.74 Challenges drift-fix — the Belt Path UI was replaced):
 *   (1) the Challenges view carries NO per-lesson done attribute (lesson buttons render a
 *       mastery crown, not a done flag), so the boundary is read off the app's own
 *       lessonDone(key) predicate — the beat census plus exact prep values are the teeth.
 *   (2) challenges_opened (renamed from path_opened in v1.74) fires once per life via
 *       _learningViewsTracked — expectBeat it exactly once.
 * No rigs beyond land()'s built-ins: the drill rail and the challenges render draw no RNG.
 */

const WHITE = CURRICULUM.belts[0]
const UNIT2 = WHITE.units[1]
// Mirror personas.ts curriculumMid EXACTLY: it seeds slice(0, ceil(n/2)) of unit-2 lessons at
// prep=3, so the BACK half of unit 2 boots with prep 0 — the exact-boundary candidates.
const SEEDED_N = Math.ceil(UNIT2.lessons.length / 2)
const CANDIDATES: string[] = UNIT2.lessons.slice(SEEDED_N).map((l: any) => l.deckKey)

test("lesson_done fires exactly once, at exactly prep===goal", async ({ page }) => {
  // curriculum fact the boundary math leans on — fail loudly here if the corpus shifts
  expect(CANDIDATES.length).toBeGreaterThan(0)

  const j = journey(page)
  await j.boot("/", { initialState: curriculumMid() })
  await j.land("Mount Top")

  // open the explorer's CHALLENGES view (curriculum loaded → challenges is the default mode)
  await page.evaluate(() => (window as any).__neural.toggleExplorer())
  await expect(page.locator("[data-view]").first()).toBeVisible()
  await j.expectBeat("challenges_opened") // once per life — asserted here and never again

  // pick the target IN-PAGE like the probe did: first candidate whose deck really has >= 3
  // cards and prep 0 — app state is truth; the curriculum-derived list scopes the hunt
  const target = await page.evaluate((cands) => {
    const a = (window as any).__neural
    for (const key of cands as string[]) {
      const deck = a.flashcards?.decks?.[key]
      if (deck && deck.cards.length >= 3 && !((a.prep && a.prep[key]) > 0)) {
        return { key, deckSize: deck.cards.length, goal: a._deckGoal(key) }
      }
    }
    return null
  }, CANDIDATES)
  expect(target, "an undrilled >=3-card lesson deck exists in white unit 2").toBeTruthy()
  const { key, goal } = target!
  expect(CANDIDATES).toContain(key)
  expect(goal).toBe(3) // min(3, deckSize) with deckSize >= 3

  const doneOf = () => page.evaluate((k) => !!(window as any).__neural.lessonDone(k), key)
  const prepOf = () => page.evaluate((k) => (window as any).__neural.prep[k] || 0, key)
  const lessonBeats = async () => (await j.beats()).filter((b) => b.beat === "lesson_done")

  // baseline: nothing has graded this life — zero lesson_done anywhere
  expect(await lessonBeats()).toHaveLength(0)

  // ONE BELOW THE BOUNDARY: prep=goal-1 — predicate not crossed, still zero beats
  await j.drill(goal - 1, key)
  expect(await prepOf()).toBe(goal - 1)
  expect(await doneOf(), "lessonDone(key) false at prep=goal-1").toBe(false)
  expect(await lessonBeats()).toHaveLength(0)

  // THE CROSSING: the single grade that lands prep exactly on goal
  await j.drill(1, key)
  expect(await prepOf()).toBe(goal)
  expect(await doneOf(), "lessonDone(key) crosses at prep===goal").toBe(true)
  const crossed = await lessonBeats()
  expect(crossed, "exactly one lesson_done at the crossing").toHaveLength(1)
  expect((crossed[0] as any).deckKey).toBe(key)
  expect((crossed[0] as any).unit).toBe(`${WHITE.id}/${UNIT2.id}`)
  expect((crossed[0] as any).belt).toBe(WHITE.id)

  // BEYOND: further grades bump prep past goal but never re-emit (_lessonBeatFired guard)
  await j.drill(2, key)
  expect(await prepOf()).toBe(goal + 2)
  expect(await doneOf(), "predicate stays crossed past goal").toBe(true)
  expect(await lessonBeats(), "still exactly one lesson_done").toHaveLength(1)

  // the crossing completed a LESSON only — no unit/checkpoint side effects ever fired
  const beats = await j.beats()
  expect(beats.filter((b) => b.beat === "unit_done")).toHaveLength(0)
  expect(beats.filter((b) => b.beat.startsWith("checkpoint"))).toHaveLength(0)
})
