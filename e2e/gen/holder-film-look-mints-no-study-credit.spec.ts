/* @hyperspace {"theme":"unlock-economy","L":"white-belt-holder","F":"film-study","B":"economy-math"} @invariant "Film study pumps odds but never the study ledger: a watchShort that fires film_first_look leaves the prep map deep-equal, cardsToday unchanged, no lesson_done beat, and the Challenges-view lesson census untouched — the +4 lives entirely in moveChance, the film and study economies are disjoint." */
import { test, expect, type Page } from "@playwright/test"
import { journey, type Journey } from "../dsl"
import { whiteBeltHolder, CURRICULUM } from "./personas"

/**
 * FILM ECONOMY ⊥ STUDY ECONOMY — a white-belt holder watches a film-study Short.
 *
 * The film first-look mints +4 displayed odds, but it must mint ZERO study credit: the prep
 * map stays deep-equal, cardsToday stays 0, _days stays empty, no lesson_done fires, no
 * bonus_pumped fires, and the Challenges view's rendered done-census is byte-identical to
 * the pre-watch predicate census. whiteBeltHolder is the sharpest lens for this: every white
 * lesson is seeded prep=3 (the prep map is NON-empty, so deep-equal can't pass vacuously)
 * and every white unit summary renders "N of N lessons" — a single stray credit would flip
 * a count somewhere.
 *
 * Source seams (verified against neural/src/app.src.jsx):
 *   - watchShort (:4095-4117) → expandClip fires short_watched {id} (:711); the first-look
 *     mint (:4109-4114) touches ONLY _filmLook + fx("film_first_look") + _pumpOdds
 *     (:816-834 — pure DOM odometer + refreshOptionOdds). No study write is reachable.
 *   - ALL study writes live in noteCardDone (:840-874): bumpSharp, _maybeLessonDone (the
 *     only lesson_done emitter, :2442), _days/cardsToday (:849-853) and the bonus_pumped
 *     beat — whose ONLY emission site is noteCardDone (:853), making it a second
 *     study-credit sentinel alongside lesson_done.
 *   - v1.74 Challenges view: each unit's <details> summary renders "D of L lessons" with
 *     D = live.filter(lessonDone).length — the SAME prep-driven predicate, per unit of the
 *     SELECTED track (white by default for this persona). Summing D across the white
 *     track's unit summaries is the rendered census; per-lesson done attributes are gone.
 *
 * Determinism (probe 3/3 green, ~2.5s each): land()'s built-in rigs (ai-skill/role/max-moves)
 * cover ALL ambient draws; optionsFor/sheet/watchShort/path render draw no RNG, and sim time
 * is never advanced after the deal so sharpness stays frozen. Red-proof: injecting
 * j.drill(1) after the watch trips the prep deep-equal — the no-credit assertions have teeth.
 *
 * Distinctness: core-066/w3-13 (+4 idempotence) and w1-04 (clamp) pin the ODDS side of the
 * film look; this spec pins the NO-CREDIT side (prep/_days/cardsToday/lesson_done/
 * bonus_pumped/path-census). Odds are asserted only far enough to prove the watch landed.
 */

/** Lesson ENTRIES in the white belt (rows are per-entry): the census floor for this persona. */
const WHITE_LESSON_ENTRIES: number = CURRICULUM.belts[0].units.reduce(
  (n: number, u: any) => n + u.lessons.length,
  0,
)

/** Stub the YouTube iframe API (journeys are hermetic — the real script is route-aborted),
 *  then open the technique's expand sheet like a user: tray card click → Execute visible.
 *  Stub goes in BEFORE the click; shorts auto-open is !isTest()-gated, so no race. Never
 *  click [data-go] — the sheet stays open for watchShort. */
async function openSheet(page: Page, technique: string) {
  await page.evaluate(() => {
    function StubPlayer(this: any) {
      this.destroy = () => {}
    }
    ;(window as any).YT = { Player: StubPlayer, PlayerState: { ENDED: 0 } }
  })
  const card = page.locator(`[data-tech="${technique}"]`).first()
  await expect(card, `option card for "${technique}" visible`).toBeVisible()
  await card.click()
  await expect(page.locator("[data-go]").first(), "expand-sheet Execute button visible").toBeVisible()
}

/** The complete study ledger, deep-cloned: prep map, daily counter, per-day history. */
const ledgerSnap = (page: Page) =>
  page.evaluate(() => {
    const a = (window as any).__neural
    return {
      prep: JSON.parse(JSON.stringify(a.prep || {})) as Record<string, number>,
      cardsToday: (a.cardsToday || 0) as number,
      days: JSON.parse(JSON.stringify(a._days || {})) as Record<string, number>,
    }
  })

/** Done-census over every curriculum lesson ENTRY, using the app's own predicate — the same
 *  (deckKey → lessonDone) walk renderBeltPath performs per row. */
const predicateCensus = (page: Page) =>
  page.evaluate(() => {
    const a = (window as any).__neural
    let n = 0
    for (const b of a.curriculum.belts)
      for (const u of b.units) for (const l of u.lessons) if (a.lessonDone(l.deckKey)) n++
    return n
  })

const count = async (j: Journey, beat: string) => (await j.beats()).filter((b) => b.beat === beat).length

test("holder's film watch pumps odds but leaves prep, cardsToday, _days, both study beats, and the belt-path census untouched", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))

  const j = journey(page)
  await j.boot("/", { initialState: whiteBeltHolder() })
  await j.land("Mount Top")
  await j.expectBeat("land")
  await j.expectBeat("options_dealt")

  const titles = await j.optionTitles()
  expect(titles.length, "a hand of options was dealt").toBeGreaterThanOrEqual(3)

  // ── the study ledger, frozen in amber BEFORE the watch ──
  const before = await ledgerSnap(page)
  expect(
    Object.keys(before.prep).length,
    "holder's prep map is non-empty (every white lesson seeded) — deep-equal cannot pass vacuously",
  ).toBeGreaterThan(0)
  expect(before.cardsToday, "holder blob seeds days:{} — the daily counter boots at 0").toBe(0)

  const censusBefore = await predicateCensus(page)
  expect(
    censusBefore,
    "pre-watch done-census covers at least every white lesson entry (persona seeds all of white)",
  ).toBeGreaterThanOrEqual(WHITE_LESSON_ENTRIES)

  // Odds target discovered live, never hardcoded: prefer a mid-band option (the +4 lands whole,
  // clear of the 5/95 clamp); fall back to the lowest-odds option if a content wave crowds the band.
  const oddsBefore: Record<string, number> = {}
  for (const t of titles) oddsBefore[t] = await j.displayedOdds(t)
  const target =
    titles.find((t) => oddsBefore[t] > 5 && oddsBefore[t] <= 91) ??
    titles.reduce((a, b) => (oddsBefore[a] <= oddsBefore[b] ? a : b))

  await openSheet(page, target)

  // ── THE WATCH: the film economy's only lever ──
  expect(
    await page.evaluate(() => (window as any).__neural.watchShort(0)),
    "watchShort(0) engages the stubbed player (test mode synthesizes the clip + card)",
  ).toBe(true)

  // Odds side registered — the watch demonstrably paid out somewhere (the film ledger)…
  const delta = (await j.displayedOdds(target)) - oddsBefore[target]
  expect(delta, "the film look moved the technique's displayed odds").toBeGreaterThan(0)
  expect(delta, "…by at most the +4 film bonus").toBeLessThanOrEqual(4)

  // ── beats: film beats fired once each; BOTH study-credit sentinels stayed silent ──
  const bs = (await j.beats()) as Array<{ beat: string; id?: string; technique?: string }>
  const watched = bs.filter((b) => b.beat === "short_watched")
  expect(watched.length, "one watch → one short_watched (via expandClip)").toBe(1)
  expect(watched[0].id, "short_watched carries the clip id").toBeTruthy()
  const films = bs.filter((b) => b.beat === "film_first_look")
  expect(films.length, "one first look → one film_first_look").toBe(1)
  expect(films[0].technique, "the beat names the watched technique").toBe(target)
  expect(await count(j, "lesson_done"), "no lesson_done since boot — film is not lesson progress").toBe(0)
  expect(
    await count(j, "bonus_pumped"),
    "no bonus_pumped since boot — noteCardDone (its only emitter) was never reached",
  ).toBe(0)

  // ── the ledger itself: deep-equal to the pre-watch snapshot, field by field ──
  const after = await ledgerSnap(page)
  expect(after.prep, "prep map deep-equal to the pre-watch snapshot").toEqual(before.prep)
  expect(after.cardsToday, "cardsToday unchanged — a film rep is NOT a study rep").toBe(before.cardsToday)
  expect(after.days, "_days deep-equal — the daily history never heard about the watch").toEqual(before.days)

  // ── the app predicate agrees: the post-watch census (all belts) is byte-identical ──
  expect(await predicateCensus(page), "post-watch predicate census identical — zero stray credit").toBe(censusBefore)

  // ── the Challenges view agrees: the rendered white-track census (sum of each unit
  //    summary's "D of L lessons") equals the same predicate computed over white's live
  //    lessons. toggleExplorer over the still-open expand sheet is fine. ──
  await page.evaluate(() => (window as any).__neural.toggleExplorer())
  await j.expectBeat("challenges_opened")
  const census = await page.evaluate(() => {
    const a = (window as any).__neural
    const white = a.curriculum.belts[0]
    let predicate = 0
    for (const u of white.units)
      for (const l of u.lessons) if (a._lessonLive(l) && a.lessonDone(l.deckKey)) predicate++
    let rendered = 0
    document.querySelectorAll(".ng-challenge-group summary small").forEach((el) => {
      const m = (el.textContent || "").match(/^(\d+) of \d+ lessons/)
      if (m) rendered += parseInt(m[1], 10)
    })
    return { predicate, rendered, groups: document.querySelectorAll(".ng-challenge-group").length }
  })
  expect(census.groups, "the white track renders one group per unit").toBe(CURRICULUM.belts[0].units.length)
  expect(census.rendered, "rendered white-track census equals the live predicate census").toBe(census.predicate)
  expect(census.predicate, "white-track predicate untouched by the watch (persona seeds all of white)").toBeGreaterThan(0)

  expect(errors, "no pageerror across boot, landing, watch, and challenges open").toEqual([])
})
