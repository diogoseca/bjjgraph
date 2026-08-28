/* @hyperspace {"theme":"momentum-and-economy","L":"multi-belt-endgame","F":"opponent-turns","B":"cross-feature"} @invariant "An arrival caused by the OPPONENT still runs the landing economy: after a rigged counter/opponent_move relocates the player, the new state asks its landing question and a right answer climbs the existing streak (no reset, no break) — momentum spans exchanges regardless of who moved you." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { multiBeltEndgame } from "./personas"

/**
 * OPPONENT ARRIVALS RUN THE SAME LANDING ECONOMY — the question-first landing (v1.68.0) is
 * not special-cased to player successes. When the opponent relocates you (counter outcome →
 * opponentDefend's positional counter), the travel leg ends in the SAME enterLand(false) →
 * renderLandCard path a player success takes (app.src.jsx :5261), so the new state asks its
 * landing question, and a right answer climbs the streak the player already earned — no
 * reset, no break. Momentum (v1.70.0) spans exchanges regardless of who moved you: _combo is
 * written ONLY by _comboUp, _breakCombo("wrong"|"ignored") and the three per-MATCH resets
 * (:3330/:4697/:4738); nothing in enterFailCal (:5124) or opponentDefend (:5204) touches it.
 *
 * RIG (probe-verified frame-exact, 2× green with identical beat timestamps):
 *   resolve [0.99]        → the player's move always fails (moveChance ceiling ≈0.95)
 *   outcome [frac, 0.01]  → the tag is consumed TWICE: first by resolve()'s drawOutcome
 *                           (the player's fail cell — frac lands mid-COUNTER-cell), second by
 *                           opponentDefend's drawOutcome(defNode) (the opponent's destination;
 *                           0.01 = first authored cell, a REAL relocation)
 *   opp-finish [0.99,0.99] → declines the finish branch (pFinish caps at 0.9)
 *   opp-sub-pick [0.01]   → belt-and-suspenders if a finish ever slips through
 *   opp-pick [0.01,0.01]  → the top positional counter, deterministically
 *   escape [0.01]         → belt-and-suspenders
 * frac is computed IN-PAGE as the mid-cell cumulative fraction of the counter cell of the
 * first _optList transitions option that owns one (Mount Top → "Mount to 3-4 Mount",
 * success:65/failure:23/counter:12 → 0.94). This is honest ONLY because combo is ×1 at the
 * draw: momentumSkew()===0, so authored weights ARE the live weights — asserted before rigging.
 *
 * PERSONA SEAM: multiBeltEndgame's stage map is EMPTY (prep/rec full, stage {}), so every
 * deck is unproven and every landing ASKS — graduation suppresses nothing here. The player
 * answers before picking (else the pick itself is an "ignored" break, :4912), gated on
 * _landPending because _mc lingers after an answer.
 *
 * Probe observations (probe deleted): opponent_move {technique:"Clock Choke", idx:349},
 * Mount Top → Crucifix Top, rollTrail ["Mount/Top","Crucifix/Bottom"] — the counter-leg
 * relocation is NOT logged, only enterLand arrivals are, so the trail has exactly 2 entries.
 * Assertions are STRUCTURE (beats, counts, combo math), never technique/card text.
 */

test("opponent-caused arrival asks its landing question and a right answer climbs ×1 → ×2", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/", { initialState: multiBeltEndgame() })
  await j.land("Mount Top")

  // ── answer the live landing question like a user: keyboard A/B/C. Gated on
  // _landPending (unanswered-question-on-the-table) because _mc lingers after an answer. ──
  const answerLanding = async () => {
    const mc = await page.evaluate(() => {
      const a = (window as any).__neural
      const m = a._mc
      return a._landPending && m && m.surface === "land" && typeof m.correct === "number"
        ? { correct: m.correct }
        : null
    })
    expect(mc, "a live landing question on the land surface").toBeTruthy()
    await page.keyboard.press("abcd"[mc!.correct])
    const pending = await page.evaluate(() => !!(window as any).__neural._landPending)
    expect(pending, "answer registered — nothing left for the pick to ignore").toBe(false)
  }

  // the endgame persona's stage map is empty → every deck unproven → the landing ASKS
  await expect(page.locator("[data-land-q]"), "graduated player still gets asked").toBeVisible()
  await answerLanding() // ×1 — the streak exists before the exchange
  expect(await page.evaluate(() => (window as any).__neural._combo || 0), "combo earned at ×1").toBe(1)

  // ── aim the fail draw at a COUNTER cell: first transitions option owning one. Honest only
  // at skew 0 (combo ×1), where authored weights are the live drawOutcome weights. ──
  const aim = await page.evaluate(() => {
    const a = (window as any).__neural
    for (const o of a._optList || []) {
      if (!o.node || o.node.ty !== "transitions") continue
      const outs = (o.node.cal && o.node.cal.outcomes) || []
      let total = 0
      for (const c of outs) total += Math.max(0, +c.probability || 0)
      let cum = 0
      for (const c of outs) {
        const w = Math.max(0, +c.probability || 0)
        if (c.result === "counter" && w > 0)
          return { tech: o.node.t, frac: (cum + w / 2) / total, skew: a.momentumSkew() }
        cum += w
      }
    }
    return null
  })
  expect(aim, "a transitions option owning a counter cell").toBeTruthy()
  expect(aim!.skew, "combo ×1 → skew 0 — authored weights ARE live weights").toBe(0)

  const posBefore = await j.currentPosition()

  await j.rig("resolve", [0.99]) // the move fails
  await j.rig("outcome", [aim!.frac, 0.01]) // fail cell = counter; opp destination = 1st authored cell
  await j.rig("opp-finish", [0.99, 0.99]) // decline the finish (pFinish caps at 0.9) → counter branch
  await j.rig("opp-sub-pick", [0.01]) // belt-and-suspenders
  await j.rig("opp-pick", [0.01, 0.01]) // top positional counter
  await j.rig("escape", [0.01]) // belt-and-suspenders
  await j.pick(aim!.tech)
  await j.advanceUntil("opponent_move", 25000)
  await j.nextHand(25000)

  // ── the relocation is OPPONENT-caused: our move failed on its counter cell (never
  // succeeded — zero impact_success), the opponent committed a real technique, and the
  // position changed under us. Exactly two enterLand arrivals: origin + this one. ──
  const beats = (await j.beats()) as any[]
  const fail = beats.filter((b) => b.beat === "impact_fail").at(-1)
  expect(fail, "the player's move failed").toBeTruthy()
  expect(fail.counter, "the fail cell drawn was the COUNTER cell").toBe(true)
  expect(beats.filter((b) => b.beat === "impact_success").length, "the player never succeeded").toBe(0)
  const move = beats.filter((b) => b.beat === "opponent_move").at(-1)
  expect(move, "the opponent committed a positional counter").toBeTruthy()
  const resolved = await page.evaluate((idx: number) => {
    const a = (window as any).__neural
    const n = a.nodes[idx]
    return n ? { ty: n.ty, t: n.t } : null
  }, move.idx)
  expect(["transitions", "submissions"], "opponent move is a technique node").toContain(resolved!.ty)
  expect(resolved!.t, "beat.technique round-trips through idx").toBe(move.technique)
  const posAfter = await j.currentPosition()
  expect(posAfter, "the opponent RELOCATED the player").not.toBe(posBefore)
  expect((await j.rollTrail()).length, "exactly two enterLand arrivals: origin + opponent-caused").toBe(2)
  expect(beats.filter((b) => b.beat === "roll_end").length, "same match — no per-match reset ran").toBe(0)

  // ── THE INVARIANT: the arrival ran the landing economy, and the streak SURVIVED it ──
  expect(beats.filter((b) => b.beat === "combo_break").length, "zero breaks across the exchange").toBe(0)
  await expect(page.locator("[data-land-q]"), "the new state asks its landing question").toBeVisible()
  const arrived = await page.evaluate(() => {
    const a = (window as any).__neural
    return { combo: a._combo || 0, pending: !!a._landPending }
  })
  expect(arrived.combo, "the streak carried through the opponent's exchange — no reset").toBe(1)
  expect(arrived.pending, "a fresh question is on the table (same renderLandCard path)").toBe(true)

  // ── a right answer HERE climbs the existing streak: ×1 → ×2, DOUBLE COMBO! ──
  await answerLanding()
  const after = await page.evaluate(() => {
    const a = (window as any).__neural
    return { combo: a._combo || 0, mod: a.momentumMod() }
  })
  expect(after.combo, "×2 — the opponent-caused arrival CONTINUED the streak").toBe(2)
  expect(after.mod, "+2.5% at ×2").toBeCloseTo(0.025, 6)
  const combos = ((await j.beats()) as any[]).filter((b) => b.beat === "combo")
  expect(combos.length, "exactly one combo announcement (×2)").toBe(1)
  expect(combos[0].n).toBe(2)
  expect(combos[0].name).toBe("DOUBLE COMBO!")
  expect(combos[0].mod).toBeCloseTo(0.025, 6)
  await expect(page.locator('[data-combo-pop="2"]'), "the DOUBLE announcer pops").toBeVisible()
  expect(
    ((await j.beats()) as any[]).filter((b) => b.beat === "combo_break").length,
    "still zero breaks — whole exchange streak-clean",
  ).toBe(0)
})
