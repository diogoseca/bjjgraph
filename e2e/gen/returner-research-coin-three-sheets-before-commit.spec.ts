// v1.230.0 reverses v1.218.1/v1.220.0 Inspect: D-318 moves research to the video viewer; the card commits.
/* @hyperspace {"theme":"challenges-and-belt-bar","L":"lapsed-returner","F":"option-tray-sheet","B":"cross-feature"} @invariant "The research-position coin's sequence rule counts research opens since the current landing: committing after only two video opens mints nothing and resets the counter, while three sheet_opened events since land followed by a commit mint exactly one coin." */
import { test, expect, type Page } from "@playwright/test"
import { journey } from "../dsl"
import { lapsedReturner } from "./personas"

/**
 * The video viewer retains the legacy sheet_opened evidence event. The research-position
 * counter resets on land/roll_end, counts every video open (including repeats), and
 * mints after three since landing followed by a commit. Choosing alone adds no research.
 * This pins cumulative events 2 → 5 → 8, the two-open negative arm, persistence, and
 * mint-once. Eight stays below reward.sheet-twelve, so that coin cannot mask this one.
 * Rigged transition successes keep the three commits in one roll. Research uses actual
 * video controls and closes the viewer before the next measured mouse action.
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

/** The video viewer emits the legacy research beat without committing. */
async function openAndClose(page: Page, technique: string, label: string) {
  await journey(page).watchChoice(technique)
}

/** Everything the invariant watches: raw sheet_opened count since the post-land baseline,
 *  research-position coin_earned beats, and the coin ledger (live + persisted). */
const snap = (page: Page, baseline: number) =>
  page.evaluate((base) => {
    const a = (window as any).__neural
    const beats = (a.beats || []).slice(base)
    let persisted = false
    try {
      const blob = JSON.parse(window.__ngGuestProgressRaw() || "{}")
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

test("returner researches a hand: two video opens mint nothing, three since land mint the coin once, the ritual never re-mints", async ({
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

  // ── commit 1: only TWO video opens since land (1 Video viewer + final viewer open) — no mint ──
  const t1 = await transitionTech(page)
  expect(t1, "hand 1: a transition to research and commit").toBeTruthy()
  await openAndClose(page, t1, "hand 1, research open")
  await j.rig("resolve", [0.01])
  await j.rig("outcome", [0.01])
  await j.watchChoice(t1)
  await j.pick(t1)
  const two = await snap(page, baseline)
  expect(two.sheets, "commit 1: exactly two sheet_opened since land (close-only + final viewer open)").toBe(2)
  expect(two.commits, "commit 1: the commit beat landed").toBe(1)
  expect(two.researchMints, "commit 1: two video opens is NOT research — zero mints").toBe(0)
  expect(two.liveCoin, "commit 1: coin ledger still empty").toBe(false)
  expect(two.persisted, "commit 1: nothing persisted").toBe(false)
  await j.nextHand()

  // ── commit 2: THREE video opens since the new landing (2 viewer opens + final viewer open) — exactly one mint.
  //    The counter demonstrably restarted: 2 stale video opens + 2 fresh opens would already be
  //    past threshold BEFORE the final viewer open if anything had carried over. ──
  const t2 = await transitionTech(page)
  expect(t2, "hand 2: a transition to research and commit").toBeTruthy()
  await openAndClose(page, t2, "hand 2, research open 1")
  await openAndClose(page, t2, "hand 2, research open 2") // SAME page again — raw events count
  await j.rig("resolve", [0.01])
  await j.rig("outcome", [0.01])
  await j.watchChoice(t2)
  await j.pick(t2)
  const minted = await snap(page, baseline)
  expect(minted.sheets, "commit 2: five sheet_opened cumulative (2 + 3 this landing)").toBe(5)
  expect(minted.commits, "commit 2: second commit landed").toBe(2)
  expect(minted.researchMints, "commit 2: three video opens since land + commit = EXACTLY one mint").toBe(1)
  expect(minted.liveCoin, "commit 2: research-position sits in the live coin ledger").toBe(true)
  expect(minted.persisted, "commit 2: the mint reached the bjj-neural-progress blob's coins").toBe(true)
  await j.nextHand()

  // ── commit 3: repeat the full three-open ritual on a later hand — the coin never re-mints ──
  const t3 = await transitionTech(page)
  expect(t3, "hand 3: a transition to research and commit").toBeTruthy()
  await openAndClose(page, t3, "hand 3, research open 1")
  await openAndClose(page, t3, "hand 3, research open 2")
  await j.rig("resolve", [0.01])
  await j.rig("outcome", [0.01])
  await j.watchChoice(t3)
  await j.pick(t3)
  const after = await snap(page, baseline)
  expect(after.sheets, "commit 3: eight sheet_opened cumulative — opens still count").toBe(8)
  expect(after.commits, "commit 3: third commit landed").toBe(3)
  expect(after.researchMints, "commit 3: mint count STAYS one — existing-coin guard holds").toBe(1)
  expect(after.liveCoin, "commit 3: the one coin is still in the ledger").toBe(true)
  expect(after.persisted, "commit 3: persistence unchanged — still exactly the one coin").toBe(true)

  expect(errors, "no pageerror across boot, landing, and three research-commit arcs").toEqual([])
})
