/* @hyperspace {"theme":"lifetime-journeys","L":"legacy-corrupt-blob","F":"boot-landing","B":"error-fallback"} @invariant "Booting with syntactically-broken JSON in bjj-neural-progress falls back to a pristine fresh profile without crashing: the app ingests >1000 nodes, prep/rec are empty, masteredCount()===0, and a first roll lands with a live hand." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { CORRUPT_BLOB_RAW } from "./personas"

/**
 * CORRUPT BLOB → FRESH FALLBACK BOOT — storage carries syntactically-broken JSON under
 * bjj-neural-progress; the app must construct a pristine fresh profile and stay playable.
 *
 * Mechanism under test (neural/src/app.src.jsx, probe-verified 2/2 deterministic, ~20s/run):
 *   - Construction order: this.prep = {} (:305) precedes _loadProgress() (:307), and
 *     _loadProgress (:1084) resets rec/stage/units/belts FIRST — so when JSON.parse throws
 *     inside its try/catch (:1101 "corrupt/absent — start fresh") every map is already
 *     pristine. Corrupt bytes can only yield a fresh profile, never a partial one.
 *   - The key is NEVER removed at boot (no eager save at construction), so post-boot storage
 *     still holds the corrupt string — which doubles as the seeding proof below.
 *
 * SEEDING RECIPE (the non-obvious part — the personas.ts literal recipe is VACUOUS):
 * addInitScript executes in REGISTRATION order, and dsl.ts registers its storage-wipe script
 * lazily on the FIRST boot() call. A seed registered before any boot() runs BEFORE the wipe
 * and is cleared (probe-proved: marker=null, raw=null, app booted plain-fresh). Working order:
 *   (1) boot("/") once      — registers the DSL init scripts (wipe + ngseed reader)
 *   (2) addInitScript(seed) — now registered AFTER the wipe
 *   (3) boot("/") again     — the boot under test: wipe → corrupt seed → app parses corrupt bytes
 * Non-vacuousness guards: __probe_marker (a key the app never touches) must read "1" post-boot
 * (seed ran after the wipe), and the progress key must be non-null (the probe observed the exact
 * corrupt string surviving; asserting only non-null stays robust if an early save is ever added).
 *
 * land()'s built-in rigs (ai-skill/role/max-moves + rigStart) cover every draw — the journey
 * never picks or drills, so no extra rig queues are needed.
 */

test("corrupt bjj-neural-progress at boot: fresh-profile fallback, no crash, live first hand", async ({ page }) => {
  // premise guard: the persona constant must actually be broken JSON, or the spec is vacuous
  expect(() => JSON.parse(CORRUPT_BLOB_RAW), "persona premise: CORRUPT_BLOB_RAW does not parse").toThrow()

  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))

  const j = journey(page)

  // (1) registration boot — makes the DSL's wipe init-script exist so ours registers AFTER it
  await j.boot("/")

  // (2) corrupt seed + a marker the app never touches; both run post-wipe on the NEXT boot
  await page.addInitScript((blob) => {
    localStorage.setItem("bjj-neural-progress", blob)
    localStorage.setItem("__probe_marker", "1")
  }, CORRUPT_BLOB_RAW)

  // (3) the boot under test: wipe → corrupt seed → app construction parses the corrupt bytes
  await j.boot("/")

  const boot = await page.evaluate(() => {
    const a = (window as any).__neural
    return {
      marker: localStorage.getItem("__probe_marker"),
      raw: localStorage.getItem("bjj-neural-progress"),
      nodes: a.nodes.length,
      prepKeys: Object.keys(a.prep || {}),
      recKeys: Object.keys(a.rec || {}),
      mastered: a.masteredCount(),
    }
  })
  // seeding proof FIRST — without these the fresh-profile reads below are vacuously green
  expect(boot.marker, "seed init-script ran AFTER the DSL wipe (marker survives boot)").toBe("1")
  expect(boot.raw, "corrupt blob was in storage when the app booted (key never removed at boot)").not.toBeNull()

  // fresh-profile fallback: full ingest, pristine maps, zero mastery
  expect(boot.nodes, "app ingested the full graph despite the corrupt blob").toBeGreaterThan(1000)
  expect(boot.prepKeys, "prep fell back to a pristine empty map").toEqual([])
  expect(boot.recKeys, "rec fell back to a pristine empty map").toEqual([])
  expect(boot.mastered, "masteredCount() === 0 — no phantom mastery from corrupt bytes").toBe(0)

  // the fresh profile is PLAYABLE: a first roll lands and deals a live hand
  await j.land("Mount Top")
  await j.expectBeat("land")
  await j.expectBeat("options_dealt")
  const hand = await page.evaluate(() => (((window as any).__neural || {}).optionIdxs || []).length)
  expect(hand, "a live hand of options was dealt").toBeGreaterThan(0)

  // crash guard: registration boot + corrupt boot + landing all ran clean
  expect(errors, "zero pageerror across double-boot and landing").toEqual([])
})
