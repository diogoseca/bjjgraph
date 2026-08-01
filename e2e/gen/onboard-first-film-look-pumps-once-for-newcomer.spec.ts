/* @hyperspace {"theme":"onboarding","L":"first-roll-day1","F":"film-study","B":"idempotence"} @invariant "A newcomer's first-ever film-study watch on a technique raises its displayed odds by exactly 4 with a single film_first_look beat, and a second watch of the same technique is a no-op (delta stays 4, beat count stays 1) — the intro film bonus is a one-time-per-technique nudge, not a grind." */
import { test, expect, type Page } from "@playwright/test"
import { journey, type Journey } from "../dsl"
import { firstRollDay1 } from "./personas"

/**
 * ONBOARDING — THE FIRST-EVER FILM LOOK IS A ONE-TIME +4, NOT A GRIND (Day-1 newcomer).
 *
 * A brand-new player (firstRollDay1) opens a technique's option sheet and watches its first
 * film-study Short. That first look mints exactly +4 displayed points on THAT technique and one
 * film_first_look beat; watching again mints nothing. This spec pins the invariant in its CLEANEST
 * regime — a newcomer's clean mid-band hand where the +4 lands whole, never touching the clamp.
 *
 * Sibling: veteran-film-look-respects-clamp.spec.ts already asserts "+4 once, repeat mints nothing"
 * — but on srsVeteran(25), where lifetime bonuses push odds toward the 95 ceiling and the point is
 * clamp COMPOSITION. The genuinely new coverage here is the L axis (first-roll-day1 / first-ever
 * watch) and the clean-headroom band: firstRollDay1() seeds deckKey "Mount|Bottom" prep=2 — the
 * WRONG role for a Mount Top landing — so NO dealt option's odds are inflated by prep. The hand
 * comes clean mid-band (most options 33%), giving the +4 full headroom with zero clamp interference.
 * So this asserts a plain delta===4 (no clamp branch, no drills) — the film bonus observed neat.
 *
 * Source seams (verified against neural/src/app.src.jsx):
 *   - first-look guard (app.src.jsx:4109-4114): _filmLook[ctxNode.t] is minted ONCE per technique,
 *     keyed by the technique's .t; on the mint it fires fx("film_first_look",{technique}) and pumps
 *     the panel odds. A repeat watch finds the key already set → no beat, no re-pump.
 *   - bonus (app.src.jsx:4372): moveChance adds +0.04 when _filmLook[act.t] is set → +4 displayed.
 *
 * Determinism (probe-verified, 2/2 identical — 33→37 delta exactly 4, count 1, siblings unmoved):
 *   - optionsFor draws no RNG; land()'s built-in rigs (ai-skill/role/max-moves) cover every ambient
 *     draw and sim time is never advanced after the deal, so sharpness never decays and the clock
 *     stays frozen. No explicit rig() queues are needed beyond land("Mount Top")'s built-ins.
 *   - core-023 stub: window.YT = { Player: StubPlayer, PlayerState:{ENDED:0} } set BEFORE the sheet
 *     opens (shorts auto-open is !isTest()-gated → no race). watchShort never calls window.open in
 *     test mode, so no window.open override is needed.
 *   - Assertions are STRUCTURAL only — displayedOdds (rounded moveChance*100), the film_first_look
 *     beat + its {technique} prop, per-option isolation. Never card/answer copy text.
 */

const POSITION = "Mount Top" // a valid positions node land() can rig-start on

/** Stub the YouTube iframe API (journeys are hermetic — the real script is route-aborted), then
 *  open the technique's expand sheet like a user: tray card click → Execute button visible. */
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

  await openSheet(page, target)

  // ── FIRST WATCH: the newcomer's first-ever film look on this technique. ──
  expect(
    await page.evaluate(() => (window as any).__neural.watchShort(0)),
    "watchShort(0) engages the stubbed player",
  ).toBe(true)

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
  expect(
    await page.evaluate(() => (window as any).__neural.watchShort(1)),
    "watchShort(1) — a second clip of the same technique — still engages the player",
  ).toBe(true)
  expect(await j.displayedOdds(target), "repeat watch mints no second bonus (delta stays 4)").toBe(after)
  expect((await filmBeats(j)).length, "film_first_look count stays 1 — the nudge is one-time-per-technique").toBe(1)

  expect(errors, "no pageerror across boot, the first landing, and both watches").toEqual([])
})
