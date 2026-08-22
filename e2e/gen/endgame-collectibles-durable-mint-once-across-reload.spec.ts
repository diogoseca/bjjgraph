/* @hyperspace {"theme":"challenges-and-belt-bar","L":"multi-belt-endgame","F":"persistence-reload","B":"persistence-reload"} @invariant "Coins and their timestamps ride the blob across preserveStorage reloads and the mint-once guard holds against replaying the identical triggering event after reboot — the coins map is byte-identical before and after the replay." */
import { test, expect } from "@playwright/test"
import type { Page } from "@playwright/test"
import { journey } from "../dsl"
import { multiBeltEndgame } from "./personas"

/**
 * COLLECTIBLES ARE DURABLE AND MINT-ONCE ACROSS A RELOAD — engine-level, zero rigs.
 *
 * A content-capstone endgame player earns the GODLIKE Mat Coin once. The mint must be REAL
 * (one coin_earned beat, a t-stamped entry written synchronously to bjj-neural-progress),
 * DURABLE (entry + timestamp byte-identical across a preserveStorage reload; boot
 * reconciliation re-emits nothing), and FINAL (replaying the IDENTICAL triggering event after
 * reboot emits zero new coin_earned beats and leaves the stored coins subtree byte-identical),
 * while the SAME replayed event still advances its live challenge counter — proving the write
 * path ran and the coins map alone was held immutable.
 *
 * Mechanism under test (source-verified at authoring; probe green twice):
 *   - fx("combo",{n:7}) is a legitimate engine choke (precedent: e2e/journeys/
 *     challenges-engine.spec.ts drives app.fx directly). NG_MAT_COINS "godlike" mints on
 *     event "combo" when p.n >= 7 (challenge-definitions.src.js:348); no other coin matches
 *     this beat, and combo carries neither technique nor via, so the entry is exactly {t}.
 *   - _saveProgress() writes SYNCHRONOUSLY in test mode (app.src.jsx:1199-1207): the stored
 *     coins.godlike.t equals the live t the instant the beat lands — no debounce race.
 *   - Boot reconciliation replays evidence as beat "challenge_snapshot", which SKIPS the whole
 *     fx-emission block in noteChallenges (`beat !== "challenge_snapshot"`, app.src.jsx:4566);
 *     for THIS persona no coin is snapshot-mintable (every coin's sourceChallenge is an
 *     event-counter challenge, and units/rec/belts evidence feeds none of them) — so a clean
 *     boot emits ZERO coin_earned beats.
 *   - Mint-once: ngRewardChanges guards every candidate with `if (nextCoins[id]) continue`
 *     (challenge-engine.src.js:142) — a replayed combo can never re-stamp godlike.
 *
 * AUTHOR GOTCHA (honored throughout): the byte-compare MUST scope to the coins SUBTREE, never
 * the whole blob — the replayed combo legitimately advances black.combo-seven-three (event
 * "combo" when n===7, target 3) from 1 to 2 and re-stamps updatedAt. That advance is asserted
 * ON PURPOSE: it proves _saveProgress rewrote the blob after the replay, so the coins-identity
 * claim is non-vacuous.
 *
 * ZERO rigs by construction: boot readiness only — no land(), no advance(), no roll loop ever
 * starts, so no RNG site is drawn (rig-every-draw is vacuous). keepTutorial:true on BOTH boots
 * is load-bearing — the DSL's default tutorial-completion evaluate triggers extra challenge
 * writes that would muddy the beat/write picture this spec pins.
 *
 * DEDUP (adjacent, none pins this claim):
 *   - challenges-engine.spec.ts "idempotent" — mint-once within ONE session; never crosses a
 *     reload, never compares stored bytes.
 *   - mid-roll-counter-partial-progress-rides-reload — a partial CHALLENGE counter riding the
 *     reload; no coin, no replay-after-reboot.
 *   - ready-godlike-restamp-single-chip — the DOM chip surface; not blob durability.
 * Unique claim: a minted coin + its timestamp survive preserveStorage byte-identical AND the
 * identical triggering event replayed post-reboot is a no-op on the coins map.
 *
 * Assertions are STRUCTURAL only — coin/challenge ids from challenge-definitions, beat counts,
 * stored-blob shapes and byte-compares. Sim time is never needed; no wall-clock sleeps.
 */

const COIN = "godlike"
const REPLAY_CHALLENGE = "black.combo-seven-three" // event "combo", when n===7, target 3

/** One structural read: live coins, stored coins subtree (raw JSON string for byte-compare),
 *  the replay challenge's stored counter, and every coin_earned id seen since boot. */
const readState = (page: Page) =>
  page.evaluate(
    ([coin, chal]) => {
      const a = (window as any).__neural
      const blob = JSON.parse(localStorage.getItem("bjj-neural-progress") || "null")
      const coins = ((blob || {}) as any).coins || {}
      return {
        liveKeys: Object.keys(a.coins || {}).sort(),
        liveT: (a.coins || {})[coin as string]?.t ?? null,
        storedCoinsJson: JSON.stringify(coins),
        storedEntry: coins[coin as string] || null,
        storedChallenge: (((blob || {}) as any).challenges || {})[chal as string] || null,
        coinBeatIds: ((a.beats || []) as any[])
          .filter((b: any) => b.beat === "coin_earned")
          .map((b: any) => b.id),
      }
    },
    [COIN, REPLAY_CHALLENGE] as const,
  )

test("a coin minted at the engine choke rides a preserveStorage reload t-exact, and replaying the identical event after reboot leaves the coins subtree byte-identical", async ({ page }) => {
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))

  const j = journey(page)

  // ── Boot 1: endgame persona, readiness only — no roll loop, so zero RNG draws ──
  await j.boot("/", { initialState: multiBeltEndgame(), keepTutorial: true })

  const boot1 = await readState(page)
  expect(boot1.liveKeys, "endgame persona boots with NO coins — none is snapshot-mintable").toEqual([])
  expect(boot1.coinBeatIds, "boot reconciliation (challenge_snapshot) emitted zero coin_earned").toEqual([])
  expect(boot1.storedEntry, "stored blob carries no coin entry before the mint").toBeNull()

  // ── MINT at the engine choke: exactly one coin_earned{id:"godlike"} ──
  await page.evaluate(() => (window as any).__neural.fx("combo", { n: 7 }))
  const mint = await readState(page)
  expect(mint.coinBeatIds, "EXACTLY ONE coin_earned beat, for the godlike coin").toEqual([COIN])
  expect(mint.liveKeys, "the combo beat minted only godlike — no other coin matches it").toEqual([COIN])
  expect(mint.liveT, "the live entry is t-stamped").toBeGreaterThan(0)
  // _saveProgress is synchronous in test mode — the stored entry already mirrors the live one
  expect(mint.storedEntry, "stored entry is exactly {t} (combo carries no technique/via context)").toEqual({ t: mint.liveT })
  expect(mint.storedChallenge, "the same beat advanced the replay challenge to 1/3").toMatchObject({ progress: 1, done: false })
  const mintCoinsJson = mint.storedCoinsJson

  // ── Boot 2 (preserveStorage): the coin + timestamp ride the reload byte-exact ──
  await j.boot("/", { preserveStorage: true, keepTutorial: true })
  const rebooted = await readState(page)
  expect(rebooted.coinBeatIds, "reboot re-emitted ZERO coin_earned — snapshot replay is fx-guarded").toEqual([])
  expect(rebooted.liveT, "live timestamp after reboot equals the mint timestamp exactly").toBe(mint.liveT)
  expect(rebooted.storedCoinsJson, "stored coins subtree byte-identical across the reload").toBe(mintCoinsJson)
  expect(rebooted.storedChallenge, "the partial replay-challenge counter rode the reload too").toMatchObject({ progress: 1, done: false })

  // ── REPLAY the identical triggering event: mint-once guard holds ──
  await page.evaluate(() => (window as any).__neural.fx("combo", { n: 7 }))
  const replayed = await readState(page)
  expect(replayed.coinBeatIds, "ZERO new coin_earned beats — `if (nextCoins[id]) continue` held").toEqual([])
  expect(replayed.liveKeys, "the live coins map still holds exactly the one coin").toEqual([COIN])
  expect(replayed.liveT, "the live timestamp was not re-stamped").toBe(mint.liveT)
  expect(replayed.storedCoinsJson, "stored coins subtree byte-identical to pre-replay AND to the original mint").toBe(mintCoinsJson)
  // NON-VACUITY: the replayed beat DID write — the challenge counter moved 1→2, so the blob
  // was rewritten by _saveProgress while the coins subtree alone stayed immutable.
  expect(replayed.storedChallenge, "the identical replayed event advanced its challenge to 2/3").toMatchObject({ progress: 2, done: false })

  // crash guard: the whole mint → reload → replay arc ran clean
  expect(errors, "zero pageerror across the whole arc").toEqual([])
})
