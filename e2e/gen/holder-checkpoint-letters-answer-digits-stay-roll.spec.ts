/* @hyperspace {"theme":"challenge-progression","L":"white-belt-holder","F":"checkpoint-quiz","B":"cross-feature"}
   @invariant "While a checkpoint quiz is open over a live hand, letters answer the quiz (A-D advance _checkpoint.i) but digit keys never reach the roll beneath: no digit opens an option expand sheet (_detailCtx stays falsy, zero sheet_opened), and Enter after a digit fires no commit — the paused roll cannot play out under the live quiz." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { whiteBeltHolder, CURRICULUM } from "../gen/personas"

/**
 * QUARANTINED RED — Q007.
 *
 * The keyboard's option-card opener branch (app.src.jsx:318-320,
 * `/^[1-9]$/ … this._optPick && this._optList`) has NO `_checkpoint` guard, and neither
 * does `expandOption` (:1583). During a checkpoint quiz the pre-quiz hand is still live
 * beneath the pane (`startCheckpoint` never parks `_optPick`), so digits above the MC
 * option count fall through to the ROLL: '5'-'9' open the option expand sheet under the
 * open quiz (sheet_opened fires, `_detailCtx` set), and Enter then fires
 * `ctx.onPick(ctx.opt)` (:292) → COMMIT — the roll plays out under the live quiz
 * (probe: commit → sweep_start → sweep_land → impact_success → land → options_dealt),
 * unpauses the game, advances to a NEW position, and the landing's `buildDrillPanel`
 * clobbers the quiz surface (`_posKey` flips to the new position's deck, the drill
 * header loses "Checkpoint N of M") while `_checkpoint` stays armed mid-quiz — the
 * Q002 zombie through a different door (Q002 fixed the decision-CLOCK path; this is the
 * manual keyboard path around that fix).
 *
 * In scope: digits must not LEAK past the quiz. Deliberately NOT asserted: digits 1-4
 * (below the MC option count) are captured by the deck-surface MC branch (:314) and
 * answer the quiz — that is core-035 canon (digits alias the deck MC) applied to the
 * quiz's deck surface, intended, and orthogonal to this bug.
 *
 * Fix-shape-agnostic: guard the [1-9] opener on `!this._checkpoint`, or park
 * `_optPick`/`_optList` for the quiz's duration, or guard `expandOption` — under any of
 * these the digit is inert, Enter is a no-op, and every assert below goes green.
 */

const BLUE = CURRICULUM.belts[1]
const U1 = BLUE.units[0]
const U1_KEY = `${BLUE.id}/${U1.id}`
const U1_DECKS: string[] = U1.lessons.map((l: any) => l.deckKey)
const CP = U1.checkpoint // {cards:6, pass:5} at authoring

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

/** census of the two surfaces: quiz cursor + every way the roll could have moved */
const census = (page: any) =>
  page.evaluate(() => {
    const a = (window as any).__neural
    const beats = (a.beats || []).map((b: any) => b.beat)
    const n = (x: string) => beats.filter((b: string) => b === x).length
    return {
      cpI: a._checkpoint ? a._checkpoint.i : null,
      posKey: a._posKey,
      detailCtx: !!a._detailCtx,
      deckShown: !!a.deckShown,
      mcSurface: a._mc ? a._mc.surface : null,
      mcOpts: document.querySelectorAll("[data-mc-opt]").length,
      sheets: n("sheet_opened"),
      commits: n("commit"),
      lands: n("land"),
      dealt: n("options_dealt"),
      mcCorrect: n("mc_correct"),
      mcWrong: n("mc_wrong"),
    }
  })

test("digits during an open checkpoint quiz never open a sheet or commit the roll beneath", async ({ page }) => {
  // curriculum facts the arc leans on — fail loudly here if the corpus shifts
  expect(CP && CP.cards, "blue u1 defines a checkpoint quiz").toBeGreaterThan(0)
  expect(U1_DECKS.length, "blue u1 defines lessons").toBeGreaterThan(0)

  const j = journey(page)
  // whiteBeltHolder + blue u1 drilled to goal — arms startCheckpoint's evidence gate
  const seed: any = whiteBeltHolder()
  for (const dk of U1_DECKS) {
    seed.prep[dk] = 3
    seed.rec[dk] = 3
  }
  seed.settings.landQuestions = false // keep every mc_*/sheet census scoped to the quiz + roll keys
  await j.boot("/", { initialState: seed })
  await j.land("Mount Top")

  // the live hand beneath the quiz — the digit fallthrough needs options past the MC count
  const hand = await page.evaluate(() => {
    const a = (window as any).__neural
    return { opts: (a._optList || []).length, optPick: !!a._optPick, cardNumbers: a.get("cardNumbers", true) }
  })
  expect(hand.optPick, "a live hand sits beneath the quiz").toBe(true)
  expect(hand.opts, "hand deep enough that '5' and '9' address real roll options").toBeGreaterThanOrEqual(5)
  expect(hand.cardNumbers, "digit openers enabled (default)").toBe(true)

  // rig every draw the sitting consumes (depth IS the determinism)
  await j.rig("checkpoint-pick", seq(7, CP.cards + 4))
  await j.rig("mc-pick", seq(21, 500))
  await j.rig("mc-shuffle", seq(42, 150))

  // open the challenges view, select BLUE, start the quiz from the real checkpoint button
  await page.evaluate(() => (window as any).__neural.toggleExplorer())
  await expect(page.locator("[data-view]").first()).toBeVisible()
  await page.locator(`.ng-track-card[data-track="${BLUE.id}"]`).click()
  await page.locator(`[data-checkpoint="${U1_KEY}"]`).first().click()
  await j.advance(400)
  await j.decksSettled() // quiz pool decks hydrate async (v1.80.4) - settle before the one-shot beat check
  await j.expectBeat("checkpoint_start")

  const s0 = await census(page)
  expect(s0.cpI, "quiz open at card 1").toBe(0)
  expect(s0.mcSurface, "quiz MC lives on the deck surface").toBe("deck")
  expect(s0.detailCtx, "no expand sheet at quiz open").toBe(false)

  // ── the intended half (green today): the correct LETTER answers the quiz ──
  const correct = await page.evaluate(() => (window as any).__neural._mc.correct)
  await page.keyboard.press("abcd"[correct])
  await j.advance(300)
  const s1 = await census(page)
  expect(s1.cpI, "letter answer advanced the quiz cursor").toBe(1)
  expect(s1.mcCorrect - s0.mcCorrect, "letter answer landed as mc_correct").toBe(1)
  expect(s1.sheets, "letter opened no sheet").toBe(s0.sheets)
  expect(s1.commits, "letter fired no commit").toBe(s0.commits)
  const quizDeck = s1.posKey // card 2's picked deck — the surface the user must keep facing

  // ── THE RED CORE: digits past the MC option count must not leak into the roll ──
  await page.keyboard.press("5")
  await j.advance(300)
  const s2 = await census(page)
  expect(s2.sheets - s1.sheets, "digit '5' opens no roll option sheet under the quiz").toBe(0)
  expect(s2.detailCtx, "digit '5' leaves _detailCtx falsy").toBe(false)
  expect(s2.cpI, "digit '5' leaves the quiz cursor alone").toBe(1)

  await page.keyboard.press("9")
  await j.advance(300)
  const s3 = await census(page)
  expect(s3.sheets - s1.sheets, "digit '9' opens no roll option sheet either").toBe(0)
  expect(s3.detailCtx, "_detailCtx still falsy").toBe(false)

  // Enter is the sheet's Execute key — with no sheet it must be a no-op, never a commit
  await page.keyboard.press("Enter")
  await j.advance(600)
  await j.advance(4000) // if a commit slipped through, the resolve arc lands well within this
  const s4 = await census(page)
  expect(s4.commits, "zero commits — the roll never played under the open quiz").toBe(s1.commits)
  expect(s4.lands, "no new landing — the roll never moved").toBe(s1.lands)
  expect(s4.dealt, "no fresh hand dealt beneath the quiz").toBe(s1.dealt)

  // and the quiz is still the live, answerable surface — not a clobbered zombie
  expect(s4.cpI, "quiz cursor still at card 2 — digits/Enter advanced nothing").toBe(1)
  expect(s4.posKey, "drill surface still presents the picked quiz deck").toBe(quizDeck)
  expect(s4.deckShown, "quiz pane still up").toBe(true)
  expect(s4.mcSurface, "quiz MC block still live").toBe("deck")
  expect(s4.mcOpts, "quiz card still answerable").toBeGreaterThan(0)

  // proof the quiz is genuinely alive: the next correct letter still advances it
  const c2 = await page.evaluate(() => (window as any).__neural._mc.correct)
  await page.keyboard.press("abcd"[c2])
  await j.advance(300)
  expect((await census(page)).cpI, "card 2 answers cleanly after the digit storm").toBe(2)
})
