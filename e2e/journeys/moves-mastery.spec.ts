import { expect, test, type Page } from "@playwright/test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { journey } from "../dsl"

/** MOVES MASTERY, STAGE 2 (v1.256.0, owner U124 a and U122 a, 11 Nov 2026).
 *
 * A move you KNOW (its last "Did you get it?" / "Still got it?" answer was a Yes) counts like a fully learned deck:
 * +15 on its technique deck, and up to +15 on its seat by the share of the seat's dealt moves you know, under the one
 * 0.15 cap with the flashcards. The card's Works %, the dice and the Win % worker read the same figure; a No takes it
 * back. Gold: thin on a move you know, twice as thick once its deck's flashcards are learned too, on the card and on
 * the map. "Moves known N of M" sits under "Mastered N · X%" in the account menu.
 *
 * THE NUMBERS ARE READ WHERE THEY ARE PAINTED, after the hand's values settle (`settled`, the predicate of
 * landing-deck-answers.spec.ts): the card's Works % text, the seat's Win % (`data-win-chance`), the menu line's text.
 * The seat's flashcards are maxed in the seed (Mount|Top prep 5), so a Yes moves only the graded card's own deck and
 * every other card's Works % must stay EXACTLY where it was: the seat part is already at the cap. The Win % is
 * asserted as a direction only; `j.land` rigs `ai-skill` and `max-moves` (STAGE2D: three rigged boots of Mount Top read
 * the same seat 90%, the same 18 cards and the same profile hash, so the per-roll move cap was the noise). The exact
 * no-drop proof is on `permanent`, in tests/moves_account_safety.test.mjs.
 *
 * THE MAP'S OUTLINE IS PAINT, so it is asserted in pixels (§6.3): the production `draw()` renders the same frame twice
 * on fresh canvases, once as it is and once with the gold layer emptied (`_movesGold` returning nothing): a CONTROL
 * FRAME, so everything the map draws anyway subtracts to zero and what remains is the outline. It must be gold, sit on
 * the known orb, be absent on an unknown orb at the same zoom, and roughly double in area at level 2.
 *
 * Level 2 is reached by writing the deck's cards to stage 3 and publishing (a test rail: learning a deck for real
 * takes days of reviews); what is under test is that the card and the map thicken WITHOUT a reload. The level rule
 * itself, both orders, is pinned by tests/moves_account_safety.test.mjs.
 *
 * MUTANTS (v1.256.0), each run against the named test and killed with that claim's own message; the table is in
 * docs/Changelog-Archive.md (v1.256.0). Mouse: the technique part · the republish · the No · the account line · the
 * card's level 2 (the app's attribute, the CSS ring, the hand's repaint) · the map's outline · the map's level 2 (x1.10
 * against x1.92). Touch: the technique part on a tap · the seat stood in before the first landing (`moves_hand_failed`).
 * The effective count handed to the worker is killed at `settled`: with the worker's figure short of the card's own,
 * the value provider refuses the hand (`evaluation-failed`) and every card prints "—" (its exact claim is the unit's).
 * Review round 1: the first build's own formula (the sum in the app, figure / 0.03 to the worker), restored exactly,
 * is killed by "a seat known in part, below the cap" with its own message (every card refused, "—").
 * NOT COVERED here: the ruleset switch, the seat share and the cap (units), the study presenter's descriptor (unit).
 *
 * THE CARD'S GOLD BECAME A SEAL (v1.272.0, the owner, 13 Nov: "The mastered cards show up with a golden outline, and
 * this is confusing. It seems like this is the selected technique"; his pick "a, A gold seal in the corner": "A small
 * filled seal: you answered Yes here. A hollow one: its flashcards are learned"). The card's claims moved from
 * `data-mastered` ("" thin, "2" thick) to `data-seal`, and each says what it claimed before:
 *   the seeded known move  was "wears thin gold" ("")      it is DUE and FACE DOWN (moves hidden), so now "no seal"
 *   a Yes, mouse and touch was "thin gold on the card" ("") now the filled seal ("known")
 *   the No                 was "the No takes the gold away" now "no seal" (it had none: it was due)
 *   the gold test, card    was level 1 "the 1px gold border and a .5px ring", level 2 "the border and a 2px ring"
 *                          now the filled seal on the ordinary border, before AND after the deck is learned: the seal
 *                          has two kinds, and a move both answered Yes and learned is "known" (the row rules)
 * The seal's geometry, its kinds and its mutants are pinned by known-move-seal.spec.ts.
 *
 * AND THE MAP'S OUTLINE BECAME THE SEAL'S DOT (v1.272.0, its own commit; the owner's option: "It reads as a stamp on the
 * card, and shrinks to a dot beside the name on the map"). The same pixel differential reads it, and each map claim
 * says what it claimed before:
 *   level 1 on the map  was "an outline drawn on the known orb"   now "the seal's dot drawn at the known orb"
 *   level 2 on the map  was "the map's outline about doubles" (x1.6 to x2.6)
 *                       now "the dot does not grow" (x0.8 to x1.25): the map's mark has ONE state; a deck learned on
 *                       top of a known move changes nothing there (its flashcards show through "Turn what you know gold")
 * The dot's place, its publication and its mutants are pinned by known-move-seal.spec.ts ("the map ...").
 */

type W = any
const DAY = 20402
const ORD = JSON.parse(readFileSync(resolve(__dirname, "../../node_ordinals.json"), "utf8")).ordinals as Record<string, number>
const S = ORD["Positions/Mount"] + "/top"
// every pair dealt in gi, over every position seat gi deals (tests/_census.mjs computes it from the app's `_movesKnownLine`)
const PAIRS_GI = 1350 // census:movePairs
// known and due at boot, so its face-up card asks "Still got it?" with a No: a low-value move, so the seat's best
// move is free to be the one the journey grades Yes
const DUE = "Transitions/Mount-to-Knee-on-Belly"
const seed = { v: 2, prep: { "Mount|Top": 5 }, settings: { hideMoves: true }, settingsAt: { hideMoves: 1 },
  moves: { [S]: { [ORD[DUE]]: [DAY - 1, 3, DAY - 4, 1] } } }
/** the grade buttons answer only a press that began NG_GRADE_ARM_MS (500 ms) after the strip appeared */
const ARM = 600

const settled = (page: Page) => expect.poll(() => page.evaluate(() => {
  const a: W = (window as W).__neural, s = a._choiceValues?.snapshot()
  return !!(s && s.handId === a._choiceHandId && ["ready", "bounded"].includes(s.status)
    && !a._choiceValueQueued && !a._residencyHold
    && a._choiceValueSource?.isCurrent(a, s.request, a._choiceHandId))
}), { timeout: 180_000, intervals: [400], message: "this hand's worker values are current" }).toBe(true)

async function seat(page: Page) {
  await page.addInitScript((d) => { (window as W).__NG_EPOCH_DAY__ = d }, DAY)
  const j = journey(page)
  await j.boot("/", { initialState: seed })
  await j.land("Mount Top")
  await settled(page)
  // the map draws the seat's gold from its first frame, before any landing: every hand it asked for was dealt
  expect(await page.evaluate(() => ((window as W).__neural.beats || []).filter((b: W) => b.beat === "moves_hand_failed")), "no hand failed to deal (moves_hand_failed)").toEqual([])
  // by IDENTITY (§6.3): "y" is the best TRANSITION by Win % not yet known (its Works % is the move's own odds, so a
  // Yes adds exactly its deck's 15); "z" the seat's best move of all (the one its Win % rides on); "due" the seeded one
  const picked = await page.evaluate((due) => {
    const a = (window as W).__neural, own = a._optionCards.filter((c: W) => !c.opt.threat)
    a._handTouched = true
    const n = (c: W, sel: string) => parseInt(c.card.querySelector(sel)?.textContent || "", 10)
    const free = own.filter((c: W) => c.opt.node.id !== due && !a._moveMastered(c.opt) && n(c, ".ngodds") <= 65)
    free.sort((p: W, q: W) => n(q, "[data-choice-win]") - n(p, "[data-choice-win]") || (p.opt.node.id < q.opt.node.id ? -1 : 1))
    const y = free.find((c: W) => c.opt.node.ty === "transitions"), z = free.find((c: W) => c !== y)
    y.card.setAttribute("data-hk", "y"); z.card.setAttribute("data-hk", "z")
    own.find((c: W) => c.opt.node.id === due)?.card.setAttribute("data-hk", "due")
    return { y: y.opt.node.t, z: z.opt.node.t, zBest: n(z, "[data-choice-win]") >= Math.max(...own.filter((c: W) => c !== y).map((c: W) => n(c, "[data-choice-win]"))), due: !!document.querySelector('[data-hk="due"]') }
  }, DUE)
  expect(picked.due, "the seeded known move is dealt").toBe(true)
  expect(picked.zBest, `"z" (${picked.z}) is the seat's best move by Win %`).toBe(true)
  return j
}

/** what the screen and the worker say now */
const read = (page: Page) => page.evaluate(() => {
  const a = (window as W).__neural, s = a._choiceValues.snapshot(), P = a.knowledgeProfile()
  const own = a._optionCards.filter((c: W) => !c.opt.threat)
  const card = (c: W) => ({ id: c.opt.node.id, hk: c.card.getAttribute("data-hk"), key: a.deckKeyFor(c.opt.node).key,
    works: parseInt(c.card.querySelector(".ngodds").textContent, 10), seal: c.card.getAttribute("data-seal") })
  return { cards: own.map(card), seatWin: parseInt(document.querySelector("[data-legend-win]")!.getAttribute("data-win-chance")!, 10),
    sent: s.request.profileHash, profile: P.fingerprint, permanent: { ...P.permanent } }
})
const by = (r: W, hk: string) => r.cards.find((c: W) => c.hk === hk)

/** the account menu's line, as painted */
async function line(page: Page, j: ReturnType<typeof journey>) {
  await j.openAccountMenu()
  const t = await page.locator(".ng-account-menu [data-menu-moves]").innerText()
  const under = await page.evaluate(() => { const m = document.querySelector(".ng-account-menu [data-menu-moves]")!; return m.previousElementSibling?.hasAttribute("data-menu-mastered") || false })
  await page.evaluate(() => (window as W).__neural.closeAccountMenu())
  await j.clickByMouse(".ng-explorer-close", "close the drawer")
  const m = t.match(/^Moves known (\d[\d,]*) of (\d[\d,]*)$/)
  expect(m, `the line reads "Moves known N of M": ${t}`).not.toBeNull()
  expect(under, "...directly under Mastered").toBe(true)
  return { known: +m![1].replace(/,/g, ""), total: +m![2].replace(/,/g, "") }
}

/** A point on the card's title row that a real pointer reaches (§6.1) */
async function pointOn(page: Page, sel: string) {
  const at = await page.evaluate((sel) => {
    const c = document.querySelector(sel) as HTMLElement
    c.scrollIntoView({ inline: "nearest", block: "nearest" })
    const r = c.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + 22
    const top = document.elementFromPoint(x, y)
    return { x, y, ok: !!top && c.contains(top), who: top ? top.outerHTML.slice(0, 80) : "nothing" }
  }, sel)
  expect(at.ok, `${sel}'s title row is reachable where it sits (elementFromPoint: ${at.who})`).toBe(true)
  return at
}
const asking = (page: Page, sel: string) => page.evaluate((sel) => { const c = document.querySelector(sel)!; return { asking: c.hasAttribute("data-asking"), q: c.querySelector("[data-choice-grade] span")?.textContent || null } }, sel)

/** The gold layer in pixels: the production frame minus a control frame with no gold, around a known orb and an
 *  unknown one, at the same zoom. Returns the differing pixels near each, and how gold they are. */
const mapGold = (page: Page, knownId: string, unknownId: string, alsoKnown: string[]) => page.evaluate(({ knownId, unknownId, alsoKnown }) => {
  const a = (window as W).__neural, live = a.ctx
  const orb = (id: string) => a.nodes.find((n: W) => n.id === id && n.role !== "defender")
  const K = orb(knownId), U = orb(unknownId), O = alsoKnown.map(orb)
  a.setPaused(true)
  a.draw()
  const scale = 3, mid = { x: (K.x + U.x) / 2, y: (a._LY(K) + a._LY(U)) / 2 }
  a.cam = { ...a.cam, cx: mid.x, cy: mid.y, vw: a.W / scale, lvw: Math.log(a.W / scale) }
  a.draw()
  const snap = () => {
    const c = document.createElement("canvas"); c.width = live.canvas.width; c.height = live.canvas.height
    const ctx = c.getContext("2d", { willReadFrequently: true })!
    a.ctx = ctx; ctx.save()
    try { a.draw() } finally { a.ctx = live; ctx.restore() }
    return { px: ctx.getImageData(0, 0, c.width, c.height).data, w: c.width }
  }
  const real = snap(), again = snap()
  a._movesGold = () => new Map()
  let control
  try { control = snap() } finally { delete a._movesGold }
  // the frame's own transform (share-camera.spec.ts): centre + (world - camera) x W / vw, in device pixels
  const dpr = a.dpr || 1, at = (n: W) => ({ x: (a.W / 2 + (n.x - a.cam.cx) * scale) * dpr, y: (a.H / 2 + (a._LY(n) - a.cam.cy) * scale) * dpr })
  const pk = at(K), pu = at(U), po = O.map(at), R = 40 * dpr
  let near = 0, nearU = 0, nearO = 0, elsewhere = 0, repeat = 0
  const sum = [0, 0, 0]
  for (let i = 0; i < real.px.length; i += 4) {
    if (real.px[i] !== again.px[i] || real.px[i + 1] !== again.px[i + 1] || real.px[i + 2] !== again.px[i + 2]) repeat++
    const d = Math.abs(real.px[i] - control!.px[i]) + Math.abs(real.px[i + 1] - control!.px[i + 1]) + Math.abs(real.px[i + 2] - control!.px[i + 2])
    if (d < 24) continue
    const p = i / 4, x = p % real.w, y = (p / real.w) | 0
    if (Math.hypot(x - pk.x, y - pk.y) < R) { near++; sum[0] += real.px[i]; sum[1] += real.px[i + 1]; sum[2] += real.px[i + 2] }
    else if (Math.hypot(x - pu.x, y - pu.y) < R) nearU++
    else if (po.some((q: W) => Math.hypot(x - q.x, y - q.y) < R)) nearO++
    else elsewhere++
  }
  a.setPaused(false)
  // the outline's mean colour: anti-aliased edges blend into the orb and the field, so a pixel-by-pixel test is
  // stricter than the claim (§6.3), and so is a brightness cut (the mean read rgb(162,132,77) and rgb(155,127,76) on
  // the same build). Its HUE is what stays: gold (240,192,90) is 41°, and the blend measured 38.7° and 38.8°
  const mean = sum.map((v) => Math.round(v / Math.max(1, near))), [r, g, b] = mean
  const hue = r > g && g >= b && r > b ? 60 * (g - b) / (r - b) : -1, sat = r > 0 ? (r - b) / r : 0
  return { near, mean, hue: Math.round(hue), gold: hue >= 25 && hue <= 55 && sat > 0.35, nearU, nearO, elsewhere, repeat, apart: Math.hypot(pk.x - pu.x, pk.y - pu.y) / dpr }
}, { knownId, unknownId, alsoKnown })

test("a Yes adds 15 to that card's Works % and sends the worker a new profile; a No takes it back; gold and the line follow", async ({ page }) => {
  test.setTimeout(300_000)
  const j = await seat(page)
  const r0 = await read(page), y0 = by(r0, "y"), due0 = by(r0, "due"), line0 = await line(page, j)
  expect(line0, "one move known at boot, of every pair dealt in gi").toEqual({ known: 1, total: PAIRS_GI })
  // v1.272.0: was "the seeded known move wears thin gold" (""); it is due and face down (moves hidden): no seal. Face up
  // (moves shown) a due move wears the filled seal (SEAL2), pinned by known-move-seal.spec.ts
  expect(due0.seal, "the seeded known move is due and face down (moves hidden): no seal").toBeNull()
  expect(y0.seal, "the move to grade is not known yet: no seal").toBeNull()
  expect(r0.permanent[y0.key] || 0, "...and its deck holds no permanent bonus").toBe(0)
  await settled(page)

  // Yes, by mouse: peek, wait for the strip to arm, press Yes
  const p = await pointOn(page, '[data-hk="y"]')
  await page.mouse.move(p.x, p.y)
  await expect.poll(() => asking(page, '[data-hk="y"]')).toEqual({ asking: true, q: "Did you get it?" })
  await page.waitForTimeout(ARM)
  await j.clickByMouse('[data-hk="y"] [data-grade="yes"]', '"Yes"')
  await page.mouse.move(p.x, p.y - 160)
  await settled(page)
  const r1 = await read(page), y1 = by(r1, "y")
  expect(y1.works - y0.works, `${y0.id}: the Yes adds exactly 15 to its painted Works %`).toBe(15)
  for (const c of r1.cards.filter((c: W) => c.hk !== "y" && c.key !== y0.key))
    expect(c.works, `${c.id}: the seat part is already at the cap, so every other card stays where it was`).toBe(r0.cards.find((x: W) => x.id === c.id).works)
  expect(r1.permanent[y0.key], "the worker's profile carries the move's +0.15").toBe(0.15)
  expect(r1.sent, "the worker was sent the NEW profile").toBe(r1.profile)
  expect(r1.sent, "...which is not the one it held before").not.toBe(r0.sent)
  // v1.272.0: was "thin gold on the card" ("")
  expect(y1.seal, "the filled seal on the card").toBe("known")
  expect((await line(page, j)).known, "the line counts the Yes").toBe(line0.known + 1)

  // a Yes on the seat's best move: the seat's Win % rides on it, so it rises (a direction; both draws rigged). If it
  // is a submission its card prints the FINISH, where the move's deck counts at the state and at the move, so its
  // Works % gains 30: what maxing that deck's flashcards gives it too (the shared law, mdp-adapter.src.js)
  await settled(page)
  const zp = await pointOn(page, '[data-hk="z"]')
  await page.mouse.move(zp.x, zp.y)
  await expect.poll(() => asking(page, '[data-hk="z"]')).toEqual({ asking: true, q: "Did you get it?" })
  await page.waitForTimeout(ARM)
  await j.clickByMouse('[data-hk="z"] [data-grade="yes"]', '"Yes" on the best move')
  await page.mouse.move(zp.x, zp.y - 160)
  await settled(page)
  const rz = await read(page), z0 = by(r1, "z"), z1 = by(rz, "z")
  const zEntry = await page.evaluate(() => { const a = (window as W).__neural; return a._optionCards.find((c: W) => c.card.getAttribute("data-hk") === "z").opt.node.ty === "submissions" })
  expect(z1.works - z0.works, `${z0.id}: +${zEntry ? 30 : 15} on its painted Works %`).toBe(zEntry ? 30 : 15)
  expect(rz.seatWin, `the seat's Win % rises with its best move's odds (rigged draws): ${r1.seatWin} -> ${rz.seatWin}`).toBeGreaterThan(r1.seatWin)

  // No, by mouse, on the known and due move: "Still got it?" No takes its +15 and its gold back
  await settled(page)
  const q = await pointOn(page, '[data-hk="due"]')
  await page.mouse.move(q.x, q.y)
  await expect.poll(() => asking(page, '[data-hk="due"]')).toEqual({ asking: true, q: "Still got it?" })
  await page.waitForTimeout(ARM)
  await j.clickByMouse('[data-hk="due"] [data-grade="no"]', '"No"')
  await page.mouse.move(q.x, q.y - 160)
  await settled(page)
  const r2 = await read(page), due2 = by(r2, "due")
  expect(due2.works - due0.works, `${DUE}: the No takes exactly 15 off its painted Works %`).toBe(-15)
  expect(r2.permanent[due0.key] || 0, "...and its permanent bonus off the worker's profile").toBe(0)
  expect([r2.sent === r2.profile, r2.sent !== rz.sent], "the worker was sent that profile too").toEqual([true, true])
  // v1.272.0: was "the No takes the gold away"; it was due, so it had no seal, and the No gives it none
  expect(due2.seal, "after the No: no seal").toBeNull()
  expect((await line(page, j)).known, "the line counts it down: two Yeses, one No").toBe(line0.known + 1)
})

test("the card's seal and the map's gold: known, then the flashcards learned too, without a reload", async ({ page }) => {
  test.setTimeout(300_000)
  const j = await seat(page)
  const p = await pointOn(page, '[data-hk="y"]')
  await page.mouse.move(p.x, p.y)
  await expect.poll(() => asking(page, '[data-hk="y"]')).toEqual({ asking: true, q: "Did you get it?" })
  await page.waitForTimeout(ARM)
  await j.clickByMouse('[data-hk="y"] [data-grade="yes"]', '"Yes"')
  await page.mouse.move(p.x, p.y - 160)
  const ids = await page.evaluate((due) => {
    const a = (window as W).__neural, own = a._optionCards.filter((c: W) => !c.opt.threat)
    const y = own.find((c: W) => c.card.getAttribute("data-hk") === "y")
    // the unknown orb: the dealt move farthest from the known one on the map, so their windows cannot overlap
    const far = own.filter((c: W) => c !== y && c.opt.node.id !== due && !a._moveMastered(c.opt))
      .sort((p: W, q: W) => Math.hypot(q.opt.node.x - y.opt.node.x, q.opt.node.y - y.opt.node.y) - Math.hypot(p.opt.node.x - y.opt.node.x, p.opt.node.y - y.opt.node.y))[0]
    return { y: y.opt.node.id, u: far.opt.node.id, key: a.deckKeyFor(y.opt.node).key }
  }, DUE)
  // the card as a player sees it: its seal, and its border against a dealt card that is not known (v1.272.0)
  const ring = (page: Page) => page.evaluate(() => {
    const a = (window as W).__neural, c = document.querySelector('[data-hk="y"]')!, b = (el: Element) => { const s = getComputedStyle(el); return s.borderTopWidth + " " + s.borderTopColor + " " + s.boxShadow }
    // a dealt card that is not known and not under the pointer or asked (face down is fine: [data-hide] moves no border)
    const plain = a._optionCards.find((o: W) => !o.opt.threat && !o.card.hasAttribute("data-seal") && !o.card.hasAttribute("data-hover") && !o.card.hasAttribute("data-asking")).card
    return { seal: c.getAttribute("data-seal"), disc: !!c.querySelector("[data-choice-seal]"), border: b(c) === b(plain) ? "ordinary" : b(c) }
  })
  // polled: the card eases out of its hover (a box-shadow transition) after the pointer leaves
  // v1.272.0: was "level 1 on the card: the 1px gold border and a .5px ring" ({ attr: "", border: "1px rgba(232, 196, 106, 0.9)", ring: "0.5" })
  await expect.poll(() => ring(page), { message: "known on the card: the filled seal, on the ordinary border" }).toEqual({ seal: "known", disc: true, border: "ordinary" })
  // the seeded known move (DUE) is gold on the map too: its own window, so nothing else may change
  const m1 = await mapGold(page, ids.y, ids.u, [DUE])
  expect(m1.repeat, "the frame is deterministic (control)").toBe(0)
  expect(m1.apart, "the two orbs are far enough apart to tell apart").toBeGreaterThan(90)
  // v1.272.0: was "level 1 on the map: an outline drawn on the known orb"
  expect(m1.near, "on the map: the seal's dot drawn at the known orb").toBeGreaterThan(20)
  expect(m1.gold, `...in gold (its mean colour rgb(${m1.mean}), hue ${m1.hue}°)`).toBe(true)
  expect([m1.nearU, m1.elsewhere], "...and nothing on the unknown orb at the same zoom, nor anywhere but the known orbs").toEqual([0, 0])

  // the deck's flashcards learned (a rail: every card to stage 3, then the app's own publish), no reload
  await page.evaluate(async (key) => {
    const a = (window as W).__neural
    if (!a._deckHasCards(key)) await a.hydrateDeck(key)
    const cards = a._cardsOf(a.flashcards.decks[key])
    a.stage[key] = Object.fromEntries(cards.map((c: W) => [a.qhash(c.q), 3]))
    a._publishKnowledge("test:deck-learned")
  }, ids.key)
  expect(await page.evaluate((key) => (window as W).__neural.deckMastery(key), ids.key), "the deck reads learned").toBe(1)
  // v1.272.0: was "level 2 on the card, without a reload: the border and a 2px ring, twice level 1's 1.5px"
  // ({ attr: "2", ... ring: "2" }); the seal has two kinds, and a Yes with its flashcards learned is still "known"
  await expect.poll(() => ring(page), { message: "the deck learned too: still the filled seal, still the ordinary border (the row rules)" }).toEqual({ seal: "known", disc: true, border: "ordinary" })
  const m2 = await mapGold(page, ids.y, ids.u, [DUE])
  expect([m2.nearU, m2.elsewhere], "the deck learned too: still nothing elsewhere").toEqual([0, 0])
  expect(m2.gold, `...in gold (rgb(${m2.mean}), hue ${m2.hue}°)`).toBe(true)
  console.log(`[moves-mastery] map dot: known ${m1.near} px rgb(${m1.mean}), the deck learned too ${m2.near} px rgb(${m2.mean})`)
  const ratio = m2.near / m1.near
  // v1.272.0: was ratio 1.6 to 2.6, "the map's outline about doubles" (U122 a's level 2); the dot has one state
  expect(ratio > 0.8 && ratio < 1.25, `the map's dot does not grow when the deck is learned too: ${m1.near} -> ${m2.near} px (x${ratio.toFixed(2)})`).toBe(true)
})

test("a seat known in part, below the cap: every card's Win % prints, and the worker reads the card's own figure", async ({ page }) => {
  // review STAGE2E/F: the provider compares the card's chance with the worker's by `!==` and one card that differs makes
  // every card print "—". The first build differed by an ulp on 29 of 6,648 partly known gi seat states; this is one of
  // them (Back Control Top, 7 of its 17 dealt moves known, no flashcards: app 0.06176470588235294, worker
  // 0.06176470588235293), red on that build with `live-knowledge-probability-mismatch`. The cases above sit on the cap.
  test.setTimeout(240_000)
  const known = ["Submissions/Rear-Naked-Choke/from-Back-Control", "Submissions/Suloev-Stretch/from-Half-Guard",
    "Transitions/Back-Control-to-Seat-Belt-Control-Back", "Submissions/Rear-Triangle-Choke/from-Back-Control",
    "Submissions/Armbar/from-Back-with-Legs", "Submissions/Short-Choke/from-Back-Control", "Transitions/Gift-Wrap-from-Back"]
  const j = journey(page)
  await j.boot("/", { initialState: { v: 2, moves: { [ORD["Positions/Back-Control"] + "/top"]: Object.fromEntries(known.map((id) => [String(ORD[id]), [DAY + 3, 3, DAY - 1, 1]])) } } })
  await j.land("Back Control Top")
  // the hand's values reach a final status: the claim is that it is a number, never "evaluation-failed" (which a one-
  // card mismatch turns every card into)
  await expect.poll(() => page.evaluate(() => { const a = (window as W).__neural, s = a._choiceValues?.snapshot()
    return s && s.handId === a._choiceHandId && s.status !== "pending" && s.reason !== "preparing" && !a._choiceValueQueued && !a._residencyHold ? s.status : "waiting" }), { timeout: 180_000 }).not.toBe("waiting")
  const status = await page.evaluate(() => (window as W).__neural._choiceValues.snapshot().status)   // "preparing" is the model still loading
  expect(status, "the hand's Win % is computed, not refused (live-knowledge-probability-mismatch prints \"—\" on every card)").toMatch(/^(ready|bounded)$/)
  await settled(page)
  const r = await page.evaluate(() => {
    const a = (window as W).__neural, own = a._optionCards.filter((c: W) => !c.opt.threat)
    return { share: a._seatShare(a._posKey), m: a.mastery(a._posKey), perm: a.knowledgeProfile().permanent[a._posKey], n: own.length,
      wins: own.map((c: W) => c.card.querySelector("[data-choice-win]")?.textContent || "") }
  })
  expect(r.share > 0 && r.share < 1 && r.m < 0.15, `a part of the seat known, below the cap (share ${r.share}, ${r.m})`).toBe(true)
  expect(Object.is(r.perm, r.m), `the worker reads the card's own figure: ${r.perm} vs ${r.m}`).toBe(true)
  expect(r.wins.filter((w: string) => !/^\d+$/.test(w)), `every one of the ${r.n} cards prints its Win %`).toEqual([])
})

test.describe("touch", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } })

  test("a tap on Yes adds 15 to that card's Works %, sends the new profile, and counts in the line", async ({ page }) => {
    test.setTimeout(300_000)
    const j = await seat(page)
    const r0 = await read(page), y0 = by(r0, "y")
    await settled(page)
    const p = await pointOn(page, '[data-hk="y"]')
    await page.touchscreen.tap(p.x, p.y)
    await expect.poll(() => asking(page, '[data-hk="y"]')).toEqual({ asking: true, q: "Did you get it?" })
    const yes = await page.evaluate(() => { const r = document.querySelector('[data-hk="y"] [data-grade="yes"]')!.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })
    await page.waitForTimeout(ARM)
    await page.touchscreen.tap(yes.x, yes.y)
    await settled(page)
    const r1 = await read(page), y1 = by(r1, "y")
    expect(y1.works - y0.works, `${y0.id}: +15 on its painted Works %`).toBe(15)
    expect([r1.permanent[y0.key], r1.sent === r1.profile, r1.sent !== r0.sent], "the worker's new profile carries it").toEqual([0.15, true, true])
    // v1.272.0: was "thin gold" ("")
    expect(y1.seal, "the filled seal").toBe("known")
    expect(await page.evaluate(() => !!(window as W).__neural._execution), "a tap on Yes plays nothing").toBe(false)
    const l = await line(page, j)
    expect(l, "the line counts it").toEqual({ known: 2, total: PAIRS_GI })
  })
})
