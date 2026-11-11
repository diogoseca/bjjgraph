import { expect, test, type Page } from "@playwright/test"
import { journey } from "../dsl"

/**
 * WINBAR1 (owner, 2026-11-11, on the dev preview at about 574px): "why isnt the article content flowing all the way down? what's the
 * cut off? ... also the win-lose bar shouldn't show for such screens". The cut-off was `_readerReserve`: the win bar's top plus one 8px
 * gap wherever the bar fell under the reader's grid, 41px on every phone and tablet. "Such screens" is that same test, MEASURED: the
 * reader publishes `barUnder` from the boxes it lays out, the legend's one writer (updateUiShift) puts the bar away there, and the
 * reserve no longer counts the bar at all, because the only place it ever cut is now the place it is away.
 *
 * THE CLAIMS, from the boxes and styles the page emitted, on the owner's node with its real article (the DSL's `{}` dossiers carry no
 * sections, so the content chunks are routed through):
 *   - at 390x844, 390x631 (touch), 574x760 (mouse) and 768x1024 (touch), where the bar's box falls under the grid: the bar is not
 *     visible (computed `visibility`, never opacity alone, CLAUDE.md 6.1), the column's bottom is the viewport's bottom, and the last
 *     section's bottom, scrolled to, is fully in view;
 *   - the control at 1440x900, beside the index, where the bar is clear of the grid: the bar shows and the column is not cut;
 *   - a bar that is away keeps today's number: shown at 1440, put away at 390, a move made there, and back at 1440 it prints the new
 *     decision's number (the suggested card's), not the one it had when it went away.
 * The safe area: Chromium reports env(safe-area-inset-bottom) as 0 and the page declares no viewport-fit=cover, so "the viewport's
 * bottom (or the safe area)" is the viewport's bottom here; the article's end padding carries the term (reading.css).
 * Red-proof is at the foot of this file.
 */

const PATH = "/Positions/Half-Guard/Bottom"
const READY = '[data-reader][data-reader-ready="true"]'
type J = ReturnType<typeof journey>
/** Test mode arms no rAF loop: the legend's writer runs when a frame is pumped. A frame, the reader's layout, a frame for the legend. */
const settle = async (j: J) => { await j.advance(50); await j.readerLayoutSettled(); await j.advance(50) }
const boot = async (page: Page, j: J) => {
  await j.boot(PATH, { beforeNavigate: async () => { await page.route("**/static/neural/content/*.json", route => route.continue()) } })
  await expect(page.locator(READY)).toBeVisible()
  await settle(j)
}
const fold = (page: Page) => page.evaluate(() => {
  const a = (window as any).__neural, root = a._reader.root as HTMLElement, rb = root.getBoundingClientRect()
  const bar = document.querySelector(".ng-winbar") as HTMLElement, b = bar.getBoundingClientRect()
  const grid = document.querySelector("[data-reader-body]")!.getBoundingClientRect()
  const tiles = ([...root.querySelectorAll("[data-reader-body] > *")] as HTMLElement[]).filter(e => e.getClientRects().length)
  const bottoms = tiles.map(e => e.getBoundingClientRect().bottom)
  return { H: innerHeight, rootTop: rb.top, rootBottom: rb.bottom, visibility: getComputedStyle(bar).visibility,
    under: b.left < grid.right && b.right > grid.left, tiles: tiles.length, lastBottom: Math.max(...bottoms),
    atEnd: Math.abs(root.scrollHeight - root.clientHeight - root.scrollTop) < 2 }
})
const toEnd = async (page: Page, j: J) => {
  await page.evaluate(() => { const r = (window as any).__neural._reader.root; r.scrollTop = r.scrollHeight })
  await settle(j)
}

for (const [width, height, touch] of [[390, 844, true], [390, 631, true], [574, 760, false], [768, 1024, true]] as [number, number, boolean][]) {
  test.describe(`${width}x${height}, by ${touch ? "touch" : "mouse"}`, () => {
    test.use({ viewport: { width, height }, hasTouch: touch, isMobile: touch })
    test(`@curated WINBAR1: under the column the win bar is away and the article runs to the bottom edge (${width}x${height})`, async ({ page }) => {
      const j = journey(page)
      await boot(page, j)
      const m = await fold(page)
      expect(m.under, `premise: the win bar's box falls under the grid ${JSON.stringify(m)}`).toBe(true)
      expect(m.tiles, "premise: the real article, several sections").toBeGreaterThanOrEqual(3)
      await expect.poll(async () => (await fold(page)).visibility, { message: "the win bar is not visible (visibility, not opacity)" }).toBe("hidden")
      await expect(page.locator(".ng-winbar"), "and out of the accessibility tree").toBeHidden()
      expect(Math.abs(m.H - m.rootBottom), `the column's bottom is the viewport's bottom ${JSON.stringify(m)}`).toBeLessThanOrEqual(0.5)
      await toEnd(page, j)
      const end = await fold(page)
      expect(end.atEnd, "premise: scrolled to the article's end").toBe(true)
      expect(Math.abs(end.H - end.rootBottom), "still the viewport's bottom at the end").toBeLessThanOrEqual(0.5)
      expect(end.lastBottom, `the last section's bottom is fully in view ${JSON.stringify(end)}`).toBeLessThanOrEqual(Math.min(end.rootBottom, end.H) + 0.5)
      expect(end.lastBottom, "and on screen").toBeGreaterThan(end.rootTop)
    })
  })
}

test.describe("1440x900, by mouse (the control)", () => {
  test.use({ viewport: { width: 1440, height: 900 } })
  test("@curated WINBAR1: beside the index the win bar shows and the column is not cut (1440x900)", async ({ page }) => {
    const j = journey(page)
    await boot(page, j)
    const m = await fold(page)
    expect(m.under, `premise: the bar's box is clear of the grid ${JSON.stringify(m)}`).toBe(false)
    await expect(page.locator(".ng-winbar"), "the win bar shows").toBeVisible()
    expect(m.visibility).toBe("visible")
    expect(Math.abs(m.H - m.rootBottom), `the column is not cut ${JSON.stringify(m)}`).toBeLessThanOrEqual(0.5)
    await toEnd(page, j)
    const end = await fold(page)
    expect(end.lastBottom, "the last section's bottom is fully in view").toBeLessThanOrEqual(Math.min(end.rootBottom, end.H) + 0.5)
  })
})

/** This decision's number, twice: the bar's label and the suggested card's (the root's selected action prints V(s), game-value-live). */
const figures = (page: Page) => page.evaluate(() => {
  const a = (window as any).__neural, own = [...document.querySelectorAll('[data-choice-group="you"] [data-tech]')] as HTMLElement[]
  const best = own.find(c => (c.querySelector("[data-choice-recommended]")?.textContent || "") !== "")
  return { bar: document.querySelector(".ng-winbar [data-legend-win]")!.getAttribute("data-win-chance"), best: best?.querySelector("[data-choice-win]")?.textContent ?? null,
    hand: own.map(c => c.getAttribute("data-tech")).join("|"), all: own.length > 0 && own.every(c => /\d/.test(c.querySelector("[data-choice-win]")?.textContent || "")),
    at: a.nodes[a.currentPos]?.t }
})

test("@curated WINBAR1: a win bar that is away keeps today's number, and a resize that brings it back shows it", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await expect(page.locator(READY)).toBeVisible()
  await settle(j)
  await expect.poll(async () => { const f = await figures(page); return !!f.best && /\d/.test(f.best) && f.bar?.replace(/%/g, "") === f.best }, { message: "premise: the bar shows the first decision's number", timeout: 60_000 }).toBe(true)
  await expect(page.locator(".ng-winbar"), "premise: shown at 1440").toBeVisible()
  const first = await figures(page)
  await page.setViewportSize({ width: 390, height: 844 }); await settle(j)
  await expect(page.locator(".ng-winbar"), "premise: away at 390").toBeHidden()
  // A move that leaves Mount for another position; every draw that could end the exchange early is rigged (CLAUDE.md 6.3).
  await j.rig("resolve", [0]); await j.rig("outcome", Array(32).fill(0)); await j.rig("opp-finish", [0.99])
  const move = await page.evaluate(() => {
    const a = (window as any).__neural, dealt = (a.optionIdxs || []).map((i: number) => a.nodes[i].t)
    return ["Mount to Knee on Belly", "Mount to 3-4 Mount", "Mount to S-Mount"].find(t => dealt.includes(t)) ?? null
  })
  expect(move, "premise: the hand deals a move to another position").toBeTruthy()
  await j.pick(move!)
  await j.nextHand(30000)
  // Waits on the CARDS only: a premise that read the bar would catch a stale bar here, before the claim.
  await expect.poll(async () => { const f = await figures(page); return f.hand !== first.hand && f.all && !!f.best && /\d/.test(f.best) },
    { message: "premise: every card of the new decision has its number while the bar is away", timeout: 60_000 }).toBe(true)
  const second = await figures(page)
  expect(second.best, `premise: the two decisions print different numbers ${JSON.stringify({ first, second })}`).not.toBe(first.best)
  await page.setViewportSize({ width: 1440, height: 900 }); await settle(j)
  await expect(page.locator(".ng-winbar"), "back at 1440 the bar shows").toBeVisible()
  const back = await figures(page)
  expect(back.bar?.replace(/%/g, ""), "and prints the current decision's number, not the one it went away with").toBe(back.best)
  await expect(page.locator(".ng-winbar [data-legend-win]")).toHaveText("Win " + back.bar)
})

// Red-proof (WINBAR1, 2026-11-11, against green baselines of the same test; tests/artifacts/neural_app_mutants.mjs on the served
// neural.js, article_sections_mutants.mjs on a rebuilt reader.js and the served reading.css):
//   winbar-under-shown ........... the legend's writer ignores `barUnder` (574x760) ........ killed: the win bar is not visible
//   winbar-under-unpublished ..... the reader publishes `barUnder = false` (574x760) ....... killed: the win bar is not visible
//   winbar-reserve-bar-back ...... the bar back in `_readerReserve`, its visibility the guard (574x760): the reader lays out before the
//                                  bar's `visibility` turns, and nothing lays it out again, so the 41px stays .. killed: the column's
//                                  bottom is the viewport's bottom
//   winbar-reserve-floor ......... a 41px floor in `_readerReserve` (390x631) ............. killed: the column's bottom is the viewport's bottom
//   winbar-last-section-clipped .. the article clipped at 2,400px (768x1024) .............. killed: the last section's bottom is fully in view
//   winbar-away-everywhere ....... the bar away wherever a column is on screen (1440x900) .. killed: the win bar shows
//   winbar-paint-skips-away ...... `_paintWinThermometer` returns while the bar is away .... killed: and prints the current decision's
//                                  number, not the one it went away with
// Re-run with the change (reader-fold.spec.ts): legend-restore-blank, legend-not-docked, reader-end-double-gap (now killed by "the
// reader runs to the fold") and reader-reserve-shelf-floor, all killed. NOT covered here: a real iPhone's home indicator (Chromium's
// safe-area inset is 0; see the header).
