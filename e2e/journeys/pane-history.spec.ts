import { test, expect, type Page } from "@playwright/test"
import { journey } from "../dsl"
// v1.282.0 (rulings R2, SET1-GO): written when nothing stored meant Classic recall in the sidebar; since then nothing
// stored is Auto (a new card asks multiple choice), so every journey here states the mode it was written under,
// Recall, through the DSL (`journey(page, CLASSIC)`), and keeps every assertion.
const CLASSIC = { answerMode: "classic" } as const

/**
 * THE PANE IS A HISTORY YOU CAN WALK.
 *
 * Owner's description of what the pane (left since v1.94.0) is FOR: "show history that the user can go through,
 * and it shows a question-and-answer format. It doesn't show multiple choice." And, on 16 Nov 2026 (L3, v1.293.0): "Lastrolls
 * should stop being about answering … about going through the [nodes] that were visited, not necessarily answering
 * flashcards." So a row is a PLACE now: it holds no card, and its "Practise here" opens the place in Master the game, where
 * the question-and-answer the first quote describes lives. This asserts the pane's identity, not just its pause behaviour
 * (pane-law.spec.ts covers that):
 *
 *   - one row per state the roll has visited, in order, tagged with who moved you there
 *   - a row holds no card; "Practise here" opens its place in Master the game, and under Recall the card there
 *     reads question → Reveal → answer (never options)
 *   - revealing is SEEN, not credit — the honest economy holds there too
 *   - the history survives the round boundary, because the pane no longer clears itself
 *   - EVERY roll that was played reaches the shelf, including the one-exchange roll (v1.174.0)
 *   - and the shelf repaints when a roll is filed, not one landing later (v1.174.0)
 * The row itself (its two actions, its sub line, the keys, the phone's hold) is last-rolls-places.spec.ts.
 *
 * FOUR TESTS HERE WERE RE-POINTED IN v1.293.0, none removed, each run against its mutant on dev's build before and on this
 * build after (docs/Changelog-Archive.md, v1.293.0, has the table):
 *   "a history row under Recall…"   under Recall the card asks multiple choice anyway (`_cardAsksMc`)  → "and no options anywhere in the pane" (on dev's build the same mutant was red only at the Reveal press timing out: the step read `[data-mc-opt]`, and the inline deck's options were `[data-inline-mc-opt]`)
 *   "revealing … is SEEN, not credit"         a reveal credits the card (`doReveal`)                           → "reading an answer earns no mastery"
 *   "the history survives the round ending"   the round's end shuts the drawer (`endRound`)                    → "and its two actions are still there" (before: "and still readable")
 *   "free roam files the roll it ends…"       a filed roll does not repaint Last rolls (`_closeRoll`)          → "and filed it under Previous rolls"
 *
 * Surfaces: [data-hist] [data-hist-actor] [data-hist-current] [data-hist-show] [data-hist-go] [data-past-roll];
 *           in Master the game [data-mini-q] [data-mini-reveal] [data-mini-a]
 */

// The logo is the pane opener; Last rolls owns the history surface.
const openPane = async (page: Page) => {
  await page.locator(".ng-logo").click()
  await page.locator('[data-view="history"]').click()
}
// …and a row opens its two actions on click (its own deck until v1.293.0). (v1.175.0 retired the landing chip that used to
// land here with the current row already open — "it should not open the last rolls", owner.)
const openCurrentRow = async (page: Page) => {
  await openPane(page)
  await page.locator("[data-hist-current]").click()
}
// "Practise here" on the current row: its place opens in Master the game, on its first card (the journey's player knows the
// moves the plan would ask, so the place's cards come up, not its cloze: the cloze is master-cloze.spec.ts)
const practiseHere = async (page: Page, j: ReturnType<typeof journey>) => {
  await j.knowsPlanMoves()
  await openCurrentRow(page)
  await expect(page.locator(".ng-drill [data-mini-deck]"), "the row itself holds no card").toHaveCount(0)
  await page.locator("[data-hist-go]").click()
  await expect(page.locator("[data-practice-page]"), "Master the game is open").toHaveCount(1)
  await expect(page.locator("[data-mini-q]:visible"), "the place's first card is up").toHaveCount(1, { timeout: 30_000 })
}

test("the pane lists every state the roll has visited, in order", async ({ page }) => {
  const j = journey(page, CLASSIC)
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

// v1.282.0: written when a history row was always front and back. Since then every inline deck asks the answer mode
// (rulings R2; Auto asks a new card as multiple choice: answer-mode.spec.ts "Last rolls"), so this journey states the mode
// it was written under, Recall, and keeps every assertion.
// v1.293.0 (L3): the row holds no card; the same reading, question → Reveal → answer, is made where "Practise here" opens
// the place, in Master the game. Every assertion is kept, on that card; the options' own handle there is
// `data-practice-mc-opt`, asserted beside the study view's `data-mc-opt` the journey always read.
test("a history row under Recall reads question → reveal → answer, never multiple choice", async ({ page }) => {
  const j = journey(page, CLASSIC)
  await j.boot("/")
  await j.answerMode("classic")
  await j.land("Mount Top")
  await practiseHere(page, j)

  const deck = page.locator("[data-mini-deck]:visible").first()
  await expect(deck, "the current state's card is open, in Master the game").toBeVisible()
  await expect(deck.locator("[data-mini-q]"), "a question").toBeVisible()
  await expect(page.locator(".ng-drill [data-mini-a]"), "answer hidden until asked for").toHaveCount(0)
  await expect(
    page.locator(".ng-drill [data-mc-opt], .ng-drill [data-practice-mc-opt]"),
    "and no options anywhere in the pane",
  ).toHaveCount(0)

  await page.locator("[data-master-bar] [data-mini-reveal]").click()
  await expect(page.locator(".ng-drill [data-mini-a]"), "the answer appears on reveal").toBeVisible()
  await expect(page.locator(".ng-drill [data-mc-opt], .ng-drill [data-practice-mc-opt]"), "still no multiple choice").toHaveCount(0)
})

// v1.293.0 (L3): the reveal is made where "Practise here" opens the place, in Master the game; the two assertions are kept,
// on the deck of the card that was revealed (read from the app, so a place that opens another of its decks is still measured)
test("revealing in the pane is SEEN, not credit", async ({ page }) => {
  const j = journey(page, CLASSIC)
  await j.boot("/")
  await j.land("Mount Top")
  await practiseHere(page, j)

  const before = await page.evaluate(() => {
    const a = (window as any).__neural
    const k = a._session.keys[a._session.idx]
    return { prep: (a.prep && a.prep[k]) || 0, score: a.gameScore().score, key: k, srs: JSON.stringify(a.srs) }
  })
  expect(before.key, "premise: the open card is the place's own").toBe("Mount|Top")

  await page.locator("[data-master-bar] [data-mini-reveal]").click()
  await expect(page.locator(".ng-drill [data-mini-a]"), "premise: the answer is shown").toBeVisible()

  const after = await page.evaluate((k) => {
    const a = (window as any).__neural
    return { prep: (a.prep && a.prep[k as string]) || 0, score: a.gameScore().score, srs: JSON.stringify(a.srs) }
  }, before.key)
  expect(after.prep, "reading an answer earns no mastery").toBe(before.prep)
  expect(after.score, "and moves no belt").toBe(before.score)
  expect(after.srs, "and schedules nothing").toBe(before.srs)
})

test("the history survives the round ending", async ({ page }) => {
  const j = journey(page, CLASSIC)
  await j.boot("/")
  await j.land("Mount Top")
  await openCurrentRow(page)
  await expect(page.locator("[data-hist-show]"), "premise: the row's two actions are shown").toBeVisible()
  const before = await page.locator("[data-hist]").count()

  // endRound is the seam that used to hide the pane; time is frozen while it is open
  await page.evaluate(() => (window as any).__neural.endRound("reset"))
  expect(await page.locator("[data-hist]").count(), "rows still there").toBe(before)
  // v1.293.0 (L3): "and still readable" read the row's open card; the row holds two actions now, and they are what stays
  await expect(page.locator("[data-hist-show]"), "and its two actions are still there").toBeVisible()
  await expect(page.locator("[data-hist-go]"), "both of them").toBeVisible()
})

test("Last rolls carries the roll rows — and explains itself when nothing rolled yet", async ({
  page,
}) => {
  const j = journey(page, CLASSIC)
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
 * A SHORT FINISHED ROLL IS A ROLL (v1.174.0).
 *
 * Owner: "last rolls is not updating as i click outcomes and continue my roll … it seems stuck".
 * `_closeRoll`'s predicate used to demand `rollLog.length > 1`, so the ordinary short roll — you
 * attack from the state you opened in and finish it, or get caught there — left NO row anywhere:
 * measured on the built bundle, 5 of 6 rolls in one session and 2 of 2 in another vanished.
 *
 * Submission entry now visits its own state before the explicit Finish action; both landings
 * belong in the archive. The pane stays CLOSED across the restart on purpose: pane law holds the clock, and the archive
 * rides `startRoll`, which is a timer. Opening it is the reader's job, at the end.
 */
test("a short roll archives both the opening position and the submission it finishes", async ({ page }) => {
  const j = journey(page, CLASSIC)
  await j.boot("/")
  await j.land("Mount Top")

  const sub = await page.evaluate(() => {
    const a = (window as any).__neural
    for (const i of a.optionIdxs || []) if (a.nodes[i].ty === "submissions") return a.nodes[i].t
    return null
  })
  expect(sub, "premise: the opening hand offers a submission to finish with").not.toBeNull()

  await j.rig("resolve", [0.01]) // the explicit Finish lands → endRound("win")
  await j.rig("outcome", [0.01])
  // ...and the roll that STARTS after it draws nothing unrigged, so the restart cannot flake
  await j.rig("start-pos", [0.5])
  await j.rig("role", [0])
  await j.rig("ai-skill", [0.5])
  await j.rig("max-moves", [0.5])
  await j.pick(sub as string)
  await j.nextHand()
  expect(await page.evaluate(() => {
    const a = (window as any).__neural
    return a.nodes[a.currentPos].t
  })).toBe(sub)
  const finish = page.locator('[data-choice-group="you"] [data-choice-action="finish"]')
  await expect(finish).toHaveCount(1)
  await finish.click() // own-card click commits Finish

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
        ? { states: (p.log || []).length, keys: (p.log || []).map((r: any) => r.key), outcome: p.outcome, finish: p.finish && p.finish.name, beat: arch[arch.length - 1] || null }
        : null
    })
  }
  expect(past, "the roll that just ended is on the shelf").not.toBeNull()
  expect(past.states, "both visited states are archived").toBe(2)
  expect(past.keys).toEqual(["Mount|Top", sub + "|Attacker"])
  expect(past.outcome, "filed with the verdict it ended on").toBe("win")
  expect(past.finish, "and the submission that finished it").toBe(sub)
  // §6.6: the archive says what it did, so "filed nothing" can never read like "never looked"
  expect(past.beat, "the archive emits a beat carrying its own count").toMatchObject({ states: 2, outcome: "win" })

  await page.evaluate(() => (window as any).__neural.openPane("history"))
  const row = page.locator("[data-past-roll]")
  await expect(row, "one row under Previous rolls").toHaveCount(1)
  // The row names the finish and counts both visited states.
  await expect(row).toContainText("2 states ·")
  const title = (await row.innerText()).split("\n")[0]
  expect(title, "the row is titled start → finish").toBe("Mount → " + sub)
  expect(await page.locator("[data-replay-roll]").first().getAttribute("aria-label")).toBe(
    "Replay Mount → " + sub,
  )
})

/**
 * FREE ROAM FILES THE ROLL IT ENDS — AND THE SHELF REPAINTS ON THE SPOT (v1.174.0).
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
  const j = journey(page, CLASSIC)
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
  // v1.293.0 (L3): a row is opened first, so "what hung off the rows goes with them" is a claim about something on screen
  // (until now no row was opened here, and the last assertion read an empty page as its proof)
  await page.locator("[data-hist-current]").click()
  await expect(page.locator("[data-hist-show]"), "premise: the latest row's two actions are shown").toBeVisible()

  // one press on the bare map is free roam (BGCLOSE, v1.294.0: it was a ladder of two, the first closing the card only;
  // this called the function twice for it. roll-card.spec.ts and map-press-closes-page.spec.ts pin the one press.)
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
  await expect(page.locator("[data-hist-show], [data-hist-go]"), "and so are the two actions that hung off them").toHaveCount(0)
  await expect(page.locator("[data-mini-deck]"), "and no card").toHaveCount(0)
})

// Preserve the one-state archive regression guard: submission entry from a position now
// visits two states, but a roll opened directly in a submission can still finish in one.
test("a direct submission finish archives its one-state roll", async ({ page }) => {
  const j = journey(page, CLASSIC)
  const title = "Triangle Choke from Triangle Control"
  const key = title + "|Attacker"
  await j.boot("/Submissions/Triangle-Choke/from-Triangle-Control/Attacker")
  await j.advance(4000)
  await expect(page.locator('[data-reader-ready="true"]')).toBeVisible()
  expect(await page.evaluate(() => (window as any).__neural.rollLog.map((r: any) => r.key))).toEqual([key])
  expect(await page.evaluate(() => { const a = (window as any).__neural; return { paused: a.paused, intent: a._readerIntent, clock: a._decision?.remaining ?? null } })).toEqual({ paused: true, intent: true, clock: null })
  await j.rig("resolve", [0.01])
  await j.rig("outcome", [0.01])
  await j.rig("start-pos", [0.5])
  await j.rig("role", [0])
  await j.rig("ai-skill", [0.5])
  await j.rig("max-moves", [0.5])
  const finish = page.locator('[data-choice-group="you"] [data-choice-action="finish"]')
  await expect(finish).toHaveCount(1)
  await j.clickByMouse('[data-choice-group="you"] [data-choice-action="finish"]', "Finish is the first deliberate game action")
  expect(await page.evaluate(() => (window as any).__neural.rollLog.map((r: any) => r.key))).toEqual([key])
  await j.advanceUntil("roll_archived", 20000, 500)
  const past = await page.evaluate(() => {
    const a = (window as any).__neural, p = a._pastRolls[0]
    return { keys: p.log.map((r: any) => r.key), outcome: p.outcome,
      finish: p.finish.name, beat: a.beats.find((b: any) => b.beat === "roll_archived") }
  })
  expect(past.keys).toEqual([key])
  expect(past.outcome).toBe("win")
  expect(past.finish).toBe(title)
  expect(past.beat).toMatchObject({states: 1, outcome: "win"})
  await page.evaluate(() => (window as any).__neural.openPane("history"))
  const row = page.locator("[data-past-roll]")
  await expect(row).toHaveCount(1)
  await expect(row).toContainText("1 state ·")
})
