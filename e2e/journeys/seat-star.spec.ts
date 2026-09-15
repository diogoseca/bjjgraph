import { test, expect } from "@playwright/test"
import { journey } from "../dsl"

// Capture belongs to the graph seat and survives dismissal of the question card.
// The real mouse/touch paths below cover menu activation and saved-state changes;
// placement reads the canvas's published label rather than reconstructing its projection.
// Mutation checks: a +12px vertical offset fails the placement journey; replacing saved
// gold with the unsaved grey fails the save/remove journey (desktop, v1.182.0).
for (const mobile of [false, true]) {
  test.describe(mobile ? "phone seat star" : "desktop seat star", () => {
    test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, hasTouch: mobile })

    test("both seats of each node type carry their star beside the role @curated", async ({ page }) => {
      const j = journey(page)
      await j.boot("/Positions/Mount/Top")
      await j.advance(6500)
      const nodes = await page.evaluate(() => {
        const a = (window as any).__neural
        return ["positions", "transitions", "submissions"].flatMap((ty) => {
          const n = ty === "positions" ? a.nodes[a.focusIdx] : a.nodes.find((n: any) => n.ty === ty && n.rep && a.rsAllows(n))
          return [n.idx, n.pi]
        })
      })
      expect(nodes).toHaveLength(6)
      for (const idx of nodes) {
        await page.mouse.move(2, 2)
        await page.evaluate((idx) => {
          const a = (window as any).__neural
          ;(document.activeElement as HTMLElement)?.blur()
          a._hover = null
          a.openDossier(idx)
        }, idx)
        await j.advance(6500)
        await page.evaluate(() => document.body.getBoundingClientRect().top)
        await j.advance(600)
        const star = page.locator(`[data-seat-star="${idx}"]`)
        await expect(star).toBeVisible()
        const g = await page.evaluate((idx) => {
          const a = (window as any).__neural
          const b = document.querySelector(`[data-seat-star="${idx}"]`) as HTMLElement
          const r = b.getBoundingClientRect(), cr = a.canvas.getBoundingClientRect()
          const label = a._lastPairLabel || a._lastRichLabel
          return { x: r.x + r.width / 2 - cr.left, y: r.y + r.height / 2 - cr.top,
            roleX: label.ox, roleY: label.subY ?? label.roleY, role: label.sub || label.kicker,
            width: r.width, id: b.getAttribute("data-list-add"), expected: a.nodes[idx].id }
        }, idx)
        expect(g.x).toBeGreaterThan(g.roleX + 20)
        expect(Math.abs(g.y - (g.roleY - 4))).toBeLessThan(1)
        expect(g.role).toBeTruthy()
        expect(g.id).toBe(g.expected)
        expect(g.width).toBeCloseTo(mobile ? 44 : 28, 2)
        await expect(page.locator("[data-landcard] [data-list-add]")).toHaveCount(0)
      }
    })

    test("gold means saved; the seat star works after hiding the flashcard @curated", async ({ page }) => {
      const j = journey(page)
      await j.boot("/Positions/Mount/Bottom")
      await j.advance(6500)
      await page.evaluate(() => document.body.getBoundingClientRect().top)
      await j.advance(600)
      await page.evaluate(() => (window as any).__neural.newList())
      const star = page.locator("[data-seat-star]")
      await expect(star).toHaveCount(1)
      const sel = "[data-seat-star]"
      const activate = async () => {
        if (mobile) {
          const b = await j.boxOf(sel, "the seat star")
          await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2)
        } else await j.clickByMouse(sel, "the seat star")
      }
      await expect(star).toHaveAttribute("data-list-saved", "false")
      await expect(star.locator("svg")).toHaveAttribute("fill", "none")
      await expect(star.locator("svg")).toHaveCSS("opacity", "0.48")
      await activate()
      await expect(page.locator("[data-list-picker]")).toBeVisible()
      await expect(star).toHaveAttribute("data-list-saved", "false")
      await j.clickByMouse("[data-list-pick]", "the chosen list")
      await expect(star).toHaveAttribute("data-list-saved", "true")
      await expect(star.locator("svg")).toHaveAttribute("fill", "currentColor")
      await expect(star).toHaveCSS("color", "rgb(239, 198, 109)")
      const rewardClose = page.locator("[data-reward-close]")
      if (await rewardClose.isVisible()) await rewardClose.click()
      await page.screenshot({ path: `/tmp/favorite-${mobile ? "phone" : "desktop"}.png` })

      await j.clickByMouse("[data-land-close]", "hide the question card")
      await j.advance(500)
      await expect(page.locator("[data-landcard]")).not.toBeVisible()
      await expect(star).toBeVisible()
      await activate()
      await j.clickByMouse("[data-list-pick]", "remove from the list")
      await expect(star).toHaveAttribute("data-list-saved", "false")
      await expect(star.locator("svg")).toHaveAttribute("fill", "none")

      await star.focus()
      await page.keyboard.press("Enter")
      await expect(page.locator("[data-list-picker]")).toBeVisible()
      await page.keyboard.press("Escape")
      await expect(page.locator("[data-list-picker]")).toHaveCount(0)
      await expect(star).toBeFocused()

      await j.clickByMouse(".ng-logo", "open the learning panel")
      await expect(star).toHaveCount(0)
      await j.clickByMouse(".ng-explorer-close", "close the learning panel")
      await j.advance(500)
      await expect(star).toBeVisible()
    })
  })
}
