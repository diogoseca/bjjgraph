import { expect, test, type Page } from "@playwright/test"
import { journey } from "../dsl"

/** ANSWER MODE: ONE SWITCH, ONE MEANING, EVERYWHERE A CARD IS ASKED (v1.283.0, the owner 15 Nov; rulings R1/R2, SET1-GO).
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
 *   3. Last rolls' inline deck asks the answer mode too (Auto: a new card as multiple choice, on its own surface), and an
 *      answer there is a grade.
 *   4. A stored Front Back cards asks a new card front and back in Practice and in a roll; a stored Multiple choice keeps a
 *      card right twice multiple choice in Practice and in a roll; and the old Recall mode switch, stored Off, decides nothing.
 * CONTROL: dev v1.280.1 (fb498b389), where the default was Classic recall and Recall mode decided a roll: 1 fails at "Auto
 * is the chosen one", 2 at "a new card asks multiple choice", 3 at "the inline deck asks multiple choice", 4 at "the old
 * switch decides nothing".
 * MUTANTS (each alone, rebuilt into the served bundle against a manifest copy carrying its pin; run 16 Nov by the seat's
 * scratch mutants2.py, not a gate; the table in docs/Changelog-Archive.md, v1.283.0). Two neutral controls first, one in
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
      await press(page, '[data-explore-stats] [data-b="due"]', "Master the game", touch)
      await expect(page.locator("[data-practice-page]")).toHaveCount(1)
      const open = '[data-session-row][aria-expanded="true"] + div'
      await expect(page.locator(open + " [data-practice-mc-opt]"), "a new card asks multiple choice").toHaveCount(3, { timeout: 20_000 })
      const { key, q } = await practiceCard(page)
      expect(key && q, "the open card is known").toBeTruthy()
      // right twice: stage 2 (the journeys' seam, the grade's arithmetic: two right answers)
      await page.evaluate(([k, qq]) => { const a = (window as W).__neural; a._bumpStage(k, qq, 2, 2); a.renderSession() }, [key, q])
      await expect(page.locator(open + " [data-practice-mc-opt]"), "a card right twice asks front and back").toHaveCount(0)
      await press(page, open + " [data-mini-reveal]", "Reveal", touch)
      await press(page, open + " [data-mini-again]", "Again (a miss)", touch)
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

    test(`Last rolls: the inline deck asks the answer mode too, and an answer there is a grade (${touch ? "touch" : "mouse"})`, async ({ page }) => {
      const j = journey(page)
      await j.boot("/")
      await j.land("Mount Top")
      await press(page, ".ng-logo", "open the drawer", touch)
      await press(page, '[data-view="history"]', "Last rolls", touch)
      await press(page, "[data-hist-current]", "this roll's row", touch)
      const deck = page.locator("[data-mini-deck]").first()
      await expect(deck.locator("[data-inline-mc-opt]"), "the inline deck asks a new card as multiple choice").toHaveCount(3, { timeout: 20_000 })
      const before = await page.evaluate(() => { const a = (window as W).__neural; return { key: a._mc?.key, qh: a._mc?.qhash, surface: a._mc?.surface } })
      expect(before.surface, "on its own surface").toBe("inline")
      await press(page, '[data-mini-deck] [data-inline-mc-opt="0"]', "answer A", touch)
      await expect.poll(() => page.evaluate(({ key, qh }) => { const a = (window as W).__neural; return !!(a.srs[key] && a.srs[key][qh]) }, before),
        { message: "the answer is a grade (its schedule row exists)" }).toBe(true)
    })
  })
}

test("Practice: a stored Front Back cards asks a new card front and back; a stored Multiple choice asks a card right twice as multiple choice", async ({ page }) => {
  const j = journey(page)
  await j.boot("/", { initialState: { v: 2, settings: { mcMode: "classic" }, settingsAt: { mcMode: 5 } } })
  await j.clickByMouse(".ng-logo", "open the drawer")
  await j.clickByMouse('[data-explore-stats] [data-b="due"]', "Master the game")
  const open = '[data-session-row][aria-expanded="true"] + div'
  await expect(page.locator(open + " [data-mini-q]"), "the first card is up").toHaveCount(1, { timeout: 20_000 })
  await expect(page.locator(open + " [data-mini-reveal]"), "Front Back cards: a new card asks front and back").toHaveText(/Reveal/)
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
