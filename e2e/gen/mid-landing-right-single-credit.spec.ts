/* @hyperspace {"theme":"momentum-and-economy","L":"curriculum-mid","F":"boot-landing","B":"economy-math"} @invariant "A correct landing answer earns exactly the ordinary study credit and nothing more: at ×1 (momentumMod still 0) the option's moveChance delta equals the stateBonus delta produced by that single noteCardDone credit, and cardsToday increments by exactly 1." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { curriculumMid } from "./personas"

/**
 * RIGHT ANSWER = ORDINARY CREDIT, NOTHING MORE — the economy's "one rule on both surfaces"
 * claim, proven as float-exact ledger math (app.src.jsx, line-verified):
 *
 *   correct landing MC → _mcAnswer (:3641-3645): _bumpStage (cap 2) + prep[key]++ +
 *   noteCardDone (bumpSharp +0.10 flat; cardsToday++ ONCE per distinct q via the cardDone
 *   dedup set; one bonus_pumped beat) → onDone → _landAnswered (:4303): adds ONLY
 *   refundDecision(2500) + _comboUp — no odds mutation of its own.
 *
 *   moveChance (:4942) = base + stateBonus(_posKey) + stateBonus(ownDeck) + _qMod
 *   + momentumMod, and momentumMod at ×1 is exactly 0 (:4331 — tiers start at ×2).
 *
 * So the ENTIRE odds movement from a correct answer must be the stateBonus delta of the
 * position deck the question belongs to — no landing bonus stacked on top, no combo heat
 * at ×1, no cross-deck leak into the option's own deck. A hypothetical second credit path
 * (e.g. _landAnswered nudging odds directly) would break dMc === dSb at 6 decimal places.
 *
 * Persona seam: under curriculumMid the Mount|Top deck sits in the LOCKED TAIL (unit 3+),
 * so prep["Mount|Top"] === 0 and stateBonus starts at exactly 0 — the single credit is
 * fully visible (mastery 0→.03 + sharpness 0→.10). stage:{} is empty, so questionFor's
 * cardStage<2 gate guarantees the landing asks. Key alignment is asserted, not assumed:
 * _landQ.key === deckKeyFor(currentPos).key === _posKey (all set by enterLand :4847).
 *
 * Determinism census: land-mc-pick/land-mc-shuffle rigged with PRE-SIZED queues BEFORE
 * land() (the block renders during land's pump, at coach handover); land()'s built-ins
 * cover ai-skill/role/max-moves. The answer index is READ from the __neural._mc truth
 * closure ({correct, surface:"land"}) and pressed by keyboard ("abcd"[correct]) — never
 * guessed, never matched by text. Odds are read RAW via a.moveChance(node): displayedOdds
 * rounds to integer % and would destroy 6-place equality. The measured option is the first
 * with raw mc in [0.20, 0.70] (deterministically mid-band, so the ±0.13 swing can never
 * touch the 0.05/0.95 clamps and corrupt the delta). No commit happens — zero
 * resolve/outcome draws exist. decaySharp only runs on later arrivals (:4801), so the
 * post-answer advance(600) settle read is drift-free by construction.
 *
 * Red-proof seams (probe-verified — two identical green runs, deltas exact to the float):
 * a wrong answer instead fails at correct/combo/qMod; any extra credit or leak fails
 * toBeCloseTo(dSb, 6), the sbOwn identity, or the exactly-one cardsToday/bonus_pumped counts.
 */

test("a correct landing answer moves the odds by exactly its own study credit — dMc === dSb to 6 places, cardsToday +1, no leak, no ×1 heat", async ({ page }) => {
  const j = journey(page)
  await j.boot("/", { initialState: curriculumMid() })

  // land-scoped MC rig BEFORE land(): pre-sized queues (distractor pool picks + option
  // shuffle) — the land surface draws these tags only, never the sidebar's mc-* queues
  await j.rig("land-mc-pick", [
    0.03, 0.11, 0.19, 0.27, 0.35, 0.43, 0.51, 0.59, 0.67, 0.75,
    0.83, 0.91, 0.07, 0.15, 0.23, 0.31, 0.39, 0.47, 0.55, 0.63,
    0.71, 0.79, 0.87, 0.95, 0.05, 0.13, 0.21, 0.29, 0.37, 0.45,
    0.53, 0.61, 0.69, 0.77, 0.85, 0.93, 0.09, 0.17, 0.25, 0.33,
  ])
  await j.rig("land-mc-shuffle", [0.2, 0.5, 0.8, 0.35, 0.65, 0.95, 0.14, 0.42])
  await j.land("Mount Top")

  // ── the table is set: question live, seams aligned, ledgers zeroed ──
  await expect(page.locator("[data-landcard]"), "landing card docked above the hand").toBeVisible()
  await expect(page.locator("[data-land-q]"), "empty stage map → an unproven card asks").toBeVisible()
  await j.expectBeat("land_q_shown")

  const pre = await page.evaluate(() => {
    const a = (window as any).__neural
    const posKey = a._posKey
    // deterministic mid-band pick: FIRST option whose RAW moveChance sits in [0.20, 0.70]
    let idx = -1
    for (const o of a.optionIdxs || []) {
      const i = typeof o === "number" ? o : o.idx
      const raw = a.moveChance(a.nodes[i])
      if (raw >= 0.2 && raw <= 0.7) { idx = i; break }
    }
    const ownKey = idx >= 0 ? a.deckKeyFor(a.nodes[idx]).key : null
    return {
      idx,
      ownKey,
      posKey,
      landKey: a._landQ ? a._landQ.key : null,
      curKey: a.deckKeyFor(a.nodes[a.currentPos]).key,
      prepPos: (a.prep && a.prep[posKey]) || 0,
      sbPos: a.stateBonus(posKey),
      sbOwn: ownKey ? a.stateBonus(ownKey) : -1,
      mc: idx >= 0 ? a.moveChance(a.nodes[idx]) : -1, // RAW — rounding kills 6-place equality
      qMod: a._qMod || 0,
      momentum: a.momentumMod(),
      combo: a._combo || 0,
      cardsToday: a.cardsToday || 0,
      pumped: (a.beats || []).filter((b: any) => b.beat === "bonus_pumped").length,
    }
  })
  expect(pre.idx, "a mid-band option exists (raw mc in [0.20,0.70] — clamp-safe)").toBeGreaterThanOrEqual(0)
  expect(pre.landKey, "the question belongs to the state you landed on (_landQ.key === _posKey)").toBe(pre.posKey)
  expect(pre.curKey, "and deckKeyFor(currentPos) names the same deck — one ledger, three seams").toBe(pre.posKey)
  expect(pre.ownKey, "the option's own deck is a DIFFERENT ledger — the leak assert means something").not.toBe(pre.posKey)
  expect(pre.prepPos, "curriculumMid's locked tail: the landing deck is ungraded").toBe(0)
  expect(pre.sbPos, "so its stateBonus starts at exactly 0 — the credit will be fully visible").toBe(0)
  expect(pre.qMod, "no exchange penalty on a fresh arrival").toBe(0)
  expect(pre.combo, "the streak is cold before the answer").toBe(0)
  expect(pre.momentum, "and momentum contributes nothing").toBe(0)

  // ── answer RIGHT via keyboard — the truth lives in the _mc closure, never the DOM ──
  const mc = await page.evaluate(() => {
    const m = (window as any).__neural._mc
    return m && m.surface === "land" && typeof m.correct === "number" ? m.correct : -1
  })
  expect(mc, "live land-surface MC block with a known correct index").toBeGreaterThanOrEqual(0)
  await page.keyboard.press("abcd"[mc])

  // ── the ledger after: one credit, everywhere it should be and nowhere it shouldn't ──
  const post = await page.evaluate((idx) => {
    const a = (window as any).__neural
    const posKey = a._posKey
    const ownKey = a.deckKeyFor(a.nodes[idx as number]).key
    return {
      prepPos: (a.prep && a.prep[posKey]) || 0,
      sbPos: a.stateBonus(posKey),
      sbOwn: a.stateBonus(ownKey),
      mc: a.moveChance(a.nodes[idx as number]),
      qMod: a._qMod || 0,
      momentum: a.momentumMod(),
      combo: a._combo || 0,
      cardsToday: a.cardsToday || 0,
      pumped: (a.beats || []).filter((b: any) => b.beat === "bonus_pumped").length,
      answered: (a.beats || []).filter((b: any) => b.beat === "land_q_answered"),
    }
  }, pre.idx)

  // exactly one answer beat, and it carries the ×1 economy: correct, combo 1, qMod 0
  expect(post.answered.length, "exactly one land_q_answered in the whole journey").toBe(1)
  expect((post.answered[0] as any).correct, "and it was correct").toBe(true)
  expect((post.answered[0] as any).combo, "the streak rose to ×1").toBe(1)
  expect((post.answered[0] as any).qMod, "a right answer charges no exchange penalty").toBe(0)
  expect(post.combo, "live combo agrees with the beat").toBe(1)
  expect(post.momentum, "×1 is below the tiers — momentumMod is still exactly 0").toBe(0)
  expect(post.qMod, "_qMod untouched").toBe(0)

  // THE INVARIANT: the odds moved by exactly the study credit — nothing more, nothing less.
  // dSb is COMPUTED from measured before/after (never hardcoded — the mastery term varies
  // with prior prep and its 0.15 cap); here it is the single noteCardDone credit's worth.
  expect(post.prepPos, "one credit: prep went 0 → 1 on the landing deck").toBe(1)
  const dSb = post.sbPos - pre.sbPos
  expect(dSb, "the credit is real — stateBonus rose").toBeGreaterThan(0)
  expect(post.mc - pre.mc, "moveChance delta === stateBonus delta, exact to the float").toBeCloseTo(dSb, 6)

  // and nowhere else: the option's OWN deck ledger is bit-identical (no cross-deck leak)
  expect(post.sbOwn, "the option's own deck earned nothing from the landing answer").toBe(pre.sbOwn)

  // the daily counter and the pump beat each moved by exactly one (cardDone dedup held)
  expect(post.cardsToday - pre.cardsToday, "cardsToday incremented by exactly 1").toBe(1)
  expect(post.pumped - pre.pumped, "exactly one bonus_pumped beat for the one distinct card").toBe(1)

  // ── settle: no delayed second credit hiding behind a timer ──
  await j.advance(600)
  const settle = await page.evaluate((idx) => {
    const a = (window as any).__neural
    return {
      mc: a.moveChance(a.nodes[idx as number]),
      cardsToday: a.cardsToday || 0,
      pumped: (a.beats || []).filter((b: any) => b.beat === "bonus_pumped").length,
      answered: (a.beats || []).filter((b: any) => b.beat === "land_q_answered").length,
      combo: a._combo || 0,
    }
  }, pre.idx)
  expect(settle.mc, "odds are stable — no delayed pump").toBeCloseTo(post.mc, 6)
  expect(settle.cardsToday, "still exactly one card today").toBe(post.cardsToday)
  expect(settle.pumped, "still exactly one bonus_pumped").toBe(post.pumped)
  expect(settle.answered, "still exactly one answer beat").toBe(1)
  expect(settle.combo, "the ×1 streak holds while the hand is live").toBe(1)
})
