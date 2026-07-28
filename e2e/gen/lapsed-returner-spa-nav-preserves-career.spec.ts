/* @hyperspace {"theme":"lifetime-journeys","L":"lapsed-returner","F":"spa-nav","B":"persistence-reload"} @invariant "A Quartz soft navigation for a returner (no in-flight grade) rebuilds the app while their seeded career survives in storage: after the soft nav the remounted instance is a fresh ref with an empty beats array, yet _progressBlob() still carries belts.won[white] and the full prep map — navigation rebuilds the app, never the profile." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { lapsedReturner, CURRICULUM } from "./personas"

/**
 * LAPSED RETURNER — CAREER SURVIVES A SOFT NAV. A returning white-belt holder (full white
 * curriculum drilled, white belt won) plays a live roll, then Quartz soft-navigates away with
 * NO grade in flight. The remounted instance must be a genuinely fresh app life (new ref, empty
 * beats) whose ingested career is byte-for-byte the seeded one: navigation rebuilds the app,
 * never the profile.
 *
 * Distinct from its siblings — this pins the pure-persistence teardown path:
 *   - spa-nav-single-instance-law (freshVisitor): one-root / idempotence, no seeded career.
 *   - spa-nav-inflight-progress-survives (whiteBeltHolder): a card graded WITHIN the 400ms
 *     debounce window right before the nav — the in-flight-grade Q001 case.
 *   Here there is NO pending grade, so survival is purely: teardown _flushSave (Q001 fix,
 *   componentWillUnmount app.src.jsx:79, gated on _progressLoaded) writes _progressBlob() to
 *   localStorage → life 2 re-ingests it. Even the debounce-shortcut path is irrelevant because
 *   nothing was written after the seed ingest; the assertion is that the remount does not
 *   silently drop or reset the career while it rebuilds the app.
 *
 * Career signature = _progressBlob() (app.src.jsx:1109, the authored save shape
 * {v,prep,rec,stage,units,belts,days,settings,...}): belts.won["white"] present + a non-empty
 * prep map. Belt id constant: CURRICULUM.belts[0].id === "white". prep is the full set of white
 * lesson decks (~32); assert BY COUNT (== before), never by value — MC waves rewrite card text
 * but not deck cardinality.
 *
 * CANONICAL SLUG PITFALL (load-bearing, shared by every spa-nav spec): the nav target MUST be
 * "/Game-Over" — CAPITAL G-O, the real built page (source/public/Game-Over.html) that Quartz
 * soft-navigates into. Lowercase "/game-over" is an alias REDIRECT STUB (source/public/
 * game-over.html) whose <meta http-equiv=refresh> HARD-navigates: fresh window → the harness
 * init script wipes storage → a false "career lost" failure. The sameDoc guard below (a stashed
 * window.__probeOldRef survives only a soft nav) catches any regression back to the hard path.
 */

const POSITION = "Mount Top"
const BELT_ID: string = CURRICULUM.belts[0].id // "white"

test("lapsed returner: a soft nav rebuilds a fresh app life yet the seeded career survives ingest", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))

  const j = journey(page)
  await j.boot("/", { initialState: lapsedReturner() })
  await j.land(POSITION)
  await j.expectBeat("land")
  await j.expectBeat("options_dealt")

  // ── LIFE 1 premise: the seeded career is present AND the beat stream is non-empty, so the
  // empty-beats-after-nav check below is non-vacuous. No grade is issued — nothing to flush
  // beyond the seed ingest; this is the pure-persistence path, not the in-flight-grade path. ──
  const before = await page.evaluate((bid) => {
    const a = (window as any).__neural
    a.__probeLife = 1 // marker: the remounted life must NOT carry this
    ;(window as any).__probeOldRef = a // corpse handle + hard-nav detector (window global survives a SOFT nav)
    const blob = a._progressBlob() // the authored save shape — the exact bytes teardown persists
    return {
      beats: (a.beats || []).length,
      beltWon: !!(blob.belts?.won || {})[bid],
      prepKeys: Object.keys(blob.prep || {}).length,
    }
  }, BELT_ID)
  expect(before.beltWon, "seed sanity: lapsedReturner carries the white belt win in life 1").toBe(true)
  expect(before.prepKeys, "seed sanity: the full white prep map is loaded in life 1").toBeGreaterThan(0)
  expect(before.beats, "life 1 accumulated beats (non-vacuity guard for the empty-after-nav assert)").toBeGreaterThan(0)

  // ── Quartz soft nav with NO grade in flight (spa.inline.ts seam). CANONICAL slug — capital
  // G-O; see the pitfall note above. Async, evaluate awaits it. ──
  await page.evaluate(() => (window as any).spaNavigate(new URL("/Game-Over", location.origin)))
  await page.waitForFunction(
    () => {
      const a = (window as any).__neural
      return !!(
        a &&
        !a.__probeLife && // the fresh life, not the corpse
        a.nodes &&
        a.nodes.length &&
        typeof a.advance === "function" &&
        a.flashcards &&
        a.flashcards.decks
      )
    },
    undefined,
    { timeout: 90_000 },
  )

  // ── THE INVARIANT: a fresh app life (new ref, empty beats, one root, nodes re-ingested) that
  // re-loaded the SAME career from storage (belt win intact, prep map same cardinality). ──
  const after = await page.evaluate((bid) => {
    const a = (window as any).__neural
    const old = (window as any).__probeOldRef
    const blob = a._progressBlob()
    return {
      sameDoc: !!old, // a lowercase alias-stub HARD nav would have wiped this window global
      sameRef: a === old, // the remount is a distinct instance, not the recycled old one
      beats: (a.beats || []).length,
      nodesLen: (a.nodes || []).length,
      roots: document.querySelectorAll("#neural-root").length,
      corpseDestroyed: old && old.__ngDestroyed === true,
      beltWon: !!(blob.belts?.won || {})[bid],
      prepKeys: Object.keys(blob.prep || {}).length,
    }
  }, BELT_ID)

  // app rebuilt — fresh life
  expect(after.sameDoc, "soft nav stayed same-document (canonical slug; the alias stub would hard-navigate)").toBe(true)
  expect(after.sameRef, "the remount is a NEW instance, not the recycled old ref").toBe(false)
  expect(after.beats, "the fresh life's beat stream starts EMPTY (app rebuilt, not resumed)").toBe(0)
  expect(after.nodesLen, "the fresh life ingested its graph nodes").toBeGreaterThan(0)
  expect(after.roots, "exactly one #neural-root after the soft nav (old overlay removed)").toBe(1)
  expect(after.corpseDestroyed, "the old life ran destroy() (__ngDestroyed set)").toBe(true)

  // career survived — profile NOT rebuilt
  expect(after.beltWon, "the seeded white belt win survives the soft nav into the remounted career").toBe(true)
  expect(after.prepKeys, "the full prep map survives with the SAME cardinality (career intact, not reset)").toBe(
    before.prepKeys,
  )

  expect(errors, "no pageerror across the roll, the soft nav, and the remount").toEqual([])
})
