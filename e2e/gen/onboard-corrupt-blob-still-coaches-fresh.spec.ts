/* @hyperspace {"theme":"onboarding","L":"legacy-corrupt-blob","F":"intro-roll-coach","B":"error-fallback"} @invariant "When storage is malformed the app falls back to a fresh profile AND treats the user as a first-timer for onboarding: with corrupt bjj-neural-progress the coach flag is absent so the first landing emits coach_1 with a frozen clock — a corrupt blob does not accidentally skip onboarding." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { CORRUPT_BLOB_RAW } from "./personas"

/**
 * CORRUPT BLOB STILL ONBOARDS AS A FIRST-TIMER — the error-fallback path and the onboarding gate
 * live on TWO DIFFERENT localStorage keys, so a malformed progress blob can only produce a fresh
 * profile that is ALSO treated as never-coached. It cannot silently swallow the first-roll coach.
 *
 * This is the onboarding sibling of corrupt-blob-fresh-fallback-boot.spec.ts (which proves the
 * fresh-profile fallback + a live first hand). That spec dismisses the coach (default land); THIS
 * one holds it open (keepCoach) and asserts the onboarding half the fallback spec never touches:
 * absent coach flag ⇒ coach_1 fires ⇒ the decision clock is frozen. Same corrupt-seed recipe, a
 * disjoint claim.
 *
 * Mechanism under test (source-verified, neural/src/app.src.jsx):
 *   - Coach gate reads a SEPARATE key. maybeStartCoach() :4034-4037 early-returns on
 *     (_coach || _coachDone) then reads ONLY localStorage.getItem("bjj-neural-coached"); it never
 *     inspects bjj-neural-progress. The corrupt-blob → _loadProgress try/catch fallback resets
 *     prep/rec to {} and leaves the coach key untouched, so it is null at boot. Absent flag ⇒
 *     _coach=1 + fx("coach_1") :4038-4041.
 *   - enterLand(first) :4303 calls maybeStartCoach() when first===true. rigStart sets
 *     _firstRollDone=true (:4196) BEFORE enterLand, but enterLand is STILL invoked with first=true
 *     on a rigged start (:4213), so coach_1 fires on the corrupt-fresh landing (red herring resolved
 *     — the probe read the beat empirically, did not assume).
 *   - Frozen clock. _tickDecision :4315-4317 early-returns while this._coach is truthy (the guard
 *     precedes `d.remaining -= gdt*1000`), so decisionRemaining() does not drain across advance().
 *   - finishCoach() :4055-4060 is the ONLY writer of bjj-neural-coached="1" (+ coach_done). keepCoach
 *     never calls it, so the flag stays null the whole time the coach is up.
 *
 * SEEDING RECIPE (non-obvious — mirrors corrupt-blob-fresh-fallback-boot.spec.ts). addInitScript
 * runs in REGISTRATION order and dsl.ts registers its storage-wipe lazily on the FIRST boot(). A
 * seed registered before any boot() runs BEFORE the wipe and is cleared. Working order:
 *   (1) boot("/")            — registers the DSL init scripts (wipe + ngseed reader)
 *   (2) addInitScript(seed)  — corrupt PROG + a marker the app never touches; now AFTER the wipe
 *   (3) boot("/") again      — the boot under test: wipe → corrupt seed → construction parses it
 * Non-vacuousness guards: __probe_marker must read "1" post-boot (seed ran after the wipe) and the
 * corrupt PROG string must survive in storage (the key is never removed at boot). The premise guard
 * (CORRUPT_BLOB_RAW does not parse) makes the fallback claim meaningful.
 *
 * Determinism (house rails): no Math.random touched — the coach lifecycle draws no RNG. land() rigs
 * ai-skill/role/max-moves + rigStart (no extra rig queues needed); the journey never picks/drills.
 * Frame time is pumped only via land()'s advances + one explicit advance(3000) to prove the freeze —
 * no wall-clock sleeps. Structure-only assertions (beats, counts, flags), never card/answer TEXT.
 */

test("corrupt bjj-neural-progress: fresh profile is treated as never-coached — coach_1 fires with a frozen clock", async ({
  page,
}) => {
  // premise guard: the fallback claim is only meaningful if the blob is genuinely broken JSON.
  expect(() => JSON.parse(CORRUPT_BLOB_RAW), "persona premise: CORRUPT_BLOB_RAW does not parse").toThrow()

  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))

  const j = journey(page)

  // ── Coach flag must be absent BEFORE the app reads it — captured from the very first init script
  //    on the boot under test, so this is the boot-time value the gate actually saw. ──
  await page.addInitScript(() => {
    try {
      ;(window as any).__coachedAtBoot = localStorage.getItem("bjj-neural-coached")
    } catch {
      ;(window as any).__coachedAtBoot = "ERR"
    }
  })

  // (1) registration boot — makes the DSL's wipe init-script exist so our seed registers AFTER it.
  await j.boot("/")

  // (2) corrupt seed + a marker the app never touches; both run post-wipe on the NEXT boot.
  await page.addInitScript((blob) => {
    localStorage.setItem("bjj-neural-progress", blob)
    localStorage.setItem("__probe_marker", "1")
  }, CORRUPT_BLOB_RAW)

  // (3) the boot under test: wipe → corrupt seed → construction parses the corrupt bytes.
  await j.boot("/")
  // keepCoach: hold the coach card up (land() otherwise dismisses it before we can assert onboarding).
  await j.land("Mount Top", { keepCoach: true })

  // ── (A) SEEDING PROOF — without these the fresh-profile + onboarding reads below are vacuous.
  //    marker survives (seed ran after the wipe) and the corrupt PROG string was in storage when
  //    the app booted (key never removed at boot); non-null stays robust vs a future eager save. ──
  const seed = await page.evaluate(() => ({
    marker: localStorage.getItem("__probe_marker"),
    rawProg: localStorage.getItem("bjj-neural-progress"),
  }))
  expect(seed.marker, "seed init-script ran AFTER the DSL wipe (marker survives the boot under test)").toBe("1")
  expect(seed.rawProg, "corrupt blob was in storage when the app booted (progress key never removed at boot)").not.toBeNull()

  // ── (B) FRESH-PROFILE FALLBACK — corrupt bytes yield a pristine profile, never a partial one:
  //    full graph ingested, prep/rec empty, zero mastery, blob schema v2. ──
  const boot = await page.evaluate(() => {
    const a = (window as any).__neural
    return {
      nodes: a.nodes.length,
      prepKeys: Object.keys(a.prep || {}),
      recKeys: Object.keys(a.rec || {}),
      mastered: a.masteredCount(),
      blobV: a._progressBlob().v,
    }
  })
  expect(boot.nodes, "app ingested the full graph despite the corrupt blob").toBeGreaterThan(1000)
  expect(boot.prepKeys, "prep fell back to a pristine empty map").toEqual([])
  expect(boot.recKeys, "rec fell back to a pristine empty map").toEqual([])
  expect(boot.mastered, "masteredCount() === 0 — no phantom mastery from corrupt bytes").toBe(0)
  expect(boot.blobV, "fresh profile carries the current v2 schema").toBe(2)

  // ── (C) THE COACH FLAG IS A DIFFERENT KEY — null at boot (the value the gate read) AND still
  //    null under the open coach. The corrupt PROG (a different key) never touched it. This is what
  //    proves the fallback did not accidentally skip onboarding. ──
  const flag = await page.evaluate(() => ({
    atBoot: (window as any).__coachedAtBoot ?? null,
    now: localStorage.getItem("bjj-neural-coached"),
  }))
  expect(flag.atBoot, "bjj-neural-coached absent at boot — the gate saw no prior onboarding").toBeNull()
  expect(flag.now, "coach flag STILL null under an open coach (finishCoach never ran)").toBeNull()

  // ── (D) FIRST-TIMER ONBOARDING FIRED — coach_1 + options_dealt beats, _coach open on step 1,
  //    coach_done NOT yet (keepCoach held it). Asserted on structure, never on any label text. ──
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
  expect(coach.coach1, "coach_1 fired on the first landing of the corrupt-fresh profile").toBeGreaterThanOrEqual(1)
  expect(coach.optionsDealt, "the first hand was dealt (land completed)").toBeGreaterThanOrEqual(1)
  expect(coach.coachDone, "coach not finished — keepCoach held it open").toBe(0)
  expect(coach.coachFlag, "coach state machine is open on step 1").toBe(1)
  // parity with the probe's DSL-helper beat reads
  await j.expectBeat("coach_1")
  await j.expectBeat("options_dealt")

  // ── (E) FROZEN CLOCK — _tickDecision early-returns while _coach is truthy, so decisionRemaining()
  //    does not drain across a 3s pump. This is the mechanism, not incidental drift. ──
  const r0 = coach.remaining
  expect(r0, "a decision window exists and has time on the clock under the coach").toBeGreaterThan(0)
  await j.advance(3000)
  const r1 = await page.evaluate(() => (window as any).__neural.decisionRemaining())
  expect(Math.abs(r1 - r0), `clock frozen under the coach: r0=${r0} r1=${r1} (Δ<0.5s)`).toBeLessThan(0.5)

  // crash guard: registration boot + corrupt boot + landing + freeze pump all ran clean.
  expect(errors, "zero pageerror across double-boot, coached landing, and freeze pump").toEqual([])
})
