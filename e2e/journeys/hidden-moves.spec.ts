import { expect, test, type Page } from "@playwright/test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { journey } from "../dsl"
import { bootVideoCards, CARD } from "../fixtures/video-cards"

/** HIDDEN MOVES (v1.255.0, owner U115 b + U116, 10 Nov 2026).
 *
 * "Hide moves until I look" (Rolling settings, `hideMoves`, off by default) deals the row with each
 * card's NAME and FILM face down — Works % and Win % stay — and withholds the map's names of the
 * dealt moves. A hover (after NG_PEEK_DWELL_MS) or a tap turns one card up and asks "Did you get
 * it?"; a Yes files the move in the `moves` record as MASTERED and the card wears thin gold in every
 * row. "Show all" turns the row up for the turn; keys 1-9 still play blind.
 *
 * HIDDENNESS IS NEVER READ FROM TEXT. Hiding is CSS on an attribute, so a face-down card's
 * `textContent` still holds its name (every other reader of the card depends on that). Each claim
 * here reads computed visibility, the back's geometry against the film slot, or `elementFromPoint`.
 *
 * Mutants (v1.255.0): 25 app/CSS mutants, each run against the ONE test named for its claim, all
 * killed with that claim's own message; runner and table in docs/Changelog-Archive.md (v1.255.0).
 * Claims: the name's visibility:hidden · the dwell (peek on enter) · the first tap consumed · the
 * stand-in face up · `moves` in the blob · the map's label gate · Show all asks nothing · "Hidden move
 * N" · a peek touches the hand · the staged card face up · an escape filed by label · No takes the
 * gold away · No recorded as ok 0 · a due card offers No · known-and-not-due asks nothing · Yes only
 * on an unknown card · the gold border · the hover transform · the stand-in seated on the layout box ·
 * the 44px touch Yes · "Tap to reveal" · the live switch · the film button still under the card's
 * hover · the film button's own hover · reduced motion. The merge rule's two mutants are killed by
 * tests/moves_record.test.mjs. NOT COVERED here: the header-hint variant (NG_HIDE_HINT = "header",
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

/** the map's dealt-move names drawn on the latest frame */
const mapNames = async (page: Page) => {
  await journey(page).advance(50)
  return page.evaluate(() => { const a = (window as W).__neural; return (a._lastOptLabels || []).map((i: number) => a.nodes[i].t) })
}

test("@curated off by default: the row is dealt as before, and the setting turns it face down in place", async ({ page }) => {
  await seatMount(page, false)
  expect(await page.locator("[data-hide], .ng-choice-back, [data-hide-all], [data-choice-grade]").count(), "no hidden-moves DOM while off").toBe(0)
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
  for (let i = 0; i < Math.min(n, 6); i++) {
    const f = await face(page, `${OWN}:nth-child(${i + 1})`)
    expect([f.title, f.stats, f.filmCovered, f.up], `own card ${i}: name hidden, numbers shown, film covered`).toEqual(["hidden", "visible", true, false])
    expect(f.aria, `own card ${i} is announced without its name`).toBe(`Hidden move ${i + 1}`)
  }
  const t = await face(page, "[data-opponent-threat]")
  expect([t.title, t.filmCovered], "a threat is face down too").toEqual(["hidden", true])
  expect(await mapNames(page), "the map names no dealt move while the row is face down").toEqual([])
  // positive control on the same board: face up, the same frame path draws the names
  await journey(page).clickByMouse("[data-hide-all]", '"Show all"')
  expect((await mapNames(page)).length, "...and names them once the row is face up").toBeGreaterThan(0)
})

test("@curated hover: the card stands out at once, turns up only after the dwell, and a sweep peeks at nothing", async ({ page }) => {
  await seatMount(page)
  await page.evaluate(() => { (window as W).__neural._handTouched = false })
  // a sweep across four cards, 60ms each, as a pointer travelling to a fifth would
  const pts = []
  for (let i = 0; i < 4; i++) pts.push(await pointOn(page, hm(i)))
  await page.evaluate(() => { (window as W).__neural._handTouched = false })
  for (const p of pts) { await page.mouse.move(p.x, p.y, { steps: 2 }); await page.waitForTimeout(60) }
  await page.mouse.move(pts[3].x, pts[3].y - 140)
  await page.waitForTimeout(350)
  const swept = await appState(page)
  expect(swept.peeks, "a sweep counts no peek").toBe(0)
  for (let i = 0; i < 4; i++) expect((await face(page, hm(i))).title, `card ${i} stayed face down through the sweep`).toBe("hidden")
  expect(swept.touched, "...and does not touch the hand").toBe(false)

  const p = await pointOn(page, hm(1))
  await page.evaluate(() => { (window as W).__neural._handTouched = false })
  await page.mouse.move(p.x, p.y)
  await page.waitForTimeout(120)
  const early = await page.evaluate(() => { const c = document.querySelector('[data-hm="1"]') as HTMLElement; return { hover: c.hasAttribute("data-hover"), title: getComputedStyle(c.querySelector(".ngchoice-title")!).visibility } })
  expect(early, "at 120ms the card stands out and is still face down").toEqual({ hover: true, title: "hidden" })
  await expect.poll(() => page.evaluate(() => { const m = new DOMMatrix(getComputedStyle(document.querySelector('[data-hm="1"]')!).transform); return Math.round(m.a * 1000) }),
    { message: "it stands out by a transform on the card alone" }).toBeGreaterThan(1020)
  await page.waitForTimeout(250)
  const up = await face(page, hm(1))
  expect([up.title, up.filmCovered, up.up, up.asking], "after the dwell it is face up and asks").toEqual(["visible", false, true, true])
  expect([up.yes, up.no], 'Yes only: "Did you get it?" has no No').toEqual([1, 0])
  expect(up.aria, "face up, it is announced by name").toMatch(/^Attack /)
  const s = await appState(page)
  expect([s.peeks, s.touched], "one peek, and a peek touches the hand (it never re-sorts under a peek)").toEqual([1, true])
  expect(await page.evaluate(() => { const r = (window as W).__neural.optionsRef.current; return r.scrollWidth >= r.clientWidth && getComputedStyle(r).overflowY }), "no layout shift: the row keeps its own overflow").toBe("hidden")
  await page.mouse.move(p.x, p.y - 160)
  await page.waitForTimeout(250)
  expect((await face(page, hm(1))).title, "leaving turns it back down").toBe("hidden")
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

test("@curated Show all: the whole row face up for the turn, nothing asked; Hide all turns it back", async ({ page }) => {
  const j = await seatMount(page)
  await j.clickByMouse("[data-hide-all]", '"Show all"')
  const titles = await page.evaluate(() => [...document.querySelectorAll(".ng-choice-card .ngchoice-title")].map((t) => getComputedStyle(t).visibility))
  expect(titles.length).toBeGreaterThan(6)
  expect(new Set(titles), "every card, yours and the threats, face up").toEqual(new Set(["visible"]))
  const p = await pointOn(page, hm(2))
  await page.mouse.move(p.x, p.y); await page.waitForTimeout(400)
  expect((await face(page, hm(2))).asking, "Show all is looking at the answers: it asks nothing").toBe(false)
  expect(await page.locator("[data-hide-all]").textContent()).toBe("Hide all")
  await page.mouse.move(p.x, p.y - 160)
  await j.clickByMouse("[data-hide-all]", '"Hide all"')
  expect((await face(page, hm(2))).title, "Hide all turns the row back down").toBe("hidden")
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
  await j.clickByMouse('[data-hk="dueYes"] [data-grade="yes"]', '"Yes" on a due card')
  const yes = await page.evaluate((k) => { const a = (window as W).__neural; return { gold: document.querySelector('[data-hk="dueYes"]')!.hasAttribute("data-mastered"), row: a.moves[k[0]][k[1]] } }, [S, String(ORD[id.dueYes])])
  expect([yes.gold, yes.row[3], yes.row[2]], "Yes keeps it gold, answered today").toEqual([true, 1, DAY])
  expect(yes.row[0], "...and moves its due date on past today").toBeGreaterThan(DAY)
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
