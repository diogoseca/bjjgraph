import { test, expect } from "@playwright/test"
import { journey } from "../dsl"

// The canvas is hidden by CSS, but graph picking is an independent coordinate
// search on the wrapper. Prove that the same real node is inert while hidden and
// selectable again after restoration. Pan, wheel and pinch must be inert too.
// MDP sandbox controls, 2026-10-14: m40 restores coordinate input while hidden
// (two reds); m41 retains the captured gesture across hide/restore (two reds).
for (const width of [1440, 390]) {
  test(`@curated ${width}px hidden Map rejects graph input and restores selection`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const j = journey(page)
    // D-338 retired Focus: the same quiet map view is seeded through the game layers it overrode.
    await j.boot("/Positions/Mount", { initialState: { v: 2, settings: {
      landFilm: false, landCard: false, landHand: false, landFeedback: false, readerBook: false,
    }, settingsAt: {} } })
    await expect(page.locator('[data-reader-ready="true"]')).toHaveCount(1)
    await j.advance(8000)
    const target = await page.evaluate(() => {
      const a = (window as any).__neural
      const n = a.nodes.find((n: any) => n.id === "Positions/Half-Guard")
      if (!n) throw new Error("Real Half Guard node missing")
      a.frameNodes([n.idx])
      return n.idx
    })
    await j.advance(4000)
    const point = await page.evaluate(idx => {
      const a = (window as any).__neural, n = a.nodes[idx]
      // Read the draw-published lift and camera, as the existing camera journeys do.
      return { x: a.W / 2 + (n.x - a.cam.cx) * a.W / a.cam.vw,
        y: a.H / 2 + (a._LY(n) - a.cam.cy) * a.W / a.cam.vw }
    }, target)
    expect(await page.evaluate(p => document.elementFromPoint(p.x, p.y)?.tagName, point)).toBe("CANVAS")
    await page.mouse.move(point.x, point.y)
    expect(await page.evaluate(() => (window as any).__neural._hover?.idx)).toBe(target)
    await j.clickByMouse('[data-layer-hide="map"]')
    expect(await page.evaluate(p => document.elementFromPoint(p.x, p.y)?.tagName, point)).toBe("DIV")
    const snapshot = () => page.evaluate(() => {
      const a = (window as any).__neural
      return { seat: a.currentPos, url: location.href, intent: a._readerIntent,
        cam: [a.cam.cx, a.cam.cy, a.cam.vw],
        target: [a.camTarget.cx, a.camTarget.cy, a.camTarget.vw], beats: a.beats.length }
    })
    const before = await snapshot()
    expect(before).toMatchObject({ intent: true })
    await page.mouse.click(point.x, point.y)
    expect(await snapshot(), "the former node cannot select a seat or leave reading").toEqual(before)
    await page.mouse.move(point.x, point.y)
    expect(await page.evaluate(() => (window as any).__neural._hover)).toBeNull()
    await page.mouse.down()
    await page.mouse.move(point.x - 60, point.y + 40, { steps: 6 })
    await page.mouse.up()
    await page.mouse.wheel(0, 300)
    const cdp = await page.context().newCDPSession(page)
    const fingers = (d: number) => [{ x: point.x - d, y: point.y, id: 1 }, { x: point.x + d, y: point.y, id: 2 }]
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: fingers(25) })
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: fingers(70) })
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
    expect(await snapshot(), "hidden graph gestures cannot change its camera, seat or intent").toEqual(before)
    await j.clickByMouse('[data-layer-show="map"]')
    expect(await page.evaluate(p => document.elementFromPoint(p.x, p.y)?.tagName, point)).toBe("CANVAS")
    // Switch Map off during an existing press, then restore it before release.
    // The old captured pointer must not resume its drag or become a ghost click.
    await page.mouse.move(point.x, point.y)
    await page.mouse.down()
    await page.locator('[data-layer-hide="map"]').focus()
    await page.keyboard.press("Enter")
    await page.mouse.move(point.x - 40, point.y + 30, { steps: 3 })
    await page.locator('[data-layer-show="map"]').focus()
    await page.keyboard.press("Enter")
    const restored = await snapshot()
    await page.mouse.move(point.x - 65, point.y + 45, { steps: 3 })
    await page.mouse.up()
    expect(await snapshot(), "a gesture begun before hiding cannot resume after Map restoration").toEqual(restored)
    expect(restored).toEqual(before)
    await page.mouse.click(point.x, point.y)
    expect(await page.evaluate(() => (window as any).__neural.currentPos)).toBe(target)
    expect(new URL(page.url()).pathname).toBe("/Positions/Half-Guard")
    expect(await snapshot()).toMatchObject({ intent: false })
  })
}
