/* @hyperspace {"theme":"challenge-progression","L":"casual-week1","F":"options-tray","B":"surface-integrity"}
   @invariant "With the tutorial challenge cue on screen, every on-viewport option card of a live hand stays mouse-clickable — no fixed overlay captures a tray card's center point, and clicking the leftmost card opens its move sheet instead of teleporting to the Challenges view." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { casualWeek1 } from "../gen/personas"

/**
 * QUARANTINED RED — Q006.
 *
 * The tray's pass-through corner is a documented contract: helmet.html:96-97 keeps the
 * base `.ng-tut` at `pointer-events:none` with the comment "the options tray can scroll
 * under this corner and must stay clickable" (same contract restated in CLAUDE.md's
 * tutorial-drip section). The challenge-cue redesign reuses that node (`aside.ng-tut
 * .ng-challenge-cue`, challenge-feedback.src.js:45) but overrides the WHOLE panel to
 * `pointer-events:auto` (challenge-feedback.css:16) and fills it with a full-surface
 * [data-challenge-cue-open] button. At the standard 1440x900 desktop viewport a 10-card
 * hand from Mount Top runs the tray (y 680-818) under the cue (left:16, bottom:104,
 * width 270): the first TWO option cards' centers land inside the cue, so a mouse click
 * on them is captured and fires openLearningView("challenges") — the player trying to
 * execute a move (the drip step literally says "Execute a move") is yanked into the
 * Challenges explorer instead. Keyboard digits 1-9 mask the bug; the curated suite only
 * asserts cue/tray non-overlap on MOBILE (challenges-ui.spec.ts:300-353, 400x875).
 *
 * Fix-shape-agnostic: green if the cue restores pass-through outside its buttons, moves/
 * shrinks clear of the tray, or hides while a hand is live (cue visibility is logged, not
 * asserted). Red today at the offenders assert: ["Americana from Mount","Armbar from Mount"].
 */

test("tutorial challenge cue never captures clicks aimed at live option cards", async ({ page }) => {
  const j = journey(page)
  await j.boot("/", { initialState: casualWeek1(), keepTutorial: true })

  // pre-sized rigs for the landing MC block rendered during land()'s pump
  await j.rig("land-mc-pick", [
    0.03, 0.11, 0.19, 0.27, 0.35, 0.43, 0.51, 0.59, 0.67, 0.75,
    0.83, 0.91, 0.07, 0.15, 0.23, 0.31, 0.39, 0.47, 0.55, 0.63,
  ])
  await j.rig("land-mc-shuffle", [0.2, 0.5, 0.8, 0.35, 0.65, 0.95, 0.14, 0.42])
  await j.land("Mount Top") // dismisses the coach → the drip cue takes the corner

  const titles = await j.optionTitles()
  expect(titles.length, "a full hand deals (Mount Top authors 10 options)").toBeGreaterThanOrEqual(8)

  // hit-test every on-viewport card center — the tray must stay clickable under any overlay
  const audit = await page.evaluate(() => {
    const cue = document.querySelector("[data-challenge-cue]") as HTMLElement | null
    const cueBox = cue ? cue.getBoundingClientRect() : null
    const offenders: Array<{ tech: string | null; hit: string }> = []
    let tested = 0
    for (const card of Array.from(document.querySelectorAll("[data-tech]")) as HTMLElement[]) {
      const b = card.getBoundingClientRect()
      const cx = b.x + b.width / 2
      const cy = b.y + b.height / 2
      if (cx < 1 || cx > innerWidth - 1 || cy < 1 || cy > innerHeight - 1) continue // tray scrolls; off-screen cards are reachable by scroll, not by click
      tested += 1
      const at = document.elementFromPoint(cx, cy)
      if (!at || !at.closest("[data-tech]")) {
        offenders.push({
          tech: card.getAttribute("data-tech"),
          hit: at ? (at.closest("[data-challenge-cue]") ? "challenge-cue" : (at as HTMLElement).className || at.tagName) : "none",
        })
      }
    }
    return {
      cueVisible: !!(cue && cueBox && cueBox.width > 0),
      cueBox: cueBox ? { x: Math.round(cueBox.x), y: Math.round(cueBox.y), w: Math.round(cueBox.width), h: Math.round(cueBox.height) } : null,
      tested,
      offenders,
    }
  })
  console.log("CUE-AUDIT", JSON.stringify(audit))
  expect(audit.tested, "on-viewport cards were actually audited").toBeGreaterThanOrEqual(6)

  // THE INVARIANT (red today): no overlay owns the center of any on-viewport option card
  expect(
    audit.offenders,
    "every on-viewport option card's center must hit the card itself — a fixed overlay capturing it makes the move mouse-unclickable and misdirects the click",
  ).toEqual([])

  // and the leftmost card behaves like a card: click → its move sheet, not the Challenges view
  const first = page.locator(`[data-tech="${titles[0]}"]`).first()
  await first.click({ timeout: 5000 })
  await expect(page.locator("[data-go]").first(), "expand sheet opened for the clicked move").toBeVisible()
  await expect(page.locator(".ng-explorer"), "no teleport into the Challenges explorer").not.toBeVisible()
})
