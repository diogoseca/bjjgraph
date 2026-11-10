import { expect, test, type Page } from "@playwright/test"
import { journey } from "../dsl"

/**
 * v1.253.0 (owner, 2026-11-09): "the questions when it's a oneliner should appear below the choices row as it does, but it should
 * take as much width as the choices row does ... when the user clicks on the question though, it's true that it should take only one
 * columns width, the left one". In columns (from 1,024px free), under an open Moves row, the asking line is the grid's width (the
 * row shares the grid's box, owner 2026-11-01), and the film starts under it. Opened, the question takes the left column, and the
 * film keeps its place (#346's review, finding 3): the tease's height, kept for that card, drops the opened card's film as much.
 *
 * THE CLAIMS, from the boxes the page emitted:
 *   - asking: the line's card shares the grid's two edges (within 2px), and the film starts below it;
 *   - opened: the card ends in the left column, and the film has moved less than 1.5px.
 * HARNESS: real dossiers are routed, so the seat has a film (the DSL's `{}` carry none). Red-proof is at the foot of this file.
 */

const PATH = "/Positions/Mount/Top"
const box = (page: Page) => page.evaluate(() => {
  const a = (window as any).__neural, q = (e: Element | null | undefined) => { const r = e?.getBoundingClientRect(); return r ? { left: r.left, right: r.right, top: r.top, bottom: r.bottom } : null }
  return { card: q(a._landEl), film: q(a._landFilmEl), grid: q(document.querySelector("[data-reader-body]")), asking: a._landEl?.hasAttribute("data-land-ask"), layout: a._reader.game.dataset.mediaLayout }
})

for (const [width, height] of [[1440, 900], [1100, 900], [1024, 768]] as const) {
  test(`@curated v1.253.0: the one-line tease spans the choices row, and opened takes the left column with the film still (${width}x${height})`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const j = journey(page)
    await j.boot(PATH, { beforeNavigate: async () => { await page.route("**/static/neural/content/*.json", route => route.continue()) } })
    await expect(page.locator('[data-reader][data-reader-ready="true"]')).toBeVisible()
    await expect(page.locator("[data-land-ask-go]")).toBeVisible()
    await j.readerLayoutSettled()
    const ask = await box(page)
    expect(ask, "premise: asking, the film beside it in columns").toMatchObject({ asking: true, layout: "side-by-side" })
    expect(Math.abs(ask.card!.left - ask.grid!.left), `the tease starts on the grid's left edge (${ask.card!.left} / ${ask.grid!.left})`).toBeLessThanOrEqual(2)
    expect(Math.abs(ask.card!.right - ask.grid!.right), `the tease ends on the grid's right edge (${ask.card!.right} / ${ask.grid!.right})`).toBeLessThanOrEqual(2)
    expect(ask.film!.top, "the film starts under the tease").toBeGreaterThanOrEqual(ask.card!.bottom)
    await j.openQuestion()
    const open = await box(page)
    expect(open.asking, "premise: opened").toBe(false)
    expect(open.card!.right, "opened, the question ends in the left column").toBeLessThanOrEqual((open.grid!.left + open.grid!.right) / 2)
    expect(Math.abs(open.film!.top - ask.film!.top), `the film keeps its place as the question opens (${open.film!.top - ask.film!.top}px)`).toBeLessThan(1.5)
  })
}

// Red-proof (v1.253.0, tests/artifacts/article_sections_mutants.mjs on the served reader.js, against a green baseline):
//   tease-column-width ...... the tease back to the column's width ............. killed: the tease ends on the grid's right edge (707 / 1204)
//   tease-drop-lost ......... the film no longer dropped under the tease ........ killed: the film starts under the tease
//   tease-drop-asking-only .. the drop only while asking .......................... killed: the film keeps its place as the question opens (-21.5px)
