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
 *   beats: jit_opened, bonus_pumped (existing), expiry_warning, land_q_expired (v1.133.0 —
 *   timer_refund and hesitated retired with the hand clock)
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

test("drilling pumps odds and buys NO time — the clock belongs to the question (v1.133.0)", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  const options = await j.optionTitles()
  await page.locator(`[data-tech="${options[0]}"]`).first().click()
  await expect(page.locator("[data-jit]")).toBeVisible()

  const remaining = () => page.evaluate(() => (window as any).__neural.decisionRemaining())

  // v1.134.0: opening the sheet DECLINED the landing question (reading a move instead of
  // answering), so no window is running — and grading refunds nothing because there is nothing
  // to refund. The drill's whole payment is odds.
  expect(await remaining(), "the sheet declined the question").toBe(0)
  await page.locator("[data-jit-reveal]").click()
  await page.locator("[data-jit-got]").click()
  expect(await remaining(), "still no clock — the drill buys odds, never time").toBe(0)
  const refunds = (await j.beats()).filter((b: any) => b.beat === "timer_refund")
  expect(refunds.length, "the refund beat is retired").toBe(0)
  await j.expectBeat("land_q_declined")
  await j.expectBeat("bonus_pumped") // the grade still pays — in odds, not seconds
})

test("expiry narrates 3-2-1, reveals the answer as a miss, and the HAND stays live (v1.133.0)", async ({
  page,
}) => {
  // REWRITTEN TWICE: v1.129.0 retired auto_pick for the hesitation branch; v1.133.0 retired the
  // hesitation branch itself — the clock times the QUESTION now, never the hand. "When the clock
  // runs out, the algorithm doesn't choose for you. You still choose." (owner)
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  const handBefore = await page.evaluate(() => ((window as any).__neural.optionIdxs || []).length)
  await j.advance(30_000)
  const beats = (await j.beats()).map((b) => b.beat)
  expect(beats).toContain("expiry_warning")
  expect(beats, "the timeout is a named beat, not a silent theft").toContain("land_q_expired")
  expect(beats, "the hesitation branch is retired").not.toContain("hesitated")
  const after = await page.evaluate(() => {
    const a = (window as any).__neural
    return {
      hand: (a.optionIdxs || []).length,
      revealed: !!document.querySelector("[data-land-q] [data-mc-result]"),
      qMod: a._qMod,
    }
  })
  expect(after.hand, "the hand survives the clock").toBe(handBefore)
  expect(after.revealed, "the answer is on the table").toBe(true)
  expect(after.qMod, "priced exactly like a wrong answer").toBeLessThan(0)
  // …and the player still picks
  await page.evaluate(() => { const a = (window as any).__neural; a._optPick(a._optList[0]) })
  await j.advance(1000)
  expect((await j.beats()).map((b) => b.beat)).toContain("commit")
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

  // P2 tightened the economy again: prep-style grading (JIT, MC) feeds ODDS but no longer
  // mints mastery — masteredCount is RECALL-proven (rec >= 3). Assert both halves.
  await page.evaluate(() => {
    const a = (window as any).__neural
    const key = a.deckKeyFor(a.nodes[a.currentPos]).key
    const deck = a.flashcards.decks[key]
    for (let i = 0; i < 3; i++) { a.prep[key] = (a.prep[key] || 0) + 1; a.noteCardDone(deck.cards[i], key) }
  })
  const afterPrep = await page.evaluate(() => {
    const a = (window as any).__neural
    const key = a.deckKeyFor(a.nodes[a.currentPos]).key
    return { prep: a.prep[key] || 0, mastered: a.masteredCount() }
  })
  expect(afterPrep.prep).toBeGreaterThanOrEqual(3) // odds credit earned
  expect(afterPrep.mastered).toBe(mastered0) // but mastery stays recall-gated

  // recall grades mint it (the only path)
  await page.evaluate(() => {
    const a = (window as any).__neural
    const key = a.deckKeyFor(a.nodes[a.currentPos]).key
    a.rec[key] = (a.rec[key] || 0) + 3
  })
  const mastered2 = await page.evaluate(() => (window as any).__neural.masteredCount())
  expect(mastered2).toBeGreaterThanOrEqual(mastered0 + 1)
})
