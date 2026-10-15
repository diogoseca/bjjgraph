import { ngWireDeckName } from "./wire-keys.src.js";

// Default site mix and opt-in mastery tint. These are the domColor endpoints and full-mastery
// crown gold. The quadratic Bernstein palette keeps all controls in gamut; only
// blue/gold and red/gold depart from arithmetic midpoints, to read green/orange.
// A site averages pigment WEIGHTS before evaluating the palette, never final RGB.
export const NG_GOLD_PIGMENTS = [
  { r: 142, g: 142, b: 148 }, { r: 64, g: 132, b: 255 },
  { r: 232, g: 64, b: 64 }, { r: 240, g: 192, b: 90 },
];
export function ngGoldWeights(strength, mastery) {
  const d = Math.max(-1, Math.min(1, strength));
  const m = mastery == null ? 0 : Math.max(0, Math.min(1, mastery));
  return [(1 - Math.abs(d)) * (1 - m), Math.max(d, 0) * (1 - m), Math.max(-d, 0) * (1 - m), m];
}
export function ngGoldColor(w) {
  const c = { r: 0, g: 0, b: 0 }, p = NG_GOLD_PIGMENTS;
  const blueGold = { r: 40, g: 190, b: 10 }, redGold = { r: 255, g: 168, b: 24 };
  for (const k of ["r", "g", "b"]) {
    for (let i = 0; i < 4; i++) c[k] += w[i] * p[i][k];
    c[k] += 2 * w[1] * w[3] * (blueGold[k] - (p[1][k] + p[3][k]) / 2);
    c[k] += 2 * w[2] * w[3] * (redGold[k] - (p[2][k] + p[3][k]) / 2);
  }
  return c;
}
export function ngGoldHalf(base, strength, mastery) {
  // No round trip: old fallbacks and floating-point bytes are part of the base.
  return mastery == null || mastery <= 0 ? base : ngGoldColor(ngGoldWeights(strength, mastery));
}
export function ngGoldDeckKey(node) {
  const role = { top: "Top", bottom: "Bottom", attacker: "Attacker", defender: "Defender" }[node.role];
  // deckKeyFor/playedRole follow the player's seat at currentPos. Material belongs
  // to the half itself, including the half the player is currently standing on.
  return role ? ngWireDeckName(node) + "|" + role : null;
}
export function ngGoldCache(app, enabled) {
  // Cache the entire graph, including hidden ruleset members: knowledge is shared
  // across gi/no-gi; draw's existing mask remains the visibility authority.
  const nodes = app.nodes, decks = app.flashcards && app.flashcards.decks || {};
  const weights = [];
  const cache = nodes.map(node => {
    const key = ngGoldDeckKey(node), deck = key && decks[key];
    const mastery = deck && (app._cardsOf(deck)?.length || deck.n || 0) > 0 ? app.deckMastery(key) : null;
    const m = enabled ? mastery : 0;
    const halfPaint = ngGoldHalf(node.col, node.dom, m);
    weights[node.idx] = ngGoldWeights(node.dom, m);
    const lowerPaint = halfPaint === node.col ? node.colU || node.col : node.z < 0
      ? { r: halfPaint.r * .78, g: halfPaint.g * .80, b: halfPaint.b * .86 } : halfPaint;
    return { key, mastery, halfPaint, lowerPaint, sitePaint: halfPaint };
  });
  for (const node of nodes) {
    if (node.pi < 0 || !node.rep) continue;
    const a = weights[node.idx], b = weights[node.pi];
    const site = ngGoldColor(a.map((v, i) => (v + b[i]) / 2));
    cache[node.idx].sitePaint = cache[node.pi].sitePaint = site;
  }
  return cache;
}
