/* @hyperspace {"theme":"lifetime-journeys","L":"lapsed-returner","F":"ladder","B":"persistence-reload"} @invariant "Ladder rank lives in bjj-neural-ladder, independent of the progress blob: a returner seeded with full progress starts at rank 1, and after one rigged win the rank-2 state survives a preserveStorage reload while the belt record rides the blob unchanged." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { lapsedReturner, CURRICULUM } from "./personas"

/**
 * RETURNER LADDER INDEPENDENT OF BLOB — the opponent ladder is its OWN localStorage store,
 * not a field of the progress blob. A returner seeded with a full career must still start
 * at the bottom of the ladder, and one win must persist through a reload via the ladder
 * store alone while the belt record keeps riding the blob.
 *
 * Seams under test (probe-verified twice in the real app, ~36-44s/run, deterministic):
 *   - ladderState()/ladderMove() (neural/src/app.src.jsx ~4115-4130) read/write ONLY
 *     "bjj-neural-ladder"; ladderState() defaults to rank 1 when the store is absent and
 *     never writes on read (the intro-roll stakes read during land() creates no store).
 *   - _progressBlob() (app.src.jsx ~1108) emits v/prep/rec/stage/units/belts/days/settings/
 *     settingsAt/updatedAt — NO ladder field, so the two stores are structurally independent.
 *   - ladderMove(+1) on a submission victory emits ladder_up and persists {rank:2}.
 *
 * Win recipe (verbatim from the green core spec e2e/journeys/stakes-impact.spec.ts): pick
 * the first dealt submission from Mount Top (reliably dealt unrigged, same reliance as the
 * core spec); rig ONLY "resolve" low — a submission success ENDS the roll, so no "outcome"
 * draw is in play. land() rigs the intro's ambient draws (ai-skill/role/max-moves) itself.
 */

const WHITE_ID: string = CURRICULUM.belts[0].id // "white" at authoring time

test("returner ladder: rank 1 despite full blob, win to rank 2, own-store persistence across reload", async ({ page }) => {
  const SEED: any = lapsedReturner()
  expect(SEED.belts?.won?.[WHITE_ID], `persona premise: lapsedReturner carries belts.won.${WHITE_ID}`).toBeTruthy()

  const j = journey(page)

  // ── Boot 1: full-progress seed ingests; the ladder is untouched by blob seeding ──
  await j.boot("/", { initialState: SEED })
  await j.land("Mount Top")

  const baseline = await page.evaluate((whiteId) => {
    const a = (window as any).__neural
    return {
      rank: a.ladderState().rank,
      ladderStore: localStorage.getItem("bjj-neural-ladder"),
      beltWon: !!(a.belts && a.belts.won && a.belts.won[whiteId as string]),
    }
  }, WHITE_ID)
  expect(baseline.rank, "full-progress returner still starts at ladder rank 1").toBe(1)
  expect(baseline.ladderStore, "blob seeding created no bjj-neural-ladder store").toBeNull()
  expect(baseline.beltWon, `persona sanity: belts.won.${WHITE_ID} ingested from the blob`).toBe(true)

  // ── One rigged win: first dealt submission, resolve rigged low (NO "outcome" rig —
  //    a submission success ends the roll, so that draw never happens) ──
  const subName = await page.evaluate(() => {
    const a = (window as any).__neural
    const subs = (a.optionIdxs || []).map((i: number) => a.nodes[i]).filter((n: any) => n.ty === "submissions")
    return subs.length ? subs[0].t : null
  })
  expect(subName, "a submission option dealt from Mount Top").toBeTruthy()
  await j.rig("resolve", [0.01])
  await j.pick(subName as string)
  await j.advanceUntil("roll_end", 20000)
  await j.expectBeat("ladder_up")
  expect(
    await page.evaluate(() => (window as any).__neural.ladderState().rank),
    "one submission win climbs the ladder to rank 2",
  ).toBe(2)

  // ── Boot 2: preserveStorage reload — rank rides its OWN store; belt rides the blob ──
  await j.boot("/", { preserveStorage: true })
  await j.land("Mount Top")

  const post = await page.evaluate((whiteId) => {
    const a = (window as any).__neural
    a._flushSave() // pin the app's OWN blob serialization (not the seed) before reading it back
    const ladderRaw = localStorage.getItem("bjj-neural-ladder")
    const blob = JSON.parse(localStorage.getItem("bjj-neural-progress") || "null")
    return {
      rank: a.ladderState().rank,
      ladderParsed: ladderRaw ? JSON.parse(ladderRaw) : null,
      beltWon: !!(a.belts && a.belts.won && a.belts.won[whiteId as string]),
      blobBeltWon: !!(blob && blob.belts && blob.belts.won && blob.belts.won[whiteId as string]),
      blobHasLadderKey: !!blob && Object.prototype.hasOwnProperty.call(blob, "ladder"),
    }
  }, WHITE_ID)
  expect(post.rank, "rank 2 survives the preserveStorage reload").toBe(2)
  expect(post.ladderParsed, "stored bjj-neural-ladder parses to exactly {rank:2}").toEqual({ rank: 2 })
  expect(post.beltWon, `app still reads belts.won.${WHITE_ID} after reload`).toBe(true)
  expect(post.blobBeltWon, "stored progress blob still carries the belt record").toBe(true)
  expect(post.blobHasLadderKey, "progress blob has NO top-level ladder key — the stores are independent").toBe(false)
})
