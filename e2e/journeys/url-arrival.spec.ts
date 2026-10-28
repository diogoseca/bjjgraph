// == HARNESS CONSTRAINT: NO TESTED CONFIGURATION REPRODUCES PRODUCTION (D-D-05, corrected D-D-06) ==
//
// This spec requests 1 route(s) emitted TWICE - as `X.html` AND `X/index.html` - and the two are
// DIFFERENT DOCUMENTS, not copies (different `data-slug`; the folder copy usually lacks
// `#page-graph-data`). Which one you get depends on the server, and NO server we have tested
// serves what production serves:
//
//   production                  /X -> FLAT     /X/ -> FOLDER    both 200, NEITHER redirects
//   `serve` (ALL TEN configs)   /X -> FOLDER   /X/ -> FOLDER    /X.html -> 301 to /X -> FOLDER
//   `dev-serve.mjs`, NORMALLY   /X -> FOLDER   /X/ -> FOLDER    IDENTICAL - see below
//   `dev-serve.mjs`, PAIRED     /X -> FLAT     /X/ -> FOLDER    <- this one MATCHES production
//
// DEV-SERVE DOES NOT MATCH PRODUCTION, AND READING ITS SOURCE SUGGESTS IT DOES. `resolveHtml`
// (`scripts/dev-serve.mjs:352-363`) really does try `X.html` first for a bare route - but it has
// exactly ONE call site, `:387`, inside the paired-session branch guarded by `pairedToken()`. The
// normal static path is `:415`, `serveHandler(req, res, {public: STATIC_ROOT, etag: true})` -
// serve-handler, the SAME library `serve` uses, with cleanUrls left at default on purpose
// (`:412-413`: "cleanUrls and directoryListing are already serve-handler defaults - don't
// override"). THREE PEOPLE READ THAT FUNCTION AND NONE CHECKED WHETHER IT RUNS. CLAUDE.md 6.8:
// verifying that code says the right thing is not verifying that it executes.
//
// AND IT IS NOT A STABLE PROPERTY OF A MODE - IT IS A LIVE FLIP ON A 2-SECOND POLL.
// `pairedToken()` (`:211-217`) caches for 2000 ms and re-reads `e2e/paired/.session/bridge-token`
// on expiry, so dev-serve's URL RESOLUTION CHANGES WITHIN TWO SECONDS of that file appearing or
// vanishing, on a running server, with no restart. Note the DIRECTION: paired ON -> resolveHtml ->
// bare serves the FLAT file -> MATCHES PRODUCTION. Paired OFF -> serve-handler -> bare serves the
// FOLDER copy. SO ATTACHING THE DEBUGGER MAKES THE SERVER MORE FAITHFUL, NOT LESS - a defect that
// exists only in the folder copy would VANISH the moment someone attached paired debugging to
// investigate it, and return when they detached. The discrepancy hides from the one tool that
// would find it.
//
// SO THE ASSERTIONS BELOW RUN AGAINST THE FOLDER COPY, a strictly degraded clone - 1,506 of 1,518
// folder copies carry no `#page-graph-data` and pair deltas reach 35,637 bytes. No exposed spec
// references `#page-graph-data` or `__rollPositions`, so the known-missing block is asserted
// nowhere; but the documents differ by 6-25 KB, so anything asserting layout, element counts or
// positions could move if the resolver changes.
//
// Affected route(s) here: /Transitions/Side-Control-to-Mount
//
// DO NOT "FIX" THIS BY ADDING A TRAILING SLASH OR A `.html` SUFFIX. Under the CURRENT config both
// still land on the folder copy. Under `cleanUrls:false` the `.html` form DOES reach the flat file
// (200, no redirect) - but bare `/X` and `/X/` then return a DIRECTORY LISTING (~19 KB, "Files
// within ..."), trading an unreachable document for a canonical URL that serves a file index. A
// faithful harness needs rewrite rules, a different server, or a tree without the duplicates.
// None of those is measured yet; quartz-cto is not naming a fix until one is.
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

const arrival = async (page: Page) => {
  // Content arrivals seat after the deferred reader loads. Pumping the game clock
  // does not settle HTTP; observe the actual board before measuring its camera.
  await page.waitForFunction(() => { const a = (window as Any).__neural; return !!a?.nodes[a.currentPos] })
  return page.evaluate(() => {
    const a = (window as Any).__neural
    const n = a.nodes[a.currentPos]
    const scale = a.W / a.cam.vw
    const nodeK = Math.max(0.4, Math.min(1, a.cam.vw / (a.graphW * 0.5)))
    const card = document.querySelector("[data-landcard]") as HTMLElement | null
    const cr = card ? card.getBoundingClientRect() : null
    // Use the frame's published pair lift: n.y is the stored ground point,
    // not the orb the visitor sees (CLAUDE.md §6.2).
    const sy = (a._LY(n) - a.cam.cy) * scale + a.H / 2
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
}

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

// STALE CONTRACT (D-318 U4a, CI 48be3a910): with the article shown, the arrival fits the pair into
// the reader's reserved node band (rollCamTarget widens to 0.107 of the graph here) and centres it
// above the first section, which article-sections.spec.ts asserts at eight widths. This framing
// claim is the MAP view's (Book off, persisted as a returning reader left it).
test("the node it navigates to is framed clear of the landing card", async ({ page }) => {
  const j = journey(page)
  await j.boot("/Positions/Side-Control/Bottom", { initialState: { v: 2, settings: { readerBook: false }, settingsAt: {} } })
  // boot() waits for graph ingest, not the deferred reader's seat or styled article.
  // Advancing first can spend all six seconds before the arrival flight even starts.
  await expect(page.locator('[data-reader-ready="true"]')).toBeVisible({ timeout: 15000 })
  await j.landSettled()
  await j.advance(6000)
  // CSS uses wall time while the camera uses the stopped simulation clock. Poll
  // their own completion signals, pumping between samples. Do NOT wait for the
  // desired zoom/clearance: a settled but wrong framing must reach the assertions.
  await expect.poll(async () => {
    await j.advance(200)
    return page.evaluate(() => {
      const a = (window as Any).__neural, m = a._cm
      const card = document.querySelector("[data-landcard]")
      card?.getBoundingClientRect() // flush layout before observing its transitions
      const animating = card?.getAnimations({ subtree: true }).some(animation =>
        animation.playState !== "finished" && animation.playState !== "idle" &&
        animation.effect?.getComputedTiming().iterations !== Infinity)
      return {
        flightEnded: !!m && !m.flight,
        cameraAtRest: !!m && Math.hypot(m.v.x, m.v.y) * a.W / a.cam.vw < 0.1 &&
          Math.abs(m.v.l) < 0.0001 && Math.abs(m.lift.v) < 0.1,
        chromeAtRest: !!card && !animating && (!m?.edge || m.edge.t === 1),
      }
    })
  }, { timeout: 15000, intervals: [50], message: "the arrival flight and landing layout finish before framing is measured" })
    .toEqual({ flightEnded: true, cameraAtRest: true, chromeAtRest: true })

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

test("answering the landing card starts play, and only then can the roll reach history", async ({
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
  const q = await j.landQuestion()
  expect(q).not.toBeNull()
  await j.clickByMouse(`[data-land-mc-opt="${q!.correct}"]`, "answer the selected node’s landing card")
  await j.advance(900)
  const live = await arrival(page)
  expect(live.paused, "the clock is running").toBe(false)
  expect(live.played, "and the roll now counts — it is archivable from here").toBe(true)
})

test("the front door is untouched — / still deals its own first impression", async ({ page }) => {
  const j = journey(page)
  await j.boot("/")
  await j.advance(10200) // intro 3.2s + the staged arrival 6.2s (v1.168.0) + the deal
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
// REAL BREAK: a late Side Control deck moved the measured card band during the
// landing flight (exact e26: 10.9501 world units; exact dev 8aa: 10.9405). D-318's
// shared node reservation keeps the cold and adopted reader aims identical.
// Evidence: scratch/article-sections/ci-e26/{opening-named-deck-order-cpu1,
// base8aa-opening-verified,d318-cpu4-proof}. The original ungated case and its
// <3 bound remain; the second case pins the real delivery that exposes the bug.
for (const lateDeck of [false, true]) {
test(`@curated the opening flight aims once, at the landing, and the aim never drifts under it${lateDeck ? ' with the landing deck held' : ''}`, async ({
  page,
}) => {
  const j = journey(page)
  await j.boot("/", lateDeck ? { payloads: { "flashcards/e08ec988.json": { afterSim: 7 } } } : {})
  if (lateDeck) {
    await j.rig("role", [0])
    await page.evaluate(() => {
      const a = (window as any).__neural
      a.rigStart(a.nodes.findIndex((n: any) => n.t === "Side Control Top"))
    })
  }
  await j.advance(3300) // the intro hands the camera over at 3.2s

  // v1.168.0 CHANGED THE CLAIM, NOT THE BUG THIS SPEC PINS: the staged arrival aimed WIDE for its first
  // beat and re-aimed ONCE at the landing framing. v1.237.0 changed it again: the opening is the directed
  // arrival (`_openingPose`, owner U50 d), which aims ONCE, at the landing framing, from the pick, and flies
  // its own closed-form path there; there is no wide beat left to aim at (its centre-column and zoom
  // checks went with it; the arrival's own claims are pinned in opening-camera.spec.ts). What must still
  // never happen is the original defect: the aim moving UNDER the flight because the card mounted or the
  // band's cold prior gave way. So ONE window now spans the hold, the reveal (pick + 2.0s), the rise, the
  // card's mount and the landing — longer than either of the old two — pinned to zero drift.
  const sample = async (n: number) => {
    const out: number[] = []
    for (let i = 0; i < n; i++) {
      await j.advance(400)
      const cy = await page.evaluate(() =>
        (window as any).__neural.camTarget ? (window as any).__neural.camTarget.cy : null,
      )
      if (cy != null) out.push(cy)
    }
    return out
  }
  const aims = await sample(20) // 3.7s → 11.7s: the hold, the reveal, the rise, the landing AND the card's mount
  if (lateDeck) {
    const delivery = j.payloadTimeline().filter(e => e.pattern === "flashcards/e08ec988.json")
    expect(delivery.length, "the real landing deck was held").toBeGreaterThan(0)
    expect(delivery[0].releasedAtSim).toBeGreaterThanOrEqual(7000)
  }
  expect(aims.length, "the flight was sampled").toBeGreaterThan(15)
  const drift = Math.max(...aims) - Math.min(...aims)
  expect(
    drift,
    `the landing aim does not move under the flight — card mount included (drift ${drift.toFixed(2)} world units across ${aims.length} samples)`,
  ).toBeLessThan(3)
  await j.advance(1500) // let the tween settle before measuring where it landed

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
}
