/* @hyperspace {"theme":"lifetime-journeys","L":"legacy-corrupt-blob","F":"boot-landing","B":"error-fallback"} @invariant "Malformed unknown-owner legacy bytes are preserved while a separate fresh guest profile stays playable: the app ingests >1000 nodes, prep/rec are empty, masteredCount()===0, and a first roll lands with a live hand." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { CORRUPT_BLOB_RAW } from "./personas"

/**
 * Unknown-owner legacy corruption is never auto-imported or overwritten. Seed raw
 * bytes AFTER the DSL registration boot; verify them exactly before and after real
 * play. This covers a fresh owned guest beside preserved legacy storage, not the
 * fail-closed owned-cache recovery flow (covered by challenges-engine).
 */

test("corrupt legacy progress stays untouched beside a playable fresh guest", async ({ page }) => {
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

  // (3) the boot under test: wipe → corrupt seed → app construction leaves unknown-owner bytes alone
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
  expect(boot.raw, "unknown-owner corrupt legacy bytes survive boot exactly").toBe(CORRUPT_BLOB_RAW)

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

  expect(await page.evaluate(() => localStorage.getItem("bjj-neural-progress")), "legacy bytes remain untouched after real play").toBe(CORRUPT_BLOB_RAW)

  // crash guard: registration boot + corrupt boot + landing all ran clean
  expect(errors, "zero pageerror across double-boot and landing").toEqual([])
})
