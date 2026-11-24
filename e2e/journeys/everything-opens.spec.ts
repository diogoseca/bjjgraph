import { expect, test, type Page } from "@playwright/test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { journey } from "../dsl"

/** EVERYTHING OPENS (v1.270.0, the owner, 13 Nov 2026, U163 c): "the belt only shows; timed recall and Recall Mode become
 * settings anyone can turn on".
 *
 * A WHITE belt, pressing as a player does (a real mouse at 1440x900, a touch tap at 390x631, both at measured points that
 * `elementFromPoint` confirms are the control; a scroll first where a player would scroll):
 *   1. opens the Black section of the Path, opens one of its lessons inline and, with that unit's lessons done, starts its
 *      checkpoint. Until v1.270.0 the Black section was "Locked · progress through the earlier belts", with no button.
 *   2. gets a card from a family outside White's lessons in Practice (a later belt's, or one in no belt's lessons): the
 *      session's new decks come from every family. Until v1.270.0 they
 *      came only from the worn belt's families.
 *   3. chooses its answer mode in Settings, no row locked. Until v1.270.0 the Recall Mode row was a locked teaser until
 *      black; from v1.270.0 to v1.282 a switch anyone turned on; since v1.282.0 it is gone (the answer mode's Auto does its
 *      job, rulings R2, SET1-GO; answer-mode.spec.ts).
 * And 4: a blue belt held before the open rule keeps the carry-over as the account's fact, which since v1.282.0 decides
 * nothing and has no switch on screen; nothing stored changes across a reload. The carry's rules in full, and the merge,
 * are unit-tested (tests/belt_worn.test.mjs).
 *
 * CONTROL: dev's own bundle (v1.266.0, 5f2510f71) fails all 7 tests at their first open-rule assertion: "the Black section
 * has a fold toggle" (both), "a new deck from a family outside White's lessons" (both), "the Recall Mode row is a switch"
 * (both), "the carried blue keeps timed recall as the account's fact…".
 * MUTANTS, each alone on this branch's sources rebuilt into the served bundle, each red at the named assertion and green
 * elsewhere (table in docs/Changelog-Archive.md, v1.270.0): OPEN-M1 `beltUnlocked` back to the worn rank -> "the Path draws
 * the Black section" (both: the locked branch is gone, so a closed belt is not drawn at all); OPEN-M7 the family filter back
 * in `planSummary` -> "a new deck from a family outside White's lessons" (both); OPEN-M8 the Settings lock back -> "the
 * Recall Mode row is a switch" (both) and "the carried blue's Settings row is a switch"; OPEN-M4 no carry-over and OPEN-M9
 * the carry writing the switch again -> "the carried blue keeps timed recall as the account's fact…". The other mutants are
 * killed in tests/belt_worn.test.mjs and tests/gameplan_runtime.test.mjs.
 * NOT COVERED here: the capstone of a later belt (it needs every unit of that belt proven; tests/belt_worn.test.mjs starts
 * one on a blue belt) and a roll's question asking front and back (landcard-modes.spec.ts 5c, answer-mode.spec.ts).
 * v1.282.0: tests 3 and 4 were rewritten to the answer mode (their old subject, the Recall Mode switch, left Settings);
 * OPEN-M8 (the Settings lock back) has no row left to lock, and OPEN-M4/M9 are killed in tests/belt_worn.test.mjs.
 */

type W = any
const CUR = JSON.parse(readFileSync(resolve(__dirname, "../../source/public/static/neural/curriculum.json"), "utf8"))
const live = (l: W) => !l.frames || l.frames.includes("gi")
const BLACK = CUR.belts.find((b: W) => b.id === "black")
const UNIT = BLACK.units.find((u: W) => u.lessons.filter(live).length > 0)
const LESSONS: string[] = UNIT.lessons.filter(live).map((l: W) => l.deckKey)
const WHITE_FAMILIES = new Set<string>(CUR.belts.find((b: W) => b.id === "white").units.flatMap((u: W) => u.lessons.map((l: W) => l.deckKey.split("|")[0])))

/** Press a control the way a player does: scroll it into view if a player would have to, confirm the point is the control
 *  (never an overlay above it), then a real mouse click or a touch tap at that point. */
async function press(page: Page, selector: string, what: string, touch: boolean) {
  await page.locator(selector).first().scrollIntoViewIfNeeded()
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

async function boot(page: Page, initialState?: Record<string, unknown>) {
  const j = journey(page)
  await j.boot("/", initialState ? { initialState } : {})
  // the one-time grandfather runs once the curriculum and the manifest are in: the belt is settled from then on
  await expect.poll(() => page.evaluate(() => { const a = (window as W).__neural; return !!(a.curriculum && a.belts && a.belts.gf) })).toBe(true)
  return j
}
const worn = (page: Page) => page.evaluate(() => (window as W).__neural.wornBelt().id)

for (const touch of [false, true]) {
  test.describe(touch ? "touch 390x631" : "mouse 1440x900", () => {
    test.use(touch ? { hasTouch: true, isMobile: true, viewport: { width: 390, height: 631 } } : { viewport: { width: 1440, height: 900 } })

    test(`a white belt opens the Black section, opens one of its lessons and starts its checkpoint (${touch ? "touch" : "mouse"})`, async ({ page }) => {
      // the unit's lessons done (as a player who studied them would have), nothing else: the belt stays white
      await boot(page, { v: 2, prep: Object.fromEntries(LESSONS.map((k) => [k, 3])) })
      expect(await worn(page), "precondition: a white belt").toBe("white")
      await press(page, ".ng-logo", "open the drawer", touch)
      // v1.287.0: the Path row left the drawer; Master the game draws the same corridor (all five belts for a white belt)
      await press(page, '[data-explore-stats] [data-b="due"]', "Master the game", touch)
      // L1 (v1.290.0): the shelf sits folded under "Belt lessons", the list's last row; a player unfolds it there
      await press(page, "[data-master-belts]", "Belt lessons", touch)
      await expect(page.locator('[data-belt="black"]'), "Master the game draws the Black section").toHaveCount(1)
      await expect(page.locator('[data-belt-toggle="black"]'), "the Black section has a fold toggle").toHaveCount(1)
      await expect(page.locator("[data-belt-locked]"), "no section is locked").toHaveCount(0)
      await expect(page.locator('[data-belt="black"]')).toHaveAttribute("data-collapsed", "true")
      await press(page, '[data-belt-toggle="black"]', "unfold Black", touch)
      await expect(page.locator('[data-belt="black"]'), "Black unfolds").toHaveAttribute("data-collapsed", "false")
      const lesson = `[data-belt="black"] [data-lesson="${LESSONS[0]}"]`
      await press(page, lesson, "a Black lesson", touch)
      // the Path opened the lesson's cards inline in its corridor; Master the game opens them as a session row (v1.287.0)
      const box = page.locator(`[data-session] [data-mini-deck="${LESSONS[0]}"]`)
      await expect(box, "the lesson's cards open in the session").toBeVisible()
      await expect(box.locator("[data-mini-q]"), "…with a question on its card").toHaveCount(1)
      const cp = `[data-checkpoint="black/${UNIT.id}"]`
      await expect(page.locator(cp), "the unit's checkpoint is offered").toHaveText("Start checkpoint")
      await press(page, cp, "Start checkpoint", touch)
      await expect.poll(() => page.evaluate(() => (window as W).__neural._checkpoint?.uk || null), { message: "the Black checkpoint starts" }).toBe("black/" + UNIT.id)
      await expect(page.locator("[data-mc-opt]").first(), "its quiz asks").toBeVisible()
      expect(await worn(page), "the belt itself is untouched").toBe("white")
    })

    test(`a white belt gets a card from a family outside White's lessons in Practice (${touch ? "touch" : "mouse"})`, async ({ page }) => {
      await boot(page)
      await press(page, ".ng-logo", "open the drawer", touch)
      await journey(page).knowsPlanMoves()   // L2 (v1.292.0): a place's moves come before its cards; this journey is about the cards
      await press(page, '[data-explore-stats] [data-b="due"]', "the Practice row", touch)
      await expect(page.locator("[data-practice-page]")).toHaveCount(1)
      await expect.poll(() => page.evaluate(() => !!(window as W).__neural._session?.plan), { message: "the plan lands" }).toBe(true)
      // L1 (v1.290.0): "More new cards" sits under the open card, so the list's button comes first, as a player presses it
      await press(page, "[data-master-start]", "Master the game's button", touch)
      await press(page, "[data-plan-more]", "More new cards", touch)
      const later = await page.evaluate((white) => {
        const a = (window as W).__neural
        const fresh = a._session.plan.fresh.map((r: W) => r.key)
        return fresh.find((k: string) => !white.includes(k.split("|")[0])) || null
      }, [...WHITE_FAMILIES])
      expect(later, "a new deck from a family outside White's lessons").not.toBeNull()
      // reach it the way the page offers: the session queue, under "Practice details & session queue"
      await press(page, "[data-practice-details] > summary", "Practice details & session queue", touch)
      const jump = await page.evaluate((key) => {
        const b = [...document.querySelectorAll("[data-practice-queue] button")].find((x) => x.textContent === key.replace("|", " · "))
        if (b) b.setAttribute("data-eo-jump", "1")
        return !!b
      }, later)
      expect(jump, "the queue lists it").toBe(true)
      await press(page, "[data-eo-jump]", "its queue entry", touch)
      const row = page.locator(`[data-session-row="${later}"]`)
      await expect(row, "its row opens").toHaveAttribute("aria-expanded", "true")
      await expect(row.locator("xpath=following-sibling::div[1]").locator("[data-mini-q]"), "…on a question card").toBeVisible()
      expect(await worn(page)).toBe("white")
    })

    // 3, since v1.282.0: the Recall Mode switch left Settings (its job is the answer mode's Auto, R2); what stays true of U163 c
    // is that no belt locks a Flashcards row, so a white belt chooses its answer mode like anyone (answer-mode.spec.ts owns
    // the row's words and default)
    test(`a white belt chooses its answer mode in Settings, with no locked row (${touch ? "touch" : "mouse"})`, async ({ page }) => {
      await boot(page)
      await press(page, ".ng-logo", "open the drawer", touch)
      await press(page, ".ngAcctChip", "the badge", touch)
      await press(page, "[data-menu-settings]", "Settings", touch)
      await press(page, '[data-settings-tab="flashcards"]', "the Flashcards tab", touch)
      await expect(page.locator("[data-answer-mode]"), "the Answer mode row").toHaveCount(1)
      await expect(page.locator("[data-recall-locked]")).toHaveCount(0)
      await expect(page.locator("[data-recall-mode]"), "no Recall Mode row since v1.282.0").toHaveCount(0)
      await press(page, "[data-answer-mode] button:nth-of-type(2)", "Multiple choice", touch)
      expect(await page.evaluate(() => (window as W).__neural.settings.mcMode), "a white belt's press is stored").toBe("mc")
      const shown = await page.locator("[data-answer-mode] button").nth(1).evaluate((b) => getComputedStyle(b).backgroundColor)
      expect(shown, "Multiple choice shows chosen").toBe("rgba(74, 108, 255, 0.26)")
    })
  })
}

// 4, since v1.282.0: the carry-over is kept as the account's fact and decides nothing (the answer mode decides a roll's
// format, R2); Settings has no switch to show it, and nothing stored changes across a reload. The carry's rules and merge
// stay unit-tested (tests/belt_worn.test.mjs, `carried`).
test("a blue belt held before the open rule: the carry is kept as the account's fact, decides nothing, and nothing stored changes across a reload", async ({ page }) => {
  // blue, first earned at t=1000 by an older version of the app: this account has never run the open rule (no `openAt`)
  const j = await boot(page, { v: 2, belts: { won: {}, gf: 5, held: { id: "blue", t: 1000 } } })
  expect(await worn(page)).toBe("blue")
  const read = () => page.evaluate(() => { const a = (window as W).__neural; return { stored: a.settings.recallInPlay ?? null, mode: a.settings.mcMode ?? null, fact: a._recallCarry === true, stamped: a._openAt > 1000 } })
  expect(await read(), "the carried blue is the account's fact; no switch and no mode are written").toEqual({ stored: null, mode: null, fact: true, stamped: true })
  await page.evaluate(() => (window as W).__neural.openSettings("flashcards"))
  await expect(page.locator("[data-answer-mode]"), "Settings shows the answer mode").toHaveCount(1)
  await expect(page.locator("[data-recall-mode]"), "and no switch for the carry").toHaveCount(0)
  expect(await page.locator("[data-answer-mode] button").first().evaluate((b) => getComputedStyle(b).backgroundColor), "Auto, like everyone who chose nothing").toBe("rgba(74, 108, 255, 0.26)")
  await page.evaluate(() => (window as W).__neural._flushSave())
  await j.boot("/", { preserveStorage: true })
  await expect.poll(() => page.evaluate(() => { const a = (window as W).__neural; return !!(a.curriculum && a.belts && a.belts.gf) })).toBe(true)
  expect(await worn(page), "after a reload: still blue").toBe("blue")
  expect(await read(), "and still nothing written for the switch or the mode, the fact kept").toEqual({ stored: null, mode: null, fact: true, stamped: true })
})
