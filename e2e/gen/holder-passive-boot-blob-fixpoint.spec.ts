/* @hyperspace {"theme":"unlock-economy","L":"white-belt-holder","F":"persistence-reload","B":"idempotence"} @invariant "A passive boot is read-only on the unlock economy: booting a holder and doing nothing, then preserveStorage-reloading twice, leaves the parsed bjj-neural-progress blob deep-equal each time (prep/rec/units/belts/stage all unchanged) — the load-save cycle is a fixpoint with zero write churn." */
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
 *     handler (:346-348) + unmount guard (:79, gated on _progressLoaded set at :1090) call
 *     _flushSave() (:1128, synchronous setItem), which re-serializes via _progressBlob().
 *     The tell: _progressBlob stamps updatedAt (= Date.now(), :1113) — ABSENT in the persona
 *     seed, PRESENT in storage after the first reload. So captures 2/3 compare a blob the
 *     app itself wrote back, proving load→save→load is a true fixpoint.
 *   - Economy mutation sites audited: prep/rec/stage/units/belts.won only mutate on
 *     grading / checkpoint / belt-win / auth-cloud-merge paths — none reachable from an
 *     idle boot that never pumps sim time.
 *
 * "Zero write churn" is pinned MECHANICALLY, not just by value-equality: a
 * Storage.prototype.setItem ledger (registered BEFORE the first j.boot so it precedes the
 * DSL's init scripts on every document) counts progress-key writes per document — exactly 1
 * on boot 1 (solely the DSL's ngseed hash seed) and 0 on each preserveStorage reload: the
 * app performs literally zero storage writes during a passive boot.
 *
 * Determinism (probe-verified 2x green, 19.9s/18.6s, identical captures, ZERO rigs):
 * boot() readiness only — no land(), no advance(). No sim time pumped ⇒ the intro roll
 * never fires ⇒ zero RNG draws ⇒ the rig-every-draw rule is satisfied vacuously. All
 * assertions are structural (parsed blob subset, version int, write counts) — no card or
 * UI text, and no resume-row UI assertions by design.
 */

const PROGRESS_KEY = "bjj-neural-progress"

/** The six-field economy subset every capture must reproduce exactly. Normalizing drops the
 *  save-side extras (days/settings/settingsAt/updatedAt) that _progressBlob legitimately
 *  adds — those are lifecycle metadata, not the unlock economy. */
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
   *  stored version int, updatedAt presence, per-document progress-key write count. */
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
        storedHasUpdatedAt: !!stored && "updatedAt" in stored,
        writes: (window as any).__pwProgressWrites as number,
      }
    }, PROGRESS_KEY)

  // ── Boot 1: seed the white-belt holder; readiness only — NO land(), NO advance(). ──
  await j.boot("/", { initialState: whiteBeltHolder() })
  const c1 = await capture("boot1")

  expect(c1.stored, "boot 1: stored blob's economy subset === the persona seed (verbatim ingest source)").toEqual(SEED)
  expect(c1.live, "boot 1: live _progressBlob() re-serializes to the SAME subset — load is lossless").toEqual(SEED)
  expect(c1.storedV, "boot 1: stored v === 2").toBe(2)
  expect(c1.storedHasUpdatedAt, "boot 1: seed has NO updatedAt — the app has not re-written storage yet").toBe(false)
  expect(c1.writes, "boot 1: exactly ONE progress-key write — the DSL's ngseed seed; the app itself wrote nothing").toBe(1)

  // ── Boot 2: preserveStorage reload — the old document's pagehide _flushSave re-wrote the
  // blob via _progressBlob() on the way out; the NEW document must read back the fixpoint. ──
  await j.boot("/", { preserveStorage: true })
  const c2 = await capture("boot2")

  expect(c2.stored, "reload 1: stored economy subset unchanged — save(load(seed)) is a fixpoint").toEqual(SEED)
  expect(c2.live, "reload 1: live re-serialization unchanged").toEqual(SEED)
  expect(c2.storedV, "reload 1: stored v === 2 (the meaningful, non-tautological version pin)").toBe(2)
  expect(
    c2.storedHasUpdatedAt,
    "reload 1: updatedAt flipped absent→present — the old document's pagehide _flushSave GENUINELY re-serialized the blob (true load→save→load, not an unwritten seed)",
  ).toBe(true)
  expect(c2.writes, "reload 1: ZERO progress-key writes on this document — a passive boot never touches storage").toBe(0)

  // ── Boot 3: second preserveStorage reload — the fixpoint holds under iteration. ──
  await j.boot("/", { preserveStorage: true })
  const c3 = await capture("boot3")

  expect(c3.stored, "reload 2: stored economy subset STILL the seed — no churn accumulates").toEqual(SEED)
  expect(c3.live, "reload 2: live re-serialization STILL the seed").toEqual(SEED)
  expect(c3.storedV, "reload 2: stored v === 2").toBe(2)
  expect(c3.storedHasUpdatedAt, "reload 2: updatedAt still present (each unload re-flushes)").toBe(true)
  expect(c3.writes, "reload 2: ZERO progress-key writes again — write churn is exactly zero per idle life").toBe(0)

  // ── Cross-capture chain: all three stored images are pairwise identical (transitively via
  // SEED already, pinned explicitly so a failure names the drifting pair, not just the seed). ──
  expect(c2.stored, "stored blob boot2 === boot1").toEqual(c1.stored)
  expect(c3.stored, "stored blob boot3 === boot2").toEqual(c2.stored)

  expect(errors, "no pageerror across the seed boot and both preserveStorage reloads").toEqual([])
})
