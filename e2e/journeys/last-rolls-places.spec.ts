import { expect, test, type Page } from "@playwright/test"
import { journey } from "../dsl"

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
 * WHAT IS PINNED, AND THE MUTANT OF EACH (built into the served bundle, each alone, a clean run before and after; the
 * table with the run's times is in docs/Changelog-Archive.md, v1.293.0):
 *   M1  the inline deck back under a row (`_histRow` appends a `_miniDeck`)       → "a row is a place…" at "no card in the row"
 *   M2  the sub line back to the card count                                      → the same test, at "the sub line is the side
 *       and what you remember there" (and "nothing remembered: the side alone")
 *   M3  the sub line's number the hand's size, not the gold (`_placeGold`)        → "the two lists say the same…" is GREEN under
 *       it (one function feeds both lists, so they agree by construction: that is the claim); it is red at "a row is a
 *       place…", "the number is the moves the map paints gold there" (the seeded count), and in master-list.spec.ts
 *   M4  "Practise here" opens the list's first place (`_masterStart`)             → "Practise here opens that place…" at "the
 *       place asked for is the one open"
 *   M5  "Practise here" sends surface "place"                                    → the same test, at "one opening, its surface lastrolls"
 *   M6  "Show on the map" frames where the roll stands (`currentPos`)             → "Show on the map frames the place…" at
 *       "the place is framed in the visible map"
 *   M7  a row that is not a position offers "Practise here"                       → "a submission a roll passed through…"
 *   M8  THE HOLD NEVER LETS GO (`_lookEnd` does nothing)                          → "on a phone…a hand on the map lets it go" at
 *       "after a press on the map the roll runs again"
 *   M9  the map's press is not a lifter (pointerdown)                            → the same step
 *   M10 the wheel is not a lifter                                                → "…a wheel on the map lets it go too"
 *   M11 the drawer opening does not take the pause back                           → "…the drawer opening again takes the pause back"
 *       at "shutting the drawer resumes the roll, as it always does"
 *   M12 a resume by another hand leaves the claim standing (`setPaused`)          → "…a move played from the hand ends the claim"
 *       at "the look's claim is over"
 *   M13 a new journey leaves the claim standing (`clearEngagement`)               → "…a staged place is not started by the next
 *       hand on the map" at "the staged board's clock is still held"
 *   M14 the hold taken even when the drawer was not what stopped the game         → "…a board that was already still is not the look's"
 *   M15 on a phone the drawer shut resumes the roll (no hold at all)              → "on a phone…" at "the clock is held: a look, not a return to play"
 *   M16 ⏎ and Space swapped                                                      → "keys on an open row…"
 *   M17 ← → page something again (a handle registered for the row)               → the same test, at "← → do nothing"
 * NOT COVERED HERE, and what to check by hand: a pinch (two real fingers; Playwright sends one), whose first finger is the
 * pointerdown M9 pins; the camera's 7 s lease running out after the look (camera canon, share-camera.spec.ts); no-gi (the
 * row's gold is `_placeGold`, which reads the ruleset's own hand as the map does).
 * The harness serves `{}` for dossiers: no claim here reads a film or an article section.
 */

type W = any

async function press(page: Page, selector: string, what: string, touch: boolean) {
  for (let i = 0; ; i++) {
    try { await page.locator(selector).first().scrollIntoViewIfNeeded({ timeout: 3_000 }); break }
    catch (e) { if (i >= 4) throw e; await page.waitForTimeout(250) }
  }
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
/** the fields of the record that differ, by name: [] when the two are the same record */
const changed = (a: Record<string, unknown>, b: Record<string, unknown>) =>
  [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k])).sort()
/** where a node is on screen, through draw()'s own transform, and the visible map's rect */
const onScreen = (page: Page, key: string) => page.evaluate((k) => {
  const a = (window as W).__neural, n = a.nodes[a.nodeForKey(k)], p = a.pairMid(n), W_ = a.W, H = a.H, sc = W_ / a.cam.vw
  const R = a._viewRect()
  return { x: W_ / 2 + (p.x - a.cam.cx) * sc, y: H / 2 + (p.y - a.cam.cy) * sc, rect: { left: R.left, top: R.top, right: R.left + R.width, bottom: R.top + R.height } }
}, key)
/** does the map NAME this place: the label the last frame published for a pair or for the pointer's node (`draw()`'s own
 *  output, `_lastPairLabel` / `_lastHoverLabel`), on the place's node or its pair's other half */
const named = (page: Page, key: string) => page.evaluate((k) => {
  const a = (window as W).__neural, i = a.nodeForKey(k), n = a.nodes[i]
  return [a._lastPairLabel, a._lastHoverLabel].some((l: W) => !!l && (l.idx === i || l.idx === n.pi) && String(l.main || "").includes(k.split("|")[0]))
}, key)
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
      await press(page, row(keys[0]), "the row of Mount, top", touch)
      await press(page, "[data-hist-go]", "Practise here", touch)
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
    await page.touchscreen.tap(p!.x, p!.y)
    expect((await state(page)).paused, "after a press on the map the roll runs again").toBe(false)
    expect((await beats(page, "look_ended")).map((b: W) => b.by), "and the hold says how it ended").toEqual(["map"])
    expect((await state(page)).look, "the claim is over").toBe(false)
    await j.advance(800)
    expect(await named(page, "Mount|Top"), "and the place's name on the map goes with the look").toBe(false)
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
