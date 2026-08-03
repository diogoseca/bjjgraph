/* @hyperspace {"theme":"momentum-and-economy","L":"srs-veteran","F":"option-tray-sheet","B":"idempotence"} @invariant "Skew is draw-time renormalization, never data mutation: a hot drawOutcome leaves the node's cal.outcomes array deep-equal to its pre-draw snapshot (same objects, same probabilities), so repeated hot draws on the same node stay based on authored numbers." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { srsVeteran } from "./personas"

/**
 * AUTHORED OUTCOMES ARE NEVER MUTATED — momentum's ×5 skew (momentumSkew() = 0.40,
 * app.src.jsx:4332) is applied inside drawOutcome's LOCAL `w(o)` closure
 * (app.src.jsx:5034-5046): counter outcomes shed 40% of their weight at draw time and
 * favorable outcomes gain the difference implicitly through relative weights — the
 * authored cal.outcomes data is read, never written. This journey pins that read-only
 * contract at its hottest: two consecutive fully-hot draws on the same node must leave
 * the outcomes array byte-identical AND reference-identical (same array object, same
 * member objects in order, same probabilities), and both draws must return the SAME
 * authored object — a hot draw is a pure function of (authored numbers, dice), never
 * of prior draws.
 *
 * Determinism census: land() rigs ai-skill/role/max-moves; each drawOutcome consumes
 * exactly one "outcome" value, so the queue is re-rigged to [0.99] before EACH call.
 * The whole measurement is evaluate-only after the hand is dealt — no sim time passes
 * in testMode, so the decision clock never moves under it. drawOutcome is invoked
 * directly (documented internal: the invariant lives in the draw seam itself, not in
 * a resolve arc, and object-identity comparisons cannot cross the evaluate
 * serialization boundary — which is also why the rig rail is invoked in-page via
 * a.rig, the exact seam j.rig wraps). _combo is restored at the end so the app leaves
 * the journey exactly as the landing left it.
 *
 * The outcome_skewed beat (emitted when skew is live and a non-success is chosen,
 * :5044) is asserted as a delta of exactly 2 — CONDITIONALLY on draw1's result not
 * being "success", so a content wave reordering Mount Top's outcome tables can never
 * turn this data-immutability spec into an accidental content pin.
 */

test("two fully-hot drawOutcome calls: same authored object twice, cal.outcomes untouched (refs + JSON + probabilities)", async ({ page }) => {
  const j = journey(page)
  await j.boot("/", { initialState: srsVeteran() })
  await j.land("Mount Top")
  await j.expectBeat("options_dealt")

  const m = await page.evaluate(() => {
    const a = (window as any).__neural
    // the Mount Top hand always deals at least one transition with an authored counter outcome
    const opt = (a._optList || []).find(
      (o: any) =>
        a.nodes[o.idx]?.ty === "transitions" &&
        Array.isArray(a.nodes[o.idx].cal?.outcomes) &&
        a.nodes[o.idx].cal.outcomes.some((x: any) => x.result === "counter"),
    )
    if (!opt) return null
    const node = a.nodes[opt.idx]
    const outs = node.cal.outcomes

    // ── pre-draw snapshot: JSON + array ref + per-object refs + probabilities ──
    const jsonBefore = JSON.stringify(outs)
    const arrayRef = outs
    const objRefs = outs.slice()
    const probsBefore = outs.map((o: any) => o.probability)
    const skewedBefore = (a.beats || []).filter((b: any) => b.beat === "outcome_skewed").length

    // ── go fully hot, draw twice on identically rigged dice ──
    const comboFound = a._combo || 0
    a._combo = 5
    const skew = a.momentumSkew()
    a.rig("outcome", [0.99]) // the queue is consumed per draw — re-rig before EACH call
    const draw1 = a.drawOutcome(node)
    a.rig("outcome", [0.99])
    const draw2 = a.drawOutcome(node)
    a._combo = comboFound // cool back down — leave the app in the found state
    const skewAfter = a.momentumSkew()

    const outsAfter = node.cal.outcomes
    return {
      skew,
      skewAfter,
      // idempotence of the draw itself
      sameObject: draw1 === draw2,
      authoredIdx: outs.indexOf(draw1),
      result1: draw1 ? draw1.result : null,
      result2: draw2 ? draw2.result : null,
      // data immutability
      jsonEqual: JSON.stringify(outsAfter) === jsonBefore,
      sameArrayRef: outsAfter === arrayRef,
      sameLength: outsAfter.length === objRefs.length,
      everyObjRefKept: outsAfter.every((o: any, i: number) => o === objRefs[i]),
      probsUnchanged: outsAfter.every((o: any, i: number) => o.probability === probsBefore[i]),
      nOutcomes: outsAfter.length,
      skewedDelta: (a.beats || []).filter((b: any) => b.beat === "outcome_skewed").length - skewedBefore,
    }
  })

  expect(m, "Mount Top hand dealt a transition with an authored counter outcome").toBeTruthy()
  expect(m!.skew, "×5 combo = the full 40% skew, live for both draws").toBe(0.4)
  expect(m!.skewAfter, "combo restored — skew back at the found state").toBe(0)

  // schema floor: a transition authors 3-5 outcomes — the table under test is real, not a stub
  expect(m!.nOutcomes, "authored outcome table has 3-5 rows").toBeGreaterThanOrEqual(3)
  expect(m!.nOutcomes, "authored outcome table has 3-5 rows").toBeLessThanOrEqual(5)

  // THE DRAW IS PURE: same node, same dice, same heat → the SAME authored object twice
  expect(m!.sameObject, "identical rigged hot draws chose the identical outcome object").toBe(true)
  expect(m!.authoredIdx, "the chosen outcome IS an authored array member, not a copy").toBeGreaterThanOrEqual(0)
  expect(m!.result1, "the draw returned a schema result type").toMatch(/^(success|failure|counter)$/)
  expect(m!.result2, "second draw agrees on the result type").toBe(m!.result1)

  // THE INVARIANT: two fully-hot draws mutated nothing
  expect(m!.jsonEqual, "cal.outcomes deep-equal to its pre-draw snapshot").toBe(true)
  expect(m!.sameArrayRef, "same outcomes array reference — never replaced").toBe(true)
  expect(m!.sameLength && m!.everyObjRefKept, "every outcome object's identity preserved, in order").toBe(true)
  expect(m!.probsUnchanged, "authored probabilities unchanged after hot draws").toBe(true)

  // beat contract: skew live + non-success chosen → outcome_skewed once per draw. Conditional
  // on the drawn result so a reordered outcome table flips the expectation, not the spec.
  expect(m!.skewedDelta, "outcome_skewed fired exactly once per non-success hot draw").toBe(
    m!.result1 !== "success" ? 2 : 0,
  )
})
