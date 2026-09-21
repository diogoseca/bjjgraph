import { test, expect, type Page } from "@playwright/test"
import { journey, type Journey } from "../dsl"

// Measure the actual camera through draw's projection and pairMid's published lift. A target
// assignment alone cannot prove framing: follow-cam can overwrite it on the following frame.
// These fixtures keep the roll paused; running follow-cam and landing layout are covered by
// pane-chrome. No dossier/video content is needed for camera ownership.
const DESKTOP = { width: 1440, height: 900 }
const PHONE = { width: 390, height: 844 }
test.use({ viewport: DESKTOP })

const screen = (page: Page, idx: number) => page.evaluate((i) => {
  const a = (window as any).__neural
  const p = a.pairMid(a.nodes[i]), scale = a.W / a.cam.vw
  return {
    W: a.W, H: a.H,
    x: a.W / 2 + (p.x - a.cam.cx) * scale,
    y: a.H / 2 + (p.y - a.cam.cy) * scale,
    zoom: a.cam.vw, cy: a.cam.cy, currentPos: a.currentPos,
    paused: a.paused, held: a.camHeld(), paneShown: a.deckShown,
    paneWidth: a.drillRef.current.getBoundingClientRect().width,
  }
}, idx)

const settle = async (j: Journey) => {
  // A separate evaluation between advances lets DOM docking and draw publish their geometry.
  await j.advance(3000)
  await j.advance(3000)
}

const openPane = async (page: Page, j: Journey) => {
  await j.clickByMouse(".ng-logo", "open the learning pane")
  await expect(page.locator(".ng-drill")).toBeVisible()
  await settle(j)
}

const closePane = async (page: Page, j: Journey) => {
  await j.clickByMouse(".ng-explorer-close", "close the learning pane")
  await expect(page.locator(".ng-drill")).toBeHidden()
  await settle(j)
}

const bootPaused = async (page: Page) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await page.evaluate(() => {
    const a = (window as any).__neural
    a.setPaused(true)
    a._stagedCamFree = false
  })
  await settle(j)
  const idx = await page.evaluate(() => (window as any).__neural.currentPos)
  return { j, idx }
}

const distantSubject = (page: Page) => page.evaluate(() => {
  const a = (window as any).__neural, here = a.pairMid(a.nodes[a.currentPos])
  let best = -1, distance = -1
  for (const n of a.nodes) {
    if (n.ty !== "positions" || !a.rsAllowsIdx(n.idx)) continue
    const p = a.pairMid(n), d = Math.hypot(p.x - here.x, p.y - here.y)
    if (d > distance) { best = n.idx; distance = d }
  }
  if (best < 0) throw new Error("fixture requires a position away from the current roll")
  return best
})

test("a manually panned paused view moves with the pane and restores across resizing @curated", async ({ page }) => {
  const { j, idx } = await bootPaused(page)
  const initial = await screen(page, idx)
  // Seed the same camera state a completed pan leaves: the user's view owns both positions,
  // with no lease or staged follow-cam. The pane itself is always driven by a measured mouse.
  await page.evaluate(() => {
    const a = (window as any).__neural, scale = a.W / a.cam.vw
    a.releaseCamera()
    a.cam.cx -= 80 / scale
    a.cam.cy += 35 / scale
    a.camTarget = { ...a.cam }
    a.lastInteract = a.now
  })
  await j.advance(100)
  const before = await screen(page, idx)
  expect(before.x - initial.x).toBeCloseTo(80, 1)
  expect(before.y - initial.y).toBeCloseTo(-35, 1)

  await openPane(page, j)
  const opened = await screen(page, idx)
  expect(opened.x - before.x, "pan subject moves by half the measured pane width").toBeCloseTo(opened.paneWidth / 2, 1)
  expect(opened.y).toBeCloseTo(before.y, 1)
  expect(opened.zoom).toBeCloseTo(before.zoom, 5)
  expect(opened.paused).toBe(true)
  expect(opened.held).toBe(false)
  expect(opened.currentPos).toBe(before.currentPos)

  await closePane(page, j)
  const closed = await screen(page, idx)
  expect(closed.x).toBeCloseTo(before.x, 1)
  expect(closed.y).toBeCloseTo(before.y, 1)
  expect(closed.zoom).toBeCloseTo(before.zoom, 5)
  expect(closed.paused, "closing a pane does not release a manual pause").toBe(true)

  await openPane(page, j)
  await page.setViewportSize(PHONE)
  await settle(j)
  const phone = await screen(page, idx)
  expect(phone.paneShown).toBe(true)
  expect(phone.x, "phone drawer overlays the user's original view without a desktop inset")
    .toBeCloseTo(PHONE.width / 2 + (before.x - before.W / 2) * PHONE.width / before.W, 1)
  expect(phone.cy).toBeCloseTo(before.cy, 5)
  expect(phone.zoom).toBeCloseTo(before.zoom, 5)

  await page.setViewportSize(DESKTOP)
  await settle(j)
  const resized = await screen(page, idx)
  expect(resized.x - before.x).toBeCloseTo(resized.paneWidth / 2, 1)
  await closePane(page, j)
  expect((await screen(page, idx)).x).toBeCloseTo(before.x, 1)
})

test("a leased selection zoom retains its subject while the pane opens, closes and resizes @curated", async ({ page }) => {
  const { j, idx: current } = await bootPaused(page)
  const subject = await distantSubject(page)
  expect(subject).not.toBe(current)
  await page.evaluate((i) => {
    const a = (window as any).__neural
    a.frameNodes([i])
    a.holdCamera(120)
  }, subject)
  await settle(j)
  const before = await screen(page, subject)
  expect(before.x).toBeCloseTo(before.W / 2, 1)
  expect(before.y).toBeCloseTo(before.H / 2, 1)
  expect(before.held).toBe(true)
  const currentScreen = await screen(page, current)
  expect(Math.hypot(currentScreen.x - before.x, currentScreen.y - before.y)).toBeGreaterThan(100)

  // Put the leased flight back into motion without replacing its destination. This catches
  // applying a fixed world-space pane offset while the flight's zoom continues changing.
  await page.evaluate(() => {
    const a = (window as any).__neural
    a.cam.vw *= 1.8
    a.cam.lvw = Math.log(a.cam.vw)
  })
  expect((await screen(page, subject)).zoom).toBeGreaterThan(before.zoom * 1.7)
  await openPane(page, j)
  const opened = await screen(page, subject)
  expect(opened.x - before.x).toBeCloseTo(opened.paneWidth / 2, 1)
  expect(opened.y).toBeCloseTo(before.y, 1)
  expect(opened.zoom).toBeCloseTo(before.zoom, 1)
  expect(opened.held).toBe(true)
  expect(opened.currentPos).toBe(current)

  await closePane(page, j)
  const closed = await screen(page, subject)
  expect(closed.x).toBeCloseTo(before.x, 1)
  expect(closed.zoom).toBeCloseTo(before.zoom, 1)
  expect(closed.held).toBe(true)

  await openPane(page, j)
  await page.setViewportSize(PHONE)
  await settle(j)
  const phone = await screen(page, subject)
  expect(phone.x).toBeCloseTo(PHONE.width / 2, 1)
  expect(phone.y).toBeCloseTo(PHONE.height / 2, 1)
  expect(phone.zoom).toBeCloseTo(before.zoom, 1)
  expect(phone.held).toBe(true)
  expect(phone.currentPos).toBe(current)
})

for (const flight of ["locate", "replay"] as const) {
  test(`${flight} framing applies the pane inset once and removes it on close`, async ({ page }) => {
    const { j } = await bootPaused(page)
    const subject = await distantSubject(page)
    const aim = () => page.evaluate(({ idx, kind }) => {
      const a = (window as any).__neural
      if (kind === "locate") a.locateNode(idx)
      else a._replayAim([idx], 90)
    }, { idx: subject, kind: flight })
    await aim()
    await settle(j)
    const before = await screen(page, subject)
    expect(before.x).toBeGreaterThan(before.W * .3)
    expect(before.x).toBeLessThan(before.W * .6)

    await openPane(page, j)
    await aim() // a fresh explicit target while open must not duplicate updateCamera's inset
    await settle(j)
    const opened = await screen(page, subject)
    expect(opened.x - before.x).toBeCloseTo(opened.paneWidth / 2, 0)
    expect(opened.zoom).toBeCloseTo(before.zoom, 1)

    await closePane(page, j)
    const closed = await screen(page, subject)
    expect(closed.x).toBeCloseTo(before.x, 0)
    expect(closed.zoom).toBeCloseTo(before.zoom, 1)
  })
}
