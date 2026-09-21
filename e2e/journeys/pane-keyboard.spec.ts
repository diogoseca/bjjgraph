import { test, expect, type Page } from "@playwright/test"
import { journey, type Journey } from "../dsl"

// The harness omits dossiers. Author More explicitly so keyboard and pause assertions
// cannot pass merely because the lower reading surface never existed.
// Mutation check: letting a landing render own the shared MC slot under an open pane fails
// the fresh/cached/backfilled case on surface and question identity, before any answer key.
async function addMore(page: Page) {
  await page.evaluate(() => {
    const w = window as any, a = w.__neural
    const key = a.deckKeyFor(a.nodes[a.currentPos]).key
    w.NG_CONTENT ||= {}; w.NG_CONTENT.decks ||= {}
    w.NG_CONTENT.decks[key] = { cat: "Position", role: "Top", lead: "Keep a stable connection.",
      principles: ["Maintain your base while your partner changes direction."] }
    a.onContentReady(key)
  })
  await expect(page.locator("[data-land-more]")).toBeVisible()
}

async function settle(page: Page, j: Journey) {
  await page.waitForTimeout(350)
  await j.advance(1200)
}

async function setup(page: Page) {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await settle(page, j)
  return j
}

async function study(page: Page, j: Journey) {
  await j.clickByMouse(".ng-logo", "open the pane")
  // Open the full study surface through the same entry point as a selected lesson.
  await page.evaluate(() => {
    const a = (window as any).__neural
    a.set("mcMode", "auto")
    a.openStudy(a.deckKeyFor(a.nodes[a.currentPos]).key)
  })
  await page.waitForFunction(() => (window as any).__neural._mc?.surface === "deck")
  await expect(page.locator("[data-mc-opt]")).toHaveCount(3)
  await settle(page, j)
}

test("@curated Esc closes the pane before the expanded reading column", async ({ page }) => {
  const j = await setup(page)
  await addMore(page)
  await settle(page, j)
  await j.clickByMouse("[data-land-more]", "open More")
  await j.clickByMouse(".ng-logo", "open the pane above More")
  await page.keyboard.press("Escape")
  await expect(page.locator(".ng-drill")).toBeHidden()
  await expect(page.locator("[data-land-more]")).toHaveAttribute("aria-expanded", "true")
  expect(await page.evaluate(() => (window as any).__neural.paused)).toBe(true)

  await page.keyboard.press("Escape")
  await expect(page.locator("[data-land-more]")).toHaveAttribute("aria-expanded", "false")
  expect(await page.evaluate(() => (window as any).__neural.paused)).toBe(false)
})

test("@curated fresh, cached and backfilled landing pages preserve the pane's answer keys", async ({ page }) => {
  const j = await setup(page)
  await study(page, j)
  const pane = await page.evaluate(() => {
    const m = (window as any).__neural._mc
    return { qhash: m.qhash, correct: m.correct }
  })
  for (const dir of ["next", "prev", "next"]) {
    await j.clickByMouse(`[data-land-${dir}]`, `page the exposed landing deck ${dir}`)
    await j.landSettled()
    expect(await page.evaluate(() => {
      const m = (window as any).__neural._mc
      return { surface: m?.surface, qhash: m?.qhash }
    })).toEqual({ surface: "deck", qhash: pane.qhash })
  }
  await addMore(page) // same mounted landing question survives a late dossier backfill
  expect(await page.evaluate(() => (window as any).__neural._mc?.qhash)).toBe(pane.qhash)
  await page.keyboard.press("abc"[pane.correct])
  await expect(page.locator(`[data-mc-opt="${pane.correct}"]`)).toHaveAttribute("data-mc-result", "correct")
  await expect(page.locator("[data-land-q] [data-mc-result]")).toHaveCount(0)
  expect(await page.evaluate(() => !!(window as any).__neural._detailCtx)).toBe(false)

  await j.clickByMouse(".ng-explorer-close", "close the study pane")
  const land = await page.evaluate(() => {
    const a = (window as any).__neural
    const m = a._landEl.querySelector("[role=radiogroup]").__ngMc
    return { ownsKeys: a._mc === m, correct: m.correct }
  })
  expect(land.ownsKeys, "the mounted landing block receives its keys back").toBe(true)
  await page.keyboard.press("abc"[land.correct])
  await expect(page.locator(`[data-land-mc-opt="${land.correct}"]`)).toHaveAttribute("data-mc-result", "correct")
})

test("@curated a recall page mounted under the pane receives Space when the pane closes", async ({ page }) => {
  const j = await setup(page)
  await page.evaluate(() => {
    const a = (window as any).__neural, key = a._landQ.key
    a.set("recallInPlay", true)
    const card = a._landDeckCards(key)[1]
    a.stage[key] ||= {}; a.stage[key][a.qhash(card.q)] = 2
  })
  await study(page, j)
  for (const dir of ["next", "prev", "next"]) {
    await j.clickByMouse(`[data-land-${dir}]`, `page the exposed landing deck ${dir}`)
    await j.landSettled()
  }
  await expect(page.locator("[data-land-reveal]")).toBeVisible()
  await j.clickByMouse(".ng-explorer-close", "close the study pane")
  expect(await page.evaluate(() => {
    const a = (window as any).__neural
    return a._recall === a._landEl.querySelector("[data-land-recall]").__ngRecall
  })).toBe(true)
  // Space activates a focused button before any app shortcut. Put focus back in
  // the reading area with a real click, rather than activating the pane's close button again.
  await j.clickByMouse("[data-land-q] > div:first-child", "the landing reading area")
  await page.keyboard.press("Space")
  await expect(page.locator("[data-land-answer]")).toBeVisible()
})

test("@curated ending replay preserves an expanded More pause after the pane closes", async ({ page }) => {
  const j = await setup(page)
  await addMore(page)
  await settle(page, j)
  await j.clickByMouse(".ng-logo", "the pane takes the pause")
  await settle(page, j)
  await j.clickByMouse("[data-land-more]", "open the exposed More control")
  // A one-state history fixture is enough to exercise replay ownership; replay itself
  // uses the production entry point, and its close control gets a real mouse below.
  expect(await page.evaluate(() => {
    const a = (window as any).__neural
    return a.startReplay({ ts: 123, log: a.rollLog.slice(0, 1), outcome: "scramble" })
  })).toBe(true)
  await j.clickByMouse(".ng-explorer-close", "close the pane while replay runs")
  expect(await page.evaluate(() => !!(window as any).__neural._replay)).toBe(true)
  await page.waitForTimeout(350)
  await j.clickByMouse("[data-replay-stop]", "stop replay")
  await expect(page.locator("[data-land-more]")).toHaveAttribute("aria-expanded", "true")
  expect(await page.evaluate(() => (window as any).__neural.paused)).toBe(true)
  await page.waitForTimeout(350)
  await j.clickByMouse("[data-land-more]", "close the final pause holder")
  expect(await page.evaluate(() => (window as any).__neural.paused)).toBe(false)
})
