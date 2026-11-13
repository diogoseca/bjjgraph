import { expect, test } from "@playwright/test"
import { resolve } from "node:path"
import { journey } from "../dsl"

/** THE RATING ON A BUILT PAGE (v1.267.0, Stage 1: computed, shown nowhere).
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
 * writes none. Every localStorage key and value, snapshotted once the boot has stopped writing, is byte-identical after
 * the reader has run on two days (the second 120 days on, which must fade the number).
 *
 * MUTANTS (v1.267.0), each built into the bundle (`npm run dev:neural:app`) and run against this file under the lock;
 * the table is in docs/Changelog-Archive.md (v1.267.0):
 *   J1 the reader stores its level (`belts.lvl`) and saves          → "the reader writes nothing" (storage differs)
 *   J2 the module left out of the bundle (build.mjs)                → the page's rating() throws
 *   J3 the load path drops the moves record                         → the page's counts differ from node's
 * NOT COVERED here: the law itself (tests/rating.test.mjs, 17 mutants), no-gi on a page (the unit reads both rulesets
 * through the same reader; a ruleset flip writes a setting, so it cannot share this byte-identity claim), and any
 * painted surface (there is none). Nothing is pressed: there is nothing to press.
 */

type W = any
const SERVED = resolve(__dirname, "../../source/public/static/neural")

test("the page's rating is the unit's number for the same record, and reading it writes nothing", async ({ page }) => {
  const { ratingFixture, ratingApp } = await import("../../tests/_rating_fixture.mjs")
  const fx = ratingFixture(SERVED)
  const inNode = (day: number) => {
    const a = ratingApp(SERVED, "gi")
    a.srs = fx.blob.srs; a.stage = fx.blob.stage; a.moves = fx.blob.moves; a._epochDay = () => day
    return a.rating()
  }
  const want = inNode(fx.day), later = inNode(fx.day + 120)
  expect(want.status, "the unit's construction reads the record").toBe("ok")
  expect(later.points, "and 120 days on it has faded").toBeLessThan(want.points)

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
  const storage = () => page.evaluate(() => JSON.stringify(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)])))
  let before = await storage()
  await expect.poll(async () => {
    await page.waitForTimeout(2_000)
    const now = await storage(), still = now === before
    before = now
    return still
  }, { timeout: 30_000, intervals: [0], message: "the boot has stopped writing storage" }).toBe(true)
  expect(before, "the seeded record is in storage").toContain(Object.keys(fx.blob.srs)[0])

  const read = (day: number) => page.evaluate((d) => {
    (window as W).__NG_EPOCH_DAY__ = d
    const r = (window as W).__neural.rating()
    return { status: r.status, frame: r.frame, day: r.day, points: r.points, share: r.share, level: r.level, counts: { ...r.counts } }
  }, day)
  const got = await read(fx.day)
  expect(got.frame, "the page boots in gi").toBe("gi")
  expect(got.status).toBe("ok")
  expect(got.counts, "every count, the page's against the unit's").toEqual({ ...want.counts })
  expect(got.counts.rows, "the record was read, not an empty one").toBeGreaterThan(20)
  expect(Math.abs(got.points - want.points), `page ${got.points} vs unit ${want.points}`).toBeLessThan(1e-9)
  expect(got.level).toBe(want.level)
  const got2 = await read(fx.day + 120)
  expect(Math.abs(got2.points - later.points), `120 days on: page ${got2.points} vs unit ${later.points}`).toBeLessThan(1e-9)
  await read(fx.day)

  // the reader has run on two days; give any save it might have scheduled time to land, then compare every byte
  await page.waitForTimeout(2_500)
  expect(await storage(), "every localStorage key and value is byte-identical after the reader ran").toBe(before)
})
