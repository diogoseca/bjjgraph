/* @hyperspace {"theme":"lifetime-journeys","L":"srs-veteran","F":"persistence-reload","B":"persistence-reload"} @invariant "A veteran's 25-deck rec map survives a preserveStorage reload byte-for-byte at the count level: after reload masteredCount()===25, _progressBlob().v===2, and every seeded deckKey still reads rec>=3." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { srsVeteran, CURRICULUM } from "./personas"

/**
 * VETERAN MASTERED SURVIVES RELOAD — the persistence contract for a 25-deck SRS veteran.
 *
 * Seams under test (probe-verified twice, identical results, 14-18s/run):
 *   - srsVeteran(25) seed ingests at boot: masteredCount()===25 (counts rec>=3 keys,
 *     app.src.jsx:1147), exactly 25 rec keys + 25 prep keys live, _progressBlob().v===2
 *   - _flushSave() (synchronous; test mode already makes _saveProgress synchronous, but
 *     the explicit pin is the verified rail) writes bjj-neural-progress: the stored blob
 *     reads back v:2 with all 25 rec entries
 *   - boot({preserveStorage:true}) re-ingests the SAME map: zero dropped keys, and
 *     spot-checked entries survive EXACTLY (rec===3, prep===5 — stronger than the >=
 *     floor: values round-trip unchanged, not merely re-cross the mastery gate)
 *
 * The journey never picks or drills, so land()'s built-in rigs (ai-skill/role/max-moves)
 * cover every RNG draw — no extra queues needed. No sim time is pumped beyond land()'s
 * own advances, so nothing mutates prep/rec between seed and assert.
 */

// Derive the seeded deckKeys with the SAME triple loop srsVeteran uses (belts→units→
// lessons, first 25) so the spec tracks curriculum reorders instead of freezing names.
const SEEDED: string[] = (() => {
  const keys: string[] = []
  outer: for (const belt of CURRICULUM.belts)
    for (const u of belt.units)
      for (const l of u.lessons) {
        keys.push(l.deckKey)
        if (keys.length >= 25) break outer
      }
  return keys
})()

// Spot-check indexes 0 / 12 / 24 — "Mount|Bottom", "Hip Bump Sweep|Attacker",
// "Americana from Mount|Attacker" at authoring time (174 lesson decks in curriculum).
const SPOTS = [0, 12, 24]

test("veteran 25-deck rec map survives a preserveStorage reload: count, version, and exact per-key values", async ({ page }) => {
  test.skip(SEEDED.length < 25, "curriculum shrank below 25 lesson decks — srsVeteran(25) premise gone")
  test.skip(
    new Set(SEEDED).size !== 25,
    "first 25 lesson deckKeys are no longer unique — the count-level invariant would conflate keys",
  )

  const j = journey(page)

  // ── Boot 1: seed ingests immediately ──
  await j.boot("/", { initialState: srsVeteran(25) })
  await j.land("Mount Top")
  await j.expectBeat("land")
  await j.expectBeat("options_dealt")

  const pre = await page.evaluate((keys) => {
    const a = (window as any).__neural
    return {
      mastered: a.masteredCount(),
      blobV: a._progressBlob().v,
      recKeys: Object.keys(a.rec).length,
      prepKeys: Object.keys(a.prep).length,
      recVals: (keys as string[]).map((k) => a.rec[k] ?? 0),
    }
  }, SEEDED)
  expect(pre.mastered, "seed ingested: masteredCount()===25 pre-reload").toBe(25)
  expect(pre.blobV, "live blob is v2 pre-reload").toBe(2)
  expect(pre.recKeys, "exactly the 25 seeded rec keys, no extras").toBe(25)
  expect(pre.prepKeys, "exactly the 25 seeded prep keys, no extras").toBe(25)
  for (let i = 0; i < SEEDED.length; i++)
    expect(pre.recVals[i], `seeded "${SEEDED[i]}" live at rec=3 pre-reload`).toBe(3)

  // ── Pin the write, then read the STORED blob back (count-level byte check) ──
  const stored = await page.evaluate(
    (spotKeys) => {
      const a = (window as any).__neural
      a._flushSave()
      const blob = JSON.parse(localStorage.getItem("bjj-neural-progress") || "null")
      return {
        v: blob?.v,
        recCount: Object.keys(blob?.rec || {}).length,
        spotRec: (spotKeys as string[]).map((k) => blob?.rec?.[k]),
        spotPrep: (spotKeys as string[]).map((k) => blob?.prep?.[k]),
      }
    },
    SPOTS.map((i) => SEEDED[i]),
  )
  expect(stored.v, "stored blob is v2").toBe(2)
  expect(stored.recCount, "stored blob carries all 25 rec entries").toBe(25)
  for (let s = 0; s < SPOTS.length; s++) {
    expect(stored.spotRec[s], `stored rec["${SEEDED[SPOTS[s]]}"] === 3`).toBe(3)
    expect(stored.spotPrep[s], `stored prep["${SEEDED[SPOTS[s]]}"] === 5`).toBe(5)
  }

  // ── Boot 2: preserveStorage reload — the map survives re-ingest ──
  await j.boot("/", { preserveStorage: true })
  await j.land("Mount Top")
  await j.expectBeat("options_dealt")

  const post = await page.evaluate((keys) => {
    const a = (window as any).__neural
    return {
      mastered: a.masteredCount(),
      blobV: a._progressBlob().v,
      recVals: (keys as string[]).map((k) => a.rec[k] ?? 0),
      prepVals: (keys as string[]).map((k) => a.prep[k] ?? 0),
    }
  }, SEEDED)
  expect(post.mastered, "after reload masteredCount() === 25").toBe(25)
  expect(post.blobV, "after reload _progressBlob().v === 2").toBe(2)
  for (let i = 0; i < SEEDED.length; i++)
    expect(post.recVals[i], `"${SEEDED[i]}" still mastered after reload (rec>=3, zero dropped)`).toBeGreaterThanOrEqual(3)

  // Spot-checks survive EXACTLY — tighter than the invariant's >= floor
  for (const i of SPOTS) {
    expect(post.recVals[i], `spot "${SEEDED[i]}" rec === 3 exactly after reload`).toBe(3)
    expect(post.prepVals[i], `spot "${SEEDED[i]}" prep === 5 exactly after reload`).toBe(5)
  }
})
