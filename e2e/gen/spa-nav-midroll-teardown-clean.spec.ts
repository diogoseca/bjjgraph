/* @hyperspace {"theme":"lifetime-journeys","L":"casual-week1","F":"spa-nav","B":"interruption-abort"} @invariant "A soft navigation in the middle of a live roll (options dealt, decision clock running) tears down without ghosts: the remounted app has no residual _defendSub/_sweep/_beltTest/optionIdxs from the old life, no stray timer fires a beat into the new instance, and a fresh land deals a live hand." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { casualWeek1 } from "./personas"

/**
 * SPA-NAV MID-ROLL TEARDOWN — a week-1 casual walks away from a LIVE roll (hand dealt,
 * decision clock running, expand sheet open) via a Quartz soft navigation; the teardown
 * must leave no ghosts in the remounted life.
 *
 * Seams under test (probe-verified twice, ~4.1s, deterministic):
 *   - destroy() (neural/build/build.mjs:116-122): sets __ngDestroyed, runs
 *     componentWillUnmount (cancels rAF, clearTimers -> _timers=[]), removes __ngRoot,
 *     nulls window.__neural so the SPA remount hook mounts a NEW instance.
 *   - engagement state (app.src.jsx:179-186): _decision/_optPick/_defendSub/_sweep must be
 *     constructor-fresh (nullish) on the REMOUNTED instance — plus _beltTest, which only
 *     explicit cancellation clears in-life (a remount must never inherit one).
 *   - _tickDecision (app.src.jsx:4309-4333): expiry_warning at secLeft<=3, auto_pick at 0 —
 *     the ghost-clock signals this spec listens for on the fresh life's beat stream.
 *
 * Clean signal separation (why the drain-to-<=4.5s matters): the old clock is abandoned
 * with <=4.5s remaining, so IF it survived teardown it MUST fire (warnings + auto_pick)
 * inside the 5s post-remount watch; the fresh life's own legit expiry_warning cannot fire
 * before ~10.5s (3.2s intro + ~1.3s deal + (dsec-3)s with dsec>=9 — premise-asserted).
 * Any forbidden beat inside the watch is therefore unambiguously a ghost.
 *
 * CRITICAL PITFALL (all future spa-nav specs): the nav target MUST be a canonical slug —
 * "/Game-Over", capital G-O. Lowercase "/game-over" is a Quartz alias REDIRECT STUB whose
 * <meta http-equiv=refresh> is appended by navigate()'s head patch and HARD-navigates
 * (fresh window; the harness init script then wipes storage — masquerades as a teardown
 * bug). Detection signature: location.href flips case + window.__probeOldRef vanishes —
 * guarded below by the "soft nav stayed same-document" assert. (Not an ISSUES.md bug:
 * stock Quartz alias behavior with a correct end state — a full reload cannot leave
 * ghosts, and real users keep localStorage; only the e2e harness wipes it.)
 */

const POSITION = "Mount Top"
const FORBIDDEN = ["auto_pick", "expiry_warning", "impact_success", "impact_fail", "commit"]

test("mid-roll soft nav: old life torn down silent, remount residue-free, fresh land deals a live hand", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))

  const j = journey(page)
  await j.boot("/", { initialState: casualWeek1() })
  await j.land(POSITION)
  await j.expectBeat("land")
  await j.expectBeat("options_dealt")

  // ── life-1 premise: a LIVE hand under a LIVE clock, long enough for signal separation ──
  const hand1 = await j.optionTitles()
  expect(hand1.length, "life 1 dealt a live hand").toBeGreaterThanOrEqual(3)
  const clock = await page.evaluate(() => {
    const a = (window as any).__neural
    return { total: a._decision?.total ?? -1, remaining: a._decision?.remaining ?? -1, live: !!a._optPick }
  })
  expect(clock.live, "decision pick handler armed (mid-roll premise)").toBe(true)
  expect(clock.total, "decision window >= 9s — life 2's own warning stays out of the 5s watch").toBeGreaterThanOrEqual(9000)

  // ── drain the clock into the ghost-detection band: a SURVIVING old clock must expire
  // (auto_pick) inside the 5s post-nav watch, while staying live (>0) and above the 3s
  // warning threshold pre-nav — the beat streams separate cleanly on both sides ──
  const drainSteps = Math.ceil((clock.total - 4500) / 500) + 4 // derived cap: cannot spin forever
  let remaining = clock.remaining
  for (let i = 0; i < drainSteps && remaining > 4500; i++) {
    await j.advance(500)
    remaining = await page.evaluate(() => (window as any).__neural._decision?.remaining ?? -1)
  }
  expect(remaining, "clock drained into the ghost-detection band").toBeLessThanOrEqual(4500)
  expect(remaining, "clock still ticking — auto_pick has NOT fired (still mid-roll)").toBeGreaterThan(0)
  const preNav = (await j.beats()).map((b) => b.beat)
  expect(preNav.filter((b) => b === "auto_pick" || b === "expiry_warning"), "pre-nav: no expiry signal yet").toEqual([])

  // ── open the expand sheet (mid-interaction surface; pauses the clock — must still tear down) ──
  await page.locator(`[data-tech="${hand1[0]}"]`).first().click()
  await expect(page.locator("[data-go]").first(), "expand sheet open at nav time").toBeVisible()

  // mark life 1 + stash a window-global ref (window globals survive a SOFT nav — this is
  // both the corpse handle and the alias-stub hard-nav detector)
  await page.evaluate(() => {
    const a = (window as any).__neural
    a.__probeLife = 1
    ;(window as any).__probeOldRef = a
  })

  // ── Quartz soft nav mid-roll (spa.inline.ts seam). CANONICAL slug — see pitfall above ──
  await page.evaluate(() => (window as any).spaNavigate(new URL("/Game-Over", location.origin)))
  await page.waitForFunction(
    () => {
      const a = (window as any).__neural
      return !!(a && !a.__probeLife && a.nodes && a.nodes.length && typeof a.advance === "function" && a.flashcards && a.flashcards.decks)
    },
    undefined,
    { timeout: 90_000 },
  )

  // ── remount inspection: fresh life residue-free, old life a silenced corpse ──
  const state = await page.evaluate(() => {
    const a = (window as any).__neural
    const old = (window as any).__probeOldRef
    return {
      sameDoc: !!old, // a lowercase alias-stub hard nav would have wiped this window global
      sameRef: a === old,
      fresh: {
        decision: a._decision == null,
        optPick: a._optPick == null,
        defendSub: a._defendSub == null,
        sweep: a._sweep == null,
        beltTest: a._beltTest == null,
        options: (a.optionIdxs || []).length,
        beats: (a.beats || []).length,
      },
      roots: document.querySelectorAll("#neural-root").length,
      sheets: document.querySelectorAll("[data-go]").length,
      corpse: old && {
        destroyed: old.__ngDestroyed === true,
        timers: (old._timers || []).length,
        rafDisarmed: old._raf == null,
        beats: (old.beats || []).length,
      },
    }
  })
  expect(state.sameDoc, "soft nav stayed same-document (canonical slug; the alias stub would hard-navigate)").toBe(true)
  expect(state.sameRef, "remount is a NEW instance, not the old ref").toBe(false)
  expect(state.fresh.decision, "no residual _decision from the old life").toBe(true)
  expect(state.fresh.optPick, "no residual _optPick from the old life").toBe(true)
  expect(state.fresh.defendSub, "no residual _defendSub from the old life").toBe(true)
  expect(state.fresh.sweep, "no residual _sweep from the old life").toBe(true)
  expect(state.fresh.beltTest, "no residual _beltTest from the old life").toBe(true)
  expect(state.fresh.options, "no residual optionIdxs from the old hand").toBe(0)
  expect(state.fresh.beats, "fresh life's beat stream starts empty").toBe(0)
  expect(state.roots, "exactly one #neural-root (old overlay removed)").toBe(1)
  expect(state.sheets, "the old life's open expand sheet did not survive teardown").toBe(0)
  expect(state.corpse.destroyed, "old instance flagged __ngDestroyed").toBe(true)
  expect(state.corpse.timers, "old instance _timers cleared by teardown").toBe(0)
  expect(state.corpse.rafDisarmed, "old instance holds no armed rAF").toBe(true)
  const corpseBeats0: number = state.corpse.beats

  // ── rig the fresh life's auto-roll (rules: no Math.random), then run the 5s ghost watch ──
  await j.rig("ai-skill", [0.5])
  await j.rig("role", [0])
  await j.rig("max-moves", [0.5])
  await page.evaluate((pos) => {
    const a = (window as any).__neural
    const idx = a.nodes.findIndex((n: any) => n.ty === "positions" && n.t === pos)
    if (idx < 0) throw new Error(`position not found: ${pos}`)
    a.rigStart(idx) // the remount's 3.2s intro auto-starts a roll that consumes this
  }, POSITION)
  for (let i = 0; i < 10; i++) await j.advance(500) // 5s watch: an alive old clock (<=4.5s) MUST fire in here
  const watch = (await j.beats()).map((b) => b.beat)
  expect(watch.filter((b) => FORBIDDEN.includes(b)), "no ghost beat inside the 5s watch").toEqual([])
  expect(watch.filter((b) => b === "land").length, "fresh life landed exactly once during the watch").toBe(1)
  expect(watch.filter((b) => b === "options_dealt").length, "fresh life dealt exactly one hand during the watch").toBe(1)

  // ── final leg: the fresh land is fully playable (returns on the already-dealt hand) ──
  await j.land(POSITION)
  await j.expectBeat("options_dealt")
  const hand2 = await j.optionTitles()
  expect(hand2.length, "fresh land deals a full live hand (same deal size as life 1)").toBe(hand1.length)
  expect(await j.currentPosition(), "fresh life is standing at the landed position").toBe(POSITION)

  // ── end state: corpse frozen across watch + land, forbidden set still empty, zero page errors ──
  const end = await page.evaluate(() => {
    const old = (window as any).__probeOldRef
    return { corpseBeats: (old.beats || []).length, corpseTimers: (old._timers || []).length }
  })
  expect(end.corpseBeats, "old corpse's beat stream frozen across the whole post-nav window").toBe(corpseBeats0)
  expect(end.corpseTimers, "old corpse's timer list still empty at journey end").toBe(0)
  const finalBeats = (await j.beats()).map((b) => b.beat)
  expect(finalBeats.filter((b) => FORBIDDEN.includes(b)), "forbidden set still empty at journey end").toEqual([])
  expect(errors, "no pageerror across roll, soft nav, remount, and fresh land").toEqual([])
})
