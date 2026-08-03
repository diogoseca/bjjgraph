/* @hyperspace {"theme":"unlock-economy","L":"curriculum-mid","F":"belt-path","B":"guard-limit"} @invariant "Evidence gates are enforced on ACTIONS, not styling: an unsatisfied unit's checkpoint button is disabled and a direct startCheckpoint call is economically inert (no checkpoint_start, no quiz, zero new beats), the unready capstone button is disabled and a direct startBeltTest call arms nothing (no belt_test_start, no _beltTest) — while lesson buttons are deliberately ungated and always open study." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { curriculumMid, CURRICULUM } from "./personas"

/**
 * EVIDENCE GATES ARE ECONOMICALLY INERT — v1.74 retired the lock model (every track and
 * every lesson is open from day one); what remains gated is the checkpoint (needs every
 * live lesson done) and the capstone (needs every unit checkpoint). Those gates must gate
 * the ACTION, not just paint the button gray: a mid-curriculum white belt drives straight
 * into both shut gates — disabled-button DOM clicks AND ungated direct method calls — and
 * NOTHING moves: no deck, no session, no camera fly, no quiz, no test armed, zero new beats.
 *
 * Mechanism under test (neural/src/app.src.jsx + challenge-ui.src.js):
 *   - challengeCurriculumElement wires every checkpoint/capstone button's click handler
 *     UNCONDITIONALLY — the `disabled` property is the only DOM-level gate (a native
 *     el.click() on a disabled button dispatches nothing).
 *   - SHARP EDGE this spec exists for: the DEEPER gates. startCheckpoint re-checks
 *     `live.every(lessonDone)` and returns BEFORE its fx beat; startBeltTest re-checks
 *     `belt.units.every(unitComplete)` and returns BEFORE belt_test_start. A regression
 *     that drops either internal gate would let a stale/forged DOM click (or console call)
 *     start an unearned quiz or capstone; the direct-call legs catch it.
 *   - Lessons are deliberately UNGATED (v1.74 open-model): no [data-lesson] button is ever
 *     disabled, and openLessonStudy has no internal gate — clicking any lesson opens study.
 *     The two lesson-control legs pin that inversion (done U0 lesson + untouched U2 lesson).
 *   - Evidence lineage under curriculumMid: U0 complete (lessons + checkpoint seeded), U1
 *     half-drilled (no checkpoint) → U2's checkpoint is evidence-shut, and the white
 *     capstone (needs ALL unit checkpoints) is shut too.
 *   - Timing: openExplorer auto-pauses the game so the decision clock is frozen —
 *     advance(400) after each inert leg can surface no expiry_warning / auto_pick ambient
 *     beats, making beats.length delta 0 STRICTLY assertable.
 *
 * Rigs: none beyond land()'s built-ins (ai-skill/role/max-moves) — the challenges render
 * draws no RNG. All keys derive from the served curriculum fixture, never hardcoded.
 *
 * v1.70 re-validation note kept: the seed sets settings.landQuestions=false (no unrigged
 * land-mc-* draws), and clearLandCard() runs after land() before the explorer opens — the
 * unstyled landing card would otherwise intercept clicks on the top rows under the
 * harness's hermetic font-abort (probe-verified not user-facing).
 */

const WHITE: any = CURRICULUM.belts[0]
const U0: any = WHITE.units[0]
const U1: any = WHITE.units[1]
const U2: any = WHITE.units[2]
const U2_KEY = `${WHITE.id}/${U2.id}`
// first U2 lesson live in the default gi frame — its openability is then attributable to
// the open-model alone (the unit's checkpoint is shut, yet the lesson opens)
const OPEN_LESSON: string = (U2.lessons.find((l: any) => (l.frames || ["gi", "nogi"]).includes("gi")) || {}).deckKey
// unlocked-U0 delivery control: done lessons KEEP their handlers too
const CONTROL_LESSON: string = U0.lessons[0].deckKey

test("mid-curriculum: shut checkpoint/capstone gates are inert to clicks AND direct calls — gates gate actions, not styling", async ({
  page,
}) => {
  // ── curriculum facts the evidence lineage leans on — fail loudly here if the corpus shifts ──
  expect(WHITE.units.length, "white defines units 0/1/2 for the frontier").toBeGreaterThanOrEqual(3)
  expect(OPEN_LESSON, "U2 defines a gi-live lesson to click").toBeTruthy()
  expect(CONTROL_LESSON, "U0 defines the done control lesson").toBeTruthy()
  expect(CONTROL_LESSON, "control and untouched lessons are distinct decks").not.toBe(OPEN_LESSON)
  expect((U0.lessons[0].frames || ["gi", "nogi"]).includes("gi"), "control lesson live in default gi frame").toBe(true)
  expect(WHITE.test, "white defines a capstone test block (the shut capstone button)").toBeTruthy()

  const j = journey(page)
  const seed: any = curriculumMid()
  seed.settings.landQuestions = false // v1.68 landing MC off — no unrigged draws, no land beats
  await j.boot("/", { initialState: seed })
  await j.land("Mount Top")
  // drop the v1.68 landing card — harness-only obstruction over the top rows (see header)
  await page.evaluate(() => (window as any).__neural.clearLandCard())

  // open the explorer's CHALLENGES view (curriculum loaded → challenges is the default mode);
  // openExplorer auto-pauses the game — the freeze that makes beat-count strictness safe
  await page.evaluate(() => (window as any).__neural.toggleExplorer())
  await expect(page.locator("[data-view]").first()).toBeVisible()
  await j.expectBeat("challenges_opened")

  // ── guard the lineage: U0 cleared, U1 the open frontier, U2's gate + the capstone SHUT ──
  const cp = (uk: string) => page.locator(`[data-checkpoint="${uk}"]`).first()
  expect(await cp(`${WHITE.id}/${U0.id}`).textContent(), "U0 checkpoint cleared (seeded)").toContain("cleared")
  expect(await cp(`${WHITE.id}/${U1.id}`).textContent(), "U1 not cleared (the frontier)").not.toContain("cleared")
  expect(await cp(U2_KEY).isDisabled(), "U2 checkpoint button evidence-shut").toBe(true)
  expect(await cp(U2_KEY).textContent(), "U2 checkpoint not cleared").not.toContain("cleared")
  const capBtn = page.locator(`[data-capstone="${WHITE.id}"] button`).first()
  expect(await capBtn.isDisabled(), "white capstone button shut (needs every unit checkpoint)").toBe(true)
  // the open-model half: NO lesson button anywhere is disabled — lessons are ungated by design
  expect(await page.locator("[data-lesson][disabled]").count(), "zero disabled lesson buttons").toBe(0)

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
  expect(base.deckOpen, "no deck open before the probes").toBe(false)
  expect(base.session, "no study session before the probes").toBe(false)
  expect(base.checkpoint, "no checkpoint quiz before the probes").toBe(false)
  expect(base.beltTest, "no belt test armed before the probes").toBe(false)
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
    // every real success path here closes the explorer (openLessonStudy via locateNode,
    // startCheckpoint, startBeltTest all do) — it staying open is itself gate-held proof
    await expect(page.locator("[data-view]").first(), `${what}: explorer still open`).toBeVisible()
  }

  // ── leg 1a: native click on the DISABLED U2 checkpoint button (dispatches nothing) ──
  await page.evaluate((uk) => {
    const el = document.querySelector(`[data-checkpoint="${uk}"]`) as HTMLButtonElement
    el.click()
  }, U2_KEY)
  await j.advance(400)
  await expectInert("disabled checkpoint click")

  // ── leg 1b: the DEEPER gate — an ungated direct startCheckpoint call is refused inside ──
  await page.evaluate(([beltId, unitId]) => {
    const a = (window as any).__neural
    const belt = a.curriculum.belts.find((b: any) => b.id === beltId)
    a.startCheckpoint(beltId, belt.units.find((u: any) => u.id === unitId))
  }, [WHITE.id, U2.id] as const)
  await j.advance(400)
  await expectInert("direct startCheckpoint call")

  // ── leg 2a: native click on the DISABLED capstone button ──
  await page.evaluate((beltId) => {
    const el = document.querySelector(`[data-capstone="${beltId}"] button`) as HTMLButtonElement
    el.click()
  }, WHITE.id)
  await j.advance(400)
  await expectInert("disabled capstone click")

  // ── leg 2b: the DEEPER gate — an ungated direct startBeltTest call is refused inside ──
  await page.evaluate((beltId) => (window as any).__neural.startBeltTest(beltId), WHITE.id)
  await j.advance(400)
  await expectInert("direct startBeltTest call")

  // beat-name census across the whole gated phase: the gated beats never fired at all
  const beats = await j.beats()
  expect(beats.filter((b) => b.beat === "checkpoint_start"), "no checkpoint_start ever").toHaveLength(0)
  expect(beats.filter((b) => b.beat === "belt_test_start"), "no belt_test_start ever").toHaveLength(0)

  // ── delivery control A (red-proof in green): the done U0 lesson's SAME click machinery
  //    flips the economy — the inert legs above weren't vacuous ──
  await page.locator(`[data-lesson="${CONTROL_LESSON}"]`).first().click()
  const postA = await snap()
  expect(postA.deckOpen, "control A: done lesson opened its deck").toBe(true)
  expect(postA.posKey, "control A: study jumped to the clicked deck").toBe(CONTROL_LESSON)
  expect(postA.session, "control A: study session armed").toBe(true)

  // ── delivery control B (the open-model inversion): an UNTOUCHED U2 lesson opens too —
  //    its unit's checkpoint is shut, yet the lesson is deliberately ungated ──
  await page.evaluate(() => (window as any).__neural.toggleExplorer()) // control A closed it
  await expect(page.locator("[data-view]").first()).toBeVisible()
  await page
    .locator(`.ng-challenge-group:has([data-lesson="${OPEN_LESSON}"])`)
    .first()
    .evaluate((el) => ((el as HTMLDetailsElement).open = true)) // U2's group is collapsed by default
  await page.locator(`[data-lesson="${OPEN_LESSON}"]`).first().click()
  const postB = await snap()
  expect(postB.deckOpen, "control B: untouched lesson opened its deck").toBe(true)
  expect(postB.posKey, "control B: study jumped to the untouched deck").toBe(OPEN_LESSON)
  expect(postB.session, "control B: study session armed").toBe(true)
})
