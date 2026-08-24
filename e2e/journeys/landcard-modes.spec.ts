import { test, expect } from "@playwright/test"
import { journey } from "../dsl"

/**
 * LANDING-CARD RUNGS + PAGING (v1.130.0).
 *
 * Three owner asks, one ladder: hidden ⇄ normal ⇄ open.
 *   1. Answers hidden behind "Answer for better odds" ([data-land-reveal]); "Hide answers"
 *      ([data-land-hide]) walks back down. The player's own clicks persist the binary
 *      preference (`landAnswers` settings key, "show"|"hide", NO Settings row) — More/Less
 *      never write it, so "fully open" always decays to normal on the next card.
 *   2. Swipe / trackpad wheel / ‹›pager / ←→ page the CURRENT NODE's own flashcard deck
 *      ([data-land-pager], [data-land-prev], [data-land-next], `_landPageTo`).
 *   3. ECONOMY LAW: `land_q_answered` is challenge evidence and combo has no cap, so only the
 *      FIRST answered card per landing pays refund/combo/qMod — later answers grade as study
 *      (`land_q_extra`), and committing after any answer fires no `land_q_ignored`.
 *
 * Mutants this file must kill:
 *   M1 — A–D gate ignores `_landAnsHid` (keys answer invisible options)      → journey 1
 *   M2 — More/Less write the `landAnswers` preference                        → journey 2
 *   M3 — the hidden rung skips the MC build (RNG diverges by preference)     → journey 3
 *   M4 — the economy pays on every answered card (combo/refund farm)         → journey 4
 *   M5 — the swipe fires on a vertical gesture (dominant-axis check gone)    → journey 5
 *   M6 — the capture-phase click suppressor is gone (a swipe is a pick)      → journey 5
 *   M7 — the paging branch drops its !_landHidden() gate (the pane suppression is what
 *        keeps arrows off a hidden card — branch order alone is unobservable, since an open
 *        pane always hides the card at every width, v1.101.7)                → journey 6
 */

test.use({ hasTouch: true })

type W = Window & { __neural: any }

const count = (bs: Array<{ beat: string }>, name: string) =>
  bs.filter((b) => b.beat === name).length

/** app state relevant to the rung + pager, in one read */
const rung = (page: any) =>
  page.evaluate(() => {
    const a = (window as W).__neural
    const qw = document.querySelector("[data-land-q]") as HTMLElement | null
    const wrap = qw?.querySelector("[data-land-opts]") as HTMLElement | null
    return {
      ansHid: !!a._landAnsHid,
      wrapDisplay: wrap ? getComputedStyle(wrap).display : null,
      reveal: !!qw?.querySelector("[data-land-reveal]"),
      hide: !!qw?.querySelector("[data-land-hide]"),
      prefKeyPresent: "landAnswers" in (a.settings || {}),
      pref: a.get("landAnswers", "show"),
      page: a._landPage,
      combo: a._combo || 0,
      pending: !!a._landPending,
      q: a._landQ ? a._landQ.card.q : null,
    }
  })

/** stage a fresh roll at a named position (a NEW landing, so the rung re-derives from the pref) */
const stageAt = async (page: any, j: any, pos: string) => {
  await page.evaluate((p: string) => {
    const a = (window as W).__neural
    const i = a.nodes.findIndex((n: any) => n.ty === "positions" && n.t === p)
    if (i < 0) throw new Error("position not found: " + p)
    a.rollFromPosition(i, true)
  }, pos)
  await j.advance(1500)
  await j.landQuestion()
}

/** answer the mounted MC block correctly (the app's own truth names the right option) */
const answerCorrect = async (page: any) => {
  await page.evaluate(() => {
    const a = (window as W).__neural
    const btns = document.querySelectorAll("[data-land-mc-opt]")
    ;(btns[a._mc.correct] as HTMLElement).click()
  })
}

// ── 1. the rung ladder + its persistence ─────────────────────────────────────────────────────
test("hide answers is sticky, reveal is sticky, and A–D cannot answer what is hidden @curated", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  // default rung: answers shown, the preference key does not even exist yet
  let r = await rung(page)
  expect(r.wrapDisplay, "options visible by default").toBe("flex")
  expect(r.hide, "the quiet Hide control rides the normal rung").toBe(true)
  expect(r.reveal, "no reveal CTA while answers are shown").toBe(false)
  expect(r.prefKeyPresent, "no preference written before the player expresses one").toBe(false)

  // Hide → hidden rung, pref "hide", beat
  await j.clickByMouse("[data-land-hide]")
  r = await rung(page)
  expect(r.ansHid).toBe(true)
  expect(r.wrapDisplay, "options stand down").toBe("none")
  expect(r.reveal, "the reveal CTA takes their place").toBe(true)
  expect(r.pref).toBe("hide")
  await j.expectBeat("land_answers_hidden")

  // M1: the keyboard must not answer invisible options
  const before = await j.beats()
  await page.keyboard.press("a")
  const after = await j.beats()
  expect(count(after, "mc_correct") - count(before, "mc_correct"), "no grade from A while hidden").toBe(0)
  expect(count(after, "mc_wrong") - count(before, "mc_wrong")).toBe(0)
  expect(count(after, "land_q_answered") - count(before, "land_q_answered")).toBe(0)
  expect((await rung(page)).pending, "the question is still on the table").toBe(true)

  // Reveal → shown again, pref "show", and answering works
  await j.clickByMouse("[data-land-reveal]")
  r = await rung(page)
  expect(r.wrapDisplay).toBe("flex")
  expect(r.pref).toBe("show")
  await j.expectBeat("land_answers_revealed")

  // Hide again and leave it hidden: the NEXT landing mounts hidden, and says so in its beat
  await j.clickByMouse("[data-land-hide]")
  const shownBefore = count(await j.beats(), "land_q_shown")
  await stageAt(page, j, "Side Control Top")
  const bs = await j.beats()
  expect(count(bs, "land_q_shown"), "the new landing asked its question").toBeGreaterThan(shownBefore)
  const last = bs.filter((b: any) => b.beat === "land_q_shown").pop() as any
  expect(last.hidden, "land_q_shown names the hidden mount").toBe(true)
  r = await rung(page)
  expect(r.wrapDisplay, "next card opens hidden — the preference held").toBe("none")
  expect(r.reveal).toBe(true)
})

// ── 2. More/Less never write the preference; More-from-hidden is a reveal ────────────────────
test("fully open is never remembered — More/Less write nothing, More-from-hidden reveals", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")
  // author More-fold content: the DSL serves {} for dossier chunks, so without this most states
  // legitimately render no More at all (roll-card.spec's seedDossier lesson)
  await j.land("Mount Top")
  await page.evaluate(() => {
    const a = (window as W).__neural
    const key = a.deckKeyFor(a.nodes[a.currentPos]).key
    const w = window as any
    w.NG_CONTENT = w.NG_CONTENT || {}
    w.NG_CONTENT.decks = w.NG_CONTENT.decks || {}
    w.NG_CONTENT.decks[key] = {
      def: "A definition that survives the fold.",
      principles: ["Base", "Frames"],
    }
    a._landQ = null
    a.renderLandCard(a.nodes[a.currentPos], "land", null)
  })
  await j.landQuestion()

  // More then Less: the key must stay ABSENT, and no reveal/hide beat may fire — the beat
  // means "the player revealed answers", and More over already-shown answers reveals nothing.
  // (The absent-key sentinel alone cannot see a same-value write: _setLandAnswers guards those.
  // The beat is what makes the M2 mutant — an unconditional write on More — observable.)
  const preFold = await j.beats()
  await j.clickByMouse("[data-land-more]")
  await j.clickByMouse("[data-land-more]")
  const postFold = await j.beats()
  expect(
    count(postFold, "land_answers_revealed") - count(preFold, "land_answers_revealed"),
    "More-from-normal is not a reveal",
  ).toBe(0)
  expect(count(postFold, "land_answers_hidden") - count(preFold, "land_answers_hidden")).toBe(0)
  let r = await rung(page)
  expect(r.prefKeyPresent, "the fold wrote no preference").toBe(false)
  expect(r.wrapDisplay, "answers untouched by the fold").toBe("flex")

  // hidden rung + More: reveals AND opens AND writes "show" (the player pressed it)
  await j.clickByMouse("[data-land-hide]")
  expect((await rung(page)).pref).toBe("hide")
  await j.clickByMouse("[data-land-more]")
  r = await rung(page)
  expect(r.wrapDisplay, "More over hidden answers reveals them first").toBe("flex")
  expect(r.pref, "…and that one IS the player revealing, so it persists").toBe("show")
  const open = await page.evaluate(() => {
    const b = document.querySelector("[data-land-more-body]") as HTMLElement
    return b && b.style.display === "block"
  })
  expect(open, "the fold really opened").toBe(true)

  // leave it fully open, land elsewhere: next card is NORMAL — not open, not hidden
  await stageAt(page, j, "Side Control Top")
  r = await rung(page)
  expect(r.wrapDisplay, "answers shown (pref is show)").toBe("flex")
  const openNext = await page.evaluate(() => {
    const b = document.querySelector("[data-land-more-body]") as HTMLElement | null
    return !!(b && b.style.display === "block")
  })
  expect(openNext, "the fold did not survive the landing — fully open decays to normal").toBe(false)
})

// ── 3. the hidden rung must not touch the RNG ────────────────────────────────────────────────
test("hidden or shown, the MC block is built identically — same draws, same options", async ({
  page,
}) => {
  const j = journey(page)
  const RIG = Array.from({ length: 40 }, (_, i) => ((i * 7919) % 100) / 100)

  await j.boot("/")
  await j.rig("land-mc-pick", RIG)
  await j.rig("land-mc-shuffle", RIG)
  await j.land("Mount Top")
  const shown = await page.evaluate(() => {
    const a = (window as W).__neural
    return {
      correct: a._mc.correct,
      n: a._mc.n,
      opts: Array.from(document.querySelectorAll("[data-land-mc-opt]")).map((b) => b.textContent),
    }
  })
  await j.clickByMouse("[data-land-hide]") // pref=hide, persisted

  await j.boot("/", { preserveStorage: true })
  await j.rig("land-mc-pick", RIG)
  await j.rig("land-mc-shuffle", RIG)
  await j.land("Mount Top")
  const hidden = await page.evaluate(() => {
    const a = (window as W).__neural
    const wrap = document.querySelector("[data-land-opts]") as HTMLElement
    return {
      correct: a._mc.correct,
      n: a._mc.n,
      opts: Array.from(document.querySelectorAll("[data-land-mc-opt]")).map((b) => b.textContent),
      display: wrap ? wrap.style.display : null,
      ansHid: !!a._landAnsHid,
    }
  })
  expect(hidden.ansHid, "this boot mounted hidden").toBe(true)
  expect(hidden.display).toBe("none")
  expect(hidden.correct, "same correct index — the draw did not move").toBe(shown.correct)
  expect(hidden.n).toBe(shown.n)
  expect(hidden.opts, "same options in the same order").toEqual(shown.opts)
})

// ── 4. paging + the one-per-landing economy ──────────────────────────────────────────────────
test("paging browses the deck; only the first answer pays; commit fires no ignore @curated", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  const deckLen = await page.evaluate(() => {
    const a = (window as W).__neural
    return a._landDeckCards(a._landQ.key).length
  })
  expect(deckLen, "the fixture deck is pageable").toBeGreaterThanOrEqual(3)

  const q0 = (await rung(page)).q
  expect((await rung(page)).page).toBe(0)

  // clamp at the left edge: prev pages nothing
  const b0 = await j.beats()
  await j.clickByMouse("[data-land-prev]")
  expect(count(await j.beats(), "land_q_paged") - count(b0, "land_q_paged")).toBe(0)

  // next → a different card; prev → the SAME block back (option order identical: the cache)
  await j.clickByMouse("[data-land-next]")
  await j.expectBeat("land_q_paged")
  const r1 = await rung(page)
  expect(r1.page).toBe(1)
  expect(r1.q, "a different question").not.toBe(q0)
  const opts1 = await page.evaluate(() =>
    Array.from(document.querySelectorAll("[data-land-mc-opt]")).map((b) => b.textContent),
  )
  await j.clickByMouse("[data-land-prev]")
  const back = await rung(page)
  expect(back.page).toBe(0)
  expect(back.q, "the first card again").toBe(q0)
  const opts0b = await page.evaluate(() =>
    Array.from(document.querySelectorAll("[data-land-mc-opt]")).map((b) => b.textContent),
  )
  await j.clickByMouse("[data-land-next]")
  const opts1b = await page.evaluate(() =>
    Array.from(document.querySelectorAll("[data-land-mc-opt]")).map((b) => b.textContent),
  )
  expect(opts1b, "re-paging re-parents the same shuffle, never redraws").toEqual(opts1)

  // FIRST answer (on the paged card — whichever card is first, it is THE landing question)
  const preA = await j.beats()
  await answerCorrect(page)
  let bs = await j.beats()
  expect(count(bs, "land_q_answered") - count(preA, "land_q_answered"), "the landing scored once").toBe(1)
  expect(count(bs, "timer_refund") - count(preA, "timer_refund"), "one clock refund").toBe(1)
  const comboAfterFirst = (await rung(page)).combo
  expect(comboAfterFirst, "the combo ticked").toBeGreaterThanOrEqual(1)
  expect((await rung(page)).pending, "the landing is engaged").toBe(false)

  // SECOND answer (page back to card 0) — grades as study, pays nothing again
  await j.clickByMouse("[data-land-prev]")
  await answerCorrect(page)
  bs = await j.beats()
  expect(count(bs, "mc_correct"), "the grade itself ran").toBeGreaterThanOrEqual(2)
  expect(count(bs, "land_q_answered"), "still one scored landing answer").toBe(1)
  expect(count(bs, "land_q_extra"), "the later answer is named study").toBe(1)
  expect(count(bs, "timer_refund"), "no second refund").toBe(1)
  expect((await rung(page)).combo, "no combo farm").toBe(comboAfterFirst)

  // an answered card re-parents as its graded, disabled record
  await j.clickByMouse("[data-land-next]") // back to the answered card 1
  const graded = await page.evaluate(() => {
    const btns = document.querySelectorAll("[data-land-mc-opt]")
    return {
      disabled: Array.from(btns).every((b) => b.getAttribute("aria-disabled") === "true"),
      result: !!document.querySelector("[data-land-q] [data-mc-result]"),
    }
  })
  expect(graded.result, "the graded state came back").toBe(true)
  expect(graded.disabled).toBe(true)
  const preRe = await j.beats()
  await page.evaluate(() => (document.querySelectorAll("[data-land-mc-opt]")[0] as HTMLElement).click())
  expect(count(await j.beats(), "mc_correct") - count(preRe, "mc_correct"), "scored once, never re-asked").toBe(0)

  // committing a move after answering fires no ignore-break
  const tech = await page.evaluate(() => {
    const a = (window as W).__neural
    return a.nodes[a.optionIdxs[0]].t
  })
  await j.pick(tech)
  await j.advance(500)
  expect(count(await j.beats(), "land_q_ignored"), "an engaged landing is never 'ignored'").toBe(0)
})

// ── 5. swipe pages horizontally; a swipe is not a pick ───────────────────────────────────────
test("a horizontal swipe pages, a vertical one scrolls, and a swipe never answers", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  const swipe = (x1: number, y1: number, x2: number, y2: number) =>
    page.evaluate(
      ([a, b, c, d]) => {
        const el = document.querySelector(".ng-landcard") as HTMLElement
        const mk = (x: number, y: number) =>
          new Touch({ identifier: 1, target: el, clientX: x, clientY: y })
        el.dispatchEvent(new TouchEvent("touchstart", { changedTouches: [mk(a, b)], bubbles: true }))
        el.dispatchEvent(new TouchEvent("touchend", { changedTouches: [mk(c, d)], bubbles: true }))
      },
      [x1, y1, x2, y2] as const,
    )

  // leftward horizontal swipe → next card
  const b0 = await j.beats()
  await swipe(320, 420, 220, 425)
  let bs = await j.beats()
  expect(count(bs, "land_q_paged") - count(b0, "land_q_paged"), "swipe left pages forward").toBe(1)
  expect((await rung(page)).page).toBe(1)

  // M5: a VERTICAL-dominant gesture must fall through to the card's own scroll — no page.
  // dx is deliberately past the 40px floor (60) so only the dominant-axis check rejects it:
  // a mutant that deletes that check cannot hide behind the floor.
  await swipe(320, 480, 260, 340)
  expect(count(await j.beats(), "land_q_paged") - count(bs, "land_q_paged"), "vertical does not page").toBe(0)

  // rightward swipe → back
  await swipe(220, 420, 330, 418)
  expect((await rung(page)).page).toBe(0)

  // M6: a swipe whose synthesized click lands on an option must not answer it. At page 0 a
  // rightward gesture clamps to a no-op, so the block (and its button) stays in the DOM — the
  // exact case where the browser's synthesized click would land on a live option.
  const pre = await j.beats()
  await page.evaluate(() => {
    const el = document.querySelector(".ng-landcard") as HTMLElement
    const btn = document.querySelector("[data-land-mc-opt]") as HTMLElement
    const r = btn.getBoundingClientRect()
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    const mk = (x: number, y: number) => new Touch({ identifier: 1, target: btn, clientX: x, clientY: y })
    el.dispatchEvent(new TouchEvent("touchstart", { changedTouches: [mk(cx - 120, cy)], bubbles: true }))
    el.dispatchEvent(new TouchEvent("touchend", { changedTouches: [mk(cx, cy)], bubbles: true }))
    // the browser resolves a tap-with-movement to a click — model it on the live button
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))
  })
  let post = await j.beats()
  expect(count(post, "mc_correct") - count(pre, "mc_correct"), "the swipe answered nothing").toBe(0)
  expect(count(post, "mc_wrong") - count(pre, "mc_wrong")).toBe(0)
  // …and a PLAIN click (no movement) still answers: the suppressor resets itself
  await answerCorrect(page)
  expect(count(await j.beats(), "land_q_answered"), "a real click still lands").toBe(1)
})

// ── 6. wheel + keyboard, and the branch order under the drill ────────────────────────────────
test("trackpad deltaX pages once per gesture; arrows page the card but never steal from study", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  // two quick wheel bursts = ONE page (accumulate + cooldown)
  const b0 = await j.beats()
  await page.evaluate(() => {
    const el = document.querySelector(".ng-landcard") as HTMLElement
    el.dispatchEvent(new WheelEvent("wheel", { deltaX: 120, deltaY: 4, bubbles: true }))
    el.dispatchEvent(new WheelEvent("wheel", { deltaX: 120, deltaY: 4, bubbles: true }))
  })
  expect(count(await j.beats(), "land_q_paged") - count(b0, "land_q_paged"), "one page per gesture").toBe(1)

  // a vertical wheel never pages
  const b1 = await j.beats()
  await page.evaluate(() => {
    const el = document.querySelector(".ng-landcard") as HTMLElement
    el.dispatchEvent(new WheelEvent("wheel", { deltaX: 3, deltaY: 140, bubbles: true }))
  })
  expect(count(await j.beats(), "land_q_paged") - count(b1, "land_q_paged")).toBe(0)

  // ← pages back on the card…
  await page.keyboard.press("ArrowLeft")
  expect((await rung(page)).page).toBe(0)
  await j.expectBeat("land_q_paged")

  // …but with the study surface open, arrows belong to the DRILL (M7: the hidden-card gate).
  // openLessonStudy is the seam sessions/checkpoints use (mc-flashcards.spec's idiom);
  // isDrillOpen() is deckShown && deck, so a HOME open (deck:null) would not exercise it.
  await page.evaluate(() => {
    const a = (window as W).__neural
    const key = a.deckKeyFor(a.nodes[a.currentPos]).key
    const node = a.nodes[a.currentPos]
    a._lessonLive = a._lessonLive || (() => true)
    a.openLessonStudy(
      { deckKey: key, nodeId: node.id },
      { name: "t", lessons: [{ deckKey: key, nodeId: node.id }] },
      { id: "white" },
    )
  })
  await j.advance(800)
  await j.decksSettled()
  await page.waitForFunction(() => (((window as any).__neural || {}).deck || []).length > 0, null, {
    timeout: 20_000,
  })
  const drillOpen = await page.evaluate(() => (window as W).__neural.isDrillOpen())
  expect(drillOpen, "the study surface is up").toBe(true)
  const b2 = await j.beats()
  await page.keyboard.press("ArrowRight")
  expect(count(await j.beats(), "land_q_paged") - count(b2, "land_q_paged"), "the card did not steal the key").toBe(0)

  // M7's real kill: a card hidden by the background-tap stand-down (_bgDown) — no earlier
  // arrow branch claims the key there, so only the paging branch's own !_landHidden() gate
  // keeps arrows off an invisible card
  await page.evaluate(() => {
    const a = (window as W).__neural
    a.setDeckOpen(false)
    a._standDown()
  })
  await j.advance(200)
  const hiddenNow = await page.evaluate(() => (window as W).__neural._landHidden())
  expect(hiddenNow, "the stand-down hides the card").toBe(true)
  const b3 = await j.beats()
  await page.keyboard.press("ArrowRight")
  expect(count(await j.beats(), "land_q_paged") - count(b3, "land_q_paged"), "no paging a hidden card").toBe(0)
})

// ── 7. the defense card is exempt ────────────────────────────────────────────────────────────
test("the panic card pages nothing — no pager, and arrows stay dead", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await page.evaluate(() => {
    const a = (window as W).__neural
    const sub = a.adj[a.currentPos].find((k: number) => a.nodes[k].ty === "submissions")
    a.enterDefense(sub != null ? sub : a.nodes.findIndex((n: any) => n.ty === "submissions"))
  })
  await j.advance(300)
  await expect(page.locator("[data-panic]"), "the panic card is up").toBeVisible()
  expect(await page.locator("[data-land-pager]").count(), "no pager on a defense card").toBe(0)
  const b0 = await j.beats()
  await page.keyboard.press("ArrowRight")
  expect(count(await j.beats(), "land_q_paged") - count(b0, "land_q_paged"), "arrows page nothing").toBe(0)
})
