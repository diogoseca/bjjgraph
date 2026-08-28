import { test, expect } from "@playwright/test"
import { journey } from "../dsl"

/**
 * LANDING-CARD PAGING + UNIFORM TECHNIQUE NAVIGATION (v1.130.0 → v1.132.0).
 *
 * Paging (survives from v1.131.0; the reveal/hide rung and the visible ‹dots› pager shipped
 * there and were retired the next day — owner: "I don't like that hide answers part … left
 * right scrolling should still work"): swipe / trackpad deltaX / ←→ page the CURRENT NODE's
 * own flashcard deck through `_landPageTo`, gestures only, no chrome.
 *
 * Navigation (v1.132.0, owner): "when you click on a transition or on a submission, you
 * navigate to it. The URL changes to it, and the landcard is standard." A technique click or
 * URL lands ON the technique — URL, camera, focus, a position-anatomy card — with the SEAT at
 * its origin, staged; committing its own highlighted card runs THE EXCHANGE (v1.134.0): finishing/attacking side
 * commits it, escaping/defending side gets the red defense rush ("if I click play, I want to
 * see that rush … you need to think fast").
 *
 * ECONOMY LAW (unchanged): `land_q_answered` is challenge evidence and combo has no cap, so
 * only the FIRST answered card per landing pays refund/combo/qMod — later answers grade as
 * study (`land_q_extra`), and committing after any answer fires no `land_q_ignored`.
 *
 * Mutants this file must kill:
 *   M1 — the economy pays on every answered card (combo/refund farm)         → journey 1
 *   M2 — the swipe fires on a vertical gesture (dominant-axis check gone)    → journey 2
 *   M3 — the capture-phase click suppressor is gone (a swipe is a pick)      → journey 2
 *   M4 — the paging branch drops !_landHidden() (pages an invisible card)    → journey 3
 *   M5 — a technique URL is rewritten to its origin (the pre-v1.132.0 yank)  → journey 5
 *   M6 — play on a defender-staged technique deals a placid hand (no rush)   → journey 6
 *   M7 — play on an attacker-staged technique does not commit the exchange   → journey 7
 *   M8 — the emitter ships paragraph display-answers again (_hard_clip gone:
 *        MC starves on 532 decks and recall shows at stage 0, inverting the
 *        recognise-first progression — the owner's Americana report)         → journey 5b
 *   M9 — the option-label pass draws over the focused pair (printed twice)   → journey 5
 *   M10 — the film ignores perspective-nested clips (technique film lost)    → journey 5
 */

test.use({ hasTouch: true })

type W = Window & { __neural: any }

const count = (bs: Array<{ beat: string }>, name: string) =>
  bs.filter((b) => b.beat === name).length

/** paging + card state in one read */
const state = (page: any) =>
  page.evaluate(() => {
    const a = (window as W).__neural
    return {
      page: a._landPage,
      combo: a._combo || 0,
      pending: !!a._landPending,
      q: a._landQ ? a._landQ.card.q : null,
    }
  })

/** answer the mounted MC block correctly (the app's own truth names the right option) */
const answerCorrect = async (page: any) => {
  await page.evaluate(() => {
    const a = (window as W).__neural
    const btns = document.querySelectorAll("[data-land-mc-opt]")
    ;(btns[a._mc.correct] as HTMLElement).click()
  })
}

// ── 1. paging (keys) + the one-per-landing economy ───────────────────────────────────────────
test("arrows page the deck; only the first answer pays; commit fires no ignore @curated", async ({
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

  const q0 = (await state(page)).q
  expect((await state(page)).page).toBe(0)

  // clamp at the left edge: ← pages nothing
  const b0 = await j.beats()
  await page.keyboard.press("ArrowLeft")
  expect(count(await j.beats(), "land_q_paged") - count(b0, "land_q_paged")).toBe(0)

  // → a different card; ← the SAME block back (option order identical: the re-parent cache)
  await page.keyboard.press("ArrowRight")
  await j.expectBeat("land_q_paged")
  const s1 = await state(page)
  expect(s1.page).toBe(1)
  expect(s1.q, "a different question").not.toBe(q0)
  const opts1 = await page.evaluate(() =>
    Array.from(document.querySelectorAll("[data-land-mc-opt]")).map((b) => b.textContent),
  )
  await page.keyboard.press("ArrowLeft")
  expect((await state(page)).q, "the first card again").toBe(q0)
  await page.keyboard.press("ArrowRight")
  const opts1b = await page.evaluate(() =>
    Array.from(document.querySelectorAll("[data-land-mc-opt]")).map((b) => b.textContent),
  )
  expect(opts1b, "re-paging re-parents the same shuffle, never redraws").toEqual(opts1)

  // FIRST answer (on the paged card — whichever card it is, it is THE landing question)
  const preA = await j.beats()
  await answerCorrect(page)
  let bs = await j.beats()
  expect(count(bs, "land_q_answered") - count(preA, "land_q_answered"), "scored once").toBe(1)
  // v1.133.0: the refund is retired — answering disarms the question window instead
  expect(count(bs, "timer_refund") - count(preA, "timer_refund"), "no refund beat exists").toBe(0)
  const comboAfterFirst = (await state(page)).combo
  expect(comboAfterFirst, "the combo ticked").toBeGreaterThanOrEqual(1)
  expect((await state(page)).pending, "the landing is engaged").toBe(false)

  // SECOND answer (page back to card 0) — grades as study, pays nothing again
  await page.keyboard.press("ArrowLeft")
  await answerCorrect(page)
  bs = await j.beats()
  expect(count(bs, "mc_correct"), "the grade itself ran").toBeGreaterThanOrEqual(2)
  expect(count(bs, "land_q_answered"), "still one scored landing answer").toBe(1)
  expect(count(bs, "land_q_extra"), "the later answer is named study").toBe(1)
  expect(count(bs, "timer_refund"), "the refund beat is retired").toBe(0)
  expect((await state(page)).combo, "no combo farm").toBe(comboAfterFirst)

  // an answered card re-parents as its graded, disabled record
  await page.keyboard.press("ArrowRight")
  const graded = await page.evaluate(() => ({
    disabled: Array.from(document.querySelectorAll("[data-land-mc-opt]")).every(
      (b) => b.getAttribute("aria-disabled") === "true",
    ),
    result: !!document.querySelector("[data-land-q] [data-mc-result]"),
  }))
  expect(graded.result, "the graded state came back").toBe(true)
  expect(graded.disabled).toBe(true)

  // committing a move after answering fires no ignore-break
  const tech = await page.evaluate(() => {
    const a = (window as W).__neural
    return a.nodes[a.optionIdxs[0]].t
  })
  await j.pick(tech)
  await j.advance(500)
  expect(count(await j.beats(), "land_q_ignored"), "an engaged landing is never 'ignored'").toBe(0)
})

// ── 2. swipe pages horizontally; a swipe is not a pick ───────────────────────────────────────
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
  expect((await state(page)).page).toBe(1)

  // M2: a VERTICAL-dominant gesture must fall through to the card's own scroll — no page.
  // dx is deliberately past the 40px floor (60) so only the dominant-axis check rejects it:
  // a mutant that deletes that check cannot hide behind the floor.
  await swipe(320, 480, 260, 340)
  expect(count(await j.beats(), "land_q_paged") - count(bs, "land_q_paged"), "vertical does not page").toBe(0)

  // rightward swipe → back
  await swipe(220, 420, 330, 418)
  expect((await state(page)).page).toBe(0)

  // M3: a swipe whose synthesized click lands on an option must not answer it. At page 0 a
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
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))
  })
  const post = await j.beats()
  expect(count(post, "mc_correct") - count(pre, "mc_correct"), "the swipe answered nothing").toBe(0)
  expect(count(post, "mc_wrong") - count(pre, "mc_wrong")).toBe(0)
  // …and a PLAIN click (no movement) still answers: the suppressor resets itself
  await answerCorrect(page)
  expect(count(await j.beats(), "land_q_answered"), "a real click still lands").toBe(1)
})

// ── 3. wheel + the branch order + the hidden-card gate ───────────────────────────────────────
test("trackpad deltaX pages once per gesture; arrows never page a hidden or studied card", async ({
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
  expect((await state(page)).page).toBe(0)
  await j.expectBeat("land_q_paged")

  // …but with the study surface open, arrows belong to the DRILL (branch order).
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

  // M4's real kill: a card hidden by the tray suppression — no earlier arrow branch claims the
  // key there, so only the paging branch's own !_landHidden() gate keeps arrows off an
  // invisible card. (_standDown retired in v1.134.0 — a bg tap CLOSES now.)
  await page.evaluate(() => {
    const a = (window as W).__neural
    a.setDeckOpen(false)
    a._suppressTray(true)
  })
  await j.advance(200)
  const hiddenNow = await page.evaluate(() => (window as W).__neural._landHidden())
  expect(hiddenNow, "the stand-down hides the card").toBe(true)
  const b3 = await j.beats()
  await page.keyboard.press("ArrowRight")
  expect(count(await j.beats(), "land_q_paged") - count(b3, "land_q_paged"), "no paging a hidden card").toBe(0)
})

// ── 4. the defense card is exempt ────────────────────────────────────────────────────────────
test("the panic card pages nothing — arrows stay dead on a defense card", async ({ page }) => {
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
  const b0 = await j.beats()
  await page.keyboard.press("ArrowRight")
  expect(count(await j.beats(), "land_q_paged") - count(b0, "land_q_paged"), "arrows page nothing").toBe(0)
})

// ── 5. a technique URL lands ON the technique ────────────────────────────────────────────────
test("a technique page keeps its URL and stages the exchange, card standard @curated", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/Transitions/Side-Control-to-Mount")
  await j.advance(6000)
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => document.body.getBoundingClientRect().top)
    await j.advance(400)
  }
  const a = await page.evaluate(() => {
    const app = (window as W).__neural
    const more = document.querySelector("[data-land-more-body]") as HTMLElement | null
    return {
      url: location.pathname,
      posTy: app.nodes[app.currentPos].ty,
      pos: app.nodes[app.currentPos].t,
      paused: app.paused,
      focus: app.focusIdx >= 0 ? app.nodes[app.focusIdx].t : null,
      staged: app._stagedTech ? { t: app.nodes[app._stagedTech.idx].t, side: app._stagedTech.side } : null,
      cardAbout: app._landIdx != null && app.nodes[app._landIdx] ? app.nodes[app._landIdx].t : null,
      mode: (document.querySelector("[data-landcard]") as HTMLElement | null)?.getAttribute("data-landcard"),
      header: !!document.querySelector("[data-land-id]"),
      playBtn: !!document.querySelector("[data-land-play]"),
      folded: !more || more.style.display === "none",
    }
  })
  // M5: the pre-v1.132.0 behaviour REWROTE the address to /Positions/Side-Control — the owner:
  // "the URL doesn't change, and is still in the same position, which is unrelated"
  expect(a.url, "the address bar still names the technique").toBe("/Transitions/Side-Control-to-Mount")
  expect(a.staged?.t, "the exchange is staged on it").toBe("Side Control to Mount")
  expect(a.staged?.side, "on the performing side").toBe("attacker")
  expect(a.focus, "the graph focus IS the technique").toBe("Side Control to Mount")
  expect(a.cardAbout, "the card reads the technique").toBe("Side Control to Mount")
  expect(a.mode).toBe("attempt")
  expect(a.header, "no header — position-card anatomy").toBe(false)
  expect(a.playBtn, "no 'Roll from here'").toBe(false)
  expect(a.folded, "folded, like every landing").toBe(true)
  expect(a.posTy, "the seat is a real position").toBe("positions")
  expect(a.pos, "…the technique's origin").toContain("Side Control")
  expect(a.paused, "staged: clock held until play").toBe(true)

  // M8 — A DELIBERATELY-OPENED TECHNIQUE CARD IS NEVER EMPTY. Its deck may not be able to build
  // an honest MC (the answer_line content debt: paragraph answers fail every length filter, the
  // owner's Americana report) — then the recall block asks instead. Assert the SHAPE (some
  // question block exists), not which format: content work may later make MC viable here.
  const qBlock = await page.evaluate(() => ({
    q: !!document.querySelector("[data-land-q]"),
    mc: !!document.querySelector("[data-land-mc-opt]"),
    recall: !!document.querySelector("[data-land-recall]"),
  }))
  expect(qBlock.q, "the card asks something").toBe(true)
  expect(qBlock.mc || qBlock.recall, "…as MC or as recall — never an empty card").toBe(true)

  // M9 — the option-label pass yields to the focused pair: the staged technique is a dealt
  // option AND the focus, and drawing both names is the "printed twice" defect. The renderer
  // publishes what it drew (_lastOptLabels / _lastPairLabel — the v1.129.x seam).
  await page.evaluate(() => document.body.getBoundingClientRect().top)
  await j.advance(300)
  const labels = await page.evaluate(() => {
    const app = (window as W).__neural
    const pair = app._lastPairLabel
    const opts = app._lastOptLabels
    const focusPair = app.nodes[app.focusIdx].pairId
    return {
      pairIdx: pair ? pair.idx : null,
      optHasFocus: !!(opts && (opts.includes(app.focusIdx) ||
        opts.some((i2: number) => focusPair && app.nodes[i2].pairId === focusPair))),
      optDrew: !!(opts && opts.length),
    }
  })
  expect(labels.pairIdx, "the pair group names the focused technique").not.toBeNull()
  expect(labels.optHasFocus, "and no option label prints its name a second time").toBe(false)
  expect(labels.optDrew, "…while the other dealt options keep their labels").toBe(true)

  // M10 — a technique's film lives under its PERSPECTIVES in the content chunk
  // (perspectives.attacker.clips — measured: 1 of 1,326 technique entries carry a top-level
  // `clips`). The DSL serves {} for content, so author one and let the backfill dock it.
  await page.evaluate(() => {
    const app = (window as W).__neural
    const key = app.deckKeyFor(app.nodes[app._landIdx]).key.split("|")[0]
    const w = window as any
    w.NG_CONTENT = w.NG_CONTENT || {}
    w.NG_CONTENT.decks = w.NG_CONTENT.decks || {}
    w.NG_CONTENT.decks["Side Control to Mount"] = {
      perspectives: { attacker: { clips: [{ id: "dQw4w9WgXcQ", title: "Seeded clip", by: "Test" }] } },
    }
    void key
    app.onContentReady()
  })
  await j.advance(400)
  await expect(
    page.locator("[data-land-film]"),
    "perspective-nested clips reach the strip",
  ).toBeVisible()
})

// ── 5b. the owner's exact report: a starved deck still asks ──────────────────────────────────
test("the owner's Americana page asks MULTIPLE CHOICE — recognition first, always", async ({
  page,
}) => {
  const j = journey(page)
  // Americana from Kimura Trap|Attacker was the owner's report twice over: first an EMPTY card
  // (411-char paragraph answers starve every MC length filter), then — with the recall fallback
  // alone — "Show answer" at stage 0, inverting the recognise-first progression ("It should
  // have shown me multiple choice … then I finally start to show actual Anki flashcards").
  // The emitter's _hard_clip bridge makes every display answer one-line-comparable, so the MC
  // builds: corpus viability measured 96.3% → 100.0%, worklist 110 → 0. The recall block
  // remains only as a last-resort safety net with no live trigger in this corpus.
  await j.boot("/Submissions/Americana/from-Kimura-Trap")
  await j.advance(6000)
  await j.landQuestion()
  const s = await page.evaluate(() => ({
    about: (window as W).__neural._landIdx != null
      ? (window as W).__neural.nodes[(window as W).__neural._landIdx].t : null,
    q: !!document.querySelector("[data-land-q]"),
    mcOpts: document.querySelectorAll("[data-land-mc-opt]").length,
    recall: !!document.querySelector("[data-land-recall]"),
  }))
  expect(s.about).toBe("Americana from Kimura Trap")
  expect(s.q, "the card asks something").toBe(true)
  // EXACTLY three since v1.148.0: MC_DISTRACTORS = 2 equals the pooler's own recall floor, so a
  // block is either full width or it is not an MC block at all — the degraded 3-of-4 case is gone.
  expect(s.mcOpts, "…as MULTIPLE CHOICE — recognition comes first").toBe(3)
  expect(s.recall, "no stage-0 recall — flashcards are the earned graduation").toBe(false)
})

// ── 5c. recall comes with rank (v1.133.0) ────────────────────────────────────────────────────
test("from blue belt up, a proven card asks as recall in play — below, MC holds", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  // prove the current card to stage 2 (the MC cap), then re-mount: still a WHITE-belt profile,
  // so recognition-first MC must hold even on a proven card
  await page.evaluate(() => {
    const a = (window as W).__neural
    const q = a._landQ
    a._bumpStage(q.key, q.card.q, 2, 2)
    // questionFor re-asks a proven card only when DUE — pin the due seam to this card
    const provenQ = q.card.q
    a._cardDue = (k: string, qq: string) => qq === provenQ
    a._landQ = null
    a.renderLandCard(a.nodes[a.currentPos], "land", null)
  })
  await j.landQuestion()
  const white = await page.evaluate(() => ({
    mc: !!document.querySelector("[data-land-mc-opt]"),
    recall: !!document.querySelector("[data-land-recall]"),
  }))
  expect(white.mc, "below blue, a proven card still asks MC").toBe(true)
  expect(white.recall).toBe(false)

  // the same card under a BLUE belt: the in-play format graduates to timed recall Q/A
  // ("for blue belts at least … flashcard Q/A, not MC" — owner). gameScore is the rank seam.
  await page.evaluate(() => {
    const a = (window as W).__neural
    a.gameScore = () => ({ score: 0.45, belt: "blue", next: null, stripes: 0 })
    a._landQ = null
    a.renderLandCard(a.nodes[a.currentPos], "land", null)
  })
  await j.landQuestion()
  const blue = await page.evaluate(() => ({
    mc: !!document.querySelector("[data-land-mc-opt]"),
    recall: !!document.querySelector("[data-land-recall]"),
    armed: (window as W).__neural._decision?.remaining != null,
  }))
  expect(blue.recall, "blue belt: the proven card asks as recall").toBe(true)
  expect(blue.mc).toBe(false)
  expect(blue.armed, "…and the recall question is on the clock").toBe(true)
})

// ── 6. the defending side = the rush, on arrival ─────────────────────────────────────────────
test("arriving on the defending side brings the red rush — no play button in between @curated", async ({ page }) => {
  const j = journey(page)
  // v1.134.0 (owner): "the rush starts on click" — the transport is retired, so clicking (or
  // arriving on) the ESCAPING side IS choosing to be caught. No setPaused, no latch.
  await j.boot("/Submissions/Kimura/from-Knee-on-Belly/Defender")
  await j.advance(8000)
  const s = await page.evaluate(() => {
    const a = (window as W).__neural
    return {
      defense: a._defendSub != null,
      vignette: !!document.querySelector(".ng-vignette"),
      beats: (a.beats || []).map((b: any) => b.beat),
      escapes: (a.optionIdxs || []).length,
    }
  })
  expect(s.defense, "the catch is live").toBe(true)
  expect(s.vignette, "the vignette burns").toBe(true)
  expect(s.beats, "the rush announced itself").toContain("defend_start")
  expect(s.beats).toContain("caught")
  expect(s.escapes, "the escape hand is dealt — untimed").toBeGreaterThan(0)
})

// ── 7. the finishing side = Finish it, in the hand ───────────────────────────────────────────
test("a staged technique's own card is the go — highlighted, then committed in place @curated", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/Transitions/Side-Control-to-Mount")
  await j.advance(8000)
  const hl = await page.evaluate(() => {
    const a = (window as W).__neural
    const st = a._stagedTech
    const oc = (a._optionCards || []).find((c: any) => c.opt && st && c.opt.idx === st.idx)
    return {
      staged: st ? a.nodes[st.idx].t : null,
      eyebrow: oc ? (oc.card.querySelector("[data-cat]") || {}).textContent : null,
      accent: oc ? oc.card.style.borderColor : null,
    }
  })
  expect(hl.staged, "the exchange is staged").toBe("Side Control to Mount")
  expect(hl.eyebrow, "its card wears the commit verb").toBe("Execute")
  expect(hl.accent, "…and the action accent").toContain("126, 160, 255")
  // committing THAT card runs the exchange IN PLACE — no travel back to the origin
  const path = await page.evaluate(() => {
    const a = (window as W).__neural
    const st = a._stagedTech
    const opt = (a._optList || []).find((o: any) => o.idx === st.idx)
    a._optPick(opt)
    return a.pulse ? a.pulse.path.map((i: number) => a.nodes[i].t) : null
  })
  expect(path, "the pulse never leaves the technique").toEqual(["Side Control to Mount", "Side Control to Mount"])
  await j.advance(3000)
  expect((await j.beats()).map((b) => b.beat), "the commit is a real commit").toContain("commit")
})

// ── 8. a family hub resolves to a member, never a random start ───────────────────────────────
test("a family-hub URL lands on the family, not on a random weighted start", async ({ page }) => {
  const j = journey(page)
  await j.boot("/Submissions/Kimura")
  await j.advance(6000)
  const a = await page.evaluate(() => {
    const app = (window as W).__neural
    return {
      paused: app.paused,
      staged: app._stagedTech ? app.nodes[app._stagedTech.idx].id : null,
      focusId: app.focusIdx >= 0 ? app.nodes[app.focusIdx].id : null,
    }
  })
  // the pre-v1.132.0 behaviour: the hub resolved to NOTHING → a random weighted start, roll
  // RUNNING, with the address bar still naming the family (measured: Electric Chair Top)
  expect(a.staged, "a Kimura variant is staged").toMatch(/^Submissions\/Kimura\//)
  expect(a.paused, "staged and paused — not a running random roll").toBe(true)
})

/* J8 — v1.134.0's three unpinned claims, pinned in one boot.
 * (1) The Win–Lose meter is mirrored at the writer: Win (blue) rides LEFT, so a
 *     30%-toward-win marker paints at left:70%. Kills: dropping the `100 -` mirror.
 * (2) The question clock is PAUSE-IMMUNE — "that's our test to the user" (owner):
 *     setPaused(true) does not stop the drain. Kills: an `if (paused) return` in
 *     _tickDecision.
 * (3) The last three seconds pulse the card itself — ng-clock-hot goes on at ≤3s
 *     and comes off with the disarm. Kills: dropping the hot-class add.
 */
test("@curated the meter mirrors Win-left, and the clock drains through pause into the hot pulse", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/Positions/Side-Control/Bottom")
  await j.advance(6000)
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => document.body.getBoundingClientRect().top)
    await j.advance(400)
  }

  await j.engage() // v1.137.0: the clock waits for the player — this journey plays one
  // (1) the mirrored meter
  const left = await page.evaluate(async () => {
    const a: any = (window as any).__neural
    a.adv = { cur: 30, target: 30, shown: true, glow: 0, glowMag: 1, sign: 1 }
    a.updateAdvMarker()
    return a.legendMarkRef.current.style.left
  })
  expect(parseFloat(left), "30 toward Win paints at left:70% — Win rides LEFT").toBeCloseTo(70, 0)

  // (2) pause immunity — the drain continues while paused
  const armed = await page.evaluate(() => {
    const a: any = (window as any).__neural
    return !!(a._decision && a._decision.total)
  })
  expect(armed, "the landing question armed a clock").toBe(true)
  const drain = await page.evaluate(() => {
    const a: any = (window as any).__neural
    a.setPaused(true)
    const before = a._decision.remaining
    return { before, paused: a.paused }
  })
  expect(drain.paused).toBe(true)
  await j.advance(1200)
  const after = await page.evaluate(() => {
    const a: any = (window as any).__neural
    const r = a._decision ? a._decision.remaining : 0
    a.setPaused(false)
    return r
  })
  expect(after, "the clock drained THROUGH the pause").toBeLessThan(drain.before - 500)

  // (3) the hot pulse at ≤3s, released by the disarm
  await page.evaluate(() => {
    const a: any = (window as any).__neural
    a._decision.remaining = 2500
    a._barF = -1
  })
  await j.advance(400)
  expect(
    await page.evaluate(() => (window as any).__neural._landEl.classList.contains("ng-clock-hot")),
    "the card pulses in the last three seconds",
  ).toBe(true)
  await page.evaluate(() => (window as any).__neural._declineLandQ("test"))
  await j.advance(200)
  expect(
    await page.evaluate(() => {
      const a: any = (window as any).__neural
      return a._landEl ? a._landEl.classList.contains("ng-clock-hot") : false
    }),
    "the disarm takes the pulse with it",
  ).toBe(false)
})
