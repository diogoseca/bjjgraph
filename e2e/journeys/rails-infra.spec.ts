import { test, expect } from "@playwright/test"
import { journey } from "../dsl"

/**
 * BELT PATH P0 — RAILS + TEST INFRA (spec first).
 *
 * Everything here is assertable on the EXISTING game — no curriculum required. These rails
 * are what every later Belt Path journey (belt-path, mc-flashcards, belt-test, capstones)
 * depends on:
 *
 *   fx beats: opponent_attack {technique, idx}  — opponent goes for a finish
 *             opponent_move   {technique, idx}  — opponent takes a positional counter
 *             (opponent picks currently emit NO beat, only a DOM toast — Phase 4's
 *              belt-pool assertions are impossible without these)
 *   DSL:      boot({ initialState }) — seed a synthetic bjj-neural-progress blob AFTER the
 *             wipe and BEFORE the app reads storage (hash-carried, per-navigation, so stale
 *             seeds can never leak across boots)
 *   Route:    **\/curriculum.json — hermetic like flashcards/graph-data (fulfills the emitted
 *             file when present, else a clean 404; never leaves the box)
 *
 * Tests 4–5 are forward-guards (they can pass pre-implementation); tests 1–3 are the red
 * drivers and must fail with named-missing-thing errors before implementation.
 */

test("opponent finish attempt emits opponent_attack with the technique", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  // our move fails → opponent's turn → rigged to go for the kill
  const options = await j.optionTitles()
  await j.rig("resolve", [0.99])
  await j.rig("outcome", [0.99])
  await j.rig("opp-finish", [0.01])
  await j.rig("opp-sub-pick", [0.01])
  await j.pick(options[0])
  await j.advanceUntil("opponent_attack", 20000)

  const beat = (await j.beats()).find((b: any) => b.beat === "opponent_attack") as any
  expect(typeof beat.technique).toBe("string")
  expect(beat.technique.length).toBeGreaterThan(0)
  expect(beat.idx).toBeGreaterThanOrEqual(0)
  // the beat tells the truth: idx resolves to a SUBMISSION node carrying that title
  const truth = await page.evaluate((b) => {
    const n = (window as any).__neural.nodes[b.idx]
    return { ty: n?.ty, t: n?.t }
  }, beat)
  expect(truth.ty).toBe("submissions")
  expect(truth.t).toBe(beat.technique)
})

test("opponent positional counter emits opponent_move (and no phantom attack)", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  const options = await j.optionTitles()
  await j.rig("resolve", [0.99])
  await j.rig("outcome", [0.99])
  await j.rig("opp-finish", [0.99]) // decline the finish → positional counter branch
  await j.rig("opp-pick", [0.01])
  await j.pick(options[0])
  await j.advanceUntil("opponent_move", 20000)

  const beats = await j.beats()
  const move = beats.find((b: any) => b.beat === "opponent_move") as any
  expect(typeof move.technique).toBe("string")
  const truth = await page.evaluate((b) => {
    const n = (window as any).__neural.nodes[b.idx]
    return { ty: n?.ty, t: n?.t }
  }, move)
  expect(["transitions", "submissions"]).toContain(truth.ty) // subs allowed: trans pool can be empty
  expect(truth.t).toBe(move.technique)
  expect(beats.filter((b: any) => b.beat === "opponent_attack").length).toBe(0)
})

test("boot({initialState}) seeds progress before the app reads storage", async ({ page }) => {
  const j = journey(page)
  await j.boot("/", { initialState: { v: 1, prep: { "Mount|Top": 3 }, days: {}, settings: {} } })

  const state = await page.evaluate(() => {
    const a = (window as any).__neural
    return { prep: a.prep?.["Mount|Top"] ?? null, mastered: a.masteredCount() }
  })
  expect(state.prep).toBe(3) // the blob landed post-wipe, pre-app-read
  expect(state.mastered).toBe(1)
})

test("stale-seed hygiene: a later un-seeded boot starts clean", async ({ page }) => {
  const j = journey(page)
  await j.boot("/", { initialState: { v: 1, prep: { "Mount|Top": 3 }, days: {}, settings: {} } })
  await j.boot("/") // no seed: the previous boot's seed must NOT leak into this one
  const prepKeys = await page.evaluate(() => Object.keys((window as any).__neural.prep || {}).length)
  expect(prepKeys).toBe(0)
})

test("curriculum.json is hermetic: deterministic response, never off-box", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  const status = await page.evaluate(() =>
    fetch("/static/neural/curriculum.json").then((r) => r.status).catch(() => -1),
  )
  expect(status).not.toBe(-1) // aborted/off-box would reject
  expect([200, 404]).toContain(status) // emitted file when present, clean 404 until Phase 1
})
