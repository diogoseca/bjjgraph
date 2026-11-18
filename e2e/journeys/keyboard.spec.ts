import { expect, test, type Page } from "@playwright/test"
import { journey } from "../dsl"

/**
 * THE KEYBOARD, AS A PRODUCT SURFACE.
 *
 * The owner's decision was that shortcuts stay in Settings rather than getting their own icon —
 * which makes the Shortcuts tab the ONLY place they are documented, so it had better be true.
 * This spec asserts every key it advertises actually does what it says, and that the two digit
 * families never collide: A–C answer the live question, 1–9 execute, shifted digits do nothing.
 * v1.230.0 reverses the v1.218.1/v1.220.0 Inspect shortcuts and wrapper.
 *
 * Handler: neural/src/app.src.jsx _onKey. Legend: Settings → Shortcuts.
 */

const paused = (page: Page) => page.evaluate(() => !!(window as any).__neural.paused)
/** the option sheet's panel never leaves the DOM (it fades to opacity 0), so ask the app */
const sheetOpen = (page: Page) => page.evaluate(() => !!(window as any).__neural._detailCtx)

/** Master the game's corridor (the Path's until v1.287.0, SET1 slice B), opened by its row (the DSL's one door). */
const openChallenges = async (page: Page) => {
  await journey(page).openCorridor({ allBelts: false })
  await expect(page.locator(".ng-track-card").first()).toBeVisible()
}

/** Visible corridor lesson rows whose decks carry at least `min` RESIDENT cards, in ladder order, read off the DOM (a collapsed
 *  belt is `display:none`, so `offsetParent` is the render's answer). Until v1.287.0 this read the Path's own row registry
 *  (`_lessonRows`), which left with the Path's inline decks. */
const lessonRows = (page: Page, min = 2): Promise<{ key: string }[]> =>
  page.evaluate((floor: number) => {
    const app = (window as any).__neural
    const rows: { key: string }[] = []
    for (const el of document.querySelectorAll(".ng-challenge-lesson[data-lesson]")) {
      if ((el as HTMLElement).offsetParent === null) continue
      const key = el.getAttribute("data-lesson")!
      const cards = app._cardsOf(((app.flashcards || {}).decks || {})[key]) || []
      if (cards.length >= floor) rows.push({ key })
    }
    return rows
  }, min)

test("A-C answer the live question; shifted digits leave it untouched", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  // the landing block mounts once its distractor pool is resident (v1.80.4)
  const mc = await j.landQuestion()
  expect(mc, "a live landing question").toBeTruthy()
  // U47 d: letters are inert while the question asks (covered-card pins that); take it up FROM THE
  // KEYBOARD — Tab to Answer for Points, then Enter — and the letters answer it.
  let reached = false
  for (let i = 0; i < 200 && !reached; i++) {
    await page.keyboard.press("Tab")
    reached = await page.evaluate(() => !!document.activeElement?.matches("[data-land-ask-go]"))
  }
  expect(reached, "Tab reaches Answer for Points").toBe(true)
  await page.keyboard.press("Enter")
  expect(await page.evaluate(() => (window as any).__neural._landAsk), "Enter on Answer for Points takes the question up").toBe(false)

  await page.keyboard.press("Shift+Digit1")
  await expect(page.locator("[data-go], [data-choice-inspect]")).toHaveCount(0)
  expect((await j.beats()).filter((b) => b.beat === "land_q_answered").length).toBe(0)
  expect((await j.beats()).filter((b) => b.beat === "commit").length).toBe(0)
  await page.keyboard.press("abc"[mc!.correct])
  const answered1 = (await j.beats()).filter((b) => b.beat === "land_q_answered")
  expect(answered1.length, "the letter answered it").toBe(1)
  expect((answered1[0] as any).correct).toBe(true)
})

test("a letter beyond the option count is ignored, not a crash", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  const n = (await j.landQuestion())?.n || 0
  expect(n).toBeGreaterThan(1)
  await j.openQuestion() // U47 d: an out-of-range letter is tested against a shown, answerable question
  const beyond = "abcde"[n] // one past the last real option
  if (beyond) {
    await page.keyboard.press(beyond)
    expect(
      (await j.beats()).filter((b) => b.beat === "land_q_answered").length,
      "out-of-range letters do nothing",
    ).toBe(0)
  }
  // and the block is still answerable afterwards
  const mc = await page.evaluate(() => (window as any).__neural._mc)
  await page.keyboard.press("abcd"[mc.correct])
  await j.expectBeat("land_q_answered")
})

test("Space toggles the roll; Esc unwinds one layer at a time", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  expect(await paused(page)).toBe(false)

  // v1.134.0: the pause toggle is retired with the transport — the game is turn-based and the
  // question clock is deliberately un-pausable. Space must NOT flip anything on the bare board.
  await page.keyboard.press("Space")
  expect(await paused(page), "Space no longer pauses").toBe(false)

  // A shifted digit leaves the open pane alone. Escape still owns the top live surface.
  await page.locator(".ng-logo").click()
  await page.keyboard.press("Shift+Digit1")
  await expect(page.locator("[data-go]")).toHaveCount(0)
  expect(await sheetOpen(page)).toBe(false)
  expect(await page.evaluate(() => !!(window as any).__neural.deckShown)).toBe(true)
  await page.keyboard.press("Escape")
  expect(await page.evaluate(() => !!(window as any).__neural.deckShown)).toBe(false)

})

test("slash opens the explorer and stops the game", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  await page.keyboard.press("/")
  expect(
    await page.evaluate(() => (window as any).__neural.explorerRef.current.style.display),
    "explorer open",
  ).toBe("flex")
  expect(await paused(page), "reading stops the game, like every reading surface").toBe(true)

  await page.keyboard.press("Escape")
  expect(
    await page.evaluate(() => (window as any).__neural.explorerRef.current.style.display),
  ).toBe("none")
  expect(await paused(page), "and closing it resumes").toBe(false)
})

test("the Shortcuts tab documents the keys that exist", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  await page.evaluate(() => (window as any).__neural.openSettings("shortcuts"))
  const legend = (
    (await page.locator(".ng-modal, [role=dialog], body").last().textContent()) || ""
  ).toLowerCase()
  // A/B/C since v1.146.0 — MC is three options wide. NON-KILL, recorded so nobody reads this
  // as coverage: the haystack is the whole lowercased modal, so a single letter matches
  // incidentally and this loop survives a mutant that drops the row entirely. The real gate
  // on the count is mc-flashcards.spec.ts ("fresh card renders 3 MC options").
  for (const key of ["a", "b", "c"]) expect(legend, `${key} is documented`).toContain(key)
  // v1.134.0: the transport is retired — "play / pause roll" left the list with its keys
  expect(legend, "the retired pause row is gone").not.toContain("play / pause roll")
  // STALE SPEC (v1.230.0, feat/video-cards merged): the legend has no "watch" or "read" row on either side;
  // the surviving key row is "Choose the focused move or open its video" (Tab, Enter).
  for (const phrase of ["multiple-choice", "execute option", "open its video", "esc"]) {
    expect(legend, `"${phrase}" documented`).toContain(phrase)
  }
})

test("typing in a field never triggers a shortcut", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  await page.keyboard.press("/") // opens the explorer and focuses its search input
  const before = await page.evaluate(() => ({
    paused: !!(window as any).__neural.paused,
    answered: ((window as any).__neural.beats || []).filter(
      (b: any) => b.beat === "land_q_answered",
    ).length,
  }))
  await page.evaluate(() => (window as any).__neural.explorerSearchRef.current.focus())
  await page.keyboard.type("abcd 123")
  const after = await page.evaluate(() => ({
    paused: !!(window as any).__neural.paused,
    answered: ((window as any).__neural.beats || []).filter(
      (b: any) => b.beat === "land_q_answered",
    ).length,
  }))
  expect(after.answered, "letters typed into search answered nothing").toBe(before.answered)
  expect(after.paused, "and the space in the query did not toggle the roll").toBe(before.paused)
})

/**
 * ── THE PATH'S INLINE DECKS AND THEIR KEYS (v1.175.0): RETIRED in v1.287.0 (SET1 slice B) ──
 * The owner's "keys navigation especially for the flashcards in the challenges" was built on the Path's corridor, whose ▸
 * opened an inline deck there, walked by ↑/↓ (`challengeLessonNav`) and paged, flipped and graded by ←/→/Space/⏎. The owner
 * took the Path out of the drawer (15 Nov); the corridor lives in Master the game, where a lesson opens as a SESSION row, and
 * the session's keys are the same four (`sessionNav`, `_miniDeck`; pinned by pane-keyboard.spec.ts and session-scroll.spec.ts).
 * The two tests of the Path's own deck went with it: "the Challenges corridor pages, flips and grades its inline deck from
 * the keyboard" and "a corridor repaint leaves no dead keys behind". The two below stand: a key never reaches a deck on a
 * view you left, and a Tab-focused corridor button keeps its Space and ⏎.
 */
// v1.293.0 (L3): RE-POINTED, nothing removed. The handle this journey leaves behind was made by a Last rolls row's inline deck
// (`c<n>`); a row holds no deck now, so Last rolls registers no handle. The CLASS stands (one registry, and nothing clears the
// row handle when you leave), so the handle is made where a deck still opens: "Practise here" opens the place in Master the
// game (handle `s<i>`), the player shuts the drawer with Esc (the session and its handle are kept) and reopens it on its
// list. The three keys and both assertions are the journey's own. Since L3, → has no branch that could reach a deck from
// the list at all (its assertion stays, as the differential it always was); Space and ⏎ still do, through `_focusedMini`.
// Mutant, on dev's build before (the test as it was) and this build after: `_focusedMini` returns the registry's hit
// whatever view is shown → red at "and ⏎ did not grade a card nobody was shown".
test("keys never reach a deck on the tab you left", async ({ page }) => {
  // `_focusRow` and `_miniReg` are ONE registry and nothing clears the row handle when you leave a view. So a key could
  // resolve a handle a view you LEFT kept behind: Space would flip a hidden card and ⏎ would GRADE a card nobody is looking
  // at — credit for an answer never given. `_focusedMini` scopes the lookup to the showing surface.
  const j = journey(page, { answerMode: "classic" })
  await j.boot("/")
  await j.hydrateAll()
  await j.land("Mount Top")
  await j.knowsPlanMoves()   // the place's cards, not its cloze

  // from Last rolls, Practise here: the place's deck opens in Master the game, and that leaves an `s<i>` handle behind
  await page.evaluate(() => (window as any).__neural.openPane("history"))
  await page.locator("[data-hist]").first().click()
  await page.locator("[data-hist-go]").click()
  await expect(page.locator("[data-mini-q]:visible"), "the place's card is open").toHaveCount(1, { timeout: 30_000 })
  const histKey = await page.evaluate(() => {
    const app = (window as any).__neural
    const wrap = app._openMini && app._openMini.el.querySelector("[data-mini-deck]")
    return { key: wrap?.getAttribute("data-mini-deck") || "", focusRow: app._focusRow }
  })
  expect(histKey.key, "a deck is open").toBeTruthy()
  expect(histKey.focusRow, "and holds the keyboard").toBeTruthy()

  const before = await page.evaluate((key: string) => {
    const app = (window as any).__neural
    return { idx: (app._deckState[key] || {}).idx ?? 0, prep: (app.prep || {})[key] || 0, revealed: !!(app._deckState[key] || {}).revealed }
  }, histKey.key)

  // walk away to the drawer's list, where that deck is not on screen at all: Esc shuts the drawer (the session is kept),
  // the logo opens it again on its list
  await page.keyboard.press("Escape")
  await expect.poll(() => page.evaluate(() => (window as any).__neural.deckShown)).toBe(false)
  await page.locator(".ng-logo").click()
  await expect(page.locator("[data-drawer-explore]")).toBeVisible()
  expect(await page.evaluate((r) => { const app = (window as any).__neural; return !!(app._miniReg && app._miniReg[r]) && app._focusRow === r }, histKey.focusRow), "premise: the handle of the deck we left is still registered").toBe(true)
  // THE KEYS MUST BE ABLE TO REACH THE HANDLE, OR THIS JOURNEY CANNOT FAIL (found by its own mutant, 18 Nov: green under
  // an unscoped `_focusedMini`). The press that reopened the drawer left the focus on the logo, a button, and Space and ⏎ on
  // a focused button are the button's own (the app's guard returns before any deck is looked up). The player this journey
  // is about has the focus nowhere: they press a part of the drawer that is no control, and then the keys.
  const spot = await page.evaluate(() => {
    const p = document.querySelector(".ng-drill")!.getBoundingClientRect()
    for (let y = p.top + 6; y < p.bottom - 6; y += 9) for (let x = p.left + 3; x < p.right - 3; x += 11) {
      const el = document.elementFromPoint(x, y) as HTMLElement | null
      if (el && el.closest(".ng-drill") && !el.closest("button,summary,a[href],select,input,textarea,[role='button'],[contenteditable],[tabindex]")) return { x, y }
    }
    return null
  })
  expect(spot, "premise: a part of the drawer that is no control").not.toBeNull()
  await page.mouse.click(spot!.x, spot!.y)
  expect(await page.evaluate(() => document.activeElement === document.body), "premise: the focus is on no control").toBe(true)
  await expect(page.locator("[data-drawer-explore]"), "premise: the drawer still shows its list").toBeVisible()
  await page.keyboard.press("ArrowRight")
  await page.keyboard.press("Space")
  await page.keyboard.press("Enter")

  const after = await page.evaluate((key: string) => {
    const app = (window as any).__neural
    return { idx: (app._deckState[key] || {}).idx ?? 0, prep: (app.prep || {})[key] || 0, revealed: !!(app._deckState[key] || {}).revealed }
  }, histKey.key)
  expect(after.idx, "→ did not page the deck on the tab we left").toBe(before.idx)
  expect(after.revealed, "Space did not flip a card nobody was shown").toBe(before.revealed)
  expect(after.prep, "and ⏎ did not grade a card nobody was shown").toBe(before.prep)
})

test("Space and Enter still activate a Tab-focused corridor button", async ({ page }) => {
  // v1.113.4's fix, which the Space/⏎ branches must not undo: the corridor is Tab-navigable and its rows ARE buttons, so both
  // keys belong to the focused control first. Since v1.287.0 the corridor is Master the game's, and a lesson's ▸ or row opens
  // its cards as a session row (`_practiceLesson`), so that is what each activation is read by.
  const j = journey(page)
  await j.boot("/")
  await j.hydrateAll()
  await openChallenges(page)

  const inSession = (key: string) => page.evaluate((k: string) => ((window as any).__neural._session?.keys || []).includes(k), key)
  // two rows whose lessons the session does not hold yet, so an activation is the only thing that can put them there
  const fresh: { key: string }[] = []
  for (const row of await lessonRows(page)) if (!(await inSession(row.key))) fresh.push(row)
  const [first, second] = fresh
  expect(!!first && !!second, "premise: two corridor lessons outside the session").toBe(true)
  const wasPaused = await paused(page) // an open pane already holds the clock (pane law)
  await page.evaluate((key: string) => {
    const el = document.querySelector(`[data-lesson-deck-toggle="${key}"]`) as HTMLElement | null
    el?.focus()
  }, first.key)
  await page.keyboard.press("Space")
  await expect.poll(() => inSession(first.key), {
    message: "Space on the focused ▸ opened its lesson in the session — the browser's activation, not our handler",
  }).toBe(true)
  expect(await paused(page), "and the roll's clock was not touched either way").toBe(wasPaused)

  // ⏎ on a focused row button is the browser's too. Aimed at a DIFFERENT row than the open one, so a swallowed key is visible
  await openChallenges(page)
  await page.evaluate((key: string) => {
    const el = document.querySelector(`.ng-challenge-lesson[data-lesson="${key}"]`) as
      | HTMLElement
      | null
    el?.focus()
  }, second.key)
  await page.keyboard.press("Enter")
  await expect.poll(() => inSession(second.key), { message: "⏎ activated the focused lesson row, which opened ITS lesson" }).toBe(true)
})
