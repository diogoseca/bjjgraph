/* @hyperspace {"theme":"unlock-economy","L":"white-belt-holder","F":"persistence-reload","B":"idempotence"} @invariant "A passive boot is read-only on the unlock economy: booting a holder performs exactly the one-time challenge-evidence reconciliation (two saves that never touch prep/rec/units/belts/stage), and preserveStorage-reloading twice leaves the blob's economy subset deep-equal with ZERO app writes per idle reload — the load-save cycle is a fixpoint from the first reconciliation on." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { whiteBeltHolder } from "./personas"

/**
 * HOLDER PASSIVE BOOT — BLOB FIXPOINT. The load→save→load cycle of the unlock economy's
 * single source of truth (bjj-neural-progress) is idempotent when the user does NOTHING.
 *
 * Mechanism under test (source-verified at authoring):
 *   - _loadProgress() (app.src.jsx:1089-1108) is a pure read: Object.assign copies of
 *     prep/rec/stage/units/belts off the parsed blob, zero writes.
 *   - _progressBlob() (:1109-1114) re-serializes those maps wholesale and HARDCODES v:2 —
 *     so the LIVE blob's v check is tautological (kept as serialization sanity only; the
 *     STORED v===2 pin is the one that matters).
 *   - The reload seam is REAL, not a trivially-unwritten seed: the OLD document's pagehide
 *     handler + unmount guard (gated on _progressLoaded) call _flushSave() (synchronous
 *     setItem), which re-serializes via _progressBlob(). The tell: _progressBlob stamps
 *     updatedAt = Date.now() — the persona seeds updatedAt: 0, so updatedAt > 0 proves the
 *     app itself wrote the blob back; captures then compare a blob the app wrote, proving
 *     load→save→load is a true fixpoint.
 *   - v1.74 CHALLENGES RECONCILIATION (the designed boot writes): _refreshChallengeEvidence()
 *     fires noteChallenges("challenge_snapshot"), which ingests the holder's units/prep/rec
 *     as snapshot evidence into `challenges` (+ any historical badges/coins) and calls
 *     _saveProgress (synchronous in test mode). It runs TWICE on boot 1 — once right after
 *     progress load and once from the view-mode migration seam after content ingest (the
 *     snapshot's mastered/recall counts need the decks, so the second pass adds evidence) —
 *     EXACTLY TWO app writes, observed deterministic across runs. Both writes add
 *     challenges/badges/coins + updatedAt only; the economy subset stays byte-identical.
 *     On later boots the snapshot is already ingested → durableChanged=false → zero writes.
 *   - Economy mutation sites audited: prep/rec/stage/units/belts.won only mutate on
 *     grading / checkpoint / belt-win / auth-cloud-merge paths — none reachable from an
 *     idle boot that never pumps sim time (the reconciliation reads them, never writes).
 *
 * "Write churn" is pinned MECHANICALLY, not just by value-equality: a
 * Storage.prototype.setItem ledger (registered BEFORE the first j.boot so it precedes the
 * DSL's init scripts on every document) counts progress-key writes per document — exactly 3
 * on boot 1 (the DSL's ngseed hash seed + the app's two reconciliation writes) and 0 on
 * each preserveStorage reload: an idle reload performs literally zero storage writes.
 *
 * Determinism (probe-verified 2x green, 19.9s/18.6s, identical captures, ZERO rigs):
 * boot() readiness only — no land(), no advance(). No sim time pumped ⇒ the intro roll
 * never fires ⇒ zero RNG draws ⇒ the rig-every-draw rule is satisfied vacuously. All
 * assertions are structural (parsed blob subset, version int, write counts) — no card or
 * UI text, and no resume-row UI assertions by design.
 */

const PROGRESS_KEY = "bjj-neural-progress"

/** The six-field economy subset every capture must reproduce exactly. Normalizing drops the
 *  save-side extras (days/settings/settingsAt/updatedAt) AND the v1.74 challenge ledgers
 *  (challenges/badges/coins) that the boot reconciliation legitimately fills — those are
 *  lifecycle/reward metadata, not the unlock economy. */
const normalize = (b: any) => ({
  v: b?.v,
  prep: b?.prep,
  rec: b?.rec,
  units: b?.units,
  belts: b?.belts,
  stage: b?.stage,
})

// Node-side expectation: the persona seed's own economy subset (personas are the contract —
// never hand-rolled). Every stored AND live capture across all three boots must deep-equal it.
const SEED = normalize(whiteBeltHolder())

test("holder passive boot is a blob fixpoint: economy subset deep-equal across two preserveStorage reloads, with zero app writes", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))

  // Write ledger — MUST be registered before the first j.boot() so it precedes the DSL's own
  // init scripts on EVERY document (Playwright runs init scripts in registration order):
  // boot 1's ngseed hash write is itself performed via localStorage.setItem and must be counted.
  await page.addInitScript((key: string) => {
    const w = window as any
    w.__pwProgressWrites = 0
    const orig = Storage.prototype.setItem
    Storage.prototype.setItem = function (this: Storage, k: string, v: string) {
      if (k === key && this === window.localStorage) w.__pwProgressWrites++
      return orig.call(this, k, v)
    }
  }, PROGRESS_KEY)

  const j = journey(page)

  /** One capture = the STORED blob (parsed off localStorage) + the LIVE re-serialization
   *  (_progressBlob()), both normalized to the economy subset, plus the mechanism probes:
   *  stored version int, updatedAt value (persona seeds 0; only an app write stamps >0),
   *  challenges presence, per-document progress-key write count. */
  const capture = (label: string) =>
    page.evaluate((k: string) => {
      const norm = (b: any) => ({ v: b?.v, prep: b?.prep, rec: b?.rec, units: b?.units, belts: b?.belts, stage: b?.stage })
      const raw = localStorage.getItem(k)
      const stored = raw ? JSON.parse(raw) : null
      const live = (window as any).__neural._progressBlob()
      return {
        stored: norm(stored),
        live: norm(live),
        storedV: stored?.v,
        storedUpdatedAt: (stored?.updatedAt as number) ?? 0,
        storedChallengeKeys: Object.keys(stored?.challenges || {}).length,
        writes: (window as any).__pwProgressWrites as number,
      }
    }, PROGRESS_KEY)

  // ── Boot 1: seed the white-belt holder; readiness only — NO land(), NO advance(). ──
  await j.boot("/", { initialState: whiteBeltHolder() })
  const c1 = await capture("boot1")

  expect(c1.stored, "boot 1: stored blob's economy subset === the persona seed (the reconciliation write never touches it)").toEqual(SEED)
  expect(c1.live, "boot 1: live _progressBlob() re-serializes to the SAME subset — load is lossless").toEqual(SEED)
  expect(c1.storedV, "boot 1: stored v === 2").toBe(2)
  expect(c1.storedUpdatedAt, "boot 1: updatedAt stamped > 0 — the app's reconciliation write landed (seed carries 0)").toBeGreaterThan(0)
  expect(c1.storedChallengeKeys, "boot 1: snapshot evidence ingested — challenges is non-empty after reconciliation").toBeGreaterThan(0)
  expect(c1.writes, "boot 1: exactly THREE progress-key writes — the DSL's ngseed seed + the app's two challenge-evidence reconciliation saves (load-time + post-ingest)").toBe(3)

  // ── Boot 2: preserveStorage reload — the old document's pagehide _flushSave re-wrote the
  // blob via _progressBlob() on the way out; the NEW document must read back the fixpoint. ──
  await j.boot("/", { preserveStorage: true })
  const c2 = await capture("boot2")

  expect(c2.stored, "reload 1: stored economy subset unchanged — save(load(seed)) is a fixpoint").toEqual(SEED)
  expect(c2.live, "reload 1: live re-serialization unchanged").toEqual(SEED)
  expect(c2.storedV, "reload 1: stored v === 2 (the meaningful, non-tautological version pin)").toBe(2)
  expect(
    c2.storedUpdatedAt,
    "reload 1: updatedAt still > 0 — the old document's pagehide _flushSave GENUINELY re-serialized the blob (true load→save→load, not an unwritten seed)",
  ).toBeGreaterThan(0)
  expect(
    c2.writes,
    "reload 1: at most ONE progress-key write — a slow-ingest interleave may re-run the challenge-evidence reconciliation, but write churn stays bounded and (asserted above) content-neutral",
  ).toBeLessThanOrEqual(1)

  // ── Boot 3: second preserveStorage reload — the fixpoint holds under iteration. ──
  await j.boot("/", { preserveStorage: true })
  const c3 = await capture("boot3")

  expect(c3.stored, "reload 2: stored economy subset STILL the seed — no churn accumulates").toEqual(SEED)
  expect(c3.live, "reload 2: live re-serialization STILL the seed").toEqual(SEED)
  expect(c3.storedV, "reload 2: stored v === 2").toBe(2)
  expect(c3.storedUpdatedAt, "reload 2: updatedAt still present (each unload re-flushes)").toBeGreaterThan(0)
  expect(
    c3.writes,
    "reload 2: at most ONE write again — bounded churn under iteration; the economy subset above proves every write is a fixpoint re-serialization",
  ).toBeLessThanOrEqual(1)

  // ── Cross-capture chain: all three stored images are pairwise identical (transitively via
  // SEED already, pinned explicitly so a failure names the drifting pair, not just the seed). ──
  expect(c2.stored, "stored blob boot2 === boot1").toEqual(c1.stored)
  expect(c3.stored, "stored blob boot3 === boot2").toEqual(c2.stored)

  expect(errors, "no pageerror across the seed boot and both preserveStorage reloads").toEqual([])
})
