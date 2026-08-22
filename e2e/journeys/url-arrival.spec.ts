import { test, expect, type Page } from "@playwright/test"
import { journey } from "../dsl"

type Any = any

/**
 * ARRIVING ON A NODE'S PAGE SETS THE BOARD; IT DOES NOT START A ROLL (v1.114.2).
 *
 * Owner, on `/Positions/Side-Control/Bottom?dual=iso`: "it seems like immediately after I go into
 * this ... it restarts the roll. It says 'Restarting the roll', so it leaves no time for me to stay
 * in this position. In fact, we should stay at this position. The graph should navigate to it,
 * meaning visually we should be zoomed in at this position so that its node shows up above the
 * ng-landcard, and it should start paused. If I just enter this address in my browser I don't want
 * it to start the roll from there ... only start a new roll in roll history if the player clicks
 * the play button explicitly."
 *
 * THREE DEFECTS, and production was worse than the prototype:
 *
 *  1. `/Positions/Side-Control/Bottom` resolved to **NOTHING** on the production layout. The
 *     visual layer collapses Top/Bottom into one hub (`Positions/Side-Control`) and only `?dual`
 *     emits role members — so all 272 role pages, which are REAL built pages, seeded nothing and
 *     the visitor got a random weighted start on the wrong side.
 *  2. `updateCamera` called `startRoll()` unconditionally when the intro finished, 3.2s after the
 *     seed ran at ingest — drawing a fresh position and printing "Restarting the roll".
 *     `_urlSeeded` was assigned at boot and **never read by anything**.
 *  3. The framing was computed before the landing card existed. `rollCamTarget` measures the free
 *     band between the announce block and the card; on a fresh landing the card is built 0.6s
 *     later. A running roll self-corrects (the follow-cam re-aims every frame) but a STAGED one
 *     never does, because the auto-retarget is suppressed while paused. Measured on this very
 *     URL: node bottom 371 against a card top of 366 — the node sat 5px INSIDE the card.
 *
 * Rails: __neural._urlSeeded, ._urlSeedIdx, ._urlSeedRole, ._played, ._pastRolls, .paused
 */

const arrival = (page: Page) =>
  page.evaluate(() => {
    const a = (window as Any).__neural
    const n = a.nodes[a.currentPos]
    const scale = a.W / a.cam.vw
    const nodeK = Math.max(0.4, Math.min(1, a.cam.vw / (a.graphW * 0.5)))
    const card = document.querySelector("[data-landcard]") as HTMLElement | null
    const cr = card ? card.getBoundingClientRect() : null
    const sy = (n.y - a.cam.cy) * scale + a.H / 2
    return {
      pos: n.t as string,
      role: a.roleLabel() as string,
      paused: !!a.paused,
      zoomFrac: a.cam.vw / a.graphW,
      nodeBottom: sy + n.r * nodeK * scale,
      cardTop: cr ? cr.top : null,
      opts: (a.optionIdxs || []).length,
      played: !!a._played,
      pastRolls: (a._pastRolls || []).length,
      seeded: !!a._urlSeeded,
    }
  })

test("@curated a role page sets the board on THAT side, paused, and starts no roll", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/Positions/Side-Control/Bottom")
  await j.advance(6000) // well past the 3.2s intro, where startRoll() used to fire

  const a = await arrival(page)
  expect(a.seeded, "the URL named a node and the app took it").toBe(true)
  expect(a.pos, "and it is standing in Side Control").toContain("Side Control")
  // THE SIDE THE URL ASKED FOR. Production has no role node to land on — the fix resolves the hub
  // and carries `/Bottom` as the role — so this is the assertion that fails if that lookup rots.
  expect(a.role.toLowerCase(), "on the side the address named").toBe("bottom")
  expect(a.paused, "with the clock held").toBe(true)
  expect(a.opts, "and a hand dealt to look at").toBeGreaterThan(2)

  // NOTHING WAS PLAYED, so nothing may reach roll history.
  expect(a.played, "the roll has not begun").toBe(false)
  expect(a.pastRolls, "and nothing has been archived").toBe(0)

  // ...and the app never announced a restart, which is what the owner actually saw.
  const said = await page.evaluate(() =>
    ((document.querySelector("[data-center]") as HTMLElement | null)?.textContent || "").trim(),
  )
  expect(said, "no 'Restarting the roll' on an address-bar arrival").not.toContain("Restarting")
})

test("the node it navigates to is framed clear of the landing card", async ({ page }) => {
  const j = journey(page)
  await j.boot("/Positions/Side-Control/Bottom")
  await j.advance(6000)
  // LET THE CARD SETTLE, AND READ BETWEEN THE PUMPS. The landing card animates in: measured, its
  // top was still at 588 on the frame the camera last aimed against and reached 376 on the next,
  // so a camera read taken mid-settle describes nothing. A second `advance` alone is NOT enough —
  // the intervening `arrival()` is what forces layout and lets a frame actually render between
  // pumps (with two bare advances the reading stayed at the mid-settle value).
  for (let i = 0; i < 3; i++) {
    await arrival(page)
    await j.advance(400)
  }

  const a = await arrival(page)
  expect(a.zoomFrac, "zoomed in to reading distance, not the overview").toBeLessThan(0.1)
  expect(a.cardTop, "there is a landing card to clear").not.toBeNull()
  expect(
    a.cardTop! - a.nodeBottom,
    `the whole node sits above the card (node bottom ${Math.round(a.nodeBottom)}, card top ${Math.round(a.cardTop!)})`,
  ).toBeGreaterThan(0)

  // ...AND THE MECHANISM, because the clearance above cannot carry this test on its own. The DSL
  // serves `{}` for dossier chunks, so under test the card has no film strip and a one-line
  // question — it is SHORT, its top sits low, and the node clears it even with the pre-card
  // framing left in place (measured: this assertion passes against a build with the re-aim
  // disabled). On the real site the same URL put the node 5px INSIDE the card. So assert the
  // invariant that actually failed: the camera is aimed at the band the card really leaves.
  const aim = await page.evaluate(() => {
    const app = (window as Any).__neural
    const f = app.nodes[app.focusIdx]
    // `pairMid`, NOT `{x,y}` — the app aims at `camFocus`, which since v1.114.3 is the pair's
    // DRAWN midpoint, and since v1.125.0 every state is a pair. Re-deriving the aim from the
    // stored coordinates measures a point the renderer never draws at (it is off by the
    // edge-anchored lift), which is the n.y-vs-LY(n) defect this repo keeps rediscovering.
    // `pairMid` returns the node's own drawn point when it has no partner, so this is exact on
    // the legacy graph too.
    const want = app.rollCamTarget(app.pairMid(f), false) // recomputed WITH the card present
    return { cy: app.camTarget.cy, wantCy: want.cy, vw: app.camTarget.vw, wantVw: want.vw }
  })
  expect(
    Math.abs(aim.cy - aim.wantCy),
    `the staged camera was re-aimed once the card existed (cy ${aim.cy.toFixed(1)} vs ${aim.wantCy.toFixed(1)})`,
  ).toBeLessThan(2)
  expect(Math.abs(aim.vw - aim.wantVw), "at the same zoom").toBeLessThan(2)
})

test("pressing play is what starts the roll, and only then does it reach history", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/Positions/Side-Control/Bottom")
  await j.advance(6000)
  expect((await arrival(page)).played, "staged, not played").toBe(false)

  // ABANDON THE STAGED BOARD FIRST: starting a fresh roll over a board that never played must
  // archive nothing. This is the half the owner asked for — "don't start a new roll in roll
  // history" — and `_played` is the gate that delivers it.
  await page.evaluate(() => (window as Any).__neural.startRoll())
  await j.advance(800)
  expect(
    (await arrival(page)).pastRolls,
    "a board that was only ever staged is not a roll and is not archived",
  ).toBe(0)

  // NOW THE OTHER HALF: arriving again and pressing play ARMS the gate. That `_played` latch is
  // the whole mechanism — what an archived roll looks like downstream is already pinned by the
  // Last-rolls journeys, so this stops at the seam this change owns.
  await j.boot("/Positions/Side-Control/Bottom")
  await j.advance(6000)
  expect((await arrival(page)).played, "staged again, still not played").toBe(false)
  await page.evaluate(() => (window as Any).__neural.setPaused(false)) // the transport's play
  await j.advance(900)
  const live = await arrival(page)
  expect(live.paused, "the clock is running").toBe(false)
  expect(live.played, "and the roll now counts — it is archivable from here").toBe(true)
})

test("the front door is untouched — / still deals its own first impression", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.advance(6000)
  const a = await arrival(page)
  expect(a.seeded, "no node was named, so nothing was seeded").toBe(false)
  expect(a.paused, "and the roll is running, as it always has been").toBe(false)
  expect(a.played, "the first-impression draw owns the front door").toBe(true)
})

test("a technique page seeds at its ORIGIN position, not inside the technique", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/Transitions/Side-Control-to-Mount")
  await j.advance(6000)
  const a = await arrival(page)
  expect(a.seeded, "the transition page named a node").toBe(true)
  // `currentPos` must be a POSITION or there is no hand to deal — the rule confirmPlayFrom uses.
  const ty = await page.evaluate(
    () => (window as Any).__neural.nodes[(window as Any).__neural.currentPos].ty,
  )
  expect(ty, "and it resolved to a position").toBe("positions")
  expect(a.pos, "the origin of that transition").toContain("Side Control")
  expect(a.paused, "still staged, still paused").toBe(true)
})

/**
 * THE FRAMING SURVIVES THE LANDING CARD'S TEARDOWN (v1.114.4).
 *
 * Owner, roaming between two halves of a dual pair: "instead of the camera moving just a little,
 * it moves a lot, even hiding the current node behind the landcard dialog momentarily" — and then,
 * exactly: "it seems to want to center the node to the center of the screen initially instead of
 * centering to the available visible space (above the landcard)."
 *
 * That is production behaviour, not a prototype quirk: staging ANY state calls `clearOptions()`,
 * which drops the landing card and the film strip, and `rollFromPosition` writes `camTarget`
 * inside that window. With nothing to measure, `rollCamTarget`'s band bottom fell back to
 * `H - 240` — the middle of the whole screen. Measured clicking a partner orb at 1440x900:
 * wantY went 136 -> 338 for two frames, and the frame taken there was the one that stuck.
 */
test("the camera frames the space the card WILL occupy, not the gap while it rebuilds", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/Positions/Side-Control/Bottom")
  await j.advance(6000)
  for (let i = 0; i < 3; i++) {
    await arrival(page)
    await j.advance(400)
  }

  const m = await page.evaluate(() => {
    const a = (window as Any).__neural
    const f = a.nodes[a.focusIdx]
    const at = () => a.rollCamTarget({ x: f.x, y: a._LY(f) }, false)
    const withCard = at()
    // the exact state `clearOptions()` leaves behind for ~600ms while `enterLand` rebuilds
    const keepCard = a._landEl
    const keepFilm = a._landFilmEl
    a._landEl = null
    a._landFilmEl = null
    const torn = at()
    a._landEl = keepCard
    a._landFilmEl = keepFilm
    return { withCard: withCard.cy, torn: torn.cy, H: a.H, hadCard: !!keepCard }
  })

  expect(m.hadCard, "there was a landing card to tear down").toBe(true)
  expect(
    Math.abs(m.torn - m.withCard),
    `the frame is the same with the card gone (${m.torn.toFixed(2)} vs ${m.withCard.toFixed(2)})`,
  ).toBeLessThan(0.01)
})

/**
 * THE FIRST FLIGHT AIMS AT THE CARD'S BAND, NOT THE MIDDLE OF THE SCREEN (v1.129.6). @curated
 *
 * Owner: "correct the position of the graph shift since it initially centers to the screen, not the
 * available space above the landcard as it's should in the first animation."
 *
 * On the FIRST landing there is nothing to measure — the card mounts about a second after the intro
 * hands the camera over, and `_bandBot` has no cached answer at this viewport yet — so
 * `rollCamTarget`'s cold fallback was the only input. `H - 240` is not a band, it is very nearly
 * the whole screen: measured at H=900 it put `wantY` at 338 and opened the focus at screen y **413**
 * against a screen middle of 450, then crawled to its real home at 196 over about five seconds.
 *
 * THE FIX IS NOT A NEW GUESS: `H * 0.42` is the constant the "no room" branch already uses, and it
 * predicts this viewport's settled band almost exactly — `wantY` 197 against a measured resting
 * 196.
 *
 * MEASURED A/B ON THE SAME START NODE, sampling `camTarget.cy` across the whole first flight:
 * aim drift **13.06 world units → 0.28**. The camera now makes ONE approach to a target that was
 * right from the first frame, instead of chasing one that moves under it.
 */
test("@curated the opening flight has a fixed aim, not one that drifts as the card mounts", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/")
  await j.advance(3300) // the intro hands the camera over at 3.2s

  const aims: number[] = []
  for (let i = 0; i < 14; i++) {
    await j.advance(400)
    const cy = await page.evaluate(() =>
      (window as any).__neural.camTarget ? (window as any).__neural.camTarget.cy : null,
    )
    if (cy != null) aims.push(cy)
  }
  expect(aims.length, "the flight was sampled").toBeGreaterThan(10)

  // THE CLAIM: the aim is settled from the first sample. Not "the camera is instantly there" —
  // it still flies, and should — but it flies to ONE place.
  const drift = Math.max(...aims) - Math.min(...aims)
  expect(
    drift,
    `the opening aim does not move under the flight (drift ${drift.toFixed(2)} world units across ${aims.length} samples)`,
  ).toBeLessThan(3)

  // ...AND IT LANDS IN THE BAND, not at the screen's middle. Measured against the card that by now
  // exists, which is the surface the band is carved out of.
  const end = await page.evaluate(() => {
    const a: any = (window as any).__neural
    const card = document.querySelector("[data-landcard]") as HTMLElement | null
    const scale = a.W / a.cam.vw
    const f = a.focusIdx >= 0 ? a.nodes[a.focusIdx] : null
    const mid = f ? a.pairMid(f) : null
    return {
      sy: mid ? (mid.y - a.cam.cy) * scale + a.H / 2 : null,
      cardTop: card ? card.getBoundingClientRect().top : null,
      H: a.H,
    }
  })
  expect(end.cardTop, "the landing card exists by now").not.toBeNull()
  expect(end.sy, "the state sits above the card").toBeLessThan(end.cardTop!)
  expect(
    end.sy!,
    `and well above the middle of the screen (y ${Math.round(end.sy!)} of ${end.H})`,
  ).toBeLessThan(end.H * 0.42)
})
