import { test, expect, type Page } from "@playwright/test"
import { journey } from "../dsl"

// VIDEO2: the oracle is the actual fetched document's HEAD title, not the app's
// function, card label, frontmatter or another copy of its formatting rules.
// Native gestures own navigation; frameNodes below only places the target on camera.
// Mutants in tests/artifacts/tab_title_mutants.json: dropped-title-write is killed
// by "native map"; hub-title-for-role is killed by "dual pair" (also native map).
const READY = '[data-reader-ready="true"]'
const QUIET = { v: 2, settings: { landFilm: false, landCard: false, landHand: false, landFeedback: false, readerBook: false }, settingsAt: {} }

async function exactTitle(page: Page, step: string) {
  const row = await page.evaluate(async () => {
    const response = await fetch(location.pathname)
    if (!response.ok) throw new Error(`Title oracle HTTP ${response.status}`)
    const doc = new DOMParser().parseFromString(await response.text(), "text/html")
    if (doc.head.querySelectorAll("title").length !== 1 || !doc.title) throw new Error("Title oracle is empty or ambiguous")
    return { path: location.pathname, title: document.title, builtTitle: doc.title }
  })
  expect(row.title, `${step}: tab equals fetched head title at ${row.path}`).toBe(row.builtTitle)
  console.log(JSON.stringify({ step, ...row }))
  return row
}

async function clickNode(page: Page, j: ReturnType<typeof journey>, id: string) {
  const idx = await page.evaluate(id => {
    const a = (window as any).__neural, n = a.nodes.find((n: any) => n.id === id)
    if (!n) throw new Error(`Missing node ${id}`)
    a.frameNodes([n.idx]); return n.idx
  }, id)
  await j.advance(4000)
  const point = await page.evaluate(idx => {
    const a = (window as any).__neural, n = a.nodes[idx]
    return { x: a.W / 2 + (n.x - a.cam.cx) * a.W / a.cam.vw, y: a.H / 2 + (a._LY(n) - a.cam.cy) * a.W / a.cam.vw }
  }, idx)
  expect(await page.evaluate(p => document.elementFromPoint(p.x, p.y)?.tagName, point)).toBe("CANVAS")
  await page.mouse.click(point.x, point.y)
}

test("@curated VIDEO2 native map click, Back/Forward and reader open/close keep exact titles", async ({ page }) => {
  const j = journey(page)
  await j.boot("/Positions/Mount", { initialState: QUIET })
  await expect(page.locator(READY)).toHaveCount(1); await j.advance(8000)
  const initial = await exactTitle(page, "arrival")
  await clickNode(page, j, "Positions/Half-Guard")
  await expect.poll(() => new URL(page.url()).pathname).toBe("/Positions/Half-Guard/Top")
  await exactTitle(page, "native node click")
  await page.goBack(); await expect(page.locator(READY)).toHaveCount(1)
  await expect.poll(() => new URL(page.url()).pathname).toBe(initial.path)
  expect((await exactTitle(page, "Back")).title).toBe(initial.title)
  await page.goForward(); await expect(page.locator(READY)).toHaveCount(1)
  await exactTitle(page, "Forward")
  await j.clickByMouse('[data-layer-show="book"]'); await exactTitle(page, "reader open")
  await page.locator('[data-reader-close]').scrollIntoViewIfNeeded(); await j.readerLayoutSettled()
  await j.clickByMouse('[data-reader-close]'); await exactTitle(page, "reader close")
  for (const side of ["Bottom", "Top"]) {
    await j.readingOtherHalf()
    await expect.poll(() => new URL(page.url()).pathname).toBe(`/Positions/Half-Guard/${side}`)
    await exactTitle(page, `dual pair ${side}`)
  }
  console.log("VIDEO2 native navigation: 8 exact built titles asserted")
})

test("@curated VIDEO2 dual pair titles name the selected role, never the hub", async ({ page }) => {
  const j = journey(page)
  await j.boot("/Positions/Half-Guard/Bottom", { initialState: QUIET })
  await expect(page.locator(READY)).toHaveCount(1)
  for (const side of ["Top", "Bottom"]) {
    await j.readingOtherHalf()
    await expect.poll(() => new URL(page.url()).pathname).toBe(`/Positions/Half-Guard/${side}`)
    await exactTitle(page, `role ${side}`)
  }
})

test("VIDEO2 keyboard Explore activation updates the title with the role URL", async ({ page }) => {
  const j = journey(page)
  await j.boot("/Positions/Mount/Bottom", { initialState: QUIET })
  await expect(page.locator(READY)).toHaveCount(1)
  await page.keyboard.press("/")
  await page.locator('.ng-explorer-search input').fill("Half Guard")
  const result = page.locator('.ng-learning-list>div:has([data-list-add="Positions/Half-Guard"])>button:first-child')
  await expect(result).toHaveCount(1); await result.focus(); await page.keyboard.press("Enter")
  await expect.poll(() => new URL(page.url()).pathname).toBe("/Positions/Half-Guard/Top")
  await exactTitle(page, "keyboard Enter")
})

for (const [from, to] of [
  ["/Learning/Asymmetric-Warfare", "/Learning/Double-Down-on-Strengths"],
  ["/Principles/Frames", "/Principles/Levers"],
  ["/Systems/10th-Planet-Half-Guard-Bottom-System", "/Systems/Brian-Glick-Half-Butterfly-System"],
  ["/Systems/10th-Planet-Half-Guard-Bottom-System", "/Systems"],
]) {
  test(`VIDEO2 reader link ${to} and Back preserve authored titles`, async ({ page }) => {
    const j = journey(page)
    await j.boot(from)
    await expect(page.locator(READY)).toHaveCount(1)
    const before = await exactTitle(page, "reader arrival")
    const link = page.locator(`[data-reader-body] a[href$="${to}"]`).first()
    await expect(link).toHaveCount(1)
    await link.scrollIntoViewIfNeeded(); await j.readerLayoutSettled()
    await link.evaluate(e => e.setAttribute("data-title-target", ""))
    await j.clickByMouse('[data-title-target]')
    await expect.poll(() => new URL(page.url()).pathname).toBe(to)
    await expect(page.locator(READY)).toHaveCount(1)
    await exactTitle(page, "reader push")
    await page.goBack(); await expect(page.locator(READY)).toHaveCount(1)
    expect((await exactTitle(page, "reader Back")).title).toBe(before.title)
  })
}

test("VIDEO2 reader anchor replace keeps the exact title and one history entry", async ({ page }) => {
  const j = journey(page)
  // S1 a: a family page lost its notice and with it the anchor; the seat's safety line is the anchor now.
  await j.boot("/Submissions/Americana/from-Side-Control/Attacker")
  await expect(page.locator(READY)).toHaveCount(1)
  const before = await exactTitle(page, "submission seat")
  const length = await page.evaluate(() => history.length)
  const link = page.locator('[data-reader-body] a[data-reader-anchor][href$="#safety-considerations"]').first()
  await expect(link).toHaveCount(1); await link.scrollIntoViewIfNeeded(); await j.readerLayoutSettled()
  await link.evaluate(e => e.setAttribute("data-title-target", "")); await j.clickByMouse('[data-title-target]')
  await expect.poll(() => new URL(page.url()).hash).toBe("#safety-considerations")
  expect((await exactTitle(page, "reader replace")).title).toBe(before.title)
  expect(await page.evaluate(() => history.length)).toBe(length)
})

test("VIDEO2 boot-time URL rewrite sets the matching built title", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.advance(8000)
  await expect.poll(() => new URL(page.url()).pathname).not.toBe("/")
  await exactTitle(page, "boot rewrite")
})

test("VIDEO2 a failed non-indexed article retains its pending URL/title on Retry", async ({ page }) => {
  const j = journey(page), from = "/Systems/10th-Planet-Half-Guard-Bottom-System"
  let requests = 0
  await j.boot(from, { beforeNavigate: async () => {
    await page.route('**/Systems', route => ++requests === 1
      ? route.fulfill({ status: 503, body: "Temporarily unavailable" }) : route.continue())
  } })
  await expect(page.locator(READY)).toHaveCount(1)
  const before = await exactTitle(page, "before failed reader push")
  const link = page.locator('[data-reader-body] a[href$="/Systems"]').first()
  await link.scrollIntoViewIfNeeded(); await j.readerLayoutSettled()
  await link.evaluate(e => e.setAttribute("data-title-target", "")); await j.clickByMouse('[data-title-target]')
  await expect(page.locator('[data-reader-retry]')).toBeVisible()
  expect(new URL(page.url()).pathname).toBe(from)
  expect(await page.title()).toBe(before.title)
  await j.clickByMouse('[data-reader-retry]')
  await expect.poll(() => new URL(page.url()).pathname).toBe("/Systems")
  await expect(page.locator(READY)).toHaveCount(1)
  expect(requests).toBe(2)
  await exactTitle(page, "successful reader retry")
})
