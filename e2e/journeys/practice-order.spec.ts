import { expect, test, type Page } from "@playwright/test"
import { resolve } from "node:path"
import { journey } from "../dsl"

/** WHAT IS WORTH MOST (v1.278.0, the owner, 13 Nov 2026, U171 a): "what comes up most in rolls and what you are closest to
 * forgetting, position by position … at most 6 per position; every answer counts 1 toward 20 … the 'N due' count leaves the
 * drawer, today's count out of 20 stays." And his Anki rule (ANKI1): "we only add new cards if there's no due cards left to
 * be reviewed": the 20 are due cards, worth most first, the 3 due longest always among them; a new card only when nothing
 * is due. (Until ANKI1 this read "at least 4 new things a day", and the session held at least 4 new.)
 *
 * The law and its parity with the simulation are tests/practice_queue.test.mjs. This journey is the BUILT page: one player
 * chosen from the served wire by rule (tests/_practice_order_fixture.mjs: owed cards due today in the 4 position decks the
 * game weighs most, owed cards a month overdue in the 4 it weighs least, so oldest first and worth disagree), pressed the
 * way a player presses (a touch tap at 390x631, the mouse at 1440x900, at measured points):
 *   · the drawer's Practice row carries today's count against the goal and no due count, on the row or in its tooltip;
 *   · Practice opens on the planner's first position (never on the oldest debt), its heading names that position, and the
 *     session is exactly the plan's queue (no oldest-first debt left in front of it), in visit order, at most 6 cards a
 *     position; this player owes 24, so the 20 are due cards and none is new;
 *   · one answer short of the goal, the one card left is the one due longest, not the position worth most (the guard);
 *   · paging the queue and "Keep practising" without answering store NOTHING: every localStorage key and value is
 *     byte-identical (the pattern of rating-reader.spec.ts);
 *   · a record with no answer in it is never read as a worth session: today's order serves it, and says so once.
 * MUTANTS (v1.278.0), each built into the bundle (`npm run dev:neural:app`) and run against this file under the lock; the
 * table is in docs/Changelog-Archive.md (v1.278.0):
 *   P1 the cold oldest-first queue kept in front of the worth plan (`_practiceAppend`)   → "the session is the plan's queue"
 *   P2 the "N due" pill back on the row                                                  → "the row: today's count, no due"
 *   P3 oldest first restored in the law                                                  → "Practice opens on the planner's first position"
 *   F1 the plan's re-render forgetting the fold the player opened (FOLD1)               → "FOLD1: the fold is still open after the plan lands"
 *   D1 the dot lit while anything is owed, the goal ignored (its reading until 13 Nov)   → "the dot: out at the goal, with cards still owed"
 *   D2 "N cards are due now" back on the session-complete card                           → "the end card names no owed count"
 *   S1 the cold queue's open deck kept though the player never moved (finding 2)        → "Practice opens on the plan's first row, not on the oldest debt's deck"
 *   S4 a row "More new cards" added labelled by its missing number (finding 3)          → "the added rows under their own name", and the NaN net
 *   A1 no "Keep practising" on the completion card (finding 5)                           → "the completion card offers to keep going"
 *   B1 the owed session built from the worth plan (finding 1's door)                     → "a deck the order never prices is here"
 *   B2 the band shown while owed, the goal ignored                                       → "the Path's band: gone at the goal, owed or not"
 * ANKI1 (the owner's Anki rule), built the same way:
 *   A1 a new card while something is due (new cards ride in a position's visit again)   → "24 cards are due: the 20 are due cards, none new"
 *   A2 the guard removed (worth alone)                                                   → "the one card left is the one due longest"
 * ANKI1-R1 (the reader's finding 4), built the same way:
 *   V1 the per-visit cap ignored (a position asked whole)                                → "at most 6 a visit"
 *   V2 a second visit shown as its own position (the fold removed)                        → "the page folds them into one position…"
 * NON-KILL (STAGE3-R2, recorded so this file is not read as covering it): S7, the next round's positions not renumbered,
 * leaves "the queue's position numbers, after the next round" GREEN here, 2 of 2 (17:32, 13 Nov): this player's next round
 * brings no position whose decks the first round already holds, so there is no gap to make. The claim is pinned by
 * tests/practice_page.test.mjs ("Keep practising numbers the positions the player sees without a gap"), on the reader's
 * twelve-deck record, where S7 is red; the assertion here stays as a net on the built page.
 * R409 (the reader's delta read of 946465b77):
 *   · finding 2: "the dot is lit…" claimed "the one card left is the one due longest" with nothing waiting for the rating's
 *     live set, so it held only because the belt row's check happened to land before the Practice tap. It now waits for the
 *     belt row's reading to be final (`data-belt-state="ok"`: what a player sees when the set lands); the assertion is unchanged.
 *   · finding 1: "the guard holds when the live set lands after the tap" HOLDS the live files by route until after the tap:
 *     untouched, the session takes its plan again (the 3 due longest in the 20, the same first row); touched (a card turned),
 *     the plan is unchanged and one `neural_practice_unguarded` says so. The session's arithmetic, the failed and ended
 *     cases and the once rule are tests/practice_page.test.mjs's (mutants G3 to G6 there).
 *   · R409-6: "a record with no answer…" pins the fold's button reading "More new cards · …" in today's order too.
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
/** THE NET FOR A WHOLE CLASS (STAGE3-R1, the reader's finding 3: "NaN" on the page): no text node under the Practice page
 *  reads "NaN" or "undefined", checked after every action a test here takes. */
async function clean(page: Page, after: string) {
  const bad = await page.evaluate(() => {
    const root = document.querySelector("[data-practice-page]"); if (!root) return [] as string[]
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), out: string[] = []
    for (let n = w.nextNode(); n; n = w.nextNode()) if (/\bNaN\b|undefined/.test(n.nodeValue || "")) out.push((n.nodeValue || "").slice(0, 80))
    return out
  })
  expect(bad, `no "NaN" or "undefined" on the Practice page after ${after}`).toEqual([])
}
/** one press on whatever the open card asks next: Reveal, then Got it; a graded card goes on with its deck's next arrow */
async function answerOne(page: Page, touch: boolean) {
  const open = '[data-session-row][aria-expanded="true"] + div'
  await expect(page.locator(open + " [data-mini-reveal]:visible")).toHaveCount(1, { timeout: 10_000 })
  if (await page.locator(open + " [data-mini-graded]:visible").count()) { await press(page, open + " .mn", "the deck's next card", touch); return }
  if (!(await page.locator(open + " [data-mini-a]:visible").count())) await press(page, open + " [data-mini-reveal]", "Reveal", touch)
  await press(page, open + " [data-mini-got]", "Got it", touch)
}

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
      // since the merge with v1.276.0 the tooltip opens with what a tap does (#412, STAGE2-GO 7); before, "0 answered today · "
      expect(title).toMatch(/^Start today's session · 0 answered today · /)
      const before = await settled(page)
      expect(before, "the seeded record is in storage").toContain(fx.heavy[0])

      await press(page, row, "the Practice row", touch)
      await expect.poll(() => page.evaluate(() => (window as W).__neural._session?.plan?.order || null), { timeout: 30_000, message: "the worth plan lands" }).toBe("worth")
      const s = await page.evaluate(() => {
        const a = (window as W).__neural, s = a._session, p = s.plan, fresh = a.planSummary()
        return { keys: s.keys.slice(), queue: p.queue.slice(), again: fresh.queue.slice(), visits: p.visits.map((v: W) => ({ seat: v.seat, keys: v.keys.slice() })),
          rows: p.due.concat(p.fresh).map((r: W) => ({ key: r.key, seat: r.seat, visit: r.visit, count: r.count, owed: (r.owed || []).length })),
          dom: [...document.querySelectorAll("[data-session] [data-session-row]")].map((r) => r.getAttribute("data-session-row")), newCards: p.newCards,
          lawVisits: p.counts.lawVisits }
      })
      // the session is the plan's queue
      expect(s.keys, "the session holds exactly the plan's rows, in its order: no oldest-first debt in front").toEqual(s.queue)
      expect(s.again, "and the plan is the planner's own, asked again").toEqual(s.queue)
      expect(s.dom, "the page mounts the rows in that order").toEqual(s.keys)
      expect(new Set(s.keys).size, "one row per deck").toBe(s.keys.length)
      // at most 6 a VISIT (ANKI1-R1, the reader's finding 4): the page folds a position's second visit into its first, so a
      // page position may show more (the test below); until then this read "at most 6 cards at a position" off the page
      for (const [seat, n] of s.lawVisits) expect(n, `${seat}: at most 6 a visit`).toBeLessThanOrEqual(6)
      // ANKI1: 24 are due, so the 20 are due cards and no new card comes (until ANKI1: "at least 4 new")
      expect([s.rows.reduce((m: number, r: W) => m + r.owed, 0), s.newCards], "24 cards are due: the 20 are due cards, none new").toEqual([20, 0])
      // Practice opens on the planner's first position, not on the oldest debt: the light decks' cards are a month overdue
      // (oldest first would open there), and worth asks them after positions the game weighs more (the arithmetic is the
      // unit suite's; this page must only play it)
      expect(s.keys[0], "the open card is the first position's").toBe(s.visits[0].keys[0])
      expect(s.rows.filter((r: W) => fx.light.includes(r.key) && r.visit === 0), "a month overdue, but light: not first").toEqual([])
      expect(s.rows.filter((r: W) => fx.heavy.includes(r.key) && r.owed === 3).length, "the misses in the decks weighed most are asked").toBeGreaterThan(0)
      await expect(page.locator("[data-practice-section]"), "the heading names the open card's position").toHaveText(`${dot(s.visits[0].seat)} · position 1 of ${s.visits.length}`)
      await clean(page, "opening Practice")
      // the queue, named position by position
      await press(page, "[data-practice-details] > summary", "Practice details & session queue", touch)
      await clean(page, "opening the session queue")
      await expect(page.locator("[data-practice-queue] [data-practice-visit]"), "a label per position").toHaveText(s.visits.map((v: W, i: number) => `${i + 1} · ${v.seat ? dot(v.seat) : "Other cards"}`))
      // paging the queue moves the heading with the open card, and stores nothing
      for (let i = 1; i < Math.min(4, s.keys.length); i++) {
        await press(page, ".ng-practice-nav > button:nth-child(2)", "Next technique", touch)
        await expect.poll(() => page.evaluate(() => (window as W).__neural._session.idx), { message: "the queue moves on" }).toBe(i)
        const r = s.rows.find((x: W) => x.key === s.keys[i])
        await expect(page.locator("[data-practice-section]")).toHaveText(`${r.seat ? dot(r.seat) : "Other cards"} · position ${r.visit + 1} of ${s.visits.length}`)
        await clean(page, "Next technique")
      }
      // "More new cards" (until v1.278.0 "Keep practising · more new cards") still adds today's ranked new techniques after the
      // day's positions; a row it adds is named apart, never numbered (STAGE3-R1, finding 3)
      const more = await page.evaluate(() => Math.min(10, (window as W).__neural._session.plan.more.length))
      expect(more, "there is more to add").toBeGreaterThan(0)
      await expect(page.locator("[data-plan-more]"), "its label says what it adds").toHaveText(/^More new cards · (weakest first|ranked by your study comparison.*)$/)
      await press(page, "[data-plan-more]", "More new cards", touch)
      await expect.poll(() => page.evaluate(() => (window as W).__neural._session.keys.length)).toBe(s.keys.length + more)
      await expect(page.locator('[data-practice-queue] [data-practice-visit="more"]'), "the added rows under their own name").toHaveText("More new cards")
      await clean(page, "More new cards")
      const added = await page.evaluate((n: number) => (window as W).__neural._session.keys[n], s.keys.length)
      await page.evaluate((k: string) => { const b = [...document.querySelectorAll("[data-practice-queue] button")].find((x) => x.textContent === k.replace("|", " · ")); if (b) b.setAttribute("data-added-jump", "1") }, added)
      await press(page, "[data-added-jump]", "an added row's button", touch)
      await expect(page.locator("[data-practice-section]"), "an added row's heading names it apart").toHaveText("More new cards")
      await clean(page, "opening an added row")
      await page.waitForTimeout(2_500)
      expect(await storage(page), "every localStorage key and value is byte-identical after opening, paging and Keep practising").toBe(before)
    })

    // ANKI1-R1 (the reader's finding 4): eight cards due at one position. The law asks them in two visits (6, then 2: a
    // position comes round again while its cards are due), and the page folds the second into the first: one position showing
    // all eight, its heading "position 1 of N". The rule is per visit; the page's position holds every card the law asked there.
    test(`a position the law visits twice is one position on the page, with all its cards (${touch ? "touch" : "mouse"})`, async ({ page }) => {
      const { secondVisitFixture } = await import("../../tests/_practice_order_fixture.mjs")
      const fx = secondVisitFixture(SERVED)
      await boot(page, fx.day, fx.blob)
      await press(page, ".ng-logo", "open the drawer", touch)
      await press(page, '[data-explore-stats] [data-b="due"]', "the Practice row", touch)
      await expect.poll(() => page.evaluate(() => (window as W).__neural._session?.plan?.order || null), { timeout: 30_000, message: "the worth plan lands" }).toBe("worth")
      const s = await page.evaluate((deck: string) => {
        const p = (window as W).__neural._session.plan, row = p.due.concat(p.fresh).find((r: W) => r.key === deck)
        return { lawVisits: p.counts.lawVisits, first: p.visits[0].seat, positions: p.visits.length, owed: row ? row.owed.length : 0, visit: row ? row.visit : null }
      }, fx.deck)
      expect(s.lawVisits.slice(0, 2), "the law visits the position twice: 6, then 2").toEqual([[fx.deck, 6], [fx.deck, 2]])
      for (const [seat, n] of s.lawVisits) expect(n, `${seat}: at most 6 a visit`).toBeLessThanOrEqual(6)
      expect([s.first, s.visit, s.owed], "the page folds them into one position, the first, with all eight").toEqual([fx.deck, 0, 8])
      expect(s.positions, "a position the law visits twice is counted once").toBe(new Set(s.lawVisits.map((v: W) => v[0])).size)
      await expect(page.locator("[data-practice-section]"), "its heading counts it once").toHaveText(`${dot(fx.deck)} · position 1 of ${s.positions}`)
      await clean(page, "opening a position visited twice")
    })

    // FOLD1 (v1.278.0, the orchestrator's check on the preview): on a slow connection a player can open "Practice details &
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

    // FINDING 2 (STAGE3-R1): the cold queue opens on the oldest debt; when the plan holds that deck at a LATER position, the
    // plan's arrival used to keep it open (Practice at position 2, 3 or 4). Only a deck the player moved to is kept now.
    test(`Practice opens on the plan's first position though the oldest debt sits later (${touch ? "touch" : "mouse"})`, async ({ page }) => {
      const { oldestLaterFixture } = await import("../../tests/_practice_order_fixture.mjs")
      const fx = await oldestLaterFixture(SERVED)
      expect(fx.laterAt, "premise: the oldest debt's deck is later in the plan").toBeGreaterThan(0)
      await boot(page, fx.day, fx.blob)
      await press(page, ".ng-logo", "open the drawer", touch)
      await press(page, '[data-explore-stats] [data-b="due"]', "the Practice row", touch)
      await expect.poll(() => page.evaluate(() => (window as W).__neural._session?.plan?.order || null), { timeout: 30_000, message: "the worth plan lands" }).toBe("worth")
      const at = await page.evaluate(() => { const s = (window as W).__neural._session; return { idx: s.idx, key: s.keys[s.idx], first: s.plan.queue[0], positions: s.plan.visits.length, seat: s.plan.visits[0].seat } })
      expect(at.key, "Practice opens on the plan's first row, not on the oldest debt's deck").toBe(at.first)
      expect(at.key).not.toBe(fx.later)
      await expect(page.locator("[data-practice-section]"), "position 1").toHaveText(`${dot(at.seat)} · position 1 of ${at.positions}`)
      await clean(page, "opening Practice")
    })

    // FINDING 5 (STAGE3-R1): going on past the goal, in place. When the session's cards are done, the completion card offers
    // "Keep practising", which deals the next round by worth into the same session, its positions numbered on; today's count
    // keeps counting (a goal, never a cap).
    test(`past the goal, Keep practising goes on in the same session (${touch ? "touch" : "mouse"})`, async ({ page }) => {
      const { orderFixture } = await import("../../tests/_practice_order_fixture.mjs")
      const fx = orderFixture(SERVED), blob = JSON.parse(JSON.stringify(fx.blob))
      blob.srs["Seed|Top"] = Object.fromEntries(Array.from({ length: 19 }, (_, i) => ["today" + i, [fx.day + 1, 1, fx.day]]))
      await boot(page, fx.day, blob)
      await press(page, ".ng-logo", "open the drawer", touch)
      await press(page, '[data-explore-stats] [data-b="due"]', "the Practice row", touch)
      await expect.poll(() => page.evaluate(() => (window as W).__neural._session?.plan?.order || null), { timeout: 30_000, message: "the worth plan lands" }).toBe("worth")
      for (let i = 0; i < 8 && !(await page.locator("[data-session-complete]").count()); i++) { await answerOne(page, touch); await page.waitForTimeout(700); await clean(page, "an answer") }
      await expect(page.locator("[data-session-complete]"), "the session completes").toHaveCount(1)
      const first = await page.evaluate(() => { const a = (window as W).__neural, s = a._session; return { session: s, keys: s.keys.length, visits: s.plan.visits.length, done: a.practiceToday().done } })
      expect(first.done, "past the goal").toBeGreaterThanOrEqual(20)
      await page.evaluate(() => { (window as any).__round1 = (window as W).__neural._session })
      await expect(page.locator("[data-session-complete] [data-plan-next]"), "the completion card offers to keep going").toHaveText("Keep practising")
      await press(page, "[data-session-complete] [data-plan-next]", "Keep practising", touch)
      await expect(page.locator("[data-session-complete]"), "the session goes on").toHaveCount(0)
      const next = await page.evaluate(() => { const a = (window as W).__neural, s = a._session, r = s.plan.due.concat(s.plan.fresh).find((x: W) => x.key === s.keys[s.idx]);
        return { same: s === (window as any).__round1, keys: s.keys.length, visits: s.plan.visits.length, visit: r && r.visit, seat: r && r.seat } })
      expect(next.same, "in the same session").toBe(true)
      expect(next.keys, "with the next round's rows").toBeGreaterThan(first.keys)
      expect(next.visit, "the open card is the next round's, numbered on").toBeGreaterThanOrEqual(first.visits)
      await expect(page.locator("[data-practice-section]")).toHaveText(`${next.seat ? dot(next.seat) : "Other cards"} · position ${next.visit + 1} of ${next.visits}`)
      // STAGE3-R2 a: the queue numbers the positions it shows, 1 to N without a gap, and N is the heading's "of N"
      const numbers = await page.locator("[data-practice-queue] [data-practice-visit]").evaluateAll((els) =>
        els.map((e) => e.textContent || "").filter((t) => /^\d+ · /.test(t)).map((t) => parseInt(t, 10)))
      expect(numbers, "the queue's position numbers, after the next round").toEqual(Array.from({ length: next.visits }, (_, i) => i + 1))
      await clean(page, "Keep practising")
      await answerOne(page, touch)
      await expect.poll(() => page.evaluate(() => (window as W).__neural.practiceToday().done), { message: "today's count keeps counting" }).toBe(first.done + 1)
      await clean(page, "an answer past the goal")
    })

    // FINDING 1's DOOR (STAGE3-R1): "Everything owed, oldest first", one level down inside "Practice details & session
    // queue", is dev's own order over the whole owed pile, a deck the order never prices included, and it goes on.
    test(`Everything owed, oldest first: the whole owed pile, priced or not (${touch ? "touch" : "mouse"})`, async ({ page }) => {
      const { unpricedOwedFixture } = await import("../../tests/_practice_order_fixture.mjs")
      const fx = await unpricedOwedFixture(SERVED)
      await boot(page, fx.day, fx.blob)
      await press(page, ".ng-logo", "open the drawer", touch)
      await press(page, '[data-explore-stats] [data-b="due"]', "the Practice row", touch)
      await expect.poll(() => page.evaluate(() => (window as W).__neural._session?.plan?.order || null), { timeout: 30_000, message: "the worth plan lands" }).toBe("worth")
      expect(await page.evaluate((k: string) => (window as W).__neural._session.plan.queue.includes(k), fx.unpriced), "premise: the order never asks the unpriced deck").toBe(false)
      await press(page, "[data-practice-details] > summary", "Practice details & session queue", touch)
      const owed = await page.evaluate(() => (window as W).__neural.dueCount())
      await expect(page.locator("[data-practice-owed]"), "the door, with how many are owed, inside the fold").toHaveText(`Everything owed, oldest first · ${owed} cards`)
      await press(page, "[data-practice-owed]", "Everything owed, oldest first", touch)
      await expect.poll(() => page.evaluate(() => !!(window as W).__neural._session?.owed), { message: "the owed session opens" }).toBe(true)
      const s = await page.evaluate(() => { const a = (window as W).__neural, s = a._session; return { keys: s.keys.slice(), count: s.review.count, cover: s.review.rows.map((r: W) => r.key),
        dom: [...document.querySelectorAll("[data-session] [data-session-row]")].map((r) => r.getAttribute("data-session-row")) } })
      expect(s.count, "every owed card").toBe(owed)
      expect(s.keys, "the cover, oldest first").toEqual(s.cover)
      expect(s.dom, "on the page, in that order").toEqual(s.keys)
      expect(s.keys, "a deck the order never prices is here").toContain(fx.unpriced)
      await expect(page.locator("[data-practice-section]"), "headed by the owed cards").toHaveText(`Due reviews · ${owed} cards`)
      await clean(page, "Everything owed")
      await answerOne(page, touch)
      await expect.poll(() => page.evaluate(() => (window as W).__neural.practiceToday().done), { message: "it answers" }).toBe(1)
      expect(await page.evaluate(() => (window as W).__neural._session.owed), "and goes on, in its own session").toBe(true)
      await clean(page, "an owed answer")
    })

    // THE DOT AND THE END CARD (the orchestrator's decision, 13 Nov, after the owner's U171 a took the "N due" count out of
    // the drawer): the closed drawer's amber dot is lit while there is practice left for today (cards owed AND the goal
    // not met) and goes out at the goal, owed cards or not; the session-complete card names no owed count. The player:
    // the journey's seeded record (24 owed cards) and 19 answers already today, so one answer is the goal's edge.
    test(`the dot is lit one answer short of the goal and out at it; the end card names no owed count (${touch ? "touch" : "mouse"})`, async ({ page }) => {
      const { orderFixture } = await import("../../tests/_practice_order_fixture.mjs")
      const fx = orderFixture(SERVED)
      const blob = JSON.parse(JSON.stringify(fx.blob))
      blob.srs["Seed|Top"] = Object.fromEntries(Array.from({ length: 19 }, (_, i) => ["today" + i, [fx.day + 1, 1, fx.day]]))
      await boot(page, fx.day, blob)
      const dot = page.locator(".ng-logo [data-drawer-dot]")
      const state = () => page.evaluate(() => { const a = (window as W).__neural, el = document.querySelector(".ng-logo [data-drawer-dot]") as HTMLElement;
        return { done: a.practiceToday().done, owed: a.dueCount(), shown: !!el && getComputedStyle(el).display !== "none" } })
      expect(await state(), "premise: 19 of 20 today, cards owed").toMatchObject({ done: 19 })
      expect((await state()).owed, "premise: cards owed").toBeGreaterThan(0)
      await expect(dot, "the dot: lit one answer short of the goal").toBeVisible()
      await press(page, ".ng-logo", "open the drawer", touch)
      // R409 (the reader's finding 2): the guard's claim below needs the rating's live set in hand at the Practice tap (no deck
      // is loaded, so only the set says the light card is answerable). Until R409 nothing here waited for it, and the claim
      // held only because the belt row's check happened to land before the tap. Now the journey waits for what a player can
      // see when it lands: the belt row's reading, final (`data-belt-state="ok"`). The set landing AFTER the tap is the test
      // "the guard holds when the live set lands after the tap" below.
      await expect(page.locator("[data-belt-row]"), "the live set is in: the belt row's reading is final").toHaveAttribute("data-belt-state", "ok", { timeout: 30_000 })
      // the Path's band follows the dot's rule (STAGE3-R1): there one answer short of the goal
      await press(page, '[data-explore-stats] [data-view="challenges"]', "the Path row", touch)
      await expect(page.locator("[data-maintenance] b"), "the Path's band: there one answer short of the goal").toHaveText("19 of 20 today")
      // in the view's name and the drawer row's words since v1.276.0 (owner U169 c), pinned here: nothing else reads them
      await expect(page.locator("[data-maintenance] em"), "the band's words: what a tap does").toHaveText("Start today's session")
      await expect(page.locator("[data-maintenance]"), "the band's name").toHaveAttribute("aria-label", "Master the game, 19 of 20 today \u2014 Start today's session")
      await press(page, ".ng-drawer-brand", "‹ Path, home", touch)
      await press(page, '[data-explore-stats] [data-b="due"]', "the Practice row", touch)
      await expect.poll(() => page.evaluate(() => (window as W).__neural._session?.plan?.order || null), { timeout: 30_000, message: "the worth plan lands" }).toBe("worth")
      const open = '[data-session-row][aria-expanded="true"] + div'
      // the guard (ANKI1): one answer is left of the goal, and it goes to the card due longest (a light deck's, a month
      // overdue), not to the position worth most; and no new card rides with it (until ANKI1 the floor added one)
      const one = await page.evaluate(() => { const p = (window as W).__neural._session.plan; return { due: p.dueQuestions.length, keys: p.due.map((r: W) => r.key), newCards: p.newCards } })
      expect([one.due, one.keys.length, one.newCards], "one card, due, and nothing new").toEqual([1, 1, 0])
      expect(fx.light, "the one card left is the one due longest").toContain(one.keys[0])
      // answer every card the session holds (the goal's last answer)
      for (let i = 0; i < 6 && !(await page.locator("[data-session-complete]").count()); i++) {
        await expect(page.locator(open + " [data-mini-reveal]:visible")).toHaveCount(1, { timeout: 10_000 })
        await press(page, open + " [data-mini-reveal]", "Reveal", touch)
        await press(page, open + " [data-mini-got]", "Got it", touch)
        if (i === 0) {
          await expect.poll(async () => (await state()).done, { message: "the goal's last answer counts" }).toBe(20)
          const at = await state()
          expect(at.owed, "premise: cards still owed at the goal").toBeGreaterThan(0)
          expect(at.shown, "the dot: out at the goal, with cards still owed").toBe(false)
        }
        await page.waitForTimeout(700)
      }
      await expect(page.locator("[data-session-complete]"), "the session completes").toHaveCount(1)
      expect((await state()).owed, "premise: cards still owed at the end").toBeGreaterThan(0)
      await expect(page.locator("[data-session-complete]"), "the end card names what was done today").toContainText(/You reviewed \d+ of \d+ cards today\./)
      await expect(page.locator("[data-session-complete]"), "the end card names no owed count").not.toContainText(/due/)
      await press(page, ".ng-explorer-close", "close the drawer", touch)
      await expect(page.locator(".ng-logo"), "the drawer is closed").toBeVisible()
      await expect(dot, "and the closed drawer's icon wears no dot past the goal").toBeHidden()
      await press(page, ".ng-logo", "open the drawer again", touch)
      await press(page, '[data-explore-stats] [data-view="challenges"]', "the Path row", touch)
      await expect(page.locator(".ng-track-card").first(), "the Path is open").toBeVisible()
      expect((await state()).owed, "premise: cards still owed").toBeGreaterThan(0)
      await expect(page.locator("[data-maintenance]"), "the Path's band: gone at the goal, owed or not").toHaveCount(0)
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
      // R409-6 (the orchestrator, seen live on the preview at 10:40, 14 Nov): the fold's button is one button with one label
      // in both orders; here it read "Keep practising · more new cards" while the worth session read "More new cards · …"
      await expect(page.locator("[data-plan-more]"), "the fold's button, as in a worth session").toHaveText(/^More new cards \u00b7 (weakest first|ranked by your study comparison)/)
    })

    // THE GUARD AND THE LIVE SET (R409, the reader's finding 1). The rating's live files are HELD by the route until after
    // the Practice tap, so the plan is taken without them: no deck is loaded and this player's cards are unshared, so the
    // guard knows none of them answerable (tests/_practice_order_fixture.mjs, `guardFixture`: three light cards due 200
    // days ago behind thirty heavy misses). Released UNTOUCHED, the session takes its plan again, once: the three due longest
    // are in the 20, on the same first position, and the explanation says so. TOUCHED first (a card turned), it keeps its
    // plan, rows and cards, and one `neural_practice_unguarded` says so (counts and a reason word only).
    for (const touched of [false, true]) test(`the guard holds when the live set lands after the tap: ${touched ? "touched, the plan stays" : "untouched, the plan is taken again"} (${touch ? "touch" : "mouse"})`, async ({ page }) => {
      const { guardFixture } = await import("../../tests/_practice_order_fixture.mjs")
      const fx = guardFixture(SERVED)
      let release!: () => void, held = 0
      const gate = new Promise<void>((r) => (release = r))
      await page.route(/\/flashcards\/live-\d+\.json/, async (route) => { held++; await gate; await route.continue() })
      // the PostHog boundary as the loader leaves it (a queue array; .claude/rules/traps-playwright.md, path-visit-telemetry)
      await page.addInitScript(() => { const q: W = (window as W).posthog = []; q.capture = (...args: W[]) => q.push(["capture", ...args]) })
      await boot(page, fx.day, fx.blob)
      await press(page, ".ng-logo", "open the drawer", touch)
      await expect.poll(() => held, { message: "the drawer asks for the live files, and the route holds them" }).toBeGreaterThan(0)
      await expect(page.locator("[data-belt-row]"), "so the belt row's reading waits").toHaveAttribute("data-belt-state", "wait")
      await press(page, '[data-explore-stats] [data-b="due"]', "the Practice row", touch)
      await expect.poll(() => page.evaluate(() => (window as W).__neural._session?.plan?.order || null), { timeout: 30_000, message: "the worth plan lands" }).toBe("worth")
      const read = () => page.evaluate((oldest: string[]) => {
        const a = (window as W).__neural, s = a._session, p = s.plan
        return { live: a._ratingLiveNow()?.status, guarded: p.guarded, asked: oldest.filter((q) => p.dueQuestions.includes(q)).length, due: p.dueQuestions.length,
          keys: s.keys.slice(), idx: s.idx, rows: JSON.stringify(p.due.concat(p.fresh).map((r: W) => [r.key, r.questions])), owed: p.counts.law.owed,
          dom: [...document.querySelectorAll("[data-session] [data-session-row]")].map((r) => r.getAttribute("data-session-row")),
          why: document.querySelector("[data-gameplan-summary] details > p")?.textContent || "",
          events: [...(window as W).posthog].filter((c: W) => c[0] === "capture" && c[1] === "neural_practice_unguarded").map((c: W) => c[2]) }
      }, fx.oldest)
      const before = await read(), heading = await page.locator("[data-practice-section]").textContent()
      expect([before.live, before.guarded, before.asked, before.due], "taken at the tap without the set: no guard, the three due longest not asked").toEqual(["checking", false, 0, 20])
      expect(before.why, "and the explanation does not claim the guard").not.toContain("The three cards due longest")
      expect(before.dom, "the page mounts the plan's rows").toEqual(before.keys)
      if (touched) {
        const open = '[data-session-row][aria-expanded="true"] + div'
        await expect(page.locator(open + " [data-mini-reveal]:visible"), "the open card is up").toHaveCount(1, { timeout: 10_000 })
        await press(page, open + " [data-mini-reveal]", "Reveal", touch)
      }
      release()
      await expect.poll(() => page.evaluate(() => !!(window as W).__neural._session?.guardSettled), { timeout: 30_000, message: "the set lands and the session settles" }).toBe(true)
      if (!touched) {
        await expect.poll(async () => (await read()).guarded, { message: "the plan is taken again" }).toBe(true)
        const after = await read()
        expect([after.live, after.asked, after.due], "the three due longest are in the 20").toEqual(["ok", 3, 20])
        expect(after.dom, "the page mounts the new plan's rows").toEqual(after.keys)
        expect(fx.light.every((k: string) => after.dom.includes(k)), "their rows are on the page").toBe(true)
        expect([after.idx, after.keys[0]], "on the same first position, open on the same row").toEqual([0, before.keys[0]])
        await expect(page.locator("[data-practice-section]"), "under the same heading").toHaveText(heading || "")
        expect(after.why, "and now the explanation says so").toContain("The three cards due longest come every day")
        expect(after.events, "taken again: no event").toEqual([])
      } else {
        await expect.poll(async () => (await read()).events.length, { message: "one event" }).toBe(1)
        const after = await read()
        expect(after.live, "premise: the set landed").toBe("ok")
        expect([after.keys, after.rows, after.dom], "the plan it took: the same rows and cards, in the same order").toEqual([before.keys, before.rows, before.dom])
        expect([after.guarded, after.asked], "still without the guard").toEqual([false, 0])
        expect(after.why, "and the explanation still does not claim it").not.toContain("The three cards due longest")
        expect(after.events, "counts and a reason word only").toEqual([{ variant: "neural", reason: "touched", short: 3, owed: before.owed }])
      }
      await clean(page, "the live set landing")
    })
  })
}
