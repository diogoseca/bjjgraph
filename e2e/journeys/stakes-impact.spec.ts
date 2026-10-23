// v1.230.0: the owner dropped practise-before-you-try on 2026-10-15 (question 6).
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { bootVideoCards, NAME, CARD } from "../fixtures/video-cards"

/**
 * P3 — STAKES, IMPACT & THE LONG GAME (spec first). ONE balance change-set.
 *
 * Economy split (replaces flat 0.06/card cap 0.30):
 *   mastery(key) = 0.03/grade, cap 0.15 — permanent (prep-backed, persists)
 *   sharpness(key) = 0.10 set on every grade — decays 0.025 per landing (4 moves to zero)
 *   film first-look = one-time +0.04 the first time you watch a Short for a technique
 *   stateBonus(key) = mastery + sharpness  (drilling stays valuable forever; recency matters)
 *
 * Impact contrast: commit → hold 0.38s → needle sweep 0.7s vs a band sized to moveChance →
 *   sweep_land {inBand} → detonation (hit) / hit_stop (miss) → existing impact beats.
 * Victory cascade ≤1.5s on win; defeat_drain on loss. Opponent ladder persisted across reloads.
 *
 * Rails this spec forces: bonusSplit(key), ladderState(), startRecording()/stopRecording(),
 * beats: sweep_start, sweep_land, detonation, hit_stop, victory_cascade, defeat_drain,
 *        stakes, ladder_up/ladder_down, film_first_look.
 */

test("sharpness decays per landing, mastery persists", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  // pick a drillable TRANSITION with head-room — a submission's success would END the roll
  // (victory → fresh roll, first-land skips the decay tick this test measures)
  const target = await page.evaluate(() => {
    const a = (window as any).__neural
    for (const i of a.optionIdxs || []) {
      const n = a.nodes[i]
      const odds = Math.round(a.moveChance(n) * 100)
      if (n.ty === "transitions" && odds >= 20 && odds <= 70) return n.t
    }
    return ""
  })
  expect(target, "a transition option with odds in [20,70]").toBeTruthy()
  const key = await page.evaluate((t) => {
    const a = (window as any).__neural
    return a.deckKeyFor(a.nodes.find((n: any) => n.t === t)).key
  }, target)

  const before = await j.displayedOdds(target)
  await j.watchChoice(target)
  await j.studyChoice(target)
  await j.studyGrade()

  // one grade = +0.03 mastery (permanent) + 0.10 sharpness (fresh)
  const split1 = await page.evaluate((k) => (window as any).__neural.bonusSplit(k), key)
  expect(split1.mastery).toBeCloseTo(0.03, 5)
  expect(split1.sharp).toBeCloseTo(0.1, 5)
  expect((await j.displayedOdds(target)) - before).toBeGreaterThanOrEqual(12)

  // execute the move (rigged success) → next landing decays sharpness one step
  await j.rig("resolve", [0.01])
  await j.rig("outcome", [0.01])
  await page.keyboard.press("Escape")
  await j.pick(target)
  await j.advanceUntil("impact_success", 20000)
  await j.nextHand() // travel + landing (the decay tick) + the next deal
  const split2 = await page.evaluate((k) => (window as any).__neural.bonusSplit(k), key)
  expect(split2.sharp).toBeCloseTo(0.075, 5)
  expect(split2.mastery).toBeCloseTo(0.03, 5) // mastery untouched by the flow of the roll
})

test("impact contrast: tension sweep, detonation on hit, hit-stop on miss", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  // HIT: rigged success on a TRANSITION (a submission's success would end the roll and
  // hand the MISS phase a random, unrigged starting position)
  const hitTarget = await page.evaluate(() => {
    const a = (window as any).__neural
    for (const i of a.optionIdxs || []) if (a.nodes[i].ty === "transitions") return a.nodes[i].t
    return ""
  })
  expect(hitTarget, "a transition option to hit").toBeTruthy()
  await j.rig("resolve", [0.01])
  await j.rig("outcome", [0.01])
  await j.pick(hitTarget)
  await j.advanceUntil("sweep_start", 20000)
  await j.advance(700) // mid-needle
  await j.keyframe("p3-tension-sweep")
  await j.advanceUntil("impact_success", 20000)

  let beats = await j.beats()
  const names = beats.map((b: any) => b.beat)
  const iStart = names.indexOf("sweep_start"), iLand = names.indexOf("sweep_land")
  expect(iStart).toBeGreaterThanOrEqual(0)
  expect(iLand).toBeGreaterThan(iStart)
  expect((beats[iLand] as any).inBand).toBe(true)
  expect(names.indexOf("detonation")).toBeGreaterThan(iLand)
  expect(names.indexOf("impact_success")).toBeGreaterThan(names.indexOf("detonation"))
  // sweep envelope: 0.38s hold + 0.7s needle = ~1.08s of sim time
  const env = (beats[iLand] as any).t - (beats[iStart] as any).t
  expect(env).toBeGreaterThanOrEqual(0.9)
  expect(env).toBeLessThanOrEqual(1.4)
  const sweepBand = (beats[iStart] as any).band
  expect(sweepBand).toBeGreaterThan(0) // band sized to moveChance, carried on the beat

  // MISS: next decision, rigged fail → sweep lands out of band → hit-stop, NOT detonation
  await j.nextHand()
  const missTarget = await page.evaluate(() => {
    const a = (window as any).__neural
    return a._optList.find((o: any) => o.action === "finish" || o.node.ty === "transitions")?.node.t
  })
  expect(missTarget, "a resolving action for the miss phase").toBeTruthy()
  await j.rig("resolve", [0.99])
  await j.rig("outcome", [0.99])
  await j.pick(missTarget)
  await j.advanceUntil("impact_fail", 20000)
  beats = await j.beats()
  // slice AFTER the hit's impact_success — the hit's own detonation must not leak into
  // the miss-phase assertions
  const after = beats.slice(beats.map((b: any) => b.beat).indexOf("impact_success") + 1)
  const aNames = after.map((b: any) => b.beat)
  const iLand2 = aNames.indexOf("sweep_land")
  expect(iLand2).toBeGreaterThanOrEqual(0)
  expect((after[iLand2] as any).inBand).toBe(false)
  expect(aNames.indexOf("hit_stop")).toBeGreaterThan(iLand2)
  expect(aNames.filter((b) => b === "detonation").length).toBe(0) // success ≠ fail fx
})

test("victory cascade ≤1.5s on win; defeat drain on loss; ladder survives reload", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  // stakes announced at roll start
  await j.expectBeat("stakes")
  const rank0 = await page.evaluate(() => (window as any).__neural.ladderState().rank)

  // rigged submission win → victory cascade inside budget, ladder up
  const subName = await page.evaluate(() => {
    const a = (window as any).__neural
    const subs = (a.optionIdxs || []).map((i: number) => a.nodes[i]).filter((n: any) => n.ty === "submissions")
    return subs.length ? subs[0].t : null
  })
  expect(subName, "a submission option from Mount Top").toBeTruthy()
  await j.rig("resolve", [0.01])
  await j.pick(subName as string)
  await j.nextHand()
  await j.pick(subName as string) // Finish from the submission state
  await j.advanceUntil("roll_end", 20000)

  const beats = await j.beats()
  const cascade = beats.find((b: any) => b.beat === "victory_cascade") as any
  expect(cascade, "victory_cascade beat").toBeTruthy()
  expect(cascade.durMs).toBeLessThanOrEqual(1500)
  await j.keyframe("p3-victory-cascade")
  await j.expectBeat("ladder_up")
  const rank1 = await page.evaluate(() => (window as any).__neural.ladderState().rank)
  expect(rank1).toBe(rank0 + 1)

  // the ladder is persisted: reload WITHOUT wiping storage
  await j.boot("/", { preserveStorage: true })
  await j.land("Mount Top")
  const rankAfterReload = await page.evaluate(() => (window as any).__neural.ladderState().rank)
  expect(rankAfterReload).toBe(rank1)

  // defeat drains: lose by letting the defense window expire after a rigged catch
  expect(await j.optionTitles()).toContain("Consolidate Mount")
  await j.rig("resolve", [0.99])
  await j.rig("outcome", [0.99])
  await j.rig("opp-finish", [0.01])
  await j.rig("opp-sub-pick", [0.01])
  await j.pick("Consolidate Mount")
  await j.advanceUntil("caught", 20000)
  // v1.133.0: the escapes are untimed — expiry reveals the drill, it no longer taps you out.
  // The loss is earned the honest way: a rigged FAILED escape.
  await j.advance(800)
  await j.rig("escape", [0.99])
  await page.evaluate(() => { const a = (window as any).__neural; a._optPick(a._optList[0]) })
  await j.advanceUntil("roll_end", 20000)
  await j.expectBeat("defeat_drain")
  await j.expectBeat("ladder_down")
  const rank2 = await page.evaluate(() => (window as any).__neural.ladderState().rank)
  expect(rank2).toBe(rank1 - 1)
})

test("film-study first look: +4% on explicit playback once per technique, never stacking", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  const j = await bootVideoCards(page)
  const before = await j.displayedOdds(NAME)
  await j.clickByMouse(`${CARD} [data-choice-watch]`, "Watch the move")
  await expect(page.locator('[data-test-player]')).toHaveCount(1)
  expect(await j.displayedOdds(NAME), "opening the viewer awards nothing").toBe(before)
  const play = page.frameLocator('[data-test-player]').locator('button')
  await expect(play).toBeVisible()
  const hit = await play.boundingBox()
  expect(hit).not.toBeNull()
  await page.mouse.click(hit!.x + hit!.width / 2, hit!.y + hit!.height / 2)
  // STALE TIMING (v1.230.0, feat/video-cards; red on that branch's own build, H132): the fixture player's play is a
  // postMessage from its frame, so the reward lands after a turn of the event loop. Read it by poll, as
  // video-cards.spec does, and judge the second play only once the player has seen it.
  await expect.poll(async () => (await j.displayedOdds(NAME)) - before, "explicit playback earns +4").toBe(4)
  await j.expectBeat("film_first_look")
  await page.mouse.click(hit!.x + hit!.width / 2, hit!.y + hit!.height / 2)
  await expect.poll(() => page.evaluate(() => (window as any).__players.at(-1).play), "premise: the second play reached the player").toBe(2)
  expect((await j.displayedOdds(NAME)) - before, "a second playback does not stack").toBe(4)
  expect((await j.beats()).filter((b: any) => b.beat === "film_first_look").length).toBe(1)
})

test("journey recorder: captures actions and rng draws for replay authoring", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await page.evaluate(() => (window as any).__neural.startRecording())
  const target = await page.evaluate(() => {
    const a = (window as any).__neural
    return a._optList.find((o: any) => o.node.ty === "transitions")?.node.t
  })
  expect(target, "a resolving transition to record").toBeTruthy()
  await j.rig("resolve", [0.01])
  await j.rig("outcome", [0.01])
  await j.pick(target)
  await j.advanceUntil("impact_success", 20000)
  const rec = await page.evaluate(() => (window as any).__neural.stopRecording())
  expect(rec).toBeTruthy()
  expect(typeof rec.startedAt).toBe("number")
  expect(Array.isArray(rec.beats)).toBe(true)
  expect(Array.isArray(rec.draws)).toBe(true)
  expect(rec.beats.map((b: any) => b.beat)).toContain("commit")
  expect(rec.draws.some((d: any) => d.tag === "resolve")).toBe(true)
  // recording is a window, not a tap: draws outside it are not captured
  const after = await page.evaluate(() => (window as any).__neural.stopRecording())
  expect(after).toBeNull()
})
