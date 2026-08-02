/* @hyperspace {"theme":"onboarding","L":"casual-week1","F":"recall-gate","B":"economy-math"} @invariant "For a near-fresh player, revealing a card is only 'seen' (masteredCount flat) and only pushing a distinct card's rec to 3 via recall raises masteredCount by exactly 1 — the first mastery a player ever earns is recall-gated, never granted by seeing or by MC." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { firstRollDay1 } from "./personas"

/**
 * ONBOARDING — THE FIRST MASTERY A PLAYER EVER EARNS IS RECALL-GATED (from masteredCount 0).
 *
 * A near-fresh player (one lesson lightly prep-graded, nothing proven → masteredCount()===0) works
 * a DIFFERENT deck to its first-ever mastery. This spec pins the ECONOMY BOUNDARY as it is actually
 * crossed by the app's real recall machinery: seeing a card is 'seen' only (no credit); prep/MC work
 * caps the per-card stage at 2 (the recall gate) and never mints rec; and only the genuine recall
 * grading path (recallGrade crossing stage 2→3 under the wasProven guard), applied to a THIRD DISTINCT
 * card, flips masteredCount from 0 to EXACTLY 1. The first point of mastery is minted at that crossing
 * and nowhere earlier.
 *
 * NOVELTY vs three adjacent CORE invariants (cited per house rails — this is deliberately carved to
 * not paraphrase any of them):
 *   - core-027 (jit-loop.spec.ts, L=first-roll-day1/F=recall-gate/B=economy-math) asserts the same
 *     seen-flat + prep-grade-flat + "recall mints it" shape, BUT fakes the recall step with a raw map
 *     poke `a.rec[key] += 3` and asserts `masteredCount >= mastered0 + 1` (a >= bound). It never drives
 *     the real recall gate and never proves WHERE the boundary flips.
 *     UNIQUE HERE: rec is minted ONLY through the genuine recall path (openStudy → stage=2 → presentCard
 *     → recallGrade), and the crossing is proved to be EXACTLY +1 and to happen EXACTLY at the 3rd
 *     distinct card (rec 1 → flat, rec 2 → flat, rec 3 → +1) — the per-card increment ladder core-027
 *     collapses into a single +=3 poke.
 *   - core-032 (mc-flashcards.spec.ts, L=casual-week1/F=recall-gate/B=guard-limit) proves 5 MC corrects
 *     pin stage at 2 with rec 0, then recall 3 distinct → rec>=3 — but on a deck being reviewed, not as
 *     a near-fresh player's FIRST-EVER mastery from masteredCount 0, and it asserts rec>=3 / masteredCount
 *     >=+1, never the exact +1 flip at the boundary.
 *   - core-055 (review-fixes.spec.ts, L=casual-week1/F=recall-gate/B=economy-math) is the ANTI-INFLATION
 *     claim (re-grading one card raises rec by at most 1). This spec's anti-inflation control is a
 *     one-line guard on the exact-+1 result, not the claim under test.
 *
 * Mechanism under test (source-verified, neural/src/app.src.jsx):
 *   masteredCount() (1153)  — Object.keys(rec).filter(k => rec[k] >= 3).length: mastery === recall-proven.
 *   noteCardSeen()  (1155)  — adds to _seen ONLY; never touches rec/prep (reveal = seen).
 *   noteCardDone()  (840)   — prep/sharpness/persistence; never touches rec (the prep/MC choke).
 *   openStudy(key)  (1892)  — sets drillEntries/_posKey + renderDrill() → populates this.deck/_deckInfo
 *                             that recallGrade reads (clean deck context without a live roll).
 *   _bumpStage(k,q,d,cap)(3273) — MC path passes cap 2 (3398) → stage never reaches the rec gate (>=3).
 *   recallGrade(got)(3437)  — the ONLY rec minter: bumps stage, and `if (!wasProven && stage>=3) rec[k]++`
 *                             (3449). The wasProven guard makes each distinct card count exactly once.
 *
 * Recall rail recipe (probe-hardened, reusable): per DISTINCT card — set stage[k][qh]=2 (graduate to the
 * gate) → presentCard(qh) (sets deckIdx to that card) → revealed=true → recallGrade(true) (crosses 2→3,
 * mints rec once). PROBE GOTCHA (not an app bug): re-grading the SAME card after RE-setting stage to 2
 * makes wasProven see stage 2 and rec inflate — a probe artifact. The anti-inflation control therefore
 * re-presents + re-grades WITHOUT the stage reset, so wasProven sees the already-crossed stage and rec
 * holds. Assertions are STRUCTURAL only (counts, stages, map values) — never card/answer TEXT (MC waves
 * rewrite copy).
 */

const KEY = "Mount|Top" // the landed position's deck (Position cat, 8 cards): enough for 3 distinct
// recall cards + a see/prep card, and DISTINCT from firstRollDay1's seed (prep["Mount|Bottom"]=2),
// so this deck starts rec-empty and its 3rd distinct recall is the player's first-ever mastery.

test("near-fresh player: first mastery is minted only at the 3rd distinct recall — seeing and MC leave masteredCount flat", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))

  const j = journey(page)
  // firstRollDay1(): prep["Mount|Bottom"]=2, rec empty → masteredCount() === 0. A player who has
  // dabbled in one lesson but proven nothing — about to earn their first-ever mastery elsewhere.
  await j.boot("/", { initialState: firstRollDay1() })
  await j.land("Mount Top")

  // Clean deck context via the study-modal rail: openStudy sets drillEntries/_posKey and calls
  // renderDrill(), populating this.deck / this._deckInfo that recallGrade reads.
  await page.evaluate((k) => (window as any).__neural.openStudy(k), KEY)

  // ── PRISTINE START: this is the player's FIRST mastery — nothing proven yet. ──
  const m0 = await page.evaluate(() => (window as any).__neural.masteredCount())
  expect(m0, "near-fresh player has earned no mastery yet — masteredCount() === 0").toBe(0)
  expect(
    await page.evaluate((k) => (window as any).__neural.rec[k] || 0, KEY),
    "the deck under test starts rec-empty (distinct from the seeded Mount|Bottom prep)",
  ).toBe(0)

  // ── BEAT 1 — SEEING IS 'SEEN' ONLY: revealing a card credits nothing toward mastery. ──
  await page.evaluate((k) => (window as any).__neural.noteCardSeen(k, 0), KEY)
  const afterSeen = await page.evaluate(
    (k) => {
      const a = (window as any).__neural
      return { mastered: a.masteredCount(), rec: a.rec[k] || 0 }
    },
    KEY,
  )
  expect(afterSeen.mastered, "revealing a card leaves masteredCount flat (reveal = seen, not mastered)").toBe(m0)
  expect(afterSeen.rec, "reveal never touches rec — seeing is not proving").toBe(0)

  // ── BEAT 2 — PREP / MC WORK FEEDS ODDS BUT NEVER MINTS MASTERY: grade one card 3× through the
  // prep choke (the same rail the DSL drill() and an MC-correct use). Stage caps at 2 (the recall
  // gate); prep rises; masteredCount and rec stay put. ──
  await page.evaluate((k) => {
    const a = (window as any).__neural
    const card = a.deck[0]
    const qh = a.qhash(card.q)
    for (let i = 0; i < 3; i++) {
      a.prep[k] = (a.prep[k] || 0) + 1
      // mirror the MC cap (_mcAnswer bumps with cap 2): stage can never cross the recall gate via MC.
      a._bumpStage(k, card.q, 1, 2)
      a.noteCardDone(card, k)
    }
    ;(a as any).__probeQh = qh // stash for the stage read below (structural, not content)
  }, KEY)
  const afterPrep = await page.evaluate(
    (k) => {
      const a = (window as any).__neural
      const qh = (a as any).__probeQh
      return { prep: a.prep[k] || 0, stage: (a.stage[k] || {})[qh] || 0, mastered: a.masteredCount(), rec: a.rec[k] || 0 }
    },
    KEY,
  )
  expect(afterPrep.prep, "prep/MC work earns odds credit (prep >= 3)").toBeGreaterThanOrEqual(3)
  expect(afterPrep.stage, "prep/MC caps the per-card stage at 2 — the recall gate, never crossed").toBe(2)
  expect(afterPrep.mastered, "3 prep grades leave masteredCount flat — mastery is not prep").toBe(m0)
  expect(afterPrep.rec, "prep/MC never mint rec: only recall does").toBe(0)

  // ── BEAT 3 — THE RECALL GATE, ONE DISTINCT CARD AT A TIME: the crossing is minted EXACTLY at the
  // 3rd distinct card. Per card: graduate to the gate (stage=2) → present it → reveal → recallGrade,
  // which crosses stage 2→3 and mints rec ONCE (wasProven guard). masteredCount = decks with rec>=3. ──
  const proveNthDistinct = (n: number) =>
    page.evaluate(
      ([k, idx]) => {
        const a = (window as any).__neural
        const card = a.deck[idx as number]
        const qh = a.qhash(card.q)
        ;(a.stage[k] = a.stage[k] || {})[qh] = 2 // graduate this card to the recall gate
        a.presentCard(qh) // sets deckIdx to this card (recallGrade grades deck[deckIdx])
        a.revealed = true
        a.recallGrade(true) // crosses 2→3 → rec += 1 for this distinct card
        return { rec: a.rec[k] || 0, mastered: a.masteredCount() }
      },
      [KEY, n] as const,
    )

  // NOTE: card index 0 was the prep/MC card above (stage 2, rec-uncredited). Proving it as the FIRST
  // distinct recall card is legitimate — the gate has never crossed it, so it counts once here.
  const rec1 = await proveNthDistinct(0)
  expect(rec1.rec, "1st distinct recall: rec reaches 1").toBe(1)
  expect(rec1.mastered, "1 recalled card is not a mastered deck yet — masteredCount still flat").toBe(m0)

  const rec2 = await proveNthDistinct(1)
  expect(rec2.rec, "2nd distinct recall: rec reaches 2").toBe(2)
  expect(rec2.mastered, "2 recalled cards still below the rec>=3 mastery gate — masteredCount flat").toBe(m0)

  const rec3 = await proveNthDistinct(2)
  expect(rec3.rec, "3rd distinct recall: rec reaches 3 (the mastery gate)").toBe(3)
  // THE HEADLINE: the first mastery this player ever earns is minted at this exact crossing, and it
  // raises masteredCount by EXACTLY 1 (not >=1) — one recalled deck, one mastery.
  expect(rec3.mastered, "the 3rd distinct recall mints the player's FIRST mastery — masteredCount === m0 + 1 EXACTLY").toBe(
    m0 + 1,
  )

  // ── ANTI-INFLATION CONTROL: re-present + re-grade an ALREADY-PROVEN card WITHOUT resetting its
  // stage. wasProven sees stage already >=3, so rec holds at 3 and masteredCount holds at m0+1 — the
  // "exactly 1" above has teeth (re-grading cannot inflate the first mastery into a phantom second). ──
  const afterRegrade = await page.evaluate(
    (k) => {
      const a = (window as any).__neural
      const card = a.deck[0] // the first proven card — its stage is already >=3, NOT reset here
      const qh = a.qhash(card.q)
      a.presentCard(qh)
      a.revealed = true
      a.recallGrade(true) // wasProven true → rec does NOT increment
      return { rec: a.rec[k] || 0, mastered: a.masteredCount() }
    },
    KEY,
  )
  expect(afterRegrade.rec, "re-grading a proven card (no stage reset) does not inflate rec — stays 3").toBe(3)
  expect(afterRegrade.mastered, "the first mastery stays EXACTLY one — no phantom second mint from re-grading").toBe(m0 + 1)

  expect(errors, "no pageerror across boot, land, the study rail, and the whole recall-gate ladder").toEqual([])
})
