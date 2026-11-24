import { expect, test, type Page } from "@playwright/test"
import { journey } from "../dsl"

/** DUE1 (v1.300.4; the orchestrator's DUE1-GO): A CARD NO DECK HOLDS ANY MORE IS NOT DUE. A question a content pass reworded or
 * retired keeps its schedule row for good, and "N due" counted it for ever: half of every card answered before v1.182.2 is
 * in no deck now (reports/mapshows.md, DUE1). `duePool` now skips a row the app KNOWS is retired (`_rowLive` false); a row not
 * known yet stays counted. A deck's live cards are known once the drawer has opened (the rating's live check, `ratingCheck`)
 * or the deck is loaded.
 * The stored record is built from the app's own payload by rule, on a first boot: retired questions are hashes whose 16
 * live bits match none of a real deck's live cards (the rating fixture's rule), plus a row in a deck the manifest does not
 * have; the live card is that deck's own first card. Nothing stored changes: the record is compared after.
 *   · every due row retired: before the drawer has opened the deck's rows are not known yet, so the dot shows (the rule);
 *     once it has, the dot is out with the drawer shut, and Master the game offers no "Everything owed" (dev: lit, "4 cards");
 *   · one live due card among them: "Everything owed, oldest first · 1 card" (dev: "5 cards").
 * MUTANT D1 (`duePool` without `_rowLive`) → red in all three, at "nothing due" and "one card due". No repaint was added:
 * the drawer's dot goes out by its existing paints once the check has landed (a first build repainted it at the landing,
 * and its mutant D2 survived), and Master the game loads the decks it owes, whose own cards then say the rows are gone.
 * Pressed the way a player presses: the mouse at 1440x900, a touch tap at 390x631, at measured points.
 */
type W = any

async function press(page: Page, selector: string, what: string, touch: boolean) {
  const at = await page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement | null
    if (!el) return { ok: false, why: "no element matches", x: 0, y: 0 }
    const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2
    const top = document.elementFromPoint(x, y)
    return { ok: !!top && (top === el || el.contains(top)), why: top ? "<" + top.tagName.toLowerCase() + " " + (top as HTMLElement).className + ">" : "nothing", x, y }
  }, selector)
  expect(at.ok, `${what}: the point under the press is the control (${at.why})`).toBe(true)
  if (touch) await page.touchscreen.tap(at.x, at.y)
  else await page.mouse.click(at.x, at.y)
}

/** the record's parts, read from the app's own payload: a deck its live set lists, three questions it does not hold, and
 *  its first card that is not shared (a live question) */
const parts = (page: Page) => page.evaluate(async () => {
  const a = (window as W).__neural
  for (let i = 0; i < 300 && !(a.flashcards && a.flashcards.decks && a.curriculum); i++) await new Promise((r) => setTimeout(r, 100))
  await a.ratingCheck()
  const L = a._ratingLiveNow()
  if (!L || L.status !== "ok") return { err: "no live set: " + (L && L.status) }
  const shared = a._sharedQ || new Map()
  const D = Object.keys(a.flashcards.decks).filter((k) => k.endsWith("|Attacker") && L.decks.get(k) && L.decks.get(k).size > 2).sort()[0]
  await a.hydrateDeck(D)
  const cards = a._cardsOf(a.flashcards.decks[D]) || []
  const live = cards.map((c: W) => a.qhash(c.q)).find((qh: string) => !shared.has(qh))
  const set = L.decks.get(D), retired: string[] = []
  for (let i = 0; retired.length < 3; i++) { const qh = a.qhash("a card this deck no longer holds " + i); if (!set.has(parseInt(qh, 16) & 0xffff) && !shared.has(qh)) retired.push(qh) }
  return { D, live, retired, day: a._epochDay() }
})

const srsOf = (p: W, withLive: boolean) => {
  const owed = [p.day - 2, 1, p.day - 3], rows: W = {}
  for (const qh of p.retired) rows[qh] = owed
  if (withLive) rows[p.live] = owed
  return { [p.D]: rows, "No Such Deck|Top": { [p.retired[0]]: owed } }
}

const dotShown = (page: Page) => page.evaluate(() => { const d = document.querySelector("[data-drawer-dot]") as HTMLElement | null; return !!d && getComputedStyle(d).display !== "none" })

async function boot(page: Page, withLive: boolean, payloads?: W) {
  const j = journey(page)
  await j.boot("/")
  const p = await parts(page)
  expect(p.err, "premise: the live check landed on the first boot").toBeUndefined()
  expect([!!p.D, !!p.live, p.retired.length], "premise: a deck, its live card, three questions it does not hold").toEqual([true, true, 3])
  const srs = srsOf(p, withLive)
  await j.boot("/", { initialState: { v: 2, srs }, ...(payloads ? { payloads } : {}) })
  await expect.poll(() => page.evaluate(() => { const a = (window as W).__neural; return !!(a && a.flashcards && a.flashcards.decks && a.curriculum) }), { timeout: 60_000 }).toBe(true)
  expect(await page.evaluate(() => (window as W).__neural.practiceToday().done), "premise: the day's goal not met (the dot's other half)").toBe(0)
  return { j, p, srs }
}

async function openDrawerAndRead(page: Page, touch: boolean) {
  await press(page, ".ng-logo", "open the drawer", touch)
  await expect.poll(() => page.evaluate(() => { const L = (window as W).__neural._ratingLiveNow(); return L ? L.status : null }), { timeout: 30_000, message: "the drawer's live check lands" }).toBe("ok")
}

for (const touch of [false, true]) {
  test.describe(touch ? "390x631, touch" : "1440x900, mouse", () => {
    test.use(touch ? { viewport: { width: 390, height: 631 }, hasTouch: true, isMobile: true } : { viewport: { width: 1440, height: 900 } })

    test(`every due row retired: once the drawer has read the deck, the dot is out and "Everything owed" is not offered (${touch ? "touch" : "mouse"})`, async ({ page }) => {
      const { srs } = await boot(page, false)
      // before the drawer has opened, the deck's rows are not known yet: they stay counted (the rule: unknown stays counted);
      // the row in a deck the manifest does not have is known at once
      expect(await page.evaluate(() => (window as W).__neural.dueCount()), "before the live check: the three not known yet").toBe(3)
      await openDrawerAndRead(page, touch)
      expect(await page.evaluate(() => (window as W).__neural.dueCount()), "after it: nothing due").toBe(0)
      await press(page, ".ng-explorer-close", "the drawer's ✕", touch)
      await expect.poll(() => page.evaluate(() => !!(window as W).__neural.deckShown), { message: "the drawer shuts" }).toBe(false)
      expect(await dotShown(page), "the dot is out: nothing can be asked (D1)").toBe(false)
      await press(page, ".ng-logo", "open the drawer again", touch)
      await page.locator('[data-explore-stats] [data-b="due"]').scrollIntoViewIfNeeded()
      await press(page, '[data-explore-stats] [data-b="due"]', "the Master the game row", touch)
      await expect(page.locator("[data-practice-page]"), "premise: Master the game is open").toHaveCount(1)
      await expect(page.locator("[data-practice-owed]"), "premise: its door is drawn").toHaveCount(1)
      expect(await page.locator("[data-practice-owed]").evaluate((el) => (el as HTMLElement).hidden), "\"Everything owed\" is not offered: nothing is owed (D1)").toBe(true)
      expect(await page.evaluate(() => (window as W).__neural.srs), "nothing stored changes").toEqual(srs)
    })
  })
}

test.describe("1440x900, mouse", () => {
  test.use({ viewport: { width: 1440, height: 900 } })
  test(`one live due card among retired rows: "Everything owed" counts that one card`, async ({ page }) => {
    const { srs } = await boot(page, true)
    await openDrawerAndRead(page, false)
    expect(await page.evaluate(() => (window as W).__neural.dueCount()), "one card due (D1)").toBe(1)
    await page.locator('[data-explore-stats] [data-b="due"]').scrollIntoViewIfNeeded()
    await press(page, '[data-explore-stats] [data-b="due"]', "the Master the game row", false)
    await expect(page.locator("[data-practice-page]"), "premise: Master the game is open").toHaveCount(1)
    await expect(page.locator("[data-practice-owed]"), "\"Everything owed\" says the true count (D1)").toHaveText("Everything owed, oldest first \u00b7 1 card")
    expect(await page.locator("[data-practice-owed]").evaluate((el) => (el as HTMLElement).hidden), "and is offered").toBe(false)
    await press(page, ".ng-explorer-close", "the drawer's ✕", false)
    await expect.poll(() => dotShown(page), { message: "the dot shows: one card can be asked" }).toBe(true)
    expect(await page.evaluate(() => (window as W).__neural.srs), "nothing stored changes").toEqual(srs)
  })
})
