import { test, expect, type Page } from "@playwright/test"
import { journey } from "../dsl"

/**
 * SHORT1 (owner, earlier rulings restated 2026-11-11): half of all cards need a scroll for their last answer, and that is
 * accepted; only a question facing you can expire. So reaching for an answer by scrolling must never decline, expire or
 * skip a question the player has taken up, and every answer must be reachable by an ordinary scroll on a short phone
 * (390x631 is the 10th percentile of our visitors' screens; 360x640 and 375x667 ride along).
 *
 * WHAT WAS TRUE BEFORE (measured on a real roll from "/", no harness, by CDP touch, on the preview v1.259.1 and production
 * v1.252.0): a finger reaching from the card or the hand (what lies under the thumb when a card opens) declined nothing at
 * any size. A finger that started on the ARTICLE did: it was reading on touch-down, so a player who scrolled past the card
 * and dragged back from the article toward answers above the top edge lost the question's clock, paused the game and was
 * logged as having ignored it (land_q_declined:reading), since v1.236.0 (U47 d). Now (reader.src.js `readingInteraction`,
 * `reachLeft`; app.src.jsx `_landView`) such a scroll is reaching while the card is on screen and one of its answers is
 * out of view; it is reading, with the old free decline, if it carries the card off the screen, and at once when every
 * answer is already in view (the reading rule, reading-mode.spec.ts, kept).
 *
 * Every gesture is a finger: CDP touchStart/touchMove/touchEnd, held still before the lift so no fling adds distance. The
 * start point is measured and asserted to lie on what the test claims (card, article). The press that answers is a touch
 * tap at a measured centre that elementFromPoint resolves to the answer (CLAUDE.md §6.1, §6.3). The harness serves no
 * dossier chunks, so there is no Videos part: the article follows the card directly here, closer than on the live site.
 *
 * MUTANTS (by hand, on the served bundle, inside the build lock; tests/artifacts/short_phone_mutants.mjs):
 *   reach-off (the article reach never starts)            → red at "a drag from the article back toward the answers is reaching"
 *                                                          and at "the drill keeps its clock"
 *   reach-ignores-view (a reach even with every answer in view) → red at "with every answer in view, a drag from the article is reading"
 *   reach-never-leaves (a reach that carries the card off never becomes reading) → red at "carried off the screen, it is reading"
 *   card-drag-reads (a press on the game counts as reading) → red at "a finger on the card reaches every answer"
 *   card-eats-touch (the card refuses to scroll the reader: touch-action none) → red at "every answer comes into view"
 *   drill-excluded (the seam ignores a catch's drill)      → red at "the drill keeps its clock"
 * NOT PINNED: a wheel (desktop) takes the same path as a touch, with no journey here; article-order.spec.ts pins the wheel
 * over the CARD. A scroll begun on the card that carries it off the screen still lets the question expire there; that is
 * today's rule, reported, not changed (SHORT1 report).
 */

type Any = any
const state = (page: Page) => page.evaluate(() => {
  const a = (window as Any).__neural, q = a._landQ, d = a._decision, R = a._reader, el = a._landEl
  const v = R.root.getBoundingClientRect(), top = Math.max(0, v.top), bot = Math.min(innerHeight, v.bottom)
  const opts = el ? [...el.querySelectorAll("[data-land-q] [data-land-mc-opt], [data-land-q] [data-panic-mc-opt]")] as HTMLElement[] : []
  const c = el ? el.getBoundingClientRect() : null
  return {
    mode: a._landMode || "land", asking: !!a._landAsk, answered: !!q?.answered, remaining: d?.remaining ?? null,
    interacting: !!R.interacting, paused: !!a.paused, top: Math.round(top), bot: Math.round(bot),
    card: c ? { top: Math.round(c.top), bottom: Math.round(c.bottom) } : null,
    answers: opts.map(e => {
      const b = e.getBoundingClientRect(), x = b.left + b.width / 2, y = b.top + b.height / 2
      const at = y > top && y < bot ? document.elementFromPoint(x, y) : null
      return { top: Math.round(b.top), bottom: Math.round(b.bottom), x, y, inView: b.top >= top - 0.5 && b.bottom <= bot + 0.5, hit: !!at && (at === e || e.contains(at)) }
    }),
    declined: (a.beats || []).filter((b: Any) => b.beat === "land_q_declined").map((b: Any) => b.reason || ""),
    expired: (a.beats || []).filter((b: Any) => b.beat === "land_q_expired").length,
    graded: (a.beats || []).filter((b: Any) => b.beat === "land_q_answered").length,
  }
})
/** What a finger landing at (x, y) touches: the question's card, the rest of the game, the article, or the map. */
const under = (page: Page, x: number, y: number) => page.evaluate(([x, y]) => {
  const a = (window as Any).__neural, R = a._reader, el = document.elementFromPoint(x, y)
  if (!el) return "none"
  if (a._landEl && a._landEl.contains(el)) return "card"
  if (R.game.contains(el)) return "game"
  if (R.articleEl && R.articleEl.contains(el)) return "article"
  return R.root.contains(el) ? "reader" : "map"
}, [x, y])
/** A finger drag through CDP: down at (x, y0), dy px UP (negative = down) in 12 moves, held still, then lifted. */
async function finger(page: Page, x: number, y0: number, dy: number) {
  const cdp = await page.context().newCDPSession(page)
  const t = (type: string, y?: number) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: y == null ? [] : [{ x, y }] })
  await t("touchStart", y0)
  for (let i = 1; i <= 12; i++) { await t("touchMove", y0 - (i * dy) / 12); await page.waitForTimeout(16) }
  await page.waitForTimeout(150)
  await t("touchEnd")
  await cdp.detach()
}
/** The lowest point in the centre column, inside the reader's visible box, whose target is `what`. */
async function lowest(page: Page, what: string, from: number, to: number) {
  const x = Math.round((page.viewportSize()!.width) / 2)
  for (let y = from; y > to; y -= 8) if (await under(page, x, y) === what) return { x, y }
  return null
}
async function tap(page: Page, j: Any, x: number, y: number, what: string) {
  await j.readerLayoutSettled()
  const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest("[data-land-ask-go],[data-land-mc-opt],[data-panic-mc-opt]")?.tagName || null, [x, y])
  expect(hit, `${what}: a tap at its centre reaches it`).not.toBeNull()
  await page.touchscreen.tap(x, y)
}
/** A roll's landing on Mount Top, its question taken up the player's way: a tap on Answer for Points where it stands. */
async function arriveAndTakeUp(page: Page) {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await j.readerLayoutSettled()
  // RDR-R2b (covered-card.spec.ts): the harness visitor's first landing can raise a patch notice at the top; put it away as a player would
  if (await page.locator("[data-reward-close]").isVisible()) await j.clickByMouse("[data-reward-close]", "dismiss the harness visitor's patch")
  const go = await page.evaluate(() => { const b = document.querySelector("[data-land-ask-go]")!.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 } })
  await tap(page, j, go.x, go.y, "Answer for Points")
  await expect(page.locator("[data-land-ask-go]")).toHaveCount(0)
  await j.readerLayoutSettled()
  await j.tapGuardSettled()
  const s = await state(page)
  expect([s.asking, s.answered, s.remaining != null && s.remaining > 0], "premise: taken up, open, its clock running").toEqual([false, false, true])
  return j
}
/** Scroll with fingers on the game until the first answer is at least 24 px above the visible top while the card is still on
 *  screen and the article lies under the thumb with room to drag 100 px back down: the player has overshot the answers. */
async function overshoot(page: Page, j: Any) {
  for (let k = 0; k < 8; k++) {
    const s = await state(page)
    const art = await lowest(page, "article", s.bot - 104, s.bot - 260)
    if (s.answers[0].top < s.top - 24 && s.card!.bottom > s.top + 30 && art) return { s, art }
    const from = await lowest(page, "card", s.bot - 12, s.top + 60) || await lowest(page, "game", s.bot - 12, s.top + 60)
    expect(from, "premise: a point on the game part to drag from").not.toBeNull()
    const need = s.answers[0].top - (s.top - 40)
    await finger(page, from!.x, from!.y, Math.max(24, Math.min(need + 16, from!.y - s.top - 20)))
    await j.readerLayoutSettled()
  }
  throw new Error("could not overshoot the answers with the card still on screen")
}

const SIZES = [
  { width: 390, height: 631, tag: "@curated " },
  { width: 360, height: 640, tag: "" },
  { width: 375, height: 667, tag: "" },
]

for (const size of SIZES) test.describe(`${size.width}x${size.height}, by touch`, () => {
  test.use({ viewport: { width: size.width, height: size.height }, hasTouch: true })

  test(`${size.tag}SHORT1: a finger on the card reaches every answer of a taken-up question; nothing declines, the clock runs, the last answer scores (${size.width}x${size.height})`, async ({ page }) => {
    const j = await arriveAndTakeUp(page)
    const open = await state(page)
    expect(open.answers.length, "premise: a multiple-choice question").toBeGreaterThanOrEqual(3)
    expect(open.answers.some(a => !a.inView), `premise: an answer lies below the edge when the card opens (${JSON.stringify(open.answers.map(a => [a.top, a.bottom]))}, view ${open.top}-${open.bot})`).toBe(true)
    const from = await lowest(page, "card", open.bot - 12, open.card!.top)
    expect(from, "premise: the thumb's spot is on the card").not.toBeNull()
    const last = open.answers[open.answers.length - 1]
    await finger(page, from!.x, from!.y, Math.min(from!.y - open.top - 20, last.bottom - open.bot + 40))
    await j.readerLayoutSettled()
    const reached = await state(page)
    expect(reached.answers.map(a => a.inView && a.hit), `every answer comes into view and takes a tap (${JSON.stringify(reached.answers.map(a => [a.top, a.bottom]))})`).toEqual(reached.answers.map(() => true))
    expect([reached.declined, reached.answered, reached.interacting], "a finger on the card declines nothing").toEqual([[], false, false])
    const r0 = reached.remaining!
    await j.advance(1000)
    const later = await state(page)
    expect(later.remaining, "the clock runs").not.toBeNull()
    expect(r0 - later.remaining!, "the clock runs").toBeGreaterThan(800)
    const lastNow = later.answers[later.answers.length - 1]
    await tap(page, j, lastNow.x, lastNow.y, "the last answer")
    await expect.poll(async () => (await state(page)).graded, "the last answer scores").toBe(1)
    expect((await state(page)).declined, "and nothing was declined on the way").toEqual([])
  })
})

test.describe("390x631, by touch, from the article", () => {
  test.use({ viewport: { width: 390, height: 631 }, hasTouch: true })

  test("@curated SHORT1: past the answers, a drag from the article back toward the answers is reaching: nothing declines, the clock runs, an answer scores", async ({ page }) => {
    const j = await arriveAndTakeUp(page)
    const { art } = await overshoot(page, j)
    await finger(page, art.x, art.y, -100)
    await j.readerLayoutSettled()
    const s = await state(page)
    expect([s.declined, s.answered, s.interacting, s.paused], "a drag from the article back toward the answers is reaching, not reading").toEqual([[], false, false, false])
    const r0 = s.remaining!
    expect(r0, "its clock is still armed").toBeGreaterThan(0)
    await j.advance(1000)
    expect(r0 - (await state(page)).remaining!, "and runs").toBeGreaterThan(800)
    const first = (await state(page)).answers[0]
    expect([first.inView, first.hit], `the first answer is back in view (${first.top}-${first.bottom})`).toEqual([true, true])
    await tap(page, j, first.x, first.y, "the first answer")
    await expect.poll(async () => (await state(page)).graded, "the answer scores").toBe(1)
  })

  test("@curated SHORT1 control: with every answer in view, a drag from the article is reading: it declines the question, free, as before", async ({ page }) => {
    const j = await arriveAndTakeUp(page)
    // bring every answer into view with a finger on the card, until the article shows under the thumb
    for (let k = 0; k < 6; k++) {
      const s = await state(page)
      if (s.answers.every(a => a.inView) && await lowest(page, "article", s.bot - 12, s.bot - 80)) break
      const from = (await lowest(page, "card", s.bot - 12, s.top + 60))!
      const room = s.answers[0].top - (s.top + 12)
      await finger(page, from.x, from.y, Math.max(24, Math.min(80, room)))
      await j.readerLayoutSettled()
    }
    const s0 = await state(page)
    expect(s0.answers.every(a => a.inView), "premise: every answer is in view").toBe(true)
    const art = await lowest(page, "article", s0.bot - 12, s0.bot - 80)
    expect(art, "premise: the article is under the thumb").not.toBeNull()
    await finger(page, art!.x, art!.y, 40)
    await j.readerLayoutSettled()
    const s = await state(page)
    expect([s.declined, s.answered, s.interacting, s.remaining], "with every answer in view, a drag from the article is reading").toEqual([["reading"], true, true, null])
    await j.advance(20000)
    expect((await state(page)).expired, "declined free: it never expires").toBe(0)
  })

  test("@curated SHORT1: a reach from the article that carries the card off the screen is reading: declined, free, as a touch on the article was before", async ({ page }) => {
    const j = await arriveAndTakeUp(page)
    const { s: over } = await overshoot(page, j)
    const art = (await lowest(page, "article", over.bot - 12, over.bot - 200))!
    // up, from the article, far enough to take the card's last pixel past the visible top
    await finger(page, art.x, art.y, Math.min(art.y - over.top - 20, over.card!.bottom - over.top + 40))
    await j.readerLayoutSettled()
    const s = await state(page)
    expect(s.card!.bottom, "premise: the card has left the screen").toBeLessThanOrEqual(s.top)
    expect([s.declined, s.answered, s.interacting], "carried off the screen, it is reading").toEqual([["reading"], true, true])
    await j.advance(20000)
    expect((await state(page)).expired, "declined free: it never expires").toBe(0)
  })

  test("@curated SHORT1: the escape drill's card: its answers are on screen, and past them a drag from the article back keeps its clock", async ({ page }) => {
    const j = await arriveAndTakeUp(page)
    // get CAUGHT deterministically — rig every draw that can end the exchange early (CLAUDE.md §6.3)
    const options = await j.optionTitles()
    await j.rig("resolve", [0.99]); await j.rig("outcome", [0.99])
    await j.rig("opp-finish", [0.01]); await j.rig("opp-sub-pick", [0.01])
    await j.pick(options[0])
    await j.advance(3000)
    await j.pick(options[0])
    await j.advanceUntil("caught", 20000)
    await j.readerLayoutSettled()
    if ((await state(page)).asking) {
      const go = await page.evaluate(() => { const b = document.querySelector("[data-land-ask-go]")!.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 } })
      await tap(page, j, go.x, go.y, "Answer for Points on the drill")
      await j.readerLayoutSettled(); await j.tapGuardSettled()
    }
    await j.advance(400) // the drill's window arms on the first game tick after the catch (`_tryArmClock` from `_tickDecision`)
    const drill = await state(page)
    expect([drill.mode, drill.asking, drill.answered, drill.remaining != null], "premise: a catch's drill, taken up, open, timed").toEqual(["defense", false, false, true])
    expect(drill.answers.every(a => a.inView && a.hit), `the drill's answers are on screen when it opens (${JSON.stringify(drill.answers.map(a => [a.top, a.bottom]))})`).toBe(true)
    const { art } = await overshoot(page, j)
    await finger(page, art.x, art.y, -100)
    await j.readerLayoutSettled()
    const s = await state(page)
    expect([s.answered, s.interacting, s.paused], "the drill keeps its clock: no reading, no pause").toEqual([false, false, false])
    const r0 = s.remaining!
    expect(r0, "the drill keeps its clock").toBeGreaterThan(0)
    await j.advance(1000)
    expect(r0 - (await state(page)).remaining!, "the drill keeps its clock: it runs").toBeGreaterThan(800)
  })
})
