import { test, expect } from "@playwright/test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { journey } from "../dsl"

/**
 * PHASE A — one-line MC options + graded traps that actually SHIP (the audit found the P2b
 * traps were stripped by the bridge; 0 reached the app). This proves the full pipeline
 * content → graph.json → neural bridge → payload → renderer, using a real authored "golden"
 * card (no runtime injection): Upa Escape|Attacker[0], a white-belt lesson card given a
 * one-line answer_line + one-line plausible/trap distractors.
 *
 * Payload card shape: { q, a (one-line display answer), d (full explanation → "more" tooltip),
 * mc:{p:[plausible],t:[trap]} }. Correct MC option = card.a; distractors = card.mc tiers.
 */

const PAYLOAD = JSON.parse(
  readFileSync(resolve(__dirname, "../../source/public/static/neural/flashcards.json"), "utf8"),
)
const GOLDEN_DECK = "Upa Escape|Attacker"
const GOLDEN_Q = "Why must you trap the arm and leg on the same side rather than opposite sides?"
const MC_LINE = 36

async function openDeck(j: any, page: any, deckKey: string) {
  // v1.68.0: the sidebar reads back as classic recall by default — this file inspects the MC
  // options themselves, so it opts in.
  await page.evaluate(() => (window as any).__neural.set("mcMode", "auto"))
  await page.evaluate(() => (window as any).__neural.toggleExplorer())
  await page.locator(`[data-lesson="${deckKey}"]`).first().click()
  await j.advance(800)
}
const presentByQ = (page: any, q: string) =>
  page.evaluate((qq) => {
    const a = (window as any).__neural
    const c = (a.deck || []).find((x: any) => x.q === qq)
    if (!c) return null
    a.presentCard(a.qhash(c.q))
    return a._mc
  }, q)

test("payload wiring: graded traps + tooltip detail actually ship (were 0 before)", () => {
  let mc = 0,
    det = 0
  for (const d of Object.values<any>(PAYLOAD.decks)) for (const c of d.cards) { if (c.mc) mc++; if (c.d) det++ }
  expect(mc).toBeGreaterThan(100) // the whole fix: distractors reach flashcards.json
  expect(det).toBeGreaterThan(1000) // full-answer detail carried for the "more" tooltip
})

test("golden card: one-line options + authored plausible/trap tiers, straight from the payload", async ({ page }) => {
  const g = (PAYLOAD.decks[GOLDEN_DECK].cards as any[]).find((c) => c.q === GOLDEN_Q)
  expect(g, "golden card in payload").toBeTruthy()
  expect(g.a.length).toBeLessThanOrEqual(MC_LINE) // one-line answer
  expect((g.mc.p.length + g.mc.t.length)).toBeGreaterThanOrEqual(3) // 2 plausible + 1 trap
  expect(g.d.length).toBeGreaterThan(g.a.length) // full explanation preserved separately

  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await openDeck(j, page, GOLDEN_DECK)
  const mc = await presentByQ(page, GOLDEN_Q)
  expect(mc, "golden card presented as MC").toBeTruthy()

  const opts = await page.locator("[data-mc-opt]").allTextContents()
  expect(opts.length).toBe(4)
  for (const t of opts) {
    // strip the leading number badge; every rendered option is one line (≤ budget)
    expect(t.replace(/^\d+/, "").length).toBeLessThanOrEqual(MC_LINE)
  }
  // the tiers are the AUTHORED ones carried by the payload — not runtime-injected
  const tiers = await page.evaluate(() => (window as any).__neural._mc.tiers)
  expect(tiers).toContain("trap")
  expect(tiers).toContain("plausible")
  await j.keyframe("phaseA-oneline-mc")
})

test("recall reveal: one-liner answer + a 'More detail' tooltip expanding the full explanation", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await openDeck(j, page, GOLDEN_DECK)
  // graduate the golden card to recall, reveal it
  await page.evaluate((qq) => {
    const a = (window as any).__neural
    const c = a.deck.find((x: any) => x.q === qq)
    const qh = a.qhash(c.q)
    ;(a.stage[a._deckInfo.key] = a.stage[a._deckInfo.key] || {})[qh] = 2
    a.presentCard(qh)
    a.revealed = true
    a.renderDrill()
  }, GOLDEN_Q)

  const more = page.locator("[data-mc-more]").first()
  await expect(more, "More-detail toggle present").toBeVisible()
  expect(await page.locator(".mcDetail").first().isVisible()).toBe(false) // detail hidden by default
  await more.click()
  const detail = page.locator(".mcDetail").first()
  expect(await detail.isVisible()).toBe(true)
  expect((await detail.textContent())!.length).toBeGreaterThan(MC_LINE) // the full explanation
})
