import { test, expect, Page } from "@playwright/test"
import { journey } from "../dsl"

/**
 * LAST ROLLS: ▶ ROLL FROM HERE, ⟲ REPLAY (v1.106.5)
 *
 * Owner: "History should have a play from here and a replay button indeed."
 *
 * What these journeys pin, and why each one exists:
 *   1. the film WALKS the archived exchanges on the graph — asserted by PROJECTING each step's
 *      node through draw()'s transform into the viewport rect, never by reading camTarget (the
 *      canon of share-camera.spec.ts: "a test that asserts camTarget was assigned is exactly how
 *      this survived three passes" — camTarget is rewritten by the follow-cam every frame).
 *   2. a film CREDITS NOTHING. Stage, srs, prep, score, challenges, badges, coins and the whole
 *      persisted blob are byte-identical across a complete replay, and no progress-bearing beat
 *      is emitted. Watching is not doing.
 *   3. THE CLOCK IS HELD, and any real input on the graph ends the film and gives the camera back.
 *   4. ▶ asks first (it discards the roll you are in), then STAGES the roll — clock held, pane out
 *      of the way — on the side that roll was actually played from.
 *   5. under prefers-reduced-motion the film STEPS: no travel pulse is ever created, and it still
 *      reaches the end.
 *   6. on the phone, closing the drawer is how you WATCH: it hands the pause latch to the film
 *      instead of resuming the roll under it.
 *
 * Every mouse claim goes through j.clickByMouse (measured centre + elementFromPoint), because the
 * app's recurring bug class is a control that is visible, enabled and dead to a real mouse.
 */

type App = any

/** Build ONE archived roll: land, take a real exchange (so an edge is logged), then stage a fresh
 *  roll — which is what files the played roll into Previous rolls. */
async function archivedRoll(j: any, page: Page) {
  await j.boot("/")
  await j.land("Mount Top")
  // Take exchanges until the roll has actually CHANGED STATE: a move whose outcome returns you to
  // the same position (Maintain Mount and friends) is deduped out of the log by design, so one
  // pick is not a guarantee of an edge.
  let moved = 1
  for (let n = 0; n < 5 && moved < 2; n++) {
    await j.rig("resolve", [0.01]) // the attempt lands
    await j.rig("outcome", [0.01])
    const titles = await j.optionTitles()
    expect(titles.length, "premise: a hand was dealt").toBeGreaterThan(0)
    await j.pick(titles[Math.min(n, titles.length - 1)])
    await j.nextHand()
    moved = await page.evaluate(() => ((window as any).__neural.rollLog || []).length)
  }
  expect(moved, "premise: the roll visited more than one state, so it has an EDGE to replay").toBeGreaterThan(1)
  await page.evaluate(() => {
    const a: App = (window as any).__neural
    a.rollFromPosition(a.currentPos, true) // archives the played roll; leaves a staged, held board
  })
  // ...and let that staged landing ARRIVE. It rides an ignorePause timer (that is the whole point
  // of staging), so leaving it in flight would make it land in the middle of whatever the test
  // does next and look like the replay had moved the roll.
  await j.advance(1500)
  await dismissRewards(page)
  const past = await page.evaluate(() => {
    const a: App = (window as any).__neural
    const r = (a._pastRolls || [])[0]
    return r ? { ts: r.ts, states: (r.log || []).length, start: r.log[0].idx, role: r.log[0].role, steps: a.replaySteps(r).length, vias: (r.log || []).filter((h: any) => h.via).length } : null
  })
  expect(past, "premise: one roll is archived in Previous rolls").not.toBeNull()
  expect(past.vias, "premise: the archived log recorded the EDGE of its exchange (via)").toBeGreaterThan(0)
  return past
}

const openHistory = (page: Page) => page.evaluate(() => (window as any).__neural.openPane("history"))

/** Challenge rewards earned while building the fixture ride a z:14 root-plane toast at top-right —
 *  on a 390px screen that is squarely over the pane's rows. Dismiss them like a user would, so a
 *  reachability claim is about THIS feature and not about a toast that happened to be up. */
async function dismissRewards(page: Page) {
  // dispatched IN the page, never through a locator: the reward queue swaps the toast out from
  // under you, and a locator that resolved to the outgoing element waits for it forever.
  for (let i = 0; i < 8; i++) {
    const left = await page.evaluate(() => {
      const b = document.querySelector("[data-reward-close]") as HTMLElement | null
      if (b) b.click()
      return document.querySelectorAll("[data-reward-close]").length
    })
    if (!left) return
    await page.waitForTimeout(60)
  }
}

/** The share-camera projection: where a node actually lands on screen, through draw()'s transform. */
const shot = (page: Page) =>
  page.evaluate(() => {
    const a: App = (window as any).__neural
    const W = a.W, H = a.H, scale = W / a.cam.vw
    const project = (n: any) => ({ x: Math.round(W / 2 + (n.x - a.cam.cx) * scale), y: Math.round(H / 2 + (n.y - a.cam.cy) * scale) })
    const R = a._replay
    const step = R && R.i >= 0 ? R.steps[R.i] : null
    const inside = (q: any) => !!q && q.x >= 0 && q.x <= W && q.y >= 0 && q.y <= H
    // the establishing shot claims the WHOLE roll is framed, so that is what is checked for it
    const keys = step ? (step.kind === "wide" ? step.nodes : [step.kind === "land" ? step.to : step.via]) : []
    const pts = keys.filter((k: any) => k != null && a.nodes[k]).map((k: any) => project(a.nodes[k]))
    const p = pts[0] || null
    return {
      alive: !!R,
      i: R ? R.i : -1,
      kind: step ? step.kind : null,
      node: keys.length === 1 ? keys[0] : -1,
      onScreen: pts.length > 0 && pts.every(inside),
      p, W, H,
      vw: Math.round(a.cam.vw),
      cam: { cx: Math.round(a.cam.cx), cy: Math.round(a.cam.cy) },
      held: typeof a.camHeld === "function" ? !!a.camHeld() : false,
      paused: !!a.paused,
      pulse: !!a.pulse,
    }
  })

const progress = (page: Page) =>
  page.evaluate(() => {
    const a: App = (window as any).__neural
    return {
      stage: JSON.stringify(a.stage || {}),
      srs: JSON.stringify(a.srs || {}),
      prep: JSON.stringify(a.prep || {}),
      rec: JSON.stringify(a.rec || {}),
      challenges: JSON.stringify(a.challenges || {}),
      badges: JSON.stringify(a.badges || {}),
      coins: JSON.stringify(a.coins || {}),
      units: JSON.stringify(a.units || {}),
      score: a.gameScore().score,
      blob: localStorage.getItem("bjj-neural-progress") || "",
      currentPos: a.currentPos,
      rollLog: JSON.stringify((a.rollLog || []).map((h: any) => h.key)),
    }
  })

test("@curated a past roll's ⟲ walks its exchanges on the graph, and both row controls take a real mouse", async ({ page }) => {
  const j = journey(page)
  const past = await archivedRoll(j, page)
  await openHistory(page)

  const row = page.locator(`[data-past-roll="${past.ts}"]`)
  await expect(row, "the archived roll has a row in Last rolls").toHaveCount(1)
  // the two controls, named for a screen reader (a title is not an accessible name)
  const play = page.locator(`[data-roll-from="${past.ts}"]`)
  const rep = page.locator(`[data-replay-roll="${past.ts}"]`)
  expect(await play.getAttribute("aria-label")).toMatch(/^Roll from .+, (top|bottom)$/)
  expect(await rep.getAttribute("aria-label")).toMatch(/^Replay .+ → .+$/)
  // ...and they keep their distance: two different verbs on one row, 12px minimum
  const gap = await page.evaluate((ts) => {
    const p = document.querySelector(`[data-roll-from="${ts}"]`)!.getBoundingClientRect()
    const r = document.querySelector(`[data-replay-roll="${ts}"]`)!.getBoundingClientRect()
    return { gap: Math.round(r.left - p.right), pw: Math.round(p.width), ph: Math.round(p.height) }
  }, past.ts)
  expect(gap.gap, "▶ and ⟲ sit at least 12px apart").toBeGreaterThanOrEqual(12)
  expect(gap.pw, "the pane's control figure is a 24px glyph (hit area grows past it)").toBeGreaterThanOrEqual(24)

  await j.clickByMouse(`[data-replay-roll="${past.ts}"]`, "the past roll's replay control")
  await expect(page.locator("[data-replay-bar]"), "the film says what it is playing").toBeVisible()
  expect((await j.beats()).some((b: any) => b.beat === "roll_replay_start")).toBe(true)

  // WALK IT. Sample every 100ms and record where the CURRENT step's node projects to. A step is
  // satisfied if its node was inside the viewport at any point while it was the live step.
  const seen = new Map<number, { kind: string; onScreen: boolean; node: number }>()
  const cams: string[] = []
  for (let t = 0; t < 24000; t += 100) {
    const s = await shot(page)
    if (!s.alive) break
    // `_replay.i` runs one PAST the last step while the film holds its closing frame, so a sample
    // with no live step is the end card, not a beat.
    if (s.i >= 0 && s.kind) {
      const prev = seen.get(s.i)
      seen.set(s.i, { kind: s.kind!, node: s.node!, onScreen: (prev ? prev.onScreen : false) || s.onScreen })
      cams.push(`${s.cam.cx},${s.cam.cy},${s.vw}`)
    }
    await j.advance(100)
  }
  const total = past.steps
  expect(seen.size, `the film walked every one of its ${total} beats`).toBe(total)
  const offscreen = [...seen.entries()].filter(([, v]) => !v.onScreen)
  expect(offscreen.map(([i, v]) => `step ${i} (${v.kind}, node ${v.node})`).join(" · "), "every beat's node was framed on screen while it played").toBe("")
  expect(new Set(cams).size, "the camera actually moved through the roll").toBeGreaterThan(1)
  expect(seen.get(0)!.kind, "the film opens on the whole roll, then walks it").toBe("wide")
  expect(seen.get(1)!.kind, "then the state it started in").toBe("land")
  expect([...seen.values()].some((v) => v.kind === "sweep"), "and a roll with an exchange has a SWEEP between its landings").toBe(true)

  // and it hands everything back
  const after = await shot(page)
  expect(after.alive, "the film ended on its own").toBe(false)
  await expect(page.locator("[data-replay-bar]")).toHaveCount(0)
  expect(after.held, "the film's camera lease died with it").toBe(false)
})

test("@curated a replay credits nothing — no stage, no srs, no score, no challenge evidence", async ({ page }) => {
  const j = journey(page)
  const past = await archivedRoll(j, page)
  await openHistory(page)
  const before = await progress(page)
  const beats0 = (await j.beats()).length

  await j.clickByMouse(`[data-replay-roll="${past.ts}"]`, "the past roll's replay control")
  for (let t = 0; t < 24000; t += 200) {
    if (!(await page.evaluate(() => !!(window as any).__neural._replay))) break
    await j.advance(200)
  }
  await j.advance(400)

  const after = await progress(page)
  for (const k of ["stage", "srs", "prep", "rec", "challenges", "badges", "coins", "units", "blob", "rollLog"] as const)
    expect(after[k], `${k} is untouched by watching a recording`).toBe(before[k])
  expect(after.score, "Game Knowledge cannot move because you watched").toBe(before.score)
  expect(after.currentPos, "the live roll is exactly where it was").toBe(before.currentPos)

  // ...and the film's beats never reached the challenge/sound seam: they are not fx() beats.
  const added = (await j.beats()).slice(beats0).map((b: any) => b.beat)
  expect(added.filter((b) => b === "roll_replay_start").length, "one start beat").toBe(1)
  expect(added.filter((b) => b === "roll_replay_end").length, "one end beat").toBe(1)
  const forbidden = added.filter((b) => /^(land|options_dealt|commit|impact_|escape|roll_end|card_|combo|belt_|challenge_|patch_|coin_)/.test(b))
  expect(forbidden.join(","), "a film emits no gameplay beat of its own").toBe("")
  const sounds = await j.soundLog()
  expect(sounds.filter((s: any) => /^roll_replay/.test(s.beat)).length, "and it is silent — no cue is mapped to a beat that never goes through fx()").toBe(0)
})

test("the clock is held for the whole film, and a hand on the graph ends it", async ({ page }) => {
  const j = journey(page)
  const past = await archivedRoll(j, page)
  await openHistory(page)
  const before = await progress(page)

  await j.clickByMouse(`[data-replay-roll="${past.ts}"]`, "the past roll's replay control")
  await j.advance(900)
  const mid = await shot(page)
  expect(mid.alive, "the film is running").toBe(true)
  expect(mid.paused, "the game clock is held while the film plays").toBe(true)
  expect(mid.held, "and the film owns the camera while it does").toBe(true)

  // a real pan on the canvas — never fight the user's camera
  await page.mouse.move(1150, 300)
  await page.mouse.down()
  await page.mouse.move(1090, 340, { steps: 6 })
  await page.mouse.up()

  const after = await shot(page)
  expect(after.alive, "a pan cancels the film").toBe(false)
  expect(after.held, "and releases the camera it was holding").toBe(false)
  await expect(page.locator("[data-replay-bar]"), "its chrome goes with it").toHaveCount(0)
  const st = await progress(page)
  expect(st.currentPos, "the paused roll underneath is untouched").toBe(before.currentPos)
  expect(st.rollLog).toBe(before.rollLog)
  expect(await page.evaluate(() => !!(window as any).__neural.paused), "a pane-paused roll stays paused: the film only gives back a pause it took").toBe(true)

  // Esc is the other way out, from the top of the ladder but above the pane
  await j.clickByMouse(`[data-replay-roll="${past.ts}"]`, "replay again")
  await j.advance(300)
  await page.keyboard.press("Escape")
  expect(await page.evaluate(() => !!(window as any).__neural._replay), "Esc stops the film").toBe(false)
  expect(await page.evaluate(() => !!(window as any).__neural.deckShown), "...and does NOT close the pane in the same press (pane law: the pane is last)").toBe(true)
})

test("@curated ▶ asks first, then stages that roll's opening state — clock held, on the side you played", async ({ page }) => {
  const j = journey(page)
  const past = await archivedRoll(j, page)
  await openHistory(page)

  // cancelling changes nothing
  const before = await progress(page)
  await j.clickByMouse(`[data-roll-from="${past.ts}"]`, "the past roll's play control")
  await expect(page.locator(".ng-cf-yes"), "it asks before discarding the roll you are in").toBeVisible()
  expect(await page.evaluate(() => document.body.innerText)).toMatch(/Set the board here/i)
  await page.locator(".ng-cf-no").click()
  // it fades for 160ms before it is removed, and a z:95 scrim owns every point until it is: a
  // second click aimed at the row would land on the dying overlay.
  await expect(page.locator(".ng-cf-yes"), "the confirm is gone, not merely transparent").toHaveCount(0)
  expect((await progress(page)).currentPos, "cancel is a no-op").toBe(before.currentPos)

  await j.clickByMouse(`[data-roll-from="${past.ts}"]`, "the past roll's play control")
  await page.locator(".ng-cf-yes").click()
  await j.advance(1200) // the staged landing arrives on an ignorePause timer

  const st = await page.evaluate(() => {
    const a: App = (window as any).__neural
    return { pos: a.currentPos, role: a.playerRole, paused: !!a.paused, hand: (a.optionIdxs || []).length, pane: !!a.deckShown }
  })
  expect(st.pos, "the new roll is seeded where that roll started").toBe(past.start)
  expect(st.role, "on the side it was actually played from — not the constant 'top' a hub title derives").toBe(String(past.role).toLowerCase())
  expect(st.hand, "the hand is dealt").toBeGreaterThan(0)
  expect(st.paused, "and the clock is HELD: a staged board waits for you (ROAM & STAGE)").toBe(true)
  expect(st.pane, "the pane got out of the way, or the board would be set behind it").toBe(false)
})

test.describe("under prefers-reduced-motion", () => {
  test("the film steps discretely — it never animates a sweep, and still reaches the end", async ({ page }) => {
    const j = journey(page)
    const past = await archivedRoll(j, page)
    // `page.emulateMedia`, NOT `test.use({ reducedMotion })`: measured in this harness, the fixture
    // option leaves `matchMedia("(prefers-reduced-motion: reduce)").matches` FALSE in the page, so
    // a spec relying on it would assert nothing and pass forever. This also proves the app reads
    // the preference at the moment it matters (replay start), not once at boot.
    await page.emulateMedia({ reducedMotion: "reduce" })
    await openHistory(page)
    await j.clickByMouse(`[data-replay-roll="${past.ts}"]`, "the past roll's replay control")
    expect(await page.evaluate(() => (window as any).__neural._replay.reduced), "the app read the preference").toBe(true)

    let sawPulse = false
    let maxStep = -1
    for (let t = 0; t < 24000; t += 120) {
      const s = await shot(page)
      if (!s.alive) break
      sawPulse = sawPulse || s.pulse
      if (s.kind) maxStep = Math.max(maxStep, s.i)   // the closing frame is not a beat (see above)
      await j.advance(120)
    }
    expect(sawPulse, "no travel pulse is ever created under reduced motion").toBe(false)
    expect(maxStep, "and the film still walks every beat").toBe(past.steps - 1)
  })
})

test.describe("on the phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })
  test("closing the drawer is how you watch: the clock stays held and the film survives", async ({ page }) => {
    const j = journey(page)
    const past = await archivedRoll(j, page)
    // the fixture leaves a STAGED board (paused by the stage, not by the pane), and the handover
    // this journey is about only exists when the PANE is what stopped the clock — so put the roll
    // back in motion first, exactly as a player who is mid-roll when they open the drawer.
    await page.evaluate(() => (window as any).__neural.setPaused(false))
    await openHistory(page)
    expect(await page.evaluate(() => !!(window as any).__neural._paneAutoPaused), "premise: the PANE is what holds the clock").toBe(true)
    await j.clickByMouse(`[data-replay-roll="${past.ts}"]`, "the past roll's replay control")
    await j.advance(300)

    // the drawer IS the screen here — the user closes it to look at the graph
    await page.evaluate(() => (window as any).__neural.setDeckOpen(false))
    await j.advance(300)
    const s = await page.evaluate(() => {
      const a: App = (window as any).__neural
      return { alive: !!a._replay, paused: !!a.paused, latch: !!a._replayAutoPaused, pane: !!a.deckShown }
    })
    expect(s.pane, "the drawer is closed").toBe(false)
    expect(s.alive, "the film survived the gesture that exists to see it").toBe(true)
    expect(s.paused, "and the clock is still held — the pause latch was handed to the film").toBe(true)
    expect(s.latch, "explicitly: the film now owns the pause it inherited").toBe(true)

    // its ✕ is a real thumb target on a 390px screen
    await j.clickByMouse("[data-replay-stop]", "the film's stop control")
    expect(await page.evaluate(() => !!(window as any).__neural._replay), "✕ stops it").toBe(false)
    expect(await page.evaluate(() => !!(window as any).__neural.paused), "and the roll resumes, because the film was holding that pause").toBe(false)
  })
})
