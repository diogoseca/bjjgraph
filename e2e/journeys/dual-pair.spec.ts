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

/**
 * FIND A PAIR THAT IS NOT THE ONE YOU ARE STANDING IN, well inside the glass and clear of the
 * landing card, and report its two halves plus the midline between them.
 *
 * `z > 0` picks each pair once (the upper half), so a pair cannot be reported twice, and the
 * candidates are sorted by separation so the journeys read the most legible one on the screen.
 */
const otherPair = (page: Page) =>
  page.evaluate(() => {
    const a = (window as Any).__neural
    const scale = a.W / a.cam.vw
    const K = Math.max(0.4, Math.min(1, a.cam.vw / (a.graphW * 0.5)))
    const S = (n: Any) => ({
      idx: n.idx as number,
      id: n.id as string,
      t: n.t as string,
      sx: (n.x - a.cam.cx) * scale + a.W / 2,
      sy: (a._LY(n) - a.cam.cy) * scale + a.H / 2,
      r: n.r * K * scale,
    })
    const f = a.focusIdx
    const fp = a.nodes[f].pi
    const out: Any[] = []
    for (const n of a.nodes) {
      if (n.idx === f || n.idx === fp || n.pi < 0 || n.z <= 0) continue
      const A = S(n)
      const B = S(a.nodes[n.pi])
      if (A.sx > 100 && A.sx < a.W - 280 && Math.min(A.sy, B.sy) > 70 && Math.max(A.sy, B.sy) < a.H - 320)
        out.push({ upper: A.sy < B.sy ? A : B, lower: A.sy < B.sy ? B : A, sep: Math.abs(A.sy - B.sy), mid: (A.sy + B.sy) / 2 })
    }
    // deterministic: separation, then idx — a tie decided by array order picks a different pair
    // from run to run, and every threshold below is a function of which pair got picked.
    out.sort((x, y) => y.sep - x.sep || x.upper.idx - y.upper.idx)
    return { lodK: a._lodK as number, best: out[0] || null, count: out.length }
  })

/**
 * A PAIR YOU POINT AT NAMES ITSELF THE WAY THE ONE YOU STAND IN DOES (v1.128.0). @curated
 *
 * Owner, having lived with v1.114.3: "that works very well for the current node … when I hover over
 * other techniques which have this duality as well, for example another position which is Front
 * Headlock, it shows 'Front Headlock Top' when I hover over the top and 'Front Headlock Bottom'
 * when I hover over the bottom … instead of showing a single label in the middle of the top and
 * bottom nodes. I want this behavior to also be true … for other nodes besides the current node."
 *
 * Two different answers to one question, on one graph. The single-node hover path prints
 * `splitName().main`, and a POSITION title carries no "from", so it returned the whole authored
 * string with the role baked into it — which is also the "printed twice" problem the in-node pass
 * was deleted for in v1.114.0, arriving by a different door.
 *
 * THE MEASUREMENT THAT SET THE GATE. The lift is anchored to each node's OWN radius, so at one
 * single zoom the focused pair separates **75px** (33px radius) while an ordinary pair separates
 * **34.7px median / 42.3px p90** (14px radius). Any pixel threshold tuned on the state you stand
 * in excludes every other pair on the screen — so the gate is `kLOD`, the app's own smoothstep
 * between MERGE (1.15 px/unit) and SPLIT (2.20), which is the same number that decides whether
 * there are two orbs to point at in the first place.
 */
test("@curated hovering any pair names it once, on the midline, with the role on the hovered side", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot(AT)
  await settle(page, j)

  const o = await otherPair(page)
  expect(o.lodK, "the graph is at split scale, where a pair has two orbs").toBeGreaterThan(0.5)
  expect(o.best, "there is a pair on screen that is not the one we stand in").not.toBeNull()
  const c = o.best!
  const x = Math.max(c.upper.sx, c.lower.sx) + Math.max(c.upper.r, c.lower.r) + 16

  // NOTHING IS THERE UNTIL YOU POINT AT IT — an unhovered pair is not labelled, so every bright
  // pixel below is attributable to the hover and not to some other node's resting label.
  const cold = await strips(page, c.mid, x)
  expect(cold.name + cold.above + cold.below, `an unpointed pair draws no label (${JSON.stringify(cold)})`).toBeLessThan(20)

  // POINT AT THE UPPER HALF: the name lands on the pair's midline, the role above it.
  await page.mouse.move(c.upper.sx - 60, c.upper.sy - 60)
  await page.mouse.move(c.upper.sx, c.upper.sy)
  await j.advance(120) // inside `_hover`'s 0.5s freshness window
  const up = await strips(page, c.mid, x)
  expect(up.name, `the name is drawn on the midline between the orbs (${JSON.stringify(up)})`).toBeGreaterThan(300)
  expect(up.above, "with the role above it, pointing at the half under the cursor").toBeGreaterThan(40)
  expect(up.below, "and nothing below").toBeLessThan(up.above / 2)

  // ...AND THE OLD BEHAVIOUR IS GONE. This is the assertion the owner's report is really about:
  // a second copy of the name hanging off the hovered orb, 17px above the midline here. Without
  // it this journey would pass on a build that draws BOTH labels.
  // MEASURED ABOVE THE HOVERED ORB, which is exactly where the old label drew (`sy - 8`, 13px) and
  // where the group draws nothing. The three bands cannot simply be re-centred on the orb: an
  // ordinary pair separates 34.7px median and the bands are 18-20px tall, so a strip taken at the
  // orb's own line reads the GROUP's own subtitle (measured: `{above: 0, name: 206, below: 463}`
  // — the 206 is the subtitle at `mid - 12`, not a second name). The band above the upper orb is
  // the one place the two behaviours do not overlap at any separation.
  const atOrb = await strips(page, c.upper.sy, x)
  expect(
    atOrb.above,
    `no second label hangs above the hovered orb (${JSON.stringify(atOrb)} at the orb's own line)`,
  ).toBeLessThan(30)

  // POINT AT THE LOWER HALF: one group, dynamic — the name does not move, only the role's side.
  await page.mouse.move(c.lower.sx - 60, c.lower.sy + 60)
  await page.mouse.move(c.lower.sx, c.lower.sy)
  await j.advance(120)
  const dn = await strips(page, c.mid, x)
  expect(dn.name, `the name held its line (${up.name} -> ${dn.name} bright px)`).toBeGreaterThan(300)
  expect(dn.below, "and the role moved below it").toBeGreaterThan(40)
  // A DIFFERENTIAL, NOT A WITHIN-STATE RATIO. The 18px name is drawn at baseline `mid + 6`, so its
  // own ascenders reach into the band above the midline — and HOW MUCH depends on which name the
  // candidate pair happens to have. A first version asserted `above < below / 2` inside the
  // bottom-hover state and failed in the full suite at 93 vs 126, on a build that was drawing the
  // subtitle in exactly the right place. The claim is not "the band above is empty", it is
  // **"the subtitle moved and the name did not"** — so compare each band against ITSELF across the
  // two hover states, where the name's constant contribution cancels.
  expect(
    up.above - dn.above,
    `the role vacated the top when the cursor moved down (${up.above} -> ${dn.above})`,
  ).toBeGreaterThan(40)
  expect(
    dn.below - up.below,
    `…and appeared underneath (${up.below} -> ${dn.below})`,
  ).toBeGreaterThan(40)
  expect(
    Math.abs(dn.name - up.name),
    `while the name itself did not move (${up.name} vs ${dn.name} bright px on the midline)`,
  ).toBeLessThan(up.name * 0.25)
})

/**
 * MERGED, THERE IS NOTHING TO POINT AT (v1.128.0).
 *
 * Owner: "that's not needed. That's only needed when we are zoomed in. If we're a bit zoomed out,
 * that's not really needed." Which is not a preference — at merge scale `kLOD` has collapsed the
 * two members onto their shared ground point, so "above" and "below" name the same orb. The group
 * stands down and the ordinary single label takes the hover back.
 *
 * The zoom-out is a REAL WHEEL GESTURE, not a write to `cam.vw`: measured, assigning `cam.vw` and
 * `camTarget.vw` directly moved the frame by 0.00006 of the graph width and snapped back, because
 * a staged board re-aims every frame. The wheel is also the seam that releases the camera lease
 * and `_stagedCamFree` (`:11946`), which is exactly why it is the one that works.
 */
test("zoomed out, a pair is one site again and the group stands down", async ({ page }) => {
  const j = journey(page)
  await j.boot(AT)
  await settle(page, j)
  expect((await otherPair(page)).lodK, "split to begin with").toBeGreaterThan(0.5)

  // AIM THE WHEEL AT CLEAR CANVAS. The centre of the screen is where the landing card sits
  // (measured: its top edge is at y=366 on this URL), and the card takes the wheel — so a gesture
  // at W/2, H/2 leaves `kLOD` at exactly 1 and the test fails on its own setup rather than on its
  // subject. The upper-left quadrant is graph and nothing else.
  const box = await page.evaluate(() => {
    const a = (window as Any).__neural
    return { x: a.W * 0.25, y: a.H * 0.18 }
  })
  await page.mouse.move(box.x, box.y)
  for (let i = 0; i < 24; i++) {
    await page.mouse.wheel(0, 500)
    await j.advance(120)
  }

  const o = await otherPair(page)
  expect(o.lodK, "the wheel really merged the pairs").toBeLessThan(0.5)
  if (!o.best) return // nothing legible on screen at this zoom is a fine outcome for this claim
  const c = o.best
  const x = Math.max(c.upper.sx, c.lower.sx) + Math.max(c.upper.r, c.lower.r) + 16
  await page.mouse.move(c.upper.sx - 40, c.upper.sy - 40)
  await page.mouse.move(c.upper.sx, c.upper.sy)
  await j.advance(120)
  // THE GROUP ITSELF IS THE ORACLE. A band-emptiness check does not survive contact with the
  // v1.129.0 two-line label: the ordinary hover label now draws a dimmer "from …" line just under
  // the name, and at merge scale the members are coincident so that line lands ON the midline —
  // measured {above:742, name:263, below:16}, which fails a "midline is quiet" assertion on a
  // perfectly correct build. `_lastPairLabel` is published by `pairGroup` and cleared every frame,
  // so it answers the actual question: did the group render here?
  const grp = await page.evaluate(() => (window as any).__neural._lastPairLabel)
  expect(grp, `no pair group is drawn at merge scale (got ${JSON.stringify(grp)})`).toBeFalsy()
  const m = await strips(page, c.mid, x)
  // THE MIDLINE IS THE ORACLE, and it has to be — "nothing is drawn" would be false and would
  // fail for the right reason on a correct build: the ordinary single-node label TAKES THE HOVER
  // BACK here, and at merge scale the two members are coincident so its baseline (`sy - 8`) lands
  // in the band above the midline. Measured on the fixed build: `{above: 383, name: 0, below: 0}`.
  // The group is the thing that writes ON the midline, so `name` is what separates the two.
  expect(
    m.above + m.below,
    `the hover still names the node — the ordinary label took it back (${JSON.stringify(m)})`,
  ).toBeGreaterThan(60)
  // (the pixel half now only asserts that SOMETHING was named — which line it landed on is the
  // two-line label's business, and the group's absence is already established above.)
})

/**
 * ON A PHONE, THE CAMERA CENTRES THE LABEL, NOT THE ORB (v1.128.1). @curated
 *
 * Owner: "i think the position in mobile should center not to the node but to the label of the
 * node(s)."
 *
 * The name hangs to the RIGHT of the orb, so parking the ORB at 44% of the width (the v1.101.1
 * reading bias) puts the thing you actually read off-centre. Measured at 390x844 on Side Control:
 * the orb sat at 171.6 while the orb+label block ran 158..300 — centred at 229, i.e. 59% of the
 * width.
 *
 * AND IT IS NOT ONLY COMPOSITION. At that framing the label starts at orb + 44px, leaving 174px of
 * screen, while the POSITION names the focus wears run to 242px — so **18 of 136 ran off the right
 * edge of a phone**. Centring the block seats every one: the widest ("Straight Ankle Lock
 * Control") spans 65..326 of 390.
 *
 * Desktop is deliberately untouched: there is room to the right either way, and 44% is the reading
 * bias ("every name hanging off a node runs left-to-right FROM it") which nothing here overturns.
 */
test("@curated the phone frames the orb AND its name, centred together", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const j = journey(page)
  await j.boot(AT)
  await settle(page, j)

  const block = (p: Page) =>
    p.evaluate(() => {
      const a: any = (window as any).__neural
      const scale = a.W / a.cam.vw
      const K = Math.max(0.4, Math.min(1, a.cam.vw / (a.graphW * 0.5)))
      const f = a.nodes[a.focusIdx]
      const partner = f.pi >= 0 ? a.nodes[f.pi] : null
      const mid = a.pairMid(f)
      const sx = (mid.x - a.cam.cx) * scale + a.W / 2
      // the focus mark is 1.28x the orb (v1.114.0), which is the silhouette the label clears
      const r = Math.max(f.r * K * scale, partner ? partner.r * K * scale : 0) * 1.28
      const w = a._labelWidthPx(f, f.pi >= 0)
      return { W: a.W, orbSx: sx, left: sx - r, right: sx + r + 11 + w, labelW: w }
    })

  const b = await block(page)
  expect(b.labelW, "the focus really has a name to frame").toBeGreaterThan(40)
  expect(b.right, "the whole name is on screen").toBeLessThan(b.W)
  expect(b.left, "and so is the orb").toBeGreaterThan(0)
  // THE CLAIM: the BLOCK is centred, which necessarily means the ORB is not.
  expect(
    Math.abs((b.left + b.right) / 2 - b.W / 2),
    `orb+label centres on the screen (block ${Math.round(b.left)}..${Math.round(b.right)} of ${b.W})`,
  ).toBeLessThan(6)
  expect(
    b.orbSx,
    `…and the orb itself sits left of centre to buy that (at ${Math.round(b.orbSx)})`,
  ).toBeLessThan(b.W / 2 - 10)

  // THE WORST POSITION NAME IN THE CORPUS still fits — this is the 18-of-136 half of the fix, and
  // it is the one a constant framing could not deliver at any offset.
  await page.goto("/Positions/Straight-Ankle-Lock-Control")
  await j.boot("/Positions/Straight-Ankle-Lock-Control")
  await settle(page, j)
  const w = await block(page)
  expect(w.labelW, "this is the widest position label in the corpus").toBeGreaterThan(200)
  expect(w.right, `the widest name still fits (${Math.round(w.left)}..${Math.round(w.right)})`).toBeLessThan(w.W)
  expect(w.left, "without pushing the orb off the left").toBeGreaterThan(0)
})

/**
 * THE ORB NEVER HUGS THE LEFT EDGE (v1.129.0). @curated
 *
 * Owner: "we want the node to be on the left of the centered label BUT not so close to the edge
 * (at least like 50px distance from the left edge i guess)."
 *
 * Pure block-centring puts the orb further left the longer the name is, and on a narrow phone that
 * walks it into the bezel. `NG_LABEL_LEFT_MIN` is a floor on the drawn SILHOUETTE — not the centre —
 * so a big focus orb is held off by the same visible margin as a small one.
 *
 * MEASURED, on the widest position name in the corpus ("Straight Ankle Lock Control"): at 320px
 * (iPhone SE) pure centring wants the orb edge at 30 and the clamp holds it at exactly 50, with the
 * label still ending at 309 of 320; at 360 it binds at exactly 50; at 390 it does NOT bind (64) and
 * pure centring wins. A floor that engages only when it is needed, which is what makes it a floor
 * and not a constant.
 */
test("@curated on a narrow phone the clamp holds the orb off the edge, and the name still fits", async ({
  page,
}) => {
  const j = journey(page)
  for (const width of [320, 360, 390]) {
    await page.setViewportSize({ width, height: 780 })
    await j.boot("/Positions/Straight-Ankle-Lock-Control")
    await settle(page, j)
    const g = await page.evaluate(() => {
      const a: any = (window as any).__neural
      const scale = a.W / a.cam.vw
      const K = Math.max(0.4, Math.min(1, a.cam.vw / (a.graphW * 0.5)))
      const f = a.nodes[a.focusIdx]
      const p = f.pi >= 0 ? a.nodes[f.pi] : null
      const sx = (a.pairMid(f).x - a.cam.cx) * scale + a.W / 2
      const r = Math.max(f.r * K * scale, p ? p.r * K * scale : 0) * 1.28
      const lw = a._labelWidthPx(f, f.pi >= 0)
      return {
        W: a.W,
        min: a.NG_LABEL_LEFT_MIN,
        orbLeft: sx - r,
        wantedLeft: a.W / 2 - (11 + lw) / 2 - r, // where pure centring alone would put it
        labelRight: sx + r + 11 + lw,
      }
    })
    expect(
      g.orbLeft,
      `${width}px: the orb keeps its margin (edge at ${Math.round(g.orbLeft)}, floor ${g.min})`,
    ).toBeGreaterThanOrEqual(g.min - 0.5)
    expect(g.labelRight, `${width}px: and the name still fits on screen`).toBeLessThan(g.W)
    // the floor must ENGAGE somewhere, or it is untested decoration: 320 is the case that needs it
    if (width === 320)
      expect(
        g.wantedLeft,
        "at 320px pure centring really would have pushed the orb inside the floor",
      ).toBeLessThan(g.min)
  }
})

/** ...AND DESKTOP KEEPS THE 44% READING BIAS, because there was never a problem to solve there. */
test("desktop framing is untouched — the orb stays at the reading bias", async ({ page }) => {
  const j = journey(page)
  await j.boot(AT)
  await settle(page, j)
  const m = await page.evaluate(() => {
    const a: any = (window as any).__neural
    const scale = a.W / a.cam.vw
    const mid = a.pairMid(a.nodes[a.focusIdx])
    return { frac: ((mid.x - a.cam.cx) * scale + a.W / 2) / a.W, W: a.W }
  })
  expect(m.W, "this is a desktop viewport").toBeGreaterThan(700)
  expect(m.frac, `the orb parks at ~44% of the width (${m.frac.toFixed(3)})`).toBeCloseTo(0.44, 2)
})

/**
 * THE ROLE WORD IS THE ONE ITS CATEGORY ACTUALLY USES (v1.129.4). @curated
 *
 * Owner: "wrt submission escaping/finishing — implement escaping/finishing roles top/bottom".
 *
 * A BJJ point rather than a copy preference: you do not "attempt" a submission you are already
 * holding — you FINISH it — and the other half is not "defending" in the positional sense, they are
 * ESCAPING. A transition is the case where attempting/defending is the honest pair, because the
 * move may simply not come off.
 *
 *   positions    TOP / BOTTOM
 *   submissions  FINISHING / ESCAPING
 *   transitions  ATTEMPTING / DEFENDING
 *
 * AND IT IS THE ROLE LINE, a different object from the `from <position>` line beneath the name:
 * that one DISAMBIGUATES a shared short name ("Kimura" is 35 techniques here), this one says which
 * side of the exchange you are pointing at. They sit on opposite sides of the name for exactly that
 * reason. Both are asserted here so a future change cannot quietly merge them.
 */
test("@curated a submission finishes and escapes; a transition attempts and defends", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot(AT)
  await settle(page, j)

  const WORDS: Record<string, [string, string]> = {
    positions: ["TOP", "BOTTOM"],
    submissions: ["FINISHING", "ESCAPING"],
    transitions: ["ATTEMPTING", "DEFENDING"],
  }

  const seen: Record<string, any> = {}
  for (const ty of ["submissions", "transitions"]) {
    // hover the UPPER half (the performer) and then the LOWER one, so both words are exercised
    for (const half of ["upper", "lower"]) {
      const t = await page.evaluate(
        ({ ty, half }: any) => {
          const a: any = (window as any).__neural
          const scale = a.W / a.cam.vw
          for (const n of a.nodes) {
            if (n.ty !== ty || n.pi < 0 || n.z <= 0) continue
            if (n.idx === a.focusIdx || n.idx === a.nodes[a.focusIdx].pi) continue
            const P = (m: any) => ({
              sx: (m.x - a.cam.cx) * scale + a.W / 2,
              sy: (a._LY(m) - a.cam.cy) * scale + a.H / 2,
            })
            const A = P(n)
            const B = P(a.nodes[n.pi])
            const pick = half === "upper" ? (A.sy < B.sy ? A : B) : A.sy < B.sy ? B : A
            if (pick.sx > 120 && pick.sx < a.W - 320 && pick.sy > 90 && pick.sy < a.H - 330)
              return { sx: pick.sx, sy: pick.sy, t: n.t }
          }
          return null
        },
        { ty, half },
      )
      expect(t, `there is a ${ty} pair on screen to point at (${half} half)`).not.toBeNull()
      await page.mouse.move(t!.sx - 40, t!.sy - 40)
      await page.mouse.move(t!.sx, t!.sy)
      await j.advance(120)
      const L = await page.evaluate(() => (window as any).__neural._lastPairLabel)
      expect(L, `${ty}/${half}: the group drew`).toBeTruthy()
      seen[ty + "/" + half] = { sub: L.sub, above: L.above, main: L.main, qual: L.qual, node: t!.t }
      const want = WORDS[ty][L.above ? 0 : 1]
      expect(
        L.sub,
        `${ty} ${half} half says "${want}" (drew "${L.sub}" on ${t!.t})`,
      ).toBe(want)
    }
  }

  // NEITHER CATEGORY MAY BORROW THE OTHER'S VOCABULARY — the whole point of the change. Scoped
  // PER CATEGORY: a first version pooled all four words and failed because a TRANSITION correctly
  // said ATTEMPTING, which is the assertion misreading its own subject rather than a defect.
  const wordsOf = (ty: string) =>
    Object.keys(seen).filter((k) => k.startsWith(ty + "/")).map((k) => seen[k].sub)
  const subWords = wordsOf("submissions")
  const transWords = wordsOf("transitions")
  expect(subWords.sort(), `a submission uses only its own pair (saw ${JSON.stringify(seen)})`).toEqual(["ESCAPING", "FINISHING"])
  expect(transWords.sort(), "…and a transition only its own").toEqual(["ATTEMPTING", "DEFENDING"])

  // THE TWO SUBTITLES ARE DIFFERENT OBJECTS. The qualifier is a "from <position>" string; the role
  // word is one of the six above. A build that merged them would fail here.
  for (const k of Object.keys(seen)) {
    const v = seen[k]
    if (v.qual) expect(v.qual, `${k}: the qualifier is a "from …" line`).toMatch(/^from /i)
    expect(v.qual, `${k}: and is never the role word`).not.toBe(v.sub)
  }
})

/**
 * A TWO-ROW LABEL STRADDLES THE MIDLINE (v1.129.4). @curated
 *
 * Owner: "those from wtv position look poorly aligned. rule is when those extra subtitles show,
 * the label shouldnt be aligned at the center, but rather the label and the 'from subtitle' rows
 * should be centered to the middle of the dual nodes".
 *
 * v1.129.0 pinned the NAME to the midline and hung the qualifier under it, so the two-row object's
 * centre sat a whole half-line BELOW the pair it names. The midline is the one line equidistant
 * between the two orbs — that is why the group reads as one label for one state — so what belongs
 * on it is the whole block.
 *
 * ONE RULE, BOTH CASES: `lift` is half the row lead and is ZERO without a qualifier, so the
 * single-row layout keeps the exact baselines it has always had. That degeneracy is the point —
 * it is what stops "with qualifier" and "without" becoming two layouts that drift apart — and it
 * is asserted below rather than assumed.
 */
test("@curated the name and its qualifier centre on the pair, and the one-row case is unchanged", async ({
  page,
}) => {
  const j = journey(page)
  await j.boot(AT)
  await settle(page, j)

  const hoverKind = async (want: "qual" | "plain") => {
    const t = await page.evaluate(
      (want: string) => {
        const a: any = (window as any).__neural
        const scale = a.W / a.cam.vw
        for (const n of a.nodes) {
          if (n.ty === "positions" || n.pi < 0 || n.z <= 0) continue
          const hasQ = !!a.splitName(n.t).from
          if (want === "qual" ? !hasQ : hasQ) continue
          if (n.idx === a.focusIdx || n.idx === a.nodes[a.focusIdx].pi) continue
          const sx = (n.x - a.cam.cx) * scale + a.W / 2
          const sy = (a._LY(n) - a.cam.cy) * scale + a.H / 2
          if (sx > 120 && sx < a.W - 320 && sy > 90 && sy < a.H - 330) return { sx, sy, t: n.t }
        }
        return null
      },
      want,
    )
    expect(t, `there is a ${want} technique pair on screen`).not.toBeNull()
    await page.mouse.move(t!.sx - 40, t!.sy - 40)
    await page.mouse.move(t!.sx, t!.sy)
    await j.advance(120)
    const L = await page.evaluate(() => (window as any).__neural._lastPairLabel)
    expect(L, `${want}: the group drew`).toBeTruthy()
    return L
  }

  // TWO ROWS: the block's centre is the midline, so the name sits ABOVE it and the qualifier BELOW.
  const q = await hoverKind("qual")
  expect(q.qualY, "this one really has a qualifier row").not.toBeNull()
  expect(q.nameY, `the name moved up off the midline (name ${q.nameY}, mid ${q.midY})`).toBeLessThan(q.midY)
  expect(q.qualY, "and the qualifier sits below it").toBeGreaterThan(q.midY)
  // ONE ROW: nothing moved. The lift degenerates to zero, which is what keeps the two cases one
  // rule instead of two layouts.
  const p = await hoverKind("plain")
  expect(p.qualY, "this one has no qualifier row").toBeNull()
  expect(
    p.nameY - p.midY,
    `the single-row baseline is untouched at mid + 6 (got ${p.nameY - p.midY})`,
  ).toBeCloseTo(6, 5)

  // THE CLAIM, TIED TO THE ONE-ROW CASE RATHER THAN TO A RAW COORDINATE: the two-row block centres
  // exactly where a one-row label centres. A first version asserted the two BASELINES straddle
  // `midY` itself and failed at 137.2 vs 131.2 — because `+6` is not a centring error, it is the
  // baseline-to-visual-centre correction that makes a single row LOOK centred. Comparing the two
  // cases to each other is both the honest claim and the "uniformize" requirement: one rule, and
  // a qualifier changes what is written, never where the label sits.
  expect(
    (q.nameY + q.qualY) / 2 - q.midY,
    `the two-row block centres where the one-row label does (block ${(q.nameY + q.qualY) / 2 - q.midY}, single ${p.nameY - p.midY})`,
  ).toBeCloseTo(p.nameY - p.midY, 5)
})
