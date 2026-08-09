/* @hyperspace {"theme":"challenges-and-belt-bar","L":"srs-veteran","F":"drill-mc","B":"guard-limit"} @invariant "purple.master-three's masteredDeckCount counts only full-recall decks: MC-correcting every card of a deck to the stage-2 cap leaves the counter at zero even after a snapshot recompute, and recall-pushing the same cards to stage 3 flips it to one." */
import { test, expect } from "@playwright/test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { allDecks } from "../decks"
import { journey } from "../dsl"
import { srsVeteran, CURRICULUM } from "./personas"

/**
 * MC-CAPPED DECK NEVER COUNTS MASTERED — the recognition ceiling, measured by the
 * purple.master-three challenge itself.
 *
 * The seam (line-verified): `_mcAnswer` (app.src.jsx ~3603) bumps a correct card via
 * `_bumpStage(key, q, 1, 2)` — MC caps AT the recall gate. `deckMastery` (~2656) is
 * mean(min(stage,3)/3) over the deck's cards, so an all-MC deck tops out at exactly 2/3.
 * `_challengeSnapshot().masteredDeckCount` (~4506) counts stage-map decks with
 * `deckMastery(key) >= 1` — an MC-capped deck is arithmetically invisible to it.
 * `purple.master-three` is a SNAPSHOT challenge ({snapshot:"masteredDeckCount"}, target 3,
 * challenge-definitions.src.js:282) and `recall_proven` ∈ NG_SNAPSHOT_BEATS, so every live
 * recall proof re-measures the counter through `ngAdvanceChallenges`. The invariant is the
 * belt-bar rule at deck granularity: recognition (MC) can never mint "Mastered" — only
 * recall-crossing every card to stage 3 flips the deck, and the LAST card's own
 * recall_proven snapshot is what ratchets the challenge to 1/3.
 *
 * Belt-and-braces recompute proof: MC-ing the whole lesson crosses its prep goal and fires
 * `lesson_done` — ITSELF a snapshot beat — so a genuine snapshot recompute happens
 * mid-phase-1 while the deck sits at the cap (counter holds 0). The later recall_proven on
 * a DIFFERENT deck (the landing position's own deck, mastery 1/8 after its single proof)
 * is a second, independent recompute that still measures 0.
 *
 * Target deck (derived, never hardcoded): the smallest fully-mcClip-able lesson deck
 * OUTSIDE srsVeteran's seeded first 25 — derived from the CURRICULUM triple-loop plus the
 * flashcards.json fixture with a Node-side replica of `mcClip` (first sentence ≤160). At
 * authoring time this lands on a 5-card Attacker deck; the spec only ever asserts counts,
 * stages and deckKeys — no card/answer text (MC waves rewrite content freely).
 *
 * keepTutorial GOTCHA: the veteran journey legitimately completes several White
 * compatibility objectives en route; every challenge assertion is therefore scoped to
 * "purple.master-three" by id, and beat counts are scoped by deckKey.
 *
 * Determinism census: land()'s built-ins (ai-skill/role/max-moves) + the v1.68 surface-split
 * MC tags. The landing question draws on land-mc-pick/land-mc-shuffle (rigged BEFORE land —
 * the veteran's EMPTY stage map means the landing card DOES ask) and is left unanswered
 * (touches no stage entry). The sidebar drill draws on mc-pick/mc-shuffle — rigged with
 * deep pre-sized queues (authored {p,t} tiers mean pooling normally draws nothing from
 * mc-pick; the depth guards a future fixture without tiers) and the closing remainder>0
 * check proves no draw ever fell through to the RNG fallback. [data-mc-opt] is the
 * sidebar-only handle — the landing card renders [data-land-mc-opt], so no cross-match.
 * Test mode suppresses the 600ms MC auto-advance, so manual presentCard re-presents work.
 */

// v1.80.4: no flashcards.json monolith — the corpus is assembled from the per-deck chunks
const FLASHCARDS = { decks: allDecks() }

const CHALLENGE = "purple.master-three"
const SEED_DECKS = 25 // srsVeteran()'s default — the decks whose prep/rec arrive pre-seeded

// Node-side replica of app mcClip (first sentence, ≤160 chars) — derivation only
const mcClip = (a: unknown): string | null => {
  const m = String(a ?? "").match(/^[\s\S]*?[.!?]/)
  const s = (m ? m[0] : String(a ?? "")).trim()
  return s.length > 0 && s.length <= 160 ? s : null
}

// srsVeteran's seeded set, replicated exactly (same triple-loop, same order, same 25)
const SEEDED = new Set<string>()
{
  let n = 0
  outer: for (const belt of CURRICULUM.belts)
    for (const u of belt.units)
      for (const l of u.lessons) {
        SEEDED.add(l.deckKey)
        if (++n >= SEED_DECKS) break outer
      }
}

// smallest fully-mcClip-able lesson deck outside the seeded 25 (5-card deck at authoring)
let TARGET: string | null = null
let TARGET_CARDS = 0
for (const belt of CURRICULUM.belts)
  for (const u of belt.units)
    for (const l of u.lessons) {
      if (SEEDED.has(l.deckKey)) continue
      const d = FLASHCARDS.decks?.[l.deckKey]
      if (!d?.cards?.length) continue
      if (!d.cards.every((c: any) => mcClip(c.a))) continue
      if (!TARGET || d.cards.length < TARGET_CARDS) {
        TARGET = l.deckKey
        TARGET_CARDS = d.cards.length
      }
    }

// deterministic pre-sized rig queues — values in (0,1), no runtime randomness anywhere
const ramp = (n: number, mul: number) =>
  Array.from({ length: n }, (_, i) => (((i * mul) % 89) + 0.5) / 90)

test("MC-capping every card leaves masteredDeckCount at 0 through two snapshot recomputes; recall-pushing the same cards flips purple.master-three to 1/3", async ({
  page,
}) => {
  test.skip(
    !TARGET,
    "no fully-mcClip-able lesson deck outside the veteran's seeded 25 in this fixture",
  )
  const TKEY = TARGET as string
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))

  const j = journey(page)
  await j.boot("/", { initialState: srsVeteran(), keepTutorial: true })
  // BEFORE land: the veteran's stage map is EMPTY, so the landing card asks — its draws
  // live on the land-scoped tags (surface-split RNG; it can never eat the mc-* queues)
  await j.rig("land-mc-pick", ramp(300, 37))
  await j.rig("land-mc-shuffle", ramp(24, 11))
  await j.land("Mount Top")
  expect(
    await page.locator("[data-land-q]").count(),
    "the empty stage map makes the landing card ask (rigged draws consumed, never answered)",
  ).toBeGreaterThanOrEqual(1)

  // sidebar MC surface: mcMode defaults to classic since v1.68.0 — opt in explicitly
  await page.evaluate(() => (window as any).__neural.set("mcMode", "auto"))
  await j.rig("mc-pick", ramp(1500, 53))
  await j.rig("mc-shuffle", ramp(90, 7))

  // ── BOOT TRUTH: 25 seeded decks, zero stage entries, the challenge untouched ──
  const boot = await page.evaluate((cid) => {
    const a = (window as any).__neural
    const snap = a._challengeSnapshot()
    const trigger = a.deckKeyFor(a.nodes[a.currentPos]).key
    return {
      stageKeys: Object.keys(a.stage || {}).length,
      lessonCount: snap.lessonCount,
      mastered: snap.masteredDeckCount,
      prog: a.challengeProgress(cid),
      stored: (a.challenges || {})[cid] ?? null,
      trigger,
      triggerCards: (a.flashcards.decks[trigger]?.cards || []).length,
    }
  }, CHALLENGE)
  expect(boot.stageKeys, "the veteran arrives with an EMPTY card-stage map").toBe(0)
  expect(boot.lessonCount, "the 25 seeded decks arrive lesson-done (prep=5 ≥ goal)").toBe(SEED_DECKS)
  expect(boot.mastered, "no stage entries → zero mastered decks").toBe(0)
  expect(boot.prog?.progress, "purple.master-three boots at 0").toBe(0)
  expect(boot.prog?.done, "and is not done").toBe(false)
  expect(boot.stored, "…with NO stored entry (snapshot at 0 writes nothing)").toBeNull()
  expect(boot.trigger, "the trigger deck is a different deck than the target").not.toBe(TKEY)
  expect(
    boot.triggerCards,
    "the trigger deck holds ≥2 cards, so one proof can never master it",
  ).toBeGreaterThanOrEqual(2)

  // ── PHASE 1: MC-correct every card of the target deck twice → all stages AT the cap ──
  // openStudy is the same rail the deck rows call — the target lesson sits outside the
  // veteran's frontier, so the drill is opened directly on its deckKey.
  await page.evaluate((k) => (window as any).__neural.openStudy(k), TKEY)
  await j.advance(300)
  const qhs: number[] = await page.evaluate(() => {
    const a = (window as any).__neural
    return (a.deck || []).map((c: any) => a.qhash(c.q))
  })
  expect(qhs.length, "the derived deck is fully loaded in the drill").toBe(TARGET_CARDS)

  for (let ci = 0; ci < qhs.length; ci++) {
    for (let round = 0; round < 2; round++) {
      // truth lives in a._mc (surface "deck") — the DOM never carries the correct index
      const truth = await page.evaluate((q) => {
        const a = (window as any).__neural
        a.presentCard(q)
        return a._mc
          ? { correct: a._mc.correct, surface: a._mc.surface, qhash: a._mc.qhash }
          : null
      }, qhs[ci])
      expect(truth, `card ${ci + 1} round ${round + 1}: presents as sidebar MC`).toBeTruthy()
      expect(truth!.surface, "the block is the deck surface, not the landing card").toBe("deck")
      expect(truth!.qhash, "the live block is the presented card").toBe(qhs[ci])
      await page.locator("[data-mc-opt]").nth(truth!.correct).click()
      await j.advance(120)
    }
    const stage = await page.evaluate(
      ([k, q]) => ((window as any).__neural.stage[k as string] || {})[q as number] || 0,
      [TKEY, qhs[ci]] as const,
    )
    expect(stage, `card ${ci + 1}: two MC corrects pin the stage AT the cap (2)`).toBe(2)
  }

  // ── THE CAPPED PLATEAU: 2/3 mastery, and TWO snapshot recomputes both measure ZERO ──
  const capped = await page.evaluate(
    ([k, cid]) => {
      const a = (window as any).__neural
      const snap = a._challengeSnapshot()
      return {
        stages: (a.deck || []).map((c: any) => (a.stage[k as string] || {})[a.qhash(c.q)] || 0),
        dm: a.deckMastery(k as string),
        rec: a.rec[k as string] || 0,
        mcCorrectForDeck: (a.beats || []).filter(
          (b: any) => b.beat === "mc_correct" && b.deckKey === k,
        ).length,
        lessonDoneForDeck: (a.beats || []).filter(
          (b: any) => b.beat === "lesson_done" && b.deckKey === k,
        ).length,
        lessonCount: snap.lessonCount,
        mastered: snap.masteredDeckCount,
        prog: a.challengeProgress(cid as string),
        stored: (a.challenges || {})[cid as string] ?? null,
      }
    },
    [TKEY, CHALLENGE] as const,
  )
  expect(capped.stages, "every card of the deck sits exactly at the MC cap").toEqual(
    Array(TARGET_CARDS).fill(2),
  )
  expect(capped.mcCorrectForDeck, "exactly 2 mc_correct per card, all on this deck").toBe(
    TARGET_CARDS * 2,
  )
  expect(capped.dm, "deckMastery = mean(min(stage,3)/3) → the all-MC ceiling of 2/3").toBeCloseTo(2 / 3, 9)
  expect(capped.rec, "MC minted zero recall credit").toBe(0)
  // strengthener: the MC work itself crossed the lesson goal → lesson_done, a SNAPSHOT
  // beat — so a recompute already ran mid-phase-1 with the deck at the cap
  expect(capped.lessonDoneForDeck, "MC prep crossed the lesson goal — lesson_done fired").toBe(1)
  expect(capped.lessonCount, "the lesson ledger moved to 26 — that recompute really ran").toBe(SEED_DECKS + 1)
  expect(capped.mastered, "…and masteredDeckCount still measured ZERO").toBe(0)
  expect(capped.prog?.progress, "purple.master-three still reads 0").toBe(0)
  expect(capped.prog?.done, "and is not done").toBe(false)
  expect(capped.stored, "with STILL no stored entry — nothing durable moved").toBeNull()

  // ── PHASE 2: a recall_proven on a DIFFERENT deck forces the exact snapshot recompute
  // the challenge listens for — the capped target deck must remain invisible to it ──
  const proof = await page.evaluate(
    ([k, cid, tk]) => {
      const a = (window as any).__neural
      a.openStudy(k as string) // initial stage-0 render (rigged MC draws, by design)
      const qh = a.qhash(a.deck[0].q)
      ;(a.stage[k as string] = a.stage[k as string] || {})[qh] = 2 // pin AT the recall gate
      a.presentCard(qh) // stage 2 + auto → classic recall UI
      a.revealed = true
      a.recallGrade(true) // the 2→3 crossing → recall_proven (a snapshot beat)
      const snap = a._challengeSnapshot()
      return {
        stage: (a.stage[k as string] || {})[qh] || 0,
        dm: a.deckMastery(k as string),
        provenForTrigger: (a.beats || []).filter(
          (b: any) => b.beat === "recall_proven" && b.deckKey === k,
        ).length,
        targetDm: a.deckMastery(tk as string),
        mastered: snap.masteredDeckCount,
        prog: a.challengeProgress(cid as string),
        stored: (a.challenges || {})[cid as string] ?? null,
      }
    },
    [boot.trigger, CHALLENGE, TKEY] as const,
  )
  expect(proof.stage, "the trigger card crossed to stage ≥3").toBeGreaterThanOrEqual(3)
  expect(proof.provenForTrigger, "exactly one recall_proven on the trigger deck").toBe(1)
  expect(proof.dm, "guard: the trigger deck gained real mastery…").toBeGreaterThan(0)
  expect(proof.dm, "…but a single proof leaves it well below 1 (1/8 at authoring)").toBeLessThan(1)
  expect(proof.targetDm, "the target deck still sits at its 2/3 ceiling").toBeCloseTo(2 / 3, 9)
  // THE HEADLINE, half one: a genuine recall_proven recompute still counts ZERO mastered
  // decks — the MC-capped deck does not exist to the challenge.
  expect(proof.mastered, "masteredDeckCount holds 0 through the recall-driven recompute").toBe(0)
  expect(proof.prog?.progress, "purple.master-three STAYS 0").toBe(0)
  expect(proof.stored, "and its stored entry is STILL null").toBeNull()

  // ── PHASE 3: recall-push the same five capped cards to stage 3 — only the LAST card's
  // own recall_proven snapshot may flip the counter and ratchet the challenge ──
  await page.evaluate((k) => (window as any).__neural.openStudy(k), TKEY)
  await j.advance(200)
  for (let i = 0; i < qhs.length; i++) {
    const step = await page.evaluate(
      ([k, q, cid]) => {
        const a = (window as any).__neural
        a.presentCard(q as number)
        a.revealed = true
        a.recallGrade(true) // 2→3: the only route past the MC ceiling
        const snap = a._challengeSnapshot()
        return {
          stage: (a.stage[k as string] || {})[q as number] || 0,
          dm: a.deckMastery(k as string),
          provenForDeck: (a.beats || []).filter(
            (b: any) => b.beat === "recall_proven" && b.deckKey === k,
          ).length,
          mastered: snap.masteredDeckCount,
          prog: a.challengeProgress(cid as string),
          stored: (a.challenges || {})[cid as string] ?? null,
        }
      },
      [TKEY, qhs[i], CHALLENGE] as const,
    )
    expect(step.stage, `card ${i + 1}: recall crossed the gate to stage ≥3`).toBeGreaterThanOrEqual(3)
    expect(step.provenForDeck, `card ${i + 1}: one recall_proven per distinct card`).toBe(i + 1)
    if (i < qhs.length - 1) {
      expect(step.dm, `card ${i + 1}: the deck is not yet fully recalled`).toBeLessThan(1)
      expect(step.mastered, `card ${i + 1}: partial recall still counts ZERO mastered decks`).toBe(0)
      expect(step.prog?.progress, `card ${i + 1}: the challenge has not moved`).toBe(0)
      expect(step.stored, `card ${i + 1}: nothing stored before the boundary`).toBeNull()
    } else {
      // THE HEADLINE, half two: the FIFTH card — and nothing earlier — flips the deck.
      expect(step.dm, "full recall: deckMastery reads exactly 1").toBe(1)
      expect(step.mastered, "masteredDeckCount flips 0 → 1 on the last card's own snapshot").toBe(1)
      expect(step.prog?.progress, "purple.master-three ratchets to 1").toBe(1)
      expect(step.prog?.done, "of its 3-target — not done").toBe(false)
      expect(step.stored, "and the entry is now DURABLY stored").toBeTruthy()
      expect(step.stored.progress, "stored progress reads 1").toBe(1)
      expect(step.stored.done, "stored done reads false").toBe(false)
    }
  }

  // ── DETERMINISM PROOF: every rigged queue still holds values — no draw ever fell
  // through to the RNG fallback on any of the four MC tags ──
  const rig = await page.evaluate(() => {
    const r = (window as any).__neural._rig || {}
    const left = (t: string) => (r[t] || []).length
    return {
      mcPick: left("mc-pick"),
      mcShuffle: left("mc-shuffle"),
      landPick: left("land-mc-pick"),
      landShuffle: left("land-mc-shuffle"),
    }
  })
  expect(rig.mcPick, "mc-pick queue never drained").toBeGreaterThan(0)
  expect(rig.mcShuffle, "mc-shuffle queue never drained").toBeGreaterThan(0)
  expect(rig.landPick, "land-mc-pick queue never drained").toBeGreaterThan(0)
  expect(rig.landShuffle, "land-mc-shuffle queue never drained").toBeGreaterThan(0)

  expect(errors, "no pageerror across boot, both drills, and every recompute").toEqual([])
})
