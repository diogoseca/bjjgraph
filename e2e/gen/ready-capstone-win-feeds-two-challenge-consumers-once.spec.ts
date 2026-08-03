/* @hyperspace {"theme":"challenges-and-belt-bar","L":"capstone-ready","F":"victory-defeat","B":"cross-feature"} @invariant "A single belt_test_won feeds both challenge consumers exactly once — white.capstone (event rule) and purple.capstone-one (snapshot capstoneCount) each complete with one challenge_completed, and a later snapshot beat re-grants neither." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { beltReady } from "./personas"

/**
 * ONE CAPSTONE WIN, TWO CHALLENGE CONSUMERS, ONE GRANT EACH — the cross-feature seam
 * where a single beat is read by two DIFFERENT challenge mechanisms in the same pass.
 *
 * Mechanism (source-verified at authoring, neural/src/app.src.jsx + challenge-*.src.js):
 *   - endRound (~app.src.jsx:3995-3997) writes belts.won[beltId] BEFORE fx("belt_test_won"),
 *     and belt_test_won is in NG_SNAPSHOT_BEATS (challenge-definitions.src.js:323), so the
 *     _challengeSnapshot() taken ON that very beat already measures capstoneCount === 1.
 *   - In that ONE ngAdvanceChallenges pass (challenge-engine.src.js:26) TWO different rules
 *     therefore fire together: white.capstone (event rule `event:"belt_test_won"`,
 *     challenge-definitions.src.js:256) via ngMatches, and purple.capstone-one (snapshot rule
 *     `{snapshot:"capstoneCount"}, target 1`, :283) via `progress = max(progress, measured)`.
 *     Each lands in `completed` once → exactly one challenge_completed fx per id.
 *   - THE RE-GRANT GUARD: any LATER snapshot beat re-measures capstoneCount === 1, but the
 *     engine short-circuits (`progress === before.progress && done === before.done → continue`)
 *     so neither id re-enters `completed` — counts stay 1/1, badges/coins keys frozen.
 *
 * NOVELTY vs adjacent accepted specs:
 *   - endgame-victory-cannot-double-award-capstone: a NORMAL roll's win must NOT touch the
 *     capstone ledger (_beltTest null firewall). Here the win IS a real capstone: the claim
 *     is the fan-out — one beat, two consumer mechanisms, one grant each — plus the snapshot
 *     re-beat idempotence, which that spec never drives.
 *   - endgame-cleared-capstone-is-final / core content-capstone.spec.ts cover button finality
 *     and verdict plumbing; neither counts challenge_completed per consumer id.
 *
 * Persona: beltReady() — every white unit checkpointed + lesson evidence, belts.won empty,
 * challenges empty. keepTutorial:true keeps white.capstone genuinely INCOMPLETE (the default
 * boot path completes all 20 White objectives, which would hollow out the event-rule half).
 * GOTCHA (probe-verified): with keepTutorial the challenge cue aside (class
 * "ng-tut ng-challenge-cue", [data-challenge-cue]) is pointer-INTERACTIVE — unlike the plain
 * [data-tut] strip — and intercepts tray card clicks. Hidden via tutHidden=true +
 * renderTutorial() + renderChallengeCue(): cosmetic only (tut.done/challenges untouched, so
 * white.capstone stays incomplete).
 *
 * Determinism: land-mc-pick/land-mc-shuffle pre-sized at 60 (surface-scoped land-* tags —
 * beltReady has stage:{} so every landing asks; questions are left unanswered, which only
 * breaks momentum and is irrelevant here). Per move: resolve [0.01] (< any moveChance →
 * success) + outcome [0.01], re-rigged before EVERY pick. The white test starts at
 * Mount/Bottom (curriculum.json white.test.startNodeId) with maxMoves 14 — playToTap's
 * budget of 12 taps well inside the verdict window. Probe: CONFIRMED 2/2 green (6s each).
 * Assertions are STRUCTURE only (beats, per-id counts, progress objects, reward keys) —
 * never card/answer text. NOTE: the recall re-beat legitimately completes white.recall (a
 * DIFFERENT id, event recall_proven) — every count here is per-id, never a global total.
 */

/** playToTap armor (core-015 lineage): take a submission the instant one is offered, else
 *  step through a transition whose success destination adjoins a submission, re-rigging the
 *  resolve/outcome pair before every pick (queues are consumed per take). */
async function playToTap(j: any, page: any, maxMoves = 12): Promise<boolean> {
  for (let m = 0; m < maxMoves; m++) {
    const sub = await page.evaluate(() => {
      const a = (window as any).__neural
      const subs = (a.optionIdxs || [])
        .map((x: any) => a.nodes[typeof x === "number" ? x : x.idx])
        .filter((n: any) => n && n.ty === "submissions")
      return subs.length ? subs[0].t : null
    })
    await j.rig("resolve", [0.01]) // < moveChance ⇒ success verdict
    await j.rig("outcome", [0.01]) // drawOutcome pick; success re-selects the success row
    if (sub) {
      await j.pick(sub)
      await j.advanceUntil("roll_end", 25000)
      return true
    }
    const t = await page.evaluate(() => {
      const a = (window as any).__neural
      let fallback: string | null = null
      for (const i of a.optionIdxs || []) {
        const idx = typeof i === "number" ? i : i.idx
        const n = a.nodes[idx]
        if (!n || n.ty !== "transitions") continue
        fallback = fallback || n.t
        const res = a.resultPos(idx, a.currentPos)
        if (res >= 0 && (a.adj[res] || []).some((k: number) => a.nodes[k]?.ty === "submissions")) return n.t
      }
      return fallback
    })
    if (!t) return false
    await j.pick(t)
    await j.nextHand(30000)
  }
  return false
}

test("one belt_test_won completes white.capstone (event) AND purple.capstone-one (snapshot) exactly once each; a later snapshot beat re-grants neither", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))

  const j = journey(page)
  await j.boot("/", { initialState: beltReady(), keepTutorial: true })
  // surface-scoped landing-question rigs, pre-sized for every landing this run can ask
  await j.rig("land-mc-pick", Array(60).fill(0.01))
  await j.rig("land-mc-shuffle", Array(60).fill(0.01))
  await j.land("Mount Top")

  // keepTutorial gotcha: the challenge cue aside is pointer-interactive and would intercept
  // tray clicks — hide it COSMETICALLY (tut.done/challenges untouched → white.capstone
  // remains incomplete, which the premise assert below pins)
  await page.evaluate(() => {
    const a = (window as any).__neural
    a.tutHidden = true
    a.renderTutorial()
    if (a.renderChallengeCue) a.renderChallengeCue()
  })

  const perIdCount = (id: string) =>
    page.evaluate(
      (i) =>
        (((window as any).__neural || {}).beats || []).filter(
          (b: any) => b.beat === "challenge_completed" && b.id === i,
        ).length,
      id,
    )
  const ledger = () =>
    page.evaluate(() => {
      const a = (window as any).__neural
      return {
        white: a.challengeProgress("white.capstone"),
        purple: a.challengeProgress("purple.capstone-one"),
        capstoneCount: Object.keys((a.belts || {}).won || {}).length,
      }
    })

  // ── PREMISE: both consumers incomplete, zero capstones, no verdict beat yet ──
  const pre = await ledger()
  expect(pre.white, "white.capstone (event rule) starts incomplete").toMatchObject({ progress: 0, done: false })
  expect(pre.purple, "purple.capstone-one (snapshot rule) starts incomplete").toMatchObject({ progress: 0, done: false })
  expect(pre.capstoneCount, "belts.won empty — capstoneCount snapshot would read 0").toBe(0)
  expect(
    (await j.beats()).filter((b) => b.beat === "belt_test_won").length,
    "no belt_test_won before the capstone",
  ).toBe(0)

  // ── START THE WHITE CAPSTONE from the Challenges track (real UI surfaces) ──
  await page.evaluate(() => {
    const a = (window as any).__neural
    a.settings.challengeSelectedTrack = "white"
    a.setViewMode("challenges")
    a.openExplorer()
    a.showExplorerList()
  })
  await page.locator('.ng-track-card[data-track="white"]').click()
  await page.locator('[data-capstone="white"] button').click()
  await j.advanceUntil("belt_test_start", 20000)
  await j.nextHand(30000)

  // ── WIN IT by rigged submission (starts Mount/Bottom; budget 12 < maxMoves 14) ──
  expect(await playToTap(j, page), "the capstone resolved to a submission tap").toBe(true)

  // ── THE BEAT ORDER: exactly one belt_test_won, emitted BEFORE the roll's generic close ──
  const names = (await j.beats()).map((b: any) => b.beat)
  const wonIdx = names.indexOf("belt_test_won")
  expect(wonIdx, "belt_test_won emitted").toBeGreaterThanOrEqual(0)
  expect(
    names.filter((n) => n === "belt_test_won").length,
    "exactly ONE belt_test_won — a single source beat for both consumers",
  ).toBe(1)
  expect(
    names.slice(wonIdx + 1),
    "the verdict precedes the generic close: a roll_end follows belt_test_won",
  ).toContain("roll_end")

  // ── THE FAN-OUT: one beat, two mechanisms, one grant each ──
  const after = await ledger()
  expect(after.capstoneCount, "belts.won holds the single white entry — the snapshot's measured 1").toBe(1)
  expect(
    await page.evaluate(() => {
      const w = (window as any).__neural.belts.won.white
      return !!w && Number(w.moves) >= 0
    }),
    "belts.won.white recorded with a numeric move count (written BEFORE the fx)",
  ).toBe(true)
  expect(after.white, "white.capstone completed by the EVENT rule").toMatchObject({ progress: 1, done: true })
  expect(after.purple, "purple.capstone-one completed by the SNAPSHOT rule in the SAME pass").toMatchObject({
    progress: 1,
    done: true,
  })
  expect(await perIdCount("white.capstone"), "exactly one challenge_completed for white.capstone").toBe(1)
  expect(await perIdCount("purple.capstone-one"), "exactly one challenge_completed for purple.capstone-one").toBe(1)

  // ── RE-BEAT RAIL: freeze the full reward surface, then fire a LATER snapshot beat ──
  const before = await page.evaluate(() => {
    const a = (window as any).__neural
    return {
      white: a.challengeProgress("white.capstone"),
      purple: a.challengeProgress("purple.capstone-one"),
      badges: Object.keys(a.badges || {}).sort(),
      coins: Object.keys(a.coins || {}).sort(),
      recallProven: (a.beats || []).filter((b: any) => b.beat === "recall_proven").length,
    }
  })

  // one GENUINE recall_proven through the study rail (probe-hardened recipe): graduate a
  // card to the gate → present → recallGrade — recall_proven is in NG_SNAPSHOT_BEATS, so
  // this re-runs the snapshot pass with capstoneCount still 1
  await page.evaluate(() => {
    const a = (window as any).__neural
    const k = "Mount|Top"
    a.openStudy(k)
    const card = a.deck[0]
    const qh = a.qhash(card.q)
    ;(a.stage[k] = a.stage[k] || {})[qh] = 2
    a.presentCard(qh)
    a.revealed = true
    a.recallGrade(true)
  })

  const post = await page.evaluate(() => {
    const a = (window as any).__neural
    return {
      white: a.challengeProgress("white.capstone"),
      purple: a.challengeProgress("purple.capstone-one"),
      badges: Object.keys(a.badges || {}).sort(),
      coins: Object.keys(a.coins || {}).sort(),
      recallProven: (a.beats || []).filter((b: any) => b.beat === "recall_proven").length,
    }
  })
  expect(post.recallProven, "exactly one recall_proven fired — the re-beat is real").toBe(before.recallProven + 1)
  // THE IDEMPOTENCE: the engine short-circuits both already-done consumers on the re-measure
  expect(await perIdCount("white.capstone"), "white.capstone still granted exactly once after the re-beat").toBe(1)
  expect(
    await perIdCount("purple.capstone-one"),
    "purple.capstone-one still granted exactly once after the re-beat",
  ).toBe(1)
  expect(post.white, "white.capstone progress object byte-identical (t included)").toEqual(before.white)
  expect(post.purple, "purple.capstone-one progress object byte-identical (t included)").toEqual(before.purple)
  // white.recall (a different id) may legitimately complete on this beat — but it mints no
  // badge/coin here, so the reward KEY SETS are frozen across the re-beat
  expect(post.badges, "badge key set unchanged by the snapshot re-beat").toEqual(before.badges)
  expect(post.coins, "coin key set unchanged by the snapshot re-beat").toEqual(before.coins)

  expect(errors, "no pageerror across boot, capstone win, and the re-beat rail").toEqual([])
})
