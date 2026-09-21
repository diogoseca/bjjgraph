import { test, expect, type Page } from "@playwright/test"
import { journey, type Journey } from "../dsl"

/**
 * Pane-aware gameplay composition, measured through rendered boxes and the actual camera.
 * The harness omits dossier chunks: film and the long More body are authored here so their
 * absence cannot satisfy overlap or reflow assertions. Video coverage proves the reachable
 * player host, not external playback (the harness aborts non-local requests).
 * Camera samples use the rendered pair midpoint and cam, never the requested camTarget.
 * Negative control: the original HEAD bundle fails desktop reflow (0px shift) and phone
 * overlap (hidden card). Individual camera, pause-owner and input mutants were not run here.
 */

async function settle(page: Page, j: Journey) {
  await j.advance(100)
  await page.waitForTimeout(450) // CSS transitions use wall time; the graph uses pumped frames.
  await j.advance(3500)
}

async function setup(page: Page) {
  const j = journey(page)
  await j.boot("/")
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
  await expect(page.locator("[data-land-more]")).toBeVisible()
  await settle(page, j)
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
    card: box("[data-landcard]"), film: box("[data-land-film]"), more: box(".ng-landmore"),
    pane: box(".ng-drill"), nav: box("[data-land-nav]"),
    node: { id: n.id, x: a.W / 2 + (mid.x - a.cam.cx) * scale, y: a.H / 2 + (mid.y - a.cam.cy) * scale },
    zoom: a.cam.vw, paused: !!a.paused, read: a._readS || 0, open: !!a._landOpen,
    selected: a._landPage, answers: a._landAnswers ? Array.from(a._landAnswers.keys()) : [],
  }
})

for (const width of [1440, 1024]) {
  test(`@curated ${width}px pane moves film, card, More and the projected current node together`, async ({ page }) => {
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
    for (const surface of ["card", "film", "more"] as const) {
      expect(open[surface].visible, `${surface} remains visible`).toBe(true)
      expect(open[surface].width, `${surface} keeps its readable width`).toBeCloseTo(before[surface].width, 0)
      expect(open[surface].x - before[surface].x, `${surface} moves with the card`).toBeCloseTo(shift, 0)
      expect(open[surface].y, `${surface} keeps its vertical dock`).toBeCloseTo(before[surface].y, 0)
    }
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
  test(`@curated ${viewport.width}px overlapping gameplay surfaces stay readable beneath the pane`, async ({ page }) => {
    await page.setViewportSize(viewport)
    const j = await setup(page)
    await j.clickByMouse("[data-land-more]", "More before opening the pane")
    await settle(page, j)
    const before = await geometry(page)
    await openPane(page, j)
    const open = await geometry(page)
    expect(open.open, "opening the pane preserves expanded More").toBe(true)
    expect(open.card.width).toBeCloseTo(before.card.width, 0)
    if (viewport.width <= 640) expect(open.card.x, "the phone drawer overlays without shifting the column").toBeCloseTo(before.card.x, 0)
    else expect(open.card.x).toBeGreaterThan(before.card.x)

    const overlaps = await page.evaluate(() => {
      const pane = document.querySelector(".ng-drill")!, pr = pane.getBoundingClientRect()
      return ["[data-landcard]", "[data-land-film]", ".ng-landmore"].map(selector => {
        const el = document.querySelector(selector)!, r = el.getBoundingClientRect()
        const left = Math.max(pr.left, r.left, 0), right = Math.min(pr.right, r.right, innerWidth)
        const top = Math.max(pr.top, r.top, 0), bottom = Math.min(pr.bottom, r.bottom, innerHeight)
        const hit = document.elementFromPoint((left + right) / 2, (top + bottom) / 2)
        return { selector, width: right - left, height: bottom - top, paneWins: !!hit && pane.contains(hit), visibility: getComputedStyle(el).visibility }
      })
    })
    for (const overlap of overlaps) {
      expect(overlap.width, `${overlap.selector} really overlaps horizontally`).toBeGreaterThan(8)
      expect(overlap.height, `${overlap.selector} really overlaps vertically`).toBeGreaterThan(8)
      expect(overlap.visibility).toBe("visible")
      expect(overlap.paneWins, `${overlap.selector} is beneath the pane at the intersection`).toBe(true)
    }
    await closePane(page, j)
    expect((await geometry(page)).open).toBe(true)
    expect((await geometry(page)).paused, "More keeps the roll paused after the pane closes").toBe(true)
  })
}

test("@curated exposed cards, videos and More take real mouse input while the pane is open", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 })
  const j = await setup(page)
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

  await j.clickByMouse("[data-land-more]", "the exposed More control")
  await settle(page, j)
  const before = await geometry(page)
  expect(before.open).toBe(true)
  await expect(page.locator("[data-land-more-body]")).toContainText("Reading principle 18")
  await page.mouse.move(before.more.center, Math.min(830, before.more.y + 90))
  await page.mouse.wheel(0, 120)
  await expect.poll(async () => (await geometry(page)).read).toBeGreaterThan(before.read)
  const scrolled = await geometry(page)
  expect(scrolled.card.y).toBeLessThan(before.card.y)
  expect(scrolled.film.y - before.film.y).toBeCloseTo(scrolled.card.y - before.card.y, 0)

  await page.mouse.move(180, 300)
  await page.mouse.wheel(0, 120)
  await page.waitForTimeout(100)
  expect((await geometry(page)).read, "a wheel over the pane does not scroll the reading column").toBe(scrolled.read)
  await closePane(page, j)
  const closed = await geometry(page)
  expect(closed.read, "pane movement preserves the reading position").toBe(scrolled.read)
  expect(closed.selected).toBe(before.selected)
  expect(closed.open).toBe(true)
  expect(closed.paused).toBe(true)
})

for (const first of ["pane", "More"] as const) {
  test(`@curated ${first} releases its pause only after the other surface closes`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    const j = await setup(page)
    if (first === "pane") await openPane(page, j)
    await j.clickByMouse("[data-land-more]", "More")
    await settle(page, j)
    if (first === "More") await openPane(page, j)
    expect((await geometry(page)).paused).toBe(true)

    if (first === "pane") await closePane(page, j)
    else {
      await j.clickByMouse("[data-land-more]", "Less while the pane stays open")
      await settle(page, j)
    }
    expect((await geometry(page)).paused, "closing the first pauser preserves the other pause").toBe(true)
    if (first === "pane") await j.clickByMouse("[data-land-more]", "Less after closing the pane")
    else await closePane(page, j)
    expect((await geometry(page)).paused, "the last release resumes the originally running roll").toBe(false)
  })
}

test("@curated resizing an open pane keeps the selected card and the short-landscape composition", async ({ page }) => {
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
  expect(landscape.film.x, "film remains in the right-hand landscape column").toBeGreaterThan(landscape.card.right)
  expect(landscape.film.right, "the composition stays within the viewport").toBeLessThanOrEqual(844)
  await closePane(page, j)
  const closed = await geometry(page)
  expect(closed.card.x, "a composition already against the right edge does not shift for the pane").toBeCloseTo(landscape.card.x, 0)
  expect(closed.film.x).toBeCloseTo(landscape.film.x, 0)
  await openPane(page, j)
  await page.setViewportSize({ width: 1440, height: 900 })
  await settle(page, j)
  const back = await geometry(page)
  expect(back.card.x).toBeCloseTo(desktop.card.x, 0)
  expect(back.film.x).toBeCloseTo(desktop.film.x, 0)
  expect(back.selected).toBe(desktop.selected)
})
