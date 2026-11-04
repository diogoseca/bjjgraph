import { expect, test, type Page } from "@playwright/test"
import { journey } from "../dsl"

// VIDEO3: real authored questions and native text line boxes, not layout arithmetic.
// The harness omits remote fonts/provider media; all bounds are relative to the
// rendered choices row and its existing spacing token. Owner images use a real browser.
// Source controls must reject a skipped desktop fit and a detached desktop hint.
const PATH = "/Positions/Side-Control/Bottom"
const ASK = "[data-land-ask-text]"
const GO = "[data-land-ask-go]"

async function boot(page: Page, width: number, height = 900) {
  await page.setViewportSize({ width, height })
  const j = journey(page)
  await j.boot(PATH, { beforeNavigate: async () => {
    await page.route("**/static/neural/content/*.json", route => route.continue())
  } })
  await expect(page.locator('[data-reader][data-reader-ready="true"]')).toBeVisible()
  await expect(page.locator(ASK)).toBeVisible()
  await j.readerLayoutSettled()
  return j
}

async function geometry(page: Page) {
  return page.evaluate(() => {
    const a = (window as any).__neural, row = a.optionsRef.current as HTMLElement
    const ask = document.querySelector("[data-land-ask-text]") as HTMLElement
    const go = document.querySelector("[data-land-ask-go]") as HTMLElement
    const boxes = (el: Element) => {
      const range = document.createRange()
      range.selectNodeContents(el)
      return [...range.getClientRects()].filter(b => b.width && b.height).map(b => b.toJSON())
    }
    // Only leaf text ranges count: the control's 44px padded hit target is not a line box.
    const text = boxes(ask)
    const label = [...go.childNodes].filter(n => n.nodeType === Node.TEXT_NODE).flatMap(n => {
      const range = document.createRange(); range.selectNode(n)
      return [...range.getClientRects()].filter(b => b.width && b.height).map(b => b.toJSON())
    })
    const lines: { top: number, bottom: number }[] = []
    for (const b of [...text, ...label].sort((x, y) => x.top - y.top)) {
      const line = lines.find(l => b.top < l.bottom && b.bottom > l.top)
      if (line) { line.top = Math.min(line.top, b.top); line.bottom = Math.max(line.bottom, b.bottom) }
      else lines.push({ top: b.top, bottom: b.bottom })
    }
    const cards = [...row.querySelectorAll("[data-tech]")].map(c => ({
      id: c.getAttribute("data-tech"), box: c.getBoundingClientRect().toJSON()
    })).filter(c => c.box.width && c.box.height)
    if (!cards.length || !text.length || !label.length) throw Error("Missing painted choices or question text")
    const css = getComputedStyle(a._landEl)
    return { row: row.getBoundingClientRect().toJSON(), cards, text, label, lines,
      full: ask.dataset.full || ask.textContent!, shown: ask.textContent!, link: go.textContent,
      padding: css.padding, token: parseFloat(css.getPropertyValue("--section-gap")),
      gap: ask.getBoundingClientRect().top - Math.max(...cards.map(c => c.box.bottom)),
      scroll: a._reader.root.scrollTop, clipped: ask.parentElement!.scrollWidth > ask.parentElement!.clientWidth + 1 }
  })
}

for (const width of [1024, 1440, 1920]) {
  test(`@curated VIDEO3 at ${width}px the collapsed question is one hint line inside the choices band`, async ({ page }) => {
    const j = await boot(page, width), g = await geometry(page)
    await test.info().attach("collapsed-question", { body: JSON.stringify(g), contentType: "application/json" })
    expect(g.lines, "VIDEO3 the collapsed question and Answer for Points occupy one line").toHaveLength(1)
    expect(g.text).toHaveLength(1)
    for (const box of [...g.text, ...g.label]) {
      expect(box.top, "VIDEO3 the question stays inside the choices row").toBeGreaterThanOrEqual(g.row.top)
      expect(box.bottom, "VIDEO3 the question stays inside the choices row").toBeLessThanOrEqual(g.row.bottom)
      expect(box.left, "VIDEO3 the question stays inside the choices row").toBeGreaterThanOrEqual(g.row.left)
      expect(box.right, "VIDEO3 the question stays inside the choices row").toBeLessThanOrEqual(g.row.right)
    }
    expect(g.link).toBe("Answer for Points")
    expect(g.shown.length).toBeGreaterThan(3)
    expect(g.full.length, "premise: the authored question needs trimming").toBeGreaterThan(g.shown.length)
    expect(g.shown).toMatch(/…$/)
    expect(g.clipped).toBe(false)
    expect(g.padding).toBe("0px 0px 0px 3px")
    expect(g.gap, "VIDEO3 the attached hint keeps the visible section gap").toBeCloseTo(g.token, 1)
    expect(g.gap).toBeGreaterThanOrEqual(5)
    expect(g.gap).toBeLessThanOrEqual(6.1)
    await j.clickByMouse(GO)
    await j.readerLayoutSettled()
    await expect(page.locator(GO)).toHaveCount(0)
    const expanded = await page.evaluate(() => {
      const a = (window as any).__neural, row = a.optionsRef.current, q = a._landEl.querySelector("[data-land-q]")
      return { text: q.firstElementChild.textContent, inert: q.lastElementChild.inert,
        scroll: a._reader.root.scrollTop, played: !!a._played,
        cards: [...row.querySelectorAll("[data-tech]")].map((c: Element) => ({ id: c.getAttribute("data-tech"), top: c.getBoundingClientRect().top })) }
    })
    expect(expanded.text, "the expanded card restores the complete authored question").toBe(g.full)
    expect(expanded.inert).toBe(false)
    expect(expanded.played, "reading takes up the question without starting a roll").toBe(false)
    expect(expanded.scroll).toBe(g.scroll)
    expect(expanded.cards).toEqual(g.cards.map(c => ({ id: c.id, top: c.box.top })))
  })
}

test("@curated VIDEO3 resize and reveal restore the choices row's original padding", async ({ page }) => {
  const j = await boot(page, 900)
  const padding = () => page.evaluate(() => getComputedStyle((window as any).__neural.optionsRef.current).paddingBottom)
  const original = await padding()
  const resize = async (width: number) => {
    await page.setViewportSize({ width, height: 900 })
    for (let i = 0; i < 6; i++) await j.advance(100)
    await j.readerLayoutSettled()
  }
  await resize(1440)
  expect(parseFloat(await padding()), "VIDEO3 the desktop row includes its hint").toBeGreaterThan(parseFloat(original))
  await resize(900)
  expect(await padding(), "VIDEO3 narrowing restores the original choices padding").toBe(original)
  const narrow = await geometry(page)
  expect(narrow.gap).toBeCloseTo(narrow.token, 1)
  await resize(1440)
  await j.clickByMouse(GO)
  await j.readerLayoutSettled()
  expect(await padding(), "VIDEO3 revealing restores the original choices padding").toBe(original)
})
