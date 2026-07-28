/* @hyperspace {"theme":"lifetime-journeys","L":"legacy-corrupt-blob","F":"settings","B":"persistence-reload"} @invariant "After falling back from corrupt storage, a settings change (giMode/mcMode) writes into the healed profile and survives a preserveStorage reload: post-reload the setting reads the chosen value, _progressBlob().v===2, and JSON.parse of bjj-neural-progress succeeds — the quarantined poison never resurfaces through the settings write path." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { CORRUPT_BLOB_RAW } from "./personas"

/**
 * CORRUPT BLOB — SETTINGS PERSIST CLEANLY AFTER HEAL. Poisoned storage falls back to a fresh
 * profile, stays byte-identical through boot (no land/pick/drill — the settings path draws zero
 * RNG, so no rigs are needed), then a single settings write via set("mcMode","classic") replaces
 * the corruption with a valid v2 blob carrying settings.mcMode. That healed blob survives a
 * preserveStorage reload: the poison is quarantined, never resurrected through the settings path.
 *
 * WHY mcMode, NOT giMode (the brief lists both — they DIVERGE; only mcMode makes the invariant
 * true; source-verified against neural/src/app.src.jsx):
 *   - set("mcMode", v) [app.src.jsx:1133] stamps _settingsAt.mcMode = Date.now() AND calls
 *     _saveProgress() → a SYNCHRONOUS localStorage write under isTest() [app.src.jsx:1122]. This
 *     is the exact choke the real settings segBtn click uses (settingRow → this.set(key,v),
 *     app.src.jsx:2216). It replaces the poison with a valid v2 blob whose settings.mcMode is set.
 *   - setGiMode(m) [app.src.jsx:2634-2642] writes ONLY the SEPARATE key bjj_gi_mode (line 2637).
 *     It never calls set()/_saveProgress(), never touches bjj-neural-progress, never stamps
 *     _settingsAt — so it can NOT heal the progress blob through the settings write path.
 *
 * MECHANISM (fallback): _loadProgress [app.src.jsx:1089] resets rec/stage/units/belts/_settingsAt
 * to empty FIRST (line 1091, prep={} from the constructor); the JSON.parse throw is swallowed by
 * the try/catch (line 1107 "corrupt/absent — start fresh") → a guaranteed pristine profile, never
 * partial. The key is never removed at boot (no eager save), so the poison stays byte-identical
 * until the settings write replaces it.
 *
 * SEEDING RECIPE (the personas.ts docstring recipe is VACUOUS — use the one-shot form; identical
 * to the sibling grade-heal spec):
 *   1. throwaway j.boot("/") FIRST, so the DSL wipe/ngseed init scripts register AHEAD of ours;
 *   2. addInitScript writing CORRUPT_BLOB_RAW, guarded by a ONE-SHOT sessionStorage flag — init
 *      scripts accumulate across boots, so without the flag the preserveStorage boot would
 *      re-poison storage and fake a "resurrection". The DSL wipe clears the flag on WIPING boots
 *      (re-seeding there is correct) while a preserving boot keeps it (skip);
 *   3. boot again — order: dying-app pagehide _flushSave → DSL wipe → ngseed → our seed. The
 *      raw === CORRUPT_BLOB_RAW assert after boot 2 is the seed-order proof.
 *
 * Assertions are structural only (blob versions, _settingsAt timestamps, get() value, key counts,
 * JSON.parse success) — never card/answer text. No rig queues (zero RNG on the settings path).
 */

const KEY = "bjj-neural-progress"

test("corrupt blob: fresh fallback, then a settings write (mcMode) heals cleanly and survives a preserveStorage reload", async ({
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

  // ── Boot 2: pagehide flush (dying boot-1 app) → wipe → our poison → app reads the poison ──
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
    const raw = localStorage.getItem(key)
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
  expect(healed.raw, "the poison was REPLACED by the settings write").not.toBe(CORRUPT_BLOB_RAW)
  expect(healed.parseOk, "stored blob parses again after the settings write").toBe(true)
  expect(healed.v, "stored blob is v2").toBe(2)
  expect(healed.storedMcMode, "stored settings carry the chosen mcMode").toBe("classic")
  expect(healed.prepKeys, "the settings write did not fabricate drill progress (prep still 0)").toBe(0)
  expect(healed.recKeys, "the settings write did not fabricate recall progress (rec still 0)").toBe(0)

  // ── Boot 3 (preserveStorage): the healed blob — not the poison — is what loads ──
  await j.boot("/", { preserveStorage: true })

  const post = await page.evaluate((key) => {
    const a = (window as any).__neural
    const raw = localStorage.getItem(key)
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
  expect(errors, "no pageerror across poison boot + settings heal + reload").toEqual([])
})
