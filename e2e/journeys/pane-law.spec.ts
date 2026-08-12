import { test, expect } from "@playwright/test"
import { journey } from "../dsl"

/**
 * P0 — THE PANE LAW.
 *
 * The pane (flashcards sidebar — LEFT since v1.94.0) is MANUAL-ONLY. Before this phase it opened itself at
 * the start of a seeded roll, opened itself as a "save your progress" nudge, hid itself at
 * round end, and closed itself on assorted graph clicks — while never touching the clock.
 *
 * The law, in one line: nothing but the user opens or closes the pane; the pane being open
 * STOPS the game; closing it resumes the game ONLY if the pane is what stopped it.
 *
 * Rails: __neural.paused, .deckOpen, .deckShown, ._paneAutoPaused (one latch for the merged pane)
 * Beats: pane_paused, pane_resumed, save_hint
 */

const paused = (page: any) => page.evaluate(() => !!(window as any).__neural.paused)
const shown = (page: any) => page.evaluate(() => !!(window as any).__neural.deckShown)

test("opening the pane stops the game; closing it resumes the game @curated", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  expect(await paused(page), "roll is live after landing").toBe(false)
  expect(await shown(page), "pane starts shut").toBe(false)

  // open it the way the user does: the top-left logo (the one pane opener — v1.99.0)
  await page.locator(".ng-logo").click()
  expect(await shown(page), "pane open after tab click").toBe(true)
  expect(await paused(page), "opening the pane stopped the game").toBe(true)
  await j.expectBeat("pane_paused")

  // the decision clock is frozen with it — drilling under the pane costs no tempo
  const t0 = await page.evaluate(() => (window as any).__neural._decision?.remaining ?? null)
  await j.advance(3000)
  const t1 = await page.evaluate(() => (window as any).__neural._decision?.remaining ?? null)
  expect(t1, "decision clock frozen while the pane is open").toBe(t0)

  // close via the pane's ✕
  await page.locator(".ng-explorer-close").click()
  expect(await shown(page), "pane shut after ✕").toBe(false)
  expect(await paused(page), "closing the pane resumed the game").toBe(false)
  await j.expectBeat("pane_resumed")
})

test("closing the pane does NOT resume a roll the user paused by hand", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  // hand-pause FIRST (transport button seam), then open the pane on top of it
  await page.evaluate(() => (window as any).__neural.setPaused(true))
  await page.locator(".ng-logo").click()
  expect(await shown(page)).toBe(true)
  expect(
    await page.evaluate(() => !!(window as any).__neural._paneAutoPaused),
    "pane did not claim the pause",
  ).toBe(false)

  await page.evaluate(() => (window as any).__neural.setDeckOpen(false))
  expect(await paused(page), "the hand-pause survives closing the pane").toBe(true)
})

test("a round ending never hides the pane", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await page.locator(".ng-logo").click()
  expect(await shown(page)).toBe(true)

  // endRound is normally reached by the resolve path — which needs time, and time is frozen
  // while the pane is open. That is precisely the point: this rail asserts the round-end seam
  // itself no longer clears deckReady behind the user's back.
  await page.evaluate(() => (window as any).__neural.endRound("reset"))
  expect(await shown(page), "pane survives the round boundary").toBe(true)
  expect(
    await page.evaluate(() => !!(window as any).__neural.deckReady),
    "deckReady stays a data flag",
  ).toBe(true)
})

test("a new roll never opens the pane", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  expect(await shown(page)).toBe(false)

  // _openSidebarOnLand is the flag the "roll from here" confirm used to set to force the pane
  // open on the seeded landing. It may now only move FOCUS, never open.
  await j.rig("ai-skill", [0.5])
  await j.rig("role", [0])
  await j.rig("max-moves", [0.5])
  await page.evaluate(() => {
    const a = (window as any).__neural
    a._openSidebarOnLand = true
    a.startRoll()
  })
  for (let i = 0; i < 12; i++) {
    await j.advance(1000)
    if (await page.evaluate(() => ((window as any).__neural.optionIdxs || []).length > 0)) break
  }

  expect(await shown(page), "seeded roll landed with the pane still shut").toBe(false)
  expect(
    await paused(page),
    "and the new roll is live, not stopped by a pane it never opened",
  ).toBe(false)
})

test("the save nudge asks for the pane instead of forcing it open", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  // two graded answers is the nudge threshold (noteCardAnswered is the UI grading choke)
  await page.evaluate(() => {
    const a = (window as any).__neural
    a.noteCardAnswered()
    a.noteCardAnswered()
  })

  await j.expectBeat("save_hint")
  expect(await shown(page), "the nudge did not force the pane open").toBe(false)
  expect(await paused(page), "and did not stop the game").toBe(false)
})

test("a graph click does not close the pane on desktop", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await page.locator(".ng-logo").click()
  expect(await shown(page)).toBe(true)

  // closeDeckIfStudying is the canvas-click seam (canvas hit-testing has no DOM to click)
  await page.evaluate(() => (window as any).__neural.closeDeckIfStudying())
  expect(await shown(page), "desktop graph clicks leave the pane alone").toBe(true)
  expect(await paused(page), "and leave the game stopped").toBe(true)
})

test("Esc closes the pane once no overlay is up", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await page.locator(".ng-logo").click()
  expect(await shown(page)).toBe(true)

  await page.keyboard.press("Escape")
  expect(await shown(page), "Esc closed the pane").toBe(false)
  expect(await paused(page), "and resumed the game it stopped").toBe(false)
})
