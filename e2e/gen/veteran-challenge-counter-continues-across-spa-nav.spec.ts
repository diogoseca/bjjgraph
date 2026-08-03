/* @hyperspace {"theme":"challenges-and-belt-bar","L":"srs-veteran","F":"spa-nav","B":"idempotence"} @invariant "A mid-track event counter survives a Quartz soft navigation at its exact durable value and completes from there — escape-three at 2/3 reads 2 on the remounted instance and the third escape completes it with exactly one challenge_completed, no reset and no double-count." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { srsVeteran } from "./personas"

/**
 * A MID-TRACK COUNTER RIDES THE SOFT NAV — idempotence of durable challenge progress across
 * app lives. An SRS veteran escapes two submissions (blue.escape-three at 2/3), Quartz
 * soft-navigates to /Game-Over and back (two full app remounts), and the counter must read
 * EXACTLY {progress:2, done:false, t:T1} from storage in both remounted lives — no reset, no
 * phantom increment. The third escape, thrown in life 3, completes it from there: exactly ONE
 * challenge_completed{id, progress:3, target:3}, the Houdini coin mints exactly once, and a
 * 4th engine-level escape beat afterwards changes nothing (Math.min cap + done short-circuit).
 *
 * Source seams (verified at authoring):
 *   - challenge-engine.src.js:26 ngAdvanceChallenges — +1 per matching beat, Math.min(target);
 *     :46 `t: done && !before.done ? now : before.t || now` — t is stamped at FIRST progress
 *     then HELD (escape 2 keeps T1), and re-stamped ONCE at completion (T2). So "t set once"
 *     holds as completion-stamp-once; the mid-track value that must survive the nav is the
 *     first-stamp T1.
 *   - challenge-definitions.src.js:272 blue.escape-three target 3 {event:"escape"}; :342 coin
 *     houdini sourceChallenge blue.escape-three (ngRewardChanges mint-once).
 *   - app.src.jsx:129 fx() → noteChallenges synchronously per beat; :1199 _saveProgress is
 *     SYNCHRONOUS in test mode — the localStorage blob is durable the moment the escape beat
 *     exists, no flush dance needed before the nav.
 *
 * Persona premise: srsVeteran + the DSL's default tutorial-complete boot pre-completes the
 * white escape compatibility objective (persisted on the first fx beat), so our escapes fire
 * no white-track challenge_completed noise in ANY life — every completion assertion filters
 * by id regardless.
 *
 * CANONICAL SLUG PITFALL (shared by every spa-nav spec): the nav target MUST be "/Game-Over"
 * — CAPITAL G-O, the real built page Quartz soft-navigates into. Lowercase "/game-over" is a
 * redirect stub whose <meta refresh> HARD-navigates: fresh window → init script wipes storage
 * → a false "counter reset" failure. The window.__probeOldRef sameDoc guard catches any
 * regression back to the hard path; __probeLife markers distinguish the three app lives.
 *
 * Determinism census (probe CONFIRMED 2/2 green, 13.9s/13.7s, identical play trail): land()
 * rigs ai-skill/role/max-moves. Per catch: resolve[.99] (move always fails), outcome[.99,.99]
 * (fail draw + counter-branch drawOutcome share the tag), opp-finish[.01] (opponent always
 * hunts the finish), opp-sub-pick/opp-pick[.01]. Escape: escape[.01] < the 0.08 escapeChance
 * floor; pickFirstEscape() is the documented canvas-only escape rail. Probe: the catch landed
 * on hand 0 every arc (Mount Top and the post-escape position both offer adjacent finishes);
 * the 6-hand retry arm never fired. Beat waits are COUNT-based (advanceUntil is unsafe here —
 * caught/escape beats repeat within one life). Structure-only assertions: beats, counts,
 * challenge ids, blob fields — never card text.
 *
 * Nearest neighbors, differentiated: lapsed-returner-spa-nav-preserves-career (career blob
 * survives, nothing mid-track); holder-escape-three-mints-houdini-at-exact-threshold
 * (threshold economy in ONE life, no nav); this spec pins the MID-TRACK counter value across
 * remounts and completion-from-there.
 */

const CHALLENGE = "blue.escape-three"

test("escape-three at 2/3 rides two soft navs at its exact durable value, completes on the third escape, and a 4th beat changes nothing", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))

  const j = journey(page)
  await j.boot("/", { initialState: srsVeteran() })
  await j.land("Mount Top")

  // ── COUNT-based instrumentation: beat streams are life-local (each remount starts empty),
  // and caught/escape repeat within a life — so everything is counts, never presence ──
  const beatCount = (name: string, id?: string) =>
    page.evaluate(
      ([n, i]) =>
        (((window as any).__neural || {}).beats || []).filter(
          (b: any) => b.beat === n && (i === null || b.id === i),
        ).length,
      [name, id ?? null] as const,
    )
  const pumpUntilCount = async (name: string, count: number, capMs: number) => {
    let spent = 0
    while (spent < capMs) {
      await j.advance(400)
      spent += 400
      if ((await beatCount(name)) >= count) return
    }
    throw new Error(`beat "${name}" never reached count ${count} within ${capMs}ms of sim time`)
  }
  // the two truths that must agree: the live engine read AND the durable localStorage blob
  const readState = () =>
    page.evaluate((id) => {
      const a = (window as any).__neural
      const blob = JSON.parse(localStorage.getItem("bjj-neural-progress") || "{}")
      return {
        live: a.challengeProgress(id),
        stored: (blob.challenges || {})[id] ?? null,
      }
    }, CHALLENGE)

  // ── one rigged catch: our move always fails, the opponent always finishes. Retry arm
  // covers the counter branch (probe: never fired — caught landed on hand 0 every arc) ──
  const getCaught = async () => {
    const caught0 = await beatCount("caught")
    let caught = false
    for (let m = 0; m < 6 && !caught; m++) {
      await j.rig("resolve", [0.99])
      await j.rig("outcome", [0.99, 0.99]) // fail draw + counter-branch drawOutcome share the tag
      await j.rig("opp-finish", [0.01])
      await j.rig("opp-sub-pick", [0.01])
      await j.rig("opp-pick", [0.01])
      const t = await page.evaluate(() => {
        const a = (window as any).__neural
        for (const o of a.optionIdxs || []) {
          const idx = typeof o === "number" ? o : o.idx
          if (a.nodes[idx] && a.nodes[idx].ty === "transitions") return a.nodes[idx].t
        }
        return null
      })
      expect(t, "a transition option in the tray to fail into the opponent's turn").toBeTruthy()
      const dealt0 = await beatCount("options_dealt")
      await j.pick(t as string)
      let spent = 0
      while (spent < 25000) {
        await j.advance(400)
        spent += 400
        if ((await beatCount("caught")) > caught0) {
          caught = true
          break
        }
        const dealt = await beatCount("options_dealt")
        const n = await page.evaluate(() => (((window as any).__neural || {}).optionIdxs || []).length)
        if (dealt > dealt0 && n > 0) break // counter branch: fresh hand, go around
      }
    }
    expect(caught, "the rigged catch landed within the 6-hand budget").toBe(true)
  }
  // one full catch→escape arc; lifeEscapes = the LIFE-LOCAL escape count to wait for
  const escapeOnce = async (lifeEscapes: number) => {
    await getCaught()
    await j.rig("escape", [0.01]) // < the 0.08 escapeChance floor — always lands
    await page.evaluate(() => (window as any).__neural.pickFirstEscape()) // canvas-only rail
    await pumpUntilCount("escape", lifeEscapes, 16000)
  }

  // ── baseline: the counter starts untouched (white escape objective is compatibility-done
  // at boot, so no white-track noise shadows anything) ──
  const base = await readState()
  expect(base.live, "blue.escape-three starts at zero, not done").toMatchObject({ progress: 0, done: false })

  // ── LIFE 1: two escapes → mid-track 2/3. t is first-stamped at escape ONE and held. ──
  await escapeOnce(1)
  const at1 = await readState()
  expect(at1.live, "escape one advanced the counter to 1").toMatchObject({ progress: 1, done: false })
  const T1: number = at1.live.t
  expect(T1, "t first-stamped at the first progress (engine :46)").toBeGreaterThan(0)
  await j.nextHand(30000) // escape → relief → enterLand deals the next hand

  await escapeOnce(2)
  await j.nextHand(30000)
  const at2 = await readState()
  expect(at2.live, "mid-track truth: live engine reads 2/3 with t HELD at the first stamp").toEqual({
    progress: 2,
    done: false,
    t: T1,
  })
  expect(at2.stored, "mid-track truth: the durable blob entry is identical (test-mode save is synchronous)").toEqual({
    progress: 2,
    done: false,
    t: T1,
  })
  expect(await beatCount("challenge_completed", CHALLENGE), "no completion flip mid-track").toBe(0)
  expect(await beatCount("coin_earned", "houdini"), "no Houdini mint mid-track").toBe(0)

  // ── mark life 1 + stash the corpse handle (a window global survives only a SOFT nav) ──
  const life1 = await page.evaluate(() => {
    const a = (window as any).__neural
    a.__probeLife = 1
    ;(window as any).__probeOldRef = a
    return { beats: (a.beats || []).length }
  })
  expect(life1.beats, "life 1 accumulated beats (non-vacuity guard for empty-after-nav)").toBeGreaterThan(0)

  // ── SOFT NAV 1: CANONICAL slug — capital Game-Over (lowercase = hard-redirect stub that
  // wipes storage; see the pitfall note). The remount must be a genuinely fresh life. ──
  const freshReady = () => {
    const a = (window as any).__neural
    return !!(
      a &&
      !a.__probeLife && // the fresh life, not a marked corpse
      a.nodes &&
      a.nodes.length &&
      typeof a.advance === "function" &&
      a.flashcards &&
      a.flashcards.decks
    )
  }
  await page.evaluate(() => (window as any).spaNavigate(new URL("/Game-Over", location.origin)))
  await page.waitForFunction(freshReady, undefined, { timeout: 90_000 })

  const life2 = await page.evaluate((id) => {
    const a = (window as any).__neural
    const old = (window as any).__probeOldRef
    const blob = JSON.parse(localStorage.getItem("bjj-neural-progress") || "{}")
    const out = {
      sameDoc: !!old, // the alias-stub HARD nav would have wiped this window global
      sameRef: a === old,
      beats: (a.beats || []).length,
      roots: document.querySelectorAll("#neural-root").length,
      live: a.challengeProgress(id),
      stored: (blob.challenges || {})[id] ?? null,
    }
    a.__probeLife = 2 // marked AFTER the read so freshReady can spot life 3
    return out
  }, CHALLENGE)
  expect(life2.sameDoc, "nav 1 stayed same-document (canonical slug)").toBe(true)
  expect(life2.sameRef, "life 2 is a NEW instance, not the recycled life-1 ref").toBe(false)
  expect(life2.beats, "life 2's beat stream starts EMPTY (app rebuilt, not resumed)").toBe(0)
  expect(life2.roots, "exactly one #neural-root in life 2").toBe(1)
  expect(life2.live, "life 2 re-ingested the counter at its EXACT durable value").toEqual({
    progress: 2,
    done: false,
    t: T1,
  })
  expect(life2.stored, "the blob entry is untouched by the remount").toEqual({ progress: 2, done: false, t: T1 })

  // ── SOFT NAV 2: back home — the second remount must read the same exact value ──
  await page.evaluate(() => (window as any).spaNavigate(new URL("/", location.origin)))
  await page.waitForFunction(freshReady, undefined, { timeout: 90_000 })

  const life3 = await page.evaluate((id) => {
    const a = (window as any).__neural
    const blob = JSON.parse(localStorage.getItem("bjj-neural-progress") || "{}")
    return {
      sameDoc: !!(window as any).__probeOldRef,
      beats: (a.beats || []).length,
      roots: document.querySelectorAll("#neural-root").length,
      live: a.challengeProgress(id),
      stored: (blob.challenges || {})[id] ?? null,
    }
  }, CHALLENGE)
  expect(life3.sameDoc, "nav 2 stayed same-document too").toBe(true)
  expect(life3.beats, "life 3's beat stream starts EMPTY").toBe(0)
  expect(life3.roots, "exactly one #neural-root in life 3").toBe(1)
  expect(life3.live, "life 3 reads the SAME exact mid-track value — no reset, no double-count").toEqual({
    progress: 2,
    done: false,
    t: T1,
  })
  expect(life3.stored, "blob entry still identical entering life 3").toEqual({ progress: 2, done: false, t: T1 })

  // ── COMPLETION FROM THERE: life 3 lands, throws the third escape, and the counter
  // completes off its navigated-in value — 2 (from storage) + 1 (this life's beat) = done ──
  await j.land("Mount Top")
  await escapeOnce(1) // life-local count: life 3's first escape is the career's third

  const done = await readState()
  const T2: number = done.live.t
  expect(done.live.progress, "the third escape completed the counter at exactly 3").toBe(3)
  expect(done.live.done, "done flipped on the navigated-in counter").toBe(true)
  expect(T2, "t re-stamped ONCE at completion (T2 after T1)").toBeGreaterThan(T1)
  expect(done.stored, "the durable blob carries the completed entry").toEqual({ progress: 3, done: true, t: T2 })

  const flips = await page.evaluate(
    (id) =>
      (((window as any).__neural || {}).beats || []).filter(
        (b: any) => b.beat === "challenge_completed" && b.id === id,
      ),
    CHALLENGE,
  )
  expect(flips.length, "exactly ONE challenge_completed for the counter in life 3's stream").toBe(1)
  expect(flips[0], "the completion beat carries the full-target shape").toMatchObject({
    id: CHALLENGE,
    progress: 3,
    target: 3,
  })
  expect(await beatCount("coin_earned", "houdini"), "the Houdini coin minted exactly once").toBe(1)
  expect(
    await page.evaluate(() => !!(((window as any).__neural || {}).coins || {}).houdini),
    "coins.houdini durable state set",
  ).toBe(true)

  // ── BONUS IDEMPOTENCE: a 4th engine-level escape beat is absorbed — progress capped at
  // target, zero extra completion, zero extra mint, t byte-identical to the completion stamp ──
  await page.evaluate(() => (window as any).__neural.fx("escape", { via: "engine-idempotence-probe" }))
  const after4 = await readState()
  expect(after4.live, "a 4th escape beat leaves the counter capped, done, t unchanged").toEqual({
    progress: 3,
    done: true,
    t: T2,
  })
  expect(after4.stored, "the blob entry is byte-identical to the completion stamp").toEqual({
    progress: 3,
    done: true,
    t: T2,
  })
  expect(await beatCount("challenge_completed", CHALLENGE), "still exactly ONE completion after the 4th beat").toBe(1)
  expect(await beatCount("coin_earned", "houdini"), "still exactly ONE Houdini mint after the 4th beat").toBe(1)

  expect(errors, "zero pageerrors across all three app lives").toEqual([])
})
