/* @hyperspace {"theme":"lifetime-journeys","L":"srs-veteran","F":"victory-defeat","B":"cross-feature"} @invariant "Winning a live roll by rigged submission for a veteran fires roll_end outcome 'win' and victory_cascade but leaves the recall/mastery economy untouched: masteredCount() and every seeded rec[deckKey] are byte-identical before and after the finish — gameplay victory credits the ladder, never the SRS rec map." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { srsVeteran, CURRICULUM } from "./personas"

/**
 * VETERAN VICTORY DOES NOT MUTATE THE RECALL MAP — the gameplay↔SRS firewall.
 *
 * The crossover invariant: a GAMEPLAY victory (rigged submission finish on a live roll) must
 * credit the LADDER (rank +1) and fire the victory beats, yet leave the SRS recall economy
 * (rec map + masteredCount) byte-identical. This is distinct from its two ledger neighbors:
 *   - gen-w1-03 "rec map survives a preserveStorage RELOAD" — persistence, not gameplay.
 *   - core-058 / core-065 "victory_cascade + ladder timing/sound" — ladder/timing, not rec.
 * Here the axis is the FIREWALL: winning the roll writes _ladder.rank / rollLog / _lastOutcome,
 * never rec or prep.
 *
 * Structural root cause (neural/src/app.src.jsx, source-verified at authoring):
 *   - rec is written ONLY at flashcard/drill choke points (noteCardDone :840, recall-gate
 *     :3449-3450, JIT drill :1590, review :4017). No gameplay-resolution path touches it.
 *   - The win path tensionSweep(:4470 `success = rng("resolve") < moveChance`) →
 *     enterSuccessCal(:4526) → for a submission short-circuits at :4530 straight to
 *     endRound("win"). endRound's win block (:3805-3817) emits victory_cascade → finish →
 *     roll_end and calls ladderMove(1) — it mutates _ladder.rank / rollLog / _lastOutcome /
 *     moveCount / camera, but NEVER rec or prep.
 *   - The ONLY endRound branch that writes progress (belts.won + _flushSave, :3789-3800) is
 *     guarded by `if (this._beltTest)`; a plain land("Mount Top") roll has no _beltTest, so
 *     that branch is skipped entirely.
 *   - masteredCount() (:1153) is `Object.keys(rec).filter(k => rec[k] >= 3).length` — derived
 *     purely from rec, so its equality FOLLOWS from rec equality (asserted belt-and-suspenders).
 *
 * Determinism: the only draws on the win path are `resolve` (the verdict — 0.01 < any moveChance
 * ⇒ success) and a defensive `outcome` (a submission win short-circuits to endRound before
 * drawOutcome matters). land()'s built-in ai-skill/role/max-moves rigs cover the intro roll.
 * No content-text assertions — the dealt submission is discovered by ty, never named.
 */

// Mirror personas.ts srsVeteran(25) iteration EXACTLY (belts→units→lessons, first 25) so the
// spec tracks curriculum reorders instead of freezing deckKey names.
const SEEDED: string[] = (() => {
  const keys: string[] = []
  outer: for (const belt of CURRICULUM.belts)
    for (const u of belt.units)
      for (const l of u.lessons) {
        keys.push(l.deckKey)
        if (keys.length >= 25) break outer
      }
  return keys
})()

test("veteran gameplay victory: roll_end 'win' + victory_cascade + ladder +1, but rec map & masteredCount byte-identical", async ({ page }) => {
  test.skip(SEEDED.length < 25, "curriculum shrank below 25 lesson decks — srsVeteran(25) premise gone")
  test.skip(
    new Set(SEEDED).size !== 25,
    "first 25 lesson deckKeys are no longer unique — the count-level invariant would conflate keys",
  )

  const j = journey(page)

  // ── Boot the veteran: srsVeteran(25) seeds prep=5, rec=3 across 25 decks ──
  await j.boot("/", { initialState: srsVeteran(25) })
  await j.land("Mount Top")
  await j.expectBeat("land")
  await j.expectBeat("options_dealt")

  // Baseline: seed ingested — masteredCount()===25, exactly 25 rec keys. This is the pre-image
  // of the byte-identical assertion; if the seed didn't ingest the invariant is untestable.
  const base = await page.evaluate(() => {
    const a = (window as any).__neural
    return { mastered: a.masteredCount(), recKeys: Object.keys(a.rec).length, rank: a.ladderState().rank }
  })
  expect(base.mastered, "veteran seed ingested: masteredCount() === 25 pre-finish").toBe(25)
  expect(base.recKeys, "exactly the 25 seeded rec keys pre-finish").toBe(25)

  // ── Find a dealt SUBMISSION by type (never by name — MC waves rewrite card/answer text) ──
  const subName: string | null = await page.evaluate(() => {
    const a = (window as any).__neural
    const sub = (a.optionIdxs || [])
      .map((x: any) => a.nodes[typeof x === "number" ? x : x.idx])
      .find((n: any) => n && n.ty === "submissions")
    return sub ? sub.t : null
  })
  test.skip(!subName, "no submission dealt on this Mount Top hand — win-by-finish premise absent")

  // ── Deep-copy the recall economy BEFORE the finish (the byte-identical pre-image) ──
  const pre = await page.evaluate(() => {
    const a = (window as any).__neural
    return {
      rec: JSON.parse(JSON.stringify(a.rec || {})),
      prep: JSON.parse(JSON.stringify(a.prep || {})),
      mastered: a.masteredCount(),
    }
  })

  // ── RIG the win: resolve < moveChance ⇒ the sweep verdict is success. A SINGLE resolve draw
  // fires before the submission ends the roll. outcome is defensive — a submission win
  // short-circuits to endRound before drawOutcome is consulted. ──
  await j.rig("resolve", [0.01])
  await j.rig("outcome", [0.01])

  // ── Finish: pick the submission through the real tray UI, pump until roll_end ──
  await j.pick(subName!)
  await j.advanceUntil("roll_end", 20000)

  // ── Victory beats fired: durable roll_end outcome is "win"; victory_cascade emitted ──
  expect(await j.lastOutcome(), "durable roll_end beat records a WIN").toBe("win")
  await j.expectBeat("victory_cascade")

  // ── Re-read the economy AFTER roll_end and assert byte-identical (toEqual) ──
  const post = await page.evaluate(() => {
    const a = (window as any).__neural
    return {
      rec: JSON.parse(JSON.stringify(a.rec || {})),
      prep: JSON.parse(JSON.stringify(a.prep || {})),
      mastered: a.masteredCount(),
      rank: a.ladderState().rank,
    }
  })
  expect(post.rec, "rec map byte-identical across a gameplay victory (win never mints/loses recall)").toEqual(pre.rec)
  expect(post.prep, "prep map byte-identical across a gameplay victory").toEqual(pre.prep)
  // masteredCount() is derived purely from rec, so this follows from rec equality — asserted
  // belt-and-suspenders in case the derivation ever changes.
  expect(post.mastered, "masteredCount() unchanged (25→25) — victory credits the ladder, not the ladder of mastery").toBe(pre.mastered)
  expect(post.mastered, "masteredCount() still the seeded 25").toBe(25)

  // ── Liveness sanity: the finish was REAL, not a silent no-op — the ladder advanced +1 ──
  expect(post.rank, "ladder rank advanced exactly +1 (proves the win actually resolved)").toBe(base.rank + 1)
})
