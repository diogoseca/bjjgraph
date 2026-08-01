/* @hyperspace {"theme":"lifetime-journeys","L":"multi-belt-endgame","F":"victory-defeat","B":"idempotence"} @invariant "A rigged gameplay submission win for a fully-graduated player fires roll_end 'win'/victory_cascade but never re-emits belt_test_won or belt_unlocked and leaves belts.won at exactly 5 entries with unchanged moves/dominance — a normal-roll victory is not a belt award and cannot inflate the belt record." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { multiBeltEndgame, CURRICULUM } from "./personas"

/**
 * ENDGAME VICTORY CANNOT DOUBLE-AWARD A BELT — the gameplay↔belt-record firewall.
 *
 * A player who already holds EVERY belt wins ANOTHER plain roll by rigged submission. The
 * generic victory cascade must fire (this is a real win: rank rides along), yet the belt
 * ledger must be inert — no belt_test_won, no belt_unlocked, and belts.won frozen at its 5
 * seeded entries with their {moves, dominance} untouched. A normal roll is NOT a belt test,
 * so a win on it can never mint or re-stamp a belt.
 *
 * Structural root cause (neural/src/app.src.jsx, source-verified at authoring):
 *   - endRound(kind, name) @3780: the ENTIRE belt block is guarded by `if (this._beltTest)`
 *     @3784. A plain land("Mount Top") roll has _beltTest === null, so the belts.won write
 *     (@3790), belt_test_won fx (@3791) and belt_unlocked fx (@3793) are ALL skipped.
 *   - Only `if (kind === "win")` @3805 runs → victory_cascade (@3810) + ladderMove(1) (@3811)
 *     + finish (@3816) + roll_end{outcome:"win"} (@3817). None of these touch belts.
 *   - A submission finish reaches endRound("win") via the ty short-circuit in enterSuccess
 *     (@4504) / enterSuccessCal (@4530) — `if (act.ty === "submissions") { ...; endRound("win",
 *     act.t); return; }` — so the win arrives on the generic path with _beltTest still null.
 *   - The sweep verdict is a single resolve draw: tensionSweep @4470 `success = rng("resolve")
 *     < moveChance`; 0.01 < any moveChance ⇒ success. `outcome` (drawOutcome's success pick) is
 *     re-rigged before every take as armor — a submission win short-circuits before it matters.
 *
 * This is the mirror of gen "veteran-victory-does-not-mutate-recall-map" (same win mechanism,
 * B: cross-feature/rec map) and the complement of gen "endgame-won-test-is-final" (an inert
 * CLICK on a won row): here the finish is a REAL, resolved gameplay win, and the thing that
 * must NOT move is the belt record.
 *
 * Counts derive from the served curriculum fixture (CURRICULUM.belts) — never the literal 5.
 * No content-text assertions — the dealt/sought submission is discovered by ty, never named.
 */

const BELTS: any[] = CURRICULUM.belts

/** playToTap armor (mirrors journeys/belt-test.spec.ts): take a submission the instant one is
 *  offered; otherwise step through a transition whose destination is adjacent to a submission,
 *  re-rigging success before every pick. Mount Top deals a submission in the first hand today,
 *  so the fallback is defensive against curriculum reshuffles — never the happy path. */
async function playToTap(j: any, page: any, maxMoves = 8): Promise<boolean> {
  for (let m = 0; m < maxMoves; m++) {
    const sub = await page.evaluate(() => {
      const a = (window as any).__neural
      const subs = (a.optionIdxs || [])
        .map((x: any) => a.nodes[typeof x === "number" ? x : x.idx])
        .filter((n: any) => n && n.ty === "submissions")
      return subs.length ? subs[0].t : null
    })
    // resolve < moveChance ⇒ the sweep verdict is success; outcome is the drawOutcome pick.
    // Re-rigged before EVERY take (the queue is consumed per pick).
    await j.rig("resolve", [0.01])
    await j.rig("outcome", [0.01])
    if (sub) {
      await j.pick(sub)
      await j.advanceUntil("roll_end", 25000)
      return true
    }
    const t = await page.evaluate(() => {
      const a = (window as any).__neural
      let fallback: string | null = null
      for (const i of a.optionIdxs || []) {
        const idx = typeof i === "number" ? i : i.idx
        const n = a.nodes[idx]
        if (!n || n.ty !== "transitions") continue
        fallback = fallback || n.t
        const res = a.resultPos(idx, a.currentPos)
        if (res >= 0 && (a.adj[res] || []).some((k: number) => a.nodes[k]?.ty === "submissions")) return n.t
      }
      return fallback
    })
    if (!t) return false
    await j.pick(t)
    await j.nextHand(30000)
  }
  return false
}

test("endgame gameplay win: victory_cascade + roll_end 'win', but belts.won frozen at 5 with no belt_test_won / belt_unlocked", async ({ page }) => {
  // curriculum premise the exact-count asserts lean on — fail loudly here if the corpus shifts
  const N_BELTS = BELTS.length
  expect(N_BELTS, "curriculum defines at least one belt").toBeGreaterThan(0)

  const j = journey(page)

  // ── Boot the fully-graduated player: belts.won seeded with EVERY belt won ──
  await j.boot("/", { initialState: multiBeltEndgame() })
  await j.land("Mount Top")

  // ── Premise: ingest round-tripped every seeded win (moves/dominance intact) ──
  const snapshot = await page.evaluate(() =>
    JSON.parse(JSON.stringify((window as any).__neural.belts.won)),
  )
  const expectedWon: Record<string, unknown> = {}
  for (const b of BELTS) expectedWon[b.id] = { moves: 12, dominance: 5, byPoints: false }
  expect(snapshot, "every seeded belt win ingested wholesale (dominance included)").toEqual(expectedWon)
  expect(
    Object.keys(snapshot).length,
    "belts.won holds exactly one entry per curriculum belt before the roll",
  ).toBe(N_BELTS)

  // ── This is a NORMAL roll, not a belt test — the whole belt block in endRound is gated
  //    behind `if (this._beltTest)`, which is null here ──
  expect(
    await page.evaluate(() => !!(window as any).__neural._beltTest),
    "no belt test staged — a plain land() roll leaves _beltTest null",
  ).toBe(false)

  // ── Pre-roll beat census: whatever belt beats exist now (must be zero — the persona seeds
  //    belts.won directly, it does not replay a belt_test_won/belt_unlocked emission) ──
  const preBeats = await j.beats()
  const preWonCount = preBeats.filter((b) => b.beat === "belt_test_won").length
  const preUnlockedCount = preBeats.filter((b) => b.beat === "belt_unlocked").length
  expect(preWonCount, "no belt_test_won beat before the roll").toBe(0)
  expect(preUnlockedCount, "no belt_unlocked beat before the roll").toBe(0)

  // ── Win the roll by rigged submission (playToTap armor; Mount Top deals one directly) ──
  expect(await playToTap(j, page), "the roll resolved to a submission finish").toBe(true)

  // ── The generic victory cascade DID fire — this is a real, resolved win ──
  expect(await j.lastOutcome(), "durable roll_end beat records a WIN").toBe("win")
  await j.expectBeat("victory_cascade")

  // ── THE INVARIANT: the belt ledger never moved ──
  const post = await page.evaluate(() => {
    const a = (window as any).__neural
    const beats = a.beats || []
    return {
      won: JSON.parse(JSON.stringify(a.belts.won)),
      wonCount: beats.filter((b: any) => b.beat === "belt_test_won").length,
      unlockedCount: beats.filter((b: any) => b.beat === "belt_unlocked").length,
      staged: !!a._beltTest,
    }
  })
  // no belt-award beats re-emitted by the win (still at their pre-roll value of 0)
  expect(post.wonCount, "gameplay win never emits belt_test_won").toBe(preWonCount)
  expect(post.unlockedCount, "gameplay win never emits belt_unlocked").toBe(preUnlockedCount)
  // the win-path belt block never staged a test
  expect(post.staged, "_beltTest still null after the win — the belt block never ran").toBe(false)
  // belts.won byte-identical: no new entry, no re-stamped moves/dominance
  expect(post.won, "belts.won byte-identical across the win — no double-award, no field churn").toEqual(snapshot)
  expect(
    Object.keys(post.won).length,
    "belts.won still holds exactly one entry per belt — the win added nothing",
  ).toBe(N_BELTS)
})
