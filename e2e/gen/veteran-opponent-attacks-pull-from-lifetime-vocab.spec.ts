/* @hyperspace {"theme":"lifetime-journeys","L":"srs-veteran","F":"opponent-turns","B":"guard-limit"} @invariant "During a normal (non-belt-test) roll for a 25-deck veteran, a rigged opponent_attack draws a technique that resolves to a real submissions/transitions node, and mastered lifetime decks never widen the opponent's attack pool — the attack idx resolves to a node whose title matches the beat technique, and zero phantom opponent_attack beats fire beyond the rigged one." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { srsVeteran } from "./personas"

/**
 * VETERAN OPPONENT ATTACKS — the opponent's finish draw is a REAL graph node, and a lifetime
 * of mastered decks never changes WHICH nodes the opponent can attack you with.
 *
 * Seams under test (all verified by source read of neural/src/app.src.jsx):
 *   - opponentDefend finish branch (app.src.jsx:4642) fires exactly one
 *       fx("opponent_attack", { technique: nodes[def].t, idx: def })
 *     where `def` is drawn ONLY from `subs` (nodes gathered with ty==="submissions",
 *     app.src.jsx:4630). So nodes[idx].t === technique BY CONSTRUCTION and the resolved
 *     node.ty is "submissions". The positional-counter branch emits a DIFFERENT beat
 *     ("opponent_move", app.src.jsx:4657) so it can never masquerade as an attack.
 *   - the opponent's pool is graph adjacency (this.adj[currentPos]) filtered by
 *     _beltPoolAllows(n), which returns true UNCONDITIONALLY outside a belt test
 *     (app.src.jsx:2546: `if (!bt) return true`). prep/rec (the mastered decks) feed
 *     moveChance/odds only — never adjacency — so clearing them leaves the sub-pool identical.
 *   - enterDefense (app.src.jsx:4562) keeps the roll LIVE: it sets optionIdxs=escapes
 *     (4578) and _defendSub=subIdx (4578), so after the attack lands the game is still
 *     in playable defense, not stalled.
 *
 * RIG DISCIPLINE: every draw the failure path touches is a pre-sized single-value queue.
 *   resolve[0.99]      → player's move fails (resolve gate app.src.jsx:4487)
 *   outcome[0.99]      → worst authored outcome cell on the failing draw (drawOutcome 4463)
 *   opp-finish[0.01]   → opponent takes the finish branch (app.src.jsx:4642, rng<pFinish)
 *   opp-sub-pick[0.01] → picks subs[0] (app.src.jsx:4643)
 *   escape[0.99]       → do NOT auto-escape; stay in live defense
 * No Math.random is reachable — the whole failure→attack sequence is deterministic.
 *
 * PLAY-BOTTOM recipe (positions canonicalize to ONE "<X> Top" node with s=[top,bottom];
 * there are ZERO "* Bottom" node titles, so land("Mount Bottom") throws): land the Top node,
 * flip playerRole to "bottom" in-memory, re-deal via enterLand(false) — optionsFor
 * (app.src.jsx:3842) is role-aware (line 3850 filters myVal>=oppVal-0.05) so the hand
 * rebuilds from the bottom perspective and the opponent (now top) threatens finishes.
 *
 * GOTCHA honored: enterFailCal may travel to a regress destination BEFORE opponentDefend, so
 * the attack can fire from a node ADJACENT to (not identical to) the Mount landing. Every
 * assertion reads the beat's OWN idx (always self-consistent) — never a pre-captured pool.
 * graph-data.json on disk uses string ids + a different link shape than the live numeric
 * adj/nodes, so adjacency is always read at runtime from a.adj / a.nodes, never from disk.
 *
 * ONE test, ONE boot: both invariant clauses share the same landed bottom hand. The pool
 * snapshot runs first (it clears prep/rec, harmless to the attack since resolve is rig-forced
 * to fail regardless of odds), then the rigged finish is fired and its idx resolved.
 */

/** Re-deal the current hand from the BOTTOM perspective (see recipe above). */
async function flipToBottom(page: any) {
  await page.evaluate(() => {
    const a = (window as any).__neural
    a.playerRole = "bottom"
    a.enterLand(false) // rebuild options for the new role (no restart toast)
  })
}

/** A transition option title in the CURRENT hand (never a submission — we pick a move that
 *  can FAIL into the opponent's turn). Read live: disk graph shape differs from the app. */
async function aTransitionOption(page: any): Promise<string | null> {
  return page.evaluate(() => {
    const a = (window as any).__neural
    for (const k of a.optionIdxs || []) {
      const o = typeof k === "number" ? k : k.idx
      const n = a.nodes[o]
      if (n && n.ty === "transitions") return n.t
    }
    return null
  })
}

test("veteran normal roll: a rigged opponent finish draws a real submission node, exactly once, and a lifetime of mastered decks never widens the attack pool", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/", { initialState: srsVeteran(25) })
  await j.land("Mount Top")
  await j.expectBeat("options_dealt")

  // NOT a belt test — the invariant is specifically about the UNRESTRICTED opponent pool.
  expect(await page.evaluate(() => !!(window as any).__neural._beltTest), "no belt test active").toBe(false)

  // play the BOTTOM side so the opponent (top) has finishes pointed at us
  await flipToBottom(page)
  await j.advanceUntil("options_dealt", 20000) // wait for the re-dealt bottom hand

  // ── CLAUSE 2 (pool invariance), checked FIRST because it is non-destructive to the attack:
  //    snapshot the opponent's SUBMISSION pool exactly as opponentDefend gathers it (adj filtered
  //    to ty==="submissions", _beltPoolAllows unconditional off-belt), WITH the 25 decks seeded,
  //    then AGAIN after clearing prep/rec. adjacency is graph topology; prep/rec feed only odds,
  //    so the arrays must be byte-identical. Clearing mastery is safe for CLAUSE 1 too: the
  //    resolve gate is rigged to 0.99 (forced failure) independent of moveChance. ──
  const subPool = () =>
    page.evaluate(() => {
      const a = (window as any).__neural
      const seen = new Set<string>()
      const ids: number[] = []
      for (const k of a.adj[a.currentPos] || []) {
        const n = a.nodes[k]
        if (!n || n.ty !== "submissions") continue
        if (seen.has(n.t)) continue
        seen.add(n.t)
        if (a._beltPoolAllows(n)) ids.push(k)
      }
      return ids.sort((x, y) => x - y)
    })

  const seededDecks = await page.evaluate(
    () => Object.keys((window as any).__neural.prep || {}).length + Object.keys((window as any).__neural.rec || {}).length,
  )
  expect(seededDecks, "the 25-deck veteran actually loaded mastery (prep+rec non-empty)").toBeGreaterThan(0)

  const withMastery = await subPool()
  await page.evaluate(() => {
    const a = (window as any).__neural
    a.prep = {}
    a.rec = {}
  })
  expect(
    await page.evaluate(() => Object.keys((window as any).__neural.prep).length),
    "mastery was actually cleared for the comparison",
  ).toBe(0)
  const withoutMastery = await subPool()
  expect(
    withoutMastery,
    "the opponent's attack pool is identical with vs without a lifetime of mastered decks",
  ).toEqual(withMastery)

  // ── CLAUSE 1 (real-node attack): rig exactly one opponent finish and prove its idx resolves. ──
  const move = await aTransitionOption(page)
  expect(move, "the bottom hand offers a transition to fail into the opponent's turn").toBeTruthy()

  // rig EXACTLY one opponent finish: our move fails, worst outcome, opponent takes subs[0],
  // and we do NOT auto-escape (so the roll stays in live defense).
  await j.rig("resolve", [0.99])
  await j.rig("outcome", [0.99])
  await j.rig("opp-finish", [0.01])
  await j.rig("opp-sub-pick", [0.01])
  await j.rig("escape", [0.99])
  await j.pick(move as string)
  // opponent_attack fires in opponentDefend, then a short travel leg lands enterDefense which
  // emits defend_start/caught and sets the live-defense state SYNCHRONOUSLY. Await `caught`
  // (fires just after opponent_attack) so we read the defense window while it is genuinely
  // open — the decision clock's expiry is a tap, so we must NOT keep pumping time past it.
  await j.advanceUntil("caught", 25000)

  // ── the invariant, asserted on the beat's OWN idx (self-consistent regardless of which
  //    node the enterFailCal regress leg parked us on) ──
  const attacks = (await j.beats()).filter((b: any) => b.beat === "opponent_attack") as any[]
  expect(attacks.length, "exactly one opponent_attack fired (single-value rig queues)").toBe(1)

  const atk = attacks[0]
  const resolved = await page.evaluate((idx: number) => {
    const a = (window as any).__neural
    const n = a.nodes[idx]
    return n ? { t: n.t, ty: n.ty } : null
  }, atk.idx)

  expect(resolved, "attack idx resolves to a real node in the live graph").not.toBeNull()
  // technique is a non-empty string carried by the beat
  expect(typeof atk.technique === "string" && atk.technique.length > 0, "beat carries a non-empty technique").toBe(true)
  // nodes[idx].t === technique BY CONSTRUCTION (app.src.jsx:4642)
  expect(resolved!.t, "resolved node title matches the beat technique").toBe(atk.technique)
  // the finish branch draws only from `subs` → the node is a submission
  expect(resolved!.ty, "the opponent's finish resolves to a submissions node").toBe("submissions")

  // no phantom attacks: the positional-counter path emits "opponent_move", never a second attack
  expect(
    (await j.beats()).filter((b: any) => b.beat === "opponent_move").length,
    "the rigged finish branch fired, not the counter branch",
  ).toBe(0)

  // GUARD-LIMIT: the roll entered LIVE defense, it didn't stall or silently end. enterDefense
  // emits caught, then sets optionIdxs=escapes and _defendSub=subIdx synchronously — so the
  // instant `caught` is in the stream (awaited above) both are freshly set and we read them
  // before the decision clock can expire into a tap.
  await j.expectBeat("defend_start")
  const live = await page.evaluate(() => {
    const a = (window as any).__neural
    return { esc: (a.optionIdxs || []).length, sub: a._defendSub }
  })
  expect(
    live.esc > 0 || live.sub != null,
    "roll is live in defense at the moment of catch (escape options queued or _defendSub set)",
  ).toBe(true)
})
