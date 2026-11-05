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

// The link's 44px target has to fit between the choices and the film, and every neighbour keeps its own presses: 8px of
// it had lain over the bottom of the choice above, where a press opened the question instead of playing the move, and
// the first repair moved those 8px onto the film's Watch and Hide controls. elementFromPoint, because no press at a
// control's centre ever meets either. Tablets and short phones attach the line the same way, without the band; only a
// tall phone stands its two-line question apart.
for (const [width, height] of [[390, 631], [390, 844], [768, 900], [1024, 900], [1440, 900], [1920, 900]]) {
  test(`VIDEO3 at ${width}x${height} Answer for Points takes no press from the choices or the film`, async ({ page }) => {
    await boot(page, width, height)
    const g = await page.evaluate(() => {
      const a = (window as any).__neural, row = a.optionsRef.current as HTMLElement
      const go = document.querySelector("[data-land-ask-go]") as HTMLElement
      const cards = [...row.querySelectorAll("[data-tech]")].filter(c => c.getBoundingClientRect().height)
      const film = a._landFilmEl as HTMLElement | null
      const sample = (el: Element, rows: number[]) => {
        const b = el.getBoundingClientRect(); let samples = 0, stolen = 0
        for (let x = b.left + 8; x < b.right - 8; x += 4) for (const y of rows) {
          const at = document.elementFromPoint(x, y)
          if (!at) continue
          samples++
          if (go.contains(at)) stolen++
        }
        return { samples, stolen }
      }
      const edges = cards.map(c => { const b = c.getBoundingClientRect().bottom; return sample(c, Array.from({ length: 12 }, (_, i) => b - 1 - i)) })
      const filmTop = film ? film.getBoundingClientRect().top : null
      const onFilm = film ? sample(film, Array.from({ length: 12 }, (_, i) => filmTop! + 1 + i)) : null
      go.focus({ preventScroll: true })
      const box = go.getBoundingClientRect(), ring = getComputedStyle(go, "::before")
      const range = document.createRange()
      range.selectNode([...go.childNodes].find(n => n.nodeType === Node.TEXT_NODE)!)
      const label = range.getBoundingClientRect()
      return { samples: edges.reduce((n, e) => n + e.samples, 0), stolen: edges.reduce((n, e) => n + e.stolen, 0), onFilm, filmTop,
        height: box.height, top: box.top, bottom: box.bottom, cardsBottom: Math.max(...cards.map(c => c.getBoundingClientRect().bottom)),
        focused: go.matches(":focus-visible"), ringStyle: ring.outlineStyle, label: { top: label.top, bottom: label.bottom },
        ring: { top: box.top + parseFloat(ring.top), bottom: box.bottom - parseFloat(ring.bottom) } }
    })
    expect(g.samples, "premise: the choices' bottom edges were sampled").toBeGreaterThan(0)
    expect(g.stolen, "VIDEO3 Answer for Points takes no press from the choices").toBe(0)
    expect(g.top, "VIDEO3 Answer for Points starts below the choices").toBeGreaterThanOrEqual(g.cardsBottom)
    expect(g.onFilm?.samples, "premise: this page shows its film").toBeGreaterThan(0)
    expect(g.onFilm!.stolen, "VIDEO3 Answer for Points takes no press from the film").toBe(0)
    expect(g.bottom, "VIDEO3 Answer for Points ends above the film").toBeLessThanOrEqual(g.filmTop! + .5)
    expect(g.height, "VIDEO3 the link keeps its 44px target").toBeGreaterThanOrEqual(44)
    expect(g.focused, "premise: the link shows keyboard focus").toBe(true)
    if (width <= 640 && height >= 700) return
    expect(g.ringStyle, "VIDEO3 the focus ring is drawn").toBe("solid")
    expect(g.ring.top, "VIDEO3 the focus ring stays on the label").toBeLessThanOrEqual(g.label.top)
    expect(g.ring.bottom, "VIDEO3 the focus ring stays on the label").toBeGreaterThanOrEqual(g.label.bottom)
    expect(g.ring.bottom - g.ring.top, "VIDEO3 the focus ring stays on the label").toBeLessThanOrEqual(g.label.bottom - g.label.top + 12)
  })
}

// With the film closed the next thing under the link is the article's ✕. Their boxes overlap in a corner neither one
// paints; the ✕ takes it. On dev the link took 91px² of it, and the hang above grew that to 142px².
test("VIDEO3 at 390x631 with the film closed the article's close keeps its presses", async ({ page }) => {
  const j = await boot(page, 390, 631)
  await j.clickByMouse("[data-film-close]")
  for (let i = 0; i < 6; i++) await j.advance(100)
  await j.readerLayoutSettled()
  const g = await page.evaluate(() => {
    const go = document.querySelector("[data-land-ask-go]") as HTMLElement
    const close = [...document.querySelectorAll("[data-reader-close]")].find(e => e.getClientRects().length) as HTMLElement
    const c = close.getBoundingClientRect(), b = go.getBoundingClientRect()
    let inBoth = 0, stolen = 0
    for (let x = c.left + .5; x < c.right; x++) for (let y = c.top + .5; y < c.bottom; y++) {
      if (x >= b.left && x <= b.right && y >= b.top && y <= b.bottom) inBoth++
      // Only where the ✕ would have taken the press: its rounded corner is outside its own hit shape.
      const stack = document.elementsFromPoint(x, y)
      if (stack.includes(close) && go.contains(stack[0])) stolen++
    }
    return { inBoth, stolen, height: b.height }
  })
  expect(g.inBoth, "premise: the link's box reaches the close").toBeGreaterThan(0)
  expect(g.stolen, "VIDEO3 Answer for Points takes no press from the article's close").toBe(0)
  expect(g.height, "VIDEO3 the link keeps its 44px target").toBeGreaterThanOrEqual(44)
})

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
