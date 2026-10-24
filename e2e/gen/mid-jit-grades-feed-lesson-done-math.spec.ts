// v1.230.0: the owner dropped practise-before-you-try on 2026-10-15 (question 6).
/* @hyperspace {"theme":"unlock-economy","L":"curriculum-mid","F":"option-tray-sheet","B":"cross-feature"} @invariant "Sidebar study grades and lesson drills are the same prep ledger: three study grades on a technique whose deckKey is a not-yet-studied unit's lesson push prep[key]>=goal so lessonDone crosses and exactly one lesson_done names that unit — while the unit itself stays incomplete (no unit_done, no checkpoint record, checkpoint button still evidence-gated)." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { curriculumMid, CURRICULUM } from "./personas"

/** Sidebar study and Challenges share the same prep ledger. Three real recall grades
 * complete one lesson, award exactly three distinct-card pumps and one lesson_done,
 * while checkpoint evidence and unit completion remain unchanged. The sidebar entry
 * is fixture setup (studyChoice); Reveal / Got it are real mouse inputs.
 * The historical filename is retained for ledger identity. JIT-only entry assertions
 * are retired by the owner's 2026-10-15 decision, mapped in reading_test_migration.json.
 * No move is committed, so no resolve/outcome draw occurs.
 */

const WHITE: any = CURRICULUM.belts[0]
// the target unit is FOUND by content (the unit whose lessons include the Mount Top position
// deck), never hardcoded by index — its prep-0 premise depends on it sitting past the seed
const TARGET_UNIT: any = WHITE.units.find((u: any) => u.lessons.some((l: any) => l.deckKey === "Mount|Top"))
const TARGET_IDX = WHITE.units.indexOf(TARGET_UNIT)
const UK = TARGET_UNIT ? `${WHITE.id}/${TARGET_UNIT.id}` : ""
const LESSON_KEYS: string[] = TARGET_UNIT ? TARGET_UNIT.lessons.map((l: any) => l.deckKey) : []

test("three study grades complete a not-yet-studied unit's lesson — unit stays incomplete and gated", async ({
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

  await j.watchChoice(title)
  await j.studyChoice(title)
  expect(await page.evaluate(() => (window as any).__neural._deckInfo.key),
    "study owns the selected technique's deck").toBe(key)

  // Three distinct questions through the real sidebar Reveal / Got it controls.
  for (let i = 0; i < 3; i++) {
    await j.studyGrade()
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
  expect(ledger.prep, "three study grades = prep exactly at goal").toBe(3)
  expect(ledger.lessonDone, "lessonDone(key) crossed — study credit and drills share one ledger").toBe(true)
  expect(ledger.unitComplete, "unit NOT complete (checkpoint never granted)").toBe(false)
  expect(ledger.checkpoint, "no checkpoint record materialized").toBe(false)

  // the same grades pumped the odds (mastery +9, sharpness +10; >= 18 tolerates rounding)
  const oddsAfter = await j.displayedOdds(title)
  expect(oddsAfter - oddsBefore, "study credit feeds the odds economy too").toBeGreaterThanOrEqual(18)

  // beat economy: one bonus_pumped per distinct card, all on OUR deck
  const pumped = (await j.beats()).filter((b) => b.beat === "bonus_pumped" && (b as any).deck_key === key)
  expect(pumped, "three distinct cards → exactly three pumps").toHaveLength(3)

  // lesson_done fired from study credit alone, tagged with the target unit's lineage — only once
  const lessons = (await j.beats()).filter((b) => b.beat === "lesson_done")
  expect(lessons, "exactly one lesson_done in the whole stream").toHaveLength(1)
  expect((lessons[0] as any).deckKey).toBe(key)
  expect((lessons[0] as any).unit, "beat names the target unit").toBe(UK)
  expect((lessons[0] as any).belt).toBe(WHITE.id)

  // Close study, then inspect the same lesson in Challenges.
  await page.keyboard.press("Escape")
  expect(await page.evaluate(() => !!(window as any).__neural.deckShown), "study pane closed").toBe(false)
  await page.evaluate(() => (window as any).__neural.toggleExplorer())
  await expect(page.locator("[data-view]").first()).toBeVisible()
  await j.expectBeat("challenges_opened")

  // ── THE RENDERED CONTRADICTION THAT ISN'T ONE: a study-completed lesson inside a unit whose
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
