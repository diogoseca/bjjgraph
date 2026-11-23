// THE LIGHT (L2b S1, v1.295.0): the map shows where. The owner, 17 Nov 2026 (U202 a): "The list is where you answer; the
// map shows where." His phone rules of 13 and 14 Nov: a spotlight no stronger than half of direction B (U173 d: "i liked
// the spotlight/dimming a little then restores after the necessary thing but not as much as B maybe at most 50% of that
// effect"), and, on what stands clear of it (U175): "the nodes connected to or outbound from this node should stand clear
// alongside the names, the goal dots, the pair, its line".
// Design round 6 settled the strength (one layer of rgb(7, 8, 16) at 40%: half of B's 80%, within two points of the D he
// had chosen) and his rule as drawn (design/practice-r6/REPORT-7-his-rule.md: near, a soft hole with a faint halo; far
// out, the node drawn again above the layer as a small mark). The orchestrator's ruling on L2b Part A (c), 19 Nov: as
// recommended, all five points (reports/mapshows.md, section 3 c).
//
// WHAT IT DRAWS, over the map's lines and orbs and under every name (`draw()` calls it after the pulse head, before the
// first name is written, so no name is ever dimmed and none needs a hole):
//   - one layer, rgb(7, 8, 16), at 40% of the light's strength `k`;
//   - the place's pair, each orb in a soft hole (`NG_LIGHT.holeK` times its drawn half-width, `holeMin` px at least) with a
//     faint halo round the orb;
//   - every move the place deals in this ruleset, the same while it is drawn `markBelow` px wide or more; narrower than
//     that a hole would light the cloud round it, so it is drawn again above the layer as a mark `markR` px in radius:
//     gold only where the map's own outside line is gold now and the move's card is not face down, else pale.
// THE SOFT EDGE, AND WHY CLIPS: the layer is laid as two fills, each with every hole cut out by one even-odd clip apiece,
// the inner fill's holes at the hole's radius and the outer's at `soft` times it; the two alphas compose to the layer's
// (`ngLightAlpha`). Cut by clips, holes that overlap stay clear where they overlap: one even-odd path with every hole in it
// FILLS the overlap of two holes again (inside three shapes is odd), and the position's moves overlap at every zoom the
// look uses. A second canvas was measured on 16 Nov at +5 ms a frame at dpr 1 and +13 at dpr 2 (reports/mapasks.md, Part
// 5): out.
// What decides WHAT is lit, and when, is the app's (`_lightOf`, `_drawLight` in app.src.jsx): nothing is stored here.
// Pure where it can be (`ngLightPlan`, `ngLightAlpha`: tests/map_light.test.mjs); the draw is pinned by the ink,
// e2e/journeys/map-light.spec.ts.

export const NG_LIGHT = {
  rgb: [7, 8, 16],   // the layer's colour (design round 6)
  a: 0.4,            // its strength at full light: half of direction B's 0.8
  holeK: 2.4,        // a hole's radius, times the orb's drawn half-width…
  holeMin: 12,       // …and never under this many px
  soft: 1.35,        // the outer fill's holes, times the hole's radius: the soft band between
  markBelow: 2.5,    // an orb drawn narrower than this (px) is a mark above the layer, not a hole
  markR: 2,          // a mark's radius (px): a 4 px dot, design 7's far rule
  halo: 0.1,         // the halo's alpha at the orb's edge, fading to nothing at the hole's radius
};
const NG_LIGHT_GOLD = "240,192,90", NG_LIGHT_PALE = "214,222,240", NG_LIGHT_HALO = "200,215,255";

/**
 * WHICH LIT NODE IS A HOLE AND WHICH A MARK. `pts`: one per lit node on screen, `{i, x, y, hw, place, gold, down}`: its
 * screen point, its drawn half-width in px, whether it is the place (an orb of the pair), whether the map's own outside
 * line is gold on it, whether its card is face down. The place is always a hole, at any size.
 */
export function ngLightPlan(pts) {
  const holes = [], marks = [];
  for (const p of pts) {
    if (p.place || 2 * p.hw >= NG_LIGHT.markBelow) holes.push({ i: p.i, x: p.x, y: p.y, hw: p.hw, r: Math.max(NG_LIGHT.holeMin, NG_LIGHT.holeK * p.hw), place: !!p.place });
    else marks.push({ i: p.i, x: p.x, y: p.y, gold: !!p.gold && !p.down });
  }
  return { holes, marks };
}
// the alpha of each of the two fills: laid one over the other they are the layer's own `a * k`, (1 - f)^2 = 1 - a k
export function ngLightAlpha(k) { return 1 - Math.sqrt(1 - NG_LIGHT.a * Math.max(0, Math.min(1, k))); }

/**
 * DRAW THE LIGHT on the map's context, in screen px. `F` is the frame's own (`draw()`): `k` the light's strength (0 to 1,
 * the fade), `place` the lit place's node, `moves` the indexes of the moves it deals, and the frame's camera and lift:
 * `scale`, `nodeK`, `kLOD`, `LY`, `ox`, `oy` (the frame's own offset, so a hole sits exactly on the orb as drawn), `W`,
 * `H`, `dpr`, `gold` (the map's outside-gold set, `_movesGold`) and `face` (the face-down set the marks ask, `_hmDownSet`).
 * Returns what it drew, which the app publishes as `_lastLight`.
 */
export function ngLightDraw(app, ctx, F) {
  const { k, place, moves, scale, nodeK, kLOD, LY, ox, oy, W, H, dpr, gold, face } = F;
  const pts = [], seen = new Set();
  const add = (n, isPlace) => {
    if (!n || seen.has(n.idx)) return;
    seen.add(n.idx);
    // the orb as drawn: through the frame's lift (`LY`, never `n.y`: CLAUDE.md 6.2) and its bare silhouette (`_nodeHalfW`)
    const x = n.x * scale + ox, y = LY(n) * scale + oy, hw = app._nodeHalfW(n, scale, nodeK, kLOD, true);
    if (x < -60 || x > W + 60 || y < -60 || y > H + 60) return;
    pts.push({ i: n.idx, x, y, hw, place: isPlace, gold: !!gold && gold.has(n.idx) && n.role !== "defender", down: !!face && face.has(n.idx) });
  };
  add(place, true);
  if (place.pi >= 0) add(app.nodes[place.pi], true);
  for (const i of moves || []) add(app.nodes[i], false);
  const P = ngLightPlan(pts), f = ngLightAlpha(k), [r, g, b] = NG_LIGHT.rgb;
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  for (const s of [1, NG_LIGHT.soft]) {
    ctx.save();
    for (const h of P.holes) {
      ctx.beginPath(); ctx.rect(-2, -2, W + 4, H + 4);
      ctx.moveTo(h.x + h.r * s, h.y); ctx.arc(h.x, h.y, h.r * s, 0, 6.2832);
      ctx.clip("evenodd");
    }
    ctx.fillStyle = "rgba(" + r + "," + g + "," + b + "," + f + ")";
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  for (const h of P.holes) {
    const gr = ctx.createRadialGradient(h.x, h.y, h.hw, h.x, h.y, h.r);
    gr.addColorStop(0, "rgba(" + NG_LIGHT_HALO + "," + NG_LIGHT.halo * k + ")"); gr.addColorStop(1, "rgba(" + NG_LIGHT_HALO + ",0)");
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, 6.2832); ctx.arc(h.x, h.y, h.hw, 0, 6.2832, true); ctx.fill();
  }
  for (const m of P.marks) {
    ctx.fillStyle = "rgba(" + (m.gold ? NG_LIGHT_GOLD + "," + 0.95 * k : NG_LIGHT_PALE + "," + 0.85 * k) + ")";
    ctx.beginPath(); ctx.arc(m.x, m.y, NG_LIGHT.markR, 0, 6.2832); ctx.fill();
  }
  ctx.restore();
  return { k, place: place.idx, holes: P.holes.map((h) => ({ i: h.i, x: h.x, y: h.y, r: h.r, hw: h.hw, place: h.place })), marks: P.marks };
}
