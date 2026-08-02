/* @hyperspace {"theme":"lifetime-journeys","L":"srs-veteran","F":"film-study","B":"guard-limit"} @invariant "On a veteran profile the film first-look bonus adds at most 4 points to a technique's displayed odds and the post-watch odds still never exceed 95 — cumulative lifetime bonuses (mastery + sharpness + film) compose under the clamp, not past it." */
import { test, expect, type Page } from "@playwright/test"
import { journey, type Journey } from "../dsl"
import { srsVeteran } from "./personas"

/**
 * FILM FIRST-LOOK vs THE ODDS CLAMP — a 25-deck SRS veteran watches film-study Shorts.
 *
 * Seams under test (probe-verified 3x, identical numbers each run):
 *   - moveChance = clamp(0.05, 0.95, base + stateBonus(_posKey) + stateBonus(techDeckKey)
 *       + (filmLook ? 0.04 : 0) − aiMod)                      (app.src.jsx:4361-4368)
 *   - watchShort(i) first-look guard: the +4% film bonus mints ONCE per technique; the
 *     film_first_look beat carries {technique} and fires even when the clamp eats the whole
 *     visible delta — the guard is on _filmLook, not on the delta (app.src.jsx:4089-4111)
 *   - the open sheet's .ngsucbig (inside optDetailRef.current) re-renders the new rounded
 *     moveChance INSTANTLY in test mode                        (_pumpOdds, app.src.jsx:811-817)
 *
 * Determinism: optionsFor draws no RNG — land()'s built-in rigs (ai-skill/role/max-moves)
 * cover every ambient draw, and sim time is never advanced after the deal, so the decision
 * clock stays frozen and sharpness never decays mid-test. No extra rig queues are needed.
 *
 * Author gotchas honored: high odds are manufactured via drill() ONLY — a bumpCardSuccess
 * override bypasses moveChance entirely (film would add 0 under it); drill(n,key) throws on
 * missing/empty decks (candidates filtered by cards.length>0); sharpness is a flat 0.10 per
 * key (not additive) and mastery caps at 0.15 (0.03×prep), so drill(5,key) always leaves
 * stateBonus(key) at the full 0.25 budget.
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

/** Stub the YouTube iframe API (journeys are hermetic — the real script is route-aborted),
 *  then open the technique's expand sheet like a user: tray card click → Execute visible.
 *  The stub goes in BEFORE the sheet opens; shorts auto-open is !isTest()-gated, no race. */
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
  await expect(page.locator("[data-go]").first(), "expand sheet open").toBeVisible()
}

/** The sheet's big Success % — read inside optDetailRef.current, the panel _pumpOdds targets. */
const sheetOdds = (page: Page) =>
  page.evaluate(() => {
    const el = (window as any).__neural.optDetailRef?.current?.querySelector(".ngsucbig")
    return el ? (el.textContent || "").trim() : null
  })

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

  // The veteran's SEEDED technique in this hand (deck key ∈ prep) — discovered live, never
  // hardcoded (probe: "Americana from Mount", the hand's single seeded tech). If a content
  // wave reshapes the deal away from every seeded deck, fall back to the first option — the
  // film law binds every technique, seeded or not.
  const seeded: string[] = await page.evaluate(() => {
    const a = (window as any).__neural
    return (a.optionIdxs || [])
      .map((o: any) => a.nodes[typeof o === "number" ? o : o.idx])
      .filter((n: any) => n && (a.prep[a.deckKeyFor(n).key] || 0) > 0)
      .map((n: any) => n.t)
  })
  const target = seeded[0] ?? titles[0]

  const oddsBefore: Record<string, number> = {}
  for (const t of titles) oddsBefore[t] = await j.displayedOdds(t)
  const before = oddsBefore[target]
  expect(before, "pre-film odds sit inside the clamp band").toBeGreaterThanOrEqual(5)
  expect(before, "pre-film odds sit inside the clamp band").toBeLessThanOrEqual(95)

  await openSheet(page, target)
  expect(await sheetOdds(page), "sheet shows the pre-film rounded moveChance").toBe(`${before}%`)

  expect(await page.evaluate(() => (window as any).__neural.watchShort(0)), "watchShort(0) engages the player").toBe(true)

  const after = await j.displayedOdds(target)
  assertFilmDelta(before, after) // probe: 63 → 67, delta exactly 4
  expect(await sheetOdds(page), "sheet re-rendered the post-film number instantly (test mode)").toBe(`${after}%`)

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
  expect(await page.evaluate(() => (window as any).__neural.watchShort(1)), "watchShort(1) engages the player").toBe(true)
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
      return { t, key, cards, rawAfter: a.moveChance(n) + (0.25 - a.stateBonus(key)) }
    })
  }, titles)
  const drillable = cands.filter((c) => c.cards > 0)
  test.skip(!drillable.length, "no dealt option has a drillable deck (0 cards everywhere)")
  const target = drillable.reduce((best, c) => (c.rawAfter > best.rawAfter ? c : best))
  const wouldCross = target.rawAfter > 0.95 // probe: base .65 − aiMod .13 + pos .25 + tech .25 = 1.02

  await j.drill(5, target.key) // tech deck: mastery → cap 0.15, sharpness → 0.10
  const before = await j.displayedOdds(target.t)
  expect(before, "drilled odds never render above 95").toBeLessThanOrEqual(95)
  if (wouldCross) expect(before, "raw sum crossed the ceiling — display pins at exactly 95").toBe(95)

  await openSheet(page, target.t)
  expect(await sheetOdds(page), "sheet shows the pinned pre-film number").toBe(`${before}%`)

  expect(await page.evaluate(() => (window as any).__neural.watchShort(0)), "watchShort(0) engages the player").toBe(true)

  const after = await j.displayedOdds(target.t)
  assertFilmDelta(before, after) // probe: 95 → 95, delta 0 === min(before+4,95) − before
  expect(await sheetOdds(page), "sheet agrees with the clamped number").toBe(`${after}%`)

  // THE point: the first-look mint is guarded per technique, NOT per visible delta — the
  // beat fires exactly once even when the clamp eats the whole +4 (by design, not a bug)
  const films = await filmBeats(j)
  expect(films.length, "film_first_look fired exactly once at the ceiling").toBe(1)
  expect(films[0].technique, "beat names the drilled technique").toBe(target.t)
})
