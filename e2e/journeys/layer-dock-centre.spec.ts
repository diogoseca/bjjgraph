import { test, expect, type Page } from "@playwright/test"
import { journey, type Journey } from "../dsl"

/** v1.253.0 (owner, U114 a, 2026-11-09): the shelf this file was named for is retired, and with it the map view (Book off) where
 * its dock tests ran: seven tests deleted, the dock under the column with the pane open (1440, 1024, 800), its pane-slide and resize
 * passes, short landscape, and the phone's 44px glyphs beside the share cue. What stays is the replay bar's own claim, which never
 * depended on the shelf: a replay started from the open pane plays under the column, clear of the pane. */

async function settle(page: Page, j: Journey) {
  await j.advance(100)
  await page.waitForTimeout(450) // CSS transitions use wall time; the graph uses pumped frames.
  await j.advance(3500)
}

type Box = { l: number; r: number; t: number; b: number; w: number; h: number; c: number }
type Geo = {
  W: number; col: number; pane: Box | null; card: Box | null; article: Box | null; film: Box | null; dock: Box | null; replay: Box | null
  glyphs: { layer: string | null; box: Box; own: boolean }[]
}

const geo = (page: Page): Promise<Geo> => page.evaluate(() => {
  const rect = (el: Element): any => {
    const q = el.getBoundingClientRect()
    return { l: q.left, r: q.right, t: q.top, b: q.bottom, w: q.width, h: q.height, c: q.left + q.width / 2 }
  }
  const box = (sel: string) => { const el = document.querySelector(sel); return el && !(el as HTMLElement).hidden ? rect(el) : null }
  const pane = document.querySelector(".ng-drill") as HTMLElement
  return {
    W: innerWidth,
    col: (() => {
      const drawer = pane && getComputedStyle(pane).display !== "none" ? pane.getBoundingClientRect() : null
      return (window as any).__neural.isMobile() || !drawer ? innerWidth / 2 : (innerWidth + Math.max(0, drawer.right)) / 2
    })(),
    pane: pane && getComputedStyle(pane).display !== "none" ? rect(pane) : null,
    card: box("[data-landcard]"), article: box(".ng-reader-article"), film: box("[data-land-film]"), dock: box("[data-layer-dock]"),
    replay: box("[data-replay-bar]"),
    glyphs: Array.from(document.querySelectorAll("[data-layer-show]")).map((b) => {
      const q = rect(b)
      const hit = q.c >= 0 && q.c <= innerWidth ? document.elementFromPoint(q.c, q.t + q.h / 2) : null
      return { layer: b.getAttribute("data-layer-show"), box: q, own: !!hit && (hit === b || b.contains(hit)) }
    }),
  }
})

/** Two published centres agree to a pixel (subpixel positions round differently per element). */
const same = (a: number | undefined, b: number | undefined, what: string) => {
  expect(a, `${what}: first centre measured`).toBeDefined()
  expect(b, `${what}: second centre measured`).toBeDefined()
  expect(Math.abs(a! - b!), `${what} (${a!.toFixed(1)} vs ${b!.toFixed(1)})`).toBeLessThanOrEqual(1)
}


for (const width of [1440, 1024]) {
  test(`${width}px a replay started from the open pane plays under the column, clear of the pane`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const j = journey(page)
    await j.boot("/")
    await j.land("Mount Top")
    // one archived roll (history-replay.spec.ts's recipe): take exchanges until the roll moved
    let moved = 1
    for (let n = 0; n < 5 && moved < 2; n++) {
      await j.rig("resolve", [0.01])
      await j.rig("outcome", [0.01])
      const titles = await j.optionTitles()
      await j.pick(titles[Math.min(n, titles.length - 1)])
      await j.nextHand()
      moved = await page.evaluate(() => ((window as any).__neural.rollLog || []).length)
    }
    expect(moved, "premise: the roll has an edge to replay").toBeGreaterThan(1)
    await page.evaluate(() => { const a = (window as any).__neural; a.rollFromPosition(a.currentPos, true) })
    await j.advance(1500)
    await page.evaluate(() => { for (const b of Array.from(document.querySelectorAll("[data-reward-close]"))) (b as HTMLElement).click() })
    const ts = await page.evaluate(() => ((window as any).__neural._pastRolls || [])[0].ts)
    await page.evaluate(() => (window as any).__neural.openPane("history"))
    await settle(page, j)
    await j.clickByMouse(`[data-replay-roll="${ts}"]`, "the past roll's replay control, in the open pane")
    await expect(page.locator("[data-replay-bar]")).toBeVisible()
    await j.advance(200)
    await page.waitForTimeout(100) // the bar docks on a real animation frame (`_renderReplayBar`)
    const g = await geo(page)
    expect(g.card, "premise: the card it stands in for is mounted (stood down, measurable)").not.toBeNull()
    expect(g.card!.l, "premise: the column sits beside the pane").toBeGreaterThanOrEqual(g.pane!.r)
    // U90 note (owner, 2026-11-06): the asking line starts at the label above the choices, so the card the bar stands in for is
    // no longer centred on the column. The bar still is, which is what this journey's title claims. replay-bar-off-column.
    same(g.replay?.c, g.col, "the replay bar sits under the column")
    expect(g.replay!.l, "…clear of the pane, so it cannot paint over the pane's rows").toBeGreaterThanOrEqual(g.pane!.r)
    await j.clickByMouse("[data-replay-stop]", "the replay bar's ✕ beside the open pane")
    await expect(page.locator("[data-replay-bar]")).toHaveCount(0)
  })
}
