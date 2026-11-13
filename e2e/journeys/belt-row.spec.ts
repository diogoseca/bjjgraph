import { expect, test, type Page } from "@playwright/test"
import { readFileSync, readdirSync } from "node:fs"
import { resolve } from "node:path"
import { journey } from "../dsl"

/** THE BELT IN THE DRAWER ROW (v1.276.0, STAGE2; owner U159 a, U162 a, U169 c; the orchestrator's rulings STAGE2-GO).
 *
 * What a player SEES and what a press does, in a real browser on the served build, at 1440x900 by mouse and 390x631 by
 * touch: the drawer's "Master the game" row wears the belt (the held level, never below the Path's), the number only once
 * its live check has landed (a quiet placeholder of the number's width until then, so nothing jumps), rounded down, the
 * line of distances under it, the dip's second line when the number sits below what is worn, and a tap on the row still
 * opening today's session. Reading the row writes nothing but the one added value (`belts.lvl`), compared key by key.
 *
 * The law (the levels, the merge, the guest, the promotion, a reopen) is pinned headless in tests/belt_row.test.mjs with
 * its mutants; the words are pinned there from the rendered markup. This file pins the browser's half: the order of the
 * states, the layout at both widths, the press, and storage. The number is cross-checked against the unit construction of
 * the SAME record (tests/_rating_fixture.mjs, as rating-reader.spec.ts does), never recomputed here.
 *
 * NOT SERVED HERE: the cloud (a guest owner throughout); a sound for a promotion (there is none: a later design job).
 */

type W = any
const SERVED = resolve(__dirname, "../../source/public/static/neural")
const KEY = "bjj-neural-owner:guest:progress"

async function bootSeeded(page: Page, fx: { day: number; blob: Record<string, unknown> }) {
  await page.addInitScript((d) => { (window as W).__NG_EPOCH_DAY__ = d }, fx.day)
  const j = journey(page)
  await j.boot("/", { initialState: fx.blob })
  await expect.poll(() => page.evaluate(() => {
    const a = (window as W).__neural
    return !!(a && a.nodes && a.nodes.length && a.flashcards && a.flashcards.decks && a.curriculum && a.belts && a.belts.lvl)
  }), { timeout: 60_000, message: "graph, deck manifest, curriculum and the belt sync in" }).toBe(true)
  // the boot's own writes landed and storage holds still for 2 s (the seed rides the next save; flushed here on purpose so
  // the comparison below is about the ROW, not about the boot). The challenge-evidence pass runs here too: the harness's
  // boot completes the 20 White objectives IN MEMORY, and the pane's open runs that pass, which mints `white-foundations`
  // and saves (a HARNESS write: e2e/gen/holder-passive-boot-blob-fixpoint.spec.ts, "reload 1"). Run before the snapshot,
  // opening the drawer has nothing of its own left to write but the row's.
  await page.evaluate(() => { const a = (window as W).__neural; a._refreshChallengeEvidence(); a._flushSave() })
  let before = await stored(page)
  await expect.poll(async () => {
    await page.waitForTimeout(2_000)
    const now = await stored(page), still = JSON.stringify(now) === JSON.stringify(before)
    before = now
    return still
  }, { timeout: 30_000, intervals: [0], message: "storage holds still" }).toBe(true)
  return before
}
/** every storage key and value; the progress blob parsed, so it can be compared key by key */
const stored = (page: Page) => page.evaluate((k) => {
  const out: Record<string, unknown> = {}
  for (const st of [localStorage, sessionStorage]) for (const key of Object.keys(st).sort()) out[(st === localStorage ? "l:" : "s:") + key] = st.getItem(key)
  const raw = localStorage.getItem(k)
  return { keys: out, blob: raw ? JSON.parse(raw).blob : null }
}, KEY)

/** what the row shows, measured */
const rowState = (page: Page) => page.evaluate(() => {
  const el = document.querySelector("[data-belt-row]") as HTMLElement | null
  if (!el) return null
  const belt = el.querySelector(".ng-belt") as HTMLElement, num = el.querySelector(".ng-belt-num") as HTMLElement
  const lines = [...el.querySelectorAll("[data-belt-line] > div")].map((d) => (d as HTMLElement).innerText.replace(/ /g, " ").trim()).filter(Boolean)
  const clipped = [...el.querySelectorAll("[data-belt-line] > div, .ng-belt-num")].some((d) => (d as HTMLElement).scrollWidth > (d as HTMLElement).clientWidth + 1)
  const drawer = (el.closest("[data-explore-stats]") as HTMLElement | null)?.getBoundingClientRect()   // the list box it sits in
  const r = el.getBoundingClientRect(), b = belt.getBoundingClientRect(), n = num.getBoundingClientRect()
  return { state: el.getAttribute("data-belt-state"), belt: belt.getAttribute("data-belt"), stripes: belt.getAttribute("data-stripes"),
    number: num.getAttribute("data-belt-number"), hidden: getComputedStyle(num).visibility === "hidden", beltW: Math.round(b.width), numW: Math.round(n.width), lines, clipped,
    inside: !!drawer && drawer.width > 200 && (r.left >= drawer.left - 0.5 && r.right <= drawer.right + 0.5) }
})

async function press(page: Page, sel: string, what: string, touch: boolean) {
  const j = journey(page)
  if (!touch) return j.clickByMouse(sel, what)
  const at = await page.evaluate((s) => {
    const el = document.querySelector(s) as HTMLElement | null
    if (!el) return null
    const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2
    const top = document.elementFromPoint(x, y)
    return top && (top === el || el.contains(top)) ? { x, y } : null
  }, sel)
  expect(at, what + ": its centre is on screen and nothing covers it").not.toBeNull()
  await page.touchscreen.tap(at!.x, at!.y)
}

async function story(page: Page, touch: boolean) {
  const { ratingFixture, ratingApp } = await import("../../tests/_rating_fixture.mjs")
  const fx = ratingFixture(SERVED)
  const a = ratingApp(SERVED, "gi")
  a.srs = fx.blob.srs; a.stage = fx.blob.stage; a.moves = fx.blob.moves; a._epochDay = () => fx.day
  const want = a.rating()
  expect([want.status, want.final], "the unit's construction reads the record").toEqual(["ok", true])
  const shown = String(Math.floor(want.points))

  const before = await bootSeeded(page, fx)
  // hold both live files until the waiting row is asserted (registered after the boot: the newest route wins)
  let release!: () => void
  const gate = new Promise<void>((r) => { release = r })
  await page.route(/\/flashcards\/live-\d+\.json(\?.*)?$/, async (r) => {
    await gate
    const name = new URL(r.request().url()).pathname.split("/").pop()!
    await r.fulfill({ status: 200, contentType: "application/json", body: readFileSync(resolve(SERVED, "flashcards", name), "utf8") })
  })

  // 1. the drawer opens: the row wears the belt held, a quiet placeholder, no number, no line
  await press(page, ".ng-logo", "the drawer icon", touch)
  await expect(page.locator(".ng-drawer-head")).toBeVisible()
  await expect(page.locator("[data-belt-row]")).toHaveAttribute("data-belt-state", "wait")
  const waiting = (await rowState(page))!
  expect([waiting.belt, waiting.stripes, waiting.number, waiting.lines], "waiting: the belt held, no number, no line").toEqual(["white", "0", "", []])
  expect([waiting.hidden, waiting.numW > 20], "a quiet placeholder: invisible, the width of a number").toEqual([true, true])

  // 2. the check lands: the number, rounded down, and the line; nothing jumped
  release()
  await expect(page.locator("[data-belt-row]")).toHaveAttribute("data-belt-state", "ok", { timeout: 30_000 })
  const landed = (await rowState(page))!
  expect(landed.number, "the number: the unit's for the same record, rounded down").toBe(shown)
  expect([landed.beltW, landed.numW], "nothing jumps when it lands: the belt and the number's box keep their widths").toEqual([waiting.beltW, waiting.numW])
  expect(landed.lines.length, "one line of distances, no dip").toBe(1)
  expect(landed.lines[0]).toMatch(/^\d+ to (your (1st|2nd|3rd|4th) stripe( · \d+ to (blue|purple|brown|black))?|blue|purple|brown|black)$/)
  expect([landed.clipped, landed.inside], "no text clips, and the row stays inside the drawer").toEqual([false, true])

  // 3. reading the row wrote nothing but the added value (the boot's seed was flushed above, so only a rise can show)
  await page.waitForTimeout(2_500)
  const after = await stored(page)
  for (const k of new Set([...Object.keys(before.keys), ...Object.keys(after.keys)])) {
    if (k === "l:" + KEY) continue
    expect(after.keys[k], "storage key " + k + " byte-identical").toBe(before.keys[k])
  }
  const b0 = before.blob as W, b1 = after.blob as W
  for (const k of new Set([...Object.keys(b0), ...Object.keys(b1)])) {
    if (k === "updatedAt") continue
    if (k === "belts") { const { lvl: l0, ...r0 } = b0.belts, { lvl: l1, ...r1 } = b1.belts; expect(r1, "belts, but for the level").toEqual(r0); expect(l1.n).toBeGreaterThanOrEqual(l0.n); continue }
    expect(b1[k], "the blob's " + k + " is unchanged").toEqual(b0[k])
  }

  // 4. the row's hit target and its tap are unchanged: a press on the row opens today's session
  const hit = await page.evaluate(() => {
    const row = document.querySelector('[data-explore-stats] [data-b="due"]') as HTMLElement, belt = document.querySelector("[data-belt-row] .ng-belt") as HTMLElement
    const b = belt.getBoundingClientRect(), top = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2)
    return { h: Math.round(row.getBoundingClientRect().height), title: row.title, beltInRow: row.contains(top) }
  })
  expect(hit.h, "the row is the 40px row it was").toBe(40)
  expect(hit.beltInRow, "the belt sits under the row, not inside its button").toBe(false)
  expect(hit.title, "its tooltip says what a tap does").toMatch(/^Start today's session · /)
  await press(page, '[data-explore-stats] [data-b="due"]', "the Master the game row", touch)
  await expect(page.locator(".ng-drawer-brand"), "a tap opens today's session, named").toHaveText("‹ Master the game")
}

async function dip(page: Page, touch: boolean) {
  const { ratingFixture } = await import("../../tests/_rating_fixture.mjs")
  const fx = ratingFixture(SERVED)
  // the same record, holding blue with two stripes from an earlier day: the number sits far below it
  const blob = { ...fx.blob, belts: { won: {}, lvl: { n: 7, t: 1 } } }
  await bootSeeded(page, { day: fx.day, blob })
  await press(page, ".ng-logo", "the drawer icon", touch)
  await expect(page.locator("[data-belt-row]")).toHaveAttribute("data-belt-state", "ok", { timeout: 30_000 })
  const r = (await rowState(page))!
  expect([r.belt, r.stripes], "the stripes stay: blue, two").toEqual(["blue", "2"])
  expect(r.lines.length, "the dip's second line").toBe(2)
  expect(r.lines[0]).toMatch(/^\d+ to your 3rd stripe · \d+ to purple$/)
  expect(r.lines[1]).toMatch(/^\d+ under your 2nd stripe · stripes stay$/)
  expect([r.clipped, r.inside], "no text clips, and the row stays inside the drawer").toEqual([false, true])
  expect(await page.evaluate(() => (window as W).__neural.belts.lvl), "a dip lowers nothing").toEqual({ n: 7, t: 1 })
}

// R1 (the independent read, finding 1): a gi/no-gi flip in Settings, a modal over the open drawer, never leaves the other
// ruleset's number on the row: the row reads again, or wears the belt and waits; it never paints the old number
async function flip(page: Page, touch: boolean) {
  const { ratingFixture, ratingApp } = await import("../../tests/_rating_fixture.mjs")
  const { ngKnowledgeQuestionHash } = await import("../../neural/src/knowledge-profile.src.js")
  const fx = ratingFixture(SERVED)
  const num = (frame: string, srs: Record<string, unknown>) => {
    const a = ratingApp(SERVED, frame)
    a.srs = srs; a.stage = fx.blob.stage; a.moves = fx.blob.moves; a._epochDay = () => fx.day
    const r = a.rating()
    return r.status === "ok" && r.final ? String(Math.floor(r.points)) : ""
  }
  // the fixture reads alike in both rulesets once rounded down, so the record also answers decks only gi weighs, added deck by
  // deck (heaviest first) until the two numbers differ: then a number left over from gi is visible after the flip
  const wg = ratingApp(SERVED, "gi").scoreWeights("gi"), wn = ratingApp(SERVED, "nogi").scoreWeights("nogi")
  const decks: Record<string, { cards: { q: string }[] }> = {}
  for (const f of readdirSync(resolve(SERVED, "flashcards"))) if (f !== "_index.json" && !f.startsWith("live-")) Object.assign(decks, JSON.parse(readFileSync(resolve(SERVED, "flashcards", f), "utf8")))
  const srs: Record<string, Record<string, number[]>> = JSON.parse(JSON.stringify(fx.blob.srs))
  for (const k of Object.keys(decks).filter((k) => wg[k] > 0 && !(k in wn)).sort((a, b) => wg[b] - wg[a] || (a < b ? -1 : 1))) {
    if (num("gi", srs) !== num("nogi", srs)) break
    srs[k] = Object.fromEntries(decks[k].cards.map((c) => [ngKnowledgeQuestionHash(c.q), [fx.day + 30, 30, fx.day - 1]]))
  }
  const gi = num("gi", srs), nogi = num("nogi", srs)
  expect(gi, "non-trivial: the record has a number in gi").not.toBe("")
  expect(nogi, "non-trivial: and another in no-gi").not.toBe(gi)
  await bootSeeded(page, { day: fx.day, blob: { ...fx.blob, srs } })
  expect(await page.evaluate(() => (window as W).__neural._giMode), "the page boots in gi").toBe("gi")
  await press(page, ".ng-logo", "the drawer icon", touch)
  await expect(page.locator("[data-belt-row]")).toHaveAttribute("data-belt-state", "ok", { timeout: 30_000 })
  expect((await rowState(page))!.number, "gi: the unit's gi number").toBe(gi)
  // Settings over the open drawer: the badge, Settings, Rolling, No-gi, each pressed as a player does
  await press(page, ".ngAcctChip", "the badge", touch)
  await expect(page.locator("[data-menu-settings]")).toBeVisible()
  await press(page, "[data-menu-settings]", "Settings, from the badge", touch)
  await expect(page.locator('[data-settings-tab="rolling"]'), "the lazy Settings UI has loaded").toBeVisible()
  await press(page, '[data-settings-tab="rolling"]', "the Rolling tab", touch)
  await expect(page.locator("[data-settings-gi]")).toBeVisible()
  await page.evaluate(() => [...document.querySelectorAll("[data-settings-gi] button")].find((b) => (b.textContent || "").trim() === "No-gi")!.setAttribute("data-pw-nogi", "1"))
  // at 390x631 the control sits below the sheet's fold: scrolled to, as a player scrolls the sheet, then pressed where it is
  await page.evaluate(() => document.querySelector("[data-pw-nogi]")!.scrollIntoView({ block: "center" }))
  await press(page, "[data-pw-nogi]", "No-gi", touch)
  expect(await page.evaluate(() => (window as W).__neural._giMode), "the flip landed").toBe("nogi")
  const after = (await rowState(page))!
  expect(after.number, "never the gi number after the flip").not.toBe(gi)
  expect(after.number, "the no-gi number, read at the flip (the live check landed: nothing fetched)").toBe(nogi)
}

test("the belt row at 1440 by mouse: the belt held, then the number once checked; nothing jumps; only the level is written; the tap opens today's session", async ({ page }) => {
  await story(page, false)
})
test("the dip at 1440: the stripes stay and the second line says so", async ({ page }) => {
  await dip(page, false)
})
test("a brand-new visitor at 1440: white, no number, one quiet line", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await expect.poll(() => page.evaluate(() => !!((window as W).__neural.belts && (window as W).__neural.belts.lvl))).toBe(true)
  await press(page, ".ng-logo", "the drawer icon", false)
  await expect(page.locator("[data-belt-row]")).toHaveAttribute("data-belt-state", "none", { timeout: 30_000 })
  const r = (await rowState(page))!
  expect([r.belt, r.stripes, r.number, r.lines]).toEqual(["white", "0", "", ["Answer a few cards to get your number"]])
})

test("a gi/no-gi flip in Settings at 1440, the drawer open: the no-gi number, never the gi one", async ({ page }) => {
  await flip(page, false)
})

test.describe("phone 390x631, by touch", () => {
  test.use({ viewport: { width: 390, height: 631 }, hasTouch: true, isMobile: true })
  test("the belt row at 390 by touch: the belt held, then the number once checked; nothing jumps; only the level is written; the tap opens today's session", async ({ page }) => {
    await story(page, true)
  })
  test("the dip at 390: the stripes stay and the second line fits", async ({ page }) => {
    await dip(page, true)
  })
  test("a gi/no-gi flip in Settings at 390 by touch, the drawer open: the no-gi number, never the gi one", async ({ page }) => {
    await flip(page, true)
  })
})
