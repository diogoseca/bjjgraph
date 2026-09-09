import { test, expect } from "@playwright/test"
import { journey } from "../dsl"

type Any = any

/**
 * THE TIMED LANDING CARD AND THE FULLER READING CARD ARE SEPARATE (v1.174.0), AND THEY SCROLL AS
 * ONE COLUMN (v1.175.0).
 *
 * v1.100.0 made the node itself the dossier. v1.101.0 moved those fuller rows into the landing
 * card. The owner's final boundary is stricter: “More shouldn't touch the landcard”; the small
 * control must expand itself into another landcard-shaped container — and that container is not
 * a scrollport: it is long, it runs under the fold, and reading it scrolls the screen (film,
 * timed card, second card and the pushed-down hand together).
 *
 * This file pins the complete boundary after the minimized-content merge: the roll settles close
 * enough for the graph to name the state, the timed card stays the persisted `card` layer, and
 * More morphs its own subordinate root-plane sibling into the second card of that column without
 * changing the timed card.
 */


/** Give the CURRENT state an authored dossier, so it actually has a `More` to open.
 *  The DSL serves `{}` for content chunks by design, and since v1.101.9 a state with nothing
 *  behind `More` renders no control at all — so a journey about the reading card authors one. */
const seedDossier = async (page: Any) => {
  await page.evaluate(() => {
    const a = (window as Any).__neural
    const key = a.deckKeyFor(a.nodes[a.currentPos]).key
    const w = window as Any
    w.NG_CONTENT = w.NG_CONTENT || {}
    w.NG_CONTENT.decks = w.NG_CONTENT.decks || {}
    w.NG_CONTENT.decks[key] = {
      def: "A seeded definition that gives this state enough authored depth to reveal deliberately.",
      principles: [
        "Keep a connected frame while pressure changes so the position remains stable through every adjustment and the next attack stays available.",
        "Control the near-side space before advancing so a defensive turn cannot recover the frames that were already removed.",
        "Move weight in small deliberate steps, preserving balance and alignment instead of reaching past the base for a finish.",
        "Read the opponent's strongest escape first and make the next control answer that route before adding another attack.",
      ],
      counters: [
        "A disciplined frame can make forward pressure expensive, so clear the frame before committing weight across it.",
        "A well-timed hip turn creates enough space to recover a knee line unless the upper body remains connected.",
        "Reaching without a stable base exposes a reversal, especially when the opponent can connect elbow and knee.",
      ],
      // a film row, so the reading column has all three of its root-plane members (v1.175.0)
      clips: [
        { id: "aQ2vFXXBn-o", title: "Countering a full inversion", who: "Gordon Ryan" },
        { id: "bQ2vFXXBn-o", title: "Second clip", who: "Someone" },
      ],
    }
    a._landQ = null
    a.renderLandCard(a.nodes[a.currentPos], "land", null)
  })
}

const landed = (page: Any) =>
  page.evaluate(() => {
    const a = (window as Any).__neural
    return { idx: a.currentPos, el: !!a._landEl }
  })

test("the roll settles ON the node, and the node names the state it is", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await j.advance(2500)

  const m = await page.evaluate(() => {
    const a = (window as Any).__neural
    const n = a.nodes[a.focusIdx]
    const scale = a.W / a.cam.vw
    const card = a._landEl ? a._landEl.getBoundingClientRect() : null
    return {
      zoom: a.cam.vw / a.graphW,
      rollZoom: a.ROLL_ZOOM,
      sx: (n.x - a.cam.cx) * scale + a.W / 2,
      sy: (n.y - a.cam.cy) * scale + a.H / 2,
      rPx: n.r * scale,
      cardTop: card ? card.top : null,
      H: a.H,
      W: a.W,
    }
  })

  // a TENTH of the deepest read zoom (graphW * 0.0085) — the owner's number
  expect(m.rollZoom, "ROLL_ZOOM is a tenth of the deepest read zoom").toBeCloseTo(0.085, 4)
  expect(m.zoom, "and the camera actually settles there").toBeLessThan(0.1)

  // ON SCREEN, and CLEAR OF THE CARD. The focus used to sit dead centre at y≈450 with the card
  // occupying y≈362..900 — behind the surface that talks about it, at every zoom.
  expect(m.sx, "the node is on screen horizontally").toBeGreaterThan(0)
  expect(m.sx).toBeLessThan(m.W)
  expect(m.sy, "and parked in the clear band near the top").toBeGreaterThan(0)
  expect(
    m.sy + m.rPx,
    `the whole node clears the top of the landing card (node bottom ${Math.round(m.sy + m.rPx)}, card top ${m.cardTop})`,
  ).toBeLessThan(m.cardTop)

  // ...and the graph still names the state, which is what licenses the card to drop it — but
  // since v1.114.0 it names it BESIDE the node, not inside it (owner: "we don't want content to
  // appear inside any node… the label, role and technique name, should appear to the right of
  // it… even when we zoom in or zoom out"). So the claim to check is that the focus label is
  // drawn at all, at this zoom, which the old `rPx > 20` in-node threshold used to SUPPRESS.
  expect(m.rPx, "the node is drawn at a size a label can hang off").toBeGreaterThan(20)
  const named = await page.evaluate(() => {
    const a = (window as Any).__neural
    const n = a.nodes[a.focusIdx]
    return {
      label: n.ty === "positions" ? a.posFamily(n.t) : a.displayName(n),
      role: a.roleLabel(),
      showLabels: a.cfg().showLabels !== false,
    }
  })
  expect(named.showLabels, "labels are on, so the focus carries one").toBe(true)
  expect(named.label, "and the graph names the state beside the node").toBeTruthy()
})

test("the landing card does not repeat what the graph already says", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await j.advance(1200)

  // v1.101.1: a LANDING card has no header block at all — the question is the first thing in it
  await expect(
    page.locator("[data-land-id]"),
    "no meta row above the question on a landing",
  ).toHaveCount(0)
  // the card's CHROME, with the question's own words excluded: a flashcard is allowed to say
  // "the Mount position" — that is the question, not the card repeating the graph.
  const txt = await page.evaluate(() => {
    const c = document.querySelector("[data-landcard]") as HTMLElement
    if (!c) return ""
    const clone = c.cloneNode(true) as HTMLElement
    clone.querySelectorAll("[data-land-q]").forEach((q) => q.remove())
    return (clone.textContent || "").trim()
  })

  const name = await page.evaluate(() => {
    const a = (window as Any).__neural
    return a.posFamily(a.nodes[a.currentPos].t)
  })
  expect(name, "premise: the state has a name").toBeTruthy()
  expect(
    txt.includes(name),
    `the landing card does not print "${name}" (meta line was "${txt}")`,
  ).toBe(false)
  expect(
    /\b(top|bottom|attacking|defending)\b/i.test(txt),
    `nor the side (meta line was "${txt}")`,
  ).toBe(false)
  await expect(page.locator("[data-land-close]"), "a small way out, top right").toHaveCount(1)
})

/** One reading of the whole landing surface, in viewport pixels. `home` is the frame every
 *  dock rule wrote; the column only ever TRANSLATES from it (`_readApply`), so every number here
 *  is a rect the player sees, never a recomputation of the app's own maths (§6.3). */
const column = (page: Any) =>
  page.evaluate(() => {
    const a = (window as Any).__neural
    const r = (e: HTMLElement | null) => {
      if (!e) return null
      const b = e.getBoundingClientRect()
      return { top: Math.round(b.top), bottom: Math.round(b.bottom), height: Math.round(b.height) }
    }
    const card = a._landEl as HTMLElement, row = a._landMoreEl as HTMLElement | null
    const tray = a.optionsRef.current as HTMLElement
    const detail = row ? (row.querySelector("[data-land-more-body]") as HTMLElement) : null
    const cnt = card.querySelector("[data-land-count]") as HTMLElement | null
    return {
      S: a._readS || 0,
      M: a._readMax || 0,
      open: !!a._landOpen,
      paused: !!a.paused,
      autoPaused: !!a._landAutoPaused,
      card: r(card),
      cardScrollTop: card.scrollTop,
      cardChildren: card.childElementCount,
      cardMaxHeight: card.style.maxHeight,
      film: r(a._landFilmEl),
      row: r(row),
      rowOpen: !!row && row.classList.contains("open"),
      rowScrollable: !!row && row.scrollHeight > row.clientHeight + 1,
      rowOverflow: row ? getComputedStyle(row).overflowY : null,
      rowMaxHeight: row ? getComputedStyle(row).maxHeight : null,
      rowChips: row ? row.querySelectorAll("[data-land-count]").length : 0,
      detailDisplay: detail ? detail.style.display : null,
      detailOutside: !!detail && !card.contains(detail),
      detailText: detail ? (detail.textContent || "").trim().length : 0,
      label: row ? (row.querySelector("[data-land-more]")?.textContent || "").trim() : null,
      aria: row ? row.querySelector("[data-land-more]")?.getAttribute("aria-expanded") : null,
      tray: r(tray),
      trayBottom: tray.style.bottom,
      handX: r(a._handCloseEl),
      count: cnt ? { text: cnt.textContent, attr: cnt.getAttribute("data-land-count"), color: getComputedStyle(cnt).color, pointer: getComputedStyle(cnt).pointerEvents, inCorner: !!cnt.closest("[data-land-corner]") } : null,
      band: a._bandBot ? a._bandBot.y : null,
      viewportBottom: window.innerHeight,
      closeLabel: card.querySelector("[data-land-close]")?.getAttribute("aria-label"),
      nodeCard: a.nodeCardRef.current ? a.nodeCardRef.current.style.display : null,
      dossierIdx: a._dossierIdx ?? null,
    }
  })

/** A few pumped frames: the hand's ✕ is re-docked to the row's live rect by `updateUiShift`
 *  every frame (v1.176.7), and under `__NEURAL_TEST__` frames only run through the `advance()`
 *  pump (rAF ticks nothing) — so a read taken straight after an input sees the ✕ a frame behind
 *  the tray it rides. 50ms of sim time is three ticks; the read is paused, so nothing else moves. */
const settle = (j: Any) => j.advance(50)

/**
 * THE READING COLUMN (v1.175.0). Owner, on v1.174.0's independently scrolling second card:
 * "I wasn't expecting the choices row to disappear behind the card", "when I scroll this card
 * should go under the fold too so it should be long … what moves up is this new card, the land
 * card and the videos row. Basically everything moves up … if I scroll [back] we get back to the
 * same state we were in." So: More opens a second card at content height under the timed card
 * (no scrollport), the hand is PUSHED below it rather than covered, and a wheel — anywhere but a
 * surface that scrolls itself — translates film + card + More + hand together, back to the exact
 * open frame at offset 0. Mutants that must die: `_readApply` dropping the hand (`trayBottom`
 * stays 84px at offset 0 → covered), the More card keeping `overflow-y:auto` (`rowScrollable`),
 * `_dockLandFilm`/the band measuring through the translation (`band` moves), `_readClear` on
 * close (Less leaves the tray pushed).
 */
test("More grows into a long second card and the whole column scrolls, hand pushed not covered @curated", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await seedDossier(page)
  // Let the real entry motion settle before comparing the independent fixed surfaces.
  await page.waitForTimeout(400)

  const moreCard = page.locator(".ng-landmore")
  await expect(page.locator("[data-land-more-body]"), "the fuller content belongs to its sibling from the first render").toHaveCount(1)
  await expect(page.locator("[data-land-more]"), "the separate More affordance exists").toBeVisible()
  await expect(page.locator("[data-landcard] [data-land-count]"), "the deck count lives in the timed card's corner").toHaveCount(1)

  const before = await column(page)
  expect(before.paused, "premise: the roll is running").toBe(false)
  expect(before.open).toBe(false)
  expect(before.detailDisplay, "the detail starts folded").toBe("none")
  expect(before.detailOutside, "the fuller content is owned by the root-plane sibling").toBe(true)
  expect(before.rowChips, "the More row carries no familiarity pill any more").toBe(0)
  expect(before.count!.text, "the corner shows the current card as bare position/total text")
    .toBe(`1/${before.count!.attr!.split("/")[1]}`)
  expect(before.count!.inCorner, "…under the corner's two buttons").toBe(true)
  expect(before.count!.pointer, "…and it is not a control").toBe("none")
  expect(before.count!.color, "…in the quiet grey, not the chip's blue").toBe("rgb(91, 101, 128)")
  expect(before.closeLabel, "the landing X retains the minimized card-layer job").toBe("Hide the question card")
  expect(before.card!.bottom, "the card clears the dealt choices").toBeLessThanOrEqual(before.tray!.top - 7)
  expect(before.row!.top, "More starts after the choices row ends").toBeGreaterThanOrEqual(before.tray!.bottom + 5)
  expect(before.row!.top, "and stays attached to that row").toBeLessThanOrEqual(before.tray!.bottom + 7)
  expect(before.trayBottom, "the hand sits at its datum").toBe("84px")

  await j.clickByMouse("[data-land-more]", "the floating More affordance")
  await expect(moreCard, "the control itself becomes the second card").toHaveClass(/\bopen\b/)
  await page.waitForTimeout(400)
  await settle(j)

  const open = await column(page)
  expect(open.open).toBe(true)
  expect(open.S, "a fresh read starts at the top").toBe(0)
  expect(open.detailDisplay).toBe("block")
  expect(open.detailText, "with real content").toBeGreaterThan(0)
  expect(open.label).toContain("Less")
  expect(open.aria).toBe("true")
  expect(open.card, "More does not move, resize or scroll the landing card").toEqual(before.card)
  expect(open.cardScrollTop).toBe(before.cardScrollTop)
  expect(open.cardChildren).toBe(before.cardChildren)
  expect(open.cardMaxHeight).toBe(before.cardMaxHeight)
  expect(open.film, "nor the film strip").toEqual(before.film)
  expect(open.row!.top, "the second card starts just under the landing card").toBeGreaterThanOrEqual(before.card!.bottom + 5)
  expect(open.row!.top).toBeLessThanOrEqual(before.card!.bottom + 7)
  expect(open.row!.height, "the pill grows into a card").toBeGreaterThan(before.row!.height + 100)
  expect(open.rowScrollable, "the second card is NOT a scrollport").toBe(false)
  expect(open.rowOverflow).toBe("visible")
  expect(open.rowMaxHeight, "…and nothing caps it").toBe("none")
  expect(open.row!.bottom, "it is long: it runs under the fold").toBeGreaterThan(open.viewportBottom)
  expect(open.M, "the column has that much to travel").toBeGreaterThan(0)
  expect(open.tray!.top, "the choices row is PUSHED below the second card, never covered").toBeGreaterThanOrEqual(open.row!.bottom + 8)
  expect(open.handX!.top, "with its own ✕ riding inside the pushed row, clear of the card too").toBeGreaterThanOrEqual(open.row!.bottom + 7)
  expect(open.trayBottom, "the push is written on the tray's `bottom`, not its sheet-owned transform").not.toBe("84px")
  expect(open.paused, "reading is not charged to the clock").toBe(true)
  expect(open.autoPaused, "on its own latch, so it only gives back what it took").toBe(true)
  // A camera aim in the OPEN frame (offset 0 — the dock itself) is the answer every later aim
  // must repeat. Taken through the real entry point, because the follow-cam suppresses its own
  // aim while paused and the cache only ever tightens (§6.1): a stale, looser cache is fine, a
  // tighter-than-the-dock one is the bug.
  const bandHome = await page.evaluate(() => {
    const a = (window as Any).__neural
    a.rollCamTarget(a.camFocus, false)
    return a._bandBot ? a._bandBot.y : null
  })
  expect(bandHome, "premise: the open frame measures a band").not.toBeNull()
  expect(open.nodeCard, "the retired in-node container stays down").toBe("none")
  expect(open.dossierIdx, "the More card is not the node dossier").toBeNull()

  // ── a wheel over the second card scrolls the SCREEN: every member moves by the same amount ──
  const box = await moreCard.boundingBox()
  expect(box).not.toBeNull()
  await page.mouse.move(box!.x + box!.width / 2, box!.y + 60)
  await page.mouse.wheel(0, 120)
  await expect.poll(() => page.evaluate(() => (window as Any).__neural._readS), { message: "the column moved" }).toBe(120)
  await settle(j)
  const mid = await column(page)
  expect(mid.open, "scrolling never closes the read").toBe(true)
  expect(mid.card!.top, "the landing card rose by the wheel").toBe(open.card!.top - 120)
  expect(mid.film!.top, "the film row rose with it").toBe(open.film!.top - 120)
  expect(mid.row!.top, "so did the second card").toBe(open.row!.top - 120)
  expect(mid.tray!.top, "and the pushed hand comes up from under the fold").toBe(open.tray!.top - 120)
  expect(mid.handX!.top).toBe(open.handX!.top - 120)
  expect(mid.cardScrollTop, "the landing card's own scrollport is untouched").toBe(before.cardScrollTop)
  expect(mid.card!.height).toBe(open.card!.height)
  // The follow-cam suppresses its auto-aim while paused, so the band is not measured by itself
  // mid-read — but `frameNodes` (a pane row's locate) still can be. Drive the real entry point:
  // an aim taken through the translation must measure the DOCK, or the tighten-only cache holds
  // the camera high for the rest of the session (§6.1). Mutant: drop `_readOffset()` there —
  // measured, the cache then tightens from the dock's answer to 120px above it.
  const aimed = await page.evaluate(() => {
    const a = (window as Any).__neural
    a.rollCamTarget(a.camFocus, false)
    return a._bandBot ? a._bandBot.y : null
  })
  expect(aimed, "a camera aim taken mid-read measures the dock, not the translation").toBe(bandHome)
  expect(mid.band, "and nothing else tightened it on the way").toBe(bandHome)

  // ── to the end: the hand is home again, the whole read has passed through the viewport ──
  await page.mouse.wheel(0, 4000)
  await expect.poll(() => page.evaluate(() => { const a = (window as Any).__neural; return a._readS === a._readMax })).toBe(true)
  await settle(j)
  const end = await column(page)
  expect(end.tray, "at the end of the read the choices row sits exactly where it always sits").toEqual(before.tray)
  expect(end.trayBottom).toBe("84px")
  expect(end.row!.bottom, "with the second card ending 8px above it — the card's own clearance").toBeLessThanOrEqual(end.tray!.top - 7)
  expect(end.row!.bottom).toBeGreaterThanOrEqual(end.tray!.top - 9)
  expect(end.card!.top, "the landing card has moved up by the travel").toBe(open.card!.top - end.M)
  expect(end.open).toBe(true)

  // ── the hand is under the cursor now; a vertical wheel there still scrolls the screen back ──
  await page.mouse.move(195, (end.tray!.top + end.tray!.bottom) / 2)
  await page.mouse.wheel(0, -4000)
  await expect.poll(() => page.evaluate(() => (window as Any).__neural._readS), { message: "wheel over the hand scrolls the column back" }).toBe(0)
  await settle(j)
  const back = await column(page)
  expect(back.open, "scrolling back to the top does not dismiss the reading card").toBe(true)
  expect(back.card, "the same frame as when it opened").toEqual(open.card)
  expect(back.row).toEqual(open.row)
  expect(back.tray).toEqual(open.tray)
  expect(back.detailDisplay).toBe("block")
  expect(back.paused, "the open reading card keeps its owned pause").toBe(true)

  // ── Less: the exact frame before the click ──
  await page.mouse.move(box!.x + box!.width / 2, box!.y + 20)
  await j.clickByMouse("[data-land-more]", "the Less control")
  await expect(moreCard).not.toHaveClass(/\bopen\b/)
  await settle(j)
  const folded = await column(page)
  expect(folded.open).toBe(false)
  expect(folded.detailDisplay, "the extra rows fold").toBe("none")
  expect(folded.card).toEqual(before.card)
  expect(folded.film).toEqual(before.film)
  expect(folded.row, "the pill returns below the hand").toEqual(before.row)
  expect(folded.tray, "the hand is home").toEqual(before.tray)
  expect(folded.trayBottom).toBe("84px")
  expect(folded.handX).toEqual(before.handX)
  expect(folded.cardScrollTop).toBe(before.cardScrollTop)
  expect(folded.cardChildren).toBe(before.cardChildren)
  expect(folded.paused, "the auto-pause is returned").toBe(false)
  expect(folded.closeLabel, "the landing X never changed jobs").toBe(before.closeLabel)

  // ── Esc, mid-read, restores the same frame ──
  await j.clickByMouse("[data-land-more]", "More after Less collapses")
  await expect(moreCard).toHaveClass(/\bopen\b/)
  await page.mouse.move(box!.x + box!.width / 2, box!.y + 60)
  await page.mouse.wheel(0, 150)
  await expect.poll(() => page.evaluate(() => (window as Any).__neural._readS)).toBe(150)
  await page.keyboard.press("Escape")
  await expect(moreCard, "Esc closes the deliberate More card before the landing").not.toHaveClass(/\bopen\b/)
  await expect(page.locator("[data-landcard]"), "the underlying landing remains mounted").toBeVisible()
  const esc = await column(page)
  expect(esc.card).toEqual(before.card)
  expect(esc.tray).toEqual(before.tray)
  expect(esc.trayBottom).toBe("84px")
  expect(esc.paused, "Esc also returns the owned pause").toBe(false)

  // ── a background tap, mid-read, likewise ──
  await j.clickByMouse("[data-land-more]", "More before a background dismissal")
  await expect(moreCard).toHaveClass(/\bopen\b/)
  await page.mouse.wheel(0, 150)
  await expect.poll(() => page.evaluate(() => (window as Any).__neural._readS)).toBe(150)
  await page.evaluate(() => (window as Any).__neural._tapBackground())
  await expect(moreCard, "background closes the independent More step first").not.toHaveClass(/\bopen\b/)
  await expect(page.locator("[data-landcard]"), "the timed card survives that first background step").toBeVisible()
  const bg = await column(page)
  expect(bg.card).toEqual(before.card)
  expect(bg.tray).toEqual(before.tray)
  expect(bg.paused, "background returns the More-owned pause").toBe(false)

  // ── a full teardown mid-read leaves no orphan surface and no pushed hand ──
  await j.clickByMouse("[data-land-more]", "More before the landing slot is torn down")
  await expect(moreCard).toHaveClass(/\bopen\b/)
  await page.mouse.wheel(0, 150)
  await expect.poll(() => page.evaluate(() => (window as Any).__neural._readS)).toBe(150)
  await page.evaluate(() => (window as Any).__neural.clearOptions())
  await expect(moreCard, "a full teardown leaves no orphan reading surface").toHaveCount(0)
  const tornDown = await page.evaluate(() => {
    const a = (window as Any).__neural
    return { open: !!a._landOpen, autoPaused: !!a._landAutoPaused, paused: !!a.paused, trayBottom: (a.optionsRef.current as HTMLElement).style.bottom }
  })
  expect(tornDown, "the teardown releases every More-owned state, the hand's datum included").toEqual({ open: false, autoPaused: false, paused: false, trayBottom: "84px" })
})

/** Picking up a card from the hand at the foot of the read closes the column before the sheet
 *  opens — otherwise the sheet (root plane, z:50) opens UNDER the More card (z:90) with the
 *  tray still pushed. Mutant: drop the `expandLandCard(false)` at the top of `expandOption`. */
test("a card picked from the foot of the read closes the column and opens its sheet", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await seedDossier(page)
  await page.waitForTimeout(400)
  await j.clickByMouse("[data-land-more]", "More")
  await expect(page.locator(".ng-landmore")).toHaveClass(/\bopen\b/)
  await page.evaluate(() => (window as Any).__neural._readScrollBy(5000))
  const end = await column(page)
  expect(end.S, "premise: read to the end").toBe(end.M)
  expect(end.trayBottom, "premise: the hand is home and reachable").toBe("84px")
  const tech = await page.evaluate(() => {
    const c = (window as Any).__neural.optionsRef.current.querySelector("[data-tech]")
    return c ? c.getAttribute("data-tech") : null
  })
  expect(tech, "premise: a dealt card to pick up").toBeTruthy()
  await j.clickByMouse(`[data-tech="${tech}"]`, "the first dealt card, at the foot of the read")
  await expect(page.locator("[data-go]"), "its sheet opens").toBeVisible()
  const after = await column(page)
  expect(after.open, "the read closed first").toBe(false)
  expect(after.trayBottom, "and the hand is at its datum under the sheet").toBe("84px")
  expect(after.rowOpen).toBe(false)
})

test("the film row rides the game card", async ({ page }) => {
  const j = journey(page)
  // the DSL serves `{}` for dossier chunks by design; this journey wants the real thing
  await j.boot("/", {
    routes: {},
  } as Any).catch(() => {})
  await page.unroute("**/static/neural/content/*.json").catch(() => {})
  await page.route("**/static/neural/content/*.json", (r: Any) =>
    r.fulfill({
      body: JSON.stringify({
        "Mount|Top": {
          def: "Master offensive strategies from top Mount.",
          clips: [{ id: "aaaaaaaaaaa", title: "Mount control", by: "Coach", vertical: false }],
        },
      }),
      contentType: "application/json",
    }),
  )
  await j.land("Mount Top")
  await j.advance(2000)

  // the row is the SAME renderer the reading surface uses, in its compact variant — and since
  // v1.101.1 it is its OWN strip, docked immediately above the card rather than scrolling inside it
  const film = await page.evaluate(() => {
    const a = (window as Any).__neural
    const f = a._landFilmEl
    const q = a._landEl ? a._landEl.querySelector("[data-land-q]") : null
    if (!f) return null
    const fr = f.getBoundingClientRect(), qr = q ? q.getBoundingClientRect() : null
    return { clips: f.querySelectorAll(".ng-clip").length, h: fr.height, filmTop: fr.top, qTop: qr ? qr.top : null,
             inCard: !!(a._landEl && a._landEl.contains(f)) }
  })
  expect(film, "the film row is up").not.toBeNull()
  expect(film!.inCard, "outside the card, immediately above it").toBe(false)
  expect(film!.clips, "with the authored clip").toBeGreaterThan(0)
  // COMPACT ON PURPOSE: the full-size strip is ~210px and pushed the question below the
  // landing card's capped viewport.
  if (film!.qTop != null)
    expect(film!.filmTop, "film reads before the question, as it always has").toBeLessThan(film!.qTop!)
})

test("a node you are NOT standing on still opens the GAME CARD, never a second surface", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await j.advance(1200)

  // a TECHNIQUE — what a coach taps in their class list. Since v1.132.0 it NAVIGATES: the
  // exchange stages ON the technique (URL, focus, camera), and the card — still the technique's,
  // star and all — arrives in the position card's exact anatomy: FOLDED (the owner retired the
  // auto-expand: "it automatically shows more instead of showing less").
  const tech = await page.evaluate(() => {
    const a = (window as Any).__neural
    const n = a.nodes.find((x: Any) => x.idx !== a.currentPos && x.ty === "transitions")
    // author something behind `More`, or v1.101.9 renders no `More` and nothing to unfold
    const w = window as Any
    w.NG_CONTENT = w.NG_CONTENT || {}; w.NG_CONTENT.decks = w.NG_CONTENT.decks || {}
    w.NG_CONTENT.decks[n.t] = { def: "Seeded.", principles: ["Seeded principle"] }
    a.openDossier(n.idx)
    return { id: n.id, t: n.t }
  })
  await j.advance(900)

  const st = await page.evaluate(() => {
    const a = (window as Any).__neural
    const nc = a.nodeCardRef && a.nodeCardRef.current
    const sh = a.dossierSheetRef && a.dossierSheetRef.current
    const body = a._landMoreEl ? a._landMoreEl.querySelector("[data-land-more-body]") : null
    const add = document.querySelector("[data-seat-star]")
    return {
      nodeCard: nc ? nc.style.display : null,
      sheet: sh ? sh.style.display : null,
      card: !!a._landEl,
      unfolded: body ? body.style.display : null,
      capture: add ? add.getAttribute("data-list-add") : null,
      zoom: a.cam.vw / a.graphW,
    }
  })
  expect(st.nodeCard, "the in-node container is gone for good").toBe("none")
  expect(st.sheet, "and no node-dossier reading sheet opens").not.toBe("block")
  expect(st.card, "the game card is what opens").toBe(true)
  expect(st.unfolded, "folded — More is one tap away, exactly like a position's card").toBe("none")
  expect(st.capture, "and the seat star captures the TECHNIQUE, not its origin position").toBe(tech.id)
  // flown TO the node, not INTO it: the old path drove the camera to graphW*0.0085
  expect(st.zoom, "the camera stops at reading distance, not inside the node").toBeGreaterThan(0.02)

  // ...and your OWN node, with the card dismissed, rebuilds it rather than reaching for a sheet.
  // That fallthrough is exactly how the sheet appeared over "Your current position".
  await page.evaluate(() => {
    const a = (window as Any).__neural
    // author something for THIS state too, so "unfolded" is a claim that can be made at all
    const key = a.deckKeyFor(a.nodes[a.currentPos]).key
    const w = window as Any
    w.NG_CONTENT = w.NG_CONTENT || {}; w.NG_CONTENT.decks = w.NG_CONTENT.decks || {}
    w.NG_CONTENT.decks[key] = { def: "Seeded.", principles: ["Seeded principle"] }
    a.clearLandCard()
    a.openDossier(a.currentPos)
  })
  await j.advance(400)
  const self = await page.evaluate(() => {
    const a = (window as Any).__neural
    const sh = a.dossierSheetRef && a.dossierSheetRef.current
    const body = a._landMoreEl ? a._landMoreEl.querySelector("[data-land-more-body]") : null
    return { sheet: sh ? sh.style.display : null, card: !!a._landEl, unfolded: body ? body.style.display : null }
  })
  expect(self.sheet, "no sheet for the node you are standing on").not.toBe("block")
  expect(self.card, "a dismissed card is rebuilt, not replaced").toBe(true)
  expect(self.unfolded, "and folded — one anatomy, nothing auto-expands (v1.132.0)").toBe("none")
})

/**
 * THE SHEET'S OWN CONTROLS MUST SURVIVE THE CANVAS'S POINTER CAPTURE.
 *
 * `attachInput`'s pointerdown calls `setPointerCapture` on the app wrap, which retargets pointerup
 * — so the browser computes the click target from the down/up common ancestor and a listener on a
 * button INSIDE an overlay never fires. This repo has paid for it twice (the coach button in
 * v1.69.1, every control in the in-node dossier in v1.81.x). Making the sheet a desktop surface
 * exposed it a third time: "Add to today's class list" was visible, enabled, hit-testable — and
 * dead. Traced as `doc-down:dsListTxt` then `doc-click:` on an element with no class at all.
 */
test("the seat's capture star really is clickable, by mouse", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await j.advance(1200)

  const id = await page.evaluate(() => {
    const a = (window as Any).__neural
    const n = a.nodes.find((x: Any) => x.idx !== a.currentPos && (x.ty === "transitions" || x.ty === "submissions"))
    // EXACTLY one list, so a capture is one tap and not the destination picker
    a.lists = {}
    a.newList()
    a.openDossier(n.idx)
    return n.id
  })
  await j.advance(900)
  // the card enters on a REAL-time CSS animation (ngCardInX, .28s) and `advance` pumps the
  // SIMULATED clock — so a click dispatched immediately lands on a card still fading in
  await page.waitForTimeout(400)
  // …AND THE DECK CHUNKS MUST HAVE LANDED (v1.171.0). The hand's warm-up fetches resolve on the
  // REAL clock, each batch fires onFlashcardsReady → buildDrillPanel → applyDeckVisibility,
  // which closes an open picker ("an anchored chooser cannot outlive the surface it hangs off").
  // A batch landing a few ms AFTER the click below closed the picker this test then looked for —
  // a race the 400ms above won by luck until a heavier bundle lost it 4 of 4 runs. Wait for the
  // in-flight map to drain, so the click is the last thing that happens to the card.
  await page.waitForFunction(() => {
    const a = (window as Any).__neural
    return !a._hydrateRefresh && !Object.keys(a._deckWaits || {}).length
  }, null, { timeout: 15000 })
  await page.waitForTimeout(100)

  const sel = `[data-list-add="${id}"][data-list-surface="seat"]`
  await j.clickByMouse(sel, "the seat's capture star")
  await j.advance(200)
  // v1.101.9: the `+` NEVER files on its own — it asks. One list still asks, because "the last
  // list you touched" is not a destination the user chose.
  await expect(page.locator("[data-list-picker]"), "the star asks where it goes").toHaveCount(1)
  expect(
    await page.evaluate(() =>
      Object.values((window as Any).__neural.lists || {}).some((l: Any) => (l.items || []).length),
    ),
    "and files nothing until a list is picked",
  ).toBe(false)
  await j.clickByMouse("[data-list-pick]", "the destination the reader chose")
  await j.advance(300)
  expect(
    await page.evaluate((nid: string) => {
      const a = (window as Any).__neural
      return Object.values(a.lists || {}).some((l: Any) => (l.items || []).indexOf(nid) >= 0)
    }, id),
    "the technique a coach read about lands in their class list",
  ).toBe(true)
  await j.expectBeat("list_item_added")
})

/**
 * THE CORNER CLEARANCE IS THE QUESTION'S, NOT THE BLOCK'S. `[data-land-q]` wraps the question
 * line AND the three answers; putting the `padding-right` that clears the `+`/✕ on the wrapper
 * inset the answers too — and they are `white-space:nowrap` with an ellipsis, so 54px of padding
 * is 54px of answer text that stops being readable. Only the line that actually runs under the
 * corner controls pays for them.
 */
test("only the question line clears the corner controls — the answers get their width back", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await j.advance(1500)

  const m = await page.evaluate(() => {
    const wrap = document.querySelector("[data-land-q]") as HTMLElement
    if (!wrap) return null
    const qt = wrap.firstElementChild as HTMLElement
    const opt = wrap.querySelector("[data-land-mc-opt]") as HTMLElement
    const corner = document.querySelector("[data-land-corner]") as HTMLElement
    if (!opt || !corner) return null
    // where the question's TEXT ends, not where its box does — padding is inside the rect
    const range = document.createRange()
    range.selectNodeContents(qt)
    return {
      wrapPad: getComputedStyle(wrap).paddingRight,
      qtPad: getComputedStyle(qt).paddingRight,
      optWidth: Math.round(opt.getBoundingClientRect().width),
      wrapWidth: Math.round(wrap.getBoundingClientRect().width),
      textRight: Math.round(range.getBoundingClientRect().right),
      cornerLeft: Math.round(corner.getBoundingClientRect().left),
    }
  })
  expect(m, "a multiple-choice question is on the card").not.toBeNull()

  expect(m!.wrapPad, "the block does not inset the answers").toBe("0px")
  expect(
    m!.optWidth,
    `an answer spans the card's full width (${m!.optWidth} of ${m!.wrapWidth})`,
  ).toBe(m!.wrapWidth)
  expect(m!.qtPad, "the question line carries the clearance instead").toBe("54px")
  expect(
    m!.textRight,
    `and its text really stops before the corner (text ends ${m!.textRight}, corner starts ${m!.cornerLeft})`,
  ).toBeLessThanOrEqual(m!.cornerLeft)
})

/**
 * THE TIMED CARD NEVER LEAVES THE SCREEN, AND ON DESKTOP THE COLUMN SCROLLS FROM THE GRAPH TOO.
 *
 * The card is anchored by its BOTTOM (236px desktop, 206px phone, and `_dockLandCard` overrides
 * that again). The old constant expanded ceiling grew it UPWARD off a short viewport — measured
 * at 1440x720 the top was -28 with `scrollHeight == clientHeight`, so there was no internal scroll
 * to recover it either. Owner: "I can't scroll up". Since v1.174.0 More never touches the timed
 * card; since v1.175.0 the second card runs under the fold at content height and the whole
 * column translates — and on desktop the wheel that moves it may land on the GRAPH beside the
 * 520px column (the document-level capture in `boot`), which must NOT zoom the camera instead.
 * Mutant: drop the capture listener → `cam.vw` moves and `_readS` stays 0.
 */
for (const height of [900, 720]) {
  test(`the timed card stays on screen and the column scrolls from the graph at ${height}px tall`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height })
    const j = journey(page)
    await j.boot("/")
    await j.land("Mount Top")
    await j.advance(1500)
    await seedDossier(page)
    await page.waitForTimeout(400)

    const before = await column(page)
    await page.locator("[data-land-more]").click()
    await page.waitForTimeout(400)
    const open = await column(page)
    expect(open.card, "More leaves the timed card exactly where it was").toEqual(before.card)
    expect(open.card!.top, `the card's top is on screen (got ${open.card!.top} of ${height})`).toBeGreaterThanOrEqual(0)
    expect(open.card!.bottom, "and its bottom has not left it either").toBeLessThanOrEqual(height)
    expect(open.row!.top, "the second card starts under it").toBeGreaterThanOrEqual(open.card!.bottom + 5)
    expect(open.rowScrollable, "and is not a scrollport").toBe(false)
    expect(open.tray!.top, "the hand is pushed below it, not covered").toBeGreaterThanOrEqual(open.row!.bottom + 8)

    const vw0 = await page.evaluate(() => (window as Any).__neural.cam.vw)
    await page.mouse.move(150, 300)   // the graph, well left of the centred column
    await page.mouse.wheel(0, 160)
    await expect.poll(() => page.evaluate(() => (window as Any).__neural._readS), { message: "a wheel over the graph scrolls the read" }).toBe(Math.min(160, open.M))
    expect(await page.evaluate(() => (window as Any).__neural.cam.vw), "and does not zoom the camera").toBe(vw0)
    const mid = await column(page)
    expect(mid.card!.top).toBe(open.card!.top - mid.S)
    expect(mid.row!.top).toBe(open.row!.top - mid.S)
    expect(mid.tray!.top).toBe(open.tray!.top - mid.S)

    await page.keyboard.press("Escape")
    const closed = await column(page)
    expect(closed.card).toEqual(before.card)
    expect(closed.tray).toEqual(before.tray)
    expect(closed.trayBottom).toBe("84px")
  })
}

/**
 * TAPPING A TECHNIQUE NAVIGATES TO IT (v1.132.0 — this REVERSES v1.129.1's read-in-place rule,
 * by the owner's own correction: "when you click on a transition or on a submission, you navigate
 * to it. The URL changes to it, and the landcard is standard.")
 *
 * The tap lands ON the technique: URL = its page, camera/focus = its node, the card = the
 * position card's exact anatomy (no header, no "Roll from here", folded) — while the SEAT stays
 * the technique's origin position (the engine's states are positions), staged and paused. Play
 * ran the exchange (retired with the transport in v1.134.0 — the staged card itself is the go).
 */
test("@curated tapping a technique navigates to it — URL, focus and a standard staged card", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/Positions/Side-Control/Bottom")
  await j.advance(6000)
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => document.body.getBoundingClientRect().top)
    await j.advance(400)
  }

  const target = await page.evaluate(() => {
    const a: any = (window as any).__neural
    const scale = a.W / a.cam.vw
    for (const n of a.nodes) {
      if (n.ty === "positions") continue
      const sx = (n.x - a.cam.cx) * scale + a.W / 2
      const sy = (a._LY(n) - a.cam.cy) * scale + a.H / 2
      if (sx > 120 && sx < a.W - 320 && sy > 90 && sy < a.H - 340)
        return { sx, sy, t: n.t, ty: n.ty, idx: n.idx }
    }
    return null
  })
  expect(target, "there is a technique on screen to tap").not.toBeNull()

  await page.mouse.click(target!.sx, target!.sy)
  await j.advance(2000)

  const after = await page.evaluate(() => {
    const a: any = (window as any).__neural
    const card = document.querySelector("[data-landcard]") as HTMLElement | null
    const more = document.querySelector("[data-land-more-body]") as HTMLElement | null
    return {
      url: location.pathname,
      posTy: a.nodes[a.currentPos].ty,
      paused: a.paused,
      focus: a.focusIdx >= 0 ? a.nodes[a.focusIdx] : null,
      staged: a._stagedTech ? a.nodes[a._stagedTech.idx].t : null,
      mode: card ? card.getAttribute("data-landcard") : null,
      cardAbout: a._landIdx != null && a.nodes[a._landIdx] ? a.nodes[a._landIdx].t : null,
      header: !!document.querySelector("[data-land-id]"),
      playBtn: !!document.querySelector("[data-land-play]"),
      folded: !more || more.style.display === "none",
    }
  })
  // the tap may land on either half of the technique's pair — same site, either member
  const site = (t: string) => t
  expect(after.url, "the URL follows the tapped technique").not.toBe("/Positions/Side-Control")
  expect(after.staged, "the exchange is staged on the tapped technique").toBe(site(target!.t))
  expect(after.cardAbout, "the card reads the technique").toBe(target!.t)
  expect(after.mode, "in the technique skin").toBe("attempt")
  expect(after.header, "with NO header — the graph names the focus").toBe(false)
  expect(after.playBtn, "and NO 'Roll from here' — play is the one go control").toBe(false)
  expect(after.folded, "folded, exactly like a position's card").toBe(true)
  expect(after.posTy, "the seat under it is a real position").toBe("positions")
  expect(after.paused, "staged: the clock is held until play").toBe(true)
  expect(after.focus && after.focus.t, "the graph focus IS the technique").toBe(target!.t)
})

/**
 * A MOUSE CAN DRAG THE HAND (v1.129.1). @curated
 *
 * Owner: "Seems like I'm not able to scroll the options horizontally anymore. Either dragging or
 * horizontally scrolling is not working."
 *
 * The WHEEL was fine — measured, a vertical wheel moved `scrollLeft` 0 -> 351 and a horizontal one
 * -> 675. DRAGGING never worked: 0 -> 0 across a 600px press-and-drag, because no browser
 * drag-scrolls an `overflow-x: auto` element with a mouse. v1.123.0 built a drag for this and
 * reverted it, correctly — that one was written for TOUCH, where the browser already scrolls
 * natively, so its own mutants could not kill its test. Mouse is the case that is really broken and
 * really testable.
 */
test("@curated a mouse can drag the option row, and a drag is not a pick", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Side Control Top")
  await j.advance(1200)

  const t = await page.evaluate(() => {
    const a: any = (window as any).__neural
    const r = a.optionsRef.current
    const b = r.getBoundingClientRect()
    return {
      left: r.scrollLeft,
      overflow: r.scrollWidth - r.clientWidth,
      cy: (b.top + b.bottom) / 2,
      pos: a.nodes[a.currentPos].t,
      moves: a.moveCount,
    }
  })
  expect(t.overflow, "this hand really does overflow the tray").toBeGreaterThan(200)
  expect(t.left, "and starts at the left").toBe(0)

  await page.mouse.move(1000, t.cy)
  await page.mouse.down()
  for (let x = 1000; x >= 400; x -= 60) {
    await page.mouse.move(x, t.cy)
    await j.advance(16)
  }
  await page.mouse.up()
  await j.advance(300)

  const after = await page.evaluate(() => {
    const a: any = (window as any).__neural
    return {
      left: a.optionsRef.current.scrollLeft,
      pos: a.nodes[a.currentPos].t,
      moves: a.moveCount,
    }
  })
  expect(after.left, `the drag scrolled the hand (0 -> ${Math.round(after.left)})`).toBeGreaterThan(200)
  // A DRAG IS NOT A PICK. Without the capture-phase click suppressor every drag that ended over a
  // card would COMMIT that move — worse than not being able to scroll at all.
  expect(after.pos, "and committed nothing").toBe(t.pos)
  expect(after.moves, "no move was spent").toBe(t.moves)
})

/**
 * THE BACKGROUND LADDER (v1.134.0, owner). The v1.129.5 stand-down/restore latch pair is gone —
 * "clicking once on the bg of the graph will close the card, clicking it again will deselect
 * and zoom out a little." Click 1: the card CLOSES (question declined, free) and the hand
 * stays. Click 2: FREE ROAM — tray cleared, camera pulled back on where you stood. A node
 * click from roam stages fresh, exactly like roam-and-stage always did.
 */
test("@curated background taps: close the card, then free roam — and a node click stages fresh", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/Positions/Side-Control/Bottom")
  await j.advance(6000)
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => document.body.getBoundingClientRect().top)
    await j.advance(400)
  }
  expect(
    await page.evaluate(() => !!(window as any).__neural._landEl),
    "the card is up to begin with",
  ).toBe(true)

  // Drive real pointer input: calling stageRollAt directly bypasses the same-node
  // shortcut in attachInput/openDossier, which was the broken route after free roam.
  const clickBackground = async () => {
    const point = await page.evaluate(() => {
      const a: any = (window as any).__neural
      for (let y = 100; y < a.H - 100; y += 40) {
        for (let x = 100; x < a.W - 100; x += 40) {
          const hit = document.elementFromPoint(x, y)
          if (hit !== a.canvas && hit !== a.wrapRef.current) continue
          a._updateHover({ clientX: x, clientY: y })
          if (!a._hover) return { x, y }
        }
      }
      return null
    })
    expect(point, "an unobstructed empty point on the graph").not.toBeNull()
    await page.mouse.click(point!.x, point!.y)
  }
  const clickCurrentNode = async () => {
    const point = await page.evaluate(() => {
      const a: any = (window as any).__neural
      const n = a.nodes[a.currentPos]
      const rect = a.canvas.getBoundingClientRect()
      const scale = a.W / a.cam.vw
      const x = rect.left + (n.x - a.cam.cx) * scale + a.W / 2
      const y = rect.top + (a._LY(n) - a.cam.cy) * scale + a.H / 2
      const hit = document.elementFromPoint(x, y)
      return { x, y, reachable: hit === a.canvas || hit === a.wrapRef.current }
    })
    expect(point.reachable, "the current node is reachable by mouse").toBe(true)
    await page.mouse.click(point.x, point.y)
  }

  // tap 1: the card closes, the hand stays
  await clickBackground()
  await j.advance(300)
  const after1 = await page.evaluate(() => {
    const a: any = (window as any).__neural
    return { card: !!a._landEl, tray: (a.optionIdxs || []).length, beats: (a.beats || []).slice(-3).map((b: any) => b.beat), roam: !!a._roam }
  })
  expect(after1.card, "the card closed").toBe(false)
  expect(after1.tray, "the hand survived").toBeGreaterThan(0)
  expect(after1.beats, "the dismissal is named").toContain("land_dismissed")
  expect(after1.roam).toBe(false)

  // Returning after just a dismissal restores the card without ending the hand.
  const hand = await page.evaluate(() => (window as any).__neural.optionIdxs.slice())
  await clickCurrentNode()
  await expect(page.locator("[data-landcard]")).toBeVisible()
  expect(await page.evaluate(() => (window as any).__neural.optionIdxs)).toEqual(hand)
  await clickBackground()

  // tap 2: free roam — tray gone, camera pulled back
  await clickBackground()
  await j.advance(300)
  const after2 = await page.evaluate(() => {
    const a: any = (window as any).__neural
    return { roam: !!a._roam, tray: (a.optionIdxs || []).length, beats: (a.beats || []).slice(-2).map((b: any) => b.beat) }
  })
  expect(after2.roam, "free roam").toBe(true)
  expect(after2.tray, "no hand in roam").toBe(0)
  expect(after2.beats).toContain("roam_entered")

  // a node click stages fresh — the surfaces come back whole
  await clickCurrentNode()
  await j.advance(2000)
  const back = await page.evaluate(() => {
    const a: any = (window as any).__neural
    const c = document.querySelector("[data-landcard]") as HTMLElement | null
    return { roam: !!a._roam, card: !!c && getComputedStyle(c).visibility !== "hidden", tray: (a.optionIdxs || []).length }
  })
  expect(back.roam, "roam ends on a stage").toBe(false)
  expect(back.card, "the card is back").toBe(true)
  await expect(page.locator("[data-landcard]")).toBeVisible()
  expect(back.tray, "and the hand with it").toBeGreaterThan(0)
})

/**
 * THE COMMIT HANDS THE CAMERA TO THE ROLL (v1.135.1). Owner: "when I pick one of the options,
 * the camera doesn't immediately follow the signal that's pulsing … It's very bad gameplay."
 * The pick's click wrote `lastInteract`, and userActiveNow() is the one condition that
 * suppresses the follow-cam — 4 game-seconds of frozen camera while the pulse left. Committing
 * now ages the latch out and releases any focus lease (the ownership doctrine's "asking to go
 * somewhere else is a decision" case), so the follow-cam tracks the travel from frame one.
 * Mutant that must die: dropping the releaseCamera + lastInteract aging from enterAttempt.
 */
test("@curated the commit hands the camera to the roll", async ({ page }) => {
  const j = journey(page)
  await j.boot("/Positions/Side-Control/Bottom")
  await j.advance(6000)
  const res = await page.evaluate(() => {
    const a: any = (window as any).__neural
    if (!a._optList || !a._optList.length) return null
    a.holdCamera()                 // a standing lease, as a share flight would leave
    a.lastInteract = a.now         // the pick's own click, as attachInput writes it
    const activeBefore = a.userActiveNow()
    a.enterAttempt(a._optList[0])
    return { activeBefore, activeAfter: a.userActiveNow(), held: a.camHeld() }
  })
  expect(res, "a dealt hand to commit from").not.toBeNull()
  expect(res!.activeBefore, "the click really had latched activity").toBe(true)
  expect(res!.activeAfter, "the commit aged the latch — the follow-cam is free").toBe(false)
  expect(res!.held, "and the focus lease is released").toBe(false)
})
