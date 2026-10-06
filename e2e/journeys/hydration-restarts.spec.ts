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
 * Mutants, recorded 2026-10-01 on the built bundle (dev a7bc58ce4), all killed:
 *   - restarting per deck (the pre-fix `_onDeckHydrated`)  -> 2,852 restarts OUTSIDE the coalescer;
 *   - the knowledge notice not routed to the coalescer      -> 2,896 OUTSIDE;
 *   - the option-odds refresh not held                      -> 27 OUTSIDE;
 *   - the same-key drill panel not held                     -> 25 OUTSIDE;
 *   - the coalescer itself restarting on every arrival      -> 2,886 snapshots against a ceiling of 32.
 *
 * THE CEILING IS COUNTED IN BURSTS, NOT IN SECONDS (FGHYD2). The first ceiling, 4 + ceil(ms / 2000),
 * assumed the decks arrive as ONE stream. Often they do not, even locally: 19 of 40 local runs had a
 * gap of more than 250 ms between two arrivals (largest 3,349 ms). A stall longer than
 * NG_RESIDENCY_SETTLE_MS closes the burst, and the next deck opens a new one, with one more leading
 * restart and one more trailing one. Both are correct. On CI (PR 242, e2e-full
 * shard 2) this went red at 10 snapshots against a ceiling of 9 over 9,969 ms, which is two stalls'
 * worth. A probe over 20 local runs (dev and PR 242) traced every snapshot to the coalescer.
 * So the ceiling is now the coalescer's own contract, read off the arrivals this run actually had:
 *   2 per burst (leading + trailing) + 1 per NG_RESIDENCY_MAX_HOLD_MS of streaming + SLACK.
 * SLACK covers a stale reply's refresh once the hold closes, and a late prepare. A burst ends at a
 * gap longer than SPLIT_MS. SPLIT_MS sits below the settle delay, so timer jitter can only LOOSEN
 * the bound, by counting a split that never happened. It can never tighten it.
 * A SECOND count names the path when this goes red: snapshots minus the coalescer's own restarts
 * (`_residencyStats`) is what came from anywhere else. It is 0 when every restart went through the
 * coalescer. It goes negative when a microtask merges two restarts into one solve, and it is held to
 * the same SLACK as above. Every pre-fix path restarted beside the coalescer, not through it.
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
// polled WITH its reasons, so a red names why the values did not settle: the controller's reason,
// then the runtime's state and reason (FGHYD2: one local red ended "unavailable" and said nothing more)
const statusWhy = (page: any) => page.evaluate(() => {
  const a = (window as any).__neural, s = a?._choiceValues?.snapshot()
  return [s?.status || "none", s?.reason, a?._gameValueState, a?._gameValueReason].map((x) => x || "-").join(" | ")
})
const settledValues = async (page: any) => {
  await expect.poll(() => statusWhy(page), { timeout: 120_000, message: "Win chance values settle (status | reason | game-value state | its reason)" }).toMatch(/^(ready|bounded) \|/)
  return page.locator('[data-choice-group="you"] [data-choice-win]').allTextContents()
}

test("hydrating every deck restarts the solve a bounded number of times, and the values equal a fresh solve", async ({ page }) => {
  test.setTimeout(300_000)
  const j = journey(page)
  await j.boot("/", { beforeNavigate: async (p: any) => { await p.addInitScript(COUNT) } })
  await j.land("Mount Top")
  await settledValues(page)
  const counts = () => page.evaluate(() => ({ ...(window as any).__wm, coalesced: (window as any).__neural._residencyStats?.restarts || 0 }))
  const start = await counts()
  // arrival times come from `_onDeckHydrated`, the event the coalescer is fed by, never from the
  // coalescer itself: a mutant that bypasses it must not be able to move the bound it is held to
  const { hydrated, arrivals } = await page.evaluate(async () => {
    const a = (window as any).__neural, keys = Object.keys(a.flashcards.decks), arrivals: number[] = []
    const before = keys.filter((k) => a._cardsOf(a.flashcards.decks[k])).length
    const own = Object.prototype.hasOwnProperty.call(a, "_onDeckHydrated"), orig = a._onDeckHydrated
    a._onDeckHydrated = function (this: any, ...args: any[]) { arrivals.push(performance.now()); return orig.apply(this, args) }
    try { await a.hydrateDecks(keys) } finally { if (own) a._onDeckHydrated = orig; else delete a._onDeckHydrated }
    return { hydrated: keys.filter((k) => a._cardsOf(a.flashcards.decks[k])).length - before, arrivals }
  })
  const settled = await settledValues(page)
  const end = await counts()
  const restarts = end.snapshot - start.snapshot, evaluates = end.evaluate - start.evaluate
  const coalesced = end.coalesced - start.coalesced, outside = restarts - coalesced
  // coverage: the burst really happened (a positive count, never "no restarts because nothing landed")
  expect(hydrated, "the corpus hydrated with a hand on screen").toBeGreaterThan(1000)
  expect(arrivals.length, "every hydrated deck was seen arriving").toBeGreaterThanOrEqual(hydrated)
  // the header's bound: 2 per burst + 1 per MAX_HOLD_MS of streaming + SLACK
  const SPLIT_MS = 200, MAX_HOLD_MS = 2000, SLACK = 2   // NG_RESIDENCY_SETTLE_MS is 250, NG_RESIDENCY_MAX_HOLD_MS 2000
  const gaps = arrivals.slice(1).map((t, i) => t - arrivals[i])
  const bursts = 1 + gaps.filter((g) => g > SPLIT_MS).length
  const streamMs = Math.round(arrivals[arrivals.length - 1] - arrivals[0])
  const ceiling = 2 * bursts + Math.floor(streamMs / MAX_HOLD_MS) + SLACK
  const shape = `${hydrated} decks in ${bursts} burst(s) over ${streamMs} ms, largest gap ${Math.round(Math.max(0, ...gaps))} ms`
  // names the path first: a restart that did not come through the coalescer is a new per-deck path
  expect(outside, `${outside} solve restarts came from OUTSIDE the burst coalescer (${restarts} snapshots, ${coalesced} coalesced restarts; ${shape})`).toBeLessThanOrEqual(SLACK)
  expect(restarts, `${restarts} solve restarts (snapshots) for ${shape} (ceiling ${ceiling})`).toBeLessThanOrEqual(ceiling)
  expect(evaluates, `${evaluates} solves started for ${shape} (ceiling ${ceiling})`).toBeLessThanOrEqual(ceiling)
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
