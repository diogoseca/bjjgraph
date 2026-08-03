/* @hyperspace {"theme":"lifetime-journeys","L":"fresh-visitor","F":"spa-nav","B":"idempotence"} @invariant "A Quartz soft navigation destroys and rebuilds exactly one app instance: after two spa navigations there is exactly one #neural-root in the DOM, window.__neural is a fresh instance (empty beats array, new nodes ingest), and a single keydown reaches exactly one handler (no accumulated listeners)." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { freshVisitor, CURRICULUM } from "./personas"

/**
 * SPA NAV SINGLE-INSTANCE LAW — a fresh visitor soft-navigates twice; every nav must
 * destroy the outgoing app life and mount exactly ONE new one.
 *
 * Mechanism under test (source-verified): spaNavigate (spa.inline.ts) → addCleanup drain →
 * __neural.destroy() (build.mjs: componentWillUnmount removes the window keydown handler,
 * cancels rAF; #neural-root.remove(); window.__neural=null) → micromorph → "nav" event →
 * applyVariant → __mountNeural() builds a FRESH instance (variant.inline.ts).
 * window.__NEURAL_TEST__ persists across soft navs (isTest() reads it dynamically), so every
 * remounted life stays frame-pumped — land()/advance() work on each life.
 *
 * Probe-verified recipe (2x stable, ~4s):
 *   - navs via page.evaluate(() => window.spaNavigate(new URL(path, location.origin))) —
 *     async, evaluate awaits it; "/Positions/Mount" and "/" are valid built routes under
 *     the DSL's hermetic route filter
 *   - each life tagged __probeId=n; remount awaited via __probeId !== n + nodes ingested
 *     (+ flashcards.decks + curriculum before the drilling leg)
 *   - beats array FULLY EMPTY right after remount (test mode freezes the loop — safe pre-pump)
 *   - coach_1/coach_done fire ONLY on life 1: dismissal persists in storage across soft
 *     navs (dismissCoach() guards on _coach), so life 3's post-land stream is exactly
 *     stakes,land,options_dealt,beacon_moved with exactly one land beat
 *   - v1.70: life 3 gets an IN-MEMORY settings assignment before its land (freshVisitor
 *     semantics preserved — no seed, and set() would persist): landQuestions:false keeps
 *     the v1.68 landing-question beats (mc_shown, land_q_shown) out of the exact stream,
 *     and mcMode:"auto" restores the authored-era sidebar MC that the keydown-law leg
 *     grades through (the v1.68 default flip to classic renders no MC block, sets no _mc,
 *     and answers no digit press)
 *   - keydown ledger: window.add/removeEventListener wrapped pre-boot into __kdSet; assert
 *     MEMBERSHIP by identity only — Quartz owns a second keydown listener, so size is never 1
 *   - behavioral layer: ONE digit press grades the presented MC card exactly once;
 *     mc_shown/mc_correct counted by DELTA because the [data-lesson] click auto-presents a
 *     first card with its own mc_shown (absolute counts are an artifact)
 *   - hermetic-abort net::ERR_FAILED console noise is benign — no console-cleanliness asserts
 */

const LESSON1: any = CURRICULUM.belts[0].units[0].lessons[0]

test("spa nav single-instance law: two soft navs → one root, fresh instance each life, one live keydown handler", async ({ page }) => {
  test.skip(!LESSON1?.deckKey, "curriculum lost white unit-1 lesson-1 — MC keydown leg premise gone")

  // Keydown ledger BEFORE boot: mirror every window keydown add/remove into __kdSet so
  // handler liveness is assertable by IDENTITY across app lives. Init scripts run on full
  // loads only, but the wrapper lives on the window object, surviving every soft nav.
  await page.addInitScript(() => {
    const w = window as any
    const set = new Set<any>()
    w.__kdSet = set
    const add = window.addEventListener.bind(window)
    const rem = window.removeEventListener.bind(window)
    w.addEventListener = function (type: string, fn: any, opts: any) {
      if (type === "keydown") set.add(fn)
      return add(type, fn, opts)
    }
    w.removeEventListener = function (type: string, fn: any, opts: any) {
      if (type === "keydown") set.delete(fn)
      return rem(type, fn, opts)
    }
  })

  const j = journey(page)
  await j.boot("/", { initialState: freshVisitor() })

  const rootCount = () => page.evaluate(() => document.querySelectorAll("#neural-root").length)
  const beatCount = (name: string) =>
    page.evaluate((n) => ((window as any).__neural.beats || []).filter((b: any) => b.beat === n).length, name)
  const waitRemount = (prevId: number) =>
    page.waitForFunction(
      (pid) => {
        const a = (window as any).__neural
        return !!(
          a &&
          a.__probeId !== pid &&
          a.nodes &&
          a.nodes.length > 0 &&
          typeof a.advance === "function" &&
          a.flashcards &&
          a.flashcards.decks &&
          a.curriculum
        )
      },
      prevId,
      { timeout: 60_000 },
    )

  // ── LIFE 1: a real, played life — the fresh visitor lands, the first-roll coach fires ──
  await j.land("Mount Top")
  await j.expectBeat("land")
  await j.expectBeat("coach_1") // fresh-visitor onboarding: the life-1-ONLY beats
  await j.expectBeat("coach_done")
  expect(await rootCount(), "exactly one #neural-root on life 1").toBe(1)
  expect(
    (await j.beats()).length,
    "life 1 accumulated beats (premise: the empty-after-nav assert below is non-vacuous)",
  ).toBeGreaterThan(0)
  await page.evaluate(() => {
    const w = window as any
    w.__neural.__probeId = 1
    w.__life1 = w.__neural
    w.__life1Key = w.__neural._onKey
  })
  expect(
    await page.evaluate(() => (window as any).__kdSet.has((window as any).__life1Key)),
    "life-1 keydown handler registered in the ledger",
  ).toBe(true)

  // ── NAV 1 → /Positions/Mount: life 1 destroyed, life 2 mounted fresh ──
  await page.evaluate(() => (window as any).spaNavigate(new URL("/Positions/Mount", location.origin)))
  await waitRemount(1)
  const life2 = await page.evaluate(() => {
    const w = window as any
    const a = w.__neural
    return {
      roots: document.querySelectorAll("#neural-root").length,
      beatsLen: (a.beats || []).length,
      nodesLen: (a.nodes || []).length,
      isNewInstance: a !== w.__life1,
      oldDestroyed: w.__life1.__ngDestroyed === true,
      oldRootDetached: !document.body.contains(w.__life1.__ngRoot),
      oldKeyInLedger: w.__kdSet.has(w.__life1Key),
      newKeyInLedger: w.__kdSet.has(a._onKey),
      newKeyIsOldKey: a._onKey === w.__life1Key,
    }
  })
  expect(life2.roots, "exactly one #neural-root after nav 1").toBe(1)
  expect(life2.isNewInstance, "window.__neural is a NEW object — life 1 not recycled").toBe(true)
  expect(life2.oldDestroyed, "life-1 instance ran destroy() (__ngDestroyed set)").toBe(true)
  expect(life2.oldRootDetached, "life-1 #neural-root left the DOM").toBe(true)
  expect(life2.beatsLen, "fresh instance: beats array EMPTY right after remount").toBe(0)
  expect(life2.nodesLen, "fresh instance: new nodes ingested").toBeGreaterThan(0)
  expect(life2.oldKeyInLedger, "life-1 keydown handler REMOVED (no accumulation)").toBe(false)
  expect(life2.newKeyInLedger, "life-2 keydown handler registered").toBe(true)
  expect(life2.newKeyIsOldKey, "life-2 handler is a distinct function, not the old one").toBe(false)
  await page.evaluate(() => {
    const w = window as any
    w.__neural.__probeId = 2
    w.__life2Key = w.__neural._onKey
  })

  // ── NAV 2 → back to /: the invariant's "after two spa navigations" point ──
  await page.evaluate(() => (window as any).spaNavigate(new URL("/", location.origin)))
  await waitRemount(2)
  const life3 = await page.evaluate(() => {
    const w = window as any
    const a = w.__neural
    return {
      roots: document.querySelectorAll("#neural-root").length,
      beatsLen: (a.beats || []).length,
      nodesLen: (a.nodes || []).length,
      key1InLedger: w.__kdSet.has(w.__life1Key),
      key2InLedger: w.__kdSet.has(w.__life2Key),
      liveKeyInLedger: w.__kdSet.has(a._onKey),
    }
  })
  expect(life3.roots, "exactly one #neural-root after two spa navigations").toBe(1)
  expect(life3.beatsLen, "life-3 beats array EMPTY right after remount").toBe(0)
  expect(life3.nodesLen, "life 3 ingested nodes fresh").toBeGreaterThan(0)
  expect(life3.key1InLedger, "life-1 handler still absent after nav 2").toBe(false)
  expect(life3.key2InLedger, "life-2 handler removed by nav 2 (no accumulation)").toBe(false)
  expect(life3.liveKeyInLedger, "exactly the live life-3 handler is registered").toBe(true)
  await page.evaluate(() => ((window as any).__neural.__probeId = 3))

  // v1.70: life-3 in-memory settings — exact stream stays landing-question-free and the
  // keydown-law leg gets its MC surface back (see header; a plain assignment persists nothing)
  await page.evaluate(() => {
    const a = (window as any).__neural
    a.settings = Object.assign({}, a.settings, { mcMode: "auto", landQuestions: false })
  })

  // ── LIFE 3 is first-class: land → exactly ONE land beat, NO coach re-fire ──
  await j.land("Mount Top")
  const stream = (await j.beats()).map((b) => b.beat)
  expect(stream, "life-3 stream: one clean landing, no coach (dismissal persisted across soft navs)").toEqual([
    "stakes",
    "land",
    "options_dealt",
    "beacon_moved",
  ])
  expect(await beatCount("land"), "exactly 1 land beat on life 3 — a double mount would double it").toBe(1)

  // ── behavioral keydown law: ONE digit press grades the MC card exactly once ──
  // deep queues: MC pooling rejects candidates and each rejection consumes another draw —
  // a shallow queue would drain into Math.random and break determinism
  await j.rig("mc-pick", [0.13, 0.47, 0.79, 0.11, 0.29, 0.41, 0.53, 0.67, 0.83, 0.91, 0.07, 0.37, 0.59, 0.73, 0.97, 0.19, 0.31, 0.43, 0.61, 0.89])
  await j.rig("mc-shuffle", [0.21, 0.62, 0.34, 0.88, 0.14, 0.52, 0.76, 0.28])
  await page.evaluate(() => (window as any).__neural.toggleExplorer())
  await page.locator(`[data-lesson="${LESSON1.deckKey}"]`).first().click() // auto-presents a first card (own mc_shown)
  await j.advance(800)

  const shown0 = await beatCount("mc_shown")
  const qh = await page.evaluate(() => {
    const a = (window as any).__neural
    for (const c of a.deck || []) {
      if (a.mcClip(c.a)) {
        const q = a.qhash(c.q)
        a.presentCard(q) // rail: canvas-free choke point the drill UI itself uses
        return q
      }
    }
    return null
  })
  expect(qh, "an MC-able card presented in the lesson deck").toBeTruthy()
  expect(
    await beatCount("mc_shown"),
    "explicit present emitted exactly one more mc_shown (DELTA — the lesson click already emitted its own)",
  ).toBe(shown0 + 1)

  const truth = await page.evaluate(() => {
    const a = (window as any).__neural
    return a._mc ? { correct: a._mc.correct } : null
  })
  expect(truth, "MC truth state live for the presented card").toBeTruthy()
  const correct0 = await beatCount("mc_correct")
  await page.keyboard.press(String(truth!.correct + 1))
  expect(
    await beatCount("mc_correct"),
    "ONE keydown → exactly one mc_correct — an accumulated zombie handler would double-grade",
  ).toBe(correct0 + 1)

  // ── the law held at every stage — final root check after real interaction ──
  expect(await rootCount(), "still exactly one #neural-root at the end").toBe(1)
})
