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
      blob: window.__ngGuestProgressRaw() || "",
      currentPos: a.currentPos,
      rollLog: JSON.stringify((a.rollLog || []).map((h: any) => h.key)),
    }
  })

test("a past roll's ⟲ walks its exchanges on the graph, and both row controls take a real mouse", async ({ page }) => {
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

test("a replay credits nothing — no stage, no srs, no score, no challenge evidence", async ({ page }) => {
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

  // a real pan on the canvas — never fight the user's camera.
  // STALE CONTRACT (D-318 U4a, CI 48be3a910): the centred reading arrival frames the graph
  // differently, and a graph-chrome button now sits under the old fixed (1150,300). Start and end
  // the same 60x40 drag on measured, unobstructed canvas instead.
  const pan = await page.evaluate(() => {
    const canvas = (window as any).__neural.canvasRef.current
    for (let fy = .2; fy <= .8; fy += .05) for (let fx = .9; fx >= .1; fx -= .05) {
      const x = innerWidth * fx, y = innerHeight * fy
      if (document.elementFromPoint(x, y) === canvas && document.elementFromPoint(x - 60, y + 40) === canvas) return { x, y }
    }
    return null
  })
  expect(pan, "a real pan starts and ends on unobstructed canvas").toBeTruthy()
  await page.mouse.move(pan!.x, pan!.y)
  await page.mouse.down()
  await page.mouse.move(pan!.x - 60, pan!.y + 40, { steps: 6 })
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

test("▶ asks first, then stages that roll's opening state — clock held, on the side you played", async ({ page }) => {
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

/**
 * THE FILM'S BAR NEVER COVERS A ROW'S CONTROL ON A PHONE, AND NO ROW MOVES FOR IT (FOLLOW1 and FOLLOW1-R1, v1.293.1)
 *
 * The bar docks where the landing card docks. With the drawer open on a phone the drawer is the screen, and that dock put
 * the bar across the middle of the drawer's list: measured at 390x631 on dev v1.292.1 and on v1.293.0, the bar at y 246
 * to 292 over a list running from 58 to 556, its left end 26 px off the screen, and an open Last rolls row's two actions
 * exactly under it (both hit the bar, not themselves). While the drawer is open on a phone the bar is a row of the drawer,
 * in the flow, AT ITS FOOT: after the list, above the account's foot (`_seatReplayBar`, app.src.jsx;
 * `.ng-replaybar[data-in-drawer]`, helmet.html). Anywhere else it is where it was.
 *
 * AT THE FOOT, NOT UNDER THE HEAD (FOLLOW1-R1). It stood under the head first, and the reader of PR #441 pressed what
 * that cost: the bar's coming and going moved every row by 44 px, the past rolls' rows are 43 px apart, so a second touch
 * at the same point no longer stopped the film (3 of 3; dev stops it), on the second row it started the FIRST roll's film
 * (3 of 3), and when a film ended by itself with a row open the next state's row stood under both its actions (3 of 3).
 * This file's own step then said "the film's start moved the list down by the bar's own height, no further": it asserted
 * the fault. It is 0 px now, for the list and for every row, at a film's start, its stop and its own end.
 *
 * §6.1's traps, each checked here rather than assumed: the bar's ✕ is pressed by a REAL touch at its measured middle, with
 * `elementFromPoint` at its middle and four edges (a control moved between planes is the class that is visible and
 * dead); nothing is hidden by opacity; the bar in the drawer is not docked at all (in the flow, no measured rect, no CSS
 * constant) and on the map it docks as before; no inline style is reset by hand; and its box is asserted as rendered
 * (44 px, whole on the screen), which is what Quartz's bare-element rules would move. THE STACKING TRAP, AS IT IS: a
 * `z-index:auto` stood in the drawer's rule "so the bar would not paint over the drawer's menus", and its mutant survived
 * twice (the reader's M6, then mine): the account's menu, the one thing that opens over the bar's row, is drawn on the
 * root plane and stands over the bar whatever the bar's own z. The declaration is gone and the claim with it. What a
 * player needs there IS asserted: the menu's items over the bar's row are each reached by a touch.
 *
 * Mutants (each alone, in the served bundle, a clean control first):
 *   B1 the bar back under the drawer's head (`_seatReplayBar`) → "…no row moves…" at "the film's start moved no row: the
 *      list and every row where they were"
 *   B2 it takes its drawer seat on a desktop too → the desktop's test at "on a desktop the bar stays on the map, beside
 *      the drawer"
 *   B3 the drawer's opening and closing do not move it (`applyDeckVisibility`'s call out) → "no control of an open row…"
 *      at "the drawer shut, the bar is back on the map"
 *   B4 the drawer's style for it is gone (helmet.html's rule out: still a fixed card, but inside the drawer) → "…no row
 *      moves…" at "the list ends above the bar, and the bar above the account's foot"
 *   B5 a resize across the phone's width does not move it (`resize`'s call out) → the resize test at "narrowed to a
 *      phone's width, the bar is a row of the drawer"
 *   B6 the repaint puts the list back at its top (`_refreshHistoryRows`, a line added) → "a row at the list's foot…" at
 *      "the film's start moved no row of a scrolled list"
 *   B7 the bar never takes its seat in the drawer at all → "…no row moves…" at "the bar is a row of the drawer, at its foot"
 * TWO NON-KILLS THAT CHANGED THE CODE: a line that put the list's scroll back by hand after the repaint (the browser
 * already keeps it: the rows are rebuilt in one task), and `z-index:auto` in the drawer's rule (above). Both are gone.
 * FOUND, NOT THIS CHANGE'S: on the map on a phone the bar follows the landing card's column (`_layoutLandHorizontal`), and
 * over a card that is a deck that leaves its left end 26 px off the screen (its dot and border; the words start at the edge).
 * It was so before, drawer open or shut, and is so on the map still (the next job's).
 * NOT COVERED: a film STEP re-seats the bar too (`_renderReplayBar`), so B3 and B5 are caught only because no film time
 * passes between the gesture and the reading; a rotation of a real phone (the same `resize`).
 */
type Rect = { left: number; top: number; right: number; bottom: number; width: number; height: number }
const barGeo = (page: Page) =>
  page.evaluate(() => {
    const a: App = (window as any).__neural
    const rr = (el: Element | null): Rect | null => { if (!el) return null; const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height } }
    const bar = document.querySelector("[data-replay-bar]") as HTMLElement | null, drawer = a.drillRef.current as HTMLElement, list = a.drillListRef.current as HTMLElement
    const acct = drawer.querySelector(".ng-acctwrap")
    const shown = list && list.offsetParent !== null
    return {
      film: !!a._replay, filmOf: a._replay ? (a._replay.id as number) : null, paused: !!a.paused, drawerOpen: !!a.deckShown, view: a._viewMode as string,
      bar: rr(bar), inDrawer: !!bar && bar.hasAttribute("data-in-drawer"), parent: !bar ? null : bar.parentElement === drawer ? "the drawer" : bar.parentElement === (a.__ngRoot || document.body) ? "the app root" : "elsewhere",
      atFoot: !!bar && bar.nextElementSibling === acct, position: bar ? getComputedStyle(bar).position : null,
      list: shown ? rr(list) : null, scroll: shown ? list.scrollTop : null, acct: rr(acct), drawer: rr(drawer),
      // every row of the list, in order: a past roll's row or a state's row, and where its top is
      rows: shown ? [...list.querySelectorAll("[data-past-roll], [data-hist]")].filter((e) => (e as HTMLElement).offsetParent !== null).map((e) => Math.round(e.getBoundingClientRect().top * 10) / 10) : [],
      pastHead: rr(document.querySelector("[data-past-roll]")), vw: innerWidth, vh: innerHeight,
    }
  })
/** is this control whole inside `within` and the screen, and is it what a press at its middle and near both ends reaches */
const reach = (page: Page, selector: string, within: Rect) =>
  page.evaluate(({ sel, w }) => {
    return [...document.querySelectorAll(sel)].filter((e) => (e as HTMLElement).offsetParent !== null).map((e) => {
      const r = e.getBoundingClientRect(), cy = r.top + r.height / 2
      const hit = [[r.left + r.width / 2, cy], [r.left + 5, cy], [r.right - 5, cy], [r.left + r.width / 2, r.top + 4], [r.left + r.width / 2, r.bottom - 4]].map(([x, y]) => { const t = document.elementFromPoint(x, y); return !!t && (t === e || e.contains(t)) })
      const bar = document.querySelector("[data-replay-bar]"), b = bar ? bar.getBoundingClientRect() : null
      return { what: ((e.textContent || "").trim() || e.getAttribute("aria-label") || e.className).slice(0, 24), w: Math.round(r.width), h: Math.round(r.height),
        whole: r.top >= w.top - 0.5 && r.bottom <= w.bottom + 0.5 && r.left >= Math.max(0, w.left) - 0.5 && r.right <= Math.min(innerWidth, w.right) + 0.5, hit: hit.every(Boolean),
        underBar: !!b && e !== bar && !bar!.contains(e) && r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top }
    })
  }, { sel: selector, w: within })
/** the middle of a control, and whether the control is what a touch there reaches */
const middleOf = (page: Page, selector: string, dx = 0) =>
  page.evaluate(({ sel, dx }) => {
    const e = [...document.querySelectorAll(sel)].find((x) => (x as HTMLElement).offsetParent !== null) as HTMLElement | undefined
    if (!e) return null
    const r = e.getBoundingClientRect(), x = dx ? r.left + dx : r.left + r.width / 2, y = r.top + r.height / 2, t = document.elementFromPoint(x, y)
    return { x, y, ok: !!t && (t === e || e.contains(t)) }
  }, { sel: selector, dx })
/** a real touch at a control's measured middle, refused unless the control is what is there */
async function tapOn(page: Page, selector: string, what: string, dx = 0) {
  await page.evaluate((sel) => { const e = [...document.querySelectorAll(sel)].find((x) => (x as HTMLElement).offsetParent !== null) as HTMLElement | undefined; if (e) e.scrollIntoView({ block: "nearest" }) }, selector) // a row at the fold of a list is scrolled to, as a thumb does (the nearest edge, no further)
  const at = await middleOf(page, selector, dx)
  expect(at, `${what}: on the screen`).not.toBeNull()
  expect(at!.ok, `${what}: it is what a touch at (${Math.round(at!.x)},${Math.round(at!.y)}) reaches`).toBe(true)
  await page.touchscreen.tap(at!.x, at!.y)
  return at!
}
/** what a touch at a point reaches: which control, of which roll or row */
const under = (page: Page, at: { x: number; y: number }) =>
  page.evaluate(({ x, y }) => {
    const t = document.elementFromPoint(x, y) as HTMLElement | null
    if (!t) return null
    const rep = t.closest("[data-replay-roll]"), bar = t.closest("[data-replay-bar]"), act = t.closest(".ng-hact button") as HTMLElement | null, row = t.closest("[data-hist]")
    return { replayOf: rep ? rep.getAttribute("data-replay-roll") : null, replaying: !!rep && rep.hasAttribute("data-replaying"), bar: !!bar, stop: !!t.closest("[data-replay-stop]"),
      action: act ? (act.hasAttribute("data-hist-show") ? "Show on the map" : "Practise here") + " of " + ((act.closest(".ng-hact") as HTMLElement).previousElementSibling as HTMLElement).getAttribute("data-hist") : null,
      row: !act && row ? row.getAttribute("data-hist") : null }
  }, at)
/** a second played roll filed beside the fixture's one: the board put back in motion, an exchange taken, the roll filed */
async function secondPastRoll(j: any, page: Page) {
  await page.evaluate(() => (window as any).__neural.setPaused(false))
  let moved = await page.evaluate(() => ((window as any).__neural.rollLog || []).length)
  const start = moved
  for (let n = 0; n < 6 && moved < start + 1; n++) {
    await j.rig("resolve", [0.01]); await j.rig("outcome", [0.01])
    const titles = await j.optionTitles()
    expect(titles.length, "premise: a hand was dealt").toBeGreaterThan(0)
    await j.pick(titles[Math.min(n, titles.length - 1)])
    await j.nextHand()
    moved = await page.evaluate(() => ((window as any).__neural.rollLog || []).length)
  }
  await page.evaluate(() => { const a: App = (window as any).__neural; a.rollFromPosition(a.currentPos, true) })
  await j.advance(1500)
  await dismissRewards(page)
  const ts = await page.evaluate(() => ((window as any).__neural._pastRolls || []).map((r: any) => r.ts as number))
  expect(ts.length, "premise: two rolls are filed under Previous rolls").toBe(2)
  return ts // newest first, as the list shows them
}
/** Last rolls open on a phone by touch, the drawer holding the clock */
async function lastRollsByTouch(page: Page) {
  await page.evaluate(() => (window as any).__neural.setPaused(false)) // mid-roll when the drawer opens, as the film's own phone test above
  await tapOn(page, ".ng-logo", "the logo")
  await tapOn(page, '[data-view="history"]', "Last rolls")
  await expect(page.locator("[data-past-roll]").first()).toBeVisible()
}

test.describe("on a phone with the drawer open, 390x631 by touch", () => {
  test.use({ viewport: { width: 390, height: 631 }, hasTouch: true, isMobile: true })

  test("the film's bar is a row of the drawer at its foot, and no row moves when a film starts, stops or ends by itself", async ({ page }) => {
    const j = journey(page)
    await archivedRoll(j, page)
    const [first, second] = await secondPastRoll(j, page)
    await lastRollsByTouch(page)
    const g0 = await barGeo(page)
    expect(g0, "premise: Last rolls is open, the drawer holds the clock, no film yet").toMatchObject({ film: false, paused: true, drawerOpen: true, view: "history", bar: null })
    expect(g0.rows.length, "premise: two past rolls' rows and this roll's are on the list").toBeGreaterThanOrEqual(3)

    // THE FIRST ROW: a touch on its replay control, and a second touch at the same point
    const p1 = await tapOn(page, `[data-replay-roll="${first}"]`, "the first past roll's replay control")
    await j.advance(300)
    const g = await barGeo(page)
    expect({ film: g.film, of: g.filmOf }, "the film of that roll is running").toEqual({ film: true, of: first })
    expect({ list: g.list!.top - g0.list!.top, rows: g.rows.map((y, i) => y - g0.rows[i]) }, "the film's start moved no row: the list and every row where they were").toEqual({ list: 0, rows: g0.rows.map(() => 0) })
    expect({ parent: g.parent, inDrawer: g.inDrawer, atFoot: g.atFoot }, "the bar is a row of the drawer, at its foot").toEqual({ parent: "the drawer", inDrawer: true, atFoot: true })
    expect([g.bar!.top >= g.list!.bottom - 0.5, g.bar!.bottom <= g.acct!.top + 0.5], "the list ends above the bar, and the bar above the account's foot").toEqual([true, true])
    expect([g.bar!.left >= 0, g.bar!.right <= Math.min(g.vw, g.drawer!.right) + 0.5], "and the bar is whole on the screen, inside the drawer (its left end was 26 px off it)").toEqual([true, true])
    expect(g.bar!.height, "premise: the bar is a thumb's height, not a banner").toBeLessThanOrEqual(60)
    expect(g0.list!.bottom - g.list!.bottom, "the list gave the bar its room at its own end").toBeGreaterThanOrEqual(g.bar!.height)
    expect(await under(page, p1), "the control that was pressed is still under that point, now the one that stops").toMatchObject({ replayOf: String(first), replaying: true })
    await page.touchscreen.tap(p1.x, p1.y)
    const stopped = await barGeo(page)
    expect(stopped.film, "a second touch at the same point stops the film (the first row)").toBe(false)
    await expect(page.locator("[data-replay-bar]")).toHaveCount(0)
    expect({ list: stopped.list!.top - g0.list!.top, bottom: stopped.list!.bottom - g0.list!.bottom, rows: stopped.rows.map((y, i) => y - g0.rows[i]) }, "the film's stop moved no row either, and the list has its room back").toEqual({ list: 0, bottom: 0, rows: g0.rows.map(() => 0) })

    // THE SECOND ROW: the same two touches. Under the head it started the FIRST roll's film.
    const p2 = await tapOn(page, `[data-replay-roll="${second}"]`, "the second past roll's replay control")
    await j.advance(300)
    expect((await barGeo(page)).filmOf, "the second roll's film is running").toBe(second)
    expect(await under(page, p2), "its own control is still under that point").toMatchObject({ replayOf: String(second), replaying: true })
    await page.touchscreen.tap(p2.x, p2.y)
    expect((await barGeo(page)).film, "a second touch at the same point stops the film (the second row): no other film starts").toBe(false)

    // A FILM'S OWN END, WITH A ROW OPEN: the same buttons are under the same points just after
    await tapOn(page, `[data-replay-roll="${first}"]`, "the first past roll's replay control, again")
    await j.advance(300)
    await tapOn(page, "[data-hist-current]", "the latest row of this roll", 70)
    await page.waitForTimeout(400)
    const acts = await page.evaluate(() => [...document.querySelectorAll("[data-hist-current] + .ng-hact button")].map((b) => { const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } }))
    expect(acts.length, "premise: the open row shows its actions").toBeGreaterThan(0)
    const was = [] as unknown[]
    for (const a of acts) was.push(await under(page, a))
    for (const w of was) expect((w as any).action, "premise: each point is on an action of the open row").not.toBeNull()
    const mid = await barGeo(page)
    let over = false
    for (let i = 0; i < 80 && !over; i++) { await j.advance(250); over = !(await page.evaluate(() => !!(window as any).__neural._replay)) }
    expect(over, "premise: the film ended by itself").toBe(true)
    await page.waitForTimeout(150)
    const now = [] as unknown[]
    for (const a of acts) now.push(await under(page, a))
    expect(now, "across the film's own end the same buttons are under the same points").toEqual(was)
    const end = await barGeo(page)
    expect({ list: end.list!.top - mid.list!.top, rows: end.rows.map((y, i) => y - mid.rows[i]) }, "and the film's own end moved no row").toEqual({ list: 0, rows: mid.rows.map(() => 0) })
    expect(end.paused, "the drawer holds the clock, as before the film").toBe(true)
  })

  test("no control of an open row lies under the bar; its own ✕ is whole; the account's menu opens over it", async ({ page }) => {
    const j = journey(page)
    const past = await archivedRoll(j, page)
    await lastRollsByTouch(page)
    const g0 = await barGeo(page)
    await tapOn(page, `[data-replay-roll="${past.ts}"]`, "the past roll's replay control")
    await j.advance(300)
    expect((await barGeo(page)).film, "premise: the film is running").toBe(true)

    // every control of an open row, each row in turn: whole, reached by a press at its middle and both ends, none under the bar
    await tapOn(page, "[data-past-roll]", "the past roll's row (the film's start drew the list again, folded)", 70)
    const rows = await page.evaluate(() => [...document.querySelectorAll("[data-hist]")].filter((e) => (e as HTMLElement).offsetParent !== null).length)
    expect(rows, "premise: the past roll's states and this roll's are on the list").toBeGreaterThanOrEqual(past.states + 1)
    let checked = 0
    for (let i = 0; i < rows; i++) {
      const at = await page.evaluate((i) => { const e = [...document.querySelectorAll("[data-hist]")].filter((x) => (x as HTMLElement).offsetParent !== null)[i] as HTMLElement; e.scrollIntoView({ block: "nearest" }); const r = e.getBoundingClientRect(); return { x: r.left + 70, y: r.top + r.height / 2, ok: e.contains(document.elementFromPoint(r.left + 70, r.top + r.height / 2)) } }, i)
      expect(at.ok, `row ${i + 1}: its own body is what a touch reaches`).toBe(true)
      await page.touchscreen.tap(at.x, at.y)
      await page.waitForTimeout(400) // the actions fade in, and a row cut by the foot scrolls into view (R10)
      const now = await barGeo(page)
      const ctl = await reach(page, ".ng-hact button", now.list!)
      expect(ctl.length, `row ${i + 1}: it opened its actions`).toBeGreaterThan(0)
      for (const c of ctl) expect(c, `row ${i + 1}, "${c.what}": whole in the list, reached by a touch, not under the film's bar`).toMatchObject({ whole: true, hit: true, underBar: false })
      checked += ctl.length
    }
    expect(checked, "controls measured in all (a count, so that no row checked nothing)").toBeGreaterThanOrEqual(rows)
    expect((await barGeo(page)).film, "premise: the film ran through all of it").toBe(true)

    // the bar's own control: whole, 44 px, and what a touch reaches at its middle and its four edges
    const g1 = await barGeo(page)
    const stop = await reach(page, "[data-replay-stop]", g1.bar!)
    expect(stop.length).toBe(1)
    expect(stop[0], "the bar's ✕: whole inside the bar, reached at its middle and four edges").toMatchObject({ whole: true, hit: true })
    expect(Math.min(stop[0].w, stop[0].h), "and 44 px").toBeGreaterThanOrEqual(44)
    const label = await page.evaluate(() => { const l = document.querySelector("[data-replay-label]") as HTMLElement, r = l.getBoundingClientRect(); return { text: (l.textContent || "").trim(), left: r.left, right: r.right } })
    expect(label.text.length, "its words are written").toBeGreaterThan(3)
    expect(label.left, "and start on the screen").toBeGreaterThanOrEqual(0)

    // THE ACCOUNT'S MENU OPENS UPWARD FROM THE FOOT, RIGHT OVER THE BAR'S ROW: over it, not under it. (It is the root
    // plane's, so this holds whatever the bar's own z; the step is here for what a player needs, not as a z-index pin.)
    await tapOn(page, ".ngAcctChip", "the badge at the drawer's foot")
    await expect(page.locator(".ng-account-menu")).toBeVisible()
    await page.waitForTimeout(350) // the menu's own entry
    const menu = await reach(page, ".ng-account-menu button, .ng-account-menu a[href]", { left: 0, top: 0, right: 390, bottom: 631, width: 390, height: 631 })
    const overBar = menu.filter((m) => m.underBar) // (`underBar`: its box and the bar's meet)
    expect(overBar.length, "premise: the menu's items stand over the bar's row").toBeGreaterThan(0)
    expect(overBar.filter((m) => !m.hit).map((m) => m.what), "the account's menu opens over the film's bar: every item of it there is reached by a touch").toEqual([])
    await tapOn(page, ".ngAcctChip", "the badge again, to put the menu away")
    await expect(page.locator(".ng-account-menu")).toBeHidden()
    expect((await barGeo(page)).film, "premise: the film is still running").toBe(true)

    // the drawer shut (how a phone watches the film): the bar is on the map again, docked as before; opened, it is back
    await tapOn(page, ".ng-explorer-close", "shut the drawer")
    const shut = await barGeo(page)
    expect({ film: shut.film, drawerOpen: shut.drawerOpen, parent: shut.parent, inDrawer: shut.inDrawer, position: shut.position }, "the drawer shut, the bar is back on the map").toEqual({ film: true, drawerOpen: false, parent: "the app root", inDrawer: false, position: "fixed" })
    await j.advance(300)
    await page.waitForTimeout(120) // its dock runs on the next frame
    // (WHERE it docks on the map is dev's own and not this change's: over a landing card that is a deck the bar follows the
    // card's column, which on a phone leaves its left end 26 px off the screen, drawer open or shut. Named in the PR, not
    // asserted. Its ✕, at the other end, is what a thumb needs there:)
    const onMap = await reach(page, "[data-replay-stop]", { left: 0, top: 0, right: shut.vw, bottom: shut.vh, width: shut.vw, height: shut.vh })
    expect(onMap[0], "and its ✕ is whole on the screen there and reached by a touch").toMatchObject({ whole: true, hit: true })
    await tapOn(page, ".ng-logo", "the logo")
    if (!(await page.locator("[data-past-roll]").first().isVisible())) await tapOn(page, '[data-view="history"]', "Last rolls")
    const again = await barGeo(page)
    expect({ film: again.film, parent: again.parent, inDrawer: again.inDrawer, atFoot: again.atFoot }, "the drawer opened again, the bar is its row again").toEqual({ film: true, parent: "the drawer", inDrawer: true, atFoot: true })

    // its ✕ by a real touch: the film stops, the bar goes, and the list is as it was
    await tapOn(page, "[data-replay-stop]", "the film's ✕, in the drawer")
    await expect(page.locator("[data-replay-bar]"), "the ✕ stops the film and its bar goes").toHaveCount(0)
    const end = await barGeo(page)
    expect(end.film).toBe(false)
    expect([end.list!.top - g0.list!.top, end.list!.bottom - g0.list!.bottom], "the list is as it was: its top and its foot").toEqual([0, 0])
    expect(end.paused, "and the drawer holds the clock, as before the film").toBe(true)
  })

  // A ROW STANDING AT THE LIST'S FOOT WHEN THE FILM STARTS. The list gives the bar its room at its own end, so that row
  // leaves the view (the list's foot rises over it); it is never under the bar, and no row moves. The shelf is made long
  // for this by copies of the one roll really played (written into `_pastRolls`, each with its own time); the rows, the
  // scroll, the press and the film are the app's own.
  test("a row at the list's foot when a film starts leaves the view: no row moves, and nothing of the list is under the bar", async ({ page }) => {
    const j = journey(page)
    await archivedRoll(j, page)
    await page.evaluate(() => { const a: App = (window as any).__neural, real = a._pastRolls[0]; for (let k = 1; k <= 13; k++) a._pastRolls.push({ ...real, log: real.log.slice(), ts: real.ts - k * 60000 }) })
    await lastRollsByTouch(page)
    // scrolled by a hand, so that the list has a place to keep
    await page.evaluate(() => { const l = (window as any).__neural.drillListRef.current as HTMLElement; l.scrollTop = 61 })
    await page.waitForTimeout(100)
    const g0 = await barGeo(page)
    expect(g0.scroll, "premise: the list is long enough to scroll, and scrolled").toBe(61)
    // the past roll whose row is the last one whole above the list's foot
    const foot = await page.evaluate(() => {
      const a: App = (window as any).__neural, l = (a.drillListRef.current as HTMLElement).getBoundingClientRect()
      const rows = [...document.querySelectorAll("[data-past-roll]")].map((e) => ({ ts: e.querySelector("[data-replay-roll]")!.getAttribute("data-replay-roll")!, r: e.getBoundingClientRect() })).filter((x) => x.r.bottom <= l.bottom + 0.5 && x.r.top >= l.top)
      const last = rows[rows.length - 1]
      return last ? { ts: last.ts, fromFoot: l.bottom - last.r.bottom } : null
    })
    expect(foot, "premise: a past roll's row stands whole at the list's foot").not.toBeNull()
    expect(foot!.fromFoot, "premise: within a row's height of the foot").toBeLessThan(44)
    const z = await tapOn(page, `[data-replay-roll="${foot!.ts}"]`, "the replay control of the row at the list's foot")
    await j.advance(300)
    const g = await barGeo(page)
    expect({ film: g.film, of: String(g.filmOf) }, "its film is running").toEqual({ film: true, of: foot!.ts })
    expect({ list: g.list!.top - g0.list!.top, scroll: g.scroll! - g0.scroll!, rows: g.rows.map((y, i) => y - g0.rows[i]).filter((d) => d !== 0).length }, "the film's start moved no row of a scrolled list").toEqual({ list: 0, scroll: 0, rows: 0 })
    expect(g.list!.bottom, "nothing of the list is under the bar: the list ends above it").toBeLessThanOrEqual(g.bar!.top + 0.5)
    const row = await page.evaluate((ts) => { const e = document.querySelector(`[data-replay-roll="${ts}"]`)!.closest("[data-past-roll]")!, r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom } }, foot!.ts)
    expect(row.bottom, "the row that was pressed has left the view: the list's foot rose over it").toBeGreaterThan(g.list!.bottom)
    const u = await under(page, z)
    expect({ bar: u!.bar, another: u!.replayOf }, "where its control was is now the film's bar: no other row's control").toEqual({ bar: true, another: null })
    // a second touch there is a touch on the bar: its ✕ stops this film, anywhere else on it does nothing; never another film
    await page.touchscreen.tap(z.x, z.y)
    await j.advance(200)
    const after = await barGeo(page)
    expect(after.film ? String(after.filmOf) : "stopped", `a second touch at that point (on the bar${u!.stop ? "'s ✕" : ""}) starts no other film`).toBe(u!.stop ? "stopped" : foot!.ts)
    expect(after.rows.map((y, i) => y - g0.rows[i]).filter((d) => d !== 0).length, "and still no row has moved").toBe(0)
  })
})

/**
 * THE DRAWER'S HOME VIEW DURING A FILM, ON A SHORT PHONE (FOLLOW2, v1.293.2)
 *
 * The drawer opens on its home view, and the film's bar takes its room at the foot of whatever list shows. At 390x631
 * that is where the "Last rolls" door stands: the reader of PR #441 measured 5 of its 28 px showing and a touch at its
 * middle landing on the bar (in the real app the door lay wholly under it); on dev v1.293.0 it was reached without a
 * scroll. That door is the way back to the list the film was started from. When the home view comes up while a film's
 * bar stands in the drawer (the drawer's opening, the way home from a view) its list is scrolled just far enough to
 * show the door whole (`_showFilmDoor`, app.src.jsx). No finger is on a row then. And PR #441's rule holds here too: no
 * row of the home view moves when the film is stopped or ends by itself (the list gets the bar's room back at its end and
 * keeps its scroll: the rolls listed under the door are more than that room).
 *
 * Mutants: D1 the home view does not show the door (`_showFilmDoor` does nothing) → "the drawer opened again during a
 * film…" at "the Last rolls door is whole in the list and reached by a touch", and "no row of the home view…" at "by the
 * way home too, the door is whole and reached". D2 the door is shown at every redraw of the list, a payload's too
 * (`renderExplorer` calls it) → NOT WRITTEN: the harness lands its payloads before these steps, so no journey here
 * redraws the list under a scrolled player; UNGUARDED, and what to check by hand is a slow network on the home view.
 * NOT COVERED: a film STARTS only from Last rolls, so "no row moves when a film starts" has no home-view case; 390x844,
 * where the door is clear of the bar without a scroll (the function then moves nothing).
 */
const homeGeo = (page: Page) =>
  page.evaluate(() => {
    const a: App = (window as any).__neural, l = a.explorerListRef.current as HTMLElement, bar = document.querySelector("[data-replay-bar]")
    const rr = (el: Element | null): Rect | null => { if (!el) return null; const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height } }
    const shown = l && l.offsetParent !== null
    return { view: a._viewMode as string, film: !!a._replay, drawerOpen: !!a.deckShown, list: shown ? rr(l) : null, scroll: shown ? l.scrollTop : null, bar: rr(bar), door: shown ? rr(l.querySelector('[data-view="history"]')) : null,
      rows: shown ? [...l.querySelectorAll("button, summary")].filter((e) => (e as HTMLElement).offsetParent !== null).map((e) => Math.round(e.getBoundingClientRect().top * 10) / 10) : [] }
  })
/** a real touch at a control's measured middle WHERE IT STANDS (no scroll): refused unless the control is what is there */
async function tapWhereItIs(page: Page, selector: string, what: string) {
  const at = await middleOf(page, selector)
  expect(at, `${what}: on the screen`).not.toBeNull()
  expect(at!.ok, `${what}: it is what a touch at (${Math.round(at!.x)},${Math.round(at!.y)}) reaches, where it stands`).toBe(true)
  await page.touchscreen.tap(at!.x, at!.y)
}
/** a film started from Last rolls, the drawer shut (the film on the map), the drawer opened again by the logo */
async function reopenedDuringAFilm(j: any, page: Page) {
  const past = await archivedRoll(j, page)
  await lastRollsByTouch(page)
  await tapOn(page, `[data-replay-roll="${past.ts}"]`, "the past roll's replay control")
  await j.advance(300)
  await tapOn(page, ".ng-explorer-close", "shut the drawer")
  await j.advance(800)
  await tapOn(page, ".ng-logo", "the logo, during the film")
  await page.waitForTimeout(200)
  return past
}

test.describe("the drawer's home view during a film, 390x631 by touch", () => {
  test.use({ viewport: { width: 390, height: 631 }, hasTouch: true, isMobile: true })

  test("the drawer opened again during a film: its home view shows the Last rolls door whole, and the door opens the film's list", async ({ page }) => {
    const j = journey(page)
    const past = await reopenedDuringAFilm(j, page)
    const h = await homeGeo(page)
    expect({ view: h.view, film: h.film, drawerOpen: h.drawerOpen }, "premise: the drawer opened on its home view, the film still on").toEqual({ view: "explore", film: true, drawerOpen: true })
    expect(h.bar!.top, "premise: the film's bar stands at the foot of the home list").toBeGreaterThanOrEqual(h.list!.bottom - 0.5)
    const door = await reach(page, '[data-view="history"]', h.list!)
    expect(door.length, "premise: the home view has its Last rolls door").toBe(1)
    expect(door[0], "the Last rolls door is whole in the list and reached by a touch, at its middle, both ends, top and bottom, clear of the bar").toMatchObject({ whole: true, hit: true, underBar: false })
    await tapWhereItIs(page, '[data-view="history"]', "the Last rolls door, where it stands")
    await expect(page.locator("[data-past-roll]").first(), "the door opens Last rolls").toBeVisible()
    const g = await barGeo(page)
    expect({ view: g.view, film: g.film, of: g.filmOf, atFoot: g.atFoot }, "with the film still on, its bar at the list's foot").toEqual({ view: "history", film: true, of: past.ts, atFoot: true })
    await expect(page.locator(`[data-replay-roll="${past.ts}"][data-replaying]`), "and its own roll says it is the one playing").toHaveCount(1)
  })

  test("no row of the home view moves when a film is stopped or ends by itself", async ({ page }) => {
    const j = journey(page)
    const past = await reopenedDuringAFilm(j, page)
    const h = await homeGeo(page)
    expect({ view: h.view, film: h.film }, "premise: the home view, during a film").toEqual({ view: "explore", film: true })
    expect(h.rows.length, "premise: the home view's rows are on the list").toBeGreaterThan(5)
    // STOPPED, by the bar's own ✕
    await tapWhereItIs(page, "[data-replay-stop]", "the film's ✕")
    await expect(page.locator("[data-replay-bar]")).toHaveCount(0)
    const stopped = await homeGeo(page)
    expect({ film: stopped.film, list: stopped.list!.top - h.list!.top, scroll: stopped.scroll! - h.scroll!, rows: stopped.rows.map((y, i) => y - h.rows[i]).filter((d) => d !== 0).length }, "the film's stop moved no row of the home view")
      .toEqual({ film: false, list: 0, scroll: 0, rows: 0 })
    // ENDED BY ITSELF, the home view reached by the way home this time
    await tapOn(page, '[data-view="history"]', "Last rolls")
    await expect(page.locator("[data-past-roll]").first()).toBeVisible()
    await tapOn(page, `[data-replay-roll="${past.ts}"]`, "the past roll's replay control, again")
    await j.advance(300)
    await tapOn(page, ".ng-drawer-brand", "‹ Last rolls: the way home")
    await page.waitForTimeout(200)
    const home = await homeGeo(page)
    expect({ view: home.view, film: home.film }, "premise: home again, the film on").toEqual({ view: "explore", film: true })
    const door = await reach(page, '[data-view="history"]', home.list!)
    expect(door[0], "by the way home too, the door is whole and reached").toMatchObject({ whole: true, hit: true, underBar: false })
    let over = false
    for (let i = 0; i < 80 && !over; i++) { await j.advance(250); over = !(await page.evaluate(() => !!(window as any).__neural._replay)) }
    expect(over, "premise: the film ended by itself").toBe(true)
    await page.waitForTimeout(150)
    const end = await homeGeo(page)
    expect({ list: end.list!.top - home.list!.top, scroll: end.scroll! - home.scroll!, rows: end.rows.map((y, i) => y - home.rows[i]).filter((d) => d !== 0).length }, "the film's own end moved no row of the home view")
      .toEqual({ list: 0, scroll: 0, rows: 0 })
  })
})

test("on a desktop the film's bar stays on the map, beside the drawer, and the list does not move", async ({ page }) => {
  const j = journey(page)
  const past = await archivedRoll(j, page)
  await page.evaluate(() => (window as any).__neural.setPaused(false))
  await j.clickByMouse(".ng-logo", "the logo")
  await j.clickByMouse('[data-view="history"]', "Last rolls")
  await expect(page.locator("[data-past-roll]").first()).toBeVisible()
  await j.advance(1500) // the drawer's opening settles the map beside it
  const g0 = await barGeo(page)
  await j.clickByMouse(`[data-replay-roll="${past.ts}"]`, "the past roll's replay control")
  await j.advance(300)
  await page.waitForTimeout(120)
  const g = await barGeo(page)
  expect(g.film, "the film is running").toBe(true)
  expect({ parent: g.parent, inDrawer: g.inDrawer, position: g.position }, "on a desktop the bar stays on the map, beside the drawer").toEqual({ parent: "the app root", inDrawer: false, position: "fixed" })
  expect(g.bar!.left, "clear of the drawer").toBeGreaterThanOrEqual(g.drawer!.right)
  expect([g.list!.top - g0.list!.top, g.pastHead!.top - g0.pastHead!.top], "and the list did not move: 0 px").toEqual([0, 0])
  console.log("F1DESK " + JSON.stringify({ bar: [g.bar!.left, g.bar!.top, g.bar!.right, g.bar!.bottom].map((n) => Math.round(n * 10) / 10), drawerRight: g.drawer!.right, listTop: g.list!.top }))
  await j.clickByMouse("[data-replay-stop]", "the film's ✕, on the map")
  await expect(page.locator("[data-replay-bar]")).toHaveCount(0)
})

test("a film's bar changes seat when the window crosses a phone's width, and comes back", async ({ page }) => {
  const j = journey(page)
  const past = await archivedRoll(j, page)
  await page.evaluate(() => (window as any).__neural.setPaused(false))
  await j.clickByMouse(".ng-logo", "the logo")
  await j.clickByMouse('[data-view="history"]', "Last rolls")
  await j.clickByMouse(`[data-replay-roll="${past.ts}"]`, "the past roll's replay control")
  await j.advance(300)
  expect((await barGeo(page)).parent, "premise: at 1440 the bar is on the map").toBe("the app root")
  await page.setViewportSize({ width: 600, height: 800 })
  await expect.poll(() => page.evaluate(() => (window as any).__neural.isMobile()), { message: "premise: the app has seen the window narrow" }).toBe(true)
  const narrow = await barGeo(page)
  expect({ film: narrow.film, parent: narrow.parent, inDrawer: narrow.inDrawer, atFoot: narrow.atFoot }, "narrowed to a phone's width, the bar is a row of the drawer").toEqual({ film: true, parent: "the drawer", inDrawer: true, atFoot: true })
  await page.setViewportSize({ width: 1440, height: 900 })
  await expect.poll(() => page.evaluate(() => (window as any).__neural.isMobile()), { message: "premise: the app has seen the window widen" }).toBe(false)
  const wide = await barGeo(page)
  expect({ film: wide.film, parent: wide.parent, inDrawer: wide.inDrawer, position: wide.position }, "widened again, it is back on the map").toEqual({ film: true, parent: "the app root", inDrawer: false, position: "fixed" })
})

/**
 * ON A PHONE THE FILM'S BAR IS WHOLE ON THE SCREEN WHEREVER IT STANDS (FOLLOW2, v1.293.2)
 *
 * On the map the bar followed the landing card's column, and a deck card's column stands left of the middle of a phone
 * (it keeps 52 px at its right for its paging control): the bar, wider than the card, stood at -26 to 344 of 390, its dot
 * and border off the screen. Measured on dev v1.293.0 and on v1.293.1 at 390x631 and 390x844 in every board state that
 * has a landing card; whole only with the card dismissed. One clamp at the dock it rides (`_layoutLandHorizontal`,
 * app.src.jsx): chrome follows the column and is never off the screen.
 *
 * THE PLACES, from the survey (what decides where the bar stands: is there a landing card, is the hand shown, which
 * hand): a deck card on a live roll · a staged board (a technique's card) · the hand put away (the bar then docks at the
 * foot) · the card dismissed (no column to follow) · a roll from the bottom (the escapes' hand). Each at the film's first
 * step and at its last ("· end": the label is the only thing a step changes, and the bar's width is the stylesheet's).
 *
 * WHAT LIES UNDER THE BAR, named: only the film's own put-away hand (`_suppressTray`: the row at a tenth of its strength
 * while a film runs, "a hand you are not playing"). At 631 high that is the top 16 px of the hand's "Moves shown" switch;
 * at 844 a band across the hand's cards; with the hand put away, nothing. What a player needs while a film runs is
 * asserted clear of it and reached by a touch: the bar's own ✕, and the logo that opens the drawer. (The map itself is
 * the third: any press on it ends the film, by the film's own rule.)
 *
 * §6.1's traps, as checked: the ✕ pressed by a real touch, `elementFromPoint` at its middle and four edges, in every
 * place; nothing hidden by opacity (and what IS dim under the bar is named above, not assumed dead); the bar's place is
 * the dock's, off the measured width of the element itself, no constant per case; no z-index and no inline style
 * touched; the rendered box asserted (whole, 44 px).
 *
 * Mutants (each alone, in the served bundle, a clean control first):
 *   G1 the clamp out (`chromeAt` rides the column as before) → every place with a landing card at "the bar is whole on the
 *      screen"; "the card dismissed" stays green, as it should (there is no column to follow)
 *   G2 the clamp with no air at the edge (the element's half width alone) → the same places at "with the same air on
 *      both sides"
 * NOT COVERED: a real catch (a submission's escape tray: not produced here; it is a landing card like the others to
 * this dock); a phone in landscape (not `isMobile`; the two-column branch already fits chrome by its own width).
 */
const PLACES: Record<string, (j: any, page: Page) => Promise<void>> = {
  "a deck card on a live roll": async (j, page) => {
    await page.evaluate(() => { const a: App = (window as any).__neural; a.rollFromPosition(a.nodeForKey("Mount|Top"), false, "top") })
    await j.advance(2500)
  },
  "a staged board (a technique's card)": async () => { /* the fixture's own: `archivedRoll` leaves one */ },
  "the hand put away": async (j, page) => {
    await page.evaluate(() => { const a: App = (window as any).__neural; a.rollFromPosition(a.nodeForKey("Mount|Top"), false, "top") })
    await j.advance(2500)
    await page.evaluate(() => (window as any).__neural.setLayer("hand", false, "settings")) // the layer's one writer (its ✕ and the Settings switch both call it)
    await j.advance(300)
  },
  "the card dismissed": async (j, page) => {
    await page.evaluate(() => { const a: App = (window as any).__neural; a.rollFromPosition(a.nodeForKey("Mount|Top"), false, "top") })
    await j.advance(2500)
    await page.evaluate(() => (window as any).__neural._tapBackground()) // what a tap on the empty map does
    await j.advance(600)
  },
  "a roll from the bottom (the escapes' hand)": async (j, page) => {
    await page.evaluate(() => { const a: App = (window as any).__neural; a.rollFromPosition(a.nodeForKey("Mount|Top"), false, "bottom") })
    await j.advance(2500)
  },
}
/** what lies under the bar that a press could reach if the bar were not there, and whose it is */
const underBar = (page: Page) =>
  page.evaluate(() => {
    const a: App = (window as any).__neural, bar = document.querySelector("[data-replay-bar]") as HTMLElement, b = bar.getBoundingClientRect(), hand = a.optionsRef.current as HTMLElement | null
    const strength = (e: Element) => { let o = 1; for (let n: HTMLElement | null = e as HTMLElement; n; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.visibility === "hidden" || cs.display === "none") return 0; o *= Number(cs.opacity) } return o }
    const out: Array<{ what: string; hand: boolean; strength: number }> = []
    for (const e of document.querySelectorAll("button, a[href], [role='button'], summary, input, select, [data-seat-star]")) {
      if (bar.contains(e)) continue
      const r = e.getBoundingClientRect()
      if (r.width < 1 || r.height < 1 || r.right <= b.left || r.left >= b.right || r.bottom <= b.top || r.top >= b.bottom) continue
      if (r.right <= 0 || r.left >= innerWidth || r.bottom <= 0 || r.top >= innerHeight) continue
      const s = strength(e)
      if (s <= 0 || getComputedStyle(e).pointerEvents === "none") continue
      out.push({ what: (e.getAttribute("aria-label") || e.textContent || String(e.className)).trim().slice(0, 30), hand: !!hand && hand.contains(e), strength: Math.round(s * 100) / 100 })
    }
    return { controls: out, handPutAwayByTheFilm: !!a._traySup }
  })

for (const [vw, vh] of [[390, 631], [390, 844]] as const) {
  test.describe(`on a phone the film's bar on the map, ${vw}x${vh} by touch`, () => {
    test.use({ viewport: { width: vw, height: vh }, hasTouch: true, isMobile: true })
    for (const [place, make] of Object.entries(PLACES)) {
      test(`the film's bar is whole on the screen over ${place} (${vh})`, async ({ page }) => {
        const j = journey(page)
        const past = await archivedRoll(j, page)
        await make(j, page)
        await dismissRewards(page)
        await tapOn(page, ".ng-logo", "the logo")
        await tapOn(page, '[data-view="history"]', "Last rolls")
        await tapOn(page, `[data-replay-roll="${past.ts}"]`, "the past roll's replay control")
        await j.advance(300)
        await tapOn(page, ".ng-explorer-close", "shut the drawer: how a phone watches the film")
        await j.advance(1500)
        await page.waitForTimeout(150) // the bar's dock runs on the next frame
        const screen: Rect = { left: 0, top: 0, right: vw, bottom: vh, width: vw, height: vh }
        const check = async (when: string) => {
          const g = await barGeo(page)
          expect({ film: g.film, parent: g.parent, position: g.position }, `premise (${when}): a film is running and its bar is on the map`).toEqual({ film: true, parent: "the app root", position: "fixed" })
          expect([g.bar!.left >= 0, g.bar!.right <= vw, g.bar!.top >= 0, g.bar!.bottom <= vh], `${when}: the bar is whole on the screen (it stands at ${Math.round(g.bar!.left)} to ${Math.round(g.bar!.right)} of ${vw})`).toEqual([true, true, true, true])
          expect(Math.abs(g.bar!.left - (vw - g.bar!.right)), `${when}: with the same air on both sides`).toBeLessThanOrEqual(1)
          const stop = await reach(page, "[data-replay-stop]", screen)
          expect(stop[0], `${when}: its ✕ is whole on the screen and reached by a touch at its middle and four edges`).toMatchObject({ whole: true, hit: true })
          expect(Math.min(stop[0].w, stop[0].h), `${when}: and at least 44 px`).toBeGreaterThanOrEqual(44)
          const label = await page.evaluate(() => { const l = document.querySelector("[data-replay-label]") as HTMLElement, r = l.getBoundingClientRect(); return { text: (l.textContent || "").trim(), left: r.left, right: r.right } })
          expect([label.text.length > 3, label.left >= 0, label.right <= vw], `${when}: its words are on the screen`).toEqual([true, true, true])
          // what lies under it: only the film's own put-away hand; what a player needs while a film runs is clear of it
          const u = await underBar(page)
          expect(u.controls.filter((c) => !c.hand).map((c) => c.what), `${when}: it covers no control but the hand the film itself put away`).toEqual([])
          if (u.controls.length) expect([u.handPutAwayByTheFilm, Math.max(...u.controls.map((c) => c.strength)) <= 0.15], `${when}: and that hand is put away while the film runs (a tenth of its strength)`).toEqual([true, true])
          const logo = await reach(page, ".ng-logo", screen)
          expect(logo[0], `${when}: the logo that opens the drawer is clear of the bar and reached`).toMatchObject({ whole: true, hit: true, underBar: false })
          return u.controls.length
        }
        const first = await check("the film's first step")
        let ended = false
        for (let i = 0; i < 80 && !ended; i++) { await j.advance(250); ended = await page.evaluate(() => { const R = (window as any).__neural._replay; return !!R && !!R.done }) }
        expect(ended, "premise: the film reached its last step").toBe(true)
        await page.waitForTimeout(150)
        expect(await page.evaluate(() => (document.querySelector("[data-replay-label]") as HTMLElement).textContent), "premise: the bar says so").toMatch(/· end$/)
        const last = await check("the film's last step")
        console.log(`F2UNDER ${vh} | ${place} | controls of the put-away hand under the bar: first ${first}, last ${last}`)
      })
    }
    test(`the bar's ✕ on the map stops the film by a touch (${vh})`, async ({ page }) => {
      const j = journey(page)
      const past = await archivedRoll(j, page)
      await PLACES["a deck card on a live roll"](j, page)
      await dismissRewards(page)
      await tapOn(page, ".ng-logo", "the logo")
      await tapOn(page, '[data-view="history"]', "Last rolls")
      await tapOn(page, `[data-replay-roll="${past.ts}"]`, "the past roll's replay control")
      await j.advance(300)
      await tapOn(page, ".ng-explorer-close", "shut the drawer")
      await j.advance(1500)
      await page.waitForTimeout(150)
      expect((await barGeo(page)).film, "premise: the film is running, on the map").toBe(true)
      await tapOn(page, "[data-replay-stop]", "the film's ✕, on the map")
      await expect(page.locator("[data-replay-bar]"), "the ✕ stops the film and its bar goes").toHaveCount(0)
      expect(await page.evaluate(() => !!(window as any).__neural._replay)).toBe(false)
    })
  })
}

test("on a desktop the film's bar stands in the middle of the map beside the drawer, and in the middle of the screen with it shut", async ({ page }) => {
  const j = journey(page)
  const past = await archivedRoll(j, page)
  await PLACES["a deck card on a live roll"](j, page)
  await dismissRewards(page)
  await j.clickByMouse(".ng-logo", "the logo")
  await j.clickByMouse('[data-view="history"]', "Last rolls")
  await j.advance(1500)
  await j.clickByMouse(`[data-replay-roll="${past.ts}"]`, "the past roll's replay control")
  await j.advance(300)
  await page.waitForTimeout(150)
  const open = await barGeo(page), free = await page.evaluate(() => (window as any).__neural._paneLayout().center as number)
  expect(open.film).toBe(true)
  expect(Math.abs((open.bar!.left + open.bar!.right) / 2 - free), "beside the open drawer the bar is in the middle of the map that shows").toBeLessThanOrEqual(1)
  await j.clickByMouse(".ng-explorer-close", "shut the drawer")
  await j.advance(2500)
  await page.waitForTimeout(150)
  const shut = await barGeo(page)
  expect(shut.film, "premise: the film goes on with the drawer shut").toBe(true)
  expect(Math.abs((shut.bar!.left + shut.bar!.right) / 2 - shut.vw / 2), "with the drawer shut it is in the middle of the screen").toBeLessThanOrEqual(1)
  const r1 = (g: typeof open) => [g.bar!.left, g.bar!.top, g.bar!.right, g.bar!.bottom].map((n) => Math.round(n * 10) / 10)
  console.log("F2DESK " + JSON.stringify({ drawerOpen: r1(open), drawerShut: r1(shut) }))
})
