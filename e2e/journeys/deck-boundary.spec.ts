import { expect, test, type Page } from "@playwright/test"
import { journey } from "../dsl"

/**
 * v1.253.0 (owner, 2026-11-09): "the right arrow past the last flashcard hides both the question card and the video card".
 * WHY, measured on production v1.252.0 at 1440 and 390: Next was HIDDEN on the last card, so a second press where it had stood
 * fell through to the map, and the map's background tap closes the landing (beats `land_q_declined`, `land_dismissed`): the
 * question card and the film went together. Not a deck-done rule, a fall-through. Now each boundary arrow stays where it was,
 * disabled (`aria-disabled`, dimmed), and the deck's nav is one of `_landSurfaces()`, so the press stops there.
 *
 * THE CLAIMS, by mouse at the point the arrow occupied, on the first card (Previous) and the last (Next):
 *   - the arrow is still there, disabled;
 *   - the press changes nothing: the same card, the question card and the film still shown, and no dismissal beat.
 * HARNESS: the DSL serves `{}` dossiers, which carry no film, so this file routes the real ones (§6.4).
 * Red-proof is at the foot of this file.
 */

const PATH = "/Positions/Mount/Top"

async function boot(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height })
  const j = journey(page)
  await j.boot(PATH, { beforeNavigate: async () => { await page.route("**/static/neural/content/*.json", route => route.continue()) } })
  await expect(page.locator('[data-reader][data-reader-ready="true"]')).toBeVisible()
  await j.openQuestion()
  return j
}

const state = (page: Page) => page.evaluate(() => {
  const a = (window as any).__neural
  const on = (e: Element | null) => !!e && e.isConnected && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden" && !e.closest("[hidden]")
  return { card: on(a._landEl), film: on(a._landFilmEl), page: a._landPage, total: a._landQ ? a._landDeckCards(a._landQ.key).length : 0, beats: (a.beats || []).length }
})
const centre = (page: Page, sel: string) => page.locator(sel).evaluate(e => { const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2] as [number, number] })
const dismissals = (page: Page, from: number) => page.evaluate(n => ((window as any).__neural.beats || []).slice(n).map((b: any) => b.beat)
  .filter((b: string) => b === "land_dismissed" || b === "land_q_declined"), from)

for (const [width, height] of [[1440, 900], [390, 844]] as const) {
  test(`v1.253.0: a press past either end of the deck changes nothing (${width}x${height})`, async ({ page }) => {
    const j = await boot(page, width, height)
    const first = await state(page)
    expect(first, "premise: a deck of several cards, its question card and its film shown").toMatchObject({ card: true, film: true, page: 0 })
    expect(first.total).toBeGreaterThan(1)
    const page1 = async (i: number) => { await page.waitForFunction(i => (window as any).__neural._landPage === i, i); await j.readerLayoutSettled() }
    // Each arrow is measured where it stands one card before its boundary, then pressed there at the boundary, so the press is the
    // claim whether the arrow stayed or not.
    let atNext = await centre(page, "[data-land-next]")
    await j.clickByMouse("[data-land-next]", "Next"); await page1(1)
    const atPrev = await centre(page, "[data-land-prev]")
    await j.clickByMouse("[data-land-prev]", "Previous"); await page1(0)
    const back = await state(page)
    await page.mouse.click(...atPrev); await j.readerLayoutSettled()
    expect(await state(page), "a press where Previous stands on the first card keeps the question card and the film").toMatchObject({ card: true, film: true, page: 0 })
    expect(await dismissals(page, back.beats), "and dismisses nothing").toEqual([])
    await expect(page.locator("[data-land-prev]"), "Previous stays on the first card").toBeVisible()
    await expect(page.locator("[data-land-prev]"), "disabled there").toHaveAttribute("aria-disabled", "true")
    for (let i = 1; i < first.total; i++) {
      atNext = await centre(page, "[data-land-next]")
      await j.clickByMouse("[data-land-next]", "Next"); await page1(i)
    }
    const last = await state(page)
    expect(last, "premise: the last card").toMatchObject({ card: true, film: true, page: first.total - 1 })
    await page.mouse.click(...atNext); await j.readerLayoutSettled()
    expect(await state(page), "a press where Next stands on the last card keeps the question card and the film").toMatchObject({ card: true, film: true, page: first.total - 1 })
    expect(await dismissals(page, last.beats), "and dismisses nothing").toEqual([])
    await expect(page.locator("[data-land-next]"), "Next stays on the last card").toBeVisible()
    await expect(page.locator("[data-land-next]"), "disabled there").toHaveAttribute("aria-disabled", "true")
  })
}

// Red-proof (v1.253.0, tests/artifacts/neural_app_mutants.mjs on the served neural.js, against a green baseline):
//   deck-end-arrow-hidden ... the boundary arrows hidden again ... killed: a press where Previous stands on the first card keeps the question card and the film
