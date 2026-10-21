// v1.230.0 reverses v1.218.1/v1.220.0 Inspect and watch-on-open. Real Watch and player clicks retain the film economy assertions.
/* @hyperspace {"theme":"onboarding","L":"first-roll-day1","F":"film-study","B":"idempotence"} @invariant "A newcomer's first-ever film-study watch on a technique raises its displayed odds by exactly 4 with a single film_first_look beat, and a second watch of the same technique is a no-op (delta stays 4, beat count stays 1) — the intro film bonus is a one-time-per-technique nudge, not a grind." */
import { test, expect, type Page } from "@playwright/test"
import { journey, type Journey } from "../dsl"
import { openChoiceVideo, playChoiceVideo } from "../fixtures/video-cards"
import { firstRollDay1 } from "./personas"

/** Explicit playback earns film first-look once per technique. Opening Watch earns nothing.
 * The IFrame API is hermetic; Watch and the player's Play control are real mouse inputs.
 * v1.230.0 preserves the profile's odds, clamp and study-accounting laws.
 */

const POSITION = "Mount Top" // a valid positions node land() can rig-start on


const filmBeats = async (j: Journey) =>
  ((await j.beats()) as Array<{ beat: string; technique?: string }>).filter((b) => b.beat === "film_first_look")

test("newcomer's first film look pumps a clean +4 once; a second watch of the same technique is a no-op", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))

  const j = journey(page)
  // Day-1 newcomer: firstRollDay1() seeds ONLY deckKey "Mount|Bottom" prep=2 — the opposite role
  // to a Mount Top landing, so no dealt option inherits any prep bonus (clean mid-band hand).
  await j.boot("/", { initialState: firstRollDay1() })
  await j.land(POSITION)
  await j.expectBeat("land")
  await j.expectBeat("options_dealt")

  const titles = await j.optionTitles()
  expect(titles.length, "a hand of options was dealt").toBeGreaterThanOrEqual(3)

  // Clean-headroom guarantee: the seeded deck is the WRONG role, so NO dealt option is inflated by
  // prep. This is what gives the +4 full headroom with no clamp interference (the axis this spec adds
  // over the veteran clamp sibling). Asserted structurally, never by a hardcoded title.
  const seededInHand: string[] = await page.evaluate(() => {
    const a = (window as any).__neural
    return (a.optionIdxs || [])
      .map((o: any) => a.nodes[typeof o === "number" ? o : o.idx])
      .filter((n: any) => n && (a.prep[a.deckKeyFor(n).key] || 0) > 0)
      .map((n: any) => n.t)
  })
  expect(seededInHand, "the seeded deck is the wrong role — no dealt option is prep-inflated").toEqual([])

  // Snapshot every option's pre-film odds; target a strictly mid-band option so the whole +4 lands
  // clear of both clamp zones (5 floor / 95 ceiling). Discovered live — never a hardcoded technique.
  const oddsBefore: Record<string, number> = {}
  for (const t of titles) oddsBefore[t] = await j.displayedOdds(t)
  const target = titles.find((t) => oddsBefore[t] > 5 && oddsBefore[t] <= 91) ?? titles[0]
  const before = oddsBefore[target]
  expect(before, "pre-film odds sit in the mid-band with full +4 headroom").toBeGreaterThan(5)
  expect(before, "pre-film odds sit in the mid-band with full +4 headroom").toBeLessThanOrEqual(91)

  await openChoiceVideo(page, target)

  // ── FIRST WATCH: the newcomer's first-ever film look on this technique. ──
  await playChoiceVideo(page)

  const after = await j.displayedOdds(target)
  expect(after - before, "the first-ever film look lands a clean +4 (mid-band, no clamp)").toBe(4)

  const films1 = await filmBeats(j)
  expect(films1.length, "film_first_look fired exactly once").toBe(1)
  expect(films1[0].technique, "the beat names the watched technique").toBe(target)

  // Per-technique isolation: the target's film look moved NO sibling's odds.
  for (const t of titles) {
    if (t === target) continue
    expect(await j.displayedOdds(t), `"${t}" untouched by the sibling's film look`).toBe(oddsBefore[t])
  }

  // ── SECOND WATCH, SAME TECHNIQUE (a different clip index): the one-time guard is keyed on the
  //    technique's .t, not the clip — so it holds regardless. No second +4, no second beat. ──
  await openChoiceVideo(page, target, "bbbbbbbbbbb")
  await playChoiceVideo(page)
  expect(await j.displayedOdds(target), "repeat watch mints no second bonus (delta stays 4)").toBe(after)
  expect((await filmBeats(j)).length, "film_first_look count stays 1 — the nudge is one-time-per-technique").toBe(1)

  expect(errors, "no pageerror across boot, the first landing, and both watches").toEqual([])
})
