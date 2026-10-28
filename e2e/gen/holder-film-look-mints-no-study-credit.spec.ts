// v1.230.0 reverses v1.218.1/v1.220.0 Inspect and watch-on-open. Real Watch and player clicks retain the film economy assertions.
/* @hyperspace {"theme":"unlock-economy","L":"white-belt-holder","F":"film-study","B":"economy-math"} @invariant "Film study pumps odds but never the study ledger: explicit playback that fires film_first_look leaves the prep map deep-equal, cardsToday unchanged, no lesson_done beat, and the Challenges-view lesson census untouched — the +4 lives entirely in moveChance, the film and study economies are disjoint." */
import { test, expect, type Page } from "@playwright/test"
import { journey, type Journey } from "../dsl"
import { openChoiceVideo, playChoiceVideo } from "../fixtures/video-cards"
import { whiteBeltHolder, CURRICULUM } from "./personas"

/** Explicit playback earns film first-look once per technique. Opening Watch earns nothing.
 * The IFrame API is hermetic; Watch and the player's Play control are real mouse inputs.
 * v1.230.0 preserves the profile's odds, clamp and study-accounting laws.
 */

/** Lesson ENTRIES in the white belt (rows are per-entry): the census floor for this persona. */
const WHITE_LESSON_ENTRIES: number = CURRICULUM.belts[0].units.reduce(
  (n: number, u: any) => n + u.lessons.length,
  0,
)

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

  await openChoiceVideo(page, target)

  // ── THE WATCH: the film economy's only lever ──
  await playChoiceVideo(page)

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
  //    lessons. Watch is closed before opening Challenges. ──
  await page.evaluate(() => (window as any).__neural.toggleExplorer())
  // v1.242.0: the drawer opens on its list; Path (the old Challenges tab) is one row away. Taken by the app's
  // own view switch, not a click: the watch's <dialog open> is still up over the drawer here and would take
  // a real click (dev's toggle opened Challenges with no click at all, and this census is read from the DOM).
  await page.evaluate(() => (window as any).__neural.setViewMode("challenges"))
  await j.expectBeat("challenges_opened")
  const census = await page.evaluate(() => {
    const a = (window as any).__neural
    const white = a.curriculum.belts[0]
    let predicate = 0
    for (const u of white.units)
      for (const l of u.lessons) if (a._lessonLive(l) && a.lessonDone(l.deckKey)) predicate++
    let rendered = 0
    // v1.76.0 ladder renders every track's curriculum — scope the census to white's section
    document.querySelectorAll('[data-track-curriculum="white"] .ng-challenge-group summary small').forEach((el) => {
      const m = (el.textContent || "").match(/^(\d+) of \d+ lessons/)
      if (m) rendered += parseInt(m[1], 10)
    })
    return { predicate, rendered, groups: document.querySelectorAll('[data-track-curriculum="white"] .ng-challenge-group').length }
  })
  expect(census.groups, "the white track renders one group per unit").toBe(CURRICULUM.belts[0].units.length)
  expect(census.rendered, "rendered white-track census equals the live predicate census").toBe(census.predicate)
  expect(census.predicate, "white-track predicate untouched by the watch (persona seeds all of white)").toBeGreaterThan(0)

  expect(errors, "no pageerror across boot, landing, watch, and challenges open").toEqual([])
})
