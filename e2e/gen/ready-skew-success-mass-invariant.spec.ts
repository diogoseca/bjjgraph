/* @hyperspace {"theme":"momentum-and-economy","L":"belt-ready","F":"graph-canvas","B":"economy-math"} @invariant "Momentum skew only sheds counter weight: a dice that lands inside the success band cold lands success hot too (authored success mass is untouched), and a success draw under full skew emits zero outcome_skewed beats — the beat and the renormalization exist only for non-success results." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { beltReady } from "./personas"

/**
 * SKEW SHEDS ONLY COUNTER WEIGHT — the v1.70.0 momentum skew (neural/src/app.src.jsx).
 * drawOutcome (:5034-5046) weighs each authored outcome as max(0, probability) and scales
 * ONLY result==="counter" rows by (1-sk), where sk = momentumSkew() (:4332) =
 * min(0.40, (min(_combo,5)-1)*0.10) — so _combo=0 → sk 0 and _combo=5 → the 0.4 cap.
 * Success rows keep their authored mass VERBATIM: under full skew a success-first
 * [success 50, counter 50] table's total shrinks 100 → 80, so the success band in dice
 * space can only WIDEN, [0,.5] → [0,50/80=.625]. The outcome_skewed beat is gated on
 * `sk > 0 && chosen.result !== "success"` — it exists only for non-success draws under a
 * live skew, and carries {skew, result} onto a.beats via fx().
 *
 * Both tests drive the LIVE instance's drawOutcome via evaluate with a SYNTHETIC
 * success-first act, because the pointwise "success-cold implies success-hot" claim is
 * outcome-ORDER-sensitive: it is guaranteed when success precedes any failure row (true
 * of this table and of typical authored order), but a failure row listed BEFORE success
 * could capture a dice value as the shrinking total drags r past the earlier band edge.
 * Success MASS still strictly grows in every order; this spec pins the success-first
 * table, where mass growth and pointwise band growth coincide.
 *
 * Determinism census: land() rigs ai-skill/role/max-moves. Every drawOutcome call
 * consumes exactly one "outcome" rig value (FIFO via a.rig), queued in-evaluate
 * immediately before its draws so nothing ambient can eat the queue; queues are sized
 * exactly to the draws made, leaving no leftovers. No sim time is pumped after landing —
 * evaluate-only work never moves the decision clock. _combo is per-roll state (reset in
 * startRoll/rollFromPosition), set directly and restored to its found value, so each
 * test leaves the app exactly as it found it.
 */

// Synthetic success-first table for the live drawOutcome. `to` slugs are never resolved
// by drawOutcome (resolution happens later, in the resolve path) — they ride along only
// so the rows are shaped like real cal.outcomes.
const SYNTHETIC = {
  cal: {
    outcomes: [
      { result: "success", probability: 50, to: "side control/top" },
      { result: "counter", probability: 50, to: "mount/bottom" },
    ],
  },
}

test("same dice cold→hot: the success band only widens ([0,.5]→[0,.625]), authored [50,50] untouched, and every draw — cold counters included — is beat-silent", async ({ page }) => {
  const j = journey(page)
  await j.boot("/", { initialState: beltReady() })
  await j.land("Mount Top")

  const m = await page.evaluate((synthetic) => {
    const a = (window as any).__neural
    const act = synthetic
    const found = a._combo || 0
    const skewed = () => (a.beats || []).filter((b: any) => b.beat === "outcome_skewed").length
    const base = skewed()
    const draw = (dice: number[]) => {
      a.rig("outcome", dice) // one FIFO value per drawOutcome call, queue sized exactly
      return dice.map((d) => {
        const before = skewed()
        const chosen = a.drawOutcome(act)
        return { dice: d, result: chosen.result, beatDelta: skewed() - before }
      })
    }

    a._combo = 0
    const skCold = a.momentumSkew()
    const cold = draw([0.3, 0.55, 0.62, 0.99])

    a._combo = 5
    const skHot = a.momentumSkew()
    const hot = draw([0.3, 0.55, 0.62])

    const authored = act.cal.outcomes.map((o: any) => ({ result: o.result, probability: o.probability }))
    a._combo = found // leave the roll's meter exactly as found
    return { skCold, skHot, cold, hot, authored, skewedBeatsTotal: skewed() - base, comboRestored: a._combo === found }
  }, SYNTHETIC)

  // the skew endpoints this spec rides on: _combo=0 → 0, _combo=5 → the 0.4 cap
  expect(m.skCold, "momentumSkew is 0 at _combo=0").toBe(0)
  expect(m.skHot, "momentumSkew caps at 0.40 at _combo=5").toBeCloseTo(0.4, 6)

  // cold (sk=0): the authored table verbatim — success band is [0,.5] of the dice
  expect(m.cold.map((r) => r.result), "cold draws follow the authored [50,50] bands").toEqual([
    "success",
    "counter",
    "counter",
    "counter",
  ])

  // hot (sk=0.4): counter sheds 50→30, total shrinks 100→80, success band widens to [0,.625]
  expect(m.hot.map((r) => r.result), "hot draws follow the widened success band").toEqual([
    "success",
    "success",
    "success",
  ])

  // THE INVARIANT, pointwise on the shared dice: success cold implies success hot
  for (let i = 0; i < m.hot.length; i++) {
    if (m.cold[i].result === "success") {
      expect(m.hot[i].result, `dice ${m.hot[i].dice}: lands success cold, so it must land success hot`).toBe("success")
    }
  }
  // band growth made visible: .55 is OUTSIDE the cold band but INSIDE the hot one, and
  // .62 sits just under the widened 50/80 = .625 edge — the renormalization is real
  expect(m.cold[1].result, "dice .55 outside the cold [0,.5] band").toBe("counter")
  expect(m.hot[1].result, "dice .55 inside the hot [0,.625] band").toBe("success")
  expect(m.hot[2].result, "dice .62 just under the widened .625 edge").toBe("success")

  // beat silence: cold counters are gated out by sk===0, hot draws were all successes —
  // zero outcome_skewed beats anywhere in this journey
  for (const r of [...m.cold, ...m.hot]) {
    expect(r.beatDelta, `dice ${r.dice} (${r.result}) emitted no outcome_skewed beat`).toBe(0)
  }
  expect(m.skewedBeatsTotal, "zero outcome_skewed beats across the whole test").toBe(0)

  // authored mass untouched: the skew is applied in the weight closure, never written back
  expect(m.authored, "authored outcome probabilities never mutated").toEqual([
    { result: "success", probability: 50 },
    { result: "counter", probability: 50 },
  ])
  expect(m.comboRestored, "app left exactly as found").toBe(true)
})

test("under full skew a counter draw emits exactly one outcome_skewed {skew:0.4, result:'counter'} beat; the identical cold counter emits none", async ({ page }) => {
  const j = journey(page)
  await j.boot("/", { initialState: beltReady() })
  await j.land("Mount Top")

  const m = await page.evaluate((synthetic) => {
    const a = (window as any).__neural
    const act = synthetic
    const found = a._combo || 0
    const all = () => (a.beats || []).filter((b: any) => b.beat === "outcome_skewed")
    const base = all().length
    const draw = (dice: number[]) => {
      a.rig("outcome", dice)
      return dice.map((d) => {
        const before = all().length
        const chosen = a.drawOutcome(act)
        const after = all()
        const last = after.length ? after[after.length - 1] : null
        return {
          dice: d,
          result: chosen.result,
          beatDelta: after.length - before,
          payload: last ? { skew: last.skew, result: last.result } : null,
        }
      })
    }

    a._combo = 5
    const skHot = a.momentumSkew()
    const hot = draw([0.99, 0.63]) // .99 deep in the counter band; .63 just past the .625 edge

    a._combo = 0
    const skCold = a.momentumSkew()
    const cold = draw([0.99])

    const authored = act.cal.outcomes.map((o: any) => ({ result: o.result, probability: o.probability }))
    a._combo = found
    return { skHot, skCold, hot, cold, authored, skewedBeatsTotal: all().length - base }
  }, SYNTHETIC)

  expect(m.skHot, "momentumSkew at the 0.40 cap for the hot draws").toBeCloseTo(0.4, 6)
  expect(m.skCold, "momentumSkew back to 0 for the cold draw").toBe(0)

  // hot counters: EXACTLY one beat each, carrying the live skew and the drawn result
  for (const r of m.hot) {
    expect(r.result, `hot dice ${r.dice} lands counter`).toBe("counter")
    expect(r.beatDelta, `hot dice ${r.dice} emitted exactly one outcome_skewed beat`).toBe(1)
    expect(r.payload!.result, "beat carries the non-success result").toBe("counter")
    expect(r.payload!.skew, "beat carries the live 0.4 skew").toBeCloseTo(0.4, 6)
  }
  // .63 pins the band's top edge under skew: past 50/80 = .625, still counter, still beat-worthy
  expect(m.hot[1].dice, "edge probe dice is .63").toBeCloseTo(0.63, 6)

  // the SAME dice cold: still a counter (authored band), but the sk>0 gate keeps it silent
  expect(m.cold[0].result, "cold dice .99 lands counter off the authored table").toBe("counter")
  expect(m.cold[0].beatDelta, "cold counter emits no outcome_skewed beat — the beat requires sk>0").toBe(0)
  expect(m.skewedBeatsTotal, "the two hot counters are the only beats in the journey").toBe(2)

  // authored mass untouched here too — three more draws, zero writes
  expect(m.authored, "authored outcome probabilities never mutated").toEqual([
    { result: "success", probability: 50 },
    { result: "counter", probability: 50 },
  ])
})
