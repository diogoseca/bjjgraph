import { expect, test, type Page } from "@playwright/test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { journey } from "../dsl"

/**
 * THE CORRIDOR'S REACH IN MASTER THE GAME (v1.287.0, SET1 slice B; PATH-R1, the independent read of #430, 17 Nov).
 * The Path left the drawer and its corridor lives in Master the game. The reader measured by real input what moved, and the
 * orchestrator ruled; each ruling has its journey here, by a real mouse at 1440x900 and by touch at 390x631:
 *   1. View Collection lands on an OPEN shelf from every door, warm or cold, and `neural_collection_opened` counts the
 *      openings a player can see: the door's once, then each of the player's own.
 *   3. A belt test that can be started is never behind "Show earlier belts"; a won one waits behind it.
 *   4. ‹ Back from a checkpoint started in the corridor returns to the corridor, its row in view, and the hold LETS GO
 *      when the player moves on (PATH-R2): a key, a wheel, a mouse press, a finger drag.
 *   5a. `openLearningView("collection")` lands in Master the game with the shelf open (O3).
 *   6. A repaint keeps the reading position (the claim that lost its only test with the arrival scroll).
 * Ruling 2 (`neural_practice_opened`'s surface) is in path-visit-telemetry.spec.ts.
 * The record is the reader's `mid` seed, built from the SERVED curriculum: White done and won, Blue's six units proven and
 * its test not taken, Purple worn and its unit 1 ready for its checkpoint, 2 patches and 2 coins.
 * Mutants: listed with their results in docs/Changelog-Archive.md's entry for this PR (PATH-R1, PATH-R2).
 * THE LIST STATE (L1-R1b, v1.290.0; the reader of PR #434, its smaller 7): Master the game opens as a list, and `openMaster`
 *   pressed its button before every claim, so the list a player first sees was unwatched here. One case per door keeps it:
 *   View Collection from the map, the startable belt test and ‹ Back from a checkpoint, each "from the list". Back left the
 *   keyboard focus outside the page there (both sizes); it goes to the checkpoint's row now. Mutant L1-R1i (the focus not
 *   moved, `_paneBack`) → red at "‹ Back … from the list", at "premise: the focus is inside the page after Back".
 * THE HOLD'S LIFTERS (CLAUDE.md §6.5), `_paneBack`: wheel, touchstart, pointerdown, keydown, each on the page itself.
 *   - All four removed, then each alone, are run against the Back journey.
 *   - NON-KILL: `touchstart` removed alone. A finger drag in Chromium fires `pointerdown` too, which lifts the hold, so no
 *     journey here can tell it apart. By hand: on a touch browser that sends touch events without pointer events, a drag
 *     on Master the game after ‹ Back must let the next card scroll into view.
 * KNOWN LIMIT, NOT BUILT (PATH-R2, the re-read's finding 3): a press on the rewards shelf's summary made in the very instant
 *   the plan lands is lost. The press lands on the shelf the plan's repaint just replaced, whose toggle is ignored on
 *   purpose (`!shelf.isConnected`; carrying it over to the live shelf is how the count inverted). The shelf stays as it
 *   was, nothing is miscounted, and the player presses again.
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
  // cards and sheets fade in (the reward card, Settings): wait until the control is fully shown, then measure the press
  await expect.poll(() => page.evaluate((sel) => {
    let a = 1; for (let n = document.querySelector(sel) as HTMLElement | null; n; n = n.parentElement) a *= Number(getComputedStyle(n).opacity)
    return a
  }, selector), { message: `${what} is fully shown`, timeout: 5_000 }).toBeGreaterThan(0.99)
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
// `card`: press the button first (a card open), or leave the list as a player first sees it (L1-R1b, the reader's smaller 7:
// with the press before every claim, the list state went unwatched, and ‹ Back's focus was outside the page there)
async function openMaster(page: Page, touch: boolean, card = true) {
  if (!(await page.evaluate(() => !!(window as W).__neural.deckShown))) await press(page, ".ng-logo", "open the drawer", touch)
  await press(page, '[data-explore-stats] [data-b="due"]', "Master the game", touch)
  await expect(page.locator("[data-practice-page]"), "Master the game is open").toHaveCount(1)
  // L1 (v1.290.0): Master the game opens as a list with one button, and the shelf sits folded under "Belt lessons". This
  // journey was written when the page opened on its first card with the shelf drawn under it, so it presses both, the way
  // a player does: the button (the day's first card opens), then "Belt lessons" (the shelf unfolds below the list)
  await expect(page.locator("[data-master-start]"), "the button is ready").toBeEnabled({ timeout: 20_000 })
  if (card) {
    await press(page, "[data-master-start]", "the button", touch)
    await expect(page.locator("[data-master-dock]"), "a card is open").toBeVisible()
  }
  await press(page, "[data-master-belts]", "Belt lessons", touch)
  await expect(page.locator("[data-master-belts]")).toHaveAttribute("aria-expanded", "true")
}

for (const touch of [false, true]) {
  const tag = touch ? "touch 390x631" : "mouse 1440x900"
  test.describe(tag, () => {
    test.use(touch ? { hasTouch: true, isMobile: true, viewport: { width: 390, height: 631 } } : { viewport: { width: 1440, height: 900 } })

    // RULING 1: every door, the plan warm (Master the game opened and closed once), lands on an open shelf
    for (const door of ["the map", "the drawer's list", "Last rolls, open", "Last rolls, the drawer shut", "the map, Master the game left as its list"]) {
      test(`View Collection from ${door}, the plan warm, lands on an open shelf and counts one visit (${tag})`, async ({ page }) => {
        const { errors } = await bootMid(page)
        await openMaster(page, touch, !door.endsWith("as its list"))
        await press(page, ".ng-explorer-close", "close the drawer from Master the game (the plan is warm now)", touch)
        if (!door.startsWith("the map")) {
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
    for (const card of [true, false]) test(`a startable belt test is drawn without "Show earlier belts" and starts in two presses${card ? "" : ", from the list"} (${tag})`, async ({ page }) => {
      const { errors } = await bootMid(page)
      expect(await page.evaluate(() => { const a = (window as W).__neural; return { worn: a.wornBelt().id, blue: a._beltTestStartable("blue"), white: a._beltTestStartable("white") } }),
        "premise: Purple worn, Blue's test startable, White's won").toEqual({ worn: "purple", blue: true, white: false })
      await openMaster(page, touch, card)
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

    // RULING 4: ‹ Back from a checkpoint started in the corridor returns there, the row in view; and (PATH-R2, the re-read's
    // finding 1) the hold LETS GO: each way a player moves on lifts it, and the next card then comes into view as it would
    // have without the hold. The moves: a key at both sizes (it moves on by itself, ↓), a wheel and a plain mouse press at
    // 1440, a finger drag at 390x631; after the wheel, the press and the drag the next card is asked for by the app's own
    // seam (`sessionNav`), which lifts nothing, so only the move can have let go.
    const moves = touch ? ["a key", "a finger drag"] : ["a key", "a wheel", "a mouse press"]
    // L1-R1b (the reader's smaller 7, both sizes): from the list as a player first sees it, too, where the focus was left
    // outside the page after ‹ Back; it goes to the checkpoint's row now, so the keys move on from there
    for (const card of [true, false]) test(`‹ Back from a checkpoint started in the corridor returns to it, its row in view, until the player moves on${card ? "" : ", from the list"} (${tag})`, async ({ page }) => {
      const { errors } = await bootMid(page)
      await openMaster(page, touch, card)
      const cp = `[data-practice-page] [data-checkpoint="${PURPLE_U1}"]`
      await expect(page.locator(cp), "premise: Purple's unit 1 checkpoint is drawn").toHaveCount(1)
      const nextCardInView = () => page.evaluate(() => {
        const el = (window as W).__neural._openMini && (window as W).__neural._openMini.el
        if (!el || !el.isConnected) return false
        const r = el.getBoundingClientRect()
        return r.height > 0 && r.top >= 0 && r.top < innerHeight
      })
      for (const move of moves) {
        await press(page, cp, "the unit's checkpoint", touch)
        await expect.poll(() => page.evaluate(() => !!(window as W).__neural._checkpoint), { message: "premise: the checkpoint is on" }).toBe(true)
        await press(page, ".ngBack[data-pane-back]", "‹ Back", touch)
        await expect.poll(() => practice(page), { message: "back in Master the game" }).toBe(true)
        await expect(page.locator(".ng-drawer-brand")).toHaveText("\u2039 Master the game")
        await expect.poll(() => inView(page, cp), { message: "the checkpoint's row is in view" }).toBe(true)
        expect(await page.evaluate(() => (window as W).__neural._checkpoint), "the quiz was left").toBeNull()
        expect(await inView(page, "[data-practice-page] [data-session-row]"), "premise: the day's cards are out of view, up the page").toBe(false)
        const list = await page.evaluate(() => { const r = (window as W).__neural.drillListRef.current.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height } })
        if (move === "a key") {
          expect(await page.evaluate(() => (window as W).__neural.drillListRef.current.contains(document.activeElement)), "premise: the focus is inside the page after Back").toBe(true)
          // in the list: on what the player came from, the checkpoint's row (L1-R1b)
          if (!card) expect(await page.evaluate((sel) => document.activeElement === document.querySelector(sel), cp), "the focus is on the checkpoint's row").toBe(true)
          // toward a card that exists: ↓, or ↑ from the session's last card (a key moves the queue by itself)
          const atEnd = await page.evaluate(() => { const s = (window as W).__neural._session; return (s.idx || 0) + 1 >= s.keys.length })
          await page.keyboard.press(atEnd ? "ArrowUp" : "ArrowDown")
        } else {
          if (move === "a wheel") { await page.mouse.move(list.x + list.w / 2, list.y + list.h / 2); await page.mouse.wheel(0, -120) }
          else if (move === "a mouse press") await page.mouse.click(list.x + 6, list.y + list.h / 2)   // the page's own padding
          else {
            const cdp = await page.context().newCDPSession(page), x = list.x + list.w / 2, y = list.y + list.h / 2
            await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] })
            for (let i = 1; i <= 5; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y + i * 16 }] })
            await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
          }
          // the next card, by the app's own seam (it lifts nothing): toward a card that exists, or the open one if it is the
          // only one; both scroll through `_scrollFocusedDeck`, which the hold blocks
          await page.evaluate(() => {
            const a = (window as W).__neural, s = a._session
            if (!a.sessionNav((s.idx || 0) + 1 < s.keys.length ? 1 : -1)) a._scrollFocusedDeck()
          })
        }
        await expect.poll(nextCardInView, { message: `after ${move}, the next card comes into view` }).toBe(true)
      }
      expect(errors, "no page error").toEqual([])
    })

    // RULING 6: a repaint keeps the reading position
    test(`a corridor repaint keeps the reading position (${tag})`, async ({ page }) => {
      const { errors } = await bootMid(page)
      await openMaster(page, touch)
      // the plan lands first and Master the game opens its first card (its own scroll, `_scrollFocusedDeck`); the reading
      // position is set after that, without a wheel or a touch the app could read, so only a repaint could move it
      await expect.poll(() => page.evaluate(() => !!(window as W).__neural._session?.plan), { message: "premise: the plan has landed", timeout: 20_000 }).toBe(true)
      await expect(page.locator("[data-practice-page] [data-mini-deck]").first(), "premise: the first card is open").toBeVisible({ timeout: 20_000 })
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 300)))))
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
