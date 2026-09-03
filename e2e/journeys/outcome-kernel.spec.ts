import { test, expect } from "@playwright/test"
import { journey } from "../dsl"

/**
 * THE MISS DISTRIBUTION IS THE ONE THE CARD PRICES (v1.121.0).
 *
 * `resolve()` decides success/miss on `moveChance` — the player-facing, drill-improvable gate,
 * which is right and stays. Until v1.121.0 it then drew the ROW from the WHOLE authored table and,
 * when the drawn row's branch disagreed with the gate, replaced it with `outcomes.find(...)`: the
 * FIRST matching cell. Authored lists run success → failure → counter and 1327 of 1331 end in a
 * counter, so every miss that happened to draw a success cell was dumped onto the first `failure`
 * and the counter cells starved. Measured over the whole corpus (see the corpus test below, and
 * `tests/artifacts/_resolve_kernel_measure.py` for the same figures derived analytically from
 * graph-data.json): TV mean 0.0902 · max 0.2440, TV == 0 on ZERO of 1331 nodes, and 47.39% of all
 * authored counter mass never reached the player.
 *
 * Every claim here is measured through the app's OWN `resolve()`, not a re-implementation: the four
 * things it calls after choosing (enterSuccessCal / enterFailCal / enterSuccess / enterFail) are
 * stubbed for the duration, so the function under test runs whole and moves nothing. The stubs are
 * restored in the same evaluate, and `_combo = 0` pins momentumSkew() to 0 so the authored weights
 * ARE the live weights.
 *
 * RED-PROOF: restore the coercion in `neural/src/app.src.jsx` —
 *     const out = this.drawOutcome(act);
 *     if (success) return this.enterSuccessCal(opt, out.result === "success" ? out
 *                    : (act.cal.outcomes.find((o) => o.result === "success") || out));
 *     return this.enterFailCal(opt, out.result !== "success" ? out
 *                    : (act.cal.outcomes.find((o) => o.result !== "success") || out));
 * — rebuild, and the first two tests fail on the numbers above.
 */

const GRID = 200 // sweep steps per branch; TV resolution ±1/GRID

// One in-page sweep, reused by both corpus tests. Returns per-node TV against the authored
// within-branch kernel plus the corpus counter-mass totals.
const SWEEP = (GRID: number) => {
  const a = (window as any).__neural
  const combo0 = a._combo
  a._combo = 0 // momentumSkew() === 0 → authored weights are the live weights
  const keys = ["enterSuccessCal", "enterFailCal", "enterSuccess", "enterFail"]
  const saved = keys.map((k) => [k, a[k]] as [string, any])
  let got: any = null
  a.enterSuccessCal = (_o: any, out: any) => { got = out }
  a.enterFailCal = (_o: any, out: any) => { got = out }
  a.enterSuccess = () => { got = null }
  a.enterFail = () => { got = null }
  const rig0 = a._rig
  const beats0 = (a.beats || []).length

  const tvs: number[] = []
  let counterRolled = 0, counterAuthored = 0, nodes = 0, endsCounter = 0
  let worst = { tv: -1, id: "" }
  try {
    for (let i = 0; i < a.nodes.length; i++) {
      const n = a.nodes[i]
      const outs = n.cal && Array.isArray(n.cal.outcomes) ? n.cal.outcomes : null
      if (!outs || !outs.length) continue
      const p = a.calSuccess(n)
      if (p == null) continue
      nodes++
      if (outs[outs.length - 1].result === "counter") endsCounter++

      const hits = outs.map(() => 0)
      for (const success of [true, false]) {
        const mass = success ? p : 1 - p
        for (let k = 0; k < GRID; k++) {
          a._rig = { outcome: [(k + 0.5) / GRID] }
          got = null
          a.resolve({ idx: i, res: -1 }, success)
          const j = got ? outs.indexOf(got) : -1
          if (j >= 0) hits[j] += mass / GRID
        }
      }
      // authored: branch by p, row by weight renormalised INSIDE the branch
      const w = outs.map((o: any) => Math.max(0, +o.probability || 0))
      const isS = outs.map((o: any) => o.result === "success")
      let Ws = 0, Wm = 0
      for (let j = 0; j < outs.length; j++) isS[j] ? (Ws += w[j]) : (Wm += w[j])
      const auth = outs.map((o: any, j: number) =>
        isS[j] ? (Ws > 0 ? (p * w[j]) / Ws : 0) : Wm > 0 ? ((1 - p) * w[j]) / Wm : 0,
      )
      let tv = 0
      for (let j = 0; j < outs.length; j++) tv += Math.abs(hits[j] - auth[j])
      tv /= 2
      tvs.push(tv)
      if (tv > worst.tv) worst = { tv, id: n.id }
      for (let j = 0; j < outs.length; j++)
        if (outs[j].result === "counter") { counterRolled += hits[j]; counterAuthored += auth[j] }
    }
  } finally {
    for (const [k, v] of saved) a[k] = v
    a._rig = rig0
    a._combo = combo0
  }
  const sum = (x: number[]) => x.reduce((s, v) => s + v, 0)
  return {
    nodes, endsCounter, worst,
    tvMean: sum(tvs) / tvs.length,
    tvMax: Math.max(...tvs),
    tvOverGrid: tvs.filter((t) => t > 2 / GRID).length,
    counterRolled, counterAuthored,
    sideEffects: (a.beats || []).length - beats0,
  }
}

test("@curated every node's rolled outcome distribution IS its authored one, drawn inside the branch the gate chose", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")

  const r = await page.evaluate(SWEEP, GRID)

  // the corpus is the one the canon quotes — if these move, the measurement moved, not the app
  // 1328: 1331 before the v1.155.0 collapse of five transition twins, 1326 after, and 1328 once
  // v1.156.0 added one transition and one submission. VERIFIED COMPLETE, not merely moved: every
  // technique node on the emitted wire carries cal.outcomes — 1030 transitions + 298 submissions
  // = 1328, with ZERO technique nodes missing one. So this stays a real coverage floor: a sweep
  // that started skipping nodes would still drop below it and fail here.
  expect(r.nodes, "every node carrying cal.outcomes was swept").toBe(1312) // census:calOutcomeNodes
  // 1324 of 1328 (1322 of 1326 before v1.156.0; both new nodes end in a counter, +2). THE TAIL IS
  // THE PART THIS LINE GUARDS AND IT HAS NEVER MOVED: 3 ending in failure, 1 in success, measured
  // again on this corpus and bit-identical across the collapse AND the two additions.
  expect(r.endsCounter, "outcome lists ending in a counter — why the .find() drained counters").toBe(1308) // census:endsCounter
  expect(r.sideEffects, "the probe moved nothing: zero fx beats emitted").toBe(0)

  // Pre-fix this read mean 0.0902 / max 0.2440 with ZERO nodes at 0. The tolerance is the sweep
  // grid, not slack: one draw quantised to 1/GRID cannot resolve a band edge more finely.
  expect(r.tvMean, `mean TV vs the authored kernel (worst node ${r.worst.id} at ${r.worst.tv.toFixed(4)})`).toBeLessThan(2 / GRID)
  expect(r.tvMax, "no single node is off by more than the grid can resolve").toBeLessThan(3 / GRID)
  expect(r.tvOverGrid, "nodes whose kernel differs by more than grid resolution").toBe(0)
})

test("@curated the counter cells are rolled at their authored weight — 47.4% of that mass used to be drained into the first failure", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")

  const r = await page.evaluate(SWEEP, GRID)
  const lost = r.counterAuthored - r.counterRolled
  // authored total is ~233.8 summed over the 1331 nodes; pre-fix 110.8 of it (47.39%) never landed
  expect(r.counterAuthored, "authored counter mass across the corpus").toBeGreaterThan(200)
  expect(Math.abs(lost) / r.counterAuthored, `counter mass lost (${lost.toFixed(3)} of ${r.counterAuthored.toFixed(3)})`).toBeLessThan(0.01)
})

test("resolve makes EXACTLY ONE outcome draw, on either branch, and the opponent's draw still sees the whole table", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")

  const r = await page.evaluate(() => {
    const a = (window as any).__neural
    // a real node shaped like the corpus: success first, a non-success cell last, and the last
    // cell heavy enough that a 0.99 draw cannot overshoot it
    const idx = a.nodes.findIndex((n: any) => {
      const o = n.cal && n.cal.outcomes
      if (!o || o.length < 3 || o[0].result !== "success" || o[o.length - 1].result === "success") return false
      const tot = o.reduce((s: number, x: any) => s + Math.max(0, +x.probability || 0), 0)
      return tot > 0 && Math.max(0, +o[o.length - 1].probability || 0) / tot > 0.05
    })
    const keys = ["enterSuccessCal", "enterFailCal", "enterSuccess", "enterFail"]
    const saved = keys.map((k) => [k, a[k]] as [string, any])
    let got: any = null
    for (const k of keys) a[k] = (_o: any, out: any) => { got = out || null }
    const combo0 = a._combo, rig0 = a._rig
    a._combo = 0
    const draws: Record<string, number> = {}
    const rng0 = a.rng.bind(a)
    a.rng = (tag: string) => { draws[tag] = (draws[tag] || 0) + 1; return rng0(tag) }
    let counts: any = {}
    try {
      for (const success of [true, false]) {
        for (const k in draws) delete draws[k]
        a._rig = { outcome: [0.5] }
        got = null
        a.resolve({ idx, res: -1 }, success)
        counts[success ? "success" : "miss"] = { outcome: draws.outcome || 0, resolve: draws.resolve || 0, branch: got && got.result }
      }
      // The opponent's destination draw passes NO branch — it must still walk the WHOLE table.
      // Both ends are asserted, and the low end is the load-bearing one: `!!undefined` is false,
      // so a filter that forgot to check for "no branch at all" would silently serve the MISS
      // branch — and since 1327 of 1331 lists end in a counter, the 0.99 end alone would still
      // look right. A 0.01 draw must reach the FIRST cell, which is a success cell here.
      const outs = a.nodes[idx].cal.outcomes
      a._rig = { outcome: [0.99] }
      counts.wholeTableIsLastRow = a.drawOutcome(a.nodes[idx]) === outs[outs.length - 1]
      a._rig = { outcome: [0.01] }
      const low = a.drawOutcome(a.nodes[idx])
      counts.wholeTableIsFirstRow = low === outs[0]
      counts.lowRowResult = low && low.result
      counts.firstRowResult = outs[0].result
    } finally {
      delete a.rng // restore the prototype method rather than pinning a bound own-property copy
      for (const [k, v] of saved) a[k] = v
      a._rig = rig0
      a._combo = combo0
    }
    return counts
  })

  expect(r.success.outcome, "one rng('outcome') draw on the success branch").toBe(1)
  expect(r.miss.outcome, "one rng('outcome') draw on the miss branch").toBe(1)
  // `forced` is supplied, so resolve never rolls its own gate — the sweep already did
  expect(r.success.resolve, "no extra rng('resolve') draw when the branch is forced").toBe(0)
  expect(r.success.branch, "a success gate returns a success cell").toBe("success")
  expect(r.miss.branch, "a miss gate returns a non-success cell").not.toBe("success")
  expect(r.wholeTableIsLastRow, "drawOutcome with no branch is unchanged: 0.99 lands on the last cell").toBe(true)
  expect(r.firstRowResult, "the probe node's first cell is a success cell").toBe("success")
  expect(r.wholeTableIsFirstRow, `drawOutcome with no branch reaches the SUCCESS cell too: 0.01 landed on a ${r.lowRowResult} cell`).toBe(true)
})
