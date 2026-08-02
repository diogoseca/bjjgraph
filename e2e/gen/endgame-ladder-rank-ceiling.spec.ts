/* @hyperspace {"theme":"lifetime-journeys","L":"multi-belt-endgame","F":"ladder","B":"guard-limit"} @invariant "A win at the top ladder rank clamps: with rank pinned to ladderNames().length, a rigged victory leaves rank exactly at the ceiling (no overflow past the roster) and any ladder_up beat reflects the clamped rank." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { multiBeltEndgame, CURRICULUM } from "./personas"

/**
 * ENDGAME LADDER RANK CEILING — a multi-belt endgame player already sits at the TOP of the
 * opponent ladder and wins again; the ladder must clamp at the roster edge, never overflow.
 *
 * Seams under test (probe-verified twice, ~4s each, deterministic):
 *   - ladderMove(dir) clamps via Math.max(1, Math.min(ladderNames().length, rank + dir))
 *     (neural/src/app.src.jsx:4124-4129) and STILL emits a ladder_up beat when clamped,
 *     carrying { rank: <clamped>, capped: true } (capped = next === st.rank).
 *   - ladderState() maps rank → opponent via names[Math.min(names.length, rank) - 1]
 *     (app.src.jsx:4115-4122) — the roster index cannot run past the last name.
 *   - ladderMove persists the clamped rank to localStorage["bjj-neural-ladder"].
 *
 * PIN ORDER (probe-critical): ladderState() must be called BEFORE writing _ladder.rank —
 * the field is lazy-init and startRoll already read it at the stakes beat, so a bare
 * localStorage write alone is IGNORED after init. Pin the live field AND the storage mirror.
 *
 * WIN RECIPE: a submission ends the roll on a single rigged "resolve" draw (no "outcome"
 * rig needed) → victory_cascade → ladderMove(+1). The ceiling is read from the app
 * (ladderNames().length, 7 at authoring — app.src.jsx:4114) and the opponent is compared
 * to ladderNames()[max-1], never to hardcoded roster text.
 */

test("endgame ladder ceiling: a win at top rank clamps — one capped ladder_up, rank/storage/opponent pinned at the roster edge", async ({ page }) => {
  const j = journey(page)
  await j.boot("/", { initialState: multiBeltEndgame() })
  await j.land("Mount Top")
  await j.expectBeat("stakes") // roll intro staked the ladder → _ladder is lazily initialized

  // persona premise: the endgame player actually carries every belt the curriculum defines
  const wonCount = await page.evaluate(
    () => Object.keys(((window as any).__neural.belts || {}).won || {}).length,
  )
  expect(wonCount, "multiBeltEndgame seeded a victory for every curriculum belt").toBe(
    CURRICULUM.belts.length,
  )

  // ── PIN the ladder to the ceiling: live field (post lazy-init) + storage mirror ──
  const max: number = await page.evaluate(() => {
    const a = (window as any).__neural
    a.ladderState() // lazy-init guard: after this, _ladder is the live source of truth
    const top = a.ladderNames().length
    a._ladder.rank = top
    localStorage.setItem("bjj-neural-ladder", JSON.stringify({ rank: top }))
    return top
  })
  expect(max, "ladder roster is non-trivial (a real ceiling exists above rank 1)").toBeGreaterThanOrEqual(2)
  const pinned = await page.evaluate(() => {
    const a = (window as any).__neural
    const st = a.ladderState()
    const names = a.ladderNames()
    return { rank: st.rank, opponent: st.opponent, topName: names[names.length - 1] }
  })
  expect(pinned.rank, "pin took: rank sits at the ceiling before the win").toBe(max)
  expect(pinned.opponent, "ceiling rank faces the LAST roster opponent (app-to-app compare)").toBe(pinned.topName)

  // ── WIN from the ceiling: first dealt submission, rigged resolve success ──
  const subName = await page.evaluate(() => {
    const a = (window as any).__neural
    const subs = (a.optionIdxs || [])
      .map((o: any) => a.nodes[typeof o === "number" ? o : o.idx])
      .filter((n: any) => n && n.ty === "submissions")
    return subs.length ? subs[0].t : null
  })
  expect(subName, "a submission option dealt at Mount Top").toBeTruthy()
  await j.rig("resolve", [0.01])
  await j.pick(subName as string)
  await j.advanceUntil("roll_end", 20000)
  await j.expectBeat("victory_cascade")

  // ── the clamp, on the beat stream: exactly ONE ladder_up, clamped rank, capped flag ──
  const beats = (await j.beats()) as any[]
  const ups = beats.filter((b) => b.beat === "ladder_up")
  expect(ups.length, "exactly one ladder_up for the one victory (emitted even when clamped)").toBe(1)
  expect(ups[0].rank, "ladder_up reports the CLAMPED rank, not max+1").toBe(max)
  expect(ups[0].capped, "ladder_up is flagged capped at the ceiling").toBe(true)
  expect(
    beats.filter((b) => b.beat === "ladder_down").length,
    "a ceiling win never demotes",
  ).toBe(0)

  // ── the clamp, on live state + storage: rank exactly max, opponent index inside the roster ──
  const after = await page.evaluate(() => {
    const a = (window as any).__neural
    const st = a.ladderState()
    return {
      rank: st.rank,
      opponent: st.opponent,
      names: a.ladderNames(),
      stored: JSON.parse(localStorage.getItem("bjj-neural-ladder") || "null"),
    }
  })
  expect(after.rank, "rank stays exactly at the ceiling — no overflow past the roster").toBe(max)
  expect(after.names.length, "roster length unchanged by the clamped win").toBe(max)
  expect(after.stored && after.stored.rank, "persisted mirror carries the clamped rank").toBe(max)
  expect(after.opponent, "opponent still resolves — the roster index never overflows").toBeTruthy()
  expect(after.opponent, "opponent is the last roster entry (text-independent compare)").toBe(after.names[max - 1])
})
