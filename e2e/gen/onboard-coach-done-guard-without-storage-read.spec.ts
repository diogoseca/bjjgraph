/* @hyperspace {"theme":"onboarding","L":"fresh-visitor","F":"intro-roll-coach","B":"idempotence"} @invariant "Once dismissed in-session the _coachDone flag short-circuits maybeStartCoach even if the persisted flag is wiped: after finishing the coach then deleting bjj-neural-coached from localStorage, a fresh maybeStartCoach() call emits no new coach_1 (the in-memory guard, not the storage read, prevents a re-coach)." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { freshVisitor } from "./personas"

/**
 * ONBOARDING COACH — IN-MEMORY IDEMPOTENCE (the guard is _coachDone, NOT the storage read).
 *
 * Sibling to onboard-coach-dom-lifecycle-single-card / onboard-coach-skip-jumps-to-done (which
 * cover the singleton DOM + the persisted bjj-neural-coached flag). Those prove storage PERSISTS
 * the "already coached" fact across reloads. This one isolates the ORDER of the two guards inside
 * a single session: which one actually short-circuits a re-coach when they disagree.
 *
 * Mechanism under test (source-verified, neural/src/app.src.jsx:4034-4061):
 *   maybeStartCoach()  line 4035: `if (this._coach || this._coachDone) return;`  ← IN-MEMORY guard,
 *                        runs FIRST — before line 4036's localStorage.getItem("bjj-neural-coached").
 *                        So once _coachDone===true the storage state is never even consulted.
 *   finishCoach()      lines 4055-4060: _coach=null; _coachDone=true; then
 *                        localStorage.setItem("bjj-neural-coached","1"); fx("coach_done").
 *   coach_1 is emitted ONLY at line 4041 (after both guards pass); the card carries [data-coach]
 *   (renderCoach line 4072).
 *
 * The falsifying experiment: finish the coach (sets _coachDone AND the storage flag), then DELETE
 * the storage flag and call maybeStartCoach() again. If the storage read were the real guard, the
 * wiped flag would let the coach re-fire (coach_1 count → 2, a card re-renders). Because the
 * in-memory _coachDone short-circuits FIRST, no re-coach happens and — the tell — the code returns
 * before ever reaching the storage read/write, so bjj-neural-coached stays null (never re-written).
 *
 * Working recipe (probe-verified, 3/3 deterministic, ~2s each):
 *   - freshVisitor() → boot wipes storage so bjj-neural-coached is absent → coach eligible.
 *   - land("Mount Top", {keepCoach:true}) — keepCoach MANDATORY; land() otherwise dismisses the coach.
 *   - dismissCoach() → finishCoach() → coach_done; _coachDone=true, storage flag="1".
 *   - removeItem + maybeStartCoach() in ONE evaluate, then advance(2000) to let any (bug) render land.
 *   - SELECTORS: coach_1 beat count (structural), [data-coach] DOM count, boolean flags. No copy text.
 *     All sim time via advance() — the decision clock is frozen while _coach is set / never re-armed.
 */

const POSITION = "Mount Top" // a valid positions node land() can rig-start on

test("in-memory _coachDone short-circuits maybeStartCoach even after the storage flag is wiped", async ({ page }) => {
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))

  const j = journey(page)
  // freshVisitor() is undefined by design → boot wipes storage, passes no initialState, so the
  // guided first-roll coach fires on landing (its trigger is the absence of bjj-neural-coached).
  await j.boot("/", { initialState: freshVisitor() })
  // keepCoach: the coach must remain UP after landing so we can finish it ourselves.
  await j.land(POSITION, { keepCoach: true })

  const coach1Count = async () => (await j.beats()).filter((b) => b.beat === "coach_1").length
  const coachDoneCount = async () => (await j.beats()).filter((b) => b.beat === "coach_done").length
  const coachCardCount = () => page.locator("[data-coach]").count()
  const flags = () =>
    page.evaluate(() => {
      const a = (window as any).__neural
      return { coachDone: a._coachDone === true, coachTruthy: !!a._coach }
    })
  const storedFlag = () => page.evaluate(() => localStorage.getItem("bjj-neural-coached"))

  // ── BASELINE: fresh landing fired the coach exactly once; the machine is live at step 1. ──
  await j.expectBeat("coach_1")
  expect(await coach1Count(), "coach fired exactly once on the fresh landing").toBe(1)
  expect(await coachCardCount(), "exactly one [data-coach] card is up").toBe(1)
  {
    const f = await flags()
    expect(f.coachTruthy, "_coach is truthy (coach live) before we finish it").toBe(true)
    expect(f.coachDone, "_coachDone still false while the coach is up").toBe(false)
  }

  // ── FINISH: dismissCoach → finishCoach sets _coachDone AND writes the storage flag. ──
  await page.evaluate(() => (window as any).__neural.dismissCoach())
  await j.expectBeat("coach_done")
  {
    const f = await flags()
    expect(f.coachDone, "_coachDone latched true after finish").toBe(true)
    expect(f.coachTruthy, "_coach cleared to falsy after finish").toBe(false)
  }
  expect(await storedFlag(), "finishCoach persisted bjj-neural-coached='1'").toBe("1")
  expect(await coachDoneCount(), "coach_done fired exactly once").toBe(1)

  // ── THE EXPERIMENT: wipe the storage flag, then re-invoke maybeStartCoach() in the SAME
  // evaluate. If the storage read were the real guard the wiped flag would re-arm the coach;
  // the in-memory _coachDone short-circuit (line 4035) must prevent that. ──
  await page.evaluate(() => {
    localStorage.removeItem("bjj-neural-coached")
    ;(window as any).__neural.maybeStartCoach()
  })
  await j.advance(2000) // give any (bug) re-render time to land — no re-coach should appear

  // ── VERDICT: no re-coach happened. ──
  expect(await coach1Count(), "STILL exactly one coach_1 — no re-coach despite the wiped storage flag").toBe(1)
  expect(await coachCardCount(), "zero [data-coach] cards — no card was re-rendered").toBe(0)
  {
    const f = await flags()
    expect(f.coachTruthy, "_coach stayed falsy — maybeStartCoach short-circuited").toBe(false)
    expect(f.coachDone, "_coachDone still true — the in-memory guard is intact").toBe(true)
  }

  // ── THE TELL: the short-circuit returned BEFORE the storage read/write path (line 4036+), so
  // bjj-neural-coached stayed null — proving the guard is _coachDone, not the storage read. ──
  expect(await storedFlag(), "storage flag stayed wiped — the guard returned before any storage access").toBeNull()
  expect(await coachDoneCount(), "coach_done still fired exactly once — finishCoach never re-ran").toBe(1)

  expect(errors, "no pageerror across the finish, the wipe, and the re-invoke").toEqual([])
})
