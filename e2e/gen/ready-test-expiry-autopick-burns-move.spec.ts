/* @hyperspace {"theme":"unlock-economy","L":"belt-ready","F":"decision-timer","B":"keyboard-timing"} @invariant "Freezing during a live belt test costs the QUESTION, never a MOVE: letting the question clock expire narrates expiry_warning then land_q_expired (the -4% miss on this exchange), commits nothing for the player and leaves the moves-used counter where it was, with _beltTest still live and the hand still dealt; the player's own commit afterwards debits exactly 1." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { beltReady, CURRICULUM } from "./personas"

/**
 * READY TEST: EXPIRY BURNS THE QUESTION, NOT A MOVE — a belt-READY player starts the white
 * capstone and FREEZES on the very first test hand.
 *
 * INVERTED (gen-triage, v1.206.x) — the owner reversed this spec's claim on purpose. It was
 * written at v1.75.2 as "expiry auto-picks and the auto-picked exchange debits exactly 1 move".
 * v1.129.0 (7677bfe70) retired auto_pick; v1.133.0 (e6f655a6a) moved the clock off the hand and
 * onto the QUESTION. Owner: "Pressure should not be on the choices … when the clock runs out, the
 * algorithm doesn't choose for you. You still choose. … You get penalized if you don't click the
 * right answer or click 'Show' in time." So the move economy can no longer be spent BY the clock:
 *   - expiry reveals the question as a miss (land_q_expired, −4% on this exchange, combo break,
 *     failed SRS review) and the HAND STAYS LIVE — no commit, moveCount unchanged;
 *   - inaction is still no loophole: the test only advances on a commit, and the player's own
 *     commit pays the same price a move always paid — exactly 1 (enterSuccessCal: travel →
 *     moveCount++ → enterLand) — which this spec now proves on the same hand, after the expiry.
 * The archive (v1.129.0) records this file as one of the four that "any honest implementation of
 * the owner's request breaks"; this is the rewrite that entry deferred.
 *
 * SURFACE (also stale, fixed here): the capstone button lives in the pane's Challenges tab, and
 * `toggleExplorer()` opens the pane on its CURRENT tab (Explore by default), so the button was
 * never on screen (the red: "white capstone button rendered" → hidden). The spec opens the white
 * track the way
 * content-capstone.spec.ts does (challengeSelectedTrack → setViewMode("challenges") →
 * openExplorer → showExplorerList → the track card), and waits for the capstone hand with that
 * spec's awaitCapstoneHand idiom (the arrival can deal synchronously inside the start click).
 *
 * Mechanism (neural/src/app.src.jsx):
 *   - startBeltTest sets _beltTest BEFORE rollFromPosition (clearEngagement leaves it alone), then
 *     overrides the seeder's max-moves and the start role with the authored ones.
 *   - the landing deal builds `_decision {remaining:null,…}`; the question mount arms it
 *     (`_armLandClock` — the player is already engaged by j.land()); `_tickDecision` narrates
 *     expiry_warning at secLeft<=3 and `_expireLandQ` reveals the miss. Nothing calls pick().
 *
 * Determinism: the seeder's three ambient draws are re-rigged before the capstone click (land()'s
 * rigs are spent; "Mount" names neither role, so role IS drawn); the expiry path draws nothing;
 * the deliberate commit is a runtime-chosen TRANSITIONS option (a submission would enter its own
 * state) with resolve [0.01] (forced success) + outcome [0.01] — a success keeps the turn, so no
 * opponent draw (opp-*) is reachable before the next hand. Beat ORDER is asserted in the
 * post-baseline slice only; counters and ids derive from the served curriculum fixture.
 */

const WHITE: any = CURRICULUM.belts[0]
const AUTHORED_ROLE = ((WHITE.test?.startDeckKey || "").split("|")[1] || "").toLowerCase()

test("frozen belt-test hand: expiry_warning → land_q_expired narrated, ZERO moves debited and no commit, _beltTest survives — then a deliberate commit debits exactly 1", async ({ page }) => {
  // curriculum premises the economy math leans on — fail loudly here if the corpus shifts
  expect(WHITE.test, "white belt defines a test").toBeTruthy()
  expect(WHITE.test.maxMoves, "authored budget leaves headroom — one debit cannot exhaust it").toBeGreaterThanOrEqual(2)

  const j = journey(page)
  await j.boot("/", { initialState: beltReady() })
  await j.land("Mount Top") // engages: a journey that lands is simulating a playing user (v1.137.0)

  // Re-rig the belt-test roll seeder's ambient draws — land()'s rigs are spent, and
  // rollFromPosition redraws all three (role IS drawn: "Mount" names neither role).
  await j.rig("max-moves", [0.5])
  await j.rig("ai-skill", [0.5])
  await j.rig("role", [0])

  // ── Start the test from the capstone button in the Challenges view (content-capstone idiom) ──
  await page.evaluate((id) => {
    const a = (window as any).__neural
    a.settings.challengeSelectedTrack = id
    a.setViewMode("challenges")
    a.openExplorer()
    a.showExplorerList()
  }, WHITE.id)
  await page.locator(`.ng-track-card[data-track="${WHITE.id}"]`).click()
  const capBtn = page.locator(`[data-capstone="${WHITE.id}"] button`).first()
  await expect(capBtn, "white capstone button rendered").toBeVisible()
  expect(await capBtn.isDisabled(), "persona premise: capstone offered (ready, nothing won)").toBe(false)
  expect(await capBtn.textContent(), "persona premise: button reads Start capstone").toBe("Start capstone")
  await capBtn.click()
  await j.advanceUntil("belt_test_start", 20000)
  const started = ((await j.beats()) as any[]).filter((b) => b.beat === "belt_test_start").pop()
  expect(started.belt, "the started test is white's").toBe(WHITE.id)
  expect(started.maxMoves, "start beat carries the authored budget").toBe(WHITE.test.maxMoves)
  // awaitCapstoneHand (content-capstone.spec.ts): the hand may already be dealt by the click
  const dealtAlready = await page.evaluate(() => {
    const a = (window as any).__neural
    const start = a.beats.findLastIndex((b: any) => b.beat === "belt_test_start")
    return !!a._beltTest && start >= 0 && a.optionIdxs.length > 0 &&
      a.beats.slice(start + 1).some((b: any) => b.beat === "options_dealt")
  })
  if (dealtAlready) await j.landQuestion()
  else await j.nextHand(30000)

  // ── The test hand: live belt test, zero moves spent, its QUESTION on the clock ──
  const hand = await page.evaluate(() => {
    const a = (window as any).__neural
    const d = a._decision
    return {
      beltId: a._beltTest ? a._beltTest.beltId : null,
      moveCount: a.moveCount,
      maxMoves: a.maxMoves,
      role: a.playerRole,
      opts: (a.optionIdxs || []).length,
      asks: !!(a._mc && a._mc.surface === "land"),
      armed: !!d && d.remaining != null && d.total > 0, // the QUESTION's window, armed at its mount
      remaining: d && d.remaining != null ? d.remaining : 0,
    }
  })
  expect(hand.beltId, "_beltTest live at the first hand (survived rollFromPosition)").toBe(WHITE.id)
  expect(hand.moveCount, "moves-used baseline is zero").toBe(0)
  expect(hand.maxMoves, "authored budget overrides the seeder draw").toBe(WHITE.test.maxMoves)
  if (AUTHORED_ROLE) {
    expect(hand.role, "startDeckKey's authored role governs the test hand").toBe(AUTHORED_ROLE === "bottom" ? "bottom" : "top")
  }
  expect(hand.opts, "test hand dealt options").toBeGreaterThanOrEqual(1)
  expect(hand.asks, "the test hand's landing asks a question (beltReady's stage map is empty)").toBe(true)
  expect(hand.armed, "the question's window is armed").toBe(true)
  expect(hand.remaining, "window not yet drained").toBeGreaterThan(0)

  // ── FREEZE through the window; judge the narration in the post-baseline slice only ──
  const baseline = (await j.beats()).length
  await j.advanceUntil("expiry_warning", 30000, 400)
  await j.advanceUntil("land_q_expired", 10000, 250)
  const slice = ((await j.beats()) as any[]).slice(baseline)
  const names = slice.map((b) => b.beat)
  const iWarn = names.indexOf("expiry_warning")
  const iExp = names.indexOf("land_q_expired")
  expect(iWarn, "expiry_warning narrated on the frozen TEST hand").toBeGreaterThanOrEqual(0)
  expect(iExp, "the timeout is a named reveal (land_q_expired) — never a silent act").toBeGreaterThanOrEqual(0)
  expect(iWarn, "warning PRECEDES the reveal — the player was warned first").toBeLessThan(iExp)
  // warnings are structural {seconds} props in the final 3-2-1, never label text
  const warnSecs = slice.filter((b) => b.beat === "expiry_warning").map((b) => b.seconds)
  expect(warnSecs.length, "at least one countdown warning emitted").toBeGreaterThanOrEqual(1)
  for (const s of warnSecs) expect([1, 2, 3], "each warning counts down the final 3 seconds").toContain(s)
  expect(names.filter((n) => n === "commit").length, "the expiry committed NOTHING — the algorithm doesn't choose for you").toBe(0)
  expect(names, "the retired auto-pick never fires").not.toContain("auto_pick")

  const frozen = await page.evaluate(() => {
    const a = (window as any).__neural
    return {
      moveCount: a.moveCount,
      beltId: a._beltTest ? a._beltTest.beltId : null,
      opts: (a.optionIdxs || []).length,
      qMod: a._qMod || 0,
    }
  })
  expect(frozen.moveCount, "the expiry debits ZERO moves — it spends the question, not the budget").toBe(hand.moveCount)
  expect(frozen.qMod, "what it does cost: the −4% miss on this exchange").toBe(-0.04)
  expect(frozen.beltId, "_beltTest STILL LIVE after the expiry").toBe(WHITE.id)
  expect(frozen.opts, "the same test hand is still dealt — the player still chooses").toBe(hand.opts)

  // ── The player's OWN commit pays the move economy's price: exactly 1 ──
  const tech = await page.evaluate(() => {
    const a = (window as any).__neural
    for (const o of a.optionIdxs || []) {
      const n = a.nodes[typeof o === "number" ? o : o.idx]
      if (n && n.ty === "transitions") return n.t
    }
    return ""
  })
  expect(tech, "the test hand offers a positional transition to commit").not.toBe("")
  await j.rig("resolve", [0.01])
  await j.rig("outcome", [0.01])
  await j.pick(tech)
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
  expect(after.moveCount, "the player's own exchange debits EXACTLY 1 move (enterSuccessCal)").toBe(hand.moveCount + 1)
  expect(after.maxMoves, "authored budget itself untouched by the debit").toBe(WHITE.test.maxMoves)
  expect(after.beltId, "_beltTest STILL LIVE after the exchange (clearEngagement leaves it)").toBe(WHITE.id)
  expect(after.opts, "next test hand dealt — the same roll continues on the remaining budget").toBeGreaterThanOrEqual(1)

  // no verdict of any kind anywhere in the stream: the timeout cost a question, not the match
  const all = ((await j.beats()) as any[]).map((b) => b.beat)
  expect(all.filter((n) => n === "belt_test_lost").length, "zero belt_test_lost — expiry is not a loss").toBe(0)
  expect(all.filter((n) => n === "belt_test_won").length, "zero belt_test_won — one forced success is not the match").toBe(0)
  expect(all.filter((n) => n === "roll_end").length, "zero roll_end — the test roll is still in flight").toBe(0)
})
