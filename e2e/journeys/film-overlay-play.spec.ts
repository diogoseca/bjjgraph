import { expect, test, type Page } from "@playwright/test"
import { journey } from "../dsl"
import { bootVideoCards as boot, CARD } from "../fixtures/video-cards"

/** v1.256.4 (filmfix) — the current node's video card, owner 2026-11-11, dev preview:
 *
 *  1. "the dark transparent overlay ... doesn't go all the way to the top of the video card, leaving like the top
 *     10% of the video without [it]". The overlay is the card's title band (`.ng-current-title`), absolutely placed
 *     at top:0. Quartz's index.css gives every bare `header` `margin:2rem 0`, so the band sat 32px down the video
 *     (18% of a 178px frame at 390, 14% of 236px at 1440). Fixed in choice-value.css (`margin:0`).
 *  2. "after i click the play button and close it ... the play button gets out of place". collapseClip wrote
 *     `glyph.style.display = ""`, which DELETED the glyph's built `display:flex` (CLAUDE.md §6.1), so the triangle
 *     fell into inline flow 6.5px above the circle's centre. Fixed by removing the orphaned write (app.src.jsx).
 *
 *  The oracle is measured rects, never a CSS value: the band's top/left/right edges are the video's, the bottom
 *  shade is the video's box on all four edges, and the triangle's offset from the circle's centre after
 *  play-and-close equals the offset a FRESH card gives (1.63px right, its own optical offset, 0 vertical).
 *  Presses are the player's own: `j.clickByMouse` and a touch tap at a measured, reachable centre.
 *
 *  Mutants, each against a green baseline of this file (v1.256.4, docs/Changelog-Archive.md):
 *   - collapseClip writes `glyph.style.display = ""` again → every "triangle" assertion here is red (dy −6.5).
 *   - `.ng-current-title` loses `margin:0` → "the title band starts at the video's top edge" is red (32px).
 *  What the harness does NOT serve: YouTube posters are aborted (each img is hidden by its onerror) and the
 *  player is the fixture stub. Neither enters a rect measured here.
 */

const FILM = "[data-land-film]:not([data-reference-film])"
const THEATER = ".ng-video-theater"
const VIEWER = "[data-choice-viewer]"

/** The band, the row and each clip's own shade, measured on the film. */
const overlay = (page: Page) => page.evaluate((sel) => {
  const f = document.querySelector(sel)!
  const band = f.querySelector(".ng-current-title")!.getBoundingClientRect(), row = f.querySelector(".ng-cliprow")!.getBoundingClientRect()
  const clips = [...f.querySelectorAll(".ng-clip")].map((clip) => {
    const c = clip.getBoundingClientRect()
    // the shade is the one span of the launch button painted with a gradient: select it by what it IS
    const shades = [...clip.querySelectorAll("[data-film-play] > span")].filter((s) => getComputedStyle(s).backgroundImage.startsWith("linear-gradient"))
    const s = shades[0]?.getBoundingClientRect()
    return { shades: shades.length, top: c.top, insets: s ? [s.left - c.left, s.top - c.top, c.right - s.right, c.bottom - s.bottom] : null }
  })
  return { band: { top: band.top, left: band.left, right: band.right, height: band.height }, row: { left: row.left, right: row.right }, clips }
}, FILM)

function expectCovered(o: Awaited<ReturnType<typeof overlay>>, phase: string) {
  expect(o.clips.length, phase + ": the film shows its clips").toBeGreaterThan(0)
  expect(o.band.height, phase + ": the title band is drawn").toBeGreaterThan(20)
  expect(Math.abs(o.band.top - o.clips[0].top), phase + ": the title band starts at the video's top edge " + JSON.stringify(o)).toBeLessThan(.5)
  expect(Math.abs(o.band.left - o.row.left), phase + ": the title band starts at the video's left edge").toBeLessThan(.5)
  expect(Math.abs(o.band.right - o.row.right), phase + ": the title band ends at the video's right edge").toBeLessThan(.5)
  for (const clip of o.clips) {
    expect(clip.shades, phase + ": one shade per video").toBe(1)
    expect(clip.insets!.every((v) => Math.abs(v) < .5), phase + ": the shade is the video's own box " + JSON.stringify(clip.insets)).toBe(true)
  }
}

/** The triangle's centre against the circle's centre, measured AT REST: the hover's 1.03 scale eases back over .16s
 *  (wireClips), and the ✕ vanishing under a still pointer hands the card a mouseenter, so a reading taken while that
 *  transition runs measured a 30.08px circle (first run, the viewer at 1440). */
const triangle = (page: Page, scope: string) => page.evaluate(async (sel) => {
  const g = document.querySelector(sel + " .ngPlay")!, t = g.querySelector("polygon")!
  await Promise.all(g.getAnimations().map((a) => a.finished))
  const c = g.getBoundingClientRect(), p = t.getBoundingClientRect()
  return { w: c.width, h: c.height, dx: p.left + p.width / 2 - (c.left + c.width / 2), dy: p.top + p.height / 2 - (c.top + c.height / 2) }
}, scope)

function expectCentred(now: Awaited<ReturnType<typeof triangle>>, fresh: Awaited<ReturnType<typeof triangle>>, where: string) {
  expect(now.w, where + ": the play circle is drawn").toBeGreaterThan(20)
  expect([now.w, now.h], where + ": the same play circle as a fresh card").toEqual([fresh.w, fresh.h])
  expect(Math.abs(now.dx - fresh.dx), where + ": the triangle sits where a fresh card's does, across " + JSON.stringify({ now, fresh })).toBeLessThanOrEqual(1)
  expect(Math.abs(now.dy - fresh.dy), where + ": the triangle sits where a fresh card's does, up and down " + JSON.stringify({ now, fresh })).toBeLessThanOrEqual(1)
}

/** A touch tap at the target's measured centre, refused unless the target (or a child) owns that point. */
async function tap(page: Page, selector: string, what: string) {
  const hit = await page.evaluate((sel) => {
    const el = document.querySelector(sel)!, r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2
    const top = document.elementFromPoint(x, y)
    return { x, y, ok: !!top && (top === el || el.contains(top)), who: top ? top.tagName + "." + String((top as HTMLElement).className) : "nothing" }
  }, selector)
  expect(hit.ok, `${what} is reachable by touch where it sits (elementFromPoint is ${hit.who})`).toBe(true)
  await page.touchscreen.tap(hit.x, hit.y)
}

async function settleTheater(page: Page) {
  await expect(page.locator(THEATER + " iframe")).toHaveCount(1)
  // native coordinates are sampled after the moving close settles (video-theater.spec)
  await page.locator(THEATER).evaluate(async (d) => { await Promise.all(d.getAnimations().map((a) => a.finished)) })
}

async function filmInView(page: Page) {
  await page.locator(FILM + " [data-film-play]").first().scrollIntoViewIfNeeded()
  await journey(page).readerLayoutSettled()
  await page.mouse.move(1, 1) // no hover on the card while the fresh glyph is measured
}

const PLAY = FILM + ' .ng-clip[data-i="0"] [data-film-play]'

for (const [width, height, clips] of [[390, 844, 2], [574, 760, 2], [1440, 900, 2], [1440, 900, 1]] as const) {
  test(`@curated FILMFIX the film's overlay covers the video and its triangle stays centred, by mouse (${width}x${height}, ${clips} clip${clips > 1 ? "s" : ""})`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const j = await boot(page, "approved", { currentClips: clips })
    await filmInView(page)
    expectCovered(await overlay(page), "fresh")
    const fresh = await triangle(page, FILM + ' .ng-clip[data-i="0"]')
    expect(Math.abs(fresh.dy), "premise: a fresh card's triangle is centred up and down").toBeLessThan(.5)
    await j.clickByMouse(PLAY, "Play the current node's video")
    await settleTheater(page)
    await j.clickByMouse(THEATER + " .ngClipX", "Close the video")
    await expect(page.locator(THEATER)).toHaveCount(0)
    await page.mouse.move(1, 1)
    expectCovered(await overlay(page), "after play-and-close")
    expectCentred(await triangle(page, FILM + ' .ng-clip[data-i="0"]'), fresh, "the film after play-and-close by mouse")
  })
}

test("@curated FILMFIX a choice card's viewer: the triangle stays centred after its player is closed, by mouse (1440x900)", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const j = await boot(page)
  await filmInView(page)
  const fresh = await triangle(page, FILM + ' .ng-clip[data-i="0"]') // the same compact poster the viewer is built from
  await page.locator(`${CARD} [data-choice-watch]`).scrollIntoViewIfNeeded()
  await j.readerLayoutSettled()
  await j.clickByMouse(`${CARD} [data-choice-watch]`, "Watch the move")
  await expect(page.locator(VIEWER + " iframe")).toHaveCount(1)
  await j.clickByMouse(VIEWER + " .ngClipX", "Close the video inside the viewer")
  await expect(page.locator(VIEWER + " [data-film-play]")).toBeVisible()
  await page.mouse.move(1, 1)
  expectCentred(await triangle(page, VIEWER), fresh, "the choice viewer after play-and-close by mouse")
})

test.describe("touch", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } })

  test("@curated FILMFIX the film's overlay covers the video and its triangle stays centred, by touch (390x844)", async ({ page }) => {
    await boot(page)
    await filmInView(page)
    expectCovered(await overlay(page), "fresh")
    const fresh = await triangle(page, FILM + ' .ng-clip[data-i="0"]')
    await tap(page, PLAY, "the current node's Play")
    await settleTheater(page)
    await tap(page, THEATER + " .ngClipX", "the video's close")
    await expect(page.locator(THEATER)).toHaveCount(0)
    expectCovered(await overlay(page), "after play-and-close")
    expectCentred(await triangle(page, FILM + ' .ng-clip[data-i="0"]'), fresh, "the film after play-and-close by touch")
  })

  test("@curated FILMFIX a choice card's viewer: the triangle stays centred after its player is closed, by touch (390x844)", async ({ page }) => {
    const j = await boot(page)
    await filmInView(page)
    const fresh = await triangle(page, FILM + ' .ng-clip[data-i="0"]')
    await page.locator(`${CARD} [data-choice-watch]`).scrollIntoViewIfNeeded()
    await j.readerLayoutSettled()
    await tap(page, `${CARD} [data-choice-watch]`, "Watch the move")
    await expect(page.locator(VIEWER + " iframe")).toHaveCount(1)
    await tap(page, VIEWER + " .ngClipX", "the video's close inside the viewer")
    await expect(page.locator(VIEWER + " [data-film-play]")).toBeVisible()
    expectCentred(await triangle(page, VIEWER), fresh, "the choice viewer after play-and-close by touch")
  })
})
