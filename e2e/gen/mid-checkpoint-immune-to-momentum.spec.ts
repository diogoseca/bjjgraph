/* @hyperspace {"theme":"momentum-and-economy","L":"curriculum-mid","F":"checkpoint-quiz","B":"guard-limit"} @invariant "The checkpoint quiz is MC but it is not the landing surface: right AND wrong checkpoint answers leave _combo unchanged and emit zero combo/combo_break/land_q_answered beats — _mcBlock's surface scoping keeps the momentum economy exclusive to in-roll landings." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { curriculumMid, CURRICULUM } from "./personas"

/**
 * Two MC surfaces, one economy. The landing question (surface "land", app.src.jsx:4280) is the
 * ONLY place answers touch momentum: _landAnswered (:4302) mints (_comboUp) on right and breaks
 * (_breakCombo "wrong") on wrong. The checkpoint quiz calls _mcBlock with NO surface (:3888) →
 * default "deck": _mcAnswer (:3628) emits mc_correct/mc_wrong and hands to _checkpointAnswer,
 * never touching _combo. This spec heats the meter to ×1 on a real landing, walks into unit 2's
 * checkpoint, answers one card RIGHT and one card WRONG, and proves the meter never moved.
 *
 * Caveat that shapes the asserts: momentumMod() is 0 at BOTH combo 0 and 1, so a spurious
 * break would be invisible to the mod — _combo===1 is the load-bearing check (catches both
 * break→0 and up→2). Teeth-proven in the probe: injecting __neural._breakCombo mid-quiz turned
 * the run RED at exactly that assert.
 *
 * Determinism: every draw rigged with pre-sized queues (landing card renders DURING land, so
 * land-mc-* rig before it; checkpoint card renders draw mc-pick/mc-shuffle; checkpoint-pick
 * picks the quiz cards; auto-pick rigged defensively). onDone is synchronous in test mode —
 * isTest() skips the 600ms sidebar auto-advance (:3652). Assertions are structural (beats,
 * counts, _mc truth rail, deckKeys from curriculum.json) — never card/answer text.
 */

const WHITE = CURRICULUM.belts[0]
const U2 = WHITE.units[1]
const UK = `${WHITE.id}/${U2.id}`

/** deterministic rig-queue filler (LCG) — pre-sized, never Math.random */
const seq = (seed: number, n: number): number[] => {
  const out: number[] = []
  let s = seed >>> 0
  for (let i = 0; i < n; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    out.push(s / 4294967296)
  }
  return out
}

const meter = (page: any) =>
  page.evaluate(() => {
    const a = (window as any).__neural
    return { combo: a._combo || 0, mod: a.momentumMod(), pending: !!a._landPending }
  })

test("right AND wrong checkpoint answers leave the combo meter at ×1 — zero combo/land beats in the quiz window", async ({
  page,
}) => {
  // curriculum fact the arc leans on: after 2 answers the quiz must still be LIVE (i===2 < cards)
  expect(U2.checkpoint && U2.checkpoint.cards, "unit 2's quiz outlives two answers").toBeGreaterThan(2)

  const j = journey(page)
  await j.boot("/", { initialState: curriculumMid() })
  // the landing card (and its question) renders DURING land — its draws must be rigged first
  await j.rig("land-mc-pick", seq(3, 200))
  await j.rig("land-mc-shuffle", seq(11, 40))
  await j.land("Mount Top")

  // ── heat the meter to ×1 on the REAL momentum surface: answer the landing question right ──
  await expect(page.locator("[data-land-q]")).toBeVisible()
  const landMc = await page.evaluate(() => {
    const m = (window as any).__neural._mc
    return m && m.surface === "land" ? { correct: m.correct, n: m.n } : null
  })
  expect(landMc, "the live MC block is the landing surface").toBeTruthy()
  await page.keyboard.press("abcd"[landMc!.correct])

  const hot = await meter(page)
  expect(hot.combo, "one right landing answer minted ×1").toBe(1)
  expect(hot.pending, "the question left the table").toBe(false)
  const landBeats = (await j.beats()).filter((b: any) => b.beat === "land_q_answered") as any[]
  expect(landBeats.length, "exactly one land_q_answered").toBe(1)
  expect(landBeats[0].correct).toBe(true)

  // ── finish unit 2's remaining lessons via the drill rail (persona seeded the first half) ──
  for (const l of U2.lessons.slice(Math.ceil(U2.lessons.length / 2))) await j.drill(3, l.deckKey)

  // rig the quiz's draws; auto-pick defensively (a regression must not fall through to Math.random)
  await j.rig("checkpoint-pick", seq(7, 10))
  await j.rig("mc-pick", seq(13, 500))
  await j.rig("mc-shuffle", seq(29, 100))
  await j.rig("auto-pick", [0, 0])

  // baseline at the seam: meter state + beat-stream mark BEFORE anything checkpoint-shaped
  const pre = await page.evaluate(() => {
    const a = (window as any).__neural
    return { combo: a._combo || 0, mod: a.momentumMod(), mark: (a.beats || []).length }
  })
  expect(pre.combo, "drilling never touched the meter").toBe(1)

  // ── open the path and start unit 2's checkpoint ──
  await page.evaluate(() => (window as any).__neural.toggleExplorer())
  await expect(page.locator("[data-view]").first()).toBeVisible()
  await page.locator(`[data-checkpoint="${UK}"]`).first().click()
  await j.advance(400)
  await j.expectBeat("checkpoint_start")

  // truth rail: the quiz block is surface "deck" — NOT the landing surface
  const quizMc = await page.evaluate(() => {
    const m = (window as any).__neural._mc
    return m ? { correct: m.correct, n: m.n, surface: m.surface } : null
  })
  expect(quizMc, "quiz card 1 presents as MC").toBeTruthy()
  expect(quizMc!.surface, "checkpoint _mcBlock defaults to the deck surface").toBe("deck")

  // ── card 1: RIGHT (the landing surface would mint ×2 here) ──
  await page.locator("[data-mc-opt]").nth(quizMc!.correct).click()
  await j.advance(300)

  // ── card 2: WRONG (the landing surface would break the streak here) ──
  const mc2 = await page.evaluate(() => {
    const m = (window as any).__neural._mc
    return m ? { correct: m.correct, n: m.n, surface: m.surface } : null
  })
  expect(mc2, "quiz card 2 presents as MC").toBeTruthy()
  expect(mc2!.surface).toBe("deck")
  await page.locator("[data-mc-opt]").nth((mc2!.correct + 1) % mc2!.n).click()
  await j.advance(300)

  // ── the invariant: the meter never moved, and the quiz window emitted no momentum beats ──
  const post = await page.evaluate((mark) => {
    const a = (window as any).__neural
    const win = (a.beats || []).slice(mark).map((b: any) => b.beat)
    const count = (n: string) => win.filter((x: string) => x === n).length
    return {
      combo: a._combo || 0,
      mod: a.momentumMod(),
      i: a._checkpoint ? a._checkpoint.i : null,
      mcCorrect: count("mc_correct"),
      mcWrong: count("mc_wrong"),
      comboBeats: count("combo"),
      comboBreaks: count("combo_break"),
      landAnswered: count("land_q_answered"),
    }
  }, pre.mark)

  expect(post.combo, "_combo still ×1 — right didn't mint, wrong didn't break").toBe(1)
  expect(post.mod, "momentumMod unchanged (0 at ×1 — the caveat; _combo above is the teeth)").toBe(pre.mod)
  expect(post.i, "both answers advanced the quiz — they registered as answers").toBe(2)
  expect(post.mcCorrect, "the right answer spoke as mc_correct").toBe(1)
  expect(post.mcWrong, "the wrong answer spoke as mc_wrong").toBe(1)
  expect(post.comboBeats, "zero combo beats in the quiz window").toBe(0)
  expect(post.comboBreaks, "zero combo_break beats in the quiz window").toBe(0)
  expect(post.landAnswered, "zero land_q_answered beats — the quiz is not the landing surface").toBe(0)
})
