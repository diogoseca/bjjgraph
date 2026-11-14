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

/** ANKI1-R1, the reader's finding 4: a player whose due cards sit at ONE position, eight of them missed yesterday, so the
 *  law visits it twice (6, then 2) and the page folds the second visit into the first: one position showing all eight.
 *  The position deck the gi game weighs most a card with eight cards of its own (most have eight); chosen by rule, as above. */
export function secondVisitFixture(dir, day = ORDER_DAY) {
  const j = (f) => JSON.parse(readFileSync(resolve(dir, f), "utf8"));
  const wire = j("graph-data.json"), curriculum = j("curriculum.json"), manifest = j("flashcards/_index.json");
  const w = ngWireScoreWeights(curriculum, "gi", wire.nodes).w;
  const cards = {};
  for (const f of readdirSync(resolve(dir, "flashcards")).sort()) if (f !== "_index.json" && !f.startsWith("live-")) Object.assign(cards, JSON.parse(readFileSync(resolve(dir, "flashcards", f), "utf8")));
  const shared = new Set(Object.keys(manifest.shared || {}));
  const own = (dk) => (cards[dk] ? cards[dk].cards : []).map((c) => ngKnowledgeQuestionHash(c.q)).filter((q) => !shared.has(q));
  const unit = (k) => w[k] / cards[k].cards.length;
  const deck = Object.keys(w).filter((k) => /\|(Top|Bottom)$/.test(k) && w[k] > 0 && cards[k] && own(k).length >= 8)
    .sort((a, b) => unit(b) - unit(a) || (a < b ? -1 : 1))[0];
  const srs = { [deck]: {} }, stage = { [deck]: {} };
  own(deck).slice(0, 8).forEach((h) => { srs[deck][h] = [day, 1, day - 1]; stage[deck][h] = 0; });
  return { day, deck, blob: { v: 2, srs, stage } };
}

/** STAGE3-R1, the reader's finding 2: the same player, with one owed card of a position the plan asks LATER made the oldest
 *  debt of all, so the cold queue (oldest first) opens on a deck the plan holds after its first position. Chosen by the
 *  planner itself (the app built the census way, `tests/_rating_fixture.mjs`), never by a typed key. */
export async function oldestLaterFixture(dir, day = ORDER_DAY) {
  const { ratingApp } = await import("./_rating_fixture.mjs");
  const G = await import("../neural/src/gameplan.src.js");
  const fx = orderFixture(dir, day), blob = JSON.parse(JSON.stringify(fx.blob));
  const plan = (b) => {
    const a = ratingApp(dir, "gi");
    a._epochDay = () => day; a._dayKey = () => "x"; a._days = {}; a.srs = b.srs; a.stage = b.stage;
    a._gameplanRuntime = G; a.weakSpots = () => ({ cold: true, keys: [], veryWeak: [], weak: [] });
    a._checkKnowledgeDay = () => {}; a.startFrom = () => "standing"; a.fx = () => {};
    return a.planSummary();
  };
  const later = plan(blob).due.find((r) => r.visit >= 1 && r.owed.length);
  if (!later) throw new Error("no owed card after the first position");
  const qh = later.owed[0];
  for (const dk of Object.keys(blob.srs)) if (blob.srs[dk][qh]) blob.srs[dk][qh] = [day - 400, 1, day - 401];
  const p = plan(blob);
  return { day, blob, later: later.key, first: p.queue[0], laterAt: p.queue.indexOf(later.key) };
}

/** STAGE3-R1, the door to everything owed: the same player, plus one owed card in a deck the gi ruleset allows but the gi
 *  table gives no weight (the reader's 38, Buggy Choke and the heel hooks among them): the order never asks it, the door must. */
export async function unpricedOwedFixture(dir, day = ORDER_DAY) {
  const { ratingApp } = await import("./_rating_fixture.mjs");
  const fx = orderFixture(dir, day), blob = JSON.parse(JSON.stringify(fx.blob));
  const a = ratingApp(dir, "gi"), W = a.scoreWeights("gi");
  const cards = {};
  for (const f of readdirSync(resolve(dir, "flashcards")).sort()) if (f !== "_index.json") Object.assign(cards, JSON.parse(readFileSync(resolve(dir, "flashcards", f), "utf8")));
  const deck = Object.keys(a.flashcards.decks).filter((k) => !(k in W) && cards[k] && cards[k].cards.length && (() => { const i = a.nodeForKey(k); return i >= 0 && a.rsAllowsIdx(i); })()).sort()[0];
  if (!deck) throw new Error("no deck allowed in gi without a gi weight");
  const qh = ngKnowledgeQuestionHash(cards[deck].cards[0].q);
  blob.srs[deck] = { [qh]: [day - 2, 3, day - 5] }; blob.stage[deck] = { [qh]: 1 };
  return { ...fx, blob, unpriced: deck };
}
