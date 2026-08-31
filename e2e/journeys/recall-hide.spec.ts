import { test, expect, type Page } from "@playwright/test"
import { journey } from "../dsl"

type W = Window & { __neural: any }

/**
 * A REVEALED ANSWER CAN BE PUT BACK, AND SPACE IS THE HANDLE.
 *
 * `_recallBlock` could only ever go one way: Show answer → [Review again | Got it]. Once the
 * answer was on screen the question was gone, so the one thing a person actually does with a
 * flashcard — glance, cover it, try again before committing to a grade — had no gesture. Ported
 * from the abandoned `journey/defend-wt` (v1.91.0), which is the only place either affordance was
 * ever written.
 *
 * TWO PIECES:
 *   · `Hide` re-conceals a revealed answer and brings `Show answer` back. All four buttons exist
 *     from the start and a `paint()` shows the pair the state calls for, so revealing is no
 *     longer destructive to the row.
 *   · SPACE toggles the live block. The app publishes it as `this._recall`, the way `this._mc`
 *     is published for A/B/C.
 *
 * `this._recall` IS A SINGLE SLOT WITH MANY WRITERS (§6.5), and this file pins its lifetime as
 * hard as its behaviour: it clears on grade, and Space refuses a block that has left the DOM.
 * That second rule is DERIVED (`wrap.isConnected`), never latched — the branch this came from
 * latched it and would have toggled a card the player could no longer see.
 *
 * Rails: __neural._recall · .settings.recallInPlay · .stage
 * Surface: [data-land-recall] / [data-land-reveal] / [data-land-hide] / [data-land-answer]
 *
 * Mutants:
 *   M1 — `Hide` is not rendered                                     → journey 1
 *   M2 — `Hide` shows the answer instead of concealing it           → journey 1
 *   M3 — Space does not toggle (`_recall` never published)          → journey 2
 *   M4 — grading leaves `_recall` pointing at the graded block      → journey 3
 *   M5 — the `isConnected` liveness check is dropped                SURVIVES — EQUIVALENT
 *
 * M5 SURVIVES AND IS NOT A HOLE. `_recallLive` refuses a torn-down block by two independent
 * clauses, and for the only REACHABLE surface the other one gets there first: `_landHidden()`
 * leads with `!this._landEl`, so a cleared landing card is already refused without consulting
 * `isConnected`. The liveness clause earns its keep only on `_recallBlock`'s other caller,
 * `_renderNodeQuestion`, which §6.8 records as unreachable (re-derived while writing this:
 * `_dossierIdx` is assigned null at four sites and a node index at none). Journey 4 therefore
 * pins the BEHAVIOUR — Space never moves a block that has left the screen — without being able
 * to say which clause delivered it. Do not cite it for `isConnected`.
 *
 * NON-KILLS, recorded so nobody reads this file as covering them (§6.3):
 *   · the `"node"` surface. `_recallBlock`'s other caller renders the same block from the same
 *     code, but no journey here drives it, so this file is evidence about `"land"` only.
 *   · Space's `!this._detailCtx` gate is UNCHANGED and deliberately so — see the app comment.
 *     Nothing here fails if that gate is relaxed; there is simply no reachable recall block
 *     behind an open option sheet on this build to relax it for.
 */

/** Land, then force the proven-card recall rung the badge unlocks (recall-badge.spec.ts's idiom). */
async function landOnRecall(j: ReturnType<typeof journey>, page: Page) {
  await j.boot("/")
  await j.hydrateAll()
  await j.land("Mount Top")
  await page.evaluate(() => {
    const a = (window as W).__neural
    const key = a.deckKeyFor(a.nodes[a.currentPos]).key
    const cards = a._cardsOf(a.flashcards.decks[key])
    a.stage[key] = { [a.qhash(cards[0].q)]: 3 }
    const today = a._epochDay()
    a.srs[key] = { [a.qhash(cards[0].q)]: [today - 1, 3, today - 4] }
    a.settings.recallInPlay = true
    a._landQ = null
    a.renderLandCard(a.nodes[a.currentPos], "land", null)
  })
  await page.waitForTimeout(300)
  await expect(page.locator("[data-land-recall]"), "the landing card is asking as recall").toBeVisible()
}

const shown = (page: Page, sel: string) =>
  page.evaluate((s) => {
    const el = document.querySelector(s as string) as HTMLElement
    return !!el && getComputedStyle(el).display !== "none"
  }, sel)

/** Press Space as the page, not as a focused button — the focused-control rule owns that case. */
const pressSpace = async (page: Page) => {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  await page.keyboard.press("Space")
  await page.waitForTimeout(80)
}

// ── 1. Hide puts the answer back ───────────────────────────────────────────────────────────────
test("a revealed answer can be hidden again, and Show comes back @curated", async ({ page }) => {
  const j = journey(page)
  await landOnRecall(j, page)

  expect(await shown(page, "[data-land-answer]"), "starts concealed").toBe(false)
  await j.clickByMouse("[data-land-reveal]", "Show answer")
  expect(await shown(page, "[data-land-answer]"), "reveal shows it").toBe(true)

  // M1: no Hide button at all. M2: Hide that does not conceal.
  await expect(page.locator("[data-land-hide]"), "Hide is offered once revealed").toBeVisible()
  await j.clickByMouse("[data-land-hide]", "Hide")
  expect(await shown(page, "[data-land-answer]"), "Hide puts it back").toBe(false)
  expect(await shown(page, "[data-land-reveal]"), "and Show answer returns").toBe(true)

  // hiding is not grading: the question is still live and unanswered
  expect(
    await page.evaluate(() => !!((window as W).__neural._landQ || {}).answered),
    "covering the answer graded nothing",
  ).toBe(false)
})

// ── 2. Space toggles it ────────────────────────────────────────────────────────────────────────
test("Space reveals and conceals the live recall block @curated", async ({ page }) => {
  const j = journey(page)
  await landOnRecall(j, page)

  expect(
    await page.evaluate(() => !!(window as W).__neural._recall),
    "the block published itself as the live recall handle",
  ).toBe(true)

  // M3: without the handle (or the key branch) neither press moves anything.
  await pressSpace(page)
  expect(await shown(page, "[data-land-answer]"), "Space revealed").toBe(true)
  await pressSpace(page)
  expect(await shown(page, "[data-land-answer]"), "Space concealed").toBe(false)
})

// ── 3. grading gives the handle up ─────────────────────────────────────────────────────────────
test("a graded block releases Space", async ({ page }) => {
  const j = journey(page)
  await landOnRecall(j, page)

  await j.clickByMouse("[data-land-reveal]", "Show answer")
  await j.clickByMouse("[data-land-got]", "Got it")
  await page.waitForTimeout(150)

  // M4: a stale handle means Space keeps toggling a question already paid for.
  expect(
    await page.evaluate(() => !!(window as W).__neural._recall),
    "the handle is released on grade",
  ).toBe(false)
})

// ── 4. the handle can never point at a block that has left the screen ──────────────────────────
test("Space refuses a recall block that is no longer in the DOM", async ({ page }) => {
  const j = journey(page)
  await landOnRecall(j, page)

  await pressSpace(page)
  expect(await shown(page, "[data-land-answer]"), "revealed while it is on screen").toBe(true)

  // tear the card down the way the app does, WITHOUT grading — the handle survives by design
  await page.evaluate(() => (window as W).__neural.clearLandCard())
  expect(
    await page.evaluate(() => {
      const r = (window as W).__neural._recall
      return !!(r && r.wrap && r.wrap.isConnected)
    }),
    "the block is gone from the document",
  ).toBe(false)

  // M5, asserted as the DIFFERENTIAL rather than as "it did not crash" — toggling a detached
  // node throws nothing, so a liveness check that was deleted would sail past any liveness-free
  // assertion here. What the rule actually owes is that the block's OWN state does not move.
  const before = await page.evaluate(() => (window as W).__neural._recall.revealed)
  expect(before, "the detached block is still holding its revealed state").toBe(true)
  await pressSpace(page)
  expect(
    await page.evaluate(() => (window as W).__neural._recall.revealed),
    "Space left the detached block exactly as it was",
  ).toBe(before)
})
