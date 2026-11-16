import { expect, test, type Page } from "@playwright/test"
import { journey } from "../dsl"

/**
 * THE ROUND'S END (v1.280.3, STAR1). The owner, 15 Nov, on the preview:
 *   "the restarting is often hidden behind the article sections (which should be hidden when restarting happens!)"
 *   "when i click a node in the graph, it seems like it always zooms me out instead of zooming me in and panning - this is a
 *    regression - it used to be working well. ah nvm it is working well, maybe it stops working well after restarting.."
 *
 * WHAT WAS WRONG, measured on v1.280.0 by real mouse and touch (the archive's v1.280.3 entry):
 *  - `endRound` takes the hand (`clearOptions`) and the reader re-lays out with the article jumped up by its height (1440x900:
 *    its top 654 -> 432; 390x631: 768 -> 296), straight over the centre: 1 of 5 points of "You finished it" showing at 1440,
 *    0 of 5 at 390, and the same for the next roll's "Restarting the roll". A wheel or a swipe over that article paused the
 *    clock as reading, so the two stayed on top of each other.
 *  - a node pressed while the verdict or "New roll in Ns…" is up ran `clearTimers()` (`rollFromPosition`), which killed the
 *    restart timer, the only lifter of `endZoom`: every later frame aimed at the round's wide end framing (x1.4 to x1.5 wider,
 *    the pressed orb 3 px across), and the countdown line stayed up with no roll coming. A background tap (free roam) left the
 *    verdict up as well. The same on v1.279.0 and v1.273.1.
 *
 * THE RULE (the owner's sentence, ruled STAR1-GO): while the round's end is on screen the article's sections are not shown, and
 * the notice is never under anything; the end of the round lives exactly as long as its timer, so whatever clears the timer ends
 * the wide framing, the verdict and the countdown line together.
 *
 * THE CLAIMS, at 1440x900 by mouse and 390x631 by touch:
 *  1. Through the whole hold (the verdict, the countdown, the gap between them) and into the next roll's opening words
 *     ("Restarting the roll", then the new position's name), every sampled point of the notice's real text is the notice's own
 *     (`elementFromPoint`, its pointer-events lifted for the read: it is `pointer-events:none`); until the new roll's reveal the
 *     article's computed visibility is hidden and no sampled point of its box is the article's. A wheel (1440) or a swipe (390)
 *     where the article was does not pause the clock: the new roll starts on time. The reader comes back with the new roll, at the
 *     scroll position it had when the round ended.
 *  2. A node pressed while the verdict is up, and while the countdown is up: the press stages it and it is framed CLOSE (its drawn
 *     radius at least doubles, its centre on the screen, still so 4 s later); the verdict and the countdown line are gone; the
 *     reader is back where it was.
 *  3. A background tap while the verdict is up (free roam): the verdict and the countdown line are gone with the round.
 *  4. Reduced motion (no breath out to hand the board to): the board comes back when the new roll starts, and its "Restarting the
 *     roll" is over it, never under (the notice's z 7 in the wrap).
 * Every press is a player's: a mouse click or a touch tap at the point the app's own picker gives (`_updateHover`) and
 * `elementFromPoint` gives to the canvas; the swipe is CDP touch events. The round is ended through its seam (`endRound`, as
 * pane-law.spec.ts does): the claims are about what the screen does during its hold. HARNESS: frames and timers move only with
 * `j.advance`; CSS transitions run on the wall clock, so a part counts as shown by its own inline opacity target.
 * Red-proof at the foot.
 */

type W = any
type J = ReturnType<typeof journey>
const READY = '[data-reader][data-reader-ready="true"]'

/** Is every sampled point of the round's notice text its own? Read with the notice's pointer-events lifted (it is
 *  `pointer-events:none`, so elementFromPoint never returns it), one host at a time, restored before returning. */
const noticeOnTop = (page: Page) => page.evaluate(() => {
  const a = (window as W).__neural, out = { checked: 0, under: [] as string[], texts: [] as string[] }
  for (const [host, parts] of [[a.evRef.current, [a.evKickerRef.current, a.evTextRef.current]], [a.evCenterRef.current, [a.evcKickerRef.current, a.evcTextRef.current, a.evcSubRef.current]]] as [HTMLElement, HTMLElement[]][]) {
    if (!host || host.style.opacity === "0" || getComputedStyle(host).display === "none") continue
    const all = [host, ...host.querySelectorAll<HTMLElement>("*")], was = all.map((e) => e.style.pointerEvents)
    all.forEach((e) => { e.style.pointerEvents = "auto" })
    try {
      for (const el of parts) {
        const text = (el?.textContent || "").trim(); if (!text || el.style.opacity === "0") continue
        out.texts.push(text)
        const rg = document.createRange(); rg.selectNodeContents(el)
        for (const r of [...rg.getClientRects()].filter((r) => r.width > 2 && r.height > 2)) for (const f of [0.1, 0.3, 0.5, 0.7, 0.9]) {
          const x = r.left + r.width * f, y = r.top + r.height / 2
          if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue
          out.checked++
          const top = document.elementFromPoint(x, y) as HTMLElement | null
          if (!top || !host.contains(top)) out.under.push(`"${text}" at ${Math.round(x)},${Math.round(y)} under ${top ? top.tagName.toLowerCase() + "." + String(top.className).split(" ")[0] : "nothing"}`)
        }
      }
    } finally { all.forEach((e, i) => { e.style.pointerEvents = was[i] }) }
  }
  return out
})

/** The article as the screen has it: computed visibility, how many sampled points of its on-screen box are its own, and where
 *  the reader stands (its scroll position); and its index (the wrap's own child, outside the reader: on screen from about
 *  1,350 px of free width), the same way. */
const articleOf = (page: Page) => page.evaluate(() => {
  const a = (window as W).__neural, art = a._reader?.articleEl as HTMLElement | undefined, sec = a._readerEl as HTMLElement | undefined
  const toc = a._readerTocEl as HTMLElement | null, tr = toc?.isConnected && !toc.hidden && getComputedStyle(toc).display !== "none" ? toc.getBoundingClientRect() : null
  let tocOwned = 0
  if (tr && tr.width > 0 && tr.height > 0) for (const fy of [0.1, 0.3, 0.5, 0.7]) { const e = document.elementFromPoint(tr.left + tr.width * 0.3, tr.top + Math.min(tr.height, innerHeight - tr.top) * fy); if (e && toc!.contains(e)) tocOwned++ }
  const index = { vis: toc ? getComputedStyle(toc).visibility : "none", owned: tocOwned, box: tr && tr.width > 0 ? [tr.left, tr.top, tr.right, Math.min(tr.bottom, innerHeight)].map(Math.round) : null }
  if (!art?.isConnected) return { vis: "none", owned: 0, box: null as null | number[], scroll: null as null | number, index }
  const r = art.getBoundingClientRect(), l = Math.max(0, r.left), t = Math.max(0, r.top), rr = Math.min(innerWidth, r.right), b = Math.min(innerHeight, r.bottom)
  let owned = 0
  if (rr > l && b > t) for (const fx of [0.2, 0.5, 0.8]) for (const fy of [0.2, 0.5, 0.8]) {
    const e = document.elementFromPoint(l + (rr - l) * fx, t + (b - t) * fy); if (e && art.contains(e)) owned++
  }
  return { vis: getComputedStyle(art).visibility, owned, box: rr > l && b > t ? [l, t, rr, b].map(Math.round) : null, scroll: sec ? Math.round(sec.scrollTop) : null, index }
})
/** How many of the round-end centre's text lines meet the article's on-screen box while the article shows (0: clear of it). */
const verdictOverArticle = (page: Page) => page.evaluate(() => {
  const a = (window as W).__neural, art = a._reader?.articleEl as HTMLElement | undefined, box = a.evCenterRef.current as HTMLElement
  if (!art?.isConnected || getComputedStyle(art).visibility !== "visible" || box.style.opacity === "0") return { lines: 0, meets: 0 }
  const ar = art.getBoundingClientRect(); let lines = 0, meets = 0
  for (const el of [a.evcKickerRef.current, a.evcTextRef.current, a.evcSubRef.current] as HTMLElement[]) {
    const rg = document.createRange(); rg.selectNodeContents(el)
    for (const r of rg.getClientRects()) { if (r.width < 2 || r.height < 2) continue; lines++; if (r.left < ar.right && r.right > ar.left && r.top < ar.bottom && r.bottom > ar.top) meets++ }
  }
  return { lines, meets }
})
const state = (page: Page) => page.evaluate(() => {
  const a = (window as W).__neural
  return { paused: !!a.paused, rolls: a._rollsBegun || 0, landed: (a.optionIdxs || []).length > 0 && a._arriveGlideUntil == null,
    countdown: a.evRef.current.style.opacity !== "0" && /New roll in/.test(a.evTextRef.current.textContent || ""),
    verdict: a.evCenterRef.current.style.opacity !== "0" && /You finished it/.test(a.evcTextRef.current.textContent || ""),
    board: a.wrapRef.current.dataset.ngOpen || null, graphW: a.graphW, vw: a.cam.vw }
})

async function landed(page: Page, j: J) {
  await j.boot("/")
  await j.land("Mount Top")
  await expect(page.locator(READY)).toBeVisible({ timeout: 15000 })
  await j.advance(600); await j.readerLayoutSettled(); await j.advance(100)
  if (await page.locator("[data-reward-close]").isVisible()) { await j.clickByMouse("[data-reward-close]", "dismiss the earned patch"); await j.advance(300) }
  await page.evaluate(() => document.body.getBoundingClientRect().top)
}
const sim = (page: Page) => page.evaluate(() => (window as W).__neural.now * 1000)
/** Pump the game clock to `ms` after the round ended (`t0`, game-clock ms), then force layout before any read. */
const at = async (j: J, page: Page, t0: number, ms: number) => {
  const now = await sim(page)
  if (t0 + ms > now) await j.advance(Math.round(t0 + ms - now))
  await page.evaluate(() => document.body.getBoundingClientRect().top)
}
const endRound = (page: Page) => page.evaluate(() => { const a = (window as W).__neural; a.endRound("win", "Armbar"); return a.now * 1000 })
/** A finger dragged up the screen from (x, y): CDP touch events, as a phone sends them. */
async function swipe(page: Page, x: number, y: number) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] })
  for (let k = 1; k <= 6; k++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y - k * 25 }] })
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
  await cdp.detach()
}
/** The nearest position orb to the seat that the app's own picker gives at its drawn point, and the canvas owns. */
const nearOrb = (page: Page) => page.evaluate(() => {
  const a = (window as W).__neural, rect = a.canvas.getBoundingClientRect(), s = a.W / a.cam.vw, LY = a._LY || ((n: W) => n.y), was = a._hover
  const P = (n: W) => ({ x: rect.left + a.W / 2 + (n.x - a.cam.cx) * s, y: rect.top + a.H / 2 + (LY(n) - a.cam.cy) * s })
  const seat = a.nodes[a.currentPos], c = P(seat)
  const pool = a.nodes.filter((n: W) => n.ty === "positions" && n.rep !== false && n.pairId !== seat.pairId && a.rsAllows(n))
    .map((n: W) => ({ n, p: P(n) })).filter((q: W) => q.p.x > 20 && q.p.y > 20 && q.p.x < innerWidth - 20 && q.p.y < innerHeight - 20)
    .sort((u: W, w: W) => Math.hypot(u.p.x - c.x, u.p.y - c.y) - Math.hypot(w.p.x - c.x, w.p.y - c.y))
  try {
    for (const q of pool) {
      a._hover = null; a._updateHover({ type: "pointerup", clientX: q.p.x, clientY: q.p.y })
      if (a._hover?.idx === q.n.idx && document.elementFromPoint(q.p.x, q.p.y) === a.canvas) return { idx: q.n.idx, t: q.n.t, x: q.p.x, y: q.p.y, r: q.n.r * s, offered: pool.length }
    }
  } finally { a._hover = was }
  return { idx: -1, t: "", x: 0, y: 0, r: 0, offered: pool.length }
})
/** A bare point of the map: the canvas owns it, and the app's picker finds no orb there. */
const barePoint = (page: Page) => page.evaluate(() => {
  const a = (window as W).__neural, was = a._hover
  try {
    for (let fy = 0.3; fy <= 0.75; fy += 0.05) for (let fx = 0.15; fx <= 0.85; fx += 0.05) {
      const x = innerWidth * fx, y = innerHeight * fy
      if (document.elementFromPoint(x, y) !== a.canvas) continue
      a._hover = null; a._updateHover({ type: "pointerup", clientX: x, clientY: y })
      if (!a._hover || a._hover.idx < 0) return { x, y }
    }
  } finally { a._hover = was }
  return null
})
const framed = (page: Page, idx: number) => page.evaluate((idx) => {
  const a = (window as W).__neural, n = a.nodes[idx], s = a.W / a.cam.vw, LY = a._LY || ((n: W) => n.y)
  return { focus: a.focusIdx, r: n.r * s, x: a.W / 2 + (n.x - a.cam.cx) * s, y: a.H / 2 + (LY(n) - a.cam.cy) * s, W: a.W, H: a.H }
}, idx)

const VIEWS = [
  { name: "1440x900 mouse", viewport: { width: 1440, height: 900 }, touch: false },
  { name: "390x631 touch", viewport: { width: 390, height: 631 }, touch: true },
]
// the samples through the hold (endRound's win: verdict to 6.6 s, "New roll in 3s/2s/1s" at 3.6/4.6/5.6 s, the new roll at
// 7.4 s with "Restarting the roll" alone for NG_ARRIVE_KICKER, then the reveal and the new position's name)
const HOLD = [[300, "the verdict"], [2500, "the verdict"], [3900, "the countdown, 3s"], [5000, "the countdown, 2s"], [6000, "the countdown, 1s"],
  [7000, "the countdown alone"], [7700, "Restarting the roll"], [8800, "Restarting the roll"]] as const

for (const v of VIEWS) test.describe(v.name, () => {
  test.use({ viewport: v.viewport, hasTouch: v.touch })

  test("the round's notice is its own through the hold, the article put away, a wheel or swipe never pauses, the reader comes back where it was", async ({ page }) => {
    const j = journey(page)
    await landed(page, j)
    const before = await articleOf(page)
    if (!v.touch) expect(before.index.owned, "the index is on screen before the round ends (1440)").toBeGreaterThan(0)
    const t0 = await endRound(page)
    let reached = 0
    for (const [ms, what] of HOLD) {
      await at(j, page, t0, ms)
      const n = await noticeOnTop(page)
      expect(n.checked, `${what} (+${ms} ms): the notice has text on screen (${n.texts.join(" / ")})`).toBeGreaterThan(0)
      expect(n.under, `${what} (+${ms} ms): every sampled point of the notice is its own`).toEqual([])
      const art = await articleOf(page)
      expect(art.vis, `${what} (+${ms} ms): the article is put away, not faded`).toBe("hidden")
      expect(art.owned, `${what} (+${ms} ms): no sampled point of the article's box is the article's`).toBe(0)
      expect(art.index.owned, `${what} (+${ms} ms): no sampled point of the index's box is the index's`).toBe(0)
      if (ms === 3900 && art.box) {
        // where the article was: a wheel (mouse) or a swipe (touch) reaches the map, never the reader, so the clock runs on
        const x = (art.box[0] + art.box[2]) / 2, y = (art.box[1] + art.box[3]) / 2
        if (v.touch) await swipe(page, x, Math.min(y + 75, v.viewport.height - 10))
        else { await page.mouse.move(x, y); await page.mouse.wheel(0, 240) }
        expect((await state(page)).paused, `a ${v.touch ? "swipe" : "wheel"} during the countdown does not pause the game`).toBe(false)
        if (!v.touch && before.index.box) {
          // ...and where the index was (it listens for the wheel itself, and reading pauses the game)
          await page.mouse.move((before.index.box[0] + before.index.box[2]) / 2, before.index.box[1] + 40)
          await page.mouse.wheel(0, 120)
          expect((await state(page)).paused, "a wheel where the index was does not pause the game").toBe(false)
        }
      }
      reached++
    }
    expect(reached).toBe(HOLD.length)
    expect((await state(page)).rolls, "the new roll started on time").toBeGreaterThanOrEqual(2)
    // into the new roll's opening words: the new position's name in the centre, never under the board rising with it
    let named = 0
    for (let k = 0; k < 12; k++) {
      await j.advance(250); await page.evaluate(() => document.body.getBoundingClientRect().top)
      const n = await noticeOnTop(page)
      expect(n.under, `the new roll's opening words (+${k * 250} ms after the samples): the notice's own`).toEqual([])
      if (n.checked) named++
    }
    expect(named, "the new roll's opening words were on screen at some sample").toBeGreaterThan(0)
    // the new roll lands: the reader is shown again, where it was
    await expect.poll(async () => { await j.advance(500); return (await state(page)).landed }, { timeout: 30000, message: "the new roll lands" }).toBe(true)
    await expect.poll(async () => { await j.advance(200); return (await articleOf(page)).vis }, { timeout: 15000, message: "the article is shown again" }).toBe("visible")
    expect((await state(page)).board, "the board's styling is over").toBe(null)
    expect((await articleOf(page)).scroll, "the reader's scroll position is the one it had when the round ended").toBe(before.scroll)
  })

  for (const [ms, phase] of [[700, "the verdict"], [4300, "the countdown"]] as const) {
    test(`a node pressed while ${phase} is up is framed close, and the round's end is over`, async ({ page }) => {
      const j = journey(page)
      await landed(page, j)
      const before = await articleOf(page)
      const t0 = await endRound(page)
      await at(j, page, t0, ms)
      const s0 = await state(page)
      expect(phase === "the verdict" ? s0.verdict : s0.countdown, `${phase} is up when the node is pressed`).toBe(true)
      const hit = await nearOrb(page)
      expect(hit.idx, `a pressable position orb near the seat (${hit.offered} on screen)`).toBeGreaterThanOrEqual(0)
      if (v.touch) await page.touchscreen.tap(hit.x, hit.y); else await page.mouse.click(hit.x, hit.y)
      await j.advance(3000); await page.evaluate(() => document.body.getBoundingClientRect().top)
      const f1 = await framed(page, hit.idx), s1 = await state(page)
      expect(f1.focus, `the press staged ${hit.t}`).toBe(hit.idx)
      expect(f1.r, `${hit.t} is framed close: its drawn radius ${f1.r.toFixed(1)} px against ${hit.r.toFixed(1)} px at the press`).toBeGreaterThan(hit.r * 2)
      expect(f1.x > 0 && f1.x < f1.W && f1.y > 0 && f1.y < f1.H, `${hit.t}'s centre is on the screen (${f1.x.toFixed(0)}, ${f1.y.toFixed(0)})`).toBe(true)
      expect(s1.verdict, "the verdict is gone").toBe(false)
      expect(s1.countdown, "no countdown line: no roll is coming").toBe(false)
      await expect.poll(async () => { await j.advance(50); return (await articleOf(page)).vis }, { message: "the reader is given back" }).toBe("visible")
      expect((await articleOf(page)).scroll, "the reader is where it was").toBe(before.scroll)
      await j.advance(4000)
      const f2 = await framed(page, hit.idx)
      expect(f2.r, `${hit.t} stays framed close (${f2.r.toFixed(1)} px)`).toBeGreaterThan(f1.r * 0.8)
      expect((await state(page)).rolls, "no roll restarted behind the staged board").toBe(s0.rolls)
    })
  }

  test("a background tap while the verdict is up ends the round's end: no verdict, no countdown line", async ({ page }) => {
    const j = journey(page)
    await landed(page, j)
    const t0 = await endRound(page)
    await at(j, page, t0, 700)
    expect((await state(page)).verdict, "the verdict is up").toBe(true)
    const p = await barePoint(page)
    expect(p, "a bare point of the map to tap").not.toBeNull()
    if (v.touch) await page.touchscreen.tap(p!.x, p!.y); else await page.mouse.click(p!.x, p!.y)
    await j.advance(300)
    expect(await page.evaluate(() => !!(window as W).__neural._roam), "the tap roamed").toBe(true)
    for (const ms of [1000, 5000]) {
      await j.advance(ms === 1000 ? 700 : 4000)
      const s = await state(page)
      expect(s.verdict, `the verdict is gone (+${ms} ms)`).toBe(false)
      expect(s.countdown, `no countdown line (+${ms} ms)`).toBe(false)
    }
    expect((await state(page)).rolls, "free roam holds: no roll restarts").toBe(1)
  })

  test("reduced motion: the board comes back when the new roll starts, under its Restarting the roll", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    const j = journey(page)
    await landed(page, j)
    const t0 = await endRound(page)
    for (const [ms, what] of HOLD.slice(0, 6)) {
      await at(j, page, t0, ms)
      expect((await noticeOnTop(page)).under, `${what}: the notice's own`).toEqual([])
      expect((await articleOf(page)).vis, `${what}: the article put away`).toBe("hidden")
    }
    await at(j, page, t0, 7700)
    await expect.poll(async () => (await articleOf(page)).vis, { message: "back when the new roll starts" }).toBe("visible")
    const n = await noticeOnTop(page)
    expect(n.texts.join(" "), "the next roll's heading is up").toMatch(/Restarting the roll/)
    expect(n.under, "every sampled point of the heading is its own, over the article").toEqual([])
  })
})

// STAR1-Q1 (ruled 16 Nov): "the article is never hidden unless something is on its way that will bring it back". The board
// is away only while the round's end has a live timer (its timers stop only with the clock, `pauseTimers`); a pause during the
// hold gives it back at once, with the verdict docked in the map's band above the reader, clear of the article.
for (const v of VIEWS) test.describe(v.name + ", the clock held during the round's end", () => {
  test.use({ viewport: v.viewport, hasTouch: v.touch })
  const press = async (page: Page, j: J, sel: string, what: string) => {
    if (!v.touch) { await j.clickByMouse(sel, what); return }
    const b = await j.boxOf(sel, what); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2)
  }

  test("the drawer opened while the verdict is up gives the article back at once, the verdict clear of it; closed, the board goes until the new roll", async ({ page }) => {
    const j = journey(page)
    await landed(page, j)
    const t0 = await endRound(page)
    await at(j, page, t0, 700)
    expect((await articleOf(page)).vis, "the round's end: the article put away").toBe("hidden")
    await press(page, j, ".ng-logo", "open the drawer")
    await j.advance(300); await page.evaluate(() => document.body.getBoundingClientRect().top)
    const s1 = await state(page)
    expect(s1.paused, "the drawer holds the clock (the pane law)").toBe(true)
    expect(s1.verdict, "the verdict is still up").toBe(true)
    expect((await articleOf(page)).vis, "nothing is on its way: the article is back").toBe("visible")
    expect(s1.board, "the board's styling is over").toBe(null)
    await j.advance(3000); await page.evaluate(() => document.body.getBoundingClientRect().top)
    expect((await state(page)).rolls, "no roll restarts while the clock is held").toBe(1)
    if (!v.touch) {   // at 1440 the map stays beside the drawer: the verdict is over it and clear of the article
      expect((await noticeOnTop(page)).under, "the verdict's points are its own").toEqual([])
      const o = await verdictOverArticle(page)
      expect(o.lines, "the verdict has lines on screen").toBeGreaterThan(0)
      expect(o.meets, "no line of the verdict meets the article").toBe(0)
    }
    await press(page, j, ".ng-explorer-close", "close the drawer")
    await j.advance(300); await page.evaluate(() => document.body.getBoundingClientRect().top)
    expect((await state(page)).paused, "closing the drawer gives the clock back").toBe(false)
    expect((await articleOf(page)).vis, "the timer runs again: the board is away").toBe("hidden")
    expect((await noticeOnTop(page)).under, "the verdict's points are its own").toEqual([])
    await expect.poll(async () => { await j.advance(500); const s = await state(page); return s.landed && s.rolls >= 2 }, { timeout: 30000, message: "the new roll lands" }).toBe(true)
    await expect.poll(async () => { await j.advance(200); return (await articleOf(page)).vis }, { message: "the article is back with the new roll" }).toBe("visible")
  })

  test("a round ended with the clock held (the seam, as on a board staged by a URL): the article stays, the verdict above it in the map's band", async ({ page }) => {
    const j = journey(page)
    await landed(page, j)
    // Not reachable by a player's press (a fresh visitor's first press releases the clock, measured on all five page types):
    // the seam is held to the rule anyway, since the ruling is about the state, not about how it is reached
    await page.evaluate(() => { const a = (window as W).__neural; a.setPaused(true); a.endRound("win", "Armbar") })
    for (const ms of [100, 1500, 5000]) {
      await j.advance(ms === 100 ? 100 : ms - 100); await page.evaluate(() => document.body.getBoundingClientRect().top)
      const s = await state(page), art = await articleOf(page), o = await verdictOverArticle(page)
      expect(s.verdict, `+${ms} ms: the verdict is up`).toBe(true)
      expect(art.vis, `+${ms} ms: nothing is on its way, so the article stays`).toBe("visible")
      expect(s.board, `+${ms} ms: the board is not put away`).toBe(null)
      expect((await noticeOnTop(page)).under, `+${ms} ms: the verdict's points are its own`).toEqual([])
      expect(o.lines, `+${ms} ms: the verdict has lines on screen`).toBeGreaterThan(0)
      expect(o.meets, `+${ms} ms: no line of the verdict meets the article`).toBe(0)
    }
  })

  test("an earned patch on screen through the hold covers no part of the notice, and the article comes back with the new roll", async ({ page }) => {
    const j = journey(page)
    await j.boot("/")
    await j.land("Mount Top")
    await expect(page.locator(READY)).toBeVisible({ timeout: 15000 })
    await j.advance(600); await j.readerLayoutSettled(); await j.advance(100)
    // the harness pre-completes the White track, so this landing mints a patch (seat-star.spec.ts says so too): kept up here
    await expect(page.locator("[data-reward]"), "an earned patch is on screen").toBeVisible()
    const t0 = await endRound(page)
    for (const ms of [300, 1500, 3000]) {
      await at(j, page, t0, ms)
      expect((await noticeOnTop(page)).under, `+${ms} ms: the notice's points are its own`).toEqual([])
    }
    await expect.poll(async () => { await j.advance(500); const s = await state(page); return s.landed && s.rolls >= 2 }, { timeout: 30000, message: "the new roll lands" }).toBe(true)
    await expect.poll(async () => { await j.advance(200); return (await articleOf(page)).vis }, { message: "the article is back with the new roll" }).toBe("visible")
  })
})

// RED-PROOF (v1.280.3, each one replacement in app.src.jsx or xdc-template.html, rebuilt, the named tests run, the source
// restored and rebuilt after):
//  M2a  `clearTimers` keeps `endZoom` (the wide framing kept): red at all four "a node pressed while ... is framed close"
//       (the radius 2.9 px against 13.1 at the press, 1440, the verdict; 0.8 px at 390)
//  M2b  `clearTimers` keeps the verdict: red at both "a background tap while the verdict is up" ("the verdict is gone"); a
//       node press hides the verdict itself (`rollFromPosition`), so only the tap can kill it
//  M2c  `clearTimers` keeps the countdown line: red at both "a node pressed while the countdown is up" ("no countdown line")
//  M3a  `endRound` leaves the board in place: red at both "the round's notice is its own" ("the article is put away", +300 ms)
//  M3b  faint does not hide the reader: red at the same, at the same line
//  M3f  faint hides the reader but not its index: red at "1440x900 mouse › the round's notice is its own" ("no sampled point
//       of the index's box is the index's")
//  M3c  the centre without its z 7: red at both "reduced motion" (1440: the heading under the article's section titles; 390:
//       "You finished it" under the seat's star, z 3)
//  M3d  no release under reduced motion: red at both "reduced motion" ("back when the new roll starts")
//  NON-KILL, named: M3e, the announcer without its z 7. While the board is away nothing ambient reaches its top band, so no
//  test here sees it; the z is kept for the ladder's rule (the notice is never under anything ambient).
// On dev's own bundle (v1.280.0, 87d1e17ee): all ten tests red, each for the reason its claim names.
