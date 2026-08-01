import { test, expect } from "@playwright/test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { journey } from "../dsl"

/**
 * CAPSTONE B — THE BELT-TEST STORY (one continuous gameplay journey).
 *
 * A player with a completed white belt takes the boss battle and graduates:
 * READY test row → BELT TEST roll → win by tap → full celebration (belt beats + victory
 * cascade + the 2.5s fanfare on the sound bus) → reload → the gold row and the open blue
 * belt survive — and the first blue lesson actually opens for study (the unlock is
 * functional, not cosmetic). Seeds derive from the served curriculum fixture.
 */

const CURRICULUM = JSON.parse(
  readFileSync(resolve(__dirname, "../../source/public/static/neural/curriculum.json"), "utf8"),
)
const WHITE = CURRICULUM.belts[0]
const BLUE = CURRICULUM.belts[1]

function whiteDoneBlob() {
  const prep: Record<string, number> = {}
  const units: Record<string, any> = {}
  for (const u of WHITE.units) {
    units[`${WHITE.id}/${u.id}`] = { checkpoint: true, t: 1 }
    for (const l of u.lessons) prep[l.deckKey] = 3
  }
  return { v: 2, prep, rec: { ...prep }, stage: {}, units, belts: { won: {} }, days: {}, settings: {} }
}

async function playToTap(j: any, page: any, maxMoves = 8): Promise<boolean> {
  for (let m = 0; m < maxMoves; m++) {
    const sub = await page.evaluate(() => {
      const a = (window as any).__neural
      const subs = (a.optionIdxs || []).map((i: number) => a.nodes[i]).filter((n: any) => n.ty === "submissions")
      return subs.length ? subs[0].t : null
    })
    await j.rig("resolve", [0.01])
    await j.rig("outcome", [0.01])
    if (sub) {
      await j.pick(sub)
      await j.advanceUntil("roll_end", 20000)
      return true
    }
    const t = await page.evaluate(() => {
      const a = (window as any).__neural
      let fallback = null
      for (const i of a.optionIdxs || []) {
        const n = a.nodes[i]
        if (n.ty !== "transitions") continue
        fallback = fallback || n.t
        const res = a.resultPos(i, a.currentPos)
        if (res >= 0 && a.adj[res].some((k: number) => a.nodes[k].ty === "submissions")) return n.t
      }
      return fallback
    })
    if (!t) return false
    await j.pick(t)
    await j.nextHand(30000)
  }
  return false
}

test("belt-test story: READY → boss battle → tap → celebration → graduation persists", async ({ page }) => {
  const j = journey(page)
  await j.boot("/", { initialState: whiteDoneBlob() })
  await j.land("Mount Top")

  // ── the READY row is the invitation ──
  await page.evaluate(() => (window as any).__neural.toggleExplorer())
  const row = page.locator(`[data-belt-test="${WHITE.id}"]`).first()
  expect(await row.getAttribute("data-test-state")).toBe("ready")
  await row.click()
  await j.advanceUntil("belt_test_start", 20000)
  await j.nextHand(30000)
  await j.keyframe("capstone-b-belt-test-start")

  // ── the boss battle: play to the tap ──
  expect(await playToTap(j, page)).toBe(true)

  // ── full celebration: belt beats ordered before roll_end, cascade + fanfare on the bus ──
  const names = (await j.beats()).map((b: any) => b.beat)
  expect(names.indexOf("belt_test_won")).toBeGreaterThanOrEqual(0)
  expect(names.indexOf("belt_test_won")).toBeLessThan(names.indexOf("roll_end"))
  expect(names).toContain("belt_unlocked")
  expect(names).toContain("victory_cascade")
  const sounds = await j.soundLog()
  expect(sounds.some((s: any) => s.beat === "belt_test_won" && s.patch.includes("fanfare"))).toBe(true)
  await j.keyframe("capstone-b-graduated")

  // ── reload: the graduation is real ──
  await j.boot("/", { preserveStorage: true })
  await j.land("Mount Top")
  await page.evaluate(() => (window as any).__neural.toggleExplorer())
  expect(
    await page.locator(`[data-belt-test="${WHITE.id}"]`).first().getAttribute("data-test-state"),
  ).toBe("won")
  const blueBelt = page.locator(`[data-belt="${BLUE.id}"]`).first()
  expect(await blueBelt.getAttribute("data-locked")).toBeNull()

  // ── and the next belt is genuinely playable: its first lesson opens for study ──
  const blueLesson = BLUE.units[0].lessons[0]
  await page.locator(`[data-lesson="${blueLesson.deckKey}"]`).first().click()
  await j.advance(1000)
  expect(await page.evaluate(() => !!(window as any).__neural.deckOpen)).toBe(true)
  expect(await page.evaluate(() => (window as any).__neural._posKey)).toBe(blueLesson.deckKey)
})
