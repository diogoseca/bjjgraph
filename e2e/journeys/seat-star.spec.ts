import { test, expect } from "@playwright/test"
import { journey } from "../dsl"

// Capture belongs to the graph seat and survives dismissal of the question card.
// The real mouse/touch paths below cover menu activation and saved-state changes;
// placement reads the canvas's published label rather than reconstructing its projection.
// Mutation checks: a +12px vertical offset fails the placement journey; replacing saved
// gold with the unsaved grey fails the save/remove journey (desktop, v1.182.0).
// v1.229.0: suppressing Mount's star after panel close fails the final visibility
// assertion even while Kimura's legitimate hover star remains. The scoped journey
// passed five repetitions on both viewports; its save/remove assertions stay intact.
for (const mobile of [false, true]) {
  test.describe(mobile ? "phone seat star" : "desktop seat star", () => {
    test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, hasTouch: mobile })

    test("both seats of each node type carry their star beside the role @curated", async ({ page }) => {
      const j = journey(page)
      await j.boot("/Positions/Mount/Top")
      // Graph ingest precedes the deferred reader that seats this URL. Simulation
      // time cannot finish that fetch: wait for the rendered article before pumping.
      await expect(page.locator('[data-reader-ready="true"]')).toBeVisible({ timeout: 15000 })
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
      await expect(page.locator('[data-reader-ready="true"]')).toBeVisible({ timeout: 15000 })
      await j.advance(6500)
      await page.waitForTimeout(350) // the deferred article and card CSS use wall time
      await page.evaluate(() => document.body.getBoundingClientRect().top)
      await j.advance(2500) // finish the camera's continuous approach to the settled band
      await page.evaluate(() => (window as any).__neural.newList())
      await expect(page.locator("[data-seat-star]")).toHaveCount(1)
      // STALE SPEC (sections-claude, 2026-10-19): after the pane closes, the pointer rests
      // where its close button was, and D-318's centred arrival now draws Cross Collar
      // Choke from High Mount there, so its hover label carries a second, correct star
      // (claude-verify/probe.log; dev's framing leaves that point empty). Every claim
      // below is about the current seat's own star, so name it.
      // v1.229.0 (PR 310): the focus star and a different hovered pair's star can both be visible.
      // This journey saves/removes Mount/Bottom; every action must keep that identity.
      // v1.230.0 merge: the star is named by BOTH, the current seat and the item it saves.
      const seat = await page.evaluate(() => (window as any).__neural.focusIdx)
      const sel = `[data-seat-star="${seat}"][data-list-add="Positions/Mount/Bottom"]`
      const star = page.locator(sel)
      await expect(star).toHaveCount(1)
      const activate = async () => {
        if (mobile) {
          const b = await j.boxOf(sel, "the seat star")
          await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2)
        } else await j.clickByMouse(sel, "the seat star")
      }
      await expect(star).toHaveAttribute("data-list-saved", "false")
      await expect(star.locator("svg")).toHaveAttribute("fill", "none")
      await expect(star.locator("svg")).toHaveCSS("opacity", "0.48")
      // The DSL boot pre-completes the White track, so this landing mints a patch whose phone toast
      // (`.ng-challenge-reward`, top 82px, ~102px tall, 4.8s) spans the top band. Since v1.219.0 the
      // camera has the state settled in that band by now (it used to be still on its way), so the
      // star sits under the toast (measured: elementFromPoint at its centre is the toast). Dismiss it
      // the way a player would; the claim here is the star's, not the toast's.
      const rewardFirst = page.locator("[data-reward-close]")
      if (await rewardFirst.isVisible()) await j.clickByMouse("[data-reward-close]", "dismiss the harness visitor's earned patch")
      await activate()
      await expect(page.locator("[data-list-picker]")).toBeVisible()
      await expect(star).toHaveAttribute("data-list-saved", "false")
      await j.clickByMouse("[data-list-pick]", "the chosen list")
      await expect(star).toHaveAttribute("data-list-saved", "true")
      await expect(star.locator("svg")).toHaveAttribute("fill", "currentColor")
      await expect(star).toHaveCSS("color", "rgb(239, 198, 109)")
      const rewardClose = page.locator("[data-reward-close]")
      if (await rewardClose.isVisible()) await rewardClose.click()
      await page.screenshot({ path: test.info().outputPath(`favorite-${mobile ? "phone" : "desktop"}.png`) })

      // D-338: Questions follows Videos and Moves, so its ✕ can start below the phone's fold.
      // Scroll to it as a reader would, then back to the map's band where the star lives.
      await page.locator("[data-land-close]").evaluate(e => e.scrollIntoView({ block: "nearest" }))
      await j.readerLayoutSettled()
      await j.clickByMouse("[data-land-close]", "hide the question card")
      await page.locator("[data-reader]").evaluate(e => { e.scrollTop = 0 })
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
      await expect(page.locator("[data-seat-star]")).toHaveCount(0)
      await j.clickByMouse(".ng-explorer-close", "close the learning panel")
      await j.advance(500)
      await expect(star).toBeVisible()
    })
  })
}
