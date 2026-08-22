/* @hyperspace {"theme":"unlock-economy","L":"white-belt-holder","F":"defense-panic","B":"cross-feature"} @invariant "Panic-drill grading and lesson drilling share one prep ledger: grading the panic card during a caught defense increments prep[escape deckKey] by exactly 1 and cardsToday by exactly 1 alongside escape_odds_pumped — defense reps are real study credit, not a parallel currency." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { whiteBeltHolder } from "./personas"

/**
 * PANIC GRADE = STUDY CREDIT — defense drilling is not a parallel currency. The
 * [data-panic-got] handler (neural/src/app.src.jsx ~4014-4024) routes through the SAME
 * ledger lesson drilling uses: prep[panicKey] += 1, then noteCardDone(card, panicKey),
 * then fx("escape_odds_pumped"). noteCardDone (~840-853) is the shared choke point: a
 * first-time question bumps _days[todayKey] → cardsToday and fires bonus_pumped (the
 * routing proof), while its cross-variant credit loop (~870) SKIPS the local key — so
 * prep[panicKey] moves by EXACTLY 1, never double-counted.
 *
 * whiteBeltHolder seeds days:{} — cardsToday boots at 0 and _days is empty, which makes
 * "after the grade, _days holds ONLY today's key" a meaningful shape assertion.
 *
 * Determinism census: resolve/outcome/opp-finish/opp-sub-pick/escape rigged here with
 * pre-sized one-draw queues; land() rigs ai-skill/role/max-moves; hands deal with no
 * RNG. resolve 0.99 > the 0.95 moveChance clamp (our move always fails); opp-finish
 * 0.01 < the 0.18 pFinish floor when subs exist (opponent always goes for the kill);
 * escape 0.01 < the 0.08 escapeChance floor (the escape always lands).
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
  await j.pick(options[0])
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

  // ── grade the panic card like a user: Reveal → Got it ──
  await page.locator("[data-panic-reveal]").click()
  await page.locator("[data-panic-got]").click()

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
