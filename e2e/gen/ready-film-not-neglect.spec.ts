/* @hyperspace {"theme":"momentum-and-economy","L":"belt-ready","F":"film-study","B":"interruption-abort"} @invariant "Watch declines a pending question for free, with one land_q_declined reading event and no penalty. Explicit playback earns film_first_look (+4) without answering, a second decline or a combo break. Close restores the same question, whose answer still climbs the streak." */
import { test, expect, type Page } from "@playwright/test"
import { journey, type Journey } from "../dsl"
import { openChoiceVideo, playChoiceVideo } from "../fixtures/video-cards"
import { beltReady } from "./personas"

/** v1.230.0 reverses v1.218.1/v1.220.0 Inspect. Watch declines the clock for free,
 * then only explicit playback earns film first-look. The modal blocks gameplay keys;
 * Close restores the same unanswered question and its momentum credit.
 */

/** answer the live landing question via the keyboard (truth read from _mc, never the DOM) */
const answer = async (page: Page) => {
  const mc = await page.evaluate(() => {
    const m = (window as any).__neural._mc
    return m && m.surface === "land" ? { correct: m.correct, n: m.n } : null
  })
  expect(mc, "a live landing question (surface 'land')").toBeTruthy()
  await journey(page).openQuestion() // U47 d: the question asks first; Answer for Points shows its answers
  await page.keyboard.press("abcd"[mc!.correct])
}

/** momentum + pending-question state, read in one evaluate */
const state = (page: Page) =>
  page.evaluate(() => {
    const a = (window as any).__neural
    return { combo: a._combo || 0, pending: !!a._landPending, mcSurface: a._mc ? a._mc.surface : null }
  })

const count = async (j: Journey, beat: string) => (await j.beats()).filter((b) => b.beat === beat).length

test("film with a question pending: Watch declines it free, +4 mints, the film neither answers nor neglects, and the same question climbs to DOUBLE after Close", async ({
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

  // Watch a mid-band technique while a question is pending. The editorial fixture
  // approves its own-role front; opening the real viewer must not earn the +4.
  const titles = await j.optionTitles()
  const oddsBefore: Record<string, number> = {}
  for (const t of titles) oddsBefore[t] = await j.displayedOdds(t)
  const target = titles.find((t) => oddsBefore[t] > 5 && oddsBefore[t] <= 91)
  expect(target, "a mid-band option (>5, <=91) — the +4 lands whole, clear of both clamps").toBeTruthy()
  // U47 d: take the question up first, so Watch declines — and must out-own the keys of — a SHOWN question.
  await j.openQuestion()
  await openChoiceVideo(page, target!)
  // Watch declines once and owns all keyboard input until Escape.
  const declinesAtOpen = ((await j.beats()) as Array<{ beat: string; reason?: string }>)
    .filter((b) => b.beat === "land_q_declined")
    .map((b) => b.reason)
  expect(declinesAtOpen, "opening Watch declined the question — exactly once, reason 'reading'").toEqual(["reading"])
  s = await state(page)
  expect(s.pending, "_landPending dropped by Watch's decline (v1.134.0), before any film").toBe(false)
  expect(s.combo, "declining is free — the streak is still ×1").toBe(1)
  expect(await page.evaluate(() => !!(window as any).__neural._choiceWatch), "Watch owns keyboard input").toBe(true)
  await page.keyboard.press("a")
  expect(await count(j, "land_q_answered"), "a letter cannot answer beneath Watch").toBe(1)
  await playChoiceVideo(page)

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
  // INVERTED (v1.134.0): pending was already false from Watch's decline; the film must add no
  // second decline and no neglect of its own — the decline ledger is exactly what opening Watch wrote.
  expect(s.pending, "_landPending still false — the film resurrected nothing").toBe(false)
  expect(await count(j, "land_q_declined"), "the film walked past nothing — still the ONE Watch decline").toBe(1)
  expect(s.combo, "_combo survives the interruption at ×1").toBe(1)
  await expect(page.locator("[data-land-q]"), "the question stays on screen beneath the video viewer").toBeVisible()
  expect(await count(j, "combo_break"), "zero combo_break — the watch is not an 'ignored'").toBe(0)

  // ── and the streak RESUMES: Close returns from the focused provider iframe;
  //    answering the SAME question right afterwards climbs to DOUBLE. Modal Escape
  //    without provider focus is covered separately by video-cards/keyboard. ──
  await j.clickByMouse("[data-watch-close]", "Close the playing video")
  expect(await page.evaluate(() => !!(window as any).__neural._choiceWatch), "Close dismissed Watch").toBe(false)
  expect((await state(page)).mcSurface, "the landing question owns the keyboard again (`_handBackMc`)").toBe("land")
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
