import { test, expect } from "@playwright/test"
import { journey } from "../dsl"

/**
 * THE THREE BOTTOM LAYERS ARE STICKY (v1.171.0, owner).
 *
 * "When he closes that he now only sees the outcomes … if he clicks another node at that
 * instance, then another row of videos and another row of multiple-choice cards will show up
 * and it shouldn't. It should still be collapsed." The film row, the question card and the hand
 * each collapse from their own ghost ✕ and come back from the dock at bottom-centre; the choice
 * is a setting (`landFilm` · `landCard` · `landHand`), so it survives the next landing, a reload
 * and (per-key LWW) another device. A collapsed CARD is not built: no question, no clock, no
 * miss, `land_q_skipped {reason:"collapsed"}`; expanding it mid-landing asks then. A collapsed
 * HAND is dealt and hidden — the roll waits — and the escape tray shows regardless.
 *
 * Surfaces: [data-land-close] [data-film-close] [data-hand-close] [data-layer-dock]
 *           [data-layer-show=film|card|hand] [data-layer-toggle=…] · settings above
 * Seams:    setLayer · _layerOn · _handShown · _applyLayers · _syncHandLayer · _landDatum ·
 *           _renderLayerDock · renderLandCard's collapsed branch · _tapBackground (untouched)
 *
 * Every handle is clicked with `j.clickByMouse` — a control inside a fixed overlay is dead to a
 * real mouse unless `attachInput` names it (§6.1), and `locator.click()` cannot tell (§6.3).
 *
 * MUTANTS (a claim is gated only when its mutant turns a named test red — §8). 11 of 11 killed
 * at v1.171.0 (tests/artifacts has no runner for this; the table is in the archive entry):
 *   M1  delete the collapsed branch in renderLandCard      → "sticky" (card built), "asks nothing"
 *   M2  setLayer writes the value but forgets `this.set`    → "survives a reload" — pinned by the
 *       LWW STAMP assert, not by the reload: other writers save the blob within the window, so
 *       a bare `this.settings[k] = v` survives a reload and only loses cross-device
 *   M3  drop `_syncHandLayer()` from enterLand              → "caught" — the hidden style LINGERS
 *       on the persistent tray across ordinary deals, so the only landing that can tell is the
 *       one after the escape tray forced it visible ("independent" alone did NOT kill it)
 *   M4  drop `_handShown()` from the digit gate             → "independent" (`1` opens a sheet)
 *   M5  drop `_layerDockEl` from attachInput's list          → "sticky" (clickByMouse on the dock)
 *   M6  drop `this._bandBot = null` in setLayer              → "geometry" (band cache kept)
 *   M7  `_tapBackground` calls setLayer instead of clearing  → "background ladder"
 *   M8  the skip reason is not "collapsed"                   → "sticky" (reason)
 *   M9  `_dockLandCard` ignores the datum when the hand hides → "geometry" (card stays at 236)
 *   M10 drop the 44px box on the phone glyphs                → "phone"
 *   M11 drop the `_defendSub` force in `_handShown`          → "caught"
 * NOT PINNED HERE (by design): that the camera actually reclaims the freed band after a toggle —
 * the band is asserted DROPPED (`_bandBot === null`), not re-measured; the settings rows' copy;
 * and the film ✕ hiding while a clip is expanded (no clip plays under the harness).
 */

const read = (page: any) =>
  page.evaluate(() => {
    const a = (window as any).__neural
    const beats = (a.beats || []).slice()
    return {
      card: !!a._landEl,
      cardEls: document.querySelectorAll("[data-landcard]").length,
      film: !!a._landFilmEl,
      tray: (a.optionIdxs || []).length,
      trayVis: getComputedStyle(a.optionsRef.current).visibility,
      pick: !!a._optPick,
      pending: !!a._landPending,
      remaining: a._decision ? a._decision.remaining : "no-decision",
      landMc: !!(a._mc && a._mc.surface === "land"),
      landIdx: a._landIdx,
      cur: a.currentPos,
      keys: { film: a.get("landFilm", true), card: a.get("landCard", true), hand: a.get("landHand", true) },
      dock: Array.from(document.querySelectorAll("[data-layer-show]")).map((b: any) => b.getAttribute("data-layer-show")),
      dockEls: document.querySelectorAll("[data-layer-dock]").length,
      beats: beats.map((b: any) => b.beat),
      skips: beats.filter((b: any) => b.beat === "land_q_skipped").map((b: any) => b.reason),
      shown: beats.filter((b: any) => b.beat === "land_q_shown").length,
      answered: beats.filter((b: any) => b.beat === "land_q_answered").length,
      detail: !!a._detailCtx,
      bandBot: a._bandBot,
      roam: !!a._roam,
    }
  })

/** one deterministic hop through the tray (the returner spec's pattern): first transitions-type
 *  option, rigged to succeed, then wait for the next hand */
const hop = async (page: any, j: any, viaKeyboard = false) => {
  const t = await page.evaluate(() => {
    const a = (window as any).__neural
    for (const o of a.optionIdxs || []) {
      const n = a.nodes[typeof o === "number" ? o : o.idx]
      if (n && n.ty === "transitions") return n.t
    }
    return ""
  })
  expect(t, "a transitions-type option to hop on").not.toBe("")
  await j.rig("resolve", [0.01])
  await j.rig("outcome", [0.01])
  if (viaKeyboard) {
    // the tray may be hidden: commit through the deal's own pick closure, never through the DOM
    await page.evaluate((name: string) => {
      const a = (window as any).__neural
      const opt = (a._optList || []).find((o: any) => o.node && o.node.t === name)
      a._optPick(opt)
    }, t)
  } else {
    await j.pick(t)
  }
  await j.nextHand()
}

/** the DSL serves {} for content chunks, so a landing with film has to be authored
 *  (landcard-chrome.spec.ts's helper, verbatim) */
const seedFilm = (page: any) =>
  page.evaluate(() => {
    const a = (window as any).__neural
    const key = a.deckKeyFor(a.nodes[a.currentPos]).key
    const w = window as any
    w.NG_CONTENT = w.NG_CONTENT || {}
    w.NG_CONTENT.decks = w.NG_CONTENT.decks || {}
    w.NG_CONTENT.decks[key] = {
      def: "Seeded definition.",
      principles: ["P1", "P2"],
      counters: ["C1"],
      clips: [
        { id: "aQ2vFXXBn-o", title: "Countering a full inversion", who: "Gordon Ryan" },
        { id: "bQ2vFXXBn-o", title: "Second clip", who: "Someone" },
      ],
    }
    a._landQ = null
    a.renderLandCard(a.nodes[a.currentPos], "land", null)
  })

test("@curated the ✕ is sticky: the next landing builds no card and asks nothing, and the dock brings it back mid-landing", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  const q0 = await j.landQuestion()
  expect(q0, "a fresh visitor's first landing asks (the on-phase is non-vacuous)").toBeTruthy()
  const s0 = await read(page)
  expect(s0.cardEls, "one card up to begin with").toBe(1)
  expect(s0.dockEls, "no dock while every layer is open").toBe(0)

  // ── the ✕, by mouse ──
  await j.clickByMouse("[data-land-close]", "the card's ✕")
  await j.advance(300)
  const s1 = await read(page)
  expect(s1.card, "the card is gone").toBe(false)
  expect(s1.keys.card, "…and the choice is persisted").toBe(false)
  expect(s1.tray, "the hand survived").toBeGreaterThan(0)
  expect(s1.beats, "the dismissal is named").toContain("land_dismissed")
  expect(s1.dock, "the dock shows exactly the card glyph").toEqual(["card"])
  expect(s1.landIdx, "the landing still knows its state (film + backfill invariant)").toBe(s1.cur)

  // ── the next landing: no card, a hand, the gap named ──
  await hop(page, j)
  const s2 = await read(page)
  expect(s2.card, "the next landing builds NO card").toBe(false)
  expect(s2.cardEls).toBe(0)
  expect(s2.tray, "but deals the hand").toBeGreaterThan(0)
  expect(s2.skips, "the skip is named with its own reason").toContain("collapsed")
  expect(s2.pending, "nothing pending").toBe(false)
  expect(s2.remaining, "no clock armed").toBe(null)
  expect(s2.landMc, "no land-surface MC truth").toBe(false)
  // the keys are dead: A grades nothing
  await page.keyboard.press("a")
  await j.advance(200)
  const s3 = await read(page)
  expect(s3.answered, "A–C grade nothing on a collapsed card").toBe(0)

  // ── expand from the dock, by mouse, mid-landing → THIS landing asks now ──
  await j.clickByMouse('[data-layer-show="card"]', "the dock's card glyph")
  await j.advance(300)
  const q = await j.landQuestion()
  expect(q, "expanding mid-landing asks").toBeTruthy()
  await expect(page.locator("[data-land-q]"), "the question is on the table").toBeVisible()
  const s4 = await read(page)
  expect(s4.keys.card).toBe(true)
  expect(s4.dockEls, "the dock is REMOVED once every layer is open").toBe(0)
  expect(s4.shown, "a second land_q_shown — the re-expanded landing's").toBeGreaterThan(s0.shown)
  expect(s4.remaining, "…and its clock armed").not.toBe(null)
  await page.keyboard.press("abcd"[q!.correct])
  await j.advance(200)
  const s5 = await read(page)
  expect(s5.answered, "answered by key").toBe(1)
})

test("the choice survives a reload (persisted, read live at the next landing)", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  // through the real handle, and through setLayer's OWN save — no _flushSave here, so a writer
  // that forgets `this.set` (M2) leaves nothing for the next boot to find
  await j.clickByMouse("[data-land-close]", "the card's ✕")
  await page.evaluate(() => (window as any).__neural.setLayer("film", false, "test"))
  await j.advance(1200) // > the 400ms save debounce
  // the per-key TIMESTAMP is the cross-device half of the claim: without it the LWW merge lets a
  // stale device's value win (M2 writes the value and forgets the stamp — a reload alone cannot
  // tell, because other writers save the blob within the window)
  const stamped = await page.evaluate(() => { const a = (window as any).__neural; return { card: (a._settingsAt || {}).landCard || 0, film: (a._settingsAt || {}).landFilm || 0 } })
  expect(stamped.card, "landCard carries its LWW stamp").toBeGreaterThan(0)
  expect(stamped.film, "landFilm carries its LWW stamp").toBeGreaterThan(0)
  await j.boot("/", { preserveStorage: true })
  const keys = await page.evaluate(() => { const a = (window as any).__neural; return { card: a.get("landCard", true), film: a.get("landFilm", true), dock: document.querySelectorAll("[data-layer-show]").length } })
  expect(keys.card, "landCard came back off").toBe(false)
  expect(keys.film, "landFilm came back off").toBe(false)
  expect(keys.dock, "the dock is up from boot, before any landing").toBe(2)
  await j.land("Mount Top")
  const s = await read(page)
  expect(s.card, "no card on the first landing after the reload").toBe(false)
  expect(s.tray, "a hand, as always").toBeGreaterThan(0)
  expect(s.dock).toEqual(["film", "card"])
})

test("the layers are independent: the film's ✕ keeps the card; the hand's ✕ hides a DEALT hand, kills the digits, and the roll still advances", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await seedFilm(page)
  await j.advance(400)
  expect((await read(page)).film, "film authored and up").toBe(true)

  await j.clickByMouse("[data-film-close]", "the film's ✕")
  await j.advance(300)
  const f1 = await read(page)
  expect(f1.film, "the strip is gone").toBe(false)
  expect(f1.card, "the card is untouched").toBe(true)
  expect(f1.keys.film).toBe(false)
  expect(f1.dock).toEqual(["film"])
  // a re-render WITH film authored builds no strip while the layer is off
  await seedFilm(page)
  await j.advance(300)
  const f2 = await read(page)
  expect(f2.film, "a re-render with film authored builds no strip").toBe(false)
  expect(f2.card).toBe(true)

  // ── the hand ──
  await j.clickByMouse("[data-hand-close]", "the hand's ✕")
  await j.advance(300)
  const h1 = await read(page)
  expect(h1.keys.hand).toBe(false)
  expect(h1.trayVis, "the tray is hidden — visibility, so it is out of hit-testing too").toBe("hidden")
  expect(h1.tray, "…but the hand is still DEALT").toBeGreaterThan(0)
  expect(h1.pick, "and still yours to play").toBe(true)
  expect(h1.dock).toEqual(["film", "hand"])
  await page.keyboard.press("1")
  await j.advance(200)
  expect((await read(page)).detail, "a digit opens no sheet on a put-away hand").toBe(false)

  // the roll advances through the deal's own closure; the next landing deals AND hides again
  await hop(page, j, true)
  const h2 = await read(page)
  expect(h2.tray, "the next hand is dealt").toBeGreaterThan(0)
  expect(h2.trayVis, "…and hidden again (the layer is read per landing)").toBe("hidden")

  // back from the dock — the SAME hand, no re-deal
  const dealtBefore = (await read(page)).beats.filter((b: string) => b === "options_dealt").length
  await j.clickByMouse('[data-layer-show="hand"]', "the dock's hand glyph")
  await j.advance(300)
  const h3 = await read(page)
  expect(h3.trayVis).toBe("visible")
  expect(h3.tray).toBe(h2.tray)
  expect(h3.beats.filter((b: string) => b === "options_dealt").length, "no re-deal on expand").toBe(dealtBefore)
  expect(h3.dock).toEqual(["film"])
})

test("geometry: a put-away hand hands the card the tray's slot, and the toggle drops the camera band cache", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await j.advance(1200)
  const before = await page.evaluate(() => {
    const a = (window as any).__neural
    const r = a._landEl.getBoundingClientRect()
    return { gap: window.innerHeight - r.bottom, band: a._bandBot }
  })
  expect(before.band, "the band is measured while a card is up").toBeTruthy()
  expect(before.gap, "the card clears the tray (CSS constant or docked)").toBeGreaterThan(84 + 60)

  await page.evaluate(() => (window as any).__neural.setLayer("hand", false, "test"))
  const right = await page.evaluate(() => (window as any).__neural._bandBot)
  expect(right, "the ONE band reset, synchronous with the toggle").toBe(null)
  await j.advance(600)
  const after = await page.evaluate(() => {
    const a = (window as any).__neural
    const r = a._landEl.getBoundingClientRect()
    return { gap: window.innerHeight - r.bottom }
  })
  expect(Math.abs(after.gap - 84), "the card sits on the tray's own bottom (84px)").toBeLessThanOrEqual(2)

  // and back: the hand returns and the card climbs off it again
  await page.evaluate(() => (window as any).__neural.setLayer("hand", true, "test"))
  await j.advance(600)
  const back = await page.evaluate(() => {
    const a = (window as any).__neural
    const c = a._landEl.getBoundingClientRect(), t = a.optionsRef.current.getBoundingClientRect()
    return { clear: c.bottom <= t.top + 1, vis: getComputedStyle(a.optionsRef.current).visibility }
  })
  expect(back.vis).toBe("visible")
  expect(back.clear, "the card clears the returned tray").toBe(true)
})

test("the background ladder stays per-landing: a tap closes THIS card, the next landing has one", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await page.evaluate(() => (window as any).__neural._tapBackground())
  await j.advance(300)
  const s1 = await read(page)
  expect(s1.card, "tap 1 closes the card").toBe(false)
  expect(s1.keys.card, "…as a gesture, not a preference").toBe(true)
  expect(s1.dockEls, "no dock — nothing is put away").toBe(0)
  await hop(page, j)
  const s2 = await read(page)
  expect(s2.card, "the next landing has its card").toBe(true)
})

test("the settings rows mirror the keys, both ways", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await page.evaluate(() => (window as any).__neural.openSettings("rolling"))
  await j.advance(300)
  const row = page.locator('[data-layer-toggle="card"]')
  await expect(row).toHaveAttribute("aria-pressed", "true")
  await row.click()
  await j.advance(300)
  await expect(page.locator('[data-layer-toggle="card"]')).toHaveAttribute("aria-pressed", "false")
  const s = await read(page)
  expect(s.keys.card).toBe(false)
  expect(s.card, "the live card went with it").toBe(false)
  expect(s.dock).toEqual(["card"])
  await page.evaluate(() => (window as any).__neural.setLayer("card", true, "test"))
  await page.evaluate(() => (window as any).__neural.renderSettings())
  await expect(page.locator('[data-layer-toggle="card"]'), "a change from the board shows in the row").toHaveAttribute("aria-pressed", "true")
})

test("caught with the hand put away: the escape tray shows regardless, and a collapsed card skips the drill by name", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await page.evaluate(() => { const a = (window as any).__neural; a.setLayer("hand", false, "test"); a.setLayer("card", false, "test") })
  await j.advance(200)
  expect((await read(page)).trayVis).toBe("hidden")
  await page.evaluate(() => {
    const a = (window as any).__neural
    a.enterDefense(a.nodes.findIndex((n: any) => n.ty === "submissions"))
  })
  await j.advance(400)
  const d = await page.evaluate(() => {
    const a = (window as any).__neural
    return {
      vis: getComputedStyle(a.optionsRef.current).visibility,
      escapes: a.optionsRef.current.children.length,
      defend: a._defendSub != null,
      handX: a._handCloseEl ? getComputedStyle(a._handCloseEl).visibility : "none",
      panic: !!(a._landEl && a._landEl.hasAttribute("data-panic")),
      skipped: (a.beats || []).filter((b: any) => b.beat === "panic_skipped").map((b: any) => b.reason),
    }
  })
  expect(d.defend).toBe(true)
  expect(d.escapes, "escapes dealt").toBeGreaterThan(0)
  expect(d.vis, "the escape tray is VISIBLE under a put-away hand").toBe("visible")
  expect(d.handX, "and carries no ✕ — the escapes are not the hand layer").not.toBe("visible")
  expect(d.panic, "no drill on a collapsed card").toBe(false)
  expect(d.skipped, "…and the gap is named").toContain("collapsed")

  // …and the escape's landing hides the hand AGAIN. The tray is one persistent element, so the
  // hidden style would simply linger without a per-landing sync — this is the case where it
  // matters: the escape tray forced it visible, and the next deal must read the layer afresh (M3).
  await j.rig("escape", [0.01])
  await page.evaluate(() => { const a = (window as any).__neural; a._optPick(a._optList[0]) })
  await j.nextHand()
  const after = await read(page)
  expect(after.tray, "a hand is dealt after the escape").toBeGreaterThan(0)
  expect(after.trayVis, "…and hidden again — the layer is read per landing").toBe("hidden")
})

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })
  test("every dock glyph is a 44px thumb target that owns its centre, clear of the legend and the chip, and a tap works", async ({ page }) => {
    const j = journey(page)
    await j.boot("/")
    await j.land("Mount Top")
    await page.evaluate(() => { const a = (window as any).__neural; for (const l of ["film", "card", "hand"]) a.setLayer(l, false, "test") })
    await j.advance(300)
    const g = await page.evaluate(() => {
      const box = (el: Element | null) => { if (!el) return null; const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height } }
      const glyphs = Array.from(document.querySelectorAll("[data-layer-show]")).map((b) => {
        const r = b.getBoundingClientRect()
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
        return { layer: b.getAttribute("data-layer-show"), box: box(b), own: hit === b || b.contains(hit) }
      })
      return { glyphs, legend: box(document.querySelector(".ng-legend")), chip: box(document.querySelector(".ng-acctwrap")) }
    })
    expect(g.glyphs.map((x: any) => x.layer)).toEqual(["film", "card", "hand"])
    const overlaps = (a: any, b: any) => !!a && !!b && !(a.r <= b.l || a.l >= b.r || a.b <= b.t || a.t >= b.b)
    for (const x of g.glyphs) {
      expect(x.box!.w, `${x.layer}: 44px wide`).toBeGreaterThanOrEqual(44)
      expect(x.box!.h, `${x.layer}: 44px tall`).toBeGreaterThanOrEqual(44)
      expect(x.own, `${x.layer}: owns its centre`).toBe(true)
      expect(overlaps(x.box, g.legend), `${x.layer}: clear of the legend`).toBe(false)
      expect(overlaps(x.box, g.chip), `${x.layer}: clear of the account chip`).toBe(false)
    }
    const c = g.glyphs.find((x: any) => x.layer === "card")!.box!
    await page.touchscreen.tap(c.l + c.w / 2, c.t + c.h / 2)
    await j.advance(400)
    const s = await read(page)
    expect(s.keys.card, "a tap on the glyph brings the card layer back").toBe(true)
    expect(s.dock).toEqual(["film", "hand"])
  })
})
