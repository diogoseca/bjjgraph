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
 *     nothing due; no heading; no navigation and no card; the lost place counted and said (each row's gold number against
 *     the marks the map DRAWS on that place's hand is its own test, L1-R1);
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
 *   L1-A4 a row's number the hand's size, a total (`ngMasterGoldIn`)        → "the gold count is the map's…" at "the row's gold number
 *         is the marks the map drew on its hand" (L1-R1: it was red at "as it opens…" against the map's predicate, which the
 *         reader of PR #434 showed is the row's own function, so no independent pin)
 *   L1-A5 a place with nothing due opens nothing (`_masterGo`)             → "openMasterAt…"
 *   L1-A6 a key the list does not hold opens the first place (`openMasterAt`) → "openMasterAt…"
 * and two the suite found as faults while L1 was built, pinned where they were found:
 *   L1-A7 the open card moved under a held press (`_masterPlace`'s soft wait) → practice-page.spec.ts "P1-D: a late planner…"
 *   L1-A8 a move of the open card drops its focus (`_masterPlace`)           → corridor-reach.spec.ts "‹ Back from a checkpoint…"
 * (17 Nov 2026, 10:03-10:08, each applied alone and built, clean before and after: 8 of 8 red, every clean run green.)
 * L1-R0 (the orchestrator's two rulings on the opened place: one bar for the open ask, in the foot; a deck row that only
 * repeats its place is not drawn), built the same way:
 *   L1-R0a the card's own row drawn again (the foot gets copies)                → "the press opens…" at "one Reveal on the page"
 *   L1-R0b the place's own deck row drawn again (`_sessionRow`'s `own`)       → "the press opens…" at "the place's own deck row is not drawn"
 *   L1-R0c › wraps inside the deck instead of crossing (`_masterStep`)         → "the press opens…" at "› crosses to the next deck…"
 * L1-R1 and L1-R1b (the reader of PR #434, its findings as the orchestrator ruled them), 17 Nov 2026 13:16-13:38, the same way
 * (clean before and after; each red at the named step, both viewports where the test runs at both):
 *   L1-R1a a place's debt not read (every place outside the plan "nothing due") → "a place that owes cards…"
 *   L1-R1b the button falls back to the plan's first row when nothing is left       → "the plan answered before the goal…"
 *   L1-R1d an "Everything owed" session not replaced by `openMasterAt`              → "openMasterAt from Everything owed…"
 *   L1-R1e the loader takes every `explored` entry                                 → "a damaged explored boots…"
 *   L1-R1j (progress-owner.src.js) the record refused for a damaged entry again    → "a damaged explored boots…"
 *   L1-R1f the drawer not opened after Esc or ✕ (`openMasterAt`'s `shut`)          → "openMasterAt after … shut by Esc, at once" and
 *         "… by the drawer's ✕, at once", at "the drawer opens" (the two "10 s later" cases stay green: by then the kept session
 *         is gone, as the reader saw 1 s after boot, so they pin the other path)
 *   L1-R1g (the reader's i) the rows by name once a card is answered              → "after an answer, ≡ keeps…" at "after an
 *         answer, the rows keep the plan's order"
 *   L1-R1h (the reader's ii) ≡ dropping `_deckState`, `_miniGraded` and `idx`    → "after an answer, ≡ keeps…" at "the same card
 *         is open" (its `_miniGraded` part alone cannot be seen: a graded card is also read from `srs`, row[2] = today)
 *   L1-R1i ‹ Back from a checkpoint leaves the focus outside the page              → corridor-reach.spec.ts "‹ Back … from the list"
 *   L1-A1 again, at practice-order.spec.ts FINDING 2 (now pressed first)          → "Practice opens on the plan's first position…"
 * NON-KILL, recorded so nobody reads this file as covering it: L1-R1c, ≡ leaving a multiple-choice block live (`_masterList`
 * clears it): "≡ leaves no multiple-choice card behind" stays green without the clear, because the block's own `answer()`
 * refuses while its card is not displayed (`wrap.offsetParent === null`, and ≡ hides the card), as the reader measured; the
 * clear is a second guard.
 * L1-R2 (the second reader of PR #434, its one finding and the orchestrator's two rulings), 17 Nov 2026, the same
 * way (each applied alone and built, clean before and after; each red at the named step, both viewports where it runs at both):
 *   L1-R2d the owed cards do not join when the place's decks are answered (`_masterGo`) → "a place the day's goal cuts…" at
 *         "the press opens a card that is still owed, never an answered one"
 *   L1-R2e a deck reopens on its remembered card, answered or not (`_masterUnanswered`) → the same test
 *   L1-R2f the open place's figure is its deck's, not the place's (`ngMasterSync`)      → the same test, at "open: the figure
 *         beside the count agrees with it"
 *   L1-R2g only the record's places are rows (`ngMasterViewIn`'s `owing`)              → "a record that stored no places…"
 *   L1-R2h (the reader's c) the foot's Got it carries the previous card's handler      → "the plan answered before the goal…" at
 *         "each Got it in the foot grades the card above it" (its own step now; until L1-R2 an unnamed poll)
 *   L1-R2i (the reader's a) what a place outside the plan owes forced to 0             → "a place that owes cards outside today's
 *         plan…" at "a place the day's 20 do not reach has its row above the rule, with what it owes" (a claim, no longer a premise)
 *   (L1-R2j, "the save writes `explored` as strings only", is VOID: that ruling was taken back in L1-R3; strings only IS the rule)
 *   L1-R2k the walk to the next deck still pending after the list is shown             → "a place the day's goal cuts…" at "≡ right
 *         after a deck's last answer: the list stays, nothing opens by itself" (the fault this journey found: on the build
 *         without the fix the step is red 16 of 16)
 *   L1-R2l a place the player opens does not cancel the pending walk (`_masterGo`)      → the same test, at "a place the player
 *         opened stays open: the pending walk does not pull it away"
 * L1-R3 (the third read of PR #434, its one fix; and the orchestrator taking back L1-R2's ruling on `explored`), the same way:
 *   L1-R3c the row's opener does not move a deck off an answered card (`_sessionRow`'s `open`) → "every door into a place…" at
 *         "the button / the row / openMasterAt / ‹ across decks opens a card that is not yet answered" (four soft steps, one a
 *         door), "\"Keep practising\" opens a card that is still owed…" at "Keep practising opens a card that is still owed",
 *         and "a place the day's goal cuts…" at "the press opens a card that is still owed, never an answered one"
 *   L1-R3d the save writes the list back as it was stored, non-strings and all (`_progressBlob`) → "a damaged explored boots…"
 *         at "and nothing that is not a place's key: the damaged entries are gone from the record"
 * The list's own arithmetic (order, the other places, the lost count, the words) is tests/master_list.test.mjs (L1-1 to L1-11).
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
/** the seeded player, the drawer open on its list; Master the game not yet open. `blob` replaces the record (the reader's
 *  two-card day), `extra` adds raw `explored` entries (a damaged one), `settings` stores settings, `running` leaves the roll on */
async function setup(page: Page, opts: { blob?: (fx: W) => W; extra?: unknown[]; settings?: Record<string, unknown>; running?: boolean; places?: string[] } = {}) {
  const { orderFixture } = await import("../../tests/_practice_order_fixture.mjs")
  const fx = orderFixture(SERVED)
  const own = new Set([...fx.heavy, ...fx.light])
  const rest = ["Mount|Top", "Side Control|Top", "Closed Guard|Bottom", "Back Control|Top", "Half Guard|Bottom", "Turtle|Top"].filter((k) => !own.has(k)).slice(0, 2)
  await page.addInitScript((d) => { (window as W).__NG_EPOCH_DAY__ = d }, fx.day)
  const j = journey(page, CLASSIC)
  const blob = opts.blob ? opts.blob(fx) : { ...fx.blob }
  const settings = opts.settings ? { settings: opts.settings, settingsAt: Object.fromEntries(Object.keys(opts.settings).map((k) => [k, 5])) } : {}
  await j.boot("/", { initialState: { ...blob, ...settings, explored: opts.places || [...own, ...rest, GONE, ...(opts.extra || [])] } })
  await expect.poll(() => page.evaluate(() => {
    const a = (window as W).__neural
    return !!(a && a.nodes && a.nodes.length && a.flashcards && a.flashcards.decks && Object.keys(a.flashcards.decks).length && a.curriculum)
  }), { timeout: 60_000, message: "graph, deck manifest and curriculum in" }).toBe(true)
  // a Yes in the moves record for two dealt moves at each of the eight places, so rows carry gold the map paints
  const seeded = await page.evaluate(({ places, running }: W) => {
    const a = (window as W).__neural, day = a._epochDay(), out: string[] = []
    a.moves = a.moves || {}
    for (const k of places) {
      const i = a.nodeForKey(k), role = k.endsWith("|Bottom") ? "bottom" : "top", o = a._ordById.get(a.siteIdOf(a.nodes[i].id)), d = a._dealtOrds(i, role) || []
      if (!d.length) continue
      for (const m of d.slice(0, 2)) (a.moves[o + "/" + role] = a.moves[o + "/" + role] || {})[m] = [day + 30, 30, day - 1, 1]
      out.push(k)
    }
    a._movesRev = (a._movesRev || 0) + 1
    if (!running) a.setPaused(true)
    return out
  }, { places: [...fx.heavy, ...fx.light], running: !!opts.running })
  expect(seeded.length, "premise: gold at the eight places").toBeGreaterThan(4)
  return { fx, rest, j, seeded }
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

/** the open card as the app holds it: its deck and its question (the card the foot's buttons stand under), and whether it was answered today */
const openCard = (page: Page) => page.evaluate(() => {
  const a = (window as W).__neural, s = a._session, k = s.keys[s.idx], el = a._openMini && a._openMini.el.querySelector("[data-mini-q]")
  const text = (html: string) => { const d = document.createElement("div"); d.innerHTML = html; return d.textContent }
  const card = el ? (a._cardsOf(a.flashcards.decks[k]) || []).find((c: W) => text(c.q || c.front || "") === el.textContent) : null
  if (!card) return null
  const qh = a.qhash(card.q), r = a.srs[k] && a.srs[k][qh]
  return { key: k as string, qh: qh as string, today: !!(r && r[2] === a._epochDay()) }
})
const answeredToday = (page: Page, card: { key: string; qh: string }) => page.evaluate(({ key, qh }) => {
  const a = (window as W).__neural, r = a.srs[key] && a.srs[key][qh]
  return !!(r && r[2] === a._epochDay())
}, card)

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
      // L1-R1 (the reader's finding 7): the rows' gold numbers are checked against the marks the map DRAWS, not against the
      // row's own predicate ("the gold count is the map's": the test below); here only that the list carries some
      expect(await page.locator("[data-master-row] [data-master-gold]").count(), "premise: rows carry gold").toBeGreaterThan(0)
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
        return { top: r.top, bottom: r.bottom, h: innerHeight, sizes: [...el.querySelectorAll("button")].map((c) => Math.round(c.getBoundingClientRect().height)) }
      })
      expect(dock.bottom, "inside the screen").toBeLessThanOrEqual(dock.h)
      expect(dock.top, "at the foot, in thumb reach").toBeGreaterThan(dock.h - 110)
      for (const h of dock.sizes) expect(h).toBeGreaterThanOrEqual(44)
      // L1-R0: ONE bar for the open ask, in the foot: ≡, then the card's own ‹ Reveal ›; the card keeps no button row
      const bar = "[data-master-dock] [data-master-bar]"
      await expect(page.locator("[data-mini-reveal]:visible"), "one Reveal on the page").toHaveCount(1)
      await expect(page.locator(`${bar} [data-mini-reveal]`), "and it is the foot's").toBeVisible()
      await expect(page.locator("[data-master-ask] .mp:visible, [data-master-ask] .mn:visible, [data-master-ask] .mr:visible"), "the card keeps no button row").toHaveCount(0)
      // L1-R0: the place is named once in the list: its own deck's row is not drawn, and that deck's count is the place's
      await expect(page.locator(`[data-session-row="${seats[0]}"]`), "the place's own deck row is not drawn").toBeHidden()
      await expect(page.locator("[data-master-row][data-on] [data-master-prog]"), "its count is on the place's row").toHaveText(/^0\/\d+$/)
      await press(page, `${bar} [data-mini-reveal]`, "Reveal", touch, false)
      await expect(page.locator(`${bar} [data-mini-got]`), "revealed: the grades take Reveal's place in the foot").toBeVisible()
      await expect(page.locator(`${bar} [data-mini-again]`)).toBeVisible()
      await expect(page.locator("[data-mini-reveal]:visible"), "no second Reveal while the grades are up").toHaveCount(0)
      await press(page, `${bar} [data-mini-got]`, "Got it", touch, false)
      await expect.poll(() => page.evaluate(() => (window as W).__neural.practiceToday().done), { message: "the answer counts" }).toBe(1)
      await expect(page.locator("[data-master-row][data-on] [data-master-prog]")).toHaveText(/^1\/\d+$/)
      // L1-R0: › walks the deck's cards and crosses to the next deck's first card past its last; ‹ crosses back to the last
      const at0 = await page.evaluate(() => { const a = (window as W).__neural; return [a._session.idx, ...a._focusedMini().at()] })
      expect(at0[2], "premise: a deck of more than one card").toBeGreaterThan(1)
      for (let i = at0[1]; i < at0[2] - 1; i++) await press(page, `${bar} .mn`, "›", touch, false)
      await expect.poll(() => page.evaluate(() => (window as W).__neural._focusedMini().at()[0])).toBe(at0[2] - 1)
      await press(page, `${bar} .mn`, "› past the deck's last card", touch, false)
      await expect.poll(() => page.evaluate(() => { const a = (window as W).__neural; return [a._session.idx, a._focusedMini().at()[0]] }), { message: "› crosses to the next deck, at its first card" }).toEqual([at0[0] + 1, 0])
      await press(page, `${bar} .mp`, "‹ back across", touch, false)
      await expect.poll(() => page.evaluate(() => { const a = (window as W).__neural; return [a._session.idx, a._focusedMini().at()[0]] }), { message: "‹ crosses back, to the deck's last card" }).toEqual([at0[0], at0[2] - 1])
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
      await press(page, "[data-master-bar] [data-mini-reveal]", "Reveal", touch, false)
      await press(page, "[data-master-bar] [data-mini-got]", "Got it", touch, false)
      await expect.poll(() => page.evaluate(() => (window as W).__neural.practiceToday().done), { message: "a free review's answer counts" }).toBe(1)
      // a key the list does not hold: the list, nothing open, nothing claimed
      await page.evaluate(() => (window as W).__neural.openMasterAt("Nowhere At All|Top"))
      await expect.poll(() => page.evaluate(() => ((window as W).__neural.beats || []).filter((b: W) => b.beat === "master_at_unheld").length)).toBe(1)
      await expect(page.locator("[data-master-start]"), "the list as it opens").toBeVisible()
      await expect(page.locator("[data-mini-q]:visible"), "nothing open").toHaveCount(0)
      await expect(page.locator("[data-master-row][data-on]")).toHaveCount(0)
      await clean(page, "openMasterAt")
    })

    // L1-R1b, the reader's two surviving mutants (8 of 8 green each): (i) the rows sorted by name once a card is answered, and
    // (ii) ≡ dropping the session's answered state. After an answer and ≡ the list keeps the plan's order, and the button
    // reopens the SAME card, still revealed, the answered one not asked again
    test(`after an answer, ≡ keeps the plan's order and the button reopens the same card as it was left (${touch ? "touch" : "mouse"})`, async ({ page }) => {
      await setup(page)
      await openMaster(page, touch)
      const seats = await planSeats(page), bar = "[data-master-dock] [data-master-bar]"
      await press(page, "[data-master-start]", "the button", touch)
      await press(page, `${bar} [data-mini-reveal]`, "Reveal", touch, false)
      await press(page, `${bar} [data-mini-got]`, "Got it", touch, false)
      await expect.poll(() => page.evaluate(() => (window as W).__neural.practiceToday().done), { message: "one answer" }).toBe(1)
      const card = () => page.evaluate(() => { const a = (window as W).__neural, s = a._session; return { idx: s.idx, at: a._focusedMini().at()[0], q: a._openMini.el.querySelector("[data-mini-q]").textContent } })
      const left = await card()
      expect(left.at, "premise: the deck moved on to its next card").toBeGreaterThan(0)
      await press(page, `${bar} [data-mini-reveal]`, "Reveal the next card, and leave it ungraded", touch, false)
      await press(page, "[data-master-list]", "back to the list", touch, false)
      await expect(page.locator("[data-master-start]")).toBeVisible()
      // (i) the list a player comes back to is in the plan's order
      expect(await page.locator('[data-master-row][data-master-group="plan"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-master-row"))),
        "after an answer, the rows keep the plan's order").toEqual(seats)
      // (ii) the button reopens the card the player left, as it was left
      await press(page, "[data-master-start]", "Continue today's session", touch)
      await expect(page.locator("[data-mini-q]:visible")).toHaveCount(1)
      expect(await card(), "the same card is open").toEqual(left)
      await expect(page.locator(`${bar} [data-mini-got]`), "still revealed").toBeVisible()
      await press(page, `${bar} .mp`, "‹ to the answered card", touch, false)
      await press(page, `${bar} [data-mini-reveal]`, "Reveal it", touch, false)
      await expect(page.locator("[data-mini-graded]:visible"), "the answered card is not asked again: it says it is graded").toHaveCount(1)
      await expect(page.locator(`${bar} [data-mini-got]`), "and offers no grade").toHaveCount(0)
      await clean(page, "≡ and the button")
    })

    // L1-R1, the reader's finding 1 (measured: Jailbreak|Top, 3 cards 53 days overdue, read "nothing due" and opened as a free
    // review): a place that owes cards outside today's plan says so above the rule, and a press asks them as due cards
    test(`a place that owes cards outside today's plan says what it owes, above the rule, and asks its cards as due (${touch ? "touch" : "mouse"})`, async ({ page }) => {
      const { fx } = await setup(page)
      await openMaster(page, touch)
      const plan = await planSeats(page)
      const owing = await page.locator('[data-master-row][data-master-group="due"]').evaluateAll((els) => els.map((e) => [e.getAttribute("data-master-row"), e.querySelector("small")!.textContent]))
      // (L1-R2: a claim with its own name; the second reader's mutant, what a place outside the plan owes forced to 0, went red at a "premise:" line here)
      expect(owing.length, "a place the day's 20 do not reach has its row above the rule, with what it owes").toBeGreaterThan(0)
      for (const [seat, sub] of owing) {
        expect(plan, `${seat} is not one of today's places`).not.toContain(seat)
        // the record's own debt there: its deck's rows due today or before and not answered today (the fixture seeds position decks)
        const n = Object.values(fx.blob.srs[seat as string] || {}).filter((r: W) => r[0] <= fx.day && r[2] < fx.day).length
        expect(sub, `${seat}: what it owes, never "nothing due"`).toMatch(new RegExp("^" + n + " due"))
      }
      expect(await page.locator("[data-master-rows]").evaluate((el) => {
        const kids = [...el.children], rule = kids.findIndex((k) => k.matches(".ng-mrule")), due = kids.findIndex((k) => k.matches('[data-master-group="due"]'))
        return rule > due && due > kids.findIndex((k) => k.matches('[data-master-group="plan"]'))
      }), "after the plan's places, above the rule").toBe(true)
      const seat = owing[0][0] as string
      await press(page, `[data-master-row="${seat}"]`, "the owing place", touch)
      await expect(page.locator("[data-mini-q]:visible"), "its card is open").toHaveCount(1)
      await expect(page.locator("[data-practice-section]"), "headed by the place, never \"free review\"").toHaveText(dot(seat))
      await expect(page.locator(`[data-session-row="${seat}"]`), "asked as due").toHaveAttribute("data-practice-kind", "due")
      await expect(page.locator(`[data-gameplan-reason="${seat}"]`)).toContainText("due for review")
      expect(await page.locator("[data-practice-page]").innerText(), "no free review's words").not.toMatch(/Nothing is due here|free review/)
      await clean(page, "an owing place")
    })

    // L1-R2, the second reader's one finding (4 of 4, at the default goal and at a goal of 5): a place the day's goal cuts said
    // "3 due" while the plan asked 2 there; opened, "3 due" stood beside "0/2"; with those 2 answered the row read "1 due" and
    // its press reopened an ANSWERED card, the card still owed never asked. THE RULE (the orchestrator): a press on a row
    // that says "N due" asks a card that is due there, every time, until the row says nothing is due; and while a place is
    // open, the count and the figure beside it never contradict each other.
    for (const goal of [20, 5]) test(`a place the day's goal cuts (a goal of ${goal}): its row's count is what its press reaches, and the figure beside it agrees (${touch ? "touch" : "mouse"})`, async ({ page }) => {
      await setup(page, goal === 20 ? {} : { settings: { dailyGoal: goal } })
      await openMaster(page, touch)
      const cut = await page.evaluate(() => {
        const a = (window as W).__neural, s = a._session
        for (const r of s.view.rows) {
          const asked = s.plan.due.concat(s.plan.fresh).filter((x: W) => a._masterSeatOf(s, x.key) === r.seat).reduce((n: number, x: W) => n + (x.owed ? x.owed.length : 0), 0)
          if (r.seat && asked > 0 && r.due > asked) return { seat: r.seat as string, due: r.due as number, asked }
        }
        return null
      })
      expect(cut, `premise: with a goal of ${goal} the plan takes part of what one place owes`).not.toBeNull()
      const row = `[data-master-row="${cut!.seat}"]`, sub = page.locator(`${row} small`), bar = "[data-master-dock] [data-master-bar]"
      await expect(sub, "the row says the place's whole debt").toHaveText(new RegExp("^" + cut!.due + " due"))
      await press(page, row, "the cut place's row", touch)
      await expect(page.locator(`${row} [data-master-prog]`), "open: the figure beside the count agrees with it").toHaveText(`0/${cut!.due}`)
      let left = cut!.due
      // a point measured now and pressed later, back to back with another: the session walks to the next unfinished deck 520 ms
      // after a deck's last answer, and the two presses below must both land inside that time, by real input
      const point = async (sel: string, what: string) => {
        const at = await page.evaluate((q) => {
          const el = document.querySelector(q) as HTMLElement | null
          if (!el) return { ok: false, x: 0, y: 0 }
          const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, top = document.elementFromPoint(x, y)
          return { ok: !!top && (top === el || el.contains(top)) && x >= 0 && y >= 0 && x <= innerWidth && y <= innerHeight, x, y }
        }, sel)
        expect(at.ok, `${what}: on screen, and the point under the press is the control`).toBe(true)
        return at
      }
      const tap = (at: { x: number; y: number }) => (touch ? page.touchscreen.tap(at.x, at.y) : page.mouse.click(at.x, at.y))
      // the plan's share, answered in the foot: the count and the figure move together
      for (let i = 0; i < cut!.asked - 1; i++) {
        await press(page, `${bar} [data-mini-reveal]`, "Reveal", touch, false)
        await press(page, `${bar} [data-mini-got]`, "Got it", touch, false)
        left--
        await expect(sub, `after ${i + 1}: the count`).toHaveText(new RegExp("^" + left + " due"))
        await expect(page.locator(`${row} [data-master-prog]`), `after ${i + 1}: the figure agrees (${cut!.due - left}/${cut!.due})`).toHaveText(`${cut!.due - left}/${cut!.due}`)
      }
      // THE LAST CARD OF THE PLAN'S SHARE, AND AT ONCE THE PLACE'S OWN ROW (no ≡ between): every deck the session holds here is
      // answered and the place still owes, so the press takes in what it owes; and the walk to the next deck, still pending
      // from that answer, must not pull the player off the card just opened (L1-R2, the fault this journey found)
      await press(page, `${bar} [data-mini-reveal]`, "Reveal", touch, false)
      const got = await point(`${bar} [data-mini-got]`, "Got it"), again = await point(row, "the place's own row")
      await tap(got); await tap(again)
      left--
      expect(left, "premise: the place still owes after the plan's share").toBeGreaterThan(0)
      await page.waitForTimeout(900)
      expect(await openSeat(page), "a place the player opened stays open: the pending walk does not pull it away").toBe(cut!.seat)
      await expect(sub, "the count after the plan's share").toHaveText(new RegExp("^" + left + " due"))
      // every press on the row asks a card still due there, until the row says nothing is due
      for (let guard = 0; left > 0 && guard < 8; guard++) {
        await expect(page.locator("[data-mini-q]:visible"), "a card is open").toHaveCount(1)
        const card = await openCard(page)
        expect(card && !card.today, "the press opens a card that is still owed, never an answered one").toBe(true)
        await expect(page.locator(`${row} [data-master-prog]`), "the figure agrees with the count").toHaveText(`${cut!.due - left}/${cut!.due}`)
        await press(page, `${bar} [data-mini-reveal]`, "Reveal", touch, false)
        await expect(page.locator(`${bar} [data-mini-got]`), "its grade is offered").toBeVisible()
        if (left > 1) {
          await press(page, `${bar} [data-mini-got]`, "Got it", touch, false)
          await expect.poll(() => answeredToday(page, card!), { message: "and the answer is that card's" }).toBe(true)
          left--
          await press(page, "[data-master-list]", "back to the list", touch, false)
          await expect(sub, "the list: what the place still owes").toHaveText(new RegExp("^" + left + " due"))
          await press(page, row, "the row that says it owes", touch)
          continue
        }
        // THE PLACE'S LAST OWED CARD, AND AT ONCE ≡: the list shows, and nothing opens by itself (the walk to the next
        // unfinished deck was still pending, and a card opened from the list 520 ms later)
        const last = await point(`${bar} [data-mini-got]`, "Got it"), list = await point("[data-master-list]", "back to the list")
        await tap(last); await tap(list)
        left--
        await page.waitForTimeout(900)
        await expect(page.locator("[data-master-start]"), "≡ right after a deck's last answer: the list stays, nothing opens by itself").toBeVisible()
        await expect(page.locator("[data-mini-q]:visible"), "no card opened by itself").toHaveCount(0)
        expect(await answeredToday(page, card!), "and the answer was that card's").toBe(true)
      }
      expect(left, "every card the row counted was reached by its press").toBe(0)
      await expect(sub, "the row says nothing is due").not.toHaveText(/\d+ due/)
      await clean(page, "a place the goal cuts")
    })

    // L1-R3, the third read's one fix (2 of 2): "Keep practising" dealt a place that owed three and opened it on the card just
    // answered, Reveal offered, the row reading "3 due · 1/4". The rule (a deck never opens on an answered card while it holds
    // an unanswered one) sat at two callers; it is in the row's own opener now, which every door passes through. One step a door.
    test(`every door into a place opens on a card not yet answered: the button, its row, openMasterAt, ‹ across decks (${touch ? "touch" : "mouse"})`, async ({ page }) => {
      await setup(page)
      await openMaster(page, touch)
      const seat = (await planSeats(page))[0], bar = "[data-master-dock] [data-master-bar]", row = `[data-master-row="${seat}"]`
      const at = () => page.evaluate(() => (window as W).__neural._focusedMini().at() as [number, number])
      await press(page, "[data-master-start]", "the button", touch)
      const first = await openCard(page)
      await press(page, `${bar} [data-mini-reveal]`, "Reveal", touch, false)
      await press(page, `${bar} [data-mini-got]`, "Got it", touch, false)
      await expect.poll(() => answeredToday(page, first!), { message: "premise: the deck's first card is answered" }).toBe(true)
      await expect.poll(async () => (await at())[0], { message: "premise: the deck moved on to its next card" }).toBe(1)
      expect((await at())[1], "premise: a deck of three cards or more").toBeGreaterThanOrEqual(3)
      // the deck is LEFT on its answered card (‹ inside the deck), then each door is taken in turn
      const leaveOnAnswered = async () => {
        // (when the door before opened the answered card itself, the deck is on it already and its ‹ is off: nothing to press,
        // and the next door is still taken, so one run names every door that fails)
        if (!(await openCard(page))!.today) await press(page, `${bar} .mp`, "‹ to the answered card", touch, false)
        expect((await openCard(page))!.today, "premise: the deck is left on a card answered today").toBe(true)
        await press(page, "[data-master-list]", "back to the list", touch, false)
      }
      const owed = async (door: string) => {
        await expect(page.locator("[data-mini-q]:visible"), `${door}: a card is open`).toHaveCount(1)
        const card = await openCard(page)
        // (soft: one run names every door that opens an answered card, not only the first)
        expect.soft(card && !card.today, `${door} opens a card that is not yet answered`).toBe(true)
        expect(await openSeat(page)).toBe(seat)
      }
      await leaveOnAnswered()
      await press(page, "[data-master-start]", "the button", touch)
      await owed("the button")
      await leaveOnAnswered()
      await press(page, row, "the place's row", touch)
      await owed("the row")
      await leaveOnAnswered()
      await page.evaluate((k) => (window as W).__neural.openMasterAt(k), seat)
      await owed("openMasterAt")
      // ‹ across decks: the deck's LAST card answered, then › into the next deck and ‹ back; ‹ enters a deck at its last card,
      // which is answered, so the deck opens on its first card not yet answered instead
      const [, n] = await at()
      for (let i = (await at())[0]; i < n - 1; i++) await press(page, `${bar} .mn`, "›", touch, false)
      await expect.poll(async () => (await at())[0]).toBe(n - 1)
      const last = await openCard(page)
      await press(page, `${bar} [data-mini-reveal]`, "Reveal the last card", touch, false)
      await press(page, `${bar} [data-mini-got]`, "Got it", touch, false)
      await expect.poll(() => answeredToday(page, last!), { message: "premise: the deck's last card is answered" }).toBe(true)
      await page.waitForTimeout(700)   // (the deck is not finished, so the session does not walk on)
      await expect.poll(() => openSeat(page), { message: "premise: still this place" }).toBe(seat)
      const idx = await page.evaluate(() => (window as W).__neural._session.idx)
      for (let i = (await at())[0]; i < n - 1; i++) await press(page, `${bar} .mn`, "› to the deck's end", touch, false)
      await press(page, `${bar} .mn`, "› into the next deck", touch, false)
      await expect.poll(() => page.evaluate(() => (window as W).__neural._session.idx), { message: "premise: the next deck is open" }).toBe(idx + 1)
      await press(page, `${bar} .mp`, "‹ back across", touch, false)
      await expect.poll(() => page.evaluate(() => (window as W).__neural._session.idx)).toBe(idx)
      await owed("‹ across decks")
      await clean(page, "the doors")
    })

    // ...and the door the third read measured: "Keep practising", on a record where the plan takes 1 card of a place that owes 4
    test(`"Keep practising" opens a card that is still owed, on a place the plan took one card of four from (${touch ? "touch" : "mouse"})`, async ({ page }) => {
      test.setTimeout(120_000)
      await setup(page, { settings: { dailyGoal: 10 } })
      await openMaster(page, touch)
      const cut = await page.evaluate(() => {
        const a = (window as W).__neural, s = a._session
        for (const r of s.view.rows) {
          const asked = s.plan.due.concat(s.plan.fresh).filter((x: W) => a._masterSeatOf(s, x.key) === r.seat).reduce((n: number, x: W) => n + (x.owed ? x.owed.length : 0), 0)
          if (r.seat && asked === 1 && r.due > asked) return { seat: r.seat as string, due: r.due as number }
        }
        return null
      })
      expect(cut, "premise: at a goal of 10 the plan takes one card of a place that owes more").not.toBeNull()
      // a fourth card comes due there (the reader's record): the place owes 4, the plan asked 1
      const owes = await page.evaluate(async (seat) => {
        const a = (window as W).__neural, day = a._epochDay()
        await a.hydrateDeck(seat)
        for (const c of a._cardsOf(a.flashcards.decks[seat]) || []) {
          const qh = a.qhash(c.q), n = Object.values(a.srs[seat]).filter((r: W) => r[0] <= day && r[2] < day).length
          if (n >= 4) break
          if (!a.srs[seat][qh]) a.srs[seat][qh] = [day - 20, 7, day - 27]
        }
        a._paintPractice(a._session)
        return Object.values(a.srs[seat]).filter((r: W) => r[0] <= day && r[2] < day).length
      }, cut!.seat)
      expect(owes, "premise: the place owes four").toBe(4)
      await expect(page.locator(`[data-master-row="${cut!.seat}"] small`)).toHaveText(/^4 due/)
      // the day's 10, by the button and the foot
      const bar = "[data-master-dock] [data-master-bar]"
      await press(page, "[data-master-start]", "the button", touch)
      for (let i = 0; i < 10; i++) {
        await expect.poll(async () => { const c = await openCard(page); return !!c && !c.today }, { timeout: 15_000, message: `answer ${i + 1}: a card not yet answered is open` }).toBe(true)
        await press(page, `${bar} [data-mini-reveal]`, "Reveal", touch, false)
        await press(page, `${bar} [data-mini-got]`, "Got it", touch, false)
        await expect.poll(() => page.evaluate(() => (window as W).__neural.practiceToday().done), { message: `answer ${i + 1} counts` }).toBe(i + 1)
      }
      await press(page, "[data-master-list]", "back to the list", touch, false)
      await expect(page.locator(`[data-master-row="${cut!.seat}"] small`), "the place still owes three").toHaveText(/^3 due/)
      await expect(page.locator("[data-master-start] b")).toHaveText("Today's 10 are done")
      await press(page, "[data-master-keep]", "Keep practising", touch)
      await expect(page.locator("[data-mini-q]:visible"), "the next round's first card is open").toHaveCount(1)
      const opened = await page.evaluate(() => {
        const a = (window as W).__neural, s = a._session, k = s.keys[s.idx], day = a._epochDay()
        return { seat: a._masterSeatOf(s, k) as string, answered: Object.values(a.srs[k] || {}).filter((r: W) => r[2] === day).length }
      })
      expect([opened.seat, opened.answered > 0], "premise: the round deals that place first, into the deck that holds the card answered today").toEqual([cut!.seat, true])
      const card = await openCard(page)
      expect(card && !card.today, "Keep practising opens a card that is still owed").toBe(true)
      await expect(page.locator(`[data-master-row="${cut!.seat}"] [data-master-prog]`), "and the figure agrees with the count").toHaveText("1/4")
      await clean(page, "Keep practising")
    })

    // L1-R2, the second reader's "unlisted owing place" (2 of 2), ruled: the list's set is today's plan, the record's places and
    // the places that owe a card. A record from before `explored` was stored holds no place at all, and owes cards all the same.
    test(`a record that stored no places: every place that owes cards has its row, and its press asks them (${touch ? "touch" : "mouse"})`, async ({ page }) => {
      const { fx } = await setup(page, { places: [] })
      await openMaster(page, touch)
      const plan = await planSeats(page)
      const listed = await page.locator("[data-master-row]").evaluateAll((els) => els.map((e) => e.getAttribute("data-master-row")))
      // the record's own debt, counted here from its stored rows (the fixture seeds position decks: a deck is its place)
      const owes = Object.keys(fx.blob.srs).filter((k) => Object.values(fx.blob.srs[k]).some((r: W) => r[0] <= fx.day && r[2] < fx.day))
      expect(owes.length, "premise: the record owes cards at more places than a day reaches").toBeGreaterThan(plan.length)
      for (const k of owes) expect(listed, `${k} owes cards, so it has a row`).toContain(k)
      const owing = await page.locator('[data-master-row][data-master-group="due"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-master-row")!))
      expect(owing.length, "the places the plan does not reach have their rows above the rule, though the record never held them").toBe(owes.length - plan.filter((k) => owes.includes(k)).length)
      await expect(page.locator('[data-master-row][data-master-group="rest"]'), "and no other place: none is stored").toHaveCount(0)
      expect(await page.evaluate(() => [...(window as W).__neural._exploredKeys].length), "nothing was added to the record for it").toBe(0)
      await press(page, `[data-master-row="${owing[0]}"]`, "an owing place the record never held", touch)
      await expect(page.locator("[data-mini-q]:visible"), "its card is open").toHaveCount(1)
      await expect(page.locator(`[data-session-row="${owing[0]}"]`), "asked as due").toHaveAttribute("data-practice-kind", "due")
      await clean(page, "a record with no places")
    })

    // L1-R1, the reader's finding 3, the orchestrator's ruling: the button never opens a finished place; with fewer cards owed
    // than the goal and all of them answered, it deals the next round ("Keep practising"), and says so
    // The plan holds what is left of the day's goal, filled with new cards past what is owed (the reader's two-card record:
    // 2 owed + 18 new, its probe claimB2.js: 16 of 16 left after 4), so answering it meets the goal. It runs out BEFORE the
    // goal when the goal is raised after the plan was dealt: here 18 cards were answered earlier today, the plan holds the 2
    // owed, both are answered (the goal met, 20 of 20), and the goal is then raised to 25 (the Settings field's own key)
    test(`the plan answered before the goal: the button deals the next round, never a finished place (${touch ? "touch" : "mouse"})`, async ({ page }) => {
      await setup(page, { blob: (fx: W) => { const b = twoCards(fx); b.srs["Seed|Top"] = Object.fromEntries(Array.from({ length: 18 }, (_, i) => ["today" + i, [fx.day + 1, 1, fx.day]])); return b } })
      const moved = 18
      await openMaster(page, touch)
      const left = await page.evaluate(() => (window as W).__neural._session.view.rows.reduce((n: number, r: W) => n + (r.due || 0) + (r.fresh || 0), 0))
      expect(left, "premise: the plan holds fewer cards than the goal").toBe(20 - moved)
      await press(page, "[data-master-start]", "the button", touch)
      for (let i = 0; i < left; i++) {
        // (L1-R2, the second reader's point 6: its mutant, the foot's Got it wired to the PREVIOUS card, was caught only by
        // the unnamed poll below; the claim is a step of its own now, read from the card the foot's buttons stand under)
        const card = await openCard(page)
        expect(card && !card.today, "premise: the open card is not answered yet").toBe(true)
        await press(page, "[data-master-bar] [data-mini-reveal]", "Reveal", touch, false)
        await press(page, "[data-master-bar] [data-mini-got]", "Got it", touch, false)
        await expect.poll(() => answeredToday(page, card!), { message: "each Got it in the foot grades the card above it" }).toBe(true)
        await expect.poll(() => page.evaluate(() => (window as W).__neural.practiceToday().done), { message: "and the day counts it once" }).toBe(moved + i + 1)
      }
      expect(await page.evaluate(() => (window as W).__neural.practiceToday()), "premise: the plan answered meets the goal").toEqual({ done: 20, goal: 20 })
      await page.evaluate(() => (window as W).__neural.set("dailyGoal", 25))
      await press(page, "[data-master-list]", "back to the list", touch, false)
      await expect(page.locator("[data-master-start] b"), "nothing left before the goal: the next round").toHaveText("Keep practising")
      await expect(page.locator("[data-master-start] small")).toHaveText("20 answered \u00b7 the next round, worth most first")
      const before = await page.evaluate(() => (window as W).__neural._session.keys.slice())
      await press(page, "[data-master-start]", "Keep practising", touch)
      await expect(page.locator("[data-mini-q]:visible"), "a card of the next round is open").toHaveCount(1)
      const after = await page.evaluate(() => { const s = (window as W).__neural._session; return { keys: s.keys.length, open: s.keys[s.idx] } })
      expect(after.keys, "the next round joined the session").toBeGreaterThan(before.length)
      expect(before, "the open card is the next round's, not a finished place's").not.toContain(after.open)
      await clean(page, "Keep practising")
    })

    // L1-R1, the reader's finding 7: the row's gold number against the marks the map DRAWS on that place's hand (the draw path's
    // own record, `_lastMapMarks`), at five places, landed one after another with the hand framed
    test(`the gold count is the map's: the row's number is the marks the map draws on that place's hand (${touch ? "touch" : "mouse"})`, async ({ page }) => {
      const { j, seeded } = await setup(page, { running: true })
      const places = seeded.slice(0, 5), drawn: Record<string, number> = {}
      await j.advance(12000)   // the root intro finishes before a seat is staged, as landing-card.spec does
      for (const seat of places) {
        // the app's own seat funnel, staged and held there (`rollFromPosition`, as landing-card.spec stages Side Control)
        await page.evaluate((k) => { const a = (window as W).__neural; a.rollFromPosition(a.nodeForKey(k), true, k.endsWith("|Bottom") ? "bottom" : "top") }, seat)
        for (let i = 0; i < 16; i++) {
          await j.advance(1000)
          if (await page.evaluate((k) => { const a = (window as W).__neural, here = a.nodes[a.currentPos]; return (a.optionIdxs || []).length > 0 && a.posFamily(here.t) + "|" + (a.playerRole === "bottom" ? "Bottom" : "Top") === k }, seat)) break
        }
        const at = await page.evaluate((k) => {
          const a = (window as W).__neural, here = a.nodes[a.currentPos]
          a.frameNodes(a.optionIdxs.slice())
          return { seat: a.posFamily(here.t) + "|" + (a.playerRole === "bottom" ? "Bottom" : "Top"), same: (() => { const i = a.nodeForKey(k), d = (a._dealtOpts(i, k.endsWith("|Bottom") ? "bottom" : "top") || []).map((o: W) => o.idx).sort(); return JSON.stringify(d) === JSON.stringify(a.optionIdxs.slice().sort()) })() }
        }, seat)
        expect(at.seat, "premise: landed on the place").toBe(seat)
        expect(at.same, "premise: the hand on the map is the hand the row counts").toBe(true)
        await j.advance(2500)
        // read off the frame the map drew: every orb of the hand on screen (projected as `draw()` projects a mark), then its
        // marks. An orb off the view cannot show its mark, so it fails here BY NAME rather than being counted from the
        // predicate (the orchestrator's L1-R1b, on the reader's 2, 1, 0, 0, 0, 1 drawn against 4, 4, 0, 0, 1, 3)
        const f = await page.evaluate(() => {
          const a = (window as W).__neural, W0 = a.W, H0 = a.H, sc = W0 / a.cam.vw, hand = a.optionIdxs.slice()
          const off = hand.filter((i: number) => { const n = a.nodes[i], x = (n.x - a.cam.cx) * sc + W0 / 2, y = (a._LY(n) - a.cam.cy) * sc + H0 / 2; return x < 0 || x > W0 || y < 0 || y > H0 })
          const marks = new Set((a._lastMapMarks || []).map((m: W) => m.idx))
          return { off: off.map((i: number) => a.nodes[i].t), drawn: hand.filter((i: number) => marks.has(i)).length, names: hand.filter((i: number) => !marks.has(i)).map((i: number) => a.nodes[i].t) }
        })
        expect(f.off, `${seat}: every orb of the hand is on screen, so its mark can be read`).toEqual([])
        drawn[seat] = f.drawn
      }
      expect(Object.values(drawn).filter((n) => n > 0).length, "premise: the map draws gold on the hands").toBeGreaterThan(2)
      await page.evaluate(() => (window as W).__neural.setPaused(true))
      await openMaster(page, touch)
      for (const seat of places) {
        const n = await page.locator(`[data-master-row="${seat}"]`).evaluate((el) => Number(el.querySelector("[data-master-gold]")?.getAttribute("data-master-gold") || 0))
        expect(n, `${seat}: the row's gold number is the marks the map drew on its hand`).toBe(drawn[seat])
      }
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

const twoCards = (fx: W) => {
  const deck = fx.heavy[0], q = Object.keys(fx.blob.srs[deck]).slice(0, 2)
  return { v: 2, srs: { [deck]: Object.fromEntries(q.map((h) => [h, [fx.day, 1, fx.day - 1]])) }, stage: { [deck]: Object.fromEntries(q.map((h) => [h, 0])) } }
}

test.describe("1440x900, mouse: the reader's findings 4 to 6 (L1-R1)", () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  // finding 4 (from code, confirmed by real keys): ≡ closed the place and left its multiple-choice block live, and A, B, C
  // answer any live block that is not the landing's: a card no longer on the screen was graded
  test("≡ leaves no multiple-choice card behind: A answers nothing once its place is closed", async ({ page }) => {
    await setup(page, { blob: twoCards })
    await page.evaluate(() => (window as W).__neural.set("mcMode", "mc"))
    await openMaster(page, false)
    await press(page, "[data-master-start]", "the button", false)
    await expect(page.locator("[data-practice-mc-opt]:visible"), "premise: a multiple-choice card is open").toHaveCount(3, { timeout: 20_000 })
    const before = await page.evaluate(() => JSON.stringify((window as W).__neural.srs))
    await press(page, "[data-master-list]", "back to the list", false, false)
    await expect(page.locator("[data-master-start]")).toBeVisible()
    await page.keyboard.press("a")
    await page.waitForTimeout(800)
    expect(await page.evaluate(() => (window as W).__neural.practiceToday().done), "A answered nothing").toBe(0)
    expect(await page.evaluate(() => JSON.stringify((window as W).__neural.srs)), "nothing was graded").toBe(before)
  })

  // finding 5 (measured): `openMasterAt` from "Everything owed" stayed in the owed session; L3 calls it from inside Master the game
  test("openMasterAt from Everything owed opens today's session, at the place", async ({ page }) => {
    await setup(page)
    await openMaster(page, false)
    await press(page, "[data-practice-details] > summary", "Session details & queue", false)
    await press(page, "[data-practice-owed]", "Everything owed, oldest first", false)
    await expect.poll(() => page.evaluate(() => !!(window as W).__neural._session?.owed), { message: "premise: the owed session is open" }).toBe(true)
    const seat = await page.evaluate(() => { const a = (window as W).__neural, k = a.planSummary().visits[0].seat; a.openMasterAt(k); return k })
    await expect.poll(() => openSeat(page), { timeout: 30_000, message: "the place is open" }).toBe(seat)
    expect(await page.evaluate(() => !!(window as W).__neural._session.owed), "in today's session, not the owed one").toBe(false)
    await expect(page.locator("[data-mini-q]:visible")).toHaveCount(1)
  })

  // L1-R1b, the reader's finding 2 (measured 5 of 5): Esc and ✕ shut the drawer and KEPT the session, so openMasterAt returned
  // with the drawer shut, no card and no beat. L3 calls it from Last rolls. At once, and with the game settled 10 s
  for (const shut of ["Esc", "the drawer's ✕"]) for (const wait of [0, 10_000]) {
    test(`openMasterAt after Master the game was shut by ${shut}, ${wait ? "10 s later" : "at once"}: the place opens, in view`, async ({ page }) => {
      const { j } = await setup(page)
      await openMaster(page, false)
      const seat = (await planSeats(page))[1]
      if (shut === "Esc") await page.keyboard.press("Escape")
      else await press(page, ".ng-explorer-close", "the drawer's ✕", false)
      await expect.poll(() => page.evaluate(() => (window as W).__neural.deckShown), { message: "premise: the drawer is shut" }).toBe(false)
      expect(await page.evaluate(() => !!(window as W).__neural._session), "premise: the session is kept, as the reader measured").toBe(true)
      if (wait) await j.advance(wait)
      await page.evaluate((k) => (window as W).__neural.openMasterAt(k), seat)
      await expect.poll(() => page.evaluate(() => (window as W).__neural.deckShown), { timeout: 30_000, message: "the drawer opens" }).toBe(true)
      await expect(page.locator("[data-mini-q]:visible"), "its first ask is open").toHaveCount(1, { timeout: 30_000 })
      expect(await openSeat(page), "the place asked for").toBe(seat)
      await expect(page.locator(`[data-master-row="${seat}"]`), "its row is marked").toHaveAttribute("data-on", "")
      await expect(page.locator(`[data-master-row="${seat}"]`), "and in view").toBeInViewport()
    })
  }

  // finding 6 (measured, dev v1.287.0 too): an `explored` entry of 42, null or {} stopped the app before it drew
  test("a damaged explored boots, its damaged entries counted with the places no longer on the map", async ({ page }) => {
    const seeded0 = await setup(page, { extra: [42, null, {}] })
    await openMaster(page, false)
    await expect(page.locator("[data-master-note]"), "the lost place and the three damaged entries, counted").toHaveText("4 places you reached are no longer on the map.")
    expect(await page.evaluate(() => [...(window as W).__neural._exploredKeys].every((k: unknown) => typeof k === "string")), "only places are kept").toBe(true)
    // L1-R3 (the orchestrator's ruling, taking back L1-R2's): `explored` holds unique strings and nothing else, for good. The
    // next save writes the strings only, so the record is one every older build reads again (their validators refuse a
    // non-string there: the units with a cloud that holds a record, tests/progress_owner.integration.test.mjs, run them)
    const stored = await page.evaluate(() => {
      const a = (window as W).__neural; a._saveProgress(); a._flushSave()
      const key = Object.keys(localStorage).find((k) => /:progress$/.test(k))
      return key ? JSON.parse(localStorage.getItem(key)!).blob.explored : null
    })
    const places = [...seeded0.fx.heavy, ...seeded0.fx.light, ...seeded0.rest, GONE]
    expect(stored && stored.slice(0, places.length), "the next save writes the places as they were, in their order").toEqual(places)
    expect(stored.filter((k: unknown) => typeof k !== "string" || !k), "and nothing that is not a place's key: the damaged entries are gone from the record").toEqual([])
    expect(new Set(stored).size, "each place once").toBe(stored.length)
  })
})
