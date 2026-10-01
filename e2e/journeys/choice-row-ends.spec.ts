import { expect, test, type Page } from "@playwright/test"
import { journey } from "../dsl"

/**
 * THE TRAY'S ENDS (v1.213.2). Owner, 2026-10-01: "after scrolling to the rightmost node, there should
 * be some padding at the end, and no darkened fading since we reached the end".
 *
 * TWO DEFECTS, ONE ROW.
 *  - Trailing padding. The template gives the row `padding: 8px 24px`; `clearOptions` wrote
 *    `paddingRight = ""`, which DELETES that inline declaration rather than restoring it (CLAUDE.md
 *    §6.1), and nothing wrote it back once the pane moved left (v1.94.0: `updateUiShift` switched from
 *    paddingRight to paddingLeft). So at desktop widths the last card sat flush against the edge:
 *    measured 0px at 1440. `updateUiShift` now writes both insets from one value, every frame.
 *  - The fade was a constant `mask-image` on both edges, so the last card stayed darkened at the end,
 *    the first at the start, and a hand that fits was faded for nothing. It is now EARNED, the
 *    `.ng-stabs[data-fade]` idiom: `_syncTrayFade` writes `data-fade` ("l", "r", both, or absent)
 *    from the live scroll position, on every `scroll` event — so every writer of `scrollLeft` (the
 *    wheel glide, the drag, its fling, a focus scroll) is covered by the one listener — and when the
 *    hand or the insets change.
 *
 * THE CLAIM, at 1440 and 390: at the left end the first card starts one leading inset in and only
 * the right edge fades; at the right end the last card ends one trailing inset in, that inset EQUALS
 * the measured leading inset, and only the left edge fades; in between both fade; a hand that fits
 * fades on neither side. The fade is read from the COMPUTED mask (its two stop lengths), never from
 * the attribute alone, and each end is reached the way a player reaches it: the mouse wheel to the
 * right end, a mouse drag back into the middle, focus (the keyboard path) back to the left end.
 *
 * A THIRD DEFECT, FOUND BY THIS JOURNEY: the wheel's glide (`_trayGlideBy`) eased by 22% of the gap,
 * and the offset snaps to device pixels, so once that step fell under a pixel it never moved again —
 * the glide stalled 1-2px short of the end (4642 of 4644 at 1440) with its rAF still running, and the
 * right fade could never lift. It now lands on its target.
 *
 * Mutants, recorded 2026-10-01 on the built bundle (one at a time): no `scroll` listener — red at the
 * right end at both widths (the fade stays as dealt); the trailing inset unowned (the old `clearOptions`
 * deletion, no writer) — red at 1440 ("the last card has trailing padding"); the constant mask again —
 * red at the left end and on the fitting hand; the end test off by one (`x <= max`) — red at the right
 * end at both widths; the glide creeping again — red at both widths (the wheel never reaches the end).
 * Non-kill, recorded: at 390 the phone stylesheet's `!important` padding still pads the end, so the
 * unowned-inset mutant survives there; 1440 kills it.
 */

const FADE_PX = 36
const ends = (page: Page) => page.evaluate(() => {
  const row = document.querySelector(".ng-optionrow") as HTMLElement
  const r = row.getBoundingClientRect(), cs = getComputedStyle(row)
  const cards = [...row.querySelectorAll("[data-tech], [data-threat-tech]")].map((c) => c.getBoundingClientRect())
  const mask = (cs as any).webkitMaskImage && (cs as any).webkitMaskImage !== "none" ? (cs as any).webkitMaskImage : cs.maskImage
  const stop = mask && mask !== "none" ? mask.match(/rgb\(0, 0, 0\) ([\d.]+)px/) : null
  const tail = mask && mask !== "none" ? mask.match(/calc\(100% - ([\d.]+)px\)/) : null
  return { x: row.scrollLeft, max: row.scrollWidth - row.clientWidth,
    padL: parseFloat(cs.paddingLeft), padR: parseFloat(cs.paddingRight),
    firstGap: Math.min(...cards.map((b) => b.left)) - r.left, lastGap: r.right - Math.max(...cards.map((b) => b.right)),
    mask, lead: stop ? parseFloat(stop[1]) : 0, trail: tail ? parseFloat(tail[1]) : 0, attr: row.getAttribute("data-fade") }
})

async function settle(page: Page) {
  let last = -1
  await expect.poll(async () => { const x = (await ends(page)).x, same = x === last; last = x; return same },
    { timeout: 10_000, intervals: [120, 120, 200] }).toBe(true)
  return ends(page)
}

for (const [width, height] of [[1440, 900], [390, 844]]) {
  test(`the tray pads its last card and fades only toward hidden cards, wheel, drag and focus, at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const j = journey(page)
    await j.boot("/Positions/Closed-Guard/Bottom")
    await j.advance(4000)
    const start = await settle(page)
    expect(start.max, "closed guard bottom overflows the tray, so both ends exist").toBeGreaterThan(400)
    expect(start.x, "the deal starts at the left end").toBe(0)
    // LEFT END: the first card one leading inset in; only the right side fades
    expect(start.padL, "the row has a leading inset").toBeGreaterThan(0)
    expect(Math.abs(start.firstGap - start.padL), "first card starts one inset in").toBeLessThanOrEqual(1)
    expect([start.lead, start.trail], "at the left end only the right edge fades: " + start.mask).toEqual([0, FADE_PX])

    // RIGHT END, by the mouse wheel (the tray's glide owns the scroll)
    const row = (await page.locator(".ng-optionrow").boundingBox())!
    await page.mouse.move(row.x + row.width / 2, row.y + row.height / 2)
    await expect.poll(async () => { await page.mouse.wheel(0, 2500); return (await ends(page)).x }, { timeout: 30_000 }).toBeGreaterThanOrEqual(start.max - 1)
    const end = await settle(page)
    expect(end.x, "reached the right end").toBeGreaterThanOrEqual(end.max - 1)
    expect(end.lastGap, "the last card has trailing padding").toBeGreaterThan(0)
    expect(Math.abs(end.lastGap - start.firstGap), `trailing inset ${end.lastGap} == leading inset ${start.firstGap}`).toBeLessThanOrEqual(1)
    expect([end.lead, end.trail], "at the right end only the left edge fades: " + end.mask).toEqual([FADE_PX, 0])

    // THE MIDDLE, by a mouse drag (and its fling)
    await page.mouse.move(row.x + row.width * 0.3, row.y + row.height / 2)
    await page.mouse.down()
    for (let i = 1; i <= 8; i++) await page.mouse.move(row.x + row.width * 0.3 + i * 40, row.y + row.height / 2)
    await page.mouse.up()
    const mid = await settle(page)
    expect(mid.x, "the drag moved the tray off the right end").toBeLessThan(mid.max - 1)
    expect(mid.x, "...and not all the way back").toBeGreaterThan(1)
    expect([mid.lead, mid.trail], "in between, both edges fade: " + mid.mask).toEqual([FADE_PX, FADE_PX])

    // LEFT END again, by focus: the keyboard path's native scroll-into-view
    await page.locator('[data-choice-group="you"] [data-choice-execute]').first().focus()
    const back = await settle(page)
    expect(back.x, "focus brought the first card back").toBeLessThanOrEqual(1)
    expect([back.lead, back.trail], "back at the left end the left fade is gone: " + back.mask).toEqual([0, FADE_PX])
  })
}

test("a hand that fits the tray fades on neither side", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1000 })
  const j = journey(page)
  await j.boot("/Submissions/Kimura/from-Mount/Attacker")
  await j.advance(4000)
  const fit = await settle(page)
  expect(fit.max, "precondition: this hand fits a 1920px tray").toBeLessThanOrEqual(0)
  expect(fit.attr, "no fade is earned").toBeNull()
  expect(fit.mask, "and the computed mask is none").toBe("none")
})
