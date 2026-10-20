import { test, expect, type Page } from "@playwright/test"
import { journey, type Journey } from "../dsl"

/** Pane-aware gameplay and reading, measured through rendered boxes.
 * The DSL authors films but reads complete prose from published HTML. The article
 * uses native scrolling; it stays below Browse's plane and preserves its position.
 * Prior virtual-More/pause-transfer mutants were retired with that interaction.
 * Current MDP sandbox control m38 (2026-10-14) removes paused lift retention:
 * both widths fail the unchanged vertical-clearance assertion.
 * External video playback is not covered by the harness. */

async function settle(page: Page, j: Journey) {
  await j.advance(100)
  await page.waitForTimeout(450) // CSS transitions use wall time; the graph uses pumped frames.
  await j.advance(3500)
  await page.evaluate(() => document.body.getBoundingClientRect().top)
  await j.advance(3500)
}

async function setup(page: Page) {
  const j = journey(page)
  await j.boot("/")
  // This is a layout journey; keep the question window beyond the sampled pane
  // transitions so an unrelated expiry announcement does not reframe the camera.
  await page.evaluate(() => (window as any).__neural.set("decisionSec", 120))
  await j.land("Mount Top")
  await page.evaluate(() => {
    const w = window as any, a = w.__neural
    const key = a.deckKeyFor(a.nodes[a.currentPos]).key
    w.NG_CONTENT ||= {}; w.NG_CONTENT.decks ||= {}
    w.NG_CONTENT.decks[key] = {
      cat: "Position", role: "Top", lead: "Pane layout fixture: a stable connection.",
      principles: Array.from({ length: 18 }, (_, i) => `Reading principle ${i + 1}: maintain the connection while your partner changes direction. Keep your base and leave room to adjust.`),
      clips: [
        { id: "aQ2vFXXBn-o", title: "First mounted demonstration" },
        { id: "aQ2vFXXBn-o", title: "Second mounted demonstration" },
      ],
    }
    a.onContentReady(key)
  })
  await expect(page.locator("[data-land-film] .ng-clip")).toHaveCount(2)
  await expect(page.locator('[data-reader-ready="true"]')).toBeVisible()
  await settle(page, j)
  if (await page.locator("[data-reward-close]").isVisible()) await j.clickByMouse("[data-reward-close]")
  return j
}

async function openPane(page: Page, j: Journey) {
  await j.clickByMouse(".ng-logo", "the pane opener")
  await expect(page.locator(".ng-drill")).toBeVisible()
  await settle(page, j)
}

async function closePane(page: Page, j: Journey) {
  await j.clickByMouse(".ng-explorer-close", "the pane close button")
  await settle(page, j)
}

const geometry = (page: Page) => page.evaluate(() => {
  const a = (window as any).__neural
  const box = (selector: string) => {
    const el = document.querySelector(selector) as HTMLElement
    if (!el) throw new Error(`Missing required surface ${selector}`)
    const r = el.getBoundingClientRect()
    let opacity = 1
    for (let p: HTMLElement | null = el; p; p = p.parentElement) opacity *= Number(getComputedStyle(p).opacity)
    return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom,
      center: r.x + r.width / 2, visible: getComputedStyle(el).visibility === "visible" && opacity > .9 }
  }
  const n = a.nodes[a.currentPos], mid = a.pairMid(n), scale = a.W / a.cam.vw
  return {
    card: box("[data-landcard]"), film: box("[data-land-film]"), more: box(".ng-reader-article"), hand: box(".ng-optionrow"),
    layout: a._reader.game.dataset.mediaLayout,
    pane: box(".ng-drill"), nav: box("[data-land-nav]"),
    node: { id: n.id, x: a.W / 2 + (mid.x - a.cam.cx) * scale, y: a.H / 2 + (mid.y - a.cam.cy) * scale },
    zoom: a.cam.vw, paused: !!a.paused, read: a._readerEl?.scrollTop || 0, open: !!a._reader?.interacting,
    selected: a._landPage, answers: a._landAnswers ? Array.from(a._landAnswers.keys()) : [],
  }
})

for (const width of [1440, 1024]) {
  test(`@curated ${width}px pane moves film, card, article and the projected current node together`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const j = await setup(page)
    await j.clickByMouse("[data-land-next]", "next flashcard before opening the pane")
    await settle(page, j)
    const before = await geometry(page)
    const question = await page.locator("[data-land-q]").innerText()
    expect(before.selected).toBe(1)

    await openPane(page, j)
    const open = await geometry(page)
    const shift = open.card.x - before.card.x
    expect(shift).toBeGreaterThan(80)
    // STALE CONTRACT (D-338): the article view never flips the film beside or over the card; the
    // film lives in its Videos section, sized by the article column, which narrows beside the pane.
    // So the card keeps its width, shift and vertical dock, and the film keeps its place in its
    // column. RETIRED with the side-by-side home: the film's fixed 400px and its stacked reflow.
    expect([before.layout, open.layout], 'no film home beside or over the card').toEqual(['none', 'none'])
    for (const surface of ["card", "film"] as const) {
      expect(open[surface].visible, `${surface} remains visible`).toBe(true)
      expect(open[surface].x).toBeGreaterThanOrEqual(open.pane.right)
      expect(open[surface].right).toBeLessThanOrEqual(width)
    }
    expect(open.card.width, "card keeps its readable width").toBeCloseTo(before.card.width, 0)
    expect(open.card.y, "card keeps its vertical dock").toBeCloseTo(before.card.y, 1)
    expect(open.film.x - open.more.x, "the film keeps its place in the article column").toBeCloseTo(before.film.x - before.more.x, 0)
    expect(open.film.right, "...and stays inside it").toBeLessThanOrEqual(open.more.right + .5)
    expect(open.film.y, "film keeps its vertical dock").toBeCloseTo(before.film.y, 0)
    expect(open.more.center - before.more.center).toBeCloseTo(open.pane.width / 2, -1)
    expect(open.more.right).toBeLessThanOrEqual(width)
    expect(open.nav.center).toBeCloseTo(open.card.center, 0)
    expect(open.node.x - before.node.x, "the visible node follows the available-space center").toBeCloseTo(open.pane.width / 2, -1)
    expect(open.node.x).toBeGreaterThan(open.pane.right)
    expect(open.node.y, "horizontal reframing preserves vertical clearance").toBeCloseTo(before.node.y, 0)
    expect(open.zoom).toBeCloseTo(before.zoom, 0)
    expect(open.selected).toBe(before.selected)
    expect(open.answers).toEqual(before.answers)
    await expect(page.locator("[data-land-q]")).toHaveText(question, { useInnerText: true })

    await closePane(page, j)
    const back = await geometry(page)
    for (const surface of ["card", "film", "more"] as const) expect(back[surface].x).toBeCloseTo(before[surface].x, 0)
    expect(back.node.x).toBeCloseTo(before.node.x, 0)
    expect(back.node.y).toBeCloseTo(before.node.y, 0)
    expect(back.node.id).toBe(before.node.id)
    expect(back.selected).toBe(before.selected)
  })
}

for (const viewport of [{ width: 768, height: 1024 }, { width: 390, height: 844 }]) {
  // D-338: Browse and Focus are gone; the logo's pane is the one Browse opened, and focusing the
  // prose is the reading interaction that Focus used to stand in for.
  test(`@curated ${viewport.width}px the pane overlays the article and preserves its place`, async ({ page }) => {
    await page.setViewportSize(viewport)
    const j = await setup(page)
    await expect(page.locator('[data-reader-ready="true"]')).toBeVisible()
    await page.locator("[data-reader-body]").focus()
    await page.keyboard.press("Control+End")
    await expect.poll(() => page.locator("[data-reader]").evaluate(e => e.scrollHeight - e.clientHeight - e.scrollTop)).toBeLessThan(2)
    const before = await page.locator("[data-reader]").evaluate(e => e.scrollTop)
    await openPane(page, j)
    const overlap = await page.evaluate(() => {
      const pane = document.querySelector(".ng-drill")!, article = document.querySelector(".ng-reader-article")!
      const p = pane.getBoundingClientRect(), r = article.getBoundingClientRect()
      const l = Math.max(p.left, r.left), right = Math.min(p.right, r.right), top = Math.max(p.top, r.top), bottom = Math.min(p.bottom, r.bottom)
      const hit = document.elementFromPoint((l + right) / 2, (top + bottom) / 2)
      return { width: right-l, height: bottom-top, pane: !!hit && pane.contains(hit) }
    })
    if (viewport.width <= 640) {
      expect(overlap.width).toBeGreaterThan(8)
      expect(overlap.height).toBeGreaterThan(8)
      expect(overlap.pane).toBe(true)
    } else expect(overlap.width, "the tablet article fits beside the pane").toBeLessThanOrEqual(0)
    await closePane(page, j)
    expect(await page.locator("[data-reader]").evaluate(e => e.scrollTop)).toBe(before)
    // Reading here is the prose interaction (D-338 retired Focus, which set reading intent).
    expect(await page.evaluate(() => ({ reading: !!(window as any).__neural._reader.interacting, paused: (window as any).__neural.paused }))).toEqual({ reading: true, paused: true })
  })
}

test("@curated exposed cards, videos and reading take real mouse input while the pane is open", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 })
  const j = await setup(page)
  // D-338: Questions follows Videos and Moves and can start below the fold: scroll to it first.
  await page.locator("[data-landcard]").evaluate(e => e.scrollIntoView({ block: "nearest" }))
  await settle(page, j)
  await openPane(page, j)
  const keyed = await geometry(page)
  await page.keyboard.press("ArrowRight")
  await page.keyboard.press("a")
  const afterKeys = await geometry(page)
  expect(afterKeys.selected, "pane keyboard priority does not page the landing deck").toBe(keyed.selected)
  expect(afterKeys.answers, "pane keyboard priority does not answer the landing question").toEqual(keyed.answers)
  await page.mouse.move(keyed.card.center, keyed.card.y + keyed.card.height / 2)
  await page.mouse.wheel(120, 0)
  await expect.poll(async () => (await geometry(page)).selected).toBe(1)
  await j.advance(100)
  expect((await geometry(page)).zoom, "horizontal card browsing never zooms the graph").toBeCloseTo(keyed.zoom, 1)
  await j.clickByMouse("[data-land-prev]", "return after the horizontal wheel")
  await j.clickByMouse("[data-land-next]", "the exposed next-card control")
  expect((await geometry(page)).selected).toBe(1)
  await j.clickByMouse("[data-land-prev]", "the exposed previous-card control")
  expect((await geometry(page)).selected).toBe(0)

  await j.clickByMouse('[data-land-film] .ng-clip[data-i="1"]', "an exposed video thumbnail")
  await expect(page.locator("[data-land-film] .ngPlayerHost")).toBeVisible()
  await page.waitForTimeout(450)
  // Playing the first film can mint the harness visitor's White Foundations patch.
  if (await page.locator("[data-reward-close]").isVisible()) {
    await j.clickByMouse("[data-reward-close]", "dismiss the earned patch")
    // A click outside the player legitimately collapses it; reopen now that the reward is gone.
    await expect(page.locator("[data-land-film] .ngPlayerHost")).toHaveCount(0)
    await settle(page, j)
    await j.clickByMouse('[data-land-film] .ng-clip[data-i="1"]', "the video after dismissing its reward")
    await page.waitForTimeout(450)
  }
  await j.clickByMouse("[data-land-film] .ngClipX", "the exposed video close button")
  await expect(page.locator("[data-land-film] .ngPlayerHost")).toHaveCount(0)
  await settle(page, j)

  // STALE CONTRACT (D-338): Focus, which took reading ownership and closed the pane, is gone.
  // Closing the pane and reading the prose take it now. Reopening the pane leaves the article's
  // native scroll position alone and never hands the clock back a miss.
  await closePane(page, j)
  await expect(page.locator('[data-reader-ready="true"]')).toBeVisible()
  await page.locator("[data-reader-body]").focus()
  await page.keyboard.press("Control+End")
  await expect.poll(() => page.locator("[data-reader]").evaluate(e => e.scrollHeight - e.clientHeight - e.scrollTop)).toBeLessThan(2)
  const before = await page.locator("[data-reader]").evaluate(e => e.scrollTop)
  await openPane(page, j)
  await page.mouse.move(180, 300)
  await page.mouse.wheel(0, 120)
  await page.waitForTimeout(100)
  // D-338: the Videos section now sizes with the article column, which narrows beside the pane, so
  // the document can shorten and the native scrollport clamps. The reader keeps its PLACE (the
  // article's end, not reset and not moved by the wheel over the pane), which is the claim.
  expect(await page.locator("[data-reader]").evaluate(e => e.scrollHeight - e.clientHeight - e.scrollTop), "the reader stays at the article's end").toBeLessThan(2)
  expect(await page.locator("[data-reader]").evaluate(e => e.scrollTop), "...and is never reset").toBeGreaterThan(before / 2)
  await closePane(page, j)
  await j.advance(20000)
  expect(await page.evaluate(() => (window as any).__neural.paused)).toBe(true)
})

test("@curated resizing an open pane preserves the card through the stacked landscape flow", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const j = await setup(page)
  await j.clickByMouse("[data-land-next]")
  await openPane(page, j)
  const desktop = await geometry(page)
  await page.setViewportSize({ width: 844, height: 390 })
  await settle(page, j)
  const landscape = await geometry(page)
  expect(landscape.selected).toBe(desktop.selected)
  expect(landscape.node.id).toBe(desktop.node.id)
  expect(landscape.card.visible).toBe(true)
  // STALE CONTRACT (D-338): the landscape flow reads Videos, Moves, Questions (no stacked film home).
  expect(landscape.layout).toBe('none')
  expect(landscape.film.bottom, "Videos sits above Moves").toBeLessThanOrEqual(landscape.hand.y)
  expect(landscape.card.y - landscape.hand.bottom, "Questions follows Moves at the deck gap").toBeCloseTo(16, 0)
  expect(landscape.film.right, "the composition stays within the viewport").toBeLessThanOrEqual(844)
  await closePane(page, j)
  const closed = await geometry(page)
  expect(closed.layout).toBe('none')
  expect(closed.card.center).toBeCloseTo(844 / 2, 0)
  expect(closed.film.center).toBeCloseTo(844 / 2, 0)
  await openPane(page, j)
  await page.setViewportSize({ width: 1440, height: 900 })
  await settle(page, j)
  const back = await geometry(page)
  expect(back.card.x).toBeCloseTo(desktop.card.x, 0)
  expect(back.film.x).toBeCloseTo(desktop.film.x, 0)
  expect(back.selected).toBe(desktop.selected)
})
