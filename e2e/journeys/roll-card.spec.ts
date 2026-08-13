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

  // ...and it is big enough to carry its own name, which is what licenses the card to drop it
  expect(m.rPx, "the node is drawn large enough to read into").toBeGreaterThan(20)
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

test("a node you are NOT standing on opens the reading sheet, never the node", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await j.advance(1200)

  const other = await page.evaluate(() => {
    const a = (window as Any).__neural
    const n = a.nodes.find((x: Any) => x.idx !== a.currentPos && x.ty === "transitions")
    a.openDossier(n.idx)
    return n.idx
  })
  await j.advance(900)

  const st = await page.evaluate(() => {
    const a = (window as Any).__neural
    const nc = a.nodeCardRef && a.nodeCardRef.current
    const sh = a.dossierSheetRef && a.dossierSheetRef.current
    return {
      nodeCard: nc ? nc.style.display : null,
      sheet: sh ? sh.style.display : null,
      sheetText: sh ? (sh.textContent || "").trim().length : 0,
      question: !!document.querySelector("[data-node-q]"),
      dossierIdx: a._dossierIdx ?? null,
      zoom: a.cam.vw / a.graphW,
    }
  })
  expect(st.nodeCard, "the in-node container is gone for good").toBe("none")
  expect(st.sheet, "the reading sheet is what opens").toBe("block")
  expect(st.sheetText, "and it has the node's dossier in it").toBeGreaterThan(0)
  expect(st.question, "including the state's own question — no longer mobile-only").toBe(true)
  expect(st.dossierIdx, "it knows which node it is reading").toBe(other)
  // flown TO the node, not INTO it: the old path drove the camera to graphW*0.0085
  expect(st.zoom, "the camera stops at reading distance, not inside the node").toBeGreaterThan(0.02)

  // Esc puts it away and gives the clock back
  await page.keyboard.press("Escape")
  await j.advance(600)
  const after = await page.evaluate(() => {
    const a = (window as Any).__neural
    const sh = a.dossierSheetRef.current
    return { transform: sh.style.transform, idx: a._dossierIdx, paused: a.paused }
  })
  expect(after.idx, "nothing is being read any more").toBeNull()
  expect(after.transform, "the sheet slid away").toContain("-102%")
  expect(after.paused, "and the roll resumes").toBe(false)
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
test("the reading sheet's capture row really is clickable, by mouse", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  const id = await page.evaluate(() => {
    const a = (window as Any).__neural
    const n = a.nodes.find((x: Any) => x.idx !== a.currentPos && (x.ty === "transitions" || x.ty === "submissions"))
    // EXACTLY one list, so a capture is one tap and not the destination picker (which is what
    // `captureNode` shows at two or more) — earlier journeys in this file may have left their own
    a.lists = {}
    a.newList()
    a.openDossier(n.idx)
    return n.id
  })

  const sel = `[data-list-add="${id}"][data-list-surface="dossier"]`
  // the sheet slides in on a REAL-time CSS transition; wait for it to be where a mouse can reach
  for (let i = 0; i < 30; i++) {
    await j.advance(400)
    const b = await page.locator(sel).boundingBox().catch(() => null)
    if (b && b.x >= 0 && b.y >= 0 && b.x + b.width <= 1440 && b.y + b.height <= 900) break
  }

  await j.clickByMouse(sel, "the sheet's add-to-class row")
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
