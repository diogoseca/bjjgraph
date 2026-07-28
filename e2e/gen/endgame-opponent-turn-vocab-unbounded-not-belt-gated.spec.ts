/* @hyperspace {"theme":"lifetime-journeys","L":"multi-belt-endgame","F":"opponent-turns","B":"happy-path"} @invariant "Outside a belt test the opponent's move pool is the full graph, not a belt-restricted set: for a graduated player a rigged opponent_move in a normal roll resolves to a transitions-or-submissions node whose technique need not be in any belt's names list, and no _beltTest is ever set — belt-vocabulary restriction is a belt-test-only rule." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { multiBeltEndgame, CURRICULUM } from "./personas"

/**
 * ENDGAME OPPONENT VOCABULARY IS UNBOUNDED — the belt-test spec proves the opponent is
 * RESTRICTED to a belt's computed pool DURING a boss battle (belt-test.spec.ts:151). This is
 * the exact mirror: in a NORMAL roll (no belt test) the opponent draws from the WHOLE graph.
 * Belt-vocabulary restriction is a belt-test-only rule; a graduated player rolling casually
 * faces the full move set.
 *
 * Mechanism under test (neural/src/app.src.jsx):
 *   - _beltPoolAllows(n) (~2545): `const bt=this._beltTest; if(!bt) return true;` — with no
 *     belt test active it returns true for EVERY node; the belt `names` list is consulted ONLY
 *     when _beltTest is set. This one guard is the whole invariant.
 *   - startRoll (~4177): forces `this._beltTest = null` on every normal roll, so no ambient
 *     belt-test state can leak in from the persona.
 *   - opponentDefend (~4624): runs after impact_fail (~4522/4551/4557). It gathers
 *     adj[currentPos] technique candidates (positions skipped, ~4628), splits finishes vs
 *     positional counters, and — when the finish branch is declined — fires opponent_move
 *     {technique, idx} for the top positional counter (~4657). opponent_attack (~4645) is the
 *     finish-only branch, gated by subs.length && rng("opp-finish") < pFinish (pFinish≤0.85).
 *
 * RIG (the core-014 mirror: belt-test.spec.ts:170 uses opp-finish:[0.01] to FORCE the
 * pool-restricted finish branch; we flip it HIGH to force the unrestricted counter branch):
 *   resolve:[0.99]  → player move fails → opponent turn
 *   outcome:[0.99]  → failure outcome draw
 *   opp-finish:[0.99,0.99,0.99] → clears pFinish → DECLINE finish → positional counter
 *   opp-pick:[0.01,0.01,0.01]   → take the top counter deterministically
 *   escape:[0.01]   → belt-and-suspenders if a finish ever slips through
 *
 * Assertions are STRUCTURE, never content text (MC waves rewrite technique/answer strings):
 * the opponent_move beat's {technique, idx} resolves to a transitions|submissions node,
 * idx→node.t round-trips, _beltTest is null throughout, zero opponent_attack, belt_test_start
 * never fired. The decisive proof is MECHANISTIC: a live census over adj[currentPos] counting
 * technique candidates whose splitName(...).main is OUTSIDE the union of all 5 belts' pools,
 * asserting >0 exist AND every one is _beltPoolAllows()-eligible — impossible inside a belt
 * test, where names.indexOf gates out-of-pool names out.
 */

const BELTS: any[] = CURRICULUM.belts
/** union of every belt's computed pool (lowercased base names), both rulesets — the vocabulary
 *  a belt test WOULD confine the opponent to. Built from the served fixture, never hardcoded. */
const POOL_UNION: Set<string> = new Set(
  BELTS.flatMap((b: any) => [...(b.pool?.gi || []), ...(b.pool?.nogi || [])]).map((n: string) => n.toLowerCase()),
)

const beatsOf = async (j: any, beat: string) => (await j.beats()).filter((b: any) => b.beat === beat)

test("normal-roll opponent turn: move drawn from the full graph, no belt-pool restriction, no _beltTest", async ({
  page,
}) => {
  // curriculum facts the census leans on — fail loudly here if the corpus shifts
  expect(BELTS.length, "curriculum defines belts").toBeGreaterThan(0)
  expect(BELTS.every((b: any) => b.pool), "every belt defines a computed pool").toBe(true)
  expect(POOL_UNION.size, "the belt-pool vocabulary union is non-empty").toBeGreaterThan(0)

  const j = journey(page)
  await j.boot("/", { initialState: multiBeltEndgame() })
  await j.land("Mount Top") // role-agnostic mechanism; land() rigs role=top via rigStart

  // ── this is a NORMAL roll, not a belt test: startRoll forced _beltTest=null and the persona
  //    (all belts won) carries no belt-test state. belt_test_start must never have fired. ──
  expect(await page.evaluate(() => (window as any).__neural._beltTest ?? null), "no belt test before the turn").toBe(
    null,
  )
  expect((await beatsOf(j, "belt_test_start")).length, "no belt test was ever started").toBe(0)

  // DECISIVE PRE-CHECK — census the opponent's live adjacency BEFORE the turn: count technique
  // candidates whose base name is OUTSIDE the union of all belt pools, and confirm EVERY one is
  // _beltPoolAllows()-eligible right now. Inside a belt test names.indexOf would gate these out;
  // outside one the guard short-circuits true. Using the app's own splitName + _beltPoolAllows so
  // the census matches the mechanism exactly (never a re-derived TS copy).
  const census = await page.evaluate((pool: string[]) => {
    const a = (window as any).__neural
    const poolSet = new Set(pool)
    let outOfPool = 0
    let outOfPoolAllowed = 0
    const seen = new Set<string>()
    for (const k of a.adj[a.currentPos] || []) {
      const n = a.nodes[k]
      if (!n || n.ty === "positions") continue // opponentDefend skips positions
      if (seen.has(n.t)) continue
      seen.add(n.t)
      const base = a.splitName(n.t).main.toLowerCase()
      if (!poolSet.has(base)) {
        outOfPool++
        if (a._beltPoolAllows(n)) outOfPoolAllowed++
      }
    }
    return { outOfPool, outOfPoolAllowed, beltTest: a._beltTest ?? null }
  }, Array.from(POOL_UNION))

  // >0 out-of-pool candidates exist AND every single one is eligible — the unrestricted pool,
  // proven at the guard level (a belt test would leave outOfPoolAllowed at 0).
  expect(census.outOfPool, "opponent adjacency includes techniques outside every belt's pool").toBeGreaterThan(0)
  expect(
    census.outOfPoolAllowed,
    "every out-of-pool candidate is belt-pool-eligible (guard short-circuits true with no _beltTest)",
  ).toBe(census.outOfPool)
  expect(census.beltTest, "still no belt test at census time").toBe(null)

  // ── force the opponent turn down the POSITIONAL-COUNTER branch (unrestricted), not the
  //    finish branch (the only branch a belt test would pool-restrict) ──
  await j.rig("resolve", [0.99]) // player move fails → opponent turn
  await j.rig("outcome", [0.99]) // failure outcome draw
  await j.rig("opp-finish", [0.99, 0.99, 0.99]) // clear pFinish → DECLINE finish → counter branch
  await j.rig("opp-pick", [0.01, 0.01, 0.01]) // take the top counter deterministically
  await j.rig("escape", [0.01]) // belt-and-suspenders: escape if a finish ever slips through

  // pick any transition the player can attempt (its content is irrelevant — we assert on the
  // OPPONENT's reply, not this move)
  const mine = await page.evaluate(() => {
    const a = (window as any).__neural
    for (const k of a.optionIdxs || []) if (a.nodes[k]?.ty === "transitions") return a.nodes[k].t
    return null
  })
  expect(mine, "a transition option is available to attempt").toBeTruthy()
  await j.pick(mine as string)

  // pump until the opponent commits a positional counter (travel legs make fixed advances flaky)
  await j.advanceUntil("opponent_move", 22000)

  // ── the opponent_move beat: {technique, idx} resolves to a real technique node ──
  const move = (await beatsOf(j, "opponent_move")).at(-1) as any
  expect(move, "opponent committed a positional counter").toBeTruthy()
  const resolved = await page.evaluate((idx: number) => {
    const a = (window as any).__neural
    const n = a.nodes[idx]
    return n ? { ty: n.ty, t: n.t, allowed: a._beltPoolAllows(n) } : null
  }, move.idx)
  expect(resolved, "opponent_move.idx indexes a real node").toBeTruthy()
  // STRUCTURE: the move node is a technique (never a position), and idx→t round-trips the beat
  expect(["transitions", "submissions"], "opponent move is a technique node, not a position").toContain(resolved!.ty)
  expect(resolved!.t, "beat.technique matches nodes[idx].t").toBe(move.technique)
  // the chosen move is pool-eligible via the same guard the belt test would use — true here
  // BECAUSE no belt test is active (the guard's short-circuit), not because it happens to be in-pool
  expect(resolved!.allowed, "the committed move is eligible (guard short-circuits with no _beltTest)").toBe(true)

  // ── the turn took the counter branch, NEVER the pool-restricted finish branch ──
  expect((await beatsOf(j, "opponent_attack")).length, "zero finish attacks — counter branch only").toBe(0)

  // ── _beltTest stayed null through the entire opponent turn: this was never belt-gated ──
  expect(await page.evaluate(() => (window as any).__neural._beltTest ?? null), "no belt test after the turn").toBe(
    null,
  )
  expect((await beatsOf(j, "belt_test_start")).length, "no belt test started during the turn").toBe(0)
})
