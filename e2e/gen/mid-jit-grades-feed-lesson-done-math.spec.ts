/* @hyperspace {"theme":"unlock-economy","L":"curriculum-mid","F":"option-tray-sheet","B":"cross-feature"} @invariant "JIT sheet grades and lesson drills are the same prep ledger: three JIT grades on a technique whose deckKey is a not-yet-studied unit's lesson push prep[key]>=goal so lessonDone crosses and exactly one lesson_done names that unit — while the unit itself stays incomplete (no unit_done, no checkpoint record, checkpoint button still evidence-gated)." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { curriculumMid, CURRICULUM } from "./personas"

/**
 * CROSS-FEATURE LEDGER: the in-sheet JIT micro-drill and the Challenges lesson buttons
 * read/write ONE prep ledger — JIT credit crosses lessonDone, yet the unit's checkpoint
 * evidence gate stays exactly as strict (v1.74: locks are retired; the checkpoint button's
 * disabled state is the gate).
 *
 * Mechanism under test (neural/src/app.src.jsx):
 *   - :1561-1601 — the expand sheet's JIT block keys on the technique's OWN deck
 *     (jitKey = deckKeyFor(optionNode).key when that deck is non-empty; _posKey only as
 *     fallback) and emits jit_opened {deck_key}. Each "Got it" runs prep[jitKey]++ +
 *     noteCardDone(card, jitKey) — the SAME choke lesson drilling uses.
 *   - :840-853 — noteCardDone bumps sharpness (+0.10 flat), calls _maybeLessonDone, and
 *     emits bonus_pumped {deck_key} once per DISTINCT question (cardDone dedup) — the JIT
 *     cycles _jitIdx so 3 grades = 3 distinct cards = exactly 3 beats.
 *   - lessonDone(key) = prep[key] >= _deckGoal(key) = min(3, deckSize). Prep-only: no
 *     progress/render check anywhere in the ledger math.
 *   - _maybeLessonDone fires lesson_done {deckKey, unit, belt} at the crossing — once per
 *     life (_lessonBeatFired) — regardless of where the credit came from.
 *   - v1.74 Challenges UI: lesson buttons carry no done attribute; the unit's evidence
 *     gate is the checkpoint button's disabled state (done < live.length) in
 *     challengeCurriculumElement.
 *   - unit_done exists ONLY in completeCheckpoint and the checkpoint pass branch, so a
 *     lesson completed by JIT credit must leave the unit incomplete and the stream
 *     unit_done-free.
 * Seed lineage under curriculumMid: U0 done (checkpoint seeded), U1 half-drilled; every unit
 * at index >= 2 is untouched (prep 0) — the unit that carries the Mount-Top lesson decks sits
 * in that untouched tail (index 4, "mount-top") yet its technique decks are exactly what the
 * Mount Top hand deals.
 * Rigs: none beyond land()'s built-ins (ai-skill/role/max-moves) — we never commit, and the
 * clock drains only 1.8s across three advance(600)s while grades refund +5s (2×2500ms, capped),
 * so no resolve/outcome/auto-pick draw ever occurs.
 */

const WHITE: any = CURRICULUM.belts[0]
// the target unit is FOUND by content (the unit whose lessons include the Mount Top position
// deck), never hardcoded by index — its prep-0 premise depends on it sitting past the seed
const TARGET_UNIT: any = WHITE.units.find((u: any) => u.lessons.some((l: any) => l.deckKey === "Mount|Top"))
const TARGET_IDX = WHITE.units.indexOf(TARGET_UNIT)
const UK = TARGET_UNIT ? `${WHITE.id}/${TARGET_UNIT.id}` : ""
const LESSON_KEYS: string[] = TARGET_UNIT ? TARGET_UNIT.lessons.map((l: any) => l.deckKey) : []

test("three JIT grades complete a not-yet-studied unit's lesson — unit stays incomplete and gated", async ({
  page,
}) => {
  // ── curriculum facts the journey leans on — fail loudly here if the corpus shifts ──
  expect(TARGET_UNIT, "a white unit carries the Mount|Top lesson deck").toBeTruthy()
  expect(TARGET_IDX, "that unit sits past curriculumMid's seeded units (U0 done, U1 half) → untouched prep").toBeGreaterThanOrEqual(2)
  expect(LESSON_KEYS.length, "the target unit defines lessons").toBeGreaterThan(0)

  const j = journey(page)
  await j.boot("/", { initialState: curriculumMid() })
  await j.land("Mount Top")

  // ── pick the target like the app would: first dealt option whose OWN deck is one of the
  // target unit's lesson decks, drillable (>=3 cards) and untouched (prep 0 — curriculumMid
  // seeds only U0 + half of U1, never this unit). deckKeyFor is the app's truth, so the
  // spec never hand-derives "<name>|Attacker". Probe fact: the Mount Top hand deterministically
  // deals TWO such candidates (Americana / Armbar from Mount) — we need and guard >= 1. ──
  const target = await page.evaluate((lessonKeys) => {
    const a = (window as any).__neural
    for (const o of a.optionIdxs || []) {
      const n = a.nodes[typeof o === "number" ? o : o.idx]
      if (!n) continue
      const key = a.deckKeyFor(n).key
      if ((lessonKeys as string[]).indexOf(key) < 0) continue
      const deck = a.flashcards?.decks?.[key]
      if (!deck || deck.cards.length < 3) continue // >=3 distinct-card headroom AND goal=min(3,size)=3
      if ((a.prep && a.prep[key]) > 0) continue
      const q3 = deck.cards.slice(0, 3).map((c: any) => c.q)
      return { title: n.t, key, deckSize: deck.cards.length, goal: a._deckGoal(key), distinct3: new Set(q3).size === 3 }
    }
    return null
  }, LESSON_KEYS)
  expect(target, "the dealt hand contains a drillable target-unit lesson technique").toBeTruthy()
  const { title, key, goal } = target!
  expect(LESSON_KEYS).toContain(key)
  expect(goal, "_deckGoal = min(3, deckSize) with deckSize >= 3").toBe(3)
  // structural identity guard (never content): 3 distinct questions beat the cardDone dedup,
  // making the exact bonus_pumped count below assertable
  expect(target!.distinct3, "first 3 cards carry distinct questions").toBe(true)

  // clamp headroom: +0.09 mastery (3×0.03) + 0.10 sharpness = +19pts must fit inside the
  // [0.05, 0.95] clamp band for the >= 18 delta assert (probe: 33 → 52)
  const oddsBefore = await j.displayedOdds(title)
  expect(oddsBefore, "pre-odds clear of the 0.05 floor").toBeGreaterThanOrEqual(6)
  expect(oddsBefore, "pre-odds leave full +19 headroom under the 0.95 clamp").toBeLessThanOrEqual(76)

  // baseline: nothing has graded this life — the completion beats can only come from OUR grades
  const countBeat = async (name: string) => (await j.beats()).filter((b) => b.beat === name).length
  expect(await countBeat("lesson_done")).toBe(0)
  expect(await countBeat("unit_done")).toBe(0)

  // ── open the expand sheet on the tray card (real click); the JIT block keys on the
  // technique's OWN deck — jit_opened.deck_key proves the _posKey fallback was NOT taken ──
  await page.locator(`[data-tech="${title}"]`).first().click()
  await expect(page.locator("[data-jit]"), "in-sheet JIT micro-drill visible").toBeVisible()
  const jitOpens = (await j.beats()).filter((b) => b.beat === "jit_opened")
  expect(jitOpens, "exactly one sheet opened").toHaveLength(1)
  expect((jitOpens[0] as any).deck_key, "JIT drills the technique's OWN deck, not the position fallback").toBe(key)

  // ── three grades through the sheet UI: reveal → Got it (advance covers the odometer window;
  // refunds outpace the 1.8s drain, so the decision window never expires) ──
  for (let i = 0; i < 3; i++) {
    await j.jitGrade()
    await j.advance(600)
  }

  // ── THE LEDGER CROSSING: same prep counter lesson drilling uses, pushed to goal ──
  const ledger = await page.evaluate(
    ([k, uk]) => {
      const a = (window as any).__neural
      const b = a.curriculum.belts[0]
      const u = b.units.find((x: any) => b.id + "/" + x.id === uk)
      return {
        prep: (a.prep && a.prep[k]) || 0,
        lessonDone: !!a.lessonDone(k),
        unitComplete: !!a.unitComplete(b.id, u),
        checkpoint: !!(a.units && a.units[uk] && a.units[uk].checkpoint),
      }
    },
    [key, UK] as const,
  )
  expect(ledger.prep, "three JIT grades = prep exactly at goal").toBe(3)
  expect(ledger.lessonDone, "lessonDone(key) crossed — JIT credit and drills share one ledger").toBe(true)
  expect(ledger.unitComplete, "unit NOT complete (checkpoint never granted)").toBe(false)
  expect(ledger.checkpoint, "no checkpoint record materialized").toBe(false)

  // the same grades pumped the odds (mastery +9, sharpness +10; >= 18 tolerates rounding)
  const oddsAfter = await j.displayedOdds(title)
  expect(oddsAfter - oddsBefore, "JIT credit feeds the odds economy too").toBeGreaterThanOrEqual(18)

  // beat economy: one bonus_pumped per distinct card, all on OUR deck
  const pumped = (await j.beats()).filter((b) => b.beat === "bonus_pumped" && (b as any).deck_key === key)
  expect(pumped, "three distinct cards → exactly three pumps").toHaveLength(3)

  // lesson_done fired from JIT credit alone, tagged with the target unit's lineage — only once
  const lessons = (await j.beats()).filter((b) => b.beat === "lesson_done")
  expect(lessons, "exactly one lesson_done in the whole stream").toHaveLength(1)
  expect((lessons[0] as any).deckKey).toBe(key)
  expect((lessons[0] as any).unit, "beat names the target unit").toBe(UK)
  expect((lessons[0] as any).belt).toBe(WHITE.id)

  // ── close the sheet like a user (Escape → closeOptionDetail) and open the Challenges view ──
  await page.keyboard.press("Escape")
  expect(await page.evaluate(() => !!(window as any).__neural._detailCtx), "sheet closed").toBe(false)
  await page.evaluate(() => (window as any).__neural.toggleExplorer())
  await expect(page.locator("[data-view]").first()).toBeVisible()
  await j.expectBeat("challenges_opened")

  // ── THE RENDERED CONTRADICTION THAT ISN'T ONE: a JIT-completed lesson inside a unit whose
  //    checkpoint gate is still shut (v1.74: the disabled button IS the gate — no lock attrs) ──
  const cpBtn = page.locator(`[data-checkpoint="${UK}"]`).first()
  expect(await page.locator(`[data-lesson="${key}"]`).count(), "the credited lesson renders its button in the white track").toBe(1)
  expect(await cpBtn.isDisabled(), "checkpoint button still evidence-gated — one done lesson is not the unit").toBe(true)
  expect(await cpBtn.textContent(), "checkpoint not cleared").not.toContain("cleared")

  // no unit-completion or checkpoint machinery ever ran — the credit crossed, the gate held
  const beats = await j.beats()
  expect(beats.filter((b) => b.beat === "unit_done"), "zero unit_done in the whole stream").toHaveLength(0)
  expect(beats.filter((b) => b.beat.startsWith("checkpoint")), "no checkpoint beats at all").toHaveLength(0)
})
