import { test, expect } from "@playwright/test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { journey } from "../dsl"

/**
 * BELT PATH P1 — CURRICULUM + PATH VIEW + V2 PERSISTENCE (spec first).
 *
 * Surfaces this spec forces into existence (neural/src/app.src.jsx + xdc-template):
 *   this.curriculum (fetched, absence-guarded) · _viewMode ("path"|"tree", localStorage
 *   bjj_view_mode, default path WHEN curriculum loaded) · [data-view] segmented control ·
 *   renderBeltPath rows: [data-belt] [data-unit] [data-lesson] [data-checkpoint]
 *   [data-belt-test] with data-locked/data-done/data-live state attrs ·
 *   openLessonStudy (camera flight + lesson deck session) · fog rail _curriculumIdxSet ·
 *   v2 progress blob {v:2, prep, rec, stage, days, settings, units, belts} with v1
 *   migration (rec grandfathered = prep) · beats: path_opened, lesson_done, unit_done.
 *
 * Seeds derive from the SERVED curriculum fixture, so owner curriculum edits never break
 * these tests.
 */

const CURRICULUM = JSON.parse(
  readFileSync(resolve(__dirname, "../../source/public/static/neural/curriculum.json"), "utf8"),
)
const WHITE = CURRICULUM.belts[0]
const UNIT1 = WHITE.units[0]
const goal = (deckSize: number) => Math.min(3, deckSize)

/** a v1-style blob with every lesson of white unit 1 drilled to goal */
function unit1DoneBlob() {
  const prep: Record<string, number> = {}
  for (const l of UNIT1.lessons) prep[l.deckKey] = 3
  return { v: 1, prep, days: {}, settings: {} }
}

async function openPath(j: any, page: any) {
  await page.evaluate(() => (window as any).__neural.toggleExplorer())
  await expect(page.locator("[data-view]").first()).toBeVisible()
}

test("PATH|TREE toggle: exists, defaults to path, persists", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await openPath(j, page)

  // curriculum loaded → path is the default explorer mode
  const mode = await page.evaluate(() => (window as any).__neural._viewMode)
  expect(mode).toBe("path")
  await j.expectBeat("path_opened")
  expect(await page.locator(`[data-belt="${WHITE.id}"]`).count()).toBeGreaterThan(0)

  // switch to TREE → persisted
  await page.locator('[data-view="tree"]').click()
  expect(await page.evaluate(() => localStorage.getItem("bjj_view_mode"))).toBe("tree")
  await j.boot("/", { preserveStorage: true })
  await j.land("Mount Top")
  await page.evaluate(() => (window as any).__neural.toggleExplorer())
  expect(await page.evaluate(() => (window as any).__neural._viewMode)).toBe("tree")
})

test("locks: white open, blue locked, units sequential", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await openPath(j, page)

  const white = page.locator(`[data-belt="${WHITE.id}"]`).first()
  const blue = page.locator(`[data-belt="${CURRICULUM.belts[1].id}"]`).first()
  await expect(white).toBeVisible()
  expect(await white.getAttribute("data-locked")).toBeNull()
  expect(await blue.getAttribute("data-locked")).toBe("1")

  const units = page.locator(`[data-unit]`)
  expect(await units.first().getAttribute("data-locked")).toBeNull()
  expect(await units.nth(1).getAttribute("data-locked")).toBe("1")
})

test("lesson click flies the camera and opens the lesson deck session", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await openPath(j, page)

  const first = UNIT1.lessons[0]
  await page.locator(`[data-lesson="${first.deckKey}"]`).first().click()
  await j.advance(1500)
  const state = await page.evaluate((deckKey) => {
    const a = (window as any).__neural
    const node = a.nodes[a._lessonNodeIdx(deckKey)]
    return {
      cam: a.camTarget ? { x: a.camTarget.cx, y: a.camTarget.cy } : null,
      node: node ? { x: node.x, y: node.y } : null,
      deckOpen: !!a.deckOpen,
      session: (a._session?.keys || []).slice(),
    }
  }, first.deckKey)
  expect(state.node).toBeTruthy()
  expect(Math.abs(state.cam!.x - state.node!.x)).toBeLessThan(60)
  expect(Math.abs(state.cam!.y - state.node!.y)).toBeLessThan(60)
  expect(state.deckOpen).toBe(true)
  // the session carries the UNIT's frame-live deck keys (a unit IS a study session)
  expect(state.session).toContain(first.deckKey)
})

test("drilling a lesson to goal emits lesson_done and marks the row", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  const first = UNIT1.lessons[0]
  await j.drill(3, first.deckKey)
  await j.expectBeat("lesson_done")
  await openPath(j, page)
  expect(
    await page.locator(`[data-lesson="${first.deckKey}"]`).first().getAttribute("data-done"),
  ).toBe("1")
})

test("checkpoint (placeholder) completes the unit once all lessons are done", async ({ page }) => {
  const j = journey(page)
  await j.boot("/", { initialState: unit1DoneBlob() })
  await j.land("Mount Top")
  await openPath(j, page)

  await page.locator(`[data-checkpoint="${WHITE.id}/${UNIT1.id}"]`).first().click()
  await j.expectBeat("unit_done")
  expect(
    await page.locator(`[data-unit="${WHITE.id}/${UNIT1.id}"]`).first().getAttribute("data-done"),
  ).toBe("1")
  // completing unit 1 unlocks unit 2
  expect(await page.locator(`[data-unit]`).nth(1).getAttribute("data-locked")).toBeNull()
})

test("gi-only lesson is disabled in nogi and excluded from unit math", async ({ page }) => {
  const giOnly: { deckKey: string } | undefined = CURRICULUM.belts
    .flatMap((b: any) => b.units)
    .flatMap((u: any) => u.lessons)
    .find((l: any) => l.frames?.length === 1 && l.frames[0] === "gi")
  test.skip(!giOnly, "curriculum has no gi-only lesson")

  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await page.evaluate(() => (window as any).__neural.setGiMode("nogi"))
  await openPath(j, page)

  const row = page.locator(`[data-lesson="${giOnly!.deckKey}"]`).first()
  expect(await row.getAttribute("data-live")).toBe("0")
  expect(await row.getAttribute("aria-disabled")).toBe("true")
})

test("TREE view ignores locks entirely", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await openPath(j, page)
  await page.locator('[data-view="tree"]').click()
  expect(await page.locator("[data-locked]").count()).toBe(0)
  expect(await page.locator("[data-lesson]").count()).toBe(0)
})

test("v1 progress blob migrates to v2 with rec grandfathered", async ({ page }) => {
  const j = journey(page)
  await j.boot("/", { initialState: { v: 1, prep: { "Mount|Top": 3 }, days: {}, settings: {} } })
  const state = await page.evaluate(() => {
    const a = (window as any).__neural
    return { rec: a.rec?.["Mount|Top"] ?? null, blobV: a._progressBlob().v }
  })
  expect(state.rec).toBe(3) // grandfathered = prep
  expect(state.blobV).toBe(2)
})

test("fog-of-war rail: non-curriculum nodes dim while path view is open", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await openPath(j, page)
  const fog = await page.evaluate(() => {
    const a = (window as any).__neural
    const set = a._curriculumIdxSet
    if (!set || !set.size) return null
    let outsider = -1
    for (let i = 0; i < a.nodes.length; i++) if (!set.has(i)) { outsider = i; break }
    return { size: set.size, hasOutsider: outsider >= 0, dimActive: !!a._pathDim }
  })
  expect(fog).toBeTruthy()
  expect(fog!.size).toBeGreaterThan(50)
  expect(fog!.hasOutsider).toBe(true)
  expect(fog!.dimActive).toBe(true)
})

test("curriculum 404: app falls back to tree view without crashing", async ({ page }) => {
  const j = journey(page)
  await j.boot("/", { noCurriculum: true })
  await j.land("Mount Top")
  const state = await page.evaluate(() => {
    const a = (window as any).__neural
    return { curriculum: a.curriculum ?? null, mode: a._viewMode, nodes: a.nodes.length }
  })
  expect(state.curriculum).toBeNull()
  expect(state.mode).toBe("tree")
  expect(state.nodes).toBeGreaterThan(1000)
})
