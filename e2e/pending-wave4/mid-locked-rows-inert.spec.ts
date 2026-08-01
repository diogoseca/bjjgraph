/* @hyperspace {"theme":"unlock-economy","L":"curriculum-mid","F":"belt-path","B":"guard-limit"} @invariant "Locked rows are economically inert: clicking a locked lesson row opens no deck (deckOpen stays false, no _posKey change, no camera fly), clicking a locked unit's checkpoint emits no checkpoint_start, and clicking a locked belt-test row emits no belt_test_start — locks gate the ACTIONS, not just the styling." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { curriculumMid, CURRICULUM } from "./personas"

/**
 * LOCKED ROWS ARE ECONOMICALLY INERT — a lock must gate the ACTION, not just paint the
 * row gray. A mid-curriculum white belt (U0 done, U1 half-drilled) clicks straight down
 * the locked frontier — locked lesson, locked checkpoint, locked belt test — and NOTHING
 * moves: no deck, no session, no camera fly, no quiz, no test armed, zero new beats.
 *
 * Mechanism under test (neural/src/app.src.jsx):
 *   - renderBeltPath (~2495-2534) passes null onClick for locked rows: lesson rows wire
 *     `!uLocked && live ? () => openLessonStudy(...) : null` (2503), checkpoint rows
 *     `uLocked ? null : () => startCheckpoint(...)` (2511), test rows only when state is
 *     ready/retry (2529).
 *   - mk (~2692) calls addEventListener("click") only `if (onClick)` — a locked row has
 *     NO listener at all; the click lands on the div and dies.
 *   - SHARP EDGE this census exists for: openLessonStudy (2444) has NO internal lock
 *     re-check — the null handler is the ONLY gate for lesson rows — while
 *     startCheckpoint (3466) and startBeltTest (2554) carry internal gates that return
 *     BEFORE their fx beats (double-gated). A regression that wires handlers
 *     unconditionally would silently let locked lessons open decks; leg 1 catches it.
 *   - Lock lineage under curriculumMid: U0 complete (lessons + checkpoint seeded), U1
 *     unlocked-but-incomplete (half-drilled, no checkpoint) → prevUnitDone false at U2 →
 *     WHITE.units[2] is the FIRST locked unit. Blue belt unwon → blue's test "locked".
 *   - Timing: openExplorer auto-pauses the game (~2610 setPaused(true)) so the decision
 *     clock is frozen — advance(400) after each click can surface no expiry_warning /
 *     auto_pick ambient beats, making beats.length delta 0 STRICTLY assertable.
 *
 * Rigs: none beyond land()'s built-ins (ai-skill/role/max-moves) — the path render draws
 * no RNG. All keys derive from the served curriculum fixture, never hardcoded.
 */

const WHITE: any = CURRICULUM.belts[0]
const BLUE: any = CURRICULUM.belts[1]
const U0: any = WHITE.units[0]
const U1: any = WHITE.units[1]
const U2: any = WHITE.units[2]
const U2_KEY = `${WHITE.id}/${U2.id}`
// first U2 lesson live in the default gi frame — its inertness is then attributable to
// the LOCK alone (data-live="1", not done), never to frame-liveness or done styling
const LOCKED_LESSON: string = (U2.lessons.find((l: any) => (l.frames || []).includes("gi")) || {}).deckKey
// unlocked-U0 delivery control: done rows KEEP their handlers (the onClick condition
// ignores ld) — the red-proof-in-green that keeps the three inert legs non-vacuous
const CONTROL_LESSON: string = U0.lessons[0].deckKey

test("mid-curriculum: locked lesson/checkpoint/belt-test clicks are inert — locks gate actions, not styling", async ({
  page,
}) => {
  // ── curriculum facts the lock lineage leans on — fail loudly here if the corpus shifts ──
  expect(WHITE.units.length, "white defines units 0/1/2 for the frontier").toBeGreaterThanOrEqual(3)
  expect(LOCKED_LESSON, "U2 defines a gi-live lesson to click").toBeTruthy()
  expect(CONTROL_LESSON, "U0 defines the unlocked control lesson").toBeTruthy()
  expect(CONTROL_LESSON, "control and locked rows are distinct decks").not.toBe(LOCKED_LESSON)
  expect((U0.lessons[0].frames || []).includes("gi"), "control lesson live in default gi frame").toBe(true)
  expect(BLUE && BLUE.test, "blue defines a test block (the locked test row)").toBeTruthy()

  const j = journey(page)
  await j.boot("/", { initialState: curriculumMid() })
  await j.land("Mount Top")

  // open the explorer's PATH view (curriculum loaded → path is the default mode);
  // openExplorer auto-pauses the game — the freeze that makes beat-count strictness safe
  await page.evaluate(() => (window as any).__neural.toggleExplorer())
  await expect(page.locator("[data-view]").first()).toBeVisible()
  await j.expectBeat("path_opened")

  // ── guard the lineage: U0 done, U1 the open frontier, U2 the FIRST locked unit ──
  const attr = (sel: string, a: string) => page.locator(sel).first().getAttribute(a)
  expect(await attr(`[data-unit="${WHITE.id}/${U0.id}"]`, "data-done"), "U0 complete (seeded)").toBe("1")
  expect(await attr(`[data-unit="${WHITE.id}/${U1.id}"]`, "data-locked"), "U1 unlocked (the frontier)").toBeNull()
  expect(await attr(`[data-unit="${WHITE.id}/${U1.id}"]`, "data-done"), "U1 incomplete (half-drilled)").toBeNull()
  expect(await attr(`[data-unit="${U2_KEY}"]`, "data-locked"), "U2 is the first locked unit").toBe("1")
  // the locked lesson row is LIVE and UNDONE — inertness below is due to the lock alone
  expect(await attr(`[data-lesson="${LOCKED_LESSON}"]`, "data-live"), "locked lesson is gi-live").toBe("1")
  expect(await attr(`[data-lesson="${LOCKED_LESSON}"]`, "data-done"), "locked lesson undone").toBeNull()
  expect(await attr(`[data-checkpoint="${U2_KEY}"]`, "data-done"), "locked checkpoint unpassed").toBeNull()
  expect(await attr(`[data-belt-test="${BLUE.id}"]`, "data-test-state"), "blue test row locked").toBe("locked")

  // ── economic baseline ──
  const snap = () =>
    page.evaluate(() => {
      const a = (window as any).__neural
      return {
        deckOpen: !!a.deckOpen,
        posKey: a._posKey ?? null,
        camCx: a.camTarget.cx,
        camCy: a.camTarget.cy,
        session: !!a._session,
        checkpoint: !!a._checkpoint,
        beltTest: !!a._beltTest,
        beats: (a.beats || []).length,
        paused: !!a.paused,
      }
    })
  const base = await snap()
  expect(base.paused, "explorer auto-paused the clock — advance() can't tick the decision timer").toBe(true)
  expect(base.deckOpen, "no deck open before the clicks").toBe(false)
  expect(base.session, "no study session before the clicks").toBe(false)
  expect(base.checkpoint, "no checkpoint quiz before the clicks").toBe(false)
  expect(base.beltTest, "no belt test armed before the clicks").toBe(false)
  expect(base.posKey, "control deck is not already the current deck").not.toBe(CONTROL_LESSON)

  const expectInert = async (what: string) => {
    const post = await snap()
    expect(post.deckOpen, `${what}: deckOpen stays false`).toBe(false)
    expect(post.posKey, `${what}: _posKey unchanged`).toBe(base.posKey)
    expect(Math.abs(post.camCx - base.camCx), `${what}: no camera fly (cx)`).toBeLessThanOrEqual(1)
    expect(Math.abs(post.camCy - base.camCy), `${what}: no camera fly (cy)`).toBeLessThanOrEqual(1)
    expect(post.session, `${what}: no session started`).toBe(false)
    expect(post.checkpoint, `${what}: no checkpoint quiz`).toBe(false)
    expect(post.beltTest, `${what}: no belt test armed`).toBe(false)
    expect(post.beats, `${what}: STRICTLY zero new beats`).toBe(base.beats)
    // every real handler here closes the explorer (openLessonStudy via locateNode,
    // startCheckpoint, startBeltTest all do) — it staying open is itself handler-free proof
    await expect(page.locator("[data-view]").first(), `${what}: explorer still open`).toBeVisible()
  }

  // ── leg 1: locked lesson row (single-gated — the null handler is the ONLY gate) ──
  await page.locator(`[data-lesson="${LOCKED_LESSON}"]`).first().click()
  await j.advance(400)
  await expectInert("locked lesson")

  // ── leg 2: locked unit's checkpoint row ──
  await page.locator(`[data-checkpoint="${U2_KEY}"]`).first().click()
  await j.advance(400)
  await expectInert("locked checkpoint")

  // ── leg 3: locked belt-test row ──
  await page.locator(`[data-belt-test="${BLUE.id}"]`).first().click()
  await j.advance(400)
  await expectInert("locked belt test")

  // beat-name census across the whole locked phase: the gated beats never fired at all
  const beats = await j.beats()
  expect(beats.filter((b) => b.beat === "checkpoint_start"), "no checkpoint_start ever").toHaveLength(0)
  expect(beats.filter((b) => b.beat === "belt_test_start"), "no belt_test_start ever").toHaveLength(0)

  // ── delivery control (red-proof in green): the UNLOCKED, done U0 row kept its handler —
  //    the SAME click machinery flips the economy, so the three inert legs weren't vacuous ──
  await page.locator(`[data-lesson="${CONTROL_LESSON}"]`).first().click()
  const post = await snap()
  expect(post.deckOpen, "control: unlocked row opened its deck").toBe(true)
  expect(post.posKey, "control: study jumped to the clicked deck").toBe(CONTROL_LESSON)
  expect(post.session, "control: study session armed").toBe(true)
})
