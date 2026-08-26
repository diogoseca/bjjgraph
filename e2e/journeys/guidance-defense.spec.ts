import { test, expect } from "@playwright/test"
import { journey } from "../dsl"

/**
 * P2 — ONE-BEACON GUIDANCE + PANIC-DRILL DEFENSE.
 *
 * Guidance law: at every beat there is EXACTLY ONE glowing next-thing (the Beat Beacon).
 * Defense drama: getting caught is a heartbeat moment with an inline escape drill whose
 * grading visibly improves the escape odds — and escaping snaps the tension off.
 *
 * Surfaces under test (neural/src/app.src.jsx):
 *   __neural.beaconState()        — { target } | null
 *   [data-beacon]                 — the SINGLE currently-highlighted surface
 *   [data-panic]                  — the inline defender micro-card shown when caught
 *   [data-panic-reveal]/[data-panic-got] — its reveal/grade buttons
 *   beats: beacon_moved, caught, panic_drill_opened, escape_odds_pumped, relief,
 *          coach_1/2/3 + coach_done (guided first roll), short_watched
 *   Guided First Roll: fresh visitors get a 3-beat coach; the decision clock is FROZEN until
 *   coach_done (the DSL's land() dismisses it by default; keepCoach opts in).
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

  // PEEK: sheet open — beacon moves INTO the sheet (drill first, since odds are pumpable)
  const options = await j.optionTitles()
  await page.locator(`[data-tech="${options[0]}"]`).first().click()
  expect(await beaconCount()).toBe(1)
  const inSheet = await beaconTarget()
  expect(["jit", "execute"]).toContain(inSheet)

  // DRILL: after two grades the beacon hands off to Execute (bonus banked → commit is next)
  for (let i = 0; i < 2; i++) {
    await page.locator("[data-jit-reveal]").click()
    await page.locator("[data-jit-got]").click()
  }
  expect(await beaconCount()).toBe(1)
  expect(await beaconTarget()).toBe("execute")
  await j.keyframe("p2-beacon-execute")

  // COMMIT: beacon count never exceeds 1 at any sampled moment
  await j.rig("resolve", [0.01])
  await j.rig("outcome", [0.01])
  await page.locator("[data-go]").click()
  await j.advance(2000)
  expect(await beaconCount()).toBeLessThanOrEqual(1)

  const beats = (await j.beats()).map((b) => b.beat)
  expect(beats.filter((b) => b === "beacon_moved").length).toBeGreaterThanOrEqual(3)
})

test("defense drama: caught → panic drill → escape odds pump → relief", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  // rig a failed move whose fail path hands initiative to an opponent FINISH (enterDefense)
  const options = await j.optionTitles()
  await j.rig("resolve", [0.99])       // our move fails
  await j.rig("outcome", [0.99])       // draw a non-success outcome
  await j.rig("opp-finish", [0.01])    // opponent goes for the kill
  await j.rig("opp-sub-pick", [0.01])
  await j.pick(options[0])
  // chunked pump: one long advance would blow through the defense window before we can drill
  await j.advanceUntil("caught", 20000)

  await j.expectBeat("impact_fail")
  const panic = page.locator("[data-panic]")
  await expect(panic, "inline panic drill visible when caught").toBeVisible()
  await j.expectBeat("panic_drill_opened")
  await expect(page.locator(".ng-vignette"), "heartbeat vignette on").toHaveCount(1)
  await j.keyframe("p2-panic-drill")

  // grading the defender card pumps the ESCAPE odds visibly. v1.135.0: the drill is MULTIPLE
  // CHOICE when the pool is warm (owner: "much more similar to the ng-landcard with multiple
  // choice"); the reveal/got recall idiom survives only as the cold-pool fallback.
  const escBefore = await page.evaluate(() => (window as any).__neural.escapeOddsSnapshot())
  const mcCorrect = await page.evaluate(() => {
    const a: any = (window as any).__neural
    const card = document.querySelector("[data-panic]")
    return card && card.querySelector("[data-panic-mc-opt]") && a._mc && a._mc.surface === "panic"
      ? a._mc.correct
      : null
  })
  if (mcCorrect != null) {
    await page.locator(`[data-panic-mc-opt="${mcCorrect}"]`).click()
  } else {
    await page.locator("[data-panic-reveal]").click()
    await page.locator("[data-panic-got]").click()
  }
  const escAfter = await page.evaluate(() => (window as any).__neural.escapeOddsSnapshot())
  expect(escAfter).toBeGreaterThan(escBefore)
  await j.expectBeat("escape_odds_pumped")

  // take the escape (rigged success) → relief, vignette snaps off
  await j.rig("escape", [0.01])
  await page.evaluate(() => (window as any).__neural.pickFirstEscape())
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

test("film study: watchShort fires the beat; player onError falls back without crashing", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  const options = await j.optionTitles()
  await page.locator(`[data-tech="${options[0]}"]`).first().click()
  // stub the YouTube machinery — journeys must never hit youtube.com. The stub captures the
  // player's events config so the test can fire the REAL onError closure.
  await page.evaluate(() => {
    ;(window as any).__opened = []
    ;(window as any).open = (u: string) => ((window as any).__opened.push(u), null)
    ;(window as any).YT = {
      Player: function (this: any, _host: any, cfg: any) {
        ;(window as any).__ytEvents = cfg.events
        this.destroy = () => {}
      },
      PlayerState: { ENDED: 0 },
    }
  })
  const result = await page.evaluate(() => {
    const a = (window as any).__neural
    try { return a.watchShort(0) ? "ok" : "no-clip" } catch (e: any) { return "crash: " + e.message }
  })
  expect(result).toBe("ok")
  await j.expectBeat("short_watched")

  // the player reports an error → fail() opens the raw YouTube link and collapses the card
  const err = await page.evaluate(() => {
    try { (window as any).__ytEvents.onError(); return "ok" } catch (e: any) { return "crash: " + e.message }
  })
  expect(err).toBe("ok")
  expect(await page.evaluate(() => (window as any).__opened.length)).toBe(1)
  expect(await page.evaluate(() => document.querySelectorAll(".ngPlayerHost").length)).toBe(0)
})
