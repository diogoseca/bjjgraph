/* @hyperspace {"theme":"lifetime-journeys","L":"multi-belt-endgame","F":"checkpoint-quiz","B":"idempotence"} @invariant "Retaking and deliberately failing an already-cleared Challenge checkpoint never revokes completion: after answering every retake card wrong, the checkpoint record remains true, its Challenge control remains cleared, and no regression beat fires." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { multiBeltEndgame, CURRICULUM } from "./personas"

/**
 * ENDGAME CHECKPOINT RETAKE CANNOT BE UNDONE — a player with every belt won re-clicks an
 * already-passed checkpoint and deliberately bombs the whole quiz. Completion is a ratchet:
 * the fail branch must not revoke the pass, regress the Challenge control, or lock content.
 *
 * Seams under test (probe-verified twice, ~3s/run, deterministic; probe file deleted):
 *   - The cleared Challenge checkpoint STAYS clickable: the Challenge renderer wires its handler
 *     directly to startCheckpoint and startCheckpoint has no already-done
 *     guard — so a retake is a REAL user path, not a synthetic one.
 *   - _checkpointAnswer's fail branch (app.src.jsx:3505-3513) emits checkpoint_failed
 *     (carrying `weakest`) and NEVER writes this.units — units[uk] keeps the seeded
 *     {checkpoint:true, t:1} bit-for-bit (t untouched proves no refresh; a retake PASS
 *     legitimately re-fires checkpoint_passed + unit_done and refreshes t, so every
 *     zero-count below is fail-path-specific).
 *   - unit_done is a pass-only beat, and the fx vocabulary (45 beat names, grepped) has no
 *     regress/revoke-shaped beat at all — asserted as a census over the emitted stream.
 *
 * Determinism: rng(tag) falls back to Math.random when a queue runs dry, so queue DEPTH is
 * the determinism — mc-pick pooling rejections consume extra draws (~220 observed for a
 * 6-card quiz), mc-shuffle ~60, checkpoint-pick 6 draws (rigged 8). Wrong answers advance
 * the quiz synchronously (_mcAnswer → onDone(false) → _checkpointAnswer). All keys/counts
 * derive from the served curriculum fixture — unit key is "white/mount-escapes", NOT
 * "white/u1"; checkpoint config is {cards:6, pass:5} at authoring.
 */

const WHITE = CURRICULUM.belts[0]
const UNIT1 = WHITE.units[0]
const UK = `${WHITE.id}/${UNIT1.id}`
const CP = UNIT1.checkpoint

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

test("failing a retake of a passed checkpoint: pass survives, rows stay done, no regression beat", async ({ page }) => {
  // curriculum facts the arc leans on — fail loudly here if the corpus shifts
  expect(CP && CP.cards, "unit 1 defines a checkpoint quiz").toBeGreaterThan(0)
  expect(CP.pass, "pass bar >= 1 (all-wrong is guaranteed to fail)").toBeGreaterThanOrEqual(1)
  expect(CP.pass, "pass bar achievable within the quiz").toBeLessThanOrEqual(CP.cards)

  const j = journey(page)
  await j.boot("/", { initialState: multiBeltEndgame() })
  await j.land("Mount Top")

  // rig every draw the retake consumes (depth IS the determinism — see header note)
  await j.rig("checkpoint-pick", seq(11, 8))
  await j.rig("mc-pick", seq(22, 220))
  await j.rig("mc-shuffle", seq(33, 60))

  await page.evaluate(() => (window as any).__neural.toggleExplorer())
  await expect(page.locator("[data-view]").first()).toBeVisible()

  // ── pre-state: the pass is on the books and the Challenge control is re-takeable ──
  expect(
   await page.locator(`[data-checkpoint="${UK}"]`).isDisabled(),
   "cleared Challenge checkpoint stays re-takeable",
  ).toBe(false)
  const before = await page.evaluate((uk) => {
    const u = (window as any).__neural._progressBlob().units[uk]
    return u ? { checkpoint: !!u.checkpoint, t: u.t } : null
  }, UK)
  expect(before, "persona seeded the pass record").toEqual({ checkpoint: true, t: 1 })

  // ── the cleared Challenge control is still live: clicking it starts a real retake ──
  const beatsBeforeRetake = await j.beats()
  await page.locator(`[data-checkpoint="${UK}"]`).first().click()
  await j.advance(400)
  await j.expectBeat("checkpoint_start")
  const start = (await j.beats()).filter((b: any) => b.beat === "checkpoint_start").pop() as any
  expect(start.unit, "retake targets the passed unit").toBe(UK)
  expect(start.cards, "quiz deals the configured card count").toBe(CP.cards)
  expect(
    await page.evaluate(() => (window as any).__neural._checkpoint?.picks.length ?? 0),
    "live quiz holds the full pick set",
  ).toBe(CP.cards)

  // ── deliberately bomb every card (wrong answers resolve synchronously) ──
  for (let i = 0; i < CP.cards; i++) {
    const mc = await page.evaluate(() => {
      const m = (window as any).__neural._mc
      return m ? { correct: m.correct, opts: m.tiers.length } : null
    })
    if (!mc) break // _mcBlock <2-survivor null guard — beat censuses below catch a short quiz
    await page.locator("[data-mc-opt]").nth((mc.correct + 1) % mc.opts).click()
    await j.advance(700)
  }

  // ── beat shape of a bombed retake: all wrong, one fail, zero pass-side beats ──
  const beats = ((await j.beats()) as any[]).slice(beatsBeforeRetake.length)
  const names = beats.map((b) => b.beat)
  expect(names.filter((n) => n === "mc_shown").length, "every quiz card presented").toBe(CP.cards)
  expect(names.filter((n) => n === "mc_wrong").length, "every quiz card answered wrong").toBe(CP.cards)
  expect(names.filter((n) => n === "mc_correct").length, "no accidental correct answer").toBe(0)
  const fails = beats.filter((b) => b.beat === "checkpoint_failed")
  expect(fails.length, "exactly one checkpoint_failed for the one retake").toBe(1)
  expect(fails[0].unit, "fail beat names the unit").toBe(UK)
  expect(fails[0].firstTry, "zero first-try credit on an all-wrong run").toBe(0)
  expect(fails[0].of, "fail beat carries the quiz size").toBe(CP.cards)
  expect(typeof fails[0].weakest, "fail beat carries a weakest-lesson pointer").toBe("string")
  expect(
    UNIT1.lessons.map((l: any) => l.deckKey),
    "weakest pointer is one of the unit's own decks",
  ).toContain(fails[0].weakest)
  expect(names, "a failed retake never emits the pass beat").not.toContain("checkpoint_passed")
  expect(
    names.filter((n) => n === "unit_done").length,
    "unit_done (pass-only beat) never fires on the fail path",
  ).toBe(0)
  expect(
    names.filter((n) => /regress|revoke|demote|downgrade|relock/.test(n)),
    "no regression/revocation-shaped beat exists in the emitted stream",
  ).toEqual([])

  // ── the ratchet: live state, serialized blob, and flushed storage all keep the pass ──
  const after = await page.evaluate((uk) => {
    const a = (window as any).__neural
    a._flushSave() // durability capstone: the fail branch itself never calls this
    const live = a.units[uk]
    const blob = a._progressBlob().units[uk]
    const stored = (JSON.parse(localStorage.getItem("bjj-neural-progress") || "{}").units || {})[uk]
    const norm = (u: any) => (u ? { checkpoint: !!u.checkpoint, t: u.t } : null)
    return { live: norm(live), blob: norm(blob), stored: norm(stored), ckptOpen: !!a._checkpoint }
  }, UK)
  expect(after.live, "fail branch never writes this.units — pass intact, t untouched").toEqual({ checkpoint: true, t: 1 })
  expect(after.blob, "serialized blob still records the pass").toEqual({ checkpoint: true, t: 1 })
  expect(after.stored, "persisted storage still records the pass").toEqual({ checkpoint: true, t: 1 })
  expect(after.ckptOpen, "quiz resolved and cleared — no dangling retake state").toBe(false)

  // ── re-open Challenges: the cleared checkpoint remains a usable control ──
  await page.evaluate(() => (window as any).__neural.toggleExplorer())
  await expect(page.locator("[data-view]").first()).toBeVisible()
  expect(
    await page.locator(`[data-checkpoint="${UK}"]`).isDisabled(),
    "cleared checkpoint remains re-takeable after the bombed retake",
  ).toBe(false)
  expect(await page.locator(".ng-track-card").count(), "all content tracks remain browseable").toBe(CURRICULUM.belts.length)
})
