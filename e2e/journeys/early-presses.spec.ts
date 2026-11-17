import { expect, test, type Page } from "@playwright/test"
import { journey } from "../dsl"

/**
 * A PRESS BEFORE THE MAP'S DATA HAS LANDED (EARLY1, v1.288.1; found on production by the orchestrator's probes).
 * The logo and the search button are on screen before the graph is ingested. A press then ran the list's build over
 * `this.nodes` (undefined): the page threw "this.nodes is not iterable" and the panel stayed shut, also after the data
 * landed (`ingest` resets the drawer). The rule: such a press is never lost and never throws; the panel opens when the
 * data lands, as if pressed then, unless the player took it back (a second press on the logo).
 * Every journey here HOLDS the graph's request (`graph-data.json`, `never`) so the press is made before the data by
 * construction, never by a race, then releases it. By a real mouse at 1440x900 and by touch at 390x631.
 * FAULT 2 (the reader of PR #430, 4b): Master the game opened in the first seconds after a load was ended by the intro's
 * deal of the first roll (6 of 6 on "/" by real presses on a real clock; tmp-pw/drawer/early/early_probe.cjs). Its journey
 * holds the intro's clock with the test-mode pump instead of a request, and is pressed before the deal by construction.
 * Mutants: the guard in `openPane` removed (dev's behaviour) → red at "no page error while the data is held"; the
 * take-back removed (a second press leaves it remembered) → red at "a press taken back opens nothing"; the intro's deal
 * resetting the session again → red at "Master the game is still open after the first roll is dealt".
 */

type W = Window & { __neural: any }
async function press(page: Page, selector: string, what: string, touch: boolean) {
  const at = await page.evaluate((sel) => {
    const el = [...document.querySelectorAll(sel)].find((e) => (e as HTMLElement).getClientRects().length) as HTMLElement | undefined
    if (!el) return { ok: false, why: "no element matches", x: 0, y: 0 }
    const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2
    const top = document.elementFromPoint(x, y)
    return { ok: !!top && (top === el || el.contains(top)), why: top ? "<" + top.tagName.toLowerCase() + " " + (top as HTMLElement).className + ">" : "nothing", x, y }
  }, selector)
  expect(at.ok, `${what}: the point under the press is the control (${at.why})`).toBe(true)
  if (touch) await page.touchscreen.tap(at.x, at.y)
  else await page.mouse.click(at.x, at.y)
}
async function bootHeld(page: Page) {
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))
  const j = journey(page)
  await j.boot("/", { unready: true, payloads: { "graph-data.json": { never: true } } })
  await expect(page.locator(".ng-logo"), "premise: the logo is on screen").toBeVisible({ timeout: 20_000 })
  expect(await page.evaluate(() => Array.isArray((window as W).__neural?.nodes)), "premise: the map's data has not landed").toBe(false)
  return { j, errors }
}
const landed = (page: Page) => expect.poll(() => page.evaluate(() => Array.isArray((window as W).__neural?.nodes) && (window as W).__neural.nodes.length > 0),
  { message: "the map's data lands", timeout: 30_000 }).toBe(true)
const shown = (page: Page) => page.evaluate(() => !!(window as W).__neural.deckShown)

for (const touch of [false, true]) {
  const tag = touch ? "touch 390x631" : "mouse 1440x900"
  test.describe(tag, () => {
    test.use(touch ? { hasTouch: true, isMobile: true, viewport: { width: 390, height: 631 } } : { viewport: { width: 1440, height: 900 } })

    test(`a press on the logo before the data lands opens the panel when it lands, and nothing throws (${tag})`, async ({ page }) => {
      const { j, errors } = await bootHeld(page)
      await press(page, ".ng-logo", "the logo", touch)
      await page.waitForTimeout(300)
      expect(errors, "no page error while the data is held").toEqual([])
      expect(await shown(page), "the panel waits for the data").toBe(false)
      await j.releasePayload("graph-data.json")
      await landed(page)
      await expect.poll(() => shown(page), { message: "the panel opens when the data lands, as if pressed then" }).toBe(true)
      await expect(page.locator("[data-drawer-explore]"), "on its list").toBeVisible()
      expect(errors, "no page error").toEqual([])
    })

    test(`a press taken back before the data lands opens nothing (${tag})`, async ({ page }) => {
      const { j, errors } = await bootHeld(page)
      await press(page, ".ng-logo", "the logo", touch)
      await press(page, ".ng-logo", "the logo again", touch)
      await j.releasePayload("graph-data.json")
      await landed(page)
      await page.waitForTimeout(500)
      expect(await shown(page), "a press taken back opens nothing").toBe(false)
      expect(errors, "no page error").toEqual([])
      await press(page, ".ng-logo", "a press after the data", touch)
      await expect.poll(() => shown(page), { message: "and the next press opens it" }).toBe(true)
    })

    // FAULT 2 (the reader of #430, finding 4b): Master the game opened before the first roll is dealt. The intro hands over
    // at 3.2 s of its own clock and deals the first roll; that deal ended the session. Here the clock is HELD by the test-mode
    // pump (`advance`): the intro waits until the journey moves it, so the presses come before the deal by construction.
    test(`Master the game opened before the first roll is dealt stays open when it is dealt (${tag})`, async ({ page }) => {
      const errors: string[] = []
      page.on("pageerror", (e) => errors.push(e.message))
      const j = journey(page)
      await j.boot("/")
      expect(await page.evaluate(() => !!(window as W).__neural.introDone), "premise: the first roll is not dealt yet").toBe(false)
      await press(page, ".ng-logo", "the logo", touch)
      await expect(page.locator('[data-explore-stats] [data-b="due"]')).toBeVisible()
      await press(page, '[data-explore-stats] [data-b="due"]', "Master the game", touch)
      await expect.poll(() => page.evaluate(() => !!(window as W).__neural._practiceInDrawer()), { message: "premise: Master the game is open" }).toBe(true)
      const session = await page.evaluate(() => { (window as any).__openSession = (window as W).__neural._session; return true })
      expect(session).toBe(true)
      await page.evaluate(() => (window as W).__neural.advance(4500))
      expect(await page.evaluate(() => !!(window as W).__neural.introDone), "premise: the first roll was dealt").toBe(true)
      expect(await page.evaluate(() => (window as W).__neural._session === (window as any).__openSession && (window as W).__neural._practiceInDrawer()),
        "Master the game is still open after the first roll is dealt").toBe(true)
      expect(errors, "no page error").toEqual([])
    })

    test(`the search button before the data lands opens the panel on its search when it lands (${tag})`, async ({ page }) => {
      const { j, errors } = await bootHeld(page)
      await press(page, ".ng-search", "the search button", touch)
      expect(errors, "no page error while the data is held").toEqual([])
      await j.releasePayload("graph-data.json")
      await landed(page)
      await expect.poll(() => shown(page), { message: "the panel opens when the data lands" }).toBe(true)
      if (!touch) await expect.poll(() => page.evaluate(() => document.activeElement === (window as W).__neural.explorerSearchRef.current),
        { message: "with the search taking the keys (desktop)" }).toBe(true)
      expect(errors, "no page error").toEqual([])
    })
  })
}

// a key before the data lands: "/" is the search's key
test("the / key before the data lands opens the panel on its search when it lands", async ({ page }) => {
  const { j, errors } = await bootHeld(page)
  await page.keyboard.press("/")
  expect(errors, "no page error while the data is held").toEqual([])
  await j.releasePayload("graph-data.json")
  await landed(page)
  await expect.poll(() => shown(page), { message: "the panel opens when the data lands" }).toBe(true)
  expect(errors, "no page error").toEqual([])
})
