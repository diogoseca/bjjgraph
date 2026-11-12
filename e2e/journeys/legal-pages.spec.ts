import { test, expect, type Page, type BrowserContext } from "@playwright/test"
import { journey, type Journey } from "../dsl"

/**
 * THE SITE'S LEGAL PAGES ARE READ, NOT PLAYED (LEGAL1, v1.263.0). Owner, 12 Nov 2026: "either build a privacy page and a terms
 * page at once, or explain why this is necessary". Until this version a visitor with JavaScript who opened /privacy or /terms
 * (the pages the Google sign-in consent screen links to) got a random roll: the app hid the text, the address moved to
 * /Positions/<something> and the title followed. The account menu's "Terms" and "Privacy" opened two short boxes written apart
 * from the pages, which said things the pages do not. The claims, one per test:
 *
 *   1. Opened cold, at 390x844 and 1440x900, each page keeps its own address and the title the server sent, no roll starts past
 *      the intro's hand-off (3.2 s of game time), and the page's own first words are DRAWN: inside the viewport, topmost where
 *      they sit (elementFromPoint), nothing above them hidden or transparent. Every paragraph and list item the server sent is
 *      in the reader.
 *   2. Nothing on them can be closed or hidden: no section has a ✕, the opening is not "How it works", and a player's saved
 *      "closed" for the section types the legal sections share (overview, additional) hides no tile.
 *   3. "Start rolling", pressed by mouse at 1440 and by a finger at 390, is the way into the game: the front door, then a roll.
 *   4. The account menu's Terms and Privacy, pressed during a roll by mouse at 1440 and by a finger at 390, open the page in a NEW
 *      TAB, which lands on its text; this tab's roll is untouched (same seat, nothing archived or discarded, the menu closed).
 *
 * The server's facts (title, paragraphs, first words) are read from the served HTML on every run, never typed here: another PR
 * owns the wording. What the harness does NOT serve: off-origin requests are aborted (the popup's too, by the context route
 * below), and the popup runs without __NEURAL_TEST__, on the real clock, as a visitor's new tab does.
 *
 * @curated (the deploy gate) only on claim 1: these are the pages the Google sign-in consent screen links to, and it costs about
 * 1.2 s per width. Claims 2 to 4 run in the PR's e2e-full (the menu test is ~9.5 s per input).
 *
 * Red-proof (each mutant against this build, the named test red, the rest of this file green; see docs/Changelog-Archive.md,
 * LEGAL1): the arrival line in `_seedFromUrl` deleted (claim 1, both widths); the reader root at opacity 0 on a legal page
 * (claim 1's drawn check alone: the DOM checks stay green); the legal pages taken out of the reader's REFERENCE (claim 1, the
 * heading is not drawn); `SITE.test(this.path) ||` dropped where the reader decides a section is shown, the opening
 * titled, the ✕ put back (claim 2, one each); "Start rolling" made a no-op (claim 3); the menu link's `target` emptied, and its
 * close listener dropped (claim 4, mouse and finger).
 */

const PAGES = ["/privacy", "/terms"] as const
type W = Window & { __neural: any }

/** The server's own page, read the way the crawler reads it. */
async function served(page: Page, path: string) {
  const html = await (await page.request.get(path)).text()
  return page.evaluate((html) => {
    const doc = new DOMParser().parseFromString(html, "text/html"), norm = (s: string) => s.replace(/\s+/g, " ").trim()
    const article = doc.querySelector("article")!
    const blocks = [...article.querySelectorAll("p, li")].map((e) => norm(e.textContent || "")).filter(Boolean)
    const paras = [...article.querySelectorAll(":scope > p")].map((e) => norm(e.textContent || ""))
    return { title: doc.title, h1: norm(doc.querySelector("h1")?.textContent || ""), blocks, h2: [...article.querySelectorAll("h2")].map((e) => norm(e.textContent || "")),
      // the first words of the first two paragraphs: the effective date, then the opening sentence
      firstWords: paras.slice(0, 2).map((p) => p.split(" ").slice(0, 4).join(" ")) }
  }, html)
}

/** Is this phrase DRAWN: laid out inside the viewport, topmost at its own centre, nothing above it hidden or transparent? */
async function drawn(page: Page, phrase: string, scope = "[data-reader-path]") {
  return page.evaluate(([phrase, scope]) => {
    const root = document.querySelector(scope)
    if (!root) return { why: "no " + scope }
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    let node: Text | null = null
    for (let n = walk.nextNode(); n; n = walk.nextNode()) if ((n.textContent || "").replace(/\s+/g, " ").includes(phrase)) { node = n as Text; break }
    if (!node) return { why: "not in the reader" }
    const at = node.textContent!.indexOf(phrase.split(" ")[0]), range = document.createRange()
    range.setStart(node, at); range.setEnd(node, at + phrase.split(" ")[0].length)
    const r = range.getClientRects()[0]
    if (!r || r.width < 1) return { why: "no box" }
    const x = r.left + r.width / 2, y = r.top + r.height / 2, hit = document.elementFromPoint(x, y), host = node.parentElement!
    let opacity = 1, hidden = ""
    for (let e: Element | null = host; e; e = e.parentElement) {
      const cs = getComputedStyle(e); opacity *= Number(cs.opacity)
      if (cs.visibility !== "visible" || cs.display === "none") hidden = e.tagName + "." + e.className
    }
    const inView = r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth
    const top = !!hit && (hit === host || host.contains(hit))
    return { why: !inView ? `outside the viewport ${JSON.stringify(r)}` : !top ? `under <${hit?.tagName.toLowerCase()} class="${hit?.className}">`
      : hidden ? `hidden at ${hidden}` : opacity < 0.95 ? `opacity ${opacity}` : "", x, y }
  }, [phrase, scope] as const)
}

/** The roll's own record, read from the app. */
const rollState = (page: Page) => page.evaluate(() => {
  const a = (window as W).__neural
  return { path: location.pathname, title: document.title, pos: a.currentPos ?? null, played: !!a._played, ref: !!a._refPage,
    landCard: !!a._landEl, hand: document.querySelectorAll("[data-tech]").length, rollLog: (a.rollLog || []).length,
    readerPath: a._reader?.root.dataset.readerPath ?? null, introDone: !!a.introDone }
})

/** A finger on the control's measured centre, refused if anything else owns that point (clickByMouse's rule, for touch). */
async function tapByTouch(page: Page, sel: string, what: string) {
  const hit = await page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement | null
    if (!el) return { x: 0, y: 0, why: "no element matches" }
    const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2
    if (r.width < 1 || x < 0 || y < 0 || x > innerWidth || y > innerHeight) return { x, y, why: "off screen " + JSON.stringify(r) }
    const top = document.elementFromPoint(x, y)
    return { x, y, why: top && (top === el || el.contains(top)) ? "" : `elementFromPoint is <${top?.tagName.toLowerCase()} class="${top?.className}">` }
  }, sel)
  expect(hit.why, `${what} is reachable by a finger where it sits`).toBe("")
  await page.touchscreen.tap(hit.x, hit.y)
}

/** The popup is a new page: give it the harness's hermetic rule (local only, fonts empty) through the context. */
async function hermetic(ctx: BrowserContext) {
  await ctx.route("**/*", (r) => {
    const u = r.request().url()
    if (/^(http:\/\/localhost|http:\/\/127\.|data:|blob:|about:)/.test(u)) return r.continue()
    if (/fonts\.(googleapis|gstatic)\.com/.test(u)) return r.fulfill({ status: 200, contentType: "text/css", body: "" })
    return r.abort()
  })
}

/** Claim 1 on any page showing a legal page: its address, the server's title, no roll, its words drawn and all there. */
async function expectReadable(page: Page, path: string, label: string) {
  const s = await served(page, path)
  expect(s.blocks.length, `premise: the server's ${path} has paragraphs`).toBeGreaterThan(5)
  await expect(page.locator('[data-reader-ready="true"]'), `${label}: the reader holds ${path}`).toHaveAttribute("data-reader-path", path, { timeout: 60_000 })
  const st = await rollState(page)
  expect({ path: st.path, title: st.title }, `${label}: its own address and the server's title`).toEqual({ path, title: s.title })
  expect({ pos: st.pos, played: st.played, landCard: st.landCard, hand: st.hand }, `${label}: no roll`).toEqual({ pos: null, played: false, landCard: false, hand: 0 })
  const text = await page.locator(".ng-reader-article").evaluate((e) => (e.textContent || "").replace(/\s+/g, " "))
  expect(s.blocks.filter((b) => !text.includes(b)), `${label}: every paragraph and list item the server sent`).toEqual([])
  // the page's own heading (a reference page shows its h1; a game page keeps it for screen readers only) and its first words
  expect((await drawn(page, s.h1, ".ng-reader-head h1")).why, `${label}: its heading "${s.h1}" is drawn on screen`).toBe("")
  for (const words of s.firstWords) expect((await drawn(page, words, ".ng-reader-article [data-reader-body]")).why, `${label}: "${words}" is drawn on screen`).toBe("")
}

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test.describe(`at ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport, ...(viewport.width === 390 ? { hasTouch: true } : {}) })

    test(`@curated /privacy and /terms opened cold keep their address, title and text, and start no roll`, async ({ page }) => {
      const errors: string[] = []; page.on("pageerror", (e) => errors.push(String(e)))
      const j = journey(page)
      for (const path of PAGES) {
        await j.boot(path)
        await expect(page.locator('[data-reader-ready="true"]')).toHaveAttribute("data-reader-path", path, { timeout: 60_000 })
        // past the intro's hand-off (3.2 s), where an unseeded arrival used to call startRoll()
        await j.advance(4000)
        expect((await rollState(page)).introDone, "premise: the intro has handed over").toBe(true)
        await j.readerLayoutSettled()
        await expectReadable(page, path, path)
        const beats = (await j.beats()).map((b) => b.beat)
        expect(beats.filter((b) => b === "options_dealt" || b === "roll_staged"), `${path}: no hand dealt, nothing staged`).toEqual([])
        // the way into the game is on screen with the page
        await expect(page.locator("[data-reader-play]"), `${path}: Start rolling`).toHaveText("Start rolling")
      }
      expect(errors, "no page error").toEqual([])
    })

    test(`"Start rolling" on a legal page goes to the front door, where a roll starts`, async ({ page }) => {
      const j = journey(page)
      await j.boot("/terms")
      await expect(page.locator('[data-reader-ready="true"]')).toHaveAttribute("data-reader-path", "/terms", { timeout: 60_000 })
      await j.advance(4000); await j.readerLayoutSettled()
      j.allowNavigation(/^http:\/\/localhost:\d+\/$/, "Start rolling is a whole load of the front door, by design")
      const nav = page.waitForURL((u) => u.pathname === "/")
      if (viewport.width === 390) await tapByTouch(page, "[data-reader-play]", "Start rolling")
      else await j.clickByMouse("[data-reader-play]", "Start rolling")
      await nav
      await page.waitForFunction(() => { const a = (window as W).__neural; return !!a?.nodes?.length && typeof a.advance === "function" }, undefined, { timeout: 120_000 })
      await j.advance(4500)
      const st = await rollState(page)
      expect(st.pos, "a roll is standing somewhere").not.toBeNull()
      expect(st.ref, "and it is not a page's reading posture").toBe(false)
    })
  })
}

test("nothing on a legal page can be closed, and a saved closed section hides none of it", async ({ page }) => {
  const j = journey(page)
  for (const path of PAGES) {
    // the two section types a legal page is made of, closed by this player elsewhere (a Learning page's ✕ writes the same keys)
    await j.boot(path, { initialState: { v: 2, settings: { "readerSection.overview": false, "readerSection.additional": false }, settingsAt: {} } })
    await expect(page.locator('[data-reader-ready="true"]')).toHaveAttribute("data-reader-path", path, { timeout: 60_000 })
    expect(await page.evaluate(() => (window as W).__neural.get("readerSection.additional", true)), "premise: the saved close is read").toBe(false)
    await j.advance(4000); await j.readerLayoutSettled()
    const tiles = await page.locator(".ng-reader-article .ng-section-card").evaluateAll((cards) =>
      cards.map((c) => ({ type: (c as HTMLElement).dataset.sectionType, shown: !(c as HTMLElement).hidden && (c as HTMLElement).offsetHeight > 0,
        title: c.querySelector(":scope > h2 .ng-section-title")?.textContent || null })))
    const s = await served(page, path)
    expect(tiles.length, `${path}: one tile for the opening and one per section`).toBe(s.h2.length + 1)
    expect(tiles.filter((t) => !t.shown), `${path}: every tile shows`).toEqual([])
    expect(tiles[0], `${path}: the opening has no title (it is not "How it works")`).toMatchObject({ type: "overview", title: null })
    expect(await page.locator(".ng-reader-article [data-section-toggle]").count(), `${path}: no section has a ✕`).toBe(0)
    expect(await page.locator('.ng-reader-toc [data-toc-type="overview"]').count(), `${path}: the index names no "How it works"`).toBe(0)
    await expectReadable(page, path, path + " with saved closes")
  }
})

for (const input of ["mouse", "touch"] as const) {
  const viewport = input === "touch" ? { width: 390, height: 844 } : { width: 1440, height: 900 }
  test.describe(`the account menu by ${input} at ${viewport.width}`, () => {
    test.use({ viewport, ...(input === "touch" ? { hasTouch: true } : {}) })

    test(`Terms and Privacy open their pages in a new tab; the roll here is untouched (${input})`, async ({ page, context }) => {
      const j = journey(page)
      await j.boot("/")
      await j.land("Mount Top")
      await hermetic(context)
      const before = await rollState(page)
      expect(before.pos, "premise: a roll is standing somewhere").not.toBeNull()
      const beats0 = (await j.beats()).length
      for (const [sel, path] of [["[data-menu-terms]", "/terms"], ["[data-menu-privacy]", "/privacy"]] as const) {
        await j.openAccountMenu()
        const popup = context.waitForEvent("page")
        if (input === "touch") await tapByTouch(page, sel, sel)
        else await j.clickByMouse(sel, sel)
        const tab = await popup
        await tab.waitForURL((u) => u.pathname === path)
        await tab.waitForFunction(() => !!(window as W).__neural?.introDone, undefined, { timeout: 60_000 })
        await expectReadable(tab, path, "the new tab")
        await tab.close()
        expect(await page.evaluate(() => { const m = document.querySelector(".ng-account-menu") as HTMLElement | null; return !!m && m.style.display !== "none" && m.dataset.open === "1" }),
          `${sel}: the menu closed`).toBe(false)
        const after = await rollState(page)
        expect({ path: after.path, pos: after.pos, ref: after.ref, rollLog: after.rollLog }, `${sel}: this tab's roll is where it was`)
          .toEqual({ path: before.path, pos: before.pos, ref: false, rollLog: before.rollLog })
        const beats = (await j.beats()).slice(beats0).map((b) => b.beat)
        expect(beats.filter((b) => b === "roll_archived" || b === "roll_discarded"), `${sel}: nothing archived or discarded`).toEqual([])
      }
    })
  })
}
