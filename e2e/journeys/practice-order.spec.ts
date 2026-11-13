import { expect, test, type Page } from "@playwright/test"
import { resolve } from "node:path"
import { journey } from "../dsl"

/** WHAT IS WORTH MOST (v1.274.0, the owner, 13 Nov 2026, U171 a): "what comes up most in rolls and what you are closest to
 * forgetting, position by position … at most 6 per position; every answer counts 1 toward 20; at least 4 new things a day;
 * the 'N due' count leaves the drawer, today's count out of 20 stays."
 *
 * The law and its parity with the simulation are tests/practice_queue.test.mjs. This journey is the BUILT page: one player
 * chosen from the served wire by rule (tests/_practice_order_fixture.mjs: owed cards due today in the 4 position decks the
 * game weighs most, owed cards a month overdue in the 4 it weighs least, so oldest first and worth disagree), pressed the
 * way a player presses (a touch tap at 390x631, the mouse at 1440x900, at measured points):
 *   · the drawer's Practice row carries today's count against the goal and no due count, on the row or in its tooltip;
 *   · Practice opens on the planner's first position (never on the oldest debt), its heading names that position, and the
 *     session is exactly the plan's queue (no oldest-first debt left in front of it), in visit order, at most 6 cards a
 *     position, at least 4 new;
 *   · paging the queue and "Keep practising" without answering store NOTHING: every localStorage key and value is
 *     byte-identical (the pattern of rating-reader.spec.ts);
 *   · a record with no answer in it is never read as a worth session: today's order serves it, and says so once.
 * MUTANTS (v1.274.0), each built into the bundle (`npm run dev:neural:app`) and run against this file under the lock; the
 * table is in docs/Changelog-Archive.md (v1.274.0):
 *   P1 the cold oldest-first queue kept in front of the worth plan (`_practiceAppend`)   → "the session is the plan's queue"
 *   P2 the "N due" pill back on the row                                                  → "the row: today's count, no due"
 *   P3 oldest first restored in the law                                                  → "Practice opens on the planner's first position"
 *   F1 the plan's re-render forgetting the fold the player opened (FOLD1)               → "FOLD1: the fold is still open after the plan lands"
 * NOT COVERED here: the order's arithmetic (the unit suite and its 15 mutants), no-gi on a page (the unit reads both
 * rulesets; a ruleset flip writes a setting, so it cannot share the byte-identity claim), and answering (grading writes the
 * record by design; the planner's completion rule is the unit suite's).
 */

type W = any
const SERVED = resolve(__dirname, "../../source/public/static/neural")

async function press(page: Page, selector: string, what: string, touch: boolean) {
  await page.locator(selector).first().scrollIntoViewIfNeeded()
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

async function boot(page: Page, day: number, initialState?: Record<string, unknown>) {
  await page.addInitScript((d) => { (window as W).__NG_EPOCH_DAY__ = d }, day)
  const j = journey(page)
  await j.boot("/", initialState ? { initialState } : {})
  await expect.poll(() => page.evaluate(() => {
    const a = (window as W).__neural
    return !!(a && a.nodes && a.nodes.length && a.flashcards && a.flashcards.decks && Object.keys(a.flashcards.decks).length && a.curriculum)
  }), { timeout: 60_000, message: "graph, deck manifest and curriculum in" }).toBe(true)
  return j
}
/** every localStorage key and value, once the boot has stopped writing (polled until it holds still for 2 s) */
const storage = (page: Page) => page.evaluate(() => JSON.stringify(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)])))
async function settled(page: Page) {
  let before = await storage(page)
  await expect.poll(async () => {
    await page.waitForTimeout(2_000)
    const now = await storage(page), still = now === before
    before = now
    return still
  }, { timeout: 30_000, intervals: [0], message: "storage holds still" }).toBe(true)
  return before
}
const dot = (seat: string) => seat.replace("|", " · ")

for (const touch of [true, false]) {
  test.describe(touch ? "touch 390x631" : "mouse 1440x900", () => {
    test.use(touch ? { hasTouch: true, isMobile: true, viewport: { width: 390, height: 631 } } : { viewport: { width: 1440, height: 900 } })

    test(`the planner's first position comes first, the session is the plan's queue, and nothing is stored (${touch ? "touch" : "mouse"})`, async ({ page }) => {
      const { orderFixture } = await import("../../tests/_practice_order_fixture.mjs")
      const fx = orderFixture(SERVED)
      await boot(page, fx.day, fx.blob)
      await press(page, ".ng-logo", "open the drawer", touch)
      // the row: today's count, no due
      const row = '[data-explore-stats] [data-b="due"]'
      await expect(page.locator(row), "the Practice row").toBeVisible()
      await expect(page.locator(row + " .ng-dr-pill"), "no due pill on the row").toHaveCount(0)
      await expect(page.locator(row + " .ng-dr-tail"), "today's count against the goal").toHaveText("0/20")
      const title = await page.locator(row).getAttribute("title")
      expect(title, "the tooltip names no due count").not.toMatch(/due/)
      expect(title).toMatch(/^0 answered today · /)
      const before = await settled(page)
      expect(before, "the seeded record is in storage").toContain(fx.heavy[0])

      await press(page, row, "the Practice row", touch)
      await expect.poll(() => page.evaluate(() => (window as W).__neural._session?.plan?.order || null), { timeout: 30_000, message: "the worth plan lands" }).toBe("worth")
      const s = await page.evaluate(() => {
        const a = (window as W).__neural, s = a._session, p = s.plan, fresh = a.planSummary()
        return { keys: s.keys.slice(), queue: p.queue.slice(), again: fresh.queue.slice(), visits: p.visits.map((v: W) => ({ seat: v.seat, keys: v.keys.slice() })),
          rows: p.due.concat(p.fresh).map((r: W) => ({ key: r.key, seat: r.seat, visit: r.visit, count: r.count, owed: (r.owed || []).length })),
          dom: [...document.querySelectorAll("[data-session] [data-session-row]")].map((r) => r.getAttribute("data-session-row")), newCards: p.newCards }
      })
      // the session is the plan's queue
      expect(s.keys, "the session holds exactly the plan's rows, in its order: no oldest-first debt in front").toEqual(s.queue)
      expect(s.again, "and the plan is the planner's own, asked again").toEqual(s.queue)
      expect(s.dom, "the page mounts the rows in that order").toEqual(s.keys)
      expect(new Set(s.keys).size, "one row per deck").toBe(s.keys.length)
      for (const v of s.visits) {
        const n = s.rows.filter((r: W) => v.keys.includes(r.key)).reduce((m: number, r: W) => m + r.count, 0)
        expect(n, `${v.seat}: at most 6 cards at a position`).toBeLessThanOrEqual(6)
      }
      expect(s.newCards, "at least 4 new").toBeGreaterThanOrEqual(4)
      // Practice opens on the planner's first position, not on the oldest debt: the light decks' cards are a month overdue
      // (oldest first would open there), and worth asks them after positions the game weighs more (the arithmetic is the
      // unit suite's; this page must only play it)
      expect(s.keys[0], "the open card is the first position's").toBe(s.visits[0].keys[0])
      expect(s.rows.filter((r: W) => fx.light.includes(r.key) && r.visit === 0), "a month overdue, but light: not first").toEqual([])
      expect(s.rows.filter((r: W) => fx.heavy.includes(r.key) && r.owed === 3).length, "the misses in the decks weighed most are asked").toBeGreaterThan(0)
      await expect(page.locator("[data-practice-section]"), "the heading names the open card's position").toHaveText(`${dot(s.visits[0].seat)} · position 1 of ${s.visits.length}`)
      // the queue, named position by position
      await press(page, "[data-practice-details] > summary", "Practice details & session queue", touch)
      await expect(page.locator("[data-practice-queue] [data-practice-visit]"), "a label per position").toHaveText(s.visits.map((v: W, i: number) => `${i + 1} · ${v.seat ? dot(v.seat) : "Other cards"}`))
      // paging the queue moves the heading with the open card, and stores nothing
      for (let i = 1; i < Math.min(4, s.keys.length); i++) {
        await press(page, ".ng-practice-nav > button:nth-child(2)", "Next technique", touch)
        await expect.poll(() => page.evaluate(() => (window as W).__neural._session.idx), { message: "the queue moves on" }).toBe(i)
        const r = s.rows.find((x: W) => x.key === s.keys[i])
        await expect(page.locator("[data-practice-section]")).toHaveText(`${r.seat ? dot(r.seat) : "Other cards"} · position ${r.visit + 1} of ${s.visits.length}`)
      }
      // "Keep practising" still adds today's ranked new techniques after the day's positions
      const more = await page.evaluate(() => Math.min(10, (window as W).__neural._session.plan.more.length))
      expect(more, "there is more to add").toBeGreaterThan(0)
      await press(page, "[data-plan-more]", "Keep practising · more new cards", touch)
      await expect.poll(() => page.evaluate(() => (window as W).__neural._session.keys.length)).toBe(s.keys.length + more)
      await page.waitForTimeout(2_500)
      expect(await storage(page), "every localStorage key and value is byte-identical after opening, paging and Keep practising").toBe(before)
    })

    // FOLD1 (v1.274.0, the orchestrator's check on the preview): on a slow connection a player can open "Practice details &
    // session queue" while the eager queue shows; the plan landing re-rendered the queue and the fold snapped shut under
    // them. The planner's file is held here as srs-due.spec.ts holds it; the fold is opened by a real tap or click; released,
    // the plan lands, and the fold is still open and shows the plan's rows. Opening the fold is reading, not answering, so
    // the queue still counts as untouched and the plan replaces it (the player sees the better order, in the fold they opened).
    test(`a fold opened before the plan lands stays open, and shows the plan's rows (FOLD1, ${touch ? "touch" : "mouse"})`, async ({ page }) => {
      const { orderFixture } = await import("../../tests/_practice_order_fixture.mjs")
      const fx = orderFixture(SERVED)
      await boot(page, fx.day, fx.blob)
      let release!: () => void
      const gate = new Promise<void>((resolve) => { release = resolve })
      await page.route("**/app/gameplan.js*", async (route) => { await gate; await route.continue() })
      try {
        await press(page, ".ng-logo", "open the drawer", touch)
        await press(page, '[data-explore-stats] [data-b="due"]', "the Practice row", touch)
        await expect(page.locator("[data-session-row]").first(), "the eager queue shows").toBeVisible()
        expect(await page.evaluate(() => !!(window as W).__neural._session.plan), "premise: the plan has not landed").toBe(false)
        await press(page, "[data-practice-details] > summary", "Practice details & session queue", touch)
        await expect(page.locator("[data-practice-details]"), "the fold opens").toHaveAttribute("open", "")
        release()
        await expect.poll(() => page.evaluate(() => (window as W).__neural._session?.plan?.order || null), { timeout: 30_000, message: "the plan lands" }).toBe("worth")
        await expect(page.locator("[data-practice-details]"), "FOLD1: the fold is still open after the plan lands").toHaveAttribute("open", "")
        const queue = await page.evaluate(() => (window as W).__neural._session.plan.queue.slice())
        await expect(page.locator("[data-practice-queue] button"), "and it shows the plan's rows").toHaveText(queue.map((k: string) => dot(k)))
      } finally { release() }
    })

    test(`a record with no answer is today's order, and says so once (${touch ? "touch" : "mouse"})`, async ({ page }) => {
      await boot(page, 20770)
      await press(page, ".ng-logo", "open the drawer", touch)
      await press(page, '[data-explore-stats] [data-b="due"]', "the Practice row", touch)
      await expect.poll(() => page.evaluate(() => (window as W).__neural._session?.plan?.orderStatus || null), { timeout: 30_000, message: "the plan lands" }).toBe("empty")
      const r = await page.evaluate(() => {
        const a = (window as W).__neural
        return { order: a._session.plan.order, beats: a.beats.filter((b: W) => b.beat === "practice_order_fallback").map((b: W) => b.reason),
          rows: [...document.querySelectorAll("[data-session] [data-session-row]")].map((x) => x.getAttribute("data-practice-kind")) }
      })
      expect(r.order).toBe("oldest")
      expect(r.beats, "the fallback is named, once").toEqual(["empty"])
      expect(r.rows.length, "and it still serves a session").toBeGreaterThan(0)
      expect(r.rows.every((k: string) => k === "new"), "of new cards").toBe(true)
    })
  })
}
