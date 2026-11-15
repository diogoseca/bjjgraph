import { expect, test, type Page } from "@playwright/test"
import { journey } from "../dsl"

/** THE MAP'S GOLD, BY THE INK (v1.280.0, GOLD1; the owner's U183 a, "Gold outlines on the map: yes, build it as drawn").
 *
 * A recalled move (a Yes in the row) wears a gold line OUTSIDE its orb; a move whose questions are answered (its own deck
 * all learned) wears gold INSIDE, with the orb's own colour kept as a border inside the edge, drawn in full from an `rs` of
 * 3.2 px, not at all at 2.4 px or less (NG_MAP_MARKS, app.src.jsx). THE ONE CLAIM the design exists for: THE ORB'S OWN
 * COLOUR IS VISIBLE IN EVERY STATE AT EVERY SIZE (the old outline and the "Turn what you know gold" recolour both lost it).
 * AT A DEVICE PIXEL RATIO BELOW 2 (GOLD1-R2 at dpr 1, the map reader of PR 417: a desktop at 100% that is not high-density;
 * GOLD1-R4 below 2, its D4: at 1.5, a laptop at 150%, the dpr-2 rules left a few diamonds a warm tint) the border is never
 * under 2 device pixels, the outside line starts half a device pixel beyond the silhouette and is 1.5 device pixels wide
 * (at least 1 CSS px), and the inside is drawn only where its gold has a device pixel of room inside the border (full at
 * two): at dpr 1 it starts at rs 3.0 / 3.6 / 4.0 and is full at 4.0 / 4.8 / 5.4 (circle / diamond / triangle); at 1.5 it is
 * full at 3.2 / 3.2 / 3.6. Four viewports: 1440 at dpr 2, 390 at dpr 3 (the canvas caps at 2), 1440 at dpr 1 and at 1.5.
 *
 * WHAT IS READ: the pixels `draw()` paints (an offscreen copy of the real frame, the live context swapped for the shot), never
 * the rule recomputed (CLAUDE.md 6.3). THE SPECIMENS: one orb of each shape, a circle (a position), a diamond (a transition)
 * and a triangle (a submission), each drawn in its OWN paint and in three colours. The colours are an INPUT, set on the
 * instance for that one orb through `_mapColor`, the one function both the orb's fill and the mark's border read: the app's
 * own `domColor` at +0.9 (blue), -0.85 (red) and 0 (grey). Set, because the map has no orb a player can mark in most of
 * those nine: every markable submission is its attacker's half, painted blue (its red half is the defender twin, which
 * never wears a mark), no markable position is that red, no markable transition that blue (measured on the v1.278.1 wire:
 * by `dom`, triangles 287 blue and nothing else; circles 9 blue, 30 grey, 0 red; diamonds 0 blue, 324 grey, 0 red).
 * Each specimen orb is drawn ALONE (the ruleset mask hides every other node for the
 * shot, the focus and the dealt hand are set aside), at a camera binary-searched until the frame's own published `rs`
 * (`_lastMapMarks`) hits each size; the two sets the draw reads (`_movesGold`, `_answered`) are set per state on the
 * instance. Four pixels per shot: the CENTRE; the middle of the BORDER band, along the edge's normal (a circle's side, a
 * diamond's 45-degree face, a triangle's base), at the edge minus half the border; 3/4 px INSIDE the edge (at dpr 1, where
 * that is the band's own last device pixel, the band's middle again); and OUTSIDE, the goldest of three points across the
 * line (a quarter, half and three quarters of its width, from the gap: half a device pixel at dpr 1, none at 2). The inside
 * is judged on what the frame PUBLISHED for it (`inK`, its alpha): none, the centre is the orb's own; full, gold iff
 * answered; between, warmer than the bare orb; at dpr 2 it must be full from rs 3.2.
 * "Gold" and "own colour" are judged by chromaticity against the same pixel with no mark (the "none" state): own = within
 * 0.07 of it and not gold; gold = green over blue by 45 and red at least green less 10 (240,192,90 at 0.95; the red orb's
 * fill is 232,64,64: its green does not clear its blue, so a red orb never reads as gold).
 * WHAT THE HARNESS DOES NOT SERVE: nothing here depends on dossiers or decks (the sets are set, not graded).
 *
 * MUTANTS, each one exact replacement in app.src.jsx, rebuilt and this file run in full (14 Nov; times in the v1.280.0
 * archive entry), every one red at both widths:
 *   G1  the outside line on an answered orb without a Yes   red at "the outside line is gold when and only when there is a Yes"
 *   G2  the inside on a recalled orb not answered           red at "the inside is gold when and only when the questions are
 *   G5  the inside only with a Yes as well                   answered and the size allows it"
 *   G3  the inside from rs 1.4 (not 2.4)                    red at "at rs 2.4 px or less the centre is the orb's own colour"
 *   G4  the gold over the whole shape (not inset)           red at "the border band is the orb's own colour in every state,
 *   G10 the FIRST BUILD (the border stroked over a full      at every size" (G10 is what this spec found: at rs 2.8 the
 *       gold fill, both at the fade's alpha)                 gold showed through the half-faded border, 160,137,117 on a
 *                                                            103,92,103 orb)
 *   G11 the outside line centred on the edge (half on the   red at the same assertion (3/4 px inside the edge)
 *       orb), not outset
 *   GOLD1-R2 (the map reader of PR 417: at dpr 1 the band took a gold tint), on the committed head 2bf3d2c80:
 *   R2a the dpr-1 border minimum removed (`bwMin` back to   red at "1440 dpr 1: the border band is the orb's own colour
 *       1.2 CSS px at every ratio)                           in every state, at every size" (dpr 2 and 390 green)
 *   R2a2 the dpr-1 line at 1 CSS px (not 1.5 device px)     red at "1440 dpr 1: the outside line is gold when and only when
 *                                                            there is a Yes" (the diamond's faces at partial cover)
 *   GOLD1-R4 (the map reader's second look), on 605a2d744:
 *   R4b the dpr-1 rules below 1.5 again (dpr 1.5 on the      red at "1440 dpr 1.5: the border band is the orb's own colour
 *       dpr-2 rules)                                         in every state, at every size"
 *   nofit1 (the reader's) no inside at all below dpr 2       red at "1440 dpr 1: the inside is gold when and only when the
 *   halffit1 (the reader's) the inside never above half      questions are answered and the size allows it" and at dpr 1.5
 *                                                            (both: the judge had no size rule below dpr 2, D3)
 * NOT COVERED here: overlapping marked orbs (the owner's pictures show them, tests/artifacts/_outline_shoot.mjs --overlap); the seat's outside line
 * on its focus mark; the colour of a real orb at a size the camera search did not reach.
 */

type W = any
const RS = [2.0, 2.8, 3.2, 5, 8]
const STATES = ["none", "out", "in", "both"] as const

const shoot = (page: Page) => page.evaluate(([RS, STATES]) => {
  const a = (window as W).__neural, live = a.ctx, dpr = a.dpr || 1, base = a._rulesetMask()
  a.setPaused(true)
  // the specimens: a circle (position), a diamond (transition) and a triangle (submission), each a drawn member that is
  // never a defender twin (the marks' own gate), in its own paint and in the app's blue, red and grey (set, see the header)
  const kinds: Array<[string, (n: W) => boolean]> = [["circle", (n) => n.ty === "positions"], ["triangle", (n) => n.ty === "submissions"], ["diamond", (n) => n.ty !== "positions" && n.ty !== "submissions" && n.ty !== "hidden"]]
  const tones: Array<[string, W]> = [["own", null], ["blue", a.domColor(0.9)], ["red", a.domColor(-0.85)], ["grey", a.domColor(0)]]
  const specimens: W[] = []
  for (const [shape, isShape] of kinds) {
    const n = a.nodes.find((n: W) => base[n.idx] === 1 && isShape(n) && (n.rep || !n.z) && n.role !== "defender")
    if (n) for (const [tone, col] of tones) specimens.push({ idx: n.idx, shape, tone, col, name: a.graphName(n) })
  }
  const keep = { focus: a.focusIdx, opts: a.optionIdxs, gold: Object.prototype.hasOwnProperty.call(a, "_movesGold"), cam: { ...a.cam } }
  const paint = a._mapColor
  const px = (c: W, x: number, y: number) => { const d = c.getImageData(Math.floor(x * dpr), Math.floor(y * dpr), 1, 1).data; return [d[0], d[1], d[2]] }
  const draw = () => {
    const c = document.createElement("canvas"); c.width = live.canvas.width; c.height = live.canvas.height
    const ctx = c.getContext("2d", { willReadFrequently: true })!
    a.ctx = ctx; ctx.save()
    try { a.draw() } finally { a.ctx = live; ctx.restore() }
    return ctx
  }
  const out: W[] = []
  try {
    a.focusIdx = -1; a.optionIdxs = []
    for (const sp of specimens) {
      const n = a.nodes[sp.idx], mask = new Uint8Array(a.nodes.length); mask[sp.idx] = 1
      a._rulesetMask = () => mask
      if (sp.col) a._mapColor = (m: W, lower?: boolean) => m.idx === sp.idx ? sp.col : paint.call(a, m, lower); else delete a._mapColor
      const set = (st: string) => {
        a._movesGold = () => new Map(st === "out" || st === "both" ? [[sp.idx, 1]] : [])
        a._answered = (m: W) => (st === "in" || st === "both") && m.idx === sp.idx
      }
      for (const rsT of RS) {
        // the camera on the orb, its width searched until the published rs hits the target (rs falls as the view widens)
        set("out")
        let lo = Math.log(a.graphW * 0.001), hi = Math.log(a.graphW * 6), got: W = null
        for (let k = 0; k < 40; k++) {
          const mid = (lo + hi) / 2, vw = Math.exp(mid)
          a.cam.vw = vw; a.cam.lvw = mid; a.cam.cx = n.x; a.cam.cy = a._LY ? n.y : n.y
          a.draw(); a.cam.cy = a._LY(n); a.draw()
          got = (a._lastMapMarks || []).find((m: W) => m.idx === sp.idx)
          if (!got) break
          if (got.rs > rsT) lo = mid; else hi = mid
        }
        if (!got) { out.push({ ...sp, col: undefined, rsT, err: "no mark published" }); continue }
        // the border as the frame draws it (v1.280.0, GOLD1-R2): never under 2 device pixels; below dpr 2 (GOLD1-R4) the line
        // starts half a device pixel out and is 1.5 device pixels wide (at least 1 CSS px)
        const rs = got.rs, bw = Math.max(Math.max(1.2, 2 / dpr), Math.min(2.2, 0.32 * rs)), gap = dpr < 2 ? 0.5 / dpr : 0
        // along the edge's normal: a circle's side, a diamond's face at 45 degrees (h = 1.18 r, the face at h / sqrt 2),
        // a triangle's base (h = 1.35 r, the base at 0.72 h)
        const [ux, uy, f] = sp.shape === "circle" ? [1, 0, 1] : sp.shape === "diamond" ? [Math.SQRT1_2, Math.SQRT1_2, 1.18 * Math.SQRT1_2] : [0, 1, 0.972]
        // at dpr 1 a device pixel is a whole CSS pixel: 3/4 px inside the edge is the silhouette's own anti-aliased pixel, so the
        // band's middle stands for it; the 1 px line splits across two pixels at a sub-pixel offset, so it is read at three
        // points across its width and the goldest counts
        const e = rs * f, bandAt = Math.max(0.3, e - bw / 2), edgeAt = dpr < 1.5 ? bandAt : e - 0.75, lw = Math.max(1, 1.5 / dpr), outs = [0.25, 0.5, 0.75].map((d) => e + gap + d * lw)
        const shots: W = {}
        for (const st of STATES) {
          set(st)
          const ctx = draw(), m = (a._lastMapMarks || []).find((q: W) => q.idx === sp.idx) || got
          const outPx = outs.map((d) => px(ctx, m.x + ux * d, m.y + uy * d)).sort((p: number[], q: number[]) => (q[1] - q[2]) - (p[1] - p[2]))[0]
          shots[st] = { centre: px(ctx, m.x, m.y), band: px(ctx, m.x + ux * bandAt, m.y + uy * bandAt), edge: px(ctx, m.x + ux * edgeAt, m.y + uy * edgeAt), out: outPx, inK: m.inK || 0, outMark: !!m.out }
        }
        out.push({ ...sp, col: undefined, rsT, rs: +rs.toFixed(2), bw: +bw.toFixed(2), shots })
      }
    }
  } finally {
    delete a._rulesetMask; delete a._answered; delete a._mapColor; if (!keep.gold) delete a._movesGold
    a.focusIdx = keep.focus; a.optionIdxs = keep.opts; Object.assign(a.cam, keep.cam); a.setPaused(false)
  }
  return { specimens: specimens.map((s) => ({ ...s, col: undefined })), out, dpr }
}, [RS, STATES] as const)

// where the inside is FULL below dpr 2: the smallest rs whose gold has two device pixels of room inside the border, from each
// shape's inradius (circle 1, diamond 0.8344, triangle 0.7442 rs) and the border (`max(2 / dpr, min(2.2, 0.32 rs))`), and not
// below the design's 3.2. dpr 1: 4.0 / 4.8 / 5.4 (as ruled); dpr 1.5: 3.2 / 3.2 (3.196) / 3.6 (3.583)
const FULL = { "1": { circle: 4.0, diamond: 4.8, triangle: 5.4 }, "1.5": { circle: 3.2, diamond: 3.2, triangle: 3.6 } }

const chroma = (p: number[]) => { const s = p[0] + p[1] + p[2] || 1; return [p[0] / s, p[1] / s, p[2] / s] }
const near = (p: number[], q: number[]) => { const a = chroma(p), b = chroma(q); return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 0.07 }
const gold = (p: number[]) => p[1] - p[2] > 45 && p[0] >= p[1] - 10 && p[0] > 120

function judge(r: W, where: string) {
  expect(r.specimens.map((s: W) => s.shape + " " + s.tone).sort(), `${where}: a circle, a diamond and a triangle, each in its own paint and in blue, red and grey`)
    .toEqual(["circle blue", "circle grey", "circle own", "circle red", "diamond blue", "diamond grey", "diamond own", "diamond red", "triangle blue", "triangle grey", "triangle own", "triangle red"])
  const missing = r.out.filter((o: W) => o.err).map((o: W) => `${o.shape} ${o.tone} rs ${o.rsT}: ${o.err}`)
  expect(missing, `${where}: every specimen reached every size`).toEqual([])
  const offSize = r.out.filter((o: W) => Math.abs(o.rs - o.rsT) > 0.08).map((o: W) => `${o.shape} ${o.tone}: rs ${o.rs} for ${o.rsT}`)
  expect(offSize, `${where}: each shot is at its size (within 0.08 px)`).toEqual([])
  const band: string[] = [], line: string[] = [], inside: string[] = [], small: string[] = []
  for (const o of r.out) {
    const s = o.shots, id = `${o.shape} ${o.tone} rs ${o.rsT}`
    for (const st of STATES) {
      // THE CLAIM: the border band is the orb's own colour in every state, and so is the orb just inside its edge (3/4 px in:
      // the outside line lies wholly outside the silhouette)
      if (!near(s[st].band, s.none.band) || gold(s[st].band)) band.push(`${id} ${st}: band ${s[st].band} against ${s.none.band}`)
      if (!near(s[st].edge, s.none.edge) || gold(s[st].edge)) band.push(`${id} ${st}: 3/4 px inside the edge ${s[st].edge} against ${s.none.edge}`)
      // the outside line is gold when and only when there is a Yes
      const yes = st === "out" || st === "both"
      if (gold(s[st].out) !== yes) line.push(`${id} ${st}: outside ${s[st].out}${yes ? " not gold" : " gold"}`)
      const answered = st === "in" || st === "both"
      if (o.rsT <= 2.4) {
        // at rs 2.4 px or less the centre is the orb's own colour, whatever the state
        if (!near(s[st].centre, s.none.centre) || gold(s[st].centre)) small.push(`${id} ${st}: centre ${s[st].centre} against ${s.none.centre}`)
      }
      // the inside as the frame published it (`inK`, its alpha): none drawn, the centre is the orb's own colour; drawn in full, it
      // is gold when and only when the questions are answered; fading in, answered, the centre is warmer than the bare orb's
      // (v1.280.0, GOLD1-R2: at dpr 1 the inside waits for room inside its 2 px border, so where it starts is no longer one size)
      const inK = s[st].inK
      if (inK === 0) { if (gold(s[st].centre) || !near(s[st].centre, s.none.centre)) inside.push(`${id} ${st}: no inside drawn, centre ${s[st].centre} against ${s.none.centre}`) }
      else if (inK >= 0.999) { if (gold(s[st].centre) !== answered) inside.push(`${id} ${st}: centre ${s[st].centre}${answered ? " not gold" : " gold"}`) }
      else if (answered && !(s[st].centre[1] - s[st].centre[2] > s.none.centre[1] - s.none.centre[2] + 10)) inside.push(`${id} ${st}: centre ${s[st].centre} not warmer than ${s.none.centre} (fading in, inK ${inK})`)
      if (!answered && inK > 0) inside.push(`${id} ${st}: an inside published without its questions answered`)
      // at dpr 2 the size rule is the design's own: full from rs 3.2 (unchanged by GOLD1-R2)
      if (r.dpr >= 2 && answered && o.rsT >= 3.2 && inK < 0.999) inside.push(`${id} ${st}: at dpr 2 the inside is full from rs 3.2 (inK ${inK})`)
      // below dpr 2 (GOLD1-R4, the map reader's D3: the judge had no size rule there, so no inside at all, or one never above
      // half, read green): answered, and the frame's own rs at or above where the gold has two device pixels of room inside
      // the border (and 3.2), the inside is FULL
      if (r.dpr < 2) {
        const full = (FULL as W)[String(r.dpr)]?.[o.shape]
        if (full == null) inside.push(`${id}: no size rule for dpr ${r.dpr}`)
        else if (answered && o.rs >= full && inK < 0.999) inside.push(`${id} ${st}: at dpr ${r.dpr} the inside is full from rs ${full} (rs ${o.rs}, inK ${inK})`)
      }
    }
  }
  expect(band, `${where}: the border band is the orb's own colour in every state, at every size`).toEqual([])
  expect(line, `${where}: the outside line is gold when and only when there is a Yes`).toEqual([])
  expect(inside, `${where}: the inside is gold when and only when the questions are answered and the size allows it`).toEqual([])
  expect(small, `${where}: at rs 2.4 px or less the centre is the orb's own colour`).toEqual([])
}

// dpr 1 (GOLD1-R2, the map reader of PR 417): a plain desktop screen at 100% draws the canvas at one device pixel per CSS pixel;
// dpr 1.5 (GOLD1-R4, its D4): a laptop at 150%
for (const vp of [{ width: 1440, height: 900, touch: false, dpr: 2 }, { width: 390, height: 631, touch: true, dpr: 3 }, { width: 1440, height: 900, touch: false, dpr: 1 }, { width: 1440, height: 900, touch: false, dpr: 1.5 }]) {
  test.describe(`the map's gold ${vp.width}x${vp.height} dpr ${vp.dpr}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch, isMobile: vp.touch, deviceScaleFactor: vp.dpr })

    test(`by the ink: the orb's own colour in every state at every size; gold outside with a Yes, inside with the questions answered (${vp.width}, dpr ${vp.dpr})`, async ({ page }) => {
      test.setTimeout(240_000)
      const j = journey(page)
      await j.boot("/")
      await j.land("Mount Top")
      const r = await shoot(page)
      console.log(`[map-gold] ${vp.width} dpr ${vp.dpr}: ${r.specimens.length} specimens, ${r.out.length} sizes, canvas dpr ${r.dpr}`)
      expect(r.dpr, "the canvas draws at the screen's ratio (capped at 2)").toBe(Math.min(2, vp.dpr))
      judge(r, `${vp.width} dpr ${vp.dpr}`)
    })
  })
}
