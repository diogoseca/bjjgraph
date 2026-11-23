import { expect, test, type Page } from "@playwright/test"
import { journey, recordDiff } from "../dsl"

/**
 * LAST ROLLS IS THE PLACES YOU WENT THROUGH (L3, v1.293.0).
 *
 * The owner, 16 Nov 2026: "I absolutely love the interface of Lastrolls, but I think Lastrolls should stop being about
 * answering … The idea is for last rolls to be about going through the [nodes] that were visited, not necessarily
 * answering flashcards." Answering lives in Master the game. So a row holds no deck: a press shows two actions, "Show on
 * the map" and "Practise here", and its sub line says what you remember there (the gold marks and the number, U199 a),
 * from the function Master the game's rows use.
 *
 * Pressed as a player does: a real mouse at 1440x900 and a touch tap at 390x631, each at a measured point that
 * `elementFromPoint` confirms is the control. The camera is read through `draw()`'s own transform (the node's `pairMid`
 * projected with `cam`), never from `camTarget` (CLAUDE.md §6.2).
 *
 * WHAT IS PINNED, AND THE MUTANT OF EACH. Each built alone into the served bundle (`npm run dev:neural:app`, under the lock),
 * after a neutral control that left all of this file green; the clean bundle rebuilt after and byte-identical. Every one is
 * RED at the step named (the last pass, on the PR's head, 18 Nov 2026; the table is in docs/Changelog-Archive.md, v1.293.0):
 *   M1  the inline deck back under a row (`_histRow`)                           → "a row is a place…" at "no card in the row"
 *   M2  the sub line back to the card count                                    → the same test, at "the sub line is the side and
 *       what you remember there"
 *   M3  the number is the hand's size, a total (`_placeGold`)                   → the same step. "the two lists say the same…" stays
 *       GREEN under it, and that is its claim: one function feeds both lists, so they cannot disagree
 *   M4  "Practise here" opens the list's first place                           → "Practise here opens that place…" at "the place
 *       asked for is the one open"
 *   M5  "Practise here" sends surface "place"                                  → the same test, at "one opening, its surface lastrolls"
 *   M6  "Show on the map" frames where the roll stands                         → "Show on the map frames the place…" at "the place
 *       is framed in the visible map"
 *   M7  a row that is not a position offers "Practise here"                     → "a submission a roll passed through…" at "no
 *       Practise here: Master the game lists positions"
 *   M8  THE HOLD NEVER LETS GO (`_lookEnd` does nothing)                        → "on a phone…a hand on the map lets it go" at
 *       "after a press on the map the roll runs again"
 *   M9  the map's press is not a lifter (pointerdown)                          → the same step (the wheel's test stays green)
 *   M10 the wheel is not a lifter                                              → "…a wheel on the map lets it go too" at "after a
 *       wheel on the map the roll runs again" (the press's test stays green)
 *   M11 the drawer opening does not take the pause back                         → "…the drawer opening again takes the pause back"
 *       at "the pause is the drawer's again"
 *   M12 a resume by another hand leaves the claim standing (`setPaused`)        → "…a move played from the hand ends the claim" at
 *       "the look's claim is over"
 *   M13 a new journey leaves the claim standing (`clearEngagement`)             → "…a staged place is not started by the next hand
 *       on the map" at "the staged board's clock is still held after a pan of the map"
 *   M14 the hold taken even when the drawer was not what stopped the game       → "…a board that was already still is not the
 *       look's" at "a pan of the map does not start a clock the look never held"
 *   M15 on a phone the drawer's shutting resumes the roll (no hold at all)      → "on a phone…a hand on the map lets it go" at "the
 *       drawer is shut and the clock is held: a look, not a return to play"
 *   M16 ⏎ and Space swapped                                                    → "keys on an open row…" at "and Space opened nothing else"
 *   M17 ← → walk the places                                                    → the same test, at "← → do nothing, and A, B, C
 *       answer nothing" (A, B, C have no block to answer in Last rolls: the step reads the record and the view unchanged)
 *   M18 the two actions 30 px tall                                             → "a row is a place…" at "Show on the map is at least 44 px tall"
 *   M19 "Show on the map" sends an event of its own                            → "Show on the map frames the place…" at "Show on
 *       the map sends nothing"
 *   M20 "Show on the map" writes to the record                                 → the same test, at "the press wrote nothing to the record"
 *   M21 "Practise here" writes to the record                                   → "Practise here opens that place…" at "the press
 *       wrote nothing to the record"
 *   M22 two rows open at once                                                  → "a row is a place…" at "one row open at a time"
 *   M23 on a desktop the drawer shuts too                                      → "Show on the map frames the place… (mouse)" at "on
 *       a desktop the drawer stays, and its pause with it"
 *   M24 the shown place is not named on the map                                → "Show on the map frames the place…" at "the map
 *       names the place it shows"
 *   M25 the name rides the camera's lease alone, not the look                  → "on a phone…a hand on the map lets it go" at "and
 *       the map still names the place: the name lasts as long as the look"
 *   M26 the name never ends                                                    → "Show on the map frames the place… (mouse)" at
 *       "after a pan of the map the name is gone", and the phone's test at "and the name is gone again after the camera's
 *       hold time"
 * A NON-KILL THAT CHANGED THE CODE: a line that cleared the name by hand when the look ended stayed green under its own
 * mutant (by then the camera's lease had ended it); the line is gone, and `_shownNode` has the one rule M25 and M26 pin.
 *   M27 a place the ruleset does not draw still offers its actions (`_histRow`) → "a place this ruleset does not draw…" at "no
 *       actions on a place this ruleset does not draw"
 *   M28 Last rolls is not drawn again when the ruleset is switched (`setGiMode`) → the same step
 *   M29 a press on a place on the map opens nothing (the tap's `stageRollAt`: existing code, the door T1 names) → "a
 *       submission a roll passed through…" at "a press on the place opens its card, and the card asks that deck"
 *   M31 a press on the place the map is showing takes whichever half it picks (the tap's routing, T7) → "a submission a
 *       roll passed through… (touch)" at "a press on the place opens its card, and the card asks that deck" (at 390 the two
 *       halves are drawn on the same pixel, and the press picked the defending one; at 1440 they are 14 px apart, so the
 *       mouse variant stays green under it, as it should)
 *   M32 Show on the map shows the key's own orb, the top one for both sides (`_histRow`'s `own`) → "Show on the map names
 *       the side the row is about" at "the map names Mount on the side the row is about: its bottom orb"
 *   M30 a deck's remembered reveal is kept for whatever card is at its index (`_miniDeck`, the fix of T6) → "a place opened
 *       again never shows an answer before its question" at "its answer is not on the screen before it is asked"
 *   M33 the press that ends a look goes on to the map as a tap (`attachInput`: `closing` not set) → "on a phone a press on the
 *       shown place itself during the hold…" and "…on another place on the map…" at "the same roll runs again: nothing
 *       staged, nothing opened, nothing filed, its card as it was", and "on a phone the drawer shuts…a hand on the map lets
 *       it go" at "the roll that runs again is the roll that was held…"
 *   M34 an open row that is not laid out still takes the keys (`_placeOpen` without `offsetParent`) → "a past roll folded
 *       away…" at "Space shows nothing: the row is not on the screen"
 *   M35 `_placeOpen` with no scope at all (the reader's J8, which survived three tests) → that step, and "keys never reach a
 *       row on the view you left" at "Space shows nothing from the view you left"
 *   M36 the way back from Practise here opens no row (`renderDrillHome`) → "Practise here opens that place…" at "back in Last
 *       rolls, the row it was pressed on is open again"
 *   M37 …and does not unfold the past roll the row is a state of (`_pastRollRow`) → "back from Practise here to a past
 *       roll's state…" at "the past roll is unfolded again"
 *   M38 a row opened under the panel's foot stays there (`_histRow`'s `toggle` without the scroll) → "the last row's two
 *       actions are brought whole into view…" at "a row opened at the list's foot: its two actions are whole in the list and
 *       under the finger"
 *   M39 the latest row's open state is not carried to the new latest row (the landing's `wasLatestOpen`) → "the latest row
 *       stays open across a landing" at "the new latest row is the open one"
 *   M40 a row that cannot be pressed lights under the pointer (`_histRow`) → "a place this ruleset does not draw… (mouse)" at
 *       "under the pointer it does not light: there is nothing to press"
 * L3-R2, the reader's re-read of PR #440 at 6ce6a6f03:
 *   M41 the press that ends a look does not take the camera's lease again (`_lookEnd`'s `press`), so after a look of more
 *       than 7 s the name ends with the look → "a submission a roll passed through… (touch)" at "a press on the place opens
 *       its card, and the card asks that deck" (the DEFENDER's card opens, as the reader met it; the mouse variant stays
 *       green, a desktop has no look), and "on a phone…a hand on the map lets it go" at "the place is still named after
 *       the press that ended the look…"
 *   M42 with nothing named, a press that picks one half of a close pair takes the other (the reader's N2, which stayed
 *       green 7 of 7) → "on a phone, with no place named, a press on a pair drawn on one pixel takes the half it picks" at
 *       "with nothing named, the press takes the half it picks: Mount, on the bottom" (and the named presses stay green
 *       under it, as they should)
 *   M43 the drawer's shutting does not forget the way back (`applyDeckVisibility`) → "the way back is forgotten when the
 *       drawer shuts…" at "no row is open: the way back was for the drawer that shut"
 *   M44 the way back opens the row its id names, whatever it holds now (`renderDrillHome`, the check out) → "the way back
 *       opens a row only while it is that row of that roll…" at "the new roll's first row is not opened…"
 *   M45 …or by its key alone, whatever roll it is a row of (the roll's identity out) → the same step
 * NOT COVERED HERE, and what to check by hand: a pinch (two real fingers; Playwright sends one), whose first finger is the
 * pointerdown M9 pins; the camera's 7 s lease running out by itself (camera canon, share-camera.spec.ts); the row's GOLD in
 * no-gi (it is `_placeGold`, which reads the ruleset's own hand as the map does). The light that ties the name to its orb at
 * a glance (L2b S1, v1.295.0) is pinned by the ink in e2e/journeys/map-light.spec.ts.
 * The harness serves `{}` for dossiers: no claim here reads a film or an article section.
 */

type W = any

async function press(page: Page, selector: string, what: string, touch: boolean) {
  for (let i = 0; ; i++) {
    try { await page.locator(selector).first().scrollIntoViewIfNeeded({ timeout: 3_000 }); break }
    catch (e) { if (i >= 4) throw e; await page.waitForTimeout(250) }
  }
  // (a control that fades in, as the two actions do over 220 ms, is pressed once it is fully shown, as a player would)
  await expect.poll(() => page.evaluate((sel) => { let a = 1; for (let n = document.querySelector(sel) as HTMLElement | null; n; n = n.parentElement) a *= Number(getComputedStyle(n).opacity); return a }, selector),
    { message: `${what}: fully shown`, timeout: 5_000 }).toBeGreaterThan(0.99)
  const at = await page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement | null
    if (!el) return { ok: false, why: "no element matches", x: 0, y: 0, h: 0 }
    const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2
    if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return { ok: false, why: "off screen", x, y, h: r.height }
    const top = document.elementFromPoint(x, y)
    let alpha = 1
    for (let n: HTMLElement | null = el; n; n = n.parentElement) alpha *= Number(getComputedStyle(n).opacity)
    if (alpha < 0.5) return { ok: false, why: "effective opacity " + alpha.toFixed(2), x, y, h: r.height }
    return { ok: !!top && (top === el || el.contains(top)), why: top ? "<" + top.tagName.toLowerCase() + " " + (top as HTMLElement).className + ">" : "nothing", x, y, h: r.height }
  }, selector)
  expect(at.ok, `${what}: the point under the press is the control (${at.why})`).toBe(true)
  if (touch) await page.touchscreen.tap(at.x, at.y)
  else await page.mouse.click(at.x, at.y)
  return at
}

const state = (page: Page) => page.evaluate(() => {
  const a = (window as W).__neural
  return { paused: !!a.paused, drawer: !!a.deckShown, look: !!a._lookAutoPaused, pane: !!a._paneAutoPaused, view: a._viewMode as string }
})
const beats = (page: Page, name: string) => page.evaluate((n) => ((window as W).__neural.beats || []).filter((b: W) => b.beat === n).map((b: W) => ({ ...b })), name)
/** the whole record as the next save would write it (`_progressBlob`), without the save's own clock (`updatedAt`, the
 *  moment of the save itself: the one field a save with nothing to say still changes) */
const record = (page: Page) => page.evaluate(() => {
  const a = (window as W).__neural, at = a._progressAt, b = JSON.parse(JSON.stringify(a._progressBlob()))
  a._progressAt = at
  delete b.updatedAt
  return b as Record<string, unknown>
})
/** the fields of the record that differ, each with both values: [] when the two are the same record. By value, whatever
 *  order a field's keys were written in (ORDER1, v1.294.0: `recordDiff`, e2e/dsl.ts; this compared `JSON.stringify` of
 *  each field and named the field alone) */
const changed = recordDiff
/** where a node is on screen, through draw()'s own transform, and the visible map's rect */
const onScreen = (page: Page, key: string) => page.evaluate((k) => {
  const a = (window as W).__neural, n = a.nodes[a.nodeForKey(k)], p = a.pairMid(n), W_ = a.W, H = a.H, sc = W_ / a.cam.vw
  const R = a._viewRect()
  return { x: W_ / 2 + (p.x - a.cam.cx) * sc, y: H / 2 + (p.y - a.cam.cy) * sc, rect: { left: R.left, top: R.top, right: R.left + R.width, bottom: R.top + R.height } }
}, key)
/** does the map NAME this place: the label the last frame published for a pair or for the pointer's node (`draw()`'s own
 *  output, `_lastPairLabel` / `_lastHoverLabel`), on the place's node or its pair's other half */
const named = (page: Page, key: string) => page.evaluate((k) => {
  const a = (window as W).__neural, i = a.nodeForKey(k), n = a.nodes[i], want = a.graphName(n)   // the one name every surface writes
  return !!want && [a._lastPairLabel, a._lastHoverLabel].some((l: W) => !!l && (l.idx === i || l.idx === n.pi) && String(l.main || "").includes(want))
}, key)
/** where a place's OWN orb is on screen (its node through the frame's lift, `_LY`: a pair's two halves are two orbs, and a
 *  press between them picks either), as page coordinates, and whether the map is what is under that point */
const orbPoint = (page: Page, key: string) => page.evaluate((k) => {
  const a = (window as W).__neural, n = a.nodes[a.nodeForKey(k)], c = a.canvas.getBoundingClientRect(), sc = a.W / a.cam.vw
  const x = c.left + a.W / 2 + (n.x - a.cam.cx) * sc, y = c.top + a.H / 2 + (a._LY(n) - a.cam.cy) * sc
  return { x, y, map: document.elementFromPoint(x, y) === a.canvas }
}, key)
/** a point within 3 px of a place's own orb where the app's own hit test (`_updateHover`, the tap's) picks its OTHER half,
 *  the map under it; and how far apart the two halves are drawn. At 390 wide, at the look's framing, a pair is drawn on
 *  one pixel, and a finger is never on the pixel: this is the press the reader of PR #440 made "2 px above the place". */
const otherHalfPoint = (page: Page, key: string, own?: number) => page.evaluate(({ k, o }) => {
  const a = (window as W).__neural, n = a.nodes[o ?? a.nodeForKey(k)], m = a.nodes[n.pi], c = a.canvas.getBoundingClientRect(), sc = a.W / a.cam.vw
  const x0 = c.left + a.W / 2 + (n.x - a.cam.cx) * sc, y0 = c.top + a.H / 2 + (a._LY(n) - a.cam.cy) * sc
  const apart = m ? Math.hypot(n.x - m.x, a._LY(n) - a._LY(m)) * sc : -1
  for (const [dx, dy] of [[0, -2], [0, 2], [-2, 0], [2, 0], [0, -3], [0, 3], [-3, 0], [3, 0], [2, -2], [-2, 2], [0, 0]]) {
    const x = x0 + dx, y = y0 + dy
    if (document.elementFromPoint(x, y) !== a.canvas) continue
    a._updateHover({ clientX: x, clientY: y, type: "pointerup", target: a.canvas })
    const h = a._hover ? (a._hover.idx as number) : -1
    a._hover = null
    if (m && h === m.idx) return { x, y, picks: h, own: n.idx as number, apart }
  }
  return null
}, { k: key, o: own })
const framed = (s: { x: number; y: number; rect: { left: number; top: number; right: number; bottom: number } }) => {
  const cx = (s.rect.left + s.rect.right) / 2, cy = (s.rect.top + s.rect.bottom) / 2
  return Math.abs(s.x - cx) < 40 && Math.abs(s.y - cy) < 40
}

/** a guest with gold at Mount, top; a roll from Mount (top) that has moved once, so two places are on the list; the roll live */
async function rolled(page: Page, touch: boolean, opts: { settings?: Record<string, unknown> } = {}) {
  const j = journey(page)
  const init = opts.settings ? { initialState: { v: 2, settings: opts.settings, settingsAt: Object.fromEntries(Object.keys(opts.settings).map((k) => [k, 5])) } } : {}
  await j.boot("/", init)
  await j.land("Mount Top")
  // two moves the map paints gold at Mount, top: a Yes in the moves record for two moves dealt there
  const gold = await page.evaluate(() => {
    const a = (window as W).__neural, day = a._epochDay(), k = "Mount|Top", i = a.nodeForKey(k), o = a._ordById.get(a.siteIdOf(a.nodes[i].id)), d = a._dealtOrds(i, "top") || []
    a.moves = a.moves || {}
    for (const m of d.slice(0, 2)) (a.moves[o + "/top"] = a.moves[o + "/top"] || {})[m] = [day + 30, 30, day - 1, 1]
    a._movesRev = (a._movesRev || 0) + 1
    return { dealt: d.length, map: [...a._movesGold().keys()].length }
  })
  expect(gold.dealt, "premise: Mount, top deals more than the two seeded moves (so a total would not be 2)").toBeGreaterThan(2)
  const t = await page.evaluate(() => {
    const a = (window as W).__neural
    for (const i of a.optionIdxs || []) if (a.nodes[i].ty === "transitions") return a.nodes[i].t as string
    return ""
  })
  await j.rig("resolve", [0.01]); await j.rig("outcome", [0.01])
  await j.pick(t)
  await j.nextHand()
  const keys = await page.evaluate(() => ((window as W).__neural.rollLog || []).map((h: W) => h.key as string))
  expect(keys.length, "premise: the roll has been through two places").toBeGreaterThanOrEqual(2)
  expect(keys[0], "premise: it started at Mount, top").toBe("Mount|Top")
  // the roll's first exchange mints a reward, a deliberate card over the map (on a phone it lies over the drawer's top rows):
  // the player puts it away, as a player does
  await dismissReward(page, touch)
  expect(await page.evaluate(() => !!(window as W).__neural.paused), "premise: the roll is live").toBe(false)
  return { j, keys }
}
async function dismissReward(page: Page, touch: boolean) {
  for (let i = 0; i < 4 && (await page.locator("[data-reward-close]").isVisible()); i++) {
    await expect.poll(() => page.locator("[data-reward-close]").evaluate((el) => { let a = 1; for (let n: HTMLElement | null = el as HTMLElement; n; n = n.parentElement) a *= Number(getComputedStyle(n).opacity); return a }).catch(() => 1), { message: "the reward card is fully shown" }).toBeGreaterThan(0.99)
    await press(page, "[data-reward-close]", "put the earned reward away", touch)
    await page.waitForTimeout(150)
  }
}
async function openLastRolls(page: Page, touch: boolean) {
  await dismissReward(page, touch)
  await press(page, ".ng-logo", "open the drawer", touch)
  await press(page, '[data-view="history"]', "Last rolls", touch)
  await expect(page.locator("[data-hist]").first()).toBeVisible()
}
const row = (key: string) => `[data-hist="${key}"]`
/** THE ROLL, as a player would know it for the same roll: where it has been, where it stands, its hand, its card, what
 *  is filed, what is staged, and how many journeys the board has begun (`_journeyId` moves with every restage) */
const theRoll = (page: Page) => page.evaluate(() => {
  const a = (window as W).__neural
  return { log: (a.rollLog || []).map((h: W) => h.key as string), stands: a.currentPos as number, hand: (a.optionIdxs || []).join(","), filed: (a._pastRolls || []).length,
    journey: a._journeyId as number, staged: a._staged ?? null, roam: !!a._roam, card: a._landEl && a._landEl.isConnected ? (a._landIdx as number) : null,
    url: location.pathname, explored: [...(a._exploredKeys || [])].length }
})
/** a point inside the visible map with a NODE under it that is not the shown place (the app's own hit test), nothing over it */
const nodePoint = (page: Page, notKey: string) => page.evaluate((k) => {
  const a = (window as W).__neural, c = a.canvas.getBoundingClientRect(), R = a._viewRect(), not = a.nodeForKey(k), notPi = a.nodes[not].pi
  for (let y = c.top + R.top + 12; y < c.top + R.top + R.height - 8; y += 9) for (let x = c.left + R.left + 12; x < c.left + R.left + R.width - 12; x += 11) {
    if (document.elementFromPoint(x, y) !== a.canvas) continue
    a._updateHover({ clientX: x, clientY: y, type: "pointerup", target: a.canvas })
    const h = a._hover ? a._hover.idx : -1
    a._hover = null
    if (h >= 0 && h !== not && h !== notPi && h !== a.currentPos) return { x, y, node: a.nodes[h].t as string }
  }
  return null
}, notKey)
/** a point of the map no node and no control is under, found with the app's own hover test */
const emptyMapPoint = (page: Page) => page.evaluate(() => {
  const a = (window as W).__neural, c = a.canvas.getBoundingClientRect()
  for (let y = c.top + 70; y < c.bottom - 40; y += 23) for (let x = c.left + 30; x < c.right - 30; x += 31) {
    const el = document.elementFromPoint(x, y)
    if (el !== a.canvas && el !== a.wrapRef.current) continue
    a._updateHover({ clientX: x, clientY: y })
    const free = !a._hover || a._hover.idx < 0
    a._hover = null
    if (free) return { x, y }
  }
  return null
})

for (const touch of [false, true]) {
  test.describe(touch ? "touch 390x631" : "mouse 1440x900", () => {
    test.use(touch ? { hasTouch: true, isMobile: true, viewport: { width: 390, height: 631 } } : { viewport: { width: 1440, height: 900 } })
    const who = touch ? "touch" : "mouse"

    test(`a row is a place: no card, what you remember there, and two actions a thumb can press (${who})`, async ({ page }) => {
      const { keys } = await rolled(page, touch)
      await openLastRolls(page, touch)
      const second = keys[keys.length - 1]
      // the sub line: the side, then the gold marks and the number; nothing where nothing is remembered
      const sub = (k: string) => page.locator(row(k)).first().locator("[data-hist-sub]")
      await expect(sub("Mount|Top"), "the sub line is the side and what you remember there").toHaveText("Top2")
      expect(await sub("Mount|Top").locator("[data-master-gold]").getAttribute("data-master-gold"), "the number is the moves the map paints gold there").toBe("2")
      expect(await sub("Mount|Top").locator("[data-master-gold] svg").count(), "one mark a move").toBe(2)
      await expect(sub(second), "nothing remembered: the side alone, no 0, no total, no card count").toHaveText(/^(Top|Bottom|Attacker|Defender)$/)
      expect(await page.locator("[data-hist]").evaluateAll((els) => els.map((e) => e.textContent || "").filter((t) => /cards|mastered|\d+\/\d+/.test(t))), "no row counts cards").toEqual([])
      // a press shows the two actions, where the deck used to open
      await press(page, row("Mount|Top"), "the row of Mount, top", touch)
      const acts = page.locator(row("Mount|Top")).first().locator("xpath=following-sibling::div[1]")
      await expect(acts, "the row opens").toBeVisible()
      await expect(page.locator(".ng-drill [data-mini-deck], .ng-drill [data-mini-q], .ng-drill [data-mc-opt], .ng-drill [data-practice-mc-opt]"), "no card in the row").toHaveCount(0)
      await expect(acts.locator("button"), "two actions under the row").toHaveText([/^Show on the map/, /^Practise here/])
      for (const [sel, what] of [["[data-hist-show]", "Show on the map"], ["[data-hist-go]", "Practise here"]] as const) {
        const box = await page.locator(sel).evaluate((el) => {
          const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, top = document.elementFromPoint(x, y)
          // the edges too: 3 px inside each end, on the button's middle line
          const ends = [r.left + 3, r.right - 3].map((ex) => { const t = document.elementFromPoint(ex, y); return !!t && (t === el || el.contains(t)) })
          return { h: r.height, w: r.width, hit: !!top && (top === el || el.contains(top)), ends }
        })
        expect(box.h, `${what} is at least 44 px tall`).toBeGreaterThanOrEqual(44)
        expect(box.w, `${what} is at least 44 px wide`).toBeGreaterThanOrEqual(44)
        expect(box.hit && box.ends.every(Boolean), `${what}: its middle and both its ends are the button under the pointer`).toBe(true)
      }
      const gap = await page.evaluate(() => {
        const a = document.querySelector("[data-hist-show]")!.getBoundingClientRect(), b = document.querySelector("[data-hist-go]")!.getBoundingClientRect()
        return b.left - a.right
      })
      expect(gap, "the two do not touch").toBeGreaterThanOrEqual(8)
      // one row open at a time; a second press on a row closes it
      await press(page, row(second), "the latest row", touch)
      await expect(page.locator("[data-hist-show]:visible"), "one row open at a time").toHaveCount(1)
      await press(page, row(second), "the latest row again", touch)
      await expect(page.locator("[data-hist-show]:visible"), "a second press closes it").toHaveCount(0)
    })

    test(`Practise here opens that place in Master the game, as its own row does, and writes nothing (${who})`, async ({ page }) => {
      const { j, keys } = await rolled(page, touch)
      await j.knowsPlanMoves()   // the place's cards then (its moves known); the cloze has its own test below
      await openLastRolls(page, touch)
      await press(page, row("Mount|Top"), "the row of Mount, top", touch)
      const before = await record(page)
      await page.evaluate(() => { const a = (window as W).__neural, t = a.track.bind(a); (window as W).__tracked = []; a.track = (e: string, p: W) => { (window as W).__tracked.push([e, p]); return t(e, p) } })
      await press(page, "[data-hist-go]", "Practise here", touch)
      await expect(page.locator("[data-practice-page]"), "Master the game is open").toHaveCount(1)
      const open = () => page.evaluate(() => { const a = (window as W).__neural, s = a._session; return s ? (s.czOpen != null ? s.czOpen : s.list ? null : a._masterSeatOf(s, s.keys[s.idx])) : null })
      await expect.poll(open, { timeout: 30_000, message: "the place asked for is the one open" }).toBe("Mount|Top")
      expect(await page.evaluate(() => { const s = (window as W).__neural._session; return s.plan ? [...new Set(s.plan.visits.map((v: W) => v.seat))][0] : null }), "premise: it is not simply the list's first place").not.toBe("Mount|Top")
      await expect(page.locator("[data-mini-q]:visible"), "its first card is asked").toHaveCount(1, { timeout: 20_000 })
      await expect(page.locator('[data-master-row="Mount|Top"]'), "its row is marked").toHaveAttribute("data-on", "")
      // (the reader of PR #440 could not produce this one: Mount, top is a place this guest has been to, with nothing due)
      await expect(page.locator("[data-practice-section]"), "a been-to place with nothing due opens, as a free review").toContainText("free review")
      // R4: what that free review asks, said as it is. The place's own deck, every card of it but those today's session
      // already asks at another place (a question two decks share is asked once); a later visit asks what is left of it.
      const fr = await page.evaluate(() => {
        const a = (window as W).__neural, s = a._session, key = "Mount|Top", rows = s.plan.due.concat(s.plan.fresh)
        const all = (a._cardsOf(a.flashcards.decks[key]) || []).map((c: W) => a.qhash(c.q) as string), mine = rows.filter((r: W) => r.key === key).flatMap((r: W) => r.questions as string[])
        const elsewhere = new Set(rows.filter((r: W) => r.key !== key).flatMap((r: W) => r.questions as string[]))
        return { whole: all.length, asked: mine.length, left: all.filter((q: string) => !mine.includes(q)), leftAskedElsewhere: all.filter((q: string) => !mine.includes(q) && elsewhere.has(q)),
          figure: (document.querySelector('[data-master-row="Mount|Top"] [data-master-prog]') as HTMLElement | null)?.textContent ?? null }
      })
      expect(fr.whole, "premise: Mount, top has a deck of several cards").toBeGreaterThan(2)
      expect(fr.figure, "the open place's figure is what the free review asks").toBe(`0/${fr.asked}`)
      expect(fr.left, "the free review asks every card of the place's deck but those today's session asks at another place").toEqual(fr.leftAskedElsewhere)
      expect(fr.asked, "and that is most of the deck").toBeGreaterThan(fr.whole / 2)
      expect((await page.evaluate(() => (window as W).__tracked)).filter((t: W) => t[0] === "neural_practice_opened").map((t: W) => t[1].surface), "one opening, its surface lastrolls").toEqual(["lastrolls"])
      expect(Object.keys(before).length, "premise: the record is read whole").toBeGreaterThan(15)
      expect(changed(before, await record(page)), "the press wrote nothing to the record").toEqual([])
      // as Master the game's own row press opens it: back to the list, press its row there, the same ask
      const first = await page.evaluate(() => { const a = (window as W).__neural, s = a._session; return { cloze: s.czOpen, key: s.keys[s.idx], q: (document.querySelector("[data-mini-q]") as HTMLElement).textContent } })
      await press(page, "[data-master-list]", "back to the list", touch)
      await expect(page.locator("[data-master-start]")).toBeVisible()
      await press(page, '[data-master-row="Mount|Top"]', "Master the game's own row", touch)
      await expect(page.locator("[data-mini-q]:visible")).toHaveCount(1, { timeout: 20_000 })
      expect(await page.evaluate(() => { const a = (window as W).__neural, s = a._session; return { cloze: s.czOpen, key: s.keys[s.idx], q: (document.querySelector("[data-mini-q]") as HTMLElement).textContent } }), "the row's own press opens the same ask").toEqual(first)
      // and the way back is Last rolls
      await press(page, ".ng-drawer-brand", "‹ Master the game", touch)
      await expect(page.locator(".ng-drawer-brand"), "the brand leads back to Last rolls").toHaveText("‹ Last rolls")
      await expect(page.locator(row(keys[0])).first()).toBeVisible()
      // R6: the row it was pressed on is open again, and in view
      const again = `${row("Mount|Top")} + .ng-hact`
      await expect(page.locator(again + " [data-hist-show]"), "back in Last rolls, the row it was pressed on is open again").toBeVisible()
      await expect(page.locator(again + " [data-hist-go]"), "with both its actions").toBeVisible()
      await expect(page.locator(row("Mount|Top")).first(), "and in view").toBeInViewport({ ratio: 1 })
      await expect(page.locator(again + " [data-hist-go]"), "its actions too").toBeInViewport({ ratio: 1 })
    })

    // ALSO FIXED WITH L3 (T6): a deck remembers its place by index, a new session asks another subset of it, and the card now
    // at that index was drawn with the last card's reveal. Every "Practise here" is a new session, so this is its common road.
    // (On dev the same is reached from Master the game's own row: docs/Changelog-Archive.md, v1.293.0, has the steps and the run.)
    test(`a place opened again never shows an answer before its question (${who})`, async ({ page }) => {
      const { j } = await rolled(page, touch)
      await j.knowsPlanMoves()
      await openLastRolls(page, touch)
      await press(page, row("Mount|Top"), "the row of Mount, top", touch)
      await press(page, "[data-hist-go]", "Practise here", touch)
      const open = '[data-session-row][aria-expanded="true"] + div'
      await expect(page.locator(open + " [data-practice-mc-opt]"), "premise: its first card asks multiple choice (Auto, a new card)").toHaveCount(3, { timeout: 30_000 })
      const first = await page.evaluate(() => { const m = (window as W).__neural._mc; return { key: m.key as string, qh: m.qhash as string, right: m.correct as number } })
      await press(page, `${open} [data-practice-mc-opt="${first.right}"]`, "the right answer", touch)
      await expect.poll(() => page.evaluate(({ key, qh }) => { const a = (window as W).__neural; return !!(a.srs[key] && a.srs[key][qh]) }, first), { message: "premise: it is answered" }).toBe(true)
      expect(await page.evaluate((k) => (window as W).__neural._deckState[k], first.key), "premise: the deck remembers its first place as answered and revealed").toMatchObject({ idx: 0, revealed: true })
      await press(page, ".ng-drawer-brand", "‹ Master the game", touch)
      // (the way back opens the row it was pressed on, R6: its Practise here is there to press)
      await press(page, `${row("Mount|Top")} + .ng-hact [data-hist-go]`, "Practise here, again", touch)
      await expect(page.locator(open + " [data-practice-mc-opt]"), "the place opens on a card not yet answered, asked as a new card is").toHaveCount(3, { timeout: 30_000 })
      expect(await page.evaluate(() => (window as W).__neural._mc.qhash), "premise: another card than the one answered").not.toBe(first.qh)
      await expect(page.locator(".ng-drill [data-mini-a]"), "its answer is not on the screen before it is asked").toHaveCount(0)
    })

    test(`the two lists say the same about a place (${who})`, async ({ page }) => {
      const { j } = await rolled(page, touch)
      await j.knowsPlanMoves()
      await openLastRolls(page, touch)
      const here = await page.locator(row("Mount|Top")).first().locator("[data-master-gold]").evaluate((el) => el.outerHTML)
      await press(page, row("Mount|Top"), "the row of Mount, top", touch)
      await press(page, "[data-hist-go]", "Practise here", touch)
      await expect(page.locator('[data-master-row="Mount|Top"] [data-master-gold]'), "Master the game's row carries the mark").toHaveCount(1, { timeout: 30_000 })
      // knowsPlanMoves marked more moves at the plan's places; Mount, top is asked for what it holds NOW, in both lists
      const there = await page.locator('[data-master-row="Mount|Top"] [data-master-gold]').evaluate((el) => el.outerHTML)
      await press(page, ".ng-drawer-brand", "‹ Master the game", touch)
      await expect(page.locator(row("Mount|Top")).first()).toBeVisible()
      const again = await page.locator(row("Mount|Top")).first().locator("[data-master-gold]").evaluate((el) => el.outerHTML)
      expect(there, "the same mark, the same number, in Master the game's row and in Last rolls' row").toBe(again)
      expect(here.length, "premise: Last rolls drew a mark before Master the game was ever opened").toBeGreaterThan(0)
    })

    test(`Practise here opens the place's moves as a cloze when they are owed, and its cards for a Multiple choice player (${who})`, async ({ page }) => {
      const { keys } = await rolled(page, touch)
      // a move at Mount, top that is OWED: answered Yes four days ago, due yesterday (a whole row, as the plan's law reads it)
      await page.evaluate(() => {
        const a = (window as W).__neural, day = a._epochDay(), i = a.nodeForKey("Mount|Top"), o = a._ordById.get(a.siteIdOf(a.nodes[i].id)), d = a._dealtOrds(i, "top") || []
        a.moves[o + "/top"][d[2]] = [day - 1, 3, day - 4, 1]
        a._movesRev = (a._movesRev || 0) + 1
      })
      await openLastRolls(page, touch)
      await press(page, row("Mount|Top"), "the row of Mount, top", touch)
      await press(page, "[data-hist-go]", "Practise here", touch)
      await expect(page.locator('[data-cloze="Mount|Top"]'), "a move is owed there: the cloze").toBeVisible({ timeout: 30_000 })
      await expect(page.locator("[data-mini-q]:visible"), "and no card before it").toHaveCount(0)
      // the same press for a player who asked for multiple choice everywhere: cards only
      await page.evaluate(() => (window as W).__neural.set("mcMode", "mc"))
      await press(page, ".ng-drawer-brand", "‹ Master the game", touch)
      await press(page, `${row(keys[0])} + .ng-hact [data-hist-go]`, "Practise here, on the row the way back opened", touch)
      await expect(page.locator("[data-mini-q]:visible"), "Multiple choice: its card").toHaveCount(1, { timeout: 30_000 })
      await expect(page.locator("[data-cloze]:visible"), "and no cloze").toHaveCount(0)
    })

    test(`Show on the map frames the place, and writes nothing (${who})`, async ({ page }) => {
      const { j, keys } = await rolled(page, touch)
      await openLastRolls(page, touch)
      const second = keys[keys.length - 1]
      await j.advance(1200)
      expect(framed(await onScreen(page, "Mount|Top")), "premise: the map is not on Mount before the press").toBe(false)
      expect(await named(page, "Mount|Top"), "premise: nor does it name Mount").toBe(false)
      await press(page, row("Mount|Top"), "the row of Mount, top", touch)
      const before = await record(page)
      await page.evaluate(() => { const a = (window as W).__neural, t = a.track.bind(a); (window as W).__tracked = []; a.track = (e: string, p: W) => { (window as W).__tracked.push([e, p]); return t(e, p) } })
      await press(page, "[data-hist-show]", "Show on the map", touch)
      for (let i = 0; i < 30 && !framed(await onScreen(page, "Mount|Top")); i++) await j.advance(200)
      const at = await onScreen(page, "Mount|Top")
      expect(framed(at), `the place is framed in the visible map (at ${Math.round(at.x)},${Math.round(at.y)} in ${JSON.stringify(at.rect)})`).toBe(true)
      expect(framed(await onScreen(page, second)), "and it is not where the roll stands that is framed").toBe(false)
      await j.advance(200)
      expect(await named(page, "Mount|Top"), "the map names the place it shows").toBe(true)
      expect(await page.evaluate(() => (window as W).__tracked), "Show on the map sends nothing").toEqual([])
      expect(changed(before, await record(page)), "the press wrote nothing to the record").toEqual([])
      const s = await state(page)
      if (!touch) {
        expect(s, "on a desktop the drawer stays, and its pause with it").toMatchObject({ drawer: true, paused: true, look: false, pane: true })
        // the name rides the camera's lease on this flight: the player takes the camera (a pan of the map) and it goes
        const p = await emptyMapPoint(page)
        await page.mouse.move(p!.x, p!.y); await page.mouse.down(); await page.mouse.move(p!.x + 40, p!.y + 16, { steps: 4 }); await page.mouse.up()
        await page.mouse.move(8, 8)   // off the map: the pointer names nothing
        await j.advance(800)
        expect(await named(page, "Mount|Top"), "after a pan of the map the name is gone").toBe(false)
      } else expect(s, "on a phone the drawer shuts and the clock is held: a look, not a return to play").toMatchObject({ drawer: false, paused: true, look: true, pane: false })
    })

    // L3-R1: a position's key resolves to its TOP orb for both of its sides, so from a Bottom row the map named the place
    // "TOP". The row shows the half the roll stood on. Made on a row the roll no longer stands on: where it stands, the map
    // names its seat anyway.
    test(`Show on the map names the side the row is about (${who})`, async ({ page }) => {
      const j = journey(page)
      await j.boot("/")
      await j.land("Mount Top")
      for (const [t, v] of [["ai-skill", 0.5], ["role", 0], ["max-moves", 0.5]] as const) await j.rig(t, [v])
      // a roll from Mount on the BOTTOM (the app's own "roll from here, bottom"), then one move on
      await page.evaluate(() => { const a = (window as W).__neural; a.rollFromPosition(a.nodeForKey("Mount|Top"), false, "bottom") })
      for (let i = 0; i < 40; i++) { await j.advance(500); if (await page.evaluate(() => { const a = (window as W).__neural; return (a.rollLog || []).length === 1 && a.rollLog[0].key === "Mount|Bottom" && (a.optionIdxs || []).length > 0 })) break }
      const t = await page.evaluate(() => { const a = (window as W).__neural; for (const i of a.optionIdxs || []) if (a.nodes[i].ty === "transitions") return a.nodes[i].t as string; return a.nodes[a.optionIdxs[0]].t as string })
      await j.rig("resolve", [0.01]); await j.rig("outcome", [0.01])
      await j.pick(t)
      await j.nextHand()
      const log = await page.evaluate(() => { const a = (window as W).__neural; return a.rollLog.map((h: W) => ({ key: h.key as string, role: h.role as string })) })
      expect(log[0], "premise: the roll began at Mount on the bottom").toEqual({ key: "Mount|Bottom", role: "Bottom" })
      expect(log.length, "premise: and has moved on, so Mount is not where it stands").toBeGreaterThan(1)
      // Mount's two orbs, from the map's own data: the key answers to one of them for both sides; the other is its pair
      const orbs = await page.evaluate(() => { const a = (window as W).__neural, n = a.nodes[a.nodeForKey("Mount|Bottom")], p = a.nodes[n.pi]; return Object.fromEntries([n, p].map((x: W) => [x.role, x.idx])) as Record<string, number> })
      expect(Object.keys(orbs).sort(), "premise: Mount is drawn as a top orb and a bottom orb").toEqual(["bottom", "top"])
      expect(log[log.length - 1].key, "premise: it stands somewhere else").not.toBe("Mount|Bottom")
      await openLastRolls(page, touch)
      await press(page, row("Mount|Bottom"), "the row of Mount, bottom", touch)
      await press(page, `${row("Mount|Bottom")} + .ng-hact [data-hist-show]`, "Show on the map", touch)
      for (let i = 0; i < 30 && !framed(await onScreen(page, "Mount|Bottom")); i++) await j.advance(200)
      await j.advance(200)
      const label = await page.evaluate((own) => {
        const a = (window as W).__neural, n = a.nodes[own]
        const l = [a._lastPairLabel, a._lastHoverLabel].find((x: W) => !!x && (x.idx === own || x.idx === n.pi))
        return l ? { idx: l.idx as number, role: a.nodes[l.idx].role as string } : null
      }, orbs.bottom)
      expect(label, "the map names Mount on the side the row is about: its bottom orb").toEqual({ idx: orbs.bottom, role: "bottom" })
    })

    test(`a submission a roll passed through has Show on the map alone (${who})`, async ({ page }) => {
      const j = journey(page)
      await j.boot("/")
      await j.land("Mount Top")
      const sub = await page.evaluate(() => { const a = (window as W).__neural; for (const i of a.optionIdxs || []) if (a.nodes[i].ty === "submissions") return a.nodes[i].t as string; return null })
      expect(sub, "premise: the opening hand offers a submission").not.toBeNull()
      await j.rig("resolve", [0.01]); await j.rig("outcome", [0.01])
      await j.pick(sub as string)
      await j.nextHand()
      const key = sub + "|Attacker"
      expect(await page.evaluate(() => ((window as W).__neural.rollLog || []).map((h: W) => h.key)), "premise: the roll passed through the submission").toEqual(["Mount|Top", key])
      await openLastRolls(page, touch)
      await press(page, `[data-hist="${key}"]`, "the submission's row", touch)
      await expect(page.locator("[data-hist-show]:visible"), "Show on the map").toHaveCount(1)
      await expect(page.locator("[data-hist-go]"), "no Practise here: Master the game lists positions").toHaveCount(0)
      await page.keyboard.press("Enter")
      expect(await page.evaluate(() => !!(window as W).__neural._session), "and ⏎ opens nothing there").toBe(false)
      // THE DOOR TO ITS CARDS (L3-R1, T1: until v1.293.0 this row opened the submission's own deck in place; 574 such decks,
      // tests/artifacts/_last_rolls_places_count.mjs). Show on the map names the place; a press on it there opens its card,
      // the card asks THAT deck, and an answer is a grade in it. Made on a row the roll no longer stands on, so the card is
      // not simply the roll's own: the player rolls again from Mount (the first row's ▶), and the roll with the submission
      // is filed under Previous rolls.
      for (const [t, v] of [["ai-skill", 0.5], ["role", 0], ["max-moves", 0.5]] as const) await j.rig(t, [v])
      await press(page, `${row("Mount|Top")} .hplay`, "Roll from Mount, top", touch)
      for (let i = 0; i < 40; i++) {
        await j.advance(500)
        if (await page.evaluate(() => { const a = (window as W).__neural; return (a._pastRolls || []).length === 1 && (a.rollLog || []).length === 1 && (a.optionIdxs || []).length > 0 })) break
      }
      expect(await page.evaluate(() => { const a = (window as W).__neural; return { past: (a._pastRolls || []).map((r: W) => r.log.map((h: W) => h.key)), now: a.nodes[a.currentPos].t } }),
        "premise: the roll with the submission is a past roll, and the board stands on Mount").toEqual({ past: [["Mount|Top", key]], now: "Mount Top" })
      await openLastRolls(page, touch)
      await press(page, "[data-past-roll]", "the past roll", touch)
      await press(page, `[data-hist="${key}"]`, "the submission's row, in the past roll", touch)
      // (scoped to this row: the new roll's own latest row is on the page too, and its two actions with it)
      const mine = `[data-hist="${key}"] + .ng-hact`
      await expect(page.locator(mine + " button"), "Show on the map alone, there too").toHaveText([/^Show on the map/])
      await expect(page.locator("[data-hist-go]:visible"), "and no other row is open beside it").toHaveCount(0)
      await press(page, mine + " [data-hist-show]", "Show on the map", touch)
      for (let i = 0; i < 30 && !framed(await onScreen(page, key)); i++) await j.advance(200)
      await j.advance(200)
      expect(await named(page, key), "the map names the submission").toBe(true)
      const spot = await orbPoint(page, key)
      expect(spot.map, "premise: the place's orb is not under a control").toBe(true)
      if (touch) {
        // on a phone Show on the map is a look, and the press that ends a look does that and nothing else: the next one opens.
        // A LOOK OF NINE SECONDS FIRST, AND THE SECOND PRESS BESIDE THE PLACE, NOT ON ITS PIXEL (L3-R2, the reader's re-read of
        // PR #440: after a look longer than the camera's 7 s the press that ended it took the name with it, and the next
        // press, 2 px above the place, opened the DEFENDER's card; this test pressed twice at once, on the pixel, and could
        // not see it). The press that ends a look leaves the place named for the camera's hold time: the next press is the
        // one the name is for (T7).
        await j.advance(9000)
        expect(await named(page, key), "nine seconds on, the map still names the submission").toBe(true)
        const was = await theRoll(page), at = await orbPoint(page, key)
        await page.touchscreen.tap(at.x, at.y)
        expect(await theRoll(page), "the press that ends the look opens nothing: the same roll, as it was").toEqual(was)
        expect((await state(page)).look, "and the look is over").toBe(false)
        // (that the place is still named is asserted where a frame is drawn after the press: "…a hand on the map lets it
        // go". Here the second press follows at once, as a thumb's does, and what it opens is the claim.)
        const off = await otherHalfPoint(page, key)
        expect(off, "premise: a point within 3 px of the place where the app's own hit test picks its OTHER half (the two are drawn on one pixel here)").not.toBeNull()
        expect(off!.apart, "premise: the two halves are under 8 px apart on this screen").toBeLessThan(8)
        await page.touchscreen.tap(off!.x, off!.y)
      } else await page.mouse.click(spot.x, spot.y)
      // (on a desktop the drawer stays beside the map, as a press on the map leaves it; the player shuts it to read the card)
      if (await page.evaluate(() => !!(window as W).__neural.deckShown)) await press(page, ".ng-explorer-close", "shut the drawer", touch)
      let card: W = null
      for (let i = 0; i < 30; i++) {
        await j.advance(300)
        card = await page.evaluate(() => { const a = (window as W).__neural; return { about: a._landIdx != null && a.nodes[a._landIdx] ? a.nodes[a._landIdx].t : null, deck: a._landQ ? a._landQ.key : null } })
        if (card.deck === key) break
      }
      expect(card, "a press on the place opens its card, and the card asks that deck").toEqual({ about: sub, deck: key })
      await j.openQuestion()
      const q = await j.landQuestion()
      expect(q, "premise: the card asks its question as multiple choice (Auto, a new card)").not.toBeNull()
      const qh = await page.evaluate(() => (window as W).__neural._mc.qhash)
      // (on a phone a card's last answers sit a scroll below the fold: brought into view first, as a player's thumb does)
      await page.locator(`[data-land-mc-opt="${q!.correct}"]`).evaluate((e) => e.scrollIntoView({ block: "nearest", behavior: "instant" }))
      await j.readerLayoutSettled()
      await j.clickByMouse(`[data-land-mc-opt="${q!.correct}"]`, "the right answer, on the submission's own card")
      await expect.poll(() => page.evaluate(({ k, h }) => { const a = (window as W).__neural; return !!(a.srs[k] && a.srs[k][h]) }, { k: key, h: qh }),
        { message: "the answer is a grade in the submission's own deck" }).toBe(true)
    })

    // L3-R1, T2. From the wire (tests/artifacts/_last_rolls_places_count.mjs): no-gi does not draw 12 positions and 33
    // submissions that gi draws; gi draws everything. A roll made in gi can stand on one, and the ruleset can be switched
    // after. The row stays (the record of where a roll went does not obey the ruleset: CLAUDE.md §6.6); it offers nothing
    // the map cannot do. The same row is its own control: drawn again, its two actions are back.
    test(`a place this ruleset does not draw offers no actions, and offers them again when it is drawn (${who})`, async ({ page }) => {
      const j = journey(page)
      await j.boot("/")
      await j.land("Spider Guard Top")
      expect(await page.evaluate(() => { const a = (window as W).__neural, i = a.nodeForKey("Spider Guard|Top"); return [a._giMode, a.nodes[i].cal.avail.gi, a.nodes[i].cal.avail.nogi] }), "premise: a gi roll, on a place no-gi does not draw").toEqual(["gi", true, false])
      await openLastRolls(page, touch)
      const R = row("Spider Guard|Top")
      await press(page, R, "its row, in gi", touch)
      await expect(page.locator("[data-hist-show]:visible, [data-hist-go]:visible"), "control: in gi the row has its two actions").toHaveCount(2)
      await page.evaluate(() => (window as W).__neural.setGiMode("nogi"))
      await expect(page.locator(R), "the row stays: it is where the roll went").toHaveCount(1)
      await expect(page.locator("[data-hist-show], [data-hist-go]"), "no actions on a place this ruleset does not draw").toHaveCount(0)
      await press(page, R, "its row, in no-gi", touch)
      // R5: a row a press does nothing on does not light under the pointer either (and it does once it can be pressed)
      // (the light fades in over 120 ms: read once it has settled)
      const lit = async () => { const b = (await page.locator(R).boundingBox())!; await page.mouse.move(4, 4); await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 3 }); await page.waitForTimeout(300); return page.locator(R).evaluate((e) => getComputedStyle(e).backgroundColor) }
      if (!touch) expect(await lit(), "under the pointer it does not light: there is nothing to press").toBe("rgba(0, 0, 0, 0)")
      await page.keyboard.press("Enter"); await page.keyboard.press("Space")
      await expect(page.locator("[data-hist-show], [data-hist-go]"), "and neither a press nor a key opens any").toHaveCount(0)
      expect(await page.evaluate(() => { const a = (window as W).__neural; return [!!a._session, a._viewMode, !!a.deckShown] }), "nothing opened, the view stayed").toEqual([false, "history", true])
      await page.evaluate(() => (window as W).__neural.setGiMode("gi"))
      await expect(page.locator("[data-hist-show]:visible, [data-hist-go]:visible"), "drawn again: its two actions are back").toHaveCount(2)
      if (!touch) expect(await lit(), "control: a row that can be pressed lights under the pointer").toBe("rgba(255, 255, 255, 0.03)")
    })
  })
}

test.describe("keys on an open row (ruling 2), 1440x900", () => {
  test.use({ viewport: { width: 1440, height: 900 } })
  test("keys on an open row: ↑ ↓ walk the places, Space shows on the map, ⏎ practises here, ← → and A do nothing", async ({ page }) => {
    const { j, keys } = await rolled(page, false)
    await j.knowsPlanMoves()
    await openLastRolls(page, false)
    const last = keys.length - 1
    const openRow = () => page.evaluate(() => { const a = (window as W).__neural; return a._openMini && a._openMini.el.isConnected && a._openMini.el.style.display !== "none" ? a._openMini.rid as string : null })
    await page.keyboard.press("ArrowUp")
    expect(await openRow(), "↑ from the latest opens the place before it").toBe("c" + (last - 1))
    await expect(page.locator("[data-hist-show]:visible")).toHaveCount(1)
    await page.keyboard.press("ArrowDown")
    expect(await openRow(), "↓ walks back to the latest").toBe("c" + last)
    await page.keyboard.press("ArrowUp")
    // ← → and A: nothing
    const before = await page.evaluate(() => { const a = (window as W).__neural; return JSON.stringify([a._openRow, a._viewMode, !!a._session, a.deckShown, JSON.stringify(a.srs), a.cam.cx, a.cam.cy]) })
    for (const k of ["ArrowLeft", "ArrowRight", "a", "b", "c"]) await page.keyboard.press(k)
    expect(await page.evaluate(() => { const a = (window as W).__neural; return JSON.stringify([a._openRow, a._viewMode, !!a._session, a.deckShown, JSON.stringify(a.srs), a.cam.cx, a.cam.cy]) }), "← → do nothing, and A, B, C answer nothing").toBe(before)
    // Space: Show on the map (the drawer stays on a desktop)
    await j.advance(600)
    expect(framed(await onScreen(page, keys[0])), "premise: not framed yet").toBe(false)
    await page.keyboard.press("Space")
    for (let i = 0; i < 30 && !framed(await onScreen(page, keys[0])); i++) await j.advance(200)
    expect(framed(await onScreen(page, keys[0])), "Space shows the open place on the map").toBe(true)
    expect(await page.evaluate(() => !!(window as W).__neural._session), "and Space opened nothing else").toBe(false)
    // ⏎: Practise here
    await page.keyboard.press("Enter")
    await expect(page.locator("[data-practice-page]"), "⏎ opens Master the game").toHaveCount(1)
    await expect.poll(() => page.evaluate(() => { const a = (window as W).__neural, s = a._session; return s && !s.list ? (s.czOpen != null ? s.czOpen : a._masterSeatOf(s, s.keys[s.idx])) : null }), { timeout: 30_000, message: "at the open row's place" }).toBe(keys[0])
  })
})

// L3-R1, the reader of PR #440, finding 2, and the scope of the keys as a whole (`_placeOpen`): the keys act on the open row
// only while it is on the screen. Each key is pressed with the focus on no control (a focused button answers its own key).
test.describe("the keys act on a row the player can see, 1440x900", () => {
  test.use({ viewport: { width: 1440, height: 900 } })
  const noControl = async (page: Page) => {
    const spot = await page.evaluate(() => {
      const p = document.querySelector(".ng-drill")!.getBoundingClientRect()
      for (let y = p.bottom - 8; y > p.top + 6; y -= 9) for (let x = p.left + 3; x < p.right - 3; x += 11) {
        const el = document.elementFromPoint(x, y) as HTMLElement | null
        if (el && el.closest(".ng-drill") && !el.closest("button,summary,a[href],select,input,textarea,[role='button'],[contenteditable],[tabindex],[data-hist],[data-past-roll]")) return { x, y }
      }
      return null
    })
    expect(spot, "premise: a part of the drawer that is no control and no row").not.toBeNull()
    await page.mouse.click(spot!.x, spot!.y)
    expect(await page.evaluate(() => document.activeElement === document.body), "premise: the focus is on no control").toBe(true)
  }
  const looksAndOpens = (page: Page) => page.evaluate(() => { const a = (window as W).__neural; return { shown: a._shown ? (a._shown.i as number) : null, session: !!a._session, view: a.deckShown ? (a._viewMode as string) : null, lease: a._camHoldUntil ?? null } })
  /** a roll through Mount filed under Previous rolls, a new one from Mount running, Last rolls open, the past roll unfolded */
  async function withPastRoll(page: Page) {
    const { j } = await rolled(page, false)
    await j.knowsPlanMoves()
    for (const [t, v] of [["ai-skill", 0.5], ["role", 0], ["max-moves", 0.5]] as const) await j.rig(t, [v])
    await openLastRolls(page, false)
    await press(page, `${row("Mount|Top")} .hplay`, "Roll from Mount, top", false)
    for (let i = 0; i < 40; i++) { await j.advance(500); if (await page.evaluate(() => { const a = (window as W).__neural; return (a._pastRolls || []).length === 1 && (a.rollLog || []).length === 1 && (a.optionIdxs || []).length > 0 })) break }
    await openLastRolls(page, false)
    await press(page, "[data-past-roll]", "the past roll", false)
    return j
  }

  test("a past roll folded away: its open row takes neither Space nor Enter", async ({ page }) => {
    const j = await withPastRoll(page)
    const past = "[data-past-roll] + div"
    await press(page, `${past} ${row("Mount|Top")}`, "the past roll's Mount row", false)
    await expect(page.locator(`${past} [data-hist-show]`), "premise: its two actions are shown").toBeVisible()
    await press(page, "[data-past-roll]", "the past roll, folded again", false)
    await expect(page.locator(`${past} [data-hist-show]`), "premise: folded, nothing of it is on screen").toBeHidden()
    await noControl(page)
    await j.advance(8000)   // any camera lease has run out: a new one is Space's doing
    const was = await looksAndOpens(page)
    await page.keyboard.press("Space")
    expect(await looksAndOpens(page), "Space shows nothing: the row is not on the screen").toEqual(was)
    await page.keyboard.press("Enter")
    await page.waitForTimeout(300)
    expect(await looksAndOpens(page), "and Enter opens nothing").toEqual(was)
  })

  test("keys never reach a row on the view you left", async ({ page }) => {
    const { j } = await rolled(page, false)
    await j.knowsPlanMoves()
    await openLastRolls(page, false)
    await press(page, row("Mount|Top"), "the row of Mount, top", false)
    await expect(page.locator("[data-hist-show]:visible"), "premise: a row is open in Last rolls").toHaveCount(1)
    await press(page, ".ng-drawer-brand", "‹ Last rolls, back to the drawer's list", false)
    await expect(page.locator("[data-drawer-explore]"), "premise: the drawer shows its list").toBeVisible()
    await noControl(page)
    await j.advance(8000)
    const was = await looksAndOpens(page)
    expect(was.view, "premise: the list, not Last rolls").toBe("explore")
    await page.keyboard.press("Space")
    expect(await looksAndOpens(page), "Space shows nothing from the view you left").toEqual(was)
    await page.keyboard.press("Enter")
    await page.waitForTimeout(300)
    expect(await looksAndOpens(page), "and Enter opens nothing").toEqual(was)
  })

  // R6, for a state of a past roll: its roll is folded when Last rolls is drawn, so it is drawn unfolded for the row to open
  test("back from Practise here to a past roll's state: its roll is unfolded and the row open again", async ({ page }) => {
    await withPastRoll(page)
    const past = "[data-past-roll] + div"
    await press(page, `${past} ${row("Mount|Top")}`, "the past roll's Mount row", false)
    await press(page, `${past} [data-hist-go]`, "Practise here", false)
    await expect(page.locator("[data-practice-page]")).toHaveCount(1)
    await expect(page.locator("[data-mini-q]:visible")).toHaveCount(1, { timeout: 30_000 })
    await press(page, ".ng-drawer-brand", "‹ Master the game", false)
    await expect(page.locator(`${past} ${row("Mount|Top")}`), "the past roll is unfolded again").toBeVisible()
    await expect(page.locator(`${past} [data-hist-show]`), "and the row it was pressed on is open, with its actions").toBeVisible()
    await expect(page.locator(`${past} [data-hist-go]`)).toBeInViewport({ ratio: 1 })
    await expect(page.locator("[data-hist-current] + .ng-hact [data-hist-show]"), "and no other row opened with it").toBeHidden()
  })

  // THE WAY BACK REMEMBERS A ROW BY WHAT IT IS, NOT WHERE IT WAS (L3-R2, the reader's re-read of PR #440). It held a row's
  // id alone, cleared only by the next draw of Last rolls, whenever that was, and the id of a row of the roll in play is
  // its index: "Practise here, Esc, a move, the logo, Last rolls: the row of the earlier press was open" (1 of 1), and
  // after a new roll it would open a row never pressed. It is forgotten when the drawer shuts, and it opens a row only if
  // that row of that roll still holds that key.
  test("the way back is forgotten when the drawer shuts: Practise here, Esc, a move, Last rolls: no row is open", async ({ page }) => {
    const { j } = await rolled(page, false)
    await j.knowsPlanMoves()
    await openLastRolls(page, false)
    await press(page, row("Mount|Top"), "the row of Mount, top", false)
    await press(page, "[data-hist-go]", "Practise here", false)
    await expect(page.locator("[data-mini-q]:visible"), "premise: Master the game is open at the place").toHaveCount(1, { timeout: 30_000 })
    for (let i = 0; i < 3 && (await page.evaluate(() => !!(window as W).__neural.deckShown)); i++) await page.keyboard.press("Escape")
    expect(await page.evaluate(() => { const a = (window as W).__neural; return { drawer: !!a.deckShown, paused: !!a.paused } }), "premise: Esc shut the drawer, and the roll runs").toEqual({ drawer: false, paused: false })
    const t = await page.evaluate(() => { const a = (window as W).__neural; for (const i of a.optionIdxs || []) if (a.nodes[i].ty === "transitions") return a.nodes[i].t as string; return a.nodes[(a.optionIdxs || [])[0]].t as string })
    await j.rig("resolve", [0.01]); await j.rig("outcome", [0.01])
    await j.pick(t)
    await j.nextHand()
    await openLastRolls(page, false)
    await expect(page.locator(row("Mount|Top")).first(), "premise: the row pressed before is on the list, the same row of the same roll").toBeVisible()
    await expect(page.locator(".ng-hact:visible"), "no row is open: the way back was for the drawer that shut").toHaveCount(0)
  })

  test("the way back opens a row only while it is that row of that roll: after a new roll from the same place, none is opened", async ({ page }) => {
    const { j } = await rolled(page, false)
    await j.knowsPlanMoves()
    for (const [t, v] of [["ai-skill", 0.5], ["role", 0], ["max-moves", 0.5]] as const) await j.rig(t, [v])
    await openLastRolls(page, false)
    await press(page, row("Mount|Top"), "the row of Mount, top: the first row of this roll", false)
    await press(page, "[data-hist-go]", "Practise here", false)
    await expect(page.locator("[data-mini-q]:visible"), "premise: Master the game is open at the place").toHaveCount(1, { timeout: 30_000 })
    // A NEW ROLL FROM THE SAME PLACE, THE DRAWER STILL OPEN (by the app's own function: with the drawer open no control of
    // the player's starts one, but a roll running beside an open drawer ends and the next begins). The old roll is filed;
    // the new roll's first row has the same index AND the same key as the row that was pressed, and is another roll's.
    // A new roll ends the session (`rollFromPosition`), so the drawer is back on Last rolls by itself.
    await page.evaluate(() => { const a = (window as W).__neural; a.rollFromPosition(a.nodeForKey("Mount|Top"), false, "top") })
    const now = () => page.evaluate(() => { const a = (window as W).__neural; return { filed: (a._pastRolls || []).length, roll: (a.rollLog || []).map((h: W) => h.key as string), drawer: !!a.deckShown } })
    for (let i = 0; i < 40; i++) { await j.advance(500); const n = await now(); if (n.filed === 1 && n.roll.length >= 1) break }
    const n = await now()
    expect({ filed: n.filed, first: n.roll[0], drawer: n.drawer }, "premise: the old roll is filed, a new one stands on Mount, top, the drawer still open").toEqual({ filed: 1, first: "Mount|Top", drawer: true })
    await expect(page.locator(".ng-drawer-brand"), "premise: the new roll ended the session, and the drawer is back on Last rolls").toHaveText("‹ Last rolls")
    await expect(page.locator(`[data-hist-current]${row(n.roll[n.roll.length - 1])}`), "premise: the new roll's rows are on the list").toBeVisible()
    await expect(page.locator(".ng-hact:visible"), "the new roll's first row is not opened: the same index and the same key, but a row never pressed").toHaveCount(0)
  })

  // the reader of PR #440 could not produce this one (the lines are dev's own, kept): the latest row, left open, is the
  // NEW latest row after the roll lands again
  test("the latest row stays open across a landing", async ({ page }) => {
    const { j } = await rolled(page, false)
    await openLastRolls(page, false)
    await press(page, "[data-hist-current]", "the latest row", false)
    await expect(page.locator("[data-hist-current] + .ng-hact [data-hist-show]"), "premise: the latest row is open").toBeVisible()
    const latest = await page.locator("[data-hist-current]").getAttribute("data-hist")
    await press(page, ".ng-explorer-close", "shut the drawer", false)
    // moves until the roll stands on another place (a move that keeps the position lands where it stood: no new row)
    const before = await page.evaluate(() => (window as W).__neural.rollLog.length)
    for (let k = 0; k < 6 && (await page.evaluate(() => (window as W).__neural.rollLog.length)) === before; k++) {
      const t = await page.evaluate((k) => { const a = (window as W).__neural, ts = (a.optionIdxs || []).filter((i: number) => a.nodes[i].ty === "transitions"); return a.nodes[ts[k % Math.max(1, ts.length)] ?? a.optionIdxs[0]].t as string }, k)
      await j.rig("resolve", [0.01]); await j.rig("outcome", [0.01])
      await j.pick(t)
      await j.nextHand()
    }
    const n = await page.evaluate(() => (window as W).__neural.rollLog.length)
    expect(n, "premise: the roll landed on a new place").toBeGreaterThan(before)
    await openLastRolls(page, false)
    expect(await page.locator("[data-hist]").count(), "premise: the roll landed again").toBe(n)
    expect(await page.locator("[data-hist-current]").getAttribute("data-hist"), "premise: on another place").not.toBe(latest)
    await expect(page.locator("[data-hist-current] + .ng-hact [data-hist-show]"), "the new latest row is the open one").toBeVisible()
    await expect(page.locator("[data-hist-show]:visible"), "and only that one").toHaveCount(1)
  })
})

// R10 (the reader's measure: the last row of 19 at 390x631 opened with 12 of its actions' 44 px showing, the rest under the
// panel's foot). A row that opens with its actions cut is brought whole into view by the smallest scroll; a row whose
// actions already fit does not move. The roll is LONG, and written into the log for that (fourteen real places; the rows,
// their press and the scroll are the app's own): a roll of fourteen landings is two minutes of play nobody's claim here needs.
test.describe("a row opened near the end of a long list, 390x631", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 631 } })
  test("the last row's two actions are brought whole into view; a middle row does not move", async ({ page }) => {
    const j = journey(page)
    await j.boot("/")
    await j.land("Mount Top")
    await page.evaluate(() => {
      const a = (window as W).__neural
      const ps = a.nodes.filter((n: W) => n.ty === "positions" && n.role !== "bottom" && a.rsAllowsIdx(n.idx)).slice(0, 14)
      a.rollLog = ps.map((n: W, i: number) => ({ key: a.posFamily(n.t) + "|Top", name: a.posFamily(n.t), role: "Top", idx: n.idx, actor: i ? "you" : "start", val: null, intend: null, via: null, from: null }))
    })
    await openLastRolls(page, true)
    const geo = (sel: string) => page.evaluate((q) => {
      const a = (window as W).__neural, l = a.drillListRef.current as HTMLElement, lr = l.getBoundingClientRect()
      const out = { top: l.scrollTop, list: [lr.top, lr.bottom], rows: [...document.querySelectorAll("[data-hist]")].length, acts: [] as W[] }
      for (const b of document.querySelectorAll(q + " + .ng-hact button")) {
        const r = b.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, t = document.elementFromPoint(x, y)
        out.acts.push({ whole: r.top >= lr.top - 0.5 && r.bottom <= lr.bottom + 0.5, hit: !!t && (t === b || b.contains(t)), h: Math.round(r.height) })
      }
      return out
    }, sel)
    const keys = await page.evaluate(() => (window as W).__neural.rollLog.map((h: W) => h.key as string))
    expect(keys.length, "premise: a long roll").toBe(14)
    // a middle row, with room under it: pressed where it stands, nothing moves
    const mid = row(keys[3])
    const before = await geo(mid)
    expect(before.rows, "premise: fourteen rows, more than the list shows at once").toBe(14)
    const midTop = await page.locator(mid).evaluate((e) => e.getBoundingClientRect().top)
    await press(page, mid, "a middle row", true)
    await page.waitForTimeout(250)
    const afterMid = await geo(mid)
    expect(afterMid.acts, "premise: its two actions are whole and under the finger").toEqual([{ whole: true, hit: true, h: 44 }, { whole: true, hit: true, h: 44 }])
    expect([afterMid.top - before.top, (await page.locator(mid).evaluate((e) => e.getBoundingClientRect().top)) - midTop], "a row whose actions fit does not move: 0 px, the list and the row").toEqual([0, 0])
    // a row whose bottom is at the list's bottom edge (the player has scrolled it there): its actions would open under the
    // panel's foot, all of them
    await press(page, mid, "the middle row again, to close it", true)
    // (the first row that starts below the list's foot with the list unscrolled, then scrolled so its own foot is at the list's)
    const lowKey = await page.evaluate(() => {
      const l = (window as W).__neural.drillListRef.current as HTMLElement; l.scrollTop = 0
      const lb = l.getBoundingClientRect().bottom, r = [...document.querySelectorAll("[data-hist]")].find((e) => e.getBoundingClientRect().bottom > lb + 4)!
      l.scrollTop += r.getBoundingClientRect().bottom - lb
      return r.getAttribute("data-hist") as string
    })
    const low = row(lowKey)
    expect(lowKey, "premise: a row other than the last").not.toBe(keys[13])
    await page.waitForTimeout(100)
    const edge = await page.evaluate((q) => { const l = (window as W).__neural.drillListRef.current as HTMLElement, r = document.querySelector(q)!.getBoundingClientRect(); return { room: l.getBoundingClientRect().bottom - r.bottom, top: l.scrollTop } }, low)
    expect(Math.abs(edge.room), "premise: the row's foot is at the list's foot, no room under it").toBeLessThan(2)
    // (pressed at a point of the row that is in view: its middle is)
    await press(page, low, "a row at the list's foot", true)
    await page.waitForTimeout(250)
    const afterLow = await geo(low)
    expect(afterLow.acts, "a row opened at the list's foot: its two actions are whole in the list and under the finger").toEqual([{ whole: true, hit: true, h: 44 }, { whole: true, hit: true, h: 44 }])
    // (the two actions' block is 58 px, the list keeps 12 px under it, and the block is measured while it fades in from 8 px lower)
    expect(afterLow.top - edge.top, "the list scrolled just enough to show them: the actions' own height, no more").toBeGreaterThanOrEqual(46)
    expect(afterLow.top - edge.top, "and no more").toBeLessThanOrEqual(80)
    await expect(page.locator(low), "and the row itself is still in view").toBeInViewport({ ratio: 1 })
    // the last row, at the list's very end
    const last = row(keys[13])
    await page.evaluate(() => { const l = (window as W).__neural.drillListRef.current; l.scrollTop = l.scrollHeight })
    await page.waitForTimeout(100)
    await press(page, last, "the last row", true)
    await page.waitForTimeout(250)
    expect((await geo(last)).acts, "the last row's two actions are whole in the list and under the finger").toEqual([{ whole: true, hit: true, h: 44 }, { whole: true, hit: true, h: 44 }])
    await expect(page.locator(last), "and the last row itself is in view").toBeInViewport({ ratio: 1 })
  })
})

test.describe("on a phone, Show on the map is a look: the hold and every way it ends (ruling 1), 390x631", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 631 } })

  /** the roll live, the drawer opened on Last rolls (which stops it), Mount's row open, Show on the map pressed */
  async function looking(page: Page) {
    const r = await rolled(page, true)
    await openLastRolls(page, true)
    expect(await state(page), "premise: the drawer stopped the game").toMatchObject({ paused: true, pane: true, drawer: true })
    await press(page, row("Mount|Top"), "the row of Mount, top", true)
    await press(page, "[data-hist-show]", "Show on the map", true)
    expect(await state(page), "the drawer is shut and the clock is held: a look, not a return to play").toMatchObject({ drawer: false, paused: true, look: true, pane: false })
    expect((await beats(page, "look_held")).length, "the hold says it was taken").toBe(1)
    expect((await beats(page, "pane_resumed")).length, "and the drawer's shutting resumed nothing").toBe(0)
    return r
  }

  test("on a phone the drawer shuts and the clock is held; a hand on the map lets it go", async ({ page }) => {
    const { j } = await looking(page)
    await j.advance(9000)
    expect(await state(page), "nine seconds on, the clock is still held").toMatchObject({ paused: true, look: true })
    expect(await named(page, "Mount|Top"), "and the map still names the place: the name lasts as long as the look").toBe(true)
    const p = await emptyMapPoint(page)
    expect(p, "premise: a point of the map with nothing on it").not.toBeNull()
    const was = await theRoll(page)
    expect(was.card, "premise: the roll's landing card is on the board").not.toBeNull()
    await page.touchscreen.tap(p!.x, p!.y)
    expect((await state(page)).paused, "after a press on the map the roll runs again").toBe(false)
    expect((await beats(page, "look_ended")).map((b: W) => b.by), "and the hold says how it ended").toEqual(["map"])
    expect((await state(page)).look, "the claim is over").toBe(false)
    // (until L3-R1 this press went on to the map as a tap: on the background it declined the question or went to free roam.
    // BGCLOSE, v1.294.0: on the background it would now close the whole page; `theRoll` reads the card, free roam and the
    // address, so that is what "the roll that was held" rules out. Its `declined` field read `_landDismissed`, a record
    // that is gone with the ladder's first step and would have read false for ever: taken out, not left to pass.)
    expect(await theRoll(page), "the roll that runs again is the roll that was held: its states, its hand, its card, its address, nothing filed, no free roam").toEqual(was)
    // L3-R2 (the reader's re-read of PR #440): THE PRESS THAT ENDS A LOOK LEAVES THE PLACE NAMED FOR THE CAMERA'S HOLD TIME,
    // however long the look was, so the press after it is the one the name is for (T7); then the name goes. Until then this
    // step said the name was gone 0.8 s after the press (the look over, the first lease spent by the nine seconds).
    await j.advance(800)
    expect(await named(page, "Mount|Top"), "the place is still named after the press that ended the look: the next press is the one the name is for").toBe(true)
    expect((await state(page)).paused, "and the roll runs under it").toBe(false)
    await j.advance(7000)
    expect(await named(page, "Mount|Top"), "and the name is gone again after the camera's hold time").toBe(false)
  })

  // T7 ACTS ONLY WHILE A PLACE IS NAMED (L3-R2; the reader's mutant N2 stayed green, 7 of 7: with nothing named, a press that
  // picks one half of a close pair took the other). A pan ends the look and, being the hand that takes the camera, the name
  // with it; the zoom stays where the look put it, so Mount's two orbs are still drawn on one pixel. A press where the
  // app's own hit test picks the BOTTOM orb then stages Mount on the bottom: the half the finger picked, not the half a
  // name would have chosen.
  test("on a phone, with no place named, a press on a pair drawn on one pixel takes the half it picks", async ({ page }) => {
    const { j } = await looking(page)
    for (let i = 0; i < 30 && !framed(await onScreen(page, "Mount|Top")); i++) await j.advance(200)
    const p = await emptyMapPoint(page)
    expect(p, "premise: a point of the map with nothing on it").not.toBeNull()
    await page.mouse.move(p!.x, p!.y); await page.mouse.down(); await page.mouse.move(p!.x + 14, p!.y + 6, { steps: 4 }); await page.mouse.up()
    await j.advance(200)
    expect(await state(page), "premise: the pan ended the look, and the roll runs").toMatchObject({ paused: false, look: false })
    expect(await named(page, "Mount|Top"), "premise: the pan took the camera, and the name went with it: nothing is named").toBe(false)
    expect(await page.evaluate(() => (window as W).__neural._shownNode()), "nothing is shown").toBeNull()
    const off = await otherHalfPoint(page, "Mount|Top")
    expect(off, "premise: a point within 3 px of Mount's top orb where the app's own hit test picks its bottom orb").not.toBeNull()
    expect(off!.apart, "premise: the two orbs are under 8 px apart on this screen (the distance the named press goes by)").toBeLessThan(8)
    const picked = await page.evaluate((i) => (window as W).__neural.nodes[i].role as string, off!.picks)
    expect(picked, "premise: the half the hit test picks there is the bottom one").toBe("bottom")
    await page.touchscreen.tap(off!.x, off!.y)
    await j.advance(400)
    expect(await page.evaluate(() => { const a = (window as W).__neural; return { staged: a._staged != null && a.nodes[a._staged] ? (a.nodes[a._staged].t as string) : null, side: a.playerRole as string } }),
      "with nothing named, the press takes the half it picks: Mount, on the bottom").toEqual({ staged: "Mount Top", side: "bottom" })
  })

  // L3-R1, the reader of PR #440, finding 1: 8 of 9 taps in the visible map during a hold ended the live roll (seven staged
  // a new roll or opened a technique at the node under the finger, the shown place included; one went to free roam). The
  // press that ends a look does that and nothing else. Two taps, each ON A NODE: the shown place itself, and another node.
  for (const where of ["the shown place itself", "another place on the map"]) {
    test(`on a phone a press on ${where} during the hold ends the look and nothing else: the same roll runs again`, async ({ page }) => {
      const { j } = await looking(page)
      for (let i = 0; i < 30 && !framed(await onScreen(page, "Mount|Top")); i++) await j.advance(200)
      const p = where.startsWith("the shown") ? await orbPoint(page, "Mount|Top").then((o) => (o.map ? { x: o.x, y: o.y, node: "Mount Top" } : null)) : await nodePoint(page, "Mount|Top")
      expect(p, "premise: a point of the visible map with a node under it and nothing over it").not.toBeNull()
      const was = await theRoll(page), stored = await record(page)
      expect(was.card, "premise: the roll's landing card is on the board").not.toBeNull()
      await page.touchscreen.tap(p!.x, p!.y)
      await j.advance(400)
      expect(await state(page), `the look is over and the roll runs (the press was on ${p!.node})`).toMatchObject({ paused: false, look: false, drawer: false })
      expect(await theRoll(page), "the same roll runs again: nothing staged, nothing opened, nothing filed, its card as it was").toEqual(was)
      expect(changed(stored, await record(page)), "and nothing stored").toEqual([])
      expect((await beats(page, "look_ended")).map((b: W) => b.by)).toEqual(["map"])
      // the NEXT press is an ordinary press on the map again: on a node it opens that place
      await page.touchscreen.tap(p!.x, p!.y)
      await j.advance(400)
      expect((await theRoll(page)).journey, "the press after it is the map's own again: the place opens").toBeGreaterThan(was.journey)
    })
  }

  test("on a phone a pan begun on the map during the hold still pans, and the roll runs again", async ({ page }) => {
    const { j } = await looking(page)
    for (let i = 0; i < 30 && !framed(await onScreen(page, "Mount|Top")); i++) await j.advance(200)
    const p = await emptyMapPoint(page)
    const was = await theRoll(page), cam = await page.evaluate(() => { const a = (window as W).__neural; return [a.cam.cx, a.cam.cy] })
    await page.mouse.move(p!.x, p!.y); await page.mouse.down(); await page.mouse.move(p!.x + 40, p!.y + 20, { steps: 5 }); await page.mouse.up()
    expect(await state(page), "the look is over and the roll runs").toMatchObject({ paused: false, look: false })
    expect(await theRoll(page), "the same roll").toEqual(was)
    const now = await page.evaluate(() => { const a = (window as W).__neural; return [a.cam.cx, a.cam.cy] })
    expect(Math.hypot(now[0] - cam[0], now[1] - cam[1]), "and the map moved under the finger").toBeGreaterThan(1)
  })

  test("on a phone a wheel on the map lets it go too", async ({ page }) => {
    await looking(page)
    const p = await emptyMapPoint(page)
    await page.mouse.move(p!.x, p!.y)
    await page.mouse.wheel(0, 120)
    await expect.poll(async () => (await state(page)).paused, { message: "after a wheel on the map the roll runs again" }).toBe(false)
    expect((await beats(page, "look_ended")).map((b: W) => b.by)).toEqual(["map"])
  })

  test("on a phone the drawer opening again takes the pause back", async ({ page }) => {
    await looking(page)
    await press(page, ".ng-logo", "open the drawer again", true)
    expect(await state(page), "the pause is the drawer's again").toMatchObject({ drawer: true, paused: true, look: false, pane: true })
    expect((await beats(page, "look_ended")).map((b: W) => b.by)).toEqual(["drawer"])
    await press(page, ".ng-explorer-close", "shut the drawer", true)
    expect(await state(page), "shutting the drawer resumes the roll, as it always does").toMatchObject({ drawer: false, paused: false, look: false, pane: false })
    expect((await beats(page, "pane_resumed")).length).toBe(1)
  })

  test("on a phone a move played from the hand ends the claim", async ({ page }) => {
    const { j } = await looking(page)
    const t = await page.evaluate(() => { const a = (window as W).__neural; return a.nodes[(a.optionIdxs || [])[0]].t as string })
    await j.rig("resolve", [0.01]); await j.rig("outcome", [0.01])
    await j.pick(t)
    expect((await state(page)).paused, "the move resumed the roll").toBe(false)
    expect((await state(page)).look, "the look's claim is over").toBe(false)
    expect((await beats(page, "look_ended")).map((b: W) => b.by)).toEqual(["clock"])
  })

  test("on a phone a staged place is not started by the next hand on the map", async ({ page }) => {
    await looking(page)
    // a place staged while the look holds (a link in an article, the landing card: neither is a press on the map), by the
    // app's own function: land there, deal the hand, hold the clock
    await page.evaluate(() => { const a = (window as W).__neural; a.stageRollAt(a.nodeForKey("Side Control|Top")) })
    expect((await state(page)).paused, "premise: staged, its clock held").toBe(true)
    const p = await emptyMapPoint(page)
    await page.mouse.move(p!.x, p!.y); await page.mouse.down(); await page.mouse.move(p!.x + 30, p!.y + 12, { steps: 4 }); await page.mouse.up()
    expect((await state(page)).paused, "the staged board's clock is still held after a pan of the map").toBe(true)
    expect((await beats(page, "look_ended")).map((b: W) => b.by), "the claim ended with the new journey, and said so").toEqual(["roll"])
    expect((await state(page)).look).toBe(false)
  })

  test("on a phone a board that was already still is not the look's", async ({ page }) => {
    const j = journey(page)
    await j.boot("/")
    await j.land("Mount Top")
    await page.evaluate(() => { const a = (window as W).__neural; a.stageRollAt(a.nodeForKey("Side Control|Top")) })
    expect((await state(page)).paused, "premise: a staged board, its clock held before the drawer opens").toBe(true)
    await openLastRolls(page, true)
    expect((await state(page)).pane, "premise: the drawer did not stop it").toBe(false)
    await press(page, "[data-hist]", "the staged place's row", true)
    await press(page, "[data-hist-show]", "Show on the map", true)
    expect(await state(page), "the drawer is shut, the board as still as it was").toMatchObject({ drawer: false, paused: true })
    const p = await emptyMapPoint(page)
    await page.mouse.move(p!.x, p!.y); await page.mouse.down(); await page.mouse.move(p!.x + 30, p!.y + 12, { steps: 4 }); await page.mouse.up()
    expect((await state(page)).paused, "a pan of the map does not start a clock the look never held").toBe(true)
    expect((await beats(page, "look_held")).length, "the look took nothing").toBe(0)
    expect((await state(page)).look).toBe(false)
  })
})
