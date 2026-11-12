import { expect, test, type Page } from "@playwright/test"
import { journey } from "../dsl"

/**
 * #346's review, finding 1 (reproduced at 1440x900 before the fix: the Previous arrow at x 184-228, 40 of its 44px inside the index
 * column, 24-224). From 1,350px free the reader's index stands 12px left of the grid. Until v1.262.10 the open face stood on the grid's
 * left edge with Previous outside it, so beside the index Previous took the right lane, stacked one target above Next.
 * CARDWIDTH (owner, 2026-11-12, v1.263.1) put each arrow INSIDE the card's section, in a 32px lane beside the face, its 44px target
 * reaching 12px past the section's edge: on the left that is exactly the index's 12px clearance. So Previous is back on its own side,
 * and the right-lane rule (`.ng-landnav[data-index]`, and the flag the app set for it) is retired.
 *
 * THE CLAIMS, from the boxes the page emitted, after paging to card 2 and at two scroll positions (the top, and the last answer):
 *   - both deck arrows lie right of the index's box, never over it;
 *   - Previous sits in the face's left lane, Next in its right lane;
 *   - Previous, pressed by mouse where it sits, pages back.
 * card-section.spec.ts pins the lanes themselves at 1440 (and at four narrower sizes). Red-proof is at the foot of this file.
 */

const box = (page: Page, sel: string) => page.locator(sel).first().evaluate(e => {
  const r = e.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }
})

test("@curated #346 review, finding 1: with the index beside the grid, the deck's arrows stay clear of it after paging and scrolling (1440)", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const j = journey(page)
  await j.boot("/Positions/Mount/Top")
  await expect(page.locator(".ng-reader-toc"), "premise: the index stands beside the grid at 1440").toBeVisible()
  await j.openQuestion()
  await j.clickByMouse("[data-land-next]", "page the deck to card 2")
  await j.readerLayoutSettled()
  await expect(page.locator("[data-land-prev]"), "premise: card 2 has a Previous arrow").toBeVisible()
  const second = await page.locator("[data-land-q]").innerText()
  for (const at of ["at the top", "at the last answer"]) {
    if (at === "at the last answer") {
      const below = await page.evaluate(() => {
        const a = (window as any).__neural, opts = a._landEl.querySelectorAll("[data-land-mc-opt]")
        return Math.ceil(opts[opts.length - 1].getBoundingClientRect().bottom - Math.min(a._reader.root.getBoundingClientRect().bottom, innerHeight) + 40)
      })
      const card = await box(page, "[data-landcard]")
      await page.mouse.move((card.left + card.right) / 2, card.top + 20); await page.mouse.wheel(0, Math.max(below, 120)); await j.readerLayoutSettled()
    }
    const toc = await box(page, ".ng-reader-toc"), face = await box(page, "[data-landcard]")
    for (const sel of ["[data-land-prev]", "[data-land-next]"]) {
      const a = await box(page, sel)
      expect(a.left, `${sel} lies right of the index ${at}`).toBeGreaterThanOrEqual(toc.right - 0.5)
      // CARDWIDTH (v1.263.1): each on its own side of the face, abutting it (WAS both past the face's right edge).
      if (sel === "[data-land-prev]") expect(a.right, `${sel} sits in the face's left lane ${at}`).toBeLessThanOrEqual(face.left + 0.5)
      else expect(a.left, `${sel} sits in the face's right lane ${at}`).toBeGreaterThanOrEqual(face.right - 0.5)
    }
  }
  await j.clickByMouse("[data-land-prev]", "Previous, by mouse where it sits")
  await expect.poll(() => page.locator("[data-land-q]").innerText(), { message: "Previous pages back" }).not.toBe(second)
})

// #354's review (finding 5): on a short screen with the index beside the grid, little of the face is in view, and Previous (one target
// above Next) climbed over the choices: 3px of the cards' bottoms at 1440x560, 23px at 1440x520. Its top now stays on the face.
for (const height of [560, 520]) {
  test(`@curated v1.253.0: at 1440x${height}, beside the index, Previous stays on the face and off the choices`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height })
    const j = journey(page)
    await j.boot("/Positions/Mount/Top")
    await expect(page.locator(".ng-reader-toc"), "premise: the index stands beside the grid").toBeVisible()
    await j.openQuestion()
    // Next may sit under the fold on so short a screen, so the deck pages by its own key.
    await page.keyboard.press("ArrowRight")
    await expect.poll(() => page.evaluate(() => (window as any).__neural._landPage), { message: "premise: card 2" }).toBe(1)
    await j.readerLayoutSettled()
    await page.locator("[data-reader]").evaluate(e => { e.scrollTop = 0 }); await j.readerLayoutSettled()
    const m = await page.evaluate(() => {
      const a = (window as any).__neural, face = a._landEl.getBoundingClientRect(), prev = document.querySelector("[data-land-prev]")!.getBoundingClientRect()
      const cards = Math.max(...[...a.optionsRef.current.querySelectorAll("[data-tech]")].map((c: Element) => c.getBoundingClientRect().bottom))
      const root = a._reader.root.getBoundingClientRect()
      return { faceTop: face.top, prevTop: prev.top, cardsBottom: cards, visibleFace: Math.min(face.bottom, root.bottom) - face.top }
    })
    expect(m.visibleFace, "premise: little of the face is in view").toBeLessThan(140)
    expect(m.prevTop, `Previous's top stays on the face (${m.prevTop} / ${m.faceTop})`).toBeGreaterThanOrEqual(m.faceTop - 1)
    expect(m.prevTop, `and off the choices (${m.prevTop} / ${m.cardsBottom})`).toBeGreaterThanOrEqual(m.cardsBottom)
  })
}

// Red-proof (v1.252.1, tests/artifacts/neural_app_mutants.mjs on the served neural.css and neural.js, against a green baseline):
//   deck-prev-home-rule-lost ... the stylesheet rule unmatched ............ killed: [data-land-prev] lies right of the index at the top
//   deck-prev-home-flag-lost ... the app never sets data-index ............ killed: [data-land-prev] lies right of the index at the top
// Both RETIRED in v1.263.1 with their subject (CARDWIDTH: the rule and the flag are gone). Their replacements, same harness, are
// recorded in docs/Changelog-Archive.md (v1.263.1): Previous back outside the face's left edge into the index (its old 8px gap and
// no lane) must turn "lies right of the index" red; the face back on the grid's edge must turn "the face's left lane" red.
