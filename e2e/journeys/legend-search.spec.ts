import { expect, test, type Page } from "@playwright/test"
import { journey } from "../dsl"

/**
 * v1.254.0 (owner, 2026-11-10), three notes on the dev preview:
 *  1. "Position, Transition, and Submission should be hidden when we go into a specific node. They should only be revealed at the
 *     beginning, like when ... a node or an article has not yet been selected and revealed." The win bar stays.
 *  2. "The table of contents/index is way more important than the legend": where the win bar meets the index or comes close to
 *     its last rows, the bar goes; it comes back when there is room.
 *  3. "A search icon on the right of the dashboard, next to the open drawer icon."
 *
 * THE CLAIMS, by mouse and by touch:
 *  - the key shows on the map alone, and is hidden (visibility, out of the accessibility tree) while a node's card, film or article
 *    is on screen. Free roam closes the card and the film but keeps the article, so the key stays away there (`_mapAlone`, read
 *    from the screen); it comes back when the screen is the map alone again. No control puts an article away since U114 a, so
 *    that last half takes the reader off the screen in the DOM: the stand-in for a screen with no article on it.
 *  - the bar steps aside when its box meets the index's or comes within 12px of it (at 1440x806 the gap is 6px), and comes
 *    back when there is room (1440x900); the film's seat row keeps the figure; every index row stays reachable (1440x560 by
 *    wheel, 1366x768 by touch) and answers its press.
 *  - the search icon is a 44px target 6px right of the drawer button, at its top, covering neither the index nor the stage;
 *    every sampled point of it at 390x631 hits it; a press opens the drawer with its search box focused; it is hidden while the
 *    drawer is open; "/" takes the same seam.
 * HARNESS: frames move only with `j.advance` (test mode arms no rAF loop), so each read pumps one first. The DSL serves `{}`
 * dossiers; the seat-row case routes real ones so the film has its seat row. Red-proof is at the foot of this file.
 */

type W = any
const frame = async (j: ReturnType<typeof journey>) => { await j.advance(50) }
/** After a viewport change: the app sizes itself on its next frame, the reader lays out, then one more frame for the legend. */
const settle = async (j: ReturnType<typeof journey>) => { await frame(j); await j.readerLayoutSettled(); await frame(j) }
const key = (page: Page) => page.evaluate(() => {
  const a = (window as W).__neural, k = a.legendRef.current as HTMLElement, cs = getComputedStyle(k)
  const on = (el: HTMLElement | null) => { if (!el?.isConnected) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && getComputedStyle(el).visibility !== "hidden" }
  return { visibility: cs.visibility, opacity: cs.opacity, card: on(a._landEl), film: on(a._landFilmEl), article: on(a._reader?.articleEl), roam: !!a._roam }
})
/** A point of bare map: the canvas owns it AND the app's own picker (`_updateHover`, the tap's hit test) finds no node there. */
const emptyMap = (page: Page) => page.evaluate(() => {
  const a = (window as W).__neural, was = a._hover
  try {
    for (let y = 100; y < innerHeight - 60; y += 37) for (let x = innerWidth - 40; x > 140; x -= 53) {
      const e = document.elementFromPoint(x, y); if (e?.tagName !== "CANVAS") continue
      a._hover = null; a._updateHover({ type: "pointerup", clientX: x, clientY: y })
      if (!a._hover || a._hover.idx < 0) return [x, y] as [number, number]
    }
    return null
  } finally { a._hover = was }
})

for (const [width, height, touch] of [[1440, 900, false], [768, 1024, true]] as [number, number, boolean][]) {
  test.describe(`${width}x${height}, by ${touch ? "touch" : "mouse"}`, () => {
    test.use({ viewport: { width, height }, hasTouch: touch })
    test(`@curated v1.254.0: the legend's key shows on the map alone and nowhere a node is revealed (${width}, by ${touch ? "touch" : "mouse"})`, async ({ page }) => {
      const j = journey(page)
      await j.boot("/")
      await frame(j)
      const start = await key(page)
      expect({ card: start.card, film: start.film, article: start.article }, "premise: the start, before the first landing, is the map alone").toEqual({ card: false, film: false, article: false })
      await expect.poll(async () => { await frame(j); const k = await key(page); return k.visibility + " " + k.opacity }, { message: "the key shows on the map alone" }).toBe("visible 1")
      await j.land("Mount Top")
      await expect(page.locator('[data-reader][data-reader-ready="true"]')).toBeVisible()
      await j.readerLayoutSettled(); await frame(j)
      const landed = await key(page)
      expect(landed.card || landed.article, `premise: the node's card or article is on screen ${JSON.stringify(landed)}`).toBe(true)
      await expect(page.locator(".ng-legendkey"), "the key is hidden once a node is revealed").toBeHidden()
      await expect(page.locator(".ng-winbar"), "the win bar stays").toBeVisible()
      // A patch earned at this landing shows its notice at the top; put it away first, so no tap below lands on it.
      const reward = await page.evaluate(() => { const b = document.querySelector("[data-reward-close]"), r = b?.getBoundingClientRect(); return r && r.width ? [r.left + r.width / 2, r.top + r.height / 2] as [number, number] : null })
      if (reward) { if (touch) await page.touchscreen.tap(...reward); else await page.mouse.click(...reward); await j.advance(600); await j.readerLayoutSettled() }
      // Free roam: the background ladder closes the card and the film, then roams; the article stays on screen.
      for (let i = 0; i < 2; i++) {
        // picked afresh: closing the card moves the article up, over a point that was map before
        await j.advance(600)
        const tap = await emptyMap(page); expect(tap, "premise: an empty point on the map").not.toBeNull()
        await page.evaluate(() => { const w = window as W; w.__tapClick = null; document.addEventListener("click", e => { w.__tapClick ??= (e.target as Element).closest?.("[data-game-open]")?.getAttribute("data-game-open") || (e.target as Element).outerHTML.slice(0, 160) }, { capture: true, once: true }) })
        if (touch) await page.touchscreen.tap(...tap!); else await page.mouse.click(...tap!)
        await j.readerLayoutSettled(); await frame(j)
        if (i) continue
        // v1.254.0, the ghost press: the label takes the card's place at once, and a touch tap's click is hit-tested after that
        if (touch) expect(await page.evaluate(() => (window as W).__tapClick), "premise: the tap's own click landed on the Questions label").toBe("card")
        expect((await key(page)).card, "the tap that closed the card does not reopen it through the label that took its place").toBe(false)
      }
      const roam = await key(page)
      expect({ card: roam.card, film: roam.film, roam: roam.roam, article: roam.article }, "premise: free roam, the card and film closed, the article still on screen").toEqual({ card: false, film: false, roam: true, article: true })
      await expect(page.locator(".ng-legendkey"), "an article on screen is a node revealed: the key stays away in free roam").toBeHidden()
      // The screen with no article on it (the stand-in: no control puts the article away since U114 a).
      await page.evaluate(() => { (window as W).__neural._reader.root.style.display = "none" })
      await expect.poll(async () => { await frame(j); const k = await key(page); return k.visibility + " " + k.opacity }, { message: "the key comes back when the map is alone again" }).toBe("visible 1")
      await page.evaluate(() => { (window as W).__neural._reader.root.style.display = "" })
      await frame(j)
      await expect(page.locator(".ng-legendkey"), "and goes again when the article is back").toBeHidden()
    })
  })
}

const bar = (page: Page) => page.evaluate(() => {
  const a = (window as W).__neural, b = document.querySelector(".ng-winbar") as HTMLElement, toc = a._readerTocEl as HTMLElement | null
  const r = b.getBoundingClientRect(), t = toc && !toc.hidden ? toc.getBoundingClientRect() : null
  return { visibility: getComputedStyle(b).visibility, top: r.top, left: r.left, toc: t && { top: t.top, bottom: t.bottom, left: t.left, right: t.right } }
})
async function toc(page: Page, j: ReturnType<typeof journey>, path = "/Positions/Mount/Top") {
  await j.boot(path, { beforeNavigate: async () => { await page.route("**/static/neural/content/*.json", route => route.continue()) } })
  await expect(page.locator('[data-reader][data-reader-ready="true"]')).toBeVisible()
  await expect(page.locator(".ng-reader-toc"), "premise: the index stands beside the grid").toBeVisible()
  await j.readerLayoutSettled(); await frame(j)
}
/** The last index row, brought into the index's own view by wheel over it; then pressed by mouse. */
async function lastRowByWheel(page: Page, j: ReturnType<typeof journey>) {
  const t = (await bar(page)).toc!
  await page.mouse.move(t.left + 60, t.top + 80)
  for (let i = 0; i < 10; i++) { await page.mouse.wheel(0, 200); await page.waitForTimeout(60) }
  return page.evaluate(() => {
    const rows = [...document.querySelectorAll(".ng-reader-toc-row a")] as HTMLElement[], last = rows[rows.length - 1], r = last.getBoundingClientRect()
    const e = document.elementFromPoint(r.left + 24, r.top + r.height / 2)
    return { x: r.left + 24, y: r.top + r.height / 2, inView: r.top >= 0 && r.bottom <= innerHeight, hit: !!e && last.contains(e), type: last.closest(".ng-reader-toc-row")!.getAttribute("data-toc-type") }
  })
}
const sectionAt = (page: Page, type: string) => page.evaluate(t => {
  const r = (window as W).__neural._reader, el = document.querySelector(`[data-reader-body] [data-section-type="${t}"], [data-reader-body] > [data-section-type="${t}"]`) as HTMLElement | null
  if (!el) return null
  const b = el.getBoundingClientRect(), root = r.root.getBoundingClientRect()
  return { top: Math.round(b.top - root.top), visible: b.bottom > 0 && b.top < innerHeight }
}, type)

test.describe("1440, by mouse", () => {
  test.use({ viewport: { width: 1440, height: 900 } })
  test("@curated v1.254.0: the win bar steps aside for the index, comes back when there is room, and every index row stays reachable (1440, by mouse)", async ({ page }) => {
    const j = journey(page)
    await toc(page, j)
    const tall = await bar(page)
    expect(tall.toc && tall.left < tall.toc.right, `premise: the bar sits in the index's column ${JSON.stringify(tall)}`).toBe(true)
    expect(tall.top - tall.toc!.bottom, `premise: at 1440x900 the bar clears the index by more than 12px ${JSON.stringify(tall)}`).toBeGreaterThan(12)
    expect(tall.visibility, "with room, the bar shows").toBe("visible")
    // "comes close to its last rows": 6px of gap, inside the index's 12px clearance
    const close = Math.round(tall.toc!.bottom + 6 + (900 - tall.top))
    await page.setViewportSize({ width: 1440, height: close }); await settle(j)
    const near = await bar(page)
    expect(Math.round(near.top - near.toc!.bottom), `premise: 6px between the index and the bar at 1440x${close}`).toBe(6)
    await expect(page.locator(".ng-winbar"), "within 12px of the index's last row, the bar steps aside").toBeHidden()
    // the wide-but-short screen: the bar's box inside the index's
    await page.setViewportSize({ width: 1440, height: 560 }); await settle(j)
    const short = await bar(page)
    expect(short.top < short.toc!.bottom, `premise: at 1440x560 the bar's box is inside the index's ${JSON.stringify(short)}`).toBe(true)
    await expect(page.locator(".ng-winbar"), "over the index, the bar is away").toBeHidden()
    await expect.poll(() => page.locator(".ng-winbar [data-legend-win]").getAttribute("data-win-chance"), { message: "premise: the bar's number is worked out", timeout: 60_000 }).toMatch(/\d/)
    const fig = await page.evaluate(() => ({ bar: document.querySelector(".ng-winbar [data-legend-win]")!.getAttribute("data-win-chance")!, seat: document.querySelector("[data-current-film-win]")?.textContent ?? null }))
    expect(fig.seat, "the film's seat row keeps the figure while the bar is away").toBe(fig.bar.replace(/%/g, ""))
    const last = await lastRowByWheel(page, j)
    expect(last, "the index's last row is reachable by wheel and owns its point").toMatchObject({ inView: true, hit: true })
    expect((await sectionAt(page, last.type!))?.visible, "premise: its section is not on screen yet").toBe(false)
    await page.mouse.click(last.x, last.y)
    await j.readerLayoutSettled()
    expect((await sectionAt(page, last.type!))?.visible, "the last row's press goes to its section").toBe(true)
    await page.setViewportSize({ width: 1440, height: 900 }); await settle(j)
    await expect(page.locator(".ng-winbar"), "with room again, the bar comes back").toBeVisible()
  })
})

test.describe("1366x768, by touch", () => {
  test.use({ viewport: { width: 1366, height: 768 }, hasTouch: true })
  test("@curated v1.254.0: on a short laptop screen the bar gives way to the index, and its last row answers a tap (1366x768, by touch)", async ({ page }) => {
    const j = journey(page)
    await toc(page, j)
    const b = await bar(page)
    expect(b.toc && b.left < b.toc.right && b.top < b.toc.bottom + 12, `premise: the bar meets the index or its clearance ${JSON.stringify(b)}`).toBe(true)
    await expect(page.locator(".ng-winbar"), "the bar is away").toBeHidden()
    const row = await page.evaluate(() => {
      const rows = [...document.querySelectorAll(".ng-reader-toc-row a")] as HTMLElement[], last = rows[rows.length - 1], r = last.getBoundingClientRect()
      const e = document.elementFromPoint(r.left + 24, r.top + r.height / 2)
      return { x: r.left + 24, y: r.top + r.height / 2, inView: r.bottom <= innerHeight, hit: !!e && last.contains(e), type: last.closest(".ng-reader-toc-row")!.getAttribute("data-toc-type") }
    })
    expect(row, "the last row is on screen and owns its point").toMatchObject({ inView: true, hit: true })
    expect((await sectionAt(page, row.type!))?.visible, "premise: its section is not on screen yet").toBe(false)
    await page.touchscreen.tap(row.x, row.y)
    await j.readerLayoutSettled()
    expect((await sectionAt(page, row.type!))?.visible, "the tap goes to its section").toBe(true)
  })
})

const icon = (page: Page) => page.evaluate(() => {
  const s = document.querySelector(".ng-search") as HTMLElement, l = document.querySelector(".ng-logo") as HTMLElement, a = (window as W).__neural
  const r = s.getBoundingClientRect(), lr = l.getBoundingClientRect(), R = 12, k = R - R / Math.SQRT2 + 1
  const pts: [string, number, number][] = [["centre", r.left + r.width / 2, r.top + r.height / 2],
    ["left edge", r.left + 1, r.top + r.height / 2], ["right edge", r.right - 1, r.top + r.height / 2], ["top edge", r.left + r.width / 2, r.top + 1], ["bottom edge", r.left + r.width / 2, r.bottom - 1],
    ["top-left", r.left + k, r.top + k], ["top-right", r.right - k, r.top + k], ["bottom-left", r.left + k, r.bottom - k], ["bottom-right", r.right - k, r.bottom - k]]
  const missed = pts.filter(([, x, y]) => { const e = document.elementFromPoint(x, y); return !e || !s.contains(e) }).map(([n]) => n)
  const below = (el: HTMLElement | null) => { if (!el?.isConnected || el.hidden) return null; const b = el.getBoundingClientRect(); return b.width && b.height && b.left < r.right && b.right > r.left ? Math.round(b.top) : null }
  const band = a._reader?.nodeBand?.top ?? null
  return { box: [r.left, r.top, r.width, r.height], logo: [lr.left, lr.top, lr.width, lr.height], label: s.getAttribute("aria-label"), missed, bottom: r.bottom,
    tocTop: below(a._readerTocEl), bandTop: band, cardTop: below(a._landEl), filmTop: below(a._landFilmEl), handTop: below(a.optionsRef.current), articleTop: below(a._reader?.articleEl) }
})
const opened = (page: Page) => page.evaluate(() => {
  const a = (window as W).__neural, s = document.querySelector(".ng-search") as HTMLElement
  return { drawer: !!a.deckShown, focused: document.activeElement === a.explorerSearchRef.current, icon: getComputedStyle(s).visibility, via: (a.beats || []).filter((b: any) => b.beat === "search_open").map((b: any) => b.via) }
})

for (const [width, height, touch] of [[390, 631, true], [1440, 900, false]] as [number, number, boolean][]) {
  test.describe(`search ${width}x${height}`, () => {
    test.use({ viewport: { width, height }, hasTouch: touch, isMobile: touch })
    test(`@curated v1.254.0: the search icon beside the drawer button opens search (${width}x${height}, by ${touch ? "touch" : "mouse"})`, async ({ page }) => {
      const j = journey(page)
      await j.boot("/Positions/Mount/Top")
      await expect(page.locator('[data-reader][data-reader-ready="true"]')).toBeVisible()
      await j.readerLayoutSettled()
      const g = await icon(page)
      expect(g.label, "it is named Search").toBe("Search")
      expect([g.box[2], g.box[3]], "a 44px target").toEqual([44, 44])
      expect([g.box[0] - (g.logo[0] + g.logo[2]), g.box[1] - g.logo[1]], "6px right of the drawer button, at its top").toEqual([6, 0])
      expect(g.missed, `every sampled point of the icon hits it (elementFromPoint), ${JSON.stringify(g)}`).toEqual([])
      for (const [what, top] of [["the index", g.tocTop], ["the node band", g.bandTop], ["the card", g.cardTop], ["the film", g.filmTop], ["the hand", g.handTop], ["the article", g.articleTop]] as [string, number | null][])
        if (top != null) expect(top, `${what} starts below the icon ${JSON.stringify(g)}`).toBeGreaterThanOrEqual(g.bottom)
      if (touch) await page.touchscreen.tap(g.box[0] + 22, g.box[1] + 22)
      else await j.clickByMouse(".ng-search", "the search icon")
      await expect.poll(() => opened(page), { message: "a press opens the drawer with its search box focused" }).toEqual({ drawer: true, focused: true, icon: "hidden", via: ["icon"] })
      await page.keyboard.type("armbar")
      await expect(page.locator(".ng-learning-list"), "the drawer's search answers").toContainText(/armbar/i)
      const shut = await page.evaluate(() => { const r = document.querySelector(".ng-explorer-close")!.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2] as [number, number] })
      if (touch) await page.touchscreen.tap(...shut); else await j.clickByMouse(".ng-explorer-close", "the drawer's close")
      await expect.poll(() => page.evaluate(() => !!(window as W).__neural.deckShown), { message: "premise: the drawer closes" }).toBe(false)
      await expect(page.locator(".ng-search"), "the icon is back once the drawer closes").toBeVisible()
      if (!touch) {
        await page.keyboard.press("/")
        await expect.poll(async () => (await opened(page)).via, { message: "\"/\" takes the same seam" }).toEqual(["icon", "key"])
      }
    })
  })
}

// Red-proof: filled in by the round's mutant run (tests/artifacts/neural_app_mutants.mjs, served neural.js and neural.css).
