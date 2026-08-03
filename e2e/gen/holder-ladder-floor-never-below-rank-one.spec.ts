/* @hyperspace {"theme":"unlock-economy","L":"white-belt-holder","F":"ladder","B":"guard-limit"} @invariant "The ladder has a floor: a rigged loss at rank 1 leaves bjj-neural-ladder at exactly rank 1 (never 0 or negative), and the loss's defeat_drain still fires while any ladder_down beat reflects the floor clamp — the down-branch mirror of gen-w1-09's ceiling clamp, which is a different code path (loss + lower bound)." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { whiteBeltHolder, CURRICULUM } from "./personas"

/**
 * LADDER FLOOR — a white-belt holder loses a live roll while ALREADY at the bottom of the
 * opponent ladder (rank 1); the ladder must clamp at the floor, never hit 0 or negative,
 * and never underflow the roster index.
 *
 * Seams under test (probe-verified twice, 3.8s/3.3s, byte-identical beat streams):
 *   - endRound("lose") fires defeat_drain THEN ladderMove(-1) (neural/src/app.src.jsx:3813-3814)
 *     — the drain is unconditional on a loss, clamp or not, and precedes the ladder beat.
 *   - ladderMove(dir) clamps via Math.max(1, Math.min(ladderNames().length, rank + dir))
 *     (app.src.jsx:4130-4136) and STILL EMITS the ladder_down beat when clamped, carrying
 *     { rank: 1, capped: true } (capped = next === st.rank) — the exact down-branch mirror of
 *     the ceiling's capped ladder_up. It also persists {"rank":1} to bjj-neural-ladder even
 *     when the rank did not change.
 *   - ladderState() maps rank → opponent via names[Math.min(names.length, rank) - 1]
 *     (app.src.jsx:4121-4128) — at the floor that is names[0], never names[-1].
 *
 * BASELINE NEEDS NO PINNING (unlike the ceiling spec and the floor-clear -1 in the
 * holder-victory-defeat spec): boot's storage wipe leaves bjj-neural-ladder ABSENT, so
 * ladderState() lazy-inits to exactly rank 1 at the stakes beat. The absent store + rank 1 +
 * first-roster opponent are asserted as the premise.
 *
 * Distinct from its ledger neighbors on the SAME (F=ladder) column:
 *   - endgame-ladder-rank-ceiling (gen-w1-09) — a WIN clamped at the UPPER bound (ladder_up
 *     branch); this is the LOSS path clamped at the LOWER bound — different endRound branch,
 *     different Math.max arm, different beat.
 *   - holder-victory-defeat-blue-progress-untouched-by-loss — same loss recipe but rank PINNED
 *     to 3 so the -1 is floor-clear and real; it never exercises the clamp. It also owns the
 *     career-firewall ground (belts/units maps), not re-asserted here.
 *   - returner-ladder-independent-of-blob — owns the ladder-vs-blob independence ground
 *     (rejected here; no blob assertions below).
 *
 * Determinism: every draw is rigged. land() rigs the intro's ambient draws itself; the loss
 * recipe is verbatim from the holder-victory-defeat spec (defense-clock expiry — no escape
 * draw exists on that path). No content-text assertions: the played option is optionTitles()[0]
 * by position, the opponent is compared app-to-app against ladderNames()[0].
 */

const WHITE_ID: string = CURRICULUM.belts[0].id // "white" at authoring time

test("ladder floor: a loss at rank 1 clamps — one capped ladder_down after defeat_drain, rank/storage/opponent pinned at 1", async ({ page }) => {
  const j = journey(page)

  // ── Boot the holder; land a live roll. The stakes beat lazy-inits _ladder from an ABSENT
  //    store (boot wiped it), so the player sits at the floor with zero pinning. ──
  await j.boot("/", { initialState: whiteBeltHolder() })
  await j.land("Mount Top")
  await j.expectBeat("stakes") // roll intro staked the ladder → _ladder is lazily initialized

  // persona premise: the holder seed actually ingested (belts.won carries the white belt)
  const seeded = await page.evaluate(
    (whiteId) => !!((((window as any).__neural || {}).belts || {}).won || {})[whiteId as string],
    WHITE_ID,
  )
  expect(seeded, `holder seed ingested: belts.won.${WHITE_ID} present`).toBe(true)

  // ── FLOOR PREMISE (no pinning): store absent, rank exactly 1, opponent is roster[0] ──
  const base = await page.evaluate(() => {
    const a = (window as any).__neural
    const st = a.ladderState()
    return {
      rank: st.rank,
      opponent: st.opponent,
      firstName: a.ladderNames()[0],
      store: localStorage.getItem("bjj-neural-ladder"),
    }
  })
  expect(base.store, "fresh-boot wipe left bjj-neural-ladder absent — floor comes from the default").toBeNull()
  expect(base.rank, "unpinned baseline sits exactly at the floor (rank 1)").toBe(1)
  expect(base.opponent, "floor rank faces the FIRST roster opponent (app-to-app compare)").toBe(base.firstName)

  // ── DEFENSE-EXPIRY LOSS at the floor (verbatim recipe from the holder-victory-defeat spec):
  //    the player move FAILS (resolve+outcome high) → opponent turn → rigged submission attempt
  //    (opp-finish low ⇒ finish path, opp-sub-pick low ⇒ deterministic sub) → the defense CLOCK
  //    expires (no escape draw on this path) → tapped → endRound("lose"). ──
  const options = await j.optionTitles()
  expect(options.length, "a fresh hand of options was dealt for the loss phase").toBeGreaterThan(0)
  await j.rig("resolve", [0.99])
  await j.rig("outcome", [0.99])
  await j.rig("opp-finish", [0.01])
  await j.rig("opp-sub-pick", [0.01])
  await j.pick(options[0])
  await j.advanceUntil("caught", 20000)
  await j.advance(12000) // defense window onExpire → tapped → endRound("lose")
  await j.advanceUntil("roll_end", 20000)

  // ── The loss actually resolved as a loss (liveness — the clamp is exercised, not skipped). ──
  expect(await j.lastOutcome(), "the expired defense is a loss").toBe("lose")

  // ── The clamp, on the beat stream: defeat_drain still fires, and BEFORE the ladder beat;
  //    exactly ONE ladder_down, EMITTED (not suppressed) with the clamped rank + capped flag. ──
  const beats = (await j.beats()) as any[]
  const drainIdx = beats.findIndex((b) => b.beat === "defeat_drain")
  const downIdx = beats.findIndex((b) => b.beat === "ladder_down")
  expect(drainIdx, "defeat_drain fired for the floor loss (clamp does not swallow the drain)").toBeGreaterThanOrEqual(0)
  expect(downIdx, "ladder_down EMITTED at the floor, not suppressed").toBeGreaterThanOrEqual(0)
  expect(drainIdx, "defeat_drain precedes ladder_down (endRound order: drain, then move)").toBeLessThan(downIdx)

  const downs = beats.filter((b) => b.beat === "ladder_down")
  expect(downs.length, "exactly one ladder_down for the one loss").toBe(1)
  expect(downs[0].rank, "ladder_down reports the CLAMPED rank 1, never 0 or negative").toBe(1)
  expect(downs[0].capped, "ladder_down is flagged capped at the floor (mirror of the ceiling's capped ladder_up)").toBe(true)
  expect(beats.filter((b) => b.beat === "ladder_up").length, "a floor loss never promotes").toBe(0)
  for (const b of beats.filter((x) => x.beat === "ladder_down" || x.beat === "ladder_up")) {
    expect(b.rank, `ladder beat "${b.beat}" never reports a rank below the floor`).toBeGreaterThanOrEqual(1)
  }

  // ── The clamp, on live state + storage: rank exactly 1 everywhere; ladderMove persisted
  //    {"rank":1} even though the rank did not change; roster index never underflows. ──
  const after = await page.evaluate(() => {
    const a = (window as any).__neural
    const st = a.ladderState()
    return {
      stateRank: st.rank,
      liveRank: a._ladder ? a._ladder.rank : null,
      opponent: st.opponent,
      firstName: a.ladderNames()[0],
      stored: JSON.parse(localStorage.getItem("bjj-neural-ladder") || "null"),
    }
  })
  expect(after.stateRank, "ladderState().rank stays exactly 1 — the floor held").toBe(1)
  expect(after.liveRank, "_ladder.rank stays exactly 1 (live field, not just the derived view)").toBe(1)
  expect(after.stored, "clamped ladderMove still persisted — stored blob is exactly {rank:1}").toEqual({ rank: 1 })
  expect(after.opponent, "opponent still resolves at the floor — no names[-1] underflow").toBeTruthy()
  expect(after.opponent, "opponent is the FIRST roster entry (text-independent compare)").toBe(after.firstName)
})
