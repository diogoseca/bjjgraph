/* @hyperspace {"theme":"challenges-and-belt-bar","L":"white-capstone-holder","F":"opponent-turns","B":"economy-math"} @invariant "Each escape beat advances blue.escape-three by exactly one and the Houdini coin mints only at the third escape — coin_earned count is 0 after escapes one and two and exactly 1 after the third." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { whiteBeltHolder } from "./personas"

/**
 * THE HOUDINI COIN MINTS AT EXACTLY THREE — challenge economy math at its threshold.
 * Source seams (verified at authoring):
 *   - challenge-definitions.src.js:272 — blue.escape-three: target 3, { event: "escape" }.
 *   - challenge-definitions.src.js:342 — coin houdini: sourceChallenge "blue.escape-three".
 *   - challenge-engine.src.js ngAdvanceChallenges — +1 per matching beat, Math.min(target),
 *     `completed` fires once on the done flip; ngRewardChanges `if (nextCoins[id]) continue`
 *     is the mint-once idempotence this spec pins at the boundary.
 *   - app.src.jsx fx() (:129-143) → noteChallenges SYNCHRONOUSLY per beat, so challenge
 *     state and coin mints are readable the moment the escape beat exists; the escape beat
 *     itself is emitted at :5273.
 * So three real escapes must read progress 1 → 2 → 3/done, with ZERO houdini coin_earned
 * beats after escapes one and two, EXACTLY one after the third, and exactly one
 * challenge_completed{id:"blue.escape-three"} total. brown.escape-ten (target 10) rides
 * the SAME escape beats +1 each in parallel and must sit at 3/not-done — one beat, one
 * increment per counter, no cross-feed.
 *
 * Persona premise: whiteBeltHolder + the DSL's default tutorial-complete
 * (_syncWhiteChallengeCompatibility) marks the white escape objective done at boot, so
 * escape one emits no white-track challenge_completed noise — the blue counter starts
 * clean at {progress:0, done:false} (asserted as the baseline).
 *
 * Determinism census (probe CONFIRMED 2/2 green, ~10.5s): land() rigs
 * ai-skill/role/max-moves (max-moves 0.5 → maxMoves 11; the 3-escape arc costs ~6
 * moveCount increments — no endRound("reset") risk). Per catch: resolve[.99] (move always
 * fails), outcome[.99,.99] (fail draw + the counter-branch drawOutcome share the tag),
 * opp-finish[.01] (opponent always hunts the finish — no belt test, so the sub pool is
 * UNRESTRICTED per opponentDefend :5299-5324 and the catch lands first try; the ≤4-move
 * retry arm is contingency for the counter branch), opp-sub-pick/opp-pick[.01]. Escape:
 * escape[.01] < the 0.08 escapeChance floor (:4380) → always lands; pickFirstEscape()
 * (:4396) is the canvas-only escape surface (no DOM selector exists). rig() APPENDS, so
 * re-queueing identical values on a retry is safe.
 *
 * CRITICAL rig/wait discipline: advanceUntil() is boot-CUMULATIVE (returns the moment a
 * beat EXISTS), so cycles 2-3 wait on beat COUNTS — a pumpUntilCount helper — and every
 * assertion filters beats by (beat === "coin_earned" && id === "houdini"), never presence.
 * Structure-only assertions: beats, counts, challenge ids, coin state — never card text.
 */

test("three rigged catch→escape cycles: blue.escape-three counts 1→2→done and the Houdini coin mints exactly once, at the third escape", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/", { initialState: whiteBeltHolder() })
  await j.land("Mount Top")

  // ── beat-count instrumentation: boot-cumulative stream, so everything is COUNTS ──
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

  // ── baseline: the blue counter starts untouched (white escape objective is already
  //    compatibility-done at boot, so no white-track noise can shadow the blue flip) ──
  const base = await page.evaluate(() => {
    const a = (window as any).__neural
    return {
      blue: a.challengeProgress("blue.escape-three"),
      houdiniCoin: !!(a.coins && a.coins.houdini),
    }
  })
  expect(base.blue, "blue.escape-three starts at zero, not done").toMatchObject({ progress: 0, done: false })
  expect(base.houdiniCoin, "no Houdini coin before any escape").toBe(false)

  // ── one catch: fail a transition into the opponent's finish (retry arm for the
  //    counter branch — probe: never fired, catch landed first try every cycle) ──
  const getCaught = async () => {
    const caught0 = await beatCount("caught")
    let caught = false
    for (let m = 0; m < 4 && !caught; m++) {
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
    expect(caught, "the rigged catch landed within the 4-move budget").toBe(true)
  }

  // ── THE ARC: three catch→escape cycles, the ledger read at every escape ──
  for (let cycle = 1; cycle <= 3; cycle++) {
    await getCaught()
    await j.rig("escape", [0.01]) // < the 0.08 escapeChance floor — always succeeds
    await page.evaluate(() => (window as any).__neural.pickFirstEscape()) // canvas-only surface
    await pumpUntilCount("escape", cycle, 16000)

    const s = await page.evaluate(() => {
      const a = (window as any).__neural
      return {
        blue: a.challengeProgress("blue.escape-three"),
        brown: a.challengeProgress("brown.escape-ten"),
        houdiniCoin: !!(a.coins && a.coins.houdini),
      }
    })
    const mints = await beatCount("coin_earned", "houdini")
    const flips = await beatCount("challenge_completed", "blue.escape-three")

    expect(s.blue.progress, `escape ${cycle} advanced blue.escape-three by exactly one`).toBe(cycle)
    expect(s.blue.done, `blue.escape-three done flag at escape ${cycle}`).toBe(cycle === 3)
    expect(mints, `houdini coin_earned count after escape ${cycle}`).toBe(cycle === 3 ? 1 : 0)
    expect(flips, `blue.escape-three challenge_completed count after escape ${cycle}`).toBe(cycle === 3 ? 1 : 0)
    expect(s.houdiniCoin, `coins.houdini state flips only at escape ${cycle === 3 ? "three" : cycle}`).toBe(cycle === 3)
    // economy math: the SAME escape beat feeds brown.escape-ten +1 — parallel, silent, never done at 3
    expect(s.brown.progress, `brown.escape-ten rode the same beats to ${cycle}`).toBe(cycle)
    expect(s.brown.done, "brown.escape-ten (target 10) never completes here").toBe(false)

    if (cycle < 3) await j.nextHand(30000) // escape → relief → enterLand deals the next hand
  }

  // ── SETTLE: idempotence — nothing re-fires, no double-mint, exactly three escapes ──
  await j.advance(3000)
  expect(await beatCount("escape"), "exactly three escape beats total").toBe(3)
  expect(await beatCount("coin_earned", "houdini"), "still exactly ONE Houdini mint after settling").toBe(1)
  expect(
    await beatCount("challenge_completed", "blue.escape-three"),
    "still exactly ONE blue.escape-three completion after settling",
  ).toBe(1)
})
