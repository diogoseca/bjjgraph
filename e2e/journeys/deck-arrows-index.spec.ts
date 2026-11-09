import { expect, test, type Page } from "@playwright/test"
import { journey } from "../dsl"

/**
 * #346's review, finding 1 (reproduced at 1440x900 before the fix: the Previous arrow at x 184-228, 40 of its 44px inside the index
 * column, 24-224). From 1,350px free the reader's index stands 12px left of the grid, and the open face stays on the grid's left edge
 * (video-cards.spec.ts pins that), so the deck's Previous arrow has no room on the face's left. While the index is beside the grid it
 * takes the right lane, stacked one target above Next (helmet.html, `.ng-landnav[data-index]`, set by the app from the index's own
 * `hidden`).
 *
 * THE CLAIMS, from the boxes the page emitted, after paging to card 2 and at two scroll positions (the top, and the last answer):
 *   - both deck arrows lie right of the index's box, never over it;
 *   - both sit in the face's right lane, past its right edge;
 *   - Previous, pressed by mouse where it sits, pages back.
 * UNCOVERED: under 1,350px free the Previous arrow keeps its outside-left home in the margin, which no index occupies; this file
 * does not pin that home. Red-proof is at the foot of this file.
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
      expect(a.left, `${sel} lies right of the index ${at}`).toBeGreaterThanOrEqual(toc.right)
      expect(a.left, `${sel} sits in the face's right lane ${at}`).toBeGreaterThanOrEqual(face.right)
    }
  }
  await j.clickByMouse("[data-land-prev]", "Previous, by mouse where it sits")
  await expect.poll(() => page.locator("[data-land-q]").innerText(), { message: "Previous pages back" }).not.toBe(second)
})

// Red-proof (v1.252.1, tests/artifacts/neural_app_mutants.mjs on the served neural.css and neural.js, against a green baseline):
//   deck-prev-home-rule-lost ... the stylesheet rule unmatched ............ killed: [data-land-prev] lies right of the index at the top
//   deck-prev-home-flag-lost ... the app never sets data-index ............ killed: [data-land-prev] lies right of the index at the top
