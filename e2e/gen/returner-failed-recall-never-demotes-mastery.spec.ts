/* @hyperspace {"theme":"unlock-economy","L":"lapsed-returner","F":"recall-gate","B":"guard-limit"} @invariant "Mastery is a ratchet, not a live meter: failing a recall grade (Again) on an already-proven deck leaves masteredCount() unchanged and the deck still counted as mastered — a bad day after the layoff cannot un-mint a mastery that recall already proved." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { lapsedReturner, CURRICULUM } from "./personas"

/**
 * LAPSED RETURNER — A BAD DAY CANNOT UN-MINT A MASTERY.
 *
 * A returning white-belt holder (all 32 white lesson decks recall-proven, rec===3 each) reopens
 * their very first lesson after the layoff and blanks on THREE cards in a row — the worst
 * realistic comeback session. Every "Review again" runs the app's real downgrade path, and the
 * spec pins the economy asymmetry: the per-card STAGE is the live meter (it drops on a fail),
 * while rec / masteredCount() are a RATCHET (minted once at the recall crossing, decremented
 * NOWHERE). The returner's portfolio must read exactly N mastered decks after every fail, and
 * the persisted blob must carry the same ratchet — a reload cannot demote it either.
 *
 * Mechanism under test (source-verified, neural/src/app.src.jsx):
 *   recallGrade(false) (:3454-3456) — the fail branch calls ONLY _bumpStage(key,q,-1) then
 *                                     deckIdx++/renderDrill: it never touches rec.
 *   recallGrade(true)  (:3449)      — the ONLY rec minter (got=true stage 2→3 crossing under
 *                                     the wasProven guard); no decrement site exists anywhere.
 *   masteredCount()    (:1153)      — Object.keys(rec).filter(k => rec[k] >= 3).length.
 *   settings ingest    (:1097)      — blob.settings merge; mcMode:"classic" → mcActive() false
 *                                     (:3351) → renderDrill builds the reveal/grade footer
 *                                     (:3661-3663) with _mc null (:3630). Zero MC rigs needed.
 *   openLessonStudy    (:2444)      — the explorer [data-lesson] row handler → studyFromSession
 *                                     (:1957) sets _inSession/_posKey/deckIdx=0.
 *   _saveProgress      (:1122)      — synchronous under __NEURAL_TEST__, so the persisted-bytes
 *                                     assert needs no debounce pump.
 *
 * NOVELTY vs adjacent CORE invariants: core-032 (mc-flashcards) pins the MC stage-cap and that
 * recall MINTS rec; core-055 (review-fixes) pins anti-inflation of the got=true re-grade. Both
 * only ever drive recallGrade(true). The FAIL branch — the only downgrade path, which moves
 * stage and must move nothing else — is exactly the surface they leave unpinned, and it is the
 * whole claim here, driven through the real footer button on an already-proven deck.
 *
 * VACUITY TEETH: a pass where recallGrade(false) never actually ran would be hollow. Two
 * witnesses prove the grades executed: (A) deckIdx advances 0→1→2→3 (the fail branch's own
 * deckIdx++), and (B) card 2 is pre-graduated to proven-look stage 3 via _bumpStage(+3) and the
 * UI fail demonstrably drops it 3→2 — the live meter moved while the ratchet held.
 *
 * Assertions are STRUCTURAL only (counts, stages, deckKeys from curriculum.json) — never card
 * or answer text (MC waves rewrite copy). Deck size premise (>3) guarantees three fails cannot
 * reach the done screen, so its "Review again" homonym (:3563) can never coexist with the
 * footer button and the exact-name locator stays unique.
 *
 * v1.70 re-validation: settings gains landQuestions:false (no landing MC, no unrigged
 * land-mc-* draws — "no other draws occur here" stays true), and clearLandCard() runs after
 * land(). The v1.68 question-first landing card (.ng-landcard) renders on every landing; the
 * DSL's hermetic font-abort makes prescript.js drop the neural stylesheet (link onerror on
 * the aborted fonts @import), so under the harness the card renders UNSTYLED over the
 * explorer's top rows and intercepts the [data-lesson="Mount|Bottom"] click. Probe-verified
 * NOT user-facing: with CSS applied the card sits fixed at x 460-980 under the explorer's
 * z-index (8 vs 5) — real users click every row. Clearing it removes the harness-only
 * obstruction; classic-mode renderDrill still nulls _mc, so the mcNull premise is untouched.
 */

const POSITION = "Mount Top"
const KEY: string = CURRICULUM.belts[0].units[0].lessons[0].deckKey // "Mount|Bottom" — the returner's first-ever lesson
const MASTERED_N: number = new Set(
  CURRICULUM.belts[0].units.flatMap((u: any) => u.lessons.map((l: any) => l.deckKey)),
).size // 32: every distinct white lesson deck, all rec-proven by the persona

test("returner blanks on three recalls of a proven deck: stages drop, masteredCount and rec never move", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))

  const j = journey(page)
  const blob: any = lapsedReturner()
  // classic recall mode: mcActive() false → every card renders the reveal/grade footer directly
  // (no MC block, no MC rigs). The ingest merges blob.settings over defaults (:1097).
  // landQuestions:false — v1.68 landing MC off (see header).
  blob.settings = { mcMode: "classic", landQuestions: false }
  await j.boot("/", { initialState: blob })
  await j.land(POSITION) // land() rigs ai-skill/role/max-moves itself; no other draws occur here
  // drop the v1.68 landing card — harness-only obstruction over the top path rows (see header)
  await page.evaluate(() => (window as any).__neural.clearLandCard())

  // ── PREMISE: the returner's portfolio is fully minted — N mastered decks, target deck proven. ──
  const start = await page.evaluate((k) => {
    const a = (window as any).__neural
    return { mastered: a.masteredCount(), rec: a.rec[k] || 0 }
  }, KEY)
  expect(start.mastered, "seed sanity: every white lesson deck counts as mastered at boot").toBe(MASTERED_N)
  expect(start.rec, "seed sanity: the first-lesson deck is recall-proven (rec === 3)").toBe(3)

  // ── REAL-UI ENTRY: open the explorer, click the first lesson's row (openLessonStudy :2444 →
  // studyFromSession :1957). toggleExplorer is the DSL-sanctioned internal for a canvas-adjacent
  // overlay; the lesson ROW click is the real user surface. advance(800) settles the prezi flight. ──
  await page.evaluate(() => (window as any).__neural.toggleExplorer())
  const row = page.locator(`[data-lesson="${KEY}"]`)
  await expect(row, "the first lesson's explorer row is visible").toBeVisible()
  await row.click()
  await j.advance(800)

  const entry = await page.evaluate(() => {
    const a = (window as any).__neural
    return {
      key: a._deckInfo?.key,
      inSession: !!a._inSession,
      mcNull: a._mc == null, // classic mode: renderDrill nulls _mc (:3630) and never rebuilds it
      deckLen: (a.deck || []).length,
      deckIdx: a.deckIdx,
    }
  })
  expect(entry.key, "the drill context is the clicked lesson's deck").toBe(KEY)
  expect(entry.inSession, "the lesson row opened a real study session").toBe(true)
  expect(entry.mcNull, "classic mode: no MC engine — the recall footer is the grading surface").toBe(true)
  expect(entry.deckIdx, "session starts at the first card").toBe(0)
  // >3 cards ⇒ three fails never exhaust the deck ⇒ the done-screen "Review again" homonym
  // (:3563) cannot coexist with the footer button — the exact-name locator below stays unique.
  expect(entry.deckLen, "deck premise: more cards than fails (done screen unreachable)").toBeGreaterThan(3)

  // One failed recall through the REAL footer: reveal, then "Review again" (recallGrade(false)).
  const failOnce = async () => {
    await page.locator("[data-reveal]").click()
    await page.getByRole("button", { name: "Review again", exact: true }).click()
  }
  const read = () =>
    page.evaluate((k) => {
      const a = (window as any).__neural
      return { mastered: a.masteredCount(), rec: a.rec[k] || 0, deckIdx: a.deckIdx }
    }, KEY)

  // ── BEAT A — first blank (card 0): the grade processed (deckIdx 0→1), the ratchet held. ──
  await failOnce()
  const a1 = await read()
  expect(a1.deckIdx, "fail branch ran: deckIdx advanced 0→1 (processed-grade witness)").toBe(1)
  expect(a1.rec, "failed recall never touches rec — the deck stays proven at 3").toBe(3)
  expect(a1.mastered, "masteredCount unchanged after the first blank").toBe(MASTERED_N)

  // ── BEAT B — THE TEETH (card 1): graduate the next card to proven-look stage 3, then fail it
  // via the UI. The stage MUST drop 3→2 (recallGrade(false) demonstrably executed — the live
  // meter moves) while rec and masteredCount hold (the ratchet does not). ──
  const qh = await page.evaluate((k) => {
    const a = (window as any).__neural
    const q = a.deck[a.deckIdx].q
    a._bumpStage(k, q, 3) // 0 → 3: proven-look, same stage a real recall crossing leaves behind
    return a.qhash(q) // structural handle for the stage reads — never the card text itself
  }, KEY)
  expect(
    await page.evaluate((args) => (window as any).__neural.stage[args.k][args.qh], { k: KEY, qh }),
    "witness premise: card 1 sits at stage 3 before the fail",
  ).toBe(3)
  await failOnce()
  const b1 = await page.evaluate(
    (args) => {
      const a = (window as any).__neural
      return {
        stage: (a.stage[args.k] || {})[args.qh] || 0,
        mastered: a.masteredCount(),
        rec: a.rec[args.k] || 0,
        deckIdx: a.deckIdx,
      }
    },
    { k: KEY, qh },
  )
  expect(b1.stage, "the fail DID execute: proven-look stage dropped 3→2 (stage is the live meter)").toBe(2)
  expect(b1.rec, "the same fail left rec at 3 — the ratchet never decrements").toBe(3)
  expect(b1.mastered, "masteredCount unchanged even as a proven-look card was demoted").toBe(MASTERED_N)
  expect(b1.deckIdx, "second grade processed: deckIdx 1→2").toBe(2)

  // ── BEAT C — third blank (card 2), then the PERSISTENCE half: test-mode _saveProgress is
  // synchronous, so the saved bytes already reflect the post-fail state — the ratchet is durable. ──
  await failOnce()
  const c1 = await read()
  expect(c1.deckIdx, "third grade processed: deckIdx 2→3 (still inside the deck — no done screen)").toBe(3)
  expect(c1.rec, "three blanks in a row: rec still 3").toBe(3)
  expect(c1.mastered, "three blanks in a row: masteredCount still N — the bad day un-minted nothing").toBe(MASTERED_N)

  const persisted = await page.evaluate(
    (args) => {
      const p = JSON.parse(localStorage.getItem("bjj-neural-progress") || "null")
      return {
        v: p?.v,
        rec: (p?.rec || {})[args.k],
        stage: ((p?.stage || {})[args.k] || {})[args.qh],
      }
    },
    { k: KEY, qh },
  )
  expect(persisted.v, "the persisted blob is the v2 schema").toBe(2)
  expect(persisted.stage, "the save ran AFTER the drop: the demoted stage 2 is in the saved bytes").toBe(2)
  expect(persisted.rec, "the saved bytes carry rec === 3 — a reload cannot demote the mastery either").toBe(3)

  expect(errors, "no pageerror across boot, land, the lesson entry, and all three failed recalls").toEqual([])
})
