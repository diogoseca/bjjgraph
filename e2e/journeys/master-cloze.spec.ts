import { expect, test, type Page } from "@playwright/test"
import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"
import { journey } from "../dsl"

/** THE CLOZE (L2, v1.292.0): a position's moves, asked in Master the game's list. The owner's U198 (a cloze, Show then Hide),
 * U200 (six techniques, six points), U201 b (Bars, and where a move takes you once revealed) and U204 a (a quiet second
 * line: an arrow, the place, the role in words; a submission its triangle and its name). The drawings are the spec
 * (design/master-r2 cloze v1, design/master-r4/spec.md); the orchestrator's rulings are in master-cloze.src.js's header.
 * The BUILT page, on real content: a player who has been to five positions and owes six moves at each (rows of a week
 * ago in the `moves` record, by the map's own ordinals), pressed the way a player presses: a touch tap at 390x631, the
 * mouse at 1440x900, at measured points.
 *   · a cloze of six writes six rows and adds six to the day; Hide writes nothing; Show, Hide, Show keeps the taps;
 *   · Undo takes the confirm back, byte for byte (the record, the undelivered-answers journal, the day's count);
 *   · the second line is absent before Show and present after: the place and the role, checked on five positions against
 *     the AUTHORED tables (content/Transitions/*.json, read here: not the wire the page reads); a row that leads to a
 *     finish is two lines high with its triangle and no role; what gives way, on the longest real rows (spec.md);
 *     reduced motion; the accessible name; the "Had it?" toggle and the name are different targets;
 *   · the map beside an open cloze (1440): the hand face down, no name, hover label or gold mark on a hidden move, read
 *     from the DOM and from what the frame drew (`_lastOptLabels`, `_lastHoverLabel`, `_lastMapMarks`); after Show, as today.
 * MUTANTS (built into the bundle, run against this file under the lock; each red on the named step): in the PR body and
 *   below once run. The writer's own arithmetic is tests/master_cloze.test.mjs.
 * NOT COVERED here: a player on "Multiple choice" (no cloze until L4: tests/practice_queue.test.mjs pins the plan), the
 *   camera at Show and a row lighting its way (L2b), another tab or device taking a confirm in before its Undo.
 */

type W = any
const ROOT = resolve(__dirname, "../..")
const PLACES = ["Mount|Bottom", "Side Control|Bottom", "Closed Guard|Bottom", "Half Guard|Bottom", "Back Control|Top"]
const DAY = 20774
const dot = (seat: string) => seat.replace("|", " · ")

async function press(page: Page, selector: string, what: string, touch: boolean, scroll = true) {
  if (scroll) await page.locator(selector).first().scrollIntoViewIfNeeded()
  const at = await page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement | null
    if (!el) return { ok: false, why: "no element matches", x: 0, y: 0 }
    const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2
    if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return { ok: false, why: "off screen", x, y }
    const top = document.elementFromPoint(x, y)
    return { ok: !!top && (top === el || el.contains(top)), why: top ? "<" + top.tagName.toLowerCase() + " " + (top as HTMLElement).className + ">" : "nothing", x, y }
  }, selector)
  expect(at.ok, `${what}: the point under the press is the control (${at.why})`).toBe(true)
  if (touch) await page.touchscreen.tap(at.x, at.y)
  else await page.mouse.click(at.x, at.y)
}

/** the seeded player. `at`: a roll staged at that seat (the map's hand is then that position's) */
async function setup(page: Page, opts: { at?: string; reduced?: boolean } = {}) {
  await page.addInitScript((d) => { (window as W).__NG_EPOCH_DAY__ = d }, DAY)
  if (opts.reduced) await page.emulateMedia({ reducedMotion: "reduce" })
  const j = journey(page, { answerMode: "classic" })
  await j.boot("/", { initialState: { v: 2, explored: PLACES } })
  await expect.poll(() => page.evaluate(() => {
    const a = (window as W).__neural
    return !!(a && a.nodes && a.nodes.length && a.flashcards && a.flashcards.decks && Object.keys(a.flashcards.decks).length && a.curriculum)
  }), { timeout: 60_000, message: "graph, deck manifest and curriculum in" }).toBe(true)
  if (opts.at) await j.advance(12000)   // the root intro finishes before a seat is staged, as landing-card.spec does
  const hands = await page.evaluate(({ places, at }: W) => {
    const a = (window as W).__neural, d = a._epochDay(), out: Record<string, string[]> = {}
    a.moves = a.moves || {}
    for (const k of places) {
      const i = a.nodeForKey(k), role = k.endsWith("|Bottom") ? "bottom" : "top", o = a._ordById.get(a.siteIdOf(a.nodes[i].id)), dl = a._dealtOrds(i, role) || []
      const row = (a.moves[o + "/" + role] = a.moves[o + "/" + role] || {})
      dl.slice(0, 6).forEach((m: string, n: number) => { row[m] = [d - 1 - n, 7, d - 8 - n, 1, 7, 7] })
      out[k] = dl
    }
    a._movesRev = (a._movesRev || 0) + 1
    if (at) a.rollFromPosition(a.nodeForKey(at), true, at.endsWith("|Bottom") ? "bottom" : "top")
    else a.setPaused(true)
    return out
  }, { places: PLACES, at: opts.at || null })
  for (const k of PLACES) expect(hands[k].length, `premise: ${k} deals at least six moves`).toBeGreaterThanOrEqual(6)
  return { j, hands }
}
async function openMaster(page: Page, touch: boolean) {
  await press(page, ".ng-logo", "open the drawer", touch, false)
  await press(page, '[data-explore-stats] [data-b="due"]', "the Master the game row", touch)
  await expect(page.locator("[data-practice-page]")).toHaveCount(1)
  await expect.poll(() => page.evaluate(() => (window as W).__neural._session?.plan?.order || null), { timeout: 30_000, message: "the worth plan lands" }).toBe("worth")
  await expect(page.locator('[data-master-row][data-master-group="plan"]').first(), "the rows are painted").toBeVisible({ timeout: 30_000 })
}
async function openCloze(page: Page, seat: string, touch: boolean) {
  await press(page, `[data-master-row="${seat}"]`, "the place's row", touch)
  await expect(page.locator(`[data-cloze="${seat}"]`), "its cloze is open").toBeVisible()
}
/** what a player owns that a cloze can touch: the moves record, the undelivered-answers journal's entries, the day's count */
const owned = (page: Page) => page.evaluate(() => {
  const a = (window as W).__neural, key = Object.keys(localStorage).find((k) => /pending$/.test(k))
  const j = key ? JSON.parse(localStorage.getItem(key) || "{}") : {}
  return { moves: JSON.stringify(a.moves), journal: JSON.stringify(j.e || []), done: a.practiceToday().done, srs: JSON.stringify(a.srs) }
})
/** a transition's authored success outcomes, from the content source (NOT the wire): [to, probability] best first, ties in authored order */
function authored(name: string): [string, number][] | null {
  const f = resolve(ROOT, "content/Transitions", name + ".json")
  if (!existsSync(f)) return null
  const d = JSON.parse(readFileSync(f, "utf8"))
  const ok = (d.outcomes || []).map((o: W, i: number) => [o.to, typeof o.probability === "object" && o.probability ? o.probability.gi : o.probability, i, o.result])
    .filter((o: W) => o[3] === "success" && typeof o[1] === "number")
  ok.sort((a: W, b: W) => b[1] - a[1] || a[2] - b[2])
  return ok.map((o: W) => [o[0], o[1]])
}
const rowsOf = (page: Page) => page.locator("[data-cloze-row]").evaluateAll((els) => els.map((el) => {
  const q = (s: string) => el.querySelector(s), all = (s: string) => [...el.querySelectorAll(s)]
  return { kind: el.getAttribute("data-cloze-row"), label: el.getAttribute("aria-label"), name: q(".nm")?.textContent || null, bar: !!q(".br"), h: Math.round(el.getBoundingClientRect().height * 10) / 10,
    line: !!q(".d2"), arrow: !!q(".d2 .ar"), tri: !!q(".d2 .tri"), places: all(".d2 .pl").map((p) => p.textContent), roles: all(".d2 .rt").map((p) => p.textContent),
    or: !!q(".d2 .or"), orRole: !!q(".d2 .or .rt"), over: q(".d2") ? q(".d2")!.scrollWidth > q(".d2")!.clientWidth + 0.5 : false,
    had: el.hasAttribute("data-had"), when: q("[data-cloze-when]")?.textContent || null, tog: q("[data-cloze-had]")?.textContent || null }
}))

for (const touch of [true, false]) {
  test.describe(touch ? "390x631, touch" : "1440x900, mouse", () => {
    test.use(touch ? { viewport: { width: 390, height: 631 }, hasTouch: true, isMobile: true } : { viewport: { width: 1440, height: 900 } })
    const tag = touch ? "touch" : "mouse"

    test(`a cloze of six: bars, Show, Hide keeps the taps and writes nothing, Done writes six and adds six, Undo takes it back exactly (${tag})`, async ({ page }) => {
      const errors: string[] = []
      page.on("pageerror", (e) => errors.push(String(e.message || e)))
      await setup(page)
      await openMaster(page, touch)
      await expect(page.locator('[data-master-row="Mount|Bottom"] small'), "the place says what it owes: its six moves").toHaveText(/^6 due/)
      await openCloze(page, "Mount|Bottom", touch)
      // BEFORE SHOW: one blank bar a hidden move, the count said, nothing about where any leads
      let rows = await rowsOf(page)
      expect(rows.length, "six rows").toBe(6)
      for (const r of rows) expect([r.bar, r.name, r.line, r.h], "a bar: no name, no second line, 36 px").toEqual([true, null, false, 36])
      await expect(page.locator("[data-cloze-say]")).toHaveText("Six moves start here. Say each one to yourself, then Show.Each blank is one move; each counts one toward today's 20.")
      await expect(page.locator("[data-cloze] [data-cloze-leads]"), "the second line is absent before Show").toHaveCount(0)
      expect(await page.locator("[data-cloze]").innerText(), "no move is named before Show").not.toMatch(/Escape|Roll|Guard|Choke/)
      const before = await owned(page)
      // SHOW, some taps, HIDE, SHOW: the taps are kept, and nothing is written
      await press(page, "[data-master-bar] [data-cloze-show]", "Show", touch, false)
      rows = await rowsOf(page)
      for (const r of rows) expect([r.bar, !!r.name, r.h, r.tog], `${r.name}: a name, 44 px, its toggle`).toEqual([false, true, 44, "Had it?"])
      const names = rows.map((r) => r.name!)
      for (const i of [0, 1, 2, 4]) {
        await press(page, `[data-cloze-row]:nth-of-type(${i + 2}) [data-cloze-had]`, `Had it? on ${names[i]}`, touch, false)
      }
      const tapped = (await rowsOf(page)).filter((r) => r.had).map((r) => r.name)
      expect(tapped, "the four tapped rows are gold").toEqual([names[0], names[1], names[2], names[4]])
      await expect(page.locator("[data-cloze-say]")).toContainText("Tap the ones you had. 4 so far.")
      await expect(page.locator("[data-master-bar] [data-cloze-done]")).toHaveText("Done 4 had")
      await press(page, "[data-master-bar] [data-cloze-hide]", "Hide", touch, false)
      expect((await rowsOf(page)).every((r) => r.bar && !r.line), "Hide puts the bars back, and the second lines go at once").toBe(true)
      expect(await owned(page), "Hide is a view, never a grade: nothing a player owns moved").toEqual(before)
      await press(page, "[data-master-bar] [data-cloze-show]", "Show again", touch, false)
      expect((await rowsOf(page)).filter((r) => r.had).map((r) => r.name), "Show, Hide, Show keeps the taps").toEqual(tapped)
      expect(await owned(page), "still nothing written").toEqual(before)
      // DONE: six rows, six of the day's 20
      await press(page, "[data-master-bar] [data-cloze-done]", "Done", touch, false)
      const after = await owned(page)
      const wrote = await page.evaluate((d) => { const a = (window as W).__neural; return Object.values(a.moves).flatMap((m: W) => Object.values(m)).filter((r: W) => r[2] === d).map((r: W) => r[3]) }, DAY)
      expect(wrote.length, "a cloze of six writes six rows, each answered today").toBe(6)
      expect(wrote.filter((x) => x === 1).length, "four of them a Yes").toBe(4)
      expect(after.done - before.done, "six answers are six of the day's 20").toBe(6)
      expect(JSON.parse(after.journal).length - JSON.parse(before.journal).length, "one journal line an answer").toBe(6)
      await expect(page.locator("[data-cloze-result] .gn"), "the gold number: the moves you remember from here").toHaveText("4")
      await expect(page.locator("[data-cloze-plus]")).toHaveText("+6 toward today’s 20")
      rows = await rowsOf(page)
      expect(rows.map((r) => r.when), "each row says when it comes back").toEqual(rows.map((r) => (r.had ? "back in 7 days" : "again on Wednesday")))
      await expect(page.locator("[data-plan-goal]"), "the day's count reads the six").toContainText("6 of 20 today")
      // UNDO: the last confirm back, byte for byte, and the cloze shown again with its taps
      await press(page, "[data-cloze-undo]", "Undo", touch, false)
      expect(await owned(page), "Undo restores what a player owns, byte for byte").toEqual(before)
      expect((await rowsOf(page)).filter((r) => r.had).map((r) => r.name), "the taps are kept").toEqual(tapped)
      await expect(page.locator("[data-master-bar] [data-cloze-done]"), "and Done is offered again").toBeVisible()
      await press(page, "[data-master-bar] [data-cloze-done]", "Done again", touch, false)
      expect((await owned(page)).done - before.done).toBe(6)
      // NEXT: the place's row counts what is left, and the next ask opens
      await expect(page.locator('[data-master-row="Mount|Bottom"] small')).not.toHaveText(/^6 due/)
      await press(page, "[data-master-bar] [data-cloze-next]", "Next", touch, false)
      await expect(page.locator('[data-cloze="Mount|Bottom"]'), "the place is left").toBeHidden()
      await expect(page.locator("[data-cloze-undo]"), "and its Undo with it").toHaveCount(0)
      expect(errors, "no page error").toEqual([])
    })

    test(`where a move takes you: the place and the role on five positions, against the authored tables; a finish; what gives way (${tag})`, async ({ page }) => {
      await setup(page)
      await openMaster(page, touch)
      let checked = 0, finishes = 0, seconds = 0
      const way: Record<string, { or: boolean; orRole: boolean; done?: { or: boolean; orRole: boolean } }> = {}
      for (const seat of PLACES) {
        await openCloze(page, seat, touch)
        await expect(page.locator("[data-cloze] [data-cloze-leads]"), `${seat}: no second line before Show`).toHaveCount(0)
        await press(page, "[data-master-bar] [data-cloze-show]", "Show", touch, false)
        const rows = await rowsOf(page)
        expect(rows.length, `${seat}: six rows`).toBe(6)
        for (const r of rows) {
          expect([r.h, r.line, r.arrow, r.over], `${seat} › ${r.name}: two lines (44 px), its arrow, nothing cut off`).toEqual([44, true, true, false])
          const want = authored(r.name!)
          if (!want) continue   // not a transition (a submission's own row): its finish is checked below by shape
          const [to, , ] = want[0], m = to.match(/^(.*)\/(Top|Bottom)$/)
          expect(m, `${r.name}: its authored success outcome is a seat (${to})`).not.toBeNull()
          if (r.tri) {   // a finish: the control position a submission is held from; its triangle and its name, no role
            expect([r.places[0], r.roles.length], `${r.name}: the finish, no role`).toEqual([m![1], 0])
            expect(r.label, "its accessible name").toBe(`${r.name}, leads to the ${m![1]} finish`)
            finishes++
          } else {
            expect([r.places[0], r.roles[0]], `${seat} › ${r.name}: the place and the role, as authored`).toEqual([m![1], m![2].toLowerCase()])
            expect(r.label, "its accessible name").toBe(`${r.name}, leads to ${m![1]}, ${m![2].toLowerCase()}`)
          }
          if (want[1] && want[1][1] >= 25) { seconds++; way[r.name!] = { or: r.or, orRole: r.orRole } } else expect(r.or, `${r.name}: no second place under 25`).toBe(false)
          checked++
        }
        // after Done the row has its full width: the second place comes back where it fits (its role first to go)
        await press(page, "[data-master-bar] [data-cloze-done]", "Done", touch, false)
        for (const r of await rowsOf(page)) { expect(r.over, `${r.name}: nothing cut off after Done`).toBe(false); if (way[r.name!]) way[r.name!].done = { or: r.or, orRole: r.orRole } }
      }
      expect(checked, "rows checked against their authored table").toBeGreaterThanOrEqual(20)
      expect(finishes, "a row that leads to a finish was among them").toBeGreaterThan(0)
      expect(seconds, "rows with a second place of 25 or more were among them").toBeGreaterThan(0)
      // WHAT GIVES WAY, IN ORDER: a second place's role never stands where the second place had to go, and (spec.md, measured
      // at 390x631) beside "Had it?" every two-place row of Mount and Side Control, bottom, gives its second place up
      for (const [name, w] of Object.entries(way)) {
        expect(!w.or && w.orRole, `${name}: no role without its place`).toBe(false)
        if (w.done) expect(!w.or || w.done.or, `${name}: a second place that fits beside the toggle fits the full row too`).toBe(true)
      }
      if (touch) {
        for (const name of ["Mount Escape to Half Guard Back Take", "Shrimp Escape", "Side Control Escape"]) if (way[name]) expect(way[name].or, `${name}: beside "Had it?" its second place gives way`).toBe(false)
        if (way["Side Control Escape"]) expect(way["Side Control Escape"].done, "Side Control Escape after Done: \"· or Half Guard\", its role gone").toEqual({ or: true, orRole: false })
      }
    })

    test(`the second line fades in after the name, not at all under reduced motion; the toggle and the name are different targets (${tag})`, async ({ page }) => {
      await setup(page)
      await openMaster(page, touch)
      await openCloze(page, "Mount|Bottom", touch)
      await press(page, "[data-master-bar] [data-cloze-show]", "Show", touch, false)
      const anim = () => page.locator("[data-cloze] .d2").first().evaluate((el) => { const c = getComputedStyle(el); return [c.animationName, c.animationDuration, c.animationDelay, c.animationTimingFunction] })
      expect(await anim(), "180 ms, ease-out, 120 ms after the name").toEqual(["ngCzIn", "0.18s", "0.12s", "ease-out"])
      // the toggle and the name are different targets: the point on the name is not the toggle's, and a press there marks nothing
      const pts = await page.locator("[data-cloze-row]").first().evaluate((el) => {
        const n = el.querySelector(".nm")!.getBoundingClientRect(), t = el.querySelector("[data-cloze-had]")!.getBoundingClientRect()
        const at = (x: number, y: number) => { const e = document.elementFromPoint(x, y); return !!e && !!e.closest("[data-cloze-had]") }
        return { name: { x: n.left + Math.min(20, n.width / 2), y: n.top + n.height / 2 }, tog: { x: t.left + t.width / 2, y: t.top + t.height / 2, w: t.width, h: t.height },
          onName: at(n.left + Math.min(20, n.width / 2), n.top + n.height / 2), onTog: at(t.left + t.width / 2, t.top + t.height / 2),
          edges: [[t.left + 3, t.top + 3], [t.right - 3, t.bottom - 3]].map(([x, y]) => at(x, y)) }
      })
      expect([pts.onName, pts.onTog, pts.edges], "the name's point is not the toggle; the toggle's centre and corners are").toEqual([false, true, [true, true]])
      expect(pts.tog.h, "the toggle's target is the row's height").toBeGreaterThanOrEqual(44)
      expect(pts.tog.w).toBeGreaterThanOrEqual(44)
      if (touch) await page.touchscreen.tap(pts.name.x, pts.name.y); else await page.mouse.click(pts.name.x, pts.name.y)
      expect((await rowsOf(page)).filter((r) => r.had).length, "a press on the name marks nothing").toBe(0)
      if (touch) await page.touchscreen.tap(pts.tog.x, pts.tog.y); else await page.mouse.click(pts.tog.x, pts.tog.y)
      expect((await rowsOf(page)).filter((r) => r.had).length, "a press on the toggle marks its row").toBe(1)
      // reduced motion: with the name, without a fade
      await press(page, "[data-master-bar] [data-cloze-hide]", "Hide", touch, false)
      await page.emulateMedia({ reducedMotion: "reduce" })
      await press(page, "[data-master-bar] [data-cloze-show]", "Show", touch, false)
      expect((await anim())[0], "no fade under reduced motion").toBe("none")
      expect(await page.locator("[data-cloze] .d2").first().evaluate((el) => getComputedStyle(el).opacity)).toBe("1")
    })
  })
}

test.describe("1440x900, mouse: the map beside an open cloze", () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  // ruling 7: while a cloze is open and not shown, nothing on the map names, lights or singles out one of its hidden moves
  test("the hand is face down, and the map draws no name, hover label or gold mark on a hidden move; after Show, as today", async ({ page }) => {
    const { j } = await setup(page, { at: "Mount|Bottom" })
    for (let i = 0; i < 16; i++) { await j.advance(1000); if (await page.evaluate(() => ((window as W).__neural.optionIdxs || []).length > 0)) break }
    await j.advance(2500)
    const map = () => page.evaluate(() => {
      const a = (window as W).__neural, c = a._session && a._session.cz && a._session.czOpen != null ? a._session.cz.get(a._session.czOpen) : null
      const hidden = new Set<number>(c ? c.rows.filter((r: W) => r.ask).map((r: W) => r.idx) : [])
      return { hand: (a._optionCards || []).length, down: (a._optionCards || []).filter((x: W) => x.card.hasAttribute("data-hide")).length,
        cardNames: (a._optionCards || []).filter((x: W) => hidden.has(x.opt.idx) && !x.card.hasAttribute("data-hide")).length,
        named: (a._lastOptLabels || []).filter((l: W) => hidden.has(l.idx)).length, marks: (a._lastMapMarks || []).filter((m: W) => hidden.has(m.idx)).length,
        hover: a._lastHoverLabel ? hidden.has(a._lastHoverLabel.idx) : false, hidden: hidden.size, labels: (a._lastOptLabels || []).length, allMarks: (a._lastMapMarks || []).length }
    })
    const open = await page.evaluate(() => { const a = (window as W).__neural; return { hand: (a._optionCards || []).length, down: (a._optionCards || []).filter((x: W) => x.card.hasAttribute("data-hide")).length } })
    expect(open.hand, "premise: the roll stands at Mount, bottom, its hand dealt").toBeGreaterThanOrEqual(6)
    expect(open.down, "premise: the hand is face up (rolls show their moves)").toBe(0)
    await openMaster(page, false)
    await openCloze(page, "Mount|Bottom", false)
    await j.advance(600)
    let m = await map()
    expect(m.hidden, "premise: six hidden moves").toBe(6)
    expect([m.down, m.cardNames], "the hand is face down, whole").toEqual([m.hand, 0])
    expect([m.named, m.marks], "the frame drew no name and no gold mark on a hidden move").toEqual([0, 0])
    // a pointer on a hidden move's orb: no label
    const orb = await page.evaluate(() => {
      const a = (window as W).__neural, c = a._session.cz.get(a._session.czOpen), i = c.rows.find((r: W) => r.ask).idx, n = a.nodes[i], sc = a.W / a.cam.vw
      const r = a.canvasRef.current.getBoundingClientRect()
      return { x: r.left + (n.x - a.cam.cx) * sc + a.W / 2, y: r.top + (a._LY(n) - a.cam.cy) * sc + a.H / 2, w: innerWidth, h: innerHeight }
    })
    if (orb.x > 380 && orb.x < orb.w && orb.y > 0 && orb.y < orb.h) { await page.mouse.move(orb.x, orb.y); await j.advance(400); expect((await map()).hover, "no hover label on a hidden move").toBe(false) }
    // a look does not turn a card up
    const card = await page.evaluate(() => { const c = (window as W).__neural._optionCards[0].card.getBoundingClientRect(); return { x: c.left + c.width / 2, y: c.top + c.height / 2 } })
    await page.mouse.move(card.x, card.y); await j.advance(400)
    m = await map()
    expect([m.down, m.named], "a pointer on a card turns nothing up and names nothing").toEqual([m.hand, 0])
    await page.mouse.move(200, 400)
    // after Show the map is as it is today
    await press(page, "[data-master-bar] [data-cloze-show]", "Show", false, false)
    await j.advance(600)
    m = await map()
    expect(m.down, "after Show the hand is face up again").toBe(0)
    await press(page, "[data-master-bar] [data-cloze-hide]", "Hide", false, false)
    await j.advance(400)
    expect((await map()).down, "Hide turns it down again").toBe(m.hand)
    await press(page, "[data-master-list]", "back to the list", false, false)
    await j.advance(400)
    expect(await page.evaluate(() => ((window as W).__neural._optionCards || []).filter((x: W) => x.card.hasAttribute("data-hide")).length), "the place left: the hand is as it was").toBe(0)
  })
})
