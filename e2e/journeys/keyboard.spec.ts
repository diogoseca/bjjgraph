import { expect, test, type Page } from "@playwright/test"
import { journey } from "../dsl"

/**
 * THE KEYBOARD, AS A PRODUCT SURFACE.
 *
 * The owner's decision was that shortcuts stay in Settings rather than getting their own icon —
 * which makes the Shortcuts tab the ONLY place they are documented, so it had better be true.
 * This spec asserts every key it advertises actually does what it says, and that the two digit
 * families never collide: A–C answer the live question, 1–9 open option sheets.
 *
 * Handler: neural/src/app.src.jsx _onKey. Legend: Settings → Shortcuts.
 */

const paused = (page: Page) => page.evaluate(() => !!(window as any).__neural.paused)
/** the option sheet's panel never leaves the DOM (it fades to opacity 0), so ask the app */
const sheetOpen = (page: Page) => page.evaluate(() => !!(window as any).__neural._detailCtx)

/** The Challenges tab, showing the corridor — the same three calls every challenge spec uses. */
const openChallenges = async (page: Page) => {
  await page.evaluate(() => {
    const app = (window as any).__neural
    app.setViewMode("challenges")
    app.openExplorer()
    app.showExplorerList()
  })
  await expect(page.locator(".ng-track-card").first()).toBeVisible()
}

type LessonRow = { key: string; rid: string; n: number }

/** Visible corridor lesson rows carrying at least `min` RESIDENT cards, in ladder order. The
 *  registry is the app's own (`_lessonRows`), and visibility is asked of the DOM — a collapsed
 *  belt is `display:none`, so `offsetParent` is the render's answer, never a second copy of it. */
const lessonRows = (page: Page, min = 2): Promise<LessonRow[]> =>
  page.evaluate((floor: number) => {
    const app = (window as any).__neural
    const rows: LessonRow[] = []
    for (const entry of app._lessonRows || []) {
      if (!entry.row || entry.row.offsetParent === null) continue
      const cards = app._cardsOf(((app.flashcards || {}).decks || {})[entry.key]) || []
      if (cards.length >= floor) rows.push({ key: entry.key, rid: entry.rid, n: cards.length })
    }
    return rows
  }, min)

/** What one corridor lesson deck is showing, read from the RENDER — never recomputed (§6.3). */
const deckFace = (page: Page, key: string) =>
  page.evaluate((deckKey: string) => {
    const app = (window as any).__neural
    const wrap = document.querySelector(`[data-mini-deck="${deckKey}"]`)
    const box = document.querySelector(`[data-lesson-deckbox="${deckKey}"]`) as HTMLElement | null
    return {
      mounted: !!wrap,
      open: !!(box && box.style.display !== "none"),
      focused: !!(box && document.activeElement === box),
      idx: ((app._deckState || {})[deckKey] || {}).idx ?? null,
      question: (wrap?.querySelector("[data-mini-q]")?.textContent || "").trim(),
      revealed: !!wrap?.querySelector("[data-mini-a]"),
      graded: !!wrap?.querySelector("[data-mini-graded]"),
      focusRow: app._focusRow,
      prep: (app.prep || {})[deckKey] || 0,
    }
  }, key)

test("A-D answer the live question; digits open option sheets", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  // the landing block mounts once its distractor pool is resident (v1.80.4)
  const mc = await j.landQuestion()
  expect(mc, "a live landing question").toBeTruthy()

  // a digit must NOT answer the landing question — it opens the first option's sheet
  await page.keyboard.press("1")
  await expect(page.locator("[data-go]"), "digit 1 opened an option sheet").toBeVisible()
  const answered0 = (await j.beats()).filter((b) => b.beat === "land_q_answered").length
  expect(answered0, "and answered nothing").toBe(0)

  // ...AND NEITHER DOES A LETTER WHILE THE SHEET IS UP (v1.137.0). The card is still on screen
  // behind the sheet, but stood down — dimmed and inert — so A-D must not grade it. This is the
  // assertion that gates `_detailCtx`'s place in `_landHidden()`'s holder list: delete it there
  // and the letter below scores a question the player is not being asked.
  await page.keyboard.press("abcd"[mc!.correct])
  expect(
    (await j.beats()).filter((b) => b.beat === "land_q_answered").length,
    "the correct letter does not grade the card standing behind the sheet",
  ).toBe(0)

  await page.keyboard.press("Escape") // back out of the sheet
  expect(await sheetOpen(page), "Esc closed the sheet").toBe(false)

  await page.keyboard.press("abcd"[mc!.correct])
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

  // Esc cascade: option sheet first, then the pane — never both at once
  await page.locator(".ng-logo").click()
  await page.keyboard.press("1")
  await expect(page.locator("[data-go]")).toBeVisible()
  await page.keyboard.press("Escape")
  expect(await sheetOpen(page), "Esc closed the sheet").toBe(false)
  expect(await page.evaluate(() => !!(window as any).__neural.deckShown), "pane untouched").toBe(
    true,
  )
  await page.keyboard.press("Escape")
  expect(
    await page.evaluate(() => !!(window as any).__neural.deckShown),
    "second Esc closed the pane",
  ).toBe(false)
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
  for (const phrase of ["multiple-choice", "execute technique", "esc"]) {
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
 * ── THE CHALLENGES CORRIDOR'S INLINE DECKS (v1.171.0) ──────────────────────────────────────
 *
 * Owner: "I want to have keys navigation especially for the flashcards in the challenges — up
 * arrow down arrow left right space enter." Before this, the corridor was the ONE inline-deck
 * surface with no keyboard at all: `_onKey`'s arrow branches gated on the History tab, the
 * inline session or an open drill, and `openMini` never set `_focusRow`, so ←/→/Space had
 * nothing to resolve. Worse, the corridor is built entirely out of <button>s, so a Space press
 * after clicking ▸ went to the ▸ itself and SLAMMED THE DECK SHUT.
 *
 * The four claims below are the whole feature, and each is mutated in review:
 *   ←/→ page the cards · Space flips · ⏎ grades and walks on · ↑/↓ walk the lesson rows.
 * Plus the one that made grading unusable even by mouse: a corridor repaint (any evidence beat)
 * must leave the open deck open, on the card the player is owed, with its keys still live.
 */
test("the Challenges corridor pages, flips and grades its inline deck from the keyboard", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")
  await j.hydrateAll() // residency is not the subject: a cold row renders the placeholder deck
  await openChallenges(page)

  const rows = await lessonRows(page)
  expect(rows.length, "the corridor shows lesson rows with cards to page through").toBeGreaterThan(
    1,
  )
  const [first, second] = rows

  // open it the way a person does — a real mouse click on the ▸ disclosure, which is also what
  // parks focus somewhere the keys can be reached from (the deck box, never the button)
  await j.clickByMouse(`[data-lesson-deck-toggle="${first.key}"]`, "the lesson's ▸ disclosure")
  const opened = await deckFace(page, first.key)
  expect(opened.mounted, "the inline deck built").toBe(true)
  expect(opened.focusRow, "and took the keyboard focus row").toBe(first.rid)
  expect(opened.focused, "with DOM focus moved off the ▸ button onto the deck box").toBe(true)

  // ── ←/→ page the cards ──
  await page.keyboard.press("ArrowRight")
  const next = await deckFace(page, first.key)
  expect(next.idx, "→ walked to the second card").toBe(1)
  expect(next.question, "and the deck REPAINTED it").not.toBe(opened.question)
  await page.keyboard.press("ArrowLeft")
  expect((await deckFace(page, first.key)).idx, "← walked back").toBe(0)

  // ── Space flips the card ──
  await page.keyboard.press("Space")
  const flipped = await deckFace(page, first.key)
  expect(flipped.revealed, "Space revealed the answer").toBe(true)
  expect(flipped.open, "and did NOT activate the ▸ underneath it").toBe(true)

  // ── ⏎ grades it and walks on ──
  const renders = await page.evaluate(() => {
    const app = (window as any).__neural
    app.__corridorRenders = 0
    const inner = app.renderChallenges.bind(app)
    app.renderChallenges = (list: unknown) => {
      app.__corridorRenders += 1
      return inner(list)
    }
    return true
  })
  expect(renders, "corridor repaints instrumented").toBe(true)
  await page.keyboard.press("Enter")
  const graded = await deckFace(page, first.key)
  expect(graded.prep, "⏎ credited the card through gradeRecall").toBe(flipped.prep + 1)
  expect(
    (await j.beats()).filter((b) => b.beat === "bonus_pumped").length,
    "one grade, one credit beat",
  ).toBe(1)
  expect(graded.idx, "and walked on to the next card").toBe(1)
  expect(graded.revealed, "which arrives face down").toBe(false)
  expect(graded.open, "the deck is still open").toBe(true)

  // ── …AND SURVIVES THE REPAINT ITS OWN THIRD GRADE FIRES ──
  // Measured: `lessonDone` takes three cards of evidence, so grade #3 emits `lesson_done`,
  // `noteChallenges` finds durable movement and repaints this tab. That is the repaint that
  // used to shut the deck under a working player. Two more Space+⏎ cycles reach it.
  for (let i = 0; i < 2; i++) {
    await page.keyboard.press("Space")
    await page.keyboard.press("Enter")
  }
  expect(
    await page.evaluate(() => (window as any).__neural.__corridorRenders),
    "the third grade DID repaint the corridor",
  ).toBeGreaterThan(0)
  const afterRepaint = await deckFace(page, first.key)
  expect(afterRepaint.open, "the deck is STILL OPEN across that repaint").toBe(true)
  expect(afterRepaint.idx, "on the card the third grade left it on").toBe(3)
  expect(afterRepaint.prep, "with all three grades credited").toBe(flipped.prep + 3)
  // AND THE CARD ON SCREEN IS THAT CARD. `_deckState` alone cannot say so: the repaint rebuilds
  // the deck from it, so a grade that credits BEFORE walking the deck on repaints card 3 as
  // "Graded" and then renders card 4 into the detached wrap — right state, dead screen (§6.6).
  expect(afterRepaint.graded, "not sitting on the graded card").toBe(false)
  expect(afterRepaint.question, "the DOM shows the card the state names").toBe(
    await page.evaluate((key: string) => {
      const app = (window as any).__neural
      const cards = app._cardsOf(((app.flashcards || {}).decks || {})[key]) || []
      const card = cards[(app._deckState[key] || {}).idx] || {}
      return String(card.q || card.front || "").trim()
    }, first.key),
  )
  await page.keyboard.press("Space")
  const stillLive = await deckFace(page, first.key)
  expect(stillLive.revealed, "and the rebuilt deck still flips on Space").toBe(true)
  expect(stillLive.idx, "without losing its place").toBe(3)

  // ── ↑/↓ walk the lesson rows, opening each as they arrive (one deck at a time) ──
  await page.keyboard.press("ArrowDown")
  const walked = await deckFace(page, second.key)
  expect(walked.mounted, "↓ opened the next lesson's deck").toBe(true)
  expect(walked.focusRow, "and the keys followed it").toBe(second.rid)
  expect(
    (await deckFace(page, first.key)).open,
    "the accordion closed the one we came from",
  ).toBe(false)
  await page.keyboard.press("ArrowUp")
  expect((await deckFace(page, first.key)).open, "↑ walked back and reopened it").toBe(true)
  expect((await deckFace(page, first.key)).focusRow, "with the keys").toBe(first.rid)
})

test("a corridor repaint leaves no dead keys behind", async ({ page }) => {
  // The registry is rebuilt with the rows it indexes (renderChallenges). Without that, a
  // `lesson:` handle surviving a repaint closes over a DETACHED wrap: ←/→ would still walk
  // `_deckState` and repaint nothing — a key that reports success and shows nothing (§6.6).
  const j = journey(page)
  await j.boot("/")
  await j.hydrateAll()
  await openChallenges(page)

  const [first] = await lessonRows(page)
  await j.clickByMouse(`[data-lesson-deck-toggle="${first.key}"]`, "the lesson's ▸ disclosure")
  await page.keyboard.press("ArrowRight")
  expect((await deckFace(page, first.key)).idx, "on card 2 before the repaint").toBe(1)

  // a plain repaint — exactly what an evidence beat does to this tab
  await page.evaluate(() => (window as any).__neural.renderExplorer())
  const after = await deckFace(page, first.key)
  expect(after.open, "the open deck came back").toBe(true)
  expect(after.idx, "on the same card").toBe(1)
  expect(after.focusRow, "still holding the keys").toBe(first.rid)

  // the handles are the NEW deck's, not the detached one's: → must move what is on screen
  await page.keyboard.press("ArrowRight")
  const paged = await deckFace(page, first.key)
  expect(paged.idx, "→ still pages after the repaint").toBe(2 % first.n)
  expect(paged.question, "and the card on screen is the one the state names").toBe(
    await page.evaluate(
      (key: string) => {
        const app = (window as any).__neural
        const cards = app._cardsOf(((app.flashcards || {}).decks || {})[key]) || []
        const card = cards[(app._deckState[key] || {}).idx] || {}
        return String(card.q || card.front || "").trim()
      },
      first.key,
    ),
  )

  // ── FOLDING THE BELT TAKES THE KEYS AWAY; UNFOLDING HANDS THEM BACK ──
  // A fold is presentation only — every row stays in the DOM at `display:none` — so the deck the
  // player was working is still open and still registered, just invisible. `_focusedMini` is what
  // refuses it, by asking the CSS (`offsetParent`) rather than by throwing state away; ←/→ walking
  // `_deckState` where nobody can see it is the same silent drift as a dead key (§6.6).
  const belt = await page.evaluate((key: string) => {
    const row = document.querySelector(`.ng-challenge-lesson[data-lesson="${key}"]`)
    return row?.closest("[data-belt]")?.getAttribute("data-belt") || ""
  }, first.key)
  expect(belt, "the row sits in a belt section").toBeTruthy()
  const folded = (await deckFace(page, first.key)).idx
  await page.locator(`[data-belt-toggle="${belt}"]`).click()
  await page.keyboard.press("ArrowRight")
  expect(
    (await deckFace(page, first.key)).idx,
    "→ walks nothing once the deck is folded away",
  ).toBe(folded)

  await page.locator(`[data-belt-toggle="${belt}"]`).click()
  await page.keyboard.press("ArrowRight")
  expect(
    (await deckFace(page, first.key)).idx,
    "and unfolding gives the keys straight back — nothing was discarded",
  ).toBe((folded + 1) % first.n)
})

test("keys never reach a deck on the tab you left", async ({ page }) => {
  // `_focusRow` and `_miniReg` are ONE registry for three surfaces and nothing clears the row
  // handle on a tab switch. So the corridor's new keys could resolve a handle the LAST-ROLLS tab
  // left behind: ←/→ would page a hidden deck and ⏎ would GRADE a card nobody is looking at —
  // credit for an answer never given. `_focusedMini` scopes the lookup to the showing surface.
  const j = journey(page)
  await j.boot("/")
  await j.hydrateAll()
  await j.land("Mount Top")

  // open the roll history's own inline deck: that is what leaves a `c<n>` handle behind
  await page.evaluate(() => (window as any).__neural.openPane("history"))
  await page.locator("[data-hist]").first().click()
  const histKey = await page.evaluate(() => {
    const app = (window as any).__neural
    const wrap = document.querySelector("[data-mini-deck]")
    return { key: wrap?.getAttribute("data-mini-deck") || "", focusRow: app._focusRow }
  })
  expect(histKey.key, "a history row's deck is open").toBeTruthy()
  expect(histKey.focusRow, "and holds the keyboard").toBeTruthy()

  const before = await page.evaluate((key: string) => {
    const app = (window as any).__neural
    return { idx: (app._deckState[key] || {}).idx ?? 0, prep: (app.prep || {})[key] || 0 }
  }, histKey.key)

  // walk away to Challenges, where that deck is not on screen at all
  await page.evaluate(() => (window as any).__neural.setViewMode("challenges"))
  await expect(page.locator(".ng-track-card").first()).toBeVisible()
  await page.keyboard.press("ArrowRight")
  await page.keyboard.press("Space")
  await page.keyboard.press("Enter")

  const after = await page.evaluate((key: string) => {
    const app = (window as any).__neural
    return { idx: (app._deckState[key] || {}).idx ?? 0, prep: (app.prep || {})[key] || 0 }
  }, histKey.key)
  expect(after.idx, "→ did not page the deck on the tab we left").toBe(before.idx)
  expect(after.prep, "and ⏎ did not grade a card nobody was shown").toBe(before.prep)
})

test("Space and Enter still activate a Tab-focused corridor button", async ({ page }) => {
  // v1.113.4's fix, which the new Space/⏎ branches must not undo: the corridor is Tab-navigable
  // and its rows ARE buttons, so both keys belong to the focused control first. This is why an
  // opening deck moves focus to a container instead of leaving it on the ▸.
  const j = journey(page)
  await j.boot("/")
  await j.hydrateAll()
  await openChallenges(page)

  const [first, second] = await lessonRows(page)
  const wasPaused = await paused(page) // an open pane already holds the clock (pane law)
  await page.evaluate((key: string) => {
    const el = document.querySelector(`[data-lesson-deck-toggle="${key}"]`) as HTMLElement | null
    el?.focus()
  }, first.key)
  await page.keyboard.press("Space")
  expect(
    (await deckFace(page, first.key)).open,
    "Space on the focused ▸ opened the deck — the browser's activation, not our handler",
  ).toBe(true)
  expect(await paused(page), "and the roll's clock was not touched either way").toBe(wasPaused)

  // ⏎ on a focused row button is the browser's too. Aimed at a DIFFERENT row than the open one,
  // so a swallowed key is visible: the open deck would simply stay where it was.
  await page.evaluate((key: string) => {
    const el = document.querySelector(`.ng-challenge-lesson[data-lesson="${key}"]`) as
      | HTMLElement
      | null
    el?.focus()
  }, second.key)
  await page.keyboard.press("Enter")
  expect(
    await page.evaluate(() => (window as any).__neural._openLessonRid),
    "⏎ activated the focused lesson row, which opened ITS deck",
  ).toBe(`lesson:${second.key}`)
})
