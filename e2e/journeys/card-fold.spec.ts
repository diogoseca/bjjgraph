import { test, expect, type Page } from "@playwright/test"
import { journey } from "../dsl"

/**
 * FOLD1 (owner, U136 a, 2026-11-11: "Yes: the first ✕ folds it back to the one-line question"). The ✕ on an OPENED card whose
 * question is still open folds it back to its one line, Answer for Points and all (`_landFold`, app.src.jsx). A fold hides nothing,
 * so it raises no b2 message (U131 b2, reader.src.js `notice`). Nothing is declined or graded; the clock parks with what is left
 * and a second take-up resumes that window, never a fresh one (paging's `q.left` rule); the next landing asks with the line again.
 * The ✕ pressed on the line IS b2's hide: its message stands where the line was, with Undo. Undo brings back the one line (the
 * landing's asking state survives the rebuild, and the fold cleared the take-up memory), and the parked window with it
 * (`_landKept`, `_applyLayers`), so ✕-then-Undo cannot buy a fresh window. An answered card hides on the first ✕, as b2 does; every
 * other part's ✕ is b2's and is pinned by hidden-sections.spec.ts.
 *
 * Every press is a player's: a touch tap or a real mouse at a measured centre that elementFromPoint resolves to the control
 * (CLAUDE.md §6.1, §6.3), at 390x844 and 390x631 both ways, and a 1440 run by mouse. b2's message timers are wall-clock, so Undo
 * is pressed while its message still reads phase "on", asserted first.
 *
 * MUTANTS (by hand, on the served neural.js, FOLD1): fold-off (`_landFold` returns false) → red at "the first ✕ folds the opened
 * card to its line"; left-lost (q.left not kept) → red at "what was left is kept"; optin-kept (the take-up memory
 * not cleared) → red at "the next landing asks with the line again"; fold-notice (the fold raises b2's message) → red at "the
 * fold raises no hidden message"; line-refolds (the line folds again) → red at "the second ✕ hides Questions"; answered-folds
 * (an answered card folds) → red at "an answered card hides on the first ✕"; undo-opens (the rebuild opens the card) → red at
 * "Undo brings back the one line"; kept-lost (the parked window not carried through the hide) → red at "and its parked window".
 * NOT PINNED: the fold on a catch's drill (same code path, no journey here).
 */

const SENTENCE = "Questions hidden. You can show it again in Settings."
const NOTICE = '[data-hidesec-notice="card"]'
// The deploy gate (@curated) carries the short phone by touch and 1440 by mouse; the other three runs are the full suite's.
const RUNS = [
  { width: 390, height: 844, touch: true, tag: "" },
  { width: 390, height: 844, touch: false, tag: "" },
  { width: 390, height: 631, touch: true, tag: "@curated " },
  { width: 390, height: 631, touch: false, tag: "" },
  { width: 1440, height: 900, touch: false, tag: "@curated " },
]
const name = (r: { width: number, height: number, touch: boolean }) => `${r.width}x${r.height}, ${r.touch ? "by touch" : "by mouse"}`

const state = (page: Page) => page.evaluate(() => {
  const a = (window as any).__neural, q = a._landQ, d = a._decision
  return {
    card: !!a._landEl, asking: !!a._landEl?.hasAttribute("data-land-ask"), line: !!document.querySelector("[data-land-ask-go]"),
    answered: !!q?.answered, left: q?.left ?? null, remaining: d?.remaining ?? null, total: d?.total ?? null,
    landCard: a.get("landCard", true), folded: (a.beats || []).filter((b: any) => b.beat === "land_q_folded").length,
    declined: (a.beats || []).filter((b: any) => b.beat === "land_q_declined").length,
    notices: document.querySelectorAll("[data-hidesec-notice]").length,
    said: document.querySelector(".ng-sr-only[role=status]")?.textContent || "",
  }
})
const box = (page: Page, sel: string) => page.evaluate(s => {
  const e = [...document.querySelectorAll(s)].find(e => e.getClientRects().length && getComputedStyle(e).visibility !== "hidden")
  if (!e) return null
  const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, top: r.top, height: r.height }
}, sel)
/** A player's press at a control's measured centre: the point must resolve to the control, then a tap or a mouse click. */
async function press(page: Page, j: any, sel: string, touch: boolean, what: string) {
  await j.readerLayoutSettled()
  if (!touch) return j.clickByMouse(sel, what)
  const b = await box(page, sel)
  expect(b, `${what}: on screen`).not.toBeNull()
  const inside = await page.evaluate(([x, y]) => x >= 0 && y >= 0 && x <= innerWidth && y <= innerHeight, [b!.x, b!.y])
  expect(inside, `${what}: its centre is inside the viewport`).toBe(true)
  const hit = await page.evaluate(([x, y, s]) => !!document.elementFromPoint(x as number, y as number)?.closest(s as string), [b!.x, b!.y, sel])
  expect(hit, `${what}: a tap at its centre reaches it`).toBe(true)
  await page.touchscreen.tap(b!.x, b!.y)
}
/** Take the landing's question up with Answer for Points, the player's way. */
async function takeUp(page: Page, j: any, touch: boolean, what = "Answer for Points") {
  await expect(page.locator("[data-land-ask-go]"), `${what}: offered`).toBeVisible()
  await press(page, j, "[data-land-ask-go]", touch, what)
  await expect(page.locator("[data-land-ask-go]")).toHaveCount(0)
  await j.readerLayoutSettled()
  await j.tapGuardSettled()
}
async function arrive(page: Page) {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  const s = await state(page)
  expect([s.card, s.asking], "premise: a fresh landing asks with its line").toEqual([true, true])
  return j
}

for (const run of RUNS) test.describe(name(run), () => {
  test.use({ viewport: { width: run.width, height: run.height }, hasTouch: run.touch })

  test(`${run.tag}FOLD1: the first ✕ folds an opened card to its line, with no message, and its clock resumes (${name(run)})`, async ({ page }) => {
    const j = await arrive(page)
    await takeUp(page, j, run.touch)
    await j.advance(3000)
    const open = await state(page)
    expect([open.asking, open.remaining != null], "taken up: the card is open and its clock runs").toEqual([false, true])
    expect(open.remaining!, "three seconds of the window are spent").toBeLessThan(open.total! - 2500)

    await press(page, j, "[data-land-close]", run.touch, "the opened card's ✕")
    await j.readerLayoutSettled()
    const folded = await state(page)
    expect([folded.card, folded.asking, folded.line, folded.landCard], "the first ✕ folds the opened card to its line").toEqual([true, true, true, true])
    expect([folded.notices, /hidden/.test(folded.said)], "the fold raises no hidden message").toEqual([0, false])
    expect([folded.folded, folded.declined, folded.answered], "folded, not declined, not graded").toEqual([1, 0, false])
    expect(folded.remaining, "the clock is parked").toBeNull()
    expect(Math.abs(folded.left! - open.remaining!), "what was left is kept").toBeLessThan(200)
    await j.advance(3000)
    expect((await state(page)).left, "a parked window does not run").toBe(folded.left)

    await takeUp(page, j, run.touch, "Answer for Points, again")
    const again = await state(page)
    expect(Math.abs(again.remaining! - folded.left!), `a second take-up resumes the window (${again.remaining} of ${again.total}, ${folded.left} kept)`).toBeLessThan(250)
  })

  test(`${run.tag}FOLD1: the second ✕, on the line, hides Questions with its message where the line was; Undo brings back the line and its window (${name(run)})`, async ({ page }) => {
    const j = await arrive(page)
    await takeUp(page, j, run.touch)
    await j.advance(2500)
    await press(page, j, "[data-land-close]", run.touch, "the opened card's ✕")
    await j.readerLayoutSettled()
    const folded = await state(page)
    expect([folded.asking, folded.notices], "premise: folded, no message").toEqual([true, 0])
    const line = await box(page, ".ng-landcard")
    expect(line, "premise: the line is on screen").not.toBeNull()

    await press(page, j, "[data-land-close]", run.touch, "the line's ✕")
    await j.readerLayoutSettled()
    const hid = await state(page)
    expect([hid.card, hid.landCard, hid.notices], "the second ✕ hides Questions with its message").toEqual([false, false, 1])
    const msg = await box(page, NOTICE)
    expect(msg, "its message is on screen").not.toBeNull()
    expect(Math.abs(msg!.top - line!.top), `where the line was (message top ${msg!.top}, line top ${line!.top})`).toBeLessThanOrEqual(16)
    expect(await page.locator(`${NOTICE} .ng-hidesec-line`).textContent(), "b2's sentence").toBe(SENTENCE)
    expect(await page.evaluate(s => (document.querySelector(s) as HTMLElement).dataset.phase, NOTICE), "premise: the message still stands").toBe("on")

    await press(page, j, `${NOTICE} [data-hidesec-undo]`, run.touch, "Undo")
    await j.readerLayoutSettled()
    const back = await state(page)
    expect([back.landCard, back.notices], "Undo turns Questions back on, and its message goes").toEqual([true, 0])
    expect([back.card, back.asking, back.line, back.answered], "Undo brings back the one line, not the opened card").toEqual([true, true, true, false])
    expect(Math.abs(back.left! - folded.left!), "and its parked window").toBeLessThan(200)
    await takeUp(page, j, run.touch, "Answer for Points, after Undo")
    const again = await state(page)
    expect(Math.abs(again.remaining! - folded.left!), `after Undo, a take-up resumes the kept window (${again.remaining} of ${again.total}, ${folded.left} kept)`).toBeLessThan(250)
  })
})

// Not at 390x631: there the opened card runs below the screen (measured on a roll from "/", merged with v1.259.1: the card 514-754
// on a 631-tall screen; the first answer reachable, the second and third below the edge; before v1.259.1 the first resolved to the
// map), so a player scrolls to reach an answer, and that scroll declines a taken-up question (_tickDecision). Both ✕ presses are
// pinned at 390x631 above; the answers' reach is not this PR's.
for (const run of [RUNS[0], RUNS[4]]) test.describe(name(run), () => {
  test.use({ viewport: { width: run.width, height: run.height }, hasTouch: run.touch })
  test(`@curated FOLD1: an answered card hides on the first ✕, with its message (${name(run)})`, async ({ page }) => {
    const j = await arrive(page)
    await takeUp(page, j, run.touch)
    await press(page, j, "[data-land-mc-opt]", run.touch, "an answer")
    await expect.poll(async () => (await state(page)).answered).toBe(true)
    await press(page, j, "[data-land-close]", run.touch, "the answered card's ✕")
    await j.readerLayoutSettled()
    const away = await state(page)
    expect([away.card, away.landCard, away.notices, away.folded], "an answered card hides on the first ✕").toEqual([false, false, 1, 0])
  })
})

test.describe("390x844, by mouse, the next landing", () => {
  test.use({ viewport: { width: 390, height: 844 } })
  test("@curated FOLD1: after a fold the next landing asks with the line again", async ({ page }) => {
    const j = await arrive(page)
    await takeUp(page, j, false)
    await press(page, j, "[data-land-close]", false, "the opened card's ✕")
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
