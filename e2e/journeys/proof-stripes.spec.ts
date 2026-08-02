import { test, expect } from "@playwright/test"
import { journey } from "../dsl"

/**
 * P4 — DEGREES AS ONE SCORE.
 *
 * Every technique carries a WEIGHT: how often a roll actually passes through it, read off the
 * graph's stationary distribution at build time. Your standing is the frequency-weighted average
 * of how well you know them:
 *
 *     score = Σ (weight_i × mastery_i),   Σ weight_i = 1
 *
 * Nothing is cut — a rare technique still counts, proportionally to how rare it is. Per-deck
 * mastery is min(stage,3)/3, so a multiple-choice answer is worth 2/3 of a card: recognition
 * alone tops out at 0.67, which is enough for purple and never enough for brown or black.
 * Recall is the only route past 0.7, by construction.
 *
 * Belts: white .20 · blue .40 · purple .60 · brown .70 · black .80
 * Rails: __neural.gameScore(), .beltProof(belt), .deckMastery(key), .BELT_SCORE, curriculum.weights
 * Surfaces: [data-score-row] [data-game-score] [data-stripes]
 */

/** drive one real deck to a known mastery with everything else weighted out */
const soloDeck = (page: any) =>
  page.evaluate(() => {
    const a = (window as any).__neural
    const key = Object.keys(a.flashcards.decks).find(
      (k: string) => ((a.flashcards.decks[k] || {}).cards || []).length >= 3,
    )!
    a.curriculum.weights = { [key]: 1 }
    a.stage = {}
    a._stageVer = (a._stageVer || 0) + 1
    const cold = a.gameScore()
    const cards = a.flashcards.decks[key].cards
    for (const c of cards) a._bumpStage(key, c.q, 2, 2) // every card recognised (MC caps at 2)
    const recognised = a.gameScore()
    for (const c of cards) a._bumpStage(key, c.q, 1) // and then proven by recall (stage 3)
    const recalled = a.gameScore()
    return { cold, recognised, recalled }
  })

test("the score is frequency-weighted mastery: 0 knowing nothing, 1 proving the game", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  const o = await soloDeck(page)
  expect(o.cold.score, "knowing nothing scores zero").toBe(0)
  expect(o.recalled.score, "proving everything by recall scores one").toBeCloseTo(1, 3)
})

test("recognition tops out at two thirds — recall is the only route to brown and black", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  const o = await soloDeck(page)
  expect(o.recognised.score, "multiple choice is worth 2/3 of a card").toBeCloseTo(2 / 3, 3)
  expect(o.recognised.belt, "which reaches purple").toBe("purple")
  expect(o.recognised.next, "and stalls there").toBe("brown")
  expect(o.recalled.belt, "recall carries you the rest of the way").toBe("black")
})

test("belts are thresholds on that one number", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  const bands = await page.evaluate(() => (window as any).__neural.BELT_SCORE)
  expect(bands).toEqual([
    ["white", 0.2],
    ["blue", 0.4],
    ["purple", 0.6],
    ["brown", 0.7],
    ["black", 0.8],
  ])

  // stripes read as progress through the belt's OWN band: passed belts full, current partial
  const stripes = await page.evaluate(() => {
    const a = (window as any).__neural
    const key = Object.keys(a.flashcards.decks).find(
      (k: string) => ((a.flashcards.decks[k] || {}).cards || []).length >= 3,
    )!
    a.curriculum.weights = { [key]: 1 }
    a.stage = {}
    a._stageVer = (a._stageVer || 0) + 1
    for (const c of a.flashcards.decks[key].cards) a._bumpStage(key, c.q, 2, 2) // score ≈ 0.667
    const by: Record<string, number> = {}
    for (const b of a.curriculum.belts) by[b.id] = a.beltProof(b).stripes
    return { by: by, score: a.gameScore().score }
  })
  expect(stripes.score).toBeCloseTo(2 / 3, 3)
  expect(stripes.by.white, "white is behind us").toBe(4)
  expect(stripes.by.blue, "so is blue").toBe(4)
  expect(stripes.by.purple, "purple is met").toBe(4)
  expect(stripes.by.brown, "brown is part-way through the 0.60→0.70 band").toBe(2)
  expect(stripes.by.black, "black untouched").toBe(0)
})

test("the score is display-only — it gates nothing", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  const out = await page.evaluate(() => {
    const a = (window as any).__neural
    a.stage = {}
    a.rec = {}
    a._stageVer = (a._stageVer || 0) + 1
    return {
      belt: a.gameScore().belt,
      whiteUnlocked: a.beltUnlocked(0), // the first belt is always open
      lessonsExist: !!a.openLessonStudy,
    }
  })
  expect(out.belt, "no belt standard met").toBeNull()
  expect(out.whiteUnlocked, "and the path is still fully playable").toBe(true)
  expect(out.lessonsExist).toBe(true)
})

test("the path shows the score and every belt's stripes", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  await page.evaluate(() => {
    const a = (window as any).__neural
    a.setViewMode("path")
    a.openExplorer()
    a.renderExplorer()
  })

  await expect(page.locator("[data-score-row]"), "one number above the ladder").toBeVisible()
  expect(
    await page.locator("[data-stripes]").count(),
    "one stripe group per belt",
  ).toBeGreaterThanOrEqual(5)
})

test("the shipped curriculum carries stationary technique weights", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  const w = await page.evaluate(() => ((window as any).__neural.curriculum || {}).weights || null)
  expect(w, "build emitted curriculum.weights").toBeTruthy()
  const keys = Object.keys(w)
  expect(keys.length, "every technique keeps a weight — nothing is cut").toBeGreaterThan(1000)
  expect(keys.every((k) => k.endsWith("|Attacker"))).toBe(true)
  const sum = keys.reduce((s, k) => s + w[k], 0)
  expect(sum, "and they are a distribution").toBeCloseTo(1, 4)
})
