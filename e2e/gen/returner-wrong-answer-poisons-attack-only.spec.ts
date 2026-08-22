/* @hyperspace {"theme":"momentum-and-economy","L":"lapsed-returner","F":"defense-panic","B":"economy-math"} @invariant "_qMod is an attack-side penalty only: after a wrong landing answer sets _qMod=-0.04, every option's moveChance drops by exactly 4 points while escapeChance for a live defense is computed without _qMod (identical before/after the penalty)." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { lapsedReturner } from "./personas"

/**
 * THE WRONG-ANSWER PENALTY NEVER LEAKS INTO DEFENSE — _qMod (the −0.04 non-trap /
 * −0.08 trap hit from a wrong landing answer, app.src.jsx:4311) is folded into
 * moveChance (:4946, `+ (this._qMod || 0)`) and NOWHERE else: escapeChance (:4416) is
 * 0.4 + (myVal(opt.node) − myVal(sub))·0.15 + dmod − aiSkill + momentumMod() and never
 * reads it. A botched read costs you on the attempt; it must not make you defend worse
 * once you are caught.
 *
 * Persona seam: lapsedReturner (= whiteBeltHolder) carries rec=3 per white deck but an
 * EMPTY stage:{} map, so questionFor's cardStage<2 gate still finds an unproven card —
 * a returning belt-holder is not exempt from the landing question.
 *
 * AUTHOR-TIME FACT (code-verified, first-run-confirmed): the failure path NEVER passes
 * through enterLand — enterFail/enterFailCal go impact_fail → opponentDefend() →
 * enterDefense with no arrival in between (:5098-5141); enterLand's "a new arrival
 * forgives" reset (:4799) fires only after a SUCCESSFUL move lands somewhere. So the
 * organic −0.04 is STILL LIVE in the caught state (asserted), and the defense half is
 * a real end-to-end fact, not a synthetic one. The measurement still A/Bs by forcing
 * _qMod 0 vs −0.04 around escapeChance in ONE evaluate (save/restore) so the invariant
 * is pinned as arithmetic, with a differential control in the SAME evaluate: the
 * identical forcing moves a mid-band technique's moveChance by exactly 0.04, proving
 * the forcing is live exactly where it is supposed to bite.
 *
 * Confound census: fresh-roll _combo is 0 and the wrong answer only _breakCombo()s it
 * (0 → 0), so momentumMod() is 0 through every measurement (asserted); a wrong answer
 * mints no prep/stage credit, so stateBonus is identical across the before/after pair —
 * the ONLY moving part is _qMod. Exact-0.04 arithmetic is asserted on RAW moveChance
 * floats (toBeCloseTo precision 10), never displayedOdds (Math.round is off-by-one at
 * .5 boundaries), and only for options clear of the [0.05, 0.95] clamps.
 *
 * Determinism census: land() rigs ai-skill/role/max-moves; the landing MC draws on its
 * own surface-scoped land-mc-pick/land-mc-shuffle tags and the answer is READ from the
 * _mc truth closure (never guessed), so no MC queue needs pre-sizing; resolve 0.99 >
 * the 0.95 moveChance ceiling (our move always fails), outcome 0.99 draws a
 * non-success, opp-finish 0.01 < the pFinish floor (the opponent always hunts the
 * sub), opp-sub-pick 0.01 pins which one. All 1-deep — the journey ends inside the
 * defense window, evaluate-only from there (no sim time passes, so the 4-9s defense
 * clock never moves under the measurement).
 */

test("wrong landing answer drops every clear option's moveChance by exactly 0.04; forced _qMod leaves a live escapeChance strictly untouched", async ({ page }) => {
  const j = journey(page)
  await j.boot("/", { initialState: lapsedReturner() })
  await j.land("Mount Top")

  // the landing asks despite the returner's rec history (stage map is empty → unproven)
  await expect(page.locator("[data-land-q]"), "landing question asked on arrival").toBeVisible()
  await j.expectBeat("land_q_shown")

  // ── baseline: RAW moveChance per option, plus the confound guards ──
  const before = await page.evaluate(() => {
    const a = (window as any).__neural
    const opts = (a.optionIdxs || []).map((o: any) => {
      const idx = typeof o === "number" ? o : o.idx
      return { idx, c: a.moveChance(a.nodes[idx]) }
    })
    return { opts, qMod: a._qMod || 0, momentum: a.momentumMod() }
  })
  expect(before.opts.length, "a hand of options was dealt").toBeGreaterThan(0)
  expect(before.qMod, "no penalty before the answer").toBe(0)
  expect(before.momentum, "fresh roll: momentum cold before the answer").toBe(0)

  // ── answer WRONG with a non-trap option (a trap costs 0.08, not the invariant's 0.04) ──
  const pickIdx = await page.evaluate(() => {
    const m = (window as any).__neural._mc
    if (!m || m.surface !== "land") return -1
    for (let i = 0; i < m.n; i++) if (i !== m.correct && m.tiers[i] !== "trap") return i
    return -1
  })
  expect(pickIdx, "a wrong non-trap option exists in the landing MC").toBeGreaterThanOrEqual(0)
  await page.locator(`[data-land-mc-opt="${pickIdx}"]`).click()

  const answered = (await j.beats()).filter((b: any) => b.beat === "land_q_answered")
  expect(answered.length, "exactly one landing answer").toBe(1)
  expect((answered[0] as any).correct, "and it was wrong").toBe(false)
  expect((answered[0] as any).tier, "non-trap tier taken").not.toBe("trap")
  expect((answered[0] as any).qMod, "beat carries the −0.04 penalty").toBeCloseTo(-0.04, 10)

  // ── after: the SAME hand, every clamp-clear option down by exactly 0.04 ──
  const after = await page.evaluate(() => {
    const a = (window as any).__neural
    const opts = (a.optionIdxs || []).map((o: any) => {
      const idx = typeof o === "number" ? o : o.idx
      return { idx, c: a.moveChance(a.nodes[idx]) }
    })
    return { opts, qMod: a._qMod || 0, momentum: a.momentumMod() }
  })
  expect(after.qMod, "_qMod is exactly −0.04").toBeCloseTo(-0.04, 10)
  expect(after.momentum, "breaking a cold combo leaves momentum 0 — no confound").toBe(0)
  expect(after.opts.map((o: any) => o.idx), "same hand, same order").toEqual(before.opts.map((o: any) => o.idx))

  let clear = 0
  for (let i = 0; i < before.opts.length; i++) {
    const b = before.opts[i].c
    // clamp-clear: unclamped before (b < 0.95) AND the −0.04 still lands above the 0.05 floor
    if (b < 0.95 - 1e-9 && b - 0.04 > 0.05 + 1e-9) {
      clear++
      expect(after.opts[i].c, `option idx=${before.opts[i].idx} down by exactly 0.04`).toBeCloseTo(b - 0.04, 10)
    }
  }
  expect(clear, "at least one clamp-clear option carried the exact arithmetic").toBeGreaterThan(0)

  // a mid-band pick for the catch leg — clear of BOTH clamps so nothing saturates en route
  const midTitle = await page.evaluate(() => {
    const a = (window as any).__neural
    for (const o of a.optionIdxs || []) {
      const n = a.nodes[typeof o === "number" ? o : o.idx]
      const c = a.moveChance(n)
      if (c >= 0.15 && c <= 0.8) return n.t
    }
    return ""
  })
  expect(midTitle, "a mid-band option exists to carry into the catch").not.toBe("")

  // ── get CAUGHT deterministically: our move fails, the opponent goes for the finish ──
  await j.rig("resolve", [0.99])
  await j.rig("outcome", [0.99])
  await j.rig("opp-finish", [0.01])
  await j.rig("opp-sub-pick", [0.01])
  await j.pick(midTitle)
  await j.advanceUntil("caught", 25000)

  await expect(page.locator("[data-panic]"), "panic surface up while caught").toBeVisible()

  // ── the core measurement: ONE evaluate, save/restore, differential control ──
  const m = await page.evaluate(() => {
    const a = (window as any).__neural
    if (a._defendSub == null || !a._optList || !a._optList.length) return null
    const opt = a._optList[0]
    const found = a._qMod || 0
    // control target: a mid-band technique node whose moveChance CAN feel the forcing
    let tech: any = null
    for (const n of a.nodes) {
      if (n.ty !== "transitions" && n.ty !== "submissions") continue
      const c = a.moveChance(n)
      if (c >= 0.15 && c <= 0.8) { tech = n; break }
    }
    a._qMod = 0
    const escClean = a.escapeChance(opt)
    const mvClean = tech ? a.moveChance(tech) : null
    a._qMod = -0.04
    const escPoisoned = a.escapeChance(opt)
    const mvPoisoned = tech ? a.moveChance(tech) : null
    a._qMod = found // leave the app exactly as the catch left it
    return { found, escClean, escPoisoned, mvClean, mvPoisoned, momentum: a.momentumMod(), hasTech: !!tech }
  })
  expect(m, "live defense: _defendSub set and escapes dealt").not.toBeNull()

  // the failure path has NO arrival, so enterLand's forgiveness never ran: the organic
  // wrong-answer penalty is genuinely live while caught — the invariant is tested for real
  expect(m!.found, "the organic −0.04 survived into the caught state (no enterLand on the fail path)").toBeCloseTo(-0.04, 10)
  expect(m!.momentum, "momentum still cold at the catch — no confound").toBe(0)

  // THE INVARIANT: escapeChance is computed WITHOUT _qMod — identical with the penalty
  // live (−0.04, the found organic state) vs scrubbed (0)
  expect(m!.escPoisoned, "escapeChance identical with _qMod −0.04 vs 0").toBe(m!.escClean)

  // differential control from the SAME evaluate: the identical forcing IS live — it moves
  // a mid-band technique's moveChance by exactly the 0.04 it never moved the escape by
  expect(m!.hasTech, "a mid-band technique existed for the control").toBe(true)
  expect(m!.mvClean! - m!.mvPoisoned!, "the same forcing shifts moveChance by exactly 0.04").toBeCloseTo(0.04, 10)
})
