import { expect, test, type Page } from "@playwright/test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { journey } from "../dsl"
import { beforeNeuralAuthNavigate, signInNeuralAuthSDK, waitNeuralAuthOwner } from "../fixtures/neural-auth-sdk"

/** THE SAVE LINES (SAVE1, v1.301.1; the owner's U215 a, 24 Nov: "Go"). Four quiet lines, each at the moment a guest has just
 * made something he would lose, each naming it, never a modal: `_saveLineFor` and its header in app.src.jsx.
 *
 * What a player SEES and what a press does, on the served build, by mouse at 1440x900 and by touch at 390x631:
 *   belt   the first time his number shows (his first day), under the belt row: "Your belt lives in this browser only."
 *   list   his first list, once it holds a technique, on its own row: "Kept in this browser only."
 *   done   a Master the game session's Done card: "Today's N answers are kept in this browser only."
 *   badge  a later day, over the badge: "In this browser only: N cards, N lists and your … belt." (its Save is the badge's)
 * and the rules: a Save opens the sign-in; one line on screen at a time (a list made takes the slot from the belt's); each
 * at most once a day (closing and reopening the drawer, and a reload, the same day show none); a ✕ hides that line for a
 * week (day 6 none, day 7 back); never for a signed-in player, and gone for good once anyone signed in on the browser. The
 * mark is written when a showing ends, so an open drawer writes nothing (belt-row.spec.ts compares storage across that).
 *
 * MUTANTS (one per line, each turned a named test here red against a green baseline; receipts in the PR):
 *   M1 belt   `_paintBeltRow` no longer calls `_placeBeltLine()`        → "belt …" red (the number lands after the open)
 *   M2 list   the row draws the line on an EMPTY first list            → "list …" red ("an empty list is kept nowhere")
 *   M3 done   `_sessionDoneCard` no longer asks for the line           → "done …" red
 *   M4 badge  a ✕ hides the line for 1 day instead of 7               → "badge …" red (day 6 shows it)
 * NOT PINNED: the line's look (the screens in the PR are the evidence); `pagehide`'s write of the mark (the drawer's close
 * writes the same mark, and that is what is asserted).
 * NOT SERVED HERE: the cloud (the auth fixture's account starts empty); dossiers (the harness's `{}`: no film strip).
 */

type W = any
const SERVED = resolve(__dirname, "../../source/public/static/neural")
test.use({ hasTouch: true })
const VIEWS = [{ name: "1440 mouse", w: 1440, h: 900, touch: false }, { name: "390x631 touch", w: 390, h: 631, touch: true }]

/** the rating fixture's record (tests/_rating_fixture.mjs): `first` makes every answer today's (his first day) */
async function record(first: boolean) {
  const { ratingFixture } = await import("../../tests/_rating_fixture.mjs")
  const fx = ratingFixture(SERVED)
  const blob = JSON.parse(JSON.stringify(fx.blob))
  delete blob.lists
  if (first) {
    delete blob.days; delete blob.rollDays
    for (const cards of Object.values(blob.srs || {}) as W[]) for (const c of Object.values(cards) as W[]) if (Array.isArray(c)) c[2] = fx.day
    for (const seat of Object.values(blob.moves || {}) as W[]) for (const r of Object.values(seat) as W[]) if (Array.isArray(r)) r[2] = fx.day
  }
  return { blob, day: fx.day as number }
}
async function bootGuest(page: Page, fx: { blob: W; day: number }, day = fx.day, opts: W = {}) {
  await page.addInitScript((d) => { (window as W).__NG_EPOCH_DAY__ = d }, day)
  const j = journey(page)
  await j.boot("/", Object.assign({ initialState: fx.blob }, opts))
  await expect.poll(() => page.evaluate(() => {
    const a = (window as W).__neural
    return !!(a && a.nodes && a.nodes.length && a.flashcards && a.flashcards.decks && a.curriculum && a.belts && a._progressLoaded)
  }), { timeout: 60_000, message: "graph, decks, curriculum and progress in" }).toBe(true)
  return j
}
const setDay = (page: Page, d: number) => page.evaluate((x) => { (window as W).__NG_EPOCH_DAY__ = x }, d)
const marks = (page: Page) => page.evaluate(() => localStorage.getItem("bjj_save_lines"))
/** every save line in the page: its kind, its text, whether it is on screen */
const lines = (page: Page) => page.evaluate(() => [...document.querySelectorAll("[data-save-line]")].map((e) => ({
  kind: e.getAttribute("data-save-line"), text: ((e.querySelector(".ng-saveln-t") as HTMLElement)?.innerText || "").trim(), shown: e.getClientRects().length > 0 })))

/** a press the way a player makes it: the measured centre, nothing on top (the touch half of `j.clickByMouse`) */
async function press(page: Page, sel: string, what: string, touch: boolean) {
  if (!touch) return journey(page).clickByMouse(sel, what)
  const at = await page.evaluate((s) => {
    const el = [...document.querySelectorAll(s)].find((e) => e.getClientRects().length) as HTMLElement | undefined
    if (!el) return null
    el.scrollIntoView({ block: "nearest" })
    const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2
    const top = document.elementFromPoint(x, y)
    return top && (top === el || el.contains(top)) ? { x, y } : null
  }, sel)
  expect(at, what + ": its centre is on screen and nothing covers it").not.toBeNull()
  await page.touchscreen.tap(at!.x, at!.y)
}
async function openDrawer(page: Page, touch: boolean) {
  await press(page, ".ng-logo", "the drawer icon", touch)
  await expect(page.locator(".ng-drawer-head")).toBeVisible()
}
async function closeDrawer(page: Page, touch: boolean) {
  await press(page, ".ng-explorer-close", "the drawer's close", touch)
  await expect(page.locator(".ng-drawer-head")).toBeHidden()
}
/** a line's two controls are 44 px targets: the control itself answers 21 px from its centre, each way */
async function reach(page: Page, sel: string) {
  return page.evaluate((s) => {
    const el = document.querySelector(s) as HTMLElement
    el.scrollIntoView({ block: "center" })   // on a 631 px phone the line can sit under the fold: measured where he scrolls to it
    const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2
    const is = (x: number, y: number) => { const t = document.elementFromPoint(x, y); return !!t && (t === el || el.contains(t)) }
    return [is(cx, cy - 21), is(cx, cy + 21), is(cx - 21, cy), is(cx + 21, cy)]
  }, sel)
}
/** the sign-in a Save opens, closed again */
async function signInOpened(page: Page) {
  await expect(page.locator("body")).toContainText("Create your account")
  await page.evaluate(() => (window as W).__neural.closeModal())
}

for (const v of VIEWS) test(`belt (${v.name}): his first number brings the line under the belt row, once a day; Save opens the sign-in`, async ({ page }) => {
  await page.setViewportSize({ width: v.w, height: v.h })
  const fx = await record(true)
  await bootGuest(page, fx)
  // hold the live check until the drawer is open, so the number lands in front of him (the moment), as belt-row.spec.ts does
  let release!: () => void
  const gate = new Promise<void>((r) => { release = r })
  await page.route(/\/flashcards\/live-\d+\.json(\?.*)?$/, async (r) => {
    await gate
    const name = new URL(r.request().url()).pathname.split("/").pop()!
    await r.fulfill({ status: 200, contentType: "application/json", body: readFileSync(resolve(SERVED, "flashcards", name), "utf8") })
  })
  await openDrawer(page, v.touch)
  await expect(page.locator("[data-belt-row]").first()).toHaveAttribute("data-belt-state", "wait")
  expect(await lines(page), "no number yet: no line").toEqual([])
  release()
  await expect(page.locator("[data-belt-row]").first()).toHaveAttribute("data-belt-state", "ok", { timeout: 30_000 })
  await expect(page.locator('[data-save-line="belt"]')).toBeVisible()
  expect(await lines(page), "the one line, his belt's").toEqual([{ kind: "belt", text: "Your belt lives in this browser only.", shown: true }])
  expect(await page.locator('[data-save-line="belt"]').evaluate((el) => !!el.previousElementSibling?.matches("[data-belt-row]")), "it stands under the belt row").toBe(true)
  const inside = await page.locator('[data-save-line="belt"]').evaluate((el) => { const r = el.getBoundingClientRect(), d = (el.closest(".ng-drill") as HTMLElement).getBoundingClientRect(); return r.left >= d.left && r.right <= d.right + 0.5 })
  expect(inside, "inside the drawer").toBe(true)
  for (const c of ['[data-save-line="belt"] [data-save-line-save]', '[data-save-line="belt"] [data-save-line-x]']) expect(await reach(page, c), c + ": a 44 px target").toEqual([true, true, true, true])
  expect(await marks(page), "an open drawer writes nothing").toBeNull()
  await press(page, '[data-save-line="belt"] [data-save-line-save]', "the belt line's Save", v.touch)
  await signInOpened(page)
  expect(await lines(page), "the line it answered is gone").toEqual([])
  // ONCE A DAY: closed and opened again, then a reload, the same day: none
  await closeDrawer(page, v.touch)
  expect(JSON.parse((await marks(page))!), "the day it showed is kept").toEqual({ belt: [fx.day, 0] })
  await openDrawer(page, v.touch)
  await expect(page.locator("[data-belt-row]").first()).toHaveAttribute("data-belt-state", "ok", { timeout: 30_000 })
  await page.waitForTimeout(400)
  expect(await lines(page), "the same day, reopened: none").toEqual([])
  await page.unroute(/\/flashcards\/live-\d+\.json(\?.*)?$/)
  await journey(page).boot("/", { preserveStorage: true })
  await expect.poll(() => page.evaluate(() => !!(window as W).__neural?._progressLoaded)).toBe(true)
  await openDrawer(page, v.touch)
  await expect(page.locator("[data-belt-row]").first()).toHaveAttribute("data-belt-state", "ok", { timeout: 30_000 })
  await page.waitForTimeout(400)
  expect(await lines(page), "the same day, after a reload: none").toEqual([])
  // THE NEXT DAY is a later day: the badge says what is kept here, and the belt row carries nothing
  await closeDrawer(page, v.touch)
  await setDay(page, fx.day + 1)
  await openDrawer(page, v.touch)
  await expect(page.locator("[data-belt-row]").first()).toHaveAttribute("data-belt-state", "ok", { timeout: 30_000 })
  await page.waitForTimeout(400)
  expect((await lines(page)).map((l) => l.kind), "a later day: the badge's line, not the belt's").toEqual(["badge"])
})

for (const v of VIEWS) test(`list (${v.name}): his first list says where it is kept once it holds a technique, and takes the slot from the belt's`, async ({ page }) => {
  await page.setViewportSize({ width: v.w, height: v.h })
  const fx = await record(true)
  await bootGuest(page, fx)
  await openDrawer(page, v.touch)
  await expect(page.locator("[data-belt-row]").first()).toHaveAttribute("data-belt-state", "ok", { timeout: 30_000 })
  await expect.poll(() => lines(page).then((l) => l.map((x) => x.kind)), { message: "premise: his first day's belt line is on screen" }).toEqual(["belt"])
  await press(page, "[data-lists-new]", "New list", v.touch)
  await expect(page.locator("[data-list-rename]")).toBeFocused()
  await page.keyboard.press("Enter")
  await expect(page.locator("[data-list-row]")).toHaveCount(1)
  expect((await lines(page)).map((l) => l.kind), "an empty list is kept nowhere: no list line yet").toEqual(["belt"])
  // his first technique goes in (the star's own seam, `addToList`)
  await page.evaluate(() => {
    const a = (window as W).__neural, id = a.listsArray()[0], n = a.nodes.find((x: W) => /^Transitions\//.test(x.id)) || a.nodes[40]
    a.addToList(n.id, id); a._expandList(id); a._refreshListSurfaces()
  })
  await expect(page.locator(`[data-list-row] + [data-save-line="list"]`), "under the first list's own row").toBeVisible()
  expect(await lines(page), "one line at a time: the list's took the belt's place").toEqual([{ kind: "list", text: "Kept in this browser only.", shown: true }])
  for (const c of ['[data-save-line="list"] [data-save-line-save]', '[data-save-line="list"] [data-save-line-x]']) expect(await reach(page, c), c + ": a 44 px target").toEqual([true, true, true, true])
  // a second list is not his first: no line of its own
  await page.evaluate(() => { const a = (window as W).__neural, id = a.newList("Second"), n = a.nodes.find((x: W) => /^Positions\//.test(x.id)) || a.nodes[41]; a.addToList(n.id, id); a._refreshListSurfaces() })
  await expect(page.locator("[data-list-row]")).toHaveCount(2)
  expect((await lines(page)).map((l) => l.kind), "still the one line, on the first list").toEqual(["list"])
  await press(page, '[data-save-line="list"] [data-save-line-save]', "the list line's Save", v.touch)
  await signInOpened(page)
  expect(await lines(page), "the line it answered is gone").toEqual([])
})

test("done (1440 mouse): a Master the game session's Done card says what he just remembered is kept here", async ({ page }) => {
  const j = journey(page, { answerMode: "classic" })
  await j.boot("/")
  await page.waitForFunction(() => !!(window as W).__neural.curriculum && !!(window as W).__neural._progressLoaded)
  // practice-page.spec.ts's P1-C recipe: one card left of today's 20, so the session is that card
  await page.evaluate(async () => {
    const a = (window as W).__neural
    await a._ensureGameplanRuntime()
    a.setPaused(true)
    a.srs = {}; a.prep = {}; a.stage = {}; a.rec = {}; a.units = {}
    a.belts = { held: { id: "white", t: 1 }, gf: 1, won: {} }
    a._gameplanProvider = null; a._miniGraded = new Set(); a.settings.dailyGoal = 20
    const day = a._epochDay()
    const keys = a.curriculum.belts.find((b: W) => b.id === "black").units.flatMap((u: W) => u.lessons).filter((l: W) => a._lessonLive(l)).map((l: W) => l.deckKey)
    const picked = [...new Set(keys)].slice(0, 1) as string[]
    await a.hydrateDecks(picked)
    for (const key of picked) { const c = a._cardsOf(a.flashcards.decks[key])[0]; a.srs[key] = { [a.qhash(c.q)]: [day - 1, 3, day - 4] } }
    a.srs["Previous practice|Top"] = Object.fromEntries(Array.from({ length: 19 }, (_, i) => ["prior" + i, [day + 1, 1, day]]))
    a.setViewMode("explore")
  })
  await j.knowsPlanMoves()
  await openDrawer(page, false)
  await j.clickByMouse('[data-explore-stats] [data-b="due"]', "Master the game")
  await expect(page.locator("[data-practice-page]")).toHaveCount(1)
  await expect.poll(() => page.locator("[data-master-start]").isEnabled(), { timeout: 10_000 }).toBe(true)
  await page.locator("[data-master-start]").scrollIntoViewIfNeeded()
  await j.clickByMouse("[data-master-start]", "Master the game's button")
  const held = await page.evaluate(() => (window as W).__neural._session.plan.total)
  for (let i = 0; i < held; i++) {
    await expect(page.locator("[data-master-bar] [data-mini-reveal]:visible")).toHaveCount(1, { timeout: 5_000 })
    await j.clickByMouse("[data-master-bar] [data-mini-reveal]", "reveal")
    await j.clickByMouse("[data-master-bar] [data-mini-got]", "grade")
    if (i < held - 1) await page.waitForTimeout(700)
  }
  await expect(page.locator("[data-session-complete]")).toHaveCount(1)
  await expect(page.locator('[data-session-complete] [data-save-line="done"]')).toBeVisible()
  const done = await lines(page)
  expect(done.map((l) => [l.kind, l.shown]), "one line, in the Done card").toEqual([["done", true]])
  const today = Number((await page.locator("[data-badge-today]").innerText()).match(/^Today: (\d+) of/)![1])
  expect(today, "premise: the day's answers").toBeGreaterThanOrEqual(20)
  expect(done[0].text, "it names today's answers as the badge counts them").toBe(`Today's ${today} answers are kept in this browser only.`)
  await page.locator("[data-session-complete]").evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)))
  await page.locator('[data-save-line="done"]').scrollIntoViewIfNeeded()
  await j.clickByMouse('[data-save-line="done"] [data-save-line-save]', "the Done line's Save")
  await signInOpened(page)
  expect(await lines(page), "the line it answered is gone").toEqual([])
})

for (const v of VIEWS) test(`badge (${v.name}): a later day names what is kept here; its Save is the badge's; a ✕ hides it for a week`, async ({ page }) => {
  await page.setViewportSize({ width: v.w, height: v.h })
  const fx = await record(false)
  const d = fx.day + 1
  await bootGuest(page, fx, d)
  // a list he made on an earlier day (a list made NOW is his first list's own moment, which would take the slot: "list …")
  await page.evaluate(() => { const a = (window as W).__neural, n = a.nodes.find((x: W) => /^Transitions\//.test(x.id)); a._listsMap().l1 = { name: "Tuesday class", items: [a.siteIdOf(n.id)], t: 1 } })
  await openDrawer(page, v.touch)
  await expect(page.locator('[data-save-line="badge"]')).toBeVisible()
  const cards = await page.evaluate(() => (window as W).__neural._saveHeld().cards)
  expect(cards, "premise: he holds answered cards").toBeGreaterThan(0)
  expect(await lines(page), "the one line, the badge's").toEqual([{ kind: "badge", text: `In this browser only: ${cards} cards and 1 list.`, shown: true }])
  expect(await page.locator('[data-save-line="badge"]').evaluate((el) => el.nextElementSibling === document.querySelector(".ngAcctChip")), "it stands over the badge").toBe(true)
  await expect(page.locator('[data-save-line="badge"] [data-save-line-save]'), "no Save of its own").toHaveCount(0)
  expect(await reach(page, "[data-badge-save]"), "the badge's Save is a 44 px target").toEqual([true, true, true, true])
  expect(await reach(page, '[data-save-line="badge"] [data-save-line-x]'), "its ✕ is a 44 px target").toEqual([true, true, true, true])
  await page.waitForTimeout(600)
  expect((await lines(page)).map((l) => l.kind), "the belt's number shows, and its line does not: a later day is the badge's").toEqual(["badge"])
  // THE ✕: gone, and written at once
  await press(page, '[data-save-line="badge"] [data-save-line-x]', "the badge line's ✕", v.touch)
  expect(await lines(page), "gone").toEqual([])
  expect(JSON.parse((await marks(page))!), "hidden the day it was shown").toEqual({ badge: [d, d] })
  // A WEEK: day 6 none, day 7 back
  await closeDrawer(page, v.touch)
  await setDay(page, d + 6)
  await openDrawer(page, v.touch)
  await page.waitForTimeout(600)
  expect(await lines(page), "six days on: none").toEqual([])
  await closeDrawer(page, v.touch)
  await setDay(page, d + 7)
  await openDrawer(page, v.touch)
  await expect(page.locator('[data-save-line="badge"]')).toBeVisible()
  // ITS SAVE IS THE BADGE'S: the sign-in opens and the line goes
  await press(page, "[data-badge-save]", "the badge's Save", v.touch)
  await signInOpened(page)
  expect(await lines(page), "the line it answered is gone").toEqual([])
})

test("never for a signed-in player, and gone for good once he signed in on this browser", async ({ page }) => {
  const fx = await record(false)
  await page.addInitScript((d) => { (window as W).__NG_EPOCH_DAY__ = d }, fx.day + 1)
  const j = journey(page)
  await j.boot("/", { beforeNavigate: beforeNeuralAuthNavigate, initialState: fx.blob })
  await waitNeuralAuthOwner(page, null)
  // the control: the same guest, the same day, sees the badge's line
  await openDrawer(page, false)
  await expect(page.locator('[data-save-line="badge"]'), "control: a guest on a later day sees it").toBeVisible()
  await closeDrawer(page, false)
  await signInNeuralAuthSDK(page, "save-lines-user", { email: "player@example.com", name: "Player" })
  expect(JSON.parse((await marks(page))!).in, "a sign-in is written at once").toBe(1)
  // signed in, on a day no line has shown: nothing, wherever a line would stand
  await setDay(page, fx.day + 30)
  await openDrawer(page, false)
  await page.waitForTimeout(600)
  expect(await lines(page), "signed in: none").toEqual([])
  const made = await page.evaluate(() => { const a = (window as W).__neural, id = a.newList("Mine"), n = a.nodes.find((x: W) => /^Transitions\//.test(x.id)); a.addToList(n.id, id); a._refreshListSurfaces(); return a._saveListId || null })
  expect(made, "his first list is no moment for an account").toBeNull()
  expect(await lines(page), "nor a list's").toEqual([])
  await closeDrawer(page, false)
  // signed out again, a guest on this browser: still none (gone for good)
  await page.evaluate(() => (window as W).__bjjAuth.signOut())
  await waitNeuralAuthOwner(page, null)
  await setDay(page, fx.day + 60)
  await openDrawer(page, false)
  await page.waitForTimeout(600)
  expect(await page.evaluate(() => { const a = (window as W).__neural; return [!!a.user, a._saveHeld().later, a._saveHeld().cards > 0] }), "premise: a guest again, on a later day, holding cards (the line's every other condition)").toEqual([false, true, true])
  expect(await lines(page), "a guest again on this browser: none").toEqual([])
})
