/* @hyperspace {"theme":"sound","L":"white-belt-holder","F":"rewards","B":"beat-voice-parity"}
   @invariant "The sound bus mirrors the rewards vocabulary — a live challenge completion logs an objective-tick voice and a coin mint logs a coin-mint voice, each exactly once per beat with the 100ms same-beat dedupe intact." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { whiteBeltHolder } from "../gen/personas"

/**
 * QUARANTINED RED — Q005.
 *
 * The Rewards group's design pattern is that acknowledgements punch through NGSound's 40ms
 * wall-clock voice-spacing gate (sound.src.js:267): patch-weave and coin-mint both carry
 * major:1 (sound.src.js:91-92). objective-tick alone does not (sound.src.js:90) — so any
 * challenge completed BY a voiced beat is silent: fx(<beat>) voices the trigger, then
 * noteChallenges fires fx("challenge_completed") (app.src.jsx:4570) in the SAME synchronous
 * task, ~0ms later, and the gate eats the tick. In live play that is MOST completions
 * (commit, impact_success, escape, combo, checkpoint_passed are all voiced); only
 * completions triggered by unvoiced beats (sheet_opened, land_q_answered) ever tick.
 * Same root gate as Q003, distinct promise: the Rewards vocabulary itself is unmirrored.
 *
 * This spec asserts the vocabulary the catalog intends. It goes green when a live
 * voiced-beat completion voices its objective-tick (any fix shape: major-flag the voice,
 * exempt the Rewards group, defer the tick past the gate window, …). NB a reorder-only fix
 * (tick before trigger) just flips which voice is eaten — the capacitor-latch assertion
 * below keeps that shape red, mirroring Q003's warning.
 *
 * Wall-clock waits: the 100ms same-beat dedupe and 40ms spacing windows are
 * performance.now()-based — sim-time pumping cannot clear them, so the two 200ms
 * waitForTimeout calls are load-bearing, not sleep-flakiness.
 */

test("live white.commit completion ticks; coin mints voice exactly once, mint-once + dedupe intact", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/", { initialState: whiteBeltHolder(), keepTutorial: true })
  await j.land("Mount Top")

  const snap = () =>
    page.evaluate(() => {
      const a = (window as any).__neural
      return { b: a.beats.length, l: a.sound.soundLog.length }
    })
  const delta = (s0: { b: number; l: number }) =>
    page.evaluate((s) => {
      const a = (window as any).__neural
      return {
        beats: a.beats.slice(s.b).map((x: any) => x.beat),
        voices: a.sound.soundLog
          .slice(s.l)
          .map((x: any) => x.beat + ":" + x.patch),
      }
    }, s0)
  const count = (arr: string[], v: string) => arr.filter((x) => x === v).length

  // ── control: white.sheet completes off an UNVOICED trigger (sheet_opened) → tick logs.
  // The white-challenges cue (.ng-tut.ng-challenge-cue, fixed left:16px w:270px,
  // pointer-events:auto) overlaps the LEFTMOST tray card under keepTutorial — pick a card
  // clear of it.
  const titles = await j.optionTitles()
  expect(titles.length).toBeGreaterThan(0)
  let chosen = titles[0]
  for (const t of titles) {
    const box = await page.locator(`[data-tech="${t}"]`).first().boundingBox()
    if (box && box.x > 300) {
      chosen = t
      break
    }
  }
  const s0 = await snap()
  await page.locator(`[data-tech="${chosen}"]`).first().click()
  const dSheet = await delta(s0)
  expect(count(dSheet.beats, "challenge_completed"), "white.sheet completed live").toBe(1)
  expect(
    count(dSheet.voices, "challenge_completed:objective-tick"),
    "unvoiced-trigger completion ticks (control)",
  ).toBe(1)

  // clear both wall-clock windows so the next challenge_completed is dedupe-eligible
  await page.waitForTimeout(200)

  // ── RED: white.commit completes off a VOICED trigger (commit → capacitor-latch) —
  // the reward vocabulary promises exactly one objective-tick for this beat too.
  const s1 = await snap()
  await page.locator("[data-go]").first().click()
  const dCommit = await delta(s1)
  expect(count(dCommit.beats, "challenge_completed"), "white.commit completed live").toBe(1)
  expect(
    count(dCommit.voices, "commit:capacitor-latch"),
    "the trigger beat keeps its own voice (a reorder-only fix would eat this instead)",
  ).toBe(1)
  expect(
    count(dCommit.voices, "challenge_completed:objective-tick"),
    "voiced-trigger completion ticks — Q005: eaten by the 40ms gate (objective-tick lacks the major flag patch-weave and coin-mint both carry)",
  ).toBe(1)

  await page.waitForTimeout(200)

  // ── coin half (green today): fx("combo",{n:7}) at the engine choke mints godlike ONCE;
  // the identical back-to-back beat emits nothing (mint-once upstream), and the second
  // combo beat itself is deduped downstream (100ms same-beat window).
  const part2 = await page.evaluate(() => {
    const a = (window as any).__neural
    const b0 = a.beats.length
    const l0 = a.sound.soundLog.length
    a.fx("combo", { n: 7 })
    a.fx("combo", { n: 7 })
    return {
      beats: a.beats.slice(b0).map((x: any) => x.beat),
      voices: a.sound.soundLog.slice(l0).map((x: any) => x.beat + ":" + x.patch),
      godlike: !!(a.coins || {}).godlike,
    }
  })
  expect(part2.godlike, "godlike coin minted").toBe(true)
  expect(count(part2.beats, "coin_earned"), "mint-once upstream: one coin beat").toBe(1)
  expect(
    count(part2.voices, "coin_earned:coin-mint"),
    "one coin-mint voice (major:1 punches through the gate)",
  ).toBe(1)
  expect(
    count(part2.voices, "combo:momentum-rise"),
    "second combo beat deduped downstream (100ms same-beat window)",
  ).toBeLessThanOrEqual(1)
})
