/* @hyperspace {"theme":"challenges-and-belt-bar","L":"curriculum-mid","F":"victory-defeat","B":"cross-feature"} @invariant "The tap-and-carry-on coin's after-loss sequence is armed only by roll_end{outcome:'lose'} and consumed by the next roll_staged — a win followed by staging mints nothing, a submission loss followed by staging mints exactly one coin and disarms the latch." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { curriculumMid } from "./personas"

/**
 * TAP-AND-CARRY-ON — the after-loss latch: armed only by defeat, consumed by the next staging.
 *
 * A mid-curriculum player wins a roll, stages a new one (nothing mints — a win never arms the
 * sequence), then LOSES by defense expiry (the latch arms, but the loss itself mints nothing),
 * and stages again — EXACTLY one tap-and-carry-on coin mints and the latch disarms. A further
 * staging mints nothing; a second loss re-arms the latch, but the next staging still mints
 * nothing (the coin is mint-once) while STILL consuming the latch.
 *
 * Structural grounding (source-verified at authoring):
 *   - neural/src/challenge-engine.src.js ngRewardChanges @124-130: `roll_end` sets
 *     runtime.afterLoss = (props.outcome === "lose") — a win WRITES false, it doesn't skip the
 *     write; `roll_staged` with afterLoss adds "tap-and-carry-on" to candidates AND clears the
 *     latch unconditionally. Mint-once via `if (nextCoins[id]) continue;` in the candidates loop.
 *   - Wiring: fx() → noteChallenges (app.src.jsx:137) → ngRewardChanges; each newCoins id emits
 *     fx("coin_earned",{id}) @4600; runtime is held in-memory at __neural._challengeRuntime
 *     (:1160 init, :4556 writeback) — the latch is readable but never persisted.
 *   - stageRollAt @4822 fires roll_staged synchronously after rollFromPosition (@4787), which
 *     consumes the max-moves + ai-skill draws (role only when the position name carries no side),
 *     so every staging is preceded by fresh rigs.
 *
 * DEDUP (F=victory-defeat neighbors, cited): onboard-first-win-cascade-and-ladder-climb asserts
 * the WIN path's cascade/ladder — nothing about coins or the after-loss runtime; holder-victory-
 * defeat-blue-progress-untouched-by-loss asserts a loss leaves the CAREER record intact — it
 * never touches the coin latch. veteran-hidden-counters-beat-silent-coin-mints is about hidden
 * challenge counters, not this event-latch coin. Unique claim here: the arm/consume protocol of
 * the ONLY runtime-latched coin, across both arming polarities and the mint-once guard.
 *
 * Assertions are STRUCTURAL only: beat counts filtered by beat name + coin ID (other coin ids
 * may mint incidentally and MC waves rewrite copy — the played option is found by ty or tray
 * position, never by content text). Every draw is rigged; sim time is pumped, never slept.
 * COUNT-BASED pumping throughout: this journey crosses roll_end / caught / roll_staged several
 * times, so dsl advanceUntil() (which matches ANY historical instance) is unusable here.
 */

const COIN = "tap-and-carry-on"

test("tap-and-carry-on: win→stage mints nothing; loss→stage mints exactly one coin and disarms; re-armed latch is consumed but the coin never re-mints", async ({ page }) => {
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))

  const j = journey(page)

  // pump sim time until a beat's TOTAL COUNT reaches n (never "beat exists" — see header note)
  const pumpToCount = async (beat: string, n: number, capMs = 30000, stepMs = 500) => {
    let spent = 0
    while (spent < capMs) {
      await j.advance(stepMs)
      spent += stepMs
      const count = await page.evaluate(
        (name) => ((window as any).__neural.beats || []).filter((b: any) => b.beat === name).length,
        beat,
      )
      if (count >= n) return
    }
    throw new Error(`beat "${beat}" never reached count ${n} within ${capMs}ms of sim time`)
  }

  const beatCount = (beat: string) =>
    page.evaluate(
      (name) => ((window as any).__neural.beats || []).filter((b: any) => b.beat === name).length,
      beat,
    )

  // the invariant's full observable surface in one read: mint beats FILTERED BY COIN ID, the
  // durable coins-map entry, the in-memory latch, and the staging census
  const coinState = () =>
    page.evaluate((id) => {
      const a = (window as any).__neural
      return {
        mints: (a.beats || []).filter((b: any) => b.beat === "coin_earned" && b.id === id).length,
        owned: !!(a.coins || {})[id],
        latch: !!(a._challengeRuntime || {}).afterLoss,
        staged: (a.beats || []).filter((b: any) => b.beat === "roll_staged").length,
      }
    }, COIN)

  // stage a roll at a fixed node via the sanctioned direct call (the canvas has no DOM to
  // click — same route as roam-stage.spec.ts). Fresh rigs precede EVERY staging because
  // rollFromPosition consumes max-moves + ai-skill (+ role as armor).
  const stageAt = async (idx: number) => {
    await j.rig("max-moves", [0.5])
    await j.rig("ai-skill", [0.5])
    await j.rig("role", [0])
    await page.evaluate((i) => (window as any).__neural.stageRollAt(i), idx)
  }

  // rigged defense-expiry LOSS from a STAGED (paused) roll — recipe verbatim from
  // holder-victory-defeat-blue-progress-untouched-by-loss: the staged hand deals while paused
  // (enterLand rides an ignorePause timer), unpause, FAIL the pick (resolve+outcome high),
  // opponent goes for a rigged finish (opp-finish + opp-sub-pick low), then the defense window
  // expires → tapped → endRound("lose"). Baselines are read BEFORE, targets are baseline+1.
  const loseFromStaged = async () => {
    const caught0 = await beatCount("caught")
    const rollEnd0 = await beatCount("roll_end")
    await j.advance(1500) // staged landing arrives + the hand deals while the clock is held
    await page.evaluate(() => (window as any).__neural.setPaused(false))
    const opts = await j.optionTitles()
    expect(opts.length, "a live hand to lose from").toBeGreaterThan(0)
    await j.rig("resolve", [0.99])
    await j.rig("outcome", [0.99])
    await j.rig("opp-finish", [0.01])
    await j.rig("opp-sub-pick", [0.01])
    await j.pick(opts[0])
    await pumpToCount("caught", caught0 + 1)
    await j.advance(12000) // defense window onExpire → tapped → endRound("lose")
    await pumpToCount("roll_end", rollEnd0 + 1)
    expect(await j.lastOutcome(), "the expired defense records a LOSS").toBe("lose")
  }

  // ── Boot mid-curriculum, land the first LIVE roll at Mount Top ──
  await j.boot("/", { initialState: curriculumMid() })
  await j.land("Mount Top")
  const mountIdx: number = await page.evaluate(() => (window as any).__neural.currentPos)

  // ── ROLL #1 — WIN by rigged submission (discovered by ty, never by name) ──
  const sub = await page.evaluate(() => {
    const a = (window as any).__neural
    const subs = (a.optionIdxs || [])
      .map((o: any) => a.nodes[typeof o === "number" ? o : o.idx])
      .filter((n: any) => n && n.ty === "submissions")
    return subs.length ? subs[0].t : null
  })
  expect(sub, "a submission option is dealt in the first hand from Mount Top").toBeTruthy()
  await j.rig("resolve", [0.01])
  await j.rig("outcome", [0.01])
  await j.pick(sub as string)
  await pumpToCount("roll_end", 1)
  expect(await j.lastOutcome(), "roll #1 ends in a WIN").toBe("win")

  let s = await coinState()
  expect(s.latch, "a WIN writes the latch FALSE — the sequence is not armed").toBe(false)
  expect(s.mints, "no tap-and-carry-on mint on the win itself").toBe(0)

  // ── STAGE #1 (after the win): an unarmed latch means staging mints NOTHING ──
  await stageAt(mountIdx)
  s = await coinState()
  expect(s.staged, "roll_staged #1 fired").toBe(1)
  expect(s.mints, "win → stage mints NOTHING — only a loss arms the sequence").toBe(0)
  expect(s.owned, "no durable coins-map entry after win→stage").toBe(false)
  expect(s.latch, "latch still disarmed after stage #1").toBe(false)

  // ── LOSS #1 (from the staged roll): roll_end{outcome:'lose'} ARMS the latch — arm only ──
  await loseFromStaged()
  s = await coinState()
  expect(s.latch, "roll_end{outcome:'lose'} ARMS the after-loss latch").toBe(true)
  expect(s.mints, "the loss itself mints nothing — the mint waits for the next staging").toBe(0)
  expect(s.owned, "coins map still has no tap-and-carry-on right after the loss").toBe(false)

  // ── STAGE #2: the armed latch is consumed — EXACTLY one mint, then disarmed ──
  await stageAt(mountIdx)
  s = await coinState()
  expect(s.staged, "roll_staged #2 fired").toBe(2)
  expect(s.mints, "loss → stage mints EXACTLY one tap-and-carry-on coin_earned").toBe(1)
  expect(s.owned, "the coin landed in the durable coins map").toBe(true)
  expect(s.latch, "the mint CONSUMED the latch — disarmed").toBe(false)

  // ── STAGE #3 immediately after: the latch is one-shot — nothing further mints ──
  await stageAt(mountIdx)
  s = await coinState()
  expect(s.staged, "roll_staged #3 fired").toBe(3)
  expect(s.mints, "a second staging after the same loss mints nothing — one latch, one mint").toBe(1)
  expect(s.latch, "latch stays disarmed across an unarmed staging").toBe(false)

  // ── LOSS #2: arming is PER-LOSS — the latch re-arms even though the coin is owned… ──
  await loseFromStaged()
  s = await coinState()
  expect(s.latch, "a second loss re-arms the latch (arming is per-loss, not once-ever)").toBe(true)
  expect(s.mints, "still exactly one mint before the next staging").toBe(1)

  // ── STAGE #4: …but the coin is MINT-ONCE — the staging consumes the latch, mints nothing ──
  await stageAt(mountIdx)
  s = await coinState()
  expect(s.staged, "roll_staged #4 fired").toBe(4)
  expect(s.mints, "an already-owned coin never re-mints (mint-once guard)").toBe(1)
  expect(s.owned, "the single durable coin entry is intact").toBe(true)
  expect(s.latch, "the staging still consumed the re-armed latch").toBe(false)

  expect(errors, "zero pageerror across the whole win/loss/stage arc").toEqual([])
})
