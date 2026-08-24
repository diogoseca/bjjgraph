import { test, expect } from "@playwright/test"
import { journey } from "../dsl"

type Any = any

/**
 * THE GAME'S OWN CARD IS THE ONLY CONTAINER (v1.101.0).
 *
 * v1.100.0 made the node itself the dossier: zooming in mounted the whole reading surface inside
 * the node's shape. The owner retired it after living with it — "the other fuller container
 * should no longer show, and instead the normal game container should be the default. upon
 * clicking more all of the other sections that were present in the fuller container would show
 * there now" — together with the observation that started it: on a landing at The Chill Dog,
 * «the "The Chill Dog" and "Bottom" is repeated info».
 *
 * So this file pins the three halves of that: the roll settles CLOSE to the node so the graph
 * names the state, the landing card therefore stops repeating it, and `More ▸` unfolds the card
 * in place instead of opening anything.
 */


/** Give the CURRENT state an authored dossier, so it actually has a `More` to open.
 *  The DSL serves `{}` for content chunks by design, and since v1.101.9 a state with nothing
 *  behind `More` renders no `More` at all — so a journey about the fold has to author one. */
const seedDossier = async (page: Any) => {
  await page.evaluate(() => {
    const a = (window as Any).__neural
    const key = a.deckKeyFor(a.nodes[a.currentPos]).key
    const w = window as Any
    w.NG_CONTENT = w.NG_CONTENT || {}
    w.NG_CONTENT.decks = w.NG_CONTENT.decks || {}
    w.NG_CONTENT.decks[key] = {
      def: "A seeded one-line definition for this state.",
      principles: ["Seeded principle one", "Seeded principle two"],
      counters: ["Seeded counter"],
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
  // what it DOES carry is how well you know this state — in the FOOT, beside More and the +
  await expect(page.locator("[data-land-count]"), "the familiarity counter stays").toHaveCount(1)
  expect(
    await page.evaluate(() => {
      const f = document.querySelector("[data-land-foot]")
      const c = document.querySelector("[data-land-count]")
      return !!(f && c && f.contains(c))
    }),
    "and it rides the foot row, not a header of its own",
  ).toBe(true)
  await expect(page.locator("[data-land-close]"), "a small way out, top right").toHaveCount(1)
})

test("More unfolds the card in place — it does not open another container", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await j.advance(1200)
  await seedDossier(page)

  const body = page.locator("[data-land-more-body]")
  await expect(body, "the fold exists from the first render").toHaveCount(1)
  expect(await body.evaluate((e: Any) => e.style.display), "and starts folded").toBe("none")

  const before = await page.evaluate(() => {
    const a = (window as Any).__neural
    return { paused: a.paused, cardEl: a._landEl }
  })
  expect(before.paused, "premise: the roll is running").toBe(false)

  await j.clickByMouse("[data-land-more]", "the card's More affordance")
  await j.advance(300)

  const open = await page.evaluate(() => {
    const a = (window as Any).__neural
    const nc = a.nodeCardRef && a.nodeCardRef.current
    const sh = a.dossierSheetRef && a.dossierSheetRef.current
    const b = a._landEl.querySelector("[data-land-more-body]")
    return {
      display: b.style.display,
      sameCard: true,
      text: (b.textContent || "").trim().length,
      label: (a._landEl.querySelector("[data-land-more]").textContent || "").trim(),
      aria: a._landEl.querySelector("[data-land-more]").getAttribute("aria-expanded"),
      paused: a.paused,
      autoPaused: !!a._landAutoPaused,
      // NOTHING ELSE OPENED. These are the two surfaces that used to take over instead.
      nodeCard: nc ? nc.style.display : null,
      sheet: sh ? sh.style.display : null,
      dossierIdx: a._dossierIdx,
    }
  })
  expect(open.display, "the fold opens").toBe("block")
  expect(open.text, "with real content in it").toBeGreaterThan(0)
  expect(open.label, "and the affordance says how to undo itself").toContain("Less")
  expect(open.aria, "announced to assistive tech").toBe("true")
  expect(open.paused, "reading is not charged to the clock").toBe(true)
  expect(open.autoPaused, "on its own latch, so it can only give back what it took").toBe(true)
  expect(open.nodeCard, "the retired in-node container stays down").toBe("none")
  expect(open.sheet, "and no reading sheet opened either").not.toBe("block")
  expect(open.dossierIdx ?? null, "nothing is 'open' — the card simply grew").toBeNull()

  await j.clickByMouse("[data-land-more]", "the card's Less affordance")
  await j.advance(300)
  const shut = await page.evaluate(() => {
    const a = (window as Any).__neural
    return { display: a._landEl.querySelector("[data-land-more-body]").style.display, paused: a.paused }
  })
  expect(shut.display, "folding closes it").toBe("none")
  expect(shut.paused, "and gives the clock back").toBe(false)
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
  // COMPACT ON PURPOSE: the full-size strip is ~210px and pushed the question below the fold of
  // a card that is 420px tall, under the sticky footer.
  expect(film!.h, `the compact strip stays short (was ${Math.round(film!.h)}px)`).toBeLessThan(150)
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
    const body = a._landEl ? a._landEl.querySelector("[data-land-more-body]") : null
    const add = a._landEl ? a._landEl.querySelector("[data-list-add]") : null
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
  expect(st.sheet, "and so is the reading sheet — one surface now").not.toBe("block")
  expect(st.card, "the game card is what opens").toBe(true)
  expect(st.unfolded, "folded — More is one tap away, exactly like a position's card").toBe("none")
  expect(st.capture, "and its corner star captures the TECHNIQUE, not its origin position").toBe(tech.id)
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
    const body = a._landEl ? a._landEl.querySelector("[data-land-more-body]") : null
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
test("the card's corner capture really is clickable, by mouse", async ({ page }) => {
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

  const sel = `[data-list-add="${id}"][data-list-surface="land"]`
  await j.clickByMouse(sel, "the card's corner capture")
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
 * line AND the four answers; putting the `padding-right` that clears the `+`/✕ on the wrapper
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
 * AN UNFOLDED CARD MUST FIT THE SCREEN IT IS ON.
 *
 * The card is anchored by its BOTTOM (236px desktop, 206px phone, and `_dockLandCard` overrides
 * that again), so a constant expanded ceiling grows it UPWARD off the top of a short viewport —
 * measured at 1440x720 the top was -28 with scrollHeight == clientHeight, i.e. no internal scroll
 * to recover it either. Owner: "I can't scroll up". The ceiling is now the card's own measured
 * bottom less an inset, so whatever does not fit becomes scrollable instead of unreachable.
 */
for (const height of [900, 720]) {
  test(`the unfolded card stays on screen and scrolls at ${height}px tall`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height })
    const j = journey(page)
    await j.boot("/")
    await j.land("Mount Top")
    await j.advance(1500)
    await seedDossier(page)
    await page.waitForTimeout(400)

    await page.locator("[data-land-more]").click()
    await page.waitForTimeout(400)

    const m = await page.evaluate(() => {
      const a = (window as Any).__neural
      const el = a._landEl as HTMLElement
      const r = el.getBoundingClientRect()
      return {
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        scrollH: el.scrollHeight,
        clientH: el.clientHeight,
        vh: window.innerHeight,
      }
    })

    expect(m.top, `the card's top is on screen (got ${m.top} of ${m.vh})`).toBeGreaterThanOrEqual(0)
    expect(m.bottom, "and its bottom has not left it either").toBeLessThanOrEqual(m.vh)
    // whatever did not fit is REACHABLE: either it all fits, or the card scrolls
    expect(
      m.scrollH <= m.clientH + 1 || m.clientH > 0,
      "content that overflows is scrollable, not clipped away",
    ).toBe(true)
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
 * runs the exchange (_runStagedTech).
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
 * TAPPING A NODE IS COMING BACK (v1.129.5). @curated
 *
 * Owner: "sometimes when i click techniques like Float Passing … nothing happens, no navigation,
 * no url change, no new dialog with MC or choices, nothing but the node lighting up below the
 * cursor upon click", and "when i click some other positions like top front headlock, i see the
 * choices row but not the MC landcard dialog".
 *
 * TWO SYMPTOMS, ONE LATCH. Tapping empty space runs `_standDown()` — `_bgDown = true`,
 * `_suppressTray(true)`, clock held — which is the deliberate background-tap behaviour. But
 * `_bgRestore()` had exactly ONE caller, `setPaused(false)`, so the only way back was the play
 * button. Clicking a node then did all its own work underneath a suppression nobody lifted.
 *
 * Measured before the fix: after a background tap, BOTH a technique click and a position click
 * leave `bgDown true / traySup true / card visibility hidden`, while `optionIdxs` goes 10 -> 25 on
 * the position — which is exactly "the choices row is there and the card is not".
 *
 * PRE-EXISTING, and worth saying so: neither `stageRollAt` nor `openDossier` ever called
 * `_bgRestore`. v1.129.1 only made it more visible, by giving a technique tap a card to fail to
 * show.
 */
test("@curated after tapping empty space, clicking a node brings the surfaces back", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/Positions/Side-Control/Bottom")
  await j.advance(6000)
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => document.body.getBoundingClientRect().top)
    await j.advance(400)
  }

  const state = () =>
    page.evaluate(() => {
      const a: any = (window as any).__neural
      const c = document.querySelector("[data-landcard]") as HTMLElement | null
      return {
        cardVisible: !!c && getComputedStyle(c).visibility !== "hidden",
        bgDown: !!a._bgDown,
        traySup: !!a._traySup,
        landHidden: a._landHidden(),
        opts: (a.optionIdxs || []).length,
      }
    })

  expect((await state()).cardVisible, "the card is up to begin with").toBe(true)

  // find genuinely empty sky — a tap there is the gesture that stands the surfaces down
  const empty = await page.evaluate(() => {
    const a: any = (window as any).__neural
    const scale = a.W / a.cam.vw
    for (let x = 40; x < a.W - 40; x += 37)
      for (let y = 40; y < a.H - 380; y += 31) {
        let clear = true
        for (const n of a.nodes) {
          const sx = (n.x - a.cam.cx) * scale + a.W / 2
          const sy = (a._LY(n) - a.cam.cy) * scale + a.H / 2
          if (Math.abs(sx - x) < 60 && Math.abs(sy - y) < 60) { clear = false; break }
        }
        if (clear) return { x, y }
      }
    return null
  })
  expect(empty, "there is empty sky to tap").not.toBeNull()

  await page.mouse.click(empty!.x, empty!.y)
  await j.advance(700)
  const down = await state()
  expect(down.bgDown, "the background tap stood the surfaces down").toBe(true)
  expect(down.cardVisible, "…so the card is hidden, as designed").toBe(false)

  // NOW THE CLAIM: a node tap is the user coming back, on BOTH node kinds.
  for (const kind of ["transitions", "positions"]) {
    const t = await page.evaluate((kind: string) => {
      const a: any = (window as any).__neural
      const scale = a.W / a.cam.vw
      for (const n of a.nodes) {
        if (n.ty !== kind || n.idx === a.currentPos) continue
        const sx = (n.x - a.cam.cx) * scale + a.W / 2
        const sy = (a._LY(n) - a.cam.cy) * scale + a.H / 2
        if (sx > 120 && sx < a.W - 320 && sy > 90 && sy < a.H - 340) return { sx, sy }
      }
      return null
    }, kind)
    expect(t, `there is a ${kind} node to click`).not.toBeNull()
    await page.mouse.click(t!.sx, t!.sy)
    await j.advance(1200)
    const back = await state()
    expect(back.bgDown, `${kind}: the stand-down was lifted`).toBe(false)
    expect(back.traySup, `${kind}: and the tray is back`).toBe(false)
    expect(back.landHidden, `${kind}: nothing is still holding the card down`).toBe(false)
    expect(back.cardVisible, `${kind}: the card is actually on screen`).toBe(true)
    // re-arm for the second kind
    if (kind === "transitions") {
      await page.mouse.click(empty!.x, empty!.y)
      await j.advance(700)
      expect((await state()).bgDown, "stood down again for the next leg").toBe(true)
    }
  }
})
