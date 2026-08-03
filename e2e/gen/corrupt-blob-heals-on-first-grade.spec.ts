/* @hyperspace {"theme":"lifetime-journeys","L":"legacy-corrupt-blob","F":"drill-mc","B":"persistence-reload"} @invariant "After falling back from corrupt storage, the first graded card writes a valid v2 blob that replaces the corruption and survives a preserveStorage reload: post-reload JSON.parse succeeds, _progressBlob().v===2, and the graded prep key persists — the poison is quarantined, not resurrected." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { CORRUPT_BLOB_RAW, CURRICULUM } from "./personas"

/**
 * CORRUPT BLOB HEALS ON FIRST GRADE — poisoned storage falls back to a fresh profile, stays
 * byte-identical through boot/land/drill-open, then the FIRST graded card replaces it with a
 * valid v2 blob that survives a preserveStorage reload. Quarantined, never resurrected.
 *
 * Seams under test (probe-verified, 2 deterministic green runs):
 *   - _loadProgress (neural/src/app.src.jsx:1084) catches the JSON.parse throw and leaves the
 *     constructor-fresh profile (prep {} from :305): in-memory _progressBlob().v===2, 0 keys.
 *   - No boot-time writes to bjj-neural-progress: set() is settings-UI-only, finishCoach
 *     writes the SEPARATE bjj-neural-coached key, presentCard only moves deckIdx (source-
 *     verified) — the corrupt string stays byte-identical through land + drill-open + present.
 *   - First MC-correct grade: _bumpStage + noteCardDone → _saveProgress, SYNCHRONOUS under
 *     test mode (app.src.jsx:1116) — the poison is replaced at the moment of grading;
 *     _flushSave() is the explicit belt-and-suspenders pin before reading storage back.
 *   - boot({preserveStorage:true}) re-ingests the HEALED blob: stored v===2, prep[deckKey]>=1
 *     both stored and in-memory, and the raw string never equals the poison again.
 *
 * SEEDING RECIPE (the personas.ts docstring recipe is WRONG — an addInitScript registered
 * before the first boot runs AHEAD of the DSL wipe, which then clears the poison):
 *   1. throwaway j.boot("/") FIRST, so the DSL wipe/ngseed init scripts register ahead of ours;
 *   2. THEN addInitScript writing CORRUPT_BLOB_RAW, guarded by a ONE-SHOT sessionStorage flag.
 *      Init scripts accumulate across boots; without the flag the preserveStorage boot would
 *      re-poison storage and fake a "resurrection" bug. The DSL wipe clears the flag on wiping
 *      boots (re-seeding there is exactly right) while a preserving boot keeps it (skip);
 *   3. boot again — navigation order: old-page pagehide _flushSave (app.src.jsx:341 — why
 *      evaluate+preserveStorage seeding also fails: the dying instance overwrites the poison
 *      with a valid blob) → DSL wipe → ngseed → our seed. The raw===CORRUPT_BLOB_RAW sanity
 *      assert after boot 2 is the seed-order proof.
 *
 * land() rigs the intro's ambient draws (ai-skill/role/max-moves) internally; mc-pick
 * (20-deep) + mc-shuffle (8-deep) cover MC pooling, whose rejections consume extra draws.
 * Assertions are structural only (versions, key counts, deckKeys, beats) — never card text.
 *
 * v1.70 re-validation: v1.68 flipped the sidebar answer-mode default auto→classic (no _mc
 * without opt-in) and added the question-first landing. The seed here IS the poison (an
 * unparseable string), so settings cannot ride the blob — and the REAL settings path is
 * unusable too: set() calls _saveProgress(), which would REPLACE the poison before the
 * first grade and destroy the byte-identical quarantine premise. Hence a plain in-memory
 * settings assignment after boot 2 (writes nothing): mcMode="auto" restores the authored-era
 * MC surface; landQuestions=false keeps the landing card (and its unrigged land-mc-* draws)
 * out of the poisoned life. The heal then persists these settings inside the healed v2 blob,
 * so the preserveStorage boot 3 stays consistent with them.
 */

const LESSON1: any = CURRICULUM.belts?.[0]?.units?.[0]?.lessons?.[0] ?? null
const KEY = "bjj-neural-progress"

const MC_PICK = [0.13, 0.47, 0.79, 0.11, 0.29, 0.41, 0.53, 0.67, 0.83, 0.91, 0.07, 0.37, 0.59, 0.73, 0.97, 0.19, 0.31, 0.43, 0.61, 0.89]
const MC_SHUFFLE = [0.21, 0.62, 0.34, 0.88, 0.14, 0.52, 0.76, 0.28]

test("corrupt blob: fresh fallback, byte-identical quarantine, first grade heals, healed blob survives reload", async ({ page }) => {
  test.skip(!LESSON1?.deckKey, "curriculum lost white unit-1 lesson-1 — the drill premise is gone")
  expect(() => JSON.parse(CORRUPT_BLOB_RAW), "persona premise: the corrupt blob must not parse").toThrow()

  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))

  const j = journey(page)

  // ── Boot 1 (throwaway): registers the DSL wipe/ngseed init scripts AHEAD of our seed ──
  await j.boot("/")

  // ── One-shot poison seed: runs AFTER the DSL wipe on every later boot, writes only once —
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
    }
  }, KEY)
  expect(fallback.raw, "seed-order proof: the poison survived boot 2's flush+wipe gauntlet").toBe(CORRUPT_BLOB_RAW)
  expect(fallback.blobV, "fallback profile re-serializes as v2 in memory").toBe(2)
  expect(fallback.prepKeys, "fresh fallback: zero prep keys ingested from the poison").toBe(0)
  expect(fallback.recKeys, "fresh fallback: zero rec keys ingested from the poison").toBe(0)

  // ── v1.70: authored-era study surface, IN MEMORY only — set() would _saveProgress() and
  //    heal the poison prematurely; a plain assignment writes nothing (see header) ──
  await page.evaluate(() => {
    const a = (window as any).__neural
    a.settings = Object.assign({}, a.settings, { mcMode: "auto", landQuestions: false })
  })

  // ── The poisoned boot is fully playable: land, then open the lesson-1 drill ──
  await j.land("Mount Top")
  await j.expectBeat("land")
  await j.expectBeat("options_dealt")
  await j.rig("mc-pick", MC_PICK)
  await j.rig("mc-shuffle", MC_SHUFFLE)
  await page.evaluate(() => (window as any).__neural.toggleExplorer())
  await page.locator(`[data-lesson="${LESSON1.deckKey}"]`).first().click()
  await j.advance(800)

  // ── Quarantine: byte-identical through land + drill-open (no boot-time writes) ──
  expect(
    await page.evaluate((key) => localStorage.getItem(key), KEY),
    "corrupt string byte-identical in storage through land + drill-open",
  ).toBe(CORRUPT_BLOB_RAW)

  // ── Present the first MC-able card (unclippable answers legitimately fall back to recall;
  //    probe with mcClip ONLY — an mcDistractors probe would consume the rig queues) ──
  const qhash = await page.evaluate(() => {
    const a = (window as any).__neural
    for (const c of a.deck || []) {
      if (a.mcClip(c.a)) {
        const qh = a.qhash(c.q)
        a.presentCard(qh)
        return qh
      }
    }
    return null
  })
  expect(qhash, "lesson 1 holds at least one MC-able card").toBeTruthy()

  // truth rail (_mc — the DOM never carries the correct index), read together with storage:
  // presentCard wrote nothing, so the GRADE below is provably the healer
  const truth = await page.evaluate((key) => {
    const a = (window as any).__neural
    return a._mc ? { correct: a._mc.correct, key: a._mc.key, rawAfterPresent: localStorage.getItem(key) } : null
  }, KEY)
  expect(truth, "MC truth rail live for the presented card").toBeTruthy()
  expect(truth!.key, "the presented card grades into the opened lesson deck").toBe(LESSON1.deckKey)
  expect(truth!.rawAfterPresent, "present alone wrote nothing — storage still the poison").toBe(CORRUPT_BLOB_RAW)

  // ── First grade: the heal ──
  await page.locator("[data-mc-opt]").nth(truth!.correct).click()
  await j.expectBeat("mc_correct")
  await j.advance(700)

  const healed = await page.evaluate(
    ([key, dk]) => {
      const a = (window as any).__neural
      a._flushSave() // explicit pin (the grade's _saveProgress already wrote synchronously in test mode)
      const raw = localStorage.getItem(key)
      let parsed: any = null
      let parseOk = false
      try {
        parsed = JSON.parse(raw || "")
        parseOk = true
      } catch {}
      return { raw, parseOk, v: parsed?.v, prepAtKey: parsed?.prep?.[dk], memPrep: a.prep[dk] || 0 }
    },
    [KEY, LESSON1.deckKey as string] as const,
  )
  expect(healed.raw, "the poison was REPLACED by the first grade").not.toBe(CORRUPT_BLOB_RAW)
  expect(healed.parseOk, "stored blob parses again").toBe(true)
  expect(healed.v, "stored blob is v2").toBe(2)
  expect(healed.prepAtKey, "stored prep carries the graded deckKey (>=1)").toBeGreaterThanOrEqual(1)
  expect(healed.memPrep, "in-memory prep for the graded deckKey (>=1)").toBeGreaterThanOrEqual(1)

  // ── Boot 3 (preserveStorage): the healed blob — not the poison — is what loads ──
  await j.boot("/", { preserveStorage: true })
  await j.land("Mount Top")
  await j.expectBeat("options_dealt")

  const post = await page.evaluate(
    ([key, dk]) => {
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
        storedPrep: parsed?.prep?.[dk],
        memV: a._progressBlob().v,
        memPrep: a.prep[dk] || 0,
      }
    },
    [KEY, LESSON1.deckKey as string] as const,
  )
  expect(post.parseOk, "post-reload JSON.parse of stored progress succeeds").toBe(true)
  expect(post.raw, "the poison never resurrects (one-shot seed did not refire)").not.toBe(CORRUPT_BLOB_RAW)
  expect(post.storedV, "post-reload stored blob is v2").toBe(2)
  expect(post.storedPrep, "graded prep key persisted in storage across the reload").toBeGreaterThanOrEqual(1)
  expect(post.memV, "post-reload _progressBlob().v === 2").toBe(2)
  expect(post.memPrep, "graded prep key re-ingested in memory across the reload").toBeGreaterThanOrEqual(1)

  // ── Crash guard: corrupt read, heal, and reload all ran with zero page errors ──
  expect(errors, "no pageerror across poison boot + heal + reload").toEqual([])
})
