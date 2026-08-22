/* @hyperspace {"theme":"lifetime-journeys","L":"multi-belt-endgame","F":"victory-defeat","B":"idempotence"} @invariant "A rigged gameplay submission win for a fully completed player fires roll_end 'win'/victory_cascade but never re-emits belt_test_won and leaves the internal capstone record unchanged — normal gameplay cannot inflate a content capstone." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { multiBeltEndgame, CURRICULUM } from "./personas"

/**
 * ENDGAME VICTORY CANNOT DOUBLE-AWARD A CONTENT CAPSTONE — the gameplay↔capstone firewall.
 *
 * A player who has cleared every content capstone wins ANOTHER plain roll by rigged submission. The
 * generic victory cascade must fire (this is a real win: rank rides along), yet the internal
 * compatibility ledger must be inert — no belt_test_won and belts.won frozen at its seeded
 * entries with their {moves, dominance} untouched. A normal roll is NOT a content capstone,
 * so a win on it can never mint or re-stamp a capstone.
 *
 * Structural root cause (neural/src/app.src.jsx, source-verified at authoring):
 *   - endRound's internal capstone block is guarded by `if (this._beltTest)`.
 *     A plain land("Mount Top") roll has _beltTest === null, so the compatibility record write
 *     and belt_test_won fx are skipped.
 *   - Only `if (kind === "win")` @3805 runs → victory_cascade (@3810) + ladderMove(1) (@3811)
 *     + finish + roll_end{outcome:"win"}. None of these touch capstone records.
 *   - A submission finish reaches endRound("win") via the ty short-circuit in enterSuccess
 *     (@4504) / enterSuccessCal (@4530) — `if (act.ty === "submissions") { ...; endRound("win",
 *     act.t); return; }` — so the win arrives on the generic path with _beltTest still null.
 *   - The sweep verdict is a single resolve draw: tensionSweep @4470 `success = rng("resolve")
 *     < moveChance`; 0.01 < any moveChance ⇒ success. `outcome` (drawOutcome's success pick) is
 *     re-rigged before every take as armor — a submission win short-circuits before it matters.
 *
 * This is the mirror of gen "veteran-victory-does-not-mutate-recall-map" (same win mechanism,
 * B: cross-feature/rec map) and the complement of gen "endgame-won-test-is-final" (an inert
 * CLICK on a cleared capstone): here the finish is a REAL, resolved gameplay win, and the thing
 * that must NOT move is the capstone record.
 *
 * Counts derive from the served curriculum fixture (CURRICULUM.belts) — never the literal 5.
 * No content-text assertions — the dealt/sought submission is discovered by ty, never named.
 */

const BELTS: any[] = CURRICULUM.belts

/** playToTap armor: take a submission the instant one is
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

test("endgame gameplay win: victory_cascade + roll_end 'win', but the capstone record is unchanged", async ({ page }) => {
  // curriculum premise the exact-count asserts lean on — fail loudly here if the corpus shifts
  const N_BELTS = BELTS.length
  expect(N_BELTS, "curriculum defines at least one content track").toBeGreaterThan(0)

  const j = journey(page)

  // ── Boot the fully completed player: every compatibility capstone is seeded as cleared ──
  await j.boot("/", { initialState: multiBeltEndgame() })
  await j.land("Mount Top")
  if (await page.locator("[data-tut-hide]").count()) await page.locator("[data-tut-hide]").click()

  // ── Premise: ingest round-tripped every seeded win (moves/dominance intact) ──
  const snapshot = await page.evaluate(() =>
    JSON.parse(JSON.stringify((window as any).__neural.belts.won)),
  )
  const expectedWon: Record<string, unknown> = {}
  for (const b of BELTS) expectedWon[b.id] = { moves: 12, dominance: 5, byPoints: false }
  expect(snapshot, "every seeded capstone win ingested wholesale (dominance included)").toEqual(expectedWon)
  expect(
    Object.keys(snapshot).length,
    "the compatibility record holds exactly one entry per content track before the roll",
  ).toBe(N_BELTS)

  // ── This is a NORMAL roll, not a content capstone — the internal capstone block is gated
  //    behind `if (this._beltTest)`, which is null here ──
  expect(
    await page.evaluate(() => !!(window as any).__neural._beltTest),
    "no content capstone staged — a plain land() roll leaves _beltTest null",
  ).toBe(false)

  // ── Pre-roll census: the persona seeds the compatibility record directly and replays no capstone win. ──
  const preBeats = await j.beats()
  const preWonCount = preBeats.filter((b) => b.beat === "belt_test_won").length
  expect(preWonCount, "no belt_test_won beat before the roll").toBe(0)

  // ── Win the roll by rigged submission (playToTap armor; Mount Top deals one directly) ──
  expect(await playToTap(j, page), "the roll resolved to a submission finish").toBe(true)

  // ── The generic victory cascade DID fire — this is a real, resolved win ──
  expect(await j.lastOutcome(), "durable roll_end beat records a WIN").toBe("win")
  await j.expectBeat("victory_cascade")

  // ── THE INVARIANT: the compatibility capstone ledger never moved ──
  const post = await page.evaluate(() => {
    const a = (window as any).__neural
    const beats = a.beats || []
    return {
      won: JSON.parse(JSON.stringify(a.belts.won)),
      wonCount: beats.filter((b: any) => b.beat === "belt_test_won").length,
      staged: !!a._beltTest,
    }
  })
  // no capstone-award beats re-emitted by the win (still at their pre-roll value of 0)
  expect(post.wonCount, "gameplay win never emits belt_test_won").toBe(preWonCount)
  // the win-path capstone block never staged a test
  expect(post.staged, "_beltTest still null after the win — the capstone block never ran").toBe(false)
  // belts.won byte-identical: no new entry, no re-stamped moves/dominance
  expect(post.won, "belts.won byte-identical across the win — no double-award, no field churn").toEqual(snapshot)
  expect(
    Object.keys(post.won).length,
    "the compatibility record still holds exactly one entry per track — the win added nothing",
  ).toBe(N_BELTS)
})
