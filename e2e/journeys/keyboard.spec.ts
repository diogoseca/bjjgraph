import { test, expect } from "@playwright/test"
import { journey } from "../dsl"

/**
 * THE KEYBOARD, AS A PRODUCT SURFACE.
 *
 * The owner's decision was that shortcuts stay in Settings rather than getting their own icon —
 * which makes the Shortcuts tab the ONLY place they are documented, so it had better be true.
 * This spec asserts every key it advertises actually does what it says, and that the two digit
 * families never collide: A–D answer the live question, 1–9 open option sheets.
 *
 * Handler: neural/src/app.src.jsx _onKey. Legend: Settings → Shortcuts.
 */

const paused = (page: any) => page.evaluate(() => !!(window as any).__neural.paused)
/** the option sheet's panel never leaves the DOM (it fades to opacity 0), so ask the app */
const sheetOpen = (page: any) => page.evaluate(() => !!(window as any).__neural._detailCtx)

test("A-D answer the live question; digits open option sheets", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  // the landing block mounts once its distractor pool is resident (v1.80.4)
  const mc = await j.landQuestion()
  expect(mc, "a live landing question").toBeTruthy()

  // a digit must NOT answer the landing question — it opens the first option's sheet
  await page.keyboard.press("1")
  await expect(page.locator("[data-go]"), "digit 1 opened an option sheet").toBeVisible()
  const answered0 = (await j.beats()).filter((b) => b.beat === "land_q_answered").length
  expect(answered0, "and answered nothing").toBe(0)

  await page.keyboard.press("Escape") // back out of the sheet
  expect(await sheetOpen(page), "Esc closed the sheet").toBe(false)

  await page.keyboard.press("abcd"[mc!.correct])
  const answered1 = (await j.beats()).filter((b) => b.beat === "land_q_answered")
  expect(answered1.length, "the letter answered it").toBe(1)
  expect((answered1[0] as any).correct).toBe(true)
})

test("a letter beyond the option count is ignored, not a crash", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  const n = (await j.landQuestion())?.n || 0
  expect(n).toBeGreaterThan(1)
  const beyond = "abcde"[n] // one past the last real option
  if (beyond) {
    await page.keyboard.press(beyond)
    expect(
      (await j.beats()).filter((b) => b.beat === "land_q_answered").length,
      "out-of-range letters do nothing",
    ).toBe(0)
  }
  // and the block is still answerable afterwards
  const mc = await page.evaluate(() => (window as any).__neural._mc)
  await page.keyboard.press("abcd"[mc.correct])
  await j.expectBeat("land_q_answered")
})

test("Space toggles the roll; Esc unwinds one layer at a time", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  expect(await paused(page)).toBe(false)

  await page.keyboard.press("Space")
  expect(await paused(page), "Space paused").toBe(true)
  await page.keyboard.press("Space")
  expect(await paused(page), "Space resumed").toBe(false)

  // Esc cascade: option sheet first, then the pane — never both at once
  await page.locator(".ng-drilltab").click()
  await page.keyboard.press("1")
  await expect(page.locator("[data-go]")).toBeVisible()
  await page.keyboard.press("Escape")
  expect(await sheetOpen(page), "Esc closed the sheet").toBe(false)
  expect(await page.evaluate(() => !!(window as any).__neural.deckShown), "pane untouched").toBe(
    true,
  )
  await page.keyboard.press("Escape")
  expect(
    await page.evaluate(() => !!(window as any).__neural.deckShown),
    "second Esc closed the pane",
  ).toBe(false)
})

test("slash opens the explorer and stops the game", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  await page.keyboard.press("/")
  expect(
    await page.evaluate(() => (window as any).__neural.explorerRef.current.style.display),
    "explorer open",
  ).toBe("flex")
  expect(await paused(page), "reading stops the game, like every reading surface").toBe(true)

  await page.keyboard.press("Escape")
  expect(
    await page.evaluate(() => (window as any).__neural.explorerRef.current.style.display),
  ).toBe("none")
  expect(await paused(page), "and closing it resumes").toBe(false)
})

test("the Shortcuts tab documents the keys that exist", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  await page.evaluate(() => (window as any).__neural.openSettings("shortcuts"))
  const legend = (
    (await page.locator(".ng-modal, [role=dialog], body").last().textContent()) || ""
  ).toLowerCase()
  for (const key of ["a", "b", "c", "d"]) expect(legend, `${key} is documented`).toContain(key)
  for (const phrase of ["play / pause roll", "multiple-choice", "execute technique", "esc"]) {
    expect(legend, `"${phrase}" documented`).toContain(phrase)
  }
})

test("typing in a field never triggers a shortcut", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  await page.keyboard.press("/") // opens the explorer and focuses its search input
  const before = await page.evaluate(() => ({
    paused: !!(window as any).__neural.paused,
    answered: ((window as any).__neural.beats || []).filter(
      (b: any) => b.beat === "land_q_answered",
    ).length,
  }))
  await page.evaluate(() => (window as any).__neural.explorerSearchRef.current.focus())
  await page.keyboard.type("abcd 123")
  const after = await page.evaluate(() => ({
    paused: !!(window as any).__neural.paused,
    answered: ((window as any).__neural.beats || []).filter(
      (b: any) => b.beat === "land_q_answered",
    ).length,
  }))
  expect(after.answered, "letters typed into search answered nothing").toBe(before.answered)
  expect(after.paused, "and the space in the query did not toggle the roll").toBe(before.paused)
})
