import { expect, test, type Page } from "@playwright/test"
import { journey } from "../dsl"

/**
 * ONE PRESS ON THE BARE MAP CLOSES THE PAGE, WHOLE (BGCLOSE, v1.294.0)
 *
 * The owner, 19 Nov 2026, on /Positions/X-Guard/Bottom: "when i click the graph in the bg this happens instead of clearing all
 * sections in the article and just revealing the graph in the bg. i don't want some closed sections i want all article to be
 * removed from the UI and the url to lose the "/Positions/X-Guard/Bottom" part ... if the user clicks outside it's like
 * clicking outside a playing video = closing it."
 *
 * WHAT IT WAS (measured on v1.293.3, his window and a phone): a ladder of two, his own word of v1.134.0. The first press
 * closed the question and the videos and left the hand and every section of the article; a second cleared everything of
 * the place; a third did nothing; and the address never changed. NOW: one press closes the page whole (the state the
 * second press reached) and the address becomes the site's root, pushed, with the site's own title. Back brings the page
 * and its address back; Forward closes it again. A roll under way is closed with it and filed in Last rolls as free roam
 * always filed it. No press on the map leaves a half state.
 * BACK AND FORWARD REMOUNT THE APP: Quartz's router answers a history step by fetching the entry and morphing the page,
 * and the loader mounts a new app on it. So Back is a fresh arrival on the page, and Forward is a BOOT on the entry the
 * close wrote: by default the root's boot (a roll at a start position, its address pushed over the forward history).
 * The entry carries a mark, and the boot of a remount that finds it stands the map alone instead.
 *
 * THE CLAIMS, by real input on the real page (its article, its questions and its videos are routed, not the harness's
 * empty ones), at 1074x796 (his window) and 1440x900 by mouse, and at 390x631 by touch:
 *  1. As loaded, one press on the bare map: no section, no question, no video, no hand; the address the root; the title
 *     the site's. Back: the page and its address again, whole. Forward: closed again. A press on the node the page was of
 *     brings it back, and that entry does not carry the close's mark (Back, then Forward, restores it).
 *  2. A roll two moves in: closed by one press, filed with its three states, and "Roll from here" on its row picks it
 *     up; what is stored is the roll's own filing and nothing else.
 *  3. What is not a press on the bare map does not close the page: a pan, a wheel, a press on a node (it opens that
 *     node's page), the tap that shuts the drawer on a phone, and a press that has closed something else: the one that
 *     ends a film, the one outside the account's menu.
 *  4. The fine controls stay: the question's ✕ (and Undo on its message), the videos' ✕, the hand's ✕, a section's ✕ each
 *     close their own part and nothing else, and the address stays. THE "QUESTIONS" LABEL WITH THE STRUCK EYE IS GONE: it
 *     showed only for a card the first press had taken away (closed while its preference was on), which was the half
 *     state itself. A question closed by its own ✕ leaves its message and comes back by Undo, Settings or its index row.
 * Probe points on the map stand 14 px or more clear of any control and of any node's reach (`bare`).
 *
 * §6.3's traps, as kept: every press is a real mouse click or a real touch at a measured point that the canvas owns
 * (never `locator.click()`, never the app's function); what is asserted is what is on the SCREEN (boxes with a size,
 * computed visibility) and the browser's own address, title and history, never a flag alone; the page's parts are a
 * premise before each press, so "none after" is none of some.
 *
 * Mutants (each alone, in the served bundle, a clean control first):
 *   C1 the first press leaves the half state again (the card step returns before the rest) → "…closes the page whole…" at
 *      "one press: nothing of the page is left on the screen"
 *   C2 the address is not written → the same journey at "the address is the site's root, and the title the site's own"
 *   C3 the close replaces the page's entry instead of pushing one → at "Back brings the page back, whole, with its address"
 *   C4 the boot does not know the closed entry (it deals the root's own roll) → at "Forward closes it again"
 *   C5 the close's mark rides on into the next entry (the one writer does not drop it) → at "a press on a node opens its
 *      page, on an entry of its own with no mark of the close", and at "Forward onto that page restores it"
 *   C6 a pan closes the page (the tap router takes a moved press for a tap) → "…a pan, a wheel…" at "a pan moves the map
 *      and closes nothing"
 *   C7 a press that closed something else goes on to close the page (`spent` not read) → "a press that ends a film…" at
 *      "the film is over and the page is whole", and "a press outside the account's menu…" at "the menu is shut and the
 *      page is whole"
 *   C8 the roll is not filed by the close → "a roll two moves in…" at "it is filed under Previous rolls with its states"
 * NOT COVERED: a Principle's, a Learning entry's and a System's page, which stay under a press on the map (reference law:
 * free-roam-article.spec.ts pins it); the press that ends a LOOK (last-rolls-places.spec.ts) and the one outside a LIST
 * menu (seat-star.spec.ts; the same line as the account's menu); a share preview (/l/), whose address stays for every
 * push; a RELOAD on the closed entry, and a first load that lands on it (coming back from another site): the root's own
 * boot, as ruled, by reading (`ngBoots`: only a remount stands the map alone); the old app's last moment before the
 * remount (on Forward it does what it did at any "/" entry); the tutorial (it has no hold on the map's presses); a real
 * browser's own Back button (`page.goBack` here).
 */

type W = any
const PAGE = "/Positions/X-Guard/Bottom", PAGE_TITLE = "X-Guard Bottom | BJJ Position Guide | BJJ Graph"
const SITE_TITLE = "BJJ Graph - Free BJJ Study App and Technique Map"
const SIZES = [
  { name: "1074x796 by mouse", width: 1074, height: 796, touch: false },
  { name: "1440x900 by mouse", width: 1440, height: 900, touch: false },
  { name: "390x631 by touch", width: 390, height: 631, touch: true },
] as const

/** what of the page is on the screen (boxes with a size, not hidden), and the browser's own address, title and history */
const seen = (page: Page) => page.evaluate(() => {
  const a = (window as W).__neural
  if (!a || !a.nodes || !a.cam || !a.optionsRef?.current || a.__ngDestroyed) return null as never   // a remounted app, not yet booted
  const on = (el: Element | null | undefined) => {
    if (!el || !el.isConnected || el.closest("[hidden]")) return false
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el)
    return r.width > 1 && r.height > 1 && cs.visibility !== "hidden" && cs.display !== "none"
  }
  return {
    sections: [...document.querySelectorAll("[data-reader-body] > [data-section-type]")].filter(on).length,
    question: on(a._landEl), videos: on(a._landFilmEl),
    hand: [...(a.optionsRef.current as HTMLElement).querySelectorAll("[data-tech]")].filter(on).length,
    index: on(document.querySelector(".ng-reader-toc")),
    address: location.pathname, title: document.title, entries: history.length, mark: !!history.state?.ngMap,
    roam: !!a._roam, states: (a.rollLog || []).length as number, stands: (a.nodes[a.currentPos]?.id || null) as string | null,
    film: !!a._replay, menu: !!document.querySelector('.ng-account-menu[data-open="1"]'), drawer: !!a.deckShown, intro: !a.introDone,
  }
})
/** frames, for whichever app is mounted now (Back and Forward mount a new one; it is skipped while it boots) */
const frames = (page: Page, ms: number) => page.evaluate((ms) => { const a = (window as W).__neural; if (a && a.nodes && a.cam && !a.__ngDestroyed) a.advance(ms) }, ms)
/** a node drawn on the map that a press picks (any but the one stood on and its other half), with the page it names */
const someNode = (page: Page) => page.evaluate(() => {
  const a = (window as W).__neural, rect = a.canvas.getBoundingClientRect(), s = a.W / a.cam.vw, was = a._hover, ly = a._LY || ((q: W) => q.y)
  const here = a.nodes[a.currentPos]
  try {
    for (const kind of ["positions", "transitions", "submissions"]) for (const n of a.nodes) {
      if (n.ty !== kind || (here && (n.idx === here.idx || n.idx === here.pi))) continue
      const x = rect.left + a.W / 2 + (n.x - a.cam.cx) * s, y = rect.top + a.H / 2 + (ly(n) - a.cam.cy) * s
      if (x < 20 || y < 46 || x > innerWidth - 20 || y > innerHeight - 20 || document.elementFromPoint(x, y) !== a.canvas) continue
      a._hover = null; a._updateHover({ type: "pointerup", clientX: x, clientY: y })
      if (a._hover?.idx === n.idx) return { x, y, idx: n.idx as number, id: n.id as string }
    }
    return null
  } finally { a._hover = was }
})
/** Back and Forward mount a NEW app (Quartz morphs the page; the loader remounts). The app that is up is marked before the
 *  step, and the step is over when an app without the mark has booted. */
const markApp = (page: Page) => page.evaluate(() => { (window as W).__neural.__bgcloseOld = true })
const remounted = (page: Page) => expect.poll(() => page.evaluate(() => { const a = (window as W).__neural; return !!a && !a.__bgcloseOld && !!a.nodes && !!a.cam }), { message: "premise: the history step mounted a new app", timeout: 30000 }).toBe(true)
const NOTHING = { sections: 0, question: false, videos: false, hand: 0, index: false }
const partsOf = (s: Awaited<ReturnType<typeof seen>>) => ({ sections: s.sections, question: s.question, videos: s.videos, hand: s.hand, index: s.index })

/** a point of bare map: the canvas owns it and the four points 14 px around it, and the app's own picker finds no node at
 *  any of them (so it stands 14 px clear of every control and of every node's reach). Right of `rightOf` if given. */
const bare = (page: Page, rightOf = 0) => page.evaluate((rightOf) => {
  const a = (window as W).__neural, was = a._hover, ring = [[0, 0], [14, 0], [-14, 0], [0, 14], [0, -14], [10, 10], [-10, 10], [10, -10], [-10, -10]]
  try {
    for (let y = 46; y < innerHeight - 30; y += 17) for (let x = innerWidth - 24; x > rightOf + 20; x -= 19) {
      if (!ring.every(([dx, dy]) => document.elementFromPoint(x + dx, y + dy) === a.canvas)) continue
      if (ring.every(([dx, dy]) => { a._hover = null; a._updateHover({ type: "pointerup", clientX: x + dx, clientY: y + dy }); return !a._hover || a._hover.idx < 0 })) return { x, y }
    }
    return null
  } finally { a._hover = was }
}, rightOf)
const beatsFrom = (page: Page, from: number) => page.evaluate((from) => ((window as W).__neural.beats || []).slice(from).map((b: W) => b.beat as string), from)
const beatCount = (page: Page) => page.evaluate(() => ((window as W).__neural.beats || []).length as number)
/** the stored record, every leaf by its path */
const stored = (page: Page) => page.evaluate(() => {
  const out: Record<string, string> = {}
  const walk = (v: unknown, at: string) => {
    if (v && typeof v === "object") { for (const [k, x] of Object.entries(v as object)) walk(x, at + "/" + k) } else out[at] = JSON.stringify(v)
  }
  for (const [key, value] of Object.entries(localStorage)) { try { walk(JSON.parse(value), key.replace(/^.*:/, "")) } catch { out[key] = value } }
  return out
})
const changed = (a: Record<string, string>, b: Record<string, string>) => Object.keys({ ...a, ...b }).filter((k) => a[k] !== b[k]).sort()

for (const size of SIZES) {
  test.describe(`a press on the bare map, ${size.name}`, () => {
    test.use(size.touch ? { viewport: { width: size.width, height: size.height }, hasTouch: true, isMobile: true } : { viewport: { width: size.width, height: size.height } })
    const press = async (page: Page, at: { x: number; y: number }) => { if (size.touch) await page.touchscreen.tap(at.x, at.y); else await page.mouse.click(at.x, at.y) }
    const pressOn = async (page: Page, selector: string, what: string) => {
      const at = await page.evaluate((sel) => {
        const e = [...document.querySelectorAll(sel)].find((x) => (x as HTMLElement).getClientRects().length > 0) as HTMLElement | undefined
        if (!e) return null
        e.scrollIntoView({ block: "nearest" })
        const r = e.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, t = document.elementFromPoint(x, y)
        return { x, y, ok: !!t && (t === e || e.contains(t)) }
      }, selector)
      expect(at, `${what}: on the screen`).not.toBeNull()
      expect(at!.ok, `${what}: it is what a press at (${Math.round(at!.x)},${Math.round(at!.y)}) reaches`).toBe(true)
      await press(page, at!)
    }
    /** the owner's page as loaded, with its real article, questions and videos; every part a premise */
    async function arrived(page: Page) {
      const j = journey(page)
      await j.boot(PAGE, { beforeNavigate: async () => { await page.route("**/static/neural/content/*.json", (route) => route.continue()) } })
      await expect(page.locator('[data-reader][data-reader-ready="true"]')).toBeVisible()
      await j.advance(1500)
      await j.readerLayoutSettled()
      await expect.poll(async () => { await j.advance(200); const s = await seen(page); return s.sections > 3 && s.question && s.videos && s.hand > 0 }, { message: "premise: the page is up whole: its sections, its question, its videos and its hand" }).toBe(true)
      const s = await seen(page)
      expect([s.address, s.title, s.roam], "premise: the address and the title are the page's").toEqual([PAGE, PAGE_TITLE, false])
      return { j, was: s }
    }
    /** the page back whole after a history step or a press (the reader and its parts settle over a few frames) */
    const whole = async (page: Page, why: string) => {
      await expect.poll(async () => { await frames(page, 300); const s = await seen(page); return !!s && s.sections > 3 && s.question && s.hand > 0 && !s.roam }, { message: why, timeout: 30000 }).toBe(true)
      return seen(page)
    }
    /** the map alone, on a remounted app whose opening is over (so "no roll" is said after the root's own boot would have dealt one) */
    const alone = async (page: Page, why: string) => {
      await expect.poll(async () => { await frames(page, 500); const s = await seen(page); return !!s && !s.intro && s.address === "/" }, { message: "premise: the app is mounted on the root's entry and its opening is over", timeout: 30000 }).toBe(true)
      await frames(page, 3000)
      const s = await seen(page)
      expect([partsOf(s), s.states, s.address], why).toEqual([NOTHING, 0, "/"])
      return s
    }

    test(`as loaded, one press closes the page whole: nothing of it left, the address the root, the title the site's; Back brings it back and Forward closes it again (${size.width})`, async ({ page }) => {
      const { j, was } = await arrived(page)
      const from = await beatCount(page)
      const at = await bare(page)
      expect(at, "premise: a point of bare map, 14 px clear of every control and of every node's reach").not.toBeNull()
      await press(page, at!)
      await j.advance(600)
      const shut = await seen(page)
      expect(partsOf(shut), "one press: nothing of the page is left on the screen (no section, no question, no video, no hand, no index)").toEqual(NOTHING)
      expect([shut.address, shut.title], "the address is the site's root, and the title the site's own").toEqual(["/", SITE_TITLE])
      expect([shut.entries - was.entries, shut.mark], "written as a new entry, which carries the close's mark").toEqual([1, true])
      expect((await beatsFrom(page, from)).filter((b) => ["land_q_declined", "land_dismissed", "roll_discarded", "roll_archived", "roam_entered"].includes(b)),
        "the two steps' own beats, in their order, once").toEqual(["land_q_declined", "land_dismissed", "roll_discarded", "roam_entered"])
      // a second press on the map changes nothing: there is no further step
      const again = await bare(page)
      await press(page, again!)
      await j.advance(600)
      const still = await seen(page)
      expect([partsOf(still), still.address, still.entries], "a second press changes nothing").toEqual([NOTHING, "/", shut.entries])

      // BACK: the page and its address again (a fresh arrival on it: Back remounts the app)
      await markApp(page); await page.goBack(); await remounted(page)
      const back = await whole(page, "Back brings the page back, whole, with its address")
      expect([back.address, back.title, back.videos, back.entries], "Back brings the page back, whole, with its address").toEqual([PAGE, PAGE_TITLE, true, shut.entries])
      // FORWARD: closed again, and the forward history kept (the root's own boot would deal a roll and push its address)
      await markApp(page); await page.goForward(); await remounted(page)
      const fwd = await alone(page, "Forward closes it again")
      expect([fwd.title, fwd.entries, fwd.mark], "Forward closes it again: the root's title, no new entry").toEqual([SITE_TITLE, shut.entries, true])

      // A PRESS ON A NODE opens its page, as from free roam always
      const node = await someNode(page)
      expect(node, "premise: a node is drawn on the map and pressable there").not.toBeNull()
      await press(page, node!)
      const opened = await whole(page, "a press on a node opens its page")
      expect([opened.address !== "/", opened.mark, opened.entries], "a press on a node opens its page, on an entry of its own with no mark of the close").toEqual([true, false, shut.entries + 1])
      await markApp(page); await page.goBack(); await remounted(page)
      await alone(page, "Back from there is the closed map again")
      await markApp(page); await page.goForward(); await remounted(page)
      const restored = await whole(page, "Forward onto that page restores it")
      expect(restored.address, "Forward onto that page restores it").toBe(opened.address)
    })

    test(`a roll two moves in is closed by one press, filed with its states, and picked up from Last rolls; nothing else is stored (${size.width})`, async ({ page }) => {
      const { j } = await arrived(page)
      for (let n = 0; n < 2; n++) {
        await j.rig("resolve", [0.01]); await j.rig("outcome", [0.01])
        const titles = await j.optionTitles()
        expect(titles.length, "premise: a hand was dealt").toBeGreaterThan(0)
        await j.pick(titles[Math.min(n, titles.length - 1)])
        await j.nextHand()
      }
      await j.advance(1500)
      await page.waitForTimeout(700) // the record's own debounce: what the moves stored is written before the press
      const roll = await page.evaluate(() => { const a = (window as W).__neural; return { states: (a.rollLog || []).map((h: W) => h.key as string), played: !!a._played, start: a.rollLog[0].idx as number, role: a.rollLog[0].role as string } })
      expect([roll.states.length >= 2, roll.played], "premise: a roll under way, with moves played").toEqual([true, true])
      const before = await stored(page), past0 = await page.evaluate(() => ((window as W).__neural._pastRolls || []).length as number), from = await beatCount(page)
      const at = await bare(page)
      expect(at, "premise: a point of bare map").not.toBeNull()
      await press(page, at!)
      await j.advance(3000)
      await page.waitForTimeout(900)
      const shut = await seen(page)
      expect([partsOf(shut), shut.address, shut.title, shut.states], "one press closes the page with a roll under way: nothing of it left, the root's address and title").toEqual([NOTHING, "/", SITE_TITLE, 0])
      const filed = await page.evaluate(() => { const a = (window as W).__neural, r = (a._pastRolls || [])[0]; return { n: (a._pastRolls || []).length as number, ts: r ? (r.ts as number) : 0, states: r ? (r.log || []).map((h: W) => h.key as string) : [] } })
      expect([filed.n - past0, filed.states], "it is filed under Previous rolls with its states").toEqual([1, roll.states])
      expect(await beatsFrom(page, from), "and named: the roll archived, once").toContain("roll_archived")
      // what the close stored: the roll's own filing (the day's count of rolls), the record's clocks, and nothing else
      const diff = changed(before, await stored(page))
      console.log(`BGSTORE ${size.width} ` + JSON.stringify(diff))
      expect(diff.filter((k) => !/\/(updatedAt|savedAt)$/.test(k)).every((k) => /^progress\/.*(rollDays|rolls)\b/.test(k)), `nothing is stored but the roll's own filing: ${JSON.stringify(diff)}`).toBe(true)
      expect(diff.some((k) => /rollDays|rolls/.test(k)), "premise: the filing itself is stored (the day's count of rolls)").toBe(true)

      // LAST ROLLS: its row is there, and "Roll from here" picks it up
      await pressOn(page, ".ng-logo", "the logo")
      await pressOn(page, '[data-view="history"]', "Last rolls")
      await expect(page.locator(`[data-past-roll]`).first(), "the roll's row is in Last rolls").toBeVisible()
      await pressOn(page, `[data-roll-from="${filed.ts}"]`, "the filed roll's Roll from here")
      await expect(page.locator(".ng-cf-yes"), "it asks first").toBeVisible()
      await pressOn(page, ".ng-cf-yes", "yes")
      await j.advance(1500)
      const picked = await page.evaluate(() => { const a = (window as W).__neural; return { pos: a.currentPos as number, role: a.playerRole as string, hand: (a.optionIdxs || []).length as number, roam: !!a._roam } })
      expect([picked.pos, picked.role, picked.hand > 0, picked.roam], "Roll from here picks it up: the board set where that roll began, on the side it was played, a hand dealt").toEqual([roll.start, String(roll.role).toLowerCase(), true, false])
    })

    test(`a pan, a wheel and a press on a node are not a press on the bare map: the page stays (${size.width})`, async ({ page }) => {
      const { j, was } = await arrived(page)
      const at = (await bare(page))!
      expect(at, "premise: a point of bare map").not.toBeNull()
      // A PAN: down on the bare map, a walk of 60 px, up
      const cam0 = await page.evaluate(() => (window as W).__neural.cam.cx as number)
      if (size.touch) {
        const cdp = await page.context().newCDPSession(page)
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: at.x, y: at.y }] })
        for (let i = 1; i <= 6; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: at.x - i * 10, y: at.y }] })
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
      } else {
        await page.mouse.move(at.x, at.y); await page.mouse.down()
        for (let i = 1; i <= 6; i++) await page.mouse.move(at.x - i * 10, at.y)
        await page.mouse.up()
      }
      await j.advance(600)
      const panned = await seen(page)
      expect(await page.evaluate(() => (window as W).__neural.cam.cx as number), "premise: the pan moved the map").not.toBe(cam0)
      expect([panned.sections > 3, panned.question, panned.videos, panned.hand, panned.address, panned.entries, panned.roam], "a pan moves the map and closes nothing")
        .toEqual([true, true, true, was.hand, PAGE, was.entries, false])
      // A WHEEL over the map (a mouse's; a phone has none)
      if (!size.touch) {
        const w = (await bare(page))!
        const vw0 = await page.evaluate(() => (window as W).__neural.cam.vw as number)
        await page.mouse.move(w.x, w.y); await page.mouse.wheel(0, 240)
        await j.advance(600)
        const wheeled = await seen(page)
        expect(await page.evaluate(() => (window as W).__neural.cam.vw as number), "premise: the wheel zoomed the map").not.toBe(vw0)
        expect([wheeled.sections > 3, wheeled.question, wheeled.hand, wheeled.address, wheeled.roam], "a wheel zooms the map and closes nothing").toEqual([true, true, was.hand, PAGE, false])
      }
      // A PRESS ON A NODE: another place, drawn on the map and pressable there. Its page opens; nothing is "closed".
      const other = await someNode(page)
      expect(other, "premise: another node is drawn on the map and pressable").not.toBeNull()
      await press(page, other!)
      const opened = await whole(page, "a press on a node opens that node's page")
      expect([opened.address !== "/", opened.address !== PAGE, opened.roam, opened.entries], "a press on a node opens that node's page: an address of its own (not the root), one new entry").toEqual([true, true, false, was.entries + 1])
    })

    test(`a press that has closed something else does not also close the page: the one that ends a film, and the one outside the account's menu (${size.width})`, async ({ page }) => {
      const { j, was } = await arrived(page)
      // a film needs a filed roll: one move, then the board put back on the page (the fixture; the film and the press are the claim)
      await j.rig("resolve", [0.01]); await j.rig("outcome", [0.01])
      const titles = await j.optionTitles()
      await j.pick(titles[0]); await j.nextHand()
      await page.evaluate(() => { const a = (window as W).__neural; a.rollFromPosition(a.rollLog[0].idx, false, a.rollLog[0].role) })
      await j.advance(2500)
      for (let i = 0; i < 6; i++) { const left = await page.evaluate(() => { const b = document.querySelector("[data-reward-close]") as HTMLElement | null; if (b) b.click(); return document.querySelectorAll("[data-reward-close]").length }); if (!left) break; await page.waitForTimeout(60) }
      const ts = await page.evaluate(() => ((window as W).__neural._pastRolls || [])[0]?.ts as number)
      expect(ts, "premise: a roll is filed").toBeGreaterThan(0)
      const live = await whole(page, "premise: a page is up whole before the film")
      await pressOn(page, ".ng-logo", "the logo")
      await pressOn(page, '[data-view="history"]', "Last rolls")
      await pressOn(page, `[data-replay-roll="${ts}"]`, "the filed roll's replay control")
      await j.advance(300)
      if (size.touch) { await pressOn(page, ".ng-explorer-close", "shut the drawer: how a phone watches the film"); await j.advance(1200) }
      else await j.advance(1500)
      expect((await seen(page)).film, "premise: a film is running").toBe(true)
      const at = await bare(page, size.touch ? 0 : 360)
      expect(at, "premise: a point of bare map beside the drawer").not.toBeNull()
      await press(page, at!)
      await j.advance(1200)
      const after = await seen(page)
      expect([after.film, after.sections > 3, after.question, after.hand, after.address === "/", after.roam], "the film is over and the page is whole: that press ended the film and nothing else")
        .toEqual([false, true, true, live.hand, false, false])
      expect(after.entries, "and wrote no entry").toBe(live.entries)

      // the account's menu: opened from the drawer's foot, shut by a press on the bare map, which does nothing more
      if (!(await seen(page)).drawer) await pressOn(page, ".ng-logo", "the logo")
      await j.advance(600)
      await pressOn(page, ".ngAcctChip", "the account's badge")
      await expect.poll(async () => (await seen(page)).menu, { message: "premise: the account's menu is open" }).toBe(true)
      const before = await seen(page)
      if (size.touch) {
        // on a phone the drawer is the screen: the menu's outside is the strip beside it, and that tap is the drawer's own
        // way out too. It shuts the menu and the drawer, and the page stays.
        const strip = await bare(page, 344)
        expect(strip, "premise: a point of bare map in the strip beside the drawer").not.toBeNull()
        await press(page, strip!)
      } else {
        const out = await bare(page, 360)
        expect(out, "premise: a point of bare map beside the drawer").not.toBeNull()
        await press(page, out!)
      }
      await j.advance(800)
      const shut = await seen(page)
      expect([shut.menu, shut.sections > 3, shut.question, shut.hand, shut.address, shut.entries, shut.roam], "the menu is shut and the page is whole: that press closed the menu and nothing else")
        .toEqual([false, true, true, before.hand, before.address, before.entries, false])
      void was
    })

    test(`the fine controls stay: each ✕ closes its own part and nothing else, and the address stays (${size.width})`, async ({ page }) => {
      const { j, was } = await arrived(page)
      // the question's ✕ (on an open question it folds first; pressed until the card is away), then its "Questions" label
      for (let i = 0; i < 2 && (await seen(page)).question; i++) { await pressOn(page, "[data-land-close]", "the question's ✕"); await j.advance(400); await j.readerLayoutSettled() }
      const noCard = await seen(page)
      expect([noCard.question, noCard.videos, noCard.hand, noCard.sections > 3, noCard.address, noCard.roam], "the question's ✕ closes the question: the videos, the hand, the article and the address stay")
        .toEqual([false, true, was.hand, true, PAGE, false])
      // (the "Questions" label with the struck eye was the first step's own: it showed only for a card the map's press had
      // taken away. A question closed by its ✕ leaves its message, U131 b2, and comes back by its Undo.)
      await expect(page.locator('[data-game-open="card"]'), "no Questions label is left: that label was the half state's").toBeHidden()
      await pressOn(page, '[data-hidesec-notice="card"] [data-hidesec-undo]', "the question's Undo, on its message")
      await j.advance(400); await j.readerLayoutSettled()
      expect((await seen(page)).question, "Undo on its message brings the question back").toBe(true)
      // the videos' ✕
      await pressOn(page, "[data-film-close]", "the videos' ✕")
      await j.advance(400); await j.readerLayoutSettled()
      const noFilm = await seen(page)
      expect([noFilm.videos, noFilm.question, noFilm.hand, noFilm.sections > 3, noFilm.address, noFilm.roam], "the videos' ✕ closes the videos and nothing else").toEqual([false, true, was.hand, true, PAGE, false])
      // the hand's ✕
      await pressOn(page, "[data-hand-close]", "the hand's ✕")
      await j.advance(400); await j.readerLayoutSettled()
      const noHand = await seen(page)
      expect([noHand.hand, noHand.question, noHand.sections > 3, noHand.address, noHand.roam], "the hand's ✕ closes the hand and nothing else").toEqual([0, true, true, PAGE, false])
      // a section's ✕
      const n0 = noHand.sections
      await pressOn(page, "[data-reader-body] > [data-section-type] [data-section-toggle]", "a section's ✕")
      await j.advance(400); await j.readerLayoutSettled()
      const oneLess = await seen(page)
      expect([oneLess.question, oneLess.address, oneLess.entries, oneLess.roam], "a section's ✕ closes that section: the question, the address and the history stay").toEqual([true, PAGE, was.entries, false])
      expect(await page.evaluate(() => document.querySelectorAll("[data-reader-body] > [data-section-type]").length), "and the other sections are still the page's").toBeGreaterThanOrEqual(n0 - 1)
    })
  })
}

test.describe("on a phone with the drawer open, 390x631 by touch", () => {
  test.use({ viewport: { width: 390, height: 631 }, hasTouch: true, isMobile: true })
  test("the tap that shuts the drawer shuts the drawer and nothing else: the page stays, and so does the address", async ({ page }) => {
    const j = journey(page)
    await j.boot(PAGE, { beforeNavigate: async () => { await page.route("**/static/neural/content/*.json", (route) => route.continue()) } })
    await expect(page.locator('[data-reader][data-reader-ready="true"]')).toBeVisible()
    await j.advance(1500); await j.readerLayoutSettled()
    await expect.poll(async () => { await j.advance(200); const s = await seen(page); return s.sections > 3 && s.question && s.hand > 0 }, { message: "premise: the page is up whole" }).toBe(true)
    const was = await seen(page)
    const logo = await page.evaluate(() => { const r = (document.querySelector(".ng-logo") as HTMLElement).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })
    await page.touchscreen.tap(logo.x, logo.y)
    await j.advance(1200)
    expect((await seen(page)).drawer, "premise: the drawer is open, and it is the screen").toBe(true)
    const strip = await bare(page, 344)
    expect(strip, "premise: a point of bare map in the strip beside the drawer, 14 px clear of its edge").not.toBeNull()
    await page.touchscreen.tap(strip!.x, strip!.y)
    await j.advance(1200)
    const after = await seen(page)
    expect([after.drawer, after.sections > 3, after.question, after.hand, after.address, after.entries, after.roam], "the tap shuts the drawer and nothing else: the page stays whole, at its own address")
      .toEqual([false, true, true, was.hand, PAGE, was.entries, false])
    // ...and the next tap on the bare map, the drawer shut, is the one that closes the page
    const at = await bare(page)
    await page.touchscreen.tap(at!.x, at!.y)
    await j.advance(600)
    const shut = await seen(page)
    expect([partsOf(shut), shut.address], "the next tap on the bare map closes the page").toEqual([NOTHING, "/"])
  })
})
