import { test, expect } from "@playwright/test"
import { journey } from "../dsl"

/**
 * RESTART HYGIENE — regressions found by the adversarial review of P2/P3.
 *
 * A roll restart (transport Reset, "roll from here", "Play from here", dossier jump) must
 * DISARM every in-flight engagement. Before the fix: the stale defense clock kept draining
 * through the new roll's intro and tapped you out (ghost defeat + PERSISTED ladder demotion),
 * _defendSub rerouted all odds refreshes to escape math, the heartbeat vignette never died,
 * and a cancelled tension sweep left its needle painted forever.
 */

test("restart mid-defense: no ghost tap, no ladder drop, defense state fully disarmed", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  const rank0 = await page.evaluate(() => (window as any).__neural.ladderState().rank)

  // get caught: rigged fail → opponent finish
  const options = await j.optionTitles()
  await j.rig("resolve", [0.99])
  await j.rig("outcome", [0.99])
  await j.rig("opp-finish", [0.01])
  await j.rig("opp-sub-pick", [0.01])
  await j.pick(options[0])
  await j.advanceUntil("caught", 20000)
  await expect(page.locator("[data-panic]")).toBeVisible()

  // the user bails: transport Reset while the defense window is still draining
  await page.evaluate(() => (window as any).__neural.resetRoll())
  await j.advance(20000) // longer than any stale defense window + intro

  const state = await page.evaluate(() => {
    const a = (window as any).__neural
    return {
      defendSub: a._defendSub ?? null,
      panicKey: a._panicKey ?? null,
      vignette: !!a._vignetteEl,
      decision: !!a._decision && !a._optPick ? "orphaned" : "ok",
      rank: a.ladderState().rank,
    }
  })
  expect(state.defendSub).toBeNull()
  expect(state.panicKey).toBeNull()
  expect(state.vignette).toBe(false)
  expect(state.rank).toBe(rank0) // the reset roll must NOT demote the ladder

  const beats = (await j.beats()).map((b) => b.beat)
  expect(beats.filter((b) => b === "defeat_drain").length).toBe(0)
  expect(beats.filter((b) => b === "ladder_down").length).toBe(0)
  // and the new roll actually lands with a live hand
  expect(beats.filter((b) => b === "land").length).toBeGreaterThanOrEqual(2)
  expect(await page.evaluate(() => ((window as any).__neural.optionIdxs || []).length)).toBeGreaterThan(0)
  expect(await page.locator("[data-panic]").count()).toBe(0)
})

test("restart mid-sweep: the cancelled needle does not haunt the canvas", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  const options = await j.optionTitles()
  await j.rig("resolve", [0.01])
  await j.rig("outcome", [0.01])
  await j.pick(options[0])
  await j.advanceUntil("sweep_start", 20000)
  await j.advance(300) // mid-hold, before the 1.08s landing fires

  await page.evaluate(() => (window as any).__neural.resetRoll())
  expect(await page.evaluate(() => (window as any).__neural._sweep === null || (window as any).__neural._sweep === undefined)).toBe(true)

  // the cancelled sweep must never land
  const before = (await j.beats()).filter((b) => b.beat === "sweep_land").length
  await j.advance(5000)
  const after = (await j.beats()).filter((b) => b.beat === "sweep_land").length
  expect(after).toBe(before)
})

test("odds refresh routes back to normal math after a defense is abandoned", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  const options = await j.optionTitles()
  await j.rig("resolve", [0.99])
  await j.rig("outcome", [0.99])
  await j.rig("opp-finish", [0.01])
  await j.rig("opp-sub-pick", [0.01])
  await j.pick(options[0])
  await j.advanceUntil("caught", 20000)

  await page.evaluate(() => (window as any).__neural.resetRoll())
  await j.advanceUntil("options_dealt", 20000)
  await j.advance(1000)

  // every visible card's % must equal moveChance (escape math would diverge)
  const mismatches = await page.evaluate(() => {
    const a = (window as any).__neural
    a.refreshOptionOdds() // the poisoned path rerouted this to escapeChance before the fix
    const out: string[] = []
    for (const oc of a._optionCards || []) {
      const el = oc.card.querySelector(".ngodds")
      if (!el) continue
      const shown = parseInt(el.textContent, 10)
      const truth = Math.round(a.moveChance(oc.node) * 100)
      if (shown !== truth) out.push(`${oc.node.t}: shown ${shown} vs moveChance ${truth}`)
    }
    return out
  })
  expect(mismatches).toEqual([])
})
