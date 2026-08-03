/* @hyperspace {"theme":"challenges-and-belt-bar","L":"casual-week1","F":"challenges","B":"error-fallback"} @invariant "The challenge engine is curriculum-independent: with curriculum.json 404, event-based challenges still count live beats and persist to the blob, while snapshot lesson/checkpoint challenges hold at zero without crashing." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { casualWeek1, CURRICULUM } from "./personas"

/**
 * CHALLENGE ENGINE WITHOUT A CURRICULUM — event beats count, snapshots hold at zero.
 * Source seams (verified at authoring):
 *   - challenge-definitions.src.js:92 — white.commit: { event: "commit" }, target 1 —
 *     a pure EVENT challenge, no curriculum dependency anywhere in its rule.
 *   - challenge-definitions.src.js:274-275 — blue.lesson-three { snapshot: "lessonCount" }
 *     and blue.checkpoint { snapshot: "checkpointCount" } — SNAPSHOT challenges whose
 *     denominators come from _challengeSnapshot().
 *   - app.src.jsx:4489 — _challengeSnapshot() derives lessonCount by iterating
 *     this._lessonIndex; with curriculum.json 404 the index is {} (app.src.jsx:2542),
 *     so lessonCount is 0 even though casualWeek1 carries prep=3/rec=3 for every
 *     unit-1 deck (with a live curriculum those same decks WOULD count as done lessons).
 *   - app.src.jsx:4535 — noteChallenges runs synchronously inside fx(); under the test
 *     rails saves are synchronous, so the blob is readable right after the commit click.
 *   - white.win1 { event: "impact_success" } is the reload CONTROL: resolve is rigged
 *     to fail (0.95), so win1 must stay incomplete across the reload — proving the
 *     survival of white.commit is real persistence, not a blanket compatibility sync.
 *
 * Determinism census: land-mc-pick (30) + land-mc-shuffle (8) pre-sized BEFORE land()
 * (the landing question mounts inside land()'s pump and draws only land-scoped tags);
 * land() covers ai-skill/role/max-moves; resolve [0.95] + outcome [0.01] cover a needle
 * sweep during the post-commit pumps. keepTutorial:true on BOTH boots — the DSL's
 * default tutorial-done sync would complete every white challenge and void the test.
 *
 * Q006 workaround (e2e/quarantine/ISSUES.md): the challenge cue (aside.ng-tut
 * .ng-challenge-cue, pointer-events:auto) captures the centers of the first tray cards,
 * so the commit pick hit-tests card centers and takes the first genuinely hittable one
 * (fix-shape-agnostic: once Q006 is fixed the first card simply becomes eligible).
 *
 * Structure-only assertions: progress shapes, beat ids, counts, deckKeys from
 * curriculum.json — never card/answer text.
 */

const UNIT1_KEYS: string[] = CURRICULUM.belts[0].units[0].lessons.map(
  (l: any) => l.deckKey,
)

test("curriculum 404: white.commit counts a live commit and survives reload while blue snapshot challenges hold at zero", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))

  const j = journey(page)
  await j.boot("/", {
    initialState: casualWeek1(),
    noCurriculum: true,
    keepTutorial: true,
  })

  // ── boot state: full graph, no curriculum, empty lesson index, persona blob intact ──
  const boot = await page.evaluate(() => {
    const a = (window as any).__neural
    return {
      nodes: a.nodes.length,
      curriculum: a.curriculum ?? null,
      lessonIndexKeys: Object.keys(a._lessonIndex || {}).length,
      prepKeys: Object.keys(a.prep || {}),
    }
  })
  expect(boot.nodes, "full graph ingested despite curriculum 404").toBeGreaterThan(1000)
  expect(boot.curriculum, "curriculum is null after the 404").toBeNull()
  expect(boot.lessonIndexKeys, "lesson index is empty without a curriculum").toBe(0)
  for (const key of UNIT1_KEYS)
    expect(boot.prepKeys, `persona prep for ${key} survived the 404 boot`).toContain(key)

  // ── land with the landing question's scoped queues pre-sized ──
  await j.rig("land-mc-pick", [
    0.07, 0.31, 0.55, 0.79, 0.93, 0.17, 0.41, 0.65, 0.89, 0.03, 0.27, 0.51,
    0.75, 0.99, 0.13, 0.37, 0.61, 0.85, 0.09, 0.23, 0.47, 0.71, 0.95, 0.19,
    0.43, 0.67, 0.91, 0.05, 0.29, 0.53,
  ])
  await j.rig("land-mc-shuffle", [0.21, 0.62, 0.34, 0.88, 0.14, 0.52, 0.76, 0.28])
  await j.land("Mount Top")
  await j.rig("resolve", [0.95]) // fail — keeps the win1 control incomplete
  await j.rig("outcome", [0.01])

  // ── commit via the first HITTABLE tray card (Q006: the cue shades early centers) ──
  const hittable = await page.evaluate(() => {
    const cards = Array.from(
      document.querySelectorAll("[data-tech]"),
    ) as HTMLElement[]
    for (const card of cards) {
      const r = card.getBoundingClientRect()
      if (!r.width || !r.height) continue
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
      if (hit && hit.closest("[data-tech]") === card)
        return card.getAttribute("data-tech")
    }
    return null
  })
  expect(hittable, "a tray card whose center hit-tests to itself exists").toBeTruthy()
  await j.pick(hittable as string)
  await j.advanceUntil("commit")

  // ── event challenge counted + persisted; snapshot challenges pinned at zero ──
  const live = await page.evaluate(() => {
    const a = (window as any).__neural
    const beats = (a.beats || []) as any[]
    return {
      commit: a.challengeProgress("white.commit"),
      completedIds: beats
        .filter((b) => b.beat === "challenge_completed")
        .map((b) => b.id),
      lessonThree: a.challengeProgress("blue.lesson-three"),
      checkpoint: a.challengeProgress("blue.checkpoint"),
      lessonCount: a._challengeSnapshot().lessonCount,
      blobChallenges:
        JSON.parse(localStorage.getItem("bjj-neural-progress") || "{}")
          .challenges || {},
    }
  })
  expect(live.commit.done, "white.commit done after the live commit beat").toBe(true)
  expect(live.completedIds, "challenge_completed fired for white.commit").toContain(
    "white.commit",
  )
  expect(
    live.blobChallenges["white.commit"]?.done,
    "white.commit persisted to the blob synchronously",
  ).toBe(true)
  expect(
    live.lessonThree,
    "blue.lesson-three holds at zero with no lesson index",
  ).toMatchObject({ progress: 0, done: false })
  expect(live.checkpoint.progress, "blue.checkpoint holds at zero").toBe(0)
  expect(
    live.lessonCount,
    "snapshot lessonCount is 0 — prep evidence has no curriculum to bind to",
  ).toBe(0)

  // ── reload (same 404): the event challenge survives, the control does not flip ──
  await j.boot("/", {
    preserveStorage: true,
    noCurriculum: true,
    keepTutorial: true,
  })
  const after = await page.evaluate(() => {
    const a = (window as any).__neural
    return {
      nodes: a.nodes.length,
      curriculum: a.curriculum ?? null,
      lessonIndexKeys: Object.keys(a._lessonIndex || {}).length,
      commit: a.challengeProgress("white.commit"),
      win1: a.challengeProgress("white.win1"),
      lessonThree: a.challengeProgress("blue.lesson-three"),
      checkpoint: a.challengeProgress("blue.checkpoint"),
    }
  })
  expect(after.commit.done, "white.commit still done after reload").toBe(true)
  expect(
    after.win1.done,
    "control: white.win1 stays incomplete — no blanket sync completed it",
  ).toBe(false)
  expect(after.lessonThree.progress, "blue.lesson-three still zero after reload").toBe(0)
  expect(after.checkpoint.progress, "blue.checkpoint still zero after reload").toBe(0)
  expect(after.nodes, "graph unchanged on the reload boot").toBeGreaterThan(1000)
  expect(after.curriculum, "curriculum still null on the reload boot").toBeNull()
  expect(after.lessonIndexKeys, "lesson index still empty on the reload boot").toBe(0)

  // ── the Challenges browse surface stays usable and names the outage ──
  await page.evaluate(() => {
    const a = (window as any).__neural
    a.setViewMode("challenges")
    a.openExplorer()
    a.showExplorerList()
  })
  await expect(page.locator(".ng-track-card")).toHaveCount(5)
  await expect(page.locator(".ng-challenge-curriculum")).toContainText(
    "Curriculum is unavailable right now",
  )

  expect(errors, "no pageerror across both boots and the commit").toEqual([])
})
