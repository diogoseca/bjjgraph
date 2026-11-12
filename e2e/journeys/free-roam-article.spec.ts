import { expect, test, type Page } from "@playwright/test"
import { journey } from "../dsl"

/**
 * U123 (owner, 2026-11-10, on the map's key): "also, in free roam there wouldn't be any article to show, nor ToC. there's no
 * conflicting space with the ToC / index, but it's already shown once and we like keeping it elegant". Free roam kept the last
 * node's article and its index on screen (U114 a had retired the control that put them away); on 2026-11-11: "take care of it".
 *
 * THE WAYS INTO FREE ROAM (surveyed on v1.256.2: `_enterRoam` has one caller, `_tapBackground`): two taps on bare map (the first
 * closes the card and keeps the hand, the second roams), or one tap once the card is closed by its own ✕. Ending a roll does not
 * roam (a new roll follows its countdown); the drawer, Esc and a URL never do (a node's URL stages it, "/" deals a roll, and a
 * Principle, Learning entry or System is a page, which `_leaveRollForReference` keeps out of free roam).
 *
 * THE CLAIMS, at 390x844 and 1440x900, by mouse and by touch:
 *  1. In free roam the article and its index are off the screen, each way in: the article's computed visibility is hidden, the
 *     index has no box (at 390 it never has one), no sampled point of their last boxes is theirs (elementFromPoint), and a real
 *     press on bare map inside the article's last box reaches nothing of the reader. Never opacity: hidden, not faded.
 *  2. The map's key follows its rule (`_mapAlone`): with nothing of a node on screen, free roam is the map alone, so it shows.
 *  3. Landing again brings them back. On the node free roam left: the same article, not rendered again, and not sent back to its
 *     top; at 1440 the index too. Entering free roam itself moves nothing: the reader's scroll is the same before and after.
 *  4. An article opened on purpose from free roam shows: a Principle's row in the drawer.
 *  5. A page stays: on a Principle opened by its URL, the background tap leaves its article and its index on screen.
 * Every press is a player's: `j.clickByMouse` or a touch tap at a measured point that elementFromPoint gives to the target.
 * Points on the map come from the app's own picker (`_updateHover`, which the tap uses), never from constants.
 * HARNESS: frames move only with `j.advance`; the DSL serves `{}` dossiers, so there is no film (free roam clears it anyway).
 * The reading place is set by writing the reader's scrollTop (state, not the claim); the claim is what free roam does to it.
 * Red-proof at the foot.
 */

type W = any
type Box = { left: number; top: number; right: number; bottom: number }
const READY = '[data-reader][data-reader-ready="true"]'
const frame = async (j: ReturnType<typeof journey>) => { await j.advance(50) }
const settle = async (j: ReturnType<typeof journey>) => { await frame(j); await j.readerLayoutSettled(); await frame(j) }

/** The reader as the screen has it: on-screen boxes, computed visibility, scroll, and who owns the sampled points of `old` boxes. */
const screenOf = (page: Page, old: { article?: Box | null; index?: Box | null } = {}) => page.evaluate((old) => {
  const a = (window as W).__neural, r = a._reader, toc = a._readerTocEl as HTMLElement | null
  const onScreen = (el: HTMLElement | null) => {
    if (!el?.isConnected) return null
    const b = el.getBoundingClientRect()
    const v = { left: Math.max(0, b.left), top: Math.max(0, b.top), right: Math.min(innerWidth, b.right), bottom: Math.min(innerHeight, b.bottom) }
    return v.right - v.left > 1 && v.bottom - v.top > 1 ? v : null
  }
  // Of a 6x6 grid over a box, the points whose topmost element is the reader's or its index's.
  const owned = (b: Box | null | undefined) => {
    if (!b) return null
    let points = 0, theirs = 0
    for (let i = 0; i < 6; i++) for (let k = 0; k < 6; k++) {
      const e = document.elementFromPoint(b.left + (b.right - b.left) * (i + .5) / 6, b.top + (b.bottom - b.top) * (k + .5) / 6)
      points++; if (e && (r.root.contains(e) || toc?.contains(e))) theirs++
    }
    return { points, theirs }
  }
  const article = onScreen(r.articleEl), index = toc && !toc.hidden ? onScreen(toc) : null
  return {
    path: r.path as string, roam: !!a._roam, landed: a._landIdx != null, scroll: r.root.scrollTop as number,
    articleVisibility: getComputedStyle(r.articleEl).visibility, article, index,
    marked: !!document.querySelector("[data-reader-body][data-free-roam-mark]"),
    oldArticle: owned(old.article), oldIndex: owned(old.index),
    key: getComputedStyle(a.legendRef.current).visibility + " " + getComputedStyle(a.legendRef.current).opacity,
  }
}, old)

/** A point of bare map, inside `within` if given: the canvas owns it AND the app's own picker finds no node there. */
const bareMap = (page: Page, within?: Box | null) => page.evaluate((b) => {
  const a = (window as W).__neural, was = a._hover, box = b || { left: 8, top: 8, right: innerWidth - 8, bottom: innerHeight - 8 }
  try {
    for (let y = box.top + 6; y < box.bottom - 6; y += 23) for (let x = box.right - 6; x > box.left + 6; x -= 29) {
      if (document.elementFromPoint(x, y)?.tagName !== "CANVAS") continue
      a._hover = null; a._updateHover({ type: "pointerup", clientX: x, clientY: y })
      if (!a._hover || a._hover.idx < 0) return [Math.round(x), Math.round(y)] as [number, number]
    }
    return null
  } finally { a._hover = was }
}, within || null)

/** The point where node `idx` is drawn (through the frame's own lift, `_LY`), checked against the app's picker and the canvas. */
const nodePoint = (page: Page, idx: number) => page.evaluate((idx) => {
  const a = (window as W).__neural, n = a.nodes[idx], rect = a.canvas.getBoundingClientRect(), s = a.W / a.cam.vw, was = a._hover
  const x = rect.left + a.W / 2 + (n.x - a.cam.cx) * s, y = rect.top + a.H / 2 + ((a._LY ? a._LY(n) : n.y) - a.cam.cy) * s
  try {
    a._hover = null; a._updateHover({ type: "pointerup", clientX: x, clientY: y })
    const picked = a._hover?.idx, top = document.elementFromPoint(x, y)?.tagName
    return { x: Math.round(x), y: Math.round(y), ok: picked === idx && top === "CANVAS", picked, top }
  } finally { a._hover = was }
}, idx)

/** A press as a player makes it: the mouse at the measured centre (clickByMouse), or a touch tap there, refused if not the target's. */
async function press(page: Page, j: ReturnType<typeof journey>, touch: boolean, selector: string, what: string) {
  if (!touch) { await j.clickByMouse(selector, what); return }
  const at = await page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement | null, r = el?.getBoundingClientRect()
    if (!el || !r || r.width < 1 || r.height < 1) return null
    const x = r.left + r.width / 2, y = r.top + r.height / 2, top = document.elementFromPoint(x, y)
    return { x, y, ok: x >= 0 && y >= 0 && x <= innerWidth && y <= innerHeight && !!top && (top === el || el.contains(top)) }
  }, selector)
  expect(at?.ok, `${what} is reachable by touch where it sits`).toBe(true)
  await page.touchscreen.tap(at!.x, at!.y)
}
const tap = async (page: Page, touch: boolean, at: [number, number]) => { if (touch) await page.touchscreen.tap(...at); else await page.mouse.click(...at) }

/** Land again on the node free roam left, by pressing its orb where the camera drew it. */
async function landAgain(page: Page, j: ReturnType<typeof journey>, touch: boolean) {
  await j.advance(2500)   // the roam's pull-back flight settles
  const idx = await page.evaluate(() => (window as W).__neural.currentPos)
  const at = await nodePoint(page, idx)
  expect(at.ok, `premise: the node free roam left is drawn on the map and pressable there ${JSON.stringify(at)}`).toBe(true)
  await tap(page, touch, [at.x, at.y])
  await expect.poll(async () => { await frame(j); const s = await screenOf(page); return s.landed && !s.roam }, { message: "premise: the press lands on the node" }).toBe(true)
  await expect.poll(async () => { await frame(j); return (await screenOf(page)).articleVisibility }, { message: "landing again: the article returns" }).toBe("visible")
  await settle(j)
}

/** Free roam's screen, each way in: claims 1 and 2. `before` is the screen just before the step that roamed. */
async function roamed(page: Page, j: ReturnType<typeof journey>, touch: boolean, before: Awaited<ReturnType<typeof screenOf>>, how: string, wide: boolean) {
  await settle(j)
  const s = await screenOf(page, { article: before.article, index: before.index })
  expect(s.roam, `premise: ${how} enters free roam`).toBe(true)
  expect(s.articleVisibility, `free roam: the article is not on screen (${how})`).toBe("hidden")
  expect(s.article && s.articleVisibility === "visible", "free roam: nothing of the article shows").toBeFalsy()
  expect(s.oldArticle!.theirs, `free roam: no point of the article's last box takes a press (${how}) ${JSON.stringify(s.oldArticle)}`).toBe(0)
  expect(s.index, `free roam: the index is not on screen (${how})`).toBeNull()
  if (wide) expect(s.oldIndex!.theirs, `free roam: no point of the index's last box takes a press (${how}) ${JSON.stringify(s.oldIndex)}`).toBe(0)
  expect(s.scroll, `free roam moves nothing: the reader's place is kept (${how})`).toBe(before.scroll)
  expect(s.path, `free roam puts the article away, not cleared: the reader still holds it (${how})`).toBe(before.path)
  // A real press where the article was, on a point that is bare map now: it reaches nothing of the reader, and changes nothing.
  const at = await bareMap(page, before.article)
  expect(at, "premise: bare map where the article was").not.toBeNull()
  await page.evaluate(() => { const w = window as W; w.__readerClicks = 0; document.addEventListener("click", e => { const a = w.__neural; if (a._reader.root.contains(e.target) || a._readerTocEl?.contains(e.target)) w.__readerClicks++ }, { capture: true }) })
  await tap(page, touch, at!)
  await settle(j)
  const after = await screenOf(page)
  expect({ clicks: await page.evaluate(() => (window as W).__readerClicks), roam: after.roam, visibility: after.articleVisibility },
    `free roam: a press where the article was reaches nothing of it (${how})`).toEqual({ clicks: 0, roam: true, visibility: "hidden" })
  await expect.poll(async () => { await frame(j); return (await screenOf(page)).key }, { message: `free roam is the map alone: the key shows (${how})` }).toBe("visible 1")
}

for (const [width, height, touch] of [[390, 844, false], [390, 844, true], [1440, 900, false], [1440, 900, true]] as [number, number, boolean][]) {
  const wide = width >= 1440, by = touch ? "touch" : "mouse"
  test.describe(`${width}x${height}, by ${by}`, () => {
    test.use({ viewport: { width, height }, hasTouch: touch, isMobile: touch && !wide })
    test(`U123: free roam puts the article and its index away, each way in, and a landing or a page opened on purpose brings them back (${width}, by ${by})`, async ({ page }) => {
      const j = journey(page)
      await j.boot("/")
      await j.land("Mount Top")
      await expect(page.locator(READY)).toBeVisible()
      await settle(j)
      // A patch earned at this landing shows its notice at the top; put it away first, so no tap below lands on it.
      if (await page.evaluate(() => { const r = document.querySelector("[data-reward-close]")?.getBoundingClientRect(); return !!r && r.width > 0 })) {
        await press(page, j, touch, "[data-reward-close]", "the reward notice's close"); await j.advance(600); await settle(j)
      }
      // The reading place, deep in the article, and a mark on the rendered article: a second render would not carry it.
      await page.evaluate(() => { const r = (window as W).__neural._reader; r.root.scrollTop = 600; document.querySelector("[data-reader-body]")!.setAttribute("data-free-roam-mark", "") })
      await settle(j)
      const landed = await screenOf(page)
      expect(landed.articleVisibility === "visible" && !!landed.article && landed.marked, `premise: the node's article is on screen ${JSON.stringify(landed)}`).toBe(true)
      if (wide) expect(landed.index, "premise: at 1440 its index stands beside it").not.toBeNull()
      expect(landed.scroll, "premise: the reader is read into").toBeGreaterThan(100)

      // WAY 1: two taps on bare map. The first closes the card and is not free roam: the article stays.
      await j.advance(600)
      let at = await bareMap(page); expect(at, "premise: bare map").not.toBeNull()
      await tap(page, touch, at!)
      await settle(j)
      const first = await screenOf(page)
      expect({ roam: first.roam, article: first.articleVisibility }, "premise: the first tap closes the card, and the article stays").toEqual({ roam: false, article: "visible" })
      await j.advance(600)
      at = await bareMap(page); expect(at, "premise: bare map after the card closed").not.toBeNull()   // picked afresh: the article moved up
      await tap(page, touch, at!)
      await roamed(page, j, touch, first, "the second tap", wide)

      // Claim 3: land again on the node free roam left.
      await landAgain(page, j, touch)
      const back = await screenOf(page)
      expect({ path: back.path, visibility: back.articleVisibility, shown: !!back.article, marked: back.marked },
        "landing again: the same article returns, not rendered again").toEqual({ path: landed.path, visibility: "visible", shown: true, marked: true })
      expect(back.scroll, "landing again: the article is not sent back to its top").toBeGreaterThan(0)
      if (wide) expect(back.index, "landing again: its index returns").not.toBeNull()
      await expect(page.locator(".ng-legendkey"), "a node landed: the key goes again").toBeHidden()

      // WAY 2: the card closed by its own ✕, then one tap on bare map. Back at the reader's top first: the place set above keeps
      // the card scrolled out of view, and a player scrolls up to reach its ✕ (state, not the claim).
      await page.evaluate(() => { (window as W).__neural._reader.root.scrollTop = 0 })
      await settle(j)
      await press(page, j, touch, "[data-land-close]", "the card's ✕")
      await settle(j)
      const closed = await screenOf(page)
      expect({ roam: closed.roam, article: closed.articleVisibility }, "premise: the ✕ closes the card, and the article stays").toEqual({ roam: false, article: "visible" })
      at = await bareMap(page); expect(at, "premise: bare map with the card closed").not.toBeNull()
      await tap(page, touch, at!)
      await roamed(page, j, touch, closed, "one tap after the card's ✕", wide)
      await landAgain(page, j, touch)
      expect((await screenOf(page)).articleVisibility, "landing again after the second way: the article returns").toBe("visible")

      // Claim 4: from free roam, an article opened on purpose shows (a Principle's row in the drawer).
      at = await bareMap(page); await tap(page, touch, at!); await settle(j)
      at = await bareMap(page); await tap(page, touch, at!); await settle(j)
      expect((await screenOf(page)).roam, "premise: free roam again").toBe(true)
      await press(page, j, touch, ".ng-logo", "the drawer button")
      // The drawer's home list is Explore (v1.242.0), open by default; its six categories start closed.
      await expect(page.locator("[data-drawer-explore]")).toBeVisible()
      if (await page.locator("[data-drawer-explore]").getAttribute("aria-expanded") !== "true") await press(page, j, touch, "[data-drawer-explore]", "the Explore row")
      await expect(page.locator('[data-explore-section="Principles"]')).toBeVisible()
      if (await page.locator('[data-explore-section="Principles"]').getAttribute("aria-expanded") !== "true") await press(page, j, touch, '[data-explore-section="Principles"]', "the Principles section")
      await page.locator('[data-concept-row="Principles/Base"]').scrollIntoViewIfNeeded()   // the drawer's own list scrolls; the press is below
      await press(page, j, touch, '[data-concept-row="Principles/Base"]', "the Base row")
      await expect(page.locator(READY)).toHaveAttribute("data-reader-path", "/Principles/Base")
      await settle(j)
      const opened = await screenOf(page)
      expect({ visibility: opened.articleVisibility, shown: !!opened.article }, "an article opened on purpose from free roam shows").toEqual({ visibility: "visible", shown: true })
      if (wide) expect(opened.index, "an article opened on purpose from free roam shows its index").not.toBeNull()
    })

    test(`U123: a page stays through the background tap (a Principle opened by its URL; ${width}, by ${by})`, async ({ page }) => {
      const j = journey(page)
      await j.boot("/Principles/Base")
      await expect(page.locator(READY)).toHaveAttribute("data-reader-path", "/Principles/Base")
      await settle(j)
      const start = await screenOf(page)
      expect(start.articleVisibility === "visible" && !!start.article, `premise: the page's article is on screen ${JSON.stringify(start)}`).toBe(true)
      if (wide) expect(start.index, "premise: at 1440 its index stands beside it").not.toBeNull()
      for (let i = 0; i < 2; i++) {
        await j.advance(600)
        const at = await bareMap(page); expect(at, "premise: bare map beside the page").not.toBeNull()
        await tap(page, touch, at!)
        await settle(j)
      }
      const after = await screenOf(page)
      expect({ path: after.path, visibility: after.articleVisibility, shown: !!after.article }, "a page stays: the background tap leaves its article on screen")
        .toEqual({ path: "/Principles/Base", visibility: "visible", shown: true })
      if (wide) expect(after.index, "a page stays: its index too").not.toBeNull()
    })
  })
}

// A late article: the first landing's article request waits on the reader module's first load (held here), and the player roams
// before it arrives. The ended landing's article must not appear on the map alone (open() meets free roam and keeps it away).
test.describe("1440x900, by mouse, a late article", () => {
  test.use({ viewport: { width: 1440, height: 900 } })
  test("U123: an article that arrives after free roam began stays away, and the next landing shows it (1440, by mouse)", async ({ page }) => {
    const j = journey(page)
    let release!: () => void
    const held = new Promise<void>(r => { release = r })
    await j.boot("/", { beforeNavigate: async () => { await page.route("**/static/neural/app/reader.js*", async route => { await held; await route.continue() }) } })
    await j.land("Mount Top")
    expect(await page.evaluate(() => !(window as W).__neural._reader), "premise: the reader module has not arrived").toBe(true)
    for (let i = 0; i < 2; i++) {
      await j.advance(600)
      const at = await bareMap(page); expect(at, "premise: bare map").not.toBeNull()
      await page.mouse.click(...at!)
    }
    expect(await page.evaluate(() => !!(window as W).__neural._roam), "premise: free roam, before the article arrived").toBe(true)
    release()
    await expect.poll(() => page.evaluate(() => { const r = (window as W).__neural._reader; return !!r && r.root.dataset.readerReady === "true" }), { message: "premise: the late article arrives" }).toBe(true)
    await settle(j)
    const late = await screenOf(page)
    expect({ visibility: late.articleVisibility, index: late.index }, "free roam: the article is not on screen (a late article)").toEqual({ visibility: "hidden", index: null })
    await landAgain(page, j, false)
    const back = await screenOf(page)
    expect({ visibility: back.articleVisibility, shown: !!back.article, index: !!back.index }, "landing again: the late article shows, with its index").toEqual({ visibility: "visible", shown: true, index: true })
  })
})

// Red-proof: tests/artifacts/free_roam_mutants.mjs, each control against a green baseline of the same spec and grep, killed only
// at its named claim (receipts in the PR and docs/Changelog-Archive.md).
// UNGUARDED: the backstop's lift in `_readerHold` (a landing that publishes is never hidden). Only a landing that asks the reader
// for no article after free roam reaches it, and every way back today asks first, so no journey here can tell it is gone.
