import { test, expect } from "@playwright/test"
import { journey } from "../dsl"

/**
 * THE PANIC DRILL COULD NEVER REACH THE DECK IT WAS WRITTEN FOR.
 *
 * `enterDefense` picks `_panicKey` with `_deckHasCards(dk)`, which is STUB-NEGATIVE by design: a
 * manifest stub carries `n` but no `cards`, so an unhydrated deck reads as "no cards". Nothing
 * hydrated `dk`, so the test was false every time and the drill fell through to the POSITION deck.
 * The site's own comment says it credits the authored Defender deck "when it exists" — and for all
 * 1,326 `|Defender` decks (6,403 cards, 29.2% of the corpus) it never once existed at that moment.
 *
 * THE ASSERTION IS THE DIFFERENTIAL, not "the key is truthy" — `holder-panic-grade-credits-study-
 * ledger.spec.ts` already asserts truthy and passed all along ON THE BROKEN BUILD, because
 * `_posKey` is also truthy. What separates the two builds is WHICH key: `<submission>|Defender`
 * after the fix, a `|Top`/`|Bottom` position key before it.
 *
 * NON-KILL: this does not cover the staged-defender entry (tapping the escaping orb), which shares
 * the same prefetch seam but needs a different journey to reach.
 */
test("@curated the panic drill reaches the authored Defender deck, not your position deck", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  // get CAUGHT deterministically — rig every draw that can end the exchange early (CLAUDE.md §6.3)
  const options = await j.optionTitles()
  await j.rig("resolve", [0.99])      // our move fails
  await j.rig("outcome", [0.99])
  await j.rig("opp-finish", [0.01])   // the opponent goes for the finish
  await j.rig("opp-sub-pick", [0.01])
  await j.pick(options[0])
  await j.advanceUntil("caught", 20000)

  const got = await page.evaluate(() => {
    const a = (window as any).__neural
    const sub = a.nodes[a._defendSub]
    const dk = sub ? a.defendKeyFor(sub) : null
    return {
      panicKey: a._panicKey,
      posKey: a._posKey,
      defenderKey: dk,
      deckResident: dk ? !!a._deckHasCards(dk) : false,
      cardsInDeck: dk && a.flashcards?.decks?.[dk] ? (a._cardsOf(a.flashcards.decks[dk]) || []).length : 0,
    }
  })

  expect(got.defenderKey, "we really are in a panic drill on a submission").toMatch(/\|Defender$/)
  expect(got.deckResident, "the Defender deck was warmed before the drill asked for it").toBe(true)
  expect(got.cardsInDeck, "and it has real cards, not an empty stub").toBeGreaterThan(0)
  // THE DIFFERENTIAL: the pre-fix build resolved this to the position deck instead.
  expect(got.panicKey, "the drill credits the DEFENDER deck, not the position deck").toBe(got.defenderKey)
})
