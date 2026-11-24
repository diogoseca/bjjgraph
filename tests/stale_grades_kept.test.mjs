// CARD1-S0 (v1.301.5; the orchestrator's ruling on CARD1, and CARD1-S0-R1 on the sync reader's read of PR #468): A GRADE IS NEVER
// DELETED, AND NOTHING A PLAYER SEES CHANGES.
//
// When a deck lands, `_pruneStaleGrades` used to delete the grade of every question the deck no longer holds (a reworded or
// retired card). It now MARKS it gone and keeps it in `stage` (synced), for CARD1's recovery (slice 3) and so no build can
// lose a re-keyed grade to an older build's prune (slice 2). The readers that sum `stage` by its keys skip a marked row.
// THE MARKER IS THE BROWSER'S (R1): kept beside `<owner>:device` (host `goneRead`/`goneWrite`), never in the record, never
// merged, pushed or joined. Each "device" below is a host with its own store, so a reboot reads its own marks back and
// another device starts with none.
//
// THE DIFFERENTIAL: one player, and its PRUNED TWIN (the same record with those grades deleted: exactly what dev's prune
// leaves). The same reader code reads both, so every number equal means the marker reads as the deletion did:
//   · after the deck lands, and after a REBOOT on the same device with the deck NOT loaded and no live set: deckMastery,
//     the deck glyph, `recallCount`, `masteredDeckCount`, gameScore, the due count;
//   · the record after the landing holds the grades and NO marker; a player with no stale grade writes dev's record;
//   · a sync in both orders: the marker never travels; a device that never loaded the deck reads, after the sync, exactly
//     what it read before it (dev's numbers, never lower: the reader's 95 of 100); the one accepted difference (ruling 2)
//     reads as the twin's settled number, and equal again after the next landing;
//   · a record that already carries a synced `stageGone` (the preview's, from this PR's first builds) is ignored and kept;
//   · the guest's practice key ignores it; a partial deck (the chunk-count guard) marks nothing; a second landing writes
//     nothing; `__proto__` / `constructor` keys are refused; the rating's diagnostic `stageOnly` skips a marked grade;
//   · a marked question live again is unmarked and counts (in the player's favour).
// MUTANTS (each red here): the prune deletes again; `deckMastery` or `recallCount` does not skip a marked grade; the marker
// written into the record again; the marker not read back on a reboot; the chunk-count guard removed; the unsafe-key
// guard removed; `stageOnly` not skipping.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ngProgressPracticeKey, ngProgressGoneParse } from "../neural/src/progress-owner.src.js";
import { ngRatingShare } from "../neural/src/rating.src.js";
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

/** a device: this browser's store for the marker, behind the host's two methods (counted, for "a second landing writes nothing") */
const device = () => { const d = { marks: null, writes: 0 }; d.host = { goneRead: () => clone(d.marks || {}), goneWrite: (_i, m) => { d.writes++; d.marks = Object.keys(m).length ? clone(m) : null; return true; } }; return d; };
/** the app on the real wire (manifest, curriculum), loaded from `blob` by its own load, on `dev`ice; `live`: the live set in hand */
function boot(blob, { live = false, dev = device() } = {}) {
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
  a._progressHost = dev.host; a._progressOwner = { kind: "guest" }; a.__dev = dev;
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

test("CARD1-S0: the deck lands: the grades are kept, marked on the DEVICE, never in the record; every number as the twin's", () => {
  const a = boot(record()), t = boot(twinOf(record()));
  land(a, D); land(t, D);
  for (const qh of stale) assert.ok(qh in a.stage[D], "the stale grade is kept in stage");
  assert.deepEqual(Object.keys(a.__dev.marks[D]).sort(), stale.slice().sort(), "marked gone on this device");
  const saved = a._progressBlob();
  assert.deepEqual(Object.keys(saved.stage[D]).sort(), [...live, ...stale].sort(), "the stored record still holds them");
  assert.equal("stageGone" in saved, false, "and no marker: it is the device's");
  assert.deepEqual(seen(a), seen(t), "every number, as the pruned twin's");
});

test("CARD1-S0: a REBOOT on the same device, the deck not loaded and no live set: every number as the twin's", () => {
  const dev = device(), a = boot(record(), { dev }), t = boot(twinOf(record()));
  land(a, D); land(t, D);
  const A = boot(a._progressBlob(), { dev }), T = boot(t._progressBlob());
  assert.equal(A.flashcards.decks[D].cards, undefined, "premise: the deck is not loaded");
  assert.equal(A._ratingLiveNow(), undefined, "premise: no live set");
  const sa = seen(A);
  assert.deepEqual(sa, seen(T), "every number, as the pruned twin's (the marker read back from the device)");
  assert.ok(sa.mastery > 0 && sa.recall >= 2, "premise: the live grades count");
});

test("CARD1-S0: a player with no stale grade writes the same record as dev, and no marker", () => {
  const r = twinOf(record()), a = boot(r), t = boot(r);
  land(a, D);
  assert.equal(a.__dev.writes, 0, "no marker written");
  assert.deepEqual(a._progressBlob().stage, t._progressBlob().stage, "the same stage");
});

test("CARD1-S0-R1: a sync in both orders: the marker never travels, and a device that never loaded the deck reads as before", () => {
  const a = boot(record()); land(a, D);
  const mine = a._progressBlob();
  // B: another device, its own record (the same grades, never pruned: what dev's B holds too), never loaded the deck
  const before = seen(boot(record()));
  for (const [local, incoming] of [[record(), mine], [mine, record()]]) {
    const merged = a._mergeProgressBlobs(clone({ v: 2, belts: { won: {} }, ...local }), clone({ v: 2, belts: { won: {} }, ...incoming }));
    assert.equal("stageGone" in merged, false, "the merged record carries no marker");
    for (const qh of stale) assert.ok(qh in merged.stage[D], "the grades survive the merge");
    assert.deepEqual(seen(boot(merged)), before, "a device that never loaded the deck reads what it read before the sync: never lower");
  }
  assert.deepEqual(Object.keys(a.__dev.marks[D]).sort(), stale.slice().sort(), "A's own marks stay on A");
});

test("CARD1-S0-R1, ruling 2: a device that landed, pulling a copy that still holds the grades, reads the twin's settled number", () => {
  const dev = device(), a = boot(record(), { dev }), t = boot(twinOf(record()));
  land(a, D); land(t, D);
  const merged = a._mergeProgressBlobs(a._progressBlob(), clone({ v: 2, belts: { won: {} }, ...record() }));
  const A = boot(merged, { dev });
  assert.deepEqual(seen(A), seen(boot(t._progressBlob())), "hidden here (dev would count them until its next landing)");
  land(A, D);
  assert.deepEqual(seen(A), seen(t), "and equal after the next landing");
});

test("CARD1-S0-R1: a record that already carries a synced `stageGone` is ignored and kept; the practice key ignores it", () => {
  const legacy = { ...record(), stageGone: { [D]: Object.fromEntries(stale.map((qh) => [qh, 1])) } };
  const L = boot(legacy), P = boot(record());
  assert.deepEqual(seen(L), seen(P), "ignored: it reads as the same record without it");
  assert.deepEqual(L._progressBlob().stageGone, legacy.stageGone, "and kept as it was, not deleted by us");
  assert.equal(L.__dev.writes, 0, "nothing written to the device");
  assert.equal(ngProgressPracticeKey({ v: 2, ...legacy }), ngProgressPracticeKey({ v: 2, ...record() }), "the practice key ignores it");
});

test("CARD1-S0-R1: a partial deck (the chunk-count guard) marks nothing; a second landing writes nothing", () => {
  const a = boot(record());
  const d = a.flashcards.decks[D], part = CARDS[D].cards.slice(0, -1);
  assert.ok(d.n > part.length, "premise: the chunk is short of the manifest's count");
  d.cards = part; a._pruneStaleGrades(D, part);
  assert.equal(a.__dev.writes, 0, "a truncated chunk marks nothing");
  assert.equal(a.__dev.marks, null);
  d.cards = undefined; land(a, D);
  assert.equal(a.__dev.writes, 1, "the full chunk marks once");
  land(a, D);
  assert.equal(a.__dev.writes, 1, "the same deck again writes nothing");
});

test("CARD1-S0-R1: the marker's reader refuses `__proto__`, `constructor` and `prototype` at either level", () => {
  const raw = '{"__proto__":{"deadbeef":1},"constructor":{"deadbeef":1},"' + D + '":{"__proto__":1,"prototype":1,"deadbeef":1,"zz":1,"1234abcd":0}}';
  assert.deepEqual(ngProgressGoneParse(raw), { [D]: { deadbeef: 1 } });
  assert.equal({}.deadbeef, undefined, "no prototype touched");
  assert.deepEqual(ngProgressGoneParse("not json"), {});
});

test("CARD1-S0-R1: the rating's diagnostic `stageOnly` skips a marked grade", () => {
  const a = boot({});
  const U = a._ratingGame("gi"), stage = { [D]: { [stale[0]]: 3, [stale[1]]: 2, [live[0]]: 1 } };
  const without = ngRatingShare(U, { srs: {}, stage }, day, null).counts.stageOnly;
  const withGone = ngRatingShare(U, { srs: {}, stage, gone: { [D]: { [stale[0]]: 1, [stale[1]]: 1 } } }, day, null).counts.stageOnly;
  assert.deepEqual([without, withGone], [3, 1]);
});

test("CARD1-S0: a marked question live again is unmarked and counts", () => {
  const a = boot(record()); land(a, D);
  const back = { q: "a question this deck no longer holds 0", a: "It is back." };
  assert.equal(ngKnowledgeQuestionHash(back.q), stale[0]);
  a.flashcards.decks[D].cards = CARDS[D].cards.concat([back]);
  a.flashcards.decks[D].n = a.flashcards.decks[D].cards.length;
  a._pruneStaleGrades(D, a.flashcards.decks[D].cards);
  assert.equal(!!(a.stageGone[D] && a.stageGone[D][stale[0]]), false, "unmarked");
  assert.equal(a.cardStage(D, back.q), 3, "its grade counts again");
});
