/* @hyperspace {"theme":"momentum-and-economy","L":"lapsed-returner","F":"boot-landing","B":"economy-math"} @invariant "The landing wrong-answer penalty is tiered exactly 2:1 — a plausible miss sets _qMod to -0.04 and a trap miss to -0.08 (land_q_answered carries the truthful tier and qMod), each dropping a mid-band option's displayed odds by exactly 4 vs 8 points on that exchange." */
import { test, expect, type Page } from "@playwright/test"
import { journey, type Journey } from "../dsl"
import { lapsedReturner } from "./personas"

/**
 * THE WRONG-ANSWER LADDER IS EXACTLY 2:1 — a landing miss is not one price but two
 * (app.src.jsx, line-verified): `const cost = tier === "trap" ? 0.08 : 0.04` (:4310)
 * writes _qMod (:4311), land_q_answered carries the truthful {correct, tier, qMod}
 * (:4319), enterLand forgives on the next arrival (:4799), and moveChance folds
 * `+ (this._qMod || 0)` into every option (:4946). A "close but wrong" plausible read
 * costs 4 points on the exchange; the trap — the answer that gets you HURT in a real
 * roll — costs exactly double. This spec pins both rungs and their 2:1 ratio from the
 * beat stream itself.
 *
 * TIER FILTER IS THE POINT: a generic pool distractor also costs 0.04 but its beat
 * tier is "wrong" (btier collapse, :3658) — the 2:1 claim is specifically
 * plausible-vs-trap, so both picks are made by `_mc.tiers.indexOf("plausible"|"trap")`
 * on the LIVE closure truth (surface "land"), never "any wrong letter" and never the
 * DOM. tiers[correct] === "correct", so a found index can never collide with the right
 * answer. Authored card.mc.p/t presence is only a lookahead HEURISTIC (mcDistractors'
 * length-ratio/similarity filters can drop authored distractors, :3534-3536), so the
 * seek loop is: check live tiers on arrival → if absent, one deterministic hop
 * (momentum.spec recipe: calibrated destination via resolveOutcomeTo on the first
 * success outcome, resolve/outcome rigged 0.01, pick, nextHand) → re-check. Probe
 * (2× green, 5.2s/3.1s, since deleted) never neared the 8-hop cap.
 *
 * Persona seam: lapsedReturner (= whiteBeltHolder) carries prep/rec for every white
 * deck but an EMPTY stage:{} map, so questionFor's cardStage<2 gate (:4189) still
 * finds an unproven card — every landing on the comeback route asks.
 *
 * Confound census: no answer in this journey is ever correct, so _combo stays 0 and
 * momentumMod() is 0 at every measurement (asserted); _breakCombo at 0 is a no-op
 * (:4348) so no combo machinery moves the odds. The trap's extra stage demotion
 * (_bumpStage(key, card.q, -1), :3662) cannot contaminate the delta: stateBonus =
 * mastery(prep) + sharpness(_sharp) (:817-819) and neither reads the stage map. The
 * exact-integer displayed drop (toBe 4 / toBe 8) is safe in the 20-70 band — subtracting
 * 0.04/0.08 moves Math.round(x*100) by exactly 4/8 clear of the 0.05/0.95 clamps — and
 * the raw moveChance delta is additionally pinned at 6 digits. _qMod===0 is asserted on
 * every fresh arrival (forgiveness, :4799), so each rung is measured from a clean slate.
 *
 * Determinism census: land() rigs ai-skill/role/max-moves; the landing MC draws on its
 * own surface-scoped land-mc-pick/land-mc-shuffle tags (never the sidebar's mc-* queues)
 * and both answer indices are READ from the _mc truth closure, so no MC queue needs
 * pre-sizing. Every hop rigs resolve [0.01] (< the 0.05 moveChance floor → always
 * succeeds) + outcome [0.01] (first cell) — 1-deep, sized to the single draw each leg
 * makes. No wall-clock waits: nextHand pumps sim time.
 *
 * Distinctness: returner-wrong-answer-poisons-attack-only pins the non-trap 0.04's
 * attack-only scope (escapeChance never reads _qMod); mid-timeout-question-costs-no-odds
 * pins the ignored path charging nothing. NEITHER ever pays the trap price — this spec
 * is the only one that measures BOTH rungs and asserts the ladder's exact 2:1 ratio.
 */

/** index of the wanted wrong tier in the LIVE landing MC block, or -1 (closure truth only) */
const liveTierIdx = (page: Page, tier: string) =>
  page.evaluate((t) => {
    const m = (window as any).__neural._mc
    return m && m.surface === "land" && Array.isArray(m.tiers) ? m.tiers.indexOf(t) : -1
  }, tier)

/** one deterministic hop toward a landing likely to author the needed tier (field "p"|"t");
 *  destination = the calibrated success outcome's target (o.res is the legacy estimate) */
const hop = async (j: Journey, page: Page, field: "p" | "t") => {
  const target = await page.evaluate((f) => {
    const a = (window as any).__neural
    const destOf = (node: any) => {
      const outs = (node.cal && node.cal.outcomes) || []
      if (!outs.length) return -1
      const win = outs[0].result === "success" ? outs[0] : outs.find((x: any) => x.result === "success") || outs[0]
      const r = a.resolveOutcomeTo(win.to)
      return r && r.idx >= 0 ? r.idx : -1
    }
    let fallback = ""
    for (const o of a._optList || []) {
      if (!o.node || o.node.ty !== "transitions") continue
      if (!fallback) fallback = o.node.t
      const di = destOf(o.node)
      if (di < 0 || di === a.currentPos) continue
      const key = a.deckKeyFor(a.nodes[di]).key
      const card = a.questionFor(key)
      if (card && card.mc && ((card.mc as any)[f] || []).length >= 1) return o.node.t
    }
    return fallback
  }, field)
  expect(target, "a transition to hop on").toBeTruthy()
  await j.rig("resolve", [0.01])
  await j.rig("outcome", [0.01])
  await j.pick(target)
  await j.nextHand()
  // arrival forgives (:4799) — every rung is measured from a clean exchange
  expect(
    await page.evaluate(() => (window as any).__neural._qMod || 0),
    "fresh arrival: _qMod reset to 0",
  ).toBe(0)
}

/** walk until a landing's LIVE MC offers the tier; skipCurrent when this landing's question
 *  was already consumed. The probe never neared the 8-hop cap. */
const seek = async (j: Journey, page: Page, tier: "plausible" | "trap", skipCurrent: boolean) => {
  const field = tier === "trap" ? "t" : "p"
  if (!skipCurrent) {
    const i = await liveTierIdx(page, tier)
    if (i >= 0) return i
  }
  for (let h = 0; h < 8; h++) {
    await hop(j, page, field)
    const i = await liveTierIdx(page, tier)
    if (i >= 0) return i
  }
  throw new Error(`no landing offered a live "${tier}" distractor within 8 hops`)
}

/** the full option hand by node idx: raw moveChance + the displayed integer the tray shows */
const readHand = (page: Page) =>
  page.evaluate(() => {
    const a = (window as any).__neural
    const opts = (a.optionIdxs || []).map((o: any) => {
      const idx = typeof o === "number" ? o : o.idx
      const raw = a.moveChance(a.nodes[idx])
      return { idx, raw, disp: Math.round(raw * 100) }
    })
    return { opts, qMod: a._qMod || 0, momentum: a.momentumMod(), pending: !!a._landPending }
  })

/** miss the question at tier index `pick`, assert the exact cost on state, beat, and odds;
 *  returns the beat's qMod so the caller can pin the 2:1 ratio across both rungs */
const miss = async (j: Journey, page: Page, tier: "plausible" | "trap", pick: number, cost: number) => {
  await expect(page.locator("[data-land-q]"), `a landing question is up for the ${tier} rung`).toBeVisible()
  const before = await readHand(page)
  expect(before.pending, "the question is pending").toBe(true)
  expect(before.qMod, "clean exchange before the miss").toBe(0)
  expect(before.momentum, "momentum cold (nothing was ever answered right) — no confound").toBe(0)
  const mid = before.opts.find((o: any) => o.disp >= 20 && o.disp <= 70)
  expect(mid, "a mid-band option (20-70 displayed) to carry the exact integer delta").toBeTruthy()
  const answered0 = ((await j.beats()) as any[]).filter((b) => b.beat === "land_q_answered").length

  await page.keyboard.press("abcd"[pick])

  // the beat carries the truthful tier + qMod (:4319)
  const answered = ((await j.beats()) as any[]).filter((b) => b.beat === "land_q_answered")
  expect(answered.length, "exactly one new land_q_answered").toBe(answered0 + 1)
  const beat = answered[answered.length - 1]
  expect(beat.correct, "the miss is a wrong answer").toBe(false)
  expect(beat.tier, `and the beat names the ${tier} tier — never the pool's "wrong"`).toBe(tier)
  expect(beat.qMod, `beat qMod is exactly -${cost}`).toBeCloseTo(-cost, 10)

  const after = await readHand(page)
  expect(after.qMod, `_qMod is exactly -${cost}`).toBeCloseTo(-cost, 10)
  expect(after.momentum, "breaking a cold combo leaves momentum 0 — still no confound").toBe(0)
  expect(
    after.opts.map((o: any) => o.idx),
    "same hand, same order — the penalty repriced, it did not redeal",
  ).toEqual(before.opts.map((o: any) => o.idx))
  const midAfter = after.opts.find((o: any) => o.idx === mid!.idx)!
  expect(midAfter.disp, `the mid-band option's displayed odds drop by exactly ${cost * 100} points`).toBe(
    mid!.disp - cost * 100,
  )
  expect(mid!.raw - midAfter.raw, `raw moveChance delta is exactly ${cost}`).toBeCloseTo(cost, 6)
  return beat.qMod as number
}

test("plausible miss costs -0.04 and a trap miss -0.08 — both rungs measured live, the ladder exactly 2:1", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))

  const j = journey(page)
  // lapsedReturner's stage map is EMPTY despite full prep/rec — every deck still asks
  await j.boot("/", { initialState: lapsedReturner() })
  await j.land("Mount Top")
  await j.expectBeat("land")
  await j.expectBeat("options_dealt")

  // ── rung 1: a PLAUSIBLE miss at a clean landing costs exactly 0.04 ──
  const iPlausible = await seek(j, page, "plausible", false)
  const qPlausible = await miss(j, page, "plausible", iPlausible, 0.04)

  // ── rung 2: hop on (arrival forgives — asserted inside hop), then a TRAP miss at a
  //    fresh landing costs exactly 0.08 ──
  const iTrap = await seek(j, page, "trap", true)
  const qTrap = await miss(j, page, "trap", iTrap, 0.08)

  // ── THE LADDER: the trap's charge is exactly double the plausible's, read from the
  //    two truthful beats — 2:1 by arithmetic, not by two disconnected constants ──
  expect(qTrap, "trap qMod = 2 x plausible qMod, exactly").toBeCloseTo(2 * qPlausible, 10)
  expect(qPlausible, "plausible rung anchored").toBeCloseTo(-0.04, 10)
  expect(qTrap, "trap rung anchored").toBeCloseTo(-0.08, 10)

  // both misses on a cold streak: the wrong-branch _breakCombo is a no-op at 0 (:4348)
  const breaks = ((await j.beats()) as any[]).filter((b) => b.beat === "combo_break" && b.reason === "wrong")
  expect(breaks.length, "no 'wrong' combo_break — the streak was never alive to break").toBe(0)

  expect(errors, "no pageerror across boot, both rungs, and every hop").toEqual([])
})
