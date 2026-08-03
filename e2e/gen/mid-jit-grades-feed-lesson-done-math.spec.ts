/* @hyperspace {"theme":"unlock-economy","L":"curriculum-mid","F":"option-tray-sheet","B":"cross-feature"} @invariant "JIT sheet grades and lesson drills are the same prep ledger, and locks do not firewall the credit: three JIT grades on a technique whose deckKey is a LOCKED unit's lesson push prep[key]>=goal so that lesson row renders data-done='1' inside its still-locked unit, while the unit itself stays incomplete (no unit_done)." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { curriculumMid, CURRICULUM } from "./personas"

/**
 * CROSS-FEATURE LEDGER: the in-sheet JIT micro-drill and the Belt Path lesson rows read/write
 * ONE prep ledger, and curriculum locks gate ACTIONS (row clicks), never the CREDIT.
 *
 * Mechanism under test (neural/src/app.src.jsx):
 *   - :1561-1601 — the expand sheet's JIT block keys on the technique's OWN deck
 *     (jitKey = deckKeyFor(optionNode).key when that deck is non-empty; _posKey only as
 *     fallback) and emits jit_opened {deck_key}. Each "Got it" runs prep[jitKey]++ +
 *     noteCardDone(card, jitKey) — the SAME choke lesson drilling uses.
 *   - :840-853 — noteCardDone bumps sharpness (+0.10 flat), calls _maybeLessonDone, and
 *     emits bonus_pumped {deck_key} once per DISTINCT question (cardDone dedup) — the JIT
 *     cycles _jitIdx so 3 grades = 3 distinct cards = exactly 3 beats.
 *   - :2426-2427 — lessonDone(key) = prep[key] >= _deckGoal(key) = min(3, deckSize).
 *     Prep-only and LOCK-BLIND: no lock check anywhere in the ledger math.
 *   - :2436-2443 — _maybeLessonDone fires lesson_done {deckKey, unit, belt} at the crossing —
 *     THROUGH the lock (no uLocked consult) — once per life (_lessonBeatFired).
 *   - :2495-2508 — renderBeltPath stamps lesson data-done="1" from lessonDone() regardless of
 *     uLocked; the lock only nulls the row's onClick (:2503) and stamps unit data-locked.
 *   - unit_done exists ONLY in completeCheckpoint (:2461) and checkpoint pass (:3508), so a
 *     lesson completed inside a locked unit must leave the unit row undone and the stream
 *     unit_done-free.
 * Lock lineage under curriculumMid: U0 done (checkpoint seeded), U1 the half-drilled frontier
 * (no checkpoint) → every unit at index >= 2 is sequentially locked; the unit that carries the
 * Mount-Top lesson decks sits deep in that locked tail (index 4, "mount-top") yet its technique
 * decks are exactly what the Mount Top hand deals.
 * Rigs: none beyond land()'s built-ins (ai-skill/role/max-moves) — we never commit, and the
 * clock drains only 1.8s across three advance(600)s while grades refund +5s (2×2500ms, capped),
 * so no resolve/outcome/auto-pick draw ever occurs.
 */

const WHITE: any = CURRICULUM.belts[0]
// the locked unit is FOUND by content (the unit whose lessons include the Mount Top position
// deck), never hardcoded by index — but its lock depends on it sitting past the frontier
const LOCKED_UNIT: any = WHITE.units.find((u: any) => u.lessons.some((l: any) => l.deckKey === "Mount|Top"))
const LOCKED_IDX = WHITE.units.indexOf(LOCKED_UNIT)
const UK = LOCKED_UNIT ? `${WHITE.id}/${LOCKED_UNIT.id}` : ""
const LESSON_KEYS: string[] = LOCKED_UNIT ? LOCKED_UNIT.lessons.map((l: any) => l.deckKey) : []

test("three JIT grades complete a LOCKED unit's lesson through the lock — unit stays locked and incomplete", async ({
  page,
}) => {
  // ── curriculum facts the journey leans on — fail loudly here if the corpus shifts ──
  expect(LOCKED_UNIT, "a white unit carries the Mount|Top lesson deck").toBeTruthy()
  expect(LOCKED_IDX, "that unit sits past the curriculumMid frontier (U0 done, U1 current) → locked").toBeGreaterThanOrEqual(2)
  expect(LESSON_KEYS.length, "the locked unit defines lessons").toBeGreaterThan(0)

  const j = journey(page)
  await j.boot("/", { initialState: curriculumMid() })
  await j.land("Mount Top")

  // ── pick the target like the app would: first dealt option whose OWN deck is one of the
  // LOCKED unit's lesson decks, drillable (>=3 cards) and untouched (prep 0 — curriculumMid
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
  expect(target, "the dealt hand contains a drillable locked-unit lesson technique").toBeTruthy()
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
    await page.locator("[data-jit-reveal]").click()
    await page.locator("[data-jit-got]").click()
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
  expect(ledger.lessonDone, "lessonDone(key) crossed — the ledger is lock-blind").toBe(true)
  expect(ledger.unitComplete, "unit NOT complete (checkpoint never granted)").toBe(false)
  expect(ledger.checkpoint, "no checkpoint record materialized").toBe(false)

  // the same grades pumped the odds (mastery +9, sharpness +10; >= 18 tolerates rounding)
  const oddsAfter = await j.displayedOdds(title)
  expect(oddsAfter - oddsBefore, "JIT credit feeds the odds economy too").toBeGreaterThanOrEqual(18)

  // beat economy: one bonus_pumped per distinct card, all on OUR deck
  const pumped = (await j.beats()).filter((b) => b.beat === "bonus_pumped" && (b as any).deck_key === key)
  expect(pumped, "three distinct cards → exactly three pumps").toHaveLength(3)

  // lesson_done fired THROUGH the lock, tagged with the locked unit's lineage — and only once
  const lessons = (await j.beats()).filter((b) => b.beat === "lesson_done")
  expect(lessons, "exactly one lesson_done in the whole stream").toHaveLength(1)
  expect((lessons[0] as any).deckKey).toBe(key)
  expect((lessons[0] as any).unit, "beat names the LOCKED unit").toBe(UK)
  expect((lessons[0] as any).belt).toBe(WHITE.id)

  // ── close the sheet like a user (Escape → closeOptionDetail) and open the Belt Path ──
  await page.keyboard.press("Escape")
  expect(await page.evaluate(() => !!(window as any).__neural._detailCtx), "sheet closed").toBe(false)
  await page.evaluate(() => (window as any).__neural.toggleExplorer())
  await expect(page.locator("[data-view]").first()).toBeVisible()
  await j.expectBeat("path_opened")

  // ── THE RENDERED CONTRADICTION THAT ISN'T ONE: a done lesson row inside a locked unit ──
  const attr = (sel: string, a: string) => page.locator(sel).first().getAttribute(a)
  expect(await attr(`[data-lesson="${key}"]`, "data-done"), "lesson row done INSIDE the locked unit").toBe("1")
  expect(await attr(`[data-unit="${UK}"]`, "data-locked"), "unit row still locked").toBe("1")
  expect(await attr(`[data-unit="${UK}"]`, "data-done"), "unit row NOT done").toBeNull()
  expect(await attr(`[data-checkpoint="${UK}"]`, "data-done"), "checkpoint row unpassed").toBeNull()

  // no unit-completion or checkpoint machinery ever ran — the credit crossed, the gate held
  const beats = await j.beats()
  expect(beats.filter((b) => b.beat === "unit_done"), "zero unit_done in the whole stream").toHaveLength(0)
  expect(beats.filter((b) => b.beat.startsWith("checkpoint")), "no checkpoint beats at all").toHaveLength(0)
})
