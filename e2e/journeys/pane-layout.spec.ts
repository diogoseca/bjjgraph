import { test, expect, type Page } from "@playwright/test"
import { journey, type Journey } from "../dsl"

/** Pane-aware gameplay and reading, measured through rendered boxes.
 * The DSL authors films but reads complete prose from published HTML. The article
 * uses native scrolling; it stays below Browse's plane and preserves its position.
 * Prior virtual-More/pause-transfer mutants were retired with that interaction.
 * Current MDP sandbox control m38 (2026-10-14) removes paused lift retention:
 * both widths fail the unchanged vertical-clearance assertion.
 * NOT the gate for D-347's rest lift since v1.237.0 (PR #320's review): reading-band-lift-restored no longer turns
 * line 131 red, because this journey's first landing is the directed arrival, which never flies and so never engages
 * the follow-cam's band lift. That claim is pinned at the source by tests/camera_motion.test.mjs ("in the reading
 * view the follow-cam engages no lift at rest"), which the same mutation turns red.
 * External video playback is not covered by the harness.
 * RECORDED NON-KILL (v1.251.3): pane-hold-keyed-on-scroll (the hold keyed on root.scrollTop, not placeTop) survives since heldAt became
 * the read-back (#348's review). At every clamp these journeys reach, the read-back is the clamped value, so root.scrollTop and heldAt
 * agree. They part only if the end shrinks again after a held write while the listener keeps placeTop past it, and no journey here
 * does that. Killed at the "the close lands on the place the open left" assertion before v1.251.3. */

async function settle(page: Page, j: Journey) {
  await j.advance(100)
  await page.waitForTimeout(450) // CSS transitions use wall time; the graph uses pumped frames.
  await j.advance(3500)
  await page.evaluate(() => document.body.getBoundingClientRect().top)
  await j.advance(3500)
}

async function setup(page: Page) {
  const j = journey(page)
  await j.boot("/")
  // This is a layout journey; keep the question window beyond the sampled pane
  // transitions so an unrelated expiry announcement does not reframe the camera.
  await page.evaluate(() => (window as any).__neural.set("decisionSec", 120))
  await j.land("Mount Top")
  await j.openQuestion() // U47 d: the deck pages (and the pane declines a live question) once the card is shown.
  await page.evaluate(() => {
    const w = window as any, a = w.__neural
    const key = a.deckKeyFor(a.nodes[a.currentPos]).key
    w.NG_CONTENT ||= {}; w.NG_CONTENT.decks ||= {}
    w.NG_CONTENT.decks[key] = {
      cat: "Position", role: "Top", lead: "Pane layout fixture: a stable connection.",
      principles: Array.from({ length: 18 }, (_, i) => `Reading principle ${i + 1}: maintain the connection while your partner changes direction. Keep your base and leave room to adjust.`),
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
  if (await page.locator("[data-reward-close]").isVisible()) await j.clickByMouse("[data-reward-close]")
  return j
}

async function openPane(page: Page, j: Journey) {
  await j.clickByMouse(".ng-logo", "the pane opener")
  await expect(page.locator(".ng-drill")).toBeVisible()
  await settle(page, j)
}

async function closePane(page: Page, j: Journey) {
  await j.clickByMouse(".ng-explorer-close", "the pane close button")
  await settle(page, j)
}

const geometry = (page: Page) => page.evaluate(() => {
  const a = (window as any).__neural
  const box = (selector: string) => {
    const el = document.querySelector(selector) as HTMLElement
    if (!el) throw new Error(`Missing required surface ${selector}`)
    const r = el.getBoundingClientRect()
    let opacity = 1
    for (let p: HTMLElement | null = el; p; p = p.parentElement) opacity *= Number(getComputedStyle(p).opacity)
    return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom,
      center: r.x + r.width / 2, visible: getComputedStyle(el).visibility === "visible" && opacity > .9 }
  }
  const n = a.nodes[a.currentPos], mid = a.pairMid(n), scale = a.W / a.cam.vw
  return {
    card: box("[data-landcard]"), film: box("[data-land-film]"), more: box(".ng-reader-article"), hand: box(".ng-optionrow"),
    layout: a._reader.game.dataset.mediaLayout,
    pane: box(".ng-drill"), nav: box("[data-land-nav]"),
    node: { id: n.id, x: a.W / 2 + (mid.x - a.cam.cx) * scale, y: a.H / 2 + (mid.y - a.cam.cy) * scale },
    zoom: a.cam.vw, paused: !!a.paused, read: a._readerEl?.scrollTop || 0, open: !!a._reader?.interacting,
    selected: a._landPage, answers: a._landAnswers ? Array.from(a._landAnswers.keys()) : [],
    backs: a._landStackEl?.childElementCount ?? 0,
  }
})

for (const width of [1440, 1024]) {
  test(`${width}px pane moves film, card, article and the projected current node together`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const j = await setup(page)
    await j.clickByMouse("[data-land-next]", "next flashcard before opening the pane")
    await settle(page, j)
    const before = await geometry(page)
    const question = await page.locator("[data-land-q]").innerText()
    expect(before.selected).toBe(1)

    await openPane(page, j)
    const open = await geometry(page)
    // STALE CONTRACT (D-368, layout C): the A geometry is back as the stage under Moves: the current card
    // sits beside the question (400 + 60 + 390), and where the pane leaves less than that it stacks above
    // it. So the A-era claims return (the film's 400px and the stacked reflow), with Moves above the stage.
    // STALE CONTRACT (D-368's stacked order): U52 b puts the question straight after Moves, so a stacked
    // reflow keeps the question under Moves and the current card follows the question's backs.
    const shift = open.card.x - before.card.x, reflow = open.layout !== before.layout
    // U104 and U110 a (owner, 2026-11-09): the columns begin at 1,024px free, and under that everything stacks in one 496px box.
    expect(before.layout, 'VIDEO1 the available width selects the desktop or stacked stage').toBe(width >= 1024 ? 'side-by-side' : 'stacked')
    if (!reflow) expect(shift).toBeGreaterThan(80)
    for (const surface of ["card", "film"] as const) {
      expect(open[surface].visible, `${surface} remains visible`).toBe(true)
      expect(open[surface].x).toBeGreaterThanOrEqual(open.pane.right)
      expect(open[surface].right).toBeLessThanOrEqual(width)
      if (!reflow) {
        // U104, U108 a (owner, 2026-11-09, replacing a fixed 390px face beside a 400px film): in columns the question and the
        // film are the article grid's two columns, so the pane narrows both with the grid. The open face keeps a 32px lane each
        // side for the deck's arrows (CARDWIDTH, v1.263.1; WAS one 52px lane), the film stays right of it, and each keeps its
        // vertical dock.
        if (surface === "card") {
          expect(open.film.width - open.card.width, "equal columns: the film is the face and its arrows' two lanes").toBeCloseTo(64, 0)
          expect(open.film.x, 'the film stays right of the question').toBeGreaterThan(open.card.right)
        }
        expect(open[surface].y, `${surface} keeps its vertical dock`).toBeCloseTo(before[surface].y, 0)
      }
    }
    if (open.layout === 'stacked') {
      // U110 a: stacked, the film and the card's section share one box of at most 496px. CARDWIDTH (v1.263.1): the section is the
      // grid, the face is that less a 32px lane per deck arrow (WAS the free width less 104, its arrows outside).
      expect(open.film.width).toBe(Math.min(496, width - open.pane.width - 32))
      expect(open.card.width).toBe(Math.min(496, width - open.pane.width - 64) - 64)
      expect(open.card.y - open.hand.bottom, 'the question follows Moves at the deck gap').toBeCloseTo(16, 0)
      expect(open.film.y - (open.card.bottom + 3 * open.backs), "the current card follows the question's backs at the deck gap").toBeCloseTo(16, 0)
    }
    expect(open.more.center - before.more.center).toBeCloseTo(open.pane.width / 2, -1)
    expect(open.more.right).toBeLessThanOrEqual(width)
    expect(open.nav.center).toBeCloseTo(open.card.center, 0)
    expect(open.node.x - before.node.x, "the visible node follows the available-space center").toBeCloseTo(open.pane.width / 2, -1)
    expect(open.node.x).toBeGreaterThan(open.pane.right)
    expect(open.node.y, "horizontal reframing preserves vertical clearance").toBeCloseTo(before.node.y, 0)
    expect(open.zoom).toBeCloseTo(before.zoom, 0)
    expect(open.selected).toBe(before.selected)
    expect(open.answers).toEqual(before.answers)
    await expect(page.locator("[data-land-q]")).toHaveText(question, { useInnerText: true })

    await closePane(page, j)
    const back = await geometry(page)
    for (const surface of ["card", "film", "more"] as const) expect(back[surface].x).toBeCloseTo(before[surface].x, 0)
    expect(back.node.x).toBeCloseTo(before.node.x, 0)
    expect(back.node.y).toBeCloseTo(before.node.y, 0)
    expect(back.node.id).toBe(before.node.id)
    expect(back.selected).toBe(before.selected)
  })
}

for (const viewport of [{ width: 768, height: 1024 }, { width: 390, height: 844 }]) {
  // D-338: Browse and Focus are gone; the logo's pane is the one Browse opened, and focusing the
  // prose is the reading interaction that Focus used to stand in for.
  test(`${viewport.width}px the pane overlays the article and preserves its place`, async ({ page }) => {
    await page.setViewportSize(viewport)
    const j = await setup(page)
    await expect(page.locator('[data-reader-ready="true"]')).toBeVisible()
    await page.locator("[data-reader-body]").focus()
    await page.keyboard.press("Control+End")
    await expect.poll(() => page.locator("[data-reader]").evaluate(e => e.scrollHeight - e.clientHeight - e.scrollTop)).toBeLessThan(2)
    const before = await page.locator("[data-reader]").evaluate(e => e.scrollTop)
    const line = () => page.locator("[data-reader]").evaluate(e => {
      const r = (window as any).__neural._reader, top = e.getBoundingClientRect().top
      const held = r.articleEl.querySelector("[data-test-line]") || ([...r.articleEl.querySelectorAll("p,li")] as Element[]).filter(x => x.getBoundingClientRect().top >= top).sort((x, y) => x.getBoundingClientRect().top - y.getBoundingClientRect().top)[0]
      held.setAttribute("data-test-line", "")
      return held.getBoundingClientRect().top - top
    })
    const lineBefore = await line()
    await openPane(page, j)
    const overlap = await page.evaluate(() => {
      const pane = document.querySelector(".ng-drill")!, article = document.querySelector(".ng-reader-article")!
      const p = pane.getBoundingClientRect(), r = article.getBoundingClientRect()
      const l = Math.max(p.left, r.left), right = Math.min(p.right, r.right), top = Math.max(p.top, r.top), bottom = Math.min(p.bottom, r.bottom)
      const hit = document.elementFromPoint((l + right) / 2, (top + bottom) / 2)
      return { width: right-l, height: bottom-top, pane: !!hit && pane.contains(hit) }
    })
    if (viewport.width <= 640) {
      expect(overlap.width).toBeGreaterThan(8)
      expect(overlap.height).toBeGreaterThan(8)
      expect(overlap.pane).toBe(true)
    } else expect(overlap.width, "the tablet article fits beside the pane").toBeLessThanOrEqual(0)
    expect(Math.abs(await line() - lineBefore), "the line holds while the pane is open").toBeLessThanOrEqual(8)
    await closePane(page, j)
    expect(await page.locator("[data-reader]").evaluate(e => e.scrollTop), "the close lands on the place the open left").toBe(before)
    // Reading here is the prose interaction (D-338 retired Focus, which set reading intent).
    expect(await page.evaluate(() => ({ reading: !!(window as any).__neural._reader.interacting, paused: (window as any).__neural.paused }))).toEqual({ reading: true, paused: true })
  })
}

// v1.249.2 (pane-hold-* in tests/artifacts/article_sections_mutants.mjs). At 768 the pane narrows the article to one lane. The
// reader holds one line at one height for the whole slide, until its place moves. It used to re-pick a line every pass and
// take a clamped height as the new place, so a close at the article's end landed 179-333px away on all six Transitions and
// Submissions pages measured, and 971px at the landed Mount Top above. Its place survived only on pages that happened not
// to clamp. The loss is a class, so both a page #339 changed and one it never touched are pinned here, on real content.
async function articleEnd(page: Page, path: string) {
  await page.setViewportSize({ width: 768, height: 1024 })
  const j = journey(page)
  await j.boot(path, { beforeNavigate: async () => { await page.route("**/static/neural/content/*.json", r => r.continue()) } })
  await expect(page.locator('[data-reader-ready="true"]')).toBeVisible()
  await j.readerLayoutSettled()
  await page.locator("[data-reader-body]").focus()
  await page.keyboard.press("Control+End")
  await expect.poll(() => page.locator("[data-reader]").evaluate(e => e.scrollHeight - e.clientHeight - e.scrollTop)).toBeLessThan(2)
  return j
}
const readerTop = (page: Page) => page.locator("[data-reader]").evaluate(e => e.scrollTop)
for (const path of ["/Positions/Mount/Top", "/Transitions/50-50-Entry/Attacker"]) {
  test(`768px the pane opened and closed at the end of ${path} restores the reader's place`, async ({ page }) => {
    const j = await articleEnd(page, path)
    const before = await readerTop(page)
    await openPane(page, j)
    expect(await readerTop(page), "premise: the slide moved the reader, so the place was at stake").not.toBe(before)
    await closePane(page, j)
    expect(await readerTop(page), "the close lands on the place the open left").toBe(before)
  })
}
// At 768 the only exact pin on U59 c's hold while the pane is open: article-dashboard pins 1440 and 1152. pane-open-hold-lost
// (retargeted in v1.253.0 after U114 a moved its target, and killed again: #354's review, finding 2).
// On screen coordinates, from the landed start with an open question. UNGUARDED: from a direct boot the slide's last pass shifts
// the stage about 18px with no change of grid, so the anchor has no reason to fire and the line ends that much higher while the
// pane is open: 17-18px on the four position pages measured, on v1.249.1 and v1.249.2 alike. The close still lands exactly.
test("768px the line holds while the pane is open, mid-article", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 })
  const j = await setup(page)
  await expect(page.locator('[data-reader-ready="true"]')).toBeVisible()
  await page.locator("[data-reader-body]").focus()
  await page.keyboard.press("Control+End")
  await expect.poll(() => page.locator("[data-reader]").evaluate(e => e.scrollHeight - e.clientHeight - e.scrollTop)).toBeLessThan(2)
  const held = await page.locator("[data-reader]").evaluate(e => {
    e.scrollTop = Math.round(e.scrollTop * .35)
    return new Promise<number>(done => requestAnimationFrame(() => requestAnimationFrame(() => {
      const r = (window as any).__neural._reader, top = e.getBoundingClientRect().top
      const line = ([...r.articleEl.querySelectorAll("p,li")] as Element[]).filter(x => x.getBoundingClientRect().top >= top).sort((x, y) => x.getBoundingClientRect().top - y.getBoundingClientRect().top)[0]
      line.setAttribute("data-test-line", "")
      done(line.getBoundingClientRect().top)
    })))
  })
  await openPane(page, j)
  const open = await page.locator("[data-reader]").evaluate(e => ({ line: e.querySelector("[data-test-line]")!.getBoundingClientRect().top, top: e.scrollTop, max: e.scrollHeight - e.clientHeight }))
  expect(open.top, "premise: the document's end is not what stops the line").toBeLessThan(open.max - 1)
  expect(Math.abs(open.line - held), `the line holds on screen (${held} -> ${open.line})`).toBeLessThanOrEqual(8)
})
// v1.250.1: a clamp is the document's end moving under the place, and only that. #340 asked "at the end and below the place",
// which a smooth Ctrl+Home's first tick also is when it moves 1px: layoutNow wrote the place back, the running animation kept
// the +1 as an offset and stopped at 1 (reading-navigation.spec.ts, CI run 42152251420: 2 of 72 under load on two cores, 0 of
// 40 without; deploy-dev run 42185772781 on 6 Nov). A 1px write stands in for that tick, which makes it deterministic: red 3
// of 3 on dev's reader, green 3 of 3 with the fix. place-end-tick.
// UNGUARDED: the place past the end. While the open pane clamps a held place, a 1px tick up still reads as the clamp and is
// undone: this page at 768, end 7709, place 7779, the write gone four frames later. #340's guard read that case the same way.
test("a one-pixel scroll up from the article's end is the reader's own", async ({ page }) => {
  const j = await articleEnd(page, "/Transitions/50-50-Entry/Attacker")
  const landed = await page.locator("[data-reader]").evaluate(e => {
    const end = e.scrollHeight - e.clientHeight
    e.scrollTop = end - 1
    return new Promise<{ end: number, top: number }>(done => { let n = 4; const tick = () => --n ? requestAnimationFrame(tick) : done({ end, top: e.scrollTop }); requestAnimationFrame(tick) })
  })
  await j.readerLayoutSettled()
  expect(landed.top, "the tick stays where it landed").toBe(landed.end - 1)
})
test("768px a scroll while the pane is open is the reader's new place, and the close holds that one", async ({ page }) => {
  const j = await articleEnd(page, "/Transitions/50-50-Entry/Attacker")
  await openPane(page, j)
  const held = await page.locator("[data-reader]").evaluate(e => {
    e.scrollTop = Math.round(e.scrollTop * .4)
    return new Promise<number>(done => requestAnimationFrame(() => requestAnimationFrame(() => {
      const r = (window as any).__neural._reader, top = e.getBoundingClientRect().top
      const line = ([...r.articleEl.querySelectorAll("p,li")] as Element[]).filter(x => x.getBoundingClientRect().top >= top).sort((x, y) => x.getBoundingClientRect().top - y.getBoundingClientRect().top)[0]
      line.setAttribute("data-test-line", "")
      done(line.getBoundingClientRect().top - top)
    })))
  })
  await closePane(page, j)
  const now = await page.locator("[data-reader]").evaluate(e => e.querySelector("[data-test-line]")!.getBoundingClientRect().top - e.getBoundingClientRect().top)
  expect(Math.abs(now - held), `the new line keeps its place (${held} -> ${now})`).toBeLessThanOrEqual(8)
})

// #348's review: the scroll above moves 60% of the article, so a hold that ignored any scroll under 100px passed it. A 24px wheel, real
// input, is the reader's own too. hold-loose.
test("1440px a small wheel while the pane is open is the reader's new place, and the close holds that one", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const j = journey(page)
  await j.boot("/Positions/Mount/Top", { beforeNavigate: async () => { await page.route("**/static/neural/content/*.json", r => r.continue()) } })
  await expect(page.locator('[data-reader-ready="true"]')).toBeVisible()
  await j.readerLayoutSettled()
  await page.locator("[data-reader]").evaluate(e => { e.scrollTop = Math.round(e.scrollHeight * .4) })
  await settle(page, j)
  await openPane(page, j)
  const before = await readerTop(page)
  const at = await page.locator("[data-reader]").evaluate(e => {
    const r = e.getBoundingClientRect(), x = r.right - 120, y = r.top + r.height / 2, hit = document.elementFromPoint(x, y)
    return { x, y, inside: !!hit && e.contains(hit) }
  })
  expect(at.inside, "premise: the wheel is over the article, not the pane").toBe(true)
  await page.mouse.move(at.x, at.y)
  await page.mouse.wheel(0, 24)
  await expect.poll(() => readerTop(page), { message: "the wheel moved the reader a little" }).toBeGreaterThan(before + 8)
  await settle(page, j)
  const moved = await readerTop(page) - before
  expect(moved, "premise: a small scroll, under the 100px a loose hold would ignore").toBeLessThan(60)
  const held = await page.locator("[data-reader]").evaluate(e => {
    const top = e.getBoundingClientRect().top, line = ([...e.querySelectorAll("[data-reader-body] p,[data-reader-body] li")] as Element[]).filter(x => x.getClientRects().length && x.getBoundingClientRect().top >= top).sort((x, y) => x.getBoundingClientRect().top - y.getBoundingClientRect().top)[0]
    line.setAttribute("data-test-small", "")
    return line.getBoundingClientRect().top - top
  })
  await closePane(page, j)
  const now = await page.locator("[data-reader]").evaluate(e => e.querySelector("[data-test-small]")!.getBoundingClientRect().top - e.getBoundingClientRect().top)
  expect(Math.abs(now - held), `the line the wheel left keeps its place (${held} -> ${now}, moved ${moved})`).toBeLessThanOrEqual(8)
})

test("exposed cards, videos and reading take real mouse input while the pane is open", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 })
  const j = await setup(page)
  // D-338: Questions follows Videos and Moves and can start below the fold: scroll to it first.
  await page.locator("[data-landcard]").evaluate(e => e.scrollIntoView({ block: "nearest" }))
  await settle(page, j)
  await openPane(page, j)
  // D-368 (layout C): at 1024 the open pane leaves too little width for the card beside the question, so the
  // stage stacks. U52 b: the question stays straight after Moves and the current card follows it; a reader
  // still scrolls to the question again, which is a no-op when it is already in view.
  await page.locator("[data-landcard]").evaluate(e => e.scrollIntoView({ block: "nearest" }))
  await settle(page, j)
  const keyed = await geometry(page)
  await page.keyboard.press("ArrowRight")
  await page.keyboard.press("a")
  const afterKeys = await geometry(page)
  expect(afterKeys.selected, "pane keyboard priority does not page the landing deck").toBe(keyed.selected)
  expect(afterKeys.answers, "pane keyboard priority does not answer the landing question").toEqual(keyed.answers)
  await page.mouse.move(keyed.card.center, keyed.card.y + keyed.card.height / 2)
  await page.mouse.wheel(120, 0)
  await expect.poll(async () => (await geometry(page)).selected).toBe(1)
  await j.advance(100)
  expect((await geometry(page)).zoom, "horizontal card browsing never zooms the graph").toBeCloseTo(keyed.zoom, 1)
  await j.clickByMouse("[data-land-prev]", "return after the horizontal wheel")
  await j.clickByMouse("[data-land-next]", "the exposed next-card control")
  expect((await geometry(page)).selected).toBe(1)
  await j.clickByMouse("[data-land-prev]", "the exposed previous-card control")
  expect((await geometry(page)).selected).toBe(0)

  // STALE SPEC (v1.230.0, feat/video-cards): the current card shows one full video and a 10% peek of the
  // next, so the exposed thumbnail is the first; the peek's centre sits off screen beside the pane.
  // U52 b: stacked, the current card follows the question, so a reader scrolls to it, as to the question above.
  await page.locator('[data-land-film] .ng-clip[data-i="0"]').evaluate(e => e.scrollIntoView({ block: "nearest" }))
  await settle(page, j)
  await j.clickByMouse('[data-land-film] .ng-clip[data-i="0"]', "an exposed video thumbnail")
  // VIDEO1: the exposed card launches its own top-layer player; closing it
  // returns to the still-open pane without consuming the pane's pause latch.
  await expect(page.locator(".ng-video-theater .ngPlayerHost")).toBeVisible()
  await expect(page.locator("[data-land-film] iframe")).toHaveCount(0)
  await page.locator(".ng-video-theater").evaluate(async d => { await Promise.all(d.getAnimations().map(a => a.finished)) })
  await j.clickByMouse(".ng-video-theater .ngClipX", "the visible theater close button")
  await expect(page.locator(".ng-video-theater")).toHaveCount(0)
  await expect(page.locator('[data-land-film] [data-film-play]').first()).toBeFocused()
  await settle(page, j)

  // STALE SPEC (D-368, layout C): the current card is a game part, so playing it is no longer reading (a Videos
  // clip was, D-338). The prose is read beside the open pane instead. The pane's close resumes the game it paused
  // while the reader still reads, and the next reading input must stop it again (d338-running-reader-not-paused).
  await page.evaluate(() => (window as any).__neural._reader.articleEl.scrollIntoView({ block: "start" }))
  await settle(page, j)
  const prose = await page.evaluate(() => { const r = (window as any).__neural._reader, b = r.articleEl.getBoundingClientRect(), v = r.root.getBoundingClientRect()
    const top = Math.max(b.top, v.top), bottom = Math.min(b.bottom, v.bottom, innerHeight); return { x: (b.left + b.right) / 2, y: (top + bottom) / 2, visible: bottom - top } })
  expect(prose.visible, "premise: the prose shows beside the open pane").toBeGreaterThan(40)
  await page.mouse.move(prose.x, prose.y)
  await page.mouse.wheel(0, 40)
  await expect.poll(() => page.evaluate(() => !!(window as any).__neural._reader.interacting), "premise: reading beside the open pane").toBe(true)
  // STALE CONTRACT (D-338): Focus, which took reading ownership and closed the pane, is gone.
  // Closing the pane and reading the prose take it now. Reopening the pane leaves the article's
  // native scroll position alone and never hands the clock back a miss.
  await closePane(page, j)
  expect(await page.evaluate(() => ({ reading: !!(window as any).__neural._reader.interacting, paused: (window as any).__neural.paused })),
    "premise: the pane's close resumes the game it paused, while the reader still reads").toEqual({ reading: true, paused: false })
  await expect(page.locator('[data-reader-ready="true"]')).toBeVisible()
  await page.locator("[data-reader-body]").focus()
  await page.keyboard.press("Control+End")
  expect(await page.evaluate(() => (window as any).__neural.paused), "the next reading input stops the game again").toBe(true)
  await expect.poll(() => page.locator("[data-reader]").evaluate(e => e.scrollHeight - e.clientHeight - e.scrollTop)).toBeLessThan(2)
  await openPane(page, j)
  const opened = await page.locator("[data-reader]").evaluate(e => e.scrollTop)
  await page.mouse.move(180, 300)
  await page.mouse.wheel(0, 120)
  await page.waitForTimeout(100)
  // D-338: the Videos section now sizes with the article column, which narrows beside the pane, so
  // the document can change length, and U59 c's anchor moves scrollTop to hold the line while it does:
  // article-dashboard pins that. v1.249.1: what this journey pins is that a wheel over the pane moves
  // nothing, read against the position the opened pane settled on, unless the browser clamps it.
  // NON-KILL (U59 c, measured in DASH-R4): d338-clamped-place-lost survives here. The reader's bottom
  // reserve now spans the full width (the account pill), so at 1024 the pane no longer moves it, the
  // document never clamps, and reader.src.js's clamp restore is not exercised by this journey.
  const after = await page.locator("[data-reader]").evaluate(e => ({ top: e.scrollTop, max: e.scrollHeight - e.clientHeight }))
  expect(after.top, `a wheel over the pane leaves the reader alone (${JSON.stringify({ opened, ...after })})`).toBe(Math.min(opened, after.max))
  await closePane(page, j)
  await j.advance(20000)
  expect(await page.evaluate(() => (window as any).__neural.paused)).toBe(true)
})

test("resizing an open pane preserves the card through the stacked landscape flow", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const j = await setup(page)
  await j.clickByMouse("[data-land-next]")
  await openPane(page, j)
  const desktop = await geometry(page)
  await page.setViewportSize({ width: 844, height: 390 })
  await settle(page, j)
  const landscape = await geometry(page)
  expect(landscape.selected).toBe(desktop.selected)
  expect(landscape.node.id).toBe(desktop.node.id)
  expect(landscape.card.visible).toBe(true)
  // STALE CONTRACT (D-338): the landscape flow reads Videos, Moves, Questions (no stacked film home).
  // STALE CONTRACT (D-368, layout C): a short landscape has no room beside the question, so the stage stacks:
  // Moves, then the current card, then the question at 12px. STALE CONTRACT (that stacked order): U52 b puts
  // the question straight after Moves, and the current card follows the question's backs at the deck gap.
  expect(landscape.layout).toBe('stacked')
  expect(landscape.film.y, "the stage follows Moves").toBeGreaterThanOrEqual(landscape.hand.bottom)
  expect(landscape.film.y - (landscape.card.bottom + 3 * landscape.backs), "the current card follows the question's backs at the deck gap").toBeCloseTo(16, 0)
  expect(landscape.film.right, "the composition stays within the viewport").toBeLessThanOrEqual(844)
  await closePane(page, j)
  const closed = await geometry(page)
  expect(closed.layout).toBe('stacked')
  expect(closed.card.center).toBeCloseTo(844 / 2, 0)
  expect(closed.film.center).toBeCloseTo(844 / 2, 0)
  await openPane(page, j)
  await page.setViewportSize({ width: 1440, height: 900 })
  await settle(page, j)
  const back = await geometry(page)
  expect(back.card.x).toBeCloseTo(desktop.card.x, 0)
  expect(back.film.x).toBeCloseTo(desktop.film.x, 0)
  expect(back.selected).toBe(desktop.selected)
})
