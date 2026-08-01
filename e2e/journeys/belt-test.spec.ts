import { test, expect } from "@playwright/test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { journey } from "../dsl"

/**
 * BELT PATH P4 — BOSS-BATTLE BELT TESTS (spec first).
 *
 * A belt test is a REAL roll in the game engine with the OPPONENT restricted to the belt's
 * computed technique pool (strict for submissions — a white-belt opponent only taps you with
 * white-belt subs — soft for transitions so rolls never stall). The player is unrestricted.
 * Win by tap, or on points at the move limit when dominance clears the authored threshold.
 *
 * Surfaces forced into existence:
 *   startBeltTest(beltId) · _beltTest {beltId, names, maxMoves, pointsWin, attempts} set
 *   BEFORE rollFromPosition and deliberately absent from clearEngagement's field list ·
 *   opponentDefend pool filter (incl. the finish-branch pick) · endRound belt-aware branch
 *   FIRST (belt_test_won {byPoints} / belt_test_lost ordered before roll_end; dual-track
 *   ladder still advances) · belts.won persistence · path row states locked/ready/retry/won.
 *
 * Seeds derive from the SERVED curriculum fixture — owner curriculum edits never break this.
 */

const CURRICULUM = JSON.parse(
  readFileSync(resolve(__dirname, "../../source/public/static/neural/curriculum.json"), "utf8"),
)
const WHITE = CURRICULUM.belts[0]
const BLUE = CURRICULUM.belts[1]

/** a v2 blob with every white-belt lesson drilled and every checkpoint passed */
function whiteDoneBlob() {
  const prep: Record<string, number> = {}
  const units: Record<string, any> = {}
  for (const u of WHITE.units) {
    units[`${WHITE.id}/${u.id}`] = { checkpoint: true, t: 1 }
    for (const l of u.lessons) prep[l.deckKey] = 3
  }
  return { v: 2, prep, rec: { ...prep }, stage: {}, units, belts: { won: {} }, days: {}, settings: {} }
}

async function openPath(page: any) {
  await page.evaluate(() => (window as any).__neural.toggleExplorer())
}

/** the belt_test_start beat fires BEFORE the roll seeds — pump until the first hand */
async function awaitTestHand(j: any) {
  await j.nextHand(30000)
}

/** play rigged-success moves until a submission option appears, then take it (win by tap).
 *  Seeks transitions whose destination offers submissions, so the tap arrives quickly. */
async function playToTap(j: any, page: any, maxMoves = 8): Promise<boolean> {
  for (let m = 0; m < maxMoves; m++) {
    const sub = await page.evaluate(() => {
      const a = (window as any).__neural
      const subs = (a.optionIdxs || []).map((i: number) => a.nodes[i]).filter((n: any) => n.ty === "submissions")
      return subs.length ? subs[0].t : null
    })
    await j.rig("resolve", [0.01])
    await j.rig("outcome", [0.01])
    if (sub) {
      await j.pick(sub)
      await j.advanceUntil("roll_end", 20000)
      return true
    }
    const t = await page.evaluate(() => {
      const a = (window as any).__neural
      let fallback = null
      for (const i of a.optionIdxs || []) {
        const n = a.nodes[i]
        if (n.ty !== "transitions") continue
        fallback = fallback || n.t
        const res = a.resultPos(i, a.currentPos)
        if (res >= 0 && a.adj[res].some((k: number) => a.nodes[k].ty === "submissions")) return n.t
      }
      return fallback
    })
    if (!t) return false
    await j.pick(t)
    await j.nextHand(30000)
  }
  return false
}

test("test row states: locked without progress, READY with a completed belt", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.land("Mount Top")
  await openPath(page)
  expect(
    await page.locator(`[data-belt-test="${WHITE.id}"]`).first().getAttribute("data-test-state"),
  ).toBe("locked")

  await j.boot("/", { initialState: whiteDoneBlob() })
  await j.land("Mount Top")
  await openPath(page)
  expect(
    await page.locator(`[data-belt-test="${WHITE.id}"]`).first().getAttribute("data-test-state"),
  ).toBe("ready")
})

test("starting the test: beat, authored start position, authored move budget", async ({ page }) => {
  const j = journey(page)
  await j.boot("/", { initialState: whiteDoneBlob() })
  await j.land("Mount Top")
  await openPath(page)
  await page.locator(`[data-belt-test="${WHITE.id}"]`).first().click()
  await j.advanceUntil("belt_test_start", 20000)

  const state = await page.evaluate(() => {
    const a = (window as any).__neural
    return {
      belt: a._beltTest?.beltId ?? null,
      maxMoves: a.maxMoves,
      posId: a.nodes[a.currentPos]?.id,
      names: (a._beltTest?.names || []).length ?? 0,
    }
  })
  expect(state.belt).toBe(WHITE.id)
  expect(state.posId).toBe(WHITE.test.startNodeId)
  expect(state.maxMoves).toBe(WHITE.test.maxMoves) // the L3569 randomize is overridden
  expect(state.names).toBeGreaterThanOrEqual(5) // computed pool, never authored
})

test("engagement survival: _beltTest outlives clearEngagement; reset cancels cleanly", async ({ page }) => {
  const j = journey(page)
  await j.boot("/", { initialState: whiteDoneBlob() })
  await j.land("Mount Top")
  await openPath(page)
  await page.locator(`[data-belt-test="${WHITE.id}"]`).first().click()
  await j.advanceUntil("belt_test_start", 20000)
  expect(await page.evaluate(() => !!(window as any).__neural._beltTest)).toBe(true)

  // the user bails mid-test: clean cancel — no loss, no attempt burned
  await page.evaluate(() => (window as any).__neural.resetRoll())
  await j.advance(3000)
  const after = await page.evaluate(() => {
    const a = (window as any).__neural
    return { test: a._beltTest ?? null, attempts: a.belts?.attempts?.[/* beltId */ "white"] ?? 0 }
  })
  expect(after.test).toBeNull()
  expect(after.attempts).toBe(0)
  const beats = (await j.beats()).map((b: any) => b.beat)
  expect(beats).not.toContain("belt_test_lost")
  await openPath(page)
  expect(
    await page.locator(`[data-belt-test="${WHITE.id}"]`).first().getAttribute("data-test-state"),
  ).toBe("ready")
})

test("strict submission pool: the opponent only attacks with belt vocabulary", async ({ page }) => {
  const j = journey(page)
  await j.boot("/", { initialState: whiteDoneBlob() })
  await j.land("Mount Top")
  await openPath(page)
  await page.locator(`[data-belt-test="${WHITE.id}"]`).first().click()
  await j.advanceUntil("belt_test_start", 20000)
  await awaitTestHand(j)

  // fail two moves in a row with the opponent hunting finishes — every attack ∈ pool
  for (let i = 0; i < 2; i++) {
    const t = await page.evaluate(() => {
      const a = (window as any).__neural
      for (const k of a.optionIdxs || []) if (a.nodes[k].ty === "transitions") return a.nodes[k].t
      return null
    })
    if (!t) break
    await j.rig("resolve", [0.99])
    await j.rig("outcome", [0.99])
    await j.rig("opp-finish", [0.01])
    await j.rig("opp-sub-pick", [0.01])
    await j.rig("escape", [0.01]) // escape the catch so the roll continues
    await j.pick(t)
    await j.advanceUntil("opponent_attack", 25000).catch(() => {}) // counter branch is legal too
    const caught = (await j.beats()).some((b: any) => b.beat === "caught")
    if (caught) {
      await page.evaluate(() => (window as any).__neural.pickFirstEscape())
      await j.nextHand(30000).catch(() => {})
    }
  }
  const attacks = (await j.beats()).filter((b: any) => b.beat === "opponent_attack")
  expect(attacks.length).toBeGreaterThanOrEqual(1) // a vacuously-empty attack list proves nothing
  const pool = await page.evaluate(() => Array.from((window as any).__neural._beltTest?.names || []))
  for (const atk of attacks as any[]) {
    const base = atk.technique.split(" from ")[0].trim().toLowerCase()
    expect(pool).toContain(base)
  }
  // the roll never stalled: the game is still live (options or an active engagement)
  expect(await page.evaluate(() => {
    const a = (window as any).__neural
    return (a.optionIdxs || []).length > 0 || !!a._defendSub || !!a._beltTest
  })).toBe(true)
})

test("win by tap: belt recorded, blue unlocks, ladder rides along, all persisted", async ({ page }) => {
  const j = journey(page)
  await j.boot("/", { initialState: whiteDoneBlob() })
  await j.land("Mount Top")
  const rank0 = await page.evaluate(() => (window as any).__neural.ladderState().rank)
  await openPath(page)
  await page.locator(`[data-belt-test="${WHITE.id}"]`).first().click()
  await j.advanceUntil("belt_test_start", 20000)
  await awaitTestHand(j)

  expect(await playToTap(j, page)).toBe(true)

  const names = (await j.beats()).map((b: any) => b.beat)
  const iWon = names.indexOf("belt_test_won")
  expect(iWon).toBeGreaterThanOrEqual(0)
  expect(iWon).toBeLessThan(names.indexOf("roll_end")) // belt branch runs FIRST in endRound
  expect(names).toContain("belt_unlocked")
  const state = await page.evaluate(() => {
    const a = (window as any).__neural
    return { won: a.belts?.won?.white ?? null, rank: a.ladderState().rank }
  })
  expect(state.won).toBeTruthy()
  expect(state.won.moves).toBeGreaterThanOrEqual(0)
  expect(state.rank).toBe(rank0 + 1) // dual-track: the ladder still advances

  await j.boot("/", { preserveStorage: true })
  await j.land("Mount Top")
  await openPath(page)
  expect(
    await page.locator(`[data-belt-test="${WHITE.id}"]`).first().getAttribute("data-test-state"),
  ).toBe("won")
  expect(await page.locator(`[data-belt="${BLUE.id}"]`).first().getAttribute("data-locked")).toBeNull()
})

test("points and losses: at the move limit the engine matches its own dominance call", async ({ page }) => {
  const j = journey(page)
  await j.boot("/", { initialState: whiteDoneBlob() })
  await j.land("Mount Top")
  await openPath(page)
  await page.locator(`[data-belt-test="${WHITE.id}"]`).first().click()
  await j.advanceUntil("belt_test_start", 20000)
  await awaitTestHand(j)

  // rail-shim: shrink the window so expiry arrives in test time (the seam under test is
  // moveCount >= maxMoves → dominance vs pointsWinDominance, not the number 14 itself)
  await page.evaluate(() => {
    const a = (window as any).__neural
    a.maxMoves = 1
    a._beltTest.maxMoves = 1
  })
  const t = await page.evaluate(() => {
    const a = (window as any).__neural
    for (const k of a.optionIdxs || []) if (a.nodes[k].ty === "transitions") return a.nodes[k].t
    return null
  })
  expect(t).toBeTruthy()
  await j.rig("resolve", [0.01])
  await j.rig("outcome", [0.01])
  // the engine's own dominance verdict, read at expiry time, must match the outcome
  await j.pick(t as string)
  await j.advanceUntil("roll_end", 30000)

  const result = await page.evaluate(() => {
    const a = (window as any).__neural
    const beats = a.beats || []
    const won = beats.filter((b: any) => b.beat === "belt_test_won").pop()
    const lost = beats.filter((b: any) => b.beat === "belt_test_lost").pop()
    return { won: won || null, lost: lost || null, attempts: a.belts?.attempts?.white || 0 }
  })
  if (result.won) {
    expect(result.won.byPoints).toBe(true)
    expect(result.won.dominance).toBeGreaterThanOrEqual(WHITE.test.pointsWinDominance)
  } else {
    expect(result.lost).toBeTruthy()
    expect(result.lost.dominance).toBeLessThan(WHITE.test.pointsWinDominance)
    expect(result.attempts).toBe(1)
    await openPath(page)
    expect(
      await page.locator(`[data-belt-test="${WHITE.id}"]`).first().getAttribute("data-test-state"),
    ).toBe("retry")
  }
})
