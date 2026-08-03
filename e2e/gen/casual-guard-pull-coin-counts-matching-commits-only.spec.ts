/* @hyperspace {"theme":"challenges-and-belt-bar","L":"casual-week1","F":"graph-canvas","B":"guard-limit"} @invariant "The hidden guard-pull counter's when-predicate filters commits by technique name: interleaved non-pull commits never advance reward.guard-pull-three, three guard-pull commits mint the pulled-guard-again coin, and the hidden counter itself never fires a challenge_completed beat." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { casualWeek1 } from "./personas"

/**
 * THE HIDDEN GUARD-PULL COUNTER COUNTS ONLY MATCHING COMMITS — when-predicate filtering.
 * Source seams (verified at authoring):
 *   - challenge-definitions.src.js:301 — reward.guard-pull-three: hidden, target 3,
 *     { event: "commit", when: (p) => /guard.*pull|pull.*guard/i.test(p.technique || "") }.
 *   - challenge-definitions.src.js:343 — coin pulled-guard-again: sourceChallenge
 *     "reward.guard-pull-three".
 *   - app.src.jsx:5007 — fx("commit", { technique: act.t }) fires on the [data-go] click,
 *     and fx() → noteChallenges → ngRewardChanges run SYNCHRONOUSLY in that same JS turn,
 *     so counter progress and the mint are readable with ZERO sim pump after pick().
 *   - app.src.jsx:4569 — `if (!definition || definition.hidden) continue;` — a hidden
 *     definition completing NEVER emits challenge_completed (the coin is its only voice).
 * So three guard-pull commits with non-pull commits interleaved must read progress
 * 1 → 1 → 2 → 2 → 3/done: the interleaves leave the counter untouched, the third match
 * mints coin_earned{id:"pulled-guard-again"} exactly once, and no challenge_completed
 * beat with a reward.* id ever exists. Both the in-memory coins map and the persisted
 * blob (after _flushSave) hold exactly the one coin.
 *
 * CRITICAL SEAM — guard pulls are BOTTOM-player routes, and rollFromPosition
 * (app.src.jsx:4808) name-forces playerRole from the node title, so stageRollAt at
 * "Standing Position Top" would always play top and optionsFor's beneficiary filter
 * would drop every pull. Only startRoll's independent role draw (app.src.jsx:4844,
 * rng("role") — >= .5 → bottom) can deal one; j.land() is unusable here (it hard-rigs
 * role [0] → top). Per cycle: rig ai-skill/role/max-moves, rigStart(standingIdx),
 * (cycles 2-3) a.startRoll(), pump until landed at Standing with a fresh hand.
 *
 * Determinism census (probe CONFIRMED 2/2 green, ~11.5-11.9s, identical beat streams):
 * role [0.9] → bottom every cycle; bottom tray at Standing reliably deals 4 pull routes
 * in the top-10. Per pick: resolve [0.01] (success), outcome [0.01] (first outcome —
 * pull lands at Closed Guard, where the interleave hand deals). Interleave pick excludes
 * the pull regex AND /berimbolo/i (berimbolo-briefly is its own commit-when coin); 5
 * total sheet opens stay under reward.sheet-twelve's 12 and 1-per-land under research's
 * 3, so pulled-guard-again is provably the ONLY coin in memory and in the blob.
 * casualWeek1 + the DSL's default tutorial-complete boot pre-completes white.commit, so
 * plain commits emit no white-track challenge_completed noise.
 * Structure-only assertions: beats, counts, ids, progress shapes — never card text.
 */

// the counter's own when-predicate, verbatim (challenge-definitions.src.js:301)
const GP = /guard.*pull|pull.*guard/i

test("three guard-pull commits with non-pull interleaves: the hidden counter advances only on matches, mints pulled-guard-again once, and never emits challenge_completed", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/", { initialState: casualWeek1() })

  const standingIdx = await page.evaluate(() => {
    const a = (window as any).__neural
    return a.nodes.findIndex((n: any) => n.ty === "positions" && n.t === "Standing Position Top")
  })
  expect(standingIdx, "Standing Position Top exists in the graph").toBeGreaterThan(-1)

  // ── one ledger read: counter progress + every beat family the invariant speaks about ──
  const ledger = () =>
    page.evaluate(() => {
      const a = (window as any).__neural
      const beats = (a.beats || []) as any[]
      return {
        counter: a.challengeProgress("reward.guard-pull-three"), // {progress, done, t}
        mints: beats.filter((b) => b.beat === "coin_earned" && b.id === "pulled-guard-again").length,
        hiddenCompleted: beats.filter(
          (b) => b.beat === "challenge_completed" && /^reward\./.test(b.id || ""),
        ).length,
        commits: beats.filter((b) => b.beat === "commit").map((b) => b.technique || ""),
        coinIds: Object.keys(a.coins || {}),
      }
    })

  // ── land at Standing as the BOTTOM player (startRoll's independent role draw) ──
  const landAtStandingAsBottom = async (cycle: number) => {
    await j.rig("ai-skill", [0.5])
    await j.rig("role", [0.9]) // >= .5 → bottom (app.src.jsx:4844) — the only route to a pull hand
    await j.rig("max-moves", [0.5])
    const dealt0 = await page.evaluate(
      () => (((window as any).__neural || {}).beats || []).filter((b: any) => b.beat === "options_dealt").length,
    )
    await page.evaluate(
      ([idx, restart]) => {
        const a = (window as any).__neural
        a.rigStart(idx) // test rail: next startRoll begins here
        if (restart) a.startRoll() // cycles 2-3 restart manually; cycle 1's intro auto-starts
      },
      [standingIdx, cycle > 1] as const,
    )
    let landed = false
    for (let i = 0; i < 30 && !landed; i++) {
      await j.advance(1000)
      landed = await page.evaluate(
        ([idx, d0]) => {
          const a = (window as any).__neural
          const dealt = (a.beats || []).filter((b: any) => b.beat === "options_dealt").length
          return a.currentPos === idx && dealt > (d0 as number) && (a.optionIdxs || []).length > 0
        },
        [standingIdx, dealt0] as const,
      )
    }
    expect(landed, `cycle ${cycle}: landed at Standing with a fresh hand`).toBe(true)
    await page.evaluate(() => (window as any).__neural?.dismissCoach?.())
    expect(
      await page.evaluate(() => (window as any).__neural.playerRole),
      `cycle ${cycle}: the rigged role draw dealt the bottom player`,
    ).toBe("bottom")
  }

  // ── THE ARC: pull, interleave, pull, interleave, pull — ledger read after every commit ──
  for (let cycle = 1; cycle <= 3; cycle++) {
    await landAtStandingAsBottom(cycle)

    const titles = await j.optionTitles()
    const pull = titles.find((t) => GP.test(t))
    expect(pull, `cycle ${cycle}: a guard-pull route dealt in the bottom tray at Standing`).toBeTruthy()
    await j.rig("resolve", [0.01]) // success — the pull lands at Closed Guard
    await j.rig("outcome", [0.01]) // first outcome (success branch)
    await j.pick(pull as string)

    // SYNCHRONOUS: fx("commit") → noteChallenges → ngRewardChanges already ran in the
    // [data-go] click's JS turn — read the ledger with NO sim pump in between.
    const s = await ledger()
    expect(GP.test(s.commits[s.commits.length - 1]), `commit ${s.commits.length} matches the counter's predicate`).toBe(true)
    expect(s.counter.progress, `pull ${cycle} advanced reward.guard-pull-three to ${cycle}`).toBe(cycle)
    expect(s.counter.done, `reward.guard-pull-three done flag at pull ${cycle}`).toBe(cycle === 3)
    expect(s.mints, `pulled-guard-again coin_earned count after pull ${cycle}`).toBe(cycle === 3 ? 1 : 0)
    expect(s.coinIds.includes("pulled-guard-again"), `coins map holds the coin only at pull three (pull ${cycle})`).toBe(cycle === 3)
    expect(s.hiddenCompleted, "hidden reward.* counters never fire challenge_completed").toBe(0)

    if (cycle < 3) {
      // ── INTERLEAVE: a NON-pull transition commit must leave the counter untouched ──
      await j.nextHand(30000) // pull success travels to Closed Guard and deals the next hand
      const other = await page.evaluate(() => {
        const a = (window as any).__neural
        for (const o of a.optionIdxs || []) {
          const idx = typeof o === "number" ? o : o.idx
          const n = a.nodes[idx]
          // transitions only; exclude the pull predicate AND berimbolo (its own commit-when coin)
          if (n && n.ty === "transitions" && !/guard.*pull|pull.*guard/i.test(n.t) && !/berimbolo/i.test(n.t)) return n.t
        }
        return null
      })
      expect(other, `cycle ${cycle}: a non-pull transition available to interleave`).toBeTruthy()
      await j.rig("resolve", [0.01])
      await j.rig("outcome", [0.01])
      await j.pick(other as string)

      const s2 = await ledger()
      expect(GP.test(s2.commits[s2.commits.length - 1]), "the interleaved commit does NOT match the predicate").toBe(false)
      expect(s2.counter.progress, `interleaved non-pull commit left progress untouched (${cycle}→${cycle})`).toBe(cycle)
      expect(s2.counter.done, "counter not done after an interleave").toBe(false)
      expect(s2.mints, "no coin minted by a non-pull commit").toBe(0)
      await j.nextHand(30000) // settle the interleave resolve before the next manual startRoll
    }
  }

  // ── SETTLE + PERSIST: nothing re-fires; memory and the durable blob agree exactly ──
  await j.advance(3000)
  const fin = await ledger()
  expect(fin.commits.length, "exactly five commits total (3 pulls + 2 interleaves)").toBe(5)
  expect(fin.commits.filter((t) => GP.test(t)).length, "exactly three predicate-matching commits").toBe(3)
  expect(fin.counter, "counter settled at 3/done").toMatchObject({ progress: 3, done: true })
  expect(fin.mints, "still exactly ONE pulled-guard-again mint after settling").toBe(1)
  expect(fin.hiddenCompleted, "still ZERO reward.* challenge_completed beats after settling").toBe(0)
  expect(fin.coinIds, "in-memory coins hold exactly the one minted coin").toEqual(["pulled-guard-again"])

  const persistedCoins = await page.evaluate(() => {
    const a = (window as any).__neural
    a._flushSave()
    const blob = JSON.parse(localStorage.getItem("bjj-neural-progress") || "{}")
    return Object.keys(blob.coins || {})
  })
  expect(persistedCoins, "persisted blob carries exactly the one minted coin").toEqual(["pulled-guard-again"])
})
