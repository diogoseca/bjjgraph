import { test, expect } from "@playwright/test"
import { journey } from "../dsl"

/**
 * P1 — THE QUESTION-FIRST LANDING.
 *
 * The flashcard stopped being a place you go and became what the game asks you on arrival:
 * identity (what this is, where you came from, which side you're playing, have you met it) →
 * film → ONE multiple-choice question → your options → "More" for everything else.
 *
 * Economy (one rule on both surfaces, no double-counting):
 *   right → the ordinary credit path (mastery + sharpness already move the odds) + clock refund
 *   wrong → a transient _qMod hit on THIS exchange only, forgiven on the next arrival
 *
 * Keys: A/B/C/D answer the live MC block; digits stay the option-card openers.
 * The right sidebar is the STUDY surface and now reads back as classic recall by default.
 *
 * Surfaces: [data-landcard] [data-land-count] [data-land-q] [data-land-more] [data-land-close]
 * Beats: land_q_shown, land_q_answered {correct, tier, qMod}
 */

/** the live MC truth (correct index + option count) — the same rail mc-flashcards.spec uses */
const truth = (page: any) =>
  page.evaluate(() => {
    const m = (window as any).__neural._mc
    return m ? { correct: m.correct, n: m.n, surface: m.surface } : null
  })

/** a mid-band option: clear of both clamp zones so a pump/penalty is visible */
const midOption = async (page: any) =>
  page.evaluate(() => {
    const a = (window as any).__neural
    for (const i of a.optionIdxs || []) {
      const n = a.nodes[i]
      const odds = Math.round(a.moveChance(n) * 100)
      if (odds >= 20 && odds <= 70) return n.t
    }
    return (a.nodes[(a.optionIdxs || [])[0]] || {}).t || ""
  })

test("landing asks one question; a right answer pumps the odds and refunds the clock", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  await expect(page.locator("[data-landcard]"), "landing card docked above the hand").toBeVisible()
  await expect(page.locator("[data-landcard]"), "the card is up").toBeVisible()
  // v1.101.1: no header block on a landing — the counter is the card's meta, in the foot
  await expect(page.locator("[data-land-foot] [data-land-count]"), "counter in the foot").toHaveCount(1)
  await expect(page.locator("[data-land-q]"), "one question").toBeVisible()
  await j.expectBeat("land_q_shown")

  const t = await midOption(page)
  const before = await j.displayedOdds(t)
  const clockBefore = await page.evaluate(() => (window as any).__neural.decisionRemaining())

  const mc = await truth(page)
  expect(mc?.surface, "the landing block owns the keyboard").toBe("land")
  await page.keyboard.press("abcd"[mc!.correct])

  expect(await j.displayedOdds(t), "odds up after a right answer").toBeGreaterThan(before)
  // v1.133.0: the clock times the question, so answering DISARMS it — no refund exists
  expect(
    await page.evaluate(() => (window as any).__neural.decisionRemaining()),
    "the window is spent by the answer",
  ).toBe(0)
  void clockBefore
  const answered = (await j.beats()).filter((b: any) => b.beat === "land_q_answered")
  expect(answered.length).toBe(1)
  expect((answered[0] as any).correct).toBe(true)
})

test("a wrong answer costs THIS exchange only — the next arrival forgives it", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  const t = await midOption(page)
  const before = await j.displayedOdds(t)
  const mc = await truth(page)
  await page.keyboard.press("abcd"[(mc!.correct + 1) % mc!.n])

  expect(await j.displayedOdds(t), "odds down after a wrong answer").toBeLessThan(before)
  const qMod = await page.evaluate(() => (window as any).__neural._qMod)
  expect(qMod, "a transient penalty, not a permanent one").toBeLessThan(0)

  // play the move out and arrive somewhere new — the penalty does not follow you.
  // Rig the resolve+outcome to the success branch: the fail branch can chain into an
  // opponent catch whose defense-expiry ride exceeds nextHand's sim-time cap.
  await j.rig("resolve", [0.01])
  await j.rig("outcome", [0.01])
  await j.pick(t)
  await j.nextHand()
  expect(await page.evaluate(() => (window as any).__neural._qMod), "forgiven on arrival").toBe(0)
})

test("a proven deck asks nothing — the card degrades to identity", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await expect(page.locator("[data-land-q]")).toBeVisible()

  await page.evaluate(() => {
    const a = (window as any).__neural
    const key = a.deckKeyFor(a.nodes[a.currentPos]).key
    for (const c of a.flashcards.decks[key].cards) a._bumpStage(key, c.q, 4)
    a.renderLandCard(a.nodes[a.currentPos], "land", null)
  })

  await expect(page.locator("[data-land-q]"), "nothing left to ask").toHaveCount(0)
  await expect(page.locator("[data-landcard]"), "identity still lands").toBeVisible()
  await expect(page.locator("[data-landcard]")).toBeVisible()
})

test("the sidebar reads back as classic recall — multiple choice is the in-roll format", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  expect(
    await page.evaluate(() => (window as any).__neural.get("mcMode", "classic")),
    "shipped default",
  ).toBe("classic")

  // open the sidebar: its cards must reveal, not offer options. Scoped to the pane — the
  // LANDING card legitimately has [data-mc-opt] buttons of its own, which is the whole point.
  await page.locator(".ng-logo").click()
  await page.locator('.ng-learning-nav [data-view="history"]').click()
  await expect(
    page.locator(".ng-drill [data-mc-opt]"),
    "no multiple choice in the study pane",
  ).toHaveCount(0)
  const paneMc = await page.evaluate(() => {
    const a = (window as any).__neural
    const key = a.deckKeyFor(a.nodes[a.currentPos]).key
    const card = a.flashcards.decks[key].cards[0]
    return a.mcActive(key, card)
  })
  expect(paneMc, "the study surface does not quiz you multiple-choice by default").toBe(false)
})

test("digits still open option sheets while a landing question is live", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await expect(page.locator("[data-land-q]")).toBeVisible()

  await page.keyboard.press("1")
  await expect(page.locator("[data-go]"), "digit 1 opened the first option's sheet").toBeVisible()
})

test("the identity chip fuses the seen-glyph with the deck's recall count and opens study", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")

  // one top-right chip, not two adjacent familiarity indicators (v1.76.0 merged-glyph decision)
  const chip = page.locator("[data-land-foot] [data-land-count]")
  await expect(chip, "the chip rides the identity row").toBeVisible()
  const label = await chip.getAttribute("data-land-count")
  const state = await page.evaluate(() => {
    const a = (window as any).__neural
    const key = a.deckKeyFor(a.nodes[a.currentPos]).key
    const deck = a.flashcards && a.flashcards.decks ? a.flashcards.decks[key] : null
    const total = deck && deck.cards ? deck.cards.length : 0
    return { total, done: Math.min((a.prep && a.prep[key]) || 0, total) }
  })
  expect(state.total, "this landing has an authored deck").toBeGreaterThan(0)
  expect(label, "chip carries done/total").toBe(`${state.done}/${state.total}`)

  // clicking it is a manual study open — pane-law-legal, lands on the History tab's deck
  await chip.click()
  expect(
    await page.evaluate(() => !!(window as any).__neural.deckShown),
    "chip click opened the pane",
  ).toBe(true)
  expect(
    await page.evaluate(() => (window as any).__neural._viewMode),
    "on the History tab (study this state)",
  ).toBe("history")
  await j.expectBeat("pane_paused")
})

/**
 * SPENT MEANS SPENT (v1.135.0). Owner: "when i click a wrong answer after i run out of time it
 * shouldnt lose me points as it already did for punishing not answering under time constraint."
 * _expireLandQ takes the miss ONCE (−4%, combo break, failed SRS review) and reveals the answer —
 * but the MC closure's own `answered` latch never learned it, so the visually-disabled buttons
 * still graded: a late wrong click charged −4% again, broke the combo again, wrote a second
 * failed review, and emitted land_q_answered AFTER land_q_expired. The expiry now sets
 * `truth.spent` (the closure's door) and `done` refuses a spent rec.
 * Mutant that must die: dropping `|| truth.spent` from _mcBlock's answer guard.
 * Recorded non-kill: the `rec.revealed` guard in _mountLandQ's done is belt-and-braces behind
 * the spent guard and is unreachable while it stands — no spec can turn it red alone. It is
 * revealed-only on purpose: a DECLINED question (sheet, pane, bg) is un-revealed, and answering
 * it after backing out still pays — keyboard.spec.ts pins that.
 */
test("@curated a timed-out question is spent — a late click grades nothing", async ({ page }) => {
  const j = journey(page)
  await j.boot("/Positions/Side-Control/Bottom")
  await j.advance(6000)
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => document.body.getBoundingClientRect().top)
    await j.advance(400)
  }
  await j.engage() // v1.137.0: the clock waits for the player — this journey plays one
  const armed = await page.evaluate(() => {
    const a: any = (window as any).__neural
    return !!(a._decision && a._decision.remaining != null && a._mc && a._mc.surface === "land")
  })
  expect(armed, "a landing MC question armed the clock").toBe(true)
  await page.evaluate(() => ((window as any).__neural._decision.remaining = 1))
  await j.advance(600)
  const at = await page.evaluate(() => {
    const a: any = (window as any).__neural
    return {
      expired: (a.beats || []).some((b: any) => b.beat === "land_q_expired"),
      beats: (a.beats || []).length,
      qMod: a._qMod || 0,
      combo: a._combo || 0,
    }
  })
  expect(at.expired, "the clock expiry revealed the answer as a miss").toBe(true)

  // the late click — a WRONG option, straight at the DOM the way a user would
  const clicked = await page.evaluate(() => {
    const wrap = document.querySelector("[data-land-q] [role='radiogroup']")
    if (!wrap) return false
    const btns = [...wrap.querySelectorAll("[data-land-mc-opt]")] as HTMLElement[]
    const correct = btns.findIndex((b) => b.getAttribute("data-mc-result") === "correct")
    const wrong = btns.find((_, i) => i !== correct)
    if (!wrong) return false
    wrong.click()
    return true
  })
  expect(clicked, "a wrong option existed to click").toBe(true)
  await j.advance(400)
  const after = await page.evaluate(() => {
    const a: any = (window as any).__neural
    return {
      beats: (a.beats || []).length,
      newBeats: [] as string[],
      qMod: a._qMod || 0,
      combo: a._combo || 0,
      answeredBeat: (a.beats || []).some((b: any) => b.beat === "land_q_answered"),
      wrongBeat: (a.beats || []).some((b: any) => b.beat === "mc_wrong"),
    }
  })
  expect(after.qMod, "no second −4%").toBe(at.qMod)
  expect(after.combo, "no second combo break").toBe(at.combo)
  expect(after.answeredBeat, "an expired question never reads as answered").toBe(false)
  expect(after.wrongBeat, "and the click graded nothing").toBe(false)
  expect(after.beats, "no beat of any kind from the spent block").toBe(at.beats)

  // ...but the click still TALKS (v1.135.0, owner: "it should appear red when he clicks it. The
  // previously red answer … should appear non-red"): the red mark rides the LAST clicked wrong
  // answer, the green never moves, and none of it emits a beat.
  // Mutant that must die: making `explore` in _mcBlock a no-op.
  const paint = await page.evaluate(() => {
    const wrap = document.querySelector("[data-land-q] [role='radiogroup']")!
    const btns = [...wrap.querySelectorAll("[data-land-mc-opt]")] as HTMLElement[]
    const correct = btns.findIndex((b) => b.getAttribute("data-mc-result") === "correct")
    const wrongs = btns.map((_, i) => i).filter((i) => i !== correct)
    return { correct, wrongs }
  })
  expect(paint.wrongs.length, "two wrong options to walk").toBeGreaterThanOrEqual(2)
  const mark = (i: number) =>
    page.evaluate((k) => {
      const btns = [...document.querySelectorAll("[data-land-q] [data-land-mc-opt]")] as HTMLElement[]
      btns[k].click()
      return btns.map((b) => b.getAttribute("data-mc-result"))
    }, i)
  const m1 = await mark(paint.wrongs[0])
  expect(m1[paint.wrongs[0]], "the first exploratory click wears red").toMatch(/wrong|plausible|trap/)
  const m2 = await mark(paint.wrongs[1])
  expect(m2[paint.wrongs[1]], "the red moved to the second click").toMatch(/wrong|plausible|trap/)
  expect(m2[paint.wrongs[0]], "and left the first").toBeNull()
  expect(m2[paint.correct], "the green never moves").toBe("correct")
  const beatsEnd = await page.evaluate(() => ((window as any).__neural.beats || []).length)
  expect(beatsEnd, "exploration emits nothing").toBe(at.beats)
})

/**
 * EXPIRY IS FLUID (v1.135.1). Owner: "There's this weird flash where the landcard disappears
 * and a new landcard appears again … It should be fluid. It shouldn't be abrupt."
 * The flash was CSS: `.ng-clock-hot`'s animation shorthand REPLACED the card's ngCardInX entry
 * animation, and Chrome replays the finished entry from zero when the shorthand changes back —
 * even with the name kept at the same list position (measured; the name-position continuation
 * does not survive a finished animation). So the pulse is JS now: frame-driven border/box-shadow
 * writes in _tickDecision, eased off by a one-shot transition at disarm; .ng-clock-hot is a
 * marker class with no rule. The clock bar eases home the same way, shedding the hot red for
 * the base color it was armed with.
 * Mutants that must die: dropping the JS pulse write; snapping the bar (no transition).
 */
test("@curated expiry is fluid — no re-entry replay, the bar eases home", async ({ page }) => {
  const j = journey(page)
  await j.boot("/Positions/Side-Control/Bottom")
  await j.advance(6000)
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => document.body.getBoundingClientRect().top)
    await j.advance(400)
  }
  await j.engage() // v1.137.0: the clock waits for the player — this journey plays one
  const armed = await page.evaluate(() => {
    const a: any = (window as any).__neural
    return !!(a._decision && a._decision.remaining != null && a._landEl)
  })
  expect(armed, "a landing question armed the clock").toBe(true)
  // into the hot band, then catch the disarm within a frame of it happening
  await page.evaluate(() => ((window as any).__neural._decision.remaining = 2500))
  await j.advance(400)
  const hot = await page.evaluate(() => {
    const el = (window as any).__neural._landEl
    return { cls: el.classList.contains("ng-clock-hot"), border: el.style.borderColor }
  })
  expect(hot.cls, "the hot marker is on").toBe(true)
  expect(hot.border, "and the pulse actually paints").toContain("255, 110, 110")
  // the entry animation runs on the WALL clock while advances pump the game clock faster —
  // let the genuine mount animation finish first, so a running ngCardInX after the disarm can
  // only be a replay
  await page.waitForTimeout(450)
  // the harness drives the game clock — expire through a pumped advance, then read at once
  await page.evaluate(() => ((window as any).__neural._decision.remaining = 30))
  await j.advance(200)
  const after = await page.evaluate(() => {
    const a: any = (window as any).__neural
    const card = a._landEl
    const bar = card.querySelector("[data-land-clock]")
    return {
      replaying: card.getAnimations().filter((x: any) => x.animationName === "ngCardInX" && x.playState === "running").length,
      hot: card.classList.contains("ng-clock-hot"),
      barTransition: bar ? bar.style.transition : null,
      barTransform: bar ? bar.style.transform : null,
      barBg: bar ? bar.style.background : null,
    }
  })
  expect(after.replaying, "the entry animation did NOT replay — no flash").toBe(0)
  expect(after.hot, "the pulse stood down with the window").toBe(false)
  expect(after.barTransition, "the bar eases home through a transition").toContain("transform")
  expect(after.barTransform).toBe("scaleX(0)")
  expect(after.barBg, "and sheds the hot red for its armed base").toBe("rgb(159, 176, 208)")
})

/**
 * THE CLOCK WAITS FOR THE PLAYER (v1.137.0). Owner: "The drill countdown starts during page
 * load — a first-time Guest can land on TOO SLOW · −4% before ever interacting … no drill
 * timer starts until the user's first real interaction AND the question card is fully visible;
 * add a first-session grace multiplier (~1.5×) for brand-new users. Keep full time pressure
 * once engaged."
 * Mutants that must die: arming immediately (gate dropped); the 1.5× grace dropped; the
 * document-level latch removed (a real mouse move must arm it).
 */
test("@curated no clock before the first real interaction — then full pressure, with new-user grace", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/Positions/Side-Control/Bottom") // boot only — NO land(), NO engagement
  await j.advance(9000) // a long, slow "page load"
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => document.body.getBoundingClientRect().top)
    await j.advance(500)
  }
  const idle = await page.evaluate(() => {
    const a: any = (window as any).__neural
    return {
      engaged: !!a._engaged,
      armed: !!(a._decision && a._decision.remaining != null),
      parked: !!a._cwArm,
      expired: (a.beats || []).some((b: any) => b.beat === "land_q_expired"),
      qMod: a._qMod || 0,
      cardUp: !!a._landEl,
    }
  })
  expect(idle.cardUp, "the landing question is on screen").toBe(true)
  expect(idle.engaged, "nobody has touched anything").toBe(false)
  expect(idle.armed, "so no clock is running").toBe(false)
  expect(idle.parked, "the arm is parked, waiting").toBe(true)
  expect(idle.expired, "and nothing ever expired during load").toBe(false)
  expect(idle.qMod, "no loading penalty").toBe(0)

  // the first REAL interaction — a graph hover the document-level latch can see
  await page.mouse.move(4, 4)
  await page.mouse.move(6, 6)
  await j.advance(300)
  const armed = await page.evaluate(() => {
    const a: any = (window as any).__neural
    return {
      engaged: !!a._engaged,
      total: a._decision ? a._decision.total : null,
      base: a.get("decisionSec", 9) * 1000,
      returning: a._returningVisitor(),
      beat: (a.beats || []).some((b: any) => b.beat === "engaged"),
    }
  })
  expect(armed.engaged, "one hover engages").toBe(true)
  expect(armed.beat).toBe(true)
  expect(armed.returning, "a fresh profile is a brand-new user").toBe(false)
  expect(armed.total, "…who gets the 1.5× grace window").toBe(armed.base * 1.5)

  // a returning visitor gets the full-pressure window — same seam, marker present
  const vet = await page.evaluate(() => {
    const a: any = (window as any).__neural
    try { localStorage.setItem("bjj-neural-firstroll", "1") } catch (e) {}
    a._returning = null // re-derive the latched answer from the marker
    a._disarmLandClock()
    a._decision = { remaining: null, total: null, warned: 0, pick: null, opts: [] }
    a._armLandClock(a._landEl ? a._landEl.querySelector("[data-land-clock]") : null, true)
    return { total: a._decision.total, base: a.get("decisionSec", 9) * 1000 }
  })
  expect(vet.total, "a returning visitor keeps full pressure").toBe(vet.base)
})
