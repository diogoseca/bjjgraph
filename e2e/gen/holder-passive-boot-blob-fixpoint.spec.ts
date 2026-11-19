/* @hyperspace {"theme":"unlock-economy","L":"white-belt-holder","F":"persistence-reload","B":"idempotence"} @invariant "A passive boot is read-only on the unlock economy in EITHER arrival order of the deck manifest and the curriculum: boot 1 runs the challenge-evidence reconciliation and the one-time belt grandfather (held raised to blue and saved at once; the mark belts.gf saved with it when the manifest is already resident, otherwise set live and carried by the next real save: the unload flush, or an in-session save when the tab dies first), and from then on preserveStorage reloads leave the blob's economy subset deep-equal, with no second promotion, the mark never re-minted, and one explained write on reload 1 then none." */
import { test, expect, type Page } from "@playwright/test"
import { journey } from "../dsl"
import { whiteBeltHolder } from "./personas"

/**
 * HOLDER PASSIVE BOOT — BLOB FIXPOINT, IN BOTH ARRIVAL ORDERS. The load→save→load cycle of the
 * unlock economy's single source of truth (bjj-neural-progress) is idempotent when the user does
 * NOTHING, whichever of the two boot payloads lands first.
 *
 * ── THE RACE THIS SPEC USED TO LOSE (v1.263.3, run 43274514779; and once before, filed as a
 * "load-sensitive flake" in docs/Changelog-Archive.md at v1.129) ──
 * Boot fetches the deck manifest (flashcards/_index.json → onFlashcardsReady) and curriculum.json
 * (→ _onCurriculum) in parallel, and the app promises no order between them. The one-time belt
 * grandfather (`_syncBelt`, "THE ONE-TIME GRANDFATHER") raises the held belt as soon as the
 * curriculum is resident and SAVES AT ONCE, but sets the mark `belts.gf` only once the manifest is
 * resident too, and the mark "rides the NEXT save rather than forcing one". So:
 *   order A, manifest first:   the raise runs with the manifest already there → one save stores
 *                              held AND the mark.
 *   order B, curriculum first: the raise saves held UNMARKED; the manifest then sets the mark live,
 *                              writes nothing, and the next real save carries it.
 * The old single test asserted order A's outcome straight after boot and went red whenever B won
 * (stored `held: blue`, no `gf`, at its line 130). Crossed before this rewrite, app untouched, the
 * old spec with only the order forced: A 10 of 10 green, B 10 of 10 red at that line with exactly
 * the CI diff. Neither order loses or double-counts anything (see the third case); the spec now
 * RIGS each order and pins the contract of each, instead of hoping for one.
 *
 * ── THE RIG (`rigOrder`) ── the second payload's response is held until the first is RESIDENT in
 * the app (a waitForFunction on `__neural.flashcards.decks` / `__neural.curriculum`), never for a
 * time, then falls through to the DSL's own handler. It snapshots the state at the instant it
 * releases — that snapshot is how order B proves "saved at once, unmarked" BEFORE the manifest
 * exists — and every boot asserts the rig fired exactly once with the expected residency, so a
 * rig that silently matched nothing cannot leave the order to chance again.
 *
 * ── EVERY WRITE, AND WHY (measured with a per-write diff against the blob before it) ──
 * A Storage.prototype.setItem ledger, registered BEFORE the first j.boot so it precedes the DSL's
 * init scripts on every document, records each progress-key write and what it stored (held, mark).
 *   boot 1, A: 4 = the DSL's ngseed seed · the manifest's challenge-evidence pass
 *              (`_refreshChallengeEvidence → noteChallenges → _saveProgress`; the deck counts) ·
 *              the curriculum's pass (the lesson evidence) · the grandfather's raise, marked.
 *   boot 1, B: 3 = ngseed · the curriculum's pass (all of that evidence in one write) · the raise,
 *              unmarked. The manifest's own pass then finds nothing new: NO write after it.
 *   reload 1:  1 when boot 1's unload save ran = the first evidence pass minting the
 *              `white-foundations` badge for the 20 White objectives that boot()'s tutorial step
 *              completed IN MEMORY after boot 1's last write (boot 1's unload save stored them).
 *              It is a HARNESS write, not the belt's. 0 when the tab died before that save.
 *   reload 2:  0 — an idle reload writes nothing.
 * None of these writes touches prep/rec/units/stage; only the raise and the mark touch belts.
 *
 * ── THE RELOAD SEAM IS REAL ── the OLD document's pagehide handler (`_csArmHide`, gated on
 * `_progressLoaded`) calls `_flushSave()`, which re-serializes the live blob via `_progressBlob()`.
 * That flush is the "next real save" of order B: boot 2 reads the mark boot 1 set live, with the
 * SAME timestamp. The third case removes those two listeners (pagehide, visibilitychange) — there
 * is no player action for a killed tab — and shows the other side: unmarked boots re-run the
 * grandfather, raise nothing, fire no second `belt_promoted`, write nothing, and the first
 * in-session save (the daily-goal setting, as its Settings field writes it) carries the mark.
 * `_progressBlob()` hardcodes v:2, so the LIVE v is tautological; the STORED v===2 pin is the one
 * that matters. Determinism: boot() readiness only — no land(), no advance(), so no sim time, no
 * RNG draw (the rig-every-draw rule is satisfied vacuously).
 *
 * ── WHERE EACH ASSERTION OF THE OLD SINGLE TEST LIVES NOW ── (old line → here)
 *   130 stored === migrated seed  → A boot 1; B: stored === RAISED at the release and after boot,
 *                                    and === MIGRATED from boot 2 (the unload save) or after the
 *                                    first in-session save (case 3)
 *   131 live === migrated seed    → every case, boot 1 (B: once the manifest is resident)
 *   132-134 stored v, updatedAt>0, challenges non-empty → every case, boot 1
 *   135 four writes               → A: 4, the ledger write by write; B: 3, and none after the manifest
 *   142-144, 158-160 reloads' stored/live subset and v → every case (case 3: stored stays RAISED)
 *   145-148, 161 updatedAt > 0    → every case; case 3 also pins it UNCHANGED (nothing wrote)
 *   149-152, 162-165 ≤ 1 write    → tightened: exactly 1 then 0 (0 then 0 in case 3), with reasons
 *   169-170 stored chain          → A: boot1 = boot2 = boot3; B: boot2 = boot1 plus the mark only;
 *                                    case 3: boot1 = boot2 = boot3
 *   172 no pageerror              → every case
 * Added: exactly one `belt_promoted` across all boots; the held belt's stamp and the mark's stamp
 * never re-minted; the rig's own coverage per boot.
 *
 * ── MUTANTS (v1.264.3: the served bundle edited in place, all three cases per mutant, restored and
 * hash-checked after; the clean bundle 15 of 15 green first). Killed at, by assertion message: ──
 *   M1  the mark never set (`gf` not assigned)       A "boot 1: stored economy subset === … marked";
 *                                                    B and case 3 "boot 1: live _progressBlob() …"
 *   M2  the mark forcing a save (dirty with it)      B and case 3 "boot 1, manifest resident: stored
 *                                                    STILL unmarked"; A SURVIVES: there the raise
 *                                                    saves anyway, so the forced save is the same one
 *   M3a the one-time guard ignored (re-runs on every sync)  A and B "reload 1: the mark is not
 *                                                    re-minted"; case 3 survives by design (an
 *                                                    unmarked blob IS re-grandfathered)
 *   M3b the mark dropped on load (re-runs every boot) A and B "reload 1: stored economy subset is the
 *                                                    migrated seed"; case 3 survives by design
 *   M3c the raise re-firing (`before` read as white) A "reload 1: NO second belt_promoted"; B and
 *                                                    case 3 "boot 1, manifest resident: stored STILL
 *                                                    unmarked" (the re-raise saves, carrying the mark)
 *   M4  the raised belt not saved at once            A "boot 1: stored economy subset === … marked";
 *                                                    B and case 3 "boot 1, before the manifest: the
 *                                                    raised belt is ALREADY stored"
 *   No mutant survives every case. Control: the OLD single test, run with order B rigged, red at its
 *   line 130 (3 of 3); with order A rigged, green (3 of 3).
 */

const PROGRESS_KEY = "bjj-neural-owner:guest:progress"

/** The six-field economy subset every capture must reproduce exactly. Normalizing drops the
 *  save-side extras (days/settings/settingsAt/updatedAt) AND the v1.74 challenge ledgers
 *  (challenges/badges/coins) that the boot reconciliation legitimately fills — those are
 *  lifecycle/reward metadata, not the unlock economy. */
const normalize = (b: any) => ({
  v: b?.v,
  prep: b?.prep,
  rec: b?.rec,
  units: b?.units,
  belts: beltsOf(b?.belts),
  stage: b?.stage,
})

/** `belts` with the two v1.211.0 stamps reduced to what they MEAN — the held belt's id and "the
 *  one-time grandfather has run" — so a capture compares on content, not on the clock. The raw
 *  stamps are captured separately, where the clock IS the claim (carried, not re-minted). */
function beltsOf(belts: any) {
  if (!belts) return belts
  const out: any = { ...belts }
  if (out.held) out.held = { id: out.held.id }
  if (out.gf) out.gf = true
  if (out.lvl) out.lvl = { n: out.lvl.n }   // v1.276.0: the held level, its stamp reduced the same way
  return out
}

// Node-side expectation: the persona seed's own economy subset (personas are the contract —
// never hand-rolled).
const SEED = normalize(whiteBeltHolder())
// v1.211.0 (owner): the belt is earned in the Challenges and was GRANDFATHERED once. This holder
// proved every White unit, so the first boot raises it to the belt it wears — blue. RAISED is that
// belt saved WITHOUT the mark (order B, until the next save); MIGRATED is the belt plus the mark.
// They are the ONLY changes to the economy subset, and they happen on boot 1 alone.
// v1.276.0: the same boot also seeds the HELD LEVEL (`belts.lvl`, the drawer row's belt) at the Path's level, blue with no
// stripe (5), inside the same `_syncBelt` call that raises the belt, so it rides the raise's own save and adds no write.
// Before v1.276.0 these were `{ held: { id: "blue" } }` and `{ held: { id: "blue" }, gf: true }`: the level is the one
// value added, and every assertion below otherwise reads exactly as it did.
const RAISED = (seed: any) => ({ ...seed, belts: { ...seed.belts, held: { id: "blue" }, lvl: { n: 5 } } })
const MIGRATED = (seed: any) => ({ ...seed, belts: { ...seed.belts, held: { id: "blue" }, gf: true, lvl: { n: 5 } } })

type Order = "manifest-first" | "curriculum-first"

/** One capture, in the page: the STORED blob (off localStorage) and the LIVE re-serialization
 *  (`_progressBlob()`), both reduced to the economy subset, plus the mechanism probes. Self-contained
 *  because Playwright ships it to the page by source; the rig calls it too, at its release. */
const readState = (k: string) => {
  const w = window as any
  const a = w.__neural
  // the same reduction as `beltsOf` above (v1.211.0 stamps → their meaning), in the page
  const belts = (x: any) => (!x ? x : { ...x, ...(x.held ? { held: { id: x.held.id } } : {}), ...(x.gf ? { gf: true } : {}), ...(x.lvl ? { lvl: { n: x.lvl.n } } : {}) })
  const norm = (b: any) => ({ v: b?.v, prep: b?.prep, rec: b?.rec, units: b?.units, belts: belts(b?.belts), stage: b?.stage })
  const raw = w.__ngGuestProgressRaw()
  const stored = raw ? JSON.parse(raw) : null
  const live = a && a._progressBlob ? a._progressBlob() : null
  const ledger = (w.__pwProgressWrites || []) as Array<{ held: string | null; gf: boolean }>
  return {
    stored: norm(stored),
    live: norm(live),
    storedV: stored?.v,
    storedUpdatedAt: (stored?.updatedAt as number) ?? 0,
    storedChallengeKeys: Object.keys(stored?.challenges || {}).length,
    storedBadges: Object.keys(stored?.badges || {}),
    storedGf: (stored?.belts?.gf as number) ?? null,
    liveGf: (live?.belts?.gf as number) ?? null,
    storedHeldT: (stored?.belts?.held?.t as number) ?? null,
    decks: !!a?.flashcards?.decks,
    curriculum: !!a?.curriculum,
    writes: ledger.length,
    // per write, in order: the held belt and the mark THAT write stored
    ledger: ledger.map((x) => [x.held, x.gf] as [string | null, boolean]),
    promoted: ((a?.beats || []) as any[]).filter((b) => b.beat === "belt_promoted").map((b) => ({ belt: b.belt, from: b.from })),
  }
}
type State = ReturnType<typeof readState>

/** THE ORDER, RIGGED (see header). Registered from boot 1's `beforeNavigate`, i.e. AFTER the DSL's
 *  routes, so it is matched first (Playwright matches last-first); registered once, so it stays on
 *  the page and boots 2 and 3 run in the same order. */
function rigOrder(order: Order) {
  const held = order === "manifest-first" ? "**/curriculum.json" : "**/flashcards/_index.json"
  const releases: Array<{ boot: number; ok: boolean; at: State | null }> = []
  let boot = 0
  let armed = false
  const beforeNavigate = async (p: Page) => {
    boot++
    if (armed) return
    armed = true
    await p.route(held, async (route) => {
      const b = boot
      let ok = true
      try {
        if (order === "manifest-first")
          await p.waitForFunction(() => !!(window as any).__neural?.flashcards?.decks, undefined, { timeout: 60_000 })
        else await p.waitForFunction(() => !!(window as any).__neural?.curriculum, undefined, { timeout: 60_000 })
      } catch {
        ok = false // reported by expectRigged below rather than hanging the boot
      }
      const at = await p.evaluate(readState, PROGRESS_KEY).catch(() => null)
      releases.push({ boot: b, ok, at })
      try {
        await route.fallback()
      } catch {
        /* the page went away while this was held */
      }
    })
  }
  return { held, releases, beforeNavigate }
}

const CASES: Array<{ order: Order; unloadSave: boolean; title: string }> = [
  {
    order: "manifest-first",
    unloadSave: true,
    title: "holder passive boot is a blob fixpoint, deck manifest first: one write saves the raised belt and its mark, and two reloads change nothing",
  },
  {
    order: "curriculum-first",
    unloadSave: true,
    title: "holder passive boot is a blob fixpoint, curriculum first: the raised belt saves at once unmarked, the mark rides the unload save, and two reloads change nothing",
  },
  {
    order: "curriculum-first",
    unloadSave: false,
    title: "holder passive boot, curriculum first and the tab killed before its unload save: unmarked reloads promote nothing and write nothing, and the first real save carries the mark",
  },
]

for (const c of CASES)
  test(c.title, async ({ page }) => {
    const errors: string[] = []
    page.on("pageerror", (e) => errors.push(e.message))

    // Write ledger — MUST be registered before the first j.boot() so it precedes the DSL's own
    // init scripts on EVERY document (Playwright runs init scripts in registration order): boot 1's
    // ngseed write is itself a localStorage.setItem and must be counted. Per document.
    await page.addInitScript((key: string) => {
      const w = window as any
      w.__pwProgressWrites = []
      const orig = Storage.prototype.setItem
      Storage.prototype.setItem = function (this: Storage, k: string, v: string) {
        if (k === key && this === window.localStorage) {
          let belts: any = null
          try {
            belts = JSON.parse(v)?.blob?.belts ?? null
          } catch {}
          w.__pwProgressWrites.push({ held: belts?.held?.id ?? null, gf: !!belts?.gf })
        }
        return orig.call(this, k, v)
      }
    }, PROGRESS_KEY)

    const j = journey(page)
    const rig = rigOrder(c.order)
    const B = c.order === "curriculum-first"
    const first = B ? "the curriculum" : "the deck manifest"
    const capture = () => page.evaluate(readState, PROGRESS_KEY)
    /** the rig fired exactly once per boot so far, and released with the first payload resident and
     *  the second still absent — a positive count, so "never rigged" cannot pass as "rigged". */
    const expectRigged = (n: number) => {
      expect(rig.releases.map((r) => r.boot), `boot ${n}: the rig held ${rig.held} exactly once on every boot so far`).toEqual(Array.from({ length: n }, (_, i) => i + 1))
      const r = rig.releases[n - 1]
      expect(r.ok, `boot ${n}: ${first} became resident while the other payload was held`).toBe(true)
      expect({ decks: r.at?.decks, curriculum: r.at?.curriculum }, `boot ${n}: at the release only ${first} is resident`).toEqual(B ? { decks: false, curriculum: true } : { decks: true, curriculum: false })
      return r.at as State
    }
    /** The tab is killed before its unload save. Test-only by nature — no player action kills a
     *  process — so it removes exactly the app's two unload-save listeners (`_csArmHide`). */
    const killBeforeUnloadSave = () =>
      page.evaluate(() => {
        const a = (window as any).__neural
        window.removeEventListener("pagehide", a._onPageHide)
        document.removeEventListener("visibilitychange", a._onVisHide)
      })

    // ── Boot 1: seed the white-belt holder; readiness only — NO land(), NO advance(). ──
    await j.boot("/", { initialState: whiteBeltHolder(), beforeNavigate: rig.beforeNavigate })
    const r1 = expectRigged(1)
    const c1 = await capture()

    expect({ decks: c1.decks, curriculum: c1.curriculum }, "boot 1: both payloads are resident once boot() returns").toEqual({ decks: true, curriculum: true })
    if (!B) {
      expect(r1.stored, "boot 1, before the curriculum: no belt raised yet (the raise reads the curriculum)").toEqual(SEED)
      expect(r1.writes, "boot 1, before the curriculum: TWO writes — the DSL's ngseed seed + the manifest's challenge-evidence pass").toBe(2)
      expect(c1.stored, "boot 1: stored economy subset === the persona seed plus the one-time grandfather (held blue, marked)").toEqual(MIGRATED(SEED))
      expect(
        c1.ledger,
        "boot 1: exactly FOUR writes — ngseed, the manifest's evidence pass, the curriculum's evidence pass, and the grandfather's raise, which stores held AND the mark because the manifest was already resident",
      ).toEqual([[null, false], [null, false], [null, false], ["blue", true]])
      expect(c1.storedGf, "boot 1: the stored mark is the live one — one mark, minted once").toBe(c1.liveGf)
    } else {
      expect(r1.stored, "boot 1, before the manifest: the raised belt is ALREADY stored, unmarked — a raised belt saves at once").toEqual(RAISED(SEED))
      expect(r1.live, "boot 1, before the manifest: unmarked live too — the mark waits for the manifest's card counts").toEqual(RAISED(SEED))
      expect(
        r1.ledger,
        "boot 1, before the manifest: THREE writes — ngseed, the curriculum's evidence pass (all of it in one write), and the grandfather's raise, unmarked",
      ).toEqual([[null, false], [null, false], ["blue", false]])
      expect(c1.stored, "boot 1, manifest resident: stored STILL unmarked — the mark rides the next save rather than forcing one").toEqual(RAISED(SEED))
      expect(c1.writes, "boot 1: NO write after the manifest landed — its evidence pass finds nothing new and the mark does not force a save").toBe(r1.writes)
      expect(c1.storedGf, "boot 1: no mark in storage yet").toBeNull()
    }
    expect(c1.live, `boot 1: live _progressBlob() is the migrated seed (held blue, marked) once the manifest is resident — ${first} first`).toEqual(MIGRATED(SEED))
    expect(c1.liveGf, "boot 1: the live mark is a timestamp").toEqual(expect.any(Number))
    expect(c1.storedV, "boot 1: stored v === 2").toBe(2)
    expect(c1.storedUpdatedAt, "boot 1: updatedAt stamped > 0 — the app's own writes landed (the seed carries 0)").toBeGreaterThan(0)
    expect(c1.storedChallengeKeys, "boot 1: snapshot evidence ingested — challenges is non-empty after reconciliation").toBeGreaterThan(0)
    expect(c1.storedBadges, "boot 1: no white-foundations badge stored yet (boot()'s tutorial step runs after the app's last write)").not.toContain("white-foundations")
    expect(c1.promoted, "boot 1: exactly ONE belt_promoted beat, white → blue").toEqual([{ belt: "blue", from: "white" }])
    expect(c1.storedHeldT, "boot 1: the held belt carries its stamp").toEqual(expect.any(Number))

    // ── Boot 2: preserveStorage reload. With the unload save, the old document's pagehide
    // _flushSave re-serialized the live blob on the way out; without it, storage is what boot 1's
    // last write left. ──
    if (!c.unloadSave) await killBeforeUnloadSave()
    await j.boot("/", { preserveStorage: true, beforeNavigate: rig.beforeNavigate })
    expectRigged(2)
    const c2 = await capture()

    expect(c2.live, "reload 1: live re-serialization is the migrated seed").toEqual(MIGRATED(SEED))
    expect(c2.storedV, "reload 1: stored v === 2 (the meaningful, non-tautological version pin)").toBe(2)
    expect(c2.storedUpdatedAt, "reload 1: updatedAt still > 0").toBeGreaterThan(0)
    expect(c2.promoted, "reload 1: NO second belt_promoted — the belt is already held").toEqual([])
    expect(c2.storedHeldT, "reload 1: the held belt's stamp is boot 1's — never re-raised").toBe(c1.storedHeldT)
    if (c.unloadSave) {
      expect(c2.stored, "reload 1: stored economy subset is the migrated seed — save(load(seed)) is a fixpoint").toEqual(MIGRATED(SEED))
      expect(c2.storedGf, B ? "reload 1: the stored mark is the one boot 1 set live — carried by boot 1's unload save, the first real save after it" : "reload 1: the stored mark is boot 1's").toBe(c1.liveGf)
      expect(c2.liveGf, "reload 1: the mark is not re-minted — a marked blob is never grandfathered again").toBe(c2.storedGf)
      expect(
        c2.ledger,
        "reload 1: exactly ONE write, belts untouched — the evidence pass minting the white-foundations badge for the White objectives boot()'s tutorial step completed in memory on boot 1 (a harness write, stored by boot 1's unload save)",
      ).toEqual([["blue", true]])
      expect(c2.storedBadges, "reload 1: that one write is the white-foundations badge").toContain("white-foundations")
      if (B) expect(c2.stored, "stored blob boot2 === boot1 plus the mark — the only difference the unload save carried").toEqual({ ...c1.stored, belts: { ...c1.stored.belts, gf: true } })
      else expect(c2.stored, "stored blob boot2 === boot1").toEqual(c1.stored)
    } else {
      expect(c2.stored, "reload 1 after a killed tab: stored is still the raised, UNMARKED belt — nothing saved since boot 1").toEqual(RAISED(SEED))
      expect(c2.storedUpdatedAt, "reload 1 after a killed tab: updatedAt unchanged — not one write since boot 1's last").toBe(c1.storedUpdatedAt)
      expect(c2.writes, "reload 1 after a killed tab: ZERO writes — the grandfather re-runs on the unmarked blob, raises nothing, saves nothing (no tutorial badge either: boot 1's tutorial state was never stored)").toBe(0)
      expect(c2.liveGf, "reload 1 after a killed tab: the mark is set live again, waiting for the next save").toEqual(expect.any(Number))
      expect(c2.stored, "stored blob boot2 === boot1").toEqual(c1.stored)
    }

    // ── Boot 3: second preserveStorage reload — the fixpoint holds under iteration. ──
    if (!c.unloadSave) await killBeforeUnloadSave()
    await j.boot("/", { preserveStorage: true, beforeNavigate: rig.beforeNavigate })
    expectRigged(3)
    const c3 = await capture()

    expect(c3.live, "reload 2: live re-serialization STILL the migrated seed").toEqual(MIGRATED(SEED))
    expect(c3.storedV, "reload 2: stored v === 2").toBe(2)
    expect(c3.storedUpdatedAt, "reload 2: updatedAt still present").toBeGreaterThan(0)
    expect(c3.writes, "reload 2: ZERO writes — an idle reload writes nothing").toBe(0)
    expect(c3.promoted, "reload 2: NO second belt_promoted").toEqual([])
    expect(c3.storedHeldT, "reload 2: the held belt's stamp is still boot 1's").toBe(c1.storedHeldT)
    expect(c3.stored, "stored blob boot3 === boot2").toEqual(c2.stored)
    if (c.unloadSave) {
      expect(c3.stored, "reload 2: stored economy subset STILL the migrated seed — no churn accumulates").toEqual(MIGRATED(SEED))
      expect(c3.storedGf, "reload 2: the stored mark is still the one boot 1 set").toBe(c1.liveGf)
      expect(c3.liveGf, "reload 2: the mark is not re-minted").toBe(c3.storedGf)
    } else {
      expect(c3.stored, "reload 2 after a killed tab: still the raised, unmarked belt").toEqual(RAISED(SEED))
      expect(c3.storedUpdatedAt, "reload 2 after a killed tab: updatedAt still unchanged").toBe(c1.storedUpdatedAt)

      // ── The first real save carries the mark: the daily-goal field's own call (settings-ui.src.js,
      // its `change` handler), i.e. an ordinary settings save, not the unload flush. ──
      await page.evaluate(() => {
        const a = (window as any).__neural
        a.set("dailyGoal", a.practiceGoal(25))
      })
      const c4 = await capture()
      expect(c4.writes - c3.writes, "the settings change: exactly ONE write, its own save").toBe(1)
      expect(c4.stored, "the first real save carries the mark: stored is now the migrated seed").toEqual(MIGRATED(SEED))
      expect(c4.storedGf, "...and the mark it carries is the one set live on this boot").toBe(c3.liveGf)
      expect(c4.promoted, "...with still no second belt_promoted").toEqual([])
      expect(c4.storedHeldT, "...and the held belt's stamp still boot 1's").toBe(c1.storedHeldT)
    }

    expect(errors, "no pageerror across the seed boot and both preserveStorage reloads").toEqual([])
  })
