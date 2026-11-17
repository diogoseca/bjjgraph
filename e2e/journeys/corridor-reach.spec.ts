import { expect, test, type Page } from "@playwright/test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { journey } from "../dsl"

/**
 * THE CORRIDOR'S REACH IN MASTER THE GAME (v1.284.0, SET1 slice B; PATH-R1, the independent read of #430, 17 Nov).
 * The Path left the drawer and its corridor lives in Master the game. The reader measured by real input what moved, and the
 * orchestrator ruled; each ruling has its journey here, by a real mouse at 1440x900 and by touch at 390x631:
 *   1. View Collection lands on an OPEN shelf from every door, warm or cold, and `neural_collection_opened` counts the
 *      openings a player can see: the door's once, then each of the player's own.
 *   3. A belt test that can be started is never behind "Show earlier belts"; a won one waits behind it.
 *   4. ‹ Back from a checkpoint started in the corridor returns to the corridor, its row in view.
 *   5a. `openLearningView("collection")` lands in Master the game with the shelf open (O3).
 *   6. A repaint keeps the reading position (the claim that lost its only test with the arrival scroll).
 * Ruling 2 (`neural_practice_opened`'s surface) is in path-visit-telemetry.spec.ts.
 * The record is the reader's `mid` seed, built from the SERVED curriculum: White done and won, Blue's six units proven and
 * its test not taken, Purple worn and its unit 1 ready for its checkpoint, 2 patches and 2 coins.
 * Mutants: listed with their results in docs/Changelog-Archive.md's v1.284.0 entry (PATH-R1).
 */

type W = Window & { __neural: any }
const CUR = JSON.parse(readFileSync(resolve(__dirname, "../../source/public/static/neural/curriculum.json"), "utf8"))
const BELT = Object.fromEntries(CUR.belts.map((b: any) => [b.id, b]))
const WHITE_LEGACY = ["coach1", "coach2", "coach3", "answer", "sheet", "commit", "sweep", "win1", "refund", "defend", "escape", "roll",
  "pane_open", "pane_close", "film", "recall", "roam", "path", "lesson", "belt"]

function mid() {
  const b: any = { v: 2, prep: {}, rec: {}, stage: {}, srs: {}, units: {}, belts: { won: {} }, tut: { done: {} }, challenges: {}, badges: {},
    coins: {}, days: {}, settings: {}, settingsAt: {}, updatedAt: 100 }
  const done = (id: string, won: boolean) => {
    for (const u of BELT[id].units) { b.units[id + "/" + u.id] = { checkpoint: true, t: 1 }; for (const l of u.lessons) { b.prep[l.deckKey] = 3; b.rec[l.deckKey] = 3 } }
    if (won) b.belts.won[id] = { moves: 12, dominance: 5, byPoints: false }
  }
  done("white", true); done("blue", false)
  const [u1, u2] = BELT.purple.units
  for (const l of u1.lessons) { b.prep[l.deckKey] = 3; b.rec[l.deckKey] = 3 }
  for (const l of u2.lessons.slice(0, 3)) b.prep[l.deckKey] = 3
  for (const k of WHITE_LEGACY) b.tut.done[k] = 1
  b.badges = { "white-foundations": { t: 1 }, "clean-checkpoint": { t: 2 } }
  b.coins = { houdini: { t: 3 }, godlike: { t: 4 } }
  b.settings = { challengeOpenSections: { purple: true } }; b.settingsAt = { challengeOpenSections: 50 }
  return b
}
const PURPLE_U1 = "purple/" + BELT.purple.units[0].id

/** A press the way a player makes it: the point under it is the control (or inside it), the control is shown, and the press
 *  is a real mouse click or a real touch tap at that point. The drawer re-renders in place, so the element is re-queried. */
async function press(page: Page, selector: string, what: string, touch: boolean) {
  for (let i = 0; ; i++) {
    try { await page.locator(selector).first().scrollIntoViewIfNeeded({ timeout: 3_000 }); break }
    catch (e) { if (i >= 4) throw e; await page.waitForTimeout(250) }
  }
  const at = await page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement | null
    if (!el) return { ok: false, why: "no element matches", x: 0, y: 0 }
    const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2
    const top = document.elementFromPoint(x, y)
    let alpha = 1
    for (let n: HTMLElement | null = el; n; n = n.parentElement) alpha *= Number(getComputedStyle(n).opacity)
    if (alpha < 0.5) return { ok: false, why: "effective opacity " + alpha.toFixed(2), x, y }
    return { ok: !!top && (top === el || el.contains(top)), why: top ? "<" + top.tagName.toLowerCase() + " " + (top as HTMLElement).className + ">" : "nothing", x, y }
  }, selector)
  expect(at.ok, `${what}: the point under the press is the control (${at.why})`).toBe(true)
  if (touch) await page.touchscreen.tap(at.x, at.y)
  else await page.mouse.click(at.x, at.y)
}
const inView = (page: Page, selector: string) => page.evaluate((sel) => {
  const el = document.querySelector(sel)
  if (!el) return false
  const r = el.getBoundingClientRect()
  return r.height > 0 && r.bottom > 0 && r.top < innerHeight
}, selector)
const collectionOpened = (page: Page) => page.evaluate(() => [...(window as any).posthog].filter((c: any) => c[0] === "capture" && c[1] === "neural_collection_opened").length)
const practice = (page: Page) => page.evaluate(() => !!(window as W).__neural._practiceInDrawer())
const queue = { beforeNavigate: async (page: Page) => {
  await page.addInitScript(() => {
    const q: any = (window as any).posthog = []
    q.capture = (...args: any[]) => q.push(["capture", ...args])
  })
} }
async function bootMid(page: Page) {
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))
  const j = journey(page)
  await j.boot("/", { keepTutorial: true, initialState: mid(), ...queue })
  await expect.poll(() => page.evaluate(() => !!(window as W).__neural.curriculum)).toBe(true)
  return { j, errors }
}
async function openMaster(page: Page, touch: boolean) {
  if (!(await page.evaluate(() => !!(window as W).__neural.deckShown))) await press(page, ".ng-logo", "open the drawer", touch)
  await press(page, '[data-explore-stats] [data-b="due"]', "Master the game", touch)
  await expect(page.locator("[data-practice-page]"), "Master the game is open").toHaveCount(1)
}

for (const touch of [false, true]) {
  const tag = touch ? "touch 390x631" : "mouse 1440x900"
  test.describe(tag, () => {
    test.use(touch ? { hasTouch: true, isMobile: true, viewport: { width: 390, height: 631 } } : { viewport: { width: 1440, height: 900 } })

    // RULING 1: every door, the plan warm (Master the game opened and closed once), lands on an open shelf
    for (const door of ["the map", "the drawer's list", "Last rolls, open", "Last rolls, the drawer shut"]) {
      test(`View Collection from ${door}, the plan warm, lands on an open shelf and counts one visit (${tag})`, async ({ page }) => {
        const { errors } = await bootMid(page)
        await openMaster(page, touch)
        await press(page, ".ng-explorer-close", "close the drawer from Master the game (the plan is warm now)", touch)
        if (door !== "the map") {
          await press(page, ".ng-logo", "open the drawer", touch)
          if (await practice(page)) await press(page, ".ng-drawer-brand", "back to the drawer's list", touch)
          await expect(page.locator("[data-drawer-explore]"), "premise: the drawer's list").toBeVisible()
          if (door.startsWith("Last rolls")) {
            await press(page, '[data-view="history"]', "Last rolls", touch)
            if (door.endsWith("shut")) await press(page, ".ng-explorer-close", "close the drawer", touch)
          }
        }
        await page.evaluate(() => (window as W).__neural.queueChallengeReward("coin", "frame-job"))
        await press(page, "[data-reward-collection]", "View Collection", touch)
        const shelf = "[data-practice-page] [data-rewards-shelf]"
        await page.waitForTimeout(400)
        expect({ open: await page.locator(shelf).evaluate((d: HTMLDetailsElement) => d.open), inView: await inView(page, shelf) },
          "at 0.4 s the shelf is open and in view").toEqual({ open: true, inView: true })
        await page.waitForTimeout(1600)
        expect({ open: await page.locator(shelf).evaluate((d: HTMLDetailsElement) => d.open), inView: await inView(page, shelf) },
          "at 2 s the shelf is open and in view").toEqual({ open: true, inView: true })
        expect(await collectionOpened(page), "the door's opening is one visit").toBe(1)
        await press(page, shelf + " > summary", "close the shelf", touch)
        await expect.poll(() => page.locator(shelf).evaluate((d: HTMLDetailsElement) => d.open)).toBe(false)
        await press(page, shelf + " > summary", "open the shelf again", touch)
        await expect.poll(() => collectionOpened(page), { message: "the player's own opening is the second visit" }).toBe(2)
        expect(errors, "no page error").toEqual([])
      })
    }

    // RULING 3: a startable belt test is drawn in the first draw; a won one waits behind the reveal
    test(`a startable belt test is drawn without "Show earlier belts" and starts in two presses (${tag})`, async ({ page }) => {
      const { errors } = await bootMid(page)
      expect(await page.evaluate(() => { const a = (window as W).__neural; return { worn: a.wornBelt().id, blue: a._beltTestStartable("blue"), white: a._beltTestStartable("white") } }),
        "premise: Purple worn, Blue's test startable, White's won").toEqual({ worn: "purple", blue: true, white: false })
      await openMaster(page, touch)
      await expect(page.locator('[data-practice-page] .ng-track-card[data-track="blue"]'), "Blue's head is drawn without the reveal").toHaveCount(1)
      await press(page, '[data-practice-page] .ng-track-card[data-track="blue"]', "Blue's head", touch)
      const start = '[data-practice-page] [data-capstone="blue"] button'
      await expect(page.locator(start)).toHaveText("Start capstone")
      await press(page, start, "Start capstone", touch)
      await expect.poll(() => page.evaluate(() => (window as W).__neural._beltTest?.beltId ?? null), { message: "Blue's test starts" }).toBe("blue")
      expect(errors, "no page error").toEqual([])
    })
    test(`a won belt test waits behind "Show earlier belts" (${tag})`, async ({ page }) => {
      await bootMid(page)
      await openMaster(page, touch)
      await expect(page.locator('[data-practice-page] .ng-track-card[data-track="white"]'), "White (won) is not drawn before the reveal").toHaveCount(0)
      await press(page, "[data-practice-page] [data-earlier-belts]", "Show earlier belts", touch)
      await expect(page.locator('[data-practice-page] .ng-track-card[data-track="white"]'), "the reveal draws it").toHaveCount(1)
    })

    // RULING 4: ‹ Back from a checkpoint started in the corridor returns there, the row in view
    test(`‹ Back from a checkpoint started in the corridor returns to it, its row in view (${tag})`, async ({ page }) => {
      const { errors } = await bootMid(page)
      await openMaster(page, touch)
      const cp = `[data-practice-page] [data-checkpoint="${PURPLE_U1}"]`
      await expect(page.locator(cp), "premise: Purple's unit 1 checkpoint is drawn").toHaveCount(1)
      await press(page, cp, "the unit's checkpoint", touch)
      await expect.poll(() => page.evaluate(() => !!(window as W).__neural._checkpoint), { message: "premise: the checkpoint is on" }).toBe(true)
      await press(page, ".ngBack[data-pane-back]", "‹ Back", touch)
      await expect.poll(() => practice(page), { message: "back in Master the game" }).toBe(true)
      await expect(page.locator(".ng-drawer-brand")).toHaveText("‹ Master the game")
      await expect.poll(() => inView(page, cp), { message: "the checkpoint's row is in view" }).toBe(true)
      expect(await page.evaluate(() => (window as W).__neural._checkpoint), "the quiz was left").toBeNull()
      expect(errors, "no page error").toEqual([])
    })

    // RULING 6: a repaint keeps the reading position
    test(`a corridor repaint keeps the reading position (${tag})`, async ({ page }) => {
      const { errors } = await bootMid(page)
      await openMaster(page, touch)
      const at = await page.evaluate(() => { const l = (window as W).__neural.drillListRef.current; l.scrollTop = 1200; return l.scrollTop })
      expect(at, "premise: the page scrolls to 1,200 px").toBe(1200)
      await page.evaluate(() => { const a = (window as W).__neural; (window as any).__corridorMark = a._session.corridor.firstChild; a.fx("roll_end", { outcome: "win", moves: 5 }) })
      await expect.poll(() => page.evaluate(() => !(window as any).__corridorMark?.isConnected), { message: "premise: the corridor was drawn again" }).toBe(true)
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
      expect(await page.evaluate(() => (window as W).__neural.drillListRef.current.scrollTop), "the reading position holds").toBe(1200)
      expect(errors, "no page error").toEqual([])
    })
  })
}

// RULING 5a: the collection door lands in Master the game with the shelf open (O3)
test("openLearningView(\"collection\") lands in Master the game with the shelf open", async ({ page }) => {
  await bootMid(page)
  await page.evaluate(() => (window as W).__neural.openLearningView("collection"))
  await expect.poll(async () => ({ practice: await practice(page), open: await page.locator("[data-practice-page] [data-rewards-shelf]").evaluate((d: HTMLDetailsElement) => d.open).catch(() => null) }),
    { message: "lands in Master the game, the shelf open" }).toEqual({ practice: true, open: true })
})
