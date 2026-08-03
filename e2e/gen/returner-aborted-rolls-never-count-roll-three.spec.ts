/* @hyperspace {"theme":"challenges-and-belt-bar","L":"lapsed-returner","F":"victory-defeat","B":"interruption-abort"} @invariant "Abandoned rolls are not completed rolls: resetRoll and stageRollAt restages emit no roll_end and leave blue.roll-three untouched, while one genuinely finished roll afterwards advances the counter by exactly one." */
import { test, expect } from "@playwright/test"
import { journey } from "../dsl"
import { lapsedReturner } from "./personas"

/**
 * ABANDONED ROLLS ARE NOT COMPLETED ROLLS — the abort seams of the blue.roll-three counter.
 *
 * blue.roll-three (challenge-definitions.src.js:273) is `{event:"roll_end"}`, target 3, NO
 * outcome filter — the counter moves on the roll_end BEAT alone, via fx() -> noteChallenges
 * (app.src.jsx:137). So the whole invariant hangs on which roll exits emit that beat:
 *   - endRound (win/lose/points) — the ONLY roll_end emitter. Counts.
 *   - resetRoll (:201-204) -> setPaused(false) + startRoll(:4831) — never calls endRound.
 *     Abandoning a PLAYED roll mid-hand emits nothing.
 *   - stageRollAt (:4822) -> rollFromPosition(idx, true) (:4787) — never calls endRound
 *     either; a restage over a staged non-session archives nothing (_played gate, :4797)
 *     and counts nothing. _played (:5436, first unpaused frame with a live hand) gates
 *     ARCHIVING only — counting is purely the roll_end beat.
 * A lapsed returner is exactly who probes this: back after a break, roams the graph,
 * restarts stale rolls — if aborts counted, three restarts would hand them the challenge.
 *
 * Nearest accepted neighbors, differentiated: endgame-stage-roll-cold-not-broken pins the
 * MOMENTUM axis of the same stageRollAt seam (combo/chip, no challenge economy);
 * holder-victory-no-break-next-roll-cold pins the WIN path's momentum reset;
 * returner-day-counter-clean-restart pins day counters. Nothing in the corpus pins the
 * CHALLENGE counter across resetRoll + restage aborts — that firewall is the novel axis.
 *
 * Persona premise: lapsedReturner (= whiteBeltHolder) seeds challenges:{} — the blue entry
 * is GENUINELY absent pre-play (stored-blob absence is assertable, not just progress 0).
 * The DSL's default tutorial autofill touches only white-track compatibility; blue untouched.
 *
 * Determinism census (probe green 2/2, ~8s each):
 *   - land() rigs the intro's ai-skill/role/max-moves; rigStart pins the start (no start-pos).
 *   - resetRoll -> startRoll consumes max-moves, role, ai-skill; rigged fresh + rigStart(Mount).
 *   - stageRollAt -> rollFromPosition consumes max-moves + ai-skill; role is DERIVED from a
 *     "... Top"-titled target (:4808) so rigging role would leave a leftover queue value to
 *     leak into later draws — deliberately rig only ai-skill + max-moves per stage.
 *   - stageRollAt is a rail call (canvas hit-testing has no DOM); arrival is after(0.6,
 *     enterLand, ignorePause) so advance(1500) lands the staged hand WHILE PAUSED.
 *   - each hop and the finish rig resolve/outcome [0.01]; landing questions draw only the
 *     surface-scoped land-mc-pick/land-mc-shuffle and are ignored (irrelevant here — combo
 *     breaks don't touch roll_end).
 *   - advanceUntil is stream-blind, so the finish -> roll_end wait compares beat COUNT
 *     against a baseline instead.
 * No content-text assertions: node titles used only to SELECT graph targets; every assert is
 * beat counts, flags, and the {progress, done, t} entry shape.
 */

test("resetRoll + two stageRollAt restages emit no roll_end and leave blue.roll-three untouched; one finished roll then counts exactly one", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/", { initialState: lapsedReturner() })
  await j.land("Mount Top")

  const app = () => page.evaluate(() => {
    const a = (window as any).__neural
    return { played: !!a._played, paused: !!a.paused, pos: a.currentPos, hand: (a.optionIdxs || []).length }
  })
  const live = () => page.evaluate(() => (window as any).__neural.challengeProgress("blue.roll-three"))
  const stored = () => page.evaluate(() => {
    const a = (window as any).__neural
    a._flushSave() // save is 400ms wall-clock debounced — flush before every stored read
    const blob = JSON.parse(localStorage.getItem("bjj-neural-progress") || "{}")
    return (blob.challenges || {})["blue.roll-three"] ?? null
  })
  const count = async (beat: string) => (await j.beats()).filter((b: any) => b.beat === beat).length

  // ── baseline: the counter is virgin, live AND in storage ──
  expect(await live(), "live progress entry is the zero shape").toEqual({ progress: 0, done: false, t: 0 })
  expect(await stored(), "no blue.roll-three key in the stored blob — the persona never rolled").toBeNull()
  expect(await count("roll_end"), "no roll has ended").toBe(0)

  // ── ABORT 1 — resetRoll over a roll that GENUINELY PLAYED (the strongest abandon) ──
  expect((await app()).played, "premise: the intro roll ran unpaused with a live hand").toBe(true)
  await j.rig("ai-skill", [0.5])
  await j.rig("role", [0])
  await j.rig("max-moves", [0.5])
  await page.evaluate(() => {
    const a = (window as any).__neural
    const idx = a.nodes.findIndex((n: any) => n.ty === "positions" && n.t === "Mount Top")
    a.rigStart(idx) // deterministic restart target: startRoll skips the start-pos draw
    a.resetRoll()
  })
  await j.nextHand(30000)
  expect(await count("roll_end"), "resetRoll abandoned a played roll with ZERO roll_end").toBe(0)

  // ── ABORT 2 + 3 — stage elsewhere, then restage over the never-played stage ──
  const firstStage: number = await page.evaluate(() => {
    const a = (window as any).__neural
    for (const n of a.nodes) {
      if (n.ty !== "positions" || !/ Top$/.test(n.t || "")) continue
      if (n.idx === a.currentPos || n.t === "Side Control Top") continue
      if (!a.adj[n.idx].some((k: number) => a.nodes[k].ty !== "positions")) continue
      return n.idx
    }
    return -1
  })
  expect(firstStage, "a playable Top-role position elsewhere on the graph").toBeGreaterThanOrEqual(0)
  const restage: number = await page.evaluate(() => {
    const a = (window as any).__neural
    const n = a.nodes.find((n: any) => n.ty === "positions" && n.t === "Side Control Top")
    return n && a.adj[n.idx].some((k: number) => a.nodes[k].ty !== "positions") ? n.idx : -1
  })
  expect(restage, "Side Control Top is playable (submission-rich for the final roll)").toBeGreaterThanOrEqual(0)

  for (const target of [firstStage, restage]) {
    // rollFromPosition consumes max-moves + ai-skill; role derives from the "... Top" title —
    // rig NO role value or the leftover would leak into a later draw
    await j.rig("ai-skill", [0.5])
    await j.rig("max-moves", [0.5])
    await page.evaluate((i) => (window as any).__neural.stageRollAt(i), target) // rail: canvas taps have no DOM
    await j.advance(1500) // after(0.6, enterLand, ignorePause) — the staged hand lands while paused
    const s = await app()
    expect(s.pos, "we stand at the staged node").toBe(target)
    expect(s.paused, "the clock is HELD — a staged roam is not a running roll").toBe(true)
    expect(s.played, "_played stays false: it never ran an unpaused frame").toBe(false)
    expect(s.hand, "yet the hand is dealt (stage = land + deal, clock held)").toBeGreaterThan(0)
  }
  expect(await count("roll_staged"), "exactly two stage beats — the restage re-staged, not re-rolled").toBe(2)
  expect(await count("roll_end"), "still ZERO roll_end across reset + stage + restage").toBe(0)
  expect(await live(), "live progress untouched by three aborts").toEqual({ progress: 0, done: false, t: 0 })
  expect(await stored(), "stored blob still has NO blue.roll-three key after the aborts").toBeNull()

  // ── the one REAL roll: press play at Side Control Top and finish it ──
  await page.evaluate(() => (window as any).__neural.setPaused(false))
  await j.advance(600)
  expect((await app()).played, "_played flips on the first unpaused frame with a live hand").toBe(true)

  const subInTray = () => page.evaluate(() => {
    const a = (window as any).__neural
    for (const o of a.optionIdxs || []) {
      const n = a.nodes[typeof o === "number" ? o : o.idx]
      if (n && n.ty === "submissions") return n.t as string
    }
    return null
  })
  const firstTransition = () => page.evaluate(() => {
    const a = (window as any).__neural
    for (const o of a.optionIdxs || []) {
      const n = a.nodes[typeof o === "number" ? o : o.idx]
      if (n && n.ty === "transitions") return n.t as string
    }
    return null
  })

  let sub: string | null = await subInTray()
  for (let hop = 0; hop < 5 && !sub; hop++) {
    const t = await firstTransition()
    expect(t, "a transition to hop on toward a submission").toBeTruthy()
    await j.rig("resolve", [0.01])
    await j.rig("outcome", [0.01])
    await j.pick(t as string)
    await j.nextHand()
    sub = await subInTray()
  }
  expect(sub, "a submission dealt within 5 hops from Side Control Top").toBeTruthy()

  const endsBefore = await count("roll_end") // 0 — but advanceUntil is stream-blind, count anyway
  await j.rig("resolve", [0.01])
  await j.rig("outcome", [0.01])
  await j.pick(sub as string)
  await j.advanceUntil("finish", 20000)
  let ends = endsBefore
  for (let spent = 0; spent < 20000 && ends <= endsBefore; spent += 400) {
    await j.advance(400)
    ends = await count("roll_end")
  }

  // ── exactly ONE completed roll, and the counter moved exactly ONE ──
  expect(ends, "one roll_end across the ENTIRE journey — only the finished roll counts").toBe(endsBefore + 1)
  expect(await j.lastOutcome(), "and it ended as a win").toBe("win")
  expect(await count("roll_staged"), "the win minted no phantom stage beats").toBe(2)
  const after = await live()
  expect(after.progress, "blue.roll-three advanced by exactly one").toBe(1)
  expect(after.done, "1/3 is not done").toBe(false)
  expect(typeof after.t, "the entry is now timestamped").toBe("number")
  const entry = await stored()
  expect(entry, "the stored blob now carries the entry").toBeTruthy()
  expect(entry.progress, "stored progress is 1 — aborts contributed nothing").toBe(1)
  expect(!!entry.done, "stored entry not done at 1/3").toBe(false)
  expect(
    (await j.beats()).filter((b: any) => b.beat === "challenge_completed" && b.id === "blue.roll-three").length,
    "no completion celebrated at 1/3",
  ).toBe(0)
})
