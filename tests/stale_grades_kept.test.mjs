// CARD1-S0 (v1.301.5; the orchestrator's ruling on CARD1): A GRADE IS NEVER DELETED, AND NOTHING A PLAYER SEES CHANGES.
//
// When a deck lands, `_pruneStaleGrades` used to delete the grade of every question the deck no longer holds (a reworded or
// retired card). It now MARKS it gone (`stageGone`) and keeps it in `stage`, for CARD1's recovery (slice 3) and so no build
// can lose a re-keyed grade to an older build's prune (slice 2). The readers that sum `stage` by its keys skip a marked row.
//
// THE DIFFERENTIAL: one player, and its PRUNED TWIN (the same record with those grades deleted: exactly what dev's prune
// leaves). The same reader code reads both, so every number equal means the marker reads as the deletion did:
//   · after the deck lands (its own cards read it), and after a REBOOT from the saved record with the deck NOT loaded and no
//     live set (the case a count-side reading could not hold): deckMastery, the deck glyph, the challenge evidence
//     (`recallCount`, `masteredDeckCount`), gameScore, the due count;
//   · the stored record after the landing still holds the grades, with the marker; a player with no stale grade writes the
//     same record as dev;
//   · a sync round-trip in both orders, against a fake cloud with no marker, keeps the grades and the marker;
//   · the guest's "did you practise?" key reads as the pruned twin's;
//   · a marked question live again is unmarked and counts (the one place a mark differs from a deletion, in the player's
//     favour); a malformed stored marker is dropped, never a reason to refuse the record.
// MUTANTS (each red here): the prune deletes again; `deckMastery`'s unloaded branch does not skip a marked grade;
// `recallCount` does not skip one; the pull merge drops the cloud's marker; the practice key keeps marked grades.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ngProgressPracticeKey } from "../neural/src/progress-owner.src.js";
import { ngKnowledgeQuestionHash } from "../neural/src/knowledge-profile.src.js";
import { knowledgeSource } from "./_knowledge_profile_harness.mjs";
import { ratingLiveFiles } from "./_rating_fixture.mjs";

const DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../source/quartz/static/neural");
const CARDS = (() => {
  const c = {};
  for (const f of readdirSync(resolve(DIR, "flashcards")).sort()) if (f !== "_index.json" && !f.startsWith("live-")) Object.assign(c, JSON.parse(readFileSync(resolve(DIR, "flashcards", f), "utf8")));
  return c;
})();
const clone = (x) => JSON.parse(JSON.stringify(x));

// the app class with what its load, save and merge need (the prelude, progress-owner, the lists and the challenges), as
// tests/belt_row.test.mjs builds it; set up on the real wire as tests/_rating_fixture.mjs's `ratingApp` sets it up
const rd = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const strip = (t) => t.replace(/^export (function|const|let|var|class) /gm, "$1 ");
const { Component } = new Function("DCLogic", "React", [
  knowledgeSource, strip(rd("neural/src/progress-owner.src.js")), strip(rd("neural/src/lists-codec.src.js")), strip(rd("neural/src/lists.src.js")),
  rd("neural/src/challenge-definitions.src.js"), rd("neural/src/challenge-engine.src.js"), rd("neural/src/app.src.jsx"), rd("neural/src/challenge-ui.src.js"),
].join("\n") + "\nreturn { Component };")(class DCLogic {}, { createRef: () => ({ current: null }) });
const J = (f) => JSON.parse(readFileSync(resolve(DIR, f), "utf8"));
const WIRE = J("graph-data.json"), CURRICULUM = J("curriculum.json"), MANIFEST = J("flashcards/_index.json");

/** the app on the real wire (manifest, curriculum), loaded from `blob` by its own load; `live`: the rating's live set in hand */
function boot(blob, { live = false } = {}) {
  const a = Object.create(Component.prototype);
  a.settings = {}; a.beats = []; a.track = () => {}; a.get = (_k, d) => d; a.set = () => {};
  a.ingest(clone(WIRE));
  a._giMode = "gi";
  a.curriculum = clone(CURRICULUM);
  a._ingestDeckManifest(clone(MANIFEST));
  if (live) a._ratingLiveFrom(ratingLiveFiles(DIR));
  Object.assign(a, { _settingsAt: {}, tracked: [], viewToggleRef: { current: null }, explorerListRef: { current: null } });
  a._saveProgress = () => {}; a._flushSave = () => {}; a.renderTutorial = () => {}; a.renderChallengeCue = null;
  a.setEvent = () => {}; a.setDeckOpen = () => {}; a._applyLayers = () => {}; a._gameValueChanged = () => {};
  a._rebuildRulesetMask = () => {}; a.weakSpots = () => null; a._progressCurrent = () => true;
  a._hydrateProgressBlob({ v: 2, belts: { won: {} }, ...clone(blob) });
  a._progressLoaded = true;
  return a;
}
/** the deck lands as `hydrateDeck` lands it: its cards in place, then the prune */
function land(a, key) { const d = a.flashcards.decks[key]; d.cards = CARDS[key].cards; a._pruneStaleGrades(key, d.cards); }

// the deck: one the gi table weighs, with six cards or more; three stale grades (questions it does not hold, proven), and
// three live ones (two proven, one met)
const probe = boot({});
const U = probe._ratingGame("gi");
const D = Object.keys(probe.flashcards.decks).filter((k) => typeof U.deckUnit.get(k) === "number" && CARDS[k] && CARDS[k].cards.length >= 6).sort()[0];
const live = CARDS[D].cards.slice(0, 3).map((c) => ngKnowledgeQuestionHash(c.q));
const stale = [0, 1, 2].map((i) => ngKnowledgeQuestionHash("a question this deck no longer holds " + i));
const day = probe._epochDay();
const record = () => ({
  stage: { [D]: { [live[0]]: 3, [live[1]]: 3, [live[2]]: 1, [stale[0]]: 3, [stale[1]]: 3, [stale[2]]: 2 } },
  srs: { [D]: Object.fromEntries([...live, ...stale].map((qh) => [qh, [day + 9, 9, day - 1]])) },
});
const twinOf = (r) => { const t = clone(r); for (const qh of stale) delete t.stage[D][qh]; return t; };
/** every number a player sees that reads `stage` by its keys, and the due count */
const seen = (a) => {
  const snap = a._challengeSnapshot();
  return { mastery: a.deckMastery(D), glyph: a.seenGlyph(D), recall: snap.recallCount, mastered: snap.masteredDeckCount, score: a.gameScore().score, due: a.dueCount() };
};

test("CARD1-S0 premise: a weighed deck, three live grades, three stale", () => {
  assert.ok(D, "a deck the gi table weighs");
  assert.equal(new Set([...live, ...stale]).size, 6);
  assert.ok(stale.every((qh) => !CARDS[D].cards.some((c) => ngKnowledgeQuestionHash(c.q) === qh)), "the stale questions are not the deck's");
});

test("CARD1-S0: the deck lands: the stale grades are kept and marked, and every number reads as the pruned twin's", () => {
  const a = boot(record()), t = boot(twinOf(record()));
  land(a, D); land(t, D);
  for (const qh of stale) assert.ok(qh in a.stage[D], "the stale grade is kept in stage");
  assert.deepEqual(Object.keys(a.stageGone[D]).sort(), stale.slice().sort(), "and marked gone");
  const saved = a._progressBlob();
  assert.deepEqual(Object.keys(saved.stage[D]).sort(), [...live, ...stale].sort(), "the stored record still holds them");
  assert.deepEqual(saved.stageGone, { [D]: Object.fromEntries(stale.map((qh) => [qh, 1])) }, "with the marker");
  assert.deepEqual(seen(a), seen(t), "every number, as the pruned twin's");
});

test("CARD1-S0: after a REBOOT from the saved record, the deck not loaded and no live set, every number reads as the twin's", () => {
  const a = boot(record()), t = boot(twinOf(record()));
  land(a, D); land(t, D);
  const A = boot(a._progressBlob()), T = boot(t._progressBlob());
  assert.equal(A.flashcards.decks[D].cards, undefined, "premise: the deck is not loaded");
  assert.equal(A._ratingLiveNow(), undefined, "premise: no live set");
  const sa = seen(A), st = seen(T);
  assert.deepEqual(sa, st, "every number, as the pruned twin's (the stub branch skips a marked grade)");
  assert.ok(sa.mastery > 0 && sa.recall >= 2, "premise: the live grades count");
});

test("CARD1-S0: a player with no stale grade writes the same record as dev, with no marker", () => {
  const r = twinOf(record()), a = boot(r), t = boot(r);
  land(a, D);
  const saved = a._progressBlob();
  assert.equal("stageGone" in saved, false, "no marker");
  assert.deepEqual(saved.stage, t._progressBlob().stage, "the same stage");
});

test("CARD1-S0: a sync round-trip in both orders, against a cloud with no marker, keeps the grades and the marker", () => {
  const a = boot(record()); land(a, D);
  const mine = a._progressBlob();
  const cloud = { v: 2, belts: { won: {} }, ...record() };   // another device: the same grades, never loaded the deck
  for (const [local, incoming] of [[mine, cloud], [cloud, mine]]) {
    const merged = a._mergeProgressBlobs(clone(local), clone(incoming));
    for (const qh of stale) assert.ok(qh in merged.stage[D], "the grade survives the merge");
    assert.deepEqual(Object.keys((merged.stageGone || {})[D] || {}).sort(), stale.slice().sort(), "and so does the marker");
    const B = boot(merged);
    assert.deepEqual(seen(B), seen(boot(twinOf(record()))), "and the numbers read as the twin's after the round trip");
  }
});

test("CARD1-S0: the guest's practice key reads a marked grade as the deletion did", () => {
  const a = boot(record()), t = boot(twinOf(record()));
  land(a, D); land(t, D);
  assert.equal(ngProgressPracticeKey(a._progressBlob()), ngProgressPracticeKey(t._progressBlob()));
});

test("CARD1-S0: a marked question live again is unmarked and counts; a malformed marker is dropped", () => {
  const a = boot(record()); land(a, D);
  const back = { q: "a question this deck no longer holds 0", a: "It is back." };
  assert.equal(ngKnowledgeQuestionHash(back.q), stale[0]);
  a.flashcards.decks[D].cards = CARDS[D].cards.concat([back]);
  a.flashcards.decks[D].n = a.flashcards.decks[D].cards.length;
  a._pruneStaleGrades(D, a.flashcards.decks[D].cards);
  assert.equal(!!(a.stageGone[D] && a.stageGone[D][stale[0]]), false, "unmarked");
  assert.equal(a.cardStage(D, back.q), 3, "its grade counts again");
  const B = boot({ ...record(), stageGone: { [D]: "x", other: { zz: 1, [stale[1]]: 1 }, list: [1] } });
  assert.deepEqual(B.stageGone, { other: { [stale[1]]: 1 } }, "only the well-formed entry is read");
});
