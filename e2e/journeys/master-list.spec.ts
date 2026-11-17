import { expect, test, type Page } from "@playwright/test"
import { resolve } from "node:path"
import { journey } from "../dsl"

/** MASTER THE GAME IS A LIST WITH ONE BUTTON (L1, v1.290.0; the owner's U197 b, 17 Nov 2026: "I want a call to action here.
 * When we click that button, we should go for the first item on the list and then reveal the navigation buttons. I don't
 * want to have the section which reads 'Places you have been'"), with the orchestrator's rulings on Part A2 and L1-SEAM.
 * The BUILT page, one seeded player (tests/_practice_order_fixture.mjs: owed cards at 8 positions, so the plan is the worth
 * plan), plus the places that player has been to (`explored`): those 8, two more with nothing due, and one the map no longer
 * has. Pressed the way a player presses: a touch tap at 390x631, the mouse at 1440x900, at measured points.
 *   · as it opens: ONE button and the day's count; the plan's places in the plan's own order, a rule, every other place with
 *     nothing due; no heading; no navigation and no card; the lost place counted and said; each row's number the map's own
 *     gold count there (the map's functions, `_movesGold` and `_answered`, over the hand the map deals);
 *   · the press opens the plan's FIRST place in place (its card under its own row), and only then the navigation, in thumb
 *     reach; its middle button is the card's own next step; ≡ goes back to the list with the answer kept;
 *   · `openMasterAt(deckKey)` (L1-SEAM, for Last rolls as places): a place the plan visits opens in place on its first ask;
 *     a place with nothing due opens as a free review whose answer counts; a key the list does not hold opens the list,
 *     opens nothing and beats `master_at_unheld`;
 *   · "Belt lessons" holds the shelf folded; its row unfolds it, and a corridor door (`openCorridor`) opens it unfolded.
 * MUTANTS (built into the bundle, `npm run dev:neural:app`, run against this file under the lock; each red on the named test):
 *   L1-A1 the button opens the second place (`ngMasterPaint`'s first row)   → "as it opens…" and "the press opens the plan's first place…"
 *   L1-A2 the navigation shown before the press (`_masterMode`)             → "as it opens: one button…"
 *   L1-A3 a heading "Places you have been" back over the rows              → "as it opens: one button…"
 *   L1-A4 a row's number the hand's size, a total (`ngMasterGoldIn`)        → "as it opens: one button…"
 *   L1-A5 a place with nothing due opens nothing (`_masterGo`)             → "openMasterAt…"
 *   L1-A6 a key the list does not hold opens the first place (`openMasterAt`) → "openMasterAt…"
 * and two the suite found as faults while L1 was built, pinned where they were found:
 *   L1-A7 the open card moved under a held press (`_masterPlace`'s soft wait) → practice-page.spec.ts "P1-D: a late planner…"
 *   L1-A8 a move of the open card drops its focus (`_masterPlace`)           → corridor-reach.spec.ts "‹ Back from a checkpoint…"
 * (17 Nov 2026, 10:03-10:08, each applied alone and built, clean before and after: 8 of 8 red, every clean run green.)
 * The list's own arithmetic (order, the other places, the lost count, the words) is tests/master_list.test.mjs (L1-1 to L1-7).
 * NOT COVERED here: no-gi (the unit reads the rows the app hands it, whatever the ruleset), and a guest signing in (the record
 * is `explored`'s, unchanged by L1).
 */

type W = any
const SERVED = resolve(__dirname, "../../source/public/static/neural")
const CLASSIC = { answerMode: "classic" } as const
const dot = (seat: string) => seat.replace("|", " · ")
const GONE = "Gone Position|Top"

async function press(page: Page, selector: string, what: string, touch: boolean, scroll = true) {
  if (scroll) await page.locator(selector).first().scrollIntoViewIfNeeded()
  const at = await page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement | null
    if (!el) return { ok: false, why: "no element matches", x: 0, y: 0 }
    const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2
    if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return { ok: false, why: "off screen", x, y }
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

/** the seeded player, the drawer open on its list; Master the game not yet open */
async function setup(page: Page) {
  const { orderFixture } = await import("../../tests/_practice_order_fixture.mjs")
  const fx = orderFixture(SERVED)
  const own = new Set([...fx.heavy, ...fx.light])
  const rest = ["Mount|Top", "Side Control|Top", "Closed Guard|Bottom", "Back Control|Top", "Half Guard|Bottom", "Turtle|Top"].filter((k) => !own.has(k)).slice(0, 2)
  await page.addInitScript((d) => { (window as W).__NG_EPOCH_DAY__ = d }, fx.day)
  const j = journey(page, CLASSIC)
  await j.boot("/", { initialState: { ...fx.blob, explored: [...own, ...rest, GONE] } })
  await expect.poll(() => page.evaluate(() => {
    const a = (window as W).__neural
    return !!(a && a.nodes && a.nodes.length && a.flashcards && a.flashcards.decks && Object.keys(a.flashcards.decks).length && a.curriculum)
  }), { timeout: 60_000, message: "graph, deck manifest and curriculum in" }).toBe(true)
  // a Yes in the moves record for one dealt move at each heavy place, so rows carry gold the map paints
  const seeded = await page.evaluate((heavy: string[]) => {
    const a = (window as W).__neural, day = a._epochDay(), out: string[] = []
    a.moves = a.moves || {}
    for (const k of heavy) {
      const i = a.nodeForKey(k), role = k.endsWith("|Bottom") ? "bottom" : "top", o = a._ordById.get(a.siteIdOf(a.nodes[i].id)), d = a._dealtOrds(i, role) || []
      if (!d.length) continue
      ;(a.moves[o + "/" + role] = a.moves[o + "/" + role] || {})[d[0]] = [day + 30, 30, day - 1, 1]
      out.push(k)
    }
    a._movesRev = (a._movesRev || 0) + 1
    a.setPaused(true)
    return out
  }, fx.heavy)
  expect(seeded.length, "premise: gold at the heavy places").toBeGreaterThan(0)
  return { fx, rest, j }
}

async function openMaster(page: Page, touch: boolean) {
  await press(page, ".ng-logo", "open the drawer", touch, false)
  await press(page, '[data-explore-stats] [data-b="due"]', "the Master the game row", touch)
  await expect(page.locator("[data-practice-page]")).toHaveCount(1)
  await expect.poll(() => page.evaluate(() => (window as W).__neural._session?.plan?.order || null), { timeout: 30_000, message: "the worth plan lands" }).toBe("worth")
  await expect(page.locator('[data-master-row][data-master-group="plan"]').first(), "the rows are painted").toBeVisible({ timeout: 30_000 })
}

/** the plan's places, in its order, one each (the page folds a place's second visit into its first) */
const planSeats = (page: Page) => page.evaluate(() => [...new Set((window as W).__neural._session.plan.visits.map((v: W) => v.seat || ""))] as string[])
const openSeat = (page: Page) => page.evaluate(() => { const a = (window as W).__neural, s = a._session; return a._masterSeatOf(s, s.keys[s.idx]) })

async function clean(page: Page, after: string) {
  const bad = await page.evaluate(() => {
    const root = document.querySelector("[data-practice-page]"); if (!root) return [] as string[]
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), out: string[] = []
    for (let n = w.nextNode(); n; n = w.nextNode()) if (/\bNaN\b|undefined|Infinity/.test(n.nodeValue || "")) out.push((n.nodeValue || "").slice(0, 80))
    return out
  })
  expect(bad, `no "NaN", "undefined" or "Infinity" on the page after ${after}`).toEqual([])
}

for (const touch of [true, false]) {
  test.describe(touch ? "390x631, touch" : "1440x900, mouse", () => {
    test.use(touch ? { viewport: { width: 390, height: 631 }, hasTouch: true, isMobile: true } : { viewport: { width: 1440, height: 900 } })

    test(`as it opens: one button, the plan's places in its order, a rule, the other places, no heading, no navigation (${touch ? "touch" : "mouse"})`, async ({ page }) => {
      const { rest } = await setup(page)
      await openMaster(page, touch)
      const seats = await planSeats(page)
      expect(await page.locator('[data-master-row][data-master-group="plan"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-master-row"))),
        "the plan's places, in the plan's own order").toEqual(seats)
      const others = await page.locator('[data-master-row][data-master-group="rest"]').evaluateAll((els) => els.map((e) => [e.getAttribute("data-master-row"), e.querySelector("small")!.textContent]))
      for (const k of rest) expect(others.find((o) => o[0] === k), `${k}: a place with nothing due is a row`).toBeTruthy()
      for (const o of others) expect(o[1], `${o[0]}: nothing due`).toMatch(/^nothing due/)
      await expect(page.locator(".ng-mrule"), "one thin rule between them").toHaveCount(1)
      await expect(page.locator("[data-master-note]"), "the lost place is counted and said").toHaveText("1 place you reached is no longer on the map.")
      // ONE button, its words, the day's count
      await expect(page.locator("[data-master-start]")).toBeVisible()
      await expect(page.locator("[data-master-start] b")).toHaveText("Start today's session")
      const first = seats[0], [name, side] = first.split("|")
      await expect(page.locator("[data-master-start] small")).toHaveText(`${name}, ${side.toLowerCase()} first · 20 to go`)
      await expect(page.locator("[data-master-count]")).toHaveText("0 of 20 today")
      // no heading, no navigation, no card
      expect(await page.locator("[data-practice-page]").innerText(), "no section heading over the places").not.toMatch(/places you have been/i)
      expect(await page.locator("[data-master-rows]").evaluate((el) => el.firstElementChild!.matches("[data-master-row]")), "the rows start with a place").toBe(true)
      await expect(page.locator("[data-master-dock]"), "no navigation before the press").toBeHidden()
      await expect(page.locator("[data-mini-q]:visible"), "no card before the press").toHaveCount(0)
      // each row's number is the map's own gold count there
      const gold = await page.evaluate(() => {
        const a = (window as W).__neural, g = a._movesGold()
        return [...document.querySelectorAll("[data-master-row]")].map((el) => {
          const k = el.getAttribute("data-master-row")!, i = a.nodeForKey(k)
          const map = i < 0 ? 0 : (a._dealtOpts(i, k.endsWith("|Bottom") ? "bottom" : "top") || []).filter((o: W) => g.has(o.idx) || a._answered(a.nodes[o.idx])).length
          return [k, Number(el.querySelector("[data-master-gold]")?.getAttribute("data-master-gold") || 0), map]
        })
      })
      expect(gold.filter((r) => r[2] > 0).length, "premise: some rows carry gold").toBeGreaterThan(0)
      for (const [k, row, map] of gold) expect(row, `${k}: the row's number is the map's gold count`).toBe(map)
      await clean(page, "opening")
    })

    test(`the press opens the plan's first place in place, and only then the navigation, in thumb reach (${touch ? "touch" : "mouse"})`, async ({ page }) => {
      await setup(page)
      await openMaster(page, touch)
      const seats = await planSeats(page)
      await press(page, "[data-master-start]", "the button", touch)
      await expect(page.locator("[data-mini-q]:visible"), "the first ask is open").toHaveCount(1)
      expect(await openSeat(page), "the plan's FIRST place is the one open").toBe(seats[0])
      await expect(page.locator("[data-master-row][data-on]"), "its row is marked").toHaveAttribute("data-master-row", seats[0])
      expect(await page.locator("[data-master-row][data-on]").evaluate((el) => el.nextElementSibling?.matches("[data-master-ask]")), "the card opens in place, under its row").toBe(true)
      await expect(page.locator("[data-practice-section]"), "the slim line names the place").toHaveText(`${dot(seats[0])} · position 1 of ${(await page.evaluate(() => (window as W).__neural._session.plan.visits.length))}`)
      await expect(page.locator("[data-master-start]"), "the button has become the slim line").toBeHidden()
      // the navigation, in thumb reach: the foot of the screen, every control at least 44 px
      const dock = await page.locator("[data-master-dock]").evaluate((el) => {
        const r = el.getBoundingClientRect()
        return { top: r.top, bottom: r.bottom, h: innerHeight, sizes: [...el.children].map((c) => Math.round(c.getBoundingClientRect().height)) }
      })
      expect(dock.bottom, "inside the screen").toBeLessThanOrEqual(dock.h)
      expect(dock.top, "at the foot, in thumb reach").toBeGreaterThan(dock.h - 110)
      for (const h of dock.sizes) expect(h).toBeGreaterThanOrEqual(44)
      // its middle is the card's own next step
      await expect(page.locator("[data-master-act]")).toHaveText("Reveal")
      await press(page, "[data-master-act]", "Reveal", touch, false)
      await expect(page.locator("[data-master-act]")).toHaveText("Got it")
      await press(page, "[data-master-act]", "Got it", touch, false)
      await expect.poll(() => page.evaluate(() => (window as W).__neural.practiceToday().done), { message: "the answer counts" }).toBe(1)
      // ≡ back to the list, the answer kept
      await press(page, "[data-master-list]", "back to the list", touch, false)
      await expect(page.locator("[data-master-dock]")).toBeHidden()
      await expect(page.locator("[data-master-start] b")).toHaveText("Continue today's session")
      await expect(page.locator("[data-master-count]")).toHaveText("1 of 20 today")
      await clean(page, "an answer and the way back")
    })

    test(`openMasterAt: a place opens in place on its first ask; nothing due, a free review that counts; a key the list does not hold, the list (${touch ? "touch" : "mouse"})`, async ({ page }) => {
      const { rest } = await setup(page)
      await press(page, ".ng-logo", "open the drawer", touch, false)
      await expect.poll(() => page.evaluate(() => !!(window as W).__neural._gameplanRuntime), { timeout: 30_000 }).toBe(true)
      // the second place the plan visits, from the drawer's list (Master the game not open)
      await page.evaluate(() => { const a = (window as W).__neural; a.openMasterAt(a.planSummary().visits[1].seat) })
      await expect(page.locator("[data-mini-q]:visible"), "its first ask is open").toHaveCount(1, { timeout: 30_000 })
      const seats = await planSeats(page)
      expect(await openSeat(page), "the place asked for is the one open").toBe(seats[1])
      const inView = await page.locator("[data-master-row][data-on]").evaluate((el) => {
        const r = el.getBoundingClientRect(), l = el.closest(".ng-pane-drillhead + div")!.getBoundingClientRect()
        return r.top >= l.top - 1 && r.bottom <= l.bottom + 1
      })
      expect(inView, "its row is scrolled into view").toBe(true)
      // a place with nothing due: a free review, counted like any answer
      await page.evaluate((k) => (window as W).__neural.openMasterAt(k), rest[0])
      await expect.poll(() => openSeat(page), { message: "the free review is open" }).toBe(rest[0])
      await expect(page.locator("[data-practice-section]")).toHaveText(`${dot(rest[0])} · free review`)
      await expect(page.locator(`[data-master-row="${rest[0]}"]`)).toHaveAttribute("data-on", "")
      await press(page, "[data-master-act]", "Reveal", touch, false)
      await press(page, "[data-master-act]", "Got it", touch, false)
      await expect.poll(() => page.evaluate(() => (window as W).__neural.practiceToday().done), { message: "a free review's answer counts" }).toBe(1)
      // a key the list does not hold: the list, nothing open, nothing claimed
      await page.evaluate(() => (window as W).__neural.openMasterAt("Nowhere At All|Top"))
      await expect.poll(() => page.evaluate(() => ((window as W).__neural.beats || []).filter((b: W) => b.beat === "master_at_unheld").length)).toBe(1)
      await expect(page.locator("[data-master-start]"), "the list as it opens").toBeVisible()
      await expect(page.locator("[data-mini-q]:visible"), "nothing open").toHaveCount(0)
      await expect(page.locator("[data-master-row][data-on]")).toHaveCount(0)
      await clean(page, "openMasterAt")
    })

    test(`"Belt lessons" holds the shelf folded; its row unfolds it, and a corridor door opens it unfolded (${touch ? "touch" : "mouse"})`, async ({ page }) => {
      await setup(page)
      await openMaster(page, touch)
      await expect(page.locator("[data-master-belts]")).toHaveAttribute("aria-expanded", "false")
      await expect(page.locator("[data-master-shelf]")).toBeHidden()
      await press(page, "[data-master-belts]", "Belt lessons", touch)
      await expect(page.locator("[data-master-shelf] .ng-corridor")).toBeVisible()
      // closed, then a corridor door: the shelf opens unfolded
      await page.keyboard.press("Escape")
      await page.evaluate(() => { const a = (window as W).__neural; a.setDeckOpen(true); a.openCorridor() })
      await expect(page.locator("[data-master-belts]")).toHaveAttribute("aria-expanded", "true")
      await expect(page.locator("[data-master-shelf] .ng-corridor")).toBeVisible()
    })
  })
}
