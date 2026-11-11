import { test, expect, type Page } from "@playwright/test"
import { journey } from "../dsl"

/**
 * CARDGAP1 variant b (owner, 2026-11-11: "i was expecting it to go back into being a question"): the ✕ on an OPENED card whose
 * question is still open folds it back to its one line, Answer for Points and all (`_landFold`, app.src.jsx). Nothing is declined
 * or graded; the clock parks with what is left and a second take-up resumes that window, never a fresh one (paging's `q.left`
 * rule); the next landing asks with the line again. On the line, or once answered, the ✕ puts the card away to its label
 * (variant a's placement, card-close-gap.spec.ts). Every press is by mouse (§6.1: the ✕ sits in a fixed overlay's corner).
 *
 * MUTANTS (by hand): `_landFold` returns false at once → red at "the ✕ folds the opened card to its line"; `q.left` not kept →
 * red at "a second take-up resumes the window"; the opt-in not cleared → red at "the next landing asks with the line".
 */

const state = (page: Page) => page.evaluate(() => {
  const a = (window as any).__neural, q = a._landQ, d = a._decision
  const label = document.getElementById("reader-card")
  return {
    card: !!a._landEl, asking: !!a._landEl?.hasAttribute("data-land-ask"), line: !!document.querySelector("[data-land-ask-go]"),
    answered: !!q?.answered, left: q?.left ?? null, remaining: d?.remaining ?? null, total: d?.total ?? null,
    landCard: a.get("landCard", true), folded: (a.beats || []).filter((b: any) => b.beat === "land_q_folded").length,
    declined: (a.beats || []).filter((b: any) => b.beat === "land_q_declined").length,
    label: !!label && !label.hidden && getComputedStyle(label).display !== "none",
  }
})

test.describe("390x844", () => {
  test.use({ viewport: { width: 390, height: 844 } })
  test("@curated CARDGAP1 b: the ✕ folds an opened card to its line, the clock resumes, and an answered card's ✕ puts it away", async ({ page }) => {
    const j = journey(page)
    await j.boot("/")
    await j.land("Mount Top")
    expect((await state(page)).asking, "a fresh landing asks with its line").toBe(true)
    await j.openQuestion()
    await j.advance(3000)
    const open = await state(page)
    expect([open.asking, open.remaining != null], "taken up: the card is open and its clock runs").toEqual([false, true])
    expect(open.remaining!, "three seconds of the window are spent").toBeLessThan(open.total! - 2500)

    await j.clickByMouse("[data-land-close]", "the opened card's ✕")
    await j.readerLayoutSettled()
    const folded = await state(page)
    expect([folded.card, folded.asking, folded.line, folded.landCard], "the ✕ folds the opened card to its line").toEqual([true, true, true, true])
    expect([folded.folded, folded.declined, folded.answered], "folded, not declined, not graded").toEqual([1, 0, false])
    expect(folded.remaining, "the clock is parked").toBeNull()
    expect(Math.abs(folded.left! - open.remaining!), "what was left is kept").toBeLessThan(200)
    await j.advance(3000)
    expect((await state(page)).left, "a parked window does not run").toBe(folded.left)

    await j.openQuestion()
    const again = await state(page)
    expect(Math.abs(again.remaining! - folded.left!), `a second take-up resumes the window (${again.remaining} of ${again.total}, ${folded.left} kept)`).toBeLessThan(200)

    await j.tapGuardSettled()
    await j.clickByMouse("[data-land-mc-opt]", "an answer")
    await expect.poll(async () => (await state(page)).answered).toBe(true)
    await j.clickByMouse("[data-land-close]", "the answered card's ✕")
    await j.readerLayoutSettled()
    const away = await state(page)
    expect([away.card, away.landCard, away.label], "an answered card's ✕ puts it away to its label").toEqual([false, false, true])
  })

  test("@curated CARDGAP1 b: after a fold the next landing asks with the line again", async ({ page }) => {
    const j = journey(page)
    await j.boot("/")
    await j.land("Mount Top")
    await j.openQuestion()
    await j.clickByMouse("[data-land-close]", "the opened card's ✕")
    await j.readerLayoutSettled()
    expect((await state(page)).asking, "folded").toBe(true)
    const t = await page.evaluate(() => {
      const a = (window as any).__neural
      for (const o of a.optionIdxs || []) { const n = a.nodes[typeof o === "number" ? o : o.idx]; if (n && n.ty === "transitions") return n.t }
      return ""
    })
    expect(t, "a transitions-type option to hop on").not.toBe("")
    await j.rig("resolve", [0.01]); await j.rig("outcome", [0.01])
    await j.pick(t)
    await j.nextHand()
    const next = await state(page)
    expect([next.card, next.asking], "the next landing asks with the line again").toEqual([true, true])
  })
})
