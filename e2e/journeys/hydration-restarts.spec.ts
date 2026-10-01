import { expect, test } from "@playwright/test"
import { journey } from "../dsl"

/**
 * DECK HYDRATION RESTARTS THE WIN-CHANCE SOLVE ONCE PER BURST, NOT ONCE PER DECK (FGHYD1).
 *
 * Every deck that lands changes the solve's input (`deckReady` is part of the request), and each
 * one used to cancel the running solve and post a new one: hydrating the corpus with a hand on
 * screen (game-knowledge.spec.ts's `soloDeck`) restarted it per deck, and those four tests went from
 * ~13 s to ~70 s on CI. `_residencyChanged` now restarts on a burst's first deck, once when it settles,
 * and once per NG_RESIDENCY_MAX_HOLD_MS while it streams.
 *
 * WHAT IS COUNTED: the `snapshot` and `evaluate` messages the page posts to a Worker, from its first
 * script on. It is the transport, not the app's own bookkeeping, so a second restart path cannot
 * hide from it. A restart is a SNAPSHOT: the residency changed, so the new request needs a new one.
 * Measured before the fix (2026-10-01, dev 55c238ade, 2,896 decks): 2,893 snapshots but only 2-5
 * evaluates, because each restart was cancelled before its evaluate was ever posted. So counting
 * evaluates alone would have reported the bug as healthy.
 *
 * NO VALUE CHANGES: the values that settle after the burst must equal a fresh solve of the same
 * state (a control restart with nothing else changed), read off the cards the app rendered.
 *
 * Mutant, recorded 2026-10-01 on the built bundle: restarting per deck (the pre-fix
 * `_onDeckHydrated`) turns this red at the ceiling.
 */

const COUNT = () => {
  const w = window as any
  w.__wm = { evaluate: 0, snapshot: 0 }
  const post = Worker.prototype.postMessage
  Worker.prototype.postMessage = function (this: Worker, msg: any, ...rest: any[]) {
    if (msg && (msg.op === "evaluate" || msg.op === "snapshot")) w.__wm[msg.op]++
    return (post as any).call(this, msg, ...rest)
  } as any
}
const status = (page: any) => page.evaluate(() => (window as any).__neural?._choiceValues?.snapshot()?.status || "none")
const settledValues = async (page: any) => {
  await expect.poll(() => status(page), { timeout: 120_000, message: "Win chance values settle" }).toMatch(/^(ready|bounded)$/)
  return page.locator('[data-choice-group="you"] [data-choice-win]').allTextContents()
}

test("hydrating every deck restarts the solve a bounded number of times, and the values equal a fresh solve", async ({ page }) => {
  test.setTimeout(300_000)
  const j = journey(page)
  await j.boot("/", { beforeNavigate: async (p: any) => { await p.addInitScript(COUNT) } })
  await j.land("Mount Top")
  await settledValues(page)
  const start = await page.evaluate(() => ({ ...(window as any).__wm }))
  const t0 = Date.now()
  const hydrated = await page.evaluate(async () => {
    const a = (window as any).__neural, keys = Object.keys(a.flashcards.decks)
    const before = keys.filter((k) => a._cardsOf(a.flashcards.decks[k])).length
    await a.hydrateDecks(keys)
    return keys.filter((k) => a._cardsOf(a.flashcards.decks[k])).length - before
  })
  const hydrateMs = Date.now() - t0
  const settled = await settledValues(page)
  const end = await page.evaluate(() => ({ ...(window as any).__wm }))
  const restarts = end.snapshot - start.snapshot, evaluates = end.evaluate - start.evaluate
  // coverage: the burst really happened (a positive count, never "no restarts because nothing landed")
  expect(hydrated, "the corpus hydrated with a hand on screen").toBeGreaterThan(1000)
  // leading + one per 2 s of streaming + trailing, plus slack for the settle and a late prepare
  const ceiling = 4 + Math.ceil(hydrateMs / 2000)
  expect(restarts, `${restarts} solve restarts (snapshots) for ${hydrated} decks over ${hydrateMs} ms (ceiling ${ceiling})`).toBeLessThanOrEqual(ceiling)
  expect(evaluates, `${evaluates} solves started (ceiling ${ceiling})`).toBeLessThanOrEqual(ceiling)
  expect(settled.length, "the hand shows values").toBeGreaterThan(0)
  expect(settled.every((v) => v !== "—"), "every card settled to a value").toBe(true)
  // the settled values ARE a fresh solve's: restart once with nothing else changed and compare,
  // waiting for that NEW request to settle (a fast solve can pass through "pending" unseen)
  const req = () => page.evaluate(() => (window as any).__neural._choiceValues.snapshot()?.request?.requestId || null)
  const was = await req()
  await page.evaluate(() => (window as any).__neural._gameValueChanged("control-fresh-solve"))
  await expect.poll(async () => (await req()) !== was && /^(ready|bounded)$/.test(await status(page)), { timeout: 120_000 }).toBe(true)
  expect(await settledValues(page), "settled values equal a fresh solve of the same state").toEqual(settled)
})
