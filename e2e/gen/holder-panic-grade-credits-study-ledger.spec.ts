/* @hyperspace {"theme":"unlock-economy","L":"white-belt-holder","F":"defense-panic","B":"cross-feature"} @invariant "Panic-drill grading and lesson drilling share one prep ledger: grading the panic card during a caught defense increments prep[escape deckKey] by exactly 1 and cardsToday by exactly 1 alongside escape_odds_pumped — defense reps are real study credit, not a parallel currency." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { whiteBeltHolder } from "./personas"

/**
 * PANIC GRADE = STUDY CREDIT — defense drilling is not a parallel currency. Grading the drill
 * (`buildPanicCard`, neural/src/app.src.jsx — cited by symbol; the ~line numbers this header
 * carried had drifted ~11,000 lines) routes through the SAME ledger lesson drilling uses:
 * prep[panicKey] += 1, then noteCardDone(card, panicKey), then fx("escape_odds_pumped").
 * Since v1.135.0 (0c4fbc53d) the drill is MULTIPLE CHOICE when its pool is warm, and the
 * credit is `_mcAnswer`'s correct branch (prep +1 → noteCardDone → panic's `done(true)` →
 * escape_odds_pumped); the [data-panic-got] handler does the same three steps as the
 * cold-pool fallback. `noteCardDone` is the shared choke point: a first-time question bumps
 * _days[todayKey] → cardsToday and fires bonus_pumped (the routing proof), while its
 * cross-variant credit loop SKIPS the local key — so prep[panicKey] moves by EXACTLY 1,
 * never double-counted.
 *
 * whiteBeltHolder seeds days:{} — cardsToday boots at 0 and _days is empty, which makes
 * "after the grade, _days holds ONLY today's key" a meaningful shape assertion.
 *
 * HOW THE CATCH IS REACHED (re-targeted 2026-10-01, gen-suite triage): since v1.176.0
 * (cdc35cefe, "Give submission states their own choices") picking a SUBMISSION card only
 * ENTERS its state (deterministic travel, no resolve draw — nothing fails, the opponent never
 * moves). Mount Top's EDGE-ranked hand leads with one today (Americana from Mount), so the
 * rigged fail lands on its "Finish" card, the second pick of the same title — the idiom the
 * core journeys restart-hygiene / panic-drill-defender-deck adopted in that commit.
 *
 * Determinism census: resolve/outcome/opp-finish/opp-sub-pick/escape rigged here with
 * pre-sized one-draw queues, all consumed (measured: every queue empty at the catch);
 * land() rigs ai-skill/role/max-moves. resolve 0.99 > the 0.95 moveChance clamp (the Finish
 * always fails); outcome 0.99 draws the last cell of the failure branch (the counter →
 * closed-guard/bottom); opp-finish 0.01 < the 0.18 pFinish floor when subs exist (opponent
 * always goes for the kill); opp-sub-pick 0.01 pins which (measured: Ezekiel Choke from
 * Closed Guard); escape 0.01 < the 0.08 escapeChance floor (the escape always lands). The
 * panic MC's own `panic-mc-pick` / `panic-mc-shuffle` draws stay unrigged on purpose: the
 * spec reads the answer from `_mc.correct`, and every card is first-time for this persona,
 * so which card and which order cannot change a ledger number.
 */

test("caught → panic grade credits the shared study ledger (prep +1, cardsToday +1) and pumps escape odds", async ({ page }) => {
  const j = journey(page)
  await j.boot("/", { initialState: whiteBeltHolder() })
  await j.land("Mount Top")

  // ── get CAUGHT deterministically: our move fails, the opponent finishes ──
  const options = await j.optionTitles()
  await j.rig("resolve", [0.99])
  await j.rig("outcome", [0.99])
  await j.rig("opp-finish", [0.01])
  await j.rig("opp-sub-pick", [0.01])
  const firstIsSub = await page.evaluate(
    (t) => ((window as any).__neural.nodes.find((n: any) => n.t === t) || {}).ty === "submissions",
    options[0],
  )
  await j.pick(options[0])
  if (firstIsSub) {
    // v1.176.0: the first pick ENTERS the submission state; the rigged fail is its Finish
    await j.advance(3000)
    await j.pick(options[0])
  }
  await j.advanceUntil("caught", 20000)

  // panic surface up; the opened beat names the SAME deck the ledger is about to credit
  await expect(page.locator("[data-panic]"), "inline panic drill visible when caught").toBeVisible()
  const pk: string = await page.evaluate(() => (window as any).__neural._panicKey)
  expect(pk, "panic drill resolved a real deck key").toBeTruthy()
  const opened = (await j.beats()).filter((b: any) => b.beat === "panic_drill_opened") as any[]
  expect(opened.length, "one defense → one panic_drill_opened").toBe(1)
  expect(opened[0].deck_key, "opened beat names the credited deck").toBe(pk)

  // ── ledger snapshot BEFORE the grade (pk pinned: both reads use the same key) ──
  const before = await page.evaluate((k: string) => {
    const a = (window as any).__neural
    return {
      prep: a.prep[k] || 0,
      cardsToday: a.cardsToday || 0,
      bonus: (a.beats || []).filter((b: any) => b.beat === "bonus_pumped").length,
      esc: a.escapeOddsSnapshot(),
    }
  }, pk)
  expect(before.cardsToday, "whiteBeltHolder daily ledger starts clean").toBe(0)

  // ── grade the panic card like a user. v1.135.0 (0c4fbc53d): the drill is MULTIPLE CHOICE
  //    when its distractor pool is warm (surface "panic", [data-panic-mc-opt]); Reveal → Got it
  //    survives only as the cold-pool fallback. Both grade through the SAME ledger choke — the
  //    MC path via _mcAnswer (prep +1, noteCardDone), the fallback via its own prep +1 +
  //    noteCardDone — so the claim below is path-independent. Same idiom as the core journeys
  //    guidance-defense / panic-card adopted in that commit. ──
  const mcCorrect = await page.evaluate(() => {
    const a = (window as any).__neural
    const card = document.querySelector("[data-panic]")
    return card && card.querySelector("[data-panic-mc-opt]") && a._mc && a._mc.surface === "panic"
      ? a._mc.correct
      : null
  })
  if (mcCorrect != null) {
    await page.locator(`[data-panic-mc-opt="${mcCorrect}"]`).click()
  } else {
    await page.locator("[data-panic-reveal]").click()
    await page.locator("[data-panic-got]").click()
  }

  // AFTER-snapshot NOW — _panicKey survives grading but dies on pick/finish, and
  // escapeOddsSnapshot needs the live defense (_defendSub/_optList) to read at all
  const after = await page.evaluate((k: string) => {
    const a = (window as any).__neural
    const beats = a.beats || []
    const bonus = beats.filter((b: any) => b.beat === "bonus_pumped")
    const pumped = beats.filter((b: any) => b.beat === "escape_odds_pumped")
    return {
      prep: a.prep[k] || 0,
      cardsToday: a.cardsToday || 0,
      bonus: bonus.length,
      bonusDeck: bonus.length ? bonus[bonus.length - 1].deck_key : null,
      pumped: pumped.length,
      pumpedDeck: pumped.length ? pumped[pumped.length - 1].deck_key : null,
      esc: a.escapeOddsSnapshot(),
      dayKeys: Object.keys(a._days || {}),
      today: a._dayKey(),
      todayCount: (a._days || {})[a._dayKey()] || 0,
    }
  }, pk)

  // ── THE INVARIANT: one shared ledger, exact unit credit ──
  expect(after.prep, "prep[panicKey] +1 exactly (cross-variant loop skips the local key)").toBe(before.prep + 1)
  expect(after.cardsToday, "cardsToday +1 exactly — a defense rep IS a study rep").toBe(before.cardsToday + 1)
  expect(after.bonus, "bonus_pumped fired once — the grade routed through noteCardDone").toBe(before.bonus + 1)
  expect(after.bonusDeck, "noteCardDone credited the panic deck").toBe(pk)
  expect(after.dayKeys, "_days holds exactly today's key").toEqual([after.today])
  expect(after.todayCount, "daily ledger agrees with cardsToday").toBe(after.cardsToday)
  expect(after.pumped, "one grade → one escape_odds_pumped").toBe(1)
  expect(after.pumpedDeck, "odds pump names the same deck").toBe(pk)
  expect(after.esc, "escape odds strictly increased").toBeGreaterThan(before.esc)

  // ── roll coherence tail: the pumped escape is LIVE — take it, tension resolves.
  // pickFirstEscape() is the documented internal for the escape tray (same pattern
  // as guidance-defense.spec.ts). ──
  await j.rig("escape", [0.01])
  await page.evaluate(() => (window as any).__neural.pickFirstEscape())
  await j.advanceUntil("relief", 12000)
  await j.expectBeat("escape")
})
