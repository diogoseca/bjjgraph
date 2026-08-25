import { test, expect } from "@playwright/test"
import { journey } from "../dsl"

/**
 * P1 — THE QUESTION-FIRST LANDING.
 *
 * The flashcard stopped being a place you go and became what the game asks you on arrival:
 * identity (what this is, where you came from, which side you're playing, have you met it) →
 * film → ONE multiple-choice question → your options → "More" for everything else.
 *
 * Economy (one rule on both surfaces, no double-counting):
 *   right → the ordinary credit path (mastery + sharpness already move the odds) + clock refund
 *   wrong → a transient _qMod hit on THIS exchange only, forgiven on the next arrival
 *
 * Keys: A/B/C/D answer the live MC block; digits stay the option-card openers.
 * The right sidebar is the STUDY surface and now reads back as classic recall by default.
 *
 * Surfaces: [data-landcard] [data-land-count] [data-land-q] [data-land-more] [data-land-close]
 * Beats: land_q_shown, land_q_answered {correct, tier, qMod}
 */

/** the live MC truth (correct index + option count) — the same rail mc-flashcards.spec uses */
const truth = (page: any) =>
  page.evaluate(() => {
    const m = (window as any).__neural._mc
    return m ? { correct: m.correct, n: m.n, surface: m.surface } : null
  })

/** a mid-band option: clear of both clamp zones so a pump/penalty is visible */
const midOption = async (page: any) =>
  page.evaluate(() => {
    const a = (window as any).__neural
    for (const i of a.optionIdxs || []) {
      const n = a.nodes[i]
      const odds = Math.round(a.moveChance(n) * 100)
      if (odds >= 20 && odds <= 70) return n.t
    }
    return (a.nodes[(a.optionIdxs || [])[0]] || {}).t || ""
  })

test("landing asks one question; a right answer pumps the odds and refunds the clock", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  await expect(page.locator("[data-landcard]"), "landing card docked above the hand").toBeVisible()
  await expect(page.locator("[data-landcard]"), "the card is up").toBeVisible()
  // v1.101.1: no header block on a landing — the counter is the card's meta, in the foot
  await expect(page.locator("[data-land-foot] [data-land-count]"), "counter in the foot").toHaveCount(1)
  await expect(page.locator("[data-land-q]"), "one question").toBeVisible()
  await j.expectBeat("land_q_shown")

  const t = await midOption(page)
  const before = await j.displayedOdds(t)
  const clockBefore = await page.evaluate(() => (window as any).__neural.decisionRemaining())

  const mc = await truth(page)
  expect(mc?.surface, "the landing block owns the keyboard").toBe("land")
  await page.keyboard.press("abcd"[mc!.correct])

  expect(await j.displayedOdds(t), "odds up after a right answer").toBeGreaterThan(before)
  // v1.133.0: the clock times the question, so answering DISARMS it — no refund exists
  expect(
    await page.evaluate(() => (window as any).__neural.decisionRemaining()),
    "the window is spent by the answer",
  ).toBe(0)
  void clockBefore
  const answered = (await j.beats()).filter((b: any) => b.beat === "land_q_answered")
  expect(answered.length).toBe(1)
  expect((answered[0] as any).correct).toBe(true)
})

test("a wrong answer costs THIS exchange only — the next arrival forgives it", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  const t = await midOption(page)
  const before = await j.displayedOdds(t)
  const mc = await truth(page)
  await page.keyboard.press("abcd"[(mc!.correct + 1) % mc!.n])

  expect(await j.displayedOdds(t), "odds down after a wrong answer").toBeLessThan(before)
  const qMod = await page.evaluate(() => (window as any).__neural._qMod)
  expect(qMod, "a transient penalty, not a permanent one").toBeLessThan(0)

  // play the move out and arrive somewhere new — the penalty does not follow you.
  // Rig the resolve+outcome to the success branch: the fail branch can chain into an
  // opponent catch whose defense-expiry ride exceeds nextHand's sim-time cap.
  await j.rig("resolve", [0.01])
  await j.rig("outcome", [0.01])
  await j.pick(t)
  await j.nextHand()
  expect(await page.evaluate(() => (window as any).__neural._qMod), "forgiven on arrival").toBe(0)
})

test("a proven deck asks nothing — the card degrades to identity", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await expect(page.locator("[data-land-q]")).toBeVisible()

  await page.evaluate(() => {
    const a = (window as any).__neural
    const key = a.deckKeyFor(a.nodes[a.currentPos]).key
    for (const c of a.flashcards.decks[key].cards) a._bumpStage(key, c.q, 4)
    a.renderLandCard(a.nodes[a.currentPos], "land", null)
  })

  await expect(page.locator("[data-land-q]"), "nothing left to ask").toHaveCount(0)
  await expect(page.locator("[data-landcard]"), "identity still lands").toBeVisible()
  await expect(page.locator("[data-landcard]")).toBeVisible()
})

test("the sidebar reads back as classic recall — multiple choice is the in-roll format", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  expect(
    await page.evaluate(() => (window as any).__neural.get("mcMode", "classic")),
    "shipped default",
  ).toBe("classic")

  // open the sidebar: its cards must reveal, not offer options. Scoped to the pane — the
  // LANDING card legitimately has [data-mc-opt] buttons of its own, which is the whole point.
  await page.locator(".ng-logo").click()
  await page.locator('.ng-learning-nav [data-view="history"]').click()
  await expect(
    page.locator(".ng-drill [data-mc-opt]"),
    "no multiple choice in the study pane",
  ).toHaveCount(0)
  const paneMc = await page.evaluate(() => {
    const a = (window as any).__neural
    const key = a.deckKeyFor(a.nodes[a.currentPos]).key
    const card = a.flashcards.decks[key].cards[0]
    return a.mcActive(key, card)
  })
  expect(paneMc, "the study surface does not quiz you multiple-choice by default").toBe(false)
})

test("digits still open option sheets while a landing question is live", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await expect(page.locator("[data-land-q]")).toBeVisible()

  await page.keyboard.press("1")
  await expect(page.locator("[data-go]"), "digit 1 opened the first option's sheet").toBeVisible()
})

test("the identity chip fuses the seen-glyph with the deck's recall count and opens study", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  // one top-right chip, not two adjacent familiarity indicators (v1.76.0 merged-glyph decision)
  const chip = page.locator("[data-land-foot] [data-land-count]")
  await expect(chip, "the chip rides the identity row").toBeVisible()
  const label = await chip.getAttribute("data-land-count")
  const state = await page.evaluate(() => {
    const a = (window as any).__neural
    const key = a.deckKeyFor(a.nodes[a.currentPos]).key
    const deck = a.flashcards && a.flashcards.decks ? a.flashcards.decks[key] : null
    const total = deck && deck.cards ? deck.cards.length : 0
    return { total, done: Math.min((a.prep && a.prep[key]) || 0, total) }
  })
  expect(state.total, "this landing has an authored deck").toBeGreaterThan(0)
  expect(label, "chip carries done/total").toBe(`${state.done}/${state.total}`)

  // clicking it is a manual study open — pane-law-legal, lands on the History tab's deck
  await chip.click()
  expect(
    await page.evaluate(() => !!(window as any).__neural.deckShown),
    "chip click opened the pane",
  ).toBe(true)
  expect(
    await page.evaluate(() => (window as any).__neural._viewMode),
    "on the History tab (study this state)",
  ).toBe("history")
  await j.expectBeat("pane_paused")
})
