import { ngWireDeckName } from "./wire-keys.src.js";

// THE OVERVIEW'S SITE MIX (the owner's 2026-10-15 decision, Q3 of the mastery gold: always mix the overview), the lazy chunk
// `mastery-gold.js`: a merged pair's site paints the two halves' pigments averaged (by WEIGHT, before the palette, never
// final RGB), on the domColor endpoints grey, blue and red. The opt-in recolour that also lived here ("Turn what you know
// gold": each half's colour moved toward gold by its own deck's mastery, through green and orange) was RETIRED in v1.280.0
// (GOLD1, ruled): the map's gold is the outlines in the eager app (NG_MAP_MARKS), always shown, and the orb keeps its own
// colour. What stayed is exactly what painted with the switch Off: with the gold weight always 0, its pigment and the two
// blue/gold and red/gold cross terms only ever added 0, so the site colours are the same numbers.
export const NG_GOLD_PIGMENTS = [
  { r: 142, g: 142, b: 148 }, { r: 64, g: 132, b: 255 },
  { r: 232, g: 64, b: 64 },
];
export function ngGoldWeights(strength) {
  const d = Math.max(-1, Math.min(1, strength));
  return [1 - Math.abs(d), Math.max(d, 0), Math.max(-d, 0)];
}
export function ngGoldColor(w) {
  const c = { r: 0, g: 0, b: 0 }, p = NG_GOLD_PIGMENTS;
  for (const k of ["r", "g", "b"]) for (let i = 0; i < 3; i++) c[k] += w[i] * p[i][k];
  return c;
}
export function ngGoldDeckKey(node) {
  const role = { top: "Top", bottom: "Bottom", attacker: "Attacker", defender: "Defender" }[node.role];
  // deckKeyFor/playedRole follow the player's seat at currentPos. Material belongs
  // to the half itself, including the half the player is currently standing on.
  return role ? ngWireDeckName(node) + "|" + role : null;
}
export function ngGoldCache(app) {
  // Cache the entire graph, including hidden ruleset members: draw's existing mask remains the visibility authority. Each
  // half paints its own base colour (the objects themselves, byte-identical); a pair's site, the averaged pigment weights.
  const nodes = app.nodes;
  const weights = [];
  const cache = nodes.map(node => {
    weights[node.idx] = ngGoldWeights(node.dom);
    return { key: ngGoldDeckKey(node), halfPaint: node.col, lowerPaint: node.colU || node.col, sitePaint: node.col };
  });
  for (const node of nodes) {
    if (node.pi < 0 || !node.rep) continue;
    const a = weights[node.idx], b = weights[node.pi];
    const site = ngGoldColor(a.map((v, i) => (v + b[i]) / 2));
    cache[node.idx].sitePaint = cache[node.pi].sitePaint = site;
  }
  return cache;
}
