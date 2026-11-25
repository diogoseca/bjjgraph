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
//   5. AN UNTOUCHED GUEST: nothing fetched, nothing written, no try counted. 5b. A record from before the rewrite with no
//      reworded card: one fetch, nothing carried, the marker kept on this browser only (no save, so no push), never again.
//   6. PULL BEFORE WRITE: a signed-in owner carries only on a copy a successful pull for that user merged.
//   7. A FAILURE (a file missing, the wrong file) leaves the record exactly as it was; the next boot tries again; ten a browser.
//   8. DONE IS DONE; a browser whose OWN copy was unmarked and held old rows runs once more and changes nothing.
//   9. A target card reworded later WITH its id (the wire's `k`, its key) reads the carried grade.
//  10. This browser's gone mark on a carried grade is lifted.
//  11. THE MARKER: written as 1, merged as an OR, kept out of the guest part and the practice key.
//  12. ALL AT ONCE (the owner's U222 a): a carried row is owed by its own schedule, read by every owed reader from the stored
//      schedule itself (no pacing anywhere).
//  13. The build half (tests/card_carry_build.py).
//  14. A PULL THAT GROWS THE SEPTEMBER ROWS (an older build's device synced late) carries them too; a pull that brings nothing
//      new starts nothing.
//  15, 16. THE SYNC READER'S TRACES (PR #471, seeds 26 and 75; CARD1-S3-R1 F1): decided by content per owner on this browser,
//      a device whose attempt failed after the marker came in, and rows an older build pushed after the carry, are carried.
//  17. THE DUE BADGE BEFORE THE LIVE SET (F3): each carried row counted once, at once.
//  F2, in 7: tries are per owner, server answers only, cleared by a success; ten offline openings then one online carries.
// MUTANTS (each red here): the merge's direction swapped (old as the local row) -> 3, 4; the marker never written (`_cardCarry`
// left false) -> 4, 8; the pull-before-write test removed from `_carryNeed` -> 6; a split carried (the generator's split rule
// dropped) -> 13 ("split"); the tries bound removed -> 7; the pull's growth rule removed from `_pullAndMerge` -> 16; the pending flag never set -> 15, 16;
// a network failure counted as a try -> 7; the old keys not marked gone, or `_rowLive` not reading the marks -> 12, 17;
// the marks written all at once -> 17; the count not followed down -> 18.
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { ngKnowledgeQuestionHash as H, ngKnowledgeMergeRow } from "../neural/src/knowledge-profile.src.js";
import { ngCarryDecks, ngCarryFiles, ngCarryRead, ngCarryApply, ngCarryDone, ngCarryCount, ngCarryStateRead, NG_CARRY_BEFORE, NG_CARRY_TRIES,
  ngProgressPracticeKey, ngProgressGuestMerge } from "../neural/src/progress-owner.src.js";
import { knowledgeSource } from "./_knowledge_profile_harness.mjs";
import { ratingLiveFiles } from "./_rating_fixture.mjs";

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

// THE BROWSER this test runs in (one per test unless a test makes more): its local store (the carry's state, per owner, and the
// gone marks, per owner) and its network: the carry files, each served as written, as a server's 404 (`null`) or not at all
// (`OFFLINE`: the fetch rejects), counted
const OFFLINE = Symbol("offline");
const newBrowser = () => ({ store: new Map(), marks: new Map() });
let browser = newBrowser(), fetched = [];
const real = (i) => (existsSync(FILE(i)) ? readFileSync(FILE(i), "utf8") : null);
let serve = real;
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };   // the app keeps nothing of the carry here
globalThis.fetch = async (url) => {
  fetched.push(url);
  const m = /^carry\/(\d+)\.json\?carry=([0-9a-f]{8})$/.exec(url);
  const body = m ? serve(Number(m[1])) : null;
  if (body === OFFLINE) throw new TypeError("Failed to fetch");
  return body == null ? { ok: false, json: async () => null } : { ok: true, json: async () => JSON.parse(body) };
};
afterEach(() => { browser = newBrowser(); fetched = []; serve = real; globalThis.window.__NG_EPOCH_DAY__ = TODAY; });
const ownerId = (o) => o.kind + ":" + (o.id || "");
const stateOf = (o, b = browser) => ngCarryStateRead(b.store.get("carry " + ownerId(o)) || null);

/** the app on the real wire, its progress owner bound to `owner` holding `blob`, loaded by its own `_loadProgress`, on `on` */
function boot(blob, { owner = { kind: "guest" }, load = true, on = browser } = {}) {
  const a = Object.create(Component.prototype), saved = [], id = ownerId(owner);
  if (!on.marks.has(id)) on.marks.set(id, {});
  const marks = on.marks.get(id);
  a.settings = {}; a.beats = []; a.track = () => {}; a.get = (_k, d) => d; a.set = () => {}; a.fx = () => {};
  a.ingest(clone(WIRE)); a._giMode = "gi"; a.curriculum = clone(CURRICULUM); a._ingestDeckManifest(clone(MANIFEST));
  Object.assign(a, { _settingsAt: {}, tracked: [], viewToggleRef: { current: null }, explorerListRef: { current: null } });
  a._saveProgress = () => { saved.push(clone(a._progressBlob())); }; a._flushSave = () => {}; a.renderTutorial = () => {}; a.renderChallengeCue = null;
  a.setEvent = () => {}; a.setDeckOpen = () => {}; a._applyLayers = () => {}; a._gameValueChanged = () => {};
  a._rebuildRulesetMask = () => {}; a.weakSpots = () => null; a._progressCurrent = () => true; a._knowledgeEffect = () => {};
  const persisted = [];
  a._progressHost = { goneRead: () => clone(marks), goneWrite: (_i, m, deck) => { if (m[deck]) marks[deck] = clone(m[deck]); else delete marks[deck]; return clone(marks); },
    carryRead: () => on.store.get("carry " + id) || null, carryWrite: (_i, st) => { on.store.set("carry " + id, clone(st)); return true; },
    persist: (_i, b) => { persisted.push(clone(b)); return { status: "saved" }; } };
  a.__persisted = persisted;
  a._progressOwner = owner; a._progressOwnerStamp = { owner, epoch: 1 };
  a._progressBootBlob = { v: 2, belts: { won: {} }, ...clone(blob) };
  a.__saved = saved; a.__marks = marks;
  if (load) a._loadProgress(); else { a._hydrateProgressBlob(a._progressBootBlob); delete a._progressBootBlob; a._progressLoaded = true; }
  return a;
}
/** a signed-in owner's pull from a fake cloud holding `cloud` (the app's own `_pullAndMerge`), then its carry if one started */
async function pull(a, cloud, user = "u1") {
  const A = { neuralSyncVersion: 2, pullNeural: async (id) => ({ userId: id, blob: { v: 2, belts: { won: {} }, ...clone(cloud) } }) };
  Object.assign(a, { _auth: () => A, _authUserId: user, _authEpoch: 0, _afterPullLevel: () => {}, _joinGuestPractice: () => {}, _refreshChallengeEvidence: () => {} });
  a._carryP = undefined;
  assert.equal(await a._pullAndMerge(), true, "the pull itself");
  return a._carryP ? a._carryP : null;
}
const latest = (a) => clone(a.__saved.at(-1) || a._progressBlob());
let SHARED_Q = null;
const probeShared = () => SHARED_Q || (SHARED_Q = boot({}, { load: false })._sharedQ || new Map());

// a deck the carry covers, with three pairs whose targets are cards of that deck on the wire
const pairsOf = (deck) => { const s = SOURCE.decks[deck] || ""; const out = []; for (let i = 0; i < s.length; i += 16) out.push([s.slice(i, i + 8), s.slice(i + 8, i + 16)]); return out; };
const DECK = Object.keys(SOURCE.decks).sort().find((d) => CARDS[d] && pairsOf(d).length >= 3 && pairsOf(d).every(([, n]) => CARDS[d].cards.some((c) => H(c.q) === n)));
const P = pairsOf(DECK);
// a pair of ANOTHER deck, for a row only one device ever held (the reader's traces)
const XD = Object.keys(SOURCE.decks).sort().find((d) => d !== DECK && CARDS[d] && pairsOf(d).some(([, n]) => CARDS[d].cards.some((c) => H(c.q) === n)));
const [XO, XN] = pairsOf(XD).find(([, n]) => CARDS[XD].cards.some((c) => H(c.q) === n));
/** a player who answered three of that deck's cards on 3 Sept, before the rewrite: rows under the OLD keys */
const september = () => ({
  stage: { [DECK]: { [P[0][0]]: 2, [P[1][0]]: 1, [P[2][0]]: 3 } },
  srs: { [DECK]: { [P[0][0]]: [SEPT + 3, 3, SEPT], [P[1][0]]: [SEPT + 1, 1, SEPT], [P[2][0]]: [SEPT + 7, 7, SEPT] } },
});
const readings = (a) => {
  const glyph = JSON.stringify(a.seenGlyph(DECK));
  return { mastery: a.deckMastery(DECK), glyph, recall: a.recallCount ? a.recallCount() : 0, score: a.gameScore().score, due: a.dueCount(),
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
  // rises or stays (the same sum taken over other keys may differ in its last bit: 1e-9); before the deck lands dev already
  // counts the old rows as "not known yet", so the carry's own rise shows once it lands and the old rows are pruned from view
  for (const k of ["mastery", "recall", "score", "due"]) assert.ok(after[k] >= before[k] - 1e-9, `${k}: ${before[k]} -> ${after[k]}`);
  const landed = (x) => { const d = x.flashcards.decks[DECK]; d.cards = clone(CARDS[DECK].cards); x._pruneStaleGrades(DECK, d.cards); return x.deckMastery(DECK); };
  assert.ok(landed(a) > landed(plain), "the deck landed: the carried grades count, the old ones are gone on both");
  const blob = a.__saved.at(-1);
  assert.equal(blob.cardCarry, 1, "the record is marked done");
  for (const [o, n] of P) { assert.ok(blob.srs[DECK][o] && blob.srs[DECK][n], "old row kept, new row written"); }
  assert.deepEqual(stateOf({ kind: "guest" }), { n: ngCarryCount(blob), pending: false, tries: 0 }, "this browser's state: met, at the record's count");
});

test("5. an untouched guest: nothing fetched, nothing written, no try counted", () => {
  const a = boot({});
  assert.equal(a._carryP, undefined);
  assert.deepEqual([fetched.length, a.__saved.length, browser.store.size], [0, 0, 0], "nothing fetched, saved or kept");
  const recent = boot({ srs: { [DECK]: { [P[0][1]]: [20790, 3, 20760] } }, stage: { [DECK]: { [P[0][1]]: 1 } } });
  assert.equal(recent._carryP, undefined, "a record begun after the rewrite never fetches");
  assert.equal(ngProgressPracticeKey({ v: 2 }), ngProgressPracticeKey({ v: 2, cardCarry: 1 }), "the marker is not practice");
});

test("5b. a record from before the rewrite with no reworded card: one fetch, nothing carried, nothing written, never again", async () => {
  const card = CARDS[DECK].cards.find((c) => !P.some(([, n]) => H(c.q) === n));
  const rec = { stage: { [DECK]: { [H(card.q)]: 2 } }, srs: { [DECK]: { [H(card.q)]: [SEPT + 3, 3, SEPT] } } };
  const a = boot(rec);
  const r = await a._carryP;
  assert.deepEqual([r.status, r.rows], ["applied", 0]);
  assert.deepEqual([a.__saved.length, a.__persisted.length], [0, 0], "no save and no push");
  assert.deepEqual(stateOf({ kind: "guest" }), { n: 1, pending: false, tries: 0 });
  fetched = [];
  assert.equal(boot(rec)._carryP, undefined, "and never again on this browser");
  assert.equal(fetched.length, 0);
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

test("7. a failure leaves the record exactly as it was and keeps the need; ten server answers per owner; offline is no try (F2)", async () => {
  const G = { kind: "guest" };
  serve = () => null;   // the server answers 404
  const a = boot(september());
  const bare = () => { const b = a._progressBlob(); delete b.updatedAt; return JSON.stringify(b); };   // the save's clock aside
  const was = bare();
  assert.equal((await a._carryP).status, "bad-file");
  assert.equal(bare(), was, "nothing applied");
  assert.equal(a.__saved.length, 0, "nothing written");
  assert.deepEqual(stateOf(G), { n: 0, pending: true, tries: 1 }, "a server's answer is a try, and the need is kept");
  assert.equal(a._carryMaybe("curriculum"), null, "one attempt a boot");
  serve = (i) => JSON.stringify({ ...JSON.parse(real(i)), id: "00000000" });   // another build's file: a try too
  assert.equal((await boot(september())._carryP).status, "bad-file");
  assert.equal(stateOf(G).tries, 2);
  serve = real;
  assert.equal((await boot(september())._carryP).status, "applied", "the server then serves the files");
  assert.deepEqual([stateOf(G).tries, stateOf(G).pending], [0, false], "a success clears the tries and the need");
  // TEN OFFLINE OPENINGS, then one online: the carry lands (the reader's F2, r471t.mjs 3)
  browser = newBrowser(); serve = () => OFFLINE;
  for (let k = 0; k < 10; k++) assert.equal((await boot(september())._carryP).status, "offline");
  assert.deepEqual(stateOf(G), { n: 0, pending: true, tries: 0 }, "a network failure is never a try");
  const nav = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", { value: { onLine: false }, configurable: true });
  try {
    fetched = [];
    assert.equal(boot(september())._carryP, undefined, "offline: nothing is even asked for");
    assert.equal(fetched.length, 0);
  } finally { if (nav) Object.defineProperty(globalThis, "navigator", nav); else delete globalThis.navigator; }
  serve = real;
  const on = boot(september());
  assert.equal((await on._carryP).status, "applied", "the first online opening carries");
  assert.deepEqual(stateOf(G), { n: ngCarryCount(latest(on)), pending: false, tries: 0 }, "a success clears the tries");
  // TEN SERVER ANSWERS bind THAT owner only: an account signing in on this browser still carries
  browser = newBrowser(); serve = () => null;
  for (let k = 0; k < NG_CARRY_TRIES; k++) await boot(september())._carryP;
  assert.equal(stateOf(G).tries, NG_CARRY_TRIES);
  fetched = [];
  assert.equal(boot(september())._carryP, undefined, "the guest's ten are spent: never again for the guest here");
  serve = real;
  const acct = boot(september(), { owner: { kind: "account", id: "u1" } });
  assert.equal((await pull(acct, september())).status, "applied", "the account's own tries are its own");
});

test("8. a successful carry is not repeated; a browser runs again only on MORE September rows, and that run changes nothing carried", async () => {
  const a = boot(september());
  await a._carryP;
  const carried = latest(a);
  fetched = [];
  assert.equal(boot(carried)._carryP, undefined, "the same browser, the same rows: nothing fetched");
  assert.equal(fetched.length, 0);
  // a SECOND browser of the account, its own copy the carried record: it has no state, so it fetches once, and changes nothing
  const other = newBrowser();
  const d = boot(carried, { owner: { kind: "account", id: "u1" }, on: other });
  const was = JSON.stringify({ srs: d.srs, stage: d.stage });
  const r = await pull(d, carried);
  assert.deepEqual([r.status, r.rows], ["applied", 0], "one fetch, nothing moves");
  assert.equal(JSON.stringify({ srs: d.srs, stage: d.stage }), was, "byte for byte");
  fetched = [];
  assert.equal(await pull(boot(carried, { owner: { kind: "account", id: "u1" }, on: other }), carried), null, "and then never again there");
  assert.equal(fetched.length, 0);
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
  const r = await a._carryMaybe("curriculum");
  assert.equal(r.status, "applied");
  assert.equal(a._gradeGone(DECK, P[0][1]), false);
  assert.equal(a.__marks[DECK][P[0][1]], undefined, "the browser's store, too");
  for (const [o] of P) assert.equal(a._gradeGone(DECK, o), true, "and the old key it came from is marked gone (F3)");
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

test("12. all at once (U222 a), counted once (F3): every carried row already due is owed the day it lands, from the stored schedule", async () => {
  const src = rd("neural/src/app.src.jsx");
  const owed = [...src.matchAll(/ngGameplan(?:Debt|Bind|Progress)\(([^;]*)/g)].map((m) => m[1]);
  assert.ok(owed.length >= 7, `premise: the planner's owed readers found (${owed.length})`);
  for (const call of owed) assert.match(call, /this\.srs\b/, "every owed reader takes the schedule as stored: " + call.slice(0, 100));
  assert.doesNotMatch(src, /_srsOwed|carried row not yet released/, "nothing paces a carried row");
  const plain = boot(september(), { load: false });
  const a = boot(september());
  await a._carryP;
  const pool = (x) => x.duePool().filter((e) => e.key === DECK).map((e) => e.qh).sort();
  assert.deepEqual(pool(a), P.map(([, n]) => n).sort(), "no live set yet: the carried rows, each once (the old keys are marked gone here)");
  assert.deepEqual(pool(plain), P.map(([o]) => o).sort(), "the record not carried, as dev reads it: its old rows, not known yet");
  a._ratingLiveFrom(ratingLiveFiles(DIR)); plain._ratingLiveFrom(ratingLiveFiles(DIR));
  assert.deepEqual(pool(a), P.map(([, n]) => n).sort(), "the live set in: the same");
  assert.deepEqual(pool(plain), [], "and the record not carried owes none of these cards");
});

test("14. a pull that brings in MORE September rows (another device's, synced late) carries them too", async () => {
  // this browser carried its own rows (pair 0) and is marked done; the cloud now also holds pair 1's old row, pushed by a
  // device that kept it to itself since September
  const mine = { stage: { [DECK]: { [P[0][0]]: 2 } }, srs: { [DECK]: { [P[0][0]]: [SEPT + 3, 3, SEPT] } } };
  const a0 = boot(mine);
  await a0._carryP;
  const local = a0.__saved.at(-1);
  assert.equal(local.cardCarry, 1);
  const cloud = clone(local);
  cloud.srs[DECK][P[1][0]] = [SEPT + 1, 1, SEPT]; cloud.stage[DECK][P[1][0]] = 1;
  const a = boot(local, { owner: { kind: "account", id: "u1" } });
  const A = { neuralSyncVersion: 2, pullNeural: async (id) => ({ userId: id, blob: clone(cloud) }) };
  Object.assign(a, { _auth: () => A, _authUserId: "u1", _authEpoch: 0, _afterPullLevel: () => {}, _joinGuestPractice: () => {}, _refreshChallengeEvidence: () => {} });
  fetched.length = 0;
  assert.equal(await a._pullAndMerge(), true);
  assert.ok(a._carryP, "the pull started a second carry");
  const r = await a._carryP;
  assert.equal(r.status, "applied");
  assert.deepEqual(a.srs[DECK][P[1][1]], [SEPT + 1, 1, SEPT], "the late row, under today's key");
  assert.equal(a.stage[DECK][P[0][1]], 2, "the first carry's grade unchanged");
  // a pull that brings nothing new starts nothing
  const b = boot(a.__saved.at(-1), { owner: { kind: "account", id: "u1" } });
  const B = { neuralSyncVersion: 2, pullNeural: async (id) => ({ userId: id, blob: clone(a.__saved.at(-1)) }) };
  Object.assign(b, { _auth: () => B, _authUserId: "u1", _authEpoch: 0,
    _afterPullLevel: () => {}, _joinGuestPractice: () => {}, _refreshChallengeEvidence: () => {} });
  fetched.length = 0;
  assert.equal(await b._pullAndMerge(), true);
  assert.equal(b._carryP, undefined);
  assert.equal(fetched.length, 0);
});

test("15. the reader's trace, seed 26: a device whose own attempt failed after the marker came in still carries, at a later boot", async () => {
  // D1 carried its rows and pushed; D0 holds September rows the cloud never had; D0's pull brings the marker in, its own attempt
  // fails at the server, and it saves. Before R1, D0 read "done" from then on and its rows were never carried.
  const D0 = newBrowser(), D1 = newBrowser(), me = { kind: "account", id: "u1" };
  const d1 = boot(september(), { owner: me, on: D1 });
  assert.equal((await pull(d1, september())).status, "applied");
  const cloud = latest(d1);
  const own = { stage: { [DECK]: { [P[0][0]]: 2 }, [XD]: { [XO]: 4 } }, srs: { [DECK]: { [P[0][0]]: [SEPT + 3, 3, SEPT] }, [XD]: { [XO]: [SEPT + 2, 1, SEPT + 1] } } };   // XD's row: D1 never had it
  serve = () => null;
  const d0 = boot(own, { owner: me, on: D0 });
  assert.equal((await pull(d0, cloud)).status, "bad-file", "its own attempt fails");
  const saved = d0._progressBlob();
  assert.equal(saved.cardCarry, 1, "the marker came in with the pull");
  serve = real;
  const again = boot(saved, { owner: me, on: D0 });
  assert.equal((await pull(again, cloud)).status, "applied", "the next boot carries: the need was kept");
  assert.deepEqual(again.srs[XD][XN], [SEPT + 2, 1, SEPT + 1], "D0's own row, under today's key");
  assert.equal(again.stage[XD][XN], 4);
  assert.equal(stateOf(me, D0).pending, false);
});

test("16. the reader's trace, seed 75: rows an older build pushed after the carry are carried by the next boot, and by that device once upgraded", async () => {
  // D0 carried; D1, an older build, pushed its own September rows afterwards (and keeps the marker it pulled). D0's pull that
  // brought them came in a boot that had already tried. Before R1, nobody ever carried them.
  const D0 = newBrowser(), me = { kind: "account", id: "u1" };
  const d0 = boot(september(), { owner: me, on: D0 });
  assert.equal((await pull(d0, september())).status, "applied");
  const late = latest(d0);
  late.stage[XD] = { ...(late.stage[XD] || {}), [XO]: 4 }; late.srs[XD] = { ...(late.srs[XD] || {}), [XO]: [SEPT + 2, 1, SEPT + 1] };   // D1's row, pushed now
  const tried = boot(latest(d0), { owner: me, on: D0 });
  tried._carryTried = true;                                                         // this boot already spent its attempt
  assert.equal(await pull(tried, late), null, "no second attempt this boot");
  assert.equal(stateOf(me, D0).pending, true, "but the pull that grew the count kept the need");
  const next = boot(tried._progressBlob(), { owner: me, on: D0 });
  assert.equal((await pull(next, late)).status, "applied", "the next boot carries the late rows");
  // and D1 itself, once upgraded, starts with no state on its browser: it carries its own rows, whatever the marker says
  const D1 = newBrowser(), d1 = boot(late, { owner: me, on: D1 });
  assert.equal((await pull(d1, late)).status, "applied");
  assert.equal(d1.stage[XD][XN], 4, "D1's own row, carried by D1");
  assert.equal(next.stage[XD][XN], 4, "and by D0's next boot");
});

test("17. the due badge before the live set (F3): 298 for 298, never the carried rows twice", async () => {
  // a September player: 150 reworded cards (their old rows carried) and 148 untouched ones, each due, none shared
  const sh = probeShared(), seen = new Set(), olds = [], rows = { stage: {}, srs: {} };
  for (const d of Object.keys(SOURCE.decks).sort()) {
    if (!CARDS[d] || olds.length >= 150) continue;
    for (const [o, n] of pairsOf(d)) if (olds.length < 150 && !sh.has(o) && !sh.has(n) && !seen.has(o) && !seen.has(n) && CARDS[d].cards.some((c) => H(c.q) === n)) { olds.push([d, o, n]); seen.add(o); seen.add(n); }
  }
  const keep = [];
  for (const d of Object.keys(CARDS).sort()) for (const c of CARDS[d].cards) { const q = H(c.q); if (keep.length < 148 && !sh.has(q) && !seen.has(q)) { keep.push([d, q]); seen.add(q); } }
  assert.deepEqual([olds.length, keep.length], [150, 148], "premise: the fixture");
  for (const [d, q] of [...olds.map(([d, o]) => [d, o]), ...keep]) { (rows.stage[d] = rows.stage[d] || {})[q] = 2; (rows.srs[d] = rows.srs[d] || {})[q] = [SEPT + 3, 3, SEPT]; }
  const a = boot(rows);
  await a._carryP;
  assert.equal(a.dueCount(), 298, "no live set: 298 (the double count read 448)");
  a._ratingLiveFrom(ratingLiveFiles(DIR));
  assert.equal(a.dueCount(), 298, "the live set in: the same 298");
});

test("18. the count follows answered September rows down, so a row another tab brings in afterwards is still carried", async () => {
  const a = boot(september());
  await a._carryP;
  const G = { kind: "guest" }, n0 = stateOf(G).n;
  // two September rows answered since (their `last` is today now): the next decision brings n down to the record's count
  const answered = latest(a);
  for (const [, nu] of P.slice(0, 2)) answered.srs[DECK][nu] = [TODAY + 3, 3, TODAY];
  for (const [o] of P.slice(0, 2)) answered.srs[DECK][o] = [TODAY + 3, 3, TODAY];
  const b = boot(answered);
  assert.equal(b._carryP, undefined, "nothing to carry");
  assert.ok(stateOf(G).n < n0, `n follows the record down (${n0} -> ${stateOf(G).n})`);
  // another tab's save then brings in one September row this browser never carried: more than n, so it is carried
  const more = latest(b);
  more.stage[XD] = { [XO]: 3 }; more.srs[XD] = { [XO]: [SEPT + 7, 7, SEPT] };
  const c = boot(more);
  assert.equal((await c._carryP).status, "applied");
  assert.equal(c.stage[XD][XN], 3);
});

test("13. the build half: the generator and the emitter (tests/card_carry_build.py)", () => {
  const r = spawnSync("python3", ["-B", "tests/card_carry_build.py"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stderr, /Ran 12 tests/, "premise: all twelve cases ran");
});
