import { expect, test, type Page } from "@playwright/test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { journey } from "../dsl"

/** A MOVE YOU KNOW WEARS A GOLD SEAL, NOT A GOLD OUTLINE (v1.272.0, the owner, 13 Nov 2026).
 *
 * His complaint: "The mastered cards show up with a golden outline, and this is confusing. It seems like this is the
 * selected technique, and we're trying to guess this technique." His pick, "a, A gold seal in the corner": "A small
 * filled seal: you answered Yes here. A hollow one: its flashcards are learned. It reads as a stamp on the card"; the
 * question said "Whatever you pick replaces the gold outline everywhere a move wears it today" and "In every one, the
 * move being asked is the only thing with a strong outline."
 *
 * THE RULE, one state per move (`_moveState`, the same read that decides the face with moves hidden):
 *   known    a Yes in the row, not due                     data-seal="known"    a FILLED gold disc
 *   learned  never answered, its flashcards learned, none due data-seal="learned" a HOLLOW gold ring
 *   due      a Yes in the row, due                          no seal (it is the card asked "Still got it?")
 *   new      never met (or a No)                            no seal
 * The card's border is the ordinary one in every state.
 *
 * THE SEAT: Mount Top, five dealt moves seeded by their permanent share ordinals (node_ordinals.json), the seeds of
 * known-moves-shown.spec.ts: known Americana (a Yes, due in 9 days) · due Kimura (a Yes, due yesterday) · fresh Armbar
 * (no row) · learned Cross Collar Choke (every flashcard at stage 3, none due) · learnedDue Loop Choke (the same, one
 * card due). The day is the app's own seam (`__NG_EPOCH_DAY__`); it moves the way it does for a tab left open
 * overnight (a visibilitychange with the page visible). The long row is Closed Guard bottom (31 cards in gi).
 *
 * WHAT A PLAYER SEES, measured at the real card, never constants: the seal's rect inside the card's and off the
 * title band, the name's text, the numbers, the play circle and the Suggested badge; its size and insets as RATIOS of
 * the card's own unit (its title's side padding: 2 units across, 1 in from the inner edge, 1 below the title band); its
 * opacity down the ancestor chain, visibility and `elementFromPoint` at its centre (not covered); filled against
 * hollow by the LIGHT of its inside (the screenshot's pixels: a lit disc against a dark ring, so not by hue alone);
 * the card's border and shadow against a never-met card's own; the words on hover (`title`) and in the accessible name.
 * Presses: `j.clickByMouse` and `page.mouse` at measured points; `page.touchscreen.tap` at measured points.
 * WHAT THE HARNESS DOES NOT SERVE (§6.4): the DSL answers every dossier chunk with `{}`, so no card would have a play
 * circle and "off the play circle" would never be measured. This file serves the build's REAL chunks (unmodified, from
 * source/public), so the cards wear their real play circles, and each test asserts the circle was measured.
 *
 * A HOLLOW CARD ASKS NOTHING (v1.268.0: face up, its first tap plays), so "a Yes on the hollow one" is reached the two
 * ways a player reaches it: its flashcards come due (face down, no seal), a look asks "Did you get it?", a Yes; and a
 * Yes given on another device, pulled in place. Both fill the seal, on the same element.
 *
 * MUTANTS (v1.272.0), each on the SERVED bundle at an anchor matching exactly once, the whole file run against each
 * (tests/artifacts/_seal_mutants.sh); the baseline green before and after, 4 of 4:
 *   M0 control, a warn string's case                          green, 4 of 4
 *   M1 the gold outline back (dev's own rule, on data-seal)   red 4 of 4 at "...: the card's border is the ordinary one"
 *   M2 the hollow seal on a move with a due flashcard          red 3 (the three with learnedDue) at "learnedDue: no seal"
 *   M3 the filled seal on a due move                           red 3 at "due: no seal", moves shown AND hidden
 *   M4 the seal painted at the deal only, the face alone repainted (a face-down card keeps its seal)
 *                                                              red 3: "the known move, now due and face down: no seal",
 *                                                              "another device's Yes ...: the seal fills", "320, k0: ..."
 *   M5 filled and hollow swapped                               red 4 of 4 at "known: data-seal "known" and one seal"
 *   M6 the seal over the title, at 320 wide only (a media rule) red 1, the 320 test alone, at "off the title band"
 *   M7 the card asked by touch wears no outline (as on dev)    red 1, the 390 test alone, at "the card asked by touch
 *                                                              wears the strong outline"
 *   THE MAP (its own commit; the two "the map" tests below, 1440 and 390):
 *   M8 the map's gold outline back (dev's stroke, beside the dot)  red 2 at "no gold outline left: every pixel the known
 *                                                              set changes lies inside a published dot" (524 / 334 px)
 *   M9 a dot on every dealt move's orb, known or not           red 2 at "no dot on any node the moves record does not know"
 *   M10 the dot at the node's stored y (n.y), not LY           red 2 at "dot 946 sits on a shoulder of its orb, where the
 *                                                              frame drew the orb (LY)" (25.7 / 15.4 px off)
 *   dev's own bundle (every file)                              red 6 of 6 (the card's four at "known: data-seal ...", the
 *                                                              map's two at "a dot on every known move's orb in view")
 * NOT COVERED here: the hover words' TOOLTIP itself (a browser tooltip cannot be read; its `title` is asserted, and the
 * pointer meets the seal); the light/dark poster frames (the pictures, tests/artifacts/_seal_shoot.mjs; the spec checks
 * the seal is lit or dark INSIDE, whatever the poster); a known escape's or threat's seal (the units: escape; the same
 * `_sealCard` paints every dealt card). The map: the pair label, hover label and lit labels are drawn AFTER the dots
 * (over them), and only the option names steer a dot (`_lastOptBoxes`); a dot whose four shoulders are all covered by
 * names stays up-right. The map's dot under mastery gold, and on the focus mark, are in the pictures, not asserted.
 */

type W = any
const ORD = JSON.parse(readFileSync(resolve(__dirname, "../../node_ordinals.json"), "utf8")).ordinals as Record<string, number>
const DAY = 20000
const S = ORD["Positions/Mount"] + "/top"
const ID = { known: "Submissions/Americana/from-Mount", due: "Submissions/Kimura/from-Mount", fresh: "Submissions/Armbar/from-Mount",
  learned: "Submissions/Cross-Collar-Choke/from-Mount", learnedDue: "Submissions/Loop-Choke/from-Mount" }
const ROWS = { [ORD[ID.known]]: [DAY + 9, 14, DAY - 5, 1], [ORD[ID.due]]: [DAY - 1, 3, DAY - 4, 1] }
const ARM = 600              // the grade buttons answer only a press that began NG_GRADE_ARM_MS (500 ms) after the strip appeared
const NEXT = DAY + 10        // past the known move's due date
const LEARNED_DUE = DAY + 30 // the learned decks' cards come due here
const WORDS = { known: "You know this move", learned: "Flashcards learned" }

/** the build's own dossier chunks, unmodified: the cards' real play circles (the DSL serves `{}`) */
const realContent = async (p: Page) => { await p.route("**/static/neural/content/*.json", (r) =>
  r.fulfill({ body: readFileSync(resolve(__dirname, "../../source/public/static/neural/content", new URL(r.request().url()).pathname.split("/").pop()!), "utf8"), contentType: "application/json" })) }

/** the two learned decks' keys and question hashes, from the app itself, once per file (never an awaited deck: §6.4) */
let DECKS: Record<"learned" | "learnedDue", { key: string; qh: string[] }> | null = null
async function decks(page: Page) {
  if (DECKS) return DECKS
  await journey(page).boot("/")
  const keys = await page.evaluate((ids) => {
    const a = (window as W).__neural, out: W = {}
    for (const [k, id] of Object.entries(ids)) {
      const key = out[k] = a.deckKeyFor(a.nodes.find((n: W) => n.id === id && n.role !== "defender")).key
      if (!a._deckHasCards(key)) void a.hydrateDeck(key)
    }
    return out as Record<string, string>
  }, { learned: ID.learned, learnedDue: ID.learnedDue })
  await expect.poll(() => page.evaluate((keys) => Object.values(keys).every((k) => (window as W).__neural._deckHasCards(k)), keys), { message: "both decks landed" }).toBe(true)
  DECKS = await page.evaluate((keys) => {
    const a = (window as W).__neural
    return Object.fromEntries(Object.entries(keys).map(([k, key]) => [k, { key, qh: a._cardsOf(a.flashcards.decks[key]).map((c: W) => a.qhash(c.q)) }]))
  }, keys) as W
  expect(DECKS!.learnedDue.qh.length, "the learnedDue deck has more than one card").toBeGreaterThan(1)
  return DECKS!
}

async function seat(page: Page, hidden: boolean) {
  const D = await decks(page)
  const stage = Object.fromEntries(Object.values(D).map((d) => [d.key, Object.fromEntries(d.qh.map((q) => [q, 3]))]))
  const srs = Object.fromEntries(Object.entries(D).map(([k, d]) => [d.key, Object.fromEntries(d.qh.map((q, i) =>
    [q, k === "learnedDue" && i === 0 ? [DAY - 1, 7, DAY - 8] : [LEARNED_DUE, 30, DAY - 2]]))]))
  await page.addInitScript((d) => { (window as W).__NG_EPOCH_DAY__ = d }, DAY)
  const j = journey(page)
  await j.boot("/", { beforeNavigate: realContent, initialState: { v: 2, settings: { hideMoves: hidden }, settingsAt: { hideMoves: 1 }, moves: { [S]: ROWS }, stage, srs } })
  await j.land("Mount Top")
  await expect.poll(() => page.evaluate(() => ((window as W).__neural._optionCards || []).filter((c: W) => !c.opt.threat).length)).toBeGreaterThan(3)
  const n = await page.evaluate((id) => {
    const a = (window as W).__neural
    a._handTouched = true   // the hand keeps its order from here
    let n = 0
    for (const c of a._optionCards) for (const [k, v] of Object.entries(id)) if (c.opt.node.id === v && !c.opt.threat) { c.card.setAttribute("data-ks", k); n++ }
    return n
  }, ID)
  expect(n, "the five seeded moves are dealt at Mount Top").toBe(5)
  return j
}

/** The card `sel` names, as a player sees it: its seal, measured at the real card. */
const look = (page: Page, sel: string) => page.evaluate((sel) => {
  const c = document.querySelector(sel) as HTMLElement
  const R = (el: Element | null) => { if (!el) return null; const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height } }
  const meet = (a: W, b: W) => !!a && !!b && a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b
  const seal = c.querySelector("[data-choice-seal]") as HTMLElement | null
  const cs = getComputedStyle(c), plainEl = [...document.querySelectorAll('[data-choice-group="you"] .ng-choice-card')]
    .find((x) => !x.hasAttribute("data-seal") && !x.hasAttribute("data-hover") && !x.hasAttribute("data-asking") && x !== c) as HTMLElement
  const ps = getComputedStyle(plainEl), edge = (s: CSSStyleDeclaration) => [s.borderTopColor, s.borderTopWidth, s.borderLeftColor, s.boxShadow].join(" | ")
  const name = c.querySelector(".ngchoice-title")!, aria = c.querySelector("[data-choice-execute]")?.getAttribute("aria-label") || ""
  const out: W = { kind: c.getAttribute("data-seal"), seals: c.querySelectorAll("[data-choice-seal]").length, down: c.hasAttribute("data-hide") && !c.hasAttribute("data-revealed"),
    asking: c.hasAttribute("data-asking") ? c.querySelector("[data-choice-grade] span")?.textContent || "?" : null,
    border: edge(cs) === edge(ps) ? "ordinary" : edge(cs), aria }
  if (!seal) return out
  let op = 1
  for (let e: Element | null = seal; e && e !== document.body; e = e.parentElement) op *= parseFloat(getComputedStyle(e).opacity)
  const s = R(seal)!, card = R(c)!, band = R(c.querySelector(".ng-choice-title-button")), text = R(name.firstElementChild || name)
  const unit = parseFloat(getComputedStyle(c.querySelector(".ng-choice-title-button")!).paddingLeft)
  const play = R(c.querySelector("[data-choice-watch]")), badgeEl = c.querySelector("[data-choice-recommended]"), badge = badgeEl && badgeEl.textContent ? R(badgeEl) : null
  const hit = document.elementFromPoint(s.l + s.w / 2, s.t + s.h / 2), ss = getComputedStyle(seal)
  out.seal = { rect: s, card, opacity: op, visibility: ss.visibility, display: ss.display, hit: hit === seal,
    inside: s.l >= card.l && s.r <= card.r && s.t >= card.t && s.b <= card.b,
    offTitle: !meet(s, band) && !meet(s, text), offNumbers: !meet(s, R(c.querySelector("[data-choice-value]"))),
    offPlay: play ? !meet(s, play) : null, offBadge: badge ? !meet(s, badge) : null,
    // from the card's INNER edge (inside its 1px border), where the name's own padding is measured from too
    units: { unit, across: +(s.w / unit).toFixed(2), right: +((card.r - parseFloat(cs.borderRightWidth) - s.r) / unit).toFixed(2), below: +((s.t - band!.b) / unit).toFixed(2) },
    words: seal.title, fill: ss.backgroundImage !== "none" ? "image" : ss.backgroundColor }
  return out
}, sel)
const card = (k: string) => `[data-ks="${k}"]`

/** Every claim about a seal that is there, at this card, at this width */
function sealed(L: W, kind: "known" | "learned", where: string) {
  expect([L.kind, L.seals], `${where}: data-seal "${kind}" and one seal`).toEqual([kind, 1])
  const s = L.seal
  expect({ opacity: s.opacity, visibility: s.visibility, display: s.display === "none" ? "none" : "shown", hit: s.hit }, `${where}: the seal is visible and nothing covers it (elementFromPoint at its centre)`)
    .toEqual({ opacity: 1, visibility: "visible", display: "shown", hit: true })
  expect(s.inside, `${where}: the seal sits inside the card ${JSON.stringify(s.card)}: ${JSON.stringify(s.rect)}`).toBe(true)
  expect(s.offTitle, `${where}: the seal is off the title band and the name ${JSON.stringify(s.rect)}`).toBe(true)
  expect(s.offNumbers, `${where}: the seal is off Works % / Win %`).toBe(true)
  if (s.offPlay !== null) expect(s.offPlay, `${where}: the seal is off the play circle`).toBe(true)
  if (s.offBadge !== null) expect(s.offBadge, `${where}: the seal is off the Suggested badge`).toBe(true)
  expect(s.units, `${where}: 2 card units across, 1 in from the right edge, 1 below the title band (unit ${s.units.unit}px)`).toEqual({ unit: s.units.unit, across: 2, right: 1, below: 1 })
  expect(s.words, `${where}: its hover words`).toBe(WORDS[kind])
  expect(L.aria.startsWith(`${L.aria.split(". ")[0]}. ${WORDS[kind]}.`), `${where}: the accessible name says it after the move's name: "${L.aria}"`).toBe(true)
  expect(L.border, `${where}: the card's border is the ordinary one (a never-met card's), not gold`).toBe("ordinary")
}
/** a seal is measured where it sits in view: the card is brought into the row's view first */
async function sealedAt(page: Page, k: string, kind: "known" | "learned", where: string) {
  await into(page, card(k))
  sealed(await look(page, card(k)), kind, where)
}
function bare(L: W, where: string) {
  expect([L.kind, L.seals], `${where}: no seal`).toEqual([null, 0])
  expect(L.aria.includes(WORDS.known) || L.aria.includes(WORDS.learned), `${where}: the accessible name claims nothing: "${L.aria}"`).toBe(false)
}

/** The LIGHT inside the seal, from the screenshot's own pixels: the mean luminance of the disc inside its rim (radius
 *  0.36 of its width), tick included. A filled seal is a lit disc, a hollow one a dark ring: the shape, not the hue. */
async function inside(page: Page, sel: string) {
  await into(page, sel)
  const r = await page.evaluate((sel) => { const s = document.querySelector(sel + " [data-choice-seal]")!.getBoundingClientRect(); return { x: s.left, y: s.top, width: s.width, height: s.height } }, sel)
  const png = (await page.screenshot({ clip: r, type: "png" })).toString("base64")
  return page.evaluate(async (b64) => {
    const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode()
    const cv = document.createElement("canvas"); cv.width = img.width; cv.height = img.height
    const ctx = cv.getContext("2d")!; ctx.drawImage(img, 0, 0)
    const d = ctx.getImageData(0, 0, cv.width, cv.height).data, cx = cv.width / 2, cy = cv.height / 2, R = cv.width * 0.36
    let sum = 0, n = 0
    for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) {
      if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) > R) continue
      const i = (y * cv.width + x) * 4; sum += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255; n++
    }
    return +(sum / n).toFixed(3)
  }, png)
}

/** bring a card into the row's view the way the app scrolls it: the tray's one scroll owner stops first (§6.5) */
async function into(page: Page, sel: string) {
  await page.evaluate((sel) => { (window as W).__neural._trayStop?.(); document.querySelector(sel)!.scrollIntoView({ inline: "center", block: "nearest" }) }, sel)
  await expect.poll(() => page.evaluate((sel) => { const r = document.querySelector(sel)!.getBoundingClientRect(); return r.left >= 0 && r.right <= window.innerWidth }, sel), { message: `${sel} is in view` }).toBe(true)
}

async function pointOn(page: Page, sel: string, y = 22) {
  const at = await page.evaluate(([sel, y]) => {
    const c = document.querySelector(sel as string) as HTMLElement
    c.scrollIntoView({ inline: "nearest", block: "nearest" })
    const r = c.getBoundingClientRect(), x = r.left + r.width / 2, yy = r.top + (y as number)
    const top = document.elementFromPoint(x, yy)
    return { x, y: yy, ok: !!top && c.contains(top), who: top ? top.outerHTML.slice(0, 80) : "nothing" }
  }, [sel, y] as const)
  expect(at.ok, `${sel} is reachable where it sits (elementFromPoint: ${at.who})`).toBe(true)
  return at
}
const comeBack = (page: Page, day: number) => page.evaluate((d) => { (window as W).__NG_EPOCH_DAY__ = d; document.dispatchEvent(new Event("visibilitychange")) }, day)
const executing = (page: Page) => page.evaluate(() => !!(window as W).__neural._execution)
const playOn = (page: Page, k: string) => page.evaluate((k) => !!document.querySelector(`[data-ks="${k}"] [data-choice-watch]`), k)
/** the live receipt path of another device's answer (`_pullAndMerge` and another tab both land here) */
const pull = (page: Page, k: string, r: number[]) => page.evaluate(([s, m, r]) => {
  const a = (window as W).__neural, b = a._progressBlob()
  a._hydrateProgressBlob({ ...b, moves: { ...b.moves, [s as string]: { ...b.moves[s as string], [m as string]: r } } })
}, [S, String(ORD[(ID as W)[k]]), r] as const)

/** the four kinds at once, on one row */
async function fourKinds(page: Page, hidden: boolean, where: string) {
  for (const k of ["known", "learned", "due", "fresh", "learnedDue"]) {
    await into(page, card(k))
    const L = await look(page, card(k))
    if (k === "known" || k === "learned") { sealed(L, k, `${where}, ${k}`); expect(L.down, `${where}, ${k}: face up`).toBe(false) }
    else { bare(L, `${where}, ${k}`); expect(L.down, `${where}, ${k}: ${hidden ? "face down" : "face up (moves shown)"}`).toBe(hidden) }
  }
  const lit = { known: await inside(page, card("known")), learned: await inside(page, card("learned")) }
  expect(lit.known > 0.4 && lit.learned < 0.3, `${where}: filled is a lit disc, hollow a dark ring, by the light inside them (known ${lit.known}, learned ${lit.learned})`).toBe(true)
}

test.describe("mouse 1440x900, moves hidden", () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test("the four kinds, the asked card beside a sealed one, a Yes seals, a new day unseals, and the hollow seal fills", async ({ page }) => {
    test.setTimeout(240_000)
    const j = await seat(page, true)
    await page.mouse.move(2, 2)
    await fourKinds(page, true, "1440 hidden")
    await expect.poll(() => playOn(page, "known"), { message: "the known card's play circle landed (so 'off the play circle' is measured, not skipped)" }).toBe(true)
    await into(page, card("known"))
    await sealedAt(page, "known", "known", "1440 hidden, known, with its play circle")
    expect((await look(page, card("known"))).seal.offPlay, "...measured against a real play circle").toBe(true)

    // the pointer on the seal: its words, and nothing else happens (a face-up card asks nothing)
    const sp = await page.evaluate((s) => { const r = document.querySelector(s + " [data-choice-seal]")!.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } }, card("known"))
    await page.mouse.move(sp.x, sp.y)
    await page.waitForTimeout(250)
    expect(await page.evaluate(([x, y]) => (document.elementFromPoint(x, y) as HTMLElement)?.title, [sp.x, sp.y]), "the pointer on the seal meets the seal, which says its words").toBe(WORDS.known)
    expect([(await look(page, card("known"))).asking, await executing(page)], "...and the pointer on it asks nothing and plays nothing").toEqual([null, false])

    // the card being asked, beside a sealed one: the strong outline is the asked card's, and it wears no seal
    const q = await pointOn(page, card("due"))
    await page.mouse.move(q.x, q.y)
    await expect.poll(async () => (await look(page, card("due"))).asking, { message: "a look at the due card asks Still got it?" }).toBe("Still got it?")
    const asked = await look(page, card("due")), beside = await look(page, card("known"))
    bare(asked, "the asked card")
    expect(asked.border !== "ordinary", `the asked card wears the strong outline (${asked.border})`).toBe(true)
    expect(/232, 196, 106|240, 192, 90/.test(asked.border), "...and it is not gold").toBe(false)
    expect(beside.border, "the sealed card beside it keeps the ordinary border: the seal is not an outline").toBe("ordinary")
    await page.waitForTimeout(ARM)
    await j.clickByMouse(`${card("due")} [data-grade="yes"]`, '"Yes"')
    expect(await executing(page), "Yes is not a play").toBe(false)
    await page.mouse.move(q.x, q.y - 200)
    await expect.poll(async () => (await look(page, card("due"))).kind, { message: "a Yes on the due card: the filled seal" }).toBe("known")
    await sealedAt(page, "due", "known", "1440, the due card after its Yes")

    // a new day: the known move comes due, turns face down, and its seal goes with the face (one read)
    await comeBack(page, NEXT)
    await expect.poll(async () => (await look(page, card("known"))).down, { message: "coming back the next day: the known card is face down" }).toBe(true)
    bare(await look(page, card("known")), "the known move, now due and face down")

    // the hollow seal fills with the player's own Yes: its flashcards come due (face down, no seal), a look asks, Yes
    await comeBack(page, LEARNED_DUE + 1)
    await expect.poll(async () => (await look(page, card("learned"))).down, { message: "its flashcards due: the learned card is face down" }).toBe(true)
    bare(await look(page, card("learned")), "the learned move with its flashcards due")
    const l = await pointOn(page, card("learned"))
    await page.mouse.move(l.x, l.y)
    await expect.poll(async () => (await look(page, card("learned"))).asking, { message: "a look asks Did you get it?" }).toBe("Did you get it?")
    await page.waitForTimeout(ARM)
    await j.clickByMouse(`${card("learned")} [data-grade="yes"]`, '"Yes" on the learned move')
    await page.mouse.move(l.x, l.y - 200)
    await expect.poll(async () => (await look(page, card("learned"))).kind, { message: "the Yes: the learned move's seal is the filled one now" }).toBe("known")
    await sealedAt(page, "learned", "known", "1440, the learned move after its Yes")
    expect(await inside(page, card("learned")) > 0.4, "...a lit disc").toBe(true)
  })
})

test.describe("mouse 1440x900, moves shown", () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test("moves shown: the due card is face up and wears no seal; the focused card's outline is not gold; a pull fills and empties a seal in place", async ({ page }) => {
    test.setTimeout(240_000)
    await seat(page, false)
    await page.mouse.move(2, 2)
    expect(await page.locator("[data-hide]").count(), "moves shown: nothing face down").toBe(0)
    await fourKinds(page, false, "1440 shown")
    // the focused card (a keyboard focus): its outline is the focus ring, not gold, and the seal stays as it was
    await into(page, card("known"))
    // focus the tab stop just before the known card's button (the previous card's play circle, when it has one), then Tab
    await page.evaluate((s) => { const all = [...document.querySelectorAll('[data-choice-group="you"] button')].filter((b) => (b as HTMLElement).tabIndex >= 0), b = document.querySelector(s + " [data-choice-execute]")!; (all[all.indexOf(b) - 1] as HTMLElement || document.body).focus() }, card("known"))
    await page.keyboard.press("Tab")
    const f = await page.evaluate((s) => { const b = document.querySelector(s + " [data-choice-execute]")!, st = getComputedStyle(b); return { focused: document.activeElement === b, ring: st.outlineStyle + " " + st.outlineColor } }, card("known"))
    expect(f.focused, "Tab reaches the known card").toBe(true)
    expect(f.ring.startsWith("solid") && !/232, 196, 106|240, 192, 90/.test(f.ring), `the focused card's ring is the focus colour, not gold (${f.ring})`).toBe(true)
    await sealedAt(page, "known", "known", "the focused known card")
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur())
    // another device answers: its Yes fills the hollow seal in place, its No takes the filled one away
    await pull(page, "learned", [DAY + 3, 3, DAY, 1])
    await sealedAt(page, "learned", "known", "another device's Yes on the learned move: the seal fills")
    await pull(page, "known", [DAY + 1, 1, DAY, 0])
    bare(await look(page, card("known")), "another device's No on the known move: its seal goes")
  })
})

test.describe("touch 390x631, moves hidden", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 631 } })

  test("by touch at 390: the four kinds; a tap on the due card asks, a tap on Yes seals it", async ({ page }) => {
    test.setTimeout(240_000)
    await seat(page, true)
    await fourKinds(page, true, "390 hidden")
    const q = await pointOn(page, card("due"))
    await page.touchscreen.tap(q.x, q.y)
    expect(await executing(page), "the first tap on the face-down card plays nothing").toBe(false)
    const asked = await look(page, card("due"))
    expect(asked.asking, "...and asks Still got it?").toBe("Still got it?")
    bare(asked, "390, the asked card")
    // a tap turns a card up with no hover: until v1.272.0 the card asked by touch wore no outline at all
    expect(asked.border !== "ordinary" && !/232, 196, 106|240, 192, 90/.test(asked.border), `390: the card asked by touch wears the strong outline, not gold (${asked.border})`).toBe(true)
    expect((await look(page, card("known"))).border, "...and the sealed card beside it keeps the ordinary border").toBe("ordinary")
    const yes = await page.evaluate((s) => { const r = document.querySelector(s + ' [data-grade="yes"]')!.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } }, card("due"))
    await page.waitForTimeout(ARM)
    await page.touchscreen.tap(yes.x, yes.y)
    expect(await executing(page), "a tap on Yes plays nothing").toBe(false)
    await expect.poll(async () => (await look(page, card("due"))).kind, { message: "390: the Yes seals it (filled)" }).toBe("known")
    await sealedAt(page, "due", "known", "390, the due card after its Yes")
  })
})

test.describe("touch 320x631, moves shown, the long row", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 320, height: 631 } })

  test("320 wide, Closed Guard bottom's long row: the first, a middle and the last card known, one learned; every seal measured where it sits", async ({ page }) => {
    test.setTimeout(240_000)
    const j = journey(page)
    await j.boot("/", { beforeNavigate: realContent, initialState: { v: 2, settings: { hideMoves: false }, settingsAt: { hideMoves: 1 } } })
    await j.land("Closed Guard Top")
    // play bottom: the hub is one "<X> Top" node; the hand is dealt again from the bottom (the gen suite's recipe)
    await page.evaluate(() => { const a = (window as W).__neural; a.playerRole = "bottom"; a.enterLand(false) })
    await expect.poll(() => page.evaluate(() => ((window as W).__neural._optionCards || []).filter((c: W) => !c.opt.threat).length), { message: "the bottom hand is dealt" }).toBeGreaterThan(20)
    const row = await page.evaluate(() => {
      const a = (window as W).__neural, own = [...document.querySelectorAll('[data-choice-group="you"] .ng-choice-card')] as W[]
      a._handTouched = true
      const pick = [0, own.length >> 1, own.length - 1], learned = own.findIndex((c, i) => !pick.includes(i) && c._choiceOpt.action !== "escape")
      pick.forEach((i, n) => own[i].setAttribute("data-ks", "k" + n)); own[learned].setAttribute("data-ks", "learned")
      const key = a.deckKeyFor(own[learned]._choiceOpt.node).key
      if (!a._deckHasCards(key)) void a.hydrateDeck(key)
      return { n: own.length, keys: pick.map((i) => a._moveKey(own[i]._choiceOpt)), key, seat: a.nodes[a.currentPos].t + " / " + a.playerRole }
    })
    console.log(`[known-move-seal] ${row.seat}: ${row.n} cards in the row`)
    expect(row.n, "Closed Guard bottom deals a long row (31 in gi today)").toBeGreaterThan(25)
    await expect.poll(() => page.evaluate((k) => (window as W).__neural._deckHasCards(k), row.key), { message: "the learned move's deck landed" }).toBe(true)
    // another device's record: three Yeses in this row, and the fourth card's flashcards all learned
    await page.evaluate(({ keys, key }) => {
      const a = (window as W).__neural, b = a._progressBlob(), moves = { ...(b.moves || {}) }
      for (const [st, mv] of keys) moves[st] = { ...(moves[st] || {}), [mv]: [a._epochDay() + 5, 7, a._epochDay() - 1, 1] }
      const stage = { ...(b.stage || {}), [key]: Object.fromEntries(a._cardsOf(a.flashcards.decks[key]).map((c: W) => [a.qhash(c.q), 3])) }
      a._hydrateProgressBlob({ ...b, moves, stage })
    }, row)
    let played = 0
    for (const k of ["k0", "k1", "k2", "learned"]) {
      await into(page, card(k))
      // its poster and play circle land once the card is in view (an IntersectionObserver), when it has a front clip
      await page.waitForTimeout(600)
      const L = await look(page, card(k))
      sealed(L, k === "learned" ? "learned" : "known", `320, ${k}`)
      expect(L.seal.rect.l >= 0 && L.seal.rect.r <= 320, `320, ${k}: the seal is inside the 320px viewport`).toBe(true)
      if (L.seal.offPlay !== null) played++
    }
    console.log(`[known-move-seal] 320: ${played} of 4 sealed cards measured against a play circle`)
    expect(played, "at least one sealed card at 320 was measured against its play circle (the check ran)").toBeGreaterThan(0)
  })
})

// ── THE MAP (v1.272.0, its own commit): the gold outline round a known move's orb became the seal's dot ───────────

/** One paused frame, read off what `draw()` PUBLISHED (§6.3): every dot, every option name's box, each orb's drawn
 *  centre through the frame's own lift (`_LY`, §6.2), and the paint, against a CONTROL frame with the known set
 *  emptied: everything the map draws anyway subtracts to zero, and what is left is the dots' own paint. */
const mapFrame = (page: Page) => page.evaluate((ids) => {
  const a = (window as W).__neural, live = a.ctx
  a.setPaused(true)
  // the camera on the two known orbs, framed the app's own way (`_fitView`, which keeps them clear of the bottom
  // chrome), tight (no zoom-out floor): close enough that pairs are split and lifted at 390 too (§6.2), with the
  // dealt neighbours (unknown) around them
  const seeded = a._optionCards.filter((c: W) => !c.opt.threat && ids.includes(c.opt.node.id)).map((c: W) => c.opt.idx)
  const t = a._fitView(seeded, { minW: 0 })
  a.cam = { ...a.cam, cx: t.cx, cy: t.cy, vw: t.vw, lvw: Math.log(t.vw) }
  a.draw()
  const dpr = a.dpr || 1, scale = a.W / a.cam.vw
  const snap = () => {
    const c = document.createElement("canvas"); c.width = live.canvas.width; c.height = live.canvas.height
    const ctx = c.getContext("2d", { willReadFrequently: true })!
    a.ctx = ctx; ctx.save()
    try { a.draw() } finally { a.ctx = live; ctx.restore() }
    return { px: ctx.getImageData(0, 0, c.width, c.height).data, w: c.width }
  }
  const real = snap(), seals = (a._lastMapSeals || []).map((s: W) => ({ ...s })), boxes = (a._lastOptBoxes || []).map((b: W) => ({ ...b }))
  const known = [...a._movesGold().keys()]
  a._movesGold = () => new Map()
  let control: W
  try { control = snap() } finally { delete a._movesGold }
  a.setPaused(false)
  const orb = (i: number) => { const n = a.nodes[i]; return { x: a.W / 2 + (n.x - a.cam.cx) * scale, y: a.H / 2 + (a._LY(n) - a.cam.cy) * scale, stored: a.H / 2 + (n.y - a.cam.cy) * scale,
    r: n.r * scale * Math.max(0.4, Math.min(1, a.cam.vw / (a.graphW * 0.5))) } }
  // every pixel the dots changed, and whether it lies inside a published dot (2px of anti-aliasing allowed)
  let changed = 0, outside = 0
  const perDot = seals.map(() => ({ n: 0, gold: 0 }))
  for (let i = 0; i < real.px.length; i += 4) {
    const d = Math.abs(real.px[i] - control.px[i]) + Math.abs(real.px[i + 1] - control.px[i + 1]) + Math.abs(real.px[i + 2] - control.px[i + 2])
    if (d < 24) continue
    changed++
    const p = i / 4, x = (p % real.w) / dpr, y = ((p / real.w) | 0) / dpr
    const k = seals.findIndex((s: W) => Math.hypot(x - s.x, y - s.y) <= s.r + 2)
    if (k < 0) { outside++; continue }
    if (Math.hypot(x - seals[k].x, y - seals[k].y) <= seals[k].r - 1) {
      perDot[k].n++
      const r = real.px[i], g = real.px[i + 1], b = real.px[i + 2]
      if (r > g && g > b && (r - b) / r > 0.35) perDot[k].gold++
    }
  }
  return { W: a.W, H: a.H, known, seals, boxes, changed, outside, perDot,
    orbs: Object.fromEntries([...new Set([...known, ...a.optionIdxs])].map((i: number) => [i, orb(i)])),
    options: [...a.optionIdxs], id: Object.fromEntries([...a.optionIdxs].map((i: number) => [i, a.nodes[i].id])) }
}, [ID.known, ID.due])

async function mapClaims(page: Page, where: string) {
  const f = await mapFrame(page)
  const inView = (o: W) => o.x > 20 && o.x < f.W - 20 && o.y > 20 && o.y < f.H - 20
  const knownInView = f.known.filter((i: number) => f.orbs[i] && inView(f.orbs[i]))
  console.log(`[known-move-seal] map ${where}: ${f.known.length} known nodes, ${knownInView.length} in view, ${f.seals.length} dots drawn, ${f.boxes.length} option names, ${f.changed} px changed`)
  expect(knownInView.length, `${where}: at least one known move's orb is in view (the check runs)`).toBeGreaterThan(0)
  const dotted = new Set(f.seals.map((s: W) => s.idx))
  expect(knownInView.filter((i: number) => !dotted.has(i)), `${where}: a dot on every known move's orb in view`).toEqual([])
  expect(f.seals.filter((s: W) => !f.known.includes(s.idx)).map((s: W) => s.idx), `${where}: no dot on any node the moves record does not know`).toEqual([])
  for (const k of ["fresh", "learned"]) {
    const i = f.options.find((x: number) => f.id[x] === (ID as W)[k])
    if (i != null) expect(dotted.has(i), `${where}: ${k} (${(ID as W)[k]}): no dot`).toBe(false)
  }
  let lifted = 0, upRight = 0
  for (const s of f.seals.filter((s: W) => inView(f.orbs[s.idx]))) {
    const o = f.orbs[s.idx], dx = s.x - o.x, dy = s.y - o.y
    if (Math.abs(o.y - o.stored) > 3 * s.r) lifted++
    // a SHOULDER, not "the upper right": a name over that shoulder moves the dot to the next free one (`_mapSeal`). The
    // bound is the triangle's farthest (its base corner, 1.37r along the diagonal) plus the dot; the orb's radius here
    // is n.r x scale x nodeK, without the pair's LOD, so it is a bound, never the placement recomputed (§6.3)
    expect(Math.abs(dx) > 0.2 * o.r && Math.abs(dy) > 0.2 * o.r && Math.hypot(dx, dy) <= 1.45 * o.r + s.r, `${where}: dot ${s.idx} sits on a shoulder of its orb, where the frame drew the orb (LY): offset ${dx.toFixed(1)}, ${dy.toFixed(1)} against r ${o.r.toFixed(1)}`).toBe(true)
    if (dx > 0 && dy < 0) upRight++
    expect(s.x - s.r >= 0 && s.x + s.r <= f.W && s.y - s.r >= 0 && s.y + s.r <= f.H, `${where}: dot ${s.idx} inside the viewport`).toBe(true)
    const hit = f.boxes.filter((b: W) => s.x + s.r > b.l && s.x - s.r < b.r && s.y + s.r > b.t && s.y - s.r < b.b)
    const near = f.boxes.filter((b: W) => b.r > o.x - 40 && b.l < o.x + 40 && b.b > o.y - 40 && b.t < o.y + 40).map((b: W) => `${b.idx} [${b.l.toFixed(0)},${b.t.toFixed(0)} - ${b.r.toFixed(0)},${b.b.toFixed(0)}]`)
    expect(hit.map((b: W) => b.idx), `${where}: dot ${s.idx} at (${s.x.toFixed(1)}, ${s.y.toFixed(1)}) r ${s.r.toFixed(1)}, orb at (${o.x.toFixed(1)}, ${o.y.toFixed(1)}) r ${o.r.toFixed(1)}, is off every option name the frame drew; names near: ${near.join(" ")}`).toEqual([])
    const k = f.seals.indexOf(s)
    expect(f.perDot[k].n > 0 && f.perDot[k].gold / f.perDot[k].n >= 0.6, `${where}: dot ${s.idx} is painted where it is published, in gold, not covered (${f.perDot[k].gold} of ${f.perDot[k].n} px gold)`).toBe(true)
  }
  expect(lifted, `${where}: at least one dotted orb is lifted off its stored point (so LY against n.y is tested)`).toBeGreaterThan(0)
  console.log(`[known-move-seal] map ${where}: ${upRight} of ${f.seals.length} dots at the up-right shoulder (the others moved off a name)`)
  expect(f.outside, `${where}: no gold outline left: every pixel the known set changes lies inside a published dot (${f.changed} changed)`).toBe(0)
}

for (const vp of [{ width: 1440, height: 900, touch: false }, { width: 390, height: 631, touch: true }]) {
  test.describe(`the map ${vp.width}x${vp.height}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch, isMobile: vp.touch })

    test(`the map: a dot on each known move's orb, none on an unknown one, no outline, off the names (${vp.width})`, async ({ page }) => {
      test.setTimeout(240_000)
      await seat(page, false)
      await mapClaims(page, `${vp.width}`)
    })
  })
}
