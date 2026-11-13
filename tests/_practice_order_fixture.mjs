// WHAT IS WORTH MOST: THE SHARED SEEDED PLAYER (v1.274.0, U171 a) — read by e2e/journeys/practice-order.spec.ts and the
// owner's pictures (tests/artifacts/_order_shoot.mjs), so the journey and the pictures show one player. Not a test file:
// `node --test tests/*.test.mjs` does not collect it.
//
// Chosen from a payload directory by rule, never by a typed key, so content edits move it without breaking it:
//   heavy  the 4 position decks whose cards the gi game weighs most (a deck's weight over its card count, with 5 unshared
//          cards): 3 cards each missed yesterday (due today,
//          interval 1, no stage: what you are closest to forgetting), plus 2 answered yesterday at interval 7 (not due)
//   light  the 4 whose cards it weighs least (above nothing): 3 cards each a month and more overdue, answered 60 days ago at 7
// Oldest first asks the light decks first; worth asks the heavy positions first.
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { ngKnowledgeQuestionHash } from "../neural/src/knowledge-profile.src.js";
import { ngWireScoreWeights } from "../neural/src/wire-keys.src.js";

export const ORDER_DAY = 20770;

export function orderFixture(dir, day = ORDER_DAY) {
  const j = (f) => JSON.parse(readFileSync(resolve(dir, f), "utf8"));
  const wire = j("graph-data.json"), curriculum = j("curriculum.json"), manifest = j("flashcards/_index.json");
  const w = ngWireScoreWeights(curriculum, "gi", wire.nodes).w;
  const cards = {};
  for (const f of readdirSync(resolve(dir, "flashcards")).sort()) if (f !== "_index.json") Object.assign(cards, JSON.parse(readFileSync(resolve(dir, "flashcards", f), "utf8")));
  const shared = new Set(Object.keys(manifest.shared || {}));
  const own = (dk) => (cards[dk] ? cards[dk].cards : []).map((c) => ngKnowledgeQuestionHash(c.q)).filter((q) => !shared.has(q));
  // by what ONE card weighs (the deck's weight over its cards: the rating's unit, what the order prices a card at)
  const unit = (k) => w[k] / cards[k].cards.length;
  const seats = Object.keys(w).filter((k) => /\|(Top|Bottom)$/.test(k) && w[k] > 0 && own(k).length >= 5)
    .sort((a, b) => unit(b) - unit(a) || (a < b ? -1 : 1));
  const heavy = seats.slice(0, 4), light = seats.slice(-4);
  const srs = {}, stage = {};
  for (const dk of heavy) {
    const q = own(dk); srs[dk] = {}; stage[dk] = {};
    q.slice(0, 3).forEach((h) => { srs[dk][h] = [day, 1, day - 1]; stage[dk][h] = 0; });
    q.slice(3, 5).forEach((h) => { srs[dk][h] = [day + 6, 7, day - 1]; stage[dk][h] = 2; });
  }
  for (const dk of light) {
    const q = own(dk); srs[dk] = {}; stage[dk] = {};
    q.slice(0, 3).forEach((h) => { srs[dk][h] = [day - 53, 7, day - 60]; stage[dk][h] = 1; });
  }
  return { day, heavy, light, blob: { v: 2, srs, stage } };
}
