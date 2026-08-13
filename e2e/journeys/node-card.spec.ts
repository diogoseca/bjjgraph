import { test, expect } from "@playwright/test"
import { journey } from "../dsl"

/**
 * THE IN-NODE CARD IS THE STUDY SURFACE — v1.100.0.
 *
 * On desktop the dossier is not a panel: `openDossier` flies the camera all the way in and
 * `updateNodeCard` renders the dossier INTO the node's own shape. The dialog and the zoom are one
 * thing. This spec pins what that surface owes a reader once they are standing in front of it:
 *
 *   1. an unclipped HEADER above the shape — name, side, and the familiarity counter — so the
 *      diamond's and the triangle's geometry can never truncate the one line that says what you
 *      are looking at;
 *   2. the state's QUESTION, in the node's own format, on the same stage ladder every other
 *      surface uses (multiple choice below stage 2, recall at stage 2+);
 *   3. an ECONOMY that is study-only: card credit, and none of the roll's bonuses. There is no
 *      clock behind this card — it opened by pausing the game — so a refund, a combo tick or an
 *      odds shift here would be paying a decision that is not being taken;
 *   4. a way OUT from every entry point and at any zoom: the ✕, a click on empty canvas, Esc —
 *      and a PAN, which is not a click and must never dismiss what the reader is reading.
 *
 * Rails: __neural.openDossier / closeNodeDossier / _nodeCardOn / _nodeCardO / _nodeQ /
 *        nodeSettled() / _dossierIdx / _dossierAutoPaused
 * Beats: node_q_shown, node_q_answered, node_q_skipped
 */

type Any = any

/** A node of type `ty` (elsewhere on the graph) whose deck the manifest says has cards. */
const deckNode = (page: Any, ty = "positions") =>
  page.evaluate((want: string) => {
    const a = (window as Any).__neural
    const decks = (a.flashcards && a.flashcards.decks) || {}
    for (const n of a.nodes) {
      if (n.ty !== want || n.idx === a.currentPos) continue
      const key = a.deckKeyFor(n).key
      const d = decks[key]
      if (d && (a._deckCardCount(d) || 0) >= 3) return { idx: n.idx, key: key, t: n.t }
    }
    return null
  }, ty)

/** Open the in-node card and pump until the flight has landed and its question has settled. */
const openNodeCard = async (j: Any, page: Any, idx: number) => {
  await page.evaluate((i: number) => (window as Any).__neural.openDossier(i), idx)
  for (let i = 0; i < 60; i++) {
    const o = await page.evaluate(() => (window as Any).__neural._nodeCardO || 0)
    if (o >= 0.999) break
    await j.advance(300)
  }
  await page.evaluate(async () => {
    const a = (window as Any).__neural
    if (typeof a.nodeSettled === "function") await a.nodeSettled()
  })
  await j.advance(100)
}

const cardOpen = (page: Any) =>
  page.evaluate(() => {
    const a = (window as Any).__neural
    return { on: !!a._nodeCardOn, dossier: a._dossierIdx, o: a._nodeCardO || 0 }
  })

// ───────────────────────────────── 1 · the question ─────────────────────────────────

test("the in-node card asks this state's question, inside the node's own shape", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  const target = await deckNode(page)
  expect(target, "a position elsewhere on the graph with an authored deck").not.toBeNull()

  await openNodeCard(j, page, target.idx)

  const q = page.locator("[data-node-q]")
  await expect(q, "the node card carries a question section").toHaveCount(1)
  expect(
    (await q.textContent()) || "",
    "and the section is not an empty shell",
  ).not.toHaveLength(0)

  const opts = page.locator("[data-node-mc-opt]")
  expect(
    await opts.count(),
    "an unproven card is met as multiple choice, like every other first meeting",
  ).toBeGreaterThanOrEqual(3)

  await j.expectBeat("node_q_shown")

  // the question belongs to THIS node's deck, not the state we are rolling in
  expect(
    await page.evaluate(() => {
      const a = (window as Any).__neural
      return a._nodeQ ? a._nodeQ.key : null
    }),
    "the question is drawn from the node being read",
  ).toBe(target.key)
})

test("the node question follows the stage ladder: recall once a card is past recognition", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  const target = await deckNode(page)
  await j.hydrate([target.key])

  // grade every card in this deck to stage 2 — the recall gate MC can never pass
  await page.evaluate((key: string) => {
    const a = (window as Any).__neural
    const cards = a._cardsOf(a.flashcards.decks[key]) || []
    a.stage[key] = a.stage[key] || {}
    for (const c of cards) a.stage[key][a.qhash(c.q)] = 2
  }, target.key)

  await openNodeCard(j, page, target.idx)

  await expect(
    page.locator("[data-node-recall]"),
    "a card at stage 2 is asked by recall, not recognition",
  ).toHaveCount(1)
  await expect(
    page.locator("[data-node-mc-opt]"),
    "and no multiple-choice options are offered for it",
  ).toHaveCount(0)
  expect(
    await page.evaluate(() => {
      const a = (window as Any).__neural
      return a._nodeQ ? a._nodeQ.format : null
    }),
    "the card names its own format",
  ).toBe("recall")
})

// ───────────────────────────────── 2 · the economy ─────────────────────────────────

test("answering in the node card mints card credit and none of the roll's bonuses", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  const target = await deckNode(page)
  await j.hydrate([target.key])
  await openNodeCard(j, page, target.idx)

  const before = await page.evaluate(() => {
    const a = (window as Any).__neural
    return {
      combo: a._combo || 0,
      qMod: a._qMod || 0,
      remaining: a._decision ? a._decision.remaining : null,
      stage: a._nodeQ ? a.cardStage(a._nodeQ.key, a._nodeQ.card.q) : null,
      prep: (a.prep || {})[a._nodeQ ? a._nodeQ.key : ""] || 0,
      landPending: !!a._landPending,
    }
  })
  expect(before.stage, "the card starts unproven").toBe(0)

  // answer it correctly, through the block's own truth
  await page.evaluate(() => {
    const a = (window as Any).__neural
    const mc = a._mc
    mc.answer(mc.correct)
  })

  const after = await page.evaluate(() => {
    const a = (window as Any).__neural
    return {
      combo: a._combo || 0,
      qMod: a._qMod || 0,
      remaining: a._decision ? a._decision.remaining : null,
      stage: a._nodeQ ? a.cardStage(a._nodeQ.key, a._nodeQ.card.q) : null,
      prep: (a.prep || {})[a._nodeQ ? a._nodeQ.key : ""] || 0,
      landPending: !!a._landPending,
      refunds: (a.beats || []).filter((b: any) => b.beat === "timer_refund").length,
      combos: (a.beats || []).filter((b: any) => b.beat === "combo").length,
    }
  })

  expect(after.stage, "the card gains a stage — this is ordinary card credit").toBe(
    before.stage + 1,
  )
  expect(after.prep, "and the deck's answered count moves").toBe(before.prep + 1)
  expect(after.combo, "but no combo tick: momentum is a roll mechanic").toBe(before.combo)
  expect(after.combos, "and no combo beat was emitted").toBe(0)
  expect(after.qMod, "no odds shift: there is no exchange under this card").toBe(before.qMod)
  expect(after.remaining, "and no clock refund: the clock is not running").toBe(
    before.remaining,
  )
  expect(after.refunds, "no refund was even attempted").toBe(0)
  expect(after.landPending, "the landing question's own state is untouched").toBe(
    before.landPending,
  )
  await j.expectBeat("node_q_answered")
})

test("a scored node question is never re-mounted under the reader", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  const target = await deckNode(page)
  await j.hydrate([target.key])
  await openNodeCard(j, page, target.idx)

  await page.evaluate(() => {
    const a = (window as Any).__neural
    a._mc.answer(a._mc.correct)
  })
  const shownAfterAnswer = await page.evaluate(
    () =>
      ((window as Any).__neural.beats || []).filter(
        (b: any) => b.beat === "mc_shown",
      ).length,
  )
  const markedBefore = await page.locator("[data-node-mc-opt][data-mc-result]").count()
  expect(markedBefore, "the answered block shows its result").toBeGreaterThan(0)

  // a late payload arriving is exactly the event that used to rebuild a surface underneath a reader
  await page.evaluate(() => {
    const a = (window as Any).__neural
    a.onFlashcardsReady && a.onFlashcardsReady()
    a.onContentReady && a.onContentReady()
  })
  await j.advance(600)

  expect(
    await page.evaluate(
      () =>
        ((window as Any).__neural.beats || []).filter(
          (b: any) => b.beat === "mc_shown",
        ).length,
    ),
    "no second block was mounted for a question already scored",
  ).toBe(shownAfterAnswer)
  expect(
    await page.locator("[data-node-mc-opt][data-mc-result]").count(),
    "and the graded options are still on screen",
  ).toBe(markedBefore)
  expect(
    await page.evaluate(() => {
      const a = (window as Any).__neural
      return !!(a._nodeQ && a._nodeQ.answered)
    }),
  ).toBe(true)
})

// ───────────────────────────────── 3 · the header ─────────────────────────────────

test("the node card names the state above the shape, with the familiarity counter", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  const target = await deckNode(page)
  await j.hydrate([target.key])
  await openNodeCard(j, page, target.idx)

  const head = page.locator("[data-node-head]")
  await expect(head, "there is one header block").toHaveCount(1)

  // the title lives in the header, OUTSIDE the clipped shape — a diamond's point cannot cut it
  const geometry = await page.evaluate(() => {
    const a = (window as Any).__neural
    const card = a.nodeCardRef.current
    const head = card.querySelector("[data-node-head]")
    const title = card.querySelector("[data-dossier-title]")
    const hit = card.querySelector(".ndHit")
    return {
      titleInHead: !!(head && title && head.contains(title)),
      titleInClip: !!(hit && title && hit.contains(title)),
      title: title ? (title.textContent || "").trim() : null,
    }
  })
  expect(geometry.titleInHead, "the title is in the header").toBe(true)
  expect(geometry.titleInClip, "and NOT inside the clipped shape").toBe(false)
  expect(geometry.title, "the header names the state").toBeTruthy()

  const count = page.locator("[data-node-count]")
  await expect(count, "the familiarity counter is on the card").toHaveCount(1)
  expect(
    ((await count.textContent()) || "").replace(/\s+/g, ""),
    "the seen-glyph fused with the deck's proven count",
  ).toMatch(/^[○◐●]\d+\/\d+$/)

  // and the side being played is named exactly once, in the label
  await expect(
    page.locator("[data-node-head] [data-dossier-badge]"),
    "the role rides the label beside the name",
  ).toHaveCount(1)
})

/**
 * THE LABEL IS A LABEL. The owner's words on the first build of this header: "It shouldn't be
 * this rectangle dialog above the node. It should rather be like the title showing up as a
 * label... Not a fucking box looming over it." So the block above the shape carries the two
 * things a label owes you — TITLE and ROLE — with no card chrome behind them, and every control
 * that used to ride it (the counter, the ✕, capture) moved INSIDE the node. This test is the
 * difference between those two designs: it fails on a plate, and it fails if a control drifts
 * back out onto the label.
 */
test("the block above the node is a label, not a card — and holds no controls", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  const target = await deckNode(page)
  await j.hydrate([target.key])
  await openNodeCard(j, page, target.idx)

  const label = await page.evaluate(() => {
    const a = (window as Any).__neural
    const card = a.nodeCardRef.current
    const head = card.querySelector("[data-node-head]")
    const hit = card.querySelector(".ndHit")
    const cs = getComputedStyle(head)
    const inside = (sel: string) => {
      const el = card.querySelector(sel)
      return { onCard: !!el, inHit: !!(el && hit && hit.contains(el)), inHead: !!(el && head.contains(el)) }
    }
    return {
      // a plate is a fill + a border + a shadow; a label is none of the three
      bg: cs.backgroundColor,
      bgImage: cs.backgroundImage,
      borderTop: cs.borderTopWidth,
      borderLeft: cs.borderLeftWidth,
      shadow: cs.boxShadow,
      // ...and it is lifted off the canvas by type, not by a box
      textShadow: cs.textShadow,
      pointerEvents: cs.pointerEvents,
      buttonsInHead: head.querySelectorAll("button,a,[role=button]").length,
      close: inside("[data-node-close]"),
      count: inside("[data-node-count]"),
      capture: inside(".dsList"),
    }
  })

  const transparent = (c: string) => /rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)/.test(c) || c === "transparent"
  expect(transparent(label.bg), `no fill behind the title (got ${label.bg})`).toBe(true)
  expect(label.bgImage, "no gradient plate either").toBe("none")
  expect(label.borderTop, "no border").toBe("0px")
  expect(label.borderLeft, "no border").toBe("0px")
  expect(label.shadow, "no drop shadow — that is what made it a box").toBe("none")
  expect(label.textShadow, "legibility comes from the type, like the canvas labels").not.toBe("none")

  // NOTHING PRESSABLE ON THE LABEL. It is a wide transparent block over the canvas; arming it
  // would eat pans and node clicks aimed past the top of the shape.
  expect(label.pointerEvents, "the label never takes a pointer").toBe("none")
  expect(label.buttonsInHead, "and carries no controls at all").toBe(0)

  // every control the plate used to carry now lives in the node's own shape
  expect(label.close, "the ✕ is inside the node").toEqual({ onCard: true, inHit: true, inHead: false })
  expect(label.count, "so is the familiarity counter").toEqual({ onCard: true, inHit: true, inHead: false })
  expect(label.capture, "so is the capture button").toEqual({ onCard: true, inHit: true, inHead: false })

  // and it is still the way out, by mouse, from where it now sits
  await j.clickByMouse("[data-node-close]", "the ✕ inside the node")
  await j.advance(400)
  expect((await cardOpen(page)).on, "the ✕ inside the shape still closes the card").toBe(false)
})

/**
 * A SUPPRESSED LANDING CARD MUST BE INERT, NOT MERELY TRANSPARENT. `_suppressLand` set opacity 0
 * and pointer-events:none on the ROOT — but pointer-events is inherited, and `[data-land-foot]`
 * re-enables it inline on purpose (it holds `More ▸` and the capture +). Hit-testing ignores
 * opacity, so the "hidden" card kept a fully INVISIBLE sticky footer strip live across its box,
 * and whatever the node card put under it was dead to the mouse — measured with elementFromPoint
 * returning `<div data-land-foot="1">` at the centre of the in-node capture button. The card is
 * centred on its node, so which controls land in that band is a function of where the node sits;
 * this pins the rule instead of one node's geometry.
 */
test("nothing invisible eats a click on the in-node card", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  // the same node the share-lists coach journey captures from — its card lands squarely in the
  // landing card's footer band at 1440x900
  const id = await page.evaluate(() => {
    const a = (window as Any).__neural
    const usable = a.nodes
      .filter((x: Any) => typeof x.o === "number" && (x.ty === "transitions" || x.ty === "submissions"))
      .sort((p: Any, q: Any) => p.o - q.o)
    return usable[Math.max(1, Math.floor(usable.length / 2))].id
  })
  await page.evaluate((nid: string) => {
    const a = (window as Any).__neural
    a.openDossier(a._idIndex.get(nid))
  }, id)
  for (let i = 0; i < 30; i++) {
    await j.advance(400)
    if ((await cardOpen(page)).on && (await page.locator(".dsList").count())) break
  }

  const state = await page.evaluate(() => {
    const a = (window as Any).__neural
    const le = a._landEl
    const cs = le ? getComputedStyle(le) : null
    const btn = document.querySelector('.dsList[data-list-surface="dossier"]') as HTMLElement
    const b = btn ? btn.getBoundingClientRect() : null
    const at = b ? document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2) : null
    return {
      landVisibility: cs ? cs.visibility : null,
      landOpacity: cs ? cs.opacity : null,
      // is the thing under the mouse the capture button (or part of it)?
      hitIsButton: !!(at && btn && (at === btn || btn.contains(at))),
      hitLandFoot: !!(at && (at as HTMLElement).closest && (at as HTMLElement).closest("[data-land-foot]")),
    }
  })

  expect(Number(state.landOpacity), "the landing card is out of the way").toBeLessThan(0.05)
  expect(
    state.landVisibility,
    "and it is INERT, not just transparent — opacity alone leaves it hit-testable",
  ).toBe("hidden")
  expect(state.hitLandFoot, "its footer is not lurking over the node card").toBe(false)
  expect(state.hitIsButton, "the capture button is what the mouse finds at its own centre").toBe(true)

  // ...and the click really lands, by real mouse, with no scrolling and no ancestor interception
  await j.clickByMouse('.dsList[data-list-surface="dossier"]', "the in-node capture button")
  await j.expectBeat("list_item_added")
})

test("a state with nothing left to ask says so instead of showing an empty section", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  const target = await deckNode(page)
  await j.hydrate([target.key])
  // every card recall-proven: the deck genuinely owes this reader nothing
  await page.evaluate((key: string) => {
    const a = (window as Any).__neural
    const cards = a._cardsOf(a.flashcards.decks[key]) || []
    a.stage[key] = a.stage[key] || {}
    for (const c of cards) a.stage[key][a.qhash(c.q)] = 3
  }, target.key)

  await openNodeCard(j, page, target.idx)
  const empty = page.locator('[data-node-q-empty="deck_proven"]')
  await expect(empty, "the card names the gap rather than leaving a hole").toHaveCount(1)
  expect((await empty.textContent()) || "").not.toHaveLength(0)
  await expect(page.locator("[data-node-mc-opt]")).toHaveCount(0)
  await expect(page.locator("[data-node-recall]")).toHaveCount(0)
  await j.expectBeat("node_q_skipped")

  // and the counter agrees with the sentence: nothing is a mystery on this card
  expect(
    ((await page.locator("[data-node-count]").textContent()) || "").replace(/\s+/g, ""),
  ).toMatch(/^[○◐●]\d+\/\d+$/)
})

/**
 * THE CLIP IS THE HARD PART. A circle is forgiving; a diamond narrows to a point at the top and
 * bottom, and a triangle has almost no width where a headline would sit. That geometry is why the
 * header moved OUT of the shape — and it is why the card's scale is capped to fit: the plate
 * reaches above the node, so the object is taller than its box and a triangle at deep zoom used to
 * push its own title off the top of the screen. Screenshots are written for each shape.
 */
test("every node shape carries the header, the film and the question inside the viewport", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  for (const [ty, shape] of [
    ["positions", "circle"],
    ["transitions", "diamond"],
    ["submissions", "triangle"],
  ] as const) {
    const target = await deckNode(page, ty)
    expect(target, `a ${ty} node with an authored deck`).not.toBeNull()
    await j.hydrate([target.key])
    await openNodeCard(j, page, target.idx)

    const geom = await page.evaluate(() => {
      const a = (window as Any).__neural
      const card = a.nodeCardRef.current
      const r = (sel: string) => {
        const el = card.querySelector(sel)
        return el ? el.getBoundingClientRect().toJSON() : null
      }
      return {
        head: r("[data-node-head]"),
        q: r("[data-node-q]"),
        vw: window.innerWidth,
        vh: window.innerHeight,
        answerable: card.querySelectorAll("[data-node-mc-opt],[data-node-recall]").length,
        empty: (() => {
          const e = card.querySelector("[data-node-q-empty]")
          return e ? { reason: e.getAttribute("data-node-q-empty"), txt: (e.textContent || "").trim() } : null
        })(),
        // the landing card is root-plane z:5 and paints OVER the in-node card — measured squarely
        // across the middle of every shape, which is where the question lives
        landOpacity: a._landEl ? getComputedStyle(a._landEl).opacity : null,
        // the tray fades on a .25s transition, so its COMPUTED value is time-dependent and would
        // make this assertion a stopwatch; the inline declaration is the decision being asserted
        trayOpacity: a.optionsRef.current ? a.optionsRef.current.style.opacity : null,
      }
    })

    expect(geom.head, `${shape}: the header plate exists`).not.toBeNull()
    expect(
      geom.head.top,
      `${shape}: the header is not pushed off the top of the ${geom.vh}px viewport`,
    ).toBeGreaterThanOrEqual(0)
    expect(geom.head.bottom, `${shape}: ...nor off the bottom`).toBeLessThanOrEqual(geom.vh)
    expect(geom.head.left, `${shape}: nor off the left`).toBeGreaterThanOrEqual(0)
    expect(geom.head.right, `${shape}: nor off the right`).toBeLessThanOrEqual(geom.vw)
    expect(geom.q, `${shape}: the question section exists`).not.toBeNull()
    expect(
      geom.q.top,
      `${shape}: the question sits below the header — title+role, film, then the question`,
    ).toBeGreaterThan(geom.head.bottom)
    // NEVER A SILENT SECTION. Either the state asks — in place, in the shape — or it says in
    // words why it cannot (the deck is proven, unauthored, still arriving, or this particular
    // card cannot be turned into options). An empty box inside a node is a reader's dead end.
    expect(
      geom.answerable > 0 || !!(geom.empty && geom.empty.txt),
      `${shape}: the question section either asks or explains itself (reason ${JSON.stringify(geom.empty)})`,
    ).toBe(true)

    // NOTHING PAINTS OVER THE CARD. The tray was already faded for this reason; the landing card
    // belongs to the roll the dossier just paused and must go with it — and it must go for real:
    // its entry animation outranks a plain inline opacity, so a computed value is the only honest
    // check (measured 0.99 with an inline "0" before the fix).
    expect(
      Number(geom.landOpacity),
      `${shape}: the landing card does not cover the node card (computed ${geom.landOpacity})`,
    ).toBeLessThan(0.05)
    expect(
      geom.trayOpacity,
      `${shape}: nor does the options tray`,
    ).toBe("0.1")

    await page.screenshot({
      path: `tests/artifacts/chrome/node-card-${shape}.png`,
      clip: { x: 0, y: 0, width: geom.vw, height: geom.vh },
    })
    await page.evaluate(() => (window as Any).__neural.closeNodeDossier())
    await j.advance(1600)
  }
})

/**
 * THE READ ORDER THE OWNER ASKED FOR: "some text above the current node like Title and role …
 * and then the YouTube videos row right after it, and then the MC section inside the actual node".
 *
 * The harness aborts the dossier payload (20MB no journey needs), so the film row is absent in
 * every other test here — which means nothing else in this file can speak for the ORDER. The
 * content is injected directly, the way share-lists builds a full-height landing card.
 */
test("title and role sit above the node, the film row follows, then the question", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  const target = await deckNode(page)
  await j.hydrate([target.key])
  await page.evaluate((key: string) => {
    const w = window as Any
    w.NG_CONTENT = w.NG_CONTENT || { decks: {} }
    w.NG_CONTENT.decks[key] = {
      def: "A dominant position where the hips ride high and the chest stays low.",
      clips: [
        { id: "aaaaaaaaaaa", title: "Control fundamentals", by: "Legend", vertical: true },
        { id: "bbbbbbbbbbb", title: "Staying heavy", by: "Legend", vertical: true },
      ],
    }
  }, target.key)

  await openNodeCard(j, page, target.idx)

  const order = await page.evaluate(() => {
    const a = (window as Any).__neural
    const card = a.nodeCardRef.current
    const box = (sel: string) => {
      const el = card.querySelector(sel)
      return el ? el.getBoundingClientRect().toJSON() : null
    }
    return {
      head: box("[data-node-head]"),
      title: box("[data-dossier-title]"),
      film: box('a[href*="youtube.com"]'),
      q: box("[data-node-q]"),
      films: card.querySelectorAll('a[href*="youtube.com"]').length,
    }
  })

  expect(order.film, "the film row is on the card").not.toBeNull()
  expect(order.films, "both clips render").toBe(2)
  expect(
    order.title.bottom,
    "the title is above the node's shape, in the plate",
  ).toBeLessThanOrEqual(order.head.bottom)
  expect(
    order.film.top,
    "the film row comes after the header",
  ).toBeGreaterThanOrEqual(order.head.bottom)
  expect(
    order.q.top,
    "and the question comes after the film",
  ).toBeGreaterThanOrEqual(order.film.bottom)
})

/**
 * THE PHONE. openDossier forks on isMobile(): a phone reads a node in the 70%-tall sheet, not in
 * the node. Deliberate — the in-node card is 700-780 CSS px of shape and the fit cap would squeeze
 * it to under half size on a 390px screen, turning 12px option rows into 5px ones. So the sheet
 * carries the same question, at full text size, in something that scrolls.
 */
test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test("the question rides the dossier sheet, not the node", async ({ page }) => {
    const j = journey(page)
    await j.boot("/")
    await j.land("Mount Top")

    const target = await deckNode(page)
    await j.hydrate([target.key])
    await page.evaluate((i: number) => (window as Any).__neural.openDossier(i), target.idx)
    await page.evaluate(async () => {
      const a = (window as Any).__neural
      if (typeof a.nodeSettled === "function") await a.nodeSettled()
    })
    await j.advance(600)

    const where = await page.evaluate(() => {
      const a = (window as Any).__neural
      const sheet = a.dossierSheetRef.current
      const card = a.nodeCardRef.current
      const q = document.querySelector("[data-node-q]")
      return {
        sheetUp: !!sheet && sheet.style.display === "block",
        cardUp: !!card && card.style.display !== "none",
        inSheet: !!(q && sheet && sheet.contains(q)),
        opts: document.querySelectorAll("[data-node-mc-opt],[data-node-recall]").length,
        // the sheet owns the screen here; the landing card sits at bottom:206px and covered it
        landOpacity: a._landEl ? getComputedStyle(a._landEl).opacity : null,
      }
    })
    expect(where.sheetUp, "the phone opens the sheet").toBe(true)
    expect(where.inSheet, "and the question is IN the sheet").toBe(true)
    expect(where.opts, "answerable there").toBeGreaterThan(0)
    expect(
      Number(where.landOpacity),
      `and nothing paints over it (landing card computed ${where.landOpacity})`,
    ).toBeLessThan(0.05)

    // the sheet slides in on a .34s CSS transition, which runs on the WALL clock — advance()
    // pumps simulated time and would photograph it half-way down the screen
    await page.waitForTimeout(450)
    await page.screenshot({ path: "tests/artifacts/chrome/node-card-phone.png" })
  })
})

// ───────────────────────────────── 4 · getting out ─────────────────────────────────

test("the ✕ closes the in-node card, from the zoom entry and from More ▸", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  // entry 1 — an explicit open (an Explore row, a search hit, a graph tap)
  const target = await deckNode(page)
  await openNodeCard(j, page, target.idx)
  expect((await cardOpen(page)).on, "the card is up").toBe(true)
  await j.clickByMouse("[data-node-close]", "the node card's ✕")
  await j.advance(1600)
  expect((await cardOpen(page)).dossier, "✕ releases the node").toBeNull()
  expect((await cardOpen(page)).on, "and flies back out").toBe(false)

  // entry 2 — the landing card's More ▸
  await j.advance(400)
  await page.locator("[data-land-more]").click()
  for (let i = 0; i < 60; i++) {
    if ((await page.evaluate(() => (window as Any).__neural._nodeCardO || 0)) >= 0.999)
      break
    await j.advance(300)
  }
  expect((await cardOpen(page)).on, "More ▸ lands in the same card").toBe(true)
  await j.clickByMouse("[data-node-close]", "the node card's ✕ from More ▸")
  await j.advance(1600)
  expect((await cardOpen(page)).on, "and ✕ gets you out of that one too").toBe(false)
  expect(
    await page.evaluate(() => !!(window as Any).__neural.paused),
    "closing resumes the roll the dossier paused",
  ).toBe(false)
})

test("a click on empty canvas dismisses the node card; a pan does not", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  const target = await deckNode(page)
  await openNodeCard(j, page, target.idx)

  // a PAN across empty canvas: the reader is moving the map, not putting the card away
  const box = await page.locator("[data-node-head]").boundingBox()
  const y = 450
  await page.mouse.move(70, y)
  await page.mouse.down()
  for (let x = 90; x <= 260; x += 30) await page.mouse.move(x, y)
  await page.mouse.up()
  await j.advance(200)
  expect(
    (await cardOpen(page)).on,
    `a pan (from x=70 to x=260, header box ${JSON.stringify(box)}) leaves the card up`,
  ).toBe(true)

  // a CLICK on empty canvas, away from the card: put it away
  await page.mouse.move(70, y)
  await page.mouse.down()
  await page.mouse.up()
  await j.advance(1600)
  expect((await cardOpen(page)).on, "a click on empty space dismisses it").toBe(false)
})

test("Esc walks the ladder: the modal first, the node card next, the pane last", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  const target = await deckNode(page)
  await openNodeCard(j, page, target.idx)

  await page.evaluate(() => (window as Any).__neural.openSettings())
  await page.keyboard.press("Escape")
  await j.advance(100)
  expect(
    (await cardOpen(page)).on,
    "Esc closed the modal and left the card exactly where it was",
  ).toBe(true)

  await page.keyboard.press("Escape")
  await j.advance(1600)
  expect((await cardOpen(page)).on, "the next Esc flies back out of the node").toBe(false)
})
