/* @hyperspace {"theme":"lifetime-journeys","L":"legacy-corrupt-blob","F":"settings","B":"persistence-reload"} @invariant "Malformed unknown-owner legacy bytes remain unchanged; the first real action writes a separate owned guest profile whose evidence/settings survive reload without importing legacy data." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { CORRUPT_BLOB_RAW } from "./personas"

/**
 * Unknown-owner legacy corruption stays byte-identical. Real settings writes a
 * separate guest-owned v2 profile which survives preserveStorage reload. The
 * one-shot raw seed runs after the DSL registration boot and is not replayed on
 * preserving reloads. No implicit legacy import and no production auth bypass.
 * Owned-cache corruption is a separate fail-closed recovery case.
 */

const KEY = "bjj-neural-progress"

test("corrupt legacy bytes stay unchanged; guest settings persist separately across reload", async ({
  page,
}) => {
  expect(() => JSON.parse(CORRUPT_BLOB_RAW), "persona premise: the corrupt blob must not parse").toThrow()

  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))

  const j = journey(page)

  // ── Boot 1 (throwaway): registers the DSL wipe/ngseed init scripts AHEAD of our seed ──
  await j.boot("/")

  // ── One-shot poison seed: runs AFTER the DSL wipe on every later boot, writes exactly once —
  //    the wiping boot 2 seeds it; the preserving boot 3 must NOT re-seed ──
  await page.addInitScript((raw) => {
    try {
      if (!sessionStorage.getItem("__ng_corrupt_once")) {
        sessionStorage.setItem("__ng_corrupt_once", "1")
        localStorage.setItem("bjj-neural-progress", raw)
      }
    } catch {}
  }, CORRUPT_BLOB_RAW)

  // ── Boot 2: pagehide flush (dying boot-1 app) → wipe → our poison → app preserves the unknown-owner poison ──
  await j.boot("/")
  const fallback = await page.evaluate((key) => {
    const a = (window as any).__neural
    return {
      raw: localStorage.getItem(key),
      blobV: a._progressBlob().v,
      prepKeys: Object.keys(a.prep || {}).length,
      recKeys: Object.keys(a.rec || {}).length,
      mastered: a.masteredCount(),
      mcMode: a.get("mcMode", "auto"),
      settingsAtMc: (a._settingsAt || {}).mcMode ?? null,
    }
  }, KEY)
  expect(fallback.raw, "seed-order proof: the poison survived boot 2's flush+wipe gauntlet").toBe(CORRUPT_BLOB_RAW)
  expect(fallback.blobV, "fallback profile re-serializes as v2 in memory").toBe(2)
  expect(fallback.prepKeys, "fresh fallback: zero prep keys ingested from the poison").toBe(0)
  expect(fallback.recKeys, "fresh fallback: zero rec keys ingested from the poison").toBe(0)
  expect(fallback.mastered, "fresh fallback: zero mastered decks").toBe(0)
  expect(fallback.mcMode, "mcMode reads its default (unset) on the fresh fallback").toBe("auto")
  expect(fallback.settingsAtMc, "no settings write yet — _settingsAt.mcMode is unstamped").toBeNull()

  // ── The settings write: the heal (same choke the settings segBtn click uses: set(key,v)) ──
  await page.evaluate(() => (window as any).__neural.set("mcMode", "classic"))

  const healed = await page.evaluate((key) => {
    const a = (window as any).__neural
    a._flushSave() // explicit pin (set()'s _saveProgress already wrote synchronously in test mode)
    const raw = window.__ngGuestProgressRaw()
    let parsed: any = null
    let parseOk = false
    try {
      parsed = JSON.parse(raw || "")
      parseOk = true
    } catch {}
    return {
      raw,
      parseOk,
      v: parsed?.v,
      storedMcMode: parsed?.settings?.mcMode,
      settingsAtMc: (a._settingsAt || {}).mcMode ?? null,
      prepKeys: Object.keys(a.prep || {}).length,
      recKeys: Object.keys(a.rec || {}).length,
    }
  }, KEY)
  expect(healed.settingsAtMc, "the settings write stamped _settingsAt.mcMode").toBeGreaterThan(0)
  expect(healed.raw, "the settings write created separate owned guest progress").not.toBe(CORRUPT_BLOB_RAW)
  expect(healed.parseOk, "stored blob parses again after the settings write").toBe(true)
  expect(healed.v, "stored blob is v2").toBe(2)
  expect(healed.storedMcMode, "stored settings carry the chosen mcMode").toBe("classic")
  expect(healed.prepKeys, "the settings write did not fabricate drill progress (prep still 0)").toBe(0)
  expect(healed.recKeys, "the settings write did not fabricate recall progress (rec still 0)").toBe(0)

  // ── Boot 3 (preserveStorage): the healed blob — not the poison — is what loads ──
  await j.boot("/", { preserveStorage: true })

  const post = await page.evaluate((key) => {
    const a = (window as any).__neural
    const raw = window.__ngGuestProgressRaw()
    let parsed: any = null
    let parseOk = false
    try {
      parsed = JSON.parse(raw || "")
      parseOk = true
    } catch {}
    return {
      raw,
      parseOk,
      storedV: parsed?.v,
      mcMode: a.get("mcMode", "auto"),
      settingsAtMc: (a._settingsAt || {}).mcMode ?? null,
      memV: a._progressBlob().v,
      prepKeys: Object.keys(a.prep || {}).length,
      recKeys: Object.keys(a.rec || {}).length,
    }
  }, KEY)
  expect(post.parseOk, "post-reload JSON.parse of stored progress succeeds").toBe(true)
  expect(post.raw, "the poison never resurrects (one-shot seed did not refire)").not.toBe(CORRUPT_BLOB_RAW)
  expect(post.storedV, "post-reload stored blob is v2").toBe(2)
  expect(post.mcMode, "the chosen mcMode re-ingested from the healed blob across the reload").toBe("classic")
  expect(post.settingsAtMc, "_settingsAt.mcMode persisted across the reload").toBeGreaterThan(0)
  expect(post.memV, "post-reload _progressBlob().v === 2").toBe(2)
  expect(post.prepKeys, "no drill progress leaked in through the settings heal (prep still 0)").toBe(0)
  expect(post.recKeys, "no recall progress leaked in through the settings heal (rec still 0)").toBe(0)

  // ── Crash guard: corrupt read, settings heal, and reload all ran with zero page errors ──
  expect(await page.evaluate(() => localStorage.getItem("bjj-neural-progress")),
    "unknown-owner legacy bytes remain preserved after guest writes and reload").toBe(CORRUPT_BLOB_RAW);
  expect(errors, "no pageerror across poison boot + settings heal + reload").toEqual([])
})
