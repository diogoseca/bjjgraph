import { test, expect } from "@playwright/test"
import { journey } from "../dsl"

/**
 * THE PANE IS A HISTORY YOU CAN WALK, IN Q&A.
 *
 * Owner's description of what the pane (left since v1.94.0) is FOR: "show history that the user can go through,
 * and it shows a question-and-answer format. It doesn't show multiple choice." So this asserts the
 * pane's identity, not just its pause behaviour (pane-law.spec.ts covers that):
 *
 *   - one row per state the roll has visited, in order, tagged with who moved you there
 *   - each row opens a card that reads question → Reveal → answer (never options)
 *   - revealing is SEEN, not credit — the honest economy holds here too
 *   - the history survives the round boundary, because the pane no longer clears itself
 *
 * Surfaces: [data-hist] [data-hist-actor] [data-hist-current] [data-mini-deck]
 *           [data-mini-q] [data-mini-reveal] [data-mini-a]
 */

// the pill is deleted (v1.99.0) — "study this state" (openHomeToLatest, which lands on
// History with the current row's deck open) survives on the landing card's familiarity chip
const openPane = (page: any) => page.locator("[data-land-count]").click()

test("the pane lists every state the roll has visited, in order", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await openPane(page)

  const rows = page.locator("[data-hist]")
  expect(await rows.count(), "the landing state is the first entry").toBeGreaterThanOrEqual(1)
  await expect(page.locator("[data-hist-current]"), "and the current state is marked").toHaveCount(
    1,
  )

  // advance the roll and the history grows with it, keeping trail order
  await page.locator(".ng-explorer-close").click() // close → the roll resumes (pane law)
  const t = await page.evaluate(() => {
    const a = (window as any).__neural
    for (const i of a.optionIdxs || []) if (a.nodes[i].ty === "transitions") return a.nodes[i].t
    return (a.nodes[(a.optionIdxs || [])[0]] || {}).t || ""
  })
  await j.rig("resolve", [0.01])
  await j.rig("outcome", [0.01])
  await j.pick(t)
  await j.nextHand()

  await openPane(page)
  const keys = await page
    .locator("[data-hist]")
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-hist")))
  const trail = await j.rollTrail()
  expect(keys.length, "one row per visited state").toBe(trail.length)
  expect(await page.locator("[data-hist-actor]").first().getAttribute("data-hist-actor")).toBe(
    "start",
  )
})

test("a history row reads question → reveal → answer, never multiple choice", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await openPane(page)

  const deck = page.locator("[data-mini-deck]").first()
  await expect(deck, "the current state's card is open in the pane").toBeVisible()
  await expect(deck.locator("[data-mini-q]"), "a question").toBeVisible()
  await expect(deck.locator("[data-mini-a]"), "answer hidden until asked for").toHaveCount(0)
  await expect(
    page.locator(".ng-drill [data-mc-opt]"),
    "and no options anywhere in the pane",
  ).toHaveCount(0)

  await deck.locator("[data-mini-reveal]").click()
  await expect(deck.locator("[data-mini-a]"), "the answer appears on reveal").toBeVisible()
  await expect(page.locator(".ng-drill [data-mc-opt]"), "still no multiple choice").toHaveCount(0)
})

test("revealing in the pane is SEEN, not credit", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  const before = await page.evaluate(() => {
    const a = (window as any).__neural
    const k = a.deckKeyFor(a.nodes[a.currentPos]).key
    return { prep: (a.prep && a.prep[k]) || 0, score: a.gameScore().score, key: k }
  })

  await openPane(page)
  await page.locator("[data-mini-deck]").first().locator("[data-mini-reveal]").click()

  const after = await page.evaluate((k) => {
    const a = (window as any).__neural
    return { prep: (a.prep && a.prep[k as string]) || 0, score: a.gameScore().score }
  }, before.key)
  expect(after.prep, "reading an answer earns no mastery").toBe(before.prep)
  expect(after.score, "and moves no belt").toBe(before.score)
})

test("the history survives the round ending", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await openPane(page)
  const before = await page.locator("[data-hist]").count()

  // endRound is the seam that used to hide the pane; time is frozen while it is open
  await page.evaluate(() => (window as any).__neural.endRound("reset"))
  expect(await page.locator("[data-hist]").count(), "rows still there").toBe(before)
  await expect(page.locator("[data-mini-deck]").first(), "and still readable").toBeVisible()
})

test("Last rolls carries the roll rows — and explains itself when nothing rolled yet", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")

  // BEFORE any roll this session: the tab must explain the void, not render a bare body.
  // Roll history has NEVER persisted across reloads (rollLog/_pastRolls are in-memory) —
  // after the v1.95 stats move stripped the tab's other furniture, that unexplained void
  // read as "my history got deleted" (owner, v1.95.3).
  await page.evaluate(() => (window as any).__neural.openPane("history"))
  await expect(page.locator("[data-hist-empty]"), "the empty case names itself").toBeVisible()
  await expect(page.locator("[data-hist-empty]")).toContainText("No rolls yet")
  await expect(page.locator("[data-hist]")).toHaveCount(0)
  await page.evaluate(() => (window as any).__neural.setDeckOpen(false))

  // WITH a played roll: rows render exactly as History always did — the "Last rolls"
  // rename is display-only (regression proof for the owner's report)
  await j.land("Mount Top")
  await openPane(page)
  expect(await page.locator("[data-hist]").count(), "one row per visited state").toBeGreaterThanOrEqual(1)
  await expect(page.locator("[data-hist-current]"), "the LATEST row is marked").toHaveCount(1)
  await expect(page.locator("[data-hist-empty]"), "and the empty line is gone").toHaveCount(0)
})
