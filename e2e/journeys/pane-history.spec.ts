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
 *   - EVERY roll that was played reaches the shelf, including the one-exchange roll (v1.171.0)
 *   - and the shelf repaints when a roll is filed, not one landing later (v1.171.0)
 *
 * Surfaces: [data-hist] [data-hist-actor] [data-hist-current] [data-mini-deck]
 *           [data-mini-q] [data-mini-reveal] [data-mini-a] [data-past-roll]
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

/**
 * THE ONE-EXCHANGE ROLL IS A ROLL (v1.171.0).
 *
 * Owner: "last rolls is not updating as i click outcomes and continue my roll … it seems stuck".
 * `_closeRoll`'s predicate used to demand `rollLog.length > 1`, so the ordinary short roll — you
 * attack from the state you opened in and finish it, or get caught there — left NO row anywhere:
 * measured on the built bundle, 5 of 6 rolls in one session and 2 of 2 in another vanished.
 *
 * The pane stays CLOSED across the restart on purpose: pane law holds the clock, and the archive
 * rides `startRoll`, which is a timer. Opening it is the reader's job, at the end.
 */
test("a roll that ends on its first exchange still becomes a past roll", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  const sub = await page.evaluate(() => {
    const a = (window as any).__neural
    for (const i of a.optionIdxs || []) if (a.nodes[i].ty === "submissions") return a.nodes[i].t
    return null
  })
  expect(sub, "premise: the opening hand offers a submission to finish with").not.toBeNull()

  await j.rig("resolve", [0.01]) // the attempt lands → endRound("win") on the first exchange
  await j.rig("outcome", [0.01])
  // ...and the roll that STARTS after it draws nothing unrigged, so the restart cannot flake
  await j.rig("start-pos", [0.5])
  await j.rig("role", [0])
  await j.rig("ai-skill", [0.5])
  await j.rig("max-moves", [0.5])
  await j.pick(sub as string)

  // pump the verdict hold (6.6s) and the 0.8s hand-off that runs startRoll, which is where a
  // finished roll is filed
  let past: any = null
  for (let n = 0; n < 40 && !past; n++) {
    await j.advance(500)
    past = await page.evaluate(() => {
      const a = (window as any).__neural
      const p = (a._pastRolls || [])[0]
      const arch = (a.beats || []).filter((b: any) => b.beat === "roll_archived")
      return p
        ? { states: (p.log || []).length, outcome: p.outcome, finish: p.finish && p.finish.name, beat: arch[arch.length - 1] || null }
        : null
    })
  }
  expect(past, "the roll that just ended is on the shelf").not.toBeNull()
  expect(past.states, "and it is the one-state roll we played").toBe(1)
  expect(past.outcome, "filed with the verdict it ended on").toBe("win")
  expect(past.finish, "and the submission that finished it").toBe(sub)
  // §6.6: the archive says what it did, so "filed nothing" can never read like "never looked"
  expect(past.beat, "the archive emits a beat carrying its own count").toMatchObject({ states: 1, outcome: "win" })

  await page.evaluate(() => (window as any).__neural.openPane("history"))
  const row = page.locator("[data-past-roll]")
  await expect(row, "one row under Previous rolls").toHaveCount(1)
  // a one-state roll went somewhere: the row names the FINISH, never "Mount → Mount"
  await expect(row, "and says so in the singular").toContainText("1 state ·")
  const title = (await row.innerText()).split("\n")[0]
  expect(title, "the row is titled start → finish").toBe("Mount → " + sub)
  expect(await page.locator("[data-replay-roll]").first().getAttribute("aria-label")).toBe(
    "Replay Mount → " + sub,
  )
})

/**
 * FREE ROAM FILES THE ROLL IT ENDS — AND THE SHELF REPAINTS ON THE SPOT (v1.171.0).
 *
 * The other half of the owner's "it seems stuck". `rollLog` and `_pastRolls` ARE what this tab
 * draws, and the app's only repaint used to be `buildDrillPanel` — i.e. the NEXT LANDING. Roam
 * has no next landing, so a background double-tap with the tab open left the finished roll's rows
 * frozen on screen and the roll it had just archived invisible, indefinitely.
 *
 * No `advance()` after the taps, deliberately: any pumped frame could land something and repaint
 * for the wrong reason, which is exactly the false pass this test exists to refuse.
 */
test("free roam files the roll it ends, and Last rolls repaints without waiting for a landing", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  // one real exchange first, so this is unambiguously a played roll (and a multi-state one, so
  // the assertion below is about the REPAINT and not about the archive predicate)
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
  const rows = await page.locator("[data-hist]").count()
  expect(rows, "premise: the live roll's states are on screen").toBeGreaterThan(1)
  expect(await page.locator("[data-past-roll]").count(), "premise: the shelf is empty").toBe(0)

  // tap 1 closes the landing card, tap 2 is free roam (the ladder pinned by roll-card.spec.ts)
  await page.evaluate(() => (window as any).__neural._tapBackground())
  await page.evaluate(() => (window as any).__neural._tapBackground())

  expect(
    await page.evaluate(() => ((window as any).__neural.rollLog || []).length),
    "roam ended the roll",
  ).toBe(0)
  await expect(page.locator("[data-past-roll]"), "and filed it under Previous rolls").toHaveCount(1)
  await expect(
    page.locator("[data-hist]"),
    "the rows of a roll that no longer exists are gone from This roll",
  ).toHaveCount(0)
  await expect(page.locator("[data-mini-deck]"), "and so is the card that hung off them").toHaveCount(0)
})
