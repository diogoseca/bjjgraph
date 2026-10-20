// v1.230.0 reverses v1.218.1/v1.220.0 Inspect and watch-on-open. Real Watch and player clicks retain the film economy assertions.
/* @hyperspace {"theme":"lifetime-journeys","L":"srs-veteran","F":"film-study","B":"guard-limit"} @invariant "On a veteran profile the film first-look bonus adds at most 4 points to a technique's displayed odds and the post-watch odds still never exceed 95 — cumulative lifetime bonuses (mastery + sharpness + film) compose under the clamp, not past it." */
import { test, expect, type Page } from "@playwright/test"
import { journey, type Journey } from "../dsl"
import { openChoiceVideo, playChoiceVideo } from "../fixtures/video-cards"
import { srsVeteran } from "./personas"

/** Explicit playback earns film first-look once per technique. Opening Watch earns nothing.
 * The IFrame API is hermetic; Watch and the player's Play control are real mouse inputs.
 * v1.230.0 preserves the profile's odds, clamp and study-accounting laws.
 */

/** The composed-law branch (structure only): delta ∈ [0,4] and after <= 95 ALWAYS; a
 *  near-ceiling start must pin at min(before+4, 95); a mid-band start (clear of both clamp
 *  zones) must receive the bonus whole. */
function assertFilmDelta(before: number, after: number) {
  const delta = after - before
  expect(delta, "film first-look never subtracts").toBeGreaterThanOrEqual(0)
  expect(delta, "film first-look adds at most 4 points").toBeLessThanOrEqual(4)
  expect(after, "post-watch odds never exceed the 95 ceiling").toBeLessThanOrEqual(95)
  if (before >= 91) {
    expect(after, "at the ceiling the clamp eats the film bonus").toBe(Math.min(before + 4, 95))
  } else if (before > 5) {
    expect(delta, "with headroom the +4 lands whole").toBe(4)
  }
}

const filmBeats = async (j: Journey) =>
  ((await j.beats()) as Array<{ beat: string; technique?: string }>).filter((b) => b.beat === "film_first_look")

test("headroom: first Short on the veteran's seeded technique pumps exactly +4 once; a repeat watch mints nothing", async ({ page }) => {
  const j = journey(page)
  await j.boot("/", { initialState: srsVeteran(25) })
  await j.land("Mount Top")
  await j.expectBeat("land")
  await j.expectBeat("options_dealt")

  const titles = await j.optionTitles()
  expect(titles.length, "a hand of options was dealt").toBeGreaterThanOrEqual(3)

  // The veteran's SEEDED Move card in this hand (deck key ∈ prep) — discovered live, never
  // hardcoded (the authoring probe found "Americana from Mount", a submission, which since v1.213.0
  // prints the solve's "Works" row: see MOVE CARDS ONLY). With no seeded Move card, fall back to
  // the first one — the film law binds every technique, seeded or not.
  // HEADROOM IS THIS TEST'S PREMISE: a Move card already pinned at 95 shows a 0 delta with or without
  // the film bonus, so it could not see the bonus at all (a film-bonus-removed mutant survived on one,
  // 2026-10-01). Only cards with room for the whole +4 qualify, and the premise is asserted below;
  // with it, removing the film bonus is red at "with headroom the +4 lands whole".
  const moves: { seeded: string[]; all: string[] } = await page.evaluate(() => {
    const a = (window as any).__neural
    const dealt = (a.optionIdxs || []).map((o: any) => a.nodes[typeof o === "number" ? o : o.idx])
      .filter((n: any) => n && n.ty !== "submissions" && Math.round(a.moveChance(n) * 100) <= 90)
    return { seeded: dealt.filter((n: any) => (a.prep[a.deckKeyFor(n).key] || 0) > 0).map((n: any) => n.t), all: dealt.map((n: any) => n.t) }
  })
  expect(moves.all.length, "the hand deals a Move card with headroom, so the law is read on the live card").toBeGreaterThan(0)
  const target = moves.seeded[0] ?? moves.all[0]

  const oddsBefore: Record<string, number> = {}
  for (const t of titles) oddsBefore[t] = await j.displayedOdds(t)
  const before = oddsBefore[target]
  expect(before, "pre-film odds sit inside the clamp band").toBeGreaterThanOrEqual(5)
  expect(before, "pre-film odds leave room for the whole +4 (the premise)").toBeLessThanOrEqual(90)

  await openChoiceVideo(page, target)

  await playChoiceVideo(page)

  const after = await j.displayedOdds(target)
  await expect(page.locator(`[data-tech="${target}"] .ngodds`)).toHaveText(String(after))
  assertFilmDelta(before, after) // probe: 63 → 67, delta exactly 4

  const films1 = await filmBeats(j)
  expect(films1.length, "film_first_look fired exactly once").toBe(1)
  expect(films1[0].technique, "beat names the watched technique").toBe(target)

  // Per-technique isolation: the target's film look moved NO sibling's odds
  for (const t of titles) {
    if (t === target) continue
    expect(await j.displayedOdds(t), `"${t}" untouched by the sibling's film look`).toBe(oddsBefore[t])
  }

  // Second Short on the SAME technique: the player still engages, but the first-look guard
  // holds — no second +4, no second beat
  await openChoiceVideo(page, target, "bbbbbbbbbbb")
  await playChoiceVideo(page)
  expect(await j.displayedOdds(target), "repeat watch mints no second bonus").toBe(after)
  expect((await filmBeats(j)).length, "film_first_look count stays 1").toBe(1)
})

test("at the ceiling: drills pin odds at 95, the film watch adds 0 visible points — yet film_first_look still fires once", async ({ page }) => {
  const j = journey(page)
  await j.boot("/", { initialState: srsVeteran(25) })
  await j.land("Mount Top")
  await j.expectBeat("options_dealt")

  const titles = await j.optionTitles()
  expect(titles.length, "a hand of options was dealt").toBeGreaterThanOrEqual(3)

  // Position-side pump: drill the CURRENT position deck (drill()'s default key). The
  // veteran's seeded prep is already mastery-capped, so this grade re-arms sharpness (+0.10).
  await j.drill(1)

  // Pick the dealt technique whose raw (unclamped) odds after a 5-card tech drill reach the
  // highest point. moveChance is mid-band here (unclamped), so chance + remaining budget to
  // the 0.25 stateBonus cap is the exact raw projection. Filter by cards.length>0 — drill()
  // throws on empty decks. No successOverride is ever created in this journey.
  const cands: Array<{ t: string; key: string; cards: number; rawAfter: number }> = await page.evaluate((ts) => {
    const a = (window as any).__neural
    return (ts as string[]).map((t) => {
      const n = a.nodes.find((x: any) => x.t === t)
      const key = a.deckKeyFor(n).key
      const cards = ((a.flashcards?.decks?.[key] || {}).cards || []).length
      return { t, key, cards, move: n.ty !== "submissions", rawAfter: a.moveChance(n) + (0.25 - a.stateBonus(key)) }
    })
  }, titles)
  const drillable = cands.filter((c) => c.cards > 0 && c.move) // a Move card: see MOVE CARDS ONLY
  test.skip(!drillable.length, "no dealt option has a drillable deck (0 cards everywhere)")
  const target = drillable.reduce((best, c) => (c.rawAfter > best.rawAfter ? c : best))
  const wouldCross = target.rawAfter > 0.95 // probe: base .65 − aiMod .13 + pos .25 + tech .25 = 1.02

  await j.drill(5, target.key) // tech deck: mastery → cap 0.15, sharpness → 0.10
  const before = await j.displayedOdds(target.t)
  expect(before, "drilled odds never render above 95").toBeLessThanOrEqual(95)
  if (wouldCross) expect(before, "raw sum crossed the ceiling — display pins at exactly 95").toBe(95)

  await openChoiceVideo(page, target.t)

  await playChoiceVideo(page)

  const after = await j.displayedOdds(target.t)
  await expect(page.locator(`[data-tech="${target.t}"] .ngodds`)).toHaveText(String(after))
  assertFilmDelta(before, after) // probe: 95 → 95, delta 0 === min(before+4,95) − before

  // THE point: the first-look mint is guarded per technique, NOT per visible delta — the
  // beat fires exactly once even when the clamp eats the whole +4 (by design, not a bug)
  const films = await filmBeats(j)
  expect(films.length, "film_first_look fired exactly once at the ceiling").toBe(1)
  expect(films[0].technique, "beat names the drilled technique").toBe(target.t)
})
