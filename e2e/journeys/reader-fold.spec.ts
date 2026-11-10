import { expect, test, type Page } from "@playwright/test"
import { journey } from "../dsl"

/**
 * v1.253.0 (owner, 2026-11-09): "the article container cuts off its content 10 to 20 px before the fold". MEASURED on production
 * v1.252.0 (Mount Top, scrolled to its end): no clip-path, contain or padding on the reader or its ancestors; the scrollport itself
 * ended early. Its end was `H - _readerShelfBottom() - 8`, and `_readerShelfBottom` never returned under 12, the inset of a shelf that
 * is hidden while the article shows: 20px at 1440x900. Where the win bar falls under the grid (no index), it reserved the bar's top
 * plus 8, then 8 again, with the bar standing 30px up: 72px at 1024x768, 69px at 390x844.
 *
 * THE CLAIMS, from the boxes the page emitted:
 *   - where the win bar falls under the grid (1100, 1024, 390): the legend docks 8px off the bottom, the reader ends one 8px gap above
 *     the bar, and the last tile, scrolled to, ends inside the reader;
 *   - where it does not (1440, beside the index): the legend keeps the template's 30px, and the reader runs to the fold.
 * Red-proof is at the foot of this file.
 */

const PATH = "/Positions/Mount/Top"
const measure = (page: Page) => page.evaluate(() => {
  const a = (window as any).__neural, root = a._reader.root as HTMLElement, rb = root.getBoundingClientRect()
  const bar = document.querySelector(".ng-winbar")!.getBoundingClientRect(), grid = document.querySelector("[data-reader-body]")!.getBoundingClientRect()
  const tiles = [...root.querySelectorAll("[data-reader-body] > *")].filter(e => e.getClientRects().length)
  return { H: innerHeight, rootBottom: rb.bottom, barTop: bar.top, barBottom: bar.bottom, under: bar.left < grid.right && bar.right > grid.left,
    lastBottom: Math.max(...tiles.map(e => e.getBoundingClientRect().bottom)), atEnd: Math.abs(root.scrollHeight - root.clientHeight - root.scrollTop) < 2 }
})

for (const [width, height, under] of [[1440, 900, false], [1100, 900, true], [1024, 768, true], [390, 844, true]] as const) {
  test(`@curated v1.253.0: the article runs to the fold, or to one gap above the win bar under it (${width}x${height})`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const j = journey(page)
    await j.boot(PATH)
    await expect(page.locator('[data-reader][data-reader-ready="true"]')).toBeVisible()
    await j.readerLayoutSettled()
    await page.evaluate(() => { const r = (window as any).__neural._reader.root; r.scrollTop = r.scrollHeight })
    await j.readerLayoutSettled()
    const m = await measure(page)
    expect(m.atEnd, "premise: scrolled to the article's end").toBe(true)
    expect(m.under, `premise: the win bar ${under ? "falls" : "does not fall"} under the grid`).toBe(under)
    if (under) {
      expect(m.H - m.barBottom, "the legend docks 8px off the bottom").toBeCloseTo(8, 0)
      expect(m.barTop - m.rootBottom, "the reader ends one 8px gap above the win bar").toBeCloseTo(8, 0)
    } else {
      expect(m.H - m.barBottom, "the legend keeps the template's 30px").toBeCloseTo(30, 0)
      expect(m.H - m.rootBottom, "the reader runs to the fold").toBeLessThanOrEqual(12)
    }
    expect(m.lastBottom, "the last tile ends inside the reader").toBeLessThanOrEqual(m.rootBottom + 0.5)
  })
}

// Red-proof (v1.253.0, tests/artifacts/article_sections_mutants.mjs on the served reader.js, against a green baseline):
//   legend-restore-blank ... "" for the 30px (deletes the inline declaration) ... killed: the legend keeps the template's 30px
//   legend-not-docked ...... the legend left 30px up under the grid .............. killed: the legend docks 8px off the bottom
//   reader-end-double-gap .. the 8px gap counted twice again ...................... killed: the reader ends one 8px gap above the win bar
