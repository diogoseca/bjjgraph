/* @hyperspace {"theme":"onboarding","L":"first-roll-day1","F":"victory-defeat","B":"cross-feature"} @invariant "A newcomer's first rigged submission win produces the full celebration and their first ladder rung: finish then roll_end outcome 'win', a victory_cascade with durMs<=1500 and ladder_up (+1 rank) from baseline rank 1, and no belt_test_won compatibility beat fires (a normal-roll win is not a content capstone)." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { firstRollDay1 } from "./personas"

/**
 * NEWCOMER FIRST-WIN CASCADE + FIRST LADDER RUNG — the day-1 onboarding celebration cut.
 *
 * A brand-new player (firstRollDay1: two cards graded in lesson 1, nothing proven, no ladder
 * store) takes their very first roll from Mount Top and wins it by a rigged submission. The
 * claim braids three features on the generic win path: the WIN outcome, the victory CASCADE
 * (bounded animation), and the FIRST LADDER RUNG — while capstone progress stays inert, because
 * a plain roll is not a content capstone.
 *
 * Structural grounding (neural/src/app.src.jsx, source-verified at authoring):
 *   - endRound(kind, name) guards its internal capstone block by `if (this._beltTest)`.
 *     A plain land("Mount Top") roll has _beltTest === null, so belt_test_won never fires and
 *     never completes a content capstone on this win.
 *   - `if (kind === "win")` @3805: builds the cascade from `rows = rollLog.slice(-13)`,
 *     `hops = Math.max(1, rows.length)` @3806-3807, then `fx("victory_cascade",{hops,durMs:
 *     hops*110})` @3810 and `ladderMove(1)` @3811. Because rows is a slice(-13), hops <= 13, so
 *     durMs = hops*110 <= 1430 — structurally under the 1.5s cap for ANY roll length. The assert
 *     is a RANGE check (<=1500), never a literal ==110, so it holds regardless of trail length.
 *   - finish @3816 then roll_end{outcome:"win"} @3817 close the round, in that order.
 *   - ladderState() @4121 defaults rank to 1 when "bjj-neural-ladder" is absent and never writes
 *     on read; ladderMove(1) @4130 emits ladder_up{rank:next,capped:next===st.rank} and persists
 *     {rank:next}. From baseline rank 1 → ladder_up{rank:2,capped:false}, store == {"rank":2}.
 *   - A submission finish reaches endRound("win") via the ty short-circuit in enterSuccess @4502
 *     / enterSuccessCal @4530 (`if (act.ty === "submissions") { ...; endRound("win", act.t) }`),
 *     so the win arrives on the generic path with _beltTest still null.
 *
 * DEDUP (distinct but adjacent — cited per house rails):
 *   - endgame-victory-cannot-double-award-capstone.spec.ts: SAME win mechanism, but persona
 *     multiBeltEndgame at the rank CEILING, asserting B=idempotence (belts.won frozen at 5). It
 *     never asserts the cascade's durMs bound nor a rank CLIMB from baseline 1.
 *   - returner-ladder-independent-of-blob.spec.ts: lapsedReturner, B=persistence-reload — asserts
 *     the rank-2 state SURVIVES a preserveStorage reload via its own store; it never asserts the
 *   durMs<=1500 cascade bound nor the capstone-inertness of the win.
 *   Unique claim here: firstRollDay1 at baseline rank 1 — the NEWCOMER first-win cut — asserting a
 *   bounded victory_cascade AND the first rung climb, with the capstone block provably inert.
 *
 * Assertions are STRUCTURAL only — beat presence/order, numeric props, rank/store shape. No card,
 * option, or answer TEXT is read (the dealt submission is discovered by `ty`, never named; MC
 * waves rewrite copy). Every draw is rigged; sim time is pumped, never wall-clock slept.
 */

const POSITION = "Mount Top" // a valid positions node land() can rig-start on; deals a submission in hand 1

test("newcomer first win: finish→roll_end 'win', bounded victory_cascade + first ladder rung, no capstone award", async ({ page }) => {
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))

  const j = journey(page)

  // ── Boot the day-1 newcomer and land the first roll at Mount Top ──
  await j.boot("/", { initialState: firstRollDay1() })
  await j.land(POSITION)
  if (await page.locator("[data-tut-hide]").count()) await page.locator("[data-tut-hide]").click()

  // ── BASELINE: fresh ladder — rank 1 (default, store absent) and no capstone staged. ──
  const baseline = await page.evaluate(() => {
    const a = (window as any).__neural
    return {
      rank: a.ladderState().rank,
      ladderStore: localStorage.getItem("bjj-neural-ladder"),
      staged: !!a._beltTest,
    }
  })
  expect(baseline.rank, "newcomer starts at baseline ladder rank 1").toBe(1)
  expect(baseline.ladderStore, "no bjj-neural-ladder store yet — rank 1 is the default, not a write").toBeNull()
  expect(baseline.staged, "a plain land() roll stages no content capstone — _beltTest is null").toBe(false)
  const r0 = baseline.rank

  // ── Pre-roll census: no capstone-award beats have fired (the persona doesn't replay any) ──
  const preBeats = await j.beats()
  expect(preBeats.filter((b) => b.beat === "belt_test_won").length, "no belt_test_won before the roll").toBe(0)

  // ── Discover the dealt submission by ty (never by name — content text is off-limits) ──
  const sub = await page.evaluate(() => {
    const a = (window as any).__neural
    const subs = (a.optionIdxs || [])
      .map((o: any) => a.nodes[typeof o === "number" ? o : o.idx])
      .filter((n: any) => n && n.ty === "submissions")
    return subs.length ? subs[0].t : null
  })
  expect(sub, "a submission option is dealt in the first hand from Mount Top").toBeTruthy()

  // ── Win it by rigged submission. resolve < moveChance ⇒ the sweep verdict is success; outcome
  //    is the drawOutcome success pick. Both rigged low as armor (queues are consumed per pick);
  //    a submission win short-circuits before outcome matters, but rigging it keeps the take
  //    deterministic under curriculum reshuffles. ──
  await j.rig("resolve", [0.01])
  await j.rig("outcome", [0.01])
  await j.pick(sub as string)
  await j.advance(8000)

  // ── CELEBRATION: finish then roll_end record the win (order asserted below) ──
  await j.expectBeat("finish")
  expect(await j.lastOutcome(), "the durable roll_end beat records a WIN").toBe("win")

  // ── THE INVARIANT: bounded cascade + first rung climb, capstone block inert. Read the beat stream
  //    once and assert on the LAST instance of each beat. ──
  const roll = await page.evaluate(() => {
    const a = (window as any).__neural
    const beats: any[] = a.beats || []
    const last = (name: string) => {
      for (let i = beats.length - 1; i >= 0; i--) if (beats[i].beat === name) return beats[i]
      return null
    }
    const order = beats.map((b) => b.beat)
    return {
      cascade: last("victory_cascade"),
      cascadeCount: beats.filter((b) => b.beat === "victory_cascade").length,
      ladderUp: last("ladder_up"),
      ladderUpCount: beats.filter((b) => b.beat === "ladder_up").length,
      wonCount: beats.filter((b) => b.beat === "belt_test_won").length,
      liveRank: a.ladderState().rank,
      ladderStore: localStorage.getItem("bjj-neural-ladder"),
      staged: !!a._beltTest,
      // beat ORDER: cascade fires before ladder_up before finish before roll_end (source @3810-3817)
      iCascade: order.lastIndexOf("victory_cascade"),
      iLadder: order.lastIndexOf("ladder_up"),
      iFinish: order.lastIndexOf("finish"),
      iRollEnd: order.lastIndexOf("roll_end"),
    }
  })

  // victory_cascade fired exactly once, with a durMs bounded under the 1.5s cap (range, not ==110)
  expect(roll.cascadeCount, "exactly one victory_cascade fired for the single win").toBe(1)
  expect(roll.cascade, "victory_cascade beat is present").toBeTruthy()
  expect(roll.cascade.durMs, "cascade durMs is under the 1.5s hard cap (hops*110, hops<=13)").toBeLessThanOrEqual(1500)
  expect(roll.cascade.durMs, "cascade durMs is a positive animation length").toBeGreaterThan(0)

  // ladder_up fired once and advanced exactly one rung from baseline — the first rung climb
  expect(roll.ladderUpCount, "exactly one ladder_up fired for the single win").toBe(1)
  expect(roll.ladderUp.rank, "ladder_up climbs to r0+1 — the first rung").toBe(r0 + 1)
  expect(roll.ladderUp.capped, "the climb was not capped — a newcomer has headroom above rank 1").toBe(false)
  expect(roll.liveRank, "live ladder rank is r0+1 after the win").toBe(r0 + 1)
  expect(roll.ladderStore, "ladder store persisted the new rung exactly").toBe(JSON.stringify({ rank: r0 + 1 }))

  // capstone block INERT: a normal-roll win is not a capstone award
  expect(roll.wonCount, "no belt_test_won on a normal-roll win — the capstone block is gated out").toBe(0)
  expect(roll.staged, "_beltTest still null after the win — the capstone block never ran").toBe(false)

  // beat ORDER on the win path: victory_cascade → ladder_up → finish → roll_end (source @3810-3817)
  expect(roll.iCascade, "victory_cascade precedes ladder_up").toBeLessThan(roll.iLadder)
  expect(roll.iLadder, "ladder_up precedes finish").toBeLessThan(roll.iFinish)
  expect(roll.iFinish, "finish precedes roll_end").toBeLessThan(roll.iRollEnd)

  // crash guard: the whole first-win arc ran clean
  expect(errors, "zero pageerror across the newcomer first-win arc").toEqual([])
})
