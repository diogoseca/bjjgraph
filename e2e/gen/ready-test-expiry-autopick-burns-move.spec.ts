/* @hyperspace {"theme":"unlock-economy","L":"belt-ready","F":"decision-timer","B":"keyboard-timing"} @invariant "Inaction is not a loophole in the belt-test move economy: letting the decision window expire during a live belt test narrates expiry_warning then auto_pick AND advances the moves-used counter by exactly 1, with _beltTest still live afterward." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { beltReady, CURRICULUM } from "./personas"

/**
 * READY TEST: EXPIRY AUTO-PICK BURNS A MOVE — a belt-READY player starts the white belt test
 * and FREEZES on the very first test hand. Inaction must not be a loophole in the move economy:
 * the timeout is narrated (expiry_warning → auto_pick), the auto-picked exchange debits the
 * moves-used counter by EXACTLY 1 (same price a deliberate pick pays), and the belt test is
 * STILL LIVE afterward — no verdict beat, no roll_end, next hand dealt from the same budget.
 *
 * Mechanism under test (neural/src/app.src.jsx, probe-verified 2x green with byte-identical
 * logs, 4.2s/4.3s; probe file deleted):
 *   - startBeltTest (:2549) sets _beltTest BEFORE rollFromPosition — clearEngagement (:184)
 *     deliberately leaves _beltTest alone, so the test SURVIVES the roll that starts it. The
 *     authored budget + start role then override the roll seeder's draws (:2574-2576).
 *   - rollFromPosition (:4163-4166) REDRAWS max-moves/ai-skill/role — "Mount" (white's
 *     startNodeId Positions/Mount) names neither top nor bottom so role IS drawn. land()'s
 *     ambient rigs are already spent, hence the re-rig before the row click.
 *   - _tickDecision (:4315): a landing window has NO onExpire, so expiry takes the auto_pick
 *     branch: fx("expiry_warning",{seconds}) once per second at secLeft<=3, then fx("auto_pick"),
 *     then a weighted-pool select via this.rng("auto-pick") (w=max(0.12,0.5+node.dom),
 *     Math.round(w*10) copies) and pick() → enterAttempt fires fx("commit") synchronously.
 *   - The debit rides enterSuccessCal (:4537): travel → moveCount++ → _lastActor="you" →
 *     enterLand (next hand, budget intact). SCOPING: a stay-put FAILURE outcome debits 0 at
 *     that instant by design (enterFailCal :4551 → opponentDefend; the opponent's counter-move
 *     increments separately) — so this spec FORCES the success arm via the resolve rig; the
 *     "exactly 1" claim is pinned on the forced-success positional outcome.
 *
 * Novel vs the corpus: returner-decision-timer-expiry pins the narration + cardsToday on a
 * NORMAL roll; ready-lost-attempt pins the LOSS economy. Nobody pins expiry INSIDE a live belt
 * test — that the auto-pick spends real budget while the test survives the timeout.
 *
 * Determinism: every draw rigged pre-sized — re-rigged seeder ambients (1 each), auto-pick
 * pinned at (k+0.5)/pool.length for the first TRANSITIONS pool slot (a submission auto-pick
 * would endRound("win") and end the test), resolve [0.01] forces success at the sweep's single
 * draw (forced!=null skips the second at :4487), outcome [0.01] free (success branch re-finds
 * the success cell :4491). Beat ORDER is asserted in the post-baseline slice only; counters
 * and ids derive from the served curriculum fixture — never card/label text.
 */

const WHITE: any = CURRICULUM.belts[0]
const AUTHORED_ROLE = ((WHITE.test?.startDeckKey || "").split("|")[1] || "").toLowerCase()

test("frozen belt-test hand: expiry_warning → auto_pick narrated, exactly one move debited, _beltTest survives", async ({ page }) => {
  // curriculum premises the economy math leans on — fail loudly here if the corpus shifts
  expect(WHITE.test, "white belt defines a test").toBeTruthy()
  expect(WHITE.test.maxMoves, "authored budget leaves headroom — one debit cannot exhaust it").toBeGreaterThanOrEqual(2)

  const j = journey(page)
  await j.boot("/", { initialState: beltReady() })
  await j.land("Mount Top") // coach auto-dismissed by the DSL

  // Re-rig the belt-test roll seeder's ambient draws — land()'s rigs are spent, and
  // rollFromPosition redraws all three (role IS drawn: "Mount" names neither role).
  await j.rig("max-moves", [0.5])
  await j.rig("ai-skill", [0.5])
  await j.rig("role", [0])

  // ── Start the test from the path row (starting it closes the explorer) ──
  await page.evaluate(() => (window as any).__neural.toggleExplorer())
  const row = page.locator(`[data-belt-test="${WHITE.id}"]`).first()
  await expect(row, "white belt-test row rendered").toBeVisible()
  expect(await row.getAttribute("data-test-state"), "persona premise: row reads ready (no win, no burn)").toBe("ready")
  await row.click()
  await j.advanceUntil("belt_test_start", 20000)
  const started = ((await j.beats()) as any[]).filter((b) => b.beat === "belt_test_start").pop()
  expect(started.belt, "the started test is white's").toBe(WHITE.id)
  expect(started.maxMoves, "start beat carries the authored budget").toBe(WHITE.test.maxMoves)
  await j.nextHand(30000)

  // ── The test hand: live belt test, zero moves spent, armed landing window ──
  const hand = await page.evaluate(() => {
    const a = (window as any).__neural
    const d = a._decision
    return {
      beltId: a._beltTest ? a._beltTest.beltId : null,
      moveCount: a.moveCount,
      maxMoves: a.maxMoves,
      role: a.playerRole,
      opts: (a.optionIdxs || []).length,
      armed: !!d && !d.onExpire, // landing window → auto_pick branch, never the "tapped" branch
      remaining: d ? d.remaining : 0,
    }
  })
  expect(hand.beltId, "_beltTest live at the first hand (survived rollFromPosition)").toBe(WHITE.id)
  expect(hand.moveCount, "moves-used baseline is zero").toBe(0)
  expect(hand.maxMoves, "authored budget overrides the seeder draw").toBe(WHITE.test.maxMoves)
  if (AUTHORED_ROLE) {
    expect(hand.role, "startDeckKey's authored role governs the test hand").toBe(AUTHORED_ROLE === "bottom" ? "bottom" : "top")
  }
  expect(hand.opts, "test hand dealt options").toBeGreaterThanOrEqual(1)
  expect(hand.armed, "decision window armed with NO onExpire").toBe(true)
  expect(hand.remaining, "window not yet drained").toBeGreaterThan(0)

  // ── Pin the auto-pick: rebuild the weighted pool EXACTLY as _tickDecision (:4334) and aim
  //    at the first TRANSITIONS slot — a submission auto-pick would win the round outright. ──
  const pin = await page.evaluate(() => {
    const a = (window as any).__neural
    const pool: any[] = []
    for (const o of a._decision.opts) {
      const w = Math.max(0.12, 0.5 + o.node.dom)
      for (let i = 0; i < Math.round(w * 10); i++) pool.push(o)
    }
    let k = -1
    for (let i = 0; i < pool.length; i++)
      if (pool[i].node.ty === "transitions") { k = i; break }
    return { poolLen: pool.length, k, tech: k >= 0 ? pool[k].node.t : null }
  })
  expect(pin.poolLen, "weighted auto-pick pool is non-empty").toBeGreaterThan(0)
  expect(pin.k, "the test hand offers a positional transition to pin").toBeGreaterThanOrEqual(0)
  await j.rig("auto-pick", [(pin.k + 0.5) / pin.poolLen])
  // exchange rigs, pre-sized 1 each — forced SUCCESS is the scoped arm of the invariant
  await j.rig("resolve", [0.01])
  await j.rig("outcome", [0.01])

  // ── FREEZE through the window; judge the narration in the post-baseline slice only ──
  const baseline = (await j.beats()).length
  await j.advanceUntil("expiry_warning", 30000, 400)
  await j.advanceUntil("auto_pick", 10000, 250)
  const slice = ((await j.beats()) as any[]).slice(baseline)
  const names = slice.map((b) => b.beat)
  const iWarn = names.indexOf("expiry_warning")
  const iAuto = names.indexOf("auto_pick")
  const iCommit = names.indexOf("commit")
  expect(iWarn, "expiry_warning narrated on the frozen TEST hand").toBeGreaterThanOrEqual(0)
  expect(iAuto, "the timeout fired an auto_pick — never a silent teleport").toBeGreaterThanOrEqual(0)
  expect(iWarn, "warning PRECEDES the pick — the player was warned first").toBeLessThan(iAuto)
  expect(iCommit, "the auto-pick committed a real move").toBeGreaterThanOrEqual(0)
  expect(iAuto, "auto_pick precedes the commit it drives").toBeLessThan(iCommit)
  // warnings are structural {seconds} props in the final 3-2-1, never label text
  const warnSecs = slice.filter((b) => b.beat === "expiry_warning").map((b) => b.seconds)
  expect(warnSecs.length, "at least one countdown warning emitted").toBeGreaterThanOrEqual(1)
  for (const s of warnSecs) expect([1, 2, 3], "each warning counts down the final 3 seconds").toContain(s)
  // the rig held: the committed technique IS the pinned pool slot (runtime-derived, not literal text)
  const committed = slice.filter((b) => b.beat === "commit").pop()
  expect(committed.technique, "committed technique is the pinned transitions slot").toBe(pin.tech)

  // ── The exchange resolves (travel → forced success → debit) and the NEXT hand deals ──
  await j.nextHand(30000)

  const after = await page.evaluate(() => {
    const a = (window as any).__neural
    return {
      moveCount: a.moveCount,
      maxMoves: a.maxMoves,
      beltId: a._beltTest ? a._beltTest.beltId : null,
      opts: (a.optionIdxs || []).length,
    }
  })
  expect(after.moveCount, "the auto-picked exchange debits EXACTLY 1 move (enterSuccessCal :4537)").toBe(hand.moveCount + 1)
  expect(after.maxMoves, "authored budget itself untouched by the debit").toBe(WHITE.test.maxMoves)
  expect(after.beltId, "_beltTest STILL LIVE after the expiry exchange (clearEngagement :184 leaves it)").toBe(WHITE.id)
  expect(after.opts, "next test hand dealt — the same roll continues on the remaining budget").toBeGreaterThanOrEqual(1)

  // no verdict of any kind anywhere in the stream: the timeout spent a move, not the match
  const all = ((await j.beats()) as any[]).map((b) => b.beat)
  expect(all.filter((n) => n === "belt_test_lost").length, "zero belt_test_lost — expiry is not a loss").toBe(0)
  expect(all.filter((n) => n === "belt_test_won").length, "zero belt_test_won — one forced success is not the match").toBe(0)
  expect(all.filter((n) => n === "roll_end").length, "zero roll_end — the test roll is still in flight").toBe(0)
})
