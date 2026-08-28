/* @hyperspace {"theme":"challenges-and-belt-bar","L":"multi-belt-endgame","F":"recall-gate","B":"guard-limit"} @invariant "Forgetting moves the meter but never the evidence ledger: demoting a fully-recalled deck's card stages drops gameScore and the lesson crown, yet purple.master-three stays done (the `done = before.done || ...` ratchet) and its minted rewards remain." */
import { test, expect } from "@playwright/test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { allDecks } from "../decks"
import { journey } from "../dsl"
import { multiBeltEndgame, CURRICULUM, curriculumWeights } from "./personas"

/**
 * ENDGAME — THE METER FALLS, THE LEDGER NEVER DOES.
 *
 * v1.69's owner canon says "the line can fall": forgetting is tested, not timed, and a demoted
 * card genuinely drops gameScore, the belt, and the lesson crown. The Challenges economy is the
 * deliberate counterweight — evidence once banked is FINAL. This spec drives both truths through
 * one demotion and pins the seam between them:
 *
 *   LIVE METER (falls):    gameScore() (app.src.jsx:2663, memoised on _stageVer; _bumpStage:3461
 *                          bumps it) and crownBadge (:2689, data-crown = floor(deckMastery*4))
 *                          both read stage[deck][qhash] directly — demotion moves them at once.
 *   EVIDENCE LEDGER (ratchets): ngAdvanceChallenges (challenge-engine.src.js:40) computes
 *                          `done = before.done || progress >= target` — a done snapshot challenge
 *                          can never un-complete — and :36 `progress = max(progress, measured)`
 *                          holds partial progress over a shrunken measurement. Rewards
 *                          (ngRewardChanges) only ever ADD badges/coins; no removal site exists.
 *
 * SEED (Node-side, byte-for-byte): stage keys are REAL FNV-1a hashes of flashcards.json card
 * questions — qhash replicated from app.src.jsx:3450 (h=0x811c9dc5; h^=charCode;
 * h=Math.imul(h,0x01000193)>>>0; hex-pad 8). Four 8-card curriculum lesson decks all-stage-3 →
 * recallCount 32 ≥ 30 completes brown.recall-thirty AT THE BOOT SNAPSHOT and mints the
 * thirty-from-memory badge SILENTLY (noteChallenges suppresses fx when beat==="challenge_snapshot",
 * app.src.jsx:4566 — so the badge is asserted via app.badges keys, never via beats), and
 * masteredDeckCount 4 ≥ 3 completes purple.master-three. Only |Attacker decks carry
 * curriculum.weights — Mount|Top counts for mastered/recall evidence but not gameScore — and
 * Mount|Top being fully proven also means the v1.68 landing asks nothing (questionFor finds no
 * cardStage<2 card), so the whole journey is roll-free and rig-free beyond land()'s built-ins.
 *
 * BOOT GOTCHA (probe-verified): the load path already fires _refreshChallengeEvidence
 * (app.src.jsx:1223), so master-three can be done BEFORE any explicit beat — assertions on
 * challengeProgress come after our explicit fx("recall_proven") fire, never as "pending before".
 * That first fire also completes white.recall (keepTutorial leaves it open; event:"recall_proven",
 * target 1) — deliberately consumed PRE-window so the post-demotion re-measure can't mint it.
 *
 * DEMOTION: two |Attacker decks via the app's own downgrade seam, _bumpStage(key, q, -1) per card
 * (the Review-again/trap path) — measured evidence falls BELOW both targets (masteredDeckCount
 * 2<3, recallCount 16<30), making both ratchets genuinely load-bearing when a fresh
 * recall_proven snapshot re-measures through the SAME engine choke.
 *
 * Assertions are STRUCTURAL only — snapshot counts, challenge ids, deckKeys from curriculum.json,
 * data-crown levels — never card/answer text (MC waves rewrite copy).
 */

// v1.80.4: no flashcards.json monolith — the corpus is assembled from the per-deck chunks
const FLASH = { decks: allDecks() }
// byte-for-byte replica of app.src.jsx:3450 qhash — FNV-1a over the question text
const qhash = (q: string) => {
  let h = 0x811c9dc5
  for (let i = 0; i < q.length; i++) {
    h ^= q.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return ("0000000" + h.toString(16)).slice(-8)
}

const DEMOTED = ["Elbow Escape from Mount|Attacker", "Frame from Side Control|Attacker"] // weighted → their fall moves gameScore
const HELD = "Hip Escape from Back Control|Attacker" // weighted, untouched → post-score stays > 0 (non-vacuous fall)
const POSITION_DECK = "Mount|Top" // weighted since v1.145.13; silences the landing question at Mount Top
const DECKS = [...DEMOTED, HELD, POSITION_DECK]
const CROWN_DECKS = [...DEMOTED, HELD] // white-track lesson rows whose crowns we read

test("demoting recalled decks drops score and crowns while master-three, its ratchets, and minted rewards all hold", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))

  // ── Node-side premises: the four decks are real white-track curriculum lessons, 8 cards each,
  // and the weights table carries exactly the |Attacker three (Mount|Top is evidence-only). ──
  const whiteLessonKeys = new Set(
    CURRICULUM.belts[0].units.flatMap((u: any) => u.lessons.map((l: any) => l.deckKey)),
  )
  const stage: Record<string, Record<string, number>> = {}
  let cardTotal = 0
  for (const k of DECKS) {
    expect(whiteLessonKeys.has(k), `${k} is a white-track curriculum lesson deck`).toBe(true)
    const deck = FLASH.decks[k]
    expect(deck?.cards?.length, `${k} deck exists with 8 cards`).toBe(8)
    stage[k] = {}
    for (const c of deck.cards) stage[k][qhash(c.q)] = 3
    cardTotal += deck.cards.length
  }
  expect(cardTotal, "32 recall-proven cards — clears brown.recall-thirty's 30 at boot").toBe(32)
  // v1.145.13: the table spans the whole corpus, so a position deck is weighted like anything
  // else -- it used to be asserted UNWEIGHTED here. `curriculumWeights` expands the compact wire.
  const WEIGHTS = curriculumWeights()
  expect(Object.keys(WEIGHTS).length, "the table is populated").toBeGreaterThan(2500)
  for (const k of [...DEMOTED, HELD, POSITION_DECK])
    expect(WEIGHTS[k], `${k} carries a gameScore weight`).toBeGreaterThan(0)

  const j = journey(page)
  await j.boot("/", {
    keepTutorial: true, // white.recall stays open — our explicit fire consumes it PRE-window
    initialState: { ...(multiBeltEndgame() as any), stage },
  })

  // ── BOOT: the seed landed byte-exact and the boot snapshot minted rewards SILENTLY. ──
  const boot = await page.evaluate(() => {
    const a = (window as any).__neural
    const snap = a._challengeSnapshot()
    const beats = (a.beats || []) as any[]
    return {
      recallCount: snap.recallCount,
      masteredDeckCount: snap.masteredDeckCount,
      badgeKeys: Object.keys(a.badges || {}),
      patchBeats: beats.filter((b) => b.beat === "patch_earned").length,
      coinBeats: beats.filter((b) => b.beat === "coin_earned").length,
      snapshotCompletionsLoud: beats.filter(
        (b) =>
          b.beat === "challenge_completed" &&
          (b.id === "brown.recall-thirty" || b.id === "purple.master-three"),
      ).length,
    }
  })
  // recallCount 32 is the vacuity witness for the seed: all 32 Node-side FNV-1a hashes matched
  // the app's own qhash — a single divergent hash would read as an uncounted card here.
  expect(boot.recallCount, "all 32 seeded stage hashes matched the app's qhash").toBe(32)
  expect(boot.masteredDeckCount, "four decks measure fully mastered at boot").toBe(4)
  expect(boot.badgeKeys, "thirty-from-memory minted at the boot snapshot").toContain("thirty-from-memory")
  expect(boot.patchBeats, "…SILENTLY: zero patch_earned beats (challenge_snapshot suppresses fx)").toBe(0)
  expect(boot.coinBeats, "and zero coin_earned beats").toBe(0)
  expect(boot.snapshotCompletionsLoud, "boot-snapshot completions never speak as beats").toBe(0)

  // ── LAND at Mount Top: fully-proven Mount|Top means the landing asks NOTHING (questionFor
  // finds no cardStage<2 card) — zero land-mc-* draws, so no rigs beyond land()'s built-ins. ──
  await j.land("Mount Top")
  expect(
    await page.evaluate(() => !!document.querySelector("[data-land-q]")),
    "the landing asks no question on a fully-proven deck",
  ).toBe(false)
  // drop the landing card — documented harness-only obstruction over explorer rows (see
  // returner-failed-recall-never-demotes-mastery header); it is not a surface under test here
  await page.evaluate(() => (window as any).__neural.clearLandCard())

  // ── EXPLICIT SNAPSHOT BEAT: recall_proven ∈ NG_SNAPSHOT_BEATS routes a real measured snapshot
  // through noteChallenges. Assert AFTER the fire (boot may already have measured — the gotcha). ──
  const afterFire = await page.evaluate((held) => {
    const a = (window as any).__neural
    a.fx("recall_proven", { deckKey: held })
    return {
      masterThree: a.challengeProgress("purple.master-three"),
      masterEight: a.challengeProgress("brown.master-eight"),
      whiteRecallCompletions: ((a.beats || []) as any[]).filter(
        (b) => b.beat === "challenge_completed" && b.id === "white.recall",
      ).length,
    }
  }, HELD)
  expect(afterFire.masterThree.done, "purple.master-three is done (4 mastered ≥ 3)").toBe(true)
  expect(afterFire.masterThree.progress, "and reads its full target (ngProgressEntry when done)").toBe(3)
  expect(afterFire.masterEight.done, "brown.master-eight is honestly incomplete (4 < 8)").toBe(false)
  expect(afterFire.masterEight.progress, "holding measured progress 4").toBe(4)
  // window hygiene: the ONE completion recall_proven can ever mint (white.recall, target 1) is
  // consumed here, pre-window — the post-demotion re-fire can complete nothing.
  expect(afterFire.whiteRecallCompletions, "white.recall completed exactly once by this fire").toBe(1)

  // ── PRE-DEMOTION METER: score > 0, every seeded deck at exact mastery 1, crowns at 4. ──
  const pre = await page.evaluate((keys) => {
    const a = (window as any).__neural
    return {
      score: a.gameScore().score,
      mastery: (keys as string[]).map((k) => a.deckMastery(k)),
    }
  }, DECKS)
  expect(pre.score, "three weighted decks at mastery 1 → a strictly positive score").toBeGreaterThan(0)
  for (let i = 0; i < DECKS.length; i++)
    expect(pre.mastery[i], `${DECKS[i]} reads exact deckMastery 1`).toBe(1)

  // real UI into the crown surface: challenges view → explorer list → white track
  await page.evaluate(() => {
    const a = (window as any).__neural
    a.setViewMode("challenges")
    a.openExplorer()
    a.showExplorerList()
  })
  const whiteTrack = page.locator("[data-track='white']")
  await expect(whiteTrack, "the white track card renders in the challenges list").toBeVisible()
  await whiteTrack.click()
  // crowns read via evaluate: rows may sit inside a CLOSED <details> (only unit 0 renders open),
  // so a visibility-gated expect would flake on layout, not on the invariant
  const readCrowns = () =>
    page.evaluate(
      (keys) =>
        (keys as string[]).map(
          (k) =>
            document
              .querySelector(`.ng-challenge-lesson[data-lesson="${k}"] [data-crown]`)
              ?.getAttribute("data-crown") ?? null,
        ),
      CROWN_DECKS,
    )
  expect(await readCrowns(), "all three weighted lessons wear the full crown (mastery 1 → level 4)").toEqual([
    "4",
    "4",
    "4",
  ])

  // ── MARK the no-regression window: beats length + reward key-sets, then FORGET. ──
  const mark = await page.evaluate(() => {
    const a = (window as any).__neural
    return {
      beatLen: ((a.beats || []) as any[]).length,
      badges: Object.keys(a.badges || {}).sort(),
      coins: Object.keys(a.coins || {}).sort(),
    }
  })

  // ── DEMOTE two weighted decks card-by-card through the app's own downgrade seam. ──
  const demoted = await page.evaluate(
    async ({ keys, held }) => {
      const a = (window as any).__neural
      // the cards to demote must be resident first (on-demand residency, v1.80.4)
      await a.hydrateDecks(keys as string[])
      const stages: number[] = []
      for (const k of keys as string[])
        for (const c of a._cardsOf(a.flashcards.decks[k]) || []) stages.push(a._bumpStage(k, c.q, -1))
      const snap = a._challengeSnapshot()
      return {
        stages,
        recallCount: snap.recallCount,
        masteredDeckCount: snap.masteredDeckCount,
        score: a.gameScore().score, // _bumpStage bumped _stageVer → the memo re-derives
        masteryDemoted: (keys as string[]).map((k) => a.deckMastery(k)),
        masteryHeld: a.deckMastery(held),
      }
    },
    { keys: DEMOTED, held: HELD },
  )
  expect(demoted.stages, "16 cards demoted (2 decks × 8)").toHaveLength(16)
  for (const s of demoted.stages) expect(s, "each demotion landed 3→2").toBe(2)
  expect(demoted.recallCount, "measured recall evidence fell below brown.recall-thirty's 30").toBe(16)
  expect(demoted.masteredDeckCount, "measured mastered decks fell below master-three's 3").toBe(2)
  for (const m of demoted.masteryDemoted) expect(m, "demoted deck mastery 1 → 2/3").toBeCloseTo(2 / 3, 10)
  expect(demoted.masteryHeld, "the held deck stays at exact mastery 1").toBe(1)
  expect(demoted.score, "gameScore STRICTLY fell — forgetting moves the meter").toBeLessThan(pre.score)
  expect(demoted.score, "…but not to zero: the held weighted deck still counts").toBeGreaterThan(0)

  // ── RE-MEASURE through the same engine choke: the ledger must not move. ──
  const post = await page.evaluate((held) => {
    const a = (window as any).__neural
    a.fx("recall_proven", { deckKey: held }) // fresh measured snapshot via NG_SNAPSHOT_BEATS
    return {
      masterThree: a.challengeProgress("purple.master-three"),
      masterEight: a.challengeProgress("brown.master-eight"),
      recallThirty: a.challengeProgress("brown.recall-thirty"),
      badgeKeys: Object.keys(a.badges || {}),
    }
  }, HELD)
  // THE HEADLINE: measured evidence reads 2 < 3, yet `done = before.done || ...` holds the grant.
  expect(post.masterThree.done, "purple.master-three STAYS done under failing evidence").toBe(true)
  expect(post.masterThree.progress, "and still reads its full target").toBe(3)
  expect(post.recallThirty.done, "brown.recall-thirty stays done at measured 16 < 30").toBe(true)
  // the sibling ratchet: max(progress, measured) — banked 4 held over a measured 2.
  expect(post.masterEight.done, "brown.master-eight is still honestly incomplete").toBe(false)
  expect(post.masterEight.progress, "its banked progress 4 never fell to the measured 2").toBe(4)
  expect(post.badgeKeys, "the minted thirty-from-memory badge remains").toContain("thirty-from-memory")

  // ── CROWN DOM after renderExplorer(): the meter's fall is visible per-lesson. ──
  await page.evaluate(() => (window as any).__neural.renderExplorer())
  expect(
    await readCrowns(),
    "demoted lessons drop to crown 2 (floor(2/3·4)); the held lesson keeps 4",
  ).toEqual(["2", "2", "4"])

  // ── NO-REGRESSION WINDOW: across demotion + re-measure + re-render, the economy emitted
  // nothing and un-minted nothing — beats slice clean, reward key-sets byte-identical. ──
  const win = await page.evaluate((from) => {
    const a = (window as any).__neural
    const slice = ((a.beats || []) as any[]).slice(from as number)
    return {
      economyBeats: slice
        .filter((b) => ["challenge_completed", "patch_earned", "coin_earned"].includes(b.beat))
        .map((b) => ({ beat: b.beat, id: b.id })),
      badges: Object.keys(a.badges || {}).sort(),
      coins: Object.keys(a.coins || {}).sort(),
    }
  }, mark.beatLen)
  expect(win.economyBeats, "zero completion/reward beats in the demotion window").toEqual([])
  expect(win.badges, "badge key-set identical before/after — nothing minted, nothing revoked").toEqual(mark.badges)
  expect(win.coins, "coin key-set identical before/after").toEqual(mark.coins)

  expect(errors, "no pageerror across boot, landing, demotion, and both re-measures").toEqual([])
})
