import { expect, test, type Page } from "@playwright/test"
import { journey } from "../dsl"

/**
 * v1.253.0 (owner, 2026-11-09): "when i click a section on the toc/index it should reveal it if it's hidden". U11 (owner) already
 * had the index row reopen a closed section, then go to it (`Reader.link`, `data-section-link`). Checked on production v1.252.0 at
 * 1440 by mouse before any change: every one of Mount Top's 15 rows reopened and scrolled to its section, Moves, Questions and Video
 * included, and Video on Knee Slice Pass too. Nothing reproduced, so this file is the by-mouse spec the brief asked for, not a fix.
 *
 * THE CLAIMS, by mouse: a part closed by its own ✕ (an article tile, Moves, the film), then its index row pressed, is shown again,
 * out of "Hidden sections", and starts at the reader's top (within 12px of it).
 * HARNESS: real dossiers are routed, so the film exists to close. The index shows from 1,350px free (U97 b), so 1440 only.
 * Red-proof is at the foot of this file.
 */

const PATH = "/Positions/Mount/Top"
const CASES: [string, string, string][] = [
  ["aka", '[data-reader-body] > [data-section-type="aka"] [data-section-toggle]', "an article tile, by its ✕"],
  ["hand", "[data-hand-close]", "Moves, by the hand's ✕"],
  ["videos", "[data-film-close]", "the film, by its ✕"],
]

async function boot(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 })
  const j = journey(page)
  await j.boot(PATH, { beforeNavigate: async () => { await page.route("**/static/neural/content/*.json", route => route.continue()) } })
  await expect(page.locator('[data-reader][data-reader-ready="true"]')).toBeVisible()
  await expect(page.locator(".ng-reader-toc"), "premise: the index stands beside the grid at 1440").toBeVisible()
  await j.readerLayoutSettled()
  return j
}

for (const [type, close, what] of CASES) {
  test(`@curated v1.253.0: the index row reveals ${what} and goes to it (1440, by mouse)`, async ({ page }) => {
    const j = await boot(page)
    await page.locator(close).evaluate(e => e.scrollIntoView({ block: "center" })); await j.readerLayoutSettled()
    await j.clickByMouse(close, what)
    await j.readerLayoutSettled()
    const shown = () => page.evaluate(t => {
      const a = (window as any).__neural, r = a._reader
      const el = t === "hand" ? a.optionsRef.current : t === "videos" ? a._landFilmEl : document.querySelector(`[data-reader-body] > [data-section-type="${t}"]`)
      const on = !!el && el.isConnected && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden" && !el.closest("[hidden]")
      return { on, hidden: !!document.querySelector(`.ng-reader-hidden [data-section-type="${t}"]`), top: el ? Math.round(el.getBoundingClientRect().top - r.root.getBoundingClientRect().top) : null }
    }, type)
    expect((await shown()).on, `premise: ${what} is closed`).toBe(false)
    const row = `.ng-reader-toc-row[data-toc-type="${type}"] a`
    await expect(page.locator(row), "its index row stays").toBeVisible()
    await j.clickByMouse(row, "its index row")
    await j.readerLayoutSettled()
    const after = await shown()
    expect(after.on, "the index row shows it again").toBe(true)
    expect(after.hidden, "out of Hidden sections").toBe(false)
    expect(Math.abs(after.top!), `and it starts at the reader's top (${after.top}px)`).toBeLessThanOrEqual(12)
  })
}

// #354's review (finding 1), and very likely the owner's own note 3: a background tap on the map closes THIS landing's card and film
// (v1.134.0) and leaves their preferences on, so the rows read open and did nothing (reproduced on production v1.252.0 at 1440).
// The rows read closed now, and a press brings the landing's card and film back. Entered here by the background tap itself.
const parts = (page: Page) => page.evaluate(() => {
  const a = (window as any).__neural, on = (e: Element | null) => !!e && e.isConnected && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden" && !e.closest("[hidden]")
  return { card: on(a._landEl), film: on(a._landFilmEl) }
})
for (const [type, what] of [["card", "Questions"], ["videos", "Video"]] as const) {
  test(`@curated v1.253.0: after a background tap the ${what} index row brings this landing's card and film back (1440, by mouse)`, async ({ page }) => {
    const j = await boot(page)
    const tap = await page.evaluate(() => { for (const [x, y] of [[1320, 160], [1300, 320], [1380, 640], [1260, 90], [1000, 120]]) { const e = document.elementFromPoint(x, y); if (e?.tagName === "CANVAS") return [x, y] as [number, number] } return null })
    expect(tap, "premise: an empty point on the map").not.toBeNull()
    const before = (await j.beats()).length
    await page.mouse.click(...tap!); await j.readerLayoutSettled()
    expect((await j.beats()).slice(before).map(b => b.beat), "premise: a background tap").toContain("land_dismissed")
    expect(await parts(page), "premise: it took the card and the film away").toEqual({ card: false, film: false })
    const row = page.locator(`.ng-reader-toc-row[data-toc-type="${type}"]`)
    await expect(row, "the row reads closed").toHaveAttribute("data-collapsed", "true")
    await j.clickByMouse(`.ng-reader-toc-row[data-toc-type="${type}"] a`, `the ${what} index row`)
    await j.readerLayoutSettled()
    expect(await parts(page), "the row brings this landing's card and film back").toEqual({ card: true, film: true })
    await expect(row, "and reads open again").toHaveAttribute("data-collapsed", "false")
  })
}

// Red-proof (v1.253.0, tests/artifacts/article_sections_mutants.mjs on the served reader.js, against a green baseline):
//   index-reveal-lost ... the index row no longer reopens its section ... killed: the index row shows it again
