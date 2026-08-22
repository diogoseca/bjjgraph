/* @hyperspace {"theme":"challenges-and-belt-bar","L":"curriculum-mid","F":"persistence-reload","B":"persistence-reload"} @invariant "Partial event-counter progress earned in live play (blue.roll-three at 2/3, one win plus one loss — the counter is outcome-blind) persists in the challenges blob across a preserveStorage reload, and the third completed roll after reboot completes the challenge exactly once." */
import { test, expect } from "@playwright/test"
import type { Page } from "@playwright/test"
import { journey, Journey } from "../dsl"
import { curriculumMid } from "./personas"

/**
 * PARTIAL COUNTER RIDES THE RELOAD — challenge event-counters are durable mid-flight.
 *
 * A mid-curriculum player finishes two rolls (one WIN, one LOSS) — blue.roll-three sits at
 * 2/3. The partial counter must be REAL and DURABLE: the stored blob mirrors the live entry
 * (same t) immediately after roll 2, both survive a preserveStorage reload byte-exact, and
 * the THIRD completed roll after reboot completes the challenge EXACTLY ONCE — one
 * challenge_completed beat with the full shape, never zero (progress lost) and never a
 * replay-double (boot re-award).
 *
 * Mechanism under test (source-verified at authoring, probe green twice — ~1.4m each, dealt
 * hand 1 held a submission and the opponent caught on move 1 in both runs):
 *   - fx() routes EVERY beat through noteChallenges (neural/src/app.src.jsx:129-144);
 *     ngAdvanceChallenges increments on every ngMatches roll_end
 *     (neural/src/challenge-engine.src.js:26-52). blue.roll-three has NO `when` clause
 *     (challenge-definitions.src.js:273, target 3) — outcome-blind BY CONSTRUCTION, which is
 *     exactly what the win+loss pair pins.
 *   - ngAdvanceChallenges stamps t on the FIRST progress write and preserves it on later
 *     increments (`t: done && !before.done ? now : before.t || now`) — so "same t across the
 *     reload" is the freshness-preservation claim.
 *   - _saveProgress() writes SYNCHRONOUSLY in test mode (app.src.jsx:1199-1207): the blob is
 *     assertable the instant roll 2's roll_end lands, no debounce race.
 *   - Boot-time snapshot replay (noteChallenges("challenge_snapshot")) never re-emits
 *     challenge_completed — the fx loop is guarded by `beat !== "challenge_snapshot"`
 *     (app.src.jsx:4566) — so the exactly-once count post-reload is clean.
 *
 * AUTHOR GOTCHA (probe iteration 1 failed on this — honored throughout): dsl.ts
 * advanceUntil()/expectBeat are STREAM-BLIND. Roll 1's stale roll_end satisfies
 * advanceUntil("roll_end") instantly during roll 2, so the loss never actually resolves; the
 * same trap applies to defend_start once any earlier roll had a catch. Fix: COUNT-BASED
 * pumping (capture the beat count at loss entry, pump until count > baseline). winRoll's
 * stream-based advanceUntil is safe at BOTH its call sites only because each sits on a fresh
 * beat stream (boot 1 / boot 2 reset it).
 *
 * DEDUP (adjacent, none pins this claim):
 *   - ready-lost-attempt-survives-reload — belts.attempts durability (economy debit), not the
 *     challenges event-counter; its counter never moves mid-flight.
 *   - returner-momentum-ephemeral-knowledge-durable — the reload SPLIT (ephemeral vs durable);
 *     asserts no partial challenge counter.
 *   - holder-victory-defeat-blue-progress-untouched-by-loss — a loss leaves study state
 *     UNTOUCHED; here the loss must MOVE the counter (outcome-blind is the point).
 * Unique claim: a PARTIAL (2/3) event-counter with mixed outcomes rides a preserveStorage
 * reload t-exact, and completion after reboot is exactly-once.
 *
 * Assertions are STRUCTURAL only — challenge id/track/target from challenge-definitions,
 * options discovered by `ty` (never by name), beat counts and blob shapes. Every draw is
 * rigged; sim time is pumped, never wall-clock slept.
 */

const CHALLENGE = "blue.roll-three"
const POSITION = "Mount Top" // valid positions node land() can rig-start on; deals a submission in hand 1

const beatCount = (page: Page, name: string) =>
  page.evaluate(
    (n) => (((window as any).__neural || {}).beats || []).filter((b: any) => b.beat === n).length,
    name,
  )

/** Pump sim time in 400ms steps until the COUNT of `beat` exceeds `above` — the stream-blind
 *  advanceUntil() trap (see header) makes count-based pumping mandatory from roll 2 on. */
async function pumpPastCount(j: Journey, page: Page, beat: string, above: number, capMs: number) {
  let spent = 0
  while (spent < capMs) {
    await j.advance(400)
    spent += 400
    if ((await beatCount(page, beat)) > above) return true
  }
  return false
}

/** Tray census by ty — first submission + first transition titles (never matched by content). */
const tray = (page: Page) =>
  page.evaluate(() => {
    const a = (window as any).__neural
    let sub: string | null = null
    let trans: string | null = null
    for (const o of a.optionIdxs || []) {
      const n = a.nodes[typeof o === "number" ? o : o.idx]
      if (!n) continue
      if (!sub && n.ty === "submissions") sub = n.t
      if (!trans && n.ty === "transitions") trans = n.t
    }
    return { sub, trans }
  })

/** Win the LIVE roll by rigged submission; ≤5 rigged-success hops as armor when the hand
 *  holds no submission (probe: hand 1 from Mount Top held one in both runs). STREAM-BLIND
 *  advanceUntil is safe here ONLY on a fresh beat stream — both call sites qualify. */
async function winRoll(j: Journey, page: Page) {
  for (let hop = 0; hop < 5; hop++) {
    const { sub, trans } = await tray(page)
    if (sub) {
      // resolve < moveChance ⇒ success verdict; a submission win short-circuits to finish.
      // outcome rigged too as armor (deterministic either way under curriculum reshuffles).
      await j.rig("resolve", [0.01])
      await j.rig("outcome", [0.01])
      await j.pick(sub)
      await j.advanceUntil("finish", 20000)
      await j.advanceUntil("roll_end", 20000)
      return
    }
    expect(trans, `hop ${hop + 1}: a transition to advance toward a submission`).toBeTruthy()
    await j.rig("resolve", [0.01])
    await j.rig("outcome", [0.01])
    await j.pick(trans as string)
    await j.nextHand(30000)
  }
  throw new Error("no submission dealt within 5 rigged-success hops")
}

test("blue.roll-three at 2/3 (one win + one loss — outcome-blind) rides a preserveStorage reload t-exact; the third roll completes it exactly once", async ({ page }) => {
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))

  const j = journey(page)

  // ── Boot 1: mid-curriculum persona (unit 1 done, unit 2 half-drilled), virgin challenges ──
  await j.boot("/", { initialState: curriculumMid() })
  await j.land(POSITION)

  const pre = await page.evaluate((id) => (window as any).__neural.challengeProgress(id), CHALLENGE)
  expect(pre, "challenge definition exists for the id under test").toBeTruthy()
  expect(pre, "virgin counter at boot: 0/3, not done, t 0").toEqual({ progress: 0, done: false, t: 0 })

  // ── ROLL 1 — WIN by rigged submission ──
  await winRoll(j, page)
  expect(await j.lastOutcome(), "roll 1 resolved as a win").toBe("win")
  const p1 = await page.evaluate((id) => (window as any).__neural.challengeProgress(id), CHALLENGE)
  expect(p1.progress, "the win counted one completed roll").toBe(1)
  expect(p1.done, "1/3 is not done").toBe(false)

  // ── ROLL 2 — LOSS via the auto-restart: rig the restart's ambient draws + start position
  //    inside the 4.4s hold, then ride hold + 0.55s + startRoll to the next hand. ──
  await j.rig("ai-skill", [0.5])
  await j.rig("role", [0])
  await j.rig("max-moves", [0.5])
  await page.evaluate((pos) => {
    const a = (window as any).__neural
    const idx = a.nodes.findIndex((n: any) => n.ty === "positions" && n.t === pos)
    if (idx < 0) throw new Error(`position not found: ${pos}`)
    a.rigStart(idx)
  }, POSITION)
  await j.nextHand(30000)

  // Count baselines captured AT loss entry — roll 1's stale roll_end/defend_start make every
  // stream-blind wait a lie from here (the probe's iteration-1 failure).
  const defendBase = await beatCount(page, "defend_start")
  const endBase = await beatCount(page, "roll_end")

  // Loss recipe (verbatim from the stakes-impact/ready-lost cores): fail a transition, the
  // opponent hunts a rigged finish, get caught; ≤4-move loop as counter-branch armor
  // (probe: caught on move 1 in both runs).
  let caught = false
  for (let m = 0; m < 4 && !caught; m++) {
    const { trans } = await tray(page)
    expect(trans, `loss move ${m + 1}: a transition option to fail`).toBeTruthy()
    await j.rig("resolve", [0.99])
    await j.rig("outcome", [0.99, 0.99])
    await j.rig("opp-finish", [0.01])
    await j.rig("opp-sub-pick", [0.01])
    await j.rig("opp-pick", [0.01])
    await j.pick(trans as string)
    caught = await pumpPastCount(j, page, "defend_start", defendBase, 25000)
    if (!caught) {
      // counter branch: no catch this move — re-fail from the next hand (if not already live)
      const live = await page.evaluate(() => (((window as any).__neural || {}).optionIdxs || []).length > 0)
      if (!live) await j.nextHand(30000)
    }
  }
  expect(caught, "opponent caught a submission within 4 failed moves").toBe(true)
  // No escape rig, no escape pick — the defense clock expires → tapped → endRound("lose").
  expect(
    await pumpPastCount(j, page, "roll_end", endBase, 30000),
    "roll 2 ended by defense-window expiry",
  ).toBe(true)
  expect(await j.lastOutcome(), "roll 2 resolved as a loss").toBe("lose")

  // ── OUTCOME-BLIND: one win + one loss = 2/3, not done, t stamped at first progress ──
  const live2 = await page.evaluate((id) => (window as any).__neural.challengeProgress(id), CHALLENGE)
  expect(live2.progress, "the loss counted too — the counter is outcome-blind").toBe(2)
  expect(live2.done, "2/3 is not done").toBe(false)
  expect(live2.t, "t was stamped at the first progress write").toBeGreaterThan(0)

  // _saveProgress is SYNCHRONOUS in test mode: the blob already mirrors the live entry, same t.
  const stored2 = await page.evaluate((id) => {
    const blob = JSON.parse(localStorage.getItem("bjj-neural-progress") || "null")
    return (((blob || {}).challenges || {}) as any)[id] || null
  }, CHALLENGE)
  expect(stored2, "stored entry mirrors the live counter exactly (same t, no extra keys)").toEqual({
    progress: 2,
    done: false,
    t: live2.t,
  })

  // ── Boot 2 (preserveStorage): the partial counter RIDES the reload, t preserved exactly ──
  await j.boot("/", { preserveStorage: true })
  const post = await page.evaluate((id) => {
    const a = (window as any).__neural
    const blob = JSON.parse(localStorage.getItem("bjj-neural-progress") || "null")
    return {
      live: a.challengeProgress(id),
      stored: (((blob || {}).challenges || {}) as any)[id] || null,
    }
  }, CHALLENGE)
  expect(post.live, "live counter after reboot: 2/3, not done, t preserved exactly").toEqual({
    progress: 2,
    done: false,
    t: live2.t,
  })
  expect(post.stored, "stored blob after reboot: the partial entry unchanged").toEqual({
    progress: 2,
    done: false,
    t: live2.t,
  })
  // boot-time snapshot replay is fx-guarded (beat !== "challenge_snapshot") — it awards nothing
  expect(await beatCount(page, "challenge_completed"), "reboot re-emitted no completion").toBe(0)

  // ── ROLL 3 — the third completed roll finishes the challenge EXACTLY ONCE ──
  await j.land(POSITION)
  await winRoll(j, page) // stream-blind waits safe again: boot 2 reset the beat stream
  expect(await j.lastOutcome(), "roll 3 resolved as a win").toBe("win")

  const final = await page.evaluate((id) => {
    const a = (window as any).__neural
    const blob = JSON.parse(localStorage.getItem("bjj-neural-progress") || "null")
    return {
      live: a.challengeProgress(id),
      stored: (((blob || {}).challenges || {}) as any)[id] || null,
      completions: (a.beats || []).filter((b: any) => b.beat === "challenge_completed" && b.id === id),
    }
  }, CHALLENGE)
  expect(final.live.progress, "counter reads the full target after completion").toBe(3)
  expect(final.live.done, "challenge is done").toBe(true)
  expect(final.stored.progress, "stored blob carries the completed counter").toBe(3)
  expect(final.stored.done, "stored blob records done").toBe(true)
  expect(final.stored.t, "completion stamped a nonzero t").toBeGreaterThan(0)
  expect(final.completions.length, "EXACTLY ONE challenge_completed for this id post-reload").toBe(1)
  expect(final.completions[0], "the completion beat carries the full shape").toEqual(
    expect.objectContaining({ id: CHALLENGE, track: "blue", progress: 3, target: 3 }),
  )

  // crash guard: the whole three-roll + reload arc ran clean
  expect(errors, "zero pageerror across the whole arc").toEqual([])
})
