import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { openChoiceVideo, playChoiceVideo, NAME } from "../fixtures/video-cards"

/** v1.230.0 reverses v1.218.1/v1.220.0 Inspect and the owner's 2026-10-15
 * question-6 decision removes its JIT drill and execute beacon. One-beacon guidance
 * remains across the video viewer and card commits. Defense uses escape's v1.227.0 shared
 * renderLandCard face; "panic" remains the grading/telemetry surface ID.
 * Dossiers are suppressed by the harness, so Watch gets an explicit front fixture.
 * Playback uses a hermetic player with real input and production callbacks.
 */

test("one-beacon law: exactly one highlighted surface at every beat", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  const beaconCount = () => page.locator("[data-beacon]").count()
  const beaconTarget = () => page.evaluate(() => (window as any).__neural.beaconState()?.target || null)

  // LAND: the beacon invites the tray
  await j.advance(500)
  expect(await beaconCount()).toBe(1)
  expect(await beaconTarget()).toBe("options")

  // Opening and closing the video viewer leaves one invitation on the original hand.
  await j.watchChoice(NAME)
  expect(await beaconCount()).toBe(1)
  expect(await beaconTarget()).toBe("options")
  await openChoiceVideo(page, NAME)
  expect(await beaconCount()).toBe(1)
  expect(await beaconTarget()).toBe("options")
  await j.clickByMouse("[data-watch-close]", "Close Watch")
  expect(await beaconCount()).toBe(1)
  expect(await beaconTarget()).toBe("options")

  // Commit through the surviving action; no retired JIT/Execute highlight remains.
  await j.rig("resolve", [0.01])
  await j.rig("outcome", [0.01])
  await j.pick(NAME)
  await j.advance(2000)
  expect(await beaconCount()).toBeLessThanOrEqual(1)
  const targets = (await j.beats()).filter(b => b.beat === "beacon_moved").map((b: any) => b.target)
  expect(targets).toContain("options")
  expect(targets).not.toContain("jit")
  expect(targets).not.toContain("execute")
})

test("defense drama: caught → panic drill → escape odds pump → relief", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  // This transition's counter gives up half guard bottom, where the opponent can attack.
  // A submission entry now arrives at its own state; it cannot fail like a finish attempt.
  await j.rig("resolve", [0.99])       // our move fails
  await j.rig("outcome", [0.99])       // draw a non-success outcome
  await j.rig("opp-finish", [0.01])    // opponent goes for the kill
  await j.rig("opp-sub-pick", [0.01])
  await j.pick("Consolidate Mount")
  // chunked pump: one long advance would blow through the defense window before we can drill
  await j.advanceUntil("caught", 20000)

  await j.expectBeat("impact_fail")
  const panic = page.locator("[data-landcard=defense]")
  await expect(panic, "inline panic drill visible when caught").toBeVisible()
  await j.expectBeat("panic_drill_opened")
  await j.decksSettled()
  expect(await page.evaluate(() => (window as any).__neural._landMode)).toBe("defense")
  await expect(panic.locator("[data-land-q]"), "the shared live-catch question").toBeVisible()
  await expect(page.locator(".ng-vignette"), "heartbeat vignette on").toHaveCount(1)

  // grading the defender card pumps the ESCAPE odds visibly. v1.135.0: the drill is MULTIPLE
  // CHOICE when the pool is warm (owner: "much more similar to the ng-landcard with multiple
  // choice"); the reveal/got recall idiom survives only as the cold-pool fallback.
  const escBefore = await page.evaluate(() => (window as any).__neural.escapeOddsSnapshot())
  const mcCorrect = await page.evaluate(() => {
    const a: any = (window as any).__neural
    const card = document.querySelector("[data-landcard=defense]")
    return card && card.querySelector("[data-panic-mc-opt]") && a._mc && a._mc.surface === "panic"
      ? a._mc.correct
      : null
  })
  if (mcCorrect != null) {
    await j.clickByMouse(`[data-panic-mc-opt="${mcCorrect}"]`, "Answer the live-catch question")
  } else {
    await j.clickByMouse("[data-panic-reveal]", "Reveal the live-catch answer")
    await j.clickByMouse("[data-panic-got]", "Grade the live-catch answer")
  }
  const escAfter = await page.evaluate(() => (window as any).__neural.escapeOddsSnapshot())
  expect(escAfter).toBeGreaterThan(escBefore)
  await j.expectBeat("escape_odds_pumped")

  // take the escape (rigged success) → relief, vignette snaps off
  await j.rig("escape", [0.01])
  await page.locator(".ng-choice-title-button").first().scrollIntoViewIfNeeded()
  await j.clickByMouse(".ng-choice-title-button", "Choose the pumped escape")
  await j.advanceUntil("relief", 12000)
  await j.expectBeat("escape")
  expect(await page.evaluate(() => !(window as any).__neural._vignetteEl)).toBe(true)
})

// DELETED WITH ITS SUBJECT (v1.104.0): "guided first roll: 3 coach beats in order, clock frozen
// until dismissed". The 3-panel first-roll coach is gone (owner). Its one durable claim — that
// the decision clock really was frozen behind it — was measured true on the way out
// (13,800ms unchanged over 12 simulated seconds, all .ngbar countdowns paused, no auto-pick).
// The SAME freeze still guards the checkpoint quiz and is pinned by
// e2e/gen/mid-checkpoint-quiz-untimed.spec.ts, so the rule itself is not untested.

test("film study: explicit playback fires the beat; player failure offers a safe fallback link", async ({ page }) => {
  const errors: string[] = []
  page.on("pageerror", error => errors.push(error.message))
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await openChoiceVideo(page, NAME)
  expect((await j.beats()).filter(b => b.beat === "short_watched")).toHaveLength(0)
  await playChoiceVideo(page)
  await j.expectBeat("short_watched")

  // Drive the real production failure callback, without the external provider.
  await page.evaluate(() => (window as any).__players.at(-1).events.onError())
  const fallback = page.locator('[data-choice-viewer] .ngPlayerHost a')
  await expect(fallback).toHaveText("Open video on YouTube ↗")
  await expect(fallback).toHaveAttribute("href", "https://www.youtube.com/watch?v=aaaaaaaaaaa")
  await expect(fallback).toHaveAttribute("target", "_blank")
  await expect(fallback).toHaveAttribute("rel", "noopener noreferrer")
  expect((await j.beats()).filter(b => b.beat === "commit")).toHaveLength(0)
  await j.clickByMouse("[data-watch-close]", "Close the failed player")
  await expect(page.locator(".ngPlayerHost")).toHaveCount(0)
  expect(errors).toEqual([])
})
