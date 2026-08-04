/* @hyperspace {"theme":"challenge-progression","L":"curriculum-mid","F":"checkpoint-quiz","B":"reward-integrity"}
   @invariant "The Clean Checkpoint patch honors its authored meaning — a failed checkpoint sitting mints nothing, and a later pass that is neither a first attempt nor a perfect run (post-fail retake, exactly the pass bar) mints nothing either: patch_earned{clean-checkpoint} stays absent across the whole fail-then-scrape-by arc while the pass itself still registers on the unit ledger." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { curriculumMid, CURRICULUM } from "../gen/personas"

/**
 * QUARANTINED RED — Q004.
 *
 * The clean-checkpoint patch is authored as "Pass a checkpoint on the first try"
 * (challenge-definitions.src.js:337) but its when-predicate `(p) => !!p.firstTry` is
 * VACUOUS: the checkpoint_passed beat's `firstTry` is the COUNT of cards answered
 * correctly on first presentation (app.src.jsx:3706), and any pass has
 * firstTry >= pass >= 1 (app.src.jsx:3710) — so the predicate is true on EVERY pass.
 * The badge is effectively "pass any checkpoint, ever": a player who bombs the quiz,
 * retakes it, and scrapes by at exactly the bar (5/6) still mints "Clean Checkpoint".
 *
 * This spec plays that arc and asserts the authored meaning. The retake pass is
 * deliberately NON-perfect (exactly CP.pass correct, the rest wrong), so the spec goes
 * green under EITHER faithful fix shape:
 *   - attempt-level ("first sitting of this unit's quiz"): retake → no mint;
 *   - perfect-run ("clean" = firstTry === of): 5/6 → no mint.
 * Today it is red at the final zero-mint asserts (probe: patch_earned{clean-checkpoint}
 * fires one beat after checkpoint_passed{firstTry:5,of:6} on the retake).
 */

const WHITE = CURRICULUM.belts[0]
const UNIT2 = WHITE.units[1]
const UK2 = `${WHITE.id}/${UNIT2.id}`
const CP = UNIT2.checkpoint // {cards:6, pass:5} at authoring
const SEEDED_N = Math.ceil(UNIT2.lessons.length / 2)
const COMPLEMENT: string[] = UNIT2.lessons.slice(SEEDED_N).map((l: any) => l.deckKey)

/** deterministic rig-queue filler (LCG) — pre-sized, never Math.random */
const seq = (seed: number, n: number): number[] => {
  const out: number[] = []
  let s = seed >>> 0
  for (let i = 0; i < n; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    out.push(s / 4294967296)
  }
  return out
}

/** census of the clean-checkpoint reward surface, scoped to the one badge under test
 *  (the DSL's tutorial pre-complete legitimately mints white-foundations — ignore it) */
const cleanCheckpointState = (page: any) =>
  page.evaluate(() => {
    const a = (window as any).__neural
    const beats = (a.beats || []) as any[]
    return {
      mints: beats.filter((b) => b.beat === "patch_earned" && b.id === "clean-checkpoint").length,
      fails: beats.filter((b) => b.beat === "checkpoint_failed").length,
      passes: beats.filter((b) => b.beat === "checkpoint_passed").map((b: any) => ({ unit: b.unit, firstTry: b.firstTry, of: b.of })),
      badged: Object.prototype.hasOwnProperty.call(a.badges || {}, "clean-checkpoint"),
      storedBadged: Object.prototype.hasOwnProperty.call(
        (JSON.parse(localStorage.getItem("bjj-neural-progress") || "{}").badges) || {},
        "clean-checkpoint",
      ),
    }
  })

test("a post-fail, non-perfect retake pass never mints the Clean Checkpoint patch", async ({ page }) => {
  // curriculum facts the arc leans on — fail loudly here if the corpus shifts
  expect(CP && CP.cards, "unit 2 defines a checkpoint quiz").toBeGreaterThan(0)
  expect(CP.pass, "all-wrong is guaranteed to fail").toBeGreaterThanOrEqual(1)
  expect(CP.pass, "a pass at exactly the bar leaves at least one wrong — the retake is non-perfect").toBeLessThan(CP.cards)
  expect(COMPLEMENT.length, "curriculumMid leaves a back half of unit 2 undrilled").toBeGreaterThan(0)

  const j = journey(page)
  const seed: any = curriculumMid()
  seed.settings.landQuestions = false // keep mc_* scoped to the checkpoint sittings
  await j.boot("/", { initialState: seed })
  await j.land("Mount Top")

  // drill unit-2's undrilled back half to goal — arms the checkpoint gate
  for (const key of COMPLEMENT) await j.drill(3, key)

  const openGroup = () =>
    page
      .locator(`.ng-challenge-group:has([data-checkpoint="${UK2}"])`)
      .first()
      .evaluate((el) => ((el as HTMLDetailsElement).open = true))
  const sitCheckpoint = async (rigSeed: number) => {
    await j.rig("checkpoint-pick", seq(rigSeed, 10))
    await j.rig("mc-pick", seq(rigSeed + 1, 500))
    await j.rig("mc-shuffle", seq(rigSeed + 2, 150))
    await page.evaluate(() => (window as any).__neural.toggleExplorer())
    await expect(page.locator("[data-view]").first()).toBeVisible()
    await openGroup()
    await page.locator(`[data-checkpoint="${UK2}"]`).first().click()
    await j.advance(400)
  }
  /** answer the live quiz card via the real MC buttons — correct or deliberately wrong */
  const answerCard = async (label: string, correct: boolean) => {
    const mc = await page.evaluate(() => {
      const m = (window as any).__neural._mc
      return m ? { correct: m.correct, opts: m.tiers.length } : null
    })
    expect(mc, `${label} presented as MC`).toBeTruthy()
    await page.locator("[data-mc-opt]").nth(correct ? mc!.correct : (mc!.correct + 1) % mc!.opts).click()
    await j.advance(700)
  }

  // ── SITTING 1: bomb every card — the fail side must mint NOTHING ──
  await sitCheckpoint(11)
  await j.expectBeat("checkpoint_start")
  for (let i = 0; i < CP.cards; i++) await answerCard(`sitting-1 card ${i + 1}`, false)

  const afterFail = await cleanCheckpointState(page)
  expect(afterFail.fails, "sitting 1 failed").toBe(1)
  expect(afterFail.passes.length, "no pass yet").toBe(0)
  expect(afterFail.mints, "a failed sitting mints nothing — patch never rides checkpoint_failed").toBe(0)
  expect(afterFail.badged, "no clean-checkpoint badge after the fail").toBe(false)

  // ── SITTING 2 (retake): pass at EXACTLY the bar — correct for the first CP.pass cards,
  //    wrong for the rest. A legitimate pass, but neither a first attempt nor a clean run. ──
  await sitCheckpoint(41)
  for (let i = 0; i < CP.cards; i++) await answerCard(`sitting-2 card ${i + 1}`, i < CP.pass)

  const after = await cleanCheckpointState(page)
  expect(after.passes.length, "the retake passed").toBe(1)
  expect(after.passes[0].unit, "pass credits unit 2").toBe(UK2)
  expect(after.passes[0].firstTry, "scrape-by: exactly the bar, not a perfect run").toBe(CP.pass)
  expect(after.passes[0].of, "pass beat carries the quiz size").toBe(CP.cards)
  expect(
    await page.evaluate((uk) => !!((window as any).__neural.units || {})[uk], UK2),
    "the pass itself registers on the unit ledger — only the patch is under test",
  ).toBe(true)

  // ── THE RED CORE: the authored "first try" patch must not mint on this arc ──
  expect(after.mints, "post-fail retake pass mints no clean-checkpoint patch_earned").toBe(0)
  expect(after.badged, "live badges map never gains clean-checkpoint").toBe(false)
  expect(after.storedBadged, "persisted blob never gains clean-checkpoint").toBe(false)
})
