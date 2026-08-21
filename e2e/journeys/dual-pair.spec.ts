import { test, expect, type Page } from "@playwright/test"
import { journey } from "../dsl"

type Any = any

/**
 * A DUAL PAIR IS ONE STATE WITH TWO HALVES — ON THE DEFAULT BUILD (v1.127.0).
 *
 * These three journeys were authored in v1.114.3/v1.114.4 against `?dual=iso`, a flag that named a
 * 2.47MB PRE-SPLIT prototype payload. That payload was gitignored (it would have blown the deferred
 * payload cap), so the specs lived in `e2e/prototype/` behind a private port, a private serve-root
 * and their own lock. **No gate has ever collected that directory** — `prototype` appears nowhere in
 * `.github/workflows/`, nowhere in `package.json`, and in no config's `testDir`; the two configs
 * that take one (`playwright.{private,chrome}.config.ts`) read `PW_TESTDIR` from a hand-typed
 * command. So they ran when somebody remembered. v1.125.0 made the split DERIVED at ingest and
 * v1.126.0 retired the flag, so their subject is now what every visitor gets on `/`, and they
 * belong here.
 *
 * WHAT THE MOVE COST THEM, precisely — the assertions had to be re-derived, not re-pointed:
 *  · The prototype emitted `<hub>/Top` and `<hub>/Bottom`. The derivation keeps the HUB ID on the
 *    rep (that is what lets `node_ordinals.json` stand still and every `/l/<code>` keep resolving),
 *    so the two halves of Side Control are `Positions/Side-Control` and `…/Bottom`. A `/\/Top$/`
 *    match would now fail on the very node it is describing.
 *  · There is no film strip under the harness — the DSL serves `{}` for dossier chunks — so "both
 *    halves sit above the videos" is measured against the LANDING CARD, which is the surface the
 *    film docks to and the one that is really there. Same claim, real oracle.
 *  · The `?dual=iso` boot is a plain `j.boot()` on the default path, with the rigged clock instead
 *    of a 10s wall-clock sleep.
 *
 * WHAT WAS LEFT BEHIND, and why, is recorded here so nobody goes looking for it: the three-variant
 * SCREENSHOT SHOOT (`dual pair shoot — <variant> strategy, 3 zooms`). It drove `?dual=fixed |
 * force | iso` to three PNGs per variant for the owner to choose between. The choice was made, two
 * of those three placements never existed outside a gitignored file, and all three URLs now boot
 * the same graph — so it is three copies of one test whose only output is a picture a gate cannot
 * fail on. Its sanity block is dead as well as redundant: measured on this build it asserts
 * `nodes === 2931` against 2934 and `pairMembers === 2928` against 2934 (every node is paired now),
 * and its `_idIndex.get("Positions/Mount") === mountTop` still passes only by accident — the hub-id
 * ALIAS pass it was written for was deleted in v1.126.0; the rep simply IS the hub. The invariant
 * it reached for is pinned harder by `dual-consumers.spec.ts`, which measures 1467 vs 2934 as a
 * DIFFERENTIAL against `?dual=legacy`. The committed evidence PNGs stay where they are;
 * `/dev/experiments` renders them.
 *
 * Rails: __neural._LY, .pairMid, ._hover, .camTarget, ._stagedCamFree, .focusIdx, .nodes[].pi
 */

/** The one URL all three journeys stand on: a role page seeds a STAGED board on that side. */
const AT = "/Positions/Side-Control/Bottom"

/**
 * LET THE CARD SETTLE, AND READ BETWEEN THE PUMPS — url-arrival's rule, and it is load-bearing
 * here too: every number below is a SCREEN position, and the landing card animates in. A second
 * bare `advance` does not do it; the intervening layout read is what lets a frame actually render.
 */
const settle = async (page: Page, j: ReturnType<typeof journey>) => {
  await j.advance(6000) // past the 3.2s intro
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => document.body.getBoundingClientRect().top)
    await j.advance(400)
  }
}

/**
 * WHERE THE TWO HALVES ACTUALLY ARE ON THE GLASS.
 *
 * Projected through the transform `draw()` uses — `scale = W/cam.vw`, `screen = centre + (world -
 * camCentre) * scale` — and through **`_LY`**, the ONE definition of the lift the frame just drew
 * with. `sy` is where the orb is; `syStored` is where its coordinate says it is. Those two differ
 * by the edge-anchored lift, and the whole of journey 2 is about which one the app hit-tests.
 */
const geometry = (page: Page) =>
  page.evaluate(() => {
    const a = (window as Any).__neural
    const f = a.nodes[a.focusIdx]
    const p = f.pi >= 0 ? a.nodes[f.pi] : null
    const scale = a.W / a.cam.vw
    const nodeK = Math.max(0.4, Math.min(1, a.cam.vw / (a.graphW * 0.5)))
    const P = (n: Any) => ({
      id: n.id as string,
      role: n.role as string,
      z: n.z as number,
      sx: (n.x - a.cam.cx) * scale + a.W / 2,
      sy: (a._LY(n) - a.cam.cy) * scale + a.H / 2,
      syStored: (n.y - a.cam.cy) * scale + a.H / 2,
      r: n.r * nodeK * scale,
    })
    const mid = a.pairMid(f)
    const card = document.querySelector("[data-landcard]") as HTMLElement | null
    return {
      focus: P(f),
      partner: p ? P(p) : null,
      midSy: (mid.y - a.cam.cy) * scale + a.H / 2,
      pickRadiusPx: 28, // `_updateHover`'s pick radius, expressed in screen px like everything here
      cardTop: card ? card.getBoundingClientRect().top : null,
    }
  })

/**
 * BRIGHT TEXT PIXELS IN THREE STACKED STRIPS TO THE RIGHT OF THE ORBS.
 *
 * The label group is `ctx.fillText` on the canvas — there is no DOM node to query — so this reads
 * the pixels the owner would be looking at. `name` straddles the midline (baseline `sy + 6`, 18px);
 * `above` and `below` are where the 11px subtitle lands (`sy - 12` / `sy + 24`). The strip starts
 * clear of the orbs, so a bright reading is text and nothing else.
 */
const strips = (page: Page, midY: number, x: number) =>
  page.evaluate(
    ({ midY, x }: Any) => {
      const a = (window as Any).__neural
      const cv: HTMLCanvasElement = a.canvas
      const ctx = cv.getContext("2d")!
      const dpr = cv.width / cv.clientWidth
      const band = (y0: number, y1: number) => {
        const d = ctx.getImageData(
          Math.round(x * dpr),
          Math.round(y0 * dpr),
          Math.round(190 * dpr),
          Math.round((y1 - y0) * dpr),
        ).data
        let n = 0
        for (let i = 0; i < d.length; i += 4) {
          if (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2] > 90) n++
        }
        return n
      }
      return {
        above: band(midY - 26, midY - 6),
        name: band(midY - 6, midY + 12),
        below: band(midY + 12, midY + 32),
      }
    },
    { midY, x },
  )

/**
 * ONE LABEL GROUP, ANCHORED TO THE PAIR (v1.114.3). @curated
 *
 * Owner: "above the videos we should see the two circles … the position should be rather centered
 * on the middle of the two icons, not the actual icon that's active, so that both icons appear …
 * the main label stays positioned in the middle on the right, and the active role appears above or
 * below it … it's not two labels, it's just one group of labels that's dynamic, in which the
 * subtitle's position seems to appear depending on where you are."
 *
 * So there are exactly two claims and they pull against each other: the NAME must not move, and the
 * SUBTITLE'S SIDE must be the whole signal. Measured before the fix, on this URL: the camera aimed
 * at a member's STORED `y` and at the MEMBER rather than the pair, which put the Top orb at screen
 * y=5 — off the top edge — while the band the roll frames into was 76..268.
 */
test("@curated the pair reads as one state: both halves framed, the name on the midline", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot(AT)
  await settle(page, j)

  const g = await geometry(page)
  expect(g.partner, "the state the URL named is a pair").not.toBeNull()
  // The DERIVED pair keeps the hub id on the rep — that is what leaves `node_ordinals.json`
  // untouched — so the halves are `<hub>` and `<hub>/Bottom`, never `<hub>/Top`.
  expect(g.focus.id, "the URL asked for the bottom half and got it").toBe(
    "Positions/Side-Control/Bottom",
  )
  expect(g.partner!.id, "…and its partner is the hub itself").toBe("Positions/Side-Control")
  expect(g.focus.z, "the bottom half hangs below the shared ground point").toBeLessThan(0)
  expect(g.partner!.z, "the top half above it").toBeGreaterThan(0)

  const upper = g.partner!.sy < g.focus.sy ? g.partner! : g.focus
  const lower = g.partner!.sy < g.focus.sy ? g.focus : g.partner!
  expect(upper.role, "the TOP role is the one drawn on top").toBe("top")

  // BOTH ICONS, ABOVE THE READING SURFACE. There is no film strip under the harness (the DSL
  // serves `{}` for dossier chunks), so the card — which is what the strip docks off — is the
  // honest oracle for "above the videos".
  expect(upper.sy - upper.r, "the upper orb is fully on screen").toBeGreaterThan(0)
  expect(g.cardTop, "there is a landing card to clear").not.toBeNull()
  expect(
    g.cardTop! - (lower.sy + lower.r),
    `both halves clear the card (lower orb ends ${Math.round(lower.sy + lower.r)}, card top ${Math.round(g.cardTop!)})`,
  ).toBeGreaterThan(0)

  // ...AND THE PAIR, NOT THE ACTIVE HALF, IS WHAT GOT CENTRED.
  expect(g.midSy).toBeGreaterThan(upper.sy)
  expect(g.midSy).toBeLessThan(lower.sy)

  // THE NAME SITS ON THE MIDLINE AND THE SUBTITLE SITS BELOW IT, because the focus is the lower
  // half. `x` clears the widest orb, so anything bright in these strips is text.
  const x = g.focus.sx + Math.max(g.focus.r, g.partner!.r) + 14
  const rest = await strips(page, g.midSy, x)
  expect(rest.name, `the name is drawn on the pair's midline (${JSON.stringify(rest)})`).toBeGreaterThan(300)
  expect(rest.below, "the subtitle is below the name for the bottom half").toBeGreaterThan(40)
  expect(rest.above, "and nothing is above it").toBeLessThan(rest.below / 2)

  // HOVERING THE OTHER HALF MOVES THE SUBTITLE — AND ONLY THE SUBTITLE. This is the half of the
  // owner's ask that a static frame cannot show: one group, dynamic, name fixed.
  await page.mouse.move(g.partner!.sx - 60, g.partner!.sy - 60)
  await page.mouse.move(g.partner!.sx, g.partner!.sy)
  await j.advance(120) // inside `_hover`'s 0.5s freshness window
  const hovered = await strips(page, g.midSy, x)
  expect(
    hovered.name,
    `the name did not move (${rest.name} -> ${hovered.name} bright px on the same midline)`,
  ).toBeGreaterThan(300)
  expect(hovered.above, "the subtitle moved above for the top half").toBeGreaterThan(40)
  expect(hovered.below, "and left the space below it").toBeLessThan(hovered.above / 2)
})

/**
 * THE ORB YOU CLICK IS THE ORB YOU SEE (v1.114.3). @curated
 *
 * `LY` lifts each member off the shared ground point, so `n.y` is NOT where the circle is drawn.
 * `_updateHover` compared against `n.y` against a 28px pick radius — and the TAP handler runs
 * through that same function, so clicking a visible orb matched NOTHING and fell through to
 * `_tapBackground()`. The graph is this app's centrepiece and half of it was dead to the mouse.
 *
 * This is the `n.y`-where-the-renderer-draws-at-`LY(n)` defect, which this repo has now found four
 * times (here, `graph-naming`'s `parkOn` and `profile`, `url-arrival`'s aim). The assertion that
 * makes it non-vacuous is the FIRST one: if the lift ever collapsed to nothing the drawn and stored
 * points would coincide, every claim below would pass on a build with the bug restored, and this
 * journey would be decoration.
 */
test("@curated the hit-test reads where the orb is drawn, not where it is stored", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot(AT)
  await settle(page, j)

  const g = await geometry(page)
  const other = g.partner!
  const gap = Math.abs(other.sy - other.syStored)
  expect(
    gap,
    `the lift is bigger than the pick radius, so the two answers cannot coincide (${gap.toFixed(1)}px vs ${g.pickRadiusPx}px)`,
  ).toBeGreaterThan(g.pickRadiusPx)

  const hoverId = async () => {
    await j.advance(120)
    return page.evaluate(() => {
      const a = (window as Any).__neural
      return a._hover && a._hover.idx >= 0 ? (a.nodes[a._hover.idx].id as string) : null
    })
  }

  // where the orb IS
  await page.mouse.move(other.sx - 60, other.sy - 60)
  await page.mouse.move(other.sx, other.sy)
  expect(await hoverId(), "the orb under the cursor is the one the app picked").toBe(other.id)

  // where its coordinate SAYS it is — nothing is drawn there, so nothing may be picked there
  await page.mouse.move(other.sx - 60, other.syStored - 60)
  await page.mouse.move(other.sx, other.syStored)
  expect(await hoverId(), "and the stored point picks nothing, because nothing is drawn there").toBeNull()

  // ...AND THE TAP AGREES WITH THE HOVER, which is the consequence that actually hurt: the same
  // function decides both, so a stale hit-test does not merely fail to highlight — it drops the
  // click on the floor and `_tapBackground()` runs instead.
  await page.mouse.move(other.sx, other.sy)
  await page.mouse.down()
  await page.mouse.up()
  await j.advance(600)
  const picked = await page.evaluate(
    () => (window as Any).__neural.nodes[(window as Any).__neural.focusIdx].id as string,
  )
  expect(picked, "tapping the visible orb selected THAT half").toBe(other.id)
})

/**
 * SWAPPING HALVES IS NOT TRAVEL: THE CAMERA HOLDS, AND A PAN STILL RELEASES IT (v1.114.4).
 *
 * Owner: "when I'm in Side Control bottom and click top, instead of the camera moving just a
 * little, it moves a lot, even hiding the current node behind the landcard dialog momentarily."
 *
 * The two halves share a midpoint, so the correct amount of camera movement is NONE — and this
 * journey holds BOTH ends of that, because a gate that only checked "the camera did not move"
 * would be satisfied by nailing the camera down: the swap must cost nothing, AND a real pan must
 * still be obeyed.
 *
 * WHAT IT PINS, AND WHAT IT DOES NOT — measured with mutants rather than guessed, because the
 * v1.114.4 fix touched three things and only two of them turn out to be load-bearing today:
 *  · KILLS. `rollFromPosition`'s `camFocus = pairMid(node)` -> the MEMBER'S drawn point: worst
 *    swing 11.900 world units against a `< 1` bar. Aiming at the pair is the mechanism.
 *  · KILLS. Dropping `_stagedCamFree = false` from the pan handler: `free` stays true and the
 *    tracking yanks the camera back out from under the user.
 *  · DOES NOT KILL, and is therefore NOT covered here: swapping the `stagedIdle` gate back to
 *    `!userActiveNow()` (the pre-v1.114.4 code), because with the aim already correct there is
 *    nothing for the tracking to correct on a same-subject swap. Its real observable — a staged
 *    board re-aiming once the landing card exists — belongs to, and is pinned by, `url-arrival`'s
 *    "the node it navigates to is framed clear of the landing card".
 *  · DOES NOT KILL: removing the `_sameSubject` guard so the target is recomputed anyway. With
 *    `pairMid` intact the recomputed answer is the same answer; the guard is what stops the
 *    recompute from happening against a half-torn-down layout, which is a robustness property
 *    this journey cannot see.
 */
test("swapping to the other half holds the camera, and a real pan releases it", async ({ page }) => {
  const j = journey(page)
  await j.boot(AT)
  await settle(page, j)

  const read = () =>
    page.evaluate(() => {
      const a = (window as Any).__neural
      const f = a.nodes[a.focusIdx]
      const p = a.nodes[f.pi]
      const sc = a.W / a.cam.vw
      const sy = (n: Any) => (a._LY(n) - a.cam.cy) * sc + a.H / 2
      return {
        tgtCy: a.camTarget.cy as number,
        mid: (sy(f) + sy(p)) / 2,
        focus: f.id as string,
        free: a._stagedCamFree as boolean,
      }
    })

  const g = await geometry(page)
  const before = await read()
  expect(before.focus, "standing on the bottom half").toBe("Positions/Side-Control/Bottom")
  expect(before.free, "a staged board tracks its framing until the user moves the camera").toBe(true)

  await page.mouse.move(g.partner!.sx, g.partner!.sy)
  await page.mouse.down()
  await page.mouse.up()

  // WATCH THE WHOLE TRANSITION, not just the end — the swing the owner saw was a transient that
  // then stuck, so an after-the-fact reading can miss it in either direction.
  let worst = 0
  for (let i = 0; i < 12; i++) {
    await j.advance(200)
    const now = await read()
    worst = Math.max(worst, Math.abs(now.tgtCy - before.tgtCy))
  }
  const after = await read()
  expect(after.focus, "the click did select the other half").toBe("Positions/Side-Control")
  expect(
    worst,
    `the camera target never swung during the swap (worst ${worst.toFixed(3)} world units)`,
  ).toBeLessThan(1)
  expect(
    Math.abs(after.mid - before.mid),
    "and the pair stayed where it was on the glass",
  ).toBeLessThan(14)

  // A REAL PAN STILL TAKES THE CAMERA — never fight the user. Start on bare canvas: the option
  // tray owns the lower right of this screen and a drag begun on it is not a pan at all.
  await page.mouse.move(1250, 180)
  await page.mouse.down()
  await page.mouse.move(1150, 120, { steps: 8 })
  await page.mouse.up()
  await j.advance(1200)
  const panned = await read()
  expect(panned.free, "a pan ends the staged tracking").toBe(false)
  expect(
    Math.abs(panned.mid - after.mid),
    "and the camera stays where the user put it",
  ).toBeGreaterThan(20)
})
