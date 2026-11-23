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
 *   C3 the close replaces the page's entry instead of pushing one (so Back would leave the site) → at "written as a new
 *      entry, which carries the close's mark"
 *   C4 the boot does not know the closed entry (it deals the root's own roll) → at "Forward closes it again"
 *   C5 the close's mark rides on into the next entry (the one writer does not drop it) → at "a press on a node opens its
 *      page, on an entry of its own with no mark of the close", and at "Forward onto that page restores it"
 *   C6 a pan closes the page (the tap router takes a moved press for a tap) → "…a pan, a wheel…" at "a pan moves the map
 *      and closes nothing"
 *   C7 a press that closed something else goes on to close the page (`spent` not read) → "a press that ends a film…" at
 *      "the film is over and the page is whole", and "a press outside the account's menu…" at "the menu is shut and the
 *      page is whole"
 *   C8 the roll is not filed by the close → "a roll two moves in…" at "it is filed under Previous rolls with its states"
 *   C9 a reload on the closed entry stands the map alone too (any boot, not only a remount) → "a reload on the closed
 *      entry…" at "a reload on the closed entry deals the root's own roll"
 *   C10 the press outside the account's menu is not marked as spent → "a press that has closed something else…" at "the
 *      menu is shut and the page is whole" (the two mouse sizes; on a phone that tap is the drawer's own and is consumed)
 *   C11 the press outside a list menu is not marked → seat-star.spec.ts, "…outside…" at "a press outside closes the menu,
 *      and the page stays"
 *   C12 the press that ends a film is not spent → "a press that has closed something else…" at "the film is over and the
 *      page is whole"
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
  // beside an open drawer (`rightOf`) the strip is narrow (46 px at 390): searched point by point, the ring still 14 px clear of it
  const step = rightOf ? 3 : 19, x0 = rightOf ? innerWidth - 15 : innerWidth - 24, x1 = rightOf ? rightOf + 14 : 20
  try {
    for (let y = 46; y < innerHeight - 30; y += rightOf ? 7 : 17) for (let x = x0; x >= x1; x -= step) {
      if (!ring.every(([dx, dy]) => document.elementFromPoint(x + dx, y + dy) === a.canvas)) continue
      if (ring.every(([dx, dy]) => { a._hover = null; a._updateHover({ type: "pointerup", clientX: x + dx, clientY: y + dy }); return !a._hover || a._hover.idx < 0 })) return { x, y }
    }
    return null
  } finally { a._hover = was }
}, rightOf)
/** `bare`, asked again over a few frames: beside a phone's open drawer the strip is 46 px wide, and whether a point there is 14 px
 *  clear of every node depends on where the camera has come to rest (the control found none on 2 runs of 50 at the first ask) */
async function bareSoon(page: Page, rightOf: number) {
  let at: { x: number; y: number } | null = null
  for (let i = 0; i < 12 && !at; i++) { at = await bare(page, rightOf); if (!at) await frames(page, 400) }
  return at
}
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
/** what a step stored, against the record before it: the day's count of rolls (each leaf as before -> after), and every OTHER leaf
 *  that moved, the record's two clocks aside. A filing is the day's count up by one and nothing else (the close's own effect). */
const storedBy = async (page: Page, before: Record<string, string>) => {
  const after = await stored(page), d = changed(before, after)
  return { days: d.filter((k) => /rollDays\//.test(k)).map((k) => [Number(before[k] ?? 0), Number(after[k] ?? 0)]), other: d.filter((k) => !/rollDays\//.test(k) && !/\/(updatedAt|savedAt)$/.test(k)) }
}
/** this visit's shelf as Last rolls holds it: each filed roll's states, newest first */
const shelfNow = (page: Page) => page.evaluate(() => (((window as W).__neural && (window as W).__neural._pastRolls) || []).map((r: W) => (r.log || []).map((h: W) => h.key as string)))
/** two moves played on the hand that is dealt now (rigged: each attempt lands), the roll's states returned */
async function twoMoves(page: Page, j: any) {
  for (let n = 0; n < 2; n++) {
    await j.rig("resolve", [0.01]); await j.rig("outcome", [0.01])
    const titles = await j.optionTitles()
    expect(titles.length, "premise: a hand was dealt").toBeGreaterThan(0)
    await j.pick(titles[Math.min(n, titles.length - 1)])
    await j.nextHand()
  }
  await frames(page, 1500)
  const r = await page.evaluate(() => { const a = (window as W).__neural; return { states: (a.rollLog || []).map((h: W) => h.key as string), played: !!a._played } })
  expect([r.states.length >= 2, r.played], "premise: a roll under way, two moves in").toEqual([true, true])
  return r.states
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
      // ...and the app that is leaving reads nothing as it goes (BGCLOSE-R1: it opened "/" as an article for ~0.3 s, its loading line
      // showing, until the next app mounted). Watched on the leaving reader's own root. Mutant R8: the popstate's closed-entry
      // condition out → red at "the app that is leaving opens no article on its way out".
      await page.evaluate(() => { const w = window as W, r = w.__neural._reader.root as HTMLElement; w.__bgFlash = []; new MutationObserver(() => w.__bgFlash.push(r.dataset.readerPath)).observe(r, { attributes: true, attributeFilter: ["data-reader-path"] }) })
      await markApp(page); await page.goForward(); await remounted(page)
      expect(await page.evaluate(() => (window as W).__bgFlash), "the app that is leaving opens no article on its way out").toEqual([])
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

    // F4 (BGCLOSE-R1; the reader of PR #446): THE CLOSE'S OWN UNDO KEEPS THE ROLL THE CLOSE FILED. Last rolls was the app instance's
    // memory, and Back and Forward mount a new instance: close, then Back, gave the page and an empty Last rolls (the reader: filed
    // `[3]`, after Back `[]`). This visit's shelf is handed from instance to instance in the document (`ngShelf`); a reload empties it,
    // as before. Back does NOT resume the live roll: the page comes back as a fresh arrival, and the roll is in Last rolls.
    // Mutants: H1 the handover removed → red at "after Back, Last rolls holds the roll the close filed"; H2 the shelf kept across a
    // reload (sessionStorage) → red at "a reload empties Last rolls, as before"; H3 another owner takes it → tests/shelf_handover.test.mjs.
    if (size.width !== 1440) test(`Back after a close keeps the roll the close filed: Last rolls holds it, Forward too, Roll from here picks it up, and a reload empties it as before (${size.width})`, async ({ page }) => {
      const { j } = await arrived(page)
      for (let n = 0; n < 2; n++) {
        await j.rig("resolve", [0.01]); await j.rig("outcome", [0.01])
        const titles = await j.optionTitles()
        expect(titles.length, "premise: a hand was dealt").toBeGreaterThan(0)
        await j.pick(titles[Math.min(n, titles.length - 1)])
        await j.nextHand()
      }
      await j.advance(1500)
      const roll = await page.evaluate(() => { const a = (window as W).__neural; return { states: (a.rollLog || []).map((h: W) => h.key as string), start: a.rollLog[0].idx as number, role: a.rollLog[0].role as string, address: location.pathname } })
      expect(roll.states.length, "premise: a roll under way, two moves in").toBeGreaterThanOrEqual(2)
      const at = await bare(page)
      expect(at, "premise: a point of bare map").not.toBeNull()
      await press(page, at!)
      await j.advance(1500)
      const shelfOf = () => page.evaluate(() => { const a = (window as W).__neural; return ((a && a._pastRolls) || []).map((r: W) => ({ ts: r.ts as number, states: (r.log || []).map((h: W) => h.key as string) })) })
      const filed = await shelfOf()
      expect([filed.length, filed[0]?.states], "premise: the close filed the roll with its states").toEqual([1, roll.states])
      // BACK: a new app instance, the page where the roll stood as a fresh arrival, and Last rolls holding the roll
      await markApp(page); await page.goBack(); await remounted(page)
      await expect.poll(async () => { await frames(page, 300); const s = await seen(page); return !!s && !s.intro && s.address === roll.address && !s.roam }, { message: "premise: Back brings the page where the roll stood", timeout: 30000 }).toBe(true)
      expect(await shelfOf(), "after Back, Last rolls holds the roll the close filed: its states, its place on the shelf").toEqual(filed)
      expect((await seen(page)).states, "and Back does not resume the live roll: the page is a fresh arrival").toBeLessThanOrEqual(1)
      await pressOn(page, ".ng-logo", "the logo")
      await pressOn(page, '[data-view="history"]', "Last rolls")
      await expect(page.locator("[data-past-roll]"), "its row is in Last rolls, the one row").toHaveCount(1)
      await expect(page.locator(`[data-roll-from="${filed[0].ts}"]`), "with its Roll from here").toHaveCount(1)
      await pressOn(page, ".ng-explorer-close", "shut the drawer")
      await frames(page, 800)
      // FORWARD: the closed map, a new instance again, the shelf still held
      await markApp(page); await page.goForward(); await remounted(page)
      await alone(page, "Forward is the closed map again")
      expect(await shelfOf(), "after Forward, Last rolls still holds it").toEqual(filed)
      // ROLL FROM HERE picks it up
      await pressOn(page, ".ng-logo", "the logo")
      await pressOn(page, '[data-view="history"]', "Last rolls")
      await pressOn(page, `[data-roll-from="${filed[0].ts}"]`, "the filed roll's Roll from here")
      await expect(page.locator(".ng-cf-yes"), "it asks first").toBeVisible()
      await pressOn(page, ".ng-cf-yes", "yes")
      await frames(page, 1500)
      const picked = await page.evaluate(() => { const a = (window as W).__neural; return { pos: a.currentPos as number, role: a.playerRole as string, hand: (a.optionIdxs || []).length as number, roam: !!a._roam } })
      expect([picked.pos, picked.role, picked.hand > 0, picked.roam], "Roll from here picks it up: the board set where that roll began, on the side it was played").toEqual([roll.start, String(roll.role).toLowerCase(), true, false])
      // A RELOAD empties the shelf, as before: it was never stored. The harness wipes local and session storage at every load
      // (e2e/dsl.ts, `__ng_keep`), which would make this step true whatever the app did; a real reload keeps both, so they are kept
      // here too (the mutant that keeps the shelf in sessionStorage survived this step until they were).
      await page.evaluate(() => sessionStorage.setItem("__ng_keep", "1"))
      await page.reload()
      await expect.poll(async () => { await frames(page, 500); const s = await seen(page); return !!s && !s.intro }, { message: "premise: the reloaded app's opening is over", timeout: 30000 }).toBe(true)
      expect(await shelfOf(), "a reload empties Last rolls, as before").toEqual([])
    })

    // F7 (BGCLOSE-R1; the reader of PR #446): A PAGE STILL LOADING WHEN THE PRESS COMES IS ENDED BY IT. The reader pushes a page's
    // address when its HTML arrives if it could not title it before; that push came after the close (the reader, on Mount Top's
    // "Americana" link with its HTML 2.5 s late: `/`, then `/Submissions/Americana` with its title, a 4th entry, nothing on screen).
    // Here the page's HTML is HELD until the press is made, then let go. Mutant R7: the close does not end the request → red at
    // "the page that was loading writes nothing after the close".
    if (size.width === 1074) test(`a page still loading when the press comes writes nothing after the close: its address, its title and its entry never come (${size.width})`, async ({ page }) => {
      const j = journey(page)
      await j.boot("/Positions/Mount/Top", { beforeNavigate: async () => { await page.route("**/static/neural/content/*.json", (route) => route.continue()) } })
      await expect(page.locator('[data-reader][data-reader-ready="true"]')).toBeVisible()
      await j.advance(1500); await j.readerLayoutSettled()
      // a link in the article to a place whose page the app cannot title before its HTML comes (a family page)
      const link = await page.evaluate(() => {
        const a = (window as W).__neural, seenPaths = new Set<string>()
        for (const l of a._reader.root.querySelectorAll("a[href]") as NodeListOf<HTMLAnchorElement>) {
          const u = new URL(l.href, location.href)
          if (u.origin !== location.origin || seenPaths.has(u.pathname) || !/^\/(Positions|Transitions|Submissions)\//.test(u.pathname)) continue
          seenPaths.add(u.pathname)
          if (!a._pageTitle(u.pathname) && a._nodeAndRoleForPath(u.pathname).idx >= 0) { l.setAttribute("data-bg-late", ""); l.scrollIntoView({ block: "center" }); return u.pathname }
        }
        return null
      })
      expect(link, "premise: the article links a place whose page the app cannot title before its HTML comes").not.toBeNull()
      let release!: () => void
      const held = new Promise<void>((r) => { release = r })
      await page.route("**" + link + "*", async (route) => { await held; await route.continue() })
      await j.readerLayoutSettled()
      await j.clickByMouse("[data-bg-late]", "the article's link to " + link)
      await frames(page, 500)
      const loading = await page.evaluate(() => { const r = (window as W).__neural._reader; return { path: r.root.dataset.readerPath as string, ready: r.root.dataset.readerReady as string, roam: !!(window as W).__neural._roam } })
      expect(loading, "premise: the linked page is loading, its HTML held, and the board is not in free roam").toEqual({ path: link, ready: "false", roam: false })
      const was = await seen(page)
      const at = await bare(page)
      expect(at, "premise: a point of bare map").not.toBeNull()
      await press(page, at!)
      await frames(page, 600)
      const shut = await seen(page)
      expect([partsOf(shut), shut.address, shut.entries], "premise: the press closed the page").toEqual([NOTHING, "/", was.entries + 1])
      release()
      const addresses: string[] = []
      for (let i = 0; i < 16; i++) { await page.waitForTimeout(250); await frames(page, 250); const s = await seen(page); addresses.push(s.address); }
      const after = await seen(page)
      expect({ addresses: [...new Set(addresses)], title: after.title, entries: after.entries, reading: await page.evaluate(() => !!history.state?.ngReading) },
        "the page that was loading writes nothing after the close: no address, no title, no entry of its own").toEqual({ addresses: ["/"], title: SITE_TITLE, entries: shut.entries, reading: false })
      expect(partsOf(after), "and nothing of it is drawn").toEqual(NOTHING)
      await page.unroute("**" + link + "*")
    })

    // F2 (BGCLOSE-R1; the reader of PR #446): PRACTICE'S WAY BACK KEEPS THE CLOSE'S MARK. Master the game's ‹ Back puts its origin
    // back with a REPLACE on the same address (`_exitStudyTo`), and that replace stripped the mark: Back onto the closed entry later
    // booted the root's own roll (a random start) and pushed its address over the forward history. Mutant R2: the mark dropped on
    // any replace → red at "Master the game's Back leaves the closed entry marked".
    if (size.width !== 1440) test(`Master the game and its Back on the closed map keep it closed: a node, then the browser's Back, is the map alone, and Forward is still there (${size.width})`, async ({ page }) => {
      const { j } = await arrived(page)
      const at = await bare(page)
      expect(at, "premise: a point of bare map").not.toBeNull()
      await press(page, at!)
      await frames(page, 600)
      expect([(await seen(page)).address, (await seen(page)).mark], "premise: the page is closed, its entry marked").toEqual(["/", true])
      await pressOn(page, ".ng-logo", "the logo")
      await pressOn(page, '[data-explore-stats] [data-b="due"]', "Master the game")
      await expect(page.locator("[data-practice-page]"), "premise: Master the game is open").toHaveCount(1)
      await pressOn(page, "[data-pane-back]", "Master the game's ‹ Back")
      await frames(page, 600)
      const back = await seen(page)
      expect([back.address, back.mark, partsOf(back)], "Master the game's Back leaves the closed entry marked, the map alone").toEqual(["/", true, NOTHING])
      if (back.drawer) { await pressOn(page, ".ng-explorer-close", "shut the drawer"); await frames(page, 800) }
      const node = await someNode(page)
      expect(node, "premise: a node is drawn on the map and pressable there").not.toBeNull()
      await press(page, node!)
      const opened = await whole(page, "a press on a node opens its page")
      await markApp(page); await page.goBack(); await remounted(page)
      const alone1 = await alone(page, "the browser's Back onto the closed entry is the map alone, no roll dealt")
      expect([alone1.entries, alone1.mark], "no entry pushed over the forward history, the mark there").toEqual([opened.entries, true])
      await markApp(page); await page.goForward(); await remounted(page)
      const fwd = await whole(page, "Forward is still the node's page")
      expect(fwd.address, "Forward is still the node's page").toBe(opened.address)
      void j
    })

    // F8 (BGCLOSE-R2; the reader of PR #446): A ROLL PLAYED AFTER BACK IS FILED BY THE NEXT HISTORY STEP, WHATEVER ENTRY IT LANDS ON.
    // F4 handed the shelf on, but only what was filed: a step onto a node page filed the roll under way, a step onto the closed map
    // did not (the reader: close, Back, two moves, Forward: the shelf held the first roll only; from the closed map a node, two
    // moves, Back: empty). Mutants: E1 the roll not filed at the step → red at "Forward: Last rolls holds both rolls"; E2 filed twice
    // → red at "it is filed once"; E3 filed when nothing was played → red at "after Forward, Last rolls still holds it" (above).
    if (size.width !== 1440) test(`a roll played after Back is filed by the next history step onto the closed map: Last rolls holds both rolls, in order (${size.width})`, async ({ page }) => {
      const { j } = await arrived(page)
      const a = await twoMoves(page, j)
      const at = await bare(page)
      expect(at, "premise: a point of bare map").not.toBeNull()
      await press(page, at!)
      await frames(page, 1500)
      expect(await shelfNow(page), "premise: the close filed the first roll").toEqual([a])
      await markApp(page); await page.goBack(); await remounted(page)
      await expect.poll(async () => { await frames(page, 300); const s = await seen(page); return !!s && !s.intro && !s.roam && s.hand > 0 }, { message: "premise: Back brings the page, a hand dealt", timeout: 30000 }).toBe(true)
      // the roll under way when the step comes, and the shelf as it stands: a roll that ended in this instance (a submission's
      // attempt ends the round, and the next roll begins) is filed by the instance itself, so it is on the shelf already
      const b = await twoMoves(page, j)
      const was = await shelfNow(page)
      expect(was[was.length - 1], "premise: the close's roll is on the shelf after Back").toEqual(a)
      await page.waitForTimeout(700)
      const before = await stored(page)
      await markApp(page); await page.goForward(); await remounted(page)
      await alone(page, "Forward is the closed map")
      expect(await shelfNow(page), "Forward: Last rolls holds both rolls, in order: the roll under way at the step first, then what was there").toEqual([b, ...was])
      await page.waitForTimeout(700)
      const by = await storedBy(page, before)
      expect([by.days.length, by.days[0]?.[1] - by.days[0]?.[0], by.other], "and it stored what a filing stores: the day's count up by one, nothing else").toEqual([1, 1, []])
    })
    if (size.width !== 1440) test(`from the closed map a node, a roll, Back onto the closed map files it; then two nodes, a roll, Back onto the first node's page files it once (${size.width})`, async ({ page }) => {
      const { j } = await arrived(page)
      const at = await bare(page)
      expect(at, "premise: a point of bare map").not.toBeNull()
      await press(page, at!)
      await frames(page, 800)
      expect(await shelfNow(page), "premise: the close filed nothing (nothing was played)").toEqual([])
      let node = await someNode(page)
      expect(node, "premise: a node is drawn on the closed map and pressable there").not.toBeNull()
      await press(page, node!)
      await whole(page, "premise: the node's page opens")
      const c = await twoMoves(page, j)
      const was = await shelfNow(page)   // a roll that ended in this instance is filed by it (see the journey above)
      await page.waitForTimeout(700)
      let before = await stored(page)
      await markApp(page); await page.goBack(); await remounted(page)
      await alone(page, "Back onto the closed map is the map alone")
      const held = await shelfNow(page)
      expect(held, "Back onto the closed map: Last rolls holds that roll").toEqual([c, ...was])
      await page.waitForTimeout(700)
      let by = await storedBy(page, before)
      expect([by.days.length, by.days[0]?.[1] - by.days[0]?.[0], by.other], "and it stored what a filing stores: the day's count up by one, nothing else").toEqual([1, 1, []])
      node = await someNode(page)
      expect(node, "premise: a node is drawn on the closed map").not.toBeNull()
      await press(page, node!)
      await whole(page, "premise: a node again: its page opens")
      expect(await shelfNow(page), "a node again: Last rolls still holds that roll, and nothing more").toEqual(held)
      const n2 = await page.evaluate(() => location.pathname)
      node = await someNode(page)
      expect(node, "premise: another node is drawn and pressable").not.toBeNull()
      await press(page, node!)
      await whole(page, "premise: the second node's page opens")
      const d = await twoMoves(page, j)
      const was2 = await shelfNow(page)
      await page.waitForTimeout(700)
      before = await stored(page)
      await markApp(page); await page.goBack(); await remounted(page)
      await expect.poll(async () => { await frames(page, 300); const s = await seen(page); return !!s && !s.intro && s.address === n2 }, { message: "premise: Back onto the first node's page", timeout: 30000 }).toBe(true)
      expect(await shelfNow(page), "Back onto a node page files the roll, and it is filed once").toEqual([d, ...was2])
      await page.waitForTimeout(700)
      by = await storedBy(page, before)
      expect([by.days.length, by.days[0]?.[1] - by.days[0]?.[0], by.other], "and it stored what a filing stores, once: the day's count up by one, nothing else").toEqual([1, 1, []])
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

      // the account's menu: opened from the drawer's foot, shut by a press on the bare map, which does nothing more. BY MOUSE ONLY
      // (BGCLOSE-R1): on a phone the drawer is the screen, the menu's outside is the 46 px strip beside it, and a tap there is the
      // drawer's own way out, pinned by "the tap that shuts the drawer shuts the drawer and nothing else" below; after a film the
      // article fills most of that strip, and the neutral control found no point of bare map there on 3 runs of 75. Mutant C10 was
      // red only at the two mouse sizes anyway (the phone's tap is consumed whatever closed the menu).
      if (size.touch) { void was; return }
      if (!(await seen(page)).drawer) await pressOn(page, ".ng-logo", "the logo")
      await j.advance(600)
      await pressOn(page, ".ngAcctChip", "the account's badge")
      await expect.poll(async () => (await seen(page)).menu, { message: "premise: the account's menu is open" }).toBe(true)
      const before = await seen(page)
      const out = await bare(page, 360)
      expect(out, "premise: a point of bare map beside the drawer").not.toBeNull()
      await press(page, out!)
      await j.advance(800)
      const shut = await seen(page)
      expect([shut.menu, shut.sections > 3, shut.question, shut.hand, shut.address, shut.entries, shut.roam], "the menu is shut and the page is whole: that press closed the menu and nothing else")
        .toEqual([false, true, true, before.hand, before.address, before.entries, false])
      void was
    })

    // F6 (BGCLOSE-R1; the reader of PR #446, its surviving mutant K2): THE OTHER HALF OF THE SPENT PRESS. A press that closes a menu
    // or ends a film does its one thing on the bare map (the journey above); on a NODE it does what it always did: the menu shuts (or
    // the film ends) AND the node is staged, as on dev (the reader measured it on both builds). Mutant K2: the tap router does nothing
    // after a spent press, node or not → red at each "…and the node is staged". By mouse: on a phone the drawer is the screen, and
    // its tap is the drawer's own (pinned above).
    if (!size.touch) test(`a press on a node with a menu open, or during a film, shuts the menu or ends the film and stages the node, as before (${size.width})`, async ({ page }) => {
      const { j } = await arrived(page)
      // the node's page, either half: during a film the map names the place it shows, and a press on a pair whose halves are drawn
      // under 8 px apart takes the NAMED half (L3-R1, T7, attachInput), so the press on K-Guard's top orb may open K-Guard Bottom
      const place = (path: string) => path.replace(/\/(Top|Bottom|Attacker|Defender)$/, "")
      const staged = async (what: string, node: { idx: number }) => {
        const s = await whole(page, `${what}: the node is staged`)
        const own = await page.evaluate((i) => (window as W).__neural._nodeUrlPath(i) as string, node.idx)
        expect([place(s.address), s.roam], `${what}: the node is staged, its page open at its own address`).toEqual([place(own), false])
      }
      // THE ACCOUNT'S MENU
      await pressOn(page, ".ng-logo", "the logo")
      await frames(page, 600)
      await pressOn(page, ".ngAcctChip", "the account's badge")
      await expect.poll(async () => (await seen(page)).menu, { message: "premise: the account's menu is open" }).toBe(true)
      let node = await someNode(page)
      expect(node, "premise: a node is drawn beside the drawer and pressable").not.toBeNull()
      await press(page, node!)
      await frames(page, 800)
      expect((await seen(page)).menu, "with the account's menu open, a press on a node shuts the menu").toBe(false)
      await staged("with the account's menu open, a press on a node shuts the menu, and the node is staged", node!)
      // A LIST MENU, from the seat's star
      if ((await seen(page)).drawer) { await pressOn(page, ".ng-explorer-close", "shut the drawer"); await frames(page, 1500) }
      await expect(page.locator("[data-seat-star]").first(), "premise: the seat's star is on the map").toBeVisible()
      await pressOn(page, "[data-seat-star]", "the seat's star")
      await frames(page, 600)
      await expect(page.locator("[data-list-picker]"), "premise: the list menu is open").toHaveCount(1)
      node = await someNode(page)
      expect(node, "premise: another node is drawn and pressable").not.toBeNull()
      await press(page, node!)
      await frames(page, 800)
      await expect(page.locator("[data-list-picker]"), "with a list menu open, a press on a node shuts it").toHaveCount(0)
      await staged("with a list menu open, a press on a node shuts it, and the node is staged", node!)
      // A FILM: a filed roll (one move, then the board put back on its first state), its film started from Last rolls
      await j.rig("resolve", [0.01]); await j.rig("outcome", [0.01])
      const titles = await j.optionTitles()
      await j.pick(titles[0]); await j.nextHand()
      await page.evaluate(() => { const a = (window as W).__neural; a.rollFromPosition(a.rollLog[0].idx, false, a.rollLog[0].role) })
      await j.advance(2500)
      for (let i = 0; i < 6; i++) { const left = await page.evaluate(() => { const b = document.querySelector("[data-reward-close]") as HTMLElement | null; if (b) b.click(); return document.querySelectorAll("[data-reward-close]").length }); if (!left) break; await page.waitForTimeout(60) }
      const ts = await page.evaluate(() => ((window as W).__neural._pastRolls || [])[0]?.ts as number)
      expect(ts, "premise: a roll is filed").toBeGreaterThan(0)
      await pressOn(page, ".ng-logo", "the logo")
      await pressOn(page, '[data-view="history"]', "Last rolls")
      await pressOn(page, `[data-replay-roll="${ts}"]`, "the filed roll's replay control")
      await j.advance(1500)
      expect((await seen(page)).film, "premise: a film is running").toBe(true)
      node = await someNode(page)
      expect(node, "premise: a node is drawn beside the drawer and pressable").not.toBeNull()
      await press(page, node!)
      await frames(page, 800)
      expect((await seen(page)).film, "during a film, a press on a node ends the film").toBe(false)
      await staged("during a film, a press on a node ends the film, and the node is staged", node!)
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

test.describe("the closed entry reloaded, 1074x796 by mouse", () => {
  test.use({ viewport: { width: 1074, height: 796 } })
  // "A reload at the root does what the root does today; that is not changed" (the ruling). History's state outlives a
  // reload, so the reloaded root still carries the close's mark; only a REMOUNT in the same document stands the map alone.
  test("a reload on the closed entry does what the root does: a roll at a start position, its own address, not the map alone", async ({ page }) => {
    const { j } = await arrived(page)
    const at = await bare(page)
    await page.mouse.click(at!.x, at!.y)
    await j.advance(600)
    const shut = await seen(page)
    expect([partsOf(shut), shut.address, shut.mark], "premise: one press closed the page, the address the root, the entry marked").toEqual([NOTHING, "/", true])
    await page.reload()
    await expect.poll(async () => { await frames(page, 500); const s = await seen(page); return !!s && !s.intro }, { message: "premise: the reloaded app's opening is over", timeout: 30000 }).toBe(true)
    await expect.poll(async () => { await frames(page, 500); const s = await seen(page); return !!s && s.hand > 0 }, { message: "a reload on the closed entry deals the root's own roll", timeout: 30000 }).toBe(true)
    const s = await seen(page)
    expect([s.roam, s.states, s.address !== "/"], "a reload on the closed entry does what the root does: a roll at a start position, the address that position's").toEqual([false, 1, true])
  })
})

// F3 (BGCLOSE-R1; the reader of PR #446): A TOUCH THE SYSTEM CANCELS IS NOT A PRESS. A touch started and cancelled without moving
// (the reader's own way: CDP touchStart, 120 ms, touchCancel) was routed as a tap: on the bare map it closed the page; on dev
// v1.293.4 it took the ladder's first step (the question). Now it ends the gesture and presses nothing, on the bare map and on a
// node. Mutant R3: the cancel routed as a tap again → red at "a cancelled touch on the bare map closes nothing".
test.describe("a touch the system cancels, 390x631 by touch", () => {
  test.use({ viewport: { width: 390, height: 631 }, hasTouch: true, isMobile: true })
  test("a cancelled touch is not a press: on the bare map it closes nothing, on a node it opens nothing", async ({ page }) => {
    const { j, was } = await arrived(page)
    const cdp = await page.context().newCDPSession(page)
    const cancelAt = async (at: { x: number; y: number }) => {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: at.x, y: at.y }] })
      await page.waitForTimeout(120)
      await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] })
      await frames(page, 600)
    }
    const from = await beatCount(page)
    const at = await bare(page)
    expect(at, "premise: a point of bare map").not.toBeNull()
    await cancelAt(at!)
    const after = await seen(page)
    expect([after.sections > 3, after.question, after.videos, after.hand, after.address, after.entries, after.roam], "a cancelled touch on the bare map closes nothing: the page whole, its address, no entry")
      .toEqual([true, true, true, was.hand, PAGE, was.entries, false])
    expect((await beatsFrom(page, from)).filter((b) => ["land_q_declined", "land_dismissed", "roam_entered"].includes(b)), "and declines nothing").toEqual([])
    const node = await someNode(page)
    expect(node, "premise: a node is drawn on the map and pressable there").not.toBeNull()
    await cancelAt(node!)
    const onNode = await seen(page)
    expect([onNode.stands, onNode.address, onNode.entries, onNode.roam], "a cancelled touch on a node opens nothing: the board, the address and the history as they were").toEqual([was.stands, PAGE, was.entries, false])
    // the control: a real tap on that bare point closes the page (the cancel was the only difference)
    await page.touchscreen.tap(at!.x, at!.y)
    await frames(page, 600)
    expect([partsOf(await seen(page)), (await seen(page)).address], "the control: a tap there closes the page").toEqual([NOTHING, "/"])
    void j
  })
})

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
    const strip = await bareSoon(page, 344)
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
