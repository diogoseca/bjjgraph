/* @hyperspace {"theme":"unlock-economy","L":"lapsed-returner","F":"settings","B":"economy-math"} @invariant "Frame exclusion shrinks the unit-done denominator: in nogi, a unit containing a gi-only lesson reaches unit_done with that lesson at prep=0 (row data-live='0'), because the excluded lesson is out of the done-math — completion is achievable entirely through nogi-viable lessons plus the checkpoint." */
import { test, expect, type Page } from "@playwright/test"
import { journey, Journey } from "../dsl"
import { lapsedReturner, CURRICULUM } from "./personas"

/**
 * RETURNER NOGI UNIT-DONE SKIPS GI-ONLY LESSON — a lapsed white-belt holder comes back as a
 * nogi player and finishes the one unit that carries a gi-only lesson WITHOUT EVER TOUCHING
 * IT: every nogi-viable sibling drilled to goal + the checkpoint passed lands unit_done while
 * the excluded lesson sits at prep=0. The done-math denominator is the LIVE set, not the
 * authored lesson list. A gi counterfactual proves the same career is refused in gi.
 *
 * Mechanism under test (neural/src/app.src.jsx, probe-verified 2x green — 3s nogi arc,
 * ~30s gi counterfactual, retries=0):
 *   - unitComplete (2429-2432): live = lessons.filter(_lessonLive); done = live.length>0 &&
 *     live.every(lessonDone) && units[uk].checkpoint — the gi-only lesson is OUT of the
 *     conjunction in nogi (_lessonLive 2428: (frames||[gi,nogi]).includes(giMode)).
 *   - startCheckpoint (3462-3466): re-checks the SAME live set; in gi the untouched gi-only
 *     lesson re-enters it undone → "Checkpoint locked" + return (no beat, _checkpoint stays
 *     null) — the counterfactual's teeth. On success it CLOSES the explorer (3479), so the
 *     post-pass path assertions re-toggleExplorer first.
 *   - _checkpointAnswer pass branch (3504+): firstTry >= pass → units[uk].checkpoint=true,
 *     checkpoint_passed + unit_done beats, _flushSave().
 *   - SEED GOTCHA: lapsedReturner() alone leaves the target belt LOCKED — renderBeltPath
 *     uLocked = !beltUnlocked(bi) || !prevUnitDone (2489) and a locked checkpoint row has a
 *     NULL click handler (2511). The seed tops up: every prior belt won, every earlier unit
 *     in the target belt fully done, ONLY the nogi-viable target lessons drilled to goal
 *     (goal = min(3, deckSize) <= 3, 2426).
 *
 * Determinism: rng(tag) falls back to Math.random on a dry queue, so queue DEPTH is the
 * determinism — checkpoint-pick cards+2, mc-pick 260, mc-shuffle 80 (probe-measured
 * headroom). All keys/counts derive from the served curriculum fixture (purple/
 * de-la-riva-bottom with gi-only "Berimbolo Entry|Attacker" at authoring — unpinned).
 */

/** First unit (belts→units flat order) with a gi-only (nogi-excluded) lesson AND at least
 *  one nogi-viable sibling — the denominator-shrink shape the invariant needs. */
function nogiSkippedUnit() {
  const belts: any[] = CURRICULUM.belts
  const liveInNogi = (l: any) => ((l.frames || ["gi", "nogi"]) as string[]).indexOf("nogi") >= 0
  for (let bi = 0; bi < belts.length; bi++) {
    const belt = belts[bi]
    for (let ui = 0; ui < belt.units.length; ui++) {
      const unit = belt.units[ui]
      const giOnlyKeys = unit.lessons.filter((l: any) => !liveInNogi(l)).map((l: any) => l.deckKey as string)
      const nogiKeys = unit.lessons.filter(liveInNogi).map((l: any) => l.deckKey as string)
      if (!giOnlyKeys.length || !nogiKeys.length) continue
      return {
        belt,
        unit,
        uk: `${belt.id}/${unit.id}`,
        cp: unit.checkpoint as { cards: number; pass: number },
        giOnlyKeys,
        nogiKeys,
        prevUnits: belt.units.slice(0, ui) as any[],
        priorBeltIds: belts.slice(0, bi).map((b: any) => b.id as string),
      }
    }
  }
  return null
}
const HIT = nogiSkippedUnit()

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

/** Lapsed returner's comeback blob, topped up so the target unit is REACHABLE but unsat:
 *  prior belts won + earlier units done (row clickable), nogi-viable target lessons at goal,
 *  the gi-only lesson at prep=0, the target checkpoint unpassed. Same seed for BOTH frames —
 *  only the giMode setting differs between the two tests. */
function returnerAtUnit(): any {
  const H = HIT!
  const seed: any = lapsedReturner() // full white career + white belt won
  for (const id of H.priorBeltIds) seed.belts.won[id] = { moves: 14, dominance: 4, byPoints: false }
  for (const u of H.prevUnits) {
    seed.units[`${H.belt.id}/${u.id}`] = { checkpoint: true, t: 1 }
    for (const l of u.lessons) {
      seed.prep[l.deckKey] = 3
      seed.rec[l.deckKey] = 3
    }
  }
  for (const k of H.nogiKeys) seed.prep[k] = 3 // goal = min(3, deckSize) <= 3 → done
  for (const k of H.giOnlyKeys) {
    delete seed.prep[k] // the excluded lesson is NEVER touched: prep=0 for the whole arc
    delete seed.rec[k]
  }
  delete seed.units[H.uk] // unit_done must be EARNED this session
  return seed
}

/** rig every draw one checkpoint sitting consumes (depth IS the determinism) */
async function rigSitting(j: Journey, cards: number) {
  await j.rig("checkpoint-pick", seq(11, cards + 2))
  await j.rig("mc-pick", seq(22, 260))
  await j.rig("mc-shuffle", seq(33, 80))
}

/** curriculum preconditions the invariant rests on — HARD fail (not skip) if the corpus shifts */
function guardCorpus() {
  expect(HIT, "curriculum defines a unit with a gi-only lesson AND a nogi-viable sibling").toBeTruthy()
  const H = HIT!
  expect(H.cp && H.cp.cards, "hit unit authors a checkpoint quiz").toBeGreaterThan(0)
  expect(H.cp.pass, "all-correct answering clears the authored pass bar").toBeLessThanOrEqual(H.cp.cards)
  expect(H.giOnlyKeys.length + H.nogiKeys.length, "frames partition the unit's lessons").toBe(H.unit.lessons.length)
  for (const u of H.prevUnits)
    expect(
      (u.lessons as any[]).some((l) => ((l.frames || ["gi", "nogi"]) as string[]).indexOf("nogi") >= 0),
      `earlier unit ${u.id} keeps a non-empty nogi live set — prevUnitDone survives the frame flip`,
    ).toBe(true)
  return H
}

/** the app-side truth for the target: gi-only prep, unitComplete, pass record, stored blob */
function unitTruth(page: Page) {
  return page.evaluate(
    ([beltId, unitId, giKey, uk]) => {
      const a = (window as any).__neural
      const belt = a.curriculum.belts.find((b: any) => b.id === beltId)
      const unit = belt.units.find((u: any) => u.id === unitId)
      const stored = JSON.parse(localStorage.getItem("bjj-neural-progress") || "{}")
      return {
        giPrep: (a.prep && a.prep[giKey]) || 0,
        complete: !!a.unitComplete(beltId, unit),
        passRecorded: !!(a.units && a.units[uk] && a.units[uk].checkpoint),
        storedGiPrep: ((stored.prep || {})[giKey] as number) || 0,
        storedPass: !!((stored.units || {})[uk] && (stored.units || {})[uk].checkpoint),
      }
    },
    [HIT!.belt.id, HIT!.unit.id, HIT!.giOnlyKeys[0], HIT!.uk] as const,
  )
}

test("nogi: unit_done lands with the gi-only lesson untouched at prep=0 — it is out of the done-math denominator", async ({ page }) => {
  const H = guardCorpus()
  const j = journey(page)
  await j.boot("/", { initialState: returnerAtUnit() })

  // The comeback is a NOGI life: flip the settings rail before any path render.
  await page.evaluate(() => (window as any).__neural.setGiMode("nogi"))
  expect(await page.evaluate(() => (window as any).__neural._giMode), "settings rail landed the frame").toBe("nogi")
  await j.land("Mount Top")
  await rigSitting(j, H.cp.cards)

  await page.evaluate(() => (window as any).__neural.toggleExplorer())
  await expect(page.locator("[data-view]").first()).toBeVisible()
  await j.expectBeat("path_opened")

  // ── BEFORE: the excluded lesson is dead + undone; the unit is reachable but unsat ──
  const giRow = page.locator(`[data-lesson="${H.giOnlyKeys[0]}"]`).first()
  expect(await giRow.getAttribute("data-live"), "gi-only row dead in nogi").toBe("0")
  expect(await giRow.getAttribute("aria-disabled"), "gi-only row disabled in nogi").toBe("true")
  expect(await giRow.getAttribute("data-done"), "gi-only lesson NOT done — prep=0, never drilled").toBeNull()
  expect(
    await page.locator(`[data-lesson="${H.nogiKeys[0]}"]`).first().getAttribute("data-done"),
    "nogi-viable sibling drilled to goal — the live half of the denominator is satisfied",
  ).toBe("1")
  expect(
    await page.locator(`[data-unit="${H.uk}"]`).first().getAttribute("data-locked"),
    "target unit reachable — prior belts won + earlier units done",
  ).toBeNull()
  expect(await page.locator(`[data-unit="${H.uk}"]`).first().getAttribute("data-done"), "unit starts not-done").toBeNull()
  expect(
    await page.locator(`[data-checkpoint="${H.uk}"]`).first().getAttribute("data-done"),
    "checkpoint starts not-done",
  ).toBeNull()
  const before = await unitTruth(page)
  expect(before.giPrep, "gi-only prep is 0 before the sitting").toBe(0)
  expect(before.complete, "unitComplete false while the checkpoint is unsat").toBe(false)

  // ── SIT the checkpoint through the real row; picks are pre-drawn at start ──
  await page.locator(`[data-checkpoint="${H.uk}"]`).first().click()
  await j.advance(400)
  await j.expectBeat("checkpoint_start")
  const start = (await j.beats()).filter((b: any) => b.beat === "checkpoint_start").pop() as any
  expect(start.unit, "quiz targets the discovered unit").toBe(H.uk)
  expect(start.cards, "full authored deal drawn from nogi-viable decks alone").toBe(H.cp.cards)

  // The denominator claim in data form: the pre-drawn pool is built from _lessonLive decks only.
  const picks: string[] = await page.evaluate(() =>
    (((window as any).__neural._checkpoint || {}).picks || []).map((p: any) => p.key),
  )
  expect(picks.length, "live quiz holds the full deal").toBe(H.cp.cards)
  expect(picks.filter((k) => H.giOnlyKeys.includes(k)).length, "ZERO picks from the gi-only deck").toBe(0)
  expect(picks.every((k) => H.nogiKeys.includes(k)), "every pick's deckKey is nogi-viable").toBe(true)

  // ── ANSWER every card correct via the _mc truth rail ──
  for (let i = 0; i < picks.length; i++) {
    const mc = await page.evaluate(() => {
      const m = (window as any).__neural._mc
      return m ? { correct: m.correct } : null
    })
    expect(mc, `card ${i + 1} presented as MC`).toBeTruthy()
    await page.locator("[data-mc-opt]").nth(mc!.correct).click()
    await j.advance(500)
  }

  // ── THE INVARIANT: unit_done with the excluded lesson still at prep=0 ──
  const beats = (await j.beats()) as any[]
  const passes = beats.filter((b) => b.beat === "checkpoint_passed")
  expect(passes.length, "exactly one checkpoint_passed").toBe(1)
  expect(passes[0].unit, "pass beat names the unit").toBe(H.uk)
  expect(passes[0].firstTry, "all-correct sitting scores every card").toBe(picks.length)
  expect(passes[0].of, "pass beat carries the dealt size").toBe(picks.length)
  const dones = beats.filter((b) => b.beat === "unit_done")
  expect(dones.length, "exactly one unit_done").toBe(1)
  expect(dones[0].unit, "unit_done names the gi-only-carrying unit").toBe(H.uk)
  expect(dones[0].belt, "unit_done names the belt").toBe(H.belt.id)
  expect(beats.filter((b) => b.beat === "checkpoint_failed").length, "no fail beat on the clean sitting").toBe(0)

  const after = await unitTruth(page)
  expect(after.giPrep, "gi-only prep STILL 0 after unit_done — completion never touched it").toBe(0)
  expect(after.storedGiPrep, "persisted blob minted no credit for the excluded lesson").toBe(0)
  expect(after.complete, "unitComplete true in nogi — the live-set conjunction is satisfied").toBe(true)
  expect(after.passRecorded && after.storedPass, "checkpoint pass recorded live + persisted").toBe(true)

  // ── The path shows it (startCheckpoint closed the explorer — reopen for the re-render) ──
  await page.evaluate(() => (window as any).__neural.toggleExplorer())
  await expect(page.locator("[data-view]").first()).toBeVisible()
  expect(await page.locator(`[data-unit="${H.uk}"]`).first().getAttribute("data-done"), "unit row done").toBe("1")
  expect(
    await page.locator(`[data-checkpoint="${H.uk}"]`).first().getAttribute("data-done"),
    "checkpoint row done",
  ).toBe("1")
  expect(await giRow.getAttribute("data-live"), "gi-only row STILL dead after unit_done").toBe("0")
  expect(await giRow.getAttribute("aria-disabled"), "gi-only row STILL disabled").toBe("true")
  expect(await giRow.getAttribute("data-done"), "gi-only row STILL not done — skipped, not credited").toBeNull()
})

test("gi counterfactual: the SAME career is refused at the checkpoint — the gi-only lesson re-enters the denominator", async ({ page }) => {
  const H = guardCorpus()
  const j = journey(page)
  // Identical seed, DEFAULT frame (gi) — the only variable is the frame.
  await j.boot("/", { initialState: returnerAtUnit() })
  expect(await page.evaluate(() => (window as any).__neural._giMode === "nogi"), "default frame resolves to gi").toBe(false)
  await j.land("Mount Top")
  await rigSitting(j, H.cp.cards) // were the gate broken, the wrongly-dealt quiz would still be rigged

  await page.evaluate(() => (window as any).__neural.toggleExplorer())
  await expect(page.locator("[data-view]").first()).toBeVisible()
  await j.expectBeat("path_opened")

  // In gi the gi-only row is ALIVE and undone — it re-enters the done-math as an unsat member.
  const giRow = page.locator(`[data-lesson="${H.giOnlyKeys[0]}"]`).first()
  expect(await giRow.getAttribute("data-live"), "gi-only row alive in gi").toBe("1")
  expect(await giRow.getAttribute("aria-disabled"), "gi-only row enabled in gi").toBeNull()
  expect(await giRow.getAttribute("data-done"), "gi-only lesson undone — prep=0").toBeNull()
  expect(
    await page.locator(`[data-unit="${H.uk}"]`).first().getAttribute("data-locked"),
    "unit row reachable in gi too — the refusal is the lesson gate, not the unlock chain",
  ).toBeNull()

  // ── CLICK: the row has a live handler, but startCheckpoint's live-set re-check refuses ──
  await page.locator(`[data-checkpoint="${H.uk}"]`).first().click()
  await j.advance(400)
  const names = ((await j.beats()) as any[]).map((b) => b.beat)
  expect(names, "no checkpoint_start — the sitting never begins in gi").not.toContain("checkpoint_start")
  expect(names, "no pass beat").not.toContain("checkpoint_passed")
  expect(names, "no unit_done — the denominator now includes the untouched lesson").not.toContain("unit_done")
  expect(await page.evaluate(() => !!(window as any).__neural._checkpoint), "_checkpoint stays null").toBe(false)
  await expect(
    page.locator("[data-view]").first(),
    "explorer never closed — the refusal returns before startCheckpoint's toggle",
  ).toBeVisible()

  const truth = await unitTruth(page)
  expect(truth.complete, "unitComplete false in gi — same blob, bigger denominator").toBe(false)
  expect(truth.passRecorded || truth.storedPass, "no pass record minted live or persisted").toBe(false)
  expect(
    await page.locator(`[data-unit="${H.uk}"]`).first().getAttribute("data-done"),
    "unit row stays not-done in gi",
  ).toBeNull()
})
