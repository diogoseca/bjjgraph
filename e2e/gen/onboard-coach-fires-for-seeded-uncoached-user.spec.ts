/* @hyperspace {"theme":"onboarding","L":"curriculum-mid","F":"intro-roll-coach","B":"cross-feature"} @invariant "The coach gates ONLY on the bjj-neural-coached flag, not on progress: a mid-curriculum persona (real prep/units) who has never been coached still gets coach_1 with the frozen clock on their first landing — study progress does not suppress first-roll onboarding." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { curriculumMid } from "./personas"

/**
 * FIRST-ROLL COACH IS PROGRESS-BLIND — it gates on the bjj-neural-coached flag ALONE.
 *
 * The kept sibling probe (onboard-coach-freeze-blocks-expiry.spec.ts) proves the freeze for a
 * FRESH visitor (empty storage). This is its progress-blind counterpart: a curriculumMid persona
 * has REAL study state (unit-1 checkpoint passed, 5 recall-mastered decks, 8 graded prep decks)
 * yet has never triggered the first-roll coach — and must STILL be coached on their first landing.
 * The distinguishing signature vs the fresh-visitor probe is the seed-proof block
 * (masteredCount/units/prep non-empty) plus the null-flag-at-boot check: progress rides
 * bjj-neural-progress, a DIFFERENT localStorage key than the coach's bjj-neural-coached, so seeding
 * can never accidentally suppress onboarding.
 *
 * Mechanism under test (source-verified, neural/src/app.src.jsx):
 *   maybeStartCoach() :4034-4042 — early-returns on (_coach || _coachDone), then reads ONLY
 *     localStorage.getItem("bjj-neural-coached"); it never inspects prep/rec/units. Absent flag
 *     ⇒ _coach=1, _setBarsPaused(true), coach_1. THIS is the gate that must ignore progress.
 *   enterLand(first) :4303 — calls maybeStartCoach() when first===true (the first-ever landing);
 *     rigStart's start path :4195-4196 arms the deterministic top-role start and schedules
 *     after(1.3, …enterLand(true)) :4213, which land() pumps through.
 *   finishCoach() :4055-4061 — the ONLY writer of bjj-neural-coached="1" (:4058). keepCoach never
 *     calls it, so the flag stays null the whole time the coach is up.
 *   _tickDecision() :4315-4317 — early-returns while this._coach is truthy ⇒ the decision clock is
 *     frozen; decisionRemaining() does not drain across an advance().
 *
 * Working recipe (probe-verified, 4/4 with repeat-each=3, ~1.9s each, no flake):
 *   - curriculumMid() → boot seeds bjj-neural-progress (v2 blob with units/prep/rec), NOT the coach
 *     flag. land("Mount Top", {keepCoach:true}) reaches enterLand(true) and, because the coach flag
 *     is absent, coaches; keepCoach skips land()'s dismissCoach() so the card stays up.
 *   - SELECTORS: everything reads via window.__neural (a.masteredCount / a.units / a.prep / a._coach
 *     / a.decisionRemaining / a.beats) and the two localStorage keys. No new DOM selectors, no
 *     card/answer TEXT (structure-only, per house rails). The frozen clock means no timer flake even
 *     without pre-rigging the auto-pick pool.
 *
 * Determinism (house rails): no Math.random touched. land() rigs ai-skill/role/max-moves + rigStart;
 * the coach lifecycle draws no RNG. Frame time is pumped only via land()'s advances and one explicit
 * advance(3000) to prove the freeze — no wall-clock sleeps.
 */

test("mid-curriculum uncoached user still gets coach_1 + frozen clock on first landing (progress-blind gate)", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))

  const j = journey(page)

  // ── Coach flag must be absent BEFORE the app reads it — captured from the very first init
  //    script, so this is the boot-time value the gate actually sees (not a post-hoc read). ──
  await page.addInitScript(() => {
    try {
      ;(window as any).__coachedAtBoot = localStorage.getItem("bjj-neural-coached")
    } catch {
      ;(window as any).__coachedAtBoot = "ERR"
    }
  })

  // curriculumMid seeds bjj-neural-progress (units/prep/rec) — NOT the coach flag.
  await j.boot("/", { initialState: curriculumMid() })
  // keepCoach: hold the card up (land() otherwise dismisses it before we can assert).
  await j.land("Mount Top", { keepCoach: true })

  // ── (1) SEED PROOF: this is a genuinely mid-curriculum user, not a fresh visitor ──
  const seed = await page.evaluate(() => {
    const a = (window as any).__neural
    return {
      mastered: a.masteredCount(),
      unitKeys: Object.keys(a.units || {}).length,
      prepKeys: Object.keys(a.prep || {}).length,
      recKeys: Object.keys(a.rec || {}).length,
      progressStored: !!localStorage.getItem("bjj-neural-progress"),
    }
  })
  expect(seed.mastered, "curriculumMid seeded mastered decks (rec>=3) — real progress").toBeGreaterThan(0)
  expect(seed.unitKeys, "curriculumMid recorded a passed unit checkpoint").toBeGreaterThan(0)
  expect(seed.prepKeys, "curriculumMid graded prep decks").toBeGreaterThan(0)
  expect(seed.recKeys, "curriculumMid proved recall decks").toBeGreaterThan(0)
  expect(seed.progressStored, "progress rides the bjj-neural-progress key").toBe(true)

  // ── (2) COACHED FLAG IS NULL — at boot (the value the gate read) AND still null under the
  //    coach (keepCoach never calls finishCoach, the sole writer of "1"). Progress seeding on a
  //    DIFFERENT key never touched it. This is what separates "seeded" from "already onboarded". ──
  const flag = await page.evaluate(() => ({
    atBoot: (window as any).__coachedAtBoot ?? null,
    now: localStorage.getItem("bjj-neural-coached"),
  }))
  expect(flag.atBoot, "bjj-neural-coached absent at boot — the gate saw no prior onboarding").toBeNull()
  expect(flag.now, "coach flag STILL null under an open coach (finishCoach never ran)").toBeNull()

  // ── (3) THE COACH FIRED regardless of progress: coach_1 + options_dealt beats, _coach open ──
  const coach = await page.evaluate(() => {
    const a = (window as any).__neural
    const beats = (a.beats || []).map((b: any) => b.beat)
    return {
      coach1: beats.filter((b: string) => b === "coach_1").length,
      optionsDealt: beats.filter((b: string) => b === "options_dealt").length,
      coachDone: beats.filter((b: string) => b === "coach_done").length,
      coachFlag: a._coach ?? null,
      remaining: a.decisionRemaining(),
    }
  })
  expect(coach.coach1, "coach_1 fired on the first landing despite mid-curriculum progress").toBeGreaterThanOrEqual(1)
  expect(coach.optionsDealt, "the first hand was dealt (land completed)").toBeGreaterThanOrEqual(1)
  expect(coach.coachDone, "coach not finished — keepCoach held it open").toBe(0)
  expect(coach.coachFlag, "coach state machine is open on step 1").toBe(1)
  // beat-stream assertions via the DSL helper too (parity with the probe's expectBeat usage)
  await j.expectBeat("coach_1")
  await j.expectBeat("options_dealt")

  // ── FROZEN CLOCK: _tickDecision early-returns while _coach is truthy, so decisionRemaining()
  //    does not drain across a 3s pump. Mechanism, not incidental — the frozen-clock promise. ──
  const r0 = coach.remaining
  expect(r0, "a decision window exists and has time on the clock under the coach").toBeGreaterThan(0)
  await j.advance(3000)
  const r1 = await page.evaluate(() => (window as any).__neural.decisionRemaining())
  expect(Math.abs(r1 - r0), `clock frozen under the coach: r0=${r0} r1=${r1} (Δ<0.5s)`).toBeLessThan(0.5)

  expect(errors, "zero pageerror across the seeded-uncoached coach landing").toEqual([])
})
