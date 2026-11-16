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
// v1.280.3 (STAR1): the star withheld while the drawer is open again (`deckShown` back in `_syncSeatStars`, v1.182.0's rule)
// is red at "desktop seat star › gold means saved…" (the restated drawer step) and at the three "the drawer open" tests below
// ("the seat's star is beside it"); on dev's own bundle (87d1e17ee) the same four are red.
for (const mobile of [false, true]) {
  test.describe(mobile ? "phone seat star" : "desktop seat star", () => {
    test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, hasTouch: mobile })

    test("both seats of each node type carry their star beside the role", async ({ page }) => {
      const j = journey(page)
      await j.boot("/Positions/Mount/Top")
      // Graph ingest precedes the deferred reader that seats this URL. Simulation
      // time cannot finish that fetch: wait for the rendered article before pumping.
      await expect(page.locator('[data-reader-ready="true"]')).toBeVisible({ timeout: 15000 })
      await j.advance(6500)
      // v1.280.0 (POSNAME): the position's own name, and the star beside its role, are never written under a control. The
      // reading arrival can mint White Foundations, whose phone card covers the node band (the name used to be drawn under
      // it, unreadable): dismissed here, as article-sections.spec.ts dismisses it
      if (await page.locator("[data-reward-close]").isVisible()) await j.clickByMouse("[data-reward-close]")
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

    test("gold means saved; the seat star works after hiding the flashcard", async ({ page }) => {
      const j = journey(page)
      await j.boot("/Positions/Mount/Bottom")
      await expect(page.locator('[data-reader-ready="true"]')).toBeVisible({ timeout: 15000 })
      await j.advance(6500)
      await page.waitForTimeout(350) // the deferred article and card CSS use wall time
      await page.evaluate(() => document.body.getBoundingClientRect().top)
      await j.advance(2500) // finish the camera's continuous approach to the settled band
      // v1.280.0 (POSNAME): the White Foundations card covers the node band on a phone; dismissed as above
      if (await page.locator("[data-reward-close]").isVisible()) { await j.clickByMouse("[data-reward-close]"); await j.advance(600) }
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
      if (mobile) await expect(page.locator("[data-seat-star]")).toHaveCount(0)   // the phone's drawer covers the map: no name, no star
      else {
        // v1.280.3 (STAR1; RESTATED from `toHaveCount(0)` at both sizes): the owner's "missing" star was his open drawer. A
        // desktop's drawer leaves the map beside it, the map still writes the seat's role and name there, and the star now goes
        // with them: beside the role, wholly right of the drawer, taking the mouse (the list menu opens and closes on it)
        await j.advance(1500)
        await page.evaluate(() => document.body.getBoundingClientRect().top)
        await j.advance(100)
        await expect(star).toBeVisible()
        const g = await page.evaluate((sel) => {
          const a = (window as any).__neural, b = document.querySelector(sel) as HTMLElement, r = b.getBoundingClientRect(), cr = a.canvas.getBoundingClientRect()
          const label = a._lastPairLabel || a._lastRichLabel, drawer = (document.querySelector(".ng-drill") as HTMLElement).getBoundingClientRect()
          return { left: r.left, x: r.x + r.width / 2 - cr.left, y: r.y + r.height / 2 - cr.top, roleX: label.ox, roleY: label.subY ?? label.roleY, drawerRight: drawer.right, deck: !!a.deckShown }
        }, sel)
        expect(g.deck, "the drawer is open").toBe(true)
        expect(g.left, "the star is wholly right of the drawer").toBeGreaterThanOrEqual(g.drawerRight)
        expect(g.x).toBeGreaterThan(g.roleX + 20)
        expect(Math.abs(g.y - (g.roleY - 4))).toBeLessThan(1)
        await activate()
        await expect(page.locator("[data-list-picker]")).toBeVisible()
        await page.keyboard.press("Escape")
        await expect(page.locator("[data-list-picker]")).toHaveCount(0)
      }
      await j.clickByMouse(".ng-explorer-close", "close the learning panel")
      await j.advance(500)
      await expect(star).toBeVisible()
    })
  })
}

// THE DRAWER OPEN ON A DESKTOP (v1.280.3, STAR1, ruled STAR1-GO). The owner's "missing" star was his open drawer: from v1.182.0
// every seat star was withheld while it was open ("graph controls must not float over the learning pane") although the map beside
// it still wrote the seat's role and name. The ruling keeps that rule in its real meaning: nothing of the map is drawn OVER the
// drawer. So at 1440, 1280 and 1024 wide, drawer open: the seat's star is beside its role and takes the press (the list menu opens
// on it, and the drawer stays open), and neither the star's box nor the position's name box ever meets the drawer's box, at rest
// and in every frame of a drag that walks the seat toward and under the drawer (the frame's own published boxes,
// `_lastNameBoxes`, `w` "position" and "star", and the star buttons' own rects).
for (const width of [1440, 1280, 1024]) {
  test.describe(`desktop ${width}x900, the drawer open`, () => {
    test.use({ viewport: { width, height: 900 } })
    test("the seat's star stays beside its name and off the drawer, at rest and through a drag; its press keeps the drawer open", async ({ page }) => {
      const j = journey(page)
      await j.boot("/Positions/Mount/Top")
      await expect(page.locator('[data-reader-ready="true"]')).toBeVisible({ timeout: 15000 })
      await j.advance(6500)
      if (await page.locator("[data-reward-close]").isVisible()) { await j.clickByMouse("[data-reward-close]"); await j.advance(600) }
      await j.clickByMouse(".ng-logo", "open the learning panel")
      await j.advance(1500)
      await page.evaluate(() => document.body.getBoundingClientRect().top)
      await j.advance(100)
      const look = () => page.evaluate(() => {
        const a = (window as any).__neural, d = (document.querySelector(".ng-drill") as HTMLElement).getBoundingClientRect(), cr = a.canvas.getBoundingClientRect()
        const boxes = (a._lastNameBoxes || []).filter((b: any) => b.w === "position" || b.w === "star" && b.i === a.focusIdx)
          .map((b: any) => ({ w: b.w, l: b.l + cr.left, r: b.r + cr.left, t: b.t + cr.top, b: b.b + cr.top }))
        const stars = [...document.querySelectorAll("[data-seat-star]")].map((s) => {
          const r = s.getBoundingClientRect(), e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
          return { w: "button", l: r.left, r: r.right, t: r.top, b: r.bottom, live: e === s || s.contains(e), seat: +s.getAttribute("data-seat-star")! === a.focusIdx }
        })
        return { drawer: { l: d.left, r: d.right, t: d.top, b: d.bottom }, boxes, stars, deck: !!a.deckShown }
      })
      const meets = (p: any, q: any) => p.l < q.r && p.r > q.l && p.t < q.b && p.b > q.t
      const rest = await look()
      expect(rest.deck, "the drawer is open").toBe(true)
      expect(rest.boxes.filter((b) => b.w === "position"), "the position's name is written").toHaveLength(1)
      const seatStar = rest.stars.filter((s) => s.seat)
      expect(seatStar, "the seat's star is beside it").toHaveLength(1)
      expect(seatStar[0].live, "the star takes the press where it sits").toBe(true)
      for (const b of [...rest.boxes, ...rest.stars]) expect(meets(b, rest.drawer), `at rest: the ${b.w} box meets the drawer`).toBe(false)
      const seat = await page.evaluate(() => (window as any).__neural.focusIdx)
      const sel = `[data-seat-star="${seat}"]`
      await j.clickByMouse(sel, "the seat star, the drawer open")
      await expect(page.locator("[data-list-picker]")).toBeVisible()
      expect(await page.evaluate(() => (window as any).__neural.deckShown), "the press keeps the drawer open").toBe(true)
      await expect(page.locator(".ng-drill")).toBeVisible()
      await page.keyboard.press("Escape")
      await expect(page.locator("[data-list-picker]")).toHaveCount(0)
      expect(await page.evaluate(() => (window as any).__neural.deckShown), "closing the menu keeps the drawer open").toBe(true)
      // the drag: grab bare map right of the drawer and walk the seat left, toward and under the drawer, a frame per step
      const grab = await page.evaluate(() => {
        const a = (window as any).__neural, d = (document.querySelector(".ng-drill") as HTMLElement).getBoundingClientRect()
        for (let y = innerHeight * 0.2; y < innerHeight * 0.6; y += 20) for (let x = innerWidth - 40; x > d.right + 40; x -= 20)
          if (document.elementFromPoint(x, y) === a.canvas) return { x, y }
        return null
      })
      expect(grab, "a bare point of the map right of the drawer").not.toBeNull()
      await page.mouse.move(grab!.x, grab!.y)
      await page.mouse.down()
      let frames = 0, written = 0, near = Infinity
      for (let k = 1; k <= 40; k++) {
        await page.mouse.move(grab!.x - k * 22, grab!.y)
        await j.advance(16)
        await page.evaluate(() => document.body.getBoundingClientRect().top)
        const f = await look()
        frames++
        const pos = f.boxes.find((b) => b.w === "position")
        if (pos) { written++; near = Math.min(near, pos.l - f.drawer.r) }
        for (const b of [...f.boxes, ...f.stars]) expect(meets(b, f.drawer), `drag frame ${k}: the ${b.w} box meets the drawer`).toBe(false)
        if (!pos) expect(f.stars.filter((s) => s.seat), `drag frame ${k}: no name, no seat star`).toHaveLength(0)
      }
      await page.mouse.up()
      expect(frames).toBe(40)
      expect(written, "the name was written in some dragged frames").toBeGreaterThan(0)
      expect(written, "and refused in others: the drag took the seat under the drawer").toBeLessThan(frames)
      expect(near, "the case occurred: the name came within 40 px of the drawer").toBeLessThan(40)
    })
  })
}
