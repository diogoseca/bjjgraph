/* @hyperspace {"theme":"momentum-and-economy","L":"multi-belt-endgame","F":"graph-canvas","B":"interruption-abort"} @invariant "Restaging via stageRollAt is a NEW cold match, not a punished one: staging another node while ×2 hot resets _combo to 0 and removes the heat chip while emitting zero combo_break beats — cold is not broken." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { multiBeltEndgame } from "./personas"

/**
 * COLD IS NOT BROKEN — the roam-and-stage path through the momentum reset.
 *
 * Momentum is per ROLL (v1.70.0): a fresh match starts cold. But there are two very
 * different ways to lose heat, and they must stay distinct:
 *   - _breakCombo (app.src.jsx:4345) — the PUNISHMENT: emits a combo_break beat, shatters
 *     the chip (data-combo-broken + 0.55s timer), folds "×N momentum gone" into the toast.
 *   - the cold reset in rollFromPosition (:4697) — plain bookkeeping: `_combo = 0;
 *     _landPending = false; _updateComboChip()` with NO _breakCombo call, so no beat, and
 *     the chip leaves through _updateComboChip's immediate non-shatter branch (:4373-4379).
 *
 * stageRollAt (:4729) → rollFromPosition (:4694) is the untested route into that cold
 * reset: startRoll's copy of the same line is already pinned by momentum.spec.ts's
 * "per roll" test, and play-from-here (:3330) shares it too. A multi-belt endgame player
 * roaming the graph mid-streak is exactly who hits this — everything is unlocked, they
 * hop nodes freely, and a restage must read as "new match", never "you were punished".
 *
 * Probe facts leaned on (probe green 2/2, ~3.5s each):
 *   - multiBeltEndgame()'s stage:{} is empty, so landing questions still fire despite
 *     full prep/rec — the heat can be built the honest way (two correct landing answers).
 *   - the reset is SYNCHRONOUS at stageRollAt time: _combo, momentumMod() and the chip
 *     are all already cold in the same JS turn as the call, before any frame is pumped.
 *   - rollFromPosition consumes max-moves, ai-skill and (name-dependent) role draws —
 *     rig all three BEFORE stageRollAt or the restage flakes on ambient RNG.
 *   - canvas hit-testing has no DOM: the tap handler calls stageRollAt directly, so the
 *     journey does too (same documented internal call as e2e/journeys/roam-stage.spec.ts).
 */

/** answer the live landing question CORRECTLY via the keyboard (A-D answer keys) */
const answer = async (page: any) => {
  const mc = await page.evaluate(() => {
    const m = (window as any).__neural._mc
    return m && m.surface === "land" ? { correct: m.correct } : null
  })
  expect(mc, "a live landing question").toBeTruthy()
  await page.keyboard.press("abcd"[mc!.correct])
}

/** execute a rigged-successful transition and pump to the next hand's landing question */
const hop = async (j: any, page: any) => {
  const t = await page.evaluate(() => {
    const a = (window as any).__neural
    for (const i of a.optionIdxs || []) if (a.nodes[i].ty === "transitions") return a.nodes[i].t
    return ""
  })
  expect(t, "a transition to advance on").toBeTruthy()
  await j.rig("resolve", [0.01])
  await j.rig("outcome", [0.01])
  await j.pick(t)
  await j.nextHand()
}

test("restaging while ×2 hot goes cold synchronously — no combo_break, chip gone, new match lands", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/", { initialState: multiBeltEndgame() })
  await j.land("Mount Top")

  // ── build real heat the honest way: right at Mount (×1), hop, right again (×2) ──
  await answer(page)
  await hop(j, page)
  await answer(page)
  expect(
    await page.evaluate(() => (window as any).__neural._combo || 0),
    "×2 hot before the roam",
  ).toBe(2)
  await expect(page.locator('[data-momentum="2"]'), "the heat chip is live").toBeVisible()
  expect(
    (await j.beats()).filter((b: any) => b.beat === "combo_break").length,
    "nothing has broken yet",
  ).toBe(0)
  const staged0 = (await j.beats()).filter((b: any) => b.beat === "roll_staged").length

  // ── a playable position elsewhere (roam-stage's elsewhere pattern) ──
  const target = await page.evaluate(() => {
    const a = (window as any).__neural
    for (const node of a.nodes) {
      if (node.ty !== "positions" || node.idx === a.currentPos) continue
      if (!a.adj[node.idx].some((k: number) => a.nodes[k].ty !== "positions")) continue
      return node.idx
    }
    return -1
  })
  expect(target, "a playable position elsewhere on the graph").toBeGreaterThanOrEqual(0)

  // rollFromPosition consumes these ambient draws — rig BEFORE staging
  await j.rig("max-moves", [0.5])
  await j.rig("ai-skill", [0.5])
  await j.rig("role", [0])

  // ── stage + snapshot in ONE evaluate: the cold reset is synchronous at stageRollAt
  // time, so every field must already read cold in the same JS turn, zero frames pumped ──
  const snap = await page.evaluate((i) => {
    const a = (window as any).__neural
    a.stageRollAt(i)
    return {
      combo: a._combo || 0,
      mod: a.momentumMod(),
      chips: document.querySelectorAll("[data-momentum]").length,
      breaks: (a.beats || []).filter((b: any) => b.beat === "combo_break").length,
      staged: (a.beats || []).filter((b: any) => b.beat === "roll_staged").length,
    }
  }, target)
  expect(snap.combo, "cold in the same JS turn as the restage").toBe(0)
  expect(snap.mod, "no residual momentum bonus").toBe(0)
  expect(snap.chips, "chip removed via the immediate non-shatter branch").toBe(0)
  expect(snap.breaks, "ZERO combo_break beats — cold is not broken").toBe(0)
  expect(snap.staged, "exactly one new roll_staged beat").toBe(staged0 + 1)

  // ── the staged state still arrives (clock held), and arrival changes none of it ──
  await j.advance(2000)
  expect(
    await page.evaluate(() => (window as any).__neural.currentPos),
    "we landed at the staged node",
  ).toBe(target)
  expect(
    await page.evaluate(() => ((window as any).__neural.optionIdxs || []).length),
    "with a hand dealt",
  ).toBeGreaterThan(0)
  expect(
    (await j.beats()).filter((b: any) => b.beat === "combo_break").length,
    "still zero combo_break after landing the new match",
  ).toBe(0)
  await expect(page.locator("[data-momentum]"), "and no heat chip resurrects").toHaveCount(0)
})
