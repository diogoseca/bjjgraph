import { expect, test, type Page } from "@playwright/test"
import { journey } from "../dsl"

/**
 * THE VIDEOS ROW: NO SCROLLBAR, EARNED FADES, ARROWS (v1.217.0). Owner, 2026-10-02: "scrolling bar in
 * videos row should probably not appear and use a similar system like the choice row, with the
 * addition of a right arrow and left arrow (to start, the left arrow is hidden - get inspired by the
 * arrows of the landcard / flashcards deck below the videos row). on mobile the fading and arrows
 * should look fine and be responsive".
 *
 * WHAT THE HARNESS DOES NOT SERVE (CLAUDE.md §6.4): dossier chunks are `{}`, so there is no film strip
 * unless a test AUTHORS clips — this file seeds them. And Playwright launches Chromium with
 * `--hide-scrollbars`, under which no scrollbar ever takes space, so "no scrollbar" would pass on the
 * old build too: this file removes that flag, so a scrollbar is real and measurable here.
 *
 * Every length is a ratio of one token already on screen, the strip's side padding (the card's,
 * measured by `_dockLandFilm`): end padding 1x, fade 3x (NG_FILM_FADE_RATIO), arrow centre 1x from
 * the edge. The ratios are pinned, not the pixels.
 *
 * Mutants, recorded 2026-10-02 on the built bundle (one at a time): see MUTANTS at the bottom.
 */

test.use({ launchOptions: { ignoreDefaultArgs: ["--hide-scrollbars"] } })

const CLIPS = (n: number, vertical = false) => Array.from({ length: n }, (_, i) => ({ id: `aQ2vFXXBn-${i}`, title: `Seeded clip ${i + 1}`, who: "Coach", ...(vertical ? { vertical: true } : {}) }))

/** the DSL serves {} for content chunks, so the landing card's film has to be authored */
async function seedFilm(page: Page, n: number, vertical = false) {
  await page.evaluate((clips) => {
    const a = (window as any).__neural, w = window as any
    const key = a.deckKeyFor(a.nodes[a.currentPos]).key
    w.NG_CONTENT = w.NG_CONTENT || {}
    w.NG_CONTENT.decks = w.NG_CONTENT.decks || {}
    w.NG_CONTENT.decks[key] = { def: "Seeded definition.", clips }
    a._landQ = null
    a.renderLandCard(a.nodes[a.currentPos], "land", null)
  }, CLIPS(n, vertical))
  await expect.poll(() => page.evaluate(() => document.querySelectorAll("[data-land-film] .ng-clip").length)).toBe(n)
  await page.waitForTimeout(300)
}

const film = (page: Page) => page.evaluate(() => {
  const f = document.querySelector("[data-land-film]") as HTMLElement, row = f.querySelector(".ng-cliprow") as HTMLElement
  const cs = getComputedStyle(row), fr = f.getBoundingClientRect()
  const clips = [...row.querySelectorAll(".ng-clip")].map((c) => c.getBoundingClientRect())
  const mask = (cs as any).webkitMaskImage && (cs as any).webkitMaskImage !== "none" ? (cs as any).webkitMaskImage : cs.maskImage
  const lead = mask && mask !== "none" ? Number((mask.match(/rgb\(0, 0, 0\) ([\d.]+)px/) || [0, 0])[1]) : 0
  const tailM = mask && mask !== "none" ? mask.match(/rgb\(0, 0, 0\) (?:calc\(100% - ([\d.]+)px\)|100%)/) : null
  const arrow = (sel: string) => {
    const b = f.querySelector(sel) as HTMLElement, r = b.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2
    const hit = document.elementFromPoint(x, y)
    return { visibility: getComputedStyle(b).visibility, hit: !!hit && (hit === b || b.contains(hit)), cx: x - fr.left, fromRight: fr.right - x,
      tag: b.tagName, label: b.getAttribute("aria-label"), cls: b.className }
  }
  return { x: row.scrollLeft, max: row.scrollWidth - row.clientWidth, scrollbar: row.offsetHeight - row.clientHeight, sbw: cs.scrollbarWidth,
    inset: parseFloat(getComputedStyle(f).paddingLeft), firstGap: Math.min(...clips.map((b) => b.left)) - fr.left, lastGap: fr.right - Math.max(...clips.map((b) => b.right)),
    mask, attr: row.getAttribute("data-fade"), lead, trail: tailM ? Number(tailM[1] || 0) : 0,
    prev: arrow("[data-film-prev]"), next: arrow("[data-film-next]") }
})

async function settled(page: Page) {
  let last = -1
  await expect.poll(async () => { const x = (await film(page)).x, same = x === last; last = x; return same }, { timeout: 10_000, intervals: [150, 150, 250] }).toBe(true)
  return film(page)
}

for (const [width, height] of [[1440, 900], [390, 844]]) {
  test.describe(`at ${width}px`, () => {
    test.use({ viewport: { width, height } })

    test("the videos row has no scrollbar, earned fades and arrows, start to end", async ({ page }) => {
      const j = journey(page)
      await j.boot("/")
      await j.land("Mount Top")
      await seedFilm(page, 6)
      const start = await settled(page)
      expect(start.max, "six clips overflow the strip, so both ends exist").toBeGreaterThan(40)

      // NO SCROLLBAR, measured: with real scrollbars on, the row's box holds none
      expect(start.scrollbar, "the row reserves no scrollbar height").toBe(0)
      expect(start.sbw, "and declares none").toBe("none")

      // START: left arrow hidden AND inert; only the right edge fades; the first clip one inset in
      expect(start.prev.visibility, "the left arrow is hidden at the start").toBe("hidden")
      expect(start.prev.hit, "...and inert: the point under it is not the arrow").toBe(false)
      expect(start.next.visibility, "the right arrow shows").toBe("visible")
      expect([start.lead, start.trail], "at the start only the right edge fades: " + start.mask).toEqual([0, 3 * start.inset])
      expect(Math.abs(start.firstGap - start.inset), "the first clip sits 1 inset in").toBeLessThanOrEqual(1)
      // the arrows are real, labelled buttons in the deck's one chevron look
      for (const a of [start.prev, start.next]) { expect(a.tag).toBe("BUTTON"); expect(a.label).toBeTruthy(); expect(a.cls).toContain("ng-chev") }

      // RIGHT ARROW, by the MOUSE (attachInput's capture would kill a locator.click()-only control)
      await j.clickByMouse("[data-film-next]", "the videos row's right arrow")
      const mid = await settled(page)
      expect(mid.x, "the right arrow scrolled the row").toBeGreaterThan(start.x)
      expect(mid.prev.visibility, "...and revealed the left arrow").toBe("visible")
      expect(mid.prev.hit, "...which the pointer reaches").toBe(true)

      // THE END, by more right-arrow presses: right arrow gone, end fade gone, end padding present
      for (let i = 0; i < 12 && (await film(page)).next.visibility === "visible"; i++) {
        await j.clickByMouse("[data-film-next]", "the videos row's right arrow"); await settled(page)
      }
      const end = await settled(page)
      expect(end.x, "reached the end").toBeGreaterThanOrEqual(end.max - 1)
      expect(end.next.visibility, "the right arrow is hidden at the end").toBe("hidden")
      expect(end.next.hit, "...and inert").toBe(false)
      expect([end.lead, end.trail], "at the end only the left edge fades: " + end.mask).toEqual([3 * end.inset, 0])
      expect(end.lastGap, "the last clip is not flush against the edge").toBeGreaterThan(0)

      // THE RATIOS, all of the one token on screen (the strip's side padding), never the pixels
      expect(Math.abs(end.lastGap / end.inset - 1), `end padding = 1 inset (${end.lastGap} / ${end.inset})`).toBeLessThan(0.1)
      expect(Math.abs(mid.lead / mid.inset - 3), `fade = 3 insets (${mid.lead} / ${mid.inset})`).toBeLessThan(0.05)
      expect(Math.abs(mid.prev.cx / mid.inset - 1), `arrow centre 1 inset from the edge (${mid.prev.cx})`).toBeLessThan(0.1)

      // BACK, by the left arrow and the keyboard (a real button: focus + Enter)
      await page.locator("[data-film-prev]").focus()
      await page.keyboard.press("Enter")
      const back = await settled(page)
      expect(back.x, "Enter on the focused left arrow scrolled back").toBeLessThan(end.x)
    })

    test("a row that fits shows no arrows and no fades", async ({ page }) => {
      const j = journey(page)
      await j.boot("/")
      await j.land("Mount Top")
      // two VERTICAL clips (62px each) fit at 390 too, where two landscape ones (148px) do not
      await seedFilm(page, 2, true)
      const fit = await settled(page)
      expect(fit.max, "precondition: two clips fit the strip").toBeLessThanOrEqual(0)
      expect([fit.prev.visibility, fit.next.visibility], "no arrows").toEqual(["hidden", "hidden"])
      expect([fit.attr, fit.mask], "no fades").toEqual([null, "none"])
    })

    test("under reduced motion an arrow jumps instead of gliding", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" })
      const j = journey(page)
      await j.boot("/")
      await j.land("Mount Top")
      await seedFilm(page, 6)
      const before = await settled(page)
      await j.clickByMouse("[data-film-next]", "the videos row's right arrow")
      // one frame later the row is already where it is going: nothing animates
      const x1 = await page.evaluate(() => new Promise<number>((r) => requestAnimationFrame(() => r((document.querySelector("[data-land-film] .ng-cliprow") as HTMLElement).scrollLeft))))
      const after = await settled(page)
      expect(after.x, "the arrow moved the row").toBeGreaterThan(before.x)
      expect(x1, "and it was there on the next frame").toBe(after.x)
    })
  })
}

/* MUTANTS, recorded 2026-10-02 on the built bundle (one at a time; a neutral control stayed green):
   - scrollbar shown again (scrollbar-width/-webkit rules removed) ...... "the row reserves no scrollbar height", both widths
   - arrows always shown .................................................. "the left arrow is hidden at the start" + "no arrows"
   - hidden by opacity only ............................................... "the left arrow is hidden at the start" + "no arrows"
   - hidden arrow whose chevron re-enables visibility (looks hidden) ...... "...and inert: the point under it is not the arrow"
   - film strip off attachInput's early-return list (dead to the MOUSE) .. red at the first arrow click: the press falls through to
                                                                           the graph, which closes the strip (not a named line)
   - arrow does not scroll ................................................ "the right arrow scrolled the row" + "the arrow moved the row"
   - end test off by one (x <= max) ....................................... "the right arrow is hidden at the end"
   - no end padding ....................................................... "the first clip sits 1 inset in"
   - fade ratio 2 ......................................................... "at the start only the right edge fades" (36 != 54 / 24 != 36)
   - a fitting row shows its arrows ....................................... "no arrows"
   - a fitting row keeps a fade (constant mask) ........................... "no fades"
   - reduced motion ignored ............................................... "and it was there on the next frame"
   - arrows lose the shared chevron class ................................. the `ng-chev` toContain, both widths */
