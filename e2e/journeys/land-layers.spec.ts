import { test, expect } from "@playwright/test"
import { journey } from "../dsl"

/**
 * THE THREE BOTTOM LAYERS ARE STICKY (v1.171.0, owner).
 * v1.227.0: the owner's 2026-10-15 journey rule supersedes v1.134.0.
 * The catch fixture supplies prior-play provenance; a navigation alone stays calm.
 *
 * "When he closes that he now only sees the outcomes … if he clicks another node at that
 * instance, then another row of videos and another row of multiple-choice cards will show up
 * and it shouldn't. It should still be collapsed." The film row, the question card and the hand
 * each collapse from their own ghost ✕ and come back from the dock at bottom-centre; the choice
 * is a setting (`landFilm` · `landCard` · `landHand`), so it survives the next landing, a reload
 * and (per-key LWW) another device. A collapsed CARD is not built: no question, no clock, no
 * miss, `land_q_skipped {reason:"collapsed"}`; expanding it mid-landing asks then. A collapsed
 * HAND is dealt and hidden — the roll waits — escapes included (v1.171.1, owner).
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
 *   M3  drop `_syncHandLayer()` from enterLand              → "survives a reload" — the hidden
 *       style LINGERS on the persistent tray across ordinary deals, so the only deal that can
 *       tell is the FIRST one on a fresh element ("independent" alone did NOT kill it)
 *   M4  drop `_handShown()` from the digit gate             → "independent" (`1` opens a sheet)
 *   M5  drop `_layerDockEl` from attachInput's list          → "sticky" (clickByMouse on the dock)
 *   M6  drop `this._bandBot = null` in setLayer              → "geometry" (band cache kept)
 *   M7  `_tapBackground` calls setLayer instead of clearing  → "background ladder"
 *   M8  the skip reason is not "collapsed"                   → "sticky" (reason)
 *   M9  `_dockLandCard` ignores the datum when the hand hides → "geometry" (card stays at 236)
 *   M10 drop the 44px box on the phone glyphs                → "phone"
 *   M11 `_handShown` forces the escapes visible (v1.171.0's rule) → "caught" (v1.171.1 reversed it)
 *   M12 the caught sentence keeps its "drill to loosen it" tail → "caught"
 * NOT PINNED HERE (by design): that the camera actually reclaims the freed band after a toggle —
 * the band is asserted DROPPED (`_bandBot === null`), not re-measured; the settings rows' copy;
 * and the film ✕ hiding while a clip is expanded (no clip plays under the harness).
 */

const read = async (page: any) => {
  await expect(page.locator('[data-reader-ready="true"]')).toBeVisible();
  return page.evaluate(() => {
    const a = (window as any).__neural
    const beats = (a.beats || []).slice()
    return {
      card: !!a._landEl,
      cardEls: document.querySelectorAll("[data-landcard]").length,
      more: !!a._readerEl,
      moreOpen: !!a._reader?.interacting,
      // D-338: with the article shown the film lives in its Videos section, which hides its body.
      film: !!a._landFilmEl && a._landFilmEl.checkVisibility(),
      tray: (a.optionIdxs || []).length,
      trayVis: getComputedStyle(a.optionsRef.current).visibility,
      pick: !!a._optPick,
      pending: !!a._landPending,
      remaining: a._decision ? a._decision.remaining : "no-decision",
      landMc: !!(a._mc && a._mc.surface === "land"),
      landIdx: a._landIdx,
      cur: a.currentPos,
      // ...and the videos' one preference there is the section's (D-338), landFilm in the map view.
      keys: { film: a.get(a.get("readerBook", true) ? "readerSection.videos" : "landFilm", true), card: a.get("landCard", true), hand: a.get("landHand", true) },
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
}

// D-318 U1(1), CI 48be3a910 (STALE CONTRACT): with the article shown (Book on, the default on
// every route) the reading shelf is gone; a closed Questions or Moves reopens from the label it
// leaves (D-338, which also removed the section eyes and headers).
// The dock keeps its claims in the MAP view (Book off), where it also restores the hidden article.
// No control turns Book off (D-338: no View menu), so the map view boots as a returning reader
// left it: the persisted setting the app reads. A dock claim with a reading twin runs in both.
const BOOK_OFF = { v: 2, settings: { readerBook: false }, settingsAt: {} }
type View = "map" | "reading"
const VIEWS: View[] = ["map", "reading"]
const bootIn = (j: any, view: View) => j.boot("/", view === "map" ? { initialState: BOOK_OFF } : {})
const docked = (view: View, ...parts: string[]) => view === "map" ? [...parts, "book"] : parts
// STALE SPEC (D-355, U11): where the index shows (1440x900 here) a closed part leaves no label in the content:
// its index row carries the closed state and reopens it. Without the index the label reopens it, as before.
const indexed = (page: any) => page.locator(".ng-reader-toc").isVisible()
const restore = async (page: any, j: any, view: View, part: "card" | "hand") => {
  if (view === "map") return j.clickByMouse(`[data-layer-show="${part}"]`, `the dock's ${part} glyph`)
  await expect(page.locator(".ng-reader-shelf"), "the reading view has no shelf").toBeHidden()
  if (await indexed(page)) return j.clickByMouse(`[data-toc-type="${part}"] a`, `the closed ${part === "card" ? "Questions" : "Moves"} index row`)
  await page.locator(`[data-game-open="${part}"]`).scrollIntoViewIfNeeded()
  await j.clickByMouse(`[data-game-open="${part}"]`, `the closed ${part === "card" ? "Questions" : "Moves"} label`)
}
const viewTitle = (view: View) => view === "map" ? "" : " (reading view: the closed label)"

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

for (const view of VIEWS)
test(`@curated the ✕ is sticky: the next landing builds no card and asks nothing, and the dock brings it back mid-landing${viewTitle(view)}`, async ({ page }) => {
  const j = journey(page)
  await bootIn(j, view)
  await j.land("Mount Top")
  const q0 = await j.landQuestion()
  expect(q0, "a fresh visitor's first landing asks (the on-phase is non-vacuous)").toBeTruthy()
  const s0 = await read(page)
  expect(s0.cardEls, "one card up to begin with").toBe(1)
  expect(s0.dockEls, "one labeled shelf holds the hide and restore controls").toBe(1)

  // ── the ✕, by mouse ──
  await j.clickByMouse("[data-land-close]", "the card's ✕")
  await j.advance(300)
  const s1 = await read(page)
  expect(s1.card, "the card is gone").toBe(false)
  expect(s1.keys.card, "…and the choice is persisted").toBe(false)
  expect(s1.tray, "the hand survived").toBeGreaterThan(0)
  expect(s1.beats, "the dismissal is named").toContain("land_dismissed")
  expect(s1.dock, "the dock shows exactly the card glyph").toEqual(docked(view, "card"))
  if (view === "reading" && await indexed(page)) await expect(page.locator('[data-toc-type="card"]'), "the closed card's index row shows it closed").toHaveAttribute("data-collapsed", "true")
  else if (view === "reading") await expect(page.locator('[data-game-open="card"]'), "the closed card leaves its Questions label").toBeVisible()
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

  // ── expand from the dock (or the Questions eye), by mouse, mid-landing → THIS landing asks now ──
  await restore(page, j, view, "card")
  await j.advance(300)
  const q = await j.landQuestion()
  expect(q, "expanding mid-landing asks").toBeTruthy()
  await expect(page.locator("[data-land-q]"), "the question is on the table").toBeVisible()
  await j.openQuestion() // U47 d: restoring Questions rebuilds an asking card; Answer for Points arms its clock.
  const s4 = await read(page)
  expect(s4.keys.card).toBe(true)
  expect(s4.dockEls, "the shelf keeps the hide controls when every layer is open").toBe(1)
  expect(s4.shown, "a second land_q_shown — the re-expanded landing's").toBeGreaterThan(s0.shown)
  expect(s4.remaining, "…and its clock armed").not.toBe(null)
  // Restoring a part keeps keyboard focus on the shelf. Move into the question
  // before asserting the game keyboard shortcut.
  await page.locator("[data-land-mc-opt]").first().focus()
  await page.keyboard.press("abcd"[q!.correct])
  await j.advance(200)
  const s5 = await read(page)
  expect(s5.answered, "answered by key").toBe(1)
})

// STALE CONTRACT (D-338): these are the game layers' keys and the restore dock, the map view's
// state. With the article shown the videos follow their section, so this boots in the map view.
test("the choice survives a reload (persisted, read live at the next landing)", async ({ page }) => {
  const j = journey(page)
  await j.boot("/", { initialState: BOOK_OFF })
  await j.land("Mount Top")
  // through the real handle, and through setLayer's OWN save — no _flushSave here, so a writer
  // that forgets `this.set` (M2) leaves nothing for the next boot to find
  await j.clickByMouse("[data-land-close]", "the card's ✕")
  await page.evaluate(() => { const a = (window as any).__neural; a.setLayer("film", false, "test"); a.setLayer("hand", false, "test") })
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
  expect(keys.dock, "the dock is up from boot, before any landing").toBe(3)
  await j.land("Mount Top")
  const s = await read(page)
  expect(s.card, "no card on the first landing after the reload").toBe(false)
  expect(s.tray, "a hand, as always").toBeGreaterThan(0)
  // the tray is a FRESH element after a reload, so only the per-landing sync can hide it (M3)
  expect(s.trayVis, "…hidden by the first deal, from a persisted key").toBe("hidden")
  expect(s.dock).toEqual(docked("map", "film", "card", "hand"))
})

for (const view of VIEWS)
test(`the layers are independent: the film's ✕ keeps the card; the hand's ✕ hides a DEALT hand, kills the digits, and the roll still advances${viewTitle(view)}`, async ({ page }) => {
  const j = journey(page)
  await bootIn(j, view)
  await j.land("Mount Top")
  await seedFilm(page)
  await j.advance(400)
  expect((await read(page)).film, "film authored and up").toBe(true)
  expect((await read(page)).more, "the card's More sibling is authored too").toBe(true)

  // D-338: with the article shown the film's ✕ is its Videos section's (the strip's own ✕ is hidden there).
  await j.clickByMouse(view === "map" ? "[data-film-close]" : '[data-section-toggle="videos"]', "the film's ✕")
  await j.advance(300)
  const f1 = await read(page)
  expect(f1.film, "the strip is gone").toBe(false)
  expect(f1.card, "the card is untouched").toBe(true)
  expect(f1.more, "film is independent: More stays with the card").toBe(true)
  expect(f1.keys.film).toBe(false)
  expect(f1.dock).toEqual(docked(view, "film"))
  // a re-render WITH film authored keeps its retained host hidden while the layer is off
  await seedFilm(page)
  await j.advance(300)
  const f2 = await read(page)
  expect(f2.film, "a re-render with film authored keeps the strip hidden").toBe(false)
  expect(f2.card).toBe(true)
  expect(f2.more, "a card rebuild preserves its independent More sibling").toBe(true)

  // ── the hand ──
  await j.clickByMouse("[data-hand-close]", "the hand's ✕")
  await j.advance(300)
  const h1 = await read(page)
  expect(h1.keys.hand).toBe(false)
  expect(h1.trayVis, "the tray is hidden — visibility, so it is out of hit-testing too").toBe("hidden")
  expect(h1.tray, "…but the hand is still DEALT").toBeGreaterThan(0)
  expect(h1.pick, "and still yours to play").toBe(true)
  expect(h1.dock).toEqual(docked(view, "film", "hand"))
  expect(h1.more, "hand is independent: More stays with the card").toBe(true)
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
  await restore(page, j, view, "hand")
  await j.advance(300)
  const h3 = await read(page)
  expect(h3.trayVis).toBe("visible")
  expect(h3.tray).toBe(h2.tray)
  expect(h3.beats.filter((b: string) => b === "options_dealt").length, "no re-deal on expand").toBe(dealtBefore)
  expect(h3.dock).toEqual(docked(view, "film"))
})

// Reading view by nature (the article shown). D-318 U1(1), D-338: the videos, Questions and Moves
// close through their own ✕ (the shelf is gone with Book shown) and reopen from their labels.
test("@curated the article survives minimizing the question, videos and moves", async ({ page }) => {
  const j = journey(page)
  await j.boot("/"); await j.land("Mount Top"); await read(page)
  await seedFilm(page); await j.advance(400)
  await page.evaluate(() => { (window as any).__articleBefore = document.querySelector("[data-reader-body]") })
  // D-338: the film's home with the article shown is its Videos section, closed by that ✕.
  await page.locator('[data-section-toggle="videos"]').scrollIntoViewIfNeeded()
  await j.clickByMouse('[data-section-toggle="videos"]', "the videos' ✕")
  for (const sel of ["[data-land-close]", "[data-hand-close]"]) {
    await page.locator(sel).scrollIntoViewIfNeeded(); await j.readerLayoutSettled()
    await j.clickByMouse(sel, sel === "[data-land-close]" ? "the card's ✕" : "the hand's ✕")
  }
  const hidden = await read(page)
  // With the article shown the videos' one preference is their section's (D-338), not landFilm.
  const videos = await page.evaluate(() => (window as any).__neural.get("readerSection.videos", true))
  expect([videos, hidden.keys.card, hidden.keys.hand], "all three parts minimized").toEqual([false, false, false])
  expect(await page.evaluate(() => document.querySelector("[data-reader-body]") === (window as any).__articleBefore)).toBe(true)
  await expect(page.locator('[data-reader-ready="true"]')).toBeVisible()
  await j.advance(12000)
  expect((await read(page)).beats).not.toContain("land_q_expired")
  await restore(page, j, "reading", "card")
  await expect(page.locator("[data-landcard]")).toBeVisible()
  await expect(page.locator('[data-reader-ready="true"]')).toBeVisible()
})

test("@curated the measured reader and shelf reserve the final paragraph's space", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const j = journey(page)
  await j.boot("/"); await j.land("Mount Top"); await read(page)
  // D-338 retired the Focus click this used to enter reading with; focusing the prose reads.
  await expect(page.locator('[data-reader-ready="true"]')).toBeVisible()
  await page.locator("[data-reader-body]").focus()
  await page.keyboard.press("Control+End")
  // STALE CONTRACT (D-318 U1(1)): with Book shown there is no shelf to reserve (the old claim's
  // rect measured 0x0). The flow ends clear of the bottom controls that share its column instead.
  const boxes = await page.evaluate(() => {
    const a = (window as any).__neural, r = document.querySelector("[data-reader]")!.getBoundingClientRect()
    const col = document.querySelector(".ng-reader-article")!.getBoundingClientRect()
    const controls = [a.accountRef.current, a.shareCueRef.current, a.wrapRef.current.querySelector(".ng-winbar")]
      .filter((el: any) => el && getComputedStyle(el).visibility !== "hidden")
      .map((el: any) => el.getBoundingClientRect()).filter((b: any) => b.height && b.left < col.right && b.right > col.left)
      .map((b: any) => ({ top: b.top, bottom: b.bottom }))
    return { articleBottom: r.bottom, shelf: document.querySelector("[data-layer-dock]")!.getBoundingClientRect().height, controls, H: innerHeight }
  })
  expect(boxes.shelf, "no shelf in the reading view").toBe(0)
  expect(boxes.controls.length, "the phone has bottom controls under the column").toBeGreaterThan(0)
  for (const c of boxes.controls) expect(boxes.articleBottom, JSON.stringify(boxes)).toBeLessThanOrEqual(c.top - 6)
  expect(boxes.articleBottom).toBeLessThan(boxes.H)
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
  expect(s1.dockEls, "the independent reading shelf survives a per-landing dismissal").toBe(1)
  await expect(page.locator("[data-reader-part]")).toHaveCount(6)
  await expect(page.locator("[data-layer-show]")).toHaveCount(0)
  await expect(page.locator('[data-layer-hide="card"]')).toHaveAttribute("aria-pressed", "true")
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

for (const view of VIEWS)
test(`caught with the hand put away: the escape tray stays away too, and a collapsed card skips the drill by name${viewTitle(view)}`, async ({ page }) => {
  const j = journey(page)
  await bootIn(j, view)
  await j.land("Mount Top")
  await page.evaluate(() => { const a = (window as any).__neural; a.setLayer("hand", false, "test"); a.setLayer("card", false, "test") })
  await j.advance(200)
  expect((await read(page)).trayVis).toBe("hidden")
  await page.evaluate(() => {
    const a = (window as any).__neural
    a._rollActed = true
    a.enterDefense(a.nodes.findIndex((n: any) => n.ty === "submissions"), a._catchProvenance())
  })
  // Cold submission choices load over the network; a simulated frame advance does not
  // await that response. Observe the completed catch before checking its hidden layers.
  await expect.poll(() => page.evaluate(() => (window as any).__neural._defendSub != null)).toBe(true)
  await j.advance(400)
  const d = await page.evaluate(() => {
    const a = (window as any).__neural
    return {
      vis: getComputedStyle(a.optionsRef.current).visibility,
      escapes: a.optionsRef.current.children.length,
      defend: a._defendSub != null,
      handX: a._handCloseEl ? getComputedStyle(a._handCloseEl).visibility : "none",
      panic: a._landEl?.getAttribute("data-landcard") === "defense",
      skipped: (a.beats || []).filter((b: any) => b.beat === "panic_skipped").map((b: any) => b.reason),
    }
  })
  expect(d.defend).toBe(true)
  expect(d.escapes, "escapes dealt — the roll state is whole").toBeGreaterThan(0)
  // v1.171.1 (owner): "if I didn't ask to see outcomes don't show them to me" — caught or not.
  // v1.171.0 forced the escapes visible here; a Defender URL arrival with only the videos on
  // showed the escape tray, and that was the wrong call.
  expect(d.vis, "the escape tray stays AWAY under a put-away hand").toBe("hidden")
  expect(d.handX, "and no hand ✕ over a hidden tray").not.toBe("visible")
  expect(d.panic, "no drill on a collapsed card").toBe(false)
  expect(d.skipped, "…and the gap is named").toContain("collapsed")
  const said = await page.evaluate(() => { const a = (window as any).__neural; const t = a.evTextRef && a.evTextRef.current; return t ? t.textContent : "" })
  expect(said, "the announcer names the catch and nothing more (v1.171.1)").toMatch(/ locked in$/)

  // and the dock (or the Moves eye) brings the escapes back, mid-defence
  await restore(page, j, view, "hand")
  await j.advance(200)
  expect((await read(page)).trayVis, "the escapes are there to be chosen once asked for").toBe("visible")
})

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })
  test("the hand X owns its centre beside a full-width card, and minimizing it keeps More", async ({ page }) => {
    const j = journey(page)
    await j.boot("/")
    await j.land("Mount Top")
    await seedFilm(page)
    await j.advance(600)
    // D-318 keeps the arrival band and named headers in flow. At 390px this
    // hand begins at y724 and its close target is clipped by the y754 flow end.
    // Bring the hand into view before testing the unchanged overlap/mouse claim.
    await page.locator('[data-reader-game-part="hand"]').scrollIntoViewIfNeeded()
    await j.readerLayoutSettled()
    await j.advance(16) // publish the normal updateUiShift frame that docks the external hand X
    const g = await page.evaluate(() => {
      const a = (window as any).__neural
      const x = a._handCloseEl as HTMLElement
      const xr = x.getBoundingClientRect()
      const hit = document.elementFromPoint(xr.left + xr.width / 2, xr.top + xr.height / 2)
      return {
        own: hit === x || x.contains(hit),
        more: !!a._readerEl,
      }
    })
    expect(g.own, "the timed card does not intercept the hand X").toBe(true)
    expect(g.more, "premise: More is present").toBe(true)
    await j.clickByMouse("[data-hand-close]", "the phone hand X")
    await j.advance(300)
    const s = await read(page)
    expect(s.keys.hand, "the real mouse click minimizes the hand").toBe(false)
    expect(s.trayVis).toBe("hidden")
    expect(s.card, "the card remains").toBe(true)
    expect(s.more, "and its More sibling remains").toBe(true)
  })
  // MAP view (Book off): the reading view's 44px eyes are article-sections.spec.ts's D-318 390px case.
  test("every dock glyph is a 44px thumb target that owns its centre, clear of the legend and the share cue, and a tap works", async ({ page }) => {
    const j = journey(page)
    await bootIn(j, "map")
    await j.land("Mount Top")
    await page.evaluate(() => { const a = (window as any).__neural; for (const l of ["film", "card", "hand"]) a.setLayer(l, false, "test") })
    // SIDE-R2 M6: the corner chip this claim measured left the map for the drawer's foot (v1.242.0), so its
    // rect inside the closed drawer was 0x0 and could never overlap. The share cue holds the bottom-right
    // seat now: raise one (a stale link, the kind that needs no list) and measure the glyphs against it.
    await page.evaluate(() => (window as any).__neural._setShareCue({ kind: "stale" }))
    await j.advance(300)
    const g = await page.evaluate(() => {
      const box = (el: Element | null) => { if (!el) return null; const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height } }
      const glyphs = Array.from(document.querySelectorAll("[data-layer-show]")).map((b) => {
        const r = b.getBoundingClientRect()
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
        return { layer: b.getAttribute("data-layer-show"), box: box(b), own: hit === b || b.contains(hit) }
      })
      return { glyphs, legend: box(document.querySelector(".ng-legend")), cue: box(document.querySelector(".ng-sharecue")) }
    })
    expect(g.glyphs.map((x: any) => x.layer)).toEqual(docked("map", "film", "card", "hand"))
    const overlaps = (a: any, b: any) => !!a && !!b && !(a.r <= b.l || a.l >= b.r || a.b <= b.t || a.t >= b.b)
    expect(g.cue && g.cue.w * g.cue.h, "premise: the share cue is raised and has a box").toBeGreaterThan(0)
    for (const x of g.glyphs) {
      expect(x.box!.w, `${x.layer}: 44px wide`).toBeGreaterThanOrEqual(44)
      expect(x.box!.h, `${x.layer}: 44px tall`).toBeGreaterThanOrEqual(44)
      expect(x.own, `${x.layer}: owns its centre`).toBe(true)
      expect(overlaps(x.box, g.legend), `${x.layer}: clear of the legend`).toBe(false)
      expect(overlaps(x.box, g.cue), `${x.layer}: clear of the share cue`).toBe(false)
    }
    const c = g.glyphs.find((x: any) => x.layer === "card")!.box!
    await page.touchscreen.tap(c.l + c.w / 2, c.t + c.h / 2)
    await j.advance(400)
    const s = await read(page)
    expect(s.keys.card, "a tap on the glyph brings the card layer back").toBe(true)
    expect(s.dock).toEqual(docked("map", "film", "hand"))
  })
})
