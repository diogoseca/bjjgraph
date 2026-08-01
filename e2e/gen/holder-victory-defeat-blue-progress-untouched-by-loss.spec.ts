/* @hyperspace {"theme":"lifetime-journeys","L":"white-belt-holder","F":"victory-defeat","B":"cross-feature"} @invariant "A gameplay loss for a white-belt holder drains the ladder but never revokes the earned white belt or corrupts blue study progress: after a rigged defense-expiry loss, defeat_drain and ladder_down fire, yet belts.won[white] is intact and blue's units/lessons state is unchanged from boot — belt record and study progress are independent of roll outcomes." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { whiteBeltHolder, CURRICULUM } from "./personas"

/**
 * HOLDER GAMEPLAY LOSS != BELT/STUDY REVOCATION — the results<->career firewall.
 *
 * A white-belt HOLDER (belt already won, all 6 white units checkpointed) loses a LIVE roll by
 * defense-expiry. The loss must debit the opponent LADDER (rank -1, defeat_drain) and touch
 * NOTHING in the durable career record: belts.won[white] stays intact, and the whole
 * units/prep/rec study-progress map is byte-identical to boot — including that blue is still
 * ABSENT (a loss must not spawn spurious blue keys). Belt record + study progress are functions
 * of study, never of roll outcomes.
 *
 * Distinct from its ledger neighbors on the SAME (F=victory-defeat) column:
 *   - veteran-victory-does-not-mutate-recall-map — a WIN, and the rec/mastery economy (not the
 *     BELT record); it asserts the ladder CLIMBS, this asserts the ladder DROPS.
 *   - returner-victory-defeat-ladder-swing-symmetric — the ladder delta round-trip (+1 then -1);
 *     it says nothing about belts.won or the units map surviving a loss.
 * The novel axis here is: does a DEFEAT leave the earned belt + higher-tier (blue) study state
 * untouched? Structurally it must, but nothing in the accepted corpus pins it.
 *
 * Structural root cause (neural/src/app.src.jsx, source-verified at authoring):
 *   - endRound("lose") (:3813-3814) fires defeat_drain then ladderMove(-1) and mutates only
 *     _ladder.rank / rollLog / _lastOutcome / camera — NEVER belts.won or units.
 *   - The ONLY endRound branch that writes belts (:3789-3800) is guarded by `if (this._beltTest)`;
 *     a plain land("Mount Top") roll has no _beltTest, so that branch is skipped entirely. And
 *     even a belt-test LOSS writes belts.attempts (:3798), it never revokes a won belt.
 *   - _progressBlob() (:1114) serializes belts/units/prep/rec BY REFERENCE, so an untouched map
 *     round-trips byte-identical — "unchanged from boot" == deep-equal of the whole map.
 *
 * LADDER FLOOR (probe-critical): rank floors at 1 (ladderMove: Math.max(1,...), :4132) and a
 * fresh boot's rank IS 1, so a naive rank<rank0 check FAILS at the floor. PIN rank above the
 * floor first, in the ceiling-spec's order — call ladderState() FIRST (lazy-init _ladder), THEN
 * set _ladder.rank + the storage mirror; a bare storage write alone is ignored once _ladder
 * exists. After the loss rank1 === rank0-1 === 2 (a real, floor-clear -1).
 *
 * Determinism: every draw is rigged. land() covers the intro roll's ambient draws; the loss
 * recipe is verbatim from the green core (stakes-impact.spec.ts:157-169) + the returner swing
 * spec. No content-text assertions — the played option is optionTitles()[0] by position; belt
 * and unit IDs come from curriculum.json (belts[0].id / units[].id), never hardcoded strings.
 */

// Mirror personas.ts whiteBeltHolder()/beltReady() EXACTLY (belts[0].units -> "white/<unitId>"),
// so this tracks a curriculum reorder instead of freezing unit-key names.
const WHITE = CURRICULUM.belts[0]
const BLUE = CURRICULUM.belts[1]
const WHITE_UNIT_KEYS: string[] = WHITE.units.map((u: any) => `${WHITE.id}/${u.id}`)

test("white-belt holder: a defense-expiry LOSS drains the ladder (-1) but leaves belts.won[white] + the whole units/prep/rec map byte-identical", async ({ page }) => {
  test.skip(!BLUE, "curriculum has no second (blue) belt — 'blue stays absent' premise gone")

  const j = journey(page)

  // ── Boot the holder: whiteBeltHolder() seeds belts.won={white:...}, 6 white unit checkpoints,
  //    white lesson prep/rec=3; blue units are ABSENT. ──
  await j.boot("/", { initialState: whiteBeltHolder() })
  await j.land("Mount Top")
  await j.expectBeat("stakes") // roll intro staked the ladder → _ladder is lazily initialized

  // Baseline / persona premise: the seed ingested (else the invariant is untestable). All IDs come
  // from curriculum.json (never hardcoded text): white won, 6 white unit checkpoints present, and
  // ZERO blue unit keys.
  const base = await page.evaluate(
    ([whiteId, whiteUnitKeys, bluePrefix]) => {
      const a = (window as any).__neural
      const won = (a.belts || {}).won || {}
      return {
        whiteWon: !!won[whiteId as string],
        wonKeys: Object.keys(won).sort(),
        whiteUnitsPresent: (whiteUnitKeys as string[]).every((k) => !!(a.units || {})[k]),
        blueUnitCount: Object.keys(a.units || {}).filter((k) => k.startsWith(bluePrefix as string)).length,
      }
    },
    [WHITE.id, WHITE_UNIT_KEYS, `${BLUE.id}/`] as const,
  )
  expect(base.whiteWon, "holder seed ingested: belts.won carries the white belt").toBe(true)
  expect(base.wonKeys, "exactly the white belt is won at boot (no phantom belts)").toEqual([WHITE.id])
  expect(base.whiteUnitsPresent, "all 6 white unit checkpoints present at boot").toBe(true)
  expect(base.blueUnitCount, "no blue study progress at boot — the holder hasn't touched blue").toBe(0)

  // ── Deep-copy the durable career record BEFORE the loss (the byte-identical pre-image). The
  //    whole units/prep/rec deep-equal is what covers "blue stays absent + no spurious keys". ──
  const pre = await page.evaluate(() => {
    const a = (window as any).__neural
    return {
      belts: JSON.parse(JSON.stringify(a.belts || {})),
      units: JSON.parse(JSON.stringify(a.units || {})),
      prep: JSON.parse(JSON.stringify(a.prep || {})),
      rec: JSON.parse(JSON.stringify(a.rec || {})),
    }
  })

  // ── PIN the ladder above the floor: live field (post lazy-init) + storage mirror. Without this
  //    the loss's -1 would clamp at rank 1 and a "dropped" assertion could not distinguish it. ──
  const rank0: number = await page.evaluate(() => {
    const a = (window as any).__neural
    a.ladderState() // lazy-init guard: after this, _ladder is the live source of truth
    a._ladder.rank = 3
    localStorage.setItem("bjj-neural-ladder", JSON.stringify({ rank: 3 }))
    return a.ladderState().rank
  })
  expect(rank0, "pin took: rank sits at 3 (well clear of the floor) before the loss").toBe(3)

  // ── DEFENSE-EXPIRY LOSS (verbatim recipe): the player move FAILS (resolve+outcome high) ->
  //    opponent turn -> opponent goes for a rigged submission (opp-finish low => finish path,
  //    opp-sub-pick low => deterministic sub) -> the defense CLOCK expires (no escape draw) ->
  //    onExpire=finish -> endRound("lose") -> defeat_drain + ladderMove(-1). ──
  const options = await j.optionTitles()
  expect(options.length, "a fresh hand of options was dealt for the loss phase").toBeGreaterThan(0)
  await j.rig("resolve", [0.99])
  await j.rig("outcome", [0.99])
  await j.rig("opp-finish", [0.01])
  await j.rig("opp-sub-pick", [0.01])
  await j.pick(options[0])
  await j.advanceUntil("caught", 20000)
  await j.advance(12000) // defense window onExpire -> tapped -> endRound("lose")
  await j.advanceUntil("roll_end", 20000)

  // ── The loss actually resolved as a loss (liveness — not a silent no-op). ──
  expect(await j.lastOutcome(), "the expired defense is a loss").toBe("lose")
  await j.expectBeat("defeat_drain")
  await j.expectBeat("ladder_down")

  // ── The DEBIT is real: rank dropped exactly -1 (floor-clear, so a genuine demotion). ──
  const rank1 = await page.evaluate(() => (window as any).__neural.ladderState().rank)
  expect(rank1, "the loss drains the ladder by exactly -1 (2, floor-clear)").toBe(rank0 - 1)

  // ── FIREWALL — re-read the durable career record AFTER the loss; every piece byte-identical. ──
  const post = await page.evaluate(() => {
    const a = (window as any).__neural
    return {
      belts: JSON.parse(JSON.stringify(a.belts || {})),
      units: JSON.parse(JSON.stringify(a.units || {})),
      prep: JSON.parse(JSON.stringify(a.prep || {})),
      rec: JSON.parse(JSON.stringify(a.rec || {})),
      wonKeys: Object.keys((a.belts || {}).won || {}).sort(),
    }
  })

  // The earned belt is intact — the exact won-record object round-trips unchanged (a loss neither
  // revokes it nor rewrites its moves/dominance/byPoints).
  expect(post.belts, "belts map byte-identical across a gameplay loss (belt never revoked)").toEqual(pre.belts)
  expect(post.wonKeys, "still exactly the white belt won after the loss").toEqual([WHITE.id])

  // Study progress untouched — the whole map deep-equal covers "blue absent + no spurious keys".
  expect(post.units, "units map byte-identical (checkpoints kept; no blue key minted by a loss)").toEqual(pre.units)
  expect(post.prep, "prep map byte-identical across the loss").toEqual(pre.prep)
  expect(post.rec, "rec map byte-identical across the loss").toEqual(pre.rec)
})
