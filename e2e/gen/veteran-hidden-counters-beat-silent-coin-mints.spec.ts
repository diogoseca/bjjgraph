/* @hyperspace {"theme":"challenges-and-belt-bar","L":"srs-veteran","F":"option-tray-sheet","B":"guard-limit"} @invariant "Hidden reward counters (reward.sheet-twelve) advance without ever emitting challenge_completed or tut_step, yet crossing twelve sheet_opened events mints the oss-and-found coin with exactly one coin_earned beat and a thirteenth sheet re-mints nothing." */
import { test, expect, type Page } from "@playwright/test"
import { journey } from "../dsl"
import { srsVeteran } from "./personas"

/**
 * HIDDEN REWARD COUNTERS ARE SILENT UNTIL THE COIN — an SRS veteran researches one hand.
 *
 * reward.sheet-twelve (challenge-definitions.src.js:306) is a hidden:true counter fed by
 * every sheet_opened beat. Being hidden, it must advance in TOTAL silence — the completed
 * loop's guard (app.src.jsx:4569 `if (!definition || definition.hidden) continue`) skips
 * the challenge_completed beat, and no tut_step can fire (it is trackless AND boot marks
 * the twenty White compatibility objectives done). Yet the coin pipeline still hears it:
 * the 12th sheet_opened flips the counter done, ngRewardChanges promotes the sourceChallenge
 * coin, and app.src.jsx:4600 emits exactly ONE coin_earned {id:"oss-and-found"} — durably
 * saved (isTest() → _saveProgress writes localStorage synchronously). A 13th open advances
 * nothing (progress caps at target, engine line 40) and re-mints nothing (mint-once guard
 * challenge-engine.src.js:142 `if (nextCoins[id]) continue`).
 *
 * Determinism (probe 2/2 green, ~9s each, through real UI): land()'s built-in rigs
 * (ai-skill/role/max-moves) cover ALL ambient draws; opening/closing the expand sheet draws
 * no RNG, and sim time is never advanced after the deal so the decision clock stays inert
 * (expandOption pauses it anyway; closeOptionDetail resumes a clock we never pump). Close
 * waits on BOTH `!_detailCtx` AND `optionsRef.current.style.transform === "none"` — the
 * latter is closeOptionDetail's 400ms wall-clock row reset (app.src.jsx:1905), and waiting
 * it out is what makes 13 consecutive open/close cycles click-stable on the same card.
 *
 * GOTCHA the whole spec is shaped around: the 13-open phase is COMMIT-FREE. sheetsSinceLand
 * accumulates in the reward runtime (challenge-engine.src.js:134) and any commit after >=3
 * sheets would ALSO mint research-position, polluting the exactly-one-coin_earned assertion.
 *
 * Distinctness: curated challenges-engine.spec.ts covers coin idempotence only via synthetic
 * app.fx() emission; this spec crosses the threshold through the real tray-card UI, pins the
 * hidden-guard silence per open (1-11), and proves the durable localStorage save.
 */

/** Open the target's expand sheet like a user: tray card click → Execute visible.
 *  expandOption (app.src.jsx:1587) fires sheet_opened on EVERY open — no dedupe. */
async function openSheet(page: Page, technique: string, cycle: number) {
  const card = page.locator(`[data-tech="${technique}"]`).first()
  await expect(card, `cycle ${cycle}: option card for "${technique}" visible`).toBeVisible()
  await card.click()
  await expect(page.locator("[data-go]").first(), `cycle ${cycle}: expand-sheet Execute button visible`).toBeVisible()
}

/** Close via keyboard Escape (app.src.jsx:283 → closeOptionDetail), then wait out the
 *  400ms wall-clock row reset — _detailCtx clears synchronously but the tray row only
 *  returns to transform:none (clickable, settled) after the setTimeout at :1905. */
async function closeSheet(page: Page) {
  await page.keyboard.press("Escape")
  await page.waitForFunction(() => {
    const a = (window as any).__neural
    return !a._detailCtx && !!a.optionsRef.current && a.optionsRef.current.style.transform === "none"
  })
}

/** Everything the invariant watches, in one evaluate: the hidden counter's live progress,
 *  the beat slice since the post-land baseline, and the coin ledger (live + persisted). */
const snap = (page: Page, baseline: number) =>
  page.evaluate((base) => {
    const a = (window as any).__neural
    const beats = (a.beats || []).slice(base)
    let persistedCoin = false
    try {
      const blob = JSON.parse(localStorage.getItem("bjj-neural-progress") || "{}")
      persistedCoin = !!(blob.coins && blob.coins["oss-and-found"])
    } catch {}
    return {
      progress: a.challengeProgress("reward.sheet-twelve") as { progress: number; done: boolean },
      sheets: beats.filter((b: any) => b.beat === "sheet_opened").length,
      coinBeats: beats.filter((b: any) => b.beat === "coin_earned").map((b: any) => b.id),
      rewardCompleted: beats.filter(
        (b: any) => b.beat === "challenge_completed" && String(b.id || "").startsWith("reward."),
      ).length,
      tutSteps: beats.filter((b: any) => b.beat === "tut_step").length,
      liveCoin: !!(a.coins || {})["oss-and-found"],
      persistedCoin,
    }
  }, baseline)

test("veteran opens the same sheet 13 times: silent counter 1-11, one oss-and-found mint at 12, no re-mint at 13", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))

  const j = journey(page)
  await j.boot("/", { initialState: srsVeteran() })
  await j.land("Mount Top")
  await j.expectBeat("land")
  await j.expectBeat("options_dealt")

  const titles = await j.optionTitles()
  expect(titles.length, "a hand of options was dealt").toBeGreaterThanOrEqual(1)
  const target = titles[0] // the SAME tray card every cycle — reopen is a fresh sheet_opened each time

  // ── post-land baseline: every assertion below reads the beat stream from here ──
  const baseline = await page.evaluate(() => ((window as any).__neural.beats || []).length)
  const virgin = await snap(page, baseline)
  expect(virgin.progress, "hidden counter starts untouched (veteran blob seeds challenges:{})").toEqual(
    expect.objectContaining({ progress: 0, done: false }),
  )
  expect(virgin.sheets, "no sheet_opened before the first open").toBe(0)
  expect(virgin.liveCoin, "no oss-and-found coin before the first open").toBe(false)

  // ── opens 1-11: the counter climbs in total silence ──
  for (let i = 1; i <= 11; i++) {
    await openSheet(page, target, i)
    const s = await snap(page, baseline)
    expect(s.sheets, `open ${i}: sheet_opened beats since land`).toBe(i)
    expect(s.progress.progress, `open ${i}: hidden counter tracks every open`).toBe(i)
    expect(s.progress.done, `open ${i}: not done below the target of 12`).toBe(false)
    expect(s.coinBeats, `open ${i}: zero coin_earned — the reward waits at twelve`).toEqual([])
    expect(
      s.rewardCompleted,
      `open ${i}: zero challenge_completed for reward.* — the hidden guard (app.src.jsx:4569) holds`,
    ).toBe(0)
    expect(s.tutSteps, `open ${i}: zero tut_step — a trackless counter never touches the tutorial`).toBe(0)
    expect(s.liveCoin, `open ${i}: coin ledger still empty`).toBe(false)
    await closeSheet(page)
  }

  // ── open 12: threshold crossed — exactly one coin_earned, still zero challenge_completed ──
  await openSheet(page, target, 12)
  const minted = await snap(page, baseline)
  expect(minted.sheets, "open 12: twelfth sheet_opened landed").toBe(12)
  expect(minted.progress, "open 12: counter complete at its target").toEqual(
    expect.objectContaining({ progress: 12, done: true }),
  )
  expect(minted.coinBeats, "open 12: EXACTLY one coin_earned, and it is oss-and-found").toEqual(["oss-and-found"])
  expect(minted.rewardCompleted, "open 12: completion still emits no challenge_completed (hidden guard)").toBe(0)
  expect(minted.tutSteps, "open 12: still zero tut_step").toBe(0)
  expect(minted.liveCoin, "open 12: oss-and-found sits in the live coin ledger").toBe(true)
  expect(
    minted.persistedCoin,
    "open 12: the mint reached localStorage bjj-neural-progress .coins — the save is durable",
  ).toBe(true)
  await closeSheet(page)

  // ── open 13: the counter is saturated and the mint-once guard holds ──
  await openSheet(page, target, 13)
  const after = await snap(page, baseline)
  expect(after.sheets, "open 13: sheet_opened still counts every open").toBe(13)
  expect(after.progress, "open 13: progress caps at the target — no overshoot").toEqual(
    expect.objectContaining({ progress: 12, done: true }),
  )
  expect(
    after.coinBeats,
    "open 13: coin_earned count STAYS one — mint-once guard (challenge-engine.src.js:142)",
  ).toEqual(["oss-and-found"])
  expect(after.rewardCompleted, "open 13: reward.* stayed silent for the whole arc").toBe(0)
  expect(after.tutSteps, "open 13: tut_step stayed silent for the whole arc").toBe(0)
  await closeSheet(page)

  expect(errors, "no pageerror across boot, landing, and 13 open/close cycles").toEqual([])
})
