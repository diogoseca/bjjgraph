/* @hyperspace {"theme":"onboarding","L":"fresh-visitor","F":"intro-roll-coach","B":"guard-limit"} @invariant "The coach renders exactly one [data-coach] card that survives across advanceCoach steps (still exactly one, never duplicated) and is fully removed on finish (zero [data-coach]) — the onboarding overlay is a singleton with a clean teardown." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { freshVisitor } from "./personas"

/**
 * ONBOARDING COACH — SINGLETON DOM LIFECYCLE.
 *
 * The guided first-roll coach is a persistent overlay card, not a per-step re-render. It must be
 * a strict singleton: born once when a fresh visitor lands, structurally identical (exactly ONE
 * [data-coach]) across every advanceCoach step, and torn down to zero [data-coach] on finish.
 *
 * Mechanism under test (source-verified, neural/src/app.src.jsx:4034-4090):
 *   maybeStartCoach()  — fresh visitor (no bjj-neural-coached) → _coach=1, renderCoach(), coach_1
 *   renderCoach()      — creates the element ONCE (`if (!el)` guard), thereafter only rewrites its
 *                        innerHTML per step → the SAME node persists (never re-created/duplicated)
 *   advanceCoach()     — _coach 1→2→3, re-renders in place; at `_coach >= 3` calls finishCoach()
 *   finishCoach()      — _coach=null, _coachEl.remove()+null, coach_done → zero [data-coach]
 *
 * Working recipe (probe-verified, ~1.9s):
 *   - freshVisitor() → boot wipes storage so bjj-neural-coached is absent and the coach fires.
 *   - land("Mount Top", {keepCoach:true}) — keepCoach is MANDATORY; land() otherwise calls
 *     dismissCoach() and tears the card down before we can assert.
 *   - SELECTOR: [data-coach] count is the ONE stable STRUCTURAL selector (copy text is decorative
 *     and rewritten per step — never asserted). advanceCoach is a canvas-free rail method driven
 *     via page.evaluate; the decision clock is frozen while _coach is set, so no timer flake.
 */

test("onboarding coach is a singleton [data-coach] card: one across steps, zero on finish", async ({ page }) => {
  const j = journey(page)
  // fresh visitor: boot wipes storage → bjj-neural-coached absent → the coach fires on landing
  await j.boot("/", { initialState: freshVisitor() })
  await j.land("Mount Top", { keepCoach: true }) // keepCoach: don't let land() dismiss the card

  const coachCount = () => page.locator("[data-coach]").count()
  const coachStep = () => page.evaluate(() => (window as any).__neural._coach ?? null)
  const coachElNull = () => page.evaluate(() => (window as any).__neural._coachEl == null)

  // ── BORN: landing spawns exactly one card; the coach state machine is at step 1 ──
  expect(await coachCount(), "coach born: exactly one [data-coach] after land").toBe(1)
  expect(await coachStep(), "coach step machine at 1 after land").toBe(1)
  expect(await coachElNull(), "backing _coachEl is a live node after land").toBe(false)
  await j.expectBeat("coach_1")

  // ── SURVIVES step 1→2: still exactly one card (same node, innerHTML rewritten in place) ──
  await page.evaluate(() => (window as any).__neural.advanceCoach())
  expect(await coachCount(), "still exactly one [data-coach] after advance 1→2 (never duplicated)").toBe(1)
  expect(await coachStep(), "coach step advanced to 2").toBe(2)

  // ── SURVIVES step 2→3: still exactly one card ──
  await page.evaluate(() => (window as any).__neural.advanceCoach())
  expect(await coachCount(), "still exactly one [data-coach] after advance 2→3 (never duplicated)").toBe(1)
  expect(await coachStep(), "coach step advanced to 3").toBe(3)

  // ── TEARDOWN on finish (advanceCoach at _coach>=3 → finishCoach): zero [data-coach] ──
  await page.evaluate(() => (window as any).__neural.advanceCoach())
  expect(await coachCount(), "clean teardown: zero [data-coach] after finish").toBe(0)
  expect(await coachStep(), "coach step machine cleared to null on finish").toBeNull()
  expect(await coachElNull(), "_coachEl nulled on finish (no dangling node reference)").toBe(true)
  await j.expectBeat("coach_done")
})
