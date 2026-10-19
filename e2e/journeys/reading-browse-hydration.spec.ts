import { test, expect, type Page } from "@playwright/test"
import { createHash } from "node:crypto"
import { journey } from "../dsl"

// D-325 REAL BREAK: clip-curation-pr2-ci-classification.md proved 3/3 wrong
// articles on dev 2fe86f33a. Removing the loading row lifts Mount by 30px
// underneath a still pointer. Keep reading-mode's original Browse journey;
// this holds the actual 200 response to pin the reachable ordering separately.
// The hover guard must preserve DOM identity as well as geometry, and release
// on pointer leave so newly matched aliases are not lost. No app state is set.
// Red/green proof at 4x CPU: exact dev loses Mount at y624 -> y594; fixed
// passes all six cases. reading_browse_mutant.mjs disables only the hover guard:
// the trusted click opens Mount-to-Armbar and fails the article assertion.
// Scope: mouse hover and press; this does not claim a touch-hover contract.
const READY = '[data-reader][data-reader-ready="true"]'
const rows = (page: Page) => page.locator('[data-list-surface="explore"][data-list-add]').evaluateAll(es => es.map(e => e.getAttribute('data-list-add')))

for (const width of [1440, 390]) for (const action of ['click', 'leave', 'press'] as const) {
  test(`@curated Browse keeps the hovered result through late aliases at ${width}px: ${action}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 })
    const j = journey(page)
    // Rear also inserts Back Control via its non-primary "Rear Mount" alias;
    // Mount isolates the disappearing status row from the original CI failure.
    const intended = action === 'leave' ? 'Submissions/Rear-Naked-Choke/from-Back-Control' : 'Positions/Mount'
    const target = `div:has(> [data-list-surface="explore"][data-list-add="${intended}"]) > button:first-child`
    let release!: () => void, requests = 0
    const gate = new Promise<void>(resolve => { release = resolve })
    const evidence: any = { width, action }
    try {
      await j.boot('/Transitions/Knee-Slice-Pass', {
        initialState: { v: 2, settings: { readingFocus: true, readingFeedback: false }, settingsAt: {} },
        beforeNavigate: async () => {
          await page.route('**/aliases.json*', async route => {
            requests++
            const response = await route.fetch()
            expect(response.status()).toBe(200)
            const body = await response.body()
            evidence.response = { status: response.status(), bytes: body.length, sha256: createHash('sha256').update(body).digest('hex') }
            await gate
            await route.fulfill({ response })
          })
          await page.addInitScript(() => {
            const w = window as any
            w.__browseClicks = []
            document.addEventListener('click', e => {
              const button = (e.target as HTMLElement).closest('button')
              const row = button?.parentElement?.querySelector('[data-list-add]')?.getAttribute('data-list-add')
              if (row) w.__browseClicks.push({ row, trusted: e.isTrusted })
            }, true)
          })
        },
      })
      await expect(page.locator(READY)).toBeVisible()
      await j.clickByMouse('[data-reader-browse]')
      await page.locator('.ng-explorer-search input').fill(action === 'leave' ? 'Rear' : 'Mount')
      await expect(page.locator(target)).toHaveCount(1)
      await expect.poll(() => requests).toBe(1)
      // Isolate aliases: the other genuine index has already ingested and rendered.
      await page.waitForFunction(() => { const a = (window as any).__neural; return a.systems?.length > 0 && !a._systemsLoading })
      await expect(page.locator('[data-alias-status="loading"]')).toHaveCount(1)
      const rect = await page.locator(target).boundingBox()
      expect(rect).not.toBeNull()
      const point = { x: rect!.x + rect!.width / 2, y: rect!.y + rect!.height / 2 }
      await page.mouse.move(point.x, point.y)
      await page.locator(target).evaluate(el => { (window as any).__browseOriginal = el })
      const snapshot = () => page.evaluate(({ point, selector }) => {
        const original = (window as any).__browseOriginal, current = document.querySelector(selector)
        const button = document.elementFromPoint(point.x, point.y)?.closest('button')
        return { rect: current?.getBoundingClientRect().toJSON(), same: original === current, connected: original.isConnected,
          hit: button?.parentElement?.querySelector('[data-list-add]')?.getAttribute('data-list-add'),
          clicks: (window as any).__browseClicks }
      }, { point, selector: target })
      evidence.point = point
      evidence.before = await snapshot()
      evidence.rowsBefore = await rows(page)
      expect(evidence.before.hit).toBe(intended)
      if (action === 'press') await page.mouse.down()
      release()
      // Ingestion is the stimulus; target stability and the clicked article are
      // asserted afterward, never used as readiness conditions.
      await page.waitForFunction(() => !!(window as any).__neural._aliasesReady)
      evidence.after = await snapshot()
      expect.soft(evidence.after.rect, 'late aliases must not move the hovered result row').toEqual(evidence.before.rect)
      expect.soft(evidence.after.same, 'late aliases must not replace the hovered button').toBe(true)
      expect.soft(evidence.after.hit, 'the stationary pointer still targets the original result').toBe(intended)
      if (action === 'leave') {
        const input = await page.locator('.ng-explorer-search input').boundingBox()
        await page.mouse.move(input!.x + input!.width / 2, input!.y + input!.height / 2)
        await expect(page.locator('[data-alias-status]')).toHaveCount(0)
        evidence.rowsAfterLeave = await rows(page)
        await expect(page.locator('.ng-learning-list')).toContainText('aka Back Mount')
        expect(evidence.rowsAfterLeave).toContain('Positions/Back-Control')
        expect(evidence.rowsAfterLeave.length, 'alias matches appear once the pointer leaves').toBeGreaterThan(evidence.rowsBefore.length)
      } else {
        // Keep the original measured point: re-measuring would conceal the bug.
        if (action === 'click') await page.mouse.down()
        await page.mouse.up()
        await page.waitForFunction(() => {
          const reader = document.querySelector('[data-reader][data-reader-ready="true"]')
          return reader && reader.getAttribute('data-reader-path') !== '/Transitions/Knee-Slice-Pass'
        })
        evidence.final = await page.locator(READY).getAttribute('data-reader-path')
        evidence.clicks = await page.evaluate(() => (window as any).__browseClicks)
        expect.soft(evidence.clicks).toEqual([{ row: 'Positions/Mount', trusted: true }])
        expect(evidence.final, 'the native click must open the originally hovered article').toMatch(/\/Positions\/Mount(?:\/Top)?$/)
      }
    } finally {
      release?.()
      await info.attach('browse-hydration', { body: JSON.stringify(evidence, null, 2), contentType: 'application/json' })
    }
  })
}
