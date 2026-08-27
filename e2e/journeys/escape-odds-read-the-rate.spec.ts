import { test, expect } from "@playwright/test"
import { journey } from "../dsl"

type W = Window & { __neural: any }

/**
 * THE TRAPPED SEAT COULD NOT SEE THE SUBMISSION'S OWN RATE.
 *
 * `escapeChance` was a flat `0.4` plus a dominance delta, a drill bonus, momentum and aiSkill. It
 * called neither `calSuccess` nor `success_rate` nor `outcomes` — while `moveChance`, the ATTACKING
 * half of the identical exchange, has read `calSuccess(act)` as its base since v1.115.0. So every
 * authored submission rate was invisible from the seat being submitted.
 *
 * WHAT THIS ASSERTS, and why it is shaped this way (§6.3):
 *  · NOT "the number equals 1 - rate". That would be a spec-side copy of the formula, written from
 *    the same reading of the code under test, and would agree by construction.
 *  · Instead it drives the REAL `escapeChance` over many real submissions with everything else held
 *    constant — same escape option, momentum and aiSkill neutralised — and asserts two properties
 *    the old build cannot have: the output is not CONSTANT across differing rates, and it moves
 *    DOWN as the authored finish rate goes UP. Direction is the whole claim; a change that read the
 *    rate with the wrong sign would pass a "not constant" test and fail this one.
 *  · A non-triviality floor sits in front of both, because a sample of one submission satisfies
 *    "not constant" vacuously.
 */
test("@curated escape odds read the submission's own rate, and fall as it rises", async ({ page }) => {
  const j = journey(page)
  await j.boot()

  const m = await page.evaluate(() => {
    const a = (window as unknown as W).__neural
    // neutralise everything that is not the submission's rate
    a.aiSkill = 0
    a._momentum = 0
    a._panicKey = null
    const subs = a.nodes.filter((n: any) => n.ty === "submissions" && a.calSuccess(n) != null)
    // ONE escape option for every reading, so the dominance delta is the only other moving part
    const esc = a.nodes.find((n: any) => n.ty === "positions")
    const rows: Array<{ rate: number; escape: number; name: string }> = []
    for (const s of subs) {
      a._defendSub = s.idx
      rows.push({ rate: a.calSuccess(s), escape: a.escapeChance({ node: esc }), name: s.t })
    }
    a._defendSub = null
    // Pearson correlation between the authored finish rate and the escape chance
    const n = rows.length
    const mx = rows.reduce((t, r) => t + r.rate, 0) / n
    const my = rows.reduce((t, r) => t + r.escape, 0) / n
    let num = 0, dx = 0, dy = 0
    for (const r of rows) {
      num += (r.rate - mx) * (r.escape - my)
      dx += (r.rate - mx) ** 2
      dy += (r.escape - my) ** 2
    }
    return {
      n,
      distinctEscape: new Set(rows.map((r) => r.escape.toFixed(4))).size,
      distinctRate: new Set(rows.map((r) => r.rate.toFixed(4))).size,
      corr: num / Math.sqrt(dx * dy),
      hardest: rows.reduce((a2, b) => (b.rate > a2.rate ? b : a2)),
      easiest: rows.reduce((a2, b) => (b.rate < a2.rate ? b : a2)),
    }
  })

  // FLOOR FIRST — a one-row sample satisfies every property below vacuously.
  expect(m.n, "enough calibrated submissions to say anything").toBeGreaterThan(100)
  expect(m.distinctRate, "the corpus really does author different rates").toBeGreaterThan(5)

  // the old build produced ONE value here, whatever the submission
  expect(m.distinctEscape, "escape odds are not a constant across submissions").toBeGreaterThan(5)

  // DIRECTION: the harder the finish, the harder the escape. A sign error fails here and only here.
  expect(m.corr, "escape chance falls as the authored finish rate rises").toBeLessThan(-0.5)
  expect(
    m.hardest.escape,
    `the hardest submission (${m.hardest.name}) must be harder to escape than the easiest (${m.easiest.name})`,
  ).toBeLessThan(m.easiest.escape)
})
