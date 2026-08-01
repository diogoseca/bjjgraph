/* @hyperspace {"theme":"lifetime-journeys","L":"srs-veteran","F":"option-tray-sheet","B":"economy-math"} @invariant "With 25 decks drilled to prep=5, every visible option card's displayed odds equals Math.round(moveChance*100) and never exceeds the 95% moveChance ceiling nor drops below 5%, even for options whose deck is fully proven." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { srsVeteran, CURRICULUM } from "./personas"

/**
 * VETERAN ODDS CLAMP — the economy-math contract of the option tray for a 25-deck SRS veteran.
 *
 * Seams under test (all verified by probe, twice, frame-identical):
 *   - displayedOdds == Math.round(moveChance*100) == the card's `.ngodds` DOM text
 *     (dsl.ts displayedOdds; app buildOptionCard / refreshOptionOdds, app.src.jsx:3890/3922)
 *   - clamp: moveChance = Math.max(0.05, Math.min(0.95, base + playerMod − aiMod)) (app.src.jsx:4368)
 *   - economy constants: mastery = min(0.15, 0.03*prep) (app.src.jsx:803), sharpness bump = 0.10
 *     on every grade (app.src.jsx:806) — a proven deck (prep=5) is mastery-CAPPED, so further
 *     drilling pumps odds only via sharpness, and a fresh deck's full budget is +0.25 raw.
 *
 * The odds path draws no RNG beyond land()'s built-in rigs (ai-skill/role/max-moves), so the
 * whole journey is deterministic without extra rig queues. Sim time is never advanced after
 * the deal — the decision clock stays frozen, sharpness never decays mid-test.
 *
 * NOTE (probe caveat): the 5% floor is band-asserted, never forced — the lowest observed hand
 * was 47%, and forcing the floor needs a bad-position/high-aiSkill setup out of scope here.
 * The exact 95-pin assertion is guarded by the "would cross 95" precondition so hand
 * composition drift (content waves reshaping the deal) can degrade it to band+monotone
 * instead of flaking.
 */

// Persona-coverage precondition: srsVeteran(25) seeds the FIRST 25 curriculum lesson decks;
// the landing deck "Mount|Top" must be among them (deck #23 at authoring time) or the
// proven-deck premise of the invariant no longer holds for this landing.
const FIRST_25: string[] = (() => {
  const keys: string[] = []
  outer: for (const belt of CURRICULUM.belts)
    for (const u of belt.units)
      for (const l of u.lessons) {
        keys.push(l.deckKey)
        if (keys.length >= 25) break outer
      }
  return keys
})()

test("veteran tray: every card's odds == round(moveChance*100), clamped to [5,95], through capped and ceiling-crossing drills", async ({ page }) => {
  test.skip(
    !FIRST_25.includes("Mount|Top"),
    "curriculum reordered: Mount|Top left the first 25 lesson decks — srsVeteran(25) no longer proves the landing deck",
  )

  const j = journey(page)
  await j.boot("/", { initialState: srsVeteran(25) })
  await j.land("Mount Top")
  await j.expectBeat("land")
  await j.expectBeat("options_dealt")

  // seed ingested: the landing position's deck is proven (prep=5) and IS the active _posKey
  const seed = await page.evaluate(() => {
    const a = (window as any).__neural
    return { prep: a.prep["Mount|Top"] || 0, posKey: a._posKey }
  })
  expect(seed.posKey, "landed with Mount|Top as the active position key").toBe("Mount|Top")
  expect(seed.prep, "srsVeteran(25) seeded the landing deck to prep=5").toBe(5)

  const titles = await j.optionTitles()
  expect(titles.length, "a hand of options was dealt").toBeGreaterThanOrEqual(3)
  // structural: exactly one tray card per dealt option (buildOptionCard is the only data-tech emitter)
  expect(await page.locator("[data-tech]").count()).toBe(titles.length)

  const domOdds = async (t: string) =>
    ((await page.locator(`[data-tech="${t}"] .ngodds`).first().textContent()) || "").trim()

  // ── Phase A: at rest, every card is in the clamp band and the DOM shows the same number ──
  const odds1: Record<string, number> = {}
  for (const t of titles) {
    const o = await j.displayedOdds(t)
    odds1[t] = o
    expect(o, `"${t}" odds >= 5% floor`).toBeGreaterThanOrEqual(5)
    expect(o, `"${t}" odds <= 95% ceiling`).toBeLessThanOrEqual(95)
    expect(await domOdds(t), `"${t}" card renders the same rounded number`).toBe(`${o}%`)
  }

  // ── Phase B: drill the PROVEN current deck — mastery is capped (prep 5→8 is a mastery
  // no-op) but every grade re-bumps sharpness (+0.10 on _posKey), so ALL options pump
  // +9/+10 (rounding), monotone, never above 95, DOM in lockstep (drill rail refreshes). ──
  await j.drill(3)
  await j.expectBeat("bonus_pumped")
  expect(
    await page.evaluate(() => (window as any).__neural.prep["Mount|Top"]),
    "drill rail bumped the proven deck's prep 5→8 (mastery stays capped at 0.15)",
  ).toBe(8)
  const odds2: Record<string, number> = {}
  for (const t of titles) {
    const o = await j.displayedOdds(t)
    odds2[t] = o
    expect(o, `"${t}" post-drill odds >= 5`).toBeGreaterThanOrEqual(5)
    expect(o, `"${t}" post-drill odds <= 95`).toBeLessThanOrEqual(95)
    expect(o, `"${t}" odds monotone under drilling`).toBeGreaterThanOrEqual(odds1[t])
    if (odds1[t] > 5 && odds1[t] <= 85) {
      // clear of both clamp zones: the +0.10 sharpness bump must show as exactly +9/+10
      expect(o - odds1[t], `"${t}" pumped by the 0.10 sharpness bump`).toBeGreaterThanOrEqual(9)
      expect(o - odds1[t], `"${t}" pump never exceeds the bump`).toBeLessThanOrEqual(10)
    }
    expect(await domOdds(t), `"${t}" DOM still in sync after drill`).toBe(`${o}%`)
  }

  // ── Phase C: engage the ceiling — drill a dealt option's OWN (fresh) deck to pile fresh
  // mastery (min(0.15, 0.03*(prep+5)) == 0.15 always after +5 grades) on top of +0.10
  // sharpness. Target = the drillable option with the highest projected raw odds. ──
  const cands: Array<{ t: string; key: string; cards: number; bonusPct: number }> =
    await page.evaluate((ts) => {
      const a = (window as any).__neural
      return (ts as string[]).map((t) => {
        const n = a.nodes.find((x: any) => x.t === t)
        const key = a.deckKeyFor(n).key
        const cards = ((a.flashcards?.decks?.[key] || {}).cards || []).length
        // available raw bonus from 5 grades: to-cap mastery + to-cap sharpness (app accessors,
        // caps are the constants under test)
        const bonusPct = (0.25 - a.mastery(key) - a.sharpness(key)) * 100
        return { t, key, cards, bonusPct }
      })
    }, titles)
  const drillable = cands.filter((c) => c.cards > 0)
  test.skip(!drillable.length, "no dealt option has a drillable deck (0 cards everywhere)")
  const target = drillable.reduce((best, c) =>
    odds2[c.t] + c.bonusPct > odds2[best.t] + best.bonusPct ? c : best,
  )
  const before = odds2[target.t]
  const wouldCross = before + target.bonusPct > 95 // probe: 77 + 25 → unclamped 102

  await j.drill(5, target.key)
  const after = await j.displayedOdds(target.t)
  expect(after, "drilled option stays at or above the 5% floor").toBeGreaterThanOrEqual(5)
  expect(after, "drilled option never renders above the 95% ceiling").toBeLessThanOrEqual(95)
  expect(after, "drilled option's odds are monotone").toBeGreaterThanOrEqual(before)
  expect(await domOdds(target.t), "drilled card's DOM equals the rounded moveChance").toBe(`${after}%`)
  if (wouldCross) {
    // the raw sum crossed the ceiling — the displayed number must PIN at exactly 95
    expect(after, "odds pinned at the 95% moveChance ceiling").toBe(95)
    expect(await domOdds(target.t), "card text pinned at 95%").toBe("95%")
  }

  // every OTHER card: still in band, still monotone (cross-variant credit may only add),
  // DOM still equal to its rounded moveChance
  for (const t of titles) {
    if (t === target.t) continue
    const o = await j.displayedOdds(t)
    expect(o, `"${t}" still >= 5 after sibling drill`).toBeGreaterThanOrEqual(5)
    expect(o, `"${t}" still <= 95 after sibling drill`).toBeLessThanOrEqual(95)
    expect(o, `"${t}" never regressed`).toBeGreaterThanOrEqual(odds2[t])
    expect(await domOdds(t), `"${t}" DOM in sync at journey end`).toBe(`${o}%`)
  }
})
