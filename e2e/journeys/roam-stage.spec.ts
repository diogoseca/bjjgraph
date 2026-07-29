import { test, expect } from "@playwright/test"
import { journey } from "../dsl"

/**
 * P2 — ROAM & STAGE.
 *
 * Clicking any node takes you there and STAGES a roll: the camera flies, the state lands, the
 * hand deals — and the clock stays stopped. Click somewhere else and you restage the same
 * non-session. It never played, so there is nothing to archive and nothing to lose. Press play
 * and only then does the roll become a session.
 *
 * Rails: __neural.stageRollAt(idx), ._played, ._pastRolls, .paused
 * Beats: roll_staged
 * (canvas hit-testing has no DOM to click — the tap handler calls stageRollAt directly)
 */

const paused = (page: any) => page.evaluate(() => !!(window as any).__neural.paused)
const played = (page: any) => page.evaluate(() => !!(window as any).__neural._played)
const archived = (page: any) =>
  page.evaluate(() => ((window as any).__neural._pastRolls || []).length)

/** n playable position nodes that are not where we currently are */
const elsewhere = (page: any, n = 2) =>
  page.evaluate((want: number) => {
    const a = (window as any).__neural
    const out: number[] = []
    for (const node of a.nodes) {
      if (node.ty !== "positions" || node.idx === a.currentPos) continue
      if (!a.adj[node.idx].some((k: number) => a.nodes[k].ty !== "positions")) continue
      out.push(node.idx)
      if (out.length >= want) break
    }
    return out
  }, n)

test("roaming to a node lands you there with the clock held", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  expect(await paused(page), "the roll is live before roaming").toBe(false)

  const [target] = await elsewhere(page, 1)
  expect(target, "a playable position elsewhere on the graph").toBeGreaterThanOrEqual(0)

  await page.evaluate((i) => (window as any).__neural.stageRollAt(i), target)
  await j.expectBeat("roll_staged")
  expect(await paused(page), "roaming stops the game").toBe(true)

  // the staged state still ARRIVES — landing is what roam is for; only time is held
  await j.advance(1500)
  expect(await page.evaluate(() => (window as any).__neural.currentPos), "we are there").toBe(
    target,
  )
  expect(
    await page.evaluate(() => ((window as any).__neural.optionIdxs || []).length),
    "with a hand dealt",
  ).toBeGreaterThan(0)
  await expect(page.locator("[data-landcard]"), "and the state introduces itself").toBeVisible()
  expect(await paused(page), "and the clock is still stopped").toBe(true)
  expect(await played(page), "nothing has been played yet").toBe(false)
})

test("restaging archives nothing — a roll that never played is not a roll", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  // play a real roll far enough to be worth archiving. The log only grows when the roll reaches
  // a DIFFERENT state, so rig a successful transition — a failure leaves you where you started
  // and the archive threshold (>1 logged state) is never crossed.
  const t = await page.evaluate(() => {
    const a = (window as any).__neural
    for (const i of a.optionIdxs || []) if (a.nodes[i].ty === "transitions") return a.nodes[i].t
    return (a.nodes[(a.optionIdxs || [])[0]] || {}).t || ""
  })
  expect(t, "a transition to advance on").toBeTruthy()
  await j.rig("resolve", [0.01])
  await j.rig("outcome", [0.01])
  await j.pick(t)
  await j.nextHand()
  expect(await played(page)).toBe(true)
  expect((await j.rollTrail()).length, "the roll reached a second state").toBeGreaterThan(1)

  const [a, b] = await elsewhere(page, 2)
  await page.evaluate((i) => (window as any).__neural.stageRollAt(i), a)
  await j.advance(1500)
  const afterFirst = await archived(page)
  expect(afterFirst, "the roll that DID play was archived").toBeGreaterThan(0)

  await page.evaluate((i) => (window as any).__neural.stageRollAt(i), b)
  await j.advance(1500)
  expect(await archived(page), "restaging over a roll that never played archives nothing").toBe(
    afterFirst,
  )
})

test("a staged roll becomes a session the moment it runs", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  const [target] = await elsewhere(page, 1)
  await page.evaluate((i) => (window as any).__neural.stageRollAt(i), target)
  await j.advance(1500)
  expect(await played(page), "staged, not played").toBe(false)

  await page.evaluate(() => (window as any).__neural.setPaused(false))
  await j.advance(600)
  expect(await played(page), "pressing play starts the session").toBe(true)
  expect(await paused(page)).toBe(false)
})
