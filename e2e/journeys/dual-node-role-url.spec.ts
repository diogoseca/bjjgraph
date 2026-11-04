import { test, expect, type Page } from "@playwright/test"
import { journey } from "../dsl"

// VIDEO1: graph identity and a position's role URL are different. The Top
// member retains the hub id/ordinal; selecting it must nevertheless open /Top.
// The dossier fixture is empty in the DSL; these claims concern navigation, not
// video availability. Real role articles and the actual canvas are served.
// Killed: position-top-url-is-hub (remove the Top suffix in _nodeUrlPath), by
// the Half Guard map-click and keyboard URL assertions. Fresh reader arrivals
// alone do NOT kill it: the reader already had a local role-suffix workaround.
const positions = ["Half-Guard", "Side-Control", "Mount", "Closed-Guard"]
const ready = '[data-reader-ready="true"]'

async function role(page: Page, slug: string, side: string) {
  await expect.poll(() => new URL(page.url()).pathname).toBe(`/Positions/${slug}/${side}`)
  await expect.poll(() => page.evaluate(() => {
    const a = (window as any).__neural, n = a.nodes[a.focusIdx]
    return { id: n?.id, role: n?.role, seat: a.playerRole }
  })).toEqual({ id: `Positions/${slug}${side === "Bottom" ? "/Bottom" : ""}`, role: side.toLowerCase(), seat: side.toLowerCase() })
}

for (const slug of positions) {
  test(`@curated VIDEO1 ${slug}: native pair clicks during map play keep both role URLs`, async ({ page }) => {
    const j = journey(page)
    await j.boot("/")
    await j.land(slug.replaceAll("-", " ") + " Top")
    await expect(page.locator(ready)).toBeVisible()
    for (const side of ["Bottom", "Top"]) {
      await j.readingOtherHalf()
      await role(page, slug, side)
      await expect(page.locator(ready)).toBeVisible()
    }
    console.log(`VIDEO1 ${slug}: 2 native map role clicks asserted`)
  })

  test(`@curated VIDEO1 ${slug}: native pair clicks keep the role URL in both directions`, async ({ page }) => {
    const j = journey(page)
    await j.boot(`/Positions/${slug}/Bottom`)
    await expect(page.locator(ready)).toBeVisible()
    await role(page, slug, "Bottom")
    for (const side of ["Top", "Bottom"]) {
      await j.readingOtherHalf()
      await role(page, slug, side)
      await expect(page.locator(ready)).toBeVisible()
    }
    console.log(`VIDEO1 ${slug}: 2 native role clicks asserted`)
  })

  test(`VIDEO1 ${slug}: keyboard search activation selects the Top role URL`, async ({ page }) => {
    const j = journey(page)
    await j.boot(`/Positions/${slug}/Bottom`)
    await expect(page.locator(ready)).toBeVisible()
    await page.keyboard.press("/")
    const search = page.locator('.ng-explorer-search input')
    await expect(search).toBeFocused()
    await search.fill(slug.replaceAll("-", " "))
    const result = page.locator(`.ng-learning-list>div:has([data-list-add="Positions/${slug}"])>button:first-child`)
    await expect(result).toHaveCount(1)
    await result.focus()
    await page.keyboard.press("Enter")
    await role(page, slug, "Top")
    console.log(`VIDEO1 ${slug}: 1 native keyboard activation asserted`)
  })
}
