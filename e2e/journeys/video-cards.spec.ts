import { expect, test, type Page } from "@playwright/test"

/** v1.231.0 — feedback_owner_rules_reverse_shipped_contracts.
 * Reverses v1.218.1 Inspect / shifted digits and v1.220.0's sheet and 0.6 ratio.
 * D-318 removes Choose/Read: the card commits except for its play circle.
 * Real mouse input covers the face and play. Synthetic curation flags are
 * test data, served through the real dossier fetch/cache, never a renderer stub.
 * One-host movement and pause/fallback are shared with reading-media-placement.
 * Source mutation runner: tests/artifacts/video_cards_mutants.py. Every mutant
 * requires its named failure and an unaffected passing browser control.
 */
import { bootVideoCards as boot, NAME, CARD } from "../fixtures/video-cards"

const state = (page: Page) => page.evaluate(() => {
  const a = (window as any).__neural
  return { hand: a._choiceHandId, moves: a.moveCount, commits: a.beats.filter((b: any) => b.beat === "commit").length,
    executing: !!a._execution, sheet: !!a._detailCtx,
    order: a._optionCards.map((c: any) => c.opt.node.t), answers: a.beats.filter((b: any) => b.beat === "land_q_answered").length }
})

// U8: use the actual frame and poster rectangles, including Quartz's global
// image styles. A standalone specimen omitted that stylesheet and hid the
// vertical margin leak. The oracle is equal visible insets, not a CSS value.
for (const width of [320, 390, 768, 1024, 1440]) for (const currentClips of [1, 2] as const) {
  test(`@curated U8 posters stay centered inside every film frame (${width}px, ${currentClips} current clips)`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 700 ? 844 : 900 })
    await boot(page, "approved", { currentClips })
    const images = page.locator(`${CARD} img, [data-land-film] img`)
    for (const phase of ["unavailable", "decoded"]) {
      if (phase === "decoded") await images.evaluateAll(async images => {
        // The harness blocks external posters. Give the same real image nodes
        // a 4:3 decoded source as well: intrinsic grid sizing changes on load.
        const source = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360"><path fill="#345" d="M0 0h480v360H0z"/></svg>')
        await Promise.all(images.map(async node => {
          const img = node as HTMLImageElement
          img.loading = "eager"; img.src = source
          await img.decode()
          img.style.removeProperty("visibility") // clear the preceding unavailable-poster fixture
        }))
      })
      const posters = await images.evaluateAll(images => images.map(img => {
        const frame = img.closest(".ng-choice-media,.ng-clip")!.getBoundingClientRect()
        const r = img.getBoundingClientRect()
        return { top: r.top - frame.top, bottom: frame.bottom - r.bottom,
          left: r.left - frame.left, right: frame.right - r.right, width: r.width, height: r.height }
      }))
      expect(posters.length, "the choice poster and every current-node poster").toBe(currentClips + 1)
      for (const poster of posters) {
        expect(poster.width).toBeGreaterThan(0)
        expect(poster.height).toBeGreaterThan(0)
        expect(Math.abs(poster.top - poster.bottom), phase + JSON.stringify(poster)).toBeLessThan(.5)
        expect(Math.abs(poster.left - poster.right), phase + JSON.stringify(poster)).toBeLessThan(.5)
      }
    }
    const winColumns = await page.locator(`${CARD} .ng-choice-stat:last-child, [data-land-film] .ng-current-stat`).evaluateAll(columns => columns.map(column => {
      const range = document.createRange()
      range.selectNodeContents(column.firstElementChild!)
      const labelRight = range.getBoundingClientRect().right
      range.selectNodeContents(column.querySelector("strong")!)
      return { right: column.getBoundingClientRect().right, labelRight, valueRight: range.getBoundingClientRect().right }
    }))
    expect(winColumns).toHaveLength(2)
    for (const column of winColumns) {
      expect(Math.abs(column.right - column.labelRight), "Win label reaches the column's right edge").toBeLessThan(.5)
      expect(Math.abs(column.right - column.valueRight), "Win value reaches the same right edge").toBeLessThan(.5)
    }
  })
}

for (const [width, height] of [[1440, 900], [390, 844]]) {
  test(`@curated video choice: only the play circle watches, the card commits (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const errors: string[] = []; page.on("pageerror", e => errors.push(e.message))
    const j = await boot(page)
    const watch = page.locator(`${CARD} [data-choice-watch]`)
    await expect(watch).toBeVisible()
    await expect(page.locator(`${CARD} img`)).toHaveCount(1)
    await expect(page.locator(`${CARD} [data-cat], ${CARD} [data-choice-inspect]`)).toHaveCount(0)
    await expect(page.locator(`${CARD} footer, ${CARD} a, ${CARD} [data-choice-read]`)).toHaveCount(0)
    await expect(page.locator(`${CARD} [data-choice-execute]`)).toHaveCount(1)
    await expect(page.locator(`${CARD} [data-choice-shape]`)).toHaveAttribute("data-choice-shape", "diamond")
    const shortcut = await page.evaluate(() => (window as any).__neural._optionCards.find((c: any) => c.node.t === "Consolidate Mount").num)
    await expect(page.locator(`${CARD} [data-choice-shape] [data-choice-number]`)).toHaveText(shortcut <= 9 ? String(shortcut) : "")
    const circle = await watch.boundingBox(), media = await page.locator(`${CARD} [data-choice-media]`).boundingBox()
    expect(circle!.width).toBe(44); expect(circle!.height).toBe(44)
    expect(circle!.x + 22).toBeCloseTo(media!.x + media!.width / 2, 0)
    expect(circle!.y + 22).toBeCloseTo(media!.y + media!.height / 2, 0)
    await expect(page.locator('[data-choice-group="you"] > div').first()).toContainText("Your move")
    const before = await state(page)
    await j.clickByMouse(`${CARD} [data-choice-watch]`, "Watch the approved front")
    await expect(page.locator("[data-choice-viewer]")).toBeVisible()
    await expect.poll(() => page.evaluate(() => (window as any).__players.length)).toBe(1)
    expect(await page.evaluate(() => (window as any).__players[0])).toMatchObject({
      id: "aaaaaaaaaaa", vars: { autoplay: 0, controls: 1 }, play: 0,
    }) // The approved 600-second front wins over the 20-second alternate.
    const playerInsets = await page.locator("[data-choice-viewer] iframe").evaluate(player => {
      const r = player.getBoundingClientRect(), frame = player.closest(".ngPlayerHost")!.getBoundingClientRect()
      return [r.top - frame.top, frame.bottom - r.bottom, r.left - frame.left, frame.right - r.right]
    })
    expect(playerInsets.every(inset => Math.abs(inset) < .5), "playback fills the frame without clipping an iframe border").toBe(true)
    await page.keyboard.press("1"); await page.keyboard.press("Shift+Digit1"); await page.keyboard.press("x"); await page.keyboard.press("a")
    expect(await state(page)).toEqual(before)
    await j.clickByMouse("[data-watch-close]", "Close the video viewer")
    await expect(watch).toBeFocused()
    expect(await page.evaluate(() => (window as any).__players[0].destroy)).toBe(1)

    await j.clickByMouse(`${CARD} .ng-choice-title-button`, "Choose the move")
    expect((await state(page)).commits).toBe(before.commits + 1)
    await expect(page.locator("[data-executing-tech]")).toHaveAttribute("data-executing-tech", NAME)
    await expect(page.locator("[data-executing-tech] [data-cat]")).toHaveText("Executing…")
    await expect(page.locator("[data-executing-tech] .ng-choice-watch")).toHaveCount(0)
    expect(errors).toEqual([])
  })

  test(`@curated current card: one full video plus a ten percent peek, title and Win fixed (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const j = await boot(page)
    const frame = page.locator("[data-land-film]")
    await expect(frame).toBeVisible()
    const before = await page.evaluate(() => {
      const a = (window as any).__neural, f = a._landFilmEl, row = f.querySelector(".ng-cliprow"), clips = row.querySelectorAll(".ng-clip")
      const r = row.getBoundingClientRect(), one = clips[0].getBoundingClientRect(), two = clips[1].getBoundingClientRect()
      return { count: clips.length, peek: (r.right - two.left) / two.width, full: one.width <= r.width, height: a.currentFilmHeight(),
        title: f.querySelector(".ng-current-title").textContent, win: f.querySelector("[data-current-film-win]").textContent }
    })
    expect(before.count).toBeGreaterThan(1)
    expect(before.full).toBe(true)
    expect(before.peek).toBeGreaterThan(.085)
    expect(before.peek).toBeLessThan(.115)
    await expect(frame.locator("[data-choice-execute], [data-immediate-label]")).toHaveCount(0)
    await expect(frame.locator("[data-choice-shape]")).toHaveAttribute("data-choice-shape", "circle")
    await expect(frame.locator("[data-choice-number]")).toHaveCount(0)
    await expect(frame.locator(".ng-current-title")).toHaveText("Mount")
    await j.clickByMouse("[data-film-next]", "Next current-node video")
    await expect.poll(() => frame.locator(".ng-cliprow").evaluate(el => el.scrollLeft)).toBeGreaterThan(20)
    await expect(frame.locator(".ng-current-title")).toHaveText(before.title)
    await expect(frame.locator("[data-current-film-win]")).toHaveText(before.win)
    await expect(page.locator("[data-land-film]")).toHaveCount(1)
  })

  test(`@curated A uses the measured media height and preserves the outside deck arrows (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const errors: string[] = []; page.on("pageerror", e => errors.push(e.message))
    const j = await boot(page, "approved", { revealChoice: false })
    // U52 b: an asking question is a quiet line in the column's width, with no deck arrows to keep; the deck face
    // and its outside arrows are what this measures, so take the question up first.
    await j.openQuestion()
    await expect(page.locator("[data-land-film]")).toBeVisible()
    const geometry = () => page.evaluate(() => {
      const a = (window as any).__neural, media = a._landFilmEl.getBoundingClientRect(), face = a._landEl.getBoundingClientRect()
      return { mediaWidth: media.width, mediaHeight: media.height, reportedHeight: a.currentFilmHeight(), faceWidth: face.width,
        // U52 b (superseding D-368's stacked order): stacked, the current card follows the question and its backs
        // at the parts' step
        sideGap: face.left - media.right, footprint: face.right + 52 - media.left,
        followGap: media.top - face.bottom - 3 * (a._landStackEl?.childElementCount || 0),
        step: a._landEl.classList.contains("ng-land-deck") ? 16 : a.isMobile() ? 8 : 12,
        layout: a._reader.game.dataset.mediaLayout, hosts: document.querySelectorAll("[data-land-film]").length }
    })
    await expect.poll(async () => (await geometry()).layout).toBe(width > 640 ? "side-by-side" : "stacked")
    const g = await geometry()
    expect(g.hosts).toBe(1)
    expect(g.mediaWidth).toBe(width > 640 ? 400 : 358)
    expect(g.faceWidth).toBe(width > 640 ? 390 : 286)
    expect(g.reportedHeight).toBe(g.mediaHeight)
    expect(g.mediaHeight).toBeCloseTo(width > 640 ? 241.42 : 219.94, 0)
    if (width > 640) { expect(g.sideGap).toBe(60); expect(g.footprint).toBe(902) }
    else expect(g.followGap, "stacked: the current card follows the question at the parts' step").toBeCloseTo(g.step, 0)
    // The unchanged landcard-deck journeys pin the 44px arrow hit targets.
    // Flush observer/layout frames to catch a host resize feedback loop.
    await page.evaluate(async () => { for (let i = 0; i < 6; i++) await new Promise(requestAnimationFrame) })
    expect(await geometry()).toEqual(g)
    expect(errors).toEqual([])
  })
}

test("@curated keyboard can leave cross-origin playback and close the modal without reaching the page", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message))
  await boot(page, "approved", { crossOriginPlayer: true })
  const watch = page.locator(`${CARD} [data-choice-watch]`)
  // Establish the source control as the starting point. Every transition into,
  // within and out of the viewer below is a real browser keyboard action.
  await watch.focus()
  const before = await state(page)
  await page.keyboard.press("Enter")
  const dialog = page.locator("[data-choice-viewer]"), close = dialog.locator("[data-watch-close]")
  await expect(dialog).toBeVisible()
  await expect(close).toBeFocused()
  const player = dialog.locator("[data-test-player]")
  await expect(player).toHaveAttribute("src", "https://www.youtube-nocookie.com/embed/aaaaaaaaaaa")
  const play = page.frameLocator("[data-choice-viewer] [data-test-player]").getByRole("button", { name: "Play video" })
  await expect(play).toBeVisible()
  expect(await play.evaluate(() => location.origin)).not.toBe(new URL(page.url()).origin)
  await page.keyboard.press("Tab")
  await expect(play).toBeFocused()
  await page.keyboard.press("Enter")
  await expect.poll(() => page.evaluate(() => (window as any).__players[0].play)).toBe(1)
  // Escape inside the provider is not a reliable parent-dialog exit. The Close
  // control directly precedes the iframe, so Shift+Tab is an explicit exit path.
  await page.keyboard.press("Shift+Tab")
  await expect(close).toBeFocused()
  await page.keyboard.press("Tab")
  await expect(play).toBeFocused()
  await page.keyboard.press("Tab")
  await expect(dialog.getByRole("button", { name: "Close video", exact: true })).toBeFocused()
  await page.keyboard.press("Tab")
  await expect(close).toBeFocused()
  await page.keyboard.press("Shift+Tab")
  await expect(dialog.getByRole("button", { name: "Close video", exact: true })).toBeFocused()
  await page.keyboard.press("Shift+Tab")
  await expect(play).toBeFocused()
  await page.keyboard.press("Shift+Tab")
  await expect(close).toBeFocused()
  expect(await state(page)).toEqual(before)
  await page.keyboard.press("Enter")
  await expect(dialog).toHaveCount(0)
  await expect(watch).toBeFocused()
  expect(await state(page)).toEqual(before)
  expect(await page.evaluate(() => (window as any).__players[0].destroy)).toBe(1)
  expect(errors).toEqual([])
})

for (const front of ["later", "opposite", "none"] as const) {
  test(`@curated an ${front} front is suppressed, and its empty media still commits the card`, async ({ page }) => {
    const j = await boot(page, front)
    await expect(page.locator(`${CARD} [data-choice-watch], ${CARD} img`)).toHaveCount(0)
    const before = await state(page)
    await page.keyboard.press("Shift+Digit1")
    expect(await state(page)).toEqual(before)
    await j.clickByMouse(`${CARD} [data-choice-media]`, "Choose through the empty media region")
    expect((await state(page)).commits).toBe(before.commits + 1)
  })
}

for (const region of ["poster", "statistics", "border"] as const) {
  test(`@curated clicking the ${region} outside Play commits exactly once`, async ({ page }) => {
    await boot(page)
    // This is a card interaction check, not the integrated first-view fold check.
    // Expose the selected card at the rail's start, clear of the legacy dock.
    await page.locator(CARD).evaluate(card => card.scrollIntoView({ inline: "start", block: "nearest" }))
    const before = await state(page)
    const point = await page.locator(CARD).evaluate((card, region) => {
      const target = region === "poster" ? card.querySelector("[data-choice-media]")! : region === "statistics" ? card.querySelector("[data-choice-value]")! : card
      const r = target.getBoundingClientRect(), x = r.left + (region === "border" ? .5 : 12), y = r.top + r.height / 2
      const hit = document.elementFromPoint(x, y)
      return { x, y, card: !!hit && card.contains(hit), play: !!hit?.closest("[data-choice-watch]") }
    }, region)
    expect(point.card).toBe(true); expect(point.play).toBe(false)
    await page.mouse.click(point.x, point.y)
    expect((await state(page)).commits).toBe(before.commits + 1)
    await page.mouse.click(point.x, point.y)
    expect((await state(page)).commits).toBe(before.commits + 1)
  })
}

test("@curated dragging the hand across a card never commits or opens its video", async ({ page }) => {
  await boot(page)
  const before = await state(page), r = (await page.locator(`${CARD} .ngchoice-title`).boundingBox())!
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2)
  await page.mouse.down()
  await page.mouse.move(r.x + r.width / 2 - 45, r.y + r.height / 2, { steps: 8 })
  await page.mouse.up()
  expect(await state(page)).toEqual(before)
  await expect(page.locator("[data-choice-viewer]")).toHaveCount(0)
})
