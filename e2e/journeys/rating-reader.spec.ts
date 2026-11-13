import { expect, test, type Page } from "@playwright/test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { journey } from "../dsl"

/** THE RATING ON A BUILT PAGE (v1.269.0, Stage 1: computed, shown nowhere).
 *
 * The owner's rule (13 Nov 2026): the number is what you can recall right now, 1000 + 1000 × the share of the game,
 * table a's belt lines. Stage 1 paints nothing, so a spec and a person read it the one way there is:
 * `window.__neural.rating()`.
 *
 * ONE RECORD, TWO READERS. tests/_rating_fixture.mjs chooses a stored record from the wire by rule (shared questions,
 * a stage in another deck, overdue rows, a miss, moves Yes and No, a move nobody deals there, an escape, a bad row, a
 * stage with no schedule). This journey seeds it into a real page and asserts that the page's number and every count
 * equal the number the unit suite's construction computes in node from THE DIRECTORY THIS PAGE IS SERVED FROM
 * (source/public/static/neural). So a bundle built without the module, a stale bundle, a different wire, or a load
 * path that drops a field cannot agree by accident: node evaluates app.src.jsx, the page runs the bundle.
 *
 * IT WRITES NOTHING. Current players' progress is the whole point of the owner's rules: the reader reads storage and
 * writes none. Every localStorage and sessionStorage key and value, snapshotted once the boot has stopped writing, is
 * byte-identical after the reader has run on two days (the second 120 days on, which must fade the number). The live
 * check's derived sets live in memory only (`_ratingLive`); the two files ride the browser's ordinary HTTP cache.
 *
 * THE LIVE CHECK (v1.271.0). The seeded record holds retired rows (cards its deck no longer holds). A page that never
 * asks for the check fetches ZERO `flashcards/live-*.json` and its reading is not final (no number); asking
 * (`ratingCheck()`) fetches exactly TWO, and only then is the number final and equal to node's. A file built for another
 * deck list (a content deploy between boot and fetch) is never read: every row unchecked, named, no number.
 *
 * MUTANTS (v1.269.0), each built into the bundle (`npm run dev:neural:app`) and run against this file under the lock;
 * the table is in docs/Changelog-Archive.md (v1.269.0):
 *   J1 the reader stores its level (`belts.lvl`) and saves          → "the reader writes nothing" (storage differs)
 *   J2 the module left out of the bundle (build.mjs)                → the page's rating() throws
 *   J3 the load path drops the moves record                         → the page's counts differ from node's
 *   J4 the reader fetches on a plain read (v1.271.0)                → the first test: "not asked" (it already fetched)
 *   J5 a live file built for another deck list accepted (v1.271.0)  → the second test: "stale: unchecked, named, never priced"
 * NOT COVERED here: the law itself (tests/rating.test.mjs, 31 mutants), no-gi on a page (the unit reads both rulesets
 * through the same reader; a ruleset flip writes a setting, so it cannot share this byte-identity claim), and any
 * painted surface (there is none). Nothing is pressed: there is nothing to press. And, as in the unit file: a row for a
 * question its deck no longer holds reads as a live card (the manifest has a count per deck, not its questions); the
 * module caps a deck at its own worth and counts the excess, but that must be settled before any surface shows the number.
 */

type W = any
const SERVED = resolve(__dirname, "../../source/public/static/neural")

const liveRequests = (page: Page) => {
  const seen: string[] = []
  page.on("request", (r) => { if (/\/flashcards\/live-\d+\.json/.test(r.url())) seen.push(r.url()) })
  return seen
}
const storage = (page: Page) => page.evaluate(() => JSON.stringify([localStorage, sessionStorage].map((st) =>
  Object.keys(st).sort().map((k) => [k, st.getItem(k)]))))

async function bootSeeded(page: Page, fx: { day: number; blob: Record<string, unknown> }) {
  await page.addInitScript((d) => { (window as W).__NG_EPOCH_DAY__ = d }, fx.day)
  const j = journey(page)
  await j.boot("/", { initialState: fx.blob })
  // the game's inputs are in (graph, manifest, curriculum) — asked WITHOUT calling the reader
  await expect.poll(() => page.evaluate(() => {
    const a = (window as W).__neural
    return !!(a && a.nodes && a.nodes.length && a.flashcards && a.flashcards.decks && Object.keys(a.flashcards.decks).length
      && a.curriculum && a.scoreWeights("gi"))
  }), { timeout: 60_000, message: "graph, deck manifest and curriculum in" }).toBe(true)
  // storage as the boot left it: polled until it holds still for 2 s, so a boot save in flight is not read as the reader's
  let before = await storage(page)
  await expect.poll(async () => {
    await page.waitForTimeout(2_000)
    const now = await storage(page), still = now === before
    before = now
    return still
  }, { timeout: 30_000, intervals: [0], message: "the boot has stopped writing storage" }).toBe(true)
  return before
}
const read = (page: Page, day: number) => page.evaluate((d) => {
  (window as W).__NG_EPOCH_DAY__ = d
  const r = (window as W).__neural.rating()
  return { status: r.status, reason: r.reason, final: r.final, frame: r.frame, points: r.points, level: r.level, counts: { ...r.counts } }
}, day)

test("the page's rating is the unit's number for the same record, once checked, and reading it writes nothing", async ({ page }) => {
  const { ratingFixture, ratingApp } = await import("../../tests/_rating_fixture.mjs")
  const fx = ratingFixture(SERVED)
  const inNode = (day: number) => {
    const a = ratingApp(SERVED, "gi")
    a.srs = fx.blob.srs; a.stage = fx.blob.stage; a.moves = fx.blob.moves; a._epochDay = () => day
    return a.rating()
  }
  const want = inNode(fx.day), later = inNode(fx.day + 120)
  expect(want.status, "the unit's construction reads the record").toBe("ok")
  expect(want.counts.retired, "the record holds retired rows").toBeGreaterThan(0)
  expect(later.points, "and 120 days on it has faded").toBeLessThan(want.points)

  const asked = liveRequests(page)
  const before = await bootSeeded(page, fx)
  expect(before, "the seeded record is in storage").toContain(Object.keys(fx.blob.srs)[0])

  // never asked: not final, no number, and nothing fetched
  const plain = await read(page, fx.day)
  expect([plain.status, plain.reason, plain.final, plain.points], "not asked").toEqual(["unchecked", "not-asked", false, null])
  expect(plain.counts.unchecked, "rows waiting for the check").toBeGreaterThan(0)
  expect(asked, "a page that never asks fetches no live file").toEqual([])

  // asked: exactly the two files, then final and node's number
  await page.evaluate(() => (window as W).__neural.ratingCheck())
  expect(asked.map((u) => u.split("?")[0].split("/").pop()).sort(), "exactly two requests").toEqual(["live-0.json", "live-1.json"])
  const got = await read(page, fx.day)
  expect(got.frame, "the page boots in gi").toBe("gi")
  expect([got.status, got.final]).toEqual(["ok", true])
  expect(got.counts, "every count, the page's against the unit's").toEqual({ ...want.counts })
  expect(got.counts.checked, "the check ran on the record's rows").toBeGreaterThan(20)
  expect(Math.abs(got.points - want.points), `page ${got.points} vs unit ${want.points}`).toBeLessThan(1e-9)
  expect(got.level).toBe(want.level)
  const got2 = await read(page, fx.day + 120)
  expect(Math.abs(got2.points - later.points), `120 days on: page ${got2.points} vs unit ${later.points}`).toBeLessThan(1e-9)
  await read(page, fx.day)
  await page.evaluate(() => (window as W).__neural.ratingCheck())
  expect(asked.length, "and never again for this manifest").toBe(2)

  // the reader has run, and the check has landed; give any save it might have scheduled time to land, then compare
  await page.waitForTimeout(2_500)
  expect(await storage(page), "every localStorage and sessionStorage key and value is byte-identical").toBe(before)
})

test("a live file built for another deck list is never read: every row unchecked, named, no number", async ({ page }) => {
  const { ratingFixture } = await import("../../tests/_rating_fixture.mjs")
  const fx = ratingFixture(SERVED)
  const before = await bootSeeded(page, fx)
  // a content deploy between the app's boot and the fetch: the file now describes another deck list. Registered AFTER
  // the boot, because Playwright matches the newest route first and the harness routes every flashcards/*.json at boot
  const served: string[] = []
  await page.route("**/flashcards/live-*.json", (r) => {
    const name = new URL(r.request().url()).pathname.split("/").pop()!
    served.push(name)
    const body = JSON.parse(readFileSync(resolve(SERVED, "flashcards", name), "utf8"))
    r.fulfill({ contentType: "application/json", body: JSON.stringify({ ...body, rev: "00000000" }) })
  })
  await page.evaluate(() => (window as W).__neural.ratingCheck())
  expect(served.sort(), "the stale files were the ones served").toEqual(["live-0.json", "live-1.json"])
  const r = await read(page, fx.day)
  expect([r.status, r.reason, r.final, r.points], "stale: unchecked, named, never priced").toEqual(["unchecked", "stale-live", false, null])
  expect(await storage(page)).toBe(before)
})
