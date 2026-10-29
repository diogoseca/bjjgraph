import { test, expect, type Page } from "@playwright/test"
import { journey, type Journey } from "../dsl"

/** Pane-aware gameplay and reading, measured through rendered boxes.
 * The DSL authors films but reads complete prose from published HTML. The article
 * uses native scrolling; it stays below Browse's plane and preserves its position.
 * Prior virtual-More/pause-transfer mutants were retired with that interaction.
 * Current MDP sandbox control m38 (2026-10-14) removes paused lift retention:
 * both widths fail the unchanged vertical-clearance assertion.
 * NOT the gate for D-347's rest lift since v1.237.0 (PR #320's review): reading-band-lift-restored no longer turns
 * line 131 red, because this journey's first landing is the directed arrival, which never flies and so never engages
 * the follow-cam's band lift. That claim is pinned at the source by tests/camera_motion.test.mjs ("in the reading
 * view the follow-cam engages no lift at rest"), which the same mutation turns red.
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
  await j.openQuestion() // U47 d: the deck pages (and the pane declines a live question) once the card is shown.
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
    backs: a._landStackEl?.childElementCount ?? 0,
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
    // STALE CONTRACT (D-368, layout C): the A geometry is back as the stage under Moves: the current card
    // sits beside the question (400 + 60 + 390), and where the pane leaves less than that it stacks above
    // it. So the A-era claims return (the film's 400px and the stacked reflow), with Moves above the stage.
    // STALE CONTRACT (D-368's stacked order): U52 b puts the question straight after Moves, so a stacked
    // reflow keeps the question under Moves and the current card follows the question's backs.
    const shift = open.card.x - before.card.x, reflow = open.layout !== before.layout
    expect(before.layout, 'the closed pane leaves room for the card beside the question').toBe('side-by-side')
    if (!reflow) expect(shift).toBeGreaterThan(80)
    for (const surface of ["card", "film"] as const) {
      expect(open[surface].visible, `${surface} remains visible`).toBe(true)
      expect(open[surface].x).toBeGreaterThanOrEqual(open.pane.right)
      expect(open[surface].right).toBeLessThanOrEqual(width)
      if (!reflow) {
        expect(open[surface].width, `${surface} keeps its readable width`).toBeCloseTo(before[surface].width, 0)
        expect(open[surface].x - before[surface].x, `${surface} moves with the card`).toBeCloseTo(shift, 0)
        expect(open[surface].y, `${surface} keeps its vertical dock`).toBeCloseTo(before[surface].y, 0)
      }
    }
    if (reflow) {
      expect(open.layout).toBe('stacked')
      expect(open.film.width).toBe(400)
      expect(open.card.width).toBe(Math.min(560, width - open.pane.width - 104))
      expect(open.card.y - open.hand.bottom, 'the question follows Moves at the deck gap').toBeCloseTo(16, 0)
      expect(open.film.y - (open.card.bottom + 3 * open.backs), "the current card follows the question's backs at the deck gap").toBeCloseTo(16, 0)
    }
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
  // D-368 (layout C): at 1024 the open pane leaves too little width for the card beside the question, so the
  // stage stacks. U52 b: the question stays straight after Moves and the current card follows it; a reader
  // still scrolls to the question again, which is a no-op when it is already in view.
  await page.locator("[data-landcard]").evaluate(e => e.scrollIntoView({ block: "nearest" }))
  await settle(page, j)
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

  // STALE SPEC (v1.230.0, feat/video-cards): the current card shows one full video and a 10% peek of the
  // next, so the exposed thumbnail is the first; the peek's centre sits off screen beside the pane.
  // U52 b: stacked, the current card follows the question, so a reader scrolls to it, as to the question above.
  await page.locator('[data-land-film] .ng-clip[data-i="0"]').evaluate(e => e.scrollIntoView({ block: "nearest" }))
  await settle(page, j)
  await j.clickByMouse('[data-land-film] .ng-clip[data-i="0"]', "an exposed video thumbnail")
  await expect(page.locator("[data-land-film] .ngPlayerHost")).toBeVisible()
  await page.waitForTimeout(450)
  // Playing the first film can mint the harness visitor's White Foundations patch.
  if (await page.locator("[data-reward-close]").isVisible()) {
    await j.clickByMouse("[data-reward-close]", "dismiss the earned patch")
    // A click outside the player legitimately collapses it; reopen now that the reward is gone.
    await expect(page.locator("[data-land-film] .ngPlayerHost")).toHaveCount(0)
    await settle(page, j)
    await j.clickByMouse('[data-land-film] .ng-clip[data-i="0"]', "the video after dismissing its reward")
    await page.waitForTimeout(450)
  }
  await j.clickByMouse("[data-land-film] .ngClipX", "the exposed video close button")
  await expect(page.locator("[data-land-film] .ngPlayerHost")).toHaveCount(0)
  await settle(page, j)

  // STALE SPEC (D-368, layout C): the current card is a game part, so playing it is no longer reading (a Videos
  // clip was, D-338). The prose is read beside the open pane instead. The pane's close resumes the game it paused
  // while the reader still reads, and the next reading input must stop it again (d338-running-reader-not-paused).
  await page.evaluate(() => (window as any).__neural._reader.articleEl.scrollIntoView({ block: "start" }))
  await settle(page, j)
  const prose = await page.evaluate(() => { const r = (window as any).__neural._reader, b = r.articleEl.getBoundingClientRect(), v = r.root.getBoundingClientRect()
    const top = Math.max(b.top, v.top), bottom = Math.min(b.bottom, v.bottom, innerHeight); return { x: (b.left + b.right) / 2, y: (top + bottom) / 2, visible: bottom - top } })
  expect(prose.visible, "premise: the prose shows beside the open pane").toBeGreaterThan(40)
  await page.mouse.move(prose.x, prose.y)
  await page.mouse.wheel(0, 40)
  await expect.poll(() => page.evaluate(() => !!(window as any).__neural._reader.interacting), "premise: reading beside the open pane").toBe(true)
  // STALE CONTRACT (D-338): Focus, which took reading ownership and closed the pane, is gone.
  // Closing the pane and reading the prose take it now. Reopening the pane leaves the article's
  // native scroll position alone and never hands the clock back a miss.
  await closePane(page, j)
  expect(await page.evaluate(() => ({ reading: !!(window as any).__neural._reader.interacting, paused: (window as any).__neural.paused })),
    "premise: the pane's close resumes the game it paused, while the reader still reads").toEqual({ reading: true, paused: false })
  await expect(page.locator('[data-reader-ready="true"]')).toBeVisible()
  await page.locator("[data-reader-body]").focus()
  await page.keyboard.press("Control+End")
  expect(await page.evaluate(() => (window as any).__neural.paused), "the next reading input stops the game again").toBe(true)
  await expect.poll(() => page.locator("[data-reader]").evaluate(e => e.scrollHeight - e.clientHeight - e.scrollTop)).toBeLessThan(2)
  const before = await page.locator("[data-reader]").evaluate(e => e.scrollTop)
  await openPane(page, j)
  await page.mouse.move(180, 300)
  await page.mouse.wheel(0, 120)
  await page.waitForTimeout(100)
  // D-338: the Videos section now sizes with the article column, which narrows beside the pane, so
  // the document can change length. The pane never scrolls the reader: scrollTop is unchanged
  // unless the browser clamps it to a shorter document, and a wheel over the pane moves nothing.
  const after = await page.locator("[data-reader]").evaluate(e => ({ top: e.scrollTop, max: e.scrollHeight - e.clientHeight }))
  expect(after.top, `the pane leaves the native scroll position alone (${JSON.stringify({ before, ...after })})`).toBe(Math.min(before, after.max))
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
  // STALE CONTRACT (D-368, layout C): a short landscape has no room beside the question, so the stage stacks:
  // Moves, then the current card, then the question at 12px. STALE CONTRACT (that stacked order): U52 b puts
  // the question straight after Moves, and the current card follows the question's backs at the deck gap.
  expect(landscape.layout).toBe('stacked')
  expect(landscape.film.y, "the stage follows Moves").toBeGreaterThanOrEqual(landscape.hand.bottom)
  expect(landscape.film.y - (landscape.card.bottom + 3 * landscape.backs), "the current card follows the question's backs at the deck gap").toBeCloseTo(16, 0)
  expect(landscape.film.right, "the composition stays within the viewport").toBeLessThanOrEqual(844)
  await closePane(page, j)
  const closed = await geometry(page)
  expect(closed.layout).toBe('stacked')
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
