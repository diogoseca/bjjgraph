import { test, expect } from "@playwright/test"
import { journey } from "../dsl"

/**
 * GOLDEN PATH — the P0 gate journey.
 *
 * A guest lands on Mount, reads their dealt options, drills two flashcards and watches the
 * odds pump, commits to the submission, hits, and wins the roll. Then the whole journey
 * replays FRAME-EXACT: same rigs → same trail, same beats. This spec is the permanent
 * regression gate for the core loop; if gameplay breaks, pushes stop.
 */

const script = async (j: ReturnType<typeof journey>) => {
  await j.boot("/")
  await j.land("Mount Top")

  // the graph dealt a hand
  const options = await j.optionTitles()
  expect(options.length).toBeGreaterThanOrEqual(3)
  await j.expectBeat("land")
  await j.expectBeat("options_dealt")

  // flashcard bonus is a visible, honest odds pump: +6%/card on the DISPLAYED number.
  // Drill where it matters: pick a mid-odds option so the +12 isn't eaten by the 95% ceiling.
  let target = options[0]
  let before = await j.displayedOdds(target)
  for (const o of options) {
    const odds = await j.displayedOdds(o)
    if (odds <= 75) { target = o; before = odds; break }
  }
  await j.drill(2)
  const after = await j.displayedOdds(target)
  if (before <= 75) expect(after - before).toBeGreaterThanOrEqual(11) // 2 cards ≈ +12
  else expect(after).toBeGreaterThanOrEqual(before) // all options near ceiling: monotone only
  await j.expectBeat("bonus_pumped")

  // commit with a rigged-successful resolve + rigged outcome draw
  await j.rig("resolve", [0.01]) // < moveChance ⇒ success
  await j.rig("outcome", [0.01]) // first outcome bucket (success target)
  await j.pick(target)
  await j.advance(6000) // travel + impact + landing (or finish)
  await j.expectBeat("commit")

  const beats = (await j.beats()).map((b) => b.beat)
  expect(beats).toContain("impact_success")
  return { options, trail: await j.rollTrail(), beats }
}

test("golden path: land → read → drill → pick → hit", async ({ page }) => {
  const run = await script(journey(page))
  expect(run.trail.length).toBeGreaterThanOrEqual(1)
  await journey(page).keyframe("golden-path-final")
})

test("golden path replays deterministically (frame-exact)", async ({ page }) => {
  const run1 = await script(journey(page))
  const run2 = await script(journey(page)) // fresh boot inside script
  expect(run2.options).toEqual(run1.options)
  expect(run2.trail).toEqual(run1.trail)
  expect(run2.beats).toEqual(run1.beats)
})

test("win path: rigged submission finish ends the roll", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  // find a submission among the dealt options; rig it to hit
  const sub = await page.evaluate(() => {
    const a = (window as any).__neural
    const o = (a.optionIdxs || [])
      .map((x: any) => a.nodes[typeof x === "number" ? x : x.idx])
      .find((n: any) => n && n.ty === "submissions")
    return o ? o.t : null
  })
  test.skip(!sub, "no submission dealt on this position")
  await j.rig("resolve", [0.01])
  await j.rig("outcome", [0.01])
  await j.pick(sub!)
  await j.advance(8000)
  await j.expectBeat("finish")
  expect(await j.lastOutcome()).toBe("win")
})
