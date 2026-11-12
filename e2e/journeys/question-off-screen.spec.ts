import { test, expect, type Page } from "@playwright/test"
import { journey } from "../dsl"

/**
 * SHORT4 (owner, U146 a, 2026-11-12: "One rule, however the scroll began: a question you can no longer see is put down without a
 * miss. The same thing a scroll on the article already does."). A taken-up, still open question whose card has wholly left the
 * reader's visible box (0 px of overlap, half a pixel of tolerance) is declined, free, at that moment: `land_q_declined` with reason
 * "off_screen", no "too slow", no miss (`_offTick`, app.src.jsx, every frame). Until v1.262.12 a scroll begun on the card or the
 * moves carried the card off with its clock running, and the question expired out of sight as a miss (measured at 390x631 on the
 * preview v1.259.1 and production v1.252.0). What still holds: a card partly off screen is untouched; reaching for an answer never
 * declines (short-phone-answers.spec.ts); with every answer in view a scroll on the article is reading and declines at once; the
 * escape drill shares the check; coming back resurrects nothing; the app's own scroll to the top at a new landing never declines
 * the question it brings.
 *
 * Every gesture is a player's: a CDP finger drag held still before the lift at 390x631, a mouse wheel at a measured point at 1440,
 * each start point asserted to lie on what the test claims. The harness serves no dossier chunks, so there is no Videos part: the
 * article follows the card directly.
 *
 * WHAT CANNOT BE PINNED HERE, measured: a landing card carried off FROM THE MOVES. On a phone the moves sit above the card, so a
 * drag begun on them runs out before the card leaves unless the finger flicks, and headless Chromium gives a CDP touch no momentum
 * (a flick stopped dead at 265 px; `Input.synthesizeScrollGesture` did not scroll the reader at all). At 1440 the moves row turns a
 * vertical wheel into its own horizontal scroll, so a wheel there never moves the reader. The rule reads only the card's rect, never
 * where the scroll began; the drill journey below carries its card off from ITS moves, which sit below it (D-433).
 *
 * MUTANTS (tests/artifacts/question_off_screen_mutants.mjs, on the served bundle, inside the lock, a kill only at the named claim):
 *   off-never-declines (`_offTick` does nothing)      → red at "carried off from the card, it is put down free" (and 1440, the drill)
 *   half-off-declines (`on` means wholly in view)     → red at "partly off screen, it is untouched"
 *   park-not-decline (the clock stops, the question stays live) → red at "coming back does not resurrect it"
 *   drill-excluded (the check skips a catch's drill)   → red at "the drill is put down free"
 *   reach-ignores-view (a scroll on the article is a reach even with every answer in view) → red at "the reading rule"
 *   skip-counts-as-seen (a frame with no height marks the card seen) → red at "a frame that cannot see the card never counts it as seen"
 *   seen-guard-off (a card never yet on screen can be declined) → SURVIVES: a recorded NON-KILL, not coverage. The reader returns to
 *   the top synchronously at the start of `open()`, so no judging frame falls between a new landing's mount and the reset here. The
 *   guard stays (it is what "has left" means); the new-landing journey pins the claim against any order that would break it.
 */

type Any = any
const state = (page: Page) => page.evaluate(() => {
  const a = (window as Any).__neural, q = a._landQ, d = a._decision, R = a._reader, el = a._landEl
  const v = R.root.getBoundingClientRect(), top = Math.max(0, v.top), bot = Math.min(innerHeight, v.bottom)
  const c = el ? el.getBoundingClientRect() : null
  return {
    mode: a._landMode || "land", key: q?.key || null, asking: !!a._landAsk, answered: !!q?.answered, remaining: d?.remaining ?? null,
    top: Math.round(top), bot: Math.round(bot), card: c ? { top: Math.round(c.top), bottom: Math.round(c.bottom), left: Math.round(c.left), right: Math.round(c.right) } : null,
    declined: (a.beats || []).filter((b: Any) => b.beat === "land_q_declined").map((b: Any) => b.reason || ""),
    declinedKeys: (a.beats || []).filter((b: Any) => b.beat === "land_q_declined").map((b: Any) => b.deckKey || ""),
    expired: (a.beats || []).filter((b: Any) => b.beat === "land_q_expired").length,
    takenUp: (a.beats || []).filter((b: Any) => b.beat === "land_q_taken_up").length,
  }
})
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
/** The lowest point of column x, inside [to, from], whose target is `what`. */
async function lowest(page: Page, what: string, from: number, to: number, x?: number) {
  const cx = x ?? Math.round(page.viewportSize()!.width / 2)
  for (let y = from; y > to; y -= 8) if (await under(page, cx, y) === what) return { x: cx, y }
  return null
}
async function settle(page: Page, j: Any) {
  let last = -1
  for (let i = 0; i < 40; i++) {
    const now = await page.evaluate(() => (window as Any).__neural._reader.root.scrollTop)
    if (now === last) break
    last = now; await page.waitForTimeout(60)
  }
  await j.readerLayoutSettled()
}
async function arrive(page: Page, touch: boolean) {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await j.readerLayoutSettled()
  // RDR-R2b (covered-card.spec.ts): the harness visitor's first landing can raise a patch notice at the top; put it away as a player would
  if (await page.locator("[data-reward-close]").isVisible()) await j.clickByMouse("[data-reward-close]", "dismiss the harness visitor's patch")
  if (touch) {
    const go = await page.evaluate(() => { const b = document.querySelector("[data-land-ask-go]")!.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 } })
    expect(await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest("[data-land-ask-go]"), [go.x, go.y]), "Answer for Points takes a tap").toBe(true)
    await page.touchscreen.tap(go.x, go.y)
  } else await j.clickByMouse("[data-land-ask-go]", "Answer for Points")
  await expect(page.locator("[data-land-ask-go]")).toHaveCount(0)
  await j.readerLayoutSettled()
  await j.tapGuardSettled()
  const s = await state(page)
  expect([s.asking, s.answered, s.remaining != null && s.remaining > 0], "premise: taken up, open, its clock running").toEqual([false, false, true])
  return j
}
/** Fingers on `from` ("card" or "game") until the card's bottom is at or above the reader's visible top. */
async function carryOff(page: Page, j: Any, from: "card" | "game") {
  for (let k = 0; k < 6; k++) {
    const s = await state(page)
    if (s.card!.bottom <= s.top) return
    const p = await lowest(page, from, s.bot - 10, s.top + 6)
    expect(p, `premise: a point on the ${from} to drag from`).not.toBeNull()
    // a thumb may carry on past the reader's top edge: the scroll is the gesture's, wherever the finger ends
    await finger(page, p!.x, p!.y, Math.max(24, Math.min(p!.y - 4, s.card!.bottom - s.top + 40)))
    await settle(page, j)
  }
  throw new Error("could not carry the card off the screen")
}

test.describe("390x631, by touch", () => {
  test.use({ viewport: { width: 390, height: 631 }, hasTouch: true })

  test("SHORT4: carried off from the card, a taken-up question is put down free, and coming back does not resurrect it", async ({ page }) => {
    const j = await arrive(page, true)
    await carryOff(page, j, "card")
    await j.advance(100) // the next frame judges it (`_offTick`)
    const off = await state(page)
    expect(off.card!.bottom, "premise: the card has wholly left the screen").toBeLessThanOrEqual(off.top)
    expect([off.declined, off.answered, off.remaining], "carried off from the card, it is put down free").toEqual([["off_screen"], true, null])
    // back, by a finger on the article (now under the thumb), until the card is on screen again
    for (let k = 0; k < 4 && (await state(page)).card!.top < (await state(page)).top + 40; k++) {
      const s = await state(page), p = await lowest(page, "article", s.top + 300, s.top + 20)
      expect(p, "premise: a point on the article to drag back from").not.toBeNull()
      await finger(page, p!.x, p!.y, -Math.min(300, s.bot - p!.y - 4))
      await settle(page, j)
    }
    await j.advance(20000)
    const back = await state(page)
    expect(back.card!.top, "premise: the card is back on screen").toBeGreaterThan(back.top)
    expect([back.answered, back.remaining, back.expired, back.takenUp, back.declined], "coming back does not resurrect it").toEqual([true, null, 0, 1, ["off_screen"]])
  })

  test("SHORT4: partly off screen, a taken-up question is untouched: no decline, its clock runs", async ({ page }) => {
    const j = await arrive(page, true)
    for (let k = 0; k < 6; k++) {
      const s = await state(page)
      if (s.card!.top < s.top - 60) break
      const p = (await lowest(page, "card", s.bot - 10, s.top + 6))!
      await finger(page, p.x, p.y, Math.max(24, Math.min(p.y - s.top - 10, s.card!.top - (s.top - 90))))
      await settle(page, j)
    }
    const half = await state(page)
    expect([half.card!.top < half.top - 60, half.card!.bottom > half.top + 60], `premise: the card is partly above the top edge (${half.card!.top}-${half.card!.bottom}, view from ${half.top})`).toEqual([true, true])
    const r0 = half.remaining!
    await j.advance(1000)
    const s = await state(page)
    expect([s.declined, s.answered], "partly off screen, it is untouched").toEqual([[], false])
    expect(r0 - s.remaining!, "and its clock runs").toBeGreaterThan(800)
  })

  test("SHORT4: the escape drill is put down free when its own moves carry its card off, and never runs out unseen", async ({ page }) => {
    const j = await arrive(page, true)
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
      await page.touchscreen.tap(go.x, go.y)
      await j.readerLayoutSettled(); await j.tapGuardSettled()
    }
    await j.advance(400) // the drill's window arms on the first game tick after the catch
    const drill = await state(page)
    expect([drill.mode, drill.asking, drill.answered, drill.remaining != null], "premise: a catch's drill, taken up, open, timed").toEqual(["defense", false, false, true])
    const below = await lowest(page, "game", drill.bot - 10, drill.card!.bottom + 4)
    expect(below, "premise: the drill's escape moves lie below its card").not.toBeNull()
    await carryOff(page, j, "game")
    await j.advance(100)
    const off = await state(page)
    expect(off.card!.bottom, "premise: the drill card has wholly left the screen").toBeLessThanOrEqual(off.top)
    expect(off.remaining, "the drill is put down free: its clock stops").toBeNull()
    await j.advance(20000)
    expect((await state(page)).expired, "the drill is put down free: it never runs out unseen").toBe(0)
  })

  // SHORT5 (review of #389): a frame that cannot see the card (no height: not laid out) judges nothing, so it never marks the card
  // as having been on screen. The harness cannot raise a real zero-height frame on demand, so the sequence is built by hand on a
  // taken-up question: its seen mark cleared (the state of a card shown open on arrival, U52 b, before any frame has judged it), one
  // frame with the card at display:none, then the card laid out again wholly above the visible box in one task. No frame ever saw it.
  test("SHORT5: a frame that cannot see the card never counts it as seen, so laid out off screen afterwards it is not put down", async ({ page }) => {
    const j = await arrive(page, true)
    await page.evaluate(() => { const a = (window as Any).__neural; a._landQ.seen = false; a._landEl.style.display = "none" })
    await j.advance(100)
    expect(await page.evaluate(() => (window as Any).__neural._landEl.getBoundingClientRect().height), "premise: one frame with no height").toBe(0)
    const off = await page.evaluate(() => {
      const a = (window as Any).__neural, el = a._landEl, root = a._reader.root
      el.style.display = ""
      const r = el.getBoundingClientRect(), v = root.getBoundingClientRect()
      root.scrollTop += r.bottom - Math.max(0, v.top) + 40
      const r2 = el.getBoundingClientRect()
      return { bottom: Math.round(r2.bottom), top: Math.round(Math.max(0, v.top)), height: r2.height }
    })
    expect(off.height > 0 && off.bottom <= off.top, `premise: laid out again, wholly above the visible box (bottom ${off.bottom}, top ${off.top})`).toBe(true)
    await j.advance(100)
    const s = await state(page)
    expect([s.declined, s.answered], "a frame that cannot see the card never counts it as seen").toEqual([[], false])
  })

  // NOTE (seen-guard-off, a recorded non-kill): `q.seen` keeps a card that mounts below a scrolled reader, a frame before the app
  // scrolls it to the top, from being declined. Its mutant survives: the reset runs before the first judging frame in this harness.
  // This journey still pins the claim against any order that would decline the question a landing brings.
  test("SHORT4: a new landing reached with the reader scrolled far down does not decline the question it brings", async ({ page }) => {
    const j = await arrive(page, true)
    const s0 = await state(page)
    const a0 = await page.evaluate(() => { const b = document.querySelector("[data-land-mc-opt]")!.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 } })
    expect(a0.y, "premise: the first answer is on screen").toBeLessThan(s0.bot)
    await page.touchscreen.tap(a0.x, a0.y)
    await expect.poll(async () => (await state(page)).answered, "premise: the first question is answered").toBe(true)
    const t = await page.evaluate(() => {
      const a = (window as Any).__neural
      for (const o of a.optionIdxs || []) { const n = a.nodes[typeof o === "number" ? o : o.idx]; if (n && n.ty === "transitions") return n.t }
      return ""
    })
    expect(t, "premise: a transitions-type option to move on").not.toBe("")
    await j.rig("resolve", [0.01]); await j.rig("outcome", [0.01])
    await j.pick(t)
    // A press on the article is reading and pauses the game, so the next landing would never come: the setup scrolls the reader
    // itself. This journey's subject is the app's own scroll at the landing, not how the reader got far down.
    await page.evaluate(() => { const r = (window as Any).__neural._reader.root; r.scrollTop = Math.min(r.scrollHeight - r.clientHeight, 2400) })
    const away = await page.evaluate(() => (window as Any).__neural._reader.root.scrollTop)
    expect(away, "premise: the reader is scrolled far down before the next landing").toBeGreaterThan(600)
    const key0 = s0.key
    await j.nextHand()
    await j.readerLayoutSettled()
    await j.advance(1000)
    const s = await state(page)
    expect([s.key !== key0, s.asking], "premise: a new question, shown open (taken up once in this tab, U52 b)").toEqual([true, false])
    expect([s.declinedKeys.includes(s.key!), s.answered], "the new landing does not decline the question it brings").toEqual([false, false])
    expect(s.card!.bottom > s.top && s.card!.top < s.bot, "and its card is on screen").toBe(true)
  })
})

test.describe("1440x900, by wheel", () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test("SHORT4: carried off by the wheel over the card, a taken-up question is put down free", async ({ page }) => {
    const j = await arrive(page, false)
    for (let k = 0; k < 12; k++) {
      const s = await state(page)
      if (s.card!.bottom <= s.top) break
      const x = Math.round((s.card!.left + s.card!.right) / 2), y = Math.max(s.card!.top, s.top) + 12
      expect(await under(page, x, y), "premise: the wheel turns over the card").toBe("card")
      await page.mouse.move(x, y)
      await page.mouse.wheel(0, Math.min(300, s.card!.bottom - s.top + 40))
      await settle(page, j)
    }
    await j.advance(100)
    const off = await state(page)
    expect(off.card!.bottom, "premise: the card has wholly left the screen").toBeLessThanOrEqual(off.top)
    expect([off.declined, off.answered, off.remaining], "carried off by the wheel, it is put down free").toEqual([["off_screen"], true, null])
    await j.advance(20000)
    expect((await state(page)).expired, "and it never runs out unseen").toBe(0)
  })

  test("SHORT4: the reading rule holds: with every answer in view, a wheel over the article declines at once, free", async ({ page }) => {
    const j = await arrive(page, false)
    let s0 = await state(page), p: { x: number, y: number } | null = null
    for (let k = 0; k < 6; k++) { // the article can start just below the fold: bring a strip of it up with the wheel over the card
      p = await lowest(page, "article", s0.bot - 4, s0.card!.bottom, Math.round((s0.card!.left + s0.card!.right) / 2))
      if (p) break
      const x = Math.round((s0.card!.left + s0.card!.right) / 2), y = Math.max(s0.card!.top, s0.top) + 12
      expect(await under(page, x, y), "premise: the wheel turns over the card").toBe("card")
      await page.mouse.move(x, y); await page.mouse.wheel(0, 40); await settle(page, j)
      s0 = await state(page)
    }
    expect(p, "premise: the article is under the pointer below the card").not.toBeNull()
    expect(await page.evaluate(() => {
      const a = (window as Any).__neural, el = a._landEl, R = a._reader.root.getBoundingClientRect()
      return [...el.querySelectorAll("[data-land-mc-opt]")].every((b: Any) => { const r = b.getBoundingClientRect(); return r.top >= Math.max(0, R.top) - 0.5 && r.bottom <= Math.min(innerHeight, R.bottom) + 0.5 })
    }), "premise: every answer is in view").toBe(true)
    await page.mouse.move(p!.x, p!.y)
    await page.mouse.wheel(0, 120)
    await settle(page, j)
    const s = await state(page)
    expect([s.declined, s.answered, s.card!.bottom > s.top], "the reading rule: declined at once, free, with the card still on screen").toEqual([["reading"], true, true])
    await j.advance(20000)
    expect((await state(page)).expired, "never a miss").toBe(0)
  })
})
