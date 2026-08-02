/* @hyperspace {"theme":"onboarding","L":"fresh-visitor","F":"intro-roll-coach","B":"cross-feature"} @invariant "The coach freeze pauses the visual countdown bars in lockstep with the logical clock: while the coach is up every .ngbar has animationPlayState 'paused', and on coach_done the bars resume to 'running' — the frozen-clock promise is honored on both the model and the rendered UI." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { freshVisitor } from "./personas"

/**
 * GUIDED-FIRST-ROLL COACH FREEZES THE RENDERED COUNTDOWN BARS — the UI half of the freeze law.
 *
 * The sibling spec (onboard-coach-freeze-blocks-expiry) proves the MODEL half: _tickDecision
 * early-returns while _coach is set, so the logical clock drains 0ms and no expiry fires. THIS
 * spec proves the two freezes are the SAME freeze on the RENDERED UI: every option card carries a
 * CSS `.ngbar` running the `ngCount` scaleX(1→0) countdown keyframe, and the coach flips every one
 * of them to animationPlayState 'paused' the instant it opens. On coach_done they resume together
 * to 'running'. A user watching the shrinking bars sees them literally stop while the coach is up.
 *
 * Mechanism (source-verified neural/src/app.src.jsx == served source/public/static/neural/app/neural.js,
 * bundle mtime 10s after src):
 *   - enterLand builds the option cards FIRST (:4296 buildOptionCard) — each `.ngbar` is created with
 *     `animation: ngCount <sec>s linear forwards` (:3913,:3918) and starts 'running' because
 *     `this.paused` is false on a fresh land (:315). THEN maybeStartCoach() (:4303, first-ever only)
 *     sets _coach=1 and calls _setBarsPaused(true) (:4039), which queries optionsRef.current for every
 *     `.ngbar` and sets animationPlayState='paused' (:4051-4053). Ordering is load-bearing: the bars
 *     exist before the freeze flips them.
 *   - finishCoach() (:4055-4061) calls _setBarsPaused(this.paused) → 'running' (fresh land, never
 *     paused) and fires coach_done. It is the SHARED SINK: advanceCoach()'s 3rd step routes into it
 *     (:4045) and dismissCoach() routes into it (:4050) — so the walk-to-finish and the skip resume
 *     the bars identically. Both branches are covered below.
 *   - `@keyframes ngCount{from{scaleX(1)}to{scaleX(0)}}` (neural.css) is the countdown; asserting
 *     getComputedStyle().animationName === 'ngCount' is the non-vacuity guard — without a live
 *     animation attached, "paused" would be a meaningless read on nothing.
 *
 * House rails: no RNG on the coach path (the lifecycle draws none; land() already rigs the intro
 * ambient ai-skill/role/max-moves and rigStart), sim time only (advance, never wall-clock sleeps),
 * assertions are STRUCTURE (bar counts, animationPlayState, animationName identity, clock drift),
 * never card/answer/coach-copy TEXT.
 */

const POSITION = "Mount Top"

/** Reads the countdown bars' full state in ONE page.evaluate — the reusable rig for this invariant.
 *  inline = the authoritative signal the app WRITES (b.style.animationPlayState); computed = proof the
 *  BROWSER honors the pause on the live animation (getComputedStyle); animName pins the ngCount
 *  keyframe (non-vacuity); paused reports this.paused so resume-target reasoning is explicit. */
async function barStates(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const a = (window as any).__neural
    const el = a.optionsRef?.current
    const bars: Array<{ inline: string; computed: string; animName: string }> = []
    if (el) {
      el.querySelectorAll(".ngbar").forEach((b: HTMLElement) => {
        const cs = getComputedStyle(b)
        bars.push({ inline: b.style.animationPlayState, computed: cs.animationPlayState, animName: cs.animationName })
      })
    }
    return {
      count: bars.length,
      bars,
      coach: !!a._coach,
      paused: !!a.paused,
      remainingSec: a.decisionRemaining(),
    }
  })
}

/** Every bar reads a given play state on BOTH the inline signal and the computed (browser-honored)
 *  value, and each carries the live ngCount animation (non-vacuity — "paused" means something). */
function expectAllBars(s: Awaited<ReturnType<typeof barStates>>, state: "paused" | "running") {
  expect(s.count, "the first hand dealt option cards, each with a countdown bar").toBeGreaterThanOrEqual(3)
  for (const b of s.bars) {
    expect(b.inline, `inline animationPlayState is '${state}' (the signal the app writes)`).toBe(state)
    expect(b.computed, `computed animationPlayState is '${state}' (the browser honors it on the live anim)`).toBe(state)
    expect(b.animName, "the ngCount countdown animation is actually attached (non-vacuity)").toBe("ngCount")
  }
}

test("coach freezes every .ngbar to 'paused' in lockstep with the clock; advancing to coach_done resumes them to 'running'", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))

  const j = journey(page)
  // freshVisitor() is undefined by design → boot wipes storage, passes no initialState, so
  // bjj-neural-coached is absent and the guided first-roll coach fires on landing.
  await j.boot("/", { initialState: freshVisitor() })
  // keepCoach: hold the coach UP after landing (default land() dismisses it) so the bars stay frozen.
  await j.land(POSITION, { keepCoach: true })

  // ── PRECONDITION: the coach is at step 1 and has NOT finished. ──
  await j.expectBeat("coach_1")
  const preBeats = (await j.beats()).map((b) => b.beat)
  expect(preBeats, "coach opened at step 1").toContain("coach_1")
  expect(preBeats, "coach not yet finished under the freeze").not.toContain("coach_done")

  // ── FREEZE: while the coach is up every rendered bar is paused, on both signals, non-vacuously. ──
  const frozen = await barStates(page)
  expect(frozen.coach, "the coach is up while we hold the first hand").toBe(true)
  // finishCoach resumes to this.paused, NOT unconditionally 'running' — a fresh land is never paused,
  // which makes 'running' the unambiguous resume target and honors the invariant's "unless paused" clause.
  expect(frozen.paused, "a fresh land is not game-paused (so the resume target is unambiguously 'running')").toBe(false)
  expectAllBars(frozen, "paused")

  // ── LOCKSTEP SANITY: pump 3000ms — the MODEL clock does not drain AND the bars stay paused, so the
  // visual freeze and the model freeze are one freeze, not a one-frame artifact. ──
  const r0 = frozen.remainingSec
  await j.advance(3000)
  const mid = await barStates(page)
  expect(Math.abs(mid.remainingSec - r0), "logical clock frozen under the coach (< 0.5s drift over 3s)").toBeLessThan(0.5)
  expect(mid.coach, "coach still up after the 3s pump").toBe(true)
  expectAllBars(mid, "paused") // still paused after real sim time — not a transient

  // ── UNFREEZE: walk the coach to its finish. advanceCoach×3 — the 3rd advance routes into
  // finishCoach() (the shared sink) — fires coach_done and calls _setBarsPaused(this.paused). ──
  await page.evaluate(() => (window as any).__neural.advanceCoach()) // → coach_2
  await page.evaluate(() => (window as any).__neural.advanceCoach()) // → coach_3
  await page.evaluate(() => (window as any).__neural.advanceCoach()) // 3rd step → finishCoach()
  await j.expectBeat("coach_done")

  const resumed = await barStates(page)
  expect(resumed.coach, "coach cleared after finish").toBe(false)
  // the bars resumed to 'running' on BOTH signals — the rendered UI honors the unfreeze, not just the model
  expectAllBars(resumed, "running")

  // and the model clock ticks again now that the freeze lifted — the same freeze released on both halves
  const live0 = resumed.remainingSec
  expect(live0, "a decision window is still armed after the coach finished").toBeGreaterThan(0)
  await j.advance(2000)
  const live1 = await page.evaluate(() => (window as any).__neural.decisionRemaining())
  expect(live0 - live1, "clock unfrozen after coach_done: ~2s drained the window").toBeGreaterThanOrEqual(1.5)

  expect(errors, "no pageerror across land, freeze, lockstep pump, walk-to-finish, and resume").toEqual([])
})

test("the SKIP path (dismissCoach) resumes the bars identically to 'running' — finishCoach is the shared sink", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))

  const j = journey(page)
  await j.boot("/", { initialState: freshVisitor() })
  await j.land(POSITION, { keepCoach: true })
  await j.expectBeat("coach_1")

  // FREEZE holds under the coach exactly as on the walk path.
  const frozen = await barStates(page)
  expect(frozen.coach, "coach up before the skip").toBe(true)
  expect(frozen.paused, "fresh land not game-paused").toBe(false)
  expectAllBars(frozen, "paused")

  // SKIP: dismissCoach() with _coach truthy routes straight into finishCoach() (:4050) — the SAME
  // resume sink the 3rd advanceCoach uses — WITHOUT ever minting coach_2/coach_3.
  await page.evaluate(() => (window as any).__neural.dismissCoach())
  await j.expectBeat("coach_done")

  const seq = (await j.beats()).map((b) => b.beat)
  expect(seq.filter((b) => b === "coach_2").length, "skip branch never emits coach_2").toBe(0)
  expect(seq.filter((b) => b === "coach_3").length, "skip branch never emits coach_3").toBe(0)
  expect(seq.filter((b) => b === "coach_done").length, "the skip still completes onboarding: coach_done fires once").toBe(1)

  // RESUME: the shared sink flips every bar back to 'running' on both signals — byte-identical to the
  // walk-to-finish resume above, which is the point of the shared-sink claim.
  const resumed = await barStates(page)
  expect(resumed.coach, "coach cleared after skip").toBe(false)
  expectAllBars(resumed, "running")

  expect(errors, "no pageerror across land, freeze, and the skip resume").toEqual([])
})
