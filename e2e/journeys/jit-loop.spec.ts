// v1.230.0: the owner dropped practise-before-you-try on 2026-10-15 (question 6).
// The two removed JIT-only cases are mapped in reading_test_migration.json.
// Keep the surviving question-clock and reveal-versus-grade economy assertions.
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"

test("expiry narrates 3-2-1, reveals the answer as a miss, and the HAND stays live (v1.133.0)", async ({
  page,
}) => {
  // REWRITTEN TWICE: v1.129.0 retired auto_pick for the hesitation branch; v1.133.0 retired the
  // hesitation branch itself — the clock times the QUESTION now, never the hand. "When the clock
  // runs out, the algorithm doesn't choose for you. You still choose." (owner)
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await j.openQuestion() // U47 d: only a question taken up with Answer for Points can expire
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

  // P2 tightened the economy again: prep-style grading (MC) feeds ODDS but no longer
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
