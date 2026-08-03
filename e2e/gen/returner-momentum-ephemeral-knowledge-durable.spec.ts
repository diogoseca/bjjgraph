/* @hyperspace {"theme":"momentum-and-economy","L":"lapsed-returner","F":"persistence-reload","B":"persistence-reload"} @invariant "The meter is session-ephemeral while the knowledge it minted is durable: after building ×3, a preserveStorage reload boots with _combo 0 and zero [data-momentum] elements, yet the card-stage credits earned by those correct landing answers survive in the reloaded bjj-neural-progress blob." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { lapsedReturner } from "./personas"

/**
 * RETURNER — MOMENTUM IS EPHEMERAL, KNOWLEDGE IS DURABLE.
 *
 * A returning white-belt holder climbs the combo meter to ×3 by answering three landing
 * questions right, then reloads. The two halves of that streak have opposite lifetimes by
 * design, and this spec pins BOTH:
 *   - the METER dies: _combo is an instance field, absent from _progressBlob()
 *     (app.src.jsx:1141-1146 — v/prep/rec/stage/units/belts/tut/days/settings, no combo),
 *     and is explicitly zeroed at every match start (startRoll app.src.jsx:4697,
 *     rollFromPosition:4738, stageRollAt:3330). A reload boots cold.
 *   - the KNOWLEDGE lives: each correct landing answer runs _bumpStage(key, q, 1, 2)
 *     (app.src.jsx:3641) → _saveProgress(), which writes localStorage SYNCHRONOUSLY in
 *     test mode (app.src.jsx:1154), so the per-(deckKey, qhash) stage credits are on disk
 *     before the reload and must re-ingest byte-for-byte.
 *
 * Why lapsedReturner makes the climb possible: the persona blob seeds prep/rec at 3 but its
 * stage map is EMPTY — every card reads cardStage 0 < 2, so questionFor(key) asks at every
 * landing. Three landings = three askable questions = ×3.
 *
 * Structure-only assertions: stages, counts, deckKeys/qhashes as opaque identifiers — never
 * card or answer TEXT (MC waves rewrite wording; qhash is the app's own FNV-1a identity).
 */

/** answer the live landing question CORRECTLY via the keyboard, then harvest the minted
 *  credit from _landQ ({key, card} — retained post-answer until the next landing render). */
const answerAndHarvest = async (page: any) => {
  const mc = await page.evaluate(() => {
    const m = (window as any).__neural._mc
    return m && m.surface === "land" ? { correct: m.correct, n: m.n } : null
  })
  expect(mc, "a live landing question (empty seeded stage map ⇒ questionFor always asks)").toBeTruthy()
  await page.keyboard.press("abcd"[mc!.correct])
  const minted = await page.evaluate(() => {
    const a = (window as any).__neural
    const lq = a._landQ
    if (!lq || !lq.card) return null
    const qh = a.qhash(lq.card.q)
    return { key: lq.key as string, qhash: qh as string, stage: ((a.stage || {})[lq.key] || {})[qh] ?? null }
  })
  expect(minted, "_landQ still readable post-answer (cleared only by the next landing render)").toBeTruthy()
  return minted as { key: string; qhash: string; stage: number | null }
}

/** hop: execute a rigged-successful transition and pump to the next hand (next landing) */
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

test("×3 momentum dies at the reload boundary while its three minted stage credits survive it", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))

  const j = journey(page)
  await j.boot("/", { initialState: lapsedReturner() })
  await j.land("Mount Top")

  // ── build ×3: three correct landing answers, hopping states between them. land() rigged
  // ai-skill/role/max-moves; land-mc-pick/land-mc-shuffle need no rigging (house style). ──
  // Structured entries, NOT a "key|qhash" composite — deck keys themselves contain "|"
  // (e.g. "<name>|Attacker"). Latest stage wins when a deck re-asks the same card.
  const minted: Array<{ key: string; qhash: string; stage: number }> = []
  for (let i = 0; i < 3; i++) {
    if (i > 0) await hop(j, page)
    const m = await answerAndHarvest(page)
    expect(typeof m.stage, `answer ${i + 1} minted a numeric stage credit`).toBe("number")
    expect(m.stage!, "a correct MC answer stages at least 1 (cap 2 — the recall gate)").toBeGreaterThanOrEqual(1)
    expect(m.stage!).toBeLessThanOrEqual(2)
    const prior = minted.find((e) => e.key === m.key && e.qhash === m.qhash)
    if (prior) prior.stage = m.stage!
    else minted.push({ key: m.key, qhash: m.qhash, stage: m.stage! })
  }
  expect(minted.length, "the three answers minted 1-3 distinct (deckKey, qhash) credits").toBeGreaterThanOrEqual(1)
  expect(minted.length).toBeLessThanOrEqual(3)

  // ── hot state: the meter reads exactly ×3 ──
  const hot = await page.evaluate(() => {
    const a = (window as any).__neural
    return { combo: a._combo || 0, mod: a.momentumMod() }
  })
  expect(hot.combo, "three straight rights = ×3").toBe(3)
  expect(hot.mod, "+5% at ×3").toBeCloseTo(0.05, 6)
  await expect(page.locator('[data-momentum="3"]'), "the heat chip shows ×3").toBeVisible()

  // ── the reload boundary: same storage, fresh app life ──
  await j.boot("/", { preserveStorage: true })

  const after = await page.evaluate(() => {
    const a = (window as any).__neural
    let raw: any = null
    try {
      raw = JSON.parse(localStorage.getItem("bjj-neural-progress") || "null")
    } catch (e) {
      raw = null
    }
    return {
      combo: a._combo || 0,
      mod: a.momentumMod(),
      chips: document.querySelectorAll("[data-momentum]").length,
      rawStage: (raw && raw.stage) || null, // what _saveProgress actually put on disk
      appStage: a._progressBlob().stage || null, // what the reloaded life re-ingested
    }
  })

  // the meter is session-ephemeral: cold boot, no bonus, no chip
  expect(after.combo, "the reloaded life boots with _combo 0 — momentum never persists").toBe(0)
  expect(after.mod, "no phantom bonus survives the reload").toBe(0)
  expect(after.chips, "zero [data-momentum] elements after reload").toBe(0)

  // the knowledge is durable: every minted (deckKey, qhash) credit survives in BOTH the raw
  // on-disk blob and the reloaded app's own _progressBlob() — exact stage values, no drift
  expect(after.rawStage, "the on-disk blob carries a stage map").toBeTruthy()
  expect(after.appStage, "the reloaded app re-ingested a stage map").toBeTruthy()
  for (const { key, qhash, stage } of minted) {
    expect((after.rawStage[key] || {})[qhash], `raw blob stage[${key}][${qhash}] survives exactly`).toBe(stage)
    expect((after.appStage[key] || {})[qhash], `reloaded _progressBlob().stage[${key}][${qhash}] survives exactly`).toBe(
      stage,
    )
  }

  expect(errors, "no pageerror across the climb, the reload, and the re-ingest").toEqual([])
})
