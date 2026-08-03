/* @hyperspace {"theme":"challenges-and-belt-bar","L":"curriculum-mid","F":"defense-panic","B":"cross-feature"} @invariant "One caught exchange separates evidence from outcome: grading the panic card fires escape_odds_pumped which mints the frame-job coin yet leaves blue.escape-three at zero, and the subsequent escape advances the counter by one without minting any second coin." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { curriculumMid } from "./personas"

/**
 * EVIDENCE ≠ OUTCOME — one caught exchange feeds two reward channels that must not
 * cross. Source seams (verified at authoring):
 *   - challenge-definitions.src.js:344 — coin frame-job: { event: "escape_odds_pumped" }
 *     (pure event-driven mint, no counter, no sourceChallenge).
 *   - challenge-definitions.src.js:272 — blue.escape-three: target 3, { event: "escape" }.
 *   - challenge-engine.src.js:142 — ngRewardChanges `if (nextCoins[id]) continue` is the
 *     mint-once idempotence: a second escape_odds_pumped can never re-mint or re-stamp.
 *   - app.src.jsx ~4444 — the [data-panic-got] grade fires
 *     fx("escape_odds_pumped", { deck_key }).
 * So grading the panic drill (evidence: you studied the defense) mints frame-job
 * IMMEDIATELY while the escape counter stays at zero, and the actual escape (outcome:
 * you got out) advances the counter WITHOUT minting anything — Houdini
 * (sourceChallenge blue.escape-three) cannot confound below three escapes.
 *
 * Persona premise: curriculumMid + the DSL's default tutorial-complete sync completes
 * white.* compatibility objectives ONLY — it never touches blue.* or any coin, so
 * blue.escape-three starts {progress:0, done:false} and coins["frame-job"] is unset
 * (both asserted as the baseline).
 *
 * Determinism census (probe CONFIRMED 2/2 green, ~9s): land() rigs
 * ai-skill/role/max-moves. Per catch: resolve[.99] (our move always fails),
 * outcome[.99,.99] (fail draw + counter-branch drawOutcome share the tag),
 * opp-finish[.01] (opponent always hunts the finish), opp-sub-pick/opp-pick[.01].
 * Escape: escape[.01] < the 0.08 escapeChance floor → always lands; pickFirstEscape()
 * is the canvas-only escape surface (no DOM selector exists). rig() APPENDS, so the
 * retry arm's re-queues are safe.
 *
 * Rig/wait discipline: beats accumulate since boot, so the repeat arc NEVER uses
 * presence waits — "caught" and "escape" are waited on as COUNTS (pumpUntilCount;
 * escape resolution is async inside startTravel and needs pumping), and every coin
 * assertion filters coin_earned by id === "frame-job". Structure-only assertions:
 * beats, counts, challenge ids, coin timestamps — never card/answer text.
 */

test("catch → panic grade mints frame-job with escape count at zero; the escape then counts without a second mint — twice over", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/", { initialState: curriculumMid() })
  await j.land("Mount Top")

  // ── beat-count instrumentation: the stream is boot-cumulative, so everything is COUNTS ──
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
  const ledger = () =>
    page.evaluate(() => {
      const a = (window as any).__neural
      return {
        blue: a.challengeProgress("blue.escape-three"),
        frameJob: (a.coins && a.coins["frame-job"]) || null,
      }
    })

  // ── baseline: the compatibility sync completed white.* only — blue counter and coin clean ──
  const base = await ledger()
  expect(base.blue, "blue.escape-three starts at zero, not done").toMatchObject({ progress: 0, done: false })
  expect(base.frameJob, "no frame-job coin before any panic grade").toBeNull()
  expect(await beatCount("coin_earned", "frame-job"), "no frame-job mint beat at boot").toBe(0)
  expect(await beatCount("escape_odds_pumped"), "no pump beat at boot").toBe(0)

  // ── one catch: fail a transition into the opponent's finish (retry arm covers the
  //    counter branch — the rigged draws land the catch first try in practice) ──
  const getCaught = async (nth: number) => {
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
        if ((await beatCount("caught")) >= nth) {
          caught = true
          break
        }
        const dealt = await beatCount("options_dealt")
        const n = await page.evaluate(() => (((window as any).__neural || {}).optionIdxs || []).length)
        if (dealt > dealt0 && n > 0) break // counter branch: fresh hand, go around
      }
    }
    expect(caught, `catch #${nth} landed within the 4-move budget`).toBe(true)
  }
  const gradePanic = async () => {
    await expect(page.locator("[data-panic-reveal]"), "panic drill up while caught").toBeVisible()
    await page.locator("[data-panic-reveal]").click()
    await page.locator("[data-panic-got]").click()
  }
  const escapeOut = async (nth: number) => {
    await j.rig("escape", [0.01]) // < the 0.08 escapeChance floor — always lands
    await page.evaluate(() => (window as any).__neural.pickFirstEscape()) // canvas-only surface
    await pumpUntilCount("escape", nth, 16000)
  }

  // ── EXCHANGE 1: evidence mints, outcome counts — and never the other way around ──
  await getCaught(1)
  await gradePanic()
  const afterGrade1 = await ledger()
  expect(await beatCount("escape_odds_pumped"), "grade #1 → exactly one pump beat").toBe(1)
  expect(await beatCount("coin_earned", "frame-job"), "the pump minted frame-job — exactly once").toBe(1)
  expect(afterGrade1.frameJob, "coins['frame-job'] stamped by the grade").toBeTruthy()
  expect(afterGrade1.blue, "the counter ignores evidence: still zero, not done").toMatchObject({ progress: 0, done: false })
  const mintStamp = afterGrade1.frameJob.t
  expect(typeof mintStamp, "mint carries a timestamp").toBe("number")

  await escapeOut(1)
  const afterEscape1 = await ledger()
  expect(afterEscape1.blue.progress, "escape #1 advanced blue.escape-three by exactly one").toBe(1)
  expect(afterEscape1.blue.done, "target 3 — not done at one").toBe(false)
  expect(await beatCount("coin_earned", "frame-job"), "the escape minted nothing new").toBe(1)

  // ── EXCHANGE 2: the second pump is silent (mint-once), the second escape just counts ──
  await j.nextHand(30000) // escape → relief → enterLand deals the next hand
  await getCaught(2)
  await gradePanic()
  const afterGrade2 = await ledger()
  expect(await beatCount("escape_odds_pumped"), "grade #2 → second pump beat").toBe(2)
  expect(await beatCount("coin_earned", "frame-job"), "no re-mint: `if (nextCoins[id]) continue`").toBe(1)
  expect(afterGrade2.frameJob.t, "coin not re-stamped by the second pump").toBe(mintStamp)
  expect(afterGrade2.blue.progress, "counter untouched by grade #2").toBe(1)

  await escapeOut(2)
  const afterEscape2 = await ledger()
  expect(afterEscape2.blue.progress, "escape #2 → progress two").toBe(2)
  expect(afterEscape2.blue.done, "still short of three — not done").toBe(false)
  expect(afterEscape2.frameJob.t, "coin stamp survives the whole arc unchanged").toBe(mintStamp)

  // ── SETTLE: nothing re-fires — two pumps, one mint, two escapes, total ──
  await j.advance(2000)
  expect(await beatCount("escape"), "exactly two escape beats total").toBe(2)
  expect(await beatCount("escape_odds_pumped"), "exactly two pump beats total").toBe(2)
  expect(await beatCount("coin_earned", "frame-job"), "still exactly ONE frame-job mint").toBe(1)
})
