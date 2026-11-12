import { expect, test } from "@playwright/test"
import { journey } from "../dsl"

/**
 * v1.253.0 (owner, 2026-11-09): "where's my Win% off of this state i'm in?". The film's seat row has carried a "Win %" slot since
 * v1.231.0, and it printed "—" on every film: it asked `currentWinView`, which nothing defined. The state's own number, V(s), was
 * only on the bottom-left win bar (owner, 2026-09-29: the win chance is one number, full-game P(win)). `currentWinView` now hands on
 * the win bar's own view: `_paintWinThermometer` works the number out once, and both print it (§6.5, one question, one place).
 *
 * THE CLAIM, from what both EMITTED once the solve lands: the seat row's number is the win bar's, without its "%", and is a number.
 * HARNESS: real dossiers are routed so the seat has its film card (the DSL's `{}` carry none). Red-proof is at the foot of this file.
 */

for (const path of ["/Positions/Mount/Top", "/Transitions/Knee-Slice-Pass/Attacker"]) {
  test(`v1.253.0: the film's seat row prints the win bar's own number: ${path}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    const j = journey(page)
    await j.boot(path, { beforeNavigate: async () => { await page.route("**/static/neural/content/*.json", route => route.continue()) } })
    await expect(page.locator('[data-reader][data-reader-ready="true"]')).toBeVisible()
    await expect(page.locator("[data-current-film-win]"), "premise: the seat's film card has its seat row").toHaveCount(1)
    await expect.poll(() => page.locator(".ng-winbar [data-legend-win]").getAttribute("data-win-chance"), { message: "premise: the win bar has the state's number", timeout: 60_000 }).toMatch(/\d/)
    const m = await page.evaluate(() => ({
      bar: document.querySelector(".ng-winbar [data-legend-win]")!.getAttribute("data-win-chance")!,
      seat: document.querySelector("[data-current-film-win]")!.textContent,
    }))
    expect(m.seat, "the seat row agrees with the win bar").toBe(m.bar.replace(/%/g, ""))
    expect(m.seat, "and it is a number").toMatch(/\d/)
  })
}

// Red-proof (v1.253.0, tests/artifacts/neural_app_mutants.mjs on the served neural.js, against a green baseline):
//   seat-win-unwired ... currentWinView back to its "—" fallback ... killed: the seat row agrees with the win bar
