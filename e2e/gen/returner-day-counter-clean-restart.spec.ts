/* @hyperspace {"theme":"lifetime-journeys","L":"lapsed-returner","F":"drill-mc","B":"economy-math"} @invariant "After a lapse (empty days map) the daily counter restarts from a clean zero: cardsToday is 0 at boot, the first graded card makes it exactly 1, and the _days map contains only today's key — no stale day contaminates the comeback session." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { lapsedReturner, CURRICULUM } from "./personas"

/**
 * RETURNER DAY-COUNTER CLEAN RESTART — a lapsed white-belt holder comes back and the daily
 * economy must restart honestly: zero at boot (empty days map, not just a vacuous 0), the
 * first graded card mints EXACTLY 1, and _days never grows a second key mid-session.
 *
 * Mechanism under test (neural/src/app.src.jsx):
 *   - _loadProgress ingests the persona's days:{} → cardsToday = _days[today] || 0 (:1100).
 *   - noteCardDone (:844-848) is the ONLY counter writer: first credit per QUESTION TEXT
 *     bumps _days[_dayKey()] + cardsToday and fires bonus_pumped; the session cardDone Set
 *     dedupes repeats. Blended-hierarchy cards are DUPLICATED across decks, so the MC card
 *     must not share q with the drill targets — guarded below, not assumed.
 *   - j.drill(n) grades the CURRENT position deck's cards[0..n-1]; after land("Mount Top")
 *     that is the Mount Top deck (deckKeyFor(nodes[currentPos]).key).
 *
 * Persona validity: a silently-fresh visitor also boots with cardsToday 0, so the boot read
 * first proves the returner's career actually seeded (belts.won + prep). Done lessons keep
 * their openLessonStudy handler, so lesson 1 reopens for the MC surface. land() rigs the
 * intro's ambient draws (ai-skill/role/max-moves) itself; no other RNG site is touched.
 *
 * v1.70 re-validation: the seed sets settings.mcMode="auto" — v1.68 flipped the sidebar
 * answer-mode default auto→classic ("nobody meets multiple choice in the sidebar unless
 * they opt in"), so under the new default renderDrill builds the recall footer and never
 * sets _mc, killing the MC truth-rail leg. "auto" restores the authored-era surface (MC
 * until a card graduates; the persona's stage map is empty, so every card presents as MC).
 * settings.landQuestions=false keeps the v1.68 landing question (and its unrigged
 * land-mc-* draws) out of the run — it is never answered, so the counters were safe, but
 * off-at-the-source keeps "no other RNG site is touched" true.
 */

const WHITE: any = CURRICULUM.belts[0]
const LESSON1: any = WHITE.units[0].lessons[0]

test("lapsed returner: daily counter restarts clean — 0 at boot, MC correct → 1, +2 drills → 3, _days single-key throughout", async ({ page }) => {
  const j = journey(page)
  const blob: any = lapsedReturner()
  // v1.70: restore the authored-era sidebar MC (default flipped auto→classic in v1.68) and
  // turn the v1.68 landing question off at the source (see header)
  blob.settings = { mcMode: "auto", landQuestions: false }
  await j.boot("/", { initialState: blob })
  await j.land("Mount Top")

  // ── clean zero at boot, with the probe-validity guard ──
  const boot = await page.evaluate((whiteId) => {
    const a = (window as any).__neural
    return {
      cardsToday: a.cardsToday,
      dayKeys: Object.keys(a._days || {}),
      wonWhite: !!(a.belts && a.belts.won && a.belts.won[whiteId as string]),
      prepDecks: Object.keys(a.prep || {}).length,
    }
  }, WHITE.id)
  expect(boot.wonWhite, `persona ingested: belts.won["${WHITE.id}"] present (guards against a silently-fresh boot)`).toBe(true)
  expect(boot.prepDecks, "persona ingested: prep carries the returner's drilled decks").toBeGreaterThan(0)
  expect(boot.cardsToday, "comeback boots at a clean zero").toBe(0)
  expect(boot.dayKeys, "days map is EMPTY at boot — no stale day survived the lapse").toEqual([])

  // ── dedup guard: noteCardDone credits once per question text, and j.drill(2) will grade
  //    the Mount Top deck's cards[0]/[1] — read those questions UP FRONT so the MC pick
  //    below can avoid them, and prove the two drill targets mint separate credits. ──
  const drillQs: string[] = await page.evaluate(() => {
    const a = (window as any).__neural
    const key = a.deckKeyFor(a.nodes[a.currentPos]).key
    return (a.flashcards.decks[key].cards || []).slice(0, 2).map((c: any) => c.q)
  })
  expect(drillQs.length, "current-position drill deck has at least 2 cards").toBe(2)
  expect(drillQs[0], "the two drill targets are distinct questions").not.toBe(drillQs[1])

  // ── first graded card of the comeback, through the REAL MC surface (study-story rail) ──
  await page.evaluate(() => (window as any).__neural.toggleExplorer())
  await page.locator(`[data-lesson="${LESSON1.deckKey}"]`).first().click()
  await j.advance(1000)
  expect(await page.evaluate(() => !!(window as any).__neural.deckOpen), "done lesson 1 reopens for study").toBe(true)

  const qh = await page.evaluate((skip) => {
    const a = (window as any).__neural
    for (const c of a.deck || []) {
      if (a.mcClip(c.a) && !(skip as string[]).includes(c.q)) {
        a.presentCard(a.qhash(c.q))
        return a.qhash(c.q)
      }
    }
    return null
  }, drillQs)
  expect(qh, "an MC-stage card outside the drill-target questions exists in lesson 1").toBeTruthy()
  const mc = await page.evaluate(() => (window as any).__neural._mc)
  expect(mc, "MC truth rail live for the presented card").toBeTruthy()
  await page.locator("[data-mc-opt]").nth(mc.correct).click() // truth-rail index: option order can't flake
  await j.expectBeat("mc_correct")
  await j.expectBeat("bonus_pumped")

  const afterFirst = await page.evaluate(() => {
    const a = (window as any).__neural
    return { cardsToday: a.cardsToday, dayKeys: Object.keys(a._days || {}), today: a._dayKey() }
  })
  expect(afterFirst.cardsToday, "first graded card makes the counter EXACTLY 1").toBe(1)
  expect(afterFirst.dayKeys, "days map holds ONLY today's key after the first credit").toEqual([afterFirst.today])

  // ── two more distinct cards through the drill rail (default deck = current position) ──
  await j.drill(2)
  const final = await page.evaluate(() => {
    const a = (window as any).__neural
    const today = a._dayKey()
    return {
      cardsToday: a.cardsToday,
      dayKeys: Object.keys(a._days || {}),
      today,
      todayCount: (a._days || {})[today] ?? 0,
    }
  })
  expect(final.cardsToday, "counter is honest across surfaces: 1 MC + 2 drill = 3").toBe(3)
  expect(final.dayKeys, "STILL exactly one day key — the comeback session never grows stale days").toEqual([final.today])
  expect(final.todayCount, "_days[today] mirrors cardsToday exactly").toBe(3)

  // economy tie-down: bonus_pumped is emitted ONLY in noteCardDone's credit block — one per
  // counted card, none for dedup repeats — so the beat ledger must equal the counter.
  const pumped = (await j.beats()).filter((b) => b.beat === "bonus_pumped").length
  expect(pumped, "exactly one bonus_pumped beat per counted card").toBe(3)
})
