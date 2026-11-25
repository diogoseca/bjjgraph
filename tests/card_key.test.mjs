// CARD1-S2 (v1.303.0; the owner's U220 a, "a short unique hash key"): A CARD KEEPS ITS KEY.
//
// A card's progress (its grade `stage`, its schedule `srs`, the undelivered-answer journal, its place among the decks that
// share it) is filed under its KEY: `k` when the wire carries one, else the FNV-1a of its question. The emitter writes `k`
// only for a card whose authored `id` differs from its question's hash: a card whose question was reworded, keeping the
// key of the text it replaced. No content file carries an id yet, so every key is the text's hash, as before (proved on the
// whole corpus in the PR: the wire byte-identical, and 100 seeded records read and written identically).
//   1. ONE RULE, THREE PLACES: the app's `cardKey`, the knowledge law's `ngKnowledgeCardKey` and the emitter's `_card_key`
//      give every card the same key (real cards from the wire, and cards with a `k`).
//   2. PROOF 2: a shared card graded on its old text, then reworded on the wire WITH its key: on this build it keeps its
//      grade, its schedule, its due state, its answer mode and its place in the shared group; the deck's mastery is
//      unchanged; the prune marks nothing; its next grade files under the key in every deck sharing it, never under the new
//      text's hash. THE CONTROL: the same rewording WITHOUT a key loses all of it (the card reads as new; today's reset).
//   3. The emitter half (tests/card_key_emitter.py): graph.json carries the id, `k` only when it differs, the shared index
//      and the live files by the card key, a key two questions share in one deck refused.
// MUTANTS (each red here): `cardKey` ignoring `k` → 1, 2; the law's `ngKnowledgeCardKey` ignoring `k` → 1, 2 (the grade
// files under the new text); `_sharedDecksFor` by the text again → 2; the prune's live set by the text again → 2; the
// law's shared lookup by the text again → 2 (the other deck's schedule does not move).
// CARD1-S2-R1 (the PR #469 read, F3: four sites its mutants got past): `_rowLive` by the text → 2b (a card of one deck
// leaves the due pool; a shared card is read from the manifest's index, so 2 cannot see it); the planner's `questions` by
// the text (`_gameplanDecks`) → 2, 2b; `noteCardDone`'s latch by the text → 2 (a second day count and shared prep).
// NOT PINNED, ON PURPOSE: `_mcWarmKey` by the text. Its writer and its reader are that one function, the warm cache is per
// tab and never stored, and within one deck a text and a key name the same card (the emitter refuses two texts under one
// key in a deck): no reading can tell the two apart.
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { ngKnowledgeQuestionHash, ngKnowledgeCardKey } from "../neural/src/knowledge-profile.src.js";
import { knowledgeSource } from "./_knowledge_profile_harness.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = resolve(ROOT, "source/quartz/static/neural");
const CARDS = (() => {
  const c = {};
  for (const f of readdirSync(resolve(DIR, "flashcards")).sort()) if (f !== "_index.json" && !f.startsWith("live-")) Object.assign(c, JSON.parse(readFileSync(resolve(DIR, "flashcards", f), "utf8")));
  return c;
})();
const clone = (x) => JSON.parse(JSON.stringify(x));
const rd = (p) => readFileSync(resolve(ROOT, p), "utf8");
const strip = (t) => t.replace(/^export (function|const|let|var|class) /gm, "$1 ");
const { Component } = new Function("DCLogic", "React", [
  knowledgeSource, strip(rd("neural/src/progress-owner.src.js")), strip(rd("neural/src/lists-codec.src.js")), strip(rd("neural/src/lists.src.js")),
  rd("neural/src/challenge-definitions.src.js"), rd("neural/src/challenge-engine.src.js"), rd("neural/src/app.src.jsx"), rd("neural/src/challenge-ui.src.js"),
].join("\n") + "\nreturn { Component };")(class DCLogic {}, { createRef: () => ({ current: null }) });
const J = (f) => JSON.parse(readFileSync(resolve(DIR, f), "utf8"));
globalThis.window = globalThis.window || {};
const DAY0 = 20402, LATER = DAY0 + 5;   // graded on one day, reworded and answered on a later one (a same-day answer earns no step)
globalThis.window.__NG_EPOCH_DAY__ = DAY0;
afterEach(() => { globalThis.window.__NG_EPOCH_DAY__ = DAY0; });   // a test that fails midway leaves no later day behind
const WIRE = J("graph-data.json"), CURRICULUM = J("curriculum.json"), MANIFEST = J("flashcards/_index.json");
const H = ngKnowledgeQuestionHash;

/** the app on the real wire, loaded from `blob` by its own load (tests/stale_grades_kept.test.mjs's boot) */
function boot(blob) {
  const a = Object.create(Component.prototype), marks = {};
  a.settings = {}; a.beats = []; a.track = () => {}; a.get = (_k, d) => d; a.set = () => {}; a.fx = () => {};
  a.ingest(clone(WIRE)); a._giMode = "gi"; a.curriculum = clone(CURRICULUM); a._ingestDeckManifest(clone(MANIFEST));
  Object.assign(a, { _settingsAt: {}, tracked: [], viewToggleRef: { current: null }, explorerListRef: { current: null } });
  a._saveProgress = () => {}; a._flushSave = () => {}; a.renderTutorial = () => {}; a.renderChallengeCue = null;
  a.setEvent = () => {}; a.setDeckOpen = () => {}; a._applyLayers = () => {}; a._gameValueChanged = () => {};
  a._rebuildRulesetMask = () => {}; a.weakSpots = () => null; a._progressCurrent = () => true; a._knowledgeEffect = () => {};
  a._journal = (rows) => { (a.__journal = a.__journal || []).push(...clone(rows)); };
  a._progressHost = { goneRead: () => clone(marks), goneWrite: (_i, m, deck) => { if (m[deck]) marks[deck] = clone(m[deck]); else delete marks[deck]; return clone(marks); } };
  a._progressOwner = { kind: "guest" };
  a._hydrateProgressBlob({ v: 2, belts: { won: {} }, ...clone(blob) });
  a._progressLoaded = true;
  return a;
}
/** the deck lands as `hydrateDeck` lands it: its cards (of `wire`) in place, then the prune */
const land = (a, key, wire) => { const d = a.flashcards.decks[key]; d.cards = clone(wire[key].cards); a._pruneStaleGrades(key, d.cards); };

// a card the manifest shares between two decks or more, each with its chunk on the wire
const probe = boot({});
const pickShared = () => {
  for (const A of Object.keys(CARDS).sort()) for (const c of CARDS[A].cards || []) {
    const list = probe._sharedQ && probe._sharedQ.get(H(c.q));
    if (list && list.length > 1 && list.includes(A) && list.every((k) => CARDS[k]) && list.every((k) => CARDS[k].cards.filter((x) => x.q === c.q).length === 1)) return { A, c, decks: list };
  }
  return null;
};
const S = pickShared();
const NEW = "Reworded for the card key: " + (S ? S.c.q.slice(0, 40) : "") + "?";
/** the wire after a rewording of that card in every deck holding it: with its key (`k`, as the emitter writes an id), or bare */
const reworded = (withKey) => {
  const w = clone(CARDS);
  for (const k of S.decks) w[k].cards = w[k].cards.map((x) => (x.q === S.c.q ? { ...x, q: NEW, ...(withKey ? { k: H(S.c.q) } : {}) } : x));
  return w;
};
/** what the card is OWED (the due pool and its count, `_rowLive`, and the planner's questions for its deck) */
const owed = (a, deck, h) => ({ live: a._rowLive(deck, h), pooled: a.duePool().some((e) => e.key === deck && e.qh === h), dueN: a.dueCount(),
  planned: a._gameplanDecks()[deck].questions.includes(h) });

test("one rule in three places: the app's cardKey, the law's ngKnowledgeCardKey and the emitter's _card_key agree", () => {
  const real = Object.keys(CARDS).sort().slice(0, 60).flatMap((k) => CARDS[k].cards.slice(0, 4));
  const keyed = [{ q: NEW, k: "0badc0de" }, { q: NEW, k: H(NEW) }, { q: "Q?", k: "1234abcd" }];
  const cards = [...real, ...keyed];
  assert.ok(real.length > 100, `premise: real cards read (${real.length})`);
  const app = cards.map((c) => probe.cardKey(c)), law = cards.map((c) => ngKnowledgeCardKey(c));
  const py = spawnSync("python3", ["-B", "-c", "import json,sys; sys.path.insert(0,'scripts'); import regenerate_neural_data as N; print(json.dumps([N._card_key(c) for c in json.load(sys.stdin)]))"],
    { cwd: ROOT, input: JSON.stringify(cards), encoding: "utf8" });
  assert.equal(py.status, 0, py.stderr);
  assert.deepEqual(app, law, "the app and the law");
  assert.deepEqual(app, JSON.parse(py.stdout), "the app and the emitter");
  assert.deepEqual(app.slice(real.length), ["0badc0de", H(NEW), "1234abcd"], "a card's k is its key");
  assert.deepEqual(app.slice(0, real.length), real.map((c) => H(c.q)), "a card with no k: its question's hash, as before");
  // the text-taking callers (rails, the journeys) still read a text as its hash
  assert.equal(probe.cardKey(S.c.q), H(S.c.q));
  assert.equal(ngKnowledgeCardKey(S.c.q), H(S.c.q));
});

test("proof 2: a shared card reworded WITH its key keeps its grade, schedule, answer mode and shared group; without, it resets", () => {
  assert.ok(S, "premise: a card the manifest shares between decks, each on the wire");
  const { A, c, decks } = S, h = H(c.q), B = decks.find((k) => k !== A);
  // graded on its old text: two right recalls in A (the schedule writes to every deck sharing it)
  const a = boot({});
  for (const k of decks) land(a, k, CARDS);
  for (let i = 0; i < 2; i++) assert.equal(a._gradeKnowledge(A, clone(c), true, "recall", null, "old-" + i, "deck").status, "applied");
  const saved = a._progressBlob();
  // THE DIFFERENTIAL, on a later day: the same record read on the old wire (before) and on the reworded one (after)
  globalThis.window.__NG_EPOCH_DAY__ = LATER;
  const o = boot(saved);
  for (const k of decks) land(o, k, CARDS);
  const before = { stage: o.cardStage(A, c), shared: o._cardStageShared(B, c), srsA: o.srs[A][h], srsB: o.srs[B][h],
    due: o._cardDue(A, c), mc: o._cardAsksMc(A, c), mastery: o.deckMastery(A), glyph: JSON.stringify(o.seenGlyph(A)), group: o._sharedDecksFor(c, A),
    ...owed(o, A, h) };
  assert.ok(before.stage >= 1 && before.srsA && before.srsB, "premise: graded, and scheduled in both decks");
  assert.ok(before.pooled && before.planned, "premise: due today, and a question the planner asks in its deck");

  // the reworded wire, the card carrying the key of the text it replaced
  const W = reworded(true), c2 = W[A].cards.find((x) => x.q === NEW);
  const b = boot(saved);
  for (const k of decks) land(b, k, W);
  assert.equal(b._gradeGone(A, h), false, "the prune marks nothing: the card is live under its key");
  assert.deepEqual({ stage: b.cardStage(A, c2), shared: b._cardStageShared(B, W[B].cards.find((x) => x.q === NEW)), srsA: b.srs[A][h], srsB: b.srs[B][h],
    due: b._cardDue(A, c2), mc: b._cardAsksMc(A, c2), mastery: b.deckMastery(A), glyph: JSON.stringify(b.seenGlyph(A)), group: b._sharedDecksFor(c2, A),
    ...owed(b, A, h) },
    before, "every reading of the card, after its rewording");
  assert.equal(b._gameplanDecks()[A].questions.includes(H(NEW)), false, "the planner asks it under its key, never the new text's hash");
  // its next grade files under its key in every deck sharing it, and nothing under the new text's hash
  const rowsBefore = decks.map((k) => JSON.stringify(b.srs[k][h]));
  assert.equal(b._gradeKnowledge(A, clone(c2), true, "recall", null, "new-0", "deck").status, "applied");
  decks.forEach((k, i) => {
    assert.notEqual(JSON.stringify(b.srs[k][h]), rowsBefore[i], `${k}: the schedule moved, under the key`);
    assert.equal(b.srs[k][h][2], LATER, `${k}: answered today`);
    assert.equal(H(NEW) in (b.srs[k] || {}) || H(NEW) in (b.stage[k] || {}), false, `${k}: nothing under the new text's hash`);
  });
  assert.ok(b.cardStage(A, c2) >= before.stage, "its grade grows from where it was");
  // the legacy credit (a rail's `noteCardDone`) after that grade: the law credited the KEY, so the card is not counted again
  const dk = b._dayKey(), day = (b._days || {})[dk] || 0, prepB = (b.prep || {})[B] || 0;
  b.noteCardDone(clone(c2), A);
  assert.deepEqual([(b._days || {})[dk] || 0, (b.prep || {})[B] || 0], [day, prepB], "credited once, by its key: no second day count, no second shared prep");
  assert.ok(b.__journal.length >= decks.length && b.__journal.every((row) => row[2] === h), "the journal's rows carry the key");

  // THE CONTROL: the same rewording with no key resets the card (what every rewording did before v1.303.0)
  const X = reworded(false), c3 = X[A].cards.find((x) => x.q === NEW);
  const x = boot(saved);
  for (const k of decks) land(x, k, X);
  assert.equal(x.cardStage(A, c3), 0, "control: the card reads as new");
  assert.equal(x._cardDue(A, c3), false, "control: its schedule is gone with it");
  assert.equal(x._sharedDecksFor(c3, A), null, "control: it left its shared group");
  assert.equal(x._gradeGone(A, h), true, "control: its old grade is marked gone");
  assert.ok(x.deckMastery(A) < before.mastery, "control: the deck's mastery drops");
  globalThis.window.__NG_EPOCH_DAY__ = DAY0;
});

test("proof 2b, a card no other deck shares: reworded WITH its key it stays live, due, and in the planner's questions; without, it leaves all three", () => {
  // `_rowLive` answers a shared question from the manifest's index; only a card of ONE deck is read from the deck's own cards
  let R = null;
  for (const A of Object.keys(CARDS).sort()) {
    R = (CARDS[A].cards || []).find((c) => !(probe._sharedQ && probe._sharedQ.get(H(c.q))) && CARDS[A].cards.filter((x) => x.q === c.q).length === 1);
    if (R) { R = { A, c: R }; break; }
  }
  assert.ok(R, "premise: a card no other deck shares, on the wire");
  const { A, c } = R, h = H(c.q), TEXT = "Reworded, a card of one deck: " + c.q.slice(0, 30) + "?";
  const a = boot({});
  land(a, A, CARDS);
  for (let i = 0; i < 2; i++) assert.equal(a._gradeKnowledge(A, clone(c), true, "recall", null, "one-" + i, "deck").status, "applied");
  const saved = a._progressBlob();
  globalThis.window.__NG_EPOCH_DAY__ = LATER;
  try {
    const at = (wire) => { const x = boot(saved); land(x, A, wire); return x; };
    const wire = (withKey) => { const w = clone(CARDS); w[A].cards = w[A].cards.map((x) => (x.q === c.q ? { ...x, q: TEXT, ...(withKey ? { k: h } : {}) } : x)); return w; };
    const before = owed(at(CARDS), A, h);
    assert.deepEqual([before.live, before.pooled, before.planned], [true, true, true], "premise: live, due today, and planned");
    assert.ok(before.dueN >= 1, "premise: counted due");
    const b = at(wire(true));
    assert.deepEqual(owed(b, A, h), before, "reworded with its key: live, in the due pool and its count, and in the planner's questions");
    assert.equal(b._gameplanDecks()[A].questions.includes(H(TEXT)), false, "never under the new text's hash");
    assert.deepEqual(owed(at(wire(false)), A, h), { live: false, pooled: false, dueN: before.dueN - 1, planned: false }, "control: without its key, it leaves all three");
  } finally { globalThis.window.__NG_EPOCH_DAY__ = DAY0; }
});

test("the emitter keys a wire card by its card key (tests/card_key_emitter.py)", () => {
  const r = spawnSync("python3", ["-B", "tests/card_key_emitter.py"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stderr, /Ran 6 tests/, "premise: all six cases ran");
});
