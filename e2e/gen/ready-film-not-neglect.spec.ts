/* @hyperspace {"theme":"momentum-and-economy","L":"belt-ready","F":"film-study","B":"interruption-abort"} @invariant "Watching the landing film is an interruption that neither answers nor neglects: with a question pending, watchShort fires film_first_look (+4 on that technique) while _landPending stays true, the question stays live, _combo survives untouched, and answering right afterwards still climbs the streak." */
import { test, expect, type Page } from "@playwright/test"
import { journey, type Journey } from "../dsl"
import { beltReady } from "./personas"

/**
 * FILM MID-QUESTION IS NEUTRAL TO MOMENTUM — a belt-ready player pauses to watch film with a
 * landing question on the table, then answers it. The watch is a genuine interruption: it must
 * neither ANSWER the question (no combo climb, no land_q_answered) nor NEGLECT it (no
 * combo_break "ignored", _landPending stays armed) — the film ledger pays its +4 while the
 * momentum ledger doesn't move a bit, and the streak resumes exactly where it left off.
 *
 * Source seams (verified against neural/src/app.src.jsx):
 *   - _landPending is SET in renderLandCard when a question mounts (:4285) and CLEARED only in
 *     _landAnswered (:4303), _breakCombo (:4347) and the roll boundaries — watchShort
 *     (:4642-4664) touches ONLY _filmLook + fx("film_first_look") + _pumpOdds, so the pending
 *     flag, _landQ and _mc are unreachable from the film path.
 *   - opening the expand sheet does NOT clear the landing card: clearLandCard() is called only
 *     from clearOptions (:3998) and renderLandCard (:4217), never from the sheet.
 *   - _mc.surface stays "land" with the sheet open: mcMode defaults "classic" (mcActive
 *     :3581-3586), so the sheet renders no competing MC block and the a-d keyboard still
 *     drives the landing question's truth (:3598 — "the keyboard drives the newest block").
 *   - the break seams this spec proves SILENT: enterAttempt (:4912, reason "ignored") is never
 *     reached (nothing commits during the watch) and _landAnswered's wrong branch (:4312,
 *     reason "wrong") never fires (both answers are rigged correct).
 *
 * Determinism (probe 2/2 green, ~4.2s): beltReady()'s stage map is EMPTY, so questionFor
 * (cardStage < 2, :4189-4193) asks on every deck. land()'s built-in rigs cover the ambient
 * draws; the landing MC draws on land-mc-pick/land-mc-shuffle, its own scoped queues. Each hop
 * rigs resolve/outcome [0.01] and targets the CALIBRATED success destination (cal.outcomes →
 * resolveOutcomeTo — o.res is the legacy estimate) whose deck has an AUTHORED-mc question
 * ((mc.p+mc.t) >= 2 — pool-built distractors depend on random sibling draws). The hop loop only
 * ever commits from an answered or silent landing, so it can never break the combo itself. After
 * arrival no sim time is pumped — the clock stays frozen through sheet, watch and answer. The
 * +4 target is a live-discovered mid-band option (>5, <=91: the delta lands whole, clear of the
 * 5/95 clamps; momentumMod at ×1 is 0 so nothing else moves the number).
 *
 * Distinctness: onboard-first-film-look pins the +4's IDEMPOTENCE, holder-film-look its
 * study-ledger DISJOINTNESS, veteran-film-look its CLAMP composition — none of them watch with
 * a question PENDING. This spec pins the film-vs-momentum seam mid-question: the one moment
 * where "interruption" could be misread as either an answer or a neglect.
 */

/** answer the live landing question via the keyboard (truth read from _mc, never the DOM) */
const answer = async (page: Page) => {
  const mc = await page.evaluate(() => {
    const m = (window as any).__neural._mc
    return m && m.surface === "land" ? { correct: m.correct, n: m.n } : null
  })
  expect(mc, "a live landing question (surface 'land')").toBeTruthy()
  await page.keyboard.press("abcd"[mc!.correct])
}

/** momentum + pending-question state, read in one evaluate */
const state = (page: Page) =>
  page.evaluate(() => {
    const a = (window as any).__neural
    return { combo: a._combo || 0, pending: !!a._landPending, mcSurface: a._mc ? a._mc.surface : null }
  })

const count = async (j: Journey, beat: string) => (await j.beats()).filter((b) => b.beat === beat).length

test("film with a question pending: +4 mints, _landPending holds, the question stays live, and the streak climbs to DOUBLE right after", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))

  const j = journey(page)
  // belt-ready: every white deck drilled (prep/rec seeded) but the STAGE map is empty — so
  // every landing still asks its question. The exact persona whose "I know this, let me just
  // check the film" pause this invariant protects.
  await j.boot("/", { initialState: beltReady() })
  await j.land("Mount Top")
  await j.expectBeat("land")
  await j.expectBeat("options_dealt")

  // ── ×1: answer the Mount Top landing question to put a live streak at stake ──
  await expect(page.locator("[data-land-q]"), "the landing asks").toBeVisible()
  await answer(page)
  expect((await state(page)).combo, "streak alive at ×1").toBe(1)
  expect(await count(j, "land_q_answered"), "one answer so far").toBe(1)

  // ── hop to a landing that ASKS, streak in hand. Deterministic two ways: the REAL destination
  //    is the calibrated success outcome's target (o.res is the legacy estimate), and the
  //    question must build from AUTHORED mc tiers. Only answered/silent landings ever commit
  //    here, so the loop itself can never break the combo. ──
  for (let hop = 0; hop < 4; hop++) {
    const target = await page.evaluate(() => {
      const a = (window as any).__neural
      const destOf = (node: any) => {
        const outs = (node.cal && node.cal.outcomes) || []
        if (!outs.length) return -1
        const win =
          outs[0].result === "success" ? outs[0] : outs.find((x: any) => x.result === "success") || outs[0]
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
        if (card && card.mc && (card.mc.p || []).length + (card.mc.t || []).length >= 2) return o.node.t
      }
      return fallback
    })
    expect(target, "a transition to hop on").toBeTruthy()
    await j.rig("resolve", [0.01])
    await j.rig("outcome", [0.01])
    await j.pick(target)
    await j.nextHand()
    if (await page.locator("[data-land-q]").count()) break
  }
  await expect(page.locator("[data-land-q]"), "arrived at a landing that asks").toBeVisible()
  let s = await state(page)
  expect(s.pending, "_landPending armed on arrival").toBe(true)
  expect(s.combo, "silent legs carried the streak — still ×1").toBe(1)
  expect(await count(j, "combo_break"), "no break getting here").toBe(0)
  expect(await count(j, "land_q_answered"), "still exactly one answer").toBe(1)

  // ── the interruption: open a mid-band technique's sheet and watch its film, question pending.
  //    Target discovered live, never hardcoded; YT stub goes in BEFORE the click (shorts
  //    auto-open is !isTest()-gated). Clicking a tray card BROWSES — enterAttempt never runs. ──
  const titles = await j.optionTitles()
  const oddsBefore: Record<string, number> = {}
  for (const t of titles) oddsBefore[t] = await j.displayedOdds(t)
  const target = titles.find((t) => oddsBefore[t] > 5 && oddsBefore[t] <= 91)
  expect(target, "a mid-band option (>5, <=91) — the +4 lands whole, clear of both clamps").toBeTruthy()
  await page.evaluate(() => {
    function StubPlayer(this: any) {
      this.destroy = () => {}
    }
    ;(window as any).YT = { Player: StubPlayer, PlayerState: { ENDED: 0 } }
  })
  const card = page.locator(`[data-tech="${target}"]`).first()
  await expect(card, `option card for "${target}" visible`).toBeVisible()
  await card.click()
  await expect(page.locator("[data-go]").first(), "expand sheet open").toBeVisible()
  expect(
    (await state(page)).mcSurface,
    "sheet renders no competing MC block (classic default) — the landing question still owns the keyboard",
  ).toBe("land")

  expect(
    await page.evaluate(() => (window as any).__neural.watchShort(0)),
    "watchShort(0) engages the stubbed player (test mode synthesizes clip + card)",
  ).toBe(true)

  // ── NEITHER ANSWERS: the film ledger paid, the question ledger didn't move ──
  const films = ((await j.beats()) as Array<{ beat: string; technique?: string }>).filter(
    (b) => b.beat === "film_first_look",
  )
  expect(films.length, "exactly one film_first_look").toBe(1)
  expect(films[0].technique, "the beat names the watched technique").toBe(target)
  expect((await j.displayedOdds(target!)) - oddsBefore[target!], "the first look mints exactly +4").toBe(4)
  expect(await count(j, "land_q_answered"), "the watch answered nothing — count stays 1").toBe(1)

  // ── NOR NEGLECTS: the question is still on the table, the streak untouched ──
  s = await state(page)
  expect(s.pending, "_landPending still true — the film walked past nothing").toBe(true)
  expect(s.combo, "_combo survives the interruption at ×1").toBe(1)
  await expect(page.locator("[data-land-q]"), "the question stays live under the open sheet").toBeVisible()
  expect(await count(j, "combo_break"), "zero combo_break — the watch is not an 'ignored'").toBe(0)

  // ── and the streak RESUMES: answering right afterwards climbs to DOUBLE ──
  await answer(page)
  s = await state(page)
  expect(s.combo, "×2 — the interruption cost the streak nothing").toBe(2)
  expect(s.pending, "answered — pending disarmed").toBe(false)
  const combos = ((await j.beats()) as Array<{ beat: string; n?: number; name?: string }>).filter(
    (b) => b.beat === "combo",
  )
  expect(combos.length, "one combo beat in the whole journey (×1 announces nothing)").toBe(1)
  expect({ n: combos[0].n, name: combos[0].name }, "and it is the DOUBLE").toEqual({ n: 2, name: "DOUBLE COMBO!" })
  await expect(page.locator('[data-combo-pop="2"]'), "the announcer slams DOUBLE").toBeVisible()
  expect(await count(j, "combo_break"), "still zero combo_break end to end").toBe(0)
  expect(await count(j, "land_q_answered"), "two answers total").toBe(2)

  expect(errors, "no pageerror across boot, hops, watch, and both answers").toEqual([])
})
