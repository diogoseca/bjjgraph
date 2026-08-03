/* @hyperspace {"theme":"unlock-economy","L":"belt-ready","F":"checkpoint-quiz","B":"economy-math"} @invariant "The checkpoint pass line is exact: answering pass-1 of the authored cards correctly emits checkpoint_failed (unit not done), and a retake answering exactly pass correct emits checkpoint_passed + unit_done — the margin is the authored {cards,pass}, not all-or-nothing." */
import { test, expect, type Page } from "@playwright/test"
import { journey, Journey } from "../dsl"
import { beltReady, CURRICULUM } from "./personas"

/**
 * READY CHECKPOINT PASS MARGIN EXACT — a belt-ready player sits the LAST white checkpoint
 * twice, landing one answer either side of the authored pass line ({cards:6, pass:5} at
 * authoring). One correct short of the line must fail; exactly the line — with a wrong
 * answer still on the sheet — must pass. The margin is economy math, not all-or-nothing.
 *
 * Seams under test (probe-verified twice, ~4.5s/run, deterministic; probe file deleted):
 *   - Pass line source: _checkpointAnswer (app.src.jsx:3504) `passed = cp.firstTry >= cp.pass`.
 *     Fail branch emits checkpoint_failed {unit, firstTry, of, weakest} and never writes
 *     this.units; pass branch writes units[uk].checkpoint, emits checkpoint_passed +
 *     unit_done, and _flushSave()s — so the storage assert below makes NO manual flush.
 *   - Seed = beltReady() minus units[UK]: lessons stay prep/rec=3, so the v1.74 checkpoint
 *     button is ENABLED (evidence gate satisfied) while uncleared. The target is the LAST
 *     white unit, whose <details> group is collapsed by default — the spec opens it before
 *     each click (only the first unit's group opens on render).
 *   - Both correct AND wrong MC answers resolve synchronously in test mode (app.src.jsx:3406
 *     `if (!this.isTest() && !this._checkpoint)` skips the 600ms setTimeout → onDone →
 *     _checkpointAnswer). Every quiz card presents as MC on this unit's decks (no
 *     <2-survivor recall fallback), so the answer loop asserts _mc truthy per card.
 *
 * Determinism: rng(tag) falls back to Math.random when a queue runs dry, so queue DEPTH is
 * the determinism — mc-pick pooling rejections consume ~220 draws per 6-card quiz (observed);
 * 400/sitting is safe headroom. rig() APPENDS, so each sitting re-rigs fresh queues. All
 * keys/counts derive from the served curriculum fixture — the target is the LAST white unit
 * ("white/back-control-survival" at authoring), NOT unit 1.
 *
 * v1.70 re-validation: the seed sets settings.landQuestions=false (the real Settings →
 * Rolling toggle). The v1.68 question-first landing otherwise mounts ONE landing MC at
 * land() (surface "land") and fires an extra mc_shown beat, inflating the strict per-sitting
 * censuses (6 → 7). The pass line itself is unchanged — the authored {cards:6, pass:5}
 * boundary still holds, so both sittings' margins are computed from the same CP as before.
 */

const WHITE = CURRICULUM.belts[0]
const UNIT = WHITE.units[WHITE.units.length - 1]
const UK = `${WHITE.id}/${UNIT.id}`
const CP = UNIT.checkpoint

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

/** rig every draw one quiz sitting consumes (depth IS the determinism — see header note) */
async function rigSitting(j: Journey, salt: number) {
  await j.rig("checkpoint-pick", seq(salt + 1, 10))
  await j.rig("mc-pick", seq(salt + 2, 400))
  await j.rig("mc-shuffle", seq(salt + 3, 100))
}

/** answer the open quiz via the _mc truth rail: first nCorrect cards correct, the rest wrong */
async function answerQuiz(page: Page, j: Journey, nCorrect: number) {
  for (let i = 0; i < CP.cards; i++) {
    const mc = await page.evaluate(() => {
      const m = (window as any).__neural._mc
      return m ? { correct: m.correct, opts: m.tiers.length } : null
    })
    expect(mc, `card ${i + 1} presented as MC`).toBeTruthy()
    const nth = i < nCorrect ? mc!.correct : (mc!.correct + 1) % mc!.opts
    await page.locator("[data-mc-opt]").nth(nth).click()
    await j.advance(700)
  }
}

test("pass line is exact: pass-1 correct fails, a retake at exactly pass (wrong answer present) passes", async ({ page }) => {
  // curriculum facts the arc leans on — fail loudly here if the corpus shifts
  expect(CP && CP.cards, "last white unit defines a checkpoint quiz").toBeGreaterThan(0)
  expect(CP.pass, "pass bar >= 1 (the pass-1 sitting answers a real count)").toBeGreaterThanOrEqual(1)
  expect(CP.pass, "pass bar achievable within the quiz").toBeLessThanOrEqual(CP.cards)
  expect(CP.cards - CP.pass, "margin >= 1 keeps the retake-with-a-wrong-answer leg honest").toBeGreaterThanOrEqual(1)

  const j = journey(page)
  const seed: any = beltReady()
  delete seed.units[UK] // lessons stay drilled to goal; ONLY the last checkpoint is unsat
  // v1.68 landing question off at the source — keeps every mc_* census scoped to the
  // checkpoint sittings alone (see header)
  seed.settings.landQuestions = false
  await j.boot("/", { initialState: seed })
  await j.land("Mount Top")

  // ── pre-state: the target checkpoint is enabled (lessons at goal) but NOT cleared ──
  const openGroup = () =>
    page
      .locator(`.ng-challenge-group:has([data-checkpoint="${UK}"])`)
      .first()
      .evaluate((el) => ((el as HTMLDetailsElement).open = true))
  await rigSitting(j, 100)
  await page.evaluate(() => (window as any).__neural.toggleExplorer())
  await expect(page.locator("[data-view]").first()).toBeVisible()
  expect(
    await page.locator(`[data-checkpoint="${UK}"]`).first().textContent(),
    "checkpoint starts not-cleared",
  ).not.toContain("cleared")
  expect(
    await page.locator(`[data-checkpoint="${UK}"]`).first().isDisabled(),
    "checkpoint ENABLED — every lesson at goal, the evidence gate is satisfied",
  ).toBe(false)

  // ── SITTING 1: one correct short of the line (pass-1 correct, the rest wrong) ──
  await openGroup()
  await page.locator(`[data-checkpoint="${UK}"]`).first().click()
  await j.advance(400)
  await j.expectBeat("checkpoint_start")
  const start1 = (await j.beats()).filter((b: any) => b.beat === "checkpoint_start").pop() as any
  expect(start1.unit, "quiz targets the last white unit").toBe(UK)
  expect(start1.cards, "quiz deals the authored card count").toBe(CP.cards)
  expect(
    await page.evaluate(() => (window as any).__neural._checkpoint?.picks.length ?? 0),
    "live quiz holds the full pick set",
  ).toBe(CP.cards)
  await answerQuiz(page, j, CP.pass - 1)

  const b1 = (await j.beats()) as any[]
  const n1 = b1.map((b) => b.beat)
  expect(n1.filter((n) => n === "mc_shown").length, "sitting 1 presented every card").toBe(CP.cards)
  expect(n1.filter((n) => n === "mc_correct").length, "sitting 1 landed exactly pass-1 correct").toBe(CP.pass - 1)
  expect(n1.filter((n) => n === "mc_wrong").length, "sitting 1 missed the rest").toBe(CP.cards - (CP.pass - 1))
  const fails = b1.filter((b) => b.beat === "checkpoint_failed")
  expect(fails.length, "one short of the line → exactly one checkpoint_failed").toBe(1)
  expect(fails[0].unit, "fail beat names the unit").toBe(UK)
  expect(fails[0].firstTry, "fail beat scores exactly pass-1 first-try credit").toBe(CP.pass - 1)
  expect(fails[0].of, "fail beat carries the quiz size").toBe(CP.cards)
  expect(typeof fails[0].weakest, "fail beat points at a weakest lesson").toBe("string")
  expect(
    UNIT.lessons.map((l: any) => l.deckKey),
    "weakest pointer is one of the unit's own decks",
  ).toContain(fails[0].weakest)
  expect(n1, "no pass beat one short of the line").not.toContain("checkpoint_passed")
  expect(n1.filter((n) => n === "unit_done").length, "no unit_done one short of the line").toBe(0)

  const afterFail = await page.evaluate((uk) => {
    const a = (window as any).__neural
    const norm = (u: any) => (u ? { checkpoint: !!u.checkpoint } : null)
    const stored = JSON.parse(localStorage.getItem("bjj-neural-progress") || "{}")
    return {
      live: norm(a.units[uk]),
      blob: norm(a._progressBlob().units[uk]),
      stored: norm((stored.units || {})[uk]),
      ckptOpen: !!a._checkpoint,
    }
  }, UK)
  expect(afterFail.live, "fail branch never writes this.units").toBeNull()
  expect(afterFail.blob, "serialized blob carries no pass record").toBeNull()
  expect(afterFail.stored, "persisted storage carries no pass record").toBeNull()
  expect(afterFail.ckptOpen, "quiz resolved and cleared — no dangling state").toBe(false)

  // ── SITTING 2: retake at EXACTLY the pass line — wrong answer present, still passes ──
  await rigSitting(j, 200) // rig APPENDS — fresh depth so the retake never drains to Math.random
  await page.evaluate(() => (window as any).__neural.toggleExplorer())
  await expect(page.locator("[data-view]").first()).toBeVisible()
  expect(
    await page.locator(`[data-checkpoint="${UK}"]`).first().textContent(),
    "checkpoint still not-cleared after the fail",
  ).not.toContain("cleared")
  await openGroup() // fresh render — the group collapsed again
  await page.locator(`[data-checkpoint="${UK}"]`).first().click()
  await j.advance(400)
  const starts = (await j.beats()).filter((b: any) => b.beat === "checkpoint_start") as any[]
  expect(starts.length, "retake fires a second checkpoint_start").toBe(2)
  expect(starts[1].unit, "retake targets the same unit").toBe(UK)
  expect(starts[1].cards, "retake deals the authored card count").toBe(CP.cards)
  await answerQuiz(page, j, CP.pass)

  const b2 = (await j.beats()) as any[]
  const n2 = b2.map((b) => b.beat)
  expect(n2.filter((n) => n === "mc_shown").length, "both sittings presented every card").toBe(2 * CP.cards)
  expect(
    n2.filter((n) => n === "mc_correct").length,
    "retake landed exactly pass correct (census across both sittings)",
  ).toBe(CP.pass - 1 + CP.pass)
  expect(
    n2.filter((n) => n === "mc_wrong").length,
    "retake carries a REAL wrong answer — pass is not all-or-nothing",
  ).toBe(CP.cards - (CP.pass - 1) + (CP.cards - CP.pass))
  const passes = b2.filter((b) => b.beat === "checkpoint_passed")
  expect(passes.length, "exactly one checkpoint_passed").toBe(1)
  expect(passes[0].unit, "pass beat names the unit").toBe(UK)
  expect(passes[0].firstTry, "pass beat scores exactly the pass line").toBe(CP.pass)
  expect(passes[0].of, "pass beat carries the quiz size").toBe(CP.cards)
  const dones = b2.filter((b) => b.beat === "unit_done")
  expect(dones.length, "exactly one unit_done").toBe(1)
  expect(dones[0].unit, "unit_done names the unit").toBe(UK)
  expect(dones[0].belt, "unit_done names the belt").toBe(WHITE.id)
  expect(n2.filter((n) => n === "checkpoint_failed").length, "fail count untouched by the pass").toBe(1)

  // ── pass branch persists on its own (_flushSave lives inside the branch — no manual flush) ──
  const afterPass = await page.evaluate((uk) => {
    const a = (window as any).__neural
    const stored = JSON.parse(localStorage.getItem("bjj-neural-progress") || "{}")
    return {
      live: !!(a.units[uk] && a.units[uk].checkpoint),
      stored: !!((stored.units || {})[uk] && (stored.units || {})[uk].checkpoint),
      ckptOpen: !!a._checkpoint,
    }
  }, UK)
  expect(afterPass.live, "live units records the pass").toBe(true)
  expect(afterPass.stored, "pass branch _flushSave persisted the pass to storage").toBe(true)
  expect(afterPass.ckptOpen, "quiz resolved and cleared — no dangling state").toBe(false)

  // ── the challenges view shows it: the button flips to cleared at exactly the pass line ──
  await page.evaluate(() => (window as any).__neural.toggleExplorer())
  await expect(page.locator("[data-view]").first()).toBeVisible()
  expect(
    await page.locator(`[data-checkpoint="${UK}"]`).first().textContent(),
    "checkpoint reads cleared at exactly the pass line",
  ).toContain("cleared")
})
