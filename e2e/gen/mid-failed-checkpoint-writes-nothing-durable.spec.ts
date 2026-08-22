/* @hyperspace {"theme":"unlock-economy","L":"curriculum-mid","F":"persistence-reload","B":"idempotence"} @invariant "A failed checkpoint is a durable no-op on the unlock ledger: after failing unit-2's quiz and a preserveStorage reload, the units map still lacks the unit-2 key and the checkpoint stays uncleared, while the lesson drills that preceded it DID persist — the fail writes nothing, the study that led to it stays and re-arms the gate." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { curriculumMid, CURRICULUM } from "./personas"

/**
 * MID-CURRICULUM FAILED CHECKPOINT WRITES NOTHING DURABLE — the fail-side half of the unlock
 * ledger's durability story. A mid-curriculum player finishes drilling unit 2's back half
 * (real study, real lesson_done beats), sits the unit-2 checkpoint, bombs every card, and
 * reloads. The ledger must show EXACTLY the study and NONE of the fail: units never gains the
 * unit-2 key on either side of the reload, the checkpoint stays uncleared, yet the drilled
 * lessons persist and re-satisfy the checkpoint gate on the next life.
 *
 * Mechanism under test (source-verified at authoring; probe green 2/2, ~28s/run, deleted):
 *   - startCheckpoint gates the button on EVERY live lesson lessonDone — drilling the
 *     complement is what flips the v1.74 checkpoint button from disabled to enabled; the
 *     click fires checkpoint_start {unit, cards} synchronously and auto-closes the explorer.
 *     (v1.74 Challenges UI: no data-unit/data-locked/data-done attrs — the button's
 *     disabled state + its "Checkpoint cleared" label are the rendered ledger. Only the
 *     first unit's <details> group is open by default, so the spec opens unit-2's group
 *     before clicking.)
 *   - _checkpointAnswer's fail branch (app.src.jsx:3511-3520) emits checkpoint_failed
 *     {unit, firstTry, of, weakest} and NEVER writes this.units, never flushes — the no-write
 *     is asserted WITHOUT any manual _flushSave (the honest path).
 *   - Drills self-persist: noteCardDone → _saveProgress is SYNCHRONOUS in test mode
 *     (app.src.jsx:1122), so the pre-reload blob already carries the drilled prep.
 *   - Cross-deck shared-question credit (noteCardDone, app.src.jsx:869-873) can bump SIBLING
 *     decks' prep — every prep assert is >= 3, never ===; lesson_done stays once-per-drilled-
 *     deck (_maybeLessonDone runs only for the graded key), so the deckKey SET is exact.
 *
 * Determinism: rng(tag) falls back to Math.random when a queue drains, so queue DEPTH is the
 * determinism — unit 2's 6-lesson pool is bigger than unit 1's, hence checkpoint-pick 10,
 * mc-pick 500, mc-shuffle 150 for the full bombed sitting (all 6 cards deal as MC), and
 * 10/120/40 for the retake's first deal. Wrong answers resolve synchronously in test mode.
 * All keys/counts derive from the served curriculum fixture — unit key is
 * "white/side-control-escapes" ({cards:6, pass:5} at authoring).
 *
 * v1.70 re-validation: the seed sets settings.landQuestions=false (the real Settings →
 * Rolling toggle; it persists in the v2 blob, so the preserveStorage reboot keeps it). The
 * v1.68 question-first landing otherwise mounts ONE landing MC at land() and fires an extra
 * mc_shown beat, inflating the bombed sitting's strict census (6 → 7). The checkpoint deal
 * itself is unchanged: startCheckpoint still deals the authored 6.
 *
 * Distinct from core-040 (in-session fail beat only, unit 1) and gen-w1-10 / endgame-
 * checkpoint-retake-cant-undone (already-PASSED retake ratchet): this pins the fail-side
 * durable-no-write across a reload on a NEVER-passed unit, plus the study-survives flank.
 */

const WHITE = CURRICULUM.belts[0]
const UNIT1 = WHITE.units[0]
const UNIT2 = WHITE.units[1]
const UK1 = `${WHITE.id}/${UNIT1.id}`
const UK2 = `${WHITE.id}/${UNIT2.id}`
const CP = UNIT2.checkpoint
// Mirror personas.ts curriculumMid EXACTLY: it seeds slice(0, ceil(n/2)) at prep=3, so the
// complement — slice(ceil(n/2)) — is the undrilled back half this journey studies to goal.
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

test("bombed unit-2 checkpoint never reaches the ledger across a reload, while the drills that unlocked it persist", async ({ page }) => {
  // curriculum facts the arc leans on — fail loudly here if the corpus shifts
  expect(CP && CP.cards, "unit 2 defines a checkpoint quiz").toBeGreaterThan(0)
  expect(CP.pass, "pass bar >= 1 (all-wrong is guaranteed to fail)").toBeGreaterThanOrEqual(1)
  expect(COMPLEMENT.length, "curriculumMid leaves a back half of unit 2 undrilled").toBeGreaterThan(0)

  const j = journey(page)

  // ── Boot 1: mid-curriculum persona — unit 1 passed {checkpoint:true,t:1}, unit 2 half-drilled ──
  const seed: any = curriculumMid()
  // v1.68 landing question off at the source — keeps every mc_* census scoped to the
  // checkpoint sittings alone (see header)
  seed.settings.landQuestions = false
  await j.boot("/", { initialState: seed })
  await j.land("Mount Top")

  // ── STUDY: drill the complement to goal — the work that must SURVIVE the coming fail ──
  for (const key of COMPLEMENT) await j.drill(3, key)
  const lessonBeats = (await j.beats()).filter((b: any) => b.beat === "lesson_done") as any[]
  expect(
    lessonBeats.map((b) => b.deckKey).sort(),
    "exactly one lesson_done per drilled deck — the deckKey set IS the complement",
  ).toEqual([...COMPLEMENT].sort())
  for (const b of lessonBeats) {
    expect(b.unit, "lesson_done credits unit 2").toBe(UK2)
    expect(b.belt, "lesson_done credits the white belt").toBe(WHITE.id)
  }
  const prepLive = await page.evaluate((keys) => {
    const a = (window as any).__neural
    return (keys as string[]).map((k) => (a.prep && a.prep[k]) || 0)
  }, COMPLEMENT)
  for (let i = 0; i < COMPLEMENT.length; i++) {
    // cross-deck shared-question credit can bump siblings past 3 — assert the floor, never ===
    expect(prepLive[i], `${COMPLEMENT[i]} drilled to goal`).toBeGreaterThanOrEqual(3)
  }

  // ── pre-state: unit 1 cleared (seeded), unit 2's checkpoint enabled by the drills but
  //    NOT cleared — a never-passed unit ──
  const openGroup = (uk: string) =>
    page
      .locator(`.ng-challenge-group:has([data-checkpoint="${uk}"])`)
      .first()
      .evaluate((el) => ((el as HTMLDetailsElement).open = true))
  await page.evaluate(() => (window as any).__neural.toggleExplorer())
  await expect(page.locator("[data-view]").first()).toBeVisible()
  expect(
    await page.locator(`[data-checkpoint="${UK1}"]`).first().textContent(),
    "unit-1 checkpoint cleared (seeded)",
  ).toContain("cleared")
  expect(
    await page.locator(`[data-checkpoint="${UK2}"]`).first().isDisabled(),
    "unit-2 checkpoint ENABLED — the drills satisfied the evidence gate",
  ).toBe(false)
  expect(
    await page.locator(`[data-checkpoint="${UK2}"]`).first().textContent(),
    "unit-2 checkpoint starts not-cleared",
  ).not.toContain("cleared")

  // ── the drilling made the button live: startCheckpoint's every-lesson gate passes ──
  await j.rig("checkpoint-pick", seq(11, 10))
  await j.rig("mc-pick", seq(12, 500))
  await j.rig("mc-shuffle", seq(13, 150))
  await openGroup(UK2) // unit 2's <details> group is collapsed by default
  await page.locator(`[data-checkpoint="${UK2}"]`).first().click()
  await j.advance(400)
  await j.decksSettled() // quiz pool decks hydrate async (v1.80.4) - settle before the one-shot beat check
  await j.expectBeat("checkpoint_start")
  const start = (await j.beats()).filter((b: any) => b.beat === "checkpoint_start").pop() as any
  expect(start.unit, "quiz targets unit 2").toBe(UK2)
  expect(start.cards, "quiz deals the authored card count").toBe(CP.cards)
  expect(
    await page.evaluate(() => (window as any).__neural._checkpoint?.picks.length ?? 0),
    "live quiz holds the full pick set",
  ).toBe(CP.cards)
  await expect(page.locator("[data-view]").first(), "starting the quiz auto-closes the explorer").not.toBeVisible()

  // ── BOMB every card via the _mc truth rail (wrong answers resolve synchronously) ──
  for (let i = 0; i < CP.cards; i++) {
    const mc = await page.evaluate(() => {
      const m = (window as any).__neural._mc
      return m ? { correct: m.correct, opts: m.tiers.length } : null
    })
    expect(mc, `card ${i + 1} presented as MC`).toBeTruthy()
    await page.locator("[data-mc-opt]").nth((mc!.correct + 1) % mc!.opts).click()
    await j.advance(700)
  }

  // ── beat shape of the bombed sitting: all wrong, one fail, zero pass-side beats ──
  const b1 = (await j.beats()) as any[]
  const n1 = b1.map((b) => b.beat)
  expect(n1.filter((n) => n === "mc_shown").length, "every quiz card presented").toBe(CP.cards)
  expect(n1.filter((n) => n === "mc_wrong").length, "every quiz card answered wrong").toBe(CP.cards)
  expect(n1.filter((n) => n === "mc_correct").length, "no accidental correct answer").toBe(0)
  const fails = b1.filter((b) => b.beat === "checkpoint_failed")
  expect(fails.length, "exactly one checkpoint_failed").toBe(1)
  expect(fails[0].unit, "fail beat names unit 2").toBe(UK2)
  expect(fails[0].firstTry, "zero first-try credit on an all-wrong run").toBe(0)
  expect(fails[0].of, "fail beat carries the quiz size").toBe(CP.cards)
  expect(
    UNIT2.lessons.map((l: any) => l.deckKey),
    "weakest pointer is one of unit 2's own decks",
  ).toContain(fails[0].weakest)
  expect(n1, "a bombed sitting never emits the pass beat").not.toContain("checkpoint_passed")
  expect(n1.filter((n) => n === "unit_done").length, "unit_done (pass-only beat) never fires").toBe(0)

  // ── same-life durability, NO manual flush (the honest path): the drills self-persisted
  //    (noteCardDone→_saveProgress is synchronous in test mode); the fail wrote NOTHING ──
  const sameLife = await page.evaluate((args) => {
    const { uk1, uk2, keys } = args as { uk1: string; uk2: string; keys: string[] }
    const a = (window as any).__neural
    const stored = JSON.parse(localStorage.getItem("bjj-neural-progress") || "{}")
    const units = stored.units || {}
    const norm = (u: any) => (u ? { checkpoint: !!u.checkpoint, t: u.t } : null)
    return {
      liveHasU2: Object.prototype.hasOwnProperty.call(a.units || {}, uk2),
      storedHasU2: Object.prototype.hasOwnProperty.call(units, uk2),
      storedU1: norm(units[uk1]),
      storedPrep: keys.map((k) => (stored.prep || {})[k] || 0),
      ckptOpen: !!a._checkpoint,
    }
  }, { uk1: UK1, uk2: UK2, keys: COMPLEMENT })
  expect(sameLife.ckptOpen, "quiz resolved and cleared — no dangling state").toBe(false)
  expect(sameLife.liveHasU2, "live units map never gained the unit-2 key").toBe(false)
  expect(sameLife.storedHasU2, "persisted units map lacks the unit-2 key — the fail wrote nothing").toBe(false)
  expect(sameLife.storedU1, "seeded unit-1 pass untouched by the fail").toEqual({ checkpoint: true, t: 1 })
  for (let i = 0; i < COMPLEMENT.length; i++) {
    expect(sameLife.storedPrep[i], `${COMPLEMENT[i]} prep already persisted pre-reload`).toBeGreaterThanOrEqual(3)
  }

  // ── Boot 2 (preserveStorage): the no-op is DURABLE, the study is DURABLE ──
  await j.boot("/", { preserveStorage: true })
  await j.land("Mount Top")
  const reborn = await page.evaluate((args) => {
    const { uk1, uk2, keys } = args as { uk1: string; uk2: string; keys: string[] }
    const a = (window as any).__neural
    const stored = JSON.parse(localStorage.getItem("bjj-neural-progress") || "{}")
    const norm = (u: any) => (u ? { checkpoint: !!u.checkpoint, t: u.t } : null)
    return {
      liveHasU2: Object.prototype.hasOwnProperty.call(a.units || {}, uk2),
      storedHasU2: Object.prototype.hasOwnProperty.call(stored.units || {}, uk2),
      liveU1: norm((a.units || {})[uk1]),
      livePrep: keys.map((k) => (a.prep && a.prep[k]) || 0),
    }
  }, { uk1: UK1, uk2: UK2, keys: COMPLEMENT })
  expect(reborn.liveHasU2, "reloaded units map still lacks the unit-2 key").toBe(false)
  expect(reborn.storedHasU2, "reloaded storage still lacks the unit-2 key").toBe(false)
  expect(reborn.liveU1, "unit-1 entry survives the reload bit-for-bit").toEqual({ checkpoint: true, t: 1 })
  for (let i = 0; i < COMPLEMENT.length; i++) {
    expect(reborn.livePrep[i], `${COMPLEMENT[i]} drill credit survived the reload`).toBeGreaterThanOrEqual(3)
  }

  // ── post-reload challenges DOM: fail invisible, study visible ──
  const openGroup2 = (uk: string) =>
    page
      .locator(`.ng-challenge-group:has([data-checkpoint="${uk}"])`)
      .first()
      .evaluate((el) => ((el as HTMLDetailsElement).open = true))
  await page.evaluate(() => (window as any).__neural.toggleExplorer())
  await expect(page.locator("[data-view]").first()).toBeVisible()
  expect(
    await page.locator(`[data-checkpoint="${UK2}"]`).first().textContent(),
    "unit-2 checkpoint still not-cleared after reload",
  ).not.toContain("cleared")
  expect(
    await page.locator(`[data-checkpoint="${UK2}"]`).first().isDisabled(),
    "unit-2 checkpoint still ENABLED after reload — the persisted drills re-satisfy the gate",
  ).toBe(false)
  expect(
    await page.locator(`[data-checkpoint="${UK1}"]`).first().textContent(),
    "unit-1 checkpoint still cleared after reload",
  ).toContain("cleared")

  // ── retake proof: the gate re-passes on PERSISTED prep alone — no re-drilling needed ──
  expect(
    (await j.beats()).filter((b: any) => b.beat === "checkpoint_start").length,
    "fresh life carries zero checkpoint_start before the click",
  ).toBe(0)
  await j.rig("checkpoint-pick", seq(41, 10))
  await j.rig("mc-pick", seq(42, 120))
  await j.rig("mc-shuffle", seq(43, 40))
  await openGroup2(UK2)
  await page.locator(`[data-checkpoint="${UK2}"]`).first().click()
  // THE RETAKE OPENS WHEN ITS POOL IS WARM, NOT ON A FIXED PUMP (v1.118.0). `_warmMcPool` defers
  // an MC block by one fetch rather than dealing from a partial pool, and WHICH decks are already
  // resident depends on which ten cards the roll dealt — so `advance(400)` was a coincidence of
  // the old hand order, not a contract. Re-ranking the option cards by EDGE moved it one tick
  // past the boundary (measured: cp:false at 400ms, the beat lands at 800). `advanceUntil` throws
  // if it never opens, and the extra pump below is what keeps "exactly ONE" a real assertion.
  await j.advanceUntil("checkpoint_start", 8000)
  await j.advance(400)
  const starts = (await j.beats()).filter((b: any) => b.beat === "checkpoint_start") as any[]
  expect(starts.length, "the persisted drills alone re-open the quiz").toBe(1)
  expect(starts[0].unit, "retake targets unit 2").toBe(UK2)
  expect(starts[0].cards, "retake deals the authored card count").toBe(CP.cards)
  expect(
    await page.evaluate(() => (window as any).__neural._checkpoint?.picks.length ?? 0),
    "retake quiz holds the full pick set",
  ).toBe(CP.cards)
})
