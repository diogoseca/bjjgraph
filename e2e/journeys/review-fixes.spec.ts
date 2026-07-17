import { test, expect } from "@playwright/test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { journey } from "../dsl"

/**
 * v1.64.2 — HARDENING from the Belt Path adversarial review (10 confirmed prod-path bugs).
 *
 * These journeys cover the state-machine findings the harness CAN exercise:
 *   - HIGH: an abandoned checkpoint quiz must NOT contaminate the next opened deck / auto-pass
 *     the unit (_checkpoint was never cleared on close).
 *   - MED: starting a roll / belt test with a checkpoint open must clear it.
 *   - LOW: re-clicking Checkpoint mid-quiz must not silently reset progress.
 *   - MED: 'Mastered' must not be inflatable by re-grading ONE card — rec counts DISTINCT
 *     cards proven by recall.
 * (The prod-only lifecycle findings — 400ms save debounce, AudioContext/oscillator teardown,
 *  600ms MC auto-advance, per-key settings merge — are fixed in code with light rails below;
 *  the harness cannot fully exercise real timers / AudioContext / cloud sync.)
 */

const CURRICULUM = JSON.parse(
  readFileSync(resolve(__dirname, "../../source/public/static/neural/curriculum.json"), "utf8"),
)
const WHITE = CURRICULUM.belts[0]
const UNIT1 = WHITE.units[0]

/** unit-1 lessons drilled but the checkpoint NOT yet passed (so it's attemptable) */
function lessonsDoneBlob() {
  const prep: Record<string, number> = {}
  for (const l of UNIT1.lessons) prep[l.deckKey] = 3
  return { v: 2, prep, rec: {}, stage: {}, units: {}, belts: { won: {} }, days: {}, settings: {} }
}

async function startCheckpoint(j: any, page: any) {
  await page.evaluate(() => (window as any).__neural.toggleExplorer())
  await page.locator(`[data-checkpoint="${WHITE.id}/${UNIT1.id}"]`).first().click()
  await j.advance(400)
  await expect(page.locator("[data-mc-opt]").first()).toBeVisible()
}

test("abandoned checkpoint does not contaminate the next deck or auto-pass the unit", async ({ page }) => {
  const j = journey(page)
  await j.boot("/", { initialState: lessonsDoneBlob() })
  await j.land("Mount Top")
  await startCheckpoint(j, page)

  // answer ONE quiz card, then ABANDON via the drill close (the X / tap-away choke)
  const t0 = await page.evaluate(() => (window as any).__neural._mc)
  await page.locator("[data-mc-opt]").nth(t0.correct).click()
  await j.advance(400)
  await page.evaluate(() => (window as any).__neural.setDeckOpen(false))

  // FIX: closing the checkpoint deck cancels the quiz
  expect(await page.evaluate(() => !!(window as any).__neural._checkpoint)).toBe(false)

  // open a normal lesson deck and answer its MC cards — the abandoned unit must NOT complete
  const beatsBefore = (await j.beats()).length
  await page.evaluate(() => (window as any).__neural.toggleExplorer())
  await page.locator(`[data-lesson="${UNIT1.lessons[0].deckKey}"]`).first().click()
  await j.advance(600)
  for (let i = 0; i < 4; i++) {
    const mc = await page.evaluate(() => {
      const a = (window as any).__neural
      for (const c of a.deck || []) if (a.mcClip(c.a) && a.cardStage(a._deckInfo.key, c.q) < 2) { a.presentCard(a.qhash(c.q)); return a._mc }
      return null
    })
    if (!mc) break
    await page.locator("[data-mc-opt]").nth(mc.correct).click()
    await j.advance(400)
  }
  const state = await page.evaluate(
    (uk) => {
      const a = (window as any).__neural
      return { unitDone: !!(a.units[uk] && a.units[uk].checkpoint), ckpt: !!a._checkpoint }
    },
    `${WHITE.id}/${UNIT1.id}`,
  )
  expect(state.unitDone).toBe(false) // NOT auto-completed against unrelated cards
  expect(state.ckpt).toBe(false)
  const newBeats = (await j.beats()).slice(beatsBefore).map((b: any) => b.beat)
  expect(newBeats).not.toContain("checkpoint_passed")
  expect(newBeats).not.toContain("unit_done")
})

test("starting a roll clears an open checkpoint quiz", async ({ page }) => {
  const j = journey(page)
  await j.boot("/", { initialState: lessonsDoneBlob() })
  await j.land("Mount Top")
  await startCheckpoint(j, page)
  expect(await page.evaluate(() => !!(window as any).__neural._checkpoint)).toBe(true)

  await page.evaluate(() => (window as any).__neural.resetRoll())
  await j.advance(2000)
  expect(await page.evaluate(() => !!(window as any).__neural._checkpoint)).toBe(false)
})

test("re-clicking Checkpoint mid-quiz does not silently reset progress", async ({ page }) => {
  const j = journey(page)
  await j.boot("/", { initialState: lessonsDoneBlob() })
  await j.land("Mount Top")
  await startCheckpoint(j, page)

  // answer one card → i advances
  const mc = await page.evaluate(() => (window as any).__neural._mc)
  await page.locator("[data-mc-opt]").nth(mc.correct).click()
  await j.advance(400)
  const i1 = await page.evaluate(() => (window as any).__neural._checkpoint?.i ?? -1)
  expect(i1).toBeGreaterThanOrEqual(1)

  // re-entry (the row stays clickable) must NOT reset to card 0
  await page.evaluate(
    (args) => {
      const a = (window as any).__neural
      const belt = a.curriculum.belts.find((b: any) => b.id === args.bid)
      const unit = belt.units.find((u: any) => u.id === args.uid)
      a.startCheckpoint(args.bid, unit)
    },
    { bid: WHITE.id, uid: UNIT1.id },
  )
  const i2 = await page.evaluate(() => (window as any).__neural._checkpoint?.i ?? -1)
  expect(i2).toBe(i1) // guard held — no reset to 0
})

test("mastered is not inflatable: rec counts DISTINCT cards proven by recall", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await page.evaluate(() => (window as any).__neural.toggleExplorer())
  await page.locator(`[data-lesson="${UNIT1.lessons[0].deckKey}"]`).first().click()
  await j.advance(600)
  const key = UNIT1.lessons[0].deckKey

  // re-grade ONE card's recall 5× → rec climbs by AT MOST 1 (deduped on the recall-proven cross)
  const rec1 = await page.evaluate((k) => {
    const a = (window as any).__neural
    const card = a.deck.find((c: any) => a.mcClip(c.a))
    const qh = a.qhash(card.q)
    ;(a.stage[k] = a.stage[k] || {})[qh] = 2 // graduated to the recall gate
    for (let n = 0; n < 5; n++) { a.presentCard(qh); a.revealed = true; a.recallGrade(true) }
    return a.rec[k] || 0
  }, key)
  expect(rec1).toBeLessThanOrEqual(1)

  // THREE distinct cards each recalled → rec reaches 3 (the honest path to a mastered deck)
  const rec3 = await page.evaluate((k) => {
    const a = (window as any).__neural
    const cards = a.deck.filter((c: any) => a.mcClip(c.a)).slice(0, 3)
    for (const c of cards) {
      const qh = a.qhash(c.q)
      ;(a.stage[k] = a.stage[k] || {})[qh] = 2
      a.presentCard(qh); a.revealed = true; a.recallGrade(true)
    }
    return a.rec[k] || 0
  }, key)
  expect(rec3).toBeGreaterThanOrEqual(3)
})

test("prod-path rails exist: sound.destroy, save flush, tracked MC-advance timer", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  const rails = await page.evaluate(() => {
    const a = (window as any).__neural
    return {
      soundDestroy: typeof a.sound?.destroy === "function",
      flush: typeof a._flushSave === "function",
      settingsAtTracked: (a.set("mcMode", "auto"), typeof (a._settingsAt || {}).mcMode === "number"),
    }
  })
  expect(rails.soundDestroy).toBe(true)
  expect(rails.flush).toBe(true)
  expect(rails.settingsAtTracked).toBe(true)
  // a pagehide flush must persist current state without throwing
  const persisted = await page.evaluate(() => {
    const a = (window as any).__neural
    a.rec["probe|Top"] = 7
    a._flushSave()
    return JSON.parse(localStorage.getItem("bjj-neural-progress") || "{}").rec?.["probe|Top"]
  })
  expect(persisted).toBe(7)
})
