// THE RATING'S SHARED FIXTURE (v1.269.0) — read by tests/rating.test.mjs and e2e/journeys/rating-reader.spec.ts, so
// the number a built page prints for the seeded record and the number the unit computes come from ONE record and ONE
// construction of the app. Not a test file: `node --test tests/*.test.mjs` does not collect it.
//
// `ratingApp(dir, frame)` builds the app class the census way (tests/_census.mjs) from a payload directory, then hands
// it the deck manifest and the curriculum the way boot does (`_ingestDeckManifest`, `curriculum`). The unit passes this
// worktree's emit (source/quartz/static/neural); the journey passes the directory its page is SERVED from
// (source/public/static/neural), so a page built from a different wire or a stale bundle cannot agree by accident.
//
// `ratingFixture(dir)` is a stored record (`srs`, `stage`, `moves`, the v2 blob's own fields) chosen from that wire by
// rule, never by hand-typed key, so content edits move it without breaking it. Every kind of row the reader must read
// or refuse is in it, each named in `parts` so a test can find it again:
//   shared    four questions the manifest lists in several decks: a row in each deck, the stage in the first only
//   sharedUnsure  one more, interval 1, its stage (1) in its SECOND deck only (the stage is the highest of its decks)
//   own       five unshared questions of one seat deck: fresh, on its due day, two intervals overdue, a miss, a future `last`
//   giOnly    a question of a technique deck that no-gi does not weigh (priced in gi, `outside` in no-gi)
//   unknown   a row in a deck the manifest does not have · bad: a row with interval 0 · stageOnly: a stage, no schedule
//   moves     Mount Top: two moves dealt in both rulesets answered Yes, one answered No, a move no seat deals there,
//             and an escape
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { knowledgeSource } from "./_knowledge_profile_harness.mjs";
import { ngKnowledgeQuestionHash } from "../neural/src/knowledge-profile.src.js";
import { ngWireDecks, ngWireScoreWeights } from "../neural/src/wire-keys.src.js";

const SRC = new URL("../neural/src/app.src.jsx", import.meta.url);
export const RATING_DAY = 20400;

function readDir(dir) {
  const j = (f) => JSON.parse(readFileSync(resolve(dir, f), "utf8"));
  return { wire: j("graph-data.json"), curriculum: j("curriculum.json"), manifest: j("flashcards/_index.json") };
}

/** The app class, built the census way, with this payload's manifest and curriculum in. */
export function ratingApp(dir, frame = "gi") {
  const { wire, curriculum, manifest } = readDir(dir);
  const Component = new Function("DCLogic", "React", `${knowledgeSource}\n${readFileSync(SRC, "utf8")}\nreturn Component;`)(
    class DCLogic {}, { createRef: () => ({ current: null }) });
  const a = Object.create(Component.prototype);
  a.settings = {}; a.beats = []; a.track = () => {}; a.get = (_k, d) => d; a.set = () => {};
  a._saves = 0; a._saveProgress = () => { a._saves++; };
  a.ingest(JSON.parse(JSON.stringify(wire)));
  a._giMode = frame;
  a.curriculum = curriculum;
  a._ingestDeckManifest(JSON.parse(JSON.stringify(manifest)));
  a.srs = {}; a.stage = {}; a.moves = {};
  a._epochDay = () => RATING_DAY;
  return a;
}

/** The seeded record, from this payload, by rule. */
export function ratingFixture(dir) {
  const { wire, curriculum, manifest } = readDir(dir);
  const D = RATING_DAY;
  const decks = ngWireDecks(manifest, wire.nodes).decks, keys = Object.keys(decks);
  const gi = ngWireScoreWeights(curriculum, "gi", wire.nodes).w, nogi = ngWireScoreWeights(curriculum, "nogi", wire.nodes).w;
  const cards = {};
  for (const f of readdirSync(resolve(dir, "flashcards")).sort()) if (f !== "_index.json") Object.assign(cards, JSON.parse(readFileSync(resolve(dir, "flashcards", f), "utf8")));
  const sharedQ = Object.keys(manifest.shared || {}).sort()
    .map((qh) => [qh, [...new Set(manifest.shared[qh].map((i) => keys[i]).filter(Boolean))]])
    .filter(([, l]) => l.length > 1 && l.every((k) => gi[k] > 0 && nogi[k] > 0));
  const isShared = new Set(Object.keys(manifest.shared || {}));
  const own = (dk, n) => (cards[dk] ? cards[dk].cards : []).map((c) => ngKnowledgeQuestionHash(c.q)).filter((qh) => !isShared.has(qh)).slice(0, n);
  const giOnlyDeck = keys.filter((k) => k.endsWith("|Attacker") && gi[k] > 0 && !(k in nogi) && cards[k]).sort()[0];
  const srs = {}, stage = {}, moves = {};
  const put = (m, dk, qh, v) => { (m[dk] = m[dk] || {})[qh] = v; };
  // a seat deck of its own: the first (by name) a position seat that both rulesets weigh, with five unshared questions
  // (Mount's own cards are all shared with its variants, so no seat is named here)
  const ownDeck = keys.filter((k) => /\|(Top|Bottom)$/.test(k) && gi[k] > 0 && nogi[k] > 0 && own(k, 5).length === 5).sort()[0];
  const parts = { shared: sharedQ.slice(0, 4), sharedUnsure: sharedQ[4], ownDeck, own: own(ownDeck, 5), giOnly: [giOnlyDeck, own(giOnlyDeck, 1)[0]] };
  for (const [qh, list] of parts.shared) { for (const dk of list) put(srs, dk, qh, [D + 20, 30, D - 10]); put(stage, list[0], qh, 3); }
  { const [qh, list] = parts.sharedUnsure; for (const dk of list) put(srs, dk, qh, [D, 1, D - 1]); put(stage, list[1], qh, 1); }
  const [o1, o2, o3, o4, o5] = parts.own;
  put(srs, ownDeck, o1, [D + 7, 7, D]);          put(stage, ownDeck, o1, 4);   // fresh: 1
  put(srs, ownDeck, o2, [D, 14, D - 14]);        put(stage, ownDeck, o2, 3);   // due today: 0.9
  put(srs, ownDeck, o3, [D - 120, 60, D - 180]); put(stage, ownDeck, o3, 4);   // two intervals overdue: 0.9^3
  put(srs, ownDeck, o4, [D + 1, 1, D]);          put(stage, ownDeck, o4, 0);   // a miss: 0
  put(srs, ownDeck, o5, [D + 5, 3, D + 2]);      put(stage, ownDeck, o5, 2);   // a clock ahead: read as fresh
  put(srs, giOnlyDeck, parts.giOnly[1], [D + 30, 30, D]); put(stage, giOnlyDeck, parts.giOnly[1], 3);
  put(srs, "No Such Deck|Top", "00000000", [D + 3, 3, D]);
  put(srs, ownDeck, "0badc0de", [D, 0, D]);
  put(stage, ownDeck, "5ca1ab1e", 2);
  // moves: Mount Top's dealt hand in BOTH rulesets, first three in deal order
  const aGi = ratingApp(dir, "gi"), aNo = ratingApp(dir, "nogi");
  const mount = aGi.nodes.find((n) => n.id === "Positions/Mount" && n.ty === "positions");
  const st = aGi._ordById.get(aGi.siteIdOf(mount.id)) + "/top";
  const dGi = aGi._dealtOrds(mount.idx, "top"), dNo = new Set(aNo._dealtOrds(mount.idx, "top"));
  const both = dGi.filter((o) => dNo.has(o));
  parts.moves = { seat: st, yes: both.slice(0, 2), no: both[2] };
  moves[st] = { [both[0]]: [D + 4, 7, D - 3, 1], [both[1]]: [D + 1, 3, D - 2, 1], [both[2]]: [D + 1, 1, D, 0],
    "999999": [D + 3, 3, D, 1], e1234abcd: [D + 3, 3, D, 1] };
  return { day: D, blob: { v: 2, srs, stage, moves }, parts };
}
