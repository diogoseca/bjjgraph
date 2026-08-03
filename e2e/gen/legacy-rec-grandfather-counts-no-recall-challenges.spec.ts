/* @hyperspace {"theme":"challenges-and-belt-bar","L":"legacy-corrupt-blob","F":"recall-gate","B":"economy-math"} @invariant "A migrated v1 blob's grandfathered deck-level rec contributes zero to card-stage recall challenges (blue.recall-five boots at 0/5), and only live recall-proving five distinct cards to stage>=3 completes it, exactly at the fifth." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { legacyV1, CURRICULUM } from "./personas"

/**
 * LEGACY GRANDFATHER MINTS NO CHALLENGE CREDIT — the two-ledger honesty, measured by the
 * Challenges engine itself.
 *
 * The seam (line-verified): `_loadProgress` (app.src.jsx ~1170) migrates a v1 blob by
 * grandfathering `rec = {...prep}` (deck-LEVEL mastery must not collapse on upgrade) while
 * `stage` — the card-LEVEL proof map — stays empty (v1 never had it; migration fabricates
 * nothing). `blue.recall-five` is a SNAPSHOT challenge ({snapshot:"recallCount", target:5},
 * challenge-definitions.src.js:276), and `_challengeSnapshot().recallCount` (app.src.jsx
 * ~4489) counts ONLY `stage[deck][qhash] >= 3` entries — it never reads the rec map. So a
 * migrated profile that arrives with rec worth 15 deck-level points (3 × five unit-1 decks,
 * triple the challenge's 5-target) still boots the challenge at 0/5, and only LIVE recall
 * proof moves it: `recallGrade` (app.src.jsx ~3643) fires `recall_proven` exactly once per
 * distinct card on the 2→3 crossing, `recall_proven` is in NG_SNAPSHOT_BEATS so each proof
 * re-measures the snapshot immediately, and the fifth distinct card — not the fourth, not
 * a re-grade — flips done and emits exactly one challenge_completed for the id.
 *
 * Novelty vs the adjacent legacy spec (legacy-v1-asks-landing-question, same L/F): that one
 * proves the LANDING still asks on a rec-minted deck (questionFor gates on cardStage). This
 * one points the same two-ledger fact at the CHALLENGES economy: the grandfathered rec is
 * challenge-invisible, and the blue.recall-five counter is driven card-by-card to its exact
 * completion boundary. The closing assertion is the sharpest form: after five proofs
 * rec[L0] reads 8 (3 grandfathered + 5 live mints) while recallCount reads exactly 5 — the
 * engine demonstrably read the card ledger, never the rec map, even while they disagreed.
 *
 * keepTutorial GOTCHA (why completion is scoped BY ID, never by total challenge_completed
 * count): with keepTutorial:true this journey legitimately completes several White
 * compatibility objectives en route — white.coach1 (land), white.challenges (toggleExplorer
 * → challenges_opened), white.pane-open (lesson drill open → pane_paused), white.recall
 * (first recall_proven), white.lesson (recallGrade's prep++ crossing the deck goal →
 * lesson_done). Each emits its own challenge_completed beat. Every completion assertion
 * therefore filters `beat === "challenge_completed" && id === "blue.recall-five"`.
 *
 * Determinism census: no rigging beyond land()'s built-ins (ai-skill/role/max-moves). No
 * commit ever happens — zero resolve/outcome draws. The v1.68 landing MC is deliberately
 * left UNRIGGED and UNANSWERED (house rail, same as landing-card.spec.ts): its draws live
 * on the land-scoped tags and an unanswered question touches no stage entry, so the
 * recallCount ladder counts only our five crossings. All assertions are STRUCTURAL —
 * stages, counts, beat ids, deckKeys from curriculum.json — never card/answer text.
 */

const CHALLENGE = "blue.recall-five"
// unit-1 lesson deckKeys from the curriculum (the exact keys legacyV1 seeds prep=3 on)
const U0_KEYS: string[] = CURRICULUM.belts[0].units[0].lessons.map((l: any) => l.deckKey)
const L0: string = U0_KEYS[0] // first lesson deck ("Mount|Bottom", 8 cards — enough for 5 distinct)

test("grandfathered v1 rec boots blue.recall-five at 0/5; five live card-proofs complete it exactly at the fifth", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))

  const j = journey(page)
  await j.boot("/", { initialState: legacyV1(), keepTutorial: true })

  // ── BOOT: migration ran, rec is minted from prep, yet the challenge sees NOTHING ──
  const boot = await page.evaluate(
    ([keys, cid]) => {
      const a = (window as any).__neural
      return {
        v: a._progressBlob().v,
        recByKey: (keys as string[]).map((k) => a.rec[k] ?? null),
        recSum: (keys as string[]).reduce((s, k) => s + (a.rec[k] || 0), 0),
        stageKeys: Object.keys(a.stage || {}).length,
        recallCount: a._challengeSnapshot().recallCount,
        prog: a.challengeProgress(cid as string),
      }
    },
    [U0_KEYS, CHALLENGE] as const,
  )
  expect(boot.v, "the blob writes back as v2 — migration ran").toBe(2)
  for (let i = 0; i < U0_KEYS.length; i++)
    expect(boot.recByKey[i], `rec grandfathered = prep on ${U0_KEYS[i]}`).toBe(3)
  expect(boot.recSum, "grandfathered deck-level rec totals 3 per unit-1 deck").toBe(3 * U0_KEYS.length)
  expect(boot.recSum, "…which already dwarfs the challenge's 5-target (non-vacuous)").toBeGreaterThanOrEqual(5)
  expect(boot.stageKeys, "v1 carries no stage — migration fabricates no card-level proof").toBe(0)
  expect(boot.recallCount, "the snapshot counts stage>=3 cards only — grandfathered rec is invisible").toBe(0)
  expect(boot.prog, "blue.recall-five resolves to a live challenge entry").toBeTruthy()
  expect(boot.prog.progress, "blue.recall-five boots at 0 despite 15 points of deck-level rec").toBe(0)
  expect(boot.prog.done, "and it is not done").toBe(false)

  // ── open the lesson drill through the real UI: explorer → white track → L0 row ──
  await j.land("Mount Top")
  await page.evaluate(() => (window as any).__neural.toggleExplorer())
  const row = page.locator(`[data-lesson="${L0}"]`).first()
  await expect(row, "the first white lesson row renders in the challenges view").toBeVisible()
  await row.click() // openLessonStudy → prezi flight + drill open
  await j.advance(800)
  const drill = await page.evaluate(() => {
    const a = (window as any).__neural
    return { key: a._deckInfo?.key ?? null, cards: (a.deck || []).length }
  })
  expect(drill.key, "the open drill is the L0 lesson deck").toBe(L0)
  expect(drill.cards, "the deck holds at least the 5 distinct cards this ladder needs").toBeGreaterThanOrEqual(5)

  // ── THE LADDER: five distinct cards, each MC-graduated to the gate (stage cap 2) then
  // recall-proven across 2→3. After every proof the challenge is re-measured immediately
  // (recall_proven ∈ NG_SNAPSHOT_BEATS) — progress must read i+1 EXACTLY, done only at 5. ──
  const proveCard = (idx: number) =>
    page.evaluate(
      ([k, i, cid]) => {
        const a = (window as any).__neural
        const card = a.deck[i as number]
        a._bumpStage(k as string, card.q, 1, 2) // MC-graduation path: cap 2,
        const gated = a._bumpStage(k as string, card.q, 1, 2) // twice — pinned AT the gate
        a.presentCard(a.qhash(card.q)) // sets deckIdx to this card
        a.revealed = true
        a.recallGrade(true) // the ONLY rec minter: crosses 2→3, fires recall_proven
        return {
          gated,
          postStage: a.cardStage(k as string, card.q),
          proven: (a.beats || []).filter((b: any) => b.beat === "recall_proven").length,
          prog: a.challengeProgress(cid as string),
          completedForId: (a.beats || []).filter(
            (b: any) => b.beat === "challenge_completed" && b.id === cid,
          ).length,
          recallCount: a._challengeSnapshot().recallCount,
          recL0: a.rec[k as string] || 0,
        }
      },
      [L0, idx, CHALLENGE] as const,
    )

  for (let i = 0; i < 5; i++) {
    const step = await proveCard(i)
    expect(step.gated, `card ${i + 1}: MC path caps the stage at 2 — the recall gate`).toBe(2)
    expect(step.postStage, `card ${i + 1}: recallGrade crossed it to stage>=3`).toBeGreaterThanOrEqual(3)
    expect(step.proven, `card ${i + 1}: one recall_proven per distinct crossing — total ${i + 1}`).toBe(i + 1)
    expect(step.recallCount, `card ${i + 1}: the snapshot counts exactly the live crossings`).toBe(i + 1)
    expect(step.prog.progress, `card ${i + 1}: blue.recall-five reads ${i + 1} EXACTLY`).toBe(i + 1)
    expect(step.recL0, `card ${i + 1}: rec = 3 grandfathered + ${i + 1} live mints`).toBe(3 + i + 1)
    if (i < 4) {
      expect(step.prog.done, `card ${i + 1}: not done before the fifth`).toBe(false)
      expect(step.completedForId, `card ${i + 1}: ZERO blue.recall-five completions yet`).toBe(0)
    } else {
      // THE HEADLINE: the FIFTH distinct live proof — and nothing earlier — completes it.
      expect(step.prog.done, "the fifth distinct card flips blue.recall-five done").toBe(true)
      expect(step.prog.progress, "at exactly its 5-target").toBe(5)
      expect(step.completedForId, "with EXACTLY ONE challenge_completed for the id").toBe(1)
      // two-ledger separation at its sharpest: rec says 8, the challenge counted 5 — the
      // engine read the card ledger, never the rec map, even while they disagreed.
      expect(step.recL0, "deck-level rec now reads 8 (3 grandfathered + 5 live)").toBe(8)
      expect(step.recallCount, "yet the challenge's source of truth reads exactly 5").toBe(5)
    }
  }

  expect(errors, "no pageerror across boot, migration, the drill, and the whole ladder").toEqual([])
})
