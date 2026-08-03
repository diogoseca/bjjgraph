/* @hyperspace {"theme":"challenges-and-belt-bar","L":"lapsed-returner","F":"option-tray-sheet","B":"cross-feature"} @invariant "The research-position coin's sequence rule counts sheet-opens since the current landing: committing after only two sheets mints nothing and resets the counter, while three sheet_opened events since land followed by a commit mint exactly one coin." */
import { test, expect, type Page } from "@playwright/test"
import { journey } from "../dsl"
import { lapsedReturner } from "./personas"

/**
 * RESEARCH BEFORE YOU COMMIT — a lapsed returner earns the research-position coin.
 *
 * Engine truth (challenge-engine.src.js:131-140): the reward runtime's sheetsSinceLand
 * resets on `land`/`roll_end`, increments on every RAW sheet_opened (distinctness is
 * UNASSERTED — re-opening the SAME sheet counts), and a `commit` mints research-position
 * when the counter is >=3, then resets it. Mint-once rides the existing-coin guard at
 * challenge-engine.src.js:142 (`if (nextCoins[id]) continue`).
 *
 * SIZING FACT the whole spec is built on: j.pick() itself opens the expand sheet before
 * clicking [data-go], so every commit CONTRIBUTES one sheet_opened. Through real UI:
 *   "two sheets then commit"   = 1 open/close cycle  + pick
 *   "three sheets then commit" = 2 open/close cycles + pick
 * Asserted arc: cumulative sheet_opened 2 → 5 → 8 across three commits; research-position
 * coin_earned 0 after the 2-sheet commit, exactly 1 after the 3-sheet commit (live in
 * __neural.coins AND persisted in the bjj-neural-progress blob — isTest() saves are
 * synchronous), still 1 after repeating the full ritual on a later hand.
 *
 * Determinism: land()'s built-in rigs cover the ambient draws; each commit rigs
 * `resolve` [0.01] + `outcome` [0.01] on a ty==="transitions" option (momentum.spec.ts
 * pattern — success, no opponent turn, no roll_end). Sheet close goes via keyboard
 * Escape then waitForFunction(!_detailCtx && transform==="none") — NEVER
 * expect(sheet).not.toBeVisible(): the panel hides via opacity:0 so Playwright still
 * counts it visible, and the 400ms wall-clock row reset is what keeps consecutive
 * clicks on the same card stable.
 *
 * Deliberately NOT asserted: which reset (commit's or the next land's) zeroes the
 * counter — indistinguishable through real play, since every commit is followed by a
 * land before another sheet can open. Only the observable rule is pinned. Total sheet
 * opens stay at 8, safely below reward.sheet-twelve's threshold of 12, so no
 * oss-and-found mint can pollute the coin assertions.
 *
 * Distinctness vs the ledger: veteran-hidden-counters-beat-silent-coin-mints crosses
 * the COMMIT-FREE sheet-count threshold (reward.sheet-twelve); this spec is the
 * sequence-rule coin — sheets SINCE LAND gated by a commit, including the
 * two-sheets-is-not-enough negative arm no other spec exercises.
 */

/** A committable transition from the live hand (never a submission — those end the roll). */
const transitionTech = (page: Page) =>
  page.evaluate(() => {
    const a = (window as any).__neural
    for (const o of a.optionIdxs || []) {
      const n = a.nodes[typeof o === "number" ? o : o.idx]
      if (n && n.ty === "transitions") return n.t
    }
    return ""
  })

/** Open a tray card's expand sheet (fires sheet_opened) and close it WITHOUT committing. */
async function openAndClose(page: Page, technique: string, label: string) {
  const card = page.locator(`[data-tech="${technique}"]`).first()
  await expect(card, `${label}: option card for "${technique}" visible`).toBeVisible()
  await card.click()
  await expect(page.locator("[data-go]").first(), `${label}: expand-sheet Execute visible`).toBeVisible()
  await page.keyboard.press("Escape")
  // opacity:0 hide → visibility assertions lie; wait for the detail ctx to clear AND the
  // 400ms wall-clock row reset so the next click on the same card lands.
  await page.waitForFunction(() => {
    const a = (window as any).__neural
    return !a._detailCtx && !!a.optionsRef.current && a.optionsRef.current.style.transform === "none"
  })
}

/** Everything the invariant watches: raw sheet_opened count since the post-land baseline,
 *  research-position coin_earned beats, and the coin ledger (live + persisted). */
const snap = (page: Page, baseline: number) =>
  page.evaluate((base) => {
    const a = (window as any).__neural
    const beats = (a.beats || []).slice(base)
    let persisted = false
    try {
      const blob = JSON.parse(localStorage.getItem("bjj-neural-progress") || "{}")
      persisted = !!(blob.coins && blob.coins["research-position"])
    } catch {}
    return {
      sheets: beats.filter((b: any) => b.beat === "sheet_opened").length,
      commits: beats.filter((b: any) => b.beat === "commit").length,
      researchMints: beats.filter((b: any) => b.beat === "coin_earned" && b.id === "research-position")
        .length,
      liveCoin: !!(a.coins || {})["research-position"],
      persisted,
    }
  }, baseline)

test("returner researches a hand: two sheets mint nothing, three since land mint the coin once, the ritual never re-mints", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))

  const j = journey(page)
  await j.boot("/", { initialState: lapsedReturner() })
  await j.land("Mount Top")
  await j.expectBeat("land")
  await j.expectBeat("options_dealt")

  // ── post-land baseline: every count below reads the beat stream from here ──
  const baseline = await page.evaluate(() => ((window as any).__neural.beats || []).length)
  const virgin = await snap(page, baseline)
  expect(virgin.sheets, "no sheet_opened before the first open").toBe(0)
  expect(virgin.researchMints, "no research-position mint at boot").toBe(0)
  expect(virgin.liveCoin, "returner blob seeds coins:{} — ledger starts empty").toBe(false)
  expect(virgin.persisted, "nothing persisted before play").toBe(false)

  // ── commit 1: only TWO sheets since land (1 open/close + pick's own open) — no mint ──
  const t1 = await transitionTech(page)
  expect(t1, "hand 1: a transition to research and commit").toBeTruthy()
  await openAndClose(page, t1, "hand 1, research open")
  await j.rig("resolve", [0.01])
  await j.rig("outcome", [0.01])
  await j.pick(t1)
  const two = await snap(page, baseline)
  expect(two.sheets, "commit 1: exactly two sheet_opened since land (close-only + pick's open)").toBe(2)
  expect(two.commits, "commit 1: the commit beat landed").toBe(1)
  expect(two.researchMints, "commit 1: two sheets is NOT research — zero mints").toBe(0)
  expect(two.liveCoin, "commit 1: coin ledger still empty").toBe(false)
  expect(two.persisted, "commit 1: nothing persisted").toBe(false)
  await j.nextHand()

  // ── commit 2: THREE sheets since the new landing (2 open/close + pick) — exactly one mint.
  //    The counter demonstrably restarted: 2 stale sheets + 2 fresh opens would already be
  //    past threshold BEFORE pick's own open if anything had carried over. ──
  const t2 = await transitionTech(page)
  expect(t2, "hand 2: a transition to research and commit").toBeTruthy()
  await openAndClose(page, t2, "hand 2, research open 1")
  await openAndClose(page, t2, "hand 2, research open 2") // SAME sheet again — raw events count
  await j.rig("resolve", [0.01])
  await j.rig("outcome", [0.01])
  await j.pick(t2)
  const minted = await snap(page, baseline)
  expect(minted.sheets, "commit 2: five sheet_opened cumulative (2 + 3 this landing)").toBe(5)
  expect(minted.commits, "commit 2: second commit landed").toBe(2)
  expect(minted.researchMints, "commit 2: three sheets since land + commit = EXACTLY one mint").toBe(1)
  expect(minted.liveCoin, "commit 2: research-position sits in the live coin ledger").toBe(true)
  expect(minted.persisted, "commit 2: the mint reached the bjj-neural-progress blob's coins").toBe(true)
  await j.nextHand()

  // ── commit 3: repeat the full three-sheet ritual on a later hand — the coin never re-mints ──
  const t3 = await transitionTech(page)
  expect(t3, "hand 3: a transition to research and commit").toBeTruthy()
  await openAndClose(page, t3, "hand 3, research open 1")
  await openAndClose(page, t3, "hand 3, research open 2")
  await j.rig("resolve", [0.01])
  await j.rig("outcome", [0.01])
  await j.pick(t3)
  const after = await snap(page, baseline)
  expect(after.sheets, "commit 3: eight sheet_opened cumulative — opens still count").toBe(8)
  expect(after.commits, "commit 3: third commit landed").toBe(3)
  expect(after.researchMints, "commit 3: mint count STAYS one — existing-coin guard holds").toBe(1)
  expect(after.liveCoin, "commit 3: the one coin is still in the ledger").toBe(true)
  expect(after.persisted, "commit 3: persistence unchanged — still exactly the one coin").toBe(true)

  expect(errors, "no pageerror across boot, landing, and three research-commit arcs").toEqual([])
})
