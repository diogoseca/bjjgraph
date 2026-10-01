import { expect, test } from "@playwright/test"
import { journey } from "../dsl"

/**
 * A LATE CANCEL ACK MUST NOT COST WIN CHANCE FOR THE SESSION (FGCANCEL1, 2026-10-01).
 *
 * When a restart cancels the solve in flight, the client gives the worker a grace to acknowledge,
 * and terminates it if the ack is late (`worker-cancellation-deadline`). Two things were wrong:
 *   - the grace was 1 s, and an ack can be late without the worker being broken: the worker is busy
 *     in a solve, and the PAGE's main thread has to deliver the ack;
 *   - a termination was HELD for the session. The gate's own sequence hit it 2 times in 48 local
 *     runs (FGHYD2), and only Retry cleared it.
 * Now the grace comes from a measurement (NG_GAME_VALUE_CANCEL_GRACE_MS, reasoning at its
 * definition), and a deadline-killed worker is replaced on the next request, at most
 * NG_GAME_VALUE_WORKER_RECOVERIES times (onTerminated in game-value-runtime.src.js).
 *
 * The fault is a DELAYED ack: the page-side listener of the worker's `cancelled` message runs
 * ACK_DELAY_MS late, which is exactly what the client's grace timer measures. Each test asserts that
 * a cancel was posted and that its ack really was delayed, so a cancel that never happened cannot
 * pass.
 *   1. delayed ack inside the grace (above the old 1 s)  -> the worker is never replaced; values arrive;
 *   2. delayed ack past the grace                         -> the worker is replaced once; values arrive.
 * The bound (a third deadline is held) and "a crash is held at once" are pinned in
 * tests/game_value_runtime.test.mjs.
 * Mutants, recorded 2026-10-01 on the built game-values.js, both killed:
 *   - the grace back to the client's 1 s default -> test 1: "the late worker was NOT terminated and
 *     replaced", 2 workers where 1 was expected;
 *   - no recovery (bound 0)                       -> test 2: the fresh worker never comes (1, not 2),
 *     and values stay held.
 */

const GRACE_MS = 10000   // = NG_GAME_VALUE_CANCEL_GRACE_MS in game-value-runtime.src.js (the measurement is there)
const DELAY = () => {
  const w = window as any
  w.__ackFault = { delayMs: 0, delayed: 0, workers: 0, cancels: 0, evaluates: 0 }
  const post = Worker.prototype.postMessage
  Worker.prototype.postMessage = function (this: Worker, msg: any, ...rest: any[]) {
    if (msg?.op === "cancel") w.__ackFault.cancels++
    if (msg?.op === "evaluate") w.__ackFault.evaluates++
    return (post as any).call(this, msg, ...rest)
  } as any
  const W = window.Worker
  ;(window as any).Worker = class extends W {
    private __wrapped = new Map<any, any>()
    constructor(u: any, o?: any) { super(u, o); w.__ackFault.workers++ }
    addEventListener(type: string, fn: any, opts?: any) {
      if (type !== "message" || typeof fn !== "function") return super.addEventListener(type, fn, opts)
      const wrapped = (e: any) => {
        const f = w.__ackFault
        if (e.data?.op === "cancelled" && f.delayMs > 0) { f.delayed++; setTimeout(() => fn.call(this, e), f.delayMs) }
        else fn.call(this, e)
      }
      this.__wrapped.set(fn, wrapped)
      return super.addEventListener(type, wrapped, opts)
    }
    removeEventListener(type: string, fn: any, opts?: any) { return super.removeEventListener(type, this.__wrapped.get(fn) || fn, opts) }
  }
}
const fault = (page: any) => page.evaluate(() => ({ ...(window as any).__ackFault }))
const statusWhy = (page: any) => page.evaluate(() => {
  const a = (window as any).__neural, s = a?._choiceValues?.snapshot()
  return [s?.status || "none", s?.reason, a?._gameValueState, a?._gameValueReason].map((x) => x || "-").join(" | ")
})
const settled = (page: any, message: string) =>
  expect.poll(() => statusWhy(page), { timeout: 120_000, message }).toMatch(/^(ready|bounded) \|/)

// restart, wait until that solve is really running in the worker, then restart again: the second
// restart cancels the first solve mid-flight
async function cancelMidSolve(page: any) {
  const { evaluates } = await fault(page)
  await page.evaluate(() => (window as any).__neural._gameValueChanged("fault-cancel-start"))
  await expect.poll(async () => (await fault(page)).evaluates, { timeout: 30_000, message: "the solve to cancel was posted" }).toBeGreaterThan(evaluates)
  await page.waitForTimeout(150)
  await page.evaluate(() => (window as any).__neural._gameValueChanged("fault-cancel-cut"))
}

async function boot(page: any) {
  const j = journey(page)
  await j.boot("/", { beforeNavigate: async (p: any) => { await p.addInitScript(DELAY) } })
  await j.land("Mount Top")
  await settled(page, "values settle before the fault")
  return j
}

test("a cancel acknowledged late, but inside the grace, does not cost the worker", async ({ page }) => {
  test.setTimeout(240_000)
  await boot(page)
  expect((await fault(page)).workers, "one worker before the fault").toBe(1)
  const delayMs = Math.round((1000 + GRACE_MS) / 2)   // halfway between the old 1 s grace and the measured one
  expect(GRACE_MS - delayMs, "the fault sits well clear of both graces").toBeGreaterThanOrEqual(250)
  await page.evaluate((ms: number) => { (window as any).__ackFault.delayMs = ms }, delayMs)
  await cancelMidSolve(page)
  await expect.poll(async () => (await fault(page)).delayed, { timeout: 30_000, message: "a cancel ack was delayed" }).toBeGreaterThan(0)
  await page.waitForTimeout(delayMs + 500)
  await settled(page, "values settle after a late ack")
  const f = await fault(page)
  expect(f.cancels, "a cancel was posted").toBeGreaterThan(0)
  expect(f.workers, "the late worker was NOT terminated and replaced").toBe(1)
  expect(await page.evaluate(() => (window as any).__neural._gameValueRecoveries || 0)).toBe(0)
})

test("a worker killed for a late cancel ack is replaced, and Win chance still arrives", async ({ page }) => {
  test.setTimeout(240_000)
  await boot(page)
  await page.evaluate((ms: number) => { (window as any).__ackFault.delayMs = ms }, GRACE_MS + 1500)
  await cancelMidSolve(page)
  await expect.poll(async () => (await fault(page)).delayed, { timeout: 30_000, message: "a cancel ack was delayed" }).toBeGreaterThan(0)
  await expect.poll(async () => (await fault(page)).workers, { timeout: GRACE_MS + 30_000, message: "the client terminated the late worker and a fresh one was created" }).toBe(2)
  await page.evaluate(() => { (window as any).__ackFault.delayMs = 0 })   // the fresh worker acks on time
  await settled(page, "values settle on the replacement worker")
  expect(await page.evaluate(() => (window as any).__neural._gameValueRecoveries || 0), "one recovery spent").toBe(1)
  const values = await page.locator('[data-choice-group="you"] [data-choice-win]').allTextContents()
  expect(values.length, "the hand shows values").toBeGreaterThan(0)
  expect(values.every((v: string) => v !== "—"), "every card settled to a value").toBe(true)
})
