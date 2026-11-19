import { expect, test, type Page } from "@playwright/test"
import { journey } from "../dsl"

/**
 * U110 a (owner, 2026-11-09): "the landcard width isn't harmonized.. it should be as wide as the other containers, and maybe
 * all containers, when stacked on this type of screen (one column but still a bit wide) should have a bit more padding ...
 * to maximize usage width however, not be long ass horizontal lines of text". The rule built: under 1,024px every stacked
 * container (the question, the film, the article grid and its tiles, and the Moves row) is one box, the available
 * width capped at 496px, centred, so all share both edges. 496px is a tile's 468px of text at 600px, 70 characters of the
 * body face at its measured 6.68px each, plus the tile's padding. A phone keeps its own widths, and at 1,024px and up nothing
 * changes (measured against #346's committed reader at 1,024, 1,280 and 1,440: every box identical).
 *
 * THE CLAIMS, from what the page EMITTED (each box read from the DOM, never recomputed):
 *   - at 600, 768, 900 and 1,000px, opened, the stage is stacked and the film, the grid and its first tile share one left edge and
 *     one right edge, 496px apart, centred in the free area, and the Moves row shares them at all four;
 *   - and the question's face is that same box: WIDTH2 (U152 b) keeps U110 a's card here, its arrows tight outside it in the margins
 *     (card-section.spec.ts pins them, and the switch at 600 and 1,024px). Under CARDWIDTH's variant a alone the face stood one 32px
 *     lane in from each edge;
 *   - at 1,024px the stage is side by side and the grid is wider than the cap: the cap ends where the columns begin.
 * HARNESS: the real dossier chunks are served (`route.continue()`), so Side Control Bottom has its real film; the DSL's `{}`
 * would show no film and leave the film's edge unasserted. UNCOVERED: the 70-character measure in the real font (the DSL
 * stubs Google Fonts, so the box is pinned and the characters are not). Red-proof is recorded at the foot of this file.
 */

const PATH = "/Positions/Side-Control/Bottom"

async function opened(page: Page, width: number) {
  await page.setViewportSize({ width, height: 1000 })
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" })
  const j = journey(page)
  await j.boot(PATH, { beforeNavigate: async () => { await page.route("**/static/neural/content/*.json", r => r.continue()) } })
  await expect(page.locator("[data-land-ask-go]")).toBeVisible()
  await expect(page.locator("[data-land-film]"), "the real film is served").toBeVisible()
  await j.readerLayoutSettled()
  await j.clickByMouse("[data-land-ask-go]", "Answer for Points")
  await j.readerLayoutSettled()
  return page.evaluate(() => {
    const a = (window as any).__neural, r = a._reader, edges = (e: Element | null) => {
      if (!e || !e.getClientRects().length) return null
      const q = e.getBoundingClientRect(); return [Math.round(q.left), Math.round(q.right)]
    }
    const tile = ([...r.body.children] as HTMLElement[]).find(c => c.getClientRects().length) || null
    const free = a._paneLayout()
    return { layout: r.game.dataset.mediaLayout, free: [Math.round(free.left), Math.round(free.left + free.width)],
      card: edges(a._landEl), film: edges(a._landFilmEl), grid: edges(r.body), tile: edges(tile), hand: edges(a.optionsRef.current) }
  })
}

for (const width of [600, 768, 900, 1000]) {
  test(`U110 a: stacked at ${width}px, the card, the film and the tiles are one 496px box, centred`, async ({ page }) => {
    const m = await opened(page, width)
    expect(m.layout, "under 1,024px the stage stacks").toBe("stacked")
    const [l, r] = m.film!
    expect(r - l, "the stacked box is capped at 496px").toBe(496)
    expect(Math.abs((l - m.free[0]) - (m.free[1] - r)) <= 1, `centred in the free area ${m.free}: ${l}..${r}`).toBe(true)
    // The hand too, at every width here: from 600 to 640px the app is in its phone mode, and the Moves row still takes the column.
    const shared = { grid: m.grid, tile: m.tile, hand: m.hand }
    for (const [name, e] of Object.entries(shared)) expect(e, `the ${name} shares the film's two edges`).toEqual(m.film)
    // WIDTH2 (U152 b): the question's face is the box too; its arrows stand outside it, in the margins.
    expect(m.card, `the question's face shares the film's two edges (${m.card} in ${l}..${r})`).toEqual(m.film)
    // #346's review, finding 6 (v1.252.1) put the article's own ✕ on the column's edge; v1.253.0 retired that ✕ (U114 a).
  })
}

test("U110 a: at 1,024px the columns begin and the cap ends", async ({ page }) => {
  const m = await opened(page, 1024)
  expect(m.layout, "side by side from 1,024px").toBe("side-by-side")
  expect(m.grid![1] - m.grid![0], "the grid is wider than the stacked cap").toBeGreaterThan(496)
})

// Red-proof (v1.252.0, tests/artifacts/article_sections_mutants.mjs on the served reader.js, each against a green baseline):
//   u110-cap-lost ........... no cap at all, 768px ............. killed: the question is capped at 496px
//   u110-card-uncapped ...... the card's 560px back, 768px ...... killed: the question is capped at 496px (RETIRED v1.263.1 with its
//                             target: CARDWIDTH's open face has no cap of its own, it is the grid's box less its lanes)
//   u110-film-uncapped ...... the film at the full width, 900px . killed: the film shares the question's two edges
//   (v1.263.1, CARDWIDTH: the box is read from the film now, so these claims read "the stacked box is capped at 496px" and "the ...
//   shares the film's two edges"; the rows were re-run against this file, killed again, see docs/Changelog-Archive.md)
//   u110-grid-uncapped ...... the grid at free - 64, 600px ...... killed: the grid shares the question's two edges
//   u110-cap-past-columns ... the cap kept to 1,100px .......... killed: side by side from 1,024px
//   u110-tray-phone-flush ... the row full-width again to 640px . killed: the hand shares the question's two edges (600px) (retargeted v1.253.0, killed again)
//   (u110-close-on-article-edge, v1.252.1, retired with the article's ✕ in v1.253.0)
// At 900px the grid's control fails one step earlier, at "under 1,024px the stage stacks": an uncapped grid is wide enough for
// the columns, which is the cap's other job.
// No surviving controls. NOT COVERED: widths under 600px (#346's review, finding 5). From 528 to 599 the cap already binds the film and
// the asking card (496px) while the open card's section is the phone's Moves row (CARDWIDTH; card-section.spec.ts pins it at 574), so
// they are not one box there and nothing here pins that range; under 528 every box keeps its phone width.
