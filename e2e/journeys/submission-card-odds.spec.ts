import { expect, test, type Page } from "@playwright/test"
import { journey } from "../dsl"

/**
 * THE SUBMISSION CARD'S SMALL NUMBER (v1.213.0). Owner, 2026-10-01: "inspect why every submission
 * from the position have 100% chance ... it should be obvious that's a direct navigation ... going
 * for a triangle from closed guard is difficult".
 *
 * A submission dealt on a position is an ENTRY: picking it steps you into the submission with
 * certainty, and the gamble is the finish that follows. The card used to print the step ("Entry
 * 100%"). It now prints "Works" and the FINISH chance the landed state will roll — the engine's own
 * number (mdp-adapter `followUp`), the same one inside the card's Win chance. Win chance itself is
 * unchanged.
 *
 * WHY A PRACTISED PROFILE. With no practice the finish priced at THIS state and at the landed state
 * agree on most cards (468 of 524 corpus entries), so a build that priced it here would pass. Practice
 * on the position's own deck separates them: here it adds the position bonus; inside the submission
 * the position bonus is the submission's own deck. The control below proves the two differ on this
 * hand, so "Works == the Finish card you are then dealt" can fail.
 *
 * Mutants, recorded 2026-10-01 on the built bundle (one at a time, rebuilt, this file run):
 *   - an entry printing its own step (`ngChoiceValueImmediate` reading the immediate chance): red at
 *     "never prints 100%";
 *   - the follow-up priced at the CURRENT state (adapter `context(s, …)` / `moveChance(s, …)`): red
 *     at the control and at "Works == Finish";
 *   - the Inspect sheet's row printing `moveChance(n)` for an entry: red at "sheet == card".
 * Harness note: dossier chunks are served as `{}`, so the sheet has no film; nothing here reads one.
 */

const DECK = "Closed Guard|Bottom"
const PRACTISED = {
  v: 2, prep: { [DECK]: 5 }, rec: { [DECK]: 3 }, stage: {}, srs: {}, units: {}, belts: { won: {} },
  tut: { done: {} }, challenges: {}, badges: {}, coins: {}, days: {}, settings: {}, settingsAt: {}, updatedAt: 0,
}
const NAMED = ["Triangle Choke from Closed Guard", "Armbar from Guard", "Kimura from Guard"]

const settled = (page: Page) => expect.poll(() => page.evaluate(() => {
  const a = (window as any).__neural, s = a?._choiceValues?.snapshot()
  return !!(s && s.handId === a._choiceHandId && ["ready", "bounded"].includes(s.status) && !a._execution)
}), { timeout: 120_000, message: "Win chance values settle for this hand" }).toBe(true)

const faces = (page: Page) => page.evaluate(() => {
  const a = (window as any).__neural
  return [...document.querySelectorAll('[data-choice-group] [data-tech], [data-choice-group] [data-threat-tech]')].map((c: any) => {
    const t = c.getAttribute("data-tech") || c.getAttribute("data-threat-tech"), n = a.nodes.find((x: any) => x.t === t)
    return { t, threat: c.hasAttribute("data-threat-tech"), ty: n && n.ty,
      label: (c.querySelector("[data-immediate-label]")?.textContent || "").trim(),
      odds: (c.querySelector(".ngodds")?.textContent || "").trim(),
      // what the card PRINTS about chances — never its title ("100% Sweep" is a technique's name)
      text: [c.querySelector(".ngodds")?.textContent, c.querySelector("[data-choice-win], [data-threat-win]")?.textContent,
        (c.querySelector("[data-choice-execute]")?.getAttribute("aria-label") || "").replace(/^[^.]*\./, ""),
        c.querySelector("[data-choice-value]")?.getAttribute("title"), c.querySelector("[data-threat-win]")?.getAttribute("title")].join(" | "),
      here: n ? Math.round(a.moveChance(n) * 100) : null }
  })
})

test("a submission card prints the finish it leads to, never its certain step, and the Finish card agrees", async ({ page }) => {
  const j = journey(page)
  await j.boot("/Positions/Closed-Guard/Bottom", { initialState: PRACTISED })
  await j.advance(4000)
  const seat = await page.evaluate(() => { const a = (window as any).__neural; return { at: a.nodes[a.currentPos].t, role: a.playerRole, posKey: a._posKey, prep: a.prep } })
  expect(seat.role, "seated on the bottom of closed guard").toBe("bottom")
  expect(seat.posKey).toBe(DECK)
  expect(seat.prep[DECK], "the position deck carries practice").toBe(5)
  await settled(page)

  const cards = await faces(page)
  const subs = cards.filter((c) => !c.threat && c.ty === "submissions")
  // a positive coverage count (CLAUDE.md §6.6): the owner's three cards are in this hand
  expect(subs.length, "closed guard bottom deals submissions").toBeGreaterThanOrEqual(5)
  for (const t of NAMED) expect(subs.map((c) => c.t), t + " is dealt").toContain(t)
  for (const c of subs) {
    expect(c.label, c.t).toBe("Works")
    expect(c.odds, c.t + " prints a finish chance").toMatch(/^\d+%$/)
    expect(parseInt(c.odds, 10), c.t + " inside the clamp").toBeGreaterThanOrEqual(5)
    expect(parseInt(c.odds, 10), c.t + " inside the clamp").toBeLessThanOrEqual(95)
  }
  // nowhere on the hand — own cards, threat cards, their accessible names and tooltips — is a certain
  // step printed as a success rate
  expect(cards.filter((c) => c.threat).length, "threat cards are read too").toBeGreaterThan(0)
  expect(cards.filter((c) => /100%/.test(c.text)).map((c) => c.t), "never prints 100%").toEqual([])
  // the CONTROL: on this profile the finish priced at THIS state is a different number
  const differ = subs.filter((c) => c.here !== parseInt(c.odds, 10))
  expect(differ.length, "the current-state price differs from Works here: " + JSON.stringify(subs.map((c) => [c.t, c.odds, c.here]))).toBeGreaterThan(0)
  const works = Object.fromEntries(subs.map((c) => [c.t, c.odds]))

  // Inspect says the same thing in words, with the same number
  await j.inspect(NAMED[0])
  const sheet = await page.evaluate(() => {
    const p = (window as any).__neural.optDetailRef.current
    return { row: p.querySelector("[data-choice-follow-up]")?.textContent?.trim(), step: p.querySelector("[data-choice-entry-step]")?.textContent,
      line: p.querySelector("[data-choice-immediate-line]")?.textContent, text: p.textContent }
  })
  expect(sheet.row, "the sheet's row is the card's number").toBe(works[NAMED[0]])
  expect(sheet.step, "the step is said as a step").toMatch(/certain, no roll/)
  expect(sheet.line).toMatch(/^Works \d+%: the finish's chance once you are in\. Stepping in is certain/)
  expect(sheet.text, "the sheet never prints the step as 100%").not.toMatch(/100%/)
  await page.keyboard.press("Escape")

  // Pick it: the entry is certain, and the Finish card you are dealt prints what Works promised
  await j.pick(NAMED[0])
  let finish: { at: string; odds: string } | null = null
  for (let i = 0; i < 40 && !finish; i++) {
    await j.advance(250)
    finish = await page.evaluate(() => {
      const a = (window as any).__neural, f = document.querySelector('[data-choice-group="you"] [data-choice-action="finish"]')
      return f && !a._execution ? { at: a.nodes[a.currentPos].t, odds: (f.querySelector(".ngodds")?.textContent || "").trim() } : null
    })
  }
  expect(finish, "the Finish card is dealt inside the submission").not.toBeNull()
  expect(finish!.at).toBe(NAMED[0])
  expect(finish!.odds, "Works on the entry card == the Finish card's chance").toBe(works[NAMED[0]])
})
