import { test, expect } from "@playwright/test"
import { journey } from "../dsl"

/**
 * P3 — THE TUTORIAL DRIP.
 *
 * The one-shot 3-card coach becomes step 1–3 of a 20-step checklist that keeps teaching across
 * sessions. Every remaining step is completed by DOING it — the fx beat bus ticks it off — so
 * the tutorial is a map of the game rather than a wall in front of it. Nothing is gated behind
 * it, and it rides at the head of the Belt Path because learning the UI is what a white belt
 * does first.
 *
 * Rails: __neural.TUTORIAL, .tut.done, .tutDoneCount(), .tutCurrent(), .restartTutorial()
 * Surfaces: [data-tut] [data-tut-count] [data-tut-copy] [data-tut-row] [data-tut-restart]
 * Beats: tut_step {id, done, of}, tutorial_done
 * DSL: boot({ keepTutorial: true }) opts in — journeys otherwise start it pre-completed.
 */

const count = (page: any) => page.evaluate(() => (window as any).__neural.tutDoneCount())
const doneMap = (page: any) =>
  page.evaluate(() => Object.assign({}, (window as any).__neural.tut.done))

test("the coach is steps 1-3, and the drip takes over when it finishes", async ({ page }) => {
  const j = journey(page)
  await j.boot("/", { keepTutorial: true })
  await j.land("Mount Top", { keepCoach: true })

  await expect(
    page.locator("[data-coach]"),
    "the 3-beat coach still owns the first landing",
  ).toBeVisible()
  await expect(page.locator("[data-tut]"), "and the drip strip stays out of its way").toHaveCount(0)
  expect(await count(page), "landing fired coach_1 = step 1").toBeGreaterThanOrEqual(1)
  await j.expectBeat("tut_step")

  // walk the coach to the end: steps 2 and 3. Driven through advanceCoach() rather than the
  // button — the canvas sits over the coach card and intercepts pointer events (the core
  // guidance-defense journey drives it the same way).
  await page.evaluate(() => (window as any).__neural.advanceCoach())
  await page.evaluate(() => (window as any).__neural.advanceCoach())
  await page.evaluate(() => (window as any).__neural.advanceCoach())
  await j.expectBeat("coach_done")

  const d = await doneMap(page)
  expect(d.coach1 && d.coach2 && d.coach3, "all three coach beats ticked their steps").toBeTruthy()
  await expect(page.locator("[data-tut]"), "now the drip is the visible guide").toBeVisible()
  await expect(page.locator("[data-tut-count]")).toHaveText(`3/20`)
})

test("a step is earned by doing the thing, and it survives a reload", async ({ page }) => {
  const j = journey(page)
  await j.boot("/", { keepTutorial: true })
  await j.land("Mount Top")
  expect((await doneMap(page)).answer, "not yet answered").toBeFalsy()

  // answer the landing question correctly — that IS the step
  const mc = await page.evaluate(() => {
    const m = (window as any).__neural._mc
    return m ? { correct: m.correct, n: m.n } : null
  })
  expect(mc, "a landing question to answer").toBeTruthy()
  await page.keyboard.press("abcd"[mc!.correct])

  expect((await doneMap(page)).answer, "step ticked by the beat").toBeTruthy()
  const before = await count(page)

  await j.boot("/", { preserveStorage: true, keepTutorial: true })
  expect(await count(page), "the drip persists in the progress blob").toBe(before)
  expect((await doneMap(page)).answer).toBeTruthy()
})

test("the drip shows one step at a time and can be restarted", async ({ page }) => {
  const j = journey(page)
  await j.boot("/", { keepTutorial: true })
  await j.land("Mount Top")

  await expect(page.locator("[data-tut]")).toBeVisible()
  const copy = await page.locator("[data-tut-copy]").textContent()
  expect(copy, "the current step is named").toBeTruthy()
  const cur = await page.evaluate(() => (window as any).__neural.tutCurrent().copy)
  expect(copy).toBe(cur)

  await page.evaluate(() => (window as any).__neural.restartTutorial())
  expect(await count(page), "restart wipes the checklist").toBe(0)
  expect(
    await page.evaluate(() => {
      try {
        return localStorage.getItem("bjj-neural-coached")
      } catch {
        return null
      }
    }),
    "and re-arms the coach",
  ).toBeNull()
})

test("the tutorial rides at the head of the belt path", async ({ page }) => {
  const j = journey(page)
  await j.boot("/", { keepTutorial: true })
  await j.land("Mount Top")

  await page.evaluate(() => {
    const a = (window as any).__neural
    a.setViewMode("path")
    a.openExplorer()
    a.renderExplorer()
  })

  const row = page.locator("[data-tut-row]")
  await expect(row, "a Tutorial row above the belts").toBeVisible()
  await expect(row).toContainText("/20 steps")
  await expect(page.locator("[data-tut-next]"), "with the next step spelled out").toBeVisible()
})

test("journeys start post-tutorial by default", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  expect(await count(page), "pre-completed unless a test opts in").toBe(20)
  await expect(page.locator("[data-tut]"), "so nothing narrates over the game").toHaveCount(0)
})
