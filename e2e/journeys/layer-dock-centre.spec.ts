import { test, expect, type Page } from "@playwright/test"
import { journey, type Journey } from "../dsl"

/** The labeled shelf follows the article's measured column beside Browse.
 * Films are authored because the DSL omits dossiers. Replay retains its original
 * card-column tests. Old More/dock mutants describe the retired geometry; reader
 * mutation results are recorded in reading-mode.spec.ts. */

async function settle(page: Page, j: Journey) {
  await j.advance(100)
  await page.waitForTimeout(450) // CSS transitions use wall time; the graph uses pumped frames.
  await j.advance(3500)
}

async function setup(page: Page) {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await page.evaluate(() => {
    const w = window as any, a = w.__neural
    const key = a.deckKeyFor(a.nodes[a.currentPos]).key
    w.NG_CONTENT ||= {}; w.NG_CONTENT.decks ||= {}
    w.NG_CONTENT.decks[key] = {
      cat: "Position", role: "Top", lead: "Dock fixture: a stable connection.",
      principles: ["Keep your base wide while your partner bridges.", "Hips low, chest heavy, hands free."],
      clips: [
        { id: "aQ2vFXXBn-o", title: "First mounted demonstration" },
        { id: "aQ2vFXXBn-o", title: "Second mounted demonstration" },
      ],
    }
    a.onContentReady(key)
  })
  await expect(page.locator("[data-land-film] .ng-clip")).toHaveCount(2)
  await expect(page.locator('[data-reader-ready="true"]')).toBeVisible()
  await settle(page, j)
  if (await page.locator('[data-reward-close]').isVisible()) await j.clickByMouse('[data-reward-close]', 'dismiss the earned patch before measuring dock controls')
  return j
}

type Box = { l: number; r: number; t: number; b: number; w: number; h: number; c: number }
type Geo = {
  W: number; pane: Box | null; card: Box | null; article: Box | null; film: Box | null; dock: Box | null; replay: Box | null
  glyphs: { layer: string | null; box: Box; own: boolean }[]
}

const geo = (page: Page): Promise<Geo> => page.evaluate(() => {
  const rect = (el: Element): any => {
    const q = el.getBoundingClientRect()
    return { l: q.left, r: q.right, t: q.top, b: q.bottom, w: q.width, h: q.height, c: q.left + q.width / 2 }
  }
  const box = (sel: string) => { const el = document.querySelector(sel); return el ? rect(el) : null }
  const pane = document.querySelector(".ng-drill") as HTMLElement
  return {
    W: innerWidth,
    pane: pane && getComputedStyle(pane).display !== "none" ? rect(pane) : null,
    card: box("[data-landcard]"), article: box("[data-reader]"), film: box("[data-land-film]"), dock: box("[data-layer-dock]"),
    replay: box("[data-replay-bar]"),
    glyphs: Array.from(document.querySelectorAll("[data-layer-show]")).map((b) => {
      const q = rect(b)
      const hit = q.c >= 0 && q.c <= innerWidth ? document.elementFromPoint(q.c, q.t + q.h / 2) : null
      return { layer: b.getAttribute("data-layer-show"), box: q, own: !!hit && (hit === b || b.contains(hit)) }
    }),
  }
})

/** Two published centres agree to a pixel (subpixel positions round differently per element). */
const same = (a: number | undefined, b: number | undefined, what: string) => {
  expect(a, `${what}: first centre measured`).toBeDefined()
  expect(b, `${what}: second centre measured`).toBeDefined()
  expect(Math.abs(a! - b!), `${what} (${a!.toFixed(1)} vs ${b!.toFixed(1)})`).toBeLessThanOrEqual(1)
}

const openPane = async (page: Page, j: Journey) => {
  await j.clickByMouse(".ng-logo", "the pane opener")
  await expect(page.locator(".ng-drill")).toBeVisible()
}
const closePane = (j: Journey) => j.clickByMouse(".ng-explorer-close", "the pane close button")

for (const width of [1440, 1024, 800]) {
  test(`@curated ${width}px with the pane open, the dock sits under the column: the article stays when the question is minimized, then the film's ✕`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const j = await setup(page)
    const shut = await geo(page)
    await openPane(page, j)
    await settle(page, j)
    const open = await geo(page)
    expect(open.card!.c - shut.card!.c, "premise: the column moved right for the pane").toBeGreaterThan(40)

    // ── the owner's path: the reading column open, then the card put away ──
    await j.clickByMouse("[data-land-close]", "the card's ✕ while More is open")
    const first = await geo(page)
    expect(first.glyphs.map((g) => g.layer), "the dock offers the card back").toEqual(["card"])
    expect(first.card, "the card layer is away").toBeNull()
    same(first.dock?.c, first.article?.c, "the dock's FIRST frame sits under the film strip")
    await settle(page, j)
    const put = await geo(page)
    same(put.dock?.c, put.article?.c, "settled, the dock sits under the film strip")
    expect(put.dock!.l, "…clear of the pane").toBeGreaterThan(put.pane!.r)
    await j.clickByMouse('[data-layer-show="card"]', "the dock's card glyph, beside the open pane")
    await settle(page, j)
    expect((await geo(page)).dock, "the labeled shelf remains available").not.toBeNull()

    if (await page.locator("[data-reward-close]").isVisible()) await j.clickByMouse("[data-reward-close]")
    // ── the film put away: now the card itself is what the dock sits under ──
    await j.clickByMouse("[data-film-close]", "the film's ✕, with the pane open")
    const f1 = await geo(page)
    expect(f1.glyphs.map((g) => g.layer)).toEqual(["film"])
    same(f1.dock?.c, f1.article?.c, "the dock's FIRST frame sits under the card")
    await settle(page, j)
    const f2 = await geo(page)
    same(f2.dock?.c, f2.article?.c, "settled, the dock sits under the card")
    same(f2.article?.c, open.article?.c, "the toggles preserve the article column")
    expect(f2.dock!.l, "…clear of the pane").toBeGreaterThan(f2.pane!.r)

    // ── and the card too: NO column member is left (a state with no film authored reaches this
    // with one ✕). The dock is the only thing still laid out, so nothing else can place it. ──
    await j.clickByMouse("[data-land-close]", "the card's ✕ with the film already away")
    const n1 = await geo(page)
    expect(n1.card === null && n1.film === null, "premise: neither card nor film is mounted").toBe(true)
    expect(n1.glyphs.map((g) => g.layer)).toEqual(["film", "card"])
    await settle(page, j)
    const n2 = await geo(page)
    for (const g of [n1, n2]) {
      expect(g.dock!.l, "alone, the dock is still clear of the pane").toBeGreaterThan(g.pane!.r)
      for (const x of g.glyphs) expect(x.own, `alone, ${x.layer} owns its centre`).toBe(true)
    }
    // Where the card is not clamped against the right edge, the free area's centre IS the
    // column's, so the dock must not move when the column's last member leaves. (At 800 the card
    // is clamped — its right edge would leave the screen — so there it legitimately does move.)
    if (width >= 1024) {
      same(n1.dock?.c, f2.article?.c, "alone, first frame: where the card's centre was")
      same(n2.dock?.c, f2.article?.c, "alone, settled: where the card's centre was")
    }
    await j.clickByMouse('[data-layer-show="card"]', "the dock's card glyph with nothing else up")
    await settle(page, j)
    await j.clickByMouse('[data-layer-show="film"]', "the dock's film glyph, beside the open pane")
    await settle(page, j)
    const back = await geo(page)
    expect(back.card, "the card came back from the dock").not.toBeNull()
    expect(back.film, "the film strip came back from the dock").not.toBeNull()
    expect(back.dock).not.toBeNull()
  })
}

test("@curated the dock rides the pane's open AND close animation frame by frame, never ahead of the card", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const j = await setup(page)
  await j.clickByMouse("[data-film-close]", "the film's ✕")
  await settle(page, j)
  const shut = await geo(page)
  same(shut.dock?.c, shut.card?.c, "pane shut: under the card")
  same(shut.dock?.c, shut.W / 2, "pane shut: where it always was, the viewport's centre")

  const walk = async (label: string) => {
    const frames: Geo[] = []
    for (let i = 0; i < 4; i++) { await j.advance(50); frames.push(await geo(page)) }
    return frames
  }
  await openPane(page, j)
  const opening = await walk("opening")
  await settle(page, j)
  const open = await geo(page)
  await closePane(j)
  const closing = await walk("closing")
  await settle(page, j)
  const closed = await geo(page)

  const lo = shut.card!.c + 10, hi = open.card!.c - 10
  for (const [label, frames] of [["opening", opening], ["closing", closing]] as const) {
    const mid = frames.filter((g) => g.card!.c > lo && g.card!.c < hi)
    expect(mid.length, `premise: ${label} frames were sampled MID-animation`).toBeGreaterThanOrEqual(3)
    frames.forEach((g, i) => same(g.dock?.c, g.article?.c, `${label} frame ${i}: the dock travels WITH the article`))
  }
  // the close is the hard half: display:none zeroes the pane's rect on the first frame, and only
  // the width `_paneLayout` retained keeps the column (and now the dock) gliding home
  expect(closing.every((g) => g.pane === null), "premise: the pane's rect is already gone while closing").toBe(true)
  same(open.dock?.c, open.card?.c, "open: under the card")
  same(closed.dock?.c, shut.dock?.c, "closed: back where it started")
})

test("@curated resizing with the pane open re-centres the dock with the column at every width", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const j = await setup(page)
  await j.clickByMouse("[data-film-close]", "the film's ✕")
  await openPane(page, j)
  await settle(page, j)
  for (const vp of [{ width: 1024, height: 900 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(vp)
    await settle(page, j)
    const g = await geo(page)
    same(g.dock?.c, g.article?.c, `${vp.width}px after a resize with the pane open: under the article`)
  }
  await j.clickByMouse('[data-layer-show="film"]', "the dock's film glyph after the resizes")
  await settle(page, j)
  expect((await geo(page)).film).not.toBeNull()
})

test("@curated short landscape: with the pane open the dock stays out from under it, and takes a real click", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 })
  const j = await setup(page)
  expect(await page.evaluate(() => (window as any).__neural._compactLandDeck()), "premise: the two-column composition").toBe(true)
  await j.clickByMouse("[data-film-close]", "the film's ✕")
  await settle(page, j)
  const shut = await geo(page)
  same(shut.dock?.c, shut.W / 2, "pane shut: where it always was, the viewport's centre")
  await openPane(page, j)
  await settle(page, j)
  const open = await geo(page)
  // the deck column (left) sits UNDER an open pane in this composition, by design; the dock must not
  expect(open.card!.l, "premise: the card column is under the pane").toBeLessThan(open.pane!.r)
  expect(open.dock!.l, "the dock is clear of the pane").toBeGreaterThan(open.pane!.r)
  for (const g of open.glyphs) expect(g.own, `${g.layer}: owns its centre beside the open pane`).toBe(true)
  await j.clickByMouse('[data-layer-show="film"]', "the dock's film glyph beside the open pane")
  await settle(page, j)
  expect((await geo(page)).film).not.toBeNull()
})

for (const width of [1440, 1024]) {
  test(`@curated ${width}px a replay started from the open pane plays under the column, clear of the pane`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const j = journey(page)
    await j.boot("/")
    await j.land("Mount Top")
    // one archived roll (history-replay.spec.ts's recipe): take exchanges until the roll moved
    let moved = 1
    for (let n = 0; n < 5 && moved < 2; n++) {
      await j.rig("resolve", [0.01])
      await j.rig("outcome", [0.01])
      const titles = await j.optionTitles()
      await j.pick(titles[Math.min(n, titles.length - 1)])
      await j.nextHand()
      moved = await page.evaluate(() => ((window as any).__neural.rollLog || []).length)
    }
    expect(moved, "premise: the roll has an edge to replay").toBeGreaterThan(1)
    await page.evaluate(() => { const a = (window as any).__neural; a.rollFromPosition(a.currentPos, true) })
    await j.advance(1500)
    await page.evaluate(() => { for (const b of Array.from(document.querySelectorAll("[data-reward-close]"))) (b as HTMLElement).click() })
    const ts = await page.evaluate(() => ((window as any).__neural._pastRolls || [])[0].ts)
    await page.evaluate(() => (window as any).__neural.openPane("history"))
    await settle(page, j)
    await j.clickByMouse(`[data-replay-roll="${ts}"]`, "the past roll's replay control, in the open pane")
    await expect(page.locator("[data-replay-bar]")).toBeVisible()
    await j.advance(200)
    await page.waitForTimeout(100) // the bar docks on a real animation frame (`_renderReplayBar`)
    const g = await geo(page)
    expect(g.card, "premise: the card it stands in for is mounted (stood down, measurable)").not.toBeNull()
    expect(g.card!.l, "premise: the column sits beside the pane").toBeGreaterThanOrEqual(g.pane!.r)
    same(g.replay?.c, g.card?.c, "the replay bar sits where the card it stands in for sits")
    expect(g.replay!.l, "…clear of the pane, so it cannot paint over the pane's rows").toBeGreaterThanOrEqual(g.pane!.r)
    await j.clickByMouse("[data-replay-stop]", "the replay bar's ✕ beside the open pane")
    await expect(page.locator("[data-replay-bar]")).toHaveCount(0)
  })
}

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })
  test("@curated the dock stays under the card, keeps its 44px targets, and clears the share cue on its first frame", async ({ page }) => {
    const j = await setup(page)
    await j.clickByMouse("[data-film-close]", "the film's ✕")
    await settle(page, j)
    const g = await geo(page)
    same(g.dock?.c, g.article?.c, "no cue: under the card")
    for (const x of g.glyphs) {
      expect(x.box.w, `${x.layer}: 44px wide`).toBeGreaterThanOrEqual(44)
      expect(x.box.h, `${x.layer}: 44px tall`).toBeGreaterThanOrEqual(44)
      expect(x.own, `${x.layer}: owns its centre`).toBe(true)
    }
    // the drawer overlays a phone rather than shifting the column: nothing moves under it
    await openPane(page, j)
    await settle(page, j)
    same((await geo(page)).dock?.c, g.dock?.c, "drawer open: the dock did not move")
    await closePane(j)
    await settle(page, j)

    // A LIVE SHARE CUE (a stale link — the cue kind that needs no list behind it). v1.171.0: the
    // dock steps LEFT of the column so it clears the cue's pill in the thumb band. Read with no
    // frame pumped: `_setShareCue` re-renders the dock, and that render must place it itself.
    await page.evaluate(() => (window as any).__neural._setShareCue({ kind: "stale" }))
    const cued = await page.evaluate(() => {
      const d = document.querySelector("[data-layer-dock]")!.getBoundingClientRect()
      const cue = Array.from(document.querySelectorAll("[data-share-open]")).map((b) => b.getBoundingClientRect())
      const glyphs = Array.from(document.querySelectorAll("[data-layer-show]")).map((b) => {
        const q = b.getBoundingClientRect(), x = q.left + q.width / 2, y = q.top + q.height / 2
        const hit = x >= 0 && x <= innerWidth ? document.elementFromPoint(x, y) : null
        return { l: q.left, r: q.right, t: q.top, b: q.bottom, own: !!hit && (hit === b || b.contains(hit)) }
      })
      const card = document.querySelector("[data-landcard]")!.getBoundingClientRect()
      return { dock: d.left + d.width / 2, card: card.left + card.width / 2, cue: cue.map((q) => ({ l: q.left, r: q.right, t: q.top, b: q.bottom })), glyphs }
    })
    expect(cued.cue.length, "premise: the cue's pill is up").toBeGreaterThan(0)
    expect(cued.dock, "the shelf remains centered; it clears the cue vertically").toBeCloseTo(cued.card, 0)
    const hits = (a: any, b: any) => !(a.r <= b.l || a.l >= b.r || a.b <= b.t || a.t >= b.b)
    for (const x of cued.glyphs) {
      expect(x.own, "each glyph is on screen and owns its centre on the cue's first frame").toBe(true)
      for (const c of cued.cue) expect(hits(x, c), "no glyph under the cue's pill").toBe(false)
    }
    await j.advance(300)
    const held = await geo(page)
    expect(held.dock!.c, "…and the per-frame layout keeps the step").toBeCloseTo(cued.dock, 0)
    await page.evaluate(() => (window as any).__neural._setShareCue(null))
    same((await geo(page)).dock?.c, g.card?.c, "cue gone: back under the card")
    const c = (await geo(page)).glyphs[0].box
    await page.touchscreen.tap(c.l + c.w / 2, c.t + c.h / 2)
    await j.advance(300)
    expect((await geo(page)).film, "a tap on the glyph brings the film back").not.toBeNull()
  })
})
