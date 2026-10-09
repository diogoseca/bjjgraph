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
  await expect(page.locator('[data-reader-ready="true"]')).toBeVisible()
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

test("@curated Esc closes Browse and leaves the independent article reading", async ({ page }) => {
  const j = await setup(page)
  await addMore(page)
  await j.clickByMouse("[data-reading-focus]", "Focus on reading")
  await expect(page.locator('[data-reader-ready="true"]')).toBeVisible()
  await j.clickByMouse(".ng-logo", "open Browse above the article")
  await page.keyboard.press("Escape")
  await expect(page.locator(".ng-drill")).toBeHidden()
  await expect(page.locator('[data-reader-ready="true"]')).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.locator('[data-reader-ready="true"]')).toBeVisible()
  expect(await page.evaluate(() => {
    const a = (window as any).__neural
    return { reading: a._readerIntent, hand: (a._optList || []).length, question: !!a._landQ, paused: a.paused }
  })).toEqual({ reading: true, hand: 0, question: false, paused: true })
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

test("@curated leaving Focus preserves the stopped reading intent until Practice", async ({ page }) => {
  const j = await setup(page)
  await addMore(page)
  await j.clickByMouse("[data-reading-focus]")
  await expect(page.locator('[data-reader-ready="true"]')).toBeVisible()
  await j.clickByMouse("[data-reading-focus]", "leave Focus without starting a roll")
  await j.advance(12000)
  expect(await page.evaluate(() => {
    const a = (window as any).__neural
    return { focus: a.get("readingFocus", false), reading: a._readerIntent, current: a.currentPos, hand: (a._optList || []).length }
  })).toEqual({ focus: false, reading: true, current: null, hand: 0 })
  await j.clickByMouse("[data-reader-practice]", "explicit Practice")
  await j.advance(1500)
  await expect(page.locator("[data-tech]").first()).toBeVisible()
  expect(await page.evaluate(() => (window as any).__neural._readerIntent)).toBe(false)
})
