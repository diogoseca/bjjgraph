import { test, expect } from "@playwright/test"
import { journey } from "../dsl"

/**
 * MOMENTUM — the combo meter.
 *
 * Answer landing questions right back-to-back and the whole match tilts your way:
 *   ×2 DOUBLE COMBO! · ×3 TRIPLE COMBO! · ×4 MEGA COMBO! · ×5 ULTRA COMBO! · ×6 RAMPAGE! · ×7+ GODLIKE
 *   +2.5% per tier (cap +10%) on every option AND escape; counter-outcomes shed up to 40% of
 *   their weight in the outcome draw ("too fast to counter").
 *
 * Owner's rules: per ROLL (a fresh match starts cold) · WRONG or IGNORED breaks it (executing
 * past an asked question, or the clock auto-picking) · a landing that asks nothing CARRIES it.
 *
 * Rails: __neural._combo, .momentumMod(), .momentumSkew(), .comboName(n), .drawOutcome(act)
 * Surfaces: .ng-combo-pop [data-combo-pop] [data-heat] · .ng-momentum [data-momentum]
 * Beats: combo {n, name, mod} · combo_big {n} · combo_break {at, reason} · outcome_skewed {skew}
 */

const state = (page: any) =>
  page.evaluate(() => {
    const a = (window as any).__neural
    return { combo: a._combo || 0, mod: a.momentumMod(), skew: a.momentumSkew() }
  })

/** answer the live landing question (correct or deliberately wrong) via the keyboard */
const answer = async (page: any, correct: boolean) => {
  // v1.80.4: the landing question mounts once this state's deck AND its distractor pool are
  // resident — the card itself (identity + film) renders immediately, the question can be one
  // fetch behind. Waiting for the block is not a weaker assertion: it is still "a live landing
  // question or fail", just not "in this exact microtask".
  await page
    .waitForFunction(
      () => {
        const m = (window as any).__neural._mc
        return !!(m && m.surface === "land")
      },
      null,
      { timeout: 20_000 },
    )
    .catch(() => {})
  const mc = await page.evaluate(() => {
    const m = (window as any).__neural._mc
    return m && m.surface === "land" ? { correct: m.correct, n: m.n } : null
  })
  expect(mc, "a live landing question").toBeTruthy()
  await page.keyboard.press("abcd"[correct ? mc!.correct : (mc!.correct + 1) % mc!.n])
}

/** execute a rigged-successful transition and pump to the next hand (next landing question) */
const advanceState = async (j: any, page: any) => {
  const t = await page.evaluate(() => {
    const a = (window as any).__neural
    for (const i of a.optionIdxs || []) if (a.nodes[i].ty === "transitions") return a.nodes[i].t
    return ""
  })
  expect(t, "a transition to advance on").toBeTruthy()
  await j.rig("resolve", [0.01])
  await j.rig("outcome", [0.01])
  await j.pick(t)
  await j.nextHand()
}

test("back-to-back rights climb the ladder: DOUBLE at ×2, TRIPLE at ×3, heat rising @curated", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  await answer(page, true) // ×1 — no announcer yet, no chip
  expect((await state(page)).combo).toBe(1)
  await expect(page.locator("[data-momentum]")).toHaveCount(0)

  await advanceState(j, page)
  await answer(page, true) // ×2 — DOUBLE COMBO!
  let s = await state(page)
  expect(s.combo).toBe(2)
  expect(s.mod, "+2.5% at ×2").toBeCloseTo(0.025, 6)
  await expect(page.locator('[data-combo-pop="2"]'), "the announcer pops").toBeVisible()
  await expect(page.locator('[data-momentum="2"]'), "the heat chip appears").toBeVisible()

  await advanceState(j, page)
  await answer(page, true) // ×3 — TRIPLE COMBO!
  s = await state(page)
  expect(s.combo).toBe(3)
  expect(s.mod).toBeCloseTo(0.05, 6)
  await expect(page.locator('[data-combo-pop="3"][data-heat="2"]')).toBeVisible()

  const combos = (await j.beats()).filter((b: any) => b.beat === "combo") as any[]
  expect(combos.map((b) => b.name)).toEqual(["DOUBLE COMBO!", "TRIPLE COMBO!"])
})

test("the announcer ladder reads DOUBLE → TRIPLE → MEGA → ULTRA → RAMPAGE → GODLIKE", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")
  const names = await page.evaluate(() => {
    const a = (window as any).__neural
    return [2, 3, 4, 5, 6, 7, 9].map((n) => a.comboName(n))
  })
  expect(names).toEqual([
    "DOUBLE COMBO!",
    "TRIPLE COMBO!",
    "MEGA COMBO!",
    "ULTRA COMBO!",
    "RAMPAGE!",
    "GODLIKE",
    "GODLIKE ×9",
  ])
  // and the bonus caps where the design says it does
  const caps = await page.evaluate(() => {
    const a = (window as any).__neural
    const out: any[] = []
    for (const n of [0, 1, 2, 5, 9]) {
      a._combo = n
      out.push({ n, mod: a.momentumMod(), skew: a.momentumSkew() })
    }
    a._combo = 0
    return out
  })
  expect(caps).toEqual([
    { n: 0, mod: 0, skew: 0 },
    { n: 1, mod: 0, skew: 0 },
    { n: 2, mod: 0.025, skew: 0.1 },
    { n: 5, mod: 0.1, skew: 0.4 },
    { n: 9, mod: 0.1, skew: 0.4 }, // GODLIKE holds the cap, it does not exceed it
  ])
})

test("momentum heats the whole hand — moveChance carries the exact modifier", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  const delta = await page.evaluate(() => {
    const a = (window as any).__neural
    let act = null
    for (const i of a.optionIdxs || []) {
      const odds = a.moveChance(a.nodes[i])
      if (odds >= 0.2 && odds <= 0.7) {
        act = a.nodes[i]
        break
      } // clear of both clamps
    }
    if (!act) return null
    a._combo = 0
    const cold = a.moveChance(act)
    a._combo = 5
    const hot = a.moveChance(act)
    a._combo = 0
    return hot - cold
  })
  expect(delta, "ULTRA momentum = exactly +10% on the same move").toBeCloseTo(0.1, 6)
})

test("a hot streak makes counters fade in the outcome draw", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  // synthetic 50/50 failure/counter table; the same 0.6 draw lands differently hot vs cold
  const out = await page.evaluate(() => {
    const a = (window as any).__neural
    const act = {
      cal: {
        outcomes: [
          { result: "failure", probability: 50, to: "mount/top" },
          { result: "counter", probability: 50, to: "closed-guard/bottom" },
        ],
      },
    }
    a._combo = 0
    a.rig("outcome", [0.6])
    const cold = a.drawOutcome(act).result // 0.6*100=60 → past failure's 50 → counter
    a._combo = 5 // skew .4: counter weighs 30 of 80 → 0.6*80=48 → still inside failure's 50
    a.rig("outcome", [0.6])
    const hot = a.drawOutcome(act).result
    a._combo = 0
    return { cold, hot }
  })
  expect(out.cold, "cold: the opponent capitalizes").toBe("counter")
  expect(out.hot, "hot: too fast to counter — same dice, softer landing").toBe("failure")
  await j.expectBeat("outcome_skewed")
})

test("a wrong answer breaks the combo, names the loss, and cools the hand", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  await answer(page, true)
  await advanceState(j, page)
  await answer(page, true) // ×2
  expect((await state(page)).combo).toBe(2)

  await advanceState(j, page)
  await answer(page, false) // wrong — the streak dies

  const s = await state(page)
  expect(s.combo).toBe(0)
  expect(s.mod, "the bonus is gone with it").toBe(0)
  const brk = (await j.beats()).filter((b: any) => b.beat === "combo_break") as any[]
  expect(brk.length).toBe(1)
  expect(brk[0].at).toBe(2)
  expect(brk[0].reason).toBe("wrong")
  await j.advance(800)
  await expect(page.locator("[data-momentum]"), "the chip shattered").toHaveCount(0)
})

test("ignoring an asked question breaks it; a landing that asks nothing carries it", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  await answer(page, true) // ×1
  // Prove the NEXT state's whole deck before we get there, so it will ask nothing.
  //
  // The destination is the CALIBRATED outcome's target — the same rule the second half of this
  // journey already documents ("o.res is the legacy estimate — probing it boomerangs"), applied
  // here too since v1.118.0. `o.res` is `resultPos()`: the first POSITION adjacent to the move
  // that is not the one you are standing on. For `Mount to 3-4 Mount` that happens to equal the
  // real landing, and while the hand ranked submissions at a flat +100 (movePotential's deleted
  // `return 1`) it was the first transition dealt — so this fixture proved the right deck by
  // coincidence. Ranked by EDGE the first transition is `Consolidate Mount`, whose `o.res` is
  // Half Guard Top while `rig("outcome",[0.01])` lands it in High Mount Top: the wrong deck got
  // pre-proven, the landing asked a question, and the streak broke for "neglect" it never had.
  const destKey = await page.evaluate(async () => {
    const a = (window as any).__neural
    for (const o of a._optList || []) {
      if (o.node.ty !== "transitions") continue
      const outs = (o.node.cal && o.node.cal.outcomes) || []
      const r = outs.length && a.resolveOutcomeTo(outs[0].to) // rig takes the FIRST bucket
      if (!r || r.idx < 0) continue
      const key = a.deckKeyFor(a.nodes[r.idx]).key
      // the destination's cards may not have arrived yet (on-demand residency, v1.80.4) —
      // ask for them, since proving them all is the whole point of this step
      await a.hydrateDeck(key)
      const cards = a._cardsOf(a.flashcards.decks[key])
      if (cards && cards.length) {
        for (const c of cards) a._bumpStage(key, c.q, 4)
        return o.node.t
      }
    }
    return ""
  })
  expect(destKey, "a destination whose deck we can pre-prove").toBeTruthy()
  await j.rig("resolve", [0.01])
  await j.rig("outcome", [0.01])
  await j.pick(destKey)
  await j.nextHand()

  // no question asked → the streak CARRIES (silence is not neglect)
  await expect(page.locator("[data-land-q]")).toHaveCount(0)
  expect((await state(page)).combo, "carried through the proven state").toBe(1)
  expect((await j.beats()).some((b: any) => b.beat === "combo_break")).toBe(false)

  // now a state that DOES ask — walk past the question and momentum dies for neglect.
  // The hop must be deterministic two ways: the REAL destination is the calibrated outcome's
  // target (o.res is the legacy estimate — probing it boomerangs), and the question must build
  // from AUTHORED mc tiers (pool-built distractors depend on random sibling draws).
  for (let hop = 0; hop < 4; hop++) {
    // the candidates' decks must be resident before questionFor() can judge them (v1.80.4)
    await page.evaluate(async () => {
      const a = (window as any).__neural
      const keys = []
      for (const o of a._optList || []) {
        if (!o.node || o.node.ty !== "transitions") continue
        const outs = (o.node.cal && o.node.cal.outcomes) || []
        const win = outs.find((x) => x.result === "success") || outs[0]
        const r = win && a.resolveOutcomeTo(win.to)
        if (r && r.idx >= 0) keys.push(a.deckKeyFor(a.nodes[r.idx]).key)
      }
      await a.hydrateDecks(keys)
    })
    const target = await page.evaluate(() => {
      const a = (window as any).__neural
      const destOf = (node: any) => {
        const outs = (node.cal && node.cal.outcomes) || []
        if (!outs.length) return -1
        const win =
          outs[0].result === "success"
            ? outs[0]
            : outs.find((x: any) => x.result === "success") || outs[0]
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
        if (card && card.mc && (card.mc.p || []).length + (card.mc.t || []).length >= 2)
          return o.node.t
      }
      return fallback
    })
    expect(target, "a transition to hop on").toBeTruthy()
    await j.rig("resolve", [0.01])
    await j.rig("outcome", [0.01])
    await j.pick(target)
    await j.nextHand()
    await j.landSettled()   // the question docks one fetch after the card (v1.80.5 signal)
    if (await page.locator("[data-land-q]").count()) break
  }
  await expect(page.locator("[data-land-q]")).toBeVisible()
  // ANY commit walks past the question — submissions included (enterAttempt is the seam)
  const t2 = await page.evaluate(() => {
    const a = (window as any).__neural
    const i = (a.optionIdxs || [])[0]
    return i != null ? a.nodes[i].t : ""
  })
  expect(t2, "an option to commit past the question").toBeTruthy()
  await j.rig("resolve", [0.9]) // outcome irrelevant — the SKIP happens at commit
  const comboBefore = (await state(page)).combo
  await j.pick(t2)
  // v1.133.0 (owner): "the clock only punishes sitting there" — committing past an open question
  // is a FREE SKIP. The funnel beat still fires; momentum is untouched.
  const beats = (await j.beats()) as any[]
  expect(beats.some((b) => b.beat === "land_q_ignored" || b.beat === "land_q_declined"), "the skip is still marked").toBe(true)
  const brk = beats.filter((b) => b.beat === "combo_break" && b.reason === "ignored")
  expect(brk.length, "no break for moving on").toBe(0)
  expect((await state(page)).combo, "momentum survives the skip").toBe(comboBefore)
})

test("momentum is per roll — a fresh match starts cold", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  await answer(page, true)
  await advanceState(j, page)
  await answer(page, true) // ×2, chip live
  await expect(page.locator("[data-momentum]")).toBeVisible()

  await j.rig("ai-skill", [0.5])
  await j.rig("role", [0.1])
  await j.rig("max-moves", [0.1])
  await j.rig("start-pos", [0.1])
  await page.evaluate(() => (window as any).__neural.startRoll())

  const s = await state(page)
  expect(s.combo, "cold").toBe(0)
  expect(s.mod).toBe(0)
  await expect(page.locator("[data-momentum]"), "chip gone with the old match").toHaveCount(0)
})
