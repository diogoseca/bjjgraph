import { test, expect, type Page } from "@playwright/test"
import { journey, type Journey } from "../dsl"

/**
 * THE LEGAL BOXES (LEGAL3, v1.264.0). Owner, U140 b (12 Nov 2026): "i really much like the short versions. the /privacy page / terms
 * page should be viewed with a toggle that reads 'Extended version' ... that reveals the extended versions with a click. users going to
 * /privacy /terms land in the shortened version modal too with the bjjgraph as usual in the bg ... the bjjgraph loading in the bg should
 * load after the modal content". Until v1.263 the boxes' words were typed in the app and drifted from the pages; the pages themselves
 * were unreadable with JavaScript (a roll started on top of them). The claims, one per test:
 *
 *   1. ARRIVAL: /privacy and /terms open the page's own short box as the app starts, BEFORE the map's data has arrived (graph-data held),
 *      at 390x844, 390x631 and 1440x900. Its title, date and short words are the page's (read from the served HTML here, never typed),
 *      the short words are DRAWN, every paragraph and list item of the page is in the box, the ✕ and the "Extended version" row are on
 *      screen and own their centres, and past the intro's hand-over nothing is dealt (the hold) on the page's own address and title.
 *   2. "Extended version" opens the rest of the page in the box (its first words drawn, the ✕ and the row still on screen), and pressed
 *      again folds it back.
 *   3. Closing the box on arrival starts the game as the home page does (a hand is dealt), the address moves on, and Back brings the box
 *      back on /privacy.
 *   4. A link to a section (/privacy#your-rights) opens the box extended, with that section's heading drawn inside it.
 *   5. From the account menu during a roll, the box opens in place over the paused game, the address does not change, and when it closes
 *      the roll is exactly where it was: same node, same hand, same clock readings within a tick (nothing archived or discarded).
 *   6. Over a LIVE roll (Settings reached from a hidden section's message, drawer shut), the box takes its own pause and gives it back:
 *      the clocks hold while it is up and run again once it closes (control).
 *
 * DRAWN and OWNS are polled for up to 5 s: the modal card enters with a 0.28 s fade (ngCardIn), and a single sample taken as the box
 * appears reads it half transparent (measured: opacity 0.51). The claim is about the box once it has settled.
 * Presses are a player's: a real touch tap at measured centres at 390 (elementFromPoint must name the control), the mouse at 1440.
 * What the harness does NOT serve: off-origin requests are aborted, and node dossier chunks are "{}" (claim 6 needs only the article
 * sections, which come from the page HTML). @curated: claim 1 only (about 1 s per viewport); the rest runs in e2e-full.
 *
 * Red-proof: see docs/Changelog-Archive.md (LEGAL3): one mutant per claim, each red at its named assertion. Survivors: none recorded.
 */

type W = Window & { __neural: any }
const VIEWPORTS = [
  { width: 390, height: 844, touch: true },
  { width: 390, height: 631, touch: true },
  { width: 1440, height: 900, touch: false },
]
const BOX = (kind: string) => `.ng-legal[data-legal="${kind}"]`
const TICK = 1000 / 60 + 1

/** The page as the server sent it, split the way the claim reads it: the "In short" section, else the opening before the first section. */
async function served(page: Page, path: string) {
  const html = await (await page.request.get(path)).text()
  return page.evaluate((html) => {
    const doc = new DOMParser().parseFromString(html, "text/html"), norm = (s: string) => (s || "").replace(/\s+/g, " ").trim()
    const art = doc.querySelector("#quartz-root article") || doc.querySelector("article")!
    art.querySelectorAll("script,style,svg").forEach((n) => n.remove())
    const kids = [...art.children], date = kids.find((n) => n.tagName === "P" && /^effective date/i.test(norm(n.textContent!)))
    const at = kids.findIndex((n) => n.tagName === "H2" && /^in short$/i.test(norm(n.textContent!)))
    const short: Element[] = []
    if (at >= 0) for (let i = at + 1; kids[i] && kids[i].tagName !== "H2"; i++) short.push(kids[i])
    else for (const n of kids) { if (n.tagName === "H2") break; if (n !== date) short.push(n) }
    const blocks = (els: Element[]) => els.flatMap((e) => e.matches("p,li") ? [e] : [...e.querySelectorAll("p,li")]).map((e) => norm(e.textContent!)).filter(Boolean)
    const rest = kids.filter((n) => n !== date && !short.includes(n) && !(at >= 0 && n === kids[at]))
    const words = (s: string) => s.split(" ").slice(0, 4).join(" ")
    return {
      title: norm(doc.querySelector("h1.article-title")?.textContent || ""), tab: doc.title,
      date: date ? norm(date.textContent!).replace(/^effective date:?\s*/i, "") : "",
      shortBlocks: blocks(short), allBlocks: blocks(kids.filter((n) => n !== date)),
      shortFirst: words(blocks(short)[0] || ""), restFirst: words(blocks(rest)[0] || ""),
      h2: Object.fromEntries([...art.querySelectorAll("h2[id]")].map((h) => [h.id, norm(h.textContent!)])),
    }
  }, html)
}

/** DRAWN: the phrase's first word laid out in the viewport, topmost at its centre, nothing above it hidden or transparent. */
async function drawn(page: Page, phrase: string, scope: string) {
  return page.evaluate(([phrase, scope]) => {
    const root = document.querySelector(scope); if (!root) return "no " + scope
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let node: Text | null = null
    for (let n = walk.nextNode(); n; n = walk.nextNode()) if ((n.parentElement!.closest("li,p,h2,h3")?.textContent || "").replace(/\s+/g, " ").includes(phrase)
      && (n.textContent || "").includes(phrase.split(" ")[0])) { node = n as Text; break }
    if (!node) return "not in " + scope
    const at = node.textContent!.indexOf(phrase.split(" ")[0]), range = document.createRange()
    range.setStart(node, at); range.setEnd(node, at + phrase.split(" ")[0].length)
    const r = range.getClientRects()[0]; if (!r || r.width < 1) return "no box"
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2), host = node.parentElement!
    let opacity = 1, hidden = ""
    for (let e: Element | null = host; e; e = e.parentElement) { const cs = getComputedStyle(e); opacity *= Number(cs.opacity); if (cs.visibility !== "visible" || cs.display === "none") hidden = e.tagName }
    if (r.top < 0 || r.bottom > innerHeight || r.left < 0 || r.right > innerWidth) return "outside the viewport " + JSON.stringify(r)
    if (!hit || !(hit === host || host.contains(hit))) return `under <${hit?.tagName.toLowerCase()} class="${hit?.className}">`
    return hidden ? "hidden at " + hidden : opacity < 0.95 ? "opacity " + opacity : ""
  }, [phrase, scope] as const)
}

/** A control on screen, owning its measured centre (the point a finger or the mouse lands on). */
async function owns(page: Page, sel: string) {
  return page.evaluate((sel) => {
    const el = [...document.querySelectorAll(sel)].find((e) => e.getClientRects().length) as HTMLElement | undefined
    if (!el) return { why: "no " + sel, x: 0, y: 0 }
    const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2
    if (r.top < 0 || r.bottom > innerHeight || r.left < 0 || r.right > innerWidth) return { why: "off screen " + JSON.stringify(r), x, y }
    const hit = document.elementFromPoint(x, y)
    return { why: hit && (hit === el || el.contains(hit)) ? "" : `elementFromPoint is <${hit?.tagName.toLowerCase()} class="${hit?.className}">`, x, y }
  }, sel)
}
async function press(page: Page, j: Journey, sel: string, touch: boolean, what: string) {
  if (!touch) return j.clickByMouse(sel, what)
  const o = await owns(page, sel)
  expect(o.why, `${what}: a tap at its measured centre reaches it`).toBe("")
  await page.touchscreen.tap(o.x, o.y)
}

/** The roll as the app holds it: where, the hand by identity, and its clocks (the game timers hold while paused; the question clock never does). */
const roll = (page: Page) => page.evaluate(() => {
  const a = (window as W).__neural
  return { path: location.pathname, title: document.title, pos: a.currentPos ?? null, hold: !!a._legalHold, introDone: !!a.introDone, paused: !!a.paused,
    hand: [...document.querySelectorAll("[data-tech]")].map((e) => e.getAttribute("data-tech")).join("|"), landCard: !!a._landEl,
    // the roll's own timers: an ignorePause timer (UI, by design) runs behind any pause, so it says nothing about the hold
    timers: (a._timers || []).filter((t: any) => !t.ignorePause).map((t: any) => t.remaining), decision: a._decision?.remaining ?? null, box: !!document.querySelector(".ng-modal .ng-legal") && a.modalRef.current.style.display === "flex" }
})
const sameClocks = (a: { timers: number[], decision: number | null }, b: { timers: number[], decision: number | null }) =>
  a.timers.length === b.timers.length && a.timers.every((t, i) => Math.abs(t - b.timers[i]) <= TICK) && (a.decision == null ? b.decision == null : Math.abs(a.decision - b.decision!) <= TICK)

/** Claim 1's checks on an open box: the page's title, date and words, all of the page inside, its two controls owning their centres. */
async function expectPageBox(page: Page, path: string, label: string) {
  const s = await served(page, path), kind = path.slice(1).replace(/#.*/, "")
  expect(s.allBlocks.length, `premise: ${path} has paragraphs`).toBeGreaterThan(5)
  const box = page.locator(BOX(kind))
  await expect(box.locator("#ng-legal-h"), `${label}: the page's own title (the box head; the extended text has h2s of its own)`).toHaveText(s.title, { timeout: 30_000 })
  await expect(box.locator("[data-legal-sub]"), `${label}: the page's own date`).toContainText(s.date)
  const text = await box.evaluate((e) => (e.textContent || "").replace(/\s+/g, " "))
  const shortText = await box.locator("[data-legal-short]").evaluate((e) => (e.textContent || "").replace(/\s+/g, " "))
  expect(s.shortBlocks.filter((b) => !shortText.includes(b)), `${label}: the short part is the page's own`).toEqual([])
  expect(s.allBlocks.filter((b) => !text.includes(b)), `${label}: every paragraph and list item of the page is in the box`).toEqual([])
  await expect.poll(() => drawn(page, s.shortFirst, BOX(kind) + " [data-legal-short]"), { message: `${label}: "${s.shortFirst}" is drawn`, timeout: 5000 }).toBe("")
  for (const [sel, what] of [["[data-legal-close]", "the ✕"], ["[data-legal-more]", "Extended version"]])
    await expect.poll(async () => (await owns(page, BOX(kind) + " " + sel)).why, { message: `${label}: ${what} is on screen and owns its centre`, timeout: 5000 }).toBe("")
  return s
}

for (const vp of VIEWPORTS) {
  test.describe(`${vp.width}x${vp.height}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, ...(vp.touch ? { hasTouch: true } : {}) })

    test(`@curated arriving on /privacy and /terms opens the page's own short box before the map loads, and holds the roll (${vp.width}x${vp.height})`, async ({ page }) => {
      const errors: string[] = []; page.on("pageerror", (e) => errors.push(String(e)))
      const j = journey(page)
      for (const path of ["/privacy", "/terms"]) {
        await j.boot(path, { unready: true, payloads: { "graph-data.json": { never: true } } })
        await expect(page.locator(BOX(path.slice(1))), `${path}: the box is up`).toBeVisible({ timeout: 30_000 })
        expect(await page.evaluate(() => ((window as W).__neural.nodes || []).length), `${path}: before the map's data has arrived`).toBe(0)
        const s = await expectPageBox(page, path, path)
        j.releasePayload("graph-data.json")
        await page.waitForFunction(() => { const a = (window as W).__neural; return !!a?.nodes?.length && typeof a.advance === "function" }, undefined, { timeout: 120_000 })
        await j.advance(4000)   // past the intro's hand-over (3.2 s), where an arrival on "/" deals its first hand
        const r = await roll(page)
        expect({ path: r.path, title: r.title }, `${path}: its own address and the server's title`).toEqual({ path, title: s.tab })
        expect({ hold: r.hold, pos: r.pos, hand: r.hand, landCard: r.landCard, decision: r.decision }, `${path}: the hold: nothing dealt, no question clock`)
          .toEqual({ hold: true, pos: null, hand: "", landCard: false, decision: null })
        expect((await j.beats()).map((b) => b.beat).filter((b) => b === "options_dealt" || b === "roll_staged"), `${path}: no hand, nothing staged`).toEqual([])
        await expect(page.locator(BOX(path.slice(1))), `${path}: the box is still up`).toBeVisible()
      }
      expect(errors, "no page error").toEqual([])
    })

    test(`"Extended version" opens the rest of the page in the box and folds it back (${vp.width}x${vp.height})`, async ({ page }) => {
      const j = journey(page)
      await j.boot("/privacy"); await j.advance(4000)
      const s = await served(page, "/privacy"), ext = page.locator(BOX("privacy") + " [data-legal-ext]")
      await expect(ext, "folded at first").toBeHidden()
      await press(page, j, "[data-legal-more]", vp.touch, "Extended version")
      await expect(ext, "the rest of the page opens in the box").toBeVisible()
      await expect(page.locator("[data-legal-more]")).toHaveAttribute("aria-expanded", "true")
      await expect.poll(() => drawn(page, s.restFirst, BOX("privacy") + " [data-legal-ext]"), { message: `the rest starts on screen: "${s.restFirst}"`, timeout: 5000 }).toBe("")
      for (const sel of ["[data-legal-close]", "[data-legal-more]"]) await expect.poll(async () => (await owns(page, sel)).why, { message: `${sel} still on screen, owning its centre`, timeout: 5000 }).toBe("")
      await press(page, j, "[data-legal-more]", vp.touch, "Extended version, again")
      await expect(ext, "pressed again, it folds back").toBeHidden()
      await expect(page.locator("[data-legal-more]")).toHaveAttribute("aria-expanded", "false")
      await expect.poll(() => drawn(page, s.shortFirst, BOX("privacy") + " [data-legal-short]"), { message: "the short part is back on screen", timeout: 5000 }).toBe("")
    })

    test(`closing the box on arrival starts the game as the home page does, and Back brings the box back (${vp.width}x${vp.height})`, async ({ page }) => {
      const j = journey(page)
      await j.boot("/privacy"); await j.advance(4000)
      expect((await roll(page)).hold, "premise: the box holds the roll").toBe(true)
      await press(page, j, "[data-legal-close]", vp.touch, "the ✕")
      await j.advanceUntil("options_dealt", 16000)
      const r = await roll(page)
      expect({ box: r.box, hold: r.hold, played: r.pos != null && r.hand.length > 0 }, "the game starts: a hand is dealt").toEqual({ box: false, hold: false, played: true })
      expect(r.path, "the address moves on with the game").not.toBe("/privacy")
      await page.goBack()
      await expect(page.locator(BOX("privacy")), "Back brings the box back").toBeVisible({ timeout: 30_000 })
      expect(new URL(page.url()).pathname, "on its own address").toBe("/privacy")
    })

    test(`from the menu during a roll the box opens in place, and the roll is exactly where it was when it closes (${vp.width}x${vp.height})`, async ({ page }) => {
      const j = journey(page)
      await j.boot("/"); await j.land("Mount Top")
      const beats0 = (await j.beats()).length
      for (const [sel, kind] of [["[data-menu-privacy]", "privacy"], ["[data-menu-terms]", "terms"]]) {
        await j.openAccountMenu()
        const before = await roll(page)
        expect(before.pos, "premise: a roll is standing somewhere").not.toBeNull()
        await press(page, j, sel, vp.touch, sel)
        await expectPageBox(page, "/" + kind, `${kind} from the menu`)
        expect(new URL(page.url()).pathname, `${kind}: the address does not change`).toBe(before.path)
        await j.advance(3000)
        await press(page, j, "[data-legal-close]", vp.touch, "the ✕")
        const after = await roll(page)
        expect({ path: after.path, pos: after.pos, hand: after.hand }, `${kind}: same address, node and hand`).toEqual({ path: before.path, pos: before.pos, hand: before.hand })
        expect(sameClocks(before, after), `${kind}: the same clock readings within a tick (${JSON.stringify([before.timers, before.decision])} -> ${JSON.stringify([after.timers, after.decision])})`).toBe(true)
      }
      expect((await j.beats()).slice(beats0).map((b) => b.beat).filter((b) => b === "roll_archived" || b === "roll_discarded"), "nothing archived or discarded").toEqual([])
    })
  })
}

test.describe("390x631, a link to a section", () => {
  test.use({ viewport: { width: 390, height: 631 }, hasTouch: true })
  test("a link to a section opens the box extended at that section", async ({ page }) => {
    const j = journey(page)
    await j.boot("/privacy#your-rights"); await j.advance(1000)
    const s = await served(page, "/privacy")
    expect(s.h2["your-rights"], "premise: the page has that section").toBeTruthy()
    await expect(page.locator(BOX("privacy")), "the box opens extended").toHaveAttribute("data-open", "")
    await expect.poll(() => drawn(page, s.h2["your-rights"], BOX("privacy") + " [data-legal-ext]"), { message: `"${s.h2["your-rights"]}" is drawn in the box`, timeout: 5000 }).toBe("")
    const inBody = await page.evaluate(() => { const b = document.querySelector("[data-legal-body]")!.getBoundingClientRect(), h = document.querySelector('[data-legal-ext] [data-legal-id="your-rights"]')!.getBoundingClientRect()
      return h.top >= b.top && h.bottom <= b.bottom })
    expect(inBody, "inside the box's own scrolling text").toBe(true)
  })
})

for (const vp of [VIEWPORTS[0], VIEWPORTS[2]]) {
  test.describe(`${vp.width}x${vp.height}, over a live roll`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, ...(vp.touch ? { hasTouch: true } : {}) })
    test(`over a live roll the box takes its own pause and gives it back (${vp.width}x${vp.height})`, async ({ page }) => {
      const j = journey(page)
      await j.boot("/"); await j.land("Mount Top")
      await expect(page.locator('[data-reader][data-reader-ready="true"]')).toBeVisible({ timeout: 20_000 })
      const close = "[data-section-toggle=principles]"
      await page.evaluate((sel) => { const root = document.querySelector("[data-reader]") as HTMLElement, el = document.querySelector(sel) as HTMLElement
        root.scrollTop += el.getBoundingClientRect().top - root.getBoundingClientRect().top - 140 }, close)
      await j.readerLayoutSettled()
      expect((await roll(page)).paused, "premise: the roll is live (not paused)").toBe(false)
      await press(page, j, close, vp.touch, "a section's ✕")
      await j.readerLayoutSettled()
      await press(page, j, '[data-hidesec-notice="principles"] [data-hidesec-settings]', vp.touch, "its message's Settings")
      await expect(page.locator('[data-settings-legal] [data-legal="terms"]'), "Settings is up").toBeVisible({ timeout: 10_000 })
      expect(await page.evaluate(() => !!(window as W).__neural.deckShown), "premise: the drawer is shut (nothing else holds the roll)").toBe(false)
      await press(page, j, '[data-settings-legal] [data-legal="terms"]', vp.touch, "Terms in Settings")
      await expectPageBox(page, "/terms", "terms over a live roll")
      const held = await roll(page)
      expect(held.timers.length, "premise: the roll has a clock to hold").toBeGreaterThan(0)
      await j.advance(3000)
      const still = await roll(page)
      expect({ paused: still.paused, pos: still.pos, hand: still.hand }, "the box holds the roll").toEqual({ paused: true, pos: held.pos, hand: held.hand })
      expect(sameClocks(held, still), "its clocks hold while the box is up").toBe(true)
      await press(page, j, "[data-legal-close]", vp.touch, "the ✕")
      expect((await roll(page)).paused, "closing gives the pause back").toBe(false)
      const t0 = (await roll(page)).timers
      await j.advance(500)
      const t1 = (await roll(page)).timers
      expect(t0.some((t, i) => t1[i] === undefined || t1[i] < t - 400), `control: the clock runs again (${JSON.stringify(t0)} -> ${JSON.stringify(t1)})`).toBe(true)
    })
  })
}
