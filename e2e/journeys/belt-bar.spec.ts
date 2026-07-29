import { test, expect } from "@playwright/test"
import { journey } from "../dsl"

/**
 * P5 — THE BELT BAR + CROWNED LESSONS.
 *
 * One vertical meter for the whole game. The fill rises with the score and takes the colour of
 * the highest belt you have MET; the outline flips to white once that belt is black. Markers sit
 * at each threshold, and a bright line marks exactly where you are — a line that can fall back
 * below a marker, because a wrong answer drops a card's stage (forgetting is tested, not timed).
 *
 * Lessons carry a crown 0-4 driven by the SAME deckMastery that feeds the belt score, so
 * grinding a bubble to gold is literally what moves your belt — one system, not two scoreboards.
 *
 * Surfaces: [data-belt-track] [data-belt-fill] [data-belt-mark] [data-met] [data-you-are-here]
 *           [data-belt-label] [data-crown] [data-score-row] [data-game-score]
 */

const openPath = (page: any) =>
  page.evaluate(() => {
    const a = (window as any).__neural
    a.setViewMode("path")
    a.openExplorer()
    a.renderExplorer()
  })

/** weight the whole score onto one real deck so the bar is drivable */
const soloWeight = (page: any) =>
  page.evaluate(() => {
    const a = (window as any).__neural
    const key = Object.keys(a.flashcards.decks).find(
      (k: string) => ((a.flashcards.decks[k] || {}).cards || []).length >= 3,
    )!
    a.curriculum.weights = { [key]: 1 }
    a.stage = {}
    a._stageVer = (a._stageVer || 0) + 1
    return key
  })

const setMastery = (page: any, key: string, stage: number) =>
  page.evaluate(
    ([k, s]) => {
      const a = (window as any).__neural
      a.stage = {}
      a._stageVer = (a._stageVer || 0) + 1
      for (const c of a.flashcards.decks[k as string].cards)
        a._bumpStage(k as string, c.q, s as number, s as number)
      return a.gameScore().score
    },
    [key, stage] as const,
  )

test("the bar fills to your score and marks every belt threshold", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await openPath(page)

  await expect(page.locator("[data-belt-track]"), "one vertical meter").toBeVisible()
  await expect(page.locator("[data-you-are-here]"), "and a line saying where you are").toBeVisible()
  expect(await page.locator("[data-belt-mark]").count(), "a marker per belt").toBe(5)
  expect(await page.locator("[data-belt-label]").count()).toBe(5)

  // markers read white/blue/purple/brown/black bottom-to-top
  const order = await page
    .locator("[data-belt-mark]")
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-belt-mark")))
  expect(order).toEqual(["white", "blue", "purple", "brown", "black"])
})

test("the fill takes the colour of the belt you have met, and the outline flips at black", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  const key = await soloWeight(page)

  await setMastery(page, key, 0)
  await openPath(page)
  expect(await page.locator("[data-belt-fill]").getAttribute("data-belt-fill"), "no belt yet").toBe(
    "none",
  )
  expect(await page.locator("[data-belt-track]").getAttribute("data-belt-track")).toBe("normal")
  expect(await page.locator("[data-belt-mark][data-met]").count(), "nothing met").toBe(0)

  // recognition everywhere ≈ 0.667 → purple met, brown and black not
  await setMastery(page, key, 2)
  await openPath(page)
  expect(await page.locator("[data-belt-fill]").getAttribute("data-belt-fill")).toBe("purple")
  expect(await page.locator("[data-belt-mark][data-met]").count(), "white, blue, purple").toBe(3)

  // recall everywhere = 1.0 → black, and the outline goes white against a black fill
  await setMastery(page, key, 3)
  await openPath(page)
  expect(await page.locator("[data-belt-fill]").getAttribute("data-belt-fill")).toBe("black")
  expect(await page.locator("[data-belt-track]").getAttribute("data-belt-track")).toBe("black")
  expect(await page.locator("[data-belt-mark][data-met]").count(), "all five").toBe(5)
})

test("the bar falls back when you get things wrong — forgetting is tested, not timed", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  const key = await soloWeight(page)

  const high = await setMastery(page, key, 3)
  await openPath(page)
  const beltAtPeak = await page.locator("[data-belt-fill]").getAttribute("data-belt-fill")
  expect(beltAtPeak).toBe("black")

  // miss every card once (Review-again / a trap drops a stage) — no time passes at all
  const after = await page.evaluate((k) => {
    const a = (window as any).__neural
    for (const c of a.flashcards.decks[k as string].cards) a._bumpStage(k as string, c.q, -1)
    return a.gameScore().score
  }, key)
  expect(after, "the score genuinely drops").toBeLessThan(high)

  await openPath(page)
  expect(
    await page.locator("[data-belt-fill]").getAttribute("data-belt-fill"),
    "and the belt demotes with it",
  ).not.toBe("black")
})

test("lessons wear a crown driven by the same mastery that moves the belt", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await openPath(page)

  const crowns = page.locator("[data-crown]")
  expect(await crowns.count(), "every lesson carries a crown").toBeGreaterThan(10)
  const cold = await crowns.first().getAttribute("data-crown")
  expect(cold, "untouched lessons start at zero").toBe("0")

  // prove one lesson's whole deck by recall → its crown maxes out
  const deckKey = await page.locator("[data-lesson]").first().getAttribute("data-lesson")
  await page.evaluate((k) => {
    const a = (window as any).__neural
    for (const c of a.flashcards.decks[k as string].cards) a._bumpStage(k as string, c.q, 3, 3)
  }, deckKey)
  await openPath(page)
  expect(
    await page.locator(`[data-lesson="${deckKey}"] [data-crown]`).getAttribute("data-crown"),
    "recall-proven deck = a full crown",
  ).toBe("4")
})
