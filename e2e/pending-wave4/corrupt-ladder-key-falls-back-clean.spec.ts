/* @hyperspace {"theme":"unlock-economy","L":"legacy-corrupt-blob","F":"ladder","B":"error-fallback"} @invariant "Garbage in bjj-neural-ladder degrades to a clean rank-1 start without crashing and is quarantined: the app boots and plays with rank 1, a rigged win writes a valid rank-2 record, and after a preserveStorage reload the key JSON.parses cleanly at rank 2 — the poison never resurfaces." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { whiteBeltHolder, CURRICULUM, CORRUPT_BLOB_RAW } from "./personas"

/**
 * CORRUPT LADDER KEY → CLEAN RANK-1 FALLBACK — the LADDER's own store carries broken JSON;
 * the app must boot, read it lazily without crashing, default to rank 1, and QUARANTINE the
 * poison (never write on read) until the first legitimate ladderMove replaces it wholesale.
 *
 * Seam under test (neural/src/app.src.jsx ~4121-4136, probe-verified 2/2 deterministic):
 *   - ladderState() does a lazy memoized read of "bjj-neural-ladder" inside try/catch —
 *     corrupt JSON.parse throws, is caught, rank defaults to 1, and NOTHING is written on
 *     the read path (the poison stays byte-identical in storage through land()).
 *   - ladderMove(+1) on a submission win is the FIRST write: it replaces the poison with
 *     '{"rank":2}' — after which a preserveStorage reload parses the key cleanly.
 *
 * SEEDING RECIPE (order matters — see corrupt-blob-fresh-fallback-boot.spec.ts):
 *   (1) boot("/") once      — registers the DSL wipe init-script FIRST
 *   (2) addInitScript(seed) — corrupt ladder + __probe_marker; runs post-wipe on next boot
 *   (3) boot with initialState — ngseed hash writes the VALID career blob, then the poison
 *       script runs; both coexist (career healthy, only the ladder key poisoned).
 * CRITICAL: init scripts accumulate across boots, so the seed is ONE-SHOT gated on a
 * sessionStorage flag. Non-preserve boots wipe sessionStorage (the gate re-arms for boot
 * retries); the preserveStorage boot keeps it, so the seed does NOT re-poison the key after
 * the app's clean write — without the gate the final parse assert false-fails.
 *
 * Win recipe verbatim from returner-ladder-independent-of-blob.spec.ts: first dealt
 * submission by ty (never by name), resolve+outcome rigged low, roll_end → finish → win.
 *
 * Dedup: returner-ladder-independent-of-blob.spec.ts poisons NOTHING (healthy ladder key,
 * blob-independence claim); corrupt-blob-fresh-fallback-boot.spec.ts poisons the PROGRESS
 * blob. This is the first pin on the ladder key's OWN corrupt-fallback path.
 */

const WHITE_ID: string = CURRICULUM.belts[0].id

test("corrupt bjj-neural-ladder: rank-1 fallback, poison quarantined through play, clean rank-2 write survives reload", async ({ page }) => {
  // premise guard: the shared constant must actually be broken JSON, or the spec is vacuous
  expect(() => JSON.parse(CORRUPT_BLOB_RAW), "persona premise: CORRUPT_BLOB_RAW does not parse").toThrow()
  const SEED: any = whiteBeltHolder()
  expect(SEED.belts?.won?.[WHITE_ID], `persona premise: whiteBeltHolder carries belts.won.${WHITE_ID}`).toBeTruthy()

  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))

  const j = journey(page)

  // ── (1) registration boot: the DSL's wipe init-script must exist BEFORE our seed script ──
  await j.boot("/")

  // ── (2) one-shot corrupt seed, gated so accumulated re-runs can't re-poison after the fix ──
  await page.addInitScript((garbage) => {
    try {
      if (sessionStorage.getItem("__probe_ladder_seeded")) return
      sessionStorage.setItem("__probe_ladder_seeded", "1")
      localStorage.setItem("bjj-neural-ladder", garbage)
      localStorage.setItem("__probe_marker", "1")
    } catch {}
  }, CORRUPT_BLOB_RAW)

  // ── (3) boot under test: wipe → valid career blob (ngseed) → corrupt ladder seed ──
  await j.boot("/", { initialState: SEED })

  const boot = await page.evaluate(
    ([garbage, whiteId]) => {
      const a = (window as any).__neural
      return {
        marker: localStorage.getItem("__probe_marker"),
        ladderIsGarbage: localStorage.getItem("bjj-neural-ladder") === garbage,
        nodes: a.nodes.length,
        beltWon: !!(a.belts && a.belts.won && a.belts.won[whiteId]),
        rank: a.ladderState().rank, // this call IS the lazy corrupt read — must not throw
      }
    },
    [CORRUPT_BLOB_RAW, WHITE_ID] as const,
  )
  // seeding proof FIRST — without these the fallback reads below are vacuously green
  expect(boot.marker, "seed init-script ran AFTER the DSL wipe (marker survives boot)").toBe("1")
  expect(boot.ladderIsGarbage, "the exact corrupt bytes were in bjj-neural-ladder at boot").toBe(true)
  expect(boot.nodes, "app ingested the full graph despite the poisoned ladder key").toBeGreaterThan(1000)
  expect(boot.beltWon, `career blob ingested intact (belts.won.${WHITE_ID}) — only the ladder is poisoned`).toBe(true)
  expect(boot.rank, "corrupt ladder read falls back to rank 1 without crashing").toBe(1)

  // ── the fallback is PLAYABLE, and the read path never heals/removes the poison ──
  await j.land("Mount Top")
  const postLand = await page.evaluate((garbage) => {
    const a = (window as any).__neural
    return { rank: a.ladderState().rank, ladderIsGarbage: localStorage.getItem("bjj-neural-ladder") === garbage }
  }, CORRUPT_BLOB_RAW)
  expect(postLand.rank, "still rank 1 after landing (intro stakes read the ladder)").toBe(1)
  expect(postLand.ladderIsGarbage, "QUARANTINE: poison byte-identical after land — reads never write").toBe(true)

  // ── one rigged win: first dealt submission by TYPE, resolve+outcome armored low ──
  const subName = await page.evaluate(() => {
    const a = (window as any).__neural
    const subs = (a.optionIdxs || []).map((i: number) => a.nodes[i]).filter((n: any) => n.ty === "submissions")
    return subs.length ? subs[0].t : null
  })
  expect(subName, "a submission option dealt from Mount Top").toBeTruthy()
  await j.rig("resolve", [0.01])
  await j.rig("outcome", [0.01])
  await j.pick(subName as string)
  await j.advanceUntil("roll_end", 20000)
  await j.expectBeat("finish")
  expect(await j.lastOutcome(), "the rigged submission ends the roll as a win").toBe("win")
  const ladderUps = await page.evaluate(() => ((window as any).__neural.beats || []).filter((b: any) => b.beat === "ladder_up"))
  expect(ladderUps.length, "the win emitted ladder_up").toBeGreaterThan(0)
  expect(ladderUps[ladderUps.length - 1].rank, "ladder_up carries rank 2").toBe(2)
  const written = await page.evaluate(() => JSON.parse(localStorage.getItem("bjj-neural-ladder") || "null"))
  expect(written, "ladderMove's first write replaced the poison with exactly {rank:2}").toEqual({ rank: 2 })

  // ── preserveStorage reload: the key parses cleanly at rank 2; the poison never resurfaces ──
  await j.boot("/", { preserveStorage: true }) // no land needed — ladderState() callable directly
  const fin = await page.evaluate((garbage) => {
    const a = (window as any).__neural
    const raw = localStorage.getItem("bjj-neural-ladder")
    let parsed: any = null
    let parseThrew = false
    try {
      parsed = raw ? JSON.parse(raw) : null
    } catch {
      parseThrew = true
    }
    return {
      parseThrew,
      parsed,
      liveRank: a.ladderState().rank,
      rawIsGarbage: raw === garbage,
      gateFlag: sessionStorage.getItem("__probe_ladder_seeded"),
    }
  }, CORRUPT_BLOB_RAW)
  expect(fin.parseThrew, "stored bjj-neural-ladder JSON.parses cleanly after reload").toBe(false)
  expect(fin.parsed, "stored ladder record is exactly {rank:2}").toEqual({ rank: 2 })
  expect(fin.liveRank, "live ladderState() reads rank 2 from the clean record").toBe(2)
  expect(fin.rawIsGarbage, "the poison never resurfaced in storage").toBe(false)
  expect(fin.gateFlag, "one-shot seed gate held through the preserve boot (no re-seed)").toBe("1")

  // crash guard: registration boot + poisoned boot + play + preserve reload all ran clean
  expect(errors, "zero pageerror across all three boots").toEqual([])
})
