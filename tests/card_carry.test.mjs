// CARD1-S3 (v1.304.0; the owner's U220 a, the orchestrator's CARD1-S3-GO): THE ONE-TIME CARRY. The grades (`stage`) and
// schedules (`srs`) v1.182.2's rewrite left under old question keys come back ONCE to the card's key today, additively:
//     srs[deck][new] = ngKnowledgeMergeRow(srs[deck][new], srs[deck][old], today), stage[deck][new] = max(…), nothing deleted
// (the rule, the dates test, the bound and the frozen marker: neural/src/progress-owner.src.js above NG_CARRY_BEFORE; the flow:
// app.src.jsx above `_carryNeed`). On the real wire and the real carry files this tree emits, with the app's own class:
//   1. THE DATES TEST: a record may hold an old key only with a schedule row answered before 15 Oct 2026, or a grade with no
//      schedule row; otherwise nothing is fetched.
//   2. A FILE IS READ ONLY IF IT IS THE ONE ASKED FOR; the real files read back every pair the committed source keeps.
//   3. THE STEP: the later answer wins (a player who answered the new text keeps it), stage MAX, the old rows untouched, the
//      input untouched, and a second run changes nothing, byte for byte.
//   4. A GUEST carries its own copy on load; every reading rises or stays (mastery, the glyph, recall, score, due, stage);
//      the record saved holds the marker and the old rows.
//   5. AN UNTOUCHED GUEST: nothing fetched, nothing written, no try counted.
//   6. PULL BEFORE WRITE: a signed-in owner carries only on a copy a successful pull for that user merged.
//   7. A FAILURE (a file missing, the wrong file) leaves the record exactly as it was; the next boot tries again; ten a browser.
//   8. DONE IS DONE; a browser whose OWN copy was unmarked and held old rows runs once more and changes nothing.
//   9. A target card reworded later WITH its id (the wire's `k`, its key) reads the carried grade.
//  10. This browser's gone mark on a carried grade is lifted.
//  11. THE MARKER: written as 1, merged as an OR, kept out of the guest part and the practice key.
//  12. THE PACING SEAM: every reader of what is owed takes the schedule through `_srsOwed`, and the rating does not.
//  13. The build half (tests/card_carry_build.py).
// MUTANTS (each red here): the merge's direction swapped (old as the local row) -> 3, 4; the marker never written (`_cardCarry`
// left false) -> 4, 8; the pull-before-write test removed from `_carryNeed` -> 6; a split carried (the generator's split rule
// dropped) -> 13 ("split"); the tries bound removed -> 7.
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { ngKnowledgeQuestionHash as H, ngKnowledgeMergeRow } from "../neural/src/knowledge-profile.src.js";
import { ngCarryDecks, ngCarryFiles, ngCarryRead, ngCarryApply, ngCarryDone, NG_CARRY_BEFORE, NG_CARRY_TRIES, NG_CARRY_TRIES_KEY,
  ngProgressPracticeKey, ngProgressGuestMerge } from "../neural/src/progress-owner.src.js";
import { knowledgeSource } from "./_knowledge_profile_harness.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = resolve(ROOT, "source/quartz/static/neural");
const rd = (p) => readFileSync(resolve(ROOT, p), "utf8");
const clone = (x) => JSON.parse(JSON.stringify(x));
const strip = (t) => t.replace(/^export (function|const|let|var|class) /gm, "$1 ");
const { Component } = new Function("DCLogic", "React", [
  knowledgeSource, strip(rd("neural/src/progress-owner.src.js")), strip(rd("neural/src/lists-codec.src.js")), strip(rd("neural/src/lists.src.js")),
  rd("neural/src/challenge-definitions.src.js"), rd("neural/src/challenge-engine.src.js"), rd("neural/src/app.src.jsx"), rd("neural/src/challenge-ui.src.js"),
].join("\n") + "\nreturn { Component };")(class DCLogic {}, { createRef: () => ({ current: null }) });
const J = (f) => JSON.parse(readFileSync(resolve(DIR, f), "utf8"));
const WIRE = J("graph-data.json"), CURRICULUM = J("curriculum.json"), MANIFEST = J("flashcards/_index.json");
const CARDS = (() => {
  const c = {};
  for (const f of readdirSync(resolve(DIR, "flashcards")).sort()) if (f !== "_index.json" && !f.startsWith("live-")) Object.assign(c, JSON.parse(readFileSync(resolve(DIR, "flashcards", f), "utf8")));
  return c;
})();
const SOURCE = JSON.parse(rd("neural/card-carry.json"));
const CC = CURRICULUM.cardCarry;
const FILE = (i) => resolve(DIR, "carry", i + ".json");
const TODAY = 20782, SEPT = 20700;   // 25 Nov 2026, and an answer of 3 Sept 2026 (before the rewrite reached production)
globalThis.window = globalThis.window || {};
globalThis.window.__NG_EPOCH_DAY__ = TODAY;

// the browser this test runs in: its storage (the try count) and its network (the carry files, counted)
const store = new Map(), fetched = [];
let serve = (i) => (existsSync(FILE(i)) ? readFileSync(FILE(i), "utf8") : null);
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => { store.set(k, String(v)); }, removeItem: (k) => store.delete(k) };
globalThis.fetch = async (url) => {
  fetched.push(url);
  const m = /^carry\/(\d+)\.json\?carry=([0-9a-f]{8})$/.exec(url);
  const body = m ? serve(Number(m[1])) : null;
  return body == null ? { ok: false, json: async () => null } : { ok: true, json: async () => JSON.parse(body) };
};
afterEach(() => { store.clear(); fetched.length = 0; serve = (i) => (existsSync(FILE(i)) ? readFileSync(FILE(i), "utf8") : null); globalThis.window.__NG_EPOCH_DAY__ = TODAY; });

/** the app on the real wire, its progress owner bound to `owner` holding `blob`, loaded by its own `_loadProgress` */
function boot(blob, { owner = { kind: "guest" }, load = true } = {}) {
  const a = Object.create(Component.prototype), marks = {}, saved = [];
  a.settings = {}; a.beats = []; a.track = () => {}; a.get = (_k, d) => d; a.set = () => {}; a.fx = () => {};
  a.ingest(clone(WIRE)); a._giMode = "gi"; a.curriculum = clone(CURRICULUM); a._ingestDeckManifest(clone(MANIFEST));
  Object.assign(a, { _settingsAt: {}, tracked: [], viewToggleRef: { current: null }, explorerListRef: { current: null } });
  a._saveProgress = () => { saved.push(clone(a._progressBlob())); }; a._flushSave = () => {}; a.renderTutorial = () => {}; a.renderChallengeCue = null;
  a.setEvent = () => {}; a.setDeckOpen = () => {}; a._applyLayers = () => {}; a._gameValueChanged = () => {};
  a._rebuildRulesetMask = () => {}; a.weakSpots = () => null; a._progressCurrent = () => true; a._knowledgeEffect = () => {};
  a._progressHost = { goneRead: () => clone(marks), goneWrite: (_i, m, deck) => { if (m[deck]) marks[deck] = clone(m[deck]); else delete marks[deck]; return clone(marks); } };
  a._progressOwner = owner; a._progressOwnerStamp = { owner, epoch: 1 };
  a._progressBootBlob = { v: 2, belts: { won: {} }, ...clone(blob) };
  a.__saved = saved; a.__marks = marks;
  if (load) a._loadProgress(); else { a._hydrateProgressBlob(a._progressBootBlob); delete a._progressBootBlob; a._progressLoaded = true; }
  return a;
}

// a deck the carry covers, with three pairs whose targets are cards of that deck on the wire
const pairsOf = (deck) => { const s = SOURCE.decks[deck] || ""; const out = []; for (let i = 0; i < s.length; i += 16) out.push([s.slice(i, i + 8), s.slice(i + 8, i + 16)]); return out; };
const DECK = Object.keys(SOURCE.decks).sort().find((d) => CARDS[d] && pairsOf(d).length >= 3 && pairsOf(d).every(([, n]) => CARDS[d].cards.some((c) => H(c.q) === n)));
const P = pairsOf(DECK);
/** a player who answered three of that deck's cards on 3 Sept, before the rewrite: rows under the OLD keys */
const september = () => ({
  stage: { [DECK]: { [P[0][0]]: 2, [P[1][0]]: 1, [P[2][0]]: 3 } },
  srs: { [DECK]: { [P[0][0]]: [SEPT + 3, 3, SEPT], [P[1][0]]: [SEPT + 1, 1, SEPT], [P[2][0]]: [SEPT + 7, 7, SEPT] } },
});
const readings = (a) => {
  const glyph = JSON.stringify(a.seenGlyph(DECK));
  return { mastery: a.deckMastery(DECK), glyph, recall: a.recallCount ? a.recallCount() : 0, score: a.gameScore(), due: a.dueCount(),
    stage: P.map(([, n]) => a.cardStage(DECK, CARDS[DECK].cards.find((c) => H(c.q) === n))) };   // by the card, as every reader asks
};

test("1. the dates test: a schedule row answered before 15 Oct 2026, or a grade with no schedule row", () => {
  assert.equal(NG_CARRY_BEFORE, 20741, "the epoch day of 2026-10-15");
  assert.deepEqual([...ngCarryDecks(september())], [DECK]);
  assert.deepEqual([...ngCarryDecks({ srs: { X: { q: [20800, 3, NG_CARRY_BEFORE] } } })], [], "answered on the day itself: after");
  assert.deepEqual([...ngCarryDecks({ srs: { X: { q: [20800, 3, NG_CARRY_BEFORE - 1] } } })], ["X"]);
  assert.deepEqual([...ngCarryDecks({ stage: { Y: { q: 2 } }, srs: { Y: {} } })], ["Y"], "a grade with no schedule (before v1.105.0)");
  assert.deepEqual([...ngCarryDecks({ stage: { Y: { q: 0 } } })], [], "a stage of 0 holds nothing to carry");
  assert.deepEqual([...ngCarryDecks({ stage: { Y: { q: 2 } }, srs: { Y: { q: [20800, 3, 20790] } } })], [], "a grade with its schedule, recent");
  for (const bad of [null, 7, { srs: 3 }, { srs: { X: [1] } }, { srs: { X: { q: "x" } } }]) assert.equal(ngCarryDecks(bad).size, 0);
});

test("2. a carry file is read only if it is the one asked for; the real files hold every pair the source keeps", () => {
  assert.ok(CC && /^[0-9a-f]{8}$/.test(CC.id) && CC.n >= 2, "premise: curriculum.json carries the carry's id and file count");
  let pairs = 0;
  for (let i = 0; i < CC.n; i++) {
    const body = JSON.parse(readFileSync(FILE(i), "utf8"));
    const m = ngCarryRead(body, { id: CC.id, n: CC.n, i });
    assert.ok(m, `file ${i} reads`);
    for (const v of m.values()) pairs += v.length;
    assert.equal(ngCarryRead(body, { id: "00000000", n: CC.n, i }), null, "another build's id");
    assert.equal(ngCarryRead(body, { id: CC.id, n: CC.n, i: (i + 1) % CC.n }), null, "another file");
    assert.equal(ngCarryRead({ ...body, n: CC.n + 1 }, { id: CC.id, n: CC.n, i }), null, "another count");
  }
  assert.equal(pairs, SOURCE.counts.pairs, "every pair of neural/card-carry.json lands on this tree's decks");
  const one = { v: 1, id: CC.id, n: 2, i: 0, d: { "00000000": "0000000a0000000b" } };
  assert.ok(ngCarryRead(one, { id: CC.id, n: 2, i: 0 }));
  assert.equal(ngCarryRead({ ...one, d: { "00000001": "0000000a0000000b" } }, { id: CC.id, n: 2, i: 0 }), null, "a deck in the wrong file");
  assert.equal(ngCarryRead({ ...one, d: { "00000000": "0000000a0000000" } }, { id: CC.id, n: 2, i: 0 }), null, "a short pair");
  assert.equal(ngCarryRead({ ...one, d: { "00000000": "0000000A0000000b" } }, { id: CC.id, n: 2, i: 0 }), null, "not lowercase hex");
  assert.deepEqual(ngCarryFiles(new Set([DECK]), CC.n, H), [parseInt(H(DECK), 16) % CC.n]);
  assert.deepEqual(ngCarryFiles(new Set([DECK]), 0, H), [], "a file count the emitter cannot write is refused");
});

test("3. the step: the later answer wins, stage MAX, the old rows untouched, and a second run changes nothing", () => {
  const pairs = new Map([[H(DECK), P]]);
  const rec = september();
  // the player had also answered the second card's NEW text, later (12 Nov), and graded the third higher meanwhile
  rec.srs[DECK][P[1][1]] = [20780, 3, 20770]; rec.stage[DECK][P[2][1]] = 4;
  const before = clone(rec);
  const r = ngCarryApply(rec, pairs, H, TODAY, ngKnowledgeMergeRow);
  assert.deepEqual(rec, before, "the input is untouched");
  assert.deepEqual(r.srs[DECK][P[0][1]], [SEPT + 3, 3, SEPT], "a row only under the old key: carried as it was");
  assert.deepEqual(r.srs[DECK][P[1][1]], [20780, 3, 20770], "the new text answered later: that row stays");
  assert.deepEqual([r.stage[DECK][P[0][1]], r.stage[DECK][P[1][1]], r.stage[DECK][P[2][1]]], [2, 1, 4], "stage MAX");
  for (const [o] of P) { assert.deepEqual(r.srs[DECK][o], before.srs[DECK][o]); assert.equal(r.stage[DECK][o], before.stage[DECK][o]); }
  assert.equal(r.rows, 3, "three targets changed (the second's stage, though its row was kept)");
  const again = ngCarryApply({ srs: r.srs, stage: r.stage }, pairs, H, TODAY, ngKnowledgeMergeRow);
  assert.equal(JSON.stringify({ srs: again.srs, stage: again.stage }), JSON.stringify({ srs: r.srs, stage: r.stage }), "a second run: byte for byte");
  assert.equal(again.rows, 0);
  // the reverse order of the same two rows: the old answer is the later one, so it wins (the pull's own rule)
  const late = { srs: { [DECK]: { [P[0][0]]: [20790, 30, 20760], [P[0][1]]: [20750, 1, 20749] } }, stage: {} };
  assert.deepEqual(ngCarryApply(late, pairs, H, TODAY, ngKnowledgeMergeRow).srs[DECK][P[0][1]], ngKnowledgeMergeRow([20750, 1, 20749], [20790, 30, 20760], TODAY));
});

test("4. a guest carries its own copy on load: every reading rises or stays, and the record keeps the old rows", async () => {
  assert.ok(DECK, "premise: a deck the carry covers, its targets on the wire");
  const plain = boot(september(), { load: false });
  const before = readings(plain);
  const a = boot(september());
  assert.ok(a._carryP, "the load started the carry");
  const r = await a._carryP;
  assert.equal(r.status, "applied");
  assert.equal(fetched.length, 1, "one file: the one this deck falls in");
  const after = readings(a);
  assert.deepEqual(after.stage, [2, 1, 3], "the grades, under today's keys");
  for (const k of ["mastery", "recall", "score", "due"]) assert.ok(after[k] >= before[k], `${k}: ${before[k]} -> ${after[k]}`);
  assert.ok(after.mastery > before.mastery && after.due > before.due, "the deck's mastery and the due count rise");
  const blob = a.__saved.at(-1);
  assert.equal(blob.cardCarry, 1, "the record is marked done");
  for (const [o, n] of P) { assert.ok(blob.srs[DECK][o] && blob.srs[DECK][n], "old row kept, new row written"); }
  assert.equal(store.get(NG_CARRY_TRIES_KEY), "1");
});

test("5. an untouched guest: nothing fetched, nothing written, no try counted", () => {
  const a = boot({});
  assert.equal(a._carryP, undefined);
  assert.deepEqual([fetched.length, a.__saved.length, store.has(NG_CARRY_TRIES_KEY)], [0, 0, false]);
  const recent = boot({ srs: { [DECK]: { [P[0][1]]: [20790, 3, 20760] } }, stage: { [DECK]: { [P[0][1]]: 1 } } });
  assert.equal(recent._carryP, undefined, "a record begun after the rewrite never fetches");
  assert.equal(ngProgressPracticeKey({ v: 2 }), ngProgressPracticeKey({ v: 2, cardCarry: 1 }), "the marker is not practice");
});

test("6. pull before write: a signed-in owner carries only on a copy a successful pull merged", async () => {
  const a = boot(september(), { owner: { kind: "account", id: "u1" } });
  assert.equal(a._carryP, undefined, "not on load: the cloud has not been merged in");
  assert.equal(fetched.length, 0);
  a._authUserId = "u1"; a._pulled = true; a._pulledUserId = "u2";
  assert.equal(a._carryMaybe("pull"), null, "a pull for another user is not this owner's");
  a._pulledUserId = "u1";
  const r = await a._carryMaybe("pull");
  assert.equal(r.status, "applied");
  assert.equal(a.__saved.at(-1).cardCarry, 1);
});

test("7. a failure leaves the record exactly as it was; the next boot tries again; ten a browser", async () => {
  serve = () => null;
  const a = boot(september());
  const bare = () => { const b = a._progressBlob(); delete b.updatedAt; return JSON.stringify(b); };   // the save's clock aside
  const was = bare();
  assert.equal((await a._carryP).status, "bad-file");
  assert.equal(bare(), was, "nothing applied");
  assert.equal(a.__saved.length, 0, "nothing written");
  assert.equal(a._carryMaybe("curriculum"), null, "one attempt a boot");
  serve = (i) => JSON.stringify({ ...JSON.parse(readFileSync(FILE(i), "utf8")), id: "00000000" });   // another build's file
  assert.equal((await boot(september())._carryP).status, "bad-file");
  assert.equal(store.get(NG_CARRY_TRIES_KEY), "2");
  store.set(NG_CARRY_TRIES_KEY, String(NG_CARRY_TRIES));
  serve = (i) => readFileSync(FILE(i), "utf8");
  fetched.length = 0;
  assert.equal(boot(september())._carryP, undefined, "ten tries on this browser: never again");
  assert.equal(fetched.length, 0);
});

test("8. done is done; a browser whose own copy was unmarked and held old rows runs once more and changes nothing", async () => {
  const a = boot(september());
  await a._carryP;
  const carried = a.__saved.at(-1);
  fetched.length = 0;
  const b = boot(carried);
  assert.equal(b._carryP, undefined, "a copy marked done never fetches");
  // a browser that never synced since September: its own copy unmarked, with old rows; the merged copy is marked
  const c = boot(september());
  c._carryP && (await c._carryP);
  const d = boot({ ...september() }, { owner: { kind: "account", id: "u1" } });
  d._mergeProgressFields(clone(carried));
  d._hydrateProgressBlob(d._progressBlob());
  d._carryLocal = { done: false, may: true };
  d._authUserId = "u1"; d._pulled = true; d._pulledUserId = "u1";
  const was = JSON.stringify({ srs: d.srs, stage: d.stage });
  const r = await d._carryMaybe("pull");
  assert.equal(r.status, "applied");
  assert.equal(r.rows, 0, "nothing the first run carried moves again");
  assert.equal(JSON.stringify({ srs: d.srs, stage: d.stage }), was, "byte for byte");
});

test("9. a target card reworded later WITH its id reads the carried grade", async () => {
  const a = boot(september());
  await a._carryP;
  const card = CARDS[DECK].cards.find((c) => H(c.q) === P[0][1]);
  const reworded = { ...card, q: "Reworded after the carry, keeping its key?", k: P[0][1] };
  assert.equal(a.cardKey(reworded), P[0][1]);
  assert.equal(a.cardStage(DECK, reworded), 2, "the carried grade, under the card's key");
  assert.deepEqual(a.srs[DECK][a.cardKey(reworded)], [SEPT + 3, 3, SEPT]);
});

test("10. this browser's gone mark on a carried grade is lifted", async () => {
  const a = boot(september(), { load: false });
  a.stageGone = { [DECK]: { [P[0][1]]: 1 } };
  a._carryLocal = { done: false, may: true };
  const r = await a._carryMaybe("curriculum");
  assert.equal(r.status, "applied");
  assert.equal(a._gradeGone(DECK, P[0][1]), false);
  assert.equal(a.__marks[DECK], undefined, "the browser's store, too");
});

test("11. the marker: written as 1, merged as an OR, kept out of the guest part", () => {
  const a = boot({}, { load: false });
  assert.equal("cardCarry" in a._progressBlob(), false, "not written before it is done");
  a._mergeProgressFields({ v: 2, cardCarry: 1 });
  assert.equal(a._progressBlob().cardCarry, 1, "done on either copy is done");
  a._mergeProgressFields({ v: 2 });
  assert.equal(a._progressBlob().cardCarry, 1, "and stays done");
  assert.equal(ngCarryDone(1), true); assert.equal(ngCarryDone(true), false); assert.equal(ngCarryDone({ v: 1 }), false);
  const joined = ngProgressGuestMerge((live, part) => ({ ...live, ...part }), { v: 2 }, { v: 2, cardCarry: 1, stage: {} });
  assert.equal("cardCarry" in joined, false, "a guest's marker never joins the account");
});

test("12. the pacing seam: every reader of what is owed takes the schedule through _srsOwed, the rating does not", () => {
  const src = rd("neural/src/app.src.jsx");
  const owed = [...src.matchAll(/ngGameplan(?:Debt|Bind|Progress)\(([^;]*)/g)].map((m) => m[1]);
  assert.ok(owed.length >= 7, `premise: the planner's owed readers found (${owed.length})`);
  for (const call of owed) { assert.match(call, /this\._srsOwed\(\)/, call.slice(0, 120)); assert.doesNotMatch(call, /this\.srs\b/, call.slice(0, 120)); }
  assert.match(src, /decks: this\._gameplanDecks\(true\), srs: this\._srsOwed\(\),/, "the plan's own build");
  assert.match(rd("neural/src/master-list.src.js"), /ngPracticeItems\(\{ day, srs: app\._srsOwed \? app\._srsOwed\(\) : app\.srs,/, "Master the game's owed cards");
  assert.match(src, /ngRatingShare\(game, \{ srs: this\.srs,/, "the rating reads the schedule as stored");
  // and the due pool reads through it: a view in which the row is not due empties the count
  const a = boot(september(), { load: false });
  a.srs = clone(a.srs); a.srs[DECK][P[0][1]] = [SEPT + 3, 3, SEPT];
  const n = a.dueCount();
  assert.ok(n >= 1, "premise: a carried row due");
  a._srsOwed = () => ({ ...a.srs, [DECK]: { ...a.srs[DECK], [P[0][1]]: [TODAY + 5, 3, SEPT] } });
  assert.equal(a.dueCount(), n - 1, "duePool reads the seam");
});

test("13. the build half: the generator and the emitter (tests/card_carry_build.py)", () => {
  const r = spawnSync("python3", ["-B", "tests/card_carry_build.py"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stderr, /Ran 11 tests/, "premise: all eleven cases ran");
});
