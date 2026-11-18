import { expect, test, type Page } from "@playwright/test"
import { journey } from "../dsl"

/** ANSWER MODE: ONE SWITCH, ONE MEANING, EVERYWHERE A CARD IS ASKED (v1.282.0, the owner 15 Nov; rulings R1/R2, SET1-GO).
 * Owner: "by default we use the Auto, not Classic (which should be called Front Back cards, or the Multiple Choice). after
 * a player dominates MC for a card he is shown FC crds, and never again the multiple choice".
 *
 * Pressed as a player does: a real mouse at 1440x900 and a touch tap at 390x631, each at a measured point that
 * `elementFromPoint` confirms is the control (a scroll first where a player would scroll).
 *   1. Nothing stored is Auto, by the reader's default and never by a write: Settings shows Answer mode with Auto first and
 *      chosen, the words say where it applies, the three rows that left are gone (Focus with them, U190 c), and storage
 *      still has no `mcMode` after a save. A press writes the choice.
 *   2. Practice asks a new card as multiple choice; a card right twice (stage 2) asks front and back; a miss there keeps it
 *      at 2 (the floor) and resets its schedule, and the card is never multiple choice again.
 *   3. From Last rolls, "Practise here" opens the place in Master the game, where the card asks the answer mode (Auto: a
 *      new card as multiple choice), and an answer there is a grade. (Until v1.293.0, L3, the row held its own inline deck,
 *      which asked the mode on a surface of its own, "inline"; a row is a place now and holds no card.)
 *   4. A stored Front Back cards asks a new card front and back in Practice and in a roll; a stored Multiple choice keeps a
 *      card right twice multiple choice in Practice and in a roll; and the old Recall mode switch, stored Off, decides nothing.
 *   5. (the reader of #423) "Never again" is per question: a question right twice in one deck asks front and back from every
 *      deck that shares it (D2); in the full-pane study view Space and ⏎ never reveal or grade a multiple-choice card (D4);
 *      a list's drill asks the answer mode too, and a press there is a grade (D5).
 *   6. (the reader's re-read, SET1-R2) One gate for every way of revealing: in the study view, while a card's options are on
 *      their way there is no reveal control; when they land it is multiple choice; when their load fails it asks front and
 *      back and can be answered (the options' request held, or failed, at the route).
 * CONTROL: dev v1.280.1 (fb498b389), where the default was Classic recall and Recall mode decided a roll: 1 fails at "Auto
 * is the chosen one", 2 at "a new card asks multiple choice", 3 at "the inline deck asks multiple choice", 4 at "the old
 * switch decides nothing".
 * MUTANTS (each alone, rebuilt into the served bundle against a manifest copy carrying its pin; run 16 Nov by the seat's
 * scratch mutants2.py, not a gate; the table in docs/Changelog-Archive.md, v1.282.0). Two neutral controls first, one in
 * app.src.jsx and one in knowledge-profile.src.js: every killer below stayed green. Killed here: default back to
 * "classic" (1, 2); a write of `mcMode` at boot (1, at "storage has no mcMode"); no floor in the grade (2); the landing
 * reads `recallInPlay` again (4, "the old switch"); a stored "mc" ignored in a roll (4); Last rolls' decks ignoring the
 * mode (3); `mcActive` ignoring a stored "classic" (4, "Practice: a stored Front Back cards…"); Auto's line moved from 2
 * to 3 (2, 4); the Focus row put back (1, at "Focus left Settings"). NOT run against this file: the floor at 1, the floor from stage 1, and no floor in `_bumpStage`; those
 * are killed by tests/knowledge_profile.test.mjs's floor table. A boot write is killed HERE only: the units never run the
 * constructor (belt_worn and settings_presentation stayed green under it).
 * The harness serves `{}` for dossiers: no claim here reads a film or an article section.
 */

type W = any
const ACTIVE = "rgba(74, 108, 255, 0.26)"   // `segBtn`'s chosen background (everything-opens.spec.ts reads the same)

async function press(page: Page, selector: string, what: string, touch: boolean) {
  // the drawer's list re-renders in place as payloads land (the first run met "Element is not attached" here): re-query
  for (let i = 0; ; i++) {
    try { await page.locator(selector).first().scrollIntoViewIfNeeded({ timeout: 3_000 }); break }
    catch (e) { if (i >= 4) throw e; await page.waitForTimeout(250) }
  }
  const at = await page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement | null
    if (!el) return { ok: false, why: "no element matches", x: 0, y: 0 }
    const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2
    const top = document.elementFromPoint(x, y)
    let alpha = 1
    for (let n: HTMLElement | null = el; n; n = n.parentElement) alpha *= Number(getComputedStyle(n).opacity)
    if (alpha < 0.5) return { ok: false, why: "effective opacity " + alpha.toFixed(2), x, y }
    return { ok: !!top && (top === el || el.contains(top)), why: top ? "<" + top.tagName.toLowerCase() + " " + (top as HTMLElement).className + ">" : "nothing", x, y }
  }, selector)
  expect(at.ok, `${what}: the point under the press is the control (${at.why})`).toBe(true)
  if (touch) await page.touchscreen.tap(at.x, at.y)
  else await page.mouse.click(at.x, at.y)
}

const stored = (page: Page) => page.evaluate(() => {
  const a = (window as W).__neural
  a._flushSave()
  const raw = localStorage.getItem("bjj-neural-owner:guest:progress")
  const blob = raw ? JSON.parse(raw).blob : null
  return { memory: a.settings.mcMode ?? null, disk: blob && blob.settings ? blob.settings.mcMode ?? null : null, saved: !!blob }
})

/** The open Practice card: its deck and question, read off the live multiple-choice truth or the open row's own card. */
const practiceCard = (page: Page) => page.evaluate(() => {
  const a = (window as W).__neural
  const key = document.querySelector('[data-session-row][aria-expanded="true"]')?.getAttribute("data-session-row")
  const cards = a._cardsOf(a.flashcards.decks[key]) || []
  const qh = a._mc && a._mc.surface === "practice" && a._mc.key === key ? a._mc.qhash : null
  const text = (document.querySelector('[data-session-row][aria-expanded="true"] + div [data-mini-q]') as HTMLElement | null)?.textContent || ""
  const card = cards.find((c: W) => (qh ? a.qhash(c.q) === qh : c.q.replace(/<[^>]+>/g, "") === text))
  return { key, q: card ? card.q : null }
})

for (const touch of [false, true]) {
  test.describe(touch ? "touch 390x631" : "mouse 1440x900", () => {
    test.use(touch ? { hasTouch: true, isMobile: true, viewport: { width: 390, height: 631 } } : { viewport: { width: 1440, height: 900 } })

    test(`nothing stored is Auto: Settings shows it first and chosen, storage never gets it, a press writes it (${touch ? "touch" : "mouse"})`, async ({ page }) => {
      const j = journey(page)
      await j.boot("/")
      await press(page, ".ng-logo", "open the drawer", touch)
      await press(page, ".ngAcctChip", "the badge", touch)
      await press(page, "[data-menu-settings]", "Settings", touch)
      await press(page, '[data-settings-tab="flashcards"]', "the Flashcards tab", touch)
      const row = page.locator("[data-answer-mode]")
      await expect(row, "the Answer mode row").toHaveCount(1)
      await expect(row.locator("button"), "three choices, Auto first, Classic renamed").toHaveText(["Auto", "Front Back cards", "Multiple choice"])
      await expect(row, "the words say where it applies").toContainText("How a card asks you, in Practice and in a roll.")
      await expect(row).not.toContainText("HERE")
      await expect(row, "Auto's line").toContainText("multiple choice until you get a card right twice, then front and back from then on")
      const bg = await row.locator("button").evaluateAll((bs) => bs.map((b) => getComputedStyle(b).backgroundColor))
      expect(bg.map((c) => c === ACTIVE), "Auto is the chosen one").toEqual([true, false, false])
      await expect(page.locator("[data-recall-mode]"), "Recall mode (in play) left Settings").toHaveCount(0)
      await expect(page.locator(".ng-modal"), "and so did Show flashcards on pages").not.toContainText("Show flashcards on pages")
      await expect(page.locator(".ng-modal")).not.toContainText("Recall mode")
      // U190 c (the owner, 16 Nov: "Take the row off the screen"): Focus left too; the tab is Daily goal and Answer mode
      await expect(page.locator(".ng-modal"), "the tab's first row is drawn").toContainText("Daily goal")
      await expect(page.locator(".ng-modal"), "Focus left Settings").not.toContainText(/Focus|Antifragile|Converge|Shore up weaknesses/)
      expect(await stored(page), "storage has no mcMode: Auto is the reader's default, never a write").toEqual({ memory: null, disk: null, saved: true })
      await press(page, "[data-answer-mode] button:nth-of-type(2)", "Front Back cards", touch)
      await expect.poll(() => page.locator("[data-answer-mode] button").evaluateAll((bs) => bs.map((b) => getComputedStyle(b).backgroundColor === "rgba(74, 108, 255, 0.26)")),
        { message: "Front Back cards is chosen" }).toEqual([false, true, false])
      expect(await stored(page), "a press writes the choice").toEqual({ memory: "classic", disk: "classic", saved: true })
    })

    test(`Practice: a new card asks multiple choice, a card right twice asks front and back, and a miss never sends it back (${touch ? "touch" : "mouse"})`, async ({ page }) => {
      const j = journey(page)
      await j.boot("/")
      await press(page, ".ng-logo", "open the drawer", touch)
      await j.knowsPlanMoves()   // L2 (v1.292.0): a place's moves come before its cards; this journey is about the cards' answer form
      await press(page, '[data-explore-stats] [data-b="due"]', "Master the game", touch)
      await expect(page.locator("[data-practice-page]")).toHaveCount(1)
      // L1 (v1.290.0): Master the game opens as a list with one button; its press opens the day's first card, as the row did by itself before
      await expect(page.locator("[data-master-start]")).toBeEnabled({ timeout: 20_000 })
      await press(page, "[data-master-start]", "Master the game's button", touch)
      const open = '[data-session-row][aria-expanded="true"] + div'
      await expect(page.locator(open + " [data-practice-mc-opt]"), "a new card asks multiple choice").toHaveCount(3, { timeout: 20_000 })
      const { key, q } = await practiceCard(page)
      expect(key && q, "the open card is known").toBeTruthy()
      // right twice: stage 2 (the journeys' seam, the grade's arithmetic: two right answers)
      await page.evaluate(([k, qq]) => { const a = (window as W).__neural; a._bumpStage(k, qq, 2, 2); a.renderSession() }, [key, q])
      await expect(page.locator(open + " [data-practice-mc-opt]"), "a card right twice asks front and back").toHaveCount(0)
      await press(page, "[data-master-bar] [data-mini-reveal]", "Reveal", touch)
      await press(page, "[data-master-bar] [data-mini-again]", "Again (a miss)", touch)
      const after = await page.evaluate(([k, qq]) => {
        const a = (window as W).__neural, day = a._epochDay(), qh = a.qhash(qq)
        return { stage: a.cardStage(k, qq), row: a.srs[k][qh], day, mc: a._cardAsksMc(k, { q: qq }) }
      }, [key, q])
      expect(after.stage, "the floor: a miss at 2 keeps 2").toBe(2)
      expect(after.row, "the miss still resets its schedule: due tomorrow").toEqual([after.day + 1, 1, after.day])
      expect(after.mc, "never multiple choice again").toBe(false)
      // and on screen, on the study view (no one-grade-a-day latch there): front and back
      await page.evaluate(([k, qq]) => {
        const a = (window as W).__neural
        a.openStudy(k)
        a.deckIdx = Math.max(0, (a.drillEntries[0].cards || []).findIndex((c: W) => c.q === qq))
        a.revealed = false; a.renderDrill()
      }, [key, q])
      await expect(page.locator(".ng-drill [data-reveal]"), "the study view asks it front and back").toBeVisible()
      await expect(page.locator(".ng-drill [data-mc-opt]"), "with no options").toHaveCount(0)
    })

    // v1.293.0 (L3): RE-POINTED, nothing removed. The row held an inline deck that asked the mode on its own surface
    // ("inline"); a row is a place now, and "Practise here" opens it in Master the game, where the same two claims are made
    // on the same card: a new card asks multiple choice, and an answer there is a grade. "On its own surface" became "on
    // Master the game's surface": the surface "inline" left with the deck. Mutant, on dev's build before and this one after:
    // the inline deck never asks multiple choice (`_miniDeck`'s `recognition`) → red at "asks a new card as multiple choice".
    test(`Last rolls: Practise here opens the place where the card asks the answer mode too, and an answer there is a grade (${touch ? "touch" : "mouse"})`, async ({ page }) => {
      const j = journey(page)
      await j.boot("/")
      await j.land("Mount Top")
      await j.knowsPlanMoves()   // L2: a place's moves come before its cards; this journey is about the cards' answer form
      await press(page, ".ng-logo", "open the drawer", touch)
      await press(page, '[data-view="history"]', "Last rolls", touch)
      await press(page, "[data-hist-current]", "this roll's row", touch)
      await expect(page.locator(".ng-drill [data-mini-deck]"), "the row holds no card").toHaveCount(0)
      await press(page, "[data-hist-go]", "Practise here", touch)
      const open = '[data-session-row][aria-expanded="true"] + div'
      await expect(page.locator(open + " [data-practice-mc-opt]"), "the place's card asks a new card as multiple choice").toHaveCount(3, { timeout: 20_000 })
      const before = await page.evaluate(() => { const a = (window as W).__neural; return { key: a._mc?.key, qh: a._mc?.qhash, surface: a._mc?.surface } })
      expect(before.surface, "on Master the game's surface").toBe("practice")
      expect(before.key, "the place's own deck").toBe("Mount|Top")
      await press(page, open + ' [data-practice-mc-opt="0"]', "answer A", touch)
      await expect.poll(() => page.evaluate(({ key, qh }) => { const a = (window as W).__neural; return !!(a.srs[key] && a.srs[key][qh]) }, before),
        { message: "the answer is a grade (its schedule row exists)" }).toBe(true)
    })
  })
}

// L1-R0 (v1.290.0): the open card's buttons (Reveal, Review again, Got it, ‹ ›) are moved into the drawer's foot, one bar
// for the open ask (`_masterDock`): pressed there, `[data-master-bar]`, the same buttons with the same handlers
test("Practice: a stored Front Back cards asks a new card front and back; a stored Multiple choice asks a card right twice as multiple choice", async ({ page }) => {
  const j = journey(page)
  await j.boot("/", { initialState: { v: 2, settings: { mcMode: "classic" }, settingsAt: { mcMode: 5 } } })
  await j.clickByMouse(".ng-logo", "open the drawer")
  await j.knowsPlanMoves()   // L2 (v1.292.0): a place's moves come before its cards; this journey is about the cards' answer form
  await j.clickByMouse('[data-explore-stats] [data-b="due"]', "Master the game")
  await j.startMaster()   // L1 (v1.290.0): Master the game opens as a list with one button; its press opens the day's first card, as the row did by itself before
  const open = '[data-session-row][aria-expanded="true"] + div'
  await expect(page.locator(open + " [data-mini-q]"), "the first card is up").toHaveCount(1, { timeout: 20_000 })
  await expect(page.locator("[data-master-bar] [data-mini-reveal]"), "Front Back cards: a new card asks front and back").toHaveText(/Reveal/)
  await expect(page.locator(open + " [data-practice-mc-opt]")).toHaveCount(0)
  const { key, q } = await practiceCard(page)
  await page.evaluate(([k, qq]) => { const a = (window as W).__neural; a.set("mcMode", "mc"); a._bumpStage(k, qq, 2, 2); a.renderSession() }, [key, q])
  await expect(page.locator(open + " [data-practice-mc-opt]"), "Multiple choice: a card right twice still asks multiple choice").toHaveCount(3, { timeout: 20_000 })
})

test("a roll: a stored Front Back cards asks even a new card front and back; a stored Multiple choice keeps a card right twice as multiple choice; the old switch decides nothing", async ({ page }) => {
  const j = journey(page)
  // Front Back cards, pressed before this version (a stored "classic"): a roll's first question, a new card
  await j.boot("/", { initialState: { v: 2, settings: { mcMode: "classic" }, settingsAt: { mcMode: 5 } } })
  await j.land("Mount Top")
  await j.openQuestion()
  const fb = await page.evaluate(() => ({ mc: document.querySelectorAll("[data-land-mc-opt]").length, recall: !!document.querySelector("[data-land-recall]") }))
  expect(fb, "Front Back cards: a new card in a roll asks front and back").toEqual({ mc: 0, recall: true })
  // the same landing re-asked on a card right twice (the due seam pinned to it, as landcard-modes.spec.ts 5c does)
  const reask = () => page.evaluate(() => {
    const a = (window as W).__neural
    const q = a._landQ
    a._bumpStage(q.key, q.card.q, 2, 2)
    const proven = q.card.q
    a._cardDue = (_k: string, qq: string) => qq === proven
    a._landQ = null
    a.renderLandCard(a.nodes[a.currentPos], "land", null)
  })
  const shape = () => page.evaluate(() => ({ mc: document.querySelectorAll("[data-land-mc-opt]").length, recall: !!document.querySelector("[data-land-recall]") }))
  // Multiple choice: a card right twice stays multiple choice in a roll
  await page.evaluate(() => (window as W).__neural.set("mcMode", "mc"))
  await reask()
  await j.landQuestion()
  expect(await shape(), "a stored Multiple choice: a card right twice asks multiple choice in a roll").toEqual({ mc: 3, recall: false })
  // nothing stored for the mode, the old Recall mode switch stored Off: Auto decides, front and back
  await page.evaluate(() => { const a = (window as W).__neural; delete a.settings.mcMode; a.settings.recallInPlay = false })
  await page.evaluate(() => { const a = (window as W).__neural; a._landQ = null; a.renderLandCard(a.nodes[a.currentPos], "land", null) })
  await j.landQuestion()
  expect(await shape(), "the old switch decides nothing: Auto asks a card right twice front and back").toEqual({ mc: 0, recall: true })
})

// D2 (the reader of #423): "never again" is per QUESTION. The grade writes a card's stage to the deck it was asked from; a
// question several decks share, right twice in one of them, must ask front and back from the others too (Auto reads the
// highest stage the question holds in any of its decks, `_cardStageShared`, as the rating does). Read on the full-pane study
// view of the OTHER deck, before (multiple choice: the premise) and after the question is proven in the first.
// Mutant: `_cardAsksMc` reading the asking deck's stage only → red at "front and back in the deck that shares it".
test("a question right twice in one deck asks front and back in every deck that shares it", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await page.waitForFunction(() => !!(window as W).__neural._sharedQ, null, { timeout: 30_000 })
  const sh = await page.evaluate(async () => {
    const a = (window as W).__neural
    for (const [qh, keys] of a._sharedQ) {
      const [A, B] = keys
      await a.hydrateDecks([A, B])
      const cA = a._cardsOf(a.flashcards.decks[A]) || [], cB = a._cardsOf(a.flashcards.decks[B]) || []
      const card = cB.find((c: W) => a.qhash(c.q) === qh)
      if (card && cA.some((c: W) => a.qhash(c.q) === qh) && a.mcDistractors(card, B, a.MC_DISTRACTORS, "probe")) return { A, B, qh, q: card.q }
    }
    return null
  })
  expect(sh, "premise: a shared question both of whose decks can ask it as multiple choice").not.toBeNull()
  const show = () => page.evaluate(({ B, qh }) => {
    const a = (window as W).__neural
    a.openStudy(B)
    a.deckIdx = Math.max(0, a.deck.findIndex((c: W) => a.qhash(c.q) === qh)); a.revealed = false; a.renderDrill()
    return a.qhash(a.deck[a.deckIdx].q) === qh
  }, sh!)
  expect(await show(), "premise: the study view shows the shared question").toBe(true)
  await expect(page.locator(".ng-drill [data-mc-opt]"), "premise: unproven, the other deck asks it as multiple choice").toHaveCount(3, { timeout: 20_000 })
  // right twice in the first deck only: the stage is written there (the grade's own bucket)
  await page.evaluate(({ A, q }) => (window as W).__neural._bumpStage(A, q, 2, 2), sh!)
  expect(await page.evaluate(({ A, B, q }) => { const a = (window as W).__neural; return [a.cardStage(A, q), a.cardStage(B, q)] }, sh!), "premise: the stage lives in the first deck").toEqual([2, 0])
  await page.evaluate(() => (window as W).__neural.closeStudy?.())
  expect(await show()).toBe(true)
  await expect(page.locator(".ng-drill [data-reveal]"), "front and back in the deck that shares it").toBeVisible({ timeout: 20_000 })
  await expect(page.locator(".ng-drill [data-mc-opt]"), "and no options").toHaveCount(0)
})

// D4 (the reader of #423): in the full-pane study view a card that asks multiple choice is answered by picking. Space (and ⏎)
// reach `drillReveal` from the key handler; two Space presses graded the card "Got it" as a recall answer with no option
// picked, minting recall credit, under the default. Read by the real keyboard, with no control focused.
// Mutant: `drillReveal` without its multiple-choice guard → red at "no grade".
test("the study view: Space on a multiple-choice card reveals nothing and grades nothing", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  const key = await page.evaluate(() => { const a = (window as W).__neural; return a.deckKeyFor(a.nodes[a.currentPos]).key })
  await j.hydrate([key])
  await page.evaluate((k) => (window as W).__neural.openStudy(k), key)
  await expect(page.locator(".ng-drill [data-mc-opt]"), "nothing stored: Auto, a new card asks multiple choice").toHaveCount(3, { timeout: 20_000 })
  const read = () => page.evaluate(() => { const a = (window as W).__neural, c = a.deck[a.deckIdx]
    return { stage: a.cardStage(a._deckInfo.key, c.q), attempts: Object.keys(a._knowledgeAttempts || {}).length, revealed: !!a.revealed, done: a.practiceToday().done } })
  const before = await read()
  await page.evaluate(() => { const e = document.activeElement as HTMLElement | null; if (e && e.blur) e.blur() })   // Space goes to the app's key handler
  await page.keyboard.press("Space")
  await page.keyboard.press("Space")
  await page.keyboard.press("Enter")
  expect(await read(), "no reveal, no grade: the card waits for a pick").toEqual(before)
  await expect(page.locator(".ng-drill [data-mc-opt]"), "and its options are still there").toHaveCount(3)
})

// D5 (the reader of #423): every session that lays its cards out as inline decks asks the answer mode too (R2, "everywhere a
// card is asked"): a list's drill and a received class's (`openListSession`), a System's drill and the bucket sessions. On
// the default a new card there asks multiple choice, on the session's surface, and a press is a grade. Until v1.282.0 these
// were front and back whatever the mode. The list drill is pinned here, by mouse and by touch.
for (const touch of [false, true]) {
  test.describe(touch ? "touch 390x631, a list drill" : "mouse 1440x900, a list drill", () => {
    test.use(touch ? { hasTouch: true, isMobile: true, viewport: { width: 390, height: 631 } } : { viewport: { width: 1440, height: 900 } })
    test(`a list's drill asks a new card as multiple choice, and a press grades it (${touch ? "touch" : "mouse"})`, async ({ page }) => {
      const j = journey(page)
      await j.boot("/")
      await j.land("Mount Top")
      const id = await page.evaluate(async () => {
        const a = (window as W).__neural
        const id = a.newList("Answer mode drill")
        const picks = a.nodes.filter((n: W) => { const k = a.deckKeyFor(n).key; return k && a.flashcards.decks[k] && a.flashcards.decks[k].n >= 3 && a.rsAllowsIdx(n.idx) }).slice(0, 3)
        for (const n of picks) a.addToList(n.id, id)
        return id
      })
      await page.evaluate((lid) => (window as W).__neural.openListSession(lid), id)   // a list's drill, through its seam
      const open = '[data-session-row][aria-expanded="true"] + div'
      await expect(page.locator(open + " [data-practice-mc-opt]"), "nothing stored: Auto, the drill's new card asks multiple choice").toHaveCount(3, { timeout: 20_000 })
      expect(await page.evaluate(() => !!(window as W).__neural._session?.practice), "premise: a list session, not Practice").toBe(false)
      await expect(page.locator(open + " [data-mini-reveal]"), "Reveal waits for an answer").toBeDisabled()
      const t = await page.evaluate(() => { const a = (window as W).__neural; return { key: a._mc.key, qh: a._mc.qhash } })
      await press(page, open + ' [data-practice-mc-opt="0"]', "answer A", touch)
      await expect.poll(() => page.evaluate(({ key, qh }) => { const a = (window as W).__neural; return !!(a.srs[key] && a.srs[key][qh]) }, t), { message: "the press is a grade" }).toBe(true)
    })
  })
}

// SET1-R2 (the reader's re-read of #423, finding 4): ONE GATE FOR EVERY WAY OF REVEALING. In the full-pane study view a card
// whose multiple-choice options were still on their way drew "Reveal answer", whose click set `revealed` itself, round
// `drillReveal`'s guard, and led to a recall "Got it" with no option picked. Now, while the options load, there is no reveal
// control at all (a disabled "Loading answers…", as the inline decks show); when they land the card is multiple choice; when
// their load FAILS the card asks front and back and can be answered.
// THE REQUEST IS REAL, held (or failed) at the route. Every card carries its own authored wrong answers, so for most cards the
// options need no other deck and are ready a microtask after the card is drawn: nothing to hold. 141 of 21,269 cards
// (both rulesets, measured on this wire) need another deck's answers; COLD_DECK holds such cards, and the journey finds one
// with the app's own dry pass (`mcDistractors` under `_mcNeed`, as `_warmMcPool` runs it), then holds exactly the chunks
// that pass asked for. If content moves the deck off that list, the premise fails by name.
// Mutants: the old footer (Reveal drawn while loading, setting `revealed` itself) → red at "no reveal control while they
// load"; a failed load left loading → red at "a failed load asks front and back".
const COLD_DECK = "Backstep from Leg Weave|Defender"
for (const touch of [false, true]) {
  test.describe(touch ? "touch 390x631, options on their way" : "mouse 1440x900, options on their way", () => {
    test.use(touch ? { hasTouch: true, isMobile: true, viewport: { width: 390, height: 631 } } : { viewport: { width: 1440, height: 900 } })
    for (const fail of [false, true]) test(`the study view while a card's options load: nothing to reveal, then ${fail ? "a failed load asks front and back" : "multiple choice when they land"} (${touch ? "touch" : "mouse"})`, async ({ page }) => {
      const j = journey(page)
      await j.boot("/")
      await j.hydrate([COLD_DECK])
      // the card, and the chunks its options ask for, by the app's own dry pass (rolled back: no draw is spent)
      const cold = await page.evaluate((key) => {
        const a = (window as W).__neural
        for (const c of a._cardsOf(a.flashcards.decks[key]) || []) {
          a._mcNeed = []; a._rngBegin()
          try { a.mcDistractors(c, key, a.MC_DISTRACTORS, null) } catch (e) { /* the pass aborts at the first cold deck */ } finally { a._rngRollback() }
          const need = a._mcNeed; a._mcNeed = null
          if (need.length) return { qh: a.qhash(c.q), files: need.map((k: string) => a.qhash(k) + ".json") }
        }
        return null
      }, COLD_DECK)
      expect(cold, `premise: ${COLD_DECK} has a card whose options need another deck`).not.toBeNull()
      let release!: () => void
      const gate = new Promise<void>((r) => { release = r })
      const held: string[] = []
      await page.route("**/flashcards/*.json", async (route) => {
        if (!cold!.files.some((f) => route.request().url().endsWith("/" + f))) return route.fallback()
        held.push(route.request().url())
        if (fail) return route.abort()
        await gate
        return route.fallback()
      })
      const read = () => page.evaluate(() => { const a = (window as W).__neural, c = a.deck && a.deck[a.deckIdx]
        return { attempts: Object.keys(a._knowledgeAttempts || {}).length, revealed: !!a.revealed, stage: c ? a.cardStage(a._deckInfo.key, c.q) : null } })
      expect(await page.evaluate(({ key, qh }) => { const a = (window as W).__neural; a.openStudy(key); return a.presentCard(qh) }, { key: COLD_DECK, qh: cold!.qh }),
        "premise: the study view presents that card").toBe(true)
      const foot = page.locator(".ng-drill")
      await expect.poll(() => held.length, { message: "premise: the options' request was made (and is held, or failed)" }).toBeGreaterThan(0)
      if (!fail) {
        expect(await page.evaluate(() => { const a = (window as W).__neural, c = a.deck[a.deckIdx]; return a.mcActive(a._deckInfo.key, c) && !a.mcPoolWarm(a._deckInfo.key, c) }),
          "premise: a new card asking multiple choice, its options on their way").toBe(true)
        await expect(foot.locator("[data-mc-loading], [data-reveal]"), "premise: the card's footer is drawn").toHaveCount(1)
        await expect(foot.locator("[data-reveal]"), "no reveal control while they load").toHaveCount(0)
        await expect(foot.locator("[data-mc-loading]"), "the footer says the answers are loading").toBeVisible()
        await expect(foot.locator("[data-mc-loading]")).toBeDisabled()
        const before = await read()
        await press(page, ".ng-drill [data-mc-loading]", "the loading footer", touch)
        await page.evaluate(() => { const e = document.activeElement as HTMLElement | null; if (e && e.blur) e.blur() })
        for (const k of ["Space", "Space", "Enter", "ArrowDown"]) await page.keyboard.press(k)
        expect(await read(), "and nothing a press or a key does reveals or grades it").toEqual(before)
        release()
        await expect(foot.locator("[data-mc-opt]"), "when the options land the card is multiple choice").toHaveCount(3, { timeout: 20_000 })
        await expect(foot.locator("[data-reveal]"), "still nothing to reveal").toHaveCount(0)
        await expect(foot.locator("[data-mc-loading]")).toHaveCount(0)
      } else {
        await expect(foot.locator("[data-reveal]"), "a failed load asks front and back, with its Reveal").toBeVisible({ timeout: 20_000 })
        await expect(foot.locator("[data-mc-opt]"), "and no options").toHaveCount(0)
        await expect(foot.locator("[data-mc-loading]")).toHaveCount(0)
        const before = await read()
        await press(page, ".ng-drill [data-reveal]", "Reveal answer", touch)
        await expect.poll(async () => (await read()).revealed, { message: "the reveal goes through the one gate" }).toBe(true)
        const got = page.locator(".ng-drill button", { hasText: "Got it" })
        await expect(got).toBeVisible()
        await got.evaluate((b) => b.setAttribute("data-test-got", "1"))
        await press(page, '.ng-drill [data-test-got="1"]', "Got it", touch)
        await expect.poll(async () => (await read()).attempts, { message: "and it can be answered: a front-and-back grade" }).toBe(before.attempts + 1)
      }
    })
  })
}

// D1 (U194), THE OWNER'S ANSWER (16 Nov, SET1-R3): (a), Multiple choice means it everywhere. A stored Multiple choice is
// honoured on every surface, Last rolls' and the Path's decks included, so a card is never asked from memory, and the goals
// that need one proven from memory ("Prove a card from memory", the four "Recall-prove …") wait until the choice changes. The
// line under the option says both. Here every card of the deck stands at 2, what right picks can reach. Settings shows the
// line; Last rolls asks the card as multiple choice; a right pick leaves it at 2 and the goal waiting; Auto, chosen in Settings,
// asks the next card front and back there, and one Got it proves it.
// keepTutorial: the harness otherwise marks the 20 White objectives done at boot, this one among them; the coach card is hidden
// (its own hide does that) without completing anything.
// Mutant: (b)'s exception put back (`_miniDeck`'s recognition skipping the inline surface under a stored `mc`) → red at
// "multiple choice in Last rolls under a stored Multiple choice".
// v1.293.0 (L3): RE-POINTED, nothing removed. Last rolls' row holds no card; "Practise here" opens the place in Master the
// game, and every step is made there, on the same deck: multiple choice under a stored Multiple choice, a right pick that
// proves nothing from memory, Auto getting the goal back. The buttons are the foot's (`[data-master-bar]`, L1-R0). The
// mutant is the same exception, on the surface the card now has: a stored `mc` asks a card right twice front and back
// (`_cardAsksMc`) → red at "multiple choice from Last rolls under a stored Multiple choice", on dev's build before
// (against the test as it was) and on this build after.
const MC_LINE = "always three answers to pick from. A card is never asked from memory, so the goals that need one proven from memory wait until you change this."
for (const touch of [false, true]) {
  test.describe(touch ? "touch 390x631, a stored Multiple choice" : "mouse 1440x900, a stored Multiple choice", () => {
    test.use(touch ? { hasTouch: true, isMobile: true, viewport: { width: 390, height: 631 } } : { viewport: { width: 1440, height: 900 } })
    test(`a stored Multiple choice asks multiple choice from Last rolls too; the from-memory goals wait, and Auto gets them back (${touch ? "touch" : "mouse"})`, async ({ page }) => {
      const j = journey(page)
      await j.boot("/", { keepTutorial: true, initialState: { v: 2, settings: { mcMode: "mc" }, settingsAt: { mcMode: 5 } } })
      await page.evaluate(() => { const a = (window as W).__neural; a.tutHidden = true; a.renderTutorial() })
      await j.land("Mount Top")
      const key = await page.evaluate(async () => {
        const a = (window as W).__neural, key = a.deckKeyFor(a.nodes[a.currentPos]).key
        await a.hydrateDeck(key)
        for (const c of a._cardsOf(a.flashcards.decks[key]) || []) a._bumpStage(key, c.q, 2, 2)
        return key
      })
      const goal = () => page.evaluate(() => (window as W).__neural.challengeProgress("white.recall").done)
      expect(await goal(), "premise: not yet proven from memory").toBe(false)
      // the account menu and Settings fade in, and `press` refuses a control under effective opacity 0.5 (the neutral
      // control met it once in two): wait until the control is fully shown, then press it where it is
      const shown = (sel: string) => expect.poll(() => page.evaluate((s) => {
        let a = 1; for (let n = document.querySelector(s) as HTMLElement | null; n; n = n.parentElement) a *= Number(getComputedStyle(n).opacity)
        return a
      }, sel), { message: sel + " is fully shown" }).toBeGreaterThan(0.99)
      const settings = async () => {
        await press(page, ".ngAcctChip", "the badge", touch)
        await shown("[data-menu-settings]")
        await press(page, "[data-menu-settings]", "Settings", touch)
        await shown('[data-settings-tab="flashcards"]')
        await press(page, '[data-settings-tab="flashcards"]', "the Flashcards tab", touch)
      }
      // the line under the chosen option
      await press(page, ".ng-logo", "open the drawer", touch)
      await settings()
      const row = page.locator("[data-answer-mode]")
      await expect(row, "the line says a card is never asked from memory and the goals wait").toContainText(MC_LINE)
      await shown(".ng-modal .x")
      await press(page, ".ng-modal .x", "close Settings", touch)
      // from Last rolls, Practise here: multiple choice, and a right pick proves nothing from memory
      await press(page, '[data-view="history"]', "Last rolls", touch)
      await press(page, "[data-hist-current]", "this roll's row", touch)
      await press(page, "[data-hist-go]", "Practise here", touch)
      const deck = page.locator(`[data-mini-deck="${key}"]:visible`)
      await expect(deck.locator("[data-practice-mc-opt]"), "multiple choice from Last rolls under a stored Multiple choice").toHaveCount(3, { timeout: 20_000 })
      await expect(page.locator("[data-master-bar] [data-mini-reveal]"), "and nothing to reveal").toBeDisabled()
      const live = await page.evaluate(() => { const a = (window as W).__neural, m = a._mc; return m && m.surface === "practice" ? { key: m.key, qh: m.qhash, right: m.correct } : null })
      expect(live && live.key, "premise: the open card is this deck's, in Master the game").toBe(key)
      await press(page, `[data-mini-deck="${key}"] [data-practice-mc-opt="${live!.right}"]`, "the right answer", touch)
      await expect.poll(() => page.evaluate(({ key, qh }) => { const a = (window as W).__neural; return !!(a.srs[key] && a.srs[key][qh]) }, live!),
        { message: "the pick is a grade" }).toBe(true)
      expect(await page.evaluate(({ key, qh }) => (window as W).__neural.stage[key][qh], live!), "a right pick leaves the card at 2").toBe(2)
      expect(await goal(), "the from-memory goal waits").toBe(false)
      // how a player gets it back: choose Auto; the next card of the deck, at 2, asks front and back
      await settings()
      await shown("[data-answer-mode] button:nth-of-type(1)")
      await press(page, "[data-answer-mode] button:nth-of-type(1)", "Auto", touch)
      expect(await page.evaluate(() => (window as W).__neural.get("mcMode")), "the choice is stored").toBe("auto")
      await press(page, ".ng-modal .x", "close Settings", touch)
      await press(page, "[data-master-bar] .mn", "the next card", touch)
      await expect(deck.locator("[data-practice-mc-opt]"), "Auto asks a card right twice front and back").toHaveCount(0)
      await expect(page.locator("[data-master-bar] [data-mini-reveal]")).toBeEnabled()
      await press(page, "[data-master-bar] [data-mini-reveal]", "Reveal", touch)
      await press(page, "[data-master-bar] [data-mini-got]", "Got it", touch)
      await expect.poll(goal, { message: "\"Prove a card from memory\" is reached" }).toBe(true)
    })
  })
}
