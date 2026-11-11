import { test, expect, type Page } from "@playwright/test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { journey } from "../dsl"

/**
 * CARDGAP1 (owner, 2026-11-11, v1.256.3): "when i click the x on the corner of the landcard to close it i was expecting it to go
 * back into being a question or even a simple Questions [slashed eye] instead of this big ass space between sections where the
 * landcard used to be".
 *
 * Wherever the stage stacks (under an 800px grid, or a window under 500px tall), the card's ✕ left the film's height plus 20px of
 * bare map between Moves and the closed Questions label: 240px at 390x844, 311px at 574x760. A film-first line in reader.src.js
 * placed the film under Moves and advanced past it, and the closed-card line after the label placed it again; both fired, and
 * only the second placement was ever seen. The claim here: after the ✕, the label's top is Moves' bottom plus the SAME step the
 * label keeps from the film under it, measured in the same frame, and nothing painted lies between Moves and the label. By mouse
 * and by touch, at 390x844, 390x631 (the real p10 phone) and 574x760 (the owner's window), then after a reload (the ✕ is a
 * setting) and after one more landing. One test closes and reopens Moves, resizes the window, then closes the film.
 *
 * WHAT THE HARNESS DOES NOT SERVE: dossier chunks (the DSL answers {}), so without `withFilm` no landing has a film, and the
 * gap, which is the film's height, cannot appear at all. Every position block in every chunk gets two authored clips, served
 * through the real fetch; each test asserts the film is painted before it measures anything. Posters are aborted (off-origin), and
 * the film's frame keeps its height without them.
 *
 * CONTROL: 1440x900, where the index carries the closed part and the columns place the film (no label in the content). Green on
 * the fixed build and on the mutant, so the narrow reds below come from the claim, not from the fixture.
 *
 * MUTANT (by hand, v1.256.3): restore the deleted line, `if (homeMedia && !beside && !follows) { position(home, …, y, mediaWidth);
 * y += mediaHeight + 12; }`, above `if (pin) y = pin.cardY …` in reader.src.js → red at every narrow test, at "the label sits one
 * step under Moves" (240 vs 8 at 390, 311 vs 8 at 574); the 1440 control stays green.
 * NOT PINNED HERE: the label's look, its 44px target and its contrast (article-sections.spec.ts); the column layouts from 1024px
 * (article-sections.spec.ts measures the label under the article there, not its gap).
 *
 * U131 b2 (HIDESEC2, merged after this file): a ✕ leaves no label now. WAS: the closed card's Questions label one step under Moves.
 * NOW: its message stands in that place for five seconds, one step under Moves with the film one step under it, and once it has gone
 * (and after a reload, and on the next landing) the film takes the place, one step under Moves: never a film's height. The same holds
 * for Moves' message and the video's (which stands in the film's place). The mutant above is now a row of
 * tests/artifacts/article_sections_mutants.mjs (cardgap-film-first-line).
 */

const CLIPS = [{ id: "ddddddddddd", title: "Authored clip one", duration: 600 }, { id: "eeeeeeeeeee", title: "Authored clip two", duration: 20 }]

/** Real dossier chunks through the real fetch, each position block carrying two authored clips. */
const withFilm = async (p: Page) => {
  await p.route("**/static/neural/content/*.json", async (route) => {
    const file = new URL(route.request().url()).pathname.split("/").pop()!
    let data: Record<string, any> = {}
    try { data = JSON.parse(readFileSync(resolve(__dirname, "../../source/public/static/neural/content", file), "utf8")) } catch { /* a chunk this build does not hold answers {} */ }
    for (const [name, block] of Object.entries(data)) if (name.includes("|") && block && typeof block === "object") block.clips = CLIPS.map(c => ({ ...c }))
    await route.fulfill({ json: data })
  })
}

type Box = { top: number, bottom: number, height: number, name: string }
/** What the stage painted, read back from the DOM after the reader's own layout pass. */
const stack = (page: Page) => page.evaluate(() => {
  const a = (window as any).__neural, r = a._reader
  const box = (e: Element | null | undefined, name: string) => {
    if (!e || !(e as HTMLElement).isConnected) return null
    const cs = getComputedStyle(e)
    if ((e as HTMLElement).hidden || cs.display === "none" || cs.visibility === "hidden") return null
    const b = e.getBoundingClientRect()
    return b.height > 0 ? { top: b.top, bottom: b.bottom, height: b.height, name } : null
  }
  const tiles = [...r.root.querySelectorAll(".ng-reader-article .ng-section-card")] as Element[]
  const painted = [box(a._landEl, "card"), box(r.mediaHome, "film"), ...[...r.game.children].map((e: any, i) => box(e, "game:" + (e.id || e.className || i))),
    ...tiles.map((e, i) => box(e, "tile:" + i))].filter(Boolean) as Box[]
  return {
    hand: box(a.optionsRef.current, "hand"), moves: box(document.getElementById("reader-hand"), "moves label"),
    label: box(document.getElementById("reader-card"), "questions label"), film: box(r.mediaHome, "film"), painted,
    message: !!document.querySelector('[data-hidesec-notice="card"]'), columns: r.game.dataset.mediaLayout === "side-by-side",
    card: !!a._landEl, landCard: a.get("landCard", true), indexed: r.root.hasAttribute("data-indexed"),
  }
})

/** The claim: what takes the closed question's place (its message while it stands, else the film) is one step under what is above it
 *  (Moves, or Moves' own message), the step it keeps from the part below; nothing painted lies between. WAS (v1.256.3): the label. */
const expectNoGap = async (page: Page, when: string, { film = true }: { film?: boolean } = {}) => {
  const s = await stack(page)
  expect(s.card, when + ": the card is closed").toBe(false)
  const above = s.hand || s.moves
  expect(above, when + ": Moves, or its closed place, is painted").not.toBeNull()
  if (film) expect(s.film?.height ?? 0, when + ": the film is painted (the gap the claim is about is its height)").toBeGreaterThan(100)
  // U131 b2: while the question's message stands, its place is the closed card's slot; once it has gone, the film's top is the place.
  const place = s.message ? s.label : s.film
  expect(place, when + (s.message ? ": the question's message stands in its place" : ": the film takes the question's place")).not.toBeNull()
  // In columns (1440) the film is a cell under the message's row, flush, as it was under the label at 1,024 to 1,349px: the step below
  // is the stacked stage's claim only.
  const stacked = film && s.message && !s.columns
  const gapAbove = place!.top - above!.bottom, gapBelow = stacked ? s.film!.top - s.label!.bottom : NaN
  if (stacked) expect(Math.abs(gapAbove - gapBelow), `${when}: the message sits one step under Moves (above ${gapAbove.toFixed(1)}, under it ${gapBelow.toFixed(1)})`).toBeLessThan(1)
  expect(gapAbove, when + ": it never overlaps Moves").toBeGreaterThanOrEqual(-0.5)
  expect(gapAbove, when + ": it is one step under Moves, never a film's height").toBeLessThan(20)
  const between = s.painted.filter(b => b.name !== above!.name && b.name !== "game:reader-card" && b.name !== "game:reader-hand" && b.bottom > above!.bottom + 0.5 && b.top < place!.top - 0.5)
  expect(between.map(b => b.name), when + ": nothing painted lies between Moves and it").toEqual([])
  return { gap: gapAbove, step: stacked ? gapBelow : null }
}
/** The question's message has gone (a mouse is moved off first: a mouse over a message holds it). */
const messageGone = async (page: Page, j: ReturnType<typeof journey>, key = "card") => {
  await page.mouse.move(2, 2)
  await page.waitForFunction(k => !document.querySelector(`[data-hidesec-notice="${k}"]`), key, { timeout: 15000 })
  await j.readerLayoutSettled()
}

/** A touch tap at the control's measured centre, refused when anything else owns the point (clickByMouse's rule). */
const tapByTouch = async (page: Page, selector: string, what: string) => {
  const hit = await page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement | null
    if (!el) return { ok: false, x: 0, y: 0, why: "no element matches" }
    const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2
    if (r.width < 1 || x < 0 || y < 0 || x > innerWidth || y > innerHeight) return { ok: false, x, y, why: "not on screen " + JSON.stringify(r) }
    const top = document.elementFromPoint(x, y)
    return { ok: !!top && (top === el || el.contains(top)), x, y, why: top ? "elementFromPoint is <" + top.tagName.toLowerCase() + " " + String((top as HTMLElement).className) + ">" : "nothing" }
  }, selector)
  expect(hit.ok, `${what} is reachable by touch where it sits: ${hit.why}`).toBe(true)
  await page.touchscreen.tap(hit.x, hit.y)
}

/** One deterministic hop (land-layers.spec.ts's): the first transitions-type option, rigged to succeed. */
const hop = async (page: Page, j: ReturnType<typeof journey>) => {
  const t = await page.evaluate(() => {
    const a = (window as any).__neural
    for (const o of a.optionIdxs || []) { const n = a.nodes[typeof o === "number" ? o : o.idx]; if (n && n.ty === "transitions") return n.t }
    return ""
  })
  expect(t, "a transitions-type option to hop on").not.toBe("")
  await j.rig("resolve", [0.01]); await j.rig("outcome", [0.01])
  await j.pick(t)
  await j.nextHand()
}

const arrive = async (page: Page, j: ReturnType<typeof journey>, preserveStorage = false) => {
  await j.boot("/", { preserveStorage, beforeNavigate: withFilm })
  await j.land("Mount Top")
  await expect(page.locator('[data-reader-ready="true"]')).toBeVisible()
  await j.readerLayoutSettled()
}

for (const viewport of [{ width: 390, height: 844 }, { width: 390, height: 631 }, { width: 574, height: 760 }]) for (const input of ["mouse", "touch"] as const) {
  test.describe(`${viewport.width}x${viewport.height} by ${input}`, () => {
    test.use(input === "touch" ? { viewport, hasTouch: true, isMobile: true } : { viewport })
    test(`@curated CARDGAP1 after the card's ✕ the Questions label sits one step under Moves, through a reload and the next landing (${viewport.width}x${viewport.height}, ${input})`, async ({ page }) => {
      const j = journey(page)
      await arrive(page, j)
      const open = await stack(page)
      expect(open.card, "the landing shows its question card").toBe(true)
      expect(open.film?.height ?? 0, "the authored film is painted with the card open").toBeGreaterThan(100)
      if (input === "touch") await tapByTouch(page, "[data-land-close]", "the card's ✕")
      else await j.clickByMouse("[data-land-close]", "the card's ✕")
      await j.readerLayoutSettled()
      const first = await expectNoGap(page, "after the ✕ (its message)")
      await messageGone(page, j)
      const gone = await expectNoGap(page, "once its message has gone (the film)")
      expect(gone.gap, "the film takes the place at the same step").toBeCloseTo(first.gap, 0)
      await j.advance(1200) // > the 400ms save debounce: the ✕ is a setting
      expect((await stack(page)).landCard, "the ✕ is saved").toBe(false)

      await arrive(page, j, true)
      const reloaded = await expectNoGap(page, "after a reload")
      expect(reloaded.gap, "the same step after a reload").toBeCloseTo(first.gap, 0)

      await hop(page, j)
      // HIDESEC2: the next landing's hand can still be inside D-351's hold (published pending, hidden) when the layout settles; measured
      // 1 run in 3 at 574x760 by mouse on a loaded box. Its publication is the moment the claim is about.
      await expect.poll(() => page.evaluate(() => { const r = (window as any).__neural.optionsRef.current; return !!r && !r.hasAttribute("data-reader-pending") }), { message: "the next hand is published" }).toBe(true)
      await j.readerLayoutSettled()
      const next = await expectNoGap(page, "after the next landing")
      expect(next.gap, "the same step after the next landing").toBeCloseTo(first.gap, 0)
    })
  })
}

test.describe("390x844, Moves closed and reopened, a resize, then the film closed", () => {
  test.use({ viewport: { width: 390, height: 844 } })
  test("@curated CARDGAP1 the Questions label keeps one step under Moves with Moves or the film closed, and across a resize", async ({ page }) => {
    const j = journey(page)
    await arrive(page, j)
    await j.clickByMouse("[data-land-close]", "the card's ✕")
    await j.readerLayoutSettled()
    const { gap } = await expectNoGap(page, "after the ✕")

    await j.clickByMouse("[data-hand-close]", "Moves' ✕")
    await j.readerLayoutSettled()
    expect((await stack(page)).hand, "Moves closed").toBeNull()
    expect((await expectNoGap(page, "Moves closed")).gap, "what stands in the question's place is one step under Moves' message").toBeCloseTo(gap, 0)
    // WAS: reopened from Moves' label. NOW (U131 b2): from its message's Undo.
    await j.clickByMouse('[data-hidesec-notice="hand"] [data-hidesec-undo]', "reopen Moves from its message's Undo")
    await j.readerLayoutSettled()
    expect((await expectNoGap(page, "Moves reopened")).gap, "the same step with Moves back").toBeCloseTo(gap, 0)

    await page.setViewportSize({ width: 574, height: 760 }); await j.readerLayoutSettled()
    await expectNoGap(page, "resized to 574x760")
    await page.setViewportSize({ width: 390, height: 844 }); await j.readerLayoutSettled()
    expect((await expectNoGap(page, "resized back to 390x844")).gap, "the same step after the resize").toBeCloseTo(gap, 0)

    // Last: the film's ✕. WAS: the Questions label kept its step with the film closed. NOW (U131 b2): the video's message stands in the
    // film's place, and whatever stands in the question's place is still one step under Moves.
    await messageGone(page, j)
    await page.locator("[data-film-close]").scrollIntoViewIfNeeded(); await j.readerLayoutSettled()
    await j.clickByMouse("[data-film-close]", "the film's ✕")
    await j.readerLayoutSettled()
    await page.locator('[data-reader-ready="true"]').evaluate(e => { e.scrollTop = 0 }); await j.readerLayoutSettled()
    const shut = await stack(page)
    expect(shut.film, "the video's message stands in the film's place").not.toBeNull()
    expect(shut.film!.top - shut.hand!.bottom, "one step under Moves, never a film's height").toBeLessThan(20)
    expect(shut.film!.top - shut.hand!.bottom, "and never over it").toBeGreaterThanOrEqual(-0.5)
  })
})

test.describe("1440x900 control", () => {
  test.use({ viewport: { width: 1440, height: 900 } })
  test("@curated CARDGAP1 control: at 1440 the index carries the closed card and the film follows Moves at one step", async ({ page }) => {
    const j = journey(page)
    await arrive(page, j)
    await j.clickByMouse("[data-land-close]", "the card's ✕")
    await j.readerLayoutSettled()
    // U131 b2: the question's message stands in its place for five seconds; the control is read once it has gone.
    await messageGone(page, j)
    const s = await stack(page)
    expect(s.indexed, "the index shows at this width").toBe(true)
    expect(s.label, "no label in the content where the index carries the closed part").toBeNull()
    await expect(page.locator('[data-toc-type="card"]')).toHaveAttribute("data-collapsed", "true")
    expect(s.film?.height ?? 0, "the film is painted").toBeGreaterThan(100)
    const gap = s.film!.top - s.hand!.bottom
    expect(gap, `the film follows Moves at one step (${gap.toFixed(1)})`).toBeGreaterThanOrEqual(-0.5)
    expect(gap, "never a film's height").toBeLessThan(20)
    await j.clickByMouse('[data-toc-type="card"] a', "reopen the card from its index row")
    await expect(page.locator("[data-landcard]"), "the index row restores a visible card").toBeVisible()
  })
})

// HIDESEC2: a PINNED landing (D-351: its article came after the 800ms hold, so its parts publish pinned) whose card is then closed by
// its ✕. _readerHold released a pin on "the card closed" only while the card still existed, which the ✕ removes first, so the pin
// outlived the close and kept the closed card's old top: the message, then the film, stood 4px into Moves' band (seen at 1440 above on a
// run the hold happened to pin). The ✕ settles the pin now (reader.src.js). Pinned here by holding the article back, not by luck.
// Control: hidesec2-card-close-keeps-pin (tests/artifacts/article_sections_mutants.mjs).
test.describe("1440x900 pinned", () => {
  test.use({ viewport: { width: 1440, height: 900 } })
  test("@curated HIDESEC2 a pinned landing's card ✕ settles the pin: its message, then the film, one step under Moves", async ({ page }) => {
    const j = journey(page)
    await j.boot("/", { beforeNavigate: withFilm, payloads: { "/Positions/Mount": { afterMs: 1500 } } })
    await j.land("Mount Top")
    await expect(page.locator('[data-reader-ready="true"]')).toBeVisible()
    await j.readerLayoutSettled()
    await expect.poll(() => page.evaluate(() => !!(window as any).__neural._readerPin), { message: "premise: the landing published pinned" }).toBe(true)
    await j.clickByMouse("[data-land-close]", "the card's ✕")
    await j.readerLayoutSettled()
    expect(await page.evaluate(() => !!(window as any).__neural._readerPin), "the card's ✕ settles the pin").toBe(false)
    await expectNoGap(page, "after the ✕ (its message)")
    await messageGone(page, j)
    await expectNoGap(page, "once its message has gone (the film)")
  })
})

