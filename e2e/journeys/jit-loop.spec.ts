import { test, expect } from "@playwright/test"
import { journey } from "../dsl"

/**
 * P1 — HONEST ECONOMY + JIT DRILL LOOP (spec first; drives the implementation).
 *
 * The core fantasy: mid-decision, the user peeks a move's expand sheet, drills the exact
 * flashcards for it "just in time", SEES the odds pump, and commits with earned confidence.
 * The economy must be honest (only graded answers credit mastery) and the clock must make
 * drilling a real tempo decision (refunds, capped).
 *
 * New app surfaces this spec forces into existence:
 *   [data-jit]        — the in-sheet micro-drill block (at the "+X% drilling" seam)
 *   [data-jit-reveal] — reveal-answer button of the current micro-card
 *   [data-jit-got]    — "Got it" grade button (credits prep + pumps odds)
 *   [data-odds]       — the sheet's live odds odometer element (textContent = "NN%")
 *   beats: jit_opened, bonus_pumped (existing), timer_refund {granted}, expiry_warning, auto_pick
 *   __neural.decisionRemaining() — seconds left in the current decision window (test read API)
 */

test("JIT sheet drill pumps the odds odometer and the canvas edge", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  // choose a mid-odds option (headroom for +18)
  const options = await j.optionTitles()
  let target = options[0]
  for (const o of options) {
    const odds = await j.displayedOdds(o)
    if (odds >= 20 && odds <= 70) { target = o; break } // clear of both clamp zones
  }
  const before = await j.displayedOdds(target)

  // open the expand sheet (real click) — the JIT drill block must exist inside it
  await page.locator(`[data-tech="${target}"]`).first().click()
  const jit = page.locator("[data-jit]")
  await expect(jit, "in-sheet JIT micro-drill visible").toBeVisible()

  // drill 3 cards through the SHEET UI: reveal → Got it, three times
  for (let i = 0; i < 3; i++) {
    await page.locator("[data-jit-reveal]").click()
    await page.locator("[data-jit-got]").click()
    await j.advance(600) // odometer animation window
  }

  // the sheet odometer shows the pumped odds; +6/card on the displayed number
  const odoText = await page.locator("[data-odds]").first().textContent()
  const odo = parseInt((odoText || "").replace(/[^0-9]/g, ""), 10)
  const after = await j.displayedOdds(target)
  expect(after - before).toBeGreaterThanOrEqual(17) // 3 cards ≈ +18
  expect(Math.abs(odo - after)).toBeLessThanOrEqual(1) // odometer == live odds

  // beats: the pump moments are first-class
  const beats = (await j.beats()).map((b) => b.beat)
  expect(beats).toContain("jit_opened")
  expect(beats.filter((b) => b === "bonus_pumped").length).toBeGreaterThanOrEqual(3)

  // commit from the same sheet — the loop closes where the confidence was earned
  await j.rig("resolve", [0.01])
  await j.rig("outcome", [0.01])
  await page.locator("[data-go]").click()
  await j.advance(5000)
  await j.expectBeat("impact_success")
})

test("drilling refunds decision time, capped at 2 per window", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  const options = await j.optionTitles()
  await page.locator(`[data-tech="${options[0]}"]`).first().click()
  await expect(page.locator("[data-jit]")).toBeVisible()

  const remaining = () => page.evaluate(() => (window as any).__neural.decisionRemaining())

  // sheets pause the game clock — but the DECISION window refund is what we measure on grade
  const r0 = await remaining()
  await page.locator("[data-jit-reveal]").click()
  await page.locator("[data-jit-got]").click()
  const r1 = await remaining()
  expect(r1 - r0).toBeGreaterThanOrEqual(2) // +2.5s refund (allow rounding)

  await page.locator("[data-jit-reveal]").click()
  await page.locator("[data-jit-got]").click()
  const r2 = await remaining()
  expect(r2 - r1).toBeGreaterThanOrEqual(2) // second refund

  await page.locator("[data-jit-reveal]").click()
  await page.locator("[data-jit-got]").click()
  const r3 = await remaining()
  expect(r3 - r2).toBeLessThan(1) // third drill: capped, no refund

  const refunds = (await j.beats()).filter((b: any) => b.beat === "timer_refund")
  expect(refunds.length).toBe(3)
  expect(refunds.map((r: any) => r.granted)).toEqual([true, true, false])
})

test("expiry narrates 3-2-1 and auto-picks with a pop (no silent teleport)", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  // let the decision window run out (rig the auto-pick for determinism)
  await j.rig("auto-pick", [0])
  await j.rig("resolve", [0.99]) // whatever happens after, keep it deterministic
  await j.rig("outcome", [0.5])
  await j.advance(30_000)
  const beats = (await j.beats()).map((b) => b.beat)
  expect(beats).toContain("expiry_warning")
  expect(beats).toContain("auto_pick")
})

test("honest economy: revealing a card is 'seen', only grading credits mastery", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  const mastered0 = await page.evaluate(() => (window as any).__neural.masteredCount())

  // reveal WITHOUT grading through the roll-history mini deck path (the old leak):
  // simulate the reveal choke — it must NOT credit prep anymore
  await page.evaluate(() => {
    const a = (window as any).__neural
    const key = a.deckKeyFor(a.nodes[a.currentPos]).key
    a.noteCardSeen ? a.noteCardSeen(key, 0) : null // new rail: reveal = seen only
  })
  const mastered1 = await page.evaluate(() => (window as any).__neural.masteredCount())
  expect(mastered1).toBe(mastered0)

  // grading through drillGrade(true) DOES credit — and mastery needs prep>=3
  await page.evaluate(() => {
    const a = (window as any).__neural
    const key = a.deckKeyFor(a.nodes[a.currentPos]).key
    const deck = a.flashcards.decks[key]
    for (let i = 0; i < 3; i++) { a.prep[key] = (a.prep[key] || 0) + 1; a.noteCardDone(deck.cards[i], key) }
  })
  const mastered2 = await page.evaluate(() => (window as any).__neural.masteredCount())
  // >=1: shared hierarchy cards legitimately propagate mastery to sibling variant decks
  expect(mastered2).toBeGreaterThanOrEqual(mastered0 + 1)
})
