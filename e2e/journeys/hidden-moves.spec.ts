import { expect, test, type Page } from "@playwright/test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { journey } from "../dsl"
import { bootVideoCards, CARD } from "../fixtures/video-cards"

/** HIDDEN MOVES (v1.255.0, owner U115 b + U116, 10 Nov 2026).
 *
 * "Hide moves until I look" (Rolling settings, `hideMoves`, off by default) deals the row with each
 * card's NAME and FILM face down — Works % and Win % stay — and withholds the map's names of the
 * dealt moves. A hover (at once, v1.256.3) or a tap turns one card up and asks "Did you get
 * it?"; a Yes files the move in the `moves` record as MASTERED and the card wears thin gold in every
 * row. The word beside "Your moves" (· Hidden / · Shown, v1.257.0; U121's eye before it) switches the mode from the
 * row; keys 1-9 still play blind.
 *
 * "SHOW ALL" IS GONE, AND SO ARE ITS CASES (owner, U121, 10 Nov: "We don't say 'show all', but still show the
 * icon"): the eye replaced the control and its this-turn reveal, so the "Show all asks nothing / Hide all turns it
 * back" test was deleted, not skipped, and its mutant ("Show all still asks") has no claim left to kill. The map's
 * positive controls use the eye now. The eye's mutants (U121), each killed by its named test: not wired · not
 * repainted on a switch · a 24px target · a 44px target over card 1's edge · a transition · the face-up set kept
 * across off and on. ONE NON-KILL, recorded so nobody reads it as covered: deleting the eye's own pointerdown stop
 * changes nothing a test can see, because the option row already keeps its presses from the map's input
 * (attachInput); the probe is live (its control counts a real map press). The eye's stop is a second guard.
 *
 * THE EYE BECAME A WORD (v1.257.0, the owner's pick d on U130, 11 Nov), AND EVERY EYE CLAIM MOVED TO IT. What each
 * changed assertion claimed before, so none of them reads as dropped:
 *   off by default    was "the plain eye, aria-pressed false"      now "the word reads Shown, named 'Moves shown'"
 *   the switch test   was "on: pressed, named 'Hide moves until I look', slashed and gold; off: plain, unpressed"
 *                     now "on: the word reads Hidden, named 'Moves hidden', in the title's own colour; off: Shown"
 *                     (the state is in the NAME, not aria-pressed: a pressed "Shown" would read as a contradiction)
 *   the pull (R9)     was "the eye pressed / not pressed"           now "the word Hidden / Shown"
 *   the touch target  was "the eye: 44 x 40, the free band"        now the same claim on the word, unchanged numbers
 *   the map's controls press the word where they pressed the eye.
 * NEW (v1.257.0): a press on the word moves nothing beside it (its box reserves "Hidden"). The eye's six mutants were
 * re-run against the word, and each new claim has its own; table in docs/Changelog-Archive.md (v1.257.0).
 *
 * THE DWELL IS GONE, AND THREE ASSERTIONS CHANGED WITH IT (v1.256.3, owner, 11 Nov: "i'd like for it to be instant
 * to show it, what's taking it so long?"). v1.255.0 turned a hovered card up only after NG_PEEK_DWELL_MS (250 ms), so
 * a pointer sweeping along the row turned nothing up, and the hover test pinned exactly that. His words reverse the
 * rule, so the test now pins the opposite, and says so: "at 120ms ... still face down" became "on the FIRST frame
 * after the pointer enters, face up and asking"; "a sweep counts no peek" (0) became four peeks, one per card the
 * pointer crossed; "...and does not touch the hand" became touched, because every crossed card showed its name and a
 * hand must never re-sort under a name it showed. What a sweep still may not do is pinned beside them: every card
 * back down once the pointer has left, no strip left open, no grade, no play. NG_GRADE_ARM_MS's pin (review R3, the
 * two "before it could be seen" tests) is unchanged: it is now the only wait on a hidden card. Mutant (v1.256.3):
 * the reveal deferred again (`setTimeout(() => this._peek(card, true), 250)` in pointerenter) is killed by the hover
 * test's first-frame message; so is a one-frame deferral, because the test's own pointerenter listener runs first and
 * queues its frame ahead of the app's.
 *
 * HIDDENNESS IS NEVER READ FROM TEXT. Hiding is CSS on an attribute, so a face-down card's
 * `textContent` still holds its name (every other reader of the card depends on that). Each claim
 * here reads computed visibility, the back's geometry against the film slot, or `elementFromPoint`.
 *
 * Mutants (v1.255.0): 26 app/CSS mutants, each run against the ONE test named for its claim, all
 * killed with that claim's own message; runner and table in docs/Changelog-Archive.md (v1.255.0).
 * Claims: the name's visibility:hidden · the reveal on the hover's first frame (it was the dwell, see below) · the first tap consumed · the
 * stand-in face up · `moves` in the blob · the map's label gate · (Show all asks nothing: retired, U121) · "Hidden move
 * N" · a peek touches the hand · the staged card face up · an escape filed by label · No takes the
 * gold away · No recorded as ok 0 · a due card offers No · known-and-not-due asks nothing · Yes only
 * on an unknown card · the gold border · the hover transform · the stand-in seated on the layout box ·
 * the 44px touch Yes · Yes and No both 44px inside the card on touch · "Tap to reveal" · the live
 * switch · the film button still under the card's hover · the film button's own hover · reduced motion. The merge rule's two mutants are killed by
 * tests/moves_record.test.mjs. REVIEW ROUND (HIDE1D), 9 more, each killed by its named test: the hovered pair group
 * ungated · the single hover label ungated · a face-down orb's pair partner unlisted (R2) · the grade buttons never
 * armed, by mouse and by touch · the strip taking presses again (R3) · Enter following the last pointer (R7) · "Hidden
 * move N" from the printed digit (R8) · a hydrate that flips the setting not re-syncing (R9). NOT COVERED here: the header-hint variant (NG_HIDE_HINT = "header",
 * not shipped) and the PostHog properties (no PR shard is keyed, §6.4).
 */

type W = any
const seed = { v: 2, settings: { hideMoves: true }, settingsAt: { hideMoves: 1 } }
const OWN = ".ng-choice-card:not([data-opponent-threat])"

async function seatMount(page: Page, hidden = true) {
  const j = journey(page)
  await j.boot("/", hidden ? { initialState: seed } : {})
  await j.land("Mount Top")
  await expect.poll(() => page.evaluate(() => ((window as W).__neural._optionCards || []).filter((c: W) => !c.opt.threat).length)).toBeGreaterThan(3)
  await tag(page)
  return j
}

/** Tag your dealt cards by IDENTITY (`data-hm` = their dealt order now): a hand can re-sort once when
 *  its win chances land, so a position read later is another card (§6.3). `[data-hm="1"]` is the
 *  same card for the whole test. */
const tag = (page: Page) => page.evaluate(() => (window as W).__neural._optionCards.filter((c: W) => !c.opt.threat).forEach((c: W, i: number) => c.card.setAttribute("data-hm", String(i))))
const hm = (i: number) => `[data-hm="${i}"]`
/** the grade buttons answer only a press that began NG_GRADE_ARM_MS (500 ms) after the strip appeared (review R3) */
const ARM = 600

/** What a player can SEE of the card `sel` names: never its text. */
const face = (page: Page, sel: string) => page.evaluate((sel) => {
  const c = document.querySelector(sel) as HTMLElement
  const vis = (el: Element | null) => el ? getComputedStyle(el).visibility : null
  const back = c.querySelector(".ng-choice-back") as HTMLElement | null, film = c.querySelector("[data-choice-media]")!.getBoundingClientRect()
  const b = back && getComputedStyle(back).display !== "none" ? back.getBoundingClientRect() : null
  return {
    title: vis(c.querySelector(".ngchoice-title")),
    watch: vis(c.querySelector("[data-choice-watch]")),
    stats: vis(c.querySelector("[data-choice-value]")),
    // the back is drawn over the WHOLE film slot (to the pixel), or not drawn at all
    filmCovered: !!b && Math.abs(b.top - film.top) < 1 && Math.abs(b.bottom - film.bottom) < 1 && Math.abs(b.left - film.left) < 1 && Math.abs(b.right - film.right) < 1,
    aria: c.querySelector("[data-choice-execute]")?.getAttribute("aria-label") || null,
    up: c.hasAttribute("data-revealed"), asking: c.hasAttribute("data-asking"), mastered: c.hasAttribute("data-mastered"),
    yes: c.querySelectorAll('[data-grade="yes"]').length, no: c.querySelectorAll('[data-grade="no"]').length,
  }
}, sel)

/** A point on the card's title row that a real pointer reaches: the card owns it (§6.1). */
async function pointOn(page: Page, sel: string) {
  const at = await page.evaluate((sel) => {
    const c = document.querySelector(sel) as HTMLElement
    ;(window as W).__neural._handTouched = true
    c.scrollIntoView({ inline: "nearest", block: "nearest" })
    const r = c.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + 22
    const top = document.elementFromPoint(x, y)
    return { x, y, ok: !!top && c.contains(top), who: top ? top.outerHTML.slice(0, 80) : "nothing" }
  }, sel)
  expect(at.ok, `${sel}'s title row is reachable where it sits (elementFromPoint: ${at.who})`).toBe(true)
  return at
}

const appState = (page: Page) => page.evaluate(() => {
  const a = (window as W).__neural, s = document.querySelector("[data-executing-tech]") as HTMLElement | null
  return {
    executing: !!a._execution, touched: !!a._handTouched, peeks: a._hmPeeks ? a._hmPeeks.size : 0, moves: a.moves || {},
    stand: s ? { label: s.getAttribute("data-executing-tech"), hidden: !!s.querySelector("[data-hide], .ng-choice-back, [data-choice-grade]"),
      title: getComputedStyle(s.querySelector(".ngchoice-title")!).visibility } : null,
  }
})

/** the word beside "Your moves" (v1.257.0): what it reads and the name it gives a screen reader */
const switchWord = (page: Page) => page.evaluate(() => {
  const e = document.querySelector("[data-hide-switch]") as HTMLElement
  return { word: e.querySelector(".ng-hide-word > span")!.textContent, name: e.getAttribute("aria-label") }
})

/** the map's dealt-move names drawn on the latest frame */
const mapNames = async (page: Page) => {
  await journey(page).advance(50)
  return page.evaluate(() => { const a = (window as W).__neural; return (a._lastOptLabels || []).map((i: number) => a.nodes[i].t) })
}

test("@curated off by default: the row is dealt as before, and the setting turns it face down in place", async ({ page }) => {
  await seatMount(page, false)
  expect(await page.locator("[data-hide], .ng-choice-back, [data-choice-grade]").count(), "no hidden-moves DOM on the cards while off").toBe(0)
  expect(await switchWord(page), "...and the word by Your moves reads Shown, named for the state (v1.257.0)").toEqual({ word: "Shown", name: "Moves shown" })
  const open = await face(page, hm(0))
  expect([open.title, open.stats, open.filmCovered]).toEqual(["visible", "visible", false])
  // the Rolling tab's row, by mouse, under a dealt hand: no redeal, the same cards go face down
  const before = await page.evaluate(() => (window as W).__neural._optionCards.map((c: W) => c.opt.node.t).join("|"))
  await page.evaluate(() => (window as W).__neural.openSettings("rolling"))
  await expect(page.locator("[data-settings-hide-moves]")).toBeVisible()
  // the row sits below the panel's fold: a reader scrolls the panel to it (clickByMouse never scrolls)
  await page.evaluate(() => document.querySelector("[data-settings-hide-moves]")!.scrollIntoView({ block: "center" }))
  await journey(page).clickByMouse('[data-settings-hide-moves] button:first-of-type', '"Hide moves until I look": On')
  expect(await page.evaluate(() => (window as W).__neural.get("hideMoves", false))).toBe(true)
  await page.evaluate(() => (window as W).__neural.closeModal())
  expect(await page.evaluate(() => (window as W).__neural._optionCards.map((c: W) => c.opt.node.t).join("|")), "the same hand, not a redeal").toBe(before)
  const down = await face(page, hm(0))
  expect([down.title, down.stats, down.filmCovered], "switched on under a dealt hand, the same card goes face down in place").toEqual(["hidden", "visible", true])
})

test("@curated on: the name and the film are face down, the numbers stay, and the map withholds the names", async ({ page }) => {
  await seatMount(page)
  const n = await page.locator(OWN).count()
  expect(n, "Mount Top deals past nine cards (the printed digit stops at 9)").toBeGreaterThan(9)
  for (let i = 0; i < n; i++) {
    const f = await face(page, `${OWN}:nth-child(${i + 1})`)
    expect([f.title, f.stats, f.filmCovered, f.up], `own card ${i}: name hidden, numbers shown, film covered`).toEqual(["hidden", "visible", true, false])
    expect(f.aria, `own card ${i} is announced without its name, by its place in the row (review R8)`).toBe(`Hidden move ${i + 1}`)
  }
  const t = await face(page, "[data-opponent-threat]")
  expect([t.title, t.filmCovered], "a threat is face down too").toEqual(["hidden", true])
  expect(await mapNames(page), "the map names no dealt move while the row is face down").toEqual([])
  // positive control on the same board: the word turns the mode off, and the same frame path draws the names
  const j = journey(page)
  await j.clickByMouse("[data-hide-switch]", "the word (off)")
  expect((await mapNames(page)).length, "...and names them once the row is face up").toBeGreaterThan(0)
  // REVIEW R2 / T3: pointing at a dealt orb must not name it either. The map's hover is the frame's input
  // (`_hover`, which the canvas pointermove writes); every label the frame then DRAWS is published
  // (`_lastPairLabel`, `_lastHoverLabel`), so the claim is read off the render, not recomputed.
  const orb = await page.evaluate(() => { const a = (window as W).__neural; return a._lastOptLabels[0] as number })
  const pointAt = (idx: number) => page.evaluate(async (idx) => {
    const a = (window as W).__neural, partner = a.nodes[idx].pi
    a._hover = { idx, t: a.now }; a.advance(30)
    const named = (l: any) => !!l && (l.idx === idx || l.idx === partner)
    return { pair: named(a._lastPairLabel), single: named(a._lastHoverLabel) }
  }, idx)
  const shown = await pointAt(orb)
  expect(shown.pair || shown.single, "control: face up, pointing at the orb names it").toBe(true)
  await j.clickByMouse("[data-hide-switch]", "the word (on)")
  expect(await pointAt(orb), "face down, pointing at the same orb names nothing").toEqual({ pair: false, single: false })
  const partner = await page.evaluate((idx) => (window as W).__neural.nodes[idx].pi as number, orb)
  if (partner >= 0) expect(await pointAt(partner), "...nor at its pair partner").toEqual({ pair: false, single: false })
})

/** What the FIRST frame after the pointer enters `sel` shows. The listener is armed before the move, on the card, in
 *  the capture phase, so it runs before the app's own pointerenter and queues its frame first: a reveal deferred by
 *  even one frame reads face down here. Read in that frame, never after a wait. */
async function firstFrame(page: Page, sel: string, at: { x: number; y: number }) {
  await page.evaluate((sel) => {
    const c = document.querySelector(sel) as HTMLElement
    ;(window as W).__firstFrame = new Promise((done) => c.addEventListener("pointerenter", () => requestAnimationFrame(() => done({
      hover: c.hasAttribute("data-hover"), title: getComputedStyle(c.querySelector(".ngchoice-title")!).visibility,
      back: getComputedStyle(c.querySelector(".ng-choice-back")!).display, up: c.hasAttribute("data-revealed"), asking: c.hasAttribute("data-asking"),
    })), { capture: true, once: true }))
  }, sel)
  await page.mouse.move(at.x, at.y)
  return page.evaluate(() => (window as W).__firstFrame)
}

test("@curated hover: the card turns up the moment the pointer is on it, and a sweep turns each card back down as it leaves (owner, 11 Nov)", async ({ page }) => {
  await seatMount(page)
  const p = await pointOn(page, hm(1))
  await page.evaluate(() => { (window as W).__neural._handTouched = false })
  const boxes = () => page.evaluate(() => ["0", "2", "3"].map((i) => { const r = document.querySelector(`[data-hm="${i}"]`)!.getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map((v) => Math.round(v * 10) / 10) }))
  const before = await boxes()
  // the reveal is the pointer arriving: no dwell (it was NG_PEEK_DWELL_MS, 250 ms, until v1.256.3)
  const first = await firstFrame(page, hm(1), p)
  expect(first, "on the first frame after the pointer enters, the card stands out, its name and film are face up, and it asks (no wait, owner 11 Nov)")
    .toEqual({ hover: true, title: "visible", back: "none", up: true, asking: true })
  await expect.poll(() => page.evaluate(() => { const m = new DOMMatrix(getComputedStyle(document.querySelector('[data-hm="1"]')!).transform); return Math.round(m.a * 1000) }),
    { message: "it stands out by a transform on the card alone" }).toBeGreaterThan(1020)
  const up = await face(page, hm(1))
  expect([up.title, up.filmCovered, up.up, up.asking], "it stays face up while the pointer rests on it").toEqual(["visible", false, true, true])
  expect([up.yes, up.no], 'Yes only: "Did you get it?" has no No').toEqual([1, 0])
  expect(up.aria, "face up, it is announced by name").toMatch(/^Attack /)
  const s = await appState(page)
  expect([s.peeks, s.touched], "one peek, and a peek touches the hand (it never re-sorts under a peek)").toEqual([1, true])
  expect(await boxes(), "no layout shift: the neighbours' boxes are where they were (review T1)").toEqual(before)
  await page.mouse.move(p.x, p.y - 160)
  await expect.poll(async () => (await face(page, hm(1))).title, { message: "leaving turns it back down" }).toBe("hidden")

  // a sweep across four cards, 60ms each, as a pointer travelling to a fifth would: each card turns up under it and
  // back down as it leaves; nothing is left open, graded or played
  const pts = []
  for (let i = 0; i < 4; i++) pts.push(await pointOn(page, hm(i)))
  await page.mouse.move(pts[0].x, pts[0].y - 160)
  await page.evaluate(() => {
    const a = (window as W).__neural
    a._handTouched = false
    a.__sweptUp = new Set()
    a.__sweepObs = new MutationObserver((ms) => { for (const m of ms) if ((m.target as HTMLElement).hasAttribute("data-revealed")) a.__sweptUp.add((m.target as HTMLElement).getAttribute("data-hm")) })
    for (let i = 0; i < 4; i++) a.__sweepObs.observe(document.querySelector(`[data-hm="${i}"]`), { attributes: true, attributeFilter: ["data-revealed"] })
  })
  for (const q of pts) { await page.mouse.move(q.x, q.y, { steps: 2 }); await page.waitForTimeout(60) }
  await page.mouse.move(pts[3].x, pts[3].y - 140)
  await page.waitForTimeout(350)
  const sweptUp = await page.evaluate(() => { const a = (window as W).__neural; a.__sweepObs.disconnect(); return [...a.__sweptUp].sort() })
  expect(sweptUp, "every card the sweep crosses turns up under it").toEqual(["0", "1", "2", "3"])
  for (let i = 0; i < 4; i++) expect((await face(page, hm(i))).title, `card ${i} is face down again once the pointer has left it`).toBe("hidden")
  expect(await page.locator("[data-asking]").count(), 'no "Did you get it?" strip is left open behind the sweep').toBe(0)
  const swept = await appState(page)
  expect([await graded(page), swept.executing], "a sweep grades nothing and plays nothing").toEqual([0, false])
  expect([swept.peeks, swept.touched], "each crossed card was a look: four peeks, and the hand is touched").toEqual([4, true])
})

test("@curated Yes files the move as mastered: gold in every row, kept across a reload, and never a play", async ({ page }) => {
  const j = await seatMount(page)
  const p = await pointOn(page, hm(1))
  await page.mouse.move(p.x, p.y)
  await expect.poll(async () => (await face(page, hm(1))).asking).toBe(true)
  const key = await page.evaluate(() => {
    const a = (window as W).__neural, o = a._optionCards.find((c: W) => c.card.getAttribute("data-hm") === "1").opt
    return a._ordById.get(a.siteIdOf(a.nodes[a.currentPos].id)) + "/" + a.playerRole + "|" + a._ordById.get(a.siteIdOf(a.nodes[o.idx].id))
  })
  const [stateKey, moveKey] = key.split("|")
  expect(stateKey, "the state is filed by its permanent share ordinal and the seat").toMatch(/^\d+\/top$/)
  await page.waitForTimeout(ARM)
  await j.clickByMouse(`${hm(1)} [data-grade="yes"]`, '"Yes"')
  const s = await appState(page)
  expect(s.executing, "Yes is not a play").toBe(false)
  expect(s.moves[stateKey]?.[moveKey]?.[3], "the record holds the move as mastered (ok = 1)").toBe(1)
  expect(s.moves[stateKey][moveKey].length).toBe(4)
  const g = await face(page, hm(1))
  expect([g.mastered, g.asking], "the card is gold and asks no more").toEqual([true, false])
  const border = await page.evaluate(() => getComputedStyle(document.querySelector('[data-hm="1"]')!).borderTopColor)
  expect(border, "a thin GOLD outline").toBe("rgba(232, 196, 106, 0.9)")
  await page.mouse.move(p.x, p.y - 160)
  await page.waitForTimeout(200)
  const away = await face(page, hm(1))
  expect([away.title, away.mastered], "face down again, and still gold").toEqual(["hidden", true])
  // the progress blob carries it: a fresh boot with the saved storage deals the same card gold
  await page.waitForTimeout(1200)
  await j.boot("/", { preserveStorage: true })
  await j.land("Mount Top")
  const gold = await page.evaluate(() => (window as W).__neural._optionCards.filter((c: W) => c.card.hasAttribute("data-mastered")).map((c: W) => c.opt.node.t))
  expect(gold.length, "after a reload the mastered move is gold again").toBe(1)
  // ...and in the ordinary row, with the setting off
  await page.evaluate(() => (window as W).__neural.set("hideMoves", false))
  const open = await page.evaluate(() => { const c = (window as W).__neural._optionCards.find((c: W) => c.card.hasAttribute("data-mastered")).card; return { title: getComputedStyle(c.querySelector(".ngchoice-title")).visibility, border: getComputedStyle(c).borderTopColor } })
  expect(open, "gold in the face-up row too").toEqual({ title: "visible", border: "rgba(232, 196, 106, 0.9)" })
})

test("@curated keys play blind, and the stand-in shows the move it played", async ({ page }) => {
  await seatMount(page)
  await page.keyboard.press("3")
  const s = await appState(page)
  expect(s.executing, "3 plays the third card without looking").toBe(true)
  expect(s.stand && [s.stand.hidden, s.stand.title], "the executing stand-in is face up").toEqual([false, "visible"])
})

test("@curated a mouse click on a face-up card plays it, seated where the card was", async ({ page }) => {
  const j = await seatMount(page)
  const p = await pointOn(page, hm(1))
  await page.mouse.move(p.x, p.y)
  await expect.poll(async () => (await face(page, hm(1))).up).toBe(true)
  // the hovered card stands out (scaled about its centre): the stand-in still seats on its LAYOUT box
  const was = await page.evaluate(() => { const c = document.querySelector('[data-hm="1"]') as HTMLElement, r = c.getBoundingClientRect(); return { centre: r.left + r.width / 2, w: c.offsetWidth, scaled: Math.round(r.width) > c.offsetWidth } })
  expect(was.scaled, "precondition: the card is standing out when it is clicked").toBe(true)
  await j.clickByMouse(`${hm(1)} .ngchoice-title`, "the face-up card's name")
  const s = await appState(page)
  expect([s.executing, s.stand && s.stand.hidden], "the click plays it, face up").toEqual([true, false])
  const stand = await page.evaluate(() => { const r = (document.querySelector("[data-executing-tech]") as HTMLElement).getBoundingClientRect(); return r.left + r.width / 2 })
  expect(Math.abs(stand - was.centre), "the stand-in sits where the card was, not a scale's width off").toBeLessThan(1.5)
})

const scaleOf = (page: Page, sel: string) => page.evaluate((sel) => Math.round(new DOMMatrix(getComputedStyle(document.querySelector(sel)!).transform).a * 1000), sel)

test("@curated the film button has its own animation: the card's hover leaves it still, its own hover lifts it", async ({ page }) => {
  // a real approved front, served through the real dossier fetch (the fixture video-cards.spec.ts uses)
  await bootVideoCards(page, "approved")
  await page.evaluate(() => (window as W).__neural.set("hideMoves", true))
  await page.evaluate((c) => { (window as W).__neural._handTouched = true; document.querySelector(c)!.scrollIntoView({ inline: "nearest", block: "nearest" }) }, CARD)
  const p = await pointOn(page, CARD)
  await page.mouse.move(p.x, p.y)
  await expect.poll(async () => (await face(page, CARD)).watch, { message: "face up, the film button shows" }).toBe("visible")
  await page.waitForTimeout(250)
  expect(await scaleOf(page, CARD), "the card stands out").toBeGreaterThan(1020)
  expect(await scaleOf(page, `${CARD} [data-choice-watch]`), "...and its film button does not move with the card's hover").toBe(1000)
  const w = await page.evaluate((c) => { const r = document.querySelector(c + " [data-choice-watch]")!.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } }, CARD)
  await page.mouse.move(w.x, w.y, { steps: 3 })
  await page.waitForTimeout(250)
  expect(await scaleOf(page, `${CARD} [data-choice-watch]`), "hovering the button lifts the button").toBeGreaterThan(1100)
  const lit = await page.evaluate((c) => document.querySelector(c)!.hasAttribute("data-hover"), CARD)
  expect([lit, await scaleOf(page, CARD) > 1020], "...while the card stays lit: the pointer is still inside it").toEqual([true, true])
})

test("@curated reduced motion: a hovered card is lit but does not grow", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })   // test.use({ reducedMotion }) leaves matchMedia false here (§6.4)
  await seatMount(page)
  const p = await pointOn(page, hm(1))
  await page.mouse.move(p.x, p.y)
  await expect.poll(async () => (await face(page, hm(1))).up).toBe(true)
  const r = await page.evaluate(() => { const c = document.querySelector('[data-hm="1"]')!; return { hover: c.hasAttribute("data-hover"), glow: getComputedStyle(c).boxShadow !== "none" } })
  expect([r.hover, r.glow, await scaleOf(page, hm(1))], "lit by its glow, at its own size").toEqual([true, true, 1000])
})

test("@curated the word by Your moves switches hidden moves from the row, in place, and is not a peek (v1.257.0; U121's eye before it)", async ({ page }) => {
  const j = await seatMount(page, false)
  const hand = () => page.evaluate(() => (window as W).__neural._optionCards.map((c: W) => c.opt.node.t).join("|"))
  const before = await hand()
  // its own pointerdown stop: the press never reaches the map's input (attachInput closes a studying deck on every press it sees)
  await page.evaluate(() => { const a = (window as W).__neural, f = a.closeDeckIfStudying; a.__mapPresses = 0; a.closeDeckIfStudying = function (...x: any[]) { a.__mapPresses++; return f.apply(this, x) } })
  const titleColor = await page.evaluate(() => getComputedStyle(document.querySelector("[data-hide-switch]")!.parentElement!).color)
  await j.clickByMouse("[data-hide-switch]", "the word")
  const sw = () => page.evaluate(() => { const e = document.querySelector("[data-hide-switch]") as HTMLElement; return { color: getComputedStyle(e.querySelector(".ng-hide-word > span")!).color } })
  let s = await appState(page)
  expect(await switchWord(page), "on: the word reads Hidden, named for the state").toEqual({ word: "Hidden", name: "Moves hidden" })
  await expect(page.locator("[data-hide-switch]"), "...and that is the name a screen reader gives the button").toHaveAccessibleName("Moves hidden")
  expect((await sw()).color, "in the title's own colour, at full strength (6.5:1 on the map; 50% measured 2.6:1)").toBe(titleColor)
  expect(await page.evaluate(() => (window as W).__neural.get("hideMoves", false)), "the same setting the Settings switch writes").toBe(true)
  expect(await hand(), "the same hand, switched in place").toBe(before)
  const down = await face(page, hm(1))
  expect([down.title, down.filmCovered, down.up], "the dealt row is face down").toEqual(["hidden", true, false])
  expect([s.peeks, Object.keys(s.moves).length, s.executing], "a press on the word is not a peek: nothing turned up, nothing recorded, nothing played").toEqual([0, 0, false])
  expect(await page.evaluate(() => (window as W).__neural.__mapPresses), "the press stopped at the word, before the map's input").toBe(0)
  await j.clickByMouse("[data-hide-switch]", "the word")
  expect([await switchWord(page), (await face(page, hm(1))).title], "off: the word reads Shown, the row face up").toEqual([{ word: "Shown", name: "Moves shown" }, "visible"])
  await expect(page.locator("[data-hide-switch]")).toHaveAccessibleName("Moves shown")
  // control: the probe sees a press that DOES reach the map (empty map, above the row)
  await page.mouse.click(720, 120)
  expect(await page.evaluate(() => (window as W).__neural.__mapPresses), "control: a press on the map itself is counted").toBeGreaterThan(0)
})

test("@curated a press on the word moves nothing beside it: the status slot and the cards keep their places (v1.257.0)", async ({ page }) => {
  const j = await seatMount(page, false)
  // what sits after the word, measured: the status slot's start, the word's own box, card 1's left edge
  const at = () => page.evaluate(() => {
    const sw = document.querySelector("[data-hide-switch]") as HTMLElement, st = sw.parentElement!.querySelector("[data-choice-value-status]")!
    const r = sw.getBoundingClientRect(), c = document.querySelector('[data-hm="0"]')!.getBoundingClientRect()
    return { switchW: Math.round(r.width * 10) / 10, slot: Math.round(st.getBoundingClientRect().left * 10) / 10, card: Math.round(c.left * 10) / 10 }
  })
  const shown = await at()
  await j.clickByMouse("[data-hide-switch]", "the word (to Hidden)")
  expect((await switchWord(page)).word).toBe("Hidden")
  expect(await at(), "Hidden is wider than Shown, and the word's box reserves it: nothing beside the word moves").toEqual(shown)
  await j.clickByMouse("[data-hide-switch]", "the word (to Shown)")
  expect(await at()).toEqual(shown)
})

test("@curated the staged card: an orb tapped on the map is a move you named, so its card is face up", async ({ page }) => {
  const j = journey(page)
  await j.boot("/", { initialState: seed })
  await j.land("Mount Top")
  const name = await page.evaluate(() => {
    const a = (window as W).__neural
    const o = a._optionCards.find((c: W) => !c.opt.threat && c.opt.node.ty !== "submissions")
    a.stageRollAt(o.opt.idx)
    return o.opt.node.t as string
  })
  await expect.poll(() => page.evaluate((t) => ((window as W).__neural._optionCards || []).some((c: W) => c.opt.node.t === t && c.card.hasAttribute("data-revealed")), name),
    { message: `the staged "${name}" card is face up`, timeout: 15000 }).toBe(true)
  const others = await page.evaluate((t) => (window as W).__neural._optionCards.filter((c: W) => c.opt.node.t !== t && !c.opt.threat).map((c: W) => getComputedStyle(c.card.querySelector(".ngchoice-title")).visibility), name)
  expect(new Set(others), "...and only that one").toEqual(new Set(["hidden"]))
})

test("@curated the escape tray is face down too, and an escape files by its own name", async ({ page }) => {
  const j = journey(page)
  await j.boot("/Submissions/Triangle-Choke/from-Triangle-Control/Defender", { initialState: seed })
  await j.advance(4000)
  await expect.poll(() => page.evaluate(() => ((window as W).__neural._optionCards || []).filter((c: W) => c.opt.action === "escape").length)).toBeGreaterThan(1)
  const esc = await page.evaluate(() => {
    const a = (window as W).__neural, cards = a._optionCards.filter((c: W) => c.opt.action === "escape")
    cards.forEach((c: W, i: number) => c.card.setAttribute("data-hm-esc", String(i)))
    return cards.length
  })
  for (let i = 0; i < esc; i++) expect((await face(page, `[data-hm-esc="${i}"]`)).title, `escape ${i} face down`).toBe("hidden")
  const p = await pointOn(page, '[data-hm-esc="0"]')
  await page.mouse.move(p.x, p.y)
  await expect.poll(async () => (await face(page, '[data-hm-esc="0"]')).asking).toBe(true)
  await page.waitForTimeout(ARM)
  await j.clickByMouse('[data-hm-esc="0"] [data-grade="yes"]', '"Yes" on an escape')
  const filed = await page.evaluate(() => {
    const a = (window as W).__neural, o = a._optionCards.find((c: W) => c.card.getAttribute("data-hm-esc") === "0").opt
    const k = a._moveKey(o)
    return { k, row: k && a.moves[k[0]] && a.moves[k[0]][k[1]], expect: "e" + a.qhash(o.label) }
  })
  expect(filed.k && filed.k[1], "an escape files by its label (two escapes may share a destination)").toBe(filed.expect)
  expect(filed.row && filed.row[3]).toBe(1)
})

/** The `moves` record's keys are permanent share ordinals (node_ordinals.json, append-only), so a
 *  seed names them from the committed lockfile — the app's own key, `_moveKey`, is asserted below. */
const ORD = JSON.parse(readFileSync(resolve(__dirname, "../../node_ordinals.json"), "utf8")).ordinals as Record<string, number>
const DAY = 20000

test("@curated what a face-up card asks: unknown Yes only, known and due Still got it Yes / No, known and not due nothing", async ({ page }) => {
  const S = ORD["Positions/Mount"] + "/top"
  const id = { due: "Submissions/Kimura/from-Mount", dueYes: "Submissions/Ezekiel-Choke/from-Mount", fresh: "Submissions/Americana/from-Mount", unknown: "Submissions/Armbar/from-Mount" }
  const moves = { [S]: {
    [ORD[id.due]]: [DAY - 1, 3, DAY - 4, 1],      // known, due yesterday
    [ORD[id.dueYes]]: [DAY, 7, DAY - 7, 1],       // known, due today
    [ORD[id.fresh]]: [DAY + 9, 14, DAY - 5, 1],   // known, not due
  } }
  await page.addInitScript((d) => { (window as W).__NG_EPOCH_DAY__ = d }, DAY)
  const j = journey(page)
  await j.boot("/", { initialState: { ...seed, moves } })
  await j.land("Mount Top")
  await page.evaluate((id) => { for (const c of (window as W).__neural._optionCards) for (const [k, v] of Object.entries(id)) if (c.opt.node.id === v && !c.opt.threat) c.card.setAttribute("data-hk", k) }, id)
  const ask = async (k: string) => {
    const p = await pointOn(page, `[data-hk="${k}"]`)
    await page.mouse.move(p.x, p.y); await page.waitForTimeout(400)
    const r = await page.evaluate((k) => { const c = document.querySelector(`[data-hk="${k}"]`)!; return { asking: c.hasAttribute("data-asking"), q: c.querySelector("[data-choice-grade] span")?.textContent || null, yes: c.querySelectorAll('[data-grade="yes"]').length, no: c.querySelectorAll('[data-grade="no"]').length, gold: c.hasAttribute("data-mastered"), up: c.hasAttribute("data-revealed") } }, k)
    return { p, r }
  }
  const away = (p: { x: number; y: number }) => page.mouse.move(p.x, p.y - 160).then(() => page.waitForTimeout(150))
  expect(await page.evaluate((s) => { const a = (window as W).__neural, o = a._optionCards.find((c: W) => c.card.getAttribute("data-hk") === "due").opt; return a._moveKey(o).join(">") === s }, S + ">" + ORD[id.due]), "the app files Kimura from Mount under the lockfile's ordinals").toBe(true)

  const u = await ask("unknown")
  expect(u.r, "a move you do not know yet: Did you get it? Yes only").toEqual({ asking: true, q: "Did you get it?", yes: 1, no: 0, gold: false, up: true })
  await away(u.p)
  const f = await ask("fresh")
  expect(f.r, "known and not due: face up, gold, asks nothing").toEqual({ asking: false, q: null, yes: 0, no: 0, gold: true, up: true })
  await away(f.p)

  const d = await ask("due")
  expect(d.r, "known and due: Still got it? Yes / No").toEqual({ asking: true, q: "Still got it?", yes: 1, no: 1, gold: true, up: true })
  await page.waitForTimeout(ARM)
  await j.clickByMouse('[data-hk="due"] [data-grade="no"]', '"No"')
  const no = await page.evaluate((k) => { const a = (window as W).__neural, c = document.querySelector('[data-hk="due"]')!; return { gold: c.hasAttribute("data-mastered"), row: a.moves[k[0]][k[1]], executing: !!a._execution } }, [S, String(ORD[id.due])])
  expect(no.executing, "No is not a play").toBe(false)
  expect([no.gold, no.row[3], no.row[1], no.row[2]], "No takes the gold away and starts the schedule over (rung 0, answered today)").toEqual([false, 0, 1, DAY])
  await away(d.p)
  const again = await ask("due")
  expect([again.r.q, again.r.no], "...so next time it is a move you do not know yet").toEqual(["Did you get it?", 0])
  await away(again.p)

  const y = await ask("dueYes")
  expect(y.r.q).toBe("Still got it?")
  await page.waitForTimeout(ARM)
  await j.clickByMouse('[data-hk="dueYes"] [data-grade="yes"]', '"Yes" on a due card')
  const yes = await page.evaluate((k) => { const a = (window as W).__neural; return { gold: document.querySelector('[data-hk="dueYes"]')!.hasAttribute("data-mastered"), row: a.moves[k[0]][k[1]] } }, [S, String(ORD[id.dueYes])])
  expect([yes.gold, yes.row[3], yes.row[2]], "Yes keeps it gold, answered today").toEqual([true, 1, DAY])
  expect(yes.row[0], "...and moves its due date on past today").toBeGreaterThan(DAY)
})

/** where card `sel`'s Yes (and the strip's text) sit once it is face up: measured on the real strip, then the card
 *  is closed again, so the next press lands where the button WILL appear */
async function stripPoints(page: Page, sel: string, open: () => Promise<void>, close: () => Promise<void>) {
  await open()
  await expect.poll(async () => (await face(page, sel)).asking).toBe(true)
  const pt = await page.evaluate((sel) => {
    const c = document.querySelector(sel)!, y = c.querySelector('[data-grade="yes"]')!.getBoundingClientRect(), t = c.querySelector("[data-choice-grade] span")!.getBoundingClientRect()
    return { yes: { x: y.left + y.width / 2, y: y.top + y.height / 2 }, text: { x: t.left + 6, y: t.top + t.height / 2 } }
  }, sel)
  await close()
  await expect.poll(async () => (await face(page, sel)).up).toBe(false)
  return pt
}
const graded = (page: Page) => page.evaluate(() => Object.values((window as W).__neural.moves || {}).reduce((n: number, r: any) => n + Object.keys(r).length, 0))

test("@curated a press on a grade button that began before it could be seen does nothing; armed, it grades; the strip's text plays", async ({ page }) => {
  const j = await seatMount(page)
  const p = await pointOn(page, hm(1))
  const pt = await stripPoints(page, hm(1), () => page.mouse.move(p.x, p.y), () => page.mouse.move(p.x, p.y - 160))
  // the pointer rests where Yes WILL appear; the card turns up at once and the strip arrives under it
  await page.mouse.move(pt.yes.x, pt.yes.y)
  await expect.poll(async () => (await face(page, hm(1))).asking, { message: "the strip arrives under the resting pointer" }).toBe(true)
  await page.mouse.click(pt.yes.x, pt.yes.y)
  let s = await appState(page)
  expect([await graded(page), s.executing], "a click that began before the button was armed: no grade, no play (review R3)").toEqual([0, false])
  await page.waitForTimeout(ARM)
  await page.mouse.click(pt.yes.x, pt.yes.y)
  s = await appState(page)
  expect([await graded(page), s.executing], "armed, the same click grades and plays nothing").toEqual([1, false])
  // a second card: a press on the strip's TEXT reaches the card, as any press on the card does
  const q = await pointOn(page, hm(2))
  await page.mouse.move(q.x, q.y)
  await expect.poll(async () => (await face(page, hm(2))).asking).toBe(true)
  const tx = await page.evaluate(() => { const t = document.querySelector('[data-hm="2"] [data-choice-grade] span')!.getBoundingClientRect(); return { x: t.left + 6, y: t.top + t.height / 2 } })
  await page.waitForTimeout(ARM)
  await page.mouse.click(tx.x, tx.y)
  s = await appState(page)
  expect([s.executing, s.stand && s.stand.hidden], "the strip's text is not a button: the press plays the card").toEqual([true, false])
})

test("@curated Enter on a focused card: face down it turns up, face up it plays, whatever pointer pressed last (review R7)", async ({ page }) => {
  await seatMount(page)
  // a mouse press on card 2 that is not a click (down, away, up): it was the last pointer, and the card went back
  // down as the pointer left it
  const p = await pointOn(page, hm(2))
  await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.mouse.move(p.x, p.y - 160); await page.mouse.up()
  await page.waitForTimeout(300)
  expect((await face(page, hm(2))).up, "precondition: still face down").toBe(false)
  for (const k of ["2", "4"]) {
    await page.evaluate((k) => (document.querySelector(`[data-hm="${k}"] [data-choice-execute]`) as HTMLElement).focus(), k)
    await page.keyboard.press("Enter")
    const f = await face(page, hm(Number(k)))
    expect([f.up, f.title, (await appState(page)).executing], `card ${k}: Enter turns a face-down card up and plays nothing`).toEqual([true, "visible", false])
    if (k === "2") continue
    await page.keyboard.press("Enter")
    const s = await appState(page)
    expect([s.executing, s.stand && s.stand.hidden], "Enter on the face-up card plays it").toEqual([true, false])
  }
})

test("@curated a pull that flips the setting mid-hand re-syncs the row and the map (review R9)", async ({ page }) => {
  await seatMount(page, false)
  // the live receipt path: `_pullAndMerge` and another tab's write both land through `_hydrateProgressBlob`
  const pull = (on: boolean) => page.evaluate((on) => {
    const a = (window as W).__neural, b = a._progressBlob()
    a._hydrateProgressBlob({ ...b, settings: { ...b.settings, hideMoves: on }, settingsAt: { ...b.settingsAt, hideMoves: Date.now() } })
  }, on)
  await pull(true)
  const down = await face(page, hm(0))
  expect([down.title, down.filmCovered, (await switchWord(page)).word], "a pull turning it on: the dealt row goes face down in place, the word with it").toEqual(["hidden", true, "Hidden"])
  expect(await mapNames(page), "...and the map names nothing").toEqual([])
  await pull(false)
  const open = await face(page, hm(0))
  expect([open.title, open.filmCovered, (await switchWord(page)).word], "a pull turning it off: face up again").toEqual(["visible", false, "Shown"])
  expect((await mapNames(page)).length, "...and the map names the moves again").toBeGreaterThan(0)
})

test.describe("touch", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } })

  test("@curated a first tap turns the card up and plays nothing; Yes is a 44px target; a second tap plays", async ({ page }) => {
    await seatMount(page)
    const p = await pointOn(page, hm(1))
    await page.touchscreen.tap(p.x, p.y)
    let s = await appState(page)
    const f = await face(page, hm(1))
    expect([s.executing, f.title, f.asking], "the first tap reveals, consumed").toEqual([false, "visible", true])
    // the Yes target: 44px tall, and its own top and bottom edges are its own (no neighbour steals them)
    const yes = await page.evaluate(() => {
      const b = document.querySelector('[data-hm="1"] [data-grade="yes"]') as HTMLElement
      const r = b.getBoundingClientRect(), x = r.left + r.width / 2
      const own = (y: number) => { const t = document.elementFromPoint(x, y); return !!t && b.contains(t) }
      return { h: Math.round(r.height), top: own(r.top + 2), bottom: own(r.bottom - 2), x, y: r.top + r.height / 2 }
    })
    expect([yes.h >= 44, yes.top, yes.bottom], "Yes is a 44px touch target, edge to edge").toEqual([true, true, true])
    await page.waitForTimeout(ARM)
    await page.touchscreen.tap(yes.x, yes.y)
    s = await appState(page)
    expect(s.executing, "a tap on Yes grades and plays nothing").toBe(false)
    expect((await face(page, hm(1))).mastered).toBe(true)
    // another card's first tap closes this one
    const q = await pointOn(page, hm(0))
    await page.touchscreen.tap(q.x, q.y)
    expect([(await face(page, hm(1))).title, (await face(page, hm(0))).title], "one card up at a time on touch").toEqual(["hidden", "visible"])
    await page.touchscreen.tap(q.x, q.y)
    s = await appState(page)
    expect(s.executing, "the second tap plays it").toBe(true)
    expect(s.stand && s.stand.hidden).toBe(false)
  })

  test("@curated touch: a second tap where Yes appeared does nothing until the button is armed (review R3)", async ({ page }) => {
    await seatMount(page)
    const p = await pointOn(page, hm(1)), o = await pointOn(page, hm(0))
    const pt = await stripPoints(page, hm(1), () => page.touchscreen.tap(p.x, p.y), () => page.touchscreen.tap(o.x, o.y))
    // the first tap lands where Yes will be: it turns the card up (consumed); the second, at once, in the same place
    await page.touchscreen.tap(pt.yes.x, pt.yes.y)
    await expect.poll(async () => (await face(page, hm(1))).asking).toBe(true)
    await page.touchscreen.tap(pt.yes.x, pt.yes.y)
    let s = await appState(page)
    expect([await graded(page), s.executing], "the second tap, before the button was armed: no grade, no play").toEqual([0, false])
    await page.waitForTimeout(ARM)
    await page.touchscreen.tap(pt.yes.x, pt.yes.y)
    s = await appState(page)
    expect([await graded(page), s.executing], "armed, a tap on Yes grades and plays nothing").toEqual([1, false])
  })

  test("@curated Still got it on touch: Yes and No are both 44px targets, whole inside the card", async ({ page }) => {
    const S = ORD["Positions/Mount"] + "/top", due = "Submissions/Americana/from-Mount"
    await page.addInitScript((d) => { (window as W).__NG_EPOCH_DAY__ = d }, DAY)
    const j = journey(page)
    await j.boot("/", { initialState: { ...seed, moves: { [S]: { [ORD[due]]: [DAY - 1, 3, DAY - 4, 1] } } } })
    await j.land("Mount Top")
    await page.evaluate((id) => { const c = (window as W).__neural._optionCards.find((c: W) => c.opt.node.id === id && !c.opt.threat); c.card.setAttribute("data-hk", "due") }, due)
    const p = await pointOn(page, '[data-hk="due"]')
    await page.touchscreen.tap(p.x, p.y)
    const t = await page.evaluate(() => {
      const c = document.querySelector('[data-hk="due"]')!, cr = c.getBoundingClientRect()
      return [...c.querySelectorAll("[data-grade]")].map((b) => {
        const r = b.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2
        const own = (px: number, py: number) => { const e = document.elementFromPoint(px, py); return !!e && b.contains(e) }
        return { g: (b as HTMLElement).dataset.grade, w: r.width >= 44, h: r.height >= 44, inside: r.left >= cr.left - 0.5 && r.right <= cr.right + 0.5,
          edges: own(r.left + 2, y) && own(r.right - 2, y) && own(x, r.top + 2) && own(x, r.bottom - 2) }
      })
    })
    expect(t, "Yes and No: 44 x 44, inside the card, every edge their own").toEqual([
      { g: "yes", w: true, h: true, inside: true, edges: true }, { g: "no", w: true, h: true, inside: true, edges: true }])
  })

  test("@curated touch: the word's target is the whole free band (44 x 40), covers neither Your moves, card 1 nor the hand's close, and a card left up stays unnamed after off and on (v1.257.0; the eye's claim, U121)", async ({ page }) => {
    await seatMount(page)
    const g = await page.evaluate(() => {
      const e = document.querySelector("[data-hide-switch]") as HTMLElement, title = e.parentElement!, r = e.getBoundingClientRect()
      const range = document.createRange(); range.selectNodeContents(title.firstChild!); const lab = range.getBoundingClientRect()
      const x = (window as W).__neural._handCloseEl, xr = x ? x.getBoundingClientRect() : null
      const own = (px: number, py: number) => { const t = document.elementFromPoint(px, py); return !!t && e.contains(t) }
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2
      const apart = (b: DOMRect | null) => !b || r.right <= b.left || r.left >= b.right || r.bottom <= b.top || r.top >= b.bottom
      const card = document.querySelector('[data-hm="0"]')!.getBoundingClientRect(), row = (window as W).__neural.optionsRef.current.getBoundingClientRect()
      return { w: r.width >= 44, h: r.height >= 40, inBand: r.top >= row.top - 0.5 && r.bottom <= card.top + 0.5, edges: own(r.left + 2, cy) && own(r.right - 2, cy) && own(cx, r.top + 2) && own(cx, r.bottom - 2),
        label: lab.width > 10 && apart(lab), close: apart(xr), line: Math.round(title.getBoundingClientRect().height), motion: getComputedStyle(e).transitionDuration, x: cx, y: cy }
    })
    // 44 TALL IS NOT AVAILABLE HERE: the band between the row's clip and card 1's top is 40px (8 padding, 24 line, 8
    // gap). The word takes all of it, edge to edge its own, and steals no press from the card (§6.1's padded-target trap).
    expect([g.w, g.h, g.inBand, g.edges], "44 wide, the full 40px band, inside it, edge to edge its own").toEqual([true, true, true, true])
    expect([g.label, g.close, g.line], "it covers neither Your moves nor the close, and the title's line stays 24px").toEqual([true, true, 24])
    expect(g.motion, "no transition to remove under reduced motion").toBe("0s")
    // a card left face up by a tap, then the word off and on: the card is down again, and its orb unnamed
    const p = await pointOn(page, hm(1))
    await page.touchscreen.tap(p.x, p.y)
    expect((await face(page, hm(1))).up).toBe(true)
    const orb = await page.evaluate(() => (window as W).__neural._optionCards.find((c: W) => c.card.getAttribute("data-hm") === "1").opt.idx as number)
    await page.touchscreen.tap(g.x, g.y)
    expect((await switchWord(page)).word, "a tap turns it off").toBe("Shown")
    await page.touchscreen.tap(g.x, g.y)
    expect([(await face(page, hm(1))).up, (await switchWord(page)).word], "...and on: the card is face down").toEqual([false, "Hidden"])
    const named = await page.evaluate(async (idx) => { const a = (window as W).__neural; a._hover = { idx, t: a.now }; a.advance(30); const l = a._lastHoverLabel, q = a._lastPairLabel; return !!((l && l.idx === idx) || (q && q.idx === idx)) }, orb)
    expect(named, "...and its orb is not named on the map").toBe(false)
  })

  test("@curated the badge reads Tap to reveal on the Suggested card while it is down", async ({ page }) => {
    await seatMount(page)
    await expect.poll(() => page.evaluate(() => [...document.querySelectorAll("[data-choice-recommended]")].some((b) => (b.textContent || "").length > 0)), { timeout: 30000 }).toBe(true)
    const badge = await page.evaluate(() => {
      const b = [...document.querySelectorAll("[data-choice-recommended]")].find((b) => (b.textContent || "").length > 0) as HTMLElement
      return { after: getComputedStyle(b, "::after").content, text: b.textContent, size: getComputedStyle(b).fontSize }
    })
    expect([badge.after, badge.size], "the badge's own text is untouched and drawn as Tap to reveal").toEqual(['"Tap to reveal"', "0px"])
  })
})
