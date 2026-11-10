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

// #354's review, round 7 (finding 1, nit 6): a part's label, index row, aria and Hide/Show text read ONE answer, painted on every layout
// pass: closed by its preference, or taken away with this landing (_landAway). Before, they were written at sync only, so after a
// second tap (free roam) they still read closed with nothing to restore; and a press on a label that reads closed now only ever
// opens. Entered as the review describes: wheel the article (reading), then tap empty map twice.
const emptyMap = (page: Page) => page.evaluate(() => { for (const [x, y] of [[1320, 160], [1100, 140], [1300, 320], [1380, 640], [1000, 120], [1040, 300]]) { if (x > innerWidth) continue; const e = document.elementFromPoint(x, y); if (e?.tagName === "CANVAS") return [x, y] as [number, number] } return null })
const look = (page: Page) => page.evaluate(() => {
  const a = (window as any).__neural, s = a._reader.gameSections.find((g: any) => g.part === "card")
  const vis = (e: Element) => e.getClientRects().length > 0 && !e.closest("[hidden]")
  return { label: vis(s.card), collapsed: s.card.dataset.collapsed, aria: s.toggle.getAttribute("aria-expanded"), text: s.toggle.getAttribute("aria-label"),
    row: document.querySelector('.ng-reader-toc-row[data-toc-type="card"]')?.getAttribute("data-collapsed") ?? null, landCard: a.get("landCard", true),
    off: (a.beats || []).filter((b: any) => b.beat === "land_layer" && b.on === false).length }
})
async function wheelThenTap(page: Page, j: any) {
  const tile = await page.evaluate(() => { const c = [...document.querySelectorAll("[data-reader-body] > .ng-section-card")].map(e => e.getBoundingClientRect()).find(r => r.height > 40 && r.top > 80 && r.top < innerHeight - 60); return c && [c.left + c.width / 2, Math.min(c.top + 30, innerHeight - 30)] as [number, number] })
  await page.mouse.move(...tile!); await page.mouse.wheel(0, 200); await j.readerLayoutSettled()
  expect(await page.evaluate(() => (window as any).__neural._reader.interacting), "premise: reading (the wheel)").toBe(true)
  const tap = await emptyMap(page); expect(tap, "premise: an empty point on the map").not.toBeNull()
  await page.mouse.click(...tap!); await j.readerLayoutSettled()
  return tap!
}
for (const width of [1152, 1440]) {
  test(`@curated v1.253.0: after a background tap the Questions control reads closed, and after a second (free roam) it reads open again (${width}, by mouse)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const j = journey(page)
    await j.boot(PATH, { beforeNavigate: async () => { await page.route("**/static/neural/content/*.json", route => route.continue()) } })
    await expect(page.locator('[data-reader][data-reader-ready="true"]')).toBeVisible(); await j.readerLayoutSettled()
    const tap = await wheelThenTap(page, j)
    const away = await look(page)
    expect(away, "away: the control reads closed, its aria too").toMatchObject({ collapsed: "true", aria: "false", text: "Show Questions" })
    if (width < 1350) expect(away.label, "no index here: the Questions label shows").toBe(true)
    else expect(away.row, "the index row reads closed").toBe("true")
    await page.mouse.click(...tap); await j.advance(300); await j.readerLayoutSettled()
    expect(await page.evaluate(() => !!(window as any).__neural._roam), "premise: the second tap is free roam").toBe(true)
    const roam = await look(page)
    expect(roam, "in free roam nothing can come back: it reads open again, label hidden, the layer still on")
      .toMatchObject({ label: false, collapsed: "false", aria: "true", text: "Hide Questions", landCard: true, off: 0 })
    if (width >= 1350) expect(roam.row, "and the row reads open").toBe("false")
  })
}
test("@curated v1.253.0: a press on a Questions label still reading closed never turns the card layer off (the rule)", async ({ page }) => {
  await page.setViewportSize({ width: 1152, height: 900 })
  const j = journey(page)
  await j.boot(PATH, { beforeNavigate: async () => { await page.route("**/static/neural/content/*.json", route => route.continue()) } })
  await expect(page.locator('[data-reader][data-reader-ready="true"]')).toBeVisible(); await j.readerLayoutSettled()
  await wheelThenTap(page, j)
  expect((await look(page)).label, "premise: the label reads closed and shows").toBe(true)
  // The stale frame, made on purpose: roam begins and the label is pressed before any layout repaints it. A real mouse never lands in
  // that frame now; the rule is what holds if one ever does (round 7's review, finding 1). .click() here is about the handler, not reach.
  const after = await page.evaluate(() => { const a = (window as any).__neural; a._enterRoam(); (document.querySelector('[data-game-open="card"]') as HTMLElement).click(); return { landCard: a.get("landCard", true) } })
  await j.readerLayoutSettled()
  expect(after.landCard, "the card layer stays on").toBe(true)
  expect((await look(page)).off, "and no land_layer turned it off").toBe(0)
})
// Round 7's review (finding 3): a restore from the index row left the reader reading, so the question's clock never armed (and a live
// question would be declined again on the next frame). The owner's rule: the question clock never pauses.
// A played landing, not a URL arrival: a URL arrival is reading intent (_readerIntent), under which the clock never runs at all.
test("@curated v1.253.0: after a row restore the question's clock runs and nothing is declined again (1440, by mouse)", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const j = journey(page)
  await j.boot("/", { beforeNavigate: async () => { await page.route("**/static/neural/content/*.json", route => route.continue()) } })
  await j.land("Mount Top")
  await expect(page.locator('[data-reader][data-reader-ready="true"]')).toBeVisible()
  await expect(page.locator(".ng-reader-toc"), "premise: the index stands beside the grid").toBeVisible()
  await j.readerLayoutSettled()
  await j.openQuestion() // taken up: the clock runs, and later cards in this tab show their question directly (U52 b)
  expect(await page.evaluate(() => (window as any).__neural._decision?.remaining), "premise: the clock runs before the tap").not.toBeNull()
  const tap = await emptyMap(page); await page.mouse.click(...tap!); await j.readerLayoutSettled()
  const before = (await j.beats()).length
  await j.clickByMouse('.ng-reader-toc-row[data-toc-type="card"] a', "the Questions index row")
  await j.readerLayoutSettled()
  expect(await parts(page), "premise: restored").toEqual({ card: true, film: true })
  expect(await page.evaluate(() => (window as any).__neural._reader.interacting), "the restore stops reading").toBe(false)
  // The card mounts inside the press, while reading still held the gate, so its arm is parked (_cwArm) and taken on the next tick.
  await j.advance(200)
  const r0 = await page.evaluate(() => (window as any).__neural._decision?.remaining)
  await j.advance(1500)
  const r1 = await page.evaluate(() => (window as any).__neural._decision?.remaining)
  expect(r0, "the restored question's clock is armed").not.toBeNull()
  expect(r1, "and it runs").toBeLessThan(r0)
  expect((await j.beats()).slice(before).filter(b => b.beat === "land_q_declined"), "nothing is declined again").toEqual([])
})

// Red-proof (v1.253.0, tests/artifacts/article_sections_mutants.mjs on the served reader.js, against a green baseline):
//   index-reveal-lost ... the index row no longer reopens its section ... killed: the index row shows it again
