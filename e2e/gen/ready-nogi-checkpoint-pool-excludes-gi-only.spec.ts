/* @hyperspace {"theme":"unlock-economy","L":"belt-ready","F":"settings","B":"guard-limit"} @invariant "In nogi the checkpoint quiz never draws from a gi-only lesson deck: the gi-only lesson drops out of the rendered lesson list and the quiz pool alike — every pre-drawn pick's deckKey belongs to the unit's nogi-viable lessons, zero come from the frames-gi-only deck, and the deal redistributes to the authored count." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { beltReady, CURRICULUM } from "./personas"

/**
 * READY NOGI CHECKPOINT POOL EXCLUDES GI-ONLY — a belt-ready player flips to nogi and sits
 * the one checkpoint whose unit carries a gi-only lesson. The quiz pool must be built from
 * the SAME _lessonLive frame gate the row's done-math iterates: every pre-drawn pick comes
 * from a nogi-viable deck, zero from the frames:["gi"] deck, and the deal REDISTRIBUTES to
 * the authored count instead of shrinking.
 *
 * Mechanism under test (neural/src/app.src.jsx, probe-verified green 2/2 ~2.8s, deterministic):
 *   - startCheckpoint (3462-3483) filters `unit.lessons.filter(_lessonLive)` and pools ONLY
 *     those decks' mcClip-able cards; want = min(unit.checkpoint.cards, pool.length); picks
 *     are PRE-DRAWN at start via rng("checkpoint-pick") into _checkpoint.picks — so the
 *     census below reads the ENTIRE queue with no answering.
 *   - _lessonLive (2428): (l.frames||["gi","nogi"]).includes(giMode) — frames:["gi"] is dead
 *     in nogi; unitComplete iterates the SAME live set (the shared frame gate).
 *   - v1.74 Challenges UI: challengeCurriculumElement renders ONLY the live lessons — a
 *     gi-only lesson has NO button at all in nogi (the rendered list and the quiz pool
 *     share _lessonLive). The checkpoint button is enabled because every LIVE lesson is at
 *     goal. Tracks are open (locks retired); the prior-belt victories in the seed are a
 *     harmless holdover. The hit unit's <details> group is collapsed by default — opened
 *     before the click.
 *   - _checkpointShow (3492) sets _posKey = pick.key; _mcBlock (3382) emits mc_shown{deckKey}
 *     — the UI-walks-the-queue rail.
 *
 * Adversarial rig: the pool is built in lesson order and the gi-only lesson sits LAST in the
 * hit unit, so in a gate-broken world (gi-only deck wrongly pooled) the pool's TAIL indices
 * are exactly its cards. checkpoint-pick is rigged with high-tail values (0.85-0.99) that
 * WOULD land in that block if the exclusion ever broke — fromGiOnly===0 has real teeth, and
 * the gi-only deck's mcClip-able contribution is asserted >0 so the exclusion is never vacuous.
 *
 * Census asserts the LAW, not totals: dealt === min(authored cards, live-pool size) with the
 * pool size computed in-page from the served decks (nogi 49 / gi 61 at authoring — unpinned).
 * Per-deck spread is rig-value dependent and deliberately NOT pinned.
 */

/** First unit (belts→units flat order) with a lesson whose frames EXCLUDE "nogi" —
 *  purple/de-la-riva-bottom at authoring (gi-only: Berimbolo Entry|Attacker, 1 of 6).
 *  Dynamic scan is the corpus-robust anchor; all keys/counts derive from the served fixture. */
function nogiExcludedUnit() {
  const belts: any[] = CURRICULUM.belts
  const liveInNogi = (l: any) => ((l.frames || ["gi", "nogi"]) as string[]).indexOf("nogi") >= 0
  for (let bi = 0; bi < belts.length; bi++) {
    const belt = belts[bi]
    for (const unit of belt.units) {
      const giOnlyKeys = unit.lessons.filter((l: any) => !liveInNogi(l)).map((l: any) => l.deckKey as string)
      if (!giOnlyKeys.length) continue
      return {
        belt,
        unit,
        uk: `${belt.id}/${unit.id}`,
        cp: unit.checkpoint as { cards: number; pass: number },
        giOnlyKeys,
        nogiKeys: unit.lessons.filter(liveInNogi).map((l: any) => l.deckKey as string),
        priorBeltIds: belts.slice(0, bi).map((b: any) => b.id as string),
      }
    }
  }
  return null
}
const HIT = nogiExcludedUnit()

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

/** high-tail draws — would select from the gi-only block appended LAST were the gate broken */
const TAIL = [0.97, 0.89, 0.93, 0.99, 0.86, 0.91, 0.95, 0.88, 0.9, 0.96]

test("nogi checkpoint pool draws only from nogi-viable decks — the gi-only deck contributes zero picks", async ({ page }) => {
  // Curriculum preconditions the invariant rests on — HARD fail (not skip) if the corpus shifts.
  expect(HIT, "curriculum defines a unit with a gi-only (nogi-excluded) lesson").toBeTruthy()
  const H = HIT!
  expect(H.cp && H.cp.cards, "hit unit authors a checkpoint quiz").toBeGreaterThan(0)
  expect(H.nogiKeys.length, "hit unit keeps nogi-viable lessons — the nogi pool is real").toBeGreaterThan(0)
  expect(H.giOnlyKeys.length + H.nogiKeys.length, "frames partition the unit's lessons").toBe(H.unit.lessons.length)
  expect(TAIL.length, "checkpoint-pick queue pre-sized for the full deal").toBeGreaterThanOrEqual(H.cp.cards)

  const j = journey(page)
  // SEED: belt-ready AT the hit belt minus ONLY the target unit's checkpoint pass, PLUS every
  // prior belt won — beltUnlocked(bi) needs the previous belt's victory, and a locked row gets
  // NO click handler (renderBeltPath:2511); prior units stay checkpoint:true so uLocked=false.
  const seed: any = beltReady(H.belt)
  delete seed.units[H.uk]
  for (const id of H.priorBeltIds) seed.belts.won[id] = { moves: 14, dominance: 4, byPoints: false }
  await j.boot("/", { initialState: seed })

  // Flip the frame via the settings rail BEFORE any path render — the run lives in nogi.
  await page.evaluate(() => (window as any).__neural.setGiMode("nogi"))
  expect(await page.evaluate(() => (window as any).__neural._giMode), "settings rail landed the frame").toBe("nogi")
  await j.land("Mount Top")

  // Rig every draw this sitting consumes (queue DEPTH is the determinism — dry queues fall
  // back to Math.random): the deal itself + the first card's MC render (never answered).
  await j.rig("checkpoint-pick", TAIL)
  await j.rig("mc-pick", seq(7, 200))
  await j.rig("mc-shuffle", seq(11, 40))

  await page.evaluate(() => (window as any).__neural.toggleExplorer())
  await expect(page.locator("[data-view]").first()).toBeVisible()
  await j.expectBeat("challenges_opened")
  // only the SELECTED track renders its curriculum (v1.74) — select the hit belt's track
  await page.locator(`.ng-track-card[data-track="${H.belt.id}"]`).click()

  // ── Precondition: the frame gate discriminates in the RENDER — gi-only lessons have no
  //    button at all in nogi, the nogi-viable sibling renders ──
  for (const k of H.giOnlyKeys) {
    expect(
      await page.locator(`[data-lesson="${k}"]`).count(),
      `gi-only lesson ${k} unrendered in nogi`,
    ).toBe(0)
  }
  expect(
    await page.locator(`[data-lesson="${H.nogiKeys[0]}"]`).count(),
    "nogi-viable sibling stays rendered — the gate is per-frame, not blanket",
  ).toBe(1)

  // ── Reachable + unsat: checkpoint enabled (every LIVE lesson at goal), not yet passed ──
  expect(
    await page.locator(`[data-checkpoint="${H.uk}"]`).first().isDisabled(),
    "checkpoint ENABLED — the live set is fully drilled",
  ).toBe(false)
  expect(
    await page.locator(`[data-checkpoint="${H.uk}"]`).first().textContent(),
    "checkpoint starts not-cleared",
  ).not.toContain("cleared")

  // ── The shared gate: app's _lessonLive set === curriculum-derived nogi-viable keys — the ──
  // ── SAME live set unitComplete's done-math iterates is what the quiz pool will filter on. ──
  const liveSet: string[] = await page.evaluate(
    ([beltId, unitId]) => {
      const a = (window as any).__neural
      const belt = a.curriculum.belts.find((b: any) => b.id === beltId)
      const unit = belt.units.find((u: any) => u.id === unitId)
      return unit.lessons.filter((l: any) => a._lessonLive(l)).map((l: any) => l.deckKey)
    },
    [H.belt.id, H.unit.id] as const,
  )
  expect([...liveSet].sort(), "app's live set == curriculum nogi-viable set (the shared frame gate)").toEqual(
    [...H.nogiKeys].sort(),
  )

  // ── Pool census inputs, in-page via the app's OWN mcClip over the served decks (law, no totals) ──
  const pools = await page.evaluate(
    ([nogiKeys, giKeys]) => {
      const a = (window as any).__neural
      const decks = (a.flashcards && a.flashcards.decks) || {}
      const count = (keys: string[]) =>
        keys.reduce((n: number, k: string) => n + (((decks[k] || {}).cards || []) as any[]).filter((c) => a.mcClip(c.a)).length, 0)
      return { nogi: count(nogiKeys as string[]), giOnly: count(giKeys as string[]) }
    },
    [H.nogiKeys, H.giOnlyKeys] as const,
  )
  expect(pools.giOnly, "gi-only deck HAS quizzable cards — the exclusion does real work, never vacuous").toBeGreaterThan(0)
  expect(pools.nogi, "nogi-viable decks cover the authored count — the deal can redistribute, not shrink").toBeGreaterThanOrEqual(H.cp.cards)

  // ── SIT: click the real checkpoint button; picks are pre-drawn at start ──
  await page
    .locator(`.ng-challenge-group:has([data-checkpoint="${H.uk}"])`)
    .first()
    .evaluate((el) => ((el as HTMLDetailsElement).open = true)) // hit unit's group is collapsed
  await page.locator(`[data-checkpoint="${H.uk}"]`).first().click()
  await j.advance(400)
  await j.decksSettled() // quiz pool decks hydrate async (v1.80.4) - settle before the one-shot beat check
  await j.expectBeat("checkpoint_start")
  const start = (await j.beats()).filter((b: any) => b.beat === "checkpoint_start").pop() as any
  expect(start.unit, "quiz targets the discovered unit").toBe(H.uk)
  expect(start.cards, "dealt == min(authored cards, live pool) — the pool law").toBe(Math.min(H.cp.cards, pools.nogi))
  expect(start.cards, "count REDISTRIBUTES to the authored size — the exclusion never shrinks the deal").toBe(H.cp.cards)

  // ── THE INVARIANT — census over the ENTIRE pre-drawn queue (no answering needed) ──
  const picks: string[] = await page.evaluate(() =>
    (((window as any).__neural._checkpoint || {}).picks || []).map((p: any) => p.key),
  )
  expect(picks.length, "live quiz holds the full pre-drawn deal").toBe(Math.min(H.cp.cards, pools.nogi))
  const fromGiOnly = picks.filter((k) => H.giOnlyKeys.includes(k)).length
  const outsideUnit = picks.filter((k) => !H.nogiKeys.includes(k) && !H.giOnlyKeys.includes(k)).length
  expect(fromGiOnly, "ZERO picks sourced from the frames-gi-only deck").toBe(0)
  expect(outsideUnit, "zero picks sourced outside the unit's own decks").toBe(0)
  expect(
    picks.every((k) => H.nogiKeys.includes(k)),
    "every pick's deckKey is nogi-viable — pool membership ⊆ the live set",
  ).toBe(true)

  // ── The UI walks the same queue: drill opened AT the head pick, presented as MC ──
  const rail = await page.evaluate(() => {
    const a = (window as any).__neural
    return { posKey: a._posKey, mc: !!a._mc, open: !!a._checkpoint }
  })
  expect(rail.open, "quiz in progress — queue not consumed by the census").toBe(true)
  expect(rail.posKey, "drill opened at the queue head (_posKey == picks[0])").toBe(picks[0])
  expect(rail.mc, "head card presented as MC — truth on _mc, no recall fallback").toBe(true)
  await expect(page.locator("[data-mc-opt]").first(), "MC options on screen").toBeVisible()
  const shown = (await j.beats()).filter((b: any) => b.beat === "mc_shown").pop() as any
  expect(shown && shown.deckKey, "mc_shown names the head pick's deck — a nogi-viable key").toBe(picks[0])
})
