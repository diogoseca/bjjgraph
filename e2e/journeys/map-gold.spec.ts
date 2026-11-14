import { expect, test, type Page } from "@playwright/test"
import { journey } from "../dsl"

/** THE MAP'S GOLD, BY THE INK (v1.280.0, GOLD1; the owner's U183 a, "Gold outlines on the map: yes, build it as drawn").
 *
 * A recalled move (a Yes in the row) wears a gold line OUTSIDE its orb; a move whose questions are answered (its own deck
 * all learned) wears gold INSIDE, with the orb's own colour kept as a border inside the edge, drawn in full from an `rs` of
 * 3.2 px, not at all at 2.4 px or less (NG_MAP_MARKS, app.src.jsx). THE ONE CLAIM the design exists for: THE ORB'S OWN
 * COLOUR IS VISIBLE IN EVERY STATE AT EVERY SIZE (the old outline and the "Turn what you know gold" recolour both lost it).
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
 * diamond's 45-degree face, a triangle's base), at the edge minus half the border; 3/4 px INSIDE the edge; and just OUTSIDE
 * the edge (+0.5 px).
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
 * NOT COVERED here: overlapping marked orbs (the pictures show them, outline-built/overlap4x-*); the seat's outside line
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
        const rs = got.rs, bw = Math.max(1.2, Math.min(2.2, 0.32 * rs))
        // along the edge's normal: a circle's side, a diamond's face at 45 degrees (h = 1.18 r, the face at h / sqrt 2),
        // a triangle's base (h = 1.35 r, the base at 0.72 h)
        const [ux, uy, f] = sp.shape === "circle" ? [1, 0, 1] : sp.shape === "diamond" ? [Math.SQRT1_2, Math.SQRT1_2, 1.18 * Math.SQRT1_2] : [0, 1, 0.972]
        const e = rs * f, bandAt = Math.max(0.3, e - bw / 2), outAt = e + 0.5, edgeAt = e - 0.75
        const shots: W = {}
        for (const st of STATES) {
          set(st)
          const ctx = draw(), m = (a._lastMapMarks || []).find((q: W) => q.idx === sp.idx) || got
          shots[st] = { centre: px(ctx, m.x, m.y), band: px(ctx, m.x + ux * bandAt, m.y + uy * bandAt), edge: px(ctx, m.x + ux * edgeAt, m.y + uy * edgeAt), out: px(ctx, m.x + ux * outAt, m.y + uy * outAt), inK: m.inK || 0, outMark: !!m.out }
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
      } else if (o.rsT >= 3.2) {
        // from rs 3.2 px the inside is gold when and only when the questions are answered
        if (gold(s[st].centre) !== answered) inside.push(`${id} ${st}: centre ${s[st].centre}${answered ? " not gold" : " gold"}`)
      } else if (answered && !(s[st].centre[1] - s[st].centre[2] > s.none.centre[1] - s.none.centre[2] + 10)) {
        // between (2.8 px), the inside gold fades in: answered, the centre is warmer than the bare orb's
        inside.push(`${id} ${st}: centre ${s[st].centre} not warmer than ${s.none.centre} (fading in)`)
      }
    }
  }
  expect(band, `${where}: the border band is the orb's own colour in every state, at every size`).toEqual([])
  expect(line, `${where}: the outside line is gold when and only when there is a Yes`).toEqual([])
  expect(inside, `${where}: the inside is gold when and only when the questions are answered and the size allows it`).toEqual([])
  expect(small, `${where}: at rs 2.4 px or less the centre is the orb's own colour`).toEqual([])
}

for (const vp of [{ width: 1440, height: 900, touch: false, dpr: 2 }, { width: 390, height: 631, touch: true, dpr: 3 }]) {
  test.describe(`the map's gold ${vp.width}x${vp.height}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch, isMobile: vp.touch, deviceScaleFactor: vp.dpr })

    test(`by the ink: the orb's own colour in every state at every size; gold outside with a Yes, inside with the questions answered (${vp.width})`, async ({ page }) => {
      test.setTimeout(240_000)
      const j = journey(page)
      await j.boot("/")
      await j.land("Mount Top")
      const r = await shoot(page)
      console.log(`[map-gold] ${vp.width}: ${r.specimens.length} specimens, ${r.out.length} sizes, dpr ${r.dpr}`)
      judge(r, `${vp.width}`)
    })
  })
}
